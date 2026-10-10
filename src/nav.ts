// 仕様書を開いて、指定の行(0 始まり)にカーソルを置き画面に出す(FR-11)。
// 方法は §8.6 で d.ts から決めた MarkdownView の editor(setCursor と scrollIntoView)。行がずれていても移動はそのまま行う(§10)。
import { MarkdownView, Notice, type App } from "obsidian";
import { fileAt } from "./source";

export async function openAt(app: App, path: string, line: number): Promise<void> {
	const file = fileAt(app, path);
	if (!file) {
		new Notice(`ファイルが見つからない: ${path}`);
		return;
	}
	const leaf = app.workspace.getLeaf(false);
	await leaf.openFile(file);
	if (!(leaf.view instanceof MarkdownView)) return;
	const editor = leaf.view.editor;
	const pos = { line: Math.max(0, Math.min(line, editor.lineCount() - 1)), ch: 0 };
	editor.setCursor(pos);
	editor.scrollIntoView({ from: pos, to: pos }, true);
}
