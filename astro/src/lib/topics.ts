export type TopicLocale = 'en' | 'pl';

// Stable editor IDs; public URLs retain their existing localized slugs.
import topicRegistry from './topics.json' with { type: 'json' };
export { topicRegistry };

export function topicForLocale(value: string, locale: TopicLocale) {
  const topic = topicRegistry.find(item => item.id === value || item.en.slug === value || item.pl.slug === value);
  if (!topic) throw new Error(`Unknown topic "${value}". Choose a topic from the article editor.`);
  return topic[locale];
}
