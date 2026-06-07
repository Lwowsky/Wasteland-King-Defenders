import { getFirebase } from './firebase-service.js';
import { readCache, writeCache, removeCache } from './local-cache.js?v=88';
import { trackReads, trackWrites, trackDeletes } from './usage-tracker.js?v=88';
import {
  getUserProfile,
  getFarmById,
  getGameProfile,
  getUserFarms,
  normalizeUserRole,
  roleLabel,
  formatUserDate,
  timestampToMs,
  createUserNotification
} from './user-db.js';

const trim = value => String(value ?? '').trim();
const toUpper = value => trim(value).toUpperCase();
const MANAGER_ROLES = ['admin', 'moderator', 'consul', 'officer'];
const OWNER_EMAILS = ['vovapotaychuk@gmail.com'];
const isOwnerEmail = email => OWNER_EMAILS.includes(String(email || '').trim().toLowerCase());
const DAY_MS = 24 * 60 * 60 * 1000;
function serviceT(key, fallback) {
  return globalThis.window?.WKD_t ? globalThis.window.WKD_t(key) : fallback;
}
function serviceLocale() {
  const lang = globalThis.window?.WKD_CURRENT_LANG || globalThis.document?.documentElement?.lang || globalThis.navigator?.language || 'en';
  const map = { uk: 'uk-UA', en: 'en-US', ru: 'ru-RU', pl: 'pl-PL', de: 'de-DE', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR', vi: 'vi-VN', ar: 'ar' };
  return map[String(lang).toLowerCase()] || lang || 'en-US';
}
function firstValue(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '');
}
function firstPositiveMs(...values) {
  for (const value of values) {
    const ms = Number(value) || timestampToMs(value);
    if (ms > 0) return ms;
  }
  return 0;
}
function withRegionRootFallback(regionData = {}) {
  const form = regionData.registrationForm || {};
  const openedAtMs = firstPositiveMs(
    form.openedAtMs,
    form.openedAt,
    form.startedAtMs,
    form.startedAt,
    regionData.openedAtMs,
    regionData.openedAt,
    regionData.registrationOpenedAtMs,
    regionData.registrationOpenedAt,
    regionData.startedAtMs,
    regionData.startedAt
  );
  const closedAtMs = firstPositiveMs(
    form.closedAtMs,
    form.closedAt,
    regionData.closedAtMs,
    regionData.closedAt,
    regionData.registrationClosedAtMs,
    regionData.registrationClosedAt
  );
  return {
    ...form,
    updatedAt: firstValue(form.updatedAt, regionData.updatedAt),
    updatedAtMs: firstValue(form.updatedAtMs, regionData.updatedAtMs),
    updatedBy: firstValue(form.updatedBy, regionData.updatedBy),
    updatedByName: firstValue(form.updatedByName, regionData.updatedByName),
    updatedByEmail: firstValue(form.updatedByEmail, regionData.updatedByEmail),
    openedAtMs,
    openedAt: firstValue(form.openedAt, regionData.openedAt, regionData.registrationOpenedAt, form.startedAt, regionData.startedAt),
    openedByUid: firstValue(form.openedByUid, form.startedByUid, regionData.openedByUid, regionData.registrationOpenedByUid, regionData.startedByUid, form.updatedBy, regionData.updatedBy),
    openedByName: firstValue(form.openedByName, form.startedByName, regionData.openedByName, regionData.registrationOpenedByName, regionData.startedByName, form.updatedByName, regionData.updatedByName),
    openedByEmail: firstValue(form.openedByEmail, form.startedByEmail, regionData.openedByEmail, regionData.registrationOpenedByEmail, regionData.startedByEmail, form.updatedByEmail, regionData.updatedByEmail),
    closedAtMs,
    closedAt: firstValue(form.closedAt, regionData.closedAt, regionData.registrationClosedAt),
    closedByUid: firstValue(form.closedByUid, regionData.closedByUid, regionData.registrationClosedByUid),
    closedByName: firstValue(form.closedByName, regionData.closedByName, regionData.registrationClosedByName),
    closedByEmail: firstValue(form.closedByEmail, regionData.closedByEmail, regionData.registrationClosedByEmail)
  };
}
const WASTELAND_PERIOD_MS = 14 * DAY_MS;
const WASTELAND_DURATION_MS = DAY_MS;
export const REGION_REGISTRATION_RETENTION_DAYS = 14;
const REGION_REGISTRATION_RETENTION_MS = REGION_REGISTRATION_RETENTION_DAYS * DAY_MS;
const DEFAULT_EVENT_ANCHOR_MS = Date.UTC(2026, 4, 30, 10, 0, 0); // Saturday 19:00 JST

export const DEFAULT_REGION_FORM = {
  enabled: false,
  title: 'Реєстрація на пустош',
  description: 'Заповни заявку для свого регіону. Консул або офіцер побачить її у таблиці регіону.',
  shifts: ['shift1', 'shift2'],
  requireCaptain: false,
  allowExtraTroop: true,
  minTier: 'T10',
  customTroopTypes: [],
  customFields: [],
  customShifts: [],
  closeRule: 'hoursBeforeEvent',
  closeHours: 24,
  autoOpenEnabled: true,
  autoOpenDay: 5,
  autoOpenTime: '00:00',
  rotationEnabled: false,
  rotationLoop: true,
  rotationActiveIndex: 0,
  rotationAlliances: []
};

export const DEFAULT_SHIFT_OPTIONS = [
  { id: 'shift1', labelKey: 'shift.shift1', label: 'Зміна 1' },
  { id: 'shift2', labelKey: 'shift.shift2', label: 'Зміна 2' },
  { id: 'shift3', labelKey: 'shift.shift3', label: 'Зміна 3' },
  { id: 'shift4', labelKey: 'shift.shift4', label: 'Зміна 4' },
  { id: 'both', labelKey: 'shift.both', label: 'Обидві' }
];

export function shiftLabel(shift = '', settings = {}) {
  const id = trim(shift);
  const basic = DEFAULT_SHIFT_OPTIONS.find(item => item.id === id);
  if (basic) return serviceT(basic.labelKey, basic.label);
  const custom = Array.isArray(settings.customShifts)
    ? settings.customShifts.find(item => item.id === id)
    : null;
  return custom?.label || id || '—';
}

export function troopLabel(type = '', settings = {}) {
  const labels = {
    fighter: serviceT('troop.fighter', 'Бійці'),
    rider: serviceT('troop.rider', 'Наїзники'),
    shooter: serviceT('troop.shooter', 'Стрільці')
  };
  const custom = Array.isArray(settings.customTroopTypes)
    ? settings.customTroopTypes.find(item => item.id === type || item.label === type)
    : null;
  return labels[type] || custom?.label || type || '—';
}


function allRegionGames(profile = {}) {
  const main = { ...getGameProfile(profile || {}), farmId: 'main', id: 'main', role: normalizeUserRole(profile?.role || 'player') };
  const farms = getUserFarms(profile || {}).map(farm => ({ ...farm, role: normalizeUserRole(farm.role || 'player') }));
  return [main, ...farms].filter(game => game.nickname || game.region || game.alliance);
}

function bestRegionGame(profile = {}) {
  const main = getGameProfile(profile || {});
  if (main.region) return { ...main, farmId: 'main', id: 'main', role: normalizeUserRole(profile?.role || 'player') };
  const active = getFarmById(profile || {}, profile?.activeFarmId || 'main');
  if (active?.region) return { ...active, role: normalizeUserRole(active.role || 'player') };
  return allRegionGames(profile || {}).find(farm => farm.region) || { ...main, farmId: 'main', id: 'main', role: normalizeUserRole(profile?.role || 'player') };
}

function gameForRegion(profile = {}, region = '') {
  const safeRegion = normalizeRegion(region);
  return allRegionGames(profile || {}).find(game => normalizeRegion(game.region) === safeRegion) || null;
}

export function getRegionActorName(profile = {}, region = '', actor = null) {
  const game = gameForRegion(profile || {}, region) || bestRegionGame(profile || {});
  return trim(game?.nickname || profile?.game?.nickname || profile?.nickname || profile?.displayName || actor?.displayName || actor?.email || actor?.uid || '');
}

function roleForRegion(profile = {}, region = '', actor = null) {
  const globalRole = normalizeUserRole(profile?.role || 'player');
  if (isOwnerEmail(actor?.email || profile?.email)) return 'admin';
  if (globalRole === 'admin' || globalRole === 'moderator') return globalRole;
  const game = gameForRegion(profile, region);
  if (!game) return 'player';
  return game.farmId === 'main' ? globalRole : normalizeUserRole(game.role || 'player');
}

export function canViewRegion(profile = {}, region = '', actor = null) {
  const safeRegion = normalizeRegion(region);
  if (!safeRegion) return false;
  if (canViewAnyRegion(profile, actor)) return true;
  return Boolean(gameForRegion(profile, safeRegion));
}

function troopTypeToPlayerRole(type = '') {
  const troopType = trim(type).toLowerCase();
  if (troopType === 'fighter') return 'Fighter';
  if (troopType === 'rider') return 'Rider';
  if (troopType === 'shooter') return 'Shooter';
  return '';
}

const TIER_LIST = Array.from({ length: 14 }, (_, index) => `T${14 - index}`);
function tierNumber(value = '') {
  return Number(String(value).replace(/[^0-9]/g, '')) || 1;
}
function normalizeTier(value = 'T10') {
  const tier = String(value || 'T10').trim().toUpperCase();
  return TIER_LIST.includes(tier) ? tier : 'T10';
}
function makeCustomId(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ_-]+/giu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || `custom-${Date.now()}`;
}
function normalizeCustomTroops(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(item => {
      const label = trim(typeof item === 'string' ? item : item.label);
      const id = makeCustomId(typeof item === 'string' ? item : (item.id || label));
      return label ? { id, label } : null;
    })
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex(other => other.id === item.id) === index)
    .slice(0, 12);
}
function normalizeCustomFields(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(item => {
      const label = trim(item.label || item.name || item.id);
      const id = makeCustomId(item.id || label);
      const type = item.type === 'checkbox' ? 'checkbox' : 'text';
      return label ? { id, label, type } : null;
    })
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex(other => other.id === item.id) === index)
    .slice(0, 20);
}
function normalizeCustomShifts(items = []) {
  const defaultIds = new Set(DEFAULT_SHIFT_OPTIONS.map(item => item.id));
  return (Array.isArray(items) ? items : [])
    .map(item => {
      const label = trim(typeof item === 'string' ? item : item.label);
      const id = makeCustomId(typeof item === 'string' ? item : (item.id || label));
      return label && !defaultIds.has(id) ? { id, label } : null;
    })
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex(other => other.id === item.id) === index)
    .slice(0, 12);
}
export function getAllowedShifts(settings = {}) {
  const custom = normalizeCustomShifts(settings.customShifts);
  return [...DEFAULT_SHIFT_OPTIONS, ...custom];
}
function normalizeShiftValues(values = [], customShifts = []) {
  const allowed = new Set([...DEFAULT_SHIFT_OPTIONS, ...customShifts].map(item => item.id));
  const shifts = (Array.isArray(values) ? values : [])
    .map(value => trim(value))
    .filter(value => allowed.has(value))
    .filter((value, index, arr) => arr.indexOf(value) === index);
  return shifts.length ? shifts : DEFAULT_REGION_FORM.shifts;
}
function normalizeRotationAlliances(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(item => {
      const tag = normalizeAllianceTag(typeof item === 'string' ? item : (item.tag || item.id));
      const name = trim(typeof item === 'string' ? '' : item.name);
      return tag ? { tag, name } : null;
    })
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex(other => other.tag === item.tag) === index)
    .slice(0, 40);
}

