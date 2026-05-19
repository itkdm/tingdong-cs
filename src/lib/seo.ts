export const siteName = '听懂CS';
export const defaultSeoImage = '/images/hero-bg.png';

const fallbackSiteUrl = 'https://cs.itkdm.com';

function getSiteUrl() {
	return new URL(import.meta.env.SITE ?? fallbackSiteUrl);
}

function normalizePath(pathname = '/') {
	if (/^https?:\/\//.test(pathname)) {
		return new URL(pathname).pathname;
	}

	const pathWithSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
	return pathWithSlash.replace(/\/index\.html$/, '/');
}

export function buildCanonicalUrl(pathname = '/') {
	const url = new URL(normalizePath(pathname), getSiteUrl());
	url.search = '';
	url.hash = '';
	return url.toString();
}

export function buildAssetUrl(pathname = defaultSeoImage) {
	if (/^https?:\/\//.test(pathname)) {
		return pathname;
	}

	const base = import.meta.env.BASE_URL ?? '/';
	const assetPath = `${base}${pathname.replace(/^\//, '')}`;
	return new URL(assetPath, getSiteUrl()).toString();
}
