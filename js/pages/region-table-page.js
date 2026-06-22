import { makePublicShareUrl, rememberShareCode } from '../core/share-links.js?v=074';
import { watchAuth } from '../services/firebase-service.js';
import { getGameProfile, getUserFarms, getUserProfile, saveSignedInUser } from '../services/user-db.js';
import {
  listRegionRegistrations,
  canManageRegion,
  canLeadCurrentRotation,
  canViewAnyRegion,
  canViewRegion,
  readRegionFromUrl,
  normalizeRegion,
  shiftLabel,
  troopLabel,
  formatUserDate,
  formatUtcAndLocal,
  getRegionLifecycle,
  getRegionActorName,
  listRegionAlliances,
  listRegionCatalog,
  shareRegionTable,
  updateRegionRegistration,
  deleteRegionRegistrations,
  regionRegistrationToPlayer
} from '../services/region-db.js?v=074';
import { isRegionTableCacheEnabled, readRegionTableSnapshot, publishRegionTableSnapshot, isExpectedRegionTableCacheError, isRegionAccessDeniedCacheError, isRegionSnapshotMissingCacheError } from '../services/region-table-cache.js?v=074';

const $ = selector => document.querySelector(selector);
const ACTIVE_REGION_KEY = 'wkd.players.activeRegion';
const SOURCE_MODE_KEY = 'wkd.players.sourceMode';
const REGION_TABLE_PAGE_SIZE_KEY = 'wkd.regionTable.pageSize.v034';
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const tv = (key, fallback = '', vars = {}) => {
  let text = t(key, fallback);
  Object.entries(vars).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
  return text;
};
function boolValue(value) {
  if (value === true || value === false) return value;
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return false;
  if (/^(0|false|no|ні|нi|нет|nope|n)$/.test(text)) return false;
  return /^(1|true|yes|так|да|はい|是|예|y)$/.test(text);
}

function isQuietRegionTableError(error = null) {
  return isExpectedRegionTableCacheError(error);
}

function quietRegionTableMessage(error = null, fallbackKey = 'players.regionD1MissingNoFirestore') {
  if (isRegionAccessDeniedCacheError(error)) return t('players.regionAccessDenied', 'Немає доступу до цього регіону.');
  if (isRegionSnapshotMissingCacheError(error) || isQuietRegionTableError(error)) {
    return t(fallbackKey, 'Таблиця регіону ще не має D1-кешу. Firebase fallback не запускався, щоб не витрачати reads.');
  }
  return '';
}

function reportRegionTableProblem(error = null, fallbackKey = 'region.tableRefreshFailed', fallbackText = 'Could not refresh the region table.') {
  const quietMessage = quietRegionTableMessage(error);
  if (quietMessage) {
    setStatus(quietMessage, 'warn');
    return;
  }
  setStatus(t(fallbackKey, fallbackText), 'error');
  if (window.WKD_DEBUG) console.warn('[WKD] region table handled error:', error?.message || error);
}

function setDynamicText(selector, text) {
  const el = typeof selector === 'string' ? $(selector) : selector;
  if (!el) return;
  el.removeAttribute('data-i18n');
  el.textContent = text;
}

function setDynamicHtml(selector, html) {
  const el = typeof selector === 'string' ? $(selector) : selector;
  if (!el) return;
  el.removeAttribute('data-i18n');
  el.innerHTML = html;
}
function infoLine(labelKey, fallbackLabel, value, valueClass = '') {
  const classAttr = valueClass ? ` class="${valueClass}"` : '';
  return `<span class="region-info-label">${esc(t(labelKey, fallbackLabel))}</span> <span${classAttr}>${esc(value || '—')}</span>`;
}
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
let currentUser = null;
let currentProfile = null;
let currentRegion = '';
let rows = [];
let allianceColorMap = new Map();
let currentSettings = null;
let canSwitchRegion = false;
let regionOptions = [];
let tableSort = { field: 'nickname', dir: 1 };
let timerId = null;
let ready = false;
let tablePage = 1;
let tablePageSize = readRegionTablePageSize();
let tableTotalRows = 0;
let tableTotalPages = 1;
let serverPagedTable = false;
let filterDebounceId = null;
let quietRegionTableStatus = '';
let tableSummary = null;

function readRegionTablePageSize() {
  let raw = '10';
  try { raw = String(localStorage.getItem(REGION_TABLE_PAGE_SIZE_KEY) || '10'); } catch {}
  if (raw === 'all') return 'all';
  const value = Number(raw) || 10;
  return [10, 20, 50].includes(value) ? value : 10;
}

function pageSizeValue() {
  return tablePageSize === 'all' ? 'all' : Math.max(10, Math.min(50, Number(tablePageSize) || 10));
}

function numericPageSizeForUi() {
  if (tablePageSize === 'all') return Math.max(1, Number(tableTotalRows || rows.length) || 1);
  return Math.max(10, Math.min(50, Number(tablePageSize) || 10));
}

function setRegionTablePageSize(value) {
  tablePageSize = String(value) === 'all' ? 'all' : (Math.max(10, Math.min(50, Number(value) || 10)));
  try { localStorage.setItem(REGION_TABLE_PAGE_SIZE_KEY, String(tablePageSize)); } catch {}
}


function normTag(value) { return String(value || '').trim(); }
function hashHue(value) { let hash = 2166136261; for (const ch of String(value || 'empty')) { hash ^= ch.codePointAt(0) || 0; hash = Math.imul(hash, 16777619) >>> 0; } return ((hash % 360) + 360) % 360; }
function allianceHue(tag) {
  const safe = normTag(tag);
  const custom = allianceColorMap.get(safe);
  return Number.isFinite(custom) ? custom : hashHue(safe);
}
function allianceBadge(tag) {
  const safe = normTag(tag) || '—';
  return (window.WKD?.Badges?.alliance || window.WKD?.allianceBadge || ((tag) => `<span class="alliance-badge"><span class="badge-dot"></span><span>${esc(tag || '—')}</span></span>`))(safe, { hue: allianceHue(safe), region: currentRegion });
}

function roleNameForBadge(type = '') {
  const value = String(type || '').trim().toLowerCase();
  if (value === 'fighter') return 'Fighter';
  if (value === 'rider') return 'Rider';
  if (value === 'shooter') return 'Shooter';
  return type || '—';
}

