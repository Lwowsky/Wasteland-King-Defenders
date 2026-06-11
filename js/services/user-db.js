import { getFirebase } from './firebase-service.js';
import { readCache, writeCache, removeCache } from './local-cache.js?v=148';
import { trackReads, trackWrites, trackDeletes } from './usage-tracker.js?v=148';
import { mirrorPublicStatsPlayer } from './public-stats-cache.js?v=148';
import {
  createNotificationCampaignD1,
  createNotificationD1,
  createSentMessageD1,
  deleteNotificationsD1,
  deleteSentMessagesD1,
  listNotificationCampaignsD1,
  listNotificationsD1,
  listSentMessagesD1,
  markNotificationsReadD1,
  patchNotificationD1,
  patchSentMessageD1,
  readNotificationSummaryD1,
  setNotificationSummaryD1,
  upsertNotificationDirectoryD1
} from './notifications-d1.js?v=148';

export const OWNER_EMAILS = ['vovapotaychuk@gmail.com'];
export const ADMIN_EMAILS = OWNER_EMAILS;

export const USER_ROLES = {
  admin: 'Адмін',
  moderator: 'Модератор',
  consul: 'Консул',
  officer: 'Офіцер',
  player: 'Гравець',
  guest: 'Гість'
};

export const ROLE_REQUEST_STATUS = {
  none: 'Без заявки',
  pending: 'Очікує підтвердження',
  approved: 'Підтверджено',
  declined: 'Відхилено',
  cancelled: 'Скасовано'
};

