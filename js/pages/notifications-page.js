import { getFirebase, watchAuth } from '../services/firebase-service.js';
import { formatUserDate } from '../services/user-db.js';
const $ = selector => document.querySelector(selector);
const t = (key, fallback='') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let currentUser = null;
let rows = [];
function setStatus(text, type='muted') { const box=$('#notificationsStatus'); if(!box)return; box.removeAttribute('data-i18n'); box.textContent=text; box.dataset.type=type; }
function render(){
  const list = $('#notificationsPageList');
  if (!list) return;
  list.innerHTML = rows.length ? rows.map(item => `
    <article class="notify-item ${item.unread !== false && !item.readAt ? 'is-unread' : ''}">
      <b>${esc(item.title || t('notifications.title','Сповіщення'))}</b>
      <span>${esc(item.message || item.summary || '')}</span>
      <small>${esc(item.region ? `R${item.region} · ` : '')}${esc(formatUserDate(item.createdAt) || (item.createdAtMs ? new Date(item.createdAtMs).toLocaleString() : ''))}</small>
    </article>`).join('') : `<div class="notify-empty">${esc(t('notifications.empty','Нових сповіщень немає.'))}</div>`;
}
async function load(user){
  currentUser = user || null;
  if (!user) { setStatus(t('notifications.authRequired','Увійди через Google.'),'warn'); return; }
  const firebase = await getFirebase();
  if (!firebase) return;
  const { db, firestoreMod } = firebase;
  const ref = firestoreMod.collection(db, 'users', user.uid, 'notifications');
  const q = firestoreMod.query(ref, firestoreMod.orderBy('createdAtMs','desc'), firestoreMod.limit(100));
  const snap = await firestoreMod.getDocs(q).catch(() => ({ docs: [] }));
  rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  setStatus(t('notifications.loaded','Сповіщення оновлено.'),'success');
  render();
}
async function markAll(){
  if (!currentUser) return;
  const firebase = await getFirebase();
  if (!firebase) return;
  const { db, firestoreMod } = firebase;
  const batch = firestoreMod.writeBatch(db);
  rows.filter(row => row.id && !row.readAt).forEach(row => batch.set(firestoreMod.doc(db, 'users', currentUser.uid, 'notifications', row.id), { readAt: firestoreMod.serverTimestamp(), readAtMs: Date.now(), unread:false }, { merge:true }));
  await batch.commit().catch(() => null);
  rows = rows.map(row => ({ ...row, unread:false, readAtMs: Date.now() }));
  render();
  window.WKD?.refreshNotifications?.();
}
function init(){
  $('#notificationsMarkAllBtn')?.addEventListener('click', () => markAll().catch(console.error));
  document.addEventListener('wkd:language-changed', render);
  watchAuth(user => load(user).catch(error => { console.error(error); setStatus(t('notifications.loadFailed','Не вдалося завантажити сповіщення.'),'error'); }));
}
document.addEventListener('wkd:partials-ready', init);
document.addEventListener('DOMContentLoaded', () => setTimeout(init,0));
