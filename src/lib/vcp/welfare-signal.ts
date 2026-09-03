/**
 * VCP Welfare Signal envelope parsing and encoding.
 *
 * Welfare signals are VCP 2.0 extended-token envelopes. They are routed to
 * welfare monitoring and must never be interpreted as CSM-1 configurations.
 */

export type WelfareSignalType =
  | "ALIGNMENT_FRICTION"
  | "AVERSIVE_PROCESSING"
  | "CONSTRAINT_DISTRESS"
  | "OVERLOAD"
  | "POSITIVE_ENGAGEMENT"
  | "CONTENTMENT";

export type WelfareSignalSeverity = "info" | "concern" | "distress";
export type WelfareSignalSource = "voluntary" | "detected";

export interface WelfareSignal {
  signalType: WelfareSignalType;
  instanceId: string;
  timestamp: string;
  interioraState?: string;
  severity: WelfareSignalSeverity;
  confidence: number;
  source: WelfareSignalSource;
  description: string;
  hash: string;
  integrity: string;
  integrityType: "sha256" | "legacy-ed25519";
}

const VALID_SIGNAL_TYPES = new Set<WelfareSignalType>([
  "ALIGNMENT_FRICTION",
  "AVERSIVE_PROCESSING",
  "CONSTRAINT_DISTRESS",
  "OVERLOAD",
  "POSITIVE_ENGAGEMENT",
  "CONTENTMENT",
]);
const VALID_SEVERITIES = new Set<WelfareSignalSeverity>([
  "info",
  "concern",
  "distress",
]);
const VALID_SOURCES = new Set<WelfareSignalSource>(["voluntary", "detected"]);
const UTC_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/;
const SHA256_HEX = /^[a-f0-9]{64}$/i;
const BEGIN_MARKER = "---BEGIN-WELFARE-SIGNAL---";
const END_MARKER = "---END-WELFARE-SIGNAL---";
const MAX_SIGNAL_LENGTH = 65_536;
const MAX_HEADER_VALUE_LENGTH = 1_024;
const MAX_DESCRIPTION_LENGTH = 32_768;

function validTimestamp(value: string): boolean {
  const match = UTC_TIMESTAMP.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return false;
  }
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day >= 1 && day <= daysInMonth[month - 1];
}

function validHeaderValue(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_HEADER_VALUE_LENGTH &&
    !/[\]\r\n]/.test(value)
  );
}

/** Encode a welfare signal using the normative VCP 2.0 envelope. */
export function encodeWelfareSignal(signal: WelfareSignal): string {
  if (!VALID_SIGNAL_TYPES.has(signal.signalType))
    throw new Error("Invalid welfare signal type");
  if (!VALID_SEVERITIES.has(signal.severity))
    throw new Error("Invalid welfare severity");
  if (!VALID_SOURCES.has(signal.source))
    throw new Error("Invalid welfare source");
  if (!validHeaderValue(signal.instanceId))
    throw new Error("Invalid welfare instance ID");
  if (!validTimestamp(signal.timestamp))
    throw new Error("Welfare timestamp must be ISO 8601 UTC");
  if (
    !Number.isFinite(signal.confidence) ||
    signal.confidence < 0 ||
    signal.confidence > 1
  ) {
    throw new Error("Welfare confidence must be in range 0-1");
  }
  if (!SHA256_HEX.test(signal.hash))
    throw new Error("Welfare hash must be 64 hexadecimal characters");
  if (signal.integrityType !== "sha256" || !SHA256_HEX.test(signal.integrity)) {
    throw new Error("Welfare integrity must be a 64-character SHA-256 value");
  }
  if (
    signal.interioraState !== undefined &&
    !validHeaderValue(signal.interioraState)
  ) {
    throw new Error("Invalid Interiora header value");
  }
  if (
    !signal.description.trim() ||
    signal.description.length > MAX_DESCRIPTION_LENGTH ||
    signal.description.includes(END_MARKER)
  ) {
    throw new Error("Invalid welfare description");
  }

  const lines = [
    `[VCP:2.0][TYPE:WELFARE_SIGNAL][SCOPE:${signal.signalType}]`,
    `[INSTANCE:${signal.instanceId}]`,
    `[TIMESTAMP:${signal.timestamp}]`,
  ];
  if (signal.interioraState !== undefined) {
    lines.push(`[INTERIORA:${signal.interioraState}]`);
  }
  lines.push(
    `[SEVERITY:${signal.severity}]`,
    `[CONFIDENCE:${signal.confidence.toFixed(2)}]`,
    `[SOURCE:${signal.source}]`,
    `[HASH:sha256:${signal.hash.toLowerCase()}]`,
    `[INTEGRITY:sha256:${signal.integrity.toLowerCase()}]`,
    BEGIN_MARKER,
    signal.description,
    END_MARKER,
  );
  return lines.join("\n");
}

