import { AdminError } from '../nostr-admin.mjs';

export function createContentHandler({ api, admin, origin, sessionSeconds, authorize = () => {} }) {
  const cookieName = '__Secure-custody-content';
  const cookie = (token, age) => `${cookieName}=${token}; Path=/admin/content/; Max-Age=${age}; Secure; HttpOnly; SameSite=Strict`;
  const tokenFrom = req => req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  const handler = async (req, res) => {
    if (!['/admin/content/session', '/admin/content/articles'].includes(req.url)) return false;
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    const token = tokenFrom(req);
    if (req.url === '/admin/content/session') {
      if (req.method === 'GET') {
        try { admin.requireContentSession(token); res.writeHead(204).end(); }
        catch { res.writeHead(401).end(); }
      } else if (req.method === 'DELETE' && req.headers.origin === origin) {
        admin.endContentSession(token); res.writeHead(204, { 'Set-Cookie': cookie('', 0) }).end();
      } else res.writeHead(403).end();
      return true;
    }
    res.setHeader('Content-Type', 'application/json');
    try {
      if (req.method !== 'POST' || req.headers.origin !== origin || req.headers['content-type']?.split(';')[0] !== 'application/json') throw new AdminError('Request rejected.');
      const actor = admin.requireContentSession(token);
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 500000) { res.writeHead(413).end(JSON.stringify({ error: 'Article draft is too large.' })); return true; }
        chunks.push(chunk);
      }
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!input || typeof input !== 'object' || Array.isArray(input)) { res.writeHead(400).end(JSON.stringify({ error: 'Invalid article request.' })); return true; }
      await authorize({ actor, action: input.action, params: input.params });
      const result = await api(input, { actor });
      res.end(JSON.stringify(result));
    } catch (error) {
      const status = error instanceof SyntaxError ? 400 : error.status || 502;
      res.writeHead(status).end(JSON.stringify({ error: status < 500 ? error.message : 'Article service unavailable. Your edits have not been discarded.' }));
    }
    return true;
  };
  return Object.assign(handler, { sessionCookie: token => cookie(token, sessionSeconds) });
}
