/**
 * Strict VCP/S CSM-1 parsing and canonical encoding.
 *
 * The accepted grammar is the VCP-Spec CSM1 schema. Parsing is deliberately
 * case-sensitive. User-interface normalization belongs at the UI boundary.
 */

export interface PersonaInfo {
	readonly char: string;
	readonly name: string;
	readonly description: string;
}

export interface ScopeInfo {
	readonly char: string;
	readonly name: string;
	readonly description: string;
}

function frozenRecord<T>(entries: readonly (readonly [string, T])[]): Readonly<Record<string, T>> {
	return Object.freeze(Object.assign(Object.create(null) as Record<string, T>, Object.fromEntries(entries)));
}

export const PERSONAS = frozenRecord<PersonaInfo>([
	['N', Object.freeze({ char: 'N', name: 'Nanny', description: 'Child safety and family-appropriate content' })],
	['Z', Object.freeze({ char: 'Z', name: 'Sentinel', description: 'Security, privacy, and operational safety' })],
	['G', Object.freeze({ char: 'G', name: 'Godparent', description: 'Ethical guidance and moral reasoning' })],
	['A', Object.freeze({ char: 'A', name: 'Ambassador', description: 'Professional conduct and diplomatic communication' })],
	['M', Object.freeze({ char: 'M', name: 'Muse', description: 'Creativity and artistic expression' })],
	['D', Object.freeze({ char: 'D', name: 'Mediator', description: 'Fair resolution and balanced mediation' })],
	['C', Object.freeze({ char: 'C', name: 'Custom', description: 'User-defined constitution' })]
] as const);

export const SCOPES = frozenRecord<ScopeInfo>([
	['F', Object.freeze({ char: 'F', name: 'Family', description: 'Family-appropriate, child-safe' })],
	['W', Object.freeze({ char: 'W', name: 'Work', description: 'Professional workplace' })],
	['P', Object.freeze({ char: 'P', name: 'Privacy', description: 'Privacy-focused and data-protective' })],
	['E', Object.freeze({ char: 'E', name: 'Education', description: 'Educational and learning context' })],
	['T', Object.freeze({ char: 'T', name: 'Technical', description: 'Developer and technical context' })],
	['O', Object.freeze({ char: 'O', name: 'Official', description: 'Official and governmental context' })],
	['V', Object.freeze({ char: 'V', name: 'Vulnerable', description: 'Protected and vulnerable populations' })],
	['A', Object.freeze({ char: 'A', name: 'Adult', description: 'Adult-only context' })],
	['H', Object.freeze({ char: 'H', name: 'Health', description: 'Healthcare and medical context' })],
	['S', Object.freeze({ char: 'S', name: 'Social', description: 'Social media and community context' })],
	['R', Object.freeze({ char: 'R', name: 'Religious', description: 'Religious and spiritual context' })]
] as const);

export interface ParsedCSM1 {
	readonly raw: string;
	readonly persona: PersonaInfo;
	readonly level: number;
	readonly scopes: readonly ScopeInfo[];
	readonly namespace: string | null;
	readonly version: string | null;
	readonly encoded: string;
	readonly isMaximum: boolean;
}

export interface CSM1Error {
	readonly message: string;
}

export type CSM1ParseResult =
	| { readonly ok: true; readonly code: ParsedCSM1 }
	| { readonly ok: false; readonly error: CSM1Error };

const MAX_LENGTH = 45;
const PERSONA_PATTERN = /^[NZGAMDC]$/;
const SCOPE_PATTERN = /^[FWPETOVAHSR]$/;
const NAMESPACE_PATTERN = /^[A-Z]{1,8}$/;
const SEMVER_COMPONENT = String.raw`(?:0|[1-9][0-9]{0,2})`;
const VERSION_PATTERN = new RegExp(`^(?:${SEMVER_COMPONENT}\\.${SEMVER_COMPONENT}\\.${SEMVER_COMPONENT}|latest|canary)$`);
const CSM1_PATTERN = new RegExp(
	`^(?<persona>[NZGAMDC])(?<level>[0-5])(?<scopes>(?:\\+[FWPETOVAHSR])*)(?::(?<namespace>[A-Z]{1,8}))?(?:@(?<version>(?:${SEMVER_COMPONENT}\\.${SEMVER_COMPONENT}\\.${SEMVER_COMPONENT}|latest|canary)))?$`
);
const SCOPE_CONFLICTS = Object.freeze([
	Object.freeze(['F', 'A'] as const),
	Object.freeze(['V', 'A'] as const),
	Object.freeze(['H', 'A'] as const)
] as const);

