import assert from 'node:assert/strict';
import test from 'node:test';

import { EXTENSIONS, generateAck, generateHello, negotiateHandshake } from '../src/lib/vcp/capability.ts';

const IDS = [
	'VCP-X-Personal',
	'VCP-X-Relational',
	'VCP-X-Consensus',
	'VCP-X-Torch',
	'VCP-X-Intent',
	'VCP-X-Welfare'
];

test('extension registry mirrors the six local VCP-Spec extension directories', () => {
	assert.deepEqual(EXTENSIONS.map((extension) => extension.id), IDS);
	assert.ok(Object.isFrozen(EXTENSIONS));
	for (const extension of EXTENSIONS) {
		assert.ok(Object.isFrozen(extension));
		assert.match(extension.version, /^\d+\.\d+\.\d+$/);
		assert.ok(extension.name);
		assert.ok(extension.description);
	}
});

test('generated Hello uses the VEP-0002 wire shape and snapshots caller state', () => {
	const selected = [IDS[0], IDS[5]];
	const hello = generateHello(selected);
	selected[0] = IDS[1];
	assert.deepEqual(hello, {
		type: 'vcp-hello',
		version: '3.1',
		extensions: [IDS[0], IDS[5]],
		identity: null,
		min_version: '1.0',
		client_id: 'vcp-inspector/0.2.0'
	});
	assert.ok(Object.isFrozen(hello));
	assert.ok(Object.isFrozen(hello.extensions));
	const hostileIterator = [IDS[0]];
	hostileIterator[Symbol.iterator] = () => { throw new Error('iterator must not run'); };
	assert.deepEqual(generateHello(hostileIterator).extensions, [IDS[0]]);
});

test('Hello and Ack accept exact extension count and identifier-length ceilings', () => {
	const requests = Array.from({ length: 256 }, (_, index) => `VCP-X-E${index}`);
	requests[0] = `VCP-X-${'A'.repeat(122)}`;
	const hello = generateHello(requests);
	assert.equal(hello.extensions.length, 256);
	assert.equal(hello.extensions[0].length, 128);
	const ack = generateAck(hello);
	assert.equal(ack.type, 'vcp-ack');
	assert.equal(ack.supported.length, 0);
	assert.deepEqual(ack.unsupported, requests);
});

test('Ack applies JSON Schema string limits by Unicode code point and exact UTF-8 wire bytes', () => {
	const ignored = '🧿'.repeat(128);
	const clientId = '🧿'.repeat(256);
	const bounded = generateAck({ type: 'vcp-hello', version: '3.1', extensions: [ignored], client_id: clientId });
	assert.equal(bounded.type, 'vcp-ack');
	assert.deepEqual(bounded.supported, []);
	assert.deepEqual(bounded.unsupported, []);
	assert.throws(() => generateAck({ type: 'vcp-hello', version: '3.1', extensions: [`${ignored}🧿`] }));
	assert.throws(() => generateAck({ type: 'vcp-hello', version: '3.1', client_id: `${clientId}🧿` }));

	const shell = { type: 'vcp-hello', version: '3.1', padding: '' };
	const overhead = new TextEncoder().encode(JSON.stringify(shell)).byteLength;
	const exact = { ...shell, padding: 'x'.repeat(65_536 - overhead) };
	assert.equal(new TextEncoder().encode(JSON.stringify(exact)).byteLength, 65_536);
	assert.equal(generateAck(exact).type, 'vcp-ack');
	assert.throws(() => generateAck({ ...exact, padding: `${exact.padding}x` }), /64 KiB/);
});

