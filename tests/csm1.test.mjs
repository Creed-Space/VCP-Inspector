import assert from 'node:assert/strict';
import test from 'node:test';

import { encodeCSM1, parseCSM1, parseCSM1Compact, PERSONAS, SCOPES } from '../src/lib/vcp/csm1-parser.ts';

test('CSM-1 metadata matches the seven personas and eleven v2 scopes', () => {
	assert.deepEqual(Object.keys(PERSONAS), ['N', 'Z', 'G', 'A', 'M', 'D', 'C']);
	assert.deepEqual(Object.keys(SCOPES), ['F', 'W', 'P', 'E', 'T', 'O', 'V', 'A', 'H', 'S', 'R']);
	for (const [code, info] of [...Object.entries(PERSONAS), ...Object.entries(SCOPES)]) {
		assert.equal(info.char, code);
		assert.ok(info.name);
		assert.ok(info.description);
		assert.ok(Object.isFrozen(info));
	}
	assert.ok(Object.isFrozen(PERSONAS));
	assert.ok(Object.isFrozen(SCOPES));
});

test('CSM-1 parser accepts canonical schema and SDK vectors', async (t) => {
	const vectors = [
		['N0', 'N', 0, [], null, null, 'N0'],
		['N5+F+E', 'N', 5, ['F', 'E'], null, null, 'N5+E+F'],
		['Z4+P+W:SEC@1.0.0', 'Z', 4, ['P', 'W'], 'SEC', '1.0.0', 'Z4+P+W:SEC@1.0.0'],
		['C3+W+O:ACME', 'C', 3, ['W', 'O'], 'ACME', null, 'C3+O+W:ACME'],
		['G2@latest', 'G', 2, [], null, 'latest', 'G2@latest'],
		['M5@canary', 'M', 5, [], null, 'canary', 'M5@canary'],
		['D3+A+E+O+P+R+S+T+W:ABCDEFGH@999.999.999', 'D', 3, ['A', 'E', 'O', 'P', 'R', 'S', 'T', 'W'], 'ABCDEFGH', '999.999.999', 'D3+A+E+O+P+R+S+T+W:ABCDEFGH@999.999.999']
	];

	for (const [raw, persona, level, scopes, namespace, version, encoded] of vectors) {
		await t.test(raw, () => {
			const result = parseCSM1(raw);
			assert.equal(result.ok, true);
			assert.equal(result.code.raw, raw);
			assert.equal(result.code.persona.char, persona);
			assert.equal(result.code.level, level);
			assert.deepEqual(result.code.scopes.map((scope) => scope.char), scopes);
			assert.equal(result.code.namespace, namespace);
			assert.equal(result.code.version, version);
			assert.equal(result.code.encoded, encoded);
			assert.equal(result.code.isMaximum, level === 5);
			assert.ok(Object.isFrozen(result));
			assert.ok(Object.isFrozen(result.code));
			assert.ok(Object.isFrozen(result.code.scopes));
		});
	}
});

test('CSM-1 parser rejects malformed, ambiguous, conflicting, and oversized wire input', async (t) => {
	const vectors = [
		[null, 'must be a string'],
		[1, 'must be a string'],
		['', 'cannot be empty'],
		['N', 'format'],
		['X5', 'format'],
		['N6', 'format'],
		['n5', 'format'],
		[' N5', 'format'],
		['N5 ', 'format'],
		['N5\n', 'format'],
		['N5+I', 'format'],
		['N5+L', 'format'],
		['N5+G', 'format'],
		['N5+F+F', 'unique'],
		['N5+F+A', 'F and A'],
		['N5+V+A', 'V and A'],
		['N5+H+A', 'H and A'],
		['C3', 'requires a namespace'],
		['C3:ACME1', 'format'],
		['C3:TOOLONGNS', 'format'],
		['N5@1.2', 'format'],
		['N5@01.2.3', 'format'],
		['N5@1000.1.1', 'format'],
		[`N5${'A'.repeat(44)}`, 'exceeds max length']
	];

	for (const [raw, message] of vectors) {
		await t.test(String(raw), () => {
			const result = parseCSM1(raw);
			assert.equal(result.ok, false);
			assert.match(result.error.message, new RegExp(message));
			assert.ok(Object.isFrozen(result));
			assert.ok(Object.isFrozen(result.error));
		});
	}
});

test('CSM-1 encoder validates structured input and emits SDK canonical scope order', () => {
	assert.equal(encodeCSM1('N', 5, ['F', 'E']), 'N5+E+F');
	assert.equal(encodeCSM1('Z', 3, ['W', 'P'], 'SEC', 'latest'), 'Z3+P+W:SEC@latest');
	assert.equal(encodeCSM1('C', 1, [], 'ACME'), 'C1:ACME');
	assert.equal(parseCSM1(encodeCSM1('D', 4, ['T', 'E', 'W'])).ok, true);
	const hostileIterator = ['F'];
	hostileIterator[Symbol.iterator] = () => { throw new Error('iterator must not run'); };
	assert.equal(encodeCSM1('N', 1, hostileIterator), 'N1+F');
});

