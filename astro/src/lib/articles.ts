import { getCollection, type CollectionEntry } from 'astro:content';
import { buildEnvironment } from '../../environment.mjs';
import {
  publishedArticles,
  validateArticleCollection,
  type ArticleLocale,
} from './article-rules';

export async function getPublishedArticles(locale?: ArticleLocale): Promise<CollectionEntry<'blog'>[]> {
  return publishedArticles(await getCollection('blog'), locale);
}

export async function getPreviewArticles(locale?: ArticleLocale): Promise<CollectionEntry<'blog'>[]> {
  const environment = buildEnvironment(process.env.SITE_ENV);
  if (environment.name !== 'staging') {
    throw new Error('Draft previews are available only in the staging build.');
  }

  return validateArticleCollection(await getCollection('blog'))
    .filter((article) => !locale || article.data.locale === locale)
    .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}
