import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import admin from 'firebase-admin';

const CACHE_PATH = process.env.STATS_CACHE_PATH || 'public-cache/stats-summary.json';
const FULL_REBUILD_HOUR_UTC = Number(process.env.STATS_FULL_REBUILD_HOUR_UTC ?? 3);
const MAX_PENDING_CHANGES = Number(process.env.STATS_MAX_PENDING_CHANGES ?? 250);
const CHANGE_RETENTION_DAYS = Number(process.env.STATS_CHANGE_RETENTION_DAYS ?? 30);

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT secret');
  const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const data = JSON.parse(json);
  if (typeof data.private_key === 'string') data.private_key = data.private_key.replace(/\\n/g, '\n');
  return data;
}

function initFirebase() {
  if (admin.apps.length) return admin.firestore();
  admin.initializeApp({ credential: admin.credential.cert(parseServiceAccount()) });
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

async function readJson(filePath, fallback = null) {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); }
  catch { return fallback; }
}
async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function emptySummary(extra = {}) {
  return {
    version: 1,
    source: 'github-actions',
    generatedAt: new Date().toISOString(),
    lastFullRebuildDate: null,
    totalPlayers: 0,
    totalFarms: 0,
    totalRows: 0,
    leaders: 0,
    leadersWithFarms: 0,
    regions: {},
    regionsWithFarms: {},
    alliances: {},
    alliancesWithFarms: {},
    ranks: {},
    ranksWithFarms: {},
    shkTiers: {},
    shkTiersWithFarms: {},
    processedChanges: 0,
    ...extra
  };
}

function inc(map, key, delta) {
  const clean = String(key || '').trim() || '—';
  const next = Number(map[clean] || 0) + Number(delta || 0);
  if (next > 0) map[clean] = next;
  else delete map[clean];
}
function rankCode(value) {
  const match = String(value || 'p1').toLowerCase().match(/[pr]?\s*([1-5])/);
  return match ? `p${match[1]}` : 'p1';
}
function shkTier(value) {
  const n = Number(String(value ?? '').match(/\d+/)?.[0] || 0);
  if (!n) return 'unknown';
  if (n <= 3) return 't1';
  if (n <= 6) return 't2';
  if (n <= 9) return 't3';
  if (n <= 12) return 't4';
  if (n <= 15) return 't5';
  if (n <= 18) return 't6';
  if (n <= 21) return 't7';
  if (n <= 25) return 't8';
  if (n <= 29) return 't9';
  if (n <= 33) return 't10';
  if (n <= 37) return 't11';
  if (n <= 39) return 't12';
  if (n <= 43) return 't13';
  return 't14';
}
function isLeader(role) {
  return ['admin', 'moderator', 'consul', 'officer'].includes(String(role || '').toLowerCase());
}
function entryFromPlayer(player = {}, isFarm = false) {
  return {
    isFarm: Boolean(isFarm),
    region: String(player.region || '').replace(/[^0-9]/g, '') || '—',
    alliance: String(player.alliance || '').trim() || '—',
    rank: rankCode(player.rank),
    shkTier: shkTier(player.shk),
    role: String(player.role || 'player').toLowerCase()
  };
}
function extractEntries(publicPlayer = {}) {
  if (!publicPlayer || publicPlayer.profileComplete === false) return [];
  const entries = [entryFromPlayer(publicPlayer, false)];
  const farms = Array.isArray(publicPlayer.farms) ? publicPlayer.farms : [];
  farms.forEach(farm => {
    if (farm && (farm.nickname || farm.region || farm.alliance)) entries.push(entryFromPlayer(farm, true));
  });
  return entries;
}
function applyEntry(summary, entry, delta) {
  if (!entry) return;
  const farm = Boolean(entry.isFarm);
  if (farm) summary.totalFarms += delta;
  else summary.totalPlayers += delta;
  summary.totalRows += delta;
  inc(summary.regionsWithFarms, entry.region, delta);
  inc(summary.alliancesWithFarms, entry.alliance, delta);
  inc(summary.ranksWithFarms, entry.rank, delta);
  inc(summary.shkTiersWithFarms, entry.shkTier, delta);
  if (isLeader(entry.role)) summary.leadersWithFarms += delta;
  if (!farm) {
    inc(summary.regions, entry.region, delta);
    inc(summary.alliances, entry.alliance, delta);
    inc(summary.ranks, entry.rank, delta);
    inc(summary.shkTiers, entry.shkTier, delta);
    if (isLeader(entry.role)) summary.leaders += delta;
  }
}
function applyEntries(summary, entries, delta) {
  (Array.isArray(entries) ? entries : []).forEach(entry => applyEntry(summary, entry, delta));
}
function normalizeSummary(summary) {
  for (const key of ['totalPlayers', 'totalFarms', 'totalRows', 'leaders', 'leadersWithFarms', 'processedChanges']) {
    summary[key] = Math.max(0, Number(summary[key] || 0));
  }
  for (const key of ['regions', 'regionsWithFarms', 'alliances', 'alliancesWithFarms', 'ranks', 'ranksWithFarms', 'shkTiers', 'shkTiersWithFarms']) {
    summary[key] = summary[key] && typeof summary[key] === 'object' ? summary[key] : {};
    for (const item of Object.keys(summary[key])) if (Number(summary[key][item]) <= 0) delete summary[key][item];
  }
  summary.generatedAt = new Date().toISOString();
  return summary;
}
function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}
function shouldFullRebuild(existing) {
  if (process.env.STATS_FORCE_FULL === '1') return true;
  const now = new Date();
  if (!existing?.lastFullRebuildDate) return true;
  return now.getUTCHours() >= FULL_REBUILD_HOUR_UTC && existing.lastFullRebuildDate !== todayUtc();
}

