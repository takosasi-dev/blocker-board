// 対象の判定(FR-1)・実装状態(FR-8・AC-9 の manualMap)・グループ分けと合計(§9.4)・設定の読み込み(§9.2)のテスト。
import { describe, expect, it } from "vitest";
import { buildBoard, firstPhase, isTarget } from "../src/board";
import { parseSpec } from "../src/parse";
import { decideState, manualPathOf, productOf, UNLOADED_LABEL, type ManualInfo, type SpecState } from "../src/parse/state";
import { DEFAULTS, normalizeSettings } from "../src/settings";

describe("対象(FR-1)", () => {
	const s = { specFolders: ["specs"], excludePaths: ["specs/Foo", "specs/x/skip.md"] };
	it("excludePaths で除かれるパスと、Foo で除かれない FooBar", () => {
		expect(isTarget("specs/a.md", s)).toBe(true);
		expect(isTarget("specs/Foo/a.md", s)).toBe(false);
		expect(isTarget("specs/FooBar/a.md", s)).toBe(true);
		expect(isTarget("specs/x/skip.md", s)).toBe(false);
		expect(isTarget("specsX/a.md", s)).toBe(false);
		expect(isTarget("specs/a.canvas", s)).toBe(false);
	});

	it("既定は未設定(specFolders が空)。vault の直下とは読まず、1本も対象にしない", () => {
		expect(DEFAULTS.specFolders).toEqual([]);
		expect(isTarget("a.md", DEFAULTS)).toBe(false);
		expect(isTarget("specs/a.md", DEFAULTS)).toBe(false);
	});
});

describe("実装状態(FR-8)", () => {
	const manuals: Record<string, ManualInfo> = {
		"m/Tool.md": { kind: "loaded", value: "DONE" },
		"m/Half.md": { kind: "loaded", value: "partial" },
		"m/List.md": { kind: "loaded", value: ["a", "b"] },
		"m/NoKey.md": { kind: "loaded", value: undefined },
		"m/Slow.md": { kind: "unloaded" },
		"other/Special.md": { kind: "loaded", value: "partial" },
	};
	const lookup = (p: string): ManualInfo => manuals[p] ?? { kind: "missing" };
	const s = { manualFolder: "m", implementedStates: ["DONE"], manualMap: {} as Record<string, string> };

	it("製品名はファイル名の最初の _ より前", () => {
		expect(productOf("a/b/Tool_何か_仕様書.md")).toBe("Tool");
		expect(productOf("a/sample-tool-spec.md")).toBe("sample-tool-spec");
		expect(manualPathOf("a/Tool_x.md", s)).toBe("m/Tool.md");
	});

	it("実装済み / その他の状態(値を札に) / 状態不明", () => {
		expect(decideState("a/Tool_x.md", s, lookup)).toEqual({ group: "implemented", label: "DONE", manualPath: "m/Tool.md" });
		expect(decideState("a/Half_x.md", s, lookup)).toEqual({ group: "other", label: "partial", manualPath: "m/Half.md" });
		expect(decideState("a/List_x.md", s, lookup)).toMatchObject({ group: "other", label: "[\"a\",\"b\"]" });
		expect(decideState("a/NoKey_x.md", s, lookup).group).toBe("unknown");
		expect(decideState("a/None_x.md", s, lookup)).toEqual({ group: "unknown", label: "", manualPath: null });
		expect(decideState("a/Slow_x.md", s, lookup)).toMatchObject({ group: "unknown", label: UNLOADED_LABEL });
	});

	it("manualMap に書いた仕様書は指定した説明書の状態で分ける。\"\" は説明書なし", () => {
		const m = { ...s, manualMap: { "a/Tool_plugin.md": "other/Special.md", "a/Tool_x.md": "" } };
		expect(decideState("a/Tool_plugin.md", m, lookup)).toEqual({ group: "other", label: "partial", manualPath: "other/Special.md" });
		expect(decideState("a/Tool_x.md", m, lookup)).toEqual({ group: "unknown", label: "", manualPath: null });
	});

	it("既定は未設定(manualFolder が空)。製品名では探さず(vault の直下も見ない)、manualMap だけを見る", () => {
		const asked: string[] = [];
		const spy = (p: string): ManualInfo => {
			asked.push(p);
			return { kind: "loaded", value: "DONE" };
		};
		const u = { ...s, manualFolder: DEFAULTS.manualFolder, manualMap: { "a/Mapped_x.md": "other/Special.md" } };
		expect(u.manualFolder).toBe("");
		expect(manualPathOf("a/Tool_x.md", u)).toBeNull();
		expect(decideState("a/Tool_x.md", u, spy)).toEqual({ group: "unknown", label: "", manualPath: null });
		expect(decideState("a/Mapped_x.md", u, spy)).toEqual({ group: "implemented", label: "DONE", manualPath: "other/Special.md" });
		expect(asked).toEqual(["other/Special.md"]);
	});
});

