import json
import mimetypes
import logging
import time

from workers.celery_app import celery
from database import SyncSessionLocal
from models.job import Job
from config import settings
import prompts

logger = logging.getLogger(__name__)


def update_job(job_id: str, **kwargs):
    with SyncSessionLocal() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
            db.commit()


@celery.task(bind=True, max_retries=2, retry_backoff=True)
def analyze(self, prev_result: dict) -> dict:
    if not prev_result:
        return

    job_id = prev_result["job_id"]
    video_paths = prev_result.get("video_paths") or []
    if not video_paths and prev_result.get("video_path"):
        video_paths = [prev_result["video_path"]]

    # Skip analysis if no Gemini API key is set
    if not settings.gemini_api_key:
        logger.warning(f"[{job_id}] GEMINI_API_KEY not set, skipping analysis step")
        return prev_result

    logger.info(f"[{job_id}] Starting Gemini video analysis ({len(video_paths)} videos)")
    update_job(job_id, status="analyzing")

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_model)

        uploaded = []
        for path in video_paths:
            logger.info(f"[{job_id}] Uploading file to Gemini: {path}")
            f = genai.upload_file(path=path, mime_type=mimetypes.guess_type(path)[0] or "video/mp4")
            # Wait for PROCESSING to finish
            for _ in range(60):  # up to 3 minutes
                if f.state.name != "PROCESSING":
                    break
                time.sleep(3)
                f = genai.get_file(f.name)
            if f.state.name == "FAILED":
                logger.warning(f"[{job_id}] Gemini file upload failed: {path}")
                continue
            uploaded.append(f)

        if not uploaded:
            logger.warning(f"[{job_id}] No videos uploaded, skipping analysis")
            return prev_result

        prompt = prompts.fill(prompts.VIDEO_ANALYSIS_PROMPT, language=settings.content_language)

        response = model.generate_content([*uploaded, prompt])
        text = response.text.strip()
        # Extract the JSON block
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        result = json.loads(text.strip())

        update_job(
            job_id,
            status="analyzed",
            analysis_result=result,
            title=result.get("suggested_title"),
        )
        logger.info(f"[{job_id}] Analysis complete: {result.get('product_name')}")
        return {**prev_result, "product_info": result.get("product_info", ""), "analysis_result": result}

    except Exception as e:
        logger.error(f"[{job_id}] Analysis failed: {e}")
        # Keep the pipeline going even if analysis fails (proceed without product_info)
        update_job(job_id, status="analyzed", error_message=f"Analysis failed (skipped): {e}")
        return prev_result
