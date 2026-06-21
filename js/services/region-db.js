import { getFirebase } from './firebase-service.js';
import { readCache, writeCache, removeCache } from './local-cache.js?v=252';
import { trackReads, trackWrites, trackDeletes } from './usage-tracker.js?v=252';
import {
  getUserProfile,
  getFarmById,
  getGameProfile,
  getUserFarms,
  normalizeUserRole,
  roleLabel,
  formatUserDate,
  timestampToMs,
  createUserNotification,
  createRegionNotificationCampaign
} from './user-db.js?v=005';
import { readRegionFormShare as readRegionFormShareD1, readRegionFormSettings as readRegionFormSettingsD1, publishRegionFormSettings, readRegionTowerPlanSnapshot, publishRegionTowerPlanSnapshot, readRegionAlliancesD1, saveRegionAllianceD1, deleteRegionAllianceD1, deleteRegionTableRowsD1, isExpectedRegionTableCacheError, isRegionAccessDeniedCacheError, isRegionSnapshotMissingCacheError } from './region-table-cache.js?v=046';

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
const ROTATION_HANDOVER_HOLD_MS = 72 * DAY_MS;
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

function isAccountRoleText(value = '') {
  const text = trim(value).toLowerCase();
  return /^(admin|administrator|owner|moderator|consul|officer|player|guest|адмін|администратор|модератор|консул|офіцер|офицер|гравець|игрок|гість|гость)$/.test(text);
}

function troopTypeToPlayerRole(type = '') {
  const text = trim(type).toLowerCase();
  if (!text || isAccountRoleText(text)) return '';
  if (/^(fighter|fighters|infantry)$|боец|боєць|бійц|бойц|воїн|воин|піхот|пехот|fight|wojownik|wojown|kämpfer|kaempfer|ファイター|战士|戰士|전사|đấu sĩ|dau si|مقاتل|المقاتل/.test(text)) return 'Fighter';
  if (/^(rider|riders|cavalry)$|наїз|наезд|ездник|кавал|ride|jeźdź|jezdz|reiter|ライダー|骑兵|騎兵|기병|kỵ sĩ|ky si|فارس|فرسان|الفرسان/.test(text)) return 'Rider';
  if (/^(shooter|shooters)$|стрілець|стрільц|стрел|shoot|marksman|strzel|schütz|schuetz|シューター|射手|사수|xạ thủ|xa thu|رامي|الرماة/.test(text)) return 'Shooter';
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
  // v008: full region-management means global admin/moderator or region consul.
  // Officers can still edit their own alliance rows through staff/row-specific gates and can edit the tower plan only when their alliance leads the current rotation.
  return ['admin', 'moderator', 'consul'].includes(role) && canViewRegion(profile, region, actor);
}

function activeRotationAlliance(settings = {}, nowMs = Date.now()) {
  const list = normalizeRotationAlliances(settings.rotationAlliances || []);
  const fallback = normalizeAllianceTag(settings.hostAlliance || settings.activeHostAlliance || '');
  if (!settings.rotationEnabled || !list.length) return fallback;
  const index = effectiveRotationIndex(settings, nowMs);
  return normalizeAllianceTag(list[index]?.tag || fallback || '');
}

function actorAllianceForRegion(profile = {}, region = '') {
  const game = gameForRegion(profile || {}, region) || bestRegionGame(profile || {});
  return normalizeAllianceTag(game?.alliance || '');
}

function actorRankForRegion(profile = {}, region = '') {
  const game = gameForRegion(profile || {}, region) || bestRegionGame(profile || {});
  return trim(game?.rank || '').toLowerCase();
}
function rankNumber(value = '') {
  const m = String(value || '').match(/[1-5]/);
  return m ? Number(m[0]) : 1;
}

export function canLeadCurrentRotation(profile = {}, region = '', actor = null, settings = {}) {
  const safeRegion = normalizeRegion(region);
  if (!safeRegion || !canViewRegion(profile, safeRegion, actor)) return false;
  const role = roleForRegion(profile, safeRegion, actor);
  if (['admin', 'moderator', 'consul'].includes(role)) return true;
  const ownRank = rankNumber(actorRankForRegion(profile, safeRegion));
  if (role !== 'officer' || ownRank < 4) return false;
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
  return MANAGER_ROLES.includes(globalRole)
    || allRegionGames(profile).some(game => MANAGER_ROLES.includes(normalizeUserRole(game.role || 'player')) || rankNumber(game.rank) >= 4);
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

export async function listKnownRegionIds(options = {}) {
  const { db, firestoreMod } = await getFirebaseParts();
  const includePublicPlayers = Boolean(options?.includePublicPlayers);
  const regions = new Set();
  const archived = new Set();
  const addRegion = value => {
    const region = normalizeRegion(value);
    if (region && !archived.has(region)) regions.add(region);
  };
  try {
    const regionSnap = await firestoreMod.getDocs(firestoreMod.collection(db, 'regions'));
    trackReads(Math.max(1, regionSnap.docs.length));
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
    if (window.WKD_DEBUG) console.warn('[WKD] regions list skipped:', error?.code || error?.message || error);
  }
  if (includePublicPlayers) {
    try {
      const publicSnap = await firestoreMod.getDocs(firestoreMod.collection(db, 'publicPlayers'));
      trackReads(Math.max(1, publicSnap.docs.length));
      publicSnap.docs.forEach(doc => {
        const data = doc.data() || {};
        addRegion(data.region);
        const farms = Array.isArray(data.farms) ? data.farms : [];
        farms.forEach(farm => addRegion(farm?.region));
      });
    } catch (error) {
      if (window.WKD_DEBUG) console.warn('[WKD] public region list skipped:', error?.code || error?.message || error);
    }
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

export async function listRegionCatalog({ includeInactive = false, skipPublicPlayers = false } = {}) {
  const { db, firestoreMod } = await getFirebaseParts();
  const byRegion = new Map();
  const addItem = item => {
    if (!item?.region) return;
    const old = byRegion.get(item.region) || {};
    byRegion.set(item.region, { ...old, ...item, active: item.active !== false });
  };

  try {
    const regionSnap = await firestoreMod.getDocs(firestoreMod.collection(db, 'regions'));
    trackReads(Math.max(1, regionSnap.docs.length));
    regionSnap.docs.forEach(doc => addItem(regionCatalogItem(doc.id, doc.data() || {})));
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] region catalog skipped:', error);
  }

  if (!skipPublicPlayers) {
    try {
      const publicSnap = await firestoreMod.getDocs(firestoreMod.collection(db, 'publicPlayers'));
      trackReads(Math.max(1, publicSnap.docs.length));
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
      if (window.WKD_DEBUG) console.warn('[WKD] public region catalog skipped:', error);
    }
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


function nextMondayUtcAfter(ms = Date.now()) {
  const date = new Date(Number(ms) || Date.now());
  date.setUTCHours(0, 0, 0, 0);
  const daysUntilMonday = (1 - date.getUTCDay() + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  return date.getTime();
}

export function computeRotationHandoverAtMs(closedAtMs = Date.now()) {
  const closed = Number(closedAtMs) || Date.now();
  // Real Wasteland closes on the Friday reset, so the 72-hour handover is
  // the next Monday 00:00 UTC. If someone closes a test cycle on another day,
  // still use the next Monday boundary so the rotation never moves instantly.
  return nextMondayUtcAfter(closed);
}

function nextRotationIndex(index = 0, list = [], loop = true) {
  const count = Array.isArray(list) ? list.length : 0;
  if (!count) return 0;
  const current = Math.max(0, Math.min(count - 1, Number(index) || 0));
  const next = current + 1;
  return next < count ? next : (loop ? 0 : current);
}

function effectiveRotationIndex(settings = {}, nowMs = Date.now()) {
  const list = normalizeRotationAlliances(settings.rotationAlliances || []);
  if (!list.length) return 0;
  const stored = Math.max(0, Math.min(list.length - 1, Number(settings.rotationActiveIndex) || 0));
  const handoverAtMs = Number(settings.rotationHandoverAtMs) || 0;
  if (settings.rotationEnabled && handoverAtMs && nowMs >= handoverAtMs) {
    const closedIndex = Number.isFinite(Number(settings.rotationClosedActiveIndex)) ? Number(settings.rotationClosedActiveIndex) : stored;
    const plannedNext = Number.isFinite(Number(settings.rotationNextActiveIndex)) ? Number(settings.rotationNextActiveIndex) : nextRotationIndex(closedIndex, list, settings.rotationLoop !== false);
    return Math.max(0, Math.min(list.length - 1, plannedNext));
  }
  return stored;
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
  const rotationClosedActiveIndex = Number.isFinite(Number(data.rotationClosedActiveIndex)) ? Math.max(0, Math.min(Math.max(0, rotationAlliances.length - 1), Number(data.rotationClosedActiveIndex) || 0)) : rotationActiveIndex;
  const rotationNextActiveIndex = Number.isFinite(Number(data.rotationNextActiveIndex)) ? Math.max(0, Math.min(Math.max(0, rotationAlliances.length - 1), Number(data.rotationNextActiveIndex) || 0)) : nextRotationIndex(rotationClosedActiveIndex, rotationAlliances, data.rotationLoop !== false);
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
    rotationClosedActiveIndex,
    rotationNextActiveIndex,
    rotationHandoverAtMs: Number(data.rotationHandoverAtMs) || 0,
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
  const canUseRequested = Boolean(requestedRegion && (canViewAnyRegion(profile || {}, user) || canViewRegion(profile || {}, requestedRegion, user)));
  const region = canUseRequested ? requestedRegion : fallbackRegion;
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

async function getRegionSettingsD1First(region) {
  const safeRegion = normalizeRegion(region);
  if (!safeRegion) throw new Error('region-required');
  try {
    const cached = await readRegionFormSettingsD1(safeRegion, { force: true, ttlMs: 0 });
    if (cached?.settings) {
      const code = normalizeShortLinkCode(cached.code || cached.settings?.shortLinkCode || cached.settings?.code || '');
      return mergeRegionSettings({ ...cached.settings, shortLinkCode: code, code });
    }
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] D1 region settings read skipped:', error?.message || error);
  }
  return getRegionSettings(safeRegion);
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
function canDeleteRegionActionLogs(profile = {}, region = '', actor = null) {
  return false;
}

async function actionLogCacheModule() {
  return import('./action-log-cache.js?v=008');
}

async function writeRegionActionLog(firebase, user, profile = {}, region = '', action = '', details = {}) {
  try {
    const safeRegion = normalizeRegion(region);
    if (!user?.uid || !safeRegion) return null;
    const game = gameForRegion(profile || {}, safeRegion) || bestRegionGame(profile || {});
    const actorName = getRegionActorName(profile || {}, safeRegion, user) || user.uid;
    const actorAlliance = normalizeAllianceTag(game?.alliance || '');
    const normalizedDetails = Object.fromEntries(Object.entries(details || {})
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value).slice(0, 400) : trim(value).slice(0, 400)]));
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
      details: normalizedDetails,
      createdAtMs: Date.now()
    };
    try {
      const mod = await actionLogCacheModule();
      if (mod?.isActionLogCacheEnabled?.()) {
        const result = await mod.createRegionActionLogD1(user, payload);
        if (result?.ok !== false) return result.log || payload;
      }
    } catch (d1Error) {
      if (window.WKD_DEBUG) console.warn('[WKD] D1 action log unavailable; Firebase fallback disabled:', d1Error);
    }
    return { ...payload, source: 'action-log-d1-unavailable-no-firebase' };
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] action log skipped:', error);
    return null;
  }
}

export async function listRegionActionLogs(user, regionOverride = '', { limitCount = 20, cursorMs = 0 } = {}) {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const { profile, region } = await getMyRegionContext(user, regionOverride);
  if (!canViewRegion(profile || {}, region, user)) throw new Error('region-access-denied');
  const role = roleForRegion(profile || {}, region, user);
  const ownAlliance = actorAllianceForRegion(profile || {}, region);
  const limitValue = Math.max(1, Math.min(20, Number(limitCount) || 20));
  const safeCursorMs = Number(cursorMs) || 0;
  try {
    const mod = await actionLogCacheModule();
    if (mod?.isActionLogCacheEnabled?.()) {
      const result = await mod.listRegionActionLogsD1(user, region, { limitCount: limitValue, cursorMs: safeCursorMs, alliance: role === 'officer' ? ownAlliance : '' });
      const rows = (result.rows || [])
        .filter(row => regionActionVisibleTo(profile || {}, region, user, row))
        .sort((a, b) => (Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0));
      const lastRow = rows[rows.length - 1] || null;
      return { profile, region, rows, limitCount: limitValue, hasMore: Boolean(result.hasMore), nextCursorMs: Number(result.nextCursorMs || lastRow?.createdAtMs) || 0, source: 'cloudflare-d1-action-log' };
    }
  } catch (d1Error) {
    if (window.WKD_DEBUG) console.warn('[WKD] D1 action log list fallback:', d1Error);
  }
  return { profile, region, rows: [], limitCount: limitValue, hasMore: false, nextCursorMs: 0, source: 'action-log-d1-unavailable-no-firebase' };
}


export async function deleteRegionActionLog(user, regionOverride = '', logId = '') {
  throw new Error('action-log-immutable');
}

export async function deleteRegionActionLogs(user, regionOverride = '', logIds = []) {
  throw new Error('action-log-immutable');
}

export async function clearRegionActionLogs(user, regionOverride = '', { olderThanMs = 0, limitCount = 500 } = {}) {
  throw new Error('action-log-immutable');
}

export async function getSecurityOverview(user) {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  if (!canViewAnyRegion(profile || {}, user)) throw new Error('security-access-denied');
  const regionsSnap = await firestoreMod.getDocs(firestoreMod.collection(db, 'regions')).catch(() => ({ docs: [] }));
  trackReads(Math.max(1, regionsSnap.docs.length));
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


async function rotateRegionPublicSharesForNewCycle(user, region) {
  try {
    const mod = await import('./region-table-cache.js?v=046');
    if (!mod?.rotateRegionPublicShares) return null;
    return await mod.rotateRegionPublicShares(user, region);
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] public share rotation skipped:', error);
    return null;
  }
}

async function saveRegionShareLink({ db, firestoreMod }, user, region, settings, forceNew = false) {
  const safeRegion = normalizeRegion(region);
  const privateRef = firestoreMod.doc(db, 'regions', safeRegion, 'privateSettings', 'shortLink');
  const privateSnap = await firestoreMod.getDoc(privateRef).catch(() => null);
  const oldCode = normalizeShortLinkCode(privateSnap?.exists?.() ? privateSnap.data()?.code : '');
  const requestedCode = normalizeShortLinkCode(settings?.shortLinkCode || settings?.code || '');
  const code = forceNew
    ? (requestedCode || makeShortLinkCode())
    : (requestedCode || oldCode || makeShortLinkCode());
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
  await publishRegionFormSettings(user, { region: safeRegion, code, settings, updatedAtMs: Date.now() }).catch(() => null);
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

export async function resolveRegionShareLink(codeValue, options = {}) {
  const code = normalizeShortLinkCode(codeValue);
  if (!code) throw new Error('short-link-required');
  const cached = await readRegionFormShareD1(code).catch(() => null);
  if (cached?.region && cached?.settings) return { code, region: cached.region, settings: mergeRegionSettings(cached.settings), alliances: Array.isArray(cached.alliances) ? cached.alliances : [], source: cached.source || 'cloudflare-d1-form-settings' };
  if (options?.allowFirebaseFallback !== true) throw new Error('short-link-d1-required');

  const { db, firestoreMod } = await getFirebaseParts();
  const snap = await firestoreMod.getDoc(firestoreMod.doc(db, 'shortRegionLinks', code));
  trackReads(1);
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
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region);
  if (!safeRegion) throw new Error('region-required');
  const settings = await getRegionSettings(safeRegion);
  if (!canEditRegionTowerPlan(profile, safeRegion, user, settings)) throw new Error('region-plan-access-denied');
  const cleanHtml = trim(payload.html).slice(0, 700000);
  const cleanText = trim(payload.text).slice(0, 50000);
  const code = makeShortLinkCode();
  const nowMs = Date.now();
  const updatedByName = getRegionActorName(profile || {}, safeRegion, user);
  const sharePayload = {
    code,
    region: safeRegion,
    cycleId: settings.currentCycleId || '',
    eventStartAtMs: Number(settings.eventStartAtMs) || 0,
    html: cleanHtml,
    text: cleanText,
    title: trim(payload.title || 'Final plan').slice(0, 120),
    shift: trim(payload.shift || '').slice(0, 40),
    updatedAtMs: nowMs,
    updatedBy: user.uid,
    updatedByName,
    expiresAtMs: Number(payload.expiresAtMs) || 0
  };
  const d1 = await publishFinalPlanToD1Cache(user, sharePayload);
  if (!d1 || d1.ok === false || d1.skipped) throw new Error(d1?.error || 'final-plan-d1-share-required');
  writeRegionActionLog(null, user, profile, safeRegion, 'final_plan_shared', { summary: 'Створено D1-посилання фінального плану', shift: trim(payload.shift || ''), noFirebaseFallback: true }).catch(() => null);
  return { code, region: safeRegion, source: 'cloudflare-d1-final-plan' };
}

export async function resolveRegionFinalPlanShare(codeValue, options = {}) {
  const { db, firestoreMod } = await getFirebaseParts();
  const code = normalizeShortLinkCode(codeValue);
  if (!code) throw new Error('final-plan-link-required');
  const cached = await readFinalPlanFromD1Cache(code).catch(() => null);
  if (cached?.html || cached?.text) return { code, ...cached };
  if (options?.allowFirebaseFallback !== true) throw new Error('final-plan-d1-required');
  const snap = await firestoreMod.getDoc(firestoreMod.doc(db, 'finalPlanShares', code));
  trackReads(1);
  if (!snap.exists()) throw new Error('final-plan-link-not-found');
  return { code, ...(snap.data() || {}) };
}



async function mirrorRegistrationToRegionTableCache(user, region, row, settings) {
  try {
    const mod = await import('./region-table-cache.js?v=046');
    return await mod.mirrorRegionRegistration(user, region, row, settings);
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] region table JSON mirror unavailable:', error);
    return null;
  }
}

