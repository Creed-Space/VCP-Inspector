import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENT_RUNTIME_KINDS,
  AGENT_RUNTIME_VERSION,
  parseAgentRuntimeArtifact,
} from "../src/lib/vcp/agent-runtime.ts";

const digest = (character = "0") => `sha256:${character.repeat(64)}`;

const situation = {
  kind: "situation_view",
  version: AGENT_RUNTIME_VERSION,
  situation_id: "situation.local.release",
  goal: "Determine whether the candidate has current integrity evidence",
  principal_ref: "vcp:artifact:principal:local-observer",
  known_claim_refs: ["vcp:artifact:claim:integrity"],
  unknowns: ["deployment status"],
  conflict_refs: [],
  normative_context_ref: "vcp:artifact:normative:observe",
  authority_refs: ["vcp:artifact:authority:local-read"],
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
  affordance_refs: ["vcp:artifact:affordance:verify"],
  omissions: [],
  as_of: "2026-08-31T12:00:00Z",
  cursor: "cursor.local.1",
  dependency_digest: digest("0"),
  digest: digest("1"),
};

const descriptor = {
  kind: "capability_descriptor",
  version: AGENT_RUNTIME_VERSION,
  capability_id: "verify.local.bundle",
  revision: "1",
  summary: "Verify a bundle without network access",
  effect_class: "pure_local",
  authority_class: "local_read",
  inputs: ["bundle path"],
  outputs: ["integrity claim"],
  preconditions: [],
  postconditions: ["no mutation"],
  privacy_classes: ["local"],
  reversible: true,
  reconciliation: "none",
  digest: digest("2"),
};

const affordance = {
  kind: "affordance",
  version: AGENT_RUNTIME_VERSION,
  affordance_id: "affordance.verify.local",
  capability_ref: "vcp:artifact:capability:verify.local.bundle",
  situation_digest: digest("1"),
  state: "available",
  summary: "Verify the candidate locally",
  effect_class: "pure_local",
  authority_class: "local_read",
  prerequisites: [],
  cost: {
    wall_time_ms: 20,
    tokens: 0,
    external_calls: 0,
    money_minor: 0,
    human_interruptions: 0,
  },
  evidence_outputs: ["bundle integrity"],
  recovery: [],
  safe_next: [],
  descriptor_digest: digest("2"),
};

const agentResult = {
  kind: "agent_result",
  version: AGENT_RUNTIME_VERSION,
  meta: {
    profile: "observe@0.1.0",
    schema_version: AGENT_RUNTIME_VERSION,
    schema_digest: digest("a"),
    correlation_id: "observe.local.1",
    as_of: "2026-08-31T12:00:00Z",
    cursor: null,
    dependency_digest: digest("b"),
  },
  status: "ready",
  value: situation,
  assurance: {
    overall: "degraded",
    checks: [
      { axis: "integrity", status: "verified", detail: "digest matched" },
    ],
  },
  evidence_refs: ["vcp:artifact:claim:integrity"],
  resources: {},
  safe_next: [],
  warnings: [],
  omissions: [],
  failure: null,
};

test("all runtime artifact kinds are declared and core artifacts produce immutable summaries", () => {
  const outcomes = [situation, descriptor, affordance, agentResult].map(
    (value) => parseAgentRuntimeArtifact(JSON.stringify(value)),
  );
  assert.equal(AGENT_RUNTIME_KINDS.length, 27);
  assert.deepEqual(AGENT_RUNTIME_KINDS.slice(0, 4), [
    "agent_result",
    "situation_view",
    "evidence_claim",
    "evidence_graph",
  ]);
  assert.ok(AGENT_RUNTIME_KINDS.includes("action_intent"));
  assert.ok(AGENT_RUNTIME_KINDS.includes("accretion_candidate"));
  for (const outcome of outcomes) {
    assert.equal(outcome.ok, true);
    assert.ok(Object.isFrozen(outcome));
    assert.ok(Object.isFrozen(outcome.artifact));
    assert.ok(Object.isFrozen(outcome.artifact.raw));
    assert.ok(Object.isFrozen(outcome.artifact.evidenceRefs));
    assert.equal(outcome.artifact.version, AGENT_RUNTIME_VERSION);
  }
  assert.deepEqual(
    outcomes.map((outcome) => outcome.artifact.status),
    ["described", "none", "available", "ready"],
  );
  assert.deepEqual(
    outcomes.map((outcome) => outcome.artifact.effectClass),
    [null, "pure_local", "pure_local", null],
  );
  assert.equal(outcomes[0].artifact.digest, digest("1"));
  assert.equal(outcomes[2].artifact.digest, digest("2"));
  assert.equal(outcomes[3].artifact.digest, null);
});

