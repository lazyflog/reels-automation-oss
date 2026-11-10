import asyncio
import os
import random
import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, model_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from celery import chain
from config import settings
from database import get_db
from models.job import Job, detect_platform
from api.auth import verify_session
from utils.font_registry import list_fonts, list_font_families, resolve_font
from workers.extract import extract
from workers.analyze import analyze
from workers.generate import generate
from workers.tts import tts, synthesize_tts, _apply_volume_to_audio
from workers.edit import preview_edit, final_edit
from workers.upload_instagram import upload_instagram
from workers.cleanup import cleanup_temp_dir

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
bgm_router = APIRouter(prefix="/api/bgm", tags=["bgm"])
font_router = APIRouter(prefix="/api/fonts", tags=["fonts"])
tts_router = APIRouter(prefix="/api/tts", tags=["tts"])


# ── Pydantic schemas ────────────────────────────────────────

class CreateJobRequest(BaseModel):
    # Provide either uploaded files (upload_ids from POST /api/jobs/uploads) or URLs.
    upload_ids: list[str] = []
    urls: list[str] = []
    persona: Optional[str] = None
    description: Optional[str] = None
    voice_id: Optional[str] = None
    subtitle_color: str = "white"
    subtitle_bg_color: Optional[str] = None
    bgm_filename: Optional[str] = None
    voice_volume: float = 1.0
    bgm_volume: float = 0.25
    subtitle_font: Optional[str] = None
    cover_font: Optional[str] = None
    tts_speed: float = 1.1   # ElevenLabs speed (0.7~1.5)
    subtitle_position: str = "bottom"
    subtitle_shadow_color: Optional[str] = None
    subtitle_shadow_offset: Optional[int] = None
    subtitle_shadow_blur: Optional[int] = None
    subtitle_stroke_color: Optional[str] = None
    subtitle_stroke_width: Optional[int] = None
    subtitle_font_size: Optional[int] = None
    subtitle_italic: bool = False

    @model_validator(mode="after")
    def validate_sources(self):
        self.urls = [u.strip() for u in self.urls if u and u.strip()]
        if bool(self.urls) == bool(self.upload_ids):
            raise ValueError("Provide either upload_ids or urls (not both)")
        if len(self.urls) > 10 or len(self.upload_ids) > 10:
            raise ValueError("At most 10 source videos per job")
        return self


class PatchJobRequest(BaseModel):
    script: Optional[dict] = None
    caption: Optional[str] = None
    title: Optional[str] = None
    # Subtitle style (edited in the job detail subtitle modal → applied on the next render)
    subtitle_color: Optional[str] = None
    subtitle_bg_color: Optional[str] = None
    subtitle_font: Optional[str] = None
    subtitle_font_size: Optional[int] = None
    subtitle_italic: Optional[bool] = None
    subtitle_position: Optional[str] = None
    subtitle_stroke_color: Optional[str] = None
    subtitle_stroke_width: Optional[int] = None
    subtitle_shadow_color: Optional[str] = None
    subtitle_shadow_offset: Optional[int] = None
    subtitle_shadow_blur: Optional[int] = None


class ApproveJobRequest(BaseModel):
    targets: list[str] = ["instagram"]


class CoverRequest(BaseModel):
    frame_time: float
    cover_title: Optional[str] = None
    cover_font: Optional[str] = None
    cover_font_size: Optional[int] = None
    cover_title_color: Optional[str] = None
    cover_title_color2: Optional[str] = None
    cover_title_position: Optional[str] = None
    cover_italic: Optional[bool] = None
    cover_stroke_color: Optional[str] = None
    cover_stroke_width: Optional[int] = None


# ── Helpers ────────────────────────────────────────────────

