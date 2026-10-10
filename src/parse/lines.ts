// 本文を行に分け、コードブロックの内外・見出し・H2 の節番号を1回の読みで決める(§9.5「行と節」・D-11)。
// 純関数。obsidian を import しない。コードブロックの中の見出しは見出しにしない。
export interface Line {
	text: string;
	/** フェンスの行か、コードブロックの中 */
	code: boolean;
	/** 見出しの深さ。見出しでなければ 0 */
	level: number;
	/** 見出しの文字列(見出しでなければ "") */
	title: string;
	/** 属する H2 の節番号(H2 の文字列の先頭の数字)。最初の H2 より前と、数字で始まらない H2 の下は null */
	section: string | null;
}

export interface LineScan {
	lines: Line[];
	unclosedFence: boolean;
}

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const SECTION_NO = /^\d+/;

export function scanLines(text: string): LineScan {
	let code = false;
	let section: string | null = null;
	const lines = text.split("\n").map((raw): Line => {
		const t = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
		if (FENCE.test(t)) {
			code = !code;
			return { text: t, code: true, level: 0, title: "", section };
		}
		const h = code ? null : HEADING.exec(t);
		if (!h) return { text: t, code, level: 0, title: "", section };
		const level = (h[1] ?? "").length;
		const title = h[2] ?? "";
		if (level === 2) section = SECTION_NO.exec(title)?.[0] ?? null;
		return { text: t, code: false, level, title, section };
	});
	return { lines, unclosedFence: code };
}

/** 表の行(`|` で始まる行) */
export const isTableLine = (t: string): boolean => /^\s*\|/.test(t);

/** 表の区切りの行(`|---|---|` の形) */
export const isTableRule = (t: string): boolean => /^\s*\|[\s:|-]*$/.test(t) && t.includes("-");

/** 表の行をセルに分ける(両端の `|` を外して `|` で切る) */
export function tableCells(t: string): string[] {
	let s = t.trim();
	if (s.startsWith("|")) s = s.slice(1);
	if (s.endsWith("|")) s = s.slice(0, -1);
	return s.split("|");
}
