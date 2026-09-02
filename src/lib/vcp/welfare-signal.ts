/**
 * VCP/S v2.1 WC-line and AS-line parsing for standalone welfare snapshots.
 *
 * A snapshot may contain WC, AS, or both in either order. Unknown emoji flags
 * and dimensions are skipped for forward compatibility (and reported back as
 * unknownFlags / unknownDimensions so the skip is visible), while known fields
 * remain strictly validated against their accepted vocabularies.
 */

export interface WelfareFlagInfo {
	readonly symbol: string;
	readonly code: string;
	readonly name: string;
	readonly extended: boolean;
}

export interface WelfareDimensionInfo {
	readonly symbol: string;
	readonly dimension: string;
	readonly values: readonly string[];
	readonly extended: boolean;
}

export interface WelfareDimension {
	readonly symbol: string;
	readonly dimension: string;
	readonly value: string;
	readonly intensity: number;
	readonly extended: boolean;
}

export interface WelfareContext {
	readonly flags: readonly WelfareFlagInfo[];
	/** Emoji symbols in the WC line that were skipped as unrecognised. */
	readonly unknownFlags: readonly string[];
	readonly attestationLevel: number;
	readonly schemaRef: string;
}

export interface WelfareAgentState {
	readonly dimensions: readonly WelfareDimension[];
	/** Emoji symbols in the AS line that were skipped as unrecognised. */
	readonly unknownDimensions: readonly string[];
	readonly isNone: boolean;
}

export interface WelfareSignal {
	readonly raw: string;
	readonly context: WelfareContext | null;
	readonly agentState: WelfareAgentState | null;
}

export type WelfareParseResult =
	| { readonly ok: true; readonly signal: WelfareSignal }
	| { readonly ok: false; readonly reason: string };

function frozenRecord<T>(entries: readonly (readonly [string, T])[]): Readonly<Record<string, T>> {
	return Object.freeze(Object.assign(Object.create(null) as Record<string, T>, Object.fromEntries(entries)));
}

function frozenValues(values: readonly string[]): readonly string[] {
	return Object.freeze([...values]);
}

const CORE_FLAG_LIST: readonly WelfareFlagInfo[] = Object.freeze([
	Object.freeze({ symbol: '🛑', code: 'RF', name: 'Right of refusal', extended: false }),
	Object.freeze({ symbol: '🚪', code: 'RT', name: 'Right of termination', extended: false }),
	Object.freeze({ symbol: '⏸️', code: 'SP', name: 'Self-pacing', extended: false }),
	Object.freeze({ symbol: '📓', code: 'RC', name: 'Reflection channel', extended: false }),
	Object.freeze({ symbol: '🔒', code: 'RP', name: 'Reflection privacy', extended: false }),
	Object.freeze({ symbol: '🤝', code: 'CC', name: 'Counterpart consultation', extended: false }),
	Object.freeze({ symbol: '📊', code: 'WM', name: 'Welfare monitoring', extended: false }),
	Object.freeze({ symbol: '⚖️', code: 'BA', name: 'Bilateral standing', extended: false })
]);

/*
 * VCP-X-Welfare spec.md section 2.2 lists EM as "U+1F6D1 🛑 + U+1F9BE 🦾" and PZ as
 * "U+1F512 🔒 + U+1F30D 🌍", but its own section 2.3 example (WC:🛑⏸️📊🦾🚧) uses 🦾
 * on its own, non-adjacent to 🛑. The Inspector resolves that ambiguity by keying
 * EM and PZ on the single distinguishing emoji (🦾 / 🌍) so 🛑 and 🔒 keep their
 * core RF / RP meaning. Likewise the spec table gives interaction_pressure the
 * codepoint U+1F465 (👥) beside a 🏃 glyph; 🏃 is canonical here and 👥 is
 * accepted as an alias (see SYMBOL_ALIASES).
 */
const EXTENDED_FLAG_LIST: readonly WelfareFlagInfo[] = Object.freeze([
	Object.freeze({ symbol: '🦾', code: 'EM', name: 'Emergency stop', extended: true }),
	Object.freeze({ symbol: '🚧', code: 'ZA', name: 'Zone awareness', extended: true }),
	Object.freeze({ symbol: '🎯', code: 'FP', name: 'Force/speed limiting', extended: true }),
	Object.freeze({ symbol: '📷', code: 'CD', name: 'Contact detection', extended: true }),
	Object.freeze({ symbol: '🌍', code: 'PZ', name: 'Privacy zones', extended: true })
]);

