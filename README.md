# Blocker Board

仕様書のノートに残っている空欄(`{{…}}`)と、その空欄が止めている作業のフェーズを、右サイドバーの一覧に出す Obsidian プラグインです。ノートは読むだけで 1 つも書き換えず、ネットワークにも出ません。PC とモバイル(iPhone・Android)の両方に向けて作ってあります。

画面に出る「実物待ち」は、後から貼るつもりの材料(コマンドの出力・実機で見た値など。画面では「実物」と呼びます)が、まだ貼られていない状態のことです。

*English summary is at the bottom.*

## できること

- **空欄の一覧**: 設定したフォルダの下の仕様書を全部読み、§8(`## 8. …` の節)に残っている `{{…}}` を、仕様書ごと・小節ごとに数えます。
- **止めているフェーズ**: 小節ごとに「Phase 1(§12 の表)」のように、その空欄が埋まるまで始められないフェーズと、それをどこから読んだかを出します。読めないときは推定せず「読み取れず」と出します。
- **未確認の行**: §13(`## 13. …` の節)の表と箇条書きから、印の文字(既定は「未確認」)を含む行を拾います。
- **行へ移動**: 小節の行・未確認の行を押すと、仕様書を開いてその行にカーソルを置きます。
- **実装状態で 3 つの組に分ける**: 仕様書に対応する説明書ノートのプロパティ(既定は `状態`)を読み、「状態不明」「その他の状態」「実装済み」に分けます。
- **変更に追従**: 仕様書を書き換えると、そのファイルだけ読み直して数を直します(設定で切れます)。
- **読めない物も隠さない**: §8 が無い仕様書、§8 はあるが空欄が無い仕様書、読めなかった仕様書を、末尾に別の組で出します。

## 向いている vault(前提)

次の形で書いた仕様書ノートを前提にしています。当てはまらないノートは「§8 が無い」の組に入るだけです。

- `##` の見出しが番号で始まる。**§8**(`## 8. …`)が後から材料を貼る節、**§12**(`## 12. …`)がフェーズの一覧、**§13**(`## 13. …`)がまだ決まっていない事の一覧
- 空欄は二重の波括弧で `{{名前}}` と書く。§8 の中の `### 8.1 …`(`### 8-1. …` でも同じ)が小節になる
- どの小節がどのフェーズを止めているかは、§12 の表の「開始条件」(「着手条件」「前提」でもよい)の列に `§8.1` のように書く

````markdown
## 8. 実物を貼る節
### 8.1 動作環境
| 項目 | 実物 |
|---|---|
| OS の版 | {{OS_VERSION}} |

### 8.2 コマンドの出力
```
{{COMMAND_OUTPUT}}
```

## 12. 実装フェーズ
| Phase | 内容 | 開始条件 |
|---|---|---|
| 1 | 雛形 | §8.1 が埋まっていること |
| 2 | 本体 | §8.1〜8.2 が埋まっていること |

## 13. 未確定事項
| # | 内容 |
|---|---|
| Q-1 | 保存先のフォルダ(未確認) |
| Q-2 | 名前は決まった |
````

パネルでこの仕様書の行を開くと、小節の行と未確認の行として次の 3 行が出ます(印の無い Q-2 は出ません)。

```
8.1 動作環境 — 欄 1 — Phase 1(§12 の表)、Phase 2(§12 の表)
8.2 コマンドの出力 — 欄 1 — Phase 2(§12 の表)
Q-1 保存先のフォルダ(未確認)
```

細かい決まり:

