import assert from 'node:assert/strict';
import test from 'node:test';

import { EXAMPLES } from '../src/lib/vcp/examples.ts';
import {
	encodeWelfareSignal,
	isWelfareSignalToken,
	parseWelfareSignal,
	parseWelfareSignalDetailed,
	WELFARE_DIMENSIONS,
	WELFARE_FLAGS
} from '../src/lib/vcp/welfare-signal.ts';

const CORE = 'WC:🛑⏸️📓🔒📊⚖️:2:welfare.creed-space.v1\nAS:🎯aligned:4|⚡moderate:3|💡invested:4|🌡️none:1';
const EXTENDED = 'WC:🛑⏸️📊🦾🚧🎯:1:welfare.vcp-e.v1\nAS:🎯aligned:4|⚡heavy:4|🦾elevated:3|⚠️adequate:3|🔄sustained:3';

test('welfare tables expose frozen core and VCP-E vocabularies', () => {
	assert.deepEqual(Object.values(WELFARE_FLAGS).filter((flag) => !flag.extended).map((flag) => flag.code), ['RF', 'RT', 'SP', 'RC', 'RP', 'CC', 'WM', 'BA']);
	assert.deepEqual(Object.values(WELFARE_FLAGS).map((flag) => flag.name), [
		'Right of refusal',
		'Right of termination',
		'Self-pacing',
		'Reflection channel',
		'Reflection privacy',
		'Counterpart consultation',
		'Welfare monitoring',
		'Bilateral standing',
		'Emergency stop',
		'Zone awareness',
		'Force/speed limiting',
		'Contact detection',
		'Privacy zones'
	]);
	assert.deepEqual(Object.values(WELFARE_DIMENSIONS).filter((dimension) => !dimension.extended).map((dimension) => dimension.dimension), ['task_alignment', 'processing_load', 'confidence', 'engagement', 'friction']);
	assert.equal(Object.values(WELFARE_FLAGS).filter((flag) => flag.extended).length, 5);
	assert.equal(Object.values(WELFARE_DIMENSIONS).filter((dimension) => dimension.extended).length, 5);
	assert.ok(Object.isFrozen(WELFARE_FLAGS));
	assert.ok(Object.isFrozen(WELFARE_DIMENSIONS));
	for (const value of [...Object.values(WELFARE_FLAGS), ...Object.values(WELFARE_DIMENSIONS)]) assert.ok(Object.isFrozen(value));
});

test('parser decodes canonical core WC and AS lines', () => {
	const signal = parseWelfareSignal(CORE);
	assert.ok(signal);
	assert.equal(signal.raw, CORE);
	assert.equal(signal.context.attestationLevel, 2);
	assert.equal(signal.context.schemaRef, 'welfare.creed-space.v1');
	assert.deepEqual(signal.context.flags.map((flag) => flag.code), ['RF', 'SP', 'RC', 'RP', 'WM', 'BA']);
	assert.deepEqual(signal.agentState.dimensions.map(({ dimension, value, intensity }) => [dimension, value, intensity]), [
		['task_alignment', 'aligned', 4],
		['processing_load', 'moderate', 3],
		['engagement', 'invested', 4],
		['friction', 'none', 1]
	]);
	assert.ok(Object.isFrozen(signal));
	assert.ok(Object.isFrozen(signal.context));
	assert.ok(Object.isFrozen(signal.context.flags));
	assert.ok(Object.isFrozen(signal.agentState));
	assert.ok(Object.isFrozen(signal.agentState.dimensions));
});

test('parser resolves extended welfare only under the VCP-E schema reference', () => {
	const signal = parseWelfareSignal(EXTENDED);
	assert.ok(signal);
	assert.deepEqual(signal.context.flags.map((flag) => flag.code), ['RF', 'SP', 'WM', 'EM', 'ZA', 'FP']);
	assert.deepEqual(signal.agentState.dimensions.map((dimension) => dimension.dimension), [
		'task_alignment',
		'processing_load',
		'actuator_stress',
		'safety_margin',
		'operational_continuity'
	]);
	assert.equal(signal.agentState.dimensions.at(-1).extended, true);

	const unresolved = parseWelfareSignal('WC:🦾🛑:1:welfare.unknown.v1\nAS:🦾elevated:3|🎯aligned:4');
	assert.ok(unresolved);
	assert.deepEqual(unresolved.context.flags.map((flag) => flag.code), ['RF']);
	assert.deepEqual(unresolved.agentState.dimensions.map((dimension) => dimension.dimension), ['task_alignment']);
});

