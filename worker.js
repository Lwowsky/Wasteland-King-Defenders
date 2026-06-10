const MAX_MESSAGE_LENGTH = 2000;
const MAX_FIELD_LENGTH = 300;
const MAX_TABLE_ROWS = 1000;
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let firebaseJwksCache = { expiresAt: 0, keys: null };
let googleAccessTokenCache = { expiresAt: 0, token: "" };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-WKD-Region-Table-Secret, X-WKD-Stats-Secret",
  "Access-Control-Max-Age": "86400",
};

function json(data, status = 200, cache = "no-store") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cache,
      ...CORS_HEADERS,
    },
  });
}

function clean(value, max = MAX_FIELD_LENGTH) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeRegion(value) {
  return clean(value, 20)
    .replace(/[^0-9]/g, "")
    .slice(0, 8);
}

function normalizeCode(value) {
  return clean(value, 160)
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 140);
}

function normalizeCycleId(value) {
  return (
    clean(value || "active", 90)
      .replace(/[^A-Za-z0-9._:-]/g, "-")
      .slice(0, 90) || "active"
  );
}

function numberValue(value) {
  const num = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
}

function normalizeTelegramContact(value) {
  const text = clean(value, 120);
  return text || "Не вказано";
}

function regionTableDb(env) {
  return env.REGION_TABLE_DB || env.DB || null;
}

let d1SchemaReadyPromise = null;
async function ensureRegionTableSchema(db) {
  if (!db) throw new Error("d1_not_configured");
  if (d1SchemaReadyPromise) return d1SchemaReadyPromise;
  d1SchemaReadyPromise = (async () => {
    const statements = [
      `CREATE TABLE IF NOT EXISTS region_tables (
        region TEXT NOT NULL,
        cycle_id TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 0,
        updated_at_ms INTEGER NOT NULL DEFAULT 0,
        settings_json TEXT NOT NULL DEFAULT '{}',
        rows_json TEXT NOT NULL DEFAULT '[]',
        PRIMARY KEY (region, cycle_id)
      )`,
      `CREATE TABLE IF NOT EXISTS region_active (
        region TEXT PRIMARY KEY,
        cycle_id TEXT NOT NULL DEFAULT 'active',
        version INTEGER NOT NULL DEFAULT 0,
        updated_at_ms INTEGER NOT NULL DEFAULT 0,
        rows_count INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS region_access (
        region TEXT NOT NULL,
        uid TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        updated_at_ms INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (region, uid)
      )`,
      `CREATE TABLE IF NOT EXISTS region_table_shares (
        code TEXT PRIMARY KEY,
        region TEXT NOT NULL,
        cycle_id TEXT NOT NULL DEFAULT 'active',
        access TEXT NOT NULL DEFAULT 'view',
        expires_at_ms INTEGER NOT NULL DEFAULT 0,
        created_at_ms INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL DEFAULT '',
        revoked INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS idx_region_access_uid ON region_access(uid)`,
      `CREATE INDEX IF NOT EXISTS idx_region_table_shares_region ON region_table_shares(region)`,
      `CREATE INDEX IF NOT EXISTS idx_region_tables_updated ON region_tables(updated_at_ms)`,
      `CREATE INDEX IF NOT EXISTS idx_region_table_shares_expires ON region_table_shares(expires_at_ms)`,
      `CREATE TABLE IF NOT EXISTS public_stats_pages (
        bucket INTEGER PRIMARY KEY,
        updated_at_ms INTEGER NOT NULL DEFAULT 0,
        players_json TEXT NOT NULL DEFAULT '[]'
      )`,
      `CREATE TABLE IF NOT EXISTS public_stats_meta (
        id TEXT PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 0,
        updated_at_ms INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'cloudflare-d1'
      )`,
      `CREATE TABLE IF NOT EXISTS action_logs (
        id TEXT PRIMARY KEY,
        region TEXT NOT NULL,
        action TEXT NOT NULL DEFAULT '',
        actor_uid TEXT NOT NULL DEFAULT '',
        actor_name TEXT NOT NULL DEFAULT '',
        actor_alliance TEXT NOT NULL DEFAULT '',
        actor_role TEXT NOT NULL DEFAULT '',
        alliance TEXT NOT NULL DEFAULT '',
        target_uid TEXT NOT NULL DEFAULT '',
        target_name TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        details_json TEXT NOT NULL DEFAULT '{}',
        created_at_ms INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS idx_action_logs_region_time ON action_logs(region, created_at_ms DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_action_logs_region_alliance_time ON action_logs(region, alliance, created_at_ms DESC)`,
      `CREATE TABLE IF NOT EXISTS user_notifications (
        id TEXT PRIMARY KEY,
        uid TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'notice',
        title TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '',
        region TEXT NOT NULL DEFAULT '',
        alliance TEXT NOT NULL DEFAULT '',
        actor_uid TEXT NOT NULL DEFAULT '',
        actor_name TEXT NOT NULL DEFAULT '',
        actor_role TEXT NOT NULL DEFAULT '',
        actor_role_text TEXT NOT NULL DEFAULT '',
        actor_photo_url TEXT NOT NULL DEFAULT '',
        target_type TEXT NOT NULL DEFAULT 'player',
        target_label TEXT NOT NULL DEFAULT '',
        reply_to_id TEXT NOT NULL DEFAULT '',
        reply_to_title TEXT NOT NULL DEFAULT '',
        reply_to_actor_name TEXT NOT NULL DEFAULT '',
        reply_to_created_at_ms INTEGER NOT NULL DEFAULT 0,
        created_at_ms INTEGER NOT NULL DEFAULT 0,
        read_at_ms INTEGER NOT NULL DEFAULT 0,
        unread INTEGER NOT NULL DEFAULT 1,
        archived INTEGER NOT NULL DEFAULT 0,
        deleted INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS idx_user_notifications_uid_time ON user_notifications(uid, created_at_ms DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_user_notifications_uid_unread_time ON user_notifications(uid, unread, created_at_ms DESC)`,
      `CREATE TABLE IF NOT EXISTS user_notification_summary (
        uid TEXT PRIMARY KEY,
        unread_total INTEGER NOT NULL DEFAULT 0,
        campaign_seen_at_ms INTEGER NOT NULL DEFAULT 0,
        last_title TEXT NOT NULL DEFAULT '',
        last_message TEXT NOT NULL DEFAULT '',
        last_region TEXT NOT NULL DEFAULT '',
        last_alliance TEXT NOT NULL DEFAULT '',
        last_actor_uid TEXT NOT NULL DEFAULT '',
        last_actor_name TEXT NOT NULL DEFAULT '',
        last_actor_role TEXT NOT NULL DEFAULT '',
        last_target_type TEXT NOT NULL DEFAULT '',
        last_notification_at_ms INTEGER NOT NULL DEFAULT 0,
        updated_at_ms INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS user_sent_messages (
        id TEXT PRIMARY KEY,
        uid TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'sent_message',
        title TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '',
        region TEXT NOT NULL DEFAULT '',
        alliance TEXT NOT NULL DEFAULT '',
        target_type TEXT NOT NULL DEFAULT 'player',
        target_label TEXT NOT NULL DEFAULT '',
        recipient_count INTEGER NOT NULL DEFAULT 0,
        recipient_preview TEXT NOT NULL DEFAULT '',
        reply_to_id TEXT NOT NULL DEFAULT '',
        reply_to_title TEXT NOT NULL DEFAULT '',
        reply_to_actor_name TEXT NOT NULL DEFAULT '',
        reply_to_created_at_ms INTEGER NOT NULL DEFAULT 0,
        created_at_ms INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        deleted INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS idx_user_sent_messages_uid_time ON user_sent_messages(uid, created_at_ms DESC)`,
      `CREATE TABLE IF NOT EXISTS notification_campaigns (
        id TEXT PRIMARY KEY,
        region TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'region_campaign',
        source TEXT NOT NULL DEFAULT 'region-campaign',
        cycle_id TEXT NOT NULL DEFAULT '',
        actor_uid TEXT NOT NULL DEFAULT '',
        actor_name TEXT NOT NULL DEFAULT '',
        actor_role TEXT NOT NULL DEFAULT '',
        actor_role_text TEXT NOT NULL DEFAULT '',
        target_type TEXT NOT NULL DEFAULT 'region',
        target_label TEXT NOT NULL DEFAULT '',
        alliance TEXT NOT NULL DEFAULT '',
        campaign_group_id TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '',
        title_key TEXT NOT NULL DEFAULT '',
        message_key TEXT NOT NULL DEFAULT '',
        created_at_ms INTEGER NOT NULL DEFAULT 0,
        expires_at_ms INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS idx_notification_campaigns_region_time ON notification_campaigns(region, created_at_ms DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_notification_campaigns_region_target_time ON notification_campaigns(region, target_type, alliance, created_at_ms DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_notification_campaigns_expires ON notification_campaigns(expires_at_ms)`,
    ];
    for (const statement of statements) {
      await db.prepare(statement).run();
    }
  })();
  return d1SchemaReadyPromise;
}

function adminUids(env) {
  return new Set(
    clean(env.REGION_TABLE_ADMIN_UIDS || "", 5000)
      .split(",")
      .map((item) => clean(item, 160))
      .filter(Boolean),
  );
}

function isAdminUid(env, uid = "") {
  const admins = adminUids(env);
  return Boolean(uid && admins.has(uid));
}

function sanitizeSettings(settings = {}) {
  return {
    open: Boolean(settings.open),
    enabled: Boolean(settings.enabled),
    currentCycleId: normalizeCycleId(settings.currentCycleId || "active"),
    closeAtMs: Number(settings.closeAtMs) || 0,
    eventStartAtMs: Number(settings.eventStartAtMs || settings.startAtMs) || 0,
    openedAtMs: Number(settings.openedAtMs || settings.startedAtMs) || 0,
    openedByName: clean(
      settings.openedByName || settings.startedByName || "",
      120,
    ),
    openedByEmail: clean(
      settings.openedByEmail || settings.startedByEmail || "",
      160,
    ),
    openedByUid: clean(
      settings.openedByUid || settings.startedByUid || "",
      160,
    ),
    shifts: Array.isArray(settings.shifts)
      ? settings.shifts
          .map((item) => clean(item, 40))
          .filter(Boolean)
          .slice(0, 12)
      : [],
    customShifts: Array.isArray(settings.customShifts)
      ? settings.customShifts.slice(0, 20)
      : [],
    customTroopTypes: Array.isArray(settings.customTroopTypes)
      ? settings.customTroopTypes.slice(0, 20)
      : [],
  };
}

