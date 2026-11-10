from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.job import Job
from api.auth import verify_session

router = APIRouter(prefix="/api", tags=["report"])


@router.get("/report")
async def get_report(db: AsyncSession = Depends(get_db), _: str = Depends(verify_session)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    month_start = today_start.replace(day=1)

    async def count_published(since: datetime) -> int:
        result = await db.execute(
            select(func.count()).where(
                Job.status == "published",
                Job.updated_at >= since,
            )
        )
        return result.scalar() or 0

    today_count = await count_published(today_start)
    week_count = await count_published(week_start)
    month_count = await count_published(month_start)

    # Counts by status
    status_result = await db.execute(
        select(Job.status, func.count(Job.id)).group_by(Job.status)
    )
    status_counts = {row[0]: row[1] for row in status_result.all()}

    # 10 most recently published reels
    recent_result = await db.execute(
        select(Job)
        .where(Job.status == "published")
        .order_by(Job.updated_at.desc())
        .limit(10)
    )
    recent_jobs = recent_result.scalars().all()

    return {
        "uploads": {
            "today": today_count,
            "this_week": week_count,
            "this_month": month_count,
        },
        "status_counts": status_counts,
        "recent_published": [
            {
                "id": str(j.id),
                "platform": j.platform,
                "instagram_post_id": j.instagram_post_id,
                "published_at": j.updated_at.isoformat() if j.updated_at else None,
            }
            for j in recent_jobs
        ],
    }