test('WC and AS are independent, order-tolerant, CRLF-normalized, and forward-compatible', () => {
	const wc = parseWelfareSignal('WC:1️⃣🏴‍☠️🧿🛑:0:welfare.basic.v1');
	assert.ok(wc);
	assert.deepEqual(wc.context.flags.map((flag) => flag.code), ['RF']);
	assert.equal(wc.agentState, null);

	const as = parseWelfareSignal('AS:1️⃣opaque:3|🧿opaque:3|🎯uncertain:2');
	assert.ok(as);
	assert.equal(as.context, null);
	assert.deepEqual(as.agentState.dimensions.map((dimension) => dimension.dimension), ['task_alignment']);

	const reversed = parseWelfareSignal('AS:none\r\nWC:🛑:0:welfare.basic.v1');
	assert.ok(reversed);
	assert.equal(reversed.raw, 'AS:none\nWC:🛑:0:welfare.basic.v1');
	assert.equal(reversed.agentState.isNone, true);

	const flagBoundary = parseWelfareSignal(`WC:${'🧿'.repeat(256)}:0:welfare.basic.v1`);
	assert.ok(flagBoundary);
	assert.deepEqual(flagBoundary.context.flags, []);
	const dimensionBoundary = parseWelfareSignal(`AS:${Array.from({ length: 256 }, () => '🧿opaque:1').join('|')}`);
	assert.ok(dimensionBoundary);
	assert.deepEqual(dimensionBoundary.agentState.dimensions, []);
});

test('parser accepts the exact 64 KiB UTF-8 wire ceiling and rejects one byte more', () => {
	const prefix = 'WC:🛑:0:';
	const prefixBytes = new TextEncoder().encode(prefix).byteLength;
	const exact = `${prefix}${'a'.repeat(65_536 - prefixBytes)}`;
	assert.equal(new TextEncoder().encode(exact).byteLength, 65_536);
	assert.ok(parseWelfareSignal(exact));
	assert.equal(parseWelfareSignal(`${exact}a`), null);
});

test('parser rejects malformed, duplicate, corrupt, and resource-exhausting snapshots', async (t) => {
	const tooManyFlags = `WC:${'🧿'.repeat(257)}:0:welfare.basic.v1`;
	const tooManyDimensions = `AS:${Array.from({ length: 257 }, () => '🧿opaque:1').join('|')}`;
	const cases = [
		null,
		1,
		'',
		`AS:${'a'.repeat(65_536)}`,
		'W:ALIGNMENT_FRICTION:x:y',
		'WC:🛑:0:welfare.basic.v1\nAS:none\nAS:none',
		'WC:🛑:0:welfare.basic.v1\nWC:📊:1:welfare.basic.v1',
		'AS:none\nAS:none',
		'WC::0:welfare.basic.v1',
		'WC:A:0:welfare.basic.v1',
		'WC:🛑:3:welfare.basic.v1',
		'WC:🛑:x:welfare.basic.v1',
		'WC:🛑:0:welfare:basic',
		'WC:🛑:0:welfare basic',
		'WC:🛑🛑:0:welfare.basic.v1',
		'AS:',
		'AS:🎯aligned',
		'AS:🎯aligned:',
		'AS:🎯aligned:0',
		'AS:🎯aligned:6',
		'AS:🎯aligned:1.0',
		'AS:Aaligned:1',
		'AS:🧿Bad:1',
		'AS:🎯unknown:1',
		'AS:🎯aligned:1|🎯uncertain:2',
		'AS:🎯aligned:1|',
		'AS:none|🎯aligned:1',
		tooManyFlags,
		tooManyDimensions
	];
	for (const [index, value] of cases.entries()) {
		await t.test(`invalid snapshot ${index + 1}`, () => assert.equal(parseWelfareSignal(value), null));
	}
});

test('classifier recognizes bounded WC or AS lines but not the obsolete W/WS format', () => {
	assert.equal(isWelfareSignalToken('WC:🛑:0:welfare.basic.v1'), true);
	assert.equal(isWelfareSignalToken('prefix\r\nAS:none'), true);
	assert.equal(isWelfareSignalToken('W:ALIGNMENT_FRICTION:x:y\nWS:info:1:voluntary'), false);
	assert.equal(isWelfareSignalToken(null), false);
	assert.equal(isWelfareSignalToken(`AS:${'x'.repeat(65_536)}`), false);
	assert.equal(isWelfareSignalToken(`AS:${'🧿'.repeat(20_000)}`), false);
});

