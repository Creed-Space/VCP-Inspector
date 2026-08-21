/** Pure UI-boundary helpers so Inspector routing is independently testable. */

import { parseCSM1, type ParsedCSM1 } from './csm1-parser.ts';
import { parseIdentityInput, type ParsedToken } from './token-parser.ts';
import { isWelfareSignalToken, parseWelfareSignal, type WelfareSignal } from './welfare-signal.ts';

export type InspectorDecodeResult =
	| { readonly type: 'token'; readonly data: ParsedToken }
	| { readonly type: 'csm1'; readonly data: ParsedCSM1 }
	| { readonly type: 'welfare'; readonly data: WelfareSignal };

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

	if (isWelfareSignalToken(input)) {
		const welfare = parseWelfareSignal(input);
		if (!welfare) return Object.freeze({ ok: false, error: 'Invalid VCP welfare snapshot.' });
		return Object.freeze({ ok: true, result: Object.freeze({ type: 'welfare', data: welfare }) });
	}

	const token = parseIdentityInput(input);
	if (token.ok) return Object.freeze({ ok: true, result: Object.freeze({ type: 'token', data: token.token }) });

	const csm1 = parseCSM1(input);
	if (csm1.ok) return Object.freeze({ ok: true, result: Object.freeze({ type: 'csm1', data: csm1.code }) });

	return Object.freeze({
		ok: false,
		error: `Could not parse the input. VCP/I: ${token.error.message}. CSM-1: ${csm1.error.message}.`
	});
}
