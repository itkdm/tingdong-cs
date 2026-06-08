// worker/license-core.mjs
var DEVICE_LIMIT_MESSAGE = "\u6700\u591A\u7ED1\u5B9A\u4E09\u4E2A\u767B\u5F55\u8BBE\u5907\uFF0C\u5982\u679C\u6709\u7279\u6B8A\u9700\u8981\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u3002";
function normalizeLicenseKey(value) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}
function isProtectedPath(pathname) {
  if (!pathname.startsWith("/learn/")) {
    return false;
  }
  return pathname !== "/learn/" && pathname !== "/learn/index.html";
}
function sanitizeNextPath(value) {
  const fallback = "/learn/";
  if (typeof value !== "string" || !value.startsWith("/")) {
    return fallback;
  }
  if (value.startsWith("//") || !isProtectedPath(value)) {
    return fallback;
  }
  return value;
}
async function hashLicenseKey(licenseKey, secret) {
  return hashSecretValue(normalizeLicenseKey(licenseKey), secret);
}
async function hashSessionToken(sessionToken, secret) {
  return hashSecretValue(sessionToken, secret);
}
async function activateLicense({ store, licenseKey, secret, sessionToken, userAgentHint }) {
  const keyHash = await hashLicenseKey(licenseKey, secret);
  const license = await store.findLicenseByHash(keyHash);
  if (!license || license.status !== "active") {
    return {
      ok: false,
      code: "invalid_license",
      message: "\u5361\u5BC6\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u540E\u91CD\u65B0\u8F93\u5165\u3002"
    };
  }
  const activeSessionCount = await store.countActiveSessions(license.id);
  if (activeSessionCount >= 3) {
    return {
      ok: false,
      code: "device_limit_reached",
      message: DEVICE_LIMIT_MESSAGE
    };
  }
  const sessionTokenHash = await hashSessionToken(sessionToken, secret);
  await store.createSession({
    licenseKeyId: license.id,
    sessionTokenHash,
    userAgentHint
  });
  return {
    ok: true,
    sessionToken
  };
}
async function validateSession({ store, sessionToken, secret }) {
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
function parseCookies(cookieHeader) {
  return Object.fromEntries(
    String(cookieHeader ?? "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
      const index = part.indexOf("=");
      if (index === -1) {
        return [part, ""];
      }
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    })
  );
}
function buildSessionCookie(name, value) {
  const maxAge = 60 * 60 * 24 * 365;
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
function createSessionToken() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function hashSecretValue(value, secret) {
  const cryptoImpl = globalThis.crypto;
  const key = await cryptoImpl.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await cryptoImpl.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// worker/d1-license-store.mjs
var D1LicenseStore = class {
  constructor(db) {
    this.db = db;
  }
  async findLicenseByHash(keyHash) {
    return this.db.prepare(
      `
				SELECT id, key_hash, status
				FROM license_keys
				WHERE key_hash = ?
				LIMIT 1
			`
    ).bind(keyHash).first();
  }
  async countActiveSessions(licenseKeyId) {
    const row = await this.db.prepare(
      `
				SELECT COUNT(*) AS count
				FROM license_sessions
				WHERE license_key_id = ?
					AND revoked_at IS NULL
			`
    ).bind(licenseKeyId).first();
    return Number(row?.count ?? 0);
  }
  async createSession({ licenseKeyId, sessionTokenHash, userAgentHint }) {
    const id = crypto.randomUUID();
    await this.db.prepare(
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
			`
    ).bind(id, licenseKeyId, sessionTokenHash, userAgentHint).run();
  }
  async findActiveSessionByHash(sessionTokenHash) {
    return this.db.prepare(
      `
				SELECT license_sessions.id
				FROM license_sessions
				INNER JOIN license_keys
					ON license_keys.id = license_sessions.license_key_id
				WHERE license_sessions.session_token_hash = ?
					AND license_sessions.revoked_at IS NULL
					AND license_keys.status = 'active'
				LIMIT 1
			`
    ).bind(sessionTokenHash).first();
  }
  async touchSession(sessionId) {
    await this.db.prepare(
      `
				UPDATE license_sessions
				SET last_seen_at = datetime('now')
				WHERE id = ?
			`
    ).bind(sessionId).run();
  }
};

// worker/index.mjs
var SESSION_COOKIE = "tdcs_session";
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/activate") {
      try {
        return await handleActivate(request, env);
      } catch (error) {
        if (env.DEBUG_ACTIVATION_ERRORS === "1") {
          return json(
            {
              ok: false,
              name: error?.name,
              message: error?.message,
              stack: error?.stack?.split("\n").slice(0, 3)
            },
            { status: 500 }
          );
        }
        return json({ ok: false, message: "\u6FC0\u6D3B\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002" }, { status: 500 });
      }
    }
    if (!isProtectedPath(url.pathname)) {
      return fetchStaticAsset(request, env);
    }
    const store = new D1LicenseStore(env.DB);
    const cookies = parseCookies(request.headers.get("cookie"));
    const hasAccess = await validateSession({
      store,
      sessionToken: cookies[SESSION_COOKIE],
      secret: env.LICENSE_HASH_SECRET
    });
    if (hasAccess) {
      return fetchStaticAsset(request, env);
    }
    const next = encodeURIComponent(`${url.pathname}${url.search}`);
    return Response.redirect(`${url.origin}/activate?next=${next}`, 302);
  }
};
async function fetchStaticAsset(request, env) {
  const requestUrl = new URL(request.url);
  const assetPath = resolveAssetPath(requestUrl.pathname);
  if (env.ASSETS) {
    const assetUrl = new URL(request.url);
    assetUrl.pathname = assetPath;
    const response2 = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (response2.status !== 404 || !env.ORIGIN_URL) {
      return withStaticContentType(response2, assetPath);
    }
  }
  if (!env.ORIGIN_URL) {
    return new Response("Not Found", { status: 404 });
  }
  const origin = new URL(env.ORIGIN_URL);
  const originPath = origin.pathname.replace(/\/$/, "");
  const target = new URL(`${originPath}${assetPath}${requestUrl.search}`, origin);
  const response = await (env.originFetch ?? fetch)(new Request(target, request));
  return withStaticContentType(response, assetPath);
}
function resolveAssetPath(pathname) {
  if (pathname.endsWith("/")) {
    return `${pathname}index.html`;
  }
  if (!pathname.split("/").at(-1)?.includes(".")) {
    return `${pathname}/index.html`;
  }
  return pathname;
}
function withStaticContentType(response, assetPath) {
  const headers = new Headers(response.headers);
  const contentType = getContentType(assetPath);
  headers.delete("content-security-policy");
  headers.delete("x-frame-options");
  headers.delete("x-xss-protection");
  headers.delete("x-content-type-options");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
function getContentType(assetPath) {
  if (assetPath.endsWith(".html")) return "text/html; charset=utf-8";
  if (assetPath.endsWith(".css")) return "text/css; charset=utf-8";
  if (assetPath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (assetPath.endsWith(".json")) return "application/json; charset=utf-8";
  if (assetPath.endsWith(".svg")) return "image/svg+xml";
  if (assetPath.endsWith(".png")) return "image/png";
  if (assetPath.endsWith(".jpg") || assetPath.endsWith(".jpeg")) return "image/jpeg";
  if (assetPath.endsWith(".ico")) return "image/x-icon";
  if (assetPath.endsWith(".xml")) return "application/xml; charset=utf-8";
  if (assetPath.endsWith(".txt")) return "text/plain; charset=utf-8";
  return void 0;
}
async function handleActivate(request, env) {
  if (request.method !== "POST") {
    return json({ ok: false, message: "\u8BF7\u6C42\u65B9\u5F0F\u65E0\u6548\u3002" }, { status: 405 });
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
    userAgentHint: request.headers.get("user-agent")?.slice(0, 240) ?? ""
  });
  if (!result.ok) {
    return json(result, { status: result.code === "device_limit_reached" ? 409 : 400 });
  }
  return json(
    { ok: true, next },
    {
      headers: {
        "set-cookie": buildSessionCookie(SESSION_COOKIE, result.sessionToken)
      }
    }
  );
}
async function readActivationPayload(request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  const form = await request.formData();
  return {
    licenseKey: form.get("licenseKey"),
    next: form.get("next")
  };
}
function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), {
    ...init,
    headers
  });
}
export {
  index_default as default
};
