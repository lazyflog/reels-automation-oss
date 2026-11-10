# 법적 고지와 책임 있는 사용

[English](LEGAL.md) · **한국어** · [简体中文](LEGAL.zh-CN.md) · [日本語](LEGAL.ja.md)

> **이 문서는 법률 자문이 아닙니다.** 일부 기능을 기본적으로 꺼 둔 이유를 설명하기 위해
> 2026년 11월에 조사한 내용을 요약했습니다. 법령과 이용약관은 바뀔 수 있으니 원문을 직접
> 확인하고, 구체적인 상황은 변호사와 상담하세요.

## 요약

reels-automation은 **본인이 소유하거나 사용 허락을 받은 영상과 오디오**로 숏폼 영상을 만드는
워크플로 도구입니다. 저작권법과 사용하는 모든 플랫폼·API의 약관을 지킬 책임은 전적으로
사용자에게 있습니다. 서드파티 플랫폼에 접근하는 기능은 **기본적으로 꺼져 있으며**, 켜면
경고를 출력합니다.

| 기능 | 기본값 | 상태 |
|---|---|---|
| 로컬 영상 업로드 | 켜짐 | 권장 소스 |
| yt-dlp를 이용한 URL 가져오기(`ENABLE_URL_IMPORT`) | 켜짐 | 본인 소유 또는 사용 허락을 받은 영상에만 사용 |
| 샤오훙슈 가져오기(`ENABLE_XHS_IMPORT`) | **꺼짐** | 플랫폼 약관상 금지 |
| 워터마크 / 자막 제거 | **포함하지 않음** | 타인 콘텐츠에 사용 시 법적 위험이 큼 — 아래 참고 |
| URL에서 BGM 다운로드(`ENABLE_BGM_URL_DOWNLOAD`) | **꺼짐** | 플랫폼 약관상 금지 |
| NAVER CLOVA Voice(`ENABLE_CLOVA_VOICE`) | **꺼짐** | 이용 정책이 이 파이프라인과 맞지 않음 |
| OpenAI, Gemini, ElevenLabs, Instagram 업로드 | 켜짐 / 선택 | 각 제공업체 약관 적용(아래 참고) |

## 워터마크 제거

플랫폼 워터마크에는 보통 크리에이터의 사용자 이름이 표시됩니다. 저작자를 식별하는 정보는
다음 법령상 **권리관리정보**(RMI / CMI)에 해당합니다.

- **한국** — 저작권법 제104조의3. 영리를 목적으로 또는 업으로 권리관리정보를 제거하면 3년
  이하의 징역 또는 3천만 원 이하의 벌금에 처하거나 이를 병과할 수 있으며(제136조 제3항
  제3호의4), 권리자의 고소 없이도 기소될 수 있습니다.
- **미국** — 17 U.S.C. §1202(b): 침해를 유발·가능하게·용이하게 하거나 은폐하게 된다는 사실을
  알면서 CMI를 제거하거나, CMI가 제거된 사실을 알면서 저작물을 배포하는 행위.
- **중국** — 저작권법(2020) 제51조 및 제53조 제7호.
- **유럽연합** — 정보사회지침(InfoSoc Directive) 2001/29/EC 제7조.

vmake.ai도 본인 소유 영상이나 편집 허락을 받은 영상에서만 워터마크를 제거하라고 안내합니다.
워터마크가 있든 없든, 다른 사람의 영상을 다시 편집해 게시하는 행위 자체가 그 저작물의 복제와
개작에 해당합니다.

이런 이유로 이 프로젝트에는 **워터마크 제거 단계가 포함되어 있지 않습니다**.
직접 처리 단계를 추가할 수 있는 위치(예: vmake.ai CLI 사용)는 [EXTENDING.ko.md](EXTENDING.ko.md)에서
설명합니다. 이런 단계를 추가한다면 본인 소유 영상이나 편집 허락을 받은 영상(예: 직접 내보낸
클립)에만 사용하세요.

## 영상 가져오기

