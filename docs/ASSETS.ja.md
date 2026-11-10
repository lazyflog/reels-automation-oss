# フォントと音楽

[English](ASSETS.md) · [한국어](ASSETS.ko.md) · [简体中文](ASSETS.zh-CN.md) · **日本語**

本リポジトリでは、フォントや音楽ファイルを一切配布していません。追加するものはすべて利用者の
責任となります。公開する動画で使用する前に、それぞれのライセンスを確認してください。

## フォント

### Docker イメージに含まれるもの

Debian パッケージからインストールされ、すべて SIL Open Font License 1.1 で提供されています。

- **Nanum**（Gothic、Barun Gothic、Myeongjo、Square、Square Round）— 韓国語＋ラテン文字。
  字幕とカバーのデフォルトフォントは Nanum Gothic Bold です。
- **Noto Sans CJK** — 中国語・日本語・韓国語。中国語や日本語のコンテンツにはこちらを選択してください。
- **Noto Color Emoji**

### 独自フォントの追加

1. `.ttf`、`.otf`、`.ttc` ファイルを `backend/fonts/` にコピーします。
2. 再ビルドします：`docker compose up -d --build api worker beat`。
3. 字幕とカバーのフォントメニューに、ファイル名で表示されます。

フォントが誤ってコミットされないよう、`backend/fonts/` は git の管理対象外（git-ignore）に
なっています。

### おすすめの無料フォント（SIL OFL 1.1）

| フォント | 適した用途 | 入手先 |
|---|---|---|
| Black Han Sans | 太い韓国語見出し／カバータイトル | <https://github.com/google/fonts/tree/main/ofl/blackhansans> |
| Do Hyeon | 太く丸みのあるディスプレイ用テキスト | <https://github.com/google/fonts/tree/main/ofl/dohyeon> |
| Jua | 親しみやすい丸みのある字幕 | <https://github.com/google/fonts/tree/main/ofl/jua> |
| Pretendard | モダンな韓国語＋ラテン文字、9 ウェイト | <https://github.com/orioncactus/pretendard> |
| Noto Sans KR / CJK | CJK を完全にカバー | <https://github.com/notofonts/noto-cjk> |

### 注意が必要なフォント

韓国の「無料フォント」の多くは独自のライセンスを採用しています。フォントごとにライセンスを
読んでください。例えば次のようなものがあります。

- **オフィススイートに付属する**フォント（例：Hancom Office のフォント）は、通常そのソフトウェア
  内での使用に限ってライセンスされており、動画制作や再配布には使用できません。
- 企業が提供する無料フォントの中には、特定の業種での使用を制限するものや、再配布時にクレジット
  表記やライセンス全文の添付を求めるものがあります。

## BGM

音声ファイル（`.mp3`、`.wav`、`.m4a`、`.aac`、`.ogg`）は `bgm/` に配置するか、ダッシュボードから
アップロードしてください。`bgm/` は git の管理対象外です。

入手先の候補です。トラックごとにライセンスとクレジット表記の要件を確認してください。

| 入手先 | ライセンス |
|---|---|
| Instagram 音楽ライブラリ | Instagram アプリ内で追加した場合、Instagram 内での利用について権利処理済み |
| [Pixabay Music](https://pixabay.com/music/) | Pixabay Content License — 商用利用無料、クレジット表記不要 |
| [Free Music Archive](https://freemusicarchive.org) | CC0 / CC BY で絞り込み |
| [OpenGameArt](https://opengameart.org) | CC0 のトラックが多数 |
| [incompetech (Kevin MacLeod)](https://incompetech.com/music/royalty-free/) | CC BY 4.0 — クレジット表記が必要 |
| [공유마당（韓国著作権委員会）](https://gongu.copyright.or.kr) | 自由利用／CC／パブリックドメインの音楽 |

「No copyright」という表示は「条件がない」という意味ではありません。例えば、NoCopyrightSounds は
クレジット表記を求めており、そのポリシーの対象は YouTube と Twitch のみです。