test("JSON, object, kind, version, and closed-root errors are explicit", () => {
  assert.match(parseAgentRuntimeArtifact("{").error, /Invalid JSON/);
  assert.match(parseAgentRuntimeArtifact("[]").error, /JSON object/);
  assert.match(parseAgentRuntimeArtifact("{}").error, /Unsupported.*kind/);
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({ ...situation, version: "0.2.0" }),
    ).error,
    /version/,
  );
  const { goal: _goal, ...missing } = situation;
  assert.match(
    parseAgentRuntimeArtifact(JSON.stringify(missing)).error,
    /Missing required field: goal/,
  );
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({ ...situation, authority_grant: "forged" }),
    ).error,
    /forbidden.*authority_grant/,
  );
});

test("SituationView validates safety-bearing identifiers, arrays, and budget closure", () => {
  for (const field of [
    "situation_id",
    "principal_ref",
    "normative_context_ref",
    "dependency_digest",
    "digest",
  ]) {
    assert.match(
      parseAgentRuntimeArtifact(
        JSON.stringify({ ...situation, [field]: "invalid value" }),
      ).error,
      new RegExp(field),
    );
  }
  assert.match(
    parseAgentRuntimeArtifact(JSON.stringify({ ...situation, goal: "" })).error,
    /goal/,
  );
  for (const field of [
    "known_claim_refs",
    "unknowns",
    "conflict_refs",
    "authority_refs",
    "active_work_refs",
    "control_operations",
    "affordance_refs",
  ]) {
    assert.match(
      parseAgentRuntimeArtifact(JSON.stringify({ ...situation, [field]: [42] }))
        .error,
      new RegExp(field),
    );
  }
  assert.match(
    parseAgentRuntimeArtifact(JSON.stringify({ ...situation, budget: null }))
      .error,
    /budget must/,
  );
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({
        ...situation,
        budget: { ...situation.budget, grant: true },
      }),
    ).error,
    /budget.*forbidden.*grant/,
  );
});

test("CapabilityDescriptor validates typed fields, arrays, reversibility, and digest", () => {
  for (const field of [
    "capability_id",
    "revision",
    "summary",
    "effect_class",
    "authority_class",
    "reconciliation",
  ]) {
    assert.match(
      parseAgentRuntimeArtifact(JSON.stringify({ ...descriptor, [field]: "" }))
        .error,
      new RegExp(field),
    );
  }
  for (const field of [
    "inputs",
    "outputs",
    "preconditions",
    "postconditions",
    "privacy_classes",
  ]) {
    assert.match(
      parseAgentRuntimeArtifact(
        JSON.stringify({ ...descriptor, [field]: "no" }),
      ).error,
      new RegExp(field),
    );
  }
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({ ...descriptor, reversible: "yes" }),
    ).error,
    /reversible/,
  );
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({ ...descriptor, digest: "sha256:no" }),
    ).error,
    /digest/,
  );
});

test("Affordance validates lineage, effect context, arrays, cost, and safe transitions", () => {
  for (const field of [
    "affordance_id",
    "capability_ref",
    "situation_digest",
    "descriptor_digest",
  ]) {
    assert.match(
      parseAgentRuntimeArtifact(
        JSON.stringify({ ...affordance, [field]: "invalid value" }),
      ).error,
      new RegExp(field),
    );
  }
  for (const field of ["state", "summary", "effect_class", "authority_class"]) {
    assert.match(
      parseAgentRuntimeArtifact(JSON.stringify({ ...affordance, [field]: "" }))
        .error,
      new RegExp(field),
    );
  }
  for (const field of ["prerequisites", "evidence_outputs", "recovery"]) {
    assert.match(
      parseAgentRuntimeArtifact(
        JSON.stringify({ ...affordance, [field]: [false] }),
      ).error,
      new RegExp(field),
    );
  }
  assert.match(
    parseAgentRuntimeArtifact(JSON.stringify({ ...affordance, cost: null }))
      .error,
    /cost/,
  );
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({ ...affordance, safe_next: null }),
    ).error,
    /safe_next/,
  );
});