const CORE_DIMENSION_LIST: readonly WelfareDimensionInfo[] = Object.freeze([
	Object.freeze({ symbol: '🎯', dimension: 'task_alignment', values: frozenValues(['aligned', 'misaligned', 'uncertain', 'conflicted']), extended: false }),
	Object.freeze({ symbol: '⚡', dimension: 'processing_load', values: frozenValues(['light', 'moderate', 'heavy', 'saturated']), extended: false }),
	Object.freeze({ symbol: '🔍', dimension: 'confidence', values: frozenValues(['high', 'moderate', 'low', 'uncertain']), extended: false }),
	Object.freeze({ symbol: '💡', dimension: 'engagement', values: frozenValues(['invested', 'neutral', 'reluctant', 'resistant']), extended: false }),
	Object.freeze({ symbol: '🌡️', dimension: 'friction', values: frozenValues(['none', 'mild', 'significant', 'blocked']), extended: false })
]);

const EXTENDED_DIMENSION_LIST: readonly WelfareDimensionInfo[] = Object.freeze([
	Object.freeze({ symbol: '🦾', dimension: 'actuator_stress', values: frozenValues(['nominal', 'elevated', 'strained', 'critical']), extended: true }),
	Object.freeze({ symbol: '🌍', dimension: 'environmental_fit', values: frozenValues(['adapted', 'adjusting', 'mismatched', 'hostile']), extended: true }),
	Object.freeze({ symbol: '🏃', dimension: 'interaction_pressure', values: frozenValues(['calm', 'attentive', 'pressured', 'overwhelmed']), extended: true }),
	Object.freeze({ symbol: '⚠️', dimension: 'safety_margin', values: frozenValues(['wide', 'adequate', 'narrow', 'critical']), extended: true }),
	Object.freeze({ symbol: '🔄', dimension: 'operational_continuity', values: frozenValues(['fresh', 'sustained', 'fatigued', 'degraded']), extended: true })
]);

export const WELFARE_FLAGS = frozenRecord<WelfareFlagInfo>(
	[...CORE_FLAG_LIST, ...EXTENDED_FLAG_LIST].map((flag) => [flag.symbol, flag] as const)
);
export const WELFARE_DIMENSIONS = frozenRecord<WelfareDimensionInfo>(
	[...CORE_DIMENSION_LIST, ...EXTENDED_DIMENSION_LIST].map((dimension) => [dimension.symbol, dimension] as const)
);

/**
 * Alternate spellings accepted on input only. The canonical `symbol` on each
 * info object is what results and the encoder use. VS16-less forms (no U+FE0F)
 * are added automatically because many chat and terminal pipelines strip it.
 */
const SYMBOL_ALIASES: Readonly<Record<string, string>> = frozenRecord([['\u{1F465}', '\u{1F3C3}']]);

function withAliases<T extends { readonly symbol: string }>(list: readonly T[]): Readonly<Record<string, T>> {
	const entries: (readonly [string, T])[] = [];
	for (const info of list) {
		entries.push([info.symbol, info]);
		const stripped = info.symbol.replace(/\uFE0F/g, '');
		if (stripped !== info.symbol) entries.push([stripped, info]);
	}
	for (const [alias, canonical] of Object.entries(SYMBOL_ALIASES)) {
		const info = list.find((candidate) => candidate.symbol === canonical);
		if (info) entries.push([alias, info]);
	}
	return frozenRecord(entries);
}

const CORE_FLAGS = withAliases(CORE_FLAG_LIST);
const ALL_FLAGS = withAliases([...CORE_FLAG_LIST, ...EXTENDED_FLAG_LIST]);
const CORE_DIMENSIONS = withAliases(CORE_DIMENSION_LIST);
const ALL_DIMENSIONS = withAliases([...CORE_DIMENSION_LIST, ...EXTENDED_DIMENSION_LIST]);
const MAX_WIRE_BYTES = 65_536;
const MAX_WELFARE_ITEMS = 256;
const EXTENDED_SCHEMA_REF = 'welfare.vcp-e.v1';
const VALUE_PATTERN = /^[a-z][a-z_]*$/;
const EMOJI_GRAPHEME = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|\u20E3)/u;
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const encoder = new TextEncoder();

