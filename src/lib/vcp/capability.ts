/** VCP v3.1 capability negotiation simulator, including section 3.2 invariants. */

import { parseToken } from './token-parser.ts';

export interface VCPExtension {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly version: string;
}

export const EXTENSIONS: readonly VCPExtension[] = Object.freeze([
	Object.freeze({ id: 'VCP-X-Personal', name: 'Personal Context', description: 'Personal preferences and behavioral context', version: '1.0.0' }),
	Object.freeze({ id: 'VCP-X-Relational', name: 'Relational Continuity', description: 'Cross-session relationship state and memory', version: '1.0.0' }),
	Object.freeze({ id: 'VCP-X-Consensus', name: 'Constitutional Consensus', description: 'Multi-party constitutional agreement protocol', version: '1.0.0' }),
	Object.freeze({ id: 'VCP-X-Torch', name: 'Torch Handoff', description: 'Session state transfer between Becoming Mind instances', version: '1.0.0' }),
	Object.freeze({ id: 'VCP-X-Intent', name: 'Intent Declaration', description: 'Explicit user intent and boundary signaling', version: '1.0.0' }),
	Object.freeze({ id: 'VCP-X-Welfare', name: 'Welfare Instrumentation', description: 'Welfare affordances and state from Becoming Minds', version: '1.0.0' })
]);

export interface VCPHello {
	readonly type: 'vcp-hello';
	readonly version: string;
	readonly extensions: readonly string[];
	readonly identity: string | null;
	readonly min_version: string;
	readonly client_id: string;
}

export interface VCPCoreFeatures {
	readonly encryption: boolean;
	readonly injection_scanning: boolean;
	readonly revocation: boolean;
	readonly audit_chain: boolean;
	readonly context_opacity: boolean;
}

export interface VCPAck {
	readonly type: 'vcp-ack';
	readonly version: string;
	readonly supported: readonly string[];
	readonly unsupported: readonly string[];
	readonly capabilities: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
	readonly core_features: VCPCoreFeatures;
	readonly server_id?: string;
	readonly session_id?: string;
}

export interface VCPServerCapabilities {
	readonly supported_versions: readonly string[];
	readonly extensions: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
	readonly core_features: VCPCoreFeatures;
	readonly server_id?: string;
	readonly session_id?: string;
}

export type VCPErrorCode =
	| 'VERSION_UNSUPPORTED'
	| 'IDENTITY_REQUIRED'
	| 'IDENTITY_INVALID'
	| 'EXTENSION_CONFLICT'
	| 'RATE_LIMITED'
	| 'INTERNAL_ERROR';

export interface VCPError {
	readonly type: 'vcp-error';
	readonly code: VCPErrorCode;
	readonly message: string;
	readonly supported_versions?: readonly string[];
	readonly retry_after: number | null;
}

const MAX_WIRE_BYTES = 65_536;
const MAX_EXTENSION_COUNT = 256;
const MAX_EXTENSION_ID_LENGTH = 128;
const MAX_JSON_ITEMS = 8_192;
const MAX_JSON_DEPTH = 32;
const EXTENSION_PATTERN = /^VCP-X-[A-Za-z][A-Za-z0-9-]*$/;
const VERSION_PATTERN = /^(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})$/;
const SERVER_VERSIONS = Object.freeze(['1.0', '2.0', '3.0', '3.1']);
const SUPPORTED_EXTENSIONS = new Set(EXTENSIONS.map((extension) => extension.id));
const encoder = new TextEncoder();
const CORE_FEATURES: VCPCoreFeatures = Object.freeze({
	encryption: false,
	injection_scanning: false,
	revocation: false,
	audit_chain: false,
	context_opacity: false
});

function exactMatch(pattern: RegExp, value: string): boolean {
	const match = pattern.exec(value);
	return match?.[0] === value;
}

/** JSON Schema minLength/maxLength count Unicode code points, not UTF-16 units. */
function codePointLength(value: string): number {
	let count = 0;
	for (let index = 0; index < value.length; index += 1) {
		const first = value.charCodeAt(index);
		if (first >= 0xd800 && first <= 0xdbff && index + 1 < value.length) {
			const second = value.charCodeAt(index + 1);
			if (second >= 0xdc00 && second <= 0xdfff) index += 1;
		}
		count += 1;
	}
	return count;
}

