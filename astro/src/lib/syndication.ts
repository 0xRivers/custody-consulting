import {
  ARTICLES_PER_PAGE,
  articlePath,
  articleTopics,
  type ArticleLike,
  type ArticleLocale,
} from './article-rules.ts';

export interface SitemapEntry {
  path: string;
  lastmod?: string;
}

interface FeedArticle extends ArticleLike {
  data: ArticleLike['data'] & {
    title: string;
    summary: string;
  };
}

const localePaths: Record<ArticleLocale, string[]> = {
  en: ['/en/', '/en/blog/'],
  pl: ['/pl/', '/pl/blog/'],
};

const feedText = {
  en: {
    title: 'Custody Consulting knowledge base',
    description: 'Practical English guidance for safer Bitcoin self-custody.',
    language: 'en-GB',
  },
  pl: {
    title: 'Baza wiedzy Custody Consulting',
    description: 'Praktyczne materiały po polsku o bezpieczniejszym samodzielnym przechowywaniu bitcoina.',
    language: 'pl-PL',
  },
} as const;

export function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function latestDate(articles: ArticleLike[]): string | undefined {
  if (articles.length === 0) return undefined;
  return new Date(Math.max(...articles.map((article) =>
    (article.data.updatedAt ?? article.data.publishedAt).getTime()
  ))).toISOString();
}

function paginatedPaths(base: string, articles: ArticleLike[]): SitemapEntry[] {
  const pages = Math.ceil(articles.length / ARTICLES_PER_PAGE);
  return Array.from({ length: Math.max(0, pages - 1) }, (_, index) => {
    const page = index + 2;
    const pageArticles = articles.slice((page - 1) * ARTICLES_PER_PAGE, page * ARTICLES_PER_PAGE);
    return { path: `${base}page/${page}/`, lastmod: latestDate(pageArticles) };
  });
}

export function buildSitemapEntries(articles: ArticleLike[]): SitemapEntry[] {
  const published = articles.filter((article) => !article.data.draft);
  const entries: SitemapEntry[] = [{ path: '/' }];

  for (const locale of ['en', 'pl'] as const) {
    const localized = published.filter((article) => article.data.locale === locale);
    const latest = latestDate(localized);
    entries.push(
      { path: localePaths[locale][0] },
      { path: localePaths[locale][1], lastmod: latest },
      ...paginatedPaths(localePaths[locale][1], localized),
    );

    for (const topic of articleTopics(localized)) {
      const topicArticles = localized.filter((article) => article.data.topics?.includes(topic));
      const base = `/${locale}/blog/topics/${topic}/`;
      entries.push(
        { path: base, lastmod: latestDate(topicArticles) },
        ...paginatedPaths(base, topicArticles),
      );
    }
  }

  entries.push(...published.map((article) => ({
    path: articlePath(article),
    lastmod: (article.data.updatedAt ?? article.data.publishedAt).toISOString(),
  })));

  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function absolute(site: string, path: string): string {
  if (!path.startsWith('/')) throw new Error(`Syndication path must be site-relative: ${path}`);
  return new URL(path, site).href;
}

export function renderSitemap(site: string, entries: SitemapEntry[]): string {
  const urls = entries.map((entry) => {
    const lastmod = entry.lastmod ? `<lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : '';
    return `<url><loc>${xmlEscape(absolute(site, entry.path))}</loc>${lastmod}</url>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export function renderRss(site: string, locale: ArticleLocale, articles: FeedArticle[]): string {
  const text = feedText[locale];
  const published = articles
    .filter((article) => !article.data.draft && article.data.locale === locale)
    .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
  const feedPath = `/${locale}/rss.xml`;
  const blogUrl = absolute(site, `/${locale}/blog/`);
  const items = published.map((article) => {
    const url = absolute(site, articlePath(article));
    return `<item><title>${xmlEscape(article.data.title)}</title><link>${xmlEscape(url)}</link><guid isPermaLink="true">${xmlEscape(url)}</guid><pubDate>${article.data.publishedAt.toUTCString()}</pubDate><description>${xmlEscape(article.data.summary)}</description></item>`;
  }).join('');
  const lastBuildDate = latestDate(published);

  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xmlEscape(text.title)}</title><link>${xmlEscape(blogUrl)}</link><description>${xmlEscape(text.description)}</description><language>${text.language}</language><atom:link href="${xmlEscape(absolute(site, feedPath))}" rel="self" type="application/rss+xml"/>${lastBuildDate ? `<lastBuildDate>${new Date(lastBuildDate).toUTCString()}</lastBuildDate>` : ''}${items}</channel></rss>`;
}
