(function(){
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const t = (key, fallback = '') => (typeof window.PNS?.t === 'function' ? window.PNS.t(key, fallback) : fallback);
  const pager = { page: 1, pageSize: 10, sortField: '', sortDir: 'desc', _raf: 0 };
  const PNS = window.PNS = window.PNS || {};

  function getRows() {
    return $$('#playersDataTable tbody tr');
  }

  function getTierText(row) {
    return (row.querySelector('td[data-field="tier"]')?.textContent || $$('td', row)[3]?.textContent || '')
      .trim()
      .toUpperCase();
  }

  function getSortValue(row, field) {
    if (field === 'rally') {
      const raw = row.querySelector('td[data-field="rally"]')?.textContent
        || row.querySelector('td[data-col-key="rally_size"]')?.textContent
        || '0';
      const digits = String(raw || '').replace(/[^\d]/g, '');
      return digits ? Number(digits) : 0;
    }
    if (field === 'tier') {
      const match = getTierText(row).match(/T?(\d+)/i);
      return match ? Number(match[1]) : 0;
    }
    return 0;
  }

  function ensureSortButtons() {
    const labels = {
      tier: t('sort_by_tier_label', 'Сортувати за тіром'),
      rally: t('sort_by_rally_label', 'Сортувати за розміром ралі'),
    };

    Object.entries(labels).forEach(([field, label]) => {
      const th = document.querySelector(`#playersDataTable thead th[data-field="${field}"]`);
      if (!th || th.querySelector('.sort-btn')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sort-btn';
      button.dataset.sort = field;
      button.setAttribute('aria-label', label);
      button.title = label;
      button.textContent = '↓';
      th.appendChild(document.createTextNode(' '));
      th.appendChild(button);
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

  function recalcPlayerTable() {
    const tbody = $('#playersDataTable tbody');
    if (!tbody) return;

    const tier = parseTierFilter();
    const visibleRows = getRows().filter((row) => !row.hidden);
    const filteredRows = tier === 'all' ? visibleRows : visibleRows.filter((row) => getTierText(row) === tier);

    if (pager.sortField) {
      filteredRows.sort((rowA, rowB) => {
        const valueA = getSortValue(rowA, pager.sortField);
        const valueB = getSortValue(rowB, pager.sortField);
        if (valueA !== valueB) {
          return pager.sortDir === 'desc' ? valueB - valueA : valueA - valueB;
        }
        return (rowA.textContent || '').localeCompare(rowB.textContent || '');
      });
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

    ensureSortButtons();
    $$('.sort-btn').forEach((button) => {
      const field = button.dataset.sort;
      if (!['tier', 'rally'].includes(field)) return;
      button.textContent = pager.sortField === field
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
      const field = button.dataset.sort;
      if (!['tier', 'rally'].includes(field)) return;
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
