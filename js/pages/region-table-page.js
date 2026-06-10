import { makePublicShareUrl, rememberShareCode } from '../core/share-links.js?v=142';
import { watchAuth } from '../services/firebase-service.js';
import { getGameProfile, getUserFarms, getUserProfile, saveSignedInUser } from '../services/user-db.js';
import {
  listRegionRegistrations,
  canManageRegion,
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
  shareRegionTable
} from '../services/region-db.js?v=142';
import { isRegionTableCacheEnabled, readRegionTableSnapshot, publishRegionTableSnapshot } from '../services/region-table-cache.js?v=142';

const $ = selector => document.querySelector(selector);
const ACTIVE_REGION_KEY = 'wkd.players.activeRegion';
const SOURCE_MODE_KEY = 'wkd.players.sourceMode';
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const tv = (key, fallback = '', vars = {}) => {
  let text = t(key, fallback);
  Object.entries(vars).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
  return text;
};

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
  const field = $('#regionManagerSwitch');
  const button = $('#openRegionLookupBtn');
  const input = $('#regionLookupInput');
  canSwitchRegion = regionOptions.length > 1;
  if (field) field.hidden = !canSwitchRegion;
  if (button) button.hidden = !canSwitchRegion;
  if (input) input.value = currentRegion || readRegionFromUrl() || '';
}

