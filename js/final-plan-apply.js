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

  function q() {
    try {
      const settings = JSON.parse(localStorage.getItem("pns_import_region_shift_settings_v1") || "null") || {};
      const activeRegion = localStorage.getItem("pns_tower_calc_active_region_v1") || settings.activeRegion || "region1";
      const region = settings?.regions?.[activeRegion] || settings?.regions?.region1 || {};
      const shifts = region?.shifts || {};
      const selected = ["1", "2", "3", "4"].find(n => !!shifts[n]) || "2";
      const count = Math.max(1, Math.min(4, Number(selected) || 2));
      return Array.from({ length: count }, (_, idx) => `shift${idx + 1}`);
    } catch {
      return ["shift1", "shift2"];
    }
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
    for (const shiftKey of q()) {
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
      for (const shiftKey of q()) {
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
      let current = null;
      try { current = y(); } catch { current = null; }
      const shifts = q();
      const hasAny = (value) => shifts.some(shiftKey => Number(value?.[shiftKey]?.towerPlans?.length || 0) > 0);
      if (!hasAny(current)) {
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

    const activeShift = /^shift[1-4]$/.test(String(a.activeShift || "").toLowerCase())
      ? String(a.activeShift).toLowerCase()
      : "shift1";
    const shifts = q();

    const previousPlans = a.shiftPlans && typeof a.shiftPlans === "object" ? a.shiftPlans : {};
    const nextPlans = { ...previousPlans };

    // Авто-розподіл не має дублювати гравців між змінами.
    // Але якщо гравець/капітан вже був вручну поставлений у конкретну зміну/турель,
    // його треба дозволити повторити в іншій зміні.
    const manualAllowedByShift = {};
    const usedInThisApply = new Set();
    const warnings = [];

    function cloneSnapshot(snapshot) {
      const out = { players: {}, bases: {} };
      const players = snapshot?.players && typeof snapshot.players === "object" ? snapshot.players : {};
      Object.entries(players).forEach(([id, value]) => {
        if (id) out.players[id] = value ? { ...value } : null;
      });
      const bases = snapshot?.bases && typeof snapshot.bases === "object" ? snapshot.bases : {};
      Object.entries(bases).forEach(([id, value]) => {
        if (!id) return;
        out.bases[id] = {
          ...(value || {}),
          helperIds: Array.isArray(value?.helperIds) ? value.helperIds.slice() : [],
        };
      });
      return out;
    }

    function collectManualAllowed(shiftKey) {
      const allowed = new Set();
      try {
        const saved = previousPlans?.[shiftKey] || null;
        const players = saved?.players && typeof saved.players === "object" ? saved.players : {};
        Object.entries(players).forEach(([id, assignment]) => {
          if (id && assignment?.baseId) allowed.add(String(id));
        });
        const bases = saved?.bases && typeof saved.bases === "object" ? saved.bases : {};
        Object.values(bases).forEach(base => {
          const captainId = String(base?.captainId || "");
          if (captainId) allowed.add(captainId);
          (Array.isArray(base?.helperIds) ? base.helperIds : []).forEach(id => {
            if (id) allowed.add(String(id));
          });
        });
      } catch {}

      try {
        const calcRows = Array.isArray(a.towerCalc?.[shiftKey]) ? a.towerCalc[shiftKey] : [];
        calcRows.forEach(row => {
          const captainId = String(row?.captainId || "");
          if (captainId) allowed.add(captainId);
        });
      } catch {}

      return allowed;
    }

    shifts.forEach(shiftKey => {
      manualAllowedByShift[shiftKey] = collectManualAllowed(shiftKey);
    });

    function canUsePlayerInShift(playerId, shiftKey) {
      const id = String(playerId || "");
      if (!id) return false;
      if (!usedInThisApply.has(id)) return true;
      return !!manualAllowedByShift?.[shiftKey]?.has(id);
    }

    function markAutoUsed(playerId, shiftKey) {
      const id = String(playerId || "");
      if (!id) return;
      if (!manualAllowedByShift?.[shiftKey]?.has(id)) usedInThisApply.add(id);
    }

    let helpersAssigned = 0;
    let captainsAssigned = 0;

    function roleFromPlan(plan) {
      try {
        const raw = plan?.captain?.role || plan?.troop || "";
        const normalized = typeof e.normalizeRole === "function" ? e.normalizeRole(raw) : String(raw || "");
        return normalized || null;
      } catch {
        return plan?.troop || null;
      }
    }

    for (const shiftKey of shifts) {
      const shiftResults = results?.[shiftKey];
      if (!shiftResults) continue;

      const rows = h(shiftKey);
      const snapshot = { players: {}, bases: {} };
      const seenBases = new Set();

      for (let idx = 0; idx < (shiftResults.towerPlans?.length || 0); idx++) {
        const plan = shiftResults.towerPlans?.[idx];
        if (!plan?.captain?.id) continue;

        const tower = f(shiftKey, plan, idx, rows);
        const baseId = String(tower?.baseId || plan?.baseId || "");
        if (!baseId || seenBases.has(baseId)) continue;
        seenBases.add(baseId);

        if (m(baseId)) {
          warnings.push(`${l(shiftKey)} ${tower?.title || baseId}: ${i("skipped_turret_locked", "турель заблокована (пропущено)")}`);
          continue;
        }

        const captainId = String(plan.captain.id || "");
        if (!captainId || !canUsePlayerInShift(captainId, shiftKey)) {
          warnings.push(`${l(shiftKey)} ${tower?.title || baseId}: ${i("captain", "Капітан")} ${plan.captain?.name || captainId} (${i("duplicate_skipped", "дублікат пропущено")})`);
          continue;
        }

        const helperIds = [];
        const localIds = new Set([captainId]);

        for (const player of plan.pickedPlayers || []) {
          const playerId = String(player?.id || "");
          if (!playerId || playerId === captainId || localIds.has(playerId) || !canUsePlayerInShift(playerId, shiftKey)) continue;
          helperIds.push(playerId);
          localIds.add(playerId);

          try {
            const assignedMarch = Math.max(0, Number(plan.assignedById?.[playerId] || 0) || 0);
            const fullMarch = Math.max(0, Number(player?.march || 0) || 0);
            if (assignedMarch > 0 && assignedMarch < fullMarch) e.setTowerMarchOverride?.(baseId, playerId, assignedMarch, shiftKey);
            else if (assignedMarch >= fullMarch) e.clearTowerMarchOverride?.(baseId, playerId, shiftKey);
          } catch {}
        }

        snapshot.bases[baseId] = {
          captainId,
          helperIds,
          role: roleFromPlan(plan),
        };
        snapshot.players[captainId] = { baseId, kind: "captain" };
        helperIds.forEach(playerId => {
          snapshot.players[playerId] = { baseId, kind: "helper" };
        });

        markAutoUsed(captainId, shiftKey);
        helperIds.forEach(playerId => markAutoUsed(playerId, shiftKey));
        captainsAssigned += 1;
        helpersAssigned += helperIds.length;
      }

      nextPlans[shiftKey] = cloneSnapshot(snapshot);
    }

    a.shiftPlans = {
      shift1: nextPlans.shift1 || null,
      shift2: nextPlans.shift2 || null,
      shift3: nextPlans.shift3 || null,
      shift4: nextPlans.shift4 || null,
    };

    try {
      localStorage.setItem("pns_layout_shift_plans_store_v1", JSON.stringify(a.shiftPlans));
    } catch {}

    try {
      const regionKey = "pns_layout_region_shift_plans_store_v1";
      const settings = JSON.parse(localStorage.getItem("pns_import_region_shift_settings_v1") || "null") || {};
      const activeRegion = localStorage.getItem("pns_tower_calc_active_region_v1") || settings.activeRegion || "region1";
      const store = JSON.parse(localStorage.getItem(regionKey) || "{}") || {};
      store[activeRegion] = a.shiftPlans;
      localStorage.setItem(regionKey, JSON.stringify(store));
    } catch {}

    try {
      if (t.restoreShiftPlan) t.restoreShiftPlan(a.shiftPlans?.[activeShift] || null);
      else if (t.loadShiftPlanSnapshot) t.loadShiftPlanSnapshot(activeShift);
    } catch {}

    try { a.activeShift = activeShift; } catch {}
    try { if (typeof e.renderAll === "function") e.renderAll(); } catch {}
    try { t.syncSettingsTowerPreview?.(); } catch {}
    try { e.saveTowersSnapshot?.(); } catch {}
    try { e.savePlayersSnapshot?.(a.players); } catch {}
    try { e.persistSessionStateSoon?.(10); } catch {}

    const status = modal.querySelector("#towerCalcPreviewStatus") || modal.querySelector("#towerCalcGlobalOut");
    if (status) {
      status.textContent = `✅ ${i("moved_to_turrets", "Перенесено у турелі")}: ${i("captains_word", "капітанів")} ${captainsAssigned}, ${i("players_word", "гравців")} ${helpersAssigned}.`;
      if (warnings.length) status.textContent += ` · ${i("warnings", "Попередження")}: ${warnings.length}`;
    }

    try { b(modal); } catch {}
    try { window.__pnsRenderStandaloneFinalBoard?.(document.getElementById("board-modal")); } catch {}
    return true;
  }

  window.applyTowerCalcToTowerSettingsImpl = w;
  window.applyTowerCalcAssignmentsToTowersImpl = S;
})();