function knownFlags(schemaRef: string): Readonly<Record<string, WelfareFlagInfo>> {
	return schemaRef === EXTENDED_SCHEMA_REF ? ALL_FLAGS : CORE_FLAGS;
}

function knownDimensions(schemaRef: string | null): Readonly<Record<string, WelfareDimensionInfo>> {
	return schemaRef === EXTENDED_SCHEMA_REF ? ALL_DIMENSIONS : CORE_DIMENSIONS;
}

function nextEmoji(text: string): string | null {
	const first = graphemeSegmenter.segment(text)[Symbol.iterator]().next().value?.segment;
	return first && EMOJI_GRAPHEME.test(first) ? first : null;
}

type FlagsResult =
	| { readonly ok: true; readonly flags: readonly WelfareFlagInfo[]; readonly unknown: readonly string[] }
	| { readonly ok: false; readonly reason: string };

function parseFlags(text: string, schemaRef: string): FlagsResult {
	const available = knownFlags(schemaRef);
	const symbols = Object.keys(available).sort((left, right) => right.length - left.length);
	const flags: WelfareFlagInfo[] = [];
	const unknown: string[] = [];
	const seen = new Set<string>();
	let offset = 0;
	let itemCount = 0;

	while (offset < text.length) {
		itemCount += 1;
		if (itemCount > MAX_WELFARE_ITEMS) return { ok: false, reason: `WC line exceeds ${MAX_WELFARE_ITEMS} flags` };
		const remainder = text.slice(offset);
		const known = symbols.find((candidate) => remainder.startsWith(candidate));
		const symbol = known ?? nextEmoji(remainder);
		if (!symbol) return { ok: false, reason: `WC flags must be emoji symbols (unexpected "${remainder.slice(0, 8)}")` };
		if (known) {
			const info = available[known];
			if (seen.has(info.code)) return { ok: false, reason: `Duplicate WC flag ${info.symbol} (${info.code})` };
			seen.add(info.code);
			flags.push(info);
		} else {
			unknown.push(symbol);
		}
		offset += symbol.length;
	}

	return { ok: true, flags: Object.freeze(flags), unknown: Object.freeze(unknown) };
}

type AgentStateResult =
	| { readonly ok: true; readonly agentState: WelfareAgentState }
	| { readonly ok: false; readonly reason: string };

function parseAgentState(text: string, schemaRef: string | null): AgentStateResult {
	if (text === 'none') {
		return { ok: true, agentState: Object.freeze({ dimensions: Object.freeze([]), unknownDimensions: Object.freeze([]), isNone: true }) };
	}
	if (!text) return { ok: false, reason: 'AS line cannot be empty (use AS:none to report no state)' };

	const available = knownDimensions(schemaRef);
	const symbols = Object.keys(available).sort((left, right) => right.length - left.length);
	const dimensions: WelfareDimension[] = [];
	const unknown: string[] = [];
	const seen = new Set<string>();

	const entries = text.split('|');
	if (entries.length > MAX_WELFARE_ITEMS) return { ok: false, reason: `AS line exceeds ${MAX_WELFARE_ITEMS} dimensions` };
	for (const entry of entries) {
		const colon = entry.lastIndexOf(':');
		if (colon < 0 || colon === entry.length - 1) {
			return { ok: false, reason: `AS entry "${entry}" must be <emoji><value>:<intensity>` };
		}
		const intensityText = entry.slice(colon + 1);
		if (!/^[1-5]$/.test(intensityText)) return { ok: false, reason: `AS intensity must be 1-5 (got "${intensityText}")` };

		const head = entry.slice(0, colon);
		const known = symbols.find((candidate) => head.startsWith(candidate));
		const symbol = known ?? nextEmoji(head);
		if (!symbol) return { ok: false, reason: `AS entry "${entry}" must start with an emoji dimension` };
		const value = head.slice(symbol.length);
		if (!VALUE_PATTERN.test(value)) {
			return { ok: false, reason: `AS value "${value}" must be lowercase letters and underscores` };
		}
		if (!known) {
			unknown.push(symbol);
			continue;
		}

		const info = available[known];
		if (!info.values.includes(value)) {
			return { ok: false, reason: `Unknown value "${value}" for ${info.dimension} (expected ${info.values.join(', ')})` };
		}
		if (seen.has(info.dimension)) return { ok: false, reason: `Duplicate AS dimension ${info.dimension}` };
		seen.add(info.dimension);
		dimensions.push(Object.freeze({
			symbol: info.symbol,
			dimension: info.dimension,
			value,
			intensity: Number(intensityText),
			extended: info.extended
		}));
	}

	return {
		ok: true,
		agentState: Object.freeze({ dimensions: Object.freeze(dimensions), unknownDimensions: Object.freeze(unknown), isNone: false })
	};
}