function sanitizeTableRow(row = {}) {
  const id = clean(
    row.id || row.uid || row.publicKey || row.nickname || crypto.randomUUID(),
    180,
  );
  return {
    id,
    uid: clean(row.uid || "", 160),
    publicKey: clean(row.publicKey || "", 160),
    farmId: clean(row.farmId || "", 80),
    nickname: clean(row.nickname || row.name || row.gameNick || "", 80),
    region: normalizeRegion(row.region),
    alliance: clean(row.alliance || "", 12).toUpperCase(),
    rank: clean(row.rank || "", 16).toLowerCase(),
    shk: clean(row.shk || "", 12),
    role: clean(row.role || "player", 40).toLowerCase(),
    roleLabel: clean(row.roleLabel || "", 80),
    troopType: clean(row.troopType || "", 40),
    troopLabel: clean(row.troopLabel || "", 80),
    tier: clean(row.tier || "", 12).toUpperCase(),
    lairLevel: numberValue(row.lairLevel),
    marchSize: numberValue(row.marchSize),
    rallySize: numberValue(row.rallySize),
    captainReady: Boolean(row.captainReady),
    readyToJoin: Boolean(row.readyToJoin),
    readyToAttack: Boolean(row.readyToAttack),
    shift: clean(row.shift || "", 40),
    shiftLabel: clean(row.shiftLabel || "", 80),
    comment: clean(row.comment || "", 300),
    extraEnabled: Boolean(row.extraEnabled || (Array.isArray(row.extraSquads) && row.extraSquads.length)),
    extraSquads: Array.isArray(row.extraSquads) ? row.extraSquads.slice(0, 8) : [],
    extraTroopType: clean(row.extraTroopType || "", 40),
    extraTier: clean(row.extraTier || "", 12).toUpperCase(),
    customFields:
      row.customFields && typeof row.customFields === "object" && !Array.isArray(row.customFields)
        ? row.customFields
        : {},
    source: clean(row.source || "registration", 40),
    rowType: clean(row.rowType || "", 80),
    updatedAtMs: Number(row.updatedAtMs) || Date.now(),
  };
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function rowToTable(row = {}) {
  if (!row) return null;
  const rows = parseJson(row.rows_json, []);
  const settings = parseJson(row.settings_json, {});
  return {
    region: normalizeRegion(row.region),
    cycleId: normalizeCycleId(row.cycle_id || "active"),
    version: Number(row.version) || 0,
    updatedAtMs: Number(row.updated_at_ms) || 0,
    settings: sanitizeSettings(settings),
    rows: Array.isArray(rows)
      ? rows
          .map(sanitizeTableRow)
          .filter((item) => item.nickname)
          .slice(0, MAX_TABLE_ROWS)
      : [],
  };
}

async function readTable(db, region, cycleId = "active") {
  await ensureRegionTableSchema(db);
  const row = await db
    .prepare(
      `SELECT region, cycle_id, version, updated_at_ms, settings_json, rows_json
       FROM region_tables
      WHERE region = ?1 AND cycle_id = ?2`,
    )
    .bind(region, normalizeCycleId(cycleId))
    .first();
  return rowToTable(row);
}

async function getActiveTable(db, region) {
  await ensureRegionTableSchema(db);
  const active = await db
    .prepare(`SELECT cycle_id FROM region_active WHERE region = ?1`)
    .bind(region)
    .first();
  const cycleId = normalizeCycleId(active?.cycle_id || "active");
  return readTable(db, region, cycleId);
}

async function saveTable(db, table) {
  await ensureRegionTableSchema(db);
  const region = normalizeRegion(table.region);
  const cycleId = normalizeCycleId(
    table.cycleId || table.settings?.currentCycleId || "active",
  );
  const rows = (Array.isArray(table.rows) ? table.rows : [])
    .map(sanitizeTableRow)
    .filter((row) => row.nickname)
    .slice(0, MAX_TABLE_ROWS);
  const version =
    Number(table.version) > 0 ? Number(table.version) : Date.now();
  const updatedAtMs = Date.now();
  const settings = sanitizeSettings({
    ...(table.settings || {}),
    currentCycleId: cycleId,
  });
  const settingsJson = JSON.stringify(settings);
  const rowsJson = JSON.stringify(rows);

  await db.batch([
    db
      .prepare(
        `INSERT INTO region_tables (region, cycle_id, version, updated_at_ms, settings_json, rows_json)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(region, cycle_id) DO UPDATE SET
         version = excluded.version,
         updated_at_ms = excluded.updated_at_ms,
         settings_json = excluded.settings_json,
         rows_json = excluded.rows_json`,
      )
      .bind(region, cycleId, version, updatedAtMs, settingsJson, rowsJson),
    db
      .prepare(
        `INSERT INTO region_active (region, cycle_id, version, updated_at_ms, rows_count)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(region) DO UPDATE SET
         cycle_id = excluded.cycle_id,
         version = excluded.version,
         updated_at_ms = excluded.updated_at_ms,
         rows_count = excluded.rows_count`,
      )
      .bind(region, cycleId, version, updatedAtMs, rows.length),
  ]);

  return { region, cycleId, version, updatedAtMs, settings, rows };
}

async function hasSavedRegionAccess(db, uid, region) {
  if (!uid || !region) return false;
  await ensureRegionTableSchema(db);
  const access = await db
    .prepare(
      `SELECT uid FROM region_access WHERE region = ?1 AND uid = ?2 LIMIT 1`,
    )
    .bind(region, uid)
    .first();
  return Boolean(access?.uid);
}

async function grantRegionAccess(db, region, uid, source = "registration") {
  if (!region || !uid) return;
  await ensureRegionTableSchema(db);
  await db
    .prepare(
      `INSERT INTO region_access (region, uid, source, updated_at_ms)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(region, uid) DO UPDATE SET
       source = excluded.source,
       updated_at_ms = excluded.updated_at_ms`,
    )
    .bind(region, uid, clean(source, 40), Date.now())
    .run();
}

function tableContainsUid(table, uid = "") {
  if (!uid || !Array.isArray(table?.rows)) return false;
  return table.rows.some((row) => clean(row.uid, 160) === uid);
}

function base64UrlToBytes(value = "") {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function base64UrlToJson(value = "") {
  const bytes = base64UrlToBytes(value);
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function getFirebaseJwks() {
  const now = Date.now();

  if (firebaseJwksCache.keys && firebaseJwksCache.expiresAt > now) {
    return firebaseJwksCache.keys;
  }

  const response = await fetch(FIREBASE_JWKS_URL, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("firebase_jwks_failed");
  }

  const data = await response.json();

  const keys = Array.isArray(data.keys)
    ? data.keys
    : Object.entries(data || {}).map(([kid, jwk]) => ({
        ...(jwk || {}),
        kid: jwk?.kid || kid,
      }));

  const cacheControl = response.headers.get("Cache-Control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 60 * 60 * 1000;

  firebaseJwksCache = {
    expiresAt: now + Math.max(5 * 60 * 1000, maxAgeMs),
    keys,
  };

  return keys;
}

async function verifyFirebaseToken(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new Error("auth_required");
  }

  const token = match[1];
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("bad_token");
  }

  let header;
  let payload;

  try {
    header = base64UrlToJson(parts[0]);
    payload = base64UrlToJson(parts[1]);
  } catch {
    throw new Error("bad_token_payload");
  }

  const projectId = clean(env.FIREBASE_PROJECT_ID || "", 160);

  if (!projectId) {
    throw new Error("firebase_project_not_configured");
  }

  if (header?.alg !== "RS256") {
    throw new Error("bad_token_alg");
  }

  if (!header?.kid) {
    throw new Error("bad_token_kid");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (!payload?.sub || String(payload.sub).length > 128) {
    throw new Error("bad_token_subject");
  }

  if (payload.aud !== projectId) {
    throw new Error("wrong_firebase_project");
  }

  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("wrong_firebase_issuer");
  }

  if (Number(payload.exp || 0) <= nowSeconds) {
    throw new Error("token_expired");
  }

  if (payload.iat && Number(payload.iat) > nowSeconds + 300) {
    throw new Error("token_from_future");
  }

  const keys = await getFirebaseJwks();
  const jwk = keys.find((item) => item?.kid === header.kid);

  if (!jwk) {
    firebaseJwksCache = { expiresAt: 0, keys: null };
    throw new Error("firebase_key_not_found");
  }

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlToBytes(parts[2]);

  const isValid = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    publicKey,
    signature,
    signedData,
  );

  if (!isValid) {
    throw new Error("token_signature_invalid");
  }

  return {
    uid: clean(payload.user_id || payload.sub, 160),
    email: clean(payload.email || "", 160),
    name: clean(payload.name || "", 160),
  };
}

async function optionalFirebaseToken(request, env) {
  try {
    return await verifyFirebaseToken(request, env);
  } catch (error) {
    if (String(error?.message || '').includes('auth_required')) return null;
    throw error;
  }
}

function normalizedNickname(value = "") {
  return clean(value, 120).toLowerCase().replace(/\s+/g, "");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function comparableRegistrationRow(row = {}) {
  const cleanRow = sanitizeTableRow(row);
  return {
    uid: cleanRow.uid,
    publicKey: cleanRow.publicKey,
    farmId: cleanRow.farmId,
    nickname: cleanRow.nickname,
    region: cleanRow.region,
    alliance: cleanRow.alliance,
    rank: cleanRow.rank,
    shk: cleanRow.shk,
    role: cleanRow.role,
    roleLabel: cleanRow.roleLabel,
    troopType: cleanRow.troopType,
    troopLabel: cleanRow.troopLabel,
    tier: cleanRow.tier,
    lairLevel: cleanRow.lairLevel,
    marchSize: cleanRow.marchSize,
    rallySize: cleanRow.rallySize,
    captainReady: cleanRow.captainReady,
    readyToJoin: cleanRow.readyToJoin,
    readyToAttack: cleanRow.readyToAttack,
    shift: cleanRow.shift,
    shiftLabel: cleanRow.shiftLabel,
    comment: cleanRow.comment,
    extraEnabled: cleanRow.extraEnabled,
    extraSquads: cleanRow.extraSquads,
    extraTroopType: cleanRow.extraTroopType,
    extraTier: cleanRow.extraTier,
    customFields: cleanRow.customFields || {},
    source: cleanRow.source,
    rowType: cleanRow.rowType,
  };
}

function sameRegistrationData(a = {}, b = {}) {
  return stableStringify(comparableRegistrationRow(a)) === stableStringify(comparableRegistrationRow(b));
}

async function handleRegionTableRead(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  const url = new URL(request.url);
  const region = normalizeRegion(url.searchParams.get("region"));
  if (!region) return json({ ok: false, error: "region_required" }, 400);
  const table = await getActiveTable(db, region);
  if (!table) return json({ ok: false, error: "table_not_found" }, 404);
  const allowed =
    isAdminUid(env, user.uid) ||
    tableContainsUid(table, user.uid) ||
    (await hasSavedRegionAccess(db, user.uid, region));
  if (!allowed) return json({ ok: false, error: "region_access_denied" }, 403);
  return json({ ok: true, table }, 200, "private, no-store");
}

async function handleRegionTableRegistration(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  const user = await optionalFirebaseToken(request, env);
  let body = null;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  const region = normalizeRegion(body?.region || body?.row?.region);
  const cycleId = normalizeCycleId(
    body?.cycleId || body?.settings?.currentCycleId || "active",
  );
  if (!region) return json({ ok: false, error: "region_required" }, 400);

  const isPublicRegistration = Boolean(body?.publicLink || body?.shareCode || body?.row?.publicKey);
  if (!user?.uid && !isPublicRegistration) return json({ ok: false, error: "auth_required" }, 401);

  if (!user?.uid) {
    const shareCode = normalizeCode(body?.shareCode || "");
    if (!shareCode) return json({ ok: false, error: "share_code_required" }, 403);
    const share = await db
      .prepare(
        `SELECT code, region, cycle_id, expires_at_ms, revoked FROM region_table_shares WHERE code = ?1 LIMIT 1`,
      )
      .bind(shareCode)
      .first();
    if (!share || Number(share.revoked) === 1)
      return json({ ok: false, error: "share_not_found" }, 404);
    if (
      Number(share.expires_at_ms) > 0 &&
      Number(share.expires_at_ms) < Date.now()
    )
      return json({ ok: false, error: "share_expired" }, 410);
    if (normalizeRegion(share.region) !== region)
      return json({ ok: false, error: "share_region_mismatch" }, 403);
    if (normalizeCycleId(share.cycle_id || "active") !== cycleId)
      return json({ ok: false, error: "share_cycle_mismatch" }, 409);
  }

  const row = sanitizeTableRow({
    ...(body?.row || {}),
    region,
    uid: user?.uid ? (body?.row?.uid || user.uid) : '',
  });
  const canWrite = user?.uid
    ? (isAdminUid(env, user.uid) || row.uid === user.uid || !row.uid)
    : Boolean(isPublicRegistration && row.nickname && row.publicKey);
  if (!canWrite) return json({ ok: false, error: "row_owner_mismatch" }, 403);

  const current = (await readTable(db, region, cycleId)) || {
    region,
    cycleId,
    version: 0,
    settings: sanitizeSettings(body?.settings || {}),
    rows: [],
  };
  const rows = Array.isArray(current.rows)
    ? current.rows.map(sanitizeTableRow)
    : [];
  const key = row.id || `${row.uid || row.publicKey || "guest"}:${row.farmId || "main"}`;
  const nicknameKey = normalizedNickname(row.nickname);
  const duplicate = rows.find(item => {
    if (!nicknameKey || normalizedNickname(item.nickname) !== nicknameKey) return false;
    if (item.id && item.id === key) return false;
    if (row.uid && item.uid === row.uid && item.farmId === row.farmId) return false;
    if (row.publicKey && item.publicKey === row.publicKey && item.farmId === row.farmId) return false;
    return true;
  });
  if (duplicate) return json({ ok: false, error: "registration-nickname-duplicate-region" }, 409);
  const index = rows.findIndex(
    (item) =>
      (item.id && item.id === key) ||
      (row.uid && item.uid === row.uid && item.farmId === row.farmId) ||
      (row.publicKey && item.publicKey === row.publicKey && item.farmId === row.farmId),
  );
  const existingRow = index >= 0 ? rows[index] : null;
  const nextRow = { ...row, id: existingRow?.id || key };
  const unchanged = existingRow ? sameRegistrationData(existingRow, nextRow) : false;
  const forceUpdate = Boolean(body?.forceUpdate);

  if (existingRow && unchanged && !forceUpdate) {
    return json({
      ok: true,
      version: current.version || 0,
      rowsCount: rows.length,
      existing: true,
      unchanged: true,
      notWritten: true,
      action: "unchanged",
    });
  }

  const nowMs = Date.now();
  if (index >= 0)
    rows[index] = {
      ...rows[index],
      ...row,
      id: rows[index].id || key,
      updatedAtMs: nowMs,
    };
  else rows.push({ ...row, id: key, updatedAtMs: nowMs });

  const table = await saveTable(db, {
    region,
    cycleId,
    version: nowMs,
    settings: {
      ...(current.settings || {}),
      ...(body?.settings || {}),
      currentCycleId: cycleId,
    },
    rows,
  });
  if (user?.uid) await grantRegionAccess(db, region, user.uid, "registration");
  if (user?.uid && row.uid && row.uid !== user.uid)
    await grantRegionAccess(db, region, row.uid, "registration-row");
  return json({
    ok: true,
    version: table.version,
    rowsCount: table.rows.length,
    existing: index >= 0,
    unchanged: false,
    action: index >= 0 ? (unchanged ? "refreshed" : "updated") : "created",
  });
}

async function handleRegionTableSnapshot(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  if (!isAdminUid(env, user.uid))
    return json({ ok: false, error: "admin_required" }, 403);
  let body = null;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  const region = normalizeRegion(body?.region);
  const cycleId = normalizeCycleId(
    body?.cycleId || body?.settings?.currentCycleId || "active",
  );
  if (!region) return json({ ok: false, error: "region_required" }, 400);
  const rows = (Array.isArray(body?.rows) ? body.rows : [])
    .map(sanitizeTableRow)
    .filter((row) => row.nickname)
    .slice(0, MAX_TABLE_ROWS);
  const table = await saveTable(db, {
    region,
    cycleId,
    version: Date.now(),
    settings: { ...(body?.settings || {}), currentCycleId: cycleId },
    rows,
  });
  await grantRegionAccess(db, region, user.uid, "admin-snapshot");
  return json({
    ok: true,
    version: table.version,
    rowsCount: table.rows.length,
  });
}

async function handleRegionTableShareCreate(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  if (!isAdminUid(env, user.uid))
    return json({ ok: false, error: "admin_required" }, 403);
  let body = null;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  const code = normalizeCode(body?.code);
  const region = normalizeRegion(body?.region);
  const cycleId = normalizeCycleId(
    body?.cycleId || body?.settings?.currentCycleId || "active",
  );
  if (!code || !region)
    return json({ ok: false, error: "code_region_required" }, 400);
  const rows = (Array.isArray(body?.rows) ? body.rows : [])
    .map(sanitizeTableRow)
    .filter((row) => row.nickname)
    .slice(0, MAX_TABLE_ROWS);
  const existing = await readTable(db, region, cycleId);
  if (!existing)
    await saveTable(db, {
      region,
      cycleId,
      version: Date.now(),
      settings: { ...(body?.settings || {}), currentCycleId: cycleId },
      rows,
    });
  await db
    .prepare(
      `INSERT INTO region_table_shares (code, region, cycle_id, access, expires_at_ms, created_at_ms, created_by, revoked)
     VALUES (?1, ?2, ?3, 'view', ?4, ?5, ?6, 0)
     ON CONFLICT(code) DO UPDATE SET
       region = excluded.region,
       cycle_id = excluded.cycle_id,
       access = excluded.access,
       expires_at_ms = excluded.expires_at_ms,
       created_at_ms = excluded.created_at_ms,
       created_by = excluded.created_by,
       revoked = 0`,
    )
    .bind(
      code,
      region,
      cycleId,
      Number(body?.expiresAtMs) || 0,
      Date.now(),
      user.uid,
    )
    .run();
  return json({ ok: true, code, region, cycleId });
}

async function handleRegionTableShareRead(request, env, codeValue) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  const code = normalizeCode(codeValue);
  if (!code) return json({ ok: false, error: "share_code_required" }, 400);
  const share = await db
    .prepare(
      `SELECT code, region, cycle_id, expires_at_ms, revoked FROM region_table_shares WHERE code = ?1 LIMIT 1`,
    )
    .bind(code)
    .first();
  if (!share || Number(share.revoked) === 1)
    return json({ ok: false, error: "share_not_found" }, 404);
  if (
    Number(share.expires_at_ms) > 0 &&
    Number(share.expires_at_ms) < Date.now()
  )
    return json({ ok: false, error: "share_expired" }, 410);
  const region = normalizeRegion(share.region);
  const cycleId = normalizeCycleId(share.cycle_id || "active");
  const table = (await readTable(db, region, cycleId)) || {
    region,
    cycleId,
    version: 0,
    updatedAtMs: 0,
    settings: { currentCycleId: cycleId, open: true, enabled: true },
    rows: [],
  };
  return json(
    { ok: true, table: { ...table, region, cycleId } },
    200,
    "private, no-store",
  );
}


const PUBLIC_STATS_BUCKETS = 64;

function statsSecret(env) {
  return clean(env.STATS_EXPORT_SECRET || '', 240);
}

function requestStatsSecret(request) {
  return clean(request.headers.get('X-WKD-Stats-Secret') || '', 240);
}

function hasValidStatsSecret(request, env) {
  const secret = statsSecret(env);
  return Boolean(secret && requestStatsSecret(request) === secret);
}

function publicStatsBucketForKey(key = '') {
  const text = clean(key, 240) || 'unknown';
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % PUBLIC_STATS_BUCKETS;
}

function hexFromBytes(bytes) {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function publicStatsKeyForUid(uid = '') {
  const safeUid = clean(uid, 180);
  if (!safeUid) return '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(safeUid));
  return hexFromBytes(new Uint8Array(digest)).slice(0, 24);
}

function normalizeStatsRole(value = '') {
  const role = clean(value || 'player', 40).toLowerCase();
  return ['admin', 'moderator', 'consul', 'officer', 'player'].includes(role) ? role : 'player';
}

function sanitizePublicStatsWasteland(profile = null) {
  if (!profile || typeof profile !== 'object') return null;
  return {
    lairLevel: clean(profile.lairLevel, 12),
    troopType: clean(profile.troopType, 24),
    tier: clean(profile.tier, 12).toUpperCase(),
    marchSize: clean(profile.marchSize, 24),
    rallySize: clean(profile.rallySize, 24),
    captainReady: Boolean(profile.captainReady),
    readyToJoin: Boolean(profile.readyToJoin),
    readyToAttack: Boolean(profile.readyToAttack),
    shift: clean(profile.shift, 24),
    extraEnabled: Boolean(profile.extraEnabled),
    extraSquads: Array.isArray(profile.extraSquads) ? profile.extraSquads.slice(0, 6).map(item => ({
      troopType: clean(item?.troopType, 24),
      tier: clean(item?.tier, 12).toUpperCase()
    })).filter(item => item.troopType || item.tier) : [],
    extraTroopType: clean(profile.extraTroopType, 24),
    extraTier: clean(profile.extraTier, 12).toUpperCase()
  };
}

function sanitizePublicStatsFarm(farm = {}, index = 0, showExtra = false) {
  return {
    farmId: clean(farm.farmId || farm.id || `farm-${index + 1}`, 40),
    nickname: clean(farm.nickname || farm.gameNick || `Farm ${index + 1}`, 80),
    region: normalizeRegion(farm.region),
    alliance: clean(farm.alliance, 12),
    rank: clean(farm.rank || 'p1', 16).toLowerCase(),
    shk: clean(farm.shk, 12),
    role: normalizeStatsRole(farm.role || 'player'),
    roleLabel: clean(farm.roleLabel || farm.role || 'player', 40),
    wastelandProfile: showExtra ? sanitizePublicStatsWasteland(farm.wastelandProfile || {}) : null
  };
}

async function sanitizePublicStatsPlayer(raw = {}, uid = '') {
  const publicKey = clean(raw.publicKey || await publicStatsKeyForUid(uid || raw.uid || raw.id), 40);
  const visibility = raw.profileVisibility && typeof raw.profileVisibility === 'object' ? raw.profileVisibility : {};
  const showExtra = Boolean(visibility.showWastelandInfo);
  const showFarms = Boolean(visibility.showFarmsInfo);
  const farms = Array.isArray(raw.farms) ? raw.farms.filter(farm => farm && (farm.nickname || farm.gameNick || farm.region || farm.alliance)) : [];
  const nickname = clean(raw.nickname || raw.gameNick, 80);
  const region = normalizeRegion(raw.region);
  const alliance = clean(raw.alliance, 12);
  const shk = clean(raw.shk, 12);
  const complete = Boolean(raw.profileComplete !== false && nickname && region && alliance && shk);
  if (!complete || !publicKey) return null;
  return {
    publicKey,
    nickname,
    gameNick: clean(raw.gameNick || nickname, 80),
    region,
    alliance,
    rank: clean(raw.rank || 'p1', 16).toLowerCase(),
    shk,
    role: normalizeStatsRole(raw.role || 'player'),
    roleLabel: clean(raw.roleLabel || raw.role || 'player', 40),
    country: clean(raw.country, 60),
    countryCode: clean(raw.countryCode, 8).toUpperCase(),
    farmCount: Math.max(0, Number(raw.farmCount || farms.length) || 0),
    profileComplete: true,
    profileVisibility: { showWastelandInfo: showExtra, showFarmsInfo: showFarms },
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || Date.now(),
    wastelandProfile: showExtra ? sanitizePublicStatsWasteland(raw.wastelandProfile || {}) : null,
    farms: showFarms ? farms.map((farm, index) => sanitizePublicStatsFarm(farm, index, showExtra)) : []
  };
}

function parseArrayJson(value = '') {
  const data = parseJson(value, []);
  return Array.isArray(data) ? data : [];
}

async function readPublicStatsPage(db, bucket) {
  await ensureRegionTableSchema(db);
  const row = await db.prepare(
    `SELECT bucket, players_json FROM public_stats_pages WHERE bucket = ?1`
  ).bind(bucket).first();
  return parseArrayJson(row?.players_json);
}

async function writePublicStatsPage(db, bucket, players = []) {
  await ensureRegionTableSchema(db);
  const cleanPlayers = (Array.isArray(players) ? players : [])
    .filter(player => player?.publicKey && player?.nickname)
    .sort((a, b) => String(a.region || '').localeCompare(String(b.region || ''), 'uk', { numeric: true }) || String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk', { numeric: true }));
  const updatedAtMs = Date.now();
  await db.batch([
    db.prepare(
      `INSERT INTO public_stats_pages (bucket, updated_at_ms, players_json)
       VALUES (?1, ?2, ?3)
       ON CONFLICT(bucket) DO UPDATE SET
         updated_at_ms = excluded.updated_at_ms,
         players_json = excluded.players_json`
    ).bind(bucket, updatedAtMs, JSON.stringify(cleanPlayers)),
    db.prepare(
      `INSERT INTO public_stats_meta (id, version, updated_at_ms, source)
       VALUES ('current', ?1, ?2, 'cloudflare-d1')
       ON CONFLICT(id) DO UPDATE SET
         version = excluded.version,
         updated_at_ms = excluded.updated_at_ms,
         source = excluded.source`
    ).bind(updatedAtMs, updatedAtMs)
  ]);
  return cleanPlayers.length;
}

async function handlePublicStatsPlayerUpsert(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const uid = clean(body?.uid || body?.player?.uid || user.uid, 180);
  if (!uid) return json({ ok: false, error: 'uid_required' }, 400);
  if (uid !== user.uid && !isAdminUid(env, user.uid)) return json({ ok: false, error: 'stats_owner_mismatch' }, 403);
  const publicKey = await publicStatsKeyForUid(uid);
  const bucket = publicStatsBucketForKey(uid);
  const page = await readPublicStatsPage(db, bucket);
  const next = page.filter(player => clean(player.publicKey, 40) !== publicKey);
  const active = body?.active !== false;
  let saved = false;
  if (active) {
    const player = await sanitizePublicStatsPlayer({ ...(body?.player || {}), uid, publicKey }, uid);
    if (player) {
      next.push(player);
      saved = true;
    }
  }
  const rowsCount = await writePublicStatsPage(db, bucket, next);
  return json({ ok: true, bucket, saved, rowsCount });
}

async function handlePublicStatsImport(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  if (!hasValidStatsSecret(request, env)) return json({ ok: false, error: 'stats_secret_required' }, 403);
  await ensureRegionTableSchema(db);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const rawPlayers = Array.isArray(body?.players) ? body.players : [];
  const pages = new Map();
  for (const raw of rawPlayers.slice(0, 50000)) {
    const uid = clean(raw.uid || raw.id || raw.publicKey || raw.nickname, 180);
    const publicKey = clean(raw.publicKey || await publicStatsKeyForUid(uid), 40);
    const bucket = publicStatsBucketForKey(uid || publicKey);
    const player = await sanitizePublicStatsPlayer({ ...raw, publicKey }, uid || publicKey);
    if (!player) continue;
    if (!pages.has(bucket)) pages.set(bucket, []);
    pages.get(bucket).push(player);
  }
  await ensureRegionTableSchema(db);
  const statements = [];
  for (let bucket = 0; bucket < PUBLIC_STATS_BUCKETS; bucket += 1) {
    const players = pages.get(bucket) || [];
    statements.push(db.prepare(
      `INSERT INTO public_stats_pages (bucket, updated_at_ms, players_json)
       VALUES (?1, ?2, ?3)
       ON CONFLICT(bucket) DO UPDATE SET
         updated_at_ms = excluded.updated_at_ms,
         players_json = excluded.players_json`
    ).bind(bucket, Date.now(), JSON.stringify(players.sort((a, b) => String(a.region || '').localeCompare(String(b.region || ''), 'uk', { numeric: true }) || String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk', { numeric: true })))));
  }
  statements.push(db.prepare(
    `INSERT INTO public_stats_meta (id, version, updated_at_ms, source)
     VALUES ('current', ?1, ?2, 'cloudflare-d1-import')
     ON CONFLICT(id) DO UPDATE SET
       version = excluded.version,
       updated_at_ms = excluded.updated_at_ms,
       source = excluded.source`
  ).bind(Date.now(), Date.now()));
  for (let i = 0; i < statements.length; i += 40) {
    await db.batch(statements.slice(i, i + 40));
  }
  return json({ ok: true, buckets: pages.size, players: [...pages.values()].reduce((sum, list) => sum + list.length, 0) });
}

async function handlePublicStatsExport(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  if (statsSecret(env) && !hasValidStatsSecret(request, env)) return json({ ok: false, error: 'stats_secret_required' }, 403);
  await ensureRegionTableSchema(db);
  const rows = await db.prepare(
    `SELECT bucket, updated_at_ms, players_json FROM public_stats_pages ORDER BY bucket ASC`
  ).all();
  const players = [];
  for (const row of rows?.results || []) {
    players.push(...parseArrayJson(row.players_json));
  }
  players.sort((a, b) => String(a.region || '').localeCompare(String(b.region || ''), 'uk', { numeric: true }) || String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk', { numeric: true }));
  const meta = await db.prepare(`SELECT version, updated_at_ms, source FROM public_stats_meta WHERE id = 'current'`).first();
  return json({
    ok: true,
    source: 'cloudflare-d1-public-stats',
    generatedAt: new Date().toISOString(),
    d1Version: Number(meta?.version || 0),
    d1UpdatedAtMs: Number(meta?.updated_at_ms || 0),
    buckets: rows?.results?.length || 0,
    players
  }, 200, 'private, no-store');
}


function sanitizeActionDetails(details = {}) {
  const safe = {};
  if (!details || typeof details !== "object" || Array.isArray(details)) return safe;
  for (const [key, value] of Object.entries(details).slice(0, 30)) {
    const safeKey = clean(key, 80).replace(/[^A-Za-z0-9_.:-]/g, "_");
    if (!safeKey) continue;
    if (value && typeof value === "object") safe[safeKey] = clean(JSON.stringify(value), 500);
    else safe[safeKey] = clean(value, 500);
  }
  return safe;
}

function actionRowToObject(row = {}) {
  return {
    id: clean(row.id || "", 120),
    region: normalizeRegion(row.region),
    action: clean(row.action || "", 80),
    actorUid: clean(row.actor_uid || "", 160),
    actorName: clean(row.actor_name || "", 160),
    actorAlliance: clean(row.actor_alliance || "", 40),
    actorRole: clean(row.actor_role || "", 40),
    alliance: clean(row.alliance || "", 40),
    targetUid: clean(row.target_uid || "", 160),
    targetName: clean(row.target_name || "", 160),
    summary: clean(row.summary || "", 500),
    details: parseJson(row.details_json, {}),
    createdAtMs: Number(row.created_at_ms) || 0,
  };
}

async function handleActionLogList(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  const url = new URL(request.url);
  const region = normalizeRegion(url.searchParams.get("region"));
  if (!region) return json({ ok: false, error: "region_required" }, 400);
  const limitValue = Math.max(1, Math.min(20, Number(url.searchParams.get("limit")) || 20));
  const cursorMs = Number(url.searchParams.get("cursorMs")) || 0;
  const alliance = clean(url.searchParams.get("alliance") || "", 40).toUpperCase();
  const params = [region];
  let where = "region = ?1";
  if (cursorMs > 0) {
    params.push(cursorMs);
    where += ` AND created_at_ms < ?${params.length}`;
  }
  if (alliance) {
    params.push(alliance);
    where += ` AND alliance = ?${params.length}`;
  }
  const sql = `SELECT id, region, action, actor_uid, actor_name, actor_alliance, actor_role, alliance, target_uid, target_name, summary, details_json, created_at_ms
     FROM action_logs
    WHERE ${where}
    ORDER BY created_at_ms DESC
    LIMIT ${limitValue}`;
  const result = await db.prepare(sql).bind(...params).all();
  const rows = (result?.results || []).map(actionRowToObject);
  const last = rows[rows.length - 1] || null;
  await grantRegionAccess(db, region, user.uid, "action-log-read").catch(() => null);
  return json({ ok: true, region, rows, limitCount: limitValue, hasMore: rows.length === limitValue, nextCursorMs: Number(last?.createdAtMs) || 0, source: "cloudflare-d1-action-log" });
}

async function handleActionLogCreate(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  const region = normalizeRegion(body?.region);
  if (!region) return json({ ok: false, error: "region_required" }, 400);
  const createdAtMs = Number(body?.createdAtMs) || Date.now();
  const id = clean(body?.id || crypto.randomUUID(), 120);
  const details = sanitizeActionDetails(body?.details || {});
  const row = {
    id,
    region,
    action: clean(body?.action || "", 80),
    actorUid: clean(body?.actorUid || user.uid || "", 160),
    actorName: clean(body?.actorName || user.name || user.email || user.uid || "", 160),
    actorAlliance: clean(body?.actorAlliance || "", 40).toUpperCase(),
    actorRole: clean(body?.actorRole || "", 40).toLowerCase(),
    alliance: clean(body?.alliance || body?.actorAlliance || "", 40).toUpperCase(),
    targetUid: clean(body?.targetUid || "", 160),
    targetName: clean(body?.targetName || "", 160),
    summary: clean(body?.summary || "", 500),
    details,
    createdAtMs,
  };
  await db.prepare(
    `INSERT INTO action_logs (id, region, action, actor_uid, actor_name, actor_alliance, actor_role, alliance, target_uid, target_name, summary, details_json, created_at_ms)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
     ON CONFLICT(id) DO UPDATE SET
       region = excluded.region,
       action = excluded.action,
       actor_uid = excluded.actor_uid,
       actor_name = excluded.actor_name,
       actor_alliance = excluded.actor_alliance,
       actor_role = excluded.actor_role,
       alliance = excluded.alliance,
       target_uid = excluded.target_uid,
       target_name = excluded.target_name,
       summary = excluded.summary,
       details_json = excluded.details_json,
       created_at_ms = excluded.created_at_ms`
  ).bind(row.id, row.region, row.action, row.actorUid, row.actorName, row.actorAlliance, row.actorRole, row.alliance, row.targetUid, row.targetName, row.summary, JSON.stringify(details), row.createdAtMs).run();
  await grantRegionAccess(db, region, user.uid, "action-log-write").catch(() => null);
  return json({ ok: true, region, log: row, source: "cloudflare-d1-action-log" });
}

async function handleActionLogDelete(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  const region = normalizeRegion(body?.region);
  if (!region) return json({ ok: false, error: "region_required" }, 400);
  const ids = [...new Set((Array.isArray(body?.ids) ? body.ids : [body?.id]).map((item) => clean(item, 120)).filter(Boolean))].slice(0, 100);
  if (!ids.length) return json({ ok: true, region, deleted: 0 });
  const placeholders = ids.map((_, index) => `?${index + 2}`).join(",");
  const result = await db.prepare(`DELETE FROM action_logs WHERE region = ?1 AND id IN (${placeholders})`).bind(region, ...ids).run();
  return json({ ok: true, region, deleted: Number(result?.meta?.changes) || ids.length, source: "cloudflare-d1-action-log" });
}

async function handleActionLogClear(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  const region = normalizeRegion(body?.region);
  if (!region) return json({ ok: false, error: "region_required" }, 400);
  const limitValue = Math.max(1, Math.min(500, Number(body?.limitCount) || 500));
  const olderThanMs = Number(body?.olderThanMs) || 0;
  const params = [region];
  let where = "region = ?1";
  if (olderThanMs > 0) {
    params.push(olderThanMs);
    where += ` AND created_at_ms < ?${params.length}`;
  }
  const selected = await db.prepare(`SELECT id FROM action_logs WHERE ${where} ORDER BY created_at_ms ASC LIMIT ${limitValue}`).bind(...params).all();
  const ids = (selected?.results || []).map((row) => clean(row.id, 120)).filter(Boolean);
  if (!ids.length) return json({ ok: true, region, deleted: 0, hasMore: false });
  const placeholders = ids.map((_, index) => `?${index + 2}`).join(",");
  const result = await db.prepare(`DELETE FROM action_logs WHERE region = ?1 AND id IN (${placeholders})`).bind(region, ...ids).run();
  return json({ ok: true, region, deleted: Number(result?.meta?.changes) || ids.length, hasMore: ids.length === limitValue, source: "cloudflare-d1-action-log" });
}


function d1CleanupScope(value = 'all') {
  const scope = clean(value || 'all', 40).toLowerCase();
  return ['cycles', 'shares', 'campaigns', 'all'].includes(scope) ? scope : 'all';
}

function d1CleanupCutoffMs(retentionDays = 60) {
  return Date.now() - Math.max(1, Math.min(3650, Number(retentionDays) || 60)) * 24 * 60 * 60 * 1000;
}

async function selectOldD1CycleIds(db, { cutoffMs = 0, region = '', limitCount = 500 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 500));
  const params = [Number(cutoffMs) || 0];
  let where = `rt.updated_at_ms > 0 AND rt.updated_at_ms < ?1 AND rt.cycle_id != COALESCE(ra.cycle_id, 'active')`;
  if (region) {
    params.push(region);
    where += ` AND rt.region = ?${params.length}`;
  }
  const result = await db.prepare(
    `SELECT rt.region AS region, rt.cycle_id AS cycle_id
       FROM region_tables rt
       LEFT JOIN region_active ra ON ra.region = rt.region
      WHERE ${where}
      ORDER BY rt.updated_at_ms ASC
      LIMIT ${safeLimit}`
  ).bind(...params).all();
  return (result?.results || []).map(row => ({ region: normalizeRegion(row.region), cycleId: normalizeCycleId(row.cycle_id) })).filter(row => row.region && row.cycleId);
}

async function selectOldD1ShareCodes(db, { cutoffMs = 0, region = '', limitCount = 500 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 500));
  const nowMs = Date.now();
  const params = [nowMs, Number(cutoffMs) || 0];
  let where = `((expires_at_ms > 0 AND expires_at_ms < ?1) OR (revoked = 1 AND created_at_ms > 0 AND created_at_ms < ?2))`;
  if (region) {
    params.push(region);
    where += ` AND region = ?${params.length}`;
  }
  const result = await db.prepare(
    `SELECT code FROM region_table_shares WHERE ${where} ORDER BY created_at_ms ASC LIMIT ${safeLimit}`
  ).bind(...params).all();
  return (result?.results || []).map(row => normalizeCode(row.code)).filter(Boolean);
}

async function selectOldD1CampaignIds(db, { cutoffMs = 0, region = '', limitCount = 500 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 500));
  const nowMs = Date.now();
  const params = [nowMs, Number(cutoffMs) || 0];
  let where = `((expires_at_ms > 0 AND expires_at_ms < ?1) OR (created_at_ms > 0 AND created_at_ms < ?2))`;
  if (region) {
    params.push(region);
    where += ` AND region = ?${params.length}`;
  }
  const result = await db.prepare(
    `SELECT id FROM notification_campaigns WHERE ${where} ORDER BY created_at_ms ASC LIMIT ${safeLimit}`
  ).bind(...params).all();
  return (result?.results || []).map(row => clean(row.id, 140)).filter(Boolean);
}

async function runD1ArchiveCleanup(db, { scope = 'all', region = '', retentionDays = 60, limitCount = 500, dryRun = false } = {}) {
  const safeScope = d1CleanupScope(scope);
  const safeRegion = normalizeRegion(region);
  const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 500));
  const cutoffMs = d1CleanupCutoffMs(retentionDays);
  let remaining = safeLimit;
  let cycles = 0;
  let shares = 0;
  let campaigns = 0;
  let deleted = 0;
  let scanned = 0;
  let hasMore = false;

  if ((safeScope === 'cycles' || safeScope === 'all') && remaining > 0) {
    const rows = await selectOldD1CycleIds(db, { cutoffMs, region: safeRegion, limitCount: remaining });
    cycles = rows.length;
    scanned += rows.length;
    if (!dryRun && rows.length) {
      for (const row of rows) {
        const result = await db.prepare(`DELETE FROM region_tables WHERE region = ?1 AND cycle_id = ?2`).bind(row.region, row.cycleId).run();
        deleted += Number(result?.meta?.changes) || 0;
      }
    }
    remaining -= rows.length;
    if (rows.length === safeLimit) hasMore = true;
  }

  if ((safeScope === 'shares' || safeScope === 'all') && remaining > 0) {
    const codes = await selectOldD1ShareCodes(db, { cutoffMs, region: safeRegion, limitCount: remaining });
    shares = codes.length;
    scanned += codes.length;
    if (!dryRun && codes.length) {
      const placeholders = codes.map((_, index) => `?${index + 1}`).join(',');
      const result = await db.prepare(`DELETE FROM region_table_shares WHERE code IN (${placeholders})`).bind(...codes).run();
      deleted += Number(result?.meta?.changes) || 0;
    }
    remaining -= codes.length;
    if (codes.length === safeLimit) hasMore = true;
  }

  if ((safeScope === 'campaigns' || safeScope === 'all') && remaining > 0) {
    const ids = await selectOldD1CampaignIds(db, { cutoffMs, region: safeRegion, limitCount: remaining });
    campaigns = ids.length;
    scanned += ids.length;
    if (!dryRun && ids.length) {
      const placeholders = ids.map((_, index) => `?${index + 1}`).join(',');
      const result = await db.prepare(`DELETE FROM notification_campaigns WHERE id IN (${placeholders})`).bind(...ids).run();
      deleted += Number(result?.meta?.changes) || 0;
    }
    remaining -= ids.length;
    if (ids.length === safeLimit) hasMore = true;
  }

  const found = cycles + shares + campaigns;
  return {
    ok: true,
    scope: safeScope,
    region: safeRegion,
    retentionDays: Math.max(1, Number(retentionDays) || 60),
    found,
    deleted: dryRun ? 0 : deleted,
    scanned,
    cycles,
    shares,
    campaigns,
    hasMore: hasMore || found >= safeLimit,
    source: 'cloudflare-d1-cleanup'
  };
}

async function handleD1CleanupScan(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  if (!isAdminUid(env, user.uid)) return json({ ok: false, error: 'admin_required' }, 403);
  let body = null;
  try { body = await request.json(); } catch { body = {}; }
  const result = await runD1ArchiveCleanup(db, {
    scope: body?.scope || 'all',
    region: body?.region || '',
    retentionDays: Number(body?.retentionDays) || 60,
    limitCount: Number(body?.limitCount) || 500,
    dryRun: true
  });
  return json(result);
}

async function handleD1CleanupClear(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  if (!isAdminUid(env, user.uid)) return json({ ok: false, error: 'admin_required' }, 403);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const result = await runD1ArchiveCleanup(db, {
    scope: body?.scope || 'all',
    region: body?.region || '',
    retentionDays: Number(body?.retentionDays) || 60,
    limitCount: Number(body?.limitCount) || 500,
    dryRun: false
  });
  return json(result);
}


const CLOUDFLARE_GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const WORKERS_FREE_REQUESTS_PER_DAY = 100000;
const D1_FREE_ROWS_READ_PER_DAY = 5000000;
const D1_FREE_ROWS_WRITTEN_PER_DAY = 100000;
const D1_FREE_STORAGE_TOTAL_BYTES = 5 * 1024 * 1024 * 1024;
const D1_FREE_DATABASE_SIZE_BYTES = 500 * 1024 * 1024;

function todayUtcWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = now;
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  return {
    startIso,
    endIso,
    startDate: startIso.slice(0, 10),
    endDate: endIso.slice(0, 10),
  };
}

function numericMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function sumMetricRows(rows = [], key = '') {
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + numericMetric(row?.sum?.[key]), 0);
}

function maxMetricRows(rows = [], key = '') {
  return (Array.isArray(rows) ? rows : []).reduce((max, row) => Math.max(max, numericMetric(row?.max?.[key] ?? row?.sum?.[key])), 0);
}

async function requireAdminUser(request, env) {
  const user = await verifyFirebaseToken(request, env);
  if (!isAdminUid(env, user.uid)) {
    throw new Error('admin_required');
  }
  return user;
}

async function callCloudflareGraphql(env, query, variables = {}) {
  const token = clean(env.CLOUDFLARE_ANALYTICS_TOKEN || '', 4096);
  const accountTag = clean(env.CLOUDFLARE_ACCOUNT_ID || '', 200);
  if (!token) throw new Error('cloudflare_token_missing');
  if (!accountTag) throw new Error('cloudflare_account_id_missing');
  const response = await fetch(CLOUDFLARE_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: { accountTag, ...variables } }),
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    throw new Error(`cloudflare_http_${response.status}`);
  }
  if (Array.isArray(data?.errors) && data.errors.length) {
    const message = clean(data.errors[0]?.message || 'cloudflare_graphql_error', 160);
    throw new Error(message || 'cloudflare_graphql_error');
  }
  return data?.data || {};
}

