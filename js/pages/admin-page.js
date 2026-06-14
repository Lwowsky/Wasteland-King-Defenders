import { watchAuth } from '../services/firebase-service.js';
import { cleanupD1Archives, inspectD1Storage, inspectSecretLinks, rotateSecretLinks, scanD1Archives } from '../services/d1-archive-cleanup.js?v=213';
import { fetchRealCloudflareUsage, getCachedCloudflareUsage, clearCachedCloudflareUsage } from '../services/cloudflare-usage.js?v=213';
import { fetchGitHubUsage, getCachedGitHubUsage, clearCachedGitHubUsage } from '../services/github-usage.js?v=213';
import { getUsageEstimate, resetUsageEstimate } from '../services/usage-tracker.js?v=213';
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
  getAdminCounters,
  isOwnerUser,
  listRegisteredUsersPage,
  rebuildAdminUsersIndex,
  listRoleRequests,
  roleLabel,
  updateUserByAdmin,
  updateFarmByAdmin,
  scanOldFirebaseArchives,
  cleanupOldFirebaseArchives
} from '../services/user-db.js?v=213';
import {
  archiveManualRegion,
  cleanupOldPublicDocuments,
  cleanupOldRegionRegistrations,
  createManualRegion,
  inspectOldRegionRegistrations,
  listRegionCatalog,
  normalizeRegion
} from '../services/region-db.js?v=213';

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
let requestsLoaded = false;
let adminCounters = null;
let regionsCatalog = [];
let regionsLoaded = false;
let sortState = { key: 'createdAt', dir: 'desc' };
let editUid = null;
const ADMIN_PLAYERS_PAGE_SIZE = 10;
let playersPage = 1;
let playersCursorStack = [null];
let playersPageMeta = { hasNext: false, reads: 0, queryMode: 'indexed' };
let playerSearchDebounce = null;
let cloudflareRealUsage = getCachedCloudflareUsage();
let cloudflareUsageLoading = false;
let githubUsage = getCachedGitHubUsage();
let githubUsageLoading = false;
let oldFirestoreCleanupCount = 0;
let oldFirestoreAutoRunning = false;
let d1AutoCleanupRunning = false;
const OLD_FIRESTORE_AUTO_KEY = 'wkd.admin.clean.firestoreRegs.auto.v198';
const D1_AUTO_CLEANUP_KEY = 'wkd.admin.clean.d1SharesFinal.auto.v200';
const ADMIN_REGION_CACHE_TTL_MS = 5 * 60 * 1000;
const ADMIN_REGION_CACHE_VERSION = 'v145';

function adminCacheKey(name) {
  const uid = currentUser?.uid || 'anonymous';
  return `wkd.admin.${name}.${ADMIN_REGION_CACHE_VERSION}:${uid}`;
}

function readAdminJsonCache(name, ttlMs = ADMIN_REGION_CACHE_TTL_MS) {
  try {
    const raw = localStorage.getItem(adminCacheKey(name));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data) || Date.now() - Number(parsed.savedAt || 0) > ttlMs) return null;
    return parsed.data;
  } catch (_) {
    return null;
  }
}

function writeAdminJsonCache(name, data) {
  try {
    localStorage.setItem(adminCacheKey(name), JSON.stringify({ savedAt: Date.now(), data }));
  } catch (_) {}
}

function clearAdminJsonCache(name) {
  try { localStorage.removeItem(adminCacheKey(name)); } catch (_) {}
}

function readAdminObjectCache(name, ttlMs = ADMIN_REGION_CACHE_TTL_MS) {
  try {
    const raw = localStorage.getItem(adminCacheKey(name));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data || Date.now() - Number(parsed.savedAt || 0) > ttlMs) return null;
    return parsed.data;
  } catch (_) {
    return null;
  }
}

function writeAdminObjectCache(name, data) {
  try { localStorage.setItem(adminCacheKey(name), JSON.stringify({ savedAt: Date.now(), data })); } catch (_) {}
}

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

