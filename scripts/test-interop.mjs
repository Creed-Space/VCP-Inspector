#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { negotiateHandshake } from '../src/lib/vcp/capability.ts';
import { parseCSM1 } from '../src/lib/vcp/csm1-parser.ts';
import { parseIdentityUri, parseToken } from '../src/lib/vcp/token-parser.ts';

const MAX_FIXTURE_BYTES = 1_048_576;
const MAX_FIXTURE_CASES = 10_000;

function usage() {
	return [
		'Usage: npm run test:interop -- --sdk-root <path> --spec-root <path>',
		'Environment alternatives: VCP_SDK_ROOT and VCP_SPEC_ROOT'
	].join('\n');
}

function parseArguments(argv) {
	const values = Object.create(null);
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === '--help') return { help: true };
		const equals = argument.indexOf('=');
		const name = equals < 0 ? argument : argument.slice(0, equals);
		if (name !== '--sdk-root' && name !== '--spec-root') throw new Error(`Unknown argument: ${argument}`);
		if (Object.hasOwn(values, name)) throw new Error(`Duplicate argument: ${name}`);
		const value = equals < 0 ? argv[++index] : argument.slice(equals + 1);
		if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
		values[name] = value;
	}
	return {
		help: false,
		sdkRoot: path.resolve(values['--sdk-root'] ?? process.env.VCP_SDK_ROOT ?? ''),
		specRoot: path.resolve(values['--spec-root'] ?? process.env.VCP_SPEC_ROOT ?? '')
	};
}

async function readJson(root, relativePath, fingerprints) {
	const resolvedRoot = path.resolve(root);
	const resolved = path.resolve(resolvedRoot, relativePath);
	if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
		throw new Error(`Fixture path escapes its repository root: ${relativePath}`);
	}
	const metadata = await stat(resolved);
	if (!metadata.isFile()) throw new Error(`Fixture is not a file: ${resolved}`);
	if (metadata.size > MAX_FIXTURE_BYTES) {
		throw new Error(`Fixture exceeds ${MAX_FIXTURE_BYTES} bytes: ${resolved}`);
	}
	const source = await readFile(resolved, 'utf8');
	let value;
	try {
		value = JSON.parse(source);
	} catch (error) {
		throw new Error(`Fixture is not valid JSON: ${resolved}`, { cause: error });
	}
	fingerprints[relativePath] = createHash('sha256').update(source).digest('hex');
	return value;
}

function vectors(document, label, key = 'vectors') {
	assert.ok(document && typeof document === 'object' && !Array.isArray(document), `${label} must be an object`);
	const rows = document[key];
	assert.ok(Array.isArray(rows), `${label}.${key} must be an array`);
	assert.ok(rows.length <= MAX_FIXTURE_CASES, `${label}.${key} exceeds the case limit`);
	const ids = new Set();
	for (const row of rows) {
		assert.ok(row && typeof row === 'object' && !Array.isArray(row), `${label} contains a non-object case`);
		assert.equal(typeof row.id, 'string', `${label} contains a case without an id`);
		assert.ok(row.id.length > 0, `${label} contains an empty case id`);
		assert.equal(ids.has(row.id), false, `${label} repeats case id ${row.id}`);
		ids.add(row.id);
	}
	return rows;
}

function schemaPattern(pattern, label) {
	assert.equal(typeof pattern, 'string', `${label} pattern is missing`);
	return new RegExp(pattern);
}

function exactMatch(pattern, value) {
	const match = pattern.exec(value);
	return match?.[0] === value;
}

function expectedValidity(expected) {
	return expected.valid ?? true;
}

function patternMatches(segments, pattern) {
	const patternSegments = pattern.split('.');
	function visit(tokenIndex, patternIndex) {
		if (patternIndex === patternSegments.length) return tokenIndex === segments.length;
		const part = patternSegments[patternIndex];
		if (part === '**') {
			for (let next = tokenIndex; next <= segments.length; next += 1) {
				if (visit(next, patternIndex + 1)) return true;
			}
			return false;
		}
		if (tokenIndex === segments.length || (part !== '*' && part !== segments[tokenIndex])) return false;
		return visit(tokenIndex + 1, patternIndex + 1);
	}
	return visit(0, 0);
}

