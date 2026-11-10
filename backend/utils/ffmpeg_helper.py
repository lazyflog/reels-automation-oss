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
