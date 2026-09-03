/**
 * Pre-loaded example tokens, CSM-1 codes, and welfare signals.
 */

export interface Example {
	readonly label: string;
	readonly value: string;
	readonly type: 'token' | 'csm1' | 'csm1-compact' | 'welfare' | 'agent-runtime';
	readonly description: string;
}

export const EXAMPLES: readonly Example[] = Object.freeze([
	Object.freeze({
		label: 'Controlled Action Intent',
		value: JSON.stringify(
			{
				kind: 'action_intent',
				version: '0.1.0',
				intent_id: 'intent.local.record-setting',
				run_ref: 'vcp:artifact:run:run.local.controlled',
				step_ref: 'vcp:artifact:step:step.local.write',
				affordance_ref:
					'vcp:artifact:affordance:affordance.local.record-setting',
				arguments_digest:
					'sha256:1111111111111111111111111111111111111111111111111111111111111111',
				destination: 'local://reference/settings/theme',
				context_digest:
					'sha256:2222222222222222222222222222222222222222222222222222222222222222',
				policy_digest:
					'sha256:3333333333333333333333333333333333333333333333333333333333333333',
				descriptor_digest:
					'sha256:4444444444444444444444444444444444444444444444444444444444444444',
				requested_at: '2026-09-01T00:00:00Z',
				schema_digest:
					'sha256:5555555555555555555555555555555555555555555555555555555555555555',
				effect_class: 'reversible_write',
				situation_digest:
					'sha256:6666666666666666666666666666666666666666666666666666666666666666',
				expected_postconditions: ['setting value equals requested value'],
				resource_ceiling: {
					wall_time_ms: 1000,
					tokens: 1000,
					external_calls: 0,
					money_minor: 0,
					human_interruptions: 0,
					reserve_fraction: 0.25,
					model_calls: 0,
					local_compute_ms: 100,
					bytes: 65536,
					sensitive_egress_bytes: 0,
					privacy_units: 0,
					risk_units: 1,
					welfare_load_units: 0,
				},
				idempotency_scope: 'run.local.controlled/step.local.write',
				requested_authority: 'local-reference-write',
				digest:
					'sha256:7777777777777777777777777777777777777777777777777777777777777777',
			},
			null,
			2,
		),
		type: 'agent-runtime',
		description: 'Exact preflight binding for a reversible controlled action',
	}),
	Object.freeze({
		label: 'Accretion Candidate',
		value: JSON.stringify(
			{
				kind: 'accretion_candidate',
				version: '0.1.0',
				candidate_id: 'candidate.local.procedure',
				candidate_kind: 'procedure',
				content: {
					steps: ['validate', 'prove'],
				},
				scope: ['tenant:local', 'project:vcp'],
				provenance_refs: ['vcp:artifact:capsule:capsule.local.1'],
				validation_status: 'passed',
				review_required: false,
				expires_at: '2026-10-01T00:00:00Z',
				source_run_ref: 'vcp:artifact:run:run.local.controlled',
				supporting_evidence_refs: [
					'vcp:artifact:evidence:evidence.local.proof',
				],
				contradicting_evidence_refs: [],
				sensitivity: 'internal',
				confidence: 1.0,
				invalidation_triggers: ['schema digest changes'],
				revalidation: 'repeat deterministic local validation',
				promotion_policy: 'automatic-low-risk-local-procedure',
				expected_utility: 0.5,
				rollback: 'revoke promoted asset and invalidate future retrieval',
				quarantine_status: 'not_required',
				digest:
					'sha256:8888888888888888888888888888888888888888888888888888888888888888',
				dependency_digest:
					'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
			},
			null,
			2,
		),
		type: 'agent-runtime',
		description:
			'Validated, dependency-bound learning candidate awaiting policy-governed promotion',
	}),
	Object.freeze({
		label: 'Agent Runtime Situation View',
		value: JSON.stringify(
			{
				kind: 'situation_view',
				version: '0.1.0',
				situation_id: 'situation.local.release',
				goal: 'Determine whether the release candidate has current integrity evidence',
				principal_ref: 'vcp:artifact:principal:local-observer',
				known_claim_refs: ['vcp:artifact:claim:bundle-integrity'],
				unknowns: ['deployment status'],
				conflict_refs: [],
				normative_context_ref: 'vcp:artifact:normative:local-observe',
				authority_refs: ['vcp:artifact:authority:local-read'],
				budget: {
					wall_time_ms: 1000,
					tokens: 2000,
					external_calls: 0,
					money_minor: 0,
					human_interruptions: 0,
					reserve_fraction: 0.2,
				},
				active_work_refs: [],
				control_operations: [],
				affordance_refs: ['vcp:artifact:affordance:verify-bundle'],
				omissions: [],
				as_of: '2026-08-31T12:00:00Z',
				cursor: 'cursor.local.1',
				dependency_digest: `sha256:${'0'.repeat(64)}`,
				digest: `sha256:${'1'.repeat(64)}`,
			},
			null,
			2,
		),
		type: 'agent-runtime',
		description:
			'Bounded observe profile orientation with explicit unknowns, authority, budget, and affordances',
	}),
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
		label: 'COMPACT Tier Code',
		value: 'CS1|nanny|5|family.safe.guide|F,E',
		type: 'csm1-compact',
		description: 'Tier C COMPACT form pairing a Nanny persona with its VCP/I token (CSM1 grammar section 6.4)'
	}),
	Object.freeze({
		label: 'Core Welfare Context',
		value: 'WC:🛑⏸️📓🔒📊⚖️:2:welfare.creed-space.v1\nAS:🎯aligned:4|⚡moderate:3|💡invested:4|🌡️none:1',
		type: 'welfare',
		description: 'Auditor-verified core welfare affordances with a current Agent State line'
	}),
	Object.freeze({
		label: 'Self-Declared Minimal Context',
		value: 'WC:🛑:0:welfare.basic.v1\nAS:🎯uncertain:3|⚡moderate:3|💡neutral:3|🌡️mild:2',
		type: 'welfare',
		description: 'Self-declared (attestation 0) context granting only right of refusal — the counterparty side of the spec\'s welfare-mismatch example'
	}),
	Object.freeze({
		label: 'Embodied Welfare Context',
		value: 'WC:🛑⏸️📊🦾🚧:1:welfare.vcp-e.v1\nAS:🎯aligned:4|⚡moderate:3|🦾nominal:4|⚠️adequate:3',
		type: 'welfare',
		description: 'Platform-attested embodied welfare context with physical-system dimensions'
	})
]);
