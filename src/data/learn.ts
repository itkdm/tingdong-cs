import { getCollection } from 'astro:content';
import type { ImageMetadata } from 'astro';

export type LearnCardItem = {
	slug: string;
	title: string;
	date: string;
	cover: ImageMetadata;
};

export type LearnNavItem = {
	slug: string;
	title: string;
	date: Date;
	keywords: string[];
	tags: string[];
};

function formatCardDate(date: Date) {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${month}-${day}`;
}

export async function getLearnCardItems(): Promise<LearnCardItem[]> {
	const entries = await getCollection('learn', ({ data }) => data.published);

	return entries
		.sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
		.map((entry) => ({
			slug: entry.id.replace(/\/index$/, ''),
			title: entry.data.title,
			date: formatCardDate(entry.data.date),
			cover: entry.data.cover,
		}));
}

export async function getLearnNavItems(): Promise<LearnNavItem[]> {
	const entries = await getCollection('learn', ({ data }) => data.published);

	return entries
		.sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
		.map((entry) => ({
			slug: entry.id.replace(/\/index$/, ''),
			title: entry.data.title,
			date: entry.data.date,
			keywords: [entry.data.primaryKeyword, ...entry.data.keywords].filter(Boolean) as string[],
			tags: entry.data.tags,
		}));
}

export function getAdjacentLearnItems(items: LearnNavItem[], slug: string) {
	const index = items.findIndex((item) => item.slug === slug);

	return {
		previous: index >= 0 ? items[index + 1] : undefined,
		next: index > 0 ? items[index - 1] : undefined,
	};
}

export function getRelatedLearnItems(items: LearnNavItem[], slug: string, limit = 3) {
	const current = items.find((item) => item.slug === slug);

	if (!current) {
		return [];
	}

	const currentTerms = new Set([...current.keywords, ...current.tags]);

	return items
		.filter((item) => item.slug !== slug)
		.map((item) => ({
			item,
			score: [...item.keywords, ...item.tags].filter((term) => currentTerms.has(term)).length,
		}))
		.sort((a, b) => b.score - a.score || b.item.date.getTime() - a.item.date.getTime())
		.slice(0, limit)
		.map(({ item }) => item);
}
