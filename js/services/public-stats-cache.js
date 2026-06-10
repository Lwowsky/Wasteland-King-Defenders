import { regionTableCacheConfig } from '../config/region-table-cache.config.js';
import { trackCloudflareUsage } from './usage-tracker.js?v=132';

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

function isEnabled() {
  return Boolean(regionTableCacheConfig?.enabled);
}

async function getFirebaseToken(user) {
  if (!user || typeof user.getIdToken !== 'function') return '';
  try {
    return await user.getIdToken(false);
  } catch {
    return '';
  }
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
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error || `public-stats-cache-${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  const usage = data?.usage || {};
  trackCloudflareUsage({
    workerRequests: 1,
    d1RowsRead: Number(usage.d1RowsRead ?? usage.rowsRead ?? 0) || 0,
    d1RowsWritten: Number(usage.d1RowsWritten ?? usage.rowsWritten ?? (options.method && options.method !== 'GET' ? 1 : 0)) || 0
  });
  return data || {};
}

function stripUnsafeFields(player = {}) {
  if (!player || typeof player !== 'object') return null;
  const clone = typeof structuredClone === 'function' ? structuredClone(player) : JSON.parse(JSON.stringify(player));
  delete clone.email;
  delete clone.phone;
  delete clone.providerData;
  delete clone.photoURL;
  delete clone.displayName;
  return clone;
}

export async function mirrorPublicStatsPlayer(user, publicPlayer = {}) {
  if (!isEnabled()) return { skipped: true, reason: 'disabled' };
  const token = await getFirebaseToken(user);
  if (!token) return { skipped: true, reason: 'auth-token-required' };
  const uid = cleanText(publicPlayer?.uid || user?.uid || '', 180);
  if (!uid) return { skipped: true, reason: 'uid-required' };
  const safePlayer = stripUnsafeFields({ ...publicPlayer, uid });
  return requestJson('/api/public-stats/player', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ uid, player: safePlayer, active: publicPlayer?.profileComplete !== false })
  }).catch(error => {
    console.warn('[WKD] public stats D1 mirror skipped:', error?.message || error);
    return { ok: false, skipped: true, error: error?.message || String(error) };
  });
}
