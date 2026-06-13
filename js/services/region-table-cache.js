import { regionTableCacheConfig } from '../config/region-table-cache.config.js';
import { trackCloudflareUsage } from './usage-tracker.js?v=194';

const MAX_ROWS = 2000;
const REGION_TABLE_CACHE_TTL_MS = 30 * 60 * 1000;
const SHARE_TABLE_CACHE_TTL_MS = 30 * 60 * 1000;
const REGION_FORM_SETTINGS_TTL_MS = 5 * 60 * 1000;
const TOWER_PLAN_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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
  return `wkd.${kind}.d1.v194.${cleanText(id, 160)}`;
}

function readLocalTableCache(kind, id, ttlMs) {
  try {
    const raw = localStorage.getItem(localCacheKey(kind, id));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || (Date.now() - Number(data.savedAtMs || 0)) > ttlMs) return null;
    if (!data.table) return null;
    const expectedRegion = kind === 'regionTableSnapshot' ? id : '';
    const normalized = normalizeTableResponse({ table: data.table, cached: true, source: 'browser-d1-cache' }, expectedRegion);
    if (!normalized || (expectedRegion && (!normalized.region || normalized.region !== cleanRegion(expectedRegion)))) {
      removeLocalTableCache(kind, id);
      return null;
    }
    return normalized;
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

function sanitizeAllianceItem(item = {}, region = '') {
  const tag = cleanText(item?.tag || item?.id || '', 12);
  if (!tag) return null;
  const hueNumber = Number(item?.colorHue);
  const colorHue = Number.isFinite(hueNumber) ? ((Math.round(hueNumber) % 360) + 360) % 360 : null;
  return {
    id: tag,
    tag,
    region: cleanRegion(region || item?.region),
    name: cleanText(item?.name || tag, 80),
    note: cleanText(item?.note || '', 160),
    colorHue,
    colorMode: colorHue === null ? 'auto' : cleanText(item?.colorMode || 'manual', 40),
    updatedAtMs: Number(item?.updatedAtMs || item?.colorUpdatedAtMs || Date.now()) || Date.now()
  };
}

function sanitizeAllianceList(items = [], region = '') {
  const seen = new Map();
  (Array.isArray(items) ? items : []).forEach(item => {
    const clean = sanitizeAllianceItem(item, region);
    if (!clean?.tag) return;
    seen.set(clean.tag, { ...(seen.get(clean.tag) || {}), ...clean });
  });
  return [...seen.values()].sort((a, b) => String(a.tag || '').localeCompare(String(b.tag || ''), 'uk'));
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
  const paged = Boolean(options?.page || options?.pageSize || options?.search || options?.alliance || options?.troop || options?.tier || options?.shift || options?.sortField);
  if (!paged && !options?.force) {
    const cached = readLocalTableCache('regionTableSnapshot', safeRegion, Number(options?.ttlMs) || REGION_TABLE_CACHE_TTL_MS);
    if (cached) return cached;
  }
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const params = new URLSearchParams();
  params.set('region', safeRegion);
  if (paged) {
    params.set('page', String(Math.max(1, Number(options?.page) || 1)));
    params.set('pageSize', String(Math.max(10, Math.min(100, Number(options?.pageSize) || 20))));
    if (options?.search) params.set('search', cleanText(options.search, 120));
    if (options?.alliance) params.set('alliance', cleanText(options.alliance, 12));
    if (options?.troop && options.troop !== 'all') params.set('troop', cleanText(options.troop, 40));
    if (options?.tier && options.tier !== 'all') params.set('tier', cleanText(options.tier, 12).toUpperCase());
    if (options?.shift && options.shift !== 'all') params.set('shift', cleanText(options.shift, 40));
    if (options?.sortField) params.set('sort', cleanText(options.sortField, 40));
    if (options?.sortDir) params.set('dir', String(options.sortDir).toLowerCase() === 'desc' || Number(options.sortDir) < 0 ? 'desc' : 'asc');
  }
  const data = await requestJson(`/api/region-table?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const normalized = normalizeTableResponse(data, safeRegion);
  if (!normalized || normalized.region !== safeRegion) {
    removeLocalTableCache('regionTableSnapshot', safeRegion);
    throw new Error('region-table-cache-region-mismatch');
  }
  if (paged) {
    return {
      ...normalized,
      page: Math.max(1, Number(data.page) || Number(options?.page) || 1),
      pageSize: Math.max(1, Number(data.pageSize) || Number(options?.pageSize) || normalized.rows.length || 20),
      totalRows: Math.max(0, Number(data.totalRows) || normalized.rows.length || 0),
      totalPages: Math.max(1, Number(data.totalPages) || 1),
      filters: data.filters || {}
    };
  }
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


function normalizeCycleArchiveItem(item = {}) {
  return {
    region: cleanRegion(item.region || ''),
    cycleId: cleanText(item.cycleId || item.cycle_id || 'active', 90) || 'active',
    status: cleanText(item.status || '', 30),
    title: cleanText(item.title || '', 160),
    eventStartAtMs: Number(item.eventStartAtMs || item.event_start_at_ms || 0) || 0,
    rowsCount: Number(item.rowsCount || item.rows_count || 0) || 0,
    createdAtMs: Number(item.createdAtMs || item.created_at_ms || 0) || 0,
    archivedAtMs: Number(item.archivedAtMs || item.archived_at_ms || 0) || 0,
    updatedAtMs: Number(item.updatedAtMs || item.updated_at_ms || 0) || 0,
    openedByName: cleanText(item.openedByName || item.opened_by_name || '', 160)
  };
}

function normalizeCycleArchiveList(data = {}, expectedRegion = '') {
  const region = cleanRegion(data.region || expectedRegion);
  const cycles = (Array.isArray(data.cycles) ? data.cycles : [])
    .map(normalizeCycleArchiveItem)
    .filter(item => item.region === region && item.cycleId);
  return {
    ok: data.ok !== false,
    region,
    activeCycleId: cleanText(data.activeCycleId || data.active_cycle_id || '', 90),
    cycles,
    source: data.source || 'cloudflare-d1-cycle-archive',
    cached: true
  };
}

export async function listRegionCycleArchiveD1(user, region, options = {}) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-cycle-archive-disabled');
  const safeRegion = cleanRegion(region);
  if (!safeRegion) throw new Error('region-required');
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const params = new URLSearchParams();
  params.set('region', safeRegion);
  if (options?.includeActive) params.set('includeActive', '1');
  const data = await requestJson(`/api/region-table/archive?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return normalizeCycleArchiveList(data, safeRegion);
}

export async function readRegionCycleArchiveD1(user, region, cycleId, options = {}) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-cycle-archive-disabled');
  const safeRegion = cleanRegion(region);
  const safeCycleId = cleanText(cycleId || '', 90);
  if (!safeRegion || !safeCycleId) throw new Error('region-cycle-required');
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const params = new URLSearchParams();
  params.set('region', safeRegion);
  params.set('page', String(Math.max(1, Number(options?.page) || 1)));
  params.set('pageSize', String(Math.max(5, Math.min(100, Number(options?.pageSize) || 20))));
  if (options?.search) params.set('search', cleanText(options.search, 120));
  const data = await requestJson(`/api/region-table/archive/${encodeURIComponent(safeCycleId)}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const table = normalizeTableResponse(data, safeRegion);
  return {
    ...table,
    cycle: normalizeCycleArchiveItem(data.cycle || { region: safeRegion, cycleId: safeCycleId }),
    page: Math.max(1, Number(data.page) || 1),
    pageSize: Math.max(1, Number(data.pageSize) || table.rows.length || 20),
    totalRows: Math.max(0, Number(data.totalRows) || table.rows.length || 0),
    totalPages: Math.max(1, Number(data.totalPages) || 1),
    search: cleanText(data.search || options?.search || '', 120),
    source: data.source || 'cloudflare-d1-cycle-archive'
  };
}

export async function readFullRegionCycleArchiveD1(user, region, cycleId, options = {}) {
  const pageSize = Math.max(20, Math.min(100, Number(options?.pageSize) || 100));
  let page = 1;
  let first = null;
  let rows = [];
  do {
    const result = await readRegionCycleArchiveD1(user, region, cycleId, { page, pageSize, search: options?.search || '' });
    if (!first) first = result;
    rows = rows.concat(Array.isArray(result.rows) ? result.rows : []);
    if (page >= Number(result.totalPages || 1)) break;
    page += 1;
  } while (page <= 200);
  return {
    ...(first || {}),
    rows: rows.slice(0, MAX_ROWS),
    page: 1,
    pageSize: rows.length,
    totalRows: Number(first?.totalRows || rows.length) || rows.length,
    totalPages: 1,
    source: first?.source || 'cloudflare-d1-cycle-archive-full'
  };
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

function sanitizeTowerPlanPayload(plan = {}) {
  const safePlan = plan && typeof plan === 'object' && !Array.isArray(plan) ? plan : {};
  const json = JSON.stringify(safePlan);
  if (json.length > 900000) throw new Error('tower-plan-too-large');
  return JSON.parse(json);
}

function normalizeTowerPlanResponse(data = {}) {
  const item = data.towerPlan || data.plan || data;
  return {
    ok: data.ok !== false,
    region: cleanRegion(item.region || data.region),
    cycleId: cleanText(item.cycleId || item.cycle_id || data.cycleId || 'active', 80) || 'active',
    plan: sanitizeTowerPlanPayload(item.plan || {}),
    updatedAtMs: Number(item.updatedAtMs || item.updated_at_ms || data.updatedAtMs || 0) || 0,
    updatedBy: cleanText(item.updatedBy || item.updated_by || '', 160),
    updatedByName: cleanText(item.updatedByName || item.updated_by_name || '', 160),
    cached: true,
    source: data.source || 'cloudflare-d1-tower-plan'
  };
}

export async function readRegionTowerPlanSnapshot(user, region, options = {}) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-tower-plan-cache-disabled');
  const safeRegion = cleanRegion(region);
  if (!safeRegion) throw new Error('region-required');
  if (!options?.force) {
    const cached = readLocalJsonCache('regionTowerPlan', safeRegion, Number(options?.ttlMs) || TOWER_PLAN_CACHE_TTL_MS);
    if (cached?.plan) return cached;
  }
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const data = await requestJson(`/api/tower-plan?region=${encodeURIComponent(safeRegion)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const normalized = normalizeTowerPlanResponse(data);
  writeLocalJsonCache('regionTowerPlan', safeRegion, normalized);
  return normalized;
}

export async function publishRegionTowerPlanSnapshot(user, payload = {}) {
  if (!isRegionTableCacheEnabled()) return { skipped: true };
  const safeRegion = cleanRegion(payload.region);
  if (!safeRegion) return { skipped: true };
  const token = await getFirebaseToken(user);
  if (!token) return { skipped: true };
  const body = {
    region: safeRegion,
    cycleId: cleanText(payload.cycleId || payload.currentCycleId || 'active', 80) || 'active',
    plan: sanitizeTowerPlanPayload(payload.plan || {}),
    updatedAtMs: Number(payload.updatedAtMs) || Date.now(),
    updatedByName: cleanText(payload.updatedByName || '', 160)
  };
  removeLocalJsonCache('regionTowerPlan', safeRegion);
  return requestJson('/api/tower-plan', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  }).then(result => {
    if (result?.ok !== false) writeLocalJsonCache('regionTowerPlan', safeRegion, { ...body, ok: true, cached: true, source: 'cloudflare-d1-tower-plan' });
    return result;
  }).catch(error => {
    console.warn('[WKD] tower plan D1 publish skipped:', error);
    return { ok: false, skipped: true, error: error.message };
  });
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



export async function readMyRegionRegistrationD1(user, region, farmId = 'main', options = {}) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-table-cache-disabled');
  const safeRegion = cleanRegion(region);
  if (!safeRegion) throw new Error('region-required');
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const params = new URLSearchParams();
  params.set('region', safeRegion);
  params.set('farmId', cleanText(farmId || 'main', 80) || 'main');
  if (options?.cycleId) params.set('cycleId', cleanText(options.cycleId, 80));
  const data = await requestJson(`/api/region-table/my-registration?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data?.registration || null;
}

export async function saveRegionRegistrationD1First(user, region, values = {}, settings = {}, options = {}) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-table-cache-disabled');
  const safeRegion = cleanRegion(region || values.region);
  if (!safeRegion) throw new Error('region-required');
  const cycleId = cleanText(settings?.currentCycleId || values?.cycleId || '', 80);
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


function cleanDefinedRowPatch(values = {}) {
  const out = {};
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value !== undefined) out[key] = value;
  });
  return out;
}

function editValuesToD1Row(registrationId = '', values = {}) {
  const row = cleanDefinedRowPatch({
    id: cleanText(registrationId, 180),
    nickname: values.name ?? values.nickname,
    alliance: values.alliance,
    troopType: values.troopType ?? values.troopLabel ?? values.role,
    troopLabel: values.troopLabel,
    tier: values.tier,
    lairLevel: values.lairLevel ?? values.denLevel,
    captureRegion: values.lair ?? values.captureRegion,
    marchSize: values.march ?? values.marchSize,
    rallySize: values.rally ?? values.rallySize,
    captainReady: values.captain ?? values.captainReady,
    shift: values.shift ?? values.shiftLabel,
    shiftLabel: values.shiftLabel,
    comment: values.comment,
    extraEnabled: values.extraEnabled,
    extraSquads: values.extraSquads,
    extraTroopType: values.extraTroopType,
    extraTier: values.extraTier,
    customFields: values.customFields,
    updatedAtMs: Date.now()
  });
  Object.keys(row).forEach(key => {
    if (row[key] === null || row[key] === '') delete row[key];
  });
  row.id = cleanText(registrationId || values.id || '', 180);
  return row;
}

export async function updateRegionTableRowD1(user, region, registrationId, values = {}, settings = {}, options = {}) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-table-cache-disabled');
  const safeRegion = cleanRegion(region || values.region);
  const id = cleanText(registrationId || values.id || '', 180);
  if (!safeRegion || !id) throw new Error('region-row-update-required');
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const row = editValuesToD1Row(id, values || {});
  removeLocalTableCache('regionTableSnapshot', safeRegion);
  const explicitCycleId = cleanText(settings?.currentCycleId || values?.cycleId || '', 80);
  const payload = {
    region: safeRegion,
    settings: sanitizeSettings(settings || {}),
    row,
    forceUpdate: Boolean(options?.forceUpdate),
    updateOnly: true
  };
  if (explicitCycleId) payload.cycleId = explicitCycleId;
  const data = await requestJson('/api/region-table/registration', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  return { ok: data.ok !== false, region: safeRegion, id, row: data.row || null, ...data, d1First: true };
}


export async function deleteRegionTableRowsD1(user, region, ids = []) {
  if (!isRegionTableCacheEnabled()) return { skipped: true };
  const safeRegion = cleanRegion(region);
  const cleanIds = (Array.isArray(ids) ? ids : [ids]).map(id => cleanText(id, 180)).filter(Boolean).slice(0, 500);
  if (!safeRegion || !cleanIds.length) return { skipped: true };
  const token = await getFirebaseToken(user);
  if (!token) return { skipped: true };
  removeLocalTableCache('regionTableSnapshot', safeRegion);
  return requestJson('/api/region-table/delete-rows', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ region: safeRegion, ids: cleanIds })
  }).catch(error => {
    console.warn('[WKD] region table D1 row delete skipped:', error);
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
    .map(row => sanitizeTableRow({ ...row, region: safeRegion }))
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
    .map(row => sanitizeTableRow({ ...row, region: safeRegion }))
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

function normalizeTableResponse(data = {}, expectedRegion = '') {
  const table = data.table || data;
  const tableRegion = cleanRegion(table.region || expectedRegion);
  const expected = cleanRegion(expectedRegion || tableRegion);
  if (expected && tableRegion && tableRegion !== expected) return null;
  const rows = Array.isArray(table.rows)
    ? table.rows
        .map(raw => {
          const rowRegion = cleanRegion(raw?.region || '');
          if (rowRegion && tableRegion && rowRegion !== tableRegion) return null;
          return sanitizeTableRow({ ...raw, region: tableRegion || rowRegion });
        })
        .filter(row => row?.nickname)
    : [];
  return {
    profile: null,
    region: tableRegion,
    settings: table.settings || {},
    rows,
    version: Number(table.version) || 0,
    cached: true,
    source: data.source || 'cloudflare-d1-snapshot'
  };
}


export async function readRegionAlliancesD1(user, region, options = {}) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-table-cache-disabled');
  const safeRegion = cleanRegion(region);
  if (!safeRegion) throw new Error('region-required');
  if (!options?.force) {
    const cached = readLocalJsonCache('regionAlliances', safeRegion, Number(options?.ttlMs) || REGION_FORM_SETTINGS_TTL_MS);
    if (Array.isArray(cached?.items)) return { ...cached, cached: true, source: cached.source || 'browser-d1-cache' };
  }
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const data = await requestJson(`/api/region-alliances?region=${encodeURIComponent(safeRegion)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const items = sanitizeAllianceList(data.items || data.alliances || [], safeRegion);
  const result = { ok: data.ok !== false, region: safeRegion, items, version: Number(data.version || data.updatedAtMs || Date.now()) || Date.now(), source: data.source || 'cloudflare-d1-region-alliances' };
  writeLocalJsonCache('regionAlliances', safeRegion, result);
  return result;
}

export async function saveRegionAllianceD1(user, region, values = {}) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-table-cache-disabled');
  const safeRegion = cleanRegion(region);
  if (!safeRegion) throw new Error('region-required');
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const item = sanitizeAllianceItem(values, safeRegion);
  if (!item?.tag) throw new Error('alliance-tag-required');
  removeLocalJsonCache('regionAlliances', safeRegion);
  const data = await requestJson('/api/region-alliances', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ region: safeRegion, alliance: item })
  });
  const clean = sanitizeAllianceItem(data.item || item, safeRegion);
  return { ok: data.ok !== false, region: safeRegion, item: clean || item, source: data.source || 'cloudflare-d1-region-alliances' };
}

