import { watchAuth } from '../services/firebase-service.js';
import { getFarmById, getGameProfile, getUserFarms, normalizeUserRole, saveSignedInUser } from '../services/user-db.js?v=256';
import {
  canManageRegion,
  canLeadCurrentRotation,
  canViewAnyRegion,
  createManualRegion,
  deleteRegionAlliance,
  getManagedRegionOptions,
  getMyRegionContext,
  getNextWastelandStart,
  listKnownRegionIds,
  getRegionSettings,
  ensureRegionRegistrationRunInfo,
  getRegionShareLinkCode,
  listRegionAlliances,
  normalizeRegion,
  readRegionFromUrl,
  saveRegionAlliance,
  saveRegionAllianceColor as saveRegionAllianceColorDb,
  saveRegionSettings,
  saveRegionTowerPlan,
  computeCloseAtMs,
  computeOpenAtMs,
  formatCountdown,
  formatUtcAndLocal,
  getRegionLifecycle,
  getRegionActorName
} from '../services/region-db.js?v=066';
import { listRegionCycleArchiveD1, publishRegionTableSnapshot, readFullRegionCycleArchiveD1, readRegionCycleArchiveD1, readRegionFormSettings as readRegionFormSettingsD1 } from '../services/region-table-cache.js?v=066';
import { makePublicShareUrl } from '../core/share-links.js?v=256';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const trim = value => String(value ?? '').trim();

let currentUser = null;
let currentProfile = null;
let currentRegion = '';
let currentSettings = null;
let currentAlliances = [];
let currentCanViewAnyRegion = false;
let currentShareCode = '';
let customTroopTypes = [];
let customFields = [];
let customShifts = [];
let editingAllianceId = '';
let selectedRegionColorTag = '';
let rotationDraft = { enabled: false, loop: true, activeIndex: 0, alliances: [] };
let timerId = null;
let ready = false;
let archiveCycles = [];
let archiveSelectedCycleId = '';
let archivePage = 1;
let archivePageSize = 20;
let archiveSearch = '';
let archiveTotalPages = 1;

const colorBuilderKey = 'wkd.regionAllianceColorBuilder.offset';
function t(key, fallback = '') { return window.WKD_t ? window.WKD_t(key) : (fallback || key); }
function tv(key, fallback = '', vars = {}) {
  let text = t(key, fallback);
  Object.entries(vars).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
  return text;
}
function boolValue(value) {
  if (value === true || value === false) return value;
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return false;
  if (/^(0|false|no|ні|нi|нет|nope|n)$/.test(text)) return false;
  return /^(1|true|yes|так|да|はい|是|예|y)$/.test(text);
}

function setDynamicText(selector, text) {
  const el = typeof selector === 'string' ? $(selector) : selector;
  if (!el) return;
  el.removeAttribute('data-i18n');
  el.textContent = text;
}

function setDynamicHtml(selector, html) {
  const el = typeof selector === 'string' ? $(selector) : selector;
  if (!el) return;
  el.removeAttribute('data-i18n');
  el.innerHTML = html;
}
function infoLine(labelKey, fallbackLabel, value, valueClass = '') {
  const classAttr = valueClass ? ` class="${valueClass}"` : '';
  return `<span class="region-info-label">${escapeHtml(t(labelKey, fallbackLabel))}</span> <span${classAttr}>${escapeHtml(value || '—')}</span>`;
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch])); }
function textLength(value) { return Array.from(trim(value)).length; }
function isAllianceInvalid(value) { return textLength(normalizeAllianceTag(value)) !== 3; }
function toNumber(value) { const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0; }
function colorOffset() { return toNumber(localStorage.getItem(colorBuilderKey)); }
function hashNumber(value) { let hash = 2166136261; for (const ch of String(value || 'empty')) { hash ^= ch.codePointAt(0) || 0; hash = Math.imul(hash, 16777619) >>> 0; } return hash >>> 0; }
function hueFromValue(value) { const n = Number(value); return Number.isFinite(n) ? ((Math.round(n) % 360) + 360) % 360 : null; }
function makeNeonColor(hue, seed = 0) {
  const h = hueFromValue(hue) ?? 132;
  const sat = 76 + (Math.abs(seed) % 16);
  const light = 46 + (Math.abs(seed >> 3) % 10);
  const accentHue = (h + 18 + (Math.abs(seed >> 8) % 26)) % 360;
  return {
    hue: h,
    bg: `linear-gradient(135deg,hsla(${h},${sat}%,${light}%,.24),hsla(${accentHue},${Math.min(96, sat + 8)}%,${Math.min(70, light + 12)}%,.15))`,
    border: `hsla(${accentHue},${Math.min(98, sat + 10)}%,${Math.min(78, light + 18)}%,.86)`,
    glow: `hsla(${h},${Math.min(98, sat + 10)}%,${Math.min(68, light + 10)}%,.28)`,
    accent: `hsl(${accentHue},${Math.min(98, sat + 12)}%,${Math.min(82, light + 20)}%)`
  };
}
function allianceRecord(tag) { const wanted = normalizeAllianceTag(tag); return currentAlliances.find(item => normalizeAllianceTag(item.tag || item.id) === wanted) || null; }
function customAllianceHue(tag) { return hueFromValue(allianceRecord(tag)?.colorHue); }
function allianceColor(tag, index = 0) {
  const base = hashNumber(String(tag || 'empty'));
  const manualHue = customAllianceHue(tag);
  return makeNeonColor(manualHue !== null ? manualHue : (base + colorOffset() + Math.round(index * 137.508)) % 360, base);
}
function allianceBadge(tag, index = 0) {
  const value = trim(tag);
  const color = allianceColor(value || '—', index);
  if (window.WKD?.Badges?.alliance) {
    return window.WKD.Badges.alliance(value, {
      preserve: true,
      strict3: true,
      className: 'player-manager-alliance-badge',
      hue: color.hue,
      styleVars: {
        '--ally-bg': color.bg,
        '--ally-border': color.border,
        '--ally-glow': color.glow,
        '--ally-accent': color.accent
      },
      title: value || '—'
    });
  }
  const style = `--ally-hue:${color.hue};--ally-bg:${color.bg};--ally-border:${color.border};--ally-glow:${color.glow};--ally-accent:${color.accent};`;
  return `<span class="alliance-badge player-manager-alliance-badge ${isAllianceInvalid(value) ? 'is-invalid' : 'is-valid'} ${!value ? 'is-empty' : ''}" style="${escapeHtml(style)}"><span class="badge-dot"></span><span>${escapeHtml(value || '—')}</span></span>`;
}

function currentGame() {
  const safeRegion = normalizeRegion(currentRegion);
  const main = { ...getGameProfile(currentProfile || {}), farmId: 'main', id: 'main' };
  const farms = getUserFarms(currentProfile || {});
  if (safeRegion) {
    const match = [main, ...farms].find(farm => normalizeRegion(farm.region) === safeRegion);
    if (match) return match;
  }
  const active = getFarmById(currentProfile || {}, currentProfile?.activeFarmId || 'main');
  if (active?.region) return active;
  return farms.find(farm => farm.region) || main;
}
function currentRole() {
  const globalRole = normalizeUserRole(currentProfile?.role || 'player');
  if (isOwnerAdmin() || globalRole === 'admin' || globalRole === 'moderator') return globalRole;
  const game = currentGame();
  return game?.farmId === 'main' ? globalRole : normalizeUserRole(game?.role || 'player');
}
function ownAlliance() { return normalizeAllianceTag(currentGame().alliance); }
function ownRank() { return trim(currentGame().rank).toLowerCase(); }
function isOwnerAdmin() { return String(currentUser?.email || '').trim().toLowerCase() === 'vovapotaychuk@gmail.com'; }
function isRankR4R5(rank = ownRank()) {
  return ['p4', 'p5', 'r4', 'r5', '4', '5'].includes(trim(rank).toLowerCase());
}
function canEditAllAllianceColors() {
  const role = currentRole();
  const sameRegion = normalizeRegion(currentGame().region) === normalizeRegion(currentRegion);
  return Boolean(currentUser && (isOwnerAdmin() || role === 'admin' || role === 'moderator' || (role === 'consul' && sameRegion)));
}
function canEditRegionAllianceColor(tag = '') {
  const wanted = normalizeAllianceTag(tag);
  if (!wanted || !currentUser) return false;
  if (canEditAllAllianceColors()) return true;
  const sameRegion = normalizeRegion(currentGame().region) === normalizeRegion(currentRegion);
  const ownTag = ownAlliance() === wanted;
  const rank = ownRank();
  if (!sameRegion || !ownTag) return false;
  if (currentRole() === 'officer' && isRankR4R5(rank)) return true;
  return ['p5', 'r5', '5'].includes(rank);
}
function canDeleteRegionAlliance(tag = '') {
  return canEditAllAllianceColors();
}
function canManageRotationSettings() {
  const role = currentRole();
  return Boolean(currentUser && (isOwnerAdmin() || role === 'admin' || role === 'moderator' || (role === 'consul' && normalizeRegion(currentGame().region) === normalizeRegion(currentRegion))));
}
function canViewRotationSettings() {
  if (canManageRotationSettings()) return true;
  return Boolean(currentUser && canLeadCurrentRotation(currentProfile || {}, currentRegion, currentUser, currentSettings || {}));
}

