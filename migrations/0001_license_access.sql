CREATE TABLE IF NOT EXISTS license_keys (
	id TEXT PRIMARY KEY,
	key_hash TEXT NOT NULL UNIQUE,
	status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	disabled_at TEXT,
	notes TEXT
);

CREATE TABLE IF NOT EXISTS license_sessions (
	id TEXT PRIMARY KEY,
	license_key_id TEXT NOT NULL,
	session_token_hash TEXT NOT NULL UNIQUE,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
	revoked_at TEXT,
	user_agent_hint TEXT,
	FOREIGN KEY (license_key_id) REFERENCES license_keys(id)
);

CREATE TABLE IF NOT EXISTS activation_attempts (
	id TEXT PRIMARY KEY,
	key_hash_prefix TEXT,
	ip_hash TEXT,
	result TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_license_keys_key_hash ON license_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_license_sessions_license_key_id ON license_sessions(license_key_id);
CREATE INDEX IF NOT EXISTS idx_license_sessions_token_hash ON license_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_activation_attempts_created_at ON activation_attempts(created_at);
