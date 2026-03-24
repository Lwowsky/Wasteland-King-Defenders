(function(){
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const t = (key, fallback = '') => (typeof window.PNS?.t === 'function' ? window.PNS.t(key, fallback) : fallback);
  const pager = { page: 1, pageSize: 10, sortField: '', sortDir: 'desc', _raf: 0 };
  const PNS = window.PNS = window.PNS || {};
  const SORTABLE_FIELDS = ['name', 'alliance', 'role', 'tier', 'march', 'rally', 'captainReady', 'shiftLabel', 'lair', 'actions'];

  function getRows() {
    return $$('#playersDataTable tbody tr');
  }

  function parseTierFilter() {
    const select = $('#topTierFilter');
    if (!select) return 'all';
    const value = String(select.value || 'all').trim().toUpperCase();
    return value === 'ALL' || value === 'УСІ' || value === 'ВСІ' ? 'all' : value;
  }

  function parsePageSize() {
    const raw = String($('#pageSizeSelect')?.value || pager.pageSize || '10').trim().toLowerCase();
    if (raw === 'all' || raw === 'усі' || raw === 'всі') return 'all';
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 10;
  }

  function ensureSortButtons() {
    $$('#playersDataTable thead th[data-field]').forEach((th) => {
      const field = String(th.dataset.field || '').trim();
      if (!SORTABLE_FIELDS.includes(field)) return;
      let button = th.querySelector('.sort-btn');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'sort-btn';
        button.dataset.sort = field;
        button.textContent = '↓';
        th.appendChild(document.createTextNode(' '));
        th.appendChild(button);
      }
      button.setAttribute('aria-label', (th.textContent || '').replace(/\s+/g, ' ').trim());
    });
  }

  function normalizeText(value) {
    return typeof PNS.normalizeTopFilterText === 'function'
      ? PNS.normalizeTopFilterText(value)
      : String(value || '').toLowerCase().trim();
  }

  function playerMatchesShift(player, activeShift) {
    const value = typeof PNS.normalizeShiftValue === 'function'
      ? PNS.normalizeShiftValue(player?.shift || player?.shiftLabel || 'both')
      : String(player?.shift || player?.shiftLabel || 'both').toLowerCase();
    return activeShift === 'all' || value === activeShift;
  }

  function getPlayerSearchHaystack(player) {
    if (!player || typeof player !== 'object') return '';
    const signature = [player.name, player.alliance, player.role, player.tier, player.notes]
      .map((value) => String(value || ''))
      .join('');
    if (player._tableSearchSignature !== signature) {
      player._tableSearchSignature = signature;
      player._tableSearchHaystack = [player.name, player.alliance, player.role, player.tier, player.notes]
        .map(normalizeText)
        .join(' | ');
    }
    return String(player._tableSearchHaystack || '');
  }

  function playerMatchesFilters(player) {
    const filters = PNS.state?.topFilters || {};
    const search = typeof PNS.normalizeTopFilterText === 'function'
      ? PNS.normalizeTopFilterText(filters.search || '')
      : normalizeText(filters.search || '');
    const role = typeof PNS.normalizeTopFilterRole === 'function'
      ? PNS.normalizeTopFilterRole(filters.role || 'all')
      : String(filters.role || 'all').toLowerCase();
    const status = typeof PNS.normalizeTopFilterStatus === 'function'
      ? PNS.normalizeTopFilterStatus(filters.status || 'all')
      : String(filters.status || 'all').toLowerCase();
    const shift = typeof PNS.normalizeTopFilterShift === 'function'
      ? PNS.normalizeTopFilterShift(filters.shift || 'all')
      : String(filters.shift || 'all').toLowerCase();

    if (!playerMatchesShift(player, shift)) return false;
    if (role !== 'all' && typeof PNS.normalizeRole === 'function' && PNS.normalizeRole(player.role) !== role) return false;
    if (status !== 'all') {
      if (status === 'free' && player.assignment) return false;
      if (status === 'assigned' && !player.assignment) return false;
      if (status === 'captains' && !player.captainReady) return false;
    }
    if (search && !getPlayerSearchHaystack(player).includes(search)) return false;
    return true;
  }

  function getFilteredPlayers() {
    const tier = parseTierFilter();
    return (PNS.state?.players || []).filter((player) => {
      if (!playerMatchesFilters(player)) return false;
      if (tier !== 'all' && String(PNS.normalizeTierText?.(player.tier) || player.tier || '').toUpperCase() !== tier) {
        return false;
      }
      return true;
    });
  }

  function getShiftOrderValue(player) {
    const text = String(player?.shift || player?.shiftLabel || '').toLowerCase();
    if (text === 'shift1' || /(shift\s*1|зміна\s*1|смена\s*1)/i.test(text)) return 1;
    if (text === 'shift2' || /(shift\s*2|зміна\s*2|смена\s*2)/i.test(text)) return 2;
    if (text === 'both' || /(both|обидві|обе)/i.test(text)) return 3;
    return 0;
  }

  function getSortValue(player, field) {
    if (field === 'tier') {
      const match = String(player?.tier || '').match(/T?(\d+)/i);
      return match ? Number(match[1]) : 0;
    }
    if (field === 'march' || field === 'rally' || field === 'lair') {
      if (field === 'lair') return Number(player?.lairLevel || 0) || 0;
      return Number(player?.[field] || 0) || 0;
    }
    if (field === 'captainReady') return player?.captainReady ? 1 : 0;
    if (field === 'shiftLabel') return getShiftOrderValue(player);
    if (field === 'actions') {
      const assignment = player?.assignment;
      if (!assignment?.baseId) return 'zzzz';
      const base = PNS.state?.baseById?.get?.(assignment.baseId);
      return String(base?.title || '').toLocaleLowerCase();
    }
    return String(player?.[field] || '').toLocaleLowerCase();
  }

  function comparePlayers(playerA, playerB, field, dir) {
    const valueA = getSortValue(playerA, field);
    const valueB = getSortValue(playerB, field);
    const isNumeric = typeof valueA === 'number' && typeof valueB === 'number';

    if (isNumeric && valueA !== valueB) {
      return dir === 'desc' ? valueB - valueA : valueA - valueB;
    }
    if (!isNumeric) {
      const textCompare = String(valueA).localeCompare(String(valueB), undefined, { numeric: true, sensitivity: 'base' });
      if (textCompare !== 0) {
        return dir === 'desc' ? -textCompare : textCompare;
      }
    }
    return String(playerA?.name || '').localeCompare(String(playerB?.name || ''), undefined, { numeric: true, sensitivity: 'base' });
  }

  function buildPlayerRow(player) {
    const rowBuilder = PNS.createPlayerTableRow;
    if (typeof rowBuilder === 'function') return rowBuilder(player);

    const row = document.createElement('tr');
    row.dataset.playerId = String(player.id || '');
    row.dataset.shift = String(player.shift || 'both');
    row.innerHTML = PNS.renderHtmlTemplate('tpl-player-row', {
      name: PNS.escapeHtml(player.name || ''),
      alliance: PNS.escapeHtml(player.alliance || ''),
      role_html: PNS.escapeHtml(player.role || ''),
      tier: PNS.escapeHtml(PNS.normalizeTierText?.(player.tier) || player.tier || ''),
      march: PNS.formatNum(PNS.parseNumber?.(player.march) || 0),
      rally: PNS.formatNum(PNS.parseNumber?.(player.rally) || 0),
      captain_html: player.captainReady ? 'Yes' : 'No',
      shift_html: PNS.escapeHtml(player.shiftLabel || ''),
      lair_col_class: 'optional-col is-hidden-col',
      lair_level: PNS.escapeHtml(String(player.lairLevel || '')),
      optional_cells_html: ''
    });
    return row;
  }

  function renderRows(playersPage) {
    const tbody = $('#playersDataTable tbody');
    if (!tbody) return;

    (PNS.state?.players || []).forEach((player) => {
      player.rowEl = null;
      player.actionCellEl = null;
    });

    const frag = document.createDocumentFragment();
    playersPage.forEach((player) => {
      const row = buildPlayerRow(player);
      player.rowEl = row;
      player.actionCellEl = row.querySelector('td[data-field="actions"]');
      frag.appendChild(row);
    });

    tbody.innerHTML = '';
    tbody.appendChild(frag);

    if (typeof PNS.applyColumnVisibility === 'function') {
      PNS.applyColumnVisibility(PNS.state?.showAllColumns);
    }
    try { PNS.buildRowActions?.(); } catch {}
  }

  function syncPlayersTableViewport(filteredCount = null) {
    const wrap = $('.players-panel .table-wrap');
    const table = $('#playersDataTable');
    if (!wrap || !table) return;

    const headHeight = Math.ceil(table.tHead?.getBoundingClientRect?.().height || table.tHead?.offsetHeight || 0);
    const visibleRows = getRows();
    const sampleRows = visibleRows.slice(0, 10);
    const rowsHeight = sampleRows.reduce((sum, row) => sum + Math.ceil(row.getBoundingClientRect?.().height || row.offsetHeight || 0), 0);
    const fallbackRowHeight = Number(sampleRows[0]?.offsetHeight || 50) || 50;
    const targetRows = Math.min(10, Math.max(visibleRows.length, 1));
    const computedRowsHeight = rowsHeight || fallbackRowHeight * targetRows;
    const targetHeight = Math.max(0, headHeight + computedRowsHeight + 2);

    if (targetHeight) {
      wrap.style.setProperty('--players-table-max-height', `${targetHeight}px`);
    } else {
      wrap.style.removeProperty('--players-table-max-height');
    }

    const compareCount = Number.isFinite(filteredCount) ? filteredCount : visibleRows.length;
    wrap.classList.toggle('has-row-scroll', compareCount > 10);
  }

  function updateSortButtons() {
    ensureSortButtons();
    $$('.sort-btn').forEach((button) => {
      const field = button.dataset.sort;
      if (!SORTABLE_FIELDS.includes(field)) return;
      const isActive = pager.sortField === field;
      button.classList.toggle('is-active', isActive);
      button.textContent = isActive ? (pager.sortDir === 'desc' ? '↓' : '↑') : '↓';
    });
  }

  function recalcPlayerTable() {
    const filteredPlayers = getFilteredPlayers();
    if (pager.sortField) {
      filteredPlayers.sort((a, b) => comparePlayers(a, b, pager.sortField, pager.sortDir));
    }

    const pageSize = parsePageSize();
    pager.pageSize = pageSize;
    const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredPlayers.length / pageSize));
    if (pager.page > totalPages) pager.page = totalPages;
    if (pager.page < 1) pager.page = 1;

    const start = pageSize === 'all' ? 0 : (pager.page - 1) * pageSize;
    const end = pageSize === 'all' ? filteredPlayers.length : start + pageSize;
    const pagePlayers = filteredPlayers.slice(start, end);

    renderRows(pagePlayers);

    const info = $('#pageInfoText');
    if (info) {
      info.textContent = pageSize === 'all'
        ? `${t('page_word', 'Сторінка')} 1 / 1 • ${t('shown_word', 'показано')} ${filteredPlayers.length}`
        : `${t('page_word', 'Сторінка')} ${pager.page} / ${totalPages} • ${t('shown_word', 'показано')} ${filteredPlayers.length}`;
    }

    const prev = $('#pagePrevBtn');
    const next = $('#pageNextBtn');
    if (prev) prev.disabled = pageSize === 'all' || pager.page <= 1;
    if (next) next.disabled = pageSize === 'all' || pager.page >= totalPages;

    updateSortButtons();
    syncPlayersTableViewport(filteredPlayers.length);
  }

  function schedulePlayerTableRecalc() {
    if (pager._raf) cancelAnimationFrame(pager._raf);
    pager._raf = requestAnimationFrame(() => {
      pager._raf = 0;
      recalcPlayerTable();
    });
  }

  function schedulePlayerTableFilterRecalc(delay = 140) {
    clearTimeout(pager._filterTimer);
    if (!(delay > 0)) {
      schedulePlayerTableRecalc();
      return;
    }
    pager._filterTimer = setTimeout(() => {
      pager._filterTimer = 0;
      schedulePlayerTableRecalc();
    }, delay);
  }

  Object.assign(PNS, {
    playersTablePagerState: pager,
    ensurePlayerTableSortButtons: ensureSortButtons,
    playerMatchesTableFilters: playerMatchesFilters,
    recalcPlayerTable,
    schedulePlayerTableRecalc,
    schedulePlayerTableFilterRecalc,
  });
})();


