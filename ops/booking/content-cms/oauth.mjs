import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const origin = 'https://custody.consulting';
const path = '/admin/content/';
const callback = origin + path + 'callback';
const cookie = '__Secure-custody-cms-state';
const lifetime = 300;
const pending = new Map();
const clientId = process.env.CMS_GITHUB_CLIENT_ID;
const clientSecret = process.env.CMS_GITHUB_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error('Configure the GitHub OAuth client on the VPS.');

function popup(res, status, payload) {
  const nonce = randomBytes(18).toString('base64url');
  const message = JSON.stringify('authorization:github:' + status + ':' + JSON.stringify(payload))
    .replaceAll('<', '\\u003c');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'nonce-" + nonce + "'; frame-ancestors 'none'");
  res.end(`<!doctype html><meta charset="utf-8"><title>Custody Content sign-in</title>
    <p>${status === 'success' ? 'Returning to the content editor…' : 'Sign-in failed. Return to the editor and try again.'}</p>
    <script nonce="${nonce}">
      if (window.opener) {
        function reply(event) {
          if (event.origin !== '${origin}' || event.source !== window.opener) return;
          window.removeEventListener('message', reply);
          window.opener.postMessage(${message}, '${origin}');
        }
        window.addEventListener('message', reply);
        window.opener.postMessage('authorizing:github', '${origin}');
      }
    </script>`);
}

createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.writeHead(405, { Allow:'GET' }).end(); return; }
  const url = new URL(req.url, origin);
  if (url.pathname === path + 'auth') {
    const now = Date.now();
    for (const [key, attempt] of pending) if (attempt.expires <= now) pending.delete(key);
    if (pending.size >= 100) { res.writeHead(429).end('Try again shortly.'); return; }
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    pending.set(state, { verifier, expires: now + lifetime * 1000 });
    const authorize = new URL('https://github.com/login/oauth/authorize');
    authorize.search = new URLSearchParams({
      client_id:clientId, redirect_uri:callback, scope:'repo', state,
      code_challenge:createHash('sha256').update(verifier).digest('base64url'), code_challenge_method:'S256',
    });
    res.writeHead(302, { Location:authorize.href,
      'Set-Cookie':`${cookie}=${state}; Path=${path}; Max-Age=${lifetime}; Secure; HttpOnly; SameSite=Lax` }).end();
    return;
  }
  if (url.pathname !== path + 'callback') { res.writeHead(404).end(); return; }
  const state = url.searchParams.get('state');
  const cookieState = req.headers.cookie?.split(';').map(part => part.trim())
    .find(part => part.startsWith(cookie + '='))?.slice(cookie.length + 1);
  res.setHeader('Set-Cookie', `${cookie}=; Path=${path}; Max-Age=0; Secure; HttpOnly; SameSite=Lax`);
  const attempt = state && state === cookieState ? pending.get(state) : null;
  if (!attempt || attempt.expires <= Date.now()) {
    popup(res,'error','Expired or invalid authorization request.'); return;
  }
  pending.delete(state);
  const code = url.searchParams.get('code');
  if (!code) { popup(res,'error','GitHub authorization was declined.'); return; }
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method:'POST', redirect:'error', signal:AbortSignal.timeout(10000),
      headers:{Accept:'application/json'},
      body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,
        redirect_uri:callback,code_verifier:attempt.verifier}),
    });
    const result = await response.json();
    const token = result.access_token;
    if (!response.ok || typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,512}$/.test(token)) throw new Error();
    const identity = await fetch('https://api.github.com/user', {
      redirect:'error', signal:AbortSignal.timeout(10000),
      headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token},
    });
    const user = await identity.json();
    if (!identity.ok || user.login?.toLowerCase() !== '0xrivers') {
      popup(res,'error','This GitHub account is not approved for the content editor.'); return;
    }
    popup(res,'success',{token,provider:'github'});
  } catch {
    popup(res,'error','GitHub authorization could not be completed.');
  }
}).listen(8015,'127.0.0.1');
