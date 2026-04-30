/* ==== top-filters-state.js ==== */
/* Top filters state and persistence */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;
  const { state } = PNS;

  function normalizeText(value) {
    return String(value || '').toLowerCase().trim();
  }

  function normalizeTopFilterStatus(value) {
    const text = normalizeText(value);
    if (!text || text === 'усі' || text === 'всі' || text === 'all') return 'all';
    if (text.includes('капітан') || text.includes('captain')) return 'captains';
    if (text.includes('віль') || text.includes('free')) return 'free';
    if (text.includes('баз') || text.includes('assigned') || text.includes('in base')) return 'assigned';
    return 'all';
  }

  function normalizeTopFilterRole(value) {
    const text = normalizeText(value);
    return text && text !== 'усі' && text !== 'всі' && text !== 'all'
      ? PNS.normalizeRole(value)
      : 'all';
  }

  function normalizeTopFilterShift(value) {
    const text = normalizeText(value);
    return text && text !== 'усі' && text !== 'всі' && text !== 'all'
      ? PNS.normalizeShiftValue(value)
      : 'all';
  }

  function loadTopFilters() {
    const saved = typeof PNS.safeReadJSON === 'function'
      ? PNS.safeReadJSON(PNS.KEYS.KEY_TOP_FILTERS, null)
      : null;

    state.topFilters = saved && typeof saved === 'object'
      ? {
          search: String(saved.search || ''),
          role: normalizeTopFilterRole(saved.role || 'all'),
          shift: normalizeTopFilterShift(saved.shift || 'all'),
          status: normalizeTopFilterStatus(saved.status || 'all'),
        }
      : state.topFilters || {
          search: '',
          role: 'all',
          shift: 'all',
          status: 'all',
        };

    return state.topFilters;
  }

  function saveTopFilters() {
    if (typeof PNS.safeWriteJSON === 'function') {
      PNS.safeWriteJSON(PNS.KEYS.KEY_TOP_FILTERS, state.topFilters || {});
    }
  }

  Object.assign(PNS, {
    normalizeTopFilterText: normalizeText,
    normalizeTopFilterStatus,
    normalizeTopFilterRole,
    normalizeTopFilterShift,
    loadTopFilters,
    saveTopFilters,
  });
})();


