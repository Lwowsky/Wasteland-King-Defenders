import { getFirebase, watchAuth } from './services/firebase-service.js';
import { getGameProfile, getUserFarms, getUserProfile, formatUserDate } from './services/user-db.js';

const $ = selector => document.querySelector(selector);
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let currentUser = null;
let items = [];
let accountItems = [];
let statusItems = [];
let unsubscribeUserNotifications = null;
let bound = false;
let authStarted = false;
function regionOf(value=''){ return String(value||'').replace(/[^0-9]/g,''); }
function profileRegions(profile={}){
  const main = getGameProfile(profile||{});
  return [...new Set([main.region, ...getUserFarms(profile||{}).map(f=>f.region)].map(regionOf).filter(Boolean))];
}
function statusKey(uid, region){ return `wkd.notify.regionStatus.${uid}.${region}`; }
function sourceKind(item = {}){
  const role = String(item.actorRole || '').toLowerCase();
  const type = String(item.type || item.source || '').toLowerCase();
  if (item.source === 'region-status' || type.includes('region') || type.includes('registration')) return 'region';
  if (role === 'admin' || role === 'moderator') return 'admin';
  if (role === 'consul') return 'consul';
  if (role === 'officer') return 'officer';
  return 'player';
}
function sourceLabel(item = {}){
  const kind = sourceKind(item);
  const labels = {
    admin: t('notifications.fromAdmin','Від адміна'),
    consul: t('notifications.fromConsul','Від консула'),
    officer: t('notifications.fromOfficer','Від офіцера'),
    region: t('notifications.fromRegion','Від регіону'),
    player: t('notifications.fromPlayer','Від гравця')
  };
  return labels[kind] || labels.player;
}
function mergeAndRender(){
  items = [...statusItems, ...accountItems]
    .filter(item => item.archived !== true)
    .sort((a,b)=>(Number(b.createdAtMs)||0)-(Number(a.createdAtMs)||0));
  render();
}
function stopNotificationWatch(){
  if (typeof unsubscribeUserNotifications === 'function') {
    try { unsubscribeUserNotifications(); } catch (_) {}
  }
  unsubscribeUserNotifications = null;
}
async function userNotifications(firebase, uid){
  const { db, firestoreMod } = firebase;
  const ref = firestoreMod.collection(db, 'users', uid, 'notifications');
  const q = firestoreMod.query(ref, firestoreMod.orderBy('createdAtMs', 'desc'), firestoreMod.limit(20));
  const snap = await firestoreMod.getDocs(q).catch(() => ({ docs: [] }));
  return snap.docs.map(doc => ({ id: doc.id, source:'account', ...doc.data() }));
}
function watchUserNotifications(firebase, uid){
  stopNotificationWatch();
  if (!firebase || !uid) return;
  const { db, firestoreMod } = firebase;
  const ref = firestoreMod.collection(db, 'users', uid, 'notifications');
  const q = firestoreMod.query(ref, firestoreMod.orderBy('createdAtMs', 'desc'), firestoreMod.limit(20));
  unsubscribeUserNotifications = firestoreMod.onSnapshot(q, snap => {
    accountItems = snap.docs.map(doc => ({ id: doc.id, source:'account', ...doc.data() }));
    mergeAndRender();
  }, error => {
    console.warn('[WKD] notifications realtime unavailable', error);
    userNotifications(firebase, uid).then(list => {
      accountItems = list;
      mergeAndRender();
    }).catch(() => null);
  });
}
async function regionStatusNotifications(firebase, user, profile){
  const { db, firestoreMod } = firebase;
  const out = [];
  for (const region of profileRegions(profile)) {
    const snap = await firestoreMod.getDoc(firestoreMod.doc(db, 'regions', region)).catch(() => null);
    if (!snap?.exists?.()) continue;
    const form = snap.data()?.registrationForm || {};
    const open = Boolean(form.enabled);
    const old = localStorage.getItem(statusKey(user.uid, region));
    const code = open ? 'open' : 'closed';
    if (old && old !== code) {
      out.push({
        id: `region-${region}-${code}`,
        source:'region-status',
        unread:true,
        region,
        title: open ? t('notifications.registrationOpen','Реєстрація відкрита') : t('notifications.registrationClosed','Реєстрація закрита'),
        message: `R${region}`,
        createdAtMs: Date.now()
      });
    }
    if (!old) localStorage.setItem(statusKey(user.uid, region), code);
  }
  return out;
}
function render(){
  const nav = $('#notifyNav');
  const count = $('#notifyCount');
  const list = $('#notifyList');
  const drawer = $('#drawerNotificationsBtn');
  const signed = Boolean(currentUser);
  if (nav) nav.hidden = !signed;
  if (drawer) drawer.hidden = !signed;
  const unread = items.filter(item => item.unread !== false && !item.readAtMs && !item.readAt).length;
  if (count) { count.hidden = !unread; count.textContent = unread > 99 ? '99+' : String(unread); }
  if (!list) return;
  if (!items.length) {
    list.innerHTML = `<div class="notify-empty">${esc(t('notifications.empty','Нових сповіщень немає.'))}</div>`;
    return;
  }
  list.innerHTML = items.slice(0, 12).map(item => `
    <div class="notify-item ${item.unread !== false && !item.readAtMs && !item.readAt ? 'is-unread' : ''}">
      <b>${esc(item.title || item.type || t('notifications.title','Сповіщення'))}</b>
      <span>${esc(item.message || item.text || item.summary || '')}</span>
      <small>${esc(sourceLabel(item))}${esc(item.actorName ? ` · ${item.actorName}` : '')}${esc(item.region ? ` · R${item.region}` : '')} · ${esc(item.createdAt ? formatUserDate(item.createdAt) : (item.createdAtMs ? new Date(item.createdAtMs).toLocaleString() : ''))}</small>
    </div>`).join('');
}
async function load(user){
  currentUser = user || null;
  if (!user) {
    stopNotificationWatch();
    accountItems = [];
    statusItems = [];
    items = [];
    render();
    return;
  }
  const firebase = await getFirebase();
  if (!firebase) return;
  const profile = await getUserProfile(user.uid).catch(() => null);
  statusItems = profile ? await regionStatusNotifications(firebase, user, profile) : [];
  accountItems = await userNotifications(firebase, user.uid);
  mergeAndRender();
  watchUserNotifications(firebase, user.uid);
}
async function markRead(){
  if (!currentUser) return;
  const firebase = await getFirebase();
  if (!firebase) return;
  const { db, firestoreMod } = firebase;
  const batch = firestoreMod.writeBatch(db);
  items.filter(item => item.source === 'account' && item.id && !item.readAt).forEach(item => {
    batch.set(firestoreMod.doc(db, 'users', currentUser.uid, 'notifications', item.id), { readAt: firestoreMod.serverTimestamp(), readAtMs: Date.now(), unread:false }, { merge:true });
  });
  const profile = await getUserProfile(currentUser.uid).catch(() => null);
  profileRegions(profile||{}).forEach(region => {
    const open = items.find(item => item.source==='region-status' && item.region === region)?.title?.includes('відкрита') ? 'open' : localStorage.getItem(statusKey(currentUser.uid, region)) || 'closed';
    localStorage.setItem(statusKey(currentUser.uid, region), open);
  });
  await batch.commit().catch(() => null);
  accountItems = accountItems.map(item => ({ ...item, unread:false, readAtMs: Date.now() }));
  statusItems = statusItems.map(item => ({ ...item, unread:false, readAtMs: Date.now() }));
  mergeAndRender();
}
function closeMenu(){
  const menu = $('#notifyMenu');
  const btn = $('#notifyBtn');
  menu?.classList.remove('is-open');
  btn?.setAttribute('aria-expanded', 'false');
}
function toggleMenu(){
  const menu = $('#notifyMenu');
  const btn = $('#notifyBtn');
  if (!menu) return;
  const opened = menu.classList.toggle('is-open');
  btn?.setAttribute('aria-expanded', opened ? 'true' : 'false');
}
function bind(){
  if (bound || !$('#notifyNav')) return;
  bound = true;
  $('#notifyBtn')?.setAttribute('aria-expanded', 'false');
  $('#notifyBtn')?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    if (!currentUser) return closeMenu();
    toggleMenu();
  });
  $('#notifyNav')?.addEventListener('click', event => event.stopPropagation());
  $('#notifyOpenPageBtn')?.addEventListener('click', () => { window.location.href = 'notifications.html'; });
  $('#drawerNotificationsBtn')?.addEventListener('click', () => { window.location.href = 'notifications.html'; });
  $('#notifyMarkReadBtn')?.addEventListener('click', () => markRead().catch(console.error));
  document.addEventListener('click', closeMenu);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  document.addEventListener('wkd:language-changed', render);
  render();
}
function init(){
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