function normalizeShortLinkCode(value = '') {
  return trim(value).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36);
}
function makeShortLinkCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let code = '';
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(12);
    cryptoObj.getRandomValues(bytes);
    for (const byte of bytes) code += alphabet[byte % alphabet.length];
  } else {
    for (let index = 0; index < 12; index += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
export function getAllowedTiers(settings = {}) {
  const minTier = normalizeTier(settings.minTier || DEFAULT_REGION_FORM.minTier);
  const min = tierNumber(minTier);
  return TIER_LIST.filter(tier => tierNumber(tier) >= min);
}

export function normalizeRegion(region) {
  return trim(region).replace(/[^0-9]/g, '');
}

export function readRegionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = normalizeRegion(params.get('region') || params.get('r') || '');
  if (fromQuery) return fromQuery;
  const hashMatch = String(window.location.hash || '').replace(/^#/, '').match(/^(\d{1,8})\//);
  if (hashMatch?.[1]) return normalizeRegion(hashMatch[1]);
  const match = String(window.location.pathname || '').match(/^\/f\/(\d{1,8})\//);
  return normalizeRegion(match?.[1] || '');
}

export function canManageRegion(profile = {}, region = '', actor = null) {
  const role = roleForRegion(profile, region, actor);
  return ['admin', 'moderator', 'consul', 'officer'].includes(role) && canViewRegion(profile, region, actor);
}

function activeRotationAlliance(settings = {}) {
  const list = normalizeRotationAlliances(settings.rotationAlliances || []);
  if (!settings.rotationEnabled || !list.length) return normalizeAllianceTag(settings.hostAlliance || '');
  const index = Math.max(0, Math.min(list.length - 1, Number(settings.rotationActiveIndex) || 0));
  return normalizeAllianceTag(list[index]?.tag || settings.hostAlliance || '');
}

function actorAllianceForRegion(profile = {}, region = '') {
  const game = gameForRegion(profile || {}, region) || bestRegionGame(profile || {});
  return normalizeAllianceTag(game?.alliance || '');
}

function actorRankForRegion(profile = {}, region = '') {
  const game = gameForRegion(profile || {}, region) || bestRegionGame(profile || {});
  return trim(game?.rank || '').toLowerCase();
}

export function canLeadCurrentRotation(profile = {}, region = '', actor = null, settings = {}) {
  const safeRegion = normalizeRegion(region);
  if (!safeRegion || !canViewRegion(profile, safeRegion, actor)) return false;
  const role = roleForRegion(profile, safeRegion, actor);
  if (['admin', 'moderator', 'consul'].includes(role)) return true;
  if (role !== 'officer') return false;
  const active = activeRotationAlliance(settings);
  return Boolean(active && actorAllianceForRegion(profile, safeRegion) === active);
}

export function canOpenCloseRegion(profile = {}, region = '', actor = null, settings = {}) {
  return canLeadCurrentRotation(profile, region, actor, settings);
}

export function canEditRegionTowerPlan(profile = {}, region = '', actor = null, settings = {}) {
  return canLeadCurrentRotation(profile, region, actor, settings);
}

export function canPromoteAllianceMember(profile = {}, region = '', target = {}, targetRole = 'player', actor = null) {
  const safeRegion = normalizeRegion(region);
  const role = roleForRegion(profile, safeRegion, actor);
  const targetAlliance = normalizeAllianceTag(target.alliance || '');
  if (!targetAlliance || !canViewRegion(profile, safeRegion, actor)) return false;
  if (['admin', 'moderator'].includes(role)) return true;
  const ownAlliance = actorAllianceForRegion(profile, safeRegion);
  const ownRank = actorRankForRegion(profile, safeRegion);
  const wanted = normalizeUserRole(targetRole);
  if (role === 'consul' && ownAlliance === targetAlliance) return ['officer', 'player'].includes(wanted) || ['p4', 'p5'].includes(String(target.rank || '').toLowerCase());
  if (role === 'officer' && ownAlliance === targetAlliance && ['p5', 'r5', '5'].includes(ownRank)) return wanted === 'player' || String(target.rank || '').toLowerCase() === 'p4';
  return false;
}

export function canDeleteRegionRegistration(profile = {}, region = '', actor = null) {
  const role = roleForRegion(profile, region, actor);
  return ['admin', 'moderator', 'consul'].includes(role) && canViewRegion(profile, region, actor);
}

export function canOpenRegionTools(profile = {}) {
  const globalRole = normalizeUserRole(profile?.role || 'player');
  return MANAGER_ROLES.includes(globalRole) || allRegionGames(profile).some(game => MANAGER_ROLES.includes(normalizeUserRole(game.role || 'player')));
}

export function canViewAnyRegion(profile = {}, actor = null) {
  return isOwnerEmail(actor?.email || profile?.email) || ['admin', 'moderator'].includes(normalizeUserRole(profile?.role || 'player'));
}

export function getManagedRegionOptions(profile = {}, actor = null) {
  const regions = new Set();
  allRegionGames(profile || {}).forEach(game => {
    const region = normalizeRegion(game.region);
    if (region && canManageRegion(profile || {}, region, actor)) regions.add(region);
  });
  const fallback = normalizeRegion(bestRegionGame(profile || {}).region);
  if (fallback && canManageRegion(profile || {}, fallback, actor)) regions.add(fallback);
  return [...regions].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}

export async function listKnownRegionIds() {
  const { db, firestoreMod } = await getFirebaseParts();
  const regions = new Set();
  const archived = new Set();
  const addRegion = value => {
    const region = normalizeRegion(value);
    if (region && !archived.has(region)) regions.add(region);
  };
  try {
    const regionSnap = await firestoreMod.getDocs(firestoreMod.collection(db, 'regions'));
    regionSnap.docs.forEach(doc => {
      const region = normalizeRegion(doc.id);
      const data = doc.data() || {};
      if (!region) return;
      if (data.active === false) {
        archived.add(region);
        regions.delete(region);
      } else {
        regions.add(region);
      }
    });
  } catch (error) {
    console.warn('[WKD] regions list skipped:', error);
  }
  try {
    const publicSnap = await firestoreMod.getDocs(firestoreMod.collection(db, 'publicPlayers'));
    publicSnap.docs.forEach(doc => {
      const data = doc.data() || {};
      addRegion(data.region);
      const farms = Array.isArray(data.farms) ? data.farms : [];
      farms.forEach(farm => addRegion(farm?.region));
    });
  } catch (error) {
    console.warn('[WKD] public region list skipped:', error);
  }
  return [...regions].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}


function normalizeRegionName(value = '', region = '') {
  const name = trim(value).slice(0, 60);
  const safeRegion = normalizeRegion(region);
  return name || (safeRegion ? `R${safeRegion}` : '');
}

function regionCatalogItem(region = '', data = {}) {
  const safeRegion = normalizeRegion(region || data.region || data.id);
  if (!safeRegion) return null;
  const active = data.active !== false;
  return {
    id: safeRegion,
    region: safeRegion,
    label: normalizeRegionName(data.label || data.name, safeRegion),
    name: normalizeRegionName(data.name || data.label, safeRegion),
    note: trim(data.note).slice(0, 120),
    active,
    source: trim(data.source || (data.createdBy ? 'manual' : 'auto')) || 'auto',
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    createdBy: trim(data.createdBy),
    updatedBy: trim(data.updatedBy)
  };
}

export function canCreateManualRegion(profile = {}, actor = null) {
  return canViewAnyRegion(profile, actor);
}

export async function listRegionCatalog({ includeInactive = false } = {}) {
  const { db, firestoreMod } = await getFirebaseParts();
  const byRegion = new Map();
  const addItem = item => {
    if (!item?.region) return;
    const old = byRegion.get(item.region) || {};
    byRegion.set(item.region, { ...old, ...item, active: item.active !== false });
  };

  try {
    const regionSnap = await firestoreMod.getDocs(firestoreMod.collection(db, 'regions'));
    regionSnap.docs.forEach(doc => addItem(regionCatalogItem(doc.id, doc.data() || {})));
  } catch (error) {
    console.warn('[WKD] region catalog skipped:', error);
  }

  try {
    const publicSnap = await firestoreMod.getDocs(firestoreMod.collection(db, 'publicPlayers'));
    publicSnap.docs.forEach(doc => {
      const data = doc.data() || {};
      [data.region, ...(Array.isArray(data.farms) ? data.farms.map(farm => farm?.region) : [])]
        .map(normalizeRegion)
        .filter(Boolean)
        .forEach(region => {
          if (!byRegion.has(region)) addItem(regionCatalogItem(region, { source: 'auto', active: true }));
        });
    });
  } catch (error) {
    console.warn('[WKD] public region catalog skipped:', error);
  }

  return [...byRegion.values()]
    .filter(item => includeInactive || item.active !== false)
    .sort((a, b) => Number(a.region) - Number(b.region) || a.region.localeCompare(b.region));
}

export async function createManualRegion(user, values = {}) {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  if (!canCreateManualRegion(profile, user)) throw new Error('manual-region-access-denied');
  const safeRegion = normalizeRegion(values.region || values.id);
  if (!safeRegion) throw new Error('region-required');
  const ref = firestoreMod.doc(db, 'regions', safeRegion);
  const snap = await firestoreMod.getDoc(ref);
  const now = firestoreMod.serverTimestamp();
  const patch = {
    region: safeRegion,
    id: safeRegion,
    label: normalizeRegionName(values.label || values.name, safeRegion),
    name: normalizeRegionName(values.name || values.label, safeRegion),
    note: trim(values.note).slice(0, 120),
    active: values.active === false ? false : true,
    source: 'manual',
    manual: true,
    updatedAt: now,
    updatedBy: user.uid
  };
  if (!snap.exists()) {
    patch.createdAt = now;
    patch.createdBy = user.uid;
  }
  await firestoreMod.setDoc(ref, patch, { merge: true });
  return regionCatalogItem(safeRegion, patch);
}

export async function archiveManualRegion(user, region, active = false) {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  if (!canCreateManualRegion(profile, user)) throw new Error('manual-region-access-denied');
  const safeRegion = normalizeRegion(region);
  if (!safeRegion) throw new Error('region-required');
  await firestoreMod.setDoc(firestoreMod.doc(db, 'regions', safeRegion), {
    region: safeRegion,
    id: safeRegion,
    label: `R${safeRegion}`,
    name: `R${safeRegion}`,
    active: Boolean(active),
    source: 'manual',
    manual: true,
    updatedAt: firestoreMod.serverTimestamp(),
    updatedBy: user.uid
  }, { merge: true });
  return { region: safeRegion, active: Boolean(active) };
}

export function makeRegionPath(region) {
  return `regions/${normalizeRegion(region)}`;
}

export function getNextWastelandStart(fromMs = Date.now(), anchorMs = DEFAULT_EVENT_ANCHOR_MS) {
  let start = Number(anchorMs) || DEFAULT_EVENT_ANCHOR_MS;
  const now = Number(fromMs) || Date.now();
  while (start + WASTELAND_DURATION_MS <= now) start += WASTELAND_PERIOD_MS;
  return start;
}

export function computeCloseAtMs(eventStartAtMs, closeRule = 'hoursBeforeEvent', closeHours = 24) {
  const eventMs = Number(eventStartAtMs) || getNextWastelandStart();
  if (closeRule === 'gameResetFridayUtc') {
    const date = new Date(eventMs);
    const daysSinceFriday = (date.getUTCDay() - 5 + 7) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceFriday);
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime() >= eventMs ? eventMs - DAY_MS : date.getTime();
  }
  const hours = Math.max(1, Math.min(168, Number(closeHours) || 24));
  return eventMs - hours * 60 * 60 * 1000;
}

export function computeOpenAtMs(eventStartAtMs, autoOpenEnabled = true, autoOpenDay = 5, autoOpenTime = '00:00') {
  if (!autoOpenEnabled) return 0;
  const eventMs = Number(eventStartAtMs) || getNextWastelandStart();
  const day = Math.max(0, Math.min(6, Number(autoOpenDay)));
  const [hourRaw, minuteRaw] = String(autoOpenTime || '00:00').split(':');
  const hour = Math.max(0, Math.min(23, Number(hourRaw) || 0));
  const minute = Math.max(0, Math.min(59, Number(minuteRaw) || 0));
  const date = new Date(eventMs);
  const daysSinceTarget = (date.getUTCDay() - day + 7) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceTarget);
  date.setUTCHours(hour, minute, 0, 0);
  if (date.getTime() >= eventMs) date.setUTCDate(date.getUTCDate() - 7);
  return date.getTime();
}

export function makeCycleId(eventStartAtMs = getNextWastelandStart()) {
  return `wasteland-${Number(eventStartAtMs) || Date.now()}`;
}

function formatDateInZone(value, timeZone = undefined, suffix = '') {
  const ms = Number(value) || timestampToMs(value);
  if (!ms) return '—';
  const text = new Intl.DateTimeFormat(serviceLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short'
  }).format(new Date(ms));
  return suffix ? `${text} ${suffix}` : text;
}

export function formatRegionDate(value) {
  return formatDateInZone(value);
}

export function formatUtcDate(value) {
  return formatDateInZone(value, 'UTC');
}

export function formatLocalDate(value) {
  return formatDateInZone(value);
}

export function isUtcAndLocalShown() {
  try {
    return globalThis.localStorage?.getItem('wkd.time.showUtcAndLocal') !== 'false';
  } catch {
    return true;
  }
}

export function setUtcAndLocalShown(value) {
  try { globalThis.localStorage?.setItem('wkd.time.showUtcAndLocal', value ? 'true' : 'false'); } catch {}
}

