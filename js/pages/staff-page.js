import { watchAuth } from '../services/firebase-service.js';
import {
  canUseStaffPanel,
  canStaffEditPlayer,
  getGameProfile,
  getUserFarms,
  getUserProfile,
  listStaffRegionPlayers,
  roleLabel,
  staffRankOptionsForTarget,
  staffRoleOptionsForTarget,
  updateRegionPlayerByStaff
} from '../services/user-db.js';

const $ = selector => document.querySelector(selector);
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : fallback;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'": '&#39;' }[char]));
const normalizeRegion = value => String(value || '').replace(/[^0-9]/g, '');
const normalizeAlliance = value => String(value || '').trim().toUpperCase().slice(0, 3);
const normalizeRank = value => String(value || 'p1').trim().toLowerCase();

const STAFF_TABS = {
  players: { labelKey: 'staff.playersTitle', label: 'Гравці регіону' },
  'region-table': { labelKey: 'region.table', label: 'Таблиця регіону' },
  'region-settings': { labelKey: 'region.settings', label: 'Форма регіону' },
  'action-log': { labelKey: 'actionLog.title', label: 'Журнал дій' }
};

function badge(name, value, fallback = '') {
  const badges = window.WKD?.Badges || {};
  if (typeof badges[name] === 'function') return badges[name](value);
  return fallback || esc(value || '—');
}

function normalizeEmbedUrl(url = '') {
  const value = String(url || '').trim();
  if (!value) return '';
  const resolved = new URL(value, window.location.href);
  resolved.searchParams.set('staffEmbed', '1');
  resolved.searchParams.set('staffv', '245');
  return resolved.toString();
}

function setFrameHeight(iframe) {
  const desired = Number(iframe?.dataset?.staffHeight || 0) || 1200;
  iframe.style.height = `${Math.max(720, desired)}px`;
}

