import { regionTableCacheConfig } from '../config/region-table-cache.config.js';
import { trackCloudflareUsage } from './usage-tracker.js?v=135';

const MAX_ROWS = 1000;

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
    alliance: cleanText(values.alliance || '', 12).toUpperCase(),
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
    alliance: cleanText(row.alliance || '', 12).toUpperCase(),
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

function sanitizeSettings(settings = {}) {
  return {
    open: Boolean(settings.open),
    enabled: Boolean(settings.enabled),
    currentCycleId: cleanText(settings.currentCycleId || '', 80),
    closeAtMs: Number(settings.closeAtMs) || 0,
    eventStartAtMs: Number(settings.eventStartAtMs || settings.startAtMs) || 0,
    openedAtMs: Number(settings.openedAtMs || settings.startedAtMs) || 0,
    openedByName: cleanText(settings.openedByName || settings.startedByName || '', 120),
    openedByEmail: cleanText(settings.openedByEmail || settings.startedByEmail || '', 160),
    openedByUid: cleanText(settings.openedByUid || settings.startedByUid || '', 160),
    shifts: Array.isArray(settings.shifts) ? settings.shifts.map(item => cleanText(item, 40)).filter(Boolean).slice(0, 12) : [],
    customShifts: Array.isArray(settings.customShifts) ? settings.customShifts.slice(0, 20) : [],
    customTroopTypes: Array.isArray(settings.customTroopTypes) ? settings.customTroopTypes.slice(0, 20) : []
  };
}

export async function readRegionTableSnapshot(user, region) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-table-cache-disabled');
  const safeRegion = cleanRegion(region);
  if (!safeRegion) throw new Error('region-required');
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const data = await requestJson(`/api/region-table?region=${encodeURIComponent(safeRegion)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return normalizeTableResponse(data);
}

export async function readRegionTableShare(code) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-table-cache-disabled');
  const safeCode = cleanCode(code);
  if (!safeCode) throw new Error('share-code-required');
  const data = await requestJson(`/api/region-table/share/${encodeURIComponent(safeCode)}`);
  return normalizeTableResponse(data);
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
  }).then(result => ({ ...result, ...row, cycleId, region: safeRegion, d1First: true }));
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
  return requestJson('/api/region-table/snapshot', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      region: safeRegion,
      cycleId: cleanText(payload.cycleId || payload.settings?.currentCycleId || 'active', 80),
      settings: sanitizeSettings(payload.settings || {}),
      rows
    })
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
