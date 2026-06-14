const MAX_MESSAGE_LENGTH = 2000;
const MAX_FIELD_LENGTH = 300;
const MAX_TABLE_ROWS = 2000;
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let firebaseJwksCache = { expiresAt: 0, keys: null };
// TEST MODE: local-to-region global 24h cooldown is disabled temporarily.
const REGION_IMPORT_COOLDOWN_DISABLED = true;

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


const PUBLIC_SHARE_CACHE_VERSION = "v213";

function envNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function publicShareCacheSeconds(env) {
  return envNumber(env?.WKD_PUBLIC_SHARE_CACHE_SECONDS, 300, 0, 1800);
}

function isPublicShareCacheEnabled(env) {
  const raw = clean(env?.WKD_PUBLIC_SHARE_CACHE_ENABLED ?? "true", 20).toLowerCase();
  return !["0", "false", "off", "no", "disabled"].includes(raw);
}

function publicShareCacheBypass(request) {
  try {
    const url = new URL(request.url);
    return url.searchParams.get("refresh") === "1" || url.searchParams.get("nocache") === "1";
  } catch {
    return false;
  }
}

function publicShareCacheKey(request, type = "", code = "") {
  const origin = new URL(request.url).origin;
  return new Request(`${origin}/__wkd-public-share-cache/${PUBLIC_SHARE_CACHE_VERSION}/${clean(type, 20)}/${encodeURIComponent(normalizeCode(code))}`, { method: "GET" });
}

function publicShareCacheHeaders(cacheSeconds = 60, hit = "MISS") {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`,
    "X-WKD-Public-Cache": hit,
    "X-WKD-Public-Cache-Version": PUBLIC_SHARE_CACHE_VERSION,
    ...CORS_HEADERS,
  };
}

async function readPublicShareCache(request, env, type = "", code = "") {
  if (!isPublicShareCacheEnabled(env) || publicShareCacheSeconds(env) <= 0) return null;
  if (!globalThis.caches?.default || publicShareCacheBypass(request)) return null;
  const safeCode = normalizeCode(code);
  if (!safeCode) return null;
  try {
    const cached = await globalThis.caches.default.match(publicShareCacheKey(request, type, safeCode));
    if (!cached) return null;
    const text = await cached.text();
    let body = text;
    try {
      const data = JSON.parse(text);
      data.usage = { d1RowsRead: 0, d1RowsWritten: 0 };
      data.cache = { ...(data.cache || {}), hit: true, ttlSeconds: publicShareCacheSeconds(env), source: "public-share-cache" };
      body = JSON.stringify(data);
    } catch {}
    const headers = new Headers(cached.headers);
    headers.set("X-WKD-Public-Cache", "HIT");
    headers.set("X-WKD-Public-Cache-Version", PUBLIC_SHARE_CACHE_VERSION);
    return new Response(body, { status: cached.status, headers });
  } catch {
    return null;
  }
}

async function writePublicShareCache(request, env, type = "", code = "", payload = {}, maxSeconds = 0) {
  const baseTtl = publicShareCacheSeconds(env);
  const cacheSeconds = Math.max(0, Math.min(baseTtl, envNumber(maxSeconds || baseTtl, baseTtl, 0, baseTtl)));
  const response = new Response(JSON.stringify(payload), {
    status: 200,
    headers: publicShareCacheHeaders(cacheSeconds, "MISS"),
  });
  if (!isPublicShareCacheEnabled(env) || cacheSeconds <= 0 || !globalThis.caches?.default || publicShareCacheBypass(request)) {
    return response;
  }
  const safeCode = normalizeCode(code);
  if (!safeCode) return response;
  try {
    await globalThis.caches.default.put(publicShareCacheKey(request, type, safeCode), response.clone());
  } catch {}
  return response;
}

async function deletePublicShareCache(request, type = "", code = "") {
  if (!globalThis.caches?.default) return false;
  const safeCode = normalizeCode(code);
  if (!safeCode) return false;
  try {
    return await globalThis.caches.default.delete(publicShareCacheKey(request, type, safeCode));
  } catch {
    return false;
  }
}

async function deletePublicShareCaches(request, type = "", codes = []) {
  const unique = [...new Set((Array.isArray(codes) ? codes : []).map(normalizeCode).filter(Boolean))];
  let count = 0;
  for (const code of unique.slice(0, 500)) {
    if (await deletePublicShareCache(request, type, code)) count += 1;
  }
  return count;
}

function remainingCacheSecondsUntil(expiresAtMs = 0, fallbackSeconds = 60) {
  const expires = Number(expiresAtMs) || 0;
  if (!expires) return fallbackSeconds;
  return Math.max(0, Math.floor((expires - Date.now()) / 1000));
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

function makeD1SecretCode(prefix = '') {
  const safePrefix = clean(prefix, 12).replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 18);
  const time = Date.now().toString(36);
  return normalizeCode(`${safePrefix}${time}${random}`.slice(0, 48));
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


async function ensureD1Columns(db, tableName = '', columns = []) {
  const safeTables = new Set(['user_notifications', 'user_notification_summary', 'user_sent_messages', 'notification_campaigns', 'notification_directory']);
  if (!db || !safeTables.has(tableName)) return;
  let info = { results: [] };
  try { info = await db.prepare(`PRAGMA table_info(${tableName})`).all(); }
  catch (error) { console.warn(`[WKD Worker] Unable to inspect ${tableName}`, error); return; }
  const existing = new Set((info?.results || []).map(row => clean(row?.name || '', 80)).filter(Boolean));
  for (const column of columns) {
    const name = clean(column?.name || '', 80);
    const definition = String(column?.definition || '').trim();
    if (!name || !definition || existing.has(name)) continue;
    try {
      await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${name} ${definition}`).run();
      existing.add(name);
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (!message.includes('duplicate column')) {
        console.warn(`[WKD Worker] Unable to add ${tableName}.${name}`, error);
      }
    }
  }
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
      `CREATE TABLE IF NOT EXISTS region_table_rows (
        region TEXT NOT NULL,
        cycle_id TEXT NOT NULL,
        id TEXT NOT NULL,
        uid TEXT NOT NULL DEFAULT '',
        public_key TEXT NOT NULL DEFAULT '',
        farm_id TEXT NOT NULL DEFAULT '',
        nickname TEXT NOT NULL DEFAULT '',
        nickname_key TEXT NOT NULL DEFAULT '',
        alliance TEXT NOT NULL DEFAULT '',
        troop_type TEXT NOT NULL DEFAULT '',
        tier TEXT NOT NULL DEFAULT '',
        shift TEXT NOT NULL DEFAULT '',
        updated_at_ms INTEGER NOT NULL DEFAULT 0,
        row_json TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (region, cycle_id, id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_region_table_rows_cycle_updated ON region_table_rows(region, cycle_id, updated_at_ms DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_region_table_rows_uid ON region_table_rows(region, cycle_id, uid, farm_id)`,
      `CREATE INDEX IF NOT EXISTS idx_region_table_rows_public ON region_table_rows(region, cycle_id, public_key, farm_id)`,
      `CREATE INDEX IF NOT EXISTS idx_region_table_rows_nickname ON region_table_rows(region, cycle_id, nickname_key)`,
      `CREATE TABLE IF NOT EXISTS region_active (
        region TEXT PRIMARY KEY,
        cycle_id TEXT NOT NULL DEFAULT 'active',
        version INTEGER NOT NULL DEFAULT 0,
        updated_at_ms INTEGER NOT NULL DEFAULT 0,
        rows_count INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS region_cycles (
        region TEXT NOT NULL,
        cycle_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'archived',
        title TEXT NOT NULL DEFAULT '',
        event_start_at_ms INTEGER NOT NULL DEFAULT 0,
        rows_count INTEGER NOT NULL DEFAULT 0,
        created_at_ms INTEGER NOT NULL DEFAULT 0,
        archived_at_ms INTEGER NOT NULL DEFAULT 0,
        updated_at_ms INTEGER NOT NULL DEFAULT 0,
        opened_by_name TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (region, cycle_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_region_cycles_region_time ON region_cycles(region, updated_at_ms DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_region_cycles_region_status ON region_cycles(region, status, updated_at_ms DESC)`,
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
      `CREATE TABLE IF NOT EXISTS region_import_locks (
        region TEXT PRIMARY KEY,
        last_import_at_ms INTEGER NOT NULL DEFAULT 0,
        next_allowed_at_ms INTEGER NOT NULL DEFAULT 0,
        imported_by_uid TEXT NOT NULL DEFAULT '',
        imported_by_name TEXT NOT NULL DEFAULT '',
        rows_count INTEGER NOT NULL DEFAULT 0,
        mode TEXT NOT NULL DEFAULT '',
        updated_at_ms INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS idx_region_import_locks_next ON region_import_locks(next_allowed_at_ms)`,
      `CREATE INDEX IF NOT EXISTS idx_region_table_shares_region ON region_table_shares(region)`,
      `CREATE INDEX IF NOT EXISTS idx_region_tables_updated ON region_tables(updated_at_ms)`,
      `CREATE INDEX IF NOT EXISTS idx_region_table_shares_expires ON region_table_shares(expires_at_ms)`,
      `CREATE TABLE IF NOT EXISTS region_form_settings (
        region TEXT PRIMARY KEY,
        short_code TEXT NOT NULL DEFAULT '',
        cycle_id TEXT NOT NULL DEFAULT 'active',
        version INTEGER NOT NULL DEFAULT 0,
        updated_at_ms INTEGER NOT NULL DEFAULT 0,
        settings_json TEXT NOT NULL DEFAULT '{}'
      )`,
      `CREATE INDEX IF NOT EXISTS idx_region_form_settings_short_code ON region_form_settings(short_code)`,
      `CREATE TABLE IF NOT EXISTS final_plan_shares (
        code TEXT PRIMARY KEY,
        region TEXT NOT NULL,
        cycle_id TEXT NOT NULL DEFAULT 'active',
        event_start_at_ms INTEGER NOT NULL DEFAULT 0,
        title TEXT NOT NULL DEFAULT '',
        shift TEXT NOT NULL DEFAULT '',
        html TEXT NOT NULL DEFAULT '',
        text TEXT NOT NULL DEFAULT '',
        updated_at_ms INTEGER NOT NULL DEFAULT 0,
        updated_by TEXT NOT NULL DEFAULT '',
        updated_by_name TEXT NOT NULL DEFAULT '',
        expires_at_ms INTEGER NOT NULL DEFAULT 0,
        revoked INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS idx_final_plan_shares_region ON final_plan_shares(region)`,
      `CREATE INDEX IF NOT EXISTS idx_final_plan_shares_updated ON final_plan_shares(updated_at_ms)`,
      `CREATE INDEX IF NOT EXISTS idx_final_plan_shares_expires ON final_plan_shares(expires_at_ms)`,
      `CREATE TABLE IF NOT EXISTS region_tower_plans (
        region TEXT PRIMARY KEY,
        cycle_id TEXT NOT NULL DEFAULT 'active',
        version INTEGER NOT NULL DEFAULT 0,
        updated_at_ms INTEGER NOT NULL DEFAULT 0,
        updated_by TEXT NOT NULL DEFAULT '',
        updated_by_name TEXT NOT NULL DEFAULT '',
        plan_json TEXT NOT NULL DEFAULT '{}'
      )`,
      `CREATE INDEX IF NOT EXISTS idx_region_tower_plans_updated ON region_tower_plans(updated_at_ms)`,
      `CREATE TABLE IF NOT EXISTS region_alliances (
        region TEXT NOT NULL,
        tag TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        color_hue INTEGER,
        color_mode TEXT NOT NULL DEFAULT 'auto',
        updated_at_ms INTEGER NOT NULL DEFAULT 0,
        updated_by TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (region, tag)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_region_alliances_region ON region_alliances(region)`,
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
      `CREATE TABLE IF NOT EXISTS notification_directory (
        uid TEXT NOT NULL,
        farm_id TEXT NOT NULL DEFAULT 'main',
        nickname TEXT NOT NULL DEFAULT '',
        nickname_key TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        email_key TEXT NOT NULL DEFAULT '',
        display_name TEXT NOT NULL DEFAULT '',
        display_key TEXT NOT NULL DEFAULT '',
        photo_url TEXT NOT NULL DEFAULT '',
        region TEXT NOT NULL DEFAULT '',
        alliance TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'player',
        account_role TEXT NOT NULL DEFAULT 'player',
        rank TEXT NOT NULL DEFAULT '',
        shk TEXT NOT NULL DEFAULT '',
        farm_count INTEGER NOT NULL DEFAULT 0,
        updated_at_ms INTEGER NOT NULL DEFAULT 0,
        deleted INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (uid, farm_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_notification_directory_uid ON notification_directory(uid)`,
      `CREATE INDEX IF NOT EXISTS idx_notification_directory_region ON notification_directory(region)`,
      `CREATE INDEX IF NOT EXISTS idx_notification_directory_region_alliance ON notification_directory(region, alliance)`,
      `CREATE INDEX IF NOT EXISTS idx_notification_directory_role ON notification_directory(role)`,
      `CREATE INDEX IF NOT EXISTS idx_notification_directory_nick ON notification_directory(nickname_key)`,
    ];
    for (const statement of statements) {
      await db.prepare(statement).run();
    }
    await ensureD1Columns(db, 'user_notifications', [
      { name: 'actor_photo_url', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'target_type', definition: "TEXT NOT NULL DEFAULT 'player'" },
      { name: 'target_label', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'reply_to_id', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'reply_to_title', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'reply_to_actor_name', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'reply_to_created_at_ms', definition: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'archived', definition: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'deleted', definition: 'INTEGER NOT NULL DEFAULT 0' }
    ]);
    await ensureD1Columns(db, 'user_notification_summary', [
      { name: 'campaign_seen_at_ms', definition: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'last_region', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'last_alliance', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'last_actor_uid', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'last_actor_name', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'last_actor_role', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'last_target_type', definition: "TEXT NOT NULL DEFAULT ''" }
    ]);
    await ensureD1Columns(db, 'user_sent_messages', [
      { name: 'alliance', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'target_type', definition: "TEXT NOT NULL DEFAULT 'player'" },
      { name: 'target_label', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'recipient_count', definition: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'recipient_preview', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'reply_to_id', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'reply_to_title', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'reply_to_actor_name', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'reply_to_created_at_ms', definition: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'archived', definition: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'deleted', definition: 'INTEGER NOT NULL DEFAULT 0' }
    ]);
    await ensureD1Columns(db, 'notification_campaigns', [
      { name: 'source', definition: "TEXT NOT NULL DEFAULT 'region-campaign'" },
      { name: 'cycle_id', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'actor_uid', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'actor_name', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'actor_role', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'actor_role_text', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'target_type', definition: "TEXT NOT NULL DEFAULT 'region'" },
      { name: 'target_label', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'alliance', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'campaign_group_id', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'title', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'message', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'title_key', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'message_key', definition: "TEXT NOT NULL DEFAULT ''" },
      { name: 'created_at_ms', definition: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'expires_at_ms', definition: 'INTEGER NOT NULL DEFAULT 0' }
    ]);
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

function sanitizeCustomShifts(items = []) {
  return Array.isArray(items)
    ? items
        .map((item) => ({
          id: clean(item?.id || item?.value || '', 40),
          label: clean(item?.label || item?.name || item?.id || '', 80),
        }))
        .filter((item) => item.id)
        .slice(0, 20)
    : [];
}
function sanitizeCustomTroops(items = []) {
  return Array.isArray(items)
    ? items
        .map((item) => ({
          id: clean(item?.id || item?.value || '', 40),
          label: clean(item?.label || item?.name || item?.id || '', 80),
        }))
        .filter((item) => item.id)
        .slice(0, 20)
    : [];
}
function sanitizeCustomFields(items = []) {
  return Array.isArray(items)
    ? items
        .map((item) => ({
          id: clean(item?.id || '', 50),
          label: clean(item?.label || item?.id || '', 120),
          type: clean(item?.type || 'text', 20),
        }))
        .filter((item) => item.id)
        .slice(0, 20)
    : [];
}
function sanitizeRotationAlliances(items = []) {
  return Array.isArray(items)
    ? items
        .map((item) => ({
          tag: clean(item?.tag || item?.alliance || item?.name || '', 12),
          name: clean(item?.name || item?.label || item?.tag || '', 80),
        }))
        .filter((item) => item.tag)
        .slice(0, 80)
    : [];
}
function sanitizeSettings(settings = {}) {
  const customShifts = sanitizeCustomShifts(settings.customShifts || []);
  return {
    open: Boolean(settings.open),
    enabled: Boolean(settings.enabled),
    title: clean(settings.title || '', 160),
    description: clean(settings.description || '', 500),
    hostAlliance: clean(settings.hostAlliance || '', 12),
    governor: clean(settings.governor || '', 120),
    currentCycleId: normalizeCycleId(settings.currentCycleId || "active"),
    closeAtMs: Number(settings.closeAtMs) || 0,
    eventStartAtMs: Number(settings.eventStartAtMs || settings.startAtMs) || 0,
    startAtMs: Number(settings.startAtMs || settings.eventStartAtMs) || 0,
    openAtMs: Number(settings.openAtMs) || 0,
    openedAtMs: Number(settings.openedAtMs || settings.startedAtMs) || 0,
    closedAtMs: Number(settings.closedAtMs) || 0,
    openedByName: clean(settings.openedByName || settings.startedByName || "", 120),
    openedByEmail: clean(settings.openedByEmail || settings.startedByEmail || "", 160),
    openedByUid: clean(settings.openedByUid || settings.startedByUid || "", 160),
    closedByName: clean(settings.closedByName || "", 120),
    closedByUid: clean(settings.closedByUid || "", 160),
    shifts: Array.isArray(settings.shifts)
      ? settings.shifts.map((item) => clean(item, 40)).filter(Boolean).slice(0, 12)
      : [],
    customShifts,
    customTroopTypes: sanitizeCustomTroops(settings.customTroopTypes || []),
    customFields: sanitizeCustomFields(settings.customFields || []),
    allowExtraTroop: Boolean(settings.allowExtraTroop),
    minTier: clean(settings.minTier || '', 12).toUpperCase(),
    closeRule: clean(settings.closeRule || '', 40),
    closeHours: Number(settings.closeHours) || 0,
    autoOpenEnabled: Boolean(settings.autoOpenEnabled),
    autoOpenDay: Number(settings.autoOpenDay) || 0,
    autoOpenTime: clean(settings.autoOpenTime || '', 10),
    rotationEnabled: Boolean(settings.rotationEnabled),
    rotationLoop: Boolean(settings.rotationLoop),
    rotationActiveIndex: Number(settings.rotationActiveIndex) || 0,
    rotationAlliances: sanitizeRotationAlliances(settings.rotationAlliances || []),
    updatedAtMs: Number(settings.updatedAtMs) || 0,
    updatedByName: clean(settings.updatedByName || '', 120),
  };
}


