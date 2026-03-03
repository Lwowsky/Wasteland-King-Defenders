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
    try { localStorage.setItem(key, value ? '1' : '0'); } catch {}
  }

  function safeReadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch { return fallback; }
  }
  function safeWriteJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  // ===== Base tower rules store =====
  function getEmptyTierMinMarch() { return { T14: 0, T13: 0, T12: 0, T11: 0, T10: 0, T9: 0 }; }

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
    safeWriteJSON(KEYS.KEY_BASE_TOWER_RULES, state.baseTowerRules || {});
  }
  function getBaseTowerRule(baseId) {
    return normalizeBaseTowerRule((state.baseTowerRules || {})[baseId] || {});
  }
  function setBaseTowerRule(baseId, rule, opts = {}) {
    const normalized = normalizeBaseTowerRule(rule);
    if (!state.baseTowerRules || typeof state.baseTowerRules !== 'object') state.baseTowerRules = {};
    state.baseTowerRules[baseId] = normalized;
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

  // ===== Field label overrides =====
  function loadFieldLabelOverrides() {
    const saved = safeReadJSON(KEYS.KEY_FIELD_LABEL_OVERRIDES, {});
    state.fieldLabelOverrides = saved && typeof saved === 'object' ? saved : {};
  }
  function saveFieldLabelOverrides() {
    safeWriteJSON(KEYS.KEY_FIELD_LABEL_OVERRIDES, state.fieldLabelOverrides || {});
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
    safeWriteJSON(KEYS.KEY_IMPORT_VISIBLE_COLUMNS, Array.from(new Set(state.visibleOptionalColumns || [])));
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
      shift,
      shiftLabel: typeof PNS.formatShiftLabelForCell === 'function' ? PNS.formatShiftLabelForCell(shift) : String(p.shiftLabel || ''),
      lairLevel: String(p.lairLevel || ''),
      secondaryRole: String(p.secondaryRole || ''),
      secondaryTier: String(p.secondaryTier || ''),
      troop200k: String(p.troop200k || ''),
      notes: String(p.notes || ''),
      raw: p.raw && typeof p.raw === 'object' ? p.raw : {},
      rowEl: null,
      actionCellEl: null,
      assignment: p.assignment || null,
      towerMarchOverride: (p.towerMarchOverride == null ? null : Number(p.towerMarchOverride)),
      towerMarchOverrideByBase: (p.towerMarchOverrideByBase && typeof p.towerMarchOverrideByBase === 'object')
        ? Object.fromEntries(Object.entries(p.towerMarchOverrideByBase)
            .map(([k,v]) => [String(k), Number(v)])
            .filter(([,v]) => Number.isFinite(v) && v > 0))
        : {},
    };
  }

  function savePlayersSnapshot(players) {
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


  // ===== Assignments/base snapshot (persist tower state across page refresh) =====
  function normalizeAssignmentsSnapshot(payload) {
    const src = payload && typeof payload === 'object' ? payload : {};
    const arr = Array.isArray(src.bases) ? src.bases : [];
    return {
      version: 1,
      bases: arr.map((b) => ({
        id: String(b?.id || ''),
        captainId: b?.captainId ? String(b.captainId) : null,
        helperIds: Array.isArray(b?.helperIds) ? b.helperIds.map((x) => String(x)).filter(Boolean) : [],
        role: b?.role ? String(b.role) : null,
      })).filter((b) => b.id),
    };
  }

  function buildAssignmentsSnapshot() {
    const bases = Array.isArray(state.bases) ? state.bases : [];
    return normalizeAssignmentsSnapshot({
      bases: bases.map((b) => ({
        id: b.id,
        captainId: b.captainId || null,
        helperIds: Array.isArray(b.helperIds) ? Array.from(new Set(b.helperIds.map(String))) : [],
        role: b.role || null,
      })),
    });
  }

  function saveAssignmentsSnapshot() {
    const payload = buildAssignmentsSnapshot();
    safeWriteJSON(KEYS.KEY_ASSIGNMENTS_STORE, payload);
    return true;
  }

  function loadAssignmentsSnapshot() {
    return normalizeAssignmentsSnapshot(safeReadJSON(KEYS.KEY_ASSIGNMENTS_STORE, { bases: [] }));
  }

  function clearAssignmentsSnapshot() {
    try { localStorage.removeItem(KEYS.KEY_ASSIGNMENTS_STORE); } catch {}
  }

  function restoreAssignmentsSnapshot(opts = {}) {
    if (!state?.bases?.length || !state?.baseById?.size || !state?.playerById?.size) return false;

    // Prefer dedicated assignments snapshot. Fallback to assignments embedded in players snapshot.
    const snap = loadAssignmentsSnapshot();
    let baseRows = Array.isArray(snap?.bases) ? snap.bases : [];
    if (!baseRows.length) {
      const byBase = new Map();
      (state.players || []).forEach((p) => {
        const a = p?.assignment;
        if (!a?.baseId || !a?.kind) return;
        const row = byBase.get(a.baseId) || { id: String(a.baseId), captainId: null, helperIds: [], role: null };
        if (a.kind === 'captain') row.captainId = String(p.id);
        else if (a.kind === 'helper') row.helperIds.push(String(p.id));
        byBase.set(row.id, row);
      });
      baseRows = Array.from(byBase.values());
    }

    // Clear current assignment links first
    (state.players || []).forEach((p) => { p.assignment = null; });
    (state.bases || []).forEach((b) => {
      b.captainId = null;
      b.helperIds = [];
      if (typeof PNS.applyBaseRoleUI === 'function') PNS.applyBaseRoleUI(b, null);
    });

    const usedPlayers = new Set();
    for (const row of baseRows) {
      const base = state.baseById.get(row.id);
      if (!base) continue;

      let captain = null;
      if (row.captainId && !usedPlayers.has(row.captainId)) {
        captain = state.playerById.get(row.captainId) || null;
      }

      if (captain) {
        base.captainId = captain.id;
        captain.assignment = { baseId: base.id, kind: 'captain' };
        usedPlayers.add(captain.id);
        if (typeof PNS.applyBaseRoleUI === 'function') PNS.applyBaseRoleUI(base, captain.role || row.role || null);
      } else {
        base.captainId = null;
        if (typeof PNS.applyBaseRoleUI === 'function') PNS.applyBaseRoleUI(base, null);
      }

      const nextHelpers = [];
      for (const pid of row.helperIds || []) {
        if (!pid || usedPlayers.has(pid)) continue;
        const p = state.playerById.get(pid);
        if (!p) continue;
        const baseRole = typeof PNS.getBaseRole === 'function' ? PNS.getBaseRole(base) : (captain?.role || null);
        if (baseRole && p.role && p.role !== baseRole) continue;
        nextHelpers.push(p.id);
        p.assignment = { baseId: base.id, kind: 'helper' };
        usedPlayers.add(p.id);
      }
      base.helperIds = nextHelpers;
    }

    if (opts.rerender !== false && typeof PNS.renderAll === 'function') PNS.renderAll();
    if (opts.applyShift !== false && typeof PNS.applyShiftFilter === 'function') {
      try { PNS.applyShiftFilter(state.activeShift || 'shift1'); } catch {}
    }
    return true;
  }

  function persistSessionState() {
    try {
      if (Array.isArray(state.players) && state.players.length) savePlayersSnapshot(state.players);
      if (Array.isArray(state.bases) && state.bases.length) saveAssignmentsSnapshot();
    } catch {}
  }

  // ===== Boot restore from localStorage (script-order safe) =====
  function restorePlayersOnlyFromSnapshot() {
    if (Array.isArray(state.players) && state.players.length) return true;
    const restored = loadPlayersSnapshot();
    if (!Array.isArray(restored) || !restored.length) return false;
    state.players = restored;
    state.playerById = new Map(restored.map((p) => [p.id, p]));
    return true;
  }

  function rerenderAfterRestore() {
    try { if (typeof PNS.renderPlayersTableFromState === 'function') PNS.renderPlayersTableFromState(); } catch {}
    try { if (typeof PNS.buildRowActions === 'function') PNS.buildRowActions(); } catch {}
    try { if (typeof PNS.renderAll === 'function') PNS.renderAll(); } catch {}
    try { if (typeof PNS.applyShiftFilter === 'function') PNS.applyShiftFilter(state.activeShift || 'shift1'); } catch {}
    try { if (typeof PNS.setImportLoadedInfo === 'function') PNS.setImportLoadedInfo(`Restored ${(state.players||[]).length} players from LocalStorage.`); } catch {}
    try { if (typeof PNS.setImportStatus === 'function') PNS.setImportStatus('Players restored from previous session. Load/apply a new table anytime to replace them.', 'good'); } catch {}
  }

  function tryRestoreSessionFromLocalStorage(opts = {}) {
    const hasPlayers = Array.isArray(state.players) && state.players.length;
    const restoredPlayers = hasPlayers ? true : restorePlayersOnlyFromSnapshot();
    if (!restoredPlayers) return false;

    try { if (typeof PNS.restoreAssignmentsSnapshot === 'function') PNS.restoreAssignmentsSnapshot({ rerender: false, applyShift: false }); } catch {}

    // Render only when UI functions are available; if not, caller may retry later.
    const readyToRender = typeof PNS.renderAll === 'function' || typeof PNS.renderPlayersTableFromState === 'function';
    if (readyToRender && opts.render !== false) rerenderAfterRestore();
    return true;
  }

  PNS.tryRestoreSessionFromLocalStorage = tryRestoreSessionFromLocalStorage;


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
    el.textContent = msg || 'No file loaded yet.';
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

  PNS.loadFieldLabelOverrides = loadFieldLabelOverrides;
  PNS.saveFieldLabelOverrides = saveFieldLabelOverrides;
  PNS.setFieldLabelOverride = setFieldLabelOverride;

  PNS.loadVisibleOptionalColumns = loadVisibleOptionalColumns;
  PNS.saveVisibleOptionalColumns = saveVisibleOptionalColumns;

  PNS.savePlayersSnapshot = savePlayersSnapshot;
  PNS.loadPlayersSnapshot = loadPlayersSnapshot;
  PNS.clearPlayersSnapshot = clearPlayersSnapshot;

  PNS.buildAssignmentsSnapshot = buildAssignmentsSnapshot;
  PNS.saveAssignmentsSnapshot = saveAssignmentsSnapshot;
  PNS.loadAssignmentsSnapshot = loadAssignmentsSnapshot;
  PNS.restoreAssignmentsSnapshot = restoreAssignmentsSnapshot;
  PNS.clearAssignmentsSnapshot = clearAssignmentsSnapshot;
  PNS.persistSessionState = persistSessionState;

  PNS.setImportStatus = setImportStatus;
  PNS.setImportLoadedInfo = setImportLoadedInfo;

  // Late bootstrap restore (covers cases when import/storage script order changed)
  if (!window.__pnsRestoreSessionBound) {
    window.__pnsRestoreSessionBound = true;
    const boot = () => { try { if (typeof PNS.tryRestoreSessionFromLocalStorage === 'function') PNS.tryRestoreSessionFromLocalStorage(); } catch {} };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else setTimeout(boot, 0);
    window.addEventListener('load', boot, { once: true });
    document.addEventListener('htmx:afterSwap', boot);
    document.addEventListener('htmx:afterSettle', boot);
    document.addEventListener('pns:partials:loaded', boot);
    document.addEventListener('pns:bases:parsed', boot);
  }


  // Persist runtime state on explicit assignment edits and before refresh/close
  if (!window.__pnsPersistStateBound) {
    window.__pnsPersistStateBound = true;
    document.addEventListener('pns:assignment-changed', () => { try { persistSessionState(); } catch {} });
    window.addEventListener('beforeunload', () => { try { persistSessionState(); } catch {} });
  }

})();