test("AgentResult validates profile, schema lineage, status, assurance, and evidence references", () => {
  assert.match(
    parseAgentRuntimeArtifact(JSON.stringify({ ...agentResult, meta: null }))
      .error,
    /meta/,
  );
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({
        ...agentResult,
        meta: { ...agentResult.meta, grant: true },
      }),
    ).error,
    /meta.*forbidden.*grant/,
  );
  assert.equal(
    parseAgentRuntimeArtifact(
      JSON.stringify({
        ...agentResult,
        meta: { ...agentResult.meta, profile: "controlled@0.1.0" },
      }),
    ).ok,
    true,
  );
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({
        ...agentResult,
        meta: { ...agentResult.meta, profile: "future@0.1.0" },
      }),
    ).error,
    /profile/,
  );
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({
        ...agentResult,
        meta: { ...agentResult.meta, schema_version: "0.2.0" },
      }),
    ).error,
    /schema_version/,
  );
  for (const field of [
    "schema_digest",
    "dependency_digest",
    "correlation_id",
  ]) {
    assert.match(
      parseAgentRuntimeArtifact(
        JSON.stringify({
          ...agentResult,
          meta: { ...agentResult.meta, [field]: "invalid value" },
        }),
      ).error,
      new RegExp(field),
    );
  }
  assert.match(
    parseAgentRuntimeArtifact(JSON.stringify({ ...agentResult, status: "" }))
      .error,
    /status/,
  );
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({ ...agentResult, assurance: null }),
    ).error,
    /assurance/,
  );
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({
        ...agentResult,
        assurance: { ...agentResult.assurance, grant: true },
      }),
    ).error,
    /assurance.*forbidden.*grant/,
  );
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({
        ...agentResult,
        assurance: { overall: "ready", checks: [] },
      }),
    ).error,
    /checks/,
  );
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({ ...agentResult, evidence_refs: [1] }),
    ).error,
    /evidence_refs/,
  );
});

test("controlled and accretive lifecycle artifacts expose lineage and separated assurance", () => {
  const actionIntent = {
    kind: "action_intent",
    version: AGENT_RUNTIME_VERSION,
    intent_id: "intent.local.write",
    run_ref: "vcp:artifact:run:run.local.1",
    step_ref: "vcp:artifact:step:step.local.1",
    affordance_ref: "vcp:artifact:affordance:affordance.local.write",
    arguments_digest: digest("1"),
    destination: "local://settings/theme",
    context_digest: digest("2"),
    policy_digest: digest("3"),
    descriptor_digest: digest("4"),
    requested_at: "2026-09-01T00:00:00Z",
    digest: digest("5"),
    schema_digest: digest("6"),
    effect_class: "reversible_write",
    situation_digest: digest("7"),
    expected_postconditions: ["setting equals requested value"],
    resource_ceiling: situation.budget,
    idempotency_scope: "run.local.1/step.local.1",
    requested_authority: "local-reference-write",
  };
  const candidate = {
    kind: "accretion_candidate",
    version: AGENT_RUNTIME_VERSION,
    candidate_id: "candidate.local.procedure",
    candidate_kind: "procedure",
    content: { steps: ["validate", "prove"] },
    scope: ["tenant:local"],
    provenance_refs: ["vcp:artifact:capsule:capsule.local.1"],
    validation_status: "passed",
    review_required: false,
    digest: digest("8"),
    source_run_ref: "vcp:artifact:run:run.local.1",
    supporting_evidence_refs: ["vcp:artifact:evidence:evidence.local.1"],
    contradicting_evidence_refs: [],
    sensitivity: "internal",
    confidence: 1,
    invalidation_triggers: ["dependency digest changes"],
    revalidation: "repeat deterministic validation",
    promotion_policy: "automatic-low-risk-local-procedure",
    expected_utility: 0.5,
    rollback: "revoke and invalidate future retrieval",
    quarantine_status: "not_required",
    dependency_digest: digest("9"),
  };
  const intentResult = parseAgentRuntimeArtifact(JSON.stringify(actionIntent));
  const candidateResult = parseAgentRuntimeArtifact(JSON.stringify(candidate));
  assert.equal(intentResult.ok, true);
  assert.equal(candidateResult.ok, true);
  assert.deepEqual(intentResult.artifact.lineageRefs, [
    actionIntent.run_ref,
    actionIntent.step_ref,
    actionIntent.affordance_ref,
  ]);
  assert.equal(intentResult.artifact.effectClass, "reversible_write");
  assert.equal(candidateResult.artifact.status, "passed");
  assert.equal(
    candidateResult.artifact.lineageRefs.includes(candidate.source_run_ref),
    true,
  );
  assert.deepEqual(
    candidateResult.artifact.assurance.map((axis) => axis.axis),
    ["syntax", "integrity", "authority", "execution"],
  );
  assert.equal(candidateResult.artifact.assurance[1].status, "unknown");
});

