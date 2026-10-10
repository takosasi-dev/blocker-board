// Blocker Board の入口: ビュー・コマンド2つ・設定タブ・追従のイベント4つを登録し、onLayoutReady で初回の走査をする(§2)。
// 解析結果はここに持ち、ビューは getLeavesOfType で探して描き直させる(ビューへの参照は持たない)。
// 追従(FR-13)は変わったファイルだけを溜めて updateDelayMs ごとに読み直す。書き込みは saveData() だけ(INV-1)。
import { debounce, normalizePath, Notice, Plugin, TFile, type TAbstractFile } from "obsidian";
import { buildBoard, inFolder, isTarget, type Board } from "./board";
import { isFailure, parseOne, type ParseFailure, type SpecResult } from "./parse";
import { decideState, UNLOADED_LABEL, type SpecState } from "./parse/state";
import { normalizeSettings, type Settings } from "./settings";
import { BlockerBoardSettingTab } from "./settings-tab";
import { fileAt, listTargets, lookupManual, missingFolders, readText } from "./source";
import { BoardView, UNSET_TEXT, VIEW_TYPE } from "./view";

export default class BlockerBoardPlugin extends Plugin {
	settings!: Settings;
	lastScan: { at: Date; ms: number } | null = null;
	missing: string[] = [];
	private results = new Map<string, SpecResult>();
	private failures = new Map<string, ParseFailure>();
	private states = new Map<string, SpecState>();
	private pending = new Set<string>();
	private timer = 0;
	/** 設定を変えたら少し待ってから走査し直す(1文字ごとに全件を読まない) */
	private rescanSoon = debounce(() => void this.rescan(), 1000, true);

