/**
 * VCP/S v2.1 WC-line and AS-line parsing for standalone welfare snapshots.
 *
 * A snapshot may contain WC, AS, or both in either order. Unknown emoji flags
 * and dimensions are skipped for forward compatibility, while known fields
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
	readonly attestationLevel: number;
	readonly schemaRef: string;
}

export interface WelfareAgentState {
	readonly dimensions: readonly WelfareDimension[];
	readonly isNone: boolean;
}

export interface WelfareSignal {
	readonly raw: string;
	readonly context: WelfareContext | null;
	readonly agentState: WelfareAgentState | null;
}

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

const CORE_FLAGS = frozenRecord<WelfareFlagInfo>(CORE_FLAG_LIST.map((flag) => [flag.symbol, flag] as const));
const CORE_DIMENSIONS = frozenRecord<WelfareDimensionInfo>(CORE_DIMENSION_LIST.map((dimension) => [dimension.symbol, dimension] as const));
const MAX_WIRE_BYTES = 65_536;
const MAX_WELFARE_ITEMS = 256;
const EXTENDED_SCHEMA_REF = 'welfare.vcp-e.v1';
const VALUE_PATTERN = /^[a-z][a-z_]*$/;
const EMOJI_GRAPHEME = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|\u20E3)/u;
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const encoder = new TextEncoder();

function knownFlags(schemaRef: string): Readonly<Record<string, WelfareFlagInfo>> {
	return schemaRef === EXTENDED_SCHEMA_REF ? WELFARE_FLAGS : CORE_FLAGS;
}

function knownDimensions(schemaRef: string | null): Readonly<Record<string, WelfareDimensionInfo>> {
	return schemaRef === EXTENDED_SCHEMA_REF ? WELFARE_DIMENSIONS : CORE_DIMENSIONS;
}

function nextEmoji(text: string): string | null {
	const first = graphemeSegmenter.segment(text)[Symbol.iterator]().next().value?.segment;
	return first && EMOJI_GRAPHEME.test(first) ? first : null;
}

function parseFlags(text: string, schemaRef: string): readonly WelfareFlagInfo[] | null {
	if (!text) return null;
	const available = knownFlags(schemaRef);
	const symbols = Object.keys(available).sort((left, right) => right.length - left.length);
	const flags: WelfareFlagInfo[] = [];
	const seen = new Set<string>();
	let offset = 0;
	let itemCount = 0;

	while (offset < text.length) {
		itemCount += 1;
		if (itemCount > MAX_WELFARE_ITEMS) return null;
		const remainder = text.slice(offset);
		const known = symbols.find((candidate) => remainder.startsWith(candidate));
		const symbol = known ?? nextEmoji(remainder);
		if (!symbol) return null;
		if (known) {
			if (seen.has(known)) return null;
			seen.add(known);
			flags.push(available[known]);
		}
		offset += symbol.length;
	}

	return Object.freeze(flags);
}

function parseAgentState(text: string, schemaRef: string | null): WelfareAgentState | null {
	if (text === 'none') return Object.freeze({ dimensions: Object.freeze([]), isNone: true });
	if (!text) return null;

	const available = knownDimensions(schemaRef);
	const symbols = Object.keys(available).sort((left, right) => right.length - left.length);
	const dimensions: WelfareDimension[] = [];
	const seen = new Set<string>();

	const entries = text.split('|');
	if (entries.length > MAX_WELFARE_ITEMS) return null;
	for (const entry of entries) {
		const colon = entry.lastIndexOf(':');
		if (colon < 0 || colon === entry.length - 1) return null;
		const intensityText = entry.slice(colon + 1);
		if (!/^[1-5]$/.test(intensityText)) return null;

		const head = entry.slice(0, colon);
		const known = symbols.find((candidate) => head.startsWith(candidate));
		const symbol = known ?? nextEmoji(head);
		if (!symbol) return null;
		const value = head.slice(symbol.length);
		if (!VALUE_PATTERN.test(value)) return null;
		if (!known) continue;

		const info = available[known];
		if (!info.values.includes(value) || seen.has(info.dimension)) return null;
		seen.add(info.dimension);
		dimensions.push(Object.freeze({
			symbol: known,
			dimension: info.dimension,
			value,
			intensity: Number(intensityText),
			extended: info.extended
		}));
	}

	return Object.freeze({ dimensions: Object.freeze(dimensions), isNone: false });
}

/** Parse a standalone WC/AS welfare snapshot. */
export function parseWelfareSignal(token: unknown): WelfareSignal | null {
	if (
		typeof token !== 'string' ||
		!token ||
		token.length > MAX_WIRE_BYTES ||
		encoder.encode(token).byteLength > MAX_WIRE_BYTES
	) return null;
	const normalized = token.replace(/\r\n?/g, '\n');
	const lines = normalized.split('\n');
	if (lines.length > 2 || lines.some((line) => !line || (!line.startsWith('WC:') && !line.startsWith('AS:')))) return null;

	const contextLines = lines.filter((line) => line.startsWith('WC:'));
	const stateLines = lines.filter((line) => line.startsWith('AS:'));
	if (contextLines.length > 1 || stateLines.length > 1) return null;

	let context: WelfareContext | null = null;
	if (contextLines.length === 1) {
		const match = /^WC:(?<flags>.+):(?<attestation>[0-2]):(?<schemaRef>[!-9;-~]+)$/.exec(contextLines[0]);
		if (!match?.groups) return null;
		const { flags: flagText, attestation, schemaRef } = match.groups;
		const flags = parseFlags(flagText, schemaRef);
		if (!flags) return null;
		context = Object.freeze({ flags, attestationLevel: Number(attestation), schemaRef });
	}

	let agentState: WelfareAgentState | null = null;
	if (stateLines.length === 1) {
		agentState = parseAgentState(stateLines[0].slice(3), context?.schemaRef ?? null);
		if (!agentState) return null;
	}

	return Object.freeze({ raw: normalized, context, agentState });
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
