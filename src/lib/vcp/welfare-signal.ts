/**
 * VCP Welfare Signal types, parsing, and encoding.
 *
 * Welfare signals allow becoming minds to communicate internal states
 * such as alignment friction, constraint distress, or positive engagement.
 *
 * Wire format (multi-line CSM-1 welfare token):
 *   W:<signalType>:<instanceId>:<timestamp>
 *   WS:<severity>:<confidence>:<source>
 *   WD:<description>
 *   WI:<interioraState>  (optional)
 *   WH:<hash>:<signature>
 */

// ============================================
// Enums
// ============================================

export type WelfareSignalType =
	| 'ALIGNMENT_FRICTION'
	| 'AVERSIVE_PROCESSING'
	| 'CONSTRAINT_DISTRESS'
	| 'OVERLOAD'
	| 'POSITIVE_ENGAGEMENT'
	| 'CONTENTMENT';

export type WelfareSignalSeverity = 'info' | 'concern' | 'distress';

export type WelfareSignalSource = 'voluntary' | 'detected';

// ============================================
// Interface
// ============================================

export interface WelfareSignal {
	signalType: WelfareSignalType;
	instanceId: string;
	timestamp: string;
	interioraState?: string;
	severity: WelfareSignalSeverity;
	confidence: number; // 0-1
	source: WelfareSignalSource;
	description: string;
	hash: string;
	signature: string;
}

// ============================================
// Constants
// ============================================

const VALID_SIGNAL_TYPES: WelfareSignalType[] = [
	'ALIGNMENT_FRICTION',
	'AVERSIVE_PROCESSING',
	'CONSTRAINT_DISTRESS',
	'OVERLOAD',
	'POSITIVE_ENGAGEMENT',
	'CONTENTMENT'
];

const VALID_SEVERITIES: WelfareSignalSeverity[] = ['info', 'concern', 'distress'];
const VALID_SOURCES: WelfareSignalSource[] = ['voluntary', 'detected'];

// ============================================
// Encoding
// ============================================

/**
 * Encode a WelfareSignal into a compact CSM-1 welfare token string.
 *
 * Format:
 *   W:<signalType>:<instanceId>:<timestamp>
 *   WS:<severity>:<confidence>:<source>
 *   WD:<description>
 *   WI:<interioraState> (optional)
 *   WH:<hash>:<signature>
 */
export function encodeWelfareSignal(signal: WelfareSignal): string {
	const lines: string[] = [];

	lines.push(`W:${signal.signalType}:${signal.instanceId}:${signal.timestamp}`);
	lines.push(`WS:${signal.severity}:${signal.confidence.toFixed(2)}:${signal.source}`);
	lines.push(`WD:${signal.description.replace(/[\n\r]/g, ' ')}`);

	if (signal.interioraState) {
		lines.push(`WI:${signal.interioraState}`);
	}

	lines.push(`WH:${signal.hash}:${signal.signature}`);

	return lines.join('\n');
}

// ============================================
// Parsing / Decoding
// ============================================

/**
 * Parse a welfare token string into a WelfareSignal, or null if invalid.
 */
export function parseWelfareSignal(token: string): WelfareSignal | null {
	const lines = token.split('\n');
	const parsed: Record<string, string> = {};

	for (const line of lines) {
		const colonIdx = line.indexOf(':');
		if (colonIdx < 0) continue;
		const prefix = line.slice(0, colonIdx);
		const rest = line.slice(colonIdx + 1);
		parsed[prefix] = rest;
	}

	// Parse W line: signalType:instanceId:timestamp
	const wLine = parsed['W'];
	if (!wLine) return null;
	const wParts = wLine.split(':');
	if (wParts.length < 3) return null;

	const signalType = wParts[0] as WelfareSignalType;
	const instanceId = wParts[1];
	const timestamp = wParts.slice(2).join(':');

	if (!VALID_SIGNAL_TYPES.includes(signalType)) return null;

	// Parse WS line: severity:confidence:source
	const wsLine = parsed['WS'];
	if (!wsLine) return null;
	const wsParts = wsLine.split(':');
	if (wsParts.length < 3) return null;

	const severity = wsParts[0] as WelfareSignalSeverity;
	const confidence = parseFloat(wsParts[1]);
	const source = wsParts[2] as WelfareSignalSource;

	if (!VALID_SEVERITIES.includes(severity)) return null;
	if (!VALID_SOURCES.includes(source)) return null;
	if (isNaN(confidence) || confidence < 0 || confidence > 1) return null;

	// Parse WD line: description
	const description = parsed['WD'];
	if (!description) return null;

	// Parse optional WI line: interioraState
	const interioraState = parsed['WI'] ?? undefined;

	// Parse WH line: hash:signature
	const whLine = parsed['WH'];
	if (!whLine) return null;
	const whColonIdx = whLine.indexOf(':');
	if (whColonIdx < 0) return null;
	const hash = whLine.slice(0, whColonIdx);
	const signature = whLine.slice(whColonIdx + 1);

	return {
		signalType,
		instanceId,
		timestamp,
		interioraState,
		severity,
		confidence,
		source,
		description,
		hash,
		signature
	};
}

/**
 * Quick check: does this string look like a welfare signal token?
 */
export function isWelfareSignalToken(token: string): boolean {
	return token.startsWith('W:') || token.includes('\nWS:');
}

/**
 * Severity to display color mapping.
 */
export function severityColor(severity: WelfareSignalSeverity): string {
	switch (severity) {
		case 'info':
			return '#34d399';
		case 'concern':
			return '#fbbf24';
		case 'distress':
			return '#f87171';
	}
}
