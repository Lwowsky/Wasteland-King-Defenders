import { regionTableCacheConfig } from '../config/region-table-cache.config.js';
import { trackCloudflareUsage } from './usage-tracker.js?v=140';

const MAX_ROWS = 1000;
const REGION_TABLE_CACHE_TTL_MS = 60 * 1000;
const SHARE_TABLE_CACHE_TTL_MS = 90 * 1000;
const REGION_FORM_SETTINGS_TTL_MS = 5 * 60 * 1000;

function cleanText(value = '', max = 120) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanRegion(value = '') {
  return cleanText(value, 20).replace(/[^0-9]/g, '').slice(0, 8);
}

function cleanCode(value = '') {
  return cleanText(value, 160).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 140);
}

function numberValue(value) {
  const num = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
}

function rowId(row = {}) {
  return cleanText(row.id || row.uid || row.publicKey || row.nickname || `${Date.now()}`, 180);
}

export function isRegionTableCacheEnabled() {
  return Boolean(regionTableCacheConfig?.enabled);
}

function apiUrl(path = '') {
  const base = cleanText(regionTableCacheConfig?.apiBaseUrl || '', 240).replace(/\/+$/, '');
  const safePath = String(path || '').startsWith('/') ? String(path || '') : `/${path || ''}`;
  if (!base) return safePath;
  return `${base}${safePath}`;
}

async function getFirebaseToken(user) {
  if (!user || typeof user.getIdToken !== 'function') return '';
  try {
    return await user.getIdToken(false);
  } catch {
    return '';
  }
}

function localCacheKey(kind, id) {
  return `wkd.${kind}.d1.v140.${cleanText(id, 160)}`;
}

function readLocalTableCache(kind, id, ttlMs) {
  try {
    const raw = localStorage.getItem(localCacheKey(kind, id));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || (Date.now() - Number(data.savedAtMs || 0)) > ttlMs) return null;
    if (!data.table) return null;
    return normalizeTableResponse({ table: data.table, cached: true, source: 'browser-d1-cache' });
  } catch {
    return null;
  }
}

function writeLocalTableCache(kind, id, table) {
  try {
    localStorage.setItem(localCacheKey(kind, id), JSON.stringify({ savedAtMs: Date.now(), table }));
  } catch {}
}

function removeLocalTableCache(kind, id) {
  try { localStorage.removeItem(localCacheKey(kind, id)); } catch {}
}


function readLocalJsonCache(kind, id, ttlMs) {
  try {
    const raw = localStorage.getItem(localCacheKey(kind, id));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || (Date.now() - Number(data.savedAtMs || 0)) > ttlMs) return null;
    return data.value || null;
  } catch {
    return null;
  }
}
function writeLocalJsonCache(kind, id, value) {
  try { localStorage.setItem(localCacheKey(kind, id), JSON.stringify({ savedAtMs: Date.now(), value })); } catch {}
}
function removeLocalJsonCache(kind, id) {
  try { localStorage.removeItem(localCacheKey(kind, id)); } catch {}
}

