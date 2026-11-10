# Legal & responsible use

**English** · [한국어](LEGAL.ko.md) · [简体中文](LEGAL.zh-CN.md) · [日本語](LEGAL.ja.md)

> **This is not legal advice.** It summarises research done in November 2026 to explain why
> some features are disabled by default. Laws and terms of service change; check the primary
> sources and consult a lawyer for your situation.

## Summary

reels-automation is a workflow tool for making short videos **from footage and audio you own
or are licensed to use**. You are solely responsible for complying with copyright law and with
the terms of every platform and API you use. Features that touch third-party platforms are
**off by default** and print a warning when enabled.

| Feature | Default | Status |
|---|---|---|
| Local video upload | on | Recommended source |
| URL import via yt-dlp (`ENABLE_URL_IMPORT`) | on | Only for videos you own or are licensed to use |
| Xiaohongshu import (`ENABLE_XHS_IMPORT`) | **off** | Platform terms prohibit it |
| Watermark removal (`ENABLE_WATERMARK_REMOVAL`) | **off** | High legal risk on third-party content; plugin not bundled |
| BGM download from URL (`ENABLE_BGM_URL_DOWNLOAD`) | **off** | Platform terms prohibit it |
| NAVER CLOVA Voice (`ENABLE_CLOVA_VOICE`) | **off** | Usage policy conflicts with this pipeline |
| OpenAI, Gemini, ElevenLabs, Instagram upload | on / optional | Subject to each provider's terms (below) |

## Watermark removal

A platform watermark usually shows the creator's username. Information that identifies the
author is **rights-management information** (RMI / CMI) under:

- **Korea** — Copyright Act Art. 104-3. Removing RMI for business or profit is punishable by up
  to 3 years' imprisonment and/or a KRW 30 million fine (Art. 136(3)(3-4)), and can be
  prosecuted without the rightholder's complaint.
- **United States** — 17 U.S.C. §1202(b): removing CMI, or distributing works knowing CMI was
  removed, when you know it will induce, enable, facilitate or conceal infringement.
- **China** — Copyright Law (2020) Art. 51 and Art. 53(7).
- **European Union** — InfoSoc Directive 2001/29/EC Art. 7.

vmake.ai's own guidance is to remove watermarks only from videos you own or have permission to
edit. Re-editing and re-publishing someone else's video is itself reproduction and adaptation
of their work, with or without a watermark.

For these reasons the vmake integration is an **optional plugin that is not bundled**: no vmake
SDK is distributed with this repository, and the step only runs when
`ENABLE_WATERMARK_REMOVAL=true`, valid vmake credentials are set and the plugin is installed.
Use it only to clean up footage you own (for example, your own exported clips).

## Importing videos

- **Xiaohongshu** — the user agreement prohibits obtaining content by scraping or "simulated
  download", using unauthorised third-party tools, and copying platform content without written
  permission. The optional sidecar, [XHS-Downloader](https://github.com/JoeanAmier/XHS-Downloader),
  is a separate GPL-3.0 project whose author forbids unauthorised downloading of copyrighted
  content and commercial promotion without written permission. It runs as a separate container
  in the opt-in `xhs` compose profile and is not part of this project's source.
- **TikTok / Instagram and other sites (yt-dlp)** — their terms generally prohibit downloading
  content and automated collection. Use URL import only for videos you own or are licensed to
  use.
- **Fair use / quotation** exceptions are narrow and decided case by case; a commercial repost
  that substitutes for the original weighs against them.

## Music

- Downloading audio from YouTube or SoundCloud breaches their terms unless the service expressly
  allows it (`ENABLE_BGM_URL_DOWNLOAD` is off by default).
- "Copyright-free" music still has licence conditions. For example, the NoCopyrightSounds policy
  requires credit and covers YouTube and Twitch, not Instagram.
- For Reels, Instagram's in-app music library is the only option fully cleared for the platform.
  See [ASSETS.md](ASSETS.md) for other sources.

## AI providers

| Provider | What to know |
|---|---|
| OpenAI | You own the output to the extent permitted by law; output may not be unique, and copyright protection of AI-generated text is uncertain. |
| Google Gemini API | On the unpaid tier, Google may use inputs and outputs to improve products and human reviewers may read them. Use a paid tier for footage you do not want reviewed; only paid services may be used for users in the EEA, UK and Switzerland. |
| ElevenLabs | Commercial use requires a paid plan. Do not clone a real person's voice without consent. |
| NAVER CLOVA Voice | The usage policy requires real-time API use and does not allow downloading, saving or editing generated files (it points to CLOVA Dubbing instead). This pipeline saves and edits the audio, so the provider is off by default. |

## Publishing to Instagram

- You warrant that you have the rights to everything you publish (Meta Platform Terms).
- Meta asks creators to label realistic AI-generated or AI-altered audio and video, including AI
  voice-overs; unlabelled content may be penalised.
- The Content Publishing API allows about 100 API-published posts per account per 24 hours.

## Korea AI Basic Act

The AI Basic Act (in force from 22 January 2026) places transparency and labelling duties on
"AI business operators". Individuals using AI output to make their own content are generally
users, not operators — but if you run this software **as a service for others** (for example as
an agency or SaaS), you may be an AI business operator and should label AI-generated output.

## Sources

- Korea Copyright Act: <https://www.law.go.kr/법령/저작권법> · MCST overview: <https://www.mcst.go.kr/site/s_policy/copyright/knowledge/know16.jsp>
- 17 U.S.C. §1202: <https://www.law.cornell.edu/uscode/text/17/1202> · MGM v. Grokster: <https://www.law.cornell.edu/supremecourt/text/04-480>
- PRC Copyright Law (2020): <https://www.wipo.int/wipolex/en/legislation/details/6471>
- InfoSoc Directive Art. 7: <https://www.legislation.gov.uk/eudr/2001/29/article/7>
- GitHub on youtube-dl: <https://github.blog/2020-11-16-standing-up-for-developers-youtube-dl-is-back/>
- vmake watermark remover guide: <https://vmake.ai/blog/vmake-watermark-remover-tool>
- XHS-Downloader: <https://github.com/JoeanAmier/XHS-Downloader>
- TikTok Terms of Service: <https://www.tiktok.com/legal/page/row/terms-of-service/en>
- Instagram Terms of Use: <https://www.facebook.com/help/instagram/termsofuse>
- YouTube Terms of Service: <https://www.youtube.com/static?template=terms>
- SoundCloud Terms of Use: <https://soundcloud.com/terms-of-use>
- NCS usage policy: <https://ncs.io/usage-policy>
- OpenAI Terms of Use: <https://openai.com/policies/terms-of-use/>
- Gemini API Additional Terms: <https://ai.google.dev/gemini-api/terms>
- ElevenLabs: <https://elevenlabs.io/use-policy>
- CLOVA Voice usage policy: <https://guide.ncloud-docs.com/docs/clovavoice-policy>
- Meta Platform Terms: <https://developers.facebook.com/terms> · Instagram content publishing: <https://developers.facebook.com/docs/instagram-platform/content-publishing/>
- Meta AI labelling: <https://about.fb.com/news/2024/02/labeling-ai-generated-images-on-facebook-instagram-and-threads/>
