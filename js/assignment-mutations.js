/* Assignment mutations */
(function(){
  const e = window.PNS;
  if (!e) return;

  const { state } = e;

  function getEffectiveMarch(base, player) {
    if (!player) return 0;
    if (typeof e.getTowerEffectiveMarch === "function") {
      return Number(e.getTowerEffectiveMarch(base, player)) || 0;
    }
    return Number(player.march || 0) || 0;
  }

  function isBatchingAssignments() {
    return Number(state?._assignmentBatchDepth || 0) > 0;
  }

  function flushAssignmentBatch(detail = null) {
    const pendingDetail = detail || state?._assignmentBatchLastDetail || {};
    try { if (typeof e.renderAll === "function") e.renderAll(); } catch {}
    try { e.savePlayersSnapshot?.(state.players); } catch {}
    try { e.saveTowersSnapshot?.(); } catch {}
    try { e.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
    try { e.persistSessionStateSoon?.(10); } catch {}
    try { document.dispatchEvent(new CustomEvent("pns:assignment-changed", { detail: pendingDetail })); } catch {}
    try { state._assignmentBatchDirty = false; } catch {}
    try { state._assignmentBatchLastDetail = null; } catch {}
  }

  function persistAssignmentChange(detail = {}) {
    if (isBatchingAssignments()) {
      try { state._assignmentBatchDirty = true; } catch {}
      try { state._assignmentBatchLastDetail = detail; } catch {}
      return;
    }
    flushAssignmentBatch(detail);
  }

  function beginAssignmentBatch() {
    try {
      state._assignmentBatchDepth = Math.max(0, Number(state._assignmentBatchDepth || 0)) + 1;
    } catch {}
    return Number(state?._assignmentBatchDepth || 0);
  }

  function endAssignmentBatch(options = {}) {
    const flush = options?.flush !== false;
    let depth = 0;
    try {
      depth = Math.max(0, Number(state._assignmentBatchDepth || 0) - 1);
      state._assignmentBatchDepth = depth;
    } catch {}
    if (!depth && flush && state?._assignmentBatchDirty) {
      flushAssignmentBatch(options?.detail || state?._assignmentBatchLastDetail || {});
    }
    return depth;
  }

  function clearPlayerFromBase(playerId) {
    const player = state.playerById.get(playerId);
    if (!player || !player.assignment) return;

    const base = state.baseById.get(player.assignment.baseId);
    if (!base) {
      player.assignment = null;
      return;
    }

    if (player.assignment.kind === "captain" && base.captainId === player.id) {
      base.captainId = null;
      base.helperIds.forEach(helperId => {
        const helper = state.playerById.get(helperId);
        if (helper) helper.assignment = null;
      });
      base.helperIds = [];
      if (typeof e.applyBaseRoleUI === "function") e.applyBaseRoleUI(base, null);
    }

    if (player.assignment.kind === "helper") {
      base.helperIds = base.helperIds.filter(id => id !== player.id);
      try {
        if (player.towerMarchOverrideByBase && typeof player.towerMarchOverrideByBase === "object") {
          delete player.towerMarchOverrideByBase[base.id];
        }
        delete player.towerMarchOverride;
      } catch {}
    }

    player.assignment = null;
  }

  function assignPlayerToBaseCore(playerId, baseId, kind) {
    const player = state.playerById.get(playerId);
    const base = state.baseById.get(baseId);
    if (!player || !base) return;

    const error = e.validateAssignCore?.(player, base, kind) || "";
    if (error) {
      e.setRowStatus?.(player, error, "danger");
      alert(error);
      return;
    }

    clearPlayerFromBase(player.id);

    if (kind === "captain") {
      const previousRole = typeof e.getBaseRole === "function" ? e.getBaseRole(base) : null;
      if (base.captainId && base.captainId !== player.id) {
        const previousCaptain = state.playerById.get(base.captainId);
        if (previousCaptain) previousCaptain.assignment = null;
      }

      base.captainId = player.id;
      player.assignment = { baseId: base.id, kind: "captain" };

      try {
        if (player.towerMarchOverrideByBase && typeof player.towerMarchOverrideByBase === "object") {
          delete player.towerMarchOverrideByBase[base.id];
        }
        delete player.towerMarchOverride;
      } catch {}

      if (typeof e.applyBaseRoleUI === "function") e.applyBaseRoleUI(base, player.role);

      if (previousRole && previousRole !== player.role) {
        base.helperIds.forEach(helperId => {
          const helper = state.playerById.get(helperId);
          if (helper) helper.assignment = null;
        });
        base.helperIds = [];
      }

      const rallyLimit = player.rally || player.march || 0;
      let usedMarch = 0;
      const keptHelpers = [];
      for (const helperId of base.helperIds) {
        const helper = state.playerById.get(helperId);
        if (!helper) continue;
        if (helper.role !== player.role) {
          helper.assignment = null;
          continue;
        }
        const helperMarch = getEffectiveMarch(base, helper);
        if (usedMarch + helperMarch + (player.march || 0) <= rallyLimit) {
          usedMarch += helperMarch;
          keptHelpers.push(helperId);
        } else {
          helper.assignment = null;
        }
      }
      base.helperIds = keptHelpers;
    } else {
      if (!base.helperIds.includes(player.id)) base.helperIds.push(player.id);
      player.assignment = { baseId: base.id, kind: "helper" };
    }

    if (!isBatchingAssignments()) {
      try { if (typeof e.renderAll === "function") e.renderAll(); } catch {}
    }
    persistAssignmentChange({ type: "assign", baseId: base.id, playerId: player.id, kind });
  }

  function clearBase(baseId, helpersOnly = false) {
    const base = state.baseById.get(baseId);
    if (!base) return;

    if (!helpersOnly && base.captainId) {
      const captain = state.playerById.get(base.captainId);
      if (captain) captain.assignment = null;
      base.captainId = null;
      if (typeof e.applyBaseRoleUI === "function") e.applyBaseRoleUI(base, null);
    }

    base.helperIds.forEach(helperId => {
      const helper = state.playerById.get(helperId);
      if (!helper) return;
      helper.assignment = null;
      try {
        if (helper.towerMarchOverrideByBase && typeof helper.towerMarchOverrideByBase === "object") {
          delete helper.towerMarchOverrideByBase[base.id];
        }
        delete helper.towerMarchOverride;
      } catch {}
    });
    base.helperIds = [];

    if (!isBatchingAssignments()) {
      try { if (typeof e.renderAll === "function") e.renderAll(); } catch {}
    }
    persistAssignmentChange({ type: "clear-base", baseId: base.id, helpersOnly: !!helpersOnly });
  }

  function removePlayerFromSpecificBase(baseId, playerId) {
    const base = state.baseById.get(baseId);
    const player = state.playerById.get(playerId);
    if (!base || !player) return false;

    if (base.captainId === player.id) {
      clearBase(baseId, false);
      return true;
    }

    if (!base.helperIds.includes(player.id)) return false;

    base.helperIds = base.helperIds.filter(id => id !== player.id);
    try {
      if (player.towerMarchOverrideByBase && typeof player.towerMarchOverrideByBase === "object") {
        delete player.towerMarchOverrideByBase[base.id];
      }
      delete player.towerMarchOverride;
    } catch {}
    player.assignment = null;

    if (!isBatchingAssignments()) {
      try { if (typeof e.renderAll === "function") e.renderAll(); } catch {}
    }
    persistAssignmentChange({ type: "remove", baseId, playerId });
    return true;
  }

  e.clearPlayerFromBase = clearPlayerFromBase;
  e.assignPlayerToBaseCore = assignPlayerToBaseCore;
  e.assignPlayerToBase = assignPlayerToBaseCore;
  e.clearBase = clearBase;
  e.removePlayerFromSpecificBase = removePlayerFromSpecificBase;
  e.beginAssignmentBatch = beginAssignmentBatch;
  e.endAssignmentBatch = endAssignmentBatch;
  e.flushAssignmentBatch = flushAssignmentBatch;
}());
