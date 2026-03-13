(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state, KEYS } = PNS;

  // ===== swap-safe DOM helpers =====
  function elAlive(el) {
    return !!(el && el.nodeType === 1 && document.contains(el));
  }

  function resolveControl(id, keyName) {
    // Try cached first
    const cached = PNS.controls?.[keyName];
    if (elAlive(cached)) return cached;

    // Re-query by id
    const fresh = document.getElementById(id);
    if (!PNS.controls) PNS.controls = {};
    PNS.controls[keyName] = fresh || null;
    return fresh || null;
  }

  // ===== Safe storage =====
  function safeReadBool(key, fallback = false) {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return fallback;
      return value === '1';
    } catch { return fallback; }
  }
  function safeWriteBool(key, value) {
    try { if (isPersistenceSuppressed()) return; localStorage.setItem(key, value ? '1' : '0'); } catch {}
  }

  function safeReadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch { return fallback; }
  }
  function safeWriteJSON(key, value) {
    try { if (isPersistenceSuppressed()) return; localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function isPersistenceSuppressed() {
    try { return !!(window.__PNS_FACTORY_RESET_ACTIVE || state?._suppressPersistence); } catch { return false; }
  }

  function setPersistenceSuppressed(flag) {
    try { state._suppressPersistence = !!flag; } catch {}
    try {
      if (flag) window.__PNS_FACTORY_RESET_ACTIVE = true;
      else delete window.__PNS_FACTORY_RESET_ACTIVE;
    } catch {}
    return !!flag;
  }

  // ===== Base tower rules store =====
  function getEmptyTierMinMarch() { return { T14: 0, T13: 0, T12: 0, T11: 0, T10: 0, T9: 0 }; }

  function normalizeTowerRuleShift(shift) {
    const s = String(shift || state?.activeShift || 'shift1').toLowerCase();
    if (s === 'all') return 'shift1';
    return s === 'shift2' ? 'shift2' : 'shift1';
  }
  function getBaseTowerRuleStoreKey(baseId, shift) {
    return `${normalizeTowerRuleShift(shift)}::${String(baseId || '')}`;
  }

  function normalizeBaseTowerRule(rule) {
    const src = rule || {};
    const tier = src.tierMinMarch || src.tierMin || {};
    return {
      maxHelpers: PNS.clampInt(src.maxHelpers, 29),
      tierMinMarch: {
        T14: PNS.clampInt(tier.T14, 0),
        T13: PNS.clampInt(tier.T13, 0),
        T12: PNS.clampInt(tier.T12, 0),
        T11: PNS.clampInt(tier.T11, 0),
        T10: PNS.clampInt(tier.T10, 0),
        T9:  PNS.clampInt(tier.T9, 0),
      }
    };
  }

  function loadBaseTowerRulesStore() {
    state.baseTowerRules = safeReadJSON(KEYS.KEY_BASE_TOWER_RULES, {}) || {};
    if (typeof state.baseTowerRules !== 'object' || Array.isArray(state.baseTowerRules)) state.baseTowerRules = {};
  }
  function saveBaseTowerRulesStore() {
    if (isPersistenceSuppressed()) return false;
    safeWriteJSON(KEYS.KEY_BASE_TOWER_RULES, state.baseTowerRules || {});
    return true;
  }
  function getBaseTowerRule(baseId, opts = {}) {
    const store = (state.baseTowerRules && typeof state.baseTowerRules === 'object') ? state.baseTowerRules : {};
    const shift = normalizeTowerRuleShift(opts.shift);
    const scopedKey = getBaseTowerRuleStoreKey(baseId, shift);

    // New format (shift-scoped): "shift1::baseId" / "shift2::baseId"
    if (Object.prototype.hasOwnProperty.call(store, scopedKey)) {
      return normalizeBaseTowerRule(store[scopedKey] || {});
    }

    // Backward compatibility with old format (shared per-base only)
    if (Object.prototype.hasOwnProperty.call(store, baseId)) {
      return normalizeBaseTowerRule(store[baseId] || {});
    }

    return normalizeBaseTowerRule({});
  }
  function setBaseTowerRule(baseId, rule, opts = {}) {
    const normalized = normalizeBaseTowerRule(rule);
    if (!state.baseTowerRules || typeof state.baseTowerRules !== 'object') state.baseTowerRules = {};

    const scopedKey = getBaseTowerRuleStoreKey(baseId, opts.shift);
    state.baseTowerRules[scopedKey] = normalized;

    // Optional migration cleanup: stop writing shared legacy key after first save.
    if (opts.deleteLegacy !== false && Object.prototype.hasOwnProperty.call(state.baseTowerRules, baseId)) {
      delete state.baseTowerRules[baseId];
    }

    if (opts.persist !== false) saveBaseTowerRulesStore();

    const base = state.baseById?.get(baseId);
    if (base) {
      base.maxHelpers = normalized.maxHelpers;
      base.tierMinMarch = { ...normalized.tierMinMarch };
      base.quotas = {}; // v4.1: quotas disabled, use per-tier min march instead
      if (typeof PNS.renderQuotaRow === 'function') PNS.renderQuotaRow(base);
      if (typeof PNS.syncBaseEditorSettingsInputs === 'function') PNS.syncBaseEditorSettingsInputs(base);
      if (opts.rerender && typeof PNS.renderAll === 'function') PNS.renderAll();
    }
    return normalized;
  }

  function applyBaseTowerRulesForActiveShift() {
    if (!Array.isArray(state.bases) || !state.bases.length) return false;
    (state.bases || []).forEach((base) => {
      if (!base?.id) return;
      const rule = getBaseTowerRule(base.id);
      base.maxHelpers = Number(rule.maxHelpers || 29) || 29;
      base.tierMinMarch = { ...(rule.tierMinMarch || getEmptyTierMinMarch()) };
      base.quotas = {};
      try { PNS.syncBaseEditorSettingsInputs?.(base); } catch {}
      try { PNS.renderQuotaRow?.(base); } catch {}
    });
    return true;
  }

  // ===== Field label overrides =====
  function loadFieldLabelOverrides() {
    const saved = safeReadJSON(KEYS.KEY_FIELD_LABEL_OVERRIDES, {});
    state.fieldLabelOverrides = saved && typeof saved === 'object' ? saved : {};
  }
  function saveFieldLabelOverrides() {
    if (isPersistenceSuppressed()) return false;
    safeWriteJSON(KEYS.KEY_FIELD_LABEL_OVERRIDES, state.fieldLabelOverrides || {});
    return true;
  }
  function setFieldLabelOverride(key, value) {
    if (!state.fieldLabelOverrides || typeof state.fieldLabelOverrides !== 'object') state.fieldLabelOverrides = {};
    const raw = String(value || '').trim();
    const def = typeof PNS.getFieldDefByKey === 'function' ? PNS.getFieldDefByKey(key) : null;
    if (!raw || (def && raw === def.label)) delete state.fieldLabelOverrides[key];
    else state.fieldLabelOverrides[key] = raw;
    saveFieldLabelOverrides();
  }

  // ===== Visible optional columns =====
  function loadVisibleOptionalColumns() {
    const saved = safeReadJSON(KEYS.KEY_IMPORT_VISIBLE_COLUMNS, null);
    state.visibleOptionalColumns = Array.isArray(saved)
      ? saved.filter(Boolean)
      : (typeof PNS.getDefaultVisibleOptionalColumns === 'function'
        ? PNS.getDefaultVisibleOptionalColumns()
        : []);
  }
  function saveVisibleOptionalColumns() {
    if (isPersistenceSuppressed()) return false;
    safeWriteJSON(KEYS.KEY_IMPORT_VISIBLE_COLUMNS, Array.from(new Set(state.visibleOptionalColumns || [])));
    return true;
  }

  // ===== Players snapshot (persist imported players across page refresh) =====
  const KEY_PLAYERS_SNAPSHOT = 'pns_layout_players_snapshot_v1';

  function normalizePlayerSnapshotItem(src, idx) {
    const p = src || {};
    const shift = p.shift || 'both';
    const tierText = p.tier || '';
    return {
      id: String(p.id || `p${idx+1}`),
      name: String(p.name || ''),
      playerExternalId: String(p.playerExternalId || ''),
      alliance: String(p.alliance || ''),
      role: String(p.role || ''),
      tier: String(tierText || ''),
      tierRank: Number.isFinite(p.tierRank) ? p.tierRank : (typeof PNS.tierRank === 'function' ? PNS.tierRank(tierText) : 0),
      march: Number(p.march || 0),
      rally: Number(p.rally || 0),
      captainReady: !!p.captainReady,
      registeredShiftRaw: String(p.registeredShiftRaw || ''),
      registeredShift: String(p.registeredShift || shift || 'both'),
      registeredShiftLabel: String(
        p.registeredShiftLabel ||
        (typeof PNS.formatShiftLabelForCell === 'function' ? PNS.formatShiftLabelForCell(String(p.registeredShift || shift || 'both')) : String(p.shiftLabel || ''))
      ),
      shift,
      shiftLabel: typeof PNS.formatShiftLabelForCell === 'function' ? PNS.formatShiftLabelForCell(shift) : String(p.shiftLabel || ''),
      lairLevel: String(p.lairLevel || ''),
      secondaryRole: String(p.secondaryRole || ''),
      secondaryTier: String(p.secondaryTier || ''),
      troop200k: String(p.troop200k || ''),
      notes: String(p.notes || ''),
      customFields: p.customFields && typeof p.customFields === 'object' ? { ...p.customFields } : {},
      customFieldLabels: p.customFieldLabels && typeof p.customFieldLabels === 'object' ? { ...p.customFieldLabels } : {},
      raw: p.raw && typeof p.raw === 'object' ? p.raw : {},
      rowEl: null,
      actionCellEl: null,
      assignment: (p.assignment && p.assignment.baseId) ? { ...p.assignment, baseId: (typeof PNS.resolveCurrentBaseId === 'function' ? (PNS.resolveCurrentBaseId(p.assignment.baseId) || p.assignment.baseId) : p.assignment.baseId) } : (p.assignment || null),
    };
  }

  function savePlayersSnapshot(players) {
    if (isPersistenceSuppressed()) return false;
    const arr = Array.isArray(players) ? players : state.players;
    if (!Array.isArray(arr) || !arr.length) return false;
    const payload = arr.map((p, i) => normalizePlayerSnapshotItem(p, i));
    safeWriteJSON(KEY_PLAYERS_SNAPSHOT, payload);
    return true;
  }

  function loadPlayersSnapshot() {
    const raw = safeReadJSON(KEY_PLAYERS_SNAPSHOT, null);
    if (!Array.isArray(raw) || !raw.length) return null;
    return raw.map((p, i) => normalizePlayerSnapshotItem(p, i));
  }

  function clearPlayersSnapshot() {
    try { localStorage.removeItem(KEY_PLAYERS_SNAPSHOT); } catch {}
  }

  function restoreBasesFromPlayerAssignments() {
    if (!Array.isArray(state?.bases) || !state.bases.length) return false;
    if (!Array.isArray(state?.players) || !state.players.length) return false;

    const baseMap = state.baseById instanceof Map && state.baseById.size
      ? state.baseById
      : new Map((state.bases || []).map((b) => [String(b?.id || ''), b]));
    state.baseById = baseMap;

    (state.bases || []).forEach((b) => {
      if (!b) return;
      b.captainId = null;
      b.helperIds = [];
      b.role = null;
      try { PNS.applyBaseRoleUI?.(b, null); } catch {}
    });

    let restoredAny = false;
    (state.players || []).forEach((player) => {
      if (!player?.assignment?.baseId) return;
      const resolvedBaseId = (typeof PNS.resolveCurrentBaseId === 'function' ? (PNS.resolveCurrentBaseId(String(player.assignment.baseId || '')) || String(player.assignment.baseId || '')) : String(player.assignment.baseId || ''));
      const base = baseMap.get(resolvedBaseId);
      if (!base) return;
      const pid = String(player.id || '');
      if (!pid) return;
      restoredAny = true;
      player.assignment.baseId = resolvedBaseId;
      if (player.assignment.kind === 'captain') {
        base.captainId = pid;
        base.role = player.role || base.role || null;
        try { PNS.applyBaseRoleUI?.(base, player.role || null); } catch {}
      } else {
        if (!Array.isArray(base.helperIds)) base.helperIds = [];
        if (!base.helperIds.includes(pid)) base.helperIds.push(pid);
      }
    });

    (state.bases || []).forEach((b) => {
      if (!b) return;
      if (!Array.isArray(b.helperIds)) b.helperIds = [];
      b.helperIds = Array.from(new Set(b.helperIds.filter(Boolean)));
      if (b.captainId && !b.role) {
        const captain = state.playerById?.get?.(b.captainId);
        if (captain?.role) b.role = captain.role;
      }
      try { PNS.applyBaseRoleUI?.(b, b.role || null); } catch {}
    });

    return restoredAny;
  }

  // ===== Status helpers (swap-safe) =====
  function setImportStatus(msg, tone) {
    const el = resolveControl('importStatusInfo', 'importStatusInfo');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = tone === 'danger'
      ? 'var(--danger)'
      : tone === 'good'
        ? 'var(--good)'
        : '';
  }

  function setImportLoadedInfo(msg) {
    const el = resolveControl('importLoadedInfo', 'importLoadedInfo');
    if (!el) return;
    el.textContent = msg || ((typeof PNS?.t === 'function' ? PNS.t('file_not_loaded', 'Файл або посилання ще не завантажено.') : 'Файл або посилання ще не завантажено.'));
  }

  // expose
  PNS.safeReadBool = safeReadBool;
  PNS.safeWriteBool = safeWriteBool;
  PNS.safeReadJSON = safeReadJSON;
  PNS.safeWriteJSON = safeWriteJSON;

  PNS.getEmptyTierMinMarch = getEmptyTierMinMarch;
  PNS.normalizeBaseTowerRule = normalizeBaseTowerRule;
  PNS.loadBaseTowerRulesStore = loadBaseTowerRulesStore;
  PNS.saveBaseTowerRulesStore = saveBaseTowerRulesStore;
  PNS.getBaseTowerRule = getBaseTowerRule;
  PNS.setBaseTowerRule = setBaseTowerRule;
  PNS.applyBaseTowerRulesForActiveShift = applyBaseTowerRulesForActiveShift;

  PNS.loadFieldLabelOverrides = loadFieldLabelOverrides;
  PNS.saveFieldLabelOverrides = saveFieldLabelOverrides;
  PNS.setFieldLabelOverride = setFieldLabelOverride;

  PNS.loadVisibleOptionalColumns = loadVisibleOptionalColumns;
  PNS.saveVisibleOptionalColumns = saveVisibleOptionalColumns;
  PNS.isPersistenceSuppressed = isPersistenceSuppressed;
  PNS.setPersistenceSuppressed = setPersistenceSuppressed;

  PNS.savePlayersSnapshot = savePlayersSnapshot;
  PNS.loadPlayersSnapshot = loadPlayersSnapshot;
  PNS.clearPlayersSnapshot = clearPlayersSnapshot;
  PNS.restoreBasesFromPlayerAssignments = restoreBasesFromPlayerAssignments;

  PNS.setImportStatus = setImportStatus;
  PNS.setImportLoadedInfo = setImportLoadedInfo;

})();

