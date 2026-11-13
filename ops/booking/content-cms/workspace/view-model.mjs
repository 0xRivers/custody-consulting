export const locales = ['en', 'pl'];
export const fields = ['title', 'summary', 'keyAnswer', 'body', 'slug', 'sources'];
export function editableChanges(translations, topics) {
  return { topics: [...topics], ...Object.fromEntries(locales.map(locale => [locale,
    Object.fromEntries(fields.map(field => [field, structuredClone(translations[locale][field])]))])) };
}
export function signature(changes) { return JSON.stringify(changes); }
export function reviewChanges(changes, live) {
  return locales.map(locale => ({ locale,
    changes: [...fields, 'topics'].flatMap(field => {
      const before = live?.[locale]?.[field] ?? null;
      const after = field === 'topics' ? changes.topics : changes[locale][field];
      return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ field, before, after }];
    }),
  }));
}
export function validateChanges(changes) {
  if (!changes.topics?.length) return { message: 'Choose a topic for both languages.', field: 'topics' };
  for (const locale of locales) {
    for (const [field, min, max] of [['title', 8, 100], ['summary', 30, 240], ['keyAnswer', 40, 360], ['body', 40, 80000]]) {
      const length = changes[locale][field]?.trim().length ?? 0;
      if (length < min || length > max) return { locale, field, message: `${locale === 'pl' ? 'Polski' : 'English'}: ${field} needs ${min}–${max} characters.` };
    }
    if (!changes[locale].sources.length || changes[locale].sources.length > 12) return { locale, field: 'sources', message: 'Add between 1 and 12 sources in each language.' };
    for (const source of changes[locale].sources) {
      let url;
      try { url = new URL(source.url); } catch { /* handled below */ }
      if (source.label.trim().length < 3 || source.label.length > 140 || !url || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) return { locale, field: 'sources', message: 'Each source needs a descriptive name and a public HTTP or HTTPS URL.' };
    }
  }
  return null;
}

// Publication checks mirror the existing answer-focused build contract. Draft
// saves remain permissive; these checks run before a release can be approved.
export function publicationProblems(changes) {
  const problems = [], structure = {};
  const add = (locale, field, message) => problems.push({ locale, field, message: `${locale === 'pl' ? 'Polski' : 'English'}: ${message}` });
  const prohibited = /guarante(?:e|ed)|rank\s*#?1|featured snippet|AI citation|gwarancj\w*\s+(?:pozycj|cytow)|pierwsze miejsce w google/i;
  for (const locale of locales) {
    const article = changes[locale], body = article.body.trim();
    const headings = [...body.matchAll(/^##\s+(.+)$/gm)].map(match => match[1].trim());
    structure[locale] = { headings: headings.length, sources: article.sources.length };
    if (article.keyAnswer.trim().length < 40 || article.keyAnswer.trim().length > 240) add(locale, 'keyAnswer', 'Keep the opening answer between 40 and 240 characters.');
    if (!body || body.startsWith('#')) add(locale, 'body', 'Begin with an introductory paragraph before the first heading.');
    if (headings.length < 3) add(locale, 'body', 'Add at least three sections using ## headings.');
    if (headings.filter(heading => heading.endsWith('?')).length < 2) add(locale, 'body', 'Write at least two section headings as questions ending in ?.');
    if (new Set(headings).size !== headings.length) add(locale, 'body', 'Give each section a different heading.');
    if (article.sources.length < 2) add(locale, 'sources', 'Add at least two relevant sources.');
    if (!new RegExp(`\\(/${locale}/#services\\)`).test(body)) add(locale, 'body', `Include a contextual services link, such as [consulting services](/${locale}/#services).`);
    if (!/^\|.+\|$/m.test(body)) add(locale, 'body', 'Include the comparison table required by the current article rules.');
    if (prohibited.test(JSON.stringify(article))) add(locale, 'body', 'Remove unsupported guarantees or search-ranking promises.');
  }
  if (structure.en.headings !== structure.pl.headings) add('pl', 'body', 'Use the same number of sections as the English version.');
  if (structure.en.sources !== structure.pl.sources) add('pl', 'sources', 'Use the same number of sources as the English version.');
  return problems;
}
