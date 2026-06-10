const DAY_LIMITS = Object.freeze({ reads: 50000, writes: 20000, deletes: 20000 });
const MONTH_LIMITS = Object.freeze({ reads: 1500000, writes: 600000, deletes: 600000 });
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;
const TRAFFIC_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;
const PREFIX = 'wkd.firebaseUsageEstimate';
const CLOUDFLARE_DAY_LIMITS = Object.freeze({ workerRequests: 100000, d1RowsRead: 5000000, d1RowsWritten: 100000 });

function ymd(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
function ym(date = new Date()) {
  return date.toISOString().slice(0, 7);
}
function emptyBucket(id = '') {
  return { id, reads: 0, writes: 0, deletes: 0, updatedAt: Date.now() };
}
function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function bucket(type = 'day') {
  const id = type === 'month' ? ym() : ymd();
  const key = `${PREFIX}.${type}`;
  const current = readJson(key, emptyBucket(id));
  if (!current || current.id !== id) {
    const fresh = emptyBucket(id);
    writeJson(key, fresh);
    return fresh;
  }
  return { ...emptyBucket(id), ...current };
}
function saveBucket(type, value) {
  writeJson(`${PREFIX}.${type}`, { ...value, updatedAt: Date.now() });
}
function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : 0;
}
function add(kind, amount = 1) {
  const key = kind === 'delete' ? 'deletes' : kind === 'write' ? 'writes' : 'reads';
  const value = numberValue(amount);
  if (!value) return;
  ['day', 'month'].forEach(type => {
    const data = bucket(type);
    data[key] = numberValue(data[key]) + value;
    saveBucket(type, data);
  });
}
export function trackReads(amount = 1) { add('read', amount); }
export function trackWrites(amount = 1) { add('write', amount); }
export function trackDeletes(amount = 1) { add('delete', amount); }
export function resetUsageEstimate() {
  saveBucket('day', emptyBucket(ymd()));
  saveBucket('month', emptyBucket(ym()));
}
function quotaRow(label, used, limit) {
  const safeUsed = numberValue(used);
  const safeLimit = numberValue(limit);
  const remaining = Math.max(0, safeLimit - safeUsed);
  const percent = safeLimit ? Math.min(100, Math.round((safeUsed / safeLimit) * 100)) : 0;
  return { label, used: safeUsed, limit: safeLimit, remaining, percent };
}


export function trackCloudflareUsage() {}
export function trackWorkerRequest() {}
export function trackD1RowsRead() {}
export function trackD1RowsWritten() {}

export function getUsageEstimate() {
  const day = bucket('day');
  const month = bucket('month');
  return {
    dayId: day.id,
    monthId: month.id,
    day: {
      reads: quotaRow('reads', day.reads, DAY_LIMITS.reads),
      writes: quotaRow('writes', day.writes, DAY_LIMITS.writes),
      deletes: quotaRow('deletes', day.deletes, DAY_LIMITS.deletes)
    },
    month: {
      reads: quotaRow('reads', month.reads, MONTH_LIMITS.reads),
      writes: quotaRow('writes', month.writes, MONTH_LIMITS.writes),
      deletes: quotaRow('deletes', month.deletes, MONTH_LIMITS.deletes)
    },
    storageLimitBytes: STORAGE_LIMIT_BYTES,
    trafficLimitBytes: TRAFFIC_LIMIT_BYTES,
    updatedAt: Math.max(Number(day.updatedAt) || 0, Number(month.updatedAt) || 0)
  };
}
