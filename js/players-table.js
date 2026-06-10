window.WKD = window.WKD || {};
const t = (key, fallback) => window.WKD_t ? window.WKD_t(key) : fallback;

WKD.initPlayersTable = () => {
  const { $, $$, state } = WKD;
  if (!$('#playersTbody')) {
    state.players = state.players
      .map((row, index) => finalizePlayer(normalizeStoredPlayer(row), row, index))
      .filter(player => player.name);
    return;
  }
  state.players = state.players
    .map((row, index) => finalizePlayer(normalizeStoredPlayer(row), row, index))
    .filter(player => player.name);
  if (document.documentElement.dataset.wkdPlayersTableReady === '1') {
    WKD.renderPlayers?.();
    return;
  }
  document.documentElement.dataset.wkdPlayersTableReady = '1';

  ['searchFilter', 'roleFilter', 'shiftFilter', 'statusFilter', 'tierFilter', 'pageSizeSelect'].forEach(id => {
    $('#' + id).addEventListener('input', () => {
      state.page = 1;
      state.pageSize = $('#pageSizeSelect').value === 'all' ? 'all' : Number($('#pageSizeSelect').value || 10);
      WKD.renderPlayers();
    });
  });

  $('#resetFiltersBtn').addEventListener('click', () => {
    $('#searchFilter').value = '';
    ['roleFilter', 'shiftFilter', 'statusFilter', 'tierFilter'].forEach(id => $('#' + id).value = 'all');
    $('#pageSizeSelect').value = '10';
    state.page = 1;
    state.pageSize = 10;
    WKD.renderPlayers();
  });

  $('#showAllDataBtn').addEventListener('click', () => {
    state.showOptional = !state.showOptional;
    $('#showAllDataBtn').setAttribute('aria-pressed', String(state.showOptional));
    $('#showAllDataBtn').textContent = state.showOptional ? t('players.hideOptional', 'Сховати зайві дані') : t('players.showOptional', 'Показати всі дані');
    $$('.optional-col').forEach(el => el.classList.toggle('is-hidden-col', !state.showOptional));
  });

  $$('.sort-btn[data-sort]').forEach(button => button.addEventListener('click', () => {
    const field = button.dataset.sort;
    state.sort.dir = state.sort.field === field ? state.sort.dir * -1 : 1;
    state.sort.field = field;
    $$('.sort-btn').forEach(btn => btn.classList.remove('is-desc'));
    button.classList.toggle('is-desc', state.sort.dir < 0);
    WKD.renderPlayers();
  }));

  $('#pagePrevBtn').addEventListener('click', () => {
    state.page = Math.max(1, state.page - 1);
    WKD.renderPlayers();
  });
  $('#pageNextBtn').addEventListener('click', () => {
    state.page += 1;
    WKD.renderPlayers();
  });

  WKD.renderPlayers();
  if (typeof WKD.updateShiftVisibility === 'function') WKD.updateShiftVisibility();
};

WKD.setPlayers = (rows, options = {}) => {
  const persist = options.persist !== false;
  const alreadyNormalized = options.normalized === true;
  const source = options.source || '';
  WKD.state.players = (Array.isArray(rows) ? rows : [])
    .map((row, index) => finalizePlayer(alreadyNormalized ? normalizeStoredPlayer(row) : normalizePlayer(row), row, index, source))
    .filter(player => player.name);
  WKD.state.page = 1;
  if (persist) WKD.saveJson(WKD.storageKeys.players, WKD.state.players);
  else if (options.clearStorage === true) localStorage.removeItem(WKD.storageKeys.players);
  WKD.renderPlayers();
  document.dispatchEvent(new CustomEvent('wkd:players-updated', { detail: { source: options.eventSource || source, persist } }));
};

WKD.renderPlayers = () => {
  renderStats();
  renderTable();
};