async function publishSnapshotToRegionTableCache(user, payload) {
  try {
    const mod = await import('./region-table-cache.js?v=046');
    return await mod.publishRegionTableSnapshot(user, payload);
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] region table JSON snapshot unavailable:', error);
    return null;
  }
}


async function updateRegionTableRowD1First(user, region, registrationId, values = {}, settings = {}) {
  try {
    const mod = await import('./region-table-cache.js?v=046');
    return await mod.updateRegionTableRowD1(user, region, registrationId, values, settings, { updateOnly: true });
  } catch (error) {
    const status = Number(error?.status || 0) || 0;
    if (status === 409) throw error;
    if (window.WKD_DEBUG) console.warn('[WKD] D1 registration row update skipped:', error?.message || error);
    return null;
  }
}

async function publishShareToRegionTableCache(user, payload) {
  try {
    const mod = await import('./region-table-cache.js?v=046');
    return await mod.publishRegionTableShare(user, payload);
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] region table JSON share unavailable:', error);
    return null;
  }
}

async function readSnapshotFromRegionTableCache(user, region, options = {}) {
  try {
    const mod = await import('./region-table-cache.js?v=046');
    if (!mod.isRegionTableCacheEnabled?.()) return null;
    return await mod.readRegionTableSnapshot(user, region, options);
  } catch (error) {
    if (isRegionAccessDeniedCacheError(error)) {
      return {
        region: normalizeRegion(region),
        rows: [],
        settings: {},
        cached: false,
        d1AccessDenied: true,
        source: 'cloudflare-d1-access-denied'
      };
    }
    if (isRegionSnapshotMissingCacheError(error)) {
      return {
        region: normalizeRegion(region),
        rows: [],
        settings: {},
        cached: false,
        d1Missing: true,
        source: 'cloudflare-d1-missing-no-firestore'
      };
    }
    if (!isExpectedRegionTableCacheError(error)) if (window.WKD_DEBUG) console.warn('[WKD] region table D1 snapshot unavailable:', error?.message || error);
    return null;
  }
}

async function readMyRegistrationFromD1Cache(user, region, farmId = 'main', options = {}) {
  try {
    const mod = await import('./region-table-cache.js?v=046');
    if (!mod.isRegionTableCacheEnabled?.()) return null;
    return await mod.readMyRegionRegistrationD1(user, region, farmId, options);
  } catch (error) {
    if (!isExpectedRegionTableCacheError(error)) if (window.WKD_DEBUG) console.warn('[WKD] my D1 registration unavailable, Firebase fallback used:', error?.message || error);
    return null;
  }
}

async function readFinalPlanFromD1Cache(code, options = {}) {
  try {
    const mod = await import('./final-plan-cache.js?v=252');
    if (!mod.isFinalPlanCacheEnabled?.()) return null;
    return await mod.readFinalPlanShare(code, options);
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] final plan D1 read unavailable:', error);
    return null;
  }
}

async function publishFinalPlanToD1Cache(user, payload = {}) {
  try {
    const mod = await import('./final-plan-cache.js?v=252');
    if (!mod.isFinalPlanCacheEnabled?.()) return null;
    return await mod.publishFinalPlanShare(user, payload);
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] final plan D1 publish unavailable:', error);
    return null;
  }
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
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region || getGameProfile(profile || {}).region);
  if (!safeRegion) throw new Error('region-required');
  if (!canManageRegion(profile, safeRegion, user)) throw new Error('region-table-share-denied');
  const result = await listRegionRegistrations(user, safeRegion, { force: true });
  const code = makeShortLinkCode();
  const settings = result.settings || {};
  const rows = (result.rows || []).map(sanitizeRegionTableRow).filter(row => row.nickname).slice(0, 800);
  const d1 = await publishShareToRegionTableCache(user, {
    code,
    region: safeRegion,
    cycleId: settings.currentCycleId || '',
    settings,
    rows
  });
  if (!d1 || d1.ok === false || d1.skipped) throw new Error(d1?.error || 'region-table-d1-share-required');
  writeRegionActionLog(null, user, profile, safeRegion, 'region_table_shared', { summary: serviceT('actionLog.regionTableShared', 'Створено D1-посилання таблиці регіону'), noFirebaseFallback: true }).catch(() => null);
  return { code, region: safeRegion, source: 'cloudflare-d1-region-table-share' };
}

