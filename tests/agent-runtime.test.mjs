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

test("all four P2 artifact kinds produce compact immutable summaries", () => {
  const outcomes = [situation, descriptor, affordance, agentResult].map(
    (value) => parseAgentRuntimeArtifact(JSON.stringify(value)),
  );
  assert.deepEqual(AGENT_RUNTIME_KINDS, [
    "agent_result",
    "situation_view",
    "capability_descriptor",
    "affordance",
  ]);
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
  assert.match(
    parseAgentRuntimeArtifact(
      JSON.stringify({
        ...agentResult,
        meta: { ...agentResult.meta, profile: "controlled@0.1.0" },
      }),
    ).error,
    /observe/,
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