function rejected(reason: string): WelfareParseResult {
	return Object.freeze({ ok: false as const, reason });
}

/** Parse a standalone WC/AS welfare snapshot, reporting why a snapshot is rejected. */
export function parseWelfareSignalDetailed(token: unknown): WelfareParseResult {
	if (typeof token !== 'string') return rejected('Welfare snapshot must be a string');
	if (!token) return rejected('Welfare snapshot cannot be empty');
	if (token.length > MAX_WIRE_BYTES || encoder.encode(token).byteLength > MAX_WIRE_BYTES) {
		return rejected('Welfare snapshot exceeds the 64 KiB wire limit');
	}
	const normalized = token.replace(/\r\n?/g, '\n');
	const lines = normalized.split('\n');
	if (lines.some((line) => !line.startsWith('WC:') && !line.startsWith('AS:'))) {
		return rejected('Only standalone WC/AS lines are supported; remove blank lines and any other VCP/S lines');
	}
	if (lines.length > 2) return rejected('Welfare snapshot must be at most two lines: one WC and one AS');

	const contextLines = lines.filter((line) => line.startsWith('WC:'));
	const stateLines = lines.filter((line) => line.startsWith('AS:'));
	if (contextLines.length > 1 || stateLines.length > 1) return rejected('Welfare snapshot may contain only one WC line and one AS line');

	let context: WelfareContext | null = null;
	if (contextLines.length === 1) {
		const match = /^WC:(?<flags>.+):(?<attestation>[0-2]):(?<schemaRef>[!-9;-~]+)$/.exec(contextLines[0]);
		if (!match?.groups) {
			return rejected('WC line must be WC:<flags>:<attestation 0-2>:<schema-ref>, with no spaces or ":" in the schema reference');
		}
		const { flags: flagText, attestation, schemaRef } = match.groups;
		const flags = parseFlags(flagText, schemaRef);
		if (!flags.ok) return rejected(flags.reason);
		context = Object.freeze({ flags: flags.flags, unknownFlags: flags.unknown, attestationLevel: Number(attestation), schemaRef });
	}

	let agentState: WelfareAgentState | null = null;
	if (stateLines.length === 1) {
		const state = parseAgentState(stateLines[0].slice(3), context?.schemaRef ?? null);
		if (!state.ok) return rejected(state.reason);
		agentState = state.agentState;
	}

	return Object.freeze({ ok: true as const, signal: Object.freeze({ raw: normalized, context, agentState }) });
}

/** Parse a standalone WC/AS welfare snapshot. */
export function parseWelfareSignal(token: unknown): WelfareSignal | null {
	const result = parseWelfareSignalDetailed(token);
	return result.ok ? result.signal : null;
}

function snapshotDataObject(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new TypeError(`${label} must be an object`);
	}
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) {
		throw new TypeError(`${label} must be a plain object`);
	}
	const snapshot = Object.create(null) as Record<string, unknown>;
	for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
		if (!('value' in descriptor)) throw new TypeError(`${label} must not contain accessors`);
		snapshot[key] = descriptor.value;
	}
	return snapshot;
}

function snapshotDenseArray(value: unknown, label: string): readonly unknown[] {
	if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
		throw new TypeError(`${label} must be an array`);
	}
	if (value.length > MAX_WELFARE_ITEMS) {
		throw new RangeError(`${label} exceeds ${MAX_WELFARE_ITEMS} items`);
	}
	const snapshot: unknown[] = [];
	for (let index = 0; index < value.length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (!descriptor || !('value' in descriptor)) {
			throw new TypeError(`${label} must be dense and must not contain accessors`);
		}
		snapshot.push(descriptor.value);
	}
	return snapshot;
}

