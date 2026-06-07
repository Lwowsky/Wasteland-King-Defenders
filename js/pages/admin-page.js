import { watchAuth } from '../services/firebase-service.js';
import { getUsageEstimate, resetUsageEstimate } from '../services/usage-tracker.js?v=87';
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
  listRegisteredUsers,
  listRoleRequests,
  roleLabel,
  updateUserByAdmin,
  updateFarmByAdmin
} from '../services/user-db.js';
import {
  archiveManualRegion,
  cleanupOldPublicDocuments,
  createManualRegion,
  listRegionCatalog,
  normalizeRegion
} from '../services/region-db.js?v=87';

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
let sortState = { key: 'createdAt', dir: 'desc' };
let editUid = null;

function allianceTag3(value) { return Array.from(String(value ?? '').trim().replace(/[\/\[\]#?]/g, '')).slice(0, 3).join(''); }
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
  const raw = String(value || 'P1').trim().toUpperCase();
  const match = raw.match(/[PRР]\s*([1-5])/i);
  return match ? `P${match[1]}` : 'P1';
}

function getRankBadge(rank) { return window.WKD?.Badges?.rank ? window.WKD.Badges.rank(rank) : `<span class="rank-badge">${escapeHtml(rankCode(rank))}</span>`; }

function getRegionBadge(region) {
  return `<span class="region-badge">${escapeHtml(region || '—')}</span>`;
}

function shkNumber(value) {
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function shkTier(value) {
  const n = shkNumber(value);
  if (n <= 0) return 0;
  if (n <= 3) return 1;
  if (n <= 6) return 2;
  if (n <= 9) return 3;
  if (n <= 12) return 4;
  if (n <= 15) return 5;
  if (n <= 18) return 6;
  if (n <= 21) return 7;
  if (n <= 25) return 8;
  if (n <= 29) return 9;
  if (n <= 33) return 10;
  if (n <= 37) return 11;
  if (n <= 39) return 12;
  if (n <= 43) return 13;
  return 14;
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

function adminRows() {
  return users.flatMap(user => {
    const main = {
      rowId: user.uid,
      uid: user.uid,
      user,
      game: getGameProfile(user),
      isFarmRow: false,
      farmId: 'main',
      mainNickname: getGameProfile(user).nickname || '—'
    };
    if (!includeAdminFarmRows()) return [main];
    const farms = getUserFarms(user)
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
    return [main, ...farms];
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

function sortRows(a, b) {
  const dir = sortState.dir === 'asc' ? 1 : -1;
  const av = sortState.key === 'createdAt' ? (a.user.createdAt?.toMillis?.() || 0) : (a.game[sortState.key] ?? a.user[sortState.key] ?? '');
  const bv = sortState.key === 'createdAt' ? (b.user.createdAt?.toMillis?.() || 0) : (b.game[sortState.key] ?? b.user[sortState.key] ?? '');
  return String(av).localeCompare(String(bv), window.WKD_CURRENT_LANG || 'en', { numeric: true }) * dir;
}

function filteredUsers() {
  const nick = String($('#adminNickSearch')?.value || '').trim().toLowerCase();
  const alliance = String($('#adminAllianceSearch')?.value || '').trim().toLowerCase();
  const region = String($('#adminRegionSearch')?.value || '').trim().toLowerCase();
  const role = $('#adminRoleFilter')?.value || 'all';
  const rows = $('#adminRowsFilter')?.value || '10';
  const sorted = adminRows()
    .filter(canDisplayRow)
    .filter(row => (role === 'all' || rowRole(row) === role))
    .filter(row => {
      const game = row.game || {};
      const userNick = String(game.nickname || '').toLowerCase();
      const mainNick = String(row.mainNickname || '').toLowerCase();
      const userAlliance = String(game.alliance || '').toLowerCase();
      const userRegion = String(game.region || '').toLowerCase();
      return (!nick || userNick.includes(nick) || mainNick.includes(nick))
        && (!alliance || userAlliance.includes(alliance))
        && (!region || userRegion.includes(region));
    })
    .sort(sortRows);

  if (rows === 'all') return sorted;
  return sorted.slice(0, Number(rows) || 10);
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
function renderUsage() {
  const grid = $('#adminUsageGrid');
  const note = $('#adminUsageNote');
  if (!grid) return;
  const usage = getUsageEstimate();
  grid.innerHTML = [
    usageCardHtml('day', 'reads', usage.day.reads),
    usageCardHtml('day', 'writes', usage.day.writes),
    usageCardHtml('day', 'deletes', usage.day.deletes),
    usageCardHtml('month', 'reads', usage.month.reads),
    usageCardHtml('month', 'writes', usage.month.writes),
    usageCardHtml('month', 'deletes', usage.month.deletes)
  ].join('');
  if (note) note.textContent = t('admin.usageNote', 'Це орієнтовний лічильник сайту, а не офіційні цифри Firebase. Точні ліміти перевіряй у Firebase Console → Usage.');
}

async function maybeRunOldDocsCleanup() {
  if (!currentUser || !canUseAdminPanel(currentUser, currentProfile)) return;
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
  if (!currentUser || !canUseAdminPanel(currentUser, currentProfile)) return;
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

function renderStats() {
  setAdminPlayersCounterLabel();
  const rows = adminRows();
  const regions = new Set([
    ...users.map(user => getGameProfile(user).region).filter(Boolean),
    ...regionsCatalog.filter(region => region.active !== false).map(region => region.region).filter(Boolean)
  ]);
  const leaders = rows.filter(row => ['admin', 'moderator', 'consul', 'officer'].includes(rowRole(row))).length;
  const pending = visibleRequests().length;
  const cards = $('#adminStats')?.querySelectorAll('.admin-stat-card b') || [];
  const values = [rows.length, regions.size, leaders, pending];
  cards.forEach((card, index) => { card.textContent = values[index] ?? 0; });
  setSummary(tv('admin.summary', '{players} players • {requests} requests', { players: rows.length, requests: pending }));
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

function renderUsers() {
  const body = $('#registeredPlayersBody');
  if (!body) return;
  const visible = filteredUsers();
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
    await loadAdminData();
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
    await loadAdminData();
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
    await loadAdminData();
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
    await loadAdminData();
    setStatus(t('admin.playerUpdated', 'Player updated.'), 'success');
  } catch (error) {
    console.error(error);
    const message = error?.message === 'role-not-allowed'
      ? t('admin.roleNotAllowed', 'You cannot assign this role with your permissions.')
      : t('admin.saveFailed', 'Could not save player. Check access rights.');
    setStatus(message, 'error');
  }
}

async function loadAdminData() {
  if (!currentUser || !canUseAdminPanel(currentUser, currentProfile)) return;
  [users, requests, regionsCatalog] = await Promise.all([
    listRegisteredUsers(),
    listRoleRequests('pending'),
    listRegionCatalog({ includeInactive: true }).catch(error => {
      console.warn('[WKD] region catalog unavailable:', error);
      return [];
    })
  ]);
  renderStats();
  renderUsers();
  renderRequests();
  renderRegions();
  renderUsage();
  setStatus(t('admin.dataUpdated', 'Admin data updated.'), 'success');
  maybeRunOldDocsCleanup().catch(() => null);
}

function switchTab(tab) {
  const safeTab = tab || 'players';
  document.querySelectorAll('[data-admin-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.adminTab === safeTab));
  document.querySelectorAll('[data-admin-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.adminPanel === safeTab));
  if (window.location.hash.replace('#','') !== safeTab && safeTab !== 'players') history.replaceState(null, '', `#${safeTab}`);
}
function openInitialAdminTab() {
  const hash = String(window.location.hash || '').replace('#','');
  if (hash && document.querySelector(`[data-admin-tab="${hash}"]`)) switchTab(hash);
}

function bindAdminControls() {
  $('#refreshRequestsBtn')?.addEventListener('click', loadAdminData);
  $('#refreshPlayersBtn')?.addEventListener('click', loadAdminData);
  $('#refreshUsageBtn')?.addEventListener('click', renderUsage);
  $('#resetUsageEstimateBtn')?.addEventListener('click', () => { resetUsageEstimate(); renderUsage(); });
  $('#cleanupOldDocsBtn')?.addEventListener('click', () => runOldDocsCleanup().catch(console.error));
  $('#backToProfileBtn')?.addEventListener('click', () => { window.location.href = 'profile.html'; });
  $('#adminRegionForm')?.addEventListener('submit', saveManualRegion);
  $('#adminRegionList')?.addEventListener('click', handleRegionAction);
  $('#adminNickSearch')?.addEventListener('input', renderUsers);
  $('#adminAllianceSearch')?.addEventListener('input', renderUsers);
  $('#adminRegionSearch')?.addEventListener('input', renderUsers);
  $('#adminRoleFilter')?.addEventListener('change', renderUsers);
  $('#adminRowsFilter')?.addEventListener('change', renderUsers);
  $('#adminIncludeFarmsToggle')?.addEventListener('change', () => { editUid = null; renderStats(); renderUsers(); });
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
      $('#adminUsagePanel') && ($('#adminUsagePanel').hidden = true);
      document.querySelectorAll('[data-admin-tab], [data-admin-panel]').forEach(el => { el.hidden = true; });
      setSummary(t('admin.noAccessShort', 'No access'));
      setStatus(t('admin.noAccess', 'This page is available only to an admin or moderator.'), 'error');
      $('#registeredPlayersBody').innerHTML = `<tr><td colspan="8">${escapeHtml(t('admin.noPlayerAccess', 'You do not have permission to view players.'))}</td></tr>`;
      $('#roleRequestsList').innerHTML = `<div class="admin-empty">${escapeHtml(t('admin.noRequestAccess', 'You do not have permission to view requests.'))}</div>`;
      $('#adminRegionList') && ($('#adminRegionList').innerHTML = `<div class="admin-empty">${escapeHtml(t('admin.noRegionAccess', 'You do not have permission to manage regions.'))}</div>`);
      return;
    }

    $('#adminUsagePanel') && ($('#adminUsagePanel').hidden = false);
    document.querySelectorAll('[data-admin-tab], [data-admin-panel]').forEach(el => { el.hidden = false; });
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
