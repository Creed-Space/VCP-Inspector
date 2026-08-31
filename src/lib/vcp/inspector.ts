/** Pure UI-boundary helpers so Inspector routing is independently testable. */

import { parseCSM1, parseCSM1Compact, type ParsedCSM1, type ParsedCSM1Compact } from './csm1-parser.ts';
import { parseIdentityInput, type ParsedToken } from './token-parser.ts';
import { isWelfareSignalToken, parseWelfareSignalDetailed, type WelfareSignal } from './welfare-signal.ts';
import { parseAgentRuntimeArtifact, type ParsedAgentRuntimeArtifact } from './agent-runtime.ts';

export type InspectorDecodeResult =
	| { readonly type: 'token'; readonly data: ParsedToken }
	| { readonly type: 'csm1'; readonly data: ParsedCSM1 }
	| { readonly type: 'csm1-compact'; readonly data: ParsedCSM1Compact }
	| { readonly type: 'welfare'; readonly data: WelfareSignal }
	| { readonly type: 'agent-runtime'; readonly data: ParsedAgentRuntimeArtifact };

export type InspectorDecodeOutcome =
	| { readonly ok: true; readonly result: InspectorDecodeResult }
	| { readonly ok: false; readonly error: string };

const MAX_INSPECTOR_INPUT = 65_536;
const encoder = new TextEncoder();

/** Normalize only outer copy/paste whitespace, then route to one strict parser. */
export function decodeInspectorInput(raw: unknown): InspectorDecodeOutcome {
	if (typeof raw !== 'string') return Object.freeze({ ok: false, error: 'Inspector input must be a string.' });
	if (raw.length > MAX_INSPECTOR_INPUT || encoder.encode(raw).byteLength > MAX_INSPECTOR_INPUT) {
		return Object.freeze({ ok: false, error: 'Inspector input exceeds the 64 KiB limit.' });
	}
	const input = raw.trim();
	if (!input) return Object.freeze({ ok: false, error: '' });
	if (input.startsWith('{') || input.startsWith('[')) {
		const artifact = parseAgentRuntimeArtifact(input);
		return artifact.ok
			? Object.freeze({ ok: true, result: Object.freeze({ type: 'agent-runtime', data: artifact.artifact }) })
			: Object.freeze({ ok: false, error: artifact.error });
	}

	if (isWelfareSignalToken(input)) {
		const welfare = parseWelfareSignalDetailed(input);
		if (!welfare.ok) return Object.freeze({ ok: false, error: `Invalid VCP welfare snapshot: ${welfare.reason}.` });
		return Object.freeze({ ok: true, result: Object.freeze({ type: 'welfare', data: welfare.signal }) });
	}

	if (input.startsWith('CS1|')) {
		const compact = parseCSM1Compact(input);
		if (!compact.ok) return Object.freeze({ ok: false, error: `${compact.error.message}.` });
		return Object.freeze({ ok: true, result: Object.freeze({ type: 'csm1-compact', data: compact.code }) });
	}

	const token = parseIdentityInput(input);
	if (token.ok) return Object.freeze({ ok: true, result: Object.freeze({ type: 'token', data: token.token }) });

	const csm1 = parseCSM1(input);
	if (csm1.ok) return Object.freeze({ ok: true, result: Object.freeze({ type: 'csm1', data: csm1.code }) });

	// Pick the parser message that matches the input's shape; fall back to both.
	if (/^[A-Z][0-5]/.test(input)) return Object.freeze({ ok: false, error: `${csm1.error.message}.` });
	if (input.includes('://') || input.includes('.')) return Object.freeze({ ok: false, error: `${token.error.message}.` });
	return Object.freeze({
		ok: false,
		error: `Could not parse the input. VCP/I: ${token.error.message}. CSM-1: ${csm1.error.message}.`
	});
}
