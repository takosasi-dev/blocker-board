// 設定の型・既定値(DEFAULTS)・data.json の読み込みの補い(§9.2・D-5)。既定の文字はこのファイルにだけ書く(INV-9)。
// vault ごとに違うフォルダ(specFolders・manualFolder)の既定は空 = 未設定(入れた人が設定する)。
// obsidian を import しない(テストで読む)。パスの正規化は呼び手が normalizePath を渡す。設定タブは settings-tab.ts。
export interface Settings {
	schemaVersion: 1;
	specFolders: string[];
	excludePaths: string[];
	mentionTexts: string[];
	unconfirmedMarker: string;
	manualFolder: string;
	manualMap: Record<string, string>;
	statusKey: string;
	implementedStates: string[];
	implementedNote: string;
	autoUpdate: boolean;
	updateDelayMs: number;
}

export const DEFAULTS: Settings = {
	schemaVersion: 1,
	specFolders: [],                               // 未設定(空のあいだは1本も読まない)
	excludePaths: [],                              // 仕様書でない md を除くかは §13 Q-7(私が決める)
	mentionTexts: ["...", "…"],
	unconfirmedMarker: "未確認",
	manualFolder: "",                              // 未設定(空のあいだは manualMap だけを見る)
	manualMap: {},                                 // 仮決め: 空(候補は NOTES.md)
	statusKey: "状態",
	implementedStates: ["実装完了"],
	implementedNote: "このグループのツールは実装済み。欄は実データでの確認待ちの印。",
	autoUpdate: true,                              // 仮決め(§8.7 は未計測)
	updateDelayMs: 1000,                           // 仮決め(§8.7 は未計測)
};

function copyDefaults(): Settings {
	return JSON.parse(JSON.stringify(DEFAULTS)) as Settings;
}

/**
 * data.json の中身を Settings にする。欠けた項目は既定値で埋める。
 * 形が壊れている・schemaVersion が違うときは既定値と problem=true を返す(呼び手が Notice を出し、data.json は上書きしない)。
 */
export function normalizeSettings(raw: unknown, norm: (p: string) => string): { settings: Settings; problem: boolean } {
	const base = copyDefaults();
	if (raw === null || raw === undefined) return { settings: base, problem: false };
	if (typeof raw !== "object" || Array.isArray(raw)) return { settings: base, problem: true };
	const r = raw as Record<string, unknown>;
	if (r.schemaVersion !== undefined && r.schemaVersion !== 1) return { settings: base, problem: true };
	const str = (k: keyof Settings): string => (typeof r[k] === "string" ? r[k] : base[k] as string);
	const bool = (k: keyof Settings): boolean => (typeof r[k] === "boolean" ? r[k] : base[k] as boolean);
	const list = (k: keyof Settings): string[] => {
		const v = r[k];
		return Array.isArray(v) && v.every((x) => typeof x === "string") ? v : base[k] as string[];
	};
	const paths = (xs: string[]) => xs.map((x) => x.trim()).filter((x) => x !== "").map(norm);
	const map: Record<string, string> = {};
	const rawMap = r.manualMap;
	if (rawMap && typeof rawMap === "object" && !Array.isArray(rawMap)) {
		for (const [k, v] of Object.entries(rawMap as Record<string, unknown>)) {
			if (typeof v === "string" && k.trim() !== "") map[norm(k.trim())] = v.trim() === "" ? "" : norm(v.trim());
		}
	}
	const delay = typeof r.updateDelayMs === "number" && Number.isFinite(r.updateDelayMs) && r.updateDelayMs >= 0
		? r.updateDelayMs : base.updateDelayMs;
	const folder = str("manualFolder").trim();
	return {
		settings: {
			schemaVersion: 1,
			specFolders: paths(list("specFolders")),
			excludePaths: paths(list("excludePaths")),
			mentionTexts: list("mentionTexts"),
			unconfirmedMarker: str("unconfirmedMarker"),
			manualFolder: folder === "" ? "" : norm(folder),
			manualMap: map,
			statusKey: str("statusKey"),
			implementedStates: list("implementedStates"),
			implementedNote: str("implementedNote"),
			autoUpdate: bool("autoUpdate"),
			updateDelayMs: delay,
		},
		problem: false,
	};
}
