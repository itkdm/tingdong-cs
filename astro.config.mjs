// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.BASE_PATH ?? (process.env.GITHUB_ACTIONS === 'true' && repositoryName ? `/${repositoryName}` : '/');
const site = process.env.SITE_URL ?? 'https://cs.itkdm.com';

export default defineConfig({
	site,
	base,
	integrations: [sitemap()],
	output: 'static',
});
