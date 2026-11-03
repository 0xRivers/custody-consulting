import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const target = process.env.PERF_URL;
if (!target) throw new Error('Set PERF_URL to the page under test.');
const chrome = process.env.CHROME_BIN;
if (!chrome) throw new Error('Set CHROME_BIN to a Chromium or Chrome executable.');

const profile = await mkdtemp(join(tmpdir(), 'custody-chrome-'));
const child = spawn(chrome, [
  '--headless=new',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-background-networking',
  '--disable-component-update',
  `--user-data-dir=${profile}`,
  '--remote-debugging-port=0',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let chromeError = '';
child.stderr.on('data', (chunk) => {
  chromeError = `${chromeError}${chunk}`.slice(-4000);
});

async function waitForDebugPort() {
  const file = join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 400; attempt += 1) {
    try {
      const [port] = (await readFile(file, 'utf8')).split('\n');
      if (port) return port;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Chrome exited before its DevTools port became ready.${chromeError ? `\n${chromeError}` : ''}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Chrome DevTools port did not become ready.${chromeError ? `\n${chromeError}` : ''}`);
}

function connect(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();
  const events = new Map();

  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
      return;
    }
    const listeners = events.get(message.method) ?? [];
    events.delete(message.method);
    for (const listener of listeners) listener(message.params);
  };

  const ready = new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error('Chrome DevTools WebSocket failed.'));
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const once = (method) => new Promise((resolve) => {
    const listeners = events.get(method) ?? [];
    listeners.push(resolve);
    events.set(method, listeners);
  });
  return { socket, ready, send, once };
}

let connection;
try {
  const port = await waitForDebugPort();
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about%3Ablank`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Unable to create Chrome target: ${response.status}`);
  const page = await response.json();
  connection = connect(page.webSocketDebuggerUrl);
  await connection.ready;
  const { send, once } = connection;

  await Promise.all([
    send('Page.enable'),
    send('Runtime.enable'),
    send('Network.enable'),
  ]);
  await send('Emulation.setDeviceMetricsOverride', {
    width: 412,
    height: 915,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 200_000,
    uploadThroughput: 93_750,
    connectionType: 'cellular4g',
  });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      globalThis.__custodyPerformance = { lcp: 0, cls: 0, blockingTime: 0, interaction: 0 };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) globalThis.__custodyPerformance.lcp = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) globalThis.__custodyPerformance.cls += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) globalThis.__custodyPerformance.blockingTime += Math.max(0, entry.duration - 50);
      }).observe({ type: 'longtask', buffered: true });
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.interactionId) globalThis.__custodyPerformance.interaction = Math.max(globalThis.__custodyPerformance.interaction, entry.duration);
          }
        }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
      } catch {}
    `,
  });

  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url: target });
  await loaded;
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const rectResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const target = document.querySelector('.faq-list summary');
      if (!target) return null;
      target.scrollIntoView({ block: 'center' });
      const rect = target.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`,
    returnByValue: true,
  });
  const rect = rectResult.result.value;
  if (rect) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const measured = await send('Runtime.evaluate', {
    expression: `(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      return {
        ...globalThis.__custodyPerformance,
        domContentLoaded: navigation?.domContentLoadedEventEnd ?? 0,
        load: navigation?.loadEventEnd ?? 0,
        resourceCount: resources.length,
        transferBytes: resources.reduce((total, entry) => total + (entry.transferSize || 0), 0),
        scriptResources: resources.filter((entry) => entry.initiatorType === 'script').length,
      };
    })()`,
    returnByValue: true,
  });

  const metrics = measured.result.value;
  const report = {
    url: target,
    profile: {
      viewport: '412x915@2x',
      cpuSlowdown: 4,
      latencyMs: 150,
      downloadBytesPerSecond: 200_000,
    },
    metrics: {
      lcpMs: Math.round(metrics.lcp),
      cls: Number(metrics.cls.toFixed(4)),
      interactionMs: metrics.interaction ? Math.round(metrics.interaction) : null,
      interactionObservation: metrics.interaction
        ? 'recorded'
        : 'below the 16 ms observer threshold or unsupported',
      totalBlockingTimeMs: Math.round(metrics.blockingTime),
      domContentLoadedMs: Math.round(metrics.domContentLoaded),
      loadMs: Math.round(metrics.load),
      resourceCount: metrics.resourceCount,
      transferBytes: metrics.transferBytes,
      scriptResources: metrics.scriptResources,
    },
    targets: { lcpMs: 2500, cls: 0.1, interactionMs: 200 },
    notes: [
      'Local repeatable lab profile; field Core Web Vitals require production traffic.',
      'Interaction is a synthetic FAQ click and is an INP proxy, not field INP.',
    ],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  connection?.socket.close();
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM');
    const exited = await Promise.race([
      new Promise((resolve) => child.once('exit', () => resolve(true))),
      new Promise((resolve) => setTimeout(() => resolve(false), 2_000)),
    ]);
    if (!exited && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await new Promise((resolve) => child.once('exit', resolve));
    }
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
