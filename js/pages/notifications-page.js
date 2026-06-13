import { getFirebase, watchAuth } from '../services/firebase-service.js';
import {
  canUseAdminPanel,
  createSiteMessageCampaign,
  createUserNotification,
  createUserSentMessage,
  deleteUserNotifications,
  deleteUserSentMessages,
  formatUserDate,
  getGameProfile,
  getUserFarms,
  getUserProfile,
  listRegionNotificationCampaignsForProfile,
  listUserNotifications,
  listUserSentMessages,
  readUserNotificationSummary,
  setUserNotificationSummary,
  markUserNotificationsRead,
  normalizeUserRole,
  patchUserNotification,
  patchUserSentMessage,
  rebuildUserNotificationSummary,
  roleLabel
} from '../services/user-db.js?v=196';
import {
  countNotificationDirectoryD1,
  listNotificationDirectoryRegionsD1,
  searchNotificationDirectoryD1
} from '../services/notifications-d1.js?v=196';

const $ = selector => document.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const regionOf = value => String(value || '').replace(/[^0-9]/g, '');
const tag = value => Array.from(String(value || '').trim().replace(/[^A-Z0-9А-ЯІЇЄҐ]/gi, '')).slice(0, 3).join('');

let currentUser = null;
let currentProfile = null;
let rows = [];
let personalRows = [];
let campaignRows = [];
let sentRows = [];
let sentRowsLoaded = false;
let sentRowsLoading = false;
let directory = [];
let composeReady = false;
let pageReady = false;
let activeTab = 'notifications';
let knownRegionOptions = [];
let directReply = null;
let notificationsFilter = 'active';
let unsubscribePageNotifications = null;
let notificationPages = { notifications: 0, inbox: 0, sent: 0 };
let recipientSearchRows = [];
let recipientSearchTimer = null;
let recipientSearchLoading = false;
let notificationRemoteLimit = 10;

const MESSAGE_SPAM_WINDOW_MS = 10 * 60 * 1000;
const MESSAGE_SPAM_MAX = 20;
const MESSAGE_PAGE_SIZE = 10;
const NOTIFICATION_QUERY_LIMIT = 10;
const NOTIFICATION_QUERY_LIMIT_MAX = 50;
const SENT_QUERY_LIMIT = 50;
const NOTIFICATIONS_PAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NOTIFICATIONS_REFRESH_WINDOW_MS = 10 * 60 * 1000;
const NOTIFICATIONS_REFRESH_LIMIT = 3;
const SERVER_RETENTION_DAYS = 30;
const LOCAL_ARCHIVE_LIMIT = 180;


