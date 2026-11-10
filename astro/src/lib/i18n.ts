import { content } from '../../../src/lib/content';

export const locales = ['en', 'pl'] as const;
export type Locale = (typeof locales)[number];

export function getContent(locale: Locale) {
  return content[locale];
}

export function alternateLocale(locale: Locale): Locale {
  return locale === 'en' ? 'pl' : 'en';
}