export function formatUtcAndLocal(value) {
  const localText = `${serviceT('region.yourTime', 'Your time')}: ${formatLocalDate(value)}`;
  if (!isUtcAndLocalShown()) return localText;
  return `${serviceT('common.utc', 'UTC')}: ${formatUtcDate(value)} · ${localText}`;
}


export function getRegionLifecycle(settings = {}, nowMs = Date.now()) {
  const closeHours = Math.max(1, Math.min(168, Number(settings.closeHours) || DEFAULT_REGION_FORM.closeHours));
  const closeRule = settings.closeRule || DEFAULT_REGION_FORM.closeRule;
  const autoOpenEnabled = 'autoOpenEnabled' in settings ? Boolean(settings.autoOpenEnabled) : DEFAULT_REGION_FORM.autoOpenEnabled;
  const autoOpenDay = Math.max(0, Math.min(6, Number(settings.autoOpenDay ?? DEFAULT_REGION_FORM.autoOpenDay)));
  const autoOpenTime = /^\d{2}:\d{2}$/.test(trim(settings.autoOpenTime)) ? trim(settings.autoOpenTime) : DEFAULT_REGION_FORM.autoOpenTime;

  const explicitCloseAtMs = firstPositiveMs(
    settings.closeAtMs,
    settings.closeAt,
    settings.registrationCloseAtMs,
    settings.registrationCloseAt
  );
  const explicitEventStartAtMs = firstPositiveMs(
    settings.eventStartAtMs,
    settings.startAtMs,
    settings.wastelandStartAtMs,
    settings.eventStartAt,
    settings.startAt,
    settings.wastelandStartAt
  );
  const eventStartAtMs = explicitEventStartAtMs || (explicitCloseAtMs ? explicitCloseAtMs + closeHours * 60 * 60 * 1000 : getNextWastelandStart(nowMs));
  const closeAtMs = explicitCloseAtMs || computeCloseAtMs(eventStartAtMs, closeRule, closeHours);
  const explicitOpenAtMs = firstPositiveMs(
    settings.openAtMs,
    settings.openAt,
    settings.registrationOpenAtMs,
    settings.registrationOpenAt
  );
  const openAtMs = explicitOpenAtMs || computeOpenAtMs(eventStartAtMs, autoOpenEnabled, autoOpenDay, autoOpenTime);
  const updatedAtMs = firstPositiveMs(settings.updatedAtMs, settings.updatedAt);
  const openedAtMs = firstPositiveMs(
    settings.openedAtMs,
    settings.openedAt,
    settings.registrationOpenedAtMs,
    settings.registrationOpenedAt,
    settings.startedAtMs,
    settings.startedAt
  ) || ((settings.enabled || settings.open) ? (firstPositiveMs(openAtMs) || updatedAtMs || 0) : 0);
  const closedAtMs = firstPositiveMs(
    settings.closedAtMs,
    settings.closedAt,
    settings.registrationClosedAtMs,
    settings.registrationClosedAt
  );
  const openedByUid = trim(firstValue(
    settings.openedByUid,
    settings.startedByUid,
    settings.registrationOpenedByUid,
    settings.updatedBy
  ));
  const openedByName = trim(firstValue(
    settings.openedByName,
    settings.startedByName,
    settings.registrationOpenedByName,
    settings.updatedByName,
    settings.openedByEmail,
    settings.startedByEmail,
    settings.registrationOpenedByEmail,
    settings.updatedByEmail
  ));
  const openedByEmail = trim(firstValue(
    settings.openedByEmail,
    settings.startedByEmail,
    settings.registrationOpenedByEmail,
    settings.updatedByEmail
  ));
  return {
    eventStartAtMs,
    startAtMs: eventStartAtMs,
    closeAtMs,
    openAtMs,
    openedAtMs,
    closedAtMs,
    openedByUid,
    openedByName,
    openedByEmail,
    updatedAtMs
  };
}

export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const d = serviceT('time.daysShort', 'd');
  const h = serviceT('time.hoursShort', 'h');
  const m = serviceT('time.minutesShort', 'm');
  if (days > 0) return `${days} ${d} ${hours} ${h} ${minutes} ${m}`;
  if (hours > 0) return `${hours} ${h} ${minutes} ${m}`;
  return `${minutes} ${m}`;
}

function mergeRegionSettings(data = {}) {
  const eventStartAtMs = Number(data.eventStartAtMs || data.startAtMs || data.wastelandStartAtMs) || getNextWastelandStart();
  const closeRule = data.closeRule || DEFAULT_REGION_FORM.closeRule;
  const closeHours = Math.max(1, Math.min(168, Number(data.closeHours) || DEFAULT_REGION_FORM.closeHours));
  const closeAtMs = Number(data.closeAtMs) || computeCloseAtMs(eventStartAtMs, closeRule, closeHours);
  const autoOpenEnabled = 'autoOpenEnabled' in data ? Boolean(data.autoOpenEnabled) : DEFAULT_REGION_FORM.autoOpenEnabled;
  const autoOpenDay = Math.max(0, Math.min(6, Number(data.autoOpenDay ?? DEFAULT_REGION_FORM.autoOpenDay)));
  const autoOpenTime = /^\d{2}:\d{2}$/.test(trim(data.autoOpenTime)) ? trim(data.autoOpenTime) : DEFAULT_REGION_FORM.autoOpenTime;
  const openAtMs = Number(data.openAtMs) || computeOpenAtMs(eventStartAtMs, autoOpenEnabled, autoOpenDay, autoOpenTime);
  const rotationAlliances = normalizeRotationAlliances(data.rotationAlliances);
  const rotationActiveIndex = Math.max(0, Math.min(Math.max(0, rotationAlliances.length - 1), Number(data.rotationActiveIndex) || 0));
  const currentCycleId = trim(data.currentCycleId) || makeCycleId(eventStartAtMs);
  const customShifts = normalizeCustomShifts(data.customShifts);
  const updatedAtMs = timestampToMs(data.updatedAt) || Number(data.updatedAtMs) || 0;
  const openedAtMs = firstPositiveMs(data.openedAtMs, data.openedAt, data.registrationOpenedAtMs, data.registrationOpenedAt)
    || (Boolean(data.enabled) ? (Number(data.openAtMs) || updatedAtMs || 0) : 0);
  const closedAtMs = firstPositiveMs(data.closedAtMs, data.closedAt, data.registrationClosedAtMs, data.registrationClosedAt);
  return {
    ...DEFAULT_REGION_FORM,
    ...data,
    enabled: Boolean(data.enabled),
    hostAlliance: trim(data.hostAlliance),
    governor: trim(data.governor),
    customShifts,
    shifts: normalizeShiftValues(data.shifts, customShifts),
    requireCaptain: false,
    minTier: normalizeTier(data.minTier || DEFAULT_REGION_FORM.minTier),
    customTroopTypes: normalizeCustomTroops(data.customTroopTypes),
    customFields: normalizeCustomFields(data.customFields),
    closeRule,
    closeHours,
    autoOpenEnabled,
    autoOpenDay,
    autoOpenTime,
    openAtMs,
    rotationEnabled: Boolean(data.rotationEnabled),
    rotationLoop: 'rotationLoop' in data ? Boolean(data.rotationLoop) : DEFAULT_REGION_FORM.rotationLoop,
    rotationActiveIndex,
    rotationAlliances,
    eventStartAtMs,
    startAtMs: eventStartAtMs,
    closeAtMs,
    currentCycleId,
    openedAtMs,
    updatedAtMs,
    updatedByName: trim(data.updatedByName),
    updatedByEmail: trim(data.updatedByEmail),
    openedByUid: trim(data.openedByUid || data.startedByUid || data.registrationOpenedByUid || data.updatedBy),
    openedByName: trim(data.openedByName || data.startedByName || data.registrationOpenedByName || data.updatedByName || data.openedByEmail),
    openedByEmail: trim(data.openedByEmail || data.startedByEmail || data.registrationOpenedByEmail || data.updatedByEmail),
    closedAtMs,
    closedByUid: trim(data.closedByUid),
    closedByName: trim(data.closedByName || data.closedByEmail),
    closedByEmail: trim(data.closedByEmail)
  };
}

export function getRegionFormStatus(settings = {}, nowMs = Date.now()) {
  const merged = mergeRegionSettings(settings);
  const lifecycle = getRegionLifecycle(merged, nowMs);
  const eventEndAtMs = Number(lifecycle.eventStartAtMs) + WASTELAND_DURATION_MS;
  const open = Boolean(merged.enabled) && nowMs >= lifecycle.openAtMs && nowMs < lifecycle.closeAtMs && nowMs < eventEndAtMs;
  let reason = 'open';
  if (!merged.enabled) reason = 'disabled';
  else if (nowMs < lifecycle.openAtMs) reason = 'notOpenYet';
  else if (nowMs >= lifecycle.closeAtMs) reason = 'closedByTimer';
  else if (nowMs >= eventEndAtMs) reason = 'eventFinished';
  return { ...merged, ...lifecycle, open, reason, eventEndAtMs };
}

async function getFirebaseParts() {
  const firebase = await getFirebase();
  if (!firebase) throw new Error('firebase-not-configured');
  return firebase;
}

export async function getMyRegionContext(user, preferredRegion = '') {
  if (!user) throw new Error('auth-required');
  const profile = await getUserProfile(user.uid);
  const requestedRegion = normalizeRegion(preferredRegion);
  const fallbackGame = bestRegionGame(profile || {});
  const fallbackRegion = normalizeRegion(fallbackGame.region);
  const region = requestedRegion && canViewRegion(profile || {}, requestedRegion, user) ? requestedRegion : fallbackRegion;
  const game = gameForRegion(profile || {}, region) || fallbackGame;
  if (!profile || !region) throw new Error('profile-region-required');
  return { profile, game, region };
}

export async function getRegionSettings(region) {
  const { db, firestoreMod } = await getFirebaseParts();
  const safeRegion = normalizeRegion(region);
  if (!safeRegion) throw new Error('region-required');
  const ref = firestoreMod.doc(db, 'regions', safeRegion);
  const snap = await firestoreMod.getDoc(ref);
  trackReads(1);
  const regionData = snap.exists() ? (snap.data() || {}) : {};
  return mergeRegionSettings(withRegionRootFallback(regionData));
}