function setStatus(text, type = 'muted') {
  const box = $('#notificationsStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}
function setHint(text = '') {
  const el = $('#messageSendHint');
  if (el) el.textContent = text;
}
function role() {
  return normalizeUserRole(currentProfile?.role || 'player');
}
function isGlobalManager() {
  return Boolean(currentUser && canUseAdminPanel(currentUser, currentProfile) && ['admin', 'moderator'].includes(role()));
}
function isManager() {
  return Boolean(currentUser && canUseAdminPanel(currentUser, currentProfile));
}
function playerGames(profile = currentProfile || {}) {
  const main = getGameProfile(profile || {});
  return [
    { ...main, farmId: 'main', uid: profile?.uid || currentUser?.uid || '', role: normalizeUserRole(profile?.role || main.role || 'player') },
    ...getUserFarms(profile || {}).map(farm => ({ ...farm, uid: profile?.uid || currentUser?.uid || '', role: normalizeUserRole(farm.role || 'player') }))
  ].filter(game => game.nickname || game.region || game.alliance);
}
function gameRowsFromAccount(account = {}) {
  const uid = account.uid || account.id || '';
  const main = getGameProfile(account || {});
  const baseRole = normalizeUserRole(account.role || 'player');
  const out = [];
  if (main.nickname || main.region || main.alliance) {
    out.push({
      ...main,
      uid,
      farmId: 'main',
      role: baseRole,
      accountRole: baseRole,
      accountName: account.displayName || account.nickname || account.gameNick || '',
      photoURL: account.photoURL || ''
    });
  }
  getUserFarms(account || {}).forEach((farm, index) => {
    if (!(farm.nickname || farm.region || farm.alliance)) return;
    out.push({
      ...farm,
      uid,
      farmId: farm.farmId || farm.id || `farm-${index + 1}`,
      role: normalizeUserRole(farm.role || 'player'),
      accountRole: baseRole,
      accountName: account.displayName || account.nickname || account.gameNick || '',
      photoURL: account.photoURL || ''
    });
  });
  return out;
}
function ownRegions() {
  return [...new Set(playerGames().map(game => regionOf(game.region)).filter(Boolean))];
}
function ownAlliances(region = '') {
  const r = regionOf(region);
  return [...new Set(playerGames().filter(game => !r || regionOf(game.region) === r).map(game => tag(game.alliance)).filter(Boolean))];
}
function directoryGames() {
  const all = directory.flatMap(gameRowsFromAccount).filter(item => item.uid);
  const own = currentProfile ? gameRowsFromAccount({ ...(currentProfile || {}), uid: currentUser?.uid }) : [];
  const seen = new Set();
  return [...all, ...own].filter(item => {
    const key = `${item.uid}:${item.farmId || item.nickname || item.region || 'main'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function targetOptions() {
  const r = role();
  if (isGlobalManager()) return [
    ['admins', t('messages.targetAdmins', 'Адміни і модератори')],
    ['all', t('messages.targetAll', 'Усі гравці')],
    ['region', t('messages.targetRegion', 'Регіон')],
    ['alliance', t('messages.targetAlliance', 'Альянс')],
    ['player', t('messages.targetPlayer', 'Гравець')]
  ];
  if (r === 'consul') return [
    ['region', t('messages.targetMyRegion', 'Усі у моєму регіоні')],
    ['consuls', t('messages.targetConsuls', 'Консули')],
    ['officers', t('messages.targetOfficers', 'Офіцери')],
    ['alliance', t('messages.targetMyAlliance', 'Мій альянс')],
    ['player', t('messages.targetPlayer', 'Гравець')]
  ];
  if (r === 'officer') return [
    ['region', t('messages.targetMyRegion', 'Усі у моєму регіоні')],
    ['officers', t('messages.targetOfficers', 'Офіцери')],
    ['alliance', t('messages.targetMyAlliance', 'Мій альянс')],
    ['player', t('messages.targetPlayer', 'Гравець')]
  ];
  return [
    ['alliance', t('messages.targetMyAlliance', 'Мій альянс')],
    ['player', t('messages.targetPlayer', 'Гравець')]
  ];
}
function regionOptions() {
  if (isGlobalManager()) {
    const fromCatalog = knownRegionOptions.map(item => regionOf(item.region || item.id)).filter(Boolean);
    return [...new Set([...fromCatalog, ...ownRegions()])].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  }
  return ownRegions();
}
function playerLabel(player = {}) {
  return `${player.nickname || player.gameNick || '—'} · R${regionOf(player.region) || '—'} · ${tag(player.alliance) || '—'}`;
}
function actorGameForTarget(region = '', alliance = '') {
  const games = playerGames();
  const r = regionOf(region);
  const a = tag(alliance);
  return games.find(game => regionOf(game.region) === r && (!a || tag(game.alliance) === a))
    || games.find(game => regionOf(game.region) === r)
    || games[0]
    || {};
}
function actorName(target = {}) {
  const game = actorGameForTarget(target.region, target.alliance);
  return game.nickname || getGameProfile(currentProfile || {}).nickname || currentUser?.displayName || currentUser?.email || '—';
}
function actorRole(target = {}) {
  const game = actorGameForTarget(target.region, target.alliance);
  return normalizeUserRole(game.role || currentProfile?.role || 'player');
}
function activeRegion() {
  return $('#messageRegionSelect')?.value || ownRegions()[0] || '';
}
function activeAlliance() {
  return tag($('#messageAllianceInput')?.value || ownAlliances(activeRegion())[0] || '');
}
function canReachPlayer(player = {}) {
  if (isGlobalManager()) return true;
  const r = regionOf(player.region);
  const a = tag(player.alliance);
  const myRegions = ownRegions();
  if (!myRegions.includes(r)) return false;
  if (['consul', 'officer'].includes(role())) return true;
  return ownAlliances(r).includes(a);
}
function dedupeAccounts(list = []) {
  const seen = new Map();
  list.forEach(item => {
    if (!item.uid || seen.has(item.uid)) return;
    seen.set(item.uid, item);
  });
  return [...seen.values()];
}

function targetTypeLabel(type = 'player') {
  const labels = Object.fromEntries(targetOptions());
  const fallbackMap = {
    system: t('messages.targetSystem', 'Система'),
    admins: t('messages.targetAdmins', 'Адміни і модератори'),
    all: t('messages.targetAll', 'Усі гравці'),
    region: t('messages.targetRegion', 'Регіон'),
    alliance: t('messages.targetAlliance', 'Альянс'),
    consuls: t('messages.targetConsuls', 'Консули'),
    officers: t('messages.targetOfficers', 'Офіцери'),
    player: t('messages.targetPlayer', 'Гравець')
  };
  return labels[type] || fallbackMap[type] || t(`messages.${type}`, type || '—');
}
function currentTargetLabel(type = $('#messageTargetType')?.value || 'player', recipients = []) {
  const region = activeRegion();
  const alliance = activeAlliance();
  if (type === 'player') return recipients[0] ? `${t('messages.targetPersonal', 'Особисто')} · ${playerLabel(recipients[0])}` : `${t('messages.targetPersonal', 'Особисто')} · ${String($('#messagePlayerInput')?.value || '').trim()}`;
  if (type === 'alliance') return `${t('messages.targetAlliance', 'Альянс')} ${alliance || '—'} · R${region || '—'}`;
  if (type === 'region') return `${t('messages.targetRegion', 'Регіон')} · R${region || '—'}`;
  if (['consuls', 'officers'].includes(type)) return `${targetTypeLabel(type)} · R${region || '—'}`;
  return targetTypeLabel(type);
}

function campaignVars(item = {}) {
  return {
    region: regionOf(item.region),
    actor: item.actorName || t('notifications.fromRegion', 'Від регіону'),
    target: item.targetLabel || (item.region ? `R${regionOf(item.region)}` : '')
  };
}
function itemTitle(item = {}) {
  if (item.titleKey) return window.WKD_tv ? window.WKD_tv(item.titleKey, campaignVars(item), item.title || t('notifications.title', 'Сповіщення')) : (item.title || t('notifications.title', 'Сповіщення'));
  return item.title || t('notifications.title', 'Сповіщення');
}
function itemMessage(item = {}) {
  if (item.messageKey) return window.WKD_tv ? window.WKD_tv(item.messageKey, campaignVars(item), item.message || item.summary || '') : (item.message || item.summary || '');
  return item.message || item.summary || '';
}
function isCampaign(item = {}) {
  const source = String(item.source || '').toLowerCase();
  const type = String(item.type || '').toLowerCase();
  return source.includes('campaign') || type === 'site_message_campaign' || type.startsWith('registration_') || type === 'registration_notice' || type === 'region_status';
}
function mergeNotificationRows() {
  rows = [...personalRows, ...campaignRows].sort((a, b) => createdMs(b) - createdMs(a));
  return rows;
}
function messageTargetLabel(item = {}) {
  const type = String(item.targetType || '').trim() || (isMessage(item) ? 'player' : 'system');
  if (item.targetLabel) return String(item.targetLabel);
  const region = regionOf(item.region);
  const alliance = tag(item.alliance);
  if (type === 'player') return t('messages.targetPersonal', 'Особисто');
  if (type === 'alliance') return `${t('messages.targetAlliance', 'Альянс')} ${alliance || '—'} · R${region || '—'}`;
  if (type === 'region') return `${t('messages.targetRegion', 'Регіон')} · R${region || '—'}`;
  if (['consuls', 'officers'].includes(type)) return `${targetTypeLabel(type)} · R${region || '—'}`;
  return targetTypeLabel(type);
}
function isUnread(item = {}) {
  return item.unread !== false && !item.readAt && !item.readAtMs;
}
function applyNotificationFilter(list = []) {
  if (notificationsFilter === 'unread') return list.filter(item => item.archived !== true && isUnread(item));
  if (notificationsFilter === 'archived') return list.filter(item => item.archived === true);
  return list.filter(item => item.archived !== true);
}
function activePageKey() {
  if (activeTab === 'inbox') return 'inbox';
  if (activeTab === 'sent') return 'sent';
  return 'notifications';
}
function resetPage(key = activePageKey()) {
  notificationPages[key] = 0;
}
function createdMs(item = {}) {
  return Number(item.createdAtMs) || (item.createdAt?.toMillis?.() || item.createdAt?.toDate?.()?.getTime?.() || 0);
}
function sourceBucket(item = {}) {
  const type = String(item.targetType || item.type || 'system').toLowerCase();
  const roleValue = normalizeUserRole(item.actorRole || 'player');
  const source = sourceKind(item);
  const region = regionOf(item.region);
  const alliance = tag(item.alliance);
  if (source === 'player' && type === 'player') return `player:${item.actorUid || item.actorName || 'unknown'}`;
  if (type === 'alliance') return `alliance:${region}:${alliance || 'all'}`;
  if (type === 'region') return `region:${region || 'all'}`;
  if (['consuls', 'officers', 'admins', 'all'].includes(type)) return `${type}:${region || 'all'}`;
  return `${source || roleValue}:${region || 'global'}`;
}
function sourceBucketLimit(item = {}) {
  const type = String(item.targetType || item.type || 'system').toLowerCase();
  const source = sourceKind(item);
  if (source === 'player' && type === 'player') return 50;
  if (type === 'player') return 30;
  return 20;
}
function limitBySourceBuckets(list = []) {
  const counts = new Map();
  return [...list]
    .sort((a, b) => createdMs(b) - createdMs(a))
    .filter(item => {
      const key = sourceBucket(item);
      const count = counts.get(key) || 0;
      if (count >= sourceBucketLimit(item)) return false;
      counts.set(key, count + 1);
      return true;
    });
}
function pageSlice(list = [], key = activePageKey()) {
  const totalPages = Math.max(1, Math.ceil(list.length / MESSAGE_PAGE_SIZE));
  const page = Math.min(Math.max(0, Number(notificationPages[key]) || 0), totalPages - 1);
  notificationPages[key] = page;
  return list.slice(page * MESSAGE_PAGE_SIZE, (page + 1) * MESSAGE_PAGE_SIZE);
}
function paginationHtml(key = activePageKey(), total = 0) {
  if (total <= MESSAGE_PAGE_SIZE) return '';
  const page = Math.min(Math.max(0, Number(notificationPages[key]) || 0), Math.max(0, Math.ceil(total / MESSAGE_PAGE_SIZE) - 1));
  const totalPages = Math.ceil(total / MESSAGE_PAGE_SIZE);
  const from = page * MESSAGE_PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * MESSAGE_PAGE_SIZE);
  return `<nav class="notifications-pagination" aria-label="${esc(t('notifications.pagination', 'Сторінки повідомлень'))}">
    <button class="btn btn-message-soft" type="button" data-page-key="${esc(key)}" data-page-action="prev" ${page <= 0 ? 'disabled' : ''}>← ${esc(t('notifications.prevPage', 'Назад'))}</button>
    <span>${esc(t('notifications.pageInfo', 'Сторінка'))} ${page + 1}/${totalPages} · ${from}-${to} / ${total}</span>
    <button class="btn btn-message-soft" type="button" data-page-key="${esc(key)}" data-page-action="next" ${page >= totalPages - 1 ? 'disabled' : ''}>${esc(t('notifications.nextPage', 'Далі'))} →</button>
  </nav>`;
}
function retentionCutoffMs() {
  return Date.now() - SERVER_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}
function isOlderThanRetention(item = {}) {
  const ms = createdMs(item);
  return Boolean(ms && ms < retentionCutoffMs());
}
function isOldReadPrivateMessage(item = {}) {
  return !isCampaign(item) && isMessage(item) && isOlderThanRetention(item) && !isUnread(item);
}
function isOldSentMessage(item = {}) {
  return isOlderThanRetention(item);
}
function visibleNotificationRows(list = []) {
  const hiddenReadMessages = list.filter(isOldReadPrivateMessage);
  if (hiddenReadMessages.length) saveLocalArchive('notifications', hiddenReadMessages);
  return list.filter(item => !isOldReadPrivateMessage(item));
}
function visibleSentRows(list = []) {
  const hiddenSent = list.filter(isOldSentMessage);
  if (hiddenSent.length) saveLocalArchive('sentMessages', hiddenSent);
  return list.filter(item => !isOldSentMessage(item));
}
function localArchiveKey(collectionName = 'notifications') {
  return `wkd-local-message-archive:${currentUser?.uid || 'guest'}:${collectionName}`;
}
function saveLocalArchive(collectionName = 'notifications', list = []) {
  if (!list.length || !currentUser) return;
  try {
    const key = localArchiveKey(collectionName);
    const old = JSON.parse(localStorage.getItem(key) || '[]');
    const map = new Map();
    [...(Array.isArray(old) ? old : []), ...list].forEach(item => {
      if (!item?.id) return;
      const safe = {
        id: String(item.id).slice(0, 140),
        title: String(item.title || '').slice(0, 160),
        message: String(item.message || item.summary || '').slice(0, 600),
        region: regionOf(item.region),
        alliance: tag(item.alliance),
        targetType: String(item.targetType || item.type || '').slice(0, 40),
        targetLabel: String(item.targetLabel || '').slice(0, 160),
        actorName: String(item.actorName || '').slice(0, 120),
        actorRole: String(item.actorRole || '').slice(0, 40),
        createdAtMs: createdMs(item),
        locallyArchivedAtMs: Date.now()
      };
      map.set(safe.id, safe);
    });
    const next = [...map.values()].sort((a, b) => createdMs(b) - createdMs(a)).slice(0, LOCAL_ARCHIVE_LIMIT);
    localStorage.setItem(key, JSON.stringify(next));
  } catch (_) {}
}
function pageRowsCacheKey(uid = currentUser?.uid || '') {
  return `wkd.notifications.pageRows.v154.${uid || 'guest'}`;
}
function readBellSummaryCache(uid = currentUser?.uid || '') {
  try { return JSON.parse(localStorage.getItem(`wkd.notify.summary.${uid}`) || 'null') || null; } catch (_) { return null; }
}
function pageRowsScope() {
  const games = playerGames().map(game => `${regionOf(game.region)}:${tag(game.alliance)}:${normalizeUserRole(game.role || currentProfile?.role || 'player')}`).filter(Boolean).sort();
  return `${normalizeUserRole(currentProfile?.role || 'player')}:${games.join('|')}`;
}
function readCachedPageRows() {
  if (!currentUser) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(pageRowsCacheKey()) || 'null');
    if (!raw || (Date.now() - Number(raw.savedAtMs || 0)) > NOTIFICATIONS_PAGE_CACHE_TTL_MS) return null;
    if (String(raw.scope || '') !== pageRowsScope()) return null;
    const bell = readBellSummaryCache();
    const newestLocal = Number(bell?.lastNotificationAtMs || bell?.updatedAtMs || 0) || 0;
    if (newestLocal && Number(raw.savedAtMs || 0) < newestLocal) return null;
    return {
      personalRows: Array.isArray(raw.personalRows) ? raw.personalRows : [],
      campaignRows: Array.isArray(raw.campaignRows) ? raw.campaignRows : [],
      savedAtMs: Number(raw.savedAtMs) || 0,
      remoteLimit: Math.max(NOTIFICATION_QUERY_LIMIT, Number(raw.remoteLimit) || NOTIFICATION_QUERY_LIMIT)
    };
  } catch (_) { return null; }
}
function writeCachedPageRows() {
  if (!currentUser) return;
  try {
    localStorage.setItem(pageRowsCacheKey(), JSON.stringify({
      savedAtMs: Date.now(),
      scope: pageRowsScope(),
      remoteLimit: notificationRemoteLimit,
      personalRows: personalRows.slice(0, NOTIFICATION_QUERY_LIMIT_MAX),
      campaignRows: campaignRows.slice(0, 30)
    }));
  } catch (_) {}
}
function moreButtonHtml(kind = 'notifications', loaded = 0) {
  if (notificationRemoteLimit >= NOTIFICATION_QUERY_LIMIT_MAX || loaded < notificationRemoteLimit) return '';
  return `<div class="notifications-load-more"><button class="btn btn-message-soft" type="button" data-load-more-notifications="${esc(kind)}">${esc(t('notifications.showMore', 'Показати ще'))}</button></div>`;
}

async function cleanupOldMessages(firebase, uid = '') {
  // v111: do not delete personal messages automatically. Old read private messages
  // are copied to localStorage and hidden from the page; unread old messages stay visible.
  return;
}
function notificationDoc(firebase, id = '') {
  return firebase.firestoreMod.doc(firebase.db, 'users', currentUser.uid, 'notifications', id);
}
function sentMessageDoc(firebase, id = '') {
  return firebase.firestoreMod.doc(firebase.db, 'users', currentUser.uid, 'sentMessages', id);
}
function replyContextFrom(item = {}) {
  if (!item || !item.id) return {};
  const meta = senderMeta(item);
  return {
    replyToId: String(item.id || '').slice(0, 120),
    replyToTitle: String(item.title || t('messages.defaultSubject', 'Повідомлення')).trim().slice(0, 160),
    replyToActorName: String(meta.name || item.actorName || '').trim().slice(0, 120),
    replyToCreatedAtMs: Number(item.createdAtMs) || Date.now()
  };
}
function renderReplyContext(item = {}) {
  const title = String(item.replyToTitle || '').trim();
  const name = String(item.replyToActorName || '').trim();
  if (!title && !name) return '';
  const date = item.replyToCreatedAtMs ? new Date(Number(item.replyToCreatedAtMs)).toLocaleString() : '';
  return `<div class="message-reply-context">
    <span>${esc(t('messages.replyContext', 'Відповідь на'))}</span>
    <b>${esc(title || t('messages.defaultSubject', 'Повідомлення'))}</b>
    ${name ? `<em>${esc(t('messages.replyFrom', 'від'))} ${esc(name)}</em>` : ''}
    ${date ? `<small>${esc(date)}</small>` : ''}
  </div>`;
}
function spamStorageKey() {
  return `wkd-message-times:${currentUser?.uid || 'guest'}`;
}
function recentMessageTimes() {
  try {
    const raw = JSON.parse(localStorage.getItem(spamStorageKey()) || '[]');
    const now = Date.now();
    return (Array.isArray(raw) ? raw : []).map(Number).filter(ms => Number.isFinite(ms) && now - ms < MESSAGE_SPAM_WINDOW_MS);
  } catch (_) {
    return [];
  }
}
function canSendBySpamLimit() {
  return recentMessageTimes().length < MESSAGE_SPAM_MAX;
}
function rememberMessageSend() {
  try {
    const list = [...recentMessageTimes(), Date.now()].slice(-MESSAGE_SPAM_MAX);
    localStorage.setItem(spamStorageKey(), JSON.stringify(list));
  } catch (_) {}
}
async function loadSentMessages(_firebase, uid) {
  return listUserSentMessages(uid, SENT_QUERY_LIMIT);
}

async function loadSentMessagesIfNeeded({ force = false } = {}) {
  if (!currentUser) return;
  if (sentRowsLoaded && !force) return;
  if (sentRowsLoading) return;
  sentRowsLoading = true;
  renderSentList();
  try {
    const sent = await loadSentMessages(null, currentUser.uid).catch(() => []);
    saveLocalArchive('sentMessages', sent.filter(isOldSentMessage));
    sentRows = sent;
    sentRowsLoaded = true;
  } finally {
    sentRowsLoading = false;
    renderSentList();
  }
}

async function syncNotificationSummaryFromRows() {
  if (!currentUser) return;
  await rebuildUserNotificationSummary(currentUser.uid, personalRows).catch(error => console.warn('[WKD] notification summary sync skipped', error));
}

function stopPageNotificationsWatch() {
  if (typeof unsubscribePageNotifications === 'function') {
    try { unsubscribePageNotifications(); } catch (_) {}
  }
  unsubscribePageNotifications = null;
}
function watchPageNotifications(_firebase, _uid) {
  stopPageNotificationsWatch();
  // v114: personal messages are D1-first, so the page no longer keeps a Firestore realtime listener.
}
async function saveSentMessage(_firebase, values = {}) {
  if (!currentUser) return null;
  return createUserSentMessage(currentUser.uid, values);
}
async function patchNotification(id = '', values = {}) {
  if (!currentUser || !id) return;
  return patchUserNotification(currentUser.uid, id, values);
}
async function deleteNotificationDoc(id = '') {
  if (!currentUser || !id) return;
  return deleteUserNotifications(currentUser.uid, [id]);
}
async function patchSentMessage(id = '', values = {}) {
  if (!currentUser || !id) return;
  return patchUserSentMessage(currentUser.uid, id, values);
}
async function deleteSentMessageDoc(id = '') {
  if (!currentUser || !id) return;
  return deleteUserSentMessages(currentUser.uid, [id]);
}
function filteredRecipients(type = $('#messageTargetType')?.value || 'player', options = {}) {
  if (!options.preview && directReply?.uid && type === 'player') return [directReply];
  const region = activeRegion();
  const alliance = activeAlliance();
  const selectedPlayer = String($('#messagePlayerInput')?.value || '').trim().toLowerCase();
  let list = type === 'player' ? [...recipientSearchRows, ...directoryGames()] : directoryGames();
  if (type === 'admins') list = list.filter(p => ['admin', 'moderator'].includes(normalizeUserRole(p.accountRole || p.role || 'player')));
  else if (type === 'all') list = isGlobalManager() ? list : [];
  else if (type === 'region') list = list.filter(p => regionOf(p.region) === region && (isGlobalManager() || ownRegions().includes(region)));
  else if (type === 'consuls') list = list.filter(p => regionOf(p.region) === region && normalizeUserRole(p.role || p.accountRole || 'player') === 'consul' && (isGlobalManager() || ownRegions().includes(region)));
  else if (type === 'officers') list = list.filter(p => regionOf(p.region) === region && normalizeUserRole(p.role || p.accountRole || 'player') === 'officer' && (isGlobalManager() || ownRegions().includes(region)));
  else if (type === 'alliance') list = list.filter(p => regionOf(p.region) === region && tag(p.alliance) === alliance && (isGlobalManager() || ownAlliances(region).includes(alliance) || ['consul', 'officer'].includes(role())));
  else if (type === 'player' && !options.preview) list = list.filter(p => {
    const nick = String(p.nickname || p.gameNick || '').trim().toLowerCase();
    const label = playerLabel(p).trim().toLowerCase();
    const regionOk = !region || regionOf(p.region) === region;
    const allianceOk = !alliance || tag(p.alliance) === alliance;
    return Boolean(selectedPlayer) && regionOk && allianceOk && (nick === selectedPlayer || label === selectedPlayer);
  });
  if (!isGlobalManager()) list = list.filter(canReachPlayer);
  return options.preview ? list : dedupeAccounts(list);
}
function isMessage(item = {}) {
  return item.type === 'site_message' || item.type === 'site_message_campaign';
}
function initials(name = '') {
  const clean = String(name || '').trim();
  const parts = clean.split(/\s+/).filter(Boolean).slice(0, 2);
  return (parts.map(part => Array.from(part)[0]).join('') || 'WK').toUpperCase();
}
function accountByUid(uid = '') {
  return directory.find(item => (item.uid || item.id) === uid) || null;
}
function senderGame(item = {}) {
  const games = directoryGames().filter(game => game.uid === item.actorUid);
  const r = regionOf(item.region);
  const a = tag(item.alliance);
  return games.find(game => regionOf(game.region) === r && (!a || tag(game.alliance) === a))
    || games.find(game => regionOf(game.region) === r)
    || games[0]
    || null;
}
function senderMeta(item = {}) {
  const account = accountByUid(item.actorUid) || {};
  const game = senderGame(item) || {};
  const senderRole = normalizeUserRole(item.actorRole || game.role || account.role || 'player');
  const name = item.actorName || game.nickname || account.displayName || account.nickname || account.gameNick || t('messages.unknownSender', 'Невідомий відправник');
  return {
    uid: item.actorUid || game.uid || account.uid || account.id || '',
    name,
    label: game.uid ? playerLabel(game) : name,
    role: senderRole,
    roleText: item.actorRoleText || roleLabel(senderRole),
    photoURL: item.actorPhotoURL || game.photoURL || account.photoURL || '',
    region: regionOf(item.region || game.region),
    alliance: tag(item.alliance || game.alliance)
  };
}
function sourceKind(item = {}, meta = null) {
  const roleValue = normalizeUserRole(item.actorRole || meta?.role || 'player');
  const type = String(item.type || item.source || '').toLowerCase();
  if ((item.source === 'campaign' && type !== 'site_message_campaign') || item.source === 'region-status' || type.includes('region') || type.includes('registration')) return 'region';
  if (roleValue === 'admin' || roleValue === 'moderator') return 'admin';
  if (roleValue === 'consul') return 'consul';
  if (roleValue === 'officer') return 'officer';
  return 'player';
}
function sourceLabel(item = {}, meta = null) {
  const kind = sourceKind(item, meta);
  const map = {
    admin: t('notifications.fromAdmin', 'Від адміна'),
    consul: t('notifications.fromConsul', 'Від консула'),
    officer: t('notifications.fromOfficer', 'Від офіцера'),
    region: t('notifications.fromRegion', 'Від регіону'),
    player: t('notifications.fromPlayer', 'Від гравця')
  };
  return map[kind] || map.player;
}
function dateText(item = {}) {
  const formatted = item.createdAt ? formatUserDate(item.createdAt) : '';
  if (formatted && formatted !== '—') return formatted;
  return item.createdAtMs ? new Date(item.createdAtMs).toLocaleString() : '';
}
function renderAvatar(meta = {}) {
  if (meta.photoURL) {
    return `<span class="message-avatar"><img src="${esc(meta.photoURL)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.message-avatar').textContent='${esc(initials(meta.name))}'"></span>`;
  }
  return `<span class="message-avatar">${esc(initials(meta.name))}</span>`;
}
function renderNoticeList() {
  const list = $('#notificationsNoticeList');
  if (!list) return;
  const notices = applyNotificationFilter(limitBySourceBuckets(visibleNotificationRows(rows).filter(item => !isMessage(item))));
  const pageItems = pageSlice(notices, 'notifications');
  list.innerHTML = notices.length ? pageItems.map(item => {
    const unread = isUnread(item);
    const meta = senderMeta(item);
    return `
    <article class="notify-item ${unread ? 'is-unread' : ''}">
      <b>${esc(itemTitle(item))}</b>
      <div class="notification-source-row">
        <span class="notification-source">${esc(sourceLabel(item, meta))}</span>
        ${meta.name ? `<span>${esc(meta.name)}</span>` : ''}
      </div>
      <span>${esc(itemMessage(item))}</span>
      <small>${esc(item.region ? `R${item.region} · ` : '')}${esc(dateText(item))}</small>
      <div class="notification-card-actions">
        ${unread ? `<button class="btn btn-message-soft" type="button" data-notification-action="read" data-notification-id="${esc(item.id || '')}">${esc(t('notifications.markOneRead', 'Прочитано'))}</button>` : ''}
        <button class="btn btn-message-soft" type="button" data-notification-action="archive" data-notification-id="${esc(item.id || '')}">${esc(t('notifications.archive', 'Архівувати'))}</button>
        <button class="btn btn-message-danger" type="button" data-notification-action="delete" data-notification-id="${esc(item.id || '')}">${esc(t('notifications.delete', 'Видалити'))}</button>
      </div>
    </article>`;
  }).join('') + paginationHtml('notifications', notices.length) + moreButtonHtml('notifications', notices.length) : `<div class="notify-empty">${esc(t('notifications.empty', 'Нових сповіщень немає.'))}</div>`;
}
function renderMessageList() {
  const list = $('#notificationsInboxList');
  if (!list) return;
  const messages = applyNotificationFilter(limitBySourceBuckets(visibleNotificationRows(rows).filter(item => isMessage(item))));
  const pageItems = pageSlice(messages, 'inbox');
  list.innerHTML = messages.length ? pageItems.map(item => {
    const meta = senderMeta(item);
    const unread = isUnread(item);
    return `
      <article class="site-message-card ${unread ? 'is-unread' : ''}">
        <div class="site-message-main">
          ${renderAvatar(meta)}
          <div class="site-message-content">
            <div class="site-message-sender">
              <strong>${esc(meta.name)}</strong>
              <span class="message-origin">${esc(sourceLabel(item, meta))}</span>
              <span class="message-target-badge">${esc(messageTargetLabel(item))}</span>
              <span class="role-badge role-${esc(meta.role)}">${esc(meta.roleText)}</span>
            </div>
            <small>${esc(meta.region ? `R${meta.region}` : 'R—')} · ${esc(meta.alliance || '—')} · ${esc(dateText(item))}</small>
            <h3>${esc(item.title || t('messages.defaultSubject', 'Повідомлення'))}</h3>
            ${renderReplyContext(item)}
            <p>${esc(item.message || item.summary || '')}</p>
          </div>
        </div>
        <div class="site-message-actions">
          ${meta.uid ? `<button class="btn site-message-reply" type="button" data-reply-id="${esc(item.id || '')}" data-i18n="messages.reply">${esc(t('messages.reply', 'Відповісти'))}</button>` : ''}
          ${unread ? `<button class="btn btn-message-soft" type="button" data-notification-action="read" data-notification-id="${esc(item.id || '')}">${esc(t('notifications.markOneRead', 'Прочитано'))}</button>` : ''}
          <button class="btn btn-message-soft" type="button" data-notification-action="archive" data-notification-id="${esc(item.id || '')}">${esc(t('notifications.archive', 'Архівувати'))}</button>
          <button class="btn btn-message-danger" type="button" data-notification-action="delete" data-notification-id="${esc(item.id || '')}">${esc(t('notifications.delete', 'Видалити'))}</button>
        </div>
      </article>`;
  }).join('') + paginationHtml('inbox', messages.length) + moreButtonHtml('inbox', messages.length) : `<div class="notify-empty">${esc(t('notifications.noMessages', 'Отриманих повідомлень немає.'))}</div>`;
}
function renderSentList() {
  const list = $('#notificationsSentList');
  if (!list) return;
  if (!sentRowsLoaded) {
    list.innerHTML = sentRowsLoading
      ? `<div class="notify-empty">${esc(t('notifications.loading', 'Завантажую сповіщення...'))}</div>`
      : `<div class="notify-empty">${esc(t('messages.openSentTabToLoad', 'Надіслані повідомлення завантажаться після відкриття цієї вкладки.'))}</div>`;
    return;
  }
  const sent = applyNotificationFilter(limitBySourceBuckets(visibleSentRows(sentRows))); 
  const pageItems = pageSlice(sent, 'sent');
  list.innerHTML = sent.length ? pageItems.map(item => `
    <article class="site-message-card sent-message-card">
      <div class="site-message-main">
        <span class="message-avatar">${esc(initials(actorName({ region: item.region, alliance: item.alliance })))}</span>
        <div class="site-message-content">
          <div class="site-message-sender">
            <strong>${esc(item.title || t('messages.defaultSubject', 'Повідомлення'))}</strong>
            <span class="sent-message-target">${esc(messageTargetLabel(item))}</span>
          </div>
          <div class="sent-message-meta">
            <span>${esc(t('messages.recipients', 'Отримувачів'))}: ${esc(item.recipientCount ?? 0)}</span>
            <span>${esc(dateText(item))}</span>
          </div>
          ${item.recipientPreview ? `<small>${esc(item.recipientPreview)}</small>` : ''}
          ${renderReplyContext(item)}
          <p>${esc(item.message || '')}</p>
        </div>
      </div>
      <div class="site-message-actions">
        <button class="btn btn-message-soft" type="button" data-sent-action="archive" data-sent-id="${esc(item.id || '')}">${esc(t('notifications.archive', 'Архівувати'))}</button>
        <button class="btn btn-message-danger" type="button" data-sent-action="delete" data-sent-id="${esc(item.id || '')}">${esc(t('notifications.delete', 'Видалити'))}</button>
      </div>
    </article>`).join('') + paginationHtml('sent', sent.length) : `<div class="notify-empty">${esc(t('messages.noSentMessages', 'Надісланих повідомлень немає.'))}</div>`;
}
function render() {
  renderNoticeList();
  renderMessageList();
  renderSentList();
}
async function refreshRecipientSearch({ immediate = false } = {}) {
  if (!currentUser || ($('#messageTargetType')?.value || 'player') !== 'player') return;
  const input = String($('#messagePlayerInput')?.value || '').trim();
  if (directReply?.uid) {
    recipientSearchRows = [directReply];
    renderPlayerList();
    return;
  }
  if (input.length < 2) {
    recipientSearchRows = [];
    renderPlayerList();
    return;
  }
  const run = async () => {
    recipientSearchLoading = true;
    try {
      recipientSearchRows = await searchNotificationDirectoryD1(currentUser, {
        targetType: 'player',
        q: input,
        region: activeRegion(),
        alliance: activeAlliance(),
        limit: 10
      }).catch(() => []);
      directory = dedupeAccounts([...(directory || []), ...recipientSearchRows, ...(currentProfile ? [{ ...(currentProfile || {}), uid: currentUser?.uid }] : [])]);
      renderPlayerList();
    } finally {
      recipientSearchLoading = false;
    }
  };
  if (recipientSearchTimer) window.clearTimeout(recipientSearchTimer);
  if (immediate) await run();
  else recipientSearchTimer = window.setTimeout(run, 450);
}
function renderPlayerList() {
  const datalist = $('#messagePlayerList');
  const meta = $('#messagePlayerMeta');
  if (!datalist) return;
  const allowed = [
    ...(directReply?.uid ? [directReply] : []),
    ...recipientSearchRows,
    ...(currentProfile ? gameRowsFromAccount({ ...(currentProfile || {}), uid: currentUser?.uid }) : [])
  ].filter(canReachPlayer);
  const seen = new Set();
  datalist.innerHTML = allowed.map(p => String(p.nickname || p.gameNick || '').trim()).filter(label => {
    if (!label || seen.has(label.toLowerCase())) return false;
    seen.add(label.toLowerCase());
    return true;
  }).map(label => `<option value="${esc(label)}"></option>`).join('');

  if (meta) {
    const input = String($('#messagePlayerInput')?.value || '').trim();
    const matches = input ? filteredRecipients('player').filter(p => !directReply?.uid || p.uid === directReply.uid) : [];
    meta.classList.remove('is-valid', 'is-error');
    if (!input) {
      meta.textContent = t('messages.playerSearchHint', 'Введи точний нік і вибери регіон/альянс. Частина ніку не відправляється.');
    } else if (matches.length === 1) {
      const player = matches[0];
      meta.classList.add('is-valid');
      meta.textContent = `${t('account.region', 'Регіон')}: R${regionOf(player.region) || '—'} · ${t('account.alliance', 'Альянс')}: ${tag(player.alliance) || '—'}`;
    } else {
      meta.classList.add('is-error');
      meta.textContent = t('messages.selectExactPlayer', 'Вибери точного гравця: повний нік + правильний регіон і альянс.');
    }
  }
}
function updateComposeVisibility() {
  const type = $('#messageTargetType')?.value || 'player';
  const needsRegion = ['player', 'region', 'alliance', 'consuls', 'officers'].includes(type);
  const needsAlliance = ['player', 'alliance'].includes(type);
  $('#messageRegionWrap') && ($('#messageRegionWrap').hidden = !needsRegion);
  $('#messageAllianceWrap') && ($('#messageAllianceWrap').hidden = !needsAlliance);
  $('#messagePlayerWrap') && ($('#messagePlayerWrap').hidden = type !== 'player');
}
function switchTab(tab = 'notifications') {
  activeTab = ['notifications', 'inbox', 'sent', 'compose'].includes(tab) ? tab : 'notifications';
  $('#notificationsNotices') && ($('#notificationsNotices').hidden = activeTab !== 'notifications');
  $('#notificationsInbox') && ($('#notificationsInbox').hidden = activeTab !== 'inbox');
  $('#notificationsSent') && ($('#notificationsSent').hidden = activeTab !== 'sent');
  $('#notificationsCompose') && ($('#notificationsCompose').hidden = activeTab !== 'compose');
  $$('[data-notifications-tab]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.notificationsTab === activeTab));
  resetPage(activePageKey());
  render();
  if (activeTab === 'sent') loadSentMessagesIfNeeded().catch(error => console.warn('[WKD] sent messages lazy load skipped', error));
}
function setNotificationsFilter(filter = 'active') {
  notificationsFilter = ['active', 'unread', 'archived'].includes(filter) ? filter : 'active';
  $$('[data-notifications-filter]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.notificationsFilter === notificationsFilter));
  resetPage(activePageKey());
  render();
}
function renderCompose() {
  const box = $('#notificationsCompose');
  if (!box || !currentUser) return;
  const type = $('#messageTargetType');
  const selected = type?.value || '';
  const options = targetOptions();
  if (type) {
    type.innerHTML = options.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('');
    type.value = options.some(([value]) => value === selected) ? selected : options[0]?.[0] || 'player';
  }
  const regionSelect = $('#messageRegionSelect');
  if (regionSelect) {
    const old = regionSelect.value;
    const list = regionOptions();
    regionSelect.innerHTML = list.map(region => `<option value="${esc(region)}">R${esc(region)}</option>`).join('');
    regionSelect.value = list.includes(old) ? old : list[0] || '';
  }
  const allianceInput = $('#messageAllianceInput');
  if (allianceInput && !allianceInput.value) allianceInput.value = ownAlliances(regionSelect?.value)[0] || '';
  updateComposeVisibility();
  renderPlayerList();
}
async function loadDirectory() {
  const [regions] = await Promise.all([
    isManager() ? listNotificationDirectoryRegionsD1(currentUser).catch(() => []) : Promise.resolve([])
  ]);
  knownRegionOptions = Array.isArray(regions) ? regions : [];
  recipientSearchRows = [];
  return currentUser && currentProfile ? [{ ...(currentProfile || {}), uid: currentUser.uid }] : [];
}
async function load(user, options = {}) {
  currentUser = user || null;
  if (!user) {
    stopPageNotificationsWatch();
    setStatus(t('notifications.authRequired', 'Увійди через Google.'), 'warn');
    setTimeout(() => { window.location.href = 'login.html'; }, 800);
    return;
  }
  const firebase = await getFirebase();
  if (!firebase) return;
  currentProfile = await getUserProfile(user.uid).catch(() => null);
  cleanupOldMessages(firebase, user.uid).catch(error => console.warn('[WKD] old messages cleanup skipped', error));
  directory = await loadDirectory();
  sentRows = [];
  sentRowsLoaded = false;
  sentRowsLoading = false;

  const cached = !options?.force ? readCachedPageRows() : null;
  if (cached) {
    notificationRemoteLimit = Math.max(notificationRemoteLimit, cached.remoteLimit || NOTIFICATION_QUERY_LIMIT);
    personalRows = cached.personalRows;
    campaignRows = cached.campaignRows;
    mergeNotificationRows();
    setStatus(t('notifications.loadedFromCache', 'Сповіщення показані з локального кешу. Натисни “Оновити” для свіжих даних або “Показати ще”.'), 'success');
    renderCompose();
    switchTab(activeTab);
    if (activeTab === 'sent') await loadSentMessagesIfNeeded();
    render();
    watchPageNotifications(firebase, user.uid);
    return;
  }

  const seenSummary = await readUserNotificationSummary(user.uid).catch(() => null);
  const [personal, campaigns] = await Promise.all([
    listUserNotifications(user.uid, notificationRemoteLimit).catch(() => []),
    listRegionNotificationCampaignsForProfile(currentProfile || {}, {
      sinceMs: Number(seenSummary?.campaignSeenAtMs) || 0,
      perRegionLimit: 5,
      totalLimit: Math.min(30, notificationRemoteLimit)
    }).catch(() => [])
  ]);
  const personalMap = new Map();
  personal.forEach(item => personalMap.set(item.id, { source: item.source || 'account', ...item }));
  personalRows = [...personalMap.values()].sort((a, b) => createdMs(b) - createdMs(a));
  saveLocalArchive('notifications', personalRows.filter(isOldReadPrivateMessage));
  const campaignSeenAtMs = Number(seenSummary?.campaignSeenAtMs) || 0;
  campaignRows = campaigns.map(item => ({ ...item, unread: createdMs(item) > campaignSeenAtMs }));
  mergeNotificationRows();
  writeCachedPageRows();
  setStatus(t('notifications.loaded', 'Сповіщення оновлено.'), 'success');
  renderCompose();
  switchTab(activeTab);
  if (activeTab === 'sent') await loadSentMessagesIfNeeded();
  render();
  watchPageNotifications(firebase, user.uid);
}
function notificationsRefreshHistoryKey() {
  return `wkd.notificationsRefreshHistory.v164.${currentUser?.uid || 'guest'}`;
}
function notificationsManualRefreshAllowed() {
  const now = Date.now();
  try {
    const raw = JSON.parse(localStorage.getItem(notificationsRefreshHistoryKey()) || '[]');
    const fresh = (Array.isArray(raw) ? raw : []).map(Number).filter(ms => Number.isFinite(ms) && now - ms < NOTIFICATIONS_REFRESH_WINDOW_MS);
    if (fresh.length >= NOTIFICATIONS_REFRESH_LIMIT) {
      const waitMs = NOTIFICATIONS_REFRESH_WINDOW_MS - (now - fresh[0]);
      const waitMin = Math.max(1, Math.ceil(waitMs / 60000));
      setStatus(t('notifications.refreshLimited', `Оновлення тимчасово обмежено. Спробуй через ${waitMin} хв.`), 'warn');
      return false;
    }
    fresh.push(now);
    localStorage.setItem(notificationsRefreshHistoryKey(), JSON.stringify(fresh));
    return true;
  } catch (_) {
    return true;
  }
}

function clearCachedPageRows() {
  try { if (currentUser) localStorage.removeItem(pageRowsCacheKey()); } catch (_) {}
}
async function manualRefreshNotificationsPage() {
  if (!currentUser) return;
  if (!notificationsManualRefreshAllowed()) return;
  clearCachedPageRows();
  notificationRemoteLimit = NOTIFICATION_QUERY_LIMIT;
  await load(currentUser, { force: true });
  window.WKD?.refreshNotifications?.({ forceRemote: true });
}

async function markCampaignsSeen(items = []) {
  if (!currentUser || !items.length) return;
  const maxSeen = items.reduce((max, item) => Math.max(max, Number(item.createdAtMs) || 0), 0);
  if (!maxSeen) return;
  await setUserNotificationSummary(currentUser.uid, { campaignSeenAtMs: maxSeen, updatedAtMs: Date.now() }).catch(() => null);
  campaignRows = campaignRows.map(row => items.some(item => item.id === row.id) ? { ...row, unread: false, readAtMs: Date.now() } : row);
  mergeNotificationRows();
}
async function markAll() {
  if (!currentUser) return;
  const unreadPersonal = personalRows.filter(row => row.id && row.archived !== true && isUnread(row));
  const unreadCampaigns = campaignRows.filter(row => row.id && isUnread(row));
  if (unreadPersonal.length) {
    const nowMs = Date.now();
    await markUserNotificationsRead(currentUser.uid, unreadPersonal.map(row => row.id)).catch(() => null);
    personalRows = personalRows.map(row => unreadPersonal.some(item => item.id === row.id) ? { ...row, unread: false, readAtMs: nowMs } : row);
  }
  await markCampaignsSeen(unreadCampaigns);
  mergeNotificationRows();
  await syncNotificationSummaryFromRows();
  writeCachedPageRows();
  render();
  window.WKD?.refreshNotifications?.();
}

function d1CampaignErrorHint(error) {
  const raw = String(error?.message || error?.data?.error || '').trim();
  if (/d1_not_configured|notifications-d1-disabled/i.test(raw)) return 'D1 не підключений або Worker ще не оновлений.';
  if (/token|auth|required/i.test(raw)) return 'Потрібно оновити сторінку і знову увійти в акаунт.';
  if (/no such column|SQLITE_ERROR|table|column|schema/i.test(raw)) return 'D1 база має стару схему. Потрібно задеплоїти новий worker.js v151 один раз, щоб він додав відсутні колонки.';
  if (/failed to fetch|network/i.test(raw)) return 'Немає відповіді від Cloudflare Worker.';
  return raw ? `D1: ${raw}` : 'D1 campaign не створився.';
}

function canUseCampaignForTarget(type = 'player') {
  return ['all', 'region', 'alliance', 'consuls', 'officers'].includes(type) && !directReply?.replyToId;
}
function campaignRegionsForTarget(type = 'region', recipients = []) {
  if (type === 'all') {
    const fromRecipients = [...new Set((recipients || []).map(p => regionOf(p.region)).filter(Boolean))];
    return fromRecipients.length ? fromRecipients : regionOptions();
  }
  const region = activeRegion();
  return region ? [region] : [];
}
async function sendCampaignMessage(type = 'region', recipients = [], values = {}) {
  const regions = campaignRegionsForTarget(type, recipients);
  if (!regions.length) throw new Error('no-campaign-regions');
  const campaignGroupId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const alliance = type === 'alliance' ? activeAlliance() : '';
  const results = [];
  for (const region of regions) {
    const target = { region, alliance };
    const senderRole = actorRole(target);
    const campaign = await createSiteMessageCampaign({
      title: values.title,
      message: values.message,
      region,
      alliance,
      targetType: type,
      targetLabel: values.targetLabel,
      campaignGroupId,
      actorUid: currentUser.uid,
      actorName: actorName(target),
      actorRole: senderRole,
      actorRoleText: roleLabel(senderRole)
    });
    if (!campaign?.id) throw new Error('campaign-write-failed');
    results.push(campaign);
  }
  return results;
}
async function recipientCountForTarget(type = 'player') {
  if (type === 'player') return filteredRecipients('player').length;
  return countNotificationDirectoryD1(currentUser, {
    targetType: type,
    region: ['all'].includes(type) ? '' : activeRegion(),
    alliance: type === 'alliance' ? activeAlliance() : '',
    limit: 1
  }).catch(() => 0);
}
async function resolveRecipientsForSend(type = 'player') {
  if (type === 'player') {
    await refreshRecipientSearch({ immediate: true });
    return filteredRecipients('player');
  }
  if (type === 'admins') {
    const rows = await searchNotificationDirectoryD1(currentUser, { targetType: 'admins', limit: 50 }).catch(() => []);
    recipientSearchRows = rows;
    directory = dedupeAccounts([...(directory || []), ...rows]);
    return dedupeAccounts(rows);
  }
  return filteredRecipients(type);
}
async function sendMessage() {
  if (!currentUser || !currentProfile) return;
  const title = String($('#messageSubjectInput')?.value || t('messages.defaultSubject', 'Повідомлення')).trim().slice(0, 80) || t('messages.defaultSubject', 'Повідомлення');
  const body = String($('#messageBodyInput')?.value || '').trim().slice(0, 600);
  if (!body) { setHint(t('messages.emptyBody', 'Напиши текст повідомлення.')); return; }
  if (!canSendBySpamLimit()) {
    setHint(t('messages.spamLimit', 'Забагато повідомлень за короткий час. Спробуй трохи пізніше.'));
    return;
  }
  const replyContext = directReply?.replyToId ? {
    replyToId: directReply.replyToId,
    replyToTitle: directReply.replyToTitle,
    replyToActorName: directReply.replyToActorName,
    replyToCreatedAtMs: directReply.replyToCreatedAtMs
  } : {};
  const type = $('#messageTargetType')?.value || 'player';
  const recipients = canUseCampaignForTarget(type) ? [] : await resolveRecipientsForSend(type);
  const estimatedRecipients = canUseCampaignForTarget(type) ? await recipientCountForTarget(type) : recipients.length;
  if (!estimatedRecipients) {
    const region = activeRegion();
    setHint(type === 'player'
      ? t('messages.selectExactPlayer', 'Вибери точного гравця: повний нік + правильний регіон і альянс.')
      : (region ? `${t('messages.noRecipients', 'Немає отримувачів для цього вибору.')} R${region}` : t('messages.noRegionSelected', 'Вибери регіон або гравця.')));
    return;
  }
  const firebase = await getFirebase();
  if (!firebase) { setHint(t('messages.sendFailed', 'Не вдалося відправити повідомлення.')); return; }
  setHint(t('messages.sending', 'Відправляю...'));
  const targetLabel = currentTargetLabel(type, recipients);
  let sentCount = estimatedRecipients;
  let recipientPreview = recipients.slice(0, 5).map(playerLabel).join(' • ');

  if (canUseCampaignForTarget(type)) {
    let campaigns = [];
    try {
      campaigns = await sendCampaignMessage(type, recipients, { title, message: body, targetLabel });
    } catch (error) {
      console.error('[WKD] D1 campaign send failed', error);
      setHint(`${t('messages.sendFailed', 'Не вдалося відправити повідомлення.')} ${d1CampaignErrorHint(error)}`);
      return;
    }
    if (!campaigns.length) {
      setHint(`${t('messages.sendFailed', 'Не вдалося відправити повідомлення.')} D1 campaign не створився.`);
      return;
    }
    recipientPreview = type === 'all'
      ? `${t('messages.campaignRegions', 'Регіонів')}: ${campaigns.length}`
      : `${messageTargetLabel({ targetType: type, region: activeRegion(), alliance: activeAlliance(), targetLabel })}`;
    setHint(`${t('messages.campaignSent', 'Масове повідомлення опубліковано')}: ${sentCount}`);
  } else {
    const safeRecipients = recipients.slice(0, 500);
    await Promise.all(safeRecipients.map(player => {
      const target = { region: regionOf(player.region) || activeRegion(), alliance: tag(player.alliance) || activeAlliance() };
      const senderRole = actorRole(target);
      return createUserNotification(player.uid, {
        type: 'site_message',
        title,
        message: body,
        region: target.region,
        alliance: target.alliance,
        actorUid: currentUser.uid,
        actorName: actorName(target),
        actorRole: senderRole,
        actorRoleText: roleLabel(senderRole),
        actorPhotoURL: currentProfile?.photoURL || currentUser?.photoURL || '',
        targetType: type,
        targetLabel,
        ...replyContext
      }).catch(error => console.warn('[WKD] message skipped', player.uid, error));
    }));
    sentCount = safeRecipients.length;
    recipientPreview = safeRecipients.slice(0, 5).map(playerLabel).join(' • ');
    setHint(`${t('messages.sent', 'Повідомлення відправлено')}: ${safeRecipients.length}`);
  }

  await saveSentMessage(firebase, {
    title,
    message: body,
    region: activeRegion(),
    alliance: activeAlliance(),
    targetType: type,
    targetLabel,
    recipientCount: sentCount,
    recipientPreview,
    ...replyContext
  }).catch(error => console.warn('[WKD] sent history skipped', error));
  rememberMessageSend();
  const bodyInput = $('#messageBodyInput');
  if (bodyInput) bodyInput.value = '';
  directReply = null;
  if (sentRowsLoaded || activeTab === 'sent') await loadSentMessagesIfNeeded({ force: true }).catch(() => null);
  render();
  window.WKD?.refreshNotifications?.();
}
function clearDirectReply() {
  directReply = null;
}
function startReply(item = {}) {
  const meta = senderMeta(item);
  if (!meta.uid) return;
  directReply = {
    uid: meta.uid,
    nickname: meta.name,
    gameNick: meta.name,
    region: meta.region || item.region || activeRegion(),
    alliance: meta.alliance || item.alliance || activeAlliance(),
    role: meta.role,
    accountRole: meta.role,
    ...replyContextFrom(item)
  };
  switchTab('compose');
  renderCompose();
  const type = $('#messageTargetType');
  if (type) type.value = 'player';
  updateComposeVisibility();
  const regionSelect = $('#messageRegionSelect');
  if (regionSelect && meta.region) regionSelect.value = meta.region;
  const allianceInput = $('#messageAllianceInput');
  if (allianceInput) allianceInput.value = meta.alliance || '';
  const playerInput = $('#messagePlayerInput');
  if (playerInput) playerInput.value = meta.name || '';
  renderPlayerList();
  const subjectInput = $('#messageSubjectInput');
  if (subjectInput && !String(subjectInput.value || '').trim()) subjectInput.value = `Re: ${item.title || t('messages.defaultSubject', 'Повідомлення')}`.slice(0, 80);
  setHint(`${t('messages.replyTo', 'Відповідь для')}: ${meta.name}`);
  $('#messageBodyInput')?.focus();
}
async function handleNotificationAction(action = '', id = '') {
  if (!id) return;
  const current = rows.find(row => row.id === id);
  if (isCampaign(current)) {
    if (action === 'delete' && !window.confirm(t('notifications.deleteConfirm', 'Видалити це повідомлення?'))) return;
    await markCampaignsSeen([current]);
    if (['archive', 'delete'].includes(action)) {
      campaignRows = campaignRows.filter(row => row.id !== id);
      mergeNotificationRows();
    } else if (action === 'read') {
      campaignRows = campaignRows.map(row => row.id === id ? { ...row, unread: false, readAtMs: Date.now() } : row);
      mergeNotificationRows();
    }
    writeCachedPageRows();
    render();
    window.WKD?.refreshNotifications?.();
    return;
  }
  if (action === 'delete' && !window.confirm(t('notifications.deleteConfirm', 'Видалити це повідомлення?'))) return;
  if (action === 'read') {
    await patchNotification(id, { readAtMs: Date.now(), unread: false });
    personalRows = personalRows.map(row => row.id === id ? { ...row, readAtMs: Date.now(), unread: false } : row);
    mergeNotificationRows();
  } else if (action === 'archive') {
    await patchNotification(id, { archived: true, readAtMs: Date.now(), unread: false });
    personalRows = personalRows.map(row => row.id === id ? { ...row, archived: true, readAtMs: Date.now(), unread: false } : row);
    mergeNotificationRows();
  } else if (action === 'delete') {
    await deleteNotificationDoc(id);
    personalRows = personalRows.filter(row => row.id !== id);
    mergeNotificationRows();
  }
  await syncNotificationSummaryFromRows();
  writeCachedPageRows();
  render();
  window.WKD?.refreshNotifications?.();
}
async function handleSentAction(action = '', id = '') {
  if (!id) return;
  if (action === 'delete' && !window.confirm(t('notifications.deleteConfirm', 'Видалити це повідомлення?'))) return;
  if (action === 'archive') await patchSentMessage(id, { archived: true });
  else if (action === 'delete') await deleteSentMessageDoc(id);
  sentRows = sentRows.map(row => action === 'archive' && row.id === id ? { ...row, archived: true } : row).filter(row => action === 'delete' ? row.id !== id : true);
  renderSentList();
}
async function clearArchive() {
  if (!currentUser) return;
  if (!window.confirm(t('notifications.clearArchiveConfirm', 'Очистити архів у цій вкладці?'))) return;
  const archivedNotifications = rows.filter(row => row.archived === true && (activeTab === 'inbox' ? isMessage(row) : activeTab === 'notifications' ? !isMessage(row) : false));
  const archivedSent = activeTab === 'sent' ? sentRows.filter(row => row.archived === true) : [];
  await Promise.all([
    ...archivedNotifications.map(row => deleteNotificationDoc(row.id)),
    ...archivedSent.map(row => deleteSentMessageDoc(row.id))
  ]);
  if (archivedNotifications.length) {
    personalRows = personalRows.filter(row => !archivedNotifications.some(item => item.id === row.id));
    mergeNotificationRows();
  }
  if (archivedSent.length) sentRows = sentRows.filter(row => !archivedSent.some(item => item.id === row.id));
  await syncNotificationSummaryFromRows();
  render();
  setStatus(t('notifications.archiveCleared', 'Архів очищено.'), 'success');
  window.WKD?.refreshNotifications?.();
}
function bindCompose() {
  if (composeReady) return;
  composeReady = true;
  $$('[data-notifications-tab]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.notificationsTab || 'notifications')));
  $$('[data-notifications-filter]').forEach(btn => btn.addEventListener('click', () => setNotificationsFilter(btn.dataset.notificationsFilter || 'active')));
  $('#notificationsRefreshBtn')?.addEventListener('click', () => manualRefreshNotificationsPage().catch(console.error));
  $('#notificationsMarkAllBtn')?.addEventListener('click', () => markAll().catch(console.error));
  $('#notificationsClearArchiveBtn')?.addEventListener('click', () => clearArchive().catch(error => {
    console.error(error);
    setStatus(t('notifications.actionFailed', 'Не вдалося виконати дію.'), 'error');
  }));
  $('#sendSiteMessageBtn')?.addEventListener('click', () => sendMessage().catch(error => { console.error(error); setHint(t('messages.sendFailed', 'Не вдалося відправити повідомлення.')); }));
  $('#messageTargetType')?.addEventListener('change', () => { clearDirectReply(); updateComposeVisibility(); renderPlayerList(); refreshRecipientSearch().catch(() => null); });
  $('#messageRegionSelect')?.addEventListener('change', () => { clearDirectReply(); const allianceInput = $('#messageAllianceInput'); if (allianceInput && !allianceInput.value) allianceInput.value = ownAlliances(activeRegion())[0] || ''; recipientSearchRows = []; renderPlayerList(); refreshRecipientSearch().catch(() => null); });
  $('#messageAllianceInput')?.addEventListener('input', () => { clearDirectReply(); renderPlayerList(); });
  $('#messagePlayerInput')?.addEventListener('input', () => { clearDirectReply(); refreshRecipientSearch().catch(() => null); });
  $('#messagePlayerInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); refreshRecipientSearch({ immediate: true }).catch(() => null); } });
  document.addEventListener('click', event => {
    const pageBtn = event.target.closest('[data-page-action]');
    if (pageBtn) {
      event.preventDefault();
      const key = ['notifications', 'inbox', 'sent'].includes(pageBtn.dataset.pageKey) ? pageBtn.dataset.pageKey : activePageKey();
      notificationPages[key] = Math.max(0, (Number(notificationPages[key]) || 0) + (pageBtn.dataset.pageAction === 'next' ? 1 : -1));
      render();
      return;
    }
    const moreBtn = event.target.closest('[data-load-more-notifications]');
    if (moreBtn) {
      event.preventDefault();
      notificationRemoteLimit = Math.min(NOTIFICATION_QUERY_LIMIT_MAX, notificationRemoteLimit + MESSAGE_PAGE_SIZE);
      load(currentUser, { force: true }).catch(error => {
        console.error(error);
        setStatus(t('notifications.loadFailed', 'Не вдалося завантажити сповіщення.'), 'error');
      });
      return;
    }
    const actionBtn = event.target.closest('[data-notification-action]');
    if (actionBtn) {
      event.preventDefault();
      handleNotificationAction(actionBtn.dataset.notificationAction, actionBtn.dataset.notificationId).catch(error => {
        console.error(error);
        setStatus(t('notifications.actionFailed', 'Не вдалося виконати дію.'), 'error');
      });
      return;
    }
    const sentBtn = event.target.closest('[data-sent-action]');
    if (sentBtn) {
      event.preventDefault();
      handleSentAction(sentBtn.dataset.sentAction, sentBtn.dataset.sentId).catch(error => {
        console.error(error);
        setStatus(t('notifications.actionFailed', 'Не вдалося виконати дію.'), 'error');
      });
      return;
    }
    const button = event.target.closest('[data-reply-id]');
    if (!button) return;
    const item = rows.find(row => row.id === button.dataset.replyId);
    if (item) startReply(item);
  });
}
function init() {
  if (pageReady) return;
  pageReady = true;
  bindCompose();
  document.addEventListener('wkd:language-changed', () => { renderCompose(); render(); });
  watchAuth(user => load(user).catch(error => { console.error(error); setStatus(t('notifications.loadFailed', 'Не вдалося завантажити сповіщення.'), 'error'); }));
}

document.addEventListener('wkd:partials-ready', init);
if (document.readyState !== 'loading') window.setTimeout(init, 0);
