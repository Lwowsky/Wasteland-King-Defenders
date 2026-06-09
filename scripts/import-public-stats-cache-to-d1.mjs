import fs from 'node:fs/promises';
import process from 'node:process';

const PLAYERS_CACHE_PATH = process.env.STATS_PLAYERS_CACHE_PATH || 'public-cache/stats-players.json';
const PUBLIC_STATS_IMPORT_URL = process.env.PUBLIC_STATS_IMPORT_URL || '';
const PUBLIC_STATS_IMPORT_SECRET = process.env.PUBLIC_STATS_IMPORT_SECRET || process.env.PUBLIC_STATS_EXPORT_SECRET || '';

async function readJson(filePath, fallback = null) {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); }
  catch { return fallback; }
}

async function main() {
  if (!PUBLIC_STATS_IMPORT_URL) throw new Error('Missing PUBLIC_STATS_IMPORT_URL');
  if (!PUBLIC_STATS_IMPORT_SECRET) throw new Error('Missing PUBLIC_STATS_IMPORT_SECRET');
  const players = await readJson(PLAYERS_CACHE_PATH, []);
  if (!Array.isArray(players)) throw new Error(`Bad players JSON: ${PLAYERS_CACHE_PATH}`);
  const response = await fetch(PUBLIC_STATS_IMPORT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-WKD-Stats-Secret': PUBLIC_STATS_IMPORT_SECRET
    },
    body: JSON.stringify({ players })
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || data?.ok === false) throw new Error(data?.error || `public-stats-import-${response.status}`);
  console.log(`Imported public stats to D1: players=${data.players}, buckets=${data.buckets}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
