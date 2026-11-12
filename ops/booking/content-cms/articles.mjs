import { randomBytes } from 'node:crypto';
import { isMap, parseDocument } from 'yaml';
import { github, installationToken, repository } from './github-app.mjs';
import { editableArticle, updatePair, workspaceTopics, WorkspaceError } from './workspace-model.mjs';

const folder = 'astro/src/content/blog';
const slugPattern = '[a-z0-9]+(?:-[a-z0-9]+)*';
const articlePattern = new RegExp(`^${folder}/(en|pl)/(${slugPattern})\\.md$`);
const locales = ['en', 'pl'];
const articlePath = (locale, slug) => `${folder}/${locale}/${slug}.md`;
const branchPattern = new RegExp(`^cms/(?:articles/(${slugPattern})|nostr-articles/(${slugPattern})/[a-f0-9]{16})$`);
const pullSlug = pr => {
  if (pr.head.repo?.full_name !== repository) return null;
  const match = pr.head.ref.match(branchPattern);
  return match?.[1] ?? match?.[2];
};
const base = '/repos/' + repository;

class EditorError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function slugOf(path) {
  const slug = typeof path === 'string' && path.match(articlePattern)?.[2];
  if (!slug || slug.length > 100) throw new EditorError('Invalid article path.');
  return slug;
}

