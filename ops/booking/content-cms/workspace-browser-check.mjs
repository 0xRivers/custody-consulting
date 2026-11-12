// Local-only browser verification using the installed Chromium WebDriver.
// The fixture server never forwards requests to GitHub or production services.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile, access, mkdtemp, rm } from 'node:fs/promises';
import { pair } from './workspace-fixture.mjs';
import { editableArticle, workspaceTopics } from './workspace-model.mjs';

const translations = Object.fromEntries(Object.entries(pair()).map(([locale, entry]) => [locale, editableArticle(entry.data)]));
translations.pl.title = 'Jak bezpiecznie sprawdzić kopię zapasową portfela Bitcoin';
const revision = 'a'.repeat(40);
let savedRequests = [], failSave = false;
const snapshot = () => ({ id: 'example', revision, liveRevision: 'b'.repeat(40), liveStatusKnown: true, previewReady: false,
  reviewUrl: null, topics: workspaceTopics, translations, live: structuredClone(translations) });
const files = { '/': 'index.html', '/workspace.js': 'workspace.js', '/workspace.css': 'workspace.css', '/view-model.mjs': 'view-model.mjs' };
const server = createServer(async (req, res) => {
  if (req.url === '/admin/content/session') { res.writeHead(204).end(); return; }
  if (req.url === '/admin/content/articles') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const { action, params } = JSON.parse(Buffer.concat(chunks)); res.setHeader('Content-Type', 'application/json');
    if (action === 'workspaceList') { res.end(JSON.stringify({ articles: [{ id: 'example', title: 'How to test your Bitcoin backup safely', hasSavedChanges: false }] })); return; }
    if (action === 'workspaceRead') { res.end(JSON.stringify(snapshot())); return; }
    if (action === 'workspaceSave') {
      savedRequests.push(params);
      if (failSave) { res.writeHead(409).end(JSON.stringify({ error: 'This draft changed elsewhere. Reload before saving; your unsaved text is still available.' })); return; }
      res.end(JSON.stringify({ revision: 'c'.repeat(40), url: 'https://github.com/0xRivers/custody-consulting/pull/999' })); return;
    }
    res.writeHead(400).end('{}'); return;
  }
  const filename = files[req.url];
  if (!filename) { res.writeHead(404).end(); return; }
  const types = { html: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript' };
  res.setHeader('Content-Type', types[filename.split('.').at(-1)]);
  res.end(await readFile(new URL(`./workspace/${filename}`, import.meta.url)));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const target = `http://127.0.0.1:${server.address().port}`;
const reservation = createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
const chrome = process.env.CHROME_BIN || '/usr/lib/chromium/chromium';
const profile = await mkdtemp('/tmp/custody-workspace-chrome-');
const driver = spawn(process.env.CHROMEDRIVER_BIN || '/usr/bin/chromedriver', [`--port=${port}`, '--allowed-ips=127.0.0.1'], { stdio: ['ignore', 'ignore', 'pipe'] });
let driverLog = ''; driver.stderr.on('data', chunk => { driverLog += chunk.toString(); });
const endpoint = `http://127.0.0.1:${port}`;
let session;
async function request(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(endpoint + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  const data = await response.json(); if (!response.ok || data.value?.error) throw new Error(JSON.stringify(data.value)); return data.value;
}
const execute = (script, args = []) => request(`/session/${session}/execute/sync`, { script, args });
async function waitFor(script) {
  for (let attempt = 0; attempt < 100; attempt++) { if (await execute(`return !!(${script})`)) return; await new Promise(resolve => setTimeout(resolve, 30)); }
  throw new Error(`Browser condition timed out: ${script}`);
}
try {
  await access(chrome);
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await request('/status'); break; } catch { if (driver.exitCode !== null) throw new Error(driverLog); await new Promise(resolve => setTimeout(resolve, 30)); }
  }
  const result = await request('/session', { capabilities: { alwaysMatch: { browserName: 'chrome', 'goog:chromeOptions': {
    binary: chrome, args: [`--user-data-dir=${profile}`, '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--disable-background-networking'] } } } });
  session = result.sessionId;
  await request(`/session/${session}/window/rect`, { width: 1440, height: 1100 });
  await request(`/session/${session}/url`, { url: target });
  await waitFor("document.getElementById('article-workspace').hidden === false");
  assert.equal(await execute("return document.getElementById('save').disabled"), true);
  // Both language tabs are editable, and switching must preserve unsaved text.
  await execute("document.getElementById('tab-pl').click();const field=document.getElementById('title');field.value='Czytelny poradnik testowania kopii zapasowej';field.dispatchEvent(new Event('input',{bubbles:true}));");
  await execute("document.getElementById('tab-en').click();const field=document.getElementById('title');field.value='A clearer guide to testing a Bitcoin backup';field.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('tab-pl').click();");
  assert.equal(await execute("return document.getElementById('title').value"), 'Czytelny poradnik testowania kopii zapasowej');
  assert.equal(await execute("return document.getElementById('save').disabled"), false);
  // The reading preview must render HTML/link attacks as inert text.
  await execute("const field=document.getElementById('body');field.value+='\\n\\n<img src=x onerror=alert(1)> [bad](javascript:alert(1))';field.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('preview-toggle').click();");
  assert.equal(await execute("return document.querySelectorAll('#reading-preview img,#reading-preview script,#reading-preview a[href^=\"javascript:\"]').length"), 0);
  await execute("document.getElementById('preview-toggle').click();document.getElementById('review').click();");
  assert.equal(await execute("return document.getElementById('review-panel').hidden"), false);
  assert.match(await execute("return document.getElementById('review-intro').textContent"), /unsaved/);
  await execute("document.getElementById('save').click()");
  await waitFor("document.getElementById('feedback').textContent.includes('Both translations saved')");
  assert.equal(savedRequests.length, 1); assert.equal(savedRequests[0].changes.pl.title, 'Czytelny poradnik testowania kopii zapasowej');
  assert.equal(savedRequests[0].changes.en.title, 'A clearer guide to testing a Bitcoin backup');
  assert.equal('draft' in savedRequests[0].changes.en, false);
  // Simulate a concurrent edit: no text is discarded and save remains available.
  failSave = true;
  await execute("const field=document.getElementById('summary');field.value+=' An additional note.';field.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('save').click()");
  await waitFor("document.getElementById('error').textContent.includes('changed elsewhere')");
  assert.match(await execute("return document.getElementById('summary').value"), /additional note/);
  assert.equal(await execute("return document.getElementById('save').disabled"), false);
  await mkdir('build/content-workspace', { recursive: true });
  for (const width of [1440, 768, 390, 375, 320]) {
    await request(`/session/${session}/window/rect`, { width, height: 1000 });
    assert.equal(await execute('return document.documentElement.scrollWidth <= window.innerWidth'), true, `Horizontal overflow at ${width}px`);
    if ([1440, 375].includes(width)) {
      await execute('window.scrollTo(0,0)');
      const png = await request(`/session/${session}/screenshot`);
      await writeFile(`build/content-workspace/${width}.png`, Buffer.from(png, 'base64'));
    }
  }
  await execute("document.documentElement.style.fontSize='200%'");
  assert.equal(await execute('return document.documentElement.scrollWidth <= window.innerWidth'), true, 'Overflow at enlarged text');
  console.log('Browser checks passed: bilingual edits, reading-preview safety, save, conflict recovery, review and responsive layouts.');
} finally {
  if (session) await request(`/session/${session}`, undefined, 'DELETE').catch(() => {});
  driver.kill('SIGTERM'); await rm(profile, {recursive:true,force:true}).catch(()=>{}); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
