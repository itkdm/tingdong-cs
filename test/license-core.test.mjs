import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	activateLicense,
	buildActivationLimitMessage,
	hashLicenseKey,
	isProtectedPath,
	normalizeLicenseKey,
	sanitizeNextPath,
} from '../worker/license-core.mjs';

describe('license access core', () => {
	it('normalizes license keys without making them guessable', () => {
		assert.equal(normalizeLicenseKey(' tdcs-ab12 cd34-ef56 '), 'TDCS-AB12CD34-EF56');
	});

	it('protects learning detail pages but leaves the learning catalog public', () => {
		assert.equal(isProtectedPath('/learn/'), false);
		assert.equal(isProtectedPath('/learn'), false);
		assert.equal(isProtectedPath('/learn/2026-05-19-kyxsan-falcons-response/'), true);
		assert.equal(isProtectedPath('/about/'), false);
	});

	it('only accepts safe learning detail return paths after activation', () => {
		assert.equal(sanitizeNextPath('/learn/2026-05-19-kyxsan-falcons-response/'), '/learn/2026-05-19-kyxsan-falcons-response/');
		assert.equal(sanitizeNextPath('https://example.com/learn/2026-05-19-kyxsan-falcons-response/'), '/learn/');
		assert.equal(sanitizeNextPath('/about/'), '/learn/');
		assert.equal(sanitizeNextPath('/learn/'), '/learn/');
	});

	it('uses the confirmed device limit copy', () => {
		assert.equal(buildActivationLimitMessage(), '最多绑定三个登录设备，如果有特殊需要，请联系管理员。');
	});

	it('hashes normalized license keys with the configured secret', async () => {
		const first = await hashLicenseKey(' tdcs-ab12 ', 'secret-a');
		const second = await hashLicenseKey('TDCS-AB12', 'secret-a');
		const otherSecret = await hashLicenseKey('TDCS-AB12', 'secret-b');

		assert.equal(first, second);
		assert.notEqual(first, otherSecret);
		assert.match(first, /^[a-f0-9]{64}$/);
	});

	it('creates a long-term session for a valid active license', async () => {
		const store = new FakeLicenseStore({
			license: { id: 'license-1', status: 'active' },
			activeSessionCount: 0,
		});

		const result = await activateLicense({
			store,
			licenseKey: 'TDCS-AB12',
			secret: 'secret-a',
			sessionToken: 'session-token',
			userAgentHint: 'node-test',
		});

		assert.equal(result.ok, true);
		assert.equal(result.sessionToken, 'session-token');
		assert.equal(store.createdSessions.length, 1);
		assert.equal(store.createdSessions[0].licenseKeyId, 'license-1');
		assert.match(store.createdSessions[0].sessionTokenHash, /^[a-f0-9]{64}$/);
	});

	it('rejects the fourth login device with the confirmed user-facing message', async () => {
		const store = new FakeLicenseStore({
			license: { id: 'license-1', status: 'active' },
			activeSessionCount: 3,
		});

		const result = await activateLicense({
			store,
			licenseKey: 'TDCS-AB12',
			secret: 'secret-a',
			sessionToken: 'session-token',
			userAgentHint: 'node-test',
		});

		assert.deepEqual(result, {
			ok: false,
			code: 'device_limit_reached',
			message: '最多绑定三个登录设备，如果有特殊需要，请联系管理员。',
		});
		assert.equal(store.createdSessions.length, 0);
	});

	it('does not reveal whether an invalid key is close to a real key', async () => {
		const store = new FakeLicenseStore({ license: null, activeSessionCount: 0 });

		const result = await activateLicense({
			store,
			licenseKey: 'TDCS-NOPE',
			secret: 'secret-a',
			sessionToken: 'session-token',
			userAgentHint: 'node-test',
		});

		assert.deepEqual(result, {
			ok: false,
			code: 'invalid_license',
			message: '卡密无效，请检查后重新输入。',
		});
		assert.equal(store.createdSessions.length, 0);
	});
});

class FakeLicenseStore {
	constructor({ license, activeSessionCount }) {
		this.license = license;
		this.activeSessionCount = activeSessionCount;
		this.createdSessions = [];
	}

	async findLicenseByHash() {
		return this.license;
	}

	async countActiveSessions() {
		return this.activeSessionCount;
	}

	async createSession(session) {
		this.createdSessions.push(session);
	}
}
