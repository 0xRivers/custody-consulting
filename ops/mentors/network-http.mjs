// Adapter for parsed /booking-api/checkout requests. All network operations remain
// same-origin POSTs; bearer values are confined to Secure HttpOnly cookies.
export function createNetworkHTTP({ network, contentHandler, origin, staffLedger }) {
  const actions = new Set(['mentor-network-challenge', 'mentor-network-confirm', 'mentor-network-read', 'mentor-network-logout']);
  const cookieName = '__Secure-custody-network';
  const cookie = (value, age) => `${cookieName}=${value}; Path=/booking-api/; Max-Age=${age}; Secure; HttpOnly; SameSite=Strict`;
  return (req, res, input) => {
    if (!actions.has(input.action)) return false;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (req.method !== 'POST' || req.headers.origin !== origin || req.headers['content-type']?.split(';')[0] !== 'application/json') throw Object.assign(new Error('Request rejected.'), { status: 403 });
      if (!network) throw Object.assign(new Error('Mentor applications are not open yet.'), { status: 503 });
      const token = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
      let result;
      if (input.action === 'mentor-network-read') {
        if(input.purpose==='sales-ledger'&&staffLedger)result=staffLedger(network.requireSession(token),input.request);
        if(result==null)result=network.readSession({ token, purpose: input.purpose, request: input.request });
      }
      else if (input.action === 'mentor-network-logout') {
        network.endSession(token); res.setHeader('Set-Cookie', cookie('', 0)); result = { ended: true };
      } else result = input.action === 'mentor-network-challenge' ? network.challenge(input) : network.execute(input);
      if (result.contentSessionToken) {
        if (!contentHandler) throw Object.assign(new Error('Content workspace is disabled.'), { status: 503 });
        res.setHeader('Set-Cookie', contentHandler.sessionCookie(result.contentSessionToken)); result = { connected: true };
      }
      if (result.sessionToken) { res.setHeader('Set-Cookie', cookie(result.sessionToken, 1800)); result = { connected: true }; }
      res.writeHead(200).end(JSON.stringify(result));
    } catch (error) {
      const status = error.status || 502;
      res.writeHead(status).end(JSON.stringify({ error: status < 500 || status === 503 ? error.message : 'Mentor service unavailable.' }));
    }
    return true;
  };
}
