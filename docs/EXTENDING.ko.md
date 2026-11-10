# 파이프라인 확장하기

[English](EXTENDING.md) · **한국어** · [简体中文](EXTENDING.zh-CN.md) · [日本語](EXTENDING.ja.md)

이 문서는 원본 영상을 직접 처리하는 단계(예: 영상 정리나 화질 개선)를 추가하는 방법을 설명하고,
이런 용도로 vmake.ai 서비스를 쓰려는 경우 어떤 기능이 있는지 정리합니다.

## 단계를 추가할 위치

각 작업은 Celery 태스크 체인으로 실행됩니다. 모든 태스크는 이전 태스크가 반환한 결과 dict를
받아서, 수정한 사본을 반환합니다.

```
extract ─▶ analyze ─▶ [ your step ] ─▶ generate ─▶ tts ─▶ preview_edit
(URLs only)                                                     │
                                       review ─▶ final_edit ─▶ review ─▶ upload
```

원본 영상을 손보기에 가장 좋은 위치는 **`analyze`와 `generate` 사이**입니다. 이 시점에는 영상이
이미 다운로드되었거나 업로드되어 있고, 다음 단계에서 (처리된) 영상을 기준으로 스크립트 길이를
계산하기 때문입니다. 업로드한 파일로 만든 작업은 `extract`를 건너뛰고 `analyze`부터 시작합니다.

체인은 `backend/api/jobs.py`의 `_start_pipeline()`에서 만들어집니다.

```python
steps = [analyze.s(), generate.s(), tts.s(), preview_edit.s()]
```

### 1. 태스크 작성하기

`backend/workers/preprocess.py` 같은 모듈을 만듭니다.

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
    """영상 하나를 처리해 결과를 `dest`에 씁니다. 사용할 경로를 반환합니다."""
    raise NotImplementedError


@celery.task(bind=True, max_retries=2, retry_backoff=True)
def preprocess(self, prev_result: dict) -> dict:
    if not prev_result:          # 앞 단계가 실패한 경우
        return
    job_id = prev_result["job_id"]
    paths = prev_result.get("video_paths") or [prev_result["video_path"]]

    out = []
    for i, src in enumerate(paths):
        dest = os.path.join(settings.temp_dir, job_id, f"processed_{i}.mp4")
        try:
            out.append(process_one(src, dest))
        except Exception as e:   # 처리에 실패하면 원본을 그대로 사용
            logger.warning(f"[{job_id}] preprocessing failed for video {i}: {e}")
            out.append(src)

    update_job(job_id, video_path=out[0], video_paths=out)
    return {**prev_result, "video_path": out[0], "video_paths": out}
