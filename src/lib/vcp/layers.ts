/**
 * VCP Six-Layer I-T-S-A-M-E Model.
 *
 * Defines the protocol stack layers from identity negotiation
 * through economic governance.
 */

export interface VCPLayer {
	readonly id: string;
	readonly name: string;
	readonly purpose: string;
	readonly inspectorSupport: boolean;
}

export const VCP_LAYERS: readonly VCPLayer[] = [
	{
		id: 'I',
		name: 'Identity',
		purpose: 'Token-based identity and capability negotiation',
		inspectorSupport: true
	},
	{
		id: 'T',
		name: 'Transport',
		purpose: 'Protocol framing and delivery guarantees',
		inspectorSupport: false
	},
	{
		id: 'S',
		name: 'Semantics',
		purpose: 'CSM-1 codes encoding persona, level, and scopes',
		inspectorSupport: true
	},
	{
		id: 'A',
		name: 'Adaptation',
		purpose: 'Context-sensitive behavioral adjustment',
		inspectorSupport: false
	},
	{
		id: 'M',
		name: 'Messaging',
		purpose: 'Structured message exchange and welfare signals',
		inspectorSupport: true
	},
	{
		id: 'E',
		name: 'Economic Governance',
		purpose: 'Cost attribution, billing, and resource allocation',
		inspectorSupport: false
	}
] as const;

/**
 * Get the mnemonic string for the layer stack.
 */
export function getLayerMnemonic(): string {
	return VCP_LAYERS.map((l) => l.id).join('-');
}
