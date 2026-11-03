import type { Locale } from './i18n';

export const blogUi = {
  en: {
    label: 'Knowledge base',
    title: 'Clear answers for safer self-custody.',
    intro: 'Practical explanations of wallets, backups, recovery and continuity. Every article is written to help you make a specific decision.',
    empty: 'No reviewed articles are published yet. New guides will appear here after technical and editorial review.',
    draft: 'Draft preview',
    read: 'Read article',
    topics: 'Topics',
    all: 'All articles',
    page: 'Page',
    previous: 'Previous',
    next: 'Next',
    contents: 'On this page',
    sources: 'Sources and related reading',
    related: 'Related articles',
    back: 'Back to the knowledge base',
    published: 'Published',
    updated: 'Updated',
    by: 'By',
  },
  pl: {
    label: 'Baza wiedzy',
    title: 'Jasne odpowiedzi dla bezpieczniejszej samodzielnej opieki.',
    intro: 'Praktyczne wyjaśnienia dotyczące portfeli, kopii, odzyskiwania i ciągłości. Każdy materiał pomaga podjąć konkretną decyzję.',
    empty: 'Nie opublikowaliśmy jeszcze artykułów po przeglądzie. Nowe materiały pojawią się tutaj po weryfikacji technicznej i redakcyjnej.',
    draft: 'Podgląd szkicu',
    read: 'Czytaj artykuł',
    topics: 'Tematy',
    all: 'Wszystkie artykuły',
    page: 'Strona',
    previous: 'Poprzednia',
    next: 'Następna',
    contents: 'Na tej stronie',
    sources: 'Źródła i dalsza lektura',
    related: 'Powiązane artykuły',
    back: 'Wróć do bazy wiedzy',
    published: 'Opublikowano',
    updated: 'Zaktualizowano',
    by: 'Autor',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function topicLabel(topic: string): string {
  return topic
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
