import { regionTableCacheConfig } from '../config/region-table-cache.config.js';
import { trackCloudflareUsage } from './usage-tracker.js?v=190';

const FINAL_PLAN_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cleanText(value = '', max = 120) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanCode(value = '') {
  return cleanText(value, 160).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 140);
}

function cleanRegion(value = '') {
  return cleanText(value, 20).replace(/[^0-9]/g, '').slice(0, 8);
}

function cleanCycleId(value = '') {
  return cleanText(value || 'active', 90).replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 90) || 'active';
}

function apiUrl(path = '') {
  const base = cleanText(regionTableCacheConfig?.apiBaseUrl || '', 240).replace(/\/+$/, '');
  const safePath = String(path || '').startsWith('/') ? String(path || '') : `/${path || ''}`;
  return base ? `${base}${safePath}` : safePath;
}

export function isFinalPlanCacheEnabled() {
  return Boolean(regionTableCacheConfig?.enabled);
}

async function getFirebaseToken(user) {
  if (!user || typeof user.getIdToken !== 'function') return '';
  try { return await user.getIdToken(false); }
  catch { return ''; }
}

function localKey(code = '') {
  return `wkd.finalPlan.d1.v164.${cleanCode(code)}`;
}

function normalizePlan(data = {}) {
  const plan = data.plan || data;
  return {
    code: cleanCode(plan.code || ''),
    region: cleanRegion(plan.region || ''),
    cycleId: cleanCycleId(plan.cycleId || plan.cycle_id || 'active'),
    title: cleanText(plan.title || 'Final plan', 120),
    shift: cleanText(plan.shift || '', 40),
    html: String(plan.html || '').slice(0, 700000),
    text: String(plan.text || '').slice(0, 50000),
    updatedAtMs: Number(plan.updatedAtMs || plan.updated_at_ms || 0) || 0,
    updatedBy: cleanText(plan.updatedBy || plan.updated_by || '', 160),
    updatedByName: cleanText(plan.updatedByName || plan.updated_by_name || '', 160),
    cached: true,
    source: 'cloudflare-d1-final-plan'
  };
}

function readLocal(code = '', ttlMs = FINAL_PLAN_CACHE_TTL_MS) {
  try {
    const raw = localStorage.getItem(localKey(code));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.plan) return null;
    if (Date.now() - Number(data.savedAtMs || 0) > ttlMs) return null;
    return normalizePlan({ plan: data.plan });
  } catch {
    return null;
  }
}

function writeLocal(code = '', plan = {}) {
  try {
    const safeCode = cleanCode(code || plan.code || '');
    if (!safeCode) return;
    localStorage.setItem(localKey(safeCode), JSON.stringify({ savedAtMs: Date.now(), plan: normalizePlan({ plan }) }));
  } catch {}
}

function removeLocal(code = '') {
  try { localStorage.removeItem(localKey(code)); } catch {}
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
    const error = new Error(data?.error || `final-plan-cache-${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  const usage = data?.usage || {};
  trackCloudflareUsage({
    workerRequests: 1,
    d1RowsRead: Number(usage.d1RowsRead ?? usage.rowsRead ?? (options.method && options.method !== 'GET' ? 0 : 1)) || 0,
    d1RowsWritten: Number(usage.d1RowsWritten ?? usage.rowsWritten ?? (options.method && options.method !== 'GET' ? 1 : 0)) || 0
  });
  return data || {};
}

export async function readFinalPlanShare(code, options = {}) {
  if (!isFinalPlanCacheEnabled()) throw new Error('final-plan-cache-disabled');
  const safeCode = cleanCode(code);
  if (!safeCode) throw new Error('final-plan-code-required');
  if (!options?.force) {
    const cached = readLocal(safeCode, Number(options?.ttlMs) || FINAL_PLAN_CACHE_TTL_MS);
    if (cached) return cached;
  }
  const data = await requestJson(`/api/final-plan/share/${encodeURIComponent(safeCode)}`);
  const plan = normalizePlan(data);
  writeLocal(safeCode, plan);
  return plan;
}

export async function publishFinalPlanShare(user, payload = {}) {
  if (!isFinalPlanCacheEnabled()) return { skipped: true };
  const token = await getFirebaseToken(user);
  if (!token) return { skipped: true };
  const code = cleanCode(payload.code || '');
  const region = cleanRegion(payload.region || '');
  if (!code || !region) return { skipped: true };
  removeLocal(code);
  const body = {
    code,
    region,
    cycleId: cleanCycleId(payload.cycleId || 'active'),
    eventStartAtMs: Number(payload.eventStartAtMs) || 0,
    title: cleanText(payload.title || 'Final plan', 120),
    shift: cleanText(payload.shift || '', 40),
    html: String(payload.html || '').slice(0, 700000),
    text: String(payload.text || '').slice(0, 50000),
    updatedByName: cleanText(payload.updatedByName || '', 160),
    expiresAtMs: Number(payload.expiresAtMs) || 0
  };
  return requestJson('/api/final-plan/share', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  }).then(result => {
    const plan = normalizePlan(result?.plan || body);
    writeLocal(code, plan);
    return { ...result, plan };
  }).catch(error => {
    console.warn('[WKD] final plan D1 publish skipped:', error);
    return { ok: false, skipped: true, error: error.message };
  });
}