function normalizeAllianceTag(value = '') {
  return Array.from(trim(value).replace(/[\/\[\]#?]/g, '')).slice(0, 3).join('');
}
function collectAllianceTags() {
  const fromData = currentAlliances.map(item => normalizeAllianceTag(item.tag || item.id)).filter(Boolean);
  const fromDom = $$('[data-edit-alliance]').map(item => normalizeAllianceTag(item.dataset.editAlliance)).filter(Boolean);
  return [...new Set([...fromData, ...fromDom])];
}
function mergeAllianceLists(base = [], extra = []) {
  const map = new Map();
  [...base, ...extra].forEach(item => {
    const tag = normalizeAllianceTag(item?.tag || item?.id || item);
    if (!tag) return;
    const previous = map.get(tag) || {};
    map.set(tag, { id: tag, tag, ...previous, ...(typeof item === 'string' ? { name: tag } : item), id: tag, tag });
  });
  return [...map.values()];
}
function configuredAllianceItems(settings = currentSettings || {}) {
  const items = [];
  const host = normalizeAllianceTag(settings.hostAlliance || '');
  if (host) items.push({ id: host, tag: host, name: host, source: 'settings-host' });
  normalizeRotation(settings.rotationAlliances || []).forEach(item => {
    if (item.tag) items.push({ id: item.tag, tag: item.tag, name: item.name || item.tag, source: 'settings-rotation' });
  });
  return items;
}
function normalizeRotation(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(item => {
      const tag = normalizeAllianceTag(typeof item === 'string' ? item : (item.tag || item.id));
      const record = allianceRecord(tag);
      const name = trim(typeof item === 'string' ? '' : item.name) || trim(record?.name || '');
      return tag ? { tag, name } : null;
    })
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex(other => other.tag === item.tag) === index)
    .slice(0, 40);
}
function updateRotationSummary(settings = currentSettings || {}) {
  const box = $('#rotationSummary');
  if (!box) return;
  const list = normalizeRotation(settings.rotationAlliances || rotationDraft.alliances || []);
  const index = Math.max(0, Math.min(Math.max(0, list.length - 1), Number(settings.rotationActiveIndex ?? rotationDraft.activeIndex) || 0));
  const active = list[index] || null;
  const fallbackHost = normalizeAllianceTag(settings.hostAlliance || settings.activeHostAlliance || $('#settingsHostAlliance')?.value || '');
  if (list.length) {
    const activeTag = active?.tag || fallbackHost || '—';
    const state = settings.rotationEnabled
      ? tv('regionSettings.rotationSummaryActive', 'Активний: {tag} · {count} альянсів', { tag: activeTag, count: list.length })
      : tv('regionSettings.rotationSummaryPaused', 'Список ротації: {count} · поточний {tag} · ротація вимкнена', { tag: activeTag, count: list.length });
    box.textContent = state;
    return;
  }
  if (fallbackHost) {
    box.textContent = tv('regionSettings.rotationSummaryHostOnly', 'Активний альянс: {tag} · список ротації ще не налаштований', { tag: fallbackHost });
    return;
  }
  box.textContent = t('regionSettings.rotationSummaryEmpty', 'Ротація не налаштована.');
}


function updateHostAllianceDatalist() {
  const list = $('#settingsHostAllianceList');
  if (!list) return;
  const tags = collectAllianceTags();
  list.innerHTML = tags.map(tag => {
    const record = allianceRecord(tag) || {};
    const label = trim(record.name || record.note || '') || tag;
    return `<option value="${escapeHtml(tag)}" label="${escapeHtml(label)}"></option>`;
  }).join('');
}
function renderRegionColorBuilder() {
  const preview = $('#regionAllianceColorPreview');
  const palette = $('#regionAlliancePalette');
  const count = $('#regionAllianceColorCount');
  const picked = $('#regionColorPicked');
  const autoBtn = $('#regionAllianceAutoColorBtn');
  const resetBtn = $('#regionAllianceResetColorBtn');
  const list = collectAllianceTags().slice(0, 80);
  if (!selectedRegionColorTag || !list.includes(selectedRegionColorTag)) selectedRegionColorTag = list[0] || '';
  const canEditSelectedColor = selectedRegionColorTag && canEditRegionAllianceColor(selectedRegionColorTag);
  if (palette) {
    const hues = [0,12,24,36,48,60,76,92,108,124,140,156,172,188,204,220,236,252,268,284,300,316,332,348,8,28,52,84,116,148,180,212,244,276,308,340];
    palette.innerHTML = hues.map((hue, index) => {
      const shifted = (hue + colorOffset() + index * 3) % 360;
      const disabled = !canEditSelectedColor ? ' disabled' : '';
      return `<button class="player-manager-color-swatch" type="button" data-region-color-hue="${shifted}" style="--swatch:hsl(${shifted},88%,56%)" aria-label="${t('playerManager.autoColor', 'Auto color')}"${disabled}></button>`;
    }).join('');
  }
  if (!preview) return;
  if (!list.length) {
    preview.innerHTML = `<div class="region-empty">${escapeHtml(t('regionSettings.noAlliancesYet', 'No alliances yet. Add the first tag for this region.'))}</div>`;
    if (count) count.textContent = tv('region.allianceCount', '{count} alliances', { count: 0 });
    if (picked) picked.textContent = t('playerManager.chooseAllianceRight', 'Choose an alliance on the right');
    if (autoBtn) autoBtn.disabled = true;
    if (resetBtn) resetBtn.disabled = true;
    return;
  }
  preview.innerHTML = list.map((tag, index) => {
    const color = allianceColor(tag, index);
    const manual = customAllianceHue(tag) !== null;
    return `<button class="player-manager-color-item ${tag === selectedRegionColorTag ? 'is-selected' : ''} ${manual ? 'has-manual-color' : ''}" type="button" data-region-color-tag="${escapeHtml(tag)}" style="--ally-accent:${escapeHtml(color.accent)}">${allianceBadge(tag, index)}<small class="player-manager-color-state">${manual ? t('playerManager.savedColor', 'Saved color') : t('playerManager.randomColor', 'Random color')}</small></button>`;
  }).join('');
  if (count) count.textContent = tv('region.allianceCount', '{count} alliances', { count: list.length });
  if (picked) {
    const index = list.indexOf(selectedRegionColorTag);
    picked.innerHTML = selectedRegionColorTag ? `${allianceBadge(selectedRegionColorTag, Math.max(0, index))}` : t('playerManager.chooseAllianceRight', 'Choose an alliance on the right');
  }
  if (autoBtn) autoBtn.disabled = !canEditSelectedColor;
  if (resetBtn) resetBtn.disabled = !canEditSelectedColor || customAllianceHue(selectedRegionColorTag) === null;
}
async function saveRegionAllianceColor(tag, hue) {
  const safeTag = normalizeAllianceTag(tag);
  if (!safeTag) return;
  if (!canEditRegionAllianceColor(safeTag)) {
    setAllianceStatus(t('region.allianceColorAccess', 'Only the region consul or an R5/R4 officer of this alliance can change the color.'), 'error');
    return;
  }
  const current = allianceRecord(safeTag) || { id: safeTag, tag: safeTag };
  try {
    setAllianceStatus(t('region.savingAllianceColor', 'Saving alliance color...'), 'muted');
    await saveRegionAllianceColorDb(currentUser, currentRegion, safeTag, hue);
    await refreshAlliances();
    selectedRegionColorTag = safeTag;
    setRegionAllianceSubtab('colors');
    window.WKD = window.WKD || {};
    window.WKD.regionAllianceColorMap = Object.fromEntries(currentAlliances.map(item => [normalizeAllianceTag(item.tag || item.id), hueFromValue(item.colorHue)]).filter(([, hue]) => hue !== null));
    document.dispatchEvent(new CustomEvent('wkd:alliance-colors-updated', { detail: { tag: safeTag, hue, source: 'region-settings' } }));
    setAllianceStatus(t('region.allianceColorSaved', 'Alliance color saved.'), 'success');
  } catch (error) {
    console.error(error);
    setAllianceStatus(t('region.allianceColorFailed', 'Could not save alliance color. Check access rights.'), 'error');
  }
}
async function confirmAllianceLength(value) {
  if (!isAllianceInvalid(value)) return true;
  const message = t('region.allianceTagLengthConfirm', 'In the game, an alliance tag has 3 characters. Save this name anyway?');
  if (window.WKD?.confirmDialog) return window.WKD.confirmDialog({ title: t('region.checkAllianceTag', 'Check alliance tag'), message, acceptText: t('ui.save', 'Save'), cancelText: t('ui.cancel', 'Cancel') });
  return window.confirm(message);
}
function setRegionAllianceSubtab(tab = 'list') {
  const active = tab === 'colors' ? 'colors' : 'list';
  $$('[data-region-alliance-subtab]').forEach(button => button.classList.toggle('is-active', button.dataset.regionAllianceSubtab === active));
  $$('[data-region-alliance-pane]').forEach(pane => { pane.hidden = pane.dataset.regionAlliancePane !== active; });
  renderRegionColorBuilder();
}

function setStatus(text, type = 'muted') {
  const box = $('#regionSettingsStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}

function setAllianceStatus(text, type = 'muted') {
  const box = $('#regionAllianceStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}



function localizedDefaultText(value, key, fallback = '') {
  const raw = trim(value);
  const allDefaults = Object.values(window.WKD_TRANSLATIONS || {}).map(dict => dict?.[key]).filter(Boolean);
  if (!raw || raw === fallback || allDefaults.includes(raw)) return t(key, fallback);
  return raw;
}
function cleanDefaultText(value, key, fallback = '') {
  const raw = trim(value);
  const allDefaults = Object.values(window.WKD_TRANSLATIONS || {}).map(dict => dict?.[key]).filter(Boolean);
  return (!raw || raw === fallback || allDefaults.includes(raw)) ? '' : raw;
}

function updateRegionPill(region = currentRegion) {
  const pill = $('#settingsRegionPill');
  if (pill) pill.textContent = region ? `R${region}` : 'R—';
}

function resetArchiveState() {
  archiveCycles = [];
  archiveSelectedCycleId = '';
  archivePage = 1;
  archiveSearch = '';
  archiveTotalPages = 1;
  const list = $('#regionArchiveCycleList');
  if (list) list.innerHTML = '';
  const rows = $('#regionArchiveRows');
  if (rows) rows.innerHTML = '';
  const viewer = $('#regionArchiveViewer');
  if (viewer) viewer.hidden = true;
  setDynamicText('#regionArchiveStatus', t('regionSettings.archiveEmpty', 'Архів ще не завантажений.'));
}

function updateSettingsTabsLayout() {
  const tabs = $('.region-settings-tabs');
  if (!tabs) return;
  const count = tabs.querySelectorAll('[data-region-settings-tab]').length || 1;
  tabs.style.setProperty('--region-settings-tabs-count', String(count));
}

function formatArchiveDate(ms) {
  const value = Number(ms) || 0;
  if (!value) return '—';
  try { return formatUtcAndLocal(value); } catch { return new Date(value).toLocaleString(); }
}

function renderArchiveCycleList() {
  const list = $('#regionArchiveCycleList');
  if (!list) return;
  if (!archiveCycles.length) {
    list.innerHTML = '';
    setDynamicText('#regionArchiveStatus', t('regionSettings.archiveNoCycles', 'Архівних циклів ще немає. Вони зʼявляться після запуску нового циклу.'));
    return;
  }
  setDynamicText('#regionArchiveStatus', tv('regionSettings.archiveCyclesFound', 'Знайдено архівних циклів: {count}.', { count: archiveCycles.length }));
  list.innerHTML = archiveCycles.map(cycle => {
    const cycleId = escapeHtml(cycle.cycleId || 'active');
    const rowsCount = Number(cycle.rowsCount || 0) || 0;
    const title = cycle.title || tv('regionSettings.archiveCycleTitle', 'Цикл {cycle}', { cycle: cycle.cycleId || 'active' });
    const date = formatArchiveDate(cycle.eventStartAtMs || cycle.updatedAtMs || cycle.createdAtMs);
    return `<article class="region-archive-cycle">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(cycleId)} · ${escapeHtml(tv('regionSettings.archiveRowsCount', 'Гравців: {count}', { count: rowsCount }))} · ${escapeHtml(date)}</small>
      </div>
      <button class="btn" type="button" data-view-archive-cycle="${cycleId}">${escapeHtml(t('regionSettings.viewArchiveCycle', 'Переглянути'))}</button>
    </article>`;
  }).join('');
}

async function loadArchiveCycles(force = false) {
  if (!currentUser || !currentRegion) return;
  setDynamicText('#regionArchiveStatus', t('regionSettings.archiveLoading', 'Завантажую архів циклів з D1...'));
  try {
    const result = await listRegionCycleArchiveD1(currentUser, currentRegion, { force });
    archiveCycles = Array.isArray(result.cycles) ? result.cycles : [];
    renderArchiveCycleList();
  } catch (error) {
    console.warn('[WKD] archive cycles unavailable:', error);
    archiveCycles = [];
    renderArchiveCycleList();
    setDynamicText('#regionArchiveStatus', t('regionSettings.archiveLoadFailed', 'Не вдалося завантажити архів D1. Firebase fallback не запускався, щоб не витрачати reads.'));
  }
}

function renderArchiveRows(result = {}) {
  const rowsEl = $('#regionArchiveRows');
  if (!rowsEl) return;
  const rows = Array.isArray(result.rows) ? result.rows : [];
  if (!rows.length) {
    rowsEl.innerHTML = `<tr><td colspan="7">${escapeHtml(t('regionSettings.archiveNoRows', 'У цьому циклі немає рядків для показу.'))}</td></tr>`;
  } else {
    rowsEl.innerHTML = rows.map(row => `<tr>
      <td>${escapeHtml(row.nickname || '—')}</td>
      <td>${escapeHtml(row.alliance || '—')}</td>
      <td>${escapeHtml(row.troopLabel || row.troopType || '—')}</td>
      <td>${escapeHtml(row.tier || '—')}</td>
      <td>${escapeHtml(row.shiftLabel || row.shift || '—')}</td>
      <td>${escapeHtml((Number(row.marchSize) || 0).toLocaleString())}</td>
      <td>${escapeHtml((Number(row.rallySize) || 0).toLocaleString())}</td>
    </tr>`).join('');
  }
  archivePage = Number(result.page || archivePage) || 1;
  archiveTotalPages = Math.max(1, Number(result.totalPages || 1) || 1);
  const cycle = result.cycle || archiveCycles.find(item => item.cycleId === archiveSelectedCycleId) || {};
  const title = cycle.title || tv('regionSettings.archiveCycleTitle', 'Цикл {cycle}', { cycle: archiveSelectedCycleId || 'active' });
  setDynamicText('#regionArchiveViewerTitle', title);
  setDynamicText('#regionArchiveViewerMeta', `${archiveSelectedCycleId || 'active'} · ${tv('regionSettings.archiveRowsCount', 'Гравців: {count}', { count: Number(result.totalRows || 0) || 0 })}`);
  setDynamicText('#regionArchivePageInfo', tv('regionSettings.archivePageInfo', 'Сторінка {page} / {pages}', { page: archivePage, pages: archiveTotalPages }));
  const prev = $('#regionArchivePrevBtn');
  const next = $('#regionArchiveNextBtn');
  if (prev) prev.disabled = archivePage <= 1;
  if (next) next.disabled = archivePage >= archiveTotalPages;
  const viewer = $('#regionArchiveViewer');
  if (viewer) viewer.hidden = false;
}

async function viewArchiveCycle(cycleId, page = 1) {
  archiveSelectedCycleId = trim(cycleId);
  if (!archiveSelectedCycleId) return;
  archivePage = Math.max(1, Number(page) || 1);
  setDynamicText('#regionArchiveStatus', t('regionSettings.archiveCycleLoading', 'Завантажую вибраний цикл з D1...'));
  try {
    const result = await readRegionCycleArchiveD1(currentUser, currentRegion, archiveSelectedCycleId, { page: archivePage, pageSize: archivePageSize, search: archiveSearch });
    renderArchiveRows(result);
    setDynamicText('#regionArchiveStatus', t('regionSettings.archiveLoadedFromD1', 'Цикл завантажено з D1. Firebase reads: 0.'));
  } catch (error) {
    console.warn('[WKD] archive cycle unavailable:', error);
    setDynamicText('#regionArchiveStatus', t('regionSettings.archiveCycleLoadFailed', 'Не вдалося відкрити цикл з D1. Firebase fallback не запускався.'));
  }
}

function archiveRowsToLocalPlayers(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({
      _rowId: `archive-${archiveSelectedCycleId || 'cycle'}-${row.id || row.uid || index}`,
      name: trim(row.nickname || row.name),
      alliance: normalizeAllianceTag(row.alliance),
      role: trim(row.troopType || row.role || 'Fighter'),
      troopType: trim(row.troopType || row.role || 'Fighter'),
      troopLabel: trim(row.troopLabel || ''),
      tier: trim(row.tier || '').toUpperCase(),
      march: toNumber(row.marchSize || row.march),
      rally: toNumber(row.rallySize || row.rally),
      captain: boolValue(row.captainReady ?? row.captain),
      shift: trim(row.shift || 'both'),
      shiftLabel: trim(row.shiftLabel || ''),
      lairLevel: toNumber(row.lairLevel),
      lair: row.captureRegion || row.readyToAttack || '',
      comment: trim(row.comment || ''),
      extraSquads: Array.isArray(row.extraSquads) ? row.extraSquads : [],
      source: 'd1-archive'
    }))
    .filter(player => player.name);
}

async function loadSelectedArchiveCycleFull(actionKey = 'archive') {
  if (!archiveSelectedCycleId) throw new Error('archive-cycle-required');
  setDynamicText('#regionArchiveStatus', t('regionSettings.archiveCycleLoading', 'Завантажую вибраний цикл з D1...'));
  const result = await readFullRegionCycleArchiveD1(currentUser, currentRegion, archiveSelectedCycleId, { pageSize: 100 });
  if (!Array.isArray(result.rows) || !result.rows.length) throw new Error('archive-empty');
  return result;
}

async function copyArchiveCycleToLocal() {
  if (!archiveSelectedCycleId) return;
  const ok = window.WKD?.confirmDialog
    ? await window.WKD.confirmDialog({
      title: t('regionSettings.archiveCopyLocalTitle', 'Скопіювати цикл у локальний список?'),
      message: tv('regionSettings.archiveCopyLocalMessage', 'Цикл {cycle} буде завантажений у локальний список цього браузера.', { cycle: archiveSelectedCycleId }),
      note: t('regionSettings.archiveCopyLocalNote', 'Firebase не використовується. Поточний локальний список буде замінений.'),
      icon: '↙',
      acceptText: t('regionSettings.copyArchiveToLocal', 'Скопіювати в локальний')
    })
    : window.confirm(t('regionSettings.archiveCopyLocalTitle', 'Скопіювати цикл у локальний список?'));
  if (!ok) return;
  try {
    const result = await loadSelectedArchiveCycleFull('local');
    const players = archiveRowsToLocalPlayers(result.rows);
    if (!players.length) throw new Error('archive-empty');
    if (window.WKD?.saveJson && window.WKD?.storageKeys?.players) window.WKD.saveJson(window.WKD.storageKeys.players, players);
    else localStorage.setItem('wkd.clean.players.v1', JSON.stringify(players));
    if (typeof window.WKD?.setPlayers === 'function') window.WKD.setPlayers(players, { persist: true, normalized: true, eventSource: 'archive-cycle-local' });
    document.dispatchEvent(new CustomEvent('wkd:players-updated', { detail: { source: 'archive-cycle-local', persist: true } }));
    localStorage.setItem('wkd.players.sourceMode', 'local');
    setDynamicText('#regionArchiveStatus', tv('regionSettings.archiveCopiedToLocal', 'Скопійовано в локальний список: {count} гравців. Firebase reads: 0.', { count: players.length }));
  } catch (error) {
    console.warn('[WKD] archive copy to local failed:', error);
    setDynamicText('#regionArchiveStatus', t('regionSettings.archiveCopyLocalFailed', 'Не вдалося скопіювати архів у локальний список.'));
  }
}

async function restoreArchiveCycleToActiveD1() {
  if (!archiveSelectedCycleId) return;
  const ok = window.WKD?.confirmDialog
    ? await window.WKD.confirmDialog({
      title: t('regionSettings.archiveRestoreD1Title', 'Відновити D1-таблицю як активну?'),
      message: tv('regionSettings.archiveRestoreD1Message', 'Цикл {cycle} стане активною таблицею регіону R{region}.', { cycle: archiveSelectedCycleId, region: currentRegion }),
      note: t('regionSettings.archiveRestoreD1Note', 'Це не переписує Firestore-заявки. Firebase reads/writes: 0. Якщо треба повне відновлення Firestore — це окремий дорогий крок.'),
      icon: '↻',
      acceptText: t('regionSettings.restoreArchiveActive', 'Відновити D1-таблицю')
    })
    : window.confirm(t('regionSettings.archiveRestoreD1Title', 'Відновити D1-таблицю як активну?'));
  if (!ok) return;
  try {
    const result = await loadSelectedArchiveCycleFull('restore');
    const settings = { ...(result.settings || {}), currentCycleId: archiveSelectedCycleId };
    const publishResult = await publishRegionTableSnapshot(currentUser, {
      region: currentRegion,
      cycleId: archiveSelectedCycleId,
      settings,
      rows: result.rows
    });
    if (publishResult?.ok === false || publishResult?.skipped) throw new Error(publishResult?.error || 'restore-skipped');
    await loadArchiveCycles(true);
    setDynamicText('#regionArchiveStatus', tv('regionSettings.archiveRestoredD1', 'D1-таблицю відновлено як активну: {count} гравців. Firebase reads/writes: 0.', { count: result.rows.length }));
  } catch (error) {
    console.warn('[WKD] archive restore D1 failed:', error);
    setDynamicText('#regionArchiveStatus', t('regionSettings.archiveRestoreD1Failed', 'Не вдалося відновити D1-таблицю з архіву.'));
  }
}

async function refreshRegionSwitcher() {
  const wrap = $('#regionSettingsSwitcher');
  const select = $('#regionSettingsRegionSelect');
  const addButton = $('#openAddRegionBtn');
  if (addButton) addButton.hidden = !currentCanViewAnyRegion;
  if (!wrap || !select || !currentUser || !currentProfile) return;
  let regions = [];
  if (currentCanViewAnyRegion) {
    regions = await listKnownRegionIds().catch(error => {
      console.warn('[WKD] known regions unavailable:', error);
      return [];
    });
  } else {
    regions = getManagedRegionOptions(currentProfile, currentUser);
  }
  if (currentRegion && !regions.includes(currentRegion)) regions.push(currentRegion);
  regions = [...new Set(regions.map(normalizeRegion).filter(Boolean))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  select.innerHTML = regions.map(region => `<option value="${escapeHtml(region)}">R${escapeHtml(region)}</option>`).join('');
  select.value = currentRegion;
  wrap.hidden = regions.length < 2;
}

async function switchRegion(region) {
  const nextRegion = normalizeRegion(region);
  if (!nextRegion || nextRegion === currentRegion) return;
  const url = new URL(window.location.href);
  url.searchParams.set('region', nextRegion);
  window.history.replaceState({}, '', url);
  $('#regionSettingsForm') && ($('#regionSettingsForm').hidden = true);
  resetArchiveState();
  setStatus(t('regionSettings.switchingRegion', 'Opening selected region...'), 'muted');
  await load(currentUser);
}

function toggleManualRegionForm(show = null) {
  const form = $('#regionManualAddForm');
  if (!form) return;
  const next = show === null ? form.hidden : Boolean(show);
  form.hidden = !next;
  if (next) $('#settingsNewRegionId')?.focus();
}

async function saveManualRegionFromSettings(event) {
  event.preventDefault();
  if (!currentCanViewAnyRegion) return;
  const region = normalizeRegion($('#settingsNewRegionId')?.value);
  if (!region) {
    setStatus(t('admin.regionNumberRequired', 'Enter the region number.'), 'error');
    return;
  }
  try {
    setStatus(t('admin.savingRegion', 'Saving region...'), 'muted');
    await createManualRegion(currentUser, {
      region,
      name: $('#settingsNewRegionName')?.value || `R${region}`,
      note: $('#settingsNewRegionNote')?.value || '',
      active: true
    });
    $('#settingsNewRegionId') && ($('#settingsNewRegionId').value = '');
    $('#settingsNewRegionName') && ($('#settingsNewRegionName').value = '');
    $('#settingsNewRegionNote') && ($('#settingsNewRegionNote').value = '');
    toggleManualRegionForm(false);
    setStatus(t('regionSettings.regionAddedOpening', 'Region added. Opening its settings...'), 'success');
    await switchRegion(region);
  } catch (error) {
    console.error(error);
    setStatus(t('regionSettings.regionAddFailed', 'Could not add region. Check access rights.'), 'error');
  }
}

function cleanShareCode(value = '') {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 140);
}

function buildShareLink(region) {
  if (!currentShareCode || !region) return '';
  return makePublicShareUrl('./region-form.html', currentShareCode);
}

function updateShareLink() {
  const shortInput = $('#regionShareLink');
  const shortLink = buildShareLink(currentRegion);
  if (shortInput) {
    shortInput.value = shortLink;
    shortInput.placeholder = shortInput.value ? '' : t('region.shortLinkAfterSave', 'A secret short link will be created after saving the form');
  }
  if (shortLink && currentShareCode) {
    try {
      sessionStorage.setItem('wkd.regionForm.shortCode', currentShareCode);
      sessionStorage.setItem('wkd.regionForm.region', normalizeRegion(currentRegion));
    } catch {}
  }
}

function toUtcInputValue(ms) {
  const date = new Date(Number(ms) || getNextWastelandStart());
  const pad = value => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function fromUtcInputValue(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return getNextWastelandStart();
  const [, year, month, day, hour, minute] = match.map(Number);
  return Date.UTC(year, month - 1, day, hour, minute, 0);
}

function openedByText(settings = currentSettings || {}) {
  const life = getRegionLifecycle(settings || {});
  const direct = String(life.openedByName || life.openedByEmail || settings.openedByName || settings.openedByEmail || '').trim();
  const uid = String(life.openedByUid || settings.openedByUid || settings.updatedBy || '').trim();
  const email = String(life.openedByEmail || settings.openedByEmail || settings.updatedByEmail || '').trim().toLowerCase();
  const sameUser = Boolean(currentUser && ((uid && currentUser.uid === uid) || (email && String(currentUser.email || '').toLowerCase() === email)));
  const profileName = currentUser ? getRegionActorName(currentProfile || {}, currentRegion, currentUser) : '';
  if (sameUser && profileName) return profileName;
  const displayName = String(currentUser?.displayName || currentProfile?.displayName || '').trim().toLowerCase();
  if (profileName && displayName && direct.toLowerCase() === displayName) return profileName;
  if (direct && !direct.includes('@')) return direct;
  if ((settings.open || settings.enabled) && profileName && (!direct || direct.includes('@'))) return profileName;
  if (direct) return direct;
  return uid || t('regionSettings.unknownStarter', 'невідомо');
}

function openedAtText(settings = currentSettings || {}) {
  const life = getRegionLifecycle(settings || {});
  const ms = Number(life.openedAtMs) || Number(life.openAtMs) || Number(life.updatedAtMs) || 0;
  return ms ? formatUtcAndLocal(ms) : t('regionSettings.notStartedYet', 'ще не запускали');
}

function eventStartText(settings = currentSettings || {}) {
  const life = getRegionLifecycle(settings || {});
  const ms = Number(life.eventStartAtMs || life.startAtMs) || 0;
  return ms ? formatUtcAndLocal(ms) : '—';
}

function makeCustomId(value = '') {
  return trim(value)
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ_-]+/giu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || `custom-${Date.now()}`;
}

function renderRuleLists() {
  const troopList = $('#settingsCustomTroopList');
  const fieldList = $('#settingsCustomFieldList');
  if (troopList) {
    troopList.innerHTML = customTroopTypes.length ? customTroopTypes.map(item => `
      <span class="region-chip"><b>${item.label}</b><button type="button" data-remove-custom-troop="${item.id}" aria-label="${escapeHtml(t('common.delete', 'Delete'))}">×</button></span>
    `).join('') : `<small>${t('regionSettings.noExtraTypes', 'No additional types yet.')}</small>`;
  }
  if (fieldList) {
    fieldList.innerHTML = customFields.length ? customFields.map(item => `
      <span class="region-chip"><b>${item.label}</b><em>${item.type === 'checkbox' ? t('ui.checkbox', 'Checkbox') : t('ui.text', 'Text')}</em><button type="button" data-remove-custom-field="${item.id}" aria-label="${escapeHtml(t('common.delete', 'Delete'))}">×</button></span>
    `).join('') : `<small>${t('regionSettings.noExtraColumns', 'No additional columns yet.')}</small>`;
  }
  renderCustomShifts();
}

function renderCustomShifts() {
  const list = $('#settingsShiftDefaultList');
  if (!list) return;
  const selected = new Set($$('input[name="settingsShift"]:checked').map(input => input.value));
  list.querySelectorAll('[data-custom-shift-row]').forEach(item => item.remove());
  list.insertAdjacentHTML('beforeend', customShifts.map(item => `
    <label class="region-check" data-custom-shift-row>
      <input type="checkbox" name="settingsShift" value="${escapeHtml(item.id)}" ${selected.has(item.id) ? 'checked' : ''} />
      <span>${escapeHtml(item.label)}</span>
      <button class="region-shift-remove" type="button" data-remove-custom-shift="${escapeHtml(item.id)}" aria-label="${t('ui.delete', 'Delete')}">×</button>
    </label>`).join(''));
}

function addCustomTroop() {
  const input = $('#settingsCustomTroopName');
  const label = trim(input?.value);
  if (!label) return;
  const id = makeCustomId(label);
  if (!customTroopTypes.some(item => item.id === id)) customTroopTypes.push({ id, label });
  if (input) input.value = '';
  renderRuleLists();
}

function addCustomField() {
  const input = $('#settingsCustomFieldLabel');
  const label = trim(input?.value);
  if (!label) return;
  const id = makeCustomId(label);
  const type = $('#settingsCustomFieldType')?.value === 'checkbox' ? 'checkbox' : 'text';
  if (!customFields.some(item => item.id === id)) customFields.push({ id, label, type });
  if (input) input.value = '';
  renderRuleLists();
}

function removeCustomTroop(id) {
  customTroopTypes = customTroopTypes.filter(item => item.id !== id);
  renderRuleLists();
}

function removeCustomField(id) {
  customFields = customFields.filter(item => item.id !== id);
  renderRuleLists();
}

function addCustomShift() {
  const input = $('#settingsCustomShiftLabel');
  const label = trim(input?.value);
  if (!label) return;
  const id = makeCustomId(label);
  const defaultIds = ['shift1', 'shift2', 'shift3', 'shift4', 'both'];
  if (!defaultIds.includes(id) && !customShifts.some(item => item.id === id)) customShifts.push({ id, label });
  if (input) input.value = '';
  renderRuleLists();
}

function removeCustomShift(id) {
  customShifts = customShifts.filter(item => item.id !== id);
  renderRuleLists();
}

function updatePreview() {
  const eventStartAtMs = fromUtcInputValue($('#settingsEventStart')?.value);
  const closeRule = $('#settingsCloseRule')?.value || 'hoursBeforeEvent';
  const closeHours = Number($('#settingsCloseHours')?.value) || 24;
  const closeAtMs = computeCloseAtMs(eventStartAtMs, closeRule, closeHours);
  const autoOpenEnabled = $('#settingsAutoOpen')?.checked ?? true;
  const autoOpenDay = Number($('#settingsAutoOpenDay')?.value ?? 5);
  const autoOpenTime = $('#settingsAutoOpenTime')?.value || '00:00';
  const openAtMs = computeOpenAtMs(eventStartAtMs, autoOpenEnabled, autoOpenDay, autoOpenTime);
  const now = Date.now();
  const closeText = closeAtMs > now ? tv('region.timeUntilClose', 'Until close: {time}', { time: formatCountdown(closeAtMs - now) }) : t('region.registrationClosedByTimer', 'Registration is already closed by timer');

  setDynamicHtml('#settingsOpenPreview', infoLine('regionInfo.openLabel', 'Відкриття:', autoOpenEnabled ? formatUtcAndLocal(openAtMs) : t('regionSettings.opensImmediately', 'Opens immediately when the form is enabled'), 'region-info-value'));
  setDynamicHtml('#settingsClosePreview', infoLine('regionInfo.closeLabel', 'Закриття:', formatUtcAndLocal(closeAtMs), 'region-info-value'));
  setDynamicHtml('#settingsTimerPreview', infoLine('regionInfo.remainingLabel', 'Залишилось:', closeText.replace(/^.*?:\s*/, ''), 'region-info-value region-info-value--good'));
  const startValue = `${eventStartText({ eventStartAtMs })} · ${t('regionInfo.untilStart', 'до старту')}: ${formatCountdown(eventStartAtMs - Date.now())}`;
  setDynamicHtml('#settingsCyclePreview', infoLine('regionInfo.startLabel', 'Старт:', startValue, 'region-info-value'));
  setDynamicHtml('#settingsOpenedPreview', infoLine('regionInfo.startedAtLabel', 'Запущено:', openedAtText(currentSettings), 'region-info-value'));
  setDynamicHtml('#settingsOpenedByPreview', infoLine('regionInfo.startedByLabel', 'Запустив:', openedByText(currentSettings), 'region-starter-name'));
}

function startPreviewTimer() {
  clearInterval(timerId);
  updatePreview();
  timerId = setInterval(updatePreview, 30000);
}

function fill(settings) {
  currentSettings = settings;
  $('#settingsEnabled').value = String(Boolean(settings.enabled));
  $('#settingsHostAlliance') && ($('#settingsHostAlliance').value = settings.hostAlliance || '');
  updateHostAllianceDatalist();
  $('#settingsGovernor') && ($('#settingsGovernor').value = settings.governor || '');
  $('#settingsDescription').value = localizedDefaultText(settings.description, 'region.formDefaultDescription', 'Заповни заявку для свого регіону. Консул або офіцер побачить її в таблиці регіону.');
  $('#settingsExtraTroop').checked = Boolean(settings.allowExtraTroop);
  $('#settingsMinTier') && ($('#settingsMinTier').value = settings.minTier || 'T10');
  customTroopTypes = Array.isArray(settings.customTroopTypes) ? [...settings.customTroopTypes] : [];
  customFields = Array.isArray(settings.customFields) ? [...settings.customFields] : [];
  customShifts = Array.isArray(settings.customShifts) ? [...settings.customShifts] : [];
  renderRuleLists();
  rotationDraft = { enabled: Boolean(settings.rotationEnabled), loop: 'rotationLoop' in settings ? Boolean(settings.rotationLoop) : true, activeIndex: Number(settings.rotationActiveIndex) || 0, alliances: normalizeRotation(settings.rotationAlliances || []) };
  updateRotationSummary(settings);
  $('#openRotationModalBtn') && ($('#openRotationModalBtn').disabled = !canViewRotationSettings());
  $('#settingsEventStart').value = toUtcInputValue(settings.eventStartAtMs);
  $('#settingsCloseRule').value = settings.closeRule || 'hoursBeforeEvent';
  $('#settingsCloseHours').value = settings.closeHours || 24;
  $('#settingsAutoOpen') && ($('#settingsAutoOpen').checked = 'autoOpenEnabled' in settings ? Boolean(settings.autoOpenEnabled) : true);
  $('#settingsAutoOpenDay') && ($('#settingsAutoOpenDay').value = String(settings.autoOpenDay ?? 5));
  $('#settingsAutoOpenTime') && ($('#settingsAutoOpenTime').value = settings.autoOpenTime || '00:00')
  $('#settingsNewCycle') && ($('#settingsNewCycle').checked = false);
  $$('input[name="settingsShift"]').forEach(input => {
    input.checked = settings.shifts?.includes(input.value);
  });
  updateShareLink();
  startPreviewTimer();
}

function read() {
  return {
    enabled: $('#settingsEnabled').value === 'true',
    title: '',
    description: cleanDefaultText($('#settingsDescription').value, 'region.formDefaultDescription', 'Заповни заявку для свого регіону. Консул або офіцер побачить її в таблиці регіону.'),
    hostAlliance: $('#settingsHostAlliance')?.value || '',
    governor: $('#settingsGovernor')?.value || '',
    shifts: $$('input[name="settingsShift"]:checked').map(input => input.value),
    customShifts: customShifts.map(item => ({ id: item.id, label: item.label })),
    requireCaptain: false,
    allowExtraTroop: $('#settingsExtraTroop').checked,
    minTier: $('#settingsMinTier')?.value || 'T10',
    customTroopTypes: customTroopTypes.map(item => ({ id: item.id, label: item.label })),
    customFields: customFields.map(item => ({ id: item.id, label: item.label, type: item.type })),
    eventStartAtMs: fromUtcInputValue($('#settingsEventStart').value),
    closeRule: $('#settingsCloseRule').value,
    closeHours: $('#settingsCloseHours').value,
    autoOpenEnabled: $('#settingsAutoOpen')?.checked ?? true,
    autoOpenDay: Number($('#settingsAutoOpenDay')?.value ?? 5),
    autoOpenTime: $('#settingsAutoOpenTime')?.value || '00:00',
    rotationEnabled: Boolean(rotationDraft.enabled),
    rotationLoop: Boolean(rotationDraft.loop),
    rotationActiveIndex: Number(rotationDraft.activeIndex) || 0,
    rotationAlliances: normalizeRotation(rotationDraft.alliances),
    openNewCycle: false
  };
}

function activateSettingsTab(name) {
  $$('[data-region-settings-tab]').forEach(button => {
    const active = button.dataset.regionSettingsTab === name;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  $$('[data-region-settings-panel]').forEach(panel => {
    const active = panel.dataset.regionSettingsPanel === name;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
  if (name === 'alliances') renderRegionColorBuilder();
  if (name === 'archive' && !archiveCycles.length) loadArchiveCycles().catch(() => null);
}

async function save(event, overrides = {}) {
  event.preventDefault();
  const values = { ...read(), ...overrides };
  if (!values.shifts.length) {
    setStatus(t('region.selectAtLeastOneShift', 'Choose at least one shift for the form.'), 'error');
    return;
  }
  try {
    setStatus(t('region.savingRegionForm', 'Saving region form...'), 'muted');
    currentSettings = await saveRegionSettings(currentUser, currentRegion, values);
    currentShareCode = currentSettings.shortLinkCode || currentShareCode;
    const openedNewCycle = Boolean(currentSettings.openedNewCycle || values.openNewCycle);
    if (openedNewCycle) {
      await saveRegionTowerPlan(currentUser, currentRegion, { version: 1, updatedAtMs: Date.now(), regions: { home: {}, region2: {}, region3: {} } }).catch(error => console.warn('tower plan reset skipped', error));
      window.WKD?.resetTowerPlannerPlan?.('registration-form-new-cycle');
      document.dispatchEvent(new CustomEvent('wkd:tower-plan-hard-reset', { detail: { source: 'registration-form-new-cycle' } }));
    }
    fill(currentSettings);
    await refreshAlliances().catch(error => console.warn('Alliance refresh skipped after settings save', error));
    const note = openedNewCycle ? ` ${t('regionSettings.newCycleSavedNote', 'New cycle opened: the table shows a clean list, and old requests remain in the previous cycle.')}` : '';
    const cleanupNote = '';
    setStatus(`${t('regionSettings.formSaved', 'Region form saved.')}${note}${cleanupNote}`, 'success');
  } catch (error) {
    console.error(error);
    setStatus(t('regionSettings.saveFailed', 'Could not save the form. Check access rights.'), 'error');
  }
}


async function startRegistrationNow() {
  if (!currentUser || !currentRegion) return;
  const alreadyOpen = Boolean(currentSettings?.enabled || $('#settingsEnabled')?.value === 'true');
  const titleKey = alreadyOpen ? 'regionSettings.startNowAlreadyOpenTitle' : 'regionSettings.startNowConfirmTitle';
  const messageKey = alreadyOpen ? 'regionSettings.startNowAlreadyOpenMessage' : 'regionSettings.startNowConfirmMessage';
  const acceptKey = alreadyOpen ? 'regionSettings.startNowAlreadyOpenAccept' : 'regionSettings.startNow';
  const message = t(messageKey, alreadyOpen
    ? 'The registration form is already open. Starting it again will create a new clean cycle and clear the current player table and turrets. Continue?'
    : 'The form will open immediately and a new clean cycle will be created. The player table and tower plan will be cleared.');
  const ok = window.WKD?.confirmDialog
    ? await window.WKD.confirmDialog({
        title: t(titleKey, alreadyOpen ? 'Registration is already running' : 'Start registration now?'),
        message,
        acceptText: t(acceptKey, alreadyOpen ? 'Yes, start a new cycle' : 'Start now'),
        cancelText: t('ui.cancel', 'Cancel')
      })
    : window.confirm(message);
  if (!ok) return;

  const enabled = $('#settingsEnabled');
  const autoOpen = $('#settingsAutoOpen');
  if (enabled) enabled.value = 'true';
  if (autoOpen) autoOpen.checked = false;
  updatePreview();
  await save({ preventDefault() {} }, { enabled: true, autoOpenEnabled: false, openNewCycle: true, forceOpenNow: true });
  if (currentRegion) {
    localStorage.setItem('wkd.players.sourceMode', 'region');
    localStorage.setItem('wkd.players.activeRegion', currentRegion);
  }
  setStatus(t('regionSettings.startNowSaved', 'Registration has been started now.'), 'success');
  window.WKD?.actionDoneDialog?.({
    title: t('regionSettings.startNowDialogTitle', 'Реєстрацію запущено'),
    message: tv('regionSettings.startNowDialogMessage', 'Форма регіону R{region} відкрита. Створено новий чистий цикл, таблиця гравців і турелі очищені.', { region: currentRegion }),
    href: 'index.html'
  });
}

async function closeRegistrationNow() {
  if (!currentUser || !currentRegion) return;
  const message = t('regionSettings.closeNowConfirmMessage', 'The registration form will be closed now. Existing requests in the current cycle will stay in the table.');
  const ok = window.WKD?.confirmDialog
    ? await window.WKD.confirmDialog({
        title: t('regionSettings.closeNowConfirmTitle', 'Close registration now?'),
        message,
        acceptText: t('regionSettings.closeNow', 'Close registration'),
        cancelText: t('ui.cancel', 'Cancel')
      })
    : window.confirm(message);
  if (!ok) return;

  const enabled = $('#settingsEnabled');
  const autoOpen = $('#settingsAutoOpen');
  if (enabled) enabled.value = 'false';
  if (autoOpen) autoOpen.checked = false;
  currentSettings = { ...(currentSettings || {}), enabled: false, autoOpenEnabled: false, openAtMs: 0, closeAtMs: Date.now(), closedAtMs: Date.now() };
  updatePreview();
  await save({ preventDefault() {} }, { enabled: false, autoOpenEnabled: false, openNewCycle: false, forceCloseNow: true });
  setStatus(t('regionSettings.closeNowSaved', 'Registration has been closed.'), 'success');
}

function clearAllianceForm() {
  editingAllianceId = '';
  $('#allianceTag') && ($('#allianceTag').value = '');
  $('#allianceName') && ($('#allianceName').value = '');
  $('#allianceNote') && ($('#allianceNote').value = '');
  $('#allianceSaveBtn') && ($('#allianceSaveBtn').textContent = t('region.saveAlliance', 'Save alliance'));
  $('#allianceTag')?.removeAttribute('readonly');
}

function renderAlliances() {
  const list = $('#regionAllianceList');
  const counter = $('#regionAllianceCount');
  if (counter) counter.textContent = tv('region.allianceCount', '{count} alliances', { count: currentAlliances.length });
  if (!list) return;
  if (!currentAlliances.length) {
    list.innerHTML = `<div class="region-empty">${escapeHtml(t('regionSettings.noAlliancesYet', 'No alliances yet. Add the first tag for this region.'))}</div>`;
    renderRegionColorBuilder();
    return;
  }
  const sorted = currentAlliances.slice().sort((a, b) => Number(isAllianceInvalid(b.tag || b.id)) - Number(isAllianceInvalid(a.tag || a.id)) || String(a.tag || a.id).localeCompare(String(b.tag || b.id), document.documentElement.lang || 'en', { numeric: true, sensitivity: 'variant' }));
  list.innerHTML = sorted.map((alliance, index) => {
    const tag = alliance.tag || alliance.id || '';
    const invalid = isAllianceInvalid(tag);
    const status = invalid ? `<small class="region-alliance-warning">${escapeHtml(t('regionSettings.needThreeChars', '3 characters required'))}</small>` : '';
    return `<article class="region-alliance-card ${invalid ? 'is-invalid' : 'is-ok'}">
      <div class="region-alliance-card-main">${allianceBadge(tag, index)}<span>${escapeHtml(alliance.name || tag || alliance.id)}</span>${status}${alliance.note ? `<small>${escapeHtml(alliance.note)}</small>` : ''}</div>
      <div class="region-alliance-actions">
        ${canEditRegionAllianceColor(tag) ? `<button class="btn" type="button" data-edit-alliance="${escapeHtml(alliance.id)}">${escapeHtml(t('common.edit', 'Edit'))}</button>` : ''}
        ${canDeleteRegionAlliance(tag) ? `<button class="btn farm-delete" type="button" data-delete-alliance="${escapeHtml(alliance.id)}">${escapeHtml(t('common.delete', 'Delete'))}</button>` : ''}
      </div>
    </article>`;
  }).join('');
  renderRegionColorBuilder();
}

async function refreshAlliances() {
  if (!currentRegion) return;
  const stored = await listRegionAlliances(currentRegion);
  currentAlliances = mergeAllianceLists(stored, configuredAllianceItems(currentSettings));
  window.WKD = window.WKD || {};
  window.WKD.regionAllianceColorMap = Object.fromEntries(currentAlliances.map(item => [normalizeAllianceTag(item.tag || item.id), hueFromValue(item.colorHue)]).filter(([, hue]) => hue !== null));
  document.dispatchEvent(new CustomEvent('wkd:alliance-colors-updated', { detail: { source: 'region-settings-load', region: currentRegion } }));
  renderAlliances();
  updateHostAllianceDatalist();
  renderRotationModal();
  updateRotationSummary();
}

async function saveAlliance(event) {
  event.preventDefault();
  const tag = normalizeAllianceTag($('#allianceTag')?.value);
  const name = trim($('#allianceName')?.value);
  const note = trim($('#allianceNote')?.value);
  if (!tag) {
    setAllianceStatus(t('regionSettings.enterAllianceTag', 'Enter an alliance tag.'), 'error');
    return;
  }
  if (isAllianceInvalid(tag)) {
    setAllianceStatus(t('region.allianceTagLengthRequired', 'Alliance tag must contain exactly 3 symbols.'), 'error');
    return;
  }
  if (!canEditRegionAllianceColor(tag)) {
    setAllianceStatus(t('regionSettings.allianceSaveFailed', 'Could not save alliance. Check access rights.'), 'error');
    return;
  }
  try {
    setAllianceStatus(t('regionSettings.savingAlliance', 'Saving alliance...'), 'muted');
    if (editingAllianceId && normalizeAllianceTag(editingAllianceId) !== tag) {
      await deleteRegionAlliance(currentUser, currentRegion, editingAllianceId).catch(error => console.warn('Old alliance tag delete skipped:', error));
    }
    const saved = await saveRegionAlliance(currentUser, currentRegion, { id: tag, tag, name, note });
    currentAlliances = currentAlliances.filter(item => normalizeAllianceTag(item.id || item.tag) !== normalizeAllianceTag(saved.id || saved.tag) && normalizeAllianceTag(item.id || item.tag) !== normalizeAllianceTag(editingAllianceId));
    currentAlliances.push(saved);
    selectedRegionColorTag = normalizeAllianceTag(saved.tag || saved.id);
    clearAllianceForm();
    renderAlliances();
    try { await refreshAlliances(); } catch (refreshError) { console.warn('Alliance refresh skipped after save', refreshError); }
    setAllianceStatus(t('regionSettings.allianceSaved', 'Alliance saved.'), 'success');
  } catch (error) {
    console.error(error);
    const existing = currentAlliances.some(item => normalizeAllianceTag(item.id || item.tag) === normalizeAllianceTag(tag));
    if (existing) {
      renderAlliances();
      setAllianceStatus(t('regionSettings.allianceSaved', 'Alliance saved.'), 'success');
      return;
    }
    setAllianceStatus(t('regionSettings.allianceSaveFailed', 'Could not save alliance. Check access rights.'), 'error');
  }
}

function editAlliance(id) {
  const alliance = currentAlliances.find(item => item.id === id);
  if (!alliance) return;
  editingAllianceId = alliance.id;
  $('#allianceTag') && ($('#allianceTag').value = alliance.tag || alliance.id);
  $('#allianceName') && ($('#allianceName').value = alliance.name || '');
  $('#allianceNote') && ($('#allianceNote').value = alliance.note || '');
  $('#allianceSaveBtn') && ($('#allianceSaveBtn').textContent = t('common.saveChanges', 'Save changes'));
  $('#allianceTag')?.removeAttribute('readonly');
  setAllianceStatus(tv('regionSettings.editingAlliance', 'Editing alliance {tag}.', { tag: alliance.tag || alliance.id }), 'muted');
}

async function removeAlliance(id) {
  const alliance = currentAlliances.find(item => item.id === id);
  if (!canDeleteRegionAlliance(alliance?.tag || id)) {
    setAllianceStatus(t('regionSettings.allianceDeleteFailed', 'Could not delete alliance.'), 'error');
    return;
  }
  const ok = window.WKD?.confirmDialog
    ? await window.WKD.confirmDialog({
      title: t('regionSettings.deleteAllianceTitle', 'Delete alliance?'),
      message: tv('regionSettings.deleteAllianceMessage', 'Alliance {tag} will be removed from this region list.', { tag: alliance?.tag || id }),
      note: t('regionSettings.deleteAllianceNote', 'Player requests will not be deleted.'),
      icon: '✕',
      acceptText: t('common.delete', 'Delete')
    })
    : window.confirm(t('regionSettings.deleteAllianceTitle', 'Delete alliance?'));
  if (!ok) return;
  try {
    setAllianceStatus(t('regionSettings.deletingAlliance', 'Deleting alliance...'), 'muted');
    await deleteRegionAlliance(currentUser, currentRegion, id);
    if (editingAllianceId === id) clearAllianceForm();
    await refreshAlliances();
    setAllianceStatus(t('regionSettings.allianceDeleted', 'Alliance deleted.'), 'success');
  } catch (error) {
    console.error(error);
    setAllianceStatus(t('regionSettings.allianceDeleteFailed', 'Could not delete alliance.'), 'error');
  }
}


function ensureRotationModal() {
  let backdrop = $('#regionRotationBackdrop');
  if (backdrop) return backdrop;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `<div class="region-rotation-backdrop" id="regionRotationBackdrop" hidden>
    <section class="region-rotation-modal" role="dialog" aria-modal="true" aria-labelledby="regionRotationTitle">
      <div class="region-rotation-head">
        <div>
          <p class="auth-eyebrow" data-i18n="regionSettings.rotationEyebrow">Черга альянсів</p>
          <h3 id="regionRotationTitle" data-i18n="regionSettings.rotationTitle">Ротація альянсів</h3>
          <small data-i18n="regionSettings.rotationHelp">Додай альянси у чергу Пустоші. Поточний альянс підсвічується.</small>
        </div>
        <button class="btn btn-icon" id="closeRotationModalBtn" type="button" aria-label="Close" data-i18n-aria-label="common.close">✕</button>
      </div>
      <div class="region-rotation-body">
        <div class="region-check-grid region-rotation-toggles">
          <label class="region-check"><input id="rotationEnabled" type="checkbox" /> <span data-i18n="regionSettings.rotationEnabled">Активувати ротацію</span></label>
          <label class="region-check"><input id="rotationLoop" type="checkbox" /> <span data-i18n="regionSettings.rotationLoop">Йти по колу</span></label>
        </div>
        <div class="region-rotation-add">
          <label class="region-field"><span data-i18n="regionSettings.rotationPickAlliance">Вибрати зі списку</span><select id="rotationAllianceSelect"></select></label>
          <label class="region-field"><span data-i18n="regionSettings.rotationManualTag">Або вписати тег</span><input id="rotationManualTag" maxlength="3" placeholder="YYY" /></label>
          <button class="btn" id="addRotationAllianceBtn" type="button" data-i18n="regionSettings.rotationAddAlliance">Додати альянс</button>
        </div>
        <div class="region-rotation-current" id="rotationCurrentText" data-i18n="regionSettings.rotationCurrentEmpty">Поточний альянс ще не вибрано.</div>
        <div class="region-rotation-list" id="rotationAllianceList"></div>
      </div>
      <div class="region-rotation-actions">
        <button class="btn" id="cancelRotationModalBtn" type="button" data-i18n="ui.cancel">Скасувати</button>
        <button class="btn region-save" id="saveRotationModalBtn" type="button" data-i18n="regionSettings.rotationSave">Зберегти ротацію</button>
      </div>
    </section>
  </div>`;
  backdrop = wrapper.firstElementChild;
  if (!backdrop) return null;
  document.body.appendChild(backdrop);
  window.WKD_applyI18n?.(backdrop);
  return backdrop;
}


function renderRotationModal() {
  const canManageRotation = canManageRotationSettings();
  const readOnly = !canManageRotation;
  const enabled = $('#rotationEnabled');
  const loop = $('#rotationLoop');
  const select = $('#rotationAllianceSelect');
  const listBox = $('#rotationAllianceList');
  const current = $('#rotationCurrentText');
  if (enabled) { enabled.checked = Boolean(rotationDraft.enabled); enabled.disabled = readOnly; }
  if (loop) { loop.checked = Boolean(rotationDraft.loop); loop.disabled = readOnly; }
  const tags = collectAllianceTags().filter(tag => !rotationDraft.alliances.some(item => item.tag === tag));
  if (select) {
    select.innerHTML = tags.length
      ? tags.map(tag => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('')
      : `<option value="">${escapeHtml(t('regionSettings.noAllianceInList', 'No alliance in the list'))}</option>`;
  }
  const normalized = normalizeRotation(rotationDraft.alliances);
  rotationDraft.alliances = normalized;
  if (rotationDraft.activeIndex >= normalized.length) rotationDraft.activeIndex = Math.max(0, normalized.length - 1);
  const active = normalized[rotationDraft.activeIndex];
  if (current) current.innerHTML = active
    ? tv('regionSettings.rotationCurrentAlliance', 'Current Wasteland alliance: {tag}', { tag: active.tag })
    : t('regionSettings.rotationCurrentEmpty', 'Current alliance is not selected yet.');
  if (!listBox) return;
  listBox.innerHTML = normalized.length ? normalized.map((item, index) => {
    const activeClass = index === rotationDraft.activeIndex ? ' is-current' : '';
    return `<article class="region-rotation-item${activeClass}" draggable="${canManageRotation ? 'true' : 'false'}" data-rotation-index="${index}">
      <span class="region-rotation-drag" aria-hidden="true">☰</span>
      ${allianceBadge(item.tag, index)}
      <strong>${escapeHtml(item.name || item.tag)}</strong>
      <span class="region-rotation-current-badge">${index === rotationDraft.activeIndex ? escapeHtml(t('regionSettings.rotationCurrentBadge', 'Current')) : ''}</span>
      <div class="region-rotation-item-actions">
        <button class="btn btn-sm" type="button" data-rotation-up="${index}" ${readOnly || index === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn btn-sm" type="button" data-rotation-down="${index}" ${readOnly || index === normalized.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn btn-sm" type="button" data-rotation-current="${index}" ${readOnly ? 'disabled' : ''}>${escapeHtml(t('regionSettings.rotationSetCurrent', 'Set current'))}</button>
        <button class="btn btn-sm farm-delete" type="button" data-rotation-delete="${index}" ${readOnly ? 'disabled' : ''}>×</button>
      </div>
    </article>`;
  }).join('') : `<div class="region-empty">${escapeHtml(t('regionSettings.rotationEmpty', 'No alliances in rotation yet.'))}</div>`;
}
function openRotationModal() {
  if (!canViewRotationSettings()) { setStatus(t('regionSettings.rotationAccessDenied', 'Only the region consul, admin or moderator can configure rotation.'), 'error'); return; }
  rotationDraft = {
    enabled: Boolean(currentSettings?.rotationEnabled ?? rotationDraft.enabled),
    loop: 'rotationLoop' in (currentSettings || {}) ? Boolean(currentSettings.rotationLoop) : Boolean(rotationDraft.loop ?? true),
    activeIndex: Number(currentSettings?.rotationActiveIndex ?? rotationDraft.activeIndex) || 0,
    alliances: normalizeRotation(currentSettings?.rotationAlliances || rotationDraft.alliances || [])
  };
  const backdrop = ensureRotationModal();
  if (!backdrop) { setStatus(t('regionSettings.rotationOpenFailed', 'Не вдалося відкрити вікно ротації.'), 'error'); return; }
  backdrop.hidden = false;
  renderRotationModal();
}
function closeRotationModal() {
  $('#regionRotationBackdrop') && ($('#regionRotationBackdrop').hidden = true);
}
function addRotationAlliance() {
  if (!canManageRotationSettings()) return;
  const picked = normalizeAllianceTag($('#rotationAllianceSelect')?.value);
  const manual = normalizeAllianceTag($('#rotationManualTag')?.value);
  const tag = manual || picked;
  if (!tag || rotationDraft.alliances.some(item => item.tag === tag)) return;
  let record = allianceRecord(tag);
  if (!record) {
    record = { id: tag, tag, name: tag, note: '' };
    currentAlliances = [...currentAlliances, record].filter(Boolean);
    updateHostAllianceDatalist();
  }
  rotationDraft.alliances.push({ tag, name: trim(record?.name || tag) });
  rotationDraft.enabled = true;
  if ($('#rotationManualTag')) $('#rotationManualTag').value = '';
  if (rotationDraft.alliances.length === 1) rotationDraft.activeIndex = 0;
  renderRotationModal();
}
function moveRotationAlliance(from, to) {
  if (!canManageRotationSettings()) return;
  const list = rotationDraft.alliances;
  if (to < 0 || to >= list.length || from === to) return;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  if (rotationDraft.activeIndex === from) rotationDraft.activeIndex = to;
  else if (from < rotationDraft.activeIndex && to >= rotationDraft.activeIndex) rotationDraft.activeIndex -= 1;
  else if (from > rotationDraft.activeIndex && to <= rotationDraft.activeIndex) rotationDraft.activeIndex += 1;
  renderRotationModal();
}
async function deleteRotationAlliance(index) {
  if (!canManageRotationSettings()) return;
  const item = rotationDraft.alliances[index];
  if (!item) return;
  const ok = window.WKD?.confirmDialog
    ? await window.WKD.confirmDialog({
      title: t('regionSettings.rotationDeleteTitle', 'Remove alliance from rotation?'),
      message: tv('regionSettings.rotationDeleteMessage', 'Alliance {tag} will be removed from the rotation list.', { tag: item.tag }),
      note: t('regionSettings.rotationDeleteNote', 'The alliance itself will stay in the region alliance list.'),
      icon: '⚠',
      acceptText: t('common.delete', 'Delete')
    })
    : window.confirm(t('regionSettings.rotationDeleteTitle', 'Remove alliance from rotation?'));
  if (!ok) return;
  rotationDraft.alliances.splice(index, 1);
  rotationDraft.activeIndex = Math.max(0, Math.min(rotationDraft.activeIndex, rotationDraft.alliances.length - 1));
  renderRotationModal();
}
async function saveRotationDraft(event) {
  event?.preventDefault?.();
  if (!canManageRotationSettings()) return;

  const saveBtn = $('#saveRotationModalBtn');
  if (saveBtn?.disabled) return;

  rotationDraft.enabled = $('#rotationEnabled')?.checked ?? rotationDraft.enabled;
  rotationDraft.loop = $('#rotationLoop')?.checked ?? rotationDraft.loop;
  rotationDraft.alliances = normalizeRotation(rotationDraft.alliances);
  rotationDraft.activeIndex = Math.max(0, Math.min(Math.max(0, rotationDraft.alliances.length - 1), Number(rotationDraft.activeIndex) || 0));

  const active = rotationDraft.alliances[rotationDraft.activeIndex] || null;
  if (active && $('#settingsHostAlliance')) $('#settingsHostAlliance').value = active.tag;

  const overrides = {
    rotationEnabled: Boolean(rotationDraft.enabled),
    rotationLoop: Boolean(rotationDraft.loop),
    rotationActiveIndex: Number(rotationDraft.activeIndex) || 0,
    rotationAlliances: normalizeRotation(rotationDraft.alliances),
    hostAlliance: active?.tag || $('#settingsHostAlliance')?.value || ''
  };

  try {
    if (saveBtn) saveBtn.disabled = true;
    setStatus(t('regionSettings.rotationSaving', 'Зберігаю ротацію альянсів...'), 'muted');
    await save({ preventDefault() {} }, overrides);
    rotationDraft = {
      enabled: Boolean(currentSettings?.rotationEnabled ?? overrides.rotationEnabled),
      loop: 'rotationLoop' in (currentSettings || {}) ? Boolean(currentSettings.rotationLoop) : Boolean(overrides.rotationLoop),
      activeIndex: Number(currentSettings?.rotationActiveIndex ?? overrides.rotationActiveIndex) || 0,
      alliances: normalizeRotation(currentSettings?.rotationAlliances || overrides.rotationAlliances || [])
    };
    updateRotationSummary(currentSettings || overrides);
    closeRotationModal();
    setStatus(t('regionSettings.rotationSaved', 'Ротацію альянсів збережено в базі.'), 'success');
  } catch (error) {
    console.error('[WKD] rotation save failed:', error);
    setStatus(t('regionSettings.rotationSaveFailed', 'Не вдалося зберегти ротацію. Перевір права доступу.'), 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function copyShareLink(inputId = 'regionShareLink') {
  const input = $(`#${inputId}`);
  if (!input?.value) return;
  try {
    await navigator.clipboard.writeText(input.value);
    setStatus(t('region.linkCopiedPublic', 'Link copied. You can send it to players without site registration.'), 'success');
  } catch {
    input.select();
    document.execCommand('copy');
    setStatus(t('region.linkSelectedManual', 'Link selected. Copy it manually if the browser did not allow copying.'), 'warn');
  }
}

async function loadRegionEditorSettings(region) {
  const safeRegion = normalizeRegion(region);
  if (!safeRegion) return null;
  try {
    const cached = await readRegionFormSettingsD1(safeRegion, { force: true, ttlMs: 0 });
    if (cached?.settings) {
      const code = cleanShareCode(cached.code || cached.settings?.shortLinkCode || cached.settings?.code || '');
      return { ...cached.settings, shortLinkCode: code, code };
    }
  } catch (error) {
    if (window.WKD_DEBUG) console.warn('[WKD] D1 region form settings unavailable for editor:', error?.message || error);
  }
  return getRegionSettings(safeRegion);
}

async function load(user) {
  currentUser = user;
  if (!user) {
    setStatus(t('regionSettings.signInRequired', 'Увійди через Google, щоб налаштувати форму.'), 'warn');
    setTimeout(() => { window.location.href = 'login.html'; }, 800);
    return;
  }
  await saveSignedInUser(user).catch(() => null);
  const { profile, region } = await getMyRegionContext(user, readRegionFromUrl());
  currentProfile = profile;
  currentRegion = region;
  currentCanViewAnyRegion = canViewAnyRegion(profile, user);
  updateRegionPill(region);
  await refreshRegionSwitcher();

  const baseSettings = await loadRegionEditorSettings(region);
  const canManageFullRegion = canManageRegion(profile, region, user);
  const canLeadActiveRotation = canLeadCurrentRotation(profile, region, user, baseSettings || {});
  if (!canManageFullRegion && !canLeadActiveRotation) {
    setStatus(t('regionSettings.accessDenied', 'Only an admin, moderator, consul, or active-alliance R4/R5 officer can edit the region form.'), 'error');
    return;
  }

  resetArchiveState();
  const settings = canManageFullRegion
    ? (await ensureRegionRegistrationRunInfo(user, region).catch(error => {
        console.warn('[WKD] registration run info repair skipped:', error);
        return null;
      }) || baseSettings || await getRegionSettings(region))
    : (baseSettings || await getRegionSettings(region));
  const d1ShareCode = cleanShareCode(baseSettings?.shortLinkCode || baseSettings?.code || '');
  currentShareCode = d1ShareCode || (canManageFullRegion ? await getRegionShareLinkCode(user, region).catch(error => {
    console.warn('Short registration link unavailable', error);
    return '';
  }) : cleanShareCode(currentSettings?.shortLinkCode || ''));
  fill({ ...settings, shortLinkCode: currentShareCode, code: currentShareCode });
  $('#regionSettingsForm').hidden = false;
  await refreshAlliances().catch(error => {
    console.warn('Alliance list failed', error);
    currentAlliances = configuredAllianceItems(settings);
    renderAlliances();
  });
  setStatus(t('regionSettings.readyStatus', 'Configure the form, close time and secret link for players in your region.'), 'success');
}

function bind() {
  updateSettingsTabsLayout();
  ensureRotationModal();
  $('#regionSettingsForm')?.addEventListener('submit', save);
  $('#openAddRegionBtn')?.addEventListener('click', () => toggleManualRegionForm());
  $('#cancelAddRegionBtn')?.addEventListener('click', () => toggleManualRegionForm(false));
  $('#regionManualAddForm')?.addEventListener('submit', saveManualRegionFromSettings);
  $('#startRegistrationNowBtn')?.addEventListener('click', () => startRegistrationNow().catch(error => {
    console.error(error);
    setStatus(t('regionSettings.saveFailed', 'Could not save the form. Check access rights.'), 'error');
  }));
  $('#closeRegistrationNowBtn')?.addEventListener('click', () => closeRegistrationNow().catch(error => {
    console.error(error);
    setStatus(t('regionSettings.saveFailed', 'Could not save the form. Check access rights.'), 'error');
  }));
  $('#regionSettingsRegionSelect')?.addEventListener('change', event => switchRegion(event.currentTarget.value).catch(error => {
    console.error(error);
    setStatus(t('regionSettings.openFailed', 'Could not open region settings.'), 'error');
  }));
  $('#regionAllianceForm')?.addEventListener('submit', saveAlliance);
  $('#allianceClearBtn')?.addEventListener('click', clearAllianceForm);
  $('#addCustomTroopBtn')?.addEventListener('click', addCustomTroop);
  $('#addCustomFieldBtn')?.addEventListener('click', addCustomField);
  $('#addCustomShiftBtn')?.addEventListener('click', addCustomShift);
  $('#settingsCustomTroopName')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addCustomTroop(); } });
  $('#settingsCustomFieldLabel')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addCustomField(); } });
  $('#settingsCustomShiftLabel')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addCustomShift(); } });
  $('#settingsCustomTroopList')?.addEventListener('click', event => {
    const id = event.target.closest('[data-remove-custom-troop]')?.dataset.removeCustomTroop;
    if (id) removeCustomTroop(id);
  });
  $('#settingsCustomFieldList')?.addEventListener('click', event => {
    const id = event.target.closest('[data-remove-custom-field]')?.dataset.removeCustomField;
    if (id) removeCustomField(id);
  });
  $('#settingsShiftDefaultList')?.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-custom-shift]');
    const id = button?.dataset.removeCustomShift;
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    removeCustomShift(id);
  });
  $('#openRotationModalBtn')?.addEventListener('click', openRotationModal);
  $('#closeRotationModalBtn')?.addEventListener('click', closeRotationModal);
  $('#cancelRotationModalBtn')?.addEventListener('click', closeRotationModal);
  $('#saveRotationModalBtn')?.addEventListener('click', saveRotationDraft);
  $('#addRotationAllianceBtn')?.addEventListener('click', addRotationAlliance);
  ['#allianceTag', '#rotationManualTag', '#settingsHostAlliance'].forEach(selector => {
    const input = $(selector);
    input?.addEventListener('input', () => { input.value = normalizeAllianceTag(input.value); });
  });
  $('#rotationManualTag')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addRotationAlliance(); } });
  $('#rotationEnabled')?.addEventListener('change', event => { rotationDraft.enabled = event.currentTarget.checked; renderRotationModal(); });
  $('#rotationLoop')?.addEventListener('change', event => { rotationDraft.loop = event.currentTarget.checked; renderRotationModal(); });
  $('#regionRotationBackdrop')?.addEventListener('click', event => { if (event.target.id === 'regionRotationBackdrop') closeRotationModal(); });
  $('#rotationAllianceList')?.addEventListener('click', event => {
    const currentButton = event.target.closest('[data-rotation-current]');
    const upButton = event.target.closest('[data-rotation-up]');
    const downButton = event.target.closest('[data-rotation-down]');
    const deleteButton = event.target.closest('[data-rotation-delete]');
    if (currentButton) { rotationDraft.activeIndex = Number(currentButton.dataset.rotationCurrent) || 0; renderRotationModal(); }
    if (upButton) moveRotationAlliance(Number(upButton.dataset.rotationUp) || 0, (Number(upButton.dataset.rotationUp) || 0) - 1);
    if (downButton) moveRotationAlliance(Number(downButton.dataset.rotationDown) || 0, (Number(downButton.dataset.rotationDown) || 0) + 1);
    if (deleteButton) deleteRotationAlliance(Number(deleteButton.dataset.rotationDelete) || 0);
  });
  let rotationDragIndex = null;
  $('#rotationAllianceList')?.addEventListener('dragstart', event => { rotationDragIndex = Number(event.target.closest('[data-rotation-index]')?.dataset.rotationIndex); });
  $('#rotationAllianceList')?.addEventListener('dragover', event => { if (event.target.closest('[data-rotation-index]')) event.preventDefault(); });
  $('#rotationAllianceList')?.addEventListener('drop', event => {
    const targetIndex = Number(event.target.closest('[data-rotation-index]')?.dataset.rotationIndex);
    if (Number.isFinite(rotationDragIndex) && Number.isFinite(targetIndex)) moveRotationAlliance(rotationDragIndex, targetIndex);
    rotationDragIndex = null;
  });
  $('#copyRegionShareBtn')?.addEventListener('click', () => copyShareLink('regionShareLink'));
  $('#regionAllianceList')?.addEventListener('click', event => {
    const editId = event.target.closest('[data-edit-alliance]')?.dataset.editAlliance;
    const deleteId = event.target.closest('[data-delete-alliance]')?.dataset.deleteAlliance;
    if (editId) editAlliance(editId);
    if (deleteId) removeAlliance(deleteId);
  });
  $$('[data-region-alliance-subtab]').forEach(button => {
    button.addEventListener('click', () => setRegionAllianceSubtab(button.dataset.regionAllianceSubtab));
  });
  $('#regionAllianceColorPreview')?.addEventListener('click', event => {
    const item = event.target.closest('[data-region-color-tag]');
    if (!item) return;
    selectedRegionColorTag = trim(item.dataset.regionColorTag);
    renderRegionColorBuilder();
  });
  $('#regionAlliancePalette')?.addEventListener('click', event => {
    const swatch = event.target.closest('[data-region-color-hue]');
    if (!swatch) return;
    saveRegionAllianceColor(selectedRegionColorTag, Number(swatch.dataset.regionColorHue));
  });
  $('#regionAllianceAutoColorBtn')?.addEventListener('click', () => saveRegionAllianceColor(selectedRegionColorTag, Math.floor(Math.random() * 360)));
  $('#regionAllianceResetColorBtn')?.addEventListener('click', () => saveRegionAllianceColor(selectedRegionColorTag, null));
  $('#regionRegeneratePaletteBtn')?.addEventListener('click', () => {
    localStorage.setItem(colorBuilderKey, String((colorOffset() + 37) % 360));
    renderRegionColorBuilder();
  });
  $('#refreshArchiveCyclesBtn')?.addEventListener('click', () => loadArchiveCycles(true).catch(error => {
    console.warn(error);
    setDynamicText('#regionArchiveStatus', t('regionSettings.archiveLoadFailed', 'Не вдалося завантажити архів D1. Firebase fallback не запускався, щоб не витрачати reads.'));
  }));
  $('#regionArchiveCycleList')?.addEventListener('click', event => {
    const cycleId = event.target.closest('[data-view-archive-cycle]')?.dataset.viewArchiveCycle;
    if (cycleId) viewArchiveCycle(cycleId, 1);
  });
  $('#regionArchivePrevBtn')?.addEventListener('click', () => viewArchiveCycle(archiveSelectedCycleId, Math.max(1, archivePage - 1)));
  $('#regionArchiveNextBtn')?.addEventListener('click', () => viewArchiveCycle(archiveSelectedCycleId, Math.min(archiveTotalPages, archivePage + 1)));
  $('#regionArchiveSearchBtn')?.addEventListener('click', () => {
    archiveSearch = trim($('#regionArchiveSearch')?.value || '');
    viewArchiveCycle(archiveSelectedCycleId, 1);
  });
  $('#regionArchiveCopyLocalBtn')?.addEventListener('click', () => copyArchiveCycleToLocal());
  $('#regionArchiveRestoreD1Btn')?.addEventListener('click', () => restoreArchiveCycleToActiveD1());
  $('#regionArchiveSearch')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      archiveSearch = trim(event.currentTarget.value || '');
      viewArchiveCycle(archiveSelectedCycleId, 1);
    }
  });
  $$('[data-region-settings-tab]').forEach(button => {
    button.addEventListener('click', () => activateSettingsTab(button.dataset.regionSettingsTab));
  });
  ['#settingsEventStart', '#settingsCloseRule', '#settingsCloseHours', '#settingsAutoOpen', '#settingsAutoOpenDay', '#settingsAutoOpenTime'].forEach(selector => {
    $(selector)?.addEventListener('input', updatePreview);
    $(selector)?.addEventListener('change', updatePreview);
  });
}

