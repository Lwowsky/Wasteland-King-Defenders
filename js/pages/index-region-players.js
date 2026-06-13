import { watchAuth } from '../services/firebase-service.js';
import { getGameProfile, getUserFarms, getUserProfile, isProfileComplete, normalizeUserRole } from '../services/user-db.js';
import { canDeleteRegionRegistration, canManageRegion, commitLocalImportRegionLock, deleteRegionRegistrations, getManagedRegionOptions, getRegionTowerPlan, importLocalPlayersToRegion, listRegionCatalog, listRegionRegistrations, normalizeRegion, readLocalImportRegionLock, regionRegistrationToPlayer, saveRegionTowerPlan, updateRegionRegistration, listRegionAlliances } from '../services/region-db.js?v=194';

const REGION_SOURCE = 'regionForm';
const SOURCE_KEY = 'wkd.players.sourceMode';
const REGION_KEY = 'wkd.players.activeRegion';
const MODES = ['local', 'region'];
const LOCAL_IMPORT_RATE_KEY = 'wkd.players.localToRegion.runs';
const LOCAL_IMPORT_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const LOCAL_IMPORT_RATE_LIMIT = 1;
// TEST MODE: local-to-region transfer cooldown is disabled temporarily.
const LOCAL_IMPORT_RATE_DISABLED = true;
const LOCAL_IMPORT_PREVIEW_CACHE_KEY = 'wkd.players.localToRegion.preview';
const LOCAL_IMPORT_PREVIEW_CACHE_TTL_MS = 10 * 60 * 1000;

let currentUser = null;
let currentProfile = null;
let currentMode = normalizeMode(localStorage.getItem(SOURCE_KEY) || 'local');
let loadedRegionRows = [];
let loadedRegion = '';
let loadingRegion = false;
let loadingRegionKey = '';
let regionLoadRequestId = 0;
let loadedRegionAlliances = [];
let controllerReady = false;

