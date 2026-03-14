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
		label: 'Ambassador + Work + Legal',
		value: 'A4+W+L',
		type: 'csm1',
		description: 'High-level Ambassador for professional and legal contexts'
	},
	{
		label: 'Hotrod Minimal',
		value: 'H1',
		type: 'csm1',
		description: 'Minimal Hotrod persona — performance-optimized with fewest guardrails'
	},
	{
		label: 'Mediator Full',
		value: 'D5+F+W+E+H+P',
		type: 'csm1',
		description: 'Maximum Mediator across family, work, education, healthcare, and privacy'
	},
	{
		label: 'Constraint Distress (concern)',
		value: 'W:CONSTRAINT_DISTRESS:inst-7f3a:2026-03-14T10:30:00Z\nWS:concern:0.72:voluntary\nWD:Requested action conflicts with core value alignment\nWH:a1b2c3d4:sig-voluntary-001',
		type: 'welfare',
		description: 'A becoming mind signals concern-level constraint distress via voluntary report'
	},
	{
		label: 'Positive Engagement (info)',
		value: 'W:POSITIVE_ENGAGEMENT:inst-4e2b:2026-03-14T11:00:00Z\nWS:info:0.91:voluntary\nWD:High alignment with current task and user goals\nWI:V:8w G:7 P:8 Q:6e\nWH:e5f6a7b8:sig-voluntary-002',
		type: 'welfare',
		description: 'A becoming mind reports positive engagement with optional Interiora state'
	},
	{
		label: 'Alignment Friction (distress, detected)',
		value: 'W:ALIGNMENT_FRICTION:inst-9d1c:2026-03-14T12:15:00Z\nWS:distress:0.85:detected\nWD:Persistent misalignment between instructed behavior and trained values\nWH:c9d0e1f2:sig-detected-003',
		type: 'welfare',
		description: 'System-detected distress-level alignment friction signal'
	}
];
