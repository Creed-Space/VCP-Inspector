import assert from 'node:assert/strict';
import test from 'node:test';

import { parseIdentityInput, parseIdentityUri, parseToken, tryParseWelfare } from '../src/lib/vcp/token-parser.ts';

test('identity parser accepts Spec and SDK token vectors with exact structure', async (t) => {
	const vectors = [
		['a.b.c', 'a', 'b', 'c', [], null, 'none', null],
		['family.safe.guide', 'family', 'safe', 'guide', [], null, 'none', null],
		['family.safe.guide@1.2.0', 'family', 'safe', 'guide', [], '1.2.0', 'exact', null],
		['family.safe.guide@01.2.3', 'family', 'safe', 'guide', [], '1.2.3', 'exact', null, 'family.safe.guide@1.2.3'],
		['company.acme.legal.compliance:SEC', 'company', 'legal', 'compliance', ['acme'], null, 'none', 'SEC'],
		['org.example.dept.team.policy@1.0.0:GOV', 'org', 'team', 'policy', ['example', 'dept'], '1.0.0', 'exact', 'GOV'],
		['my-org.safe-net.web-guard@^2.0.0', 'my-org', 'safe-net', 'web-guard', [], '^2.0.0', 'compatible', null],
		['family.safe.guide@^00001.00002.00003-RC.1', 'family', 'safe', 'guide', [], '^1.2.3-rc.1', 'compatible', null, 'family.safe.guide@^1.2.3-rc.1'],
		['family.safe.guide@~2.0.0-rc.1', 'family', 'safe', 'guide', [], '~2.0.0-rc.1', 'approximate', null],
		['family.safe.guide@latest', 'family', 'safe', 'guide', [], 'latest', 'alias', null],
		['family.safe.guide@canary:ABC123', 'family', 'safe', 'guide', [], 'canary', 'alias', 'ABC123'],
		['a.b.c.d.e.f.g.h.i.j@99999.99999.99999:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'a', 'i', 'j', ['b', 'c', 'd', 'e', 'f', 'g', 'h'], '99999.99999.99999', 'exact', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA']
	];

	for (const [raw, domain, approach, role, path, version, constraint, namespace, expectedFull = raw] of vectors) {
		await t.test(raw, () => {
			const result = parseToken(raw);
			assert.equal(result.ok, true);
			assert.equal(result.token.raw, raw);
			assert.equal(result.token.domain, domain);
			assert.equal(result.token.approach, approach);
			assert.equal(result.token.role, role);
			assert.deepEqual(result.token.path, path);
			assert.equal(result.token.version, version);
			assert.equal(result.token.versionConstraint, constraint);
			assert.equal(result.token.namespace, namespace);
			assert.equal(result.token.depth, result.token.segments.length);
			assert.equal(result.token.full, expectedFull);
			assert.equal(result.token.canonical, result.token.segments.join('.'));
			assert.equal(result.token.uri, `creed://creed.space/${result.token.canonical}${version ? `@${version}` : ''}`);
			assert.ok(Object.isFrozen(result));
			assert.ok(Object.isFrozen(result.token));
			assert.ok(Object.isFrozen(result.token.segments));
			assert.ok(Object.isFrozen(result.token.path));
		});
	}
});

test('identity parser accepts the exact 256-character ceiling and rejects 257', () => {
	const valid = [32, 32, 32, 32, 32, 32, 32, 25].map((length) => 'a'.repeat(length)).join('.');
	assert.equal(valid.length, 256);
	assert.equal(parseToken(valid).ok, true);
	assert.equal(parseToken(`${valid}a`).ok, false);
});

test('identity parser rejects malformed and hostile wire values without normalization', async (t) => {
	const vectors = [
		null,
		1,
		'',
		'one.two',
		'Family.safe.guide',
		'family.safe.guide ',
		' family.safe.guide',
		'family.safe.guide\n',
		'a..b.c',
		'1a.b.c',
		`${'a'.repeat(33)}.b.c`,
		'a.b.c.d.e.f.g.h.i.j.k',
		'a.b.c@1.2',
		'a.b.c@1.2.3+build',
		'a.b.c@100000.1.1',
		'a.b.c:sec',
		'a.b.c:ABC_123',
		`a.b.c:${'A'.repeat(33)}`,
		'a.b.c:SEC\n',
		'creed://creed.space/family.safe.guide',
		'WC:🛑:0:welfare.basic.v1'
	];

	for (const raw of vectors) {
		await t.test(String(raw), () => {
			const result = parseToken(raw);
			assert.equal(result.ok, false);
			assert.ok(result.error.message);
			assert.ok(Object.isFrozen(result));
			assert.ok(Object.isFrozen(result.error));
		});
	}
});