function actionLabel(action = '') {
  const labels = {
    registration_started: 'Запустив реєстрацію',
    registration_closed: 'Закрив реєстрацію',
    registration_settings_saved: 'Зберіг форму регіону',
    registration_submitted: 'Подав заявку',
    tower_plan_saved: 'Зберіг розподіл турелей',
    final_plan_shared: 'Створив посилання фінального плану',
    alliance_saved: 'Змінив альянс регіону',
    alliance_deleted: 'Видалив альянс регіону'
  };
  return labels[action] || action || 'Дія';
}
function regionActionVisibleTo(profile = {}, region = '', actor = null, entry = {}) {
  const safeRegion = normalizeRegion(region);
  const role = roleForRegion(profile || {}, safeRegion, actor);
  if (['admin', 'moderator', 'consul'].includes(role)) return true;
  if (role !== 'officer') return false;
  const ownAlliance = actorAllianceForRegion(profile || {}, safeRegion);
  return Boolean(ownAlliance && normalizeAllianceTag(entry.alliance || entry.actorAlliance || entry.details?.alliance) === ownAlliance);
}
async function writeRegionActionLog(firebase, user, profile = {}, region = '', action = '', details = {}) {
  try {
    const safeRegion = normalizeRegion(region);
    if (!user?.uid || !safeRegion) return null;
    const { db, firestoreMod } = firebase || await getFirebaseParts();
    const game = gameForRegion(profile || {}, safeRegion) || bestRegionGame(profile || {});
    const actorName = getRegionActorName(profile || {}, safeRegion, user) || user.uid;
    const actorAlliance = normalizeAllianceTag(game?.alliance || '');
    const payload = {
      region: safeRegion,
      action: trim(action),
      actionLabel: actionLabel(action),
      actorUid: user.uid,
      actorName,
      actorAlliance,
      actorRole: roleForRegion(profile || {}, safeRegion, user),
      alliance: normalizeAllianceTag(details.alliance || actorAlliance),
      targetName: trim(details.targetName || ''),
      targetUid: trim(details.targetUid || ''),
      summary: trim(details.summary || ''),
      details: Object.fromEntries(Object.entries(details || {}).filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value).slice(0, 400) : trim(value).slice(0, 400)])),
      createdAt: firestoreMod.serverTimestamp(),
      createdAtMs: Date.now()
    };
    await firestoreMod.addDoc(firestoreMod.collection(db, 'regions', safeRegion, 'actionLogs'), payload);
    return payload;
  } catch (error) {
    console.warn('[WKD] action log skipped:', error);
    return null;
  }
}
export async function listRegionActionLogs(user, regionOverride = '', { limitCount = 120 } = {}) {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const { profile, region } = await getMyRegionContext(user, regionOverride);
  if (!canViewRegion(profile || {}, region, user)) throw new Error('region-access-denied');
  const ref = firestoreMod.collection(db, 'regions', region, 'actionLogs');
  const role = roleForRegion(profile || {}, region, user);
  const ownAlliance = actorAllianceForRegion(profile || {}, region);
  const limitValue = Math.max(20, Math.min(300, Number(limitCount) || 120));
  let q = firestoreMod.query(ref, firestoreMod.orderBy('createdAtMs', 'desc'), firestoreMod.limit(limitValue));
  if (role === 'officer' && ownAlliance) {
    q = firestoreMod.query(ref, firestoreMod.where('alliance', '==', ownAlliance), firestoreMod.orderBy('createdAtMs', 'desc'), firestoreMod.limit(limitValue));
  }
  const snap = await firestoreMod.getDocs(q).catch(async () => {
    if (role === 'officer' && ownAlliance) return firestoreMod.getDocs(firestoreMod.query(ref, firestoreMod.where('alliance', '==', ownAlliance), firestoreMod.limit(limitValue)));
    return firestoreMod.getDocs(firestoreMod.query(ref, firestoreMod.limit(limitValue)));
  });
  const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(row => regionActionVisibleTo(profile || {}, region, user, row))
    .sort((a, b) => (Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0));
  return { profile, region, rows };
}
export async function getSecurityOverview(user) {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  if (!canViewAnyRegion(profile || {}, user)) throw new Error('security-access-denied');
  const regionsSnap = await firestoreMod.getDocs(firestoreMod.collection(db, 'regions')).catch(() => ({ docs: [] }));
  let regions = 0, openForms = 0, oldEmailFields = 0, publicPlanLinks = 0;
  regionsSnap.docs.forEach(doc => {
    regions += 1;
    const data = doc.data() || {};
    const form = data.registrationForm || {};
    if (form.enabled) openForms += 1;
    if (data.openedByEmail || data.updatedByEmail || data.registrationOpenedByEmail || form.openedByEmail || form.updatedByEmail) oldEmailFields += 1;
  });
  const sharesSnap = await firestoreMod.getDocs(firestoreMod.collection(db, 'finalPlanShares')).catch(() => ({ docs: [] }));
  trackReads(Math.max(1, sharesSnap.docs.length));
  publicPlanLinks = sharesSnap.docs.length;
  return { profile, regions, openForms, oldEmailFields, publicPlanLinks };
}


export async function cleanupOldEmailFields(user) {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  if (!canViewAnyRegion(profile || {}, user)) throw new Error('security-access-denied');
  const regionsSnap = await firestoreMod.getDocs(firestoreMod.collection(db, 'regions')).catch(() => ({ docs: [] }));
  let cleaned = 0;
  for (const docSnap of regionsSnap.docs) {
    const data = docSnap.data() || {};
    const form = data.registrationForm || {};
    if (!(data.openedByEmail || data.updatedByEmail || data.registrationOpenedByEmail || form.openedByEmail || form.updatedByEmail)) continue;
    await firestoreMod.updateDoc(docSnap.ref, {
      openedByEmail: firestoreMod.deleteField(),
      updatedByEmail: firestoreMod.deleteField(),
      registrationOpenedByEmail: firestoreMod.deleteField(),
      'registrationForm.openedByEmail': firestoreMod.deleteField(),
      'registrationForm.updatedByEmail': firestoreMod.deleteField(),
      'registrationForm.startedByEmail': firestoreMod.deleteField(),
      'registrationForm.closedByEmail': firestoreMod.deleteField()
    }).catch(() => null);
    cleaned += 1;
  }
  return { cleaned };
}

async function saveRegionShareLink({ db, firestoreMod }, user, region, settings, forceNew = false) {
  const safeRegion = normalizeRegion(region);
  const privateRef = firestoreMod.doc(db, 'regions', safeRegion, 'privateSettings', 'shortLink');
  const privateSnap = await firestoreMod.getDoc(privateRef).catch(() => null);
  const oldCode = normalizeShortLinkCode(privateSnap?.exists?.() ? privateSnap.data()?.code : '');
  const code = forceNew || !oldCode ? makeShortLinkCode() : oldCode;
  const now = firestoreMod.serverTimestamp();

  if (oldCode && oldCode !== code) {
    await firestoreMod.deleteDoc(firestoreMod.doc(db, 'shortRegionLinks', oldCode)).catch(() => null);
  }

  const payload = {
    code,
    region: safeRegion,
    cycleId: settings.currentCycleId,
    eventStartAtMs: settings.eventStartAtMs,
    closeAtMs: settings.closeAtMs,
    updatedAt: now,
    updatedBy: user.uid
  };

  await firestoreMod.setDoc(firestoreMod.doc(db, 'shortRegionLinks', code), payload);
  await firestoreMod.setDoc(privateRef, { ...payload, createdAt: privateSnap?.exists?.() ? (privateSnap.data()?.createdAt || now) : now }, { merge: true });
  return code;
}

export async function getRegionShareLinkCode(user, region) {
  if (!user) throw new Error('auth-required');
  const firebase = await getFirebaseParts();
  const { db, firestoreMod } = firebase;
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region);
  if (!canManageRegion(profile, safeRegion, user)) throw new Error('region-access-denied');
  const privateRef = firestoreMod.doc(db, 'regions', safeRegion, 'privateSettings', 'shortLink');
  const snap = await firestoreMod.getDoc(privateRef).catch(() => null);
  const code = normalizeShortLinkCode(snap?.exists?.() ? snap.data()?.code : '');
  if (code) return code;
  const settings = await getRegionSettings(safeRegion);
  return saveRegionShareLink(firebase, user, safeRegion, settings, false);
}

export async function resolveRegionShareLink(codeValue) {
  const { db, firestoreMod } = await getFirebaseParts();
  const code = normalizeShortLinkCode(codeValue);
  if (!code) throw new Error('short-link-required');
  const snap = await firestoreMod.getDoc(firestoreMod.doc(db, 'shortRegionLinks', code));
  if (!snap.exists()) throw new Error('short-link-not-found');
  const data = snap.data() || {};
  const region = normalizeRegion(data.region);
  if (!region) throw new Error('short-link-region-missing');
  const settings = await getRegionSettings(region);
  if (data.cycleId && settings.currentCycleId && data.cycleId !== settings.currentCycleId) {
    throw new Error('short-link-expired');
  }
  return { code, region, settings };
}

async function saveRegionFinalPlanShareLink({ db, firestoreMod }, user, region, settings, forceNew = false) {
  const safeRegion = normalizeRegion(region);
  const privateRef = firestoreMod.doc(db, 'regions', safeRegion, 'privateSettings', 'finalPlanShare');
  const privateSnap = await firestoreMod.getDoc(privateRef).catch(() => null);
  const oldCode = normalizeShortLinkCode(privateSnap?.exists?.() ? privateSnap.data()?.code : '');
  const code = forceNew || !oldCode ? makeShortLinkCode() : oldCode;
  const now = firestoreMod.serverTimestamp();
  if (oldCode && oldCode !== code) {
    await firestoreMod.deleteDoc(firestoreMod.doc(db, 'finalPlanShares', oldCode)).catch(() => null);
  }
  await firestoreMod.setDoc(privateRef, {
    code,
    region: safeRegion,
    cycleId: settings.currentCycleId || '',
    eventStartAtMs: Number(settings.eventStartAtMs) || 0,
    updatedAt: now,
    updatedBy: user.uid
  }, { merge: true });
  return code;
}

export async function shareRegionFinalPlan(user, region, payload = {}) {
  if (!user) throw new Error('auth-required');
  const firebase = await getFirebaseParts();
  const { db, firestoreMod } = firebase;
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region);
  if (!safeRegion) throw new Error('region-required');
  const settings = await getRegionSettings(safeRegion);
  if (!canEditRegionTowerPlan(profile, safeRegion, user, settings)) throw new Error('region-plan-access-denied');
  const code = await saveRegionFinalPlanShareLink(firebase, user, safeRegion, settings, false);
  const cleanHtml = trim(payload.html).slice(0, 700000);
  const cleanText = trim(payload.text).slice(0, 50000);
  await writeRegionActionLog(firebase, user, profile, safeRegion, 'final_plan_shared', { summary: 'Створено секретне посилання фінального плану', shift: trim(payload.shift || '') });
  await firestoreMod.setDoc(firestoreMod.doc(db, 'finalPlanShares', code), {
    code,
    region: safeRegion,
    cycleId: settings.currentCycleId || '',
    eventStartAtMs: Number(settings.eventStartAtMs) || 0,
    html: cleanHtml,
    text: cleanText,
    title: trim(payload.title || 'Final plan').slice(0, 120),
    shift: trim(payload.shift || '').slice(0, 40),
    updatedAt: firestoreMod.serverTimestamp(),
    updatedAtMs: Date.now(),
    updatedBy: user.uid,
    updatedByName: getRegionActorName(profile || {}, safeRegion, user)
  }, { merge: true });
  trackWrites(1);
  return { code, region: safeRegion };
}

export async function resolveRegionFinalPlanShare(codeValue) {
  const { db, firestoreMod } = await getFirebaseParts();
  const code = normalizeShortLinkCode(codeValue);
  if (!code) throw new Error('final-plan-link-required');
  const snap = await firestoreMod.getDoc(firestoreMod.doc(db, 'finalPlanShares', code));
  trackReads(1);
  if (!snap.exists()) throw new Error('final-plan-link-not-found');
  return { code, ...(snap.data() || {}) };
}


function sanitizeRegionTableRow(row = {}) {
  return {
    nickname: trim(row.nickname).slice(0, 80),
    region: normalizeRegion(row.region),
    alliance: normalizeAllianceTag(row.alliance),
    troopType: trim(row.troopType).slice(0, 40),
    troopLabel: trim(row.troopLabel).slice(0, 80),
    tier: trim(row.tier).toUpperCase().slice(0, 8),
    marchSize: numberValue(row.marchSize),
    rallySize: numberValue(row.rallySize),
    captainReady: Boolean(row.captainReady),
    shift: trim(row.shift).slice(0, 40),
    shiftLabel: trim(row.shiftLabel).slice(0, 80)
  };
}

export async function shareRegionTable(user, region) {
  if (!user) throw new Error('auth-required');
  const firebase = await getFirebaseParts();
  const { db, firestoreMod } = firebase;
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region || getGameProfile(profile || {}).region);
  if (!safeRegion) throw new Error('region-required');
  if (!canManageRegion(profile, safeRegion, user)) throw new Error('region-table-share-denied');
  const result = await listRegionRegistrations(user, safeRegion, { force: true });
  const code = makeShortLinkCode();
  const settings = result.settings || {};
  const rows = (result.rows || []).map(sanitizeRegionTableRow).filter(row => row.nickname).slice(0, 800);
  await firestoreMod.setDoc(firestoreMod.doc(db, 'regionTableShares', code), {
    code,
    region: safeRegion,
    cycleId: settings.currentCycleId || '',
    eventStartAtMs: Number(settings.eventStartAtMs) || 0,
    closeAtMs: Number(settings.closeAtMs) || 0,
    open: Boolean(settings.open),
    rows,
    createdAt: firestoreMod.serverTimestamp(),
    createdAtMs: Date.now(),
    createdBy: user.uid,
    createdByName: getRegionActorName(profile || {}, safeRegion, user)
  });
  trackWrites(1);
  await writeRegionActionLog(firebase, user, profile, safeRegion, 'region_table_shared', { summary: serviceT('actionLog.regionTableShared', 'Створено секретне посилання таблиці регіону') }).catch(() => null);
  return { code, region: safeRegion };
}

export async function resolveRegionTableShare(codeValue) {
  const { db, firestoreMod } = await getFirebaseParts();
  const code = normalizeShortLinkCode(codeValue);
  if (!code) throw new Error('region-table-link-required');
  const snap = await firestoreMod.getDoc(firestoreMod.doc(db, 'regionTableShares', code));
  trackReads(1);
  if (!snap.exists()) throw new Error('region-table-link-not-found');
  const data = snap.data() || {};
  const region = normalizeRegion(data.region);
  if (region && data.cycleId) {
    const regionSnap = await firestoreMod.getDoc(firestoreMod.doc(db, 'regions', region)).catch(() => null);
    const activeCycle = regionSnap?.exists?.() ? String(regionSnap.data()?.registrationForm?.currentCycleId || regionSnap.data()?.currentCycleId || '') : '';
    if (activeCycle && activeCycle !== String(data.cycleId || '')) throw new Error('region-table-link-expired');
  }
  return { code, ...data };
}


