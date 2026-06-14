import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const EXPORT_URL = process.env.PUBLIC_SHARE_EXPORT_URL || process.env.PUBLIC_SNAPSHOTS_EXPORT_URL || '';
const EXPORT_SECRET = process.env.PUBLIC_SHARE_EXPORT_SECRET || process.env.PUBLIC_STATS_EXPORT_SECRET || '';
const CACHE_ROOT = process.env.PUBLIC_SHARE_CACHE_ROOT || 'public-cache/share';

function info(message) {
  console.log(`[public-share-snapshots] ${message}`);
}

function safeRelativeFile(filePath = '') {
  const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized.startsWith('public-cache/share/')) return '';
  if (!normalized.endsWith('.json')) return '';
  if (normalized.includes('..')) return '';
  return normalized;
}

async function readJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(EXPORT_SECRET ? { 'X-WKD-Stats-Secret': EXPORT_SECRET } : {})
    }
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || data?.ok === false) throw new Error(data?.error || `public-share-export-${response.status}`);
  return data || {};
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function listJsonFiles(dir) {
  const found = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) found.push(...await listJsonFiles(full));
      else if (entry.isFile() && entry.name.endsWith('.json')) found.push(full.replace(/\\/g, '/'));
    }
  } catch {}
  return found;
}

async function main() {
  if (!EXPORT_URL) {
    info('PUBLIC_SHARE_EXPORT_URL is not set. Skipping public share snapshot export.');
    return;
  }
  const data = await readJson(EXPORT_URL);
  const files = Array.isArray(data.files) ? data.files : [];
  const active = new Set();
  let written = 0;
  for (const file of files) {
    const relative = safeRelativeFile(file.path);
    if (!relative || !file.data) continue;
    await writeJson(relative, file.data);
    active.add(relative.replace(/\\/g, '/'));
    written += 1;
  }
  const manifest = {
    ok: true,
    version: 1,
    source: data.source || 'cloudflare-d1-public-share-export',
    generatedAt: data.generatedAt || new Date().toISOString(),
    counts: data.counts || { total: written },
    files: [...active].sort()
  };
  await writeJson(path.join(CACHE_ROOT, 'index.json'), manifest);
  active.add(path.join(CACHE_ROOT, 'index.json').replace(/\\/g, '/'));

  const existing = await listJsonFiles(CACHE_ROOT);
  let removed = 0;
  for (const filePath of existing) {
    const normalized = filePath.replace(/\\/g, '/');
    if (active.has(normalized)) continue;
    if (!normalized.includes('/rt/') && !normalized.includes('/p/')) continue;
    await fs.rm(filePath, { force: true });
    removed += 1;
  }
  await fs.mkdir(path.join(CACHE_ROOT, 'rt'), { recursive: true });
  await fs.mkdir(path.join(CACHE_ROOT, 'p'), { recursive: true });
  await fs.writeFile(path.join(CACHE_ROOT, 'rt', '.gitkeep'), '', 'utf8').catch(() => {});
  await fs.writeFile(path.join(CACHE_ROOT, 'p', '.gitkeep'), '', 'utf8').catch(() => {});
  info(`Snapshot export finished: written=${written}, removed=${removed}.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