const WKD_FORM_DEFAULT_CLOSE_HOURS = 24;
function firstPositiveD1Ms(...values) {
  for (const value of values) {
    const number = Number(value) || 0;
    if (number > 0) return number;
  }
  return 0;
}
function isRegionFormOpenD1(settings = {}, nowMs = Date.now()) {
  const enabled = Boolean(settings.enabled || settings.open);
  if (!enabled) return false;
  const startAtMs = firstPositiveD1Ms(settings.eventStartAtMs, settings.startAtMs);
  const closeHours = Math.max(1, Math.min(168, Number(settings.closeHours) || WKD_FORM_DEFAULT_CLOSE_HOURS));
  const closeAtMs = firstPositiveD1Ms(settings.closeAtMs, settings.registrationCloseAtMs, startAtMs ? startAtMs - closeHours * 60 * 60 * 1000 : 0);
  const openAtMs = firstPositiveD1Ms(settings.openAtMs, settings.registrationOpenAtMs, settings.openedAtMs, settings.startedAtMs);
  if (openAtMs && nowMs < openAtMs) return false;
  if (closeAtMs && nowMs >= closeAtMs) return false;
  if (startAtMs && nowMs >= startAtMs + 2 * 60 * 60 * 1000) return false;
  return true;
}
function isRegionFormSubmission(body = {}) {
  if (body?.updateOnly || body?.adminEdit || body?.skipFormStatusCheck) return false;
  const source = clean(body?.row?.source || '', 60).toLowerCase();
  return Boolean(body?.publicLink || body?.shareCode || source.includes('registration') || source.includes('account-d1') || source.includes('public-link'));
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
    alliance: clean(row.alliance || "", 12),
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
    submittedAtMs: Number(row.submittedAtMs || row.registeredAtMs || 0) || 0,
    registeredAtMs: Number(row.registeredAtMs || row.submittedAtMs || 0) || 0,
    createdAtMs: Number(row.createdAtMs || 0) || 0,
    updatedAtMs: Number(row.updatedAtMs || row.submittedAtMs || row.registeredAtMs || row.createdAtMs || Date.now()) || Date.now(),
  };
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function d1RegionTableRowToObject(row = {}, region = '', cycleId = '') {
  const parsed = parseJson(row.row_json, {});
  return sanitizeTableRow({
    ...(parsed && typeof parsed === 'object' ? parsed : {}),
    id: row.id || parsed?.id,
    uid: row.uid || parsed?.uid,
    publicKey: row.public_key || parsed?.publicKey,
    farmId: row.farm_id || parsed?.farmId,
    nickname: row.nickname || parsed?.nickname,
    alliance: row.alliance || parsed?.alliance,
    troopType: row.troop_type || parsed?.troopType,
    tier: row.tier || parsed?.tier,
    shift: row.shift || parsed?.shift,
    region: region || row.region || parsed?.region,
    cycleId: cycleId || row.cycle_id || parsed?.cycleId,
    updatedAtMs: Number(row.updated_at_ms || parsed?.updatedAtMs || 0) || Date.now(),
  });
}

function rowToTable(row = {}, rowsOverride = null) {
  if (!row) return null;
  const legacyRows = parseJson(row.rows_json, []);
  const settings = parseJson(row.settings_json, {});
  const region = normalizeRegion(row.region);
  const cycleId = normalizeCycleId(row.cycle_id || "active");
  const rows = Array.isArray(rowsOverride)
    ? rowsOverride
    : (Array.isArray(legacyRows)
        ? legacyRows.map(item => sanitizeTableRow({ ...item, region, cycleId })).filter((item) => item.nickname).slice(0, MAX_TABLE_ROWS)
        : []);
  return {
    region,
    cycleId,
    version: Number(row.version) || 0,
    updatedAtMs: Number(row.updated_at_ms) || 0,
    settings: sanitizeSettings(settings),
    rows,
  };
}

async function readTableMeta(db, region, cycleId = "active") {
  await ensureRegionTableSchema(db);
  const row = await db
    .prepare(
      `SELECT region, cycle_id, version, updated_at_ms, settings_json, rows_json
       FROM region_tables
      WHERE region = ?1 AND cycle_id = ?2`,
    )
    .bind(region, normalizeCycleId(cycleId))
    .first();
  return row || null;
}

function tableRowsWhere(region, cycleId = 'active', options = {}) {
  const safeRegion = normalizeRegion(region);
  const safeCycle = normalizeCycleId(cycleId || 'active');
  const binds = [safeRegion, safeCycle];
  const parts = ['region = ?1', 'cycle_id = ?2'];
  const add = (sql, value) => { binds.push(value); parts.push(sql.replace('?', `?${binds.length}`)); };
  const search = clean(options.search || '', 120).toLowerCase();
  if (search) {
    add(`(nickname_key LIKE ? OR lower(alliance) LIKE ? OR lower(troop_type) LIKE ? OR lower(tier) LIKE ? OR lower(shift) LIKE ? OR lower(row_json) LIKE ?)`, `%${search}%`);
    const last = binds.length;
    for (let i = 0; i < 5; i += 1) binds.push(binds[last - 1]);
    parts[parts.length - 1] = `(nickname_key LIKE ?${last} OR lower(alliance) LIKE ?${last + 1} OR lower(troop_type) LIKE ?${last + 2} OR lower(tier) LIKE ?${last + 3} OR lower(shift) LIKE ?${last + 4} OR lower(row_json) LIKE ?${last + 5})`;
  }
  const alliance = clean(options.alliance || '', 12);
  if (alliance) add('alliance LIKE ?', `%${alliance}%`);
  const troop = clean(options.troop || '', 40).toLowerCase();
  if (troop && troop !== 'all') add('lower(troop_type) = ?', troop);
  const tier = clean(options.tier || '', 12).toUpperCase();
  if (tier && tier !== 'ALL') add('upper(tier) = ?', tier);
  const shift = clean(options.shift || '', 40).toLowerCase();
  if (shift && shift !== 'all') add('lower(shift) = ?', shift);
  return { safeRegion, safeCycle, where: parts.join(' AND '), binds };
}

