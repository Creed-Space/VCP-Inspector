import assert from 'node:assert/strict';
import test from 'node:test';

import { EXAMPLES } from '../src/lib/vcp/examples.ts';
import { decodeInspectorInput } from '../src/lib/vcp/inspector.ts';
import { getLayerMnemonic, VCP_LAYERS } from '../src/lib/vcp/layers.ts';

test('Inspector routes strict token, CSM-1, and welfare inputs after outer copy/paste trimming', () => {
	const token = decodeInspectorInput('  family.safe.guide@1.2.0  ');
	assert.equal(token.ok, true);
	assert.equal(token.result.type, 'token');
	assert.equal(token.result.data.full, 'family.safe.guide@1.2.0');

	const csm1 = decodeInspectorInput('\nN5+F+E\t');
	assert.equal(csm1.ok, true);
	assert.equal(csm1.result.type, 'csm1');
	assert.equal(csm1.result.data.encoded, 'N5+E+F');

	const welfare = decodeInspectorInput(' WC:🛑:0:welfare.basic.v1\r\nAS:none ');
	assert.equal(welfare.ok, true);
	assert.equal(welfare.result.type, 'welfare');
	assert.equal(welfare.result.data.agentState.isNone, true);
	assert.ok(Object.isFrozen(token));
	assert.ok(Object.isFrozen(token.result));
});

test('Inspector routes canonical and legacy identity URIs through strict token normalization', () => {
	const canonical = decodeInspectorInput('creed://creed.space/family.safe.guide@01.02.003');
	assert.equal(canonical.ok, true);
	assert.equal(canonical.result.type, 'token');
	assert.equal(canonical.result.data.raw, 'creed://creed.space/family.safe.guide@01.02.003');
	assert.equal(canonical.result.data.full, 'family.safe.guide@1.2.3');
	assert.equal(canonical.result.data.uri, 'creed://creed.space/family.safe.guide@1.2.3');

	const legacy = decodeInspectorInput('creed://creed.space/family/safe/guide@01.02.003');
	assert.equal(legacy.ok, true);
	assert.equal(legacy.result.type, 'token');
	assert.equal(legacy.result.data.full, 'family.safe.guide@1.2.3');

	const alternative = decodeInspectorInput('vcp://family.safe.guide@01.02.003');
	assert.equal(alternative.ok, true);
	assert.equal(alternative.result.type, 'token');
	assert.equal(alternative.result.data.uri, 'creed://creed.space/family.safe.guide@1.2.3');
});

test('Inspector reports typed, empty, oversized, welfare-specific, and aggregate parse errors', () => {
	assert.deepEqual(decodeInspectorInput(null), { ok: false, error: 'Inspector input must be a string.' });
	assert.deepEqual(decodeInspectorInput('   '), { ok: false, error: '' });
	assert.match(decodeInspectorInput('x'.repeat(65_537)).error, /64 KiB/);
	assert.match(decodeInspectorInput('é'.repeat(32_769)).error, /64 KiB/);
	assert.deepEqual(decodeInspectorInput('WC:not-valid'), { ok: false, error: 'Invalid VCP welfare snapshot.' });
	const invalid = decodeInspectorInput('not-a-protocol-value');
	assert.equal(invalid.ok, false);
	assert.match(invalid.error, /VCP\/I:/);
	assert.match(invalid.error, /CSM-1:/);
});

test('every curated example is unique and decodes as its declared type', async (t) => {
	assert.equal(new Set(EXAMPLES.map((example) => example.label)).size, EXAMPLES.length);
	assert.equal(new Set(EXAMPLES.map((example) => example.value)).size, EXAMPLES.length);
	assert.ok(Object.isFrozen(EXAMPLES));
	for (const example of EXAMPLES) {
		await t.test(example.label, () => {
			const outcome = decodeInspectorInput(example.value);
			assert.equal(outcome.ok, true);
			assert.equal(outcome.result.type, example.type);
			assert.ok(example.description);
			assert.ok(Object.isFrozen(example));
		});
	}
});

test('layer metadata is immutable, complete, ordered, and mnemonic-safe', () => {
	assert.equal(getLayerMnemonic(), 'I-T-S-A-M-E');
	assert.deepEqual(VCP_LAYERS.map((layer) => layer.name), [
		'Identity',
		'Transport',
		'Semantics',
		'Adaptation',
		'Messaging',
		'Economic Governance'
	]);
	assert.deepEqual(VCP_LAYERS.filter((layer) => layer.inspectorSupport).map((layer) => layer.id), ['I', 'S']);
	assert.match(VCP_LAYERS.find((layer) => layer.id === 'T').purpose, /signed bundles/i);
	assert.match(VCP_LAYERS.find((layer) => layer.id === 'E').purpose, /fiduciary constraints/i);
	assert.ok(Object.isFrozen(VCP_LAYERS));
	for (const layer of VCP_LAYERS) {
		assert.ok(layer.purpose);
		assert.ok(Object.isFrozen(layer));
	}
});
