import { watchAuth } from '../services/firebase-service.js';
import {
  getFarmById,
  getGameProfile,
  getUserFarms,
  getUserProfile,
  saveFarmWastelandProfile,
  saveSignedInUser
} from '../services/user-db.js';
import { getRegionSettings } from '../services/region-db.js?v=206';

const $ = selector => document.querySelector(selector);
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const tv = (key, fallback = '', vars = {}) => {
  let text = t(key, fallback);
  Object.entries(vars).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
  return text;
};
const tiers = Array.from({ length: 14 }, (_, i) => `T${14 - i}`);
const allShifts = ['shift1', 'shift2', 'shift3', 'shift4', 'both'];
let availableShifts = ['shift1', 'shift2'];
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
let ready = false;

function setStatus(text, type = 'muted') {
  const box = $('#regionStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
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
  return {
    nickname: $('#wrNickname')?.value,
    alliance: $('#wrAlliance')?.value,
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
    extraTier: firstExtra.tier || ''
  };
}

function setRegionForm(data = {}) {
  $('#wrNickname') && ($('#wrNickname').value = data.nickname || '');
  $('#wrAlliance') && ($('#wrAlliance').value = data.alliance || '');
  $('#wrTroopType') && ($('#wrTroopType').value = data.troopType || '');
  $('#wrTier') && ($('#wrTier').value = data.tier || 'T10');
  $('#wrLairLevel') && ($('#wrLairLevel').value = data.lairLevel || data.lair || '');
  $('#wrMarch') && ($('#wrMarch').value = data.marchSize || '');
  $('#wrRally') && ($('#wrRally').value = data.rallySize || '');
  $('#wrReadyAttack') && ($('#wrReadyAttack').checked = Boolean(data.readyToAttack));
  $('#wrCaptain') && ($('#wrCaptain').checked = Boolean(data.captainReady));
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
  const saved = farm.wastelandProfile || {};
  renderShiftOptions(normalizeShiftForAvailable(saved.shift || 'shift1'));
  setRegionForm({
    ...saved,
    nickname: farm.nickname || '',
    alliance: farm.alliance || saved.alliance || ''
  });
  $('#regionNumberPill') && ($('#regionNumberPill').textContent = farm.region ? `R${farm.region}` : 'R—');
  setStatus(farm.region
    ? t('profile.regionFormFillHelp', 'Fill in Wasteland data and press “Save form data”. Nothing is sent to Wasteland here.')
    : t('profile.regionRequiredFirst', 'First set the region for this player in the “Profile” tab.'), farm.region ? 'muted' : 'warn');
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
  $('#regionFormState') && ($('#regionFormState').textContent = t('profile.savingToProfile', 'Saving to profile'));
  $('#regionFormState')?.classList.add('region-pill--open');
  $('#regionFormTitleText') && ($('#regionFormTitleText').textContent = t('profile.regionFormDataTitle', 'Region form data'));
  $('#regionFormDescText') && ($('#regionFormDescText').textContent = t('profile.regionFormDataHelp', 'This data is saved in the selected player or farm profile. Then press “Fill from profile” in the linked form.'));
  $('#openRegionTableBtn') && ($('#openRegionTableBtn').textContent = t('profile.openThisRegionForm', 'Open this region form'));
  $('#wrFillFromProfileBtn') && ($('#wrFillFromProfileBtn').textContent = t('profile.fillFromProfile', 'Fill from profile'));
  $('#resetWastelandFormBtn') && ($('#resetWastelandFormBtn').textContent = t('profile.clearFormData', 'Clear form data'));
  const submit = $('#wastelandForm button[type="submit"]');
  if (submit) submit.textContent = t('profile.saveFormData', 'Save form data');
  renderTroopOptions();
  fillTierSelect($('#wrTier'), 'T10');
  fillExtraTierSelects({});
  renderShiftOptions('shift1');
  $('#wastelandForm') && ($('#wastelandForm').hidden = false);
}

async function saveProfileRegionData(event) {
  event.preventDefault();
  if (!currentUser) {
    setStatus(t('profile.needGoogle', 'You need to sign in with Google.'), 'error');
    return;
  }
  const farm = getFarmById(profile || {}, selectedFarmId);
  if (!farm?.region) {
    setStatus(t('profile.saveProfileRegionFirst', 'First save the region in the “Profile” tab.'), 'error');
    return;
  }
  try {
    setStatus(t('profile.savingFormData', 'Saving form data to profile...'), 'muted');
    profile = await saveFarmWastelandProfile(currentUser, selectedFarmId, readRegionForm());
    renderFarmSelect();
    fillSelectedFarm().catch(error => { console.warn('[WKD] profile farm form refresh failed:', error); });
    document.dispatchEvent(new CustomEvent('wkd:profile-updated', { detail: { profile } }));
    setStatus(t('profile.formDataSaved', 'Form data saved to profile. Now it can be transferred into the request by link.'), 'success');
  } catch (error) {
    console.error(error);
    setStatus(t('profile.formDataSaveFailed', 'Could not save form data. Check access rights and Google sign-in.'), 'error');
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
  $('#wrFillFromProfileBtn')?.addEventListener('click', () => fillSelectedFarm().catch(error => { console.warn('[WKD] profile fill failed:', error); }));
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