const allianceTag3 = value => window.WKD?.allianceTag3 ? window.WKD.allianceTag3(value) : Array.from(String(value ?? '').trim().replace(/[\/\[\]#?]/g, '')).slice(0, 3).join('');
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const esc = value => String(value ?? '').replace(/[&<>'\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const tv = (key, fallback = '', vars = {}) => {
  let text = t(key, fallback);
  Object.entries(vars || {}).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, String(value));
  });
  return text;
};

function formatRemainingTime(ms = 0) {
  const totalMinutes = Math.max(0, Math.ceil(Number(ms || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const restHours = hours % 24;
    return `${days} д ${restHours} год`;
  }
  if (hours > 0) return `${hours} год ${minutes} хв`;
  return `${minutes || 1} хв`;
}

function normalizeDuplicateNick(value = '') {
  let text = String(value ?? '').trim();
  try { text = text.normalize('NFKC'); } catch (_error) {}
  return text.replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeMode(mode) {
  return MODES.includes(mode) ? mode : 'local';
}

function sourcePanel() {
  return $('#playersSourcePanel');
}

function sourceButtons() {
  return $$('[data-source-mode]');
}

function noteBox() {
  return $('#indexModeNote');
}

function sourceHelp() {
  return $('#playersSourceHelp');
}

function localToRegionButton() {
  return $('#copyLocalToRegionBtn');
}

function regionToLocalButton() {
  return $('#copyRegionToLocalBtn');
}

function setSourcePanelVisible(visible) {
  const panel = sourcePanel();
  if (panel) panel.hidden = !visible;
}

function setNote(text, type = 'muted') {
  const box = noteBox();
  if (!box) return;
  box.textContent = text;
  box.dataset.type = type;
}

function setHelp(text) {
  const box = sourceHelp();
  if (box) box.textContent = text;
}

function saveMode(mode) {
  localStorage.setItem(SOURCE_KEY, normalizeMode(mode));
}


function mergePlayerValues(player = {}, values = {}) {
  return {
    ...player,
    name: String(values.name ?? player.name ?? '').trim(),
    alliance: allianceTag3(values.alliance ?? player.alliance),
    role: values.role || player.role || 'Shooter',
    tier: String(values.tier ?? player.tier ?? 'T10').trim().toUpperCase(),
    march: Number(values.march ?? player.march ?? 0) || 0,
    rally: Number(values.rally ?? player.rally ?? 0) || 0,
    captain: Boolean(values.captain ?? player.captain),
    captainReady: Boolean(values.captain ?? player.captain) ? t('common.yes', 'Yes') : t('common.no', 'No'),
    shift: values.shift || player.shift || 'both',
    lair: String(values.lair ?? player.lair ?? '').trim(),
    placement: values.placement || player.placement || t('tower.reserve', 'Reserve')
  };
}

function rowKey(player = {}) {
  return String(player._rowId || player.id || player.uid || '');
}

function getLocalPlayers() {
  try {
    const rows = JSON.parse(localStorage.getItem(WKD.storageKeys.players) || '[]');
    return Array.isArray(rows) ? rows.map(row => ({ ...row, source: row.source || 'excel' })) : [];
  } catch {
    return [];
  }
}


function normalizeLocalRowsForRegionImport(rawRows = []) {
  const currentRows = Array.isArray(window.WKD?.state?.players) ? window.WKD.state.players : [];
  // When the Local list is visible, WKD.state.players already contains the normalized rows
  // that the user sees in the table (tier, march, rally, troop type). Use that instead of
  // older/raw localStorage rows so the region import does not lose mapped Excel columns.
  if (currentMode === 'local' && currentRows.length) {
    return currentRows.map(row => ({ ...row }));
  }
  if (window.WKD?.setPlayers && Array.isArray(rawRows) && rawRows.length) {
    const previous = Array.isArray(window.WKD?.state?.players) ? window.WKD.state.players.slice() : [];
    try {
      window.WKD.setPlayers(rawRows, {
        persist: false,
        normalized: false,
        eventSource: 'prepare-local-to-region',
        clearStorage: false
      });
      const normalized = Array.isArray(window.WKD?.state?.players) ? window.WKD.state.players.map(row => ({ ...row })) : [];
      if (normalized.length) return normalized;
    } catch (error) {
      console.warn('[WKD] local import normalization skipped:', error);
    } finally {
      if (previous.length && window.WKD?.state) window.WKD.state.players = previous;
    }
  }
  return Array.isArray(rawRows) ? rawRows.map(row => ({ ...row })) : [];
}

function localImportPreviewKey(row = {}) {
  const name = String(row.name || row.nickname || '').trim().toLowerCase();
  const alliance = String(row.alliance || '').trim();
  const shift = String(row.shift || row.shiftLabel || '').trim().toLowerCase();
  return `${name}|${alliance}|${shift}`;
}

function duplicateKeyStats(rows = []) {
  const counts = new Map();
  const names = new Map();
  rows.forEach(row => {
    const name = String(row.name || row.nickname || '').trim();
    const key = normalizeDuplicateNick(name);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!names.has(key)) names.set(key, name || key);
  });
  const duplicateEntries = [...counts.entries()].filter(([, count]) => count > 1);
  return {
    groups: duplicateEntries.length,
    rows: duplicateEntries.reduce((total, [, count]) => total + count, 0),
    extra: duplicateEntries.reduce((total, [, count]) => total + count - 1, 0),
    names: duplicateEntries.map(([key, count]) => ({ name: names.get(key) || key, count }))
  };
}

function numberFromAny(value = '') {
  const number = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function localImportCompletenessScore(row = {}) {
  let score = 0;
  if (String(row.name || row.nickname || '').trim()) score += 20;
  if (String(row.alliance || '').trim()) score += 12;
  if (hasTierValue(row)) score += 12;
  if (hasMarchValue(row)) score += 12;
  if (numberFromAny(row.rally ?? row.rallySize ?? row.mainRallySize) > 0) score += 8;
  if (String(row.role || row.troopType || row.troopLabel || '').trim()) score += 8;
  if (String(row.shift || row.shiftLabel || '').trim()) score += 6;
  if (row.captain || row.captainReady) score += 3;
  if (String(row.lair || row.lairLevel || row.denLevel || '').trim()) score += 2;
  return score;
}

function dedupeLocalRowsForRegionImport(rows = []) {
  const bestByNick = new Map();
  const order = [];
  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const key = normalizeDuplicateNick(row.name || row.nickname || '');
    if (!key) {
      order.push(`__empty_${index}`);
      bestByNick.set(`__empty_${index}`, { row, score: localImportCompletenessScore(row), index });
      return;
    }
    const score = localImportCompletenessScore(row);
    const current = bestByNick.get(key);
    if (!current) {
      order.push(key);
      bestByNick.set(key, { row, score, index });
      return;
    }
    if (score > current.score) bestByNick.set(key, { row, score, index: current.index });
  });
  return order.map(key => bestByNick.get(key)?.row).filter(Boolean).map(row => ({ ...row }));
}

function hasTierValue(row = {}) {
  return Boolean(String(row.tier || row.tierLabel || row.tierLevel || '').trim());
}

function hasMarchValue(row = {}) {
  const value = row.march ?? row.marchSize ?? row.mainMarchSize ?? row.mainMarch ?? '';
  return Number(String(value).replace(/[^0-9.-]/g, '')) > 0;
}

function buildLocalToRegionPreview(localRows = [], existingRows = []) {
  const duplicateStats = duplicateKeyStats(localRows);
  const existingByKey = new Map();
  existingRows.forEach(row => {
    const key = localImportPreviewKey(row);
    if (key.replaceAll('|', '').trim() && !existingByKey.has(key)) existingByKey.set(key, row);
  });
  let updateCount = 0;
  let addCount = 0;
  const usedKeys = new Set();
  localRows.forEach(row => {
    const key = localImportPreviewKey(row);
    if (key && existingByKey.has(key) && !usedKeys.has(key)) {
      updateCount += 1;
      usedKeys.add(key);
    } else {
      addCount += 1;
    }
  });
  const keepCount = Math.max(0, existingRows.length - usedKeys.size);
  const replaceDeleteCount = existingRows.length;
  const missingTierCount = localRows.filter(row => !hasTierValue(row)).length;
  const missingMarchCount = localRows.filter(row => !hasMarchValue(row)).length;
  const dedupedRows = duplicateStats.extra > 0 ? dedupeLocalRowsForRegionImport(localRows) : localRows;
  return {
    localCount: localRows.length,
    dedupedLocalCount: dedupedRows.length,
    dedupedSkippedCount: Math.max(0, localRows.length - dedupedRows.length),
    existingCount: existingRows.length,
    addCount,
    updateCount,
    keepCount,
    replaceDeleteCount,
    duplicateGroupCount: duplicateStats.groups,
    duplicateRowCount: duplicateStats.rows,
    duplicateExtraCount: duplicateStats.extra,
    duplicateNames: duplicateStats.names || [],
    duplicateCount: duplicateStats.rows,
    missingTierCount,
    missingMarchCount,
    sampleRows: dedupedRows.slice(0, 10)
  };
}

function readLocalImportRuns(region = '') {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_IMPORT_RATE_KEY) || '{}') || {};
    const now = Date.now();
    const rows = Array.isArray(all[region]) ? all[region].filter(ts => now - Number(ts) < LOCAL_IMPORT_RATE_WINDOW_MS) : [];
    all[region] = rows;
    localStorage.setItem(LOCAL_IMPORT_RATE_KEY, JSON.stringify(all));
    return rows;
  } catch {
    return [];
  }
}

function canRunLocalImport(region = '') {
  if (LOCAL_IMPORT_RATE_DISABLED) return true;
  return readLocalImportRuns(region).length < LOCAL_IMPORT_RATE_LIMIT;
}

