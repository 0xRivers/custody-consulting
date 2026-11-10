import { articlePath, type ArticleLike, type ArticleLocale } from './article-rules.ts';

interface StructuredArticle extends ArticleLike {
  data: ArticleLike['data'] & {
    title: string;
    summary: string;
    author: string;
  };
}

interface BreadcrumbNames {
  home: string;
  blog: string;
}

function absolute(site: string, path: string): string {
  if (!path.startsWith('/')) throw new Error(`Structured-data path must be site-relative: ${path}`);
  const base = new URL(site);
  if (base.protocol !== 'https:' || base.username || base.password) {
    throw new Error(`Structured-data site must be a credential-free HTTPS origin: ${site}`);
  }
  return new URL(path, base).href;
}

function languageTag(locale: ArticleLocale): string {
  return locale === 'pl' ? 'pl-PL' : 'en-GB';
}

export function buildArticleStructuredData(
  site: string,
  article: StructuredArticle,
  breadcrumbNames: BreadcrumbNames,
) {
  const articleUrl = absolute(site, articlePath(article));
  const organizationId = `${absolute(site, '/')}#organization`;
  const author = article.data.author === 'Custody Consulting'
    ? { '@id': organizationId }
    : { '@type': 'Person', name: article.data.author };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'Custody Consulting',
        url: absolute(site, '/'),
      },
      {
        '@type': 'BlogPosting',
        '@id': `${articleUrl}#article`,
        url: articleUrl,
        mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
        headline: article.data.title,
        description: article.data.summary,
        inLanguage: languageTag(article.data.locale),
        datePublished: article.data.publishedAt.toISOString(),
        dateModified: (article.data.updatedAt ?? article.data.publishedAt).toISOString(),
        author,
        publisher: { '@id': organizationId },
        articleSection: article.data.topics ?? [],
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${articleUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: breadcrumbNames.home,
            item: absolute(site, `/${article.data.locale}/`),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: breadcrumbNames.blog,
            item: absolute(site, `/${article.data.locale}/blog/`),
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: article.data.title,
          },
        ],
      },
    ],
  };
}

export function serializeStructuredData(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}
