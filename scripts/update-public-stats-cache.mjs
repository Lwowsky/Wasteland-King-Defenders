import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import admin from 'firebase-admin';

const SUMMARY_CACHE_PATH = process.env.STATS_CACHE_PATH || 'public-cache/stats-summary.json';
const PLAYERS_CACHE_PATH = process.env.STATS_PLAYERS_CACHE_PATH || 'public-cache/stats-players.json';
const FARMS_CACHE_PATH = process.env.STATS_FARMS_CACHE_PATH || 'public-cache/stats-farms.json';
const VERSION_CACHE_PATH = process.env.STATS_VERSION_CACHE_PATH || 'public-cache/stats-version.json';
const REGION_PLAYERS_DIR = process.env.STATS_REGION_PLAYERS_DIR || path.dirname(PLAYERS_CACHE_PATH);
const REGION_INDEX_CACHE_PATH = process.env.STATS_REGION_INDEX_CACHE_PATH || path.join(path.dirname(PLAYERS_CACHE_PATH), 'stats-regions.json');
const STATS_PLAYERS_INDEX_PATH = process.env.STATS_PLAYERS_INDEX_PATH || path.join(path.dirname(PLAYERS_CACHE_PATH), 'stats-players-index.json');
const STATS_PLAYER_CHUNK_SIZE = Math.max(10, Number(process.env.STATS_PLAYER_CHUNK_SIZE || 50));
const FULL_REBUILD_HOUR_UTC = Number(process.env.STATS_FULL_REBUILD_HOUR_UTC ?? 3);
const MAX_PENDING_CHANGES = Number(process.env.STATS_MAX_PENDING_CHANGES ?? 250);
const CHANGE_RETENTION_DAYS = Number(process.env.STATS_CHANGE_RETENTION_DAYS ?? 30);
const PUBLIC_STATS_EXPORT_URL = process.env.PUBLIC_STATS_EXPORT_URL || '';
const PUBLIC_STATS_EXPORT_SECRET = process.env.PUBLIC_STATS_EXPORT_SECRET || '';

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

function info(message) {
  console.log(`[stats-cache] ${message}`);
}

