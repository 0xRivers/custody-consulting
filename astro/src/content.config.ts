import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { topicForLocale } from './lib/topics';

const routeSegment = z
  .string()
  .trim()
  .min(3)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase URL-safe words separated by hyphens.');

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z
    .object({
      title: z.string().trim().min(8).max(100),
      summary: z.string().trim().min(30).max(240),
      keyAnswer: z.string().trim().min(40).max(360),
      locale: z.enum(['en', 'pl']),
      slug: routeSegment,
      author: z.string().trim().min(2).max(100),
      publishedAt: z.coerce.date(),
      updatedAt: z.preprocess((value) => value ?? undefined, z.coerce.date().optional()),
      draft: z.boolean().default(true),
      translationKey: routeSegment,
      topics: z.array(routeSegment).min(1).max(5),
      sources: z.array(z.object({
        label: z.string().trim().min(3).max(140),
        url: z.string().url(),
      }).strict()).min(1).max(12),
    })
    .strict()
    .superRefine((article, context) => {
      for (const [index, topic] of article.topics.entries()) {
        try { topicForLocale(topic, article.locale); }
        catch (error) {
          context.addIssue({ code: 'custom', path: ['topics', index], message: (error as Error).message });
        }
      }
      if (article.updatedAt && article.updatedAt < article.publishedAt) {
        context.addIssue({
          code: 'custom',
          path: ['updatedAt'],
          message: 'updatedAt cannot be earlier than publishedAt.',
        });
      }
    })
    .transform(article => ({
      ...article,
      topics: [...new Set(article.topics.map(topic => topicForLocale(topic, article.locale).slug))],
    })),
});

export const collections = { blog };