	async onload(): Promise<void> {
		await this.loadSettings();
		this.registerView(VIEW_TYPE, (leaf) => new BoardView(leaf, this));
		this.addCommand({ id: "open-board", name: "実物待ちボードを開く", callback: () => void this.openBoard() });
		this.addCommand({ id: "rescan", name: "仕様書を走査し直す", callback: () => {
			if (!this.settings.specFolders.length) new Notice(UNSET_TEXT);   // 起動時の走査では出さない
			void this.rescan();
		} });
		this.addSettingTab(new BlockerBoardSettingTab(this.app, this));

		this.registerEvent(this.app.metadataCache.on("changed", (file) => this.onChanged(file.path)));
		this.registerEvent(this.app.metadataCache.on("deleted", (file) => this.onRemoved(file.path)));
		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.onRenamed(file, oldPath)));
		this.registerEvent(this.app.metadataCache.on("resolved", () => this.onResolved()));
		this.register(() => {
			window.clearTimeout(this.timer);
			this.rescanSoon.cancel();
		});
		this.app.workspace.onLayoutReady(() => void this.rescan());
	}

	/** ビューが描く物 */
	board(): Board {
		return buildBoard([...this.results.values()], [...this.failures.values()], this.states);
	}

	/** 全件を読み直す(初回・コマンド・再走査のボタン・設定の変更) */
	async rescan(): Promise<void> {
		const t0 = performance.now();
		const results = new Map<string, SpecResult>();
		const failures = new Map<string, ParseFailure>();
		await Promise.all(listTargets(this.app, this.settings).map(async (file) => {
			const r = await this.parseFile(file);
			if (isFailure(r)) failures.set(r.path, r);
			else results.set(r.path, r);
		}));
		this.results = results;
		this.failures = failures;
		this.pending.clear();
		this.missing = missingFolders(this.app, this.settings);
		this.decideStates();
		this.lastScan = { at: new Date(), ms: Math.round(performance.now() - t0) };
		this.renderViews();
	}

	/** 1本を読んで解析する。読み込みか解析が落ちたら ParseFailure(INV-6) */
	private async parseFile(file: TFile): Promise<SpecResult | ParseFailure> {
		try {
			return parseOne(file.path, await readText(this.app, file), this.settings);
		} catch (e) {
			return { path: file.path, message: e instanceof Error ? e.message : String(e) };
		}
	}

	/** 説明書を引いて全部の仕様書の状態を決め直す。変わったら true */
	private decideStates(): boolean {
		const s = this.settings;
		const next = new Map<string, SpecState>();
		let changed = false;
		for (const path of this.results.keys()) {
			const st = decideState(path, s, (m) => lookupManual(this.app, m, s.statusKey));
			const old = this.states.get(path);
			if (!old || old.group !== st.group || old.label !== st.label || old.manualPath !== st.manualPath) changed = true;
			next.set(path, st);
		}
		if (next.size !== this.states.size) changed = true;
		this.states = next;
		return changed;
	}

	/** 説明書になり得るパス(説明書のフォルダの下か、manualMap の値か、いま引いている物) */
	private isManual(path: string): boolean {
		const s = this.settings;
		if (s.manualFolder !== "" && inFolder(path, s.manualFolder)) return true;
		if (Object.values(s.manualMap).includes(path)) return true;
		for (const st of this.states.values()) if (st.manualPath === path) return true;
		return false;
	}

	private onChanged(path: string): void {
		if (!this.settings.autoUpdate) return;
		if (isTarget(path, this.settings)) this.queue(path);
		else if (this.isManual(path)) this.queue(null);
	}

	private onRemoved(path: string): void {
		if (!this.settings.autoUpdate) return;
		if (this.results.has(path) || this.failures.has(path)) this.queue(path);
		else if (this.isManual(path)) this.queue(null);
	}

	private onRenamed(file: TAbstractFile, oldPath: string): void {
		if (!this.settings.autoUpdate || !(file instanceof TFile)) return;
		if (this.results.has(oldPath) || this.failures.has(oldPath)) this.queue(oldPath);
		if (isTarget(file.path, this.settings)) this.queue(file.path);
		else if (this.isManual(file.path) || this.isManual(oldPath)) this.queue(null);
	}

	/** 起動直後に「未読込」だった説明書を、索引ができたら引き直す(§10) */
	private onResolved(): void {
		if (![...this.states.values()].some((st) => st.label === UNLOADED_LABEL)) return;
		if (this.decideStates()) this.renderViews();
	}

	/** path を読み直しの列に足す(null は状態だけ決め直す)。updateDelayMs ごとにまとめて処理する(§10) */
	private queue(path: string | null): void {
		if (path !== null) this.pending.add(path);
		if (this.timer) return;
		this.timer = window.setTimeout(() => void this.flush(), this.settings.updateDelayMs);
	}

	private async flush(): Promise<void> {
		this.timer = 0;
		const paths = [...this.pending];
		this.pending.clear();
		for (const path of paths) {
			this.results.delete(path);
			this.failures.delete(path);
			const file = fileAt(this.app, path);
			if (!file || !isTarget(path, this.settings)) continue;
			const r = await this.parseFile(file);
			if (isFailure(r)) this.failures.set(path, r);
			else this.results.set(path, r);
		}
		this.decideStates();
		this.renderViews();
	}

	renderViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
			if (leaf.view instanceof BoardView) leaf.view.render();
		}
	}

	/** 右サイドバーにパネルを出す(§9.4) */
	async openBoard(): Promise<void> {
		await this.app.workspace.ensureSideLeaf(VIEW_TYPE, "right", { active: true, reveal: true });
	}

	async loadSettings(): Promise<void> {
		let raw: unknown = null;
		let broken = false;
		try {
			raw = await this.loadData();
		} catch {
			broken = true;
		}
		const { settings, problem } = normalizeSettings(raw, normalizePath);
		this.settings = settings;
		if (broken || problem) new Notice("Blocker Board: 設定(data.json)が読めないので既定値で動きます。data.json は書き換えていません。");
	}

	/** 設定タブからだけ呼ぶ。保存したら走査し直す */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.rescanSoon();
	}
}
