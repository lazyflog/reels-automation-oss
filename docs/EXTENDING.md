# Extending the pipeline

**English** · [한국어](EXTENDING.ko.md) · [简体中文](EXTENDING.zh-CN.md) · [日本語](EXTENDING.ja.md)

This guide shows how to add your own processing of the source videos — for example cleaning up
or enhancing footage — and lists what the vmake.ai service offers if you want to use it for that.

## Where to add a step

Each job runs as a chain of Celery tasks. Every task receives the previous task's result dict and
returns an updated copy:

```
extract ─▶ analyze ─▶ [ your step ] ─▶ generate ─▶ tts ─▶ preview_edit
(URLs only)                                                     │
                                       review ─▶ final_edit ─▶ review ─▶ upload
```

The best place to modify the source videos is **between `analyze` and `generate`**: the videos
are already downloaded or uploaded, and the script length is computed from the (processed)
videos in the next step. Jobs created from uploaded files skip `extract` and start at `analyze`.

The chain is built in `_start_pipeline()` in `backend/api/jobs.py`:

```python
steps = [analyze.s(), generate.s(), tts.s(), preview_edit.s()]
```

### 1. Write the task

Create a module such as `backend/workers/preprocess.py`:

```python
import os
import logging

from workers.celery_app import celery
from database import SyncSessionLocal
from models.job import Job
from config import settings

logger = logging.getLogger(__name__)


def update_job(job_id: str, **kwargs):
    with SyncSessionLocal() as db:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
            db.commit()


def process_one(src: str, dest: str) -> str:
    """Process one video and write the result to `dest`. Return the path to use."""
    raise NotImplementedError


@celery.task(bind=True, max_retries=2, retry_backoff=True)
def preprocess(self, prev_result: dict) -> dict:
    if not prev_result:          # an earlier step failed
        return
    job_id = prev_result["job_id"]
    paths = prev_result.get("video_paths") or [prev_result["video_path"]]

    out = []
    for i, src in enumerate(paths):
        dest = os.path.join(settings.temp_dir, job_id, f"processed_{i}.mp4")
        try:
            out.append(process_one(src, dest))
        except Exception as e:   # keep the original if processing fails
            logger.warning(f"[{job_id}] preprocessing failed for video {i}: {e}")
            out.append(src)

    update_job(job_id, video_path=out[0], video_paths=out)
    return {**prev_result, "video_path": out[0], "video_paths": out}
```

The result dict contains `job_id`, `video_path`, `video_paths` and, when available,
`product_info` and `analysis_result`. Keep those keys and only replace what you change.

### 2. Register it

- Add `"workers.preprocess"` to `include=[...]` in `backend/workers/celery_app.py`.
- Import it in `backend/api/jobs.py` and insert it into the chain:

  ```python
  steps = [analyze.s(), preprocess.s(), generate.s(), tts.s(), preview_edit.s()]
  ```

- Put any settings (API keys, on/off flag) in `backend/config.py` and `.env.example`.
- Rebuild: `docker compose up -d --build api worker`.

## Example: vmake.ai

[vmake.ai](https://vmake.ai/developers) (by Meitu) is a paid, credit-based AI image and video
editing service. Its official tools are the agent skills in
[meitu/vmake-skills](https://github.com/meitu/vmake-skills) and the
[`vmake-labs-cli`](https://www.npmjs.com/package/vmake-labs-cli) command-line tool (MIT, Node.js
20.3+).

> [!WARNING]
> Watermarks and creator credits are rights-management information. Removing them from videos
> you do not own can be a civil or criminal offence, and vmake itself asks users to remove
> watermarks only from videos they own or have permission to edit. Read [LEGAL.md](LEGAL.md)
> before using the removal features.

### Features

As listed in the official skills (version 1.0.8, CLI `>=0.1.11 <0.2.0`):

| Skill | What it does | Input | CLI command |
|---|---|---|---|
| `vmake-video-remove-watermark` | Removes watermarks from a video and repairs the covered frames | video | `vmake tool video-remove-auto --video-file <path>` |
| `vmake-video-remove-subtitle` | Removes burned-in subtitles / text overlays from a video | video | `vmake tool video-remove-auto --video-file <path>` |
| `vmake-video-repair` | Improves clarity and detail, reduces noise (enhancement / upscaling) | video | `vmake tool video-repair --video-file <path>` |
| `vmake-image-remove-watermark` | Removes text and text watermarks from an image | image | `vmake tool image-remove-text --image-file <path>` |
| `vmake-image-repair` | Enhances clarity and detail of an image | image | `vmake tool image-repair --image-file <path>` |
| `vmake-dynamic-caption` | Generates dynamic captions from speech or a subtitle timeline | video | `vmake subtitle --video-file <path>` |
| `vmake-smart-montage` | Plans and edits 1–20 images/videos into one video | images / videos | `vmake mixed-cut analyze …` |

The vmake developer page also lists API task IDs such as `videoscreenclear` (video watermark
removal), `hdvideoallinone` (video enhancement, up to 8K), `eraser_watermark` (image watermark
removal) and `image_restoration` (image enhancement). Features, parameters and prices change —
check `vmake tool <name> --help`, `vmake contracts` and the vmake site for the current details.

Most relevant for this pipeline are `video-repair` (enhancing low-quality footage you own) and,
for your own footage only, `video-remove-auto`. Captions and montage overlap with what this
project already does.

### Setup

1. Install Node.js 20.3+ and the CLI in the backend image, e.g. add to `backend/Dockerfile`:

   ```dockerfile
   RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm \
       && npm install -g --include=optional vmake-labs-cli@0.1 \
       && rm -rf /var/lib/apt/lists/*
   ```

   (Debian's `nodejs` package may be older than 20.3 — use the NodeSource packages or a
   multi-stage build if `vmake --version` fails.)
2. Create an API key at <https://vmake.ai/developers> and authenticate the CLI (see
   `vmake auth --help`; `vmake auth status --check` verifies it).
3. Implement `process_one()` by calling the CLI, for example:

   ```python
   import subprocess

   def process_one(src: str, dest: str) -> str:
       proc = subprocess.run(
           ["vmake", "tool", "video-repair", "--video-file", src],
           capture_output=True, text=True, timeout=1800,
       )
       if proc.returncode != 0:
           raise RuntimeError(proc.stderr.strip())
       result_url = parse_result_url(proc.stdout)  # see the CLI's output contract
       download(result_url, dest)
       return dest
   ```

   Only treat a task as done when the CLI reports `TASK_STATE_COMPLETED` and returns an output
   URL — a zero exit code alone is not proof of success. See the `references/runtime.md` file of
   the corresponding skill in meitu/vmake-skills for the output format and recovery steps.
