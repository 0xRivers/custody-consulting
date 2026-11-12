export type TopicLocale = 'en' | 'pl';

// Stable editor IDs; public URLs retain their existing localized slugs.
export const topicRegistry = [
  { id: 'foundations', en: { slug: 'foundations', label: 'Foundations' }, pl: { slug: 'podstawy', label: 'Podstawy' } },
  { id: 'recovery', en: { slug: 'recovery', label: 'Recovery' }, pl: { slug: 'odzyskiwanie', label: 'Odzyskiwanie' } },
  { id: 'continuity', en: { slug: 'continuity', label: 'Continuity' }, pl: { slug: 'ciaglosc', label: 'Ciągłość' } },
] as const;

export function topicForLocale(value: string, locale: TopicLocale) {
  const topic = topicRegistry.find(item => item.id === value || item.en.slug === value || item.pl.slug === value);
  if (!topic) throw new Error(`Unknown topic "${value}". Choose a topic from the article editor.`);
  return topic[locale];
}
