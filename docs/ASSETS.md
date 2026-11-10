# Fonts and music

**English** · [한국어](ASSETS.ko.md) · [简体中文](ASSETS.zh-CN.md) · [日本語](ASSETS.ja.md)

This repository does not distribute any font or music files. Everything you add is your
responsibility — check each licence before you use it in published videos.

## Fonts

### Included in the Docker image

Installed from Debian packages, all under the SIL Open Font License 1.1:

- **Nanum** (Gothic, Barun Gothic, Myeongjo, Square, Square Round) — Korean + Latin. The
  default subtitle and cover font is Nanum Gothic Bold.
- **Noto Sans CJK** — Chinese, Japanese and Korean. Choose it for Chinese or Japanese content.
- **Noto Color Emoji**

### Adding your own

1. Copy `.ttf`, `.otf` or `.ttc` files into `backend/fonts/`.
2. Rebuild: `docker compose up -d --build api worker beat`.
3. The fonts appear in the subtitle and cover font menus, named after the file.

`backend/fonts/` is git-ignored so that fonts are not committed by accident.

### Recommended free fonts (SIL OFL 1.1)

| Font | Good for | Source |
|---|---|---|
| Black Han Sans | Heavy Korean headlines / cover titles | <https://github.com/google/fonts/tree/main/ofl/blackhansans> |
| Do Hyeon | Bold, rounded display text | <https://github.com/google/fonts/tree/main/ofl/dohyeon> |
| Jua | Friendly, rounded subtitles | <https://github.com/google/fonts/tree/main/ofl/jua> |
| Pretendard | Modern Korean + Latin text, 9 weights | <https://github.com/orioncactus/pretendard> |
| Noto Sans KR / CJK | Full CJK coverage | <https://github.com/notofonts/noto-cjk> |

### Fonts to be careful with

Many Korean "free fonts" use custom licences. Read the licence of each font; for example:

- Fonts **bundled with office suites** (e.g. Hancom Office fonts) are usually licensed only for
  use inside that software — not for video production or redistribution.
- Some corporate free fonts restrict certain industries or require attribution or the full
  licence text when redistributed.

## Background music

Put audio files (`.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`) in `bgm/` or upload them from the
dashboard. `bgm/` is git-ignored.

Possible sources — check each track's licence and attribution requirements:

| Source | Licence |
|---|---|
| Instagram music library | Cleared for use inside Instagram when added in the Instagram app |
| [Pixabay Music](https://pixabay.com/music/) | Pixabay Content License — free commercial use, no attribution |
| [Free Music Archive](https://freemusicarchive.org) | Filter for CC0 / CC BY |
| [OpenGameArt](https://opengameart.org) | Many CC0 tracks |
| [incompetech (Kevin MacLeod)](https://incompetech.com/music/royalty-free/) | CC BY 4.0 — attribution required |
| [공유마당 (Korea Copyright Commission)](https://gongu.copyright.or.kr) | Free-use / CC / public-domain music |

"No copyright" labels do not mean "no conditions" — for example, NoCopyrightSounds requires
credit and its policy covers YouTube and Twitch only.