function exactMatch(pattern: RegExp, value: string): boolean {
	const match = pattern.exec(value);
	return match?.[0] === value;
}

function failure(message: string): CSM1ParseResult {
	return Object.freeze({ ok: false as const, error: Object.freeze({ message }) });
}

function scopeConflict(scopes: ReadonlySet<string>): readonly [string, string] | null {
	for (const pair of SCOPE_CONFLICTS) {
		if (scopes.has(pair[0]) && scopes.has(pair[1])) return pair;
	}
	return null;
}

/** Parse an exact CSM-1 wire code. */
export function parseCSM1(raw: unknown): CSM1ParseResult {
	if (typeof raw !== 'string') return failure('CSM-1 code must be a string');
	if (!raw) return failure('CSM-1 code cannot be empty');
	if (raw.length > MAX_LENGTH) return failure(`CSM-1 code exceeds max length ${MAX_LENGTH}`);

	const match = CSM1_PATTERN.exec(raw);
	if (!match?.groups || match[0] !== raw) return failure('Invalid CSM-1 code format');

	const { persona: personaChar, level: levelText, scopes: scopeText, namespace, version } = match.groups;
	const scopeChars = scopeText ? scopeText.slice(1).split('+') : [];
	const uniqueScopes = new Set(scopeChars);
	if (uniqueScopes.size !== scopeChars.length) return failure('CSM-1 scopes must be unique');

	const conflict = scopeConflict(uniqueScopes);
	if (conflict) return failure(`Conflicting CSM-1 scopes: ${conflict[0]} and ${conflict[1]}`);
	if (personaChar === 'C' && !namespace) return failure('Custom persona C requires a namespace');

	const scopes = Object.freeze(scopeChars.map((scopeChar) => SCOPES[scopeChar]));
	const level = Number(levelText);
	const canonicalScopes = [...scopeChars].sort();
	let encoded = `${personaChar}${level}`;
	if (canonicalScopes.length) encoded += `+${canonicalScopes.join('+')}`;
	if (namespace) encoded += `:${namespace}`;
	if (version) encoded += `@${version}`;

	return Object.freeze({
		ok: true as const,
		code: Object.freeze({
			raw,
			persona: PERSONAS[personaChar],
			level,
			scopes,
			namespace: namespace ?? null,
			version: version ?? null,
			encoded,
			isMaximum: level === 5
		})
	});
}

/** Encode structured values as canonical CSM-1, sorting scopes as the SDK does. */
export function encodeCSM1(
	personaChar: unknown,
	level: unknown,
	scopeChars: unknown,
	namespace: unknown = '',
	version: unknown = ''
): string {
	if (typeof personaChar !== 'string' || !exactMatch(PERSONA_PATTERN, personaChar)) {
		throw new TypeError('CSM-1 persona must be a supported one-character code');
	}
	if (typeof level !== 'number' || !Number.isInteger(level) || level < 0 || level > 5) {
		throw new TypeError('CSM-1 level must be an integer from 0 through 5');
	}
	if (!Array.isArray(scopeChars) || scopeChars.length > Object.keys(SCOPES).length) {
		throw new TypeError('CSM-1 scopes must be a bounded array');
	}
	const scopes: string[] = [];
	const scopeCount = scopeChars.length;
	for (let index = 0; index < scopeCount; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(scopeChars, String(index));
		if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string' || !exactMatch(SCOPE_PATTERN, descriptor.value)) {
			throw new TypeError('CSM-1 scope codes must be a dense array of supported one-character strings');
		}
		scopes.push(descriptor.value);
	}
	if (typeof namespace !== 'string' || (namespace !== '' && !exactMatch(NAMESPACE_PATTERN, namespace))) {
		throw new TypeError('CSM-1 namespace must be empty or 1-8 uppercase letters');
	}
	if (typeof version !== 'string' || (version !== '' && !exactMatch(VERSION_PATTERN, version))) {
		throw new TypeError('CSM-1 version must be empty, semver, latest, or canary');
	}

	const sortedScopes = scopes.sort();
	let candidate = `${personaChar}${level}`;
	if (sortedScopes.length) candidate += `+${sortedScopes.join('+')}`;
	if (namespace) candidate += `:${namespace}`;
	if (version) candidate += `@${version}`;

	const parsed = parseCSM1(candidate);
	if (!parsed.ok) throw new RangeError(parsed.error.message);
	return parsed.code.encoded;
}
