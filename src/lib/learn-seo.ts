import type { CollectionEntry } from 'astro:content';
import { buildAssetUrl, buildCanonicalUrl, siteName } from './seo';

type LearnEntry = CollectionEntry<'learn'>;

const defaultLearningKeywords = ['CS2 英文解说', 'CSGO 英文解说', '电竞英语', 'CS2 英语学习'];

function parseBilibiliId(embed?: string) {
	if (!embed) {
		return undefined;
	}

	const src = embed.match(/src=["']([^"']+)["']/i)?.[1] ?? embed;
	const url = new URL(src, 'https://player.bilibili.com');
	return url.searchParams.get('bvid') ?? undefined;
}

function durationToIso(duration: string) {
	const parts = duration.split(':').map(Number);

	if (parts.some((part) => Number.isNaN(part))) {
		return undefined;
	}

	const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0] ?? 0, parts[1] ?? 0];
	return `PT${hours ? `${hours}H` : ''}${minutes ? `${minutes}M` : ''}${seconds ? `${seconds}S` : ''}`;
}

export function getLearnSeo(entry: LearnEntry, slug: string) {
	const primaryKeyword = entry.data.primaryKeyword ?? entry.data.title;
	const title = entry.data.seoTitle ?? `${entry.data.title}｜CS2英文解说学习｜${siteName}`;
	const description =
		entry.data.seoDescription ??
		entry.data.summary ??
		`本期拆解「${primaryKeyword}」的真实比赛语境，包含B站视频、同步字幕、学习笔记和记忆图，适合学习 CS2 英文解说和电竞英语。`;
	const keywords = Array.from(new Set([primaryKeyword, ...entry.data.keywords, ...entry.data.tags, ...defaultLearningKeywords]));

	return {
		title,
		description,
		keywords,
		canonicalPath: `/learn/${slug}/`,
	};
}

export function getLearnJsonLd(entry: LearnEntry, slug: string) {
	const seo = getLearnSeo(entry, slug);
	const url = buildCanonicalUrl(seo.canonicalPath);
	const image = buildAssetUrl(entry.data.cover.src);
	const bilibiliId = parseBilibiliId(entry.data.videoEmbed) ?? entry.data.video?.bvid;
	const videoUrl = bilibiliId ? `https://www.bilibili.com/video/${bilibiliId}/` : url;
	const duration = durationToIso(entry.data.duration);

	const breadcrumb = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{
				'@type': 'ListItem',
				position: 1,
				name: '首页',
				item: buildCanonicalUrl('/'),
			},
			{
				'@type': 'ListItem',
				position: 2,
				name: '学习',
				item: buildCanonicalUrl('/learn/'),
			},
			{
				'@type': 'ListItem',
				position: 3,
				name: entry.data.title,
				item: url,
			},
		],
	};

	const article = {
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: entry.data.title,
		description: seo.description,
		image,
		datePublished: entry.data.date.toISOString(),
		dateModified: entry.data.date.toISOString(),
		mainEntityOfPage: url,
		keywords: seo.keywords,
		publisher: {
			'@type': 'Organization',
			name: siteName,
			url: buildCanonicalUrl('/'),
		},
	};

	const learningResource = {
		'@context': 'https://schema.org',
		'@type': 'LearningResource',
		name: entry.data.title,
		description: seo.description,
		url,
		image,
		about: seo.keywords,
		learningResourceType: ['视频学习笔记', '电竞英语学习'],
		inLanguage: ['zh-CN', 'en'],
		isPartOf: {
			'@type': 'WebSite',
			name: siteName,
			url: buildCanonicalUrl('/'),
		},
	};

	const video = {
		'@context': 'https://schema.org',
		'@type': 'VideoObject',
		name: entry.data.title,
		description: seo.description,
		thumbnailUrl: [image],
		uploadDate: entry.data.date.toISOString(),
		duration,
		contentUrl: videoUrl,
		embedUrl: entry.data.videoEmbed ? videoUrl : undefined,
	};

	return [breadcrumb, article, learningResource, video];
}