export async function resolveRegionTableShare(codeValue, options = {}) {
  const { db, firestoreMod } = await getFirebaseParts();
  const code = normalizeShortLinkCode(codeValue);
  if (!code) throw new Error('region-table-link-required');
  if (options?.allowFirebaseFallback !== true) throw new Error('region-table-d1-required');
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

function regionActiveCycleIdFromData(data = {}) {
  const form = data?.registrationForm || {};
  return trim(form.currentCycleId || data.currentCycleId || form.cycleId || data.cycleId);
}

function registrationCleanupRetentionDays(value = REGION_REGISTRATION_RETENTION_DAYS) {
  const days = Number(value);
  if (Number.isFinite(days) && days <= 0) return 0;
  return Math.max(1, Math.min(3650, days || REGION_REGISTRATION_RETENTION_DAYS));
}

function registrationCleanupCutoffMs(retentionDays = REGION_REGISTRATION_RETENTION_DAYS) {
  const days = registrationCleanupRetentionDays(retentionDays);
  if (days <= 0) return Number.MAX_SAFE_INTEGER;
  return Date.now() - days * DAY_MS;
}

async function registrationCleanupContext(user, regionOverride = '') {
  if (!user) return { skipped: 'auth-required', region: normalizeRegion(regionOverride) };
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(regionOverride || getGameProfile(profile || {}).region);
  if (!safeRegion) throw new Error('region-required');
  if (!canManageRegion(profile, safeRegion, user)) return { db, firestoreMod, profile, region: safeRegion, skipped: 'region-access-denied' };
  const regionRef = firestoreMod.doc(db, 'regions', safeRegion);
  const regionSnap = await firestoreMod.getDoc(regionRef).catch(() => null);
  trackReads(1);
  const activeCycleId = regionSnap?.exists?.() ? regionActiveCycleIdFromData(regionSnap.data() || {}) : '';
  return { db, firestoreMod, profile, region: safeRegion, activeCycleId };
}

function isCleanableOldRegistration(data = {}, cutoffMs = Date.now(), activeCycleId = '', options = {}) {
  const cycleId = trim(data.cycleId || '');
  if (activeCycleId && cycleId && cycleId === activeCycleId) return false;
  const savedAtMs = registrationSavedAtMs(data);
  if (options.anyAge === true) return Boolean(cycleId || savedAtMs);
  if (savedAtMs > 0) return savedAtMs <= cutoffMs;
  const expiresAtMs = Number(data.expiresAtMs) || 0;
  if (expiresAtMs > 0) return expiresAtMs <= Date.now();
  if (!options.allowLegacyFullScan) return false;
  return false;
}

async function queryCleanableOldRegistrationDocs(firestoreMod, db, safeRegion, options = {}) {
  const maxDocs = Math.max(10, Math.min(200, Number(options.maxDocs || options.maxDeletes) || 100));
  const retentionDays = registrationCleanupRetentionDays(options.retentionDays);
  const anyAge = retentionDays <= 0;
  const cutoffMs = Number(options.cutoffMs) || registrationCleanupCutoffMs(retentionDays);
  const activeCycleId = trim(options.activeCycleId || '');
  const allowLegacyFullScan = options.allowLegacyFullScan === true || anyAge;
  const collectionRef = firestoreMod.collection(db, 'regions', safeRegion, 'wastelandRegistrations');
  const byId = new Map();
  let scannedCount = 0;
  let indexedSkipped = '';

  const collect = snap => {
    const docs = snap?.docs || [];
    scannedCount += docs.length;
    docs.forEach(doc => {
      const data = doc.data() || {};
      if (isCleanableOldRegistration(data, cutoffMs, activeCycleId, { allowLegacyFullScan, anyAge })) {
        byId.set(doc.id, doc);
      }
    });
  };

  try {
    const snap = await firestoreMod.getDocs(firestoreMod.query(
      collectionRef,
      firestoreMod.where('expiresAtMs', '<=', anyAge ? Number.MAX_SAFE_INTEGER : Date.now()),
      firestoreMod.orderBy('expiresAtMs', 'asc'),
      firestoreMod.limit(maxDocs + 1)
    ));
    trackReads(snap?.docs?.length || 0);
    collect(snap);
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] indexed registration cleanup check skipped:', error?.message || error);
    indexedSkipped = 'indexed-cleanup-unavailable';
    if (!allowLegacyFullScan) return { docs: [], scannedCount, hasMore: false, indexedSkipped };
  }

  if (allowLegacyFullScan && byId.size < maxDocs) {
    const legacySnap = await firestoreMod.getDocs(firestoreMod.query(collectionRef, firestoreMod.limit(maxDocs + 1))).catch(error => {
      if (window.WKD_DEBUG) console.warn('[WKD] legacy registration cleanup scan skipped:', error?.message || error);
      return { docs: [] };
    });
    trackReads(legacySnap?.docs?.length || 0);
    collect(legacySnap);
  }

  const docs = [...byId.values()].slice(0, maxDocs);
  return {
    docs,
    scannedCount,
    hasMore: byId.size > maxDocs,
    indexedSkipped,
    legacyScan: allowLegacyFullScan
  };
}

export async function inspectOldRegionRegistrations(user, regionOverride = '', options = {}) {
  const ctx = await registrationCleanupContext(user, regionOverride);
  if (ctx.skipped) return { region: ctx.region, oldCount: 0, scannedCount: 0, skipped: ctx.skipped };
  const maxDocs = Math.max(10, Math.min(200, Number(options.maxDocs || options.maxDeletes) || 100));
  const retentionDays = registrationCleanupRetentionDays(options.retentionDays);
  const result = await queryCleanableOldRegistrationDocs(ctx.firestoreMod, ctx.db, ctx.region, {
    maxDocs,
    activeCycleId: ctx.activeCycleId,
    allowLegacyFullScan: options.allowLegacyFullScan === true,
    retentionDays,
    cutoffMs: registrationCleanupCutoffMs(retentionDays)
  });
  return {
    region: ctx.region,
    activeCycleId: ctx.activeCycleId || '',
    oldCount: result.docs.length,
    scannedCount: result.scannedCount,
    maxDeletes: maxDocs,
    hasMore: result.hasMore,
    legacyScan: result.legacyScan,
    indexedSkipped: result.indexedSkipped || '',
    retentionDays,
    optimized: true
  };
}

export async function cleanupOldRegionRegistrations(user, regionOverride = '', options = {}) {
  const ctx = await registrationCleanupContext(user, regionOverride);
  if (ctx.skipped) return { region: ctx.region, deletedCount: 0, skipped: ctx.skipped };
  const maxDeletes = Math.max(10, Math.min(200, Number(options.maxDeletes) || 100));
  const retentionDays = registrationCleanupRetentionDays(options.retentionDays);
  const result = await queryCleanableOldRegistrationDocs(ctx.firestoreMod, ctx.db, ctx.region, {
    maxDocs: maxDeletes,
    activeCycleId: ctx.activeCycleId,
    allowLegacyFullScan: options.allowLegacyFullScan === true,
    retentionDays,
    cutoffMs: registrationCleanupCutoffMs(retentionDays)
  });
  const docs = result.docs.slice(0, maxDeletes);

  let deleteOps = 0;
  for (let index = 0; index < docs.length; index += 225) {
    const batch = ctx.firestoreMod.writeBatch(ctx.db);
    docs.slice(index, index + 225).forEach(docSnap => {
      const data = docSnap.data() || {};
      batch.delete(docSnap.ref);
      deleteOps += 1;
      if (data.nickname && data.cycleId) {
        batch.delete(nicknameLockRef(ctx.firestoreMod, ctx.db, ctx.region, { ...data, region: ctx.region }));
        deleteOps += 1;
      }
    });
    await batch.commit();
  }
  trackDeletes(deleteOps);

  return {
    region: ctx.region,
    activeCycleId: ctx.activeCycleId || '',
    deletedCount: docs.length,
    deletedOps: deleteOps,
    scannedCount: result.scannedCount,
    hasMore: result.hasMore,
    maxDeletes,
    retentionDays,
    optimized: true,
    legacyScan: result.legacyScan,
    indexedSkipped: result.indexedSkipped || ''
  };
}

export async function cleanupOldPublicDocuments(user, options = {}) {
  if (!user) return { deletedCount: 0, skipped: 'auth-required' };
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  if (!(isOwnerEmail(user.email) || normalizeUserRole(profile?.role || 'player') === 'admin')) {
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
    if (window.WKD_DEBUG) console.warn('[WKD] registration run info repair skipped:', error);
  });
  return getRegionSettings(safeRegion).then(getRegionFormStatus).catch(() => status);
}


function settingsAllianceTags(settings = {}) {
  const tags = [
    normalizeAllianceTag(settings.hostAlliance || ''),
    normalizeAllianceTag(settings.activeHostAlliance || ''),
    ...(Array.isArray(settings.rotationAlliances) ? settings.rotationAlliances.map(item => normalizeAllianceTag(item?.tag || item?.id || item)) : [])
  ].filter(tag => tag && Array.from(tag).length === 3);
  return [...new Set(tags)];
}

async function ensureSettingsAlliancesInD1(user, region, settings = {}) {
  const safeRegion = normalizeRegion(region);
  const tags = settingsAllianceTags(settings);
  if (!user || !safeRegion || !tags.length) return;
  try {
    const existing = await listRegionAlliances(safeRegion).catch(() => []);
    const existingTags = new Set((Array.isArray(existing) ? existing : []).map(item => normalizeAllianceTag(item.tag || item.id)).filter(Boolean));
    const missing = tags.filter(tag => !existingTags.has(tag));
    if (!missing.length) return;
    await Promise.allSettled(missing.map(tag => saveRegionAllianceD1(user, safeRegion, { tag, name: tag, note: '', updatedAtMs: Date.now() })));
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] settings alliance persistence skipped:', error?.message || error);
  }
}