const REQUESTABLE_ROLES = ['admin', 'moderator', 'officer', 'consul'];
const normalizeText = value => String(value ?? '').trim();
const normalizeRole = role => Object.hasOwn(USER_ROLES, role) ? role : 'player';
const normalizeCountry = value => normalizeText(value).slice(0, 80);
const normalizeCountryCode = value => normalizeText(value).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
const normalizeAllianceTag = value => Array.from(normalizeText(value).replace(/[\/\[\]#?]/g, '')).slice(0, 3).join('');
function buildRegionAccess(main = {}, farms = []) {
  return [...new Set([main.region, ...(Array.isArray(farms) ? farms.map(farm => farm.region) : [])]
    .map(region => normalizeText(region).replace(/[^0-9]/g, ''))
    .filter(Boolean))];
}
function buildRegionRoles(main = {}, farms = []) {
  const roles = {};
  (Array.isArray(farms) ? farms : []).forEach(farm => {
    const region = normalizeText(farm?.region).replace(/[^0-9]/g, '');
    const role = normalizeRole(farm?.role || 'player');
    if (region && ['admin', 'moderator', 'consul', 'officer'].includes(role)) roles[region] = role;
  });
  return roles;
}
function buildAllianceAccess(main = {}, farms = []) {
  return [...new Set([main, ...(Array.isArray(farms) ? farms : [])]
    .map(game => {
      const region = normalizeText(game?.region).replace(/[^0-9]/g, '');
      const alliance = normalizeAllianceTag(game?.alliance);
      return region && alliance ? `${region}:${alliance}` : '';
    })
    .filter(Boolean))];
}
const isRequestableRole = role => REQUESTABLE_ROLES.includes(role);
function serviceT(key, fallback) { return globalThis.window?.WKD_t ? globalThis.window.WKD_t(key) : fallback; }
function serviceLocale() {
  const lang = globalThis.window?.WKD_CURRENT_LANG || globalThis.document?.documentElement?.lang || globalThis.navigator?.language || 'en';
  const map = { uk: 'uk-UA', en: 'en-US', ru: 'ru-RU', pl: 'pl-PL', de: 'de-DE', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR', vi: 'vi-VN', ar: 'ar' };
  return map[String(lang).toLowerCase()] || lang || 'en-US';
}


const PROFILE_CACHE_VERSION = 'v115';
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const SIGN_IN_TOUCH_TTL_MS = 24 * 60 * 60 * 1000;
function sameJsonValue(a, b) {
  try { return JSON.stringify(a ?? null) === JSON.stringify(b ?? null); } catch { return false; }
}
function compactAuthValue(value = '') {
  return normalizeText(value).slice(0, 300);
}
function isSignInTouchDue(profile = {}) {
  const lastLoginMs = timestampToMs(profile?.lastLoginAt || profile?.lastLoginAtMs || profile?.updatedAt);
  return !lastLoginMs || (Date.now() - lastLoginMs) >= SIGN_IN_TOUCH_TTL_MS;
}
function buildSignInProfilePatch(user, profile = {}, main = {}, farms = [], now = null) {
  const patch = {};
  const displayName = compactAuthValue(user?.displayName || profile?.displayName || '');
  const photoURL = compactAuthValue(user?.photoURL || profile?.photoURL || '');
  const email = compactAuthValue(user?.email || profile?.email || '').slice(0, 180);
  const providerId = compactAuthValue(user?.providerData?.[0]?.providerId || profile?.providerId || 'google.com').slice(0, 80);
  const regionAccess = buildRegionAccess(main, farms);
  const allianceAccess = buildAllianceAccess(main, farms);
  const regionRoles = buildRegionRoles(main, farms);

  if (displayName !== compactAuthValue(profile?.displayName || '')) patch.displayName = displayName;
  if (photoURL !== compactAuthValue(profile?.photoURL || '')) patch.photoURL = photoURL;
  if (email && email !== compactAuthValue(profile?.email || '').slice(0, 180)) patch.email = email;
  if (providerId && providerId !== compactAuthValue(profile?.providerId || 'google.com').slice(0, 80)) patch.providerId = providerId;
  if (!sameJsonValue(regionAccess, Array.isArray(profile?.regionAccess) ? profile.regionAccess : [])) patch.regionAccess = regionAccess;
  if (!sameJsonValue(allianceAccess, Array.isArray(profile?.allianceAccess) ? profile.allianceAccess : [])) patch.allianceAccess = allianceAccess;
  if (!sameJsonValue(regionRoles, profile?.regionRoles || {})) patch.regionRoles = regionRoles;
  if (isSignInTouchDue(profile)) patch.lastLoginAt = now;
  if (Object.keys(patch).length) patch.updatedAt = now;
  return patch;
}
function profileCacheUid(uid = '') {
  return normalizeText(uid).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 160);
}
function profileCacheKey(uid = '') {
  const userId = profileCacheUid(uid);
  return userId ? `userProfile.${PROFILE_CACHE_VERSION}.${userId}` : '';
}
function profileCachePayload(profile = {}) {
  if (!profile || typeof profile !== 'object') return null;
  const uid = profileCacheUid(profile.uid || profile.id || '');
  if (!uid) return null;
  return {
    ...profile,
    uid,
    id: profile.id || uid,
    cachedAtMs: Date.now(),
    cacheVersion: PROFILE_CACHE_VERSION
  };
}
export function readCachedUserProfile(uid, ttlMs = PROFILE_CACHE_TTL_MS) {
  const key = profileCacheKey(uid);
  if (!key) return null;
  const cached = readCache(key, Math.max(0, Number(ttlMs) || PROFILE_CACHE_TTL_MS));
  if (!cached || cached.cacheVersion !== PROFILE_CACHE_VERSION) return null;
  return cached;
}
export function writeUserProfileCache(uid, profile) {
  const key = profileCacheKey(uid);
  const payload = profileCachePayload({ ...(profile || {}), uid: uid || profile?.uid || profile?.id });
  if (!key || !payload) return null;
  return writeCache(key, payload);
}
export function removeUserProfileCache(uid) {
  const key = profileCacheKey(uid);
  if (key) removeCache(key);
}

export function normalizeWastelandProfile(raw = {}) {
  const extraSquads = (Array.isArray(raw.extraSquads)
    ? raw.extraSquads
    : (raw.extraEnabled && raw.extraTroopType && raw.extraTier ? [{ troopType: raw.extraTroopType, tier: raw.extraTier }] : []))
    .map(item => ({ troopType: normalizeText(item?.troopType), tier: normalizeText(item?.tier || 'T10').toUpperCase() }))
    .filter(item => item.troopType && item.tier)
    .filter((item, index, arr) => arr.findIndex(other => other.troopType === item.troopType) === index);
  const firstExtra = extraSquads[0] || {};
  return {
    nickname: normalizeText(raw.nickname),
    alliance: normalizeAllianceTag(raw.alliance),
    region: normalizeText(raw.region),
    farmId: normalizeText(raw.farmId),
    troopType: normalizeText(raw.troopType),
    tier: normalizeText(raw.tier || 'T10').toUpperCase(),
    lairLevel: normalizeText(raw.lairLevel || raw.lair),
    marchSize: normalizeText(raw.marchSize),
    rallySize: normalizeText(raw.rallySize),
    readyToJoin: Boolean(raw.readyToJoin),
    readyToAttack: Boolean(raw.readyToAttack),
    captainReady: Boolean(raw.captainReady),
    shift: normalizeText(raw.shift),
    comment: normalizeText(raw.comment),
    extraEnabled: Boolean(extraSquads.length),
    extraSquads,
    extraTroopType: firstExtra.troopType || '',
    extraTier: firstExtra.tier || '',
    extraMarchSize: '',
    autoSubmitEnabled: Boolean(raw.autoSubmitEnabled)
  };
}
const isOwnerEmail = email => OWNER_EMAILS.includes(String(email || '').trim().toLowerCase());
const isAdminEmail = email => ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
function gameRegion(game = {}) { return normalizeText(game.region).replace(/[^0-9]/g, ''); }
function rankNum(rank = '') { const m = String(rank || '').match(/[1-5]/); return m ? Number(m[0]) : 1; }
function allActorGames(profile = {}) {
  const main = getGameProfile(profile || {});
  return [{ ...main, role: normalizeRole(profile?.role || 'player'), farmId: 'main' }, ...getUserFarms(profile || {})];
}
function isRegionalManagerProfile(profile = {}) {
  return allActorGames(profile).some(game => ['consul', 'officer'].includes(normalizeRole(game.role || 'player')));
}
function bestActorGameForTarget(actorProfile = {}, target = {}) {
  const region = gameRegion(target);
  const alliance = normalizeAllianceTag(target.alliance);
  return allActorGames(actorProfile).find(game => gameRegion(game) === region && (!alliance || normalizeAllianceTag(game.alliance) === alliance))
    || allActorGames(actorProfile).find(game => gameRegion(game) === region)
    || null;
}
function isGlobalAdminActor(actor = null, actorProfile = null) {
  return isOwnerUser(actor, actorProfile) || ['admin', 'moderator'].includes(normalizeRole(actorProfile?.role || 'player'));
}
function canRegionalEditTarget(actor = null, actorProfile = null, target = {}, oldTarget = {}) {
  if (isGlobalAdminActor(actor, actorProfile)) return true;
  const actorGame = bestActorGameForTarget(actorProfile || {}, target);
  if (!actorGame) return false;
  const actorRole = normalizeRole(actorGame.role || 'player');
  const actorRank = rankNum(actorGame.rank);
  const sameAlliance = normalizeAllianceTag(actorGame.alliance) === normalizeAllianceTag(target.alliance);
  const wantedRole = normalizeRole(target.role || oldTarget.role || 'player');
  const wantedRank = rankNum(target.rank || oldTarget.rank || 'p1');
  if (actorRole === 'consul' && gameRegion(actorGame) === gameRegion(target)) {
    return ['player', 'officer'].includes(wantedRole) && wantedRank <= 5;
  }
  if (sameAlliance && actorRole === 'officer') return wantedRole === normalizeRole(oldTarget.role || 'player');
  if (sameAlliance && actorRank === 5) return wantedRole === normalizeRole(oldTarget.role || 'player') && wantedRank <= 4;
  return false;
}

export function roleLabel(role = 'player') {
  const key = normalizeRole(role);
  return serviceT(`role.${key}`, USER_ROLES[key] || USER_ROLES.player);
}

export function roleRequestStatusLabel(status = 'none') {
  const key = Object.hasOwn(ROLE_REQUEST_STATUS, status) ? status : 'none';
  return serviceT(`roleRequest.${key}`, ROLE_REQUEST_STATUS[key] || ROLE_REQUEST_STATUS.none);
}

export function normalizeUserRole(role = 'player') {
  return normalizeRole(role);
}

export function isOwnerUser(user, profile = null) {
  const email = user?.email || profile?.email || '';
  return isOwnerEmail(email);
}

export function isAdminUser(user, profile = null) {
  const email = user?.email || profile?.email || '';
  return isAdminEmail(email) || profile?.role === 'admin';
}

export function isModeratorUser(user, profile = null) {
  return profile?.role === 'moderator';
}

export function canUseAdminPanel(user, profile = null) {
  return isOwnerUser(user, profile) || profile?.role === 'admin' || profile?.role === 'moderator';
}

export function assignableRolesForActor(user, profile = null) {
  if (isOwnerUser(user, profile)) return ['admin', 'moderator', 'consul', 'officer', 'player'];
  if (profile?.role === 'admin') return ['moderator', 'consul', 'officer', 'player'];
  if (profile?.role === 'moderator') return ['consul', 'officer', 'player'];
  return [];
}

export function canAssignRole(user, profile = null, role = 'player') {
  return assignableRolesForActor(user, profile).includes(normalizeRole(role));
}

export function timestampToMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000 + Math.floor((Number(value.nanoseconds) || 0) / 1000000);
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}


const CAMPAIGN_RETENTION_DAYS = 30;
const CAMPAIGN_RETENTION_MS = CAMPAIGN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
function isSystemCampaignType(type = '') {
  const clean = normalizeText(type).toLowerCase();
  return clean.startsWith('registration_') || clean === 'registration_notice' || clean === 'region_status';
}


function notificationSummaryRef(firebase, uid) {
  return firebase.firestoreMod.doc(firebase.db, 'users', uid, 'notificationMeta', 'summary');
}
function notificationSummaryClean(values = {}, firebase = null) {
  const nowMs = Date.now();
  const out = {};
  if (Object.hasOwn(values, 'unreadTotal')) out.unreadTotal = Math.max(0, Math.min(99999, Number(values.unreadTotal) || 0));
  if (Object.hasOwn(values, 'lastTitle')) out.lastTitle = normalizeText(values.lastTitle).slice(0, 160);
  if (Object.hasOwn(values, 'lastMessage')) out.lastMessage = normalizeText(values.lastMessage).slice(0, 300);
  if (Object.hasOwn(values, 'lastRegion')) out.lastRegion = normalizeText(values.lastRegion).replace(/[^0-9]/g, '').slice(0, 20);
  if (Object.hasOwn(values, 'lastAlliance')) out.lastAlliance = normalizeAllianceTag(values.lastAlliance);
  if (Object.hasOwn(values, 'lastActorUid')) out.lastActorUid = normalizeText(values.lastActorUid).slice(0, 160);
  if (Object.hasOwn(values, 'lastActorName')) out.lastActorName = normalizeText(values.lastActorName).slice(0, 120);
  if (Object.hasOwn(values, 'lastActorRole')) out.lastActorRole = normalizeRole(values.lastActorRole || 'player');
  if (Object.hasOwn(values, 'lastTargetType')) out.lastTargetType = normalizeText(values.lastTargetType || 'system').slice(0, 20);
  if (Object.hasOwn(values, 'lastNotificationAtMs')) out.lastNotificationAtMs = Math.max(0, Number(values.lastNotificationAtMs) || 0);
  if (Object.hasOwn(values, 'campaignSeenAtMs')) out.campaignSeenAtMs = Math.max(0, Number(values.campaignSeenAtMs) || 0);
  out.updatedAtMs = Math.max(0, Number(values.updatedAtMs) || nowMs);
  if (firebase?.firestoreMod?.serverTimestamp) out.updatedAt = firebase.firestoreMod.serverTimestamp();
  return out;
}
function notificationSummaryFromNotification(notification = {}, firebase = null) {
  return notificationSummaryClean({
    lastTitle: notification.title || serviceT('notifications.title', 'Сповіщення'),
    lastMessage: notification.message || notification.summary || '',
    lastRegion: notification.region || '',
    lastAlliance: notification.alliance || '',
    lastActorUid: notification.actorUid || '',
    lastActorName: notification.actorName || '',
    lastActorRole: notification.actorRole || 'player',
    lastTargetType: notification.targetType || 'system',
    lastNotificationAtMs: Number(notification.createdAtMs) || Date.now()
  }, firebase);
}
async function incrementUserNotificationSummary(uid, notification = {}) {
  const userId = normalizeText(uid);
  if (!userId) return null;
  const firebase = await getFirebase();
  if (!firebase) return null;
  const { firestoreMod } = firebase;
  const payload = notificationSummaryFromNotification(notification, firebase);
  payload.unreadTotal = firestoreMod.increment(1);
  payload.lastNotificationAt = firestoreMod.serverTimestamp();
  await firestoreMod.setDoc(notificationSummaryRef(firebase, userId), payload, { merge: true });
  trackWrites(1);
  return payload;
}
export async function readUserNotificationSummary(uid) {
  const userId = normalizeText(uid);
  if (!userId) return null;
  const firebase = await getFirebase();
  if (!firebase) return null;
  const authUser = firebase.auth?.currentUser || null;
  if (authUser?.uid === userId) {
    try {
      return await readNotificationSummaryD1(authUser);
    } catch (error) {
      console.warn('[WKD] D1 notification summary unavailable, Firebase fallback used', error);
    }
  }
  const snap = await firebase.firestoreMod.getDoc(notificationSummaryRef(firebase, userId)).catch(() => null);
  trackReads(1);
  if (!snap?.exists?.()) return null;
  return { id: snap.id, ...snap.data() };
}
export async function setUserNotificationSummary(uid, values = {}) {
  const userId = normalizeText(uid);
  if (!userId) return null;
  const firebase = await getFirebase();
  if (!firebase) return null;
  const authUser = firebase.auth?.currentUser || null;
  if (authUser?.uid === userId) {
    try {
      return await setNotificationSummaryD1(authUser, values);
    } catch (error) {
      console.warn('[WKD] D1 notification summary update unavailable, Firebase fallback used', error);
    }
  }
  const payload = notificationSummaryClean(values, firebase);
  if (!Object.hasOwn(payload, 'unreadTotal') && Object.hasOwn(values, 'unreadTotal')) payload.unreadTotal = Math.max(0, Number(values.unreadTotal) || 0);
  await firebase.firestoreMod.setDoc(notificationSummaryRef(firebase, userId), payload, { merge: true });
  trackWrites(1);
  return payload;
}
export async function rebuildUserNotificationSummary(uid, notifications = []) {
  const list = Array.isArray(notifications) ? notifications : [];
  const active = list.filter(item => item && item.archived !== true);
  const unread = active.filter(item => item.unread !== false && !item.readAt && !item.readAtMs);
  const newest = [...active].sort((a, b) => (Number(b.createdAtMs) || timestampToMs(b.createdAt)) - (Number(a.createdAtMs) || timestampToMs(a.createdAt)))[0] || {};
  return setUserNotificationSummary(uid, {
    unreadTotal: unread.length,
    ...notificationSummaryFromNotification(newest),
    updatedAtMs: Date.now()
  });
}


export async function createUserNotification(uid, values = {}) {
  const userId = normalizeText(uid);
  if (!userId) return null;
  const firebase = await getFirebase();
  if (!firebase) return null;
  const { db, auth, firestoreMod } = firebase;
  const authUser = auth?.currentUser || null;
  const nowMs = Date.now();
  const id = `${nowMs}-${Math.random().toString(36).slice(2, 8)}`;
  const actorUid = normalizeText(values.actorUid || authUser?.uid || '');
  const actorName = normalizeText(values.actorName || authUser?.displayName || authUser?.email || '');
  const actorPhotoURL = normalizeText(values.actorPhotoURL || authUser?.photoURL || '').slice(0, 300);
  const actorRole = normalizeRole(values.actorRole || 'player');
  const payload = {
    type: normalizeText(values.type || 'notice').slice(0, 80),
    title: normalizeText(values.title || serviceT('notifications.title', 'Сповіщення')).slice(0, 160),
    message: normalizeText(values.message || values.summary || '').slice(0, 500),
    region: normalizeText(values.region || '').replace(/[^0-9]/g, ''),
    alliance: normalizeAllianceTag(values.alliance || ''),
    actorUid,
    actorName,
    actorRole,
    actorRoleText: normalizeText(values.actorRoleText || roleLabel(actorRole)).slice(0, 80),
    actorPhotoURL,
    targetType: normalizeText(values.targetType || (values.type === 'site_message' ? 'player' : 'system')).slice(0, 40),
    targetLabel: normalizeText(values.targetLabel || '').slice(0, 160),
    createdAt: firestoreMod.serverTimestamp(),
    createdAtMs: nowMs,
    unread: true
  };
  if (values.replyToId) payload.replyToId = normalizeText(values.replyToId).slice(0, 120);
  if (values.replyToTitle) payload.replyToTitle = normalizeText(values.replyToTitle).slice(0, 160);
  if (values.replyToActorName) payload.replyToActorName = normalizeText(values.replyToActorName).slice(0, 120);
  if (values.replyToCreatedAtMs) payload.replyToCreatedAtMs = Number(values.replyToCreatedAtMs) || nowMs;
  if (authUser) {
    try {
      return await createNotificationD1(authUser, userId, { id, ...payload });
    } catch (error) {
      console.warn('[WKD] D1 notification skipped, Firebase fallback used', error);
    }
  }
  await firestoreMod.setDoc(firestoreMod.doc(db, 'users', userId, 'notifications', id), payload);
  trackWrites(1);
  await incrementUserNotificationSummary(userId, payload).catch(error => console.warn('[WKD] notification summary skipped', error));
  return { id, ...payload };
}

export async function listUserNotifications(uid, limitCount = 100) {
  const userId = normalizeText(uid);
  if (!userId) return [];
  const firebase = await getFirebase();
  if (!firebase) return [];
  const authUser = firebase.auth?.currentUser || null;
  if (authUser?.uid === userId) {
    try {
      const rows = await listNotificationsD1(authUser, { limit: Math.max(1, Math.min(200, Number(limitCount) || 100)), includeUnread: true });
      return rows;
    } catch (error) {
      console.warn('[WKD] D1 notifications unavailable, Firebase fallback used', error);
    }
  }
  const { db, firestoreMod } = firebase;
  const q = firestoreMod.query(
    firestoreMod.collection(db, 'users', userId, 'notifications'),
    firestoreMod.orderBy('createdAtMs', 'desc'),
    firestoreMod.limit(Math.max(1, Math.min(200, Number(limitCount) || 100)))
  );
  const snap = await firestoreMod.getDocs(q).catch(() => ({ docs: [] }));
  const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  if (authUser?.uid === userId && rows.length) {
    Promise.all(rows.slice(0, 50).map(row => createNotificationD1(authUser, userId, row).catch(() => null))).catch(() => null);
  }
  return rows;
}



export async function patchUserNotification(uid, id = '', values = {}) {
  const userId = normalizeText(uid);
  const notificationId = normalizeText(id);
  if (!userId || !notificationId) return null;
  const firebase = await getFirebase();
  if (!firebase) return null;
  const authUser = firebase.auth?.currentUser || null;
  if (authUser?.uid === userId) {
    try {
      return await patchNotificationD1(authUser, notificationId, values);
    } catch (error) {
      console.warn('[WKD] D1 notification patch unavailable, Firebase fallback used', error);
    }
  }
  await firebase.firestoreMod.setDoc(firebase.firestoreMod.doc(firebase.db, 'users', userId, 'notifications', notificationId), values, { merge: true });
  trackWrites(1);
  return { ok: true, id: notificationId };
}

export async function markUserNotificationsRead(uid, ids = []) {
  const userId = normalizeText(uid);
  const safeIds = (Array.isArray(ids) ? ids : [ids]).map(normalizeText).filter(Boolean).slice(0, 100);
  if (!userId || !safeIds.length) return { ok: true, marked: 0 };
  const firebase = await getFirebase();
  if (!firebase) return { ok: false, marked: 0 };
  const authUser = firebase.auth?.currentUser || null;
  if (authUser?.uid === userId) {
    try {
      return await markNotificationsReadD1(authUser, safeIds);
    } catch (error) {
      console.warn('[WKD] D1 mark read unavailable, Firebase fallback used', error);
    }
  }
  const nowMs = Date.now();
  const batch = firebase.firestoreMod.writeBatch(firebase.db);
  safeIds.forEach(id => batch.set(firebase.firestoreMod.doc(firebase.db, 'users', userId, 'notifications', id), { readAt: firebase.firestoreMod.serverTimestamp(), readAtMs: nowMs, unread: false }, { merge: true }));
  await batch.commit();
  trackWrites(safeIds.length);
  return { ok: true, marked: safeIds.length };
}

export async function deleteUserNotifications(uid, ids = []) {
  const userId = normalizeText(uid);
  const safeIds = (Array.isArray(ids) ? ids : [ids]).map(normalizeText).filter(Boolean).slice(0, 100);
  if (!userId || !safeIds.length) return { ok: true, deleted: 0 };
  const firebase = await getFirebase();
  if (!firebase) return { ok: false, deleted: 0 };
  const authUser = firebase.auth?.currentUser || null;
  if (authUser?.uid === userId) {
    try {
      return await deleteNotificationsD1(authUser, safeIds);
    } catch (error) {
      console.warn('[WKD] D1 notification delete unavailable, Firebase fallback used', error);
    }
  }
  await Promise.all(safeIds.map(id => firebase.firestoreMod.deleteDoc(firebase.firestoreMod.doc(firebase.db, 'users', userId, 'notifications', id))));
  trackDeletes(safeIds.length);
  return { ok: true, deleted: safeIds.length };
}

export async function listUserSentMessages(uid, limitCount = 50) {
  const userId = normalizeText(uid);
  if (!userId) return [];
  const firebase = await getFirebase();
  if (!firebase) return [];
  const authUser = firebase.auth?.currentUser || null;
  if (authUser?.uid === userId) {
    try {
      const rows = await listSentMessagesD1(authUser, { limit: Math.max(1, Math.min(100, Number(limitCount) || 50)) });
      return rows;
    } catch (error) {
      console.warn('[WKD] D1 sent messages unavailable, Firebase fallback used', error);
    }
  }
  const ref = firebase.firestoreMod.collection(firebase.db, 'users', userId, 'sentMessages');
  const q = firebase.firestoreMod.query(ref, firebase.firestoreMod.orderBy('createdAtMs', 'desc'), firebase.firestoreMod.limit(Math.max(1, Math.min(100, Number(limitCount) || 50))));
  const snap = await firebase.firestoreMod.getDocs(q).catch(() => ({ docs: [] }));
  trackReads(Math.max(1, snap.docs.length));
  const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  if (authUser?.uid === userId && rows.length) {
    Promise.all(rows.slice(0, 50).map(row => createSentMessageD1(authUser, row).catch(() => null))).catch(() => null);
  }
  return rows;
}

export async function createUserSentMessage(uid, values = {}) {
  const userId = normalizeText(uid);
  if (!userId) return null;
  const firebase = await getFirebase();
  if (!firebase) return null;
  const authUser = firebase.auth?.currentUser || null;
  if (authUser?.uid === userId) {
    try {
      return await createSentMessageD1(authUser, values);
    } catch (error) {
      console.warn('[WKD] D1 sent message save unavailable, Firebase fallback used', error);
    }
  }
  const nowMs = Date.now();
  const id = `${nowMs}-${Math.random().toString(36).slice(2, 8)}`;
  const payload = {
    type: 'sent_message',
    title: normalizeText(values.title || serviceT('messages.defaultSubject', 'Повідомлення')).slice(0, 160),
    message: normalizeText(values.message || '').slice(0, 600),
    region: normalizeText(values.region || '').replace(/[^0-9]/g, ''),
    alliance: normalizeAllianceTag(values.alliance || ''),
    targetType: normalizeText(values.targetType || 'player').slice(0, 40),
    targetLabel: normalizeText(values.targetLabel || '').slice(0, 160),
    recipientCount: Math.max(0, Math.min(50000, Number(values.recipientCount) || 0)),
    recipientPreview: normalizeText(values.recipientPreview || '').slice(0, 300),
    actorUid: userId,
    createdAt: firebase.firestoreMod.serverTimestamp(),
    createdAtMs: nowMs,
    archived: false
  };
  if (values.replyToId) payload.replyToId = normalizeText(values.replyToId).slice(0, 120);
  if (values.replyToTitle) payload.replyToTitle = normalizeText(values.replyToTitle).slice(0, 160);
  if (values.replyToActorName) payload.replyToActorName = normalizeText(values.replyToActorName).slice(0, 120);
  if (values.replyToCreatedAtMs) payload.replyToCreatedAtMs = Number(values.replyToCreatedAtMs) || nowMs;
  await firebase.firestoreMod.setDoc(firebase.firestoreMod.doc(firebase.db, 'users', userId, 'sentMessages', id), payload);
  trackWrites(1);
  return { id, ...payload };
}

export async function patchUserSentMessage(uid, id = '', values = {}) {
  const userId = normalizeText(uid);
  const messageId = normalizeText(id);
  if (!userId || !messageId) return null;
  const firebase = await getFirebase();
  if (!firebase) return null;
  const authUser = firebase.auth?.currentUser || null;
  if (authUser?.uid === userId) {
    try { return await patchSentMessageD1(authUser, messageId, values); }
    catch (error) { console.warn('[WKD] D1 sent patch unavailable, Firebase fallback used', error); }
  }
  await firebase.firestoreMod.setDoc(firebase.firestoreMod.doc(firebase.db, 'users', userId, 'sentMessages', messageId), values, { merge: true });
  trackWrites(1);
  return { ok: true, id: messageId };
}

export async function deleteUserSentMessages(uid, ids = []) {
  const userId = normalizeText(uid);
  const safeIds = (Array.isArray(ids) ? ids : [ids]).map(normalizeText).filter(Boolean).slice(0, 100);
  if (!userId || !safeIds.length) return { ok: true, deleted: 0 };
  const firebase = await getFirebase();
  if (!firebase) return { ok: false, deleted: 0 };
  const authUser = firebase.auth?.currentUser || null;
  if (authUser?.uid === userId) {
    try { return await deleteSentMessagesD1(authUser, safeIds); }
    catch (error) { console.warn('[WKD] D1 sent delete unavailable, Firebase fallback used', error); }
  }
  await Promise.all(safeIds.map(id => firebase.firestoreMod.deleteDoc(firebase.firestoreMod.doc(firebase.db, 'users', userId, 'sentMessages', id))));
  trackDeletes(safeIds.length);
  return { ok: true, deleted: safeIds.length };
}

export function profileNotificationRegions(profile = {}) {
  const main = getGameProfile(profile || {});
  const farms = getUserFarms(profile || {});
  return buildRegionAccess(main, farms).slice(0, 10);
}

function campaignClean(values = {}, firebase = null) {
  const nowMs = Math.max(0, Number(values.createdAtMs) || Date.now());
  const type = normalizeText(values.type || 'registration_notice').slice(0, 80);
  const region = normalizeText(values.region || '').replace(/[^0-9]/g, '').slice(0, 20);
  const actorRole = normalizeRole(values.actorRole || 'player');
  const targetType = normalizeText(values.targetType || 'region').slice(0, 20);
  const alliance = normalizeAllianceTag(values.alliance || values.targetAlliance || '');
  const payload = {
    type,
    source: 'region-campaign',
    region,
    cycleId: normalizeText(values.cycleId || '').slice(0, 120),
    actorUid: normalizeText(values.actorUid || '').slice(0, 160),
    actorName: normalizeText(values.actorName || '').slice(0, 120),
    actorRole,
    actorRoleText: normalizeText(values.actorRoleText || roleLabel(actorRole)).slice(0, 80),
    targetType,
    targetLabel: normalizeText(values.targetLabel || (region ? `R${region}` : '')).slice(0, 160),
    createdAt: firebase?.firestoreMod?.serverTimestamp ? firebase.firestoreMod.serverTimestamp() : null,
    createdAtMs: nowMs
  };
  const rawExpiresAtMs = Number(values.expiresAtMs) || 0;
  if (rawExpiresAtMs > 0) payload.expiresAtMs = rawExpiresAtMs;
  else if (isSystemCampaignType(type)) payload.expiresAtMs = nowMs + CAMPAIGN_RETENTION_MS;
  if (values.titleKey || type.startsWith('registration_')) payload.titleKey = normalizeText(values.titleKey || 'notifications.campaign.registrationOpenedTitle').slice(0, 160);
  if (values.messageKey || type.startsWith('registration_')) payload.messageKey = normalizeText(values.messageKey || 'notifications.campaign.registrationOpenedMessage').slice(0, 160);
  if (values.title) payload.title = normalizeText(values.title).slice(0, 160);
  if (values.message || values.summary) payload.message = normalizeText(values.message || values.summary || '').slice(0, 600);
  if (alliance) payload.alliance = alliance;
  if (values.campaignGroupId) payload.campaignGroupId = normalizeText(values.campaignGroupId).slice(0, 120);
  return payload;
}

function campaignId(payload = {}) {
  return `${payload.createdAtMs}-${String(payload.type || 'campaign').replace(/[^a-z0-9_-]/gi, '').slice(0, 50)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function writeCampaignFirestoreBackup(firebase, id = '', payload = {}) {
  if (!firebase || !id || !payload?.region) return null;
  await firebase.firestoreMod.setDoc(firebase.firestoreMod.doc(firebase.db, 'regions', payload.region, 'notificationCampaigns', id), payload);
  trackWrites(1);
  return { id, ...payload, source: payload.source || 'region-campaign' };
}

async function createCampaignWithFallback(values = {}, options = {}) {
  const firebase = await getFirebase();
  if (!firebase) return null;
  const payload = campaignClean(values, firebase);
  if (!payload.region) return null;
  if (options.siteMessage) {
    if (!['all', 'region', 'alliance', 'consuls', 'officers'].includes(payload.targetType)) return null;
    if (payload.targetType === 'alliance' && !payload.alliance) return null;
    if (!payload.title || !payload.message) return null;
  }
  const id = campaignId(payload);
  const authUser = firebase.auth?.currentUser || null;
  let d1Campaign = null;
  if (authUser) {
    try {
      d1Campaign = await createNotificationCampaignD1(authUser, { id, ...payload });
      return d1Campaign;
    } catch (error) {
      console.warn(`[WKD] D1 ${options.siteMessage ? 'message' : 'region'} campaign skipped, Firebase fallback used`, error);
    }
  }
  const firestoreBackup = await writeCampaignFirestoreBackup(firebase, id, payload).catch(error => {
    console.warn(`[WKD] Firestore ${options.siteMessage ? 'message' : 'region'} campaign backup skipped`, error);
    return null;
  });
  return firestoreBackup;
}

export async function createRegionNotificationCampaign(values = {}) {
  return createCampaignWithFallback(values, { siteMessage: false });
}

export async function createSiteMessageCampaign(values = {}) {
  return createCampaignWithFallback({ ...values, type: values.type || 'site_message_campaign' }, { siteMessage: true });
}

function profileCampaignGames(profile = {}) {
  const main = getGameProfile(profile || {});
  const baseRole = normalizeRole(profile?.role || main.role || 'player');
  const games = [];
  if (main.nickname || main.region || main.alliance) games.push({ ...main, role: normalizeRole(main.role || baseRole), accountRole: baseRole });
  getUserFarms(profile || {}).forEach(farm => {
    if (farm.nickname || farm.region || farm.alliance) games.push({ ...farm, role: normalizeRole(farm.role || baseRole), accountRole: baseRole });
  });
  return games;
}

function campaignMatchesProfile(profile = {}, campaign = {}) {
  const targetType = normalizeText(campaign.targetType || 'region');
  const region = normalizeText(campaign.region || '').replace(/[^0-9]/g, '');
  const alliance = normalizeAllianceTag(campaign.alliance || campaign.targetAlliance || '');
  const accountRole = normalizeRole(profile?.role || 'player');
  if (targetType === 'admins') return ['admin', 'moderator'].includes(accountRole);
  const games = profileCampaignGames(profile).filter(game => normalizeText(game.region || '').replace(/[^0-9]/g, '') === region);
  if (!games.length) return false;
  if (targetType === 'all' || targetType === 'region') return true;
  if (targetType === 'alliance') return Boolean(alliance) && games.some(game => normalizeAllianceTag(game.alliance || '') === alliance);
  if (targetType === 'consuls') return games.some(game => normalizeRole(game.role || game.accountRole || accountRole) === 'consul') || accountRole === 'consul';
  if (targetType === 'officers') return games.some(game => normalizeRole(game.role || game.accountRole || accountRole) === 'officer') || accountRole === 'officer';
  return false;
}

async function listFirestoreCampaignsForProfile(firebase, profile = {}, regions = [], options = {}) {
  const sinceMs = Math.max(0, Number(options.sinceMs) || 0);
  const perRegionLimit = Math.max(1, Math.min(30, Number(options.perRegionLimit) || 8));
  const { db, firestoreMod } = firebase;
  const all = [];
  for (const region of regions) {
    const ref = firestoreMod.collection(db, 'regions', region, 'notificationCampaigns');
    const q = firestoreMod.query(ref, firestoreMod.orderBy('createdAtMs', 'desc'), firestoreMod.limit(perRegionLimit));
    const snap = await firestoreMod.getDocs(q).catch(() => ({ docs: [] }));
    trackReads(Math.max(1, snap.docs.length));
    snap.docs.forEach(doc => {
      const data = doc.data() || {};
      const createdAtMs = Number(data.createdAtMs) || timestampToMs(data.createdAt) || 0;
      const expiresAtMs = Number(data.expiresAtMs) || 0;
      if (expiresAtMs > 0 && expiresAtMs <= Date.now()) return;
      if (createdAtMs <= sinceMs) return;
      if (!campaignMatchesProfile(profile || {}, data)) return;
      all.push({ ...data, id: doc.id, source: 'campaign', unread: true, createdAtMs });
    });
  }
  return all;
}

function dedupeCampaigns(list = [], totalLimit = 20) {
  const deduped = [];
  const seen = new Set();
  list.sort((a, b) => (Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0)).forEach(item => {
    const key = item.campaignGroupId || `${item.region}:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });
  return deduped.slice(0, totalLimit);
}

