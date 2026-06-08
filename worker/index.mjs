import {
	activateLicense,
	buildSessionCookie,
	createSessionToken,
	isProtectedPath,
	parseCookies,
	sanitizeNextPath,
	validateSession,
} from './license-core.mjs';
import { D1LicenseStore } from './d1-license-store.mjs';

const SESSION_COOKIE = 'tdcs_session';

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		if (url.pathname === '/api/activate') {
			return handleActivate(request, env);
		}

		if (!isProtectedPath(url.pathname)) {
			return fetchStaticAsset(request, env);
		}

		const store = new D1LicenseStore(env.DB);
		const cookies = parseCookies(request.headers.get('cookie'));
		const hasAccess = await validateSession({
			store,
			sessionToken: cookies[SESSION_COOKIE],
			secret: env.LICENSE_HASH_SECRET,
		});

		if (hasAccess) {
			return fetchStaticAsset(request, env);
		}

		const next = encodeURIComponent(`${url.pathname}${url.search}`);
		return Response.redirect(`${url.origin}/activate?next=${next}`, 302);
	},
};

async function fetchStaticAsset(request, env) {
	if (env.ASSETS) {
		return env.ASSETS.fetch(request);
	}

	const origin = new URL(env.ORIGIN_URL);
	const requestUrl = new URL(request.url);
	const originPath = origin.pathname.replace(/\/$/, '');
	const assetPath = resolveAssetPath(requestUrl.pathname);
	const target = new URL(`${originPath}${assetPath}${requestUrl.search}`, origin);

	const response = await (env.originFetch ?? fetch)(new Request(target, request));
	return withStaticContentType(response, assetPath);
}

function resolveAssetPath(pathname) {
	if (pathname.endsWith('/')) {
		return `${pathname}index.html`;
	}

	if (!pathname.split('/').at(-1)?.includes('.')) {
		return `${pathname}/index.html`;
	}

	return pathname;
}

function withStaticContentType(response, assetPath) {
	const headers = new Headers(response.headers);
	const contentType = getContentType(assetPath);

	if (contentType) {
		headers.set('content-type', contentType);
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function getContentType(assetPath) {
	if (assetPath.endsWith('.html')) return 'text/html; charset=utf-8';
	if (assetPath.endsWith('.css')) return 'text/css; charset=utf-8';
	if (assetPath.endsWith('.js')) return 'application/javascript; charset=utf-8';
	if (assetPath.endsWith('.json')) return 'application/json; charset=utf-8';
	if (assetPath.endsWith('.svg')) return 'image/svg+xml';
	if (assetPath.endsWith('.png')) return 'image/png';
	if (assetPath.endsWith('.jpg') || assetPath.endsWith('.jpeg')) return 'image/jpeg';
	if (assetPath.endsWith('.ico')) return 'image/x-icon';
	if (assetPath.endsWith('.xml')) return 'application/xml; charset=utf-8';
	if (assetPath.endsWith('.txt')) return 'text/plain; charset=utf-8';
	return undefined;
}

async function handleActivate(request, env) {
	if (request.method !== 'POST') {
		return json({ ok: false, message: '请求方式无效。' }, { status: 405 });
	}

	const payload = await readActivationPayload(request);
	const next = sanitizeNextPath(payload.next);
	const store = new D1LicenseStore(env.DB);
	const sessionToken = createSessionToken();
	const result = await activateLicense({
		store,
		licenseKey: payload.licenseKey,
		secret: env.LICENSE_HASH_SECRET,
		sessionToken,
		userAgentHint: request.headers.get('user-agent')?.slice(0, 240) ?? '',
	});

	if (!result.ok) {
		return json(result, { status: result.code === 'device_limit_reached' ? 409 : 400 });
	}

	return json(
		{ ok: true, next },
		{
			headers: {
				'set-cookie': buildSessionCookie(SESSION_COOKIE, result.sessionToken),
			},
		},
	);
}

async function readActivationPayload(request) {
	const contentType = request.headers.get('content-type') ?? '';

	if (contentType.includes('application/json')) {
		return request.json();
	}

	const form = await request.formData();
	return {
		licenseKey: form.get('licenseKey'),
		next: form.get('next'),
	};
}

function json(body, init = {}) {
	const headers = new Headers(init.headers);
	headers.set('content-type', 'application/json; charset=utf-8');

	return new Response(JSON.stringify(body), {
		...init,
		headers,
	});
}
