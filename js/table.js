(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const state = {
    page: 1,
    pageSize: 20,
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
    return (tr.querySelector('td[data-field="tier"]')?.textContent || $$('td', tr)[3]?.textContent || '')
      .trim().toUpperCase();
  }

  function rallyVal(tr) {
    return parseNum(
      tr.querySelector('td[data-field="rally"]')?.textContent ||
      tr.querySelector('td[data-col-key="rally_size"]')?.textContent ||
      '0'
    );
  }

  function getSortValue(tr, field) {
    if (field === 'rally') return rallyVal(tr);
    if (field === 'tier') {
      const t = tierText(tr);
      const m = String(t || '').match(/T?(\d+)/i);
      return m ? Number(m[1]) : 0;
    }
    return 0;
  }

  function ensureSortButtons() {
    const map = { tier: 'Tier', rally: 'Rally size' };
    Object.entries(map).forEach(([field, label]) => {
      const th = document.querySelector(`#playersDataTable thead th[data-field="${field}"]`);
      if (!th || th.querySelector('.sort-btn')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sort-btn';
      btn.dataset.sort = field;
      btn.setAttribute('aria-label', `Sort by ${label}`);
      btn.title = `Sort by ${label}`;
      btn.textContent = '↓';
      th.appendChild(document.createTextNode(' '));
      th.appendChild(btn);
    });
  }

  function updateSortButtons() {
    ensureSortButtons();
    $$('.sort-btn').filter(btn => ['tier', 'rally'].includes(btn.dataset.sort)).forEach(btn => {
      const f = btn.dataset.sort;
      btn.textContent = (state.sortField === f ? (state.sortDir === 'desc' ? '↓' : '↑') : '↓');
    });
  }

  function currentTierFilter() {
    const el = $('#topTierFilter');
    if (!el) return 'all';
    const v = String(el.value || 'all').trim().toUpperCase();
    return (v === 'ALL' || v === 'УСІ' || v === 'ВСІ') ? 'all' : v;
  }

  function visibleRows() {
    const tier = currentTierFilter();
    const rows = getRowsAll().filter(tr => !tr.hidden);
    return tier === 'all' ? rows : rows.filter(tr => tierText(tr) === tier);
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

    const pageSize = Number($('#pageSizeSelect')?.value || state.pageSize || 20);
    state.pageSize = pageSize;
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    state.page = Math.min(Math.max(1, state.page), pages);
    const start = (state.page - 1) * pageSize;
    const end = start + pageSize;

    getRowsAll().forEach(tr => {
      tr.classList.remove('page-hidden');
      if (tr.hidden) { tr.classList.add('page-hidden'); return; }
      const tier = currentTierFilter();
      if (tier !== 'all' && tierText(tr) !== tier) { tr.classList.add('page-hidden'); return; }
      const idx = rows.indexOf(tr);
      if (idx < start || idx >= end) tr.classList.add('page-hidden');
    });

    const info = $('#pageInfoText');
    if (info) info.textContent = `Page ${state.page} / ${pages} • ${rows.length} shown`;
    const prev = $('#pagePrevBtn');
    const next = $('#pageNextBtn');
    if (prev) prev.disabled = state.page <= 1;
    if (next) next.disabled = state.page >= pages;
    updateSortButtons();
  }

  function scheduleRecalc(resetPage = false) {
    if (resetPage) state.page = 1;
    if (state._raf) cancelAnimationFrame(state._raf);
    state._raf = requestAnimationFrame(() => { state._raf = 0; ensureSortButtons(); applySortAndPager(); });
  }

  function bindOnce(el, key, fn, evt) {
    if (!el) return;
    if (el.dataset[key]) return;
    el.dataset[key] = '1';
    el.addEventListener(evt, fn);
  }

  function bind() {
    ensureSortButtons();
    bindOnce($('#topTierFilter'), 'v4boundTier', () => scheduleRecalc(true), 'change');
    bindOnce($('#pageSizeSelect'), 'v4boundPageSize', () => scheduleRecalc(true), 'change');
    bindOnce($('#resetFiltersBtn'), 'v4boundReset', () => setTimeout(() => { state.sortField = ''; state.sortDir = 'desc'; scheduleRecalc(true); }, 0), 'click');

    bindOnce(document.documentElement, 'v4boundSortDelegated', (e) => {
      const btn = e.target.closest('.sort-btn');
      if (!btn) return;
      const f = btn.dataset.sort;
      if (f !== 'tier' && f !== 'rally') return;
      if (state.sortField !== f) { state.sortField = f; state.sortDir = 'desc'; }
      else state.sortDir = (state.sortDir === 'desc') ? 'asc' : 'desc';
      scheduleRecalc(true);
    }, 'click');

    bindOnce($('#pagePrevBtn'), 'v4boundPrev', () => { state.page = Math.max(1, state.page - 1); scheduleRecalc(); }, 'click');
    bindOnce($('#pageNextBtn'), 'v4boundNext', () => { state.page = state.page + 1; scheduleRecalc(); }, 'click');
  }

  function init() { bind(); scheduleRecalc(); }

  document.addEventListener('players-table-rendered', init);
  document.addEventListener('htmx:afterSwap', init);
  document.addEventListener('htmx:afterSettle', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
