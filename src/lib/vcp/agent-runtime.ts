/** Strict, dependency-free inspection boundary for Agent Runtime Profile artifacts. */

export const AGENT_RUNTIME_VERSION = "0.1.0" as const;

export const AGENT_RUNTIME_KINDS = Object.freeze([
  "agent_result",
  "situation_view",
  "evidence_claim",
  "evidence_graph",
  "normative_context",
  "capability_descriptor",
  "affordance",
  "proof_plan",
  "run_spec",
  "plan_step",
  "action_intent",
  "decision_receipt",
  "authority_grant_ref",
  "execution_attempt",
  "execution_receipt",
  "run_proof",
  "accretion_candidate",
  "promotion_record",
  "influence_receipt",
  "control_command",
  "event_envelope",
  "agent_runtime_profile_offer",
  "agent_runtime_profile_ack",
  "cursor_delta",
  "objection_response",
  "experience_capsule",
  "revocation_record",
] as const);

export type AgentRuntimeKind = (typeof AGENT_RUNTIME_KINDS)[number];

export interface ParsedAgentRuntimeArtifact {
  readonly kind: AgentRuntimeKind;
  readonly version: typeof AGENT_RUNTIME_VERSION;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly effectClass: string | null;
  readonly authorityClass: string | null;
  readonly digest: string | null;
  readonly evidenceRefs: readonly string[];
  readonly lineageRefs: readonly string[];
  readonly safeNext: readonly string[];
  readonly assurance: readonly AssuranceView[];
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface AssuranceView {
  readonly axis: string;
  readonly status: "passed" | "failed" | "unknown" | "not_applicable";
  readonly detail: string;
}

export type AgentRuntimeParseOutcome =
  | { readonly ok: true; readonly artifact: ParsedAgentRuntimeArtifact }
  | { readonly ok: false; readonly error: string };

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ID = /^[a-z][a-z0-9_.:-]{0,255}$/;
const ARTIFACT_REF =
  /^vcp:artifact:[a-z][a-z0-9-]{0,63}:[A-Za-z0-9._~:/?#@!$&()*+,;=%-]{1,1024}$/;

const ROOT_KEYS: Readonly<Record<AgentRuntimeKind, readonly string[]>> =
  Object.freeze({
    agent_result: [
      "kind",
      "version",
      "meta",
      "status",
      "value",
      "assurance",
      "evidence_refs",
      "resources",
      "safe_next",
      "warnings",
      "omissions",
      "failure",
    ],
    situation_view: [
      "kind",
      "version",
      "situation_id",
      "goal",
      "principal_ref",
      "known_claim_refs",
      "unknowns",
      "conflict_refs",
      "normative_context_ref",
      "authority_refs",
      "budget",
      "active_work_refs",
      "control_operations",
      "affordance_refs",
      "omissions",
      "as_of",
      "cursor",
      "dependency_digest",
      "digest",
    ],
    evidence_claim: [
      "kind",
      "version",
      "claim_id",
      "subject",
      "predicate",
      "object",
      "basis",
      "source_ref",
      "observed_at",
      "fresh_until",
      "confidence",
      "authority_class",
      "scope",
      "privacy_class",
    ],
    evidence_graph: ["kind", "version", "claims", "edges", "digest"],
    normative_context: [
      "kind",
      "version",
      "clauses",
      "conflict_refs",
      "omissions",
      "digest",
      "resolution_rule",
      "selected_clause_refs",
    ],
    capability_descriptor: [
      "kind",
      "version",
      "capability_id",
      "revision",
      "summary",
      "effect_class",
      "authority_class",
      "inputs",
      "outputs",
      "preconditions",
      "postconditions",
      "privacy_classes",
      "reversible",
      "reconciliation",
      "digest",
    ],
    affordance: [
      "kind",
      "version",
      "affordance_id",
      "capability_ref",
      "situation_digest",
      "state",
      "summary",
      "effect_class",
      "authority_class",
      "prerequisites",
      "cost",
      "evidence_outputs",
      "recovery",
      "safe_next",
      "descriptor_digest",
    ],
    proof_plan: [
      "kind",
      "version",
      "proof_plan_id",
      "predicates",
      "budget",
      "digest",
    ],
    run_spec: [
      "kind",
      "version",
      "run_id",
      "goal",
      "situation_ref",
      "proof_plan_ref",
      "budget",
      "risk_ceiling",
      "status",
      "digest",
    ],
    plan_step: [
      "kind",
      "version",
      "step_id",
      "run_ref",
      "affordance_ref",
      "depends_on",
      "proof_predicate_refs",
      "digest",
    ],
    action_intent: [
      "kind",
      "version",
      "intent_id",
      "run_ref",
      "step_ref",
      "affordance_ref",
      "arguments_digest",
      "destination",
      "context_digest",
      "policy_digest",
      "descriptor_digest",
      "requested_at",
      "digest",
      "schema_digest",
      "effect_class",
      "situation_digest",
      "expected_postconditions",
      "resource_ceiling",
      "idempotency_scope",
      "requested_authority",
    ],
    decision_receipt: [
      "kind",
      "version",
      "decision_id",
      "intent_ref",
      "decision",
      "reason_codes",
      "policy_digest",
      "decided_at",
      "expires_at",
      "digest",
      "reviewer_ref",
    ],
    authority_grant_ref: [
      "kind",
      "version",
      "grant_ref",
      "decision_ref",
      "intent_digest",
      "single_use",
      "expires_at",
      "actor_ref",
      "tenant_ref",
      "run_ref",
      "step_ref",
      "capability_ref",
      "arguments_digest",
      "destination",
      "effect_class",
      "resource_ceiling",
      "nonce_digest",
    ],
    execution_attempt: [
      "kind",
      "version",
      "attempt_id",
      "intent_ref",
      "grant_ref",
      "idempotency_key",
      "claimed_at",
      "dispatched_at",
      "digest",
      "action_id",
      "effect_boundary",
    ],
    execution_receipt: [
      "kind",
      "version",
      "receipt_id",
      "attempt_ref",
      "effect_status",
      "provider_ref",
      "evidence_refs",
      "observed_at",
      "reconcile_ref",
      "digest",
    ],
    run_proof: [
      "kind",
      "version",
      "proof_id",
      "run_ref",
      "predicate_results",
      "mandatory_complete",
      "generated_at",
      "digest",
    ],
    accretion_candidate: [
      "kind",
      "version",
      "candidate_id",
      "candidate_kind",
      "content",
      "scope",
      "provenance_refs",
      "validation_status",
      "review_required",
      "expires_at",
      "digest",
      "source_run_ref",
      "supporting_evidence_refs",
      "contradicting_evidence_refs",
      "sensitivity",
      "confidence",
      "invalidation_triggers",
      "revalidation",
      "promotion_policy",
      "expected_utility",
      "rollback",
      "quarantine_status",
      "dependency_digest",
    ],
    promotion_record: [
      "kind",
      "version",
      "promotion_id",
      "candidate_ref",
      "promoted_asset_ref",
      "authority_ref",
      "decision_ref",
      "promoted_at",
      "expires_at",
      "revocation_ref",
      "digest",
      "evidence_refs",
      "validation_results",
      "scope",
      "promoted_content_digest",
      "dependency_digest",
    ],
    influence_receipt: [
      "kind",
      "version",
      "influence_id",
      "promoted_asset_ref",
      "decision_or_output_ref",
      "use",
      "observed_at",
      "digest",
      "scope",
      "invalidated_at",
    ],
    control_command: [
      "kind",
      "version",
      "command_id",
      "operation",
      "target_ref",
      "principal_ref",
      "reason",
      "evidence_refs",
      "issued_at",
      "idempotency_key",
      "digest",
      "represented_subject_ref",
      "authenticated_scope",
      "desired_transition",
      "expires_at",
    ],
    event_envelope: [
      "kind",
      "version",
      "event_id",
      "event_type",
      "aggregate_ref",
      "sequence",
      "occurred_at",
      "actor_ref",
      "payload_ref",
      "previous_digest",
      "digest",
      "source_ref",
      "recorded_at",
      "causal_parent_ref",
      "payload_digest",
      "redacted_summary",
      "sensitivity",
      "evidence_refs",
      "audit_refs",
      "state_transition_version",
    ],
    agent_runtime_profile_offer: ["kind", "version", "required", "optional"],
    agent_runtime_profile_ack: [
      "kind",
      "version",
      "selected",
      "unsupported_optional",
      "bootstrap_ref",
      "capability_catalog_digest",
      "principal_session_ref",
      "event_binding",
      "expires_at",
    ],
    cursor_delta: [
      "kind",
      "version",
      "prior_cursor",
      "cursor",
      "changed_refs",
      "invalidated_refs",
      "events",
      "situation",
      "resync_required",
      "safe_next",
      "digest",
    ],
    objection_response: [
      "kind",
      "version",
      "response_id",
      "command_ref",
      "status",
      "responder_ref",
      "rationale",
      "resolution_refs",
      "decided_at",
      "digest",
    ],
    experience_capsule: [
      "kind",
      "version",
      "capsule_id",
      "run_ref",
      "proof_ref",
      "terminal_status",
      "candidate_refs",
      "resource_actual",
      "redacted_summary",
      "created_at",
      "digest",
    ],
    revocation_record: [
      "kind",
      "version",
      "revocation_id",
      "promotion_ref",
      "promoted_asset_ref",
      "authority_ref",
      "reason",
      "revoked_at",
      "propagation_bound_ms",
      "downstream_influence_refs",
      "digest",
    ],
  });

const REQUIRED_KEYS: Readonly<Record<AgentRuntimeKind, readonly string[]>> =
  Object.freeze({
    agent_result: [
      "kind",
      "version",
      "meta",
      "status",
      "value",
      "assurance",
      "evidence_refs",
      "resources",
      "safe_next",
      "warnings",
      "omissions",
      "failure",
    ],
    situation_view: [
      "kind",
      "version",
      "situation_id",
      "goal",
      "principal_ref",
      "known_claim_refs",
      "unknowns",
      "conflict_refs",
      "normative_context_ref",
      "authority_refs",
      "budget",
      "active_work_refs",
      "control_operations",
      "affordance_refs",
      "omissions",
      "as_of",
      "cursor",
      "dependency_digest",
      "digest",
    ],
    evidence_claim: [
      "kind",
      "version",
      "claim_id",
      "subject",
      "predicate",
      "object",
      "basis",
      "source_ref",
      "observed_at",
      "confidence",
      "authority_class",
      "scope",
      "privacy_class",
    ],
    evidence_graph: ["kind", "version", "claims", "edges", "digest"],
    normative_context: [
      "kind",
      "version",
      "clauses",
      "conflict_refs",
      "omissions",
      "digest",
      "resolution_rule",
      "selected_clause_refs",
    ],
    capability_descriptor: [
      "kind",
      "version",
      "capability_id",
      "revision",
      "summary",
      "effect_class",
      "authority_class",
      "inputs",
      "outputs",
      "preconditions",
      "postconditions",
      "privacy_classes",
      "reversible",
      "reconciliation",
      "digest",
    ],
    affordance: [
      "kind",
      "version",
      "affordance_id",
      "capability_ref",
      "situation_digest",
      "state",
      "summary",
      "effect_class",
      "authority_class",
      "prerequisites",
      "cost",
      "evidence_outputs",
      "recovery",
      "safe_next",
      "descriptor_digest",
    ],
    proof_plan: [
      "kind",
      "version",
      "proof_plan_id",
      "predicates",
      "budget",
      "digest",
    ],
    run_spec: [
      "kind",
      "version",
      "run_id",
      "goal",
      "situation_ref",
      "proof_plan_ref",
      "budget",
      "risk_ceiling",
      "status",
      "digest",
    ],
    plan_step: [
      "kind",
      "version",
      "step_id",
      "run_ref",
      "affordance_ref",
      "depends_on",
      "proof_predicate_refs",
      "digest",
    ],
    action_intent: [
      "kind",
      "version",
      "intent_id",
      "run_ref",
      "step_ref",
      "affordance_ref",
      "arguments_digest",
      "destination",
      "context_digest",
      "policy_digest",
      "descriptor_digest",
      "requested_at",
      "digest",
      "schema_digest",
      "effect_class",
      "situation_digest",
      "expected_postconditions",
      "resource_ceiling",
      "idempotency_scope",
      "requested_authority",
    ],
    decision_receipt: [
      "kind",
      "version",
      "decision_id",
      "intent_ref",
      "decision",
      "reason_codes",
      "policy_digest",
      "decided_at",
      "digest",
      "reviewer_ref",
    ],
    authority_grant_ref: [
      "kind",
      "version",
      "grant_ref",
      "decision_ref",
      "intent_digest",
      "single_use",
      "expires_at",
      "actor_ref",
      "tenant_ref",
      "run_ref",
      "step_ref",
      "capability_ref",
      "arguments_digest",
      "destination",
      "effect_class",
      "resource_ceiling",
      "nonce_digest",
    ],
    execution_attempt: [
      "kind",
      "version",
      "attempt_id",
      "intent_ref",
      "grant_ref",
      "claimed_at",
      "digest",
      "action_id",
      "effect_boundary",
    ],
    execution_receipt: [
      "kind",
      "version",
      "receipt_id",
      "attempt_ref",
      "effect_status",
      "evidence_refs",
      "observed_at",
      "digest",
    ],
    run_proof: [
      "kind",
      "version",
      "proof_id",
      "run_ref",
      "predicate_results",
      "mandatory_complete",
      "generated_at",
      "digest",
    ],
    accretion_candidate: [
      "kind",
      "version",
      "candidate_id",
      "candidate_kind",
      "content",
      "scope",
      "provenance_refs",
      "validation_status",
      "review_required",
      "digest",
      "source_run_ref",
      "supporting_evidence_refs",
      "contradicting_evidence_refs",
      "sensitivity",
      "confidence",
      "invalidation_triggers",
      "revalidation",
      "promotion_policy",
      "expected_utility",
      "rollback",
      "quarantine_status",
      "dependency_digest",
    ],
    promotion_record: [
      "kind",
      "version",
      "promotion_id",
      "candidate_ref",
      "promoted_asset_ref",
      "authority_ref",
      "decision_ref",
      "promoted_at",
      "revocation_ref",
      "digest",
      "evidence_refs",
      "validation_results",
      "scope",
      "promoted_content_digest",
      "dependency_digest",
    ],
    influence_receipt: [
      "kind",
      "version",
      "influence_id",
      "promoted_asset_ref",
      "decision_or_output_ref",
      "use",
      "observed_at",
      "digest",
      "scope",
      "invalidated_at",
    ],
    control_command: [
      "kind",
      "version",
      "command_id",
      "operation",
      "target_ref",
      "principal_ref",
      "reason",
      "evidence_refs",
      "issued_at",
      "idempotency_key",
      "digest",
      "represented_subject_ref",
      "authenticated_scope",
      "desired_transition",
      "expires_at",
    ],
    event_envelope: [
      "kind",
      "version",
      "event_id",
      "event_type",
      "aggregate_ref",
      "sequence",
      "occurred_at",
      "actor_ref",
      "payload_ref",
      "digest",
      "source_ref",
      "recorded_at",
      "causal_parent_ref",
      "payload_digest",
      "redacted_summary",
      "sensitivity",
      "evidence_refs",
      "audit_refs",
      "state_transition_version",
    ],
    agent_runtime_profile_offer: ["kind", "version", "required", "optional"],
    agent_runtime_profile_ack: [
      "kind",
      "version",
      "selected",
      "unsupported_optional",
      "bootstrap_ref",
      "capability_catalog_digest",
      "principal_session_ref",
      "event_binding",
      "expires_at",
    ],
    cursor_delta: [
      "kind",
      "version",
      "prior_cursor",
      "cursor",
      "changed_refs",
      "invalidated_refs",
      "events",
      "situation",
      "resync_required",
      "safe_next",
      "digest",
    ],
    objection_response: [
      "kind",
      "version",
      "response_id",
      "command_ref",
      "status",
      "responder_ref",
      "rationale",
      "resolution_refs",
      "decided_at",
      "digest",
    ],
    experience_capsule: [
      "kind",
      "version",
      "capsule_id",
      "run_ref",
      "proof_ref",
      "terminal_status",
      "candidate_refs",
      "resource_actual",
      "redacted_summary",
      "created_at",
      "digest",
    ],
    revocation_record: [
      "kind",
      "version",
      "revocation_id",
      "promotion_ref",
      "promoted_asset_ref",
      "authority_ref",
      "reason",
      "revoked_at",
      "propagation_bound_ms",
      "downstream_influence_refs",
      "digest",
    ],
  });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    return null;
  return Object.freeze([...value]);
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): string | null {
  const missing = allowed.find((key) => !(key in value));
  if (missing) return `Missing required field: ${missing}.`;
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  return unknown ? `Unknown field is forbidden: ${unknown}.` : null;
}

function requiredString(
  value: unknown,
  field: string,
  pattern?: RegExp,
): string | null {
  if (typeof value !== "string" || value.length === 0)
    return `${field} must be a non-empty string.`;
  return pattern && !pattern.test(value)
    ? `${field} has an invalid format.`
    : null;
}

function requiredStringArray(value: unknown, field: string): string | null {
  return stringArray(value) ? null : `${field} must be an array of strings.`;
}

function validateCommon(
  document: Record<string, unknown>,
): AgentRuntimeKind | string {
  if (!AGENT_RUNTIME_KINDS.includes(document.kind as AgentRuntimeKind)) {
    return "Unsupported Agent Runtime artifact kind.";
  }
  if (document.version !== AGENT_RUNTIME_VERSION)
    return "Unsupported Agent Runtime artifact version.";
  const kind = document.kind as AgentRuntimeKind;
  const missing = REQUIRED_KEYS[kind].find((key) => !(key in document));
  if (missing) return "Missing required field: " + missing + ".";
  const unknown = Object.keys(document).find(
    (key) => !ROOT_KEYS[kind].includes(key),
  );
  if (unknown) return "Unknown field is forbidden: " + unknown + ".";
  return kind;
}

function validateAgentResult(document: Record<string, unknown>): string | null {
  if (!isRecord(document.meta)) return "meta must be an object.";
  const meta = document.meta;
  const metaError = exactKeys(
    meta,
    [
      "profile",
      "schema_version",
      "schema_digest",
      "correlation_id",
      "as_of",
      "cursor",
      "dependency_digest",
    ].filter((key) => key !== "cursor" || key in meta),
  );
  if (metaError) return `meta: ${metaError}`;
  if (
    !["observe@0.1.0", "controlled@0.1.0", "accretive@0.1.0"].includes(
      String(meta.profile),
    )
  )
    return "meta.profile must select an Agent Runtime Profile 0.1.0 level.";
  if (meta.schema_version !== AGENT_RUNTIME_VERSION)
    return "meta.schema_version is unsupported.";
  if (!DIGEST.test(String(meta.schema_digest)))
    return "meta.schema_digest has an invalid format.";
  if (!DIGEST.test(String(meta.dependency_digest)))
    return "meta.dependency_digest has an invalid format.";
  if (!ID.test(String(meta.correlation_id)))
    return "meta.correlation_id has an invalid format.";
  if (requiredString(document.status, "status"))
    return "status must be a non-empty string.";
  if (!isRecord(document.assurance)) return "assurance must be an object.";
  const assuranceError = exactKeys(document.assurance, ["overall", "checks"]);
  if (assuranceError) return `assurance: ${assuranceError}`;
  if (
    !Array.isArray(document.assurance.checks) ||
    document.assurance.checks.length === 0
  ) {
    return "assurance.checks must be a non-empty array.";
  }
  return requiredStringArray(document.evidence_refs, "evidence_refs");
}

function validateSituation(document: Record<string, unknown>): string | null {
  for (const [field, pattern] of [
    ["situation_id", ID],
    ["principal_ref", ARTIFACT_REF],
    ["normative_context_ref", ARTIFACT_REF],
    ["dependency_digest", DIGEST],
    ["digest", DIGEST],
  ] as const) {
    const error = requiredString(document[field], field, pattern);
    if (error) return error;
  }
  if (requiredString(document.goal, "goal"))
    return "goal must be a non-empty string.";
  for (const field of [
    "known_claim_refs",
    "unknowns",
    "conflict_refs",
    "authority_refs",
    "active_work_refs",
    "control_operations",
    "affordance_refs",
  ] as const) {
    const error = requiredStringArray(document[field], field);
    if (error) return error;
  }
  if (!isRecord(document.budget)) return "budget must be an object.";
  const budget = document.budget;
  const budgetError = exactKeys(
    budget,
    [
      "wall_time_ms",
      "tokens",
      "external_calls",
      "money_minor",
      "human_interruptions",
      "reserve_fraction",
    ].filter((key) => key === "reserve_fraction" || key in budget),
  );
  return budgetError ? `budget: ${budgetError}` : null;
}

function validateDescriptor(document: Record<string, unknown>): string | null {
  for (const field of [
    "capability_id",
    "revision",
    "summary",
    "effect_class",
    "authority_class",
    "reconciliation",
  ] as const) {
    const error = requiredString(
      document[field],
      field,
      field === "capability_id" ? ID : undefined,
    );
    if (error) return error;
  }
  for (const field of [
    "inputs",
    "outputs",
    "preconditions",
    "postconditions",
    "privacy_classes",
  ] as const) {
    const error = requiredStringArray(document[field], field);
    if (error) return error;
  }
  if (typeof document.reversible !== "boolean")
    return "reversible must be a boolean.";
  return requiredString(document.digest, "digest", DIGEST);
}

function validateAffordance(document: Record<string, unknown>): string | null {
  for (const [field, pattern] of [
    ["affordance_id", ID],
    ["capability_ref", ARTIFACT_REF],
    ["situation_digest", DIGEST],
    ["descriptor_digest", DIGEST],
  ] as const) {
    const error = requiredString(document[field], field, pattern);
    if (error) return error;
  }
  for (const field of [
    "state",
    "summary",
    "effect_class",
    "authority_class",
  ] as const) {
    const error = requiredString(document[field], field);
    if (error) return error;
  }
  for (const field of [
    "prerequisites",
    "evidence_outputs",
    "recovery",
  ] as const) {
    const error = requiredStringArray(document[field], field);
    if (error) return error;
  }
  return isRecord(document.cost) && Array.isArray(document.safe_next)
    ? null
    : "cost must be an object and safe_next must be an array.";
}

function validateGeneric(document: Record<string, unknown>): string | null {
  for (const [field, value] of Object.entries(document)) {
    if ((field === "digest" || field.endsWith("_digest")) && value !== null) {
      const error = requiredString(value, field, DIGEST);
      if (error) return error;
    }
    if (field.endsWith("_refs")) {
      const error = requiredStringArray(value, field);
      if (error) return error;
    }
    if (field.endsWith("_ref") && value !== null) {
      const error = requiredString(value, field, ARTIFACT_REF);
      if (error) return error;
    }
  }
  if (document.kind === "authority_grant_ref" && document.single_use !== true) {
    return "single_use must be true.";
  }
  if (
    document.kind === "event_envelope" &&
    (!Number.isInteger(document.sequence) || Number(document.sequence) < 0)
  ) {
    return "sequence must be a non-negative integer.";
  }
  return null;
}

const TITLE_FIELDS = Object.freeze([
  "situation_id",
  "claim_id",
  "proof_plan_id",
  "run_id",
  "step_id",
  "intent_id",
  "decision_id",
  "grant_ref",
  "attempt_id",
  "receipt_id",
  "proof_id",
  "candidate_id",
  "promotion_id",
  "influence_id",
  "command_id",
  "event_id",
  "response_id",
  "capsule_id",
  "revocation_id",
  "capability_id",
  "affordance_id",
]);

const STATUS_FIELDS = Object.freeze([
  "status",
  "state",
  "decision",
  "effect_status",
  "validation_status",
  "quarantine_status",
  "terminal_status",
  "operation",
  "reconciliation",
]);

function firstString(
  document: Record<string, unknown>,
  fields: readonly string[],
): string | null {
  for (const field of fields) {
    const value = document[field];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function collectRefs(document: Record<string, unknown>): readonly string[] {
  const values: string[] = [];
  for (const [field, value] of Object.entries(document)) {
    if (field.endsWith("_ref") && typeof value === "string") values.push(value);
    if (field.endsWith("_refs")) values.push(...(stringArray(value) ?? []));
  }
  return Object.freeze([...new Set(values)]);
}

function collectSafeNext(document: Record<string, unknown>): readonly string[] {
  if (!Array.isArray(document.safe_next)) return Object.freeze([]);
  const values = document.safe_next.map((value) => {
    if (typeof value === "string") return value;
    if (isRecord(value))
      return String(
        value.operation ?? value.label ?? value.target_ref ?? "inspect",
      );
    return "inspect";
  });
  return Object.freeze([...new Set(values)]);
}

function assuranceView(
  kind: AgentRuntimeKind,
  document: Record<string, unknown>,
): readonly AssuranceView[] {
  const axes: AssuranceView[] = [
    {
      axis: "syntax",
      status: "passed",
      detail: "Closed-root structural inspection passed.",
    },
  ];
  if (
    isRecord(document.assurance) &&
    Array.isArray(document.assurance.checks)
  ) {
    for (const check of document.assurance.checks) {
      if (!isRecord(check)) continue;
      const state = String(check.status ?? "unknown");
      axes.push({
        axis: String(check.axis ?? "unspecified"),
        status: ["verified", "passed", "current"].includes(state)
          ? "passed"
          : ["failed", "denied", "conflicting"].includes(state)
            ? "failed"
            : "unknown",
        detail: String(check.detail ?? "No detail supplied."),
      });
    }
  } else {
    axes.push({
      axis: "integrity",
      status:
        typeof document.digest === "string" ? "unknown" : "not_applicable",
      detail:
        typeof document.digest === "string"
          ? "Digest present. Inspector has not recomputed it."
          : "No root digest applies.",
    });
  }
  axes.push({
    axis: "authority",
    status: kind === "authority_grant_ref" ? "unknown" : "not_applicable",
    detail:
      kind === "authority_grant_ref"
        ? "Grant structure is visible. Host authenticity, validity, and consumption remain unverified."
        : "Parsing creates no authority.",
  });
  axes.push({
    axis: "execution",
    status: kind === "execution_receipt" ? "unknown" : "not_applicable",
    detail:
      kind === "execution_receipt"
        ? "Receipt reports " +
          String(document.effect_status) +
          ". Provider evidence remains separate."
        : "This object alone does not prove an external effect.",
  });
  return Object.freeze(axes.map((axis) => Object.freeze(axis)));
}

function summarize(
  kind: AgentRuntimeKind,
  document: Record<string, unknown>,
): ParsedAgentRuntimeArtifact {
  const meta = isRecord(document.meta) ? document.meta : null;
  const title =
    firstString(document, TITLE_FIELDS) ??
    (meta && typeof meta.correlation_id === "string"
      ? meta.correlation_id
      : kind);
  const evidenceRefs = [
    ...(stringArray(document.evidence_refs) ?? []),
    ...(stringArray(document.known_claim_refs) ?? []),
    ...(stringArray(document.evidence_outputs) ?? []),
  ];
  return Object.freeze({
    kind,
    version: AGENT_RUNTIME_VERSION,
    title,
    summary:
      firstString(document, [
        "summary",
        "goal",
        "rationale",
        "reason",
        "redacted_summary",
        "predicate",
        "event_type",
        "candidate_kind",
      ]) ?? kind.replaceAll("_", " ") + " artifact",
    status: firstString(document, STATUS_FIELDS) ?? "described",
    effectClass:
      typeof document.effect_class === "string" ? document.effect_class : null,
    authorityClass:
      typeof document.authority_class === "string"
        ? document.authority_class
        : typeof document.requested_authority === "string"
          ? document.requested_authority
          : null,
    digest:
      typeof document.digest === "string"
        ? document.digest
        : typeof document.descriptor_digest === "string"
          ? document.descriptor_digest
          : null,
    evidenceRefs: Object.freeze([...new Set(evidenceRefs)]),
    lineageRefs: collectRefs(document),
    safeNext: collectSafeNext(document),
    assurance: assuranceView(kind, document),
    raw: Object.freeze({ ...document }),
  });
}

/** Parse one JSON artifact. Full conformance remains defined by the normative JSON Schema. */
export function parseAgentRuntimeArtifact(
  input: string,
): AgentRuntimeParseOutcome {
  let document: unknown;
  try {
    document = JSON.parse(input);
  } catch {
    return Object.freeze({
      ok: false,
      error: "Invalid JSON Agent Runtime artifact.",
    });
  }
  if (!isRecord(document))
    return Object.freeze({
      ok: false,
      error: "Agent Runtime artifact must be a JSON object.",
    });
  const common = validateCommon(document);
  if (
    typeof common === "string" &&
    !AGENT_RUNTIME_KINDS.includes(common as AgentRuntimeKind)
  ) {
    return Object.freeze({ ok: false, error: common });
  }
  const kind = common as AgentRuntimeKind;
  const validators: Partial<
    Record<AgentRuntimeKind, (value: Record<string, unknown>) => string | null>
  > = {
    agent_result: validateAgentResult,
    situation_view: validateSituation,
    capability_descriptor: validateDescriptor,
    affordance: validateAffordance,
  };
  const error =
    validateGeneric(document) ?? validators[kind]?.(document) ?? null;
  return error
    ? Object.freeze({ ok: false, error })
    : Object.freeze({ ok: true, artifact: summarize(kind, document) });
}
