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


  function _normalizeRuleShift(shift) {
    const s = String(shift || state.activeShift || '').toLowerCase();
    return (s === 'shift1' || s === 'shift2') ? s : 'both';
  }
  function _ruleStoreKey(baseId, shift) {
    return `${String(baseId || '')}::${_normalizeRuleShift(shift)}`;
  }
  function _applyRuleToBaseState(base, normalized, opts = {}) {
    if (!base || !normalized) return;
    base.maxHelpers = normalized.maxHelpers;
    base.tierMinMarch = { ...normalized.tierMinMarch };
    base.quotas = {};
    if (typeof PNS.renderQuotaRow === 'function') PNS.renderQuotaRow(base);
    if (typeof PNS.syncBaseEditorSettingsInputs === 'function') PNS.syncBaseEditorSettingsInputs(base);
    if (opts.rerender && typeof PNS.renderAll === 'function') PNS.renderAll();
  }

  function loadBaseTowerRulesStore() {
    state.baseTowerRules = safeReadJSON(KEYS.KEY_BASE_TOWER_RULES, {}) || {};
    if (typeof state.baseTowerRules !== 'object' || Array.isArray(state.baseTowerRules)) state.baseTowerRules = {};
  }
  function saveBaseTowerRulesStore() {
    safeWriteJSON(KEYS.KEY_BASE_TOWER_RULES, state.baseTowerRules || {});
  }
  function getBaseTowerRule(baseId, shift) {
    const store = (state.baseTowerRules && typeof state.baseTowerRules === 'object') ? state.baseTowerRules : {};
    const scopedKey = _ruleStoreKey(baseId, shift);
    const legacy = store[String(baseId || '')];
    return normalizeBaseTowerRule(store[scopedKey] || legacy || {});
  }
  function setBaseTowerRule(baseId, rule, opts = {}) {
    const normalized = normalizeBaseTowerRule(rule);
    if (!state.baseTowerRules || typeof state.baseTowerRules !== 'object') state.baseTowerRules = {};
    const scopedKey = _ruleStoreKey(baseId, opts.shift);
    state.baseTowerRules[scopedKey] = normalized;
    if (opts.persist !== false) saveBaseTowerRulesStore();

    const base = state.baseById?.get(baseId);
    if (base) _applyRuleToBaseState(base, normalized, opts);
    return normalized;
  }

  function applyBaseTowerRulesForActiveShift(opts = {}) {
    if (!Array.isArray(state.bases)) return;
    (state.bases || []).forEach((base) => {
      const rule = getBaseTowerRule(base.id, opts.shift);
      _applyRuleToBaseState(base, rule, { rerender: false });
    });
    if (opts.rerender && typeof PNS.renderAll === 'function') PNS.renderAll();
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

  
  // ===== Players + towers snapshots (persist across page refresh) =====
  const KEY_PLAYERS_SNAPSHOT = 'pns_layout_players_snapshot_v1';
  const KEY_TOWERS_SNAPSHOT = 'pns_layout_towers_snapshot_v2';
  const KEY_TOWER_MARCH_OVERRIDES = 'pns_layout_tower_march_overrides_v1';

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

  // ---- Manual march override per tower + shift ----
  function _normalizeOverrideStore(raw) {
    const out = { shift1: {}, shift2: {} };
    const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    ['shift1','shift2'].forEach((shift) => {
      const byBase = src[shift];
      if (!byBase || typeof byBase !== 'object' || Array.isArray(byBase)) return;
      Object.entries(byBase).forEach(([baseId, byPlayer]) => {
        if (!byPlayer || typeof byPlayer !== 'object' || Array.isArray(byPlayer)) return;
        const cleanPlayers = {};
        Object.entries(byPlayer).forEach(([playerId, v]) => {
          const n = Number(v);
          if (Number.isFinite(n) && n > 0) cleanPlayers[String(playerId)] = Math.round(n);
        });
        if (Object.keys(cleanPlayers).length) out[shift][String(baseId)] = cleanPlayers;
      });
    });
    return out;
  }

  function loadTowerMarchOverridesStore() {
    state.towerMarchOverrides = _normalizeOverrideStore(safeReadJSON(KEY_TOWER_MARCH_OVERRIDES, {}));
    return state.towerMarchOverrides;
  }
  function saveTowerMarchOverridesStore() {
    if (!state.towerMarchOverrides) loadTowerMarchOverridesStore();
    safeWriteJSON(KEY_TOWER_MARCH_OVERRIDES, _normalizeOverrideStore(state.towerMarchOverrides));
  }
  function _overrideShiftKey(shift) { return _normalizeRuleShift(shift); }
  function getTowerMarchOverride(baseId, playerId, shift) {
    if (!baseId || !playerId) return null;
    if (!state.towerMarchOverrides) loadTowerMarchOverridesStore();
    const s = _overrideShiftKey(shift);
    const v = state.towerMarchOverrides?.[s]?.[String(baseId)]?.[String(playerId)];
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function setTowerMarchOverride(baseId, playerId, march, shift) {
    if (!baseId || !playerId) return null;
    if (!state.towerMarchOverrides) loadTowerMarchOverridesStore();
    const s = _overrideShiftKey(shift);
    const n = Math.round(Number(march || 0));
    state.towerMarchOverrides[s] ||= {};
    if (!state.towerMarchOverrides[s][String(baseId)]) state.towerMarchOverrides[s][String(baseId)] = {};
    if (!(n > 0)) delete state.towerMarchOverrides[s][String(baseId)][String(playerId)];
    else state.towerMarchOverrides[s][String(baseId)][String(playerId)] = n;

    if (!Object.keys(state.towerMarchOverrides[s][String(baseId)] || {}).length) delete state.towerMarchOverrides[s][String(baseId)];
    saveTowerMarchOverridesStore();
    return n > 0 ? n : null;
  }
  function clearTowerMarchOverride(baseId, playerId, shift) {
    if (!state.towerMarchOverrides) loadTowerMarchOverridesStore();
    const s = _overrideShiftKey(shift);
    if (baseId && playerId) {
      try { delete state.towerMarchOverrides[s]?.[String(baseId)]?.[String(playerId)]; } catch {}
      if (state.towerMarchOverrides[s]?.[String(baseId)] && !Object.keys(state.towerMarchOverrides[s][String(baseId)]).length) {
        delete state.towerMarchOverrides[s][String(baseId)];
      }
    } else if (baseId) {
      try { delete state.towerMarchOverrides[s]?.[String(baseId)]; } catch {}
    }
    saveTowerMarchOverridesStore();
  }
  function clearTowerMarchOverrides() {
    state.towerMarchOverrides = { shift1: {}, shift2: {} };
    try { localStorage.removeItem(KEY_TOWER_MARCH_OVERRIDES); } catch {}
  }

  // ---- Towers / shift plans snapshot ----
  function _cloneAssignment(a) { return a ? { baseId: String(a.baseId || ''), kind: String(a.kind || '') } : null; }
  function _snapshotCurrentShiftPlan() {
    const players = {};
    (state.players || []).forEach((p) => { if (p?.id) players[p.id] = _cloneAssignment(p.assignment); });
    const bases = {};
    (state.bases || []).forEach((b) => {
      if (!b?.id) return;
      bases[b.id] = {
        captainId: b.captainId ? String(b.captainId) : null,
        helperIds: Array.isArray(b.helperIds) ? Array.from(new Set(b.helperIds.filter(Boolean).map(String))) : [],
        role: b.role == null ? null : String(b.role || '')
      };
    });
    return { players, bases };
  }
  function _normalizeShiftPlan(plan) {
    const src = (plan && typeof plan === 'object') ? plan : {};
    const out = { players: {}, bases: {} };
    const pmap = (src.players && typeof src.players === 'object') ? src.players : {};
    Object.entries(pmap).forEach(([pid, a]) => { out.players[String(pid)] = _cloneAssignment(a); });
    const bmap = (src.bases && typeof src.bases === 'object') ? src.bases : {};
    Object.entries(bmap).forEach(([bid, b]) => {
      out.bases[String(bid)] = {
        captainId: b?.captainId ? String(b.captainId) : null,
        helperIds: Array.isArray(b?.helperIds) ? Array.from(new Set(b.helperIds.filter(Boolean).map(String))) : [],
        role: b?.role == null ? null : String(b.role || '')
      };
    });
    return out;
  }
  function saveTowersSnapshot() {
    if (state._skipTowerSnapshotSave) return false;
    if (!Array.isArray(state.bases) || !state.bases.length) return false;
    if (!Array.isArray(state.players) || !state.players.length) return false;

    // If shift-plan helpers exist, snapshot current active shift before saving
    try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}

    const plans = {};
    const srcPlans = (state.shiftPlans && typeof state.shiftPlans === 'object') ? state.shiftPlans : {};
    ['shift1','shift2'].forEach((s) => {
      if (srcPlans[s]) plans[s] = _normalizeShiftPlan(srcPlans[s]);
    });
    const cur = _normalizeRuleShift(state.activeShift);
    if (cur === 'shift1' || cur === 'shift2') plans[cur] = _snapshotCurrentShiftPlan();

    safeWriteJSON(KEY_TOWERS_SNAPSHOT, {
      v: 2,
      activeShift: _normalizeRuleShift(state.activeShift),
      shiftPlans: plans
    });
    return true;
  }
  function loadTowersSnapshot() {
    const raw = safeReadJSON(KEY_TOWERS_SNAPSHOT, null);
    if (!raw) return null;
    if (Array.isArray(raw)) {
      // legacy array-of-bases snapshot
      return { v: 1, bases: raw };
    }
    return raw;
  }
  function clearTowersSnapshot() {
    try { localStorage.removeItem(KEY_TOWERS_SNAPSHOT); } catch {}
    if (state && state.shiftPlans) state.shiftPlans = {};
  }

  function _restoreCurrentStateFromPlan(plan) {
    const normalized = _normalizeShiftPlan(plan);
    (state.players || []).forEach((p) => { if (p) p.assignment = _cloneAssignment(normalized.players[p.id] || null); });
    (state.bases || []).forEach((b) => {
      if (!b) return;
      const s = normalized.bases[b.id] || {};
      b.captainId = s.captainId || null;
      b.helperIds = Array.isArray(s.helperIds) ? s.helperIds.filter((id) => !!state.playerById?.get?.(id)) : [];
      const captain = b.captainId ? state.playerById?.get?.(b.captainId) : null;
      b.role = captain?.role || s.role || null;
      try { PNS.applyBaseRoleUI?.(b, b.role); } catch {}
    });
  }

  function tryRestoreTowersSnapshot() {
    if (!Array.isArray(state.players) || !state.players.length) return false;
    if (!Array.isArray(state.bases) || !state.bases.length) return false;
    if (!state.playerById || typeof state.playerById.get !== 'function') return false;

    const snap = loadTowersSnapshot();
    if (!snap) return false;

    // Legacy support (single current-plan array)
    if (snap.v === 1 && Array.isArray(snap.bases)) {
      // reset
      (state.players || []).forEach((p) => { if (p) p.assignment = null; });
      (state.bases || []).forEach((b) => { if (b) { b.captainId = null; b.helperIds = []; b.role = null; try { PNS.applyBaseRoleUI?.(b, null); } catch {} } });
      let restoredAny = false;
      snap.bases.forEach((item) => {
        const base = state.baseById?.get?.(String(item?.id || '')); if (!base) return;
        const captain = item?.captainId ? state.playerById.get(String(item.captainId)) : null;
        base.captainId = captain ? captain.id : null;
        if (captain) captain.assignment = { baseId: base.id, kind: 'captain' };
        base.helperIds = [];
        (Array.isArray(item?.helperIds) ? item.helperIds : []).forEach((pid) => {
          const p = state.playerById.get(String(pid)); if (!p || p.id === base.captainId) return;
          p.assignment = { baseId: base.id, kind: 'helper' }; base.helperIds.push(p.id); restoredAny = true;
        });
        base.role = captain?.role || item?.role || null;
        try { PNS.applyBaseRoleUI?.(base, base.role); } catch {}
        if (base.captainId) restoredAny = true;
      });
      applyBaseTowerRulesForActiveShift({ rerender: false });
      return restoredAny;
    }

    const plans = (snap.shiftPlans && typeof snap.shiftPlans === 'object') ? snap.shiftPlans : {};
    state.shiftPlans = state.shiftPlans || {};
    ['shift1','shift2'].forEach((s) => {
      if (plans[s]) state.shiftPlans[s] = _normalizeShiftPlan(plans[s]);
    });

    const cur = _normalizeRuleShift(state.activeShift);
    const plan = state.shiftPlans[cur] || null;
    if (plan) _restoreCurrentStateFromPlan(plan);
    else {
      (state.players || []).forEach((p) => { if (p) p.assignment = null; });
      (state.bases || []).forEach((b) => { if (b) { b.captainId = null; b.helperIds = []; b.role = null; try { PNS.applyBaseRoleUI?.(b, null); } catch {} } });
    }

    applyBaseTowerRulesForActiveShift({ rerender: false });

    return !!(plan && (
      Object.values(plan.players || {}).some(Boolean) ||
      Object.values(plan.bases || {}).some((b) => b?.captainId || (b?.helperIds || []).length)
    ));
  }

  // ---- Session persistence orchestration ----
  let _persistTimer = 0;
  function persistSessionState() {
    if (!Array.isArray(state.players) || !state.players.length) return false;
    let ok = false;
    try { ok = !!savePlayersSnapshot(state.players) || ok; } catch {}
    try { ok = !!saveTowersSnapshot() || ok; } catch {}
    try { saveTowerMarchOverridesStore(); ok = true; } catch {}
    return ok;
  }
  function persistSessionStateSoon(delay = 20) {
    try { clearTimeout(_persistTimer); } catch {}
    _persistTimer = setTimeout(() => { try { persistSessionState(); } catch {} }, delay);
  }

  function wrapRenderAllForPersistence() {
    const fn = PNS.renderAll;
    if (typeof fn !== 'function') return false;
    if (fn.__pnsWrappedForPersistence) return true;
    const wrapped = function (...args) {
      const out = fn.apply(this, args);
      if (Array.isArray(state.players) && state.players.length) persistSessionStateSoon(30);
      return out;
    };
    wrapped.__pnsWrappedForPersistence = true;
    try { wrapped.__pnsOriginal = fn; } catch {}
    PNS.renderAll = wrapped;
    return true;
  }

  function wrapAssignmentClearersForOverrideCleanup() {
    const wrapClear = PNS.clearBase;
    if (typeof wrapClear === 'function' && !wrapClear.__pnsOverridesWrapped) {
      const w = function (baseId, helpersOnly = false) {
        const base = state.baseById?.get?.(baseId);
        const removed = [];
        if (base) {
          if (!helpersOnly && base.captainId) removed.push(String(base.captainId));
          (base.helperIds || []).forEach((id) => removed.push(String(id)));
        }
        const res = wrapClear.apply(this, arguments);
        try {
          removed.forEach((pid) => clearTowerMarchOverride(baseId, pid));
          persistSessionStateSoon(10);
        } catch {}
        return res;
      };
      w.__pnsOverridesWrapped = true;
      PNS.clearBase = w;
    }

    const wrapRemove = PNS.removePlayerFromSpecificBase;
    if (typeof wrapRemove === 'function' && !wrapRemove.__pnsOverridesWrapped) {
      const w = function (baseId, playerId) {
        const res = wrapRemove.apply(this, arguments);
        try {
          if (res) clearTowerMarchOverride(baseId, playerId);
          persistSessionStateSoon(10);
        } catch {}
        return res;
      };
      w.__pnsOverridesWrapped = true;
      PNS.removePlayerFromSpecificBase = w;
    }
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
  PNS.applyBaseTowerRulesForActiveShift = applyBaseTowerRulesForActiveShift;

  PNS.loadFieldLabelOverrides = loadFieldLabelOverrides;
  PNS.saveFieldLabelOverrides = saveFieldLabelOverrides;
  PNS.setFieldLabelOverride = setFieldLabelOverride;

  PNS.loadVisibleOptionalColumns = loadVisibleOptionalColumns;
  PNS.saveVisibleOptionalColumns = saveVisibleOptionalColumns;

  PNS.savePlayersSnapshot = savePlayersSnapshot;
  PNS.loadPlayersSnapshot = loadPlayersSnapshot;
  PNS.clearPlayersSnapshot = clearPlayersSnapshot;

  PNS.saveTowersSnapshot = saveTowersSnapshot;
  PNS.loadTowersSnapshot = loadTowersSnapshot;
  PNS.clearTowersSnapshot = clearTowersSnapshot;
  PNS.tryRestoreTowersSnapshot = tryRestoreTowersSnapshot;

  PNS.loadTowerMarchOverridesStore = loadTowerMarchOverridesStore;
  PNS.saveTowerMarchOverridesStore = saveTowerMarchOverridesStore;
  PNS.getTowerMarchOverride = getTowerMarchOverride;
  PNS.setTowerMarchOverride = setTowerMarchOverride;
  PNS.clearTowerMarchOverride = clearTowerMarchOverride;
  PNS.clearTowerMarchOverrides = clearTowerMarchOverrides;

  PNS.persistSessionState = persistSessionState;
  PNS.persistSessionStateSoon = persistSessionStateSoon;

  PNS.setImportStatus = setImportStatus;
  PNS.setImportLoadedInfo = setImportLoadedInfo;

  // bootstrap persistence and scoped-rule syncing
  try { loadTowerMarchOverridesStore(); } catch {}
  const boot = () => {
    try { wrapRenderAllForPersistence(); } catch {}
    try { wrapAssignmentClearersForOverrideCleanup(); } catch {}
    try { applyBaseTowerRulesForActiveShift({ rerender: false }); } catch {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else setTimeout(boot, 0);

  document.addEventListener('htmx:afterSwap', () => { try { boot(); } catch {} });
  document.addEventListener('htmx:afterSettle', () => { try { boot(); } catch {} });
  document.addEventListener('pns:partials:loaded', () => { try { boot(); } catch {} });

  // Shift switch -> re-apply per-shift limits to in-memory bases, then save
  document.addEventListener('click', (e) => {
    const t = e.target?.closest?.('[data-shift-tab],[data-picker-shift-tab]');
    if (!t) return;
    setTimeout(() => {
      try { applyBaseTowerRulesForActiveShift({ rerender: true }); } catch {}
      try { persistSessionStateSoon(40); } catch {}
    }, 0);
  });

  // Extra save points
  window.addEventListener('beforeunload', () => { try { persistSessionState(); } catch {} });
  document.addEventListener('pns:assignment-changed', () => { try { persistSessionStateSoon(10); } catch {} });
  document.addEventListener('players-table-rendered', () => { try { persistSessionStateSoon(30); } catch {} });

})();
