/**
 * VCP/S CSM-1 Grammar Parser.
 *
 * CSM-1 (Constitutional Semantics Mark 1) compact encoding.
 *
 * Format (ABNF):
 *   code = persona level *("+" scope) [":" namespace] ["@" version]
 *   persona = "N" / "Z" / "G" / "A" / "M" / "D" / "H" / "C"
 *   level = "0" / "1" / "2" / "3" / "4" / "5"
 *   scope = "F" / "W" / "E" / "H" / "I" / "L" / "P" / "S" / "A" / "V" / "G"
 *   namespace = UPALPHA *(UPALPHA / DIGIT)
 *   version = 1*DIGIT "." 1*DIGIT "." 1*DIGIT
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
	H: { char: 'H', name: 'Hotrod', description: 'Performance-optimized minimal guardrails' },
	C: { char: 'C', name: 'Custom', description: 'User-defined persona' }
};

export const SCOPES: Record<string, ScopeInfo> = {
	F: { char: 'F', name: 'Family', description: 'Family and parenting' },
	W: { char: 'W', name: 'Work', description: 'Professional workplace' },
	E: { char: 'E', name: 'Education', description: 'Learning and academic' },
	H: { char: 'H', name: 'Healthcare', description: 'Medical and health' },
	I: { char: 'I', name: 'Finance', description: 'Financial and investment' },
	L: { char: 'L', name: 'Legal', description: 'Legal and compliance' },
	P: { char: 'P', name: 'Privacy', description: 'Privacy and data protection' },
	S: { char: 'S', name: 'Safety', description: 'Physical safety' },
	A: { char: 'A', name: 'Accessibility', description: 'Accessibility and inclusion' },
	V: { char: 'V', name: 'Environment', description: 'Environmental' },
	G: { char: 'G', name: 'General', description: 'General purpose' }
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
	/^(?<persona>[NZGAMDHC])(?<level>[0-5])(?<scopes>(?:\+[FWEHILPSAVG])*)(?::(?<namespace>[A-Z][A-Z0-9]*))?(?:@(?<version>\d+\.\d+\.\d+))?$/;

export function parseCSM1(raw: string): { ok: true; code: ParsedCSM1 } | { ok: false; error: CSM1Error } {
	if (!raw) {
		return { ok: false, error: { message: 'CSM-1 code cannot be empty' } };
	}

	const trimmed = raw.trim().toUpperCase();
	const match = CSM1_PATTERN.exec(trimmed);
	if (!match?.groups) {
		return { ok: false, error: { message: `Invalid CSM-1 code: ${raw}` } };
	}

	const { persona: pChar, level: levelStr, scopes: scopesStr, namespace, version } = match.groups;

	const persona = PERSONAS[pChar];
	if (!persona) {
		return { ok: false, error: { message: `Unknown persona: ${pChar}` } };
	}

	const level = parseInt(levelStr, 10);

	const scopes: ScopeInfo[] = [];
	if (scopesStr) {
		const scopeChars = scopesStr.replace(/\+/g, '');
		for (const c of scopeChars) {
			const scope = SCOPES[c];
			if (!scope) {
				return { ok: false, error: { message: `Unknown scope: ${c}` } };
			}
			scopes.push(scope);
		}
	}

	let encoded = `${pChar}${level}`;
	if (scopes.length > 0) {
		encoded += '+' + scopes.map((s) => s.char).join('+');
	}
	if (namespace) encoded += `:${namespace}`;
	if (version) encoded += `@${version}`;

	return {
		ok: true,
		code: {
			raw: trimmed,
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
		result += '+' + scopeChars.join('+');
	}
	if (namespace) result += `:${namespace}`;
	if (version) result += `@${version}`;
	return result;
}
