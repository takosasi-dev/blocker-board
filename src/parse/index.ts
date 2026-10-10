// 仕様書1本の解析(行 → 欄 → フェーズ → §13)と、まとめての解析。結果の型は §9.6。純関数。
// 1本ごとに try/catch し、落ちた仕様書は ParseFailure で返して他は続ける(INV-6・FR-14)。
import { scanLines } from "./lines";
import { readPhases, type PhaseSource } from "./phases";
import { scanSlots } from "./slots";
import { productOf } from "./state";
import { readUnconfirmed, type Unconfirmed } from "./unconfirmed";

export type { PhaseSource } from "./phases";
export type { Unconfirmed } from "./unconfirmed";

export interface Slot {
	key: string;
	heading: string;
	headingLine: number;
	blankLines: number[];
	/** 空 = 読み取れず */
	phases: { phase: string; source: PhaseSource }[];
}

export interface SpecResult {
	path: string;
	product: string;
	has8: boolean;
	/** 欄のある小節だけ(現れた順) */
	slots: Slot[];
	outsideCount: number;
	unconfirmed: Unconfirmed[];
	unclosedFence: boolean;
}

export interface ParseFailure { path: string; message: string }

export interface ParseOptions { mentionTexts: readonly string[]; unconfirmedMarker: string }

export function parseSpec(path: string, text: string, opt: ParseOptions): SpecResult {
	const { lines, unclosedFence } = scanLines(text);
	const scan = scanSlots(lines, opt.mentionTexts);
	const phases = readPhases(lines, scan);
	const slots = scan.slots
		.filter((s) => s.blankLines.length > 0)
		.map((s): Slot => ({ key: s.key, heading: s.heading, headingLine: s.headingLine, blankLines: s.blankLines,
			phases: phases.get(s.key) ?? [] }));
	return {
		path, product: productOf(path), has8: scan.has8, slots, outsideCount: scan.outsideCount,
		unconfirmed: readUnconfirmed(lines, opt.unconfirmedMarker), unclosedFence,
	};
}

export function parseOne(path: string, text: string, opt: ParseOptions): SpecResult | ParseFailure {
	try {
		return parseSpec(path, text, opt);
	} catch (e) {
		return { path, message: e instanceof Error ? e.message : String(e) };
	}
}

export const isFailure = (r: SpecResult | ParseFailure): r is ParseFailure => "message" in r;

export function parseAll(inputs: readonly { path: string; text: string }[], opt: ParseOptions):
	{ results: SpecResult[]; failures: ParseFailure[] } {
	const results: SpecResult[] = [];
	const failures: ParseFailure[] = [];
	for (const { path, text } of inputs) {
		const r = parseOne(path, text, opt);
		if (isFailure(r)) failures.push(r);
		else results.push(r);
	}
	return { results, failures };
}
