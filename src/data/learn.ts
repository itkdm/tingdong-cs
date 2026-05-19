import { getCollection } from 'astro:content';
import type { ImageMetadata } from 'astro';

export type LearnCardItem = {
	slug: string;
	title: string;
	date: string;
	cover: ImageMetadata;
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
