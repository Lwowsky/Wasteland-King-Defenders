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

  // ===== Players dataset store (persist imported/current players across refresh) =====
  const KEY_PLAYERS_STORE = 'pns_players_store_v1';
  const KEY_SHIFT_PLANS_STORE = 'pns_shift_plans_store_v1';

  function serializePlayerForStore(p) {
    if (!p) return null;
    return {
      id: p.id || '',
      name: p.name || '',
      playerExternalId: p.playerExternalId || '',
      alliance: p.alliance || '',
      role: p.role || '',
      tier: p.tier || '',
      tierRank: Number(p.tierRank || 0) || 0,
      march: Number(p.march || 0) || 0,
      rally: Number(p.rally || 0) || 0,
      captainReady: !!p.captainReady,
      shift: p.shift || 'both',
      shiftLabel: p.shiftLabel || (typeof PNS.formatShiftLabelForCell === 'function' ? PNS.formatShiftLabelForCell(p.shift || 'both') : 'Both'),
      lairLevel: p.lairLevel || '',
      secondaryRole: p.secondaryRole || '',
      secondaryTier: p.secondaryTier || '',
      troop200k: p.troop200k || '',
      notes: p.notes || '',
      raw: p.raw || null,
      assignment: null,
    };
  }

  function savePlayersStore() {
    const rows = Array.isArray(state.players) ? state.players.map(serializePlayerForStore).filter(Boolean) : [];
    safeWriteJSON(KEY_PLAYERS_STORE, { v: 1, players: rows });
  }

  function loadPlayersStore() {
    const payload = safeReadJSON(KEY_PLAYERS_STORE, null);
    const arr = Array.isArray(payload?.players) ? payload.players : null;
    if (!arr || !arr.length) return false;
    state.players = arr.map((p, idx) => ({ ...p, id: p.id || `p${idx+1}`, rowEl: null, actionCellEl: null, assignment: null }));
    state.playerById = new Map(state.players.map(p => [p.id, p]));
    return true;
  }

  function clearPlayersStore() { safeWriteJSON(KEY_PLAYERS_STORE, null); }

  function saveShiftPlansStore() {
    const plans = state.shiftPlans && typeof state.shiftPlans === 'object' ? state.shiftPlans : {};
    safeWriteJSON(KEY_SHIFT_PLANS_STORE, plans);
  }
  function loadShiftPlansStore() {
    const plans = safeReadJSON(KEY_SHIFT_PLANS_STORE, null);
    state.shiftPlans = (plans && typeof plans === 'object' && !Array.isArray(plans)) ? plans : { shift1: null, shift2: null };
    return state.shiftPlans;
  }
  function clearShiftPlansStore() {
    state.shiftPlans = { shift1: null, shift2: null };
    saveShiftPlansStore();
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

  PNS.setImportStatus = setImportStatus;
  PNS.setImportLoadedInfo = setImportLoadedInfo;

  PNS.savePlayersStore = savePlayersStore;
  PNS.loadPlayersStore = loadPlayersStore;
  PNS.clearPlayersStore = clearPlayersStore;
  PNS.saveShiftPlansStore = saveShiftPlansStore;
  PNS.loadShiftPlansStore = loadShiftPlansStore;
  PNS.clearShiftPlansStore = clearShiftPlansStore;

})();