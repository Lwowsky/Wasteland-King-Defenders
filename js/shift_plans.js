(function () {
  const PNS = window.PNS; if (!PNS) return;
  const MS = (PNS.ModalsShift = PNS.ModalsShift || {});
  const { state } = PNS; if (!state) return;
  const $$ = PNS.$$ || ((s, r = document) => Array.from(r.querySelectorAll(s)));
  const $ = PNS.$ || ((s, r = document) => r.querySelector(s));
  const t = (key, fallback = '') => (typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback);
  const KEY_SHIFT_PLANS_STORE = 'pns_layout_shift_plans_store_v1';

  function safeReadShiftPlansStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY_SHIFT_PLANS_STORE) || '{}');
      return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    } catch { return {}; }
  }
  function safeWriteShiftPlansStore(value) {
    try { localStorage.setItem(KEY_SHIFT_PLANS_STORE, JSON.stringify(value || {})); } catch {}
  }
  function ensureShiftPlansLoaded() {
    if (state._shiftPlansLoadedFromLS) return;
    state._shiftPlansLoadedFromLS = true;
    const saved = safeReadShiftPlansStore();
    state.shiftPlans = (state.shiftPlans && typeof state.shiftPlans === 'object') ? state.shiftPlans : {};
    ['shift1','shift2'].forEach((k) => {
      if (saved[k] && !state.shiftPlans[k]) state.shiftPlans[k] = saved[k];
    });
  }
  function persistShiftPlansStore() {
    ensureShiftPlansLoaded();
    safeWriteShiftPlansStore({
      shift1: state.shiftPlans?.shift1 || null,
      shift2: state.shiftPlans?.shift2 || null,
    });
  }

  function cloneAssignment(a) { return a ? { baseId: a.baseId, kind: a.kind } : null; }
  function planHasAssignments(plan) {
    if (!plan || typeof plan !== 'object') return false;
    const players = plan.players && typeof plan.players === 'object' ? plan.players : {};
    return Object.values(players).some((a) => a && a.baseId);
  }
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
  function saveCurrentShiftPlanSnapshot(opts = {}) {
    if (!['shift1', 'shift2'].includes(state.activeShift)) return;
    ensureShiftPlansLoaded();
    state.shiftPlans = state.shiftPlans || {};
    const nextPlan = snapshotShiftPlan();
    const existingStore = safeReadShiftPlansStore();
    const existingPlan = existingStore?.[state.activeShift] || state.shiftPlans?.[state.activeShift] || null;
    const hasPlayers = Array.isArray(state.players) && state.players.length > 0;
    const overwriteEmpty = !!opts.forceEmpty;

    // Guard: during early boot, DOM/state can briefly rebuild with empty towers before players restore.
    // Do not overwrite a previously saved non-empty shift plan with an empty snapshot in that window.
    if (!overwriteEmpty && (!hasPlayers || !planHasAssignments(nextPlan)) && planHasAssignments(existingPlan)) {
      return false;
    }

    state.shiftPlans[state.activeShift] = nextPlan;
    persistShiftPlansStore();
    return true;
  }
  function loadShiftPlanSnapshot(shift) {
    if (!['shift1', 'shift2'].includes(shift)) return;
    ensureShiftPlansLoaded();
    state.shiftPlans = state.shiftPlans || {};
    restoreShiftPlan(normalizePlanForCurrentBases(state.shiftPlans[shift] || null));
  }

  function resolveBaseIdForPlan(baseId) {
    const raw = String(baseId || '');
    if (!raw) return '';
    return typeof PNS.resolveCurrentBaseId === 'function' ? (PNS.resolveCurrentBaseId(raw) || raw) : raw;
  }

  function normalizePlanForCurrentBases(plan) {
    if (!plan || typeof plan !== 'object') return plan;
    const next = { players: {}, bases: {} };
    const players = plan.players && typeof plan.players === 'object' ? plan.players : {};
    Object.entries(players).forEach(([pid, a]) => {
      if (!a || !a.baseId) { next.players[pid] = cloneAssignment(a); return; }
      const resolvedBaseId = resolveBaseIdForPlan(a.baseId);
      next.players[pid] = resolvedBaseId ? { ...a, baseId: resolvedBaseId } : cloneAssignment(a);
    });
    const bases = plan.bases && typeof plan.bases === 'object' ? plan.bases : {};
    Object.entries(bases).forEach(([bid, b]) => {
      const resolvedBaseId = resolveBaseIdForPlan(bid) || String(bid || '');
      if (!resolvedBaseId) return;
      next.bases[resolvedBaseId] = { ...(next.bases[resolvedBaseId] || {}), ...(b || {}) };
    });
    return next;
  }

  function isPlayerUsedInShift(playerId, shift) {
    if (!playerId || !['shift1', 'shift2'].includes(String(shift || '').toLowerCase())) return null;
    ensureShiftPlansLoaded();
    const key = String(shift).toLowerCase();
    const plan = normalizePlanForCurrentBases(state.shiftPlans?.[key]);
    const a = plan?.players?.[playerId] || null;
    if (!a || !a.baseId) return null;
    return { shift: key, label: key === 'shift1' ? t('shift1', 'Зміна 1') : t('shift2', 'Зміна 2'), assignment: a };
  }

  function isPlayerUsedInOtherShift(playerId, currentShift) {
    const cur = String(currentShift || state.activeShift || '').toLowerCase();
    if (!(cur === 'shift1' || cur === 'shift2')) return null;
    const other = cur === 'shift1' ? 'shift2' : 'shift1';
    return isPlayerUsedInShift(playerId, other);
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
    const label = state.activeShift === 'shift1' ? t('shift1', 'Зміна 1') : state.activeShift === 'shift2' ? t('shift2', 'Зміна 2') : t('all', 'Усі');
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
    const t = typeof PNS?.t === 'function' ? PNS.t : ((_, f='') => f);
    const shiftLabel = typeof PNS?.shiftLabel === 'function'
      ? PNS.shiftLabel
      : ((value) => String(value || ''));
    if (state.activeShift === 'shift1') title.textContent = shiftLabel('shift1');
    else if (state.activeShift === 'shift2') title.textContent = shiftLabel('shift2');
    else title.textContent = t('all_shifts', 'Усі зміни');
  }

  function applyShiftFilter(shift) {
    const nextShift = ['shift1', 'shift2', 'all'].includes(shift) ? shift : 'all';
    if (nextShift !== state.activeShift) saveCurrentShiftPlanSnapshot();
    state.activeShift = nextShift;

    if (nextShift === 'shift1' || nextShift === 'shift2') {
      const plan = normalizePlanForCurrentBases(state.shiftPlans?.[nextShift] || null);
      const hasLiveAssignments = (state.bases || []).some((b) => b?.captainId || (Array.isArray(b?.helperIds) && b.helperIds.length));
      const preserveLive = !!state._preserveRestoredAssignmentsOnNextShiftApply && hasLiveAssignments && !planHasAssignments(plan);
      if (!preserveLive) loadShiftPlanSnapshot(nextShift);
      try { state._preserveRestoredAssignmentsOnNextShiftApply = false; } catch {}
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

    state.towerViewMode = state.towerViewMode || 'all';
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
    isPlayerUsedInShift,
    isPlayerUsedInOtherShift,
    matchesShift,
    syncSettingsShiftBadge,
    updateShiftTabButtons,
    updateBoardTitle,
    applyShiftFilter,
    handleShiftTabClick,
  });
})();

(function(){ const PNS = window.PNS; if (!PNS) return; const MS = PNS.ModalsShift || {}; PNS.isPlayerUsedInOtherShift = MS.isPlayerUsedInOtherShift; PNS.isPlayerUsedInShift = MS.isPlayerUsedInShift; })();
