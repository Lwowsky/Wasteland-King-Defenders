import { regionTableCacheConfig } from '../config/region-table-cache.config.js';
import { trackCloudflareUsage } from './usage-tracker.js?v=138';

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
    retentionDays: Math.max(1, Number(data.retentionDays) || 60),
    found: Math.max(0, Number(data.found) || 0),
    deleted: Math.max(0, Number(data.deleted) || 0),
    scanned: Math.max(0, Number(data.scanned) || 0),
    cycles: Math.max(0, Number(data.cycles) || 0),
    shares: Math.max(0, Number(data.shares) || 0),
    campaigns: Math.max(0, Number(data.campaigns) || 0),
    hasMore: Boolean(data.hasMore),
    source: cleanText(data.source || 'cloudflare-d1-cleanup', 80)
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
    retentionDays: Math.max(1, Number(retentionDays) || 60),
    limitCount: Math.max(1, Math.min(500, Number(maxScan) || 500))
  });
}

export async function cleanupD1Archives(user, { scope = 'all', region = '', retentionDays = 60, maxDeletes = 500 } = {}) {
  return requestJson('/api/d1-cleanup/clear', user, {
    scope: cleanText(scope || 'all', 40),
    region: cleanRegion(region),
    retentionDays: Math.max(1, Number(retentionDays) || 60),
    limitCount: Math.max(1, Math.min(500, Number(maxDeletes) || 500))
  });
}