test('Hello generation rejects malformed, duplicate, unserializable, and resource-exhausting input', async (t) => {
	const cyclic = [];
	cyclic.push(cyclic);
	const sparse = new Array(1);
	const tooMany = Array.from({ length: 257 }, (_, index) => `VCP-X-E${index}`);
	const cases = [
		() => generateHello(null),
		() => generateHello(tooMany),
		() => generateHello([1]),
		() => generateHello(['personal']),
		() => generateHello(['VCP-X-A\n']),
		() => generateHello([IDS[0], IDS[0]]),
		() => generateHello([1n]),
		() => generateHello(cyclic),
		() => generateHello(sparse),
		() => generateHello([`VCP-X-${'A'.repeat(123)}`])
	];
	for (const [index, operation] of cases.entries()) {
		await t.test(`invalid Hello ${index + 1}`, () => assert.throws(operation));
	}
});

test('Ack negotiation partitions every valid requested extension exactly once and ignores invalid identifiers', () => {
	const hello = {
		type: 'vcp-hello',
		version: '3.1',
		min_version: '1.0',
		extensions: [IDS[0], 'invalid request', 'VCP-X-A\n', 'VCP-X-Unknown'],
		identity: 'family.safe.guide',
		client_id: 'test-client',
		future_field: { mode: 'forward-compatible', values: [1, true, null] }
	};
	const ack = generateAck(hello);
	assert.equal(ack.type, 'vcp-ack');
	assert.equal(ack.version, '3.1');
	assert.deepEqual(ack.supported, [IDS[0]]);
	assert.deepEqual(ack.unsupported, ['VCP-X-Unknown']);
	assert.deepEqual(Object.keys(ack.capabilities), [IDS[0]]);
	assert.deepEqual(ack.core_features, {
		encryption: false,
		injection_scanning: false,
		revocation: false,
		audit_chain: false,
		context_opacity: false
	});
	assert.match(ack.server_id, /^vcp-inspector\//);
	assert.match(ack.session_id, /^ses_[0-9a-f-]{36}$/);
	assert.equal(new Set([...ack.supported, ...ack.unsupported]).size, 2);
	assert.equal([...ack.supported, ...ack.unsupported].includes('invalid request'), false);
	assert.equal([...ack.supported, ...ack.unsupported].includes('VCP-X-A\n'), false);
	assert.ok(Object.isFrozen(ack));
	assert.ok(Object.isFrozen(ack.supported));
	assert.ok(Object.isFrozen(ack.unsupported));
	assert.ok(Object.isFrozen(ack.capabilities));
	assert.ok(Object.isFrozen(ack.capabilities[IDS[0]]));
	assert.ok(Object.isFrozen(ack.core_features));
});

test('Ack negotiates the highest mutually supported semver minor without numeric overflow', async (t) => {
	const vectors = [
		['3.1', '1.0', '3.1'],
		['3.0', '1.0', '3.0'],
		['2.9', '1.0', '2.0'],
		['99.0', '3.0', '3.1'],
		['999999999.0', '3.0', '3.1']
	];
	for (const [preferred, minimum, expected] of vectors) {
		await t.test(`${minimum} through ${preferred}`, () => {
			const result = generateAck({ type: 'vcp-hello', version: preferred, min_version: minimum, extensions: [] });
			assert.equal(result.type, 'vcp-ack');
			assert.equal(result.version, expected);
		});
	}
});

test('pre-3.1 negotiation rejects extensions as unsupported rather than activating them', () => {
	const ack = generateAck({ type: 'vcp-hello', version: '3.0', extensions: [IDS[0], IDS[1]] });
	assert.equal(ack.type, 'vcp-ack');
	assert.deepEqual(ack.supported, []);
	assert.deepEqual(ack.unsupported, [IDS[0], IDS[1]]);
	assert.deepEqual(Object.keys(ack.capabilities), []);
});

test('dependency-sensitive capabilities disclose degraded operation honestly', () => {
	const degraded = generateAck({
		type: 'vcp-hello',
		version: '3.1',
		extensions: ['VCP-X-Torch', 'VCP-X-Intent']
	});
	assert.equal(degraded.type, 'vcp-ack');
	assert.deepEqual(degraded.capabilities['VCP-X-Torch'], { degraded: true });
	assert.deepEqual(degraded.capabilities['VCP-X-Intent'], { personal_signals: false });

	const complete = generateAck({
		type: 'vcp-hello',
		version: '3.1',
		extensions: ['VCP-X-Torch', 'VCP-X-Relational', 'VCP-X-Intent', 'VCP-X-Personal']
	});
	assert.equal(complete.type, 'vcp-ack');
	assert.deepEqual(complete.capabilities['VCP-X-Torch'], { degraded: false });
	assert.deepEqual(complete.capabilities['VCP-X-Intent'], { personal_signals: true });
});

test('additional core-feature entries must be booleans, matching the reference SDKs', () => {
	const profile = {
		supported_versions: ['3.1'],
		extensions: {},
		core_features: {
			encryption: true,
			injection_scanning: true,
			revocation: true,
			audit_chain: true,
			context_opacity: true,
			future_feature: { level: 2 }
		}
	};
	assert.throws(
		() => negotiateHandshake({ type: 'vcp-hello', version: '3.1', extensions: [] }, profile),
		/core_features\.future_feature must be boolean/
	);
});

test('explicit server profiles negotiate canonical capabilities without retaining caller state', () => {
	const profile = {
		supported_versions: ['3.1', '2.0', '3.1'],
		extensions: {
			'VCP-X-Personal': { decay: true, nested: { mode: 'source' } },
			'VCP-X-Torch': { lineage: true, degraded: false },
			'VCP-X-Intent': { user_correction: true, personal_signals: false }
		},
		core_features: {
			encryption: true,
			injection_scanning: false,
			revocation: true,
			audit_chain: false,
			context_opacity: true,
			future_feature: true
		},
		server_id: 'server/fixture',
		session_id: 'ses_fixture'
	};
	const ack = negotiateHandshake({
		type: 'vcp-hello',
		version: '3.1',
		extensions: ['VCP-X-Personal', 'VCP-X-Torch', 'VCP-X-Intent']
	}, profile);
	profile.extensions['VCP-X-Personal'].nested.mode = 'mutated';
	assert.deepEqual(ack, {
		type: 'vcp-ack',
		version: '3.1',
		supported: ['VCP-X-Personal', 'VCP-X-Torch', 'VCP-X-Intent'],
		unsupported: [],
		capabilities: {
			'VCP-X-Personal': { decay: true, nested: { mode: 'source' } },
			'VCP-X-Torch': { lineage: true, degraded: true },
			'VCP-X-Intent': { user_correction: true, personal_signals: true }
		},
		core_features: {
			encryption: true,
			injection_scanning: false,
			revocation: true,
			audit_chain: false,
			context_opacity: true,
			future_feature: true
		},
		server_id: 'server/fixture',
		session_id: 'ses_fixture'
	});
	assert.ok(Object.isFrozen(ack));
	assert.ok(Object.isFrozen(ack.capabilities['VCP-X-Personal'].nested));

	const { server_id: _serverId, session_id: _sessionId, ...profileWithoutIdentifiers } = profile;
	const noIdentifiers = negotiateHandshake(
		{ type: 'vcp-hello', version: '3.1', extensions: [] },
		profileWithoutIdentifiers
	);
	assert.equal(Object.hasOwn(noIdentifiers, 'server_id'), false);
	assert.equal(Object.hasOwn(noIdentifiers, 'session_id'), false);
});

test('explicit server profiles accept exact schema ceilings and reject every malformed boundary', async (t) => {
	const core = {
		encryption: false,
		injection_scanning: false,
		revocation: false,
		audit_chain: false,
		context_opacity: false
	};
	const exactExtension = `VCP-X-${'A'.repeat(122)}`;
	const exactExtensions = Object.fromEntries(
		Array.from({ length: 256 }, (_, index) => [index === 0 ? exactExtension : `VCP-X-E${index}`, {}])
	);
	const exact = negotiateHandshake(
		{ type: 'vcp-hello', version: '3.1', extensions: [exactExtension] },
		{
			supported_versions: ['3.1', ...Array.from({ length: 63 }, (_, index) => `2.${index}`)],
			extensions: exactExtensions,
			core_features: core,
			server_id: '🧿'.repeat(256),
			session_id: '🧿'.repeat(128)
		}
	);
	assert.deepEqual(exact.supported, [exactExtension]);

	const base = () => ({ supported_versions: ['3.1'], extensions: {}, core_features: core });
	const cyclic = base();
	cyclic.self = cyclic;
	const accessor = base();
	Object.defineProperty(accessor, 'future', { enumerable: true, get: () => true });
	const tooManyExtensions = Object.fromEntries(Array.from({ length: 257 }, (_, index) => [`VCP-X-E${index}`, {}]));
	const cases = [
		null,
		[],
		{},
		{ ...base(), supported_versions: [] },
		{ ...base(), supported_versions: Array.from({ length: 65 }, (_, index) => `1.${index}`) },
		{ ...base(), supported_versions: ['03.1'] },
		{ ...base(), extensions: null },
		{ ...base(), extensions: [] },
		{ ...base(), extensions: tooManyExtensions },
		{ ...base(), extensions: { bad: {} } },
		{ ...base(), extensions: { [`VCP-X-${'A'.repeat(123)}`]: {} } },
		{ ...base(), extensions: { 'VCP-X-Personal': null } },
		{ ...base(), extensions: { 'VCP-X-Personal': [] } },
		{ ...base(), core_features: null },
		{ ...base(), core_features: [] },
		{ ...base(), core_features: { ...core, encryption: 'false' } },
		{ ...base(), server_id: '' },
		{ ...base(), server_id: 1 },
		{ ...base(), server_id: '🧿'.repeat(257) },
		{ ...base(), session_id: '' },
		{ ...base(), session_id: '🧿'.repeat(129) },
		{ ...base(), padding: 'x'.repeat(65_536) },
		cyclic,
		accessor
	];
	for (const [index, profile] of cases.entries()) {
		await t.test(`invalid server profile ${index + 1}`, () => {
			assert.throws(() => negotiateHandshake({ type: 'vcp-hello', version: '3.1' }, profile));
		});
	}
});

test('version failures are schema-valid VCP errors with immutable supported versions', async (t) => {
	for (const hello of [
		{ type: 'vcp-hello', version: '4.0', min_version: '3.2' },
		{ type: 'vcp-hello', version: '2.0', min_version: '3.0' },
		{ type: 'vcp-hello', version: '0.9' }
	]) {
		await t.test(JSON.stringify(hello), () => {
			const result = generateAck(hello);
			assert.equal(result.type, 'vcp-error');
			assert.equal(result.code, 'VERSION_UNSUPPORTED');
			assert.deepEqual(result.supported_versions, ['1.0', '2.0', '3.0', '3.1']);
			assert.equal(result.retry_after, null);
			assert.ok(Object.isFrozen(result));
			assert.ok(Object.isFrozen(result.supported_versions));
		});
	}
});

test('invalid identity returns the protocol error instead of activating stateful extensions', () => {
	for (const identity of ['', 'Family.safe.guide', 42, 'family.safe.guide\n']) {
		const result = generateAck({ type: 'vcp-hello', version: '3.1', identity, extensions: [IDS[1]] });
		assert.equal(result.type, 'vcp-error');
		assert.equal(result.code, 'IDENTITY_INVALID');
		assert.equal(result.retry_after, null);
	}
});

test('Ack rejects malformed schema fields, ambiguous extension lists, and wire exhaustion', async (t) => {
	const cyclic = { type: 'vcp-hello', version: '3.1' };
	cyclic.self = cyclic;
	const becomesArray = { type: 'vcp-hello', version: '3.1', toJSON: () => [] };
	const accessor = { type: 'vcp-hello', version: '3.1' };
	Object.defineProperty(accessor, 'padding', { enumerable: true, get: () => 'x' });
	const shared = {};
	const aliased = { type: 'vcp-hello', version: '3.1', left: shared, right: shared };
	class ArraySubclass extends Array {}
	let ownKeysCalls = 0;
	const stringifyRace = new Proxy({ type: 'vcp-hello', version: '3.1' }, {
		ownKeys(target) {
			ownKeysCalls += 1;
			if (ownKeysCalls >= 3) throw new Error('mutated while serializing');
			return Reflect.ownKeys(target);
		}
	});
	let deep = {};
	for (let index = 0; index < 33; index += 1) deep = { value: deep };
	const cases = [
		null,
		[],
		{},
		{ type: 'VCP-Hello', version: '3.1' },
		{ type: 'vcp-hello', version: 3.1 },
		{ type: 'vcp-hello', version: '3.1\n' },
		{ type: 'vcp-hello', version: '3.1', min_version: '1' },
		{ type: 'vcp-hello', version: '3.1', min_version: null },
		{ type: 'vcp-hello', version: '03.1' },
		{ type: 'vcp-hello', version: '3.01' },
		{ type: 'vcp-hello', version: '1234567890.1' },
		{ type: 'vcp-hello', version: '3.1', client_id: 1 },
		{ type: 'vcp-hello', version: '3.1', client_id: '' },
		{ type: 'vcp-hello', version: '3.1', client_id: 'a'.repeat(257) },
		{ type: 'vcp-hello', version: '3.1', extensions: null },
		{ type: 'vcp-hello', version: '3.1', extensions: [1] },
		{ type: 'vcp-hello', version: '3.1', extensions: [''] },
		{ type: 'vcp-hello', version: '3.1', extensions: ['x'.repeat(129)] },
		{ type: 'vcp-hello', version: '3.1', extensions: [IDS[0], IDS[0]] },
		{ type: 'vcp-hello', version: '3.1', extensions: ['bad', 'bad'] },
		{ type: 'vcp-hello', version: '3.1', extensions: Array.from({ length: 257 }, (_, index) => `request-${index}`) },
		{ type: 'vcp-hello', version: '3.1', padding: 'x'.repeat(65_536) },
		{ type: 'vcp-hello', version: '3.1', padding: new Array(8_193) },
		{ type: 'vcp-hello', version: '3.1', padding: undefined },
		{ type: 'vcp-hello', version: '3.1', padding: Number.NaN },
		{ type: 'vcp-hello', version: '3.1', padding: new Date(0) },
		{ type: 'vcp-hello', version: '3.1', padding: new ArraySubclass() },
		cyclic,
		becomesArray,
		accessor,
		aliased,
		{ type: 'vcp-hello', version: '3.1', deep },
		stringifyRace
	];
	for (const [index, hello] of cases.entries()) {
		await t.test(`malformed Ack input ${index + 1}`, () => assert.throws(() => generateAck(hello)));
	}
});

test('pure concurrent negotiations do not alias output state or reuse session identifiers', async () => {
	const hello = Object.freeze({ type: 'vcp-hello', version: '3.1', extensions: Object.freeze([IDS[0]]) });
	const results = await Promise.all(Array.from({ length: 128 }, async () => generateAck(hello)));
	assert.equal(new Set(results.map((result) => result.session_id)).size, results.length);
	for (const result of results) {
		assert.deepEqual(result.supported, [IDS[0]]);
		assert.notEqual(result.supported, hello.extensions);
	}
});

test('Ack fails closed if secure session identifier generation is unavailable', { concurrency: false }, () => {
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
	Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {} });
	try {
		assert.throws(
			() => generateAck({ type: 'vcp-hello', version: '3.1', extensions: [] }),
			/secure session identifier generation is unavailable/i
		);
	} finally {
		if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
		else delete globalThis.crypto;
	}
});
