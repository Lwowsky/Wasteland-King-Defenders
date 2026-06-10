import { watchAuth } from '../services/firebase-service.js';
import { getUsageEstimate, resetUsageEstimate, getCloudflareUsageEstimate, resetCloudflareUsageEstimate } from '../services/usage-tracker.js?v=125';
import { cleanupD1Archives, scanD1Archives } from '../services/d1-archive-cleanup.js?v=125';
import { fetchRealCloudflareUsage } from '../services/cloudflare-usage.js?v=125';
import {
  approveRoleRequest,
  declineRoleRequest,
  ensureCurrentUserPublished,
  formatUserDate,
  getGameProfile,
  getUserFarms,
  assignableRolesForActor,
  canUseAdminPanel,
  getUserProfile,
  isOwnerUser,
  listRegisteredUsersPage,
  listRoleRequests,
  roleLabel,
  updateUserByAdmin,
  updateFarmByAdmin,
  scanOldFirebaseArchives,
  cleanupOldFirebaseArchives
} from '../services/user-db.js?v=125';
import {
  archiveManualRegion,
  cleanupOldPublicDocuments,
  createManualRegion,
  listRegionCatalog,
  normalizeRegion
} from '../services/region-db.js?v=125';

const $ = selector => document.querySelector(selector);
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const tv = (key, fallback = '', vars = {}) => {
  let text = t(key, fallback);
  Object.entries(vars).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
  return text;
};
function roleLabels() { return { admin: t('role.admin', 'Admin'), moderator: t('role.moderator', 'Moderator'), consul: t('role.consul', 'Consul'), officer: t('role.officer', 'Officer'), player: t('role.player', 'Player') }; }
const rankOptions = ['p1', 'p2', 'p3', 'p4', 'p5'];

let adminReady = false;
let currentUser = null;
let currentProfile = null;
let users = [];
let requests = [];
let regionsCatalog = [];
let adminStatsSummary = null;
let adminStatsPlayers = [];
let regionsLoaded = false;
let sortState = { key: 'createdAt', dir: 'desc' };
let editUid = null;
const ADMIN_PLAYERS_PAGE_SIZE = 10;
let playersPage = 1;
let playersCursorStack = [null];
let playersPageMeta = { hasNext: false, reads: 0, queryMode: 'indexed' };
let playerSearchDebounce = null;
let cloudflareRealUsage = null;
let cloudflareUsageLoading = false;

