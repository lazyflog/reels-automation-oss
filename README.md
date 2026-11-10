# reels-automation

XHS(샤오홍수) 쇼핑 영상을 AI로 재가공해 인스타그램 릴스 + 유튜브 숏츠에 자동 업로드하는 파이프라인.

```
XHS URL(들) 입력 → 영상 수집 → Gemini 분석 → 워터마크 제거 → AI 대본 생성 → TTS → 자막+음성 검수 → 영상 편집 → 검수 → 멀티 업로드
```

---

## 요구 사항

- Docker Desktop (또는 Docker Engine + Compose v2)
- 아래 API 키 발급 완료

| API | 용도 | 발급 링크 |
|-----|------|-----------|
| OpenAI | GPT-5.2 대본 생성 | https://platform.openai.com/api-keys |
| ElevenLabs | TTS 음성 합성 | https://elevenlabs.io/app/settings/api-keys |
| Meta Graph API | 인스타그램 릴스 업로드 | https://developers.facebook.com |
| Google Cloud (YouTube Data API v3) | 유튜브 숏츠 업로드 | https://console.cloud.google.com |
| Google AI Studio (Gemini) | 영상 내용 분석 (선택) | https://aistudio.google.com/app/apikey |
| vmake.ai | 워터마크/자막 제거 (선택) | https://open.vmake.ai |

> XHS 영상 수집은 `xhs-downloader` 사이드카 컨테이너가 담당한다 (docker-compose에 포함, 별도 API 키 불필요).

---

## 설치 및 실행

### 1. 저장소 클론

```bash
git clone https://github.com/your-org/reels-automation.git
cd reels-automation
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 아래 항목을 입력한다.

```env
# 필수
DATABASE_URL=postgresql+asyncpg://postgres:password@postgres:5432/reels
SYNC_DATABASE_URL=postgresql+psycopg2://postgres:password@postgres:5432/reels
REDIS_URL=redis://redis:6379/0
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
RAPIDAPI_KEY=...
INSTAGRAM_ACCESS_TOKEN=...
INSTAGRAM_ACCOUNT_ID=...
PUBLIC_BASE_URL=https://your-domain.com   # Meta API + vmake.ai가 영상 파일에 접근할 공개 URL

# 선택 (미설정 시 해당 기능 스킵)
GEMINI_API_KEY=                           # Gemini 영상 분석 (미설정 시 분석 단계 스킵)
VMAKE_AK=                                 # vmake.ai 워터마크 제거 (미설정 시 스킵)
VMAKE_SK=
CLOVA_CLIENT_ID=                          # ElevenLabs 장애 시 폴백 TTS
CLOVA_CLIENT_SECRET=
TTS_PROVIDER=elevenlabs
YOUTUBE_TOKEN_PATH=./token.json
ADMIN_SECRET_KEY=your-secret-key
```

> **`PUBLIC_BASE_URL`** — vmake.ai 워터마크 제거·Instagram 업로드 시 **외부 서비스가 서버의 영상 파일을 직접 다운로드**하는 데 사용되는 공개 URL.
> 대시보드 영상/썸네일 표시는 `window.location.origin` 자동 감지 방식이므로 이 값과 무관하다.
> - 로컬: ngrok으로 포트 8080을 노출한 후 발급된 URL 입력 (예: `https://xxxx.ngrok.io`)
> - 프로덕션: 서버 도메인 (예: `https://yourdomain.com`)

### 3. YouTube OAuth 인증 (최초 1회)

```bash
python backend/scripts/youtube_auth.py
```

브라우저가 열리면 구글 계정으로 승인 → `token.json` 생성됨.
`token.json`과 `client_secret.json`은 절대 git에 커밋하지 말 것.

### 4. Docker 컨테이너 시작

```bash
docker-compose up -d
```

7개 서비스가 시작된다: `api`, `worker`, `beat`, `dashboard`, `redis`, `postgres`, `nginx`, `xhs-downloader`

### 5. DB 마이그레이션

```bash
docker-compose exec api alembic upgrade head
```

### 6. 관리자 계정 생성 (최초 1회)

```bash
docker-compose exec api python scripts/create_admin.py --username admin --password yourpassword
```

### 7. 동작 확인

```bash
curl http://localhost:8000/health
```

대시보드: http://localhost:8080 (nginx 통합 포트) 또는 http://localhost:3000 (Next.js 직접) → 로그인 후 사용

> **ngrok 외부 접속**: `ngrok http 8080` 으로 nginx 포트를 노출하면 ngrok URL로 접속 시 영상/썸네일이 자동으로 올바른 URL을 사용한다 (별도 설정 불필요).

---

## 인증

대시보드와 모든 API 엔드포인트(`/api/jobs`, `/api/report`)는 세션 인증이 필요하다.

- 로그인: `POST /api/auth/login` → httpOnly 쿠키 발급 (24시간 유효)
- 로그아웃: 대시보드 우상단 **로그아웃** 버튼
- 세션은 Redis에 저장됨
- `/health`, `/api/auth/*`는 공개 엔드포인트

비밀번호는 bcrypt 해싱 후 DB에 저장된다. 계정 추가/변경은 스크립트로만 가능하다:

```bash
docker-compose exec api python scripts/create_admin.py --username admin --password newpassword
```

---

## 업데이트 후 마이그레이션