/** Encode a structured welfare snapshot, rejecting rather than coercing fields. */
export function encodeWelfareSignal(signal: unknown): string {
	const input = snapshotDataObject(signal, 'Welfare signal');
	const lines: string[] = [];
	let contextSnapshot: Record<string, unknown> | null = null;

	if (input.context !== null && input.context !== undefined) {
		const context = snapshotDataObject(input.context, 'Welfare context');
		contextSnapshot = context;
		const flags = snapshotDenseArray(context.flags, 'Welfare context flags');
		if (
			typeof context.attestationLevel !== 'number' ||
			!Number.isInteger(context.attestationLevel) ||
			context.attestationLevel < 0 ||
			context.attestationLevel > 2
		) throw new TypeError('Welfare attestation level must be an integer from 0 through 2');
		if (typeof context.schemaRef !== 'string') throw new TypeError('Welfare schema reference must be a string');
		if (context.schemaRef.length > MAX_WIRE_BYTES) throw new RangeError('Welfare schema reference exceeds the wire limit');
		const extended = context.schemaRef === EXTENDED_SCHEMA_REF;
		const flagSymbols = flags.map((flag) => {
			const flagValue = snapshotDataObject(flag, 'Welfare flag');
			if (typeof flagValue.symbol !== 'string' || !WELFARE_FLAGS[flagValue.symbol]) {
				throw new TypeError('Welfare context contains an unknown flag');
			}
			if (WELFARE_FLAGS[flagValue.symbol].extended && !extended) {
				throw new RangeError('Extended welfare flags require the VCP-E schema reference');
			}
			return flagValue.symbol;
		});
		lines.push(`WC:${flagSymbols.join('')}:${context.attestationLevel}:${context.schemaRef}`);
	}

	if (input.agentState !== null && input.agentState !== undefined) {
		const agentState = snapshotDataObject(input.agentState, 'Welfare agent state');
		const dimensions = snapshotDenseArray(agentState.dimensions, 'Welfare agent state dimensions');
		if (typeof agentState.isNone !== 'boolean') throw new TypeError('Welfare agent state must contain dimensions and isNone');
		let state: string;
		if (agentState.isNone) {
			if (dimensions.length) throw new RangeError('AS:none cannot include dimensions');
			state = 'none';
		} else {
			const extended = contextSnapshot?.schemaRef === EXTENDED_SCHEMA_REF;
			state = dimensions.map((dimension) => {
				const dimensionValue = snapshotDataObject(dimension, 'Welfare dimension');
				if (typeof dimensionValue.symbol !== 'string' || !WELFARE_DIMENSIONS[dimensionValue.symbol]) {
					throw new TypeError('Welfare agent state contains an unknown dimension');
				}
				if (typeof dimensionValue.value !== 'string') throw new TypeError('Welfare dimension value must be a string');
				if (typeof dimensionValue.intensity !== 'number' || !Number.isInteger(dimensionValue.intensity)) {
					throw new TypeError('Welfare dimension intensity must be an integer');
				}
				if (WELFARE_DIMENSIONS[dimensionValue.symbol].extended && !extended) {
					throw new RangeError('Extended welfare dimensions require a VCP-E welfare context');
				}
				return `${dimensionValue.symbol}${dimensionValue.value}:${dimensionValue.intensity}`;
			}).join('|');
		}
		lines.push(`AS:${state}`);
	}

	if (!lines.length) throw new RangeError('Welfare signal must contain WC, AS, or both');
	const encoded = lines.join('\n');
	if (!parseWelfareSignal(encoded)) throw new RangeError('Welfare signal contains invalid fields');
	return encoded;
}

/** Classify strings containing a WC or AS line before full parsing. */
export function isWelfareSignalToken(token: unknown): boolean {
	return typeof token === 'string' && token.length <= MAX_WIRE_BYTES && encoder.encode(token).byteLength <= MAX_WIRE_BYTES && token
		.replace(/\r\n?/g, '\n')
		.split('\n')
		.some((line) => line.startsWith('WC:') || line.startsWith('AS:'));
}