export async function listRegionNotificationCampaignsForProfile(profile = {}, options = {}) {
  const firebase = await getFirebase();
  if (!firebase) return [];
  const regions = profileNotificationRegions(profile || {});
  if (!regions.length) return [];
  const sinceMs = Math.max(0, Number(options.sinceMs) || 0);
  const perRegionLimit = Math.max(1, Math.min(30, Number(options.perRegionLimit) || 8));
  const totalLimit = Math.max(1, Math.min(80, Number(options.totalLimit) || 20));
  const authUser = firebase.auth?.currentUser || null;
  if (authUser) {
    try {
      const d1Rows = await listNotificationCampaignsD1(authUser, regions, { sinceMs, limit: Math.min(80, Math.max(totalLimit, regions.length * perRegionLimit)) });
      const filtered = d1Rows
        .filter(item => campaignMatchesProfile(profile || {}, item))
        .sort((a, b) => (Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0));
      return dedupeCampaigns(filtered, totalLimit);
    } catch (error) {
      console.warn('[WKD] D1 campaigns unavailable, Firebase fallback used', error);
    }
  }
  return dedupeCampaigns(await listFirestoreCampaignsForProfile(firebase, profile, regions, { sinceMs, perRegionLimit }), totalLimit);
}

export function formatUserDate(value) {
  const ms = timestampToMs(value);
  if (!ms) return '—';
  return new Intl.DateTimeFormat(serviceLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(ms));
}

export function isProfileComplete(data = {}) {
  const profile = data.gameProfile || {};
  return Boolean(
    data.profileComplete &&
    normalizeText(profile.nickname || data.gameNick) &&
    normalizeText(profile.region || data.region) &&
    normalizeText(profile.alliance || data.alliance) &&
    normalizeText(profile.rank || data.rank) &&
    normalizeText(profile.shk || data.shk)
  );
}

export function getActiveRoleRequest(profile = {}) {
  const request = profile.roleRequest || {};
  if (!request.status || request.status === 'none') return null;
  return request;
}

export function getGameProfile(data = {}) {
  const game = data.gameProfile || {};
  return {
    farmId: game.farmId || 'main',
    nickname: normalizeText(game.nickname || data.gameNick || data.nickname),
    region: normalizeText(game.region || data.region),
    alliance: normalizeAllianceTag(game.alliance || data.alliance),
    rank: normalizeText(game.rank || data.rank || 'p1').toLowerCase(),
    shk: normalizeText(game.shk || data.shk),
    state: game.state || (data.profileComplete ? 'complete' : 'new'),
    wastelandProfile: normalizeWastelandProfile(game.wastelandProfile || data.wastelandProfile || {})
  };
}

export function normalizeFarm(raw = {}, fallbackId = '') {
  const id = normalizeText(raw.farmId || raw.id || fallbackId || `farm-${Date.now()}`);
  return {
    farmId: id,
    id,
    nickname: normalizeText(raw.nickname || raw.gameNick),
    region: normalizeText(raw.region),
    alliance: normalizeAllianceTag(raw.alliance),
    rank: normalizeText(raw.rank || 'p1').toLowerCase(),
    shk: normalizeText(raw.shk),
    role: normalizeRole(raw.role || 'player'),
    roleLabel: roleLabel(raw.role || 'player'),
    state: raw.state || 'complete',
    wastelandProfile: normalizeWastelandProfile(raw.wastelandProfile || {}),
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null
  };
}

export function getUserFarms(data = {}) {
  const farms = Array.isArray(data.farms) ? data.farms : [];
  return farms.map((farm, index) => normalizeFarm(farm, farm.farmId || farm.id || `farm-${index + 1}`));
}

export function getFarmCount(data = {}) {
  return getUserFarms(data).filter(farm => farm.nickname && farm.region).length;
}

export function getFarmById(data = {}, farmId = 'main') {
  if (!farmId || farmId === 'main') return { ...getGameProfile(data), farmId: 'main', id: 'main' };
  return getUserFarms(data).find(farm => farm.farmId === farmId || farm.id === farmId) || null;
}

export function normalizeProfileVisibility(raw = {}) {
  return {
    showWastelandInfo: Boolean(raw.showWastelandInfo),
    showFarmsInfo: Boolean(raw.showFarmsInfo)
  };
}

function makePublicWastelandInfo(profile = {}) {
  const data = normalizeWastelandProfile(profile);
  return {
    lairLevel: data.lairLevel,
    troopType: data.troopType,
    tier: data.tier,
    marchSize: data.marchSize,
    rallySize: data.rallySize,
    captainReady: data.captainReady,
    readyToJoin: data.readyToJoin,
    readyToAttack: data.readyToAttack,
    shift: data.shift,
    extraEnabled: data.extraEnabled,
    extraSquads: data.extraSquads,
    extraTroopType: data.extraTroopType,
    extraTier: data.extraTier
  };
}

function makePublicFarm(farm = {}, index = 0, showWastelandInfo = false) {
  const item = normalizeFarm(farm, farm.farmId || farm.id || `farm-${index + 1}`);
  const farmRole = normalizeRole(item.role || 'player');
  return {
    farmId: item.farmId,
    nickname: item.nickname,
    region: item.region,
    alliance: item.alliance,
    rank: item.rank,
    shk: item.shk,
    role: farmRole,
    roleLabel: roleLabel(farmRole),
    wastelandProfile: showWastelandInfo ? makePublicWastelandInfo(item.wastelandProfile || {}) : null
  };
}

export function makePublicPlayer(data = {}) {
  const game = getGameProfile(data);
  const role = normalizeRole(data.role || 'player');
  const visibility = normalizeProfileVisibility(data.profileVisibility || {});
  const publicPlayer = {
    uid: data.uid || data.id || '',
    gameNick: game.nickname,
    nickname: game.nickname,
    region: game.region,
    alliance: game.alliance,
    rank: game.rank,
    shk: game.shk,
    role,
    roleLabel: roleLabel(role),
    displayName: data.displayName || '',
    photoURL: data.photoURL || '',
    country: normalizeCountry(data.country),
    countryCode: normalizeCountryCode(data.countryCode),
    farmCount: getFarmCount(data),
    profileComplete: Boolean(data.profileComplete),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    lastLoginAt: data.lastLoginAt || null,
    profileVisibility: visibility,
    wastelandProfile: visibility.showWastelandInfo ? makePublicWastelandInfo(game.wastelandProfile || {}) : null,
    farms: visibility.showFarmsInfo
      ? getUserFarms(data).filter(farm => farm.nickname || farm.region || farm.alliance).map((farm, index) => makePublicFarm(farm, index, visibility.showWastelandInfo))
      : []
  };

  return publicPlayer;
}

const ADMIN_USERS_INDEX_COLLECTION = 'adminUsersIndex';
const ADMIN_COUNTERS_COLLECTION = 'adminCounters';
const ADMIN_COUNTERS_DOC_ID = 'global';
const ADMIN_INDEX_PREFIX_LIMIT = 32;
function adminSearchKey(value = '') {
  return normalizeText(value).toLowerCase();
}
function adminAllianceExactKey(value = '') {
  // Alliance search is intentionally case-sensitive: EVO, evo, Evo and eVo are different alliances.
  return normalizeAllianceTag(value);
}
function adminPrefixTerms(value = '') {
  const text = adminSearchKey(value).replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const parts = text.split(' ').filter(Boolean).slice(0, 6);
  const terms = new Set();
  [text, ...parts].forEach(part => {
    const safe = part.slice(0, ADMIN_INDEX_PREFIX_LIMIT);
    for (let i = 1; i <= safe.length; i += 1) terms.add(safe.slice(0, i));
  });
  return [...terms].slice(0, 120);
}
function adminIndexMs(value) {
  return timestampToMs(value) || Date.now();
}
function adminFilterToken(kind = '', ...parts) {
  const cleanParts = parts.map(part => normalizeText(part)).filter(Boolean);
  return cleanParts.length ? `${kind}:${cleanParts.join('::')}` : '';
}
function adminGameFilterTokens(game = {}, fallbackRole = 'player') {
  const region = gameRegion(game);
  const alliance = adminAllianceExactKey(game.alliance);
  const role = normalizeRole(game.role || fallbackRole || 'player');
  return [
    adminFilterToken('region', region),
    adminFilterToken('alliance', alliance),
    adminFilterToken('role', role),
    adminFilterToken('regionAlliance', region, alliance),
    adminFilterToken('regionRole', region, role),
    adminFilterToken('allianceRole', alliance, role),
    adminFilterToken('regionAllianceRole', region, alliance, role)
  ].filter(Boolean);
}
function adminIndexFarmPayload(farm = {}, index = 0) {
  const normalized = normalizeFarm(farm, farm.farmId || farm.id || `farm-${index + 1}`);
  return {
    farmId: normalized.farmId,
    id: normalized.id || normalized.farmId,
    nickname: normalized.nickname,
    region: gameRegion(normalized),
    alliance: normalizeAllianceTag(normalized.alliance),
    allianceExact: adminAllianceExactKey(normalized.alliance),
    allianceKey: adminSearchKey(normalized.alliance),
    rank: normalized.rank,
    shk: normalized.shk,
    role: normalizeRole(normalized.role || 'player'),
    roleLabel: roleLabel(normalized.role || 'player'),
    createdAt: normalized.createdAt || null,
    updatedAt: normalized.updatedAt || null
  };
}
export function makeAdminUserIndex(data = {}) {
  const uid = normalizeText(data.uid || data.id || '');
  const main = getGameProfile(data);
  const farms = getUserFarms(data).map(adminIndexFarmPayload);
  const role = normalizeRole(data.role || 'player');
  const allGames = [
    { ...main, role, farmId: 'main' },
    ...farms
  ];
  const regionKeys = [...new Set(allGames.map(game => gameRegion(game)).filter(Boolean))];
  const allianceKeys = [...new Set(allGames.map(game => adminAllianceExactKey(game.alliance)).filter(Boolean))];
  const allianceFoldedKeys = [...new Set(allGames.map(game => adminSearchKey(game.alliance)).filter(Boolean))];
  const roleKeys = [...new Set([role, ...farms.map(farm => normalizeRole(farm.role || 'player'))].filter(Boolean))];
  const adminFilterTokens = [...new Set(allGames.flatMap(game => adminGameFilterTokens(game, role)))].slice(0, 240);
  const searchPrefixes = [...new Set([
    ...adminPrefixTerms(main.nickname),
    ...adminPrefixTerms(data.email),
    ...adminPrefixTerms(data.displayName),
    ...farms.flatMap(farm => adminPrefixTerms(farm.nickname))
  ])].slice(0, 240);
  const createdAtMs = adminIndexMs(data.createdAt || data.updatedAt || data.lastLoginAt);
  return {
    uid,
    email: normalizeText(data.email).slice(0, 180),
    displayName: normalizeText(data.displayName).slice(0, 160),
    photoURL: normalizeText(data.photoURL).slice(0, 300),
    nickname: main.nickname,
    gameNick: main.nickname,
    region: gameRegion(main),
    alliance: normalizeAllianceTag(main.alliance),
    allianceExact: adminAllianceExactKey(main.alliance),
    allianceKey: adminSearchKey(main.alliance),
    rank: main.rank,
    shk: main.shk,
    role,
    roleLabel: roleLabel(role),
    gameProfile: main,
    farms,
    farmCount: farms.filter(farm => farm.nickname && farm.region).length,
    profileComplete: Boolean(isProfileComplete(data) || (main.nickname && main.region && main.alliance && main.rank && main.shk)),
    regionKeys,
    allianceKeys,
    allianceFoldedKeys,
    roleKeys,
    adminFilterTokens,
    searchPrefixes,
    createdAt: data.createdAt || data.updatedAt || data.lastLoginAt || null,
    updatedAt: data.updatedAt || null,
    lastLoginAt: data.lastLoginAt || null,
    createdAtMs,
    updatedAtMs: adminIndexMs(data.updatedAt || data.createdAt || data.lastLoginAt),
    source: 'admin-users-index-v145'
  };
}
async function writeAdminUserIndexDoc(db, firestoreMod, profile = {}, batch = null) {
  const index = makeAdminUserIndex(profile || {});
  if (!index.uid || !index.profileComplete) return null;
  const ref = firestoreMod.doc(db, ADMIN_USERS_INDEX_COLLECTION, index.uid);
  if (batch) batch.set(ref, index);
  else {
    await firestoreMod.setDoc(ref, index);
    trackWrites(1);
    await mirrorNotificationDirectoryIndexes([index], 'admin-index-single');
  }
  return index;
}
async function writeAdminUserIndexesForDocs(db, firestoreMod, docs = []) {
  const safeDocs = (Array.isArray(docs) ? docs : []).filter(Boolean);
  if (!safeDocs.length) return 0;
  let batch = firestoreMod.writeBatch(db);
  let count = 0;
  const payloads = [];
  for (const doc of safeDocs) {
    const profile = { id: doc.id, ...(doc.data?.() || {}), uid: doc.data?.()?.uid || doc.id };
    const payload = makeAdminUserIndex(profile);
    if (!payload.uid || !payload.profileComplete) continue;
    payloads.push(payload);
    batch.set(firestoreMod.doc(db, ADMIN_USERS_INDEX_COLLECTION, payload.uid), payload);
    count += 1;
    if (count % 400 === 0) {
      await batch.commit();
      batch = firestoreMod.writeBatch(db);
    }
  }
  if (count % 400 !== 0) await batch.commit();
  if (count) trackWrites(count);
  await mirrorNotificationDirectoryIndexes(payloads, 'admin-index-batch');
  return count;
}

