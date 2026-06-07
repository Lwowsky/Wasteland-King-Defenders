import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import admin from 'firebase-admin';

const SUMMARY_CACHE_PATH = process.env.STATS_CACHE_PATH || 'public-cache/stats-summary.json';
const PLAYERS_CACHE_PATH = process.env.STATS_PLAYERS_CACHE_PATH || 'public-cache/stats-players.json';
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

function timestampToIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.toMillis === 'function') return new Date(value.toMillis()).toISOString();
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value).toISOString() : null;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000 + Math.floor((Number(value.nanoseconds) || 0) / 1000000)).toISOString();
  }
  return null;
}
function publicKeyFor(playerKey = '') {
  const clean = String(playerKey || '').trim();
  return clean ? crypto.createHash('sha256').update(clean).digest('hex').slice(0, 24) : '';
}
function cleanString(value, max = 80) {
  return String(value ?? '').trim().slice(0, max);
}
function sanitizeWastelandInfo(profile = null) {
  if (!profile || typeof profile !== 'object') return null;
  return {
    lairLevel: cleanString(profile.lairLevel, 12),
    troopType: cleanString(profile.troopType, 24),
    tier: cleanString(profile.tier, 12),
    marchSize: cleanString(profile.marchSize, 24),
    rallySize: cleanString(profile.rallySize, 24),
    captainReady: Boolean(profile.captainReady),
    readyToJoin: Boolean(profile.readyToJoin),
    readyToAttack: Boolean(profile.readyToAttack),
    shift: cleanString(profile.shift, 24),
    extraEnabled: Boolean(profile.extraEnabled),
    extraSquads: Array.isArray(profile.extraSquads) ? profile.extraSquads.slice(0, 6).map(item => ({
      troopType: cleanString(item?.troopType, 24),
      tier: cleanString(item?.tier, 12)
    })) : [],
    extraTroopType: cleanString(profile.extraTroopType, 24),
    extraTier: cleanString(profile.extraTier, 12)
  };
}
function sanitizeFarmForPublic(farm = {}, index = 0, showExtra = false) {
  const row = {
    farmKey: `farm-${index + 1}`,
    nickname: cleanString(farm.nickname || `Farm ${index + 1}`, 80),
    region: String(farm.region || '').replace(/[^0-9]/g, '').slice(0, 8),
    alliance: cleanString(farm.alliance, 12),
    rank: rankCode(farm.rank).toUpperCase(),
    shk: cleanString(farm.shk, 12),
    role: cleanString(farm.role || 'player', 24),
    roleLabel: cleanString(farm.roleLabel || farm.role || 'player', 40)
  };
  if (showExtra && farm.wastelandProfile) row.wastelandProfile = sanitizeWastelandInfo(farm.wastelandProfile);
  return row;
}
function sanitizePlayerForPublic(docId = '', player = {}) {
  if (!player || player.profileComplete === false) return null;
  const visibility = player.profileVisibility && typeof player.profileVisibility === 'object' ? player.profileVisibility : {};
  const showExtra = Boolean(visibility.showWastelandInfo);
  const showFarms = Boolean(visibility.showFarmsInfo);
  const farms = Array.isArray(player.farms) ? player.farms.filter(farm => farm && (farm.nickname || farm.region || farm.alliance)) : [];
  const row = {
    publicKey: publicKeyFor(docId || player.uid || player.id),
    nickname: cleanString(player.nickname || player.gameNick || '—', 80),
    gameNick: cleanString(player.gameNick || player.nickname || '—', 80),
    region: String(player.region || '').replace(/[^0-9]/g, '').slice(0, 8),
    alliance: cleanString(player.alliance, 12),
    rank: rankCode(player.rank).toUpperCase(),
    shk: cleanString(player.shk, 12),
    role: cleanString(player.role || 'player', 24),
    roleLabel: cleanString(player.roleLabel || player.role || 'player', 40),
    country: cleanString(player.country, 60),
    countryCode: cleanString(player.countryCode, 8),
    farmCount: Number.isFinite(Number(player.farmCount)) ? Math.max(0, Number(player.farmCount)) : farms.length,
    profileVisibility: {
      showWastelandInfo: showExtra,
      showFarmsInfo: showFarms
    },
    createdAt: timestampToIso(player.createdAt),
    updatedAt: timestampToIso(player.updatedAt)
  };
  if (showExtra && player.wastelandProfile) row.wastelandProfile = sanitizeWastelandInfo(player.wastelandProfile);
  if (showFarms) row.farms = farms.map((farm, index) => sanitizeFarmForPublic(farm, index, showExtra));
  else row.farms = [];
  return row;
}
function sortPublicPlayers(players = []) {
  return [...players].sort((a, b) => String(a.region || '').localeCompare(String(b.region || ''), 'uk', { numeric: true })
    || String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk', { numeric: true }));
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
function hiddenFarmCountForPlayer(player = {}, entries = []) {
  const farmCount = Math.max(0, Number(player.farmCount || 0));
  const visibleFarmEntries = (Array.isArray(entries) ? entries : []).filter(entry => entry?.isFarm).length;
  return Math.max(0, farmCount - visibleFarmEntries);
}
function applyHiddenFarmCount(summary, count, delta) {
  const value = Math.max(0, Number(count || 0));
  if (!value) return;
  summary.totalFarms += value * delta;
  summary.totalRows += value * delta;
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
  const publicPlayers = [];
  publicSnap.docs.forEach(doc => {
    const player = { id: doc.id, ...doc.data() };
    const entries = extractEntries(player);
    const hiddenFarmCount = hiddenFarmCountForPlayer(player, entries);
    applyEntries(summary, entries, +1);
    applyHiddenFarmCount(summary, hiddenFarmCount, +1);
    const publicRow = sanitizePlayerForPublic(doc.id, player);
    if (publicRow) publicPlayers.push(publicRow);
    operations.push(batch => batch.set(db.collection('statsIndex').doc(doc.id), {
      playerKey: doc.id,
      publicKey: publicKeyFor(doc.id),
      uid: player.uid || doc.id,
      entries,
      hiddenFarmCount,
      publicRow,
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
    totalRows: summary.totalRows,
    publicPlayers: publicPlayers.length
  }, { merge: true });
  return { summary: normalizeSummary(summary), publicPlayers: sortPublicPlayers(publicPlayers) };
}

async function incrementalUpdate(db, existing, existingPlayers = []) {
  const changesSnap = await db.collection('statsChanges')
    .where('processed', '==', false)
    .orderBy('createdAt', 'asc')
    .limit(MAX_PENDING_CHANGES)
    .get();
  if (changesSnap.empty) return { summary: existing, publicPlayers: existingPlayers, changed: false, processed: 0 };
  const playerKeys = [...new Set(changesSnap.docs.map(doc => String(doc.data()?.playerKey || doc.data()?.uid || '').trim()).filter(Boolean))];
  let summary = emptySummary({ ...existing, source: 'github-actions-incremental' });
  const publicMap = new Map((Array.isArray(existingPlayers) ? existingPlayers : [])
    .filter(item => item?.publicKey)
    .map(item => [item.publicKey, item]));
  const batch = db.batch();
  let processed = 0;
  for (const playerKey of playerKeys) {
    const [playerDoc, indexDoc] = await Promise.all([
      db.collection('publicPlayers').doc(playerKey).get(),
      db.collection('statsIndex').doc(playerKey).get()
    ]);
    const oldEntries = indexDoc.exists ? (indexDoc.data()?.entries || []) : [];
    const oldHiddenFarmCount = indexDoc.exists ? Number(indexDoc.data()?.hiddenFarmCount || 0) : 0;
    const oldPublicKey = indexDoc.exists ? (indexDoc.data()?.publicKey || publicKeyFor(playerKey)) : publicKeyFor(playerKey);
    const playerData = playerDoc.exists ? { id: playerDoc.id, ...playerDoc.data() } : null;
    const newEntries = playerData ? extractEntries(playerData) : [];
    const newHiddenFarmCount = playerData ? hiddenFarmCountForPlayer(playerData, newEntries) : 0;
    const newPublicRow = playerData ? sanitizePlayerForPublic(playerDoc.id, playerData) : null;
    applyEntries(summary, oldEntries, -1);
    applyHiddenFarmCount(summary, oldHiddenFarmCount, -1);
    applyEntries(summary, newEntries, +1);
    applyHiddenFarmCount(summary, newHiddenFarmCount, +1);
    if (oldPublicKey) publicMap.delete(oldPublicKey);
    if (newPublicRow?.publicKey) publicMap.set(newPublicRow.publicKey, newPublicRow);
    if (playerDoc.exists && newEntries.length) {
      batch.set(db.collection('statsIndex').doc(playerKey), {
        playerKey,
        publicKey: publicKeyFor(playerKey),
        uid: playerDoc.data()?.uid || playerKey,
        entries: newEntries,
        hiddenFarmCount: newHiddenFarmCount,
        publicRow: newPublicRow,
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
  const publicPlayers = sortPublicPlayers([...publicMap.values()]);
  await db.collection('statsMeta').doc('current').set({
    lastIncrementalAt: admin.firestore.FieldValue.serverTimestamp(),
    pendingProcessed: processed,
    totalPlayers: summary.totalPlayers,
    totalRows: summary.totalRows,
    publicPlayers: publicPlayers.length
  }, { merge: true });
  return { summary: normalizeSummary(summary), publicPlayers, changed: true, processed };
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
  const existing = await readJson(SUMMARY_CACHE_PATH, emptySummary());
  const existingPlayers = await readJson(PLAYERS_CACHE_PATH, []);
  let summary;
  let publicPlayers;
  const playersCacheMissing = !Array.isArray(existingPlayers) || (Number(existing?.totalPlayers || 0) > 0 && existingPlayers.length === 0);
  if (playersCacheMissing || shouldFullRebuild(existing)) {
    const result = await fullRebuild(db);
    summary = result.summary;
    publicPlayers = result.publicPlayers;
  } else {
    const result = await incrementalUpdate(db, existing, existingPlayers);
    if (!result.changed) {
      await cleanupOldChanges(db).catch(() => 0);
      console.log('No pending stats changes. Cache unchanged.');
      return;
    }
    summary = result.summary;
    publicPlayers = result.publicPlayers;
  }
  await writeJson(SUMMARY_CACHE_PATH, summary);
  await writeJson(PLAYERS_CACHE_PATH, publicPlayers);
  const cleaned = await cleanupOldChanges(db).catch(() => 0);
  console.log(`Stats cache updated: players=${summary.totalPlayers}, farms=${summary.totalFarms}, publicRows=${publicPlayers.length}, cleanedChanges=${cleaned}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