- コードブロックの中の `{{…}}` も数えます。インラインコードの中の `` `{{...}}` `` と `` `{{…}}` ``(欄の書き方を説明する文)は数えません。
- §8 の外の `{{…}}` は仕様書ごとの件数だけ出し、合計には入れません。
- フェーズは §12 の表のほか、§12 の箇条書き(`- Phase 2` の下の「着手条件: §8.1」の行)、§12 の文(「Phase 3 の開始前に §8.2 を確かめる。」)、§8 の小見出し(`### 8.1 動作環境(Phase 2 の開始条件)`)、§8 の前書き(「Phase 1 を開始してはならない」)からも読みます。
- 実装状態は、仕様書のファイル名の最初の `_` より前を製品名とし(`SampleTool_見本_仕様書.md` なら `SampleTool`)、説明書のフォルダにある `SampleTool.md` のプロパティ `状態` で決めます。この項目は [Status Badge](https://github.com/takosasi-dev/status-badge) が印に出す物と同じです([SpecStatus](https://github.com/takosasi-dev/spec-status) の記録は読みません)。

既定のフォルダ名・印の文字・プロパティ名は作者の vault の物です。設定の「仕様書のフォルダ」「§13 の印」「説明書のフォルダ」「状態のプロパティ名」「実装済みにする値」を、自分の vault に合わせて書き換えてください。節の番号(8・12・13)と「Phase」の語は固定で、変えられません。

## 入れ方

### BRAT で入れる(おすすめ)

1. コミュニティプラグインの「BRAT」(Obsidian42 - BRAT)を入れて有効にする。
2. BRAT の設定 → 「Add Beta plugin」に `takosasi-dev/blocker-board` を入れる。
3. コミュニティプラグインの一覧で「Blocker Board」を有効にする。

### 手で入れる

[Releases](https://github.com/takosasi-dev/blocker-board/releases) から `main.js`・`manifest.json`・`styles.css` を落とし、vault の `.obsidian/plugins/blocker-board/` に置いて、コミュニティプラグインの一覧で有効にします。

## 使い方

### コマンド

| コマンドパレットに出る名前 | すること |
|---|---|
| Blocker Board: 実物待ちボードを開く | 右サイドバーにパネル「実物待ちボード」を出す |
| Blocker Board: 仕様書を走査し直す | 仕様書を全部読み直して、数え直す |

既定のホットキーはありません。有効にすると、起動のたびに仕様書を全部読んで数えます。

### 画面の見方

- 上部: 「再走査」のボタン、`仕様書 N 本 / §8 の欄 N / 小節 N / §13 未確認 N`、`最終走査 <日時>(所要 N ms)`
- 組は 3 つ。「状態不明」(説明書が見つからない・`状態` が無い)と「その他の状態」(`状態` が「実装済みにする値」以外)は開いていて、「実装済み」は畳んであり、先頭に注記の文が出ます。組の中は欄の多い順です。
- 仕様書の行: 名前・札(`状態` の値)・`欄 N・小節 N・未確認 N・最初に止まる Phase N`。開くと、小節の行、§13 の印を含む行、`§8 の外の {{…}}: N(実物待ちに数えない)`、`説明書を開く: <名前>` が並びます。
- 小節の行のかっこの中は、フェーズを読んだ場所です(`§12 の表`・`§12 の箇条書き`・`§12 の文`・`§8 の小見出し`・`§8 全体`)。
- 下の方(畳んである): `§8 はあるが欄が無い(N) / §8 が無い(N)` と `読めなかった仕様書(N)`
- ほかに出る文: `フォルダが見つからない: <パス>`、`コードブロックが閉じていない(以降の §12・§13 は読めない)`、起動直後の札「未読込」(Obsidian の索引ができると決め直します)

## 設定

| 項目 | 既定 | 内容 |
|---|---|---|
| 仕様書のフォルダ | `仕様書MDファイル` | 1行に1つ。vault からのパス。この下の md を読む |
| 除くパス | 空 | 1行に1つ。フォルダかファイル。Foo は Foo/ の下だけに効く |
| 言及として数えない欄の中身 | `...` と `…` | 1行に1つ。インラインコードの中でこの中身の {{…}} は数えない |
| §13 の印 | `未確認` | この文字を含む §13 の行を出す |
| 説明書のフォルダ | `説明書/Claude開発ツールについて` | 製品名.md をここで探す |
| 説明書の対応表 | 空 | 1行に1つ「仕様書のパス => 説明書のパス」。右が空なら説明書なし |
| 状態のプロパティ名 | `状態` | 説明書のプロパティのうち、状態として読む物の名前 |
| 実装済みにする値 | `実装完了` | 1行に1つ。この値なら「実装済み」の組に入れる |
| 実装済みグループの注記 | `このグループのツールは実装済み。欄は実データでの確認待ちの印。` | 「実装済み」の組の先頭に出す文 |
| 変更に追従する | オン | 仕様書が変わったら、そのファイルだけ読み直す |
| まとめる間隔(ミリ秒) | 1000 | この間の変更をまとめて読み直す |

設定を変えると、1 秒後に走査し直します。

## 安全のための決まり

- vault のノートは 1 つも書き換えません。作る・消す・動かす・名前を変える、もしません。書くのはこのプラグイン自身の設定(プラグインのフォルダの `data.json`)だけです。
- 読むのは「仕様書のフォルダ」の下の md の本文と、説明書ノートのプロパティ(Obsidian の索引から)だけです。vault の外は読みません。
- ネットワークに出ません。Node.js / Electron の機能を使いません(モバイルでも動く作りです)。
- クリップボードは使いません。
- 推定しません。フェーズが読めない小節は「読み取れず」、説明書が引けない仕様書は「状態不明」と出します。
- `data.json` が読めないときは既定値で動き、`Blocker Board: 設定(data.json)が読めないので既定値で動きます。data.json は書き換えていません。` と知らせます(そのあと設定画面で値を変えると、保存し直します)。

## 動作確認の状況

- 版 0.1.0。Windows の Obsidian 1.14.4 で動作を確認(パネルの表示、数が同じ規則で別に数えた数と合うこと、小節の行と未確認の行を押すと編集画面のその行に移ること)
- iPhone・Android の実機は未確認(モバイル表示のエミュレーションで読み込みと表示まで確認)
- まだ確かめていない事: 閲覧モード(読み取りビュー)で開いたノートへの行の移動、仕様書を書き換えたあと押さずに数が変わること(Obsidian の画面では未確認)

## 分かっている限界

- 節の番号(8・12・13)、空欄の形(`{{…}}`)、「Phase」の語は固定です。別の書き方の仕様書には合いません。
- フェーズは書き方から読むだけです。出所が「§8 全体」の物は、小節ごとでなく §8 まるごとで決めた粗い値です。
- 行への移動はカーソルを置く方法なので、閲覧モードでは行が画面に出ないかもしれません。
- 説明書を探すフォルダは 1 つです。ファイル名の先頭が同じ別の仕様書は同じ説明書に当たるので、「説明書の対応表」で直します。
- コードブロックが閉じていない仕様書は、そこから後ろの §12・§13 が読めません(その旨を出します)。
- 「所要 N ms」は全部を走査した時間です。結果のコピーや書き出しはありません。

## 開発

```
npm install
npm run build        # main.js を作る(型チェックつき)
npm test             # vitest
npm run lint         # eslint-plugin-obsidianmd
```

読み取りの規則(`src/parse/`)は obsidian を import しない関数で、テストは作り物のノートだけを使います。

## ライセンス

MIT。[LICENSE](LICENSE) を見てください。

---

## English summary

**Blocker Board** lists the unfilled placeholders (`{{…}}`) in your spec notes and the phases they block, in a right-sidebar panel.

- It expects spec notes with numbered `##` sections: §8 (`## 8. …`) holds placeholders under `### 8.1 …` subsections, §12 (`## 12. …`) lists phases with a start-condition column or sentence that refers to `§8.1`, and §13 (`## 13. …`) holds open questions. These section numbers and the word "Phase" are fixed.
- Per spec and subsection it shows the number of placeholders, the blocked phases with where they were read from (or 「読み取れず」 when they cannot be read; nothing is guessed), and the §13 rows that contain a marker (default 「未確認」). Clicking a row opens the note at that line.
- Specs are grouped by a frontmatter property (default `状態`) of a matching guide note, found by the file name before the first `_`.
- Read-only: it never creates, changes, moves or deletes vault files. It writes only its own `data.json`. No network requests, no clipboard, no Node.js or Electron APIs.
- Folder names, the marker and the property name default to the author's vault; change them in the settings.
- Install with BRAT (`takosasi-dev/blocker-board`) or copy `main.js`, `manifest.json` and `styles.css` from the latest release into `.obsidian/plugins/blocker-board/`.
- The UI is in Japanese. Tested on Obsidian 1.14.4 for Windows only; mobile was checked only with mobile emulation, not on real devices.
