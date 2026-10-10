// Obsidian の Vault と metadataCache を読むのはこのファイルだけ(§2)。本文は cachedRead だけで読む(INV-4)。
// 説明書は metadataCache の frontmatter だけを読む。書き込み系のメソッドは呼ばない(INV-1)。
import type { App, TFile } from "obsidian";
import { isTarget } from "./board";
import type { ManualInfo } from "./parse/state";
import type { Settings } from "./settings";

/** 対象の仕様書(FR-1) */
export function listTargets(app: App, s: Settings): TFile[] {
	return app.vault.getMarkdownFiles().filter((f) => isTarget(f.path, s));
}

/** specFolders のうち vault に無いフォルダ(§10) */
export function missingFolders(app: App, s: Settings): string[] {
	return s.specFolders.filter((f) => app.vault.getFolderByPath(f) === null);
}

export function fileAt(app: App, path: string): TFile | null {
	return app.vault.getFileByPath(path);
}

export async function readText(app: App, file: TFile): Promise<string> {
	return app.vault.cachedRead(file);
}

/** 説明書の状態の値を metadataCache から引く */
export function lookupManual(app: App, path: string, statusKey: string): ManualInfo {
	const file = app.vault.getFileByPath(path);
	if (!file) return { kind: "missing" };
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return { kind: "unloaded" };
	return { kind: "loaded", value: cache.frontmatter?.[statusKey] as unknown };
}
