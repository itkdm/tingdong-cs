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

function fetchStaticAsset(request, env) {
	if (env.ASSETS) {
		return env.ASSETS.fetch(request);
	}

	const target = new URL(request.url);
	const origin = new URL(env.ORIGIN_URL);
	target.protocol = origin.protocol;
	target.hostname = origin.hostname;
	target.port = origin.port;

	return (env.originFetch ?? fetch)(new Request(target, request));
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