function rememberLocalImportRun(region = '') {
  if (LOCAL_IMPORT_RATE_DISABLED) return;
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_IMPORT_RATE_KEY) || '{}') || {};
    const now = Date.now();
    const rows = (Array.isArray(all[region]) ? all[region] : []).filter(ts => now - Number(ts) < LOCAL_IMPORT_RATE_WINDOW_MS);
    rows.push(now);
    all[region] = rows;
    localStorage.setItem(LOCAL_IMPORT_RATE_KEY, JSON.stringify(all));
  } catch {}
}

function readLocalImportPreviewCache(region = '') {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_IMPORT_PREVIEW_CACHE_KEY) || '{}') || {};
    const cached = all[region];
    if (!cached || Date.now() - Number(cached.savedAt || 0) > LOCAL_IMPORT_PREVIEW_CACHE_TTL_MS) return null;
    return Array.isArray(cached.rows) ? cached.rows : null;
  } catch {
    return null;
  }
}

function writeLocalImportPreviewCache(region = '', rows = []) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_IMPORT_PREVIEW_CACHE_KEY) || '{}') || {};
    all[region] = { savedAt: Date.now(), rows: Array.isArray(rows) ? rows.slice(0, 2500) : [] };
    localStorage.setItem(LOCAL_IMPORT_PREVIEW_CACHE_KEY, JSON.stringify(all));
  } catch {}
}

function previewRowText(row = {}) {
  const name = String(row.name || row.nickname || '—').trim() || '—';
  const alliance = String(row.alliance || '—').trim() || '—';
  const tier = String(row.tier || row.tierLabel || '—').trim() || '—';
  const march = String(row.march || row.marchSize || '—').trim() || '—';
  return `${name} · ${alliance} · ${tier} · ${march}`;
}