export async function saveRegionSettings(user, region, settings) {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region);
  const oldSettings = await getRegionSettingsD1First(safeRegion).catch(() => mergeRegionSettings({}));
  const actionSettings = { ...oldSettings, ...settings };
  const canManageFullRegion = canManageRegion(profile, safeRegion, user);
  const canLeadActiveRotation = canLeadCurrentRotation(profile, safeRegion, user, actionSettings);
  if (!canManageFullRegion && !canLeadActiveRotation) throw new Error('region-access-denied');

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
  const rotationEnabled = Boolean(settings.rotationEnabled);
  const rotationLoop = 'rotationLoop' in settings ? Boolean(settings.rotationLoop) : DEFAULT_REGION_FORM.rotationLoop;
  let rotationActiveIndex = Math.max(0, Math.min(Math.max(0, rotationAlliances.length - 1), Number(settings.rotationActiveIndex) || 0));
  const previousHandoverAtMs = Number(oldSettings.rotationHandoverAtMs) || 0;
  if (!forceCloseNow && previousHandoverAtMs && nowMs >= previousHandoverAtMs && rotationEnabled && rotationAlliances.length) {
    const closedIndex = Number.isFinite(Number(oldSettings.rotationClosedActiveIndex)) ? Number(oldSettings.rotationClosedActiveIndex) : rotationActiveIndex;
    rotationActiveIndex = Number.isFinite(Number(oldSettings.rotationNextActiveIndex))
      ? Math.max(0, Math.min(rotationAlliances.length - 1, Number(oldSettings.rotationNextActiveIndex) || 0))
      : nextRotationIndex(closedIndex, rotationAlliances, rotationLoop);
  }
  const enabledNow = forceCloseNow ? false : (forceOpenNow ? true : Boolean(settings.enabled));
  const justOpened = forceOpenNow || Boolean(settings.openNewCycle) || (!oldSettings.enabled && enabledNow);
  const openNewCycle = !forceCloseNow && (Boolean(settings.openNewCycle) || (!oldSettings.enabled && enabledNow));
  // v013: do not silently advance rotation when somebody presses “Start now”.
  // The active alliance is selected in the rotation modal and must remain stable
  // during the opened cycle. Silent auto-advance made the current officer/R4 lose
  // access immediately after opening registration.
  const baseCycleId = makeCycleId(eventStartAtMs);
  const currentCycleId = openNewCycle ? `${baseCycleId}-${Date.now()}` : (oldSettings.currentCycleId || baseCycleId);
  const now = firestoreMod.serverTimestamp();
  const actorName = getRegionActorName(profile || {}, safeRegion, user);
  const actorEmail = ''; // do not expose account email in public region documents
  const requestedHostAlliance = normalizeAllianceTag(settings.hostAlliance || '');
  const rotationHostAlliance = rotationEnabled && rotationAlliances[rotationActiveIndex]
    ? normalizeAllianceTag(rotationAlliances[rotationActiveIndex].tag)
    : '';
  const activeHostBeforeClose = normalizeAllianceTag(oldSettings.hostAlliance || oldSettings.activeHostAlliance || requestedHostAlliance || '');
  const visibleHostAlliance = forceCloseNow
    ? ''
    : (rotationHostAlliance || requestedHostAlliance);
  const activeHostAlliance = forceCloseNow
    ? activeHostBeforeClose
    : (enabledNow ? visibleHostAlliance : normalizeAllianceTag(oldSettings.activeHostAlliance || visibleHostAlliance || ''));
  const rotationClosedActiveIndex = forceCloseNow
    ? rotationActiveIndex
    : (Number.isFinite(Number(oldSettings.rotationClosedActiveIndex)) ? Number(oldSettings.rotationClosedActiveIndex) : rotationActiveIndex);
  const rotationNextActiveIndex = forceCloseNow
    ? nextRotationIndex(rotationActiveIndex, rotationAlliances, rotationLoop)
    : (Number.isFinite(Number(oldSettings.rotationNextActiveIndex)) ? Number(oldSettings.rotationNextActiveIndex) : nextRotationIndex(rotationClosedActiveIndex, rotationAlliances, rotationLoop));
  const rotationHandoverAtMs = forceCloseNow
    ? computeRotationHandoverAtMs(nowMs)
    : (enabledNow ? 0 : (previousHandoverAtMs && nowMs < previousHandoverAtMs ? previousHandoverAtMs : 0));

  const clean = {
    enabled: enabledNow,
    title: trim(settings.title) || DEFAULT_REGION_FORM.title,
    description: trim(settings.description) || DEFAULT_REGION_FORM.description,
    hostAlliance: visibleHostAlliance,
    activeHostAlliance,
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
    rotationLoop,
    rotationActiveIndex,
    rotationClosedActiveIndex,
    rotationNextActiveIndex,
    rotationHandoverAtMs,
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

  await ensureSettingsAlliancesInD1(user, safeRegion, clean);

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

  let shortCode = normalizeShortLinkCode(settings.shortLinkCode || settings.code || oldSettings.shortLinkCode || oldSettings.code || '');
  if (openNewCycle) shortCode = makeShortLinkCode();
  if (canManageFullRegion) {
    await firestoreMod.setDoc(firestoreMod.doc(db, 'regions', safeRegion), regionPatch, { merge: true });
    if (!openNewCycle) {
      const shortLinkSnap = await firestoreMod.getDoc(firestoreMod.doc(db, 'regions', safeRegion, 'privateSettings', 'shortLink')).catch(() => null);
      shortCode = normalizeShortLinkCode(shortLinkSnap?.exists?.() ? shortLinkSnap.data()?.code : '') || shortCode;
    }
  }

  const formSettingsForD1 = { ...clean, shortLinkCode: shortCode, code: shortCode };
  const d1Save = await publishRegionFormSettings(user, {
    region: safeRegion,
    code: shortCode,
    cycleId: currentCycleId,
    forceNewCode: openNewCycle,
    openNewCycle,
    settings: formSettingsForD1,
    updatedAtMs: nowMs
  }).catch(error => ({ ok: false, skipped: true, error: error?.message || String(error) }));
  shortCode = normalizeShortLinkCode(d1Save?.form?.code || d1Save?.code || shortCode);
  if (!canManageFullRegion && (!d1Save || d1Save.ok === false || d1Save.skipped)) {
    throw new Error(d1Save?.error || 'region-form-d1-save-required');
  }
  await writeRegionActionLog(canManageFullRegion ? { db, firestoreMod } : null, user, profile, safeRegion, forceCloseNow ? 'registration_closed' : (forceOpenNow || openNewCycle ? 'registration_started' : 'registration_settings_saved'), { summary: clean.enabled ? 'Форма відкрита' : 'Форма закрита', alliance: clean.hostAlliance || actorAllianceForRegion(profile, safeRegion) || '' });

  const campaignType = canManageFullRegion ? (forceCloseNow ? 'registration_closed' : (justOpened ? 'registration_opened' : '')) : '';
  if (campaignType) {
    await createRegionNotificationCampaign({
      type: campaignType,
      region: safeRegion,
      cycleId: currentCycleId,
      titleKey: campaignType === 'registration_closed' ? 'notifications.campaign.registrationClosedTitle' : 'notifications.campaign.registrationOpenedTitle',
      messageKey: campaignType === 'registration_closed' ? 'notifications.campaign.registrationClosedMessage' : 'notifications.campaign.registrationOpenedMessage',
      actorUid: user.uid,
      actorName,
      actorRole: normalizeUserRole(profile?.role || 'player'),
      actorRoleText: roleLabel(normalizeUserRole(profile?.role || 'player')),
      targetLabel: `R${safeRegion}`
    }).catch(error => { if (window.WKD_DEBUG) console.warn('[WKD] region campaign notification skipped:', error); });
  }

  if (openNewCycle) {
    // v026: D1 /api/region-form/settings already resets the active table and runs server auto-submit.
    // Do NOT publish an empty table snapshot afterwards, because it overwrites auto-submitted rows.
    if (!d1Save || d1Save.ok === false || d1Save.skipped) {
      await publishSnapshotToRegionTableCache(user, {
        region: safeRegion,
        cycleId: currentCycleId || '',
        settings: clean || {},
        rows: []
      }).catch(error => { if (window.WKD_DEBUG) console.warn('[WKD] empty D1 table for new cycle skipped:', error); });
    }
    await rotateRegionPublicSharesForNewCycle(user, safeRegion).catch(() => null);
  }

  if (!canManageFullRegion) {
    return { ...clean, shortLinkCode: shortCode, code: shortCode, finalPlanShareCode: '', openedNewCycle: openNewCycle, cleanupDeletedCount: 0, source: 'cloudflare-d1-form-settings' };
  }

  const cleanup = { deletedCount: 0, skipped: 'manual-cleanup-only' };
  const shortLinkCode = await saveRegionShareLink({ db, firestoreMod }, user, safeRegion, { ...clean, shortLinkCode: shortCode, code: shortCode }, openNewCycle);
  const finalPlanShareCode = await saveRegionFinalPlanShareLink({ db, firestoreMod }, user, safeRegion, clean, openNewCycle).catch(error => {
    if (window.WKD_DEBUG) console.warn('[WKD] final plan share code skipped:', error);
    return '';
  });
  return { ...clean, shortLinkCode, finalPlanShareCode, openedNewCycle: openNewCycle, cleanupDeletedCount: cleanup.deletedCount || 0 };
}