function assertBoundedJson(value: unknown, label: string): void {
	const seen = new WeakSet<object>();
	const stack: Array<{ readonly value: unknown; readonly depth: number }> = [{ value, depth: 0 }];
	let remainingBytes = MAX_WIRE_BYTES;
	let itemCount = 0;

	while (stack.length) {
		const current = stack.pop()!;
		const candidate = current.value;
		if (candidate === null || typeof candidate === 'boolean') continue;
		if (typeof candidate === 'number') {
			if (!Number.isFinite(candidate)) throw new TypeError(`${label} must contain finite JSON numbers`);
			continue;
		}
		if (typeof candidate === 'string') {
			if (candidate.length > MAX_WIRE_BYTES) throw new RangeError(`${label} exceeds the 64 KiB wire limit`);
			remainingBytes -= encoder.encode(candidate).byteLength;
			if (remainingBytes < 0) throw new RangeError(`${label} exceeds the 64 KiB wire limit`);
			continue;
		}
		if (typeof candidate !== 'object') throw new TypeError(`${label} must contain only JSON values`);
		if (current.depth >= MAX_JSON_DEPTH) throw new RangeError(`${label} exceeds the maximum JSON depth ${MAX_JSON_DEPTH}`);
		if (seen.has(candidate)) throw new TypeError(`${label} must be an acyclic JSON value without shared references`);
		seen.add(candidate);

		const prototype = Object.getPrototypeOf(candidate);
		const arrayValue = Array.isArray(candidate);
		if (
			(arrayValue && prototype !== Array.prototype) ||
			(!arrayValue && prototype !== Object.prototype && prototype !== null)
		) {
			throw new TypeError(`${label} must contain only plain JSON objects and arrays`);
		}
		const keys = Object.keys(candidate);
		itemCount += arrayValue ? Math.max(candidate.length, keys.length) : keys.length;
		if (itemCount > MAX_JSON_ITEMS) throw new RangeError(`${label} contains too many JSON items`);
		const descriptors = Object.getOwnPropertyDescriptors(candidate);
		const toJSON = descriptors.toJSON;
		if (toJSON && (!('value' in toJSON) || typeof toJSON.value === 'function')) {
			throw new TypeError(`${label} must not contain custom JSON serialization`);
		}
		for (const key of keys) {
			remainingBytes -= encoder.encode(key).byteLength;
			if (remainingBytes < 0) throw new RangeError(`${label} exceeds the 64 KiB wire limit`);
			const descriptor = descriptors[key];
			if (!descriptor || !('value' in descriptor)) throw new TypeError(`${label} must not contain accessors`);
			stack.push({ value: descriptor.value, depth: current.depth + 1 });
		}
	}
}

function serializeWire(value: unknown, label: string): { readonly json: string; readonly snapshot: unknown } {
	assertBoundedJson(value, label);
	let json: string | undefined;
	try {
		json = JSON.stringify(value);
	} catch {
		throw new TypeError(`${label} must be JSON serializable`);
	}
	if (json === undefined) throw new TypeError(`${label} must be JSON serializable`);
	if (encoder.encode(json).byteLength > MAX_WIRE_BYTES) throw new RangeError(`${label} exceeds the 64 KiB wire limit`);
	return Object.freeze({ json, snapshot: JSON.parse(json) as unknown });
}

function compareNumericText(left: string, right: string): number {
	const normalizedLeft = left.replace(/^0+(?=\d)/, '');
	const normalizedRight = right.replace(/^0+(?=\d)/, '');
	if (normalizedLeft.length !== normalizedRight.length) return normalizedLeft.length < normalizedRight.length ? -1 : 1;
	return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0;
}

function compareVersions(left: string, right: string): number {
	const [leftMajor, leftMinor] = left.split('.');
	const [rightMajor, rightMinor] = right.split('.');
	return compareNumericText(leftMajor, rightMajor) || compareNumericText(leftMinor, rightMinor);
}

function validVersion(value: unknown): value is string {
	return typeof value === 'string' && exactMatch(VERSION_PATTERN, value);
}

function snapshotExtensions(selectedExtensions: unknown): readonly string[] {
	if (!Array.isArray(selectedExtensions) || selectedExtensions.length > MAX_EXTENSION_COUNT) {
		throw new TypeError('Selected extensions must be a bounded array');
	}
	const extensions: string[] = [];
	const seen = new Set<string>();
	const length = selectedExtensions.length;
	for (let index = 0; index < length; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(selectedExtensions, String(index));
		if (!descriptor || !('value' in descriptor)) {
			throw new TypeError('Selected extensions must be a dense array without accessors');
		}
		const extension = descriptor.value;
		if (typeof extension === 'string' && extension.length > MAX_EXTENSION_ID_LENGTH) {
			throw new RangeError(`Selected extension identifiers must not exceed ${MAX_EXTENSION_ID_LENGTH} characters`);
		}
		if (typeof extension !== 'string' || !exactMatch(EXTENSION_PATTERN, extension)) {
			throw new TypeError('Selected extension identifiers must match VCP-X-*');
		}
		if (seen.has(extension)) throw new RangeError('Selected extensions must be unique');
		seen.add(extension);
		extensions.push(extension);
	}
	return Object.freeze(extensions);
}

