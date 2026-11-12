import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createContentHandler } from './content-http.mjs';

async function fixture(t) {
  let writes = 0, ended = false; let context;
  const handler = createContentHandler({ origin: 'https://custody.consulting', sessionSeconds: 1800,
    admin: { requireContentSession: token => { if (token !== 'valid') throw Object.assign(new Error('Denied'), { status: 403 }); return 'verified-public-key'; }, endContentSession: () => { ended = true; } },
    authorize: ({ action }) => { if (action === 'forbidden') throw Object.assign(new Error('Outside assigned scope'), { status: 403 }); },
    api: async ({ action }, actorContext) => { context = actorContext; if (action === 'failure') throw new Error('PRIVATE ERROR DETAILS'); writes++; return { ok: true }; },
  });
  const server = createServer(async (req, res) => { if (!await handler(req, res)) res.writeHead(404).end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const headers = { Origin: 'https://custody.consulting', 'Content-Type': 'application/json', Cookie: '__Secure-custody-content=valid' };
  return { handler, request: (path, options = {}) => fetch(origin + path, options), headers, writes: () => writes, ended: () => ended, context: () => context };
}
test('article writes require authenticated session, same-origin POST and JSON', async t => {
  const f = await fixture(t);
  for (const headers of [{ ...f.headers, Cookie: '' }, { ...f.headers, Origin: 'https://attacker.example' }, { ...f.headers, 'Content-Type': 'text/plain' }]) {
    assert.equal((await f.request('/admin/content/articles', { method: 'POST', headers, body: '{}' })).status, 403);
  }
  assert.equal((await f.request('/admin/content/articles', { headers: f.headers })).status, 403);
  assert.equal(f.writes(), 0);
  const result = await f.request('/admin/content/articles', { method: 'POST', headers: f.headers, body: '{}' });
  assert.equal(result.status, 200); assert.match(result.headers.get('cache-control'), /no-store/); assert.equal(f.writes(), 1);
});
test('malformed and oversized requests never reach the article API', async t => {
  const f = await fixture(t);
  for (const [body, status] of [['{', 400], ['null', 400], [JSON.stringify({ body: 'x'.repeat(500001) }), 413]]) {
    assert.equal((await f.request('/admin/content/articles', { method: 'POST', headers: f.headers, body })).status, status);
  }
  assert.equal(f.writes(), 0);
});
test('session checks, logout and cookie attributes retain the Nostr boundary', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/admin/content/session')).status, 401);
  assert.equal((await f.request('/admin/content/session', { headers: f.headers })).status, 204);
  assert.equal((await f.request('/admin/content/session', { method: 'DELETE', headers: { ...f.headers, Origin: 'https://attacker.example' } })).status, 403);
  assert.equal(f.ended(), false);
  const logout = await f.request('/admin/content/session', { method: 'DELETE', headers: f.headers });
  assert.equal(logout.status, 204); assert.equal(f.ended(), true);
  for (const attr of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/admin/content/']) assert.ok(f.handler.sessionCookie('valid').includes(attr));
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});
test('upstream errors do not expose internal messages or credentials', async t => {
  const f = await fixture(t);
  const result = await f.request('/admin/content/articles', { method: 'POST', headers: f.headers, body: '{"action":"failure"}' });
  assert.equal(result.status, 502); assert.ok(!(await result.text()).includes('PRIVATE'));
});

test('content actor comes from session and scope denial stops the API', async t => {
  const f = await fixture(t);
  const request = body => f.request('/admin/content/articles', { method: 'POST', headers: f.headers, body: JSON.stringify(body) });
  assert.equal((await request({ action: 'read', actor: 'forged-owner' })).status, 200);
  assert.deepEqual(f.context(), { actor: 'verified-public-key' });
  assert.equal((await request({ action: 'forbidden' })).status, 403);
  assert.equal(f.writes(), 1);
});