function normalizeAllianceTag(value = '') {
  return Array.from(trim(value).replace(/[\/\[\]#?]/g, '')).slice(0, 3).join('');
}

async function getCurrentFirebaseUser() {
  try {
    const firebase = await getFirebase();
    return firebase?.auth?.currentUser || null;
  } catch {
    return null;
  }
}

export async function listRegionAlliances(region) {
  const safeRegion = normalizeRegion(region);
  if (!safeRegion) throw new Error('region-required');

  const actor = await getCurrentFirebaseUser();
  let d1WasEmpty = false;
  if (actor) {
    try {
      const result = await readRegionAlliancesD1(actor, safeRegion);
      if (Array.isArray(result?.items) && result.items.length) return result.items;
      d1WasEmpty = Array.isArray(result?.items) && result.items.length === 0;
    } catch (error) {
      if (window.WKD_DEBUG) console.warn('[WKD] D1 alliance list unavailable, using legacy fallback:', error?.message || error);
    }
  }

  const { db, firestoreMod } = await getFirebaseParts();
  const snapshot = await firestoreMod.getDocs(firestoreMod.collection(db, 'regions', safeRegion, 'alliances'));
  trackReads(Math.max(1, snapshot.docs.length));
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
  const items = [...seen.values()].sort((a, b) => String(a.tag || a.id).localeCompare(String(b.tag || b.id), 'uk'));
  if (actor && items.length && d1WasEmpty) {
    Promise.allSettled(items.map(item => saveRegionAllianceD1(actor, safeRegion, {
      tag: item.tag || item.id,
      name: item.name || item.tag || item.id,
      note: item.note || '',
      colorHue: item.colorHue ?? null,
      colorMode: item.colorMode || (item.colorHue == null ? 'auto' : 'manual')
    }))).catch(error => { if (window.WKD_DEBUG) console.warn('[WKD] legacy alliances D1 migration skipped:', error); });
  }
  return items;
}


export function canManageAllianceColors(profile = {}, region = '', tag = '', actor = null) {
  const safeRegion = normalizeRegion(region);
  const role = roleForRegion(profile, safeRegion, actor);
  const game = gameForRegion(profile || {}, safeRegion) || bestRegionGame(profile || {});
  const wanted = normalizeAllianceTag(tag);
  const sameRegion = canViewRegion(profile, safeRegion, actor);
  const ownAlliance = wanted && normalizeAllianceTag(game.alliance) === wanted;
  const rank = trim(game.rank).toLowerCase();
  if (role === 'admin' || role === 'moderator') return true;
  if (role === 'consul' && sameRegion) return true;
  if (role === 'officer' && sameRegion && ownAlliance && ['p4', 'p5', 'r4', 'r5', '4', '5'].includes(rank)) return true;
  // R5/P5 can edit only their own alliance record. They still cannot delete alliances.
  if (sameRegion && ownAlliance && ['p5', 'r5', '5'].includes(rank)) return true;
  return false;
}

export function canDeleteRegionAllianceTag(profile = {}, region = '', actor = null) {
  const safeRegion = normalizeRegion(region);
  const role = roleForRegion(profile, safeRegion, actor);
  return ['admin', 'moderator', 'consul'].includes(role) && canViewRegion(profile, safeRegion, actor);
}

export async function saveRegionAllianceColor(user, region, tagValue, hueValue = null) {
  if (!user) throw new Error('auth-required');
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region);
  const tag = normalizeAllianceTag(tagValue);
  if (!safeRegion || !tag || Array.from(tag).length !== 3) throw new Error('alliance-color-required');
  if (!canManageAllianceColors(profile, safeRegion, tag, user)) throw new Error('alliance-color-access');
  const hueNumber = Number(hueValue);
  const hue = Number.isFinite(hueNumber) ? ((Math.round(hueNumber) % 360) + 360) % 360 : null;
  const existingAlliance = (await listRegionAlliances(safeRegion).catch(() => []))
    .find(item => normalizeAllianceTag(item.tag || item.id) === tag) || {};
  const d1Patch = {
    tag,
    name: trim(existingAlliance.name || tag),
    note: trim(existingAlliance.note || ''),
    colorHue: hue,
    colorMode: hue === null ? 'auto' : 'manual',
    updatedAtMs: Date.now()
  };
  try {
    const result = await saveRegionAllianceD1(user, safeRegion, d1Patch);
    if (result?.ok !== false) return { id: tag, ...d1Patch, ...(result.item || {}), colorHue: hue, d1Only: true };
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] D1 alliance color save fallback:', error?.message || error);
  }

  const { db, firestoreMod } = await getFirebaseParts();
  const patch = hue === null
    ? { tag, colorHue: null, colorMode: 'auto', colorUpdatedAt: firestoreMod.serverTimestamp(), colorUpdatedBy: user.uid }
    : { tag, colorHue: hue, colorMode: 'manual', colorUpdatedAt: firestoreMod.serverTimestamp(), colorUpdatedBy: user.uid };
  await firestoreMod.setDoc(firestoreMod.doc(db, 'regions', safeRegion, 'alliances', tag), patch, { merge: true });
  trackWrites(1);
  return { id: tag, ...patch, colorHue: hue };
}

export async function saveRegionAlliance(user, region, values = {}) {
  if (!user) throw new Error('auth-required');
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region);
  const tag = normalizeAllianceTag(values.tag || values.id);
  if (!tag || Array.from(tag).length !== 3) throw new Error('alliance-tag-required');
  if (!canManageAllianceColors(profile, safeRegion, tag, user)) throw new Error('region-access-denied');
  const hueValue = values.colorHue;
  const hueNumber = Number(hueValue);
  const existingAlliance = (await listRegionAlliances(safeRegion).catch(() => []))
    .find(item => normalizeAllianceTag(item.tag || item.id) === tag) || {};
  const clean = {
    tag,
    name: trim(values.name || existingAlliance.name || tag),
    note: trim(values.note ?? existingAlliance.note ?? ''),
    updatedAtMs: Date.now()
  };
  if (!('colorHue' in values) && existingAlliance && 'colorHue' in existingAlliance) {
    const existingHueNumber = Number(existingAlliance.colorHue);
    clean.colorHue = Number.isFinite(existingHueNumber) ? ((Math.round(existingHueNumber) % 360) + 360) % 360 : null;
    clean.colorMode = clean.colorHue === null ? 'auto' : (existingAlliance.colorMode || 'manual');
  }
  if ('colorHue' in values) {
    clean.colorHue = hueValue === null || hueValue === '' || hueValue === undefined
      ? null
      : (Number.isFinite(hueNumber) ? ((Math.round(hueNumber) % 360) + 360) % 360 : null);
    clean.colorMode = clean.colorHue === null ? 'auto' : 'manual';
  }

  try {
    const result = await saveRegionAllianceD1(user, safeRegion, clean);
    if (result?.ok !== false) {
      await writeRegionActionLog(null, user, profile, safeRegion, 'alliance_saved', { alliance: tag, summary: clean.name || tag });
      return { id: tag, ...clean, ...(result.item || {}), d1Only: true };
    }
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] D1 alliance save fallback:', error?.message || error);
  }

  const { db, firestoreMod } = await getFirebaseParts();
  const ref = firestoreMod.doc(db, 'regions', safeRegion, 'alliances', tag);
  const old = await firestoreMod.getDoc(ref);
  trackReads(1);
  const now = firestoreMod.serverTimestamp();
  const firestoreClean = {
    tag,
    name: clean.name,
    note: clean.note,
    updatedAt: now,
    updatedBy: user.uid
  };
  if ('colorHue' in values) {
    firestoreClean.colorHue = clean.colorHue;
    firestoreClean.colorMode = clean.colorMode;
    firestoreClean.colorUpdatedAt = now;
    firestoreClean.colorUpdatedBy = user.uid;
  }
  if (!old.exists()) firestoreClean.createdAt = now;
  await firestoreMod.setDoc(ref, firestoreClean, { merge: true });
  trackWrites(1);
  await writeRegionActionLog({ db, firestoreMod }, user, profile, safeRegion, 'alliance_saved', { alliance: tag, summary: firestoreClean.name || tag });
  return { id: tag, ...firestoreClean };
}

export async function deleteRegionAlliance(user, region, allianceId) {
  if (!user) throw new Error('auth-required');
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region);
  const tag = normalizeAllianceTag(allianceId);
  if (!tag) throw new Error('alliance-tag-required');
  if (!canDeleteRegionAllianceTag(profile, safeRegion, user)) throw new Error('region-access-denied');
  try {
    const result = await deleteRegionAllianceD1(user, safeRegion, tag);
    if (result?.ok !== false) {
      await writeRegionActionLog(null, user, profile, safeRegion, 'alliance_deleted', { alliance: tag, summary: tag });
      return { region: safeRegion, tag, d1Only: true };
    }
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] D1 alliance delete fallback:', error?.message || error);
  }

  const { db, firestoreMod } = await getFirebaseParts();
  await firestoreMod.deleteDoc(firestoreMod.doc(db, 'regions', safeRegion, 'alliances', tag));
  trackDeletes(1);
  await writeRegionActionLog({ db, firestoreMod }, user, profile, safeRegion, 'alliance_deleted', { alliance: tag, summary: tag });
  return { region: safeRegion, tag };
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

function normalizeNicknameLockKey(value = '') {
  return trim(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ');
}

function simpleHash(value = '') {
  let hash = 5381;
  for (const char of String(value || '')) {
    hash = ((hash << 5) + hash + char.codePointAt(0)) >>> 0;
  }
  return hash.toString(36);
}

function nicknameLockDocId(data = {}) {
  const cycle = safeDocPart(data.cycleId || 'cycle');
  const nickKey = normalizeNicknameLockKey(data.nickname);
  const visible = safeDocPart(nickKey).slice(0, 40) || 'nick';
  return `${cycle}_${simpleHash(`${data.region || ''}|${data.cycleId || ''}|${nickKey}`)}_${visible}`.slice(0, 180);
}

function nicknameLockRef(firestoreMod, db, region, data = {}) {
  return firestoreMod.doc(db, 'regions', region, 'nicknameLocks', nicknameLockDocId({ ...data, region }));
}

function nicknameLockPayload(data = {}, registrationId = '', user = null) {
  const nickKey = normalizeNicknameLockKey(data.nickname);
  return {
    region: normalizeRegion(data.region),
    cycleId: trim(data.cycleId),
    nickname: trim(data.nickname),
    nickKey,
    registrationId: trim(registrationId),
    ownerUid: trim(data.uid || user?.uid || ''),
    farmId: trim(data.farmId || 'main') || 'main',
    createdByAuth: Boolean(data.uid || user?.uid),
    publicLink: Boolean(data.publicLink),
    source: trim(data.source || (data.publicLink ? 'public-link' : 'account')),
    updatedAtMs: Date.now()
  };
}

async function assertRegionNicknameFree(firestoreMod, db, region, data = {}, currentDocIds = [], registrationId = '', user = null) {
  const nickKey = normalizeNicknameLockKey(data.nickname);
  if (!nickKey || !data.cycleId) return null;
  const ownIds = new Set((Array.isArray(currentDocIds) ? currentDocIds : [currentDocIds]).filter(Boolean).map(String));
  if (registrationId) ownIds.add(String(registrationId));
  const ref = nicknameLockRef(firestoreMod, db, region, data);
  const snap = await firestoreMod.getDoc(ref).catch(() => null);
  trackReads(1);
  if (snap?.exists?.()) {
    const lock = snap.data() || {};
    const lockedRegistrationId = trim(lock.registrationId);
    const lockedUid = trim(lock.ownerUid);
    const lockedFarmId = trim(lock.farmId || 'main') || 'main';
    const sameRegistration = lockedRegistrationId && ownIds.has(lockedRegistrationId);
    const sameOwnerFarm = data.uid && lockedUid === trim(data.uid) && lockedFarmId === (trim(data.farmId || 'main') || 'main');
    if (!sameRegistration && !sameOwnerFarm) throw new Error('registration-nickname-duplicate-region');
  }
  return { ref, payload: nicknameLockPayload({ ...data, region }, registrationId || [...ownIds][0] || '', user), id: ref.id };
}

function applyNicknameLockToBatch(batch, lock, firestoreMod, createOnly = false) {
  if (!lock?.ref || !lock?.payload) return 0;
  const payload = {
    ...lock.payload,
    updatedAt: firestoreMod.serverTimestamp(),
    updatedAtMs: Date.now()
  };
  if (createOnly) {
    payload.createdAt = firestoreMod.serverTimestamp();
    payload.createdAtMs = Date.now();
  }
  if (createOnly) batch.set(lock.ref, payload);
  else batch.set(lock.ref, payload, { merge: true });
  return 1;
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
  const nowMs = Date.now();
  const collectionRef = firestoreMod.collection(db, 'regions', region, 'wastelandRegistrations');
  const payload = { ...data, updatedAt: now, submittedAt: now, updatedAtMs: nowMs, submittedAtMs: nowMs, expiresAtMs: nowMs + REGION_REGISTRATION_RETENTION_MS };

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
    const lock = await assertRegionNicknameFree(firestoreMod, db, region, data, [docId, legacyDocId], docId, user);
    const batch = firestoreMod.writeBatch(db);
    applyNicknameLockToBatch(batch, lock, firestoreMod, !lock?.payload?.ownerUid);
    if (managerCanEdit) batch.set(docRef, payload, { merge: true });
    else batch.set(docRef, payload);
    await batch.commit();
    trackWrites(1 + (lock ? 1 : 0));
  } else {
    const docRef = firestoreMod.doc(collectionRef);
    const docId = docRef.id;
    const lock = await assertRegionNicknameFree(firestoreMod, db, region, data, [docId], docId, null);
    const batch = firestoreMod.writeBatch(db);
    applyNicknameLockToBatch(batch, lock, firestoreMod, true);
    batch.set(docRef, payload);
    await batch.commit();
    trackWrites(1 + (lock ? 1 : 0));
  }
  removeCache(`regionRegistrations.${region}.${status.currentCycleId || 'no-cycle'}.v139`);

  if (user?.uid) {
    await mirrorRegistrationToRegionTableCache(user, region, { ...data, uid: user.uid }, status);
  }

  // Ordinary player registrations are intentionally not written to Action Log.
  // They are visible in the region table, and skipping this log prevents thousands of extra Firebase writes during mass registration.
  if (user?.uid) {
    const actorGame = gameForRegion(profile || {}, region) || bestRegionGame(profile || {});
    await createUserNotification(user.uid, {
      type: 'registration_submitted',
      title: serviceT('notifications.registrationSubmitted', 'Заявку відправлено'),
      message: `R${region} · ${data.nickname || ''}`,
      region,
      alliance: data.alliance,
      actorUid: user.uid,
      actorName: getRegionActorName(profile || {}, region, user) || data.nickname || user.uid,
      actorRole: roleForRegion(profile || {}, region, user),
      actorRoleText: roleLabel(roleForRegion(profile || {}, region, user)),
      targetType: 'region',
      targetLabel: `R${region}${actorGame?.nickname ? ` · ${actorGame.nickname}` : ''}`
    }).catch(() => null);
  }
  return data;
}

