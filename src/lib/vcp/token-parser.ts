/** Strict VCP/I identity-token parsing against the accepted schema. */

import { isWelfareSignalToken, parseWelfareSignal, type WelfareSignal } from './welfare-signal.ts';

export type VersionConstraint = 'none' | 'exact' | 'compatible' | 'approximate' | 'alias';

export interface ParsedToken {
	readonly raw: string;
	readonly segments: readonly string[];
	readonly domain: string;
	readonly approach: string;
	readonly role: string;
	readonly path: readonly string[];
	readonly version: string | null;
	readonly versionConstraint: VersionConstraint;
	readonly namespace: string | null;
	/** SDK-compatible path-only canonical identity. */
	readonly canonical: string;
	/** Exact canonical path plus optional version selector and namespace suffix. */
	readonly full: string;
	readonly uri: string;
	readonly depth: number;
}

export interface TokenError {
	readonly message: string;
}

export type TokenParseResult =
	| { readonly ok: true; readonly token: ParsedToken }
	| { readonly ok: false; readonly error: TokenError };

const TOKEN_PATTERN = /^(?<path>[a-z][a-z0-9-]{0,31}(?:\.[a-z][a-z0-9-]{0,31}){2,9})(?:@(?<version>[\^~]?\d{1,5}\.\d{1,5}\.\d{1,5}(?:-[a-zA-Z0-9.-]+)?|latest|canary))?(?::(?<namespace>[A-Z][A-Z0-9]{0,31}))?$/;
const MAX_LENGTH = 256;
const MAX_URI_LENGTH = 518;
const ISSUER_LABEL = String.raw`[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?`;
const ISSUER_PATTERN = new RegExp(String.raw`^(?:${ISSUER_LABEL})(?:\.(?:${ISSUER_LABEL}))*$`);

function failure(message: string): TokenParseResult {
	return Object.freeze({ ok: false as const, error: Object.freeze({ message }) });
}

function classifyVersion(version: string | undefined): VersionConstraint {
	if (!version) return 'none';
	if (version === 'latest' || version === 'canary') return 'alias';
	if (version.startsWith('^')) return 'compatible';
	if (version.startsWith('~')) return 'approximate';
	return 'exact';
}

function canonicalizeVersion(version: string | undefined): string | undefined {
	if (!version || version === 'latest' || version === 'canary') return version;
	const selector = version.startsWith('^') || version.startsWith('~') ? version[0] : '';
	const numeric = selector ? version.slice(1) : version;
	const [core, ...prereleaseParts] = numeric.split('-');
	const components = core.split('.').map((component) => String(Number(component)));
	const prerelease = prereleaseParts.length ? `-${prereleaseParts.join('-').toLowerCase()}` : '';
	return `${selector}${components.join('.')}${prerelease}`;
}

/** Try to parse a standalone WC/AS welfare snapshot. */
export function tryParseWelfare(raw: unknown): WelfareSignal | null {
	if (!isWelfareSignalToken(raw)) return null;
	return parseWelfareSignal(raw);
}

/** Parse an exact VCP/I wire token. */
export function parseToken(raw: unknown): TokenParseResult {
	if (typeof raw !== 'string') return failure('Token must be a string');
	if (!raw) return failure('Token cannot be empty');
	if (raw.length > MAX_LENGTH) return failure(`Token exceeds max length ${MAX_LENGTH}`);
	if (isWelfareSignalToken(raw)) return failure('WELFARE_SIGNAL: use tryParseWelfare() for this input');

	const match = TOKEN_PATTERN.exec(raw);
	if (!match?.groups || match[0] !== raw) return failure('Invalid VCP/I token format');

	const { path: canonical, version: rawVersion, namespace } = match.groups;
	const version = canonicalizeVersion(rawVersion);
	const segments = Object.freeze(canonical.split('.'));
	const versionPart = version ? `@${version}` : '';
	const full = `${canonical}${versionPart}${namespace ? `:${namespace}` : ''}`;

	return Object.freeze({
		ok: true as const,
		token: Object.freeze({
			raw,
			segments,
			domain: segments[0],
			approach: segments[segments.length - 2],
			role: segments[segments.length - 1],
			path: Object.freeze(segments.slice(1, -2)),
			version: version ?? null,
			versionConstraint: classifyVersion(version),
			namespace: namespace ?? null,
			canonical,
			full,
			uri: `creed://creed.space/${canonical}${versionPart}`,
			depth: segments.length
		})
	});
}

/** Parse the mandatory creed:// form or its vcp:// equivalent without URL normalization. */
export function parseIdentityUri(raw: unknown): TokenParseResult {
	if (typeof raw !== 'string') return failure('VCP/I URI must be a string');
	if (!raw) return failure('VCP/I URI cannot be empty');
	if (raw.length > MAX_URI_LENGTH) return failure(`VCP/I URI exceeds max length ${MAX_URI_LENGTH}`);
	if (!/^[\x21-\x7e]+$/.test(raw) || /[?#%\\]/.test(raw)) {
		return failure('VCP/I URI contains forbidden or non-ASCII characters');
	}

	const creed = raw.startsWith('creed://');
	const vcp = raw.startsWith('vcp://');
	if (!creed && !vcp) return failure('Unsupported VCP/I URI scheme');
	const remainder = raw.slice(creed ? 'creed://'.length : 'vcp://'.length);
	if (!remainder || remainder.includes(':')) return failure('Invalid VCP/I URI authority or namespace');

	let pathWithVersion: string;
	if (vcp) {
		if (remainder.includes('/')) return failure('vcp:// URIs require a dotted token path');
		pathWithVersion = remainder;
	} else {
		const firstSlash = remainder.indexOf('/');
		if (firstSlash < 0) return failure('creed:// URIs require an issuer and token path');
		const issuer = remainder.slice(0, firstSlash);
		const issuerMatch = ISSUER_PATTERN.exec(issuer);
		if (issuer.length > 253 || !/[A-Za-z]/.test(issuer) || issuerMatch?.[0] !== issuer) {
			return failure('Invalid VCP/I URI issuer');
		}
		pathWithVersion = remainder.slice(firstSlash + 1);
		if (!pathWithVersion) return failure('VCP/I URI token path cannot be empty');
	}

	const versionAt = pathWithVersion.lastIndexOf('@');
	const path = versionAt < 0 ? pathWithVersion : pathWithVersion.slice(0, versionAt);
	const versionPart = versionAt < 0 ? '' : pathWithVersion.slice(versionAt);
	if (!path || (path.includes('/') && path.includes('.'))) return failure('VCP/I URI token path is ambiguous');
	const pathSegments = path.split('/');
	if (pathSegments.some((segment) => !segment)) return failure('VCP/I URI token path contains an empty segment');

	const parsed = parseToken(`${pathSegments.join('.')}${versionPart}`);
	if (!parsed.ok) return parsed;
	return Object.freeze({
		ok: true as const,
		token: Object.freeze({ ...parsed.token, raw })
	});
}

/** Parse either a plain VCP/I token or a supported VCP/I URI. */
export function parseIdentityInput(raw: unknown): TokenParseResult {
	if (typeof raw === 'string' && (raw.startsWith('creed://') || raw.startsWith('vcp://') || raw.includes('://'))) {
		return parseIdentityUri(raw);
	}
	return parseToken(raw);
}
