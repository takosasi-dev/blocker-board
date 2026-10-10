// §8 の欄を小節ごとに行番号つきで集め、§8 の外の欄は件数だけ数える(§9.5「欄」・FR-3〜FR-5・D-9〜D-11)。
// 純関数。小節は `### 8.N` と `### 8-N.` を同じ 8.N にまとめ、最初の H3 より前は「§8 前書き」にする。
import type { Line } from "./lines";

export const PREAMBLE = "§8 前書き";

export interface SlotDraft {
	key: string;
	heading: string;
	headingLine: number;
	/** 欄1つにつき1要素(同じ行に2つあれば2回入る) */
	blankLines: number[];
	/** 8.N の N。数字の無い小節は null */
	num: number | null;
}

export interface SlotScan {
	has8: boolean;
	/** 現れた順。欄の無い小節も入る */
	slots: SlotDraft[];
	outsideCount: number;
	/** §8 前書きの行(コードブロックの外) */
	preambleLines: number[];
	/** §8 の H3 と、それが属する小節 */
	h3: { line: number; title: string; key: string }[];
}

const BLANK = /\{\{(.*?)\}\}/g;
const INLINE_CODE = /`[^`]*`/g;
const SLOT_H3 = /^8\s*[.-]\s*(\d+)/;

/** 1行の欄の数。インラインコードの中で中身が言及の文字(mentionTexts)の物は数えない(FR-4・D-10) */
export function countBlanks(text: string, mentionTexts: readonly string[]): number {
	if (!text.includes("{{")) return 0;
	const spans = [...text.matchAll(INLINE_CODE)].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length] as const);
	let n = 0;
	for (const m of text.matchAll(BLANK)) {
		const s = m.index ?? 0;
		const e = s + m[0].length;
		const inCode = spans.some(([a, b]) => s >= a && e <= b);
		if (inCode && mentionTexts.includes((m[1] ?? "").trim())) continue;
		n++;
	}
	return n;
}

export function scanSlots(lines: readonly Line[], mentionTexts: readonly string[]): SlotScan {
	const out: SlotScan = { has8: false, slots: [], outsideCount: 0, preambleLines: [], h3: [] };
	const byKey = new Map<string, SlotDraft>();
	const slot = (key: string, heading: string, line: number, num: number | null): SlotDraft => {
		let s = byKey.get(key);
		if (!s) {
			s = { key, heading, headingLine: line, blankLines: [], num };
			byKey.set(key, s);
			out.slots.push(s);
		}
		return s;
	};
	let current: SlotDraft | null = null;
	lines.forEach((l, i) => {
		if (l.section !== "8") {
			current = null;
			out.outsideCount += countBlanks(l.text, mentionTexts);
			return;
		}
		if (l.level === 2) {
			out.has8 = true;
			current = slot(PREAMBLE, PREAMBLE, i, null);
		} else if (l.level === 3) {
			const m = SLOT_H3.exec(l.title);
			const num = m ? Number(m[1]) : null;
			current = slot(num === null ? l.title : `8.${num}`, l.title, i, num);
			out.h3.push({ line: i, title: l.title, key: current.key });
		} else if (current?.key === PREAMBLE && !l.code) {
			out.preambleLines.push(i);
		}
		const n = countBlanks(l.text, mentionTexts);
		for (let k = 0; k < n; k++) current?.blankLines.push(i);
	});
	return out;
}
