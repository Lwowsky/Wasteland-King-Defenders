/* Final plan tower-calc sync-from-towers helpers */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;
  const modals = PNS.ModalsShift = PNS.ModalsShift || {};
  const { state } = PNS;

  let lastCalcStateJson = null;

  function tr(key, fallback = "") {
    try { return typeof PNS.t === "function" ? PNS.t(key, fallback) : (fallback || key); }
    catch { return fallback || key; }
  }

  function roleToTroop(role) {
    const v = String(role || "").toLowerCase();
    return v.includes("fight") ? "fighter" : v.includes("rid") ? "rider" : (v.includes("shoot") || v.includes("arch")) ? "shooter" : "";
  }

  function getCalcState() {
    try {
      if (typeof window.getCalcHydratedState === "function") return window.getCalcHydratedState() || {};
      if (typeof window.getCalcState === "function") return window.getCalcState() || {};
    } catch {}
    return state.towerCalc || {};
  }

  function persistCalcState(calc) {
    try {
      const json = JSON.stringify(calc || {});
      if (json === lastCalcStateJson) return false;
      localStorage.setItem("pns_tower_calc_state", json);
      lastCalcStateJson = json;
      return true;
    } catch {
      return false;
    }
  }

  function listTowerCalcBases() {
    const ids = [];
    const seen = new Set();
    try {
      (modals.getTowerCards?.() || []).forEach(card => {
        const id = String(card?.dataset?.baseId || card?.dataset?.baseid || "");
        if (id && !seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      });
    } catch {}
    if (!ids.length) {
      for (const base of state.bases || []) {
        const id = String(base?.id || "");
        if (id && !seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      }
    }
    return ids.slice(0, 5).map(id => state.baseById?.get?.(id) || { id, title: id });
  }

  function getShiftPlansSnapshot() {
    try { modals.saveCurrentShiftPlanSnapshot?.(); } catch {}
    try { state.shiftPlans = state.shiftPlans || {}; } catch {}
    return state.shiftPlans || {};
  }

  function getShiftTowerCards(shiftKey) {
    const bases = (state.shiftPlans?.[shiftKey]?.bases) || {};
    return listTowerCalcBases().map((base, idx) => {
      const liveBase = state.baseById?.get?.(base?.id || "");
      const snap = bases?.[base?.id] || {};
      const active = String(state.activeShift || "") === String(shiftKey || "");
      const captainId = String((snap.captainId ?? (active ? liveBase?.captainId : null)) || "");
      const helperIds = Array.isArray(snap.helperIds)
        ? snap.helperIds
        : active && Array.isArray(liveBase?.helperIds)
          ? liveBase.helperIds
          : [];
      const role = snap.role || (active ? liveBase?.role : null) || base?.role || null;
      return {
        index: idx,
        baseId: String(base?.id || ""),
        title: String(base?.title || base?.id || `${tr("turret", "Турель")} ${idx + 1}`),
        captainId,
        helperIds: helperIds.slice ? helperIds.slice() : [],
        helperCount: Array.isArray(helperIds) ? helperIds.length : 0,
        role,
      };
    });
  }

  function findShiftTowerCard(shiftKey, plan, index, rows) {
    const list = Array.isArray(rows) ? rows : getShiftTowerCards(shiftKey);
    const captainId = String(plan?.captain?.id || "");
    if (captainId) {
      const found = list.find(row => String(row?.captainId || "") === captainId);
      if (found) return found;
    }
    return list[Number(index) || 0] || null;
  }

  function rowsEqual(left, right) {
    const a = Array.isArray(left) ? left : [];
    const b = Array.isArray(right) ? right : [];
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const x = a[i] || {};
      const y = b[i] || {};
      if (
        String(x.captainId || "") !== String(y.captainId || "") ||
        String(x.troop || "fighter") !== String(y.troop || "fighter") ||
        Math.max(0, Number(x.helpers ?? 15) || 15) !== Math.max(0, Number(y.helpers ?? 15) || 15)
      ) {
        return false;
      }
    }
    return true;
  }

  function syncCaptainsFromTowersIntoCalculator(opts = {}) {
    const calc = getCalcState();
    getShiftPlansSnapshot();
    let changed = false;

    for (const shiftKey of ["shift1", "shift2"]) {
      const prevRows = Array.isArray(calc[shiftKey]) ? calc[shiftKey] : [];
      const towerRows = getShiftTowerCards(shiftKey);
      const nextRows = [];

      for (let idx = 0; idx < 5; idx++) {
        const tower = towerRows[idx] || {};
        const prev = prevRows[idx] || {};
        const captainId = String(tower.captainId || "");
        const player = captainId
          ? state.playerById?.get?.(captainId) || (state.players || []).find(p => String(p.id) === captainId)
          : null;
        const troop = roleToTroop(player?.role || tower.role || prev.troop || "") || String(prev.troop || "fighter");
        const helpersFromTower = Math.max(0, Number(tower.helperCount || 0) || 0);
        const prevHelpers = Math.max(0, Number(prev.helpers ?? 15) || 15);
        nextRows.push({
          captainId,
          troop,
          helpers: opts.keepHelpers === false
            ? (helpersFromTower > 0 ? helpersFromTower : 15)
            : (helpersFromTower > 0 ? helpersFromTower : (prevHelpers || 15)),
        });
      }

      if (!rowsEqual(prevRows, nextRows)) {
        calc[shiftKey] = nextRows;
        changed = true;
      }
    }

    if (changed) persistCalcState(calc);
    if (opts.render !== false) {
      try { window.renderTowerCalcModal?.(); } catch {}
    }
    return true;
  }

  window.calcListTowerCalcBasesImpl = listTowerCalcBases;
  window.calcGetShiftTowerCardsImpl = getShiftTowerCards;
  window.calcFindShiftTowerCardImpl = findShiftTowerCard;
  window.calcSyncCaptainsFromTowersIntoCalculatorImpl = syncCaptainsFromTowersIntoCalculator;
})();
