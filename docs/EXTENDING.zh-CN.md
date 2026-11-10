# 扩展流水线

[English](EXTENDING.md) · [한국어](EXTENDING.ko.md) · **简体中文** · [日本語](EXTENDING.ja.md)

本指南介绍如何添加你自己的源视频处理步骤（例如清理或增强素材），并列出如果你打算用 vmake.ai
服务来完成这些工作，它能提供哪些功能。

## 在哪里添加步骤

每个任务都以一串 Celery 任务链的形式运行。每个任务接收上一个任务返回的结果 dict，
并返回一份更新后的副本：

```
extract ─▶ analyze ─▶ [ your step ] ─▶ generate ─▶ tts ─▶ preview_edit
(URLs only)                                                     │
                                       review ─▶ final_edit ─▶ review ─▶ upload
```

修改源视频的最佳位置是 **`analyze` 与 `generate` 之间**：此时视频已经下载或上传完毕，
而下一步会根据（处理后的）视频计算脚本长度。通过上传文件创建的任务会跳过 `extract`，
直接从 `analyze` 开始。

任务链在 `backend/api/jobs.py` 的 `_start_pipeline()` 中构建：

```python
steps = [analyze.s(), generate.s(), tts.s(), preview_edit.s()]
```

### 1. 编写任务

创建一个模块，例如 `backend/workers/preprocess.py`：

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
    """处理一个视频并将结果写入 `dest`，返回要使用的路径。"""
    raise NotImplementedError


@celery.task(bind=True, max_retries=2, retry_backoff=True)
def preprocess(self, prev_result: dict) -> dict:
    if not prev_result:          # 前面的步骤失败了
        return
    job_id = prev_result["job_id"]
    paths = prev_result.get("video_paths") or [prev_result["video_path"]]

    out = []
    for i, src in enumerate(paths):
        dest = os.path.join(settings.temp_dir, job_id, f"processed_{i}.mp4")
        try:
            out.append(process_one(src, dest))
        except Exception as e:   # 处理失败时保留原视频
            logger.warning(f"[{job_id}] preprocessing failed for video {i}: {e}")
            out.append(src)

    update_job(job_id, video_path=out[0], video_paths=out)
    return {**prev_result, "video_path": out[0], "video_paths": out}
```

结果 dict 包含 `job_id`、`video_path`、`video_paths`，如有则还包含 `product_info` 和
`analysis_result`。请保留这些键，只替换你修改过的部分。

### 2. 注册任务

- 在 `backend/workers/celery_app.py` 的 `include=[...]` 中添加 `"workers.preprocess"`。
- 在 `backend/api/jobs.py` 中导入该任务，并将其插入任务链：

  ```python
  steps = [analyze.s(), preprocess.s(), generate.s(), tts.s(), preview_edit.s()]
  ```

- 将相关配置（API 密钥、开关标志）写入 `backend/config.py` 和 `.env.example`。
- 重新构建：`docker compose up -d --build api worker`。

## 示例：vmake.ai

[vmake.ai](https://vmake.ai/developers)（美图出品）是一项按积分计费的付费 AI 图片和视频编辑服务。
其官方工具包括 [meitu/vmake-skills](https://github.com/meitu/vmake-skills) 中的智能体技能（agent
skills），以及 [`vmake-labs-cli`](https://www.npmjs.com/package/vmake-labs-cli) 命令行工具（MIT，
Node.js 20.3+）。

> [!WARNING]
> 水印和创作者署名属于权利管理信息。从不属于你的视频中去除它们可能构成民事侵权或刑事犯罪，
> vmake 自身也要求用户只对自己拥有或已获编辑许可的视频去除水印。使用去除功能前，请先阅读
> [LEGAL.zh-CN.md](LEGAL.zh-CN.md)。

### 功能

以下内容依据官方技能（版本 1.0.8，CLI `>=0.1.11 <0.2.0`）列出：

| 技能 | 作用 | 输入 | CLI 命令 |
|---|---|---|---|
| `vmake-video-remove-watermark` | 去除视频中的水印并修复被遮挡的画面 | 视频 | `vmake tool video-remove-auto --video-file <path>` |
| `vmake-video-remove-subtitle` | 去除视频中的硬字幕 / 文字叠加层 | 视频 | `vmake tool video-remove-auto --video-file <path>` |
| `vmake-video-repair` | 提升清晰度和细节、降低噪点（画质增强 / 超分辨率） | 视频 | `vmake tool video-repair --video-file <path>` |
| `vmake-image-remove-watermark` | 去除图片中的文字和文字水印 | 图片 | `vmake tool image-remove-text --image-file <path>` |
| `vmake-image-repair` | 增强图片的清晰度和细节 | 图片 | `vmake tool image-repair --image-file <path>` |
| `vmake-dynamic-caption` | 根据语音或字幕时间轴生成动态字幕 | 视频 | `vmake subtitle --video-file <path>` |
| `vmake-smart-montage` | 将 1–20 个图片/视频规划并剪辑成一个视频 | 图片 / 视频 | `vmake mixed-cut analyze …` |

vmake 开发者页面还列出了一些 API 任务 ID，例如 `videoscreenclear`（视频水印去除）、
`hdvideoallinone`（视频画质增强，最高 8K）、`eraser_watermark`（图片水印去除）和
`image_restoration`（图片画质增强）。功能、参数和价格都可能变化——请通过
`vmake tool <name> --help`、`vmake contracts` 以及 vmake 官网查看最新信息。

与本流水线最相关的是 `video-repair`（增强你自己拍摄的低画质素材），以及仅限用于你自己素材的
`video-remove-auto`。字幕和混剪功能与本项目已有的功能重叠。

### 配置

1. 在后端镜像中安装 Node.js 20.3+ 和 CLI，例如在 `backend/Dockerfile` 中添加：

   ```dockerfile
   RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm \
       && npm install -g --include=optional vmake-labs-cli@0.1 \
       && rm -rf /var/lib/apt/lists/*
   ```

   （Debian 的 `nodejs` 软件包版本可能低于 20.3——如果 `vmake --version` 执行失败，
   请改用 NodeSource 软件包或多阶段构建。）
2. 在 <https://vmake.ai/developers> 创建 API 密钥，并完成 CLI 认证（参见 `vmake auth --help`；
   可用 `vmake auth status --check` 进行验证）。
3. 通过调用 CLI 实现 `process_one()`，例如：

   ```python
   import subprocess

   def process_one(src: str, dest: str) -> str:
       proc = subprocess.run(
           ["vmake", "tool", "video-repair", "--video-file", src],
           capture_output=True, text=True, timeout=1800,
       )
       if proc.returncode != 0:
           raise RuntimeError(proc.stderr.strip())
       result_url = parse_result_url(proc.stdout)  # 参见 CLI 的输出约定
       download(result_url, dest)
       return dest
   ```

   只有当 CLI 报告 `TASK_STATE_COMPLETED` 并返回输出 URL 时，才可将任务视为完成——仅凭退出码为 0
   并不能证明成功。输出格式和恢复步骤请参阅 meitu/vmake-skills 中对应技能的
   `references/runtime.md` 文件。
