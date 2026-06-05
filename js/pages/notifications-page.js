import { getFirebase, watchAuth } from '../services/firebase-service.js';
import { createUserNotification, formatUserDate, getGameProfile, getUserFarms, getUserProfile, listPublicPlayers, normalizeUserRole } from '../services/user-db.js';

const $ = selector => document.querySelector(selector);
const t = (key, fallback='') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const regionOf = value => String(value || '').replace(/[^0-9]/g, '');
const tag = value => Array.from(String(value || '').trim().toUpperCase().replace(/[^A-Z0-9А-ЯІЇЄҐ]/gi, '')).slice(0,3).join('');
let currentUser = null;
let currentProfile = null;
let rows = [];
let publicPlayers = [];
let composeReady = false;

function setStatus(text, type='muted') { const box=$('#notificationsStatus'); if(!box)return; box.removeAttribute('data-i18n'); box.textContent=text; box.dataset.type=type; }
function playerGames(profile = currentProfile || {}) {
  const main = getGameProfile(profile || {});
  return [{ ...main, farmId:'main', role: normalizeUserRole(profile?.role || main.role || 'player') }, ...getUserFarms(profile || {})];
}
function ownRegions() { return [...new Set(playerGames().map(game => regionOf(game.region)).filter(Boolean))]; }
function ownAlliances(region = '') {
  const r = regionOf(region);
  return [...new Set(playerGames().filter(game => !r || regionOf(game.region) === r).map(game => tag(game.alliance)).filter(Boolean))];
}
function isGlobalManager() { const role = normalizeUserRole(currentProfile?.role || 'player'); return role === 'admin' || role === 'moderator' || String(currentUser?.email || '').toLowerCase() === 'vovapotaychuk@gmail.com'; }
function role() { return normalizeUserRole(currentProfile?.role || 'player'); }
function targetOptions() {
  const r = role();
  if (isGlobalManager()) return [
    ['admins', t('messages.targetAdmins','Адміни і модератори')],
    ['all', t('messages.targetAll','Усі гравці')],
    ['region', t('messages.targetRegion','Регіон')],
    ['alliance', t('messages.targetAlliance','Альянс')],
    ['player', t('messages.targetPlayer','Гравець')]
  ];
  if (r === 'consul') return [
    ['region', t('messages.targetMyRegion','Усі у моєму регіоні')],
    ['consuls', t('messages.targetConsuls','Консули')],
    ['officers', t('messages.targetOfficers','Офіцери')],
    ['alliance', t('messages.targetMyAlliance','Мій альянс')],
    ['player', t('messages.targetPlayer','Гравець')]
  ];
  if (r === 'officer') return [
    ['region', t('messages.targetMyRegion','Усі у моєму регіоні')],
    ['officers', t('messages.targetOfficers','Офіцери')],
    ['alliance', t('messages.targetMyAlliance','Мій альянс')],
    ['player', t('messages.targetPlayer','Гравець')]
  ];
  return [
    ['alliance', t('messages.targetMyAlliance','Мій альянс')],
    ['player', t('messages.targetPlayer','Гравець')]
  ];
}
function regionOptions() {
  if (isGlobalManager()) return [...new Set(publicPlayers.map(p => regionOf(p.region)).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  return ownRegions();
}
function setHint(text = '') { const el = $('#messageSendHint'); if (el) el.textContent = text; }
function render(){
  const list = $('#notificationsPageList');
  if (!list) return;
  list.innerHTML = rows.length ? rows.map(item => `
    <article class="notify-item ${item.unread !== false && !item.readAt ? 'is-unread' : ''}">
      <b>${esc(item.title || t('notifications.title','Сповіщення'))}</b>
      <span>${esc(item.message || item.summary || '')}</span>
      <small>${esc(item.region ? `R${item.region} · ` : '')}${esc(item.actorName ? `${item.actorName} · ` : '')}${esc(formatUserDate(item.createdAt) || (item.createdAtMs ? new Date(item.createdAtMs).toLocaleString() : ''))}</small>
    </article>`).join('') : `<div class="notify-empty">${esc(t('notifications.empty','Нових сповіщень немає.'))}</div>`;
}
function renderCompose(){
  const box = $('#notificationsCompose');
  if (!box || !currentUser) return;
  box.hidden = false;
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
function updateComposeVisibility(){
  const type = $('#messageTargetType')?.value || 'player';
  $('#messageRegionWrap') && ($('#messageRegionWrap').hidden = !['region','alliance','consuls','officers'].includes(type) && !isGlobalManager());
  $('#messageAllianceWrap') && ($('#messageAllianceWrap').hidden = type !== 'alliance');
  $('#messagePlayerWrap') && ($('#messagePlayerWrap').hidden = type !== 'player');
}
function renderPlayerList(){
  const datalist = $('#messagePlayerList');
  if (!datalist) return;
  const allowed = filteredRecipients('player', { preview: true });
  datalist.innerHTML = allowed.map(p => `<option value="${esc(playerLabel(p))}"></option>`).join('');
}
function playerLabel(player = {}) { return `${player.nickname || player.gameNick || '—'} · R${regionOf(player.region) || '—'} · ${tag(player.alliance) || '—'}`; }
function actorName(){ return getGameProfile(currentProfile || {}).nickname || currentUser?.displayName || currentUser?.email || '—'; }
function activeRegion(){ return $('#messageRegionSelect')?.value || ownRegions()[0] || ''; }
function activeAlliance(){ return tag($('#messageAllianceInput')?.value || ownAlliances(activeRegion())[0] || ''); }
function canReachPlayer(player = {}) {
  if (isGlobalManager()) return true;
  const r = regionOf(player.region);
  const a = tag(player.alliance);
  const myRegions = ownRegions();
  const myAlliances = ownAlliances(r);
  if (role() === 'consul' || role() === 'officer') return myRegions.includes(r);
  return myRegions.includes(r) && myAlliances.includes(a);
}
function filteredRecipients(type = $('#messageTargetType')?.value || 'player', options = {}) {
  const region = activeRegion();
  const alliance = activeAlliance();
  const selectedPlayer = String($('#messagePlayerInput')?.value || '').trim().toLowerCase();
  let list = publicPlayers.filter(p => p.uid && p.profileComplete !== false && p.uid !== currentUser?.uid);
  if (type === 'admins') list = list.filter(p => ['admin','moderator'].includes(normalizeUserRole(p.role || 'player')));
  else if (type === 'all') list = isGlobalManager() ? list : [];
  else if (type === 'region') list = list.filter(p => regionOf(p.region) === region && (isGlobalManager() || ownRegions().includes(region)));
  else if (type === 'consuls') list = list.filter(p => regionOf(p.region) === region && normalizeUserRole(p.role || 'player') === 'consul' && (isGlobalManager() || ownRegions().includes(region)));
  else if (type === 'officers') list = list.filter(p => regionOf(p.region) === region && normalizeUserRole(p.role || 'player') === 'officer' && (isGlobalManager() || ownRegions().includes(region)));
  else if (type === 'alliance') list = list.filter(p => regionOf(p.region) === region && tag(p.alliance) === alliance && (isGlobalManager() || ownAlliances(region).includes(alliance) || ['consul','officer'].includes(role())));
  else if (type === 'player' && !options.preview) list = list.filter(p => playerLabel(p).toLowerCase() === selectedPlayer || String(p.nickname || p.gameNick || '').toLowerCase() === selectedPlayer);
  if (!isGlobalManager()) list = list.filter(canReachPlayer);
  const seen = new Map();
  list.forEach(p => { if (p.uid && !seen.has(p.uid)) seen.set(p.uid, p); });
  return [...seen.values()];
}
async function load(user){
  currentUser = user || null;
  if (!user) { setStatus(t('notifications.authRequired','Увійди через Google.'),'warn'); return; }
  const firebase = await getFirebase();
  if (!firebase) return;
  currentProfile = await getUserProfile(user.uid).catch(() => null);
  publicPlayers = await listPublicPlayers().catch(() => []);
  const { db, firestoreMod } = firebase;
  const ref = firestoreMod.collection(db, 'users', user.uid, 'notifications');
  const q = firestoreMod.query(ref, firestoreMod.orderBy('createdAtMs','desc'), firestoreMod.limit(100));
  const snap = await firestoreMod.getDocs(q).catch(() => ({ docs: [] }));
  rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  setStatus(t('notifications.loaded','Сповіщення оновлено.'),'success');
  renderCompose();
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
async function sendMessage(){
  if (!currentUser || !currentProfile) return;
  const title = String($('#messageSubjectInput')?.value || t('messages.defaultSubject','Повідомлення')).trim().slice(0,80) || t('messages.defaultSubject','Повідомлення');
  const body = String($('#messageBodyInput')?.value || '').trim().slice(0,600);
  if (!body) { setHint(t('messages.emptyBody','Напиши текст повідомлення.')); return; }
  const type = $('#messageTargetType')?.value || 'player';
  const recipients = filteredRecipients(type);
  if (!recipients.length) { setHint(t('messages.noRecipients','Немає отримувачів для цього вибору.')); return; }
  setHint(t('messages.sending','Відправляю...'));
  const region = activeRegion();
  const alliance = activeAlliance();
  await Promise.all(recipients.slice(0, 500).map(player => createUserNotification(player.uid, {
    type: 'site_message',
    title,
    message: body,
    region: regionOf(player.region) || region,
    alliance: tag(player.alliance) || alliance,
    actorUid: currentUser.uid,
    actorName: actorName()
  }).catch(error => console.warn('[WKD] message skipped', player.uid, error))));
  $('#messageBodyInput') && ($('#messageBodyInput').value = '');
  setHint(`${t('messages.sent','Повідомлення відправлено')}: ${recipients.length}`);
}
function bindCompose(){
  if (composeReady) return;
  composeReady = true;
  $('#notificationsMarkAllBtn')?.addEventListener('click', () => markAll().catch(console.error));
  $('#sendSiteMessageBtn')?.addEventListener('click', () => sendMessage().catch(error => { console.error(error); setHint(t('messages.sendFailed','Не вдалося відправити повідомлення.')); }));
  $('#messageTargetType')?.addEventListener('change', () => { updateComposeVisibility(); renderPlayerList(); });
  $('#messageRegionSelect')?.addEventListener('change', () => { $('#messageAllianceInput') && ($('#messageAllianceInput').value = ownAlliances(activeRegion())[0] || ''); renderPlayerList(); });
  $('#messageAllianceInput')?.addEventListener('input', renderPlayerList);
}
function init(){
  bindCompose();
  document.addEventListener('wkd:language-changed', () => { renderCompose(); render(); });
  watchAuth(user => load(user).catch(error => { console.error(error); setStatus(t('notifications.loadFailed','Не вдалося завантажити сповіщення.'),'error'); }));
}
document.addEventListener('wkd:partials-ready', init);
document.addEventListener('DOMContentLoaded', () => setTimeout(init,0));