function cycleIdToMs(cycleId = '') {
  const match = String(cycleId || '').match(/wasteland-(\d{10,})/);
  return match ? Number(match[1]) || 0 : 0;
}

function registrationSavedAtMs(data = {}) {
  return timestampToMs(data.submittedAt)
    || timestampToMs(data.updatedAt)
    || timestampToMs(data.createdAt)
    || Number(data.submittedAtMs)
    || Number(data.updatedAtMs)
    || cycleIdToMs(data.cycleId);
}

export async function cleanupOldRegionRegistrations(user, regionOverride = '', options = {}) {
  if (!user) return { region: normalizeRegion(regionOverride), deletedCount: 0, skipped: 'auth-required' };
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(regionOverride || getGameProfile(profile || {}).region);
  if (!safeRegion) throw new Error('region-required');
  if (!canManageRegion(profile, safeRegion, user)) return { region: safeRegion, deletedCount: 0, skipped: 'region-access-denied' };

  const retentionMs = Math.max(DAY_MS, Number(options.retentionMs) || REGION_REGISTRATION_RETENTION_MS);
  const cutoffMs = Date.now() - retentionMs;
  const collectionRef = firestoreMod.collection(db, 'regions', safeRegion, 'wastelandRegistrations');
  const snap = await firestoreMod.getDocs(collectionRef).catch(() => ({ docs: [] }));
  const expiredIds = snap.docs
    .filter(doc => {
      const data = doc.data() || {};
      const savedAtMs = registrationSavedAtMs(data);
      return savedAtMs > 0 && savedAtMs < cutoffMs;
    })
    .map(doc => doc.id);

  for (let index = 0; index < expiredIds.length; index += 450) {
    const batch = firestoreMod.writeBatch(db);
    expiredIds.slice(index, index + 450).forEach(id => {
      batch.delete(firestoreMod.doc(db, 'regions', safeRegion, 'wastelandRegistrations', id));
    });
    await batch.commit();
  }
  trackDeletes(expiredIds.length);

  if (expiredIds.length) {
    await firestoreMod.setDoc(firestoreMod.doc(db, 'regions', safeRegion), {
      region: safeRegion,
      registrationRetentionDays: REGION_REGISTRATION_RETENTION_DAYS,
      oldRegistrationsDeletedAt: firestoreMod.serverTimestamp(),
      oldRegistrationsDeletedBy: user.uid,
      oldRegistrationsDeletedCount: expiredIds.length,
      updatedAt: firestoreMod.serverTimestamp(),
      updatedBy: user.uid
    }, { merge: true }).catch(() => null);
  }

  return { region: safeRegion, deletedCount: expiredIds.length, retentionDays: REGION_REGISTRATION_RETENTION_DAYS };
}


export async function cleanupOldPublicDocuments(user, options = {}) {
  if (!user) return { deletedCount: 0, skipped: 'auth-required' };
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  if (!(isOwnerEmail(user.email) || ['admin', 'moderator'].includes(normalizeUserRole(profile?.role || 'player')))) {
    return { deletedCount: 0, skipped: 'admin-required' };
  }
  const retentionDays = Math.max(30, Math.min(180, Number(options.retentionDays) || 45));
  const maxDeletes = Math.max(5, Math.min(100, Number(options.maxDeletes) || 40));
  const cutoffMs = Date.now() - retentionDays * DAY_MS;
  let deletedCount = 0;
  const deleteOldFrom = async (collectionName, timeFields = ['createdAtMs', 'updatedAtMs']) => {
    if (deletedCount >= maxDeletes) return;
    const snap = await firestoreMod.getDocs(firestoreMod.query(firestoreMod.collection(db, collectionName), firestoreMod.limit(120))).catch(() => ({ docs: [] }));
    trackReads(Math.max(1, snap.docs.length));
    for (const docSnap of snap.docs) {
      if (deletedCount >= maxDeletes) break;
      const data = docSnap.data() || {};
      const savedAtMs = timeFields.map(field => Number(data[field]) || timestampToMs(data[field])).find(ms => ms > 0) || 0;
      const region = normalizeRegion(data.region || '');
      if (!savedAtMs || savedAtMs >= cutoffMs || !region || !canManageRegion(profile, region, user)) continue;
      await firestoreMod.deleteDoc(docSnap.ref).catch(() => null);
      deletedCount += 1;
    }
  };
  await deleteOldFrom('regionTableShares', ['createdAtMs', 'createdAt', 'updatedAtMs', 'updatedAt']);
  await deleteOldFrom('finalPlanShares', ['updatedAtMs', 'updatedAt', 'createdAtMs', 'createdAt']);
  trackDeletes(deletedCount);
  return { deletedCount, retentionDays };
}


export async function ensureRegionRegistrationRunInfo(user, regionOverride = '') {
  if (!user) return null;
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(regionOverride || getGameProfile(profile || {}).region);
  if (!safeRegion || !canManageRegion(profile, safeRegion, user)) return null;
  const current = await getRegionSettings(safeRegion).catch(() => null);
  if (!current?.enabled) return current;
  const status = getRegionFormStatus(current);
  const hasRunTime = Number(status.openedAtMs) > 0;
  const hasRunActor = Boolean(trim(status.openedByName || status.openedByEmail || status.openedByUid));
  if (hasRunTime && hasRunActor && Number(status.eventStartAtMs) > 0) return status;

  const nowMs = Date.now();
  const actorName = getRegionActorName(profile || {}, safeRegion, user);
  const actorEmail = ''; // do not expose account email in public region documents
  const openedAtMs = Number(status.openedAtMs) || Number(status.openAtMs) || Number(status.updatedAtMs) || nowMs;
  const eventStartAtMs = Number(status.eventStartAtMs || status.startAtMs) || getNextWastelandStart(nowMs);
  const closeAtMs = Number(status.closeAtMs) || computeCloseAtMs(eventStartAtMs, status.closeRule, status.closeHours);
  const openAtMs = Number(status.openAtMs) || (status.autoOpenEnabled ? computeOpenAtMs(eventStartAtMs, status.autoOpenEnabled, status.autoOpenDay, status.autoOpenTime) : Math.max(0, openedAtMs - 1000));
  const patch = {
    region: safeRegion,
    registrationForm: {
      ...(current || {}),
      enabled: true,
      eventStartAtMs,
      startAtMs: eventStartAtMs,
      closeAtMs,
      openAtMs,
      openedAtMs,
      openedByUid: status.openedByUid || user.uid,
      openedByName: status.openedByName || actorName,
      openedByEmail: status.openedByEmail || actorEmail,
      updatedAtMs: nowMs,
      updatedBy: user.uid,
      updatedByName: actorName,
      updatedByEmail: actorEmail
    },
    openedAtMs,
    openedByUid: status.openedByUid || user.uid,
    openedByName: status.openedByName || actorName,
    openedByEmail: status.openedByEmail || actorEmail,
    registrationOpenedAtMs: openedAtMs,
    registrationOpenedByUid: status.openedByUid || user.uid,
    registrationOpenedByName: status.openedByName || actorName,
    registrationOpenedByEmail: status.openedByEmail || actorEmail,
    updatedAtMs: nowMs,
    updatedBy: user.uid,
    updatedByName: actorName,
    updatedByEmail: actorEmail
  };
  await firestoreMod.setDoc(firestoreMod.doc(db, 'regions', safeRegion), patch, { merge: true }).catch(error => {
    console.warn('[WKD] registration run info repair skipped:', error);
  });
  return getRegionSettings(safeRegion).then(getRegionFormStatus).catch(() => status);
}

export async function saveRegionSettings(user, region, settings) {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region);
  if (!canManageRegion(profile, safeRegion, user)) throw new Error('region-access-denied');

  const oldSettings = await getRegionSettings(safeRegion).catch(() => mergeRegionSettings({}));
  const actionSettings = { ...oldSettings, ...settings };
  if ((settings.forceOpenNow || settings.forceCloseNow || 'enabled' in settings || settings.openNewCycle) && !canOpenCloseRegion(profile, safeRegion, user, actionSettings)) throw new Error('region-open-close-denied');
  const forceOpenNow = Boolean(settings.forceOpenNow);
  const forceCloseNow = Boolean(settings.forceCloseNow);
  const nowMs = Date.now();
  let eventStartAtMs = Number(settings.eventStartAtMs) || getNextWastelandStart();
  if (forceOpenNow && eventStartAtMs <= nowMs) eventStartAtMs = getNextWastelandStart(nowMs);
  const closeRule = settings.closeRule || DEFAULT_REGION_FORM.closeRule;
  const closeHours = Math.max(1, Math.min(168, Number(settings.closeHours) || DEFAULT_REGION_FORM.closeHours));
  let closeAtMs = computeCloseAtMs(eventStartAtMs, closeRule, closeHours);
  if (forceOpenNow && closeAtMs <= nowMs) {
    closeAtMs = eventStartAtMs > nowMs + 60 * 1000
      ? Math.min(eventStartAtMs - 60 * 1000, nowMs + DAY_MS)
      : nowMs + DAY_MS;
  }
  if (forceCloseNow) closeAtMs = nowMs;
  const autoOpenEnabled = (forceOpenNow || forceCloseNow) ? false : ('autoOpenEnabled' in settings ? Boolean(settings.autoOpenEnabled) : DEFAULT_REGION_FORM.autoOpenEnabled);
  const autoOpenDay = Math.max(0, Math.min(6, Number(settings.autoOpenDay ?? DEFAULT_REGION_FORM.autoOpenDay)));
  const autoOpenTime = /^\d{2}:\d{2}$/.test(trim(settings.autoOpenTime)) ? trim(settings.autoOpenTime) : DEFAULT_REGION_FORM.autoOpenTime;
  const openAtMs = forceCloseNow ? 0 : (forceOpenNow ? Math.max(0, nowMs - 1000) : computeOpenAtMs(eventStartAtMs, autoOpenEnabled, autoOpenDay, autoOpenTime));
  const rotationAlliances = normalizeRotationAlliances(settings.rotationAlliances);
  const rotationActiveIndex = Math.max(0, Math.min(Math.max(0, rotationAlliances.length - 1), Number(settings.rotationActiveIndex) || 0));
  const enabledNow = forceCloseNow ? false : (forceOpenNow ? true : Boolean(settings.enabled));
  const justOpened = forceOpenNow || Boolean(settings.openNewCycle) || (!oldSettings.enabled && enabledNow);
  const openNewCycle = !forceCloseNow && (Boolean(settings.openNewCycle) || (!oldSettings.enabled && enabledNow));
  const baseCycleId = makeCycleId(eventStartAtMs);
  const currentCycleId = openNewCycle ? `${baseCycleId}-${Date.now()}` : (oldSettings.currentCycleId || baseCycleId);
  const now = firestoreMod.serverTimestamp();
  const actorName = getRegionActorName(profile || {}, safeRegion, user);
  const actorEmail = ''; // do not expose account email in public region documents

  const clean = {
    enabled: enabledNow,
    title: trim(settings.title) || DEFAULT_REGION_FORM.title,
    description: trim(settings.description) || DEFAULT_REGION_FORM.description,
    hostAlliance: (Boolean(settings.rotationEnabled) && rotationAlliances[rotationActiveIndex]) ? rotationAlliances[rotationActiveIndex].tag : trim(settings.hostAlliance),
    governor: trim(settings.governor),
    customShifts: normalizeCustomShifts(settings.customShifts),
    shifts: normalizeShiftValues(settings.shifts, normalizeCustomShifts(settings.customShifts)),
    requireCaptain: false,
    allowExtraTroop: Boolean(settings.allowExtraTroop),
    minTier: normalizeTier(settings.minTier || DEFAULT_REGION_FORM.minTier),
    customTroopTypes: normalizeCustomTroops(settings.customTroopTypes),
    customFields: normalizeCustomFields(settings.customFields),
    closeRule,
    closeHours,
    autoOpenEnabled,
    autoOpenDay,
    autoOpenTime,
    openAtMs,
    rotationEnabled: Boolean(settings.rotationEnabled),
    rotationLoop: 'rotationLoop' in settings ? Boolean(settings.rotationLoop) : DEFAULT_REGION_FORM.rotationLoop,
    rotationActiveIndex,
    rotationAlliances,
    eventStartAtMs,
    startAtMs: eventStartAtMs,
    closeAtMs,
    currentCycleId,
    openedAtMs: forceCloseNow ? firstPositiveMs(oldSettings.openedAtMs, oldSettings.openedAt) : (justOpened ? nowMs : (firstPositiveMs(oldSettings.openedAtMs, oldSettings.openedAt) || (enabledNow ? Number(oldSettings.openAtMs) || nowMs : 0))),
    openedAt: forceCloseNow ? (oldSettings.openedAt || null) : (justOpened ? now : (oldSettings.openedAt || null)),
    openedByUid: forceCloseNow ? trim(oldSettings.openedByUid) : (justOpened ? user.uid : (oldSettings.openedByUid || (enabledNow ? user.uid : ''))),
    openedByName: forceCloseNow ? trim(oldSettings.openedByName || oldSettings.openedByEmail) : (justOpened ? actorName : trim(oldSettings.openedByName || oldSettings.openedByEmail || (enabledNow ? actorName : ''))),
    openedByEmail: forceCloseNow ? trim(oldSettings.openedByEmail) : (justOpened ? actorEmail : trim(oldSettings.openedByEmail || (enabledNow ? actorEmail : ''))),
    closedAtMs: forceCloseNow ? nowMs : (enabledNow ? 0 : firstPositiveMs(oldSettings.closedAtMs, oldSettings.closedAt)),
    closedAt: forceCloseNow ? now : (enabledNow ? null : (oldSettings.closedAt || null)),
    closedByUid: forceCloseNow ? user.uid : (enabledNow ? '' : (oldSettings.closedByUid || '')),
    closedByName: forceCloseNow ? actorName : (enabledNow ? '' : trim(oldSettings.closedByName || oldSettings.closedByEmail || '')),
    closedByEmail: forceCloseNow ? actorEmail : (enabledNow ? '' : trim(oldSettings.closedByEmail || '')),
    updatedAt: now,
    updatedAtMs: nowMs,
    updatedBy: user.uid,
    updatedByName: actorName,
    updatedByEmail: actorEmail
  };

  const regionPatch = {
    region: safeRegion,
    registrationForm: clean,
    updatedAt: clean.updatedAt,
    updatedBy: user.uid,
    updatedAtMs: nowMs,
    updatedByName: actorName,
    updatedByEmail: actorEmail,
    openedAtMs: clean.openedAtMs || 0,
    openedAt: clean.openedAt || null,
    openedByUid: clean.openedByUid || '',
    openedByName: clean.openedByName || '',
    openedByEmail: clean.openedByEmail || '',
    registrationOpenedAtMs: clean.openedAtMs || 0,
    registrationOpenedAt: clean.openedAt || null,
    registrationOpenedByUid: clean.openedByUid || '',
    registrationOpenedByName: clean.openedByName || '',
    registrationOpenedByEmail: clean.openedByEmail || '',
    registrationClosedAtMs: clean.closedAtMs || 0,
    registrationClosedAt: clean.closedAt || null,
    registrationClosedByUid: clean.closedByUid || '',
    registrationClosedByName: clean.closedByName || '',
    registrationClosedByEmail: clean.closedByEmail || ''
  };
  if (openNewCycle) {
    regionPatch.activeTable = {
      cycleId: currentCycleId,
      source: 'new-cycle',
      rowsCount: 0,
      replacedAt: clean.updatedAt,
      replacedBy: user.uid
    };
  }

  await firestoreMod.setDoc(firestoreMod.doc(db, 'regions', safeRegion), regionPatch, { merge: true });
  await writeRegionActionLog({ db, firestoreMod }, user, profile, safeRegion, forceCloseNow ? 'registration_closed' : (forceOpenNow || openNewCycle ? 'registration_started' : 'registration_settings_saved'), { summary: clean.enabled ? 'Форма відкрита' : 'Форма закрита', alliance: clean.hostAlliance || '' });

  if (openNewCycle) {
    await firestoreMod.setDoc(
      firestoreMod.doc(db, 'regions', safeRegion, 'wastelandTowerPlans', 'current'),
      {
        region: safeRegion,
        plan: null,
        updatedAt: firestoreMod.serverTimestamp(),
        updatedAtMs: Date.now(),
        updatedBy: user.uid,
        resetReason: 'registration-form-opened'
      },
      { merge: true }
    ).catch(error => console.warn('[WKD] tower plan reset skipped:', error));
  }

  const cleanup = await cleanupOldRegionRegistrations(user, safeRegion).catch(error => {
    console.warn('[WKD] old registration cleanup skipped:', error);
    return { deletedCount: 0 };
  });
  const shortLinkCode = await saveRegionShareLink({ db, firestoreMod }, user, safeRegion, clean, openNewCycle);
  const finalPlanShareCode = await saveRegionFinalPlanShareLink({ db, firestoreMod }, user, safeRegion, clean, openNewCycle).catch(error => {
    console.warn('[WKD] final plan share code skipped:', error);
    return '';
  });
  return { ...clean, shortLinkCode, finalPlanShareCode, openedNewCycle: openNewCycle, cleanupDeletedCount: cleanup.deletedCount || 0 };
}


