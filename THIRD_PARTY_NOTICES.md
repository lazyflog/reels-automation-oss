# Third-Party Notices

reels-automation is licensed under the MIT License (see [LICENSE](LICENSE)). It depends on, or
is designed to run alongside, the third-party components below. Each is licensed by its own
authors under the terms shown. **None of them are vendored in this repository.**

## Fonts

No font files are distributed with this repository. The Docker image installs these Debian
packages:

- Nanum fonts (`fonts-nanum`, `fonts-nanum-extra`) — © NHN Corporation (Naver). SIL Open Font License 1.1.
- Noto Sans CJK (`fonts-noto-cjk`) — © Google LLC / Adobe. SIL Open Font License 1.1.
- Noto Color Emoji (`fonts-noto-color-emoji`) — © Google LLC. SIL Open Font License 1.1.

Fonts you add to `backend/fonts/` are governed by their own licences (see [docs/ASSETS.md](docs/ASSETS.md)).

## Music

No music files are distributed with this repository.

## Python dependencies (installed from PyPI)

| Package | License |
|---|---|
| fastapi, sqlalchemy, alembic, moviepy, pydantic-settings | MIT |
| Pillow | MIT-CMU (HPND) |
| uvicorn, celery, httpx, python-dotenv | BSD-3-Clause |
| asyncpg, openai, requests, python-multipart, bcrypt, google-generativeai | Apache-2.0 |
| psycopg2-binary | LGPL-3.0-or-later with exceptions (bundles libpq — PostgreSQL License — and OpenSSL — Apache-2.0) |
| yt-dlp | The Unlicense |
| *Optional vmake plugin:* alibabacloud-oss-v2 | Apache-2.0 |

Transitive dependencies include imageio and imageio-ffmpeg (BSD-2-Clause), proglog (MIT),
decorator (BSD-2-Clause), numpy (BSD-3-Clause) and kombu (BSD-3-Clause).

## JavaScript dependencies (dashboard, installed from npm)

next, react, react-dom, recharts, tailwindcss, postcss, autoprefixer — MIT; typescript —
Apache-2.0. Transitive dependencies are MIT, ISC, Apache-2.0, BSD-3-Clause and 0BSD, plus
caniuse-lite (CC-BY-4.0, browser-support data).

## Programs and container images (not distributed here)

- **FFmpeg** — installed from Debian by `backend/Dockerfile` and invoked as an external program.
  Debian's build is GPL-2.0-or-later. Source: <https://sources.debian.org/src/ffmpeg/>. This
  repository only ships a Dockerfile; if you publish a built image you are distributing GPL
  binaries and must comply with the GPL.
- **XHS-Downloader** (`joeanamier/xhs-downloader`, optional `xhs` compose profile) — © JoeanAmier,
  GPL-3.0, <https://github.com/JoeanAmier/XHS-Downloader>. Runs as a separate container reached
  over HTTP; not part of this project's source. Its author's disclaimer applies (no unauthorised
  downloading of copyrighted content; no commercial promotion without written permission).
- **PostgreSQL** (`postgres` image) — PostgreSQL License.
- **Redis** (`redis:7.2` image) — BSD-3-Clause. (Redis 7.4 and later use different licences.)
- **nginx** (`nginx` image) — BSD-2-Clause.

## Optional third-party services

- **vmake.ai** (Meitu) — paid API used only by the optional `backend/plugins/vmake` plugin. No
  vmake SDK is included; users install it themselves and accept vmake's terms.
- **OpenAI, Google Gemini, ElevenLabs, NAVER CLOVA Voice, Meta (Instagram)** — used under each
  provider's terms. See [docs/LEGAL.md](docs/LEGAL.md).
