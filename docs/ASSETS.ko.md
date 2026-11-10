# 글꼴과 음악

[English](ASSETS.md) · **한국어** · [简体中文](ASSETS.zh-CN.md) · [日本語](ASSETS.ja.md)

이 저장소는 글꼴이나 음악 파일을 배포하지 않습니다. 직접 추가하는 파일은 모두 사용자 책임이니,
게시할 영상에 쓰기 전에 각 파일의 라이선스를 확인하세요.

## 글꼴

### Docker 이미지에 포함된 글꼴

Debian 패키지로 설치하며, 모두 SIL Open Font License 1.1을 따릅니다.

- **나눔**(고딕, 바른고딕, 명조, 스퀘어, 스퀘어라운드) — 한글 + 라틴 문자. 자막과 표지의 기본
  글꼴은 나눔고딕 Bold입니다.
- **Noto Sans CJK** — 중국어, 일본어, 한국어. 중국어나 일본어 콘텐츠에는 이 글꼴을 고르세요.
- **Noto Color Emoji**

### 글꼴 직접 추가하기

1. `.ttf`, `.otf`, `.ttc` 파일을 `backend/fonts/`에 복사합니다.
2. 다시 빌드합니다: `docker compose up -d --build api worker beat`.
3. 자막과 표지의 글꼴 메뉴에 파일 이름으로 글꼴이 나타납니다.

글꼴이 실수로 커밋되지 않도록 `backend/fonts/`는 git에서 제외되어 있습니다.

### 추천 무료 글꼴(SIL OFL 1.1)

| 글꼴 | 적합한 용도 | 출처 |
|---|---|---|
| Black Han Sans | 굵은 한글 헤드라인 / 표지 제목 | <https://github.com/google/fonts/tree/main/ofl/blackhansans> |
| Do Hyeon | 굵고 둥근 디스플레이 텍스트 | <https://github.com/google/fonts/tree/main/ofl/dohyeon> |
| Jua | 친근하고 둥근 자막 | <https://github.com/google/fonts/tree/main/ofl/jua> |
| Pretendard | 현대적인 한글 + 라틴 본문, 9가지 굵기 | <https://github.com/orioncactus/pretendard> |
| Noto Sans KR / CJK | CJK 전체 지원 | <https://github.com/notofonts/noto-cjk> |

### 주의해야 할 글꼴

한국의 '무료 글꼴' 중에는 자체 라이선스를 쓰는 경우가 많습니다. 글꼴마다 라이선스를 꼭 읽어
보세요. 예를 들면 다음과 같습니다.

- **오피스 제품군에 포함된** 글꼴(예: 한컴오피스 글꼴)은 대개 해당 소프트웨어 안에서만 쓸 수
  있도록 허락되며, 영상 제작이나 재배포에는 쓸 수 없습니다.
- 일부 기업 무료 글꼴은 특정 업종에서의 사용을 제한하거나, 재배포할 때 출처 표기나 라이선스
  전문 첨부를 요구합니다.

## 배경 음악

오디오 파일(`.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`)은 `bgm/`에 넣거나 대시보드에서 업로드합니다.
`bgm/`은 git에서 제외되어 있습니다.

사용할 수 있는 출처는 다음과 같습니다. 곡마다 라이선스와 출처 표기 요건을 확인하세요.

| 출처 | 라이선스 |
|---|---|
| Instagram 음악 라이브러리 | Instagram 앱에서 추가하면 Instagram 안에서 사용할 권리가 확보됨 |
| [Pixabay Music](https://pixabay.com/music/) | Pixabay Content License — 상업적 무료 사용, 출처 표기 불필요 |
| [Free Music Archive](https://freemusicarchive.org) | CC0 / CC BY로 필터링 |
| [OpenGameArt](https://opengameart.org) | CC0 곡 다수 |
| [incompetech (Kevin MacLeod)](https://incompetech.com/music/royalty-free/) | CC BY 4.0 — 출처 표기 필수 |
| [공유마당(한국저작권위원회)](https://gongu.copyright.or.kr) | 자유이용 / CC / 공유저작물(퍼블릭 도메인) 음악 |

'No copyright'라는 표시가 '조건 없음'을 뜻하지는 않습니다. 예를 들어 NoCopyrightSounds는 출처
표기를 요구하며, 정책 적용 범위도 YouTube와 Twitch뿐입니다.
