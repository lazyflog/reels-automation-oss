import json
import os
import re
import logging

import numpy as np
from moviepy import VideoFileClip, AudioFileClip, ImageClip, AudioClip, TextClip, CompositeVideoClip, CompositeAudioClip, concatenate_audioclips, concatenate_videoclips, vfx

from workers.celery_app import celery
from database import SyncSessionLocal
from models.job import Job
from config import settings
from utils.font_registry import DEFAULT_FONT, resolve_font

logger = logging.getLogger(__name__)

COVER_TITLE_POSITIONS = {
    "top": 200, "upper": 500, "middle": 810, "lower": 1200, "bottom": 1550,
}

# Korean negation adverbs ("not" / "cannot") that read awkwardly when left alone on a line —
# merged with the following word when wrapping subtitles
_NEG_PREFIX_WORDS = {"안", "못"}

def _parse_subtitle_position(pos_str: str) -> float:
    """Convert a subtitle position string → float. 10 levels (1-10) + legacy compatibility."""
    legacy = {"top": 0.05, "upper": 0.25, "middle": 0.45, "lower": 0.65, "bottom": 0.85}
    if pos_str in legacy:
        return legacy[pos_str]
    try:
        step = int(pos_str)
        step = max(1, min(10, step))
        return 0.05 + (step - 1) * 0.1
    except (ValueError, TypeError):
        return 0.85


def _apply_blur(img_array, blur_radius):
    from PIL import Image, ImageFilter
    pil_img = Image.fromarray(img_array)
    blurred = pil_img.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    return np.array(blurred)


def _apply_italic(img_array, shear: float = 0.22):
    """Synthetic italic effect via a shear around the vertical center. Keeps the canvas size.
    Korean fonts have no italic variants, so the same shear is applied to RGB and mask frames.
    (Called via image_transform(apply_to=["mask"]), so it handles both RGB (3-channel) and mask (2D).)
    """
    from PIL import Image
    is_mask = img_array.ndim == 2
    h = img_array.shape[0]
    w = img_array.shape[1]
    if is_mask:
        pil = Image.fromarray((np.clip(img_array, 0, 1) * 255).astype("uint8"), mode="L")
    else:
        pil = Image.fromarray(img_array.astype("uint8"))
    # output(X,Y) <- input(X + shear*(Y - h/2), Y): top shifts right, bottom shifts left
    c = shear * (h / 2.0)
    pil = pil.transform(
        (w, h), Image.AFFINE, (1, shear, -c, 0, 1, 0), resample=Image.BICUBIC
    )
    out = np.array(pil)
    if is_mask:
        return out.astype("float64") / 255.0
    return out


