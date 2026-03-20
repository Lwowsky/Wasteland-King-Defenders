(function(){
  'use strict';
  const PNS = window.PNS = window.PNS || {};
  const tr = (key, fallback='') => typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback;

  function clearShiftKeepCaptains(scope){
    const state = PNS.state;
    const shiftApi = PNS.ModalsShift || {};
    if (!state) return false;
    const targets = scope === 'all' ? ['shift1','shift2'] : [String(scope || state.activeShift || 'shift1')];
    const activeShift = String(state.activeShift || 'shift1');
    state.shiftPlans = state.shiftPlans || {};

    const sanitizePlan = (plan) => {
      const next = plan && typeof plan === 'object' ? plan : {};
      next.players = next.players && typeof next.players === 'object' ? next.players : {};
      next.bases = next.bases && typeof next.bases === 'object' ? next.bases : {};
      Object.keys(next.players).forEach((playerId) => {
        const row = next.players[playerId];
        if (row && row.kind !== 'captain') next.players[playerId] = null;
      });
      Object.keys(next.bases).forEach((baseId) => {
        const base = next.bases[baseId] && typeof next.bases[baseId] === 'object' ? next.bases[baseId] : (next.bases[baseId] = {});
        base.helperIds = [];
      });
      return next;
    };

    targets.forEach((shiftKey) => {
      const snapshot = state.shiftPlans[shiftKey] && typeof state.shiftPlans[shiftKey] === 'object'
        ? state.shiftPlans[shiftKey]
        : (typeof shiftApi.snapshotShiftPlan === 'function' ? shiftApi.snapshotShiftPlan() : { players:{}, bases:{} });
      state.shiftPlans[shiftKey] = sanitizePlan(snapshot);

      if (activeShift === shiftKey) {
        (Array.isArray(state.bases) ? state.bases : []).forEach((base) => {
          if (!base || !base.id) return;
          try { PNS.clearBaseAssignments?.(String(base.id), true); } catch {}
          base.helperIds = [];
        });
        (Array.isArray(state.players) ? state.players : []).forEach((player) => {
          if (player?.assignment?.kind && player.assignment.kind !== 'captain') {
            player.assignment = null;
          }
        });
        try { shiftApi.saveCurrentShiftPlanSnapshot?.(); } catch {}
      }
    });

    try {
      localStorage.setItem('pns_layout_shift_plans_store_v1', JSON.stringify({
        shift1: state.shiftPlans?.shift1 || null,
        shift2: state.shiftPlans?.shift2 || null,
      }));
    } catch {}

    try { PNS.savePlayersSnapshot?.(state.players); } catch {}
    try { PNS.saveTowersSnapshot?.(); } catch {}
    try { PNS.renderAll?.(); } catch {}
    try { window.computeTowerCalcResults?.(); } catch {}
    try { PNS.refreshShiftUi?.(); } catch {}
    try {
      const message = scope === 'all'
        ? tr('clear_helpers_both_done', 'Очищено зміни 1 і 2. Капітани залишилися.')
        : `${tr('clear_helpers_done_prefix', 'Очищено:')} ${scope === 'shift2' ? tr('shift2', 'Зміна 2') : tr('shift1', 'Зміна 1')}. ${tr('captains_stayed', 'Капітани залишилися.')}`;
      PNS.setImportStatus?.(message, 'good');
    } catch {}
    return true;
  }

  PNS.towerCalcClearShiftKeepCaptains = clearShiftKeepCaptains;

  document.addEventListener('click', (event) => {
    const menuItem = event.target.closest('#tcv35-clearMenu .tcv35-item');
    if (!menuItem) return;
    const items = Array.from(menuItem.parentElement?.querySelectorAll('.tcv35-item') || []);
    const index = items.indexOf(menuItem);
    if (index < 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const restoreBtn = document.getElementById('towerCalcRestoreImportShiftsBtn');
    if (index === 0) clearShiftKeepCaptains('shift1');
    else if (index === 1) clearShiftKeepCaptains('shift2');
    else if (index === 2) clearShiftKeepCaptains('all');
    else if (index === 3 && restoreBtn) {
      try { restoreBtn.click(); } catch {}
    }
    document.getElementById('tcv35-clearMenu')?.classList.remove('open');
  }, true);
})();