(function(){
  const $ = (selector, root = document) => root.querySelector(selector);
  const PNS = window.PNS = window.PNS || {};
  const pager = PNS.playersTablePagerState || { page: 1, pageSize: 10, sortField: '', sortDir: 'desc' };

  function bindOnce(node, key, handler, eventName) {
    if (!node || node.dataset[key]) return;
    node.dataset[key] = '1';
    node.addEventListener(eventName, handler);
  }

  function resetPlayersTableFilters() {
    const search = $('#topSearchFilter');
    if (search) search.value = '';
    const role = $('#topRoleFilter');
    if (role) role.selectedIndex = 0;
    const shift = $('#topShiftFilter');
    if (shift) shift.value = 'all';
    const status = $('#topStatusFilter');
    if (status) status.selectedIndex = 0;
    const tier = $('#topTierFilter');
    if (tier) tier.value = 'all';
    const pageSize = $('#pageSizeSelect');
    if (pageSize) pageSize.value = '10';

    if (PNS.state?.topFilters) {
      PNS.state.topFilters.search = '';
      PNS.state.topFilters.role = 'all';
      PNS.state.topFilters.shift = 'all';
      PNS.state.topFilters.status = 'all';
      if (typeof PNS.saveTopFilters === 'function') PNS.saveTopFilters();
    }

    if (typeof PNS.applyShiftFilter === 'function') PNS.applyShiftFilter('all');
    if (typeof PNS.applyPlayerTableFilters === 'function') PNS.applyPlayerTableFilters();
  }

  function initPlayersTableBindings() {
    PNS.ensurePlayerTableSortButtons?.();

    const pageSizeSelect = $('#pageSizeSelect');
    if (pageSizeSelect && !String(pageSizeSelect.value || '').trim()) pageSizeSelect.value = '10';
    pager.pageSize = 10;
    pager.page = 1;

    bindOnce($('#topTierFilter'), 'v4boundTier', () => {
      pager.page = 1;
      PNS.schedulePlayerTableRecalc?.();
    }, 'change');

    bindOnce($('#pageSizeSelect'), 'v4boundPageSize', () => {
      pager.page = 1;
      PNS.schedulePlayerTableRecalc?.();
    }, 'change');

    bindOnce($('#resetFiltersBtn'), 'v4boundReset', () => {
      resetPlayersTableFilters();
      pager.sortField = '';
      pager.sortDir = 'desc';
      pager.page = 1;
      setTimeout(() => PNS.schedulePlayerTableRecalc?.(), 0);
    }, 'click');

    bindOnce(document.documentElement, 'v4boundSortDelegated', (event) => {
      const button = event.target.closest('.sort-btn');
      if (!button) return;
      const field = String(button.dataset.sort || '').trim();
      if (!field) return;
      if (pager.sortField !== field) {
        pager.sortField = field;
        pager.sortDir = 'desc';
      } else {
        pager.sortDir = pager.sortDir === 'desc' ? 'asc' : 'desc';
      }
      pager.page = 1;
      PNS.schedulePlayerTableRecalc?.();
    }, 'click');

    bindOnce($('#pagePrevBtn'), 'v4boundPrev', () => {
      pager.page = Math.max(1, pager.page - 1);
      PNS.schedulePlayerTableRecalc?.();
    }, 'click');

    bindOnce($('#pageNextBtn'), 'v4boundNext', () => {
      pager.page += 1;
      PNS.schedulePlayerTableRecalc?.();
    }, 'click');

    PNS.schedulePlayerTableRecalc?.();
  }

  document.addEventListener('players-table-rendered', initPlayersTableBindings);
  document.addEventListener('players-table-filters-changed', () => PNS.schedulePlayerTableRecalc?.());
  document.addEventListener('players-table-data-changed', () => PNS.schedulePlayerTableRecalc?.());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlayersTableBindings);
  } else {
    initPlayersTableBindings();
  }
})();

window.addEventListener('resize', () => window.PNS?.schedulePlayerTableRecalc?.(), { passive: true });
