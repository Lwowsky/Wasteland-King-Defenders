const PREFIX = 'wkd.cache';
function key(name = '') { return `${PREFIX}.${name}`; }
function safeNow() { return Date.now(); }
export function readCache(name, ttlMs = 0) {
  try {
    const raw = localStorage.getItem(key(name));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (ttlMs && safeNow() - Number(data.savedAt || 0) > ttlMs) return null;
    return data.value ?? null;
  } catch {
    return null;
  }
}
export function writeCache(name, value) {
  try { localStorage.setItem(key(name), JSON.stringify({ savedAt: safeNow(), value })); } catch {}
  return value;
}
export function removeCache(name) {
  try { localStorage.removeItem(key(name)); } catch {}
}
export function cacheAgeMs(name) {
  try {
    const raw = localStorage.getItem(key(name));
    if (!raw) return 0;
    const data = JSON.parse(raw);
    return Math.max(0, safeNow() - Number(data.savedAt || 0));
  } catch {
    return 0;
  }
}