def job_to_dict(job: Job) -> dict:
    return {
        "id": str(job.id),
        "source_url": job.source_url,
        "source_urls": job.source_urls or ([job.source_url] if job.source_url else []),
        "platform": job.platform,
        "status": job.status,
        "title": job.title,
        "script": job.script,
        "caption": job.caption,
        "analysis_result": job.analysis_result,
        "output_path": job.output_path,
        "cover_image_path": job.cover_image_path,
        "cover_frame_time": job.cover_frame_time,
        "instagram_post_id": job.instagram_post_id,
        "upload_targets": job.upload_targets,
        "error_message": job.error_message,
        "retry_count": job.retry_count,
        "persona": job.persona,
        "description": job.description,
        "voice_id": job.voice_id,
        "voice_volume": float(job.voice_volume) if job.voice_volume else 1.0,
        "bgm_volume": float(job.bgm_volume) if job.bgm_volume else 0.25,
        "subtitle_color": job.subtitle_color,
        "subtitle_bg_color": job.subtitle_bg_color,
        "bgm_filename": job.bgm_filename,
        "subtitle_font": job.subtitle_font,
        "cover_font": job.cover_font,
        "tts_speed": job.tts_speed,
        "subtitle_position": job.subtitle_position,
        "cover_font_size": job.cover_font_size,
        "cover_title_color": job.cover_title_color,
        "cover_title_color2": job.cover_title_color2,
        "subtitle_shadow_color": job.subtitle_shadow_color,
        "subtitle_shadow_offset": job.subtitle_shadow_offset,
        "subtitle_shadow_blur": job.subtitle_shadow_blur,
        "subtitle_stroke_color": job.subtitle_stroke_color,
        "subtitle_stroke_width": job.subtitle_stroke_width,
        "cover_title_position": job.cover_title_position,
        "subtitle_font_size": job.subtitle_font_size,
        "subtitle_italic": job.subtitle_italic,
        "cover_italic": job.cover_italic,
        "cover_stroke_color": job.cover_stroke_color,
        "cover_stroke_width": job.cover_stroke_width,
        "eval_scores": job.eval_scores,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }


# ── Endpoints ──────────────────────────────────────────────

VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm"}
_UPLOAD_ID_RE = re.compile(r"^[0-9a-f]{32}\.(mp4|mov|m4v|webm)$")


def _uploads_dir() -> str:
    return os.path.join(settings.temp_dir, "uploads")


