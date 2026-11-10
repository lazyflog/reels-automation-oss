import json
import logging
import os
import re
import subprocess

from openai import OpenAI

from sqlalchemy import or_

from workers.celery_app import celery
from database import SyncSessionLocal
from models.job import Job
from models.prompt_library import PromptLibrary
from config import settings
import prompts

logger = logging.getLogger(__name__)

client = OpenAI(api_key=settings.openai_api_key)

def _strip_emoji(text: str) -> str:
    return re.sub(
        "[\U00010000-\U0010FFFF\u2600-\u26FF\u2700-\u27BF]+",
        "", text
    ).strip()


def _get_video_duration(video_paths: list) -> float:
    """Compute total video duration (seconds) with ffprobe. Clamped to 45s."""
    total = 0.0
    for path in video_paths:
        if not path or not os.path.exists(path):
            continue
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "quiet", "-print_format", "json",
                 "-show_streams", path],
                capture_output=True, text=True, timeout=10,
            )
            info = json.loads(result.stdout)
            for stream in info.get("streams", []):
                if stream.get("codec_type") == "video":
                    total += float(stream.get("duration", 0))
                    break
        except Exception as e:
            logger.warning(f"Failed to measure video duration ({path}): {e}")
    return min(total, 45.0)


def _fetch_persona_details(persona_name: str) -> dict:
    """Fetch the persona description + speech_style from the DB. Empty strings if not found."""
    try:
        from models.persona import Persona
        with SyncSessionLocal() as db:
            p = db.query(Persona).filter(Persona.name == persona_name).first()
            if p:
                return {"description": p.description, "speech_style": p.speech_style}
    except Exception as e:
        logger.warning(f"Persona lookup failed (skipped): {e}")
    return {"description": "", "speech_style": ""}


def _fetch_library_examples(persona: str | None) -> dict:
    """Fetch active prompt-library items grouped by category.

    Items with no persona are shared; persona-specific items are included only
    when that persona is selected.
    """
    try:
        with SyncSessionLocal() as db:
            q = db.query(PromptLibrary).filter(PromptLibrary.is_active == True)  # noqa: E712
            if persona:
                q = q.filter(or_(PromptLibrary.persona == persona, PromptLibrary.persona == None))  # noqa: E711
            else:
                q = q.filter(PromptLibrary.persona == None)  # noqa: E711
            items = q.all()
        result = {"hook": [], "cta": [], "script": []}
        for item in items:
            if item.category in result:
                result[item.category].append(item.content)
        return result
    except Exception as e:
        logger.warning(f"Prompt library lookup failed (skipped): {e}")
        return {"hook": [], "cta": [], "script": []}


def generate_script(product_info: str, persona: str | None = None,
                    target_seconds: int = 35, max_chars: int = None) -> dict:
    points_seconds = target_seconds - 8          # minus hook (3 s) and cta (5 s)
    point_seconds = round(points_seconds / 3, 1) # seconds per point

    persona_block = ""
    speech_style = prompts.DEFAULT_SPEECH_STYLE
    if persona:
        details = _fetch_persona_details(persona)
        persona_block = prompts.fill(
            prompts.PERSONA_BLOCK,
            persona=persona,
            persona_description=details["description"] or f"A shopping curator called {persona}.",
        )
        speech_style = details["speech_style"] or speech_style

    audience = settings.target_audience.strip()
    prompt = prompts.fill(
        prompts.SCRIPT_SYSTEM_PROMPT,
        persona_block=persona_block,
        audience_clause=f" aimed at {audience}" if audience else "",
        speech_style=speech_style,
        target_seconds=target_seconds,
        points_seconds=points_seconds,
        point_seconds=point_seconds,
        language=settings.content_language,
    )

    # Inject few-shot examples from the prompt library
    library_examples = _fetch_library_examples(persona)
    extras = []
    if library_examples.get("hook"):
        hooks = "\n".join(f"- {h}" for h in library_examples["hook"][:5])
        extras.append(f"{prompts.LIBRARY_HOOKS_HEADER}\n{hooks}")
    if library_examples.get("cta"):
        ctas = "\n".join(f"- {c}" for c in library_examples["cta"][:5])
        extras.append(f"{prompts.LIBRARY_CTAS_HEADER}\n{ctas}")
    if library_examples.get("script"):
        scripts = "\n".join(f"- {s}" for s in library_examples["script"][:3])
        extras.append(f"{prompts.LIBRARY_SCRIPTS_HEADER}\n{scripts}")
    if extras:
        prompt += "\n\n" + "\n\n".join(extras)

    user_content = f"Product information: {product_info}"
    if max_chars:
        user_content += prompts.fill(prompts.LENGTH_LIMIT_NOTE, max_chars=max_chars)

    response = client.responses.create(
        model=settings.openai_model,
        reasoning={"effort": "none"},
        input=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_content},
        ],
    )
    text = response.output[0].content[0].text
    script = json.loads(text)
    return {
        "title": _strip_emoji(script.get("title", "")),
        "hook": _strip_emoji(script.get("hook", "")),
        "points": [_strip_emoji(p) for p in script.get("points", [])],
        "cta": _strip_emoji(script.get("cta", "")),
        "keyword": _strip_emoji(script.get("keyword", "")),
    }


def generate_caption(script: dict, product_info: str = "", keyword: str = "") -> str:
    prompt = prompts.fill(
        prompts.CAPTION_PROMPT,
        keyword=keyword or prompts.DEFAULT_CAPTION_KEYWORD,
        language=settings.content_language,
    )
    user_content = f"Script: {json.dumps(script, ensure_ascii=False)}"
    if product_info:
        user_content += f"\n\nProduct information: {product_info}"
    response = client.responses.create(
        model=settings.openai_model,
        reasoning={"effort": "none"},
        input=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_content},
        ],
    )
    text = response.output[0].content[0].text
    caption = json.loads(text)["caption"]
    disclosure = settings.caption_disclosure.strip()
    if disclosure:
        caption += "\n\n" + disclosure
    return caption


