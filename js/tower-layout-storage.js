/* Tower layout snapshot and march override storage */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;

  const { state } = PNS;
  const TOWERS_KEY = 'pns_layout_towers_snapshot_v1';
  const OVERRIDES_KEY = 'pns_layout_tower_march_overrides_v1';

  let persistTimer = 0;
  let lastSnapshotJson = '';

  function readJson(key, fallback) {
    try {
      return typeof PNS.safeReadJSON === 'function'
        ? PNS.safeReadJSON(key, fallback)
        : (JSON.parse(localStorage.getItem(key) || 'null') ?? fallback);
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      if (typeof PNS.safeWriteJSON === 'function') PNS.safeWriteJSON(key, value);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function readOverrides() {
    const value = readJson(OVERRIDES_KEY, {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function overrideKey(baseId, playerId, shift) {
    const activeShift = String(shift || state?.activeShift || 'shift1').toLowerCase();
    const normalizedShift = activeShift === 'all' ? 'shift1' : (activeShift === 'shift2' ? 'shift2' : 'shift1');
    return `${String(baseId || '')}::${normalizedShift}::${String(playerId || '')}`;
  }

  function hasAssignments(snapshot) {
    return Array.isArray(snapshot) && snapshot.some(item => item && (item.captainId || (Array.isArray(item.helperIds) && item.helperIds.length)));
  }

  function buildSnapshot() {
    return (state?.bases || []).map(base => ({
      id: String(base?.id || ''),
      captainId: base?.captainId || null,
      helperIds: Array.isArray(base?.helperIds) ? Array.from(new Set(base.helperIds.map(String))) : [],
      role: base?.role || null,
    }));
  }

  function saveTowersSnapshot(options) {
    if (typeof isPersistenceSuppressed === 'function' && isPersistenceSuppressed()) return false;
    if (state && state._skipTowerSnapshotSave) return false;

    const forceEmpty = !!options?.forceEmpty;
    const snapshot = buildSnapshot();
    if (!snapshot.length) return false;

    if (!forceEmpty) {
      const existing = readJson(TOWERS_KEY, null);
      if (!hasAssignments(snapshot) && hasAssignments(existing)) return false;
    }

    let json = '';
    try { json = JSON.stringify(snapshot); } catch { json = ''; }
    if (!json) return false;
    if (!forceEmpty && json === lastSnapshotJson) return false;

    lastSnapshotJson = json;
    try {
      if (typeof PNS.safeWriteJSON === 'function') PNS.safeWriteJSON(TOWERS_KEY, snapshot);
      else localStorage.setItem(TOWERS_KEY, json);
      return true;
    } catch {
      return false;
    }
  }

  function scheduleTowersSnapshotSave(delay = 120) {
    try { clearTimeout(persistTimer); } catch {}
    persistTimer = window.setTimeout(() => {
      persistTimer = 0;
      try { saveTowersSnapshot(); } catch {}
    }, Math.max(0, Number(delay) || 0));
    return true;
  }

  function readTowerSnapshot() {
    const value = readJson(TOWERS_KEY, null);
    return Array.isArray(value) ? value : null;
  }

  if (!PNS._towersSnapshotRenderWrapDone && typeof PNS.renderAll === 'function') {
    PNS._towersSnapshotRenderWrapDone = true;
    const originalRenderAll = PNS.renderAll;
    PNS.renderAll = function() {
      const result = originalRenderAll.apply(this, arguments);
      try { scheduleTowersSnapshotSave(180); } catch {}
      return result;
    };
  }

  if (!PNS._towersSnapshotEventBindDone) {
    PNS._towersSnapshotEventBindDone = true;

    document.addEventListener('pns:assignment-changed', () => {
      try { scheduleTowersSnapshotSave(60); } catch {}
    });

    const flush = () => {
      if (typeof isPersistenceSuppressed === 'function' && isPersistenceSuppressed()) return;
      try { PNS.saveAllPersistenceNow?.('flush'); } catch {}
      try { saveTowersSnapshot(); } catch {}
    };

    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      try {
        if (document.visibilityState === 'hidden') flush();
      } catch {}
    });
  }

  function saveAllPersistence(reason) {
    try { if (typeof PNS.savePlayersSnapshot === 'function') PNS.savePlayersSnapshot(state.players); } catch {}
    try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
    try { saveTowersSnapshot(); } catch {}
    try { if (typeof PNS.setImportStatus === 'function' && reason) PNS.setImportStatus(`Saved board state (${reason}).`, 'good'); } catch {}
    return true;
  }

  PNS.getTowerMarchOverride = function(baseId, playerId, shift) {
    if (!baseId || !playerId) return null;
    const overrides = readOverrides();
    const key = overrideKey(baseId, playerId, shift);
    if (!Object.prototype.hasOwnProperty.call(overrides, key)) return null;
    const value = Number(overrides[key]);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
  };

  PNS.setTowerMarchOverride = function(baseId, playerId, value, shift) {
    if (!baseId || !playerId) return false;
    const nextValue = Number(value);
    const overrides = readOverrides();
    const key = overrideKey(baseId, playerId, shift);
    if (Number.isFinite(nextValue) && nextValue >= 0) overrides[key] = Math.max(0, Math.floor(nextValue));
    else delete overrides[key];
    writeJson(OVERRIDES_KEY, overrides);
    return true;
  };

  PNS.clearTowerMarchOverride = function(baseId, playerId, shift) {
    if (!baseId || !playerId) return false;
    const overrides = readOverrides();
    delete overrides[overrideKey(baseId, playerId, shift)];
    writeJson(OVERRIDES_KEY, overrides);
    return true;
  };

  PNS.clearTowerMarchOverrides = function() {
    try { localStorage.removeItem(OVERRIDES_KEY); } catch {}
    return true;
  };

  PNS.saveTowersSnapshot = saveTowersSnapshot;
  PNS.scheduleTowersSnapshotSave = scheduleTowersSnapshotSave;
  PNS.saveAllPersistenceNow = saveAllPersistence;
  PNS.persistSessionStateSoon = function(delay = 80) {
    try { clearTimeout(persistTimer); } catch {}
    persistTimer = window.setTimeout(() => {
      persistTimer = 0;
      try { saveAllPersistence('auto'); } catch {}
    }, Math.max(0, Number(delay) || 0));
    return true;
  };

  PNS.restoreSessionStateNow = function(options = {}) {
    if (state?._sessionStateRestoreDone) {
      try { if (typeof PNS.applyShiftFilter === 'function') PNS.applyShiftFilter(state.activeShift || 'shift1'); } catch {}
      try { PNS.renderAll?.(); } catch {}
      try { PNS.refreshBaseCards?.(); } catch {}
      return false;
    }

    try { state._sessionStateRestoreDone = true; } catch {}

    let restored = false;
    const activeShift = state.activeShift || 'shift1';
    let hasShiftPlans = false;

    try {
      const parsed = JSON.parse(localStorage.getItem('pns_layout_shift_plans_store_v1') || '{}');
      hasShiftPlans = !!(parsed && typeof parsed === 'object' && !Array.isArray(parsed) && (
        Object.prototype.hasOwnProperty.call(parsed, 'shift1') || Object.prototype.hasOwnProperty.call(parsed, 'shift2')
      ));
    } catch {}

    if (hasShiftPlans) {
      try { PNS.hydrateShiftPlansFromStore?.(true); } catch {}
      try { if (typeof PNS.applyShiftFilter === 'function') PNS.applyShiftFilter(activeShift); } catch {}
      try { PNS.restoreBasesFromPlayerAssignments?.(); } catch {}
      try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
      restored = true;
    } else {
      try { if (typeof PNS.tryRestoreTowersSnapshot === 'function') restored = !!PNS.tryRestoreTowersSnapshot({ soft: !!options.soft }); } catch {}
      if (!restored) {
        try { restored = !!PNS.restoreBasesFromPlayerAssignments?.(); } catch {}
      }
      try { if (typeof PNS.applyShiftFilter === 'function') PNS.applyShiftFilter(activeShift); } catch {}
      try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
    }

    try { PNS.renderAll?.(); } catch {}
    try { PNS.calcSyncCaptainsFromTowersIntoCalculator?.({ keepHelpers: true, render: false }); } catch {}
    try { window.calcRenderInlineTowerSettings?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.calcUpdateShiftStatsUI?.(document.getElementById('towerCalcModal')); } catch {}
    try { PNS.refreshBaseCards?.(); } catch {}
    return restored;
  };

  PNS.tryRestoreTowersSnapshot = function(options) {
    const soft = !!options?.soft;
    if (!state?.bases?.length || !state?.playerById || !state.playerById.size) return false;

    const snapshot = readTowerSnapshot();
    if (!Array.isArray(snapshot) || !snapshot.length) return false;
    if (soft && (state.bases || []).some(base => base?.captainId || (Array.isArray(base?.helperIds) && base.helperIds.length))) return false;

    const snapshotById = new Map();
    snapshot.forEach(item => {
      const id = String(item?.id || '');
      if (!id) return;
      snapshotById.set(id, item || {});
      const currentId = typeof PNS.resolveCurrentBaseId === 'function' ? PNS.resolveCurrentBaseId(id) : '';
      if (currentId && !snapshotById.has(currentId)) snapshotById.set(currentId, item || {});
    });

    (state.players || []).forEach(player => {
      if (player) player.assignment = null;
    });

    (state.bases || []).forEach(base => {
      if (!base) return;
      base.captainId = null;
      base.helperIds = [];
      base.role = null;
      try { PNS.applyBaseRoleUI?.(base, null); } catch {}
    });

    for (const base of state.bases || []) {
      const snap = snapshotById.get(String(base.id || ''));
      if (!snap) continue;

      const captainId = snap.captainId && state.playerById.has(snap.captainId) ? snap.captainId : null;
      const helperIds = Array.isArray(snap.helperIds)
        ? snap.helperIds.filter(id => id && id !== captainId && state.playerById.has(id))
        : [];

      base.captainId = captainId;
      base.helperIds = Array.from(new Set(helperIds));
      base.role = snap.role || null;

      if (captainId) {
        const captain = state.playerById.get(captainId);
        if (captain) {
          captain.assignment = { baseId: base.id, kind: 'captain' };
          try { PNS.applyBaseRoleUI?.(base, captain.role || base.role || null); } catch {}
        }
      } else {
        try { PNS.applyBaseRoleUI?.(base, base.role || null); } catch {}
      }

      for (const helperId of base.helperIds) {
        const helper = state.playerById.get(helperId);
        if (helper) helper.assignment = { baseId: base.id, kind: 'helper' };
      }
    }

    try { lastSnapshotJson = JSON.stringify(snapshot); } catch {}
    return true;
  };

  PNS.clearTowersSnapshot = function() {
    try { localStorage.removeItem(TOWERS_KEY); } catch {}
    lastSnapshotJson = '';
    return true;
  };
})();