function emptyAdminCounters() {
  return {
    playersTotal: 0,
    farmsTotal: 0,
    rowsTotal: 0,
    regionsTotal: 0,
    alliancesTotal: 0,
    leadershipRolesTotal: 0,
    pendingRequestsTotal: 0,
    adminCount: 0,
    moderatorCount: 0,
    consulCount: 0,
    officerCount: 0,
    playerCount: 0,
    updatedAtMs: Date.now(),
    source: 'admin-counters-v145'
  };
}

function adminCounterRoleIsLeader(role = 'player') {
  return ['admin', 'moderator', 'consul', 'officer'].includes(normalizeRole(role));
}

function buildAdminCountersFromIndexes(indexes = []) {
  const counters = emptyAdminCounters();
  const regions = new Set();
  const alliances = new Set();
  const safeIndexes = (Array.isArray(indexes) ? indexes : []).filter(index => index?.uid && index.profileComplete !== false);
  counters.playersTotal = safeIndexes.length;
  safeIndexes.forEach(index => {
    const role = normalizeRole(index.role || 'player');
    counters[`${role}Count`] = Number(counters[`${role}Count`] || 0) + 1;
    if (adminCounterRoleIsLeader(role)) counters.leadershipRolesTotal += 1;
    const farms = Array.isArray(index.farms) ? index.farms.filter(farm => farm?.nickname || farm?.region || farm?.alliance) : [];
    counters.farmsTotal += farms.length;
    (Array.isArray(index.regionKeys) ? index.regionKeys : [index.region]).forEach(region => {
      const safeRegion = normalizeText(region).replace(/[^0-9]/g, '');
      if (safeRegion) regions.add(safeRegion);
    });
    (Array.isArray(index.allianceKeys) ? index.allianceKeys : [index.alliance]).forEach(alliance => {
      const safeAlliance = adminAllianceExactKey(alliance);
      if (safeAlliance) alliances.add(safeAlliance);
    });
    farms.forEach(farm => {
      const farmRole = normalizeRole(farm.role || 'player');
      if (adminCounterRoleIsLeader(farmRole)) counters.leadershipRolesTotal += 1;
      const farmRegion = gameRegion(farm);
      const farmAlliance = adminAllianceExactKey(farm.alliance);
      if (farmRegion) regions.add(farmRegion);
      if (farmAlliance) alliances.add(farmAlliance);
    });
  });
  counters.rowsTotal = counters.playersTotal + counters.farmsTotal;
  counters.regionsTotal = regions.size;
  counters.alliancesTotal = alliances.size;
  counters.updatedAtMs = Date.now();
  return counters;
}

async function writeAdminCountersDoc(db, firestoreMod, counters = {}) {
  const payload = { ...emptyAdminCounters(), ...(counters || {}), updatedAt: firestoreMod.serverTimestamp(), updatedAtMs: Date.now(), source: 'admin-counters-v145' };
  await firestoreMod.setDoc(firestoreMod.doc(db, ADMIN_COUNTERS_COLLECTION, ADMIN_COUNTERS_DOC_ID), payload);
  trackWrites(1);
  return payload;
}

export async function getAdminCounters() {
  const firebase = await getFirebase();
  if (!firebase) return null;
  const { db, firestoreMod } = firebase;
  const snapshot = await firestoreMod.getDoc(firestoreMod.doc(db, ADMIN_COUNTERS_COLLECTION, ADMIN_COUNTERS_DOC_ID));
  trackReads(1);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}


function notificationDirectoryRowsFromIndex(index = {}) {
  if (!index?.uid) return [];
  const base = {
    uid: index.uid,
    email: index.email || '',
    displayName: index.displayName || '',
    photoURL: index.photoURL || '',
    accountRole: normalizeRole(index.role || 'player'),
    farmCount: getFarmCount(index),
    updatedAtMs: Number(index.updatedAtMs || index.createdAtMs) || Date.now()
  };
  const rows = [];
  const main = index.gameProfile || getGameProfile(index);
  if (main?.nickname && gameRegion(main)) {
    rows.push({
      ...base,
      farmId: 'main',
      nickname: main.nickname,
      gameNick: main.nickname,
      region: gameRegion(main),
      alliance: normalizeAllianceTag(main.alliance),
      role: normalizeRole(index.role || main.role || 'player'),
      rank: main.rank || index.rank || '',
      shk: main.shk || index.shk || ''
    });
  }
  (Array.isArray(index.farms) ? index.farms : []).forEach((farm, idx) => {
    if (!farm?.nickname || !gameRegion(farm)) return;
    rows.push({
      ...base,
      farmId: normalizeText(farm.farmId || farm.id || `farm-${idx + 1}`) || `farm-${idx + 1}`,
      nickname: farm.nickname,
      gameNick: farm.nickname,
      region: gameRegion(farm),
      alliance: normalizeAllianceTag(farm.alliance),
      role: normalizeRole(farm.role || 'player'),
      rank: farm.rank || '',
      shk: farm.shk || ''
    });
  });
  return rows;
}
async function mirrorNotificationDirectoryIndexes(indexes = [], source = 'admin-index') {
  const firebase = await getFirebase().catch(() => null);
  const actor = firebase?.auth?.currentUser || null;
  if (!actor) return { indexed: 0, rowsWritten: 0 };
  const rows = (Array.isArray(indexes) ? indexes : [])
    .flatMap(notificationDirectoryRowsFromIndex)
    .filter(row => row.uid && row.nickname && row.region);
  if (!rows.length) return { indexed: 0, rowsWritten: 0 };
  let indexed = 0;
  let rowsWritten = 0;
  for (let i = 0; i < rows.length; i += 20) {
    const chunk = rows.slice(i, i + 20);
    const result = await upsertNotificationDirectoryD1(actor, chunk).catch(error => {
      console.warn(`[WKD] notification D1 directory mirror skipped after ${source}:`, error?.message || error);
      return null;
    });
    indexed += Number(result?.indexed || 0);
    rowsWritten += Number(result?.rowsWritten || 0);
  }
  return { indexed, rowsWritten };
}

async function mirrorPublicStatsFromPublicPlayer(publicPlayer = {}, source = 'profile-save') {
  try {
    const firebase = await getFirebase();
    const actor = firebase?.auth?.currentUser || null;
    if (!actor || !publicPlayer?.uid) return;
    await mirrorPublicStatsPlayer(actor, publicPlayer);
  } catch (error) {
    console.warn(`[WKD] public stats D1 mirror skipped after ${source}:`, error?.message || error);
  }
}

