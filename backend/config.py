from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@postgres:5432/reels"
    sync_database_url: str = "postgresql+psycopg2://postgres:password@postgres:5432/reels"
    redis_url: str = "redis://redis:6379/0"

    # Content generation
    # Language the narration script / caption / title are written in (any language name GPT understands).
    content_language: str = "English"
    # Optional audience description injected into the script prompt (e.g. "women in their 30s").
    target_audience: str = ""
    # Optional text appended to every Instagram caption (e.g. an affiliate / sponsorship disclosure).
    caption_disclosure: str = ""

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-5.2"

    # ElevenLabs
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "tnSpp4vdxKPjI9w0GnoV"  # fallback when a job has no voice

    # Naver CLOVA Voice — OFF by default. CLOVA Voice's usage policy does not allow
    # saving/editing generated audio files, which this pipeline does (docs/LEGAL.md).
    enable_clova_voice: bool = False
    clova_client_id: str = ""
    clova_client_secret: str = ""
    tts_provider: str = "elevenlabs"

    # Instagram (Instagram Login flow — no Facebook Page required)
    instagram_access_token: str = ""       # Long-lived IG user token (60 days)
    instagram_account_id: str = ""         # IG user ID (= /me?fields=user_id)
    instagram_app_secret: str = ""         # Instagram app secret (for long-lived token exchange/refresh)
    instagram_graph_base: str = "https://graph.instagram.com"
    instagram_api_version: str = "v23.0"
    public_base_url: str = "https://your-domain.com"

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3-flash-preview"

    # Download BGM from a URL with yt-dlp — OFF by default (see docs/LEGAL.md).
    enable_bgm_url_download: bool = False

    # Video import from URLs (yt-dlp: TikTok, Instagram, …). Only import videos you own or
    # are licensed to use. Set to false to allow local file uploads only.
    enable_url_import: bool = True
    # Xiaohongshu import via the optional xhs-downloader sidecar — OFF by default
    # (docker compose --profile xhs). See docs/LEGAL.md before enabling.
    enable_xhs_import: bool = False
    xhs_downloader_url: str = "http://xhs-downloader:5556"
    # Bearer token required by XHS-Downloader >= 2.9 (see .env.example for how to generate it)
    xhs_downloader_token: str = ""

    # Max size of a single uploaded source video (MB)
    max_upload_mb: int = 500

    # Delay (minutes) between approval and upload. 0 = upload immediately.
    upload_delay_min_minutes: float = 0
    upload_delay_max_minutes: float = 0

    # Auth
    session_ttl_seconds: int = 86400

    # Timezone used by Celery beat schedules
    timezone: str = "UTC"

    # File paths
    temp_dir: str = "./temp"
    output_dir: str = "./output"
    bgm_dir: str = "./bgm"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
