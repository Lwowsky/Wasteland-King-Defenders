import { troopLabel, shiftLabel } from '../services/region-db.js?v=073';
import { readShareCode, keepShareCodeInUrl } from '../core/share-links.js?v=073';
import { isRegionTableCacheEnabled, readRegionTableShare } from '../services/region-table-cache.js?v=073';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

let ready = false;
let allRows = [];
let filteredRows = [];
let state = { page: 1, pageSize: 10, sort: 'registeredAt', dir: 'desc', search: '', troop: 'all', shift: 'all', tier: 'all' };

function codeFromUrl() {
  return readShareCode('regionTable', {
    blockedPathNames: ['rt', 'public-region-table'],
    pathRegex: /\/rt\/([A-Za-z0-9_-]{6,120})\/?$/
  });
}
function setStatus(text, type = 'muted') {
  const box = $('#publicRegionTableStatus');
  if (!box) return;
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
}
function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number.toLocaleString('uk-UA') : '—';
}
function registeredMs(row = {}) {
  return Number(row.submittedAtMs || row.registeredAtMs || row.createdAtMs || row.updatedAtMs || 0) || 0;
}
function formatDate(value) {
  const ms = Number(value) || 0;
  if (!ms) return '—';
  try { return new Intl.DateTimeFormat(document.documentElement.lang || undefined, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ms)); }
  catch { return new Date(ms).toLocaleString(); }
}
function normalizeText(value) { return String(value || '').trim().toLowerCase(); }
function boolValue(value) {
  if (value === true || value === false) return value;
  const text = normalizeText(value);
  if (!text) return false;
  if (/^(0|false|no|ні|нi|нет|nope|n)$/.test(text)) return false;
  return /^(1|true|yes|так|да|はい|是|예|y)$/.test(text);
}
function tierNumber(value = '') { return Number(String(value || '').replace(/[^0-9]/g, '')) || 0; }
function isBothShift(value = '') {
  const raw = normalizeText(value);
  return ['both', 'all', 'both_shifts', 'bothshifts', 'обидві', 'всі'].includes(raw);
}
function rowShiftKey(row = {}) {
  const value = row.shift || row.shiftLabel || '';
  if (isBothShift(value)) return 'both';
  const raw = normalizeText(value);
  if (raw.includes('2') || raw.includes('друга')) return 'shift2';
  if (raw.includes('1') || raw.includes('перша')) return 'shift1';
  return raw || '—';
}
function rowTroopKey(row = {}) { return normalizeText(row.troopType || row.troopLabel || ''); }
function rowHtml(row = {}) {
  const badges = window.WKD?.Badges || {};
  const alliance = (badges.alliance || ((tag)=>`<span class="alliance-badge"><span class="badge-dot"></span><span>${esc(tag || '—')}</span></span>`))(row.alliance || '—', { region: row.region });
  const troop = (badges.troop || ((type,label)=>`<span class="tag ${esc(type || '')}">${esc(label || type || '—')}</span>`))(row.troopType, troopLabel(row.troopType) || row.troopLabel || '—');
  const tier = (badges.tier || (value => esc(value || '—')))(row.tier);
  const captain = (badges.captain || (value => `<span class="captain-badge ${value ? 'yes' : 'no'}">${esc(value ? t('common.yes','Так') : t('common.no','Ні'))}</span>`))(boolValue(row.captainReady));
  const shift = (badges.shift || ((value,label)=>`<span class="shift-badge">${esc(label || value || '—')}</span>`))(row.shift, shiftLabel(row.shift) || row.shiftLabel || '—');
  const registered = formatDate(registeredMs(row));
  const labels = {
    nickname: t('account.nickname', 'Нік'),
    alliance: t('account.alliance', 'Альянс'),
    troop: t('playerEdit.troopType', 'Тип'),
    tier: t('playerEdit.tier', 'Тір'),
    march: t('playerEdit.march', 'Марш'),
    rally: t('playerEdit.rally', 'Ралі'),
    captain: t('players.captain', 'Капітан'),
    shift: t('common.shift', 'Зміна'),
    registered: t('region.publicTableRegisteredAt', 'Зареєстрований')
  };
  return `<tr><td data-label="${esc(labels.nickname)}"><strong>${esc(row.nickname || '—')}</strong></td><td data-label="${esc(labels.alliance)}">${alliance}</td><td data-label="${esc(labels.troop)}">${troop}</td><td data-label="${esc(labels.tier)}">${tier}</td><td data-label="${esc(labels.march)}">${formatNumber(row.marchSize)}</td><td data-label="${esc(labels.rally)}">${formatNumber(row.rallySize)}</td><td data-label="${esc(labels.captain)}">${captain}</td><td data-label="${esc(labels.shift)}">${shift}</td><td data-label="${esc(labels.registered)}"><small>${esc(registered)}</small></td></tr>`;
}
function setNumber(id, value) { const el = $(id); if (el) el.textContent = String(value || 0); }
function renderStats(rows = allRows) {
  setNumber('#prtTotalPlayers', rows.length);
  setNumber('#prtCaptainsReady', rows.filter(row => row.captainReady).length);
  setNumber('#prtFighters', rows.filter(row => rowTroopKey(row) === 'fighter').length);
  setNumber('#prtRiders', rows.filter(row => rowTroopKey(row) === 'rider').length);
  setNumber('#prtShooters', rows.filter(row => rowTroopKey(row) === 'shooter').length);
  setNumber('#prtShift1', rows.filter(row => rowShiftKey(row) === 'shift1').length);
  setNumber('#prtShift2', rows.filter(row => rowShiftKey(row) === 'shift2').length);
  setNumber('#prtBoth', rows.filter(row => rowShiftKey(row) === 'both').length);
}
function populateTierFilter(rows = allRows) {
  const select = $('#prtTier');
  if (!select) return;
  const current = select.value || 'all';
  const tiers = [...new Set(rows.map(row => String(row.tier || '').toUpperCase()).filter(Boolean))].sort((a, b) => tierNumber(b) - tierNumber(a) || a.localeCompare(b));
  select.innerHTML = `<option value="all">${esc(t('common.all', 'Усі'))}</option>` + tiers.map(tier => `<option value="${esc(tier)}">${esc(tier)}</option>`).join('');
  select.value = tiers.includes(current) ? current : 'all';
  state.tier = select.value || 'all';
}
function applyFilters() {
  const search = normalizeText(state.search);
  filteredRows = allRows.filter(row => {
    if (search) {
      const hay = [row.nickname, row.alliance, row.tier, row.troopType, troopLabel(row.troopType), row.shift, shiftLabel(row.shift)].map(normalizeText).join(' ');
      if (!hay.includes(search)) return false;
    }
    if (state.troop !== 'all' && rowTroopKey(row) !== state.troop) return false;
    if (state.shift !== 'all' && rowShiftKey(row) !== state.shift) return false;
    if (state.tier !== 'all' && String(row.tier || '').toUpperCase() !== state.tier) return false;
    return true;
  });
  sortRows();
}
function compareRows(a, b) {
  const dir = state.dir === 'asc' ? 1 : -1;
  const field = state.sort;
  if (field === 'registeredAt') return (registeredMs(a) - registeredMs(b)) * dir || String(a.nickname || '').localeCompare(String(b.nickname || ''));
  if (field === 'tier') return (tierNumber(a.tier) - tierNumber(b.tier)) * dir || String(a.nickname || '').localeCompare(String(b.nickname || ''));
  if (['marchSize', 'rallySize'].includes(field)) return ((Number(a[field]) || 0) - (Number(b[field]) || 0)) * dir || String(a.nickname || '').localeCompare(String(b.nickname || ''));
  if (field === 'captainReady') return ((a.captainReady ? 1 : 0) - (b.captainReady ? 1 : 0)) * dir || String(a.nickname || '').localeCompare(String(b.nickname || ''));
  return String(a[field] || '').localeCompare(String(b[field] || ''), undefined, { sensitivity: 'base' }) * dir || String(a.nickname || '').localeCompare(String(b.nickname || ''));
}
function sortRows() { filteredRows.sort(compareRows); }
function renderSortArrows() {
  $$('[data-sort-arrow]').forEach(el => {
    const key = el.dataset.sortArrow;
    el.textContent = key === state.sort ? (state.dir === 'asc' ? '↑' : '↓') : '↕';
    el.classList.toggle('is-active', key === state.sort);
  });
}
function renderTable() {
  applyFilters();
  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const start = (state.page - 1) * state.pageSize;
  const visible = filteredRows.slice(start, start + state.pageSize);
  const body = $('#publicRegionTableBody');
  if (body) {
    body.setAttribute('data-no-auto-i18n', '1');
    body.innerHTML = visible.length ? visible.map(rowHtml).join('') : `<tr><td colspan="9">${esc(t('region.table.emptyCycle', 'У цьому активному наборі ще немає гравців або заявок.'))}</td></tr>`;
  }
  const info = $('#prtPageInfo');
  if (info) info.textContent = t('region.publicTablePageInfo', 'Показано {from}–{to} з {total}').replace('{from}', total ? start + 1 : 0).replace('{to}', Math.min(total, start + visible.length)).replace('{total}', total);
  const label = $('#prtPageLabel');
  if (label) label.textContent = `${state.page} / ${totalPages}`;
  $('#prtPrev') && ($('#prtPrev').disabled = state.page <= 1);
  $('#prtNext') && ($('#prtNext').disabled = state.page >= totalPages);
  renderSortArrows();
}
function bindControls() {
  $('#prtSearch')?.addEventListener('input', event => { state.search = event.currentTarget.value || ''; state.page = 1; renderTable(); });
  $('#prtTroop')?.addEventListener('change', event => { state.troop = event.currentTarget.value || 'all'; state.page = 1; renderTable(); });
  $('#prtShift')?.addEventListener('change', event => { state.shift = event.currentTarget.value || 'all'; state.page = 1; renderTable(); });
  $('#prtTier')?.addEventListener('change', event => { state.tier = event.currentTarget.value || 'all'; state.page = 1; renderTable(); });
  $('#prtPageSize')?.addEventListener('change', event => { state.pageSize = Math.max(10, Number(event.currentTarget.value) || 10); state.page = 1; renderTable(); });
  $('#prtReset')?.addEventListener('click', () => {
    state = { ...state, page: 1, pageSize: 10, sort: 'registeredAt', dir: 'desc', search: '', troop: 'all', shift: 'all', tier: 'all' };
    $('#prtSearch') && ($('#prtSearch').value = '');
    $('#prtTroop') && ($('#prtTroop').value = 'all');
    $('#prtShift') && ($('#prtShift').value = 'all');
    $('#prtTier') && ($('#prtTier').value = 'all');
    $('#prtPageSize') && ($('#prtPageSize').value = '10');
    renderTable();
  });
  $('#prtPrev')?.addEventListener('click', () => { state.page = Math.max(1, state.page - 1); renderTable(); });
  $('#prtNext')?.addEventListener('click', () => { state.page += 1; renderTable(); });
  document.addEventListener('click', event => {
    const btn = event.target?.closest?.('[data-prt-sort]');
    if (!btn) return;
    const next = btn.dataset.prtSort;
    if (state.sort === next) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    else { state.sort = next; state.dir = next === 'registeredAt' ? 'desc' : 'asc'; }
    state.page = 1;
    renderTable();
  });
}
async function init() {
  if (ready) return;
  ready = true;
  bindControls();
  const code = codeFromUrl();
  keepShareCodeInUrl('regionTable', code);
  if (!code) { setStatus(t('region.publicTableMissing', 'Секретне посилання неправильне або неповне.'), 'error'); return; }
  try {
    if (!isRegionTableCacheEnabled()) throw new Error('region-table-d1-disabled');
    const forceRefresh = new URLSearchParams(location.search).has('refresh');
    const data = await readRegionTableShare(code, { force: forceRefresh }).catch(error => {
      error.message = error.message || 'region-table-d1-share-missing';
      throw error;
    });
    $('#publicRegionTablePill') && ($('#publicRegionTablePill').textContent = data.region ? `R${data.region}` : 'R—');
    allRows = (Array.isArray(data.rows) ? data.rows : []).slice().sort((a, b) => registeredMs(b) - registeredMs(a));
    populateTierFilter(allRows);
    renderStats(allRows);
    $('#publicRegionTableStats') && ($('#publicRegionTableStats').hidden = false);
    $('#publicRegionTableFilters') && ($('#publicRegionTableFilters').hidden = false);
    $('#publicRegionTablePagination') && ($('#publicRegionTablePagination').hidden = false);
    renderTable();
    if (new URLSearchParams(location.search).has('refresh') && window.history?.replaceState) {
      const url = new URL(location.href);
      url.searchParams.delete('refresh');
      window.history.replaceState(window.history.state, document.title, url.toString());
    }
    setStatus(t('region.publicTableReady', 'Таблицю регіону відкрито за секретним посиланням.'), 'success');
  } catch (error) {
    console.error(error);
    setStatus(t('region.publicTableD1Missing', 'Таблицю регіону ще не опубліковано в D1. Попроси консула або офіцера оновити/створити секретне посилання ще раз.'), 'error');
  }
}
document.addEventListener('wkd:partials-ready', init);
document.addEventListener('click', event => {
  if (event.target?.closest?.('#refreshPublicRegionTableBtn')) {
    event.preventDefault();
    const url = new URL(location.href);
    url.searchParams.set('refresh', String(Date.now()));
    location.href = url.toString();
  }
});
if (document.readyState !== 'loading') window.setTimeout(init, 0);
else document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
