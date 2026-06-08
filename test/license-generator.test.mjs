import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { generateLicenseKeys, makeLicenseInsertSql } from '../scripts/license-generator.mjs';

describe('license generator', () => {
	it('generates unique non-guessable formatted license keys', () => {
		const keys = generateLicenseKeys({ count: 25, prefix: 'TDCS' });

		assert.equal(keys.length, 25);
		assert.equal(new Set(keys).size, 25);
		assert.match(keys[0], /^TDCS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
	});

	it('creates SQL rows with hashes instead of plaintext keys', async () => {
		const sql = await makeLicenseInsertSql({
			keys: ['TDCS-AAAA-BBBB-CCCC-DDDD'],
			secret: 'test-secret',
		});

		assert.match(sql, /INSERT INTO license_keys/);
		assert.doesNotMatch(sql, /TDCS-AAAA-BBBB-CCCC-DDDD/);
		assert.match(sql, /[a-f0-9]{64}/);
	});
});