async function fetchWorkerUsage(env, period) {
  const scriptName = clean(env.CLOUDFLARE_WORKER_SCRIPT_NAME || '', 160);
  const filter = scriptName
    ? 'filter: { scriptName: $scriptName, datetime_geq: $datetimeStart, datetime_leq: $datetimeEnd }'
    : 'filter: { datetime_geq: $datetimeStart, datetime_leq: $datetimeEnd }';
  const variablesLine = scriptName ? ', $scriptName: string' : '';
  const query = `query WKDWorkersUsage($accountTag: string!, $datetimeStart: string!, $datetimeEnd: string!${variablesLine}) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        workersInvocationsAdaptive(limit: 10000, ${filter}) {
          sum { requests subrequests errors }
          quantiles { cpuTimeP50 cpuTimeP99 }
          dimensions { scriptName status }
        }
      }
    }
  }`;
  const variables = {
    datetimeStart: period.startIso,
    datetimeEnd: period.endIso,
  };
  if (scriptName) variables.scriptName = scriptName;
  const data = await callCloudflareGraphql(env, query, variables);
  const rows = data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];
  const cpuRows = Array.isArray(rows) ? rows.filter(row => row?.quantiles) : [];
  return {
    requests: sumMetricRows(rows, 'requests'),
    subrequests: sumMetricRows(rows, 'subrequests'),
    errors: sumMetricRows(rows, 'errors'),
    cpuTimeP50: maxMetricRows(cpuRows.map(row => ({ max: row.quantiles })), 'cpuTimeP50'),
    cpuTimeP99: maxMetricRows(cpuRows.map(row => ({ max: row.quantiles })), 'cpuTimeP99'),
    scriptName: scriptName || 'all-workers',
    rows: Array.isArray(rows) ? rows.length : 0,
  };
}

