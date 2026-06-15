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
  return value.includes('?') ? value : `${value}?staffEmbed=1`;
}

function setFrameHeight(iframe) {
  const desired = Number(iframe?.dataset?.staffHeight || 0) || 1100;
  iframe.style.height = `${Math.max(720, desired)}px`;
}

function decorateFrame(iframe) {
  try {
    const doc = iframe.contentDocument;
    if (!doc?.head || !doc?.body) return;
    doc.documentElement.classList.add('staff-embedded-page');
    doc.body.classList.add('staff-embedded-page');
    if (!doc.getElementById('staffEmbedStyle')) {
      const style = doc.createElement('style');
      style.id = 'staffEmbedStyle';
      style.textContent = `
        .app-header, .site-footer, .drawer, [data-include*="partials/header"], [data-include*="partials/footer"], [data-include*="contact-modal"] { display: none !important; }
        html, body { width: 100% !important; max-width: 100% !important; min-height: 0 !important; background: transparent !important; overflow-x: hidden !important; }
        body { margin: 0 !important; padding: 0 !important; background: transparent !important; }
        main, main.container, .page-shell, .container, .profile-page.container, .region-page.container, .public-region-table-page.container, .admin-page.container, .stats-page.container {
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          padding-top: 0 !important;
          box-sizing: border-box !important;
        }
        .profile-card, .region-card, .region-table-card, .region-settings-page, .admin-card, .admin-panel, .stats-card, .profile-card--tabs, .region-form-shell, .region-shell {
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          box-sizing: border-box !important;
        }
        .region-card.region-table-card, .profile-card.region-card, .region-settings-page { padding-left: clamp(18px, 2vw, 30px) !important; padding-right: clamp(18px, 2vw, 30px) !important; }
        .region-table-wrap, .admin-table-wrap, .table-scroll, .players-table-wrap { max-width: 100% !important; }
      `;
      doc.head.appendChild(style);
    }
    setFrameHeight(iframe);
  } catch (error) {
    console.warn('[WKD] staff embed styling skipped:', error);
  }
}

function loadFrameForTab(tab) {
  const iframe = document.querySelector(`[data-staff-panel="${tab}"] [data-staff-frame]`);
  if (!iframe) return;
  setFrameHeight(iframe);
  if (!iframe.dataset.loaded) {
    iframe.src = normalizeEmbedUrl(iframe.dataset.staffSrc);
    iframe.dataset.loaded = '1';
  }
  iframe.addEventListener('load', () => decorateFrame(iframe), { once: false });
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