@router.post("/uploads", status_code=status.HTTP_201_CREATED)
async def upload_source_video(file: UploadFile = File(...), _: str = Depends(verify_session)):
    """Upload a source video (your own or licensed footage). Returns an upload_id
    to pass to POST /api/jobs."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in VIDEO_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported video format: {ext or '(none)'}")

    os.makedirs(_uploads_dir(), exist_ok=True)
    upload_id = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(_uploads_dir(), upload_id)
    limit = settings.max_upload_mb * 1024 * 1024
    written = 0
    try:
        with open(dest, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > limit:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large (max {settings.max_upload_mb} MB)",
                    )
                f.write(chunk)
    except HTTPException:
        os.remove(dest)
        raise
    return {"upload_id": upload_id, "filename": file.filename, "size": written}


def _start_pipeline(job_id: str, source_urls: list[str] | None, video_paths: list[str] | None):
    """Kick off the Celery pipeline — from extract (URLs) or from analyze (uploaded files).

    To add your own processing of the source videos (e.g. clean-up, enhancement), insert a
    Celery task between analyze and generate — see docs/EXTENDING.md.
    """
    steps = [analyze.s(), generate.s(), tts.s(), preview_edit.s()]
    if video_paths:
        first = analyze.s({"job_id": job_id, "video_paths": video_paths, "video_path": video_paths[0]})
        chain(first, *steps[1:]).apply_async()
    else:
        chain(extract.s(job_id, source_urls), *steps).apply_async()


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_job(body: CreateJobRequest, db: AsyncSession = Depends(get_db), _: str = Depends(verify_session)):
    job_uuid = uuid.uuid4()
    job_id = str(job_uuid)
    video_paths: list[str] = []

    if body.upload_ids:
        platform = "upload"
        job_dir = os.path.join(settings.temp_dir, job_id)
        os.makedirs(job_dir, exist_ok=True)
        for i, upload_id in enumerate(body.upload_ids):
            src = os.path.join(_uploads_dir(), upload_id)
            if not _UPLOAD_ID_RE.match(upload_id) or not os.path.isfile(src):
                raise HTTPException(status_code=400, detail=f"Unknown upload_id: {upload_id}")
            dest = os.path.join(job_dir, f"original_{i}{os.path.splitext(upload_id)[1]}")
            os.replace(src, dest)
            video_paths.append(dest)
        source_urls = [f"upload://{u}" for u in body.upload_ids]
    else:
        if not settings.enable_url_import:
            raise HTTPException(status_code=403, detail="URL import is disabled (ENABLE_URL_IMPORT=false)")
        try:
            platform = detect_platform(body.urls[0])
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        if platform == "xhs" and not settings.enable_xhs_import:
            raise HTTPException(status_code=403, detail="Xiaohongshu import is disabled (ENABLE_XHS_IMPORT=false)")
        source_urls = body.urls

    job = Job(
        id=job_uuid,
        source_url=source_urls[0],
        source_urls=source_urls,
        video_path=video_paths[0] if video_paths else None,
        video_paths=video_paths or None,
        platform=platform,
        persona=body.persona or None,
        description=body.description,
        voice_id=body.voice_id,
        subtitle_color=body.subtitle_color,
        subtitle_bg_color=body.subtitle_bg_color,
        bgm_filename=body.bgm_filename,
        voice_volume=str(body.voice_volume),
        bgm_volume=str(body.bgm_volume),
        subtitle_font=body.subtitle_font,
        cover_font=body.cover_font,
        tts_speed=body.tts_speed,
        subtitle_position=body.subtitle_position,
        subtitle_shadow_color=body.subtitle_shadow_color,
        subtitle_shadow_offset=body.subtitle_shadow_offset,
        subtitle_shadow_blur=body.subtitle_shadow_blur,
        subtitle_stroke_color=body.subtitle_stroke_color,
        subtitle_stroke_width=body.subtitle_stroke_width,
        subtitle_font_size=body.subtitle_font_size,
        subtitle_italic=body.subtitle_italic,
        status="extracted" if video_paths else "pending",
        upload_targets=["instagram"],
    )
    db.add(job)
    await db.commit()

    _start_pipeline(job_id, source_urls, video_paths)

    return {"job_id": job_id, "status": "pending", "platform": platform}


@router.get("")
async def list_jobs(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_session),
):
    query = select(Job)
    if status_filter:
        query = query.where(Job.status == status_filter)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(Job.created_at.desc()).offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    jobs = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "size": size,
        "items": [job_to_dict(j) for j in jobs],
    }


@router.get("/{job_id}")
async def get_job(job_id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_session)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job_to_dict(job)


@router.get("/{job_id}/download")
async def download_job(job_id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_session)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in ("awaiting_tts_review", "review_pending", "approved", "uploading", "published"):
        raise HTTPException(status_code=400, detail=f"Not ready yet: {job.status}")
    file_path = os.path.abspath(job.output_path) if job.output_path else None
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Output file not found: {job.output_path}")
    return FileResponse(
        file_path,
        media_type="video/mp4",
        filename=f"{job_id}.mp4",
    )


@router.patch("/{job_id}")
async def patch_job(job_id: str, body: PatchJobRequest, db: AsyncSession = Depends(get_db), _: str = Depends(verify_session)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if body.script is not None:
        job.script = body.script
    if body.caption is not None:
        job.caption = body.caption
    if body.title is not None:
        job.title = body.title

    # Subtitle style (an empty string means an explicit unset, e.g. "no background")
    if body.subtitle_color is not None:
        job.subtitle_color = body.subtitle_color
    if body.subtitle_bg_color is not None:
        job.subtitle_bg_color = body.subtitle_bg_color or None
    if body.subtitle_font is not None:
        job.subtitle_font = body.subtitle_font or None
    if body.subtitle_font_size is not None:
        job.subtitle_font_size = body.subtitle_font_size
    if body.subtitle_italic is not None:
        job.subtitle_italic = body.subtitle_italic
    if body.subtitle_position is not None:
        job.subtitle_position = body.subtitle_position
    if body.subtitle_stroke_color is not None:
        job.subtitle_stroke_color = body.subtitle_stroke_color or None
    if body.subtitle_stroke_width is not None:
        job.subtitle_stroke_width = body.subtitle_stroke_width
    if body.subtitle_shadow_color is not None:
        job.subtitle_shadow_color = body.subtitle_shadow_color or None
    if body.subtitle_shadow_offset is not None:
        job.subtitle_shadow_offset = body.subtitle_shadow_offset
    if body.subtitle_shadow_blur is not None:
        job.subtitle_shadow_blur = body.subtitle_shadow_blur

    await db.commit()
    await db.refresh(job)
    return job_to_dict(job)


@router.post("/{job_id}/approve")
async def approve_job(job_id: str, body: ApproveJobRequest, db: AsyncSession = Depends(get_db), _: str = Depends(verify_session)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != "review_pending":
        raise HTTPException(status_code=400, detail=f"Cannot approve in status: {job.status}")

    targets = body.targets
    job.upload_targets = targets
    job.status = "approved"
    await db.commit()

    # Optional delay between approval and upload (UPLOAD_DELAY_MIN/MAX_MINUTES, default 0)
    lo = max(0.0, settings.upload_delay_min_minutes)
    hi = max(lo, settings.upload_delay_max_minutes)
    delay = random.uniform(lo * 60, hi * 60) if hi > 0 else 0

    if "instagram" in targets:
        upload_instagram.apply_async(args=[job_id], countdown=delay)

    return {"job_id": job_id, "status": "approved", "targets": targets}


@router.post("/{job_id}/reject")
async def reject_job(job_id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_session)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = "rejected"
    await db.commit()
    return {"job_id": job_id, "status": "rejected"}


@router.post("/{job_id}/retry")
async def retry_job(job_id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_session)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status not in ("failed", "rejected"):
        raise HTTPException(status_code=400, detail=f"Cannot retry in status: {job.status}")

    source_urls = job.source_urls or [job.source_url]
    video_paths = None
    if job.platform == "upload":
        video_paths = [p for p in (job.video_paths or []) if p and os.path.exists(p)]
        if not video_paths:
            raise HTTPException(status_code=400, detail="Uploaded source files are no longer available")
    job.status = "pending"
    job.retry_count = (job.retry_count or 0) + 1
    job.error_message = None
    await db.commit()

    _start_pipeline(job_id, source_urls, video_paths)

    return {"job_id": job_id, "status": "pending"}


@router.get("/{job_id}/frames")
async def get_frames(job_id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_session)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Determine usable video paths
    video_path = None
    if job.video_paths and len(job.video_paths) > 0:
        video_path = job.video_paths[0]
    elif job.video_path:
        video_path = job.video_path

    if not video_path or not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video file not found")

    from utils.ffmpeg_helper import extract_frames, get_video_info
    output_dir = os.path.join(settings.temp_dir, job_id, "frames")
    count = 10

    # Get video duration → compute interval → random offset
    info = get_video_info(video_path)
    duration = float(info.get("format", {}).get("duration", 0))
    if duration <= 0:
        for stream in info.get("streams", []):
            if stream.get("codec_type") == "video":
                duration = float(stream.get("duration", 0))
                break
    if duration <= 0:
        duration = 30.0
    interval = max(1.0, (duration - 1.0) / count)
    jitter = random.uniform(0.0, interval * 0.5)

    frame_paths = extract_frames(video_path, output_dir, count=count, start_offset=jitter)

    frame_urls = [
        f"/api/jobs/{job_id}/frames/{os.path.basename(fp)}"
        for fp in frame_paths
    ]

    frame_times = [round(0.5 + jitter + i * interval, 2) for i in range(len(frame_paths))]

    return {"frames": frame_urls, "video_path": video_path, "frame_times": frame_times}


@router.get("/{job_id}/frames/{filename}")
async def get_frame_image(job_id: str, filename: str, _: str = Depends(verify_session)):
    frame_path = os.path.abspath(
        os.path.join(settings.temp_dir, job_id, "frames", filename)
    )
    # Prevent path traversal
    base = os.path.abspath(settings.temp_dir)
    if not frame_path.startswith(base):
        raise HTTPException(status_code=400, detail="Invalid path")
    if not os.path.exists(frame_path):
        raise HTTPException(status_code=404, detail="Frame not found")
    return FileResponse(frame_path, media_type="image/jpeg")


@router.post("/{job_id}/cover")
async def set_cover(job_id: str, body: CoverRequest, db: AsyncSession = Depends(get_db), _: str = Depends(verify_session)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.cover_frame_time = str(body.frame_time)
    if body.cover_title:
        job.title = body.cover_title
    if body.cover_font:
        job.cover_font = body.cover_font
    if body.cover_font_size:
        job.cover_font_size = body.cover_font_size
    if body.cover_title_color:
        job.cover_title_color = body.cover_title_color
    if body.cover_title_color2 is not None:
        job.cover_title_color2 = body.cover_title_color2 or None  # empty string → unset (single color)
    if body.cover_title_position:
        job.cover_title_position = body.cover_title_position
    if body.cover_italic is not None:
        job.cover_italic = body.cover_italic
    if body.cover_stroke_color is not None:
        job.cover_stroke_color = body.cover_stroke_color
    if body.cover_stroke_width is not None:
        job.cover_stroke_width = body.cover_stroke_width

    await db.commit()
    await db.refresh(job)

    if job.status == "review_pending":
        job.status = "editing"
        await db.commit()
        final_edit.apply_async(args=[job_id])
        return {"job_id": job_id, "status": "editing"}

    return job_to_dict(job)


@router.post("/{job_id}/preview-cover")
async def preview_cover(job_id: str, body: CoverRequest, db: AsyncSession = Depends(get_db), _: str = Depends(verify_session)):
    """Composite a cover image from the given title/options and return it as JPEG (DB unchanged).
    Synchronous preview for checking and tweaking the result after picking a frame."""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    video_path = None
    if job.video_paths and len(job.video_paths) > 0:
        video_path = job.video_paths[0]
    elif job.video_path:
        video_path = job.video_path
    if not video_path or not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video file not found")

    from workers.edit import _generate_cover
    title = (body.cover_title if body.cover_title is not None else job.title) or ""
    # Prefer the font from the request; otherwise use the saved cover font
    font_path = resolve_font(body.cover_font or job.cover_font)

    loop = asyncio.get_event_loop()
    try:
        out = await loop.run_in_executor(
            None,
            lambda: _generate_cover(
                video_path, job_id, body.frame_time, title, font_path,
                font_size=body.cover_font_size or 72,
                text_color=body.cover_title_color or "white",
                title_position=body.cover_title_position or "middle",
                italic=bool(body.cover_italic),
                stroke_color=body.cover_stroke_color,
                stroke_width=body.cover_stroke_width or 0,
                text_color2=body.cover_title_color2 or None,
                output_name="cover_preview.jpg",
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cover preview generation failed: {e}")

    # Prevent browser caching (same path is reused)
    return FileResponse(out, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@router.post("/{job_id}/approve_tts_review")
async def approve_tts_review(job_id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_session)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != "awaiting_tts_review":
        raise HTTPException(status_code=400, detail=f"Cannot review TTS in status: {job.status}")

    await db.commit()

    final_edit.apply_async(args=[job_id])
    return {"job_id": job_id, "status": "editing"}


@router.post("/{job_id}/regenerate_tts")
async def regenerate_tts(job_id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_session)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != "awaiting_tts_review":
        raise HTTPException(status_code=400, detail=f"Cannot regenerate TTS in status: {job.status}")

    video_paths = job.video_paths or ([job.video_path] if job.video_path else [])
    job.status = "tts_processing"
    job.error_message = None
    await db.commit()

    chain(
        tts.s({"job_id": job_id, "video_paths": video_paths, "video_path": video_paths[0] if video_paths else None}),
        preview_edit.s(),
    ).apply_async()

    return {"job_id": job_id, "status": "tts_processing"}


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: str, db: AsyncSession = Depends(get_db), _: str = Depends(verify_session)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Clean up temp files
    cleanup_temp_dir.delay(job_id)

    await db.delete(job)
    await db.commit()


# ── Font list ──────────────────────────────────────────────

@font_router.get("")
async def get_fonts(_: str = Depends(verify_session)):
    return {"items": list_fonts(), "families": list_font_families()}


@font_router.get("/file")
async def serve_font_file(path: str, _: str = Depends(verify_session)):
    resolved = resolve_font(path)
    if resolved != path:
        raise HTTPException(status_code=404, detail="Font not found")
    return FileResponse(resolved, media_type="font/ttf",
                        headers={"Cache-Control": "public, max-age=86400"})


# ── BGM list & upload ─────────────────────────────────────

BGM_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".ogg"}


@bgm_router.get("")
async def list_bgm(_: str = Depends(verify_session)):
    bgm_dir = os.path.abspath(settings.bgm_dir)
    if not os.path.isdir(bgm_dir):
        return {"items": []}

    items = [
        f for f in os.listdir(bgm_dir)
        if os.path.splitext(f)[1].lower() in BGM_EXTENSIONS
    ]
    items.sort()
    return {"items": items}


class BgmDownloadRequest(BaseModel):
    url: str


@bgm_router.post("/download", status_code=status.HTTP_201_CREATED)
async def download_bgm_from_url(body: BgmDownloadRequest, _=Depends(verify_session)):
    """Download audio from a URL with yt-dlp into bgm/.

    Disabled unless ENABLE_BGM_URL_DOWNLOAD=true. Only download audio you have the
    right to use — see docs/LEGAL.md.
    """
    if not settings.enable_bgm_url_download:
        raise HTTPException(
            status_code=403,
            detail="BGM download from URL is disabled (set ENABLE_BGM_URL_DOWNLOAD=true to enable).",
        )
    import yt_dlp
    bgm_dir = os.path.abspath(settings.bgm_dir)
    os.makedirs(bgm_dir, exist_ok=True)
    filename = f"bgm_{uuid.uuid4().hex[:8]}.mp3"
    out_tmpl = os.path.join(bgm_dir, filename.replace(".mp3", ""))
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": out_tmpl,
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3"}],
        "quiet": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([body.url])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Download failed: {e}")
    # yt-dlp appends the extension, so resolve the final file name
    final_path = out_tmpl + ".mp3"
    if not os.path.exists(final_path):
        raise HTTPException(status_code=500, detail="Downloaded file not found")
    return {"filename": filename}


@bgm_router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_bgm(file: UploadFile = File(...), _: str = Depends(verify_session)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in BGM_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}")

    bgm_dir = os.path.abspath(settings.bgm_dir)
    os.makedirs(bgm_dir, exist_ok=True)

    # Sanitize the file name
    safe_name = os.path.basename(file.filename or "upload").replace(" ", "_")
    dest = os.path.join(bgm_dir, safe_name)

    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    return {"filename": safe_name}


@bgm_router.get("/{filename}/stream")
async def stream_bgm(filename: str, _=Depends(verify_session)):
    bgm_dir = os.path.abspath(settings.bgm_dir)
    safe_name = os.path.basename(filename)
    path = os.path.join(bgm_dir, safe_name)
    if not path.startswith(bgm_dir) or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="BGM file not found")
    return FileResponse(path, media_type="audio/mpeg")


# ── TTS voice preview ──────────────────────────────────────────

PREVIEW_TEXT = "This is a voice preview. How does it sound?"


class TtsPreviewRequest(BaseModel):
    voice_id: str
    speed: float = 1.1
    voice_volume: float = 1.0


@tts_router.post("/preview")
async def tts_preview(body: TtsPreviewRequest, _=Depends(verify_session)):
    cache_dir = os.path.join(settings.temp_dir, "tts_preview")
    os.makedirs(cache_dir, exist_ok=True)
    # Cache separately per speed/volume combo (volume is applied by ffmpeg post-processing after synthesis)
    cache_key = f"{body.voice_id}_{body.speed:.2f}_v{body.voice_volume:.2f}"
    cache_path = os.path.join(cache_dir, f"{cache_key}.mp3")

    if not os.path.exists(cache_path):
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None, synthesize_tts, PREVIEW_TEXT, cache_path, body.voice_id, body.speed
        )
        # ElevenLabs has no volume parameter, so apply it in post-processing after synthesis
        if abs(body.voice_volume - 1.0) > 1e-3:
            await loop.run_in_executor(
                None, _apply_volume_to_audio, cache_path, body.voice_volume
            )

    return FileResponse(cache_path, media_type="audio/mpeg")