async function fetchD1AnalyticsUsage(env, period) {
  const query = `query WKDD1AnalyticsUsage($accountTag: string!, $start: Date!, $end: Date!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        d1AnalyticsAdaptiveGroups(limit: 10000, filter: { date_geq: $start, date_leq: $end }) {
          sum { readQueries writeQueries rowsRead rowsWritten }
          dimensions { date databaseId }
        }
      }
    }
  }`;
  const data = await callCloudflareGraphql(env, query, { start: period.startDate, end: period.endDate });
  const rows = data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups || [];
  return {
    readQueries: sumMetricRows(rows, 'readQueries'),
    writeQueries: sumMetricRows(rows, 'writeQueries'),
    rowsRead: sumMetricRows(rows, 'rowsRead'),
    rowsWritten: sumMetricRows(rows, 'rowsWritten'),
    rows: Array.isArray(rows) ? rows.length : 0,
  };
}

async function fetchD1StorageUsage(env, period) {
  const query = `query WKDD1StorageUsage($accountTag: string!, $start: Date!, $end: Date!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        d1StorageAdaptiveGroups(limit: 10000, filter: { date_geq: $start, date_leq: $end }) {
          max { databaseSizeBytes }
          dimensions { date databaseId }
        }
      }
    }
  }`;
  const data = await callCloudflareGraphql(env, query, { start: period.startDate, end: period.endDate });
  const rows = data?.viewer?.accounts?.[0]?.d1StorageAdaptiveGroups || [];
  const byDatabase = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = clean(row?.dimensions?.databaseId || 'unknown', 120);
    const bytes = numericMetric(row?.max?.databaseSizeBytes);
    byDatabase.set(id, Math.max(byDatabase.get(id) || 0, bytes));
  }
  const databaseSizes = [...byDatabase.entries()].map(([databaseId, bytes]) => ({ databaseId, bytes }));
  return {
    databaseSizeBytes: databaseSizes.reduce((sum, item) => sum + numericMetric(item.bytes), 0),
    maxDatabaseSizeBytes: databaseSizes.reduce((max, item) => Math.max(max, numericMetric(item.bytes)), 0),
    databaseCount: databaseSizes.length,
    databaseSizes: databaseSizes.slice(0, 20),
    rows: Array.isArray(rows) ? rows.length : 0,
  };
}