function checkIdentityResult(caseId, result, expected) {
	const valid = expectedValidity(expected);
	assert.equal(result.ok, valid, `${caseId}: validity differs`);
	if (!valid) return;
	const token = result.token;
	const actual = {
		domain: token.domain,
		approach: token.approach,
		role: token.role,
		version: token.version,
		namespace: token.namespace,
		path: [...token.path],
		depth: token.depth,
		canonical_display: token.full,
		parent_canonical: token.depth > 3 ? token.segments.slice(0, -1).join('.') : null,
		has_parent: token.depth > 3,
		uri_with_registry_creed_space: token.uri
	};
	for (const [key, value] of Object.entries(expected)) {
		if (Object.hasOwn(actual, key)) assert.deepEqual(actual[key], value, `${caseId}: ${key} differs`);
	}
	if (Object.hasOwn(expected, 'version_major')) {
		const core = token.version.replace(/^[\^~]/, '').split('-')[0].split('.').map(Number);
		for (const [index, key] of ['version_major', 'version_minor', 'version_patch'].entries()) {
			if (Object.hasOwn(expected, key)) assert.equal(core[index], expected[key], `${caseId}: ${key} differs`);
		}
	}
}

function checkIdentityFixtures(document, identitySchema) {
	const rows = vectors(document, 'identity/token_parsing');
	const tokenPattern = schemaPattern(identitySchema.properties?.token?.pattern, 'identity token');
	let uriCases = 0;
	for (const row of rows) {
		const expected = row.expected;
		assert.ok(expected && typeof expected === 'object', `${row.id}: expected is missing`);
		if (row.ancestor !== undefined) {
			const ancestor = parseToken(row.ancestor);
			const descendant = parseToken(row.descendant);
			assert.equal(ancestor.ok, true, `${row.id}: ancestor is invalid`);
			assert.equal(descendant.ok, true, `${row.id}: descendant is invalid`);
			const forward = descendant.token.segments.slice(0, ancestor.token.depth).join('.') === ancestor.token.canonical;
			assert.equal(forward, expected.is_ancestor, `${row.id}: is_ancestor differs`);
			assert.equal(forward, expected.is_descendant, `${row.id}: is_descendant differs`);
			assert.equal(false, expected.reverse_is_ancestor, `${row.id}: reverse_is_ancestor differs`);
			continue;
		}
		const uri = row.operation === 'parse_uri';
		if (uri) uriCases += 1;
		const result = uri ? parseIdentityUri(row.input) : parseToken(row.input);
		checkIdentityResult(row.id, result, expected);
		if (!uri) {
			assert.equal(exactMatch(tokenPattern, row.input), expectedValidity(expected), `${row.id}: Spec schema differs`);
		}
		if (row.pattern !== undefined && result.ok) {
			assert.equal(patternMatches(result.token.segments, row.pattern), expected.matches, `${row.id}: pattern result differs`);
		}
	}
	return { cases: rows.length, uriCases };
}

function checkCanonicalIdentityTargets(document, identitySchema) {
	const rows = vectors(document, 'identity/token_canonicalization');
	const tokenPattern = schemaPattern(identitySchema.properties?.token?.pattern, 'identity token');
	for (const row of rows) {
		assert.equal(typeof row.expected?.canonical, 'string', `${row.id}: canonical target is missing`);
		const result = parseToken(row.expected.canonical);
		assert.equal(result.ok, row.expected.valid ?? true, `${row.id}: canonical target validity differs`);
		assert.equal(exactMatch(tokenPattern, row.expected.canonical), row.expected.valid ?? true, `${row.id}: canonical target differs from Spec schema`);
		if (result.ok) assert.equal(result.token.full, row.expected.canonical, `${row.id}: canonical target is not stable`);
	}
	return { cases: rows.length };
}