function normalizeYesNoText(value) {
  const text = WKD.clean(value).toLowerCase();
  if (!text) return '';
  if (/^(1|true|yes|y|так|да|готов|можна)$/i.test(text)) return 'Так';
  if (/^(0|false|no|n|ні|нет)$/i.test(text)) return 'Ні';
  return WKD.clean(value);
}
function clampLairLevel(value) {
  const n = Number(String(value ?? '').replace(/[^0-9]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(Math.max(1, Math.min(70, Math.round(n))));
}

function normalizePlayer(row) {
  return {
    name: WKD.clean(WKD.getMappedValue(row, 'name')),
    alliance: WKD.clean(WKD.getMappedValue(row, 'alliance')),
    role: normalizeRole(WKD.getMappedValue(row, 'role')),
    tier: normalizeTier(WKD.getMappedValue(row, 'tier')),
    march: toNumber(WKD.getMappedValue(row, 'march')),
    rally: toNumber(WKD.getMappedValue(row, 'rally')),
    captain: normalizeYes(WKD.getMappedValue(row, 'captain') || row.captain || row.captainReady || row['Готовність бути капітаном'] || row['готовність бути капітаном'] || row['Captain readiness'] || row['Captain ready']),
    shift: normalizeShift(WKD.getMappedValue(row, 'shift')),
    lair: normalizeYesNoText(WKD.getMappedValue(row, 'lair')),
    lairLevel: clampLairLevel(WKD.getMappedValue(row, 'lairLevel')),
    registeredAt: findRegistrationValue(row),
    source: row.source || 'excel'
  };
}

function normalizeStoredPlayer(player) {
  const captainValue = Object.prototype.hasOwnProperty.call(player, 'captain') ? player.captain : player.captainReady;
  return {
    name: WKD.clean(player.name),
    alliance: WKD.clean(player.alliance),
    role: normalizeRole(player.role),
    tier: normalizeTier(player.tier),
    march: toNumber(player.march),
    rally: toNumber(player.rally),
    captain: normalizeYes(captainValue),
    shift: normalizeShift(player.shift || player.shiftLabel || player.registeredShift),
    lair: normalizeYesNoText(player.lair || player.captureRegion || player.capture),
    lairLevel: clampLairLevel(player.lairLevel),
    registeredAt: player.registeredAt || player.registered_at || player.createdAt || player.created_at || player.submittedAt || player.updatedAt || '',
    source: player.source || 'excel',
    id: player.id || '',
    uid: player.uid || '',
    regionNumber: player.regionNumber || player.region || '',
    regionRegistrationId: player.regionRegistrationId || '',
    dbSource: player.dbSource || '',
    _rowId: player._rowId || player.id || player.uid || ''
  };
}

function finalizePlayer(player, row = {}, index = 0, source = '') {
  const id = player._rowId || row._rowId || row.id || row.uid || row.docId || makeRowId(player, index);
  return {
    ...player,
    ...(source ? { source } : null),
    _rowId: String(id)
  };
}

function makeRowId(player = {}, index = 0) {
  const seed = [player.name, player.alliance, player.shift, player.tier, player.march, player.rally, index]
    .map(value => String(value ?? '').trim().toLowerCase())
    .join('|');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return `local-${index + 1}-${Math.abs(hash).toString(36)}`;
}

function findRegistrationValue(row = {}) {
  const direct = row.registeredAt || row.registered_at || row.createdAt || row.created_at || row.submittedAt || row.updatedAt || '';
  if (direct) return direct;
  const keyRe = /(timestamp|time\s*stamp|registration|registered(?:\s*at)?|created\s*at|submitted|дата.*реє|час.*реє|дата.*рег|время.*рег|відмітк.*час|отметк.*врем)/i;
  const key = Object.keys(row || {}).find(name => keyRe.test(String(name || '')) && String(row[name] ?? '').trim());
  return key ? row[key] : '';
}

function renderStats() {
  const players = WKD.state.players;
  const setText = (selector, value) => {
    const element = WKD.$(selector);
    if (element) element.textContent = value;
  };
  setText('#totalPlayers', players.length);
  setText('#captainsReady', players.filter(p => p.captain).length);
  setText('#fighterCount', players.filter(p => p.role === 'Fighter').length);
  setText('#riderCount', players.filter(p => p.role === 'Rider').length);
  setText('#shooterCount', players.filter(p => p.role === 'Shooter').length);
  setText('#shift1Count', players.filter(p => p.shift === 'shift1').length);
  setText('#shift2Count', players.filter(p => p.shift === 'shift2').length);
  setText('#shift3Count', players.filter(p => p.shift === 'shift3').length);
  setText('#shift4Count', players.filter(p => p.shift === 'shift4').length);
  setText('#bothCount', players.filter(p => p.shift === 'both').length);
}

function renderTable() {
  const state = WKD.state;
  const tbody = WKD.$('#playersTbody');
  if (!tbody) {
    document.dispatchEvent(new CustomEvent('wkd:players-rendered', { detail: { total: state.players.length, shown: 0 } }));
    return;
  }
  const list = filteredPlayers();
  const pageSize = state.pageSize === 'all' ? list.length || 1 : state.pageSize;
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  state.page = Math.min(state.page, totalPages);
  const pageRows = list.slice((state.page - 1) * pageSize, state.page * pageSize);

  if (!state.players.length) tbody.innerHTML = `<tr><td colspan="11" class="empty-cell">${t('players.emptyImport', 'Імпортуй Excel або CSV файл, щоб показати гравців.')}</td></tr>`;
  else if (!pageRows.length) tbody.innerHTML = `<tr><td colspan="11" class="empty-cell">${t('players.emptyFilters', 'Немає гравців за вибраними фільтрами.')}</td></tr>`;
  else tbody.innerHTML = pageRows.map(rowTemplate).join('');

  const pageInfo = WKD.$('#pageInfoText');
  const pagePrev = WKD.$('#pagePrevBtn');
  const pageNext = WKD.$('#pageNextBtn');
  if (pageInfo) pageInfo.textContent = `${t('common.page', 'Сторінка')} ${state.page} / ${totalPages} • ${t('common.shown', 'показано')} ${list.length}`;
  if (pagePrev) pagePrev.disabled = state.page <= 1;
  if (pageNext) pageNext.disabled = state.page >= totalPages;
  document.dispatchEvent(new CustomEvent('wkd:players-rendered', { detail: { total: state.players.length, shown: pageRows.length } }));
}

function filteredPlayers() {
  const { $, state } = WKD;
  const rawQuery = $('#searchFilter').value.trim();
  const query = rawQuery.toLowerCase();
  const role = $('#roleFilter').value;
  const shift = $('#shiftFilter').value;
  const status = $('#statusFilter').value;
  const tier = $('#tierFilter').value;

  let list = state.players.filter(player => {
    const nickText = String(player.name || '').toLowerCase();
    const allianceText = String(player.alliance || '').trim();
    // Nick search is case-insensitive. Alliance search is case-sensitive, so YYY, yyy and YyY are different alliances.
    if (rawQuery && !nickText.includes(query) && !allianceText.includes(rawQuery)) return false;
    if (role !== 'all' && player.role !== role) return false;
    if (shift !== 'all' && player.shift !== shift) return false;
    if (tier !== 'all' && player.tier !== tier) return false;
    if (status === 'captains' && !player.captain) return false;
    return true;
  });

  if (state.sort.field) {
    list = [...list].sort((a, b) => compareValues(a[state.sort.field], b[state.sort.field]) * state.sort.dir);
  }
  return list;
}

function rowTemplate(player) {
  const playerIndex = WKD.state.players.indexOf(player);
  const rowId = player._rowId || '';
  return `<tr data-player-index="${playerIndex}" data-player-id="${WKD.escapeHtml(rowId)}">
    <td data-field="name">${WKD.escapeHtml(player.name)}</td>
    <td data-field="alliance">${allianceBadge(player.alliance)}</td>
    <td data-field="role"><span class="tag ${roleClass(player.role)}">${roleLabel(player.role)}</span></td>
    <td data-field="tier">${tierBadge(player.tier)}</td>
    <td data-field="march">${WKD.formatNumber(player.march)}</td>
    <td data-field="rally">${WKD.formatNumber(player.rally)}</td>
    <td data-field="captainReady"><span class="captain-badge ${player.captain ? 'yes' : 'no'}">${player.captain ? t('common.yes', 'Так') : t('common.no', 'Ні')}</span></td>
    <td data-field="shiftLabel"><span class="shift-badge ${player.shift}">${shiftLabel(player.shift)}</span></td>
    <td data-field="lair" class="optional-col ${WKD.state.showOptional ? '' : 'is-hidden-col'}">${WKD.escapeHtml(player.lair || '—')}</td>
    <td data-field="lairLevel" class="optional-col ${WKD.state.showOptional ? '' : 'is-hidden-col'}">${WKD.escapeHtml(player.lairLevel || '—')}</td>
    <td data-field="actions">${placementTemplate(player)}</td>
  </tr>`;
}

function placementTemplate(player = {}) {
  const count = Math.max(1, Math.min(4, Number(WKD.getActiveShiftCount?.() || 2)));
  const id = String(player._rowId || player.id || player.uid || '');
  const assigned = typeof WKD.getPlayerTowerAssignment === 'function' ? WKD.getPlayerTowerAssignment(id) : null;
  const items = Array.from({ length: count }, (_, index) => {
    const shift = `shift${index + 1}`;
    const isHere = assigned && assigned.shift === shift;
    const title = isHere ? assigned.towerName : t('common.reserve', 'Резерв');
    const sub = isHere ? assigned.roleLabel : (player.placement && player.placement !== 'Резерв' ? player.placement : t('common.notAssigned', 'Не призначено'));
    return `
    <span class="placement-item ${isHere ? 'is-assigned' : ''}" data-placement-shift="${index + 1}">
      <b>${t('common.shift', 'Зміна')} ${index + 1}</b>
      <strong>${WKD.escapeHtml(title)}</strong>
      <small>${WKD.escapeHtml(sub)}</small>
    </span>`;
  }).join('');
  return `<div class="placement-card" style="--placement-cols:${count}">${items}<button class="placement-edit" type="button" aria-label="${t('players.editPlacement', 'Редагувати розміщення')}">✎</button></div>`;
}

function allianceBadge(alliance) {
  const safe = String(alliance || '—').trim() || '—';
  const hue = window.WKD?.Badges?.hashHue ? window.WKD.Badges.hashHue(safe) : hashHue(safe);
  if (window.WKD?.Badges?.alliance) {
    return window.WKD.Badges.alliance(safe, { preserve: true, hue });
  }
  const text = WKD.escapeHtml(safe);
  return `<span class="alliance-badge" style="--ally-hue:${hue}"><span class="badge-dot"></span><span>${text}</span></span>`;
}

function tierBadge(tier) {
  const safe = WKD.escapeHtml(tier || '—');
  const number = Number(String(tier).replace(/[^0-9]/g, '')) || 0;
  return `<span class="tier-badge tier-badge--t${number || 'unknown'}" data-tier-level="${number}" style="${tierVars(number)}"><span class="badge-dot"></span><span>${safe}</span></span>`;
}


function tierVars(number) {
  const palette = {
    14:['rgba(255,184,77,.26)','rgba(255,213,102,.82)','rgba(255,198,70,.30)','#ffd86e'],
    13:['rgba(255,111,199,.24)','rgba(255,134,219,.76)','rgba(255,111,199,.28)','#ff9ddd'],
    12:['rgba(156,111,255,.24)','rgba(178,154,255,.76)','rgba(156,111,255,.27)','#c5b4ff'],
    11:['rgba(82,145,255,.24)','rgba(126,175,255,.76)','rgba(82,145,255,.25)','#94bdff'],
    10:['rgba(238,94,188,.22)','rgba(255,137,220,.68)','rgba(238,94,188,.25)','#ff9cdd'],
    9:['rgba(202,102,255,.22)','rgba(224,153,255,.64)','rgba(202,102,255,.23)','#e4a6ff'],
    8:['rgba(70,205,150,.20)','rgba(100,232,174,.62)','rgba(70,205,150,.22)','#80f0bd'],
    7:['rgba(255,169,74,.20)','rgba(255,190,96,.60)','rgba(255,169,74,.21)','#ffc56c'],
    6:['rgba(76,217,255,.20)','rgba(105,226,255,.58)','rgba(76,217,255,.20)','#89efff'],
    5:['rgba(101,255,155,.18)','rgba(130,255,177,.56)','rgba(101,255,155,.18)','#9affc3'],
    4:['rgba(255,118,118,.18)','rgba(255,148,148,.54)','rgba(255,118,118,.18)','#ffaaaa'],
    3:['rgba(255,216,80,.18)','rgba(255,226,108,.52)','rgba(255,216,80,.17)','#ffe678'],
    2:['rgba(116,144,255,.18)','rgba(150,170,255,.52)','rgba(116,144,255,.16)','#afc0ff'],
    1:['rgba(190,204,226,.16)','rgba(220,231,248,.44)','rgba(190,204,226,.13)','#e6efff']
  };
  const item = palette[number] || ['rgba(148,163,184,.16)','rgba(203,213,225,.44)','rgba(148,163,184,.14)','#e2e8f0'];
  return `--tier-bg:${item[0]};--tier-border:${item[1]};--tier-glow:${item[2]};--tier-accent:${item[3]};`;
}

function hashHue(value) {
  const hash = [...String(value)].reduce((sum, ch) => ((sum << 5) - sum + ch.charCodeAt(0)) | 0, 0);
  return ((hash % 360) + 360) % 360;
}

function toNumber(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function normalizeTier(value) {
  const text = WKD.clean(value).toUpperCase();
  const found = text.match(/T?\s*(\d{1,2})/);
  return found ? `T${found[1]}` : text;
}

function normalizeYes(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  const text = WKD.clean(value).toLowerCase().normalize('NFKC');
  if (!text) return false;
  const negative = ['0', 'false', 'no', 'n', 'ні', 'нi', 'нет', 'не готов', 'not ready', 'відмова', 'отказ', 'decline'];
  if (negative.some(token => text === token || text.includes(token))) return false;
  const positive = ['1', 'true', 'yes', 'y', 'так', 'да', 'готов', 'готовий', 'готова', 'ready', 'ok', 'можу', 'может', 'can'];
  if (positive.some(token => text === token || text.includes(token))) return true;
  return /✅|✔|\+/.test(text);
}

function normalizeRole(value) {
  const text = WKD.clean(value).toLowerCase();
  if (/fighter|fighters|infantry|боец|боєць|бійц|бойц|воїн|воин|піхот|пехот|fight|wojownik|wojown|kämpfer|kaempfer|ファイター|战士|戰士|전사|đấu sĩ|dau si|مقاتل|المقاتل/.test(text)) return 'Fighter';
  if (/rider|riders|cavalry|наїз|наезд|ездник|кавал|ride|jeźdź|jezdz|reiter|ライダー|骑兵|騎兵|기병|kỵ sĩ|ky si|فارس|فرسان|الفرسان/.test(text)) return 'Rider';
  if (/shooter|shooters|стрілець|стрільц|стрел|shoot|marksman|strzel|schütz|schuetz|シューター|射手|사수|xạ thủ|xa thu|رامي|الرماة/.test(text)) return 'Shooter';
  return WKD.clean(value) || '—';
}

function normalizeShift(value) {
  const raw = WKD.clean(value);
  const ruled = WKD.applyShiftRule?.(raw);
  if (ruled) return ruled;
  const text = raw.toLowerCase();
  if (/both|all|всі|все|обидві|обе/.test(text)) return 'both';
  if (/4/.test(text)) return 'shift4';
  if (/3/.test(text)) return 'shift3';
  if (/2/.test(text)) return 'shift2';
  if (/1/.test(text)) return 'shift1';
  return 'both';
}

function compareValues(a, b) {
  const an = Number(String(a).replace(/[^0-9.-]/g, ''));
  const bn = Number(String(b).replace(/[^0-9.-]/g, ''));
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return String(a ?? '').localeCompare(String(b ?? ''), 'uk', { numeric: true, sensitivity: 'base' });
}

function roleClass(role) {
  return role === 'Fighter' ? 'fighter' : role === 'Rider' ? 'rider' : role === 'Shooter' ? 'shooter' : '';
}

function roleLabel(role) {
  return role === 'Fighter' ? t('troop.fighter', 'Бійці') : role === 'Rider' ? t('troop.rider', 'Наїзники') : role === 'Shooter' ? t('troop.shooter', 'Стрільці') : WKD.escapeHtml(role || '—');
}

function shiftLabel(shift) {
  return { shift1: t('shift.shift1', 'Зміна 1'), shift2: t('shift.shift2', 'Зміна 2'), shift3: t('shift.shift3', 'Зміна 3'), shift4: t('shift.shift4', 'Зміна 4'), both: t('shift.both', 'Обидві') }[shift] || t('common.all', 'Всі');
}


document.addEventListener('wkd:alliance-colors-updated', () => { if (window.WKD?.renderPlayers) window.WKD.renderPlayers(); });

document.addEventListener('wkd:language-changed', () => { if (window.WKD?.renderPlayers) window.WKD.renderPlayers(); });


WKD.allianceBadge = WKD.Badges?.alliance || allianceBadge;
WKD.tierBadge = WKD.Badges?.tier || tierBadge;
WKD.captainBadge = WKD.Badges?.captain || (value => `<span class="captain-badge ${value ? 'yes' : 'no'}">${value ? t('common.yes', 'Так') : t('common.no', 'Ні')}</span>`);
WKD.troopRoleClass = roleClass;
WKD.troopRoleLabel = roleLabel;