async function handleCloudflareUsage(request, env) {
  await requireAdminUser(request, env);
  const period = todayUtcWindow();
  const partialErrors = [];
  let worker = { requests: 0, subrequests: 0, errors: 0, cpuTimeP50: 0, cpuTimeP99: 0, scriptName: 'unknown', rows: 0 };
  let d1 = { readQueries: 0, writeQueries: 0, rowsRead: 0, rowsWritten: 0, rows: 0 };
  let storage = { databaseSizeBytes: 0, maxDatabaseSizeBytes: 0, databaseCount: 0, databaseSizes: [], rows: 0 };

  try {
    worker = await fetchWorkerUsage(env, period);
  } catch (error) {
    partialErrors.push({ source: 'workers', error: clean(error?.message || 'workers_usage_failed', 160) });
  }
  try {
    d1 = await fetchD1AnalyticsUsage(env, period);
  } catch (error) {
    partialErrors.push({ source: 'd1-analytics', error: clean(error?.message || 'd1_usage_failed', 160) });
  }
  try {
    storage = await fetchD1StorageUsage(env, period);
  } catch (error) {
    partialErrors.push({ source: 'd1-storage', error: clean(error?.message || 'd1_storage_failed', 160) });
  }

  const hasAnyData = worker.rows > 0 || d1.rows > 0 || storage.rows > 0;
  if (!hasAnyData && partialErrors.length >= 3) {
    return json({ ok: false, error: 'cloudflare_usage_unavailable', partialErrors }, 502);
  }

  return json({
    ok: true,
    real: true,
    source: 'cloudflare-graphql-analytics-api',
    period: {
      timezone: 'UTC',
      start: period.startIso,
      end: period.endIso,
      dateStart: period.startDate,
      dateEnd: period.endDate,
    },
    worker,
    d1: {
      ...d1,
      databaseSizeBytes: storage.databaseSizeBytes,
      maxDatabaseSizeBytes: storage.maxDatabaseSizeBytes,
      databaseCount: storage.databaseCount,
      databaseSizes: storage.databaseSizes,
    },
    limits: {
      workerRequestsPerDay: WORKERS_FREE_REQUESTS_PER_DAY,
      d1RowsReadPerDay: D1_FREE_ROWS_READ_PER_DAY,
      d1RowsWrittenPerDay: D1_FREE_ROWS_WRITTEN_PER_DAY,
      d1StorageTotalBytes: D1_FREE_STORAGE_TOTAL_BYTES,
      d1DatabaseSizeBytes: D1_FREE_DATABASE_SIZE_BYTES,
    },
    partialErrors,
    generatedAt: new Date().toISOString(),
  }, 200, 'private, no-store');
}