/* ==== top-filters-ui.js ==== */
/* Top filters controls sync and event bindings */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;
  const { state } = PNS;

  function getTopFilterControls() {
    const row = document.querySelector('.filters-row');
    if (!row) return {};
    const selects = row.querySelectorAll('select');
    return {
      row,
      search: row.querySelector('#topSearchFilter') || row.querySelector('input[type="text"]') || null,
      role: row.querySelector('#topRoleFilter') || selects[0] || null,
      shift: row.querySelector('#topShiftFilter') || selects[1] || null,
      status: row.querySelector('#topStatusFilter') || selects[2] || null,
    };
  }

  function getHomeShiftCount() {
    try {
      const settings = JSON.parse(localStorage.getItem('pns_import_region_shift_settings_v1') || 'null') || {};
      const shifts = settings?.regions?.region1?.shifts || {};
      const selected = ['1', '2', '3', '4'].find((n) => !!shifts[n]) || '2';
      return Math.max(1, Math.min(4, Number(selected) || 2));
    } catch {
      return 2;
    }
  }

  function shiftOptionLabel(key) {
    if (key === 'all') return typeof PNS.t === 'function' ? PNS.t('all', 'Усі') : 'Усі';
    if (key === 'both') {
      return typeof PNS.getBothDisplayLabel === 'function'
        ? PNS.getBothDisplayLabel()
        : (typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel('both') : (typeof PNS.t === 'function' ? PNS.t('both', 'Обидві') : 'Обидві'));
    }
    const label = typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(key) : '';
    if (label && label !== key) return label;
    const n = Number(String(key || '').replace(/\D/g, '')) || 1;
    return typeof PNS.t === 'function' ? PNS.t(`shift${n}`, `Зміна ${n}`) : `Зміна ${n}`;
  }

  function syncShiftFilterOptions(select) {
    if (!select) return;
    const count = getHomeShiftCount();
    const allowed = ['all', ...Array.from({ length: count }, (_, index) => `shift${index + 1}`), 'both'];
    const current = PNS.normalizeTopFilterShift?.(select.value || '') || 'all';
    const stateCurrent = PNS.normalizeTopFilterShift?.(state.topFilters?.shift || 'all') || 'all';

    select.innerHTML = '';
    allowed.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = shiftOptionLabel(value);
      option.dataset.i18n = value === 'all' ? 'all' : value;
      select.appendChild(option);
    });

    const nextValue = allowed.includes(stateCurrent) ? stateCurrent : allowed.includes(current) ? current : 'all';
    select.value = nextValue;
    if (state.topFilters && state.topFilters.shift !== nextValue) {
      state.topFilters.shift = nextValue;
      try { PNS.saveTopFilters?.(); } catch {}
    }
  }

  function syncTopFilterUI() {
    const controls = getTopFilterControls();
    if (!controls.row) return;

    [controls.search, controls.role, controls.shift, controls.status].forEach((el) => {
      if (el) el.disabled = false;
    });

    if (controls.search) {
      controls.search.value = state.topFilters?.search || '';
    }

    if (controls.role) {
      const current = state.topFilters?.role || 'all';
      const normalized = current === 'all' ? 'all' : current.toLowerCase();
      const option = Array.from(controls.role.options).find((opt) => {
        const text = PNS.normalizeTopFilterText(opt.value || opt.textContent);
        return normalized === 'all'
          ? /(усі|всі|all)/i.test(opt.textContent)
          : text === normalized;
      });
      if (option) controls.role.value = option.value;
    }

    if (controls.shift) {
      syncShiftFilterOptions(controls.shift);
      const current = state.topFilters?.shift || 'all';
      const option = Array.from(controls.shift.options).find((opt) => {
        const normalized = PNS.normalizeTopFilterShift(opt.value || opt.textContent);
        return current === 'all'
          ? String(opt.value || '').toLowerCase() === 'all' || /(усі|всі|all)/i.test(opt.textContent)
          : normalized === current;
      });
      if (option) controls.shift.value = option.value;
    }

    if (controls.status) {
      const current = state.topFilters?.status || 'all';
      const option = Array.from(controls.status.options).find((opt) => {
        return PNS.normalizeTopFilterStatus(opt.value || opt.textContent) === current;
      });
      if (option) controls.status.value = option.value;
    }
  }

  function bindTopFilterEvents() {
    const controls = getTopFilterControls();
    if (!controls.row) return;

    [controls.search, controls.role, controls.shift, controls.status].forEach((el) => {
      if (el) el.disabled = false;
    });

    if (controls.search && !controls.search.dataset.boundFilter) {
      controls.search.dataset.boundFilter = '1';
      controls.search.addEventListener('input', () => {
        state.topFilters.search = controls.search.value || '';
        if (PNS.playersTablePagerState) PNS.playersTablePagerState.page = 1;
        PNS.saveTopFilters();
        PNS.applyPlayerTableFilters?.({ debounceMs: 140 });
      });
    }

    if (controls.role && !controls.role.dataset.boundFilter) {
      controls.role.dataset.boundFilter = '1';
      controls.role.addEventListener('change', () => {
        state.topFilters.role = PNS.normalizeTopFilterRole(
          controls.role.value || controls.role.options[controls.role.selectedIndex]?.textContent
        );
        if (PNS.playersTablePagerState) PNS.playersTablePagerState.page = 1;
        PNS.saveTopFilters();
        PNS.applyPlayerTableFilters?.({ debounceMs: 0 });
      });
    }

    if (controls.shift && !controls.shift.dataset.boundFilter) {
      controls.shift.dataset.boundFilter = '1';
      controls.shift.addEventListener('change', () => {
        state.topFilters.shift = PNS.normalizeTopFilterShift(
          controls.shift.value || controls.shift.options[controls.shift.selectedIndex]?.textContent
        );
        if (PNS.playersTablePagerState) PNS.playersTablePagerState.page = 1;
        PNS.saveTopFilters();
        PNS.applyPlayerTableFilters?.({ debounceMs: 0 });
      });
    }

    if (controls.status && !controls.status.dataset.boundFilter) {
      controls.status.dataset.boundFilter = '1';
      controls.status.addEventListener('change', () => {
        state.topFilters.status = PNS.normalizeTopFilterStatus(
          controls.status.value || controls.status.options[controls.status.selectedIndex]?.textContent
        );
        if (PNS.playersTablePagerState) PNS.playersTablePagerState.page = 1;
        PNS.saveTopFilters();
        PNS.applyPlayerTableFilters?.({ debounceMs: 0 });
      });
    }
  }

  function refreshTopShiftFilterOptionsAndApply() {
    const controls = getTopFilterControls();
    if (!controls.row) return;
    const before = state.topFilters?.shift || 'all';
    if (controls.shift) syncShiftFilterOptions(controls.shift);
    syncTopFilterUI();
    const after = state.topFilters?.shift || 'all';
    if (before !== after && typeof PNS.applyPlayerTableFilters === 'function') {
      PNS.applyPlayerTableFilters({ debounceMs: 0 });
    }
  }

  Object.assign(PNS, {
    getTopFilterControls,
    syncTopFilterUI,
    bindTopFilterEvents,
    syncTopShiftFilterOptions: refreshTopShiftFilterOptionsAndApply,
  });

  document.addEventListener('pns:region-shifts-changed', refreshTopShiftFilterOptionsAndApply);
  window.addEventListener('pns:region-shifts-changed', refreshTopShiftFilterOptionsAndApply);
  document.addEventListener('pns:i18n-changed', refreshTopShiftFilterOptionsAndApply);
})();


/* ==== top-filters-apply.js ==== */
/* Top filters apply logic and bootstrap */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;
  const { state } = PNS;

  function applyPlayerTableFilters(options = {}) {
    const debounceMs = Number(options?.debounceMs);
    const useDebounce = Number.isFinite(debounceMs) ? debounceMs : 0;

    if (!Array.isArray(state.players)) {
      try {
        document.dispatchEvent(new CustomEvent('players-table-filters-changed'));
      } catch {}
      return;
    }

    try {
      document.dispatchEvent(new CustomEvent('players-table-filters-changed'));
    } catch {}
    try {
      if (useDebounce > 0 && typeof PNS.schedulePlayerTableFilterRecalc === 'function') {
        PNS.schedulePlayerTableFilterRecalc(useDebounce);
      } else {
        PNS.schedulePlayerTableRecalc?.();
      }
    } catch {}
  }

  function reInitFilters() {
    state.topFilters || PNS.loadTopFilters();
    PNS.bindTopFilterEvents?.();
    PNS.syncTopFilterUI?.();
    applyPlayerTableFilters();
  }

  Object.assign(PNS, {
    applyPlayerTableFilters,
    reInitFilters,
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reInitFilters);
  } else {
    reInitFilters();
  }
})();
