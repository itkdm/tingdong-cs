import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import worker from '../worker/index.mjs';
import { hashLicenseKey } from '../worker/license-core.mjs';

describe('license access worker routes', () => {
	it('serves the public learning catalog without a session', async () => {
		const env = createEnv();
		const response = await worker.fetch(new Request('https://cs.itkdm.com/learn/'), env, {});

		assert.equal(response.status, 200);
		assert.equal(await response.text(), 'asset:/learn/');
	});

	it('can proxy public pages from an origin when no assets binding is available', async () => {
		const env = createEnv({
			ASSETS: undefined,
			ORIGIN_URL: 'https://origin.example.com',
			originFetch(request) {
				return new Response(new URL(request.url).href);
			},
		});
		const response = await worker.fetch(new Request('https://cs.itkdm.com/about/'), env, {});

		assert.equal(response.status, 200);
		assert.equal(await response.text(), 'https://origin.example.com/about/');
	});

	it('redirects protected learning detail pages to activation without a session', async () => {
		const env = createEnv();
		const response = await worker.fetch(new Request('https://cs.itkdm.com/learn/demo-lesson/'), env, {});
		const location = new URL(response.headers.get('location'));

		assert.equal(response.status, 302);
		assert.equal(location.pathname, '/activate');
		assert.equal(location.searchParams.get('next'), '/learn/demo-lesson/');
	});

	it('activates a valid license and sets a long-term HttpOnly session cookie', async () => {
		const secret = 'test-secret';
		const keyHash = await hashLicenseKey('TDCS-VALID-0001', secret);
		const env = createEnv({
			LICENSE_HASH_SECRET: secret,
			DB: new FakeD1Database({
				license: { id: 'license-1', key_hash: keyHash, status: 'active' },
				activeSessionCount: 0,
			}),
		});
		const request = new Request('https://cs.itkdm.com/api/activate', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'user-agent': 'node-test' },
			body: JSON.stringify({
				licenseKey: 'TDCS-VALID-0001',
				next: '/learn/demo-lesson/',
			}),
		});

		const response = await worker.fetch(request, env, {});
		const body = await response.json();

		assert.equal(response.status, 200);
		assert.deepEqual(body, { ok: true, next: '/learn/demo-lesson/' });
		assert.match(response.headers.get('set-cookie'), /^tdcs_session=/);
		assert.match(response.headers.get('set-cookie'), /HttpOnly/);
		assert.match(response.headers.get('set-cookie'), /Secure/);
		assert.match(response.headers.get('set-cookie'), /SameSite=Lax/);
		assert.equal(env.DB.createdSessions.length, 1);
	});
});

function createEnv(overrides = {}) {
	return {
		LICENSE_HASH_SECRET: 'test-secret',
		ASSETS: {
			fetch(request) {
				return new Response(`asset:${new URL(request.url).pathname}`);
			},
		},
		DB: new FakeD1Database(),
		...overrides,
	};
}

class FakeD1Database {
	constructor({ license = null, activeSessionCount = 0 } = {}) {
		this.license = license;
		this.activeSessionCount = activeSessionCount;
		this.createdSessions = [];
	}

	prepare(sql) {
		return new FakeD1Statement(this, sql);
	}
}

class FakeD1Statement {
	constructor(db, sql) {
		this.db = db;
		this.sql = sql;
		this.params = [];
	}

	bind(...params) {
		this.params = params;
		return this;
	}

	async first() {
		if (this.sql.includes('FROM license_keys')) {
			return this.db.license;
		}

		if (this.sql.includes('COUNT(*)')) {
			return { count: this.db.activeSessionCount };
		}

		return null;
	}

	async run() {
		if (this.sql.includes('INSERT INTO license_sessions')) {
			this.db.createdSessions.push({
				id: this.params[0],
				licenseKeyId: this.params[1],
				sessionTokenHash: this.params[2],
				userAgentHint: this.params[3],
			});
		}

		return { success: true };
	}
}
