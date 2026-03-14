/**
 * VCP/I Token parsing and validation.
 *
 * Token format (ABNF from spec):
 *   token = segment 2*("." segment) ["@" version] [":" namespace]
 *   segment = ALPHA *(ALPHA / DIGIT / "-")
 *   version = 1*DIGIT "." 1*DIGIT "." 1*DIGIT
 *   namespace = UPALPHA *(UPALPHA / DIGIT)
 *
 * Minimum 3 segments, max 10.
 *
 * Also handles WELFARE_SIGNAL tokens (multi-line W:/WS:/WD:/WH: format).
 */

import { isWelfareSignalToken, parseWelfareSignal, type WelfareSignal } from './welfare-signal';

export interface ParsedToken {
	raw: string;
	segments: string[];
	domain: string;
	approach: string;
	role: string;
	path: string[];
	version: string | null;
	namespace: string | null;
	canonical: string;
	full: string;
	uri: string;
	depth: number;
}

export interface TokenError {
	message: string;
	position?: number;
}

const SEGMENT_PATTERN = /^[a-z][a-z0-9-]*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const NAMESPACE_PATTERN = /^[A-Z][A-Z0-9]*$/;
const TOKEN_PATTERN =
	/^(?<path>[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2,})(?:@(?<version>\d+\.\d+\.\d+))?(?::(?<namespace>[A-Z][A-Z0-9]*))?$/;

const MAX_LENGTH = 256;
const MAX_SEGMENT_LENGTH = 32;
const MIN_SEGMENTS = 3;
const MAX_SEGMENTS = 10;

export type ParseResult =
	| { ok: true; token: ParsedToken }
	| { ok: true; welfare: WelfareSignal }
	| { ok: false; error: TokenError };

/**
 * Try to parse a welfare signal token. Returns null if the input is not a welfare token.
 */
export function tryParseWelfare(raw: string): WelfareSignal | null {
	if (!isWelfareSignalToken(raw)) return null;
	return parseWelfareSignal(raw);
}

export function parseToken(raw: string): { ok: true; token: ParsedToken } | { ok: false; error: TokenError } {
	if (!raw) {
		return { ok: false, error: { message: 'Token cannot be empty' } };
	}

	const trimmed = raw.trim();

	// Check for welfare signal format before standard token parsing
	if (isWelfareSignalToken(trimmed)) {
		const welfare = parseWelfareSignal(trimmed);
		if (welfare) {
			// Return as a token-shaped result so callers can detect it
			return { ok: false, error: { message: 'WELFARE_SIGNAL — use tryParseWelfare() for this input' } };
		}
	}

	if (trimmed.length > MAX_LENGTH) {
		return { ok: false, error: { message: `Token exceeds max length ${MAX_LENGTH}: ${trimmed.length}` } };
	}

	const match = TOKEN_PATTERN.exec(trimmed);
	if (!match?.groups) {
		return { ok: false, error: { message: `Invalid VCP/I token format: ${trimmed}` } };
	}

	const { path, version, namespace } = match.groups;
	const segments = path.split('.');

	if (segments.length < MIN_SEGMENTS) {
		return {
			ok: false,
			error: { message: `Token requires at least ${MIN_SEGMENTS} segments, got ${segments.length}` }
		};
	}

	if (segments.length > MAX_SEGMENTS) {
		return {
			ok: false,
			error: { message: `Token exceeds maximum ${MAX_SEGMENTS} segments, got ${segments.length}` }
		};
	}

	for (let i = 0; i < segments.length; i++) {
		if (segments[i].length > MAX_SEGMENT_LENGTH) {
			return {
				ok: false,
				error: { message: `Segment ${i + 1} exceeds max length ${MAX_SEGMENT_LENGTH}: ${segments[i]}` }
			};
		}
		if (!SEGMENT_PATTERN.test(segments[i])) {
			return {
				ok: false,
				error: { message: `Invalid segment format at position ${i + 1}: ${segments[i]}` }
			};
		}
	}

	if (version && !VERSION_PATTERN.test(version)) {
		return { ok: false, error: { message: `Invalid version format: ${version}` } };
	}

	if (namespace && !NAMESPACE_PATTERN.test(namespace)) {
		return { ok: false, error: { message: `Invalid namespace format: ${namespace}` } };
	}

	const canonical = segments.join('.');
	let full = canonical;
	if (version) full += `@${version}`;
	if (namespace) full += `:${namespace}`;

	const versionPart = version ? `@${version}` : '';
	const uri = `creed://creed.space/${canonical}${versionPart}`;

	const middlePath = segments.length > 3 ? segments.slice(1, -2) : [];

	return {
		ok: true,
		token: {
			raw: trimmed,
			segments,
			domain: segments[0],
			approach: segments[segments.length - 2],
			role: segments[segments.length - 1],
			path: middlePath,
			version: version ?? null,
			namespace: namespace ?? null,
			canonical,
			full,
			uri,
			depth: segments.length
		}
	};
}
