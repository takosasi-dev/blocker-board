// 実装状態: 製品名 → 説明書のパス → frontmatter の状態の値 → 3グループ(§9.5「実装状態」・FR-8・D-13)。
// 純関数。説明書の読み方(metadataCache)は呼び手が lookup で渡す。引けない物は状態不明にする(INV-7)。
export type Group = "unknown" | "other" | "implemented";
export interface SpecState { group: Group; label: string; manualPath: string | null }

/** 説明書を引いた結果。missing = ファイルが無い / unloaded = metadataCache がまだ無い */
export type ManualInfo = { kind: "missing" } | { kind: "unloaded" } | { kind: "loaded"; value: unknown };

export const UNLOADED_LABEL = "未読込";

/** 製品名 = ファイル名(拡張子なし)の最初の `_` より前。`_` が無ければファイル名全体 */
export function productOf(path: string): string {
	const base = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, "");
	const u = base.indexOf("_");
	return u >= 0 ? base.slice(0, u) : base;
}

/** 説明書のパス。manualMap を先に見る("" は説明書なし = null) */
export function manualPathOf(specPath: string, s: { manualMap: Record<string, string>; manualFolder: string }): string | null {
	const mapped = s.manualMap[specPath];
	if (mapped !== undefined) return mapped === "" ? null : mapped;
	const name = `${productOf(specPath)}.md`;
	return s.manualFolder === "" ? name : `${s.manualFolder}/${name}`;
}

export function decideState(
	specPath: string,
	s: { manualMap: Record<string, string>; manualFolder: string; implementedStates: string[] },
	lookup: (manualPath: string) => ManualInfo,
): SpecState {
	const path = manualPathOf(specPath, s);
	if (path === null) return { group: "unknown", label: "", manualPath: null };
	const info = lookup(path);
	if (info.kind === "missing") return { group: "unknown", label: "", manualPath: null };
	if (info.kind === "unloaded") return { group: "unknown", label: UNLOADED_LABEL, manualPath: path };
	const v = info.value;
	if (v === undefined || v === null) return { group: "unknown", label: "", manualPath: path };
	if (typeof v === "string") {
		return { group: s.implementedStates.includes(v) ? "implemented" : "other", label: v, manualPath: path };
	}
	return { group: "other", label: JSON.stringify(v), manualPath: path };      // 配列・数値は文字列に直して札にする(§10)
}