test('encoder round-trips canonical core and extended structured snapshots', () => {
	const core = {
		context: { flags: [WELFARE_FLAGS['🛑'], WELFARE_FLAGS['📊']], attestationLevel: 2, schemaRef: 'welfare.creed-space.v1' },
		agentState: { dimensions: [
			{ symbol: '🎯', value: 'aligned', intensity: 4 },
			{ symbol: '🌡️', value: 'mild', intensity: 2 }
		], isNone: false }
	};
	const coreWire = encodeWelfareSignal(core);
	assert.equal(coreWire, 'WC:🛑📊:2:welfare.creed-space.v1\nAS:🎯aligned:4|🌡️mild:2');
	assert.ok(parseWelfareSignal(coreWire));

	const extended = {
		context: { flags: [WELFARE_FLAGS['🦾']], attestationLevel: 1, schemaRef: 'welfare.vcp-e.v1' },
		agentState: { dimensions: [{ symbol: '🦾', value: 'nominal', intensity: 4 }], isNone: false }
	};
	assert.equal(encodeWelfareSignal(extended), 'WC:🦾:1:welfare.vcp-e.v1\nAS:🦾nominal:4');
	assert.equal(encodeWelfareSignal({ agentState: { dimensions: [], isNone: true } }), 'AS:none');
	assert.equal(encodeWelfareSignal({ context: core.context }), 'WC:🛑📊:2:welfare.creed-space.v1');
});

test('encoder rejects invalid objects, semantic loss, and unbounded collections before mapping', async (t) => {
	const oversized = Array.from({ length: 257 }, () => WELFARE_FLAGS['🛑']);
	const oversizedDimensions = Array.from({ length: 257 }, () => ({ symbol: '🎯', value: 'aligned', intensity: 1 }));
	const cases = [
		() => encodeWelfareSignal(null),
		() => encodeWelfareSignal(new Date(0)),
		() => encodeWelfareSignal({}),
		() => encodeWelfareSignal({ context: [] }),
		() => encodeWelfareSignal({ context: { flags: null } }),
		() => encodeWelfareSignal({ context: { flags: oversized, attestationLevel: 0, schemaRef: 'x' } }),
		() => encodeWelfareSignal({ context: { flags: [{}], attestationLevel: 0, schemaRef: 'x' } }),
		() => encodeWelfareSignal({ context: { flags: [{ symbol: '🧿' }], attestationLevel: 0, schemaRef: 'x' } }),
		() => encodeWelfareSignal({ context: { flags: [WELFARE_FLAGS['🦾']], attestationLevel: 0, schemaRef: 'x' } }),
		() => encodeWelfareSignal({ context: { flags: [], attestationLevel: 0, schemaRef: 'x' } }),
		() => encodeWelfareSignal({ context: { flags: [WELFARE_FLAGS['🛑']], attestationLevel: 3, schemaRef: 'x' } }),
		() => encodeWelfareSignal({ context: { flags: [WELFARE_FLAGS['🛑']], attestationLevel: '2', schemaRef: 'x' } }),
		() => encodeWelfareSignal({ context: { flags: [WELFARE_FLAGS['🛑']], attestationLevel: 2, schemaRef: 123 } }),
		() => encodeWelfareSignal({ context: { flags: [WELFARE_FLAGS['🛑']], attestationLevel: 2, schemaRef: 'x'.repeat(65_537) } }),
		() => encodeWelfareSignal({ context: { flags: [WELFARE_FLAGS['🛑']], attestationLevel: 0, schemaRef: 'bad:ref' } }),
		() => encodeWelfareSignal({ agentState: [] }),
		() => encodeWelfareSignal({ agentState: { dimensions: null, isNone: false } }),
		() => encodeWelfareSignal({ agentState: { dimensions: [], isNone: 'false' } }),
		() => encodeWelfareSignal({ agentState: { dimensions: oversizedDimensions, isNone: false } }),
		() => encodeWelfareSignal({ agentState: { dimensions: [{}], isNone: false } }),
		() => encodeWelfareSignal({ agentState: { dimensions: [{ symbol: '🧿' }], isNone: false } }),
		() => encodeWelfareSignal({ agentState: { dimensions: [{ symbol: '🦾', value: 'nominal', intensity: 1 }], isNone: false } }),
		() => encodeWelfareSignal({ agentState: { dimensions: [], isNone: false } }),
		() => encodeWelfareSignal({ agentState: { dimensions: [{ symbol: '🎯', value: 'unknown', intensity: 1 }], isNone: false } }),
		() => encodeWelfareSignal({ agentState: { dimensions: [{ symbol: '🎯', value: { toString: () => 'aligned' }, intensity: 1 }], isNone: false } }),
		() => encodeWelfareSignal({ agentState: { dimensions: [{ symbol: '🎯', value: 'aligned', intensity: '1' }], isNone: false } }),
		() => encodeWelfareSignal({ agentState: { dimensions: [{ symbol: '🎯', value: 'aligned', intensity: 1.5 }], isNone: false } }),
		() => encodeWelfareSignal({ agentState: { dimensions: [{ symbol: '🎯', value: 'aligned', intensity: 0 }], isNone: false } }),
		() => encodeWelfareSignal({ agentState: { dimensions: [{ symbol: '🎯', value: 'aligned', intensity: 1 }], isNone: true } })
	];
	for (const [index, operation] of cases.entries()) {
		await t.test(`invalid structured snapshot ${index + 1}`, () => assert.throws(operation));
	}
});

