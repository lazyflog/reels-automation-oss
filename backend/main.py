import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.auth import router as auth_router
from api.jobs import router as jobs_router, bgm_router, font_router, tts_router
from api.library import router as library_router
from api.personas import router as personas_router
from api.report import router as report_router
from api.voices import router as voices_router
from config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.temp_dir, exist_ok=True)
    os.makedirs(settings.output_dir, exist_ok=True)
    _warn_optional_features()
    yield


def _warn_optional_features() -> None:
    """Log a prominent warning for opt-in features with legal/ToS implications."""
    log = logging.getLogger("reels")
    if settings.enable_xhs_import:
        log.warning("ENABLE_XHS_IMPORT=true — Xiaohongshu's terms prohibit scraping/downloading (docs/LEGAL.md).")
    if settings.enable_bgm_url_download:
        log.warning("ENABLE_BGM_URL_DOWNLOAD=true — most platforms prohibit downloading audio (docs/LEGAL.md).")
    if settings.enable_clova_voice:
        log.warning("ENABLE_CLOVA_VOICE=true — check NAVER CLOVA Voice's usage policy (docs/LEGAL.md).")

# Create directories before mounting static files
os.makedirs(settings.output_dir, exist_ok=True)
os.makedirs(settings.temp_dir, exist_ok=True)


app = FastAPI(
    title="Reels Automation API",
    description="Product footage → AI script / TTS → video editing → Instagram Reels",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
app.mount("/output", StaticFiles(directory=settings.output_dir), name="output")
app.mount("/temp", StaticFiles(directory=settings.temp_dir), name="temp")

app.include_router(auth_router)
app.include_router(jobs_router)
app.include_router(bgm_router)
app.include_router(font_router)
app.include_router(tts_router)
app.include_router(library_router)
app.include_router(personas_router)
app.include_router(voices_router)
app.include_router(report_router)


@app.get("/api/features")
async def features():
    """Feature flags the dashboard uses to show/hide optional functionality."""
    return {
        "bgm_url_download": settings.enable_bgm_url_download,
        "url_import": settings.enable_url_import,
        "xhs_import": settings.enable_xhs_import,
        "max_upload_mb": settings.max_upload_mb,
        "content_language": settings.content_language,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