function pageNumber(value = 1) {
  const number = Math.max(1, Number(value || 1));
  return String(number).padStart(3, '0');
}
function statsRegionFilePath(region = '') {
  const safe = String(region || '').replace(/[^0-9]/g, '').slice(0, 8);
  return path.join(REGION_PLAYERS_DIR, `stats-players-R${safe}.json`);
}
function statsRegionFarmsFilePath(region = '') {
  const safe = String(region || '').replace(/[^0-9]/g, '').slice(0, 8);
  return path.join(REGION_PLAYERS_DIR, `stats-farms-R${safe}.json`);
}
function statsAllChunkFilePath(page = 1) {
  return path.join(REGION_PLAYERS_DIR, `stats-players-all-page-${pageNumber(page)}.json`);
}
function statsRegionChunkFilePath(region = '', page = 1) {
  const safe = String(region || '').replace(/[^0-9]/g, '').slice(0, 8);
  return path.join(REGION_PLAYERS_DIR, `stats-players-R${safe}-page-${pageNumber(page)}.json`);
}
function chunkRows(rows = [], size = STATS_PLAYER_CHUNK_SIZE) {
  const list = Array.isArray(rows) ? rows : [];
  const chunks = [];
  for (let index = 0; index < list.length; index += size) chunks.push(list.slice(index, index + size));
  return chunks.length ? chunks : [[]];
}
async function writePlayerChunkFiles(publicPlayers = []) {
  const sortedPlayers = sortPublicPlayers(Array.isArray(publicPlayers) ? publicPlayers : []);
  const buckets = new Map();
  sortedPlayers.forEach(player => {
    const regions = new Set();
    const mainRegion = String(player?.region || '').replace(/[^0-9]/g, '').slice(0, 8);
    if (mainRegion) regions.add(mainRegion);
    (Array.isArray(player?.farms) ? player.farms : []).forEach(farm => {
      const farmRegion = String(farm?.region || '').replace(/[^0-9]/g, '').slice(0, 8);
      if (farmRegion) regions.add(farmRegion);
    });
    regions.forEach(region => {
      if (!buckets.has(region)) buckets.set(region, []);
      buckets.get(region).push(player);
    });
  });

  const allChunks = chunkRows(sortedPlayers);
  const allPages = allChunks.map((rows, index) => ({
    page: index + 1,
    file: `stats-players-all-page-${pageNumber(index + 1)}.json`,
    rows: rows.length
  }));
  await Promise.all(allChunks.map((rows, index) => writeJson(statsAllChunkFilePath(index + 1), rows)));

  const regions = [];
  const writes = [];
  for (const [region, rows] of [...buckets.entries()].sort(([a], [b]) => Number(a) - Number(b) || a.localeCompare(b))) {
    const sortedRows = sortPublicPlayers(rows);
    const chunks = chunkRows(sortedRows);
    const pages = chunks.map((chunk, index) => ({
      page: index + 1,
      file: `stats-players-R${region}-page-${pageNumber(index + 1)}.json`,
      rows: chunk.length
    }));
    regions.push({
      region,
      file: `stats-players-R${region}.json`,
      rows: sortedRows.length,
      chunkSize: STATS_PLAYER_CHUNK_SIZE,
      pages
    });
    writes.push(writeJson(statsRegionFilePath(region), sortedRows));
    chunks.forEach((chunk, index) => writes.push(writeJson(statsRegionChunkFilePath(region, index + 1), chunk)));
  }
  await Promise.all(writes);
  await writeJson(REGION_INDEX_CACHE_PATH, regions.map(({ region, file, rows, pages }) => ({ region, file, rows, pages: pages.length })));
  await writeJson(STATS_PLAYERS_INDEX_PATH, {
    version: 2,
    generatedAt: new Date().toISOString(),
    chunkSize: STATS_PLAYER_CHUNK_SIZE,
    totalRows: sortedPlayers.length,
    all: { rows: sortedPlayers.length, pages: allPages },
    regions
  });
  return { allPages: allPages.length, regionFiles: regions.length, regionPages: regions.reduce((sum, item) => sum + item.pages.length, 0) };
}