function allianceTag3(value) { return window.WKD?.allianceTag3 ? window.WKD.allianceTag3(value) : Array.from(String(value ?? '').trim().replace(/[\/\[\]#?]/g, '')).slice(0, 3).join(''); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function setStatus(text, type = 'muted') {
  const box = $('#adminStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}

function setSummary(text) {
  const box = $('#adminSummary');
  if (box) box.textContent = text;
}

function getRoleBadge(role) { return window.WKD?.Badges?.role ? window.WKD.Badges.role(role || 'player') : `<span class="role-badge role-${escapeHtml(role || 'player')}">${escapeHtml(roleLabel(role || 'player'))}</span>`; }

function rankCode(value) {
  if (window.WKD?.Badges?.rankCode) return window.WKD.Badges.rankCode(value);
  const match = String(value || 'P1').trim().toUpperCase().match(/[PRР]\s*([1-5])/i);
  return match ? `P${match[1]}` : 'P1';
}

function getRankBadge(rank) { return window.WKD?.Badges?.rank ? window.WKD.Badges.rank(rank) : `<span class="rank-badge">${escapeHtml(rankCode(rank))}</span>`; }

function getRegionBadge(region) { return window.WKD?.Badges?.region ? window.WKD.Badges.region(region) : `<span class="region-badge">${escapeHtml(region || '—')}</span>`; }


function getShkBadge(shk) { return window.WKD?.Badges?.shk ? window.WKD.Badges.shk(shk) : `<span class="shk-badge">${escapeHtml(shk || '—')}</span>`; }

function roleOptionsFor(currentRole = 'player') {
  const allowed = assignableRolesForActor(currentUser, currentProfile);
  return [...new Set([currentRole || 'player', ...allowed])].filter(Boolean);
}

function adminTableLabels() {
  return {
    nickname: escapeHtml(t('account.nickname', 'Nickname')),
    region: escapeHtml(t('account.region', 'Region')),
    alliance: escapeHtml(t('account.alliance', 'Alliance')),
    rank: escapeHtml(t('account.rank', 'Rank')),
    shk: escapeHtml(t('account.shk', 'HQ')),
    role: escapeHtml(t('account.role', 'Role')),
    registered: escapeHtml(t('admin.registrationDate', 'Registration date')),
    actions: escapeHtml(t('admin.actions', 'Actions'))
  };
}

function includeAdminFarmRows() {
  return Boolean($('#adminIncludeFarmsToggle')?.checked);
}

function mainRowForUser(user = {}) {
  const game = getGameProfile(user);
  return {
    rowId: user.uid,
    uid: user.uid,
    user,
    game,
    isFarmRow: false,
    farmId: 'main',
    mainNickname: game.nickname || '—'
  };
}

function farmRowsForUser(user = {}, main = mainRowForUser(user)) {
  return getUserFarms(user)
    .filter(farm => farm.nickname || farm.region || farm.alliance)
    .map((farm, index) => ({
      rowId: `${user.uid}::${farm.farmId || farm.id || index}`,
      uid: user.uid,
      user,
      game: farm,
      isFarmRow: true,
      farmId: farm.farmId || farm.id || `farm-${index + 1}`,
      mainNickname: main.mainNickname
    }));
}

function allRowsForUser(user = {}) {
  const main = mainRowForUser(user);
  return [main, ...farmRowsForUser(user, main)];
}

function adminRows() {
  return users.flatMap(user => {
    const main = mainRowForUser(user);
    if (!includeAdminFarmRows()) return [main];
    return [main, ...farmRowsForUser(user, main)];
  });
}

function rowRole(row) {
  return row.isFarmRow ? (row.game.role || 'player') : (row.user.role || 'player');
}

function actorIsGlobalManager() {
  return isOwnerUser(currentUser, currentProfile) || ['admin', 'moderator'].includes(String(currentProfile?.role || '').toLowerCase());
}
function actorGames() {
  return [{ ...getGameProfile(currentProfile || {}), role: currentProfile?.role || 'player', farmId: 'main' }, ...getUserFarms(currentProfile || {})];
}
function sameRegionAlliance(a = {}, b = {}) {
  return String(a.region || '').replace(/[^0-9]/g, '') === String(b.region || '').replace(/[^0-9]/g, '')
    && allianceTag3(a.alliance) === allianceTag3(b.alliance);
}
function canDisplayRow(row = {}) {
  if (actorIsGlobalManager()) return true;
  const target = row.game || {};
  return actorGames().some(game => {
    const role = String(game.role || 'player').toLowerCase();
    const rank = String(game.rank || '').toLowerCase();
    const sameRegion = String(game.region || '').replace(/[^0-9]/g, '') === String(target.region || '').replace(/[^0-9]/g, '');
    if (role === 'consul' && sameRegion) return true;
    if (sameRegionAlliance(game, target) && (role === 'officer' || ['p5', 'r5', '5'].includes(rank))) return true;
    return false;
  });
}

function canUseLimitsPanel(user = currentUser, profile = currentProfile) {
  return Boolean(user && (isOwnerUser(user, profile) || String(profile?.role || '').toLowerCase() === 'admin'));
}

function setLimitsAccess(enabled) {
  document.querySelectorAll('.admin-limits-only').forEach(el => { el.hidden = !enabled; });
  if (!enabled && window.location.hash.replace('#', '') === 'limits') switchTab('players');
}

function sortRows(a, b) {
  const dir = sortState.dir === 'asc' ? 1 : -1;
  const av = sortState.key === 'createdAt' ? (a.user.createdAt?.toMillis?.() || timestampToMsSafe(a.user.createdAt)) : (a.game[sortState.key] ?? a.user[sortState.key] ?? '');
  const bv = sortState.key === 'createdAt' ? (b.user.createdAt?.toMillis?.() || timestampToMsSafe(b.user.createdAt)) : (b.game[sortState.key] ?? b.user[sortState.key] ?? '');
  if (sortState.key === 'createdAt') return (Number(av) - Number(bv)) * dir;
  return String(av).localeCompare(String(bv), window.WKD_CURRENT_LANG || 'en', { numeric: true }) * dir;
}

function timestampToMsSafe(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function filterValues() {
  return {
    nick: String($('#adminNickSearch')?.value || '').trim().toLowerCase(),
    alliance: String($('#adminAllianceSearch')?.value || '').trim().toLowerCase(),
    region: String($('#adminRegionSearch')?.value || '').trim().toLowerCase(),
    role: $('#adminRoleFilter')?.value || 'all'
  };
}

function adminPlayerQueryFilters() {
  const values = filterValues();
  return {
    nick: values.nick,
    alliance: values.alliance,
    region: values.region.replace(/[^0-9]/g, ''),
    role: values.role
  };
}

function filtersAreActive(filters = filterValues()) {
  return Boolean(filters.nick || filters.alliance || filters.region || (filters.role && filters.role !== 'all'));
}

function totalFromSummary(includeFarms = includeAdminFarmRows()) {
  if (!adminStatsSummary) return null;
  const total = includeFarms ? adminStatsSummary.totalRows : adminStatsSummary.totalPlayers;
  return Number.isFinite(Number(total)) ? Number(total) : null;
}

function regionsFromSummary(includeFarms = includeAdminFarmRows()) {
  if (!adminStatsSummary) return null;
  const data = includeFarms ? adminStatsSummary.regionsWithFarms : adminStatsSummary.regions;
  if (!data || typeof data !== 'object') return null;
  return Object.keys(data).filter(Boolean).length;
}

function leadersFromSummary(includeFarms = includeAdminFarmRows()) {
  if (!adminStatsSummary) return null;
  const total = includeFarms ? adminStatsSummary.leadersWithFarms : adminStatsSummary.leaders;
  return Number.isFinite(Number(total)) ? Number(total) : null;
}

async function fetchPublicCacheJson(fileName) {
  const response = await fetch(`public-cache/${fileName}?v=125&t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${fileName}-${response.status}`);
  return response.json();
}

async function loadAdminStatsSummary() {
  try {
    const [summary, players] = await Promise.all([
      fetchPublicCacheJson('stats-summary.json'),
      fetchPublicCacheJson('stats-players.json').catch(error => {
        console.warn('[WKD] admin stats players cache unavailable:', error);
        return [];
      })
    ]);
    adminStatsSummary = summary && typeof summary === 'object' ? summary : null;
    adminStatsPlayers = Array.isArray(players) ? players.filter(Boolean) : [];
  } catch (error) {
    console.warn('[WKD] admin stats summary unavailable:', error);
    adminStatsSummary = null;
    adminStatsPlayers = [];
  }
  return adminStatsSummary;
}

function statsMap(key, includeFarms = includeAdminFarmRows()) {
  const mapKey = includeFarms ? `${key}WithFarms` : key;
  const value = adminStatsSummary?.[mapKey] || adminStatsSummary?.[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sortedCountEntries(map = {}) {
  return Object.entries(map || {})
    .filter(([key, value]) => String(key || '').trim() && Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]) || String(a[0]).localeCompare(String(b[0]), window.WKD_CURRENT_LANG || 'uk', { numeric: true }));
}

function countChipHtml([key, value]) {
  return `<span class="admin-cache-chip"><b>${escapeHtml(String(key || '—'))}</b><em>${escapeHtml(formatCompactNumber(value || 0))}</em></span>`;
}

function countSectionHtml(titleKey, fallback, entries = []) {
  const rows = Array.isArray(entries) ? entries : [];
  const content = rows.length ? rows.map(countChipHtml).join('') : `<span class="admin-cache-muted">${escapeHtml(t('admin.cacheNoData', 'Немає даних'))}</span>`;
  return `<section class="admin-cache-section"><h4>${escapeHtml(t(titleKey, fallback))}</h4><div class="admin-cache-chip-list">${content}</div></section>`;
}

function publicPlayerRows(includeFarms = includeAdminFarmRows()) {
  const players = Array.isArray(adminStatsPlayers) ? adminStatsPlayers : [];
  if (!includeFarms) return players.map(player => ({ ...player, isFarm: false }));
  return players.flatMap(player => {
    const farms = Array.isArray(player?.farms) ? player.farms.map(farm => ({ ...farm, isFarm: true, mainNickname: player.nickname || player.gameNick || '' })) : [];
    return [{ ...player, isFarm: false }, ...farms];
  });
}

function countByFromPublicRows(selector, includeFarms = includeAdminFarmRows()) {
  const counts = {};
  publicPlayerRows(includeFarms).forEach(row => {
    const value = selector(row);
    const key = String(value || '').trim() || '—';
    counts[key] = (Number(counts[key]) || 0) + 1;
  });
  return sortedCountEntries(counts);
}

function latestPlayersHtml() {
  const rows = (Array.isArray(adminStatsPlayers) ? adminStatsPlayers : [])
    .map(player => ({
      nickname: player.nickname || player.gameNick || '—',
      region: player.region || '—',
      alliance: player.alliance || '—',
      createdAt: timestampToMsSafe(player.createdAt)
    }))
    .filter(row => row.createdAt)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);
  if (!rows.length) return `<span class="admin-cache-muted">${escapeHtml(t('admin.cacheNoData', 'Немає даних'))}</span>`;
  return `<div class="admin-cache-latest">${rows.map(row => `
    <span><b>${escapeHtml(row.nickname)}</b><small>${escapeHtml(row.region)} · ${escapeHtml(row.alliance)} · ${escapeHtml(new Date(row.createdAt).toLocaleDateString(window.WKD_CURRENT_LANG || 'uk'))}</small></span>
  `).join('')}</div>`;
}

function renderCacheStatsDetails() {
  const panel = $('#adminCacheDetails');
  if (!panel) return;
  if (!adminStatsSummary) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }
  const includeFarms = includeAdminFarmRows();
  const totalPlayers = Number(adminStatsSummary.totalPlayers || 0);
  const totalFarms = Number(adminStatsSummary.totalFarms || 0);
  const totalRows = Number(adminStatsSummary.totalRows || (totalPlayers + totalFarms));
  const regionEntries = sortedCountEntries(statsMap('regions', includeFarms));
  const allianceEntries = sortedCountEntries(statsMap('alliances', includeFarms));
  const rankEntries = sortedCountEntries(statsMap('ranks', includeFarms));
  const shkEntries = sortedCountEntries(statsMap('shkTiers', includeFarms));
  const roleEntries = sortedCountEntries(statsMap('roles', includeFarms));
  const countryEntries = sortedCountEntries(statsMap('countries', includeFarms));
  const derivedRoles = roleEntries.length ? roleEntries : countByFromPublicRows(row => row.role || 'player', includeFarms);
  const derivedCountries = countryEntries.length ? countryEntries : countByFromPublicRows(row => row.countryCode || row.country || '—', includeFarms);
  const cards = [
    ['admin.cachePlayers', 'Основні', totalPlayers],
    ['admin.cacheFarms', 'Ферми', totalFarms],
    ['admin.cacheRows', 'Рядки', totalRows],
    ['admin.cacheRegions', 'Регіони', regionEntries.length],
    ['admin.cacheAlliances', 'Альянси', allianceEntries.length],
    ['admin.cacheLeaders', 'Керівні ролі', includeFarms ? Number(adminStatsSummary.leadersWithFarms || 0) : Number(adminStatsSummary.leaders || 0)],
    ['admin.cachePublicRows', 'JSON гравців', adminStatsPlayers.length]
  ];
  const updatedAt = adminStatsSummary.generatedAt ? new Date(adminStatsSummary.generatedAt).toLocaleString(window.WKD_CURRENT_LANG || 'uk') : '—';
  panel.hidden = false;
  panel.innerHTML = `
    <div class="admin-cache-head">
      <div>
        <h3>${escapeHtml(t('admin.cacheDetailsTitle', 'Статистика з JSON-кешу'))}</h3>
        <p>${escapeHtml(t('admin.cacheNoReads', 'Цей блок читає public-cache/*.json і не витрачає Firestore reads.'))}</p>
      </div>
      <small>${escapeHtml(t('admin.cacheSource', 'Джерело'))}: ${escapeHtml(adminStatsSummary.source || 'public-cache')} · ${escapeHtml(t('admin.cacheGeneratedAt', 'Оновлено'))}: ${escapeHtml(updatedAt)}</small>
    </div>
    <div class="admin-cache-metrics">${cards.map(([key, fallback, value]) => `
      <article><span>${escapeHtml(t(key, fallback))}</span><b>${escapeHtml(formatCompactNumber(value || 0))}</b></article>`).join('')}
    </div>
    <div class="admin-cache-grid">
      ${countSectionHtml('admin.cacheTopRegions', 'Регіони', regionEntries)}
      ${countSectionHtml('admin.cacheTopAlliances', 'Альянси', allianceEntries)}
      ${countSectionHtml('admin.cacheRanks', 'Ранги', rankEntries)}
      ${countSectionHtml('admin.cacheShkTiers', 'ШК тири', shkEntries)}
      ${countSectionHtml('admin.cacheRoles', 'Ролі', derivedRoles)}
      ${countSectionHtml('admin.cacheCountries', 'Країни', derivedCountries)}
      <section class="admin-cache-section admin-cache-section--wide"><h4>${escapeHtml(t('admin.cacheLatestPlayers', 'Останні зареєстровані'))}</h4>${latestPlayersHtml()}</section>
    </div>
  `;
}

function rowMatchesFilters(row, filters = filterValues()) {
  if (!canDisplayRow(row)) return false;
  if (filters.role !== 'all' && rowRole(row) !== filters.role) return false;
  const game = row.game || {};
  const userNick = String(game.nickname || '').toLowerCase();
  const mainNick = String(row.mainNickname || '').toLowerCase();
  const userAlliance = String(game.alliance || '').toLowerCase();
  const userRegion = String(game.region || '').toLowerCase();
  return (!filters.nick || userNick.includes(filters.nick) || mainNick.includes(filters.nick))
    && (!filters.alliance || userAlliance.includes(filters.alliance))
    && (!filters.region || userRegion.includes(filters.region));
}

function filteredPlayerGroups() {
  const filters = filterValues();
  return users
    .map(user => {
      const main = mainRowForUser(user);
      const farms = farmRowsForUser(user, main).filter(canDisplayRow);
      const searchable = includeAdminFarmRows() ? [main, ...farms] : [main];
      return { user, main, farms, matches: searchable.some(row => rowMatchesFilters(row, filters)) };
    })
    .filter(group => group.matches && canDisplayRow(group.main))
    .sort((a, b) => sortRows(a.main, b.main));
}

function pagedPlayersState() {
  const groups = filteredPlayerGroups();
  const rows = groups.flatMap(group => includeAdminFarmRows() ? [group.main, ...group.farms] : [group.main]);
  const total = totalFromSummary(false);
  return {
    groups,
    rows,
    page: playersPage,
    pageCount: null,
    hasNext: Boolean(playersPageMeta.hasNext),
    total: filtersAreActive() ? null : total,
    reads: Number(playersPageMeta.reads || 0),
    queryMode: playersPageMeta.queryMode || 'indexed'
  };
}

function filteredUsers() {
  return pagedPlayersState().rows;
}

function resetPlayersPage() {
  playersPage = 1;
  playersCursorStack = [null];
}

function sortUsers(a, b) {
  const dir = sortState.dir === 'asc' ? 1 : -1;
  const aGame = getGameProfile(a);
  const bGame = getGameProfile(b);
  let av = sortState.key === 'createdAt' ? (a.createdAt?.toMillis?.() || 0) : (aGame[sortState.key] ?? a[sortState.key] ?? '');
  let bv = sortState.key === 'createdAt' ? (b.createdAt?.toMillis?.() || 0) : (bGame[sortState.key] ?? b[sortState.key] ?? '');
  return String(av).localeCompare(String(bv), window.WKD_CURRENT_LANG || 'en', { numeric: true }) * dir;
}

function visibleRequests() {
  const owner = isOwnerUser(currentUser, currentProfile);
  return requests.filter(request => owner || !['admin', 'moderator'].includes(String(request.requestedRole || '').toLowerCase()));
}

function setAdminPlayersCounterLabel() {
  const label = $('#adminStats .admin-stat-card:first-child span');
  if (!label) return;
  const key = includeAdminFarmRows() ? 'stats.playersAndFarms' : 'stats.players';
  label.dataset.i18n = key;
  label.textContent = t(key, includeAdminFarmRows() ? 'Players and farms' : 'Players');
}


function formatCompactNumber(value = 0) {
  const number = Math.max(0, Number(value) || 0);
  return number.toLocaleString(window.WKD_CURRENT_LANG || 'uk');
}
function usageCardHtml(periodKey, typeKey, row = {}) {
  const label = t(`admin.usage.${periodKey}.${typeKey}`, `${periodKey} ${typeKey}`);
  const used = formatCompactNumber(row.used);
  const limit = formatCompactNumber(row.limit);
  const remaining = formatCompactNumber(row.remaining);
  const percent = Math.max(0, Math.min(100, Number(row.percent) || 0));
  return `<article class="admin-usage-card">
    <span>${escapeHtml(label)}</span>
    <b>${escapeHtml(remaining)}</b>
    <small>${escapeHtml(t('admin.usageRemaining', 'залишилось'))} · ${escapeHtml(used)} / ${escapeHtml(limit)}</small>
    <div class="admin-usage-bar" aria-hidden="true"><i style="width:${percent}%"></i></div>
  </article>`;
}
function staticLimitCardHtml(key, value, detail = '') {
  return `<article class="admin-usage-card admin-usage-card--static">
    <span>${escapeHtml(t(`admin.cloudflare.${key}.label`, key))}</span>
    <b>${escapeHtml(value)}</b>
    <small>${escapeHtml(t(`admin.cloudflare.${key}.detail`, detail))}</small>
  </article>`;
}

function cloudflareUsageCardHtml(key, row = {}, detail = '') {
  const label = t(`admin.cloudflare.${key}.label`, key);
  const used = formatCompactNumber(row.used);
  const limit = formatCompactNumber(row.limit);
  const remaining = formatCompactNumber(row.remaining);
  const percent = Math.max(0, Math.min(100, Number(row.percent) || 0));
  return `<article class="admin-usage-card">
    <span>${escapeHtml(label)}</span>
    <b>${escapeHtml(remaining)}</b>
    <small>${escapeHtml(t('admin.usageRemaining', 'залишилось'))} · ${escapeHtml(used)} / ${escapeHtml(limit)}</small>
    <div class="admin-usage-bar" aria-hidden="true"><i style="width:${percent}%"></i></div>
    <small>${escapeHtml(t(`admin.cloudflare.${key}.detail`, detail))}</small>
  </article>`;
}

function formatBytes(value = 0) {
  const bytes = Math.max(0, Number(value) || 0);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 ? 0 : (size >= 10 ? 1 : 2);
  return `${size.toLocaleString(window.WKD_CURRENT_LANG || 'uk', { maximumFractionDigits: decimals })} ${units[unitIndex]}`;
}

function cloudflareBytesCardHtml(key, row = {}, detail = '') {
  const label = t(`admin.cloudflare.${key}.label`, key);
  const used = formatBytes(row.used);
  const limit = formatBytes(row.limit);
  const remaining = formatBytes(row.remaining);
  const percent = Math.max(0, Math.min(100, Number(row.percent) || 0));
  return `<article class="admin-usage-card">
    <span>${escapeHtml(label)}</span>
    <b>${escapeHtml(remaining)}</b>
    <small>${escapeHtml(t('admin.usageRemaining', 'залишилось'))} · ${escapeHtml(used)} / ${escapeHtml(limit)}</small>
    <div class="admin-usage-bar" aria-hidden="true"><i style="width:${percent}%"></i></div>
    <small>${escapeHtml(t(`admin.cloudflare.${key}.detail`, detail))}</small>
  </article>`;
}

function cloudflareValueCardHtml(key, value = 0, detail = '') {
  return `<article class="admin-usage-card admin-usage-card--static">
    <span>${escapeHtml(t(`admin.cloudflare.${key}.label`, key))}</span>
    <b>${escapeHtml(formatCompactNumber(value))}</b>
    <small>${escapeHtml(t(`admin.cloudflare.${key}.detail`, detail))}</small>
  </article>`;
}
function renderUsage() {
  const grid = $('#adminUsageGrid');
  const note = $('#adminUsageNote');
  if (grid) {
    const usage = getUsageEstimate();
    grid.innerHTML = [
      usageCardHtml('day', 'reads', usage.day.reads),
      usageCardHtml('day', 'writes', usage.day.writes),
      usageCardHtml('day', 'deletes', usage.day.deletes),
      usageCardHtml('month', 'reads', usage.month.reads),
      usageCardHtml('month', 'writes', usage.month.writes),
      usageCardHtml('month', 'deletes', usage.month.deletes),
      staticLimitCardHtml('firestoreStorage', '1 GiB', 'Firestore storage on Spark'),
      staticLimitCardHtml('firestoreTraffic', '10 GiB / month', 'Firestore outbound transfer')
    ].join('');
  }
  if (note) note.textContent = t('admin.usageNote', 'Це орієнтовний лічильник сайту, а не офіційні цифри Firebase. Точні ліміти перевіряй у Firebase Console → Usage. Місячні читання/записи/видалення — це оцінка 30 днів, бо офіційна безкоштовна квота Firestore рахується за день.');
  renderCloudflareUsage();
}
function renderCloudflareUsage() {
  const grid = $('#cloudflareUsageGrid');
  if (!grid) return;
  if (cloudflareUsageLoading) {
    grid.innerHTML = `<div class="admin-empty">${escapeHtml(t('admin.cloudflareRealLoading', 'Завантажую реальні дані Cloudflare...'))}</div>`;
    const note = $('#cloudflareUsageNote');
    if (note) note.textContent = t('admin.cloudflareRealLoading', 'Завантажую реальні дані Cloudflare...');
    return;
  }
  if (cloudflareRealUsage?.real) {
    const worker = cloudflareRealUsage.worker || {};
    const d1 = cloudflareRealUsage.d1 || {};
    grid.innerHTML = [
      cloudflareUsageCardHtml('workerRequests', worker.requests, 'Real Workers requests today UTC'),
      cloudflareValueCardHtml('workerErrors', worker.errors, 'Real Workers errors today UTC'),
      cloudflareValueCardHtml('workerSubrequests', worker.subrequests, 'Real Workers subrequests today UTC'),
      cloudflareUsageCardHtml('d1RowsRead', d1.rowsRead, 'Real D1 rows read today UTC'),
      cloudflareUsageCardHtml('d1RowsWritten', d1.rowsWritten, 'Real D1 rows written today UTC'),
      cloudflareValueCardHtml('d1ReadQueries', d1.readQueries, 'Real D1 read queries today UTC'),
      cloudflareValueCardHtml('d1WriteQueries', d1.writeQueries, 'Real D1 write queries today UTC'),
      cloudflareBytesCardHtml('d1Storage', d1.storageTotal, 'Real D1 total storage'),
      cloudflareBytesCardHtml('d1DatabaseSize', d1.storageMaxDatabase, 'Largest D1 database size'),
      staticLimitCardHtml('workerCpu', '10 ms / request', 'Workers Free CPU time'),
      staticLimitCardHtml('workerStaticAssets', 'free', 'Static asset requests'),
      staticLimitCardHtml('d1QueriesPerInvocation', '50', 'D1 queries per Worker invocation on Free')
    ].join('');
    const note = $('#cloudflareUsageNote');
    if (note) {
      const period = cloudflareRealUsage.period || {};
      const errors = Array.isArray(cloudflareRealUsage.partialErrors) && cloudflareRealUsage.partialErrors.length
        ? ` ${tv('admin.cloudflarePartialNote', 'Часткові помилки: {errors}', { errors: cloudflareRealUsage.partialErrors.map(item => `${item.source}: ${item.error}`).join('; ') })}`
        : '';
      note.textContent = `${tv('admin.cloudflareRealNote', 'Реальні дані Cloudflare за сьогодні UTC: {start} — {end}. Оновлено: {updated}.', {
        start: period.start || period.dateStart || '—',
        end: period.end || period.dateEnd || '—',
        updated: cloudflareRealUsage.generatedAt || '—'
      })}${errors}`;
    }
    return;
  }
  const usage = getCloudflareUsageEstimate();
  grid.innerHTML = [
    cloudflareUsageCardHtml('workerRequests', usage.workerRequests, 'Workers Free requests'),
    cloudflareUsageCardHtml('d1RowsRead', usage.d1RowsRead, 'D1 Free rows read'),
    cloudflareUsageCardHtml('d1RowsWritten', usage.d1RowsWritten, 'D1 Free rows written'),
    staticLimitCardHtml('workerCpu', '10 ms / request', 'Workers Free CPU time'),
    staticLimitCardHtml('workerStaticAssets', 'free', 'Static asset requests'),
    staticLimitCardHtml('d1Storage', '5 GB total', 'D1 Free storage per account'),
    staticLimitCardHtml('d1DatabaseSize', '500 MB / DB', 'D1 Free maximum database size'),
    staticLimitCardHtml('d1QueriesPerInvocation', '50', 'D1 queries per Worker invocation on Free')
  ].join('');
  const note = $('#cloudflareUsageNote');
  if (note) note.textContent = t('admin.cloudflareUsageNote', 'Це локальна оцінка запитів цього браузера. Натисни Оновити, щоб отримати реальні дані через безпечний Worker secret.');
}

async function refreshRealCloudflareUsage() {
  if (!currentUser || !canUseLimitsPanel()) return;
  cloudflareUsageLoading = true;
  renderCloudflareUsage();
  try {
    cloudflareRealUsage = await fetchRealCloudflareUsage(currentUser);
    setStatus(t('admin.cloudflareRealLoaded', 'Реальні дані Cloudflare оновлено.'), 'success');
  } catch (error) {
    cloudflareRealUsage = null;
    setStatus(tv('admin.cloudflareRealFailed', 'Не вдалося отримати реальні дані Cloudflare: {error}', { error: error?.message || 'unknown' }), 'error');
  } finally {
    cloudflareUsageLoading = false;
    renderCloudflareUsage();
  }
}

async function maybeRunOldDocsCleanup() {
  if (!currentUser || !canUseLimitsPanel()) return;
  const key = `wkd.autoCleanupOldDocs:${currentUser.uid}`;
  const now = Date.now();
  const last = Number(localStorage.getItem(key) || 0);
  if (now - last < 12 * 60 * 60 * 1000) return;
  localStorage.setItem(key, String(now));
  const result = await cleanupOldPublicDocuments(currentUser, { retentionDays: 45, maxDeletes: 25 }).catch(error => {
    console.warn('[WKD] old public documents cleanup skipped:', error);
    return null;
  });
  if (result?.deletedCount) {
    renderUsage();
    setStatus(tv('admin.cleanupOldDocsDone', 'Очищено старих документів: {count}.', { count: result.deletedCount || 0 }), 'success');
  }
}

async function runOldDocsCleanup() {
  if (!currentUser || !canUseLimitsPanel()) return;
  const ok = await confirmAction({
    title: t('admin.cleanupOldDocsTitle', 'Очистити старі документи?'),
    message: t('admin.cleanupOldDocsMessage', 'Будуть видалені старі секретні знімки таблиць і фінальних планів старші 45 днів. Активні дані гравців не чіпаються.'),
    icon: '🧹',
    acceptText: t('admin.cleanupOldDocs', 'Очистити старі документи')
  });
  if (!ok) return;
  try {
    setStatus(t('admin.cleanupOldDocsRunning', 'Очищаю старі документи...'), 'muted');
    const result = await cleanupOldPublicDocuments(currentUser, { retentionDays: 45, maxDeletes: 40 });
    renderUsage();
    setStatus(tv('admin.cleanupOldDocsDone', 'Очищено старих документів: {count}.', { count: result.deletedCount || 0 }), 'success');
  } catch (error) {
    console.error(error);
    setStatus(t('admin.cleanupOldDocsFailed', 'Не вдалося очистити старі документи.'), 'error');
  }
}

function setFirebaseArchiveStatus(text, type = 'muted') {
  const box = $('#firebaseArchiveStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}

function archiveScopeLabel(scope = 'all') {
  const labels = {
    notifications: t('admin.firebaseArchiveScopeNotifications', 'прочитані повідомлення'),
    actionLogs: t('admin.firebaseArchiveScopeActionLogs', 'журнали дій'),
    campaigns: t('admin.firebaseArchiveScopeCampaigns', 'системні кампанії'),
    all: t('admin.firebaseArchiveScopeAll', 'усі архіви')
  };
  return labels[scope] || labels.all;
}

function archiveResultText(result = {}) {
  return tv('admin.firebaseArchiveResult', 'Знайдено: {found}. Видалено: {deleted}. Перевірено: {scanned}.', {
    found: Number(result.found || 0),
    deleted: Number(result.deleted || 0),
    scanned: Number(result.scanned || 0)
  });
}

async function runFirebaseArchiveScan() {
  if (!currentUser || !canUseLimitsPanel()) return;
  try {
    setFirebaseArchiveStatus(t('admin.firebaseArchiveScanning', 'Перевіряю Firebase архіви...'), 'muted');
    const result = await scanOldFirebaseArchives(currentUser, { retentionDays: 30, maxScan: 500 });
    setFirebaseArchiveStatus(archiveResultText(result), 'success');
    renderUsage();
  } catch (error) {
    console.error(error);
    setFirebaseArchiveStatus(t('admin.firebaseArchiveScanFailed', 'Не вдалося перевірити Firebase архіви.'), 'error');
  }
}

async function runFirebaseArchiveCleanup(scope) {
  if (!currentUser || !canUseLimitsPanel()) return;
  const label = archiveScopeLabel(scope);
  const ok = await confirmAction({
    title: tv('admin.firebaseArchiveCleanTitle', 'Очистити {scope}?', { scope: label }),
    message: tv('admin.firebaseArchiveCleanMessage', 'Буде видалено до 500 старих документів старше 30 днів. Непрочитані приватні повідомлення не видаляються. Продовжити?', { scope: label }),
    icon: '🧹',
    acceptText: t('admin.firebaseArchiveCleanAccept', 'Очистити')
  });
  if (!ok) return;
  try {
    setFirebaseArchiveStatus(tv('admin.firebaseArchiveCleaning', 'Очищаю {scope}...', { scope: label }), 'muted');
    const result = await cleanupOldFirebaseArchives(currentUser, { scope, retentionDays: 30, maxDeletes: 500 });
    setFirebaseArchiveStatus(archiveResultText(result), Number(result.deleted || 0) ? 'success' : 'muted');
    renderUsage();
  } catch (error) {
    console.error(error);
    setFirebaseArchiveStatus(t('admin.firebaseArchiveCleanFailed', 'Не вдалося очистити Firebase архіви.'), 'error');
  }
}


function setD1ArchiveStatus(text, type = 'muted') {
  const box = $('#d1ArchiveStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}

function d1ArchiveScopeLabel(scope = 'all') {
  const labels = {
    cycles: t('admin.d1ArchiveScopeCycles', 'старі цикли'),
    shares: t('admin.d1ArchiveScopeShares', 'секретні посилання'),
    campaigns: t('admin.d1ArchiveScopeCampaigns', 'D1 кампанії'),
    all: t('admin.d1ArchiveScopeAll', 'D1 архів')
  };
  return labels[scope] || labels.all;
}

function d1ArchiveResultText(result = {}) {
  return tv('admin.d1ArchiveResult', 'Знайдено: {found}. Видалено: {deleted}. Перевірено: {scanned}. Цикли: {cycles}. Посилання: {shares}. Кампанії: {campaigns}.', {
    found: Number(result.found || 0),
    deleted: Number(result.deleted || 0),
    scanned: Number(result.scanned || 0),
    cycles: Number(result.cycles || 0),
    shares: Number(result.shares || 0),
    campaigns: Number(result.campaigns || 0)
  }) + (result.hasMore ? ` ${t('admin.d1ArchiveHasMore', 'Є ще записи — можна натиснути ще раз.')}` : '');
}

async function runD1ArchiveScan() {
  if (!currentUser || !canUseLimitsPanel()) return;
  try {
    setD1ArchiveStatus(t('admin.d1ArchiveScanning', 'Перевіряю D1 архів...'), 'muted');
    const result = await scanD1Archives(currentUser, { scope: 'all', retentionDays: 60, maxScan: 500 });
    setD1ArchiveStatus(d1ArchiveResultText(result), 'success');
  } catch (error) {
    console.error(error);
    setD1ArchiveStatus(t('admin.d1ArchiveScanFailed', 'Не вдалося перевірити D1 архів.'), 'error');
  }
}

async function runD1ArchiveCleanup(scope) {
  if (!currentUser || !canUseLimitsPanel()) return;
  const label = d1ArchiveScopeLabel(scope);
  const ok = await confirmAction({
    title: tv('admin.d1ArchiveCleanTitle', 'Очистити {scope}?', { scope: label }),
    message: tv('admin.d1ArchiveCleanMessage', 'Буде видалено до 500 старих D1 рядків. Активний цикл регіону не видаляється. Продовжити?', { scope: label }),
    icon: '🧹',
    acceptText: t('admin.d1ArchiveCleanAccept', 'Очистити')
  });
  if (!ok) return;
  try {
    setD1ArchiveStatus(tv('admin.d1ArchiveCleaning', 'Очищаю {scope}...', { scope: label }), 'muted');
    const result = await cleanupD1Archives(currentUser, { scope, retentionDays: 60, maxDeletes: 500 });
    setD1ArchiveStatus(d1ArchiveResultText(result), Number(result.deleted || 0) ? 'success' : 'muted');
  } catch (error) {
    console.error(error);
    setD1ArchiveStatus(t('admin.d1ArchiveCleanFailed', 'Не вдалося очистити D1 архів.'), 'error');
  }
}

function renderStats() {
  setAdminPlayersCounterLabel();
  const rows = adminRows();
  const includeFarms = includeAdminFarmRows();
  const playersTotal = totalFromSummary(includeFarms) ?? rows.length;
  const regionTotal = regionsFromSummary(includeFarms) ?? new Set([
    ...users.map(user => getGameProfile(user).region).filter(Boolean),
    ...regionsCatalog.filter(region => region.active !== false).map(region => region.region).filter(Boolean)
  ]).size;
  const leaders = leadersFromSummary(includeFarms) ?? rows.filter(row => ['admin', 'moderator', 'consul', 'officer'].includes(rowRole(row))).length;
  const pending = visibleRequests().length;
  const cards = $('#adminStats')?.querySelectorAll('.admin-stat-card b') || [];
  const values = [playersTotal, regionTotal, leaders, pending];
  cards.forEach((card, index) => { card.textContent = formatCompactNumber(values[index] ?? 0); });
  setSummary(tv('admin.summaryOptimized', '{players} гравців у кеші • {shown} показано зараз • {requests} заявок', { players: playersTotal, shown: rows.length, requests: pending }));
  renderCacheStatsDetails();
}

function editCell(name, value, type = 'text') {
  const extra = name === 'alliance' ? ' maxlength="3"' : '';
  return `<input class="admin-edit-input" data-edit="${name}" type="${type}" value="${escapeHtml(value)}"${extra} />`;
}

function editSelect(name, value, options, labels = null) {
  return `<select class="admin-edit-input" data-edit="${name}">${options.map(option => `
    <option value="${escapeHtml(option)}" ${option === value ? 'selected' : ''}>${escapeHtml(labels?.[option] || option.toUpperCase())}</option>
  `).join('')}</select>`;
}

function userRow(row) {
  const user = row.user || row;
  const game = row.game || getGameProfile(user);
  const role = rowRole(row);
  const editing = editUid === row.rowId;
  const labels = adminTableLabels();
  const rowAttrs = `data-uid="${escapeHtml(user.uid)}" data-row-id="${escapeHtml(row.rowId)}" data-farm-id="${escapeHtml(row.farmId || 'main')}" data-farm-label="${escapeHtml(t('account.farm', 'Farm'))}"`;
  if (editing) {
    return `<tr ${rowAttrs} class="is-editing ${row.isFarmRow ? 'is-farm-row' : 'is-main-row'}">
      <td data-label="${labels.nickname}">${editCell('nickname', game.nickname)}</td>
      <td data-label="${labels.region}">${editCell('region', game.region, 'number')}</td>
      <td data-label="${labels.alliance}">${editCell('alliance', game.alliance, 'text')}</td>
      <td data-label="${labels.rank}">${editSelect('rank', game.rank || 'p1', rankOptions)}</td>
      <td data-label="${labels.shk}">${editCell('shk', game.shk, 'number')}</td>
      <td data-label="${labels.role}">${editSelect('role', role || 'player', roleOptionsFor(role || 'player'), roleLabels())}</td>
      <td data-label="${labels.registered}">${formatUserDate(user.createdAt)}</td>
      <td class="admin-row-actions" data-label="${labels.actions}">
        <button class="btn admin-save-row" type="button" data-action="save-user" data-uid="${escapeHtml(user.uid)}" data-row-id="${escapeHtml(row.rowId)}" data-farm-id="${escapeHtml(row.farmId || 'main')}">${escapeHtml(t('common.save', 'Save'))}</button>
        <button class="btn" type="button" data-action="cancel-edit">${escapeHtml(t('common.cancel', 'Cancel'))}</button>
      </td>
    </tr>`;
  }

  const sub = row.isFarmRow
    ? `${t('account.farm', 'Farm')} · ${t('account.mainPlayer', 'Main player')}: ${row.mainNickname || '—'}`
    : (includeAdminFarmRows() ? `${t('account.mainPlayer', 'Main player')} · ${tv('stats.farmCountShort', '{count} farms', { count: getUserFarms(user).length })}` : (user.email || ''));
  return `<tr ${rowAttrs} class="${row.isFarmRow ? 'is-farm-row' : 'is-main-row'}">
    <td data-label="${labels.nickname}"><strong>${escapeHtml(game.nickname || '—')}</strong><small>${escapeHtml(sub || '')}</small></td>
    <td data-label="${labels.region}">${getRegionBadge(game.region)}</td>
    <td data-label="${labels.alliance}"><span class="alliance-badge">${escapeHtml(game.alliance || '—')}</span></td>
    <td data-label="${labels.rank}">${getRankBadge(game.rank)}</td>
    <td data-label="${labels.shk}">${getShkBadge(game.shk)}</td>
    <td data-label="${labels.role}">${getRoleBadge(role)}</td>
    <td data-label="${labels.registered}">${formatUserDate(user.createdAt)}</td>
    <td class="admin-row-actions" data-label="${labels.actions}">
      <button class="btn" type="button" data-action="edit-user" data-uid="${escapeHtml(user.uid)}" data-row-id="${escapeHtml(row.rowId)}" data-farm-id="${escapeHtml(row.farmId || 'main')}">${escapeHtml(t('common.edit', 'Edit'))}</button>
    </td>
  </tr>`;
}

function renderPlayersPager(state = null) {
  const pager = $('#adminPlayersPager');
  if (!pager) return;
  const data = state || pagedPlayersState();
  const hasPages = data.page > 1 || data.hasNext || Number(data.total || 0) > ADMIN_PLAYERS_PAGE_SIZE;
  pager.hidden = !hasPages;
  const info = $('#adminPlayersPageInfo');
  if (info) {
    info.textContent = tv('admin.playersPageInfoOptimized', 'Сторінка {page} · показано основ: {shown} · всього: {total} · Firebase reads≈{reads}', {
      page: data.page,
      shown: data.groups.length,
      total: data.total ?? '—',
      reads: data.reads || 0
    });
  }
  const prev = $('#adminPlayersPrev');
  const next = $('#adminPlayersNext');
  if (prev) prev.disabled = data.page <= 1;
  if (next) next.disabled = !data.hasNext;
}

function renderUsers() {
  const body = $('#registeredPlayersBody');
  if (!body) return;
  const state = pagedPlayersState();
  const visible = state.rows;
  renderPlayersPager(state);
  if (!visible.length) {
    body.innerHTML = `<tr><td colspan="8">${escapeHtml(t('admin.noPlayers', 'No players found.'))}</td></tr>`;
    return;
  }
  body.innerHTML = visible.map(userRow).join('');
  body.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', handleUserAction));
}

function requestCard(request) {
  const role = roleLabel(request.requestedRole || 'player');
  const requestId = request.id || request.requestId || request.uid;
  const isFarmRequest = request.farmId && request.farmId !== 'main';
  const ownerProfile = users.find(user => user.uid === request.uid || user.id === request.uid) || {};
  const mainGame = getGameProfile(ownerProfile);
  const farmName = request.farmName || request.nickname || '';
  const mainNickname = mainGame.nickname || request.mainNickname || request.gameNick || '';
  const mainName = ownerProfile.displayName || request.displayName || '';
  const mainText = [mainNickname, mainName && mainName !== mainNickname ? mainName : ''].filter(Boolean).join(' / ');
  const farmText = isFarmRequest
    ? `${t('account.farm', 'Farm')}: ${farmName || '—'}${mainText ? ` • ${t('account.mainPlayer', 'Main player')}: ${mainText}` : ''}`
    : `${t('account.mainPlayer', 'Main player')}${mainText ? `: ${mainText}` : ''}`;
  return `
    <article class="admin-request" data-request-id="${escapeHtml(requestId)}" data-uid="${escapeHtml(request.uid)}">
      <div class="admin-request-main">
        <img src="${escapeHtml(request.photoURL || 'img/logo.webp')}" alt="Avatar" />
        <div>
          <strong>${escapeHtml(request.nickname || request.displayName || t('admin.player', 'Player'))}</strong>
          <span>${escapeHtml(request.email || t('admin.emailMissing', 'email not specified'))}</span>
          <small>${escapeHtml(farmText)} • ${escapeHtml(t('account.region', 'Region'))} ${escapeHtml(request.region || '—')} • ${escapeHtml(t('account.alliance', 'Alliance'))} ${escapeHtml(request.alliance || '—')} • ${escapeHtml(String(request.rank || '').toUpperCase())} • ${escapeHtml(t('account.shk', 'HQ'))} ${escapeHtml(request.shk || '—')}</small>
        </div>
      </div>
      <div class="admin-request-role">
        <span>${escapeHtml(t('admin.requestRole', 'Requests role'))}</span>
        <b>${escapeHtml(role)}</b>
      </div>
      <div class="admin-request-actions">
        <button class="btn admin-approve" type="button" data-action="approve" data-request-id="${escapeHtml(requestId)}" data-uid="${escapeHtml(request.uid)}">${escapeHtml(t('common.approve', 'Approve'))}</button>
        <button class="btn admin-decline" type="button" data-action="decline" data-request-id="${escapeHtml(requestId)}" data-uid="${escapeHtml(request.uid)}">${escapeHtml(t('common.decline', 'Decline'))}</button>
      </div>
    </article>`;
}

function renderRequests() {
  const list = $('#roleRequestsList');
  if (!list) return;
  const visible = visibleRequests();
  if (!visible.length) {
    list.innerHTML = `<div class="admin-empty">${escapeHtml(t('admin.noRequests', 'No requests yet.'))}</div>`;
    return;
  }
  list.innerHTML = visible.map(requestCard).join('');
  list.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', handleRequestAction));
}

function regionCard(item = {}) {
  const region = normalizeRegion(item.region || item.id);
  const active = item.active !== false;
  const title = item.name || item.label || `R${region}`;
  const statusKey = active ? 'admin.regionStatusActive' : 'admin.regionStatusArchived';
  const sourceKey = item.source === 'manual' ? 'admin.regionSourceManual' : 'admin.regionSourceAuto';
  const toggleKey = active ? 'admin.archiveRegion' : 'admin.restoreRegion';
  return `<article class="admin-region-card ${active ? 'is-active' : 'is-archived'}" data-region="${escapeHtml(region)}">
    <div class="admin-region-main">
      <span class="region-badge">R${escapeHtml(region)}</span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(t(statusKey, active ? 'Active' : 'Archived'))} · ${escapeHtml(t(sourceKey, item.source === 'manual' ? 'Manual' : 'Auto'))}</small>
        ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}
      </div>
    </div>
    <div class="admin-region-actions">
      <button class="btn" type="button" data-action="open-region-settings" data-region="${escapeHtml(region)}">${escapeHtml(t('admin.openSettings', 'Settings'))}</button>
      <button class="btn ${active ? 'farm-delete' : 'admin-save-row'}" type="button" data-action="toggle-region" data-region="${escapeHtml(region)}" data-active="${active ? 'false' : 'true'}">${escapeHtml(t(toggleKey, active ? 'Archive' : 'Restore'))}</button>
    </div>
  </article>`;
}

function renderRegions() {
  const list = $('#adminRegionList');
  if (!list) return;
  if (!regionsCatalog.length) {
    list.innerHTML = `<div class="admin-empty">${escapeHtml(t('admin.noRegions', 'No regions yet.'))}</div>`;
    return;
  }
  list.innerHTML = regionsCatalog.map(regionCard).join('');
}

async function saveManualRegion(event) {
  event.preventDefault();
  const region = normalizeRegion($('#adminRegionId')?.value);
  if (!region) {
    setStatus(t('admin.regionNumberRequired', 'Enter the region number.'), 'error');
    return;
  }
  try {
    setStatus(t('admin.savingRegion', 'Saving region...'), 'muted');
    await createManualRegion(currentUser, {
      region,
      name: $('#adminRegionName')?.value || `R${region}`,
      note: $('#adminRegionNote')?.value || '',
      active: $('#adminRegionActive')?.checked !== false
    });
    $('#adminRegionId') && ($('#adminRegionId').value = '');
    $('#adminRegionName') && ($('#adminRegionName').value = '');
    $('#adminRegionNote') && ($('#adminRegionNote').value = '');
    $('#adminRegionActive') && ($('#adminRegionActive').checked = true);
    await loadRegionsCatalog(true);
    switchTab('regions');
    setStatus(t('admin.regionAdded', 'Region saved.'), 'success');
  } catch (error) {
    console.error(error);
    setStatus(t('admin.regionAddFailed', 'Could not save region. Check access rights.'), 'error');
  }
}

async function handleRegionAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const region = normalizeRegion(button.dataset.region);
  if (!region) return;
  if (button.dataset.action === 'open-region-settings') {
    window.location.href = `region-settings.html?region=${encodeURIComponent(region)}`;
    return;
  }
  if (button.dataset.action !== 'toggle-region') return;
  const nextActive = button.dataset.active === 'true';
  const ok = await confirmAction({
    title: nextActive ? t('admin.restoreRegionTitle', 'Restore region?') : t('admin.archiveRegionTitle', 'Archive region?'),
    message: nextActive ? tv('admin.restoreRegionMessage', 'Region R{region} will appear in lists again.', { region }) : tv('admin.archiveRegionMessage', 'Region R{region} will be hidden from regular lists. Data will not be deleted.', { region }),
    icon: nextActive ? '↩' : '⚠',
    acceptText: nextActive ? t('common.restore', 'Restore') : t('admin.archiveRegion', 'Archive')
  });
  if (!ok) return;
  try {
    setStatus(nextActive ? t('admin.restoringRegion', 'Restoring region...') : t('admin.archivingRegion', 'Archiving region...'), 'muted');
    await archiveManualRegion(currentUser, region, nextActive);
    await loadRegionsCatalog(true);
    switchTab('regions');
    setStatus(nextActive ? t('admin.regionRestored', 'Region restored.') : t('admin.regionArchived', 'Region archived.'), 'success');
  } catch (error) {
    console.error(error);
    setStatus(t('admin.regionArchiveFailed', 'Could not update region status.'), 'error');
  }
}

async function confirmAction(options) {
  if (window.WKD?.confirmDialog) return window.WKD.confirmDialog(options);
  return window.confirm(options.title || t('admin.confirmQuestion', 'Confirm?'));
}

async function handleRequestAction(event) {
  const button = event.currentTarget;
  const approve = button.dataset.action === 'approve';
  const requestId = button.dataset.requestId || button.dataset.uid;
  if (!requestId) return;

  const ok = await confirmAction({
    title: approve ? t('admin.approveRoleTitle', 'Approve role?') : t('admin.declineRequestTitle', 'Decline request?'),
    message: approve ? t('admin.approveRoleMessage', 'The player will receive the requested role.') : t('admin.declineRequestMessage', 'The request will be declined.'),
    note: approve ? t('admin.approveRoleNote', 'The role will update in profile, region and public statistics.') : t('admin.declineRequestNote', 'The player can submit a new request.'),
    icon: approve ? '✓' : '✕',
    acceptText: approve ? t('common.approve', 'Approve') : t('common.decline', 'Decline')
  });
  if (!ok) return;

  try {
    setStatus(approve ? t('admin.approvingRole', 'Approving role...') : t('admin.decliningRequest', 'Declining request...'), 'muted');
    if (approve) await approveRoleRequest(requestId);
    else await declineRoleRequest(requestId);
    await Promise.all([loadRoleRequests(), loadPlayersPage({ reset: false })]);
    setStatus(approve ? t('admin.roleApproved', 'Role approved.') : t('admin.requestDeclined', 'Request declined.'), approve ? 'success' : 'warn');
  } catch (error) {
    console.error(error);
    setStatus(t('admin.actionFailed', 'Could not complete the action. Check access rights.'), 'error');
  }
}

async function handleUserAction(event) {
  const button = event.currentTarget;
  const action = button.dataset.action;
  const uid = button.dataset.uid;

  if (action === 'edit-user') {
    editUid = button.dataset.rowId || uid;
    renderUsers();
    return;
  }
  if (action === 'cancel-edit') {
    editUid = null;
    renderUsers();
    return;
  }
  if (action !== 'save-user' || !uid) return;

  const row = button.closest('tr');
  const values = Object.fromEntries([...row.querySelectorAll('[data-edit]')].map(input => [input.dataset.edit, input.value]));
  const farmId = button.dataset.farmId || row?.dataset.farmId || 'main';
  const ok = await confirmAction({
    title: t('admin.savePlayerTitle', 'Save player changes?'),
    message: t('admin.savePlayerMessage', 'Data will update in profile, public statistics and region.'),
    note: t('admin.approveRoleNote', 'The role will update in profile, region and public statistics.'),
    icon: '✓',
    acceptText: t('common.save', 'Save')
  });
  if (!ok) return;

  try {
    setStatus(t('admin.savingPlayer', 'Saving player...'), 'muted');
    if (farmId && farmId !== 'main') await updateFarmByAdmin(uid, farmId, values);
    else await updateUserByAdmin(uid, values);
    editUid = null;
    await loadPlayersPage({ reset: false });
    setStatus(t('admin.playerUpdated', 'Player updated.'), 'success');
  } catch (error) {
    console.error(error);
    let message = t('admin.saveFailed', 'Could not save player. Check access rights.');
    if (error?.message === 'role-not-allowed') message = t('admin.roleNotAllowed', 'You cannot assign this role with your permissions.');
    if (error?.message === 'nickname-duplicate-region') message = t('account.nicknameDuplicateRegion', 'У цьому регіоні вже є гравець з таким нікнеймом.');
    if (error?.message === 'rank-p5-limit') message = t('account.rankP5Limit', 'У цьому альянсі вже є P5. Можна мати тільки одного P5.');
    if (error?.message === 'rank-p4-limit') message = t('account.rankP4Limit', 'У цьому альянсі вже є 20 гравців P4. Ліміт P4 заповнений.');
    setStatus(message, 'error');
  }
}

function setPlayersLoading() {
  const body = $('#registeredPlayersBody');
  if (body) body.innerHTML = `<tr><td colspan="8">${escapeHtml(t('stats.loadingPlayers', 'Завантажую гравців...'))}</td></tr>`;
}

async function loadPlayersPage({ reset = false, direction = 'next' } = {}) {
  if (!currentUser || !canUseAdminPanel(currentUser, currentProfile)) return;
  if (reset) resetPlayersPage();
  setPlayersLoading();
  const cursor = playersCursorStack[playersPage - 1] || null;
  const result = await listRegisteredUsersPage({
    pageSize: ADMIN_PLAYERS_PAGE_SIZE,
    cursor,
    direction,
    filters: adminPlayerQueryFilters()
  });
  users = Array.isArray(result.users) ? result.users : [];
  playersPageMeta = {
    hasNext: Boolean(result.hasNext),
    reads: Number(result.reads || 0),
    queryMode: result.queryMode || 'indexed',
    firstDoc: result.firstDoc || null,
    lastDoc: result.lastDoc || null
  };
  renderStats();
  renderUsers();
  const msgKey = filtersAreActive() ? 'admin.playersLoadedFiltered' : 'admin.playersLoadedOptimized';
  const fallback = filtersAreActive()
    ? 'Завантажено {count} гравців за фільтром. Firebase reads≈{reads}. Якщо пошук не знайшов старого гравця, очисти фільтр або натисни Вперед.'
    : 'Завантажено {count} нових гравців. Firebase reads≈{reads}; вся колекція users не читається.';
  setStatus(tv(msgKey, fallback, { count: users.length, reads: playersPageMeta.reads }), 'success');
}

async function loadNextPlayersPage() {
  if (!playersPageMeta.hasNext) return;
  if (!playersPageMeta.lastDoc) {
    setStatus(t('admin.playersNextUnavailable', 'Наступна сторінка недоступна: немає курсора Firestore.'), 'warn');
    return;
  }
  playersCursorStack[playersPage] = playersPageMeta.lastDoc;
  playersPage += 1;
  editUid = null;
  await loadPlayersPage({ reset: false, direction: 'next' });
}

async function loadPreviousPlayersPage() {
  if (playersPage <= 1) return;
  playersPage = Math.max(1, playersPage - 1);
  playersCursorStack = playersCursorStack.slice(0, playersPage);
  editUid = null;
  await loadPlayersPage({ reset: false, direction: 'next' });
}

async function loadRoleRequests() {
  requests = await listRoleRequests('pending', { limitCount: 50 }).catch(error => {
    console.warn('[WKD] role requests unavailable:', error);
    return [];
  });
  renderStats();
  renderRequests();
}

async function loadRegionsCatalog(force = false) {
  if (regionsLoaded && !force) {
    renderRegions();
    return regionsCatalog;
  }
  const list = $('#adminRegionList');
  if (list) list.innerHTML = `<div class="admin-empty">${escapeHtml(t('admin.loadingRegions', 'Завантажую регіони...'))}</div>`;
  regionsCatalog = await listRegionCatalog({ includeInactive: true, skipPublicPlayers: true }).catch(error => {
    console.warn('[WKD] region catalog unavailable:', error);
    return [];
  });
  regionsLoaded = true;
  renderStats();
  renderRegions();
  return regionsCatalog;
}

async function loadAdminData() {
  if (!currentUser || !canUseAdminPanel(currentUser, currentProfile)) return;
  await Promise.all([
    loadAdminStatsSummary(),
    loadRoleRequests(),
    loadPlayersPage({ reset: true })
  ]);
  renderStats();
  renderUsers();
  renderUsage();
  setStatus(t('admin.dataUpdated', 'Admin data updated.'), 'success');
  maybeRunOldDocsCleanup().catch(() => null);
}

function switchTab(tab) {
  const requested = tab || 'players';
  const safeTab = requested === 'limits' && !canUseLimitsPanel() ? 'players' : requested;
  document.querySelectorAll('[data-admin-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.adminTab === safeTab));
  document.querySelectorAll('[data-admin-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.adminPanel === safeTab));
  if (safeTab === 'limits') renderUsage();
  if (safeTab === 'regions') loadRegionsCatalog().catch(console.error);
  if (safeTab === 'security') document.dispatchEvent(new CustomEvent('wkd:security-load'));
  if (window.location.hash.replace('#','') !== safeTab && safeTab !== 'players') history.replaceState(null, '', `#${safeTab}`);
}
function switchLimitTab(tab = 'firebase') {
  const safeTab = tab === 'cloudflare' ? 'cloudflare' : 'firebase';
  document.querySelectorAll('[data-limit-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.limitTab === safeTab));
  document.querySelectorAll('[data-limit-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.limitPanel === safeTab));
  renderUsage();
}
function openInitialAdminTab() {
  const hash = String(window.location.hash || '').replace('#','');
  if (hash && document.querySelector(`[data-admin-tab="${hash}"]`)) switchTab(hash);
}

function debouncePlayerSearchReload() {
  clearTimeout(playerSearchDebounce);
  playerSearchDebounce = setTimeout(() => loadPlayersPage({ reset: true }).catch(console.error), 650);
}

function bindAdminControls() {
  $('#refreshRequestsBtn')?.addEventListener('click', () => loadRoleRequests().catch(console.error));
  $('#refreshPlayersBtn')?.addEventListener('click', () => loadPlayersPage({ reset: true }).catch(console.error));
  $('#refreshUsageBtn')?.addEventListener('click', renderUsage);
  $('#refreshCloudflareUsageBtn')?.addEventListener('click', () => refreshRealCloudflareUsage().catch(console.error));
  $('#resetUsageEstimateBtn')?.addEventListener('click', () => { resetUsageEstimate(); renderUsage(); });
  $('#resetCloudflareUsageBtn')?.addEventListener('click', () => { cloudflareRealUsage = null; resetCloudflareUsageEstimate(); renderCloudflareUsage(); });
  $('#cleanupOldDocsBtn')?.addEventListener('click', () => runOldDocsCleanup().catch(console.error));
  $('#scanFirebaseArchiveBtn')?.addEventListener('click', () => runFirebaseArchiveScan().catch(console.error));
  $('#cleanupFirebaseNotificationsBtn')?.addEventListener('click', () => runFirebaseArchiveCleanup('notifications').catch(console.error));
  $('#cleanupFirebaseCampaignsBtn')?.addEventListener('click', () => runFirebaseArchiveCleanup('campaigns').catch(console.error));
  $('#cleanupFirebaseActionLogsBtn')?.addEventListener('click', () => runFirebaseArchiveCleanup('actionLogs').catch(console.error));
  $('#scanD1ArchiveBtn')?.addEventListener('click', () => runD1ArchiveScan().catch(console.error));
  $('#cleanupD1CyclesBtn')?.addEventListener('click', () => runD1ArchiveCleanup('cycles').catch(console.error));
  $('#cleanupD1SharesBtn')?.addEventListener('click', () => runD1ArchiveCleanup('shares').catch(console.error));
  $('#cleanupD1AllBtn')?.addEventListener('click', () => runD1ArchiveCleanup('all').catch(console.error));
  $('#backToProfileBtn')?.addEventListener('click', () => { window.location.href = 'profile.html'; });
  $('#adminRegionForm')?.addEventListener('submit', saveManualRegion);
  $('#adminRegionList')?.addEventListener('click', handleRegionAction);
  $('#adminNickSearch')?.addEventListener('input', debouncePlayerSearchReload);
  $('#adminAllianceSearch')?.addEventListener('input', debouncePlayerSearchReload);
  $('#adminRegionSearch')?.addEventListener('input', debouncePlayerSearchReload);
  $('#adminRoleFilter')?.addEventListener('change', () => loadPlayersPage({ reset: true }).catch(console.error));
  $('#adminIncludeFarmsToggle')?.addEventListener('change', () => { editUid = null; renderStats(); renderUsers(); });
  $('#adminPlayersPrev')?.addEventListener('click', () => loadPreviousPlayersPage().catch(console.error));
  $('#adminPlayersNext')?.addEventListener('click', () => loadNextPlayersPage().catch(console.error));
  document.querySelectorAll('[data-limit-tab]').forEach(button => button.addEventListener('click', () => switchLimitTab(button.dataset.limitTab)));
  document.querySelectorAll('[data-admin-tab]').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.adminTab)));
  document.querySelectorAll('#registeredPlayersTable [data-sort]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.sort;
    sortState = { key, dir: sortState.key === key && sortState.dir === 'asc' ? 'desc' : 'asc' };
    renderUsers();
  }));
}

async function initAdminPage() {
  if (adminReady || !$('#registeredPlayersBody')) return;
  adminReady = true;
  bindAdminControls();
  openInitialAdminTab();
  window.addEventListener('hashchange', openInitialAdminTab);

  await watchAuth(async user => {
    currentUser = user;
    if (!user) {
      setStatus(t('admin.loginRequired', 'You need to sign in with Google.'), 'warn');
      setTimeout(() => { window.location.href = 'login.html'; }, 700);
      return;
    }

    currentProfile = await ensureCurrentUserPublished(user).catch(() => getUserProfile(user.uid)).catch(() => null);
    if (!canUseAdminPanel(user, currentProfile)) {
      setLimitsAccess(false);
      document.querySelectorAll('[data-admin-tab], [data-admin-panel]').forEach(el => { el.hidden = true; });
      setSummary(t('admin.noAccessShort', 'No access'));
      setStatus(t('admin.noAccess', 'This page is available only to an admin or moderator.'), 'error');
      $('#registeredPlayersBody').innerHTML = `<tr><td colspan="8">${escapeHtml(t('admin.noPlayerAccess', 'You do not have permission to view players.'))}</td></tr>`;
      $('#roleRequestsList').innerHTML = `<div class="admin-empty">${escapeHtml(t('admin.noRequestAccess', 'You do not have permission to view requests.'))}</div>`;
      $('#adminRegionList') && ($('#adminRegionList').innerHTML = `<div class="admin-empty">${escapeHtml(t('admin.noRegionAccess', 'You do not have permission to manage regions.'))}</div>`);
      return;
    }

    document.querySelectorAll('[data-admin-tab], [data-admin-panel]').forEach(el => {
      if (!el.classList.contains('admin-limits-only')) el.hidden = false;
    });
    setLimitsAccess(canUseLimitsPanel(user, currentProfile));
    openInitialAdminTab();
    setStatus(t('admin.loadingPanel', 'Loading admin panel...'), 'muted');
    renderUsage();
    await loadAdminData();
  });
}

document.addEventListener('wkd:partials-ready', initAdminPage);
document.addEventListener('DOMContentLoaded', () => setTimeout(initAdminPage, 0));

document.addEventListener('wkd:language-changed', () => {
  if (!adminReady) return;
  renderStats();
  renderUsers();
  renderRequests();
  renderRegions();
  renderUsage();
  if (currentUser && currentProfile && canUseAdminPanel(currentUser, currentProfile)) {
    setStatus(t('admin.statusUpdated', 'Admin data updated.'), 'success');
  }
});