function normalizeAllianceTag(value = '') {
  return Array.from(trim(value).replace(/[\/\[\]#?]/g, '')).slice(0, 3).join('');
}

export async function listRegionAlliances(region) {
  const { db, firestoreMod } = await getFirebaseParts();
  const safeRegion = normalizeRegion(region);
  if (!safeRegion) throw new Error('region-required');
  const snapshot = await firestoreMod.getDocs(firestoreMod.collection(db, 'regions', safeRegion, 'alliances'));
  const seen = new Map();
  snapshot.docs.forEach(doc => {
    const data = { id: doc.id, ...doc.data() };
    const key = normalizeAllianceTag(data.tag || doc.id);
    if (!key) return;
    if (!seen.has(key)) seen.set(key, { ...data, id: key, tag: key });
    else {
      const current = seen.get(key);
      seen.set(key, { ...data, ...current, id: key, tag: key, name: current.name || data.name || key });
    }
  });
  return [...seen.values()].sort((a, b) => String(a.tag || a.id).localeCompare(String(b.tag || b.id), 'uk'));
}


export function canManageAllianceColors(profile = {}, region = '', tag = '', actor = null) {
  const safeRegion = normalizeRegion(region);
  const role = roleForRegion(profile, safeRegion, actor);
  const game = gameForRegion(profile || {}, safeRegion) || bestRegionGame(profile || {});
  const wanted = normalizeAllianceTag(tag);
  if (role === 'admin' || role === 'moderator') return true;
  if (role === 'consul' && canViewRegion(profile, safeRegion, actor)) return true;
  const rank = trim(game.rank).toLowerCase();
  if (role === 'officer' && canViewRegion(profile, safeRegion, actor) && normalizeAllianceTag(game.alliance) === wanted && ['p4', 'p5', 'r4', 'r5', '4', '5'].includes(rank)) return true;
  return false;
}

export async function saveRegionAllianceColor(user, region, tagValue, hueValue = null) {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region);
  const tag = normalizeAllianceTag(tagValue);
  if (!safeRegion || !tag || Array.from(tag).length !== 3) throw new Error('alliance-color-required');
  if (!canManageAllianceColors(profile, safeRegion, tag, user)) throw new Error('alliance-color-access');
  const hueNumber = Number(hueValue);
  const hue = Number.isFinite(hueNumber) ? ((Math.round(hueNumber) % 360) + 360) % 360 : null;
  const patch = hue === null
    ? { tag, colorHue: null, colorMode: 'auto', colorUpdatedAt: firestoreMod.serverTimestamp(), colorUpdatedBy: user.uid }
    : { tag, colorHue: hue, colorMode: 'manual', colorUpdatedAt: firestoreMod.serverTimestamp(), colorUpdatedBy: user.uid };
  await firestoreMod.setDoc(firestoreMod.doc(db, 'regions', safeRegion, 'alliances', tag), patch, { merge: true });
  return { id: tag, ...patch, colorHue: hue };
}

export async function saveRegionAlliance(user, region, values = {}) {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region);
  const tag = normalizeAllianceTag(values.tag || values.id);
  if (!tag || Array.from(tag).length !== 3) throw new Error('alliance-tag-required');
  if (!canManageAllianceColors(profile, safeRegion, tag, user)) throw new Error('region-access-denied');
  const ref = firestoreMod.doc(db, 'regions', safeRegion, 'alliances', tag);
  const old = await firestoreMod.getDoc(ref);
  const now = firestoreMod.serverTimestamp();
  const clean = {
    tag,
    name: trim(values.name || tag),
    note: trim(values.note),
    updatedAt: now,
    updatedBy: user.uid
  };
  if ('colorHue' in values) {
    if (values.colorHue === null || values.colorHue === '' || values.colorHue === undefined) {
      clean.colorHue = null;
    } else {
      const hue = Number(values.colorHue);
      clean.colorHue = Number.isFinite(hue) ? ((Math.round(hue) % 360) + 360) % 360 : null;
    }
    clean.colorMode = clean.colorHue === null ? 'auto' : 'manual';
    clean.colorUpdatedAt = now;
    clean.colorUpdatedBy = user.uid;
  }
  if (!old.exists()) clean.createdAt = now;
  await firestoreMod.setDoc(ref, clean, { merge: true });
  await writeRegionActionLog({ db, firestoreMod }, user, profile, safeRegion, 'alliance_saved', { alliance: tag, summary: clean.name || tag });
  return { id: tag, ...clean };
}

export async function deleteRegionAlliance(user, region, allianceId) {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region);
  const tag = normalizeAllianceTag(allianceId);
  if (!tag) throw new Error('alliance-tag-required');
  if (!canManageAllianceColors(profile, safeRegion, tag, user)) throw new Error('region-access-denied');
  await firestoreMod.deleteDoc(firestoreMod.doc(db, 'regions', safeRegion, 'alliances', tag));
  await writeRegionActionLog({ db, firestoreMod }, user, profile, safeRegion, 'alliance_deleted', { alliance: tag, summary: tag });
}

function numberValue(value) {
  return Number(String(value || '').replace(/[^0-9]/g, '')) || 0;
}

function lairLevelValue(value) {
  const n = numberValue(value);
  return n ? Math.max(1, Math.min(70, n)) : 0;
}

function normalizeExtraSquads(values = {}, settings = {}) {
  const allowedTroops = new Set(['fighter', 'rider', 'shooter', ...normalizeCustomTroops(settings.customTroopTypes).map(item => item.id)]);
  const allowedTiers = new Set(getAllowedTiers(settings));
  const source = Array.isArray(values.extraSquads)
    ? values.extraSquads
    : (values.extraEnabled && values.extraTroopType && values.extraTier ? [{ troopType: values.extraTroopType, tier: values.extraTier }] : []);
  const seen = new Set();
  return source
    .map(item => ({
      troopType: trim(item?.troopType),
      troopLabel: troopLabel(trim(item?.troopType), settings),
      tier: trim(item?.tier || 'T10').toUpperCase()
    }))
    .filter(item => item.troopType && item.tier && !seen.has(item.troopType) && seen.add(item.troopType))
    .filter(item => allowedTroops.has(item.troopType) && allowedTiers.has(item.tier));
}

function normalizeRegistration(values = {}, user = null, profile = {}, region = '', settings = {}) {
  const farmId = trim(values.farmId || 'main') || 'main';
  const game = getFarmById(profile || {}, farmId) || getGameProfile(profile || {});
  const shift = trim(values.shift || '');
  const extraSquads = normalizeExtraSquads(values, settings);
  const firstExtra = extraSquads[0] || {};
  const extraEnabled = Boolean(extraSquads.length);
  const publicLink = Boolean(values.publicLink);
  const role = normalizeUserRole(profile?.role || 'player');
  const status = getRegionFormStatus(settings);

  return {
    uid: user?.uid || '',
    farmId,
    ownerUid: user?.uid || '',
    displayName: user?.displayName || profile?.displayName || '',
    photoURL: user?.photoURL || profile?.photoURL || '',
    nickname: trim(values.nickname || game.nickname),
    region: normalizeRegion(region || values.region || game.region),
    alliance: normalizeAllianceTag(values.alliance || game.alliance),
    rank: trim(values.rank || game.rank).toLowerCase(),
    shk: trim(values.shk || game.shk),
    readyToJoin: values.readyToJoin !== false,
    readyToAttack: Boolean(values.readyToAttack),
    captainReady: Boolean(values.captainReady),
    shift,
    shiftLabel: shiftLabel(shift, status),
    troopType: trim(values.troopType),
    troopLabel: troopLabel(values.troopType, status),
    tier: trim(values.tier || 'T10').toUpperCase(),
    lairLevel: lairLevelValue(values.lairLevel),
    marchSize: numberValue(values.marchSize),
    rallySize: numberValue(values.rallySize),
    comment: trim(values.comment),
    extraEnabled,
    extraSquads,
    extraTroopType: firstExtra.troopType || '',
    extraTroopLabel: firstExtra.troopLabel || '',
    extraTier: firstExtra.tier || '',
    extraMarchSize: 0,
    customFields: Object.fromEntries(Object.entries(values.customFields || {}).map(([key, value]) => [makeCustomId(key), typeof value === 'boolean' ? value : trim(value)])),
    role,
    roleLabel: roleLabel(role),
    profileUpdatedAt: profile?.updatedAt || null,
    publicLink,
    createdByAuth: Boolean(user?.uid),
    source: publicLink && !user?.uid ? 'public-link' : 'account',
    cycleId: status.currentCycleId,
    eventStartAtMs: status.eventStartAtMs,
    closeAtMs: status.closeAtMs
  };
}

