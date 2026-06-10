import { resolveRegionTableShare, troopLabel, shiftLabel } from '../services/region-db.js?v=117';
import { readShareCode, keepShareCodeInUrl } from '../core/share-links.js?v=89';
import { isRegionTableCacheEnabled, readRegionTableShare } from '../services/region-table-cache.js?v=106';

const $ = selector => document.querySelector(selector);
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let ready = false;

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
function rowHtml(row = {}) {
  const badges = window.WKD?.Badges || {};
  const alliance = (badges.alliance || ((tag)=>`<span class="alliance-badge"><span class="badge-dot"></span><span>${esc(tag || '—')}</span></span>`))(row.alliance || '—', { region: row.region });
  const troop = (badges.troop || ((type,label)=>`<span class="tag ${esc(type || '')}">${esc(label || type || '—')}</span>`))(row.troopType, troopLabel(row.troopType) || row.troopLabel || '—');
  const tier = (badges.tier || (value => esc(value || '—')))(row.tier);
  const captain = (badges.captain || (value => `<span class="captain-badge ${value ? 'yes' : 'no'}">${esc(value ? t('common.yes','Так') : t('common.no','Ні'))}</span>`))(Boolean(row.captainReady));
  const shift = (badges.shift || ((value,label)=>`<span class="shift-badge">${esc(label || value || '—')}</span>`))(row.shift, shiftLabel(row.shift) || row.shiftLabel || '—');
  return `<tr><td>${esc(row.nickname || '—')}</td><td>${alliance}</td><td>${troop}</td><td>${tier}</td><td>${formatNumber(row.marchSize)}</td><td>${formatNumber(row.rallySize)}</td><td>${captain}</td><td>${shift}</td></tr>`;
}
async function init() {
  if (ready) return;
  ready = true;
  const code = codeFromUrl();
  keepShareCodeInUrl('regionTable', code);
  if (!code) { setStatus(t('region.publicTableMissing', 'Секретне посилання неправильне або неповне.'), 'error'); return; }
  try {
    let data = null;
    if (isRegionTableCacheEnabled()) {
      data = await readRegionTableShare(code).catch(error => {
        console.warn('[WKD] public region table JSON cache unavailable, using Firebase share:', error);
        return null;
      });
    }
    if (!data) data = await resolveRegionTableShare(code);
    $('#publicRegionTablePill') && ($('#publicRegionTablePill').textContent = data.region ? `R${data.region}` : 'R—');
    const rows = Array.isArray(data.rows) ? data.rows : [];
    const body = $('#publicRegionTableBody');
    if (body) body.setAttribute('data-no-auto-i18n', '1');
    if (body) body.innerHTML = rows.length ? rows.map(rowHtml).join('') : `<tr><td colspan="8">${esc(t('region.table.emptyCycle', 'У цьому активному наборі ще немає гравців або заявок.'))}</td></tr>`;
    setStatus(t('region.publicTableReady', 'Таблицю регіону відкрито за секретним посиланням.'), 'success');
  } catch (error) {
    console.error(error);
    setStatus(t('region.publicTableNotFound', 'Таблицю регіону не знайдено або посилання вже недійсне.'), 'error');
  }
}
document.addEventListener('wkd:partials-ready', init);
document.addEventListener('click', event => {
  if (event.target?.closest?.('#refreshPublicRegionTableBtn')) window.location.reload();
});
if (document.readyState !== 'loading') window.setTimeout(init, 0);
else document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
