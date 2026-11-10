# パイプラインの拡張

[English](EXTENDING.md) · [한국어](EXTENDING.ko.md) · [简体中文](EXTENDING.zh-CN.md) · **日本語**

このガイドでは、ソース動画に独自の処理（例えば映像の整理や高画質化）を追加する方法を説明し、
その用途で vmake.ai サービスを使う場合に利用できる機能をまとめます。

## ステップを追加する場所

各ジョブは Celery タスクのチェーンとして実行されます。各タスクは前のタスクの結果 dict を受け取り、
更新したコピーを返します。

```
extract ─▶ analyze ─▶ [ your step ] ─▶ generate ─▶ tts ─▶ preview_edit
(URLs only)                                                     │
                                       review ─▶ final_edit ─▶ review ─▶ upload
```

ソース動画に手を加えるのに最も適した場所は **`analyze` と `generate` の間**です。この時点で動画は
すでにダウンロードまたはアップロード済みで、次のステップでは（処理後の）動画をもとに台本の長さが
計算されます。アップロードしたファイルから作成したジョブは `extract` をスキップし、`analyze` から
始まります。

チェーンは `backend/api/jobs.py` の `_start_pipeline()` で組み立てられています。

```python
steps = [analyze.s(), generate.s(), tts.s(), preview_edit.s()]
```

### 1. タスクを書く

`backend/workers/preprocess.py` のようなモジュールを作成します。

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
    """動画を 1 本処理し、結果を `dest` に書き出す。使用するパスを返す。"""
    raise NotImplementedError


@celery.task(bind=True, max_retries=2, retry_backoff=True)
def preprocess(self, prev_result: dict) -> dict:
    if not prev_result:          # 前のステップが失敗した
        return
    job_id = prev_result["job_id"]
    paths = prev_result.get("video_paths") or [prev_result["video_path"]]

    out = []
    for i, src in enumerate(paths):
        dest = os.path.join(settings.temp_dir, job_id, f"processed_{i}.mp4")
        try:
            out.append(process_one(src, dest))
        except Exception as e:   # 処理に失敗したら元の動画を使う
            logger.warning(f"[{job_id}] preprocessing failed for video {i}: {e}")
            out.append(src)

    update_job(job_id, video_path=out[0], video_paths=out)
    return {**prev_result, "video_path": out[0], "video_paths": out}
```

結果 dict には `job_id`、`video_path`、`video_paths` と、利用可能な場合は `product_info` と
`analysis_result` が含まれます。これらのキーはそのまま残し、変更した値だけを置き換えてください。

### 2. 登録する

- `backend/workers/celery_app.py` の `include=[...]` に `"workers.preprocess"` を追加します。
- `backend/api/jobs.py` でタスクを import し、チェーンに挿入します。

  ```python
  steps = [analyze.s(), preprocess.s(), generate.s(), tts.s(), preview_edit.s()]
  ```

- 設定（API キー、有効／無効フラグ）は `backend/config.py` と `.env.example` に追加します。
- 再ビルドします：`docker compose up -d --build api worker`。

## 例：vmake.ai

[vmake.ai](https://vmake.ai/developers)（Meitu 提供）は、クレジット制の有料 AI 画像・動画編集
サービスです。公式ツールとして、[meitu/vmake-skills](https://github.com/meitu/vmake-skills) の
エージェントスキルと、[`vmake-labs-cli`](https://www.npmjs.com/package/vmake-labs-cli)
コマンドラインツール（MIT、Node.js 20.3 以上）が提供されています。

> [!WARNING]
> ウォーターマークやクリエイターのクレジットは権利管理情報です。自身が所有していない動画から
> これらを除去すると、民事上・刑事上の責任を問われる可能性があります。vmake 自身も、ウォーターマークの
> 除去は自身が所有する動画、または編集の許可を得ている動画に限るよう求めています。除去機能を使う前に
> [LEGAL.ja.md](LEGAL.ja.md) をお読みください。

### 機能

公式スキル（バージョン 1.0.8、CLI `>=0.1.11 <0.2.0`）に記載されている機能は次のとおりです。

| スキル | 機能 | 入力 | CLI コマンド |
|---|---|---|---|
| `vmake-video-remove-watermark` | 動画からウォーターマークを除去し、隠れていたフレームを補修 | 動画 | `vmake tool video-remove-auto --video-file <path>` |
| `vmake-video-remove-subtitle` | 動画の焼き付け字幕／テキストオーバーレイを除去 | 動画 | `vmake tool video-remove-auto --video-file <path>` |
| `vmake-video-repair` | 鮮明さとディテールを向上させ、ノイズを低減（高画質化／アップスケーリング） | 動画 | `vmake tool video-repair --video-file <path>` |
| `vmake-image-remove-watermark` | 画像からテキストや文字のウォーターマークを除去 | 画像 | `vmake tool image-remove-text --image-file <path>` |
| `vmake-image-repair` | 画像の鮮明さとディテールを向上 | 画像 | `vmake tool image-repair --image-file <path>` |
| `vmake-dynamic-caption` | 音声または字幕のタイムラインから動的キャプションを生成 | 動画 | `vmake subtitle --video-file <path>` |
| `vmake-smart-montage` | 1〜20 個の画像／動画を構成・編集して 1 本の動画にする | 画像／動画 | `vmake mixed-cut analyze …` |

vmake の開発者ページには、`videoscreenclear`（動画のウォーターマーク除去）、`hdvideoallinone`
（動画の高画質化、最大 8K）、`eraser_watermark`（画像のウォーターマーク除去）、`image_restoration`
（画像の高画質化）といった API タスク ID も掲載されています。機能、パラメーター、料金は変わることが
あります。最新の情報は `vmake tool <name> --help`、`vmake contracts`、および vmake のサイトで
確認してください。

このパイプラインで特に役立つのは `video-repair`（自身が所有する低画質映像の高画質化）と、自身の
映像に限っての `video-remove-auto` です。キャプションとモンタージュは、本プロジェクトにすでにある
機能と重なります。

### セットアップ

1. バックエンドのイメージに Node.js 20.3 以上と CLI をインストールします。例えば
   `backend/Dockerfile` に次を追加します。

   ```dockerfile
   RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm \
       && npm install -g --include=optional vmake-labs-cli@0.1 \
       && rm -rf /var/lib/apt/lists/*
   ```

   （Debian の `nodejs` パッケージは 20.3 より古い場合があります。`vmake --version` が失敗する
   場合は、NodeSource のパッケージかマルチステージビルドを使用してください。）
2. <https://vmake.ai/developers> で API キーを作成し、CLI を認証します（`vmake auth --help` を参照。
   `vmake auth status --check` で確認できます）。
3. CLI を呼び出すように `process_one()` を実装します。例：

   ```python
   import subprocess

   def process_one(src: str, dest: str) -> str:
       proc = subprocess.run(
           ["vmake", "tool", "video-repair", "--video-file", src],
           capture_output=True, text=True, timeout=1800,
       )
       if proc.returncode != 0:
           raise RuntimeError(proc.stderr.strip())
       result_url = parse_result_url(proc.stdout)  # CLI の出力仕様を参照
       download(result_url, dest)
       return dest
   ```

   CLI が `TASK_STATE_COMPLETED` を報告し、出力 URL を返した場合にのみ、タスクが完了したと
   見なしてください。終了コードが 0 であるだけでは成功の証拠になりません。出力形式と復旧手順に
   ついては、meitu/vmake-skills にある該当スキルの `references/runtime.md` ファイルを参照してください。