export async function deleteRegionAllianceD1(user, region, tagValue = '') {
  if (!isRegionTableCacheEnabled()) throw new Error('region-table-cache-disabled');
  const safeRegion = cleanRegion(region);
  const tag = cleanText(tagValue, 12);
  if (!safeRegion || !tag) throw new Error('alliance-tag-required');
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  removeLocalJsonCache('regionAlliances', safeRegion);
  return requestJson('/api/region-alliances', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ region: safeRegion, tag })
  });
}

export async function readLocalImportRegionLock(user, region) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-table-cache-disabled');
  const safeRegion = cleanRegion(region);
  if (!safeRegion) throw new Error('region-required');
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const data = await requestJson(`/api/region-table/import-lock?region=${encodeURIComponent(safeRegion)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data?.lock || data || {};
}

export async function commitLocalImportRegionLock(user, region, payload = {}) {
  if (!isRegionTableCacheEnabled()) throw new Error('region-table-cache-disabled');
  const safeRegion = cleanRegion(region);
  if (!safeRegion) throw new Error('region-required');
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  return requestJson('/api/region-table/import-lock', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      region: safeRegion,
      mode: cleanText(payload.mode || '', 40),
      rowsCount: numberValue(payload.rowsCount || payload.count || 0),
      actorName: cleanText(payload.actorName || '', 120)
    })
  });
}
