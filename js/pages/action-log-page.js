import { watchAuth } from '../services/firebase-service.js';
import { canUseAdminPanel, getGameProfile, getUserFarms, getUserProfile, normalizeUserRole, saveSignedInUser } from '../services/user-db.js?v=114';
import { clearRegionActionLogs, deleteRegionActionLog, deleteRegionActionLogs, getManagedRegionOptions, listRegionActionLogs, listRegionCatalog, normalizeRegion, readRegionFromUrl, formatUserDate } from '../services/region-db.js?v=114';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const PAGE_SIZE = 20;
const ACTION_LOG_REGION_KEY = 'wkd.actionLog.activeRegion';
const GLOBAL_ACTIVE_REGION_KEY = 'wkd.players.activeRegion';
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


function readStoredRegion() {
  try {
    return normalizeRegion(localStorage.getItem(ACTION_LOG_REGION_KEY) || localStorage.getItem(GLOBAL_ACTIVE_REGION_KEY) || '');
  } catch (_) {
    return '';
  }
}
function rememberRegion(region = '') {
  const safe = normalizeRegion(region);
  if (!safe) return;
  try {
    localStorage.setItem(ACTION_LOG_REGION_KEY, safe);
    localStorage.setItem(GLOBAL_ACTIVE_REGION_KEY, safe);
  } catch (_) {}
}
function firstAllowedRegion() {
  return normalizeRegion(regionOptions[0]?.region || regionOptions[0]?.id || regionOptions[0] || '');
}
function resolveTargetRegion(region = '') {
  return normalizeRegion(region || currentRegion || readRegionFromUrl() || readStoredRegion() || firstAllowedRegion());
}

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
function profileRegions(profile = {}) {
  const main = getGameProfile(profile || {});
  return [main, ...getUserFarms(profile || {})].map(game => normalizeRegion(game.region || '')).filter(Boolean);
}
function canDeleteLogs() {
  if (!currentUser || !currentProfile || !currentRegion) return false;
  const role = normalizeUserRole(currentProfile.role || 'player');
  if (['admin', 'moderator'].includes(role)) return true;
  const regionRole = normalizeUserRole(currentProfile.regionRoles?.[currentRegion] || '');
  if (regionRole === 'consul') return true;
  return role === 'consul' && profileRegions(currentProfile).includes(normalizeRegion(currentRegion));
}
function renderCleanupActions() {
  const box = $('#actionLogCleanupActions');
  if (!box) return;
  const allowed = canDeleteLogs();
  box.hidden = !allowed;
  box.querySelectorAll('button').forEach(btn => { btn.disabled = !allowed || loadingPage; });
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
  const deleteAllowed = canDeleteLogs();
  body.innerHTML = rows.length ? rows.map(row => `
    <tr>
      <td>${esc(formatUserDate(row.createdAt) || (row.createdAtMs ? new Date(row.createdAtMs).toLocaleString() : '—'))}</td>
      <td>${esc(actionLabel(row.action, row.actionLabel))}</td>
      <td><span class="region-starter-name">${esc(row.actorName || '—')}</span></td>
      <td>${window.WKD?.Badges?.alliance ? window.WKD.Badges.alliance(row.alliance || row.actorAlliance || '—', { region: currentRegion }) : esc(row.alliance || row.actorAlliance || '—')}</td>
      <td>${esc(row.summary || row.targetName || '—')}</td>
      <td>${deleteAllowed ? `<button class="btn btn-danger-soft" type="button" data-action-log-delete="${esc(row.id || '')}">${esc(t('actionLog.delete', 'Видалити'))}</button>` : '—'}</td>
    </tr>`).join('') : `<tr><td colspan="6">${esc(t('actionLog.empty', 'Дій поки немає.'))}</td></tr>`;
  renderPager();
  renderCleanupActions();
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
  const targetRegion = resolveTargetRegion(region);
  const cursorMs = direction === 'next' ? Number(pageStack[pageIndex]?.nextCursorMs) || 0 : 0;
  try {
    const result = await listRegionActionLogs(currentUser, targetRegion, { limitCount: PAGE_SIZE, cursorMs });
    if (direction === 'next' && !result.rows?.length) {
      hasMore = false;
      setStatus(t('actionLog.noMore', 'Більше записів немає.'), 'muted');
      return;
    }
    currentRegion = result.region;
    rememberRegion(currentRegion);
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
async function deleteLogEntry(logId = '') {
  if (!canDeleteLogs() || !logId) return;
  if (!window.confirm(t('actionLog.deleteConfirm', 'Видалити цю дію з журналу?'))) return;
  await deleteRegionActionLog(currentUser, currentRegion, logId);
  rows = rows.filter(row => row.id !== logId);
  pageStack[pageIndex] = { ...(pageStack[pageIndex] || {}), rows };
  setStatus(t('actionLog.deleted', 'Запис видалено.'), 'success');
  render();
}
async function clearVisibleLogs() {
  if (!canDeleteLogs() || !rows.length) return;
  if (!window.confirm(t('actionLog.clearPageConfirm', 'Видалити всі записи на цій сторінці?'))) return;
  const result = await deleteRegionActionLogs(currentUser, currentRegion, rows.map(row => row.id).filter(Boolean));
  resetPages();
  await loadPage(currentRegion, 'reset');
  setStatus(t('actionLog.clearDone', 'Журнал очищено.') + ` (${result.deleted || 0})`, 'success');
}
async function clearOldLogs() {
  if (!canDeleteLogs()) return;
  if (!window.confirm(t('actionLog.clearOldConfirm', 'Видалити записи журналу старші 30 днів?'))) return;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const result = await clearRegionActionLogs(currentUser, currentRegion, { olderThanMs: cutoff, limitCount: 500 });
  resetPages();
  await loadPage(currentRegion, 'reset');
  setStatus((result.hasMore ? t('actionLog.clearMore', 'Очищено частину записів. Натисни ще раз, якщо треба продовжити.') : t('actionLog.clearDone', 'Журнал очищено.')) + ` (${result.deleted || 0})`, 'success');
}
async function clearRegionLogs() {
  if (!canDeleteLogs()) return;
  if (!window.confirm(t('actionLog.clearRegionConfirm', 'Видалити журнал дій цього регіону? Це не можна скасувати.'))) return;
  const result = await clearRegionActionLogs(currentUser, currentRegion, { limitCount: 500 });
  resetPages();
  await loadPage(currentRegion, 'reset');
  setStatus((result.hasMore ? t('actionLog.clearMore', 'Очищено частину записів. Натисни ще раз, якщо треба продовжити.') : t('actionLog.clearDone', 'Журнал очищено.')) + ` (${result.deleted || 0})`, 'success');
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
  await loadPage(region || readStoredRegion(), 'reset');
}
function bind() {
  $('#actionLogOpenBtn')?.addEventListener('click', () => { const region = normalizeRegion($('#actionLogRegionInput')?.value || ''); rememberRegion(region); load(currentUser, region).catch(console.error); });
  $('#actionLogRegionInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') { const region = normalizeRegion(event.currentTarget.value); rememberRegion(region); load(currentUser, region).catch(console.error); } });
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
  $('#actionLogClearPageBtn')?.addEventListener('click', () => clearVisibleLogs().catch(error => { console.error(error); setStatus(t('actionLog.accessDenied', 'Немає доступу до журналу цього регіону.'), 'error'); }));
  $('#actionLogClearOldBtn')?.addEventListener('click', () => clearOldLogs().catch(error => { console.error(error); setStatus(t('actionLog.accessDenied', 'Немає доступу до журналу цього регіону.'), 'error'); }));
  $('#actionLogClearRegionBtn')?.addEventListener('click', () => clearRegionLogs().catch(error => { console.error(error); setStatus(t('actionLog.accessDenied', 'Немає доступу до журналу цього регіону.'), 'error'); }));
  document.addEventListener('click', event => {
    const btn = event.target.closest('[data-action-log-delete]');
    if (!btn) return;
    event.preventDefault();
    deleteLogEntry(btn.dataset.actionLogDelete || '').catch(error => { console.error(error); setStatus(t('actionLog.accessDenied', 'Немає доступу до журналу цього регіону.'), 'error'); });
  });
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