export async function getMyWastelandRegistration(user, regionOverride = '', farmId = 'main') {
  if (!user) return null;
  const safeRegion = normalizeRegion(regionOverride);
  const region = safeRegion || (await getMyRegionContext(user)).region;
  const settings = await getRegionSettings(region);
  const activeCycle = settings.currentCycleId;
  const safeFarmId = trim(farmId || 'main') || 'main';

  // v154: D1 table snapshot is the source for active wasteland requests.
  // Firebase is used only as a fallback for older cycles / old deployments.
  const d1Saved = await readMyRegistrationFromD1Cache(user, region, safeFarmId, { cycleId: activeCycle }).catch(() => null);
  if (d1Saved) return d1Saved;

  const { db, firestoreMod } = await getFirebaseParts();
  const docId = userRegistrationDocId(user.uid, safeFarmId, activeCycle);
  const legacyDocId = legacyUserRegistrationDocId(user.uid, safeFarmId);
  const refs = [docId, legacyDocId].filter((id, index, arr) => id && arr.indexOf(id) === index);
  for (const id of refs) {
    const snap = await firestoreMod.getDoc(firestoreMod.doc(db, 'regions', region, 'wastelandRegistrations', id));
    trackReads(1);
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
  const wantsD1Only = Boolean(options?.d1Only || options?.noFirestoreFallback || options?.preventFirestoreFallback);

  if (!options?.skipD1) {
    const snapshot = await readSnapshotFromRegionTableCache(user, region, { force: Boolean(options?.forceD1), ttlMs: options?.d1TtlMs });
    if (snapshot && Array.isArray(snapshot.rows)) {
      const snapshotRegion = normalizeRegion(snapshot.region || region);
      if (snapshotRegion && snapshotRegion !== region) {
        if (window.WKD_DEBUG) console.warn('[WKD] ignored D1 snapshot for another region:', snapshotRegion, 'requested:', region);
      } else {
        const d1Settings = getRegionFormStatus(snapshot.settings || {});
        const rows = snapshot.rows
          .filter(row => !normalizeRegion(row.region || '') || normalizeRegion(row.region || '') === region)
          .map(row => ({ ...row, region }));
        return {
          profile,
          region,
          settings: d1Settings,
          rows,
          summary: snapshot.summary || null,
          cached: Boolean(snapshot.cached),
          source: snapshot.source || 'cloudflare-d1-snapshot'
        };
      }
    }
    if (wantsD1Only) {
      return {
        profile,
        region,
        settings: getRegionFormStatus({}),
        rows: [],
        cached: false,
        d1Missing: true,
        requiresManualFirestoreFallback: true,
        source: 'cloudflare-d1-missing-no-firestore'
      };
    }
  }

  let settings = await getRegionSettings(region);
  let status = getRegionFormStatus(settings);
  if (canManageRegion(profile, region, user) && status.enabled && (!status.openedAtMs || !(status.openedByName || status.openedByEmail || status.openedByUid))) {
    status = await ensureRegionRegistrationRunInfo(user, region).catch(error => {
      if (window.WKD_DEBUG) console.warn('[WKD] registration run info repair skipped:', error);
      return status;
    });
    settings = status;
  }
  if (options?.cleanup === true) {
    await cleanupOldRegionRegistrations(user, region).catch(error => { if (window.WKD_DEBUG) console.warn('[WKD] old registration cleanup skipped:', error); });
  }

  const cacheKey = `regionRegistrations.${region}.${status.currentCycleId || 'no-cycle'}.v139`;
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
  await publishSnapshotToRegionTableCache(user, {
    region,
    cycleId: status.currentCycleId || '',
    settings: status || {},
    rows
  });
  return { profile, region, settings: status, rows, source: 'firebase-fallback' };
}

export async function deleteRegionRegistrations(user, region, registrationIds = []) {
  if (!user) throw new Error('auth-required');
  const ids = (Array.isArray(registrationIds) ? registrationIds : [registrationIds])
    .map(id => trim(id))
    .filter(Boolean);
  if (!ids.length) return { count: 0 };

  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region || getGameProfile(profile || {}).region);
  if (!safeRegion) throw new Error('region-required');
  if (!canDeleteRegionRegistration(profile, safeRegion, user)) throw new Error('region-delete-access-denied');

  const d1Delete = await deleteRegionTableRowsD1(user, safeRegion, ids).catch(error => {
    if (window.WKD_DEBUG) console.warn('[WKD] D1 delete region rows fallback:', error?.message || error);
    return null;
  });
  if (d1Delete?.ok && !d1Delete?.skipped) {
    removeCache(`regionRegistrations.${safeRegion}.no-cycle.v139`);
    return { count: Number(d1Delete.deleted || ids.length) || ids.length, region: safeRegion, d1First: true, result: d1Delete };
  }

  const { db, firestoreMod } = await getFirebaseParts();
  const registrationSnaps = await Promise.all(
    ids.map(id => firestoreMod.getDoc(firestoreMod.doc(db, 'regions', safeRegion, 'wastelandRegistrations', id)).catch(() => null))
  );
  trackReads(ids.length);

  let lockDeletes = 0;
  for (let index = 0; index < ids.length; index += 225) {
    const batch = firestoreMod.writeBatch(db);
    ids.slice(index, index + 225).forEach((id, localIndex) => {
      const snap = registrationSnaps[index + localIndex];
      const row = snap?.exists?.() ? { id, ...snap.data() } : null;
      if (row?.nickname && row?.cycleId) {
        const lockRef = nicknameLockRef(firestoreMod, db, safeRegion, row);
        batch.delete(lockRef);
        lockDeletes += 1;
      }
      batch.delete(firestoreMod.doc(db, 'regions', safeRegion, 'wastelandRegistrations', id));
    });
    await batch.commit();
  }
  trackDeletes(ids.length + lockDeletes);
  removeCache(`regionRegistrations.${safeRegion}.no-cycle.v139`);
  registrationSnaps.forEach(snap => {
    const cycle = snap?.exists?.() ? trim(snap.data()?.cycleId || '') : '';
    if (cycle) removeCache(`regionRegistrations.${safeRegion}.${cycle}.v139`);
  });

  await writeRegionActionLog({ db, firestoreMod }, user, profile, safeRegion, 'registration_deleted', { summary: `${ids.length}` }).catch(() => null);

  return { count: ids.length, region: safeRegion, optimized: true };
}


function cleanRegionRegistrationEditInput(input = {}, existingData = {}) {
  const troopType = normalizePlayerTroopType(input.troopType || input.troopLabel || input.mainTroopType || input.primaryTroopType || input['Тип військ'] || input['Troop type'] || input.role);
  const shift = trim(input.shift || input.shiftLabel || 'both');
  const hasCaptainField = Object.prototype.hasOwnProperty.call(input, 'captain') || Object.prototype.hasOwnProperty.call(input, 'captainReady');
  return {
    nickname: trim(input.name || input.nickname),
    alliance: normalizeAllianceTag(input.alliance),
    troopType,
    troopLabel: troopLabel(troopType),
    tier: normalizeTier(input.tier || 'T10'),
    lairLevel: lairLevelValue(input.lairLevel || input.denLevel),
    captureRegion: /^(1|true|yes|так|да|y)$/i.test(String(input.lair || input.captureRegion || '').trim()),
    marchSize: numberValue(input.march ?? input.marchSize),
    rallySize: numberValue(input.rally ?? input.rallySize),
    captainReady: hasCaptainField ? Boolean(input.captain || input.captainReady) : Boolean(existingData.captainReady),
    shift,
    shiftLabel: shiftLabel(shift)
  };
}

function sameRegionRegistrationEditData(left = {}, right = {}) {
  return ['nickname', 'alliance', 'troopType', 'troopLabel', 'tier', 'lairLevel', 'captureRegion', 'marchSize', 'rallySize', 'captainReady', 'shift', 'shiftLabel']
    .every(key => left[key] === right[key]);
}

