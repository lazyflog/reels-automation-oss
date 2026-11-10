import uuid
from datetime import datetime
from sqlalchemy import Column, Float, String, Text, Integer, Boolean, DateTime, Enum as SAEnum, JSON
from sqlalchemy.dialects.postgresql import UUID

from database import Base


def detect_platform(url: str) -> str:
    """Map a source URL to a platform key. Any other http(s) URL is handled by yt-dlp."""
    if "tiktok.com" in url or "vm.tiktok.com" in url:
        return "tiktok"
    elif "instagram.com" in url:
        return "instagram"
    elif "xiaohongshu.com" in url or "xhslink.com" in url:
        return "xhs"
    elif url.startswith(("http://", "https://")):
        return "url"
    else:
        raise ValueError(f"Unsupported URL: {url}")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_url = Column(String, nullable=False)
    platform = Column(SAEnum("upload", "url", "tiktok", "instagram", "xhs", name="platform_enum"))

    status = Column(
        SAEnum(
            "pending",
            "extracting",
            "extracted",
            "analyzing",
            "analyzed",
            "awaiting_cover",
            "generating",
            "generated",
            "tts_processing",
            "tts_done",
            "awaiting_tts_review",
            "editing",
            "review_pending",
            "approved",
            "rejected",
            "uploading",
            "published",
            "failed",
            name="status_enum",
        ),
        default="pending",
    )

    source_urls = Column(JSON, nullable=True)      # array of URLs ["url1", "url2"]
    video_path = Column(String, nullable=True)
    video_paths = Column(JSON, nullable=True)      # array of downloaded paths
    output_path = Column(String, nullable=True)
    audio_path = Column(String, nullable=True)
    title = Column(String, nullable=True)          # title field editable during review
    script = Column(JSON, nullable=True)  # {"hook": "", "points": [], "cta": "", "disclaimer": ""}
    caption = Column(Text, nullable=True)
    analysis_result = Column(JSON, nullable=True)  # Gemini analysis result
    cover_frame_time = Column(String, nullable=True)  # Float stored as string for compatibility
    cover_image_path = Column(String, nullable=True)
    voice_volume = Column(String, nullable=True, default="1.0")
    bgm_volume = Column(String, nullable=True, default="0.25")
    instagram_post_id = Column(String, nullable=True)
    upload_targets = Column(JSON, default=lambda: ["instagram"])
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    persona = Column(String, nullable=True)  # None → no persona (neutral narrator)
    description = Column(Text, nullable=True)
    voice_id = Column(String, nullable=True)
    subtitle_color = Column(String, default="white")
    subtitle_bg_color = Column(String, nullable=True)
    bgm_filename = Column(String, nullable=True)   # None means no BGM
    subtitle_font = Column(String, nullable=True)  # absolute font path, None → default NanumGothicBold
    cover_font = Column(String, nullable=True)     # absolute cover font path, None → default
    tts_speed = Column(Float, nullable=True)       # None → default 1.1
    subtitle_position = Column(String, nullable=True)    # "top"/"upper"/"middle"/"lower"/"bottom"
    cover_font_size = Column(Integer, nullable=True)    # None → default 72
    cover_title_color = Column(String, nullable=True)   # None → default "white" (top line color)
    cover_title_color2 = Column(String, nullable=True)  # bottom line color, None → same as top line
    subtitle_shadow_color = Column(String, nullable=True)
    subtitle_shadow_offset = Column(Integer, nullable=True)
    subtitle_shadow_blur = Column(Integer, nullable=True)
    subtitle_stroke_color = Column(String, nullable=True)
    subtitle_stroke_width = Column(Integer, nullable=True)
    cover_title_position = Column(String, nullable=True)
    subtitle_font_size = Column(Integer, nullable=True)  # None → default 64
    subtitle_italic = Column(Boolean, default=False)     # slant subtitles (synthetic italic)
    cover_italic = Column(Boolean, default=False)        # slant cover title
    cover_stroke_color = Column(String, nullable=True)   # cover title stroke color
    cover_stroke_width = Column(Integer, nullable=True)  # cover title stroke width (None → 0)
    eval_scores = Column(JSON, nullable=True)            # quality evaluation results JSON

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
