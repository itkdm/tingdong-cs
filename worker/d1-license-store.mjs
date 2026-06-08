export class D1LicenseStore {
	constructor(db) {
		this.db = db;
	}

	async findLicenseByHash(keyHash) {
		return this.db
			.prepare(
				`
				SELECT id, key_hash, status
				FROM license_keys
				WHERE key_hash = ?
				LIMIT 1
			`,
			)
			.bind(keyHash)
			.first();
	}

	async countActiveSessions(licenseKeyId) {
		const row = await this.db
			.prepare(
				`
				SELECT COUNT(*) AS count
				FROM license_sessions
				WHERE license_key_id = ?
					AND revoked_at IS NULL
			`,
			)
			.bind(licenseKeyId)
			.first();

		return Number(row?.count ?? 0);
	}

	async createSession({ licenseKeyId, sessionTokenHash, userAgentHint }) {
		const id = crypto.randomUUID();

		await this.db
			.prepare(
				`
				INSERT INTO license_sessions (
					id,
					license_key_id,
					session_token_hash,
					user_agent_hint,
					created_at,
					last_seen_at
				)
				VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
			`,
			)
			.bind(id, licenseKeyId, sessionTokenHash, userAgentHint)
			.run();
	}

	async findActiveSessionByHash(sessionTokenHash) {
		return this.db
			.prepare(
				`
				SELECT license_sessions.id
				FROM license_sessions
				INNER JOIN license_keys
					ON license_keys.id = license_sessions.license_key_id
				WHERE license_sessions.session_token_hash = ?
					AND license_sessions.revoked_at IS NULL
					AND license_keys.status = 'active'
				LIMIT 1
			`,
			)
			.bind(sessionTokenHash)
			.first();
	}

	async touchSession(sessionId) {
		await this.db
			.prepare(
				`
				UPDATE license_sessions
				SET last_seen_at = datetime('now')
				WHERE id = ?
			`,
			)
			.bind(sessionId)
			.run();
	}
}