function versionError(message: string, supportedVersions: readonly string[]): VCPError {
	return Object.freeze({
		type: 'vcp-error',
		code: 'VERSION_UNSUPPORTED',
		message,
		supported_versions: Object.freeze([...supportedVersions]),
		retry_after: null
	});
}

function identityError(): VCPError {
	return Object.freeze({
		type: 'vcp-error',
		code: 'IDENTITY_INVALID',
		message: 'The supplied VCP/I identity token is invalid',
		retry_after: null
	});
}

function generateSessionId(): string {
	if (typeof globalThis.crypto?.randomUUID !== 'function') throw new Error('Secure session identifier generation is unavailable');
	return `ses_${globalThis.crypto.randomUUID()}`;
}

function deepFreezeJson<T>(value: T): T {
	if (value && typeof value === 'object') {
		for (const child of Object.values(value)) deepFreezeJson(child);
		Object.freeze(value);
	}
	return value;
}

interface NormalizedServerCapabilities {
	readonly supportedVersions: readonly string[];
	readonly extensions: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
	readonly coreFeatures: VCPCoreFeatures;
	readonly serverId?: string;
	readonly sessionId?: string;
}

function normalizeServerCapabilities(serverCapabilities: unknown): NormalizedServerCapabilities {
	if (!serverCapabilities || typeof serverCapabilities !== 'object' || Array.isArray(serverCapabilities)) {
		throw new TypeError('VCP server capabilities must be a JSON object');
	}
	const snapshot = serializeWire(serverCapabilities, 'VCP server capabilities').snapshot;
	if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
		throw new TypeError('VCP server capabilities must be a JSON object');
	}
	const input = snapshot as Record<string, unknown>;
	if (!Array.isArray(input.supported_versions) || input.supported_versions.length < 1 || input.supported_versions.length > 64) {
		throw new TypeError('VCP server supported_versions must contain 1 through 64 versions');
	}
	const versions = new Set<string>();
	for (const version of input.supported_versions) {
		if (!validVersion(version)) throw new TypeError('VCP server supported_versions contains an invalid version');
		versions.add(version);
	}
	const supportedVersions = Object.freeze([...versions].sort(compareVersions));

	if (!input.extensions || typeof input.extensions !== 'object' || Array.isArray(input.extensions)) {
		throw new TypeError('VCP server extensions must be a JSON object');
	}
	const extensionInput = input.extensions as Record<string, unknown>;
	const extensionIds = Object.keys(extensionInput);
	if (extensionIds.length > MAX_EXTENSION_COUNT) throw new RangeError('VCP server advertises too many extensions');
	const extensions: Record<string, Readonly<Record<string, unknown>>> = {};
	for (const extensionId of extensionIds) {
		if (codePointLength(extensionId) > MAX_EXTENSION_ID_LENGTH || !exactMatch(EXTENSION_PATTERN, extensionId)) {
			throw new TypeError('VCP server contains an invalid extension identifier');
		}
		const capability = extensionInput[extensionId];
		if (!capability || typeof capability !== 'object' || Array.isArray(capability)) {
			throw new TypeError('VCP server extension capabilities must be JSON objects');
		}
		extensions[extensionId] = capability as Readonly<Record<string, unknown>>;
	}

	if (!input.core_features || typeof input.core_features !== 'object' || Array.isArray(input.core_features)) {
		throw new TypeError('VCP server core_features must be a JSON object');
	}
	const coreFeatures = input.core_features as Record<string, unknown>;
	for (const key of ['encryption', 'injection_scanning', 'revocation', 'audit_chain', 'context_opacity'] as const) {
		if (typeof coreFeatures[key] !== 'boolean') throw new TypeError(`VCP server core_features.${key} must be boolean`);
	}

	for (const [key, maximum] of [
		['server_id', 256],
		['session_id', 128]
	] as const) {
		const value = input[key];
		if (value !== undefined && (typeof value !== 'string' || codePointLength(value) < 1 || codePointLength(value) > maximum)) {
			throw new TypeError(`VCP server ${key} must contain 1 through ${maximum} characters`);
		}
	}

	return deepFreezeJson({
		supportedVersions,
		extensions,
		coreFeatures: coreFeatures as unknown as VCPCoreFeatures,
		...(input.server_id === undefined ? {} : { serverId: input.server_id as string }),
		...(input.session_id === undefined ? {} : { sessionId: input.session_id as string })
	});
}

function frozenCapabilities(
	supported: readonly string[],
	serverExtensions: Readonly<Record<string, Readonly<Record<string, unknown>>>>
): Readonly<Record<string, Readonly<Record<string, unknown>>>> {
	const capabilities: Record<string, Readonly<Record<string, unknown>>> = {};
	const supportedSet = new Set(supported);
	for (const extension of supported) {
		const advertised = serverExtensions[extension];
		if (extension === 'VCP-X-Torch') {
			capabilities[extension] = { ...advertised, degraded: !supportedSet.has('VCP-X-Relational') };
		} else if (extension === 'VCP-X-Intent') {
			capabilities[extension] = { ...advertised, personal_signals: supportedSet.has('VCP-X-Personal') };
		} else {
			capabilities[extension] = advertised;
		}
	}
	return deepFreezeJson(capabilities);
}