function tableRowsOrder(options = {}) {
  const field = clean(options.sort || options.sortField || '', 40);
  const dir = String(options.dir || options.sortDir || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const numericDir = dir;
  const textDir = dir;
  const map = {
    nickname: `nickname_key ${textDir}`,
    alliance: `alliance COLLATE NOCASE ${textDir}, nickname_key ASC`,
    troopType: `troop_type COLLATE NOCASE ${textDir}, nickname_key ASC`,
    tier: `CAST(REPLACE(upper(tier), 'T', '') AS INTEGER) ${numericDir}, nickname_key ASC`,
    marchSize: `CAST(json_extract(row_json, '$.marchSize') AS INTEGER) ${numericDir}, nickname_key ASC`,
    rallySize: `CAST(json_extract(row_json, '$.rallySize') AS INTEGER) ${numericDir}, nickname_key ASC`,
    captainReady: `CAST(json_extract(row_json, '$.captainReady') AS INTEGER) ${numericDir}, nickname_key ASC`,
    shift: `shift COLLATE NOCASE ${textDir}, nickname_key ASC`
  };
  return map[field] || `updated_at_ms DESC, nickname_key ASC`;
}

async function readTableRows(db, region, cycleId = "active", options = {}) {
  await ensureRegionTableSchema(db);
  const limit = Math.max(1, Math.min(MAX_TABLE_ROWS, Number(options.limit || MAX_TABLE_ROWS) || MAX_TABLE_ROWS));
  const offset = Math.max(0, Number(options.offset || 0) || 0);
  const scope = tableRowsWhere(region, cycleId, options);
  const query = `SELECT region, cycle_id, id, uid, public_key, farm_id, nickname, nickname_key, alliance, troop_type, tier, shift, updated_at_ms, row_json
                 FROM region_table_rows
                WHERE ${scope.where}
                ORDER BY ${tableRowsOrder(options)} LIMIT ?${scope.binds.length + 1} OFFSET ?${scope.binds.length + 2}`;
  const result = await db.prepare(query).bind(...scope.binds, limit, offset).all();
  return (result?.results || []).map(row => d1RegionTableRowToObject(row, scope.safeRegion, scope.safeCycle)).filter(row => row.nickname);
}

async function countTableRows(db, region, cycleId = "active", options = {}) {
  await ensureRegionTableSchema(db);
  const scope = tableRowsWhere(region, cycleId, options);
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM region_table_rows WHERE ${scope.where}`).bind(...scope.binds).first();
  return Math.max(0, Number(row?.count || 0) || 0);
}

async function readTable(db, region, cycleId = "active") {
  await ensureRegionTableSchema(db);
  const safeRegion = normalizeRegion(region);
  const safeCycle = normalizeCycleId(cycleId || 'active');
  const meta = await readTableMeta(db, safeRegion, safeCycle);
  if (!meta) return null;
  const rows = await readTableRows(db, safeRegion, safeCycle);
  if (rows.length) return rowToTable(meta, rows);
  return rowToTable(meta);
}

async function getActiveCycleId(db, region) {
  await ensureRegionTableSchema(db);
  const active = await db
    .prepare(`SELECT cycle_id FROM region_active WHERE region = ?1`)
    .bind(region)
    .first();
  return normalizeCycleId(active?.cycle_id || "active");
}

async function getActiveTable(db, region) {
  const cycleId = await getActiveCycleId(db, region);
  return readTable(db, region, cycleId);
}

function tableRowBindValues(region, cycleId, row = {}) {
  const cleanRow = sanitizeTableRow({ ...row, region, cycleId });
  const rowJson = JSON.stringify(cleanRow);
  return [
    region,
    cycleId,
    cleanRow.id,
    cleanRow.uid || '',
    cleanRow.publicKey || '',
    cleanRow.farmId || '',
    cleanRow.nickname || '',
    normalizedNickname(cleanRow.nickname || ''),
    cleanRow.alliance || '',
    cleanRow.troopType || '',
    cleanRow.tier || '',
    cleanRow.shift || '',
    Number(cleanRow.updatedAtMs || Date.now()) || Date.now(),
    rowJson,
  ];
}

function upsertTableRowStatement(db, region, cycleId, row = {}) {
  return db.prepare(
    `INSERT INTO region_table_rows (region, cycle_id, id, uid, public_key, farm_id, nickname, nickname_key, alliance, troop_type, tier, shift, updated_at_ms, row_json)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
     ON CONFLICT(region, cycle_id, id) DO UPDATE SET
       uid = excluded.uid,
       public_key = excluded.public_key,
       farm_id = excluded.farm_id,
       nickname = excluded.nickname,
       nickname_key = excluded.nickname_key,
       alliance = excluded.alliance,
       troop_type = excluded.troop_type,
       tier = excluded.tier,
       shift = excluded.shift,
       updated_at_ms = excluded.updated_at_ms,
       row_json = excluded.row_json`
  ).bind(...tableRowBindValues(region, cycleId, row));
}

async function updateTableMeta(db, table, rowsCount = 0) {
  await ensureRegionTableSchema(db);
  const region = normalizeRegion(table.region);
  const cycleId = normalizeCycleId(table.cycleId || table.settings?.currentCycleId || "active");
  const version = Number(table.version) > 0 ? Number(table.version) : Date.now();
  const updatedAtMs = Date.now();
  const settings = sanitizeSettings({ ...(table.settings || {}), currentCycleId: cycleId });
  const settingsJson = JSON.stringify(settings);
  const count = Math.max(0, Number(rowsCount || 0) || 0);
  await db.batch([
    db.prepare(
      `INSERT INTO region_tables (region, cycle_id, version, updated_at_ms, settings_json, rows_json)
       VALUES (?1, ?2, ?3, ?4, ?5, '[]')
       ON CONFLICT(region, cycle_id) DO UPDATE SET
         version = excluded.version,
         updated_at_ms = excluded.updated_at_ms,
         settings_json = excluded.settings_json,
         rows_json = '[]'`
    ).bind(region, cycleId, version, updatedAtMs, settingsJson),
    db.prepare(
      `INSERT INTO region_active (region, cycle_id, version, updated_at_ms, rows_count)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(region) DO UPDATE SET
         cycle_id = excluded.cycle_id,
         version = excluded.version,
         updated_at_ms = excluded.updated_at_ms,
         rows_count = excluded.rows_count`
    ).bind(region, cycleId, version, updatedAtMs, count),
    db.prepare(
      `UPDATE region_cycles
          SET status = 'archived', archived_at_ms = CASE WHEN archived_at_ms > 0 THEN archived_at_ms ELSE ?3 END, updated_at_ms = CASE WHEN updated_at_ms > 0 THEN updated_at_ms ELSE ?3 END
        WHERE region = ?1 AND cycle_id != ?2 AND status != 'deleted'`
    ).bind(region, cycleId, updatedAtMs),
    db.prepare(
      `INSERT INTO region_cycles (region, cycle_id, status, title, event_start_at_ms, rows_count, created_at_ms, archived_at_ms, updated_at_ms, opened_by_name)
       VALUES (?1, ?2, 'active', ?3, ?4, ?5, ?6, 0, ?7, ?8)
       ON CONFLICT(region, cycle_id) DO UPDATE SET
         status = 'active',
         title = excluded.title,
         event_start_at_ms = excluded.event_start_at_ms,
         rows_count = excluded.rows_count,
         updated_at_ms = excluded.updated_at_ms,
         opened_by_name = excluded.opened_by_name`
    ).bind(region, cycleId, clean(settings.title || '', 160), Number(settings.eventStartAtMs || settings.startAtMs || 0) || 0, count, updatedAtMs, updatedAtMs, clean(settings.openedByName || settings.updatedByName || '', 160)),
  ]);
  return { region, cycleId, version, updatedAtMs, settings, rows: [] };
}

async function saveTable(db, table) {
  await ensureRegionTableSchema(db);
  const region = normalizeRegion(table.region);
  const cycleId = normalizeCycleId(table.cycleId || table.settings?.currentCycleId || "active");
  const rows = (Array.isArray(table.rows) ? table.rows : [])
    .map((row) => sanitizeTableRow({ ...row, region, cycleId }))
    .filter((row) => row.nickname)
    .slice(0, MAX_TABLE_ROWS);
  await db.prepare(`DELETE FROM region_table_rows WHERE region = ?1 AND cycle_id = ?2`).bind(region, cycleId).run();
  const chunkSize = 100;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize).map(row => upsertTableRowStatement(db, region, cycleId, row));
    if (chunk.length) await db.batch(chunk);
  }
  const meta = await updateTableMeta(db, { ...table, region, cycleId }, rows.length);
  return { ...meta, rows };
}

async function migrateLegacyTableRowsIfNeeded(db, meta) {
  if (!meta) return 0;
  const region = normalizeRegion(meta.region);
  const cycleId = normalizeCycleId(meta.cycle_id || 'active');
  const existing = await countTableRows(db, region, cycleId).catch(() => 0);
  if (existing > 0) return 0;
  const legacy = rowToTable(meta);
  const rows = Array.isArray(legacy?.rows) ? legacy.rows : [];
  if (!rows.length) return 0;
  const chunkSize = 100;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize).map(row => upsertTableRowStatement(db, region, cycleId, row));
    if (chunk.length) await db.batch(chunk);
  }
  await updateTableMeta(db, { region, cycleId, version: Number(meta.version || 0) || Date.now(), settings: parseJson(meta.settings_json, {}) }, rows.length);
  return rows.length;
}

function allianceRowToObject(row = {}) {
  if (!row) return null;
  const tag = clean(row.tag || '', 12);
  if (!tag) return null;
  const hueNumber = Number(row.color_hue);
  return {
    id: tag,
    tag,
    region: normalizeRegion(row.region),
    name: clean(row.name || tag, 80),
    note: clean(row.note || '', 160),
    colorHue: Number.isFinite(hueNumber) ? ((Math.round(hueNumber) % 360) + 360) % 360 : null,
    colorMode: clean(row.color_mode || 'auto', 40),
    updatedAtMs: Number(row.updated_at_ms) || 0,
    updatedBy: clean(row.updated_by || '', 160),
  };
}

function sanitizeAlliancePayload(item = {}, region = '') {
  const tag = clean(item?.tag || item?.id || '', 12);
  if (!tag) return null;
  const hueNumber = Number(item?.colorHue);
  const colorHue = Number.isFinite(hueNumber) ? ((Math.round(hueNumber) % 360) + 360) % 360 : null;
  return {
    id: tag,
    tag,
    region: normalizeRegion(region || item?.region),
    name: clean(item?.name || tag, 80),
    note: clean(item?.note || '', 160),
    colorHue,
    colorMode: colorHue === null ? 'auto' : clean(item?.colorMode || 'manual', 40),
    updatedAtMs: Number(item?.updatedAtMs) || Date.now(),
  };
}

async function activeRegionHasUid(db, region, uid) {
  const safeRegion = normalizeRegion(region);
  const safeUid = clean(uid || '', 160);
  if (!safeRegion || !safeUid) return false;
  const cycleId = await getActiveCycleId(db, safeRegion).catch(() => 'active');
  const row = await db.prepare(
    `SELECT id FROM region_table_rows WHERE region = ?1 AND cycle_id = ?2 AND uid = ?3 LIMIT 1`
  ).bind(safeRegion, cycleId, safeUid).first().catch(() => null);
  if (row?.id) return true;
  const legacy = await readTable(db, safeRegion, cycleId).catch(() => null);
  return tableContainsUid(legacy, safeUid);
}

async function canWriteRegionD1(db, env, user, region) {
  if (!user?.uid || !region) return false;
  if (isAdminUid(env, user.uid) || await hasSavedRegionAccess(db, user.uid, region)) return true;
  return activeRegionHasUid(db, region, user.uid);
}

async function handleRegionAlliancesRead(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  const url = new URL(request.url);
  const region = normalizeRegion(url.searchParams.get('region'));
  if (!region) return json({ ok: false, error: 'region_required' }, 400);
  const allowed = isAdminUid(env, user.uid) || await hasSavedRegionAccess(db, user.uid, region) || await activeRegionHasUid(db, region, user.uid);
  if (!allowed) return json({ ok: false, error: 'region_access_denied' }, 403);
  const result = await db.prepare(`SELECT region, tag, name, note, color_hue, color_mode, updated_at_ms, updated_by FROM region_alliances WHERE region = ?1 ORDER BY tag ASC`).bind(region).all();
  const items = (result?.results || []).map(allianceRowToObject).filter(Boolean);
  return json({ ok: true, region, items, version: Date.now(), usage: { d1RowsRead: Math.max(1, items.length) }, source: 'cloudflare-d1-region-alliances' }, 200, 'private, no-store');
}

async function handleRegionAlliancesPut(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const region = normalizeRegion(body?.region || body?.alliance?.region);
  const item = sanitizeAlliancePayload(body?.alliance || body, region);
  if (!region || !item?.tag) return json({ ok: false, error: 'alliance_tag_required' }, 400);
  if (!await canWriteRegionD1(db, env, user, region)) return json({ ok: false, error: 'region_access_denied' }, 403);
  const nowMs = Date.now();
  await db.prepare(`INSERT INTO region_alliances (region, tag, name, note, color_hue, color_mode, updated_at_ms, updated_by)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    ON CONFLICT(region, tag) DO UPDATE SET
      name = excluded.name,
      note = excluded.note,
      color_hue = excluded.color_hue,
      color_mode = excluded.color_mode,
      updated_at_ms = excluded.updated_at_ms,
      updated_by = excluded.updated_by`).bind(region, item.tag, item.name || item.tag, item.note || '', item.colorHue, item.colorMode || 'auto', nowMs, clean(user.uid, 160)).run();
  await grantRegionAccess(db, region, user.uid, 'alliance-color');
  return json({ ok: true, region, item: { ...item, updatedAtMs: nowMs, updatedBy: user.uid }, usage: { d1RowsWritten: 1 }, source: 'cloudflare-d1-region-alliances' });
}

async function handleRegionAlliancesDelete(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const region = normalizeRegion(body?.region);
  const tag = clean(body?.tag || body?.id || '', 12);
  if (!region || !tag) return json({ ok: false, error: 'alliance_tag_required' }, 400);
  if (!await canWriteRegionD1(db, env, user, region)) return json({ ok: false, error: 'region_access_denied' }, 403);
  await db.prepare(`DELETE FROM region_alliances WHERE region = ?1 AND tag = ?2`).bind(region, tag).run();
  return json({ ok: true, region, tag, usage: { d1RowsWritten: 1 }, source: 'cloudflare-d1-region-alliances' });
}


function formSettingsRowToObject(row = {}) {
  if (!row) return null;
  const settings = parseJson(row.settings_json, {});
  return {
    region: normalizeRegion(row.region),
    code: normalizeCode(row.short_code || ''),
    cycleId: normalizeCycleId(row.cycle_id || settings.currentCycleId || 'active'),
    version: Number(row.version) || 0,
    updatedAtMs: Number(row.updated_at_ms) || 0,
    settings: sanitizeSettings(settings),
  };
}

async function readRegionFormSettingsD1(db, region) {
  await ensureRegionTableSchema(db);
  const safeRegion = normalizeRegion(region);
  if (!safeRegion) return null;
  const row = await db
    .prepare(`SELECT region, short_code, cycle_id, version, updated_at_ms, settings_json FROM region_form_settings WHERE region = ?1 LIMIT 1`)
    .bind(safeRegion)
    .first();
  return formSettingsRowToObject(row);
}

async function readRegionFormShareD1(db, codeValue = '') {
  await ensureRegionTableSchema(db);
  const code = normalizeCode(codeValue);
  if (!code) return null;
  const row = await db
    .prepare(`SELECT region, short_code, cycle_id, version, updated_at_ms, settings_json FROM region_form_settings WHERE short_code = ?1 LIMIT 1`)
    .bind(code)
    .first();
  return formSettingsRowToObject(row);
}

async function saveRegionFormSettingsD1(db, payload = {}) {
  await ensureRegionTableSchema(db);
  const region = normalizeRegion(payload.region);
  if (!region) throw new Error('region_required');
  const settings = sanitizeSettings(payload.settings || {});
  const cycleId = normalizeCycleId(payload.cycleId || settings.currentCycleId || 'active');
  const code = normalizeCode(payload.code || payload.shortCode || '');
  const nowMs = Number(payload.updatedAtMs) || Date.now();
  await db.prepare(
    `INSERT INTO region_form_settings (region, short_code, cycle_id, version, updated_at_ms, settings_json)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(region) DO UPDATE SET
       short_code = CASE WHEN excluded.short_code <> '' THEN excluded.short_code ELSE region_form_settings.short_code END,
       cycle_id = excluded.cycle_id,
       version = excluded.version,
       updated_at_ms = excluded.updated_at_ms,
       settings_json = excluded.settings_json`
  ).bind(region, code, cycleId, nowMs, nowMs, JSON.stringify({ ...settings, currentCycleId: cycleId })).run();
  return { region, code, cycleId, version: nowMs, updatedAtMs: nowMs, settings: { ...settings, currentCycleId: cycleId } };
}

async function handleRegionFormSettingsRead(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const url = new URL(request.url);
  const region = normalizeRegion(url.searchParams.get('region'));
  if (!region) return json({ ok: false, error: 'region_required' }, 400);
  const form = await readRegionFormSettingsD1(db, region);
  if (!form) return json({ ok: false, error: 'form_settings_not_found' }, 404);
  return json({ ok: true, form, usage: { d1RowsRead: 1 }, source: 'cloudflare-d1-form-settings' }, 200, 'public, max-age=60');
}

async function handleRegionFormShareRead(request, env, codeValue) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const code = normalizeCode(codeValue);
  if (!code) return json({ ok: false, error: 'share_code_required' }, 400);
  const form = await readRegionFormShareD1(db, code);
  if (!form) return json({ ok: false, error: 'share_not_found' }, 404);
  return json({ ok: true, form, usage: { d1RowsRead: 1 }, source: 'cloudflare-d1-form-settings' }, 200, 'public, max-age=60');
}

async function handleRegionFormSettingsPut(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const region = normalizeRegion(body?.region || body?.settings?.region);
  if (!region) return json({ ok: false, error: 'region_required' }, 400);
  const allowed = isAdminUid(env, user.uid) || await hasSavedRegionAccess(db, user.uid, region);
  if (!allowed) return json({ ok: false, error: 'region_access_denied' }, 403);
  const form = await saveRegionFormSettingsD1(db, {
    region,
    code: body?.code || body?.shortCode || '',
    cycleId: body?.cycleId || body?.settings?.currentCycleId || 'active',
    updatedAtMs: body?.updatedAtMs,
    settings: body?.settings || {},
  });
  await grantRegionAccess(db, region, user.uid, 'form-settings');
  return json({ ok: true, form, usage: { d1RowsWritten: 1 }, source: 'cloudflare-d1-form-settings' });
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


function cycleMetaFromTable(table = {}, activeCycleId = '') {
  const settings = sanitizeSettings(table.settings || {});
  return {
    region: normalizeRegion(table.region),
    cycleId: normalizeCycleId(table.cycleId || settings.currentCycleId || 'active'),
    status: normalizeCycleId(table.cycleId || settings.currentCycleId || 'active') === normalizeCycleId(activeCycleId || '') ? 'active' : 'archived',
    title: clean(settings.title || '', 160),
    eventStartAtMs: Number(settings.eventStartAtMs || settings.startAtMs || 0) || 0,
    rowsCount: Array.isArray(table.rows) ? table.rows.length : 0,
    createdAtMs: Number(settings.openedAtMs || settings.updatedAtMs || table.updatedAtMs || 0) || 0,
    archivedAtMs: 0,
    updatedAtMs: Number(table.updatedAtMs || table.version || settings.updatedAtMs || 0) || 0,
    openedByName: clean(settings.openedByName || settings.updatedByName || '', 160),
  };
}

function cycleMetaFromRow(row = {}, activeCycleId = '') {
  const cycleId = normalizeCycleId(row.cycle_id || 'active');
  return {
    region: normalizeRegion(row.region || ''),
    cycleId,
    status: clean(row.status || (cycleId === normalizeCycleId(activeCycleId || '') ? 'active' : 'archived'), 30),
    title: clean(row.title || '', 160),
    eventStartAtMs: Number(row.event_start_at_ms || 0) || 0,
    rowsCount: Number(row.rows_count || 0) || 0,
    createdAtMs: Number(row.created_at_ms || 0) || 0,
    archivedAtMs: Number(row.archived_at_ms || 0) || 0,
    updatedAtMs: Number(row.updated_at_ms || 0) || 0,
    openedByName: clean(row.opened_by_name || '', 160),
  };
}

async function canReadRegionArchive(db, env, user, region) {
  if (!user?.uid || !region) return false;
  if (isAdminUid(env, user.uid)) return true;
  if (await hasSavedRegionAccess(db, user.uid, region)) return true;
  return activeRegionHasUid(db, region, user.uid);
}

async function handleRegionCycleArchiveList(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  const url = new URL(request.url);
  const region = normalizeRegion(url.searchParams.get('region'));
  const includeActive = url.searchParams.get('includeActive') === '1';
  if (!region) return json({ ok: false, error: 'region_required' }, 400);
  if (!await canReadRegionArchive(db, env, user, region)) return json({ ok: false, error: 'region_access_denied' }, 403);
  const active = await db.prepare(`SELECT cycle_id FROM region_active WHERE region = ?1 LIMIT 1`).bind(region).first();
  const activeCycleId = normalizeCycleId(active?.cycle_id || 'active');
  const indexed = await db.prepare(
    `SELECT region, cycle_id, status, title, event_start_at_ms, rows_count, created_at_ms, archived_at_ms, updated_at_ms, opened_by_name
       FROM region_cycles
      WHERE region = ?1 AND (?2 = 1 OR cycle_id != ?3)
      ORDER BY updated_at_ms DESC
      LIMIT 60`
  ).bind(region, includeActive ? 1 : 0, activeCycleId).all();
  const cycles = new Map();
  for (const row of (indexed?.results || [])) {
    const meta = cycleMetaFromRow(row, activeCycleId);
    if (meta.region && meta.cycleId && meta.status !== 'deleted') cycles.set(meta.cycleId, meta);
  }
  const tableRows = await db.prepare(
    `SELECT region, cycle_id, version, updated_at_ms, settings_json, rows_json
       FROM region_tables
      WHERE region = ?1 AND (?2 = 1 OR cycle_id != ?3)
      ORDER BY updated_at_ms DESC
      LIMIT 60`
  ).bind(region, includeActive ? 1 : 0, activeCycleId).all();
  for (const row of (tableRows?.results || [])) {
    const table = rowToTable(row);
    if (!table?.cycleId || cycles.has(table.cycleId)) continue;
    cycles.set(table.cycleId, cycleMetaFromTable(table, activeCycleId));
  }
  const list = [...cycles.values()]
    .filter(item => includeActive || item.cycleId !== activeCycleId)
    .sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
  return json({ ok: true, region, activeCycleId, cycles: list, usage: { d1RowsRead: list.length }, source: 'cloudflare-d1-cycle-archive' }, 200, 'private, no-store');
}

async function handleRegionCycleArchiveRead(request, env, cycleIdValue) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  const url = new URL(request.url);
  const region = normalizeRegion(url.searchParams.get('region'));
  const cycleId = normalizeCycleId(cycleIdValue || '');
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.max(5, Math.min(100, Number(url.searchParams.get('pageSize')) || 20));
  const search = clean(url.searchParams.get('search') || '', 120).toLowerCase();
  if (!region || !cycleId) return json({ ok: false, error: 'region_cycle_required' }, 400);
  if (!await canReadRegionArchive(db, env, user, region)) return json({ ok: false, error: 'region_access_denied' }, 403);
  const activeCycleId = await getActiveCycleId(db, region).catch(() => 'active');
  const meta = await readTableMeta(db, region, cycleId);
  if (!meta) return json({ ok: false, error: 'cycle_not_found' }, 404);
  let totalRows = await countTableRows(db, region, cycleId, { search });
  let safePage = Math.max(1, page);
  let pageRows = [];
  if (totalRows > 0) {
    const totalPagesForRows = Math.max(1, Math.ceil(totalRows / pageSize));
    safePage = Math.min(page, totalPagesForRows);
    pageRows = await readTableRows(db, region, cycleId, { search, limit: pageSize, offset: (safePage - 1) * pageSize });
  } else {
    const table = rowToTable(meta);
    let rows = (Array.isArray(table?.rows) ? table.rows : []).map(row => sanitizeTableRow({ ...row, region }));
    if (search) {
      rows = rows.filter(row => [row.nickname, row.alliance, row.troopLabel, row.troopType, row.tier, row.shiftLabel, row.shift]
        .some(value => clean(value || '', 200).toLowerCase().includes(search)));
    }
    totalRows = rows.length;
    const legacyTotalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    safePage = Math.min(page, legacyTotalPages);
    pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  }
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const metaRow = await db.prepare(
    `SELECT region, cycle_id, status, title, event_start_at_ms, rows_count, created_at_ms, archived_at_ms, updated_at_ms, opened_by_name
       FROM region_cycles WHERE region = ?1 AND cycle_id = ?2 LIMIT 1`
  ).bind(region, cycleId).first().catch(() => null);
  const table = rowToTable(meta, pageRows);
  const cycle = metaRow ? cycleMetaFromRow(metaRow, activeCycleId) : cycleMetaFromTable({ ...table, rows: pageRows }, activeCycleId);
  return json({
    ok: true,
    cycle,
    page: safePage,
    pageSize,
    totalRows,
    totalPages,
    search,
    table: { ...table, rows: pageRows },
    source: 'cloudflare-d1-cycle-archive-rows',
    usage: { d1RowsRead: pageRows.length }
  }, 200, 'private, no-store');
}

async function handleRegionTableRead(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  const url = new URL(request.url);
  const region = normalizeRegion(url.searchParams.get("region"));
  if (!region) return json({ ok: false, error: "region_required" }, 400);
  const cycleId = await getActiveCycleId(db, region);
  const meta = await readTableMeta(db, region, cycleId);
  if (!meta) return json({ ok: false, error: "table_not_found" }, 404);
  await migrateLegacyTableRowsIfNeeded(db, meta);
  const allowed =
    isAdminUid(env, user.uid) ||
    await hasSavedRegionAccess(db, user.uid, region) ||
    await activeRegionHasUid(db, region, user.uid);
  if (!allowed) return json({ ok: false, error: "region_access_denied" }, 403);

  const requestedPage = Number(url.searchParams.get('page') || 0) || 0;
  const requestedPageSize = Number(url.searchParams.get('pageSize') || 0) || 0;
  const hasServerFilters = requestedPage > 0 || requestedPageSize > 0 || ['search','alliance','troop','tier','shift','sort','dir'].some(key => url.searchParams.has(key));
  const settings = sanitizeSettings(parseJson(meta.settings_json, {}));
  if (!hasServerFilters) {
    const rows = await readTableRows(db, region, cycleId);
    const table = rowToTable(meta, rows);
    return json({ ok: true, table, source: 'cloudflare-d1-region-table-rows', usage: { d1RowsRead: rows.length } }, 200, "private, no-store");
  }

  const pageSize = Math.max(10, Math.min(100, requestedPageSize || 20));
  const page = Math.max(1, requestedPage || 1);
  const filters = {
    search: clean(url.searchParams.get('search') || '', 120),
    alliance: clean(url.searchParams.get('alliance') || '', 12),
    troop: clean(url.searchParams.get('troop') || '', 40),
    tier: clean(url.searchParams.get('tier') || '', 12),
    shift: clean(url.searchParams.get('shift') || '', 40),
    sort: clean(url.searchParams.get('sort') || '', 40),
    dir: clean(url.searchParams.get('dir') || '', 8)
  };
  const totalRows = await countTableRows(db, region, cycleId, filters);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = await readTableRows(db, region, cycleId, { ...filters, limit: pageSize, offset: (safePage - 1) * pageSize });
  const table = rowToTable(meta, rows);
  table.settings = settings;
  return json({ ok: true, table, page: safePage, pageSize, totalRows, totalPages, filters, source: 'cloudflare-d1-region-table-rows-paged', usage: { d1RowsRead: rows.length + 1 } }, 200, "private, no-store");
}

async function findRegionTableRow(db, region, cycleId, lookup = {}) {
  const safeRegion = normalizeRegion(region);
  const safeCycle = normalizeCycleId(cycleId || 'active');
  const id = clean(lookup.id || '', 180);
  const uid = clean(lookup.uid || '', 160);
  const publicKey = clean(lookup.publicKey || '', 160);
  const farmId = clean(lookup.farmId || 'main', 80) || 'main';
  let row = null;
  if (id) {
    row = await db.prepare(
      `SELECT * FROM region_table_rows WHERE region = ?1 AND cycle_id = ?2 AND id = ?3 LIMIT 1`
    ).bind(safeRegion, safeCycle, id).first().catch(() => null);
  }
  if (!row && uid) {
    row = await db.prepare(
      `SELECT * FROM region_table_rows WHERE region = ?1 AND cycle_id = ?2 AND uid = ?3 AND farm_id = ?4 LIMIT 1`
    ).bind(safeRegion, safeCycle, uid, farmId).first().catch(() => null);
  }
  if (!row && publicKey) {
    row = await db.prepare(
      `SELECT * FROM region_table_rows WHERE region = ?1 AND cycle_id = ?2 AND public_key = ?3 AND farm_id = ?4 LIMIT 1`
    ).bind(safeRegion, safeCycle, publicKey, farmId).first().catch(() => null);
  }
  return row ? d1RegionTableRowToObject(row, safeRegion, safeCycle) : null;
}

async function findDuplicateNicknameRow(db, region, cycleId, nicknameKey, self = {}) {
  const key = clean(nicknameKey || '', 120).toLowerCase();
  if (!key) return null;
  const result = await db.prepare(
    `SELECT * FROM region_table_rows WHERE region = ?1 AND cycle_id = ?2 AND nickname_key = ?3 LIMIT 25`
  ).bind(region, cycleId, key).all().catch(() => ({ results: [] }));
  const rows = (result?.results || []).map(row => d1RegionTableRowToObject(row, region, cycleId));
  const selfId = clean(self.id || '', 180);
  const selfUid = clean(self.uid || '', 160);
  const selfPublic = clean(self.publicKey || '', 160);
  const selfFarm = clean(self.farmId || 'main', 80) || 'main';
  return rows.find(item => {
    if (selfId && item.id === selfId) return false;
    if (selfUid && item.uid === selfUid && item.farmId === selfFarm) return false;
    if (selfPublic && item.publicKey === selfPublic && item.farmId === selfFarm) return false;
    return true;
  }) || null;
}

async function handleRegionTableRegistration(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  const user = await optionalFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  const region = normalizeRegion(body?.region || body?.row?.region);
  const requestedCycleRaw = clean(body?.cycleId || body?.settings?.currentCycleId || body?.row?.cycleId || "", 90);
  let cycleId = normalizeCycleId(requestedCycleRaw || "active");
  if (!region) return json({ ok: false, error: "region_required" }, 400);

  const isPublicRegistration = Boolean(body?.publicLink || body?.shareCode || body?.row?.publicKey);
  if (!user?.uid && !isPublicRegistration) return json({ ok: false, error: "auth_required" }, 401);

  let canonicalForm = null;
  if (!user?.uid) {
    const shareCode = normalizeCode(body?.shareCode || "");
    if (!shareCode) return json({ ok: false, error: "share_code_required" }, 403);
    canonicalForm = await readRegionFormShareD1(db, shareCode);
    if (!canonicalForm) return json({ ok: false, error: "share_not_found" }, 404);
    if (normalizeRegion(canonicalForm.region) !== region) return json({ ok: false, error: "share_region_mismatch" }, 403);
    if (normalizeCycleId(canonicalForm.cycleId || "active") !== cycleId) return json({ ok: false, error: "share_cycle_mismatch" }, 409);
    if (!isRegionFormOpenD1(canonicalForm.settings || {})) return json({ ok: false, error: "region_form_closed" }, 423, "private, no-store");
  }

  const rawRow = body?.row && typeof body.row === "object" ? body.row : {};
  let meta = null;
  if (body?.updateOnly && !requestedCycleRaw) {
    cycleId = await getActiveCycleId(db, region);
    meta = await readTableMeta(db, region, cycleId);
  } else {
    meta = await readTableMeta(db, region, cycleId);
  }
  canonicalForm = canonicalForm || await readRegionFormSettingsD1(db, region).catch(() => null);
  const currentSettings = sanitizeSettings({ ...(parseJson(meta?.settings_json, {}) || {}), ...(canonicalForm?.settings || {}), currentCycleId: cycleId });
  if (isRegionFormSubmission(body)) {
    if (!canonicalForm) return json({ ok: false, error: "region_form_settings_not_found" }, 404, "private, no-store");
    if (canonicalForm?.cycleId && normalizeCycleId(canonicalForm.cycleId) !== cycleId) return json({ ok: false, error: "region_form_cycle_mismatch" }, 409, "private, no-store");
    if (!isRegionFormOpenD1(currentSettings)) return json({ ok: false, error: "region_form_closed" }, 423, "private, no-store");
  }
  if (meta) await migrateLegacyTableRowsIfNeeded(db, meta);
  const rawId = clean(rawRow.id || "", 180);
  const rawUid = clean(rawRow.uid || "", 160);
  const rawPublicKey = clean(rawRow.publicKey || "", 160);
  const rawFarmId = clean(rawRow.farmId || "main", 80) || "main";
  let existingRow = await findRegionTableRow(db, region, cycleId, { id: rawId, uid: rawUid, publicKey: rawPublicKey, farmId: rawFarmId });

  if (!existingRow && meta) {
    const legacy = rowToTable(meta);
    const rows = Array.isArray(legacy.rows) ? legacy.rows : [];
    existingRow = rows.find(item =>
      (rawId && item.id === rawId) ||
      (rawUid && item.uid === rawUid && item.farmId === rawFarmId) ||
      (rawPublicKey && item.publicKey === rawPublicKey && item.farmId === rawFarmId)
    ) || null;
  }
  if (body?.updateOnly && !existingRow) return json({ ok: false, error: "region_row_not_found" }, 404);

  const mergedRawRow = {
    ...(existingRow || {}),
    ...rawRow,
    region,
    uid: user?.uid ? (rawRow.uid || existingRow?.uid || (!existingRow ? user.uid : "")) : (rawRow.uid || existingRow?.uid || ""),
  };
  const row = sanitizeTableRow(mergedRawRow);
  if (!row.nickname) return json({ ok: false, error: "registration_nickname_required" }, 400);

  const isOwner = Boolean(user?.uid && (row.uid === user.uid || !row.uid));
  const canWrite = user?.uid
    ? (isOwner || isAdminUid(env, user.uid) || await canWriteRegionD1(db, env, user, region))
    : Boolean(isPublicRegistration && row.nickname && row.publicKey);
  if (!canWrite) return json({ ok: false, error: "row_owner_mismatch" }, 403);

  const key = row.id || `${row.uid || row.publicKey || "guest"}:${row.farmId || "main"}`;
  const nextRow = { ...row, id: existingRow?.id || key };
  const duplicate = await findDuplicateNicknameRow(db, region, cycleId, normalizedNickname(nextRow.nickname), nextRow);
  if (duplicate) return json({ ok: false, error: "registration-nickname-duplicate-region" }, 409);

  const unchanged = existingRow ? sameRegistrationData(existingRow, nextRow) : false;
  const forceUpdate = Boolean(body?.forceUpdate);
  if (existingRow && unchanged && !forceUpdate) {
    return json({ ok: true, version: Number(meta?.version || 0) || 0, rowsCount: await countTableRows(db, region, cycleId), existing: true, unchanged: true, notWritten: true, action: "unchanged", row: existingRow });
  }

  const nowMs = Date.now();
  const savedRow = sanitizeTableRow({ ...nextRow, submittedAtMs: existingRow?.submittedAtMs || nextRow.submittedAtMs || nowMs, registeredAtMs: existingRow?.registeredAtMs || nextRow.registeredAtMs || nextRow.submittedAtMs || nowMs, updatedAtMs: nowMs });
  await upsertTableRowStatement(db, region, cycleId, savedRow).run();
  const rowsCount = await countTableRows(db, region, cycleId);
  const table = await updateTableMeta(db, { region, cycleId, version: nowMs, settings: currentSettings }, rowsCount);
  if (user?.uid) await grantRegionAccess(db, region, user.uid, "registration");
  if (user?.uid && savedRow.uid && savedRow.uid !== user.uid) await grantRegionAccess(db, region, savedRow.uid, "registration-row");
  return json({ ok: true, version: table.version, rowsCount, existing: Boolean(existingRow), unchanged: false, action: existingRow ? "updated" : "created", row: savedRow, source: 'cloudflare-d1-region-table-rows', usage: { d1RowsRead: 1, d1RowsWritten: 1 } });
}

async function handleMyRegionTableRegistration(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  const url = new URL(request.url);
  const region = normalizeRegion(url.searchParams.get("region"));
  const farmId = clean(url.searchParams.get("farmId") || "main", 80) || "main";
  const requestedCycleId = normalizeCycleId(url.searchParams.get("cycleId") || "");
  if (!region) return json({ ok: false, error: "region_required" }, 400);
  const cycleId = requestedCycleId || await getActiveCycleId(db, region);
  const registration = await findRegionTableRow(db, region, cycleId, { uid: user.uid, farmId });
  if (registration) {
    return json({ ok: true, registration: { ...registration, cycleId, region }, source: "cloudflare-d1-region-table-rows" }, 200, "private, no-store");
  }
  const table = await readTable(db, region, cycleId);
  const legacyRows = Array.isArray(table?.rows) ? table.rows.map(sanitizeTableRow) : [];
  const legacyRegistration = legacyRows.find(row => row.uid === user.uid && (row.farmId || "main") === farmId) || null;
  return json({
    ok: true,
    registration: legacyRegistration ? { ...legacyRegistration, cycleId, region } : null,
    source: "cloudflare-d1-region-table"
  }, 200, "private, no-store");
}

async function handleRegionTableSnapshot(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  const region = normalizeRegion(body?.region);
  if (!region || !await canWriteRegionD1(db, env, user, region))
    return json({ ok: false, error: "region_access_denied" }, 403);
  const requestedCycleRaw = clean(body?.cycleId || body?.settings?.currentCycleId || "", 90);
  let cycleId = normalizeCycleId(requestedCycleRaw || "active");
  if (!region) return json({ ok: false, error: "region_required" }, 400);
  const rows = (Array.isArray(body?.rows) ? body.rows : [])
    .map((row) => sanitizeTableRow({ ...row, region }))
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


async function handleRegionTableDeleteRows(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  const region = normalizeRegion(body?.region);
  const ids = (Array.isArray(body?.ids) ? body.ids : [body?.id]).map(item => clean(item || '', 180)).filter(Boolean).slice(0, 500);
  if (!region || !ids.length) return json({ ok: false, error: "delete_rows_required" }, 400);
  const cycleId = await getActiveCycleId(db, region);
  const meta = await readTableMeta(db, region, cycleId).catch(() => null);
  if (meta) await migrateLegacyTableRowsIfNeeded(db, meta);
  const allowed = isAdminUid(env, user.uid) || await hasSavedRegionAccess(db, user.uid, region) || await activeRegionHasUid(db, region, user.uid);
  if (!allowed) return json({ ok: false, error: "region_access_denied" }, 403);
  const placeholders = ids.map((_, index) => `?${index + 3}`).join(',');
  const result = await db.prepare(
    `DELETE FROM region_table_rows WHERE region = ?1 AND cycle_id = ?2 AND id IN (${placeholders})`
  ).bind(region, cycleId, ...ids).run();
  const deleted = Math.max(0, Number(result?.meta?.changes || 0) || 0);
  const rowsCount = await countTableRows(db, region, cycleId);
  if (deleted > 0) await updateTableMeta(db, { region, cycleId, version: Date.now(), settings: { currentCycleId: cycleId } }, rowsCount);
  return json({ ok: true, region, deleted, rowsCount, usage: { d1RowsRead: 1, d1RowsWritten: deleted > 0 ? deleted + 1 : 0 }, source: "cloudflare-d1-region-table-rows" });
}

async function handleRegionImportLockRead(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  const url = new URL(request.url);
  const region = normalizeRegion(url.searchParams.get("region"));
  if (!region) return json({ ok: false, error: "region_required" }, 400);
  const row = await db.prepare(`SELECT region, last_import_at_ms, next_allowed_at_ms, imported_by_uid, imported_by_name, rows_count, mode, updated_at_ms FROM region_import_locks WHERE region = ?1 LIMIT 1`).bind(region).first();
  const nowMs = Date.now();
  const nextAllowedAtMs = Number(row?.next_allowed_at_ms || 0) || 0;
  const remainingMs = REGION_IMPORT_COOLDOWN_DISABLED ? 0 : Math.max(0, nextAllowedAtMs - nowMs);
  return json({
    ok: true,
    cooldownDisabled: REGION_IMPORT_COOLDOWN_DISABLED,
    lock: {
      region,
      locked: REGION_IMPORT_COOLDOWN_DISABLED ? false : remainingMs > 0,
      remainingMs,
      nextAllowedAtMs: REGION_IMPORT_COOLDOWN_DISABLED ? 0 : nextAllowedAtMs,
      lastImportAtMs: Number(row?.last_import_at_ms || 0) || 0,
      importedByUid: clean(row?.imported_by_uid || '', 160),
      importedByName: clean(row?.imported_by_name || '', 160),
      rowsCount: Number(row?.rows_count || 0) || 0,
      mode: clean(row?.mode || '', 40),
      updatedAtMs: Number(row?.updated_at_ms || 0) || 0,
    },
    usage: { d1RowsRead: 1 }
  }, 200, "private, no-store");
}

async function handleRegionImportLockCommit(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: "d1_not_configured" }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  const region = normalizeRegion(body?.region);
  if (!region) return json({ ok: false, error: "region_required" }, 400);
  const nowMs = Date.now();
  const existing = await db.prepare(`SELECT next_allowed_at_ms FROM region_import_locks WHERE region = ?1 LIMIT 1`).bind(region).first();
  const existingNext = Number(existing?.next_allowed_at_ms || 0) || 0;
  if (!REGION_IMPORT_COOLDOWN_DISABLED && existingNext > nowMs) {
    return json({ ok: false, error: "region_import_cooldown", lock: { region, locked: true, remainingMs: existingNext - nowMs, nextAllowedAtMs: existingNext }, usage: { d1RowsRead: 1 } }, 429, "private, no-store");
  }
  const nextAllowedAtMs = REGION_IMPORT_COOLDOWN_DISABLED ? nowMs : nowMs + 24 * 60 * 60 * 1000;
  const actorName = clean(body?.actorName || user.name || user.email || user.uid || '', 160);
  const mode = clean(body?.mode || '', 40);
  const rowsCount = Math.max(0, Number(body?.rowsCount || body?.count || 0) || 0);
  await db.prepare(`INSERT INTO region_import_locks (region, last_import_at_ms, next_allowed_at_ms, imported_by_uid, imported_by_name, rows_count, mode, updated_at_ms)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?2)
    ON CONFLICT(region) DO UPDATE SET
      last_import_at_ms = excluded.last_import_at_ms,
      next_allowed_at_ms = excluded.next_allowed_at_ms,
      imported_by_uid = excluded.imported_by_uid,
      imported_by_name = excluded.imported_by_name,
      rows_count = excluded.rows_count,
      mode = excluded.mode,
      updated_at_ms = excluded.updated_at_ms`).bind(region, nowMs, nextAllowedAtMs, user.uid || '', actorName, rowsCount, mode).run();
  return json({ ok: true, cooldownDisabled: REGION_IMPORT_COOLDOWN_DISABLED, lock: { region, locked: REGION_IMPORT_COOLDOWN_DISABLED ? false : true, remainingMs: REGION_IMPORT_COOLDOWN_DISABLED ? 0 : nextAllowedAtMs - nowMs, nextAllowedAtMs: REGION_IMPORT_COOLDOWN_DISABLED ? 0 : nextAllowedAtMs, lastImportAtMs: nowMs, importedByUid: user.uid || '', importedByName: actorName, rowsCount, mode }, usage: { d1RowsRead: 1, d1RowsWritten: 1 } }, 200, "private, no-store");
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
  await deletePublicShareCache(request, "region-table", code);
  await deletePublicShareCache(request, "snapshot-region-table", code);
  return json({ ok: true, code, region, cycleId });
}


async function buildRegionTableSharePayload(env, codeValue) {
  const code = normalizeCode(codeValue);
  if (!code) return { response: json({ ok: false, error: "share_code_required" }, 400) };
  const db = regionTableDb(env);
  if (!db) return { response: json({ ok: false, error: "d1_not_configured" }, 500) };
  await ensureRegionTableSchema(db);
  const share = await db
    .prepare(
      `SELECT code, region, cycle_id, expires_at_ms, revoked FROM region_table_shares WHERE code = ?1 LIMIT 1`,
    )
    .bind(code)
    .first();
  if (!share || Number(share.revoked) === 1)
    return { response: json({ ok: false, error: "share_not_found" }, 404) };
  if (
    Number(share.expires_at_ms) > 0 &&
    Number(share.expires_at_ms) < Date.now()
  )
    return { response: json({ ok: false, error: "share_expired" }, 410) };
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
  return {
    code,
    expiresAtMs: Number(share.expires_at_ms || 0) || 0,
    payload: {
      ok: true,
      table: { ...table, region, cycleId },
      usage: { d1RowsRead: Math.max(1, Number(table?.rows?.length || 0) + 1), d1RowsWritten: 0 },
      cache: { enabled: isPublicShareCacheEnabled(env), ttlSeconds: publicShareCacheSeconds(env), source: "public-share-cache" },
    }
  };
}

async function handleRegionTableShareRead(request, env, codeValue) {
  const code = normalizeCode(codeValue);
  if (!code) return json({ ok: false, error: "share_code_required" }, 400);

  const cached = await readPublicShareCache(request, env, "region-table", code);
  if (cached) return cached;

  const built = await buildRegionTableSharePayload(env, code);
  if (built.response) return built.response;
  return writePublicShareCache(
    request,
    env,
    "region-table",
    code,
    built.payload,
    remainingCacheSecondsUntil(built.expiresAtMs, publicShareCacheSeconds(env)),
  );
}

async function handlePublicRegionTableSnapshot(request, env, codeValue) {
  const code = normalizeCode(codeValue);
  if (!code) return json({ ok: false, error: "share_code_required" }, 400);
  const cached = await readPublicShareCache(request, env, "snapshot-region-table", code);
  if (cached) return cached;
  const built = await buildRegionTableSharePayload(env, code);
  if (built.response) return built.response;
  const payload = {
    ...built.payload,
    snapshot: { kind: "region-table", static: true, code, generatedAtMs: Date.now(), ttlSeconds: publicShareCacheSeconds(env) },
    cache: { ...(built.payload.cache || {}), source: "public-static-snapshot", workerRequest: 1 }
  };
  return writePublicShareCache(
    request,
    env,
    "snapshot-region-table",
    code,
    payload,
    remainingCacheSecondsUntil(built.expiresAtMs, publicShareCacheSeconds(env)),
  );
}

function sanitizeFinalPlanPayload(body = {}, user = {}) {
  const code = normalizeCode(body?.code);
  const region = normalizeRegion(body?.region);
  const cycleId = normalizeCycleId(body?.cycleId || 'active');
  return {
    code,
    region,
    cycleId,
    eventStartAtMs: Number(body?.eventStartAtMs) || 0,
    title: clean(body?.title || 'Final plan', 120),
    shift: clean(body?.shift || '', 40),
    html: String(body?.html || '').slice(0, 700000),
    text: String(body?.text || '').slice(0, 50000),
    updatedAtMs: Date.now(),
    updatedBy: clean(user?.uid || body?.updatedBy || '', 160),
    updatedByName: clean(body?.updatedByName || user?.name || user?.email || '', 160),
    expiresAtMs: Number(body?.expiresAtMs) || 0,
  };
}

function finalPlanRowToPlan(row = {}) {
  if (!row) return null;
  return {
    code: normalizeCode(row.code),
    region: normalizeRegion(row.region),
    cycleId: normalizeCycleId(row.cycle_id || 'active'),
    eventStartAtMs: Number(row.event_start_at_ms) || 0,
    title: clean(row.title || 'Final plan', 120),
    shift: clean(row.shift || '', 40),
    html: String(row.html || '').slice(0, 700000),
    text: String(row.text || '').slice(0, 50000),
    updatedAtMs: Number(row.updated_at_ms) || 0,
    updatedBy: clean(row.updated_by || '', 160),
    updatedByName: clean(row.updated_by_name || '', 160),
    expiresAtMs: Number(row.expires_at_ms) || 0,
  };
}

async function handleFinalPlanShareCreate(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const plan = sanitizeFinalPlanPayload(body, user);
  if (!plan.code || !plan.region) return json({ ok: false, error: 'code_region_required' }, 400);
  const allowed = isAdminUid(env, user.uid) || await hasSavedRegionAccess(db, user.uid, plan.region);
  if (!allowed) return json({ ok: false, error: 'region_access_denied' }, 403);
  await db.prepare(
    `INSERT INTO final_plan_shares (code, region, cycle_id, event_start_at_ms, title, shift, html, text, updated_at_ms, updated_by, updated_by_name, expires_at_ms, revoked)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 0)
     ON CONFLICT(code) DO UPDATE SET
       region = excluded.region,
       cycle_id = excluded.cycle_id,
       event_start_at_ms = excluded.event_start_at_ms,
       title = excluded.title,
       shift = excluded.shift,
       html = excluded.html,
       text = excluded.text,
       updated_at_ms = excluded.updated_at_ms,
       updated_by = excluded.updated_by,
       updated_by_name = excluded.updated_by_name,
       expires_at_ms = excluded.expires_at_ms,
       revoked = 0`
  ).bind(
    plan.code,
    plan.region,
    plan.cycleId,
    plan.eventStartAtMs,
    plan.title,
    plan.shift,
    plan.html,
    plan.text,
    plan.updatedAtMs,
    plan.updatedBy,
    plan.updatedByName,
    plan.expiresAtMs,
  ).run();
  await deletePublicShareCache(request, "final-plan", plan.code);
  await deletePublicShareCache(request, "snapshot-final-plan", plan.code);
  await grantRegionAccess(db, plan.region, user.uid, 'final-plan-share');
  return json({ ok: true, plan, usage: { d1RowsWritten: 1 } });
}


async function buildFinalPlanSharePayload(env, codeValue) {
  const code = normalizeCode(codeValue);
  if (!code) return { response: json({ ok: false, error: 'final_plan_code_required' }, 400) };
  const db = regionTableDb(env);
  if (!db) return { response: json({ ok: false, error: 'd1_not_configured' }, 500) };
  await ensureRegionTableSchema(db);
  const row = await db.prepare(
    `SELECT code, region, cycle_id, event_start_at_ms, title, shift, html, text, updated_at_ms, updated_by, updated_by_name, expires_at_ms, revoked
       FROM final_plan_shares
      WHERE code = ?1
      LIMIT 1`
  ).bind(code).first();
  if (!row || Number(row.revoked) === 1) return { response: json({ ok: false, error: 'final_plan_not_found' }, 404) };
  if (Number(row.expires_at_ms) > 0 && Number(row.expires_at_ms) < Date.now()) return { response: json({ ok: false, error: 'final_plan_expired' }, 410) };
  return {
    code,
    expiresAtMs: Number(row.expires_at_ms || 0) || 0,
    payload: {
      ok: true,
      plan: finalPlanRowToPlan(row),
      usage: { d1RowsRead: 1, d1RowsWritten: 0 },
      cache: { enabled: isPublicShareCacheEnabled(env), ttlSeconds: publicShareCacheSeconds(env), source: "public-share-cache" },
    }
  };
}

async function handleFinalPlanShareRead(request, env, codeValue) {
  const code = normalizeCode(codeValue);
  if (!code) return json({ ok: false, error: 'final_plan_code_required' }, 400);

  const cached = await readPublicShareCache(request, env, "final-plan", code);
  if (cached) return cached;

  const built = await buildFinalPlanSharePayload(env, code);
  if (built.response) return built.response;
  return writePublicShareCache(
    request,
    env,
    "final-plan",
    code,
    built.payload,
    remainingCacheSecondsUntil(built.expiresAtMs, publicShareCacheSeconds(env)),
  );
}

async function handlePublicFinalPlanSnapshot(request, env, codeValue) {
  const code = normalizeCode(codeValue);
  if (!code) return json({ ok: false, error: 'final_plan_code_required' }, 400);
  const cached = await readPublicShareCache(request, env, "snapshot-final-plan", code);
  if (cached) return cached;
  const built = await buildFinalPlanSharePayload(env, code);
  if (built.response) return built.response;
  const payload = {
    ...built.payload,
    snapshot: { kind: "final-plan", static: true, code, generatedAtMs: Date.now(), ttlSeconds: publicShareCacheSeconds(env) },
    cache: { ...(built.payload.cache || {}), source: "public-static-snapshot", workerRequest: 1 }
  };
  return writePublicShareCache(
    request,
    env,
    "snapshot-final-plan",
    code,
    payload,
    remainingCacheSecondsUntil(built.expiresAtMs, publicShareCacheSeconds(env)),
  );
}


function sanitizeTowerPlanSnapshotBody(body = {}, user = {}) {
  const region = normalizeRegion(body?.region);
  const cycleId = normalizeCycleId(body?.cycleId || 'active');
  const plan = body?.plan && typeof body.plan === 'object' && !Array.isArray(body.plan) ? body.plan : {};
  const planJson = JSON.stringify(plan);
  if (planJson.length > 900000) throw new Error('tower_plan_too_large');
  return {
    region,
    cycleId,
    version: Number(body?.updatedAtMs || Date.now()) || Date.now(),
    updatedAtMs: Number(body?.updatedAtMs || Date.now()) || Date.now(),
    updatedBy: clean(user?.uid || body?.updatedBy || '', 160),
    updatedByName: clean(body?.updatedByName || user?.name || user?.email || '', 160),
    planJson,
  };
}

function towerPlanRowToObject(row = {}) {
  let plan = {};
  try { plan = JSON.parse(row.plan_json || '{}') || {}; } catch { plan = {}; }
  return {
    region: normalizeRegion(row.region),
    cycleId: normalizeCycleId(row.cycle_id || 'active'),
    version: Number(row.version) || Number(row.updated_at_ms) || 0,
    updatedAtMs: Number(row.updated_at_ms) || 0,
    updatedBy: clean(row.updated_by || '', 160),
    updatedByName: clean(row.updated_by_name || '', 160),
    plan,
  };
}

async function canWriteTowerPlanD1(db, env, user, region) {
  if (!user?.uid || !region) return false;
  if (isAdminUid(env, user.uid)) return true;
  const access = await readDirectoryAccess(db, env, user).catch(() => null);
  if (!access) return false;
  if (access.isGlobal) return true;
  const roles = access.roles || new Set();
  const regions = new Set(access.regions || []);
  return regions.has(region) && (roles.has('consul') || roles.has('officer'));
}

async function handleTowerPlanRead(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  await verifyFirebaseToken(request, env);
  const url = new URL(request.url);
  const region = normalizeRegion(url.searchParams.get('region'));
  if (!region) return json({ ok: false, error: 'region_required' }, 400);
  const row = await db.prepare(
    `SELECT region, cycle_id, version, updated_at_ms, updated_by, updated_by_name, plan_json
       FROM region_tower_plans
      WHERE region = ?1
      LIMIT 1`
  ).bind(region).first();
  if (!row) return json({ ok: false, error: 'tower_plan_not_found' }, 404);
  return json({ ok: true, towerPlan: towerPlanRowToObject(row), usage: { d1RowsRead: 1 }, source: 'cloudflare-d1-tower-plan' }, 200, 'private, no-store');
}

async function handleTowerPlanPut(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const payload = sanitizeTowerPlanSnapshotBody(body, user);
  if (!payload.region) return json({ ok: false, error: 'region_required' }, 400);
  const allowed = await canWriteTowerPlanD1(db, env, user, payload.region);
  if (!allowed) return json({ ok: false, error: 'region_plan_access_denied' }, 403);
  await db.prepare(
    `INSERT INTO region_tower_plans (region, cycle_id, version, updated_at_ms, updated_by, updated_by_name, plan_json)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT(region) DO UPDATE SET
       cycle_id = excluded.cycle_id,
       version = excluded.version,
       updated_at_ms = excluded.updated_at_ms,
       updated_by = excluded.updated_by,
       updated_by_name = excluded.updated_by_name,
       plan_json = excluded.plan_json`
  ).bind(
    payload.region,
    payload.cycleId,
    payload.version,
    payload.updatedAtMs,
    payload.updatedBy,
    payload.updatedByName,
    payload.planJson
  ).run();
  await grantRegionAccess(db, payload.region, user.uid, 'tower-plan');
  return json({ ok: true, towerPlan: { region: payload.region, cycleId: payload.cycleId, version: payload.version, updatedAtMs: payload.updatedAtMs, updatedBy: payload.updatedBy, updatedByName: payload.updatedByName, plan: JSON.parse(payload.planJson || '{}') }, usage: { d1RowsWritten: 1 }, source: 'cloudflare-d1-tower-plan' });
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
  const cleanPlayers = dedupePublicStatsPlayers(Array.isArray(players) ? players : []);
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


function publicStatsPlayerSort(a = {}, b = {}) {
  return String(a.region || '').localeCompare(String(b.region || ''), 'uk', { numeric: true })
    || String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk', { numeric: true });
}

function publicStatsPlayerUpdatedAtMs(player = {}) {
  const value = player?.updatedAt || player?.createdAt || 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : 0;
  }
  if (value && typeof value === 'object') {
    if (typeof value.seconds === 'number') return (value.seconds * 1000) + Math.floor((Number(value.nanoseconds) || 0) / 1000000);
    if (typeof value._seconds === 'number') return (value._seconds * 1000) + Math.floor((Number(value._nanoseconds) || 0) / 1000000);
  }
  return 0;
}

function publicStatsPlayerDedupeKey(player = {}, fallback = '') {
  const publicKey = clean(player?.publicKey || player?.uid || player?.id, 80);
  if (publicKey) return `key:${publicKey}`;
  return `identity:${clean(player?.nickname || player?.gameNick, 80).toLowerCase()}|${normalizeRegion(player?.region)}|${clean(player?.alliance, 40)}`;
}

function dedupePublicStatsPlayers(players = []) {
  const map = new Map();
  (Array.isArray(players) ? players : []).forEach((player, index) => {
    if (!player || !player.publicKey || !player.nickname || player.profileComplete === false) return;
    const key = publicStatsPlayerDedupeKey(player, index);
    const existing = map.get(key);
    if (!existing || publicStatsPlayerUpdatedAtMs(player) >= publicStatsPlayerUpdatedAtMs(existing)) {
      map.set(key, player);
    }
  });
  return [...map.values()].sort(publicStatsPlayerSort);
}

async function handlePublicStatsImport(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  if (!hasValidStatsSecret(request, env)) return json({ ok: false, error: 'stats_secret_required' }, 403);
  await ensureRegionTableSchema(db);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const rawPlayers = Array.isArray(body?.players) ? body.players : [];
  const cleanPlayers = [];
  for (const raw of rawPlayers.slice(0, 50000)) {
    const uid = clean(raw.uid || raw.id || raw.publicKey || raw.nickname, 180);
    const publicKey = clean(raw.publicKey || await publicStatsKeyForUid(uid), 40);
    const player = await sanitizePublicStatsPlayer({ ...raw, publicKey }, uid || publicKey);
    if (player) cleanPlayers.push(player);
  }
  const pages = new Map();
  for (const player of dedupePublicStatsPlayers(cleanPlayers)) {
    const bucket = publicStatsBucketForKey(player.publicKey || player.nickname);
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
  for (let i = 0; i < statements.length; i += 20) {
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
  const exportedPlayers = [];
  for (const row of rows?.results || []) {
    exportedPlayers.push(...parseArrayJson(row.players_json));
  }
  const players = dedupePublicStatsPlayers(exportedPlayers);
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


function shareSnapshotFileName(kind = '', code = '') {
  const safeKind = clean(kind, 8).replace(/[^a-z]/g, '');
  const safeCode = normalizeCode(code);
  if (!safeKind || !safeCode) return '';
  return `public-cache/share/${safeKind}/${safeCode}.json`;
}

function exportedSharePayload(payload = {}, kind = '', code = '') {
  const now = Date.now();
  return {
    ...(payload || {}),
    usage: { d1RowsRead: 0, d1RowsWritten: 0 },
    snapshot: {
      kind: kind === 'p' ? 'final-plan' : 'region-table',
      static: true,
      exported: true,
      code: normalizeCode(code),
      generatedAtMs: now,
      generatedAt: new Date(now).toISOString()
    },
    cache: {
      ...((payload && payload.cache) || {}),
      source: 'github-public-cache-export',
      workerRequest: 0,
      d1RowsRead: 0,
      d1RowsWritten: 0
    }
  };
}

async function handlePublicShareSnapshotExport(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  if (statsSecret(env) && !hasValidStatsSecret(request, env)) return json({ ok: false, error: 'stats_secret_required' }, 403);
  await ensureRegionTableSchema(db);
  const now = Date.now();
  const tableRows = await db.prepare(
    `SELECT code FROM region_table_shares
      WHERE revoked = 0 AND (expires_at_ms = 0 OR expires_at_ms > ?1)
      ORDER BY created_at_ms DESC
      LIMIT 500`
  ).bind(now).all();
  const finalRows = await db.prepare(
    `SELECT code FROM final_plan_shares
      WHERE revoked = 0 AND (expires_at_ms = 0 OR expires_at_ms > ?1)
      ORDER BY updated_at_ms DESC
      LIMIT 500`
  ).bind(now).all();
  const files = [];
  for (const row of tableRows?.results || []) {
    const code = normalizeCode(row?.code);
    if (!code) continue;
    const built = await buildRegionTableSharePayload(env, code);
    if (built.response || !built.payload?.ok) continue;
    files.push({ kind: 'rt', code, path: shareSnapshotFileName('rt', code), data: exportedSharePayload(built.payload, 'rt', code) });
  }
  for (const row of finalRows?.results || []) {
    const code = normalizeCode(row?.code);
    if (!code) continue;
    const built = await buildFinalPlanSharePayload(env, code);
    if (built.response || !built.payload?.ok) continue;
    files.push({ kind: 'p', code, path: shareSnapshotFileName('p', code), data: exportedSharePayload(built.payload, 'p', code) });
  }
  return json({
    ok: true,
    source: 'cloudflare-d1-public-share-export',
    generatedAt: new Date(now).toISOString(),
    generatedAtMs: now,
    files,
    counts: {
      total: files.length,
      regionTables: files.filter(file => file.kind === 'rt').length,
      finalPlans: files.filter(file => file.kind === 'p').length
    },
    usage: { d1RowsRead: Math.max(1, files.length), d1RowsWritten: 0 }
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
  const alliance = clean(url.searchParams.get("alliance") || "", 40);
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
    actorAlliance: clean(body?.actorAlliance || "", 40),
    actorRole: clean(body?.actorRole || "", 40).toLowerCase(),
    alliance: clean(body?.alliance || body?.actorAlliance || "", 40),
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
  return ['cycles', 'shares', 'finalplans', 'campaigns', 'messages', 'logs', 'all'].includes(scope) ? scope : 'all';
}

function d1CleanupCutoffMs(retentionDays = 60) {
  const value = Number(retentionDays);
  if (Number.isFinite(value) && value <= 0) return Number.MAX_SAFE_INTEGER;
  return Date.now() - Math.max(1, Math.min(3650, value || 60)) * 24 * 60 * 60 * 1000;
}

function d1CleanupRetentionDays(retentionDays = 60) {
  const value = Number(retentionDays);
  if (Number.isFinite(value) && value <= 0) return 0;
  return Math.max(1, Math.min(3650, value || 60));
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
  const allOld = Number(cutoffMs) >= Number.MAX_SAFE_INTEGER;
  const nowMs = Date.now();
  const params = allOld ? [] : [nowMs, Number(cutoffMs) || 0];
  let where = allOld
    ? `s.created_at_ms > 0`
    : `((s.expires_at_ms > 0 AND s.expires_at_ms < ?1) OR (s.revoked = 1 AND s.created_at_ms > 0 AND s.created_at_ms < ?2) OR (s.created_at_ms > 0 AND s.created_at_ms < ?2))`;
  where += ` AND s.cycle_id != COALESCE(ra.cycle_id, 'active')`;
  if (region) {
    params.push(region);
    where += ` AND s.region = ?${params.length}`;
  }
  const result = await db.prepare(
    `SELECT s.code AS code
       FROM region_table_shares s
       LEFT JOIN region_active ra ON ra.region = s.region
      WHERE ${where}
      ORDER BY s.created_at_ms ASC LIMIT ${safeLimit}`
  ).bind(...params).all();
  return (result?.results || []).map(row => normalizeCode(row.code)).filter(Boolean);
}


async function selectOldD1FinalPlanCodes(db, { cutoffMs = 0, region = '', limitCount = 500 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 500));
  const allOld = Number(cutoffMs) >= Number.MAX_SAFE_INTEGER;
  const nowMs = Date.now();
  const params = allOld ? [] : [nowMs, Number(cutoffMs) || 0];
  let where = allOld
    ? `fp.updated_at_ms > 0`
    : `((fp.expires_at_ms > 0 AND fp.expires_at_ms < ?1) OR (fp.updated_at_ms > 0 AND fp.updated_at_ms < ?2))`;
  where += ` AND fp.cycle_id != COALESCE(ra.cycle_id, 'active')`;
  if (region) {
    params.push(region);
    where += ` AND fp.region = ?${params.length}`;
  }
  const result = await db.prepare(
    `SELECT fp.code AS code
       FROM final_plan_shares fp
       LEFT JOIN region_active ra ON ra.region = fp.region
      WHERE ${where}
      ORDER BY fp.updated_at_ms ASC LIMIT ${safeLimit}`
  ).bind(...params).all();
  return (result?.results || []).map(row => normalizeCode(row.code)).filter(Boolean);
}

async function selectOldD1CampaignIds(db, { cutoffMs = 0, region = '', limitCount = 500 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 500));
  const allOld = Number(cutoffMs) >= Number.MAX_SAFE_INTEGER;
  const nowMs = Date.now();
  const params = allOld ? [] : [nowMs, Number(cutoffMs) || 0];
  let where = allOld
    ? `created_at_ms > 0`
    : `((expires_at_ms > 0 AND expires_at_ms < ?1) OR (created_at_ms > 0 AND created_at_ms < ?2))`;
  if (region) {
    params.push(region);
    where += ` AND region = ?${params.length}`;
  }
  const result = await db.prepare(
    `SELECT id FROM notification_campaigns WHERE ${where} ORDER BY created_at_ms ASC LIMIT ${safeLimit}`
  ).bind(...params).all();
  return (result?.results || []).map(row => clean(row.id, 140)).filter(Boolean);
}

async function selectOldD1MessageIds(db, { cutoffMs = 0, region = '', limitCount = 500 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 500));
  const params = [Number(cutoffMs) || 0];
  let where = `created_at_ms > 0 AND created_at_ms < ?1 AND (deleted = 1 OR archived = 1 OR read_at_ms > 0)`;
  if (region) {
    params.push(region);
    where += ` AND region = ?${params.length}`;
  }
  const result = await db.prepare(`SELECT id FROM user_notifications WHERE ${where} ORDER BY created_at_ms ASC LIMIT ${safeLimit}`).bind(...params).all();
  return (result?.results || []).map(row => clean(row.id, 140)).filter(Boolean);
}

async function selectOldD1SentMessageIds(db, { cutoffMs = 0, region = '', limitCount = 500 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 500));
  const params = [Number(cutoffMs) || 0];
  let where = `created_at_ms > 0 AND created_at_ms < ?1 AND (deleted = 1 OR archived = 1)`;
  if (region) {
    params.push(region);
    where += ` AND region = ?${params.length}`;
  }
  const result = await db.prepare(`SELECT id FROM user_sent_messages WHERE ${where} ORDER BY created_at_ms ASC LIMIT ${safeLimit}`).bind(...params).all();
  return (result?.results || []).map(row => clean(row.id, 140)).filter(Boolean);
}

async function selectOldD1ActionLogIds(db, { cutoffMs = 0, region = '', limitCount = 500 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 500));
  const params = [Number(cutoffMs) || 0];
  let where = `created_at_ms > 0 AND created_at_ms < ?1`;
  if (region) {
    params.push(region);
    where += ` AND region = ?${params.length}`;
  }
  const result = await db.prepare(`SELECT id FROM action_logs WHERE ${where} ORDER BY created_at_ms ASC LIMIT ${safeLimit}`).bind(...params).all();
  return (result?.results || []).map(row => clean(row.id, 140)).filter(Boolean);
}


async function runD1ArchiveCleanup(db, { scope = 'all', region = '', retentionDays = 60, limitCount = 500, dryRun = false } = {}) {
  const safeScope = d1CleanupScope(scope);
  const safeRegion = normalizeRegion(region);
  const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 500));
  const safeRetentionDays = d1CleanupRetentionDays(retentionDays);
  const cutoffMs = d1CleanupCutoffMs(safeRetentionDays);
  let remaining = safeLimit;
  let cycles = 0;
  let shares = 0;
  let finalPlans = 0;
  let campaigns = 0;
  let messages = 0;
  let logs = 0;
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


  if ((safeScope === 'finalplans' || safeScope === 'all') && remaining > 0) {
    const codes = await selectOldD1FinalPlanCodes(db, { cutoffMs, region: safeRegion, limitCount: remaining });
    finalPlans = codes.length;
    scanned += codes.length;
    if (!dryRun && codes.length) {
      const placeholders = codes.map((_, index) => `?${index + 1}`).join(',');
      const result = await db.prepare(`DELETE FROM final_plan_shares WHERE code IN (${placeholders})`).bind(...codes).run();
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


  if ((safeScope === 'messages' || safeScope === 'all') && remaining > 0) {
    const limitForInbox = Math.ceil(remaining / 2);
    const inboxIds = await selectOldD1MessageIds(db, { cutoffMs, region: safeRegion, limitCount: limitForInbox });
    const sentIds = remaining - inboxIds.length > 0
      ? await selectOldD1SentMessageIds(db, { cutoffMs, region: safeRegion, limitCount: remaining - inboxIds.length })
      : [];
    messages = inboxIds.length + sentIds.length;
    scanned += messages;
    if (!dryRun) {
      if (inboxIds.length) {
        const placeholders = inboxIds.map((_, index) => `?${index + 1}`).join(',');
        const result = await db.prepare(`DELETE FROM user_notifications WHERE id IN (${placeholders})`).bind(...inboxIds).run();
        deleted += Number(result?.meta?.changes) || 0;
      }
      if (sentIds.length) {
        const placeholders = sentIds.map((_, index) => `?${index + 1}`).join(',');
        const result = await db.prepare(`DELETE FROM user_sent_messages WHERE id IN (${placeholders})`).bind(...sentIds).run();
        deleted += Number(result?.meta?.changes) || 0;
      }
    }
    remaining -= messages;
    if (messages >= safeLimit) hasMore = true;
  }

  if ((safeScope === 'logs' || safeScope === 'all') && remaining > 0) {
    const ids = await selectOldD1ActionLogIds(db, { cutoffMs, region: safeRegion, limitCount: remaining });
    logs = ids.length;
    scanned += ids.length;
    if (!dryRun && ids.length) {
      const placeholders = ids.map((_, index) => `?${index + 1}`).join(',');
      const result = await db.prepare(`DELETE FROM action_logs WHERE id IN (${placeholders})`).bind(...ids).run();
      deleted += Number(result?.meta?.changes) || 0;
    }
    remaining -= ids.length;
    if (ids.length === safeLimit) hasMore = true;
  }

  const found = cycles + shares + finalPlans + campaigns + messages + logs;
  return {
    ok: true,
    scope: safeScope,
    region: safeRegion,
    retentionDays: safeRetentionDays,
    found,
    deleted: dryRun ? 0 : deleted,
    scanned,
    cycles,
    shares,
    finalPlans,
    campaigns,
    messages,
    logs,
    hasMore: hasMore || found >= safeLimit,
    source: 'cloudflare-d1-cleanup'
  };
}


async function d1CountBytes(db, sql, params = []) {
  try {
    const row = await db.prepare(sql).bind(...params).first();
    return {
      rows: Math.max(0, Number(row?.rows || row?.count || 0) || 0),
      bytes: Math.max(0, Number(row?.bytes || 0) || 0)
    };
  } catch (error) {
    console.warn('[WKD Worker] D1 inspect query skipped:', error?.message || error);
    return { rows: 0, bytes: 0 };
  }
}

async function inspectD1StorageTables(db, { region = '' } = {}) {
  const safeRegion = normalizeRegion(region);
  const regionClause = safeRegion ? ' AND region = ?1' : '';
  const regionParams = safeRegion ? [safeRegion] : [];
  const rowRegionClause = safeRegion ? ' AND rr.region = ?1' : '';
  const rowRegionParams = safeRegion ? [safeRegion] : [];
  const items = [];
  const push = (key, data = {}, cleanup = '', active = false) => {
    items.push({
      key,
      rows: Math.max(0, Number(data.rows || 0) || 0),
      bytes: Math.max(0, Number(data.bytes || 0) || 0),
      cleanup,
      active: Boolean(active)
    });
  };

  push('activePlayers', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(rr.row_json,''))),0) AS bytes
       FROM region_table_rows rr
       LEFT JOIN region_active ra ON ra.region = rr.region
      WHERE rr.cycle_id = COALESCE(ra.cycle_id, 'active')${rowRegionClause}`,
    rowRegionParams), '', true);
  push('archivedPlayers', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(rr.row_json,''))),0) AS bytes
       FROM region_table_rows rr
       LEFT JOIN region_active ra ON ra.region = rr.region
      WHERE rr.cycle_id != COALESCE(ra.cycle_id, 'active')${rowRegionClause}`,
    rowRegionParams), 'cycles', false);
  push('cycleIndex', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(title,'')) + LENGTH(COALESCE(opened_by_name,''))),0) AS bytes FROM region_cycles WHERE 1=1${regionClause}`,
    regionParams), 'cycles', false);
  push('legacySnapshots', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(settings_json,'')) + LENGTH(COALESCE(rows_json,''))),0) AS bytes FROM region_tables WHERE 1=1${regionClause}`,
    regionParams), 'cycles', false);
  push('towerPlans', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(plan_json,''))),0) AS bytes FROM region_tower_plans WHERE 1=1${regionClause}`,
    regionParams), '', true);
  push('formSettings', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(settings_json,''))),0) AS bytes FROM region_form_settings WHERE 1=1${regionClause}`,
    regionParams), '', true);
  push('finalPlanShares', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(html,'')) + LENGTH(COALESCE(text,'')) + LENGTH(COALESCE(title,''))),0) AS bytes FROM final_plan_shares WHERE 1=1${regionClause}`,
    regionParams), 'finalPlans', false);
  push('regionTableShares', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(code,'')) + LENGTH(COALESCE(access,''))),0) AS bytes FROM region_table_shares WHERE 1=1${regionClause}`,
    regionParams), 'shares', false);
  push('alliances', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(tag,'')) + LENGTH(COALESCE(name,'')) + LENGTH(COALESCE(note,''))),0) AS bytes FROM region_alliances WHERE 1=1${regionClause}`,
    regionParams), '', true);
  push('actionLogs', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(summary,'')) + LENGTH(COALESCE(details_json,''))),0) AS bytes FROM action_logs WHERE 1=1${regionClause}`,
    regionParams), 'logs', false);
  push('notifications', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(title,'')) + LENGTH(COALESCE(message,''))),0) AS bytes FROM user_notifications`,
    []), 'messages', false);
  push('sentMessages', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(title,'')) + LENGTH(COALESCE(message,'')) + LENGTH(COALESCE(recipient_preview,''))),0) AS bytes FROM user_sent_messages`,
    []), 'messages', false);
  push('campaigns', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(title,'')) + LENGTH(COALESCE(message,''))),0) AS bytes FROM notification_campaigns WHERE 1=1${regionClause}`,
    regionParams), 'campaigns', false);
  push('notificationDirectory', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(nickname,'')) + LENGTH(COALESCE(email,'')) + LENGTH(COALESCE(display_name,''))),0) AS bytes FROM notification_directory WHERE deleted = 0${regionClause}`,
    regionParams), '', true);
  push('publicStats', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(players_json,''))),0) AS bytes FROM public_stats_pages`,
    []), '', true);
  push('activeIndexes', await d1CountBytes(db,
    `SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(COALESCE(cycle_id,''))),0) AS bytes FROM region_active WHERE 1=1${regionClause}`,
    regionParams), '', true);

  return {
    ok: true,
    region: safeRegion,
    items,
    totalRows: items.reduce((sum, item) => sum + item.rows, 0),
    totalBytes: items.reduce((sum, item) => sum + item.bytes, 0),
    source: 'cloudflare-d1-storage-inspect'
  };
}