def to_reels_format(clip):
    """9:16 (1080x1920) crop/resize"""
    target_w, target_h = 1080, 1920
    target_ratio = target_w / target_h
    clip_ratio = clip.w / clip.h

    if clip_ratio > target_ratio:
        new_w = int(clip.h * target_ratio)
        x_center = clip.w // 2
        clip = clip.cropped(x1=x_center - new_w // 2, x2=x_center + new_w // 2)
    elif clip_ratio < target_ratio:
        new_h = int(clip.w / target_ratio)
        y_center = clip.h // 2
        clip = clip.cropped(y1=y_center - new_h // 2, y2=y_center + new_h // 2)

    return clip.resized((target_w, target_h))


def _strip_emoji(text: str) -> str:
    return re.sub(
        "[\U00010000-\U0010FFFF\u2600-\u26FF\u2700-\u27BF]+",
        "", text
    ).strip()


def _split_into_chunks(text: str, max_lines: int = 3, chars_per_line: int = 15) -> list:
    """Split text into chunks of at most max_lines lines"""
    # Prefer splitting on punctuation
    sentences = re.split(r'(?<=[.!?。！？,，])\s*', text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]

    chunks = []
    current = []
    current_len = 0

    for sent in sentences:
        lines_needed = (len(sent) + chars_per_line - 1) // chars_per_line
        if current_len + lines_needed > max_lines and current:
            chunks.append(" ".join(current))
            current = [sent]
            current_len = lines_needed
        else:
            current.append(sent)
            current_len += lines_needed

    if current:
        chunks.append(" ".join(current))

    return chunks if chunks else [text]


def _get_segment_times_from_alignment(segments: list, alignment: dict, total_duration: float):
    """Return (start, end) for each segment using ElevenLabs character-level alignment. None on failure."""
    chars = alignment.get("characters", [])
    starts = alignment.get("character_start_times_seconds", [])
    ends = alignment.get("character_end_times_seconds", [])
    if not chars or len(starts) != len(chars) or len(ends) != len(chars):
        return None

    full_text = "".join(chars)
    result = []
    search_pos = 0

    for seg in segments:
        seg_clean = seg.strip()
        idx = full_text.find(seg_clean, search_pos)
        if idx == -1:
            return None  # match failed → fall back to character-proportional timing

        end_idx = idx + len(seg_clean) - 1
        if end_idx >= len(ends):
            return None

        t_start = starts[idx]
        t_end = ends[end_idx]
        result.append((t_start, min(t_end, total_duration)))
        search_pos = idx + len(seg_clean)

    return result


def make_subtitle_clips(
    script: dict,
    duration: float,
    subtitle_color: str = "white",
    subtitle_bg_color: str = None,
    subtitle_position: float = 0.05,
    max_lines: int = 1,
    subtitle_font: str = None,
    video_w: int = 1080,
    shadow_color: str = None,
    shadow_offset: int = 2,
    shadow_blur: int = 0,
    stroke_color: str = "black",
    stroke_width: int = 2,
    font_size_base: int = 64,
    italic: bool = False,
    alignment: dict = None,
) -> list:
    """Create subtitle clips per script unit (hook → points → cta). Shown one line at a time."""
    # Scale font and text box proportionally to the video width
    scale = video_w / 1080
    font_size = max(18, int(font_size_base * scale))
    text_w = int(960 * scale)
    # Max number of characters that fit on one visual line
    # Hangul glyph width ≈ font size, so text_w/font_size is the character capacity (0.95 margin for the stroke)
    visual_limit = max(8, int(text_w / font_size * 0.95))

    def _hard_split(text: str) -> list:
        """Balanced word-level split → keeps meaning intact within the one-visual-line limit.
        Decides the line count first and distributes words evenly; negation adverbs
        (_NEG_PREFIX_WORDS) are joined with the following word."""
        text = text.strip()
        if len(text) <= visual_limit:
            return [text] if text else []

        words = text.split()
        # A lone negation adverb (_NEG_PREFIX_WORDS) reads awkwardly when split from its verb, so merge them
        merged = []
        i = 0
        while i < len(words):
            if words[i] in _NEG_PREFIX_WORDS and i + 1 < len(words):
                merged.append(words[i] + " " + words[i + 1])
                i += 2
            else:
                merged.append(words[i])
                i += 1
        words = merged

        # Decide the line count first (ceil), then distribute words evenly toward the target line length
        n_lines = max(1, (len(text) + visual_limit - 1) // visual_limit)
        target = len(text) / n_lines
        lines, cur = [], ""
        for w in words:
            if not cur:
                cur = w
            elif len(cur) + 1 + len(w) <= visual_limit and (
                len(cur) + len(w) / 2 <= target or len(lines) == n_lines - 1
            ):
                cur += " " + w
            else:
                lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)

        # If a single word far exceeds the limit (long word), fall back to splitting by character count
        result = []
        for ln in lines:
            while len(ln) > visual_limit + 2:
                result.append(ln[:visual_limit].strip())
                ln = ln[visual_limit:].strip()
            if ln:
                result.append(ln)
        return result

    raw_segments = []
    if script.get("full_text"):
        for line in script["full_text"].split("\n"):
            if line.strip():
                raw_segments.extend(_split_into_chunks(_strip_emoji(line.strip()), max_lines))
    else:
        if script.get("hook"):
            raw_segments.extend(_split_into_chunks(_strip_emoji(script["hook"]), max_lines))
        for point in script.get("points", []):
            if point:
                raw_segments.extend(_split_into_chunks(_strip_emoji(point), max_lines))
        if script.get("cta"):
            raw_segments.extend(_split_into_chunks(_strip_emoji(script["cta"]), max_lines))

    # Re-split each segment to fit within one visual line
    segments = []
    for seg in raw_segments:
        segments.extend(_hard_split(seg))

    if not segments:
        return []

    # Try alignment-based timing; fall back to character-proportional timing on failure
    segment_times = None
    if alignment:
        segment_times = _get_segment_times_from_alignment(segments, alignment, duration)
        if segment_times is None:
            logger.warning("Alignment segment matching failed, falling back to character-proportional timing")

    if segment_times is None:
        lengths = [len(s) for s in segments]
        total_len = sum(lengths) or 1
        current_time = 0.0
        segment_times = []
        for seg_len in lengths:
            seg_duration = (seg_len / total_len) * duration
            end_time = min(current_time + seg_duration, duration)
            segment_times.append((current_time, end_time))
            current_time = end_time

    clips = []

    # Prevent bottom clipping: reserve pixels for stroke overflow + descenders
    sw = stroke_width or 0
    sub_height = int(font_size * 1.3) + sw * 2

    txt_kwargs = dict(
        font_size=font_size,
        color=subtitle_color,
        font=subtitle_font or DEFAULT_FONT,
        method="caption",
        size=(text_w, sub_height),
    )
    if sw > 0:
        txt_kwargs["stroke_color"] = stroke_color or "black"
        txt_kwargs["stroke_width"] = sw
    if subtitle_bg_color:
        txt_kwargs["bg_color"] = subtitle_bg_color

    shadow_kwargs = dict(
        font_size=font_size,
        color=shadow_color or "black",
        font=subtitle_font or DEFAULT_FONT,
        method="caption",
        size=(text_w, sub_height),
    ) if shadow_color else None

    for segment, (current_time, end_time) in zip(segments, segment_times):
        main_clip = TextClip(text=segment, **txt_kwargs)
        if italic:
            main_clip = main_clip.image_transform(_apply_italic, apply_to=["mask"])
        main_txt = (
            main_clip
            .with_position(("center", subtitle_position), relative=True)
            .with_start(current_time)
            .with_end(end_time)
        )

        if shadow_color and shadow_kwargs:
            shadow_txt = TextClip(text=segment, **shadow_kwargs)
            if italic:
                shadow_txt = shadow_txt.image_transform(_apply_italic, apply_to=["mask"])
            if shadow_blur > 0:
                shadow_txt = shadow_txt.image_transform(
                    lambda img, br=shadow_blur: _apply_blur(img, br)
                )
            video_h = int(video_w * 1920 / 1080)
            rel_offset = shadow_offset / video_h
            shadow_pos_y = subtitle_position + rel_offset
            shadow_txt = (
                shadow_txt
                .with_position(("center", shadow_pos_y), relative=True)
                .with_start(current_time)
                .with_end(end_time)
            )
            clips.append(shadow_txt)

        clips.append(main_txt)

    return clips


def _wrap_cover_title(title, draw, font, max_w, max_lines=2):
    """Respect explicit line breaks (\\n) first, then re-wrap each line by words (spaces) to fit the width. At most max_lines lines.
    Lets the user split the top/bottom lines with Enter (tied to per-line colors)."""
    lines = []
    for segment in (title or "").split("\n"):
        words = segment.split()
        if not words:
            continue
        current = ""
        for word in words:
            test = f"{current} {word}".strip() if current else word
            if draw.textbbox((0, 0), test, font=font)[2] <= max_w:
                current = test
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
    return lines[:max_lines]


def _generate_cover(video_path: str, job_id: str, frame_time: float,
                    title: str, font_path: str,
                    font_size: int = 72, text_color: str = "white",
                    title_position: str = "middle",
                    italic: bool = False,
                    stroke_color: str = None, stroke_width: int = 0,
                    text_color2: str = None,
                    output_name: str = "cover.jpg") -> str:
    """Extract a frame with ffmpeg → overlay the title text with Pillow → return the cover image path.
    output_name gives a separate output file name so previews don't overwrite the real cover.jpg.
    The title is drawn on a transparent layer, stroke and italic are applied, then it is composited."""
    import subprocess
    from PIL import Image, ImageDraw, ImageFont, ImageColor

    raw = os.path.join(settings.temp_dir, job_id, "cover_raw.jpg")
    out = os.path.join(settings.temp_dir, job_id, output_name)

    # 1. Extract frame
    subprocess.run(
        ["ffmpeg", "-y", "-ss", str(frame_time), "-i", video_path,
         "-frames:v", "1", raw],
        check=True, capture_output=True,
    )

    # 2. 1080x1920 crop/resize (same logic as to_reels_format)
    img = Image.open(raw).convert("RGB")
    iw, ih = img.size
    ratio = 1080 / 1920
    if iw / ih > ratio:
        nw = int(ih * ratio)
        img = img.crop(((iw - nw) // 2, 0, (iw + nw) // 2, ih))
    else:
        nh = int(iw / ratio)
        img = img.crop((0, (ih - nh) // 2, iw, (ih + nh) // 2))
    img = img.resize((1080, 1920), Image.LANCZOS)

    # 3. Text overlay — draw on a transparent layer, apply the italic shear, then composite
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    try:
        font = ImageFont.truetype(font_path, size=font_size)
    except Exception:
        font = ImageFont.load_default()

    try:
        fill_color = ImageColor.getrgb(text_color)
    except Exception:
        fill_color = (255, 255, 255)

    # Bottom line color (if set) — otherwise same as the top line
    if text_color2:
        try:
            fill_color2 = ImageColor.getrgb(text_color2)
        except Exception:
            fill_color2 = fill_color
    else:
        fill_color2 = fill_color

    stroke_rgb = None
    if stroke_width and stroke_width > 0:
        try:
            stroke_rgb = ImageColor.getrgb(stroke_color or "black")
        except Exception:
            stroke_rgb = (0, 0, 0)

    line_height = int(font_size * 1.25)
    max_w = 960

    # Word-level wrapping (max 2 lines); shrink the font if it overflows
    lines = _wrap_cover_title(title, draw, font, max_w, max_lines=2)
    cur_font_size = font_size
    while len(_wrap_cover_title(title, draw, font, max_w, max_lines=100)) > 2 and cur_font_size > 32:
        cur_font_size = int(cur_font_size * 0.85)
        try:
            font = ImageFont.truetype(font_path, size=cur_font_size)
        except Exception:
            break
        line_height = int(cur_font_size * 1.25)
        lines = _wrap_cover_title(title, draw, font, max_w, max_lines=2)

    text_block_h = len(lines) * line_height
    base_y = COVER_TITLE_POSITIONS.get(title_position, 810)
    y = base_y - text_block_h // 2
    x_center = 540
    for i, line in enumerate(lines):
        line_fill = fill_color if i == 0 else fill_color2  # top line = color 1, bottom (and later) lines = color 2
        # Shadow (no stroke)
        draw.text((x_center, y + 2), line, font=font, fill=(0, 0, 0, 180), anchor="mt")
        # Main text (with optional stroke)
        if stroke_rgb is not None:
            draw.text((x_center, y), line, font=font, fill=line_fill, anchor="mt",
                      stroke_width=stroke_width, stroke_fill=stroke_rgb)
        else:
            draw.text((x_center, y), line, font=font, fill=line_fill, anchor="mt")
        y += line_height

    if italic:
        # Shear around the vertical center (keeps canvas size)
        ov_w, ov_h = overlay.size
        shear = 0.22
        c = shear * (ov_h / 2.0)
        overlay = overlay.transform(
            (ov_w, ov_h), Image.AFFINE, (1, shear, -c, 0, 1, 0), resample=Image.BICUBIC
        )

    img = img.convert("RGBA")
    img.alpha_composite(overlay)
    img = img.convert("RGB")

    img.save(out, "JPEG", quality=95)
    return out


def update_job(job_id: str, **kwargs):
    with SyncSessionLocal() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
            db.commit()


def _build_video(job_id: str, job, target_w: int = 1080, target_h: int = 1920,
                 generate_cover: bool = False) -> str:
    """Shared video editing logic. Returns output_path."""
    # Determine usable video paths
    all_paths = list(job.video_paths) if job.video_paths else []
    if not all_paths and job.video_path:
        all_paths = [job.video_path]
    video_path = all_paths[0] if all_paths else None  # used for cover generation

    audio_path = job.audio_path
    script = job.script
    subtitle_color = job.subtitle_color or "white"
    subtitle_bg_color = job.subtitle_bg_color
    subtitle_font = resolve_font(job.subtitle_font)
    cover_font = resolve_font(job.cover_font)
    bgm_filename = job.bgm_filename
    voice_volume = float(job.voice_volume) if job.voice_volume else 1.0
    bgm_volume_val = float(job.bgm_volume) if job.bgm_volume else 0.25

    if not video_path or not os.path.exists(video_path):
        raise ValueError(f"Video file not found: {video_path}")
    if not audio_path or not os.path.exists(audio_path):
        raise ValueError(f"Audio file not found: {audio_path}")

    os.makedirs(settings.output_dir, exist_ok=True)
    output_path = os.path.abspath(os.path.join(settings.output_dir, f"{job_id}.mp4"))

    # Keep only valid paths → convert each to reels format → concatenate
    valid_paths = [p for p in all_paths if p and os.path.exists(p)]
    # moviepy ignores rotation flags of phone videos — feed it upright copies
    from utils.ffmpeg_helper import ensure_upright
    clips = [to_reels_format(VideoFileClip(ensure_upright(p))) for p in valid_paths]
    if len(clips) > 1:
        logger.info(f"[{job_id}] Concatenating {len(clips)} videos")
        video = concatenate_videoclips(clips, method="compose")
    else:
        video = clips[0]
    original_duration = video.duration
    TARGET_MAX = 30.0
    if original_duration > TARGET_MAX:
        video = video.subclipped(0, TARGET_MAX)
        original_duration = TARGET_MAX
    if target_w != 1080 or target_h != 1920:
        video = video.resized((target_w, target_h))

    audio = AudioFileClip(audio_path).with_volume_scaled(voice_volume)
    tts_duration = audio.duration
    # Determine final_duration from the source video length (clamped to TARGET_MAX)
    # If TTS is shorter, fill the rest with BGM; if longer, trim it to the limit
    final_duration = min(original_duration, TARGET_MAX)
    tts_active = min(tts_duration, final_duration)  # span where TTS actually plays

    if bgm_filename:
        bgm_path = os.path.join(settings.bgm_dir, bgm_filename)
        if os.path.exists(bgm_path):
            bgm = AudioFileClip(bgm_path)
            if bgm.duration < final_duration:
                repeats = int(final_duration / bgm.duration) + 1
                bgm = concatenate_audioclips([bgm] * repeats)
            bgm = bgm.subclipped(0, final_duration).with_volume_scaled(bgm_volume_val)
            tts = audio.subclipped(0, tts_active)
            audio = CompositeAudioClip([tts, bgm]).with_duration(final_duration)
        else:
            logger.warning(f"[{job_id}] BGM file not found, skipping: {bgm_path}")
            tts = audio.subclipped(0, tts_active)
            if tts_active < final_duration:
                silent = AudioClip(
                    frame_function=lambda t: np.zeros(2),
                    duration=final_duration - tts_active,
                    fps=44100,
                )
                audio = concatenate_audioclips([tts, silent])
            else:
                audio = tts
    else:
        tts = audio.subclipped(0, tts_active)
        if tts_active < final_duration:
            silent = AudioClip(
                frame_function=lambda t: np.zeros(2),
                duration=final_duration - tts_active,
                fps=44100,
            )
            audio = concatenate_audioclips([tts, silent])
        else:
            audio = tts

    # Loop/trim the video — applied regardless of BGM (prevents black screen)
    if video.duration < final_duration:
        video = video.with_effects([vfx.Loop(duration=final_duration)])
    else:
        video = video.subclipped(0, final_duration)

    # Generate the cover image (final_edit only, runs before the video render)
    cover_image_path = None
    if generate_cover and job.cover_frame_time and job.title:
        try:
            cover_path = _generate_cover(
                video_path, job_id,
                float(job.cover_frame_time),
                job.title,
                cover_font,
                font_size=job.cover_font_size or 72,
                text_color=job.cover_title_color or "white",
                title_position=job.cover_title_position or "middle",
                italic=bool(job.cover_italic),
                stroke_color=job.cover_stroke_color,
                stroke_width=job.cover_stroke_width if job.cover_stroke_width is not None else 0,
                text_color2=job.cover_title_color2,
            )
            update_job(job_id, cover_image_path=cover_path)
            cover_image_path = cover_path
            logger.info(f"[{job_id}] Cover image generated: {cover_path}")
        except Exception as e:
            logger.warning(f"[{job_id}] Cover image generation failed (skipped): {e}")

    alignment = None
    ts_path = os.path.join(settings.temp_dir, job_id, "voice_timestamps.json")
    if os.path.exists(ts_path):
        try:
            with open(ts_path, "r", encoding="utf-8") as f:
                alignment = json.load(f)
        except Exception as e:
            logger.warning(f"[{job_id}] Failed to load voice_timestamps.json: {e}")

    subtitle_clips = []
    if script:
        pos = _parse_subtitle_position(job.subtitle_position or "9")
        subtitle_clips = make_subtitle_clips(
            script, final_duration, subtitle_color, subtitle_bg_color,
            subtitle_position=pos, max_lines=1, subtitle_font=subtitle_font,
            video_w=target_w,
            shadow_color=job.subtitle_shadow_color,
            shadow_offset=job.subtitle_shadow_offset if job.subtitle_shadow_offset is not None else 2,
            shadow_blur=job.subtitle_shadow_blur if job.subtitle_shadow_blur is not None else 0,
            stroke_color=job.subtitle_stroke_color or "black",
            stroke_width=job.subtitle_stroke_width if job.subtitle_stroke_width is not None else 2,
            font_size_base=job.subtitle_font_size or 64,
            italic=bool(job.subtitle_italic),
            alignment=alignment,
        )

    COVER_DURATION = 0.5
    if cover_image_path and os.path.exists(cover_image_path):
        intro = (
            ImageClip(cover_image_path)
            .resized((target_w, target_h))
            .with_duration(COVER_DURATION)
        )
        silent = AudioClip(
            frame_function=lambda t: np.zeros(2),
            duration=COVER_DURATION,
            fps=44100,
        )
        intro = intro.with_audio(silent)

        # Shift subtitle timestamps later by the cover duration
        subtitle_clips = [
            c.with_start(c.start + COVER_DURATION).with_end(c.end + COVER_DURATION)
            for c in subtitle_clips
        ]

        main_video = video.with_audio(audio)
        merged = concatenate_videoclips([intro, main_video])
        final = CompositeVideoClip([merged] + subtitle_clips)
    else:
        video = video.with_audio(audio)
        final = CompositeVideoClip([video] + subtitle_clips)

    # Black-screen prevention check
    if final.duration < audio.duration - 0.5:
        logger.error(
            f"[{job_id}] Black screen risk: video={final.duration:.1f}s < audio={audio.duration:.1f}s"
        )

    fps = 24 if target_w < 1080 else 30
    bitrate = "2000k" if target_w < 1080 else "5000k"
    final.write_videofile(
        output_path,
        fps=fps,
        codec="libx264",
        audio_codec="aac",
        bitrate=bitrate,
        threads=4,
        logger=None,
    )

    # Video quality evaluation (non-blocking — skipped on failure)
    try:
        from utils.eval_helpers import validate_output_video, merge_eval_scores
        video_eval = validate_output_video(output_path, final_duration)
        merge_eval_scores(job_id, "video", video_eval)
        if video_eval.get("has_black_frames"):
            logger.warning(f"[{job_id}] Black screen detected")
    except Exception as e:
        logger.warning(f"[{job_id}] Video evaluation skipped: {e}")

    for clip in [final, video, audio]:
        try:
            clip.close()
        except Exception:
            pass

    return output_path


@celery.task(bind=True, max_retries=2, retry_backoff=True)
def preview_edit(self, prev_result: dict) -> dict:
    """Render a low-res (540x960) preview video → awaiting_tts_review"""
    if not prev_result:
        return

    job_id = prev_result["job_id"]
    logger.info(f"[{job_id}] Starting preview edit")
    update_job(job_id, status="editing")

    try:
        with SyncSessionLocal() as db:
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                raise ValueError(f"Job not found: {job_id}")
            job_snapshot = job

            output_path = _build_video(job_id, job, target_w=540, target_h=960)

        update_job(job_id, status="awaiting_tts_review", output_path=output_path)
        logger.info(f"[{job_id}] Preview edit complete: {output_path}")
        return {**prev_result, "output_path": output_path}

    except Exception as e:
        logger.error(f"[{job_id}] Preview edit failed: {e}")
        update_job(job_id, status="failed", error_message=str(e))
        raise self.retry(exc=e)


@celery.task(bind=True, max_retries=2, retry_backoff=True)
def final_edit(self, job_id: str) -> dict:
    """High-res (1080x1920) final render"""
    logger.info(f"[{job_id}] Starting final edit")
    update_job(job_id, status="editing")

    try:
        with SyncSessionLocal() as db:
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                raise ValueError(f"Job not found: {job_id}")

            output_path = _build_video(job_id, job, target_w=1080, target_h=1920,
                                       generate_cover=True)

        update_job(job_id, status="review_pending", output_path=output_path)
        logger.info(f"[{job_id}] Final edit complete: {output_path}")
        return {"job_id": job_id, "output_path": output_path}

    except Exception as e:
        logger.error(f"[{job_id}] Final edit failed: {e}")
        update_job(job_id, status="failed", error_message=str(e))
        raise self.retry(exc=e)


# Alias for backward compatibility
@celery.task(bind=True, max_retries=2, retry_backoff=True)
def edit(self, prev_result: dict) -> dict:
    """Legacy-compatible task — delegates to final_edit"""
    if not prev_result:
        return
    job_id = prev_result["job_id"]
    return final_edit.apply_async(args=[job_id]).get()
