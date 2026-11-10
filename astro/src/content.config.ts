import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

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
      updatedAt: z.coerce.date().optional(),
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
      if (article.updatedAt && article.updatedAt < article.publishedAt) {
        context.addIssue({
          code: 'custom',
          path: ['updatedAt'],
          message: 'updatedAt cannot be earlier than publishedAt.',
        });
      }
    }),
});

export const collections = { blog };
