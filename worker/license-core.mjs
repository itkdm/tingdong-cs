export const DEVICE_LIMIT_MESSAGE = '最多绑定三个登录设备，如果有特殊需要，请联系管理员。';

export function normalizeLicenseKey(value) {
	return String(value ?? '')
		.trim()
		.toUpperCase()
		.replace(/\s+/g, '');
}

export function isProtectedPath(pathname) {
	if (!pathname.startsWith('/learn/')) {
		return false;
	}

	return pathname !== '/learn/';
}

export function sanitizeNextPath(value) {
	const fallback = '/learn/';

	if (typeof value !== 'string' || !value.startsWith('/')) {
		return fallback;
	}

	if (value.startsWith('//') || !isProtectedPath(value)) {
		return fallback;
	}

	return value;
}

export function buildActivationLimitMessage() {
	return DEVICE_LIMIT_MESSAGE;
}

export async function hashLicenseKey(licenseKey, secret) {
	return hashSecretValue(normalizeLicenseKey(licenseKey), secret);
}

export async function hashSessionToken(sessionToken, secret) {
	return hashSecretValue(sessionToken, secret);
}

export async function activateLicense({ store, licenseKey, secret, sessionToken, userAgentHint }) {
	const keyHash = await hashLicenseKey(licenseKey, secret);
	const license = await store.findLicenseByHash(keyHash);

	if (!license || license.status !== 'active') {
		return {
			ok: false,
			code: 'invalid_license',
			message: '卡密无效，请检查后重新输入。',
		};
	}

	const activeSessionCount = await store.countActiveSessions(license.id);

	if (activeSessionCount >= 3) {
		return {
			ok: false,
			code: 'device_limit_reached',
			message: DEVICE_LIMIT_MESSAGE,
		};
	}

	const sessionTokenHash = await hashSessionToken(sessionToken, secret);

	await store.createSession({
		licenseKeyId: license.id,
		sessionTokenHash,
		userAgentHint,
	});

	return {
		ok: true,
		sessionToken,
	};
}

export async function validateSession({ store, sessionToken, secret }) {
	if (!sessionToken) {
		return false;
	}

	const sessionTokenHash = await hashSessionToken(sessionToken, secret);
	const session = await store.findActiveSessionByHash(sessionTokenHash);

	if (!session) {
		return false;
	}

	await store.touchSession(session.id);
	return true;
}

export function parseCookies(cookieHeader) {
	return Object.fromEntries(
		String(cookieHeader ?? '')
			.split(';')
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part) => {
				const index = part.indexOf('=');
				if (index === -1) {
					return [part, ''];
				}

				return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
			}),
	);
}

export function buildSessionCookie(name, value) {
	const maxAge = 60 * 60 * 24 * 365;
	return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function createSessionToken() {
	const bytes = new Uint8Array(32);
	globalThis.crypto.getRandomValues(bytes);
	return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashSecretValue(value, secret) {
	const cryptoImpl = globalThis.crypto;
	const key = await cryptoImpl.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const signature = await cryptoImpl.subtle.sign('HMAC', key, new TextEncoder().encode(value));

	return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
