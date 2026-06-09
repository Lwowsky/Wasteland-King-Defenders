import { getFirebase, watchAuth } from './services/firebase-service.js';
import { trackReads, trackWrites } from './services/usage-tracker.js?v=89';
import { formatUserDate, readUserNotificationSummary, setUserNotificationSummary } from './services/user-db.js';

const $ = selector => document.querySelector(selector);
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

let currentUser = null;
let summary = { unreadTotal: 0 };
let previewItems = [];
let previewLoaded = false;
let previewLoading = false;
let bound = false;
let authStarted = false;

function sourceKind(item = {}) {
  const role = String(item.actorRole || '').toLowerCase();
  const type = String(item.type || item.source || '').toLowerCase();
  if (item.source === 'region-status' || type.includes('region') || type.includes('registration')) return 'region';
  if (role === 'admin' || role === 'moderator') return 'admin';
  if (role === 'consul') return 'consul';
  if (role === 'officer') return 'officer';
  return 'player';
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
function cacheKey(uid = '') {
  return `wkd.notify.summary.${uid}`;
}
function normalizeSummary(raw = {}) {
  const unreadTotal = Math.max(0, Number(raw?.unreadTotal) || 0);
  return {
    unreadTotal,
    lastTitle: String(raw?.lastTitle || '').trim(),
    lastMessage: String(raw?.lastMessage || '').trim(),
    lastNotificationAtMs: Number(raw?.lastNotificationAtMs || raw?.updatedAtMs || 0) || 0
  };
}
function readCachedSummary(uid = '') {
  if (!uid) return { unreadTotal: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(cacheKey(uid)) || 'null');
    return normalizeSummary(raw || {});
  } catch (_) {
    return { unreadTotal: 0 };
  }
}
function writeCachedSummary(uid = '', value = {}) {
  if (!uid) return;
  try { localStorage.setItem(cacheKey(uid), JSON.stringify(normalizeSummary(value))); } catch (_) {}
}
function applySummary(value = {}, cache = true) {
  summary = normalizeSummary(value || {});
  if (cache && currentUser?.uid) writeCachedSummary(currentUser.uid, summary);
  render();
}
function unreadCount() {
  return Math.max(0, Number(summary?.unreadTotal) || 0);
}
function newPreviewItems() {
  return previewItems.filter(isUnread);
}
function menuOpened() {
  return $('#notifyMenu')?.classList.contains('is-open');
}
async function userNotificationPreview(firebase, uid) {
  const { db, firestoreMod } = firebase;
  const ref = firestoreMod.collection(db, 'users', uid, 'notifications');
  const q = firestoreMod.query(ref, firestoreMod.orderBy('createdAtMs', 'desc'), firestoreMod.limit(12));
  const snap = await firestoreMod.getDocs(q).catch(() => ({ docs: [] }));
  trackReads(Math.max(1, snap.docs.length));
  return snap.docs.map(doc => ({ id: doc.id, source: 'account', ...doc.data() }));
}
async function loadPreview(force = false) {
  if (!currentUser || previewLoading || (previewLoaded && !force)) return;
  previewLoading = true;
  render();
  const firebase = await getFirebase();
  if (!firebase) {
    previewLoading = false;
    render();
    return;
  }
  previewItems = await userNotificationPreview(firebase, currentUser.uid).catch(() => []);
  previewLoaded = true;
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
    const title = summary.lastTitle || t('notifications.title', 'Сповіщення');
    const message = summary.lastMessage || (unread ? t('notifications.openPage', 'Усі') : t('notifications.empty', 'Нових сповіщень немає.'));
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
  list.innerHTML = unreadPreview.slice(0, 8).map(item => `
    <div class="notify-item is-unread">
      <b>${esc(item.title || item.type || t('notifications.title', 'Сповіщення'))}</b>
      <span>${esc(item.message || item.text || item.summary || '')}</span>
      <small>${esc(sourceLabel(item))}${esc(item.actorName ? ` · ${item.actorName}` : '')}${esc(item.region ? ` · R${item.region}` : '')} · ${esc(item.createdAt ? formatUserDate(item.createdAt) : (item.createdAtMs ? new Date(item.createdAtMs).toLocaleString() : ''))}</small>
    </div>`).join('');
}
async function load(user) {
  currentUser = user || null;
  previewItems = [];
  previewLoaded = false;
  previewLoading = false;
  if (!user) {
    summary = { unreadTotal: 0 };
    render();
    return;
  }

  applySummary(readCachedSummary(user.uid), false);
  const remoteSummary = await readUserNotificationSummary(user.uid).catch(() => null);
  if (remoteSummary) applySummary(remoteSummary, true);
  else applySummary(readCachedSummary(user.uid), false);
}
async function markRead() {
  if (!currentUser) return;
  if (!previewLoaded) await loadPreview();
  const unreadPreview = newPreviewItems().filter(item => item.source === 'account' && item.id);
  if (!unreadPreview.length) return;
  const firebase = await getFirebase();
  if (!firebase) return;
  const { db, firestoreMod } = firebase;
  const batch = firestoreMod.writeBatch(db);
  const nowMs = Date.now();
  unreadPreview.forEach(item => {
    batch.set(firestoreMod.doc(db, 'users', currentUser.uid, 'notifications', item.id), { readAt: firestoreMod.serverTimestamp(), readAtMs: nowMs, unread: false }, { merge: true });
  });
  await batch.commit().catch(() => null);
  trackWrites(unreadPreview.length);
  const nextUnread = Math.max(0, unreadCount() - unreadPreview.length);
  await setUserNotificationSummary(currentUser.uid, { unreadTotal: nextUnread, updatedAtMs: nowMs }).catch(() => null);
  applySummary({ ...summary, unreadTotal: nextUnread, updatedAtMs: nowMs }, true);
  previewItems = previewItems.map(item => unreadPreview.some(row => row.id === item.id) ? { ...item, unread: false, readAtMs: nowMs } : item);
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
  if (opened) await loadPreview();
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