async function handleRegionSharesRotate(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const region = normalizeRegion(body?.region);
  if (!region) return json({ ok: false, error: 'region_required' }, 400);
  const allowed = isAdminUid(env, user.uid) || await hasSavedRegionAccess(db, user.uid, region) || await activeRegionHasUid(db, region, user.uid);
  if (!allowed) return json({ ok: false, error: 'region_access_denied' }, 403);
  const tableCodes = (await db.prepare(`SELECT code FROM region_table_shares WHERE region = ?1`).bind(region).all())?.results?.map(row => row.code) || [];
  const finalCodes = (await db.prepare(`SELECT code FROM final_plan_shares WHERE region = ?1`).bind(region).all())?.results?.map(row => row.code) || [];
  const tableResult = await db.prepare(`DELETE FROM region_table_shares WHERE region = ?1`).bind(region).run();
  const finalResult = await db.prepare(`DELETE FROM final_plan_shares WHERE region = ?1`).bind(region).run();
  const tableShares = Number(tableResult?.meta?.changes) || 0;
  const finalPlans = Number(finalResult?.meta?.changes) || 0;
  const cacheDeleted = (await deletePublicShareCaches(request, "region-table", tableCodes)) + (await deletePublicShareCaches(request, "snapshot-region-table", tableCodes)) + (await deletePublicShareCaches(request, "final-plan", finalCodes)) + (await deletePublicShareCaches(request, "snapshot-final-plan", finalCodes));
  return json({ ok: true, region, tableShares, finalPlans, deleted: tableShares + finalPlans, cacheDeleted, usage: { d1RowsRead: tableCodes.length + finalCodes.length, d1RowsWritten: tableShares + finalPlans }, source: 'cloudflare-d1-share-rotation' });
}