async function init() {
  if (ready) return;
  ready = true;
  bind();
  activateSettingsTab('form');
  await watchAuth(user => load(user).catch(error => {
    console.error(error);
    setStatus(t('regionSettings.openFailed', 'Could not open region settings.'), 'error');
  }));
}

document.addEventListener('wkd:partials-ready', init);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
} else {
  setTimeout(init, 0);
}

document.addEventListener('wkd:language-changed', () => {
  if (!ready) return;
  updateRegionPill();
  if (currentUser && currentRegion) setStatus(t('regionSettings.readyStatus', 'Configure the form, close time and secret link for players in your region.'), 'success');
  if (editingAllianceId) setAllianceStatus(tv('regionSettings.editingAlliance', 'Editing alliance {tag}.', { tag: $('#allianceTag')?.value || editingAllianceId }), 'muted');
  if (currentSettings) {
    $('#settingsDescription') && ($('#settingsDescription').value = localizedDefaultText(currentSettings.description, 'region.formDefaultDescription', 'Заповни заявку для свого регіону. Консул або офіцер побачить її в таблиці регіону.'));
  }
  renderRuleLists();
  renderAlliances();
  renderRegionColorBuilder();
  updateSettingsTabsLayout();
  renderArchiveCycleList();
  renderRotationModal();
  updateRotationSummary();
  updatePreview();
});

document.addEventListener('wkd:time-display-changed', () => {
  if (ready) updatePreview();
});
