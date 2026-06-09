import { watchAuth } from '../services/firebase-service.js';
import { canUseAdminPanel, getUserProfile, saveSignedInUser } from '../services/user-db.js';
import { getManagedRegionOptions, listRegionActionLogs, listRegionCatalog, normalizeRegion, readRegionFromUrl, formatUserDate } from '../services/region-db.js?v=110';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const PAGE_SIZE = 20;
let currentUser = null;
let currentRegion = '';
let rows = [];
let currentProfile = null;
let regionOptions = [];
let ready = false;
let pageIndex = 0;
let pageStack = [];
let hasMore = false;
let loadingPage = false;

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
function renderRegionList() {
  const list = $('#actionLogRegionList');
  if (!list) return;
  list.innerHTML = regionOptions.map(item => {
    const region = normalizeRegion(item.region || item.id || item);
    const label = String(item.name || item.nickname || '').trim();
    return region ? `<option value="${esc(region)}">R${esc(region)}${label ? ` · ${esc(label)}` : ''}</option>` : '';
  }).join('');
}
function renderPager() {
  const pageText = $('#actionLogPageText');
  const prevBtn = $('#actionLogPrevBtn');
  const nextBtn = $('#actionLogNextBtn');
  if (pageText) pageText.textContent = t('actionLog.page', 'Сторінка {page}').replace('{page}', String(pageIndex + 1));
  if (prevBtn) prevBtn.disabled = loadingPage || pageIndex <= 0;
  if (nextBtn) nextBtn.disabled = loadingPage || !hasMore;
}
function render() {
  $('#actionLogRegionPill') && ($('#actionLogRegionPill').textContent = currentRegion ? `R${currentRegion}` : 'R—');
  $('#actionLogRegionInput') && ($('#actionLogRegionInput').value = currentRegion || '');
  renderRegionList();
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
  renderPager();
}
function resetPages() {
  pageIndex = 0;
  pageStack = [];
  hasMore = false;
}
async function loadPage(region = '', direction = 'reset') {
  if (!currentUser || loadingPage) return;
  loadingPage = true;
  renderPager();
  const targetRegion = normalizeRegion(region || currentRegion || readRegionFromUrl() || regionOptions[0]?.region || regionOptions[0]?.id || '');
  const cursorMs = direction === 'next' ? Number(pageStack[pageIndex]?.nextCursorMs) || 0 : 0;
  try {
    const result = await listRegionActionLogs(currentUser, targetRegion, { limitCount: PAGE_SIZE, cursorMs });
    if (direction === 'next' && !result.rows?.length) {
      hasMore = false;
      setStatus(t('actionLog.noMore', 'Більше записів немає.'), 'muted');
      return;
    }
    currentRegion = result.region;
    rows = result.rows || [];
    currentProfile = result.profile || currentProfile;
    hasMore = Boolean(result.hasMore);
    if (direction === 'next') pageIndex += 1;
    else pageIndex = 0;
    pageStack[pageIndex] = { rows, nextCursorMs: result.nextCursorMs || 0, hasMore };
    pageStack = pageStack.slice(0, pageIndex + 1);
    const messageKey = rows.length < PAGE_SIZE ? 'actionLog.loadedLastPage' : 'actionLog.loaded';
    setStatus(t(messageKey, messageKey === 'actionLog.loadedLastPage' ? 'Завантажено останні записи.' : 'Журнал дій оновлено.'), 'success');
  } catch (error) {
    console.error(error);
    setStatus(t('actionLog.accessDenied', 'Немає доступу до журналу цього регіону.'), 'error');
  } finally {
    loadingPage = false;
    render();
  }
}
async function load(user, region = '') {
  currentUser = user;
  resetPages();
  if (!user) {
    setStatus(t('actionLog.authRequired', 'Увійди через Google, щоб переглянути журнал.'), 'warn');
    rows = [];
    render();
    return;
  }
  await saveSignedInUser(user).catch(() => null);
  currentProfile = await getUserProfile(user.uid).catch(() => null);
  if (canUseAdminPanel(user, currentProfile) && ['admin','moderator'].includes(String(currentProfile?.role || '').toLowerCase())) {
    regionOptions = await listRegionCatalog({ includeInactive: true }).catch(() => []);
  } else {
    regionOptions = getManagedRegionOptions(currentProfile || {}, user).map(region => ({ region }));
  }
  await loadPage(region, 'reset');
}
function bind() {
  $('#actionLogOpenBtn')?.addEventListener('click', () => load(currentUser, normalizeRegion($('#actionLogRegionInput')?.value || '')).catch(console.error));
  $('#actionLogRegionInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') load(currentUser, normalizeRegion(event.currentTarget.value)).catch(console.error); });
  $('#actionLogPrevBtn')?.addEventListener('click', () => {
    if (pageIndex <= 0) return;
    pageIndex -= 1;
    const page = pageStack[pageIndex] || { rows: [], hasMore: false };
    rows = page.rows || [];
    hasMore = true;
    setStatus(t('actionLog.loadedFromCache', 'Попередню сторінку показано з кешу.'), 'success');
    render();
  });
  $('#actionLogNextBtn')?.addEventListener('click', () => loadPage(currentRegion, 'next').catch(console.error));
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
