const MAX_MESSAGE_LENGTH = 2000;
const MAX_FIELD_LENGTH = 300;
const MAX_TABLE_ROWS = 1000;
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let firebaseJwksCache = { expiresAt: 0, keys: null };

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
      if (url.pathname === "/api/public-stats/player" && request.method === "POST") {
        return await handlePublicStatsPlayerUpsert(request, env);
      }

      if (url.pathname === "/api/public-stats/import" && request.method === "POST") {
        return await handlePublicStatsImport(request, env);
      }

      if (url.pathname === "/api/public-stats/export" && request.method === "GET") {
        return await handlePublicStatsExport(request, env);
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
