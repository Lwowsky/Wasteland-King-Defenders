(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state } = PNS;

  function normText(v) { return String(v || '').toLowerCase().trim(); }

  function getTopFilterEls() {
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

  function normalizeStatusFilterValue(v) {
    const s = normText(v);
    if (!s || s === 'усі' || s === 'всі' || s === 'all') return 'all';
    if (s.includes('капітан') || s.includes('captain')) return 'captains';
    if (s.includes('віль') || s.includes('free')) return 'free';
    if (s.includes('баз') || s.includes('assigned') || s.includes('in base')) return 'assigned';
    return 'all';
  }

  function normalizeRoleFilterValue(v) {
    const s = normText(v);
    if (!s || s === 'усі' || s === 'всі' || s === 'all') return 'all';
    return PNS.normalizeRole(v);
  }

  function normalizeShiftFilterValueUI(v) {
    const s = normText(v);
    if (!s || s === 'усі' || s === 'всі' || s === 'all') return 'all';
    return PNS.normalizeShiftValue(v);
  }

  function loadTopFilters() {
    const saved = typeof PNS.safeReadJSON === 'function'
      ? PNS.safeReadJSON(PNS.KEYS.KEY_TOP_FILTERS, null)
      : null;

    if (saved && typeof saved === 'object') {
      state.topFilters = {
        search: String(saved.search || ''),
        role: normalizeRoleFilterValue(saved.role || 'all'),
        shift: normalizeShiftFilterValueUI(saved.shift || 'all'),
        status: normalizeStatusFilterValue(saved.status || 'all'),
      };
    } else {
      state.topFilters = state.topFilters || { search: '', role: 'all', shift: 'all', status: 'all' };
    }
  }

  function saveTopFilters() {
    if (typeof PNS.safeWriteJSON === 'function') {
      PNS.safeWriteJSON(PNS.KEYS.KEY_TOP_FILTERS, state.topFilters || {});
    }
  }

  function syncTopFilterUI() {
    const els = getTopFilterEls();
    if (!els.row) return;

    [els.search, els.role, els.shift, els.status].forEach((el) => { if (el) el.disabled = false; });

    if (els.search) els.search.value = state.topFilters?.search || '';

    if (els.role) {
      const role = state.topFilters?.role || 'all';
      const want = role === 'all' ? 'all' : role.toLowerCase();
      const match = Array.from(els.role.options).find(o => {
        const n = normText(o.value || o.textContent);
        if (want === 'all') return /(усі|всі|all)/i.test(o.textContent);
        return n === want;
      });
      if (match) els.role.value = match.value;
    }

    if (els.shift) {
      const sv = state.topFilters?.shift || 'all';
      const match = Array.from(els.shift.options).find(o => {
        const n = normalizeShiftFilterValueUI(o.value || o.textContent);
        if (sv === 'all') return /(усі|всі|all)/i.test(o.textContent);
        return n === sv;
      });
      if (match) els.shift.value = match.value;
    }

    if (els.status) {
      const st = state.topFilters?.status || 'all';
      const match = Array.from(els.status.options).find(o => normalizeStatusFilterValue(o.value || o.textContent) === st);
      if (match) els.status.value = match.value;
    }
  }

  function applyPlayerTableFilters() {
    if (!Array.isArray(state.players) || !state.players.length) return;

    const q = normText(state.topFilters?.search);
    const roleF = normalizeRoleFilterValue(state.topFilters?.role || 'all');
    const statusF = normalizeStatusFilterValue(state.topFilters?.status || 'all');
    const shiftF = normalizeShiftFilterValueUI(state.topFilters?.shift || 'all');

    state.players.forEach((p) => {
      const row = p.rowEl;
      if (!row) return;

      let ok = true;
      const effectiveShiftFilter = shiftF === 'all' ? 'all' : shiftF;

      if (!PNS.matchesShift(p.shift || row.dataset.shift || 'both', effectiveShiftFilter)) ok = false;
      if (ok && roleF !== 'all' && PNS.normalizeRole(p.role) !== roleF) ok = false;

      if (ok && statusF !== 'all') {
        if (statusF === 'free' && !!p.assignment) ok = false;
        if (statusF === 'assigned' && !p.assignment) ok = false;
        if (statusF === 'captains' && !p.captainReady) ok = false;
      }

      if (ok && q) {
        const hay = [p.name, p.alliance, p.role, p.tier, p.notes].map(normText).join(' | ');
        if (!hay.includes(q)) ok = false;
      }

      row.hidden = !ok;
    });
  }

  function bindTopFilterEvents() {
    const els = getTopFilterEls();
    if (!els.row) return;

    [els.search, els.role, els.shift, els.status].forEach((el) => { if (el) el.disabled = false; });

    // Після partial swap елементи нові -> dataset.boundFilter ще нема -> все ок
    if (els.search && !els.search.dataset.boundFilter) {
      els.search.dataset.boundFilter = '1';
      els.search.addEventListener('input', () => {
        state.topFilters.search = els.search.value || '';
        saveTopFilters();
        applyPlayerTableFilters();
      });
    }

    if (els.role && !els.role.dataset.boundFilter) {
      els.role.dataset.boundFilter = '1';
      els.role.addEventListener('change', () => {
        state.topFilters.role = normalizeRoleFilterValue(
          els.role.value || els.role.options[els.role.selectedIndex]?.textContent
        );
        saveTopFilters();
        applyPlayerTableFilters();
      });
    }

    if (els.shift && !els.shift.dataset.boundFilter) {
      els.shift.dataset.boundFilter = '1';
      els.shift.addEventListener('change', () => {
        const next = normalizeShiftFilterValueUI(
          els.shift.value || els.shift.options[els.shift.selectedIndex]?.textContent
        );
        state.topFilters.shift = next;
        saveTopFilters();
        PNS.applyShiftFilter(next === 'all' ? 'all' : next);
      });
    }

    if (els.status && !els.status.dataset.boundFilter) {
      els.status.dataset.boundFilter = '1';
      els.status.addEventListener('change', () => {
        state.topFilters.status = normalizeStatusFilterValue(
          els.status.value || els.status.options[els.status.selectedIndex]?.textContent
        );
        saveTopFilters();
        applyPlayerTableFilters();
      });
    }
  }

  // ===== авто-реініт після partials =====
  function reInitFilters() {
    // 1) ensure state has filters
    if (!state.topFilters) loadTopFilters();

    // 2) bind events to current DOM
    bindTopFilterEvents();

    // 3) sync UI from state
    syncTopFilterUI();

    // 4) apply if players already parsed/rendered
    applyPlayerTableFilters();
  }

  // expose API
  PNS.loadTopFilters = loadTopFilters;
  PNS.saveTopFilters = saveTopFilters;
  PNS.syncTopFilterUI = syncTopFilterUI;
  PNS.applyPlayerTableFilters = applyPlayerTableFilters;
  PNS.bindTopFilterEvents = bindTopFilterEvents;
  PNS.reInitFilters = reInitFilters;

  // initial
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reInitFilters);
  } else {
    reInitFilters();
  }

  // HTMX swaps
  document.addEventListener('htmx:afterSwap', reInitFilters);
  document.addEventListener('htmx:afterSettle', reInitFilters);

  // custom event (якщо ти сам робиш fetch і вставляєш HTML)
  document.addEventListener('pns:partials:loaded', reInitFilters);

})();