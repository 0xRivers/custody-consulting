import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligibleEvent, preparePromotion, releaseScope } from './release-assistant.mjs';

const sha = value => value.repeat(40);
const main = sha('a'), staging = sha('b');
const files = [{ filename: 'astro/src/content/blog/pl/test-bitcoin-backup.md', status: 'modified' }];
function fixture(overrides = {}) {
  const calls = [];
  const call = async (path, body, method) => {
    calls.push({ path, body, method });
    if (overrides[path]) return overrides[path](body, method);
    if (path === '/git/ref/heads/main') return { object: { sha: main } };
    if (path === '/git/ref/heads/staging') return { object: { sha: staging } };
    if (path.startsWith('/compare/')) return { behind_by: 0, files };
    if (path.startsWith('/pulls?')) return [];
    if (path === '/pulls') return { html_url: 'https://github.com/0xRivers/custody-consulting/pull/42' };
    assert.fail(`Unexpected endpoint ${path}`);
  };
  return { calls, call };
}

test('only same-repository successful staging pushes and main pushes are eligible', () => {
  const event = { repository: { full_name: '0xRivers/custody-consulting' }, workflow_run: {
    name: 'Check and deploy staging', event: 'push', head_branch: 'staging', conclusion: 'success',
    head_repository: { full_name: '0xRivers/custody-consulting' },
  } };
  assert.equal(eligibleEvent('workflow_run', event), true);
  for (const change of [{ conclusion: 'failure' }, { event: 'pull_request' }, { head_branch: 'main' },
    { head_repository: { full_name: 'attacker/fork' } }]) {
    assert.equal(eligibleEvent('workflow_run', { ...event, workflow_run: { ...event.workflow_run, ...change } }), false);
  }
  assert.equal(eligibleEvent('push', { ...event, ref: 'refs/heads/main' }), true);
  assert.equal(eligibleEvent('push', { ...event, ref: 'refs/heads/main', deleted: true }), false);
  assert.equal(eligibleEvent('workflow_dispatch', event), false);
});

test('stale staging success performs no mutation', async () => {
  const f = fixture();
  assert.match(await preparePromotion({ ...f, expectedStaging: sha('c') }), /ignored/);
  assert.equal(f.calls.filter(x => x.body).length, 0);
});

test('branch history is synchronized with a normal merge before preparing production', async () => {
  const f = fixture({ [`/compare/${main}...${staging}`]: () => ({ behind_by: 1, files }), '/merges': () => ({ sha: sha('c') }) });
  assert.match(await preparePromotion({ ...f, expectedStaging: staging }), /synchronized/);
  assert.equal(f.calls.find(x => x.path === '/merges').body.base, 'staging');
  assert.equal(f.calls.find(x => x.path === '/merges').body.head, main);
  assert.ok(!f.calls.some(x => x.path === '/pulls'));
});

test('conflicts are surfaced without bypass or force update', async () => {
  const f = fixture({ [`/compare/${main}...${staging}`]: () => ({ behind_by: 1, files }),
    '/merges': () => { throw new Error('conflict'); } });
  await assert.rejects(preparePromotion({ ...f, expectedStaging: staging }), /conflict/);
  assert.equal(f.calls.filter(x => x.body).length, 1);
});

test('no file difference creates no PR, even with differing branch histories', async () => {
  const f = fixture({ [`/compare/${main}...${staging}`]: () => ({ behind_by: 0, files: [] }) });
  assert.match(await preparePromotion({ ...f, expectedStaging: staging }), /nothing to publish/);
  assert.equal(f.calls.filter(x => x.body).length, 0);
});

test('successful staging prepares a scoped PR and never merges it', async () => {
  const f = fixture();
  await preparePromotion({ ...f, expectedStaging: staging });
  const create = f.calls.find(x => x.path === '/pulls');
  assert.equal(create.body.base, 'main');
  assert.equal(create.body.head, 'staging');
  assert.match(create.body.body, /article files only/);
  assert.match(create.body.body, /pl\/test-bitcoin-backup.md/);
  assert.ok(!f.calls.some(x => /merge/.test(x.path)));
});

test('existing assistant PR is updated instead of duplicated', async () => {
  const query = '/pulls?state=open&base=main&head=0xRivers:staging&per_page=100';
  const f = fixture({ [query]: () => [{ number: 42, body: '<!-- custody-release-assistant -->' }],
    '/pulls/42': () => ({ html_url: 'https://github.com/example/42' }) });
  await preparePromotion({ ...f, expectedStaging: staging });
  assert.equal(f.calls.find(x => x.path === '/pulls/42').method, 'PATCH');
  assert.ok(!f.calls.some(x => x.path === '/pulls'));
});

test('owner-created PR and changing head are left untouched', async () => {
  const query = '/pulls?state=open&base=main&head=0xRivers:staging&per_page=100';
  const f = fixture({ [query]: () => [{ number: 42, body: 'Owner notes', html_url: 'https://github.com/example/42' }] });
  assert.match(await preparePromotion({ ...f, expectedStaging: staging }), /left unchanged/);
  assert.equal(f.calls.filter(x => x.body).length, 0);
  let reads = 0;
  const racing = fixture({ '/git/ref/heads/staging': () => ({ object: { sha: ++reads === 1 ? staging : sha('c') } }) });
  assert.match(await preparePromotion({ ...racing, expectedStaging: staging }), /branch changed/);
  assert.equal(racing.calls.filter(x => x.body).length, 0);
});

test('mixed code, renamed or removed articles are never labelled article-only', () => {
  assert.equal(releaseScope(files).contentOnly, true);
  assert.equal(releaseScope([...files, { filename: '.github/workflows/deploy.yml', status: 'modified' }]).contentOnly, false);
  for (const status of ['removed', 'renamed']) assert.equal(releaseScope([{ ...files[0], status }]).contentOnly, false);
  assert.throws(() => releaseScope(Array(300).fill(files[0])), /too large/);
});