function rowTypeLabel(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (['profile', 'профіль', 'профиль'].includes(text)) return t('common.profile', 'Profile');
  if (['request', 'заявка'].includes(text)) return t('region.request', 'Request');
  return value;
}
function yesNoValue(value) {
  return value === true ? t('common.yes', 'Yes') : String(value);
}
async function loadAllianceColors() {
  allianceColorMap = new Map();
  if (!currentRegion) return;
  const alliances = await listRegionAlliances(currentRegion).catch(() => []);
  alliances.forEach(item => {
    const tag = normTag(item.tag || item.id);
    const hue = Number(item.colorHue);
    if (tag && Number.isFinite(hue)) allianceColorMap.set(tag, ((Math.round(hue) % 360) + 360) % 360);
  });
}

function regionPillText() {
  return currentRegion ? `R${currentRegion}` : 'R—';
}

function setStatus(text, type = 'muted') {
  const box = $('#regionTableStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}

function buildRegionFormLink(region) {
  const url = new URL('region-form.html', window.location.href);
  url.searchParams.set('r', normalizeRegion(region));
  return url.toString();
}

function openedByText(settings = currentSettings || {}) {
  const life = getRegionLifecycle(settings || {});
  const direct = String(life.openedByName || life.openedByEmail || settings.openedByName || settings.openedByEmail || '').trim();
  const uid = String(life.openedByUid || settings.openedByUid || settings.updatedBy || '').trim();
  const email = String(life.openedByEmail || settings.openedByEmail || settings.updatedByEmail || '').trim().toLowerCase();
  const sameUser = Boolean(currentUser && ((uid && currentUser.uid === uid) || (email && String(currentUser.email || '').toLowerCase() === email)));
  const profileName = currentUser ? getRegionActorName(currentProfile || {}, currentRegion, currentUser) : '';
  if (sameUser && profileName) return profileName;
  const displayName = String(currentUser?.displayName || currentProfile?.displayName || '').trim().toLowerCase();
  if (profileName && displayName && direct.toLowerCase() === displayName) return profileName;
  if (direct && !direct.includes('@')) return direct;
  if ((settings.open || settings.enabled) && profileName && (!direct || direct.includes('@'))) return profileName;
  if (direct) return direct;
  return uid || t('regionSettings.unknownStarter', 'невідомо');
}

function openedAtText(settings = currentSettings || {}) {
  const life = getRegionLifecycle(settings || {});
  const ms = Number(life.openedAtMs) || Number(life.openAtMs) || Number(life.updatedAtMs) || 0;
  return ms ? formatUtcAndLocal(ms) : t('regionSettings.notStartedYet', 'ще не запускали');
}

function eventStartText(settings = currentSettings || {}) {
  const life = getRegionLifecycle(settings || {});
  const ms = Number(life.eventStartAtMs || life.startAtMs) || 0;
  return ms ? formatUtcAndLocal(ms) : '—';
}


function readStoredActiveRegion() {
  try { return normalizeRegion(localStorage.getItem(ACTIVE_REGION_KEY) || ''); } catch { return ''; }
}

function rememberActiveRegion(region = currentRegion) {
  const safeRegion = normalizeRegion(region);
  if (!safeRegion) return;
  try {
    localStorage.setItem(ACTIVE_REGION_KEY, safeRegion);
    localStorage.setItem(SOURCE_MODE_KEY, 'region');
  } catch {}
}

function profileRegionOptions(profile = currentProfile || {}) {
  const games = [getGameProfile(profile || {}), ...getUserFarms(profile || {})];
  const seen = new Map();
  games.forEach(game => {
    const region = normalizeRegion(game?.region);
    if (!region || seen.has(region)) return;
    const nick = String(game?.nickname || '').trim();
    seen.set(region, { region, name: nick ? `${nick}` : '' });
  });
  return [...seen.values()].sort((a, b) => Number(a.region) - Number(b.region) || a.region.localeCompare(b.region));
}

async function loadRegionOptions() {
  if (canViewAnyRegion(currentProfile || {}, currentUser)) {
    const catalog = await listRegionCatalog({ includeInactive: true, skipPublicPlayers: true }).catch(() => []);
    const own = profileRegionOptions(currentProfile);
    const seen = new Map();
    [...catalog, ...own].forEach(item => {
      const region = normalizeRegion(item.region || item.id);
      if (!region) return;
      if (!seen.has(region)) seen.set(region, { region, name: item.name || item.nickname || '' });
    });
    return [...seen.values()].sort((a, b) => Number(a.region) - Number(b.region) || a.region.localeCompare(b.region));
  }
  return profileRegionOptions(currentProfile);
}

async function populateRegionLookupList() {
  const list = $('#regionLookupList');
  if (!list) return;
  list.innerHTML = regionOptions.map(item => {
    const label = String(item.name || '').trim();
    const same = label && label.replace(/^R/i, '') === String(item.region);
    return `<option value="${esc(item.region)}">R${esc(item.region)}${label && !same ? ` · ${esc(label)}` : ''}</option>`;
  }).join('');
}

function setManagerSwitch() {
  const row = $('#regionTableSwitchRow');
  const field = $('#regionManagerSwitch');
  const button = $('#openRegionLookupBtn');
  const input = $('#regionLookupInput');
  canSwitchRegion = regionOptions.length > 1;
  if (row) row.hidden = !canSwitchRegion;
  if (field) field.hidden = !canSwitchRegion;
  if (button) button.hidden = !canSwitchRegion;
  if (input) input.value = currentRegion || readRegionFromUrl() || '';
}

function renderTierFilter() {
  const select = $('#regionTierFilter');
  if (!select) return;
  const oldValue = select.value || 'all';
  const tiers = ['T14','T13','T12','T11','T10','T9','T8','T7','T6','T5','T4','T3','T2','T1'];
  select.innerHTML = `<option value="all">${esc(t('common.all', 'Усі'))}</option>` + tiers.map(tier => `<option value="${esc(tier)}">${esc(tier)}</option>`).join('');
  select.value = oldValue === 'all' || tiers.includes(oldValue) ? oldValue : 'all';
}

function startCycleTimer() {
  const box = $('#regionTableCycleBox');
  if (!box || !currentSettings) return;
  const update = () => {
    box.hidden = false;
    setDynamicHtml('#regionTableCycleText', infoLine('regionInfo.statusLabel', 'Статус:', currentSettings.open ? t('region.formOpen', 'Form open') : t('region.formClosed', 'Form closed'), currentSettings.open ? 'region-info-value region-info-value--good' : 'region-info-value'));
    setDynamicHtml('#regionTableCloseText', infoLine('regionInfo.closeLabel', 'Закриття:', formatUtcAndLocal(currentSettings.closeAtMs), 'region-info-value'));
    setDynamicHtml('#regionTableStartText', infoLine('regionInfo.startLabel', 'Старт:', eventStartText(currentSettings), 'region-info-value'));
    setDynamicHtml('#regionTableOpenedText', infoLine('regionInfo.startedAtLabel', 'Запущено:', openedAtText(currentSettings), 'region-info-value'));
    setDynamicHtml('#regionTableOpenedByText', infoLine('regionInfo.startedByLabel', 'Запустив:', openedByText(currentSettings), 'region-starter-name'));
  };
  clearInterval(timerId);
  update();
  timerId = setInterval(update, 30000);
}

function isEmbeddedStaffRegionTable() {
  return Boolean(document.body?.classList?.contains('staff-shell') || document.querySelector('.staff-integrated-region-table'));
}

async function openRegion(region) {
  const safeRegion = normalizeRegion(region);
  if (!safeRegion) {
    setStatus(t('region.openRegionPrompt', 'Enter the region number you want to open.'), 'warn');
    return;
  }
  rememberActiveRegion(safeRegion);
  if (isEmbeddedStaffRegionTable()) {
    currentRegion = safeRegion;
    const input = $('#regionLookupInput');
    if (input) input.value = safeRegion;
    const pill = $('#regionTablePill');
    if (pill) pill.textContent = regionPillText();
    tablePage = 1;
    await reloadTablePage({ resetPage: true });
    return;
  }
  const url = new URL(window.location.href);
  url.pathname = url.pathname.replace(/\/region-table(?:\.html)?\/?$/, '/region-table.html');
  if (!/region-table\.html$/i.test(url.pathname)) url.pathname = `${url.pathname.replace(/\/$/, '')}/region-table.html`;
  url.searchParams.set('region', safeRegion);
  url.searchParams.delete('r');
  url.searchParams.set('t', String(Date.now()));
  window.location.assign(url.toString());
}

async function copyRegionFormLink() {
  const region = normalizeRegion($('#regionLookupInput')?.value || currentRegion);
  if (!region) {
    setStatus(t('region.enterRegionFirst', 'Enter the region number first.'), 'warn');
    return;
  }
  const link = buildRegionFormLink(region);
  try {
    await navigator.clipboard.writeText(link);
    setStatus(tv('region.formLinkCopied', 'Region {region} form link copied.', { region }), 'success');
  } catch {
    window.prompt(t('common.copyLinkPrompt', 'Copy link:'), link);
  }
}

function renderTroopFilter(settings = {}) {
  const select = $('#regionTroopFilter');
  if (!select) return;
  const oldValue = select.value || 'all';
  const options = [
    ['all', t('common.all', 'Усі')],
    ['fighter', t('troop.fighter', 'Бійці')],
    ['rider', t('troop.rider', 'Наїзники')],
    ['shooter', t('troop.shooter', 'Стрільці')],
    ...(Array.isArray(settings.customTroopTypes) ? settings.customTroopTypes.map(item => [item.id, item.label]) : [])
  ];
  select.innerHTML = options.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('');
  select.value = options.some(([value]) => value === oldValue) ? oldValue : 'all';
}

function rowExtraSquads(row = {}) {
  if (Array.isArray(row.extraSquads) && row.extraSquads.length) return row.extraSquads;
  if (row.extraEnabled && row.extraTroopType && row.extraTier) {
    return [{ troopType: row.extraTroopType, troopLabel: row.extraTroopLabel || troopLabel(row.extraTroopType, currentSettings), tier: row.extraTier }];
  }
  return [];
}

function extraSquadsText(row = {}) {
  return rowExtraSquads(row)
    .map(item => `${troopLabel(item.troopType, currentSettings)}${item.tier ? ` · ${item.tier}` : ''}`)
    .join(' / ');
}

function troopClass(type = '') {
  const troopType = String(type || '').trim().toLowerCase();
  return ['fighter', 'rider', 'shooter'].includes(troopType) ? troopType : '';
}

function tierBadge(tier = '') {
  return (window.WKD?.Badges?.tier || window.WKD?.tierBadge || (value => esc(value || '—')))(tier);
}
function captainBadge(value) {
  return (window.WKD?.Badges?.captain || window.WKD?.captainBadge || (flag => `<span class="captain-badge ${flag ? 'yes' : 'no'}">${flag ? esc(t('common.yes', 'Yes')) : esc(t('common.no', 'No'))}</span>`))(Boolean(value));
}
function shiftBadge(shift = '') {
  return (window.WKD?.Badges?.shift || window.WKD?.shiftBadge || ((value, label) => `<span class="shift-badge">${esc(label || value || '—')}</span>`))(shift, shiftLabel(shift, currentSettings) || shift || '—');
}

function sortValue(row = {}, field = '') {
  if (field === 'troopType') return troopLabel(row.troopType, currentSettings) || row.troopLabel || row.troopType || '';
  if (field === 'tier') return Number(String(row.tier || '').replace(/[^0-9]/g, '')) || 0;
  if (field === 'marchSize' || field === 'rallySize') return Number(row[field]) || 0;
  if (field === 'captainReady') return row.captainReady ? 1 : 0;
  if (field === 'shift') return shiftLabel(row.shift, currentSettings) || row.shiftLabel || row.shift || '';
  return String(row[field] ?? '').trim().toLowerCase();
}

function compareRows(a, b) {
  const av = sortValue(a, tableSort.field);
  const bv = sortValue(b, tableSort.field);
  if (typeof av === 'number' || typeof bv === 'number') return ((Number(av) || 0) - (Number(bv) || 0)) * tableSort.dir;
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * tableSort.dir;
}

function tableFilterValues() {
  return {
    search: String($('#regionNickSearch')?.value || '').trim(),
    alliance: String($('#regionAllianceSearch')?.value || '').trim(),
    troop: $('#regionTroopFilter')?.value || 'all',
    tier: $('#regionTierFilter')?.value || 'all',
    shift: $('#regionShiftFilter')?.value || 'all',
    status: $('#regionStatusFilter')?.value || 'all',
    sortField: tableSort.field,
    sortDir: tableSort.dir < 0 ? 'desc' : 'asc'
  };
}

function resetTablePage() { tablePage = 1; }


function numberFromSummary(summary = {}, key = '', fallback = 0) {
  const value = Number(summary?.[key]);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : Math.max(0, Number(fallback || 0) || 0);
}

function pageSummaryFromRows(list = rows) {
  const result = { totalCount: list.length, captainCount: 0, fighterCount: 0, riderCount: 0, shooterCount: 0, shift1Count: 0, shift2Count: 0, shift3Count: 0, shift4Count: 0, bothCount: 0 };
  list.forEach(row => {
    if (row?.captainReady) result.captainCount += 1;
    const troop = String(row?.troopType || row?.troopLabel || '').trim().toLowerCase();
    if (troop === 'fighter') result.fighterCount += 1;
    else if (troop === 'rider') result.riderCount += 1;
    else if (troop === 'shooter') result.shooterCount += 1;
    const shift = String(row?.shift || row?.shiftLabel || '').trim().toLowerCase();
    if (shift.includes('4')) result.shift4Count += 1;
    else if (shift.includes('3')) result.shift3Count += 1;
    else if (shift.includes('2')) result.shift2Count += 1;
    else if (shift.includes('1')) result.shift1Count += 1;
    else if (shift === 'both' || shift.includes('обид') || shift.includes('всі') || shift.includes('all')) result.bothCount += 1;
  });
  return result;
}

function renderRegionStats() {
  const box = $('#regionTableStats');
  if (!box) return;
  box.hidden = false;
  box.removeAttribute('hidden');
  const fallback = pageSummaryFromRows(serverPagedTable ? [] : rows);
  const summary = tableSummary || fallback;
  const total = numberFromSummary(summary, 'totalCount', serverPagedTable ? tableTotalRows : rows.length);
  setDynamicText('#regionStatTotalPlayers', String(total));
  setDynamicText('#regionStatCaptainsReady', String(numberFromSummary(summary, 'captainCount', fallback.captainCount)));
  setDynamicText('#regionStatFighters', String(numberFromSummary(summary, 'fighterCount', fallback.fighterCount)));
  setDynamicText('#regionStatRiders', String(numberFromSummary(summary, 'riderCount', fallback.riderCount)));
  setDynamicText('#regionStatShooters', String(numberFromSummary(summary, 'shooterCount', fallback.shooterCount)));
  const shiftCount = Math.max(1, Math.min(4, Number(window.WKD?.getActiveShiftCount?.() || currentSettings?.shiftsCount || 2) || 2));
  const shiftBox = $('#regionTableShiftStats');
  if (shiftBox) {
    shiftBox.className = `stat-split stat-split--shifts region-table-shift-stats is-shifts-${shiftCount}`;
    const pieces = [];
    for (let index = 1; index <= shiftCount; index += 1) {
      pieces.push(`<div class="stat-chip stat-chip--shift is-shift${index}"><b>${numberFromSummary(summary, `shift${index}Count`, fallback[`shift${index}Count`])}</b><small>${esc(t('common.shift', 'Зміна'))} ${index}</small></div>`);
    }
    pieces.push(`<div class="stat-chip stat-chip--shift is-both"><b>${numberFromSummary(summary, 'bothCount', fallback.bothCount)}</b><small>${esc(t('common.all', 'Всі'))}</small></div>`);
    shiftBox.innerHTML = pieces.join('');
  }
  box.hidden = false;
}

function renderPager() {
  const pager = $('#regionTablePager');
  if (!pager) return;
  const total = Math.max(0, Number(tableTotalRows || rows.length) || 0);
  const effectivePageSize = numericPageSizeForUi();
  if (tablePageSize === 'all') tableTotalPages = 1;
  else tableTotalPages = Math.max(1, Number(tableTotalPages || Math.ceil(total / Math.max(1, effectivePageSize))) || 1);
  const hasPages = tablePageSize !== 'all' && (serverPagedTable || total > effectivePageSize);
  pager.hidden = !hasPages;
  const info = $('#regionTablePageInfo');
  if (info) info.textContent = tv('regionSettings.archivePageInfo', 'Сторінка {page} / {pages}', { page: tablePage, pages: tableTotalPages }) + ` · ${total}`;
  const prev = $('#regionTablePrevBtn');
  const next = $('#regionTableNextBtn');
  if (prev) prev.disabled = tablePage <= 1;
  if (next) next.disabled = tablePage >= tableTotalPages;
  const size = $('#regionTablePageSize');
  if (size) size.value = String(tablePageSize);
}

async function reloadTablePage(options = {}) {
  if (options.resetPage) resetTablePage();
  await load(currentUser, { forceD1: Boolean(options.forceD1), keepPage: true }).catch(error => {
    reportRegionTableProblem(error, 'region.tableRefreshFailed', 'Could not refresh the region table.');
  });
}

function filteredRows() {
  if (serverPagedTable) return rows;
  const search = String($('#regionNickSearch')?.value || '').trim().toLowerCase();
  const alliance = String($('#regionAllianceSearch')?.value || '').trim();
  const troop = $('#regionTroopFilter')?.value || 'all';
  const tier = $('#regionTierFilter')?.value || 'all';
  const shift = $('#regionShiftFilter')?.value || 'all';
  const status = $('#regionStatusFilter')?.value || 'all';
  const list = rows.filter(row => {
    if (search) {
      const haystack = [row.nickname, row.alliance, row.troopLabel, row.troopType, row.tier, row.shiftLabel, row.shift].map(value => String(value || '').toLowerCase()).join(' ');
      if (!haystack.includes(search)) return false;
    }
    // Alliance tags are case-sensitive: YYY, yyy and YyY are different alliances.
    if (alliance && !String(row.alliance || '').trim().includes(alliance)) return false;
    if (troop !== 'all' && row.troopType !== troop) return false;
    if (tier !== 'all' && String(row.tier || '').trim().toUpperCase() !== tier) return false;
    if (shift !== 'all' && row.shift !== shift) return false;
    if (status === 'captains' && !row.captainReady) return false;
    return true;
  });
  return [...list].sort(compareRows);
}

function regionTableLabels() {
  return {
    nickname: esc(t('players.nickname', 'Нік гравця')),
    alliance: esc(t('account.alliance', 'Alliance')),
    troop: esc(t('playerEdit.troopType', 'Troop type')),
    tier: esc(t('playerEdit.tier', 'Tier')),
    march: esc(t('playerEdit.march', 'March size')),
    rally: esc(t('playerEdit.rally', 'Rally size')),
    captain: esc(t('players.captain', 'Captain')),
    shift: esc(t('account.shift', 'Shift')),
    placement: esc(t('auto.text.i.047f17', 'Розміщення'))
  };
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number.toLocaleString('uk-UA') : '—';
}

function activeRotationAllianceFromSettings(settings = {}) {
  const clean = value => String(value || '').trim().replace(/[\/\[\]#?]/g, '').slice(0, 3);
  const list = Array.isArray(settings.rotationAlliances) ? settings.rotationAlliances : [];
  const fallback = clean(settings.hostAlliance || settings.activeHostAlliance || settings.alliance || '');
  if (!settings.rotationEnabled || !list.length) return fallback;
  const count = list.length;
  let index = Math.max(0, Math.min(count - 1, Number(settings.rotationActiveIndex) || 0));
  const handoverAtMs = Number(settings.rotationHandoverAtMs) || 0;
  if (handoverAtMs && Date.now() >= handoverAtMs) {
    const closed = Number.isFinite(Number(settings.rotationClosedActiveIndex)) ? Number(settings.rotationClosedActiveIndex) : index;
    const next = Number.isFinite(Number(settings.rotationNextActiveIndex)) ? Number(settings.rotationNextActiveIndex) : closed + 1;
    index = next < count ? next : (settings.rotationLoop === false ? Math.min(count - 1, closed) : 0);
  }
  const item = list[index] || {};
  return clean(item.tag || item.id || item.alliance || fallback);
}

function actorAllianceForCurrentRegion() {
  const clean = value => String(value || '').trim().replace(/[\/\[\]#?]/g, '').slice(0, 3);
  const main = getGameProfile(currentProfile || {});
  const farms = getUserFarms(currentProfile || {});
  const region = String(currentRegion || '');
  const match = [main, ...farms].find(item => String(item?.region || '').replace(/[^0-9]/g, '') === region);
  return clean(match?.alliance || main?.alliance || currentProfile?.alliance || '');
}

function actorAccessForRegionRequest() {
  const clean = value => String(value || '').trim().replace(/[\/\[\]#?]/g, '').slice(0, 3);
  const main = getGameProfile(currentProfile || {});
  const farms = getUserFarms(currentProfile || {});
  const region = String(currentRegion || '');
  const match = [main, ...farms].find(item => String(item?.region || '').replace(/[^0-9]/g, '') === region) || main;
  return {
    uid: currentUser?.uid || '',
    region,
    alliance: clean(match?.alliance || main?.alliance || currentProfile?.alliance || ''),
    role: String(match?.role || main?.role || currentProfile?.role || '').toLowerCase(),
    rank: String(match?.rank || main?.rank || currentProfile?.rank || '').toLowerCase()
  };
}

function canEditRegionRows(row = null) {
  if (!currentUser || !currentRegion) return false;
  if (canManageRegion(currentProfile || {}, currentRegion, currentUser)) return true;
  // Active-host officer R4/R5 can edit the current region table for this cycle.
  // This edits only the request/table row, not the player's saved profile.
  return Boolean(canLeadCurrentRotation(currentProfile || {}, currentRegion, currentUser, currentSettings || {}));
}

function canDeleteRegionRows() {
  return Boolean(currentUser && currentRegion && canManageRegion(currentProfile || {}, currentRegion, currentUser));
}

function syncRegionEditorState() {
  window.WKD = window.WKD || {};
  window.WKD.state = window.WKD.state || {};
  window.WKD.state.players = (rows || []).map(row => ({
    ...regionRegistrationToPlayer(row),
    source: 'regionForm'
  }));
}

function rowById(rowId = '') {
  const wanted = String(rowId || '');
  return rows.find(item => String(item.id || item.uid || '') === wanted) || null;
}

function roleToTroopType(role = '') {
  const text = String(role || '').trim().toLowerCase();
  if (/fighter|бійц|боєц|боец|воїн|воин/.test(text)) return 'fighter';
  if (/rider|наїз|наезд|кавал/.test(text)) return 'rider';
  if (/shooter|стріл|стрел|shoot/.test(text)) return 'shooter';
  return '';
}

function mergeEditedRow(row = {}, values = {}, result = {}) {
  const patch = result?.data || result?.row || result?.result?.row || {};
  const troopType = patch.troopType || values.troopType || roleToTroopType(values.role) || row.troopType || '';
  const shift = patch.shift || values.shift || row.shift || '';
  return {
    ...row,
    ...patch,
    nickname: patch.nickname || values.name || values.nickname || row.nickname || '',
    alliance: patch.alliance || values.alliance || row.alliance || '',
    troopType,
    troopLabel: patch.troopLabel || troopLabel(troopType, currentSettings) || row.troopLabel || '',
    tier: patch.tier || values.tier || row.tier || '',
    marchSize: Number(patch.marchSize ?? values.march ?? values.marchSize ?? row.marchSize) || 0,
    rallySize: Number(patch.rallySize ?? values.rally ?? values.rallySize ?? row.rallySize) || 0,
    captainReady: Object.prototype.hasOwnProperty.call(patch, 'captainReady') ? boolValue(patch.captainReady) : boolValue(values.captain ?? row.captainReady),
    shift,
    shiftLabel: patch.shiftLabel || shiftLabel(shift, currentSettings) || row.shiftLabel || ''
  };
}

function installRegionEditorBridge() {
  window.WKD = window.WKD || {};
  window.WKD.getPlayersSourceInfo = () => ({
    mode: 'region',
    region: currentRegion,
    label: currentRegion ? `R${currentRegion}` : t('playerManager.regionList', 'Таблиця регіону'),
    canUpdate: canEditRegionRows(),
    canDelete: canDeleteRegionRows(),
    canPlan: canEditRegionRows(),
    canViewRegion: Boolean(currentRegion),
    userRole: String(currentProfile?.role || 'player').toLowerCase()
  });
  window.WKD.updatePlayerInActiveSource = async (id, values = {}) => {
    if (!canEditRegionRows()) throw new Error('region-update-access-denied');
    const wanted = String(id || '').trim();
    const existing = rowById(wanted);
    if (!existing) throw new Error('player-not-found');
    if (!canEditRegionRows(existing)) throw new Error('region-update-access-denied');
    const payload = {
      ...existing,
      ...values,
      id: existing.id || wanted,
      uid: existing.uid || '',
      publicKey: existing.publicKey || '',
      farmId: existing.farmId || 'main',
      cycleId: existing.cycleId || currentSettings?.currentCycleId || '',
      _actorAccess: actorAccessForRegionRequest()
    };
    const result = await updateRegionRegistration(currentUser, currentRegion, wanted, payload);
    rows = rows.map(row => String(row.id || row.uid || '') === wanted ? mergeEditedRow(row, payload, result) : row);
    syncRegionEditorState();
    render();
    return { handled: true, updated: true, result };
  };
  window.WKD.deletePlayersFromActiveSource = async (ids = []) => {
    if (!canDeleteRegionRows()) throw new Error('region-delete-access-denied');
    const wanted = new Set((Array.isArray(ids) ? ids : [ids]).map(id => String(id || '').trim()).filter(Boolean));
    if (!wanted.size) return { removed: 0 };
    const result = await deleteRegionRegistrations(currentUser, currentRegion, [...wanted]);
    const before = rows.length;
    rows = rows.filter(row => !wanted.has(String(row.id || row.uid || '')));
    tableTotalRows = Math.max(0, Number(tableTotalRows || 0) - (before - rows.length));
    syncRegionEditorState();
    render();
    return { handled: true, removed: before - rows.length, result };
  };
}

function openRegionPlayerEditor(rowId = '', trigger = null) {
  const row = rowById(rowId);
  if (!rowId || !row || !canEditRegionRows(row)) return openRequestDetails(rowId);
  installRegionEditorBridge();
  syncRegionEditorState();
  if (typeof window.WKD?.openPlayerEditModal === 'function') {
    window.WKD.openPlayerEditModal(rowId, trigger || document.activeElement);
    return;
  }
  openRequestDetails(rowId);
}

function regionPlacementHtml(row = {}) {
  const rowId = String(row.id || row.uid || row.publicKey || '').trim();
  const count = Math.max(1, Math.min(4, Number(window.WKD?.getActiveShiftCount?.() || currentSettings?.shiftsCount || 2) || 2));
  const assigned = typeof window.WKD?.getPlayerTowerAssignment === 'function' ? window.WKD.getPlayerTowerAssignment(rowId) : null;
  const fallbackPlacement = String(row.placement || row.tower || row.towerName || '').trim();
  const items = Array.from({ length: count }, (_, index) => {
    const shift = `shift${index + 1}`;
    const isHere = assigned && assigned.shift === shift;
    const title = isHere ? assigned.towerName : t('common.reserve', 'Резерв');
    const sub = isHere ? assigned.roleLabel : (fallbackPlacement && fallbackPlacement !== 'Резерв' ? fallbackPlacement : t('common.notAssigned', 'Не призначено'));
    return `<span class="placement-item ${isHere ? 'is-assigned' : ''}" data-placement-shift="${index + 1}">
      <b>${esc(t('common.shift', 'Зміна'))} ${index + 1}</b>
      <strong>${esc(title)}</strong>
      <small>${esc(sub)}</small>
    </span>`;
  }).join('');
  const editButton = rowId && canEditRegionRows(row)
    ? `<button class="region-request-edit-btn placement-edit" type="button" data-region-edit-id="${esc(rowId)}" aria-label="${esc(tv('players.editPlacement', 'Редагувати {name}', { name: row.nickname || '' }))}" title="${esc(t('common.edit', 'Редагувати'))}">✎</button>`
    : '';
  return `<div class="placement-card region-placement-card" style="--placement-cols:${count}">${items}${editButton}</div>`;
}

function rowHtml(row) {
  const labels = regionTableLabels();
  const rowId = row.id || row.uid || row.publicKey || '';
  const nickname = row.nickname || '—';
  return `<tr>
    <td data-label="${labels.nickname}"><button class="region-request-link" type="button" data-region-request-id="${esc(rowId)}" aria-label="${esc(tv('region.openRequestDetails', 'Open request for {name}', { name: nickname }))}">${esc(nickname)}</button></td>
    <td data-label="${labels.alliance}">${allianceBadge(row.alliance)}</td>
    <td data-label="${labels.troop}">${(window.WKD?.Badges?.troop || window.WKD?.troopBadge || ((type,label)=>`<span class="tag ${troopClass(type)}">${esc(label || '—')}</span>`))(row.troopType, troopLabel(row.troopType, currentSettings) || row.troopLabel || '—')}</td>
    <td data-label="${labels.tier}">${tierBadge(row.tier)}</td>
    <td data-label="${labels.march}">${formatNumber(row.marchSize)}</td>
    <td data-label="${labels.rally}">${formatNumber(row.rallySize)}</td>
    <td data-label="${labels.captain}">${captainBadge(row.captainReady)}</td>
    <td data-label="${labels.shift}">${shiftBadge(row.shift || row.shiftLabel)}</td>
    <td data-label="${labels.placement}" class="region-placement-cell">${regionPlacementHtml(row)}</td>
  </tr>`;
}

function boolText(value) {
  return value ? t('common.yes', 'Yes') : t('common.no', 'No');
}

function detailValue(value) {
  const text = String(value ?? '').trim();
  return text || '—';
}

function detailItem(label, value) {
  return `<div class="region-request-detail-item"><span>${esc(label)}</span><b>${esc(detailValue(value))}</b></div>`;
}

function customFieldLabel(key = '') {
  const fields = Array.isArray(currentSettings?.customFields) ? currentSettings.customFields : [];
  const field = fields.find(item => item.id === key || item.label === key);
  return field?.label || key;
}

function customFieldsHtml(row = {}) {
  const entries = Object.entries(row.customFields || {}).filter(([, value]) => value !== false && value !== '' && value !== null && value !== undefined);
  if (!entries.length) return `<p class="region-request-empty">${esc(t('region.details.noCustom', 'No additional fields.'))}</p>`;
  return `<div class="region-request-detail-grid">${entries.map(([key, value]) => detailItem(customFieldLabel(key), yesNoValue(value))).join('')}</div>`;
}

function extraSquadsHtml(row = {}) {
  const squads = rowExtraSquads(row);
  if (!squads.length) return `<p class="region-request-empty">${esc(t('region.details.noExtra', 'No extra squads.'))}</p>`;
  return `<div class="region-request-extra-list">${squads.map(item => `<span class="tag ${troopClass(item.troopType)}">${esc(troopLabel(item.troopType, currentSettings))} · ${tierBadge(item.tier || '—')}</span>`).join('')}</div>`;
}

function requestDetailsHtml(row = {}) {
  const date = row.updatedAt || row.createdAt || row.submittedAt;
  const meta = [
    detailItem(t('account.nickname', 'Nickname'), row.nickname),
    detailItem(t('account.region', 'Region'), row.region ? `R${row.region}` : ''),
    detailItem(t('account.alliance', 'Alliance'), row.alliance),
    detailItem(t('account.rank', 'Rank'), String(row.rank || '').toUpperCase()),
    detailItem(t('account.shk', 'HQ'), row.shk),
    detailItem(t('playerEdit.troopType', 'Troop type'), troopLabel(row.troopType, currentSettings) || row.troopLabel),
    detailItem(t('playerEdit.tier', 'Tier'), row.tier),
    detailItem(t('playerEdit.march', 'March size'), formatNumber(row.marchSize)),
    detailItem(t('playerEdit.rally', 'Rally size'), formatNumber(row.rallySize)),
    detailItem(t('players.captain', 'Captain'), boolText(row.captainReady)),
    detailItem(t('common.shift', 'Shift'), shiftLabel(row.shift, currentSettings) || row.shiftLabel),
    detailItem(t('regionForm.readyAttack', 'Ready to attack'), boolText(row.readyToAttack)),
    detailItem(t('regionForm.captainReady', 'Ready to be captain'), boolText(row.captainReady)),
    detailItem(t('region.comment', 'Comment'), row.comment),
    detailItem(t('region.details.submitted', 'Submitted'), formatUserDate(row.submittedAt || row.createdAt)),
    detailItem(t('region.details.updated', 'Updated'), formatUserDate(date))
  ].join('');

  return `<section class="region-request-detail-section">
      <h3>${esc(t('region.details.main', 'Main information'))}</h3>
      <div class="region-request-detail-grid">${meta}</div>
    </section>
    <section class="region-request-detail-section">
      <h3>${esc(t('region.details.extraSquads', 'Extra squads'))}</h3>
      ${extraSquadsHtml(row)}
    </section>
    <section class="region-request-detail-section">
      <h3>${esc(t('region.details.customFields', 'Additional fields'))}</h3>
      ${customFieldsHtml(row)}
    </section>`;
}

function openRequestDetails(rowId) {
  const modal = $('#regionRequestDetailsModal');
  const body = $('#regionRequestDetailsBody');
  if (!modal || !body) return;
  const row = rows.find(item => String(item.id || item.uid || '') === String(rowId));
  if (!row) return;
  modal.dataset.rowId = String(row.id || row.uid || '');
  body.innerHTML = requestDetailsHtml(row);
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('wkd-modal-open');
}

function closeRequestDetails() {
  const modal = $('#regionRequestDetailsModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  modal.dataset.rowId = '';
  document.body.classList.remove('wkd-modal-open');
}

function render() {
  const body = $('#regionRegistrationsBody');
  if (!body) return;
  const visible = filteredRows();
  const total = serverPagedTable ? tableTotalRows : rows.length;
  body.innerHTML = visible.length ? visible.map(rowHtml).join('') : `<tr><td colspan="9">${t('region.table.emptyCycle', 'У цьому активному наборі ще немає гравців або заявок.')}</td></tr>`;
  if (quietRegionTableStatus) {
    setStatus(quietRegionTableStatus, 'warn');
  } else {
    setStatus(tv('region.tableShownStatus', '{regionLabel} {region}: shown {visible} of {total} records.', { regionLabel: t('account.region', 'Region'), region: currentRegion, visible: visible.length, total }), currentSettings?.open ? 'success' : 'warn');
  }
  renderRegionStats();
  renderPager();
}

async function load(user, options = {}) {
  currentUser = user;
  if (!user) {
    setStatus(t('region.tableAccessDenied', 'Only registered players of their own region can view the region table.'), 'warn');
    setTimeout(() => { window.location.href = 'login.html'; }, 900);
    return;
  }
  await saveSignedInUser(user).catch(() => null);
  const profile = await getUserProfile(user.uid, { forceRefresh: true }).catch(() => null);
  currentProfile = profile;
  const requestedRegion = readRegionFromUrl() || readStoredActiveRegion();
  const canUseRequestedRegion = Boolean(requestedRegion && (canViewAnyRegion(profile || {}, user) || canViewRegion(profile || {}, requestedRegion, user)));
  if (requestedRegion && !canUseRequestedRegion) {
    setStatus(t('region.otherRegionDenied', 'Only an admin, moderator, or a saved player/farm from that region can open another region.'), 'warn');
  }
  const allowedRegion = canUseRequestedRegion ? requestedRegion : '';
  let result = null;
  quietRegionTableStatus = '';
  if (!options?.keepPage) tablePage = 1;
  if (isRegionTableCacheEnabled() && allowedRegion) {
    result = await readRegionTableSnapshot(user, allowedRegion, {
      force: Boolean(options?.forceD1),
      page: tablePage,
      pageSize: pageSizeValue(),
      ...tableFilterValues()
    }).catch(error => {
      if (isRegionAccessDeniedCacheError(error)) {
        quietRegionTableStatus = t('players.regionAccessDenied', 'Немає доступу до цього регіону.');
        return { region: allowedRegion, rows: [], settings: {}, d1AccessDenied: true, source: 'cloudflare-d1-access-denied' };
      }
      if (isRegionSnapshotMissingCacheError(error)) {
        quietRegionTableStatus = t('players.regionD1MissingNoFirestore', 'Таблиця регіону ще не має D1-кешу. Firebase fallback не запускався, щоб не витрачати reads.');
        return { region: allowedRegion, rows: [], settings: {}, d1Missing: true, requiresManualFirestoreFallback: true, source: 'cloudflare-d1-missing-no-firestore' };
      }
      if (!isQuietRegionTableError(error) && window.WKD_DEBUG) console.warn('[WKD] region table D1 page unavailable:', error?.message || error);
      return null;
    });
  }
  serverPagedTable = Boolean(result && Number(result.totalRows) >= 0 && Number(result.pageSize));
  const preventFirestoreFallback = Boolean(result?.d1AccessDenied || result?.d1Missing || result?.requiresManualFirestoreFallback);
  if (!result) {
    result = await listRegionRegistrations(user, allowedRegion, { skipD1: true });
    await publishRegionTableSnapshot(user, {
      region: result.region,
      cycleId: result.settings?.currentCycleId || '',
      settings: result.settings || {},
      rows: result.rows || [],
      actorAccess: actorAccessForRegionRequest()
    });
    serverPagedTable = false;
  }
  currentProfile = result.profile || profile;
  currentRegion = result.region;
  rememberActiveRegion(currentRegion);
  rows = result.rows || [];
  tableSummary = result.summary || result.table?.summary || result.stats || null;
  tablePage = Math.max(1, Number(result.page || tablePage) || 1);
  if (tablePageSize !== 'all') tablePageSize = Math.max(10, Math.min(50, Number(result.pageSize || tablePageSize) || 10));
  tableTotalRows = serverPagedTable ? Math.max(0, Number(result.totalRows || 0) || 0) : rows.length;
  tableTotalPages = serverPagedTable ? Math.max(1, Number(result.totalPages || 1) || 1) : Math.max(1, Math.ceil(rows.length / tablePageSize));
  currentSettings = result.settings || {};
  installRegionEditorBridge();
  syncRegionEditorState();
  await loadAllianceColors();
  renderTroopFilter(currentSettings);
  renderTierFilter();
  regionOptions = await loadRegionOptions();
  $('#regionTablePill').textContent = regionPillText();
  const canManage = canManageRegion(currentProfile, currentRegion, currentUser);
  $('#openRegionSettingsBtn').hidden = !canManage;
  $('#shareRegionTableBtn') && ($('#shareRegionTableBtn').hidden = !canManage);
  setManagerSwitch();
  await populateRegionLookupList();
  startCycleTimer();
  render();
}


function handleLanguageChange() {
  $('#regionTablePill') && ($('#regionTablePill').textContent = regionPillText());
  if (currentSettings) { renderTroopFilter(currentSettings); renderTierFilter(); }
  startCycleTimer();
  render();
  const modal = $('#regionRequestDetailsModal');
  const rowId = modal?.classList.contains('is-open') ? modal.dataset.rowId : '';
  if (rowId) openRequestDetails(rowId);
}

async function shareRegionTableLink() {
  if (!currentUser || !currentRegion) return;
  try {
    const result = await shareRegionTable(currentUser, currentRegion);
    const link = makePublicShareUrl('./public-region-table.html', result.code || '');
    rememberShareCode('regionTable', result.code || '', { region: result.region || currentRegion || '' });
    await navigator.clipboard.writeText(link);
    setStatus(t('region.tableLinkCopied', 'Секретне посилання таблиці скопійовано.'), 'success');
    window.WKD?.showNotice?.(t('region.tableLinkCopied', 'Секретне посилання таблиці скопійовано.'));
  } catch (error) {
    setStatus(t('region.tableLinkFailed', 'Не вдалося створити секретне посилання таблиці.'), 'error');
    if (window.WKD_DEBUG) console.warn('[WKD] region table share link failed:', error?.message || error);
  }
}

function bind() {
  const scheduleReload = () => {
    window.clearTimeout(filterDebounceId);
    filterDebounceId = window.setTimeout(() => reloadTablePage({ resetPage: true }), 250);
  };
  ['#regionNickSearch', '#regionAllianceSearch'].forEach(selector => {
    $(selector)?.addEventListener('input', scheduleReload);
  });
  ['#regionTroopFilter', '#regionTierFilter', '#regionShiftFilter', '#regionStatusFilter'].forEach(selector => {
    $(selector)?.addEventListener('change', () => reloadTablePage({ resetPage: true }));
  });

  document.querySelectorAll('[data-region-sort]').forEach(button => {
    button.addEventListener('click', () => {
      const field = button.dataset.regionSort || 'nickname';
      tableSort.dir = tableSort.field === field ? tableSort.dir * -1 : 1;
      tableSort.field = field;
      document.querySelectorAll('[data-region-sort]').forEach(btn => btn.classList.remove('is-desc'));
      button.classList.toggle('is-desc', tableSort.dir < 0);
      reloadTablePage({ resetPage: true });
    });
  });

  $('#regionRegistrationsBody')?.addEventListener('click', event => {
    const editButton = event.target.closest('[data-region-edit-id]');
    if (editButton) {
      event.preventDefault();
      event.stopPropagation();
      openRegionPlayerEditor(editButton.dataset.regionEditId || '', editButton);
      return;
    }
    const button = event.target.closest('[data-region-request-id]');
    if (button) { event.preventDefault(); openRequestDetails(button.dataset.regionRequestId || ''); }
  });
  document.querySelectorAll('[data-region-request-close]').forEach(button => button.addEventListener('click', closeRequestDetails));
  $('#regionRequestDetailsModal')?.addEventListener('click', event => {
    if (event.target?.matches?.('[data-region-request-close], .modal-backdrop')) closeRequestDetails();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeRequestDetails();
  });
  $('#refreshRegionTableBtn')?.addEventListener('click', () => reloadTablePage({ forceD1: true }));
  $('#regionTablePrevBtn')?.addEventListener('click', () => {
    if (tablePage <= 1) return;
    tablePage -= 1;
    reloadTablePage({ keepPage: true });
  });
  $('#regionTableNextBtn')?.addEventListener('click', () => {
    if (tablePage >= tableTotalPages) return;
    tablePage += 1;
    reloadTablePage({ keepPage: true });
  });
  $('#regionTablePageSize')?.addEventListener('change', event => {
    setRegionTablePageSize(event.currentTarget.value);
    reloadTablePage({ resetPage: true });
  });
  $('#regionResetFiltersBtn')?.addEventListener('click', () => {
    const search = $('#regionNickSearch');
    const alliance = $('#regionAllianceSearch');
    const troop = $('#regionTroopFilter');
    const tier = $('#regionTierFilter');
    const shift = $('#regionShiftFilter');
    const status = $('#regionStatusFilter');
    if (search) search.value = '';
    if (alliance) alliance.value = '';
    if (troop) troop.value = 'all';
    if (tier) tier.value = 'all';
    if (shift) shift.value = 'all';
    if (status) status.value = 'all';
    setRegionTablePageSize('10');
    reloadTablePage({ resetPage: true });
  });
  $('#openRegionLookupBtn')?.addEventListener('click', () => openRegion($('#regionLookupInput')?.value || ''));
  $('#regionLookupInput')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') openRegion(event.currentTarget.value);
  });
  $('#openWastelandRegisterBtn')?.addEventListener('click', () => { window.location.href = `region-form.html?r=${currentRegion}`; });
  $('#openRegionSettingsBtn')?.addEventListener('click', () => { window.location.href = `region-settings.html?region=${currentRegion}`; });
  $('#shareRegionTableBtn')?.addEventListener('click', () => shareRegionTableLink());
document.addEventListener('wkd:language-changed', handleLanguageChange);
document.addEventListener('wkd:region-settings-updated', async event => {
  const detail = event.detail || {};
  if (detail.settings && (!detail.region || normalizeRegion(detail.region) === normalizeRegion(currentRegion))) {
    currentSettings = detail.settings;
  }
  if (currentUser) currentProfile = await getUserProfile(currentUser.uid, { forceRefresh: true }).catch(() => currentProfile);
  installRegionEditorBridge();
  render();
});
  document.addEventListener('wkd:time-display-changed', startCycleTimer);
}

async function init() {
  if (ready) return;
  ready = true;
  bind();
  await watchAuth(user => load(user).catch(error => {
    reportRegionTableProblem(error, 'region.tableOpenFailed', 'Could not open the region table. Check profile or region.');
  }));
}

document.addEventListener('wkd:partials-ready', init);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
} else {
  setTimeout(init, 0);
}