describe("ボード(§9.4・FR-10・FR-15)", () => {
	const spec = (path: string, text: string) => parseSpec(path, text, DEFAULTS);
	const big = spec("s/Big_x.md", "## 8. 実物\n### 8.1 a\n{{A}} {{B}}\n## 12. x\n| Phase | 開始条件 |\n|---|---|\n| 2 | §8.1 |\n| 1b | §8.1 |\n");
	const small = spec("s/Small_x.md", "## 8. 実物\n### 8.1 a\n{{A}}\n");
	const tie = spec("s/Aaa_x.md", "## 8. 実物\n### 8.1 a\n{{A}}\n");
	const onlyQ = spec("s/OnlyQ_x.md", `## 13. 未定\n| Q-1 | ${DEFAULTS.unconfirmedMarker} |\n|---|---|\n| Q-2 | ${DEFAULTS.unconfirmedMarker} |\n`);
	const empty8 = spec("s/Empty_x.md", "## 8. 実物\n### 8.1 a\n(なし)\n");
	const no8 = spec("s/No8_x.md", "## 1. x\n");
	const states = new Map<string, SpecState>([
		["s/Big_x.md", { group: "implemented", label: "DONE", manualPath: "m/Big.md" }],
		["s/Small_x.md", { group: "other", label: "partial", manualPath: "m/Small.md" }],
	]);
	const b = buildBoard([small, big, tie, onlyQ, empty8, no8], [{ path: "s/Bad.md", message: "x" }], states);

	it("合計(読めなかった仕様書も本数に入る)", () => {
		expect(b.totals).toEqual({ specs: 7, blanks: 4, slots: 3, unconfirmed: 1 });
	});

	it("グループの順・中は欄の多い順、同数ならパスの順。欄も印も 0 の仕様書はグループに出さない", () => {
		expect(b.groups.map((g) => [g.group, g.items.map((it) => it.result.path)])).toEqual([
			["unknown", ["s/Aaa_x.md", "s/OnlyQ_x.md"]],
			["other", ["s/Small_x.md"]],
			["implemented", ["s/Big_x.md"]],
		]);
		expect(b.noBlanks.map((r) => r.path)).toEqual(["s/Empty_x.md"]);
		expect(b.no8.map((r) => r.path)).toEqual(["s/No8_x.md", "s/OnlyQ_x.md"]);
		expect(b.failures).toHaveLength(1);
	});

	it("最初に止まるフェーズは数字の小さい順、同じ数字なら文字の順", () => {
		expect(firstPhase(big)).toBe("1b");
		expect(firstPhase(small)).toBeNull();
	});
});

describe("設定の読み込み(§9.2)", () => {
	const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "");

	it("無ければ既定値。欠けた項目は既定値で埋め、パスは正規化する", () => {
		expect(normalizeSettings(null, norm)).toEqual({ settings: DEFAULTS, problem: false });
		const { settings, problem } = normalizeSettings({ specFolders: ["a\\b/", " "], manualFolder: "m\\n/", manualMap: { "x\\y.md": "", "p.md": "q\\r.md" } }, norm);
		expect(problem).toBe(false);
		expect(settings.specFolders).toEqual(["a/b"]);
		expect(settings.manualFolder).toBe("m/n");             // 保存してある値は、既定が空でもそのまま
		expect(settings.manualMap).toEqual({ "x/y.md": "", "p.md": "q/r.md" });
		expect(settings.unconfirmedMarker).toBe(DEFAULTS.unconfirmedMarker);
	});

	it("壊れている・schemaVersion が違うときは既定値と problem", () => {
		expect(normalizeSettings([1, 2], norm)).toEqual({ settings: DEFAULTS, problem: true });
		expect(normalizeSettings("x", norm).problem).toBe(true);
		expect(normalizeSettings({ schemaVersion: 2, autoUpdate: false }, norm)).toEqual({ settings: DEFAULTS, problem: true });
		expect(normalizeSettings({ updateDelayMs: -1, autoUpdate: "yes" }, norm).settings).toMatchObject({
			updateDelayMs: DEFAULTS.updateDelayMs, autoUpdate: DEFAULTS.autoUpdate });
	});
});