function stripShellFromHtml(html = '') {
  return String(html || '')
    .replace(/<div\s+data-include=["']partials\/header\.html["']\s*><\/div>/gi, '')
    .replace(/<div\s+class=["']container["']>\s*<div\s+data-include=["']partials\/footer\.html["']\s*><\/div>\s*<\/div>/gi, '')
    .replace(/<div\s+data-include=["']partials\/footer\.html["']\s*><\/div>/gi, '')
    .replace(/<div\s+data-include=["']partials\/contact-modal\.html["']\s*><\/div>/gi, '');
}

function buildEmbedSrcdoc(html = '') {
  const baseHref = new URL('./', window.location.href).href;
  const embedStyle = `
    <style id="staffEmbedSrcdocStyle">
      html, body { width:100% !important; max-width:none !important; min-width:0 !important; margin:0 !important; padding:0 !important; background:transparent !important; overflow-x:hidden !important; }
      .app-header, .site-footer, .drawer, [data-include*="partials/header"], [data-include*="partials/footer"], [data-include*="contact-modal"] { display:none !important; }
      main, main.container, .container, .profile-page, .profile-page.container, .page-shell { width:100% !important; max-width:none !important; min-width:0 !important; margin:0 !important; padding:0 !important; display:block !important; place-items:initial !important; box-sizing:border-box !important; }
      .profile-card, .region-card, .region-table-card, .region-settings-page, .action-log-page, .admin-card, .admin-panel, .region-shell, .region-form-shell { width:100% !important; max-width:none !important; min-width:0 !important; margin:0 !important; box-sizing:border-box !important; }
      .region-card.region-table-card, .region-settings-page, .action-log-page { padding-left:clamp(18px,2vw,30px) !important; padding-right:clamp(18px,2vw,30px) !important; }
      .admin-table-wrap, .region-table-wrap, .action-log-table-wrap, .table-scroll, .players-table-wrap { width:100% !important; max-width:none !important; min-width:0 !important; }
    </style>`;
  let output = stripShellFromHtml(html);
  output = output.replace(/<html([^>]*)>/i, '<html$1 class="staff-embedded-page">');
  output = output.replace(/<body([^>]*)>/i, '<body$1 class="staff-embedded-page">');
  if (/<head[^>]*>/i.test(output)) {
    output = output.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">${embedStyle}`);
  } else {
    output = `<base href="${baseHref}">${embedStyle}${output}`;
  }
  return output;
}

async function loadFrameForTab(tab) {
  const iframe = document.querySelector(`[data-staff-panel="${tab}"] [data-staff-frame]`);
  if (!iframe) return;
  iframe.setAttribute('scrolling', 'no');
  iframe.style.overflow = 'hidden';
  setFrameHeight(iframe);
  if (iframe.dataset.loaded) return;
  iframe.dataset.ready = '0';
  iframe.dataset.loaded = '1';
  const url = normalizeEmbedUrl(iframe.dataset.staffSrc);
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    iframe.srcdoc = buildEmbedSrcdoc(await response.text());
    iframe.addEventListener('load', () => { iframe.dataset.ready = '1'; }, { once: true });
  } catch (error) {
    console.error('[WKD] staff embedded tab failed:', error);
    iframe.dataset.ready = '1';
    const message = esc(t('staff.embedLoadFailed', 'Не вдалося завантажити вкладку.'));
    iframe.srcdoc = `<div style="padding:24px;color:#ff9aa8;font:700 16px system-ui;background:#080f1f;border-radius:22px">${message}</div>`;
  }
}

function switchStaffTab(tab = 'players') {
  const safeTab = STAFF_TABS[tab] ? tab : 'players';
  document.querySelectorAll('[data-staff-tab]').forEach(button => {
    const active = button.dataset.staffTab === safeTab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('[data-staff-panel]').forEach(panel => {
    const active = panel.dataset.staffPanel === safeTab;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
  if (safeTab !== 'players') loadFrameForTab(safeTab);
}

function injectStaffDrawerTabs() {
  const drawerBody = document.querySelector('.drawer-body');
  if (!drawerBody || drawerBody.querySelector('.staff-drawer-tabs')) return;
  const wrap = document.createElement('div');
  wrap.className = 'staff-drawer-tabs';
  wrap.innerHTML = `<strong>${esc(t('staff.title', 'Панель регіону'))}</strong>` + Object.entries(STAFF_TABS).map(([key, meta]) => (
    `<button class="staff-drawer-tab" type="button" data-staff-tab="${esc(key)}">${esc(t(meta.labelKey, meta.label))}</button>`
  )).join('');
  const afterAuth = drawerBody.querySelector('.drawer-auth');
  if (afterAuth?.nextSibling) drawerBody.insertBefore(wrap, afterAuth.nextSibling);
  else drawerBody.prepend(wrap);
  wrap.querySelectorAll('[data-staff-tab]').forEach(button => {
    button.addEventListener('click', () => {
      switchStaffTab(button.dataset.staffTab);
      document.getElementById('drawer')?.classList.remove('open');
      document.getElementById('drawer')?.setAttribute('aria-hidden', 'true');
      document.getElementById('burgerBtn')?.setAttribute('aria-expanded', 'false');
    });
  });
}

let ready = false;
let currentUser = null;
let currentProfile = null;
let currentRows = [];
let editRow = null;

function actorGames(profile = {}) {
  const main = { ...getGameProfile(profile), farmId: 'main', role: profile.role || getGameProfile(profile).role || 'player' };
  return [main, ...getUserFarms(profile)].filter(game => normalizeRegion(game.region));
}

function setStatus(message, type = 'muted') {
  const el = $('#staffStatus');
  if (!el) return;
  el.textContent = message;
  el.className = `auth-status ${type ? `is-${type}` : ''}`;
}

function fillRegionSelect() {
  const select = $('#staffRegionSelect');
  if (!select) return;
  const regions = [...new Set(actorGames(currentProfile || {}).map(game => normalizeRegion(game.region)).filter(Boolean))];
  select.innerHTML = regions.map(region => `<option value="${esc(region)}">R${esc(region)}</option>`).join('');
}

function scopeBadge() {
  const region = $('#staffRegionSelect')?.value || normalizeRegion(getGameProfile(currentProfile || {}).region);
  const game = actorGames(currentProfile || {}).find(item => normalizeRegion(item.region) === region) || actorGames(currentProfile || {})[0] || {};
  const role = currentProfile?.role === 'admin' || currentProfile?.role === 'moderator' ? currentProfile.role : (game.role || currentProfile?.role || 'player');
  const rank = String(game.rank || currentProfile?.rank || '').toUpperCase();
  const alliance = normalizeAlliance(game.alliance);
  const text = [`R${region || '—'}`, alliance, roleLabel(role), rank].filter(Boolean).join(' · ');
  if ($('#staffScopeBadge')) $('#staffScopeBadge').textContent = text || '—';
}

async function loadRows() {
  const region = $('#staffRegionSelect')?.value || '';
  const alliance = $('#staffAllianceFilter')?.value || '';
  const nick = $('#staffNickFilter')?.value || '';
  const rank = $('#staffRankFilter')?.value || 'all';
  setStatus(t('staff.loadingPlayers', 'Завантажую гравців регіону...'), 'muted');
  const result = await listStaffRegionPlayers({ region, alliance, nick, rank, limitCount: 350 });
  currentRows = result.users || [];
  if (result.allianceLocked && $('#staffAllianceFilter')) {
    $('#staffAllianceFilter').value = result.alliance || '';
    $('#staffAllianceFilter').disabled = true;
  } else if ($('#staffAllianceFilter')) {
    $('#staffAllianceFilter').disabled = false;
  }
  renderRows();
  scopeBadge();
  setStatus(t('staff.loaded', 'Панель регіону готова.'), 'success');
}

function renderRows() {
  const body = $('#staffPlayersBody');
  if (!body) return;
  if (!currentRows.length) {
    body.innerHTML = `<tr><td colspan="7">${esc(t('staff.empty', 'Гравців не знайдено.'))}</td></tr>`;
    return;
  }
  body.innerHTML = currentRows.map(row => {
    const canEdit = canStaffEditPlayer(currentUser, currentProfile, row);
    return `<tr>
      <td><strong>${esc(row.nickname || row.gameNick || '—')}</strong></td>
      <td>${badge('region', row.region || '—')}</td>
      <td>${badge('alliance', row.alliance || '—')}</td>
      <td>${badge('rank', row.rank || 'p1')}</td>
      <td>${badge('shk', row.shk || '')}</td>
      <td>${badge('role', row.role || 'player')}</td>
      <td>${canEdit ? `<button class="btn btn-sm" type="button" data-edit-staff="${esc(row.uid || row.id)}">${esc(t('common.edit', 'Редагувати'))}</button>` : `<span class="staff-no-action">${esc(t('staff.viewOnly', 'Перегляд'))}</span>`}</td>
    </tr>`;
  }).join('');
  body.querySelectorAll('[data-edit-staff]').forEach(button => {
    button.addEventListener('click', () => openEdit(button.dataset.editStaff));
  });
}

function openEdit(uid) {
  editRow = currentRows.find(row => String(row.uid || row.id) === String(uid));
  if (!editRow) return;
  $('#staffEditName').textContent = `${editRow.nickname || editRow.gameNick || uid} · ${editRow.alliance || '—'} · R${editRow.region || '—'}`;
  const rankOptions = staffRankOptionsForTarget(currentUser, currentProfile, editRow);
  const roleOptions = staffRoleOptionsForTarget(currentUser, currentProfile, editRow);
  const rankSelect = $('#staffEditRank');
  const roleSelect = $('#staffEditRole');
  if (rankSelect) {
    const currentRank = normalizeRank(editRow.rank);
    const options = rankOptions.includes(currentRank) ? rankOptions : [...rankOptions, currentRank];
    rankSelect.innerHTML = options.map(rank => `<option value="${esc(rank)}">${esc(rank.toUpperCase())}</option>`).join('');
    rankSelect.value = currentRank;
  }
  if (roleSelect) {
    const currentRole = editRow.role || 'player';
    const options = roleOptions.includes(currentRole) ? roleOptions : [currentRole];
    roleSelect.innerHTML = options.map(role => `<option value="${esc(role)}">${esc(roleLabel(role))}</option>`).join('');
    roleSelect.value = currentRole;
    roleSelect.disabled = options.length <= 1;
  }
  $('#staffEditModal').hidden = false;
}

function closeEdit() {
  editRow = null;
  $('#staffEditModal').hidden = true;
}

async function saveEdit() {
  if (!editRow) return;
  try {
    setStatus(t('staff.saving', 'Зберігаю зміни...'), 'muted');
    await updateRegionPlayerByStaff(editRow.uid || editRow.id, {
      region: editRow.region,
      rank: $('#staffEditRank')?.value || editRow.rank || 'p1',
      role: $('#staffEditRole')?.value || editRow.role || 'player'
    });
    closeEdit();
    await loadRows();
    setStatus(t('staff.saved', 'Зміни збережено.'), 'success');
  } catch (error) {
    console.error('[WKD] staff save failed:', error);
    setStatus(t('staff.saveFailed', 'Не вдалося зберегти. Перевір права для цього гравця.'), 'error');
  }
}

function bindControls() {
  document.querySelectorAll('[data-staff-tab]').forEach(button => {
    button.addEventListener('click', () => switchStaffTab(button.dataset.staffTab));
  });
  injectStaffDrawerTabs();
  $('#staffRefreshBtn')?.addEventListener('click', loadRows);
  $('#staffRegionSelect')?.addEventListener('change', loadRows);
  $('#staffAllianceFilter')?.addEventListener('change', loadRows);
  $('#staffNickFilter')?.addEventListener('input', () => {
    clearTimeout(window.__wkdStaffSearchTimer);
    window.__wkdStaffSearchTimer = setTimeout(loadRows, 250);
  });
  $('#staffRankFilter')?.addEventListener('change', loadRows);
  $('#staffSaveEditBtn')?.addEventListener('click', saveEdit);
  document.querySelectorAll('[data-staff-close]').forEach(el => el.addEventListener('click', closeEdit));
}

async function initStaffPage() {
  if (ready || !$('#staffPlayersBody')) return;
  ready = true;
  bindControls();
  switchStaffTab('players');

  await watchAuth(async user => {
    currentUser = user;
    if (!user) {
      setStatus(t('staff.loginRequired', 'Потрібно увійти в акаунт.'), 'warn');
      setTimeout(() => { window.location.href = 'login.html'; }, 700);
      return;
    }
    currentProfile = await getUserProfile(user.uid, { forceRefresh: true }).catch(() => null);
    if (!canUseStaffPanel(user, currentProfile)) {
      setStatus(t('staff.noAccess', 'Ця сторінка доступна тільки консулу, офіцеру або R5.'), 'error');
      $('#staffPlayersBody').innerHTML = `<tr><td colspan="7">${esc(t('staff.noAccess', 'Ця сторінка доступна тільки консулу, офіцеру або R5.'))}</td></tr>`;
      return;
    }
    fillRegionSelect();
    scopeBadge();
    await loadRows().catch(error => {
      console.error('[WKD] staff load failed:', error);
      setStatus(t('staff.loadFailed', 'Не вдалося завантажити панель регіону.'), 'error');
    });
  });
}

document.addEventListener('wkd:partials-ready', () => {
  injectStaffDrawerTabs();
  initStaffPage();
});
document.addEventListener('DOMContentLoaded', () => setTimeout(initStaffPage, 0));
document.addEventListener('wkd:language-changed', () => {
  document.querySelectorAll('.staff-drawer-tabs').forEach(node => node.remove());
  injectStaffDrawerTabs();
  scopeBadge();
  renderRows();
});
