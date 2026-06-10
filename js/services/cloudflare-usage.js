import { regionTableCacheConfig } from '../config/region-table-cache.config.js';
import { trackCloudflareUsage } from './usage-tracker.js?v=126';

function cleanText(value = '', max = 160) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
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

function numberValue(value = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

const REAL_USAGE_CACHE_KEY = 'wkd.cloudflareRealUsageCache.v126';

function readCache() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(REAL_USAGE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(REAL_USAGE_CACHE_KEY, JSON.stringify(value));
  } catch {}
}

function removeCache() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(REAL_USAGE_CACHE_KEY);
  } catch {}
}

function percent(used = 0, limit = 0) {
  const safeLimit = numberValue(limit);
  if (!safeLimit) return 0;
  return Math.max(0, Math.min(100, (numberValue(used) / safeLimit) * 100));
}

function usageRow(used = 0, limit = 0) {
  const safeUsed = numberValue(used);
  const safeLimit = numberValue(limit);
  return {
    used: safeUsed,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - safeUsed),
    percent: percent(safeUsed, safeLimit)
  };
}

function normalizeCloudflareUsage(data = {}) {
  const limits = data?.limits || {};
  const worker = data?.worker || {};
  const d1 = data?.d1 || {};
  return {
    ok: data?.ok !== false,
    real: Boolean(data?.real),
    source: cleanText(data?.source || 'cloudflare-graphql-analytics-api', 100),
    generatedAt: cleanText(data?.generatedAt || new Date().toISOString(), 80),
    cachedAt: cleanText(data?.cachedAt || '', 80),
    fromCache: Boolean(data?.fromCache),
    period: {
      timezone: cleanText(data?.period?.timezone || 'UTC', 40),
      start: cleanText(data?.period?.start || '', 80),
      end: cleanText(data?.period?.end || '', 80),
      dateStart: cleanText(data?.period?.dateStart || '', 40),
      dateEnd: cleanText(data?.period?.dateEnd || '', 40)
    },
    worker: {
      requests: usageRow(worker.requests, limits.workerRequestsPerDay || 100000),
      subrequests: numberValue(worker.subrequests),
      errors: numberValue(worker.errors),
      cpuTimeP50: numberValue(worker.cpuTimeP50),
      cpuTimeP99: numberValue(worker.cpuTimeP99),
      scriptName: cleanText(worker.scriptName || 'all-workers', 160),
      rows: numberValue(worker.rows)
    },
    d1: {
      rowsRead: usageRow(d1.rowsRead, limits.d1RowsReadPerDay || 5000000),
      rowsWritten: usageRow(d1.rowsWritten, limits.d1RowsWrittenPerDay || 100000),
      storageTotal: usageRow(d1.databaseSizeBytes, limits.d1StorageTotalBytes || 5 * 1024 * 1024 * 1024),
      storageMaxDatabase: usageRow(d1.maxDatabaseSizeBytes, limits.d1DatabaseSizeBytes || 500 * 1024 * 1024),
      readQueries: numberValue(d1.readQueries),
      writeQueries: numberValue(d1.writeQueries),
      databaseCount: numberValue(d1.databaseCount),
      databaseSizes: Array.isArray(d1.databaseSizes) ? d1.databaseSizes.slice(0, 20).map(item => ({
        databaseId: cleanText(item?.databaseId || '', 120),
        bytes: numberValue(item?.bytes)
      })) : [],
      rows: numberValue(d1.rows)
    },
    partialErrors: Array.isArray(data?.partialErrors) ? data.partialErrors.map(item => ({
      source: cleanText(item?.source || '', 80),
      error: cleanText(item?.error || '', 180)
    })).filter(item => item.error) : []
  };
}

export function getCachedCloudflareUsage() {
  const cached = readCache();
  if (!cached || cached.real !== true) return null;
  const normalized = normalizeCloudflareUsage({ ...cached, fromCache: true });
  return normalized.real ? normalized : null;
}

export function saveCachedCloudflareUsage(data) {
  const normalized = normalizeCloudflareUsage(data || {});
  if (!normalized.real) return normalized;
  const value = { ...normalized, fromCache: false, cachedAt: new Date().toISOString() };
  writeCache(value);
  return value;
}

export function clearCachedCloudflareUsage() {
  removeCache();
}

export async function fetchRealCloudflareUsage(user) {
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const response = await fetch(apiUrl('/api/admin/usage/cloudflare'), {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  trackCloudflareUsage({ workerRequests: 1, d1RowsRead: 0, d1RowsWritten: 0 });
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error || `cloudflare-usage-${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return saveCachedCloudflareUsage(data || {});
}