function checkCsmFixtures(parsingDocument, encodingDocument, csmSchema) {
	const parsingRows = vectors(parsingDocument, 'semantics/csm1_parsing');
	const encodingRows = vectors(encodingDocument, 'semantics/csm1_encoding');
	const codePattern = schemaPattern(csmSchema.properties?.code?.pattern, 'CSM-1 code');
	for (const row of parsingRows) {
		const expected = row.expected;
		const result = parseCSM1(row.input);
		assert.equal(result.ok, expected.valid, `${row.id}: validity differs`);
		assert.equal(exactMatch(codePattern, row.input), expected.valid, `${row.id}: Spec schema differs`);
		if (!result.ok) continue;
		const code = result.code;
		const actual = {
			persona: code.persona.char,
			persona_name: code.persona.name.toLowerCase(),
			adherence: code.level,
			scopes: code.scopes.map((scope) => scope.char),
			namespace: code.namespace,
			version: code.version
		};
		for (const [key, value] of Object.entries(expected)) {
			if (Object.hasOwn(actual, key)) assert.deepEqual(actual[key], value, `${row.id}: ${key} differs`);
		}
	}
	for (const row of encodingRows) {
		const result = parseCSM1(row.input);
		assert.equal(result.ok, row.expected.parse_succeeds, `${row.id}: parse_succeeds differs`);
		if (!result.ok) continue;
		const expected = row.expected.to_micro ?? row.expected.to_nano;
		assert.equal(result.code.encoded, expected, `${row.id}: canonical encoding differs`);
		if (row.expected.reparse_to_nano !== undefined) {
			const reparsed = parseCSM1(result.code.encoded);
			assert.equal(reparsed.ok, true, `${row.id}: canonical output cannot be reparsed`);
			assert.equal(reparsed.code.encoded, row.expected.reparse_to_nano, `${row.id}: reparse differs`);
		}
	}
	return { parsingCases: parsingRows.length, encodingCases: encodingRows.length };
}

function checkCapabilityFixtures(document) {
	const rows = vectors(document, 'extensions/capability_negotiation', 'test_cases');
	for (const row of rows) {
		if (row.expected?.rejected === true) {
			assert.throws(
				() => negotiateHandshake(row.input?.client_hello, row.input?.server_capabilities),
				undefined,
				`${row.id}: invalid handshake was accepted`
			);
			continue;
		}
		const actual = negotiateHandshake(row.input?.client_hello, row.input?.server_capabilities);
		assert.deepEqual(actual, row.expected?.server_ack, `${row.id}: negotiated response differs`);
	}
	return { cases: rows.length };
}

function checkSchemaExamples(identitySchema, csmSchema, specExamples) {
	let identityExamples = 0;
	const candidates = [
		...(identitySchema.properties?.token?.examples ?? []).map((token) => ({ token })),
		...(identitySchema.examples ?? [])
	];
	for (const example of candidates) {
		const result = parseToken(example.token);
		assert.equal(result.ok, true, `Spec identity example is rejected: ${example.token}`);
		if (example.canonical !== undefined) assert.equal(result.token.full, example.canonical);
		identityExamples += 1;
	}

	let csmExamples = 0;
	for (const example of [
		...(csmSchema.properties?.code?.examples ?? []).map((code) => ({ code })),
		...(csmSchema.examples ?? []),
		specExamples.validCsm
	]) {
		const result = parseCSM1(example.code);
		assert.equal(result.ok, true, `Spec CSM-1 example is rejected: ${example.code}`);
		if (example.canonical !== undefined) assert.equal(result.code.encoded, example.canonical);
		csmExamples += 1;
	}

	const compactPattern = schemaPattern(csmSchema.properties?.compact?.pattern, 'CSM-1 COMPACT');
	assert.equal(exactMatch(compactPattern, specExamples.validCsm.compact), true, 'Spec valid COMPACT example is rejected');
	const duplicateCompactScopes = specExamples.invalidDuplicateCompact.compact.split('|').at(-1).split(',');
	assert.notEqual(
		new Set(duplicateCompactScopes).size,
		duplicateCompactScopes.length,
		'Spec duplicate-COMPACT fixture no longer contains duplicate scopes'
	);
	assert.equal(parseCSM1(specExamples.invalidConflictingScopes.code).ok, false, 'Conflicting CSM-1 scopes are accepted');
	const contradictory = parseCSM1(specExamples.invalidContradictoryFields.code);
	assert.equal(contradictory.ok, true);
	assert.notEqual(contradictory.code.persona.char, specExamples.invalidContradictoryFields.persona);

	return { identityExamples, csmExamples, structuredCsmRejections: 3 };
}