- **샤오훙슈** — 이용자 약관은 스크래핑이나 '모의 다운로드'로 콘텐츠를 취득하는 행위, 승인받지
  않은 서드파티 도구 사용, 서면 허락 없이 플랫폼 콘텐츠를 복제하는 행위를 금지합니다. 선택형
  사이드카인 [XHS-Downloader](https://github.com/JoeanAmier/XHS-Downloader)는 GPL-3.0을 따르는
  별도 프로젝트로, 개발자가 저작권 있는 콘텐츠의 무단 다운로드와 서면 허락 없는 상업적 홍보를
  금지하고 있습니다. 이 사이드카는 선택(옵트인) 기능인 `xhs` compose 프로필에서 별도 컨테이너로
  실행되며, 이 프로젝트의 소스 코드에 포함되지 않습니다.
- **TikTok / Instagram 등 기타 사이트(yt-dlp)** — 대체로 약관에서 콘텐츠 다운로드와 자동 수집을
  금지합니다. URL 가져오기는 본인 소유 또는 사용 허락을 받은 영상에만 사용하세요.
- **공정 이용 / 인용** 예외는 범위가 좁고 사안별로 판단합니다. 원본을 대체하는 상업적 재게시는
  예외를 인정받는 데 불리하게 작용합니다.

## 음악

- 서비스가 명시적으로 허용하지 않는 한, YouTube나 SoundCloud에서 오디오를 내려받으면 약관
  위반입니다(`ENABLE_BGM_URL_DOWNLOAD`는 기본적으로 꺼져 있습니다).
- '저작권 없는' 음악에도 라이선스 조건이 있습니다. 예를 들어 NoCopyrightSounds 정책은 출처
  표기를 요구하며, 적용 범위도 Instagram이 아닌 YouTube와 Twitch입니다.
- 릴스에서는 Instagram 앱 내 음악 라이브러리만이 플랫폼 사용 권리가 완전히 확보된 유일한
  선택지입니다. 다른 출처는 [ASSETS.ko.md](ASSETS.ko.md)를 참고하세요.

## AI 제공업체

| 제공업체 | 알아 둘 점 |
|---|---|
| OpenAI | 법이 허용하는 범위에서 출력물은 사용자 소유입니다. 출력물이 고유하지 않을 수 있으며, AI 생성 텍스트의 저작권 보호 여부는 불확실합니다. |
| Google Gemini API | 무료 등급에서는 Google이 제품 개선에 입력과 출력을 활용할 수 있고, 사람 검토자가 이를 읽을 수 있습니다. 검토되기를 원하지 않는 영상에는 유료 등급을 사용하세요. EEA, 영국, 스위스 사용자를 대상으로는 유료 서비스만 사용할 수 있습니다. |
| ElevenLabs | 상업적으로 사용하려면 유료 요금제가 필요합니다. 동의 없이 실존 인물의 목소리를 복제하지 마세요. |
| NAVER CLOVA Voice | 이용 정책상 실시간 API 사용이 원칙이며, 생성된 파일의 다운로드·저장·편집을 허용하지 않습니다(대신 CLOVA Dubbing을 안내합니다). 이 파이프라인은 오디오를 저장하고 편집하므로 이 제공업체는 기본적으로 꺼져 있습니다. |

## Instagram 게시

- 게시하는 모든 콘텐츠에 대한 권리를 보유하고 있음을 사용자가 보증합니다(Meta 플랫폼 약관).
- Meta는 크리에이터에게 AI 내레이션을 포함해 실제와 구분하기 어려운 AI 생성·변형 오디오와
  영상에 라벨을 붙이도록 요구합니다. 라벨이 없는 콘텐츠는 불이익을 받을 수 있습니다.
- Content Publishing API로는 계정당 24시간에 약 100개까지 게시할 수 있습니다.

## 한국 인공지능기본법

인공지능기본법(2026년 1월 22일 시행)은 '인공지능사업자'에게 투명성 확보와 표시 의무를
부과합니다. AI 출력물로 자기 콘텐츠를 만드는 개인은 일반적으로 사업자가 아닌 이용자에
해당합니다. 하지만 이 소프트웨어를 **다른 사람을 위한 서비스로** 운영한다면(예: 대행사나
SaaS) 인공지능사업자에 해당할 수 있으므로, AI 생성 결과물에 표시를 해야 합니다.

## 출처

- 한국 저작권법: <https://www.law.go.kr/법령/저작권법> · 문화체육관광부 개요: <https://www.mcst.go.kr/site/s_policy/copyright/knowledge/know16.jsp>
- 17 U.S.C. §1202: <https://www.law.cornell.edu/uscode/text/17/1202> · MGM v. Grokster: <https://www.law.cornell.edu/supremecourt/text/04-480>
- 중국 저작권법(2020): <https://www.wipo.int/wipolex/en/legislation/details/6471>
- 정보사회지침 제7조: <https://www.legislation.gov.uk/eudr/2001/29/article/7>
- youtube-dl에 관한 GitHub 입장: <https://github.blog/2020-11-16-standing-up-for-developers-youtube-dl-is-back/>
- vmake 워터마크 제거 도구 안내: <https://vmake.ai/blog/vmake-watermark-remover-tool>
- XHS-Downloader: <https://github.com/JoeanAmier/XHS-Downloader>
- TikTok 서비스 약관: <https://www.tiktok.com/legal/page/row/terms-of-service/en>
- Instagram 이용 약관: <https://www.facebook.com/help/instagram/termsofuse>
- YouTube 서비스 약관: <https://www.youtube.com/static?template=terms>
- SoundCloud 이용 약관: <https://soundcloud.com/terms-of-use>
- NCS 이용 정책: <https://ncs.io/usage-policy>
- OpenAI 이용 약관: <https://openai.com/policies/terms-of-use/>
- Gemini API 추가 약관: <https://ai.google.dev/gemini-api/terms>
- ElevenLabs: <https://elevenlabs.io/use-policy>
- CLOVA Voice 이용 정책: <https://guide.ncloud-docs.com/docs/clovavoice-policy>
- Meta 플랫폼 약관: <https://developers.facebook.com/terms> · Instagram 콘텐츠 게시: <https://developers.facebook.com/docs/instagram-platform/content-publishing/>
- Meta AI 라벨 정책: <https://about.fb.com/news/2024/02/labeling-ai-generated-images-on-facebook-instagram-and-threads/>
