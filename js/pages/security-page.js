import { watchAuth } from '../services/firebase-service.js';
import { saveSignedInUser } from '../services/user-db.js';
import { getSecurityOverview, cleanupOldEmailFields } from '../services/region-db.js?v=192';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
let overview = null;
let ready = false;
let loadedOnce = false;
let currentUser = null;
const SECURITY_CACHE_TTL_MS = 5 * 60 * 1000;
const SECURITY_CACHE_VERSION = 'v145';

function securityCacheKey(user) {
  return `wkd.securityOverview.${SECURITY_CACHE_VERSION}:${user?.uid || 'anonymous'}`;
}

function readSecurityCache(user) {
  try {
    const raw = localStorage.getItem(securityCacheKey(user));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || Date.now() - Number(parsed.savedAt || 0) > SECURITY_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch (_) {
    return null;
  }
}

function writeSecurityCache(user, data) {
  try {
    localStorage.setItem(securityCacheKey(user), JSON.stringify({ savedAt: Date.now(), data }));
  } catch (_) {}
}

function clearSecurityCache(user) {
  try { localStorage.removeItem(securityCacheKey(user)); } catch (_) {}
}
function setStatus(text, type = 'muted') {
  const box = $('#securityStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}
function card(title, value, note, type = '') {
  return `<article class="security-card ${esc(type)}"><span>${esc(title)}</span><b>${esc(value)}</b><small>${esc(note)}</small></article>`;
}
function render() {
  const grid = $('#securityGrid');
  if (!grid || !overview) return;
  grid.innerHTML = [
    card(t('security.regions', 'Регіони'), overview.regions ?? 0, t('security.regionsHelp', 'Активні документи регіонів у базі.')),
    card(t('security.openForms', 'Відкриті форми'), overview.openForms ?? 0, t('security.openFormsHelp', 'Форми, які зараз приймають заявки.')),
    card(t('security.secretPlans', 'Секретні плани'), overview.publicPlanLinks ?? 0, t('security.secretPlansHelp', 'Публічні фінальні плани доступні тільки за секретним посиланням.')),
    card(t('security.emailFields', 'Старі email-поля'), overview.oldEmailFields ?? 0, t('security.emailFieldsHelp', 'Email краще тримати тільки у профілі користувача.'), overview.oldEmailFields ? 'is-warn' : 'is-good')
  ].join('');
  const advice = $('#securityAdvice');
  if (advice) {
    const extra = overview.oldEmailFields ? `<br><br>${esc(t('security.emailCleanupHint', 'Є старі email-поля. Admin може очистити їх кнопкою нижче.'))}` : '';
    advice.innerHTML = `<b>${esc(t('security.adviceTitle', 'Рекомендації'))}</b><br>${esc(t('security.adviceText', 'Email має зберігатися тільки в users/{uid}. У регіональних заявках, статистиці та публічному плані краще залишати тільки нік, альянс, регіон і бойові дані.'))}${extra}`;
  }
  const actions = $('#securityActions');
  if (actions) actions.hidden = !Number(overview.oldEmailFields || 0);
}
async function handleCleanupEmails() {
  if (!currentUser) return;
  const ok = !window.WKD?.confirmDialog || await window.WKD.confirmDialog({
    title: t('security.cleanupEmails', 'Очистити старі email-поля'),
    message: t('security.cleanupConfirm', 'Email-поля будуть прибрані з документів регіонів. Профілі користувачів не зміняться.'),
    acceptText: t('common.clear', 'Очистити'),
    cancelText: t('common.cancel', 'Скасувати')
  });
  if (!ok) return;
  setStatus(t('security.cleaning', 'Очищаю старі email-поля...'), 'muted');
  const result = await cleanupOldEmailFields(currentUser);
  setStatus(`${t('security.cleaned', 'Очищено регіонів')}: ${result.cleaned || 0}`, 'success');
  clearSecurityCache(currentUser);
  overview = await getSecurityOverview(currentUser);
  writeSecurityCache(currentUser, overview);
  render();
}
function shouldLoadImmediately() {
  const adminPanel = document.querySelector('[data-admin-panel="security"]');
  return !adminPanel || adminPanel.classList.contains('is-active') || /security\.html$/i.test(location.pathname);
}
async function load(user, { force = false } = {}) {
  currentUser = user || currentUser || null;
  if (!currentUser) { setStatus(t('security.authRequired', 'Увійди через Google.'), 'warn'); return; }
  if (loadedOnce && !force) return;
  loadedOnce = true;
  const cached = !force ? readSecurityCache(currentUser) : null;
  if (cached) {
    overview = cached;
    setStatus(t('security.cached', 'Показано перевірку з локального кешу. Відкрий вкладку пізніше або очисти кеш браузера, щоб перевірити знову.'), 'muted');
    render();
    return;
  }
  await saveSignedInUser(currentUser).catch(() => null);
  try {
    overview = await getSecurityOverview(currentUser);
    writeSecurityCache(currentUser, overview);
    setStatus(t('security.loaded', 'Перевірку завершено.'), 'success');
    render();
  } catch (error) {
    console.error(error);
    setStatus(t('security.adminOnly', 'Цю сторінку бачить тільки Admin або Moderator.'), 'error');
  }
}
function init() {
  if (ready) return;
  ready = true;
  document.addEventListener('wkd:language-changed', render);
  document.addEventListener('wkd:security-load', () => load(currentUser).catch(console.error));
  $('#cleanupEmailFieldsBtn')?.addEventListener('click', () => handleCleanupEmails().catch(error => { console.error(error); setStatus(t('security.cleanupFailed', 'Не вдалося очистити email-поля.'), 'error'); }));
  watchAuth(user => {
    currentUser = user || null;
    if (shouldLoadImmediately()) load(user).catch(console.error);
    else setStatus(t('security.lazyNote', 'Відкрий вкладку Безпека, щоб запустити перевірку без зайвих Firebase reads.'), 'muted');
  });
}
document.addEventListener('wkd:partials-ready', init);
document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