function adminAllianceHue(value = '') {
  if (window.WKD?.Badges?.hashHue) return window.WKD.Badges.hashHue(String(value || '—').trim() || '—');
  let hash = 2166136261;
  for (const ch of String(value || '—').trim() || '—') {
    hash ^= ch.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return ((hash % 360) + 360) % 360;
}

function getAllianceBadge(alliance, region = '') {
  return window.WKD?.Badges?.alliance
    ? window.WKD.Badges.alliance(alliance || '—', { region, preserve: true, hue: adminAllianceHue(alliance || '—') })
    : `<span class="alliance-badge"><span class="badge-dot"></span><span>${escapeHtml(alliance || '—')}</span></span>`;
}


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

function canRebuildAdminIndex(user = currentUser, profile = currentProfile) {
  return Boolean(user && (isOwnerUser(user, profile) || String(profile?.role || '').toLowerCase() === 'admin'));
}

function updateRebuildIndexAccess() {
  const btn = $('#rebuildAdminIndexBtn');
  if (btn) btn.hidden = !canRebuildAdminIndex();
}

function setLimitsAccess(enabled) {
  document.querySelectorAll('.admin-limits-only').forEach(el => { el.hidden = !enabled; });
  if (!enabled && ['limits','clean'].includes(window.location.hash.replace('#', ''))) switchTab('players');
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
    alliance: String($('#adminAllianceSearch')?.value || '').trim(),
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

async function loadAdminCounters(force = false) {
  if (!force) {
    const cached = readAdminObjectCache('adminCounters');
    if (cached) {
      adminCounters = cached;
      renderStats();
      return adminCounters;
    }
  }
  adminCounters = await getAdminCounters().catch(error => {
    console.warn('[WKD] admin counters unavailable:', error?.code || error?.message || error);
    return null;
  });
  if (adminCounters) writeAdminObjectCache('adminCounters', adminCounters);
  renderStats();
  return adminCounters;
}

function rowMatchesFilters(row, filters = filterValues()) {
  if (!canDisplayRow(row)) return false;
  if (filters.role !== 'all' && rowRole(row) !== filters.role) return false;
  const game = row.game || {};
  const userNick = String(game.nickname || '').toLowerCase();
  const mainNick = String(row.mainNickname || '').toLowerCase();
  const userAlliance = allianceTag3(game.alliance || '');
  const filterAlliance = allianceTag3(filters.alliance || '');
  const userRegion = String(game.region || '').toLowerCase();
  return (!filters.nick || userNick.includes(filters.nick) || mainNick.includes(filters.nick))
    && (!filterAlliance || userAlliance === filterAlliance)
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
  return {
    groups,
    rows,
    page: playersPage,
    pageCount: null,
    hasNext: Boolean(playersPageMeta.hasNext),
    total: null,
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
    <b>${escapeHtml(used)}</b>
    <small>${escapeHtml(t('admin.usageRemaining', 'залишилось'))} · ${escapeHtml(remaining)} / ${escapeHtml(limit)}</small>
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
    <b>${escapeHtml(used)}</b>
    <small>${escapeHtml(t('admin.usageRemaining', 'залишилось'))} · ${escapeHtml(remaining)} / ${escapeHtml(limit)}</small>
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
    <b>${escapeHtml(used)}</b>
    <small>${escapeHtml(t('admin.usageRemaining', 'залишилось'))} · ${escapeHtml(remaining)} / ${escapeHtml(limit)}</small>
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

function githubDuration(value = 0) {
  const ms = Math.max(0, Number(value) || 0);
  if (!ms) return '—';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  return rest ? `${min}m ${rest}s` : `${min}m`;
}

function githubValueCardHtml(key, value = '—', detail = '') {
  return `<article class="admin-usage-card admin-usage-card--static github-usage-card">
    <span>${escapeHtml(t(`admin.github.${key}.label`, key))}</span>
    <b class="github-card-value">${escapeHtml(String(value || '—'))}</b>
    <small>${escapeHtml(t(`admin.github.${key}.detail`, detail))}</small>
  </article>`;
}

function githubBytesCardHtml(key, usedBytes = 0, limitBytes = 0, detail = '') {
  const row = { used: Math.max(0, Number(usedBytes) || 0), limit: Math.max(0, Number(limitBytes) || 0) };
  row.remaining = Math.max(0, row.limit - row.used);
  row.percent = row.limit ? Math.max(0, Math.min(100, (row.used / row.limit) * 100)) : 0;
  return `<article class="admin-usage-card github-usage-card">
    <span>${escapeHtml(t(`admin.github.${key}.label`, key))}</span>
    <b class="github-card-value">${escapeHtml(formatBytes(row.used))}</b>
    <small>${escapeHtml(t('admin.usageRemaining', 'залишилось'))} · ${escapeHtml(formatBytes(row.remaining))} / ${escapeHtml(formatBytes(row.limit))}</small>
    <div class="admin-usage-bar" aria-hidden="true"><i style="width:${row.percent}%"></i></div>
    <small>${escapeHtml(t(`admin.github.${key}.detail`, detail))}</small>
  </article>`;
}

function githubNumberUsageCardHtml(key, row = {}, unitKey = '', detail = '') {
  const used = Math.max(0, Number(row.used) || 0);
  const limit = Math.max(0, Number(row.limit) || 0);
  const remaining = Math.max(0, Number(row.remaining ?? (limit - used)) || 0);
  const percent = limit ? Math.max(0, Math.min(100, Number(row.percent) || ((used / limit) * 100))) : 0;
  const unit = unitKey ? t(unitKey, '') : '';
  const format = value => `${formatCompactNumber(value)}${unit ? ` ${unit}` : ''}`;
  return `<article class="admin-usage-card github-usage-card">
    <span>${escapeHtml(t(`admin.github.${key}.label`, key))}</span>
    <b class="github-card-value">${escapeHtml(format(used))}</b>
    <small>${escapeHtml(t('admin.usageRemaining', 'залишилось'))} · ${escapeHtml(format(remaining))} / ${escapeHtml(format(limit))}</small>
    <div class="admin-usage-bar" aria-hidden="true"><i style="width:${percent}%"></i></div>
    <small>${escapeHtml(t(`admin.github.${key}.detail`, detail))}</small>
  </article>`;
}

function githubReferenceCardHtml(key, value = '', detail = '') {
  return `<article class="admin-usage-card admin-usage-card--static github-usage-card">
    <span>${escapeHtml(t(`admin.github.${key}.label`, key))}</span>
    <b class="github-card-value">${escapeHtml(value || '—')}</b>
    <small>${escapeHtml(t(`admin.github.${key}.detail`, detail))}</small>
  </article>`;
}

function firebaseStaticLimitCardHtml(key, value, detail = '') {
  return `<article class="admin-usage-card admin-usage-card--static">
    <span>${escapeHtml(t(`admin.firebase.${key}.label`, key))}</span>
    <b>${escapeHtml(value)}</b>
    <small>${escapeHtml(t(`admin.firebase.${key}.detail`, detail))}</small>
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
      firebaseStaticLimitCardHtml('storage', '1 GiB', 'Firestore Spark storage'),
      firebaseStaticLimitCardHtml('outboundTraffic', '10 GiB / month', 'Firestore outbound transfer'),
      firebaseStaticLimitCardHtml('authDailyActiveUsers', '3 000 / day', 'Firebase Auth Spark Tier 1 DAU reference')
    ].join('');
  }
  if (note) note.textContent = t('admin.usageNote', 'Це орієнтовний локальний лічильник сайту, а не офіційні цифри Firebase. Він оновлюється тільки діями цього браузера. Точні цифри дивись вручну у Firebase Console → Firestore → Usage.');
  renderCloudflareUsage();
  renderGitHubUsage();
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
      const noteKey = cloudflareRealUsage.fromCache ? 'admin.cloudflareCachedNote' : 'admin.cloudflareRealNote';
      const noteFallback = cloudflareRealUsage.fromCache
        ? 'Збережені реальні дані Cloudflare: {start} — {end}. Останнє оновлення: {updated}. Натисни Оновити, щоб взяти свіжі цифри.'
        : 'Реальні дані Cloudflare за сьогодні UTC: {start} — {end}. Оновлено: {updated}.';
      note.textContent = `${tv(noteKey, noteFallback, {
        start: period.start || period.dateStart || '—',
        end: period.end || period.dateEnd || '—',
        updated: cloudflareRealUsage.generatedAt || cloudflareRealUsage.cachedAt || '—'
      })}${errors}`;
    }
    return;
  }
  grid.innerHTML = [
    staticLimitCardHtml('workerRequests', '100 000 / day', 'Workers Free requests'),
    staticLimitCardHtml('d1RowsRead', '5 000 000 / day', 'D1 Free rows read'),
    staticLimitCardHtml('d1RowsWritten', '100 000 / day', 'D1 Free rows written'),
    staticLimitCardHtml('d1Storage', '5 GB total', 'D1 Free storage per account'),
    staticLimitCardHtml('d1DatabaseSize', '500 MB / DB', 'D1 Free maximum database size'),
    staticLimitCardHtml('workerCpu', '10 ms / request', 'Workers Free CPU time'),
    staticLimitCardHtml('workerStaticAssets', 'free', 'Static asset requests'),
    staticLimitCardHtml('d1QueriesPerInvocation', '50', 'D1 queries per Worker invocation on Free')
  ].join('');
  const note = $('#cloudflareUsageNote');
  if (note) note.textContent = t('admin.cloudflareNoCacheNote', 'Показані довідкові ліміти Cloudflare. Натисни Оновити, щоб отримати реальні дані й зберегти їх локально для економії запитів.');
}

function renderGitHubUsage() {
  const grid = $('#githubUsageGrid');
  const note = $('#githubUsageNote');
  if (!grid) return;
  if (githubUsageLoading) {
    grid.innerHTML = `<div class="admin-empty">${escapeHtml(t('admin.githubLoading', 'Завантажую GitHub дані...'))}</div>`;
    if (note) note.textContent = t('admin.githubLoading', 'Завантажую GitHub дані...');
    return;
  }
  if (githubUsage) {
    const repo = githubUsage.repo || {};
    const pages = githubUsage.pages || {};
    const actions = githubUsage.actions || {};
    const limits = githubUsage.limits || {};
    const repoSizeLimit = Number(limits.pagesSiteSizeBytes?.limit || 1024 * 1024 * 1024);
    grid.innerHTML = [
      githubValueCardHtml('repo', repo.fullName || '—', 'GitHub repository'),
      githubBytesCardHtml('repoSize', Number(repo.sizeKb || 0) * 1024, repoSizeLimit, 'Repository size compared with GitHub Pages site soft size'),
      githubValueCardHtml('pagesStatus', pages.status || '—', 'GitHub Pages status'),
      githubValueCardHtml('pagesUrl', pages.htmlUrl || pages.cname || '—', 'Published GitHub Pages URL'),
      githubValueCardHtml('actionsLatest', `${actions.latestStatus || '—'}${actions.latestConclusion ? ` / ${actions.latestConclusion}` : ''}`, 'Latest GitHub Actions run'),
      githubValueCardHtml('actionsDuration', githubDuration(actions.latestDurationMs), 'Latest run duration approximation'),
      githubValueCardHtml('actionsRuns', formatCompactNumber(actions.totalRuns || 0), 'Total workflow runs returned by GitHub'),
      githubNumberUsageCardHtml('actionsMinutesMonth', limits.actionsMinutesMonth || {}, 'admin.githubUnitMinutes', 'Approximate repo Actions minutes this month from returned workflow runs'),
      githubNumberUsageCardHtml('pagesBuildsHour', limits.pagesBuildsHour || {}, 'admin.githubUnitBuilds', 'GitHub Pages soft build limit per hour'),
      githubReferenceCardHtml('pagesBandwidthMonth', '100 GB / month', 'GitHub does not return exact Pages bandwidth through this repo API'),
      githubReferenceCardHtml('actionsCache', '10 GB / repo', 'GitHub Actions cache reference limit')
    ].join('');
    if (note) {
      const errors = Array.isArray(githubUsage.partialErrors) && githubUsage.partialErrors.length
        ? ` ${tv('admin.githubPartialNote', 'Часткові помилки: {errors}', { errors: githubUsage.partialErrors.map(item => `${item.source}: ${item.error}`).join('; ') })}`
        : '';
      const key = githubUsage.fromCache ? 'admin.githubCachedNote' : (githubUsage.real ? 'admin.githubRealNote' : 'admin.githubStaticNote');
      const fallback = githubUsage.fromCache
        ? 'Збережені GitHub дані. Останнє оновлення: {updated}.'
        : (githubUsage.real ? 'Реальні GitHub дані через Worker secret. Оновлено: {updated}.' : 'Показані довідкові GitHub ліміти. Для реальних даних додай GITHUB_TOKEN, GITHUB_OWNER і GITHUB_REPO у Worker secrets.');
      note.textContent = `${tv(key, fallback, { updated: githubUsage.generatedAt || githubUsage.cachedAt || '—' })}${errors}`;
    }
    return;
  }
  grid.innerHTML = [
    githubReferenceCardHtml('actionsMinutesMonth', '2 000 min / month', 'GitHub Free included private Actions minutes; public repos are generally free'),
    githubReferenceCardHtml('pagesSize', '1 GB', 'Published GitHub Pages site size'),
    githubReferenceCardHtml('pagesBandwidthMonth', '100 GB / month', 'GitHub Pages soft bandwidth limit'),
    githubReferenceCardHtml('pagesBuildsHour', '10 / hour', 'GitHub Pages soft build limit'),
    githubReferenceCardHtml('actionsCache', '10 GB / repo', 'GitHub Actions cache reference limit')
  ].join('');
  if (note) note.textContent = t('admin.githubStaticNote', 'Показані довідкові GitHub ліміти. Для реальних даних додай GITHUB_TOKEN, GITHUB_OWNER і GITHUB_REPO у Worker secrets.');
}

async function refreshGitHubUsage() {
  if (!currentUser || !canUseLimitsPanel()) return;
  githubUsageLoading = true;
  renderGitHubUsage();
  try {
    githubUsage = await fetchGitHubUsage(currentUser);
  } catch (error) {
    console.warn('[WKD] GitHub usage unavailable:', error);
    githubUsage = getCachedGitHubUsage();
    const note = $('#githubUsageNote');
    if (note) note.textContent = githubUsage
      ? t('admin.githubFetchFailedUsingCache', 'Не вдалося отримати свіжі GitHub дані. Показую кеш.')
      : t('admin.githubFetchFailed', 'Не вдалося отримати GitHub дані. Перевір Worker secrets: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO.');
  } finally {
    githubUsageLoading = false;
    renderGitHubUsage();
  }
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
    note: tv('admin.d1ArchiveCleanNote', 'Вік: {days}. Якщо вибрано “Усі старі”, активний цикл усе одно не видаляється.', { days: selectedD1CleanupAge() ? `${selectedD1CleanupAge()}+` : t('admin.cleanupAgeAny', 'Усі старі') }),
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


function setSecretLinksStatus(text, type = 'muted') {
  const box = $('#secretLinksStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}

function secretLinkLabel(type = '') {
  const labels = {
    form: t('admin.secretLinkTypeForm', 'Форма заявки'),
    table: t('admin.secretLinkTypeTable', 'Таблиця регіону'),
    final: t('admin.secretLinkTypeFinal', 'Фінальний план')
  };
  return labels[String(type || '').toLowerCase()] || type || '—';
}

function secretLinkState(item = {}) {
  if (item.revoked) return t('admin.secretLinkRevoked', 'відкликано');
  if (item.expired) return t('admin.secretLinkExpired', 'прострочено');
  if (item.active) return t('admin.secretLinkActive', 'активне');
  return t('admin.secretLinkOld', 'старе');
}

function renderSecretLinks(result = {}) {
  const box = $('#secretLinksList');
  if (!box) return;
  const links = Array.isArray(result.links) ? result.links : [];
  if (!links.length) {
    box.innerHTML = `<div class="admin-empty">${escapeHtml(t('admin.secretLinksEmpty', 'Секретних посилань для цього регіону ще немає.'))}</div>`;
    return;
  }
  const rows = links.map(item => {
    const shortUrl = item.shortUrl || item.publicUrl || '';
    const created = item.createdAtMs ? formatUserDate(new Date(item.createdAtMs)) : '—';
    const updated = item.updatedAtMs ? formatUserDate(new Date(item.updatedAtMs)) : '—';
    const expires = item.expiresAtMs ? formatUserDate(new Date(item.expiresAtMs)) : t('admin.secretLinkNoExpiry', 'без строку');
    const state = secretLinkState(item);
    return `<tr>
      <td>${escapeHtml(secretLinkLabel(item.type))}</td>
      <td><code>${escapeHtml(item.code)}</code></td>
      <td>${escapeHtml(state)}</td>
      <td>${escapeHtml(item.cycleId || '—')}</td>
      <td>${escapeHtml(created || '—')}</td>
      <td>${escapeHtml(updated || '—')}</td>
      <td>${escapeHtml(expires || '—')}</td>
      <td>${shortUrl ? `<button class="btn btn-small" type="button" data-copy-secret-link="${escapeHtml(shortUrl)}">${escapeHtml(t('common.copy', 'Копіювати'))}</button>` : '—'}</td>
    </tr>`;
  }).join('');
  box.innerHTML = `<div class="admin-table-wrap"><table class="admin-table compact">
    <thead><tr>
      <th>${escapeHtml(t('admin.secretLinkType', 'Тип'))}</th>
      <th>${escapeHtml(t('admin.secretLinkCode', 'Код'))}</th>
      <th>${escapeHtml(t('admin.secretLinkStatus', 'Статус'))}</th>
      <th>${escapeHtml(t('admin.secretLinkCycle', 'Цикл'))}</th>
      <th>${escapeHtml(t('admin.secretLinkCreated', 'Створено'))}</th>
      <th>${escapeHtml(t('admin.secretLinkUpdated', 'Оновлено'))}</th>
      <th>${escapeHtml(t('admin.secretLinkExpires', 'Діє до'))}</th>
      <th>${escapeHtml(t('admin.actions', 'Дії'))}</th>
    </tr></thead><tbody>${rows}</tbody>
  </table></div>`;
  box.querySelectorAll('[data-copy-secret-link]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const value = btn.getAttribute('data-copy-secret-link') || '';
      try {
        await navigator.clipboard.writeText(value);
        setSecretLinksStatus(t('admin.secretLinkCopied', 'Секретне посилання скопійовано.'), 'success');
      } catch (_) {
        setSecretLinksStatus(value, 'muted');
      }
    });
  });
}

async function inspectSecretLinksPanel() {
  if (!currentUser || !canUseLimitsPanel()) return null;
  const region = selectedCleanRegion();
  if (!region) {
    setSecretLinksStatus(t('admin.cleanRegionRequired', 'Вибери регіон для перевірки.'), 'warn');
    return null;
  }
  setSecretLinksStatus(t('admin.secretLinksChecking', 'Перевіряю секретні посилання...'), 'muted');
  try {
    const result = await inspectSecretLinks(currentUser, { region });
    renderSecretLinks(result);
    const counts = result.counts || {};
    setSecretLinksStatus(tv('admin.secretLinksChecked', 'Секретні посилання: активні {active}, прострочені {expired}, відкликані {revoked}, всього {total}. Firebase reads: 0.', {
      active: counts.active || 0,
      expired: counts.expired || 0,
      revoked: counts.revoked || 0,
      total: counts.total || 0
    }), 'success');
    renderUsage();
    return result;
  } catch (error) {
    console.error(error);
    setSecretLinksStatus(t('admin.secretLinksCheckFailed', 'Не вдалося перевірити секретні посилання.'), 'error');
    return null;
  }
}

async function rotateSecretLinksPanel(scope = 'all') {
  if (!currentUser || !canUseLimitsPanel()) return null;
  const region = selectedCleanRegion();
  if (!region) {
    setSecretLinksStatus(t('admin.cleanRegionRequired', 'Вибери регіон для очищення.'), 'warn');
    return null;
  }
  const label = secretLinkRotateLabel(scope);
  const ok = await confirmAction({
    title: tv('admin.secretLinksRotateTitle', 'Перевипустити {scope}?', { scope: label }),
    message: t('admin.secretLinksRotateMessage', 'Старі активні посилання вибраного типу перестануть працювати. Форма отримає новий короткий код. Таблицю і фінальний план треба буде опублікувати/поділитись знову, щоб створити нові посилання.'),
    icon: '🔐',
    acceptText: t('admin.secretLinksRotateAccept', 'Перевипустити')
  });
  if (!ok) return null;
  setSecretLinksStatus(tv('admin.secretLinksRotating', 'Перевипускаю {scope}...', { scope: label }), 'muted');
  try {
    const result = await rotateSecretLinks(currentUser, { region, scope });
    renderSecretLinks(result);
    const rotated = result.rotated || {};
    setSecretLinksStatus(tv('admin.secretLinksRotated', 'Готово. Форма: {form}, таблиці відкликано: {table}, фінальні плани відкликано: {final}. Firebase: 0.', {
      form: rotated.form || 0,
      table: rotated.table || 0,
      final: rotated.final || 0
    }), 'success');
    renderUsage();
    return result;
  } catch (error) {
    console.error(error);
    setSecretLinksStatus(t('admin.secretLinksRotateFailed', 'Не вдалося перевипустити секретні посилання.'), 'error');
    return null;
  }
}

function secretLinkRotateLabel(scope = 'all') {
  const labels = {
    form: t('admin.secretLinksScopeForm', 'силку форми'),
    table: t('admin.secretLinksScopeTable', 'силки таблиці'),
    final: t('admin.secretLinksScopeFinal', 'силки фінального плану'),
    all: t('admin.secretLinksScopeAll', 'усі секретні посилання')
  };
  return labels[String(scope || 'all').toLowerCase()] || labels.all;
}

function d1StorageItemLabel(key = '') {
  const labels = {
    activePlayers: t('admin.d1StorageActivePlayers', 'Активні гравці'),
    archivedPlayers: t('admin.d1StorageArchivedPlayers', 'Гравці в архівних циклах'),
    cycleIndex: t('admin.d1StorageCycleIndex', 'Індекс циклів'),
    legacySnapshots: t('admin.d1StorageLegacySnapshots', 'Старі JSON snapshots'),
    towerPlans: t('admin.d1StorageTowerPlans', 'Плани турелей'),
    formSettings: t('admin.d1StorageFormSettings', 'Налаштування форм'),
    finalPlanShares: t('admin.d1StorageFinalPlanShares', 'Секретні фінальні плани'),
    regionTableShares: t('admin.d1StorageTableShares', 'Секретні таблиці регіону'),
    alliances: t('admin.d1StorageAlliances', 'Альянси / кольори'),
    actionLogs: t('admin.d1StorageActionLogs', 'Журнали дій'),
    notifications: t('admin.d1StorageNotifications', 'Вхідні повідомлення'),
    sentMessages: t('admin.d1StorageSentMessages', 'Відправлені повідомлення'),
    campaigns: t('admin.d1StorageCampaigns', 'Кампанії повідомлень'),
    notificationDirectory: t('admin.d1StorageDirectory', 'Довідник отримувачів'),
    publicStats: t('admin.d1StoragePublicStats', 'Публічна статистика'),
    activeIndexes: t('admin.d1StorageActiveIndexes', 'Активні індекси')
  };
  return labels[key] || key;
}

function renderD1StorageDetails(result = {}) {
  const box = $('#d1StorageBreakdown');
  if (!box) return;
  const items = Array.isArray(result.items) ? result.items.slice().sort((a, b) => Number(b.bytes || 0) - Number(a.bytes || 0)) : [];
  if (!items.length) {
    box.innerHTML = `<div class="admin-empty">${escapeHtml(t('admin.d1StorageNoDetails', 'Деталі D1 ще не завантажені.'))}</div>`;
    return;
  }
  const totalBytes = Number(result.totalBytes || 0) || items.reduce((sum, item) => sum + Number(item.bytes || 0), 0);
  const totalRows = Number(result.totalRows || 0) || items.reduce((sum, item) => sum + Number(item.rows || 0), 0);
  const rows = items.map(item => {
    const cleanup = item.cleanup ? d1ArchiveScopeLabel(item.cleanup) : (item.active ? t('admin.d1StorageKeep', 'не чистити') : t('admin.d1StorageManual', 'вручну'));
    return `<tr>
      <td>${escapeHtml(d1StorageItemLabel(item.key))}</td>
      <td>${formatCompactNumber(Number(item.rows || 0))}</td>
      <td>${escapeHtml(formatBytes(item.bytes || 0))}</td>
      <td>${escapeHtml(cleanup)}</td>
    </tr>`;
  }).join('');
  box.innerHTML = `
    <div class="region-note admin-usage-note" data-type="success">${escapeHtml(tv('admin.d1StorageSummary', 'Разом у D1 деталях: {rows} рядків, приблизно {bytes}.', { rows: formatCompactNumber(totalRows), bytes: formatBytes(totalBytes) }))}</div>
    <div class="admin-table-wrap admin-d1-details-wrap">
      <table class="admin-table admin-d1-details-table">
        <thead><tr><th>${escapeHtml(t('admin.d1StorageTable', 'Таблиця'))}</th><th>${escapeHtml(t('admin.rows', 'Рядків'))}</th><th>${escapeHtml(t('admin.approxSize', 'Приблизний розмір'))}</th><th>${escapeHtml(t('admin.cleanup', 'Чистка'))}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function runD1StorageInspect() {
  if (!currentUser || !canUseLimitsPanel()) return;
  const button = $('#inspectD1StorageBtn');
  if (button) button.disabled = true;
  try {
    setD1ArchiveStatus(t('admin.d1StorageInspecting', 'Перевіряю D1 таблиці...'), 'muted');
    const result = await inspectD1Storage(currentUser, { region: selectedCleanRegion() || '' });
    renderD1StorageDetails(result);
    setD1ArchiveStatus(tv('admin.d1StorageInspectDone', 'D1 перевірено: {rows} рядків, приблизно {bytes}.', { rows: formatCompactNumber(result.totalRows || 0), bytes: formatBytes(result.totalBytes || 0) }), 'success');
  } catch (error) {
    console.error(error);
    setD1ArchiveStatus(t('admin.d1StorageInspectFailed', 'Не вдалося перевірити D1 таблиці.'), 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

function d1ArchiveScopeLabel(scope = 'all') {
  const labels = {
    cycles: t('admin.d1ArchiveScopeCycles', 'старі цикли'),
    shares: t('admin.d1ArchiveScopeShares', 'секретні посилання'),
    campaigns: t('admin.d1ArchiveScopeCampaigns', 'D1 кампанії'),
    messages: t('admin.d1ArchiveScopeMessages', 'старі повідомлення'),
    logs: t('admin.d1ArchiveScopeLogs', 'старі журнали'),
    finalPlans: t('admin.d1ArchiveScopeFinalPlans', 'старі фінальні плани'),
    all: t('admin.d1ArchiveScopeAll', 'D1 архів')
  };
  return labels[scope] || labels.all;
}

function d1ArchiveResultText(result = {}) {
  return tv('admin.d1ArchiveResult', 'Знайдено: {found}. Видалено: {deleted}. Перевірено: {scanned}. Цикли: {cycles}. Посилання: {shares}. Кампанії: {campaigns}. Повідомлення: {messages}. Журнали: {logs}. Фінальні плани: {finalPlans}.', {
    found: Number(result.found || 0),
    deleted: Number(result.deleted || 0),
    scanned: Number(result.scanned || 0),
    cycles: Number(result.cycles || 0),
    shares: Number(result.shares || 0),
    campaigns: Number(result.campaigns || 0),
    messages: Number(result.messages || 0),
    logs: Number(result.logs || 0),
    finalPlans: Number(result.finalPlans || 0)
  }) + (result.hasMore ? ` ${t('admin.d1ArchiveHasMore', 'Є ще записи — можна натиснути ще раз.')}` : '');
}

async function runD1ArchiveScan() {
  if (!currentUser || !canUseLimitsPanel()) return;
  try {
    setD1ArchiveStatus(t('admin.d1ArchiveScanning', 'Перевіряю D1 архів...'), 'muted');
    const result = await scanD1Archives(currentUser, { scope: 'all', retentionDays: selectedD1CleanupAge(), maxScan: 500 });
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
    note: tv('admin.d1ArchiveCleanNote', 'Вік: {days}. Якщо вибрано “Усі старі”, активний цикл усе одно не видаляється.', { days: selectedD1CleanupAge() ? `${selectedD1CleanupAge()}+` : t('admin.cleanupAgeAny', 'Усі старі') }),
    icon: '🧹',
    acceptText: t('admin.d1ArchiveCleanAccept', 'Очистити')
  });
  if (!ok) return;
  try {
    setD1ArchiveStatus(tv('admin.d1ArchiveCleaning', 'Очищаю {scope}...', { scope: label }), 'muted');
    const result = await cleanupD1Archives(currentUser, { scope, retentionDays: selectedD1CleanupAge(), maxDeletes: 500 });
    setD1ArchiveStatus(d1ArchiveResultText(result), Number(result.deleted || 0) ? 'success' : 'muted');
  } catch (error) {
    console.error(error);
    setD1ArchiveStatus(t('admin.d1ArchiveCleanFailed', 'Не вдалося очистити D1 архів.'), 'error');
  }
}

async function runD1DatabaseOptimize() {
  if (!currentUser || !canUseLimitsPanel()) return;
  const ok = await confirmAction({
    title: t('admin.optimizeDatabaseTitle', 'Оптимізувати базу?'),
    message: t('admin.optimizeDatabaseMessage', 'Будуть маленькими пачками очищені старі цикли, старі фінальні плани, прострочені секретні посилання, старі повідомлення і журнали. Активний цикл не чіпається.'),
    note: tv('admin.d1ArchiveCleanNote', 'Вік: {days}. Якщо вибрано “Усі старі”, активний цикл усе одно не видаляється.', { days: selectedD1CleanupAge() ? `${selectedD1CleanupAge()}+` : t('admin.cleanupAgeAny', 'Усі старі') }),
    icon: '🧹',
    acceptText: t('admin.optimizeDatabase', 'Оптимізувати базу')
  });
  if (!ok) return;
  try {
    setD1ArchiveStatus(t('admin.optimizeDatabaseRunning', 'Оптимізую базу маленькою пачкою...'), 'muted');
    const result = await cleanupD1Archives(currentUser, { scope: 'all', retentionDays: selectedD1CleanupAge(), maxDeletes: 500 });
    setD1ArchiveStatus(`${d1ArchiveResultText(result)} ${t('admin.optimizeDatabaseDone', 'Готово. Якщо є ще записи — натисни ще раз.')}`, Number(result.deleted || 0) ? 'success' : 'muted');
    await runD1StorageInspect().catch(() => null);
  } catch (error) {
    console.error(error);
    setD1ArchiveStatus(t('admin.optimizeDatabaseFailed', 'Не вдалося оптимізувати базу.'), 'error');
  }
}

function selectedCleanRegion() {
  const select = $('#cleanFirestoreRegionSelect');
  return String(select?.value || '').replace(/[^0-9]/g, '');
}
function selectedFirestoreCleanupAge() {
  const value = Number($('#cleanFirestoreAgeSelect')?.value || 14);
  return Number.isFinite(value) ? Math.max(0, Math.min(3650, value)) : 14;
}
function selectedD1CleanupAge() {
  const value = Number($('#cleanD1AgeSelect')?.value || 14);
  return Number.isFinite(value) ? Math.max(0, Math.min(3650, value)) : 14;
}

function setOldFirestoreStatus(text, type = 'muted') {
  const box = $('#oldFirestoreRegistrationsStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}

function renderCleanRegions() {
  const select = $('#cleanFirestoreRegionSelect');
  if (!select) return;
  const previous = selectedCleanRegion();
  const items = (regionsCatalog || []).filter(item => item?.region).sort((a, b) => Number(a.region) - Number(b.region) || String(a.region).localeCompare(String(b.region)));
  select.innerHTML = items.length
    ? items.map(item => `<option value="${escapeHtml(item.region)}">${escapeHtml(item.name || `R${item.region}`)}</option>`).join('')
    : `<option value="">${escapeHtml(t('admin.noRegions', 'Немає регіонів'))}</option>`;
  if (previous && items.some(item => String(item.region) === previous)) select.value = previous;
}

function renderOldFirestoreCleanupResult(result = {}) {
  oldFirestoreCleanupCount = Number(result.oldCount || 0) || 0;
  const scanned = Number(result.scannedCount || 0) || 0;
  const maxDeletes = Number(result.maxDeletes || 100) || 100;
  const hasMore = result.hasMore ? ` ${t('admin.firestoreCleanupHasMore', 'Можливо є ще старі заявки — повтори перевірку після очищення.')}` : '';
  const legacy = result.legacyScan ? ` ${t('admin.firestoreCleanupLegacyNote', 'Перевірено також старі заявки без expiresAtMs, але тільки маленькою пачкою.')}` : '';
  const text = oldFirestoreCleanupCount
    ? tv('admin.firestoreCleanupFound', 'Знайдено старих Firestore-заявок: {count}. Перевірено документів: {scanned}. Можна очистити до {max} за раз.', { count: oldFirestoreCleanupCount, scanned, max: maxDeletes })
    : tv('admin.firestoreCleanupNone', 'Старих Firestore-заявок для очищення не знайдено. Перевірено документів: {scanned}.', { scanned });
  setOldFirestoreStatus(`${text}${hasMore}${legacy}`.trim(), oldFirestoreCleanupCount ? 'warn' : 'success');
  const cleanupBtn = $('#cleanupOldFirestoreRegistrationsBtn');
  if (cleanupBtn) cleanupBtn.disabled = oldFirestoreCleanupCount <= 0;
}

async function ensureCleanRegionsLoaded(force = false) {
  if (!currentUser || !canUseLimitsPanel()) return [];
  const regions = await loadRegionsCatalog(force).catch(error => {
    console.warn('[WKD] clean regions load failed:', error);
    return [];
  });
  renderCleanRegions();
  return regions;
}

async function checkOldFirestoreRegistrations() {
  if (!currentUser || !canUseLimitsPanel()) return null;
  const region = selectedCleanRegion();
  if (!region) {
    setOldFirestoreStatus(t('admin.cleanRegionRequired', 'Вибери регіон для перевірки.'), 'warn');
    return null;
  }
  const checkBtn = $('#checkOldFirestoreRegistrationsBtn');
  const cleanupBtn = $('#cleanupOldFirestoreRegistrationsBtn');
  if (checkBtn) checkBtn.disabled = true;
  if (cleanupBtn) cleanupBtn.disabled = true;
  setOldFirestoreStatus(t('admin.firestoreCleanupChecking', 'Перевіряю старі Firestore-заявки...'), 'muted');
  try {
    const result = await inspectOldRegionRegistrations(currentUser, region, { maxDeletes: 100, allowLegacyFullScan: true, retentionDays: selectedFirestoreCleanupAge() });
    if (result.skipped) {
      setOldFirestoreStatus(t('admin.firestoreCleanupDenied', 'Немає доступу для перевірки старих заявок.'), 'error');
      return result;
    }
    renderOldFirestoreCleanupResult(result);
    renderUsage();
    return result;
  } catch (error) {
    console.warn('[WKD] old Firestore registrations check failed:', error);
    setOldFirestoreStatus(t('admin.firestoreCleanupCheckFailed', 'Не вдалося перевірити старі Firestore-заявки.'), 'error');
    return null;
  } finally {
    if (checkBtn) checkBtn.disabled = false;
  }
}

async function cleanupOldFirestoreRegistrations({ auto = false } = {}) {
  if (!currentUser || !canUseLimitsPanel()) return null;
  const region = selectedCleanRegion();
  if (!region) {
    setOldFirestoreStatus(t('admin.cleanRegionRequired', 'Вибери регіон для очищення.'), 'warn');
    return null;
  }
  if (!auto && oldFirestoreCleanupCount <= 0) {
    const result = await checkOldFirestoreRegistrations();
    if (!result || Number(result.oldCount || 0) <= 0) return result;
  }
  if (!auto) {
    const ok = await confirmAction({
      title: t('admin.firestoreCleanupConfirmTitle', 'Очистити 100 старих Firestore-заявок?'),
      message: t('admin.firestoreCleanupConfirmMessage', 'Буде очищено тільки старий Firebase-резерв. Активна D1-таблиця, архів циклів і поточний cycleId не чіпаються.'),
      icon: '🧹',
      acceptText: t('admin.cleanupOldFirestoreRegistrations', 'Очистити 100 старих')
    });
    if (!ok) return null;
  }
  const checkBtn = $('#checkOldFirestoreRegistrationsBtn');
  const cleanupBtn = $('#cleanupOldFirestoreRegistrationsBtn');
  if (checkBtn) checkBtn.disabled = true;
  if (cleanupBtn) cleanupBtn.disabled = true;
  setOldFirestoreStatus(auto ? t('admin.firestoreCleanupAutoRunning', 'Автоочистка: очищаю старі Firestore-заявки 14+ днів...') : t('admin.firestoreCleanupRunning', 'Очищаю старі Firestore-заявки пачкою до 100...'), 'muted');
  try {
    const result = await cleanupOldRegionRegistrations(currentUser, region, { maxDeletes: 100, allowLegacyFullScan: true, retentionDays: auto ? 14 : selectedFirestoreCleanupAge() });
    if (result.skipped) {
      setOldFirestoreStatus(t('admin.firestoreCleanupDenied', 'Немає доступу для очищення старих заявок.'), 'error');
      return result;
    }
    const deleted = Number(result.deletedCount || 0) || 0;
    const ops = Number(result.deletedOps || 0) || 0;
    oldFirestoreCleanupCount = Math.max(0, oldFirestoreCleanupCount - deleted);
    setOldFirestoreStatus(tv(auto ? 'admin.firestoreCleanupAutoDone' : 'admin.firestoreCleanupDone', auto ? 'Автоочистка завершена. Очищено заявок: {count}. Delete operations: {ops}.' : 'Очищено заявок: {count}. Delete operations: {ops}. Активна D1-таблиця й архів не змінювались.', { count: deleted, ops }), deleted ? 'success' : 'muted');
    renderUsage();
    return result;
  } catch (error) {
    console.warn('[WKD] old Firestore registrations cleanup failed:', error);
    setOldFirestoreStatus(t('admin.firestoreCleanupFailed', 'Не вдалося очистити старі Firestore-заявки.'), 'error');
    return null;
  } finally {
    if (checkBtn) checkBtn.disabled = false;
    if (cleanupBtn) cleanupBtn.disabled = oldFirestoreCleanupCount <= 0;
  }
}

async function maybeRunOldFirestoreAutoCleanup() {
  if (oldFirestoreAutoRunning || !currentUser || !canUseLimitsPanel()) return;
  const region = selectedCleanRegion();
  if (!region) return;
  const key = `${OLD_FIRESTORE_AUTO_KEY}.${region}`;
  const now = Date.now();
  const last = Number(localStorage.getItem(key) || 0) || 0;
  if (now - last < 24 * 60 * 60 * 1000) return;
  oldFirestoreAutoRunning = true;
  try {
    localStorage.setItem(key, String(now));
    const result = await inspectOldRegionRegistrations(currentUser, region, { maxDeletes: 100, allowLegacyFullScan: false, retentionDays: 14 });
    if (Number(result?.oldCount || 0) > 0) await cleanupOldFirestoreRegistrations({ auto: true });
    else renderOldFirestoreCleanupResult(result || {});
  } catch (error) {
    console.warn('[WKD] old Firestore auto cleanup skipped:', error);
  } finally {
    oldFirestoreAutoRunning = false;
  }
}

async function maybeRunD1AutoCleanup() {
  if (d1AutoCleanupRunning || !currentUser || !canUseLimitsPanel()) return;
  const region = selectedCleanRegion();
  if (!region) return;
  const key = `${D1_AUTO_CLEANUP_KEY}.${region}`;
  const now = Date.now();
  const last = Number(localStorage.getItem(key) || 0) || 0;
  if (now - last < 24 * 60 * 60 * 1000) return;
  d1AutoCleanupRunning = true;
  try {
    localStorage.setItem(key, String(now));
    const shares = await cleanupD1Archives(currentUser, { scope: 'shares', region, retentionDays: 14, maxDeletes: 200 });
    const finalPlans = await cleanupD1Archives(currentUser, { scope: 'finalPlans', region, retentionDays: 14, maxDeletes: 200 });
    const deleted = Number(shares.deleted || 0) + Number(finalPlans.deleted || 0);
    if (deleted > 0) {
      setD1ArchiveStatus(tv('admin.d1AutoCleanupDone', 'D1 автоочистка 14+ днів: видалено {count} старих секретних посилань/фінальних планів. Активний цикл не чіпався.', { count: deleted }), 'success');
      await runD1StorageInspect().catch(() => null);
    }
  } catch (error) {
    console.warn('[WKD] D1 auto cleanup skipped:', error);
  } finally {
    d1AutoCleanupRunning = false;
  }
}

async function loadCleanPanel(forceRegions = false) {
  if (!currentUser || !canUseLimitsPanel()) return;
  await ensureCleanRegionsLoaded(forceRegions);
  if (selectedCleanRegion()) {
    await maybeRunOldFirestoreAutoCleanup();
    await maybeRunD1AutoCleanup();
  }
}

function counterValue(key, fallback = 0) {
  const value = adminCounters?.[key];
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function renderStats() {
  setAdminPlayersCounterLabel();
  const rows = adminRows();
  const pageMainCount = users.length;
  const shownRows = rows.length;
  const pageRegionTotal = new Set([
    ...rows.map(row => row.game?.region).filter(Boolean),
    ...regionsCatalog.filter(region => region.active !== false).map(region => region.region).filter(Boolean)
  ]).size;
  const pageLeaders = rows.filter(row => ['admin', 'moderator', 'consul', 'officer'].includes(rowRole(row))).length;
  const pending = requestsLoaded ? visibleRequests().length : counterValue('pendingRequestsTotal', 0);
  const mainCount = counterValue('playersTotal', pageMainCount);
  const rowCount = includeAdminFarmRows() ? counterValue('rowsTotal', shownRows) : mainCount;
  const regionTotal = counterValue('regionsTotal', pageRegionTotal);
  const leaders = counterValue('leadershipRolesTotal', pageLeaders);
  const cards = $('#adminStats')?.querySelectorAll('.admin-stat-card b') || [];
  const values = [includeAdminFarmRows() ? rowCount : mainCount, regionTotal, leaders, pending];
  cards.forEach((card, index) => { card.textContent = formatCompactNumber(values[index] ?? 0); });
  setSummary(tv('admin.summaryOptimized', '{players} гравців завантажено • {shown} рядків показано зараз • {requests} заявок', {
    players: pageMainCount,
    shown: shownRows,
    requests: requestsLoaded ? pending : '—'
  }));
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
    <td data-label="${labels.alliance}">${getAllianceBadge(game.alliance, game.region)}</td>
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
  if (!users.length && currentUser?.uid && currentProfile) {
    // Free self-fallback: does not read Firestore. Useful while a freshly edited admin profile is being re-indexed.
    const fallbackProfile = { id: currentUser.uid, uid: currentUser.uid, email: currentUser.email || currentProfile.email || '', ...currentProfile };
    const fallbackMain = mainRowForUser(fallbackProfile);
    if (canDisplayRow(fallbackMain) && rowMatchesFilters(fallbackMain, filterValues())) users = [fallbackProfile];
  }
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
    ? 'Завантажено {count} гравців за індексом. Firebase reads≈{reads}. Пошук запускається кнопкою Оновити або Enter.'
    : 'Завантажено {count} останніх гравців. Firebase reads≈{reads}; вся users-колекція не читається.';
  setStatus(tv(msgKey, fallback, { count: users.length, reads: playersPageMeta.reads }), 'success');
}

async function rebuildPlayersIndex() {
  if (!currentUser || !canRebuildAdminIndex(currentUser, currentProfile)) {
    setStatus(t('admin.rebuildIndexDenied', 'Оновити індекс може тільки Admin.'), 'error');
    return;
  }
  const ok = await confirmAction({
    title: t('admin.rebuildIndexTitle', 'Оновити індекс гравців?'),
    message: t('admin.rebuildIndexMessage', 'Сайт один раз прочитає до 5000 профілів і створить легкий індекс для дешевого пошуку. Це потрібно після старих версій або якщо пошук не знаходить гравця.'),
    icon: '⚡',
    acceptText: t('admin.rebuildIndexAccept', 'Оновити індекс')
  });
  if (!ok) return;
  try {
    setStatus(t('admin.rebuildIndexRunning', 'Оновлюю індекс гравців...'), 'muted');
    const result = await rebuildAdminUsersIndex({ limitCount: 5000 });
    if (result?.counters) {
      adminCounters = result.counters;
      writeAdminObjectCache('adminCounters', adminCounters);
    } else {
      await loadAdminCounters(true);
    }
    resetPlayersPage();
    await loadPlayersPage({ reset: true });
    setStatus(tv('admin.rebuildIndexDone', 'Індекс оновлено: перевірено {scanned}, записано {indexed}. Firebase reads≈{reads}, writes≈{writes}.', {
      scanned: result.scanned || 0,
      indexed: result.indexed || 0,
      reads: result.reads || 0,
      writes: result.writes || 0
    }), 'success');
  } catch (error) {
    console.error(error);
    const msg = error?.message === 'admin-only'
      ? t('admin.rebuildIndexDenied', 'Оновити індекс може тільки Admin.')
      : t('admin.rebuildIndexFailed', 'Не вдалося оновити індекс гравців. Перевір правила Firestore і права доступу.');
    setStatus(msg, 'error');
  }
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
  requestsLoaded = true;
  renderStats();
  renderRequests();
}

async function loadRegionsCatalog(force = false) {
  if (regionsLoaded && !force) {
    renderRegions();
    return regionsCatalog;
  }
  if (!force) {
    const cached = readAdminJsonCache('regionsCatalog');
    if (cached) {
      regionsCatalog = cached;
      regionsLoaded = true;
      renderStats();
      renderRegions();
      setStatus(t('admin.regionsCacheLoaded', 'Регіони показані з локального кешу. Натисни Оновити/Зберегти, щоб отримати свіжі дані.'), 'muted');
      return regionsCatalog;
    }
  }
  const list = $('#adminRegionList');
  if (list) list.innerHTML = `<div class="admin-empty">${escapeHtml(t('admin.loadingRegions', 'Завантажую регіони...'))}</div>`;
  regionsCatalog = await listRegionCatalog({ includeInactive: true, skipPublicPlayers: true }).catch(error => {
    console.warn('[WKD] region catalog unavailable:', error);
    return [];
  });
  regionsLoaded = true;
  writeAdminJsonCache('regionsCatalog', regionsCatalog);
  renderStats();
  renderRegions();
  return regionsCatalog;
}

async function loadAdminData() {
  if (!currentUser || !canUseAdminPanel(currentUser, currentProfile)) return;
  await Promise.all([
    loadAdminCounters(),
    loadPlayersPage({ reset: true })
  ]);
  renderStats();
  renderUsers();
  renderUsage();
  setStatus(t('admin.dataUpdated', 'Admin data updated.'), 'success');
}

function switchTab(tab) {
  const requested = tab || 'players';
  const safeTab = (requested === 'limits' || requested === 'clean') && !canUseLimitsPanel() ? 'players' : requested;
  document.querySelectorAll('[data-admin-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.adminTab === safeTab));
  document.querySelectorAll('[data-admin-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.adminPanel === safeTab));
  if (safeTab === 'limits') renderUsage();
  if (safeTab === 'clean') loadCleanPanel().catch(console.error);
  if (safeTab === 'requests' && !requestsLoaded) loadRoleRequests().catch(console.error);
  if (safeTab === 'regions') loadRegionsCatalog().catch(console.error);
  if (safeTab === 'security') document.dispatchEvent(new CustomEvent('wkd:security-load'));
  if (window.location.hash.replace('#','') !== safeTab && safeTab !== 'players') history.replaceState(null, '', `#${safeTab}`);
}
function switchLimitTab(tab = 'firebase') {
  const safeTab = tab === 'cloudflare' || tab === 'github' ? tab : 'firebase';
  document.querySelectorAll('[data-limit-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.limitTab === safeTab));
  document.querySelectorAll('[data-limit-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.limitPanel === safeTab));
  renderUsage();
}
function openInitialAdminTab() {
  const hash = String(window.location.hash || '').replace('#','');
  if (hash && document.querySelector(`[data-admin-tab="${hash}"]`)) switchTab(hash);
}

function runPlayerSearchNow() {
  clearTimeout(playerSearchDebounce);
  editUid = null;
  return loadPlayersPage({ reset: true }).catch(console.error);
}
function handlePlayerSearchKeydown(event) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  runPlayerSearchNow();
}

function bindAdminControls() {
  $('#refreshRequestsBtn')?.addEventListener('click', () => loadRoleRequests().catch(console.error));
  $('#refreshPlayersBtn')?.addEventListener('click', () => runPlayerSearchNow());
  $('#rebuildAdminIndexBtn')?.addEventListener('click', () => rebuildPlayersIndex().catch(console.error));
  $('#refreshUsageBtn')?.addEventListener('click', () => { renderUsage(); setStatus(t('admin.firebaseEstimateRefreshed', 'Оцінку Firebase оновлено локально.'), 'success'); });
  $('#refreshCloudflareUsageBtn')?.addEventListener('click', () => refreshRealCloudflareUsage().catch(console.error));
  $('#resetUsageEstimateBtn')?.addEventListener('click', () => { resetUsageEstimate(); renderUsage(); setStatus(t('admin.firebaseEstimateReset', 'Оцінку Firebase скинуто.'), 'success'); });
  $('#resetCloudflareUsageBtn')?.addEventListener('click', () => { cloudflareRealUsage = null; clearCachedCloudflareUsage(); renderCloudflareUsage(); });
  $('#refreshGitHubUsageBtn')?.addEventListener('click', () => refreshGitHubUsage().catch(console.error));
  $('#resetGitHubUsageBtn')?.addEventListener('click', () => { githubUsage = null; clearCachedGitHubUsage(); renderGitHubUsage(); });
  $('#cleanupOldDocsBtn')?.addEventListener('click', () => runOldDocsCleanup().catch(console.error));
  $('#scanFirebaseArchiveBtn')?.addEventListener('click', () => runFirebaseArchiveScan().catch(console.error));
  $('#cleanupFirebaseNotificationsBtn')?.addEventListener('click', () => runFirebaseArchiveCleanup('notifications').catch(console.error));
  $('#cleanupFirebaseCampaignsBtn')?.addEventListener('click', () => runFirebaseArchiveCleanup('campaigns').catch(console.error));
  $('#cleanupFirebaseActionLogsBtn')?.addEventListener('click', () => runFirebaseArchiveCleanup('actionLogs').catch(console.error));
  $('#inspectD1StorageBtn')?.addEventListener('click', () => runD1StorageInspect().catch(console.error));
  $('#scanD1ArchiveBtn')?.addEventListener('click', () => runD1ArchiveScan().catch(console.error));
  $('#cleanupD1CyclesBtn')?.addEventListener('click', () => runD1ArchiveCleanup('cycles').catch(console.error));
  $('#cleanupD1SharesBtn')?.addEventListener('click', () => runD1ArchiveCleanup('shares').catch(console.error));
  $('#cleanupD1MessagesBtn')?.addEventListener('click', () => runD1ArchiveCleanup('messages').catch(console.error));
  $('#cleanupD1LogsBtn')?.addEventListener('click', () => runD1ArchiveCleanup('logs').catch(console.error));
  $('#cleanupD1FinalPlansBtn')?.addEventListener('click', () => runD1ArchiveCleanup('finalPlans').catch(console.error));
  $('#cleanupD1AllBtn')?.addEventListener('click', () => runD1ArchiveCleanup('all').catch(console.error));
  $('#inspectSecretLinksBtn')?.addEventListener('click', () => inspectSecretLinksPanel().catch(console.error));
  $('#rotateFormSecretLinkBtn')?.addEventListener('click', () => rotateSecretLinksPanel('form').catch(console.error));
  $('#rotateTableSecretLinksBtn')?.addEventListener('click', () => rotateSecretLinksPanel('table').catch(console.error));
  $('#rotateFinalSecretLinksBtn')?.addEventListener('click', () => rotateSecretLinksPanel('final').catch(console.error));
  $('#rotateAllSecretLinksBtn')?.addEventListener('click', () => rotateSecretLinksPanel('all').catch(console.error));
  $('#optimizeD1DatabaseBtn')?.addEventListener('click', () => runD1DatabaseOptimize().catch(console.error));
  $('#refreshCleanRegionsBtn')?.addEventListener('click', () => loadCleanPanel(true).catch(console.error));
  $('#cleanFirestoreRegionSelect')?.addEventListener('change', () => { oldFirestoreCleanupCount = 0; maybeRunOldFirestoreAutoCleanup().catch(console.error); });
  $('#checkOldFirestoreRegistrationsBtn')?.addEventListener('click', () => checkOldFirestoreRegistrations().catch(console.error));
  $('#cleanupOldFirestoreRegistrationsBtn')?.addEventListener('click', () => cleanupOldFirestoreRegistrations().catch(console.error));
  $('#backToProfileBtn')?.addEventListener('click', () => { window.location.href = 'profile.html'; });
  $('#refreshRegionsBtn')?.addEventListener('click', () => { clearAdminJsonCache('regionsCatalog'); loadRegionsCatalog(true).catch(console.error); });
  $('#adminRegionForm')?.addEventListener('submit', saveManualRegion);
  $('#adminRegionList')?.addEventListener('click', handleRegionAction);
  $('#adminNickSearch')?.addEventListener('keydown', handlePlayerSearchKeydown);
  $('#adminAllianceSearch')?.addEventListener('keydown', handlePlayerSearchKeydown);
  $('#adminRegionSearch')?.addEventListener('keydown', handlePlayerSearchKeydown);
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
    updateRebuildIndexAccess();
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
  updateRebuildIndexAccess();
  if (currentUser && currentProfile && canUseAdminPanel(currentUser, currentProfile)) {
    setStatus(t('admin.statusUpdated', 'Admin data updated.'), 'success');
  }
});
