import { watchAuth } from '../services/firebase-service.js';
import { canUseAdminPanel, getGameProfile, getUserFarms, getUserProfile, normalizeUserRole } from '../services/user-db.js?v=008';
import { getManagedRegionOptions, listRegionActionLogs, listRegionCatalog, normalizeRegion, readRegionFromUrl, formatUserDate } from '../services/region-db.js?v=061';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const PAGE_SIZE = 20;
const ACTION_LOG_CACHE_BUILD = 'v252-manual-local';
const ACTION_LOG_CACHE_TTL_MS = 30 * 60 * 1000;
const ACTION_LOG_REFRESH_WINDOW_MS = 10 * 60 * 1000;
const ACTION_LOG_REFRESH_LIMIT = 10;
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

function actionLogCacheKey(region = '', page = 0) {
  return `wkd.actionLog.rows.${ACTION_LOG_CACHE_BUILD}.${normalizeRegion(region) || 'none'}.${Math.max(0, Number(page) || 0)}`;
}
function readActionLogCache(region = '', page = 0) {
  try {
    const raw = localStorage.getItem(actionLogCacheKey(region, page));
    const data = raw ? JSON.parse(raw) : null;
    if (!data || data.build !== ACTION_LOG_CACHE_BUILD) return null;
    if (Date.now() - Number(data.savedAtMs || 0) > ACTION_LOG_CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}
function writeActionLogCache(region = '', page = 0, payload = {}) {
  try {
    localStorage.setItem(actionLogCacheKey(region, page), JSON.stringify({
      build: ACTION_LOG_CACHE_BUILD,
      region: normalizeRegion(region),
      page: Math.max(0, Number(page) || 0),
      savedAtMs: Date.now(),
      rows: Array.isArray(payload.rows) ? payload.rows : [],
      nextCursorMs: Number(payload.nextCursorMs || 0) || 0,
      hasMore: Boolean(payload.hasMore)
    }));
  } catch {}
}
function showActionLogCache(region = '') {
  const cached = readActionLogCache(region, 0);
  currentRegion = normalizeRegion(region || currentRegion || cached?.region || '');
  if (cached?.rows) {
    rows = cached.rows;
    hasMore = Boolean(cached.hasMore);
    pageIndex = 0;
    pageStack = [{ rows, nextCursorMs: cached.nextCursorMs || 0, hasMore }];
    setStatus(t('actionLog.loadedFromCache', 'Попередню сторінку показано з кешу.'), 'success');
  } else {
    rows = [];
    resetPages();
    setStatus(t('actionLog.manualOpenHint', 'Журнал не завантажується автоматично. Натисни “Відкрити”, щоб оновити з D1.'), 'muted');
  }
  render();
}
function actionLogRefreshAllowed(region = '') {
  const key = `wkd.actionLog.refreshHistory.${ACTION_LOG_CACHE_BUILD}.${normalizeRegion(region) || 'none'}`;
  let history = [];
  try { history = JSON.parse(localStorage.getItem(key) || '[]'); } catch { history = []; }
  const now = Date.now();
  history = (Array.isArray(history) ? history : []).filter(time => now - Number(time) < ACTION_LOG_REFRESH_WINDOW_MS);
  if (history.length >= ACTION_LOG_REFRESH_LIMIT) {
    try { localStorage.setItem(key, JSON.stringify(history)); } catch {}
    return false;
  }
  history.push(now);
  try { localStorage.setItem(key, JSON.stringify(history)); } catch {}
  return true;
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
  return false;
}
function renderCleanupActions() {
  const box = $('#actionLogCleanupActions');
  if (box) box.hidden = true;
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
  if (!actionLogRefreshAllowed(targetRegion)) {
    setStatus(t('actionLog.refreshLimited', 'Оновлення обмежено: максимум 10 разів за 10 хвилин для цього регіону.'), 'warn');
    loadingPage = false;
    renderPager();
    return;
  }
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
    writeActionLogCache(currentRegion, pageIndex, pageStack[pageIndex]);
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
  currentProfile = await getUserProfile(user.uid).catch(() => null);
  if (canUseAdminPanel(user, currentProfile) && ['admin','moderator'].includes(String(currentProfile?.role || '').toLowerCase())) {
    regionOptions = await listRegionCatalog({ includeInactive: true, skipPublicPlayers: true }).catch(() => []);
  } else {
    regionOptions = getManagedRegionOptions(currentProfile || {}, user).map(region => ({ region }));
  }
  currentRegion = resolveTargetRegion(region || readStoredRegion());
  rememberRegion(currentRegion);
  renderRegionList();
  showActionLogCache(currentRegion);
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
  document.addEventListener('wkd:language-changed', render);
}
function init() {
  if (ready) return;
  ready = true;
  bind();
  watchAuth(user => load(user).catch(console.error));
}
document.addEventListener('wkd:partials-ready', init);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
} else {
  setTimeout(init, 0);
}