function secretLinkTypeLabel(type = '') {
  const value = clean(type, 40).toLowerCase();
  if (value === 'form') return 'form';
  if (value === 'table') return 'table';
  if (value === 'final') return 'final';
  return value || 'unknown';
}

function secretLinkUrls(request, type = '', region = '', code = '') {
  const origin = new URL(request.url).origin;
  const safeCode = normalizeCode(code);
  const safeRegion = normalizeRegion(region);
  const safeType = secretLinkTypeLabel(type);
  if (!safeCode) return { shortUrl: '', publicUrl: '' };
  if (safeType === 'form') {
    return {
      shortUrl: `${origin}/f/${encodeURIComponent(safeCode)}`,
      publicUrl: `${origin}/region-form.html?s=${encodeURIComponent(safeCode)}`
    };
  }
  if (safeType === 'table') {
    return {
      shortUrl: `${origin}/rt/${encodeURIComponent(safeCode)}`,
      publicUrl: `${origin}/public-region-table.html?s=${encodeURIComponent(safeCode)}`
    };
  }
  if (safeType === 'final') {
    return {
      shortUrl: `${origin}/p/${encodeURIComponent(safeCode)}`,
      publicUrl: `${origin}/public-plan.html?s=${encodeURIComponent(safeCode)}`
    };
  }
  return { shortUrl: '', publicUrl: '' };
}