export async function updateRegionRegistration(user, region, registrationId, values = {}) {
  if (!user) throw new Error('auth-required');
  const id = trim(registrationId);
  if (!id) throw new Error('region-update-registration-only');

  const { db, firestoreMod } = await getFirebaseParts();
  const profile = await getUserProfile(user.uid);
  const safeRegion = normalizeRegion(region || getGameProfile(profile || {}).region);
  if (!safeRegion) throw new Error('region-required');
  let regionAccessSettings = null;
  if (!canManageRegion(profile, safeRegion, user)) {
    regionAccessSettings = await getRegionSettings(safeRegion).catch(() => ({}));
    if (!canLeadCurrentRotation(profile, safeRegion, user, regionAccessSettings || {})) {
      throw new Error('region-update-access-denied');
    }
  }

  const d1Update = await updateRegionTableRowD1First(user, safeRegion, id, values, values?.cycleId ? { currentCycleId: values.cycleId } : {});
  if (d1Update?.ok) {
    removeCache(`regionRegistrations.${safeRegion}.no-cycle.v139`);
    const cycle = trim(d1Update?.table?.cycleId || d1Update?.cycleId || values?.cycleId || '');
    if (cycle) removeCache(`regionRegistrations.${safeRegion}.${cycle}.v139`);
    return {
      region: safeRegion,
      id,
      data: d1Update.row || { id, ...values, region: safeRegion },
      d1First: true,
      skipped: Boolean(d1Update.notWritten || d1Update.unchanged),
      unchanged: Boolean(d1Update.notWritten || d1Update.unchanged),
      result: d1Update
    };
  }

  const registrationRef = firestoreMod.doc(db, 'regions', safeRegion, 'wastelandRegistrations', id);
  const existingSnap = await firestoreMod.getDoc(registrationRef).catch(() => null);
  trackReads(1);
  const existingData = existingSnap?.exists?.() ? { id, ...existingSnap.data() } : {};
  if (!existingSnap?.exists?.()) throw new Error('region-registration-not-found');

  const mergedInput = { ...existingData, ...(values || {}) };
  const oldClean = cleanRegionRegistrationEditInput(existingData, existingData);
  const nextClean = cleanRegionRegistrationEditInput(mergedInput, existingData);

  if (!nextClean.nickname || !nextClean.alliance || !nextClean.troopType || !nextClean.shift) {
    throw new Error('registration-invalid');
  }

  let activeSettings = null;
  let activeCycle = trim(existingData.cycleId || '');
  if (!activeCycle) {
    activeSettings = await getRegionSettings(safeRegion).catch(() => ({}));
    activeCycle = trim(activeSettings.currentCycleId || '');
  }

  const oldLockSeed = { ...existingData, region: safeRegion, cycleId: trim(existingData.cycleId || activeCycle) };
  const nextWithCycle = { ...nextClean, region: safeRegion, cycleId: activeCycle };
  const nicknameLockChanged = Boolean(activeCycle)
    && nicknameLockDocId(oldLockSeed) !== nicknameLockDocId(nextWithCycle);
  const dataChanged = !sameRegionRegistrationEditData(oldClean, nextClean);

  if (!dataChanged && !nicknameLockChanged) {
    return { region: safeRegion, id, data: existingData, skipped: true, unchanged: true };
  }

  let lock = null;
  let oldLockRef = null;
  let newLockRef = null;
  let deleteOldLock = false;
  if (nicknameLockChanged) {
    lock = await assertRegionNicknameFree(firestoreMod, db, safeRegion, nextWithCycle, [id], id, user);
    oldLockRef = existingData.nickname && (existingData.cycleId || activeCycle)
      ? nicknameLockRef(firestoreMod, db, safeRegion, oldLockSeed)
      : null;
    newLockRef = lock?.ref || null;
    deleteOldLock = Boolean(oldLockRef && (!newLockRef || oldLockRef.path !== newLockRef.path));
  }

  const clean = dataChanged
    ? {
        ...nextClean,
        updatedAt: firestoreMod.serverTimestamp(),
        updatedBy: user.uid,
        manuallyEdited: true
      }
    : {};

  const batch = firestoreMod.writeBatch(db);
  if (deleteOldLock) batch.delete(oldLockRef);
  const lockWrites = nicknameLockChanged ? applyNicknameLockToBatch(batch, lock, firestoreMod, false) : 0;
  if (dataChanged) batch.set(registrationRef, clean, { merge: true });
  await batch.commit();

  if (dataChanged) trackWrites(1);
  if (lockWrites) trackWrites(lockWrites);
  if (deleteOldLock) trackDeletes(1);

  removeCache(`regionRegistrations.${safeRegion}.no-cycle.v139`);
  if (activeCycle) removeCache(`regionRegistrations.${safeRegion}.${activeCycle}.v139`);

  const mirrorSettings = activeSettings || { currentCycleId: activeCycle };
  await mirrorRegistrationToRegionTableCache(user, safeRegion, {
    id,
    ...existingData,
    ...nextWithCycle,
    rowType: existingData.rowType || 'Заявка'
  }, mirrorSettings).catch(() => null);

  return { region: safeRegion, id, data: { ...nextClean, region: safeRegion, cycleId: activeCycle }, optimized: true };
}

function normalizePlayerTroopType(value = '') {
  const text = trim(value).toLowerCase();
  if (!text || isAccountRoleText(text)) return '';
  if (/fighter|fighters|infantry|бійц|боєц|боец|бойц|воїн|воин|піхот|пехот|wojownik|wojown|kämpfer|kaempfer|ファイター|战士|戰士|전사|đấu sĩ|dau si|مقاتل|المقاتل/.test(text)) return 'fighter';
  if (/rider|riders|cavalry|наїз|наезд|ездник|кавал|jeźdź|jezdz|reiter|ライダー|骑兵|騎兵|기병|kỵ sĩ|ky si|فارس|فرسان|الفرسان/.test(text)) return 'rider';
  if (/shooter|shooters|стріл|стрел|shoot|marksman|strzel|schütz|schuetz|シューター|射手|사수|xạ thủ|xa thu|رامي|الرماة/.test(text)) return 'shooter';
  return '';
}

function importDocId(userId = '', player = {}, index = 0) {
  const base = `${player.name || player.nickname || 'player'}-${player.alliance || ''}-${index}`
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ_-]+/giu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `row-${index + 1}`;
  return `local_${userId}_${base}`;
}

function localImportValue(player = {}, keys = []) {
  for (const key of keys) {
    if (player[key] !== undefined && player[key] !== null && String(player[key]).trim() !== '') return player[key];
  }
  return '';
}

function localImportTroopType(player = {}) {
  const directKeys = [
    'troopType', 'troopLabel', 'mainTroopType', 'primaryTroopType',
    'Тип військ', 'тип військ', 'Тип войск', 'тип войск', 'Війська', 'Войска',
    'Troop type', 'troop type', 'Unit type', 'unit type', 'Type of troops', 'type'
  ];
  for (const key of directKeys) {
    const troop = normalizePlayerTroopType(player[key]);
    if (troop) return troop;
  }
  const headerRe = /(troop|unit|army|soldier|type|військ|войск|війська|войска|тип|兵|部隊|병과|loại quân|نوع)/i;
  for (const [header, value] of Object.entries(player || {})) {
    if (!headerRe.test(String(header || ''))) continue;
    const troop = normalizePlayerTroopType(value);
    if (troop) return troop;
  }
  for (const value of Object.values(player || {})) {
    const troop = normalizePlayerTroopType(value);
    if (troop) return troop;
  }
  return '';
}

function localImportTier(player = {}) {
  const value = localImportValue(player, [
    'tier', 'tierLabel', 'tierLevel', 'mainTier', 'main_tier',
    'Тір військ', 'Тір', 'тір', 'Тир', 'тир', 'Рівень', 'рівень', 'Tier', 'tier войск'
  ]);
  return normalizeTier(value || '');
}

function localImportMarch(player = {}) {
  return numberValue(localImportValue(player, [
    'march', 'marchSize', 'mainMarchSize', 'mainMarch', 'march_size',
    'Розмір маршу', 'розмір маршу', 'Марш', 'марш', 'March size', 'march size', 'March'
  ]));
}

function localImportRally(player = {}) {
  return numberValue(localImportValue(player, [
    'rally', 'rallySize', 'mainRallySize', 'mainRally', 'rally_size',
    'Розмір ралі', 'розмір ралі', 'Ралі', 'ралі', 'Rally size', 'rally size', 'Group attack size'
  ]));
}

function playerToImportedRegistration(player = {}, user = {}, profile = {}, region = '', settings = {}) {
  const troopType = localImportTroopType(player);
  const shift = trim(player.shift || player.shiftLabel || player.registeredShift || localImportValue(player, ['Зміна', 'зміна', 'Shift', 'Доступність по змінах']) || 'both');
  const tier = localImportTier(player);
  const marchSize = localImportMarch(player);
  const rallySize = localImportRally(player);
  const nowMs = Date.now();
  return {
    uid: '',
    ownerUid: user.uid,
    importedBy: user.uid,
    displayName: user.displayName || profile.displayName || '',
    nickname: trim(player.name || player.nickname || localImportValue(player, ['Нік гравця', 'Нік', 'нік', 'Player name', 'Nickname'])),
    region,
    alliance: normalizeAllianceTag(player.alliance || localImportValue(player, ['Альянс', 'альянс', 'Alliance'])),
    rank: '',
    shk: '',
    readyToJoin: true,
    readyToAttack: false,
    captainReady: Boolean(player.captain || player.captainReady),
    shift,
    shiftLabel: shiftLabel(shift),
    troopType,
    troopLabel: troopLabel(troopType, settings),
    tier,
    lairLevel: lairLevelValue(player.lairLevel || player.denLevel || localImportValue(player, ['Розмір лігва', 'Лігво', 'lairLevel', 'Lair level'])),
    captureRegion: /^(1|true|yes|так|да|y)$/i.test(String(player.lair || player.captureRegion || '').trim()),
    marchSize,
    rallySize,
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

function localImportRegistrationKey(row = {}) {
  const nick = trim(row.nickname || row.name || '').toLowerCase();
  const alliance = trim(row.alliance || '');
  const shift = trim(row.shift || row.shiftLabel || '').toLowerCase();
  return `${nick}|${alliance}|${shift}`;
}


async function readLocalImportRegionLockFromD1(user, region) {
  try {
    const mod = await import('./region-table-cache.js?v=046');
    if (!mod.isRegionTableCacheEnabled?.()) return null;
    return await mod.readLocalImportRegionLock(user, region);
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] local import region lock read unavailable:', error?.message || error);
    return null;
  }
}

async function commitLocalImportRegionLockToD1(user, region, payload = {}) {
  try {
    const mod = await import('./region-table-cache.js?v=046');
    if (!mod.isRegionTableCacheEnabled?.()) return null;
    return await mod.commitLocalImportRegionLock(user, region, payload);
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] local import region lock commit unavailable:', error?.message || error);
    return null;
  }
}

export async function readLocalImportRegionLock(user, region = '') {
  return await readLocalImportRegionLockFromD1(user, region);
}

export async function commitLocalImportRegionLock(user, region = '', payload = {}) {
  return await commitLocalImportRegionLockToD1(user, region, payload);
}


function localImportCompletenessScore(row = {}) {
  let score = 0;
  if (trim(row.name || row.nickname)) score += 20;
  if (trim(row.alliance)) score += 12;
  if (trim(localImportTier(row))) score += 12;
  if (localImportMarch(row) > 0) score += 12;
  if (localImportRally(row) > 0) score += 8;
  if (trim(row.role || row.troopType || row.troopLabel)) score += 8;
  if (trim(row.shift || row.shiftLabel)) score += 6;
  if (row.captain || row.captainReady) score += 3;
  if (trim(row.lair || row.lairLevel || row.denLevel)) score += 2;
  return score;
}

function localImportDedupeKey(row = {}) {
  let value = trim(row.name || row.nickname).toLowerCase();
  try { value = value.normalize('NFKC'); } catch (_error) {}
  return value.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}