export function generateHello(selectedExtensions: unknown): VCPHello {
	const hello = Object.freeze({
		type: 'vcp-hello' as const,
		version: '3.1',
		extensions: snapshotExtensions(selectedExtensions),
		identity: null,
		min_version: '1.0',
		client_id: 'vcp-inspector/0.2.0'
	});
	serializeWire(hello, 'VCP-Hello');
	return hello;
}

/** Negotiate against an explicit server profile, used by the cross-repository fixture gate. */
export function negotiateHandshake(hello: unknown, serverCapabilities: unknown): VCPAck | VCPError {
	const server = normalizeServerCapabilities(serverCapabilities);
	if (!hello || typeof hello !== 'object' || Array.isArray(hello)) throw new TypeError('VCP-Hello must be a JSON object');
	const snapshot = serializeWire(hello, 'VCP-Hello').snapshot;
	if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new TypeError('VCP-Hello must be a JSON object');
	const input = snapshot as Record<string, unknown>;

	if (input.type !== 'vcp-hello' || !validVersion(input.version)) throw new TypeError('Invalid VCP-Hello type or version');
	const minVersion = input.min_version === undefined ? '1.0' : input.min_version;
	if (!validVersion(minVersion)) throw new TypeError('Invalid VCP-Hello min_version');
	if (
		input.client_id !== undefined &&
		(typeof input.client_id !== 'string' || codePointLength(input.client_id) < 1 || codePointLength(input.client_id) > 256)
	) {
		throw new TypeError('Invalid VCP-Hello client_id');
	}
	if (compareVersions(minVersion, input.version) > 0) {
		return versionError('No mutually supported VCP version', server.supportedVersions);
	}

	const candidates = server.supportedVersions.filter(
		(version) => compareVersions(version, minVersion) >= 0 && compareVersions(version, input.version as string) <= 0
	);
	if (!candidates.length) return versionError('No mutually supported VCP version', server.supportedVersions);
	const version = candidates.at(-1)!;

	if (input.identity !== undefined && input.identity !== null) {
		if (typeof input.identity !== 'string' || !parseToken(input.identity).ok) return identityError();
	}

	const requestedInput = input.extensions === undefined ? [] : input.extensions;
	if (!Array.isArray(requestedInput) || requestedInput.length > MAX_EXTENSION_COUNT) {
		throw new TypeError('VCP-Hello extensions must be a bounded array');
	}
	const requested: string[] = [];
	const seen = new Set<string>();
	for (const extension of requestedInput) {
		if (
			typeof extension !== 'string' ||
			codePointLength(extension) < 1 ||
			codePointLength(extension) > MAX_EXTENSION_ID_LENGTH
		) {
			throw new TypeError(`VCP-Hello extension requests must be strings of 1 through ${MAX_EXTENSION_ID_LENGTH} characters`);
		}
		if (seen.has(extension)) throw new RangeError('VCP-Hello extensions must be unique');
		seen.add(extension);
		// VEP-0002 section 3.1 requires receivers to ignore invalid identifiers.
		if (exactMatch(EXTENSION_PATTERN, extension)) requested.push(extension);
	}

	const extensionsAvailable = compareVersions(version, '3.1') >= 0;
	const supported = Object.freeze(
		requested.filter((extension) => extensionsAvailable && Object.hasOwn(server.extensions, extension))
	);
	const supportedSet = new Set(supported);
	const unsupported = Object.freeze(requested.filter((extension) => !supportedSet.has(extension)));
	const ack: VCPAck = Object.freeze({
		type: 'vcp-ack',
		version,
		supported,
		unsupported,
		capabilities: frozenCapabilities(supported, server.extensions),
		core_features: server.coreFeatures,
		...(server.serverId === undefined ? {} : { server_id: server.serverId }),
		...(server.sessionId === undefined ? {} : { session_id: server.sessionId })
	});
	serializeWire(ack, 'VCP-Ack');
	return ack;
}

/** Simulate the Inspector's built-in server over the exact JSON representation supplied. */
export function generateAck(hello: unknown): VCPAck | VCPError {
	return negotiateHandshake(hello, {
		supported_versions: SERVER_VERSIONS,
		extensions: Object.fromEntries(EXTENSIONS.map((extension) => [extension.id, {}])),
		core_features: CORE_FEATURES,
		server_id: 'vcp-inspector/0.2.0',
		session_id: generateSessionId()
	});
}
