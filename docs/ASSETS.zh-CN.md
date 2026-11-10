# 字体和音乐

[English](ASSETS.md) · [한국어](ASSETS.ko.md) · **简体中文** · [日本語](ASSETS.ja.md)

本仓库不分发任何字体或音乐文件。你添加的所有文件均由你自行负责 —— 在将其用于发布的视频之前，
请逐一确认其许可协议。

## 字体

### Docker 镜像中已包含

通过 Debian 软件包安装，均采用 SIL Open Font License 1.1：

- **Nanum**（Gothic、Barun Gothic、Myeongjo、Square、Square Round）—— 韩文 + 拉丁字母。
  字幕和封面的默认字体为 Nanum Gothic Bold。
- **Noto Sans CJK** —— 中文、日文和韩文。制作中文或日文内容时请选择此字体。
- **Noto Color Emoji**

### 添加自己的字体

1. 将 `.ttf`、`.otf` 或 `.ttc` 文件复制到 `backend/fonts/`。
2. 重新构建：`docker compose up -d --build api worker beat`。
3. 字体会以文件名出现在字幕和封面的字体菜单中。

`backend/fonts/` 已被 git 忽略，以免字体被意外提交。

### 推荐的免费字体（SIL OFL 1.1）

| 字体 | 适用场景 | 来源 |
|---|---|---|
| Black Han Sans | 粗重的韩文标题 / 封面标题 | <https://github.com/google/fonts/tree/main/ofl/blackhansans> |
| Do Hyeon | 粗体圆润的展示文字 | <https://github.com/google/fonts/tree/main/ofl/dohyeon> |
| Jua | 亲切、圆润的字幕 | <https://github.com/google/fonts/tree/main/ofl/jua> |
| Pretendard | 现代风格的韩文 + 拉丁字母正文，9 种字重 | <https://github.com/orioncactus/pretendard> |
| Noto Sans KR / CJK | 完整覆盖 CJK 字符 | <https://github.com/notofonts/noto-cjk> |

### 需要谨慎使用的字体

许多韩文"免费字体"采用自定义许可协议。请阅读每款字体的许可协议，例如：

- **随办公套件附带**的字体（例如韩文办公软件 Hancom Office 的字体）通常仅授权在该软件内使用 ——
  不可用于视频制作或再分发。
- 部分企业发布的免费字体会限制特定行业使用，或要求在再分发时注明出处或附上完整的许可协议文本。

## 背景音乐

将音频文件（`.mp3`、`.wav`、`.m4a`、`.aac`、`.ogg`）放入 `bgm/`，或在控制台中上传。
`bgm/` 已被 git 忽略。

可选来源 —— 请确认每首曲目的许可协议和署名要求：

| 来源 | 许可协议 |
|---|---|
| Instagram 音乐库 | 在 Instagram 应用内添加时，可在 Instagram 内使用 |
| [Pixabay Music](https://pixabay.com/music/) | Pixabay Content License —— 可免费商用，无需署名 |
| [Free Music Archive](https://freemusicarchive.org) | 筛选 CC0 / CC BY |
| [OpenGameArt](https://opengameart.org) | 大量 CC0 曲目 |
| [incompetech (Kevin MacLeod)](https://incompetech.com/music/royalty-free/) | CC BY 4.0 —— 需要署名 |
| [공유마당 (Korea Copyright Commission)](https://gongu.copyright.or.kr) | 可自由使用 / CC / 公有领域音乐 |

"无版权"标签并不意味着"无条件" —— 例如，NoCopyrightSounds 要求署名，
且其政策仅适用于 YouTube 和 Twitch。
