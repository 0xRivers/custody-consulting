import { parseDocument } from 'yaml';
import topics from '../../../astro/src/lib/topics.json' with { type: 'json' };

export const workspaceTopics = topics.map(topic => ({ id: topic.id, label: `${topic.en.label} / ${topic.pl.label}` }));
export class WorkspaceError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const allowedFields = new Set(['title', 'summary', 'keyAnswer', 'body', 'slug', 'sources']);
const limits = { title: [8, 100], summary: [30, 240], keyAnswer: [40, 360], body: [40, 80000] };
export function decodeArticle(raw) {
  const match = /^---\r?\n([\s\S]*?)^---(?:\r?\n|$)/m.exec(raw);
  if (!match || match.index !== 0) throw new WorkspaceError('This article has invalid frontmatter. Open Details for assistance.');
  const document = parseDocument(match[1]);
  if (document.errors.length) throw new WorkspaceError('This article has invalid metadata.');
  const data = document.toJS();
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new WorkspaceError('Article metadata must be an object.');
  return { document, data, body: raw.slice(match[0].length).trim(), match };
}
export function canonicalTopics(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > topics.length) throw new WorkspaceError('Choose at least one topic.');
  return [...new Set(values.map(value => {
    const topic = topics.find(item => [item.id, item.en.slug, item.pl.slug].includes(value));
    if (!topic) throw new WorkspaceError('Choose a topic from the list.');
    return topic.id;
  }))];
}
export function editableArticle(raw) {
  const { data, body } = decodeArticle(raw);
  return { title: data.title, summary: data.summary, keyAnswer: data.keyAnswer, slug: data.slug,
    sources: data.sources, body, author: data.author, publishedAt: data.publishedAt,
    topics: canonicalTopics(data.topics), draft: data.draft };
}
export function updatePair(baseFiles, input, liveFiles = {}) {
  if (!input || typeof input !== 'object' || Object.keys(input).some(key => !['en', 'pl', 'topics'].includes(key))) throw new WorkspaceError('Invalid article changes.');
  const topicIds = canonicalTopics(input.topics);
  return ['en', 'pl'].map(locale => {
    const fields = input[locale];
    if (!fields || typeof fields !== 'object' || Array.isArray(fields) || Object.keys(fields).some(key => !allowedFields.has(key))) throw new WorkspaceError('Only article text and sources can be edited here.');
    const { document, data } = decodeArticle(baseFiles[locale].data);
    if (data.locale !== locale) throw new WorkspaceError('Article language does not match its folder.');
    for (const [key, [min, max]] of Object.entries(limits)) {
      if (typeof fields[key] !== 'string' || fields[key].trim().length < min || fields[key].trim().length > max) {
        throw new WorkspaceError(`${locale === 'pl' ? 'Polski' : 'English'}: ${key} must contain ${min}–${max} characters.`);
      }
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.slug ?? '') || fields.slug.length > 100) throw new WorkspaceError(`${locale}: use lowercase words separated by hyphens in the URL.`);
    // Changing a saved URL requires a redirect-aware flow, including staged articles.
    if (fields.slug !== data.slug) throw new WorkspaceError('Saved article URLs are locked. A URL change requires a redirect review.');
    if (!Array.isArray(fields.sources) || fields.sources.length < 1 || fields.sources.length > 12) throw new WorkspaceError(`${locale}: add between 1 and 12 sources.`);
    for (const source of fields.sources) {
      if (!source || Object.keys(source).some(key => !['label', 'url'].includes(key)) || typeof source.label !== 'string' || source.label.trim().length < 3 || source.label.length > 140) throw new WorkspaceError(`${locale}: each source needs a descriptive name.`);
      let url;
      try { url = new URL(source.url); } catch { throw new WorkspaceError(`${locale}: enter a valid source URL.`); }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new WorkspaceError(`${locale}: use a public HTTP or HTTPS source URL.`);
    }
    for (const key of ['title', 'summary', 'keyAnswer']) document.set(key, fields[key].trim());
    document.set('sources', fields.sources.map(source => ({ label: source.label.trim(), url: source.url.trim() })));
    document.set('topics', topicIds);
    // Save never publishes/unpublishes or changes the first-publication date.
    // A modification date is applied by the publication flow, not by draft saving.
    return { ...baseFiles[locale], raw: `---\n${document.toString()}---\n\n${fields.body.trim()}\n` };
  });
}
