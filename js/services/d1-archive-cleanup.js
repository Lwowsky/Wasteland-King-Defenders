import { regionTableCacheConfig } from '../config/region-table-cache.config.js';
import { trackCloudflareUsage } from './usage-tracker.js?v=077';

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
  try { return await user.getIdToken(false); } catch { return ''; }
}

function normalizeResult(data = {}) {
  return {
    ok: data.ok !== false,
    scope: cleanText(data.scope || 'all', 40),
    region: cleanRegion(data.region || ''),
    retentionDays: Number.isFinite(Number(data.retentionDays)) ? Math.max(0, Number(data.retentionDays)) : 60,
    found: Math.max(0, Number(data.found) || 0),
    deleted: Math.max(0, Number(data.deleted) || 0),
    scanned: Math.max(0, Number(data.scanned) || 0),
    cycles: Math.max(0, Number(data.cycles) || 0),
    shares: Math.max(0, Number(data.shares) || 0),
    finalPlans: Math.max(0, Number(data.finalPlans) || 0),
    campaigns: Math.max(0, Number(data.campaigns) || 0),
    messages: Math.max(0, Number(data.messages) || 0),
    logs: Math.max(0, Number(data.logs) || 0),
    hasMore: Boolean(data.hasMore),
    source: cleanText(data.source || 'cloudflare-d1-cleanup', 80)
  };
}


function normalizeInspectResult(data = {}) {
  const items = Array.isArray(data.items) ? data.items.map(item => ({
    key: cleanText(item.key || '', 80),
    rows: Math.max(0, Number(item.rows) || 0),
    bytes: Math.max(0, Number(item.bytes) || 0),
    cleanup: cleanText(item.cleanup || '', 40),
    active: Boolean(item.active)
  })).filter(item => item.key) : [];
  return {
    ok: data.ok !== false,
    region: cleanRegion(data.region || ''),
    totalRows: Math.max(0, Number(data.totalRows) || items.reduce((sum, item) => sum + item.rows, 0)),
    totalBytes: Math.max(0, Number(data.totalBytes) || items.reduce((sum, item) => sum + item.bytes, 0)),
    items,
    source: cleanText(data.source || 'cloudflare-d1-storage-inspect', 80)
  };
}

async function requestJson(path, user, payload = {}) {
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload || {})
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error || `d1-cleanup-${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  const usage = data?.usage || {};
  trackCloudflareUsage({
    workerRequests: 1,
    d1RowsRead: Number(usage.d1RowsRead ?? usage.rowsRead ?? data?.scanned ?? data?.found ?? 0) || 0,
    d1RowsWritten: Number(usage.d1RowsWritten ?? usage.rowsWritten ?? data?.deleted ?? 0) || 0
  });
  return normalizeResult(data || {});
}

export async function scanD1Archives(user, { scope = 'all', region = '', retentionDays = 60, maxScan = 500 } = {}) {
  return requestJson('/api/d1-cleanup/scan', user, {
    scope: cleanText(scope || 'all', 40),
    region: cleanRegion(region),
    retentionDays: Number.isFinite(Number(retentionDays)) ? Math.max(0, Number(retentionDays)) : 60,
    limitCount: Math.max(1, Math.min(500, Number(maxScan) || 500))
  });
}

export async function cleanupD1Archives(user, { scope = 'all', region = '', retentionDays = 60, maxDeletes = 500 } = {}) {
  return requestJson('/api/d1-cleanup/clear', user, {
    scope: cleanText(scope || 'all', 40),
    region: cleanRegion(region),
    retentionDays: Number.isFinite(Number(retentionDays)) ? Math.max(0, Number(retentionDays)) : 60,
    limitCount: Math.max(1, Math.min(500, Number(maxDeletes) || 500))
  });
}

async function requestInspectJson(path, user, payload = {}) {
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload || {})
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error || `d1-inspect-${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  const itemsCount = Array.isArray(data?.items) ? data.items.length : 0;
  trackCloudflareUsage({ workerRequests: 1, d1RowsRead: itemsCount, d1RowsWritten: 0 });
  return normalizeInspectResult(data || {});
}


function normalizeSecretLinks(data = {}) {
  const normalizeItem = item => ({
    type: cleanText(item?.type || '', 40),
    code: cleanText(item?.code || '', 160),
    region: cleanRegion(item?.region || ''),
    cycleId: cleanText(item?.cycleId || item?.cycle_id || '', 90),
    active: Boolean(item?.active),
    revoked: Boolean(item?.revoked),
    expired: Boolean(item?.expired),
    createdAtMs: Math.max(0, Number(item?.createdAtMs || item?.created_at_ms || 0) || 0),
    updatedAtMs: Math.max(0, Number(item?.updatedAtMs || item?.updated_at_ms || 0) || 0),
    expiresAtMs: Math.max(0, Number(item?.expiresAtMs || item?.expires_at_ms || 0) || 0),
    shortUrl: cleanText(item?.shortUrl || '', 260),
    publicUrl: cleanText(item?.publicUrl || '', 260)
  });
  const links = Array.isArray(data.links) ? data.links.map(normalizeItem).filter(item => item.type && item.code) : [];
  return {
    ok: data.ok !== false,
    region: cleanRegion(data.region || ''),
    activeCycleId: cleanText(data.activeCycleId || data.active_cycle_id || '', 90),
    links,
    counts: {
      active: Math.max(0, Number(data?.counts?.active || 0) || 0),
      expired: Math.max(0, Number(data?.counts?.expired || 0) || 0),
      revoked: Math.max(0, Number(data?.counts?.revoked || 0) || 0),
      total: Math.max(0, Number(data?.counts?.total || links.length) || 0)
    },
    usage: data.usage || {},
    source: cleanText(data.source || 'cloudflare-d1-secret-links', 80)
  };
}

async function requestSecretJson(path, user, payload = {}) {
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload || {})
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error || `d1-secret-links-${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  const usage = data?.usage || {};
  trackCloudflareUsage({
    workerRequests: 1,
    d1RowsRead: Number(usage.d1RowsRead ?? usage.rowsRead ?? 0) || 0,
    d1RowsWritten: Number(usage.d1RowsWritten ?? usage.rowsWritten ?? 0) || 0
  });
  return normalizeSecretLinks(data || {});
}

export async function inspectSecretLinks(user, { region = '' } = {}) {
  return requestSecretJson('/api/secret-links/inspect', user, { region: cleanRegion(region) });
}

export async function rotateSecretLinks(user, { region = '', scope = 'all' } = {}) {
  return requestSecretJson('/api/secret-links/rotate', user, { region: cleanRegion(region), scope: cleanText(scope || 'all', 40) });
}

export async function inspectD1Storage(user, { region = '' } = {}) {
  return requestInspectJson('/api/d1-cleanup/inspect', user, { region: cleanRegion(region) });
}