const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_MONITORING_API = 'https://monitoring.googleapis.com/v3';
const GOOGLE_MONITORING_SCOPE = 'https://www.googleapis.com/auth/monitoring.read';
const FIRESTORE_FREE_READS_PER_DAY = 50000;
const FIRESTORE_FREE_WRITES_PER_DAY = 20000;
const FIRESTORE_FREE_DELETES_PER_DAY = 20000;
const FIRESTORE_FREE_STORAGE_BYTES = 1024 * 1024 * 1024;
const FIREBASE_AUTH_FREE_DAU = 3000;

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlEncodeJson(value) {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToArrayBuffer(pem = '') {
  const body = String(pem || '')
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  return base64UrlToBytes(body.replace(/\+/g, '-').replace(/\//g, '_'));
}

function googleServiceAccount(env) {
  const raw = String(env.GOOGLE_SERVICE_ACCOUNT_JSON || env.FIREBASE_MONITORING_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) throw new Error('google_service_account_missing');
  let data = null;
  try { data = JSON.parse(raw); } catch { throw new Error('google_service_account_bad_json'); }
  const clientEmail = clean(data?.client_email || '', 240);
  const privateKey = String(data?.private_key || '').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new Error('google_service_account_incomplete');
  return { clientEmail, privateKey };
}

function googleProjectId(env) {
  const projectId = clean(env.GOOGLE_PROJECT_ID || env.FIREBASE_PROJECT_ID || '', 160);
  if (!projectId) throw new Error('google_project_id_missing');
  return projectId;
}

async function signGoogleJwt(env) {
  const serviceAccount = googleServiceAccount(env);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: serviceAccount.clientEmail,
    scope: GOOGLE_MONITORING_SCOPE,
    aud: GOOGLE_OAUTH_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const signingInput = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(claim)}`;
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

async function getGoogleAccessToken(env) {
  const now = Date.now();
  if (googleAccessTokenCache.token && googleAccessTokenCache.expiresAt > now + 60 * 1000) {
    return googleAccessTokenCache.token;
  }
  const assertion = await signGoogleJwt(env);
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || !data?.access_token) {
    throw new Error(clean(data?.error_description || data?.error || `google_oauth_${response.status}`, 180));
  }
  googleAccessTokenCache = {
    token: String(data.access_token),
    expiresAt: now + Math.max(60, Number(data.expires_in) || 3600) * 1000,
  };
  return googleAccessTokenCache.token;
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const out = {};
  for (const part of parts) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  if (out.hour === 24) out.hour = 0;
  return out;
}

function timeZoneOffsetMs(date, timeZone) {
  const part = zonedParts(date, timeZone);
  const asUtc = Date.UTC(part.year, part.month - 1, part.day, part.hour, part.minute, part.second || 0);
  return asUtc - date.getTime();
}

function zonedMidnightUtc(year, month, day, timeZone) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const offset = timeZoneOffsetMs(utcGuess, timeZone);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offset);
}

function todayPacificWindow() {
  const timeZone = 'America/Los_Angeles';
  const now = new Date();
  const part = zonedParts(now, timeZone);
  const start = zonedMidnightUtc(part.year, part.month, part.day, timeZone);
  return {
    timezone: timeZone,
    startIso: start.toISOString(),
    endIso: now.toISOString(),
  };
}

function monitoringPointValue(point = {}) {
  const value = point?.value || {};
  const raw = value.int64Value ?? value.doubleValue ?? value.distributionValue?.count ?? 0;
  return numericMetric(raw);
}

async function fetchMonitoringSeries(env, accessToken, metricType, period) {
  const projectId = googleProjectId(env);
  const url = new URL(`${GOOGLE_MONITORING_API}/projects/${encodeURIComponent(projectId)}/timeSeries`);
  url.searchParams.set('filter', `metric.type = "${metricType}"`);
  url.searchParams.set('interval.startTime', period.startIso);
  url.searchParams.set('interval.endTime', period.endIso);
  url.searchParams.set('view', 'FULL');
  url.searchParams.set('pageSize', '100000');
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const message = clean(data?.error?.message || `monitoring_${response.status}`, 180);
    throw new Error(message || `monitoring_${response.status}`);
  }
  return Array.isArray(data?.timeSeries) ? data.timeSeries : [];
}

function sumMonitoringPoints(series = []) {
  let sum = 0;
  let points = 0;
  for (const item of series) {
    for (const point of Array.isArray(item?.points) ? item.points : []) {
      sum += monitoringPointValue(point);
      points += 1;
    }
  }
  return { value: sum, rows: Array.isArray(series) ? series.length : 0, points };
}

function maxMonitoringPoints(series = []) {
  let max = 0;
  let points = 0;
  for (const item of series) {
    for (const point of Array.isArray(item?.points) ? item.points : []) {
      max = Math.max(max, monitoringPointValue(point));
      points += 1;
    }
  }
  return { value: max, rows: Array.isArray(series) ? series.length : 0, points };
}

async function readFirestoreMetric(env, accessToken, metricType, period, mode = 'sum') {
  const series = await fetchMonitoringSeries(env, accessToken, metricType, period);
  return mode === 'max' ? maxMonitoringPoints(series) : sumMonitoringPoints(series);
}

async function handleFirebaseUsage(request, env) {
  await requireAdminUser(request, env);
  const period = todayPacificWindow();
  const partialErrors = [];
  const firestore = {
    reads: 0,
    writes: 0,
    deletes: 0,
    storageBytes: 0,
    activeConnections: 0,
    snapshotListeners: 0,
    deniedRules: 0,
    rows: 0,
    points: 0,
  };

  let accessToken = '';
  try {
    accessToken = await getGoogleAccessToken(env);
  } catch (error) {
    return json({ ok: false, error: clean(error?.message || 'google_auth_failed', 180) }, 500);
  }

  const metrics = [
    ['reads', 'firestore.googleapis.com/document/read_count', 'sum'],
    ['writes', 'firestore.googleapis.com/document/write_count', 'sum'],
    ['deletes', 'firestore.googleapis.com/document/delete_count', 'sum'],
    ['storageBytes', 'firestore.googleapis.com/storage/data_and_index_storage_bytes', 'max'],
    ['activeConnections', 'firestore.googleapis.com/network/active_connections', 'max'],
    ['snapshotListeners', 'firestore.googleapis.com/network/snapshot_listeners', 'max'],
    ['deniedRules', 'firestore.googleapis.com/rules/denied_request_count', 'sum'],
  ];

  for (const [key, metricType, mode] of metrics) {
    try {
      const result = await readFirestoreMetric(env, accessToken, metricType, period, mode);
      firestore[key] = result.value;
      firestore.rows += result.rows;
      firestore.points += result.points;
    } catch (error) {
      partialErrors.push({ source: key, error: clean(error?.message || `${key}_failed`, 160) });
    }
  }

  const hasAnyData = firestore.rows > 0 || firestore.reads || firestore.writes || firestore.deletes || firestore.storageBytes;
  if (!hasAnyData && partialErrors.length >= metrics.length) {
    return json({ ok: false, error: 'firebase_usage_unavailable', partialErrors }, 502);
  }

  return json({
    ok: true,
    real: true,
    source: 'google-cloud-monitoring-api',
    period: {
      timezone: period.timezone,
      start: period.startIso,
      end: period.endIso,
    },
    firestore,
    auth: {
      dailyActiveUsers: 0,
      source: 'limit-reference-only',
    },
    limits: {
      firestoreReadsPerDay: FIRESTORE_FREE_READS_PER_DAY,
      firestoreWritesPerDay: FIRESTORE_FREE_WRITES_PER_DAY,
      firestoreDeletesPerDay: FIRESTORE_FREE_DELETES_PER_DAY,
      firestoreStorageBytes: FIRESTORE_FREE_STORAGE_BYTES,
      authDailyActiveUsers: FIREBASE_AUTH_FREE_DAU,
    },
    partialErrors,
    generatedAt: new Date().toISOString(),
  }, 200, 'private, no-store');
}


function boolInt(value) {
  return value ? 1 : 0;
}

function notificationRowToObject(row = {}) {
  return {
    id: clean(row.id || '', 140),
    type: clean(row.type || 'notice', 80),
    title: clean(row.title || '', 160),
    message: clean(row.message || '', 800),
    region: normalizeRegion(row.region),
    alliance: clean(row.alliance || '', 40).toUpperCase(),
    actorUid: clean(row.actor_uid || '', 160),
    actorName: clean(row.actor_name || '', 160),
    actorRole: clean(row.actor_role || '', 40),
    actorRoleText: clean(row.actor_role_text || '', 80),
    actorPhotoURL: clean(row.actor_photo_url || '', 300),
    targetType: clean(row.target_type || 'player', 40),
    targetLabel: clean(row.target_label || '', 160),
    replyToId: clean(row.reply_to_id || '', 140),
    replyToTitle: clean(row.reply_to_title || '', 160),
    replyToActorName: clean(row.reply_to_actor_name || '', 160),
    replyToCreatedAtMs: Number(row.reply_to_created_at_ms) || 0,
    createdAtMs: Number(row.created_at_ms) || 0,
    readAtMs: Number(row.read_at_ms) || 0,
    unread: Number(row.unread) !== 0,
    archived: Number(row.archived) === 1,
    source: 'd1-account'
  };
}

function sentMessageRowToObject(row = {}) {
  return {
    id: clean(row.id || '', 140),
    type: clean(row.type || 'sent_message', 80),
    title: clean(row.title || '', 160),
    message: clean(row.message || '', 800),
    region: normalizeRegion(row.region),
    alliance: clean(row.alliance || '', 40).toUpperCase(),
    targetType: clean(row.target_type || 'player', 40),
    targetLabel: clean(row.target_label || '', 160),
    recipientCount: Number(row.recipient_count) || 0,
    recipientPreview: clean(row.recipient_preview || '', 400),
    replyToId: clean(row.reply_to_id || '', 140),
    replyToTitle: clean(row.reply_to_title || '', 160),
    replyToActorName: clean(row.reply_to_actor_name || '', 160),
    replyToCreatedAtMs: Number(row.reply_to_created_at_ms) || 0,
    createdAtMs: Number(row.created_at_ms) || 0,
    archived: Number(row.archived) === 1,
    source: 'd1-sent'
  };
}

function campaignRowToObject(row = {}) {
  return {
    id: clean(row.id || '', 140),
    type: clean(row.type || 'region_campaign', 80),
    source: clean(row.source || 'campaign', 80) || 'campaign',
    region: normalizeRegion(row.region),
    cycleId: clean(row.cycle_id || '', 120),
    actorUid: clean(row.actor_uid || '', 160),
    actorName: clean(row.actor_name || '', 160),
    actorRole: clean(row.actor_role || '', 40),
    actorRoleText: clean(row.actor_role_text || '', 80),
    targetType: clean(row.target_type || 'region', 40),
    targetLabel: clean(row.target_label || '', 160),
    alliance: clean(row.alliance || '', 40).toUpperCase(),
    campaignGroupId: clean(row.campaign_group_id || '', 140),
    title: clean(row.title || '', 160),
    message: clean(row.message || '', 800),
    titleKey: clean(row.title_key || '', 180),
    messageKey: clean(row.message_key || '', 180),
    createdAtMs: Number(row.created_at_ms) || 0,
    expiresAtMs: Number(row.expires_at_ms) || 0,
    unread: true
  };
}

function summaryRowToObject(row = {}, uid = '') {
  return {
    id: 'summary',
    uid: clean(row.uid || uid, 160),
    unreadTotal: Math.max(0, Number(row.unread_total) || 0),
    campaignSeenAtMs: Math.max(0, Number(row.campaign_seen_at_ms) || 0),
    lastTitle: clean(row.last_title || '', 160),
    lastMessage: clean(row.last_message || '', 500),
    lastRegion: normalizeRegion(row.last_region),
    lastAlliance: clean(row.last_alliance || '', 40).toUpperCase(),
    lastActorUid: clean(row.last_actor_uid || '', 160),
    lastActorName: clean(row.last_actor_name || '', 160),
    lastActorRole: clean(row.last_actor_role || '', 40),
    lastTargetType: clean(row.last_target_type || '', 40),
    lastNotificationAtMs: Number(row.last_notification_at_ms) || 0,
    updatedAtMs: Number(row.updated_at_ms) || 0,
    source: 'cloudflare-d1-notifications'
  };
}

function notificationPayloadForDb(raw = {}, targetUid = '', actor = {}) {
  const nowMs = Number(raw.createdAtMs) || Date.now();
  return {
    id: clean(raw.id || `${nowMs}-${crypto.randomUUID()}`, 140),
    uid: clean(targetUid || raw.uid || raw.targetUid || '', 160),
    type: clean(raw.type || 'site_message', 80),
    title: clean(raw.title || 'Повідомлення', 160),
    message: clean(raw.message || raw.summary || '', 800),
    region: normalizeRegion(raw.region),
    alliance: clean(raw.alliance || '', 40).toUpperCase(),
    actorUid: clean(raw.actorUid || actor.uid || '', 160),
    actorName: clean(raw.actorName || actor.name || actor.email || actor.uid || '', 160),
    actorRole: clean(raw.actorRole || 'player', 40).toLowerCase(),
    actorRoleText: clean(raw.actorRoleText || '', 80),
    actorPhotoURL: clean(raw.actorPhotoURL || '', 300),
    targetType: clean(raw.targetType || 'player', 40),
    targetLabel: clean(raw.targetLabel || '', 160),
    replyToId: clean(raw.replyToId || '', 140),
    replyToTitle: clean(raw.replyToTitle || '', 160),
    replyToActorName: clean(raw.replyToActorName || '', 160),
    replyToCreatedAtMs: Number(raw.replyToCreatedAtMs) || 0,
    createdAtMs: nowMs,
    readAtMs: Number(raw.readAtMs) || 0,
    unread: raw.unread === false ? 0 : 1,
    archived: raw.archived === true ? 1 : 0,
  };
}

async function upsertNotificationSummaryForNew(db, uid = '', row = {}) {
  const nowMs = Date.now();
  await db.prepare(
    `INSERT INTO user_notification_summary (uid, unread_total, campaign_seen_at_ms, last_title, last_message, last_region, last_alliance, last_actor_uid, last_actor_name, last_actor_role, last_target_type, last_notification_at_ms, updated_at_ms)
     VALUES (?1, ?2, 0, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
     ON CONFLICT(uid) DO UPDATE SET
       unread_total = MAX(0, user_notification_summary.unread_total + ?2),
       last_title = excluded.last_title,
       last_message = excluded.last_message,
       last_region = excluded.last_region,
       last_alliance = excluded.last_alliance,
       last_actor_uid = excluded.last_actor_uid,
       last_actor_name = excluded.last_actor_name,
       last_actor_role = excluded.last_actor_role,
       last_target_type = excluded.last_target_type,
       last_notification_at_ms = excluded.last_notification_at_ms,
       updated_at_ms = excluded.updated_at_ms`
  ).bind(
    uid,
    Number(row.unread) !== 0 ? 1 : 0,
    row.title,
    row.message,
    row.region,
    row.alliance,
    row.actorUid,
    row.actorName,
    row.actorRole,
    row.targetType,
    row.createdAtMs,
    nowMs
  ).run();
}

async function adjustNotificationUnreadTotal(db, uid = '', delta = 0) {
  const safeUid = clean(uid, 160);
  if (!safeUid || !delta) return;
  const nowMs = Date.now();
  await db.prepare(
    `INSERT INTO user_notification_summary (uid, unread_total, updated_at_ms)
     VALUES (?1, MAX(0, ?2), ?3)
     ON CONFLICT(uid) DO UPDATE SET
       unread_total = MAX(0, user_notification_summary.unread_total + ?2),
       updated_at_ms = excluded.updated_at_ms`
  ).bind(safeUid, Number(delta) || 0, nowMs).run();
}

async function handleNotificationSummaryGet(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  const row = await db.prepare(`SELECT * FROM user_notification_summary WHERE uid = ?1 LIMIT 1`).bind(user.uid).first();
  return json({ ok: true, summary: summaryRowToObject(row || {}, user.uid), source: 'cloudflare-d1-notifications' });
}

async function handleNotificationSummaryPatch(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const uid = user.uid;
  const nowMs = Date.now();
  const existing = await db.prepare(`SELECT * FROM user_notification_summary WHERE uid = ?1 LIMIT 1`).bind(uid).first();
  const next = {
    unreadTotal: Object.hasOwn(body || {}, 'unreadTotal') ? Math.max(0, Math.min(99999, Number(body.unreadTotal) || 0)) : Math.max(0, Number(existing?.unread_total) || 0),
    campaignSeenAtMs: Object.hasOwn(body || {}, 'campaignSeenAtMs') ? Math.max(0, Number(body.campaignSeenAtMs) || 0) : Math.max(0, Number(existing?.campaign_seen_at_ms) || 0),
    lastTitle: Object.hasOwn(body || {}, 'lastTitle') ? clean(body.lastTitle, 160) : clean(existing?.last_title || '', 160),
    lastMessage: Object.hasOwn(body || {}, 'lastMessage') ? clean(body.lastMessage, 500) : clean(existing?.last_message || '', 500),
    lastRegion: Object.hasOwn(body || {}, 'lastRegion') ? normalizeRegion(body.lastRegion) : normalizeRegion(existing?.last_region),
    lastAlliance: Object.hasOwn(body || {}, 'lastAlliance') ? clean(body.lastAlliance, 40).toUpperCase() : clean(existing?.last_alliance || '', 40).toUpperCase(),
    lastActorUid: Object.hasOwn(body || {}, 'lastActorUid') ? clean(body.lastActorUid, 160) : clean(existing?.last_actor_uid || '', 160),
    lastActorName: Object.hasOwn(body || {}, 'lastActorName') ? clean(body.lastActorName, 160) : clean(existing?.last_actor_name || '', 160),
    lastActorRole: Object.hasOwn(body || {}, 'lastActorRole') ? clean(body.lastActorRole, 40) : clean(existing?.last_actor_role || '', 40),
    lastTargetType: Object.hasOwn(body || {}, 'lastTargetType') ? clean(body.lastTargetType, 40) : clean(existing?.last_target_type || '', 40),
    lastNotificationAtMs: Object.hasOwn(body || {}, 'lastNotificationAtMs') ? Math.max(0, Number(body.lastNotificationAtMs) || 0) : Math.max(0, Number(existing?.last_notification_at_ms) || 0),
    updatedAtMs: nowMs,
  };
  await db.prepare(
    `INSERT INTO user_notification_summary (uid, unread_total, campaign_seen_at_ms, last_title, last_message, last_region, last_alliance, last_actor_uid, last_actor_name, last_actor_role, last_target_type, last_notification_at_ms, updated_at_ms)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
     ON CONFLICT(uid) DO UPDATE SET
       unread_total = excluded.unread_total,
       campaign_seen_at_ms = excluded.campaign_seen_at_ms,
       last_title = excluded.last_title,
       last_message = excluded.last_message,
       last_region = excluded.last_region,
       last_alliance = excluded.last_alliance,
       last_actor_uid = excluded.last_actor_uid,
       last_actor_name = excluded.last_actor_name,
       last_actor_role = excluded.last_actor_role,
       last_target_type = excluded.last_target_type,
       last_notification_at_ms = excluded.last_notification_at_ms,
       updated_at_ms = excluded.updated_at_ms`
  ).bind(uid, next.unreadTotal, next.campaignSeenAtMs, next.lastTitle, next.lastMessage, next.lastRegion, next.lastAlliance, next.lastActorUid, next.lastActorName, next.lastActorRole, next.lastTargetType, next.lastNotificationAtMs, next.updatedAtMs).run();
  return json({ ok: true, summary: { uid, ...next }, source: 'cloudflare-d1-notifications' });
}

async function handleNotificationList(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  const url = new URL(request.url);
  const limitValue = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 50));
  const includeUnread = url.searchParams.get('includeUnread') !== '0';
  const recent = await db.prepare(
    `SELECT * FROM user_notifications WHERE uid = ?1 AND deleted = 0 ORDER BY created_at_ms DESC LIMIT ?2`
  ).bind(user.uid, limitValue).all();
  const map = new Map();
  (recent?.results || []).forEach(row => map.set(row.id, notificationRowToObject(row)));
  if (includeUnread) {
    const unread = await db.prepare(
      `SELECT * FROM user_notifications WHERE uid = ?1 AND deleted = 0 AND archived = 0 AND unread = 1 ORDER BY created_at_ms DESC LIMIT ?2`
    ).bind(user.uid, limitValue).all();
    (unread?.results || []).forEach(row => map.set(row.id, notificationRowToObject(row)));
  }
  const rows = [...map.values()].sort((a, b) => Number(b.createdAtMs) - Number(a.createdAtMs));
  return json({ ok: true, rows, source: 'cloudflare-d1-notifications' });
}

async function handleNotificationCreate(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const targetUid = clean(body?.targetUid || body?.uid || '', 160);
  if (!targetUid) return json({ ok: false, error: 'target_uid_required' }, 400);
  const row = notificationPayloadForDb(body || {}, targetUid, user);
  if (!row.message && !row.title) return json({ ok: false, error: 'message_required' }, 400);
  const existing = await db.prepare(`SELECT id, unread FROM user_notifications WHERE uid = ?1 AND id = ?2 LIMIT 1`).bind(row.uid, row.id).first();
  await db.prepare(
    `INSERT INTO user_notifications (id, uid, type, title, message, region, alliance, actor_uid, actor_name, actor_role, actor_role_text, actor_photo_url, target_type, target_label, reply_to_id, reply_to_title, reply_to_actor_name, reply_to_created_at_ms, created_at_ms, read_at_ms, unread, archived, deleted)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, 0)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       message = excluded.message,
       read_at_ms = excluded.read_at_ms,
       unread = excluded.unread,
       archived = excluded.archived,
       deleted = 0`
  ).bind(row.id, row.uid, row.type, row.title, row.message, row.region, row.alliance, row.actorUid, row.actorName, row.actorRole, row.actorRoleText, row.actorPhotoURL, row.targetType, row.targetLabel, row.replyToId, row.replyToTitle, row.replyToActorName, row.replyToCreatedAtMs, row.createdAtMs, row.readAtMs, row.unread, row.archived).run();
  if (!existing) {
    await upsertNotificationSummaryForNew(db, row.uid, row);
  }
  return json({ ok: true, notification: notificationRowToObject({
    id: row.id, uid: row.uid, type: row.type, title: row.title, message: row.message, region: row.region, alliance: row.alliance,
    actor_uid: row.actorUid, actor_name: row.actorName, actor_role: row.actorRole, actor_role_text: row.actorRoleText, actor_photo_url: row.actorPhotoURL,
    target_type: row.targetType, target_label: row.targetLabel, reply_to_id: row.replyToId, reply_to_title: row.replyToTitle, reply_to_actor_name: row.replyToActorName, reply_to_created_at_ms: row.replyToCreatedAtMs,
    created_at_ms: row.createdAtMs, read_at_ms: row.readAtMs, unread: row.unread, archived: row.archived
  }), source: 'cloudflare-d1-notifications' });
}

async function handleNotificationUpdate(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const id = clean(body?.id || '', 140);
  if (!id) return json({ ok: false, error: 'id_required' }, 400);
  const old = await db.prepare(`SELECT id, unread FROM user_notifications WHERE uid = ?1 AND id = ?2 AND deleted = 0 LIMIT 1`).bind(user.uid, id).first();
  if (!old) return json({ ok: false, error: 'notification_not_found' }, 404);
  const nowMs = Date.now();
  const readAtMs = body?.unread === false || body?.readAtMs ? (Number(body.readAtMs) || nowMs) : 0;
  const unread = body?.unread === false || body?.readAtMs ? 0 : (Object.hasOwn(body || {}, 'unread') ? boolInt(body.unread) : Number(old.unread));
  const archived = Object.hasOwn(body || {}, 'archived') ? boolInt(body.archived) : null;
  if (archived === null) {
    await db.prepare(`UPDATE user_notifications SET unread = ?3, read_at_ms = CASE WHEN ?4 > 0 THEN ?4 ELSE read_at_ms END WHERE uid = ?1 AND id = ?2`).bind(user.uid, id, unread, readAtMs).run();
  } else {
    await db.prepare(`UPDATE user_notifications SET unread = ?3, read_at_ms = CASE WHEN ?4 > 0 THEN ?4 ELSE read_at_ms END, archived = ?5 WHERE uid = ?1 AND id = ?2`).bind(user.uid, id, unread, readAtMs, archived).run();
  }
  if (Number(old.unread) === 1 && unread === 0) await adjustNotificationUnreadTotal(db, user.uid, -1);
  return json({ ok: true, id, source: 'cloudflare-d1-notifications' });
}

async function handleNotificationMarkRead(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const ids = [...new Set((Array.isArray(body?.ids) ? body.ids : [body?.id]).map(item => clean(item, 140)).filter(Boolean))].slice(0, 100);
  if (!ids.length) return json({ ok: true, marked: 0 });
  const placeholders = ids.map((_, index) => `?${index + 2}`).join(',');
  const selected = await db.prepare(`SELECT id FROM user_notifications WHERE uid = ?1 AND id IN (${placeholders}) AND unread = 1 AND deleted = 0`).bind(user.uid, ...ids).all();
  const markedIds = (selected?.results || []).map(row => clean(row.id, 140)).filter(Boolean);
  if (markedIds.length) {
    const markedPlaceholders = markedIds.map((_, index) => `?${index + 3}`).join(',');
    const nowMs = Date.now();
    await db.prepare(`UPDATE user_notifications SET unread = 0, read_at_ms = ?2 WHERE uid = ?1 AND id IN (${markedPlaceholders})`).bind(user.uid, nowMs, ...markedIds).run();
    await adjustNotificationUnreadTotal(db, user.uid, -markedIds.length);
  }
  return json({ ok: true, marked: markedIds.length, source: 'cloudflare-d1-notifications' });
}

async function handleNotificationDelete(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const ids = [...new Set((Array.isArray(body?.ids) ? body.ids : [body?.id]).map(item => clean(item, 140)).filter(Boolean))].slice(0, 100);
  if (!ids.length) return json({ ok: true, deleted: 0 });
  const placeholders = ids.map((_, index) => `?${index + 2}`).join(',');
  const selected = await db.prepare(`SELECT id FROM user_notifications WHERE uid = ?1 AND id IN (${placeholders}) AND unread = 1 AND deleted = 0`).bind(user.uid, ...ids).all();
  const unreadCount = (selected?.results || []).length;
  await db.prepare(`UPDATE user_notifications SET deleted = 1, unread = 0 WHERE uid = ?1 AND id IN (${placeholders})`).bind(user.uid, ...ids).run();
  if (unreadCount) await adjustNotificationUnreadTotal(db, user.uid, -unreadCount);
  return json({ ok: true, deleted: ids.length, source: 'cloudflare-d1-notifications' });
}

function sentPayloadForDb(raw = {}, uid = '') {
  const nowMs = Number(raw.createdAtMs) || Date.now();
  return {
    id: clean(raw.id || `${nowMs}-${crypto.randomUUID()}`, 140),
    uid: clean(uid || raw.uid || '', 160),
    type: clean(raw.type || 'sent_message', 80),
    title: clean(raw.title || 'Повідомлення', 160),
    message: clean(raw.message || '', 800),
    region: normalizeRegion(raw.region),
    alliance: clean(raw.alliance || '', 40).toUpperCase(),
    targetType: clean(raw.targetType || 'player', 40),
    targetLabel: clean(raw.targetLabel || '', 160),
    recipientCount: Math.max(0, Math.min(50000, Number(raw.recipientCount) || 0)),
    recipientPreview: clean(raw.recipientPreview || '', 400),
    replyToId: clean(raw.replyToId || '', 140),
    replyToTitle: clean(raw.replyToTitle || '', 160),
    replyToActorName: clean(raw.replyToActorName || '', 160),
    replyToCreatedAtMs: Number(raw.replyToCreatedAtMs) || 0,
    createdAtMs: nowMs,
    archived: raw.archived === true ? 1 : 0,
  };
}

async function handleSentMessagesList(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  const url = new URL(request.url);
  const limitValue = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 50));
  const result = await db.prepare(`SELECT * FROM user_sent_messages WHERE uid = ?1 AND deleted = 0 ORDER BY created_at_ms DESC LIMIT ?2`).bind(user.uid, limitValue).all();
  return json({ ok: true, rows: (result?.results || []).map(sentMessageRowToObject), source: 'cloudflare-d1-notifications' });
}

async function handleSentMessageCreate(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const row = sentPayloadForDb(body || {}, user.uid);
  await db.prepare(
    `INSERT INTO user_sent_messages (id, uid, type, title, message, region, alliance, target_type, target_label, recipient_count, recipient_preview, reply_to_id, reply_to_title, reply_to_actor_name, reply_to_created_at_ms, created_at_ms, archived, deleted)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, 0)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       message = excluded.message,
       archived = excluded.archived,
       deleted = 0`
  ).bind(row.id, row.uid, row.type, row.title, row.message, row.region, row.alliance, row.targetType, row.targetLabel, row.recipientCount, row.recipientPreview, row.replyToId, row.replyToTitle, row.replyToActorName, row.replyToCreatedAtMs, row.createdAtMs, row.archived).run();
  return json({ ok: true, sent: sentMessageRowToObject({
    id: row.id, uid: row.uid, type: row.type, title: row.title, message: row.message, region: row.region, alliance: row.alliance, target_type: row.targetType, target_label: row.targetLabel, recipient_count: row.recipientCount, recipient_preview: row.recipientPreview, reply_to_id: row.replyToId, reply_to_title: row.replyToTitle, reply_to_actor_name: row.replyToActorName, reply_to_created_at_ms: row.replyToCreatedAtMs, created_at_ms: row.createdAtMs, archived: row.archived
  }), source: 'cloudflare-d1-notifications' });
}

async function handleSentMessageUpdate(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const id = clean(body?.id || '', 140);
  if (!id) return json({ ok: false, error: 'id_required' }, 400);
  if (Object.hasOwn(body || {}, 'archived')) {
    await db.prepare(`UPDATE user_sent_messages SET archived = ?3 WHERE uid = ?1 AND id = ?2 AND deleted = 0`).bind(user.uid, id, boolInt(body.archived)).run();
  }
  return json({ ok: true, id, source: 'cloudflare-d1-notifications' });
}

async function handleSentMessageDelete(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const ids = [...new Set((Array.isArray(body?.ids) ? body.ids : [body?.id]).map(item => clean(item, 140)).filter(Boolean))].slice(0, 100);
  if (!ids.length) return json({ ok: true, deleted: 0 });
  const placeholders = ids.map((_, index) => `?${index + 2}`).join(',');
  await db.prepare(`UPDATE user_sent_messages SET deleted = 1 WHERE uid = ?1 AND id IN (${placeholders})`).bind(user.uid, ...ids).run();
  return json({ ok: true, deleted: ids.length, source: 'cloudflare-d1-notifications' });
}

function campaignPayloadForDb(raw = {}, actor = {}) {
  const nowMs = Number(raw.createdAtMs) || Date.now();
  const type = clean(raw.type || 'region_campaign', 80);
  const region = normalizeRegion(raw.region);
  const isSystem = isSystemCampaignType(type);
  return {
    id: clean(raw.id || `${nowMs}-${type.replace(/[^a-z0-9_-]/gi, '').slice(0, 50)}-${crypto.randomUUID()}`, 140),
    region,
    type,
    source: clean(raw.source || 'region-campaign', 80),
    cycleId: clean(raw.cycleId || '', 120),
    actorUid: clean(raw.actorUid || actor.uid || '', 160),
    actorName: clean(raw.actorName || actor.name || actor.email || actor.uid || '', 160),
    actorRole: clean(raw.actorRole || 'player', 40).toLowerCase(),
    actorRoleText: clean(raw.actorRoleText || '', 80),
    targetType: clean(raw.targetType || 'region', 40),
    targetLabel: clean(raw.targetLabel || (region ? `R${region}` : ''), 160),
    alliance: clean(raw.alliance || raw.targetAlliance || '', 40).toUpperCase(),
    campaignGroupId: clean(raw.campaignGroupId || '', 140),
    title: clean(raw.title || '', 160),
    message: clean(raw.message || raw.summary || '', 800),
    titleKey: clean(raw.titleKey || (type.startsWith('registration_') ? 'notifications.campaign.registrationOpenedTitle' : ''), 180),
    messageKey: clean(raw.messageKey || (type.startsWith('registration_') ? 'notifications.campaign.registrationOpenedMessage' : ''), 180),
    createdAtMs: nowMs,
    expiresAtMs: Number(raw.expiresAtMs) || (isSystem ? nowMs + 30 * 24 * 60 * 60 * 1000 : 0),
  };
}

async function handleCampaignCreate(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const row = campaignPayloadForDb(body || {}, user);
  if (!row.region) return json({ ok: false, error: 'region_required' }, 400);
  await db.prepare(
    `INSERT INTO notification_campaigns (id, region, type, source, cycle_id, actor_uid, actor_name, actor_role, actor_role_text, target_type, target_label, alliance, campaign_group_id, title, message, title_key, message_key, created_at_ms, expires_at_ms)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       message = excluded.message,
       title_key = excluded.title_key,
       message_key = excluded.message_key,
       expires_at_ms = excluded.expires_at_ms`
  ).bind(row.id, row.region, row.type, row.source, row.cycleId, row.actorUid, row.actorName, row.actorRole, row.actorRoleText, row.targetType, row.targetLabel, row.alliance, row.campaignGroupId, row.title, row.message, row.titleKey, row.messageKey, row.createdAtMs, row.expiresAtMs).run();
  return json({ ok: true, campaign: campaignRowToObject({
    id: row.id, region: row.region, type: row.type, source: row.source, cycle_id: row.cycleId, actor_uid: row.actorUid, actor_name: row.actorName, actor_role: row.actorRole, actor_role_text: row.actorRoleText, target_type: row.targetType, target_label: row.targetLabel, alliance: row.alliance, campaign_group_id: row.campaignGroupId, title: row.title, message: row.message, title_key: row.titleKey, message_key: row.messageKey, created_at_ms: row.createdAtMs, expires_at_ms: row.expiresAtMs
  }), source: 'cloudflare-d1-notifications' });
}

async function handleCampaignList(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  await verifyFirebaseToken(request, env);
  const url = new URL(request.url);
  const regions = [...new Set(clean(url.searchParams.get('regions') || '', 300).split(',').map(normalizeRegion).filter(Boolean))].slice(0, 10);
  if (!regions.length) return json({ ok: true, rows: [] });
  const sinceMs = Math.max(0, Number(url.searchParams.get('sinceMs')) || 0);
  const limitValue = Math.max(1, Math.min(80, Number(url.searchParams.get('limit')) || 30));
  const nowMs = Date.now();
  const placeholders = regions.map((_, index) => `?${index + 1}`).join(',');
  const params = [...regions, sinceMs, nowMs, limitValue];
  const result = await db.prepare(
    `SELECT * FROM notification_campaigns
      WHERE region IN (${placeholders})
        AND created_at_ms > ?${regions.length + 1}
        AND (expires_at_ms = 0 OR expires_at_ms > ?${regions.length + 2})
      ORDER BY created_at_ms DESC
      LIMIT ?${regions.length + 3}`
  ).bind(...params).all();
  return json({ ok: true, rows: (result?.results || []).map(campaignRowToObject), source: 'cloudflare-d1-notifications' });
}

async function handleContact(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const token = clean(env.TELEGRAM_BOT_TOKEN, 300);
  const chatId = clean(env.TELEGRAM_CHAT_ID, 120);

  if (!token || !chatId) {
    return json({ ok: false, error: "telegram_not_configured" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  // Honeypot. If a bot fills this hidden field, pretend success and do not send anything.
  if (clean(body.website, 100)) {
    return json({ ok: true });
  }

  const name = clean(body.name, 120);
  const nickname = clean(body.nickname, 120);
  const region = clean(body.region, 120);
  const alliance = clean(body.alliance, 40);
  const email = clean(body.email, 160);
  const message = clean(body.message, MAX_MESSAGE_LENGTH);
  const language = clean(body.language, 40);

  if (!message) {
    return json({ ok: false, error: "message_required" }, 400);
  }

  const country = request.cf?.country || "unknown";

  const telegramText = [
    "📩 Нове повідомлення з сайту Wasteland King Defenders",
    "",
    `👤 Імʼя: ${name || "Не вказано"}`,
    `🎮 Нік: ${nickname || "Не вказано"}`,
    `🛡 Альянс: ${alliance || "Не вказано"}`,
    `🌍 Регіон: ${region || "Не вказано"}`,
    `📧 Email/контакт: ${normalizeTelegramContact(email)}`,
    `🌐 Мова сайту: ${language || "Не вказано"}`,
    `📍 Країна: ${country}`,
    "",
    "💬 Повідомлення:",
    message,
  ]
    .filter(Boolean)
    .join("\n");

  const telegramResponse = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: telegramText,
        disable_web_page_preview: true,
      }),
    },
  );

  let telegramData = null;
  try {
    telegramData = await telegramResponse.json();
  } catch {}

  if (!telegramResponse.ok || telegramData?.ok !== true) {
    return json(
      {
        ok: false,
        error: "telegram_send_failed",
        telegram_status: telegramResponse.status,
        telegram_description: clean(telegramData?.description || "", 200),
      },
      502,
    );
  }

  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/api/contact") {
      return handleContact(request, env);
    }

    try {

      if (url.pathname === "/api/admin/usage/cloudflare" && request.method === "GET") {
        return await handleCloudflareUsage(request, env);
      }

      if (url.pathname === "/api/admin/usage/firebase" && request.method === "GET") {
        return await handleFirebaseUsage(request, env);
      }

      if (url.pathname === "/api/public-stats/player" && request.method === "POST") {
        return await handlePublicStatsPlayerUpsert(request, env);
      }

      if (url.pathname === "/api/public-stats/import" && request.method === "POST") {
        return await handlePublicStatsImport(request, env);
      }

      if (url.pathname === "/api/public-stats/export" && request.method === "GET") {
        return await handlePublicStatsExport(request, env);
      }



      if (url.pathname === "/api/notifications/summary" && request.method === "GET") {
        return await handleNotificationSummaryGet(request, env);
      }

      if (url.pathname === "/api/notifications/summary" && request.method === "POST") {
        return await handleNotificationSummaryPatch(request, env);
      }

      if (url.pathname === "/api/notifications" && request.method === "GET") {
        return await handleNotificationList(request, env);
      }

      if (url.pathname === "/api/notifications" && request.method === "POST") {
        return await handleNotificationCreate(request, env);
      }

      if (url.pathname === "/api/notifications/update" && request.method === "POST") {
        return await handleNotificationUpdate(request, env);
      }

      if (url.pathname === "/api/notifications/mark-read" && request.method === "POST") {
        return await handleNotificationMarkRead(request, env);
      }

      if (url.pathname === "/api/notifications/delete" && request.method === "POST") {
        return await handleNotificationDelete(request, env);
      }

      if (url.pathname === "/api/notifications/sent" && request.method === "GET") {
        return await handleSentMessagesList(request, env);
      }

      if (url.pathname === "/api/notifications/sent" && request.method === "POST") {
        return await handleSentMessageCreate(request, env);
      }

      if (url.pathname === "/api/notifications/sent/update" && request.method === "POST") {
        return await handleSentMessageUpdate(request, env);
      }

      if (url.pathname === "/api/notifications/sent/delete" && request.method === "POST") {
        return await handleSentMessageDelete(request, env);
      }

      if (url.pathname === "/api/notification-campaigns" && request.method === "GET") {
        return await handleCampaignList(request, env);
      }

      if (url.pathname === "/api/notification-campaigns" && request.method === "POST") {
        return await handleCampaignCreate(request, env);
      }

      if (url.pathname === "/api/d1-cleanup/scan" && request.method === "POST") {
        return await handleD1CleanupScan(request, env);
      }
      if (url.pathname === "/api/d1-cleanup/clear" && request.method === "POST") {
        return await handleD1CleanupClear(request, env);
      }
      if (url.pathname === "/api/action-log" && request.method === "GET") {
        return await handleActionLogList(request, env);
      }

      if (url.pathname === "/api/action-log" && request.method === "POST") {
        return await handleActionLogCreate(request, env);
      }

      if (url.pathname === "/api/action-log/delete" && request.method === "POST") {
        return await handleActionLogDelete(request, env);
      }

      if (url.pathname === "/api/action-log/clear" && request.method === "POST") {
        return await handleActionLogClear(request, env);
      }

      if (url.pathname === "/api/region-table" && request.method === "GET") {
        return await handleRegionTableRead(request, env);
      }

      if (
        url.pathname === "/api/region-table/registration" &&
        request.method === "POST"
      ) {
        return await handleRegionTableRegistration(request, env);
      }

      if (
        url.pathname === "/api/region-table/snapshot" &&
        request.method === "PUT"
      ) {
        return await handleRegionTableSnapshot(request, env);
      }

      if (
        url.pathname === "/api/region-table/share" &&
        request.method === "POST"
      ) {
        return await handleRegionTableShareCreate(request, env);
      }

      const shareMatch = url.pathname.match(
        /^\/api\/region-table\/share\/([A-Za-z0-9_-]{6,140})$/,
      );

      if (shareMatch && request.method === "GET") {
        return await handleRegionTableShareRead(request, env, shareMatch[1]);
      }
    } catch (error) {
      console.error("[WKD Worker]", error);
      const message = clean(error?.message || "worker_error", 120);
      const status = /auth|required|token/i.test(message)
        ? 401
        : /denied|forbidden|admin/i.test(message)
          ? 403
          : 500;
      return json({ ok: false, error: message }, status);
    }

    const formMatch = url.pathname.match(
      /^\/f\/(\d{1,8})\/([A-Za-z0-9_-]{6,80})$/,
    );
    if (formMatch) {
      return Response.redirect(
        `${url.origin}/region-form.html?r=${encodeURIComponent(formMatch[1])}&s=${encodeURIComponent(formMatch[2])}`,
        302,
      );
    }

    const planMatch = url.pathname.match(/^\/plan\/([A-Za-z0-9_-]{6,120})$/);
    if (planMatch) {
      return Response.redirect(
        `${url.origin}/public-plan.html?s=${encodeURIComponent(planMatch[1])}`,
        302,
      );
    }

    const regionTableMatch = url.pathname.match(
      /^\/rt\/([A-Za-z0-9_-]{6,120})$/,
    );
    if (regionTableMatch) {
      return Response.redirect(
        `${url.origin}/public-region-table.html?s=${encodeURIComponent(regionTableMatch[1])}`,
        302,
      );
    }

    if (url.pathname.startsWith("/api/")) {
      return json(
        {
          ok: false,
          error: "api_route_not_found",
          path: url.pathname,
          method: request.method,
        },
        404,
      );
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};
