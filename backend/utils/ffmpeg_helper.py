"""FFmpeg utilities"""
import subprocess
import logging

logger = logging.getLogger(__name__)


def get_video_info(video_path: str) -> dict:
    """Extract video metadata with ffprobe"""
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_streams", "-show_format", video_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")

    import json
    return json.loads(result.stdout)


def check_ffmpeg() -> bool:
    """Check whether ffmpeg is installed"""
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def extract_frames(video_path: str, output_dir: str, count: int = 10,
                   start_offset: float = 0.0) -> list:
    """Extract frames at even intervals from a video → return a list of paths"""
    import os

    os.makedirs(output_dir, exist_ok=True)

    # Determine video duration
    info = get_video_info(video_path)
    duration = float(info.get("format", {}).get("duration", 0))
    if duration <= 0:
        for stream in info.get("streams", []):
            if stream.get("codec_type") == "video":
                duration = float(stream.get("duration", 0))
                break

    if duration <= 0:
        logger.warning(f"Could not determine video duration: {video_path}")
        duration = 30.0

    # Compute even intervals (excluding the first/last 0.5s)
    interval = max(1.0, (duration - 1.0) / count)
    frame_paths = []

    for i in range(count):
        t = 0.5 + start_offset + i * interval
        if t >= duration:
            break
        out_path = os.path.join(output_dir, f"frame_{i:02d}.jpg")
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(t),
            "-i", video_path,
            "-vframes", "1",
            "-q:v", "3",
            out_path,
        ]
        result = subprocess.run(cmd, capture_output=True)
        if result.returncode == 0 and os.path.exists(out_path):
            frame_paths.append(out_path)
        else:
            logger.warning(f"Frame extraction failed t={t:.1f}s: {result.stderr.decode()[:200]}")

    return frame_paths


def get_rotation(video_path: str) -> int:
    """Rotation (degrees) of the first video stream, from the display matrix or the
    legacy `rotate` tag. 0 if the video is stored upright."""
    try:
        info = get_video_info(video_path)
    except Exception as e:
        logger.warning(f"ffprobe failed, assuming no rotation ({video_path}): {e}")
        return 0
    for stream in info.get("streams", []):
        if stream.get("codec_type") != "video":
            continue
        for side in stream.get("side_data_list", []) or []:
            if "rotation" in side:
                return int(round(float(side["rotation"]))) % 360
        rotate = (stream.get("tags") or {}).get("rotate")
        if rotate:
            return int(rotate) % 360
        return 0
    return 0


def ensure_upright(video_path: str) -> str:
    """Return a path to an upright copy of `video_path`.

    Phone videos are often stored landscape with a rotation flag. ffmpeg applies the
    rotation when decoding, but moviepy reads the stored (unrotated) size, so such clips
    end up squashed and over-cropped. For rotated videos we re-encode once with ffmpeg
    (which bakes the rotation in) and cache the result next to the source.
    """
    import os

    if get_rotation(video_path) == 0:
        return video_path

    root, _ = os.path.splitext(video_path)
    upright = f"{root}.upright.mp4"
    if os.path.exists(upright) and os.path.getmtime(upright) >= os.path.getmtime(video_path):
        return upright

    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", video_path,
        "-map", "0:v:0", "-map", "0:a:0?",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-map_metadata", "-1",
        upright,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not os.path.exists(upright):
        logger.warning(f"Could not normalise rotation, using original ({video_path}): {result.stderr[:300]}")
        return video_path
    logger.info(f"Normalised rotated video: {video_path} → {upright}")
    return upright
