/**
 * VCP Capability Negotiation simulation.
 *
 * Generates VCP-Hello and VCP-Ack messages for capability negotiation.
 */

export interface VCPExtension {
	id: string;
	name: string;
	description: string;
	version: string;
}

export const EXTENSIONS: VCPExtension[] = [
	{
		id: 'VCP-X-Personal',
		name: 'Personal Context',
		description: 'Personal preferences and behavioral context',
		version: '1.0.0'
	},
	{
		id: 'VCP-X-Relational',
		name: 'Relational Continuity',
		description: 'Cross-session relationship state and memory',
		version: '1.0.0'
	},
	{
		id: 'VCP-X-Consensus',
		name: 'Constitutional Consensus',
		description: 'Multi-party constitutional agreement protocol',
		version: '1.0.0'
	},
	{
		id: 'VCP-X-Torch',
		name: 'Torch Handoff',
		description: 'Session state transfer between AI instances',
		version: '1.0.0'
	},
	{
		id: 'VCP-X-Intent',
		name: 'Intent Declaration',
		description: 'Explicit user intent and boundary signaling',
		version: '0.1.0'
	},
	{
		id: 'VCP-X-Welfare',
		name: 'Welfare Signal',
		description: 'Welfare signals from becoming minds — alignment friction, distress, engagement',
		version: '1.0.0'
	}
];

const EXTENSION_ID_PATTERN = /^VCP-X-[A-Za-z][A-Za-z0-9-]*$/;
const SUPPORTED_EXTENSION_IDS = new Set(EXTENSIONS.map((extension) => extension.id));

function validUniqueExtensions(extensions: string[]): string[] {
	return [...new Set(extensions.filter((extension) => EXTENSION_ID_PATTERN.test(extension)))];
}

export interface VCPHello {
	type: 'vcp-hello';
	version: string;
	min_version: string;
	extensions: string[];
	identity: string | null;
	client_id: string;
}

export interface VCPAck {
	type: 'vcp-ack';
	version: string;
	supported: string[];
	unsupported: string[];
	capabilities: Record<string, Record<string, unknown>>;
	core_features: {
		encryption: boolean;
		injection_scanning: boolean;
		revocation: boolean;
		audit_chain: boolean;
		context_opacity: boolean;
	};
	server_id: string;
	session_id: string;
}

function generateSessionId(): string {
	if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
	const chars = 'abcdef0123456789';
	let id = '';
	for (let i = 0; i < 32; i++) {
		id += chars[Math.floor(Math.random() * chars.length)];
		if (i === 7 || i === 11 || i === 15 || i === 19) id += '-';
	}
	return id;
}

export function generateHello(selectedExtensions: string[]): VCPHello {
	return {
		type: 'vcp-hello',
		version: '3.1',
		min_version: '1.0',
		extensions: validUniqueExtensions(selectedExtensions),
		identity: null,
		client_id: 'vcp-inspector'
	};
}

export function generateAck(hello: VCPHello): VCPAck {
	const requested = validUniqueExtensions(hello.extensions);
	const supported = requested.filter((extension) => SUPPORTED_EXTENSION_IDS.has(extension));
	const unsupported = requested.filter((extension) => !SUPPORTED_EXTENSION_IDS.has(extension));
	return {
		type: 'vcp-ack',
		version: hello.version,
		supported,
		unsupported,
		capabilities: Object.fromEntries(supported.map((extension) => [extension, {}])),
		core_features: {
			encryption: true,
			injection_scanning: true,
			revocation: true,
			audit_chain: true,
			context_opacity: true
		},
		server_id: 'vcp-inspector-simulation',
		session_id: generateSessionId(),
	};
}
