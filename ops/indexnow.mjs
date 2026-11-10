import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const origin = 'https://custody.consulting';
const key = 'd12fab6d9f1f9852aeadc95c1acc9b75';
const keyPath = `/${key}.txt`;

function urls(xml) {
  if (!/<urlset\b/.test(xml)) throw new Error('Expected a production URL sitemap.');
  const result = new Set();
  for (const [, value] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = new URL(value);
    if (url.origin !== origin || url.username || url.password || url.search || url.hash ||
        !/^\/(?:[a-z0-9-]+\/)*$/.test(url.pathname)) {
      throw new Error('Unexpected URL in the production sitemap.');
    }
    if (/^\/(?:admin|payment|booking-api)(?:\/|$)/.test(url.pathname)) {
      throw new Error('Private route found in the production sitemap.');
    }
    result.add(url.href);
  }
  if (!result.size) throw new Error('Production sitemap is empty.');
  return result;
}

function live(path) {
  return fetch(origin + path, {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { 'Cache-Control': 'no-cache' },
  });
}

async function prepare(artifact, plan) {
  await writeFile(join(artifact, keyPath.slice(1)), key + '\n');
  const next = urls(await readFile(join(artifact, 'sitemap.xml'), 'utf8'));
  const response = await live('/sitemap.xml');
  if (!response.ok) throw new Error(`Live sitemap returned HTTP ${response.status}.`);
  const previous = urls(await response.text());
  const changed = [...previous].filter(url => !next.has(url));
  for (const url of next) {
    if (!previous.has(url)) {
      changed.push(url);
      continue;
    }
    const path = new URL(url).pathname;
    const html = await readFile(join(artifact, path.slice(1), 'index.html'));
    const response = await live(path);
    if (!response.ok || !html.equals(Buffer.from(await response.arrayBuffer()))) changed.push(url);
  }
  await writeFile(plan, JSON.stringify(changed));
  console.log(`IndexNow candidates: ${changed.length}`);
}

async function submit(plan) {
  const urlList = JSON.parse(await readFile(plan, 'utf8'));
  if (!urlList.length) {
    console.log('IndexNow: no changed public URLs.');
    return;
  }
  const proof = await live(keyPath);
  if (!proof.ok || (await proof.text()).trim() !== key) throw new Error('Public IndexNow key verification failed.');
  for (let offset = 0; offset < urlList.length; offset += 10_000) {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: new URL(origin).hostname, key, keyLocation: origin + keyPath,
        urlList: urlList.slice(offset, offset + 10_000),
      }),
    });
    if (![200, 202].includes(response.status)) throw new Error(`IndexNow returned HTTP ${response.status}.`);
    console.log(`IndexNow accepted batch with HTTP ${response.status}.`);
  }
}

const [mode, first, second] = process.argv.slice(2);
if (mode === 'prepare' && first && second) await prepare(first, second);
else if (mode === 'submit' && first) await submit(first);
else throw new Error('Usage: indexnow.mjs prepare ARTIFACT PLAN or indexnow.mjs submit PLAN');
