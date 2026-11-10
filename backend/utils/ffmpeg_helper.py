"""FFmpeg 관련 유틸리티"""
import subprocess
import logging

logger = logging.getLogger(__name__)


def get_video_info(video_path: str) -> dict:
    """ffprobe로 영상 메타데이터 추출"""
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_streams", "-show_format", video_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe 실패: {result.stderr}")

    import json
    return json.loads(result.stdout)


def check_ffmpeg() -> bool:
    """ffmpeg 설치 여부 확인"""
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def extract_frames(video_path: str, output_dir: str, count: int = 10,
                   start_offset: float = 0.0) -> list:
    """영상에서 균등 간격으로 프레임 추출 → 경로 목록 반환"""
    import os

    os.makedirs(output_dir, exist_ok=True)

    # 영상 길이 파악
    info = get_video_info(video_path)
    duration = float(info.get("format", {}).get("duration", 0))
    if duration <= 0:
        for stream in info.get("streams", []):
            if stream.get("codec_type") == "video":
                duration = float(stream.get("duration", 0))
                break

    if duration <= 0:
        logger.warning(f"영상 길이 파악 불가: {video_path}")
        duration = 30.0

    # 균등 간격 계산 (첫/마지막 0.5초 제외)
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
            logger.warning(f"프레임 추출 실패 t={t:.1f}s: {result.stderr.decode()[:200]}")

    return frame_paths
