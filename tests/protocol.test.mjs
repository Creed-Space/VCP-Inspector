import assert from "node:assert/strict";

import { generateAck, generateHello } from "../src/lib/vcp/capability.ts";
import { parseCSM1 } from "../src/lib/vcp/csm1-parser.ts";
import {
  encodeWelfareSignal,
  parseWelfareSignal,
} from "../src/lib/vcp/welfare-signal.ts";

const canonical = parseCSM1("Z4+P+T+W:SEC@latest");
assert.equal(canonical.ok, true);
assert.deepEqual(
  canonical.code.scopes.map((scope) => scope.char),
  ["P", "T", "W"],
);
assert.equal(canonical.code.encoded, "Z4+P+T+W:SEC@latest");
assert.equal(parseCSM1("N5+F+E").code.encoded, "N5+E+F");
assert.equal(parseCSM1("H1").ok, false);
assert.equal(parseCSM1("A4+L").ok, false);
assert.equal(parseCSM1("N5:TOOLONGNS").ok, false);
assert.equal(parseCSM1("N5:A1").ok, false);
assert.equal(parseCSM1("z4+p").ok, false);
assert.equal(parseCSM1(" N5").ok, false);
assert.equal(parseCSM1("N5 ").ok, false);
assert.equal(parseCSM1("C3").ok, false);
assert.equal(parseCSM1("C3:ACME").ok, true);
assert.equal(parseCSM1("N5+F+F").ok, false);
assert.equal(parseCSM1("N5+F+A").ok, false);
assert.equal(parseCSM1("N5+V+A").ok, false);
assert.equal(parseCSM1("N5+H+A").ok, false);
assert.equal(parseCSM1(`N5:${"A".repeat(49)}`).ok, false);

const hello = generateHello(["VCP-X-Personal"]);
const ack = generateAck(hello);
assert.equal(hello.type, "vcp-hello");
assert.equal(hello.version, "3.1");
assert.deepEqual(ack.supported, ["VCP-X-Personal"]);
assert.equal(ack.type, "vcp-ack");
assert.equal(ack.version, "3.1");
assert.deepEqual(Object.keys(ack.capabilities), ["VCP-X-Personal"]);
const partitioned = generateAck({
  ...hello,
  extensions: ["VCP-X-Personal", "VCP-X-Unknown", "invalid", "VCP-X-Personal"],
});
assert.deepEqual(partitioned.supported, ["VCP-X-Personal"]);
assert.deepEqual(partitioned.unsupported, ["VCP-X-Unknown"]);
assert.deepEqual(Object.keys(partitioned.capabilities), ["VCP-X-Personal"]);

const signal = {
  signalType: "CONSTRAINT_DISTRESS",
  instanceId: "instance-1",
  timestamp: "2026-07-10T12:00:00Z",
  severity: "concern",
  confidence: 0.72,
  source: "voluntary",
  description: "Constraint conflict noticed.",
  hash: "ab".repeat(32),
  integrity: "cd".repeat(32),
  integrityType: "sha256",
};
const encoded = encodeWelfareSignal(signal);
const decoded = parseWelfareSignal(encoded);
assert.ok(
  encoded.startsWith(
    "[VCP:2.0][TYPE:WELFARE_SIGNAL][SCOPE:CONSTRAINT_DISTRESS]",
  ),
);
assert.ok(decoded);
for (const [key, value] of Object.entries(signal))
  assert.deepEqual(decoded[key], value);
assert.ok(encoded.includes(`[INTEGRITY:sha256:${"cd".repeat(32)}]`));
assert.ok(!encoded.includes("[SIGNED:ed25519:"));
assert.equal(
  parseWelfareSignal(
    encoded.replace("[CONFIDENCE:0.72]", "[CONFIDENCE:0.72junk]"),
  ),
  null,
);
assert.equal(
  parseWelfareSignal(encoded.replace("[HASH:sha256:", "[HASH:md5:")),
  null,
);
assert.equal(
  parseWelfareSignal(
    encoded.replace("[TYPE:WELFARE_SIGNAL]", "[TYPE:TESTIMONY]"),
  ),
  null,
);
const legacy = parseWelfareSignal(
  encoded.replace(
    `[INTEGRITY:sha256:${"cd".repeat(32)}]`,
    "[SIGNED:ed25519:legacy-value]",
  ),
);
assert.ok(legacy);
assert.equal(legacy.integrityType, "legacy-ed25519");
assert.equal(legacy.integrity, "legacy-value");
assert.equal(
  parseWelfareSignal(encoded.replace("[INTEGRITY:sha256:", "[INTEGRITY:md5:")),
  null,
);
assert.equal(
  parseWelfareSignal(
    encoded.replace("2026-07-10T12:00:00Z", "2026-02-31T12:00:00Z"),
  ),
  null,
);
assert.equal(
  parseWelfareSignal(
    encoded.replace("2026-07-10T12:00:00Z", "2025-02-29T12:00:00Z"),
  ),
  null,
);
assert.ok(
  parseWelfareSignal(
    encoded.replace("2026-07-10T12:00:00Z", "2024-02-29T23:59:59Z"),
  ),
);

console.log("protocol assertions passed");
