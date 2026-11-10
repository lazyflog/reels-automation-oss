import os
import logging

import requests
import yt_dlp

from workers.celery_app import celery
from database import SyncSessionLocal
from models.job import Job
from config import settings

logger = logging.getLogger(__name__)

def extract_xhs_video(url: str, output_path: str) -> str | None:
    """Get the CDN URL from the xhs-downloader sidecar service, then download directly. Returns a metadata string."""
    headers = {}
    if settings.xhs_downloader_token:
        headers["Authorization"] = f"Bearer {settings.xhs_downloader_token}"
    resp = requests.post(
        f"{settings.xhs_downloader_url.rstrip('/')}/xhs/detail",
        json={"url": url, "download": False},
        headers=headers,
        timeout=60,
    )
    if resp.status_code in (401, 403):
        raise ValueError(
            "xhs-downloader rejected the request — set XHS_DOWNLOADER_TOKEN "
            "(see .env.example for how to generate it)"
        )
    resp.raise_for_status()
    data = resp.json().get("data") or {}
    if not data:
        # The sidecar occasionally returns `"data": null` (e.g. right after a post is published);
        # raise a non-ValueError so the Celery task retries instead of failing permanently.
        raise RuntimeError("xhs-downloader returned no data for this URL")

    # Assemble metadata
    title = data.get("作品标题", "")
    desc = data.get("作品描述", "")
    tags = data.get("作品标签", "")
    product_info = f"Title: {title}\nDescription: {desc}\nTags: {tags}".strip() if (title or desc or tags) else None

    urls = data.get("下载地址") or []
    cdn_url = next((u for u in urls if u), None)
    if not cdn_url:
        raise ValueError("xhs-downloader: download URL not found")

    with requests.get(cdn_url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(output_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=65536):
                f.write(chunk)

    return product_info


def download_with_ytdlp(url: str, output_path: str) -> str:
    """Download a video (TikTok, Instagram, etc.) with yt-dlp. Returns the actual file path."""
    output_dir = os.path.dirname(output_path)
    ydl_opts = {
        "outtmpl": os.path.join(output_dir, "%(id)s.%(ext)s"),
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "quiet": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        actual_path = ydl.prepare_filename(info)
    # rename to standard name
    if actual_path != output_path:
        os.rename(actual_path, output_path)
    return output_path


def update_job(job_id: str, **kwargs):
    with SyncSessionLocal() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
            db.commit()


@celery.task(bind=True, max_retries=3, retry_backoff=True)
def extract(self, job_id: str, source_urls) -> dict:
    # Backward compatibility: also accept a single string
    if isinstance(source_urls, str):
        source_urls = [source_urls]

    logger.info(f"[{job_id}] Starting download: {len(source_urls)} URLs")
    update_job(job_id, status="extracting")

    output_dir = os.path.join(settings.temp_dir, job_id)
    os.makedirs(output_dir, exist_ok=True)

    try:
        video_paths = []
        product_info = None

        for i, url in enumerate(source_urls):
            output_path = os.path.join(output_dir, f"original_{i}.mp4")
            if "xiaohongshu.com" in url or "xhslink.com" in url:
                if not settings.enable_xhs_import:
                    raise ValueError("Xiaohongshu import is disabled (ENABLE_XHS_IMPORT=false)")
                info = extract_xhs_video(url, output_path)
                if info and not product_info:
                    product_info = info
            else:
                download_with_ytdlp(url, output_path)
            video_paths.append(output_path)
            logger.info(f"[{job_id}] Download complete ({i+1}/{len(source_urls)}): {output_path}")

        # Also store the first video as the legacy video_path
        update_job(
            job_id,
            status="extracted",
            error_message=None,  # clear errors from earlier failed attempts
            video_path=video_paths[0] if video_paths else None,
            video_paths=video_paths,
        )
        result = {"job_id": job_id, "video_path": video_paths[0] if video_paths else None, "video_paths": video_paths}
        if product_info:
            result["product_info"] = product_info
        return result

    except ValueError as e:
        logger.error(f"[{job_id}] URL parsing failed: {e}")
        update_job(job_id, status="failed", error_message=str(e))
        return

    except requests.HTTPError as e:
        logger.warning(f"[{job_id}] HTTP error, retrying: {e}")
        update_job(job_id, error_message=str(e))
        raise self.retry(exc=e)

    except Exception as e:
        logger.error(f"[{job_id}] Download failed: {e}")
        update_job(job_id, status="failed", error_message=str(e))
        raise self.retry(exc=e)
