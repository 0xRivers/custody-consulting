import { parse } from 'yaml';

export function articleFrontmatter(source, pathname = 'article') {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`Missing frontmatter in ${pathname}`);
  const data = parse(match[1]);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`Invalid frontmatter in ${pathname}`);
  const result = {};
  for (const field of ['locale', 'slug', 'translationKey']) {
    if (typeof data[field] !== 'string' || !data[field].trim()) throw new Error(`Missing or invalid ${field} in ${pathname}`);
    result[field] = data[field].trim();
  }
  // A malformed flag must not accidentally treat a private draft as published.
  if (typeof data.draft !== 'boolean') throw new Error(`Missing or invalid draft in ${pathname}`);
  return { ...result, draft: data.draft };
}