async function markStatsChanged(db, firestoreMod, uid = '', changeType = 'profile_changed', source = 'client') {
  const safeUid = normalizeText(uid);
  if (!safeUid) return;
  try {
    const allowedTypes = ['profile_changed', 'farm_changed', 'role_changed', 'admin_changed', 'sync_changed'];
    const type = allowedTypes.includes(changeType) ? changeType : 'profile_changed';
    const safeSource = normalizeText(source || 'client').slice(0, 32) || 'client';
    const id = `${safeUid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await firestoreMod.setDoc(firestoreMod.doc(db, 'statsChanges', id), {
      uid: safeUid,
      playerKey: safeUid,
      changeType: type,
      source: safeSource,
      processed: false,
      createdAt: firestoreMod.serverTimestamp()
    });
    trackWrites(1);
  } catch (error) {
    console.warn('[WKD] stats change marker skipped:', error?.code || error?.message || error);
  }
}

async function writePublicPlayerFromProfile(db, firestoreMod, profile = {}) {
  if (!profile?.uid || !isProfileComplete(profile)) return null;
  const publicPlayer = makePublicPlayer(profile);
  const region = normalizeText(publicPlayer.region);
  await firestoreMod.setDoc(firestoreMod.doc(db, 'publicPlayers', profile.uid), publicPlayer, { merge: true });
  trackWrites(1);
  if (region) {
    await firestoreMod.setDoc(firestoreMod.doc(db, 'regions', region, 'players', profile.uid), publicPlayer, { merge: true });
    trackWrites(1);
  }
  removeCache('publicPlayers.v89');
  await markStatsChanged(db, firestoreMod, profile.uid, 'profile_changed', 'profile-save');
  await mirrorPublicStatsFromPublicPlayer(publicPlayer, 'profile-save');
  return publicPlayer;
}

export async function getUserProfile(uid, options = {}) {
  const userId = profileCacheUid(uid);
  if (!userId) return null;
  const forceRefresh = Boolean(options?.force || options?.forceRefresh || options?.skipCache);
  const ttlMs = Math.max(0, Number(options?.cacheTtlMs) || PROFILE_CACHE_TTL_MS);
  if (!forceRefresh) {
    const cached = readCachedUserProfile(userId, ttlMs);
    if (cached) return cached;
  }

  const firebase = await getFirebase();
  if (!firebase) return null;

  const { db, firestoreMod } = firebase;
  const ref = firestoreMod.doc(db, 'users', userId);
  const snapshot = await firestoreMod.getDoc(ref);
  trackReads(1);
  if (!snapshot.exists()) {
    removeUserProfileCache(userId);
    return null;
  }
  const profile = { id: snapshot.id, ...snapshot.data(), uid: snapshot.data()?.uid || snapshot.id };
  writeUserProfileCache(userId, profile);
  return profile;
}

export async function saveSignedInUser(user) {
  if (!user) return null;
  const firebase = await getFirebase();
  if (!firebase) return null;

  const { db, firestoreMod } = firebase;
  const ref = firestoreMod.doc(db, 'users', user.uid);
  const snapshot = await firestoreMod.getDoc(ref);
  trackReads(1);
  const now = firestoreMod.serverTimestamp();
  let profile = null;
  let touched = false;

  if (!snapshot.exists()) {
    const initialProfile = {
      uid: user.uid,
      displayName: user.displayName || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      country: '',
      countryCode: '',
      providerId: user.providerData?.[0]?.providerId || 'google.com',
      role: 'player',
      roleRequest: { requestedRole: 'player', status: 'none' },
      profileComplete: false,
      createdAt: now,
      lastLoginAt: now,
      updatedAt: now,
      gameProfile: {
        nickname: '',
        region: '',
        alliance: '',
        rank: 'p1',
        shk: '',
        state: 'new'
      },
      farms: [],
      regionAccess: [],
      allianceAccess: [],
      regionRoles: {},
      activeFarmId: 'main',
      profileVisibility: { showWastelandInfo: false, showFarmsInfo: false }
    };
    await firestoreMod.setDoc(ref, initialProfile, { merge: true });
    trackWrites(1);
    touched = true;
  } else {
    const old = { id: snapshot.id, ...snapshot.data(), uid: snapshot.data()?.uid || snapshot.id };
    const patch = buildSignInProfilePatch(user, old, getGameProfile(old), getUserFarms(old), now);
    if (Object.keys(patch).length) {
      await firestoreMod.setDoc(ref, patch, { merge: true });
      trackWrites(1);
      touched = true;
    } else {
      profile = old;
      writeUserProfileCache(user.uid, profile);
    }
  }

  if (touched) removeUserProfileCache(user.uid);
  if (!profile) profile = await getUserProfile(user.uid, { forceRefresh: true });

  if (isAdminUser(user, profile) && profile?.role !== 'admin') {
    try {
      await firestoreMod.setDoc(ref, {
        role: 'admin',
        roleLabel: roleLabel('admin'),
        updatedAt: now
      }, { merge: true });
      trackWrites(1);
      removeUserProfileCache(user.uid);
      profile = await getUserProfile(user.uid, { forceRefresh: true });
    } catch (error) {
      console.warn('Admin role sync failed', error);
    }
  }

  return profile;
}

export async function ensureCurrentUserPublished(user) {
  if (!user) return null;
  const profile = await getUserProfile(user.uid).catch(() => null);
  if (profile) return profile;
  return saveSignedInUser(user);
}

function makeRoleRequestPayload({ user, oldProfile, clean, requestedRole, farmId = 'main', now }) {
  const requestId = farmId !== 'main' ? `${user.uid}_${farmId}` : user.uid;
  const mainGame = getGameProfile(oldProfile || {});
  const currentRole = farmId === 'main'
    ? normalizeRole(oldProfile?.role || 'player')
    : normalizeRole(clean.role || 'player');
  return {
    id: requestId,
    requestId,
    uid: user.uid,
    farmId,
    farmName: clean.nickname || '',
    mainNickname: mainGame.nickname || oldProfile?.gameNick || '',
    farmLabel: farmId === 'main' ? serviceT('account.mainPlayer', 'Main player') : serviceT('account.farm', 'Farm'),
    requestedRole,
    requestedRoleLabel: roleLabel(requestedRole),
    currentRole,
    currentRoleLabel: roleLabel(currentRole),
    status: 'pending',
    nickname: clean.nickname,
    region: clean.region,
    alliance: normalizeAllianceTag(clean.alliance),
    rank: clean.rank,
    shk: clean.shk,
    email: user.email || oldProfile?.email || '',
    displayName: user.displayName || oldProfile?.displayName || '',
    photoURL: user.photoURL || oldProfile?.photoURL || '',
    updatedAt: now,
    requestedAt: now
  };
}

export async function saveGameRegistration(user, values) {
  if (!user) throw new Error('auth-required');
  const firebase = await getFirebase();
  if (!firebase) throw new Error('firebase-not-configured');

  const { db, firestoreMod } = firebase;
  const uid = user.uid;
  const userRef = firestoreMod.doc(db, 'users', uid);
  const oldProfile = await getUserProfile(uid);
  const now = firestoreMod.serverTimestamp();
  const currentRole = normalizeRole(oldProfile?.role || 'player');
  let requestedRole = normalizeRole(values.requestedRole || 'player');
  if (['admin', 'moderator'].includes(requestedRole) && !isOwnerEmail(user.email)) requestedRole = 'player';
  const farmId = normalizeText(values.farmId || 'main') || 'main';
  const requestDocId = farmId !== 'main' ? `${uid}_${farmId}` : uid;
  const requestRef = firestoreMod.doc(db, 'roleRequests', requestDocId);
  const profileVisibility = normalizeProfileVisibility(values.profileVisibility || oldProfile?.profileVisibility || {});
  const country = normalizeCountry(values.country || oldProfile?.country || '');
  const countryCode = normalizeCountryCode(values.countryCode || oldProfile?.countryCode || '');

  const oldMain = getGameProfile(oldProfile || {});
  const oldFarms = getUserFarms(oldProfile || {});
  const oldSelectedFarm = farmId === 'main'
    ? oldMain
    : (oldFarms.find(farm => farm.farmId === farmId || farm.id === farmId) || {});
  const clean = normalizeFarm({
    ...oldSelectedFarm,
    farmId,
    nickname: values.nickname,
    region: values.region,
    alliance: normalizeAllianceTag(values.alliance),
    rank: values.rank || 'p1',
    shk: values.shk,
    state: 'complete',
    updatedAt: Date.now()
  }, farmId);

  if (farmId !== 'main'
    && ['consul', 'officer'].includes(clean.role)
    && oldSelectedFarm.region
    && clean.region
    && oldSelectedFarm.region !== clean.region) {
    clean.role = 'player';
    clean.roleLabel = roleLabel('player');
  }

  await assertNicknameRegionUnique(db, firestoreMod, uid, farmId, clean);
  await assertAllianceRankLimit(db, firestoreMod, uid, farmId, clean);

  const regionChangedByLeader = farmId === 'main'
    && ['consul', 'officer'].includes(currentRole)
    && oldMain.region
    && clean.region
    && oldMain.region !== clean.region;
  const selectedCurrentRole = farmId === 'main' ? currentRole : normalizeRole(clean.role || oldSelectedFarm.role || 'player');
  const effectiveCurrentRole = regionChangedByLeader ? 'player' : selectedCurrentRole;
  let nextRolePatch = regionChangedByLeader
    ? { role: 'player', roleLabel: roleLabel('player') }
    : {};

  let roleRequest = oldProfile?.roleRequest || { requestedRole: 'player', status: 'none' };
  const roleRequestWrites = [];

  if (isRequestableRole(requestedRole) && requestedRole !== effectiveCurrentRole) {
    const requestPayload = makeRoleRequestPayload({ user, oldProfile, clean, requestedRole, farmId, now });
    roleRequest = {
      requestedRole,
      requestedRoleLabel: roleLabel(requestedRole),
      status: 'pending',
      statusLabel: roleRequestStatusLabel('pending'),
      requestedAt: now,
      updatedAt: now
    };
    roleRequestWrites.push(() => firestoreMod.setDoc(requestRef, requestPayload, { merge: true }));
  } else if (requestedRole === 'player' && oldProfile?.roleRequest?.status === 'pending') {
    roleRequest = { requestedRole: 'player', status: 'cancelled', statusLabel: roleRequestStatusLabel('cancelled'), updatedAt: now };
    roleRequestWrites.push(() => firestoreMod.setDoc(requestRef, { status: 'cancelled', updatedAt: now }, { merge: true }));
  } else if (requestedRole === effectiveCurrentRole && effectiveCurrentRole !== 'player') {
    roleRequest = { requestedRole: effectiveCurrentRole, status: 'approved', statusLabel: roleRequestStatusLabel('approved'), updatedAt: now };
  } else if (!isRequestableRole(requestedRole)) {
    roleRequest = oldProfile?.roleRequest?.status === 'pending'
      ? oldProfile.roleRequest
      : { requestedRole: 'player', status: 'none', statusLabel: roleRequestStatusLabel('none') };
  }

  const nextFarms = farmId === 'main'
    ? oldFarms
    : [clean, ...oldFarms.filter(farm => farm.farmId !== farmId && farm.id !== farmId)];
  const mainGame = farmId === 'main' ? clean : oldMain;
  const profileComplete = Boolean(mainGame.nickname && mainGame.region && mainGame.alliance && mainGame.rank && mainGame.shk);

  // Не переписуємо захищені поля uid/email/role/createdAt.
  // Так звичайний гравець може зберегти ферми без помилок права доступу.
  await firestoreMod.setDoc(userRef, {
    ...nextRolePatch,
    roleRequest,
    country,
    countryCode,
    profileComplete,
    gameNick: mainGame.nickname,
    region: mainGame.region,
    alliance: mainGame.alliance,
    rank: mainGame.rank,
    shk: mainGame.shk,
    gameProfile: mainGame,
    farms: nextFarms,
    farmCount: getFarmCount({ gameProfile: mainGame, farms: nextFarms, profileComplete }),
    regionAccess: buildRegionAccess(mainGame, nextFarms),
    allianceAccess: buildAllianceAccess(mainGame, nextFarms),
    regionRoles: buildRegionRoles(mainGame, nextFarms),
    activeFarmId: farmId,
    profileVisibility,
    updatedAt: now
  }, { merge: true });

  await Promise.all(roleRequestWrites.map(write => write()));

  removeUserProfileCache(uid);
  const savedProfile = await getUserProfile(uid, { forceRefresh: true });
  await syncProfileIndexLocks(db, firestoreMod, uid, oldProfile || {}, savedProfile || {}).catch(error => console.warn('Profile index sync failed after profile save', error));
  if (regionChangedByLeader && oldMain.region) {
    await firestoreMod.deleteDoc(firestoreMod.doc(db, 'regions', oldMain.region, 'players', uid)).catch(() => null);
  }
  if (isProfileComplete(savedProfile)) {
    await writePublicPlayerFromProfile(db, firestoreMod, savedProfile).catch(error => {
      console.warn('Public player sync failed after profile save', error);
    });
  }

  return getUserProfile(uid, { forceRefresh: true });
}

export async function saveFarmWastelandProfile(user, farmId = 'main', values = {}) {
  if (!user) throw new Error('auth-required');
  const firebase = await getFirebase();
  if (!firebase) throw new Error('firebase-not-configured');

  const { db, firestoreMod } = firebase;
  const oldProfile = await getUserProfile(user.uid);
  if (!oldProfile) throw new Error('profile-not-found');

  const now = firestoreMod.serverTimestamp();
  const safeFarmId = normalizeText(farmId || 'main') || 'main';
  const oldMain = getGameProfile(oldProfile);
  const oldFarms = getUserFarms(oldProfile);
  const currentFarm = safeFarmId === 'main'
    ? oldMain
    : (oldFarms.find(farm => farm.farmId === safeFarmId || farm.id === safeFarmId) || null);
  if (!currentFarm) throw new Error('farm-not-found');

  const cleanForm = normalizeWastelandProfile(values);
  const updatedFarm = normalizeFarm({
    ...currentFarm,
    nickname: values.nickname || currentFarm.nickname,
    alliance: values.alliance || currentFarm.alliance,
    wastelandProfile: cleanForm,
    updatedAt: Date.now()
  }, safeFarmId);

  await assertNicknameRegionUnique(db, firestoreMod, user.uid, safeFarmId, updatedFarm);
  await assertAllianceRankLimit(db, firestoreMod, user.uid, safeFarmId, updatedFarm);

  let nextMain = oldMain;
  let nextFarms = oldFarms;
  if (safeFarmId === 'main') {
    nextMain = updatedFarm;
  } else {
    nextFarms = [updatedFarm, ...oldFarms.filter(farm => farm.farmId !== safeFarmId && farm.id !== safeFarmId)];
  }

  const profileComplete = Boolean(nextMain.nickname && nextMain.region && nextMain.alliance && nextMain.rank && nextMain.shk);
  await firestoreMod.setDoc(firestoreMod.doc(db, 'users', user.uid), {
    profileComplete,
    gameNick: nextMain.nickname,
    region: nextMain.region,
    alliance: nextMain.alliance,
    rank: nextMain.rank,
    shk: nextMain.shk,
    gameProfile: nextMain,
    farms: nextFarms,
    farmCount: getFarmCount({ gameProfile: nextMain, farms: nextFarms, profileComplete }),
    regionAccess: buildRegionAccess(nextMain, nextFarms),
    allianceAccess: buildAllianceAccess(nextMain, nextFarms),
    regionRoles: buildRegionRoles(nextMain, nextFarms),
    activeFarmId: safeFarmId,
    updatedAt: now
  }, { merge: true });

  removeUserProfileCache(user.uid);
  const savedProfile = await getUserProfile(user.uid, { forceRefresh: true });
  await syncProfileIndexLocks(db, firestoreMod, user.uid, oldProfile || {}, savedProfile || {}).catch(error => console.warn('Profile index sync failed after Wasteland profile save', error));
  if (isProfileComplete(savedProfile)) {
    await writePublicPlayerFromProfile(db, firestoreMod, savedProfile).catch(error => {
      console.warn('Public player sync failed after saved Wasteland data', error);
    });
  }
  return savedProfile;
}


export async function makeFarmPrimary(user, farmId) {
  if (!user || !farmId || farmId === 'main') throw new Error('farm-primary-denied');
  const firebase = await getFirebase();
  if (!firebase) throw new Error('firebase-not-configured');
  const { db, firestoreMod } = firebase;
  const oldProfile = await getUserProfile(user.uid);
  if (!oldProfile) throw new Error('profile-not-found');

  const safeFarmId = normalizeText(farmId);
  const oldMain = getGameProfile(oldProfile);
  const oldFarms = getUserFarms(oldProfile);
  const targetFarm = oldFarms.find(farm => farm.farmId === safeFarmId || farm.id === safeFarmId);
  if (!targetFarm) throw new Error('farm-not-found');

  const now = firestoreMod.serverTimestamp();
  const currentRole = normalizeRole(oldProfile.role || 'player');
  const newMain = normalizeFarm({
    ...targetFarm,
    farmId: 'main',
    id: 'main',
    state: 'complete',
    updatedAt: Date.now()
  }, 'main');

  const oldMainHasData = Boolean(oldMain.nickname || oldMain.region || oldMain.alliance || oldMain.shk);
  const oldMainFarmId = `farm-main-${Date.now()}`;
  const oldMainAsFarm = oldMainHasData
    ? normalizeFarm({
      ...oldMain,
      role: ['admin', 'moderator'].includes(currentRole) ? 'player' : currentRole,
      farmId: oldMainFarmId,
      id: oldMainFarmId,
      updatedAt: Date.now()
    })
    : null;
  const nextFarms = [
    ...(oldMainAsFarm ? [oldMainAsFarm] : []),
    ...oldFarms.filter(farm => farm.farmId !== safeFarmId && farm.id !== safeFarmId)
  ];

  const targetRegionRole = normalizeRole(targetFarm.role || 'player');
  const regionChangedByLeader = ['consul', 'officer'].includes(currentRole)
    && oldMain.region
    && newMain.region
    && oldMain.region !== newMain.region;
  const profileComplete = Boolean(newMain.nickname && newMain.region && newMain.alliance && newMain.rank && newMain.shk);
  let rolePatch = {};
  if (!['admin', 'moderator'].includes(currentRole) && ['consul', 'officer'].includes(targetRegionRole)) {
    rolePatch = {
      role: targetRegionRole,
      roleLabel: roleLabel(targetRegionRole),
      roleRequest: { requestedRole: targetRegionRole, status: 'approved', statusLabel: roleRequestStatusLabel('approved'), updatedAt: now }
    };
  } else if (regionChangedByLeader) {
    rolePatch = {
      role: 'player',
      roleLabel: roleLabel('player'),
      roleRequest: { requestedRole: 'player', status: 'none', statusLabel: roleRequestStatusLabel('none'), updatedAt: now }
    };
  }

  const batch = firestoreMod.writeBatch(db);
  batch.set(firestoreMod.doc(db, 'users', user.uid), {
    ...rolePatch,
    profileComplete,
    gameNick: newMain.nickname,
    nickname: newMain.nickname,
    region: newMain.region,
    alliance: newMain.alliance,
    rank: newMain.rank,
    shk: newMain.shk,
    gameProfile: newMain,
    farms: nextFarms,
    farmCount: getFarmCount({ gameProfile: newMain, farms: nextFarms, profileComplete }),
    regionAccess: buildRegionAccess(newMain, nextFarms),
    allianceAccess: buildAllianceAccess(newMain, nextFarms),
    regionRoles: buildRegionRoles(newMain, nextFarms),
    activeFarmId: 'main',
    updatedAt: now
  }, { merge: true });

  if (oldMain.region && oldMain.region !== newMain.region) {
    batch.delete(firestoreMod.doc(db, 'regions', oldMain.region, 'players', user.uid));
  }

  await batch.commit();
  removeUserProfileCache(user.uid);
  const savedProfile = await getUserProfile(user.uid, { forceRefresh: true });
  await syncProfileIndexLocks(db, firestoreMod, user.uid, oldProfile || {}, savedProfile || {}).catch(error => console.warn('Profile index sync failed after primary farm change', error));
  if (isProfileComplete(savedProfile)) {
    await writePublicPlayerFromProfile(db, firestoreMod, savedProfile).catch(error => {
      console.warn('Public player sync failed after primary farm change', error);
    });
  }
  return getUserProfile(user.uid, { forceRefresh: true });
}

export async function deleteFarm(user, farmId) {
  if (!user || !farmId || farmId === 'main') throw new Error('farm-delete-denied');
  const firebase = await getFirebase();
  if (!firebase) throw new Error('firebase-not-configured');
  const { db, firestoreMod } = firebase;
  const oldProfile = await getUserProfile(user.uid);
  if (!oldProfile) throw new Error('profile-not-found');
  const farms = getUserFarms(oldProfile).filter(farm => farm.farmId !== farmId && farm.id !== farmId);
  const now = firestoreMod.serverTimestamp();
  await firestoreMod.setDoc(firestoreMod.doc(db, 'users', user.uid), {
    farms,
    farmCount: getFarmCount({ ...oldProfile, farms }),
    regionAccess: buildRegionAccess(getGameProfile(oldProfile), farms),
    allianceAccess: buildAllianceAccess(getGameProfile(oldProfile), farms),
    regionRoles: buildRegionRoles(getGameProfile(oldProfile), farms),
    activeFarmId: 'main',
    updatedAt: now
  }, { merge: true });
  removeUserProfileCache(user.uid);
  const savedProfile = await getUserProfile(user.uid, { forceRefresh: true });
  await syncProfileIndexLocks(db, firestoreMod, user.uid, oldProfile || {}, savedProfile || {}).catch(error => console.warn('Profile index sync failed after farm delete', error));
  await writePublicPlayerFromProfile(db, firestoreMod, savedProfile).catch(() => null);
  return savedProfile;
}

export async function listRoleRequests(status = 'pending', options = {}) {
  const firebase = await getFirebase();
  if (!firebase) return [];
  const { db, firestoreMod } = firebase;
  const limitCount = Math.max(1, Math.min(100, Number(options?.limitCount || options?.limit || 50)));
  const clauses = [
    firestoreMod.collection(db, 'roleRequests'),
    firestoreMod.where('status', '==', status),
    firestoreMod.limit(limitCount)
  ];
  const queryRef = firestoreMod.query(...clauses);
  const snapshot = await firestoreMod.getDocs(queryRef);
  trackReads(Math.max(1, snapshot.docs.length));
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => timestampToMs(b.createdAt) - timestampToMs(a.createdAt) || String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk'));
}

function adminUserFilterValue(value = '') {
  return normalizeText(value).toLowerCase();
}
function adminAllianceFilterValue(value = '') {
  // Keep alliance filters case-sensitive: EVO, evo, Evo and eVo are different alliances.
  return adminAllianceExactKey(value);
}
function adminUserMatchesFilters(user = {}, filters = {}) {
  const game = getGameProfile(user);
  const farms = getUserFarms(user);
  const allGames = [game, ...farms];
  const nick = adminUserFilterValue(filters.nick);
  const region = normalizeText(filters.region).replace(/[^0-9]/g, '');
  const alliance = adminAllianceFilterValue(filters.alliance);
  const role = normalizeRole(filters.role || 'all');
  if (role && role !== 'all' && normalizeRole(user.role || 'player') !== role && !farms.some(farm => normalizeRole(farm.role || 'player') === role)) return false;
  if (nick && !allGames.some(item => adminUserFilterValue(item.nickname || item.gameNick).includes(nick)) && !adminUserFilterValue(user.email).includes(nick) && !adminUserFilterValue(user.displayName).includes(nick)) return false;
  if (region && !allGames.some(item => gameRegion(item) === region)) return false;
  if (alliance && !allGames.some(item => adminAllianceFilterValue(item.alliance) === alliance)) return false;
  return true;
}

function buildAdminUsersIndexQuery(firestoreMod, db, { cursor = null, direction = 'next', pageSize = 10, filters = {} } = {}) {
  const clauses = [firestoreMod.collection(db, ADMIN_USERS_INDEX_COLLECTION)];
  const nick = adminSearchKey(filters.nick).slice(0, ADMIN_INDEX_PREFIX_LIMIT);
  const region = normalizeText(filters.region).replace(/[^0-9]/g, '');
  const alliance = adminAllianceFilterValue(filters.alliance);
  const role = normalizeRole(filters.role || 'all');
  const hasRole = Boolean(role && role !== 'all');
  const hasFilters = Boolean(nick || region || alliance || hasRole);

  // Keep reads cheap: one indexed query, limit(pageSize + 1), no full users scan.
  // Alliance filter is exact and case-sensitive.
  if (nick) {
    clauses.push(firestoreMod.where('searchPrefixes', 'array-contains', nick));
  } else {
    let token = '';
    if (region && alliance && hasRole) token = adminFilterToken('regionAllianceRole', region, alliance, role);
    else if (region && alliance) token = adminFilterToken('regionAlliance', region, alliance);
    else if (region && hasRole) token = adminFilterToken('regionRole', region, role);
    else if (alliance && hasRole) token = adminFilterToken('allianceRole', alliance, role);
    else if (region) token = adminFilterToken('region', region);
    else if (alliance) token = adminFilterToken('alliance', alliance);
    else if (hasRole) token = adminFilterToken('role', role);
    if (token) clauses.push(firestoreMod.where('adminFilterTokens', 'array-contains', token));
  }

  if (!hasFilters) clauses.push(firestoreMod.orderBy('createdAtMs', 'desc'));

  if (cursor) {
    if (!hasFilters && direction === 'prev') clauses.push(firestoreMod.endBefore(cursor), firestoreMod.limitToLast(pageSize));
    else clauses.push(firestoreMod.startAfter(cursor), firestoreMod.limit(pageSize));
  } else {
    clauses.push(firestoreMod.limit(pageSize));
  }
  return firestoreMod.query(...clauses);
}

function buildAdminUsersQuery(firestoreMod, db, { cursor = null, direction = 'next', pageSize = 10, filters = {}, strictProfileComplete = true, serverFilters = true } = {}) {
  const clauses = [firestoreMod.collection(db, 'users')];
  const role = normalizeRole(filters.role || 'all');
  if (strictProfileComplete) clauses.push(firestoreMod.where('profileComplete', '==', true));
  if (serverFilters && role && role !== 'all') clauses.push(firestoreMod.where('role', '==', role));
  clauses.push(firestoreMod.orderBy('createdAt', 'desc'));
  if (cursor) {
    if (direction === 'prev') clauses.push(firestoreMod.endBefore(cursor), firestoreMod.limitToLast(pageSize));
    else clauses.push(firestoreMod.startAfter(cursor), firestoreMod.limit(pageSize));
  } else {
    clauses.push(firestoreMod.limit(pageSize));
  }
  return firestoreMod.query(...clauses);
}

function buildLegacyAdminUsersQuery(firestoreMod, db, { pageSize = 10 } = {}) {
  return firestoreMod.query(firestoreMod.collection(db, 'users'), firestoreMod.limit(Math.max(1, Math.min(100, Number(pageSize) || 10))));
}

function buildAdminUsersIndexDirectQuery(firestoreMod, db, { pageSize = 10, filters = {} } = {}) {
  const nick = adminSearchKey(filters.nick).slice(0, ADMIN_INDEX_PREFIX_LIMIT);
  const region = normalizeText(filters.region).replace(/[^0-9]/g, '');
  const alliance = adminAllianceFilterValue(filters.alliance);
  const role = normalizeRole(filters.role || 'all');
  const clauses = [firestoreMod.collection(db, ADMIN_USERS_INDEX_COLLECTION)];
  if (nick) clauses.push(firestoreMod.where('searchPrefixes', 'array-contains', nick));
  if (region) clauses.push(firestoreMod.where('region', '==', region));
  if (alliance) clauses.push(firestoreMod.where('allianceExact', '==', alliance));
  if (role && role !== 'all') clauses.push(firestoreMod.where('role', '==', role));
  clauses.push(firestoreMod.limit(Math.max(1, Math.min(50, Number(pageSize) || 10))));
  return firestoreMod.query(...clauses);
}

function buildPublicPlayersAdminSearchQuery(firestoreMod, db, { pageSize = 10, filters = {} } = {}) {
  const nick = normalizeText(filters.nick);
  const region = normalizeText(filters.region).replace(/[^0-9]/g, '');
  const alliance = adminAllianceFilterValue(filters.alliance);
  const role = normalizeRole(filters.role || 'all');
  const clauses = [firestoreMod.collection(db, 'publicPlayers')];
  if (nick) clauses.push(firestoreMod.where('nickname', '==', nick));
  if (region) clauses.push(firestoreMod.where('region', '==', region));
  if (alliance) clauses.push(firestoreMod.where('alliance', '==', alliance));
  if (role && role !== 'all') clauses.push(firestoreMod.where('role', '==', role));
  clauses.push(firestoreMod.limit(Math.max(1, Math.min(50, Number(pageSize) || 10))));
  return firestoreMod.query(...clauses);
}

function buildUsersAdminExactSearchQueries(firestoreMod, db, { pageSize = 10, filters = {} } = {}) {
  const limitCount = Math.max(1, Math.min(50, Number(pageSize) || 10));
  const nick = normalizeText(filters.nick);
  const region = normalizeText(filters.region).replace(/[^0-9]/g, '');
  const alliance = adminAllianceFilterValue(filters.alliance);
  const role = normalizeRole(filters.role || 'all');
  const makeQuery = (field, value) => {
    const clauses = [firestoreMod.collection(db, 'users'), firestoreMod.where(field, '==', value)];
    if (role && role !== 'all') clauses.push(firestoreMod.where('role', '==', role));
    clauses.push(firestoreMod.limit(limitCount));
    return firestoreMod.query(...clauses);
  };
  const queries = [];
  // These are exact, cheap repair queries for old profiles that do not yet have adminUsersIndex docs.
  // They never scan the whole users collection. Alliance is case-sensitive by design.
  if (alliance) {
    queries.push(makeQuery('gameProfile.alliance', alliance));
    queries.push(makeQuery('alliance', alliance));
  } else if (nick) {
    queries.push(makeQuery('gameProfile.nickname', nick));
    queries.push(makeQuery('nickname', nick));
    queries.push(makeQuery('gameNick', nick));
  } else if (region) {
    queries.push(makeQuery('gameProfile.region', region));
    queries.push(makeQuery('region', region));
  } else if (role && role !== 'all') {
    queries.push(makeQuery('role', role));
  }
  return queries;
}

function mergeUniqueDocs(target = [], docs = []) {
  const seen = new Set(target.map(doc => doc?.id).filter(Boolean));
  (Array.isArray(docs) ? docs : []).forEach(doc => {
    if (!doc?.id || seen.has(doc.id)) return;
    seen.add(doc.id);
    target.push(doc);
  });
  return target;
}

async function loadAdminUsersFromPublicPlayers(db, firestoreMod, publicDocs = []) {
  const refs = (Array.isArray(publicDocs) ? publicDocs : [])
    .map(doc => normalizeText(doc.data?.()?.uid || doc.id))
    .filter(Boolean)
    .slice(0, 50)
    .map(uid => firestoreMod.doc(db, 'users', uid));
  if (!refs.length) return [];
  const docs = await Promise.all(refs.map(ref => firestoreMod.getDoc(ref).catch(() => null)));
  return docs.filter(doc => doc?.exists?.());
}
function mapAdminIndexDocs(rawDocs = [], filters = {}) {
  return rawDocs
    .map(doc => ({ id: doc.id, ...doc.data(), uid: doc.data()?.uid || doc.id, __doc: doc }))
    .filter(user => user.profileComplete !== false)
    .filter(user => adminUserMatchesFilters(user, filters))
    .sort((a, b) => Number(b.createdAtMs || timestampToMs(b.createdAt || b.updatedAt || b.lastLoginAt)) - Number(a.createdAtMs || timestampToMs(a.createdAt || a.updatedAt || a.lastLoginAt)));
}
function mapAdminUserDocs(rawDocs = [], filters = {}) {
  return rawDocs
    .map(doc => ({ id: doc.id, ...doc.data(), uid: doc.data()?.uid || doc.id, __doc: doc }))
    .filter(user => user.profileComplete !== false)
    .filter(user => adminUserMatchesFilters(user, filters))
    .sort((a, b) => timestampToMs(b.createdAt || b.updatedAt || b.lastLoginAt) - timestampToMs(a.createdAt || a.updatedAt || a.lastLoginAt));
}

export async function listRegisteredUsersPage(options = {}) {
  const firebase = await getFirebase();
  if (!firebase) return { users: [], firstDoc: null, lastDoc: null, hasNext: false, reads: 0, pageSize: 10, filters: {} };
  const { db, firestoreMod } = firebase;
  const pageSize = Math.max(1, Math.min(50, Number(options?.pageSize || 10)));
  const filters = options?.filters || {};
  const hasFilters = Boolean(adminUserFilterValue(filters.nick) || normalizeText(filters.region) || normalizeText(filters.alliance) || (normalizeRole(filters.role || 'all') !== 'all'));
  const queryPageSize = pageSize + 1;

  let readCount = 0;
  let rawDocs = [];
  let mapped = [];
  let queryMode = 'adminUsersIndex';
  let indexQueryFailed = false;
  try {
    const indexSnap = await firestoreMod.getDocs(buildAdminUsersIndexQuery(firestoreMod, db, {
      cursor: options?.cursor || null,
      direction: options?.direction === 'prev' ? 'prev' : 'next',
      pageSize: queryPageSize,
      filters
    }));
    readCount += Math.max(1, indexSnap.docs.length);
    rawDocs = indexSnap.docs || [];
    mapped = mapAdminIndexDocs(rawDocs, filters);
  } catch (error) {
    console.warn('[WKD] adminUsersIndex query failed; using small users fallback:', error?.code || error?.message || error);
    queryMode = 'users-small-fallback';
    indexQueryFailed = true;
  }

  if (!mapped.length && hasFilters && !options?.cursor && !indexQueryFailed) {
    try {
      const directSnap = await firestoreMod.getDocs(buildAdminUsersIndexDirectQuery(firestoreMod, db, {
        pageSize: queryPageSize,
        filters
      }));
      readCount += Math.max(1, directSnap.docs.length);
      if (directSnap.docs.length) {
        rawDocs = directSnap.docs || [];
        mapped = mapAdminIndexDocs(rawDocs, filters);
        queryMode = 'adminUsersIndex-direct';
      }
    } catch (directError) {
      console.warn('[WKD] adminUsersIndex direct query skipped:', directError?.code || directError?.message || directError);
    }
  }

  if (!mapped.length && hasFilters && !options?.cursor) {
    try {
      const publicSnap = await firestoreMod.getDocs(buildPublicPlayersAdminSearchQuery(firestoreMod, db, {
        pageSize: queryPageSize,
        filters
      }));
      readCount += Math.max(1, publicSnap.docs.length);
      if (publicSnap.docs.length) {
        const userDocs = await loadAdminUsersFromPublicPlayers(db, firestoreMod, publicSnap.docs);
        readCount += userDocs.length;
        rawDocs = userDocs;
        mapped = mapAdminUserDocs(rawDocs, filters);
        const indexedCount = await writeAdminUserIndexesForDocs(db, firestoreMod, rawDocs).catch(error => {
          console.warn('[WKD] admin publicPlayers search index repair skipped:', error?.code || error?.message || error);
          return 0;
        });
        queryMode = indexedCount ? `publicPlayers-repair-${indexedCount}` : 'publicPlayers-search';
      }
    } catch (publicError) {
      console.warn('[WKD] publicPlayers admin search fallback skipped:', publicError?.code || publicError?.message || publicError);
    }
  }

  if (!mapped.length && hasFilters && !options?.cursor) {
    const exactQueries = buildUsersAdminExactSearchQueries(firestoreMod, db, { pageSize: queryPageSize, filters });
    if (exactQueries.length) {
      try {
        const exactDocs = [];
        for (const q of exactQueries) {
          const snap = await firestoreMod.getDocs(q);
          readCount += Math.max(1, snap.docs.length);
          mergeUniqueDocs(exactDocs, snap.docs || []);
          if (exactDocs.length >= queryPageSize) break;
        }
        if (exactDocs.length) {
          rawDocs = exactDocs;
          mapped = mapAdminUserDocs(rawDocs, filters);
          const indexedCount = await writeAdminUserIndexesForDocs(db, firestoreMod, rawDocs).catch(error => {
            console.warn('[WKD] admin exact users search index repair skipped:', error?.code || error?.message || error);
            return 0;
          });
          queryMode = indexedCount ? `users-exact-repair-${indexedCount}` : 'users-exact-search';
        }
      } catch (exactError) {
        console.warn('[WKD] exact users admin search fallback skipped:', exactError?.code || exactError?.message || exactError);
      }
    }
  }

  // One-time self-healing fallback for old profiles that do not yet have adminUsersIndex docs.
  // Important: for active searches, a zero-result indexed query stays cheap and does NOT scan users.
  // If the player is old and missing from the index, publicPlayers search repairs the index without scanning users.
  const shouldTryUsersFallback = !mapped.length && !options?.cursor && (!hasFilters || indexQueryFailed);
  if (shouldTryUsersFallback) {
    try {
      const fallbackLimit = hasFilters ? Math.max(pageSize + 1, Math.min(100, Number(options?.scanLimit || 50))) : pageSize + 1;
      const userSnap = await firestoreMod.getDocs(buildAdminUsersQuery(firestoreMod, db, {
        pageSize: fallbackLimit,
        filters,
        strictProfileComplete: true,
        serverFilters: true
      }));
      readCount += Math.max(1, userSnap.docs.length);
      rawDocs = userSnap.docs || [];
      mapped = mapAdminUserDocs(rawDocs, filters);
      const indexedCount = await writeAdminUserIndexesForDocs(db, firestoreMod, rawDocs).catch(error => {
        console.warn('[WKD] admin users index self-heal skipped:', error?.code || error?.message || error);
        return 0;
      });
      queryMode = indexedCount ? `${queryMode}+self-healed-${indexedCount}` : `${queryMode}+users-fallback`;
    } catch (fallbackError) {
      console.warn('[WKD] admin users small fallback failed:', fallbackError?.code || fallbackError?.message || fallbackError);
    }
  }

  if (shouldTryUsersFallback && !mapped.length) {
    try {
      const legacyLimit = hasFilters ? Math.max(pageSize + 1, Math.min(100, Number(options?.scanLimit || 50))) : pageSize + 1;
      const legacySnapshot = await firestoreMod.getDocs(buildLegacyAdminUsersQuery(firestoreMod, db, { pageSize: legacyLimit }));
      readCount += Math.max(1, legacySnapshot.docs.length);
      rawDocs = legacySnapshot.docs || [];
      mapped = mapAdminUserDocs(rawDocs, filters);
      const indexedCount = await writeAdminUserIndexesForDocs(db, firestoreMod, rawDocs).catch(() => 0);
      queryMode = indexedCount ? `${queryMode}+legacy-self-healed-${indexedCount}` : `${queryMode}+legacy-fallback`;
    } catch (legacyError) {
      console.warn('[WKD] legacy admin users fallback failed:', legacyError?.code || legacyError?.message || legacyError);
    }
  }

  trackReads(readCount || 1);
  const pageUsers = mapped.slice(0, pageSize).map(({ __doc, ...user }) => user);
  const pageDocs = mapped.slice(0, pageSize).map(user => user.__doc).filter(Boolean);
  const hasNext = rawDocs.length > pageSize || mapped.length > pageSize;
  return {
    users: pageUsers,
    firstDoc: pageDocs[0] || rawDocs[0] || null,
    lastDoc: pageDocs[pageDocs.length - 1] || rawDocs[Math.min(rawDocs.length, pageSize) - 1] || null,
    hasNext,
    reads: readCount || 1,
    pageSize,
    filters,
    queryMode
  };
}

export async function rebuildAdminUsersIndex(options = {}) {
  const firebase = await getFirebase();
  if (!firebase) return { scanned: 0, indexed: 0, reads: 0, writes: 0 };
  const { db, firestoreMod, auth } = firebase;
  const actor = auth?.currentUser || null;
  if (!actor?.uid) throw new Error('auth-required');
  const actorProfile = await getUserProfile(actor.uid, { forceRefresh: true });
  if (!(isOwnerUser(actor, actorProfile) || ['admin', 'moderator'].includes(normalizeRole(actorProfile?.role || 'player')))) throw new Error('admin-only');
  const limitCount = Math.max(1, Math.min(5000, Number(options?.limitCount || options?.limit || 5000)));
  const snap = await firestoreMod.getDocs(firestoreMod.query(firestoreMod.collection(db, 'users'), firestoreMod.limit(limitCount)));
  const scanned = snap.docs.length;
  let readCount = Math.max(1, scanned);
  trackReads(readCount);
  const indexPayloads = snap.docs
    .map(doc => makeAdminUserIndex({ id: doc.id, ...(doc.data?.() || {}), uid: doc.data?.()?.uid || doc.id }))
    .filter(index => index.uid && index.profileComplete);
  const indexed = await writeAdminUserIndexesForDocs(db, firestoreMod, snap.docs);
  const countersPayload = buildAdminCountersFromIndexes(indexPayloads);
  try {
    const pendingSnap = await firestoreMod.getDocs(firestoreMod.query(
      firestoreMod.collection(db, 'roleRequests'),
      firestoreMod.where('status', '==', 'pending'),
      firestoreMod.limit(500)
    ));
    readCount += Math.max(1, pendingSnap.docs.length);
    trackReads(Math.max(1, pendingSnap.docs.length));
    countersPayload.pendingRequestsTotal = pendingSnap.docs.length;
  } catch (error) {
    console.warn('[WKD] admin pending request counter skipped:', error?.code || error?.message || error);
  }
  const counters = await writeAdminCountersDoc(db, firestoreMod, countersPayload);
  return { scanned, indexed, reads: readCount, writes: indexed + 1, counters };
}

export async function listRegisteredUsers() {
  const firebase = await getFirebase();
  if (!firebase) return [];
  const { db, firestoreMod } = firebase;
  const snapshot = await firestoreMod.getDocs(firestoreMod.collection(db, 'users'));
  trackReads(Math.max(1, snapshot.docs.length));
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(user => user.profileComplete)
    .sort((a, b) => timestampToMs(b.createdAt) - timestampToMs(a.createdAt));
}


async function requireFirebaseArchiveCleanupAccess(actor) {
  if (!actor?.uid) throw new Error('auth-required');
  const firebase = await getFirebase();
  if (!firebase) throw new Error('firebase-unavailable');
  const profile = await getUserProfile(actor.uid).catch(() => null);
  if (!(isOwnerUser(actor, profile) || normalizeRole(profile?.role || 'player') === 'admin')) throw new Error('admin-only');
  return { firebase, profile };
}

function oldArchiveCutoffMs(retentionDays = 30) {
  return Date.now() - Math.max(1, Number(retentionDays) || 30) * 24 * 60 * 60 * 1000;
}

function isOldReadFirebaseNotification(data = {}, cutoffMs = 0) {
  const created = Number(data.createdAtMs || timestampToMs(data.createdAt) || 0);
  if (!created || created >= cutoffMs) return false;
  return data.unread === false || Boolean(data.readAtMs) || Boolean(data.readAt);
}

async function commitDeleteDocs(firebase, docs = []) {
  const safeDocs = Array.isArray(docs) ? docs.filter(Boolean) : [];
  if (!safeDocs.length) return 0;
  const { db, firestoreMod } = firebase;
  let deleted = 0;
  for (let i = 0; i < safeDocs.length; i += 450) {
    const chunk = safeDocs.slice(i, i + 450);
    const batch = firestoreMod.writeBatch(db);
    chunk.forEach(docSnap => batch.delete(docSnap.ref));
    await batch.commit();
    deleted += chunk.length;
  }
  if (deleted) trackDeletes(deleted);
  return deleted;
}

async function getOldestDocsFromCollection(firebase, collectionRef, { cutoffMs, limitCount = 500, fallbackFilter = null } = {}) {
  const { firestoreMod } = firebase;
  const safeLimit = Math.max(1, Math.min(500, Number(limitCount) || 500));
  const docs = [];
  try {
    const q = firestoreMod.query(
      collectionRef,
      firestoreMod.where('createdAtMs', '<', Number(cutoffMs) || 0),
      firestoreMod.orderBy('createdAtMs', 'asc'),
      firestoreMod.limit(safeLimit)
    );
    const snap = await firestoreMod.getDocs(q);
    trackReads(Math.max(1, snap.docs.length));
    return snap.docs;
  } catch (error) {
    const q = firestoreMod.query(collectionRef, firestoreMod.orderBy('createdAtMs', 'asc'), firestoreMod.limit(safeLimit));
    const snap = await firestoreMod.getDocs(q).catch(() => ({ docs: [] }));
    trackReads(Math.max(1, snap.docs.length));
    snap.docs.forEach(docSnap => {
      const data = docSnap.data?.() || {};
      const created = Number(data.createdAtMs || timestampToMs(data.createdAt) || 0);
      if (created && created < cutoffMs && (!fallbackFilter || fallbackFilter(data))) docs.push(docSnap);
    });
    return docs;
  }
}

async function scanOrCleanupOldFirebaseNotifications(firebase, { cutoffMs, maxDeletes = 500, dryRun = false } = {}) {
  const { db, firestoreMod } = firebase;
  const safeLimit = Math.max(1, Math.min(500, Number(maxDeletes) || 500));
  const usersSnap = await firestoreMod.getDocs(firestoreMod.collection(db, 'users'));
  trackReads(Math.max(1, usersSnap.docs.length));
  let found = 0;
  let scanned = usersSnap.docs.length;
  const deleteDocs = [];

  for (const userDoc of usersSnap.docs) {
    if (found >= safeLimit) break;
    const remaining = safeLimit - found;
    const ref = firestoreMod.collection(db, 'users', userDoc.id, 'notifications');
    let docs = [];
    try {
      const q = firestoreMod.query(
        ref,
        firestoreMod.where('unread', '==', false),
        firestoreMod.where('createdAtMs', '<', cutoffMs),
        firestoreMod.limit(remaining)
      );
      const snap = await firestoreMod.getDocs(q);
      trackReads(Math.max(0, snap.docs.length));
      docs = snap.docs;
      scanned += snap.docs.length;
    } catch (error) {
      docs = await getOldestDocsFromCollection(firebase, ref, {
        cutoffMs,
        limitCount: Math.min(remaining, 40),
        fallbackFilter: data => isOldReadFirebaseNotification(data, cutoffMs)
      });
      scanned += docs.length;
      docs = docs.filter(docSnap => isOldReadFirebaseNotification(docSnap.data?.() || {}, cutoffMs));
    }
    if (!docs.length) continue;
    docs.slice(0, remaining).forEach(docSnap => {
      found += 1;
      if (!dryRun) deleteDocs.push(docSnap);
    });
  }
  const deleted = dryRun ? 0 : await commitDeleteDocs(firebase, deleteDocs);
  return { found, deleted, scanned };
}

async function listRegionsForArchiveCleanup(firebase) {
  const { db, firestoreMod } = firebase;
  const snap = await firestoreMod.getDocs(firestoreMod.collection(db, 'regions'));
  trackReads(Math.max(1, snap.docs.length));
  return snap.docs.map(doc => doc.id).filter(Boolean);
}

async function scanOrCleanupOldRegionArchive(firebase, subcollection, { cutoffMs, maxDeletes = 500, dryRun = false } = {}) {
  const { db, firestoreMod } = firebase;
  const safeLimit = Math.max(1, Math.min(500, Number(maxDeletes) || 500));
  const regions = await listRegionsForArchiveCleanup(firebase);
  let found = 0;
  let scanned = regions.length;
  const deleteDocs = [];
  for (const region of regions) {
    if (found >= safeLimit) break;
    const ref = firestoreMod.collection(db, 'regions', region, subcollection);
    const docs = await getOldestDocsFromCollection(firebase, ref, { cutoffMs, limitCount: safeLimit - found });
    scanned += docs.length;
    docs.slice(0, safeLimit - found).forEach(docSnap => {
      found += 1;
      if (!dryRun) deleteDocs.push(docSnap);
    });
  }
  const deleted = dryRun ? 0 : await commitDeleteDocs(firebase, deleteDocs);
  return { found, deleted, scanned };
}

function sumArchiveResults(results = []) {
  return results.reduce((acc, item) => ({
    found: acc.found + Number(item?.found || 0),
    deleted: acc.deleted + Number(item?.deleted || 0),
    scanned: acc.scanned + Number(item?.scanned || 0)
  }), { found: 0, deleted: 0, scanned: 0 });
}

async function runFirebaseArchiveCleanup(actor, { scope = 'all', retentionDays = 30, maxDeletes = 500, dryRun = false } = {}) {
  const { firebase } = await requireFirebaseArchiveCleanupAccess(actor);
  const cutoffMs = oldArchiveCutoffMs(retentionDays);
  const safeScope = ['notifications', 'actionLogs', 'campaigns', 'all'].includes(scope) ? scope : 'all';
  const safeLimit = Math.max(1, Math.min(500, Number(maxDeletes) || 500));
  const results = [];
  if (safeScope === 'notifications' || safeScope === 'all') {
    results.push(await scanOrCleanupOldFirebaseNotifications(firebase, { cutoffMs, maxDeletes: safeLimit, dryRun }));
  }
  if (safeScope === 'actionLogs' || safeScope === 'all') {
    results.push(await scanOrCleanupOldRegionArchive(firebase, 'actionLogs', { cutoffMs, maxDeletes: safeLimit, dryRun }));
  }
  if (safeScope === 'campaigns' || safeScope === 'all') {
    results.push(await scanOrCleanupOldRegionArchive(firebase, 'notificationCampaigns', { cutoffMs, maxDeletes: safeLimit, dryRun }));
  }
  return { scope: safeScope, retentionDays: Math.max(1, Number(retentionDays) || 30), dryRun: Boolean(dryRun), ...sumArchiveResults(results) };
}

export async function scanOldFirebaseArchives(actor, options = {}) {
  return runFirebaseArchiveCleanup(actor, { ...options, scope: options.scope || 'all', maxDeletes: options.maxScan || options.maxDeletes || 500, dryRun: true });
}

export async function cleanupOldFirebaseArchives(actor, options = {}) {
  return runFirebaseArchiveCleanup(actor, { ...options, dryRun: false });
}

export async function listPublicPlayers(options = {}) {
  const force = Boolean(options?.force);
  const cacheKey = 'publicPlayers.v89';
  if (!force) {
    const cached = readCache(cacheKey, 10 * 60 * 1000);
    if (Array.isArray(cached)) return cached;
  }
  const firebase = await getFirebase();
  if (!firebase) return [];
  const { db, firestoreMod } = firebase;
  const snapshot = await firestoreMod.getDocs(firestoreMod.collection(db, 'publicPlayers'));
  trackReads(Math.max(1, snapshot.docs.length));
  const result = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(player => player.profileComplete !== false)
    .sort((a, b) => String(a.region || '').localeCompare(String(b.region || ''), 'uk', { numeric: true }) || String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk'));
  writeCache(cacheKey, result);
  return result;
}


export async function syncPublicPlayersFromUsers() {
  const firebase = await getFirebase();
  if (!firebase) return 0;
  const { db, firestoreMod } = firebase;
  const allUsers = await listRegisteredUsers();
  let batch = firestoreMod.writeBatch(db);
  let count = 0;

  for (const user of allUsers) {
    const publicPlayer = makePublicPlayer(user);
    batch.set(firestoreMod.doc(db, 'publicPlayers', user.uid), publicPlayer, { merge: true });
    if (publicPlayer.region) batch.set(firestoreMod.doc(db, 'regions', publicPlayer.region, 'players', user.uid), publicPlayer, { merge: true });
    count += 1;
    if (count % 400 === 0) {
      await batch.commit();
      batch = firestoreMod.writeBatch(db);
    }
  }

  if (count % 400 !== 0) await batch.commit();
  for (const user of allUsers.slice(0, 1000)) {
    await markStatsChanged(db, firestoreMod, user.uid, 'sync_changed', 'sync-public-players').catch(() => null);
  }
  return count;
}

function profileLockSegment(value = '') {
  const clean = normalizeText(value).toLowerCase();
  if (!clean) return '';
  try { return encodeURIComponent(clean).replace(/%/g, '~').slice(0, 180); }
  catch { return clean.replace(/[^a-z0-9_-]+/g, '-').slice(0, 180); }
}
function profileOwnerKey(uid = '', farmId = 'main') {
  return `${profileCacheUid(uid)}:${profileLockSegment(farmId || 'main') || 'main'}`;
}
function profileNicknameLockId(target = {}) {
  const nick = profileLockSegment(target.nickname || target.gameNick);
  return nick ? `nick_${nick}` : '';
}
function profileRankLockId(uid = '', farmId = 'main', target = {}) {
  const region = gameRegion(target);
  const alliance = profileLockSegment(normalizeAllianceTag(target.alliance));
  const rank = `p${rankNum(target.rank || 'p1')}`;
  const owner = profileLockSegment(profileOwnerKey(uid, farmId));
  return region && alliance && owner ? `rank_${alliance}_${rank}_${owner}` : '';
}
function profileGameRecords(profile = {}) {
  const main = getGameProfile(profile || {});
  return [
    { ...main, farmId: 'main' },
    ...getUserFarms(profile || {}).map(farm => ({ ...farm, farmId: normalizeText(farm.farmId || farm.id || 'main') || 'main' }))
  ].filter(game => normalizeText(game.nickname) && gameRegion(game));
}
function profileNicknameLockPayload(uid = '', farmId = 'main', target = {}, firebase = null) {
  const region = gameRegion(target);
  const nickname = normalizeText(target.nickname || target.gameNick);
  return {
    uid: profileCacheUid(uid),
    farmId: normalizeText(farmId || 'main') || 'main',
    ownerKey: profileOwnerKey(uid, farmId),
    nickname,
    nicknameKey: nickname.toLowerCase(),
    region,
    alliance: normalizeAllianceTag(target.alliance),
    rank: `p${rankNum(target.rank || 'p1')}`,
    updatedAtMs: Date.now(),
    updatedAt: firebase?.firestoreMod?.serverTimestamp ? firebase.firestoreMod.serverTimestamp() : Date.now(),
    source: 'profile-index'
  };
}
function profileRankLockPayload(uid = '', farmId = 'main', target = {}, firebase = null) {
  return {
    uid: profileCacheUid(uid),
    farmId: normalizeText(farmId || 'main') || 'main',
    ownerKey: profileOwnerKey(uid, farmId),
    region: gameRegion(target),
    alliance: normalizeAllianceTag(target.alliance),
    rank: `p${rankNum(target.rank || 'p1')}`,
    nickname: normalizeText(target.nickname || target.gameNick),
    updatedAtMs: Date.now(),
    updatedAt: firebase?.firestoreMod?.serverTimestamp ? firebase.firestoreMod.serverTimestamp() : Date.now(),
    source: 'profile-index'
  };
}
async function assertNicknameRegionUnique(db, firestoreMod, uid = '', farmId = 'main', target = {}) {
  const region = gameRegion(target);
  const lockId = profileNicknameLockId(target);
  if (!region || !lockId) return;
  const ref = firestoreMod.doc(db, 'regions', region, 'profileNicknameLocks', lockId);
  const snap = await firestoreMod.getDoc(ref);
  trackReads(1);
  if (!snap.exists()) return;
  const data = snap.data() || {};
  if (data.ownerKey && data.ownerKey !== profileOwnerKey(uid, farmId)) throw new Error('nickname-duplicate-region');
}

async function assertAllianceRankLimit(db, firestoreMod, uid = '', farmId = 'main', target = {}) {
  const rank = rankNum(target.rank || 'p1');
  if (![4, 5].includes(rank)) return;
  const region = gameRegion(target);
  const alliance = normalizeAllianceTag(target.alliance);
  if (!region || !alliance) return;
  const queryRef = firestoreMod.query(
    firestoreMod.collection(db, 'regions', region, 'profileRankLocks'),
    firestoreMod.where('alliance', '==', alliance),
    firestoreMod.where('rank', '==', `p${rank}`),
    firestoreMod.limit(rank === 5 ? 2 : 21)
  );
  const snap = await firestoreMod.getDocs(queryRef);
  trackReads(Math.max(1, snap.docs.length));
  const ownerKey = profileOwnerKey(uid, farmId);
  const count = snap.docs.filter(doc => (doc.data()?.ownerKey || '') !== ownerKey).length;
  if (rank === 5 && count >= 1) throw new Error('rank-p5-limit');
  if (rank === 4 && count >= 20) throw new Error('rank-p4-limit');
}

async function syncProfileIndexLocks(db, firestoreMod, uid = '', beforeProfile = {}, afterProfile = {}) {
  const userId = profileCacheUid(uid || afterProfile?.uid || beforeProfile?.uid || '');
  if (!userId) return;
  const firebase = { firestoreMod };
  const beforeGames = profileGameRecords(beforeProfile || {});
  const afterGames = profileGameRecords(afterProfile || {});
  const beforeNick = new Map();
  const afterNick = new Map();
  const beforeRank = new Map();
  const afterRank = new Map();
  const collect = (games, nickMap, rankMap) => games.forEach(game => {
    const farmId = normalizeText(game.farmId || game.id || 'main') || 'main';
    const region = gameRegion(game);
    const nickId = profileNicknameLockId(game);
    if (region && nickId) nickMap.set(`${region}/${nickId}`, { region, id: nickId, farmId, game });
    const r = rankNum(game.rank || 'p1');
    const rankId = [4, 5].includes(r) ? profileRankLockId(userId, farmId, game) : '';
    if (region && rankId) rankMap.set(`${region}/${rankId}`, { region, id: rankId, farmId, game });
  });
  collect(beforeGames, beforeNick, beforeRank);
  collect(afterGames, afterNick, afterRank);
  const batch = firestoreMod.writeBatch(db);
  let writes = 0;
  const del = (path, map, nextMap, collectionName) => {
    map.forEach((item, key) => {
      if (!nextMap.has(key)) {
        batch.delete(firestoreMod.doc(db, 'regions', item.region, collectionName, item.id));
        writes += 1;
      }
    });
  };
  del('nick', beforeNick, afterNick, 'profileNicknameLocks');
  del('rank', beforeRank, afterRank, 'profileRankLocks');
  afterNick.forEach(item => {
    batch.set(firestoreMod.doc(db, 'regions', item.region, 'profileNicknameLocks', item.id), profileNicknameLockPayload(userId, item.farmId, item.game, firebase), { merge: true });
    writes += 1;
  });
  afterRank.forEach(item => {
    batch.set(firestoreMod.doc(db, 'regions', item.region, 'profileRankLocks', item.id), profileRankLockPayload(userId, item.farmId, item.game, firebase), { merge: true });
    writes += 1;
  });
  if (writes) {
    await batch.commit();
    trackWrites(writes);
  }
}

async function commitProfileIndexBatch(firestoreMod, batchRef, state, force = false) {
  if (!state.count) return batchRef;
  if (!force && state.count < 400) return batchRef;
  await batchRef.commit();
  state.count = 0;
  return firestoreMod.writeBatch(state.db);
}

async function deleteProfileIndexCollectionForRegions(db, firestoreMod, collectionId = '', regions = []) {
  const regionList = [...new Set((regions || []).map(region => normalizeText(region)).filter(Boolean))];
  if (!collectionId || !regionList.length) return 0;
  let deleted = 0;
  for (const region of regionList) {
    const snapshot = await firestoreMod.getDocs(firestoreMod.collection(db, 'regions', region, collectionId));
    trackReads(Math.max(1, snapshot.docs.length));
    let batch = firestoreMod.writeBatch(db);
    const state = { count: 0, db };
    for (const docSnap of snapshot.docs) {
      batch.delete(docSnap.ref);
      state.count += 1;
      deleted += 1;
      batch = await commitProfileIndexBatch(firestoreMod, batch, state);
    }
    await commitProfileIndexBatch(firestoreMod, batch, state, true);
  }
  if (deleted) trackDeletes(deleted);
  return deleted;
}

export async function rebuildProfileIndexLocks(options = {}) {
  const firebase = await getFirebase();
  if (!firebase) throw new Error('firebase-not-configured');
  const { auth, db, firestoreMod } = firebase;
  const actor = auth?.currentUser || null;
  const actorProfile = actor ? await getUserProfile(actor.uid) : null;
  if (!canUseAdminPanel(actor, actorProfile)) throw new Error('admin-only');

  const allUsers = (await listRegisteredUsers())
    .slice()
    .sort((a, b) => timestampToMs(a.createdAt) - timestampToMs(b.createdAt));

  const firebaseCtx = { firestoreMod };
  const nicknameLocks = new Map();
  const rankLocks = new Map();
  const rebuildRegions = new Set();
  let gameRecords = 0;
  let duplicateNicknames = 0;
  let p4Locks = 0;
  let p5Locks = 0;

  for (const profile of allUsers) {
    const uid = profileCacheUid(profile.uid || profile.id || '');
    if (!uid) continue;
    for (const game of profileGameRecords(profile || {})) {
      const farmId = normalizeText(game.farmId || game.id || 'main') || 'main';
      const region = gameRegion(game);
      if (!region) continue;
      rebuildRegions.add(region);
      gameRecords += 1;
      const nickId = profileNicknameLockId(game);
      if (nickId) {
        const key = `${region}/${nickId}`;
        const payload = profileNicknameLockPayload(uid, farmId, game, firebaseCtx);
        if (nicknameLocks.has(key) && nicknameLocks.get(key)?.ownerKey !== payload.ownerKey) {
          duplicateNicknames += 1;
        } else {
          nicknameLocks.set(key, { region, id: nickId, payload });
        }
      }
      const rank = rankNum(game.rank || 'p1');
      if ([4, 5].includes(rank)) {
        const rankId = profileRankLockId(uid, farmId, game);
        if (rankId) {
          rankLocks.set(`${region}/${rankId}`, { region, id: rankId, payload: profileRankLockPayload(uid, farmId, game, firebaseCtx) });
          if (rank === 4) p4Locks += 1;
          if (rank === 5) p5Locks += 1;
        }
      }
    }
  }

  const deletedNicknameLocks = await deleteProfileIndexCollectionForRegions(db, firestoreMod, 'profileNicknameLocks', [...rebuildRegions]);
  const deletedRankLocks = await deleteProfileIndexCollectionForRegions(db, firestoreMod, 'profileRankLocks', [...rebuildRegions]);

  let batch = firestoreMod.writeBatch(db);
  const state = { count: 0, db };
  let written = 0;
  for (const item of nicknameLocks.values()) {
    batch.set(firestoreMod.doc(db, 'regions', item.region, 'profileNicknameLocks', item.id), item.payload, { merge: true });
    state.count += 1;
    written += 1;
    batch = await commitProfileIndexBatch(firestoreMod, batch, state);
  }
  for (const item of rankLocks.values()) {
    batch.set(firestoreMod.doc(db, 'regions', item.region, 'profileRankLocks', item.id), item.payload, { merge: true });
    state.count += 1;
    written += 1;
    batch = await commitProfileIndexBatch(firestoreMod, batch, state);
  }
  await commitProfileIndexBatch(firestoreMod, batch, state, true);
  if (written) trackWrites(written);

  return {
    users: allUsers.length,
    gameRecords,
    nicknameLocks: nicknameLocks.size,
    rankLocks: rankLocks.size,
    p4Locks,
    p5Locks,
    duplicateNicknames,
    written,
    deleted: deletedNicknameLocks + deletedRankLocks,
    deletedNicknameLocks,
    deletedRankLocks
  };
}


export async function updateUserByAdmin(uid, values) {
  if (!uid) throw new Error('missing-user-id');
  const firebase = await getFirebase();
  if (!firebase) throw new Error('firebase-not-configured');

  const { db, firestoreMod } = firebase;
  const oldProfile = await getUserProfile(uid);
  if (!oldProfile) throw new Error('user-not-found');

  const now = firestoreMod.serverTimestamp();
  const oldGame = getGameProfile(oldProfile);
  const clean = {
    nickname: normalizeText(values.nickname),
    region: normalizeText(values.region),
    alliance: normalizeAllianceTag(values.alliance),
    rank: normalizeText(values.rank || 'p1').toLowerCase(),
    shk: normalizeText(values.shk),
    state: 'complete'
  };
  const role = normalizeRole(values.role || oldProfile.role || 'player');
  const actor = firebase.auth?.currentUser || null;
  const actorProfile = actor ? await getUserProfile(actor.uid) : null;
  const requestedTarget = { ...clean, role };
  if (!canAssignRole(actor, actorProfile, role) || !canRegionalEditTarget(actor, actorProfile, requestedTarget, { ...oldGame, role: oldProfile.role || 'player' })) {
    throw new Error('role-not-allowed');
  }
  await assertNicknameRegionUnique(db, firestoreMod, uid, 'main', clean);
  await assertAllianceRankLimit(db, firestoreMod, uid, 'main', clean);
  const fullUser = {
    uid,
    gameNick: clean.nickname,
    nickname: clean.nickname,
    region: clean.region,
    alliance: normalizeAllianceTag(clean.alliance),
    rank: clean.rank,
    shk: clean.shk,
    country: normalizeCountry(values.country || oldProfile.country || ''),
    countryCode: normalizeCountryCode(values.countryCode || oldProfile.countryCode || ''),
    role,
    roleLabel: roleLabel(role),
    gameProfile: clean,
    profileComplete: true,
    regionAccess: buildRegionAccess(clean, getUserFarms(oldProfile)),
    allianceAccess: buildAllianceAccess(clean, getUserFarms(oldProfile)),
    regionRoles: buildRegionRoles(clean, getUserFarms(oldProfile)),
    updatedAt: now
  };
  const publicPlayer = makePublicPlayer({ ...oldProfile, ...fullUser, updatedAt: now });
  publicPlayer.updatedAt = now;
  publicPlayer.createdAt = oldProfile.createdAt || now;
  publicPlayer.lastLoginAt = oldProfile.lastLoginAt || null;

  const batch = firestoreMod.writeBatch(db);
  batch.set(firestoreMod.doc(db, 'users', uid), fullUser, { merge: true });
  await writeAdminUserIndexDoc(db, firestoreMod, { ...oldProfile, ...fullUser, uid, createdAt: oldProfile.createdAt || now, updatedAt: now }, batch);
  batch.set(firestoreMod.doc(db, 'publicPlayers', uid), publicPlayer, { merge: true });
  batch.set(firestoreMod.doc(db, 'regions', clean.region, 'players', uid), publicPlayer, { merge: true });
  if (oldGame.region && oldGame.region !== clean.region) {
    batch.delete(firestoreMod.doc(db, 'regions', oldGame.region, 'players', uid));
  }
  await batch.commit();
  removeUserProfileCache(uid);
  await markStatsChanged(db, firestoreMod, uid, 'admin_changed', 'admin-main').catch(() => null);
  await mirrorPublicStatsFromPublicPlayer(publicPlayer, 'admin-main');
  const changed = [];
  if (oldGame.rank !== clean.rank) changed.push(`${serviceT('account.rank','Ранг')}: ${clean.rank.toUpperCase()}`);
  if (oldProfile?.role !== role) changed.push(`${serviceT('account.role','Роль')}: ${roleLabel(role)}`);
  if (changed.length) await createUserNotification(uid, { type:'profile_changed', title: serviceT('notifications.profileChanged','Профіль оновлено'), message: changed.join(' · '), region: clean.region, alliance: clean.alliance }).catch(() => null);
  const savedProfile = await getUserProfile(uid, { forceRefresh: true });
  await syncProfileIndexLocks(db, firestoreMod, uid, oldProfile || {}, savedProfile || {}).catch(error => console.warn('Profile index sync failed after admin main update', error));
  return savedProfile;
}

export async function updateFarmByAdmin(uid, farmId, values) {
  if (!uid || !farmId || farmId === 'main') throw new Error('missing-farm-id');
  const firebase = await getFirebase();
  if (!firebase) throw new Error('firebase-not-configured');
  const { db, firestoreMod } = firebase;
  const oldProfile = await getUserProfile(uid);
  if (!oldProfile) throw new Error('user-not-found');
  const farms = getUserFarms(oldProfile);
  const index = farms.findIndex(farm => farm.farmId === farmId || farm.id === farmId);
  if (index < 0) throw new Error('farm-not-found');

  const actor = firebase.auth?.currentUser || null;
  const actorProfile = actor ? await getUserProfile(actor.uid) : null;
  const role = normalizeRole(values.role || farms[index].role || 'player');
  const targetPreview = { ...farms[index], ...values, role, region: normalizeText(values.region || farms[index].region).replace(/[^0-9]/g, ''), alliance: normalizeAllianceTag(values.alliance || farms[index].alliance), rank: normalizeText(values.rank || farms[index].rank || 'p1').toLowerCase() };
  if (!canAssignRole(actor, actorProfile, role) || !canRegionalEditTarget(actor, actorProfile, targetPreview, farms[index])) throw new Error('role-not-allowed');
  await assertNicknameRegionUnique(db, firestoreMod, uid, farmId, targetPreview);
  await assertAllianceRankLimit(db, firestoreMod, uid, farmId, targetPreview);

  const now = firestoreMod.serverTimestamp();
  const nextFarm = normalizeFarm({
    ...farms[index],
    nickname: normalizeText(values.nickname || farms[index].nickname),
    region: normalizeText(values.region || farms[index].region).replace(/[^0-9]/g, ''),
    alliance: normalizeAllianceTag(values.alliance || farms[index].alliance),
    rank: normalizeText(values.rank || farms[index].rank || 'p1').toLowerCase(),
    shk: normalizeText(values.shk || farms[index].shk),
    role,
    roleLabel: roleLabel(role),
    updatedAt: Date.now()
  }, farmId);
  const nextFarms = farms.map((farm, i) => i === index ? nextFarm : farm);
  const mainGame = getGameProfile(oldProfile);
  const userPatch = {
    farms: nextFarms,
    farmCount: getFarmCount({ ...oldProfile, farms: nextFarms }),
    regionAccess: buildRegionAccess(mainGame, nextFarms),
    allianceAccess: buildAllianceAccess(mainGame, nextFarms),
    regionRoles: buildRegionRoles(mainGame, nextFarms),
    updatedAt: now
  };
  const publicPlayer = makePublicPlayer({ ...oldProfile, uid, ...userPatch, updatedAt: now });
  publicPlayer.updatedAt = now;
  publicPlayer.createdAt = oldProfile.createdAt || now;
  const batch = firestoreMod.writeBatch(db);
  batch.set(firestoreMod.doc(db, 'users', uid), userPatch, { merge: true });
  if (oldProfile.profileComplete) await writeAdminUserIndexDoc(db, firestoreMod, { ...oldProfile, ...userPatch, uid, updatedAt: now }, batch);
  if (oldProfile.profileComplete) batch.set(firestoreMod.doc(db, 'publicPlayers', uid), publicPlayer, { merge: true });
  await batch.commit();
  removeUserProfileCache(uid);
  await markStatsChanged(db, firestoreMod, uid, 'admin_changed', 'admin-farm').catch(() => null);
  await mirrorPublicStatsFromPublicPlayer(publicPlayer, 'admin-farm');
  const oldFarm = farms[index] || {};
  const changed = [];
  if (oldFarm.rank !== nextFarm.rank) changed.push(`${serviceT('account.rank','Ранг')}: ${nextFarm.rank.toUpperCase()}`);
  if (oldFarm.role !== nextFarm.role) changed.push(`${serviceT('account.role','Роль')}: ${roleLabel(nextFarm.role)}`);
  if (changed.length) await createUserNotification(uid, { type:'farm_profile_changed', title: serviceT('notifications.profileChanged','Профіль оновлено'), message: `${nextFarm.nickname || serviceT('account.farm','Ферма')}: ${changed.join(' · ')}`, region: nextFarm.region, alliance: nextFarm.alliance }).catch(() => null);
  const savedProfile = await getUserProfile(uid, { forceRefresh: true });
  await syncProfileIndexLocks(db, firestoreMod, uid, oldProfile || {}, savedProfile || {}).catch(error => console.warn('Profile index sync failed after admin farm update', error));
  return savedProfile;
}

export async function approveRoleRequest(requestId) {
  const firebase = await getFirebase();
  if (!firebase) throw new Error('firebase-not-configured');
  const { auth, db, firestoreMod } = firebase;
  const requestRef = firestoreMod.doc(db, 'roleRequests', requestId);
  const requestSnap = await firestoreMod.getDoc(requestRef);
  if (!requestSnap.exists()) throw new Error('request-not-found');

  const request = { id: requestSnap.id, ...requestSnap.data() };
  const uid = normalizeText(request.uid || requestSnap.id.split('_')[0]);
  if (!uid) throw new Error('request-user-missing');
  const role = normalizeRole(request.requestedRole);
  if (!isRequestableRole(role)) throw new Error('bad-role');

  const userRef = firestoreMod.doc(db, 'users', uid);
  const userSnap = await firestoreMod.getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : {};
  const region = normalizeText(userData.gameProfile?.region || userData.region || request.region);
  const now = firestoreMod.serverTimestamp();
  const approvedBy = auth.currentUser?.email || '';
  const roleRequest = {
    requestedRole: role,
    requestedRoleLabel: roleLabel(role),
    status: 'approved',
    statusLabel: roleRequestStatusLabel('approved'),
    approvedBy,
    approvedAt: now,
    updatedAt: now
  };

  const requestFarmId = normalizeText(request.farmId || 'main') || 'main';
  if (requestFarmId !== 'main') {
    const mainGame = getGameProfile(userData);
    const farms = getUserFarms(userData);
    const farmIndex = farms.findIndex(farm => farm.farmId === requestFarmId || farm.id === requestFarmId);
    if (farmIndex < 0) throw new Error('farm-not-found');
    const nextFarms = farms.map((farm, index) => index === farmIndex
      ? normalizeFarm({ ...farm, role, roleLabel: roleLabel(role), updatedAt: Date.now() }, farm.farmId || farm.id || requestFarmId)
      : farm);
    const updatedPublic = makePublicPlayer({ ...userData, uid, farms: nextFarms, roleRequest, updatedAt: now });
    updatedPublic.updatedAt = now;
    updatedPublic.createdAt = userData.createdAt || request.requestedAt || now;

    const batch = firestoreMod.writeBatch(db);
    batch.set(userRef, {
      farms: nextFarms,
      farmCount: getFarmCount({ ...userData, farms: nextFarms }),
      regionAccess: buildRegionAccess(mainGame, nextFarms),
      allianceAccess: buildAllianceAccess(mainGame, nextFarms),
      regionRoles: buildRegionRoles(mainGame, nextFarms),
      activeFarmId: requestFarmId,
      roleRequest,
      updatedAt: now
    }, { merge: true });
    batch.set(requestRef, { status: 'approved', approvedBy, approvedAt: now, updatedAt: now }, { merge: true });
    if (userData.profileComplete) await writeAdminUserIndexDoc(db, firestoreMod, { ...userData, farms: nextFarms, roleRequest, uid, updatedAt: now }, batch);
    if (userData.profileComplete) batch.set(firestoreMod.doc(db, 'publicPlayers', uid), updatedPublic, { merge: true });
    await batch.commit();
    await markStatsChanged(db, firestoreMod, uid, 'role_changed', 'role-approve').catch(() => null);
    await mirrorPublicStatsFromPublicPlayer(updatedPublic, 'role-approve-farm');
    await createUserNotification(uid, { type:'role_approved', title: serviceT('notifications.roleApproved','Роль підтверджено'), message: `${request.farmName || serviceT('account.farm','Ферма')}: ${roleLabel(role)}`, region: request.region, alliance: request.alliance }).catch(() => null);
    return;
  }

  const batch = firestoreMod.writeBatch(db);
  const updatedPublic = makePublicPlayer({ ...userData, uid, role, roleRequest, updatedAt: now });
  updatedPublic.updatedAt = now;
  updatedPublic.createdAt = userData.createdAt || request.requestedAt || now;
  batch.set(userRef, { role, roleLabel: roleLabel(role), roleRequest, regionAccess: buildRegionAccess(getGameProfile(userData), getUserFarms(userData)), allianceAccess: buildAllianceAccess(getGameProfile(userData), getUserFarms(userData)), regionRoles: buildRegionRoles(getGameProfile(userData), getUserFarms(userData)), updatedAt: now }, { merge: true });
  batch.set(requestRef, { status: 'approved', approvedBy, approvedAt: now, updatedAt: now }, { merge: true });
  await writeAdminUserIndexDoc(db, firestoreMod, { ...userData, uid, role, roleRequest, updatedAt: now }, batch);
  batch.set(firestoreMod.doc(db, 'publicPlayers', uid), updatedPublic, { merge: true });
  if (region) batch.set(firestoreMod.doc(db, 'regions', region, 'players', uid), updatedPublic, { merge: true });
  await batch.commit();
  removeUserProfileCache(uid);
  await markStatsChanged(db, firestoreMod, uid, 'role_changed', 'role-approve').catch(() => null);
  await mirrorPublicStatsFromPublicPlayer(updatedPublic, 'role-approve');
  await createUserNotification(uid, { type:'role_approved', title: serviceT('notifications.roleApproved','Роль підтверджено'), message: roleLabel(role), region, alliance: request.alliance }).catch(() => null);
}

export async function declineRoleRequest(requestId) {
  const firebase = await getFirebase();
  if (!firebase) throw new Error('firebase-not-configured');
  const { auth, db, firestoreMod } = firebase;
  const requestRef = firestoreMod.doc(db, 'roleRequests', requestId);
  const requestSnap = await firestoreMod.getDoc(requestRef);
  if (!requestSnap.exists()) throw new Error('request-not-found');

  const request = { id: requestSnap.id, ...requestSnap.data() };
  const uid = normalizeText(request.uid || requestSnap.id.split('_')[0]);
  if (!uid) throw new Error('request-user-missing');
  const userRef = firestoreMod.doc(db, 'users', uid);
  const now = firestoreMod.serverTimestamp();
  const declinedBy = auth.currentUser?.email || '';
  const roleRequest = {
    requestedRole: normalizeRole(request.requestedRole),
    requestedRoleLabel: roleLabel(request.requestedRole),
    status: 'declined',
    statusLabel: roleRequestStatusLabel('declined'),
    declinedBy,
    declinedAt: now,
    updatedAt: now
  };

  const userSnap = await firestoreMod.getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : {};
  const publicPlayer = makePublicPlayer({ ...userData, uid, roleRequest, updatedAt: now });
  publicPlayer.updatedAt = now;
  publicPlayer.createdAt = userData.createdAt || request.requestedAt || now;

  const batch = firestoreMod.writeBatch(db);
  batch.set(userRef, { roleRequest, updatedAt: now }, { merge: true });
  batch.set(requestRef, { status: 'declined', declinedBy, declinedAt: now, updatedAt: now }, { merge: true });
  if (userData.profileComplete) batch.set(firestoreMod.doc(db, 'publicPlayers', uid), publicPlayer, { merge: true });
  await batch.commit();
  removeUserProfileCache(uid);
  await markStatsChanged(db, firestoreMod, uid, 'role_changed', 'role-decline').catch(() => null);
  await mirrorPublicStatsFromPublicPlayer(publicPlayer, 'role-decline');
}
