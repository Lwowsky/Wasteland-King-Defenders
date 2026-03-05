(function () {
  const PNS = window.PNS; if (!PNS) return;
  const MS = (PNS.ModalsShift = PNS.ModalsShift || {});
  const { state } = PNS; if (!state) return;
  const $$ = PNS.$$ || ((s, r = document) => Array.from(r.querySelectorAll(s)));
  const $ = PNS.$ || ((s, r = document) => r.querySelector(s));

  function cloneAssignment(a) { return a ? { baseId: a.baseId, kind: a.kind } : null; }
  function snapshotShiftPlan() {
    const players = {};
    (state.players || []).forEach((p) => { players[p.id] = cloneAssignment(p.assignment); });
    const bases = {};
    (state.bases || []).forEach((b) => {
      bases[b.id] = {
        captainId: b.captainId || null,
        helperIds: Array.isArray(b.helperIds) ? b.helperIds.slice() : [],
        role: b.role || null,
      };
    });
    return { players, bases };
  }
  function restoreShiftPlan(plan) {
    if (!plan) {
      (state.players || []).forEach((p) => { p.assignment = null; });
      (state.bases || []).forEach((b) => {
        b.captainId = null; b.helperIds = [];
        if (typeof PNS.applyBaseRoleUI === 'function') PNS.applyBaseRoleUI(b, null);
      });
      return;
    }
    (state.players || []).forEach((p) => { p.assignment = cloneAssignment(plan.players?.[p.id] || null); });
    (state.bases || []).forEach((b) => {
      const s = plan.bases?.[b.id] || {};
      b.captainId = s.captainId || null;
      b.helperIds = Array.isArray(s.helperIds) ? s.helperIds.slice() : [];
      if (typeof PNS.applyBaseRoleUI === 'function') {
        const captain = b.captainId ? state.playerById?.get?.(b.captainId) : null;
        PNS.applyBaseRoleUI(b, captain?.role || s.role || null);
      }
    });
  }
  function saveCurrentShiftPlanSnapshot() {
    if (!['shift1', 'shift2'].includes(state.activeShift)) return;
    state.shiftPlans = state.shiftPlans || {};
    state.shiftPlans[state.activeShift] = snapshotShiftPlan();
  }
  function loadShiftPlanSnapshot(shift) {
    if (!['shift1', 'shift2'].includes(shift)) return;
    state.shiftPlans = state.shiftPlans || {};
    restoreShiftPlan(state.shiftPlans[shift] || null);
  }

  function matchesShift(itemShift, filter) {
    const normalized = String(itemShift || '').toLowerCase().trim();
    if (filter === 'all') return true;
    if (normalized === 'both') return true;
    return normalized === filter;
  }

  function syncSettingsShiftBadge() {
    const badge = document.getElementById('settingsShiftBadge');
    if (!badge) return;
    const label = state.activeShift === 'shift1' ? 'Shift 1' : state.activeShift === 'shift2' ? 'Shift 2' : 'All';
    badge.textContent = label;
  }

  function updateShiftTabButtons() {
    (MS.getShiftTabs ? MS.getShiftTabs() : []).forEach((btn) => {
      const isActive = btn.dataset.shiftTab === state.activeShift;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
    syncSettingsShiftBadge();
    document.querySelectorAll('[data-picker-shift-tab]').forEach((btn) => {
      const target = btn.dataset.pickerShiftTab;
      const isActive = target === state.activeShift;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  function updateBoardTitle() {
    const title = $('#boardTitle');
    if (!title) return;
    if (state.activeShift === 'shift1') title.textContent = '1st shift / Первая половина';
    else if (state.activeShift === 'shift2') title.textContent = '2nd shift / Вторая половина';
    else title.textContent = 'All shifts / Все смены';
  }

  function applyShiftFilter(shift) {
    const nextShift = ['shift1', 'shift2', 'all'].includes(shift) ? shift : 'all';
    if (nextShift !== state.activeShift) saveCurrentShiftPlanSnapshot();
    state.activeShift = nextShift;

    if (nextShift === 'shift1' || nextShift === 'shift2') {
      loadShiftPlanSnapshot(nextShift);
      try { PNS.applyBaseTowerRulesForActiveShift?.(); } catch {}
      if (typeof PNS.renderAll === 'function') PNS.renderAll();
    }

    $$('tbody tr[data-shift]').forEach((row) => { row.hidden = false; });
    $$('.base-card[data-shift]').forEach((card) => { card.hidden = !matchesShift(card.dataset.shift, state.activeShift); });
    $$('.board-col[data-shift]').forEach((col) => { col.hidden = !matchesShift(col.dataset.shift, state.activeShift); });

    updateShiftTabButtons();
    updateBoardTitle();

    if (state.topFilters) {
      if (state.topFilters.shift !== 'all') state.topFilters.shift = state.activeShift;
      if (typeof PNS.syncTopFilterUI === 'function') PNS.syncTopFilterUI();
      if (typeof PNS.applyPlayerTableFilters === 'function') PNS.applyPlayerTableFilters();
      if (typeof PNS.saveTopFilters === 'function') PNS.saveTopFilters();
    }
    try { localStorage.setItem(PNS.KEYS.KEY_SHIFT_FILTER, state.activeShift); } catch {}

    state.towerViewMode = state.towerViewMode || 'focus';
    setTimeout(() => {
      try { MS.applyTowerVisibilityMode?.(); } catch {}
      try { MS.syncTowerViewToggleButton?.(); } catch {}
      try { MS.syncFocusedTowerSelect?.(); } catch {}
      try { MS.refreshTowerPickerModalList?.(); MS.updateTowerPickerDetail?.(); } catch {}
    }, 0);
    saveCurrentShiftPlanSnapshot();
  }

  function handleShiftTabClick(e) {
    const btn = e.target.closest('[data-shift-tab]');
    if (!btn) return;
    e.preventDefault();
    applyShiftFilter(btn.dataset.shiftTab);
  }

  Object.assign(MS, {
    cloneAssignment,
    snapshotShiftPlan,
    restoreShiftPlan,
    saveCurrentShiftPlanSnapshot,
    loadShiftPlanSnapshot,
    matchesShift,
    syncSettingsShiftBadge,
    updateShiftTabButtons,
    updateBoardTitle,
    applyShiftFilter,
    handleShiftTabClick,
  });
})();
