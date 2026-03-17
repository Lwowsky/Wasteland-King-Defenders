/* Import wizard: reset state and apply imported players */
(function () {
  const e = window.PNS;
  if (!e) return;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const t = e.state;
  const r = wiz.translate;
  const n = wiz.formatMessage;
  const o = wiz.columnLabel;
  const i = wiz.REQUIRED_FIELDS || [];
  const b = wiz.ensureCustomOptionalDefs;
  const g = wiz.getCustomOptionalDefs;
  const F = wiz.collectMappingSelections;
  const L = wiz.getFieldLabel;
  const U = wiz.saveImportTemplate;

  function re(key) {
    try {
      key && localStorage.removeItem(key);
    } catch {}
  }

  function W(a = {}) {
    const preserveImportData = !1 !== a?.preserveImportData;
    try { e.clearPlayersSnapshot?.(); } catch {}
    try { e.clearTowersSnapshot?.(); } catch {}
    try { e.clearTowerMarchOverrides?.(); } catch {}
    re(e.KEYS?.KEY_ASSIGNMENTS_STORE);
    re(e.KEYS?.KEY_ASSIGNMENT_PRESETS);
    re(e.KEYS?.KEY_TOP_FILTERS);
    re(e.KEYS?.KEY_SHIFT_FILTER);
    re(e.KEYS?.KEY_SHOW_ALL);
    re('pns_layout_shift_plans_store_v1');
    re('pns_tower_calc_state');
    t.players = [];
    t.playerById = new Map();
    t.shiftPlans = { shift1: null, shift2: null };
    t._shiftPlansLoadedFromLS = !0;
    try {
      localStorage.setItem('pns_layout_shift_plans_store_v1', JSON.stringify({ shift1: null, shift2: null }));
    } catch {}
    t.activeShift = 'shift1';
    t.towerCalcLastResults = null;
    if (t.topFilters && 'object' == typeof t.topFilters) t.topFilters.shift = 'all';
    (t.bases || []).forEach((base) => {
      if (!base) return;
      base.captainId = null;
      base.helperIds = [];
      base.role = null;
      try { e.applyBaseRoleUI?.(base, null); } catch {}
    });
    if (!preserveImportData) {
      t.importData = {
        headers: [],
        rows: [],
        mapping: {},
        loaded: !1,
        customOptionalDefs: b(),
      };
    }
    try { e.renderPlayersTableFromState?.(); } catch {}
    try { e.buildRowActions?.(); } catch {}
    try { e.renderAll?.(); } catch {}
    try { e.applyShiftFilter?.('shift1'); } catch {}
    try { window.calcRenderInlineTowerSettings?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.calcUpdateShiftStatsUI?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.renderStandaloneFinalBoard?.(document.getElementById('board-modal')); } catch {}
    return !0;
  }

  function H() {
    F?.();
    const mapping = t.importData.mapping || {};
    const missing = i
      .filter((field) => field.required && !mapping[field.key])
      .map((field) => o(field.key, L?.(field.key)));
    if (missing.length) {
      wiz.setImportStatus?.(
        n('missing_required_mappings', 'Бракує обов’язкових зіставлень: {fields}', {
          fields: missing.join(', '),
        }),
        'danger',
      );
      return null;
    }

    const customDefs = g();
    const customLabels = Object.fromEntries(customDefs.map((field) => [field.key, field.label]));
    const out = [];
    for (const row of t.importData.rows || []) {
      const pick = (key) => {
        const header = mapping[key];
        return header ? String(row[header] ?? '').trim() : '';
      };
      const name = pick('player_name');
      if (!name) continue;
      const shiftRaw = pick('shift_availability');
      const shift = e.normalizeShiftValue(shiftRaw);
      const role = e.normalizeRole(pick('focus_troop'));
      const customFields = {};
      let fallbackNotes = '';
      customDefs.forEach((def) => {
        const value = pick(def.key);
        if (!value) return;
        if (String(def.label || '').trim().toLowerCase() !== 'notes') customFields[def.key] = value;
        else if (!fallbackNotes) fallbackNotes = value;
      });
      out.push({
        id: '',
        name,
        playerExternalId: '',
        alliance: pick('alliance_alias'),
        role,
        tier: e.normalizeTierText(pick('troop_tier')),
        tierRank: e.tierRank(pick('troop_tier')),
        march: e.parseNumber(pick('march_size')),
        rally: e.parseNumber(pick('rally_size')),
        captainReady: e.normalizeYesNo(pick('captain_ready')),
        registeredShiftRaw: shiftRaw,
        registeredShift: shift,
        registeredShiftLabel: e.formatShiftLabelForCell(shift),
        shift,
        shiftLabel: e.formatShiftLabelForCell(shift),
        lairLevel: pick('lair_level'),
        secondaryRole: e.normalizeRole(pick('secondary_role')),
        secondaryTier: e.normalizeTierText(pick('secondary_tier')),
        troop200k: pick('troop_200k'),
        notes: pick('notes') || fallbackNotes,
        customFields,
        customFieldLabels: customLabels,
        raw: row,
        rowEl: null,
        actionCellEl: null,
        assignment: null,
      });
    }
    return out;
  }

  function q(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function X(player, loose = !1) {
    const name = q(player?.name);
    const alliance = q(player?.alliance);
    if (!name) return '';
    return loose || !alliance ? name : `${name}::${alliance}`;
  }

  function Y(player) {
    if (!player || typeof player !== 'object') return '';
    return JSON.stringify({
      name: String(player.name || ''),
      alliance: String(player.alliance || ''),
      role: String(player.role || ''),
      tier: String(player.tier || ''),
      tierRank: Number(player.tierRank || 0),
      march: Number(player.march || 0),
      rally: Number(player.rally || 0),
      captainReady: !!player.captainReady,
      registeredShiftRaw: String(player.registeredShiftRaw || ''),
      registeredShift: String(player.registeredShift || ''),
      registeredShiftLabel: String(player.registeredShiftLabel || ''),
      shift: String(player.shift || ''),
      shiftLabel: String(player.shiftLabel || ''),
      lairLevel: String(player.lairLevel || ''),
      secondaryRole: String(player.secondaryRole || ''),
      secondaryTier: String(player.secondaryTier || ''),
      troop200k: String(player.troop200k || ''),
      notes: String(player.notes || ''),
      customFields: player.customFields && typeof player.customFields === 'object' ? player.customFields : {},
      customFieldLabels:
        player.customFieldLabels && typeof player.customFieldLabels === 'object'
          ? player.customFieldLabels
          : {},
    });
  }

  function J() {
    const pinned = new Set();
    (t.players || []).forEach((player) => {
      if (player?.assignment?.baseId) pinned.add(String(player.id || ''));
    });
    (t.bases || []).forEach((base) => {
      if (base?.captainId) pinned.add(String(base.captainId || ''));
      (Array.isArray(base?.helperIds) ? base.helperIds : []).forEach((id) => pinned.add(String(id || '')));
    });
    const plans = t.shiftPlans && typeof t.shiftPlans === 'object' ? t.shiftPlans : {};
    ['shift1', 'shift2'].forEach((shiftKey) => {
      const snap = plans?.[shiftKey] || null;
      const players = snap?.players && typeof snap.players === 'object' ? snap.players : {};
      Object.entries(players).forEach(([playerId, assignment]) => {
        if (assignment?.baseId) pinned.add(String(playerId || ''));
      });
      const bases = snap?.bases && typeof snap.bases === 'object' ? snap.bases : {};
      Object.values(bases).forEach((base) => {
        if (base?.captainId) pinned.add(String(base.captainId || ''));
        (Array.isArray(base?.helperIds) ? base.helperIds : []).forEach((id) => pinned.add(String(id || '')));
      });
    });
    return pinned;
  }

  function K(existingPlayers = []) {
    const used = new Set(existingPlayers.map((player) => String(player?.id || '')).filter(Boolean));
    let seq = 1;
    used.forEach((id) => {
      const match = String(id || '').match(/^p(\d+)$/i);
      if (match) seq = Math.max(seq, Number(match[1]) + 1);
    });
    return () => {
      while (used.has(`p${seq}`)) seq += 1;
      const id = `p${seq}`;
      used.add(id);
      seq += 1;
      return id;
    };
  }

  function Z() {
    const players = H();
    if (!players) return null;
    const nextId = K(t.players || []);
    return players.map((player) => ({
      ...player,
      id: nextId(),
      assignment: null,
      rowEl: null,
      actionCellEl: null,
    }));
  }

  function G() {
    const players = Z();
    if (!players) return;
    if (!players.length) {
      wiz.setImportStatus?.(
        r(
          'no_players_after_import',
          'Після імпорту не знайдено жодного гравця. Перевір мапінг колонок і порожні рядки.',
        ),
        'danger',
      );
      return;
    }

    W({ preserveImportData: !0 });
    t.players = players;
    try { t.importData = t.importData || {}; t.importData.sourcePending = !1; } catch {}
    try { wiz._skipPlayerRestoreUntilApplied = !1; } catch {}
    t.playerById = new Map(players.map((player) => [player.id, player]));
    t.shiftPlans = {};
    (t.bases || []).forEach((base) => {
      base.captainId = null;
      base.helperIds = [];
      base.role = null;
      if ('function' == typeof e.applyBaseRoleUI) e.applyBaseRoleUI(base, null);
    });
    try { e.clearTowersSnapshot?.(); } catch {}
    try { e.clearTowerMarchOverrides?.(); } catch {}
    try { t && 'object' == typeof t && (t.shiftPlans = { shift1: null, shift2: null }); } catch {}
    try {
      localStorage.setItem('pns_layout_shift_plans_store_v1', JSON.stringify({ shift1: null, shift2: null }));
    } catch {}
    re('pns_tower_calc_state');
    if ('function' == typeof e.renderPlayersTableFromState) e.renderPlayersTableFromState();
    if ('function' == typeof e.buildRowActions) e.buildRowActions();
    if ('function' == typeof e.renderAll) e.renderAll();
    if ('function' == typeof e.applyShiftFilter) e.applyShiftFilter(t.activeShift);
    if ('function' == typeof e.savePlayersSnapshot) e.savePlayersSnapshot(t.players);
    try { U?.(); } catch {}
    try { e.saveTowersSnapshot?.(); } catch {}
    try { e.persistSessionStateSoon?.(20); } catch {}
    try { U?.(); } catch {}
    wiz.setImportStatus?.(
      n(
        'imported_players_template_updated',
        'Імпортовано {count} гравців. Шаблон автоматично оновлено у сховищі браузера.',
        { count: players.length },
      ),
      'good',
    );
    wiz.setImportLoadedInfo?.(n('imported_players_loaded_info', '{source} • імпортовано {count} гравців', { source: t.importData.джерелоName || r('source_word', 'джерело'), count: players.length }));
  }

  function clonePlanState(value) {
    try {
      return JSON.parse(JSON.stringify(value || { shift1: null, shift2: null }));
    } catch {
      return { shift1: null, shift2: null };
    }
  }

  function readStoredShiftPlans() {
    try {
      const raw = JSON.parse(localStorage.getItem('pns_layout_shift_plans_store_v1') || '{}');
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
    } catch {}
    return { shift1: null, shift2: null };
  }

  function writeStoredShiftPlans(plans) {
    try {
      localStorage.setItem('pns_layout_shift_plans_store_v1', JSON.stringify({
        shift1: Object.prototype.hasOwnProperty.call(plans || {}, 'shift1') ? plans.shift1 ?? null : null,
        shift2: Object.prototype.hasOwnProperty.call(plans || {}, 'shift2') ? plans.shift2 ?? null : null,
      }));
    } catch {}
  }

  function cloneJSON(value, fallback = null) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return fallback;
    }
  }

  function readJsonKey(key, fallback = null) {
    try {
      return JSON.parse(localStorage.getItem(String(key || '')) || 'null') ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJsonKey(key, value) {
    try {
      localStorage.setItem(String(key || ''), JSON.stringify(value));
    } catch {}
  }

  function snapshotLiveBases() {
    const out = {};
    (t.bases || []).forEach((base) => {
      const baseId = String(base?.id || '');
      if (!baseId) return;
      out[baseId] = {
        captainId: String(base?.captainId || ''),
        helperIds: Array.isArray(base?.helperIds) ? base.helperIds.map((id) => String(id || '')).filter(Boolean) : [],
        role: base?.role || null,
      };
    });
    return out;
  }

  function restoreLiveBases(snapshot) {
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
    (t.bases || []).forEach((base) => {
      const baseId = String(base?.id || '');
      if (!baseId) return;
      const saved = snap[baseId] || {};
      const captainId = String(saved?.captainId || '');
      const helperIds = Array.isArray(saved?.helperIds)
        ? saved.helperIds.map((id) => String(id || '')).filter((id) => !!id && t.playerById?.has?.(id))
        : [];
      base.captainId = captainId && t.playerById?.has?.(captainId) ? captainId : null;
      base.helperIds = helperIds.filter((id) => id !== base.captainId);
      base.role = saved?.role || base.role || null;
      try {
        const captain = base.captainId ? t.playerById?.get?.(base.captainId) : null;
        e.applyBaseRoleUI?.(base, captain?.role || base.role || null);
      } catch {}
    });
  }

  function ee() {
    const imported = H();
    if (!imported) return;
    if (!imported.length) {
      wiz.setImportStatus?.(
        r(
          'no_players_after_import',
          'Після імпорту не знайдено жодного гравця. Перевір мапінг колонок і порожні рядки.',
        ),
        'danger',
      );
      return;
    }

    try { e.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
    try { e.saveTowersSnapshot?.(); } catch {}
    try { e.saveAllPersistenceNow?.('before-preserve-import'); } catch {}

    const preservedShiftPlans = clonePlanState({
      ...readStoredShiftPlans(),
      ...(t.shiftPlans && typeof t.shiftPlans === 'object' ? t.shiftPlans : {}),
    });
    const preservedLiveBases = snapshotLiveBases();
    const preservedTowerSnapshot = cloneJSON(readJsonKey('pns_layout_towers_snapshot_v1', null), null);
    const preservedTowerOverrides = cloneJSON(readJsonKey('pns_layout_tower_march_overrides_v1', {}), {});
    const preservedCalcState = cloneJSON(readJsonKey('pns_tower_calc_state', {}), {});
    const preservedRuntimeCalc = cloneJSON(t.towerCalc || {}, {});
    const preservedCalcResults = cloneJSON(t.towerCalcLastResults || null, null);
    const activeShiftBeforeMerge = String(t.activeShift || 'shift1');

    const currentPlayers = Array.isArray(t.players) ? t.players : [];
    const pinnedIds = J();
    const matchedIds = new Set();
    const fullMap = new Map();
    const nameMap = new Map();
    const pushMap = (map, key, player) => {
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(player);
    };
    currentPlayers.forEach((player) => {
      const id = String(player?.id || '');
      if (!id) return;
      pushMap(fullMap, X(player, !1), player);
      pushMap(nameMap, X(player, !0), player);
    });

    const takeCandidate = (map, key, requireUnique = !1) => {
      const list = Array.isArray(map.get(key)) ? map.get(key) : [];
      const free = list.filter((player) => !matchedIds.has(String(player?.id || '')));
      if (!free.length) return null;
      if (requireUnique && free.length !== 1) return null;
      const picked = free[0] || null;
      if (picked) matchedIds.add(String(picked.id || ''));
      return picked;
    };

    const nextId = K(currentPlayers);
    const merged = [];
    let added = 0;
    let updated = 0;
    let removed = 0;
    let preservedPlanPlayers = 0;

    imported.forEach((player) => {
      const fullKey = X(player, !1);
      const nameKey = X(player, !0);
      let previous = takeCandidate(fullMap, fullKey, !1);
      if (!previous) previous = takeCandidate(nameMap, nameKey, !0) || takeCandidate(nameMap, nameKey, !1);
      if (previous) {
        const mergedPlayer = {
          ...previous,
          ...player,
          id: String(previous.id || ''),
          playerExternalId: String(previous.playerExternalId || player.playerExternalId || ''),
          assignment: previous.assignment ? { ...previous.assignment } : null,
          rowEl: null,
          actionCellEl: null,
        };
        if (Y(previous) !== Y(mergedPlayer)) updated += 1;
        merged.push(mergedPlayer);
      } else {
        merged.push({
          ...player,
          id: nextId(),
          assignment: null,
          rowEl: null,
          actionCellEl: null,
        });
        added += 1;
      }
    });

    currentPlayers.forEach((player) => {
      const id = String(player?.id || '');
      if (!id || matchedIds.has(id)) return;
      if (pinnedIds.has(id)) {
        preservedPlanPlayers += 1;
        merged.push({ ...player, rowEl: null, actionCellEl: null });
      } else {
        removed += 1;
      }
    });

    t.players = merged;
    t.playerById = new Map(merged.map((player) => [player.id, player]));
    try { t.importData = t.importData || {}; t.importData.sourcePending = !1; } catch {}
    try { wiz._skipPlayerRestoreUntilApplied = !1; } catch {}

    try { t.shiftPlans = clonePlanState(preservedShiftPlans); } catch {}
    try { writeStoredShiftPlans(t.shiftPlans || preservedShiftPlans); } catch {}
    try { t.towerCalc = cloneJSON(preservedRuntimeCalc, {}); } catch {}
    try { t.towerCalcLastResults = cloneJSON(preservedCalcResults, null); } catch {}
    try { writeJsonKey('pns_tower_calc_state', preservedCalcState || {}); } catch {}
    try { writeJsonKey('pns_layout_tower_march_overrides_v1', preservedTowerOverrides || {}); } catch {}
    try {
      if (preservedTowerSnapshot) writeJsonKey('pns_layout_towers_snapshot_v1', preservedTowerSnapshot);
    } catch {}

    restoreLiveBases(preservedLiveBases);

    try { e.renderPlayersTableFromState?.(); } catch {}
    try { e.buildRowActions?.(); } catch {}
    try { e.renderAll?.(); } catch {}
    try { e.hydrateShiftPlansFromStore?.(true); } catch {}
    try {
      if (activeShiftBeforeMerge === 'shift1' || activeShiftBeforeMerge === 'shift2') {
        e.ModalsShift?.loadShiftPlanSnapshot?.(activeShiftBeforeMerge);
      } else {
        e.tryRestoreTowersSnapshot?.({ soft: false });
      }
    } catch {}
    try { restoreLiveBases(preservedLiveBases); } catch {}
    try { e.applyShiftFilter?.(activeShiftBeforeMerge || 'shift1'); } catch {}
    try { window.calcRenderInlineTowerSettings?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.calcUpdateShiftStatsUI?.(document.getElementById('towerCalcModal')); } catch {}
    try { window.renderStandaloneFinalBoard?.(document.getElementById('board-modal')); } catch {}
    try { e.savePlayersSnapshot?.(t.players); } catch {}
    try { e.saveTowersSnapshot?.(); } catch {}
    try { e.persistSessionStateSoon?.(20); } catch {}
    try { U?.({ silent: !0 }); } catch {}

    const totalChanged = added + updated + removed;
    if (!totalChanged) {
      wiz.setImportStatus?.(
        r(
          'roster_keep_plan_no_changes',
          'Склад звірено. Змін у таблиці не знайдено, фінальний план залишився без змін.',
        ),
        'good',
      );
    } else {
      const parts = [
        `${r('added_short', 'додано')}: ${added}`,
        `${r('updated_short', 'оновлено')}: ${updated}`,
        `${r('removed_short', 'прибрано')}: ${removed}`,
      ];
      if (preservedPlanPlayers) {
        parts.push(`${r('kept_for_plan_short', 'залишено для плану')}: ${preservedPlanPlayers}`);
      }
      wiz.setImportStatus?.(
        `${r('roster_updated_keep_plan', 'Склад оновлено без скидання фінального плану.')} ${parts.join(' • ')}.`,
        'good',
      );
    }
    wiz.setImportLoadedInfo?.(
      `${t.importData.джерелоName || r('source_word', 'джерело')} • ${merged.length} ${r('players_word', 'гравців')} • ${r('plan_preserved_hint', 'план збережено')}`,
    );
  }

  Object.assign(wiz, {
    resetImportedState: W,
    applyImportedPlayers: G,
    buildImportedPlayersFromSource: Z,
    applyImportedPlayersPreservePlan: ee,
  });
  e.applyImportedPlayers = G;
  e.applyImportedPlayersPreservePlan = ee;
})();
