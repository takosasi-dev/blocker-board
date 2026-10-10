// §13 の行のうち、印の文字(unconfirmedMarker)を含む表の行と箇条書きの行を集める(§9.5・FR-7・D-14)。
// 純関数。表の1行目と区切りの行、コードブロックの中は見ない。ID は表なら1列目、箇条書きなら先頭の `[A-Z]+-\d+`。
import { isTableLine, isTableRule, tableCells, type Line } from "./lines";

export interface Unconfirmed { id: string; text: string; line: number }

const LIST = /^\s*[-*]\s/;
const LIST_ID = /^\s*[-*]\s+(?:\*\*)?([A-Z]+-\d+)/;

export function readUnconfirmed(lines: readonly Line[], marker: string): Unconfirmed[] {
	const out: Unconfirmed[] = [];
	if (marker === "") return out;
	let prevTable = false;
	lines.forEach((l, i) => {
		const t = l.text;
		const table = l.section === "13" && !l.code && isTableLine(t);
		const header = table && !prevTable;
		prevTable = table;
		if (l.section !== "13" || l.code || !t.includes(marker)) return;
		if (table) {
			if (header || isTableRule(t)) return;
			const cells = tableCells(t).map((c) => c.trim());
			out.push({ id: cells[0] ?? "", text: cells.slice(1).filter((c) => c !== "").join(" / "), line: i });
		} else if (LIST.test(t)) {
			const id = LIST_ID.exec(t)?.[1] ?? "";
			out.push({ id, text: t.replace(LIST, "").trim(), line: i });
		}
	});
	return out;
}
