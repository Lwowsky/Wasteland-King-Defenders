(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const state = {
    page: 1,
    pageSize: 20,
    sortField: '', // 'tier' | 'rally'
    sortDir: 'desc'
  };

  function parseNum(v) {
    const m = String(v || '').replace(/[^\d]/g, '');
    return m ? Number(m) : 0;
  }

  function getTable() { return $('#playersDataTable'); }
  function getTbody() { return $('#playersDataTable tbody'); }
  function getRowsAll() { return $$('#playersDataTable tbody tr'); }

  function tierText(tr) {
    return (tr.querySelector('td[data-field="tier"]')?.textContent || $$('td', tr)[3]?.textContent || '')
      .trim()
      .toUpperCase();
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

  // ===== Sort buttons (only tier + rally) =====
  function ensureSortButtons() {
    const map = { tier: 'Tier', rally: 'Rally size' };
    Object.entries(map).forEach(([field, label]) => {
      const th = document.querySelector(`#playersDataTable thead th[data-field="${field}"]`);
      if (!th) return;

      // If already exists - do nothing
      if (th.querySelector('.sort-btn')) return;

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

  // ===== Tier filter (extra) =====
  function currentTierFilter() {
    const el = $('#topTierFilter');
    if (!el) return 'all';
    const v = String(el.value || 'all').trim().toUpperCase();
    return (v === 'ALL' || v === 'УСІ' || v === 'ВСІ') ? 'all' : v;
  }

  // visible = already passed PNS filters (row.hidden=false), and passes tier filter
  function visibleRows() {
    const tier = currentTierFilter();
    const rows = getRowsAll().filter(tr => !tr.hidden); // PNS already filters these
    if (tier === 'all') return rows;
    return rows.filter(tr => tierText(tr) === tier);
  }

  function applySortAndPager() {
    const tbody = getTbody();
    if (!tbody) return;

    const rows = visibleRows();

    // sort only visible rows
    if (state.sortField) {
      rows.sort((a, b) => {
        const va = getSortValue(a, state.sortField);
        const vb = getSortValue(b, state.sortField);
        if (va !== vb) return state.sortDir === 'desc' ? (vb - va) : (va - vb);
        return (a.textContent || '').localeCompare(b.textContent || '');
      });
      rows.forEach(tr => tbody.appendChild(tr));
    }

    // pagination
    const pageSize = Number($('#pageSizeSelect')?.value || state.pageSize || 20);
    state.pageSize = pageSize;

    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;

    const start = (state.page - 1) * pageSize;
    const end = start + pageSize;

    // hide only by pagination/tier (NOT touching row.hidden, to not fight PNS)
    getRowsAll().forEach(tr => {
      tr.classList.remove('page-hidden');

      // if PNS already hid it -> keep hidden visually
      if (tr.hidden) {
        tr.classList.add('page-hidden');
        return;
      }

      // tier filter
      const tier = currentTierFilter();
      if (tier !== 'all' && tierText(tr) !== tier) {
        tr.classList.add('page-hidden');
        return;
      }

      // paging among visible (tier-passed) rows
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

  function resetPagerAndRecalc() {
    state.page = 1;
    applySortAndPager();
  }

  // ===== Binding (swap-safe) =====
  function bindOnce(el, key, fn, evt) {
    if (!el) return;
    if (el.dataset[key]) return;
    el.dataset[key] = '1';
    el.addEventListener(evt, fn);
  }

  function bind() {
    ensureSortButtons();

    // Tier / Page size events
    bindOnce($('#topTierFilter'), 'v4boundTier', () => resetPagerAndRecalc(), 'change');
    bindOnce($('#pageSizeSelect'), 'v4boundPageSize', () => resetPagerAndRecalc(), 'change');

    // Reset filters button should still work, but we only care about recalcing pagination
    bindOnce($('#resetFiltersBtn'), 'v4boundReset', () => {
      // let other code reset; we only recalc after tick
      setTimeout(() => { state.sortField = ''; state.sortDir = 'desc'; state.page = 1; applySortAndPager(); }, 0);
    }, 'click');

    // Sort buttons
    $$('.sort-btn').filter(btn => ['tier', 'rally'].includes(btn.dataset.sort)).forEach(btn => {
      bindOnce(btn, 'v4boundSort', () => {
        const f = btn.dataset.sort;
        if (state.sortField !== f) { state.sortField = f; state.sortDir = 'desc'; }
        else state.sortDir = (state.sortDir === 'desc') ? 'asc' : 'desc';
        state.page = 1;
        applySortAndPager();
      }, 'click');
    });

    // Pager
    bindOnce($('#pagePrevBtn'), 'v4boundPrev', () => { state.page = Math.max(1, state.page - 1); applySortAndPager(); }, 'click');
    bindOnce($('#pageNextBtn'), 'v4boundNext', () => { state.page = state.page + 1; applySortAndPager(); }, 'click');
  }

  // Observe tbody swaps/re-renders
  function observe() {
    const tbody = getTbody();
    if (!tbody) return;

    // disconnect old observer
    if (window.__pnsTableObserver) {
      try { window.__pnsTableObserver.disconnect(); } catch {}
    }

    window.__pnsTableObserver = new MutationObserver(() => {
      // table rows changed -> keep paging in sync
      bind();
      applySortAndPager();
    });

    window.__pnsTableObserver.observe(tbody, { childList: true, subtree: true });
  }

  function init() {
    bind();
    observe();
    applySortAndPager();
  }

  // When PNS rerenders table
  document.addEventListener('players-table-rendered', () => {
    // new thead buttons can be recreated -> rebind safely
    init();
  });

  // When HTMX swaps partials (if you use it)
  document.addEventListener('htmx:afterSwap', () => {
    init();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();