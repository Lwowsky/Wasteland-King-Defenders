import { regionTableCacheConfig } from '../config/region-table-cache.config.js';

function cleanText(value = '', max = 180) {
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

const REAL_FIREBASE_CACHE_KEY = 'wkd.firebaseRealUsageCache.v128';

function readCache() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(REAL_FIREBASE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(REAL_FIREBASE_CACHE_KEY, JSON.stringify(value));
  } catch {}
}

function removeCache() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(REAL_FIREBASE_CACHE_KEY);
  } catch {}
}

function usageRow(used = 0, limit = 0) {
  const safeUsed = numberValue(used);
  const safeLimit = numberValue(limit);
  return {
    used: safeUsed,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - safeUsed),
    percent: safeLimit ? Math.max(0, Math.min(100, (safeUsed / safeLimit) * 100)) : 0
  };
}

function normalizeFirebaseUsage(data = {}) {
  const limits = data?.limits || {};
  const firestore = data?.firestore || {};
  const auth = data?.auth || {};
  return {
    ok: data?.ok !== false,
    real: Boolean(data?.real),
    source: cleanText(data?.source || 'google-cloud-monitoring-api', 120),
    generatedAt: cleanText(data?.generatedAt || new Date().toISOString(), 80),
    cachedAt: cleanText(data?.cachedAt || '', 80),
    fromCache: Boolean(data?.fromCache),
    period: {
      timezone: cleanText(data?.period?.timezone || 'America/Los_Angeles', 80),
      start: cleanText(data?.period?.start || '', 80),
      end: cleanText(data?.period?.end || '', 80)
    },
    firestore: {
      reads: usageRow(firestore.reads, limits.firestoreReadsPerDay || 50000),
      writes: usageRow(firestore.writes, limits.firestoreWritesPerDay || 20000),
      deletes: usageRow(firestore.deletes, limits.firestoreDeletesPerDay || 20000),
      storage: usageRow(firestore.storageBytes, limits.firestoreStorageBytes || 1024 * 1024 * 1024),
      activeConnections: numberValue(firestore.activeConnections),
      snapshotListeners: numberValue(firestore.snapshotListeners),
      deniedRules: numberValue(firestore.deniedRules),
      rows: numberValue(firestore.rows)
    },
    auth: {
      dailyActiveUsers: usageRow(auth.dailyActiveUsers, limits.authDailyActiveUsers || 3000),
      source: cleanText(auth.source || 'limit-reference-only', 100)
    },
    partialErrors: Array.isArray(data?.partialErrors) ? data.partialErrors.map(item => ({
      source: cleanText(item?.source || '', 80),
      error: cleanText(item?.error || '', 180)
    })).filter(item => item.error) : []
  };
}

export function getCachedFirebaseUsage() {
  const cached = readCache();
  if (!cached || cached.real !== true) return null;
  const normalized = normalizeFirebaseUsage({ ...cached, fromCache: true });
  return normalized.real ? normalized : null;
}

export function saveCachedFirebaseUsage(data) {
  const normalized = normalizeFirebaseUsage(data || {});
  if (!normalized.real) return normalized;
  const value = { ...normalized, fromCache: false, cachedAt: new Date().toISOString() };
  writeCache(value);
  return value;
}

export function clearCachedFirebaseUsage() {
  removeCache();
}

export async function fetchRealFirebaseUsage(user) {
  const token = await getFirebaseToken(user);
  if (!token) throw new Error('auth-token-required');
  const response = await fetch(apiUrl('/api/admin/usage/firebase'), {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error || `firebase-usage-${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return saveCachedFirebaseUsage(data || {});
}
