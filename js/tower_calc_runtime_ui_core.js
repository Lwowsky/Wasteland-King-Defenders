(function () {
  'use strict';

  const PNS = window.PNS = window.PNS || {};
  const KEY = '__pns_tower_calc_runtime_core__';
  if (window[KEY]) return;
  window[KEY] = true;

  const MODAL_ID = 'towerCalcModal';
  let refreshTimer = 0;
  let patchLock = false;

  const q = (s, r = document) => {
    try { return (r || document).querySelector(s); } catch { return null; }
  };
  const byId = (id, r = document) => (r || document).getElementById ? (r || document).getElementById(id) : document.getElementById(id);

  function getModal() {
    try { return PNS.towerCalcGetModal?.() || byId(MODAL_ID); } catch { return byId(MODAL_ID); }
  }

  function getOverflowPanel(root) {
    return q('#towerCalcOverflowOut', root) || q('[data-calc-main-panel="overflow"]', root);
  }

  function isLegacyOverflowPanel(panel) {
    if (!panel) return false;
    const text = String(panel.textContent || '');
    return !!(
      panel.querySelector('[data-calc-set-player-shift]')
      || text.includes('Хто не вліз / резерв')
      || text.includes('Не використано')
      || text.includes('Both не чіпається')
    );
  }

  function ensureStatusOverflowUi(root) {
    const panel = getOverflowPanel(root);
    if (!panel) return false;
    const hasStatusUi = !!panel.querySelector('.tcv5-status-view');
    if (hasStatusUi && !isLegacyOverflowPanel(panel)) return false;
    try { PNS.installTowerCalcSummaryUi?.(root); } catch {}
    return true;
  }

  function patchModal() {
    if (patchLock) return false;
    patchLock = true;
    try {
      try { PNS.ensureTowerCalcStyleCore?.(); } catch {}
      const root = getModal();
      if (!root) return false;
      if (typeof PNS.patchTowerCalcPresentation === 'function') {
        PNS.patchTowerCalcPresentation(root);
      } else {
        try { PNS.installTowerCalcLayoutUi?.(root); } catch {}
        try { PNS.installTowerCalcSummaryUi?.(root); } catch {}
      }
      try { ensureStatusOverflowUi(root); } catch {}
      try { observeOverflowPanel(); } catch {}
      return true;
    } finally {
      patchLock = false;
    }
  }

  function scheduleRefresh(delay, doCompute) {
    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      try {
        if (doCompute !== false) window.computeTowerCalcResults?.();
      } catch {}
      patchModal();
    }, delay == null ? 80 : delay);
    return true;
  }

  function clearHelpers(mode) {
    const MS = PNS.ModalsShift || {};
    const state = PNS.state;
    if (!state) return false;

    const persistPlans = () => {
      try {
        const KEY = 'pns_layout_shift_plans_store_v1';
        localStorage.setItem(KEY, JSON.stringify({
          shift1: state.shiftPlans?.shift1 || null,
          shift2: state.shiftPlans?.shift2 || null,
        }));
      } catch {}
    };

    const clearPlanForShift = (shiftKey) => {
      if (!['shift1', 'shift2'].includes(String(shiftKey || ''))) return;
      try { MS.saveCurrentShiftPlanSnapshot?.(); } catch {}
      state.shiftPlans = state.shiftPlans || {};
      const plan = (state.shiftPlans[shiftKey] && typeof state.shiftPlans[shiftKey] === 'object')
        ? state.shiftPlans[shiftKey]
        : (typeof MS.snapshotShiftPlan === 'function' ? MS.snapshotShiftPlan() : { players: {}, bases: {} });

      plan.players = (plan.players && typeof plan.players === 'object') ? plan.players : {};
      plan.bases = (plan.bases && typeof plan.bases === 'object') ? plan.bases : {};

      const active = String(state.activeShift || '') === shiftKey;

      if (active) {
        const liveBases = Array.isArray(state.bases) ? state.bases : [];
        for (const base of liveBases) {
          const baseId = String(base?.id || '');
          if (!baseId) continue;
          const helperIds = Array.isArray(base?.helperIds) ? base.helperIds.slice() : [];
          if (helperIds.length && typeof PNS.clearBaseAssignments === 'function') {
            try { PNS.clearBaseAssignments(baseId, true); } catch {}
          } else {
            base.helperIds = [];
          }
          const snap = (plan.bases[baseId] && typeof plan.bases[baseId] === 'object') ? plan.bases[baseId] : (plan.bases[baseId] = {});
          const removed = Array.isArray(snap.helperIds) ? snap.helperIds.slice() : helperIds;
          snap.helperIds = [];
          for (const pid of removed) {
            const id = String(pid || '');
            if (!id) continue;
            if (plan.players[id]?.baseId === baseId && plan.players[id]?.kind === 'helper') plan.players[id] = null;
          }
        }
        try { MS.saveCurrentShiftPlanSnapshot?.(); } catch {}
      } else {
        const basesObj = plan.bases || {};
        for (const [baseId, snap0] of Object.entries(basesObj)) {
          const snap = (snap0 && typeof snap0 === 'object') ? snap0 : (basesObj[baseId] = {});
          const removed = Array.isArray(snap.helperIds) ? snap.helperIds.slice() : [];
          snap.helperIds = [];
          for (const pid of removed) {
            const id = String(pid || '');
            if (!id) continue;
            if (plan.players[id]?.baseId === String(baseId) && plan.players[id]?.kind === 'helper') plan.players[id] = null;
          }
        }
        state.shiftPlans[shiftKey] = plan;
        persistPlans();
      }
    };

    if (mode === 'all') {
      clearPlanForShift('shift1');
      clearPlanForShift('shift2');
    } else {
      clearPlanForShift(mode);
    }

    try { PNS.renderAll?.(); } catch {}
    try { window.computeTowerCalcResults?.(); } catch {}
    try {
      const msg = mode === 'all'
        ? 'Очищено помічників у змінах 1 і 2. Капітани залишилися.'
        : `Очищено помічників: ${mode === 'shift1' ? 'Зміна 1' : 'Зміна 2'}. Капітани залишилися.`;
      PNS.setImportStatus?.(msg, 'good');
    } catch {}
    return true;
  }

  function toggleReserve(playerId, shiftKey) {
    const changed = !!PNS.towerCalcToggleReserveCore?.(playerId, shiftKey);
    if (!changed) return false;
    scheduleRefresh(30, true);
    setTimeout(() => patchModal(), 90);
    setTimeout(() => patchModal(), 220);
    return true;
  }

  function bindEvents() {
    if (document.documentElement.dataset.towerCalcRuntimeCoreBound === '1') return false;
    document.documentElement.dataset.towerCalcRuntimeCoreBound = '1';

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ov5-tab]');
      if (!btn) return;
      try { PNS.towerCalcPatchUiState?.({ overflowTab: btn.dataset.ov5Tab }); } catch {}
      patchModal();
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ov5-filter]');
      if (!btn) return;
      e.preventDefault();
      const active = PNS.towerCalcReadUiState?.().overflowTab || 'shift1';
      try { PNS.towerCalcSetOverflowFilter?.(active, btn.dataset.ov5Filter); } catch {}
      patchModal();
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ov5-reset-shift]');
      if (!btn) return;
      e.preventDefault();
      PNS.towerCalcResetOverflowReserveForShift?.(btn.dataset.ov5ResetShift);
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ov5-restore-import]');
      if (!btn) return;
      e.preventDefault();
      PNS.towerCalcRestoreOverflowFromImport?.();
      scheduleRefresh(20, true);
      setTimeout(() => {
        try { window.calcApplyMainTabUI?.(getModal() || document, 'overflow'); } catch {}
        patchModal();
      }, 60);
      setTimeout(() => {
        try { window.calcApplyMainTabUI?.(getModal() || document, 'overflow'); } catch {}
        patchModal();
      }, 180);
      setTimeout(() => {
        try { window.calcApplyMainTabUI?.(getModal() || document, 'overflow'); } catch {}
        patchModal();
      }, 420);
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ui-reserve-shift]');
      if (!btn) return;
      e.preventDefault();
      toggleReserve(btn.dataset.playerId, btn.dataset.uiReserveShift);
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#towerCalcClearShift1Btn,#towerCalcClearShift2Btn,#towerCalcClearHelpersAllBtn');
      if (!btn) return;
      e.preventDefault();
      if (btn.id === 'towerCalcClearShift1Btn') clearHelpers('shift1');
      else if (btn.id === 'towerCalcClearShift2Btn') clearHelpers('shift2');
      else clearHelpers('all');
      scheduleRefresh(40, true);
    });

    document.addEventListener('change', (e) => {
      const en = e.target.closest('#tcv5EnableShiftLimits');
      if (en) {
        try { PNS.towerCalcPatchUiState?.({ manualLimitEdit: !!en.checked }); } catch {}
        try { PNS.towerCalcSyncLimitEditability?.(getModal() || document); } catch {}
        patchModal();
        return;
      }

      const root = getModal();
      if (!root || !root.contains(e.target)) return;
      if (e.target.closest('select,input,textarea')) scheduleRefresh(100, true);
    });

    document.addEventListener('click', (e) => {
      const root = getModal();
      if (!root) return;
      const target = e.target.closest('#towerCalcLoadCaptainsBtn,#towerCalcApplyToTowersBtn,#towerCalcQuickApplyBtn,#towerCalcRestoreImportShiftsBtn,#applyShiftAddBtn,[data-calc-main-tab],[data-calc-tab],[data-calc-open-base],[data-calc-pick-overflow-base],[data-calc-toggle-exclude],[data-calc-reserve]');
      if (!target) return;
      scheduleRefresh(80, true);
      setTimeout(() => patchModal(), 160);
    });

    document.addEventListener('players-table-rendered', () => scheduleRefresh(80, false));
    document.addEventListener('pns:assignment-changed', () => scheduleRefresh(40, true));
    document.addEventListener('pns:dom:refreshed', () => scheduleRefresh(80, false));
    document.addEventListener('pns:tower-calc-overflow-restored', () => {
      scheduleRefresh(20, true);
      setTimeout(() => patchModal(), 60);
      setTimeout(() => patchModal(), 180);
      setTimeout(() => patchModal(), 420);
    });
    window.addEventListener('resize', () => scheduleRefresh(40, false), { passive: true });
    return true;
  }


  function observeOverflowPanel() {
    const root = getModal();
    const panel = getOverflowPanel(root);
    if (!panel || panel.dataset.tcRuntimeOverflowObserved === '1') return false;
    panel.dataset.tcRuntimeOverflowObserved = '1';
    const mo = new MutationObserver(() => {
      if (patchLock) return;
      window.clearTimeout(Number(panel.dataset.tcRuntimeOverflowTimer || 0));
      const timer = window.setTimeout(() => {
        if (patchLock) return;
        if (isLegacyOverflowPanel(panel) || !panel.querySelector('.tcv5-status-view')) patchModal();
      }, 0);
      panel.dataset.tcRuntimeOverflowTimer = String(timer);
    });
    mo.observe(panel, { childList: true, subtree: true });
    return true;
  }

  function observeOpenOnly() {
    const root = getModal();
    if (!root || root.dataset.tcRuntimeCoreObserved === '1') return false;
    root.dataset.tcRuntimeCoreObserved = '1';
    const mo = new MutationObserver(() => {
      const isOpen = root.classList.contains('is-open') || root.offsetParent !== null;
      if (isOpen) {
        patchModal();
        setTimeout(() => patchModal(), 50);
        setTimeout(() => patchModal(), 180);
        setTimeout(() => patchModal(), 420);
      }
    });
    mo.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
    return true;
  }

  function install() {
    bindEvents();
    patchModal();
    observeOpenOnly();
    observeOverflowPanel();
    setTimeout(() => patchModal(), 40);
    setTimeout(() => patchModal(), 180);
    setTimeout(() => patchModal(), 420);
    return true;
  }

  PNS.patchTowerCalcRuntimeUi = patchModal;
  PNS.towerCalcScheduleRefresh = scheduleRefresh;
  PNS.towerCalcClearHelpersUi = clearHelpers;
  PNS.installTowerCalcRuntimeUi = install;

  function run() {
    try { install(); } catch (e) { console.warn('[tower_calc_runtime_ui_core]', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  window.addEventListener('load', run, { once: true });
  document.addEventListener('htmx:afterSwap', run);
  document.addEventListener('pns:dom:refreshed', run);
})();
