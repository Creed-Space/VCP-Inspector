import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('public description is curated plain text and discoverable from the app shell', () => {
  const content = readFileSync(new URL('../static/llms.txt', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../src/app.html', import.meta.url), 'utf8');
  assert.ok(content.startsWith('# VCP Inspector\n\n> '));
  assert.ok(content.includes('\n## Protocol documentation\n'));
  assert.ok(!content.includes('github.com'));
  assert.ok(!content.includes('<html'));
  assert.ok(shell.includes('rel="describedby" href="%sveltekit.assets%/llms.txt" type="text/plain"'));
});
