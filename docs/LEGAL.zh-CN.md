# 法律与合规使用

[English](LEGAL.md) · [한국어](LEGAL.ko.md) · **简体中文** · [日本語](LEGAL.ja.md)

> **本文不构成法律意见。** 本文总结了 2026 年 11 月所做的调研，用于说明部分功能为何默认关闭。
> 法律和服务条款可能会发生变化；请查阅原始资料，并就你的具体情况咨询律师。

## 概要

reels-automation 是一款工作流工具，用于以**你拥有或已获授权使用的素材和音频**制作短视频。
你须自行负责遵守著作权法以及你所使用的每个平台和 API 的条款。涉及第三方平台的功能
**默认关闭**，启用时会输出警告。

| 功能 | 默认 | 状态 |
|---|---|---|
| 本地视频上传 | 开启 | 推荐的素材来源 |
| 通过 yt-dlp 进行 URL 导入（`ENABLE_URL_IMPORT`） | 开启 | 仅限你拥有或已获授权使用的视频 |
| 小红书导入（`ENABLE_XHS_IMPORT`） | **关闭** | 平台条款禁止 |
| 水印 / 字幕去除 | **未包含** | 用于第三方内容时法律风险高——见下文 |
| 从 URL 下载 BGM（`ENABLE_BGM_URL_DOWNLOAD`） | **关闭** | 平台条款禁止 |
| NAVER CLOVA Voice（`ENABLE_CLOVA_VOICE`） | **关闭** | 使用政策与本流水线冲突 |
| OpenAI、Gemini、ElevenLabs、Instagram 上传 | 开启 / 可选 | 受各提供商条款约束（见下文） |

## 水印去除

平台水印通常会显示创作者的用户名。能够识别作者身份的信息，依据以下法律属于
**权利管理信息**（RMI / CMI）：

- **韩国** —— 韩国《著作权法》第104条之3。以营业或营利为目的去除权利管理信息的，
  可处 3 年以下有期徒刑和/或 3000 万韩元以下罚金（第136条第3款第3项之4），
  且无需权利人告诉即可提起公诉。
- **美国** —— 美国法典第17编第1202条(b)款：在明知会引诱、促成、便利或掩盖侵权的情况下，
  去除版权管理信息，或在明知版权管理信息已被去除的情况下发行作品。
- **中国** —— 《中华人民共和国著作权法》（2020 年）第五十一条、第五十三条第（七）项。
- **欧盟** —— 欧盟《信息社会版权指令》2001/29/EC 第7条。

vmake.ai 自身的指引是：只对你拥有或已获编辑许可的视频去除水印。无论是否带有水印，
重新剪辑并重新发布他人的视频，本身就构成对其作品的复制和改编。

基于上述原因，本项目**不包含水印去除步骤**。
[EXTENDING.zh-CN.md](EXTENDING.zh-CN.md) 说明了可以在哪里添加你自己的处理步骤（例如使用 vmake.ai CLI）——
如果你这样做，请仅将其用于你拥有或已获编辑许可的素材，例如你自己导出的片段。

## 导入视频