function secretLinkRow(request, row = {}, type = '', activeCycleId = '') {
  const code = normalizeCode(row.code || row.short_code || '');
  const region = normalizeRegion(row.region || '');
  const cycleId = normalizeCycleId(row.cycle_id || row.cycleId || 'active');
  const expiresAtMs = Number(row.expires_at_ms || row.expiresAtMs || 0) || 0;
  const revoked = Number(row.revoked || 0) === 1;
  const expired = expiresAtMs > 0 && expiresAtMs < Date.now();
  const urls = secretLinkUrls(request, type, region, code);
  return {
    type: secretLinkTypeLabel(type),
    code,
    region,
    cycleId,
    active: cycleId === normalizeCycleId(activeCycleId || 'active') && !revoked && !expired,
    revoked,
    expired,
    createdAtMs: Number(row.created_at_ms || row.createdAtMs || 0) || 0,
    updatedAtMs: Number(row.updated_at_ms || row.updatedAtMs || 0) || 0,
    expiresAtMs,
    ...urls
  };
}

async function readActiveCycleIdForRegion(db, region = '') {
  const safeRegion = normalizeRegion(region);
  if (!safeRegion) return 'active';
  const active = await db.prepare(`SELECT cycle_id FROM region_active WHERE region = ?1 LIMIT 1`).bind(safeRegion).first();
  if (active?.cycle_id) return normalizeCycleId(active.cycle_id);
  const form = await db.prepare(`SELECT cycle_id FROM region_form_settings WHERE region = ?1 LIMIT 1`).bind(safeRegion).first();
  return normalizeCycleId(form?.cycle_id || 'active');
}

async function buildSecretLinksPayload(db, request, region = '') {
  const safeRegion = normalizeRegion(region);
  const activeCycleId = await readActiveCycleIdForRegion(db, safeRegion);
  const links = [];
  let rowsRead = 1;
  const form = await db.prepare(
    `SELECT region, short_code, cycle_id, updated_at_ms FROM region_form_settings WHERE region = ?1 LIMIT 1`
  ).bind(safeRegion).first();
  rowsRead += 1;
  if (form?.short_code) links.push(secretLinkRow(request, form, 'form', activeCycleId));

  const tableRows = await db.prepare(
    `SELECT code, region, cycle_id, created_at_ms, expires_at_ms, revoked
       FROM region_table_shares
      WHERE region = ?1
      ORDER BY created_at_ms DESC
      LIMIT 40`
  ).bind(safeRegion).all();
  const tableLinks = tableRows?.results || [];
  rowsRead += tableLinks.length;
  tableLinks.forEach(row => links.push(secretLinkRow(request, row, 'table', activeCycleId)));

  const finalRows = await db.prepare(
    `SELECT code, region, cycle_id, updated_at_ms, expires_at_ms, revoked
       FROM final_plan_shares
      WHERE region = ?1
      ORDER BY updated_at_ms DESC
      LIMIT 40`
  ).bind(safeRegion).all();
  const finalLinks = finalRows?.results || [];
  rowsRead += finalLinks.length;
  finalLinks.forEach(row => links.push(secretLinkRow(request, row, 'final', activeCycleId)));

  const counts = links.reduce((acc, item) => {
    acc.total += 1;
    if (item.active) acc.active += 1;
    if (item.expired) acc.expired += 1;
    if (item.revoked) acc.revoked += 1;
    return acc;
  }, { total: 0, active: 0, expired: 0, revoked: 0 });
  return { ok: true, region: safeRegion, activeCycleId, links, counts, usage: { d1RowsRead: rowsRead, d1RowsWritten: 0 }, source: 'cloudflare-d1-secret-links' };
}

function secretLinkRotateScope(value = 'all') {
  const scope = clean(value || 'all', 40).toLowerCase();
  return ['form', 'table', 'final', 'all'].includes(scope) ? scope : 'all';
}

async function handleSecretLinksInspect(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  if (!isAdminUid(env, user.uid)) return json({ ok: false, error: 'admin_required' }, 403);
  let body = null;
  try { body = await request.json(); } catch { body = {}; }
  const region = normalizeRegion(body?.region);
  if (!region) return json({ ok: false, error: 'region_required' }, 400);
  return json(await buildSecretLinksPayload(db, request, region));
}

