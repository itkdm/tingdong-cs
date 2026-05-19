import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const learn = defineCollection({
	loader: glob({
		base: './src/content/learn',
		pattern: '**/index.md',
	}),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			date: z.coerce.date(),
			excerpt: z.string(),
			seoTitle: z.string().optional(),
			seoDescription: z.string().optional(),
			primaryKeyword: z.string().optional(),
			summary: z.string().optional(),
			keywords: z.array(z.string()).default([]),
			tags: z.array(z.string()).default([]),
			videoEmbed: z.string().optional(),
			video: z
				.object({
					platform: z.literal('bilibili'),
					bvid: z.string().optional(),
					aid: z.string().optional(),
					cid: z.string().optional(),
					page: z.number().default(1),
				})
				.optional(),
			duration: z.string(),
			featured: z.boolean().default(false),
			published: z.boolean().default(true),
			cover: image(),
		}),
});

export const collections = { learn };
