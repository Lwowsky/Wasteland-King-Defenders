(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const state = {
    page: 1,
    pageSize: 10,
    sortField: '',
    sortDir: 'desc',
    _raf: 0,
  };

  function parseNum(v) {
    const m = String(v || '').replace(/[^\d]/g, '');
    return m ? Number(m) : 0;
  }
  function getTbody() { return $('#playersDataTable tbody'); }
  function getRowsAll() { return $$('#playersDataTable tbody tr'); }
  function tierText(tr) {
    return (tr.querySelector('td[data-field="tier"]')?.textContent || $$('td', tr)[3]?.textContent || '').trim().toUpperCase();
  }
  function rallyVal(tr) {
    return parseNum(tr.querySelector('td[data-field="rally"]')?.textContent || tr.querySelector('td[data-col-key="rally_size"]')?.textContent || '0');
  }
  function getSortValue(tr, field) {
    if (field === 'rally') return rallyVal(tr);
    if (field === 'tier') {
      const m = tierText(tr).match(/T?(\d+)/i);
      return m ? Number(m[1]) : 0;
    }
    return 0;
  }

  function ensureSortButtons() {
    const map = { tier: 'тіром', rally: 'розміром ралі' };
    Object.entries(map).forEach(([field, label]) => {
      const th = document.querySelector(`#playersDataTable thead th[data-field="${field}"]`);
      if (!th || th.querySelector('.sort-btn')) return;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'sort-btn'; btn.dataset.sort = field;
      btn.setAttribute('aria-label', `Сортувати за ${label}`); btn.title = `Сортувати за ${label}`; btn.textContent = '↓';
      th.appendChild(document.createTextNode(' ')); th.appendChild(btn);
    });
  }
  function updateSortButtons() {
    ensureSortButtons();
    $$('.sort-btn').forEach((btn) => {
      const f = btn.dataset.sort;
      if (!['tier', 'rally'].includes(f)) return;
      btn.textContent = (state.sortField === f) ? (state.sortDir === 'desc' ? '↓' : '↑') : '↓';
    });
  }

  function currentTierFilter() {
    const el = $('#topTierFilter');
    if (!el) return 'all';
    const raw = String(el.value || 'all').trim();
    const v = raw.toUpperCase();
    return (v === 'ALL' || v === 'УСІ' || v === 'ВСІ') ? 'all' : v;
  }

  function visibleRows() {
    const tier = currentTierFilter();
    const rows = getRowsAll().filter(tr => !tr.hidden);
    if (tier === 'all') return rows;
    return rows.filter(tr => tierText(tr) === tier);
  }

  function getSelectedPageSize() {
    const raw = String($('#pageSizeSelect')?.value || state.pageSize || '10').trim().toLowerCase();
    if (raw === 'all' || raw === 'усі' || raw === 'всі') return 'all';
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 10;
  }

  function applySortAndPager() {
    const tbody = getTbody();
    if (!tbody) return;
    const rows = visibleRows();

    if (state.sortField) {
      rows.sort((a, b) => {
        const va = getSortValue(a, state.sortField);
        const vb = getSortValue(b, state.sortField);
        if (va !== vb) return state.sortDir === 'desc' ? (vb - va) : (va - vb);
        return (a.textContent || '').localeCompare(b.textContent || '');
      });
      rows.forEach(tr => tbody.appendChild(tr));
    }

    const pageSize = getSelectedPageSize();
    state.pageSize = pageSize;
    const pages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(rows.length / pageSize));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;

    const start = pageSize === 'all' ? 0 : (state.page - 1) * pageSize;
    const end = pageSize === 'all' ? Infinity : (start + pageSize);

    const rowsSet = new Set(rows);
    let idxVisible = 0;
    getRowsAll().forEach(tr => {
      tr.classList.remove('page-hidden');
      if (tr.hidden) { tr.classList.add('page-hidden'); return; }
      if (!rowsSet.has(tr)) { tr.classList.add('page-hidden'); return; }
      if (idxVisible < start || idxVisible >= end) tr.classList.add('page-hidden');
      idxVisible++;
    });

    const info = $('#pageInfoText');
    if (info) info.textContent = pageSize === 'all'
      ? `Сторінка 1 / 1 • показано ${rows.length}`
      : `Сторінка ${state.page} / ${pages} • показано ${rows.length}`;
    const prev = $('#pagePrevBtn'); const next = $('#pageNextBtn');
    if (prev) prev.disabled = pageSize === 'all' || state.page <= 1;
    if (next) next.disabled = pageSize === 'all' || state.page >= pages;
    updateSortButtons();
  }

  function scheduleRecalc() {
    if (state._raf) cancelAnimationFrame(state._raf);
    state._raf = requestAnimationFrame(() => { state._raf = 0; ensureSortButtons(); applySortAndPager(); });
  }

  function bindOnce(el, key, fn, evt) {
    if (!el) return;
    if (el.dataset[key]) return;
    el.dataset[key] = '1';
    el.addEventListener(evt, fn);
  }

  function resetAllFiltersUI() {
    const search = $('#topSearchFilter'); if (search) search.value = '';
    const role = $('#topRoleFilter'); if (role) role.selectedIndex = 0;
    const shift = $('#topShiftFilter'); if (shift) shift.value = 'all';
    const status = $('#topStatusFilter'); if (status) status.selectedIndex = 0;
    const tier = $('#topTierFilter'); if (tier) tier.value = 'all';
    const rows = $('#pageSizeSelect'); if (rows) rows.value = '10';

    const PNS = window.PNS;
    if (PNS?.state?.topFilters) {
      PNS.state.topFilters.search = '';
      PNS.state.topFilters.role = 'all';
      PNS.state.topFilters.shift = 'all';
      PNS.state.topFilters.status = 'all';
      if (typeof PNS.saveTopFilters === 'function') PNS.saveTopFilters();
    }
    if (typeof PNS?.applyShiftFilter === 'function') PNS.applyShiftFilter('all');
    if (typeof PNS?.applyPlayerTableFilters === 'function') PNS.applyPlayerTableFilters();
  }

  function bind() {
    ensureSortButtons();
    bindOnce($('#topTierFilter'), 'v4boundTier', () => { state.page = 1; scheduleRecalc(); }, 'change');
    bindOnce($('#pageSizeSelect'), 'v4boundPageSize', () => { state.page = 1; scheduleRecalc(); }, 'change');
    bindOnce($('#resetFiltersBtn'), 'v4boundReset', () => {
      resetAllFiltersUI();
      state.sortField = ''; state.sortDir = 'desc'; state.page = 1;
      setTimeout(scheduleRecalc, 0);
    }, 'click');
    bindOnce(document.documentElement, 'v4boundSortDelegated', (e) => {
      const btn = e.target.closest('.sort-btn'); if (!btn) return;
      const f = btn.dataset.sort; if (!['tier','rally'].includes(f)) return;
      if (state.sortField !== f) { state.sortField = f; state.sortDir = 'desc'; }
      else state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
      state.page = 1; scheduleRecalc();
    }, 'click');
    bindOnce($('#pagePrevBtn'), 'v4boundPrev', () => { state.page = Math.max(1, state.page - 1); scheduleRecalc(); }, 'click');
    bindOnce($('#pageNextBtn'), 'v4boundNext', () => { state.page = state.page + 1; scheduleRecalc(); }, 'click');
  }

  function init() { bind(); scheduleRecalc(); }

  const PNS = window.PNS = window.PNS || {};
  PNS.schedulePlayerTableRecalc = scheduleRecalc;
  document.addEventListener('players-table-rendered', init);
  document.addEventListener('players-table-filters-changed', scheduleRecalc);
  document.addEventListener('players-table-data-changed', scheduleRecalc);
  document.addEventListener('htmx:afterSwap', init);
  document.addEventListener('htmx:afterSettle', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
