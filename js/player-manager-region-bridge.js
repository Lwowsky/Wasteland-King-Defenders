import { makePublicShareUrl, rememberShareCode } from './core/share-links.js?v=184';
import { getFirebase, watchAuth } from './services/firebase-service.js';
import { getGameProfile, getUserProfile, isProfileComplete, normalizeUserRole } from './services/user-db.js';
import { canDeleteRegionRegistration, canEditRegionTowerPlan, canManageRegion, deleteRegionAlliance as deleteRegionAllianceDb, deleteRegionRegistrations, getManagedRegionOptions, getRegionTowerPlan, shareRegionFinalPlan as shareRegionFinalPlanDb, listRegionAlliances as listRegionAlliancesDb, listRegionCatalog, listRegionRegistrations, regionRegistrationToPlayer, saveRegionAlliance as saveRegionAllianceDb, saveRegionTowerPlan, updateRegionRegistration } from './services/region-db.js?v=184';

window.WKD = window.WKD || {};

const SOURCE_KEY = 'wkd.players.sourceMode';
const REGION_SOURCE = 'regionForm';

let currentUser = null;
let currentProfile = null;
let currentRegion = '';
let currentMode = normalizeMode(localStorage.getItem(SOURCE_KEY) || 'local');
let loadedRows = [];
let loadedAlliances = [];
let loadingPromise = null;
let loadingRegion = '';
let allianceLoadingPromise = null;
let loadedAlliancesRegion = '';
let currentRegionSettings = null;
let authReadyResolve = null;
const authReady = new Promise(resolve => { authReadyResolve = resolve; });