- **小红书（Xiaohongshu）** —— 《小红书用户服务协议》禁止通过抓取或"模拟下载"方式获取内容、
  使用未经授权的第三方工具，以及未经书面许可复制平台内容。可选的边车容器
  [XHS-Downloader](https://github.com/JoeanAmier/XHS-Downloader) 是一个独立的 GPL-3.0 项目，
  其作者禁止未经授权下载受版权保护的内容，以及未经书面许可用于商业推广。
  它作为独立容器运行于需手动启用的 `xhs` compose profile 中，不属于本项目源代码的一部分。
- **TikTok / Instagram 及其他网站（yt-dlp）** —— 这些平台的条款通常禁止下载内容和自动化采集。
  请仅对你拥有或已获授权使用的视频使用 URL 导入功能。
- **合理使用 / 引用**等例外情形范围很窄，需个案判断；替代原作的商业性转载不利于主张这些例外。

## 音乐

- 除非服务方明确允许，否则从 YouTube 或 SoundCloud 下载音频即违反其条款
  （`ENABLE_BGM_URL_DOWNLOAD` 默认关闭）。
- "无版权"音乐同样附有许可条件。例如，NoCopyrightSounds 的政策要求署名，
  且适用范围为 YouTube 和 Twitch，不包括 Instagram。
- 对于 Reels，Instagram 应用内音乐库是唯一在该平台上完全获得授权的选项。
  其他来源见 [ASSETS.zh-CN.md](ASSETS.zh-CN.md)。

## AI 提供商

| 提供商 | 须知事项 |
|---|---|
| OpenAI | 在法律允许的范围内，你拥有输出内容；输出可能并不唯一，且 AI 生成文本能否受著作权保护尚不确定。 |
| Google Gemini API | 在免费层级中，Google 可能使用输入和输出来改进产品，且可能由人工审阅者阅读。对于不希望被审阅的素材，请使用付费层级；面向欧洲经济区（EEA）、英国和瑞士的用户只能使用付费服务。 |
| ElevenLabs | 商业使用需要付费套餐。未经同意，不得克隆真实人物的声音。 |
| NAVER CLOVA Voice | 其使用政策要求实时调用 API，不允许下载、保存或编辑生成的文件（并建议改用 CLOVA Dubbing）。本流水线会保存并编辑音频，因此该提供商默认关闭。 |

## 发布到 Instagram

- 你需保证对所发布的全部内容拥有相应权利（Meta 平台条款）。
- Meta 要求创作者对逼真的 AI 生成或经 AI 修改的音频和视频（包括 AI 配音）进行标注；
  未标注的内容可能会受到处罚。
- Content Publishing API 允许每个账号每 24 小时通过 API 发布约 100 条帖子。

## 韩国《人工智能基本法》

韩国《人工智能基本法》（自 2026 年 1 月 22 日起施行）对"人工智能经营者"规定了透明度和标注义务。
使用 AI 输出制作自己内容的个人通常属于使用者而非经营者 —— 但如果你**以服务形式为他人**运行本软件
（例如作为代理机构或 SaaS），你可能属于人工智能经营者，应当对 AI 生成的输出进行标注。

## 资料来源

- 韩国《著作权法》：<https://www.law.go.kr/법령/저작권법> · 韩国文化体育观光部（MCST）概述：<https://www.mcst.go.kr/site/s_policy/copyright/knowledge/know16.jsp>
- 美国法典第17编第1202条：<https://www.law.cornell.edu/uscode/text/17/1202> · MGM v. Grokster：<https://www.law.cornell.edu/supremecourt/text/04-480>
- 《中华人民共和国著作权法》（2020 年）：<https://www.wipo.int/wipolex/en/legislation/details/6471>
- 《信息社会版权指令》第7条：<https://www.legislation.gov.uk/eudr/2001/29/article/7>
- GitHub 关于 youtube-dl 的说明：<https://github.blog/2020-11-16-standing-up-for-developers-youtube-dl-is-back/>
- vmake 水印去除工具指南：<https://vmake.ai/blog/vmake-watermark-remover-tool>
- XHS-Downloader：<https://github.com/JoeanAmier/XHS-Downloader>
- TikTok 服务条款：<https://www.tiktok.com/legal/page/row/terms-of-service/en>
- Instagram 使用条款：<https://www.facebook.com/help/instagram/termsofuse>
- YouTube 服务条款：<https://www.youtube.com/static?template=terms>
- SoundCloud 使用条款：<https://soundcloud.com/terms-of-use>
- NCS 使用政策：<https://ncs.io/usage-policy>
- OpenAI 使用条款：<https://openai.com/policies/terms-of-use/>
- Gemini API 附加条款：<https://ai.google.dev/gemini-api/terms>
- ElevenLabs：<https://elevenlabs.io/use-policy>
- CLOVA Voice 使用政策：<https://guide.ncloud-docs.com/docs/clovavoice-policy>
- Meta 平台条款：<https://developers.facebook.com/terms> · Instagram 内容发布：<https://developers.facebook.com/docs/instagram-platform/content-publishing/>
- Meta AI 内容标注：<https://about.fb.com/news/2024/02/labeling-ai-generated-images-on-facebook-instagram-and-threads/>
