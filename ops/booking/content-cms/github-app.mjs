import { createPrivateKey, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const repository = '0xRivers/custody-consulting';

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export async function github(path, token, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(new URL(path, 'https://api.github.com'), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Object.assign(new Error(`GitHub returned HTTP ${response.status} for ${path}`), { status: response.status });
  if (response.status === 204) return null;
  return response.json();
}

export async function installationToken({actions=false}={}) {
  const appId = process.env.CONTENT_GITHUB_APP_ID;
  const keyFile = process.env.CONTENT_GITHUB_APP_KEY_FILE;
  if (!/^\d+$/.test(appId ?? '') || !keyFile) {
    throw new Error('Set CONTENT_GITHUB_APP_ID and CONTENT_GITHUB_APP_KEY_FILE.');
  }
  const key = createPrivateKey(await readFile(keyFile));
  const now = Math.floor(Date.now() / 1000);
  const claims = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: appId, iat: now - 60, exp: now + 300 })}`;
  const jwt = `${claims}.${sign('RSA-SHA256', Buffer.from(claims), key).toString('base64url')}`;
  const installation = await github(`/repos/${repository}/installation`, jwt);
  if (installation.repository_selection !== 'selected' || installation.suspended_at) {
    throw new Error('Use an active installation with only the selected repository.');
  }
  if(actions&&installation.permissions?.actions!=='write')throw Object.assign(new Error('Publishing setup required: grant this repository-scoped GitHub App Actions read/write, then approve the updated installation.'),{status:409});
  return (await github(`/app/installations/${installation.id}/access_tokens`, jwt, {
    repositories: ['custody-consulting'],
    permissions: { contents: 'write', pull_requests: 'write',...(actions?{actions:'write'}:{}) },
  })).token;
}