function tr(key, fallback = '') { return window.WKD_t ? window.WKD_t(key) : fallback; }
function normalizeMode(mode) { return mode === 'region' ? 'region' : 'local'; }
function regionOf(profile = currentProfile) { return String(getGameProfile(profile || {}).region || currentRegion || '').trim(); }
function canUseRegion() { return Boolean(currentUser && isProfileComplete(currentProfile)); }
function canEditRegion(region = currentRegion) { return Boolean(currentUser && region && canManageRegion(currentProfile, region, currentUser)); }
function canPlanRegion(region = currentRegion) { return Boolean(currentUser && region && canEditRegionTowerPlan(currentProfile, region, currentUser, currentRegionSettings || {})); }
function canDeleteRegion(region = currentRegion) { return Boolean(currentUser && region && canDeleteRegionRegistration(currentProfile, region, currentUser)); }
function rowKey(player = {}) { return String(player._rowId || player.id || player.uid || ''); }
function normTag(value = '') { return Array.from(String(value || '').trim().replace(/[\/\[\]#?]/g, '')).slice(0, 3).join(''); }
function gameProfile() { return getGameProfile(currentProfile || {}); }
function ownAlliance() { return normTag(gameProfile().alliance); }
function ownRank() { return String(gameProfile().rank || '').trim().toLowerCase(); }
function currentRole() { return normalizeUserRole(currentProfile?.role || 'player'); }
function isOwnerAdmin() { return String(currentUser?.email || '').trim().toLowerCase() === 'vovapotaychuk@gmail.com'; }
function isRankR4R5(rank = ownRank()) {
  return ['p4', 'p5', 'r4', 'r5', '4', '5'].includes(String(rank || '').trim().toLowerCase());
}
function canEditAllAllianceColors() {
  const role = currentRole();
  const sameRegion = regionOf() === currentRegion;
  return Boolean(currentUser && (isOwnerAdmin() || role === 'admin' || role === 'moderator' || (role === 'consul' && sameRegion)));
}
function canEditAllianceColor(tag = '') {
  const wanted = normTag(tag);
  if (!wanted || !canUseRegion()) return false;
  if (canEditAllAllianceColors()) return true;
  return currentRole() === 'officer' && regionOf() === currentRegion && ownAlliance() === wanted && isRankR4R5();
}
function normalizeBool(value) {
  if (value === true || value === false) return value;
  return /^(1|true|yes|так|да|y)$/i.test(String(value || '').trim());
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
    captain: normalizeBool(values.captain ?? player.captain),
    captainReady: normalizeBool(values.captain ?? player.captain) ? 'Так' : 'Ні',
    shift: values.shift || player.shift || 'both',
    lair: values.lair ?? player.lair ?? (player.captureRegion ? 'Так' : 'Ні'),
    lairLevel: Number(values.lairLevel ?? player.lairLevel ?? 0) || '',
    placement: values.placement || player.placement || 'Резерв'
  };
}
function nextRegionId(values = {}) {
  const name = String(values.name || values.nickname || 'player').toLowerCase().replace(/[^a-z0-9а-яіїєґ_-]+/giu, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'player';
  return `manual_${currentUser?.uid || 'user'}_${Date.now()}_${name}`;
}

function expandRegionPlayerRow(row = {}) {
  return [regionRegistrationToPlayer(row)];
}


async function loadRegionRows(force = false, regionOverride = '') {
  await authReady;
  if (!canUseRegion()) return { rows: [], region: '', profile: currentProfile, canUseRegion: false };
  const requestedRegion = String(regionOverride || currentRegion || regionOf()).trim();
  if (loadingPromise && (!requestedRegion || requestedRegion === loadingRegion)) return loadingPromise;
  if (!force && loadedRows.length && (!requestedRegion || requestedRegion === currentRegion)) {
    return { rows: loadedRows, region: currentRegion, profile: currentProfile, canUseRegion: true };
  }
  if (requestedRegion) currentRegion = requestedRegion;
  loadingRegion = requestedRegion;
  loadingPromise = listRegionRegistrations(currentUser, requestedRegion, {
    d1Only: true,
    forceD1: Boolean(force),
    d1TtlMs: force ? 0 : undefined
  }).then(result => {
    currentProfile = result.profile || currentProfile;
    currentRegion = result.region || currentRegion || requestedRegion || regionOf(result.profile || currentProfile);
    currentRegionSettings = result.settings || currentRegionSettings;
    loadedRows = (result.rows || []).flatMap(row => expandRegionPlayerRow(row).map(player => ({ ...player, source: REGION_SOURCE })));
    if (result?.d1Missing) {
      console.warn('[WKD] region table D1 snapshot missing; Firebase fallback was not used to protect reads.', currentRegion);
      window.WKD?.showNotice?.(tr('players.regionD1MissingNoFirestore', 'Таблиця регіону ще не має D1-кешу. Firebase fallback не запускався, щоб не витрачати reads.'));
    }
    return { rows: loadedRows, region: currentRegion, profile: currentProfile, canUseRegion: true, d1Missing: Boolean(result?.d1Missing), source: result?.source || '' };
  }).finally(() => { loadingPromise = null; loadingRegion = ''; });
  return loadingPromise;
}

async function loadRegionAlliances(force = false, regionOverride = '') {
  await authReady;
  if (!canUseRegion()) return [];
  const region = String(regionOverride || currentRegion || regionOf()).trim();
  if (!region) return [];
  if (allianceLoadingPromise && region === loadedAlliancesRegion) return allianceLoadingPromise;
  if (!force && loadedAlliances.length && region === loadedAlliancesRegion) return loadedAlliances;
  allianceLoadingPromise = listRegionAlliancesDb(region).then(items => {
    loadedAlliancesRegion = region;
    loadedAlliances = items || [];
    window.WKD.regionAllianceColorMap = Object.fromEntries(loadedAlliances.map(item => {
      const tag = normTag(item.tag || item.id);
      const hue = Number(item.colorHue);
      return tag && Number.isFinite(hue) ? [tag, ((Math.round(hue) % 360) + 360) % 360] : null;
    }).filter(Boolean));
    document.dispatchEvent(new CustomEvent('wkd:alliance-colors-updated', { detail: { source: 'region-bridge-load' } }));
    return loadedAlliances;
  }).catch(error => {
    console.warn('[WKD] alliance colors load failed:', error);
    return [];
  }).finally(() => { allianceLoadingPromise = null; });
  return allianceLoadingPromise;
}

async function saveAllianceColor(tag, values = null) {
  await authReady;
  const safeTag = normTag(tag);
  if (!safeTag) throw new Error('alliance-tag-required');
  if (!canEditAllianceColor(safeTag)) throw new Error('alliance-color-access');
  const firebase = await getFirebase();
  if (!firebase) throw new Error('firebase-not-configured');
  const { db, firestoreMod } = firebase;
  const region = currentRegion || regionOf();
  if (!region) throw new Error('region-required');
  const ref = firestoreMod.doc(db, 'regions', region, 'alliances', safeTag);
  const hue = values && Number.isFinite(Number(values.colorHue)) ? ((Math.round(Number(values.colorHue)) % 360) + 360) % 360 : null;
  const patch = hue === null
    ? { tag: safeTag, colorHue: null, colorMode: 'auto', colorUpdatedAt: firestoreMod.serverTimestamp(), colorUpdatedBy: currentUser.uid }
    : { tag: safeTag, colorHue: hue, colorMode: 'manual', colorUpdatedAt: firestoreMod.serverTimestamp(), colorUpdatedBy: currentUser.uid };
  await firestoreMod.setDoc(ref, patch, { merge: true });
  const index = loadedAlliances.findIndex(item => normTag(item.tag || item.id) === safeTag);
  const next = { ...(index >= 0 ? loadedAlliances[index] : { id: safeTag, tag: safeTag }), ...patch, colorHue: hue };
  if (index >= 0) loadedAlliances[index] = next;
  else loadedAlliances.push(next);
  return next;
}


async function saveRegionAlliance(tag, values = {}, regionOverride = '') {
  await authReady;
  const safeTag = normTag(tag || values.tag || values.id);
  const region = String(regionOverride || currentRegion || regionOf()).trim();
  if (!safeTag) throw new Error('alliance-tag-required');
  if (!region) throw new Error('region-required');
  const saved = await saveRegionAllianceDb(currentUser, region, { ...values, tag: safeTag, id: values.id || safeTag });
  const index = loadedAlliances.findIndex(item => normTag(item.tag || item.id) === safeTag || normTag(item.tag || item.id) === normTag(values.id));
  if (index >= 0) loadedAlliances[index] = saved;
  else loadedAlliances.push(saved);
  return saved;
}

async function deleteRegionAlliance(tag, regionOverride = '') {
  await authReady;
  const safeTag = normTag(tag);
  const region = String(regionOverride || currentRegion || regionOf()).trim();
  if (!safeTag) throw new Error('alliance-tag-required');
  if (!region) throw new Error('region-required');
  await deleteRegionAllianceDb(currentUser, region, safeTag);
  loadedAlliances = loadedAlliances.filter(item => normTag(item.tag || item.id) !== safeTag);
  return { deleted: safeTag };
}


function readLocalPlayers() {
  try {
    const rows = JSON.parse(localStorage.getItem(window.WKD?.storageKeys?.players || 'wkd.clean.players.v1') || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch (_error) {
    return [];
  }
}

function regionOptionsForProfile() {
  if (!currentUser || !currentProfile || !isProfileComplete(currentProfile)) return [];
  const regions = new Set();
  const ownRegion = regionOf(currentProfile);
  if (ownRegion) regions.add(ownRegion);
  getManagedRegionOptions(currentProfile, currentUser).forEach(region => regions.add(region));
  return [...regions].filter(Boolean).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}

async function refreshTowerRegionOptions() {
  const options = [{ id: 'home', label: tr('tower.localMode', 'Локально'), mode: 'local', region: '' }];
  if (currentUser && currentProfile && isProfileComplete(currentProfile)) {
    const role = currentRole();
    let regions = [];
    if (isOwnerAdmin() || role === 'admin' || role === 'moderator') {
      const catalog = await listRegionCatalog({ includeInactive: true, skipPublicPlayers: true }).catch(error => {
        console.warn('[WKD] tower region catalog skipped:', error);
        return [];
      });
      regions = catalog.map(item => item.region).filter(Boolean);
      regionOptionsForProfile().forEach(region => regions.push(region));
    } else {
      regions = regionOptionsForProfile();
    }
    [...new Set(regions.map(String).filter(Boolean))]
      .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
      .forEach(region => options.push({ id: `region:${region}`, label: `R${region}`, mode: 'region', region }));
  }
  window.WKD.towerPlannerRegionOptions = options;
  document.dispatchEvent(new CustomEvent('wkd:tower-region-options-updated', { detail: { options } }));
  return options;
}

async function showRowsForMode(force = false) {
  if (currentMode === 'region') {
    const result = await loadRegionRows(force, currentRegion || regionOf());
    if (window.WKD?.setPlayers) {
      window.WKD.setPlayers(result.rows || [], {
        persist: false,
        normalized: true,
        eventSource: 'source-region-bridge',
        clearStorage: false
      });
    }
    return result.rows || [];
  }
  const rows = readLocalPlayers();
  if (window.WKD?.setPlayers) {
    window.WKD.setPlayers(rows, {
      persist: false,
      normalized: true,
      eventSource: 'source-local-bridge',
      clearStorage: false
    });
  }
  return rows;
}


async function reloadRegionPlayersForTower(region = '', options = {}) {
  await authReady;
  const requested = normalizeRegion(region || currentRegion || regionOf());
  if (!requested || !canUseRegion()) return loadedRows || [];
  await loadRegionRows(options.force === true, requested);
  if (currentMode === 'region') await showRowsForMode(false);
  return loadedRows || [];
}

async function loadTowerPlanFromActiveSource() {
  await authReady;
  if (currentMode !== 'region') return { handled: false, plan: null };
  if (!currentUser) throw new Error('auth-required');
  const region = currentRegion || regionOf();
  const result = await getRegionTowerPlan(currentUser, region);
  currentProfile = result.profile || currentProfile;
  currentRegion = result.region || currentRegion || region;
  return { handled: true, ...result };
}

async function saveTowerPlanToActiveSource(plan = {}) {
  await authReady;
  if (currentMode !== 'region') return { handled: false };
  if (!currentUser) throw new Error('auth-required');
  const region = currentRegion || regionOf();
  if (!canPlanRegion(region)) throw new Error('region-plan-access-denied');
  const result = await saveRegionTowerPlan(currentUser, region, plan);
  return { handled: true, ...result };
}

async function shareRegionFinalPlan(payload = {}) {
  await authReady;
  if (!currentUser) throw new Error('auth-required');
  const region = currentRegion || regionOf();
  if (!canPlanRegion(region)) throw new Error('region-plan-access-denied');
  const result = await shareRegionFinalPlanDb(currentUser, region, payload);
  const url = makePublicShareUrl('./public-plan.html', result.code || '');
  rememberShareCode('finalPlan', result.code || '', { region });
  return { ...result, url };
}

async function setTowerPlannerSource(options = {}) {
  await authReady;
  const mode = normalizeMode(options.mode || 'local');
  if (mode !== 'region') {
    setMode('local');
    await showRowsForMode(false);
    return sourceInfo('local');
  }
  const region = String(options.region || currentRegion || regionOf() || '').trim();
  if (region) {
    currentRegion = region;
    loadedRows = [];
    loadedAlliances = [];
    loadedAlliancesRegion = '';
  }
  setMode('region');
  await showRowsForMode(true);
  return sourceInfo('region');
}

function sourceInfo(mode = currentMode) {
  const region = currentRegion || regionOf();
  return {
    mode: normalizeMode(mode),
    region,
    label: normalizeMode(mode) === 'region' ? (region ? `R${region}` : tr('playerManager.regionList', 'region table')) : tr('playerManager.localList', 'local list'),
    canUpdate: normalizeMode(mode) !== 'region' || canEditRegion(),
    canDelete: normalizeMode(mode) !== 'region' || canDeleteRegion(),
    canPlan: normalizeMode(mode) !== 'region' || canPlanRegion(),
    canViewRegion: canUseRegion(),
    userRole: normalizeUserRole(currentProfile?.role || 'player')
  };
}

function setMode(mode) {
  currentMode = normalizeMode(mode);
  localStorage.setItem(SOURCE_KEY, currentMode);
  document.dispatchEvent(new CustomEvent('wkd:player-manager-source-changed', { detail: sourceInfo() }));
}
function getMode() { return currentMode; }

async function updateRegionPlayer(id, values = {}) {
  await authReady;
  if (!canEditRegion()) throw new Error('region-update-access-denied');
  let wanted = String(id || '').trim();
  if (!wanted) wanted = nextRegionId(values);
  const existing = loadedRows.find(player => rowKey(player) === wanted);
  if (existing?.isExtraTroopRow) throw new Error('extra-troop-row-readonly');
  const registrationId = existing?.regionRegistrationId || existing?.id || wanted;
  const result = await updateRegionRegistration(currentUser, currentRegion || regionOf(), registrationId, values);
  const merged = mergePlayerValues(existing || { _rowId: registrationId, id: registrationId, regionRegistrationId: registrationId, source: REGION_SOURCE }, values);
  merged._rowId = registrationId;
  merged.id = registrationId;
  merged.regionRegistrationId = registrationId;
  merged.source = REGION_SOURCE;
  const index = loadedRows.findIndex(player => rowKey(player) === wanted || rowKey(player) === registrationId);
  if (index >= 0) loadedRows[index] = { ...loadedRows[index], ...merged };
  else loadedRows.push(merged);
  return { updated: true, player: merged, result };
}

async function deleteRegionPlayers(ids = []) {
  await authReady;
  if (!canDeleteRegion()) throw new Error('region-delete-access-denied');
  const wanted = [...new Set((Array.isArray(ids) ? ids : [ids]).map(id => String(id || '').trim()).filter(Boolean))];
  const dbIds = wanted.map(id => {
    const row = loadedRows.find(player => rowKey(player) === id);
    if (row?.isExtraTroopRow) return '';
    return row?.regionRegistrationId || row?.id || '';
  }).filter(Boolean);
  if (dbIds.length !== wanted.length) throw new Error('region-delete-registration-only');
  const result = await deleteRegionRegistrations(currentUser, currentRegion || regionOf(), dbIds);
  const set = new Set(wanted);
  loadedRows = loadedRows.filter(player => !set.has(rowKey(player)));
  return { removed: dbIds.length, result };
}

async function handleAuth(user) {
  currentUser = user || null;
  currentProfile = null;
  currentRegion = '';
  loadedRows = [];
  if (currentUser) {
    currentProfile = await getUserProfile(currentUser.uid).catch(() => null);
    currentRegion = regionOf(currentProfile);
  }
  authReadyResolve?.();
  if (!canUseRegion() && currentMode === 'region') setMode('local');
  await refreshTowerRegionOptions();
  if (currentMode === 'region' && canUseRegion()) await showRowsForMode(true).catch(error => console.warn('[WKD] initial region rows skipped:', error));
  document.dispatchEvent(new CustomEvent('wkd:player-manager-auth-ready', { detail: sourceInfo() }));
}

watchAuth(handleAuth).catch(error => console.warn('[WKD] player manager auth bridge skipped:', error));

window.WKD.getPlayersSourceInfo = sourceInfo;
window.WKD.loadTowerPlanFromActiveSource = loadTowerPlanFromActiveSource;
window.WKD.saveTowerPlanToActiveSource = saveTowerPlanToActiveSource;
window.WKD.shareRegionFinalPlan = shareRegionFinalPlan;
window.WKD.setTowerPlannerSource = setTowerPlannerSource;
window.WKD.refreshTowerRegionOptions = refreshTowerRegionOptions;
window.WKD.reloadRegionPlayersForTower = reloadRegionPlayersForTower;

window.WKD.playerManagerRegion = {
  authReady,
  loadRegionRows,
  loadRegionAlliances,
  saveAllianceColor,
  saveRegionAlliance,
  deleteRegionAlliance,
  canEditAllianceColor,
  updateRegionPlayer,
  deleteRegionPlayers,
  getSourceInfo: sourceInfo,
  setTowerPlannerSource,
  loadTowerPlanFromActiveSource,
  saveTowerPlanToActiveSource,
  shareRegionFinalPlan,
  refreshTowerRegionOptions,
  setMode,
  getMode
};

document.addEventListener('wkd:language-changed', () => {
  refreshTowerRegionOptions().catch(error => console.warn('[WKD] tower regions language refresh skipped:', error));
  document.dispatchEvent(new CustomEvent('wkd:player-manager-source-changed', { detail: sourceInfo() }));
});