function validateRegistration(data = {}, settings = {}) {
  const allowedTroops = ['fighter', 'rider', 'shooter', ...normalizeCustomTroops(settings.customTroopTypes).map(item => item.id)];
  if (!data.region || !data.nickname || !data.alliance || !data.shift || !data.troopType || !data.tier) {
    throw new Error('registration-invalid');
  }
  const allowedShifts = normalizeShiftValues(settings.shifts, normalizeCustomShifts(settings.customShifts));
  if (!allowedTroops.includes(data.troopType)) throw new Error('registration-invalid-troop');
  if (!allowedShifts.includes(data.shift)) throw new Error('registration-invalid-shift');
  if (!getAllowedTiers(settings).includes(data.tier)) throw new Error('registration-invalid-tier');
  if (data.extraEnabled) {
    if (!Array.isArray(data.extraSquads) || !data.extraSquads.length) throw new Error('registration-invalid-extra-troop');
    data.extraSquads.forEach(item => {
      if (!allowedTroops.includes(item.troopType)) throw new Error('registration-invalid-extra-troop');
      if (!getAllowedTiers(settings).includes(item.tier)) throw new Error('registration-invalid-extra-tier');
    });
  }
}

async function assertRegionNicknameFree(firestoreMod, db, region, data = {}, currentDocIds = []) {
  const nick = trim(data.nickname).toLowerCase();
  if (!nick || !data.cycleId) return;
  const collectionRef = firestoreMod.collection(db, 'regions', region, 'wastelandRegistrations');
  const q = firestoreMod.query(collectionRef, firestoreMod.where('cycleId', '==', data.cycleId));
  const snap = await firestoreMod.getDocs(q).catch(() => null);
  if (!snap) return;
  trackReads(Math.max(1, snap.docs.length));
  const ownIds = new Set((Array.isArray(currentDocIds) ? currentDocIds : [currentDocIds]).filter(Boolean));
  const duplicate = snap.docs.find(doc => {
    if (ownIds.has(doc.id)) return false;
    const row = doc.data() || {};
    return trim(row.nickname).toLowerCase() === nick && normalizeRegion(row.region) === region;
  });
  if (duplicate) throw new Error('registration-nickname-duplicate-region');
}

function safeDocPart(value = '') {
  return trim(value).replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'default';
}

function legacyUserRegistrationDocId(userId = '', farmId = 'main') {
  const safeUser = safeDocPart(userId);
  const safeFarm = safeDocPart(farmId || 'main');
  return safeFarm && safeFarm !== 'main' ? `${safeUser}_${safeFarm}` : safeUser;
}

function userRegistrationDocId(userId = '', farmId = 'main', cycleId = '') {
  const base = legacyUserRegistrationDocId(userId, farmId);
  const cycle = safeDocPart(cycleId || 'cycle');
  return `${base}_${cycle}`.slice(0, 180);
}

export async function saveWastelandRegistration(user, values, regionOverride = '') {
  const { db, firestoreMod } = await getFirebaseParts();
  const safeRegion = normalizeRegion(regionOverride);
  let profile = null;
  let region = safeRegion;

  if (user && safeRegion) {
    profile = await getUserProfile(user.uid);
    region = safeRegion;
  } else if (user) {
    const context = await getMyRegionContext(user);
    profile = context.profile;
    region = context.region;
  }

  if (!region) throw new Error('region-required');
  const settings = await getRegionSettings(region);
  const status = getRegionFormStatus(settings);
  if (!status.open) throw new Error('region-form-closed');

  const data = normalizeRegistration({ ...values, region, publicLink: Boolean(values?.publicLink || !user) }, user, profile, region, status);
  validateRegistration(data, status);

  const now = firestoreMod.serverTimestamp();
  const collectionRef = firestoreMod.collection(db, 'regions', region, 'wastelandRegistrations');
  const payload = { ...data, updatedAt: now, submittedAt: now };

  if (user?.uid) {
    const docId = userRegistrationDocId(user.uid, data.farmId, status.currentCycleId);
    const legacyDocId = legacyUserRegistrationDocId(user.uid, data.farmId);
    const docRef = firestoreMod.doc(db, 'regions', region, 'wastelandRegistrations', docId);
    const legacyRef = firestoreMod.doc(db, 'regions', region, 'wastelandRegistrations', legacyDocId);
    const [existing, legacyExisting] = await Promise.all([
      firestoreMod.getDoc(docRef),
      legacyDocId === docId ? Promise.resolve(null) : firestoreMod.getDoc(legacyRef).catch(() => null)
    ]);
    trackReads(legacyDocId === docId ? 1 : 2);
    const managerCanEdit = canManageRegion(profile, region, user);
    const sameCycleAlreadyExists = (existing.exists() && existing.data()?.cycleId === status.currentCycleId)
      || (legacyExisting?.exists?.() && legacyExisting.data()?.cycleId === status.currentCycleId);
    if (sameCycleAlreadyExists && !managerCanEdit) {
      throw new Error('registration-already-submitted');
    }
    await assertRegionNicknameFree(firestoreMod, db, region, data, [docId, legacyDocId]);
    if (managerCanEdit) await firestoreMod.setDoc(docRef, payload, { merge: true });
    else await firestoreMod.setDoc(docRef, payload);
    trackWrites(1);
  } else {
    await assertRegionNicknameFree(firestoreMod, db, region, data, []);
    await firestoreMod.addDoc(collectionRef, payload);
    trackWrites(1);
  }
  removeCache(`regionRegistrations.${region}.${status.currentCycleId || 'no-cycle'}.v88`);

  await writeRegionActionLog({ db, firestoreMod }, user || { uid: 'guest' }, profile || {}, region, 'registration_submitted', { summary: data.nickname || 'Заявка', alliance: data.alliance, targetName: data.nickname });
  if (user?.uid) {
    await createUserNotification(user.uid, { type:'registration_submitted', title: serviceT('notifications.registrationSubmitted','Заявку відправлено'), message: `R${region} · ${data.nickname || ''}`, region, alliance: data.alliance }).catch(() => null);
  }
  return data;
}

export async function getMyWastelandRegistration(user, regionOverride = '', farmId = 'main') {
  if (!user) return null;
  const { db, firestoreMod } = await getFirebaseParts();
  const safeRegion = normalizeRegion(regionOverride);
  const region = safeRegion || (await getMyRegionContext(user)).region;
  const settings = await getRegionSettings(region);
  const activeCycle = settings.currentCycleId;
  const safeFarmId = trim(farmId || 'main') || 'main';
  const docId = userRegistrationDocId(user.uid, safeFarmId, activeCycle);
  const legacyDocId = legacyUserRegistrationDocId(user.uid, safeFarmId);
  const refs = [docId, legacyDocId].filter((id, index, arr) => id && arr.indexOf(id) === index);
  for (const id of refs) {
    const snap = await firestoreMod.getDoc(firestoreMod.doc(db, 'regions', region, 'wastelandRegistrations', id));
    if (!snap.exists()) continue;
    const data = { id: snap.id, ...snap.data() };
    if (!activeCycle || data.cycleId === activeCycle) return data;
  }
  return null;
}

function playerToRegionRow(row = {}) {
  const info = row.wastelandProfile || getGameProfile(row).wastelandProfile || {};
  return {
    id: row.uid || row.id || '',
    uid: row.uid || row.id || '',
    nickname: row.nickname || row.gameNick || '',
    region: normalizeRegion(row.region),
    alliance: normalizeAllianceTag(row.alliance),
    rank: trim(row.rank).toLowerCase(),
    shk: trim(row.shk),
    role: normalizeUserRole(row.role || 'player'),
    roleLabel: row.roleLabel || roleLabel(row.role || 'player'),
    troopType: trim(info.troopType),
    troopLabel: troopLabel(info.troopType),
    tier: trim(info.tier).toUpperCase(),
    lairLevel: lairLevelValue(info.lairLevel),
    marchSize: numberValue(info.marchSize),
    rallySize: numberValue(info.rallySize),
    captainReady: Boolean(info.captainReady),
    readyToJoin: Boolean(info.readyToJoin),
    readyToAttack: Boolean(info.readyToAttack),
    shift: trim(info.shift),
    extraEnabled: Boolean(normalizeExtraSquads(info).length),
    extraSquads: normalizeExtraSquads(info),
    extraTroopType: normalizeExtraSquads(info)[0]?.troopType || '',
    extraTroopLabel: normalizeExtraSquads(info)[0]?.troopLabel || '',
    extraTier: normalizeExtraSquads(info)[0]?.tier || '',
    extraMarchSize: 0,
    shiftLabel: shiftLabel(info.shift),
    source: 'profile',
    rowType: 'Профіль',
    updatedAt: row.updatedAt || row.createdAt || null
  };
}

function mergeRows(players = [], registrations = [], activeCycle = '') {
  const profileMap = new Map();
  players.forEach(player => {
    const key = player.uid || player.id || '';
    if (key) profileMap.set(key, playerToRegionRow(player));
  });

  return registrations
    .filter(registration => !activeCycle || registration.cycleId === activeCycle)
    .map(registration => {
      const profileKey = registration.uid || '';
      const base = profileKey ? (profileMap.get(profileKey) || {}) : {};
      const rowId = registration.id || (registration.uid && registration.farmId ? `${registration.uid}_${registration.farmId}` : registration.uid) || '';
      return {
        ...base,
        ...registration,
        id: rowId,
        rowType: registration.source === 'public-link' ? 'Заявка з посилання' : 'Заявка',
        roleLabel: registration.roleLabel || base.roleLabel || roleLabel(registration.role || base.role || 'player')
      };
    })
    .sort((a, b) => String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk'));
}

export async function listRegionRegistrations(user, regionOverride = '', options = {}) {
  const { db, firestoreMod } = await getFirebaseParts();
  const { profile, region } = await getMyRegionContext(user, regionOverride);
  let settings = await getRegionSettings(region);
  let status = getRegionFormStatus(settings);
  if (canManageRegion(profile, region, user) && status.enabled && (!status.openedAtMs || !(status.openedByName || status.openedByEmail || status.openedByUid))) {
    status = await ensureRegionRegistrationRunInfo(user, region).catch(error => {
      console.warn('[WKD] registration run info repair skipped:', error);
      return status;
    });
    settings = status;
  }
  await cleanupOldRegionRegistrations(user, region).catch(error => console.warn('[WKD] old registration cleanup skipped:', error));

  const cacheKey = `regionRegistrations.${region}.${status.currentCycleId || 'no-cycle'}.v88`;
  if (!options?.force) {
    const cached = readCache(cacheKey, 60 * 1000);
    if (cached && Array.isArray(cached.rows)) return { profile, region, settings: status, rows: cached.rows, cached: true };
  }

  const registrationsRef = firestoreMod.collection(db, 'regions', region, 'wastelandRegistrations');
  const registrationsQuery = status.currentCycleId
    ? firestoreMod.query(registrationsRef, firestoreMod.where('cycleId', '==', status.currentCycleId))
    : registrationsRef;
  const [playersSnap, registrationsSnap] = await Promise.all([
    firestoreMod.getDocs(firestoreMod.collection(db, 'regions', region, 'players')).catch(() => ({ docs: [] })),
    firestoreMod.getDocs(registrationsQuery).catch(() => ({ docs: [] }))
  ]);
  trackReads(Math.max(1, playersSnap.docs.length) + Math.max(1, registrationsSnap.docs.length));

  const players = playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const game = bestRegionGame(profile || {});
  if (normalizeRegion(game.region) === region && game.nickname && !players.some(player => player.uid === profile.uid || player.id === profile.uid)) {
    players.push({ ...profile, ...game, uid: profile.uid, nickname: game.nickname, source: 'profile' });
  }
  const registrations = registrationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const rows = mergeRows(players, registrations, status.currentCycleId);
  writeCache(cacheKey, { rows });
  return { profile, region, settings: status, rows };
}

export async function deleteRegionRegistrations(user, region, registrationIds = []) {
  if (!user) throw new Error('auth-required');
  const ids = (Array.isArray(registrationIds) ? registrationIds : [registrationIds])
    .map(id => trim(id))
    .filter(Boolean);
  if (!ids.length) return { count: 0 };

  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region || getGameProfile(profile || {}).region);
  if (!safeRegion) throw new Error('region-required');
  if (!canDeleteRegionRegistration(profile, safeRegion, user)) throw new Error('region-delete-access-denied');

  for (let index = 0; index < ids.length; index += 450) {
    const batch = firestoreMod.writeBatch(db);
    ids.slice(index, index + 450).forEach(id => {
      batch.delete(firestoreMod.doc(db, 'regions', safeRegion, 'wastelandRegistrations', id));
    });
    await batch.commit();
  }
  trackDeletes(ids.length);
  removeCache(`regionRegistrations.${safeRegion}.no-cycle.v88`);

  await firestoreMod.setDoc(firestoreMod.doc(db, 'regions', safeRegion), {
    region: safeRegion,
    updatedAt: firestoreMod.serverTimestamp(),
    updatedBy: user.uid,
    lastRegistrationDeleteAt: firestoreMod.serverTimestamp(),
    lastRegistrationDeleteBy: user.uid
  }, { merge: true }).catch(() => null);

  return { count: ids.length, region: safeRegion };
}


