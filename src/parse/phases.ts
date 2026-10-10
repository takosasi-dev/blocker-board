// 欄のある小節を止めているフェーズを §9.5 の規則1〜5で読む(FR-6・D-12)。純関数。
// 小節に当たった規則1〜4の和を優先し、無ければ §8 全体の和。どれも無ければ空(=読み取れず。推定しない INV-7)。
import { isTableLine, isTableRule, tableCells, type Line } from "./lines";
import type { SlotScan } from "./slots";

export type PhaseSource = "table" | "list" | "sentence" | "heading" | "whole";
export interface PhaseHit { phase: string; source: PhaseSource }

interface Refs { ranges: [number, number][]; whole: boolean }

// §9.5 の `[.\-]` は文字クラスの中なので `[.-]` と同じ(eslint の no-useless-escape に合わせた)
const REF = /(^|[^0-9.])(?:§\s*)?8\s*[.-]\s*(\d+)(?:\s*[〜~～]\s*(?:§\s*)?8\s*[.-]\s*(\d+))?/g;
const WHOLE = /§\s*8(?!\s*[.-]\s*\d)(?!\d)/;
const COND_CELL = /開始条件|着手条件/;
const TABLE_PHASE = /^\s*(\d+[a-z]?)/;
const LIST_HEAD = /^\s*([-*]\s*|###\s*)\**Phase\s*(\d+[a-z]?)/;
const LIST_COND = /着手条件|開始条件/;
const SENTENCE = /Phase\s*(\d+[a-z]?)\s*(の)?\s*(開始|着手)前に/g;
const HEADING_RULE = /Phase\s*(\d+[a-z]?)\s*(以降)?\s*(の|に)?\s*(開始条件|着手条件|前提|前に|必要|を開始しない|に着手しない)/g;
const PREAMBLE_RULE = /Phase\s*(\d+[a-z]?)\s*(以降)?\s*(を|に)\s*(開始|着手)/g;
const SOURCE_ORDER: PhaseSource[] = ["table", "list", "sentence", "heading", "whole"];

/** 文の中の §8 への参照(§9.5「§8 への参照」)。範囲 8.1〜8.4 は [1, 4] で持つ */
export function refsIn(text: string): Refs {
	const ranges: [number, number][] = [];
	for (const m of text.matchAll(REF)) {
		const a = Number(m[2]);
		const b = m[3] === undefined ? a : Number(m[3]);
		ranges.push(a <= b ? [a, b] : [b, a]);
	}
	return { ranges, whole: WHOLE.test(text) };
}

/** フェーズ名の並び: 数字の小さい順、同じ数字なら文字の順 */
export function comparePhase(a: string, b: string): number {
	const na = parseInt(a, 10);
	const nb = parseInt(b, 10);
	if (na !== nb) return na - nb;
	return a < b ? -1 : a > b ? 1 : 0;
}

/** 小節の key ごとのフェーズ。欄の無い小節も返す */
export function readPhases(lines: readonly Line[], scan: SlotScan): Map<string, PhaseHit[]> {
	const bySlot = new Map<string, PhaseHit[]>();
	const whole = new Set<string>();
	const hit = (key: string, phase: string, source: PhaseSource) => {
		const list = bySlot.get(key) ?? [];
		if (!list.some((h) => h.phase === phase && h.source === source)) list.push({ phase, source });
		bySlot.set(key, list);
	};
	const apply = (phase: string, source: PhaseSource, text: string) => {
		const refs = refsIn(text);
		if (refs.whole) whole.add(phase);
		for (const s of scan.slots) {
			if (s.num !== null && refs.ranges.some(([a, b]) => s.num !== null && a <= s.num && s.num <= b)) hit(s.key, phase, source);
		}
	};

	// 規則1〜3: §12 のコードブロックの外
	let condCol = -1;
	let inTable = false;
	let listPhase: string | null = null;
	lines.forEach((l) => {
		if (l.section !== "12") {
			inTable = false;
			listPhase = null;
			return;
		}
		if (l.code) return;
		const t = l.text;
		if (t.trim() === "") inTable = false;                    // 表は空行で終わる
		if (isTableLine(t)) {
			if (!inTable) {
				inTable = true;
				const cells = tableCells(t).map((c) => c.trim());
				condCol = cells.findIndex((c) => COND_CELL.test(c) || c === "前提");
			} else if (condCol >= 0 && !isTableRule(t)) {
				const cells = tableCells(t);
				const phase = TABLE_PHASE.exec((cells[0] ?? "").replace("Phase", ""))?.[1];
				if (phase) apply(phase, "table", cells[condCol] ?? "");
			}
		}
		const head = LIST_HEAD.exec(t);
		if (head) listPhase = head[2] ?? null;
		if (listPhase && LIST_COND.test(t)) apply(listPhase, "list", t);
		if (!isTableLine(t)) {
			const ms = [...t.matchAll(SENTENCE)];
			ms.forEach((m, k) => {
				const start = (m.index ?? 0) + m[0].length;
				const next = ms[k + 1]?.index ?? t.length;
				const stop = t.indexOf("。", start);
				apply(m[1] ?? "", "sentence", t.slice(start, stop >= 0 && stop < next ? stop : next));
			});
		}
	});

	// 規則4: §8 の H3
	for (const h of scan.h3) {
		for (const m of h.title.matchAll(HEADING_RULE)) hit(h.key, m[1] ?? "", "heading");
	}
	// 規則5: §8 前書き
	for (const i of scan.preambleLines) {
		for (const m of (lines[i]?.text ?? "").matchAll(PREAMBLE_RULE)) whole.add(m[1] ?? "");
	}

	const out = new Map<string, PhaseHit[]>();
	for (const s of scan.slots) {
		const own = bySlot.get(s.key) ?? [];
		const hits = own.length ? own : [...whole].map((phase): PhaseHit => ({ phase, source: "whole" }));
		hits.sort((a, b) => comparePhase(a.phase, b.phase) || SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source));
		out.set(s.key, hits);
	}
	return out;
}
