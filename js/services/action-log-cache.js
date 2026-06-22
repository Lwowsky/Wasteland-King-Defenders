import { regionTableCacheConfig } from '../config/region-table-cache.config.js';

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

function apiUrl(path = '') {
  const base = cleanText(regionTableCacheConfig?.apiBaseUrl || '', 240).replace(/\/+$/, '');
  const safePath = String(path || '').startsWith('/') ? String(path || '') : `/${path || ''}`;
  return base ? `${base}${safePath}` : safePath;
}

async function getFirebaseToken(user) {
  if (!user || typeof user.getIdToken !== 'function') return '';
  try {
    return await user.getIdToken(false);
  } catch {
    return '';
  }
}

export function isActionLogCacheEnabled() {
  return Boolean(regionTableCacheConfig?.enabled);
}

async function requestJson(path, user, options = {}) {
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const response = await fetch(apiUrl(path), {
    cache: 'no-store',
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
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
    const error = new Error(data?.error || `action-log-cache-${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data || {};
}

function sanitizeDetails(details = {}) {
  const safe = {};
  if (!details || typeof details !== 'object' || Array.isArray(details)) return safe;
  Object.entries(details).slice(0, 30).forEach(([key, value]) => {
    const safeKey = cleanText(key, 80).replace(/[^A-Za-z0-9_.:-]/g, '_');
    if (!safeKey) return;
    safe[safeKey] = value && typeof value === 'object' ? cleanText(JSON.stringify(value), 500) : cleanText(value, 500);
  });
  return safe;
}

function normalizeRow(row = {}) {
  return {
    id: cleanText(row.id || '', 120),
    region: cleanRegion(row.region),
    action: cleanText(row.action || '', 80),
    actionLabel: cleanText(row.actionLabel || '', 160),
    actorUid: cleanText(row.actorUid || '', 160),
    actorName: cleanText(row.actorName || '', 160),
    actorAlliance: cleanText(row.actorAlliance || '', 40).toUpperCase(),
    actorRole: cleanText(row.actorRole || '', 40).toLowerCase(),
    alliance: cleanText(row.alliance || row.actorAlliance || '', 40).toUpperCase(),
    targetUid: cleanText(row.targetUid || '', 160),
    targetName: cleanText(row.targetName || '', 160),
    summary: cleanText(row.summary || '', 500),
    details: sanitizeDetails(row.details || {}),
    createdAtMs: Number(row.createdAtMs) || Date.now()
  };
}

export async function createRegionActionLogD1(user, payload = {}) {
  if (!isActionLogCacheEnabled()) throw new Error('action-log-cache-disabled');
  const row = normalizeRow(payload);
  if (!row.region) throw new Error('region-required');
  return requestJson('/api/action-log', user, {
    method: 'POST',
    body: JSON.stringify({ ...row, actorAccess: payload.actorAccess || null })
  });
}

export async function listRegionActionLogsD1(user, region, { limitCount = 20, cursorMs = 0, alliance = '', actorAccess = null } = {}) {
  if (!isActionLogCacheEnabled()) throw new Error('action-log-cache-disabled');
  const safeRegion = cleanRegion(region);
  if (!safeRegion) throw new Error('region-required');
  const params = new URLSearchParams();
  params.set('region', safeRegion);
  params.set('limit', String(Math.max(1, Math.min(20, Number(limitCount) || 20))));
  if (Number(cursorMs) > 0) params.set('cursorMs', String(Number(cursorMs)));
  const safeAlliance = cleanText(alliance || '', 40).toUpperCase();
  if (safeAlliance) params.set('alliance', safeAlliance);
  if (actorAccess) params.set('actorAccess', JSON.stringify(actorAccess));
  const data = await requestJson(`/api/action-log?${params.toString()}`, user);
  return {
    ...data,
    rows: Array.isArray(data.rows) ? data.rows.map(normalizeRow) : []
  };
}

export async function deleteRegionActionLogD1(user, region, id = '') {
  throw new Error('action-log-immutable');
}


export async function deleteRegionActionLogsD1(user, region, ids = []) {
  throw new Error('action-log-immutable');
}


export async function clearRegionActionLogsD1(user, region, { olderThanMs = 0, limitCount = 500 } = {}) {
  throw new Error('action-log-immutable');
}
