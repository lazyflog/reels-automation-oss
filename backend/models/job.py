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
            "removing_watermarks",
            "watermarks_removed",
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

    source_urls = Column(JSON, nullable=True)      # URL 배열 ["url1", "url2"]
    video_path = Column(String, nullable=True)
    video_paths = Column(JSON, nullable=True)      # 다운로드된 경로 배열
    output_path = Column(String, nullable=True)
    audio_path = Column(String, nullable=True)
    title = Column(String, nullable=True)          # 검수 가능한 제목 필드
    script = Column(JSON, nullable=True)  # {"hook": "", "points": [], "cta": "", "disclaimer": ""}
    caption = Column(Text, nullable=True)
    analysis_result = Column(JSON, nullable=True)  # Gemini 분석 결과
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
    bgm_filename = Column(String, nullable=True)   # None이면 BGM 없음
    subtitle_font = Column(String, nullable=True)  # 폰트 절대경로, None → 기본 NanumGothicBold
    cover_font = Column(String, nullable=True)     # 표지 폰트 절대경로, None → 기본
    tts_speed = Column(Float, nullable=True)       # None → 1.1 기본값
    subtitle_position = Column(String, nullable=True)    # "top"/"upper"/"middle"/"lower"/"bottom"
    cover_font_size = Column(Integer, nullable=True)    # None → 72 기본값
    cover_title_color = Column(String, nullable=True)   # None → "white" 기본값 (윗줄 색)
    cover_title_color2 = Column(String, nullable=True)  # 아랫줄 색, None → 윗줄과 동일
    subtitle_shadow_color = Column(String, nullable=True)
    subtitle_shadow_offset = Column(Integer, nullable=True)
    subtitle_shadow_blur = Column(Integer, nullable=True)
    subtitle_stroke_color = Column(String, nullable=True)
    subtitle_stroke_width = Column(Integer, nullable=True)
    cover_title_position = Column(String, nullable=True)
    subtitle_font_size = Column(Integer, nullable=True)  # None → 64 기본값
    subtitle_italic = Column(Boolean, default=False)     # 자막 기울이기(합성 이탤릭)
    cover_italic = Column(Boolean, default=False)        # 표지 제목 기울이기
    cover_stroke_color = Column(String, nullable=True)   # 표지 제목 테두리 색상
    cover_stroke_width = Column(Integer, nullable=True)  # 표지 제목 테두리 두께(None → 0)
    eval_scores = Column(JSON, nullable=True)            # 품질 평가 결과 JSON

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
