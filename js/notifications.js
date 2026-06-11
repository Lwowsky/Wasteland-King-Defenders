import { watchAuth } from './services/firebase-service.js';
import {
  formatUserDate,
  getUserProfile,
  listRegionNotificationCampaignsForProfile,
  listUserNotifications,
  markUserNotificationsRead,
  readUserNotificationSummary,
  setUserNotificationSummary
} from './services/user-db.js?v=149';

const $ = selector => document.querySelector(selector);
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const tv = (key, vars = {}, fallback = '') => window.WKD_tv ? window.WKD_tv(key, vars, fallback) : (fallback || t(key, key));
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

let currentUser = null;
let currentProfile = null;
let summary = { unreadTotal: 0, campaignUnreadTotal: 0, campaignSeenAtMs: 0 };
let previewItems = [];
let campaignPreviewItems = [];
let previewLoaded = false;
let previewLoading = false;
let previewLoadedAtMs = 0;
let campaignPreviewSavedAtMs = 0;
let bound = false;
let authStarted = false;
const NOTIFY_REMOTE_CACHE_TTL_MS = 60 * 1000;

function campaignVars(item = {}) {
  return {
    region: item.region || '',
    actor: item.actorName || t('notifications.fromRegion', 'Від регіону'),
    target: item.targetLabel || (item.region ? `R${item.region}` : '')
  };
}
function itemTitle(item = {}) {
  if (item.titleKey) return tv(item.titleKey, campaignVars(item), item.title || t('notifications.title', 'Сповіщення'));
  return item.title || item.type || t('notifications.title', 'Сповіщення');
}
function itemMessage(item = {}) {
  if (item.messageKey) return tv(item.messageKey, campaignVars(item), item.message || item.summary || '');
  return item.message || item.text || item.summary || '';
}
function sourceKind(item = {}) {
  const role = String(item.actorRole || '').toLowerCase();
  const type = String(item.type || item.source || '').toLowerCase();
  if ((item.source === 'campaign' && type !== 'site_message_campaign') || item.source === 'region-status' || type.includes('region') || type.includes('registration')) return 'region';
  if (role === 'admin' || role === 'moderator') return 'admin';
  if (role === 'consul') return 'consul';
  if (role === 'officer') return 'officer';
  return 'player';
}
function isCampaign(item = {}) {
  const source = String(item.source || '').toLowerCase();
  const type = String(item.type || '').toLowerCase();
  return source.includes('campaign') || type === 'site_message_campaign' || type.startsWith('registration_') || type === 'registration_notice' || type === 'region_status';
}
function sourceLabel(item = {}) {
  const kind = sourceKind(item);
  const labels = {
    admin: t('notifications.fromAdmin', 'Від адміна'),
    consul: t('notifications.fromConsul', 'Від консула'),
    officer: t('notifications.fromOfficer', 'Від офіцера'),
    region: t('notifications.fromRegion', 'Від регіону'),
    player: t('notifications.fromPlayer', 'Від гравця')
  };
  return labels[kind] || labels.player;
}
function isUnread(item = {}) {
  return item.unread !== false && !item.readAtMs && !item.readAt;
}
function createdMs(item = {}) {
  return Number(item.createdAtMs) || item.createdAt?.toMillis?.() || item.createdAt?.toDate?.()?.getTime?.() || 0;
}
function isHiddenOldReadMessage(item = {}) {
  const ms = createdMs(item);
  return item.type === 'site_message' && ms > 0 && ms < Date.now() - 30 * 24 * 60 * 60 * 1000 && !isUnread(item);
}
function cacheKey(uid = '') {
  return `wkd.notify.summary.${uid}`;
}
function normalizeSummary(raw = {}) {
  const unreadTotal = Math.max(0, Number(raw?.unreadTotal) || 0);
  const campaignUnreadTotal = Math.max(0, Number(raw?.campaignUnreadTotal) || 0);
  return {
    unreadTotal,
    campaignUnreadTotal,
    campaignSeenAtMs: Math.max(0, Number(raw?.campaignSeenAtMs) || 0),
    lastTitle: String(raw?.lastTitle || '').trim(),
    lastMessage: String(raw?.lastMessage || '').trim(),
    lastNotificationAtMs: Number(raw?.lastNotificationAtMs || raw?.updatedAtMs || 0) || 0,
    cachedAtMs: Number(raw?.cachedAtMs || 0) || 0
  };
}
function readCachedSummary(uid = '') {
  if (!uid) return { unreadTotal: 0, campaignUnreadTotal: 0, campaignSeenAtMs: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(cacheKey(uid)) || 'null');
    return normalizeSummary(raw || {});
  } catch (_) {
    return { unreadTotal: 0, campaignUnreadTotal: 0, campaignSeenAtMs: 0 };
  }
}
function writeCachedSummary(uid = '', value = {}) {
  if (!uid) return;
  try { localStorage.setItem(cacheKey(uid), JSON.stringify({ ...normalizeSummary(value), cachedAtMs: Date.now() })); } catch (_) {}
}
function isFreshCachedSummary(value = {}) {
  const cachedAtMs = Number(value?.cachedAtMs) || 0;
  return cachedAtMs > 0 && (Date.now() - cachedAtMs) < NOTIFY_REMOTE_CACHE_TTL_MS;
}
function campaignCacheKey(uid = '') {
  return `wkd.notify.campaignPreview.${uid}`;
}
function profileCampaignCacheScope(profile = {}) {
  const games = [profile?.gameProfile || {}, ...(Array.isArray(profile?.farms) ? profile.farms : [])]
    .map(item => `${String(item?.region || '').replace(/[^0-9]/g, '')}:${String(item?.alliance || '').trim()}`)
    .filter(value => value !== ':')
    .sort();
  return `${String(profile?.role || 'player')}:${games.join('|')}`;
}
function readCachedCampaignPreview(uid = '', seenAtMs = 0, scope = '') {
  if (!uid) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(campaignCacheKey(uid)) || 'null');
    if (!raw || (Date.now() - Number(raw.savedAtMs || 0)) > NOTIFY_REMOTE_CACHE_TTL_MS) return null;
    if (Number(raw.seenAtMs || 0) !== Number(seenAtMs || 0)) return null;
    if (String(raw.scope || '') !== String(scope || '')) return null;
    const rows = Array.isArray(raw.rows) ? raw.rows : [];
    return rows.map(item => ({ ...item, unread: createdMs(item) > Number(seenAtMs || 0) }));
  } catch (_) {
    return null;
  }
}
function writeCachedCampaignPreview(uid = '', seenAtMs = 0, scope = '', rows = []) {
  if (!uid) return;
  try {
    localStorage.setItem(campaignCacheKey(uid), JSON.stringify({ savedAtMs: Date.now(), seenAtMs: Number(seenAtMs) || 0, scope: String(scope || ''), rows: Array.isArray(rows) ? rows.slice(0, 5) : [] }));
  } catch (_) {}
}
function clearCachedCampaignPreview(uid = '') {
  campaignPreviewSavedAtMs = 0;
  try { if (uid) localStorage.removeItem(campaignCacheKey(uid)); } catch (_) {}
}
function applySummary(value = {}, cache = true) {
  summary = normalizeSummary(value || {});
  if (cache && currentUser?.uid) writeCachedSummary(currentUser.uid, summary);
  render();
}
function unreadCount() {
  return Math.max(0, Number(summary?.unreadTotal) || 0) + Math.max(0, Number(summary?.campaignUnreadTotal) || 0);
}
function newPreviewItems() {
  return previewItems.filter(isUnread);
}
async function userNotificationPreview(uid) {
  return listUserNotifications(uid, 12).then(list => list.map(item => ({ source: item.source || 'account', ...item })).filter(item => !isHiddenOldReadMessage(item)));
}
async function refreshCampaignPreview(force = false) {
  if (!currentUser || !currentProfile) return [];
  if (campaignPreviewItems.length && !force && campaignPreviewSavedAtMs > 0 && Date.now() - campaignPreviewSavedAtMs < NOTIFY_REMOTE_CACHE_TTL_MS) return campaignPreviewItems;
  const seenAtMs = Number(summary?.campaignSeenAtMs) || 0;
  const scope = profileCampaignCacheScope(currentProfile);
  if (!force) {
    const cached = readCachedCampaignPreview(currentUser.uid, seenAtMs, scope);
    if (cached) {
      campaignPreviewItems = cached;
      campaignPreviewSavedAtMs = Date.now();
      return campaignPreviewItems;
    }
  }
  campaignPreviewItems = await listRegionNotificationCampaignsForProfile(currentProfile, {
    sinceMs: seenAtMs,
    perRegionLimit: 5,
    totalLimit: 5
  }).then(list => list.map(item => ({ ...item, unread: createdMs(item) > seenAtMs }))).catch(() => []);
  campaignPreviewSavedAtMs = Date.now();
  writeCachedCampaignPreview(currentUser.uid, seenAtMs, scope, campaignPreviewItems);
  return campaignPreviewItems;
}
async function loadPreview(force = false) {
  const previewFresh = previewLoaded && previewLoadedAtMs > 0 && Date.now() - previewLoadedAtMs < NOTIFY_REMOTE_CACHE_TTL_MS;
  if (!currentUser || previewLoading || (previewFresh && !force)) return;
  previewLoading = true;
  render();
  const [personal, campaigns] = await Promise.all([
    userNotificationPreview(currentUser.uid).catch(() => []),
    refreshCampaignPreview(force).catch(() => [])
  ]);
  previewItems = [...personal, ...campaigns].sort((a, b) => (Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0));
  previewLoaded = true;
  previewLoadedAtMs = Date.now();
  previewLoading = false;
  render();
}
function render() {
  const nav = $('#notifyNav');
  const count = $('#notifyCount');
  const list = $('#notifyList');
  const drawer = $('#drawerNotificationsBtn');
  const markBtn = $('#notifyMarkReadBtn');
  const signed = Boolean(currentUser);
  if (nav) nav.hidden = !signed;
  if (drawer) drawer.hidden = !signed;

  const unread = unreadCount();
  if (count) {
    count.hidden = !unread;
    count.textContent = unread > 99 ? '99+' : String(unread);
  }
  if (markBtn) markBtn.hidden = !signed || !unread || !previewLoaded || !newPreviewItems().length;
  if (!list) return;

  if (previewLoading) {
    list.innerHTML = `<div class="notify-empty">${esc(t('notifications.loading', 'Завантажую сповіщення...'))}</div>`;
    return;
  }
  if (!previewLoaded) {
    const newestCampaign = campaignPreviewItems[0] || null;
    const title = newestCampaign ? itemTitle(newestCampaign) : (summary.lastTitle || t('notifications.title', 'Сповіщення'));
    const message = newestCampaign ? itemMessage(newestCampaign) : (summary.lastMessage || (unread ? t('notifications.openPage', 'Усі') : t('notifications.empty', 'Нових сповіщень немає.')));
    list.innerHTML = unread
      ? `<div class="notify-item is-unread"><b>${esc(title)}</b><span>${esc(message)}</span></div>`
      : `<div class="notify-empty">${esc(t('notifications.empty', 'Нових сповіщень немає.'))}</div>`;
    return;
  }

  const unreadPreview = newPreviewItems();
  if (!unreadPreview.length) {
    list.innerHTML = `<div class="notify-empty">${esc(t('notifications.empty', 'Нових сповіщень немає.'))}</div>`;
    return;
  }
  list.innerHTML = unreadPreview.slice(0, 5).map(item => `
    <div class="notify-item is-unread">
      <b>${esc(itemTitle(item))}</b>
      <span>${esc(itemMessage(item))}</span>
      <small>${esc(sourceLabel(item))}${esc(item.actorName ? ` · ${item.actorName}` : '')}${esc(item.region ? ` · R${item.region}` : '')} · ${esc(item.createdAt ? formatUserDate(item.createdAt) : (item.createdAtMs ? new Date(item.createdAtMs).toLocaleString() : ''))}</small>
    </div>`).join('');
}
async function load(user, options = {}) {
  const sameUser = Boolean(currentUser?.uid && user?.uid && currentUser.uid === user.uid);
  const shouldResetPreview = !sameUser || Boolean(options?.forceRemote);
  currentUser = user || null;
  currentProfile = null;
  if (shouldResetPreview) {
    previewItems = [];
    campaignPreviewItems = [];
    previewLoaded = false;
    previewLoading = false;
    previewLoadedAtMs = 0;
    campaignPreviewSavedAtMs = 0;
  }
  if (!user) {
    summary = { unreadTotal: 0, campaignUnreadTotal: 0, campaignSeenAtMs: 0 };
    render();
    return;
  }

  const cachedSummary = readCachedSummary(user.uid);
  applySummary(cachedSummary, false);
  const shouldUseCachedSummary = !options?.forceRemote && isFreshCachedSummary(cachedSummary);
  const [remoteSummary, profile] = await Promise.all([
    shouldUseCachedSummary ? Promise.resolve(cachedSummary) : readUserNotificationSummary(user.uid).catch(() => null),
    getUserProfile(user.uid).catch(() => null)
  ]);
  currentProfile = profile || null;
  const baseSummary = normalizeSummary(remoteSummary || cachedSummary);
  applySummary(baseSummary, !shouldUseCachedSummary);
  campaignPreviewItems = currentProfile ? await refreshCampaignPreview(Boolean(options?.forceRemote)) : [];
  applySummary({ ...baseSummary, campaignUnreadTotal: campaignPreviewItems.filter(isUnread).length }, true);
}
async function markRead() {
  if (!currentUser) return;
  if (!previewLoaded) await loadPreview();
  const unreadPreview = newPreviewItems();
  const unreadPersonal = unreadPreview.filter(item => !isCampaign(item) && item.id);
  const unreadCampaigns = unreadPreview.filter(isCampaign);
  if (!unreadPersonal.length && !unreadCampaigns.length) return;
  const nowMs = Date.now();
  if (unreadPersonal.length) {
    await markUserNotificationsRead(currentUser.uid, unreadPersonal.map(item => item.id)).catch(() => null);
  }
  const nextUnread = Math.max(0, (Number(summary?.unreadTotal) || 0) - unreadPersonal.length);
  const nextCampaignSeen = unreadCampaigns.reduce((max, item) => Math.max(max, Number(item.createdAtMs) || 0), Number(summary?.campaignSeenAtMs) || 0);
  await setUserNotificationSummary(currentUser.uid, { unreadTotal: nextUnread, campaignSeenAtMs: nextCampaignSeen, updatedAtMs: nowMs }).catch(() => null);
  clearCachedCampaignPreview(currentUser.uid);
  applySummary({ ...summary, unreadTotal: nextUnread, campaignUnreadTotal: 0, campaignSeenAtMs: nextCampaignSeen, updatedAtMs: nowMs }, true);
  previewItems = previewItems.map(item => unreadPreview.some(row => row.id === item.id && (row.source === item.source || isCampaign(row) === isCampaign(item))) ? { ...item, unread: false, readAtMs: nowMs } : item);
  campaignPreviewItems = campaignPreviewItems.map(item => ({ ...item, unread: false, readAtMs: nowMs }));
  render();
}
function closeMenu() {
  const menu = $('#notifyMenu');
  const btn = $('#notifyBtn');
  menu?.classList.remove('is-open');
  btn?.setAttribute('aria-expanded', 'false');
}
async function toggleMenu() {
  const menu = $('#notifyMenu');
  const btn = $('#notifyBtn');
  if (!menu) return;
  const opened = menu.classList.toggle('is-open');
  btn?.setAttribute('aria-expanded', opened ? 'true' : 'false');
  if (opened) {
    await load(currentUser).catch(() => null);
    await loadPreview(false);
  }
}
function bind() {
  if (bound || !$('#notifyNav')) return;
  bound = true;
  $('#notifyBtn')?.setAttribute('aria-expanded', 'false');
  $('#notifyBtn')?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    if (!currentUser) return closeMenu();
    toggleMenu().catch(console.error);
  });
  $('#notifyNav')?.addEventListener('click', event => event.stopPropagation());
  $('#notifyOpenPageBtn')?.addEventListener('click', () => { window.location.href = 'notifications.html'; });
  $('#notifyCloseBtn')?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
  });
  $('#drawerNotificationsBtn')?.addEventListener('click', () => { window.location.href = 'notifications.html'; });
  $('#notifyMarkReadBtn')?.addEventListener('click', () => markRead().catch(console.error));
  document.addEventListener('click', closeMenu);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  document.addEventListener('wkd:language-changed', render);
  render();
}
function init() {
  bind();
  if (authStarted) return;
  authStarted = true;
  watchAuth(user => load(user).catch(console.error));
}

document.addEventListener('wkd:partials-ready', init);
if (document.readyState !== 'loading') window.setTimeout(init, 0);
window.WKD = window.WKD || {};
window.WKD.initNotifications = init;
window.WKD.refreshNotifications = () => load(currentUser).catch(console.error);