async function handleSecretLinksRotate(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  if (!isAdminUid(env, user.uid)) return json({ ok: false, error: 'admin_required' }, 403);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const region = normalizeRegion(body?.region);
  if (!region) return json({ ok: false, error: 'region_required' }, 400);
  const scope = secretLinkRotateScope(body?.scope || 'all');
  const activeCycleId = await readActiveCycleIdForRegion(db, region);
  let rowsWritten = 0;
  const rotated = { form: 0, table: 0, final: 0 };

  if (scope === 'form' || scope === 'all') {
    const existing = await db.prepare(`SELECT settings_json, cycle_id, version FROM region_form_settings WHERE region = ?1 LIMIT 1`).bind(region).first();
    const code = makeD1SecretCode('f');
    await db.prepare(
      `INSERT INTO region_form_settings (region, short_code, cycle_id, version, updated_at_ms, settings_json)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(region) DO UPDATE SET
         short_code = excluded.short_code,
         cycle_id = excluded.cycle_id,
         version = excluded.version,
         updated_at_ms = excluded.updated_at_ms,
         settings_json = excluded.settings_json`
    ).bind(region, code, activeCycleId, Date.now(), Date.now(), existing?.settings_json || '{}').run();
    rotated.form = 1;
    rowsWritten += 1;
  }

  let cacheDeleted = 0;

  if (scope === 'table' || scope === 'all') {
    const codes = (await db.prepare(
      `SELECT code FROM region_table_shares WHERE region = ?1 AND cycle_id = ?2 AND revoked = 0`
    ).bind(region, activeCycleId).all())?.results?.map(row => row.code) || [];
    const result = await db.prepare(
      `UPDATE region_table_shares SET revoked = 1
        WHERE region = ?1 AND cycle_id = ?2 AND revoked = 0`
    ).bind(region, activeCycleId).run();
    rotated.table = Number(result?.meta?.changes) || 0;
    rowsWritten += rotated.table;
    cacheDeleted += await deletePublicShareCaches(request, "region-table", codes);
    cacheDeleted += await deletePublicShareCaches(request, "snapshot-region-table", codes);
  }

  if (scope === 'final' || scope === 'all') {
    const codes = (await db.prepare(
      `SELECT code FROM final_plan_shares WHERE region = ?1 AND cycle_id = ?2 AND revoked = 0`
    ).bind(region, activeCycleId).all())?.results?.map(row => row.code) || [];
    const result = await db.prepare(
      `UPDATE final_plan_shares SET revoked = 1
        WHERE region = ?1 AND cycle_id = ?2 AND revoked = 0`
    ).bind(region, activeCycleId).run();
    rotated.final = Number(result?.meta?.changes) || 0;
    rowsWritten += rotated.final;
    cacheDeleted += await deletePublicShareCaches(request, "final-plan", codes);
    cacheDeleted += await deletePublicShareCaches(request, "snapshot-final-plan", codes);
  }

  const payload = await buildSecretLinksPayload(db, request, region);
  return json({ ...payload, rotated, cacheDeleted, usage: { d1RowsRead: Number(payload.usage?.d1RowsRead || 0) + 2 + rotated.table + rotated.final, d1RowsWritten: rowsWritten }, source: 'cloudflare-d1-secret-links-rotate' });
}