export async function updateRegionRegistration(user, region, registrationId, values = {}) {
  if (!user) throw new Error('auth-required');
  const id = trim(registrationId);
  if (!id) throw new Error('region-update-registration-only');

  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region || getGameProfile(profile || {}).region);
  if (!safeRegion) throw new Error('region-required');
  if (!canManageRegion(profile, safeRegion, user)) throw new Error('region-update-access-denied');

  const troopType = normalizePlayerTroopType(values.role || values.troopType);
  const shift = trim(values.shift || 'both');
  const clean = {
    nickname: trim(values.name || values.nickname),
    alliance: normalizeAllianceTag(values.alliance),
    troopType,
    troopLabel: troopLabel(troopType),
    tier: normalizeTier(values.tier || 'T10'),
    lairLevel: lairLevelValue(values.lairLevel || values.denLevel),
    captureRegion: /^(1|true|yes|так|да|y)$/i.test(String(values.lair || values.captureRegion || '').trim()),
    marchSize: numberValue(values.march || values.marchSize),
    rallySize: numberValue(values.rally || values.rallySize),
    captainReady: Boolean(values.captain || values.captainReady),
    shift,
    shiftLabel: shiftLabel(shift),
    updatedAt: firestoreMod.serverTimestamp(),
    updatedBy: user.uid,
    manuallyEdited: true
  };

  if (!clean.nickname || !clean.alliance || !clean.troopType || !clean.shift) {
    throw new Error('registration-invalid');
  }

  await firestoreMod.setDoc(
    firestoreMod.doc(db, 'regions', safeRegion, 'wastelandRegistrations', id),
    clean,
    { merge: true }
  );
  trackWrites(1);
  removeCache(`regionRegistrations.${safeRegion}.no-cycle.v88`);

  await firestoreMod.setDoc(firestoreMod.doc(db, 'regions', safeRegion), {
    region: safeRegion,
    updatedAt: firestoreMod.serverTimestamp(),
    updatedBy: user.uid,
    lastRegistrationUpdateAt: firestoreMod.serverTimestamp(),
    lastRegistrationUpdateBy: user.uid
  }, { merge: true }).catch(() => null);

  return { region: safeRegion, id, data: clean };
}

function normalizePlayerTroopType(value = '') {
  const text = trim(value).toLowerCase();
  if (/fighter|fighters|infantry|бійц|боєц|боец|бойц|воїн|воин|wojownik|wojown|kämpfer|kaempfer|ファイター|战士|戰士|전사|đấu sĩ|dau si|مقاتل|المقاتل/.test(text)) return 'fighter';
  if (/rider|riders|cavalry|наїз|наезд|ездник|кавал|jeźdź|jezdz|reiter|ライダー|骑兵|騎兵|기병|kỵ sĩ|ky si|فارس|فرسان|الفرسان/.test(text)) return 'rider';
  if (/shooter|shooters|стріл|стрел|shoot|marksman|strzel|schütz|schuetz|シューター|射手|사수|xạ thủ|xa thu|رامي|الرماة/.test(text)) return 'shooter';
  return text || 'fighter';
}

function importDocId(userId = '', player = {}, index = 0) {
  const base = `${player.name || player.nickname || 'player'}-${player.alliance || ''}-${index}`
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ_-]+/giu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `row-${index + 1}`;
  return `local_${userId}_${base}`;
}

function playerToImportedRegistration(player = {}, user = {}, profile = {}, region = '', settings = {}) {
  const troopType = normalizePlayerTroopType(player.role || player.troopType);
  const shift = trim(player.shift || 'both');
  const nowMs = Date.now();
  return {
    uid: '',
    ownerUid: user.uid,
    importedBy: user.uid,
    displayName: user.displayName || profile.displayName || '',
    nickname: trim(player.name || player.nickname),
    region,
    alliance: normalizeAllianceTag(player.alliance),
    rank: '',
    shk: '',
    readyToJoin: true,
    readyToAttack: false,
    captainReady: Boolean(player.captain || player.captainReady),
    shift,
    shiftLabel: shiftLabel(shift),
    troopType,
    troopLabel: troopLabel(troopType, settings),
    tier: trim(player.tier).toUpperCase(),
    lairLevel: lairLevelValue(player.lairLevel || player.denLevel),
    captureRegion: /^(1|true|yes|так|да|y)$/i.test(String(player.lair || player.captureRegion || '').trim()),
    marchSize: numberValue(player.march || player.marchSize),
    rallySize: numberValue(player.rally || player.rallySize),
    comment: 'Перенесено з локального списку',
    extraEnabled: false,
    extraSquads: [],
    extraTroopType: '',
    extraTroopLabel: '',
    extraTier: '',
    extraMarchSize: 0,
    customFields: {},
    role: normalizeUserRole(profile?.role || 'player'),
    roleLabel: roleLabel(profile?.role || 'player'),
    publicLink: false,
    createdByAuth: true,
    source: 'local-import',
    rowType: 'Локальний імпорт',
    importedFromLocal: true,
    cycleId: settings.currentCycleId,
    eventStartAtMs: settings.eventStartAtMs,
    closeAtMs: settings.closeAtMs,
    importedAtMs: nowMs
  };
}

export async function importLocalPlayersToRegion(user, players = []) {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const { profile, region } = await getMyRegionContext(user);
  if (!canManageRegion(profile, region, user)) throw new Error('region-access-denied');
  const settings = await getRegionSettings(region).then(getRegionFormStatus);
  const rows = (Array.isArray(players) ? players : [])
    .filter(player => trim(player.name || player.nickname) && trim(player.alliance))
    .map((player, index) => ({ id: importDocId(user.uid, player, index), data: playerToImportedRegistration(player, user, profile, region, settings) }));

  const collectionRef = firestoreMod.collection(db, 'regions', region, 'wastelandRegistrations');
  const activeCycle = settings.currentCycleId;
  const currentCycleQuery = activeCycle
    ? firestoreMod.query(collectionRef, firestoreMod.where('cycleId', '==', activeCycle))
    : collectionRef;
  const existingSnap = await firestoreMod.getDocs(currentCycleQuery).catch(() => ({ docs: [] }));
  const oldCycleRows = existingSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const now = firestoreMod.serverTimestamp();
  const writes = [
    ...oldCycleRows.map(row => ({ type: 'delete', id: row.id })),
    ...rows.map(row => ({ type: 'set', id: row.id, data: row.data }))
  ];

  for (let index = 0; index < writes.length; index += 450) {
    const batch = firestoreMod.writeBatch(db);
    writes.slice(index, index + 450).forEach(write => {
      const ref = firestoreMod.doc(db, 'regions', region, 'wastelandRegistrations', write.id);
      if (write.type === 'delete') batch.delete(ref);
      else batch.set(ref, { ...write.data, updatedAt: now, submittedAt: now }, { merge: true });
    });
    await batch.commit();
  }

  await firestoreMod.setDoc(firestoreMod.doc(db, 'regions', region), {
    region,
    activeTable: {
      cycleId: activeCycle,
      source: 'local-import',
      rowsCount: rows.length,
      replacedAt: now,
      replacedBy: user.uid
    },
    updatedAt: now,
    updatedBy: user.uid
  }, { merge: true });
  return { profile, region, count: rows.length, replaced: oldCycleRows.length };
}

export function regionRegistrationToPlayer(row = {}) {
  const info = row.wastelandProfile || {};
  const troopType = row.troopType || info.troopType || '';
  const captainReady = Object.prototype.hasOwnProperty.call(row, 'captainReady')
    ? Boolean(row.captainReady)
    : Boolean(info.captainReady);
  const isRegistration = row.source !== 'profile' && row.rowType !== 'Профіль';
  return {
    id: row.id || row.uid || '',
    _rowId: row.id || row.uid || '',
    regionRegistrationId: isRegistration ? (row.id || '') : '',
    regionNumber: normalizeRegion(row.region),
    dbSource: isRegistration ? 'wastelandRegistration' : 'profile',
    name: row.nickname || '',
    alliance: row.alliance || '',
    role: troopTypeToPlayerRole(troopType) || row.troopLabel || troopLabel(troopType),
    tier: row.tier || info.tier || '',
    march: row.marchSize || info.marchSize || 0,
    rally: row.rallySize || info.rallySize || 0,
    extraEnabled: Boolean(normalizeExtraSquads(row).length || normalizeExtraSquads(info).length),
    extraSquads: normalizeExtraSquads(row).length ? normalizeExtraSquads(row) : normalizeExtraSquads(info),
    extraTroopType: (normalizeExtraSquads(row)[0] || normalizeExtraSquads(info)[0] || {}).troopType || '',
    extraTroopLabel: (normalizeExtraSquads(row)[0] || normalizeExtraSquads(info)[0] || {}).troopLabel || '',
    extraTier: (normalizeExtraSquads(row)[0] || normalizeExtraSquads(info)[0] || {}).tier || '',
    extraMarch: 0,
    extraMarchSize: 0,
    captainReady: captainReady ? 'Так' : 'Ні',
    shift: row.shift || info.shift || '',
    shiftLabel: row.shiftLabel || shiftLabel(row.shift || info.shift),
    lair: (row.captureRegion ?? info.captureRegion) ? 'Так' : 'Ні',
    lairLevel: row.lairLevel || info.lairLevel || '',
    registeredAt: row.submittedAt || row.updatedAt || row.createdAt || '',
    placement: 'Не призначено'
  };
}


export async function getRegionTowerPlan(user, regionOverride = '') {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const { profile, region } = await getMyRegionContext(user, regionOverride);
  if (!region) throw new Error('region-required');
  const ref = firestoreMod.doc(db, 'regions', region, 'wastelandTowerPlans', 'current');
  const snap = await firestoreMod.getDoc(ref);
  return {
    profile,
    region,
    plan: snap.exists() ? (snap.data()?.plan || null) : null,
    updatedAt: snap.exists() ? snap.data()?.updatedAt || null : null,
    updatedBy: snap.exists() ? snap.data()?.updatedBy || '' : ''
  };
}

export async function saveRegionTowerPlan(user, region, plan = {}) {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region || getGameProfile(profile || {}).region);
  if (!safeRegion) throw new Error('region-required');
  const settings = await getRegionSettings(safeRegion).catch(() => mergeRegionSettings({}));
  if (!canEditRegionTowerPlan(profile, safeRegion, user, settings)) throw new Error('region-plan-access-denied');
  const cleanPlan = plan && typeof plan === 'object' ? plan : {};
  await firestoreMod.setDoc(
    firestoreMod.doc(db, 'regions', safeRegion, 'wastelandTowerPlans', 'current'),
    {
      region: safeRegion,
      plan: cleanPlan,
      updatedAt: firestoreMod.serverTimestamp(),
      updatedAtMs: Date.now(),
      updatedBy: user.uid
    },
    { merge: true }
  );
  await firestoreMod.setDoc(firestoreMod.doc(db, 'regions', safeRegion), {
    region: safeRegion,
    updatedAt: firestoreMod.serverTimestamp(),
    updatedBy: user.uid,
    lastTowerPlanUpdateAt: firestoreMod.serverTimestamp(),
    lastTowerPlanUpdateBy: user.uid
  }, { merge: true }).catch(() => null);
  await writeRegionActionLog({ db, firestoreMod }, user, profile, safeRegion, 'tower_plan_saved', { summary: 'Оновлено регіональний розподіл турелей' });
  return { region: safeRegion, plan: cleanPlan };
}

export { formatUserDate, timestampToMs };
