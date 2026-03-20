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

  function getTierText(row) {
    return (row.querySelector('td[data-field="tier"]')?.textContent || $$('td', row)[3]?.textContent || '')
      .trim()
      .toUpperCase();
  }

  function getCell(row, field) {
    if (!row || !field) return null;
    return row.querySelector(`td[data-field="${field}"]`) || row.querySelector(`td[data-col-key="${field}"]`);
  }

  function getHeaderLabel(th) {
    if (!th) return '';
    const clone = th.cloneNode(true);
    $$('.sort-btn', clone).forEach((button) => button.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function parseNumericCell(row, field) {
    const raw = getCell(row, field)?.textContent || '0';
    const digits = String(raw || '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
  }

  function getCaptainReadyValue(row) {
    const cell = getCell(row, 'captainReady');
    if (!cell) return 0;
    const pill = cell.querySelector('.pill');
    if (pill?.classList.contains('yes')) return 1;
    if (pill?.classList.contains('no')) return 0;
    const text = (cell.textContent || '').trim().toLowerCase();
    return /(yes|так|да|ready|готов)/i.test(text) ? 1 : 0;
  }

  function getShiftOrderValue(row) {
    const text = (getCell(row, 'shiftLabel')?.textContent || '').trim().toLowerCase();
    if (/(shift\s*1|зміна\s*1|смена\s*1)/i.test(text)) return 1;
    if (/(shift\s*2|зміна\s*2|смена\s*2)/i.test(text)) return 2;
    if (/(both|обидві|обе|обе две)/i.test(text)) return 3;
    return 0;
  }

  function getSortValue(row, field) {
    if (field === 'tier') {
      const match = getTierText(row).match(/T?(\d+)/i);
      return match ? Number(match[1]) : 0;
    }
    if (field === 'march' || field === 'rally' || field === 'lair') {
      return parseNumericCell(row, field);
    }
    if (field === 'captainReady') {
      return getCaptainReadyValue(row);
    }
    if (field === 'shiftLabel') {
      return getShiftOrderValue(row);
    }
    const text = (getCell(row, field)?.textContent || '').replace(/\s+/g, ' ').trim();
    return text.toLocaleLowerCase();
  }

  function compareRows(rowA, rowB, field, dir) {
    const valueA = getSortValue(rowA, field);
    const valueB = getSortValue(rowB, field);
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
    return (rowA.textContent || '').localeCompare(rowB.textContent || '', undefined, { numeric: true, sensitivity: 'base' });
  }

  function ensureSortButtons() {
    $$(`#playersDataTable thead th[data-field]`).forEach((th) => {
      const field = String(th.dataset.field || '').trim();
      if (!SORTABLE_FIELDS.includes(field)) return;
      let button = th.querySelector('.sort-btn');
      if (!button) {
        const label = getHeaderLabel(th) || field;
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'sort-btn';
        button.dataset.sort = field;
        button.setAttribute('aria-label', label);
        button.title = label;
        button.textContent = '↓';
        th.appendChild(document.createTextNode(' '));
        th.appendChild(button);
      } else if (!button.dataset.sort) {
        button.dataset.sort = field;
      }
    });
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

  function getVisiblePageRows() {
    return getRows().filter((row) => !row.hidden && !row.classList.contains('page-hidden'));
  }

  function syncPlayersTableViewport(filteredCount = null) {
    const wrap = $('.players-panel .table-wrap');
    const table = $('#playersDataTable');
    if (!wrap || !table) return;

    const headHeight = Math.ceil(table.tHead?.getBoundingClientRect?.().height || table.tHead?.offsetHeight || 0);
    const visibleRows = getVisiblePageRows();
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

  function recalcPlayerTable() {
    const tbody = $('#playersDataTable tbody');
    if (!tbody) return;

    const tier = parseTierFilter();
    const visibleRows = getRows().filter((row) => !row.hidden);
    const filteredRows = tier === 'all' ? visibleRows : visibleRows.filter((row) => getTierText(row) === tier);

    if (pager.sortField) {
      filteredRows.sort((rowA, rowB) => compareRows(rowA, rowB, pager.sortField, pager.sortDir));
      filteredRows.forEach((row) => tbody.appendChild(row));
    }

    const pageSize = parsePageSize();
    pager.pageSize = pageSize;
    const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));
    if (pager.page > totalPages) pager.page = totalPages;
    if (pager.page < 1) pager.page = 1;

    const start = pageSize === 'all' ? 0 : (pager.page - 1) * pageSize;
    const end = pageSize === 'all' ? Infinity : start + pageSize;
    const filteredSet = new Set(filteredRows);
    let visibleIndex = 0;

    getRows().forEach((row) => {
      row.classList.remove('page-hidden');
      if (row.hidden) {
        row.classList.add('page-hidden');
        return;
      }
      if (!filteredSet.has(row)) {
        row.classList.add('page-hidden');
        return;
      }
      if (visibleIndex < start || visibleIndex >= end) {
        row.classList.add('page-hidden');
      }
      visibleIndex += 1;
    });

    const info = $('#pageInfoText');
    if (info) {
      info.textContent = pageSize === 'all'
        ? `${t('page_word', 'Сторінка')} 1 / 1 • ${t('shown_word', 'показано')} ${filteredRows.length}`
        : `${t('page_word', 'Сторінка')} ${pager.page} / ${totalPages} • ${t('shown_word', 'показано')} ${filteredRows.length}`;
    }

    const prev = $('#pagePrevBtn');
    const next = $('#pageNextBtn');
    if (prev) prev.disabled = pageSize === 'all' || pager.page <= 1;
    if (next) next.disabled = pageSize === 'all' || pager.page >= totalPages;

    syncPlayersTableViewport(filteredRows.length);

    ensureSortButtons();
    $$('.sort-btn').forEach((button) => {
      const field = button.dataset.sort;
      if (!SORTABLE_FIELDS.includes(field)) return;
      const isActive = pager.sortField === field;
      button.classList.toggle('is-active', isActive);
      button.textContent = isActive
        ? (pager.sortDir === 'desc' ? '↓' : '↑')
        : '↓';
    });
  }

  function schedulePlayerTableRecalc() {
    if (pager._raf) cancelAnimationFrame(pager._raf);
    pager._raf = requestAnimationFrame(() => {
      pager._raf = 0;
      ensureSortButtons();
      recalcPlayerTable();
      syncPlayersTableViewport();
    });
  }

  Object.assign(PNS, {
    playersTablePagerState: pager,
    ensurePlayerTableSortButtons: ensureSortButtons,
    recalcPlayerTable,
    schedulePlayerTableRecalc,
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
