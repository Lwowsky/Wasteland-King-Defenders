(function(){
  "use strict";

  const PNS = window.PNS = window.PNS || {};
  const FLAG = "__pns_tower_calc_runtime_core__";
  if (window[FLAG]) return;
  window[FLAG] = true;

  const MODAL_ID = "towerCalcModal";
  const tr = (key, fallback = "") => typeof PNS.t === "function" ? PNS.t(key, fallback) : fallback;

  let refreshTimer = 0;
  let patchingUi = false;

  const qs = (selector, root = document) => {
    try { return (root || document).querySelector(selector); } catch { return null; }
  };
  const byId = (id, root = document) => {
    try { return (root || document).getElementById ? (root || document).getElementById(id) : document.getElementById(id); }
    catch { return document.getElementById(id); }
  };

  function getModal(){
    try { return PNS.towerCalcGetModal?.() || byId(MODAL_ID); }
    catch { return byId(MODAL_ID); }
  }

  function getOverflowPanel(root){
    return qs("#towerCalcOverflowOut", root) || qs('[data-calc-main-panel="overflow"]', root);
  }

  function overflowLooksReady(node){
    if (!node) return false;
    const text = String(node.textContent || "");
    return !!(
      node.querySelector("[data-calc-set-player-shift]") ||
      text.includes("Хто не вліз / резерв") ||
      text.includes("Не використано") ||
      text.includes("Both не чіпається")
    );
  }

  function isModalVisible(modal){
    if (!modal) return false;
    if (modal.classList?.contains("is-open")) return true;
    if (modal.offsetParent !== null) return true;
    try {
      const style = window.getComputedStyle(modal);
      return style.display !== "none" && style.visibility !== "hidden";
    } catch {
      return false;
    }
  }

  function applyRuntimeUi(){
    if (patchingUi) return false;
    patchingUi = true;
    try {
      try { PNS.ensureTowerCalcStyleCore?.(); } catch {}
      const modal = getModal();
      if (!modal) return false;

      if (typeof PNS.patchTowerCalcPresentation === "function") {
        PNS.patchTowerCalcPresentation(modal);
      } else {
        try { PNS.installTowerCalcLayoutUi?.(modal); } catch {}
        try { PNS.installTowerCalcSummaryUi?.(modal); } catch {}
      }

      try {
        const overflow = getOverflowPanel(modal);
        if (overflow && (!overflow.querySelector(".tcv5-status-view") || overflowLooksReady(overflow))) {
          PNS.installTowerCalcSummaryUi?.(modal);
        }
      } catch {}

      try { bindOverflowObserver(); } catch {}
      try { bindModalObserver(); } catch {}
      return true;
    } finally {
      patchingUi = false;
    }
  }

  function scheduleRefresh(delay, shouldCompute){
    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      const modal = getModal();
      const visible = isModalVisible(modal);
      if (!visible) {
        return;
      }
      try {
        if (shouldCompute !== false) window.computeTowerCalcResults?.();
      } catch {}
      applyRuntimeUi();
    }, delay ?? 80);
    return true;
  }

  function clearHelpersUi(shiftKey){
    const modals = PNS.ModalsShift || {};
    const state = PNS.state;
    if (!state) return false;

    const clearForShift = currentShift => {
      if (!["shift1", "shift2"].includes(String(currentShift || ""))) return;
      try { modals.saveCurrentShiftPlanSnapshot?.(); } catch {}
      state.shiftPlans = state.shiftPlans || {};
      const plan = state.shiftPlans[currentShift] && typeof state.shiftPlans[currentShift] === "object"
        ? state.shiftPlans[currentShift]
        : (typeof modals.snapshotShiftPlan === "function" ? modals.snapshotShiftPlan() : { players: {}, bases: {} });
      plan.players = plan.players && typeof plan.players === "object" ? plan.players : {};
      plan.bases = plan.bases && typeof plan.bases === "object" ? plan.bases : {};

      if (String(state.activeShift || "") === currentShift) {
        const bases = Array.isArray(state.bases) ? state.bases : [];
        for (const base of bases) {
          const baseId = String(base?.id || "");
          if (!baseId) continue;
          const helperIds = Array.isArray(base?.helperIds) ? base.helperIds.slice() : [];
          if (helperIds.length && typeof PNS.clearBaseAssignments === "function") {
            try { PNS.clearBaseAssignments(baseId, true); } catch {}
          } else {
            base.helperIds = [];
          }
          const baseSnap = plan.bases[baseId] && typeof plan.bases[baseId] === "object" ? plan.bases[baseId] : (plan.bases[baseId] = {});
          const existingHelperIds = Array.isArray(baseSnap.helperIds) ? baseSnap.helperIds.slice() : helperIds;
          baseSnap.helperIds = [];
          for (const helperId of existingHelperIds) {
            const id = String(helperId || "");
            if (id && plan.players[id]?.baseId === baseId && plan.players[id]?.kind === "helper") {
              plan.players[id] = null;
            }
          }
        }
        try { modals.saveCurrentShiftPlanSnapshot?.(); } catch {}
      } else {
        const bases = plan.bases || {};
        for (const [baseId, value] of Object.entries(bases)) {
          const baseSnap = value && typeof value === "object" ? value : (bases[baseId] = {});
          const helperIds = Array.isArray(baseSnap.helperIds) ? baseSnap.helperIds.slice() : [];
          baseSnap.helperIds = [];
          for (const helperId of helperIds) {
            const id = String(helperId || "");
            if (id && plan.players[id]?.baseId === String(baseId) && plan.players[id]?.kind === "helper") {
              plan.players[id] = null;
            }
          }
        }
        state.shiftPlans[currentShift] = plan;
        try {
          localStorage.setItem("pns_layout_shift_plans_store_v1", JSON.stringify({
            shift1: state.shiftPlans?.shift1 || null,
            shift2: state.shiftPlans?.shift2 || null,
          }));
        } catch {}
      }
    };

    if (shiftKey === "all") {
      clearForShift("shift1");
      clearForShift("shift2");
    } else {
      clearForShift(shiftKey);
    }

    try { PNS.renderAll?.(); } catch {}
    try {
      if (isModalVisible(getModal())) window.computeTowerCalcResults?.();
    } catch {}
    try {
      const message = shiftKey === "all"
        ? tr("clear_helpers_both_done", "Очищено помічників у змінах 1 і 2. Капітани залишилися.")
        : `${tr("clear_helpers_done_prefix", "Очищено помічників:")} ${shiftKey === "shift1" ? tr("shift1", "Зміна 1") : tr("shift2", "Зміна 2")}. ${tr("captains_stayed", "Капітани залишилися.")}`;
      PNS.setImportStatus?.(message, "good");
    } catch {}
    return true;
  }

  function bindOverflowObserver(){
    const panel = getOverflowPanel(getModal());
    if (!panel || panel.dataset.tcRuntimeOverflowObserved === "1") return false;
    panel.dataset.tcRuntimeOverflowObserved = "1";
    new MutationObserver(() => {
      if (patchingUi || !isModalVisible(getModal())) return;
      window.clearTimeout(Number(panel.dataset.tcRuntimeOverflowTimer || 0));
      const timer = window.setTimeout(() => {
        if (!patchingUi && (overflowLooksReady(panel) || !panel.querySelector(".tcv5-status-view"))) {
          applyRuntimeUi();
        }
      }, 16);
      panel.dataset.tcRuntimeOverflowTimer = String(timer);
    }).observe(panel, { childList: true, subtree: true });
    return true;
  }

  function bindModalObserver(){
    const modal = getModal();
    if (!modal || modal.dataset.tcRuntimeCoreObserved === "1") return false;
    modal.dataset.tcRuntimeCoreObserved = "1";
    new MutationObserver(() => {
      if (isModalVisible(modal)) scheduleRefresh(90, false);
    }).observe(modal, { attributes: true, attributeFilter: ["class", "style"] });
    return true;
  }

  function installRuntimeUi(){
    if (document.documentElement.dataset.towerCalcRuntimeCoreBound === "1") return false;
    document.documentElement.dataset.towerCalcRuntimeCoreBound = "1";

    document.addEventListener("click", event => {
      const tab = event.target.closest("[data-ov5-tab]");
      if (!tab) return;
      try { PNS.towerCalcPatchUiState?.({ overflowTab: tab.dataset.ov5Tab }); } catch {}
      applyRuntimeUi();
    });

    document.addEventListener("click", event => {
      const filter = event.target.closest("[data-ov5-filter]");
      if (!filter) return;
      event.preventDefault();
      const shift = PNS.towerCalcReadUiState?.().overflowTab || "shift1";
      try { PNS.towerCalcSetOverflowFilter?.(shift, filter.dataset.ov5Filter); } catch {}
      applyRuntimeUi();
    });

    document.addEventListener("click", event => {
      const reset = event.target.closest("[data-ov5-reset-shift]");
      if (!reset) return;
      event.preventDefault();
      PNS.towerCalcResetOverflowReserveForShift?.(reset.dataset.ov5ResetShift);
    });

    document.addEventListener("click", event => {
      if (!event.target.closest("[data-ov5-restore-import]")) return;
      event.preventDefault();
      PNS.towerCalcRestoreOverflowFromImport?.();
      scheduleRefresh(20, true);
      setTimeout(() => {
        try { window.calcApplyMainTabUI?.(getModal() || document, "overflow"); } catch {}
        applyRuntimeUi();
      }, 60);
      setTimeout(() => {
        try { window.calcApplyMainTabUI?.(getModal() || document, "overflow"); } catch {}
        applyRuntimeUi();
      }, 180);
    });

    document.addEventListener("click", event => {
      const btn = event.target.closest("[data-ui-reserve-shift]");
      if (!btn) return;
      event.preventDefault();
      if (PNS.towerCalcToggleReserveCore?.(btn.dataset.playerId, btn.dataset.uiReserveShift)) {
        scheduleRefresh(30, true);
        setTimeout(() => applyRuntimeUi(), 90);
      }
    });

    document.addEventListener("change", event => {
      const limits = event.target.closest("#tcv5EnableShiftLimits");
      if (limits) {
        try { PNS.towerCalcPatchUiState?.({ manualLimitEdit: !!limits.checked }); } catch {}
        try { PNS.towerCalcSyncLimitEditability?.(getModal() || document); } catch {}
        applyRuntimeUi();
        return;
      }
      const modal = getModal();
      if (!modal || !isModalVisible(modal) || !modal.contains(event.target)) return;
      if (event.target.closest("select,input,textarea")) scheduleRefresh(100, true);
    });

    document.addEventListener("click", event => {
      const modal = getModal();
      if (!modal || !isModalVisible(modal)) return;
      if (!event.target.closest("#towerCalcApplyToTowersBtn,#towerCalcQuickApplyBtn,#towerCalcRestoreImportShiftsBtn,#applyShiftAddBtn,[data-calc-main-tab],[data-calc-tab],[data-calc-open-base],[data-calc-pick-overflow-base],[data-calc-toggle-exclude],[data-calc-reserve]")) {
        return;
      }
      scheduleRefresh(80, true);
      setTimeout(() => applyRuntimeUi(), 160);
    });

    document.addEventListener("players-table-rendered", () => {
      if (isModalVisible(getModal())) scheduleRefresh(80, false);
    });
    document.addEventListener("pns:assignment-changed", () => {
      if (isModalVisible(getModal())) scheduleRefresh(40, true);
    });
    document.addEventListener("pns:dom:refreshed", () => {
      if (isModalVisible(getModal())) scheduleRefresh(80, false);
    });
    window.addEventListener("resize", () => {
      if (isModalVisible(getModal())) scheduleRefresh(40, false);
    }, { passive: true });

    applyRuntimeUi();
    bindModalObserver();
    bindOverflowObserver();
    if (isModalVisible(getModal())) scheduleRefresh(120, false);
    return true;
  }

  function boot(){
    try { installRuntimeUi(); }
    catch (error) { console.warn("[tower_calc_runtime_ui_core]", error); }
  }

  PNS.patchTowerCalcRuntimeUi = applyRuntimeUi;
  PNS.towerCalcScheduleRefresh = scheduleRefresh;
  PNS.towerCalcClearHelpersUi = clearHelpersUi;
  PNS.installTowerCalcRuntimeUi = installRuntimeUi;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
  window.addEventListener("load", boot, { once: true });
  document.addEventListener("pns:dom:refreshed", boot);
})();