function checkHandshakeSchema(schema, specExamples, server) {
	const definitions = schema.$defs;
	assert.ok(definitions && typeof definitions === 'object', 'Handshake schema has no $defs');
	const semver = schemaPattern(definitions.semver_minor?.pattern, 'handshake semver_minor');
	const extensionId = schemaPattern(definitions.extension_id?.pattern, 'handshake extension_id');
	const hello = definitions.vcp_hello;
	const request = definitions.extension_request;
	assert.equal(hello?.additionalProperties, true, 'Hello must accept forward-compatible fields');
	assert.equal(hello?.properties?.extensions?.uniqueItems, true, 'Hello extensions must reject duplicates');
	assert.equal(definitions.vcp_ack?.additionalProperties, true, 'Ack must accept forward-compatible fields');
	assert.ok(exactMatch(semver, specExamples.validHello.version), 'Spec valid Hello version fails its schema');
	assert.equal(exactMatch(semver, specExamples.invalidLeadingZero.version), false, 'Leading-zero minor version passes schema');
	assert.equal(exactMatch(extensionId, 'VCP-X-Personal'), true);
	assert.equal(exactMatch(extensionId, 'invalid-extension'), false);

	const valid = negotiateHandshake(specExamples.validHello, server);
	assert.equal(valid.type, 'vcp-ack', 'Spec valid Hello is rejected');
	assert.equal([...valid.supported, ...valid.unsupported].includes('invalid-extension'), false);
	const reversed = negotiateHandshake(specExamples.invalidVersionRange, server);
	assert.equal(reversed.type, 'vcp-error', 'Reversed client range is accepted');
	// The leading-zero version is schema-invalid (asserted above) but a receiver must still
	// answer with one canonical vcp-error rather than a transport fault, per section 4.1.
	const leadingZero = negotiateHandshake(specExamples.invalidLeadingZero, server);
	assert.equal(leadingZero.type, 'vcp-error', 'Leading-zero version is accepted');
	assert.equal(leadingZero.code, 'VERSION_UNSUPPORTED', 'Leading-zero version is not a version error');

	const maxItems = hello.properties.extensions.maxItems;
	const maxRequestLength = request.maxLength;
	const maxClientLength = hello.properties.client_id.maxLength;
	assert.ok(Number.isInteger(maxItems) && maxItems > 0 && maxItems <= MAX_FIXTURE_CASES);
	assert.ok(Number.isInteger(maxRequestLength) && maxRequestLength >= 7 && maxRequestLength <= MAX_FIXTURE_BYTES);
	assert.ok(Number.isInteger(maxClientLength) && maxClientLength > 0 && maxClientLength <= MAX_FIXTURE_BYTES);
	const requests = Array.from({ length: maxItems }, (_, index) => `VCP-X-E${index}`);
	requests[0] = `VCP-X-${'A'.repeat(maxRequestLength - 6)}`;
	assert.equal(requests[0].length, maxRequestLength);
	assert.equal(negotiateHandshake({ type: 'vcp-hello', version: '3.1', extensions: requests }, server).type, 'vcp-ack');
	assert.throws(() => negotiateHandshake({ type: 'vcp-hello', version: '3.1', extensions: [...requests, 'VCP-X-Overflow'] }, server));
	assert.throws(() => negotiateHandshake({ type: 'vcp-hello', version: '3.1', extensions: [`${requests[0]}A`] }, server));
	assert.equal(negotiateHandshake({ type: 'vcp-hello', version: '3.1', client_id: '🧿'.repeat(maxClientLength) }, server).type, 'vcp-ack');
	assert.throws(() => negotiateHandshake({ type: 'vcp-hello', version: '3.1', client_id: '🧿'.repeat(maxClientLength + 1) }, server));

	const validAck = specExamples.validAck;
	assert.equal(validAck.type, definitions.vcp_ack.properties.type.const);
	assert.ok(exactMatch(semver, validAck.version));
	for (const key of ['encryption', 'injection_scanning', 'revocation', 'audit_chain', 'context_opacity']) {
		assert.equal(typeof validAck.core_features[key], 'boolean');
	}
	for (const id of [...validAck.supported, ...validAck.unsupported, ...Object.keys(validAck.capabilities)]) {
		assert.ok(exactMatch(extensionId, id), `Spec valid Ack contains invalid extension id ${id}`);
	}
	return { examples: 4, boundaryProbes: 5 };
}

