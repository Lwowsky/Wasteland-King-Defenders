import { formatUserDate, roleLabel } from '../services/user-db.js';
import { troopLabel } from '../services/region-db.js?v=076';
import { localizedCountry } from '../services/country-utils.js';

const $ = selector => document.querySelector(selector);
let players = [];
let statsSummaryCache = null;
let detailsLoaded = false;
let allianceColorCache = new Map();
let sortState = { key: 'region', dir: 'asc' };
let statsReady = false;
let activeModalPlayer = null;
let activeModalTab = 'profile';
const STATS_FILTER_STATE_KEY = 'wkd.publicStats.filters.v252';
let statsFarms = [];
let statsFarmsLoaded = false;
let statsVersionInfo = null;
let detailsLoadingPromise = null;
let farmsLoadingPromise = null;

function t(key, fallback = '') {
  const value = window.WKD_t ? window.WKD_t(key) : '';
  return (!value || value === key) ? (fallback || key) : value;
}
function tv(key, fallback = '', vars = {}) {
  let text = t(key, fallback);
  Object.entries(vars).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
  return text;
}
function locale() {
  const lang = window.WKD_CURRENT_LANG || document.documentElement.lang || navigator.language || 'en';
  const map = { uk: 'uk-UA', en: 'en-US', ru: 'ru-RU', pl: 'pl-PL', de: 'de-DE', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR', vi: 'vi-VN', ar: 'ar' };
  return map[String(lang).toLowerCase()] || lang || 'en-US';
}



const STATS_CACHE_BUILD = 'v289-static-farms-modal-snapshot';
const PUBLIC_STATS_SUMMARY_FILE = 'stats-summary.json';
const PUBLIC_STATS_PLAYERS_FILE = 'stats-players.json';
const PUBLIC_STATS_FARMS_FILE = 'stats-farms.json';
const PUBLIC_STATS_VERSION_FILE = 'stats-version.json';
const STATS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const STATS_REFRESH_WINDOW_MS = 10 * 60 * 1000;
const STATS_REFRESH_LIMIT = 3;
const STATS_STALE_MS = 24 * 60 * 60 * 1000;
const STATS_SUMMARY_CACHE_KEY = `wkd.publicStatsSummary.${STATS_CACHE_BUILD}`;
const STATS_PLAYERS_CACHE_KEY = `wkd.publicStatsPlayers.${STATS_CACHE_BUILD}`;
const STATS_FARMS_CACHE_KEY = `wkd.publicStatsFarms.${STATS_CACHE_BUILD}`;
const STATS_VERSION_CACHE_KEY = `wkd.publicStatsVersion.${STATS_CACHE_BUILD}`;
const STATS_REFRESH_HISTORY_KEY = `wkd.publicStatsRefreshHistory.${STATS_CACHE_BUILD}`;

function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(text); } catch { return fallback; }
}
function cacheRead(key, maxAgeMs = STATS_CACHE_TTL_MS) {
  const record = safeJsonParse(localStorage.getItem(key), null);
  if (!record || typeof record !== 'object') return null;
  const savedAt = Number(record.savedAt || 0);
  if (!savedAt || Date.now() - savedAt > maxAgeMs) return null;
  if (statsVersionInfo?.version && record.version && String(record.version) !== String(statsVersionInfo.version)) return null;
  return record.data ?? null;
}
function cacheWrite(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({
      build: STATS_CACHE_BUILD,
      version: statsVersionInfo?.version || null,
      savedAt: Date.now(),
      data
    }));
  } catch (error) {
    console.warn('[WKD] stats cache write failed:', error);
  }
}
function clearStatsLocalCache() {
  [STATS_SUMMARY_CACHE_KEY, STATS_PLAYERS_CACHE_KEY, STATS_FARMS_CACHE_KEY, STATS_VERSION_CACHE_KEY].forEach(key => localStorage.removeItem(key));
  Object.keys(localStorage).filter(key => key.startsWith('wkd.publicStats') && !key.includes(STATS_CACHE_BUILD)).forEach(key => localStorage.removeItem(key));
}
function publicStatsVersionToken() {
  const raw = statsVersionInfo?.version || statsVersionInfo?.generatedAt || statsVersionInfo?.updatedAt || '';
  return String(raw || '').replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 80);
}
function publicCacheUrls(file, force = false) {
  const clean = String(file || '').replace(/^\/+/, '');
  const versionToken = clean === PUBLIC_STATS_VERSION_FILE ? '' : publicStatsVersionToken();
  const suffix = force ? `?t=${Date.now()}` : (versionToken ? `?v=${encodeURIComponent(versionToken)}` : '');
  const basePath = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
  return [...new Set([
    `${location.origin}/public-cache/${clean}${suffix}`,
    `${basePath}public-cache/${clean}${suffix}`,
    `public-cache/${clean}${suffix}`
  ])];
}
async function fetchPublicCacheJson(file, { force = false } = {}) {
  let lastError = null;
  for (const url of publicCacheUrls(file, force)) {
    try {
      const isVersionFile = String(file || '') === PUBLIC_STATS_VERSION_FILE;
      const response = await fetch(url, { cache: force || isVersionFile ? 'no-store' : 'force-cache' });
      if (!response.ok) throw new Error(`${file}-${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`${file}-unavailable`);
}
function readSummaryCache() { return cacheRead(STATS_SUMMARY_CACHE_KEY); }
function writeSummaryCache(data) { cacheWrite(STATS_SUMMARY_CACHE_KEY, data); }
function readPlayersCache() { return cacheRead(STATS_PLAYERS_CACHE_KEY); }
function writePlayersCache(data) { cacheWrite(STATS_PLAYERS_CACHE_KEY, data); }
function readFarmsCache() { return cacheRead(STATS_FARMS_CACHE_KEY); }
function writeFarmsCache(data) { cacheWrite(STATS_FARMS_CACHE_KEY, data); }
function readVersionCache() { return cacheRead(STATS_VERSION_CACHE_KEY, STATS_CACHE_TTL_MS); }
function writeVersionCache(data) { cacheWrite(STATS_VERSION_CACHE_KEY, data); }
function mapSize(value) {
  return value && typeof value === 'object' ? Object.keys(value).filter(key => Number(value[key]) > 0).length : 0;
}
function summaryNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}
function formatSummaryUpdatedAt(value) {
  if (!value) return t('common.unknown', 'Unknown');
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(locale()) : String(value);
}

function statsSnapshotGeneratedAtMs(summary = statsSummaryCache) {
  const raw = summary?.generatedAt || summary?.updatedAt || summary?.d1UpdatedAtMs || summary?.lastFullRebuildDate || '';
  if (!raw) return 0;
  if (typeof raw === 'number') return Number(raw) || 0;
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : 0;
}
function isStatsSnapshotStale(summary = statsSummaryCache) {
  const generatedAt = statsSnapshotGeneratedAtMs(summary);
  return Boolean(generatedAt && Date.now() - generatedAt > STATS_STALE_MS);
}
function setStatsSnapshotLoadedStatus() {
  const updatedValue = statsSummaryCache?.generatedAt || statsSummaryCache?.updatedAt || statsSummaryCache?.d1UpdatedAtMs || statsSummaryCache?.lastFullRebuildDate;
  const date = formatSummaryUpdatedAt(updatedValue);
  if (isStatsSnapshotStale(statsSummaryCache)) {
    setStatus(tv('stats.snapshotStale', 'Увага: public-cache snapshot застарілий. Останнє оновлення: {date}. Дані можуть не збігатися з адмінкою, поки не спрацює export.', { date }), 'warning');
    return;
  }
  setStatus(tv('stats.snapshotLoaded', 'Список гравців завантажено з public-cache snapshot. Гравців: {count}. Оновлено: {date}.', {
    count: players.length,
    date
  }), 'success');
}
async function fetchPublicStatsVersion({ force = false } = {}) {
  try {
    const data = await fetchPublicCacheJson(PUBLIC_STATS_VERSION_FILE, { force: true });
    writeVersionCache(data);
    return data;
  } catch (error) {
    const cached = readVersionCache();
    if (cached) return cached;
    console.warn('[WKD] stats-version.json unavailable, using direct cache files:', error);
    return null;
  }
}
async function fetchPublicStatsSummary({ force = false } = {}) {
  if (!force) {
    const cached = readSummaryCache();
    if (cached) return cached;
  }
  const data = await fetchPublicCacheJson(PUBLIC_STATS_SUMMARY_FILE, { force });
  writeSummaryCache(data);
  return data;
}
async function fetchPublicStatsPlayers({ force = false } = {}) {
  if (!force) {
    const cached = readPlayersCache();
    if (cached) return cached;
  }
  const data = await fetchPublicCacheJson(PUBLIC_STATS_PLAYERS_FILE, { force });
  const list = dedupePublicPlayersList(Array.isArray(data) ? data : []);
  writePlayersCache(list);
  return list;
}
async function fetchPublicStatsFarms({ force = false } = {}) {
  if (!force) {
    const cached = readFarmsCache();
    if (cached) return cached;
  }
  const data = await fetchPublicCacheJson(PUBLIC_STATS_FARMS_FILE, { force });
  const list = Array.isArray(data) ? data.filter(farm => farm && (farm.ownerPublicKey || farm.publicKey) && farm.nickname) : [];
  writeFarmsCache(list);
  return list;
}
function manualRefreshAllowed() {
  const now = Date.now();
  const history = safeJsonParse(localStorage.getItem(STATS_REFRESH_HISTORY_KEY), []) || [];
  const fresh = history.filter(time => now - Number(time || 0) < STATS_REFRESH_WINDOW_MS);
  if (fresh.length >= STATS_REFRESH_LIMIT) {
    const waitMs = STATS_REFRESH_WINDOW_MS - (now - Number(fresh[0] || now));
    const waitMinutes = Math.max(1, Math.ceil(waitMs / 60000));
    setStatus(tv('stats.refreshLimited', 'Cache refresh limit reached. Try again in {minutes} min.', { minutes: waitMinutes }), 'warning');
    return false;
  }
  fresh.push(now);
  localStorage.setItem(STATS_REFRESH_HISTORY_KEY, JSON.stringify(fresh));
  return true;
}
function attachStatsFarmsToPlayers(farmRows = statsFarms) {
  const byOwner = new Map();
  (Array.isArray(farmRows) ? farmRows : []).forEach(farm => {
    const ownerKey = String(farm.ownerPublicKey || farm.publicKey || farm.uid || '').trim();
    if (!ownerKey) return;
    if (!byOwner.has(ownerKey)) byOwner.set(ownerKey, []);
    byOwner.get(ownerKey).push({ ...farm, farmKey: farm.farmKey || farm.farmId || farm.id || `farm-${byOwner.get(ownerKey).length + 1}` });
  });
  players = players.map(player => {
    const key = String(player.publicKey || player.uid || player.id || '').trim();
    const farms = byOwner.get(key) || [];
    const existingFarms = Array.isArray(player.farms) ? player.farms : [];
    if (!farms.length) {
      return {
        ...player,
        farms: existingFarms,
        profileVisibility: { ...(player.profileVisibility || {}), showFarmsInfo: Boolean(player.profileVisibility?.showFarmsInfo) }
      };
    }
    return {
      ...player,
      farms,
      farmCount: Math.max(Number(player.farmCount || 0), existingFarms.length, farms.length),
      profileVisibility: { ...(player.profileVisibility || {}), showFarmsInfo: true }
    };
  });
}
async function ensureFarmsLoaded({ force = false } = {}) {
  if (statsFarmsLoaded && !force) return statsFarms;
  if (farmsLoadingPromise && !force) return farmsLoadingPromise;
  farmsLoadingPromise = (async () => {
    statsFarms = await fetchPublicStatsFarms({ force });
    statsFarmsLoaded = true;
    attachStatsFarmsToPlayers(statsFarms);
    return statsFarms;
  })();
  try {
    return await farmsLoadingPromise;
  } finally {
    farmsLoadingPromise = null;
  }
}


function playerIdentityKey(player = {}) {
  return [player.nickname || player.gameNick || '', player.region || '', player.alliance || '']
    .map(value => String(value || '').trim().toLowerCase())
    .join('|');
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
  const key = String(player.publicKey || player.uid || player.id || '').trim();
  if (key) return `key:${key}`;
  return `identity:${playerIdentityKey(player)}`;
}

function dedupePublicPlayersList(list = []) {
  const map = new Map();
  (Array.isArray(list) ? list : []).forEach(player => {
    if (!player || !player.nickname) return;
    const key = publicPlayerDedupeKey(player);
    const existing = map.get(key);
    if (!existing || publicPlayerUpdatedAtMs(player) >= publicPlayerUpdatedAtMs(existing)) {
      map.set(key, player);
    }
  });
  return [...map.values()];
}

function mergeLivePublicPlayer(livePlayer = null) {
  if (!livePlayer?.nickname) return false;
  const liveKey = playerIdentityKey(livePlayer);
  const index = players.findIndex(item => {
    if (item.uid && livePlayer.uid && item.uid === livePlayer.uid) return true;
    return playerIdentityKey(item) === liveKey;
  });
  const merged = index >= 0
    ? { ...players[index], ...livePlayer, publicKey: players[index].publicKey || players[index].uid || livePlayer.publicKey || livePlayer.uid || liveKey }
    : { ...livePlayer, publicKey: livePlayer.publicKey || livePlayer.uid || liveKey };
  if (index >= 0) players[index] = merged;
  else players.unshift(merged);
  return true;
}

function isStaticPublicStatsMode() { return true; }


function hasUsableStatsSummary(summary = {}) {
  if (!summary || typeof summary !== 'object') return false;
  const generated = Boolean(summary.generatedAt || summary.updatedAt || summary.lastFullRebuildDate);
  const total = Number(summary.totalRows ?? summary.totalPlayers ?? 0) || 0;
  return generated || total > 0;
}
function isPublicStatsJsonEmpty(summary = {}, publicPlayers = []) {
  const total = Number(summary?.totalRows ?? summary?.totalPlayers ?? 0) || 0;
  const listCount = Array.isArray(publicPlayers) ? publicPlayers.length : 0;
  return total <= 0 && listCount <= 0 && !hasUsableStatsSummary(summary);
}
function isPublicPlayersJsonMissing(summary = {}, publicPlayers = []) {
  const total = Number(summary?.totalRows ?? summary?.totalPlayers ?? 0) || 0;
  const listCount = Array.isArray(publicPlayers) ? publicPlayers.length : 0;
  return total > 0 && listCount <= 0;
}
function renderSummaryStats(summary = statsSummaryCache) {
  if (!hasUsableStatsSummary(summary)) return false;
  setPlayersCounterLabel();
  const includeFarms = includeFarmRows();
  const values = includeFarms
    ? [
        summaryNumber(summary.totalRows ?? (summary.totalPlayers + summary.totalFarms)),
        mapSize(summary.regionsWithFarms || summary.regions),
        mapSize(summary.alliancesWithFarms || summary.alliances),
        summaryNumber(summary.leadersWithFarms ?? summary.leaders)
      ]
    : [
        summaryNumber(summary.totalPlayers),
        mapSize(summary.regions),
        mapSize(summary.alliances),
        summaryNumber(summary.leaders)
      ];
  $('#publicStats')?.querySelectorAll('.admin-stat-card b').forEach((card, index) => { card.textContent = values[index] ?? 0; });
  const updated = formatSummaryUpdatedAt(summary.generatedAt || summary.updatedAt);
  const mode = includeFarms ? t('stats.playersAndFarms', 'Players and farms') : t('stats.players', 'Players');
  setSummary(tv('stats.publicCacheSummary', '{mode}: {count}. Updated: {updated}', { mode, count: values[0], updated }));
  return true;
}
function renderListMessage(text) {
  const body = $('#publicPlayersBody');
  if (!body) return;
  body.innerHTML = `<tr><td colspan="8" class="stats-empty-note">${escapeHtml(text)}</td></tr>`;
}

function renderListLoading() {
  renderListMessage(t('stats.loadingPlayers', 'Loading players...'));
}

function updateLoadListButtonState() {
  // v216: the public list is loaded automatically. This function is kept as a no-op
  // so older markup or browser caches do not break the page while the new files roll out.
}

async function ensurePlayersLoaded({ force = false } = {}) {
  if (detailsLoaded && !force) return players;
  if (detailsLoadingPromise && !force) return detailsLoadingPromise;
  detailsLoadingPromise = (async () => {
    updateLoadListButtonState(true);
    setStatus(t('stats.loadingPlayers', 'Loading players...'), 'muted');
    const publicPlayers = await fetchPublicStatsPlayers({ force });
    players = dedupePublicPlayersList(Array.isArray(publicPlayers) ? publicPlayers : []);
    detailsLoaded = true;
    const farmRowsVisible = includeFarmRows();
    if (farmRowsVisible) setStatus(t('stats.loadingFarms', 'Loading farm statistics...'), 'muted');
    await ensureFarmsLoaded({ force }).catch(error => {
      console.warn('[WKD] stats farms not loaded:', error);
      if (farmRowsVisible) setStatus(t('stats.farmsLoadFailed', 'Farm statistics are unavailable. Try Refresh cache.'), 'warning');
    });
    renderStats();
    renderPlayers();
    if (isPublicPlayersJsonMissing(statsSummaryCache, publicPlayers)) {
      setStatus(t('stats.playersJsonMismatch', 'stats-summary.json has numbers, but stats-players.json is empty. Replace the local public-cache with the latest generated JSON files.'), 'warning');
      return players;
    }
    setStatsSnapshotLoadedStatus();
    return players;
  })();
  try {
    return await detailsLoadingPromise;
  } finally {
    detailsLoadingPromise = null;
    updateLoadListButtonState(false);
  }
}

async function loadSummaryOnly(options = {}) {
  const force = Boolean(options?.force);
  const shouldReloadDetails = options?.loadDetails !== false;
  if (force) {
    if (!manualRefreshAllowed()) return;
    clearStatsLocalCache();
    detailsLoaded = false;
    players = [];
    statsFarmsLoaded = false;
    statsFarms = [];
  }
  updateLoadListButtonState(false);
  setStatus(t('stats.loadingSummary', 'Loading public statistics cache...'), 'muted');
  try {
    statsVersionInfo = await fetchPublicStatsVersion({ force });
    const summary = await fetchPublicStatsSummary({ force });
    statsSummaryCache = hasUsableStatsSummary(summary) ? summary : null;
    renderStats();
    renderPlayers();
    if (isPublicStatsJsonEmpty(summary, [])) {
      setSummary(t('stats.cacheEmpty', 'Public JSON cache is empty. Check or replace public-cache/stats-players.json.'));
      setStatus(t('stats.cacheEmpty', 'Public JSON cache is empty. Check or replace public-cache/stats-players.json.'), 'warning');
      return;
    }
    setStatus(t('stats.loadingPlayers', 'Loading players...'), 'muted');
    if (shouldReloadDetails) {
      renderListLoading();
      try {
        await ensurePlayersLoaded({ force });
      } catch (error) {
        console.warn('[WKD] stats players load failed:', error);
        renderListMessage(t('stats.playersLoadFailed', 'Player list is unavailable. Try Refresh cache.'));
        setStatus(t('stats.playersLoadFailed', 'Player list is unavailable. Try Refresh cache.'), 'warning');
      }
    }
  } catch (error) {
    console.warn('[WKD] public stats JSON failed:', error);
    statsSummaryCache = null;
    detailsLoaded = false;
    players = [];
    renderStats();
    renderListLoading();
    setStatus(t('stats.cacheFailed', 'Public statistics JSON files are not available. Check public-cache/stats-summary.json and stats-players.json.'), 'error');
  }
}

function allianceTag3(value) { return window.WKD?.allianceTag3 ? window.WKD.allianceTag3(value) : Array.from(String(value ?? '').trim().replace(/[\/\[\]#?]/g, '')).slice(0, 3).join(''); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}


function normTag(value) { return String(value || '').trim(); }
function normRegion(value) { return String(value || '').trim().replace(/[^0-9]/g, ''); }
function hashHue(value) {
  const text = String(value || 'empty');
  let hash = 2166136261;
  for (const ch of text) { hash ^= ch.codePointAt(0) || 0; hash = Math.imul(hash, 16777619) >>> 0; }
  return hash % 360;
}
function allianceHue(region, alliance) {
  const key = `${normRegion(region)}:${normTag(alliance)}`;
  const custom = allianceColorCache.get(key);
  return Number.isFinite(custom) ? custom : ((hashHue(alliance) % 360) + 360) % 360;
}
function allianceBadge(region, alliance) { const tag = normTag(alliance) || '—'; const hue = allianceHue(region, tag); return window.WKD?.Badges?.alliance ? window.WKD.Badges.alliance(tag, { hue, region }) : `<span class="alliance-badge"><span>${escapeHtml(tag)}</span></span>`; }

function rankCode(value) {
  if (window.WKD?.Badges?.rankCode) return window.WKD.Badges.rankCode(value);
  const match = String(value || 'P1').trim().toUpperCase().match(/[PRР]\s*([1-5])/i);
  return match ? `P${match[1]}` : 'P1';
}
function rankBadge(value, { profile = false } = {}) { return window.WKD?.Badges?.rank ? window.WKD.Badges.rank(value) : `<span class="rank-badge">${escapeHtml(rankCode(value))}</span>`; }
function shkBadge(value, { profile = false } = {}) { return window.WKD?.Badges?.shk ? window.WKD.Badges.shk(value) : `<span class="shk-badge">${escapeHtml(value || '—')}</span>`; }

function extraInfoItemsHtml(wasteland = null) {
  if (!wasteland) return '';
  return `${textLine(t('stats.lairLevel', 'Lair level'), wasteland.lairLevel)}
    ${textLine(t('playerEdit.troopType', 'Troop type'), troopLabel(wasteland.troopType || ''))}
    ${textLine(t('playerEdit.tier', 'Tier'), wasteland.tier)}
    ${textLine(t('playerEdit.march', 'March size'), formatNumber(wasteland.marchSize))}
    ${textLine(t('playerEdit.rally', 'Rally size'), formatNumber(wasteland.rallySize))}`;
}
function setStatus(text, type = 'muted') {
  const box = $('#statsStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}

function setSummary(text) {
  const box = $('#statsSummary');
  if (box) box.textContent = text;
}

function includeFarmRows() {
  return Boolean($('#statsIncludeFarmsToggle')?.checked);
}

function mainNick(player = {}) {
  return player.nickname || player.gameNick || '—';
}

function farmRowsForPlayer(player = {}) {
  if (!includeFarmRows() || !player.profileVisibility?.showFarmsInfo || !Array.isArray(player.farms)) return [];
  const main = mainNick(player);
  return player.farms
    .filter(farm => farm && (farm.nickname || farm.region || farm.alliance))
    .map((farm, index) => ({
      ...farm,
      uid: player.publicKey || player.uid || player.id || '',
      publicKey: player.publicKey || '',
      rowId: `${player.publicKey || player.uid || player.id || 'player'}::${farm.farmKey || farm.farmId || farm.id || index}`,
      isFarmRow: true,
      mainNickname: main,
      mainRegion: player.region || '',
      farmIndex: index,
      farmId: farm.farmId || farm.id || '',
      country: player.country || '',
      countryCode: player.countryCode || '',
      photoURL: player.photoURL || '',
      createdAt: player.createdAt || null,
      updatedAt: player.updatedAt || null,
      profileVisibility: player.profileVisibility || {},
      farmCount: player.farmCount ?? 0
    }));
}

function displayRows() {
  return players.flatMap(player => [{
    ...player,
    rowId: player.publicKey || player.uid || player.id || '',
    isFarmRow: false,
    mainNickname: mainNick(player)
  }, ...farmRowsForPlayer(player)]);
}

function sortValue(player, key) {
  if (key === 'createdAt') return player.createdAt?.toMillis?.() || 0;
  if (key === 'farmCount') return Number(player.farmCount || 0);
  if (key === 'accountType') return player.isFarmRow ? 'farm' : 'main';
  return player[key] ?? '';
}

function sortPlayers(a, b) {
  const dir = sortState.dir === 'asc' ? 1 : -1;
  return String(sortValue(a, sortState.key)).localeCompare(String(sortValue(b, sortState.key)), locale(), { numeric: true }) * dir;
}

function filteredPlayers() {
  const nick = String($('#statsNickSearch')?.value || '').trim().toLowerCase();
  const alliance = String($('#statsAllianceSearch')?.value || '').trim();
  const region = String($('#statsRegionSearch')?.value || '').trim().toLowerCase();
  const role = $('#statsRoleFilter')?.value || 'all';
  const rows = $('#statsRowsFilter')?.value || '10';
  const visible = displayRows()
    .filter(player => role === 'all' || (player.role || 'player') === role)
    .filter(player => {
      const userNick = String(player.nickname || player.gameNick || '').toLowerCase();
      const main = String(player.mainNickname || '').toLowerCase();
      const userAlliance = String(player.alliance || '').trim();
      const userRegion = String(player.region || '').toLowerCase();
      // Nick search is case-insensitive. Alliance filter is case-sensitive: WWW, www and WwW are different alliances.
      return (!nick || userNick.includes(nick) || main.includes(nick))
        && (!alliance || userAlliance.includes(alliance))
        && (!region || userRegion.includes(region));
    })
    .sort(sortPlayers);
  if (rows === 'all') return visible;
  return visible.slice(0, Number(rows) || 10);
}

function setPlayersCounterLabel() {
  const label = $('#publicStats .admin-stat-card:first-child span');
  if (!label) return;
  const key = includeFarmRows() ? 'stats.playersAndFarms' : 'stats.players';
  label.dataset.i18n = key;
  label.textContent = t(key, includeFarmRows() ? 'Players and farms' : 'Players');
}

function renderStats() {
  if (statsSummaryCache && renderSummaryStats(statsSummaryCache)) return;
  setPlayersCounterLabel();
  const rows = displayRows();
  const regions = new Set(rows.map(player => player.region).filter(Boolean));
  const alliances = new Set(rows.map(player => player.alliance).filter(Boolean));
  const leaders = rows.filter(player => ['admin', 'moderator', 'consul', 'officer'].includes(player.role)).length;
  const values = [rows.length, regions.size, alliances.size, leaders];
  $('#publicStats')?.querySelectorAll('.admin-stat-card b').forEach((card, index) => { card.textContent = values[index] ?? 0; });
  setSummary(tv(includeFarmRows() ? 'stats.summaryRows' : 'stats.summaryPlayers', includeFarmRows() ? '{count} rows' : '{count} players', { count: rows.length }));
}

function rowTemplate(player) {
  const nick = player.nickname || player.gameNick || '—';
  const uid = player.publicKey || player.uid || player.id || player.rowId || '';
  const isFarm = Boolean(player.isFarmRow);
  const labels = {
    nickname: escapeHtml(t('account.nickname', 'Nickname')),
    region: escapeHtml(t('account.region', 'Region')),
    farms: escapeHtml(t('stats.farmsCount', 'Farms')),
    alliance: escapeHtml(t('account.alliance', 'Alliance')),
    rank: escapeHtml(t('account.rank', 'Rank')),
    shk: escapeHtml(t('account.shk', 'HQ')),
    role: escapeHtml(t('account.role', 'Role')),
    registered: escapeHtml(t('stats.registeredAt', 'Registered'))
  };
  const subLine = isFarm
    ? `${t('account.farm', 'Farm')} · ${t('account.mainPlayer', 'Main player')}: ${player.mainNickname || '—'}`
    : (includeFarmRows() ? `${t('account.mainPlayer', 'Main player')} · ${tv('stats.farmCountShort', '{count} farms', { count: player.farmCount ?? 0 })}` : '');
  return `<tr class="${isFarm ? 'is-farm-row' : 'is-main-row'}">
    <td data-label="${labels.nickname}"><button class="stats-player-link" type="button" data-player-id="${escapeHtml(uid)}" data-farm-row="${isFarm ? '1' : '0'}" data-farm-index="${isFarm ? escapeHtml(String(player.farmIndex ?? 0)) : ''}"><strong>${escapeHtml(nick)}</strong>${subLine ? `<small class="${isFarm ? 'stats-farm-owner' : ''}">${escapeHtml(subLine)}</small>` : ''}</button></td>
    <td data-label="${labels.region}"><span class="region-badge">${escapeHtml(player.region || '—')}</span></td>
    <td data-label="${labels.farms}"><span class="farm-count-badge">${escapeHtml(isFarm ? t('account.farm', 'Farm') : (player.farmCount ?? 0))}</span></td>
    <td data-label="${labels.alliance}">${allianceBadge(player.region, player.alliance)}</td>
    <td data-label="${labels.rank}">${rankBadge(player.rank)}</td>
    <td data-label="${labels.shk}">${shkBadge(player.shk)}</td>
    <td data-label="${labels.role}"><span class="role-badge role-${escapeHtml(player.role || 'player')}">${escapeHtml(roleLabel(player.role || 'player'))}</span></td>
    <td data-label="${labels.registered}">${formatUserDate(player.createdAt)}</td>
  </tr>`;
}

function renderPlayers() {
  const body = $('#publicPlayersBody');
  if (!body) return;
  if (!detailsLoaded) {
    renderListLoading();
    return;
  }
  const visible = filteredPlayers();
  if (!visible.length) {
    body.innerHTML = `<tr><td colspan="8">${escapeHtml(t('stats.noPlayersFound', 'No players found.'))}</td></tr>`;
    return;
  }
  body.innerHTML = visible.map(rowTemplate).join('');
}

function textLine(label, value) {
  return `<div class="stats-info-line"><span>${escapeHtml(label)}</span><b>${escapeHtml(value || '—')}</b></div>`;
}

function formatNumber(value) {
  const number = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) && number > 0 ? number.toLocaleString(locale()) : (value || '—');
}

function extraInfoHtml(wasteland = null) {
  if (!wasteland) {
    return `<div class="stats-empty-note">${escapeHtml(t('stats.extraHidden', 'The player hid extra region-form information.'))}</div>`;
  }
  return `<div class="stats-info-grid">${extraInfoItemsHtml(wasteland)}</div>`;
}

function profilePanel(player) {
  return `<section class="stats-modal-panel is-active" data-stats-panel="profile">
    <div class="stats-profile-card">
      <img src="${escapeHtml(player.photoURL || 'img/logo.webp')}" alt="Avatar" />
      <div class="stats-profile-main">
        <h3>${escapeHtml(player.nickname || player.gameNick || '—')}</h3>
        <div class="stats-profile-badges">
          ${rankBadge(player.rank, { profile: true })}
          ${shkBadge(player.shk, { profile: true })}
          <span class="role-badge role-${escapeHtml(player.role || 'player')}">${escapeHtml(roleLabel(player.role || 'player'))}</span>
        </div>
      </div>
    </div>
    <div class="stats-info-grid">
      ${textLine(t('account.region', 'Region'), player.region)}
      ${textLine(t('account.country', 'Country'), localizedCountry(player.country || '', player.countryCode || ''))}
      ${textLine(t('account.alliance', 'Alliance'), player.alliance)}
      ${textLine(t('account.rank', 'Rank'), String(player.rank || '').toUpperCase())}
      ${textLine(t('account.shk', 'HQ'), player.shk)}
      ${textLine(t('stats.farmsCount', 'Farms'), player.farmCount ?? 0)}
      ${textLine(t('stats.registeredAt', 'Registered'), formatUserDate(player.createdAt))}
      ${textLine(t('stats.updatedAt', 'Updated'), formatUserDate(player.updatedAt))}
    </div>
  </section>`;
}

function extraPanel(player) {
  return `<section class="stats-modal-panel" data-stats-panel="extra" hidden>
    <h3>${escapeHtml(t('stats.extraInfo', 'Extra information'))}</h3>
    ${extraInfoHtml(player.wastelandProfile)}
  </section>`;
}

function farmCard(farm, index, showExtra) {
  const role = farm.role || 'player';
  const waste = farm.wastelandProfile || {};
  const meta = [farm.alliance, farm.rank ? String(farm.rank).toUpperCase() : '', farm.shk ? `${t('account.shk', 'HQ')} ${farm.shk}` : ''].filter(Boolean).join(' · ');
  return `<article class="stats-farm-card" data-stats-farm-index="${index}">
    <div class="stats-farm-head">
      <div class="stats-farm-title"><b>${escapeHtml(farm.nickname || `${t('stats.farm', 'Farm')} ${index + 1}`)}</b>${meta ? `<span>${escapeHtml(meta)}</span>` : ''}</div>
      <span class="role-badge stats-farm-role role-${escapeHtml(role)}">${escapeHtml(roleLabel(role))}</span>
    </div>
    <div class="stats-info-grid stats-farm-short-grid ${showExtra ? '' : 'is-single'}">
      ${textLine(t('account.region', 'Region'), farm.region ? `R${farm.region}` : '—')}
      ${showExtra ? extraInfoItemsHtml(farm.wastelandProfile) : ''}
    </div>
  </article>`;
}

function farmsPanel(player) {
  const farms = Array.isArray(player.farms) ? player.farms : [];
  const showFarms = Boolean(player.profileVisibility?.showFarmsInfo);
  const showExtra = Boolean(player.profileVisibility?.showWastelandInfo);
  const content = showFarms && farms.length
    ? farms.map((farm, index) => farmCard(farm, index, showExtra)).join('')
    : `<div class="stats-empty-note">${escapeHtml(tv('stats.farmsHidden', 'The player hid farm information. Farm count: {count}.', { count: player.farmCount ?? 0 }))}</div>`;
  return `<section class="stats-modal-panel" data-stats-panel="farms" hidden>
    <h3>${escapeHtml(t('stats.accountFarms', 'Account farms'))}</h3>
    ${content}
  </section>`;
}

function activateModalTab(tab = 'profile') {
  activeModalTab = tab;
  document.querySelectorAll('.stats-modal-tab').forEach(button => {
    const active = button.dataset.statsTab === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-stats-panel]').forEach(panel => {
    const active = panel.dataset.statsPanel === tab;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  });
}

function openPlayerModal(player, tab = 'profile', farmIndex = -1) {
  activeModalPlayer = player;
  const modal = $('#playerStatsModal');
  const body = $('#playerStatsModalBody');
  if (!modal || !body) return;
  if (!statsFarmsLoaded && Number(player?.farmCount || 0) > 0) {
    ensureFarmsLoaded().then(() => {
      const key = String(player.publicKey || player.uid || player.id || '').trim();
      const refreshed = players.find(item => String(item.publicKey || item.uid || item.id || '').trim() === key) || player;
      if (activeModalPlayer && key && String(activeModalPlayer.publicKey || activeModalPlayer.uid || activeModalPlayer.id || '').trim() === key) openPlayerModal(refreshed, tab, farmIndex);
    }).catch(error => console.warn('[WKD] stats modal farms refresh failed:', error));
  }
  $('#playerStatsModalTitle').textContent = player.nickname || player.gameNick || t('stats.modalTitle', 'Профіль гравця');
  $('#playerStatsModalLead').textContent = tv('stats.regionLine', 'Region {region} · {alliance} · {rank}', { region: player.region || '—', alliance: player.alliance || '—', rank: String(player.rank || '').toUpperCase() || '—' });
  const roleBadge = $('#playerStatsModalRole');
  if (roleBadge) {
    roleBadge.removeAttribute('data-i18n');
    roleBadge.textContent = roleLabel(player.role || 'player');
    roleBadge.className = `role-badge role-${player.role || 'player'}`;
  }
  body.innerHTML = profilePanel(player) + extraPanel(player) + farmsPanel(player);
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  activateModalTab(tab);
  if (tab === 'farms' && Number(farmIndex) >= 0) {
    window.setTimeout(() => {
      const card = body.querySelector(`[data-stats-farm-index="${Number(farmIndex)}"]`);
      card?.classList.add('is-target-farm');
      card?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }, 60);
  }
}

function closePlayerModal() {
  const modal = $('#playerStatsModal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  activeModalPlayer = null;
}


function readStatsFilterState() {
  try { return JSON.parse(localStorage.getItem(STATS_FILTER_STATE_KEY) || '{}') || {}; } catch { return {}; }
}
function writeStatsFilterState() {
  try {
    localStorage.setItem(STATS_FILTER_STATE_KEY, JSON.stringify({
      nick: $('#statsNickSearch')?.value || '',
      alliance: $('#statsAllianceSearch')?.value || '',
      region: $('#statsRegionSearch')?.value || '',
      role: $('#statsRoleFilter')?.value || 'all',
      rows: $('#statsRowsFilter')?.value || '10',
      includeFarms: Boolean($('#statsIncludeFarmsToggle')?.checked)
    }));
  } catch {}
}
function restoreStatsFilterState() {
  const state = readStatsFilterState();
  if ($('#statsNickSearch')) $('#statsNickSearch').value = state.nick || '';
  if ($('#statsAllianceSearch')) $('#statsAllianceSearch').value = state.alliance || '';
  if ($('#statsRegionSearch')) $('#statsRegionSearch').value = state.region || '';
  if ($('#statsRoleFilter')) $('#statsRoleFilter').value = state.role || 'all';
  if ($('#statsRowsFilter')) $('#statsRowsFilter').value = state.rows || '10';
  if ($('#statsIncludeFarmsToggle')) $('#statsIncludeFarmsToggle').checked = Boolean(state.includeFarms);
}
function bindControls() {
  $('#refreshStatsBtn')?.addEventListener('click', () => loadSummaryOnly({ force: true, loadDetails: true }));
  const loadThenRender = () => {
    writeStatsFilterState();
    if (!detailsLoaded) {
      ensurePlayersLoaded().catch(error => {
        console.warn('[WKD] stats players load failed:', error);
        setStatus(t('stats.playersLoadFailed', 'Player list is unavailable. Try Refresh cache.'), 'warning');
        renderListLoading();
      });
      return;
    }
    renderPlayers();
  };
  $('#statsNickSearch')?.addEventListener('input', loadThenRender);
  $('#statsAllianceSearch')?.addEventListener('input', loadThenRender);
  $('#statsRegionSearch')?.addEventListener('input', loadThenRender);
  $('#statsRoleFilter')?.addEventListener('change', loadThenRender);
  $('#statsRowsFilter')?.addEventListener('change', loadThenRender);
  $('#statsIncludeFarmsToggle')?.addEventListener('change', async () => {
    writeStatsFilterState();
    if (includeFarmRows()) {
      if (!detailsLoaded) {
        await ensurePlayersLoaded().catch(error => {
          console.warn('[WKD] stats players load failed:', error);
          setStatus(t('stats.playersLoadFailed', 'Player list is unavailable. Try Refresh cache.'), 'warning');
        });
      }
      setStatus(t('stats.loadingFarms', 'Loading farm statistics...'), 'muted');
      await ensureFarmsLoaded().catch(error => {
        console.warn('[WKD] stats farms load failed:', error);
        setStatus(t('stats.farmsLoadFailed', 'Farm statistics are unavailable. Try Refresh cache.'), 'warning');
      });
    }
    renderStats();
    renderPlayers();
  });
  $('#publicPlayersBody')?.addEventListener('click', event => {
    const button = event.target.closest('[data-player-id]');
    if (!button) return;
    const player = players.find(item => (item.publicKey || item.uid || item.id || '') === button.dataset.playerId);
    if (player) openPlayerModal(player, button.dataset.farmRow === '1' ? 'farms' : 'profile', button.dataset.farmIndex || -1);
  });
  document.querySelectorAll('#publicPlayersTable [data-sort]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.sort;
    sortState = { key, dir: sortState.key === key && sortState.dir === 'asc' ? 'desc' : 'asc' };
    loadThenRender();
  }));
  document.querySelectorAll('[data-close-stats-modal]').forEach(button => button.addEventListener('click', closePlayerModal));
  document.querySelectorAll('.stats-modal-tab').forEach(button => button.addEventListener('click', () => activateModalTab(button.dataset.statsTab)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeModalPlayer) closePlayerModal();
  });
}

async function initStatsPage() {
  if (statsReady || !$('#publicPlayersBody')) return;
  statsReady = true;
  restoreStatsFilterState();
  bindControls();
  await loadSummaryOnly().catch(error => {
    console.error(error);
    setStatus(t('stats.loadFailed', 'Could not load statistics. Try again.'), 'error');
  });
}

document.addEventListener('wkd:partials-ready', initStatsPage);
document.addEventListener('DOMContentLoaded', () => setTimeout(initStatsPage, 0));

document.addEventListener('wkd:language-changed', () => {
  if (!statsReady) return;
  renderStats();
  renderPlayers();
  if (activeModalPlayer) openPlayerModal(activeModalPlayer);
});