function renderTierFilter() {
  const select = $('#regionTierFilter');
  if (!select) return;
  const oldValue = select.value || 'all';
  const tiers = [...new Set(rows.map(row => String(row.tier || '').trim().toUpperCase()).filter(Boolean))]
    .sort((a, b) => (Number(b.replace(/[^0-9]/g, '')) || 0) - (Number(a.replace(/[^0-9]/g, '')) || 0));
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

function openRegion(region) {
  const safeRegion = normalizeRegion(region);
  if (!safeRegion) {
    setStatus(t('region.openRegionPrompt', 'Enter the region number you want to open.'), 'warn');
    return;
  }
  rememberActiveRegion(safeRegion);
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

function filteredRows() {
  const nick = String($('#regionNickSearch')?.value || '').trim().toLowerCase();
  const alliance = String($('#regionAllianceSearch')?.value || '').trim();
  const troop = $('#regionTroopFilter')?.value || 'all';
  const tier = $('#regionTierFilter')?.value || 'all';
  const shift = $('#regionShiftFilter')?.value || 'all';
  const list = rows.filter(row => {
    if (nick && !String(row.nickname || '').toLowerCase().includes(nick)) return false;
    // Alliance tags are case-sensitive: YYY, yyy and YyY are different alliances.
    if (alliance && !String(row.alliance || '').trim().includes(alliance)) return false;
    if (troop !== 'all' && row.troopType !== troop) return false;
    if (tier !== 'all' && String(row.tier || '').trim().toUpperCase() !== tier) return false;
    if (shift !== 'all' && row.shift !== shift) return false;
    return true;
  });
  return [...list].sort(compareRows);
}

function regionTableLabels() {
  return {
    nickname: esc(t('account.nickname', 'Nickname')),
    alliance: esc(t('account.alliance', 'Alliance')),
    troop: esc(t('playerEdit.troopType', 'Troop type')),
    tier: esc(t('playerEdit.tier', 'Tier')),
    march: esc(t('playerEdit.march', 'March size')),
    rally: esc(t('playerEdit.rally', 'Rally size')),
    captain: esc(t('players.captain', 'Captain')),
    shift: esc(t('account.shift', 'Shift'))
  };
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number.toLocaleString('uk-UA') : '—';
}

function rowHtml(row) {
  const labels = regionTableLabels();
  const rowId = row.id || row.uid || '';
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
  body.innerHTML = visible.length ? visible.map(rowHtml).join('') : `<tr><td colspan="8">${t('region.table.emptyCycle', 'У цьому активному наборі ще немає гравців або заявок.')}</td></tr>`;
  setStatus(tv('region.tableShownStatus', '{regionLabel} {region}: shown {visible} of {total} records.', { regionLabel: t('account.region', 'Region'), region: currentRegion, visible: visible.length, total: rows.length }), currentSettings?.open ? 'success' : 'warn');
}

async function load(user, options = {}) {
  currentUser = user;
  if (!user) {
    setStatus(t('region.tableAccessDenied', 'Only registered players of their own region can view the region table.'), 'warn');
    setTimeout(() => { window.location.href = 'login.html'; }, 900);
    return;
  }
  await saveSignedInUser(user).catch(() => null);
  const profile = await getUserProfile(user.uid).catch(() => null);
  currentProfile = profile;
  const requestedRegion = readRegionFromUrl() || readStoredActiveRegion();
  const canUseRequestedRegion = Boolean(requestedRegion && (canViewAnyRegion(profile || {}, user) || canViewRegion(profile || {}, requestedRegion, user)));
  if (requestedRegion && !canUseRequestedRegion) {
    setStatus(t('region.otherRegionDenied', 'Only an admin, moderator, or a saved player/farm from that region can open another region.'), 'warn');
  }
  const allowedRegion = canUseRequestedRegion ? requestedRegion : '';
  let result = null;
  if (isRegionTableCacheEnabled() && allowedRegion) {
    result = await readRegionTableSnapshot(user, allowedRegion, { force: Boolean(options?.forceD1) }).catch(error => {
      console.warn('[WKD] region table JSON cache unavailable, using Firebase:', error);
      return null;
    });
  }
  if (!result) {
    result = await listRegionRegistrations(user, allowedRegion, { skipD1: true });
    await publishRegionTableSnapshot(user, {
      region: result.region,
      cycleId: result.settings?.currentCycleId || '',
      settings: result.settings || {},
      rows: result.rows || []
    });
  }
  currentProfile = result.profile || profile;
  currentRegion = result.region;
  rememberActiveRegion(currentRegion);
  rows = result.rows || [];
  currentSettings = result.settings || {};
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
    console.error(error);
    setStatus(t('region.tableLinkFailed', 'Не вдалося створити секретне посилання таблиці.'), 'error');
  }
}

function bind() {
  ['#regionNickSearch', '#regionAllianceSearch', '#regionTroopFilter', '#regionTierFilter', '#regionShiftFilter'].forEach(selector => {
    $(selector)?.addEventListener('input', render);
    $(selector)?.addEventListener('change', render);
  });

  document.querySelectorAll('[data-region-sort]').forEach(button => {
    button.addEventListener('click', () => {
      const field = button.dataset.regionSort || 'nickname';
      tableSort.dir = tableSort.field === field ? tableSort.dir * -1 : 1;
      tableSort.field = field;
      document.querySelectorAll('[data-region-sort]').forEach(btn => btn.classList.remove('is-desc'));
      button.classList.toggle('is-desc', tableSort.dir < 0);
      render();
    });
  });

  $('#regionRegistrationsBody')?.addEventListener('click', event => {
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
  $('#refreshRegionTableBtn')?.addEventListener('click', () => load(currentUser, { forceD1: true }).catch(error => {
    console.error(error);
    setStatus(t('region.tableRefreshFailed', 'Could not refresh the region table.'), 'error');
  }));
  $('#openRegionLookupBtn')?.addEventListener('click', () => openRegion($('#regionLookupInput')?.value || ''));
  $('#regionLookupInput')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') openRegion(event.currentTarget.value);
  });
  $('#openWastelandRegisterBtn')?.addEventListener('click', () => { window.location.href = `region-form.html?r=${currentRegion}`; });
  $('#openRegionSettingsBtn')?.addEventListener('click', () => { window.location.href = `region-settings.html?region=${currentRegion}`; });
  $('#shareRegionTableBtn')?.addEventListener('click', () => shareRegionTableLink().catch(console.error));
  document.addEventListener('wkd:language-changed', handleLanguageChange);
  document.addEventListener('wkd:time-display-changed', startCycleTimer);
}

async function init() {
  if (ready) return;
  ready = true;
  bind();
  await watchAuth(user => load(user).catch(error => {
    console.error(error);
    setStatus(t('region.tableOpenFailed', 'Could not open the region table. Check profile or region.'), 'error');
  }));
}

document.addEventListener('wkd:partials-ready', init);
document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