function browserRegistrationKey(region = '', cycleId = 'active') {
  const safeRegion = cleanRegion(region) || 'region';
  const safeCycle = cleanText(cycleId || 'active', 80).replace(/[^A-Za-z0-9._:-]/g, '-');
  const key = `wkd.d1PublicRegistrationKey.${safeRegion}.${safeCycle}`;
  try {
    const existing = localStorage.getItem(key);
    if (existing) return cleanText(existing, 120);
    const value = `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(key, value);
    return value;
  } catch {
    return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function sanitizeRegistrationValues(values = {}) {
  return {
    farmId: cleanText(values.farmId || 'main', 80) || 'main',
    nickname: cleanText(values.nickname || values.gameNick || values.name || '', 80),
    alliance: cleanText(values.alliance || '', 12),
    rank: cleanText(values.rank || '', 16).toLowerCase(),
    shk: cleanText(values.shk || '', 12),
    troopType: cleanText(values.troopType || '', 40),
    tier: cleanText(values.tier || '', 12).toUpperCase(),
    lairLevel: numberValue(values.lairLevel),
    marchSize: numberValue(values.marchSize),
    rallySize: numberValue(values.rallySize),
    readyToJoin: values.readyToJoin !== false,
    readyToAttack: Boolean(values.readyToAttack),
    captainReady: Boolean(values.captainReady),
    shift: cleanText(values.shift || '', 40),
    comment: cleanText(values.comment || '', 300),
    extraEnabled: Boolean(values.extraEnabled || (Array.isArray(values.extraSquads) && values.extraSquads.length)),
    extraSquads: Array.isArray(values.extraSquads)
      ? values.extraSquads.map(item => ({ troopType: cleanText(item?.troopType || '', 40), tier: cleanText(item?.tier || '', 12).toUpperCase() })).filter(item => item.troopType && item.tier).slice(0, 8)
      : [],
    extraTroopType: cleanText(values.extraTroopType || '', 40),
    extraTier: cleanText(values.extraTier || '', 12).toUpperCase(),
    customFields: values.customFields && typeof values.customFields === 'object' ? values.customFields : {}
  };
}

async function requestJson(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    cache: 'no-store',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error || `region-table-cache-${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  const usage = data?.usage || {};
  const tableRows = Array.isArray(data?.table?.rows) ? data.table.rows.length : (Array.isArray(data?.rows) ? data.rows.length : 0);
  trackCloudflareUsage({
    workerRequests: 1,
    d1RowsRead: Number(usage.d1RowsRead ?? usage.rowsRead ?? tableRows) || 0,
    d1RowsWritten: Number(usage.d1RowsWritten ?? usage.rowsWritten ?? (options.method && options.method !== 'GET' ? Math.max(1, tableRows) : 0)) || 0
  });
  return data || {};
}

function sanitizeTableRow(row = {}) {
  return {
    id: rowId(row),
    uid: cleanText(row.uid || '', 120),
    farmId: cleanText(row.farmId || '', 80),
    nickname: cleanText(row.nickname || row.name || row.gameNick || '', 80),
    region: cleanRegion(row.region),
    alliance: cleanText(row.alliance || '', 12),
    rank: cleanText(row.rank || '', 16).toLowerCase(),
    shk: cleanText(row.shk || '', 12),
    role: cleanText(row.role || 'player', 40).toLowerCase(),
    roleLabel: cleanText(row.roleLabel || '', 80),
    troopType: cleanText(row.troopType || row.wastelandProfile?.troopType || '', 40),
    troopLabel: cleanText(row.troopLabel || '', 80),
    tier: cleanText(row.tier || row.wastelandProfile?.tier || '', 12).toUpperCase(),
    lairLevel: numberValue(row.lairLevel || row.wastelandProfile?.lairLevel),
    marchSize: numberValue(row.marchSize || row.wastelandProfile?.marchSize),
    rallySize: numberValue(row.rallySize || row.wastelandProfile?.rallySize),
    captainReady: Boolean(row.captainReady ?? row.wastelandProfile?.captainReady),
    readyToJoin: Boolean(row.readyToJoin ?? row.wastelandProfile?.readyToJoin),
    readyToAttack: Boolean(row.readyToAttack ?? row.wastelandProfile?.readyToAttack),
    shift: cleanText(row.shift || row.wastelandProfile?.shift || '', 40),
    shiftLabel: cleanText(row.shiftLabel || '', 80),
    comment: cleanText(row.comment || row.wastelandProfile?.comment || '', 300),
    extraEnabled: Boolean(row.extraEnabled || row.wastelandProfile?.extraEnabled || (Array.isArray(row.extraSquads) && row.extraSquads.length)),
    extraSquads: Array.isArray(row.extraSquads)
      ? row.extraSquads.map(item => ({ troopType: cleanText(item?.troopType || '', 40), tier: cleanText(item?.tier || '', 12).toUpperCase() })).filter(item => item.troopType && item.tier).slice(0, 8)
      : [],
    extraTroopType: cleanText(row.extraTroopType || row.wastelandProfile?.extraTroopType || '', 40),
    extraTier: cleanText(row.extraTier || row.wastelandProfile?.extraTier || '', 12).toUpperCase(),
    customFields: row.customFields && typeof row.customFields === 'object' && !Array.isArray(row.customFields) ? row.customFields : {},
    source: cleanText(row.source || 'registration', 40),
    rowType: cleanText(row.rowType || '', 80),
    updatedAtMs: Number(row.updatedAtMs || row.submittedAtMs || Date.now()) || Date.now()
  };
}

function sanitizeCustomShifts(items = []) {
  return Array.isArray(items)
    ? items.map(item => ({ id: cleanText(item?.id || item?.value || '', 40), label: cleanText(item?.label || item?.name || item?.id || '', 80) })).filter(item => item.id).slice(0, 20)
    : [];
}
function sanitizeCustomTroops(items = []) {
  return Array.isArray(items)
    ? items.map(item => ({ id: cleanText(item?.id || item?.value || '', 40), label: cleanText(item?.label || item?.name || item?.id || '', 80) })).filter(item => item.id).slice(0, 20)
    : [];
}
function sanitizeCustomFields(fields = []) {
  return Array.isArray(fields)
    ? fields.map(item => ({ id: cleanText(item?.id || '', 50), label: cleanText(item?.label || item?.id || '', 120), type: cleanText(item?.type || 'text', 20) })).filter(item => item.id).slice(0, 20)
    : [];
}
function sanitizeRotationAlliances(items = []) {
  return Array.isArray(items)
    ? items.map(item => ({ tag: cleanText(item?.tag || item?.alliance || item?.name || '', 12), name: cleanText(item?.name || item?.label || item?.tag || '', 80) })).filter(item => item.tag).slice(0, 80)
    : [];
}
function sanitizeSettings(settings = {}) {
  const customShifts = sanitizeCustomShifts(settings.customShifts || []);
  const customTroopTypes = sanitizeCustomTroops(settings.customTroopTypes || []);
  return {
    open: Boolean(settings.open),
    enabled: Boolean(settings.enabled),
    title: cleanText(settings.title || '', 160),
    description: cleanText(settings.description || '', 500),
    hostAlliance: cleanText(settings.hostAlliance || '', 12),
    governor: cleanText(settings.governor || '', 120),
    currentCycleId: cleanText(settings.currentCycleId || '', 80),
    closeAtMs: Number(settings.closeAtMs) || 0,
    eventStartAtMs: Number(settings.eventStartAtMs || settings.startAtMs) || 0,
    startAtMs: Number(settings.startAtMs || settings.eventStartAtMs) || 0,
    openAtMs: Number(settings.openAtMs) || 0,
    openedAtMs: Number(settings.openedAtMs || settings.startedAtMs) || 0,
    closedAtMs: Number(settings.closedAtMs) || 0,
    openedByName: cleanText(settings.openedByName || settings.startedByName || '', 120),
    openedByEmail: cleanText(settings.openedByEmail || settings.startedByEmail || '', 160),
    openedByUid: cleanText(settings.openedByUid || settings.startedByUid || '', 160),
    closedByName: cleanText(settings.closedByName || '', 120),
    closedByUid: cleanText(settings.closedByUid || '', 160),
    shifts: Array.isArray(settings.shifts) ? settings.shifts.map(item => cleanText(item, 40)).filter(Boolean).slice(0, 12) : [],
    customShifts,
    customTroopTypes,
    customFields: sanitizeCustomFields(settings.customFields || []),
    allowExtraTroop: Boolean(settings.allowExtraTroop),
    minTier: cleanText(settings.minTier || '', 12).toUpperCase(),
    closeRule: cleanText(settings.closeRule || '', 40),
    closeHours: Number(settings.closeHours) || 0,
    autoOpenEnabled: Boolean(settings.autoOpenEnabled),
    autoOpenDay: Number(settings.autoOpenDay) || 0,
    autoOpenTime: cleanText(settings.autoOpenTime || '', 10),
    rotationEnabled: Boolean(settings.rotationEnabled),
    rotationLoop: Boolean(settings.rotationLoop),
    rotationActiveIndex: Number(settings.rotationActiveIndex) || 0,
    rotationAlliances: sanitizeRotationAlliances(settings.rotationAlliances || []),
    updatedAtMs: Number(settings.updatedAtMs) || 0,
    updatedByName: cleanText(settings.updatedByName || '', 120)
  };
}

export async function readRegionTableSnapshot(user, region, options = {}) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-table-cache-disabled');
  const safeRegion = cleanRegion(region);
  if (!safeRegion) throw new Error('region-required');
  if (!options?.force) {
    const cached = readLocalTableCache('regionTableSnapshot', safeRegion, Number(options?.ttlMs) || REGION_TABLE_CACHE_TTL_MS);
    if (cached) return cached;
  }
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const data = await requestJson(`/api/region-table?region=${encodeURIComponent(safeRegion)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const normalized = normalizeTableResponse(data);
  writeLocalTableCache('regionTableSnapshot', safeRegion, normalized);
  return normalized;
}

export async function readRegionTableShare(code, options = {}) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-table-cache-disabled');
  const safeCode = cleanCode(code);
  if (!safeCode) throw new Error('share-code-required');
  if (!options?.force) {
    const cached = readLocalTableCache('regionTableShare', safeCode, Number(options?.ttlMs) || SHARE_TABLE_CACHE_TTL_MS);
    if (cached) return cached;
  }
  const data = await requestJson(`/api/region-table/share/${encodeURIComponent(safeCode)}`);
  const normalized = normalizeTableResponse(data);
  writeLocalTableCache('regionTableShare', safeCode, normalized);
  return normalized;
}


function normalizeRegionFormResponse(data = {}) {
  const item = data.form || data;
  const settings = sanitizeSettings(item.settings || data.settings || {});
  return {
    ok: data.ok !== false,
    region: cleanRegion(item.region || data.region),
    code: cleanCode(item.code || data.code || ''),
    settings,
    version: Number(item.version || item.updatedAtMs || data.version || 0) || 0,
    updatedAtMs: Number(item.updatedAtMs || data.updatedAtMs || 0) || 0,
    cached: true,
    source: data.source || 'cloudflare-d1-form-settings'
  };
}

export async function readRegionFormSettings(region, options = {}) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-form-cache-disabled');
  const safeRegion = cleanRegion(region);
  if (!safeRegion) throw new Error('region-required');
  if (!options?.force) {
    const cached = readLocalJsonCache('regionFormSettings', safeRegion, Number(options?.ttlMs) || REGION_FORM_SETTINGS_TTL_MS);
    if (cached?.settings) return cached;
  }
  const data = await requestJson(`/api/region-form/settings?region=${encodeURIComponent(safeRegion)}`);
  const normalized = normalizeRegionFormResponse(data);
  writeLocalJsonCache('regionFormSettings', safeRegion, normalized);
  return normalized;
}

export async function readRegionFormShare(code, options = {}) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-form-cache-disabled');
  const safeCode = cleanCode(code);
  if (!safeCode) throw new Error('share-code-required');
  if (!options?.force) {
    const cached = readLocalJsonCache('regionFormShare', safeCode, Number(options?.ttlMs) || REGION_FORM_SETTINGS_TTL_MS);
    if (cached?.settings) return cached;
  }
  const data = await requestJson(`/api/region-form/share/${encodeURIComponent(safeCode)}`);
  const normalized = normalizeRegionFormResponse(data);
  writeLocalJsonCache('regionFormShare', safeCode, normalized);
  if (normalized.region) writeLocalJsonCache('regionFormSettings', normalized.region, normalized);
  return normalized;
}

export async function publishRegionFormSettings(user, payload = {}) {
  if (!isRegionTableCacheEnabled()) return { skipped: true };
  const safeRegion = cleanRegion(payload.region);
  if (!safeRegion) return { skipped: true };
  const token = await getFirebaseToken(user);
  if (!token) return { skipped: true };
  const code = cleanCode(payload.code || payload.shortCode || '');
  removeLocalJsonCache('regionFormSettings', safeRegion);
  if (code) removeLocalJsonCache('regionFormShare', code);
  return requestJson('/api/region-form/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      region: safeRegion,
      code,
      settings: sanitizeSettings(payload.settings || {}),
      updatedAtMs: Number(payload.updatedAtMs) || Date.now()
    })
  }).catch(error => {
    console.warn('[WKD] region form settings D1 publish skipped:', error);
    return { ok: false, skipped: true, error: error.message };
  });
}


export async function saveRegionRegistrationD1First(user, region, values = {}, settings = {}, options = {}) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-table-cache-disabled');
  const safeRegion = cleanRegion(region || values.region);
  if (!safeRegion) throw new Error('region-required');
  const cycleId = cleanText(settings?.currentCycleId || values?.cycleId || 'active', 80) || 'active';
  const token = await getFirebaseToken(user);
  const farmId = cleanText(values?.farmId || 'main', 80) || 'main';
  const publicKey = browserRegistrationKey(safeRegion, cycleId);
  const uid = cleanText(user?.uid || '', 120);
  const rowKey = uid ? `${uid}_${farmId}_${cycleId}` : `${publicKey}_${farmId}_${cycleId}`;
  const source = uid ? 'account-d1' : 'public-link-d1';
  const row = sanitizeTableRow({
    ...sanitizeRegistrationValues(values),
    id: rowKey,
    uid,
    publicKey: uid ? '' : publicKey,
    farmId,
    region: safeRegion,
    source,
    rowType: uid ? 'Заявка' : 'Заявка з посилання',
    updatedAtMs: Date.now()
  });
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  removeLocalTableCache('regionTableSnapshot', safeRegion);
  return requestJson('/api/region-table/registration', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      region: safeRegion,
      cycleId,
      publicLink: Boolean(!uid || options?.publicLink || options?.shareCode),
      shareCode: cleanCode(options?.shareCode || ''),
      settings: sanitizeSettings(settings),
      row,
      forceUpdate: Boolean(options?.forceUpdate)
    })
  }).then(result => { removeLocalTableCache('regionTableSnapshot', safeRegion); return { ...result, ...row, cycleId, region: safeRegion, d1First: true }; });
}

export async function mirrorRegionRegistration(user, region, row, settings = {}) {
  if (!isRegionTableCacheEnabled()) return { skipped: true };
  const safeRegion = cleanRegion(region || row?.region);
  if (!safeRegion) return { skipped: true };
  const token = await getFirebaseToken(user);
  if (!token) return { skipped: true };
  const cycleId = cleanText(settings?.currentCycleId || row?.cycleId || 'active', 80);
  const uid = cleanText(row?.uid || '', 120);
  const farmId = cleanText(row?.farmId || 'main', 80) || 'main';
  const cacheRowId = cleanText(row?.id || (uid ? `${uid}_${farmId}_${cycleId}` : ''), 180);
  return requestJson('/api/region-table/registration', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      region: safeRegion,
      cycleId,
      settings: sanitizeSettings(settings),
      row: sanitizeTableRow({ ...row, id: cacheRowId, farmId, region: safeRegion })
    })
  }).catch(error => {
    console.warn('[WKD] region table JSON mirror skipped:', error);
    return { ok: false, skipped: true, error: error.message };
  });
}

export async function publishRegionTableSnapshot(user, payload = {}) {
  if (!isRegionTableCacheEnabled()) return { skipped: true };
  const safeRegion = cleanRegion(payload.region);
  if (!safeRegion) return { skipped: true };
  const token = await getFirebaseToken(user);
  if (!token) return { skipped: true };
  const rows = (Array.isArray(payload.rows) ? payload.rows : [])
    .map(sanitizeTableRow)
    .filter(row => row.nickname)
    .slice(0, MAX_ROWS);
  removeLocalTableCache('regionTableSnapshot', safeRegion);
  return requestJson('/api/region-table/snapshot', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      region: safeRegion,
      cycleId: cleanText(payload.cycleId || payload.settings?.currentCycleId || 'active', 80),
      settings: sanitizeSettings(payload.settings || {}),
      rows
    })
  }).then(result => {
    if (result?.ok !== false) writeLocalTableCache('regionTableSnapshot', safeRegion, { region: safeRegion, settings: sanitizeSettings(payload.settings || {}), rows, version: Date.now() });
    return result;
  }).catch(error => {
    console.warn('[WKD] region table snapshot publish skipped:', error);
    return { ok: false, skipped: true, error: error.message };
  });
}

export async function publishRegionTableShare(user, payload = {}) {
  if (!isRegionTableCacheEnabled()) return { skipped: true };
  const safeRegion = cleanRegion(payload.region);
  const safeCode = cleanCode(payload.code);
  if (!safeRegion || !safeCode) return { skipped: true };
  const token = await getFirebaseToken(user);
  if (!token) return { skipped: true };
  const rows = (Array.isArray(payload.rows) ? payload.rows : [])
    .map(sanitizeTableRow)
    .filter(row => row.nickname)
    .slice(0, MAX_ROWS);
  removeLocalTableCache('regionTableShare', safeCode);
  return requestJson('/api/region-table/share', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      code: safeCode,
      region: safeRegion,
      cycleId: cleanText(payload.cycleId || payload.settings?.currentCycleId || 'active', 80),
      settings: sanitizeSettings(payload.settings || {}),
      rows,
      expiresAtMs: Number(payload.expiresAtMs) || 0
    })
  }).catch(error => {
    console.warn('[WKD] region table share publish skipped:', error);
    return { ok: false, skipped: true, error: error.message };
  });
}

function normalizeTableResponse(data = {}) {
  const table = data.table || data;
  return {
    profile: null,
    region: cleanRegion(table.region),
    settings: table.settings || {},
    rows: Array.isArray(table.rows) ? table.rows.map(sanitizeTableRow).filter(row => row.nickname) : [],
    version: Number(table.version) || 0,
    cached: true,
    source: 'cloudflare-d1-snapshot'
  };
}
