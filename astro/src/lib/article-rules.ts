export type ArticleLocale = 'en' | 'pl';

export interface ArticleLike {
  id: string;
  data: {
    locale: ArticleLocale;
    slug: string;
    translationKey: string;
    draft: boolean;
    publishedAt: Date;
    updatedAt?: Date;
    topics?: string[];
  };
}

export const ARTICLES_PER_PAGE = 6;

export function articlePath(article: ArticleLike): string {
  return `/${article.data.locale}/blog/${article.data.slug}/`;
}

export function validateArticleCollection<T extends ArticleLike>(articles: T[]): T[] {
  const routes = new Map<string, string>();
  const translations = new Map<string, string>();

  for (const article of articles) {
    const route = articlePath(article);
    const previousRoute = routes.get(route);
    if (previousRoute) {
      throw new Error(`Duplicate article URL ${route}: ${previousRoute} and ${article.id}`);
    }
    routes.set(route, article.id);

    const translation = `${article.data.translationKey}:${article.data.locale}`;
    const previousTranslation = translations.get(translation);
    if (previousTranslation) {
      throw new Error(
        `Duplicate ${article.data.locale} translation for ${article.data.translationKey}: ${previousTranslation} and ${article.id}`,
      );
    }
    translations.set(translation, article.id);

    if (Number.isNaN(article.data.publishedAt.getTime())) {
      throw new Error(`Invalid publishedAt date in ${article.id}`);
    }
    if (article.data.updatedAt && article.data.updatedAt < article.data.publishedAt) {
      throw new Error(`updatedAt precedes publishedAt in ${article.id}`);
    }
  }

  return articles;
}

export function publishedArticles<T extends ArticleLike>(articles: T[], locale?: ArticleLocale): T[] {
  return validateArticleCollection(articles)
    .filter((article) => !article.data.draft && (!locale || article.data.locale === locale))
    .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}

export function paginateArticles<T>(articles: T[], page: number, pageSize = ARTICLES_PER_PAGE) {
  if (!Number.isInteger(page) || page < 1) throw new Error(`Invalid page number: ${page}`);
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error(`Invalid page size: ${pageSize}`);
  const totalPages = Math.max(1, Math.ceil(articles.length / pageSize));
  if (page > totalPages) throw new Error(`Page ${page} exceeds ${totalPages}`);
  const start = (page - 1) * pageSize;
  return { items: articles.slice(start, start + pageSize), page, totalPages };
}

export function articleTopics<T extends ArticleLike>(articles: T[]): string[] {
  return [...new Set(articles.flatMap((article) => article.data.topics ?? []))].sort();
}
