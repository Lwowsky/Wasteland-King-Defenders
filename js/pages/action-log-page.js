import { watchAuth } from '../services/firebase-service.js';
import { saveSignedInUser } from '../services/user-db.js';
import { listRegionActionLogs, normalizeRegion, readRegionFromUrl, formatUserDate } from '../services/region-db.js?v=51';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
let currentUser = null;
let currentRegion = '';
let rows = [];
let ready = false;

function setStatus(text, type = 'muted') {
  const box = $('#actionLogStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}
function actionLabel(action = '', fallback = '') {
  const key = `actionLog.type.${action}`;
  return t(key, fallback || action || '—');
}
function render() {
  $('#actionLogRegionPill') && ($('#actionLogRegionPill').textContent = currentRegion ? `R${currentRegion}` : 'R—');
  $('#actionLogRegionInput') && ($('#actionLogRegionInput').value = currentRegion || '');
  const body = $('#actionLogBody');
  if (!body) return;
  body.innerHTML = rows.length ? rows.map(row => `
    <tr>
      <td>${esc(formatUserDate(row.createdAt) || (row.createdAtMs ? new Date(row.createdAtMs).toLocaleString() : '—'))}</td>
      <td>${esc(actionLabel(row.action, row.actionLabel))}</td>
      <td><span class="region-starter-name">${esc(row.actorName || '—')}</span></td>
      <td>${window.WKD?.Badges?.alliance ? window.WKD.Badges.alliance(row.alliance || row.actorAlliance || '—', { region: currentRegion }) : esc(row.alliance || row.actorAlliance || '—')}</td>
      <td>${esc(row.summary || row.targetName || '—')}</td>
    </tr>`).join('') : `<tr><td colspan="5">${esc(t('actionLog.empty', 'Дій поки немає.'))}</td></tr>`;
}
async function load(user, region = '') {
  currentUser = user;
  if (!user) {
    setStatus(t('actionLog.authRequired', 'Увійди через Google, щоб переглянути журнал.'), 'warn');
    return;
  }
  await saveSignedInUser(user).catch(() => null);
  const result = await listRegionActionLogs(user, region || readRegionFromUrl()).catch(error => {
    console.error(error);
    setStatus(t('actionLog.accessDenied', 'Немає доступу до журналу цього регіону.'), 'error');
    return null;
  });
  if (!result) return;
  currentRegion = result.region;
  rows = result.rows || [];
  setStatus(t('actionLog.loaded', 'Журнал дій оновлено.'), 'success');
  render();
}
function bind() {
  $('#actionLogOpenBtn')?.addEventListener('click', () => load(currentUser, normalizeRegion($('#actionLogRegionInput')?.value || '')).catch(console.error));
  $('#actionLogRegionInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') load(currentUser, normalizeRegion(event.currentTarget.value)).catch(console.error); });
  document.addEventListener('wkd:language-changed', render);
}
function init() {
  if (ready) return;
  ready = true;
  bind();
  watchAuth(user => load(user).catch(console.error));
}
document.addEventListener('wkd:partials-ready', init);
document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
