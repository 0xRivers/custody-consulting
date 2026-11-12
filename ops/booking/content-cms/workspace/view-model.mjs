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
