import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createArticlesAPI } from './articles.mjs';
import { editableArticle } from './workspace-model.mjs';
import { editableChanges } from './workspace/view-model.mjs';
import { pair } from './workspace-fixture.mjs';
const prefix = '/repos/0xRivers/custody-consulting';
const sha = 'a'.repeat(40), live = 'b'.repeat(40), changed = 'c'.repeat(40);
function fixture({ draft = false, conflict = false, publicFailure = false, access = () => ({global:true,articleIds:[]}) } = {}) {
  const calls = [], files = pair();
  const api = createArticlesAPI({ access, getToken: async () => 'token', publicRevision: async origin => {
    if (publicFailure) throw new Error('offline');
    return origin.includes('staging') ? sha : live;
  }, request: async (url, token, body, method) => {
    assert.equal(token, 'token'); const path = url.replace(prefix, ''); calls.push({ path, body, method });
    if (path.startsWith('/pulls?')) return draft ? [{ head: { ref: 'cms/nostr-articles/example/1234567890abcdef', sha: conflict ? changed : sha, repo: { full_name: '0xRivers/custody-consulting' } }, html_url: 'https://github.com/0xRivers/custody-consulting/pull/1' }] : [];
    if (path === '/git/ref/heads/staging') return { object: { sha: conflict ? changed : sha } };
    if (path.startsWith('/contents/astro/src/content/blog/')) {
      const locale = path.includes('/pl/') ? 'pl' : 'en';
      return { type: 'file', encoding: 'base64', sha: locale, content: Buffer.from(files[locale].data).toString('base64') };
    }
    if (path === `/git/commits/${sha}`) return { tree: { sha: 'old-tree' } };
    if (path === '/git/trees') return { sha: 'new-tree' };
    if (path === '/git/commits') return { sha: changed };
    if (path.startsWith('/git/refs')) return {};
    if (path === '/pulls') return { html_url: 'https://github.com/0xRivers/custody-consulting/pull/1' };
    assert.fail(`Unexpected call: ${path}`);
  } });
  return { api, calls, files };
}

test('workspace reads source, verified live version and matching staged files', async () => {
  const { api } = fixture();
  const snapshot = await api({ action: 'workspaceRead', params: { id: 'example' } });
  assert.equal(snapshot.revision, sha); assert.equal(snapshot.liveRevision, live);
  assert.equal(snapshot.previewReady, true); assert.equal(snapshot.liveStatusKnown, true);
  assert.equal(snapshot.translations.pl.topics[0], 'foundations');
});

test('unavailable live/staging status never claims verified publication or preview', async () => {
  const { api } = fixture({ publicFailure: true });
  const snapshot = await api({ action: 'workspaceRead', params: { id: 'example' } });
  assert.equal(snapshot.liveStatusKnown, false); assert.equal(snapshot.previewReady, false);
});

test('stale save is rejected without Git writes', async () => {
  const f = fixture({ conflict: true });
  await assert.rejects(f.api({ action: 'workspaceSave', params: { id: 'example', revision: sha, changes: {} } }), error => error.status === 409);
  assert.equal(f.calls.filter(call => call.body).length, 0);
});

test('workspace saves both translations to a draft PR and returns its immutable revision', async () => {
  const f = fixture();
  const input = editableChanges(Object.fromEntries(Object.entries(f.files).map(([locale, entry]) => [locale, editableArticle(entry.data)])), ['foundations']);
  input.en.title = 'A clearer Bitcoin backup guide';
  const result = await f.api({ action: 'workspaceSave', params: { id: 'example', revision: sha, changes: input } });
  assert.equal(result.revision, changed); assert.match(result.url, /pull\/1$/);
  const tree = f.calls.find(call => call.path === '/git/trees').body.tree;
  assert.equal(tree.length, 2); assert.ok(tree.every(entry => entry.content.includes('draft: false')));
  assert.ok(!f.calls.some(call => /merge|deploy/.test(call.path)));
});

test('invalid article IDs and publication requests cannot trigger Git writes', async () => {
  const f = fixture();
  for (const id of ['../../secrets', '.github/workflows/deploy.yml', '', 'a'.repeat(101)]) await assert.rejects(f.api({ action: 'workspaceRead', params: { id } }), /valid article/);
  await assert.rejects(f.api({ action: 'workspacePublish', params: { id: 'example' } }), /Review and merge/);
  assert.equal(f.calls.filter(call => call.body).length, 0);
});


test('branch article checks reject guessed IDs and legacy endpoints before GitHub access', async () => {
  const f = fixture({ access: () => ({ global: false, articleIds: ['example'] }) });
  assert.equal((await f.api({action:'workspaceRead',params:{id:'example'}})).id, 'example');
  f.calls.length = 0;
  for (const action of ['workspaceRead','workspaceSave']) await assert.rejects(f.api({action,params:{id:'another-branch'}}), error => error.status===403);
  for (const action of ['getEntry','persistEntry','entriesByFolder','unpublishedEntries']) await assert.rejects(f.api({action,params:{path:'astro/src/content/blog/en/example.md'}}), error => error.status===403);
  assert.equal(f.calls.length, 0);
});

test('queued saves recheck article permission before reading or writing GitHub', async () => {
  let checks = 0;
  const f = fixture({ access: () => ({ global: false, articleIds: ++checks < 3 ? ['example'] : [] }) });
  await assert.rejects(f.api({action:'workspaceSave',params:{id:'example'}}), error => error.status===403);
  assert.equal(checks, 3); assert.equal(f.calls.length, 0);
});

test('article API fails closed when no authorization policy is configured', async () => {
  const api = createArticlesAPI({getToken:()=>assert.fail('No GitHub access permitted')});
  await assert.rejects(api({action:'workspaceList'}), error=>error.status===403);
});


test('workspace article list omits other branches before fetching article bodies', async () => {
  const seen=[];
  const api=createArticlesAPI({access:()=>({global:false,articleIds:['mine']}),getToken:async()=>'',request:async path=>{
    seen.push(path);
    if(path.includes('/pulls?')) return [];
    if(path.endsWith('/en?ref=staging')) return ['mine','other'].map(id=>({type:'file',path:`astro/src/content/blog/en/${id}.md`}));
    assert.match(path,/\/mine\.md\?/);
    return {type:'file',encoding:'base64',sha:'x',content:Buffer.from(pair().en.data).toString('base64')};
  }});
  const result=await api({action:'workspaceList'});
  assert.deepEqual(result.articles.map(a=>a.id),['mine']);
  assert.ok(!seen.some(path=>path.includes('/other.md')));
});
