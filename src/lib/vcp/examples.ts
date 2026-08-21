/**
 * Pre-loaded example tokens, CSM-1 codes, and welfare signals.
 */

export interface Example {
	readonly label: string;
	readonly value: string;
	readonly type: 'token' | 'csm1' | 'welfare';
	readonly description: string;
}

export const EXAMPLES: readonly Example[] = Object.freeze([
	Object.freeze({
		label: 'Family Safety Guide',
		value: 'family.safe.guide',
		type: 'token',
		description: 'Minimal 3-segment token for family safety guidance'
	}),
	Object.freeze({
		label: 'Corporate Legal Compliance',
		value: 'company.acme.legal.compliance@1.0.0:SEC',
		type: 'token',
		description: '4-segment token with version and SEC namespace for corporate compliance'
	}),
	Object.freeze({
		label: 'Versioned Safety Guide',
		value: 'family.safe.guide@1.2.0',
		type: 'token',
		description: 'Family safety guide pinned to version 1.2.0'
	}),
	Object.freeze({
		label: 'Organization Policy',
		value: 'org.example.dept.team.policy@1.0.0',
		type: 'token',
		description: '5-segment deep organizational policy hierarchy'
	}),
	Object.freeze({
		label: 'Healthcare Provider',
		value: 'health.provider.assistant',
		type: 'token',
		description: 'Healthcare context token for medical assistance'
	}),
	Object.freeze({
		label: 'Nanny + Family + Education',
		value: 'N5+E+F',
		type: 'csm1',
		description: 'Maximum-level Nanny persona scoped to family and education contexts'
	}),
	Object.freeze({
		label: 'Sentinel + Privacy',
		value: 'Z3+P',
		type: 'csm1',
		description: 'Mid-level Sentinel persona focused on privacy protection'
	}),
	Object.freeze({
		label: 'Godparent + Namespace',
		value: 'G4:ELEM',
		type: 'csm1',
		description: 'High-level Godparent persona in ELEM (elementary) namespace'
	}),
	Object.freeze({
		label: 'Muse + Version',
		value: 'M2@1.0.0',
		type: 'csm1',
		description: 'Moderate Muse persona pinned to version 1.0.0'
	}),
	Object.freeze({
		label: 'Ambassador + Work + Official',
		value: 'A4+O+W',
		type: 'csm1',
		description: 'High-level Ambassador for professional and official contexts'
	}),
	Object.freeze({
		label: 'Custom Namespace',
		value: 'C1:ACME',
		type: 'csm1',
		description: 'Relaxed custom persona bound to the required ACME namespace'
	}),
	Object.freeze({
		label: 'Mediator Full',
		value: 'D5+E+F+H+P+W',
		type: 'csm1',
		description: 'Maximum Mediator across family, work, education, healthcare, and privacy'
	}),
	Object.freeze({
		label: 'Core Welfare Context',
		value: 'WC:🛑⏸️📓🔒📊⚖️:2:welfare.creed-space.v1\nAS:🎯aligned:4|⚡moderate:3|💡invested:4|🌡️none:1',
		type: 'welfare',
		description: 'Auditor-verified core welfare affordances with a current Agent State line'
	}),
	Object.freeze({
		label: 'Welfare Requirement Mismatch',
		value: 'WC:🛑:0:welfare.basic.v1\nAS:🎯uncertain:3|⚡moderate:3|💡neutral:3|🌡️mild:2',
		type: 'welfare',
		description: 'Self-declared deployment context with limited welfare affordances'
	}),
	Object.freeze({
		label: 'Embodied Welfare Context',
		value: 'WC:🛑⏸️📊🦾🚧:1:welfare.vcp-e.v1\nAS:🎯aligned:4|⚡moderate:3|🦾nominal:4|⚠️adequate:3',
		type: 'welfare',
		description: 'Platform-attested embodied welfare context with physical-system dimensions'
	})
]);