async function main() {
	const args = parseArguments(process.argv.slice(2));
	if (args.help) {
		console.log(usage());
		return;
	}
	if (!process.argv.slice(2).some((value) => value.startsWith('--sdk-root')) && !process.env.VCP_SDK_ROOT) {
		throw new Error(`SDK root is required.\n${usage()}`);
	}
	if (!process.argv.slice(2).some((value) => value.startsWith('--spec-root')) && !process.env.VCP_SPEC_ROOT) {
		throw new Error(`Spec root is required.\n${usage()}`);
	}

	const sdkFingerprints = Object.create(null);
	const specFingerprints = Object.create(null);
	const [identity, identityCanonicalization, csmParsing, csmEncoding, capability, identitySchema, csmSchema, handshakeSchema] = await Promise.all([
		readJson(args.sdkRoot, 'conformance/identity/token_parsing.json', sdkFingerprints),
		readJson(args.sdkRoot, 'conformance/identity/token_canonicalization.json', sdkFingerprints),
		readJson(args.sdkRoot, 'conformance/semantics/csm1_parsing.json', sdkFingerprints),
		readJson(args.sdkRoot, 'conformance/semantics/csm1_encoding.json', sdkFingerprints),
		readJson(args.sdkRoot, 'conformance/extensions/capability_negotiation.json', sdkFingerprints),
		readJson(args.specRoot, 'schemas/vcp-identity-token.schema.json', specFingerprints),
		readJson(args.specRoot, 'schemas/vcp-semantics-csm1.schema.json', specFingerprints),
		readJson(args.specRoot, 'schemas/vcp-capability-handshake.schema.json', specFingerprints)
	]);
	const [validHello, validAck, validCsm, invalidLeadingZero, invalidVersionRange, invalidDuplicateCompact, invalidConflictingScopes, invalidContradictoryFields] = await Promise.all([
		readJson(args.specRoot, 'schemas/examples/vcp-capability-handshake.valid-hello.json', specFingerprints),
		readJson(args.specRoot, 'schemas/examples/vcp-capability-handshake.valid-ack.json', specFingerprints),
		readJson(args.specRoot, 'schemas/examples/vcp-semantics-csm1.valid.json', specFingerprints),
		readJson(args.specRoot, 'schemas/examples/invalid/vcp-capability-handshake.invalid-leading-zero-version.json', specFingerprints),
		readJson(args.specRoot, 'schemas/examples/invalid/vcp-capability-handshake.invalid-version-range.json', specFingerprints),
		readJson(args.specRoot, 'schemas/examples/invalid/vcp-semantics-csm1.invalid-compact-duplicate-scope.json', specFingerprints),
		readJson(args.specRoot, 'schemas/examples/invalid/vcp-semantics-csm1.invalid-conflicting-scopes.json', specFingerprints),
		readJson(args.specRoot, 'schemas/examples/invalid/vcp-semantics-csm1.invalid-contradictory-fields.json', specFingerprints)
	]);
	const specExamples = { validHello, validAck, validCsm, invalidLeadingZero, invalidVersionRange, invalidDuplicateCompact, invalidConflictingScopes, invalidContradictoryFields };

	const capabilitySummary = checkCapabilityFixtures(capability);
	const identitySummary = checkIdentityFixtures(identity, identitySchema);
	const identityCanonicalizationSummary = checkCanonicalIdentityTargets(identityCanonicalization, identitySchema);
	const csmSummary = checkCsmFixtures(csmParsing, csmEncoding, csmSchema);
	const exampleSummary = checkSchemaExamples(identitySchema, csmSchema, specExamples);
	const canonicalServer = capability.test_cases.find((row) => row.expected?.rejected !== true)?.input?.server_capabilities;
	assert.ok(canonicalServer, 'Capability fixture has no valid server profile');
	const handshakeSummary = checkHandshakeSchema(handshakeSchema, specExamples, canonicalServer);

	console.log(JSON.stringify({
		status: 'passed',
		sdk: {
			capabilityCases: capabilitySummary.cases,
			identityCases: identitySummary.cases,
			identityUriCases: identitySummary.uriCases,
			identityCanonicalTargets: identityCanonicalizationSummary.cases,
			csmParsingCases: csmSummary.parsingCases,
			csmEncodingCases: csmSummary.encodingCases,
			totalCases: capabilitySummary.cases + identitySummary.cases + identityCanonicalizationSummary.cases + csmSummary.parsingCases + csmSummary.encodingCases,
			fingerprints: sdkFingerprints
		},
		spec: {
			...exampleSummary,
			...handshakeSummary,
			fingerprints: specFingerprints
		}
	}, null, 2));
}

main().catch((error) => {
	console.error(`Interop gate failed: ${error.message}`);
	process.exitCode = 1;
});