async function commitBatchQueue(db, operations) {
  let batch = db.batch();
  let count = 0;
  for (const op of operations) {
    op(batch);
    count += 1;
    if (count >= 450) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count) await batch.commit();
}

async function fullRebuild(db) {
  const summary = emptySummary({ lastFullRebuildDate: todayUtc(), source: 'github-actions-full' });
  const publicSnap = await db.collection('publicPlayers').get();
  const publicIds = new Set(publicSnap.docs.map(doc => doc.id));
  const operations = [];
  publicSnap.docs.forEach(doc => {
    const player = { id: doc.id, ...doc.data() };
    const entries = extractEntries(player);
    applyEntries(summary, entries, +1);
    operations.push(batch => batch.set(db.collection('statsIndex').doc(doc.id), {
      playerKey: doc.id,
      uid: player.uid || doc.id,
      entries,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true }));
  });
  const indexSnap = await db.collection('statsIndex').get();
  indexSnap.docs.forEach(doc => {
    if (!publicIds.has(doc.id)) operations.push(batch => batch.delete(doc.ref));
  });
  await commitBatchQueue(db, operations);
  await db.collection('statsMeta').doc('current').set({
    lastFullRebuildAt: admin.firestore.FieldValue.serverTimestamp(),
    lastFullRebuildDate: todayUtc(),
    totalPlayers: summary.totalPlayers,
    totalRows: summary.totalRows
  }, { merge: true });
  return normalizeSummary(summary);
}

async function incrementalUpdate(db, existing) {
  const changesSnap = await db.collection('statsChanges')
    .where('processed', '==', false)
    .orderBy('createdAt', 'asc')
    .limit(MAX_PENDING_CHANGES)
    .get();
  if (changesSnap.empty) return { summary: existing, changed: false, processed: 0 };
  const playerKeys = [...new Set(changesSnap.docs.map(doc => String(doc.data()?.playerKey || doc.data()?.uid || '').trim()).filter(Boolean))];
  let summary = emptySummary({ ...existing, source: 'github-actions-incremental' });
  const batch = db.batch();
  let processed = 0;
  for (const playerKey of playerKeys) {
    const [playerDoc, indexDoc] = await Promise.all([
      db.collection('publicPlayers').doc(playerKey).get(),
      db.collection('statsIndex').doc(playerKey).get()
    ]);
    const oldEntries = indexDoc.exists ? (indexDoc.data()?.entries || []) : [];
    const newEntries = playerDoc.exists ? extractEntries({ id: playerDoc.id, ...playerDoc.data() }) : [];
    applyEntries(summary, oldEntries, -1);
    applyEntries(summary, newEntries, +1);
    if (playerDoc.exists && newEntries.length) {
      batch.set(db.collection('statsIndex').doc(playerKey), {
        playerKey,
        uid: playerDoc.data()?.uid || playerKey,
        entries: newEntries,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } else {
      batch.delete(db.collection('statsIndex').doc(playerKey));
    }
  }
  changesSnap.docs.forEach(doc => {
    batch.set(doc.ref, { processed: true, processedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    processed += 1;
  });
  await batch.commit();
  summary.processedChanges = Number(summary.processedChanges || 0) + processed;
  await db.collection('statsMeta').doc('current').set({
    lastIncrementalAt: admin.firestore.FieldValue.serverTimestamp(),
    pendingProcessed: processed,
    totalPlayers: summary.totalPlayers,
    totalRows: summary.totalRows
  }, { merge: true });
  return { summary: normalizeSummary(summary), changed: true, processed };
}

async function cleanupOldChanges(db) {
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - CHANGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const snap = await db.collection('statsChanges')
    .where('processed', '==', true)
    .where('createdAt', '<', cutoff)
    .limit(100)
    .get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  return snap.size;
}

async function main() {
  const db = initFirebase();
  const existing = await readJson(CACHE_PATH, emptySummary());
  let summary;
  if (shouldFullRebuild(existing)) {
    summary = await fullRebuild(db);
  } else {
    const result = await incrementalUpdate(db, existing);
    if (!result.changed) {
      await cleanupOldChanges(db).catch(() => 0);
      console.log('No pending stats changes. Cache unchanged.');
      return;
    }
    summary = result.summary;
  }
  await writeJson(CACHE_PATH, summary);
  const cleaned = await cleanupOldChanges(db).catch(() => 0);
  console.log(`Stats cache updated: players=${summary.totalPlayers}, farms=${summary.totalFarms}, cleanedChanges=${cleaned}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
