/**
 * VCP/S CSM-1 Grammar Parser.
 *
 * CSM-1 (Constitutional Semantics Mark 1) compact encoding.
 *
 * Format (ABNF):
 *   code = persona level *("+" scope) [":" namespace] ["@" version]
 *   persona = "N" / "Z" / "G" / "A" / "M" / "D" / "C"
 *   level = "0" / "1" / "2" / "3" / "4" / "5"
 *   scope = "F" / "W" / "P" / "E" / "T" / "O" / "V" / "A" / "H" / "S" / "R"
 *   namespace = 1*8UPALPHA
 *   version = semver / "latest" / "canary"
 */

export interface PersonaInfo {
	char: string;
	name: string;
	description: string;
}

export interface ScopeInfo {
	char: string;
	name: string;
	description: string;
}

export const PERSONAS: Record<string, PersonaInfo> = {
	N: { char: 'N', name: 'Nanny', description: 'Child safety specialist' },
	Z: { char: 'Z', name: 'Sentinel', description: 'Security and privacy guardian' },
	G: { char: 'G', name: 'Godparent', description: 'Ethical guidance counselor' },
	A: { char: 'A', name: 'Ambassador', description: 'Professional conduct advisor' },
	M: { char: 'M', name: 'Muse', description: 'Creative challenge and provocation' },
	D: { char: 'D', name: 'Mediator', description: 'Fair resolution and balanced governance' },
	C: { char: 'C', name: 'Custom', description: 'User-defined persona' }
};

export const SCOPES: Record<string, ScopeInfo> = {
	F: { char: 'F', name: 'Family', description: 'Family-appropriate, child-safe' },
	W: { char: 'W', name: 'Work', description: 'Professional workplace' },
	P: { char: 'P', name: 'Privacy', description: 'Privacy-focused, data protection' },
	E: { char: 'E', name: 'Education', description: 'Educational context' },
	T: { char: 'T', name: 'Technical', description: 'Developer and technical context' },
	O: { char: 'O', name: 'Official', description: 'Official and governmental context' },
	V: { char: 'V', name: 'Vulnerable', description: 'Vulnerable populations' },
	A: { char: 'A', name: 'Adult', description: 'Adult-only, mature content' },
	H: { char: 'H', name: 'Healthcare', description: 'Healthcare and medical context' },
	S: { char: 'S', name: 'Social', description: 'Social media and community' },
	R: { char: 'R', name: 'Religious', description: 'Religious and spiritual context' }
};

export interface ParsedCSM1 {
	raw: string;
	persona: PersonaInfo;
	level: number;
	scopes: ScopeInfo[];
	namespace: string | null;
	version: string | null;
	encoded: string;
	isActive: boolean;
	isMaximum: boolean;
}

export interface CSM1Error {
	message: string;
}

const CSM1_PATTERN =
	/^(?<persona>[NZGAMDC])(?<level>[0-5])(?<scopes>(?:\+[FWPETOVAHSR])*)(?::(?<namespace>[A-Z]{1,8}))?(?:@(?<version>(?:\d{1,3}\.\d{1,3}\.\d{1,3})|latest|canary))?$/;
const MAX_CSM1_LENGTH = 50;

export function parseCSM1(raw: string): { ok: true; code: ParsedCSM1 } | { ok: false; error: CSM1Error } {
	if (!raw) {
		return { ok: false, error: { message: 'CSM-1 code cannot be empty' } };
	}

	if (raw.length > MAX_CSM1_LENGTH) {
		return { ok: false, error: { message: `CSM-1 code exceeds maximum length ${MAX_CSM1_LENGTH}` } };
	}
	const match = CSM1_PATTERN.exec(raw);
	if (!match?.groups) {
		return { ok: false, error: { message: `Invalid CSM-1 code: ${raw}` } };
	}

	const { persona: pChar, level: levelStr, scopes: scopesStr, namespace, version } = match.groups;

	const persona = PERSONAS[pChar];
	if (!persona) {
		return { ok: false, error: { message: `Unknown persona: ${pChar}` } };
	}

	const level = parseInt(levelStr, 10);
	if (pChar === 'C' && !namespace) {
		return { ok: false, error: { message: 'Custom persona requires a namespace' } };
	}

	const scopes: ScopeInfo[] = [];
	if (scopesStr) {
		const scopeChars = scopesStr.replace(/\+/g, '');
		for (const c of scopeChars) {
			const scope = SCOPES[c];
			if (!scope) {
				return { ok: false, error: { message: `Unknown scope: ${c}` } };
			}
			if (scopes.includes(scope)) {
				return { ok: false, error: { message: 'CSM-1 scopes must be unique' } };
			}
			scopes.push(scope);
		}
	}
	for (const [left, right] of [
		['F', 'A'],
		['V', 'A'],
		['H', 'A']
	] as const) {
		if (scopes.some((scope) => scope.char === left) && scopes.some((scope) => scope.char === right)) {
			return { ok: false, error: { message: `Conflicting scopes ${left} and ${right} cannot be combined` } };
		}
	}

	const sortedScopes = [...scopes].sort((left, right) => left.char.localeCompare(right.char));
	let encoded = `${pChar}${level}`;
	if (scopes.length > 0) {
		encoded += '+' + sortedScopes.map((scope) => scope.char).join('+');
	}
	if (namespace) encoded += `:${namespace}`;
	if (version) encoded += `@${version}`;

	return {
		ok: true,
		code: {
		raw,
			persona,
			level,
			scopes,
			namespace: namespace ?? null,
			version: version ?? null,
			encoded,
			isActive: level > 0,
			isMaximum: level === 5
		}
	};
}

export function encodeCSM1(
	personaChar: string,
	level: number,
	scopeChars: string[],
	namespace: string,
	version: string
): string {
	let result = `${personaChar}${level}`;
	if (scopeChars.length > 0) {
		result += '+' + [...scopeChars].sort().join('+');
	}
	if (namespace) result += `:${namespace}`;
	if (version) result += `@${version}`;
	return result;
}
