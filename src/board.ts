// 対象の判定(FR-1)と、解析結果のグループ分け・並べ替え・合計(§9.4・FR-8・FR-10・FR-15)。純関数。
// グループの順は 状態不明 → その他の状態 → 実装済み。中は §8 の欄の多い順、同数ならパスの順。
import { comparePhase } from "./parse/phases";
import type { Group, SpecState } from "./parse/state";
import type { ParseFailure, SpecResult } from "./parse";

/** `Foo` は `Foo` 自身と `Foo/` の下だけ(`FooBar/` は含まない) */
export function inFolder(path: string, folder: string): boolean {
	return path === folder || path.startsWith(folder + "/");
}

/** FR-1: specFolders の下の md で、excludePaths のどれかと同じか、その下ではない */
export function isTarget(path: string, s: { specFolders: string[]; excludePaths: string[] }): boolean {
	return path.endsWith(".md") && s.specFolders.some((f) => inFolder(path, f)) && !s.excludePaths.some((x) => inFolder(path, x));
}

export const blankCount = (r: SpecResult): number => r.slots.reduce((n, s) => n + s.blankLines.length, 0);

/** 仕様書の中で最も小さいフェーズ(読めた小節が無ければ null) */
export function firstPhase(r: SpecResult): string | null {
	const all = r.slots.flatMap((s) => s.phases.map((p) => p.phase)).sort(comparePhase);
	return all[0] ?? null;
}

export interface BoardItem { result: SpecResult; state: SpecState; blanks: number }
export interface Board {
	totals: { specs: number; blanks: number; slots: number; unconfirmed: number };
	groups: { group: Group; items: BoardItem[] }[];
	/** §8 はあるが欄が無い */
	noBlanks: SpecResult[];
	/** §8 が無い */
	no8: SpecResult[];
	failures: ParseFailure[];
}

const GROUP_ORDER: Group[] = ["unknown", "other", "implemented"];
const UNKNOWN: SpecState = { group: "unknown", label: "", manualPath: null };

export function buildBoard(results: readonly SpecResult[], failures: readonly ParseFailure[],
	states: ReadonlyMap<string, SpecState>): Board {
	const byPath = (a: { path: string }, b: { path: string }) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
	const items = results.map((result): BoardItem => ({ result, state: states.get(result.path) ?? UNKNOWN, blanks: blankCount(result) }));
	const shown = items.filter((it) => it.blanks > 0 || it.result.unconfirmed.length > 0);
	return {
		totals: {
			specs: results.length + failures.length,
			blanks: items.reduce((n, it) => n + it.blanks, 0),
			slots: results.reduce((n, r) => n + r.slots.length, 0),
			unconfirmed: results.reduce((n, r) => n + r.unconfirmed.length, 0),
		},
		groups: GROUP_ORDER.map((group) => ({
			group,
			items: shown.filter((it) => it.state.group === group)
				.sort((a, b) => b.blanks - a.blanks || byPath(a.result, b.result)),
		})),
		noBlanks: results.filter((r) => r.has8 && r.slots.length === 0).sort(byPath),
		no8: results.filter((r) => !r.has8).sort(byPath),
		failures: [...failures].sort(byPath),
	};
}