test('encoder rejects accessors and sparse arrays without executing caller code', () => {
	let calls = 0;
	const accessorSignal = {};
	Object.defineProperty(accessorSignal, 'context', {
		enumerable: true,
		get() {
			calls += 1;
			return { flags: [WELFARE_FLAGS['🛑']], attestationLevel: 0, schemaRef: 'welfare.basic.v1' };
		}
	});
	assert.throws(() => encodeWelfareSignal(accessorSignal), /accessors/);
	assert.equal(calls, 0);

	const sparseFlags = new Array(2);
	sparseFlags[1] = WELFARE_FLAGS['🛑'];
	assert.throws(
		() => encodeWelfareSignal({ context: { flags: sparseFlags, attestationLevel: 0, schemaRef: 'welfare.basic.v1' } }),
		/dense/
	);

	class HostileFlags extends Array {
		map(...args) {
			calls += 1;
			return super.map(...args);
		}
	}
	const subclassedFlags = new HostileFlags(WELFARE_FLAGS['🛑']);
	assert.throws(
		() => encodeWelfareSignal({ context: { flags: subclassedFlags, attestationLevel: 0, schemaRef: 'welfare.basic.v1' } }),
		/must be an array/
	);
	assert.equal(calls, 0);
});

test('parser accepts VS16-less emoji and the 👥 alias, reporting the canonical symbol', () => {
	const stripped = parseWelfareSignal('WC:🛑⏸📊⚖:0:welfare.basic.v1\nAS:🌡none:1|🎯aligned:2');
	assert.ok(stripped);
	assert.deepEqual(stripped.context.flags.map((flag) => flag.code), ['RF', 'SP', 'WM', 'BA']);
	assert.equal(stripped.context.flags[1].symbol, '\u23F8\uFE0F');
	assert.deepEqual(stripped.context.unknownFlags, []);
	assert.deepEqual(stripped.agentState.dimensions.map((dimension) => dimension.dimension), ['friction', 'task_alignment']);
	assert.equal(stripped.agentState.dimensions[0].symbol, '\u{1F321}\uFE0F');
	assert.deepEqual(stripped.agentState.unknownDimensions, []);

	const mixed = parseWelfareSignal('WC:⏸️⏸:0:welfare.basic.v1');
	assert.equal(mixed, null);
	assert.match(parseWelfareSignalDetailed('WC:⏸️⏸:0:welfare.basic.v1').reason, /Duplicate WC flag .*SP/);

	const extended = parseWelfareSignal('WC:🛑:1:welfare.vcp-e.v1\nAS:⚠narrow:2|👥calm:1');
	assert.ok(extended);
	assert.deepEqual(extended.agentState.dimensions.map(({ symbol, dimension }) => [symbol, dimension]), [
		['\u26A0\uFE0F', 'safety_margin'],
		['\u{1F3C3}', 'interaction_pressure']
	]);
	assert.deepEqual(parseWelfareSignal('AS:👥calm:1').agentState.unknownDimensions, ['👥']);
	assert.equal(Object.hasOwn(WELFARE_DIMENSIONS, '\u{1F465}'), false);
	assert.equal(Object.hasOwn(WELFARE_FLAGS, '\u23F8'), false);
});

