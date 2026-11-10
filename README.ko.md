# reels-automation

[English](README.md) · **한국어** · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

**직접 촬영한 제품 영상**으로 세로형 숏폼 영상(Instagram 릴스)을 만드는 셀프 호스팅
파이프라인입니다. AI가 내레이션 대본을 쓰고, TTS로 내레이션을 만들고, 스타일을 입힌 자막과
표지 프레임을 붙입니다. 게시 전에 웹 대시보드에서 모든 결과물을 검수합니다.

```
Upload footage ─▶ Gemini video analysis ─▶ GPT script ─▶ ElevenLabs TTS ─▶ 540p preview
      │                                                                        │
      │                                   review: edit script, pick cover ◀────┘
      ▼
1080×1920 final render (subtitles, cover, BGM) ─▶ review & approve ─▶ Instagram Reels
```

> [!IMPORTANT]
> 이 프로젝트는 **본인이 소유하거나 사용 허락을 받은 영상과 오디오**로 영상을 만드는
> 워크플로 도구입니다. 다른 크리에이터의 콘텐츠를 내려받거나 다시 올리거나 재수익화하는
> 용도로 만들지 않았으며, 그런 용도로 사용해서는 안 됩니다. 서드파티 플랫폼에 접근하는
> 연동 기능은 **기본적으로 꺼져 있습니다**. 이 기능을 켜기 전에 [docs/LEGAL.ko.md](docs/LEGAL.ko.md)를
> 먼저 읽어 주세요.

## 주요 기능

- **작업당 여러 소스** — 같은 제품의 클립을 최대 10개까지 합쳐 영상 하나로 만듭니다.
- **AI 대본** — 훅 → 핵심 포인트 3개 → 행동 유도(CTA) 구조로, 영상 길이에 맞춰 원하는
  언어(`CONTENT_LANGUAGE`)로 작성합니다.
- **선택형 페르소나** — 대시보드에서 말투(설명 + 화법)를 정의할 수 있습니다. 직접 고르지 않으면
  페르소나를 적용하지 않습니다. 예시 페르소나는 [`examples/`](examples)에 있습니다.
- **프롬프트 라이브러리** — 훅 / CTA / 대본 예시를 저장해 두면 퓨샷(few-shot) 예시로
  주입합니다.
- **TTS** — ElevenLabs `eleven_v3`, 작업별 음성·속도·볼륨 설정.
- **편집** — moviepy + ffmpeg: 자막(글꼴, 크기, 색상, 외곽선, 그림자, 기울임, 위치), 제목을
  넣은 표지 프레임, 볼륨 조절이 가능한 배경 음악.
- **2단계 검수** — 대본 수정과 표지 선택이 가능한 미리보기(540p)를 거친 뒤, 업로드 전에
  최종 렌더링(1080×1920)을 한 번 더 검수합니다.
- **품질 평가** — 작업을 막지 않는 점검 항목: LLM-as-judge 대본 점수, TTS 길이 확인, 최종
  영상의 검은 화면 / 길이 확인.
- **Instagram 릴스 업로드** — 공식 Instagram API(Instagram 로그인) 사용.

## 요구 사항

- Docker(Compose v2 포함)
- API 키:

