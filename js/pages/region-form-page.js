import { readShareCode, keepShareCodeInUrl } from '../core/share-links.js?v=192';
import { watchAuth } from '../services/firebase-service.js';
import { saveSignedInUser, getFarmById, getGameProfile, getUserFarms, getUserProfile, saveFarmWastelandProfile } from '../services/user-db.js';
import {
  getMyRegionContext,
  getRegionSettings,
  getRegionShareLinkCode,
  getMyWastelandRegistration,
  saveWastelandRegistration,
  readRegionFromUrl,
  resolveRegionShareLink,
  shiftLabel,
  getRegionFormStatus,
  getRegionLifecycle,
  getRegionActorName,
  formatCountdown,
  formatRegionDate,
  formatUtcAndLocal,
  isUtcAndLocalShown,
  setUtcAndLocalShown,
  canManageRegion,
  canViewAnyRegion,
  canViewRegion,
  listKnownRegionIds,
  listRegionAlliances,
  getAllowedTiers,
  troopLabel
} from '../services/region-db.js?v=192';
import { saveRegionRegistrationD1First, isRegionTableCacheEnabled, readRegionFormSettings } from '../services/region-table-cache.js?v=192';

const $ = selector => document.querySelector(selector);
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
const allianceTag3 = value => window.WKD?.allianceTag3 ? window.WKD.allianceTag3(value) : Array.from(String(value ?? '').trim().replace(/[\/\[\]#?]/g, '')).slice(0, 3).join('');
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
function translatedDefaultText(value, key, fallback) {
  const raw = String(value || '').trim();
  const defaults = Object.values(window.WKD_TRANSLATIONS || {}).map(dict => dict?.[key]).filter(Boolean);
  if (!raw || raw === fallback || defaults.includes(raw)) return t(key, fallback);
  return raw;
}
function settingsTitle(settings = {}) { return translatedDefaultText(settings.title, 'region.formTitle', 'Реєстрація на пустош'); }
function settingsDescription(settings = {}) { return translatedDefaultText(settings.description, 'region.formDefaultDescription', 'Заповни заявку для свого регіону. Консул або офіцер побачить її в таблиці регіону.'); }
const tiers = Array.from({ length: 14 }, (_, i) => `T${14 - i}`);
const readFarmFromUrl = () => new URLSearchParams(window.location.search).get('farm') || '';
function readShortLinkFromUrl() {
  const code = readShareCode('regionForm', {
    blockedPathNames: ['f', 'region-form'],
    pathRegex: /\/f\/\d{1,8}\/([A-Za-z0-9_-]{6,120})\/?$/
  });
  if (code) {
    try { sessionStorage.setItem('wkd.regionForm.shortCode', code); } catch {}
    keepShareCodeInUrl('regionForm', code);
    return code;
  }
  try { sessionStorage.removeItem('wkd.regionForm.shortCode'); } catch {}
  return '';
}
let currentUser = null;
let currentProfile = null;
let currentRegion = '';
let regionFromLink = '';
let shortCodeFromLink = '';
let farmFromLink = '';
let formSettings = null;
let selectedFarmId = 'main';
let regionAlliances = [];
let regionOptions = [];
let countdownId = null;
let ready = false;

let autoSubmitting = false;

async function loadRegionFormSettings(region) {
  const safeRegion = String(region || '').trim().replace(/[^0-9]/g, '');
  if (!safeRegion) throw new Error('region-required');
  const publicMode = Boolean(!currentUser || shortCodeFromLink);
  if (isRegionTableCacheEnabled && isRegionTableCacheEnabled()) {
    const cached = await readRegionFormSettings(safeRegion).catch(error => {
      if (publicMode) throw error;
      return null;
    });
    if (cached?.settings) return cached.settings;
  }
  if (publicMode) throw new Error('region-form-d1-settings-required');
  return getRegionSettings(safeRegion);
}

function readStoredActiveRegion() {
  try { return String(localStorage.getItem('wkd.players.activeRegion') || '').trim().replace(/[^0-9]/g, ''); } catch { return ''; }
}

function rememberActiveRegion(region = currentRegion) {
  const safeRegion = String(region || '').trim().replace(/[^0-9]/g, '');
  if (!safeRegion) return;
  try { localStorage.setItem('wkd.players.activeRegion', safeRegion); } catch {}
}


function storageSuffix(region = currentRegion, farmId = selectedFarmId) {
  const uid = currentUser?.uid || 'guest';
  const cycle = formSettings?.currentCycleId || 'default';
  return `${uid}.${region || 'region'}.${farmId || 'main'}.${cycle}`;
}
function draftKey(region = currentRegion, farmId = selectedFarmId) {
  return `wkd.regionFormDraft.${storageSuffix(region, farmId)}`;
}
function readJsonStorage(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function writeJsonStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function activeFarmProfile(profile = currentProfile, farmId = selectedFarmId) {
  return getFarmById(profile || {}, farmId || 'main') || getGameProfile(profile || {});
}
function accountDraft(profile = currentProfile, farmId = selectedFarmId) {
  const farm = activeFarmProfile(profile, farmId);
  const saved = farm?.wastelandProfile || null;
  if (!saved) return null;
  const hasData = ['nickname', 'alliance', 'troopType', 'tier', 'marchSize', 'rallySize', 'lairLevel', 'shift', 'comment']
    .some(key => String((key === 'nickname' ? farm?.nickname : key === 'alliance' ? farm?.alliance : saved[key]) ?? '').trim()) || Boolean(saved.extraEnabled || saved.readyToAttack || saved.captainReady);
  return hasData ? {
    ...saved,
    nickname: saved.nickname || farm?.nickname || '',
    alliance: saved.alliance || farm?.alliance || '',
    region: currentRegion || saved.region || farm?.region || '',
    farmId: farmId || 'main'
  } : null;
}
function getAutoProfilePreference(region = currentRegion, farmId = selectedFarmId) {
  if (!currentUser) return false;
  const farm = activeFarmProfile(currentProfile, farmId);
  return Boolean(farm?.wastelandProfile?.autoSubmitEnabled);
}
async function setAutoProfilePreference(enabled, region = currentRegion, farmId = selectedFarmId) {
  if (!currentUser) return;
  const values = { ...(accountDraft(currentProfile, farmId) || {}), ...readForm(), autoSubmitEnabled: enabled };
  currentProfile = await saveFarmWastelandProfile(currentUser, farmId || 'main', values).catch(error => {
    console.warn('[WKD] auto profile preference save failed:', error);
    return currentProfile;
  });
}
function syncAutoProfileCheckbox() {
  const input = $('#wrAutoFillProfile');
  if (!input) return false;
  input.checked = getAutoProfilePreference();
  input.disabled = !currentUser;
  return input.checked;
}
function syncTimeDisplayCheckbox() {
  const input = $('#wrShowUtcAndLocal');
  if (!input) return;
  input.checked = isUtcAndLocalShown();
}
function setFormInputsDisabled(disabled) {
  const form = $('#wastelandForm');
  if (!form) return;
  const keepEnabled = new Set(['openRegionTableBtn', 'wrSavedFarmSelect', 'wrAutoFillProfile', 'wrShowUtcAndLocal', 'wrFillFromProfileBtn']);
  [...form.elements].forEach(element => {
    element.disabled = disabled && !keepEnabled.has(element.id);
  });
}
async function saveDraft(values = readForm()) {
  const payload = { ...values, region: currentRegion, farmId: selectedFarmId || 'main', savedAtMs: Date.now(), cycleId: formSettings?.currentCycleId || '', autoSubmitEnabled: getAutoProfilePreference(currentRegion, selectedFarmId) };
  if (currentUser) {
    currentProfile = await saveFarmWastelandProfile(currentUser, selectedFarmId || 'main', payload);
    return payload;
  }
  writeJsonStorage(draftKey(), payload);
  return payload;
}
function loadDraft() {
  if (currentUser) return accountDraft(currentProfile, selectedFarmId);
  const draft = readJsonStorage(draftKey());
  if (!draft || String(draft.region || '') !== String(currentRegion || '')) return null;
  if ((draft.cycleId || '') && (formSettings?.currentCycleId || '') && draft.cycleId !== formSettings.currentCycleId) return null;
  return draft;
}
function clearDraft() {
  if (currentUser) return;
  try { localStorage.removeItem(draftKey()); } catch {}
}

function setStatus(text, type = 'muted') {
  const box = $('#regionStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}

function fillTierSelect(select, selected = 'T10', settings = formSettings) {
  if (!select) return;
  const allowed = getAllowedTiers(settings || {});
  const value = allowed.includes(selected) ? selected : allowed[0] || 'T10';
  select.innerHTML = allowed.map(tier => `<option value="${tier}" ${tier === value ? 'selected' : ''}>${tier}</option>`).join('');
}

function fillExtraTierSelects(selectedByType = {}, settings = formSettings) {
  document.querySelectorAll('[data-extra-tier]').forEach(select => {
    const troopType = select.dataset.extraTier || '';
    fillTierSelect(select, selectedByType[troopType] || settings?.minTier || 'T10', settings);
  });
}

function normalizeExtraSquads(row = {}) {
  if (Array.isArray(row.extraSquads)) {
    return row.extraSquads
      .map(item => ({ troopType: String(item?.troopType || '').trim(), tier: String(item?.tier || '').trim().toUpperCase() }))
      .filter(item => item.troopType && item.tier);
  }
  if (row.extraEnabled && row.extraTroopType && row.extraTier) {
    return [{ troopType: String(row.extraTroopType).trim(), tier: String(row.extraTier).trim().toUpperCase() }];
  }
  return [];
}

function renderTroopOptions(settings = formSettings) {
  const options = [
    ['fighter', t('troop.fighter', 'Бійці')],
    ['rider', t('troop.rider', 'Наїзники')],
    ['shooter', t('troop.shooter', 'Стрільці')],
    ...(Array.isArray(settings?.customTroopTypes) ? settings.customTroopTypes.map(item => [item.id, item.label]) : [])
  ];
  const select = $('#wrTroopType');
  if (!select) return;
  const oldValue = select.value;
  select.innerHTML = `<option value="">${t('region.form.chooseTroopType', 'Вибери тип')}</option>` + options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  if (options.some(([value]) => value === oldValue)) select.value = oldValue;
}

function renderCustomFields(settings = formSettings, saved = {}) {
  const wrap = $('#regionCustomFieldsWrap');
  const box = $('#regionCustomFields');
  if (!wrap || !box) return;
  const fields = Array.isArray(settings?.customFields) ? settings.customFields : [];
  wrap.hidden = !fields.length;
  box.innerHTML = fields.map(field => {
    const value = saved[field.id];
    if (field.type === 'checkbox') {
      return `<label class="region-check"><input type="checkbox" data-custom-field="${field.id}" ${value ? 'checked' : ''} /> ${field.label}</label>`;
    }
    return `<label class="region-field"><span>${field.label}</span><input data-custom-field="${field.id}" value="${String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))}" /></label>`;
  }).join('');
}

function renderAllianceOptions() {
  const list = $('#wrAllianceList');
  if (!list) return;
  list.innerHTML = regionAlliances
    .map(item => {
      const tag = String(item.tag || item.id || '').trim();
      const label = [tag, item.name].filter(Boolean).join(' — ');
      return tag ? `<option value="${esc(tag)}" label="${esc(label)}"></option>` : '';
    })
    .join('');
}

async function loadRegionAlliancesForForm() {
  regionAlliances = [];
  if (!currentRegion) return;
  try {
    regionAlliances = await listRegionAlliances(currentRegion);
  } catch (error) {
    console.warn('[WKD] region form alliances skipped:', error);
    regionAlliances = [];
  }
  renderAllianceOptions();
}

function renderShiftOptions(settings) {
  const box = $('#wrShiftOptions');
  if (!box) return;
  const shifts = settings?.shifts?.length ? settings.shifts : ['shift1', 'shift2'];
  box.innerHTML = shifts.map((shift, index) => `
    <label class="region-check">
      <input type="radio" name="wrShift" value="${shift}" ${index === 0 ? 'checked' : ''} required /> ${shiftLabel(shift, settings)}
    </label>`).join('');
}

function setFormState(settings) {
  const state = $('#regionFormState');
  if (!state) return;
  const status = getRegionFormStatus(settings);
  state.textContent = status.open ? t('region.formOpen', 'Form open') : t('region.formClosed', 'Form closed');
  state.classList.toggle('region-pill--open', status.open);
  state.classList.toggle('region-pill--closed', !status.open);
}

function renderEventInfo(settings = {}) {
  const box = $('#regionEventInfo');
  if (!box) return;
  const hostAlliance = String(settings.hostAlliance || '').trim();
  const governor = String(settings.governor || '').trim();
  box.hidden = !hostAlliance && !governor;
  setDynamicText('#regionHostAllianceText', tv('region.hostAllianceLabel', 'Host alliance: {value}', { value: hostAlliance || '—' }));
  setDynamicText('#regionGovernorText', tv('region.governorLabel', 'Governor: {value}', { value: governor || '—' }));
}

function openedByText(settings = formSettings || {}) {
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

function openedAtText(settings = formSettings || {}) {
  const life = getRegionLifecycle(settings || {});
  const ms = Number(life.openedAtMs) || Number(life.openAtMs) || Number(life.updatedAtMs) || 0;
  return ms ? formatUtcAndLocal(ms) : t('regionSettings.notStartedYet', 'ще не запускали');
}

function eventStartText(settings = formSettings || {}) {
  const life = getRegionLifecycle(settings || {});
  const ms = Number(life.eventStartAtMs || life.startAtMs) || 0;
  return ms ? formatUtcAndLocal(ms) : '—';
}

function startCountdown(settings) {
  const box = $('#regionCountdownBox');
  if (!box) return;
  const update = () => {
    const status = getRegionFormStatus(settings);
    box.hidden = false;
    setDynamicHtml('#regionCloseText', infoLine('regionInfo.closeLabel', 'Закриття:', formatUtcAndLocal(status.closeAtMs), 'region-info-value'));
    const startMs = Number(status.eventStartAtMs) || 0;
    const startValue = startMs ? `${eventStartText(status)} · ${t('regionInfo.untilStart', 'до старту')}: ${formatCountdown(startMs - Date.now())}` : '—';
    setDynamicHtml('#regionEventText', infoLine('regionInfo.startLabel', 'Старт:', startValue, 'region-info-value'));
    setDynamicHtml('#regionOpenedText', infoLine('regionInfo.startedAtLabel', 'Запущено:', openedAtText(status), 'region-info-value'));
    setDynamicHtml('#regionOpenedByText', infoLine('regionInfo.startedByLabel', 'Запустив:', openedByText(status), 'region-starter-name'));
    const countdownValue = status.open
      ? formatCountdown(status.closeAtMs - Date.now())
      : (status.reason === 'notOpenYet' ? `${t('regionInfo.opensAt', 'відкриється')}: ${formatUtcAndLocal(status.openAtMs)}` : t('region.registrationClosed', 'Requests are closed. A consul or officer will open the next set.'));
    setDynamicHtml('#regionCountdownText', infoLine(status.open ? 'regionInfo.remainingLabel' : 'regionInfo.statusLabel', status.open ? 'Залишилось:' : 'Статус:', countdownValue, status.open ? 'region-info-value region-info-value--good' : 'region-info-value'));
    setFormState(status);
  };
  clearInterval(countdownId);
  update();
  countdownId = setInterval(update, 30000);
}

function publicLockKey() {
  const cycle = formSettings?.currentCycleId || 'default';
  return `wkd.publicRegistration.${currentRegion}.${cycle}`;
}

function lockForm(message) {
  setFormInputsDisabled(true);
  setStatus(message, 'success');
}

function farmRegion(farm = {}) {
  return String(farm.region || '').trim().replace(/[^0-9]/g, '');
}

function getSavedFarms(profile = {}, region = '', options = {}) {
  const safeRegion = String(region || '').trim().replace(/[^0-9]/g, '');
  const main = { ...getGameProfile(profile), farmId: 'main', id: 'main' };
  const farms = [main, ...getUserFarms(profile)].filter(farm => farm.nickname || farm.alliance || farm.region);
  if (options.allRegions || !safeRegion) return farms;
  const matched = farms.filter(farm => farmRegion(farm) === safeRegion);
  return matched.length ? matched : farms;
}

function firstFarmIdForRegion(profile = {}, region = '') {
  const safeRegion = String(region || '').trim().replace(/[^0-9]/g, '');
  return getSavedFarms(profile, safeRegion).find(farm => farmRegion(farm) === safeRegion)?.farmId || '';
}

function uniqueRegionsFromProfile(profile = {}) {
  return [...new Set(getSavedFarms(profile, '', { allRegions: true })
    .map(farm => farmRegion(farm))
    .filter(Boolean))]
    .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}

async function buildRegionOptions(profile = currentProfile, user = currentUser) {
  const regions = new Set(uniqueRegionsFromProfile(profile || {}));
  if (currentRegion) regions.add(currentRegion);
  if (regionFromLink) regions.add(regionFromLink);
  if (readStoredActiveRegion()) regions.add(readStoredActiveRegion());
  if (user && canViewAnyRegion(profile || {}, user)) {
    const known = await listKnownRegionIds().catch(error => {
      console.warn('[WKD] region form known regions skipped:', error);
      return [];
    });
    known.forEach(region => { if (region) regions.add(region); });
  }
  return [...regions].filter(Boolean).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}

async function refreshRegionOptions() {
  regionOptions = await buildRegionOptions(currentProfile || {}, currentUser);
  if (!currentRegion && regionOptions.length) currentRegion = regionOptions[0];
  renderRegionSelect();
  return regionOptions;
}

function renderRegionSelect() {
  const wrap = $('#wrRegionSelectWrap');
  const select = $('#wrRegionSelect');
  if (!wrap || !select) return;
  const list = regionOptions.length ? regionOptions : (currentRegion ? [currentRegion] : []);
  const canSeeSelector = Boolean(currentUser && list.length > 1);
  wrap.hidden = !canSeeSelector;
  if (!canSeeSelector) return;
  const oldValue = select.value || currentRegion || list[0] || '';
  select.innerHTML = list.map(region => `<option value="${esc(region)}">R${esc(region)}</option>`).join('');
  select.value = list.includes(currentRegion) ? currentRegion : (list.includes(oldValue) ? oldValue : list[0] || '');
}

function regionPillText() {
  return currentRegion ? `R${currentRegion}` : 'R—';
}

function buildShortPlayerLink(code = shortCodeFromLink || '', region = currentRegion) {
  const safeRegion = String(region || '').trim();
  const safeCode = String(code || '').trim();
  if (!safeRegion || !safeCode) return '';
  const url = new URL('./f.html', window.location.href);
  url.searchParams.set('r', safeRegion);
  url.searchParams.set('s', safeCode);
  url.hash = `${safeRegion}/${safeCode}`;
  return url.toString();
}
async function updatePlayerShortLinkPanel() {
  const panel = $('#regionPlayerShortLinkPanel');
  const input = $('#regionPlayerShortLink');
  if (!panel || !input) return;
  panel.hidden = true;
  if (!currentUser || !canManageRegion(currentProfile || {}, currentRegion, currentUser)) return;
  const code = shortCodeFromLink || await getRegionShareLinkCode(currentUser, currentRegion).catch(() => '');
  const link = buildShortPlayerLink(code, currentRegion);
  if (!link) return;
  shortCodeFromLink = code;
  input.value = link;
  panel.hidden = false;
}

function farmLabel(farm = {}, index = 0) {
  const name = farm.nickname || (farm.farmId === 'main' ? t('account.mainPlayer', 'Main player') : tv('account.farmNumber', 'Farm {number}', { number: index + 1 }));
  const region = farm.region ? ` · R${farm.region}` : '';
  return `${name}${region}`;
}

function renderSavedFarmTools(profile = {}) {
  const panel = $('#regionProfileTools');
  const select = $('#wrSavedFarmSelect');
  if (!panel || !select) return;
  const showAllRegions = Boolean(currentUser);
  const farms = getSavedFarms(profile, currentRegion, { allRegions: showAllRegions });
  const hasRegionOptions = Boolean(currentUser && regionOptions.length > 1);
  panel.hidden = !currentUser || (!farms.length && !hasRegionOptions);
  select.hidden = !farms.length;
  if (!farms.length) {
    renderRegionSelect();
    return;
  }
  const selectedFarm = getFarmById(profile, selectedFarmId);
  const matchingFarmId = currentRegion ? firstFarmIdForRegion(profile, currentRegion) : '';
  if (!selectedFarm) selectedFarmId = matchingFarmId || farms[0].farmId || 'main';
  else if (matchingFarmId && farmRegion(selectedFarm) !== currentRegion) selectedFarmId = matchingFarmId;
  select.innerHTML = farms.map((farm, index) => `
    <option value="${farm.farmId || farm.id || 'main'}" ${(farm.farmId || farm.id) === selectedFarmId ? 'selected' : ''}>${farmLabel(farm, index)}</option>
  `).join('');
  select.value = selectedFarmId;
  renderRegionSelect();
}

function fillProfileFields(profile, farmId = selectedFarmId) {
  const game = getFarmById(profile || {}, farmId) || getGameProfile(profile || {});
  selectedFarmId = game.farmId || farmId || 'main';
  const saved = game.wastelandProfile || {};
  fillSavedRegistration({
    ...saved,
    nickname: game.nickname || saved.nickname || '',
    alliance: game.alliance || saved.alliance || '',
    rank: game.rank || saved.rank || 'p1',
    shk: game.shk || saved.shk || ''
  }, { copyEventFields: false });
}

function fillSavedRegistration(row, options = {}) {
  if (!row) return;
  const copyEventFields = options.copyEventFields !== false;
  $('#wrNickname').value = row.nickname || $('#wrNickname').value;
  $('#wrAlliance').value = row.alliance || $('#wrAlliance').value;
  renderTroopOptions(formSettings);
  fillTierSelect($('#wrTier'), row.tier || 'T10', formSettings);
  $('#wrTroopType').value = row.troopType || '';
  $('#wrLairLevel') && ($('#wrLairLevel').value = row.lairLevel || row.lair || '');
  $('#wrMarch').value = row.marchSize || '';
  $('#wrRally').value = row.rallySize || '';
  $('#wrReadyAttack') && ($('#wrReadyAttack').checked = copyEventFields ? Boolean(row.readyToAttack) : false);
  $('#wrCaptain') && ($('#wrCaptain').checked = copyEventFields ? Boolean(row.captainReady) : false);
  const shift = copyEventFields ? $(`input[name="wrShift"][value="${row.shift}"]`) : null;
  if (shift) shift.checked = true;
  $('#wrComment').value = copyEventFields ? (row.comment || '') : '';
  const extraSquads = copyEventFields ? normalizeExtraSquads(row) : [];
  const extraByType = Object.fromEntries(extraSquads.map(item => [item.troopType, item.tier]));
  $('#wrExtraEnabled').checked = Boolean(extraSquads.length);
  fillExtraTierSelects(extraByType, formSettings);
  document.querySelectorAll('[data-extra-troop]').forEach(input => {
    input.checked = Boolean(extraByType[input.dataset.extraTroop]);
  });
  renderCustomFields(formSettings, copyEventFields ? (row.customFields || {}) : {});
  toggleExtraFields();
}

function toggleExtraFields() {
  const enabled = Boolean($('#wrExtraEnabled')?.checked);
  const fields = $('#extraTroopFields');
  if (!fields) return;
  fields.hidden = false;
  fields.classList.toggle('is-disabled', !enabled);
  fields.querySelectorAll('[data-extra-troop]').forEach(input => { input.disabled = !enabled; });
  fields.querySelectorAll('.region-extra-card').forEach(card => {
    const troop = card.dataset.extraCard || '';
    const input = card.querySelector(`[data-extra-troop="${troop}"]`);
    const active = enabled && Boolean(input?.checked);
    card.classList.toggle('is-disabled', !enabled);
    card.classList.toggle('is-extra-selected', active);
    card.querySelectorAll('[data-extra-tier]').forEach(select => { select.disabled = !active; });
  });
}

function readExtraSquads() {
  if (!$('#wrExtraEnabled')?.checked) return [];
  return [...document.querySelectorAll('[data-extra-troop]:checked')]
    .map(input => {
      const troopType = input.dataset.extraTroop || '';
      const tier = document.querySelector(`[data-extra-tier="${troopType}"]`)?.value || '';
      return { troopType, tier };
    })
    .filter(item => item.troopType);
}

function readForm() {
  const extraSquads = readExtraSquads();
  const firstExtra = extraSquads[0] || {};
  return {
    farmId: selectedFarmId || 'main',
    nickname: $('#wrNickname')?.value,
    alliance: allianceTag3($('#wrAlliance')?.value),
    troopType: $('#wrTroopType')?.value,
    tier: $('#wrTier')?.value,
    lairLevel: $('#wrLairLevel')?.value,
    marchSize: $('#wrMarch')?.value,
    rallySize: $('#wrRally')?.value,
    readyToJoin: true,
    readyToAttack: $('#wrReadyAttack')?.checked,
    captainReady: $('#wrCaptain')?.checked,
    shift: $('input[name="wrShift"]:checked')?.value,
    comment: $('#wrComment')?.value,
    extraEnabled: Boolean(extraSquads.length),
    extraSquads,
    extraTroopType: firstExtra.troopType || '',
    extraTier: firstExtra.tier || '',
    customFields: Object.fromEntries([...document.querySelectorAll('[data-custom-field]')].map(input => [input.dataset.customField, input.type === 'checkbox' ? input.checked : input.value]))
  };
}

function validate(values) {
  const errors = [];
  if (!values.nickname?.trim()) errors.push(t('region.errorNickname', 'Enter nickname.'));
  if (!values.alliance?.trim()) errors.push(t('region.errorAlliance', 'Enter alliance.'));
  if (!values.troopType) errors.push(t('region.errorMainTroop', 'Choose the main troop type.'));
  if (!values.shift) errors.push(t('region.errorShift', 'Choose a shift.'));
  if (values.tier && !getAllowedTiers(formSettings || {}).includes(values.tier)) errors.push(tv('region.errorMinTier', 'Minimum tier in this region: {tier}.', { tier: formSettings?.minTier || 'T10' }));
  const troops = ['fighter', 'rider', 'shooter', ...(formSettings?.customTroopTypes || []).map(item => item.id)];
  if (values.troopType && !troops.includes(values.troopType)) errors.push(t('region.errorAllowedTroop', 'Choose a troop type from the region allowed list.'));
  if ($('#wrExtraEnabled')?.checked && !values.extraSquads.length) errors.push(t('region.errorExtraTroopRequired', 'Select at least one troop type for the additional squad.'));
  values.extraSquads.forEach(item => {
    if (!troops.includes(item.troopType)) errors.push(t('region.errorExtraTroopAllowed', 'Additional troop type must be from the region list.'));
    if (!item.tier) errors.push(t('region.errorExtraTier', 'Choose a tier for the additional squad.'));
    if (item.tier && !getAllowedTiers(formSettings || {}).includes(item.tier)) errors.push(tv('region.errorExtraMinTier', 'Additional tier must be at least: {tier}.', { tier: formSettings?.minTier || 'T10' }));
  });
  return errors;
}

function shouldUseD1FirstRegistration() {
  return Boolean(isRegionTableCacheEnabled && isRegionTableCacheEnabled());
}

function isD1OnlyRegistration() {
  return Boolean(!currentUser || shortCodeFromLink);
}

function d1RegistrationErrorCode(error) {
  return String(error?.data?.error || error?.message || '').trim();
}

function isHardD1RegistrationError(error) {
  const code = d1RegistrationErrorCode(error);
  return error?.status === 409 || [
    'registration-nickname-duplicate-region',
    'row_owner_mismatch',
    'share_code_required',
    'share_not_found',
    'share_expired',
    'share_region_mismatch',
    'share_cycle_mismatch'
  ].includes(code);
}

async function confirmUpdateExistingRequest() {
  const title = t('region.requestAlreadySubmittedUpdateTitle', 'Заявка вже була подана');
  const message = t('region.requestAlreadySubmittedUpdateMessage', 'Заявка з такими самими даними вже є в активному циклі. Оновити її ще раз чи скасувати?');
  if (window.WKD?.confirmDialog) {
    return window.WKD.confirmDialog({
      title,
      message,
      note: t('region.requestAlreadySubmittedUpdateNote', 'Якщо нічого не змінилось, натисни “Скасувати” — тоді ліміти на запис у D1 не витрачаються.'),
      icon: 'ℹ️',
      acceptText: t('region.requestAlreadySubmittedUpdateAccept', 'Оновити заявку'),
      cancelText: t('region.requestAlreadySubmittedUpdateCancel', 'Скасувати'),
      acceptClass: 'btn btn-success-solid'
    });
  }
  return window.confirm(`${title}

${message}`);
}

async function showNicknameDuplicateDialog() {
  const title = t('region.errorNicknameDuplicateGuestTitle', 'Нікнейм уже зареєстрований');
  const message = t('region.errorNicknameDuplicateGuestMessage', 'Гравець з таким нікнеймом уже зареєстрований у цьому регіоні. Щоб змінити дані, зареєструйся на сайті або звернись до консула регіону.');
  setStatus(message, 'error');
  if (window.WKD?.actionDoneDialog) {
    await window.WKD.actionDoneDialog({
      title,
      message,
      note: t('region.errorNicknameDuplicateGuestNote', 'Це захищає таблицю від дублікатів з різних пристроїв.'),
      icon: '⚠️',
      acceptText: t('common.goHome', 'На головну'),
      cancelText: t('common.continue', 'Продовжити'),
      acceptClass: 'btn btn-danger-solid',
      href: 'index.html'
    });
  } else {
    window.alert(`${title}

${message}`);
  }
}

async function submitRegistrationD1First(values, options = {}) {
  const payload = { ...values, region: currentRegion, publicLink: Boolean(!currentUser || shortCodeFromLink) };
  return saveRegionRegistrationD1First(currentUser, currentRegion, payload, formSettings || {}, {
    shareCode: shortCodeFromLink || '',
    publicLink: Boolean(!currentUser || shortCodeFromLink),
    forceUpdate: Boolean(options.forceUpdate)
  });
}

async function submitCurrentRegistration(values, { auto = false, forceUpdate = false } = {}) {
  try {
    setStatus(auto ? t('region.autoSubmitting', 'Автоматично відправляю заявку з профілю...') : t('region.savingRequest', 'Saving request...'), 'muted');
    let savedRequest = null;
    if (shouldUseD1FirstRegistration()) {
      try {
        savedRequest = await submitRegistrationD1First(values, { forceUpdate });
      } catch (d1Error) {
        if (isHardD1RegistrationError(d1Error) || isD1OnlyRegistration()) throw d1Error;
        console.warn('[WKD] D1-first registration failed for signed-in account, using Firebase fallback:', d1Error);
        savedRequest = await saveWastelandRegistration(currentUser, values, currentRegion);
      }
    } else {
      if (isD1OnlyRegistration()) throw new Error('d1-registration-required');
      savedRequest = await saveWastelandRegistration(currentUser, values, currentRegion);
    }

    if (savedRequest?.unchanged && !forceUpdate) {
      setStatus(t('region.requestAlreadySavedNoChanges', 'Заявка вже була подана без змін.'), 'warn');
      if (auto) return true;
      const shouldUpdate = await confirmUpdateExistingRequest();
      if (!shouldUpdate) {
        setStatus(t('region.requestAlreadySubmittedUpdateCancelled', 'Оновлення скасовано. Додатковий запис у D1 не виконано.'), 'muted');
        return false;
      }
      return submitCurrentRegistration(values, { auto, forceUpdate: true });
    }

    // D1 registration is the submitted request. Do not also save the same data into
    // the account draft automatically; that Firestore write is only needed when the
    // player explicitly presses “Зберегти заявку” or changes auto-profile settings.
    clearDraft();
    localStorage.setItem('wkd.players.sourceMode', 'region');
    if (currentRegion) localStorage.setItem('wkd.players.activeRegion', currentRegion);
    window.dispatchEvent(new CustomEvent('wkd:region-registration-saved', { detail: { region: currentRegion, farmId: savedRequest?.farmId || values.farmId || 'main' } }));
    if (!currentUser) {
      localStorage.setItem(publicLockKey(), String(Date.now()));
      lockForm(t('region.requestSavedGuestLocked', 'Request saved. Now only a consul or region officer can change it.'));
      window.WKD?.actionDoneDialog?.({
        title: t('region.requestSavedDialogTitle', 'Заявку відправлено'),
        message: tv('region.requestSavedDialogMessage', 'Заявку для регіону R{region} збережено. Її вже видно у таблиці регіону.', { region: currentRegion }),
        href: 'index.html',
        cancelText: t('common.continue', 'Продовжити')
      });
      return true;
    }
    const successMessage = savedRequest?.existing
      ? t('region.requestUpdatedCurrentCycle', 'Заявку оновлено. Нові дані вже збережені для активного циклу.')
      : t('region.requestSavedCurrentCycle', 'Request saved. This player is already submitted for the current set; choose another farm from the list if needed.');
    setStatus(auto ? t('region.autoSubmitted', 'Автоматична заявка з профілю відправлена.') : successMessage, 'success');
    window.WKD?.actionDoneDialog?.({
      title: t('region.requestSavedDialogTitle', 'Заявку відправлено'),
      message: tv('region.requestSavedDialogMessage', 'Заявку для регіону R{region} збережено. Її вже видно у таблиці регіону.', { region: currentRegion }),
      href: 'index.html',
      cancelText: t('common.continue', 'Продовжити')
    });
    return true;
  } catch (error) {
    console.error(error);
    if (error?.message === 'registration-already-submitted') {
      lockForm(t('region.requestAlreadySavedLocked', 'Your request is already saved. Only a consul or officer can change it.'));
      return false;
    }
    if (error?.message === 'region-form-closed') {
      setStatus(t('region.formClosedDraftAllowed', 'The registration page is open for preparation. You can fill in the data, but sending is available only when the region opens registration.'), 'error');
      return false;
    }
    if (d1RegistrationErrorCode(error) === 'registration-nickname-duplicate-region') {
      await showNicknameDuplicateDialog();
      return false;
    }
    if (isD1OnlyRegistration() && (error?.message === 'd1-registration-required' || !isHardD1RegistrationError(error))) {
      setStatus(t('region.d1RegistrationRequired', 'Гостьова реєстрація працює тільки через Cloudflare D1. Перевір деплой Worker або відкрий секретне посилання ще раз.'), 'error');
      return false;
    }
    setStatus(t('region.requestSaveFailed', 'Could not save the request. Check access rights or try again.'), 'error');
    return false;
  }
}

async function maybeAutoSubmitFromProfile(reason = '') {
  if (!currentUser || autoSubmitting || !autoFillFromProfileEnabled()) return false;
  const status = getRegionFormStatus(formSettings);
  fillProfileFields(currentProfile, selectedFarmId);
  const values = readForm();
  await saveDraft(values);
  if (!status.open) {
    setStatus(t('region.autoProfileSavedClosed', 'Автозаповнення для цього гравця збережено. Форма зараз закрита, тому заявку можна буде відправити після відкриття реєстрації.'), 'warn');
    return false;
  }
  const saved = await getMyWastelandRegistration(currentUser, currentRegion, selectedFarmId).catch(() => null);
  if (saved) {
    fillSavedRegistration(saved);
    setStatus(t('region.requestAlreadySavedShort', 'Заявка для цього гравця вже є в активному циклі.'), 'success');
    return false;
  }
  const errors = validate(values);
  if (errors.length) {
    setStatus(errors.join(' '), 'error');
    return false;
  }
  autoSubmitting = true;
  try {
    return await submitCurrentRegistration(values, { auto: true, reason });
  } finally {
    autoSubmitting = false;
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const status = getRegionFormStatus(formSettings);
  if (!status.open) {
    await saveDraft(readForm());
    setStatus(t('region.formClosedDraftAllowed', 'The registration page is open for preparation. You can fill in the data, but sending is available only when the region opens registration.'), 'error');
    return;
  }
  if (!currentUser && localStorage.getItem(publicLockKey())) {
    lockForm(t('region.alreadySubmittedBrowserTable', 'A request has already been sent from this browser. Only a consul or officer can change it in the region table.'));
    return;
  }
  const values = readForm();
  const errors = validate(values);
  if (errors.length) {
    setStatus(errors.join(' '), 'error');
    return;
  }
  await submitCurrentRegistration(values);
}

async function handleSaveDraft() {
  const values = readForm();
  await saveDraft(values);
  setStatus(currentUser ? t('region.draftSavedAccount', 'Поточні дані заявки збережено в акаунті.') : t('region.draftSaved', 'Поточні дані заявки збережено на цьому пристрої.'), 'success');
}

async function prepareForm(settings) {
  formSettings = settings;
  rememberActiveRegion(currentRegion);
  $('#regionNumberPill').textContent = regionPillText();
  $('#regionFormTitleText').textContent = settingsTitle(settings);
  $('#regionFormDescText').textContent = settingsDescription(settings);
  setFormState(settings);
  renderEventInfo(settings);
  await loadRegionAlliancesForForm();
  startCountdown(settings);
  updatePlayerShortLinkPanel().catch(error => console.warn('[WKD] player short link skipped:', error));

  const status = getRegionFormStatus(settings);
  const extraPanel = $('#extraTroopPanel');
  if (extraPanel) extraPanel.hidden = !settings.allowExtraTroop;
  renderTroopOptions(settings);
  fillTierSelect($('#wrTier'), settings.minTier || 'T10', settings);
  fillExtraTierSelects({}, settings);
  renderCustomFields(settings, {});
  renderShiftOptions(settings);
  toggleExtraFields();
  $('#wastelandForm').hidden = false;

  if (!status.open) {
    setStatus(t('region.formClosedDraftAllowed', 'The registration page is open for preparation. You can fill in the data, but sending is available only when the region opens registration.'), 'warn');
    return false;
  }
  return true;
}

async function resolveShortLinkSettings() {
  const resolved = await resolveRegionShareLink(shortCodeFromLink);
  currentRegion = resolved.region;
  return resolved.settings;
}

async function loadPublicForm(region) {
  currentUser = null;
  currentProfile = null;
  const settings = shortCodeFromLink ? await resolveShortLinkSettings() : await loadRegionFormSettings(region);
  currentRegion = shortCodeFromLink ? currentRegion : region;
  $('#openRegionTableBtn').hidden = true;
  const open = await prepareForm(settings);
  syncTimeDisplayCheckbox();
  const draft = loadDraft();
  if (draft) fillSavedRegistration(draft);
  if (!open) return;
  if (localStorage.getItem(publicLockKey())) {
    lockForm(t('region.alreadySubmittedBrowser', 'A request has already been sent from this browser. Only a consul or region officer can change it.'));
    return;
  }
  setStatus(t('region.publicCanSubmit', 'You can fill out the request without Google sign-in. After sending, only a consul or officer can edit it.'), 'muted');
}

async function loadSignedInForm(user) {
  currentUser = user;
  await saveSignedInUser(user).catch(() => null);
  currentProfile = await getUserProfile(user.uid).catch(() => null);
  if (shortCodeFromLink) {
    try {
      await resolveShortLinkSettings();
    } catch (error) {
      console.warn('[WKD] short link ignored for signed-in player:', error);
      shortCodeFromLink = '';
      currentRegion = regionFromLink || '';
    }
    if (farmFromLink && getFarmById(currentProfile || {}, farmFromLink)) selectedFarmId = farmFromLink;
  }
  if (!currentRegion && regionFromLink) {
    const context = await getMyRegionContext(user, regionFromLink);
    currentProfile = context.profile || currentProfile;
    currentRegion = context.region;
    if (farmFromLink && getFarmById(currentProfile || {}, farmFromLink)) selectedFarmId = farmFromLink;
  }
  if (!currentRegion) {
    const context = await getMyRegionContext(user, readStoredActiveRegion());
    currentProfile = context.profile;
    currentRegion = context.region;
  }
  await refreshRegionOptions();
  if (!farmFromLink) {
    const matchFarmId = firstFarmIdForRegion(currentProfile, currentRegion);
    if (matchFarmId) selectedFarmId = matchFarmId;
  }
  const settings = await loadRegionFormSettings(currentRegion);
  $('#openRegionTableBtn').hidden = !canViewRegion(currentProfile, currentRegion, currentUser);
  const open = await prepareForm(settings);
  renderSavedFarmTools(currentProfile);
  syncTimeDisplayCheckbox();
  const autoProfile = syncAutoProfileCheckbox();
  if (autoProfile) fillProfileFields(currentProfile);
  const saved = await getMyWastelandRegistration(user, currentRegion, selectedFarmId).catch(() => null);
  const draft = loadDraft();
  if (saved) fillSavedRegistration(saved);
  else if (draft) fillSavedRegistration(draft);
  if (saved && !canManageRegion(currentProfile, currentRegion, currentUser)) {
    setFormInputsDisabled(false);
    setStatus(t('region.savedPlayerCanUpdate', 'Твоя заявка вже є. Якщо дані змінились, можна відправити форму ще раз і оновити заявку.'), 'success');
  }
  setFormInputsDisabled(false);
  if (autoProfile && !saved) await maybeAutoSubmitFromProfile('load');
  if (!open) {
    setStatus(t('region.formClosedDraftAllowed', 'The registration page is open for preparation. You can fill in the data, but sending is available only when the region opens registration.'), 'warn');
    return;
  }
  setStatus(saved ? t('region.savedLeaderCanUpdate', 'Your request already exists. You are a region leader, so you can update it.') : t('region.fillRegionForm', 'Fill out the region form.'), saved ? 'success' : 'muted');
}

async function switchSavedFarm(farmId = selectedFarmId, { copyProfile = true } = {}) {
  const farm = getFarmById(currentProfile || {}, farmId) || getGameProfile(currentProfile || {});
  const nextRegion = farmRegion(farm) || currentRegion;
  selectedFarmId = farm.farmId || farmId || 'main';
  let isOpen = getRegionFormStatus(formSettings || {}).open;
  if (nextRegion && nextRegion !== currentRegion && currentUser) {
    currentRegion = nextRegion;
    rememberActiveRegion(currentRegion);
    if (!regionOptions.includes(currentRegion)) {
      regionOptions = [...new Set([...regionOptions, currentRegion])].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
    }
    const settings = await loadRegionFormSettings(currentRegion);
    isOpen = await prepareForm(settings);
    renderSavedFarmTools(currentProfile);
    $('#openRegionTableBtn').hidden = !canViewRegion(currentProfile, currentRegion, currentUser);
  } else {
    renderSavedFarmTools(currentProfile);
  }
  syncAutoProfileCheckbox();
  syncTimeDisplayCheckbox();
  if (copyProfile) fillProfileFields(currentProfile, selectedFarmId);
  const saved = await getMyWastelandRegistration(currentUser, currentRegion, selectedFarmId).catch(() => null);
  const draft = loadDraft();
  if (saved) fillSavedRegistration(saved);
  else if (draft) fillSavedRegistration(draft);
  if (saved && !canManageRegion(currentProfile, currentRegion, currentUser)) {
    setFormInputsDisabled(false);
    setStatus(t('region.savedPlayerCanUpdate', 'Твоя заявка вже є. Якщо дані змінились, можна відправити форму ще раз і оновити заявку.'), 'success');
  } else setFormInputsDisabled(false);
  if (!saved && autoFillFromProfileEnabled()) await maybeAutoSubmitFromProfile('switch');
  return isOpen;
}

async function switchRegion(region = currentRegion, { copyProfile = true } = {}) {
  const nextRegion = String(region || '').trim().replace(/[^0-9]/g, '');
  if (!nextRegion || !currentUser) return false;
  currentRegion = nextRegion;
  rememberActiveRegion(currentRegion);
  if (!regionOptions.includes(currentRegion)) {
    regionOptions = [...new Set([...regionOptions, currentRegion])].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  }
  const matchingFarmId = firstFarmIdForRegion(currentProfile || {}, currentRegion);
  if (matchingFarmId) selectedFarmId = matchingFarmId;
  const settings = await loadRegionFormSettings(currentRegion);
  const isOpen = await prepareForm(settings);
  renderSavedFarmTools(currentProfile);
  $('#openRegionTableBtn').hidden = !canViewRegion(currentProfile, currentRegion, currentUser);
  syncAutoProfileCheckbox();
  syncTimeDisplayCheckbox();
  if (copyProfile && getFarmById(currentProfile || {}, selectedFarmId)) fillProfileFields(currentProfile, selectedFarmId);
  const saved = await getMyWastelandRegistration(currentUser, currentRegion, selectedFarmId).catch(() => null);
  const draft = loadDraft();
  if (saved) fillSavedRegistration(saved);
  else if (draft) fillSavedRegistration(draft);
  if (saved && !canManageRegion(currentProfile, currentRegion, currentUser)) {
    setFormInputsDisabled(false);
    setStatus(t('region.savedPlayerCanUpdate', 'Твоя заявка вже є. Якщо дані змінились, можна відправити форму ще раз і оновити заявку.'), 'success');
  } else setFormInputsDisabled(false);
  if (!saved && autoFillFromProfileEnabled()) await maybeAutoSubmitFromProfile('region');
  return isOpen;
}

function autoFillFromProfileEnabled() {
  const input = $('#wrAutoFillProfile');
  return Boolean(input?.checked);
}


function handleLanguageChange() {
  if (!formSettings) return;
  $('#regionNumberPill') && ($('#regionNumberPill').textContent = regionPillText());
  $('#regionFormTitleText') && ($('#regionFormTitleText').textContent = settingsTitle(formSettings));
  $('#regionFormDescText') && ($('#regionFormDescText').textContent = settingsDescription(formSettings));
  const selectedTroop = $('#wrTroopType')?.value || '';
  const selectedShift = $('input[name="wrShift"]:checked')?.value || '';
  const extraEnabled = Boolean($('#wrExtraEnabled')?.checked);
  const extraSquads = readExtraSquads();
  const extraByType = Object.fromEntries(extraSquads.map(item => [item.troopType, item.tier]));
  renderTroopOptions(formSettings);
  renderAllianceOptions();
  if (selectedTroop) $('#wrTroopType') && ($('#wrTroopType').value = selectedTroop);
  renderShiftOptions(formSettings);
  const shiftInput = selectedShift ? $(`input[name="wrShift"][value="${selectedShift}"]`) : null;
  if (shiftInput) shiftInput.checked = true;
  $('#wrExtraEnabled') && ($('#wrExtraEnabled').checked = extraEnabled);
  fillExtraTierSelects(extraByType, formSettings);
  document.querySelectorAll('[data-extra-troop]').forEach(input => {
    input.checked = Boolean(extraByType[input.dataset.extraTroop]);
  });
  setFormState(formSettings);
  renderRegionSelect();
  renderEventInfo(formSettings);
  startCountdown(formSettings);
  toggleExtraFields();
}

function bind() {
  $('#wastelandForm')?.addEventListener('submit', handleSubmit);
  document.addEventListener('change', event => {
    if (event.target?.matches?.('#wrExtraEnabled, [data-extra-troop]')) toggleExtraFields();
  });
  $('#wrAutoFillProfile')?.addEventListener('change', event => {
    selectedFarmId = $('#wrSavedFarmSelect')?.value || selectedFarmId || 'main';
    const enabled = Boolean(event.currentTarget.checked);
    setAutoProfilePreference(enabled).catch(error => console.warn('[WKD] auto profile preference save failed:', error));
    if (!enabled) {
      setStatus(t('region.autoProfileOff', 'Автозаповнення з профілю вимкнено для цього гравця.'), 'muted');
      return;
    }
    switchSavedFarm(selectedFarmId, { copyProfile: true }).then(() => maybeAutoSubmitFromProfile('toggle')).catch(error => {
      console.error(error);
      setStatus(t('region.formOpenFailed', 'Could not open the region form. Check the link or access rights.'), 'error');
    });
  });
  $('#wrShowUtcAndLocal')?.addEventListener('change', event => {
    setUtcAndLocalShown(Boolean(event.currentTarget.checked));
    document.dispatchEvent(new CustomEvent('wkd:time-display-changed'));
    if (formSettings) startCountdown(formSettings);
  });
  $('#wrRegionSelect')?.addEventListener('change', event => {
    const nextRegion = event.currentTarget.value || currentRegion;
    switchRegion(nextRegion, { copyProfile: autoFillFromProfileEnabled() }).then(ok => {
      if (ok && autoFillFromProfileEnabled()) setStatus(t('region.selectedPlayerCopied', 'Selected player data copied to the form. Check troop type, tier and shift.'), 'success');
      else if (ok) setStatus(tv('region.regionChanged', 'Region changed to R{region}.', { region: currentRegion }), 'muted');
      else setStatus(t('region.formClosedDraftAllowed', 'The registration page is open for preparation. You can fill in the data, but sending is available only when the region opens registration.'), 'warn');
    }).catch(error => {
      console.error(error);
      setStatus(t('region.formOpenFailed', 'Could not open the region form. Check the link or access rights.'), 'error');
    });
  });
  $('#wrSavedFarmSelect')?.addEventListener('change', event => {
    selectedFarmId = event.currentTarget.value || 'main';
    switchSavedFarm(selectedFarmId, { copyProfile: autoFillFromProfileEnabled() }).then(ok => {
      if (ok && autoFillFromProfileEnabled()) setStatus(t('region.selectedPlayerCopied', 'Selected player data copied to the form. Check troop type, tier and shift.'), 'success');
      else if (ok) setStatus(t('region.selectedPlayerChanged', 'Selected player changed. You can copy saved data manually.'), 'muted');
      else setStatus(t('region.formClosedDraftAllowed', 'The registration page is open for preparation. You can fill in the data, but sending is available only when the region opens registration.'), 'warn');
    }).catch(error => {
      console.error(error);
      setStatus(t('region.formOpenFailed', 'Could not open the region form. Check the link or access rights.'), 'error');
    });
  });
  $('#wrFillFromProfileBtn')?.addEventListener('click', () => {
    selectedFarmId = $('#wrSavedFarmSelect')?.value || selectedFarmId || 'main';
    switchSavedFarm(selectedFarmId, { copyProfile: true }).then(() => {
      setStatus(t('region.profileCopied', 'Profile data copied into the request.'), 'success');
    }).catch(error => {
      console.error(error);
      setStatus(t('region.formOpenFailed', 'Could not open the region form. Check the link or access rights.'), 'error');
    });
  });
  $('#copyRegionPlayerShortLinkBtn')?.addEventListener('click', async () => {
    const input = $('#regionPlayerShortLink');
    if (!input?.value) return;
    try { await navigator.clipboard.writeText(input.value); setStatus(t('region.linkCopiedPublic', 'Посилання скопійовано.'), 'success'); }
    catch { input.select(); document.execCommand('copy'); setStatus(t('region.linkSelectedManual', 'Посилання виділено. Скопіюй його вручну.'), 'warn'); }
  });
  $('#saveWastelandDraftBtn')?.addEventListener('click', handleSaveDraft);
  $('#resetWastelandFormBtn')?.addEventListener('click', () => {
    $('#wastelandForm')?.reset();
    if (autoFillFromProfileEnabled() && currentProfile) fillProfileFields(currentProfile, selectedFarmId);
    syncAutoProfileCheckbox();
    syncTimeDisplayCheckbox();
    toggleExtraFields();
  });
  $('#openRegionTableBtn')?.addEventListener('click', () => { window.location.href = `region-table.html?region=${currentRegion}`; });
  document.addEventListener('wkd:language-changed', handleLanguageChange);
  document.addEventListener('wkd:time-display-changed', () => { if (formSettings) startCountdown(formSettings); });
}

async function init() {
  if (ready) return;
  if (!$('#wastelandForm') || !$('#regionStatus') || !$('#regionNumberPill')) return;
  ready = true;
  bind();
  regionFromLink = readRegionFromUrl();
  shortCodeFromLink = readShortLinkFromUrl();
  farmFromLink = readFarmFromUrl();
  if (regionFromLink || shortCodeFromLink) {
    await watchAuth(user => {
      if (!shortCodeFromLink && !user) {
        setStatus(t('region.secretLinkRequired', 'For security, guest registration opens only through a short secret link from a consul or officer.'), 'warn');
        return;
      }
      (user ? loadSignedInForm(user) : loadPublicForm(regionFromLink)).catch(error => {
        const d1Missing = ['short-link-d1-required', 'region-form-d1-settings-required', 'region-form-cache-disabled'].includes(error?.message) || /d1|region-form|share/i.test(String(error?.message || ''));
        const message = error?.message === 'short-link-expired' || error?.message === 'short-link-not-found'
          ? t('region.shortLinkInvalid', 'This short link is no longer valid. Ask the consul or officer for a new link.')
          : d1Missing
            ? t('region.d1SettingsMissing', 'Налаштування форми ще не опубліковані в D1. Попроси консула або офіцера натиснути Зберегти/Запустити у налаштуваннях регіону.')
            : t('region.formOpenFailed', 'Could not open the region form. Check the link or access rights.');
        setStatus(message, 'error');
      });
    });
    return;
  }
  await watchAuth(user => {
    if (!user) {
      setStatus(t('region.openLinkOrSignIn', 'Open the link from a consul/officer or sign in with Google.'), 'warn');
      return;
    }
    loadSignedInForm(user).catch(error => {
      console.error(error);
      setStatus(t('region.fillProfileFirst', 'Fill in your player profile with a region first.'), 'error');
    });
  });
}

document.addEventListener('wkd:partials-ready', init);
document.addEventListener('DOMContentLoaded', () => setTimeout(() => { if ($('#wastelandForm')) init(); }, 0));
