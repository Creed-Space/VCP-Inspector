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

export const VCP_LAYERS: readonly VCPLayer[] = Object.freeze([
	Object.freeze({
		id: 'I',
		name: 'Identity',
		purpose: 'Token format, namespace tiers, and identity encoding',
		inspectorSupport: true
	}),
	Object.freeze({
		id: 'T',
		name: 'Transport',
		purpose: 'Signed bundles, manifests, content hashes, trust anchors, and signature verification',
		inspectorSupport: false
	}),
	Object.freeze({
		id: 'S',
		name: 'Semantics',
		purpose: 'CSM-1 codes encoding persona, level, and scopes',
		inspectorSupport: true
	}),
	Object.freeze({
		id: 'A',
		name: 'Adaptation',
		purpose: 'Context dimensions, state machines, hooks, and behavioral adaptation',
		inspectorSupport: false
	}),
	Object.freeze({
		id: 'M',
		name: 'Messaging',
		purpose: 'Inter-agent message types, escalation severity, and delivery semantics',
		inspectorSupport: false
	}),
	Object.freeze({
		id: 'E',
		name: 'Economic Governance',
		purpose: 'Fiduciary constraints, authorization gaps, and transaction governance',
		inspectorSupport: false
	})
]);

/**
 * Get the mnemonic string for the layer stack.
 */
export function getLayerMnemonic(): string {
	return VCP_LAYERS.map((l) => l.id).join('-');
}