function dedupeLocalImportPlayers(players = []) {
  const bestByKey = new Map();
  const order = [];
  (Array.isArray(players) ? players : []).forEach((row, index) => {
    const key = localImportDedupeKey(row) || `__empty_${index}`;
    const score = localImportCompletenessScore(row);
    const current = bestByKey.get(key);
    if (!current) {
      order.push(key);
      bestByKey.set(key, { row, score });
    } else if (score > current.score) {
      bestByKey.set(key, { row, score });
    }
  });
  return order.map(key => bestByKey.get(key)?.row).filter(Boolean);
}

export async function importLocalPlayersToRegion(user, players = [], regionOverride = '', options = {}) {
  if (!user) throw new Error('auth-required');
  const { db, firestoreMod } = await getFirebaseParts();
  const { profile, region } = await getMyRegionContext(user, regionOverride);
  if (!canManageRegion(profile, region, user)) throw new Error('region-access-denied');
  const settings = await getRegionSettings(region).then(getRegionFormStatus);
  const mode = options?.mode === 'merge' ? 'merge' : 'replace';
  const collectionRef = firestoreMod.collection(db, 'regions', region, 'wastelandRegistrations');
  const activeCycle = settings.currentCycleId;
  const currentCycleQuery = activeCycle
    ? firestoreMod.query(collectionRef, firestoreMod.where('cycleId', '==', activeCycle))
    : collectionRef;
  const existingSnap = await firestoreMod.getDocs(currentCycleQuery).catch(() => ({ docs: [] }));
  const oldCycleRows = existingSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  trackReads(existingSnap.docs?.length || 0);

  const existingByKey = new Map();
  oldCycleRows.forEach(row => {
    const key = localImportRegistrationKey(row);
    if (key.replaceAll('|', '').trim() && !existingByKey.has(key)) existingByKey.set(key, row);
  });

  const usedExistingIds = new Set();
  const usedNewIds = new Set();
  const preparedPlayers = options?.dedupe ? dedupeLocalImportPlayers(players) : (Array.isArray(players) ? players : []);
  const rows = preparedPlayers
    .filter(player => trim(player.name || player.nickname) && trim(player.alliance))
    .map((player, index) => {
      const data = playerToImportedRegistration(player, user, profile, region, settings);
      const existing = mode === 'merge' ? existingByKey.get(localImportRegistrationKey(data)) : null;
      let id = existing?.id && !usedExistingIds.has(existing.id)
        ? existing.id
        : importDocId(user.uid, player, index);
      while (usedNewIds.has(id)) id = `${importDocId(user.uid, player, index)}-${usedNewIds.size + 1}`;
      if (existing?.id) usedExistingIds.add(existing.id);
      usedNewIds.add(id);
      return { id, data, matchedExisting: Boolean(existing?.id) };
    });

  const now = firestoreMod.serverTimestamp();
  const newIds = new Set(rows.map(row => row.id));
  const deletes = mode === 'replace'
    ? oldCycleRows.filter(row => !newIds.has(row.id)).map(row => ({ type: 'delete', id: row.id }))
    : [];
  const writes = [
    ...deletes,
    ...rows.map(row => ({ type: 'set', id: row.id, data: row.data }))
  ];

  for (let index = 0; index < writes.length; index += 450) {
    const batch = firestoreMod.writeBatch(db);
    writes.slice(index, index + 450).forEach(write => {
      const ref = firestoreMod.doc(db, 'regions', region, 'wastelandRegistrations', write.id);
      if (write.type === 'delete') batch.delete(ref);
      else batch.set(ref, { ...write.data, updatedAt: now, submittedAt: now });
    });
    await batch.commit();
  }
  trackWrites(rows.length + 1);
  trackDeletes(deletes.length);

  const added = rows.filter(row => !row.matchedExisting).length;
  const updated = rows.length - added;
  const kept = mode === 'merge' ? Math.max(0, oldCycleRows.length - updated) : 0;
  const snapshotMap = new Map();
  if (mode === 'merge') oldCycleRows.forEach(row => snapshotMap.set(row.id, row));
  rows.forEach(row => snapshotMap.set(row.id, { id: row.id, ...row.data }));
  if (mode === 'replace') deletes.forEach(row => snapshotMap.delete(row.id));
  const snapshotRows = mode === 'merge'
    ? [...snapshotMap.values()]
    : rows.map(row => ({ id: row.id, ...row.data }));

  await firestoreMod.setDoc(firestoreMod.doc(db, 'regions', region), {
    region,
    activeTable: {
      cycleId: activeCycle,
      source: mode === 'merge' ? 'local-import-merge' : 'local-import-replace',
      rowsCount: snapshotRows.length,
      importedRowsCount: rows.length,
      added,
      updated,
      kept,
      deleted: deletes.length,
      replacedAt: now,
      replacedBy: user.uid
    },
    updatedAt: now,
    updatedBy: user.uid
  }, { merge: true });
  await publishSnapshotToRegionTableCache(user, {
    region,
    cycleId: activeCycle || '',
    settings: settings || {},
    rows: snapshotRows
  }).catch(() => null);
  return { profile, region, count: rows.length, mode, added, updated, kept, deleted: deletes.length, replaced: deletes.length, total: snapshotRows.length };
}

function registrationShiftValue(row = {}, info = {}) {
  const direct = row.shift || row.shiftLabel || row.registeredShift || row.availabilityShift
    || info.shift || info.shiftLabel || info.registeredShift || info.availabilityShift
    || row.customFields?.shift || row.customFields?.['Зміна'] || row.customFields?.Shift
    || row.raw?.shift || row.raw?.shiftLabel || '';
  const text = trim(direct);
  if (!text) return '';
  const lower = text.toLowerCase();
  if (/both|all|всі|все|обидві|обе|оба/.test(lower)) return 'both';
  if (/4/.test(lower)) return 'shift4';
  if (/3/.test(lower)) return 'shift3';
  if (/2/.test(lower)) return 'shift2';
  if (/1/.test(lower)) return 'shift1';
  return text;
}

export function regionRegistrationToPlayer(row = {}) {
  const info = row.wastelandProfile || {};
  const rawTroopType = row.troopType || info.troopType || row.troopLabel || info.troopLabel || '';
  const cleanTroopType = normalizePlayerTroopType(rawTroopType);
  const rowShift = registrationShiftValue(row, info);
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
    role: troopTypeToPlayerRole(cleanTroopType) || '—',
    troopType: cleanTroopType,
    troopLabel: cleanTroopType ? troopLabel(cleanTroopType) : '',
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
    shift: rowShift,
    shiftLabel: row.shiftLabel || info.shiftLabel || shiftLabel(rowShift),
    registeredShift: rowShift,
    sourceShift: rowShift,
    originalShift: rowShift,
    _sourceShift: rowShift,
    lair: (row.captureRegion ?? info.captureRegion) ? 'Так' : 'Ні',
    lairLevel: row.lairLevel || info.lairLevel || '',
    registeredAt: row.submittedAt || row.updatedAt || row.createdAt || '',
    placement: 'Не призначено'
  };
}


export async function getRegionTowerPlan(user, regionOverride = '', options = {}) {
  if (!user) throw new Error('auth-required');
  const { profile, region } = await getMyRegionContext(user, regionOverride);
  if (!region) throw new Error('region-required');
  const allowFirestoreFallback = Boolean(options?.allowFirestoreFallback || options?.firebaseFallback);

  const cached = await readRegionTowerPlanSnapshot(user, region, { force: Boolean(options?.forceD1), ttlMs: options?.d1TtlMs }).catch(error => {
    if (window.WKD_DEBUG) console.warn('[WKD] tower plan D1 read skipped:', error);
    return null;
  });
  if (cached?.plan) {
    return {
      profile,
      region: cached.region || region,
      plan: cached.plan || null,
      updatedAt: null,
      updatedAtMs: Number(cached.updatedAtMs || 0) || 0,
      updatedBy: cached.updatedBy || '',
      source: cached.source || 'cloudflare-d1-tower-plan'
    };
  }
  if (!allowFirestoreFallback) {
    return {
      profile,
      region,
      plan: null,
      updatedAt: null,
      updatedAtMs: 0,
      updatedBy: '',
      d1Missing: true,
      requiresManualFirestoreFallback: true,
      source: 'cloudflare-d1-tower-plan-missing-no-firestore'
    };
  }

  const { db, firestoreMod } = await getFirebaseParts();
  const ref = firestoreMod.doc(db, 'regions', region, 'wastelandTowerPlans', 'current');
  const snap = await firestoreMod.getDoc(ref);
  trackReads(1);
  const data = snap.exists() ? (snap.data() || {}) : {};
  const plan = data.plan || null;
  const updatedAtMs = Number(data.updatedAtMs || timestampToMs(data.updatedAt)) || 0;
  if (plan) {
    publishRegionTowerPlanSnapshot(user, {
      region,
      cycleId: data.cycleId || 'active',
      plan,
      updatedAtMs: updatedAtMs || Date.now(),
      updatedByName: getRegionActorName(profile || {}, region, user)
    }).catch(() => null);
  }
  return {
    profile,
    region,
    plan,
    updatedAt: data.updatedAt || null,
    updatedAtMs,
    updatedBy: data.updatedBy || '',
    source: 'firebase-tower-plan-fallback'
  };
}

export async function saveRegionTowerPlan(user, region, plan = {}) {
  if (!user) throw new Error('auth-required');
  let profile = null;
  let safeRegion = normalizeRegion(region);
  if (!safeRegion) {
    profile = await getUserProfile(user.uid);
    safeRegion = normalizeRegion(getGameProfile(profile || {}).region);
  }
  if (!safeRegion) throw new Error('region-required');
  const cleanPlan = plan && typeof plan === 'object' ? plan : {};
  const updatedAtMs = Date.now();

  try {
    const d1Result = await publishRegionTowerPlanSnapshot(user, {
      region: safeRegion,
      cycleId: 'active',
      plan: cleanPlan,
      updatedAtMs,
      updatedByName: getRegionActorName(profile || {}, safeRegion, user)
    });
    if (d1Result?.ok !== false && !d1Result?.skipped) {
      return { region: safeRegion, plan: cleanPlan, updatedAtMs, source: 'cloudflare-d1-tower-plan' };
    }
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] tower plan D1 publish failed; Firebase fallback allowed:', error);
  }

  const { db, firestoreMod } = await getFirebaseParts();
  if (!profile) profile = await getUserProfile(user.uid);
  const settings = await getRegionSettings(safeRegion).catch(() => mergeRegionSettings({}));
  if (!canEditRegionTowerPlan(profile, safeRegion, user, settings)) throw new Error('region-plan-access-denied');
  await firestoreMod.setDoc(
    firestoreMod.doc(db, 'regions', safeRegion, 'wastelandTowerPlans', 'current'),
    {
      region: safeRegion,
      plan: cleanPlan,
      updatedAt: firestoreMod.serverTimestamp(),
      updatedAtMs,
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
  return { region: safeRegion, plan: cleanPlan, updatedAtMs, source: 'firebase-tower-plan-fallback' };
}

export { formatUserDate, timestampToMs };
