import { watchAuth } from '../services/firebase-service.js';
import { saveSignedInUser } from '../services/user-db.js';
import { getSecurityOverview, cleanupOldEmailFields } from '../services/region-db.js?v=115';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
let overview = null;
let ready = false;
let currentUser = null;
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
  overview = await getSecurityOverview(currentUser);
  render();
}
async function load(user) {
  currentUser = user || null;
  if (!user) { setStatus(t('security.authRequired', 'Увійди через Google.'), 'warn'); return; }
  await saveSignedInUser(user).catch(() => null);
  try {
    overview = await getSecurityOverview(user);
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
  $('#cleanupEmailFieldsBtn')?.addEventListener('click', () => handleCleanupEmails().catch(error => { console.error(error); setStatus(t('security.cleanupFailed', 'Не вдалося очистити email-поля.'), 'error'); }));
  watchAuth(user => load(user).catch(console.error));
}
document.addEventListener('wkd:partials-ready', init);
document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