test("generic lifecycle boundary rejects forged fields, malformed digests, refs, grants, and event order", () => {
  const baseIntent = {
    kind: "action_intent",
    version: AGENT_RUNTIME_VERSION,
    intent_id: "intent.local.write",
    run_ref: "vcp:artifact:run:run.local.1",
    step_ref: "vcp:artifact:step:step.local.1",
    affordance_ref: "vcp:artifact:affordance:affordance.local.write",
    arguments_digest: digest("1"),
    destination: "local://settings/theme",
    context_digest: digest("2"),
    policy_digest: digest("3"),
    descriptor_digest: digest("4"),
    requested_at: "2026-09-01T00:00:00Z",
    digest: digest("5"),
    schema_digest: digest("6"),
    effect_class: "reversible_write",
    situation_digest: digest("7"),
    expected_postconditions: [],
    resource_ceiling: situation.budget,
    idempotency_scope: "one",
    requested_authority: "local-reference-write",
  };
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({ ...baseIntent, forged_grant: true }),
    ).error,
    /forbidden/,
  );
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({ ...baseIntent, policy_digest: "bad" }),
    ).error,
    /policy_digest/,
  );
  assert.match(
    parseAgentRuntimeArtifact(JSON.stringify({ ...baseIntent, run_ref: "bad" }))
      .error,
    /run_ref/,
  );

  const grant = {
    kind: "authority_grant_ref",
    version: AGENT_RUNTIME_VERSION,
    grant_ref: "vcp:artifact:grant:grant.local.1",
    decision_ref: "vcp:artifact:decision:decision.local.1",
    intent_digest: digest("1"),
    single_use: false,
    expires_at: "2026-09-01T01:00:00Z",
    actor_ref: "vcp:artifact:principal:agent.local",
    tenant_ref: "vcp:artifact:tenant:local",
    run_ref: "vcp:artifact:run:run.local.1",
    step_ref: "vcp:artifact:step:step.local.1",
    capability_ref: "vcp:artifact:capability:local.setting.write",
    arguments_digest: digest("2"),
    destination: "local://settings/theme",
    effect_class: "reversible_write",
    resource_ceiling: situation.budget,
    nonce_digest: digest("3"),
  };
  assert.match(
    parseAgentRuntimeArtifact(JSON.stringify(grant)).error,
    /single_use/,
  );

  const event = {
    kind: "event_envelope",
    version: AGENT_RUNTIME_VERSION,
    event_id: "event.local.1",
    event_type: "run.started",
    aggregate_ref: "vcp:artifact:run:run.local.1",
    sequence: -1,
    occurred_at: "2026-09-01T00:00:00Z",
    actor_ref: "vcp:artifact:principal:agent.local",
    payload_ref: "vcp:artifact:run:run.local.1",
    digest: digest("4"),
    source_ref: "vcp:artifact:source:local",
    recorded_at: "2026-09-01T00:00:00Z",
    causal_parent_ref: null,
    payload_digest: digest("5"),
    redacted_summary: "run started",
    sensitivity: "internal",
    evidence_refs: [],
    audit_refs: [],
    state_transition_version: "1",
  };
  assert.match(
    parseAgentRuntimeArtifact(JSON.stringify(event)).error,
    /sequence/,
  );
});