def update_job(job_id: str, **kwargs):
    with SyncSessionLocal() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
            db.commit()


@celery.task(bind=True, max_retries=3, retry_backoff=True)
def generate(self, prev_result: dict) -> dict:
    if not prev_result:
        return

    job_id = prev_result["job_id"]
    logger.info(f"[{job_id}] Starting script generation")
    update_job(job_id, status="generating")

    try:
        with SyncSessionLocal() as db:
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                raise ValueError(f"Job not found: {job_id}")
            persona = job.persona or None
            source_url = job.source_url
            user_desc = job.description
            voice_id = job.voice_id
            tts_speed = float(job.tts_speed) if job.tts_speed else 1.1

        xhs_info = prev_result.get("product_info")
        if user_desc and xhs_info:
            product_info = f"{user_desc}\n\n[Source video information]\n{xhs_info}"
        elif user_desc:
            product_info = user_desc
        elif xhs_info:
            product_info = xhs_info
        else:
            product_info = source_url

        # Measure video duration → set the target script length (30-40s total incl. 0.5s cover)
        video_paths = prev_result.get("video_paths") or []
        if not video_paths and prev_result.get("video_path"):
            video_paths = [prev_result["video_path"]]
        raw_duration = _get_video_duration(video_paths)
        # Target the script 2s shorter than the video (prevents black screen), clamped to 29-39s
        # The 0.5s cover is separate, so main body 29-39s → final 29.5-39.5s
        target_seconds = max(29, min(int(raw_duration - 2), 39)) if raw_duration > 2 else 35
        logger.info(f"[{job_id}] Total video duration: {raw_duration:.1f}s → script target: {target_seconds}s")

        script = generate_script(product_info, persona, target_seconds=target_seconds)

        # Pre-validate TTS duration — regenerate the script if even 2x speed-up can't fit it (up to 2 retries)
        try:
            from workers.tts import synthesize_tts as _synthesize_tts, script_to_text, check_audio_duration
            video_duration = min(raw_duration, 30.0)
            duration_limit = max(video_duration - 2.0, 1.0)
            MAX_SPEED_RATIO = 2.0
            # Validation TTS uses the user's speed setting; natural = D * tts_speed, up to 2x compression possible
            max_val_duration = duration_limit * MAX_SPEED_RATIO / tts_speed
            tts_val_dir = os.path.join(settings.temp_dir, job_id, "tts_val")
            os.makedirs(tts_val_dir, exist_ok=True)

            MAX_TTS_RETRIES = 2
            for attempt in range(MAX_TTS_RETRIES + 1):
                val_audio = os.path.join(tts_val_dir, f"val_{attempt}.mp3")
                try:
                    tts_text = script_to_text(script)
                    _synthesize_tts(tts_text, val_audio, voice_id=voice_id, speed=tts_speed)
                    val_duration = check_audio_duration(val_audio)
                    logger.info(
                        f"[{job_id}] TTS check {attempt+1}/{MAX_TTS_RETRIES+1}: "
                        f"{val_duration:.1f}s / limit {max_val_duration:.1f}s"
                    )
                    if val_duration <= max_val_duration:
                        logger.info(f"[{job_id}] TTS check passed")
                        break
                    if attempt < MAX_TTS_RETRIES:
                        current_chars = len(tts_text)
                        # Target character count: scale down proportionally, with a 10% margin
                        max_chars = int(current_chars * (max_val_duration / val_duration) * 0.9)
                        logger.info(
                            f"[{job_id}] TTS too long → regenerating script "
                            f"(target {max_chars} chars ← current {current_chars} chars)"
                        )
                        script = generate_script(
                            product_info, persona,
                            target_seconds=target_seconds, max_chars=max_chars,
                        )
                    else:
                        logger.warning(
                            f"[{job_id}] TTS still "
                            f"{val_duration:.1f}s over the limit after {MAX_TTS_RETRIES} retries, proceeding anyway"
                        )
                except Exception as val_err:
                    logger.warning(f"[{job_id}] TTS check skipped ({attempt+1}): {val_err}")
                    break
                finally:
                    try:
                        if os.path.exists(val_audio):
                            os.remove(val_audio)
                    except Exception:
                        pass
        except Exception as tts_val_err:
            logger.warning(f"[{job_id}] TTS check skipped entirely: {tts_val_err}")

        caption = generate_caption(script, product_info, keyword=script.get("keyword", ""))

        # Script quality evaluation (non-blocking — skipped on failure)
        try:
            from utils.eval_helpers import evaluate_script, merge_eval_scores
            script_eval = evaluate_script(script, persona, target_seconds)
            merge_eval_scores(job_id, "script", script_eval)
            logger.info(f"[{job_id}] Script evaluation: overall={script_eval.get('overall_score')}")
        except Exception as eval_err:
            logger.warning(f"[{job_id}] Script evaluation skipped: {eval_err}")

        # If a generated title (max 20 chars) exists, update job.title (takes precedence over the analyze-step title)
        update_kwargs = dict(status="generated", script=script, caption=caption)
        script_title = script.get("title")
        if script_title:
            update_kwargs["title"] = script_title
        update_job(job_id, **update_kwargs)
        logger.info(f"[{job_id}] Script generation complete")
        return {**prev_result, "script": script, "caption": caption}

    except Exception as e:
        logger.error(f"[{job_id}] Script generation failed: {e}")
        update_job(job_id, status="failed", error_message=str(e))
        raise self.retry(exc=e)