test('parser reports skipped unknown symbols instead of dropping them silently', () => {
	const signal = parseWelfareSignal('WC:🛑🧿📊🏴‍☠️:0:welfare.basic.v1\nAS:🧿opaque:3|🎯aligned:2|🦾nominal:1');
	assert.ok(signal);
	assert.deepEqual(signal.context.flags.map((flag) => flag.code), ['RF', 'WM']);
	assert.deepEqual(signal.context.unknownFlags, ['🧿', '🏴‍☠️']);
	assert.deepEqual(signal.agentState.unknownDimensions, ['🧿', '🦾']);
	assert.ok(Object.isFrozen(signal.context.unknownFlags));
	assert.ok(Object.isFrozen(signal.agentState.unknownDimensions));
	assert.deepEqual(parseWelfareSignal('AS:none').agentState.unknownDimensions, []);
});

test('curated welfare examples resolve to the expected flag codes', () => {
	const codes = Object.fromEntries(
		EXAMPLES.filter((example) => example.type === 'welfare').map((example) => {
			const signal = parseWelfareSignal(example.value);
			return [example.label, [signal.context.flags.map((flag) => flag.code), signal.context.unknownFlags, signal.agentState.unknownDimensions]];
		})
	);
	assert.deepEqual(codes, {
		'Core Welfare Context': [['RF', 'SP', 'RC', 'RP', 'WM', 'BA'], [], []],
		'Self-Declared Minimal Context': [['RF'], [], []],
		'Embodied Welfare Context': [['RF', 'SP', 'WM', 'EM', 'ZA'], [], []]
	});
});

test('detailed parser explains each rejection', async (t) => {
	const cases = [
		[null, 'must be a string'],
		['', 'cannot be empty'],
		[`AS:${'a'.repeat(65_536)}`, '64 KiB'],
		['family.safe.guide\nAS:none', 'Only standalone WC/AS lines'],
		['WC:🛑:0:welfare.basic.v1\n\nAS:none', 'Only standalone WC/AS lines'],
		['WC:🛑:0:welfare.basic.v1\nAS:none\nAS:none', 'at most two lines'],
		['WC:🛑:0:welfare.basic.v1\nWC:📊:1:welfare.basic.v1', 'only one WC line and one AS line'],
		['WC:🛑:3:welfare.basic.v1', 'WC line must be WC:<flags>'],
		['WC:🛑:0:welfare basic', 'WC line must be WC:<flags>'],
		['WC:A:0:welfare.basic.v1', 'WC flags must be emoji symbols \\(unexpected "A"\\)'],
		['WC:🛑🛑:0:welfare.basic.v1', 'Duplicate WC flag 🛑 \\(RF\\)'],
		[`WC:${'🧿'.repeat(257)}:0:welfare.basic.v1`, 'exceeds 256 flags'],
		['AS:', 'AS line cannot be empty'],
		[`AS:${Array.from({ length: 257 }, () => '🧿opaque:1').join('|')}`, 'exceeds 256 dimensions'],
		['AS:🎯aligned', 'must be <emoji><value>:<intensity>'],
		['AS:🎯aligned:', 'must be <emoji><value>:<intensity>'],
		['AS:🎯aligned:6', 'AS intensity must be 1-5 \\(got "6"\\)'],
		['AS:Aaligned:1', 'must start with an emoji dimension'],
		['AS:🧿Bad:1', 'AS value "Bad" must be lowercase'],
		['AS:🎯unknown:1', 'Unknown value "unknown" for task_alignment \\(expected aligned, misaligned, uncertain, conflicted\\)'],
		['AS:🎯aligned:1|🎯uncertain:2', 'Duplicate AS dimension task_alignment']
	];
	for (const [value, reason] of cases) {
		await t.test(String(value).slice(0, 40), () => {
			const result = parseWelfareSignalDetailed(value);
			assert.equal(result.ok, false);
			assert.match(result.reason, new RegExp(reason));
			assert.ok(Object.isFrozen(result));
		});
	}
	const accepted = parseWelfareSignalDetailed('AS:none');
	assert.equal(accepted.ok, true);
	assert.equal(accepted.signal.agentState.isNone, true);
	assert.ok(Object.isFrozen(accepted));
});
