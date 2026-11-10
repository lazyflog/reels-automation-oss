"""Tier 1 evals: LLM script evaluation + TTS duration check + video quality check"""
import json
import logging
import subprocess
from datetime import datetime

from sqlalchemy.orm.attributes import flag_modified

from database import SyncSessionLocal
from models.job import Job
from config import settings
import prompts

logger = logging.getLogger(__name__)


def merge_eval_scores(job_id: str, category: str, scores: dict) -> None:
    """Merge per-category results into the Job.eval_scores JSON."""
    with SyncSessionLocal() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
        existing = job.eval_scores or {}
        existing[category] = {**scores, "evaluated_at": datetime.utcnow().isoformat()}
        job.eval_scores = existing
        flag_modified(job, "eval_scores")
        db.commit()


def evaluate_script(script: dict, persona: str | None, target_seconds: int) -> dict:
    """Evaluate script quality with GPT-5.2 as LLM-as-Judge. reasoning=none keeps it fast and cheap."""
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)

    script_text = json.dumps(script, ensure_ascii=False)
    prompt = prompts.fill(
        prompts.SCRIPT_EVAL_PROMPT,
        script=script_text,
        persona=persona or "(none)",
        target_seconds=target_seconds,
        language=settings.content_language,
    )

    response = client.responses.create(
        model=settings.openai_model,
        reasoning={"effort": "none"},
        input=[{"role": "user", "content": prompt}],
    )
    text = response.output[0].content[0].text
    return json.loads(text)


def validate_output_video(output_path: str, expected_duration: float) -> dict:
    """Check the actual duration with ffprobe + detect black frames with ffmpeg blackdetect."""
    result = {"has_black_frames": False, "actual_duration": 0.0,
              "audio_video_sync": True}

    # 1. ffprobe: actual duration
    try:
        probe = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_format", output_path],
            capture_output=True, text=True, timeout=15,
        )
        info = json.loads(probe.stdout)
        actual_duration = float(info.get("format", {}).get("duration", 0))
        result["actual_duration"] = round(actual_duration, 2)
        result["audio_video_sync"] = abs(actual_duration - expected_duration) < 2.0
    except Exception as e:
        logger.warning(f"ffprobe failed: {e}")

    # 2. ffmpeg blackdetect: detect black screens of 0.5s or longer
    try:
        bd = subprocess.run(
            ["ffmpeg", "-i", output_path,
             "-vf", "blackdetect=d=0.5:pix_th=0.10",
             "-an", "-f", "null", "-"],
            capture_output=True, text=True, timeout=60,
        )
        stderr = bd.stderr
        if "black_start" in stderr:
            result["has_black_frames"] = True
    except Exception as e:
        logger.warning(f"blackdetect failed: {e}")

    return result
