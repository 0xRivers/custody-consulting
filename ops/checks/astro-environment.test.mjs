import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEnvironment } from '../../astro/environment.mjs';
test('missing, misspelled and generic Vite modes cannot enable indexing', () => {
  for (const value of [undefined, '', 'prod', 'development', 'preview']) {
    assert.throws(() => buildEnvironment(value), /SITE_ENV/);
  }
});
test('staging stays noindex and artifacts cannot overwrite either live build', () => {
  const staging = buildEnvironment('staging');
  const production = buildEnvironment('production');
  assert.equal(staging.indexable, false);
  assert.equal(staging.site, 'https://staging.custody.consulting');
  assert.equal(production.site, 'https://custody.consulting');
  assert.equal(production.indexable, true);
  assert.notEqual(staging.outDir, production.outDir);
  for (const env of [staging, production]) {
    assert.notEqual(env.outDir, '../dist');
    assert.notEqual(env.outDir, '../build/staging');
  }
});