코드를 pull 받은 후에는 항상 마이그레이션을 실행한다.

```bash
docker-compose exec api alembic upgrade head
```

---

## 도커 빌드
```bash
docker-compose up -d --build
```


---

## 작업 생성 옵션

대시보드에서 작업을 만들 때 아래 옵션을 선택할 수 있다. **설정값은 localStorage에 자동 저장**되어 다음 작업에도 유지된다.

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| **URL 목록** | 같은 제품 영상 1~10개 입력 | 1개 |
| **페르소나** | 대본 생성 스타일 (성장맘 / 뷰티인플루언서 / 건강맘 / 절약맘 / 라이프스타일) | 성장맘 |
| **목소리** | ElevenLabs 목소리 선택 (DB 기반 관리) | 아담 |
| **목소리 볼륨** | TTS 볼륨 (0~200%) | 100% |
| **TTS 속도** | TTS 재생 속도 (0.7~1.5x) | 1.1x |
| **자막 색상** | 자막 텍스트 색상 (color picker) | 흰색 |
| **자막 배경** | 자막 뒤 배경 색상 (토글 + color picker) | 없음 |
| **자막 폰트** | 5개 나눔 폰트 패밀리 선택 | 나눔고딕 |
| **자막 볼드** | 볼드 ON/OFF 토글 | ON |
| **자막 크기** | 폰트 크기 (32~96px 슬라이더) | 64px |
| **자막 테두리** | 테두리 색상 + 두께 (0~5) | 검정, 2 |
| **자막 그림자** | 그림자 색상 + 오프셋 + 블러 | 검정, 2, 0 |
| **자막 위치** | 10단계 수직 위치 슬라이더 | 9 (하단) |
| **BGM** | 배경음악 파일 선택 (bgm/ 디렉토리) | 없음 |
| **BGM 볼륨** | BGM 볼륨 (0~100%) | 25% |

목소리 관리: 대시보드 `/voices` 페이지에서 추가/수정/삭제.

BGM 파일 추가: 대시보드 "BGM 업로드" 버튼 또는 `bgm/` 디렉토리에 직접 복사.

---

## 품질 평가 (Evals)

파이프라인 각 단계에서 자동 품질 평가가 실행된다. 평가 결과는 작업 상세 페이지에 표시된다.

| 평가 | 시점 | 내용 |
|------|------|------|
| **대본** | 대본 생성 후 | GPT-5.2로 훅 품질, 흐름, 페르소나 일치도 1~10점 평가 |
| **TTS** | TTS 완료 후 | 음성 길이 검증 (20~40초 compliance) |
| **영상** | 렌더링 후 | 검은 화면 탐지, 오디오/비디오 싱크 확인 |

모든 평가는 **비차단** — 평가 실패 시 파이프라인은 정상 진행된다.

---

## 자주 쓰는 명령어

```bash
# 전체 재시작 (코드 변경 없을 때)
docker-compose restart

# 특정 서비스 재빌드 후 재시작 (코드 변경 시)
docker-compose up --build api
docker-compose up --build worker
docker-compose up --build dashboard

# 특정 서비스 로그 확인
docker-compose logs -f worker
docker-compose logs -f api

# 컨테이너 내부 접속
docker-compose exec api bash
docker-compose exec worker bash

# 전체 종료 (볼륨 유지)
docker-compose down

# 전체 초기화 (볼륨 포함 삭제 — DB 데이터 날아감)
docker-compose down -v
```

---

## 파이프라인 흐름

```
[대시보드에서 XHS URL 1~10개 입력]
         ↓
[extract] — XHS: xhs-downloader 사이드카 → CDN URL 직접 다운로드
           틱톡/인스타: yt-dlp 다운로드
           → temp/{job_id}/original_0.mp4, original_1.mp4, ...
         ↓
[analyze] — Gemini Flash로 영상 내용 분석 → product_info + 제목 후보
           (GEMINI_API_KEY 미설정 시 스킵)
         ↓
[remove_watermark] — vmake.ai eraser_watermark로 워터마크/자막 제거
                   (VMAKE_AK/SK 미설정 시 스킵, 실패 개별 영상은 원본 유지)
         ↓
[generate] — GPT-5.2로 대본 JSON 생성 (hook / points / cta)
              + 대본 품질 평가 (eval_scores.script)
         ↓
[tts] — ElevenLabs eleven_v3로 음성 합성 (voice_volume 적용)
        → temp/{job_id}/voice.mp3
        + TTS 길이 검증 (eval_scores.tts)
         ↓
[preview_edit] — 540p 저해상도 프리뷰 생성
         ↓
[TTS 검수 대기] — 대시보드에서 프리뷰 + 대본 수정 + 표지 프레임 선택
         ↓  ↑ (대본 수정 후 "TTS 재생성" → tts + preview_edit 재실행 가능)
[final_edit] — 1080x1920 최종 렌더 (BGM bgm_volume 적용, 자막)
              + 영상 품질 검사 (eval_scores.video)
         ↓
[검수 대기] — 대시보드에서 영상 미리보기 + 품질 평가 확인 + 승인
         ↓
[승인] → upload_instagram / upload_youtube (20~40분 랜덤 딜레이, 병렬)
```

실패한 작업은 대시보드 → 상세 → **재시도** 버튼으로 처음부터 다시 실행.

---

## 환경변수 전체 목록

`.env.example` 참조.
