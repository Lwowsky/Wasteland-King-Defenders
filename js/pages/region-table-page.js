import { watchAuth } from '../services/firebase-service.js';
import { getGameProfile, getUserProfile, saveSignedInUser } from '../services/user-db.js';
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
  listRegionAlliances
} from '../services/region-db.js?v=39';

const $ = selector => document.querySelector(selector);
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const tv = (key, fallback = '', vars = {}) => {
  let text = t(key, fallback);
  Object.entries(vars).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
  return text;
};
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
let currentUser = null;
let currentProfile = null;
let currentRegion = '';
let rows = [];
let allianceColorMap = new Map();
let currentSettings = null;
let canSwitchRegion = false;
let timerId = null;
let ready = false;


function normTag(value) { return String(value || '').trim(); }
function hashHue(value) { let hash = 2166136261; for (const ch of String(value || 'empty')) { hash ^= ch.codePointAt(0) || 0; hash = Math.imul(hash, 16777619) >>> 0; } return ((hash % 360) + 360) % 360; }
function allianceHue(tag) {
  const safe = normTag(tag);
  const custom = allianceColorMap.get(safe);
  return Number.isFinite(custom) ? custom : hashHue(`${currentRegion}:${safe}`);
}
function allianceBadge(tag) {
  const safe = normTag(tag) || '—';
  return `<span class="alliance-badge" style="--ally-hue:${allianceHue(safe)}"><span class="badge-dot"></span><span>${esc(safe)}</span></span>`;
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
  const direct = String(settings.openedByName || settings.openedByEmail || '').trim();
  if (direct) return direct;
  const uid = String(settings.openedByUid || settings.updatedBy || '').trim();
  if (uid && currentUser?.uid === uid) {
    const game = getGameProfile(currentProfile || {});
    return String(currentUser.displayName || currentProfile?.displayName || game.nickname || currentUser.email || uid).trim();
  }
  return uid || t('regionSettings.unknownStarter', 'невідомо');
}

function openedAtText(settings = currentSettings || {}) {
  const ms = Number(settings.openedAtMs) || Number(settings.openAtMs) || 0;
  return ms ? formatUtcAndLocal(ms) : t('regionSettings.notStartedYet', 'ще не запускали');
}

function eventStartText(settings = currentSettings || {}) {
  const closeMs = Number(settings.closeAtMs) || 0;
  const closeHours = Number(settings.closeHours) || 24;
  const ms = Number(settings.eventStartAtMs || settings.startAtMs || settings.wastelandStartAtMs) || (closeMs ? closeMs + closeHours * 60 * 60 * 1000 : 0);
  return ms ? formatUtcAndLocal(ms) : '—';
}

function setManagerSwitch() {
  const switchBox = $('#regionManagerSwitch');
  const input = $('#regionLookupInput');
  if (!switchBox) return;
  switchBox.hidden = !canSwitchRegion;
  if (input) input.value = currentRegion || readRegionFromUrl() || '';
}

