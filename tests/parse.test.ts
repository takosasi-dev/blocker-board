// 抽出規則(§9.5)の検体テスト。AC-2 の検体を合成の本文で1つずつ再現する(実 vault の本文は写さない)。
import { describe, expect, it } from "vitest";
import { parseAll, parseSpec, type SpecResult } from "../src/parse";
import { refsIn } from "../src/parse/phases";
import { countBlanks } from "../src/parse/slots";
import { DEFAULTS } from "../src/settings";

const F = "```";
const MAIN = [
	"---",
	"tags: x",
	"---",
	"# Foo 仕様書",
	"",
	"## 0. 指示",
	"- §8 の `{{...}}` が埋まるまで止まる。`{{` が残っていれば停止",
	"",
	"## 8. 実物を貼る節",
	"**この節が空のまま Phase 1 を開始してはならない。**",
	"前書きの欄 {{PRE}}",
	"",
	"### 8.1 表の欄(Phase 2 の開始条件)",
	"| 項目 | 実物 |",
	"|---|---|",
	"| a | {{...}} |",
	"| b | `{{...}}` |",
	"| c | `{{MASTER}}` |",
	"",
	"### 8-2. コードブロック",
	F,
	"{{CODE_A}}",
	"## 9. これは見出しではない",
	"{{CODE_B}}",
	F,
	"{{ }}",
	"",
	"### 8.3 文",
	"{{S3}}",
	"",
	"### 8.4 箇条書き",
	"{{S4}}",
	"",
	"### 8.1 二つ目の同じ番号",
	"{{S1B}}",
	"",
	"## 9. インタフェース",
	F + "json",
	"{ \"id\": \"{{PLUGIN_ID}}\" }",
	F,
	"",
	"## 12. 実装フェーズ",
	"| Phase | 内容 | 開始条件 |",
	"|---|---|---|",
	"| 0 | §8.3 は内容の列 | なし |",
	"| Phase 3 | x | **§8.1〜8.2 が貼られていること** |",
	"",
	"- Phase 4: 箇条書き",
	"  - 着手条件: §8.4 が埋まっている",
	"- Phase 5: 次",
	"  - §8.3 を埋める",
	"",
	"Phase 6 の開始前に §8.3 を確かめる。§8.4 はここに入らない。Phase 7 の着手前に §8 全体。",
	"",
	"## 13. 未確定事項",
	"| # | 内容 | 回答者 |",
	"|---|---|---|",
	"| Q-1 | **未確認** の物 | 私 |",
	"| Q-2 | 太字なしの未確認 | 私 |",
	"| Q-3 | 決まった | 私 |",
	"- Q-4 箇条書きの未確認",
	"- **Q-5** 箇条書き **未確認**",
	"- 太字なしで ID も無い未確認",
].join("\r\n");

const parse = (text: string, path = "仕様書MDファイル/x/Foo_テスト_仕様書.md") => parseSpec(path, text, DEFAULTS);
const slot = (r: SpecResult, key: string) => r.slots.find((s) => s.key === key);
const phases = (r: SpecResult, key: string) => slot(r, key)?.phases.map((p) => `${p.phase}:${p.source}`);

describe("欄(§9.5)", () => {
	const r = parse(MAIN);

	it("§8 の欄を小節ごとに行番号つきで数える(### 8.1 と ### 8-1. を同じ形に)", () => {
		expect(r.has8).toBe(true);
		expect(r.slots.map((s) => [s.key, s.blankLines.length])).toEqual([
			["§8 前書き", 1], ["8.1", 3], ["8.2", 3], ["8.3", 1], ["8.4", 1],
		]);
		expect(slot(r, "8.2")?.heading).toBe("8-2. コードブロック");
		expect(slot(r, "8.1")?.blankLines).toEqual([15, 17, 34]);     // 0 始まり。CRLF の \r は取ってある
	});

	it("同じ番号の H3 は1つにまとめ、見出しは最初の物", () => {
		expect(slot(r, "8.1")?.heading).toBe("8.1 表の欄(Phase 2 の開始条件)");
		expect(slot(r, "8.1")?.headingLine).toBe(12);
	});

	it("コードブロックの中の欄は数え、中の ## 9 は見出しにしない", () => {
		expect(slot(r, "8.2")?.blankLines).toEqual([21, 23, 25]);
	});

	it("インラインコードの中の {{...}} は数えず、表の中の {{...}} と `{{MASTER}}` と {{ }} は数える", () => {
		expect(countBlanks("| b | `{{...}}` |", DEFAULTS.mentionTexts)).toBe(0);
		expect(countBlanks("| b | `{{…}}` |", DEFAULTS.mentionTexts)).toBe(0);
		expect(countBlanks("| a | {{...}} |", DEFAULTS.mentionTexts)).toBe(1);
		expect(countBlanks("`{{MASTER}}`", DEFAULTS.mentionTexts)).toBe(1);
		expect(countBlanks("| x | {{ }} | {{ }} |", DEFAULTS.mentionTexts)).toBe(2);
		expect(countBlanks("`{{` が残っていれば停止", DEFAULTS.mentionTexts)).toBe(0);
	});

	it("§8 の外の欄は件数だけ(§9 の {{PLUGIN_ID}} が 1。§0 の言及は数えない)", () => {
		expect(r.outsideCount).toBe(1);
	});

	it("§8 が無い・§8 はあるが欄が無い", () => {
		expect(parse("## 1. x\n{{A}}\n").has8).toBe(false);
		const none = parse("## 8. 実物\n### 8.1 a\n(生成スクリプト)\n");
		expect(none.has8).toBe(true);
		expect(none.slots).toEqual([]);
	});
});

