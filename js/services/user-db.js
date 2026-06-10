import { getFirebase } from './firebase-service.js';
import { readCache, writeCache, removeCache } from './local-cache.js?v=89';
import { trackReads, trackWrites, trackDeletes } from './usage-tracker.js?v=89';
import { mirrorPublicStatsPlayer } from './public-stats-cache.js?v=104';
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
  setNotificationSummaryD1
} from './notifications-d1.js?v=114';

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
  if (Object.hasOwn(values, 'lastTargetType')) out.lastTargetType = normalizeText(values.lastTargetType || 'system').slice(0, 40);
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
      if (rows.length) return rows;
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
      if (rows.length) return rows;
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
  const targetType = normalizeText(values.targetType || 'region').slice(0, 40);
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

export async function createRegionNotificationCampaign(values = {}) {
  const firebase = await getFirebase();
  if (!firebase) return null;
  const payload = campaignClean(values, firebase);
  if (!payload.region) return null;
  const id = `${payload.createdAtMs}-${payload.type.replace(/[^a-z0-9_-]/gi, '').slice(0, 50)}-${Math.random().toString(36).slice(2, 8)}`;
  const authUser = firebase.auth?.currentUser || null;
  if (authUser) {
    try {
      return await createNotificationCampaignD1(authUser, { id, ...payload });
    } catch (error) {
      console.warn('[WKD] D1 region campaign skipped, Firebase fallback used', error);
    }
  }
  await firebase.firestoreMod.setDoc(firebase.firestoreMod.doc(firebase.db, 'regions', payload.region, 'notificationCampaigns', id), payload);
  trackWrites(1);
  return { id, ...payload };
}

