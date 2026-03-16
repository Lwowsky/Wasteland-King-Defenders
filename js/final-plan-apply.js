/* Final plan tower-calc apply-to-towers helpers */
(function(){
  const e = window.PNS;
  if (!e) return;
  const t = e.ModalsShift = e.ModalsShift || {};
  const { state: a } = e;

  function i(key, fallback = "") {
    try { return typeof e.t === "function" ? e.t(key, fallback) : (fallback || key); }
    catch { return fallback || key; }
  }

  function l(shiftKey) {
    try { return typeof e.shiftLabel === "function" ? e.shiftLabel(shiftKey) : String(shiftKey || ""); }
    catch { return String(shiftKey || ""); }
  }

  function c() {
    try {
      if (typeof window.getCalcState === "function") return window.getCalcState() || {};
      if (typeof window.getCalcHydratedState === "function") return window.getCalcHydratedState() || {};
    } catch {}
    return a.towerCalc || {};
  }

  function m(baseId) {
    const state = c();
    return !!(state?.towerPrefs && state.towerPrefs[String(baseId || "")] && state.towerPrefs[String(baseId || "")].locked);
  }

  function y() {
    try { return typeof window.computeTowerCalcResults === "function" ? window.computeTowerCalcResults() : null; }
    catch { return null; }
  }

  function p() {
    try { return typeof window.calcListTowerCalcBasesImpl === "function" ? window.calcListTowerCalcBasesImpl() : []; }
    catch { return []; }
  }

  function h(shiftKey) {
    try { return typeof window.calcGetShiftTowerCardsImpl === "function" ? window.calcGetShiftTowerCardsImpl(shiftKey) : []; }
    catch { return []; }
  }

  function f(shiftKey, plan, index, rows) {
    try { return typeof window.calcFindShiftTowerCardImpl === "function" ? window.calcFindShiftTowerCardImpl(shiftKey, plan, index, rows) : null; }
    catch { return null; }
  }

  function g(opts = {}) {
    try { return typeof window.calcSyncCaptainsFromTowersIntoCalculatorImpl === "function" ? window.calcSyncCaptainsFromTowersIntoCalculatorImpl(opts) : false; }
    catch { return false; }
  }

  function b(modal) {
    try { window.__pnsRenderLiveFinalBoard?.(modal); } catch {}
  }

  function w() {
    const modal = document.getElementById("towerCalcModal");
    if (!modal) return false;
    const results = y();
    if (!results) return false;
    if (!p().length) {
      try { e.setImportStatus?.(i("calc_no_turrets_for_limits", "Не знайдено турелей для застосування лімітів."), "bad"); } catch {}
      return false;
    }

    let changed = 0;
    for (const shiftKey of ["shift1", "shift2"]) {
      const shiftResults = results[shiftKey];
      if (!shiftResults) continue;
      const rows = h(shiftKey);
      const seen = new Set();
      for (let idx = 0; idx < (shiftResults.towerPlans?.length || 0); idx++) {
        const plan = shiftResults.towerPlans?.[idx];
        const tower = f(shiftKey, plan, idx, rows);
        const baseId = String(tower?.baseId || "");
        if (!baseId || seen.has(baseId) || !plan?.captain || m(baseId)) continue;
        seen.add(baseId);
        const rule = plan.suggestedRule || { maxHelpers: Number(plan.helpersWanted || plan.helpersPlaced || 0) || 0, tierMinMarch: {} };
        const maxHelpers = Math.max(0, Number(plan.helpersWantedRaw ?? plan.helpersWanted ?? plan.helpersPlaced ?? rule.maxHelpers ?? 0) || 0);
        try {
          e.setBaseTowerRule?.(baseId, {
            maxHelpers,
            tierMinMarch: {
              T14: Number(rule.tierMinMarch?.T14 || 0) || 0,
              T13: Number(rule.tierMinMarch?.T13 || 0) || 0,
              T12: Number(rule.tierMinMarch?.T12 || 0) || 0,
              T11: Number(rule.tierMinMarch?.T11 || 0) || 0,
              T10: Number(rule.tierMinMarch?.T10 || 0) || 0,
              T9: Number(rule.tierMinMarch?.T9 || 0) || 0,
            },
          }, { shift: shiftKey, persist: true, rerender: false });
          changed += 1;
        } catch {}
      }
    }

    const activeShift = String(a.activeShift || "shift1");
    try {
      try { e.beginAssignmentBatch?.(); } catch {}
      for (const shiftKey of ["shift1", "shift2"]) {
        try { if (String(a.activeShift || "") !== shiftKey) t.applyShiftFilter?.(shiftKey); } catch {}
        try { e.applyBaseTowerRulesForActiveShift?.(); } catch {}
      }
    } catch {}
    try { if (String(a.activeShift || "") !== activeShift) t.applyShiftFilter?.(activeShift); } catch {}
    try { if (typeof e.renderAll === "function") e.renderAll(); } catch {}

    try {
      const state = c();
      state.mainTab = typeof window.calcApplyMainTabUI === "function" ? window.calcApplyMainTabUI(modal, "preview") : "preview";
      localStorage.setItem("pns_tower_calc_state", JSON.stringify(state));
    } catch {}

    const status = modal.querySelector("#towerCalcPreviewStatus") || modal.querySelector("#towerCalcGlobalOut");
    if (status) {
      status.textContent = i("calc_settings_applied_preview", "✅ Налаштування калькулятора застосовано до {count} налаштувань турелей.").replace(/\{count\}/g, String(changed));
    }
    try { e.setImportStatus?.(i("calc_settings_applied_status", "Налаштування калькулятора застосовано до турелей ({count}).").replace(/\{count\}/g, String(changed)), "good"); } catch {}
    b(modal);
    return true;
  }

  function S() {
    const modal = document.getElementById("towerCalcModal");
    if (!modal) return false;

    const results = (() => {
      let current = a.towerCalcLastResults || null;
      if ((current?.shift1?.towerPlans?.length || 0) + (current?.shift2?.towerPlans?.length || 0)) {
        try { current = y() || current; } catch {}
      } else {
        try { g({ keepHelpers: true }); } catch {}
        try { current = y(); } catch { current = null; }
      }
      if (!(Number(current?.shift1?.towerPlans?.length || 0) + Number(current?.shift2?.towerPlans?.length || 0))) {
        try {
          e.setImportStatus?.(
            i("calc_no_captains_in_turrets", "Калькулятор не знайшов капітанів у турелях. Спочатку постав капітанів у турелях або натисни «Підтягнути капітанів із турелей»."),
            "bad",
          );
        } catch {}
        return null;
      }
      return current;
    })();
    if (!results) return false;

    try { w(); } catch {}

    const activeShift = String(a.activeShift || "shift1");
    const state = c();
    const applyMode = ["topup", "empty", "rebalance"].includes(String(state?.uiApplyMode || "").toLowerCase())
      ? String(state.uiApplyMode).toLowerCase()
      : "topup";

    let helpersAssigned = 0;
    let captainsAssigned = 0;
    const warnings = [];

    try { t.saveCurrentShiftPlanSnapshot?.(); } catch {}
    const nativeAlert = window.alert;
    let suppressed = 0;
    try { window.alert = function(){ suppressed += 1; }; } catch {}

    try {
      for (const shiftKey of ["shift1", "shift2"]) {
        const shiftResults = results?.[shiftKey];
        if (!shiftResults) continue;
        try { if (String(a.activeShift || "") !== shiftKey) t.applyShiftFilter?.(shiftKey); } catch {}
        const rows = h(shiftKey);
        const seen = new Set();

        for (let idx = 0; idx < (shiftResults.towerPlans?.length || 0); idx++) {
          const plan = shiftResults.towerPlans?.[idx];
          if (!plan?.captain?.id) continue;
          const tower = f(shiftKey, plan, idx, rows);
          const baseId = String(tower?.baseId || "");
          if (!baseId || seen.has(baseId)) continue;
          seen.add(baseId);

          if (m(baseId)) {
            warnings.push(`${l(shiftKey)} ${tower?.title || baseId}: ${i("skipped_turret_locked", "турель заблокована (пропущено)")}`);
            continue;
          }

          let liveBase = a.baseById?.get?.(baseId);
          const existingHelpers = Array.isArray(liveBase?.helperIds) ? liveBase.helperIds.slice() : [];
          const hasCaptain = !!String(liveBase?.captainId || "");
          if (applyMode === "empty" && (hasCaptain || existingHelpers.length > 0)) {
            warnings.push(`${l(shiftKey)} ${tower?.title || baseId}: ${i("skipped_not_empty", "не порожня (пропущено)")}`);
            continue;
          }

          const rebalance = applyMode === "rebalance";
          if (rebalance) {
            try { e.clearBase?.(baseId, true); } catch {}
          }
          liveBase = a.baseById?.get?.(baseId);

          const existingCaptainId = String(liveBase?.captainId || "");
          if (!existingCaptainId || rebalance) {
            if (String(existingCaptainId) !== String(plan.captain.id || "")) {
              try {
                e.assignPlayerToBase?.(plan.captain.id, baseId, "captain");
                const assignment = a.playerById?.get?.(String(plan.captain.id || ""))?.assignment;
                if (assignment && String(assignment.baseId || "") === baseId && String(assignment.kind || "") === "captain") {
                  captainsAssigned += 1;
                } else {
                  warnings.push(`${l(shiftKey)} ${tower?.title || baseId}: ${i("captain_not_assigned", "капітан {name} (не призначено)").replace(/\{name\}/g, String(plan.captain?.name || plan.captain?.id || ""))}`);
                }
              } catch (err) {
                warnings.push(`${l(shiftKey)} ${tower?.title || baseId}: ${i("captain", "Капітан").toLowerCase()} ${plan.captain?.name || plan.captain?.id} (${err?.message || i("assignment_error", "помилка призначення")})`);
              }
            }
          } else if (String(existingCaptainId) !== String(plan.captain.id || "")) {
            warnings.push(`${l(shiftKey)} ${tower?.title || baseId}: ${i("captain_kept_mode", "капітан залишився (режим {mode})").replace(/\{mode\}/g, String(applyMode || ""))}`);
          }

          liveBase = a.baseById?.get?.(baseId);
          const assignedHelperIds = new Set((Array.isArray(liveBase?.helperIds) ? liveBase.helperIds : []).map(id => String(id || "")).filter(Boolean));
          let helperQuota = Infinity;
          if (applyMode === "topup") {
            helperQuota = Math.max(0, Math.max(0, Number(plan.helpersWantedRaw ?? plan.helpersWanted ?? 0) || 0) - assignedHelperIds.size);
          } else if (applyMode === "empty") {
            helperQuota = Math.max(0, Number(plan.helpersWantedRaw ?? plan.helpersWanted ?? 0) || 0);
          }

          for (const player of plan.pickedPlayers || []) {
            const playerId = String(player?.id || "");
            if (!playerId || playerId === String(plan.captain?.id || "") || assignedHelperIds.has(playerId)) continue;
            if (helperQuota <= 0) break;

            try {
              const assignedMarch = Math.max(0, Number(plan.assignedById?.[playerId] || 0) || 0);
              const fullMarch = Math.max(0, Number(player?.march || 0) || 0);
              if (assignedMarch > 0 && assignedMarch < fullMarch) e.setTowerMarchOverride?.(baseId, playerId, assignedMarch, shiftKey);
              else if (assignedMarch >= fullMarch) e.clearTowerMarchOverride?.(baseId, playerId, shiftKey);
            } catch {}

            try {
              e.assignPlayerToBase?.(playerId, baseId, "helper");
              const assignment = a.playerById?.get?.(playerId)?.assignment;
              if (assignment && String(assignment.baseId || "") === baseId && String(assignment.kind || "") === "helper") {
                helpersAssigned += 1;
                assignedHelperIds.add(playerId);
                if (helperQuota !== Infinity) helperQuota = Math.max(0, helperQuota - 1);
              } else {
                warnings.push(`${l(shiftKey)} ${tower?.title || baseId}: ${i("helper_not_assigned_or_limit", "помічник {name} (не призначено / перевищено ліміт)").replace(/\{name\}/g, String(player?.name || playerId || ""))}`);
              }
            } catch (err) {
              warnings.push(`${l(shiftKey)} ${tower?.title || baseId}: ${i("helper", "Помічник").toLowerCase()} ${player?.name || playerId} (${err?.message || i("assignment_error", "помилка призначення")})`);
            }
          }
        }

        try { t.saveCurrentShiftPlanSnapshot?.(); } catch {}
      }
    } finally {
      try { e.endAssignmentBatch?.({ flush: true, detail: { type: "tower-calc-apply" } }); } catch {}
      try { window.alert = nativeAlert; } catch {}
    }

    try { if (String(a.activeShift || "") !== activeShift) t.applyShiftFilter?.(activeShift); } catch {}
    try { if (typeof e.renderAll === "function") e.renderAll(); } catch {}
    try { t.syncSettingsTowerPreview?.(); } catch {}
    try { e.saveTowersSnapshot?.(); } catch {}
    try { e.savePlayersSnapshot?.(a.players); } catch {}

    const status = modal.querySelector("#towerCalcPreviewStatus") || modal.querySelector("#towerCalcGlobalOut");
    if (status) {
      status.textContent = `✅ ${i("moved_to_turrets", "Перенесено у турелі")}: ${i("captains_word", "капітанів")} ${captainsAssigned}, ${i("players_word", "гравців")} ${helpersAssigned}.` + (suppressed ? ` (${i("popups_suppressed", "приглушено popup-вікон")}: ${suppressed})` : "");
      const notFitSummary = [];
      try {
        for (const shiftKey of ["shift1", "shift2"]) {
          for (const plan of results?.[shiftKey]?.towerPlans || []) {
            const captainName = String(plan?.captain?.name || "—");
            const notFitPlayers = Array.isArray(plan?.notFitPlayers) ? plan.notFitPlayers : [];
            if (notFitPlayers.length) {
              notFitSummary.push(`${shiftKey} / ${captainName}: ` + notFitPlayers.slice(0, 5).map(player => `${player.name || "—"} (${player.tier || ""})`).join(", ") + (notFitPlayers.length > 5 ? ` … +${notFitPlayers.length - 5}` : ""));
            }
          }
        }
      } catch {}
      if (notFitSummary.length) status.textContent += ` · ${i("not_fit_plural", "Не влізли")}: ${notFitSummary.length}`;
      if (warnings.length) status.textContent += ` · ${i("warnings", "Попередження")}: ${warnings.length}`;
    }

    b(modal);
    return true;
  }

  window.applyTowerCalcToTowerSettingsImpl = w;
  window.applyTowerCalcAssignmentsToTowersImpl = S;
})();