describe("止めているフェーズ(規則1〜5)", () => {
	const r = parse(MAIN);

	it("規則1(§12 の表)と規則4(§8 の小見出し)。範囲 8.1〜8.2 は間を含む", () => {
		expect(phases(r, "8.1")).toEqual(["2:heading", "3:table"]);
		expect(phases(r, "8.2")).toEqual(["3:table"]);
	});

	it("規則2(§12 の箇条書き)は着手条件の行だけ", () => {
		expect(phases(r, "8.4")).toEqual(["4:list"]);
	});

	it("規則3(§12 の文)は最初の「。」まで", () => {
		expect(phases(r, "8.3")).toEqual(["6:sentence"]);
	});

	it("規則5 と §8 全体への参照は、当たる規則の無い小節だけに当てる", () => {
		expect(phases(r, "§8 前書き")).toEqual(["1:whole", "7:whole"]);
	});

	it("表の「前提」だけの列・「着手条件」の列", () => {
		const a = parse("## 8. 実物\n### 8.1 a\n{{A}}\n## 12. フェーズ\n| Phase | 前提 |\n|---|---|\n| 1a | §8.1 |\n");
		expect(phases(a, "8.1")).toEqual(["1a:table"]);
		const b = parse("## 8. 実物\n### 8.1 a\n{{A}}\n## 12. フェーズ\n| # | 着手条件(§8) |\n|---|---|\n| 2 | 8-1 が埋まる |\n");
		expect(phases(b, "8.1")).toEqual(["2:table"]);
		const c = parse("## 8. 実物\n### 8.1 a\n{{A}}\n## 12. フェーズ\n| Phase | 前提となる物 |\n|---|---|\n| 1 | §8.1 |\n");
		expect(phases(c, "8.1")).toEqual([]);                        // 「前提」だけのセルではない
	});

	it("### Phase の見出しの形(規則2)と、規則4 の「に着手しない」", () => {
		const a = parse("## 8. 実物\n### 8.1 a\n{{A}}\n### 8.2 Phase 3 に着手しない\n{{B}}\n## 12. フェーズ\n### Phase 2\n開始条件: §8.1\n");
		expect(phases(a, "8.1")).toEqual(["2:list"]);
		expect(phases(a, "8.2")).toEqual(["3:heading"]);
	});

	it("どれにも当たらない小節は「読み取れず」(空)", () => {
		const a = parse("## 8. 実物\n### 8.1 a\n{{A}}\n### 8.2 b\n{{B}}\n## 12. フェーズ\n| Phase | 開始条件 |\n|---|---|\n| 1 | §8.1 |\n");
		expect(phases(a, "8.1")).toEqual(["1:table"]);
		expect(phases(a, "8.2")).toEqual([]);
	});

	it("§8 への参照の形", () => {
		expect(refsIn("§8.1〜§8.3 と 8-5")).toEqual({ ranges: [[1, 3], [5, 5]], whole: false });
		expect(refsIn("§8 全体")).toEqual({ ranges: [], whole: true });
		expect(refsIn("v1.8.2 と 18.1 と §80")).toEqual({ ranges: [], whole: false });
	});
});

describe("§13 の印の行", () => {
	it("表の行と箇条書きの行(太字あり・なし)。表の1行目と区切りは見ない", () => {
		const r = parse(MAIN);
		expect(r.unconfirmed.map((u) => [u.id, u.line])).toEqual([
			["Q-1", 57], ["Q-2", 58], ["Q-4", 60], ["Q-5", 61], ["", 62],
		]);
		expect(r.unconfirmed[0]?.text).toBe(`**${DEFAULTS.unconfirmedMarker}** の物 / 私`);
	});

	it("コードブロックが閉じないまま終わると、以降の §12・§13 は読めない", () => {
		const r = parse(`## 8. 実物\n### 8.1 a\n${F}\n{{A}}\n## 12. x\n| Phase | 開始条件 |\n|---|---|\n| 1 | §8.1 |\n## 13. y\n| Q-1 | 未確認 |\n`);
		expect(r.unclosedFence).toBe(true);
		expect(slot(r, "8.1")?.blankLines.length).toBe(1);
		expect(phases(r, "8.1")).toEqual([]);
		expect(r.unconfirmed).toEqual([]);
	});
});

describe("1本が落ちても他は出す(AC-11・INV-6)", () => {
	it("例外を投げる本文を1件混ぜると、残りの結果と ParseFailure 1件", () => {
		const { results, failures } = parseAll([
			{ path: "a/A_x.md", text: "## 8. 実物\n{{A}}\n" },
			{ path: "a/B_x.md", text: null as unknown as string },
			{ path: "a/C_x.md", text: "## 1. x\n" },
		], DEFAULTS);
		expect(results.map((r) => r.path)).toEqual(["a/A_x.md", "a/C_x.md"]);
		expect(failures).toHaveLength(1);
		expect(failures[0]?.path).toBe("a/B_x.md");
	});
});