async function writeRegionPlayerFiles(publicPlayers = []) {
  const result = await writePlayerChunkFiles(publicPlayers);
  return result.regionFiles;
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
function boolValue(value) {
  if (value === true || value === false) return value;
  const text = cleanString(value, 24).toLowerCase();
  if (!text) return false;
  if (/^(0|false|no|ні|нi|нет|nope|n)$/.test(text)) return false;
  return /^(1|true|yes|так|да|はい|是|예|y)$/.test(text);
}
function sanitizeWastelandInfo(profile = null) {
  if (!profile || typeof profile !== 'object') return null;
  return {
    lairLevel: cleanString(profile.lairLevel, 12),
    troopType: cleanString(profile.troopType, 24),
    tier: cleanString(profile.tier, 12),
    marchSize: cleanString(profile.marchSize, 24),
    rallySize: cleanString(profile.rallySize, 24),
    captainReady: boolValue(profile.captainReady),
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

function normalizeCountryCode(value) {
  return String(value || '').trim().toUpperCase().slice(0, 8);
}
function normalizeCountry(value) {
  return cleanString(value, 60);
}
function normalizeRole(value) {
  const role = String(value || 'player').trim().toLowerCase();
  return ['admin', 'moderator', 'consul', 'officer', 'player'].includes(role) ? role : 'player';
}
function normalizePublicFarm(raw = {}, index = 0, showWastelandInfo = false) {
  return {
    farmId: cleanString(raw.farmId || raw.id || `farm-${index + 1}`, 40),
    nickname: cleanString(raw.nickname || raw.gameNick || `Farm ${index + 1}`, 80),
    region: String(raw.region || '').replace(/[^0-9]/g, '').slice(0, 8),
    alliance: cleanString(raw.alliance, 12),
    rank: rankCode(raw.rank).toUpperCase(),
    shk: cleanString(raw.shk, 12),
    role: normalizeRole(raw.role || 'player'),
    roleLabel: cleanString(raw.roleLabel || raw.role || 'player', 40),
    wastelandProfile: showWastelandInfo ? sanitizeWastelandInfo(raw.wastelandProfile || {}) : null
  };
}
function makePublicPlayerFromUserDoc(docId = '', data = {}) {
  const game = data.gameProfile && typeof data.gameProfile === 'object' ? data.gameProfile : {};
  const nickname = cleanString(game.nickname || data.gameNick || data.nickname, 80);
  const region = String(game.region || data.region || '').replace(/[^0-9]/g, '').slice(0, 8);
  const alliance = cleanString(game.alliance || data.alliance, 12);
  const rank = rankCode(game.rank || data.rank).toUpperCase();
  const shk = cleanString(game.shk || data.shk, 12);
  const complete = Boolean(data.profileComplete && nickname && region && alliance && shk);
  if (!complete) return null;
  const visibility = data.profileVisibility && typeof data.profileVisibility === 'object' ? data.profileVisibility : {};
  const showExtra = Boolean(visibility.showWastelandInfo);
  const showFarms = Boolean(visibility.showFarmsInfo);
  const rawFarms = Array.isArray(data.farms) ? data.farms.filter(farm => farm && (farm.nickname || farm.gameNick || farm.region || farm.alliance)) : [];
  const row = {
    uid: docId,
    gameNick: nickname,
    nickname,
    region,
    alliance,
    rank,
    shk,
    role: normalizeRole(data.role || 'player'),
    roleLabel: cleanString(data.roleLabel || data.role || 'player', 40),
    country: normalizeCountry(data.country),
    countryCode: normalizeCountryCode(data.countryCode),
    farmCount: rawFarms.length,
    profileComplete: true,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    profileVisibility: {
      showWastelandInfo: showExtra,
      showFarmsInfo: showFarms
    },
    wastelandProfile: showExtra ? sanitizeWastelandInfo(game.wastelandProfile || data.wastelandProfile || {}) : null,
    farms: showFarms ? rawFarms.map((farm, index) => normalizePublicFarm(farm, index, showExtra)) : []
  };
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

function publicPlayerUpdatedAtMs(player = {}) {
  const value = player?.updatedAt || player?.createdAt || 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : 0;
  }
  if (value && typeof value === 'object') {
    if (typeof value.seconds === 'number') return (value.seconds * 1000) + Math.floor((Number(value.nanoseconds) || 0) / 1000000);
    if (typeof value._seconds === 'number') return (value._seconds * 1000) + Math.floor((Number(value._nanoseconds) || 0) / 1000000);
  }
  return 0;
}

function publicPlayerDedupeKey(player = {}) {
  const publicKey = cleanString(player?.publicKey || player?.uid || player?.id, 80);
  if (publicKey) return `key:${publicKey}`;
  return `identity:${cleanString(player?.nickname || player?.gameNick, 80).toLowerCase()}|${String(player?.region || '').replace(/[^0-9]/g, '')}|${cleanString(player?.alliance, 40)}`;
}

function dedupePublicPlayers(players = []) {
  const map = new Map();
  (Array.isArray(players) ? players : []).forEach(player => {
    if (!player || !player.publicKey || !player.nickname || player.profileComplete === false) return;
    const key = publicPlayerDedupeKey(player);
    const existing = map.get(key);
    if (!existing || publicPlayerUpdatedAtMs(player) >= publicPlayerUpdatedAtMs(existing)) {
      map.set(key, player);
    }
  });
  return sortPublicPlayers([...map.values()]);
}

function sortPublicPlayers(players = []) {
  return [...players].sort((a, b) => String(a.region || '').localeCompare(String(b.region || ''), 'uk', { numeric: true })
    || String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk', { numeric: true }));
}



function compactPublicPlayerForStats(player = {}) {
  const sameNick = cleanString(player.gameNick || '', 80) === cleanString(player.nickname || '', 80);
  const visibility = player.profileVisibility && typeof player.profileVisibility === 'object' ? player.profileVisibility : {};
  const showExtra = Boolean(visibility.showWastelandInfo);
  const showFarms = Boolean(visibility.showFarmsInfo);
  const row = {
    publicKey: cleanString(player.publicKey || player.uid || player.id, 80),
    nickname: cleanString(player.nickname || player.gameNick || '—', 80),
    region: String(player.region || '').replace(/[^0-9]/g, '').slice(0, 8),
    alliance: cleanString(player.alliance, 12),
    rank: rankCode(player.rank).toUpperCase(),
    shk: cleanString(player.shk, 12),
    role: normalizeRole(player.role || 'player'),
    countryCode: normalizeCountryCode(player.countryCode || player.country),
    farmCount: Math.max(0, Number(player.farmCount || (Array.isArray(player.farms) ? player.farms.length : 0)) || 0),
    createdAt: timestampToIso(player.createdAt) || null,
    updatedAt: timestampToIso(player.updatedAt) || null,
    profileVisibility: {
      showWastelandInfo: showExtra,
      showFarmsInfo: showFarms
    }
  };
  if (!sameNick && player.gameNick) row.gameNick = cleanString(player.gameNick, 80);
  if (showExtra && player.wastelandProfile) row.wastelandProfile = sanitizeWastelandInfo(player.wastelandProfile);
  return row;
}

function compactFarmForStats(owner = {}, farm = {}, index = 0) {
  const showExtra = Boolean(owner?.profileVisibility?.showWastelandInfo);
  const row = {
    ownerPublicKey: cleanString(owner.publicKey || owner.uid || owner.id, 80),
    ownerNickname: cleanString(owner.nickname || owner.gameNick || '—', 80),
    farmKey: cleanString(farm.farmKey || farm.farmId || farm.id || `farm-${index + 1}`, 40),
    nickname: cleanString(farm.nickname || `Farm ${index + 1}`, 80),
    region: String(farm.region || '').replace(/[^0-9]/g, '').slice(0, 8),
    alliance: cleanString(farm.alliance, 12),
    rank: rankCode(farm.rank).toUpperCase(),
    shk: cleanString(farm.shk, 12),
    role: normalizeRole(farm.role || owner.role || 'player'),
    createdAt: timestampToIso(owner.createdAt) || null,
    updatedAt: timestampToIso(owner.updatedAt) || null
  };
  if (showExtra && farm.wastelandProfile) row.wastelandProfile = sanitizeWastelandInfo(farm.wastelandProfile);
  return row;
}

function splitPublicStatsFiles(publicPlayers = []) {
  const sourcePlayers = dedupePublicPlayers(publicPlayers);
  const players = sourcePlayers.map(compactPublicPlayerForStats).filter(row => row.publicKey && row.nickname);
  const farms = [];
  sourcePlayers.forEach(owner => {
    if (!owner?.profileVisibility?.showFarmsInfo) return;
    (Array.isArray(owner.farms) ? owner.farms : [])
      .filter(farm => farm && (farm.nickname || farm.region || farm.alliance))
      .forEach((farm, index) => farms.push(compactFarmForStats(owner, farm, index)));
  });
  return { players: sortPublicPlayers(players), farms: farms.sort((a, b) => String(a.region || '').localeCompare(String(b.region || ''), 'uk', { numeric: true }) || String(a.ownerNickname || '').localeCompare(String(b.ownerNickname || ''), 'uk', { numeric: true }) || String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk', { numeric: true })) };
}

function publicStatsRegionKey(value = '') {
  return String(value || '').replace(/[^0-9]/g, '').slice(0, 8);
}

function publicPlayerRegionSet(player = {}) {
  const regions = new Set();
  const mainRegion = publicStatsRegionKey(player.region);
  if (mainRegion) regions.add(mainRegion);
  (Array.isArray(player.farms) ? player.farms : []).forEach(farm => {
    const farmRegion = publicStatsRegionKey(farm?.region);
    if (farmRegion) regions.add(farmRegion);
  });
  return regions;
}

async function writeRegionScopedStatsFiles(publicPlayers = []) {
  const playerBuckets = new Map();
  const farmBuckets = new Map();
  const addPlayer = (region, row) => {
    if (!region || !row?.publicKey) return;
    if (!playerBuckets.has(region)) playerBuckets.set(region, new Map());
    playerBuckets.get(region).set(row.publicKey, row);
  };
  const addFarm = (region, row) => {
    if (!region || !row?.nickname) return;
    if (!farmBuckets.has(region)) farmBuckets.set(region, []);
    farmBuckets.get(region).push(row);
  };

  dedupePublicPlayers(publicPlayers).forEach(owner => {
    const compactOwner = compactPublicPlayerForStats(owner);
    if (!compactOwner?.publicKey || !compactOwner?.nickname) return;
    publicPlayerRegionSet(owner).forEach(region => addPlayer(region, compactOwner));
    if (!owner?.profileVisibility?.showFarmsInfo) return;
    (Array.isArray(owner.farms) ? owner.farms : [])
      .filter(farm => farm && (farm.nickname || farm.region || farm.alliance))
      .forEach((farm, index) => {
        const farmRow = compactFarmForStats(owner, farm, index);
        const farmRegion = publicStatsRegionKey(farmRow.region);
        addFarm(farmRegion, farmRow);
        if (farmRegion) addPlayer(farmRegion, compactOwner);
      });
  });

  const regions = [...new Set([...playerBuckets.keys(), ...farmBuckets.keys()])].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  await Promise.all(regions.flatMap(region => {
    const players = sortPublicPlayers([...((playerBuckets.get(region) || new Map()).values())]);
    const farms = [...(farmBuckets.get(region) || [])].sort((a, b) => String(a.ownerNickname || '').localeCompare(String(b.ownerNickname || ''), 'uk', { numeric: true }) || String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk', { numeric: true }));
    return [
      writeJson(statsRegionFilePath(region), players),
      writeJson(statsRegionFarmsFilePath(region), farms)
    ];
  }));
  await writeJson(REGION_INDEX_CACHE_PATH, regions.map(region => ({
    region,
    playersFile: `stats-players-R${region}.json`,
    farmsFile: `stats-farms-R${region}.json`,
    players: (playerBuckets.get(region) || new Map()).size,
    farms: (farmBuckets.get(region) || []).length
  })));
  return regions;
}

function statsVersionToken(summary = {}, files = {}) {
  const sourceVersion = String(summary.d1Version || summary.d1UpdatedAtMs || 'static');
  const generated = String(Date.parse(summary.generatedAt || '') || Date.now());
  return `${sourceVersion}-${generated}`;
}

function buildStatsVersion(summary = {}, files = {}, regions = []) {
  return {
    version: statsVersionToken(summary, files),
    generatedAt: summary.generatedAt || new Date().toISOString(),
    updatedAt: summary.generatedAt || new Date().toISOString(),
    source: summary.source || 'public-cache',
    playersFile: path.basename(PLAYERS_CACHE_PATH),
    farmsFile: path.basename(FARMS_CACHE_PATH),
    summaryFile: path.basename(SUMMARY_CACHE_PATH),
    totalPlayers: Math.max(0, Number(summary.totalPlayers || 0)),
    totalFarms: Math.max(0, Number(summary.totalFarms || 0)),
    totalRows: Math.max(0, Number(summary.totalRows || 0)),
    playersRows: Array.isArray(files.players) ? files.players.length : 0,
    farmRows: Array.isArray(files.farms) ? files.farms.length : 0,
    regionFiles: Array.isArray(regions) ? regions.length : 0
  };
}

async function cleanupObsoleteStatsFiles() {
  const dir = path.dirname(PLAYERS_CACHE_PATH);
  let entries = [];
  try { entries = await fs.readdir(dir); } catch { return 0; }
  const obsolete = entries.filter(name => /^stats-players-(?:all-page|R\d+(?:-page)?|index)\b.*\.json$/i.test(name) || /^stats-farms-R\d+\.json$/i.test(name) || name === 'stats-regions.json');
  await Promise.all(obsolete.map(name => fs.unlink(path.join(dir, name)).catch(() => null)));
  return obsolete.length;
}

async function writePublicStatsFiles(summary = {}, publicPlayers = []) {
  const cleanSource = dedupePublicPlayers(publicPlayers);
  const files = splitPublicStatsFiles(cleanSource);
  const finalSummary = buildSummaryFromPublicPlayers(cleanSource, {
    source: summary?.source || 'github-actions',
    lastFullRebuildDate: summary?.lastFullRebuildDate || todayUtc(),
    processedChanges: summary?.processedChanges || 0,
    d1Version: summary?.d1Version || null,
    d1UpdatedAtMs: summary?.d1UpdatedAtMs || 0,
    d1Buckets: summary?.d1Buckets || 0
  });
  await cleanupObsoleteStatsFiles();
  const regions = await writeRegionScopedStatsFiles(cleanSource);
  await writeJson(SUMMARY_CACHE_PATH, finalSummary);
  await writeJson(PLAYERS_CACHE_PATH, files.players);
  await writeJson(FARMS_CACHE_PATH, files.farms);
  await writeJson(VERSION_CACHE_PATH, buildStatsVersion(finalSummary, files, regions));
  return { summary: finalSummary, publicPlayers: files.players, publicFarms: files.farms };
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
    roles: {},
    rolesWithFarms: {},
    countries: {},
    countriesWithFarms: {},
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
function entryFromPlayer(player = {}, isFarm = false, inheritedCountry = '') {
  return {
    isFarm: Boolean(isFarm),
    region: String(player.region || '').replace(/[^0-9]/g, '') || '—',
    alliance: String(player.alliance || '').trim() || '—',
    rank: rankCode(player.rank),
    shkTier: shkTier(player.shk),
    role: String(player.role || 'player').toLowerCase(),
    country: String(player.countryCode || player.country || inheritedCountry || '—').trim().toUpperCase() || '—'
  };
}
function extractEntries(publicPlayer = {}) {
  if (!publicPlayer || publicPlayer.profileComplete === false) return [];
  const country = publicPlayer.countryCode || publicPlayer.country || '';
  const entries = [entryFromPlayer(publicPlayer, false, country)];
  const farms = Array.isArray(publicPlayer.farms) ? publicPlayer.farms : [];
  farms.forEach(farm => {
    if (farm && (farm.nickname || farm.region || farm.alliance)) entries.push(entryFromPlayer(farm, true, country));
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
  inc(summary.rolesWithFarms, entry.role, delta);
  inc(summary.countriesWithFarms, entry.country, delta);
  if (isLeader(entry.role)) summary.leadersWithFarms += delta;
  if (!farm) {
    inc(summary.regions, entry.region, delta);
    inc(summary.alliances, entry.alliance, delta);
    inc(summary.ranks, entry.rank, delta);
    inc(summary.shkTiers, entry.shkTier, delta);
    inc(summary.roles, entry.role, delta);
    inc(summary.countries, entry.country, delta);
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
  for (const key of ['regions', 'regionsWithFarms', 'alliances', 'alliancesWithFarms', 'ranks', 'ranksWithFarms', 'shkTiers', 'shkTiersWithFarms', 'roles', 'rolesWithFarms', 'countries', 'countriesWithFarms']) {
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

function buildSummaryFromPublicPlayers(publicPlayers = [], extra = {}) {
  const summary = emptySummary({ source: 'cloudflare-d1-public-stats', lastFullRebuildDate: todayUtc(), ...extra });
  const rows = Array.isArray(publicPlayers) ? publicPlayers : [];
  rows.forEach(player => {
    const entries = extractEntries(player);
    const hiddenFarmCount = hiddenFarmCountForPlayer(player, entries);
    applyEntries(summary, entries, +1);
    applyHiddenFarmCount(summary, hiddenFarmCount, +1);
  });
  return normalizeSummary(summary);
}

async function fetchPublicStatsFromD1() {
  if (!PUBLIC_STATS_EXPORT_URL) return null;
  const response = await fetch(PUBLIC_STATS_EXPORT_URL, {
    headers: {
      Accept: 'application/json',
      ...(PUBLIC_STATS_EXPORT_SECRET ? { 'X-WKD-Stats-Secret': PUBLIC_STATS_EXPORT_SECRET } : {})
    }
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `public-stats-export-${response.status}`);
  }
  const publicPlayers = dedupePublicPlayers(Array.isArray(data?.players) ? data.players.filter(player => player && player.profileComplete !== false && player.publicKey && player.nickname) : []);
  const summary = buildSummaryFromPublicPlayers(publicPlayers, {
    source: data?.source || 'cloudflare-d1-public-stats',
    d1Version: data?.d1Version || null,
    d1UpdatedAtMs: data?.d1UpdatedAtMs || 0,
    d1Buckets: data?.buckets || 0
  });
  return { summary, publicPlayers };
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
  let source = 'publicPlayers';
  let publicSnap = await db.collection('publicPlayers').get();
  let sourcePlayers = publicSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Якщо publicPlayers ще не зібрався або зіпсувався, безпечно відновлюємо його з users.
  // У public JSON все одно піде тільки очищений набір полів без email/uid/photo/messages/logs.
  let previewRows = sourcePlayers.map(player => sanitizePlayerForPublic(player.id || player.uid, player)).filter(Boolean);
  if (!previewRows.length) {
    const usersSnap = await db.collection('users').get();
    sourcePlayers = usersSnap.docs.map(doc => makePublicPlayerFromUserDoc(doc.id, doc.data())).filter(Boolean);
    source = 'users-fallback';
  }

  const publicIds = new Set(sourcePlayers.map(player => String(player.uid || player.id || '').trim()).filter(Boolean));
  const operations = [];
  const publicPlayers = [];

  sourcePlayers.forEach(player => {
    const playerKey = String(player.uid || player.id || '').trim();
    if (!playerKey) return;
    const entries = extractEntries(player);
    const hiddenFarmCount = hiddenFarmCountForPlayer(player, entries);
    applyEntries(summary, entries, +1);
    applyHiddenFarmCount(summary, hiddenFarmCount, +1);
    const publicRow = sanitizePlayerForPublic(playerKey, player);
    if (publicRow) publicPlayers.push(publicRow);

    if (source === 'users-fallback') {
      operations.push(batch => batch.set(db.collection('publicPlayers').doc(playerKey), player, { merge: true }));
    }
    operations.push(batch => batch.set(db.collection('statsIndex').doc(playerKey), {
      playerKey,
      publicKey: publicKeyFor(playerKey),
      uid: playerKey,
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
    source,
    totalPlayers: summary.totalPlayers,
    totalRows: summary.totalRows,
    publicPlayers: publicPlayers.length
  }, { merge: true });
  info(`Full rebuild source=${source}; sourceDocs=${sourcePlayers.length}; publicRows=${publicPlayers.length}; totalPlayers=${summary.totalPlayers}; totalFarms=${summary.totalFarms}`);
  return { summary: normalizeSummary(summary), publicPlayers: sortPublicPlayers(publicPlayers) };
}

async function incrementalUpdate(db, existing, existingPlayers = []) {
  const changesSnap = await db.collection('statsChanges')
    .where('processed', '==', false)
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
  if (PUBLIC_STATS_EXPORT_URL) {
    const result = await fetchPublicStatsFromD1();
    const saved = await writePublicStatsFiles(result.summary, result.publicPlayers);
    info(`Stats cache updated from D1: players=${saved.summary.totalPlayers}, farms=${saved.summary.totalFarms}, publicRows=${saved.publicPlayers.length}, farmRows=${saved.publicFarms.length}, buckets=${saved.summary.d1Buckets || 0}`);
    return;
  }

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
      info(`No pending stats changes. Cache unchanged. cachedPlayers=${Array.isArray(existingPlayers) ? existingPlayers.length : 0}, totalPlayers=${Number(existing?.totalPlayers || 0)}`);
      return;
    }
    summary = result.summary;
    publicPlayers = result.publicPlayers;
  }
  publicPlayers = dedupePublicPlayers(publicPlayers);
  const saved = await writePublicStatsFiles(summary, publicPlayers);
  const cleaned = await cleanupOldChanges(db).catch(() => 0);
  info(`Stats cache updated: players=${saved.summary.totalPlayers}, farms=${saved.summary.totalFarms}, publicRows=${saved.publicPlayers.length}, farmRows=${saved.publicFarms.length}, cleanedChanges=${cleaned}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
