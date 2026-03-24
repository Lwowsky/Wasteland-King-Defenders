/* Final plan tower-calc auto-fit helpers */
(function(){
  const e = window.PNS;
  if (!e) return;
  const { state: a } = e;

  function r() {
    try {
      if (typeof window.getCalcState === "function") return window.getCalcState() || {};
      if (typeof window.getCalcHydratedState === "function") return window.getCalcHydratedState() || {};
    } catch {}
    return a.towerCalc || {};
  }

  function n(value) {
    const defaults = { T14: 300000, T13: 250000, T12: 200000, T11: 150000, T10: 100000, T9: 80000 };
    const out = {};
    for (const key of ["T14", "T13", "T12", "T11", "T10", "T9"]) {
      const num = Math.max(0, Number(value?.[key] ?? defaults[key]) || defaults[key] || 0);
      out[key] = Math.round(num);
    }
    return out;
  }

  function o(modal, shiftKey) {
    const rows = [];
    modal?.querySelectorAll(`[data-calc-row][data-calc-shift="${shiftKey}"]`).forEach(row => {
      rows.push({
        captainId: String(row.querySelector("[data-calc-captain]")?.value || ""),
        troop: String(row.querySelector("[data-calc-troop]")?.value || "fighter").toLowerCase(),
        helpers: Math.max(0, Math.min(29, Number(row.querySelector("[data-calc-helpers]")?.value || 15) || 15)),
      });
    });
    return rows;
  }

  function helperFillMode(modal, state) {
    const explicit = String(modal?.querySelector('#towerCalcHelperFillModeSelect')?.value || modal?.querySelector('#towerCalcHelperFillMode')?.value || state?.helperFillMode || '').toLowerCase();
    if (typeof window.calcNormalizeHelperFillMode === 'function') return window.calcNormalizeHelperFillMode(explicit);
    return explicit === 'max' ? 'max' : (explicit === 'min' ? 'min' : 'mid');
  }

  function helperFillCount(mode) {
    return mode === 'max' ? 29 : (mode === 'min' ? 1 : 10);
  }

  function i(modal) {
    const state = r();
    const shift1 = o(modal, "shift1");
    const shift2 = o(modal, "shift2");
    if (shift1.length) state.shift1 = shift1;
    if (shift2.length) state.shift2 = shift2;
    state.noCrossShift = false;
    state.both50 = !!modal?.querySelector("#towerCalcBoth50")?.checked;
    state.ignoreBoth = !!modal?.querySelector("#towerCalcIgnoreBoth")?.checked;
    state.dontTouchBothVersion = 1;
    state.helperFillMode = helperFillMode(modal, state);
    state.minHelpersPerTower = true;
    state.minHelpersCount = helperFillCount(state.helperFillMode);
    state.activeTab = String(modal?.querySelector("[data-calc-tab].is-active")?.getAttribute("data-calc-tab") || state.activeTab || "shift1").toLowerCase() === "shift2" ? "shift2" : "shift1";
    state.mainTab = String(modal?.querySelector("[data-calc-main-tab].is-active")?.getAttribute("data-calc-main-tab") || state.mainTab || "setup").toLowerCase();
    state.uiMode = String(modal?.querySelector("#towerCalcModeUi")?.value || state.uiMode || "assisted").toLowerCase();
    state.uiApplyMode = String(modal?.querySelector("#towerCalcApplyModeUi")?.value || state.uiApplyMode || "topup").toLowerCase();
    state.tierSizeMode = modal?.querySelector("#towerCalcTierAuto")?.checked ? "auto" : "manual";
    const tierSizeManual = { T14: 300000, T13: 250000, T12: 200000, T11: 150000, T10: 100000, T9: 80000 };
    modal?.querySelectorAll("[data-calc-tier-target]").forEach(input => {
      const key = String(input?.dataset?.calcTierTarget || "").toUpperCase();
      if (key) tierSizeManual[key] = Math.max(0, Number(input.value || tierSizeManual[key] || 0) || tierSizeManual[key] || 0);
    });
    state.tierSizeManual = n(tierSizeManual);
    try { localStorage.setItem("pns_tower_calc_state", JSON.stringify(state)); } catch {}
    return state;
  }

  function s(baseId) {
    const state = r();
    return !!(state?.towerPrefs && state.towerPrefs[String(baseId || "")] && state.towerPrefs[String(baseId || "")].locked);
  }

  function l(shiftKey, state) {
    const shift = String(shiftKey || "").toLowerCase() === "shift2" ? "shift2" : "shift1";
    const captainIds = new Set(((state && state[shift]) || []).map(row => String(row?.captainId || "")).filter(Boolean));
    let total = 0;
    for (const player of Array.isArray(a.players) ? a.players : []) {
      if (!player || !player.id) continue;
      if (String(player.shift || player.shiftLabel || "both").toLowerCase() !== shift) continue;
      if (captainIds.has(String(player.id))) continue;
      total += 1;
    }
    return total;
  }

  function c(shiftKey) {
    const modal = document.getElementById("towerCalcModal");
    if (!modal) return false;
    const shift = String(shiftKey || "").toLowerCase() === "shift2" ? "shift2" : "shift1";
    const state = i(modal);
    try { window.calcUpdateShiftStatsUI?.(modal); } catch {}
    const rows = typeof window.calcGetShiftTowerCardsImpl === "function" ? window.calcGetShiftTowerCardsImpl(shift) : [];
    const openIndexes = [];
    for (let idx = 0; idx < 5; idx++) {
      const row = (state[shift] || [])[idx] || {};
      const captainId = String(row?.captainId || "");
      const baseId = String(rows?.[idx]?.baseId || "");
      if (captainId) {
        if (baseId && s(baseId)) row.helpers = 0;
        else openIndexes.push(idx);
      } else {
        row.helpers = 0;
      }
    }
    const targetPerTower = Math.max(1, Math.min(29, helperFillCount(state.helperFillMode)));
    if (!openIndexes.length) {
      try { localStorage.setItem("pns_tower_calc_state", JSON.stringify(state)); } catch {}
      try { window.renderTowerCalcModal?.(); } catch {}
      return true;
    }
    for (const idx of openIndexes) {
      (state[shift][idx] || {}).helpers = targetPerTower;
    }
    try { localStorage.setItem("pns_tower_calc_state", JSON.stringify(state)); } catch {}
    try { window.renderTowerCalcModal?.(); } catch {}
    return true;
  }

  function d() {
    const modal = document.getElementById("towerCalcModal");
    if (!modal) return false;
    const ignoreBoth = modal.querySelector("#towerCalcIgnoreBoth");
    const state = r();
    if (ignoreBoth) ignoreBoth.checked = !!state.ignoreBoth;
    try { localStorage.setItem("pns_tower_calc_state", JSON.stringify(state)); } catch {}
    c("shift1");
    c("shift2");
    try { window.computeTowerCalcResults?.(); } catch {}
    return true;
  }

  window.calcAutoDistributeHelpersForShiftImpl = c;
  window.calcAutoFitTowersStrictImpl = d;
})();
