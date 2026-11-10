from celery import Celery
from celery.schedules import crontab

from config import settings

celery = Celery(
    "reels_automation",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "workers.extract",
        "workers.analyze",
        "workers.remove_watermark",
        "workers.generate",
        "workers.tts",
        "workers.edit",
        "workers.upload_instagram",
        "workers.cleanup",
    ],
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone=settings.timezone,
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
)

celery.conf.beat_schedule = {
    "cleanup-old-outputs": {
        "task": "workers.cleanup.cleanup_old_outputs",
        "schedule": crontab(hour=3, minute=0),  # every day at 03:00
    },
}
