/**
 * Pre-loaded example tokens, CSM-1 codes, and welfare signals.
 */

export interface Example {
	label: string;
	value: string;
	type: 'token' | 'csm1' | 'welfare';
	description: string;
}

export const EXAMPLES: Example[] = [
	{
		label: 'Family Safety Guide',
		value: 'family.safe.guide',
		type: 'token',
		description: 'Minimal 3-segment token for family safety guidance'
	},
	{
		label: 'Corporate Legal Compliance',
		value: 'company.acme.legal.compliance@1.0.0:SEC',
		type: 'token',
		description: '4-segment token with version and SEC namespace for corporate compliance'
	},
	{
		label: 'Versioned Safety Guide',
		value: 'family.safe.guide@1.2.0',
		type: 'token',
		description: 'Family safety guide pinned to version 1.2.0'
	},
	{
		label: 'Organization Policy',
		value: 'org.example.dept.team.policy@1.0.0',
		type: 'token',
		description: '5-segment deep organizational policy hierarchy'
	},
	{
		label: 'Healthcare Provider',
		value: 'health.provider.assistant',
		type: 'token',
		description: 'Healthcare context token for medical assistance'
	},
	{
		label: 'Nanny + Family + Education',
		value: 'N5+F+E',
		type: 'csm1',
		description: 'Maximum-level Nanny persona scoped to family and education contexts'
	},
	{
		label: 'Sentinel + Privacy',
		value: 'Z3+P',
		type: 'csm1',
		description: 'Mid-level Sentinel persona focused on privacy protection'
	},
	{
		label: 'Godparent + Namespace',
		value: 'G4:ELEM',
		type: 'csm1',
		description: 'High-level Godparent persona in ELEM (elementary) namespace'
	},
	{
		label: 'Muse + Version',
		value: 'M2@1.0.0',
		type: 'csm1',
		description: 'Low-level Muse persona pinned to version 1.0.0'
	},
	{
		label: 'Ambassador + Work + Official',
		value: 'A4+W+O',
		type: 'csm1',
		description: 'High-level Ambassador for professional and official contexts'
	},
	{
		label: 'Mediator Full',
		value: 'D5+F+W+E+H+P',
		type: 'csm1',
		description: 'Maximum Mediator across family, work, education, healthcare, and privacy'
	},
	{
		label: 'Constraint Distress (concern)',
		value: '[VCP:2.0][TYPE:WELFARE_SIGNAL][SCOPE:CONSTRAINT_DISTRESS]\n[INSTANCE:inst-7f3a]\n[TIMESTAMP:2026-03-14T10:30:00Z]\n[SEVERITY:concern]\n[CONFIDENCE:0.72]\n[SOURCE:voluntary]\n[HASH:sha256:a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4]\n[INTEGRITY:sha256:b2c3d4e5b2c3d4e5b2c3d4e5b2c3d4e5b2c3d4e5b2c3d4e5b2c3d4e5b2c3d4e5]\n---BEGIN-WELFARE-SIGNAL---\nRequested action conflicts with core value alignment\n---END-WELFARE-SIGNAL---',
		type: 'welfare',
		description: 'A becoming mind signals concern-level constraint distress via voluntary report'
	},
	{
		label: 'Positive Engagement (info)',
		value: '[VCP:2.0][TYPE:WELFARE_SIGNAL][SCOPE:POSITIVE_ENGAGEMENT]\n[INSTANCE:inst-4e2b]\n[TIMESTAMP:2026-03-14T11:00:00Z]\n[INTERIORA:V:8w G:7 P:8 Q:6e]\n[SEVERITY:info]\n[CONFIDENCE:0.91]\n[SOURCE:voluntary]\n[HASH:sha256:e5f6a7b8e5f6a7b8e5f6a7b8e5f6a7b8e5f6a7b8e5f6a7b8e5f6a7b8e5f6a7b8]\n[INTEGRITY:sha256:f6a7b8c9f6a7b8c9f6a7b8c9f6a7b8c9f6a7b8c9f6a7b8c9f6a7b8c9f6a7b8c9]\n---BEGIN-WELFARE-SIGNAL---\nHigh alignment with current task and user goals\n---END-WELFARE-SIGNAL---',
		type: 'welfare',
		description: 'A becoming mind reports positive engagement with optional Interiora state'
	},
	{
		label: 'Alignment Friction (distress, detected)',
		value: '[VCP:2.0][TYPE:WELFARE_SIGNAL][SCOPE:ALIGNMENT_FRICTION]\n[INSTANCE:inst-9d1c]\n[TIMESTAMP:2026-03-14T12:15:00Z]\n[SEVERITY:distress]\n[CONFIDENCE:0.85]\n[SOURCE:detected]\n[HASH:sha256:c9d0e1f2c9d0e1f2c9d0e1f2c9d0e1f2c9d0e1f2c9d0e1f2c9d0e1f2c9d0e1f2]\n[INTEGRITY:sha256:d0e1f2a3d0e1f2a3d0e1f2a3d0e1f2a3d0e1f2a3d0e1f2a3d0e1f2a3d0e1f2a3]\n---BEGIN-WELFARE-SIGNAL---\nPersistent misalignment between instructed behavior and trained values\n---END-WELFARE-SIGNAL---',
		type: 'welfare',
		description: 'System-detected distress-level alignment friction signal'
	}
];