export function createArticlesAPI({ request = github, getToken = installationToken,
  access = () => { throw new EditorError('Content authorization is not configured.', 403); },
  publicRevision = async origin => {
    const response = await fetch(`${origin}/version.txt?content-status=1`, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Public release status is unavailable.');
    const sha = (await response.text()).trim();
    if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Public release status is unavailable.');
    return sha;
  },
} = {}) {
  let pendingWrite = Promise.resolve();
  let credential;
  async function call(path, body, method) {
    if (!credential || credential.until <= Date.now()) {
      credential = { until: Date.now() + 5 * 60_000, token: getToken() };
    }
    try {
      return await request(base + path, await credential.token, body, method);
    } catch (error) {
      if (error.status === 401 || !error.status) credential = undefined;
      throw error;
    }
  }

  async function read(path, ref) {
    slugOf(path);
    const file = await call(`/contents/${path}?ref=${encodeURIComponent(ref)}`);
    if (file.type !== 'file' || file.encoding !== 'base64') throw new EditorError('Article is not a Markdown file.');
    return { file: { path, id: file.sha }, data: Buffer.from(file.content, 'base64').toString('utf8') };
  }

  async function openDrafts() {
    const prs = [];
    for (let page = 1; ; page++) {
      const batch = await call(`/pulls?state=open&base=staging&per_page=100&page=${page}`);
      prs.push(...batch);
      if (batch.length < 100) return prs;
    }
  }

  async function draft(slug) {
    slugOf(articlePath('en', slug));
    const prs = await openDrafts();
    const pr = prs.find(item => pullSlug(item) === slug);
    if (!pr) throw new EditorError('No open draft PR for this article.', 404);
    return pr;
  }

  async function save(params) {
    const { dataFiles, assets, options } = params;
    if (!options?.useWorkflow || options.collectionName !== 'articles' ||
        !Array.isArray(dataFiles) || dataFiles.length !== locales.length || assets?.length) {
      throw new EditorError('Save both translations as an article draft. Media uploads are unavailable.');
    }
    const slug = slugOf(dataFiles[0]?.path);
    const translations = locales.map(locale => {
      const path = articlePath(locale, slug);
      const file = dataFiles.find(item => item?.path === path);
      if (typeof file?.raw !== 'string' || !file.raw.startsWith('---\n') || file.newPath || Buffer.byteLength(file.raw) > 100_000) {
        throw new EditorError('Each translation must be Markdown. Article paths cannot be changed.');
      }
      const frontmatter = /^---\r?\n([\s\S]*?)^---(?:\r?\n|$)/m.exec(file.raw);
      if (!frontmatter) throw new EditorError('Each translation needs YAML frontmatter.');
      const document = parseDocument(frontmatter[1]);
      if (document.errors.length || !isMap(document.contents) || document.get('locale') !== locale) {
        throw new EditorError('Article frontmatter must match its language.');
      }
      return { path, raw: file.raw, frontmatter, document };
    });
    const draftFlag = translations[0].document.get('draft');
    if (typeof draftFlag !== 'boolean') throw new EditorError('Set Keep off the live site in the English entry.');
    const tree = translations.map(({ path, raw, frontmatter, document }) => {
      let content = raw;
      if (document.get('draft') !== draftFlag) {
        document.set('draft', draftFlag);
        content = '---\n' + document.toString() + '---\n' + raw.slice(frontmatter[0].length);
      }
      return { path, mode: '100644', type: 'blob', content };
    });

    const open = (await openDrafts()).find(pr => pullSlug(pr) === slug);
    const branch = open?.head.ref ?? `cms/nostr-articles/${slug}/${randomBytes(8).toString('hex')}`;
    const head = open?.head.sha ?? (await call('/git/ref/heads/staging')).object.sha;
    if (options.expectedRevision && options.expectedRevision !== head) throw new WorkspaceError('This draft changed elsewhere. Reload it before saving; your unsaved text is still available.', 409);
    const parent = await call(`/git/commits/${head}`);
    const { sha: treeSha } = await call('/git/trees', { base_tree: parent.tree.sha, tree });
    let revision = head;
    if (treeSha === parent.tree.sha) {
      if (!open) throw new EditorError('There are no changes to save.');
    } else {
      const { sha } = await call('/git/commits', { message: `Update bilingual article: ${slug}`, tree: treeSha, parents: [head] });
      revision = sha;
      if (open) {
        await call(`/git/refs/heads/${branch}`, { sha, force: false }, 'PATCH');
      } else {
        await call('/git/refs', { ref: `refs/heads/${branch}`, sha });
      }
    }
    if (open) return { url: open.html_url, revision };
    const pr = await call('/pulls', {
      title: `Update bilingual article: ${slug}`,
      head: branch, base: 'staging',
      body: 'Saved from the Custody Consulting content editor. Review both translations before merging.',
    });
    return { url: pr.html_url, revision };
  }

  const assertId = id => {
    if (typeof id !== 'string' || !new RegExp(`^${slugPattern}$`).test(id) || id.length > 100) throw new WorkspaceError('Choose a valid article.');
    return id;
  };
  async function optionalRead(path, ref) {
    try { return await read(path, ref); }
    catch (error) { if (error.status === 404) return null; throw error; }
  }
  async function workspaceRead(id) {
    assertId(id);
    const open = (await openDrafts()).find(pr => pullSlug(pr) === id);
    const staging = (await call('/git/ref/heads/staging')).object.sha;
    const revision = open?.head.sha ?? staging;
    const saved = Object.fromEntries(await Promise.all(locales.map(async locale =>
      [locale, await read(articlePath(locale, id), revision)])));
    let liveRevision = null, live = {}, liveStatusKnown = true;
    try {
      liveRevision = await publicRevision('https://custody.consulting');
      live = Object.fromEntries(await Promise.all(locales.map(async locale =>
        [locale, await optionalRead(articlePath(locale, id), liveRevision)])));
    } catch { liveStatusKnown = false; }
    let previewReady = false;
    try {
      const deployed = await publicRevision('https://staging.custody.consulting');
      const staged = await Promise.all(locales.map(locale => read(articlePath(locale, id), deployed)));
      previewReady = staged.every((entry, index) => entry.file.id === saved[locales[index]].file.id);
    } catch { /* No claim of an exact deployed preview when verification is unavailable. */ }
    return { id, revision, liveRevision, liveStatusKnown, previewReady,
      reviewUrl: open?.html_url ?? null, topics: workspaceTopics,
      translations: Object.fromEntries(locales.map(locale => [locale, editableArticle(saved[locale].data)])),
      live: Object.fromEntries(locales.map(locale => [locale, live[locale] && !editableArticle(live[locale].data).draft ? editableArticle(live[locale].data) : null])),
    };
  }
  async function workspaceSave(params) {
    const id = assertId(params.id);
    if (!/^[a-f0-9]{40}$/.test(params.revision ?? '')) throw new WorkspaceError('Reload the saved draft before making changes.', 409);
    const open = (await openDrafts()).find(pr => pullSlug(pr) === id);
    const revision = open?.head.sha ?? (await call('/git/ref/heads/staging')).object.sha;
    if (revision !== params.revision) throw new WorkspaceError('This draft changed elsewhere. Reload before saving; your unsaved text is still available.', 409);
    const baseFiles = Object.fromEntries(await Promise.all(locales.map(async locale => [locale, await read(articlePath(locale, id), revision)])));
    const dataFiles = updatePair(baseFiles, params.changes).map(entry => ({ path: entry.file.path, raw: entry.raw }));
    return save({ dataFiles, assets: [], options: { useWorkflow: true, collectionName: 'articles', expectedRevision: revision } });
  }

  return async ({ action, params = {} }, context = {}) => {
    const scope = await access(context.actor);
    const allowed = id => scope.global || scope.articleIds.includes(id);
    const check = async id => {
      assertId(id);
      const current = await access(context.actor);
      if (!current.global && !current.articleIds.includes(id)) throw new EditorError('Article is outside your assigned scope.', 403);
    };
    if (['workspaceRead', 'workspaceSave'].includes(action)) await check(params.id);
    else if (action !== 'workspaceList' && !scope.global) throw new EditorError('This operation requires global content access.', 403);
    switch (action) {
      case 'workspaceList': {
        const files = await call(`/contents/${folder}/en?ref=staging`);
        const ids = new Set(files.filter(file => file.type === 'file' && articlePattern.test(file.path)).map(file => slugOf(file.path)));
        const prs = await openDrafts();
        for (const pr of prs) { const id = pullSlug(pr); if (id) ids.add(id); }
        return { articles: await Promise.all([...ids].filter(allowed).map(async id => {
          await check(id);
          const pr = prs.find(pr => pullSlug(pr) === id);
          const entry = await read(articlePath('en', id), pr?.head.sha ?? 'staging');
          return { id, title: editableArticle(entry.data).title, hasSavedChanges: !!pr };
        })), topics: workspaceTopics };
      }
      case 'workspaceRead': return workspaceRead(params.id);
      case 'workspaceSave': {
        const task = pendingWrite.then(async () => { await check(params.id); return workspaceSave(params); });
        pendingWrite = task.catch(() => {});
        return task;
      }
      case 'entriesByFolder': {
        if (params.folder !== folder) throw new EditorError('Unknown collection.');
        const files = (await Promise.all(locales.map(locale => call(`/contents/${folder}/${locale}?ref=staging`)))).flat();
        return Promise.all(files.filter(file => file.type === 'file' && articlePattern.test(file.path))
          .map(file => read(file.path, 'staging')));
      }
      case 'getEntry':
        return read(params.path, 'staging');
      case 'unpublishedEntries':
        return [...new Set((await openDrafts()).map(pullSlug).filter(Boolean))];
      case 'unpublishedEntry': {
        const slug = params.id ?? params.slug;
        const pr = await draft(slug);
        return { collection: 'articles', slug, status: 'draft', updatedAt: pr.updated_at,
          pullRequestAuthor: pr.user?.login, diffs: locales.map(locale => ({ path: articlePath(locale, slug) })) };
      }
      case 'unpublishedEntryDataFile': {
        if (slugOf(params.path) !== params.slug) throw new EditorError('Article paths do not match.');
        const pr = await draft(params.slug);
        return { data: (await read(params.path, pr.head.sha)).data };
      }
      case 'persistEntry': {
        const task = pendingWrite.then(async () => { if (!(await access(context.actor)).global) throw new EditorError('Global content access was revoked.', 403); return save(params); });
        pendingWrite = task.catch(() => {});
        return task;
      }
      case 'getPRMetadata': {
        const pr = await draft(params.slug);
        return { metadata: { number: pr.number, url: pr.html_url } };
      }
      case 'getMedia':
        return [];
      case 'getNotes':
        return { notes: [] };
      default:
        throw new EditorError('Review and merge article changes in the GitHub pull request.');
    }
  };
}