function startCycleTimer() {
  const box = $('#regionTableCycleBox');
  if (!box || !currentSettings) return;
  const update = () => {
    box.hidden = false;
    $('#regionTableCycleText') && ($('#regionTableCycleText').textContent = currentSettings.open ? t('region.formOpen', 'Form open') : t('region.formClosed', 'Form closed'));
    $('#regionTableCloseText') && ($('#regionTableCloseText').textContent = tv('region.closeAtLabel', 'Closes: {value}', { value: formatUtcAndLocal(currentSettings.closeAtMs) }));
    $('#regionTableStartText') && ($('#regionTableStartText').textContent = tv('region.startAtLabel', 'Start: {value}', { value: eventStartText(currentSettings) }));
    $('#regionTableOpenedText') && ($('#regionTableOpenedText').textContent = tv('regionSettings.openedAtLabel', 'Started: {value}', { value: openedAtText(currentSettings) }));
    $('#regionTableOpenedByText') && ($('#regionTableOpenedByText').textContent = tv('regionSettings.openedByLabel', 'Started by: {value}', { value: openedByText(currentSettings) }));
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
  const url = new URL('region-table.html', window.location.href);
  url.searchParams.set('region', safeRegion);
  window.location.href = url.toString();
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

function filteredRows() {
  const nick = String($('#regionNickSearch')?.value || '').trim().toLowerCase();
  const alliance = String($('#regionAllianceSearch')?.value || '').trim().toLowerCase();
  const troop = $('#regionTroopFilter')?.value || 'all';
  const shift = $('#regionShiftFilter')?.value || 'all';
  return rows.filter(row => {
    if (nick && !String(row.nickname || '').toLowerCase().includes(nick)) return false;
    if (alliance && !String(row.alliance || '').toLowerCase().includes(alliance)) return false;
    if (troop !== 'all' && row.troopType !== troop && !rowExtraSquads(row).some(item => item.troopType === troop)) return false;
    if (shift !== 'all' && row.shift !== shift) return false;
    return true;
  });
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
    <td data-label="${labels.troop}"><span class="tag ${troopClass(row.troopType)}">${esc(troopLabel(row.troopType, currentSettings) || row.troopLabel || '—')}</span></td>
    <td data-label="${labels.tier}"><span class="rank-badge">${esc(row.tier || '—')}</span></td>
    <td data-label="${labels.march}">${formatNumber(row.marchSize)}</td>
    <td data-label="${labels.rally}">${formatNumber(row.rallySize)}</td>
    <td data-label="${labels.captain}"><span class="role-badge ${row.captainReady ? 'role-consul' : 'role-player'}">${row.captainReady ? t('common.yes', 'Yes') : t('common.no', 'No')}</span></td>
    <td data-label="${labels.shift}"><span class="role-badge role-officer">${esc(shiftLabel(row.shift, currentSettings) || row.shiftLabel || '—')}</span></td>
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
  return `<div class="region-request-extra-list">${squads.map(item => `<span class="tag ${troopClass(item.troopType)}">${esc(troopLabel(item.troopType, currentSettings))} · ${esc(item.tier || '—')}</span>`).join('')}</div>`;
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

async function load(user) {
  currentUser = user;
  if (!user) {
    setStatus(t('region.tableAccessDenied', 'Only registered players of their own region can view the region table.'), 'warn');
    setTimeout(() => { window.location.href = 'login.html'; }, 900);
    return;
  }
  await saveSignedInUser(user).catch(() => null);
  const profile = await getUserProfile(user.uid).catch(() => null);
  currentProfile = profile;
  const requestedRegion = readRegionFromUrl();
  if (requestedRegion && !canViewRegion(profile, requestedRegion, user)) {
    setStatus(t('region.otherRegionDenied', 'Only an admin, moderator, or a saved player/farm from that region can open another region.'), 'warn');
  }
  const result = await listRegionRegistrations(user, canViewRegion(profile, requestedRegion, user) ? requestedRegion : '');
  currentProfile = result.profile;
  currentRegion = result.region;
  rows = result.rows;
  currentSettings = result.settings;
  await loadAllianceColors();
  renderTroopFilter(currentSettings);
  canSwitchRegion = canViewAnyRegion(currentProfile, currentUser);
  $('#regionTablePill').textContent = regionPillText();
  $('#openRegionSettingsBtn').hidden = !canManageRegion(currentProfile, currentRegion, currentUser);
  setManagerSwitch();
  startCycleTimer();
  render();
}


function handleLanguageChange() {
  $('#regionTablePill') && ($('#regionTablePill').textContent = regionPillText());
  if (currentSettings) renderTroopFilter(currentSettings);
  startCycleTimer();
  render();
  const modal = $('#regionRequestDetailsModal');
  const rowId = modal?.classList.contains('is-open') ? modal.dataset.rowId : '';
  if (rowId) openRequestDetails(rowId);
}

function bind() {
  ['#regionNickSearch', '#regionAllianceSearch', '#regionTroopFilter', '#regionShiftFilter'].forEach(selector => {
    $(selector)?.addEventListener('input', render);
    $(selector)?.addEventListener('change', render);
  });
  $('#regionRegistrationsBody')?.addEventListener('click', event => {
    const button = event.target.closest('[data-region-request-id]');
    if (button) openRequestDetails(button.dataset.regionRequestId || '');
  });
  document.querySelectorAll('[data-region-request-close]').forEach(button => button.addEventListener('click', closeRequestDetails));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeRequestDetails();
  });
  $('#refreshRegionTableBtn')?.addEventListener('click', () => load(currentUser).catch(error => {
    console.error(error);
    setStatus(t('region.tableRefreshFailed', 'Could not refresh the region table.'), 'error');
  }));
  $('#openRegionLookupBtn')?.addEventListener('click', () => openRegion($('#regionLookupInput')?.value || ''));
  $('#regionLookupInput')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') openRegion(event.currentTarget.value);
  });
  $('#copyRegionFormLinkBtn')?.addEventListener('click', copyRegionFormLink);
  $('#openWastelandRegisterBtn')?.addEventListener('click', () => { window.location.href = `region-form.html?region=${currentRegion}`; });
  $('#openRegionSettingsBtn')?.addEventListener('click', () => { window.location.href = `region-settings.html?region=${currentRegion}`; });
  document.addEventListener('wkd:language-changed', handleLanguageChange);
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
