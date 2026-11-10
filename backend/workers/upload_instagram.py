import logging
from datetime import date, datetime

import requests

from workers.celery_app import celery
from database import SyncSessionLocal
from models.job import Job
from utils.instagram_helper import create_reels_container, wait_for_encoding, publish_reels
from config import settings

logger = logging.getLogger(__name__)

DAILY_UPLOAD_LIMIT = 30


def get_today_upload_count() -> int:
    today = date.today()
    with SyncSessionLocal() as db:
        count = (
            db.query(Job)
            .filter(
                Job.instagram_post_id.isnot(None),
                Job.updated_at >= datetime(today.year, today.month, today.day),
            )
            .count()
        )
    return count


def update_job(job_id: str, **kwargs):
    with SyncSessionLocal() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
            db.commit()


@celery.task(bind=True, max_retries=3, retry_backoff=True)
def upload_instagram(self, job_id: str) -> dict:
    logger.info(f"[{job_id}] Starting Instagram upload")

    try:
        with SyncSessionLocal() as db:
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                raise ValueError(f"Job not found: {job_id}")
            output_path = job.output_path
            caption = job.caption or ""

        if not output_path:
            raise ValueError("output_path is missing")

        # Build the public URL
        import os
        filename = os.path.basename(output_path)
        video_url = f"{settings.public_base_url}/output/{filename}"

        update_job(job_id, status="uploading")

        # 1. Create the container
        container_id = create_reels_container(video_url, caption)
        logger.info(f"[{job_id}] Container created: {container_id}")

        # 2. Wait for encoding to finish
        wait_for_encoding(container_id)
        logger.info(f"[{job_id}] Encoding complete")

        # 3. Publish
        post_id = publish_reels(container_id)
        logger.info(f"[{job_id}] Published to Instagram: {post_id}")

        update_job(job_id, instagram_post_id=post_id, status="published")
        return {"job_id": job_id, "instagram_post_id": post_id}

    except requests.HTTPError as e:
        if e.response.status_code == 429:
            logger.warning(f"[{job_id}] Rate limited, retrying in 1 hour")
            raise self.retry(exc=e, countdown=3600)
        logger.error(f"[{job_id}] HTTP error: {e}")
        update_job(job_id, status="failed", error_message=str(e))
        raise self.retry(exc=e)

    except Exception as e:
        logger.error(f"[{job_id}] Instagram upload failed: {e}")
        update_job(job_id, status="failed", error_message=str(e))
        raise self.retry(exc=e)
