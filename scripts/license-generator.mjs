import { writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

import { hashLicenseKey } from '../worker/license-core.mjs';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateLicenseKeys({ count, prefix = 'TDCS' }) {
	const keys = new Set();

	while (keys.size < count) {
		keys.add(`${prefix}-${randomGroup()}-${randomGroup()}-${randomGroup()}-${randomGroup()}`);
	}

	return [...keys];
}

export async function makeLicenseInsertSql({ keys, secret }) {
	const values = [];

	for (const key of keys) {
		const id = crypto.randomUUID();
		const hash = await hashLicenseKey(key, secret);
		values.push(`('${escapeSql(id)}', '${escapeSql(hash)}', 'active', datetime('now'))`);
	}

	return [
		'INSERT INTO license_keys (id, key_hash, status, created_at)',
		'VALUES',
		`${values.join(',\n')};`,
		'',
	].join('\n');
}

function randomGroup() {
	const bytes = randomBytes(4);
	return [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

function escapeSql(value) {
	return String(value).replaceAll("'", "''");
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const count = Number(args.count ?? 10);
	const secret = args.secret ?? process.env.LICENSE_HASH_SECRET;
	const out = args.out ?? 'license-keys';

	if (!Number.isInteger(count) || count < 1 || count > 1000) {
		throw new Error('Use --count with a number between 1 and 1000.');
	}

	if (!secret || secret.length < 16) {
		throw new Error('Provide --secret or LICENSE_HASH_SECRET with at least 16 characters.');
	}

	const keys = generateLicenseKeys({ count, prefix: args.prefix ?? 'TDCS' });
	const sql = await makeLicenseInsertSql({ keys, secret });

	await writeFile(`${out}.txt`, `${keys.join('\n')}\n`, 'utf8');
	await writeFile(`${out}.sql`, sql, 'utf8');

	console.log(`Generated ${keys.length} license keys.`);
	console.log(`Plaintext keys: ${out}.txt`);
	console.log(`D1 insert SQL: ${out}.sql`);
}

function parseArgs(args) {
	const parsed = {};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];

		if (!arg.startsWith('--')) {
			continue;
		}

		const key = arg.slice(2);
		const next = args[index + 1];
		parsed[key] = next && !next.startsWith('--') ? next : true;

		if (parsed[key] === next) {
			index += 1;
		}
	}

	return parsed;
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
	main().catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
}
