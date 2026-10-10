// 右サイドバーのパネル(§9.4)。合計・3グループ・欄の無い仕様書・読めなかった仕様書を、畳める組で並べる。
// 要素は createEl / createDiv だけで作り、仕様書の本文は文字として出す(INV-5)。データは plugin が持ち、ここは描くだけ。
// 小節と §13 の行を押すとその行へ移動する(FR-11)。開け閉めは描き直しても保つ。
import { ItemView, type WorkspaceLeaf } from "obsidian";
import { firstPhase, type BoardItem } from "./board";
import { openAt } from "./nav";
import type { PhaseSource, Slot, SpecResult, Unconfirmed } from "./parse";
import type { Group } from "./parse/state";
import type BlockerBoardPlugin from "./main";

export const VIEW_TYPE = "blocker-board-panel";

const GROUP_TITLE: Record<Group, string> = { unknown: "状態不明", other: "その他の状態", implemented: "実装済み" };
const SOURCE_TEXT: Record<PhaseSource, string> = {
	table: "§12 の表", list: "§12 の箇条書き", sentence: "§12 の文", heading: "§8 の小見出し", whole: "§8 全体",
};

/** 「Phase 1(§12 の表・§12 の文)、Phase 3(…)」。空なら「読み取れず」(INV-7) */
export function phaseText(phases: Slot["phases"]): string {
	if (!phases.length) return "読み取れず";
	const by = new Map<string, string[]>();
	for (const h of phases) by.set(h.phase, [...(by.get(h.phase) ?? []), SOURCE_TEXT[h.source]]);
	return [...by].map(([p, src]) => `Phase ${p}(${src.join("・")})`).join("、");
}

const pad = (n: number) => String(n).padStart(2, "0");
const timeText = (d: Date) =>
	`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, "");

export class BoardView extends ItemView {
	private expanded = new Map<string, boolean>();   // open という名前の欄は View の内部と被るので使わない

	constructor(leaf: WorkspaceLeaf, private readonly plugin: BlockerBoardPlugin) {
		super(leaf);
	}

	getViewType(): string { return VIEW_TYPE; }
	getDisplayText(): string { return "実物待ちボード"; }
	getIcon(): string { return "clipboard-list"; }

	async onOpen(): Promise<void> {
		this.render();
	}

	render(): void {
		const p = this.plugin;
		const mark = p.settings.unconfirmedMarker;
		const board = p.board();
		const root = this.contentEl;
		root.empty();
		root.addClass("bb-panel");

		const head = root.createDiv({ cls: "bb-head" });
		const btn = head.createEl("button", { text: "再走査" });
		btn.addEventListener("click", () => void p.rescan());
		const t = board.totals;
		head.createDiv({ cls: "bb-totals", text: `仕様書 ${t.specs} 本 / §8 の欄 ${t.blanks} / 小節 ${t.slots} / §13 ${mark} ${t.unconfirmed}` });
		head.createDiv({ cls: "bb-time", text: p.lastScan ? `最終走査 ${timeText(p.lastScan.at)}(所要 ${p.lastScan.ms} ms)` : "まだ走査していない" });
		for (const f of p.missing) root.createDiv({ cls: "bb-warn", text: `フォルダが見つからない: ${f}` });

		for (const g of board.groups) {
			const body = this.fold(root, "group:" + g.group, g.group !== "implemented", `${GROUP_TITLE[g.group]}(${g.items.length})`, "bb-group");
			if (g.group === "implemented") body.createDiv({ cls: "bb-note", text: p.settings.implementedNote });
			for (const it of g.items) this.renderItem(body, it, mark);
		}

		const empty = this.fold(root, "empty", false,
			`§8 はあるが欄が無い(${board.noBlanks.length}) / §8 が無い(${board.no8.length})`, "bb-group");
		this.renderPlainList(empty, "§8 はあるが欄が無い", board.noBlanks);
		this.renderPlainList(empty, "§8 が無い", board.no8);

		const failed = this.fold(root, "failed", false, `読めなかった仕様書(${board.failures.length})`, "bb-group");
		for (const f of board.failures) failed.createDiv({ cls: "bb-row bb-fail", text: `${f.path}: ${f.message}` });
	}

	/** 畳める組。開け閉めは key で覚える */
	private fold(parent: HTMLElement, key: string, defaultOpen: boolean, title: string, cls: string): HTMLElement {
		const det = parent.createEl("details", { cls });
		det.open = this.expanded.get(key) ?? defaultOpen;
		det.addEventListener("toggle", () => this.expanded.set(key, det.open));
		det.createEl("summary", { text: title });
		return det;
	}

	private renderItem(parent: HTMLElement, it: BoardItem, mark: string): void {
		const r = it.result;
		const det = parent.createEl("details", { cls: "bb-spec" });
		det.open = this.expanded.get("spec:" + r.path) ?? false;
		det.addEventListener("toggle", () => this.expanded.set("spec:" + r.path, det.open));
		const sum = det.createEl("summary", { attr: { title: r.path } });
		sum.createSpan({ cls: "bb-name", text: baseName(r.path) });
		if (it.state.label) sum.createSpan({ cls: "bb-tag", text: it.state.label });
		const first = firstPhase(r);
		const meta = [`欄 ${it.blanks}`, `小節 ${r.slots.length}`, `${mark} ${r.unconfirmed.length}`];
		if (r.slots.length) meta.push(`最初に止まる ${first === null ? "読み取れず" : "Phase " + first}`);
		sum.createSpan({ cls: "bb-meta", text: meta.join("・") });

		if (r.unclosedFence) det.createDiv({ cls: "bb-warn", text: "コードブロックが閉じていない(以降の §12・§13 は読めない)" });
		for (const s of r.slots) {
			const line = s.blankLines[0] ?? s.headingLine;
			this.row(det, `${s.heading} — 欄 ${s.blankLines.length} — ${phaseText(s.phases)}`, r.path, line, "bb-slot");
		}
		for (const u of r.unconfirmed) this.row(det, unconfirmedText(u), r.path, u.line, "bb-unconfirmed");
		det.createDiv({ cls: "bb-sub", text: `§8 の外の {{…}}: ${r.outsideCount}(実物待ちに数えない)` });
		const manual = it.state.manualPath;
		if (manual) this.row(det, `説明書を開く: ${baseName(manual)}`, manual, 0, "bb-manual");
	}

	private renderPlainList(parent: HTMLElement, title: string, list: SpecResult[]): void {
		parent.createDiv({ cls: "bb-subhead", text: `${title}(${list.length})` });
		for (const r of list) {
			this.row(parent, baseName(r.path), r.path, 0, "bb-plain");
			if (r.unclosedFence) parent.createDiv({ cls: "bb-warn", text: "コードブロックが閉じていない" });
		}
	}

	/** 押すと path の line 行へ移動する行 */
	private row(parent: HTMLElement, text: string, path: string, line: number, cls: string): void {
		const el = parent.createDiv({ cls: "bb-row bb-link " + cls, text, attr: { role: "button", tabindex: "0", title: `${path}(行 ${line + 1})` } });
		const go = () => void openAt(this.app, path, line);
		el.addEventListener("click", go);
		el.addEventListener("keydown", (e) => {
			if (e.key === "Enter") go();
		});
	}
}

/** ID と本文。本文が ID を含んでいれば(箇条書き)そのまま */
function unconfirmedText(u: Unconfirmed): string {
	return u.id && !u.text.includes(u.id) ? `${u.id} ${u.text}` : u.text;
}
