import { createPrivateKey, sign } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const repository = '0xRivers/custody-consulting';
const base = `/repos/${repository}`;
const repositoryUrl = `https://github.com/${repository}`;
const pairPath = /^astro\/src\/content\/blog\/(en|pl)\/([a-z0-9-]+)\.md$/;

export function releaseScope(files) {
  if (files.length >= 300) throw new Error('Release is too large to summarize safely. Review the comparison in GitHub.');
  const pairs = new Map();
  for (const file of files) {
    const match = file.filename.match(pairPath);
    if (!match || file.status === 'renamed' || file.status === 'removed') return { contentOnly: false, pairs: [] };
    pairs.set(match[2], [...(pairs.get(match[2]) ?? []), match[1]]);
  }
  return { contentOnly: files.length > 0, pairs: [...pairs.keys()] };
}

export function eligibleEvent(eventName, event) {
  if (event.repository?.full_name !== repository) return false;
  if (eventName === 'push') return event.ref === 'refs/heads/main' && !event.deleted;
  const run = event.workflow_run;
  return eventName === 'workflow_run' && run?.name === 'Check and deploy staging' &&
    run.event === 'push' && run.head_branch === 'staging' && run.conclusion === 'success' &&
    run.head_repository?.full_name === repository;
}

// All automated merges are main -> staging. Production PRs are never auto-merged.
export async function preparePromotion({ call, expectedStaging }) {
  const main = (await call('/git/ref/heads/main')).object.sha;
  const staging = (await call('/git/ref/heads/staging')).object.sha;
  if (expectedStaging && staging !== expectedStaging) return 'A newer staging revision is building. This older result was ignored.';
  const comparison = await call(`/compare/${main}...${staging}`);
  if (comparison.behind_by > 0) {
    // GitHub performs a normal merge and rejects conflicts/protection failures.
    // A resulting push reruns staging checks before a promotion is prepared.
    await call('/merges', { base: 'staging', head: main, commit_message: 'Synchronize verified main history into staging' });
    return 'Staging was synchronized with main. Its checks and preview will run again automatically.';
  }
  if (!comparison.files?.length) return 'Main and staging have the same files. There is nothing to publish.';
  if (!expectedStaging) return 'Staging is ahead. Its successful deployment will prepare the production review.';
  const scope = releaseScope(comparison.files);
  // Resolve refs again before creating/updating review metadata. Never attach an
  // old staging success to a newer head or a changed production base.
  if ((await call('/git/ref/heads/staging')).object.sha !== staging ||
      (await call('/git/ref/heads/main')).object.sha !== main) {
    return 'A branch changed while preparing the review. Waiting for the next checked revision.';
  }
  const prs = await call('/pulls?state=open&base=main&head=0xRivers:staging&per_page=100');
  const title = scope.contentOnly ? 'Publish reviewed article updates' : 'Review staged website changes for production';
  const body = [
    '<!-- custody-release-assistant -->',
    '## Ready for owner review',
    `Staging revision: \`${staging}\`. Production base: \`${main}\`.`,
    'Review both languages: https://staging.custody.consulting/en/blog/ and https://staging.custody.consulting/pl/blog/.',
    '',
    scope.contentOnly ? 'This release contains article files only. Review every listed article before merging.' :
      '**This release includes code, configuration, URL changes or deletions. It requires engineering review.**',
    '',
    '## Complete release scope',
    ...comparison.files.map(file => `- \`${file.filename}\` (${file.status})`),
    '',
    '## Publish',
    '1. Review this exact revision and wait for required checks.',
    '2. Merge this PR when the full release scope is approved.',
    '3. Open the automatically started Check and deploy website run and approve production.',
    'No terminal command or manual workflow launch is needed. Production protection remains enabled.',
    'If staging changes, review the new diff before merging. A staging preview is public, not private storage.',
  ].join('\n');
  if (prs.length > 1) throw new Error('Multiple staging promotion PRs exist. Resolve the duplicate before continuing.');
  const existing = prs[0];
  if (existing && !existing.body?.includes('<!-- custody-release-assistant -->')) {
    return `An owner-created production review already exists: ${existing.html_url}. It was left unchanged.`;
  }
  const pr = existing ? await call(`/pulls/${existing.number}`, { title, body }, 'PATCH') :
    await call('/pulls', { title, body, base: 'main', head: 'staging' });
  return `Production review ready: ${pr.html_url}. Merge after review; deployment will start automatically.`;
}

async function api(path, token, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(`https://api.github.com${path}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status}. Branch protection and conflicts must be resolved; no bypass was attempted.`);
  return response.status === 204 ? null : response.json();
}

async function installationToken(appId, pem) {
  if (!/^\d+$/.test(appId)) throw new Error('Invalid release App ID.');
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: appId, iat: now - 60, exp: now + 300 })}`;
  const jwt = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), createPrivateKey(pem)).toString('base64url')}`;
  const installation = await api(`${base}/installation`, jwt);
  if (installation.repository_selection !== 'selected' || installation.suspended_at) throw new Error('Use an active App installation restricted to the selected repository.');
  return (await api(`/app/installations/${installation.id}/access_tokens`, jwt, {
    repositories: ['custody-consulting'], permissions: { contents: 'write', pull_requests: 'write' },
  })).token;
}

async function main() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  if (!eligibleEvent(process.env.GITHUB_EVENT_NAME, event)) return;
  const summary = async message => {
    console.log(message);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `## Publishing assistant\n\n${message}\n\n[Production review](${repositoryUrl}/compare/main...staging?expand=1) · [Deployments](${repositoryUrl}/actions/workflows/deploy.yml)\n`);
  };
  const appId = process.env.RELEASE_APP_ID;
  const key = process.env.RELEASE_APP_PRIVATE_KEY;
  if (!appId || !key) {
    await summary('Automatic PR preparation is not configured yet. Add the release App ID and private key described in docs/PUBLISHING.md. Automatic production workflow launch does not require these credentials.');
    return;
  }
  const token = await installationToken(appId, key);
  try {
    await summary(await preparePromotion({
      call: (path, body, method) => api(base + path, token, body, method),
      expectedStaging: process.env.GITHUB_EVENT_NAME === 'workflow_run' ? event.workflow_run.head_sha : undefined,
    }));
  } catch (error) {
    await summary(`${error.message} Use the production review link below to continue manually.`);
    process.exitCode = 1;
  } finally {
    await api('/installation/token', token, undefined, 'DELETE').catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