| 서비스 | 용도 | 필수 여부 |
|---|---|---|
| [OpenAI](https://platform.openai.com/api-keys) | 대본, 캡션, 대본 평가 | 필수 |
| [ElevenLabs](https://elevenlabs.io/app/settings/api-keys) | TTS(텍스트 음성 변환) | 필수 |
| [Google AI Studio (Gemini)](https://aistudio.google.com/app/apikey) | 영상 분석 | 선택 |
| [Meta for Developers](https://developers.facebook.com) | Instagram 릴스 업로드 | 선택 |

ElevenLabs 오디오를 상업적으로 사용하려면 ElevenLabs 유료 요금제가 필요합니다. Gemini 무료
등급에서는 Google이 제품 개선에 입력 데이터를 활용할 수 있고, 사람이 직접 검토할 수도
있습니다. 자세한 내용은 [docs/LEGAL.ko.md](docs/LEGAL.ko.md#ai-제공업체)를 참고하세요.

## 빠른 시작

```bash
git clone https://github.com/lazyflog/reels-automation-oss.git
cd reels-automation-oss
cp .env.example .env          # OPENAI_API_KEY, ELEVENLABS_API_KEY 등을 채워 넣습니다
python3 scripts/check_env.py  # 선택: .env 검증

docker compose up -d --build
docker compose exec api alembic upgrade head
docker compose exec api python scripts/create_admin.py --username admin --password '<strong password>'

# 선택: 예시 페르소나와 ElevenLabs 음성 불러오기
docker compose exec api python -m scripts.seed_examples /examples/seed.en.json
```

<http://localhost:8080>(nginx)에서 대시보드를 열고 로그인합니다.

서비스 구성: `api`(FastAPI), `worker`와 `beat`(Celery), `dashboard`(Next.js), `postgres`,
`redis`, `nginx`.

### Instagram 업로드

Instagram은 공개 URL에서 렌더링된 영상을 내려받습니다. 따라서 `PUBLIC_BASE_URL`은 nginx(포트
8080)에 연결되는 HTTPS 주소여야 합니다. 로컬 개발 환경이라면 `ngrok http 8080` 등을 사용하세요.
장기 토큰은 `backend/scripts/instagram_setup.py`로 발급받습니다(`--help` 참고).

Meta는 실제와 구분하기 어려운 AI 생성 오디오(AI 내레이션 등)에 AI 콘텐츠 라벨을 붙이도록
요구합니다. 필요한 경우 라벨을 붙이세요. Content Publishing API에는 호출 한도가 있습니다
(계정당 24시간에 약 100개 게시물).

## 설정

모든 설정은 `.env`에 있습니다. 전체 목록은 [`.env.example`](.env.example)을 참고하세요.

| 변수 | 기본값 | 설명 |
|---|---|---|
| `CONTENT_LANGUAGE` | `English` | 대본, 캡션, 표지 제목의 언어 |
| `TARGET_AUDIENCE` | *(비어 있음)* | 대본 프롬프트에 넣을 타깃 시청자 설명(선택) |
| `CAPTION_DISCLOSURE` | *(비어 있음)* | 모든 캡션 끝에 덧붙일 문구(예: 제휴 마케팅 고지) |
| `OPENAI_MODEL` / `GEMINI_MODEL` | `gpt-5.2` / `gemini-3-flash-preview` | 사용 모델 |
| `ENABLE_URL_IMPORT` | `true` | URL로 소스 영상 가져오기 허용(yt-dlp) |
| `UPLOAD_DELAY_MIN_MINUTES` / `…_MAX_MINUTES` | `0` / `0` | 업로드 전 무작위 지연(선택) |

### 선택(옵트인) 기능 (기본값: 꺼짐)

필요한 권리를 갖춘 사용자를 위해 마련한 기능이지만, 법적 위험이나 이용약관 위반 위험이
따릅니다. 켜 두면 시작할 때마다 경고 로그를 남깁니다. **먼저 [docs/LEGAL.ko.md](docs/LEGAL.ko.md)를
읽어 주세요.**

| 변수 | 기능 | 꺼 둔 이유 |
|---|---|---|
| `ENABLE_WATERMARK_REMOVAL` | vmake.ai 플러그인으로 워터마크 / 하드코딩된 자막을 지웁니다. SDK는 **포함되어 있지 않습니다** — [backend/plugins/vmake](backend/plugins/vmake/README.md) 참고. | 크리에이터의 워터마크(권리관리정보)를 지우면 민사·형사 책임을 질 수 있습니다. 본인 소유 영상에만 사용하세요. |
| `ENABLE_XHS_IMPORT` | 서드파티 [XHS-Downloader](https://github.com/JoeanAmier/XHS-Downloader) 사이드카(`docker compose --profile xhs up -d`)로 샤오훙슈 링크를 가져옵니다. | 샤오훙슈 약관은 스크래핑과 다운로드를 금지합니다. XHS-Downloader(GPL-3.0)에도 별도의 사용 제한이 있습니다. |
| `ENABLE_BGM_URL_DOWNLOAD` | yt-dlp로 URL에서 배경 음악을 내려받습니다. | YouTube, SoundCloud를 비롯한 대부분의 플랫폼이 오디오 다운로드를 금지합니다. |
| `ENABLE_CLOVA_VOICE` | NAVER CLOVA Voice를 TTS 제공업체 / 대체 수단으로 사용합니다. | CLOVA Voice 이용 정책은 생성된 오디오의 저장과 편집을 허용하지 않습니다. |

## 글꼴과 음악

이 저장소는 글꼴이나 음악 파일을 배포하지 않습니다. Docker 이미지에는 나눔 글꼴과 Noto CJK
글꼴 패밀리(SIL OFL 1.1)가 설치됩니다. 추가 `.ttf` / `.otf` 파일은 `backend/fonts/`에,
오디오 파일은 `bgm/`에 넣거나 대시보드에서 업로드하세요. 이때 라이선스를 꼭 확인하세요.
추천 무료 글꼴과 음악 출처는 [docs/ASSETS.ko.md](docs/ASSETS.ko.md)에 정리해 두었습니다.

## 프로젝트 구조

```
backend/            FastAPI 앱, Celery 워커, SQLAlchemy 모델, Alembic 마이그레이션
  workers/          extract → analyze → remove_watermark → generate → tts → edit → upload
  prompts.py        모든 LLM 프롬프트(영어로 작성, 출력 언어는 설정 가능)
  plugins/vmake/    선택형 워터마크 제거 플러그인(SDK 미포함)
dashboard/          Next.js 14 대시보드(App Router, Tailwind)
examples/           선택형 시드 데이터(페르소나, 음성), 영어·한국어
nginx/              리버스 프록시 설정
docs/               법률 안내, 에셋 가이드
```

## 자주 쓰는 명령어

```bash
docker compose logs -f worker              # 워커 로그 실시간 확인
docker compose up -d --build api worker    # 백엔드 변경 후 다시 빌드
docker compose exec api alembic upgrade head
docker compose down                        # 중지(데이터베이스 볼륨은 유지)
```

## 기여하기

[CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요. 이슈, 테스트, 예시에 실제 서드파티 영상 URL,
크리에이터 이름, 내려받은 미디어, 저작권이 있는 오디오를 넣지 말아 주세요.

## 라이선스

[MIT](LICENSE). 서드파티 구성 요소는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에
정리되어 있습니다. 이 소프트웨어는 "있는 그대로(as is)" 제공됩니다. 소프트웨어를 어떻게
사용할지, 그리고 법률과 연결하는 모든 서비스의 약관을 지키는 일은 전적으로 사용자의 책임입니다.