async function handleD1StorageInspect(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  if (!isAdminUid(env, user.uid)) return json({ ok: false, error: 'admin_required' }, 403);
  let body = null;
  try { body = await request.json(); } catch { body = {}; }
  return json(await inspectD1StorageTables(db, { region: body?.region || '' }));
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


function cronEnvInt(env, name, fallback, min = 1, max = 3650) {
  const value = Number(env?.[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function cronEnvFlag(env, name, defaultValue = true) {
  const raw = clean(env?.[name] || '', 20).toLowerCase();
  if (!raw) return defaultValue;
  return !['0', 'false', 'off', 'no', 'disabled'].includes(raw);
}

async function runScheduledD1Cleanup(env, scheduledTimeMs = Date.now()) {
  if (!cronEnvFlag(env, 'WKD_CRON_CLEANUP_ENABLED', true)) {
    return { ok: true, skipped: true, reason: 'cron_cleanup_disabled', scheduledTimeMs };
  }
  const db = regionTableDb(env);
  if (!db) return { ok: false, error: 'd1_not_configured', scheduledTimeMs };
  await ensureRegionTableSchema(db);

  const limitPerScope = cronEnvInt(env, 'WKD_CRON_CLEANUP_LIMIT_PER_SCOPE', 100, 1, 500);
  const defaultRetentionDays = cronEnvInt(env, 'WKD_CRON_CLEANUP_RETENTION_DAYS', 30, 1, 3650);
  const tasks = [
    { scope: 'finalplans', retentionDays: cronEnvInt(env, 'WKD_CRON_FINAL_PLAN_RETENTION_DAYS', defaultRetentionDays, 1, 3650) },
    { scope: 'shares', retentionDays: cronEnvInt(env, 'WKD_CRON_SECRET_LINK_RETENTION_DAYS', defaultRetentionDays, 1, 3650) },
    { scope: 'campaigns', retentionDays: cronEnvInt(env, 'WKD_CRON_CAMPAIGN_RETENTION_DAYS', defaultRetentionDays, 1, 3650) },
    { scope: 'messages', retentionDays: cronEnvInt(env, 'WKD_CRON_MESSAGE_RETENTION_DAYS', defaultRetentionDays, 1, 3650) },
    { scope: 'logs', retentionDays: cronEnvInt(env, 'WKD_CRON_LOG_RETENTION_DAYS', defaultRetentionDays, 1, 3650) },
  ];
  if (cronEnvFlag(env, 'WKD_CRON_CLEAN_CYCLES', false)) {
    tasks.unshift({ scope: 'cycles', retentionDays: cronEnvInt(env, 'WKD_CRON_CYCLE_RETENTION_DAYS', 60, 1, 3650) });
  }

  const results = [];
  for (const task of tasks) {
    try {
      results.push(await runD1ArchiveCleanup(db, {
        scope: task.scope,
        region: '',
        retentionDays: task.retentionDays,
        limitCount: limitPerScope,
        dryRun: false
      }));
    } catch (error) {
      results.push({ ok: false, scope: task.scope, error: clean(error?.message || 'cleanup_failed', 160) });
    }
  }

  const totals = results.reduce((acc, item) => {
    acc.found += Number(item?.found || 0);
    acc.deleted += Number(item?.deleted || 0);
    acc.scanned += Number(item?.scanned || 0);
    if (item?.hasMore) acc.hasMore = true;
    if (item?.ok === false) acc.errors += 1;
    return acc;
  }, { found: 0, deleted: 0, scanned: 0, hasMore: false, errors: 0 });

  console.info('[WKD Cron] D1 auto-cleanup finished', { scheduledTimeMs, ...totals });
  return { ok: totals.errors === 0, scheduledTimeMs, limitPerScope, results, totals, source: 'cloudflare-cron-d1-cleanup' };
}


const CLOUDFLARE_GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const WORKERS_FREE_REQUESTS_PER_DAY = 100000;
const D1_FREE_ROWS_READ_PER_DAY = 5000000;
const D1_FREE_ROWS_WRITTEN_PER_DAY = 100000;
const D1_FREE_STORAGE_TOTAL_BYTES = 5 * 1024 * 1024 * 1024;
const D1_FREE_DATABASE_SIZE_BYTES = 500 * 1024 * 1024;
const GITHUB_API_BASE_URL = 'https://api.github.com';
const GITHUB_FREE_ACTIONS_MINUTES_MONTH = 2000;
const GITHUB_ACTIONS_CACHE_BYTES = 10 * 1024 * 1024 * 1024;
const GITHUB_PAGES_SITE_SIZE_BYTES = 1024 * 1024 * 1024;
const GITHUB_PAGES_BANDWIDTH_MONTH_BYTES = 100 * 1024 * 1024 * 1024;
const GITHUB_PAGES_BUILDS_PER_HOUR = 10;

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

function githubRepoEnv(env = {}) {
  const combined = clean(env.GITHUB_REPOSITORY || '', 240);
  const owner = clean(env.GITHUB_OWNER || (combined.includes('/') ? combined.split('/')[0] : ''), 120);
  const repo = clean(env.GITHUB_REPO || env.GITHUB_REPOSITORY_NAME || (combined.includes('/') ? combined.split('/').slice(1).join('/') : ''), 160);
  return { owner, repo };
}

function githubDurationMs(row = {}) {
  const start = Date.parse(row.created_at || row.run_started_at || row.createdAt || '');
  const end = Date.parse(row.updated_at || row.updatedAt || '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return end - start;
}

async function callGithubApi(env, path = '') {
  const token = clean(env.GITHUB_TOKEN || '', 4096);
  if (!token) throw new Error('github_token_missing');
  const safePath = String(path || '').startsWith('/') ? String(path || '') : `/${path || ''}`;
  const response = await fetch(`${GITHUB_API_BASE_URL}${safePath}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'wasteland-king-defender-admin'
    }
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const message = clean(data?.message || `github_http_${response.status}`, 180);
    throw new Error(message || `github_http_${response.status}`);
  }
  return data || {};
}

async function fetchGithubRepoUsage(env) {
  const { owner, repo } = githubRepoEnv(env);
  if (!owner || !repo) throw new Error('github_repo_missing');
  const repoData = await callGithubApi(env, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  return {
    owner,
    name: repo,
    fullName: clean(repoData.full_name || `${owner}/${repo}`, 200),
    defaultBranch: clean(repoData.default_branch || '', 120),
    visibility: clean(repoData.visibility || (repoData.private ? 'private' : 'public'), 40),
    private: Boolean(repoData.private),
    htmlUrl: clean(repoData.html_url || '', 260),
    sizeKb: numericMetric(repoData.size),
    pushedAt: clean(repoData.pushed_at || '', 80),
    updatedAt: clean(repoData.updated_at || '', 80)
  };
}

async function fetchGithubPagesUsage(env, repoInfo = {}) {
  const owner = repoInfo.owner;
  const repo = repoInfo.name;
  const pages = await callGithubApi(env, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pages`);
  const source = pages.source || {};
  return {
    status: clean(pages.status || '', 80),
    htmlUrl: clean(pages.html_url || '', 260),
    cname: clean(pages.cname || '', 180),
    protectedDomainState: clean(pages.protected_domain_state || '', 80),
    sourceBranch: clean(source.branch || '', 120),
    sourcePath: clean(source.path || '', 160),
    buildType: clean(pages.build_type || '', 80)
  };
}

async function fetchGithubActionsUsage(env, repoInfo = {}) {
  const owner = repoInfo.owner;
  const repo = repoInfo.name;
  const data = await callGithubApi(env, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=100`);
  const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
  const latest = runs[0] || {};
  const now = Date.now();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthStartMs = monthStart.getTime();
  const hourStartMs = now - (60 * 60 * 1000);
  let monthDurationMs = 0;
  let monthRuns = 0;
  let runsLastHour = 0;
  for (const row of runs) {
    const created = Date.parse(row.created_at || row.createdAt || '');
    if (!Number.isFinite(created)) continue;
    if (created >= monthStartMs) {
      monthRuns += 1;
      monthDurationMs += githubDurationMs(row);
    }
    if (created >= hourStartMs) runsLastHour += 1;
  }
  return {
    enabled: true,
    totalRuns: numericMetric(data.total_count),
    latestStatus: clean(latest.status || '', 80),
    latestConclusion: clean(latest.conclusion || '', 80),
    latestName: clean(latest.name || latest.display_title || '', 160),
    latestRunNumber: numericMetric(latest.run_number),
    latestUrl: clean(latest.html_url || '', 260),
    latestCreatedAt: clean(latest.created_at || '', 80),
    latestUpdatedAt: clean(latest.updated_at || '', 80),
    latestDurationMs: githubDurationMs(latest),
    monthDurationMs: numericMetric(monthDurationMs),
    monthMinutesUsed: Math.ceil(numericMetric(monthDurationMs) / 60000),
    monthRuns: numericMetric(monthRuns),
    runsLastHour: numericMetric(runsLastHour),
    recentRunsReturned: numericMetric(runs.length),
    recentRuns: runs.slice(0, 10).map(row => ({
      id: clean(row.id || '', 80),
      name: clean(row.name || row.display_title || '', 160),
      status: clean(row.status || '', 80),
      conclusion: clean(row.conclusion || '', 80),
      runNumber: numericMetric(row.run_number),
      htmlUrl: clean(row.html_url || '', 260),
      createdAt: clean(row.created_at || '', 80),
      updatedAt: clean(row.updated_at || '', 80)
    }))
  };
}

async function handleGithubUsage(request, env) {
  await requireAdminUser(request, env);
  const partialErrors = [];
  let repo = {};
  let pages = {};
  let actions = {};
  const hasToken = Boolean(clean(env.GITHUB_TOKEN || '', 4096));
  const { owner, repo: repoName } = githubRepoEnv(env);
  if (!hasToken || !owner || !repoName) {
    return json({
      ok: true,
      real: false,
      source: 'github-static-limits',
      repo: { owner, name: repoName, fullName: owner && repoName ? `${owner}/${repoName}` : '' },
      pages: {},
      actions: {},
      limits: {
        actionsMinutesMonth: GITHUB_FREE_ACTIONS_MINUTES_MONTH,
        actionsCacheBytes: GITHUB_ACTIONS_CACHE_BYTES,
        pagesSiteSizeBytes: GITHUB_PAGES_SITE_SIZE_BYTES,
        pagesBandwidthMonthBytes: GITHUB_PAGES_BANDWIDTH_MONTH_BYTES,
        pagesBuildsHour: GITHUB_PAGES_BUILDS_PER_HOUR
      },
      partialErrors: [{ source: 'github', error: hasToken ? 'github_repo_missing' : 'github_token_missing' }],
      generatedAt: new Date().toISOString()
    }, 200, 'private, no-store');
  }
  try {
    repo = await fetchGithubRepoUsage(env);
  } catch (error) {
    partialErrors.push({ source: 'repo', error: clean(error?.message || 'github_repo_failed', 180) });
  }
  if (repo?.owner && repo?.name) {
    try { pages = await fetchGithubPagesUsage(env, repo); }
    catch (error) { partialErrors.push({ source: 'pages', error: clean(error?.message || 'github_pages_failed', 180) }); }
    try { actions = await fetchGithubActionsUsage(env, repo); }
    catch (error) { partialErrors.push({ source: 'actions', error: clean(error?.message || 'github_actions_failed', 180) }); }
  }
  return json({
    ok: true,
    real: Boolean(repo?.fullName),
    source: 'github-rest-api',
    repo,
    pages,
    actions,
    limits: {
      actionsMinutesMonth: GITHUB_FREE_ACTIONS_MINUTES_MONTH,
      actionsCacheBytes: GITHUB_ACTIONS_CACHE_BYTES,
      pagesSiteSizeBytes: GITHUB_PAGES_SITE_SIZE_BYTES,
      pagesBandwidthMonthBytes: GITHUB_PAGES_BANDWIDTH_MONTH_BYTES,
      pagesBuildsHour: GITHUB_PAGES_BUILDS_PER_HOUR
    },
    partialErrors,
    generatedAt: new Date().toISOString()
  }, 200, 'private, no-store');
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
    alliance: clean(row.alliance || '', 40),
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
    alliance: clean(row.alliance || '', 40),
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
    alliance: clean(row.alliance || '', 40),
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


function directoryAlliance(value = '') {
  return Array.from(clean(value, 40).replace(/[\/\[\]#?]/g, '')).slice(0, 3).join('');
}
function directoryKey(value = '') {
  return clean(value, 200).toLowerCase();
}
function directoryRole(value = '') {
  const role = clean(value || 'player', 40).toLowerCase();
  return ['admin', 'moderator', 'consul', 'officer', 'player'].includes(role) ? role : 'player';
}
function directoryRowForDb(raw = {}) {
  const uid = clean(raw.uid || '', 160);
  const farmId = clean(raw.farmId || raw.farm_id || 'main', 80) || 'main';
  const nickname = clean(raw.nickname || raw.gameNick || raw.game_nick || '', 120);
  const displayName = clean(raw.displayName || raw.display_name || '', 160);
  const email = clean(raw.email || '', 180);
  const role = directoryRole(raw.role || 'player');
  const accountRole = directoryRole(raw.accountRole || raw.account_role || role);
  return {
    uid,
    farmId,
    nickname,
    nicknameKey: directoryKey(nickname),
    email,
    emailKey: directoryKey(email),
    displayName,
    displayKey: directoryKey(displayName),
    photoURL: clean(raw.photoURL || raw.photo_url || '', 300),
    region: normalizeRegion(raw.region),
    alliance: directoryAlliance(raw.alliance),
    role,
    accountRole,
    rank: clean(raw.rank || '', 20).toLowerCase(),
    shk: clean(raw.shk || '', 20),
    farmCount: Math.max(0, Math.min(200, Number(raw.farmCount || raw.farm_count) || 0)),
    updatedAtMs: Number(raw.updatedAtMs || raw.updated_at_ms) || Date.now(),
  };
}
function directoryRowToObject(row = {}) {
  return {
    uid: clean(row.uid || '', 160),
    farmId: clean(row.farm_id || 'main', 80) || 'main',
    nickname: clean(row.nickname || '', 120),
    gameNick: clean(row.nickname || '', 120),
    email: clean(row.email || '', 180),
    displayName: clean(row.display_name || '', 160),
    photoURL: clean(row.photo_url || '', 300),
    region: normalizeRegion(row.region),
    alliance: directoryAlliance(row.alliance),
    role: directoryRole(row.role || 'player'),
    accountRole: directoryRole(row.account_role || row.role || 'player'),
    rank: clean(row.rank || '', 20).toLowerCase(),
    shk: clean(row.shk || '', 20),
    farmCount: Math.max(0, Number(row.farm_count) || 0),
    updatedAtMs: Number(row.updated_at_ms) || 0,
    source: 'cloudflare-d1-directory'
  };
}
function directoryAccessFromRows(rows = [], env, uid = '') {
  const roles = new Set();
  const regions = new Set();
  const alliances = new Set();
  (Array.isArray(rows) ? rows : []).forEach(row => {
    const role = directoryRole(row.account_role || row.role || 'player');
    roles.add(role);
    const region = normalizeRegion(row.region);
    const alliance = directoryAlliance(row.alliance);
    if (region) regions.add(region);
    if (region && alliance) alliances.add(`${region}:${alliance}`);
  });
  const isGlobal = isAdminUid(env, uid) || roles.has('admin') || roles.has('moderator');
  return { isGlobal, roles, regions: [...regions], alliances: [...alliances] };
}
async function readDirectoryAccess(db, env, user) {
  const result = await db.prepare(
    `SELECT region, alliance, role, account_role FROM notification_directory WHERE uid = ?1 AND deleted = 0 LIMIT 80`
  ).bind(user.uid).all();
  return directoryAccessFromRows(result?.results || [], env, user.uid);
}
function addDirectoryAccessWhere(where, params, access) {
  if (access.isGlobal) return;
  if (!access.regions.length) {
    where.push('1 = 0');
    return;
  }
  const regionPlaceholders = access.regions.map(() => '?').join(',');
  where.push(`region IN (${regionPlaceholders})`);
  params.push(...access.regions);
  const isConsul = access.roles.has('consul');
  if (!isConsul && access.alliances.length) {
    const pairs = access.alliances.map(pair => pair.split(':'));
    const pairSql = pairs.map(() => `(region = ? AND alliance = ?)`).join(' OR ');
    where.push(`(${pairSql})`);
    pairs.forEach(([region, alliance]) => params.push(region, alliance));
  }
}
function buildDirectoryWhere(url, access, { count = false } = {}) {
  const where = ['deleted = 0'];
  const params = [];
  const type = clean(url.searchParams.get('targetType') || url.searchParams.get('type') || 'player', 40).toLowerCase();
  const q = directoryKey(url.searchParams.get('q') || url.searchParams.get('query') || '').slice(0, 80);
  const region = normalizeRegion(url.searchParams.get('region'));
  const alliance = directoryAlliance(url.searchParams.get('alliance'));
  const role = directoryRole(url.searchParams.get('role') || '');

  addDirectoryAccessWhere(where, params, access);

  if (type === 'admins') {
    where.push(`(account_role IN ('admin','moderator') OR role IN ('admin','moderator'))`);
  } else if (type === 'consuls') {
    where.push(`role = 'consul'`);
  } else if (type === 'officers') {
    where.push(`role = 'officer'`);
  } else if (role && role !== 'player') {
    where.push(`(account_role = ? OR role = ?)`);
    params.push(role, role);
  }
  if (region) {
    where.push('region = ?');
    params.push(region);
  }
  if (alliance) {
    where.push('alliance = ?');
    params.push(alliance);
  }
  if (q && !count) {
    where.push(`(nickname_key LIKE ? OR email_key LIKE ? OR display_key LIKE ?)`);
    params.push(`${q}%`, `${q}%`, `${q}%`);
  } else if (q && count) {
    where.push(`(nickname_key LIKE ? OR email_key LIKE ? OR display_key LIKE ?)`);
    params.push(`${q}%`, `${q}%`, `${q}%`);
  }
  return { where, params, type, q, region, alliance, role };
}
async function handleNotificationDirectoryUpsert(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  let body = null;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const rows = (Array.isArray(body?.rows) ? body.rows : []).map(directoryRowForDb).filter(row => row.uid && row.nickname).slice(0, 20);
  if (!rows.length) return json({ ok: true, indexed: 0, rowsWritten: 0, source: 'cloudflare-d1-directory' });
  const ownsAllRows = rows.every(row => row.uid === user.uid);
  if (!ownsAllRows && !isAdminUid(env, user.uid)) return json({ ok: false, error: 'admin_only' }, 403);
  const uids = [...new Set(rows.map(row => row.uid))];
  const statements = [];
  for (const uid of uids) {
    statements.push(db.prepare(`UPDATE notification_directory SET deleted = 1 WHERE uid = ?1`).bind(uid));
  }
  for (const row of rows) {
    statements.push(db.prepare(
      `INSERT INTO notification_directory (uid, farm_id, nickname, nickname_key, email, email_key, display_name, display_key, photo_url, region, alliance, role, account_role, rank, shk, farm_count, updated_at_ms, deleted)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, 0)
       ON CONFLICT(uid, farm_id) DO UPDATE SET
         nickname = excluded.nickname,
         nickname_key = excluded.nickname_key,
         email = excluded.email,
         email_key = excluded.email_key,
         display_name = excluded.display_name,
         display_key = excluded.display_key,
         photo_url = excluded.photo_url,
         region = excluded.region,
         alliance = excluded.alliance,
         role = excluded.role,
         account_role = excluded.account_role,
         rank = excluded.rank,
         shk = excluded.shk,
         farm_count = excluded.farm_count,
         updated_at_ms = excluded.updated_at_ms,
         deleted = 0`
    ).bind(row.uid, row.farmId, row.nickname, row.nicknameKey, row.email, row.emailKey, row.displayName, row.displayKey, row.photoURL, row.region, row.alliance, row.role, row.accountRole, row.rank, row.shk, row.farmCount, row.updatedAtMs));
  }
  await db.batch(statements);
  return json({ ok: true, indexed: rows.length, rowsWritten: statements.length, source: 'cloudflare-d1-directory' });
}
async function handleNotificationDirectoryList(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  const url = new URL(request.url);
  const access = await readDirectoryAccess(db, env, user);
  const limitValue = Math.max(1, Math.min(30, Number(url.searchParams.get('limit')) || 10));
  const built = buildDirectoryWhere(url, access);
  const sql = `SELECT * FROM notification_directory WHERE ${built.where.join(' AND ')} ORDER BY updated_at_ms DESC, nickname_key ASC LIMIT ?`;
  const result = await db.prepare(sql).bind(...built.params, limitValue).all();
  return json({ ok: true, rows: (result?.results || []).map(directoryRowToObject), source: 'cloudflare-d1-directory' });
}
async function handleNotificationDirectoryCount(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  const url = new URL(request.url);
  const access = await readDirectoryAccess(db, env, user);
  const built = buildDirectoryWhere(url, access, { count: true });
  const row = await db.prepare(`SELECT COUNT(DISTINCT uid) AS count FROM notification_directory WHERE ${built.where.join(' AND ')}`).bind(...built.params).first();
  return json({ ok: true, count: Math.max(0, Number(row?.count) || 0), source: 'cloudflare-d1-directory' });
}
async function handleNotificationDirectoryRegions(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  const access = await readDirectoryAccess(db, env, user);
  const where = ['deleted = 0', `region <> ''`];
  const params = [];
  addDirectoryAccessWhere(where, params, access);
  const result = await db.prepare(
    `SELECT region, COUNT(DISTINCT uid) AS count FROM notification_directory WHERE ${where.join(' AND ')} GROUP BY region ORDER BY CAST(region AS INTEGER) ASC LIMIT 500`
  ).bind(...params).all();
  return json({ ok: true, rows: result?.results || [], source: 'cloudflare-d1-directory' });
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
    lastAlliance: clean(row.last_alliance || '', 40),
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
    alliance: clean(raw.alliance || '', 40),
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
    lastAlliance: Object.hasOwn(body || {}, 'lastAlliance') ? clean(body.lastAlliance, 40) : clean(existing?.last_alliance || '', 40),
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
    alliance: clean(raw.alliance || '', 40),
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


function isSystemCampaignType(type = '') {
  const value = clean(type, 80).toLowerCase();
  return value.startsWith('registration_') || value === 'registration_notice' || value === 'region_status';
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
    alliance: clean(raw.alliance || raw.targetAlliance || '', 40),
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


function normalizeBellRole(value = '') {
  const role = clean(value || 'player', 40).toLowerCase();
  return ['admin', 'moderator', 'consul', 'officer', 'player'].includes(role) ? role : 'player';
}

function normalizeBellAlliance(value = '') {
  return Array.from(clean(value || '', 40).replace(/[\/\[\]#?]/g, '')).slice(0, 3).join('');
}

function parseBellGames(url) {
  const out = [];
  try {
    const raw = JSON.parse(url.searchParams.get('games') || '[]');
    (Array.isArray(raw) ? raw : []).forEach(game => {
      const region = normalizeRegion(game?.region);
      if (!region) return;
      out.push({
        region,
        alliance: normalizeBellAlliance(game?.alliance || ''),
        role: normalizeBellRole(game?.role || game?.accountRole || 'player'),
        accountRole: normalizeBellRole(game?.accountRole || game?.role || 'player')
      });
    });
  } catch (_) {}
  if (!out.length) {
    clean(url.searchParams.get('regions') || '', 300).split(',').map(normalizeRegion).filter(Boolean).forEach(region => {
      out.push({ region, alliance: '', role: 'player', accountRole: 'player' });
    });
  }
  const seen = new Set();
  return out.filter(game => {
    const key = `${game.region}:${game.alliance}:${game.role}:${game.accountRole}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

function buildBellCampaignQuery(games = [], sinceMs = 0, nowMs = Date.now(), limitValue = 1) {
  const params = [];
  const add = value => { params.push(value); return `?${params.length}`; };
  const regions = [...new Set(games.map(game => normalizeRegion(game.region)).filter(Boolean))].slice(0, 10);
  if (!regions.length) return null;

  const clauses = [];
  const regionIn = list => list.length ? `region IN (${list.map(region => add(region)).join(',')})` : '';
  clauses.push(`(target_type IN ('all','region') AND ${regionIn(regions)})`);

  const alliancePairs = [];
  games.forEach(game => {
    const region = normalizeRegion(game.region);
    const alliance = normalizeBellAlliance(game.alliance);
    if (region && alliance) alliancePairs.push([region, alliance]);
  });
  const seenAlliance = new Set();
  const allianceParts = alliancePairs.filter(([region, alliance]) => {
    const key = `${region}:${alliance}`;
    if (seenAlliance.has(key)) return false;
    seenAlliance.add(key);
    return true;
  }).slice(0, 20).map(([region, alliance]) => `(region = ${add(region)} AND alliance = ${add(alliance)})`);
  if (allianceParts.length) clauses.push(`(target_type = 'alliance' AND (${allianceParts.join(' OR ')}))`);

  const consulRegions = [...new Set(games.filter(game => ['consul'].includes(normalizeBellRole(game.role)) || ['consul'].includes(normalizeBellRole(game.accountRole))).map(game => normalizeRegion(game.region)).filter(Boolean))];
  if (consulRegions.length) clauses.push(`(target_type = 'consuls' AND ${regionIn(consulRegions)})`);

  const officerRegions = [...new Set(games.filter(game => ['officer'].includes(normalizeBellRole(game.role)) || ['officer'].includes(normalizeBellRole(game.accountRole))).map(game => normalizeRegion(game.region)).filter(Boolean))];
  if (officerRegions.length) clauses.push(`(target_type = 'officers' AND ${regionIn(officerRegions)})`);

  const where = `created_at_ms > ${add(Math.max(0, Number(sinceMs) || 0))}
    AND (expires_at_ms = 0 OR expires_at_ms > ${add(nowMs)})
    AND (${clauses.join(' OR ')})`;
  const sql = `SELECT * FROM notification_campaigns WHERE ${where} ORDER BY created_at_ms DESC LIMIT ${add(Math.max(1, Math.min(20, Number(limitValue) || 1)))}`;
  return { sql, params };
}

async function handleNotificationsBell(request, env) {
  const db = regionTableDb(env);
  if (!db) return json({ ok: false, error: 'd1_not_configured' }, 500);
  await ensureRegionTableSchema(db);
  const user = await verifyFirebaseToken(request, env);
  const url = new URL(request.url);
  const games = parseBellGames(url);
  const sinceMs = Math.max(0, Number(url.searchParams.get('sinceMs')) || 0);
  const mode = clean(url.searchParams.get('mode') || 'dot', 20) === 'preview' ? 'preview' : 'dot';
  const limitValue = mode === 'preview' ? Math.max(1, Math.min(5, Number(url.searchParams.get('limit')) || 5)) : 1;
  const nowMs = Date.now();
  const summaryRow = await db.prepare(`SELECT * FROM user_notification_summary WHERE uid = ?1 LIMIT 1`).bind(user.uid).first();
  let campaignRows = [];
  if (games.length) {
    const query = buildBellCampaignQuery(games, sinceMs, nowMs, limitValue);
    if (query) {
      const result = await db.prepare(query.sql).bind(...query.params).all();
      const rows = (result?.results || []).map(campaignRowToObject);
      campaignRows = mode === 'preview' ? rows : [];
      if (mode !== 'preview' && rows.length) campaignRows = [];
      return json({
        ok: true,
        summary: summaryRowToObject(summaryRow || {}, user.uid),
        rows: campaignRows,
        hasCampaignUnread: rows.length > 0,
        mode,
        usage: { d1RowsRead: 1 + rows.length, d1RowsWritten: 0 },
        source: 'cloudflare-d1-notifications-bell'
      }, 200, 'private, no-store');
    }
  }
  return json({
    ok: true,
    summary: summaryRowToObject(summaryRow || {}, user.uid),
    rows: [],
    hasCampaignUnread: false,
    mode,
    usage: { d1RowsRead: 1, d1RowsWritten: 0 },
    source: 'cloudflare-d1-notifications-bell'
  }, 200, 'private, no-store');
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
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledD1Cleanup(env, Number(event?.scheduledTime) || Date.now()).catch((error) => {
      console.error('[WKD Cron] D1 auto-cleanup failed', error);
    }));
  },

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

      if (url.pathname === "/api/admin/usage/github" && request.method === "GET") {
        return await handleGithubUsage(request, env);
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

      if (url.pathname === "/api/public-share/export" && request.method === "GET") {
        return await handlePublicShareSnapshotExport(request, env);
      }




      if (url.pathname === "/api/notification-directory" && request.method === "GET") {
        return handleNotificationDirectoryList(request, env);
      }
      if (url.pathname === "/api/notification-directory/count" && request.method === "GET") {
        return handleNotificationDirectoryCount(request, env);
      }
      if (url.pathname === "/api/notification-directory/regions" && request.method === "GET") {
        return handleNotificationDirectoryRegions(request, env);
      }
      if (url.pathname === "/api/notification-directory/upsert" && request.method === "POST") {
        return handleNotificationDirectoryUpsert(request, env);
      }

      if (url.pathname === "/api/notifications/bell" && request.method === "GET") {
        return await handleNotificationsBell(request, env);
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

      if (url.pathname === "/api/region-shares/rotate" && request.method === "POST") {
        return await handleRegionSharesRotate(request, env);
      }

      if (url.pathname === "/api/secret-links/inspect" && request.method === "POST") {
        return await handleSecretLinksInspect(request, env);
      }
      if (url.pathname === "/api/secret-links/rotate" && request.method === "POST") {
        return await handleSecretLinksRotate(request, env);
      }
      if (url.pathname === "/api/d1-cleanup/inspect" && request.method === "POST") {
        return await handleD1StorageInspect(request, env);
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

      if (url.pathname === "/api/region-form/settings" && request.method === "GET") {
        return await handleRegionFormSettingsRead(request, env);
      }

      if (url.pathname === "/api/region-form/settings" && request.method === "PUT") {
        return await handleRegionFormSettingsPut(request, env);
      }

      const regionFormShareMatch = url.pathname.match(/^\/api\/region-form\/share\/([A-Za-z0-9_-]{6,140})$/);
      if (regionFormShareMatch && request.method === "GET") {
        return await handleRegionFormShareRead(request, env, regionFormShareMatch[1]);
      }


      const publicRegionTableSnapshotMatch = url.pathname.match(/^\/public-cache\/share\/rt\/([A-Za-z0-9_-]{6,140})\.json$/);
      if (publicRegionTableSnapshotMatch && request.method === "GET") {
        return await handlePublicRegionTableSnapshot(request, env, publicRegionTableSnapshotMatch[1]);
      }

      const publicFinalPlanSnapshotMatch = url.pathname.match(/^\/public-cache\/share\/p\/([A-Za-z0-9_-]{6,140})\.json$/);
      if (publicFinalPlanSnapshotMatch && request.method === "GET") {
        return await handlePublicFinalPlanSnapshot(request, env, publicFinalPlanSnapshotMatch[1]);
      }

      if (url.pathname === "/api/region-alliances" && request.method === "GET") {
        return await handleRegionAlliancesRead(request, env);
      }

      if (url.pathname === "/api/region-alliances" && request.method === "PUT") {
        return await handleRegionAlliancesPut(request, env);
      }

      if (url.pathname === "/api/region-alliances" && request.method === "DELETE") {
        return await handleRegionAlliancesDelete(request, env);
      }

      if (url.pathname === "/api/region-table/archive" && request.method === "GET") {
        return await handleRegionCycleArchiveList(request, env);
      }

      const regionCycleArchiveMatch = url.pathname.match(/^\/api\/region-table\/archive\/([A-Za-z0-9._:-]{1,90})$/);
      if (regionCycleArchiveMatch && request.method === "GET") {
        return await handleRegionCycleArchiveRead(request, env, regionCycleArchiveMatch[1]);
      }

      if (url.pathname === "/api/region-table" && request.method === "GET") {
        return await handleRegionTableRead(request, env);
      }

      if (url.pathname === "/api/region-table/my-registration" && request.method === "GET") {
        return await handleMyRegionTableRegistration(request, env);
      }

      if (url.pathname === "/api/region-table/import-lock" && request.method === "GET") {
        return await handleRegionImportLockRead(request, env);
      }

      if (url.pathname === "/api/region-table/import-lock" && request.method === "POST") {
        return await handleRegionImportLockCommit(request, env);
      }


      if (url.pathname === "/api/region-table/delete-rows" && request.method === "POST") {
        return await handleRegionTableDeleteRows(request, env);
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


      if (url.pathname === "/api/tower-plan" && request.method === "GET") {
        return await handleTowerPlanRead(request, env);
      }

      if (url.pathname === "/api/tower-plan" && request.method === "PUT") {
        return await handleTowerPlanPut(request, env);
      }

      if (url.pathname === "/api/final-plan/share" && request.method === "POST") {
        return await handleFinalPlanShareCreate(request, env);
      }

      const finalPlanShareMatch = url.pathname.match(/^\/api\/final-plan\/share\/([A-Za-z0-9_-]{6,140})$/);
      if (finalPlanShareMatch && request.method === "GET") {
        return await handleFinalPlanShareRead(request, env, finalPlanShareMatch[1]);
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

    const formShortMatch = url.pathname.match(/^\/f\/([A-Za-z0-9_-]{6,120})$/);
    if (formShortMatch) {
      return Response.redirect(
        `${url.origin}/region-form.html?s=${encodeURIComponent(formShortMatch[1])}`,
        302,
      );
    }

    const formMatch = url.pathname.match(
      /^\/f\/(\d{1,8})\/([A-Za-z0-9_-]{6,120})$/,
    );
    if (formMatch) {
      return Response.redirect(
        `${url.origin}/region-form.html?s=${encodeURIComponent(formMatch[2])}`,
        302,
      );
    }

    const planMatch = url.pathname.match(/^\/(?:p|plan)\/([A-Za-z0-9_-]{6,120})$/);
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


    if (url.pathname === "/public-region-table") {
      return Response.redirect(`${url.origin}/public-region-table.html${url.search || ''}`, 302);
    }
    if (url.pathname === "/public-plan") {
      return Response.redirect(`${url.origin}/public-plan.html${url.search || ''}`, 302);
    }
    if (url.pathname === "/region-form") {
      return Response.redirect(`${url.origin}/region-form.html${url.search || ''}`, 302);
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