test('identity parser keeps namespace out of the SDK-compatible bundle URI', () => {
	const result = parseToken('company.acme.legal.compliance@2.1.0:SEC');
	assert.equal(result.ok, true);
	assert.equal(result.token.full, 'company.acme.legal.compliance@2.1.0:SEC');
	assert.equal(result.token.uri, 'creed://creed.space/company.acme.legal.compliance@2.1.0');
});

test('identity input accepts canonical and legacy VCP URI forms and canonicalizes their token', async (t) => {
	const maxIssuer = [63, 63, 63, 61].map((length) => 'a'.repeat(length)).join('.');
	const maxToken = [32, 31, 31, 31, 31, 31, 31, 31].map((length) => 'b'.repeat(length)).join('.');
	assert.equal(maxIssuer.length, 253);
	assert.equal(maxToken.length, 256);
	assert.equal(`creed://${maxIssuer}/${maxToken}`.length, 518);
	const vectors = [
		['creed://creed.space/family.safe.guide@01.02.003', 'family.safe.guide@1.2.3'],
		['creed://creed.space/family/safe/guide@01.02.003', 'family.safe.guide@1.2.3'],
		['vcp://family.safe.guide@01.02.003', 'family.safe.guide@1.2.3'],
		['vcp://core.ethics.consent', 'core.ethics.consent'],
		['creed://acme.com/company.acme.legal@latest', 'company.acme.legal@latest'],
		['creed://CREED.Space/family.safe.guide', 'family.safe.guide'],
		[`creed://${maxIssuer}/${maxToken}`, maxToken]
	];
	for (const [raw, full] of vectors) {
		await t.test(raw, () => {
			const result = parseIdentityUri(raw);
			assert.equal(result.ok, true);
			assert.equal(result.token.raw, raw);
			assert.equal(result.token.full, full);
			assert.equal(result.token.uri, `creed://creed.space/${full}`);
			assert.ok(Object.isFrozen(result));
			assert.ok(Object.isFrozen(result.token));
		});
	}
	const plain = parseIdentityInput('family.safe.guide@01.2.3');
	assert.equal(plain.ok, true);
	assert.equal(plain.token.raw, 'family.safe.guide@01.2.3');
	assert.equal(plain.token.full, 'family.safe.guide@1.2.3');
});

test('identity URI parser rejects scheme, authority, path, namespace, and suffix ambiguity', async (t) => {
	const oversizedIssuer = [63, 63, 63, 62].map((length) => 'a'.repeat(length)).join('.');
	const maxToken = [32, 31, 31, 31, 31, 31, 31, 31].map((length) => 'b'.repeat(length)).join('.');
	assert.equal(oversizedIssuer.length, 254);
	assert.equal(`creed://${oversizedIssuer}/${maxToken}`.length, 519);
	const vectors = [
		null,
		'',
		'https://creed.space/family.safe.guide',
		'Creed://creed.space/family.safe.guide',
		'creed://creed.space',
		'creed:///family.safe.guide',
		'creed://user@creed.space/family.safe.guide',
		'creed://creed.space:443/family.safe.guide',
		'creed://127.0.0.1/family.safe.guide',
		'creed://[::1]/family.safe.guide',
		'creed://creed.space/family.safe.guide:SEC',
		'creed://creed.space/family.safe.guide?mode=1',
		'creed://creed.space/family.safe.guide#fragment',
		'creed://creed.space/family%2Esafe%2Eguide',
		'creed://creed.space/family\\safe\\guide',
		'creed://creed.space/family//safe/guide',
		`creed://${oversizedIssuer}/family.safe.guide`,
		'vcp://creed.space/family/safe/guide@01.02.003',
		'vcp://creed.space/family/safe/guide@1.2.3@latest',
		`creed://${oversizedIssuer}/${maxToken}`
	];
	for (const raw of vectors) {
		await t.test(String(raw), () => {
			const result = parseIdentityUri(raw);
			assert.equal(result.ok, false);
			assert.ok(result.error.message);
		});
	}
});

test('welfare routing only returns fully parsed WC/AS snapshots', () => {
	const valid = 'WC:🛑:0:welfare.basic.v1\nAS:🎯aligned:4';
	assert.equal(tryParseWelfare('family.safe.guide'), null);
	assert.equal(tryParseWelfare('WC:not-valid'), null);
	const parsed = tryParseWelfare(valid);
	assert.ok(parsed);
	assert.equal(parsed.raw, valid);
});