function showLocalToRegionModeDialog(preview = {}, regionLabel = '') {
  return new Promise(resolve => {
    const modal = document.createElement('section');
    modal.className = 'confirm-modal is-open local-import-modal';
    modal.setAttribute('aria-hidden', 'false');
    modal.innerHTML = `
      <button class="confirm-backdrop" type="button" data-action="cancel" aria-label="${esc(t('common.cancel', 'Скасувати'))}"></button>
      <div class="confirm-card" role="dialog" aria-modal="true">
        <div class="confirm-top">
          <span class="confirm-icon" aria-hidden="true">⚠️</span>
          <div>
            <h3>${esc(t('players.localToRegionConfirmTitle', 'Перенести локальний список у регіон?'))}</h3>
            <p>${esc(tv('players.localToRegionConfirmMessage', 'Ти точно хочеш перенести {count} гравців у таблицю {region}?', { count: preview.localCount || 0, region: regionLabel }))}</p>
          </div>
        </div>
        <div class="confirm-note">
          <strong>${esc(t('players.localToRegionPreview', 'Попередній перегляд змін'))}</strong><br>
          ${esc(t('players.localRows', 'Локальних рядків'))}: ${preview.localCount || 0}<br>
          ${esc(t('players.regionRows', 'Зараз у регіоні'))}: ${preview.existingCount || 0}<br>
          ${esc(t('players.mergeWillAdd', 'Додасть'))}: ${preview.addCount || 0} · ${esc(t('players.mergeWillUpdate', 'Оновить'))}: ${preview.updateCount || 0} · ${esc(t('players.mergeWillKeep', 'Залишить'))}: ${preview.keepCount || 0}<br>
          ${esc(t('players.replaceWillDelete', 'При заміні буде очищено старих рядків'))}: ${preview.replaceDeleteCount || 0}<br>
          ${(preview.duplicateGroupCount || preview.duplicateRowCount || preview.missingTierCount || preview.missingMarchCount) ? `<strong>${esc(t('players.localToRegionWarningsTitle', 'Попередження перед переносом'))}</strong><br>` : ''}
          ${preview.duplicateGroupCount ? `⚠️ ${esc(t('players.localDuplicateNicknames', 'Повторюваних ніків'))}: ${preview.duplicateGroupCount}<br>` : ''}
          ${preview.duplicateRowCount ? `⚠️ ${esc(t('players.localDuplicateRows', 'Рядків у повторах'))}: ${preview.duplicateRowCount} · ${esc(t('players.localDuplicateExtraRows', 'зайвих повторних рядків'))}: ${preview.duplicateExtraCount || 0}<br>` : ''}
          ${preview.duplicateNames?.length ? `<small>${esc(t('players.localDuplicateNamesList', 'Ніки з повторами'))}: ${preview.duplicateNames.slice(0, 20).map(item => `${item.name} ×${item.count}`).map(esc).join(', ')}${preview.duplicateNames.length > 20 ? '…' : ''}</small><br>` : ''}
          ${preview.duplicateExtraCount ? `<label class="local-import-dedupe-option"><input id="localImportDedupe" type="checkbox" checked> <span>${esc(tv('players.localImportDedupeOption', 'Автоматично прибрати дублікати: залишити найповніший запис. До переносу піде {count} рядків, пропустить зайвих: {skipped}.', { count: preview.dedupedLocalCount || preview.localCount || 0, skipped: preview.dedupedSkippedCount || 0 }))}</span></label>` : ''}
          ${preview.missingTierCount ? `⚠️ ${esc(t('players.localMissingTier', 'Рядків без тіру'))}: ${preview.missingTierCount}<br>` : ''}
          ${preview.missingMarchCount ? `⚠️ ${esc(t('players.localMissingMarch', 'Рядків без розміру маршу'))}: ${preview.missingMarchCount}<br>` : ''}
          <div style="margin-top:.55rem;">${esc(t('players.localToRegionDailyLimitInfo', 'Тестовий режим: ліміт 1 перенос на 24 години тимчасово вимкнено.'))}</div>
          <label class="local-import-reset-tower-option"><input id="localImportResetTowerPlan" type="checkbox"> <span>${esc(t('players.localToRegionResetTowerPlanOption', 'Очистити старий план турелей після переносу'))}</span></label>
          <small>${esc(t('players.localToRegionResetTowerPlanHint', 'За замовчуванням вимкнено: перенос локального списку не буде скидати фінальний план і не додасть зайві writes. Увімкни тільки якщо хочеш повністю почати план турелей заново.'))}</small>
          ${preview.sampleRows?.length ? `<hr><small><strong>${esc(t('players.localToRegionSampleTitle', 'Приклад рядків: нік · альянс · тір · марш'))}</strong><br>${preview.sampleRows.map(previewRowText).map(esc).join('<br>')}</small>` : ''}
        </div>
        <div class="confirm-note" style="margin-top:.7rem;">
          <strong>${esc(t('players.localToRegionMerge', 'Додати / оновити'))}</strong> — ${esc(t('players.localToRegionMergeHint', 'Безпечний режим: додає нових і оновлює знайдених. Старі рядки не видаляє.'))}<br>
          <strong>${esc(t('players.localToRegionReplace', 'Замінити таблицю'))}</strong> — ${esc(t('players.localToRegionReplaceHint', 'Небезпечний режим: повністю замінює таблицю регіону локальним списком.'))}
        </div>
        <div class="confirm-actions confirm-actions-local-import">
          <button class="btn" type="button" data-action="cancel">${esc(t('common.cancel', 'Скасувати'))}</button>
          <button class="btn" type="button" data-action="merge">${esc(t('players.localToRegionMerge', 'Додати / оновити'))}</button>
          <button class="btn btn-danger-solid" type="button" data-action="replace">${esc(t('players.localToRegionReplace', 'Замінити таблицю'))}</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const finish = value => {
      modal.classList.remove('is-open');
      modal.remove();
      resolve(value);
    };
    modal.addEventListener('click', event => {
      const action = event.target?.dataset?.action;
      if (!action) return;
      if (action === 'cancel') finish(null);
      const dedupe = Boolean(modal.querySelector('#localImportDedupe')?.checked);
      const resetTowerPlan = Boolean(modal.querySelector('#localImportResetTowerPlan')?.checked);
      if (action === 'merge') finish({ mode: 'merge', dedupe, resetTowerPlan });
      if (action === 'replace') finish({ mode: 'replace', dedupe, resetTowerPlan });
    });
  });
}

async function loadExistingRegionRowsForLocalImportPreview(region = '') {
  if (loadedRegion === region && Array.isArray(loadedRegionRows)) return loadedRegionRows;
  const cached = readLocalImportPreviewCache(region);
  if (cached) return cached;
  try {
    const result = await listRegionRegistrations(currentUser, region, { d1Only: true, forceD1: false });
    currentProfile = result.profile || currentProfile;
    const rows = (Array.isArray(result.rows) ? result.rows : [])
      .filter(row => !normalizeRegion(row.region || '') || normalizeRegion(row.region || '') === normalizeRegion(region))
      .map(row => ({ ...regionRegistrationToPlayer(row), source: REGION_SOURCE }));
    writeLocalImportPreviewCache(region, rows);
    return rows;
  } catch (error) {
    console.warn('[WKD] local-to-region preview skipped:', error);
    return [];
  }
}

function canUseRegionSource() {
  return Boolean(currentUser && isProfileComplete(currentProfile));
}

function regionRoleForLocalImport(region = '') {
  const safeRegion = normalizeRegion(region || targetRegion());
  const globalRole = normalizeUserRole(currentProfile?.role || 'player');
  const email = String(currentUser?.email || currentProfile?.email || '').trim().toLowerCase();
  if (email === 'vovapotaychuk@gmail.com') return 'admin';
  if (globalRole === 'admin' || globalRole === 'moderator') return globalRole;
  const main = getGameProfile(currentProfile || {});
  if (normalizeRegion(main.region) === safeRegion) return globalRole;
  const farm = getUserFarms(currentProfile || {}).find(item => normalizeRegion(item.region) === safeRegion);
  return normalizeUserRole(farm?.role || 'player');
}

function canMoveLocalToRegion() {
  const region = targetRegion();
  const role = regionRoleForLocalImport(region);
  return Boolean(currentUser && region && canUseRegionSource() && ['admin', 'moderator', 'consul'].includes(role) && canManageRegion(currentProfile, region, currentUser));
}

function targetRegion() {
  return String(loadedRegion || activeProfileRegion() || getGameProfile(currentProfile || {}).region || '').replace(/[^0-9]/g, '');
}

function currentRegionLabel() {
  const region = targetRegion();
  return region ? `R${region}` : t('region.ownRegion', 'your region');
}

function profileRegionOptions() {
  const items = [];
  const add = (region, label = '') => {
    const safe = String(region || '').replace(/[^0-9]/g, '');
    if (!safe || items.some(item => item.region === safe)) return;
    items.push({ region: safe, label: label || `R${safe}` });
  };
  const main = getGameProfile(currentProfile || {});
  add(main.region, main.nickname ? `R${String(main.region || '').replace(/[^0-9]/g, '')} · ${main.nickname}` : '');
  getUserFarms(currentProfile || {}).forEach(farm => {
    add(farm.region, farm.nickname ? `R${String(farm.region || '').replace(/[^0-9]/g, '')} · ${farm.nickname}` : '');
  });
  return items.sort((a, b) => Number(a.region) - Number(b.region) || a.region.localeCompare(b.region));
}

function activeProfileRegion() {
  const options = profileRegionOptions();
  const saved = normalizeRegion(localStorage.getItem(REGION_KEY) || '');
  if (saved && (options.some(item => item.region === saved) || canManageRegion(currentProfile, saved, currentUser))) return saved;
  return options[0]?.region || getGameProfile(currentProfile || {}).region || '';
}

function renderRegionSwitch() {
  const wrap = $('#playersRegionSwitch');
  const select = $('#playersRegionSelect');
  if (!wrap || !select) return;
  const options = profileRegionOptions();
  wrap.hidden = options.length <= 1;
  select.innerHTML = options.map(item => `<option value="${esc(item.region)}" ${item.region === loadedRegion ? 'selected' : ''}>${esc(item.label)}</option>`).join('');
  if (loadedRegion) select.value = loadedRegion;
}

async function refreshTowerRegionOptions() {
  window.WKD = window.WKD || {};
  const options = [{ id: 'home', label: t('tower.localMode', 'Локальний'), mode: 'local', region: '' }];
  if (currentUser && currentProfile && isProfileComplete(currentProfile)) {
    const role = normalizeUserRole(currentProfile?.role || 'player');
    let regions = [];
    if (currentUser.email === 'vovapotaychuk@gmail.com' || role === 'admin' || role === 'moderator') {
      const catalog = await listRegionCatalog({ includeInactive: false, skipPublicPlayers: true }).catch(error => {
        console.warn('[WKD] tower region catalog skipped:', error);
        return [];
      });
      regions = catalog.map(item => item.region).filter(Boolean);
      getManagedRegionOptions(currentProfile, currentUser).forEach(region => regions.push(region));
    } else {
      regions = getManagedRegionOptions(currentProfile, currentUser);
    }
    const ownRegion = String(getGameProfile(currentProfile || {}).region || '').trim();
    if (ownRegion) regions.push(ownRegion);
    [...new Set(regions.map(String).filter(Boolean))]
      .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
      .forEach(region => options.push({ id: `region:${region}`, label: `R${region}`, mode: 'region', region }));
  }
  window.WKD.towerPlannerRegionOptions = options;
  document.dispatchEvent(new CustomEvent('wkd:tower-region-options-updated', { detail: { options } }));
  return options;
}

function updateAllianceColorMap() {
  window.WKD = window.WKD || {};
  const map = {};
  loadedRegionAlliances.forEach(item => {
    const tag = String(item.tag || item.id || '').trim();
    const hue = Number(item.colorHue);
    if (tag && Number.isFinite(hue)) map[tag] = ((Math.round(hue) % 360) + 360) % 360;
  });
  window.WKD.regionAllianceColorMap = map;
  document.dispatchEvent(new CustomEvent('wkd:alliance-colors-updated', { detail: { source: 'index-region' } }));
}

function updateTransferButtons() {
  const localRows = getLocalPlayers();
  const localBtn = localToRegionButton();
  const regionBtn = regionToLocalButton();

  if (localBtn) {
    const allowed = canMoveLocalToRegion();
    localBtn.hidden = !allowed;
    localBtn.disabled = !allowed || !localRows.length || loadingRegion;
    localBtn.title = !allowed
      ? t('players.localToRegionAccess', 'Only the consul of this region, moderator, or admin can move the local list to the region.')
      : (!localRows.length ? t('players.importLocalFirst', 'Import Excel/CSV into the local list first.') : t('players.localToRegionTitle', 'Move the local list into the table of the current region.'));
  }

  if (regionBtn) {
    regionBtn.hidden = !canUseRegionSource();
    regionBtn.disabled = !canUseRegionSource() || loadingRegion;
    regionBtn.title = t('players.regionToLocalTitle', 'Save the table of your current region into the local list of this browser.');
  }
}

function updateTabs() {
  const regionAllowed = canUseRegionSource();
  if (!regionAllowed && currentMode !== 'local') currentMode = 'local';
  sourceButtons().forEach(button => {
    const mode = button.dataset.sourceMode;
    const active = mode === currentMode;
    const disabled = mode !== 'local' && !regionAllowed;
    button.classList.toggle('is-active', active);
    button.disabled = disabled;
    button.setAttribute('aria-selected', String(active));
    if (disabled) button.title = t('players.profileForRegionTitle', 'Fill in your profile and sign in with Google to see the region table.');
    else button.removeAttribute('title');
  });
  updateTransferButtons();
}

function renderCurrentRows() {
  if (!window.WKD?.setPlayers) return;
  const localRows = getLocalPlayers();
  const rows = currentMode === 'region' ? loadedRegionRows : localRows;

  WKD.setPlayers(rows, {
    persist: false,
    normalized: true,
    eventSource: `source-${currentMode}`,
    clearStorage: false
  });

  if (currentMode === 'region') {
    setNote(tv('players.regionShown', 'Region table {region}: shown {count} players.', { region: currentRegionLabel(), count: loadedRegionRows.length }), loadedRegionRows.length ? 'success' : 'warn');
    setHelp(t('players.regionActive', 'Region table is active.'));
    updateTransferButtons();
    return;
  }

  setNote(tv('players.localShown', 'Local list: shown {count}.', { count: localRows.length }), 'muted');
  setHelp(t('playerManager.localActive', 'Local list is active.'));
  updateTransferButtons();
}

async function loadRegionRows(force = false, regionOverride = '') {
  if (!canUseRegionSource()) return;
  const requestedRegion = normalizeRegion(regionOverride || loadedRegion || activeProfileRegion() || getGameProfile(currentProfile || {}).region || '');
  if (!requestedRegion) return;
  if (!force && loadedRegionRows.length && requestedRegion === loadedRegion) return;
  const requestId = ++regionLoadRequestId;
  loadingRegion = true;
  loadingRegionKey = requestedRegion;
  loadedRegion = requestedRegion;
  localStorage.setItem(REGION_KEY, requestedRegion);
  updateTransferButtons();
  setNote(tv('players.loadingRegionTable', 'Loading region table {region}...', { region: currentRegionLabel() }), 'muted');
  try {
    const result = await listRegionRegistrations(currentUser, requestedRegion, {
      d1Only: true,
      forceD1: Boolean(force),
      d1TtlMs: force ? 0 : undefined
    });
    const resultRegion = normalizeRegion(result.region || requestedRegion || loadedRegion);
    if (requestId !== regionLoadRequestId || resultRegion !== requestedRegion) return;
    currentProfile = result.profile || currentProfile;
    loadedRegion = resultRegion;
    loadedRegionRows = (result.rows || [])
      .filter(row => !normalizeRegion(row.region || '') || normalizeRegion(row.region || '') === loadedRegion)
      .map(row => ({ ...regionRegistrationToPlayer(row), source: REGION_SOURCE }));
    loadedRegionAlliances = loadedRegion ? await listRegionAlliances(loadedRegion).catch(() => []) : [];
    if (requestId !== regionLoadRequestId) return;
    updateAllianceColorMap();
    if (result?.d1Missing) {
      setNote(t('players.regionD1MissingNoFirestore', 'Таблиця регіону ще не має D1-кешу. Firebase fallback не запускався, щоб не витрачати reads.'), 'warn');
    }
  } catch (error) {
    if (requestId !== regionLoadRequestId) return;
    console.error(error);
    loadedRegionRows = [];
    setNote(t('players.regionLoadFailed', 'Could not load the region table. Check the profile or region.'), 'warn');
  } finally {
    if (requestId === regionLoadRequestId) {
      loadingRegion = false;
      loadingRegionKey = '';
      updateTransferButtons();
    }
  }
}

async function applyMode(mode, options = {}) {
  const nextMode = normalizeMode(mode);
  currentMode = canUseRegionSource() ? nextMode : 'local';
  if (options.persist !== false) saveMode(currentMode);
  updateTabs();
  if (currentMode === 'region') await loadRegionRows(Boolean(options.forceRegion), options.region || '');
  renderCurrentRows();
}


async function getGlobalLocalImportLock(region = '') {
  try {
    return await readLocalImportRegionLock(currentUser, region);
  } catch (error) {
    console.warn('[WKD] global local import lock check skipped:', error?.message || error);
    return null;
  }
}

function isGlobalImportLocked(lock = {}) {
  return Boolean(lock?.locked || Number(lock?.remainingMs || 0) > 0 || Number(lock?.nextAllowedAtMs || 0) > Date.now());
}

function globalImportLockedMessage(lock = {}, region = '') {
  const remaining = formatRemainingTime(lock.remainingMs || (Number(lock.nextAllowedAtMs || 0) - Date.now()));
  return tv('players.localToRegionGlobalRateLimited', 'Перенос у R{region} уже виконували. Повторити можна через {time}.', { region, time: remaining });
}

async function copyLocalToRegion() {
  const storedLocalRows = getLocalPlayers();
  const localRows = normalizeLocalRowsForRegionImport(storedLocalRows);
  if (!canMoveLocalToRegion()) {
    setNote(t('players.localToRegionAccess', 'Only the consul of this region, moderator, or admin can move the local list to the region.'), 'warn');
    return;
  }
  if (!localRows.length) {
    setNote(t('players.noLocalToMove', 'No local players to move. Import Excel/CSV first.'), 'warn');
    return;
  }
  const regionToImport = targetRegion();
  if (!regionToImport) {
    setNote(t('players.localToRegionFailed', 'Could not move the local list to the region. Check access rights or region.'), 'warn');
    return;
  }
  const globalLock = await getGlobalLocalImportLock(regionToImport);
  if (isGlobalImportLocked(globalLock)) {
    setNote(globalImportLockedMessage(globalLock, regionToImport), 'warn');
    return;
  }
  if (!canRunLocalImport(regionToImport)) {
    setNote(t('players.localToRegionRateLimited', 'Тестовий режим: ліміт переносу тимчасово вимкнено.'), 'warn');
    return;
  }
  setNote(t('players.localToRegionPreparing', 'Перевіряю поточну таблицю регіону перед переносом...'), 'muted');
  const existingRows = await loadExistingRegionRowsForLocalImportPreview(regionToImport);
  const preview = buildLocalToRegionPreview(localRows, existingRows);
  const selection = await showLocalToRegionModeDialog(preview, regionToImport ? `R${regionToImport}` : currentRegionLabel());
  if (!selection?.mode) {
    setNote(t('players.localToRegionCancelled', 'Перенесення локального списку скасовано.'), 'muted');
    return;
  }
  const rowsForImport = selection.dedupe ? dedupeLocalRowsForRegionImport(localRows) : localRows;
  try {
    loadedRegion = regionToImport;
    localStorage.setItem(REGION_KEY, regionToImport);
    const actionText = selection.mode === 'merge'
      ? t('players.localToRegionMergeProgress', 'Додаю/оновлюю локальний список у регіоні...')
      : t('players.localToRegionReplaceProgress', 'Замінюю регіональну таблицю локальним списком...');
    setNote(`${actionText} ${currentRegionLabel()} · ${rowsForImport.length}`, 'muted');
    const result = await importLocalPlayersToRegion(currentUser, rowsForImport, regionToImport, { mode: selection.mode, dedupe: false });
    const region = result.region || regionToImport;
    if (selection.resetTowerPlan === true) {
      await saveRegionTowerPlan(currentUser, region, { version: 1, updatedAtMs: Date.now(), regions: { home: {}, region2: {}, region3: {} } }).catch(error => console.warn('tower plan reset skipped', error));
      document.dispatchEvent(new CustomEvent('wkd:tower-plan-hard-reset', { detail: { source: 'local-to-region' } }));
    }
    loadedRegionRows = [];
    writeLocalImportPreviewCache(regionToImport, []);
    await applyMode('region', { forceRegion: true });
    await commitLocalImportRegionLock(currentUser, region, { mode: selection.mode, rowsCount: rowsForImport.length }).catch(error => console.warn('[WKD] global local import lock commit skipped:', error?.message || error));
    rememberLocalImportRun(region);
    const message = result.mode === 'merge'
      ? tv('players.regionMerged', 'Region table R{region} updated: added {added}, updated {updated}, kept {kept}.', { region: result.region, added: result.added || 0, updated: result.updated || 0, kept: result.kept || 0 })
      : tv('players.regionReplaced', 'Region table R{region} replaced: added {count} players, deleted {deleted} old rows.', { region: result.region, count: result.count, deleted: result.deleted || result.replaced || 0 });
    setNote(message, 'success');
  } catch (error) {
    console.error(error);
    setNote(t('players.localToRegionFailed', 'Could not move the local list to the region. Check access rights or region.'), 'warn');
  }
}

async function copyRegionToLocal() {
  if (!canUseRegionSource()) {
    setNote(t('players.signInProfileFirst', 'Спочатку увійди через Google і заповни профіль з регіоном.'), 'warn');
    return;
  }
  const region = targetRegion();
  setNote(t('players.regionToLocalPreparing', 'Завантажую регіональну таблицю з кешу D1...'), 'muted');
  await loadRegionRows(false, region);
  WKD.setPlayers(loadedRegionRows, {
    persist: true,
    normalized: true,
    eventSource: 'region-to-local'
  });
  await applyMode('local');
  setNote(tv('players.regionSavedLocal', 'Table {region} saved into the local list of this browser.', { region: currentRegionLabel() }), 'success');
}

function removeRowsFromState(ids = []) {
  const wanted = new Set(ids.map(String));
  const before = WKD.state.players.length;
  WKD.state.players = WKD.state.players.filter(player => !wanted.has(String(player._rowId || player.id || '')));
  return before - WKD.state.players.length;
}

async function deletePlayersFromActiveSource(ids = []) {
  const wanted = [...new Set((Array.isArray(ids) ? ids : [ids]).map(id => String(id || '')).filter(Boolean))];
  if (!wanted.length) return { handled: true, removed: 0 };

  if (currentMode !== 'region') {
    const removed = removeRowsFromState(wanted);
    WKD.saveJson?.(WKD.storageKeys.players, WKD.state.players);
    WKD.renderPlayers?.();
    document.dispatchEvent(new CustomEvent('wkd:players-updated', { detail: { source: 'duplicates-delete-local', persist: true } }));
    return { handled: true, removed };
  }

  if (!canDeleteRegionRegistration(currentProfile, loadedRegion || getGameProfile(currentProfile || {}).region, currentUser)) {
    throw new Error('region-delete-access-denied');
  }

  const stateRows = WKD.state.players.filter(player => wanted.includes(String(player._rowId || player.id || '')));
  const dbIds = stateRows.map(player => String(player.regionRegistrationId || '')).filter(Boolean);
  if (stateRows.length !== dbIds.length) throw new Error('region-delete-registration-only');

  await deleteRegionRegistrations(currentUser, loadedRegion || getGameProfile(currentProfile || {}).region, dbIds);
  loadedRegionRows = loadedRegionRows.filter(player => !wanted.includes(String(player._rowId || player.id || '')));
  const removed = removeRowsFromState(wanted);
  WKD.renderPlayers?.();
  document.dispatchEvent(new CustomEvent('wkd:players-updated', { detail: { source: 'duplicates-delete-region', persist: false } }));
  setNote(tv('players.deletedFromRegion', 'Deleted {count} records from {region}.', { count: removed, region: currentRegionLabel() }), 'success');
  return { handled: true, removed };
}


async function updatePlayerInActiveSource(id, values = {}) {
  const wanted = String(id || '');
  if (!wanted) return { handled: true, updated: false };

  if (currentMode !== 'region') {
    const index = WKD.state.players.findIndex(player => rowKey(player) === wanted);
    if (index < 0) return { handled: true, updated: false };
    WKD.state.players[index] = mergePlayerValues(WKD.state.players[index], values);
    WKD.saveJson?.(WKD.storageKeys.players, WKD.state.players);
    WKD.renderPlayers?.();
    document.dispatchEvent(new CustomEvent('wkd:players-updated', { detail: { source: 'player-edit-local', persist: true } }));
    return { handled: true, updated: true, player: WKD.state.players[index] };
  }

  const stateRow = WKD.state.players.find(player => rowKey(player) === wanted);
  if (!stateRow?.regionRegistrationId) throw new Error('region-update-registration-only');
  if (!canManageRegion(currentProfile, loadedRegion || getGameProfile(currentProfile || {}).region, currentUser)) {
    throw new Error('region-update-access-denied');
  }

  const result = await updateRegionRegistration(currentUser, loadedRegion || getGameProfile(currentProfile || {}).region, stateRow.regionRegistrationId, values);
  const merged = mergePlayerValues(stateRow, values);
  loadedRegionRows = loadedRegionRows.map(player => rowKey(player) === wanted ? mergePlayerValues(player, values) : player);
  WKD.state.players = WKD.state.players.map(player => rowKey(player) === wanted ? merged : player);
  WKD.renderPlayers?.();
  document.dispatchEvent(new CustomEvent('wkd:players-updated', { detail: { source: 'player-edit-region', persist: false } }));
  setNote(tv('players.updatedInRegion', 'Updated “{name}” in {region}.', { name: merged.name, region: currentRegionLabel() }), 'success');
  return { handled: true, updated: true, player: merged, result };
}


async function loadTowerPlanFromActiveSource() {
  if (currentMode !== 'region') return { handled: false, plan: null };
  if (!currentUser) throw new Error('auth-required');
  const region = loadedRegion || getGameProfile(currentProfile || {}).region;
  const result = await getRegionTowerPlan(currentUser, region);
  currentProfile = result.profile || currentProfile;
  loadedRegion = result.region || loadedRegion;
  return { handled: true, ...result };
}

async function saveTowerPlanToActiveSource(plan = {}) {
  if (currentMode !== 'region') return { handled: false };
  if (!currentUser) throw new Error('auth-required');
  const region = loadedRegion || getGameProfile(currentProfile || {}).region;
  if (!canManageRegion(currentProfile, region, currentUser)) throw new Error('region-plan-access-denied');
  const result = await saveRegionTowerPlan(currentUser, region, plan);
  setNote(tv('players.towerPlanSaved', 'Turret plan saved in {region}.', { region: currentRegionLabel() }), 'success');
  return { handled: true, ...result };
}


async function reloadRegionPlayersForTower(region = '', options = {}) {
  const requested = normalizeRegion(region || loadedRegion || targetRegion());
  if (!requested || !canUseRegionSource()) return loadedRegionRows || [];
  await loadRegionRows(options.force === true, requested);
  if (currentMode === 'region') renderCurrentRows();
  return loadedRegionRows || [];
}

function getPlayersSourceInfo() {
  const region = loadedRegion || getGameProfile(currentProfile || {}).region;
  return {
    mode: currentMode,
    region,
    label: currentMode === 'region' ? currentRegionLabel() : t('playerManager.localList', 'local list'),
    canUpdate: currentMode !== 'region' || canManageRegion(currentProfile, region, currentUser),
    canDelete: currentMode !== 'region' || canDeleteRegionRegistration(currentProfile, region, currentUser),
    canPlan: currentMode !== 'region' || canManageRegion(currentProfile, region, currentUser),
    canViewRegion: canUseRegionSource()
  };
}

async function setTowerPlannerSource(options = {}) {
  const mode = normalizeMode(options.mode || 'local');
  if (mode !== 'region') {
    await applyMode('local', { persist: true });
    return getPlayersSourceInfo();
  }
  const region = String(options.region || loadedRegion || getGameProfile(currentProfile || {}).region || '').trim();
  if (region) {
    loadedRegion = region;
    loadedRegionRows = [];
    loadedRegionAlliances = [];
  }
  await applyMode('region', { forceRegion: true, persist: true, region });
  return getPlayersSourceInfo();
}

function bindTabs() {
  sourceButtons().forEach(button => {
    button.addEventListener('click', () => applyMode(button.dataset.sourceMode || 'local'));
  });
  localToRegionButton()?.addEventListener('click', copyLocalToRegion);
  regionToLocalButton()?.addEventListener('click', copyRegionToLocal);
  $('#playersRegionSelect')?.addEventListener('change', event => {
    loadedRegion = String(event.currentTarget.value || '').replace(/[^0-9]/g, '');
    if (loadedRegion) localStorage.setItem(REGION_KEY, loadedRegion);
    applyMode('region', { forceRegion: true, persist: true, region: loadedRegion });
  });
}

async function handleAuth(user) {
  currentUser = user;
  currentProfile = user ? await getUserProfile(user.uid).catch(() => null) : null;
  loadedRegionRows = [];
  loadedRegion = '';
  currentMode = normalizeMode(localStorage.getItem(SOURCE_KEY) || currentMode || 'region');
  updateTabs();

  if (!user) {
    setSourcePanelVisible(false);
    currentMode = 'local';
    await refreshTowerRegionOptions();
    setNote(t('players.guestLocalMode', 'Guest mode: the list is saved on this device.'), 'muted');
    renderCurrentRows();
    return;
  }

  if (!isProfileComplete(currentProfile)) {
    setSourcePanelVisible(false);
    currentMode = 'local';
    await refreshTowerRegionOptions();
    setNote(t('players.accountNeedsProfile', 'Акаунт підключено: заповни профіль, щоб відкрити таблицю свого регіону.'), 'warn');
    renderCurrentRows();
    return;
  }

  loadedRegion = activeProfileRegion();
  if (loadedRegion) localStorage.setItem(REGION_KEY, loadedRegion);
  currentMode = 'region';
  saveMode(currentMode);
  setSourcePanelVisible(true);
  renderRegionSwitch();
  const role = normalizeUserRole(currentProfile?.role || 'player');
  const roleText = role === 'admin' || role === 'moderator'
    ? t('players.adminRegionHelp', 'You can open the table page and switch regions.')
    : tv('players.regionAvailableHelp', 'Your region table {region} is available.', { region: currentRegionLabel() });
  await refreshTowerRegionOptions();
  renderRegionSwitch();
  setHelp(`${t('players.chooseSourceHelp', 'Choose local list or region table.')} ${roleText}`);
  await applyMode(currentMode, { persist: false });
}

async function init() {
  if (controllerReady || !$('#playersSourcePanel')) return;
  controllerReady = true;
  setSourcePanelVisible(false);
  bindTabs();
  updateTabs();
  renderCurrentRows();

  window.WKD.setPlayersSourceMode = (mode, options = {}) => applyMode(mode, options);
  window.WKD.deletePlayersFromActiveSource = deletePlayersFromActiveSource;
  window.WKD.updatePlayerInActiveSource = updatePlayerInActiveSource;
  window.WKD.getPlayersSourceInfo = getPlayersSourceInfo;
  window.WKD.loadTowerPlanFromActiveSource = loadTowerPlanFromActiveSource;
  window.WKD.saveTowerPlanToActiveSource = saveTowerPlanToActiveSource;
  window.WKD.setTowerPlannerSource = setTowerPlannerSource;
  window.WKD.refreshTowerRegionOptions = refreshTowerRegionOptions;
  window.WKD.reloadRegionPlayersForTower = reloadRegionPlayersForTower;

  document.addEventListener('wkd:source-mode-request', event => {
    applyMode(event.detail?.mode || 'local', { forceRegion: event.detail?.forceRegion === true });
  });

  await watchAuth(handleAuth);

  document.addEventListener('wkd:players-updated', event => {
    const source = event.detail?.source || '';
    if (source.startsWith('source-')) return;
    if (source === 'import-excel' || source === 'import-url') {
      applyMode('local');
      return;
    }
    if (currentMode === 'local') window.setTimeout(renderCurrentRows, 50);
  });

  document.addEventListener('wkd:profile-updated', () => {
    window.setTimeout(() => handleAuth(currentUser), 120);
  });

  document.addEventListener('wkd:language-changed', () => {
    updateTabs();
    renderRegionSwitch();
    refreshTowerRegionOptions().catch(error => console.warn('[WKD] tower regions language refresh skipped:', error));
    renderCurrentRows();
  });
}

document.addEventListener('wkd:partials-ready', init);
document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
