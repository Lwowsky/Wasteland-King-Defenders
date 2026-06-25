import { watchAuth } from '../services/firebase-service.js';
import {
  getFarmById,
  getGameProfile,
  getUserFarms,
  getUserProfile,
  saveFarmWastelandProfile,
  saveSignedInUser
} from '../services/user-db.js';
import { getRegionSettings, getRegionFormStatus, listRegionAlliances } from '../services/region-db.js?v=080';
import { isRegionTableCacheEnabled, saveRegionRegistrationD1First, readRegionFormSettings as readRegionFormSettingsD1, autoSubmitSignature, readAutoSubmitMarker, writeAutoSubmitMarker, autoSubmitMarkerMatches, syncAutoSubmitTemplateD1IfNeeded } from '../services/region-table-cache.js?v=080';

const $ = selector => document.querySelector(selector);
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const tv = (key, fallback = '', vars = {}) => {
  let text = t(key, fallback);
  Object.entries(vars).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
  return text;
};
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const allianceTag3 = value => window.WKD?.allianceTag3
  ? window.WKD.allianceTag3(value)
  : Array.from(String(value ?? '').trim().replace(/[\/\[\]#?]/g, '')).slice(0, 3).join('');
const tiers = Array.from({ length: 14 }, (_, i) => `T${14 - i}`);
const allShifts = ['shift1', 'shift2', 'shift3', 'shift4', 'both'];
let availableShifts = ['shift1', 'shift2'];
function boolValue(value) {
  if (value === true || value === false) return value;
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return false;
  if (/^(0|false|no|ні|нi|нет|nope|n)$/.test(text)) return false;
  return /^(1|true|yes|так|да|はい|是|예|y)$/.test(text);
}
function shiftLabel(id) {
  return {
    shift1: t('shift.shift1', 'Зміна 1'),
    shift2: t('shift.shift2', 'Зміна 2'),
    shift3: t('shift.shift3', 'Зміна 3'),
    shift4: t('shift.shift4', 'Зміна 4'),
    both: t('shift.both', 'Обидві')
  }[id] || id;
}


function normalizeShiftForAvailable(value = 'shift1') {
  const shift = allShifts.includes(value) ? value : 'shift1';
  if (availableShifts.includes(shift)) return shift;
  if ((shift === 'shift3' || shift === 'shift4') && availableShifts.includes('shift2')) return 'shift2';
  if (shift === 'shift4' && availableShifts.includes('shift3')) return 'shift3';
  if (shift === 'both' && availableShifts.includes('both')) return 'both';
  return availableShifts[0] || 'shift1';
}

async function loadShiftSettingsForFarm(farm = {}) {
  const fallback = ['shift1', 'shift2'];
  if (!farm?.region) {
    availableShifts = fallback;
    return;
  }
  try {
    const settings = await getRegionSettings(farm.region);
    const configured = Array.isArray(settings?.shifts) && settings.shifts.length ? settings.shifts : fallback;
    availableShifts = configured.filter(shift => allShifts.includes(shift));
    if (!availableShifts.length) availableShifts = fallback;
  } catch (error) {
    console.warn('[WKD] profile shift settings skipped:', error);
    availableShifts = fallback;
  }
}

let currentUser = null;
let profile = null;
let selectedFarmId = 'main';
let regionAlliances = [];
let currentRegionSettings = null;
let ready = false;
let profileRegionStatusLockUntil = 0;
let autoSubmitInProgress = false;
let profileRegionStatusI18n = null;

function translateStatusEntry(entry = null) {
  if (!entry?.key) return '';
  return tv(entry.key, entry.fallback || entry.key, entry.vars || {});
}

function setStatus(text, type = 'muted', i18nEntry = null) {
  const box = $('#regionStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
  profileRegionStatusI18n = i18nEntry ? { ...i18nEntry, type } : null;
}

function setStatusKey(key, fallback = '', type = 'muted', vars = {}) {
  const entry = { key, fallback, vars };
  setStatus(translateStatusEntry(entry), type, entry);
}

function setStickyStatus(text, type = 'success', durationMs = 18000) {
  profileRegionStatusLockUntil = Date.now() + durationMs;
  setStatus(text, type);
}

function setStickyStatusKey(key, fallback = '', type = 'success', vars = {}, durationMs = 18000) {
  profileRegionStatusLockUntil = Date.now() + durationMs;
  setStatusKey(key, fallback, type, vars);
}

function profileStatusLocked() {
  return Date.now() < profileRegionStatusLockUntil;
}

function fillTierSelect(select, selected = 'T10') {
  if (!select) return;
  select.innerHTML = tiers.map(tier => `<option value="${tier}" ${tier === selected ? 'selected' : ''}>${tier}</option>`).join('');
}

function fillExtraTierSelects(selectedByType = {}) {
  document.querySelectorAll('[data-extra-tier]').forEach(select => {
    const troopType = select.dataset.extraTier || '';
    fillTierSelect(select, selectedByType[troopType] || 'T10');
  });
}

function normalizeExtraSquads(data = {}) {
  if (Array.isArray(data.extraSquads)) {
    return data.extraSquads
      .map(item => ({ troopType: String(item?.troopType || '').trim(), tier: String(item?.tier || '').trim().toUpperCase() }))
      .filter(item => item.troopType && item.tier);
  }
  if (data.extraEnabled && data.extraTroopType && data.extraTier) {
    return [{ troopType: String(data.extraTroopType).trim(), tier: String(data.extraTier).trim().toUpperCase() }];
  }
  return [];
}

function renderTroopOptions() {
  const options = [
    ['fighter', t('troop.fighter', 'Бійці')],
    ['rider', t('troop.rider', 'Наїзники')],
    ['shooter', t('troop.shooter', 'Стрільці')]
  ];
  const select = $('#wrTroopType');
  if (!select) return;
  const oldValue = select.value;
  select.innerHTML = `<option value="">${t('region.form.chooseTroopType', 'Вибери тип')}</option>` + options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  if (options.some(([value]) => value === oldValue)) select.value = oldValue;
}

function renderShiftOptions(selected = 'shift1') {
  const box = $('#wrShiftOptions');
  if (!box) return;
  const selectedSafe = normalizeShiftForAvailable(selected);
  box.innerHTML = availableShifts.map(shift => `
    <label class="region-check">
      <input type="radio" name="wrShift" value="${shift}" ${shift === selectedSafe ? 'checked' : ''} /> ${shiftLabel(shift)}
    </label>`).join('');
}

function farmsFromProfile(data = {}) {
  const main = { ...getGameProfile(data), farmId: 'main', id: 'main' };
  return [main, ...getUserFarms(data)].filter(farm => farm.nickname || farm.region || farm.alliance);
}

function farmLabel(farm = {}, index = 0) {
  const name = farm.nickname || (farm.farmId === 'main' ? t('profile.mainPlayer', 'Main player') : tv('profile.farmName', 'Farm {number}', { number: index + 1 }));
  const region = farm.region ? ` · R${farm.region}` : '';
  return `${name}${region}`;
}

function renderAllianceOptions(selected = '') {
  const list = $('#wrAllianceList');
  const select = $('#wrAllianceSelect');
  const wrap = document.querySelector('.region-alliance-control');
  const options = regionAlliances
    .map(item => {
      const tag = allianceTag3(item?.tag || item?.id || item);
      const label = [tag, item?.name].filter(Boolean).join(' — ');
      return tag ? { tag, label: label || tag } : null;
    })
    .filter(Boolean);
  if (list) list.innerHTML = options.map(item => `<option value="${esc(item.tag)}" label="${esc(item.label)}"></option>`).join('');
  if (select) {
    // У профільній вкладці не показуємо друге поле поруч з інпутом.
    // Список альянсів залишається в datalist, а select використовується тільки на сторінці заявки.
    select.hidden = true;
    select.innerHTML = '';
  }
  wrap?.classList.remove('has-alliance-select');
  syncAllianceSelect(selected || $('#wrAlliance')?.value || '');
}

function syncAllianceSelect(value = '') {
  const select = $('#wrAllianceSelect');
  if (!select || select.hidden) return;
  const tag = allianceTag3(value || '');
  select.value = [...select.options].some(option => option.value === tag) ? tag : '';
}

function setAllianceInputValue(value = '') {
  const input = $('#wrAlliance');
  const tag = allianceTag3(value || '');
  if (input) input.value = tag;
  syncAllianceSelect(tag);
}

async function loadLatestRegionSettingsForProfile(region = '', options = {}) {
  const safeRegion = String(region || '').replace(/[^0-9]/g, '');
  if (!safeRegion) return null;
  if (isRegionTableCacheEnabled?.()) {
    try {
      const d1 = await readRegionFormSettingsD1(safeRegion, { force: Boolean(options.force), ttlMs: options.force ? 0 : undefined });
      if (d1?.settings) {
        if (Array.isArray(d1.alliances) && d1.alliances.length) regionAlliances = d1.alliances;
        return {
          ...d1.settings,
          currentCycleId: d1.cycleId || d1.settings.currentCycleId || '',
          shortLinkCode: d1.code || d1.settings.shortLinkCode || '',
          code: d1.code || d1.settings.code || ''
        };
      }
    } catch (error) {
      if (window.WKD_DEBUG) console.warn('[WKD] profile D1 region settings skipped:', error);
    }
  }
  try {
    return await getRegionSettings(safeRegion);
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] profile region settings skipped:', error);
    return null;
  }
}

async function loadAlliancesForFarm(farm = {}) {
  regionAlliances = [];
  currentRegionSettings = null;
  if (!farm?.region) {
    renderAllianceOptions('');
    return;
  }
  currentRegionSettings = await loadLatestRegionSettingsForProfile(farm.region);
  if (!regionAlliances.length) {
    try {
      regionAlliances = await listRegionAlliances(farm.region);
    } catch (error) {
      if (window.WKD_DEBUG) console.warn('[WKD] profile alliance list skipped:', error);
      regionAlliances = [];
    }
  }
  if (!regionAlliances.length) {
    const tags = new Set();
    const add = value => { const tag = allianceTag3(typeof value === 'string' ? value : (value?.tag || value?.id || '')); if (tag) tags.add(tag); };
    add(currentRegionSettings?.hostAlliance || currentRegionSettings?.activeHostAlliance || '');
    (Array.isArray(currentRegionSettings?.rotationAlliances) ? currentRegionSettings.rotationAlliances : []).forEach(add);
    regionAlliances = [...tags].map(tag => ({ id: tag, tag, name: tag }));
  }
  renderAllianceOptions(farm.alliance || farm.wastelandProfile?.alliance || '');
}

function allianceFallbackForFarm(farm = {}, saved = {}) {
  return allianceTag3(saved.alliance || farm.alliance || (regionAlliances.length === 1 ? regionAlliances[0].tag : ''));
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

function readRegionForm() {
  const extraSquads = readExtraSquads();
  const firstExtra = extraSquads[0] || {};
  const farm = getFarmById(profile || {}, selectedFarmId) || getGameProfile(profile || {});
  const alliance = allianceTag3($('#wrAlliance')?.value || allianceFallbackForFarm(farm, farm?.wastelandProfile || {}));
  if (!$('#wrAlliance')?.value && alliance) setAllianceInputValue(alliance);
  return {
    farmId: selectedFarmId || 'main',
    region: farm.region || '',
    nickname: $('#wrNickname')?.value,
    alliance,
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
    autoSubmitEnabled: Boolean($('#wrAutoFillProfile')?.checked)
  };
}

function setRegionForm(data = {}) {
  $('#wrNickname') && ($('#wrNickname').value = data.nickname || '');
  $('#wrAlliance') && ($('#wrAlliance').value = allianceTag3(data.alliance || ''));
  syncAllianceSelect(data.alliance || '');
  $('#wrAutoFillProfile') && ($('#wrAutoFillProfile').checked = Boolean(data.autoSubmitEnabled));
  $('#wrTroopType') && ($('#wrTroopType').value = data.troopType || '');
  $('#wrTier') && ($('#wrTier').value = data.tier || 'T10');
  $('#wrLairLevel') && ($('#wrLairLevel').value = data.lairLevel || data.lair || '');
  $('#wrMarch') && ($('#wrMarch').value = data.marchSize || '');
  $('#wrRally') && ($('#wrRally').value = data.rallySize || '');
  $('#wrReadyAttack') && ($('#wrReadyAttack').checked = boolValue(data.readyToAttack));
  $('#wrCaptain') && ($('#wrCaptain').checked = boolValue(data.captainReady));
  const shift = normalizeShiftForAvailable(data.shift || 'shift1');
  const shiftInput = $(`input[name="wrShift"][value="${shift}"]`);
  if (shiftInput) shiftInput.checked = true;
  $('#wrComment') && ($('#wrComment').value = data.comment || '');
  const extraSquads = normalizeExtraSquads(data);
  const extraByType = Object.fromEntries(extraSquads.map(item => [item.troopType, item.tier]));
  $('#wrExtraEnabled') && ($('#wrExtraEnabled').checked = Boolean(extraSquads.length));
  fillExtraTierSelects(extraByType);
  document.querySelectorAll('[data-extra-troop]').forEach(input => {
    input.checked = Boolean(extraByType[input.dataset.extraTroop]);
  });
  toggleExtraFields();
}

async function fillSelectedFarm() {
  const farm = getFarmById(profile || {}, selectedFarmId) || getGameProfile(profile || {});
  await loadShiftSettingsForFarm(farm);
  await loadAlliancesForFarm(farm);
  const saved = farm.wastelandProfile || {};
  renderShiftOptions(normalizeShiftForAvailable(saved.shift || 'shift1'));
  setRegionForm({
    ...saved,
    nickname: saved.nickname || farm.nickname || '',
    alliance: allianceFallbackForFarm(farm, saved)
  });
  $('#regionNumberPill') && ($('#regionNumberPill').textContent = farm.region ? `R${farm.region}` : 'R—');
  if (!profileStatusLocked()) {
    refreshProfileStatusText();
  }
}

function refreshProfileStatusText() {
  if (profileStatusLocked()) return;
  const farm = getFarmById(profile || {}, selectedFarmId) || getGameProfile(profile || {});
  const saved = farm?.wastelandProfile || {};
  const status = getRegionFormStatus(currentRegionSettings || {});
  if (!farm?.region) {
    setStatusKey('profile.regionRequiredFirst', 'First set the region for this player in the “Profile” tab.', 'warn');
  } else if (saved.autoSubmitEnabled && status.open) {
    setStatusKey('region.autoProfileReadyOpen', 'Auto-fill is enabled. Registration is open — the request will be sent automatically.', 'muted');
  } else if (saved.autoSubmitEnabled) {
    setStatusKey('region.autoProfileReadyClosed', 'Auto-fill is enabled, but registration is closed now. The request was not sent.', 'warn');
  } else {
    setStatusKey('profile.regionFormFillHelp', 'Fill in Wasteland data and press “Save as template”. Nothing is sent to Wasteland here.', 'muted');
  }
}

function renderFarmSelect() {
  const select = $('#wrSavedFarmSelect');
  const tools = $('#regionProfileTools');
  if (!select || !tools) return;
  const farms = farmsFromProfile(profile || {});
  tools.hidden = false;
  select.innerHTML = farms.map((farm, index) => `<option value="${farm.farmId || farm.id || 'main'}">${farmLabel(farm, index)}</option>`).join('');
  if (!getFarmById(profile || {}, selectedFarmId)) selectedFarmId = farms[0]?.farmId || 'main';
  select.value = selectedFarmId;
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

function prepareProfileForm() {
  $('#regionCountdownBox') && ($('#regionCountdownBox').hidden = true);
  $('#wrRegionSelectWrap') && ($('#wrRegionSelectWrap').hidden = true);
  renderProfileRegionChrome();
  renderTroopOptions();
  fillTierSelect($('#wrTier'), 'T10');
  fillExtraTierSelects({});
  renderShiftOptions('shift1');
  $('#wastelandForm') && ($('#wastelandForm').hidden = false);
}

function renderProfileRegionChrome() {
  $('#regionFormState') && ($('#regionFormState').textContent = t('profile.savingToProfile', 'Saving to profile'));
  $('#regionFormState')?.classList.add('region-pill--open');
  $('#regionFormTitleText') && ($('#regionFormTitleText').textContent = t('profile.regionFormDataTitle', 'Region form data'));
  $('#regionFormDescText') && ($('#regionFormDescText').textContent = t('profile.regionFormDataHelp', 'This data is saved in the selected player or farm profile. Then press “Fill from profile” in the linked form.'));
  $('#openRegionTableBtn') && ($('#openRegionTableBtn').textContent = t('profile.openThisRegionForm', 'Open this region form'));
  const fillProfileBtn = $('#wrFillFromProfileBtn');
  if (fillProfileBtn) {
    fillProfileBtn.hidden = true;
    fillProfileBtn.disabled = true;
  }
  $('#saveWastelandDraftBtn') && ($('#saveWastelandDraftBtn').textContent = t('regionForm.submit', 'Відправити заявку'));
  $('#resetWastelandFormBtn') && ($('#resetWastelandFormBtn').textContent = t('profile.clearFormData', 'Очистити форму'));
  const submit = $('#wastelandForm button[type="submit"]');
  if (submit) submit.textContent = t('profile.saveFormData', 'Зберегти як шаблон');
}


function profileD1ErrorCode(error) {
  return String(error?.data?.error || error?.message || '').trim();
}

function duplicateRequestMessage() {
  return t('region.errorNicknameDuplicateGuestMessage', 'Заявка з таким нікнеймом уже є в активному циклі. Повторно такий самий нік не відправляється.');
}

function autoProfileTierMismatchMessage(values = {}, settings = currentRegionSettings || {}) {
  return tv('region.autoProfileTierMismatch', 'Auto registration was not sent: the profile has {profileTier}, but the form minimum is now {minTier}. Check the data manually.', autoProfileTierMismatchVars(values, settings));
}

function autoProfileTierMismatchVars(values = {}, settings = currentRegionSettings || {}) {
  return {
    profileTier: String(values.tier || '').trim().toUpperCase() || '—',
    minTier: settings?.minTier || 'T10'
  };
}

function autoSubmitMarkerData(values = {}, farm = {}, settings = {}) {
  return {
    region: farm?.region || values.region || '',
    cycleId: settings?.currentCycleId || values.cycleId || 'active',
    farmId: selectedFarmId || values.farmId || 'main',
    nickname: values.nickname || '',
    uid: currentUser?.uid || '',
    hash: autoSubmitSignature(values)
  };
}

function showAutoSubmitMarkerStatus(marker = null) {
  const status = String(marker?.status || 'submitted');
  if (status === 'duplicate') {
    setStickyStatus(duplicateRequestMessage(), 'warn');
    return;
  }
  if (status === 'alreadyExists') {
    setStickyStatus(t('region.requestAlreadySavedShort', 'Заявка для цього гравця вже є в активному циклі. Повторно запис не створюється.'), 'success');
    return;
  }
  setStickyStatus(t('region.autoSubmittedCached', 'Автоматична заявка вже відправлена для цього циклу. Повторна перевірка D1 не виконувалась.'), 'success');
}

function validateProfileRegionData(values = {}, farm = {}) {
  const errors = [];
  if (!String(values.nickname || '').trim()) errors.push(t('region.errorNickname', 'Введи нікнейм.'));
  if (!String(values.alliance || '').trim()) errors.push(t('region.errorAlliance', 'Введи альянс.'));
  if (!String(values.troopType || '').trim()) errors.push(t('region.errorMainTroop', 'Вибери основний тип військ.'));
  if (!String(values.shift || '').trim()) errors.push(t('region.errorShift', 'Вибери зміну.'));
  if (!farm?.region) errors.push(t('profile.saveProfileRegionFirst', 'Спочатку збережи регіон у вкладці “Профіль”.'));
  return errors;
}

async function syncServerAutoSubmitTemplate(values = {}, farm = {}, options = {}) {
  if (!currentUser || !farm?.region || !isRegionTableCacheEnabled?.()) return { skipped: true };
  try {
    return await syncAutoSubmitTemplateD1IfNeeded(currentUser, farm.region, {
      ...values,
      region: farm.region,
      farmId: selectedFarmId || values.farmId || 'main'
    }, {
      farmId: selectedFarmId || values.farmId || 'main',
      enabled: values.autoSubmitEnabled !== false,
      force: Boolean(options.force)
    });
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] auto-submit template D1 sync skipped:', error);
    return { ok: false, skipped: true, error: profileD1ErrorCode(error) || error?.message || String(error) };
  }
}

async function autoSubmitProfileRegionData(values = {}, farm = {}, options = {}) {
  if (!values.autoSubmitEnabled || !farm?.region) return { skipped: true };
  if (autoSubmitInProgress) return { skipped: true, busy: true };
  if (!isRegionTableCacheEnabled?.()) throw new Error('region-table-cache-disabled');

  let settings = currentRegionSettings || {};
  let markerData = autoSubmitMarkerData(values, farm, settings);
  let marker = readAutoSubmitMarker(markerData);
  if (autoSubmitMarkerMatches(marker, markerData.hash)) {
    showAutoSubmitMarkerStatus(marker);
    return { skipped: true, cached: true, alreadyTried: true, marker };
  }

  currentRegionSettings = await loadLatestRegionSettingsForProfile(farm.region, { force: true }) || currentRegionSettings;
  settings = currentRegionSettings || {};
  const status = getRegionFormStatus(settings);
  if (!status.open) {
    setStickyStatus(t('region.autoProfileSavedClosed', 'Автозаповнення збережено. Форма зараз закрита, тому заявка НЕ відправлена.'), 'warn');
    return { skipped: true, closed: true };
  }
  const errors = validateProfileRegionData(values, farm);
  if (errors.length) {
    setStickyStatus(errors.join(' '), 'error');
    return { skipped: true, invalid: true };
  }

  markerData = autoSubmitMarkerData(values, farm, settings);
  marker = readAutoSubmitMarker(markerData);
  if (autoSubmitMarkerMatches(marker, markerData.hash)) {
    showAutoSubmitMarkerStatus(marker);
    return { skipped: true, cached: true, alreadyTried: true, marker };
  }

  autoSubmitInProgress = true;
  try {
    setStatus(t('region.autoSubmitting', 'Автоматично відправляю заявку з профілю...'), 'muted');
    const result = await saveRegionRegistrationD1First(currentUser, farm.region, {
      ...values,
      region: farm.region,
      farmId: selectedFarmId || 'main',
      publicLink: false
    }, settings, { forceUpdate: false });
    if (result?.existing && (result?.unchanged || result?.notWritten)) {
      writeAutoSubmitMarker({ ...markerData, status: 'alreadyExists', messageKey: 'region.requestAlreadySavedShort' });
      setStickyStatus(t('region.requestAlreadySavedShort', 'Заявка для цього гравця вже є в активному циклі. Повторно запис не створюється.'), 'success');
      return { ...result, alreadyExists: true };
    }
    writeAutoSubmitMarker({ ...markerData, status: 'submitted', messageKey: 'region.autoSubmittedCached' });
    setStickyStatus(t('region.autoSubmitted', 'Автоматична заявка з профілю відправлена.'), 'success');
    return result;
  } catch (error) {
    const code = profileD1ErrorCode(error);
    if (code === 'registration-nickname-duplicate-region') {
      writeAutoSubmitMarker({ ...markerData, status: 'duplicate', messageKey: 'region.errorNicknameDuplicateGuestMessage' });
      setStickyStatus(duplicateRequestMessage(), 'warn');
      return { skipped: true, duplicate: true };
    }
    if (code === 'registration-invalid-tier') {
      setStickyStatusKey('region.autoProfileTierMismatch', 'Auto registration was not sent: the profile has {profileTier}, but the form minimum is now {minTier}. Check the data manually.', 'warn', autoProfileTierMismatchVars(values, settings));
      return { skipped: true, invalid: true, invalidTier: true };
    }
    throw error;
  } finally {
    autoSubmitInProgress = false;
  }
}

async function autoSubmitSavedTemplateIfEnabled(reason = 'load') {
  if (!currentUser || !profile) return false;
  const farm = getFarmById(profile || {}, selectedFarmId) || getGameProfile(profile || {});
  const saved = farm?.wastelandProfile || {};
  if (!saved.autoSubmitEnabled || !farm?.region) return false;
  const values = readRegionForm();
  await syncServerAutoSubmitTemplate(values, farm, { force: false });
  const result = await autoSubmitProfileRegionData(values, farm, { reason });
  return !result?.skipped || Boolean(result?.alreadyExists || result?.duplicate);
}

async function saveProfileRegionData(event) {
  event.preventDefault();
  if (!currentUser) {
    setStatus(t('profile.needGoogle', 'You need to sign in with Google.'), 'error');
    return;
  }
  const farm = getFarmById(profile || {}, selectedFarmId);
  const values = readRegionForm();
  const errors = validateProfileRegionData(values, farm);
  if (errors.length) {
    setStatus(errors.join(' '), 'error');
    return;
  }
  try {
    setStatus(t('profile.savingFormData', 'Зберігаю шаблон у профіль...'), 'muted');
    profile = await saveFarmWastelandProfile(currentUser, selectedFarmId, values);
    renderFarmSelect();
    await fillSelectedFarm();
    document.dispatchEvent(new CustomEvent('wkd:profile-updated', { detail: { profile } }));
    await syncServerAutoSubmitTemplate(values, farm, { force: true });
    if (values.autoSubmitEnabled) {
      const result = await autoSubmitProfileRegionData(values, farm, { reason: 'save' });
      if (result?.invalidTier) {
        setStickyStatusKey('profile.formDataSavedAutoTierMismatch', 'The form template was saved to the profile. Auto registration was not sent: the profile has {profileTier}, but the form minimum is now {minTier}. Check the data manually.', 'warn', autoProfileTierMismatchVars(values, currentRegionSettings));
        return;
      }
      if (result?.invalid) return;
      if (!result?.closed && !result?.invalid) return;
      if (result?.closed) {
        setStickyStatus(t('region.autoTemplateSavedForNextOpen', 'Шаблон збережено. Коли форму відкриють, Worker автоматично додасть заявку без входу гравця на сайт.'), 'success');
        return;
      }
    }
    setStickyStatus(t('profile.formDataSaved', 'Шаблон форми збережено в профілі. На Пустош нічого не відправлено.'), 'success');
  } catch (error) {
    console.error(error);
    const code = profileD1ErrorCode(error);
    if (code === 'registration-nickname-duplicate-region') {
      setStickyStatus(duplicateRequestMessage(), 'warn');
      return;
    }
    const details = code ? ` (${code})` : '';
    setStickyStatus(`${t('profile.formDataSaveFailed', 'Не вдалося зберегти шаблон. Перевір права доступу або Google-вхід.')}${details}`, 'error');
  }
}

function openRegionForm() {
  const farm = getFarmById(profile || {}, selectedFarmId);
  if (!farm?.region) {
    setStatus(t('profile.selectedNoRegion', 'Selected player has no region.'), 'error');
    return;
  }
  const url = new URL('region-form.html', window.location.href);
  url.searchParams.set('r', farm.region);
  url.searchParams.set('farm', selectedFarmId || 'main');
  window.location.href = url.toString();
}


function handleLanguageChange() {
  renderProfileRegionChrome();
  const selectedTroop = $('#wrTroopType')?.value || '';
  const selectedShift = $('input[name="wrShift"]:checked')?.value || 'shift1';
  const extraEnabled = Boolean($('#wrExtraEnabled')?.checked);
  const extraSquads = readExtraSquads();
  const extraByType = Object.fromEntries(extraSquads.map(item => [item.troopType, item.tier]));
  renderTroopOptions();
  if (selectedTroop) $('#wrTroopType') && ($('#wrTroopType').value = selectedTroop);
  renderShiftOptions(normalizeShiftForAvailable(selectedShift));
  $('#wrExtraEnabled') && ($('#wrExtraEnabled').checked = extraEnabled);
  fillExtraTierSelects(extraByType);
  document.querySelectorAll('[data-extra-troop]').forEach(input => {
    input.checked = Boolean(extraByType[input.dataset.extraTroop]);
  });
  toggleExtraFields();
  if (profileRegionStatusI18n && profileStatusLocked()) {
    setStatus(translateStatusEntry(profileRegionStatusI18n), profileRegionStatusI18n.type || 'muted', profileRegionStatusI18n);
  } else {
    refreshProfileStatusText();
  }
}

function bind() {
  $('#wastelandForm')?.addEventListener('submit', saveProfileRegionData);
  document.addEventListener('change', event => {
    if (event.target?.matches?.('#wrExtraEnabled, [data-extra-troop]')) toggleExtraFields();
  });
  $('#wrSavedFarmSelect')?.addEventListener('change', event => {
    selectedFarmId = event.currentTarget.value || 'main';
    fillSelectedFarm().catch(error => { console.warn('[WKD] profile farm form refresh failed:', error); });
  });
  $('#wrAllianceSelect')?.addEventListener('change', event => setAllianceInputValue(event.currentTarget.value));
  $('#wrAlliance')?.addEventListener('input', event => syncAllianceSelect(event.currentTarget.value));
  $('#wrAutoFillProfile')?.addEventListener('change', event => {
    const enabled = Boolean(event.currentTarget.checked);
    const farm = getFarmById(profile || {}, selectedFarmId);
    const values = readRegionForm();
    if (!enabled) {
      saveFarmWastelandProfile(currentUser, selectedFarmId, values)
        .then(saved => { profile = saved; return syncServerAutoSubmitTemplate({ ...values, autoSubmitEnabled: false }, farm, { force: true }); })
        .then(() => setStickyStatus(t('region.autoProfileOff', 'Автозаповнення з профілю вимкнено для цього гравця.'), 'muted'))
        .catch(error => { console.warn('[WKD] auto profile off save failed:', error); });
      return;
    }
    const errors = validateProfileRegionData(values, farm);
    if (errors.length) { setStatus(errors.join(' '), 'error'); return; }
    saveFarmWastelandProfile(currentUser, selectedFarmId, values)
      .then(saved => { profile = saved; return syncServerAutoSubmitTemplate(values, farm, { force: true }); })
      .then(() => autoSubmitProfileRegionData(values, farm, { reason: 'toggle' }))
      .catch(error => {
        console.error(error);
        const code = profileD1ErrorCode(error);
        if (code === 'registration-nickname-duplicate-region') {
          setStickyStatus(duplicateRequestMessage(), 'warn');
          return;
        }
        setStickyStatus(`${t('profile.formDataSaveFailed', 'Не вдалося зберегти шаблон. Перевір права доступу або Google-вхід.')}${code ? ` (${code})` : ''}`, 'error');
      });
  });
  $('#wrFillFromProfileBtn')?.addEventListener('click', () => fillSelectedFarm().catch(error => { console.warn('[WKD] profile fill failed:', error); }));
  $('#saveWastelandDraftBtn')?.addEventListener('click', openRegionForm);
  $('#resetWastelandFormBtn')?.addEventListener('click', () => setRegionForm({ nickname: $('#wrNickname')?.value, alliance: $('#wrAlliance')?.value }));
  $('#openRegionTableBtn')?.addEventListener('click', openRegionForm);
  document.addEventListener('wkd:language-changed', handleLanguageChange);
}

async function load(user) {
  if (!user) {
    setStatus(t('profile.needGoogle', 'You need to sign in with Google.'), 'warn');
    return;
  }
  currentUser = user;
  await saveSignedInUser(user).catch(() => null);
  profile = await getUserProfile(user.uid).catch(() => null);
  selectedFarmId = profile?.activeFarmId || 'main';
  prepareProfileForm();
  renderFarmSelect();
  await fillSelectedFarm();
  autoSubmitSavedTemplateIfEnabled('load').catch(error => {
    console.error(error);
    const code = profileD1ErrorCode(error);
    if (code === 'registration-nickname-duplicate-region') setStickyStatus(duplicateRequestMessage(), 'warn');
    else setStickyStatus(`${t('profile.formDataSaveFailed', 'Не вдалося зберегти шаблон. Перевір права доступу або Google-вхід.')}${code ? ` (${code})` : ''}`, 'error');
  });
}

async function init() {
  if (ready || !$('#wastelandForm')) return;
  ready = true;
  prepareProfileForm();
  bind();
  document.addEventListener('wkd:profile-updated', event => {
    if (event.detail?.profile) {
      profile = event.detail.profile;
      renderFarmSelect();
      fillSelectedFarm().catch(error => { console.warn('[WKD] profile farm form refresh failed:', error); });
    }
  });
  await watchAuth(user => load(user).catch(error => {
    console.error(error);
    setStatus('Не вдалося прочитати профіль.', 'error');
  }));
}

document.addEventListener('wkd:partials-ready', init);
document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
