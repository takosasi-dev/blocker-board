// 設定タブ(minAppVersion 1.14.4 なので getSettingDefinitions の宣言型。D-7)。配列と対応表は1行に1つの文字で見せる。
// 保存は Plugin.saveData() だけ(INV-1)。パスは normalizePath を通す(§9.2)。保存したら少し待って走査し直す。
import { normalizePath, PluginSettingTab, type App, type SettingDefinitionItem } from "obsidian";
import type BlockerBoardPlugin from "./main";
import type { Settings } from "./settings";

type ListKey = "specFolders" | "excludePaths" | "mentionTexts" | "implementedStates";
const LIST_KEYS = new Set<string>(["specFolders", "excludePaths", "mentionTexts", "implementedStates"]);
const PATH_KEYS = new Set<string>(["specFolders", "excludePaths"]);
const MAP_SEP = "=>";

const lines = (v: unknown): string[] => String(v).split(/\r?\n/).map((x) => x.trim()).filter((x) => x !== "");

export class BlockerBoardSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly owner: BlockerBoardPlugin) {
		super(app, owner);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{ type: "group", items: [
				{ name: "仕様書のフォルダ", desc: "1行に1つ。vault からのパス。この下の md を読む", control: { type: "textarea", key: "specFolders", rows: 3 } },
				{ name: "除くパス", desc: "1行に1つ。フォルダかファイル。Foo は Foo/ の下だけに効く", control: { type: "textarea", key: "excludePaths", rows: 4 } },
				{ name: "言及として数えない欄の中身", desc: "1行に1つ。インラインコードの中でこの中身の {{…}} は数えない", control: { type: "textarea", key: "mentionTexts", rows: 2 } },
				{ name: "§13 の印", desc: "この文字を含む §13 の行を出す", control: { type: "text", key: "unconfirmedMarker" } },
			] },
			{ type: "group", heading: "実装状態", items: [
				{ name: "説明書のフォルダ", desc: "製品名.md をここで探す", control: { type: "text", key: "manualFolder" } },
				{ name: "説明書の対応表", desc: `1行に1つ「仕様書のパス ${MAP_SEP} 説明書のパス」。右が空なら説明書なし`, control: { type: "textarea", key: "manualMap", rows: 4 } },
				{ name: "状態のプロパティ名", control: { type: "text", key: "statusKey" } },
				{ name: "実装済みにする値", desc: "1行に1つ", control: { type: "textarea", key: "implementedStates", rows: 2 } },
				{ name: "実装済みグループの注記", control: { type: "textarea", key: "implementedNote", rows: 4 } },
			] },
			{ type: "group", heading: "追従", items: [
				{ name: "変更に追従する", desc: "仕様書が変わったら、そのファイルだけ読み直す", control: { type: "toggle", key: "autoUpdate" } },
				{ name: "まとめる間隔(ミリ秒)", desc: "この間の変更をまとめて読み直す", control: { type: "number", key: "updateDelayMs", min: 0,
					validate: (v: number) => (Number.isFinite(v) && v >= 0 ? undefined : "0 以上の数を入れてください") } },
			] },
		];
	}

	getControlValue(key: string): unknown {
		const s = this.owner.settings;
		if (LIST_KEYS.has(key)) return s[key as ListKey].join("\n");
		if (key === "manualMap") return Object.entries(s.manualMap).map(([k, v]) => `${k} ${MAP_SEP} ${v}`.trimEnd()).join("\n");
		return s[key as keyof Settings];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const s = this.owner.settings;
		if (LIST_KEYS.has(key)) {
			const xs = lines(value);
			s[key as ListKey] = PATH_KEYS.has(key) ? xs.map(normalizePath) : xs;
		} else if (key === "manualMap") {
			const map: Record<string, string> = {};
			for (const l of lines(value)) {
				const i = l.indexOf(MAP_SEP);
				if (i <= 0) continue;
				const right = l.slice(i + MAP_SEP.length).trim();
				map[normalizePath(l.slice(0, i).trim())] = right === "" ? "" : normalizePath(right);
			}
			s.manualMap = map;
		} else if (key === "manualFolder") {
			const v = String(value).trim();
			s.manualFolder = v === "" ? "" : normalizePath(v);
		} else if (key === "updateDelayMs") {
			const n = Number(value);
			if (Number.isFinite(n) && n >= 0) s.updateDelayMs = n;
		} else if (key === "autoUpdate") {
			s.autoUpdate = value === true;
		} else if (key === "unconfirmedMarker" || key === "statusKey" || key === "implementedNote") {
			s[key] = String(value);
		}
		await this.owner.saveSettings();
	}
}
