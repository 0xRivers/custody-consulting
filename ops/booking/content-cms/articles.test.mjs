import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'yaml';
import { createArticlesAPI } from './articles.mjs';

const root = 'astro/src/content/blog';
const dataFiles = ['en', 'pl'].map(locale => ({
  path: `${root}/${locale}/foundation.md`,
  raw: `---\nlocale: ${locale}\ndraft: true\n---\nTest\n`,
}));
const payload = { action: 'persistEntry', params: { dataFiles, assets: [],
  options: { useWorkflow: true, collectionName: 'articles' } } };

for (const draft of [false, true]) {
test(`save shares draft: ${draft} in both translations and opens a PR into staging`, async () => {
  const calls = [];
  const api = createArticlesAPI({ access: () => ({global:true,articleIds:[]}),
    getToken: async () => 'installation-token',
    request: async (path, token, body) => {
      assert.equal(token, 'installation-token');
      const route = path.replace('/repos/0xRivers/custody-consulting', '');
      calls.push([route, body]);
      if (route.startsWith('/pulls?')) return [];
      if (route === '/git/ref/heads/staging') return { object: { sha: 'parent' } };
      if (route === '/git/commits/parent') return { tree: { sha: 'old' } };
      if (route === '/git/trees') return { sha: 'new-tree' };
      if (route === '/git/commits') return { sha: 'new-commit' };
      if (route === '/git/refs') return {};
      if (route === '/pulls') return { html_url: 'https://github.com/0xRivers/custody-consulting/pull/9' };
      assert.fail(route);
    },
  });
  const translations = dataFiles.map((file, index) => ({
    ...file,
    raw: file.raw.replace('draft: true', `draft: ${index === 0 ? draft : !draft}`),
  }));
  const result = await api({ ...payload, params: { ...payload.params, dataFiles: translations } });
  assert.match(result.url, /\/pull\/9$/);
  const writes = Object.fromEntries(calls.filter(([, body]) => body));
  assert.deepEqual(writes['/git/trees'].tree.map(file => file.path), dataFiles.map(file => file.path));
  for (const file of writes['/git/trees'].tree) {
    assert.equal(parse(file.content.split('---')[1]).draft, draft);
    assert.ok(file.content.endsWith('---\nTest\n'));
  }
  assert.deepEqual(writes['/git/commits'].parents, ['parent']);
  assert.match(writes['/git/refs'].ref, /^refs\/heads\/cms\/nostr-articles\/foundation\/[a-f0-9]{16}$/);
  assert.equal(writes['/pulls'].base, 'staging');
  assert.equal('refs/heads/' + writes['/pulls'].head, writes['/git/refs'].ref);
});
}

test('rejects paths outside the bilingual pair before calling GitHub', async () => {
  const api = createArticlesAPI({ access: () => ({global:true,articleIds:[]}), getToken: async () => assert.fail('Unexpected GitHub access') });
  await assert.rejects(api({ ...payload, params: { ...payload.params, dataFiles: [
    dataFiles[0], { ...dataFiles[1], path: '.github/workflows/deploy.yml' },
  ] } }), /Each translation/);
  await assert.rejects(api({ action: 'publishUnpublishedEntry' }), /Review and merge/);
});