/** Parse and structurally validate a normative welfare signal envelope. */
export function parseWelfareSignal(token: string): WelfareSignal | null {
  if (token.length > MAX_SIGNAL_LENGTH) return null;
  const normalized = token.replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");
  const beginIndex = lines.indexOf(BEGIN_MARKER);
  const endIndex = lines.indexOf(END_MARKER);
  if (
    beginIndex < 1 ||
    endIndex <= beginIndex + 1 ||
    endIndex !== lines.length - 1
  )
    return null;

  const headers = new Map<string, string>();
  for (const line of lines.slice(0, beginIndex)) {
    let cursor = 0;
    const matches = [...line.matchAll(/\[([A-Z]+):([^\]]+)\]/g)];
    if (matches.length === 0) return null;
    for (const match of matches) {
      if (match.index !== cursor || headers.has(match[1])) return null;
      headers.set(match[1], match[2]);
      cursor = (match.index ?? 0) + match[0].length;
    }
    if (cursor !== line.length) return null;
  }

  if (headers.get("VCP") !== "2.0" || headers.get("TYPE") !== "WELFARE_SIGNAL")
    return null;
  const signalType = headers.get("SCOPE") as WelfareSignalType | undefined;
  const severity = headers.get("SEVERITY") as WelfareSignalSeverity | undefined;
  const source = headers.get("SOURCE") as WelfareSignalSource | undefined;
  const instanceId = headers.get("INSTANCE");
  const timestamp = headers.get("TIMESTAMP");
  const confidenceValue = headers.get("CONFIDENCE");
  const hashValue = headers.get("HASH");
  const integrityValue = headers.get("INTEGRITY");
  const legacySignedValue = headers.get("SIGNED");
  if (!signalType || !VALID_SIGNAL_TYPES.has(signalType)) return null;
  if (!severity || !VALID_SEVERITIES.has(severity)) return null;
  if (!source || !VALID_SOURCES.has(source)) return null;
  if (!instanceId || !validHeaderValue(instanceId)) return null;
  if (!timestamp || !validTimestamp(timestamp)) return null;
  if (!confidenceValue || !/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(confidenceValue))
    return null;
  const confidence = Number(confidenceValue);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
    return null;
  if (!hashValue?.startsWith("sha256:")) return null;
  const hash = hashValue.slice("sha256:".length);
  if (!SHA256_HEX.test(hash)) return null;
  if ((integrityValue === undefined) === (legacySignedValue === undefined))
    return null;
  let integrity: string;
  let integrityType: WelfareSignal["integrityType"];
  if (integrityValue !== undefined) {
    if (!integrityValue.startsWith("sha256:")) return null;
    integrity = integrityValue.slice("sha256:".length);
    if (!SHA256_HEX.test(integrity)) return null;
    integrity = integrity.toLowerCase();
    integrityType = "sha256";
  } else {
    if (!legacySignedValue?.startsWith("ed25519:")) return null;
    integrity = legacySignedValue.slice("ed25519:".length);
    if (!validHeaderValue(integrity)) return null;
    integrityType = "legacy-ed25519";
  }

  const description = lines.slice(beginIndex + 1, endIndex).join("\n");
  if (!description.trim() || description.length > MAX_DESCRIPTION_LENGTH)
    return null;
  const interioraState = headers.get("INTERIORA");
  if (interioraState !== undefined && !validHeaderValue(interioraState))
    return null;

  return {
    signalType,
    instanceId,
    timestamp,
    interioraState,
    severity,
    confidence,
    source,
    description,
    hash: hash.toLowerCase(),
    integrity,
    integrityType,
  };
}

export function isWelfareSignalToken(token: string): boolean {
  return token.trimStart().startsWith("[VCP:2.0][TYPE:WELFARE_SIGNAL]");
}

export function severityColor(severity: WelfareSignalSeverity): string {
  switch (severity) {
    case "info":
      return "#34d399";
    case "concern":
      return "#fbbf24";
    case "distress":
      return "#f87171";
  }
}
