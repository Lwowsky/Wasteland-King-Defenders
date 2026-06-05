import { getFirebase, watchAuth } from '../services/firebase-service.js';
import { listRegionCatalog } from '../services/region-db.js?v=54';
import {
  canUseAdminPanel,
  createUserNotification,
  formatUserDate,
  getGameProfile,
  getUserFarms,
  getUserProfile,
  listPublicPlayers,
  listRegisteredUsers,
  normalizeUserRole,
  roleLabel
} from '../services/user-db.js';

const $ = selector => document.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const regionOf = value => String(value || '').replace(/[^0-9]/g, '');
const tag = value => Array.from(String(value || '').trim().toUpperCase().replace(/[^A-Z0-9А-ЯІЇЄҐ]/gi, '')).slice(0, 3).join('');

let currentUser = null;
let currentProfile = null;
let rows = [];
let directory = [];
let composeReady = false;
let activeTab = 'notifications';
let knownRegionOptions = [];
let directReply = null;

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
    const fromDirectory = directoryGames().map(p => regionOf(p.region)).filter(Boolean);
    return [...new Set([...fromCatalog, ...fromDirectory, ...ownRegions()])].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
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
function filteredRecipients(type = $('#messageTargetType')?.value || 'player', options = {}) {
  if (!options.preview && directReply?.uid && type === 'player') return [directReply];
  const region = activeRegion();
  const alliance = activeAlliance();
  const selectedPlayer = String($('#messagePlayerInput')?.value || '').trim().toLowerCase();
  let list = directoryGames();
  if (type === 'admins') list = list.filter(p => ['admin', 'moderator'].includes(normalizeUserRole(p.accountRole || p.role || 'player')));
  else if (type === 'all') list = isGlobalManager() ? list : [];
  else if (type === 'region') list = list.filter(p => regionOf(p.region) === region && (isGlobalManager() || ownRegions().includes(region)));
  else if (type === 'consuls') list = list.filter(p => regionOf(p.region) === region && normalizeUserRole(p.role || p.accountRole || 'player') === 'consul' && (isGlobalManager() || ownRegions().includes(region)));
  else if (type === 'officers') list = list.filter(p => regionOf(p.region) === region && normalizeUserRole(p.role || p.accountRole || 'player') === 'officer' && (isGlobalManager() || ownRegions().includes(region)));
  else if (type === 'alliance') list = list.filter(p => regionOf(p.region) === region && tag(p.alliance) === alliance && (isGlobalManager() || ownAlliances(region).includes(alliance) || ['consul', 'officer'].includes(role())));
  else if (type === 'player' && !options.preview) list = list.filter(p => {
    const label = playerLabel(p).toLowerCase();
    const nick = String(p.nickname || p.gameNick || '').toLowerCase();
    return label === selectedPlayer || nick === selectedPlayer || (selectedPlayer && label.includes(selectedPlayer));
  });
  if (!isGlobalManager()) list = list.filter(canReachPlayer);
  return options.preview ? list : dedupeAccounts(list);
}
function isMessage(item = {}) {
  return item.type === 'site_message';
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
  const notices = rows.filter(item => !isMessage(item));
  list.innerHTML = notices.length ? notices.map(item => `
    <article class="notify-item ${item.unread !== false && !item.readAt ? 'is-unread' : ''}">
      <b>${esc(item.title || t('notifications.title', 'Сповіщення'))}</b>
      <span>${esc(item.message || item.summary || '')}</span>
      <small>${esc(item.region ? `R${item.region} · ` : '')}${esc(item.actorName ? `${item.actorName} · ` : '')}${esc(dateText(item))}</small>
    </article>`).join('') : `<div class="notify-empty">${esc(t('notifications.empty', 'Нових сповіщень немає.'))}</div>`;
}
function renderMessageList() {
  const list = $('#notificationsInboxList');
  if (!list) return;
  const messages = rows.filter(isMessage);
  list.innerHTML = messages.length ? messages.map(item => {
    const meta = senderMeta(item);
    const unread = item.unread !== false && !item.readAt;
    return `
      <article class="site-message-card ${unread ? 'is-unread' : ''}">
        <div class="site-message-main">
          ${renderAvatar(meta)}
          <div class="site-message-content">
            <div class="site-message-sender">
              <strong>${esc(meta.name)}</strong>
              <span class="role-badge role-${esc(meta.role)}">${esc(meta.roleText)}</span>
            </div>
            <small>${esc(meta.region ? `R${meta.region}` : 'R—')} · ${esc(meta.alliance || '—')} · ${esc(dateText(item))}</small>
            <h3>${esc(item.title || t('messages.defaultSubject', 'Повідомлення'))}</h3>
            <p>${esc(item.message || item.summary || '')}</p>
          </div>
        </div>
        ${meta.uid ? `<button class="btn site-message-reply" type="button" data-reply-id="${esc(item.id || '')}" data-i18n="messages.reply">${esc(t('messages.reply', 'Відповісти'))}</button>` : ''}
      </article>`;
  }).join('') : `<div class="notify-empty">${esc(t('notifications.noMessages', 'Отриманих повідомлень немає.'))}</div>`;
}
function render() {
  renderNoticeList();
  renderMessageList();
}
function renderPlayerList() {
  const datalist = $('#messagePlayerList');
  if (!datalist) return;
  const allowed = filteredRecipients('player', { preview: true });
  const seen = new Set();
  datalist.innerHTML = allowed.map(p => playerLabel(p)).filter(label => {
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  }).map(label => `<option value="${esc(label)}"></option>`).join('');
}
function updateComposeVisibility() {
  const type = $('#messageTargetType')?.value || 'player';
  $('#messageRegionWrap') && ($('#messageRegionWrap').hidden = !['region', 'alliance', 'consuls', 'officers'].includes(type));
  $('#messageAllianceWrap') && ($('#messageAllianceWrap').hidden = type !== 'alliance');
  $('#messagePlayerWrap') && ($('#messagePlayerWrap').hidden = type !== 'player');
}
function switchTab(tab = 'notifications') {
  activeTab = ['notifications', 'inbox', 'compose'].includes(tab) ? tab : 'notifications';
  $('#notificationsNotices') && ($('#notificationsNotices').hidden = activeTab !== 'notifications');
  $('#notificationsInbox') && ($('#notificationsInbox').hidden = activeTab !== 'inbox');
  $('#notificationsCompose') && ($('#notificationsCompose').hidden = activeTab !== 'compose');
  $$('[data-notifications-tab]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.notificationsTab === activeTab));
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
  const [privateUsers, publicUsers, catalog] = await Promise.all([
    isManager() ? listRegisteredUsers().catch(error => { console.warn('[WKD] private user directory unavailable, public fallback used', error); return []; }) : Promise.resolve([]),
    listPublicPlayers().catch(() => []),
    isGlobalManager() ? listRegionCatalog({ includeInactive: true }).catch(() => []) : Promise.resolve([])
  ]);
  knownRegionOptions = Array.isArray(catalog) ? catalog : [];
  const byUid = new Map();
  [...(Array.isArray(publicUsers) ? publicUsers : []), ...(Array.isArray(privateUsers) ? privateUsers : [])].forEach(item => {
    const uid = item.uid || item.id;
    if (!uid) return;
    byUid.set(uid, { ...(byUid.get(uid) || {}), ...item, uid });
  });
  if (currentUser && currentProfile) byUid.set(currentUser.uid, { ...(byUid.get(currentUser.uid) || {}), ...currentProfile, uid: currentUser.uid });
  return [...byUid.values()];
}
async function load(user) {
  currentUser = user || null;
  if (!user) {
    setStatus(t('notifications.authRequired', 'Увійди через Google.'), 'warn');
    setTimeout(() => { window.location.href = 'login.html'; }, 800);
    return;
  }
  const firebase = await getFirebase();
  if (!firebase) return;
  currentProfile = await getUserProfile(user.uid).catch(() => null);
  directory = await loadDirectory();
  const { db, firestoreMod } = firebase;
  const ref = firestoreMod.collection(db, 'users', user.uid, 'notifications');
  const q = firestoreMod.query(ref, firestoreMod.orderBy('createdAtMs', 'desc'), firestoreMod.limit(100));
  const snap = await firestoreMod.getDocs(q).catch(() => ({ docs: [] }));
  rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  setStatus(t('notifications.loaded', 'Сповіщення оновлено.'), 'success');
  renderCompose();
  switchTab(activeTab);
  render();
}
async function markAll() {
  if (!currentUser) return;
  const firebase = await getFirebase();
  if (!firebase) return;
  const { db, firestoreMod } = firebase;
  const batch = firestoreMod.writeBatch(db);
  rows.filter(row => row.id && !row.readAt).forEach(row => batch.set(firestoreMod.doc(db, 'users', currentUser.uid, 'notifications', row.id), { readAt: firestoreMod.serverTimestamp(), readAtMs: Date.now(), unread: false }, { merge: true }));
  await batch.commit().catch(() => null);
  rows = rows.map(row => ({ ...row, unread: false, readAtMs: Date.now() }));
  render();
  window.WKD?.refreshNotifications?.();
}
async function sendMessage() {
  if (!currentUser || !currentProfile) return;
  const title = String($('#messageSubjectInput')?.value || t('messages.defaultSubject', 'Повідомлення')).trim().slice(0, 80) || t('messages.defaultSubject', 'Повідомлення');
  const body = String($('#messageBodyInput')?.value || '').trim().slice(0, 600);
  if (!body) { setHint(t('messages.emptyBody', 'Напиши текст повідомлення.')); return; }
  const type = $('#messageTargetType')?.value || 'player';
  const recipients = filteredRecipients(type);
  if (!recipients.length) {
    const region = activeRegion();
    setHint(region ? `${t('messages.noRecipients', 'Немає отримувачів для цього вибору.')} R${region}` : t('messages.noRegionSelected', 'Вибери регіон або гравця.'));
    return;
  }
  setHint(t('messages.sending', 'Відправляю...'));
  await Promise.all(recipients.slice(0, 500).map(player => {
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
      actorPhotoURL: currentProfile?.photoURL || currentUser?.photoURL || ''
    }).catch(error => console.warn('[WKD] message skipped', player.uid, error));
  }));
  const bodyInput = $('#messageBodyInput');
  if (bodyInput) bodyInput.value = '';
  directReply = null;
  setHint(`${t('messages.sent', 'Повідомлення відправлено')}: ${recipients.length}`);
  await load(currentUser).catch(() => null);
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
    accountRole: meta.role
  };
  switchTab('compose');
  renderCompose();
  const type = $('#messageTargetType');
  if (type) type.value = 'player';
  updateComposeVisibility();
  const playerInput = $('#messagePlayerInput');
  if (playerInput) playerInput.value = meta.label || meta.name;
  const subjectInput = $('#messageSubjectInput');
  if (subjectInput && !String(subjectInput.value || '').trim()) subjectInput.value = `Re: ${item.title || t('messages.defaultSubject', 'Повідомлення')}`.slice(0, 80);
  setHint(`${t('messages.replyTo', 'Відповідь для')}: ${meta.name}`);
  $('#messageBodyInput')?.focus();
}
function bindCompose() {
  if (composeReady) return;
  composeReady = true;
  $$('[data-notifications-tab]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.notificationsTab || 'notifications')));
  $('#notificationsMarkAllBtn')?.addEventListener('click', () => markAll().catch(console.error));
  $('#sendSiteMessageBtn')?.addEventListener('click', () => sendMessage().catch(error => { console.error(error); setHint(t('messages.sendFailed', 'Не вдалося відправити повідомлення.')); }));
  $('#messageTargetType')?.addEventListener('change', () => { clearDirectReply(); updateComposeVisibility(); renderPlayerList(); });
  $('#messageRegionSelect')?.addEventListener('change', () => { clearDirectReply(); const allianceInput = $('#messageAllianceInput'); if (allianceInput) allianceInput.value = ownAlliances(activeRegion())[0] || ''; renderPlayerList(); });
  $('#messageAllianceInput')?.addEventListener('input', () => { clearDirectReply(); renderPlayerList(); });
  $('#messagePlayerInput')?.addEventListener('input', clearDirectReply);
  $('#notificationsInboxList')?.addEventListener('click', event => {
    const button = event.target.closest('[data-reply-id]');
    if (!button) return;
    const item = rows.find(row => row.id === button.dataset.replyId);
    if (item) startReply(item);
  });
}
function init() {
  bindCompose();
  document.addEventListener('wkd:language-changed', () => { renderCompose(); render(); });
  watchAuth(user => load(user).catch(error => { console.error(error); setStatus(t('notifications.loadFailed', 'Не вдалося завантажити сповіщення.'), 'error'); }));
}

document.addEventListener('wkd:partials-ready', init);
if (document.readyState !== 'loading') window.setTimeout(init, 0);