export async function createSiteMessageCampaign(values = {}) {
  const firebase = await getFirebase();
  if (!firebase) return null;
  const payload = campaignClean({ ...values, type: values.type || 'site_message_campaign' }, firebase);
  if (!payload.region) return null;
  if (!['all', 'region', 'alliance', 'consuls', 'officers'].includes(payload.targetType)) return null;
  if (payload.targetType === 'alliance' && !payload.alliance) return null;
  if (!payload.title || !payload.message) return null;
  const id = `${payload.createdAtMs}-${payload.type.replace(/[^a-z0-9_-]/gi, '').slice(0, 50)}-${Math.random().toString(36).slice(2, 8)}`;
  const authUser = firebase.auth?.currentUser || null;
  if (authUser) {
    try {
      return await createNotificationCampaignD1(authUser, { id, ...payload });
    } catch (error) {
      console.warn('[WKD] D1 message campaign skipped, Firebase fallback used', error);
    }
  }
  await firebase.firestoreMod.setDoc(firebase.firestoreMod.doc(firebase.db, 'regions', payload.region, 'notificationCampaigns', id), payload);
  trackWrites(1);
  return { id, ...payload };
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
      return filtered.slice(0, totalLimit);
    } catch (error) {
      console.warn('[WKD] D1 campaigns unavailable, Firebase fallback used', error);
    }
  }
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
  const deduped = [];
  const seen = new Set();
  all.sort((a, b) => (Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0)).forEach(item => {
    const key = item.campaignGroupId || `${item.region}:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });
  return deduped.slice(0, totalLimit);
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

export async function getUserProfile(uid) {
  if (!uid) return null;
  const firebase = await getFirebase();
  if (!firebase) return null;

  const { db, firestoreMod } = firebase;
  const ref = firestoreMod.doc(db, 'users', uid);
  const snapshot = await firestoreMod.getDoc(ref);
  trackReads(1);
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function saveSignedInUser(user) {
  if (!user) return null;
  const firebase = await getFirebase();
  if (!firebase) return null;

  const { db, firestoreMod } = firebase;
  const ref = firestoreMod.doc(db, 'users', user.uid);
  const snapshot = await firestoreMod.getDoc(ref);
  const now = firestoreMod.serverTimestamp();

  if (!snapshot.exists()) {
    await firestoreMod.setDoc(ref, {
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
    }, { merge: true });
  } else {
    const old = snapshot.data();
    const oldMain = getGameProfile(old || {});
    const oldFarms = getUserFarms(old || {});
    await firestoreMod.setDoc(ref, {
      displayName: user.displayName || old.displayName || '',
      photoURL: user.photoURL || old.photoURL || '',
      regionAccess: buildRegionAccess(oldMain, oldFarms),
      allianceAccess: buildAllianceAccess(oldMain, oldFarms),
      regionRoles: buildRegionRoles(oldMain, oldFarms),
      lastLoginAt: now,
      updatedAt: now
    }, { merge: true });
  }

  let profile = await getUserProfile(user.uid);

  if (isAdminUser(user, profile) && profile?.role !== 'admin') {
    try {
      await firestoreMod.setDoc(ref, {
        role: 'admin',
        roleLabel: roleLabel('admin'),
        updatedAt: now
      }, { merge: true });
      profile = await getUserProfile(user.uid);
    } catch (error) {
      console.warn('Admin role sync failed', error);
    }
  }

  if (isProfileComplete(profile)) {
    await writePublicPlayerFromProfile(db, firestoreMod, profile).catch(error => {
      console.warn('Public profile sync failed', error);
    });
  }

  return profile;
}

export async function ensureCurrentUserPublished(user) {
  if (!user) return null;
  const firebase = await getFirebase();
  if (!firebase) return null;
  const { db, firestoreMod } = firebase;
  const profile = await saveSignedInUser(user);
  if (isProfileComplete(profile)) {
    await writePublicPlayerFromProfile(db, firestoreMod, profile).catch(error => {
      console.warn('Public profile sync failed', error);
    });
  }
  return getUserProfile(user.uid);
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

  const savedProfile = await getUserProfile(uid);
  if (regionChangedByLeader && oldMain.region) {
    await firestoreMod.deleteDoc(firestoreMod.doc(db, 'regions', oldMain.region, 'players', uid)).catch(() => null);
  }
  if (isProfileComplete(savedProfile)) {
    await writePublicPlayerFromProfile(db, firestoreMod, savedProfile).catch(error => {
      console.warn('Public player sync failed after profile save', error);
    });
  }

  return getUserProfile(uid);
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

  const savedProfile = await getUserProfile(user.uid);
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
  const savedProfile = await getUserProfile(user.uid);
  if (isProfileComplete(savedProfile)) {
    await writePublicPlayerFromProfile(db, firestoreMod, savedProfile).catch(error => {
      console.warn('Public player sync failed after primary farm change', error);
    });
  }
  return getUserProfile(user.uid);
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
  const savedProfile = await getUserProfile(user.uid);
  await writePublicPlayerFromProfile(db, firestoreMod, savedProfile).catch(() => null);
  return savedProfile;
}

export async function listRoleRequests(status = 'pending') {
  const firebase = await getFirebase();
  if (!firebase) return [];
  const { db, firestoreMod } = firebase;
  const queryRef = firestoreMod.query(
    firestoreMod.collection(db, 'roleRequests'),
    firestoreMod.where('status', '==', status)
  );
  const snapshot = await firestoreMod.getDocs(queryRef);
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk'));
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

async function assertNicknameRegionUnique(db, firestoreMod, uid = '', farmId = 'main', target = {}) {
  const nickname = normalizeText(target.nickname || target.gameNick);
  const region = gameRegion(target);
  if (!nickname || !region) return;
  const snap = await firestoreMod.getDocs(firestoreMod.collection(db, 'users'));
  const duplicate = snap.docs.some(doc => {
    const data = { id: doc.id, ...doc.data() };
    const games = [{ ...getGameProfile(data), farmId: 'main' }, ...getUserFarms(data)];
    return games.some(game => {
      const gameFarmId = normalizeText(game.farmId || game.id || 'main') || 'main';
      if (doc.id === uid && gameFarmId === (farmId || 'main')) return false;
      return gameRegion(game) === region && normalizeText(game.nickname).toLowerCase() === nickname.toLowerCase();
    });
  });
  if (duplicate) throw new Error('nickname-duplicate-region');
}

async function assertAllianceRankLimit(db, firestoreMod, uid = '', farmId = 'main', target = {}) {
  const rank = rankNum(target.rank || 'p1');
  if (![4, 5].includes(rank)) return;
  const region = gameRegion(target);
  const alliance = normalizeAllianceTag(target.alliance);
  if (!region || !alliance) return;
  const snap = await firestoreMod.getDocs(firestoreMod.collection(db, 'users'));
  let count = 0;
  snap.docs.forEach(doc => {
    const data = { id: doc.id, ...doc.data() };
    const games = [{ ...getGameProfile(data), farmId: 'main' }, ...getUserFarms(data)];
    games.forEach(game => {
      const gameFarmId = normalizeText(game.farmId || game.id || 'main') || 'main';
      if (doc.id === uid && gameFarmId === (farmId || 'main')) return;
      if (gameRegion(game) === region && normalizeAllianceTag(game.alliance) === alliance && rankNum(game.rank) === rank) count += 1;
    });
  });
  if (rank === 5 && count >= 1) throw new Error('rank-p5-limit');
  if (rank === 4 && count >= 20) throw new Error('rank-p4-limit');
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
  batch.set(firestoreMod.doc(db, 'publicPlayers', uid), publicPlayer, { merge: true });
  batch.set(firestoreMod.doc(db, 'regions', clean.region, 'players', uid), publicPlayer, { merge: true });
  if (oldGame.region && oldGame.region !== clean.region) {
    batch.delete(firestoreMod.doc(db, 'regions', oldGame.region, 'players', uid));
  }
  await batch.commit();
  await markStatsChanged(db, firestoreMod, uid, 'admin_changed', 'admin-main').catch(() => null);
  await mirrorPublicStatsFromPublicPlayer(publicPlayer, 'admin-main');
  const changed = [];
  if (oldGame.rank !== clean.rank) changed.push(`${serviceT('account.rank','Ранг')}: ${clean.rank.toUpperCase()}`);
  if (oldProfile?.role !== role) changed.push(`${serviceT('account.role','Роль')}: ${roleLabel(role)}`);
  if (changed.length) await createUserNotification(uid, { type:'profile_changed', title: serviceT('notifications.profileChanged','Профіль оновлено'), message: changed.join(' · '), region: clean.region, alliance: clean.alliance }).catch(() => null);
  return getUserProfile(uid);
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
  if (oldProfile.profileComplete) batch.set(firestoreMod.doc(db, 'publicPlayers', uid), publicPlayer, { merge: true });
  await batch.commit();
  await markStatsChanged(db, firestoreMod, uid, 'admin_changed', 'admin-farm').catch(() => null);
  await mirrorPublicStatsFromPublicPlayer(publicPlayer, 'admin-farm');
  const oldFarm = farms[index] || {};
  const changed = [];
  if (oldFarm.rank !== nextFarm.rank) changed.push(`${serviceT('account.rank','Ранг')}: ${nextFarm.rank.toUpperCase()}`);
  if (oldFarm.role !== nextFarm.role) changed.push(`${serviceT('account.role','Роль')}: ${roleLabel(nextFarm.role)}`);
  if (changed.length) await createUserNotification(uid, { type:'farm_profile_changed', title: serviceT('notifications.profileChanged','Профіль оновлено'), message: `${nextFarm.nickname || serviceT('account.farm','Ферма')}: ${changed.join(' · ')}`, region: nextFarm.region, alliance: nextFarm.alliance }).catch(() => null);
  return getUserProfile(uid);
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
  batch.set(firestoreMod.doc(db, 'publicPlayers', uid), updatedPublic, { merge: true });
  if (region) batch.set(firestoreMod.doc(db, 'regions', region, 'players', uid), updatedPublic, { merge: true });
  await batch.commit();
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
  await markStatsChanged(db, firestoreMod, uid, 'role_changed', 'role-decline').catch(() => null);
  await mirrorPublicStatsFromPublicPlayer(publicPlayer, 'role-decline');
}
