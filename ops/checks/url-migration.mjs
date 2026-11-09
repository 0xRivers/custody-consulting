import assert from 'node:assert/strict';

const origin = process.argv[2];
assert.ok(['https://staging.custody.consulting', 'https://custody.consulting'].includes(origin),
  'Pass the staging or production HTTPS origin.');

function request(path) {
  return fetch(new URL(path, origin), {redirect:'manual', signal:AbortSignal.timeout(10000)});
}

for (const locale of ['en', 'pl']) {
  for (const entry of ['/', '/index.html']) {
    const response = await request(`${entry}?lang=${locale}`);
    assert.equal(response.status, 301, entry + ' must permanently redirect the legacy language URL');
    assert.equal(new URL(response.headers.get('location'), origin).href, `${origin}/${locale}/`);
  }
  for (const path of [`/${locale}`, `/${locale}/blog`]) {
    const response = await request(path);
    assert.ok([301, 308].includes(response.status), path + ' must redirect to a trailing slash');
    assert.equal(new URL(response.headers.get('location'), origin).href, origin + path + '/');
  }
  const page = await request(`/${locale}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') ?? '', /^text\/html\b/);
  const html = await page.text();
  for (const anchor of ['services','approach','audiences','steps','faq','questions','contact']) {
    assert.ok(html.includes(`id="${anchor}"`), `/${locale}/ is missing #${anchor}`);
  }
  for (const [extension, mime] of [['css', /^text\/css\b/], ['webp', /^image\/webp\b/]]) {
    const asset = html.match(new RegExp(`"(/_astro/[^" ]+\\.${extension})"`))?.[1];
    assert.ok(asset, `/${locale}/ must reference a built ${extension} asset`);
    const response = await request(asset);
    assert.equal(response.status, 200, asset);
    assert.match(response.headers.get('content-type') ?? '', mime, asset);
  }
  const blog = await request(`/${locale}/blog/`);
  assert.equal(blog.status, 200);
  assert.match(blog.headers.get('content-type') ?? '', /^text\/html\b/);
}

for (const path of ['/', '/?lang=unknown']) {
  const response = await request(path);
  assert.equal(response.status, 200, path + ' must serve the language chooser');
  assert.match(await response.text(), /Choose your language/);
}
assert.equal((await request('/cc24-nonexistent-route/')).status, 404);
assert.equal((await request('/_astro/cc24-nonexistent-asset.css')).status, 404);
console.log(`CC-24 route checks passed on ${origin}`);
