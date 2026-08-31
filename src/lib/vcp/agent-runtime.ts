/** Strict, dependency-free inspection boundary for Agent Runtime Profile artifacts. */

export const AGENT_RUNTIME_VERSION = "0.1.0" as const;

export const AGENT_RUNTIME_KINDS = Object.freeze([
  "agent_result",
  "situation_view",
  "capability_descriptor",
  "affordance",
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
  readonly raw: Readonly<Record<string, unknown>>;
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
    agent_result: Object.freeze([
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
    ]),
    situation_view: Object.freeze([
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
    ]),
    capability_descriptor: Object.freeze([
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
    ]),
    affordance: Object.freeze([
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
    ]),
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
  return exactKeys(document, ROOT_KEYS[kind]) ?? kind;
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
  if (meta.profile !== "observe@0.1.0")
    return "meta.profile must be observe@0.1.0 in this Inspector release.";
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

function summarize(
  kind: AgentRuntimeKind,
  document: Record<string, unknown>,
): ParsedAgentRuntimeArtifact {
  const evidenceRefs =
    kind === "agent_result"
      ? (stringArray(document.evidence_refs) ?? [])
      : kind === "situation_view"
        ? (stringArray(document.known_claim_refs) ?? [])
        : kind === "affordance"
          ? (stringArray(document.evidence_outputs) ?? [])
          : (stringArray(document.outputs) ?? []);
  const title =
    kind === "agent_result"
      ? String((document.meta as Record<string, unknown>).correlation_id)
      : kind === "situation_view"
        ? String(document.situation_id)
        : kind === "capability_descriptor"
          ? String(document.capability_id)
          : String(document.affordance_id);
  return Object.freeze({
    kind,
    version: AGENT_RUNTIME_VERSION,
    title,
    summary: String(
      document.summary ?? document.goal ?? `Agent result: ${document.status}`,
    ),
    status: String(
      document.status ??
        document.state ??
        document.reconciliation ??
        "described",
    ),
    effectClass:
      typeof document.effect_class === "string" ? document.effect_class : null,
    authorityClass:
      typeof document.authority_class === "string"
        ? document.authority_class
        : null,
    digest:
      typeof document.digest === "string"
        ? document.digest
        : typeof document.descriptor_digest === "string"
          ? document.descriptor_digest
          : null,
    evidenceRefs: Object.freeze([...evidenceRefs]),
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
  const validators = {
    agent_result: validateAgentResult,
    situation_view: validateSituation,
    capability_descriptor: validateDescriptor,
    affordance: validateAffordance,
  };
  const error = validators[kind](document);
  return error
    ? Object.freeze({ ok: false, error })
    : Object.freeze({ ok: true, artifact: summarize(kind, document) });
}