test('CSM-1 encoder rejects every invalid structured boundary without coercion', async (t) => {
	const tooManyScopes = Array.from({ length: 12 }, () => 'W');
	const cases = [
		[() => encodeCSM1(null, 1, []), TypeError, /persona/],
		[() => encodeCSM1('N\n', 1, []), TypeError, /persona/],
		[() => encodeCSM1('N', true, []), TypeError, /level/],
		[() => encodeCSM1('N', 1.5, []), TypeError, /level/],
		[() => encodeCSM1('N', -1, []), TypeError, /level/],
		[() => encodeCSM1('N', 6, []), TypeError, /level/],
		[() => encodeCSM1('N', 1, null), TypeError, /scopes/],
		[() => encodeCSM1('N', 1, tooManyScopes), TypeError, /bounded/],
		[() => encodeCSM1('N', 1, ['X']), TypeError, /scope codes/],
		[() => encodeCSM1('N', 1, ['F\n']), TypeError, /scope codes/],
		[() => encodeCSM1('N', 1, ['F', 'F']), RangeError, /unique/],
		[() => encodeCSM1('N', 1, ['F', 'A']), RangeError, /Conflicting/],
		[() => encodeCSM1('C', 1, []), RangeError, /requires a namespace/],
		[() => encodeCSM1('N', 1, [], null), TypeError, /namespace/],
		[() => encodeCSM1('N', 1, [], 'acme'), TypeError, /namespace/],
		[() => encodeCSM1('N', 1, [], 'ACME\n'), TypeError, /namespace/],
		[() => encodeCSM1('N', 1, [], '', null), TypeError, /version/],
		[() => encodeCSM1('N', 1, [], '', '1.2'), TypeError, /version/],
		[() => encodeCSM1('N', 1, [], '', '01.2.3'), TypeError, /version/],
		[() => encodeCSM1('N', 1, [], '', '1.2.3\n'), TypeError, /version/]
	];

	for (const [operation, errorType, message] of cases) {
		await t.test(message.source, () => assert.throws(operation, errorType, message));
	}
});

test('CSM-1 COMPACT parser accepts the grammar section 6.4 examples and reference-SDK output', async (t) => {
	const vectors = [
		['CS1|nanny|5|family.safe.guide|F,E', 'N', 5, ['F', 'E'], 'family.safe.guide', 'N5+E+F', true],
		['CS1|sentinel|4|secure.privacy.guardian|P,W', 'Z', 4, ['P', 'W'], 'secure.privacy.guardian', 'Z4+P+W', false],
		['CS1|custom|3|company.acme.legal|W,O', 'C', 3, ['W', 'O'], 'company.acme.legal', 'C3+O+W', false],
		['CS1|muse|2|art.studio.guide@1.2.0:SEC|', 'M', 2, [], 'art.studio.guide', 'M2', false]
	];
	for (const [raw, persona, level, scopes, canonical, encoded, isMaximum] of vectors) {
		await t.test(raw, () => {
			const result = parseCSM1Compact(raw);
			assert.equal(result.ok, true);
			assert.equal(result.code.raw, raw);
			assert.equal(result.code.persona.char, persona);
			assert.equal(result.code.level, level);
			assert.deepEqual(result.code.scopes.map((scope) => scope.char), scopes);
			assert.equal(result.code.token.canonical, canonical);
			assert.equal(result.code.encoded, encoded);
			assert.equal(result.code.isMaximum, isMaximum);
			assert.ok(Object.isFrozen(result));
			assert.ok(Object.isFrozen(result.code));
			assert.ok(Object.isFrozen(result.code.scopes));
		});
	}
	assert.equal(parseCSM1Compact('CS1|muse|2|art.studio.guide@1.2.0:SEC|').code.token.namespace, 'SEC');
});

test('CSM-1 COMPACT parser rejects every malformed field with a specific message', async (t) => {
	const vectors = [
		[null, 'must be a string'],
		['', 'cannot be empty'],
		[`CS1|nanny|5|${'a'.repeat(320)}|F`, 'exceeds max length'],
		['N5+F+E', 'COMPACT code format'],
		['CS1|nanny|6|family.safe.guide|F', 'COMPACT code format'],
		['CS1|Nanny|5|family.safe.guide|F', 'COMPACT code format'],
		['CS1|nanny|5|family.safe.guide|F,', 'COMPACT code format'],
		['CS1|nanny|5|family.safe.guide|F+E', 'COMPACT code format'],
		['CS1|nanny|5|family.safe.guide|F,E|', 'COMPACT code format'],
		['CS1|nanny|5|family.safe.guide|f', 'COMPACT code format'],
		['CS1|nobody|5|family.safe.guide|F', 'Unknown CSM-1 persona name "nobody"'],
		['CS1|nanny|5|Family.Safe.Guide|F', 'COMPACT token: Invalid VCP/I token format'],
		['CS1|nanny|5|family.safe|F', 'COMPACT token'],
		['CS1|nanny|5|family.safe.guide|F,F', 'unique'],
		['CS1|nanny|5|family.safe.guide|F,E,A', 'F and A'],
		['CS1|nanny|5|family.safe.guide|H,A', 'H and A']
	];
	for (const [raw, message] of vectors) {
		await t.test(String(raw), () => {
			const result = parseCSM1Compact(raw);
			assert.equal(result.ok, false);
			assert.match(result.error.message, new RegExp(message));
			assert.ok(Object.isFrozen(result));
			assert.ok(Object.isFrozen(result.error));
		});
	}
});
