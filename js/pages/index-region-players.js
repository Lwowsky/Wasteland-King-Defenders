import { watchAuth } from '../services/firebase-service.js';
import { getGameProfile, getUserFarms, getUserProfile, isProfileComplete, normalizeUserRole } from '../services/user-db.js';
import { canDeleteRegionRegistration, canManageRegion, deleteRegionRegistrations, getManagedRegionOptions, getRegionTowerPlan, importLocalPlayersToRegion, listRegionCatalog, listRegionRegistrations, regionRegistrationToPlayer, saveRegionTowerPlan, updateRegionRegistration, listRegionAlliances } from '../services/region-db.js?v=146';

const REGION_SOURCE = 'regionForm';
const SOURCE_KEY = 'wkd.players.sourceMode';
const REGION_KEY = 'wkd.players.activeRegion';
const MODES = ['local', 'region'];

let currentUser = null;
let currentProfile = null;
let currentMode = normalizeMode(localStorage.getItem(SOURCE_KEY) || 'local');
let loadedRegionRows = [];
let loadedRegion = '';
let loadingRegion = false;
let loadedRegionAlliances = [];
let controllerReady = false;

const allianceTag3 = value => window.WKD?.allianceTag3 ? window.WKD.allianceTag3(value) : Array.from(String(value ?? '').trim().replace(/[\/\[\]#?]/g, '')).slice(0, 3).join('');
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const esc = value => String(value ?? '').replace(/[&<>'\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const tv = (key, fallback = '', vars = {}) => {
  let text = t(key, fallback);
  Object.entries(vars || {}).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, String(value));
  });
  return text;
};

function normalizeMode(mode) {
  return MODES.includes(mode) ? mode : 'local';
}

function sourcePanel() {
  return $('#playersSourcePanel');
}

function sourceButtons() {
  return $$('[data-source-mode]');
}

function noteBox() {
  return $('#indexModeNote');
}

function sourceHelp() {
  return $('#playersSourceHelp');
}

function localToRegionButton() {
  return $('#copyLocalToRegionBtn');
}

function regionToLocalButton() {
  return $('#copyRegionToLocalBtn');
}

function setSourcePanelVisible(visible) {
  const panel = sourcePanel();
  if (panel) panel.hidden = !visible;
}

function setNote(text, type = 'muted') {
  const box = noteBox();
  if (!box) return;
  box.textContent = text;
  box.dataset.type = type;
}

function setHelp(text) {
  const box = sourceHelp();
  if (box) box.textContent = text;
}

function saveMode(mode) {
  localStorage.setItem(SOURCE_KEY, normalizeMode(mode));
}


function mergePlayerValues(player = {}, values = {}) {
  return {
    ...player,
    name: String(values.name ?? player.name ?? '').trim(),
    alliance: allianceTag3(values.alliance ?? player.alliance),
    role: values.role || player.role || 'Shooter',
    tier: String(values.tier ?? player.tier ?? 'T10').trim().toUpperCase(),
    march: Number(values.march ?? player.march ?? 0) || 0,
    rally: Number(values.rally ?? player.rally ?? 0) || 0,
    captain: Boolean(values.captain ?? player.captain),
    captainReady: Boolean(values.captain ?? player.captain) ? t('common.yes', 'Yes') : t('common.no', 'No'),
    shift: values.shift || player.shift || 'both',
    lair: String(values.lair ?? player.lair ?? '').trim(),
    placement: values.placement || player.placement || t('tower.reserve', 'Reserve')
  };
}

function rowKey(player = {}) {
  return String(player._rowId || player.id || player.uid || '');
}

function getLocalPlayers() {
  try {
    const rows = JSON.parse(localStorage.getItem(WKD.storageKeys.players) || '[]');
    return Array.isArray(rows) ? rows.map(row => ({ ...row, source: row.source || 'excel' })) : [];
  } catch {
    return [];
  }
}

function canUseRegionSource() {
  return Boolean(currentUser && isProfileComplete(currentProfile));
}

function canMoveLocalToRegion() {
  const region = getGameProfile(currentProfile || {}).region;
  const role = normalizeUserRole(currentProfile?.role || 'player');
  return Boolean(currentUser && canUseRegionSource() && ['admin', 'moderator', 'consul', 'officer'].includes(role) && canManageRegion(currentProfile, region, currentUser));
}

function currentRegionLabel() {
  const region = loadedRegion || getGameProfile(currentProfile || {}).region;
  return region ? `R${region}` : t('region.ownRegion', 'your region');
}

function profileRegionOptions() {
  const items = [];
  const add = (region, label = '') => {
    const safe = String(region || '').replace(/[^0-9]/g, '');
    if (!safe || items.some(item => item.region === safe)) return;
    items.push({ region: safe, label: label || `R${safe}` });
  };
  const main = getGameProfile(currentProfile || {});
  add(main.region, main.nickname ? `R${String(main.region || '').replace(/[^0-9]/g, '')} · ${main.nickname}` : '');
  getUserFarms(currentProfile || {}).forEach(farm => {
    add(farm.region, farm.nickname ? `R${String(farm.region || '').replace(/[^0-9]/g, '')} · ${farm.nickname}` : '');
  });
  return items.sort((a, b) => Number(a.region) - Number(b.region) || a.region.localeCompare(b.region));
}

function activeProfileRegion() {
  const options = profileRegionOptions();
  const saved = String(localStorage.getItem(REGION_KEY) || '').replace(/[^0-9]/g, '');
  return options.some(item => item.region === saved) ? saved : (options[0]?.region || getGameProfile(currentProfile || {}).region || '');
}

function renderRegionSwitch() {
  const wrap = $('#playersRegionSwitch');
  const select = $('#playersRegionSelect');
  if (!wrap || !select) return;
  const options = profileRegionOptions();
  wrap.hidden = options.length <= 1;
  select.innerHTML = options.map(item => `<option value="${esc(item.region)}" ${item.region === loadedRegion ? 'selected' : ''}>${esc(item.label)}</option>`).join('');
  if (loadedRegion) select.value = loadedRegion;
}

async function refreshTowerRegionOptions() {
  window.WKD = window.WKD || {};
  const options = [{ id: 'home', label: t('tower.localMode', 'Локальний'), mode: 'local', region: '' }];
  if (currentUser && currentProfile && isProfileComplete(currentProfile)) {
    const role = normalizeUserRole(currentProfile?.role || 'player');
    let regions = [];
    if (currentUser.email === 'vovapotaychuk@gmail.com' || role === 'admin' || role === 'moderator') {
      const catalog = await listRegionCatalog({ includeInactive: false, skipPublicPlayers: true }).catch(error => {
        console.warn('[WKD] tower region catalog skipped:', error);
        return [];
      });
      regions = catalog.map(item => item.region).filter(Boolean);
      getManagedRegionOptions(currentProfile, currentUser).forEach(region => regions.push(region));
    } else {
      regions = getManagedRegionOptions(currentProfile, currentUser);
    }
    const ownRegion = String(getGameProfile(currentProfile || {}).region || '').trim();
    if (ownRegion) regions.push(ownRegion);
    [...new Set(regions.map(String).filter(Boolean))]
      .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
      .forEach(region => options.push({ id: `region:${region}`, label: `R${region}`, mode: 'region', region }));
  }
  window.WKD.towerPlannerRegionOptions = options;
  document.dispatchEvent(new CustomEvent('wkd:tower-region-options-updated', { detail: { options } }));
  return options;
}

function updateAllianceColorMap() {
  window.WKD = window.WKD || {};
  const map = {};
  loadedRegionAlliances.forEach(item => {
    const tag = String(item.tag || item.id || '').trim();
    const hue = Number(item.colorHue);
    if (tag && Number.isFinite(hue)) map[tag] = ((Math.round(hue) % 360) + 360) % 360;
  });
  window.WKD.regionAllianceColorMap = map;
  document.dispatchEvent(new CustomEvent('wkd:alliance-colors-updated', { detail: { source: 'index-region' } }));
}

function updateTransferButtons() {
  const localRows = getLocalPlayers();
  const localBtn = localToRegionButton();
  const regionBtn = regionToLocalButton();

  if (localBtn) {
    localBtn.hidden = !canUseRegionSource();
    localBtn.disabled = !canMoveLocalToRegion() || !localRows.length || loadingRegion;
    localBtn.title = !canMoveLocalToRegion()
      ? t('players.localToRegionAccess', 'Only the consul, officer, moderator, or admin of the current region can move the local list to the region.')
      : (!localRows.length ? t('players.importLocalFirst', 'Import Excel/CSV into the local list first.') : t('players.localToRegionTitle', 'Move the local list into the table of the current region.'));
  }

  if (regionBtn) {
    regionBtn.hidden = !canUseRegionSource();
    regionBtn.disabled = !canUseRegionSource() || loadingRegion;
    regionBtn.title = t('players.regionToLocalTitle', 'Save the table of your current region into the local list of this browser.');
  }
}

function updateTabs() {
  const regionAllowed = canUseRegionSource();
  if (!regionAllowed && currentMode !== 'local') currentMode = 'local';
  sourceButtons().forEach(button => {
    const mode = button.dataset.sourceMode;
    const active = mode === currentMode;
    const disabled = mode !== 'local' && !regionAllowed;
    button.classList.toggle('is-active', active);
    button.disabled = disabled;
    button.setAttribute('aria-selected', String(active));
    if (disabled) button.title = t('players.profileForRegionTitle', 'Fill in your profile and sign in with Google to see the region table.');
    else button.removeAttribute('title');
  });
  updateTransferButtons();
}

function renderCurrentRows() {
  if (!window.WKD?.setPlayers) return;
  const localRows = getLocalPlayers();
  const rows = currentMode === 'region' ? loadedRegionRows : localRows;

  WKD.setPlayers(rows, {
    persist: false,
    normalized: true,
    eventSource: `source-${currentMode}`,
    clearStorage: false
  });

  if (currentMode === 'region') {
    setNote(tv('players.regionShown', 'Region table {region}: shown {count} players.', { region: currentRegionLabel(), count: loadedRegionRows.length }), loadedRegionRows.length ? 'success' : 'warn');
    setHelp(t('players.regionActive', 'Region table is active.'));
    updateTransferButtons();
    return;
  }

  setNote(tv('players.localShown', 'Local list: shown {count}.', { count: localRows.length }), 'muted');
  setHelp(t('playerManager.localActive', 'Local list is active.'));
  updateTransferButtons();
}

async function loadRegionRows(force = false, regionOverride = '') {
  if (!canUseRegionSource() || loadingRegion) return;
  const requestedRegion = String(regionOverride || loadedRegion || getGameProfile(currentProfile || {}).region || '').trim();
  if (!force && loadedRegionRows.length && (!requestedRegion || requestedRegion === loadedRegion)) return;
  loadingRegion = true;
  updateTransferButtons();
  if (requestedRegion) loadedRegion = requestedRegion;
  setNote(tv('players.loadingRegionTable', 'Loading region table {region}...', { region: currentRegionLabel() }), 'muted');
  try {
    const result = await listRegionRegistrations(currentUser, requestedRegion);
    currentProfile = result.profile || currentProfile;
    loadedRegion = result.region || loadedRegion || requestedRegion;
    loadedRegionRows = result.rows.map(row => ({ ...regionRegistrationToPlayer(row), source: REGION_SOURCE }));
    loadedRegionAlliances = loadedRegion ? await listRegionAlliances(loadedRegion).catch(() => []) : [];
    updateAllianceColorMap();
  } catch (error) {
    console.error(error);
    loadedRegionRows = [];
    setNote(t('players.regionLoadFailed', 'Could not load the region table. Check the profile or region.'), 'warn');
  } finally {
    loadingRegion = false;
    updateTransferButtons();
  }
}

async function applyMode(mode, options = {}) {
  const nextMode = normalizeMode(mode);
  currentMode = canUseRegionSource() ? nextMode : 'local';
  if (options.persist !== false) saveMode(currentMode);
  updateTabs();
  if (currentMode === 'region') await loadRegionRows(Boolean(options.forceRegion), options.region || '');
  renderCurrentRows();
}

async function copyLocalToRegion() {
  const localRows = getLocalPlayers();
  if (!canMoveLocalToRegion()) {
    setNote(t('players.localToRegionAccess', 'Only the consul, officer, moderator, or admin of the current region can move the local list to the region.'), 'warn');
    return;
  }
  if (!localRows.length) {
    setNote(t('players.noLocalToMove', 'No local players to move. Import Excel/CSV first.'), 'warn');
    return;
  }
  try {
    setNote(tv('players.movingToRegion', 'Moving {count} players into {region}...', { count: localRows.length, region: currentRegionLabel() }), 'muted');
    const result = await importLocalPlayersToRegion(currentUser, localRows);
    const region = result.region || loadedRegion || getGameProfile(currentProfile || {}).region;
    await saveRegionTowerPlan(currentUser, region, { version: 1, updatedAtMs: Date.now(), regions: { home: {}, region2: {}, region3: {} } }).catch(error => console.warn('tower plan reset skipped', error));
    document.dispatchEvent(new CustomEvent('wkd:tower-plan-hard-reset', { detail: { source: 'local-to-region' } }));
    loadedRegionRows = [];
    await applyMode('region', { forceRegion: true });
    setNote(tv('players.regionReplaced', 'Region table R{region} replaced: added {count} players, previous cycle is hidden/cleared.', { region: result.region, count: result.count }), 'success');
  } catch (error) {
    console.error(error);
    setNote(t('players.localToRegionFailed', 'Could not move the local list to the region. Check access rights or region.'), 'warn');
  }
}

async function copyRegionToLocal() {
  if (!canUseRegionSource()) {
    setNote(t('players.signInProfileFirst', 'Спочатку увійди через Google і заповни профіль з регіоном.'), 'warn');
    return;
  }
  await loadRegionRows(true);
  WKD.setPlayers(loadedRegionRows, {
    persist: true,
    normalized: true,
    eventSource: 'region-to-local'
  });
  await applyMode('local');
  setNote(tv('players.regionSavedLocal', 'Table {region} saved into the local list of this browser.', { region: currentRegionLabel() }), 'success');
}

function removeRowsFromState(ids = []) {
  const wanted = new Set(ids.map(String));
  const before = WKD.state.players.length;
  WKD.state.players = WKD.state.players.filter(player => !wanted.has(String(player._rowId || player.id || '')));
  return before - WKD.state.players.length;
}

async function deletePlayersFromActiveSource(ids = []) {
  const wanted = [...new Set((Array.isArray(ids) ? ids : [ids]).map(id => String(id || '')).filter(Boolean))];
  if (!wanted.length) return { handled: true, removed: 0 };

  if (currentMode !== 'region') {
    const removed = removeRowsFromState(wanted);
    WKD.saveJson?.(WKD.storageKeys.players, WKD.state.players);
    WKD.renderPlayers?.();
    document.dispatchEvent(new CustomEvent('wkd:players-updated', { detail: { source: 'duplicates-delete-local', persist: true } }));
    return { handled: true, removed };
  }

  if (!canDeleteRegionRegistration(currentProfile, loadedRegion || getGameProfile(currentProfile || {}).region, currentUser)) {
    throw new Error('region-delete-access-denied');
  }

  const stateRows = WKD.state.players.filter(player => wanted.includes(String(player._rowId || player.id || '')));
  const dbIds = stateRows.map(player => String(player.regionRegistrationId || '')).filter(Boolean);
  if (stateRows.length !== dbIds.length) throw new Error('region-delete-registration-only');

  await deleteRegionRegistrations(currentUser, loadedRegion || getGameProfile(currentProfile || {}).region, dbIds);
  loadedRegionRows = loadedRegionRows.filter(player => !wanted.includes(String(player._rowId || player.id || '')));
  const removed = removeRowsFromState(wanted);
  WKD.renderPlayers?.();
  document.dispatchEvent(new CustomEvent('wkd:players-updated', { detail: { source: 'duplicates-delete-region', persist: false } }));
  setNote(tv('players.deletedFromRegion', 'Deleted {count} records from {region}.', { count: removed, region: currentRegionLabel() }), 'success');
  return { handled: true, removed };
}


async function updatePlayerInActiveSource(id, values = {}) {
  const wanted = String(id || '');
  if (!wanted) return { handled: true, updated: false };

  if (currentMode !== 'region') {
    const index = WKD.state.players.findIndex(player => rowKey(player) === wanted);
    if (index < 0) return { handled: true, updated: false };
    WKD.state.players[index] = mergePlayerValues(WKD.state.players[index], values);
    WKD.saveJson?.(WKD.storageKeys.players, WKD.state.players);
    WKD.renderPlayers?.();
    document.dispatchEvent(new CustomEvent('wkd:players-updated', { detail: { source: 'player-edit-local', persist: true } }));
    return { handled: true, updated: true, player: WKD.state.players[index] };
  }

  const stateRow = WKD.state.players.find(player => rowKey(player) === wanted);
  if (!stateRow?.regionRegistrationId) throw new Error('region-update-registration-only');
  if (!canManageRegion(currentProfile, loadedRegion || getGameProfile(currentProfile || {}).region, currentUser)) {
    throw new Error('region-update-access-denied');
  }

  const result = await updateRegionRegistration(currentUser, loadedRegion || getGameProfile(currentProfile || {}).region, stateRow.regionRegistrationId, values);
  const merged = mergePlayerValues(stateRow, values);
  loadedRegionRows = loadedRegionRows.map(player => rowKey(player) === wanted ? mergePlayerValues(player, values) : player);
  WKD.state.players = WKD.state.players.map(player => rowKey(player) === wanted ? merged : player);
  WKD.renderPlayers?.();
  document.dispatchEvent(new CustomEvent('wkd:players-updated', { detail: { source: 'player-edit-region', persist: false } }));
  setNote(tv('players.updatedInRegion', 'Updated “{name}” in {region}.', { name: merged.name, region: currentRegionLabel() }), 'success');
  return { handled: true, updated: true, player: merged, result };
}


async function loadTowerPlanFromActiveSource() {
  if (currentMode !== 'region') return { handled: false, plan: null };
  if (!currentUser) throw new Error('auth-required');
  const region = loadedRegion || getGameProfile(currentProfile || {}).region;
  const result = await getRegionTowerPlan(currentUser, region);
  currentProfile = result.profile || currentProfile;
  loadedRegion = result.region || loadedRegion;
  return { handled: true, ...result };
}

async function saveTowerPlanToActiveSource(plan = {}) {
  if (currentMode !== 'region') return { handled: false };
  if (!currentUser) throw new Error('auth-required');
  const region = loadedRegion || getGameProfile(currentProfile || {}).region;
  if (!canManageRegion(currentProfile, region, currentUser)) throw new Error('region-plan-access-denied');
  const result = await saveRegionTowerPlan(currentUser, region, plan);
  setNote(tv('players.towerPlanSaved', 'Turret plan saved in {region}.', { region: currentRegionLabel() }), 'success');
  return { handled: true, ...result };
}

function getPlayersSourceInfo() {
  const region = loadedRegion || getGameProfile(currentProfile || {}).region;
  return {
    mode: currentMode,
    region,
    label: currentMode === 'region' ? currentRegionLabel() : t('playerManager.localList', 'local list'),
    canUpdate: currentMode !== 'region' || canManageRegion(currentProfile, region, currentUser),
    canDelete: currentMode !== 'region' || canDeleteRegionRegistration(currentProfile, region, currentUser),
    canPlan: currentMode !== 'region' || canManageRegion(currentProfile, region, currentUser),
    canViewRegion: canUseRegionSource()
  };
}

async function setTowerPlannerSource(options = {}) {
  const mode = normalizeMode(options.mode || 'local');
  if (mode !== 'region') {
    await applyMode('local', { persist: true });
    return getPlayersSourceInfo();
  }
  const region = String(options.region || loadedRegion || getGameProfile(currentProfile || {}).region || '').trim();
  if (region) {
    loadedRegion = region;
    loadedRegionRows = [];
    loadedRegionAlliances = [];
  }
  await applyMode('region', { forceRegion: true, persist: true, region });
  return getPlayersSourceInfo();
}

function bindTabs() {
  sourceButtons().forEach(button => {
    button.addEventListener('click', () => applyMode(button.dataset.sourceMode || 'local'));
  });
  localToRegionButton()?.addEventListener('click', copyLocalToRegion);
  regionToLocalButton()?.addEventListener('click', copyRegionToLocal);
  $('#playersRegionSelect')?.addEventListener('change', event => {
    loadedRegion = String(event.currentTarget.value || '').replace(/[^0-9]/g, '');
    if (loadedRegion) localStorage.setItem(REGION_KEY, loadedRegion);
    applyMode('region', { forceRegion: true, persist: true, region: loadedRegion });
  });
}

async function handleAuth(user) {
  currentUser = user;
  currentProfile = user ? await getUserProfile(user.uid).catch(() => null) : null;
  loadedRegionRows = [];
  loadedRegion = '';
  currentMode = normalizeMode(localStorage.getItem(SOURCE_KEY) || currentMode || 'region');
  updateTabs();

  if (!user) {
    setSourcePanelVisible(false);
    currentMode = 'local';
    await refreshTowerRegionOptions();
    setNote(t('players.guestLocalMode', 'Guest mode: the list is saved on this device.'), 'muted');
    renderCurrentRows();
    return;
  }

  if (!isProfileComplete(currentProfile)) {
    setSourcePanelVisible(false);
    currentMode = 'local';
    await refreshTowerRegionOptions();
    setNote(t('players.accountNeedsProfile', 'Акаунт підключено: заповни профіль, щоб відкрити таблицю свого регіону.'), 'warn');
    renderCurrentRows();
    return;
  }

  loadedRegion = activeProfileRegion();
  if (loadedRegion) localStorage.setItem(REGION_KEY, loadedRegion);
  currentMode = 'region';
  saveMode(currentMode);
  setSourcePanelVisible(true);
  renderRegionSwitch();
  const role = normalizeUserRole(currentProfile?.role || 'player');
  const roleText = role === 'admin' || role === 'moderator'
    ? t('players.adminRegionHelp', 'You can open the table page and switch regions.')
    : tv('players.regionAvailableHelp', 'Your region table {region} is available.', { region: currentRegionLabel() });
  await refreshTowerRegionOptions();
  renderRegionSwitch();
  setHelp(`${t('players.chooseSourceHelp', 'Choose local list or region table.')} ${roleText}`);
  await applyMode(currentMode, { persist: false });
}

async function init() {
  if (controllerReady || !$('#playersSourcePanel')) return;
  controllerReady = true;
  setSourcePanelVisible(false);
  bindTabs();
  updateTabs();
  renderCurrentRows();

  window.WKD.setPlayersSourceMode = (mode, options = {}) => applyMode(mode, options);
  window.WKD.deletePlayersFromActiveSource = deletePlayersFromActiveSource;
  window.WKD.updatePlayerInActiveSource = updatePlayerInActiveSource;
  window.WKD.getPlayersSourceInfo = getPlayersSourceInfo;
  window.WKD.loadTowerPlanFromActiveSource = loadTowerPlanFromActiveSource;
  window.WKD.saveTowerPlanToActiveSource = saveTowerPlanToActiveSource;
  window.WKD.setTowerPlannerSource = setTowerPlannerSource;
  window.WKD.refreshTowerRegionOptions = refreshTowerRegionOptions;

  document.addEventListener('wkd:source-mode-request', event => {
    applyMode(event.detail?.mode || 'local', { forceRegion: event.detail?.forceRegion === true });
  });

  await watchAuth(handleAuth);

  document.addEventListener('wkd:players-updated', event => {
    const source = event.detail?.source || '';
    if (source.startsWith('source-')) return;
    if (source === 'import-excel' || source === 'import-url') {
      applyMode('local');
      return;
    }
    if (currentMode === 'local') window.setTimeout(renderCurrentRows, 50);
  });

  document.addEventListener('wkd:profile-updated', () => {
    window.setTimeout(() => handleAuth(currentUser), 120);
  });

  document.addEventListener('wkd:language-changed', () => {
    updateTabs();
    renderRegionSwitch();
    refreshTowerRegionOptions().catch(error => console.warn('[WKD] tower regions language refresh skipped:', error));
    renderCurrentRows();
  });
}

document.addEventListener('wkd:partials-ready', init);
document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
