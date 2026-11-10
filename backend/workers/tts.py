import base64
import json
import os
import logging

import requests

from workers.celery_app import celery
from database import SyncSessionLocal
from models.job import Job
from config import settings

logger = logging.getLogger(__name__)


def elevenlabs_tts(text: str, output_path: str, voice_id: str = None, speed: float = 1.1):
    voice_id = voice_id or settings.elevenlabs_voice_id
    api_key = settings.elevenlabs_api_key

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": "eleven_v3",
        "speed": speed,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
        },
    }

    response = requests.post(url, headers=headers, json=payload)
    response.raise_for_status()
    data = response.json()

    with open(output_path, "wb") as f:
        f.write(base64.b64decode(data["audio_base64"]))

    return data.get("alignment")


def clova_tts(text: str, output_path: str) -> None:
    """Naver CLOVA Voice TTS fallback"""
    client_id = settings.clova_client_id
    client_secret = settings.clova_client_secret

    if not client_id or not client_secret:
        raise RuntimeError("CLOVA environment variables not set (CLOVA_CLIENT_ID, CLOVA_CLIENT_SECRET)")

    url = "https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts"
    headers = {
        "X-NCP-APIGW-API-KEY-ID": client_id,
        "X-NCP-APIGW-API-KEY": client_secret,
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {
        "speaker": "nara",
        "volume": "0",
        "speed": "0",
        "pitch": "0",
        "format": "mp3",
        "text": text,
    }

    response = requests.post(url, headers=headers, data=data)
    response.raise_for_status()

    with open(output_path, "wb") as f:
        f.write(response.content)


def synthesize_tts(text: str, output_path: str, voice_id: str = None, speed: float = 1.1):
    provider = settings.tts_provider

    if provider != "elevenlabs" and not settings.enable_clova_voice:
        raise RuntimeError(
            "TTS_PROVIDER=clova requires ENABLE_CLOVA_VOICE=true (see docs/LEGAL.md)."
        )

    if provider == "elevenlabs":
        try:
            return elevenlabs_tts(text, output_path, voice_id=voice_id, speed=speed)
        except requests.HTTPError as e:
            if settings.enable_clova_voice and e.response.status_code in (429, 500, 502, 503):
                logger.warning(f"ElevenLabs failed ({e.response.status_code}), falling back to CLOVA")
                clova_tts(text, output_path)
                return None
            else:
                raise
    else:
        clova_tts(text, output_path)
        return None


def check_audio_duration(audio_path: str) -> float:
    from moviepy import AudioFileClip

    clip = AudioFileClip(audio_path)
    duration = clip.duration
    clip.close()

    if duration > 30:
        logger.warning(f"TTS audio exceeds 30s: {duration:.1f}s")

    return duration


def script_to_text(script: dict) -> str:
    """Convert the script JSON into text for TTS"""
    if script.get("full_text"):
        return script["full_text"]
    parts = [script.get("hook", "")]
    for point in script.get("points", []):
        parts.append(point)
    parts.append(script.get("cta", ""))
    return " ".join(p for p in parts if p)


def _speed_up_audio(audio_path: str, factor: float) -> None:
    """Adjust audio speed with the ffmpeg atempo filter (in place). Chains atempo to stay within 0.5-2.0."""
    import subprocess
    tmp = audio_path + ".atempo.mp3"
    filters = []
    remaining = factor
    while remaining > 2.0:
        filters.append("atempo=2.0")
        remaining /= 2.0
    filters.append(f"atempo={remaining:.6f}")
    subprocess.run(
        ["ffmpeg", "-y", "-i", audio_path, "-filter:a", ",".join(filters), tmp],
        check=True, capture_output=True,
    )
    os.replace(tmp, audio_path)


def _apply_volume_to_audio(audio_path: str, volume: float) -> None:
    """Adjust audio volume with the ffmpeg volume filter (in place). 1.0 = original."""
    import subprocess
    tmp = audio_path + ".vol.mp3"
    subprocess.run(
        ["ffmpeg", "-y", "-i", audio_path, "-filter:a", f"volume={volume:.3f}", tmp],
        check=True, capture_output=True,
    )
    os.replace(tmp, audio_path)


def _scale_alignment(alignment: dict, factor: float) -> dict:
    """Scale alignment timestamps proportionally after atempo speed-up."""
    return {
        "characters": alignment.get("characters", []),
        "character_start_times_seconds": [t / factor for t in alignment.get("character_start_times_seconds", [])],
        "character_end_times_seconds": [t / factor for t in alignment.get("character_end_times_seconds", [])],
    }


def _get_video_duration(video_paths: list) -> float:
    """Return the total source video duration (clamped to 30s). Returns 30.0 if measurement fails."""
    try:
        from moviepy import VideoFileClip
        total = 0.0
        for p in video_paths:
            if p and os.path.exists(p):
                clip = VideoFileClip(p)
                total += clip.duration
                clip.close()
        return min(total, 30.0) if total > 0 else 30.0
    except Exception:
        return 30.0


def update_job(job_id: str, **kwargs):
    with SyncSessionLocal() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
            db.commit()


@celery.task(bind=True, max_retries=3, retry_backoff=True)
def tts(self, prev_result: dict) -> dict:
    if not prev_result:
        return

    job_id = prev_result["job_id"]
    logger.info(f"[{job_id}] Starting TTS")
    update_job(job_id, status="tts_processing")

    try:
        with SyncSessionLocal() as db:
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                raise ValueError(f"Job not found: {job_id}")
            script = job.script
            voice_id = job.voice_id
            tts_speed = float(job.tts_speed) if job.tts_speed else 1.1
            all_video_paths = list(job.video_paths) if job.video_paths else []
            if not all_video_paths and job.video_path:
                all_video_paths = [job.video_path]

        if not script:
            raise ValueError("No script found")

        text = script_to_text(script)
        audio_path = os.path.join(settings.temp_dir, job_id, "voice.mp3")
        os.makedirs(os.path.dirname(audio_path), exist_ok=True)

        alignment = synthesize_tts(text, audio_path, voice_id=voice_id, speed=tts_speed)
        duration = check_audio_duration(audio_path)

        # TTS limit = min(source video, 30s) - 2s
        SPEED_MAX = 1.5
        video_duration = _get_video_duration(all_video_paths)  # returns min(source, 30s)
        duration_limit = video_duration - 2.0
        if duration > duration_limit:
            # Recompute even if the stored speed is already max (so we're not stuck with a previous auto-adjusted value)
            base_speed = min(tts_speed, SPEED_MAX)
            adjusted_speed = min(base_speed * (duration / duration_limit), SPEED_MAX)
            if adjusted_speed > tts_speed:
                # Regenerate at a faster speed
                logger.info(
                    f"[{job_id}] TTS {duration:.1f}s > limit {duration_limit:.0f}s, "
                    f"regenerating at speed {tts_speed:.2f} → {adjusted_speed:.2f}"
                )
                alignment = synthesize_tts(text, audio_path, voice_id=voice_id, speed=adjusted_speed)
                duration = check_audio_duration(audio_path)
                tts_speed = adjusted_speed
                update_job(job_id, tts_speed=str(round(adjusted_speed, 2)))
            else:
                # Already at max speed (1.5) — no need to regenerate with ElevenLabs, go straight to atempo
                logger.info(f"[{job_id}] Already at max speed ({tts_speed:.2f}), skipping ElevenLabs regeneration")
            if duration > duration_limit:
                # Still too long at ElevenLabs max speed → ffmpeg atempo post-processing
                atempo_factor = duration / duration_limit
                total_speed = tts_speed * atempo_factor
                if total_speed > 2.0:
                    logger.warning(
                        f"[{job_id}] Total speed {total_speed:.2f}x (ElevenLabs {tts_speed:.2f}x × atempo {atempo_factor:.3f}x) "
                        f"— script is too long"
                    )
                logger.info(
                    f"[{job_id}] Still {duration:.1f}s over the limit at ElevenLabs max speed, "
                    f"applying ffmpeg atempo {atempo_factor:.3f}x"
                )
                _speed_up_audio(audio_path, atempo_factor)
                if alignment:
                    alignment = _scale_alignment(alignment, atempo_factor)
                duration = check_audio_duration(audio_path)

        if alignment:
            ts_path = os.path.join(settings.temp_dir, job_id, "voice_timestamps.json")
            with open(ts_path, "w", encoding="utf-8") as f:
                json.dump(alignment, f, ensure_ascii=False)

        # TTS duration check (non-blocking — skipped on failure)
        try:
            from utils.eval_helpers import merge_eval_scores
            tts_eval = {
                "duration": round(duration, 2),
                "video_duration": round(video_duration, 1),
                "limit": round(duration_limit, 1),
                "over_by": round(max(duration - duration_limit, 0), 2),
                "compliance": duration <= duration_limit,
            }
            merge_eval_scores(job_id, "tts", tts_eval)
        except Exception as eval_err:
            logger.warning(f"[{job_id}] TTS evaluation skipped: {eval_err}")

        update_job(job_id, status="tts_done", audio_path=audio_path)
        logger.info(f"[{job_id}] TTS complete: {duration:.1f}s")
        return {**prev_result, "audio_path": audio_path, "audio_duration": duration}

    except requests.HTTPError as e:
        logger.warning(f"[{job_id}] TTS HTTP error, retrying: {e}")
        update_job(job_id, error_message=str(e))
        raise self.retry(exc=e)

    except Exception as e:
        logger.error(f"[{job_id}] TTS failed: {e}")
        update_job(job_id, status="failed", error_message=str(e))
        raise self.retry(exc=e)