(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state } = PNS;

  // ==== Towers snapshot + per-tower/shift march overrides (additive patch) ====
  const KEY_TOWERS_SNAPSHOT = 'pns_layout_towers_snapshot_v1';
  const KEY_TOWER_MARCH_OVERRIDES = 'pns_layout_tower_march_overrides_v1';

  function _safeReadJSON(key, fallback) {
    try { return typeof PNS.safeReadJSON === 'function' ? PNS.safeReadJSON(key, fallback) : JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  }
  function _safeWriteJSON(key, value) {
    try {
      if (typeof PNS.safeWriteJSON === 'function') PNS.safeWriteJSON(key, value);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function _normShift(shift) {
    const s = String(shift || state?.activeShift || 'shift1').toLowerCase();
    if (s === 'all') return 'shift1'; // stable bucket for UI edit calls
    return (s === 'shift2') ? 'shift2' : 'shift1';
  }

  function _ovStore() {
    const src = _safeReadJSON(KEY_TOWER_MARCH_OVERRIDES, {});
    return (src && typeof src === 'object' && !Array.isArray(src)) ? src : {};
  }
  function _ovKey(baseId, playerId, shift) {
    return `${String(baseId||'')}::${_normShift(shift)}::${String(playerId||'')}`;
  }

  function getTowerMarchOverride(baseId, playerId, shift) {
    if (!baseId || !playerId) return null;
    const store = _ovStore();
    const v = Number(store[_ovKey(baseId, playerId, shift)]);
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  function setTowerMarchOverride(baseId, playerId, march, shift) {
    if (!baseId || !playerId) return false;
    const v = Number(march || 0);
    const store = _ovStore();
    const key = _ovKey(baseId, playerId, shift);
    if (!(Number.isFinite(v) && v > 0)) delete store[key];
    else store[key] = Math.max(0, Math.floor(v));
    _safeWriteJSON(KEY_TOWER_MARCH_OVERRIDES, store);
    return true;
  }
  function clearTowerMarchOverride(baseId, playerId, shift) {
    if (!baseId || !playerId) return false;
    const store = _ovStore();
    delete store[_ovKey(baseId, playerId, shift)];
    _safeWriteJSON(KEY_TOWER_MARCH_OVERRIDES, store);
    return true;
  }
  function clearTowerMarchOverrides() {
    try { localStorage.removeItem(KEY_TOWER_MARCH_OVERRIDES); } catch {}
    return true;
  }

  function _snapshotHasAssignments(payload) {
    return Array.isArray(payload) && payload.some(b => b && (b.captainId || (Array.isArray(b.helperIds) && b.helperIds.length)));
  }
  function _currentTowersPayload() {
    return (state.bases || []).map((b) => ({
      id: String(b.id || ''),
      captainId: b.captainId || null,
      helperIds: Array.isArray(b.helperIds) ? Array.from(new Set(b.helperIds.map(String))) : [],
      role: b.role || null
    }));
  }

  function saveTowersSnapshot(opts) {
    if (isPersistenceSuppressed()) return false;
    if (state && state._skipTowerSnapshotSave) return false;
    const forceEmpty = !!(opts && opts.forceEmpty);
    const payload = _currentTowersPayload();
    if (!payload.length) return false;

    // Guard: don't overwrite non-empty snapshot with an early empty render on page boot.
    if (!forceEmpty && !_snapshotHasAssignments(payload)) {
      const existing = _safeReadJSON(KEY_TOWERS_SNAPSHOT, null);
      if (_snapshotHasAssignments(existing)) return false;
    }

    _safeWriteJSON(KEY_TOWERS_SNAPSHOT, payload);
    return true;
  }

  function loadTowersSnapshot() {
    const raw = _safeReadJSON(KEY_TOWERS_SNAPSHOT, null);
    return Array.isArray(raw) ? raw : null;
  }

  function clearTowersSnapshot() {
    try { localStorage.removeItem(KEY_TOWERS_SNAPSHOT); } catch {}
    return true;
  }

  function tryRestoreTowersSnapshot(opts) {
    const soft = !!(opts && opts.soft);
    if (!state?.bases?.length || !state?.playerById || !state.playerById.size) return false;

    const raw = loadTowersSnapshot();
    if (!Array.isArray(raw) || !raw.length) return false;

    // If soft and there is already visible assignment, skip re-applying.
    if (soft) {
      const hasLiveAssignments = (state.bases || []).some(b => b?.captainId || (Array.isArray(b?.helperIds) && b.helperIds.length));
      if (hasLiveAssignments) return false;
    }

    const byId = new Map();
    raw.forEach((x) => {
      const rawId = String(x?.id || '');
      if (!rawId) return;
      byId.set(rawId, x || {});
      const resolved = typeof PNS.resolveCurrentBaseId === 'function' ? PNS.resolveCurrentBaseId(rawId) : '';
      if (resolved && !byId.has(resolved)) byId.set(resolved, x || {});
    });

    // clear current assignments first
    (state.players || []).forEach((p) => { if (p) p.assignment = null; });
    (state.bases || []).forEach((b) => {
      if (!b) return;
      b.captainId = null;
      b.helperIds = [];
      b.role = null;
      try { PNS.applyBaseRoleUI?.(b, null); } catch {}
    });

    for (const base of (state.bases || [])) {
      const snap = byId.get(String(base.id || ''));
      if (!snap) continue;

      const captainId = snap.captainId && state.playerById.has(snap.captainId) ? snap.captainId : null;
      const helperIds = Array.isArray(snap.helperIds)
        ? snap.helperIds.filter((id) => id && id !== captainId && state.playerById.has(id))
        : [];

      base.captainId = captainId;
      base.helperIds = Array.from(new Set(helperIds));
      base.role = snap.role || null;

      if (captainId) {
        const cp = state.playerById.get(captainId);
        if (cp) {
          cp.assignment = { baseId: base.id, kind: 'captain' };
          try { PNS.applyBaseRoleUI?.(base, cp.role || base.role || null); } catch {}
        }
      } else {
        try { PNS.applyBaseRoleUI?.(base, base.role || null); } catch {}
      }

      for (const hid of base.helperIds) {
        const hp = state.playerById.get(hid);
        if (hp) hp.assignment = { baseId: base.id, kind: 'helper' };
      }
    }
    return true;
  }

  // Wrap renderAll once: autosave towers snapshot after changes, but stay safe during restore/import.
  if (!PNS._towersSnapshotRenderWrapDone && typeof PNS.renderAll === 'function') {
    PNS._towersSnapshotRenderWrapDone = true;
    const _origRenderAll = PNS.renderAll;
    PNS.renderAll = function patchedRenderAll() {
      const out = _origRenderAll.apply(this, arguments);
      try { saveTowersSnapshot(); } catch {}
      return out;
    };
  }

  // lightweight autosave on assignment changes / unload
  if (!PNS._towersSnapshotEventBindDone) {
    PNS._towersSnapshotEventBindDone = true;
    document.addEventListener('pns:assignment-changed', () => { try { saveTowersSnapshot(); } catch {} });
    const flushPersistenceNow = () => {
      if (isPersistenceSuppressed()) return;
      try { PNS.saveAllPersistenceNow?.('flush'); } catch {}
      try { saveTowersSnapshot(); } catch {}
    };
    window.addEventListener('beforeunload', flushPersistenceNow);
    window.addEventListener('pagehide', flushPersistenceNow);
    document.addEventListener('visibilitychange', () => {
      try { if (document.visibilityState === 'hidden') flushPersistenceNow(); } catch {}
    });
  }

  function saveAllPersistenceNow(reason) {
    try { if (typeof PNS.savePlayersSnapshot === 'function') PNS.savePlayersSnapshot(state.players); } catch {}
    try { if (PNS.ModalsShift?.saveCurrentShiftPlanSnapshot) PNS.ModalsShift.saveCurrentShiftPlanSnapshot(); } catch {}
    try { saveTowersSnapshot(); } catch {}
    try { if (typeof PNS.setImportStatus === 'function' && reason) PNS.setImportStatus(`Saved board state (${reason}).`, 'good'); } catch {}
    return true;
  }

  let __persistTimer = 0;
  function persistSessionStateSoon(delay = 40) {
    try { clearTimeout(__persistTimer); } catch {}
    __persistTimer = setTimeout(() => {
      __persistTimer = 0;
      try { saveAllPersistenceNow('auto'); } catch {}
    }, Math.max(0, Number(delay) || 0));
    return true;
  }

  function restoreSessionStateNow(opts = {}) {
    // Run full session restore only once per page load.
    // A second forced restore after init can smear one live tower snapshot across shifts on hard reload.
    if (state?._sessionStateRestoreDone) {
      try { if (typeof PNS.applyShiftFilter === 'function') PNS.applyShiftFilter(state.activeShift || 'shift1'); } catch {}
      try { PNS.renderAll?.(); } catch {}
      try { PNS.refreshBaseCards?.(); } catch {}
      return false;
    }
    try { state._sessionStateRestoreDone = true; } catch {}

    let restored = false;
    const targetShift = state.activeShift || 'shift1';

    // If a real per-shift store exists, it is the source of truth.
    // Do not re-apply the generic towers snapshot on top of it.
    let hasShiftPlansStore = false;
    try {
      const raw = JSON.parse(localStorage.getItem('pns_layout_shift_plans_store_v1') || '{}');
      hasShiftPlansStore = !!(raw && typeof raw === 'object' && !Array.isArray(raw)
        && (Object.prototype.hasOwnProperty.call(raw, 'shift1') || Object.prototype.hasOwnProperty.call(raw, 'shift2')));
    } catch {}

    if (hasShiftPlansStore) {
      try { PNS.hydrateShiftPlansFromStore?.(true); } catch {}
      try { if (typeof PNS.applyShiftFilter === 'function') PNS.applyShiftFilter(targetShift); } catch {}
      restored = true;
    } else {
      try {
        if (typeof PNS.tryRestoreTowersSnapshot === 'function') {
          restored = !!PNS.tryRestoreTowersSnapshot({ soft: !!opts.soft });
        }
      } catch {}
      if (!restored) {
        try { restored = !!PNS.restoreBasesFromPlayerAssignments?.(); } catch {}
      }
      try { if (typeof PNS.applyShiftFilter === 'function') PNS.applyShiftFilter(targetShift); } catch {}
      try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
    }

    try { PNS.renderAll?.(); } catch {}
    try { PNS.calcSyncCaptainsFromTowersIntoCalculator?.({ keepHelpers: true, render: false }); } catch {}
    try { window.calcRenderInlineTowerSettings?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.calcUpdateShiftStatsUI?.(document.getElementById('towerCalcModal')); } catch {}
    try { PNS.refreshBaseCards?.(); } catch {}
    return restored;
  }

  // expose additive API
  PNS.getTowerMarchOverride = getTowerMarchOverride;
  PNS.setTowerMarchOverride = setTowerMarchOverride;
  PNS.clearTowerMarchOverride = clearTowerMarchOverride;
  PNS.clearTowerMarchOverrides = clearTowerMarchOverrides;

  PNS.saveTowersSnapshot = saveTowersSnapshot;
  PNS.loadTowersSnapshot = loadTowersSnapshot;
  PNS.saveAllPersistenceNow = saveAllPersistenceNow;
  PNS.persistSessionStateSoon = persistSessionStateSoon;
  PNS.restoreSessionStateNow = restoreSessionStateNow;
  PNS.tryRestoreTowersSnapshot = tryRestoreTowersSnapshot;
  PNS.clearTowersSnapshot = clearTowersSnapshot;
})();
