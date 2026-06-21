import { watchAuth } from '../services/firebase-service.js';
import {
  canUseStaffPanel,
  canStaffEditPlayer,
  getGameProfile,
  getUserFarms,
  getUserProfile,
  listStaffRegionPlayers,
  roleLabel,
  resolvePublicPlayerUidForEdit,
  staffRankOptionsForTarget,
  staffRoleOptionsForTarget,
  updateRegionPlayerByStaff
} from '../services/user-db.js?v=019';

const $ = selector => document.querySelector(selector);
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : fallback;
function tv(key, fallback = '', vars = {}) {
  let text = t(key, fallback);
  Object.entries(vars || {}).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
  return text;
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'": '&#39;' }[char]));
const normalizeRegion = value => String(value || '').replace(/[^0-9]/g, '');
const normalizeAlliance = value => String(value || '').trim().toUpperCase().slice(0, 3);
const normalizeRank = value => String(value || 'p1').trim().toLowerCase();
const STAFF_CACHE_TTL_MS = 30 * 60 * 1000;
const STAFF_REFRESH_WINDOW_MS = 10 * 60 * 1000;
const STAFF_REFRESH_LIMIT = 5;
const STAFF_CACHE_BUILD = 'v043-staff-edit-rights';

const STAFF_PUBLIC_STATS_PLAYERS_FILE = 'stats-players.json';
const STAFF_PUBLIC_STATS_FARMS_FILE = 'stats-farms.json';
const STAFF_PUBLIC_STATS_VERSION_FILE = 'stats-version.json';
let staffPublicStatsVersionInfo = null;

function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(text); } catch { return fallback; }
}
function staffPublicCacheUrls(file, force = false) {
  const clean = String(file || '').replace(/^\/+/, '');
  const suffix = force ? `?t=${Date.now()}` : '';
  const basePath = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
  return [...new Set([
    `${location.origin}/public-cache/${clean}${suffix}`,
    `${basePath}public-cache/${clean}${suffix}`,
    `public-cache/${clean}${suffix}`
  ])];
}
async function fetchStaffPublicCacheJson(file, { force = false } = {}) {
  let lastError = null;
  for (const url of staffPublicCacheUrls(file, force)) {
    try {
      const response = await fetch(url, { cache: force ? 'no-store' : 'force-cache' });
      if (!response.ok) throw new Error(`${file}-${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`${file}-unavailable`);
}
async function fetchStaffPublicStatsVersion({ force = false } = {}) {
  try {
    const version = await fetchStaffPublicCacheJson(STAFF_PUBLIC_STATS_VERSION_FILE, { force });
    staffPublicStatsVersionInfo = version || null;
    return version || null;
  } catch (error) {
    console.warn('[WKD] staff stats-version unavailable:', error?.message || error);
    staffPublicStatsVersionInfo = null;
    return null;
  }
}
async function fetchStaffPublicStatsPlayers({ force = false } = {}) {
  const list = await fetchStaffPublicCacheJson(STAFF_PUBLIC_STATS_PLAYERS_FILE, { force });
  return Array.isArray(list) ? list : [];
}
async function fetchStaffPublicStatsFarms({ force = false } = {}) {
  const list = await fetchStaffPublicCacheJson(STAFF_PUBLIC_STATS_FARMS_FILE, { force });
  return Array.isArray(list) ? list : [];
}
function staffRowTime(row = {}) {
  const raw = row.updatedAt || row.createdAt || row.lastLoginAt || 0;
  if (typeof raw === 'number') return raw;
  if (raw && typeof raw.toMillis === 'function') return raw.toMillis();
  if (raw && typeof raw.seconds === 'number') return raw.seconds * 1000;
  const parsed = Date.parse(String(raw || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
function staffGameIdentityKey(row = {}) {
  const normalized = normalizeStaffSnapshotRow(row);
  const farmId = String(normalized.farmId || '').trim().toLowerCase();
  const nickname = String(normalized.nickname || normalized.gameNick || '').trim().toLowerCase();
  const region = normalizeRegion(normalized.region || '');
  const alliance = normalizeAlliance(normalized.alliance || '').toLowerCase();
  // The public JSON has publicKey, but the editable region mirror has uid.
  // For the same main player these keys differ, so the stable identity must be the game identity.
  if (nickname && region && alliance) return `game:${region}|${alliance}|${nickname}|${farmId && farmId !== 'main' ? farmId : 'main'}`;
  const uid = String(normalized.uid || normalized.id || '').trim();
  if (uid) return `uid:${uid}`;
  const publicKey = String(normalized.publicKey || '').trim();
  if (publicKey) return `public:${publicKey}`;
  return `fallback:${nickname || 'player'}|${region}|${alliance}|${farmId || 'main'}`;
}
function mergeStaffRows(primary = [], secondary = []) {
  const map = new Map();
  [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])].forEach(row => {
    if (!row) return;
    const normalized = normalizeStaffSnapshotRow(row);
    if (!normalized.nickname && !normalized.gameNick) return;
    const key = staffGameIdentityKey(normalized);
    const existing = map.get(key);
    const preferEditable = !existing || (!existing.uid && normalized.uid);
    const preferNewest = staffRowTime(normalized) >= staffRowTime(existing || {});
    if (preferEditable || (!existing?.uid && preferNewest) || (existing?.__publicSnapshotOnly && !normalized.__publicSnapshotOnly)) {
      const merged = { ...(existing || {}), ...normalized };
      // Keep owner/farm metadata from public-cache when a self/editable mirror row wins.
      merged.ownerPublicKey = merged.ownerPublicKey || existing?.ownerPublicKey || normalized.ownerPublicKey || '';
      merged.ownerNickname = merged.ownerNickname || existing?.ownerNickname || existing?.mainNickname || existing?.ownerName || normalized.ownerNickname || normalized.mainNickname || normalized.ownerName || '';
      merged.mainNickname = merged.mainNickname || existing?.mainNickname || existing?.ownerNickname || normalized.mainNickname || normalized.ownerNickname || '';
      merged.ownerName = merged.ownerName || existing?.ownerName || normalized.ownerName || '';
      merged.farmKey = merged.farmKey || existing?.farmKey || normalized.farmKey || '';
      merged.isFarm = Boolean(merged.isFarm || existing?.isFarm || normalized.isFarm);
      merged.__isFarm = Boolean(merged.__isFarm || existing?.__isFarm || normalized.__isFarm);
      merged.farmCount = merged.farmCount ?? existing?.farmCount ?? normalized.farmCount ?? existing?.farmsCount ?? normalized.farmsCount;
      merged.farmsCount = merged.farmsCount ?? existing?.farmsCount ?? normalized.farmsCount ?? existing?.farmCount ?? normalized.farmCount;
      map.set(key, merged);
    } else if (existing) {
      // Keep the editable/mirror row, but enrich it with public-cache farm owner fields.
      // The editable mirror may not contain ownerNickname/ownerPublicKey, while stats-farms.json does.
      map.set(key, {
        ...existing,
        ownerPublicKey: existing.ownerPublicKey || normalized.ownerPublicKey || '',
        ownerNickname: existing.ownerNickname || normalized.ownerNickname || normalized.mainNickname || normalized.ownerName || '',
        mainNickname: existing.mainNickname || normalized.mainNickname || normalized.ownerNickname || '',
        ownerName: existing.ownerName || normalized.ownerName || '',
        farmKey: existing.farmKey || normalized.farmKey || '',
        isFarm: Boolean(existing.isFarm || normalized.isFarm),
        __isFarm: Boolean(existing.__isFarm || normalized.__isFarm),
        publicKey: existing.publicKey || normalized.publicKey || normalized.ownerPublicKey || '',
        farmCount: existing.farmCount ?? normalized.farmCount ?? existing.farmsCount ?? normalized.farmsCount,
        farmsCount: existing.farmsCount ?? normalized.farmsCount ?? existing.farmCount ?? normalized.farmCount
      });
    }
  });
  return [...map.values()].sort((a, b) => staffRowTime(b) - staffRowTime(a));
}

function dedupeStaffRowsHard(rows = []) {
  return mergeStaffRows([], Array.isArray(rows) ? rows : []);
}


const STAFF_TABS = {
  players: { labelKey: 'staff.playersTitle', label: 'Гравці регіону' },
  'region-table': { labelKey: 'region.table', label: 'Таблиця регіону' },
  'region-settings': { labelKey: 'region.settings', label: 'Форма регіону' },
  'action-log': { labelKey: 'actionLog.title', label: 'Журнал дій' }
};

function badge(name, value, fallback = '') {
  const badges = window.WKD?.Badges || {};
  if (typeof badges[name] === 'function') return badges[name](value);
  return fallback || esc(value || '—');
}

const STAFF_TOOL_MODULES = {
  'region-table': './region-table-page.js?v=043',
  'region-settings': './region-settings-page.js?v=043',
  'action-log': './action-log-page.js?v=019'
};
const loadedStaffToolTabs = new Set();

async function loadStaffToolTab(tab) {
  const path = STAFF_TOOL_MODULES[tab];
  if (!path || loadedStaffToolTabs.has(tab)) return;
  loadedStaffToolTabs.add(tab);
  try {
    await import(path);
  } catch (error) {
    loadedStaffToolTabs.delete(tab);
    console.error('[WKD] staff tab module failed:', tab, error);
    const panel = document.querySelector(`[data-staff-panel="${tab}"]`);
    const status = panel?.querySelector('.auth-status');
    if (status) {
      status.textContent = t('staff.tabLoadFailed', 'Не вдалося відкрити вкладку.');
      status.dataset.type = 'error';
    }
  }
}


function switchStaffTab(tab = 'players') {
  const safeTab = STAFF_TABS[tab] ? tab : 'players';
  document.querySelectorAll('[data-staff-tab]').forEach(button => {
    const active = button.dataset.staffTab === safeTab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('[data-staff-panel]').forEach(panel => {
    const active = panel.dataset.staffPanel === safeTab;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
  if (safeTab !== 'players') loadStaffToolTab(safeTab);
}

function injectStaffDrawerTabs() {
  document.querySelectorAll('.staff-drawer-tabs').forEach(node => node.remove());
}


let ready = false;

function revealGuardedStaffPage() {
  document.body.classList.remove('access-guard-pending');
}
function denyGuardedStaffPage() {
  window.location.replace('404.html?private=1');
}
let currentUser = null;
let currentProfile = null;
let staffSnapshotRows = [];
let currentRows = [];
let editRow = null;

function actorGames(profile = {}) {
  const main = { ...getGameProfile(profile), farmId: 'main', role: profile.role || getGameProfile(profile).role || 'player' };
  return [main, ...getUserFarms(profile)].filter(game => normalizeRegion(game.region));
}

function setStatus(message, type = 'muted') {
  const el = $('#staffStatus');
  if (!el) return;
  // This element has data-i18n in HTML for the initial text only.
  // Once runtime status is set, remove i18n attributes so language refreshes
  // do not overwrite "access confirmed / load failed" back to "loading access".
  el.removeAttribute('data-i18n');
  el.removeAttribute('data-i18n-placeholder');
  el.textContent = message;
  el.className = `auth-status ${type ? `is-${type}` : ''}`;
}

function fillRegionSelect() {
  const select = $('#staffRegionSelect');
  if (!select) return;
  const regions = [...new Set(actorGames(currentProfile || {}).map(game => normalizeRegion(game.region)).filter(Boolean))];
  select.innerHTML = regions.map(region => `<option value="${esc(region)}">R${esc(region)}</option>`).join('');
}

function scopeBadge() {
  const region = $('#staffRegionSelect')?.value || normalizeRegion(getGameProfile(currentProfile || {}).region);
  const game = actorGames(currentProfile || {}).find(item => normalizeRegion(item.region) === region) || actorGames(currentProfile || {})[0] || {};
  const role = currentProfile?.role === 'admin' || currentProfile?.role === 'moderator' ? currentProfile.role : (game.role || currentProfile?.role || 'player');
  const rank = String(game.rank || currentProfile?.rank || '').toUpperCase();
  const alliance = normalizeAlliance(game.alliance);
  const text = [`R${region || '—'}`, alliance, roleLabel(role), rank].filter(Boolean).join(' · ');
  if ($('#staffScopeBadge')) $('#staffScopeBadge').textContent = text || '—';
}


function staffScopeForRegion(region = '') {
  const safeRegion = normalizeRegion(region || $('#staffRegionSelect')?.value || '');
  const games = actorGames(currentProfile || {});
  const game = games.find(item => normalizeRegion(item.region) === safeRegion) || games[0] || {};
  const profileRole = String(currentProfile?.role || 'player').toLowerCase();
  const role = ['admin', 'moderator'].includes(profileRole) ? profileRole : String(game.role || profileRole || 'player').toLowerCase();
  const global = ['admin', 'moderator'].includes(profileRole);
  const consul = role === 'consul';
  const alliance = normalizeAlliance(game.alliance || currentProfile?.alliance || '');
  return { region: safeRegion, role, alliance, global, consul, allianceLocked: !global && !consul };
}
function syncAllianceLockForStaff(region = '') {
  const input = $('#staffAllianceFilter');
  if (!input) return staffScopeForRegion(region);
  const scope = staffScopeForRegion(region);
  if (scope.allianceLocked) {
    input.value = scope.alliance || input.value || '';
    input.disabled = true;
  } else {
    input.disabled = false;
  }
  return scope;
}


function staffCacheKey(region = '') {
  return `wkd.staff.regionRows.${STAFF_CACHE_BUILD}.${normalizeRegion(region) || 'none'}`;
}
function readStaffRowsCache(region = '', expectedVersion = '') {
  try {
    const raw = localStorage.getItem(staffCacheKey(region));
    const data = raw ? safeJsonParse(raw, null) : null;
    if (!data || data.build !== STAFF_CACHE_BUILD) return null;
    if (Date.now() - Number(data.savedAtMs || 0) > STAFF_CACHE_TTL_MS) return null;
    if (normalizeRegion(data.region) !== normalizeRegion(region)) return null;
    const cachedVersion = String(data.version || data.meta?.version || '');
    if (expectedVersion && cachedVersion !== String(expectedVersion)) return null;
    return Array.isArray(data.rows) ? data : null;
  } catch {
    return null;
  }
}
function writeStaffRowsCache(region = '', rows = [], meta = {}) {
  try {
    const version = String(meta?.version || staffPublicStatsVersionInfo?.version || staffPublicStatsVersionInfo?.updatedAt || '');
    localStorage.setItem(staffCacheKey(region), JSON.stringify({
      build: STAFF_CACHE_BUILD,
      version,
      region: normalizeRegion(region),
      savedAtMs: Date.now(),
      rows: Array.isArray(rows) ? rows.slice(0, 2000) : [],
      meta: { ...(meta || {}), version }
    }));
  } catch {}
}
function refreshHistoryKey(region = '') {
  return `wkd.staff.refreshHistory.${STAFF_CACHE_BUILD}.${normalizeRegion(region) || 'none'}`;
}
function manualStaffRefreshAllowed(region = '') {
  const key = refreshHistoryKey(region);
  let history = [];
  try { history = JSON.parse(localStorage.getItem(key) || '[]'); } catch { history = []; }
  const now = Date.now();
  history = (Array.isArray(history) ? history : []).filter(time => now - Number(time) < STAFF_REFRESH_WINDOW_MS);
  if (history.length >= STAFF_REFRESH_LIMIT) {
    try { localStorage.setItem(key, JSON.stringify(history)); } catch {}
    return false;
  }
  history.push(now);
  try { localStorage.setItem(key, JSON.stringify(history)); } catch {}
  return true;
}
function normalizeStaffSnapshotRow(row = {}) {
  const rawFarmId = row.farmId || row.farmKey || '';
  const farmId = String(rawFarmId).trim();
  const isFarm = Boolean(row.isFarm || row.__isFarm || row.ownerPublicKey || row.ownerNickname || row.farmKey || (farmId && farmId !== 'main'));
  const publicKey = String(row.publicKey || row.ownerPublicKey || '').trim();
  const publicOnly = Boolean(row.__publicSnapshotOnly || (!row.uid && publicKey));
  const uid = publicOnly ? String(row.uid || '').trim() : String(row.uid || row.id || '').trim();
  const nickname = row.nickname || row.gameNick || row.name || '';
  const id = uid || (farmId ? `${publicKey || row.ownerNickname || 'farm'}:${farmId}` : publicKey) || `${nickname || 'player'}-${row.alliance || ''}-${farmId || 'main'}`;
  const wasteland = row.wastelandProfile || {};
  return {
    ...row,
    id,
    uid,
    publicKey,
    farmId: farmId || (isFarm ? '' : 'main'),
    isFarm,
    ownerNickname: row.ownerNickname || row.ownerName || '',
    __publicSnapshotOnly: publicOnly || !uid,
    nickname,
    region: normalizeRegion(row.region || ''),
    alliance: normalizeAlliance(row.alliance || ''),
    rank: normalizeRank(row.rank || 'p1'),
    shk: row.shk || '',
    role: row.role || 'player',
    troopType: row.troopType || wasteland.troopType || '',
    tier: row.tier || wasteland.tier || '',
    marchSize: row.marchSize || wasteland.marchSize || '',
    rallySize: row.rallySize || wasteland.rallySize || '',
    captainReady: Boolean(row.captainReady ?? wasteland.captainReady),
    shift: row.shift || wasteland.shift || ''
  };
}
function staffOwnProfileRows(region = '') {
  const safeRegion = normalizeRegion(region);
  if (!safeRegion || !currentProfile) return [];
  return actorGames(currentProfile)
    .filter(game => normalizeRegion(game.region) === safeRegion)
    .map(game => normalizeStaffSnapshotRow({
      ...game,
      uid: currentProfile.uid || currentUser?.uid || '',
      id: game.farmId && game.farmId !== 'main' ? `${currentProfile.uid || currentUser?.uid || 'self'}:${game.farmId}` : (currentProfile.uid || currentUser?.uid || ''),
      publicKey: currentProfile.publicKey || '',
      ownerPublicKey: game.farmId && game.farmId !== 'main' ? (currentProfile.publicKey || '') : '',
      ownerNickname: game.farmId && game.farmId !== 'main' ? (currentProfile.nickname || currentProfile.displayName || '') : '',
      farmId: game.farmId || 'main',
      nickname: game.nickname || currentProfile.nickname || currentProfile.displayName || '',
      region: game.region,
      alliance: game.alliance,
      rank: game.rank || currentProfile.rank || 'p1',
      shk: game.shk || currentProfile.shk || '',
      role: game.role || currentProfile.role || 'player',
      __selfProfileFallback: true
    }));
}
function staffFilterValues() {
  return {
    region: $('#staffRegionSelect')?.value || '',
    alliance: $('#staffAllianceFilter')?.value || '',
    nick: $('#staffNickFilter')?.value || '',
    rank: $('#staffRankFilter')?.value || 'all',
    includeFarms: Boolean($('#staffIncludeFarmsToggle')?.checked)
  };
}
function staffOwnerMainRow(row = {}, rows = staffSnapshotRows) {
  if (!row?.isFarm) return null;
  const ownerKey = String(row.ownerPublicKey || '').trim();
  const ownerNick = String(row.ownerNickname || row.mainNickname || row.ownerName || '').trim().toLowerCase();
  if (!ownerKey && !ownerNick) return null;
  return dedupeStaffRowsHard(rows).find(item => {
    if (!item || item.isFarm) return false;
    const publicKey = String(item.publicKey || '').trim();
    const nick = String(item.nickname || item.gameNick || '').trim().toLowerCase();
    return (ownerKey && publicKey && ownerKey === publicKey) || (ownerNick && nick && ownerNick === nick);
  }) || null;
}
function staffOwnerMainRegion(row = {}) {
  return normalizeRegion(staffOwnerMainRow(row)?.region || '');
}
function staffRowVisibleForRegion(row = {}, safeRegion = '', includeFarms = false) {
  const rowRegion = normalizeRegion(row.region || '');
  if (rowRegion === safeRegion) {
    if (!row.isFarm || includeFarms) return true;
    const ownerRegion = staffOwnerMainRegion(row);
    // Without the checkbox, show farms only when they represent another-region player in this region.
    return !ownerRegion || ownerRegion !== safeRegion;
  }
  return Boolean(includeFarms && isStaffLinkedOwnerForRegion(row, safeRegion));
}
function isStaffLinkedOwnerForRegion(row = {}, region = '') {
  const safeRegion = normalizeRegion(region);
  if (!safeRegion || row.isFarm) return false;
  const publicKey = String(row.publicKey || '').trim();
  const nickname = String(row.nickname || row.gameNick || '').trim().toLowerCase();
  return dedupeStaffRowsHard(staffSnapshotRows).some(item => {
    if (!item?.isFarm || normalizeRegion(item.region) !== safeRegion) return false;
    const ownerKey = String(item.ownerPublicKey || '').trim();
    const ownerNick = String(item.ownerNickname || item.mainNickname || '').trim().toLowerCase();
    return (publicKey && ownerKey && ownerKey === publicKey) || (nickname && ownerNick && ownerNick === nickname);
  });
}
function applyLocalStaffFilters({ statusMessage = '' } = {}) {
  const { region, alliance, nick, rank, includeFarms } = staffFilterValues();
  const safeRegion = normalizeRegion(region);
  const scope = syncAllianceLockForStaff(region);
  const nickFilter = String(nick || '').trim().toLowerCase();
  const rankFilter = String(rank || '').trim().toLowerCase();
  const allianceFilter = scope.allianceLocked ? scope.alliance : normalizeAlliance(alliance || '');
  let rows = dedupeStaffRowsHard(staffSnapshotRows).filter(row => !row.deleted && !row.blocked);
  rows = rows.filter(row => staffRowVisibleForRegion(row, safeRegion, includeFarms));
  if (allianceFilter) rows = rows.filter(row => normalizeAlliance(row.alliance) === allianceFilter || (includeFarms && !scope.allianceLocked && isStaffLinkedOwnerForRegion(row, safeRegion)));
  if (nickFilter) rows = rows.filter(row => String(row.nickname || row.gameNick || '').toLowerCase().includes(nickFilter));
  if (rankFilter && rankFilter !== 'all') rows = rows.filter(row => normalizeRank(row.rank || '') === rankFilter);
  rows.sort((a, b) => staffRowTime(b) - staffRowTime(a) || String(a.nickname || a.gameNick || '').localeCompare(String(b.nickname || b.gameNick || ''), undefined, { sensitivity: 'base' }));
  currentRows = rows;
  renderRows();
  scopeBadge();
  if (statusMessage) setStatus(statusMessage, 'success');
}
async function readStaffPublicSnapshotRows(region = '', { force = false } = {}) {
  const safeRegion = normalizeRegion(region);
  const version = await fetchStaffPublicStatsVersion({ force }).catch(() => null);
  const [publicPlayers, publicFarms] = await Promise.all([
    fetchStaffPublicStatsPlayers({ force }).catch(() => []),
    fetchStaffPublicStatsFarms({ force }).catch(() => [])
  ]);
  const allPlayerRows = (Array.isArray(publicPlayers) ? publicPlayers : [])
    .map(row => normalizeStaffSnapshotRow({ ...row, farmId: row.farmId || 'main', __isFarm: false, __publicSnapshotOnly: true }));
  const farmRows = (Array.isArray(publicFarms) ? publicFarms : [])
    .map(row => normalizeStaffSnapshotRow({ ...row, farmId: row.farmId || row.farmKey || '', __isFarm: true, __publicSnapshotOnly: true }))
    .filter(row => normalizeRegion(row.region || safeRegion) === safeRegion || !row.region);
  const playerRows = allPlayerRows.filter(row => normalizeRegion(row.region || safeRegion) === safeRegion || !row.region);
  const ownerRows = allPlayerRows
    .filter(player => farmRows.some(farm => {
      const playerKey = String(player.publicKey || '').trim();
      const playerNick = String(player.nickname || player.gameNick || '').trim().toLowerCase();
      const ownerKey = String(farm.ownerPublicKey || '').trim();
      const ownerNick = String(farm.ownerNickname || farm.mainNickname || '').trim().toLowerCase();
      return (playerKey && ownerKey && playerKey === ownerKey) || (playerNick && ownerNick && playerNick === ownerNick);
    }))
    .map(row => normalizeStaffSnapshotRow({ ...row, __linkedOwnerContext: true, __publicSnapshotOnly: true }));
  const rows = mergeStaffRows(playerRows, [...farmRows, ...ownerRows]);
  return {
    source: 'public-cache/stats-players.json + stats-farms.json',
    version: String(version?.version || version?.updatedAt || ''),
    region: safeRegion,
    rows,
    totalRows: rows.length,
    reads: 0,
    publicPlayers: playerRows.length,
    publicFarms: farmRows.length
  };
}
async function readStaffRegionPlayerRows(region = '', { force = false } = {}) {
  const safeRegion = normalizeRegion(region);
  if (!safeRegion) return { rows: [], region: '', source: 'no-region', reads: 0 };
  let publicResult = null;
  let mirrorResult = null;

  try {
    publicResult = await readStaffPublicSnapshotRows(safeRegion, { force });
  } catch (error) {
    console.warn('[WKD] staff public snapshot unavailable:', error?.message || error);
  }

  // Normal opening uses public-cache only. Manual refresh may also try the editable
  // region profile mirror, but the refresh button is rate-limited.
  if (force || !publicResult?.rows?.length) {
    try {
      const scope = syncAllianceLockForStaff(safeRegion);
      const alliance = scope.allianceLocked ? scope.alliance : '';
      const result = await listStaffRegionPlayers({
        region: safeRegion,
        alliance,
        nick: '',
        rank: 'all',
        limitCount: 2000
      });
      const rows = (result.users || [])
        .map(row => normalizeStaffSnapshotRow({ ...row, __publicSnapshotOnly: false }))
        .filter(row => normalizeRegion(row.region || safeRegion) === safeRegion || !row.region);
      mirrorResult = {
        ...result,
        source: result.source || 'regions-players-profile-mirror',
        region: safeRegion,
        rows,
        totalRows: Number(result.totalRows || result.users?.length || rows.length || 0),
        reads: Number(result.reads || rows.length || 0)
      };
    } catch (error) {
      console.warn('[WKD] staff profile mirror unavailable:', error?.message || error);
    }
  }

  const ownRows = staffOwnProfileRows(safeRegion);
  const merged = mergeStaffRows(mirrorResult?.rows || [], mergeStaffRows(publicResult?.rows || [], ownRows));
  return {
    source: mirrorResult?.rows?.length
      ? 'regions-players-profile-mirror + public-cache'
      : (publicResult?.source || mirrorResult?.source || 'empty'),
    version: publicResult?.version || '',
    region: safeRegion,
    rows: merged,
    totalRows: merged.length,
    reads: Number(mirrorResult?.reads || 0),
    publicRows: Number(publicResult?.rows?.length || 0),
    publicFarms: Number(publicResult?.publicFarms || 0),
    mirrorRows: Number(mirrorResult?.rows?.length || 0),
    ownRows: ownRows.length
  };
}
async function loadRows(options = {}) {
  const force = Boolean(options?.force);
  setStatus(force ? t('staff.refreshingPlayers', 'Оновлюю список гравців...') : t('staff.loadingPlayers', 'Завантажую гравців регіону з public-cache snapshot...'), 'muted');
  const region = $('#staffRegionSelect')?.value || normalizeRegion(getGameProfile(currentProfile || {}).region);
  if (!region) {
    staffSnapshotRows = [];
    currentRows = [];
    renderRows();
    setStatus(t('staff.noRegion', 'Немає регіону для завантаження.'), 'warn');
    return;
  }
  if (force && !manualStaffRefreshAllowed(region)) {
    setStatus(t('staff.refreshLimited', 'Оновлення обмежено: максимум 5 разів за 10 хвилин для цього регіону.'), 'warn');
    return;
  }
  const version = await fetchStaffPublicStatsVersion({ force }).catch(() => null);
  const expectedVersion = String(version?.version || version?.updatedAt || '');
  const cached = !force ? readStaffRowsCache(region, expectedVersion) : null;
  if (cached?.rows?.length) {
    staffSnapshotRows = dedupeStaffRowsHard(cached.rows.map(normalizeStaffSnapshotRow));
    applyLocalStaffFilters({ statusMessage: tv('staff.loadedFromLocalCache', 'Гравці показані з локального кешу. Рядків: {count}.', { count: staffSnapshotRows.length }) });
    return;
  }
  setStatus(t('staff.loadingPlayers', 'Завантажую гравців регіону з public-cache snapshot...'), 'muted');
  try {
    const result = await readStaffRegionPlayerRows(region, { force });
    staffSnapshotRows = dedupeStaffRowsHard(result.rows || []);
    writeStaffRowsCache(region, staffSnapshotRows, {
      source: result.source || 'public-cache/stats-players.json',
      version: result.version || expectedVersion,
      totalRows: result.totalRows || staffSnapshotRows.length,
      publicRows: result.publicRows || 0,
      publicFarms: result.publicFarms || 0,
      mirrorRows: result.mirrorRows || 0,
      ownRows: result.ownRows || 0
    });
    const messageKey = result.reads ? 'staff.loadedRowsMerged' : 'staff.loadedRowsFromSnapshot';
    const fallback = result.reads
      ? 'Панель регіону готова: {count} гравців. Public-cache: {publicRows}. Firestore reads≈{reads}.'
      : 'Панель регіону готова: {count} гравців із public-cache. Firestore reads=0.';
    applyLocalStaffFilters({ statusMessage: tv(messageKey, fallback, {
      count: staffSnapshotRows.length,
      publicRows: result.publicRows || staffSnapshotRows.length || 0,
      reads: result.reads || 0
    }) });
  } catch (error) {
    console.error('[WKD] staff region players load failed:', error);
    const fallback = readStaffRowsCache(region);
    if (fallback?.rows?.length) {
      staffSnapshotRows = fallback.rows.map(normalizeStaffSnapshotRow);
      applyLocalStaffFilters({ statusMessage: t('staff.loadedFromLocalCache', 'Гравці показані з локального кешу.') });
      return;
    }
    staffSnapshotRows = [];
    currentRows = [];
    renderRows();
    setStatus(t('staff.loadFailed', 'Не вдалося завантажити список гравців регіону.'), 'error');
  }
}


function staffMainFarmCount(row = {}) {
  const direct = Number(row.farmCount ?? row.farmsCount ?? row.farms_count);
  if (Number.isFinite(direct) && direct >= 0) return direct;
  const publicKey = String(row.publicKey || '').trim();
  const nick = String(row.nickname || row.gameNick || '').trim().toLowerCase();
  return dedupeStaffRowsHard(staffSnapshotRows)
    .filter(item => item?.isFarm)
    .filter(item => {
      const ownerKey = String(item.ownerPublicKey || '').trim();
      const ownerNick = String(item.ownerNickname || item.mainNickname || '').trim().toLowerCase();
      return (publicKey && ownerKey && ownerKey === publicKey) || (nick && ownerNick && ownerNick === nick);
    }).length;
}
function staffOwnerNickname(row = {}) {
  const direct = String(row.ownerNickname || row.mainNickname || row.ownerName || '').trim();
  if (direct) return direct;
  const match = staffOwnerMainRow(row);
  if (match?.nickname || match?.gameNick) return String(match.nickname || match.gameNick).trim();
  const farmNick = String(row.nickname || row.gameNick || '').trim().toLowerCase();
  const linkedFarm = dedupeStaffRowsHard(staffSnapshotRows).find(item => {
    if (!item?.isFarm) return false;
    const nickname = String(item.nickname || item.gameNick || '').trim().toLowerCase();
    return farmNick && nickname === farmNick && (item.ownerNickname || item.mainNickname || item.ownerName);
  });
  return String(linkedFarm?.ownerNickname || linkedFarm?.mainNickname || linkedFarm?.ownerName || '').trim() || '—';
}
function staffNicknameSubline(row = {}) {
  if (row.isFarm) {
    return `${t('account.farm', 'Ферма')} · ${t('account.mainPlayer', 'Основний гравець')}: ${staffOwnerNickname(row)}`;
  }
  return `${t('account.mainPlayer', 'Основний гравець')} · ${tv('stats.farmCountShort', '{count} ферм', { count: staffMainFarmCount(row) })}`;
}

function renderRows() {
  const body = $('#staffPlayersBody');
  if (!body) return;
  if (!currentRows.length) {
    body.innerHTML = `<tr><td colspan="7">${esc(t('staff.empty', 'Гравців не знайдено.'))}</td></tr>`;
    return;
  }
  body.innerHTML = currentRows.map(row => {
    const canEdit = Boolean(canStaffEditPlayer(currentUser, currentProfile, row));
    const subLine = staffNicknameSubline(row);
    return `<tr class="${row.isFarm ? 'is-farm-row' : 'is-main-row'}">
      <td><strong>${esc(row.nickname || row.gameNick || '—')}</strong>${subLine ? `<small class="${row.isFarm ? 'staff-farm-owner' : ''}">${esc(subLine)}</small>` : ''}</td>
      <td>${badge('region', row.region || '—')}</td>
      <td>${badge('alliance', row.alliance || '—')}</td>
      <td>${badge('rank', row.rank || 'p1')}</td>
      <td>${badge('shk', row.shk || '')}</td>
      <td>${badge('role', row.role || 'player')}</td>
      <td>${canEdit ? `<button class="btn btn-sm" type="button" data-edit-staff="${esc(row.uid || row.id)}">${esc(t('common.edit', 'Редагувати'))}</button>` : `<span class="staff-no-action">${esc(t('staff.viewOnly', 'Перегляд'))}</span>`}</td>
    </tr>`;
  }).join('');
  body.querySelectorAll('[data-edit-staff]').forEach(button => {
    button.addEventListener('click', () => openEdit(button.dataset.editStaff));
  });
}

function openEdit(uid) {
  editRow = currentRows.find(row => String(row.uid || row.id) === String(uid));
  if (!editRow) return;
  $('#staffEditName').textContent = `${editRow.nickname || editRow.gameNick || uid} · ${editRow.alliance || '—'} · R${editRow.region || '—'}`;
  const rankOptions = staffRankOptionsForTarget(currentUser, currentProfile, editRow);
  const roleOptions = staffRoleOptionsForTarget(currentUser, currentProfile, editRow);
  const rankSelect = $('#staffEditRank');
  const roleSelect = $('#staffEditRole');
  if (rankSelect) {
    const currentRank = normalizeRank(editRow.rank);
    const options = rankOptions.includes(currentRank) ? rankOptions : [...rankOptions, currentRank];
    rankSelect.innerHTML = options.map(rank => `<option value="${esc(rank)}">${esc(rank.toUpperCase())}</option>`).join('');
    rankSelect.value = currentRank;
  }
  if (roleSelect) {
    const currentRole = editRow.role || 'player';
    const options = roleOptions.includes(currentRole) ? roleOptions : [currentRole];
    roleSelect.innerHTML = options.map(role => `<option value="${esc(role)}">${esc(roleLabel(role))}</option>`).join('');
    roleSelect.value = currentRole;
    roleSelect.disabled = options.length <= 1;
  }
  $('#staffEditModal').hidden = false;
}

function closeEdit() {
  editRow = null;
  $('#staffEditModal').hidden = true;
}

async function saveEdit() {
  if (!editRow) return;
  try {
    setStatus(t('staff.saving', 'Зберігаю зміни...'), 'muted');
    const editableUid = editRow.uid || await resolvePublicPlayerUidForEdit(editRow);
    if (!editableUid) throw new Error('public-player-not-found');
    await updateRegionPlayerByStaff(editableUid, {
      region: editRow.region,
      rank: $('#staffEditRank')?.value || editRow.rank || 'p1',
      role: $('#staffEditRole')?.value || editRow.role || 'player'
    });
    closeEdit();
    await loadRows();
    setStatus(t('staff.saved', 'Зміни збережено.'), 'success');
  } catch (error) {
    if (window.WKD_DEBUG) console.error('[WKD] staff save failed:', error);
    const code = String(error?.code || error?.message || '');
    const isTechnicalAccessCode = /permission-denied|region-update-access|row_owner_mismatch|access_denied|access-denied/i.test(code);
    const details = code && !code.includes('FirebaseError') && !isTechnicalAccessCode ? ` (${code})` : '';
    setStatus(`${t('staff.saveFailed', 'Не вдалося зберегти. Перевір права для цього гравця.')}${details}`, 'error');
  }
}

function bindControls() {
  document.querySelectorAll('[data-staff-tab]').forEach(button => {
    button.addEventListener('click', () => switchStaffTab(button.dataset.staffTab));
  });
  $('#staffRefreshBtn')?.addEventListener('click', () => loadRows({ force: true }));
  $('#staffRegionSelect')?.addEventListener('change', () => {
    const region = $('#staffRegionSelect')?.value || '';
    const scope = staffScopeForRegion(region);
    const allianceInput = $('#staffAllianceFilter');
    if (allianceInput) allianceInput.value = scope.allianceLocked ? scope.alliance : '';
    loadRows();
  });
  $('#staffAllianceFilter')?.addEventListener('change', () => applyLocalStaffFilters());
  $('#staffNickFilter')?.addEventListener('input', () => {
    clearTimeout(window.__wkdStaffSearchTimer);
    window.__wkdStaffSearchTimer = setTimeout(() => applyLocalStaffFilters(), 150);
  });
  $('#staffRankFilter')?.addEventListener('change', () => applyLocalStaffFilters());
  $('#staffIncludeFarmsToggle')?.addEventListener('change', () => applyLocalStaffFilters());
  $('#staffSaveEditBtn')?.addEventListener('click', saveEdit);
  document.querySelectorAll('[data-staff-close]').forEach(el => el.addEventListener('click', closeEdit));
}

async function initStaffPage() {
  if (ready || !$('#staffPlayersBody')) return;
  ready = true;
  bindControls();
  switchStaffTab('players');

  await watchAuth(async user => {
    currentUser = user;
    if (!user) {
      denyGuardedStaffPage();
      return;
    }
    currentProfile = await getUserProfile(user.uid).catch(() => null);
    if (!canUseStaffPanel(user, currentProfile)) {
      denyGuardedStaffPage();
      return;
    }
    revealGuardedStaffPage();
    setStatus(t('staff.accessConfirmed', 'Доступ підтверджено. Завантажую гравців...'), 'success');
    fillRegionSelect();
    scopeBadge();
    await loadRows().catch(error => {
      console.error('[WKD] staff load failed:', error);
      setStatus(t('staff.loadFailed', 'Не вдалося завантажити панель регіону.'), 'error');
    });
  });
}

document.addEventListener('wkd:partials-ready', () => {
  initStaffPage();
});
document.addEventListener('DOMContentLoaded', () => setTimeout(initStaffPage, 0));
document.addEventListener('wkd:language-changed', () => {
  document.querySelectorAll('.staff-drawer-tabs').forEach(node => node.remove());
  scopeBadge();
  renderRows();
});
