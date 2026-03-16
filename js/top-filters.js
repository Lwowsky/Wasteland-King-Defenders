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
      const current = state.topFilters?.shift || 'all';
      const option = Array.from(controls.shift.options).find((opt) => {
        const normalized = PNS.normalizeTopFilterShift(opt.value || opt.textContent);
        return current === 'all'
          ? /(усі|всі|all)/i.test(opt.textContent)
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
        PNS.saveTopFilters();
        PNS.applyPlayerTableFilters?.();
      });
    }

    if (controls.role && !controls.role.dataset.boundFilter) {
      controls.role.dataset.boundFilter = '1';
      controls.role.addEventListener('change', () => {
        state.topFilters.role = PNS.normalizeTopFilterRole(
          controls.role.value || controls.role.options[controls.role.selectedIndex]?.textContent
        );
        PNS.saveTopFilters();
        PNS.applyPlayerTableFilters?.();
      });
    }

    if (controls.shift && !controls.shift.dataset.boundFilter) {
      controls.shift.dataset.boundFilter = '1';
      controls.shift.addEventListener('change', () => {
        state.topFilters.shift = PNS.normalizeTopFilterShift(
          controls.shift.value || controls.shift.options[controls.shift.selectedIndex]?.textContent
        );
        PNS.saveTopFilters();
        PNS.applyPlayerTableFilters?.();
      });
    }

    if (controls.status && !controls.status.dataset.boundFilter) {
      controls.status.dataset.boundFilter = '1';
      controls.status.addEventListener('change', () => {
        state.topFilters.status = PNS.normalizeTopFilterStatus(
          controls.status.value || controls.status.options[controls.status.selectedIndex]?.textContent
        );
        PNS.saveTopFilters();
        PNS.applyPlayerTableFilters?.();
      });
    }
  }

  Object.assign(PNS, {
    getTopFilterControls,
    syncTopFilterUI,
    bindTopFilterEvents,
  });
})();


/* ==== top-filters-apply.js ==== */
/* Top filters apply logic and bootstrap */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;
  const { state } = PNS;

  function playerMatchesShift(player, activeShift) {
    const value = PNS.normalizeShiftValue(player);
    return activeShift === 'all' || value === activeShift;
  }

  function applyPlayerTableFilters() {
    if (!Array.isArray(state.players) || !state.players.length) {
      try {
        document.dispatchEvent(new CustomEvent('players-table-filters-changed'));
      } catch {}
      return;
    }

    const search = PNS.normalizeTopFilterText(state.topFilters?.search);
    const role = PNS.normalizeTopFilterRole(state.topFilters?.role || 'all');
    const status = PNS.normalizeTopFilterStatus(state.topFilters?.status || 'all');
    const shift = PNS.normalizeTopFilterShift(state.topFilters?.shift || 'all');

    state.players.forEach((player) => {
      const row = player.rowEl;
      if (!row) return;

      let visible = true;
      if (!playerMatchesShift(player.shift || row.dataset.shift || 'both', shift)) visible = false;
      if (visible && role !== 'all' && PNS.normalizeRole(player.role) !== role) visible = false;
      if (visible && status !== 'all') {
        if (status === 'free' && player.assignment) visible = false;
        if (status === 'assigned' && !player.assignment) visible = false;
        if (status === 'captains' && !player.captainReady) visible = false;
      }
      if (visible && search) {
        const haystack = [player.name, player.alliance, player.role, player.tier, player.notes]
          .map(PNS.normalizeTopFilterText)
          .join(' | ');
        if (!haystack.includes(search)) visible = false;
      }

      row.hidden = !visible;
    });

    try {
      document.dispatchEvent(new CustomEvent('players-table-filters-changed'));
    } catch {}
    try {
      PNS.schedulePlayerTableRecalc?.();
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