```

결과 dict에는 `job_id`, `video_path`, `video_paths`가 들어 있고, 값이 있으면 `product_info`와
`analysis_result`도 들어 있습니다. 이 키들은 그대로 두고, 바꾼 값만 교체하세요.

### 2. 등록하기

- `backend/workers/celery_app.py`의 `include=[...]`에 `"workers.preprocess"`를 추가합니다.
- `backend/api/jobs.py`에서 태스크를 import한 뒤 체인에 끼워 넣습니다.

  ```python
  steps = [analyze.s(), preprocess.s(), generate.s(), tts.s(), preview_edit.s()]
  ```

- 필요한 설정(API 키, 켜기/끄기 플래그)은 `backend/config.py`와 `.env.example`에 추가합니다.
- 다시 빌드합니다: `docker compose up -d --build api worker`.

## 예시: vmake.ai

[vmake.ai](https://vmake.ai/developers)(Meitu 제공)는 크레딧 기반의 유료 AI 이미지·영상 편집
서비스입니다. 공식 도구로는 [meitu/vmake-skills](https://github.com/meitu/vmake-skills)의 에이전트
스킬과 [`vmake-labs-cli`](https://www.npmjs.com/package/vmake-labs-cli) 명령줄 도구(MIT, Node.js
20.3 이상)가 있습니다.

> [!WARNING]
> 워터마크와 크리에이터 표시는 권리관리정보입니다. 본인 소유가 아닌 영상에서 이를 지우면 민사·형사
> 책임을 질 수 있으며, vmake도 본인 소유 영상이나 편집 허락을 받은 영상에서만 워터마크를 제거하라고
> 안내합니다. 제거 기능을 쓰기 전에 [LEGAL.ko.md](LEGAL.ko.md)를 읽어 주세요.

### 기능

공식 스킬(버전 1.0.8, CLI `>=0.1.11 <0.2.0`) 기준 목록입니다.

| 스킬 | 기능 | 입력 | CLI 명령어 |
|---|---|---|---|
| `vmake-video-remove-watermark` | 영상에서 워터마크를 지우고 가려졌던 프레임을 복원 | 영상 | `vmake tool video-remove-auto --video-file <path>` |
| `vmake-video-remove-subtitle` | 영상에 박힌 자막 / 텍스트 오버레이 제거 | 영상 | `vmake tool video-remove-auto --video-file <path>` |
| `vmake-video-repair` | 선명도와 디테일을 높이고 노이즈를 줄임(화질 개선 / 업스케일링) | 영상 | `vmake tool video-repair --video-file <path>` |
| `vmake-image-remove-watermark` | 이미지에서 텍스트와 텍스트 워터마크 제거 | 이미지 | `vmake tool image-remove-text --image-file <path>` |
| `vmake-image-repair` | 이미지의 선명도와 디테일 개선 | 이미지 | `vmake tool image-repair --image-file <path>` |
| `vmake-dynamic-caption` | 음성이나 자막 타임라인으로 동적 캡션 생성 | 영상 | `vmake subtitle --video-file <path>` |
| `vmake-smart-montage` | 이미지/영상 1~20개를 계획에 따라 영상 하나로 편집 | 이미지 / 영상 | `vmake mixed-cut analyze …` |

vmake 개발자 페이지에는 `videoscreenclear`(영상 워터마크 제거), `hdvideoallinone`(영상 화질 개선,
최대 8K), `eraser_watermark`(이미지 워터마크 제거), `image_restoration`(이미지 화질 개선) 같은 API
태스크 ID도 나와 있습니다. 기능, 파라미터, 가격은 바뀔 수 있으니 최신 내용은
`vmake tool <name> --help`, `vmake contracts`, vmake 사이트에서 확인하세요.

이 파이프라인에 가장 쓸모 있는 기능은 `video-repair`(본인이 찍은 저화질 영상 개선)이고, 본인 영상에
한해서는 `video-remove-auto`도 쓸 만합니다. 캡션과 몽타주는 이 프로젝트에 이미 있는 기능과
겹칩니다.

### 설정

1. 백엔드 이미지에 Node.js 20.3 이상과 CLI를 설치합니다. 예를 들어 `backend/Dockerfile`에 다음을
   추가합니다.

   ```dockerfile
   RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm \
       && npm install -g --include=optional vmake-labs-cli@0.1 \
       && rm -rf /var/lib/apt/lists/*
   ```

   (Debian의 `nodejs` 패키지는 20.3보다 오래된 버전일 수 있습니다. `vmake --version`이 실패하면
   NodeSource 패키지나 멀티 스테이지 빌드를 사용하세요.)
2. <https://vmake.ai/developers>에서 API 키를 발급받고 CLI 인증을 마칩니다(`vmake auth --help` 참고,
   `vmake auth status --check`로 확인할 수 있습니다).
3. CLI를 호출하도록 `process_one()`을 구현합니다. 예를 들면 다음과 같습니다.

   ```python
   import subprocess

   def process_one(src: str, dest: str) -> str:
       proc = subprocess.run(
           ["vmake", "tool", "video-repair", "--video-file", src],
           capture_output=True, text=True, timeout=1800,
       )
       if proc.returncode != 0:
           raise RuntimeError(proc.stderr.strip())
       result_url = parse_result_url(proc.stdout)  # CLI 출력 규약 참고
       download(result_url, dest)
       return dest
   ```

   CLI가 `TASK_STATE_COMPLETED`를 보고하고 출력 URL을 반환했을 때만 태스크가 끝난 것으로
   처리하세요. 종료 코드가 0이라는 것만으로는 성공했다고 볼 수 없습니다. 출력 형식과 복구 절차는
   meitu/vmake-skills에서 해당 스킬의 `references/runtime.md` 파일을 참고하세요.
