# 法的事項と責任ある利用

[English](LEGAL.md) · [한국어](LEGAL.ko.md) · [简体中文](LEGAL.zh-CN.md) · **日本語**

> **本文書は法的助言ではありません。** 一部の機能をデフォルトで無効にしている理由を説明するため、
> 2026 年 11 月に行った調査の内容をまとめたものです。法令や利用規約は変更されることがあります。
> 一次資料を確認し、ご自身の状況については弁護士にご相談ください。

## 概要

reels-automation は、**自身が所有する、または利用許諾を得ている映像・音声**からショート動画を
作成するためのワークフローツールです。著作権法、および利用するすべてのプラットフォームと API の
規約を遵守する責任は、利用者のみが負います。サードパーティのプラットフォームに関わる機能は
**デフォルトで無効**であり、有効にすると警告が表示されます。

| 機能 | デフォルト | 状況 |
|---|---|---|
| ローカル動画のアップロード | 有効 | 推奨されるソース |
| yt-dlp による URL 取り込み（`ENABLE_URL_IMPORT`） | 有効 | 自身が所有する、または利用許諾を得ている動画に限る |
| 小紅書（Xiaohongshu）の取り込み（`ENABLE_XHS_IMPORT`） | **無効** | プラットフォームの規約で禁止 |
| ウォーターマーク／字幕の除去 | **含まれていない** | 第三者のコンテンツでは法的リスクが高い（後述） |
| URL からの BGM ダウンロード（`ENABLE_BGM_URL_DOWNLOAD`） | **無効** | プラットフォームの規約で禁止 |
| NAVER CLOVA Voice（`ENABLE_CLOVA_VOICE`） | **無効** | 利用ポリシーが本パイプラインと両立しない |
| OpenAI、Gemini、ElevenLabs、Instagram へのアップロード | 有効／任意 | 各プロバイダーの規約に従う（後述） |

## ウォーターマーク除去

プラットフォームのウォーターマークには、通常クリエイターのユーザー名が表示されています。
著作者を識別する情報は、以下の法令における**権利管理情報**（RMI / CMI）に該当します。

- **韓国** — 著作権法第104条の3。業として、または営利を目的として権利管理情報を除去した場合、
  3 年以下の懲役もしくは 3,000 万ウォン（KRW 30 million）以下の罰金、またはその併科に処される
  可能性があり（第136条(3)(3-4)）、権利者の告訴がなくても起訴され得ます。
- **米国** — 米国著作権法 17 U.S.C. §1202(b)：侵害を誘発・可能化・助長・隠蔽することを知りながら、
  CMI を除去すること、または CMI が除去されたことを知りながら著作物を頒布すること。
- **中国** — 中国著作権法（2020 年）第51条・第53条第7号。
- **欧州連合** — EU情報社会指令 2001/29/EC 第7条。

vmake.ai 自身のガイダンスでも、ウォーターマークの除去は自身が所有する動画、または編集の許可を
得ている動画に限るとされています。他人の動画を再編集して再公開すること自体が、ウォーターマークの
有無にかかわらず、その著作物の複製および翻案にあたります。

以上の理由から、本プロジェクトには**ウォーターマーク除去のステップは含まれていません**。
独自の処理ステップ（例えば vmake.ai CLI を使ったもの）を追加できる場所は
[EXTENDING.ja.md](EXTENDING.ja.md) で説明しています。追加する場合は、自身が所有する映像、または
編集の許諾を得ている映像（例えば、自分で書き出したクリップ）にのみ使用してください。

## 動画の取り込み

- **小紅書（Xiaohongshu）** — ユーザー規約は、スクレイピングや「疑似ダウンロード」によるコンテンツの
  取得、許可されていないサードパーティ製ツールの使用、および書面による許可のないプラットフォーム
  コンテンツの複製を禁止しています。任意のサイドカーである
  [XHS-Downloader](https://github.com/JoeanAmier/XHS-Downloader) は GPL-3.0 の別プロジェクトであり、
  その作者は、著作権で保護されたコンテンツの無断ダウンロード、および書面による許可のない商用
  プロモーションを禁じています。これはオプトインの `xhs` compose プロファイル内で別コンテナとして
  動作し、本プロジェクトのソースには含まれません。
- **TikTok / Instagram およびその他のサイト（yt-dlp）** — これらの規約は、一般にコンテンツの
  ダウンロードと自動収集を禁止しています。URL 取り込みは、自身が所有する、または利用許諾を得ている
  動画にのみ使用してください。
- **フェアユース／引用**の例外は範囲が狭く、個別の事案ごとに判断されます。原作品の代替となるような
  商用目的の再投稿は、これらの例外の適用に不利に働きます。

## 音楽

- YouTube や SoundCloud から音声をダウンロードすることは、サービスが明示的に許可している場合を除き、
  それらの規約違反となります（`ENABLE_BGM_URL_DOWNLOAD` はデフォルトで無効）。
- 「著作権フリー」の音楽にもライセンス条件があります。例えば、NoCopyrightSounds のポリシーは
  クレジット表記を求めており、対象は YouTube と Twitch であって Instagram は含まれません。
- リールの場合、プラットフォーム上での利用について完全に権利処理されているのは、Instagram の
  アプリ内音楽ライブラリのみです。その他の入手先は [ASSETS.ja.md](ASSETS.ja.md) を参照してください。

## AIプロバイダー

| プロバイダー | 知っておくべきこと |
|---|---|
| OpenAI | 法律で認められる範囲で出力は利用者に帰属します。出力は一意とは限らず、AI 生成テキストの著作権保護は不確実です。 |
| Google Gemini API | 無料枠では、Google が製品改善のために入力と出力を利用し、人間のレビュアーがそれらを閲覧する場合があります。レビューされたくない映像には有料枠を使用してください。EEA、英国、スイスのユーザー向けには有料サービスのみ利用できます。 |
| ElevenLabs | 商用利用には有料プランが必要です。実在の人物の声を同意なくクローンしないでください。 |
| NAVER CLOVA Voice | 利用ポリシーはリアルタイムでの API 利用を求めており、生成ファイルのダウンロード・保存・編集を認めていません（代わりに CLOVA Dubbing を案内しています）。本パイプラインは音声を保存・編集するため、このプロバイダーはデフォルトで無効です。 |

## Instagram への公開

- 公開するすべてのものについて、利用者が権利を有していることを保証するものとされます（Meta
  プラットフォーム規約）。
- Meta はクリエイターに対し、AI ナレーションを含め、リアルな AI 生成または AI 加工の音声・動画に
  ラベルを付けるよう求めています。ラベルのないコンテンツはペナルティを受ける可能性があります。
- Content Publishing API で公開できる投稿は、1 アカウントあたり 24 時間で約 100 件です。

## 韓国「人工知能基本法」

韓国「人工知能基本法」（2026 年 1 月 22 日施行）は、「人工知能事業者」に透明性確保および表示の
義務を課しています。AI の出力を使って自分のコンテンツを作成する個人は、一般に事業者ではなく
利用者にあたります。ただし、本ソフトウェアを**他者向けのサービスとして**運営する場合（例えば
代理店や SaaS として）は人工知能事業者に該当する可能性があり、AI 生成物であることを表示すべきです。

## 出典

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
