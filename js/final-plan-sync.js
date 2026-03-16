/* Final plan tower-calc sync-from-towers helpers */
(function(){
  const e = window.PNS;
  if (!e) return;
  const t = e.ModalsShift = e.ModalsShift || {};
  const { state: a } = e;

  function i(key, fallback = "") {
    try { return typeof e.t === "function" ? e.t(key, fallback) : (fallback || key); }
    catch { return fallback || key; }
  }

  function r(role) {
    const v = String(role || "").toLowerCase();
    return v.includes("fight") ? "fighter" : v.includes("rid") ? "rider" : (v.includes("shoot") || v.includes("arch")) ? "shooter" : "";
  }

  function n() {
    try {
      if (typeof window.getCalcHydratedState === "function") return window.getCalcHydratedState() || {};
      if (typeof window.getCalcState === "function") return window.getCalcState() || {};
    } catch {}
    return a.towerCalc || {};
  }

  function o() {
    const ids = [];
    try {
      (t.getTowerCards?.() || []).forEach(card => {
        const id = String(card?.dataset?.baseId || card?.dataset?.baseid || "");
        if (id && !ids.includes(id)) ids.push(id);
      });
    } catch {}
    if (!ids.length) {
      for (const base of a.bases || []) {
        const id = String(base?.id || "");
        if (id && !ids.includes(id)) ids.push(id);
      }
    }
    return ids.slice(0, 5).map(id => a.baseById?.get?.(id) || { id, title: id });
  }

  function s(shiftKey) {
    try { t.saveCurrentShiftPlanSnapshot?.(); } catch {}
    try { a.shiftPlans = a.shiftPlans || {}; } catch {}
    const bases = a.shiftPlans?.[shiftKey]?.bases || {};
    return o().map((base, idx) => {
      const liveBase = a.baseById?.get?.(base?.id || "");
      const snap = bases?.[base?.id] || {};
      const active = String(a.activeShift || "") === String(shiftKey || "");
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
        title: String(base?.title || base?.id || `${i("turret", "Турель")} ${idx + 1}`),
        captainId,
        helperIds: helperIds.slice ? helperIds.slice() : [],
        helperCount: Array.isArray(helperIds) ? helperIds.length : 0,
        role,
      };
    });
  }

  function l(shiftKey, plan, index, rows) {
    const list = Array.isArray(rows) ? rows : s(shiftKey);
    const captainId = String(plan?.captain?.id || "");
    if (captainId) {
      const found = list.find(row => String(row?.captainId || "") === captainId);
      if (found) return found;
    }
    return list[Number(index) || 0] || null;
  }

  function c(opts = {}) {
    const calc = n();
    for (const shiftKey of ["shift1", "shift2"]) {
      const rows = Array.isArray(calc[shiftKey]) ? calc[shiftKey] : [];
      const towerRows = s(shiftKey);
      const nextRows = [];
      for (let idx = 0; idx < 5; idx++) {
        const tower = towerRows[idx] || {};
        const prev = rows[idx] || {};
        const captainId = String(tower.captainId || "");
        const player = captainId ? a.playerById?.get?.(captainId) || (a.players || []).find(p => String(p.id) === captainId) : null;
        const troop = r(player?.role || tower.role || prev.troop || "") || String(prev.troop || "fighter");
        const helpersFromTower = Math.max(0, Number(tower.helperCount || 0) || 0);
        const prevHelpers = Math.max(0, Number(prev.helpers ?? 15) || 15);
        nextRows.push({
          captainId,
          troop,
          helpers: opts.keepHelpers === false ? (helpersFromTower > 0 ? helpersFromTower : 15) : (helpersFromTower > 0 ? helpersFromTower : (prevHelpers || 15)),
        });
      }
      calc[shiftKey] = nextRows;
    }
    try { localStorage.setItem("pns_tower_calc_state", JSON.stringify(calc)); } catch {}
    if (opts.render !== false) {
      try { window.renderTowerCalcModal?.(); } catch {}
    }
    return true;
  }

  window.calcListTowerCalcBasesImpl = o;
  window.calcGetShiftTowerCardsImpl = s;
  window.calcFindShiftTowerCardImpl = l;
  window.calcSyncCaptainsFromTowersIntoCalculatorImpl = c;
})();
