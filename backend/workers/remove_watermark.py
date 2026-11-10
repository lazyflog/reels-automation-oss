"""Optional watermark / burned-in subtitle removal via the vmake.ai plugin.

This step is DISABLED by default (``ENABLE_WATERMARK_REMOVAL=false``).
Removing watermarks or other rights-management information from videos you do
not own may be illegal in many jurisdictions — read docs/LEGAL.md first.

The vmake SDK is not distributed with this project. To use this step, install
it yourself into ``VMAKE_SDK_DIR`` (default: ``backend/plugins/vmake``) — see
backend/plugins/vmake/README.md.
"""
import logging
import os
import sys

import requests

from workers.celery_app import celery
from database import SyncSessionLocal
from models.job import Job
from config import settings

logger = logging.getLogger(__name__)


def update_job(job_id: str, **kwargs):
    with SyncSessionLocal() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
            db.commit()


def _load_vmake_client():
    """Import the user-installed vmake SDK from VMAKE_SDK_DIR.

    Returns a SkillClient instance, or None if the plugin is not available.
    """
    sdk_dir = os.path.abspath(settings.vmake_sdk_dir)
    if not os.path.isfile(os.path.join(sdk_dir, "sdk", "__init__.py")):
        logger.warning(
            "vmake SDK not found in %s — see backend/plugins/vmake/README.md", sdk_dir
        )
        return None
    if sdk_dir not in sys.path:
        sys.path.insert(0, sdk_dir)
    try:
        from sdk.core.client import SkillClient  # type: ignore[import-not-found]
    except Exception as e:  # pragma: no cover - depends on a third-party install
        logger.warning("Failed to import vmake SDK: %s", e)
        return None
    return SkillClient(ak=settings.vmake_ak, sk=settings.vmake_sk)


def watermark_removal_available() -> bool:
    return bool(
        settings.enable_watermark_removal and settings.vmake_ak and settings.vmake_sk
    )


def process_video_vmake(client, video_path: str) -> str:
    """Run vmake's video clean-up task and return the result URL."""
    result = client.run_task("videoscreenclear", video_path)
    output_urls = result.get("output_urls", [])
    if not output_urls:
        raise ValueError(f"vmake.ai returned no result URL: {result}")
    return output_urls[0]


def download_file(url: str, dest_path: str) -> None:
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=65536):
                f.write(chunk)


@celery.task(bind=True, max_retries=2, retry_backoff=True)
def remove_watermark(self, prev_result: dict) -> dict:
    if not prev_result:
        return

    job_id = prev_result["job_id"]

    if not settings.enable_watermark_removal:
        return prev_result

    if not settings.vmake_ak or not settings.vmake_sk:
        logger.warning(f"[{job_id}] VMAKE_AK/SK not set — skipping watermark removal")
        return prev_result

    client = _load_vmake_client()
    if client is None:
        logger.warning(f"[{job_id}] vmake plugin not installed — skipping watermark removal")
        return prev_result

    video_paths = prev_result.get("video_paths") or []
    if not video_paths and prev_result.get("video_path"):
        video_paths = [prev_result["video_path"]]

    if not video_paths:
        logger.warning(f"[{job_id}] No videos to process for watermark removal")
        return prev_result

    logger.info(f"[{job_id}] Watermark removal started ({len(video_paths)} video(s))")
    update_job(job_id, status="removing_watermarks")

    output_dir = os.path.join(settings.temp_dir, job_id)
    clean_paths = []

    for i, video_path in enumerate(video_paths):
        try:
            logger.info(
                f"[{job_id}] vmake.ai processing ({i+1}/{len(video_paths)}): "
                f"{os.path.basename(video_path)}"
            )
            result_url = process_video_vmake(client, video_path)

            clean_path = os.path.join(output_dir, f"clean_{i}.mp4")
            download_file(result_url, clean_path)
            clean_paths.append(clean_path)
            logger.info(f"[{job_id}] Watermark removal done: {clean_path}")

        except Exception as e:
            logger.warning(
                f"[{job_id}] Watermark removal failed for video {i} (keeping original): {e}"
            )
            clean_paths.append(video_path)

    update_job(
        job_id,
        status="watermarks_removed",
        video_path=clean_paths[0] if clean_paths else None,
        video_paths=clean_paths,
    )

    return {
        **prev_result,
        "video_path": clean_paths[0] if clean_paths else prev_result.get("video_path"),
        "video_paths": clean_paths,
    }
