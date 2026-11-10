import os
import shutil
import logging
from datetime import datetime, timedelta

from workers.celery_app import celery
from database import SyncSessionLocal
from models.job import Job
from config import settings

logger = logging.getLogger(__name__)


@celery.task
def cleanup_temp_dir(job_id: str) -> None:
    """업로드 완료 후 temp/{job_id}/ 삭제"""
    temp_job_dir = os.path.join(settings.temp_dir, job_id)
    if os.path.exists(temp_job_dir):
        shutil.rmtree(temp_job_dir)
        logger.info(f"[{job_id}] temp 디렉토리 삭제 완료")


@celery.task
def cleanup_old_outputs() -> None:
    """output 파일 7일 후 삭제 (Celery beat 스케줄)"""
    cutoff = datetime.utcnow() - timedelta(days=7)
    output_dir = settings.output_dir

    if not os.path.exists(output_dir):
        return

    deleted = 0
    for filename in os.listdir(output_dir):
        filepath = os.path.join(output_dir, filename)
        if os.path.isfile(filepath):
            mtime = datetime.utcfromtimestamp(os.path.getmtime(filepath))
            if mtime < cutoff:
                os.remove(filepath)
                deleted += 1

    logger.info(f"cleanup_old_outputs: {deleted}개 파일 삭제")

    # Source uploads that were never attached to a job (older than 1 day)
    uploads_dir = os.path.join(settings.temp_dir, "uploads")
    if os.path.isdir(uploads_dir):
        upload_cutoff = datetime.utcnow() - timedelta(days=1)
        removed = 0
        for filename in os.listdir(uploads_dir):
            filepath = os.path.join(uploads_dir, filename)
            if os.path.isfile(filepath) and datetime.utcfromtimestamp(os.path.getmtime(filepath)) < upload_cutoff:
                os.remove(filepath)
                removed += 1
        logger.info(f"cleanup_old_outputs: removed {removed} orphaned upload(s)")
