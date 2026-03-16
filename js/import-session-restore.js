/* ==== import-session-restore.js ==== */
/* Import wizard: session restore */
(function () {
  const e = window.PNS;
  if (!e) return;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const t = e.state;
  const r = wiz.translate;
  const n = wiz.formatMessage;
  const y = wiz.loadCustomOptionalDefs;
  const q = wiz.ensureImportState;
  const session = (wiz.__sessionBootstrapState = wiz.__sessionBootstrapState || {
    restoreRetryTimers: [],
    lateRestoreTimer: 0,
  });

  function restoreShiftAndTowerState() {
    try {
      if (!Array.isArray(t.players) || !t.players.length) return false;
      if (!t.playerById || typeof t.playerById.get !== 'function') {
        t.playerById = new Map((t.players || []).map((player) => [player.id, player]));
      }
      let restoredFromShiftPlans = false;
      let restoredFromTowers = false;
      try {
        const store = JSON.parse(localStorage.getItem('pns_layout_shift_plans_store_v1') || '{}');
        restoredFromShiftPlans = !!(
          store &&
          typeof store === 'object' &&
          !Array.isArray(store) &&
          (Object.prototype.hasOwnProperty.call(store, 'shift1') ||
            Object.prototype.hasOwnProperty.call(store, 'shift2'))
        );
      } catch {}
      if (restoredFromShiftPlans) {
        try { e.hydrateShiftPlansFromStore?.(true); } catch {}
        try { typeof e.applyShiftFilter === 'function' && e.applyShiftFilter(t.activeShift || 'shift1'); } catch {}
      } else {
        try { typeof e.applyShiftFilter === 'function' && e.applyShiftFilter(t.activeShift || 'shift1'); } catch {}
        if (typeof e.tryRestoreTowersSnapshot === 'function') {
          try { restoredFromTowers = !!e.tryRestoreTowersSnapshot(); } catch {}
        }
        if (!restoredFromTowers) {
          try { restoredFromTowers = !!e.restoreBasesFromPlayerAssignments?.(); } catch {}
        }
        try { e.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
      }
      typeof e.renderAll === 'function' && e.renderAll();
      try { e.calcSyncCaptainsFromTowersIntoCalculator?.({ keepHelpers: true, render: false }); } catch {}
      try { window.calcRenderInlineTowerSettings?.(document.getElementById('towerCalcModal')); } catch {}
      try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {}
      try { window.calcUpdateShiftStatsUI?.(document.getElementById('towerCalcModal')); } catch {}
      return !!restoredFromShiftPlans || !!restoredFromTowers;
    } catch {
      return false;
    }
  }

  function restorePreviousPlayersSession() {
    if (wiz._skipPlayerRestoreUntilApplied || t?.importData?.sourcePending) return false;
    let restoredPlayersFromSnapshot = false;
    if (!(Array.isArray(t.players) && t.players.length) && typeof e.loadPlayersSnapshot === 'function') {
      const snapshot = e.loadPlayersSnapshot();
      if (Array.isArray(snapshot) && snapshot.length) {
        t.players = snapshot;
        restoredPlayersFromSnapshot = true;
      }
    }
    if (!Array.isArray(t.players) || !t.players.length) return false;

    (function hydrateCustomOptionalDefsFromPlayers(players) {
      const list = Array.isArray(players) ? players : [];
      const labels = {};
      list.forEach((player) => {
        const customFieldLabels =
          player?.customFieldLabels && typeof player.customFieldLabels === 'object'
            ? player.customFieldLabels
            : {};
        Object.entries(customFieldLabels).forEach(([key, value]) => {
          if (key && !(key in labels) && String(value || '').trim()) {
            labels[key] = String(value).trim();
          }
        });
        const customFields =
          player?.customFields && typeof player.customFields === 'object'
            ? player.customFields
            : {};
        Object.keys(customFields).forEach((key) => {
          if (!(key in labels)) {
            labels[key] = key.replace(/^custom[_:-]*/i, '').replace(/_/g, ' ') || key;
          }
        });
      });
      const merged = Object.entries(labels).map(([key, label]) => ({ key, label }));
      const persisted = y();
      const runtime = Array.isArray(t.importData?.customOptionalDefs) ? t.importData.customOptionalDefs : [];
      const defs = new Map();
      [...(wiz.getBuiltinCustomDefs?.() || []), ...persisted, ...runtime, ...merged].forEach((item) => {
        if (!item || !String(item.key || '').trim()) return;
        const key = String(item.key).trim();
        const existing = defs.get(key) || {};
        defs.set(key, {
          ...existing,
          ...item,
          key,
          label: String(item.label || existing.label || key).trim() || key,
          required: false,
          colKey: String(item.colKey || existing.colKey || key),
          visibleDefault:
            typeof item.visibleDefault === 'boolean' ? item.visibleDefault : !!existing.visibleDefault,
          isCustom: true,
        });
      });
      t.importData = t.importData || { headers: [], rows: [], mapping: {}, loaded: false };
      t.importData.customOptionalDefs = wiz.normalizeCustomOptionalDefs(Array.from(defs.values()));
      wiz.persistCustomOptionalDefs?.(t.importData.customOptionalDefs);
      q();
    })(t.players || []);

    t.playerById = new Map((t.players || []).map((player) => [player.id, player]));
    t._skipTowerSnapshotSave = true;

    const needsTableRefresh = restoredPlayersFromSnapshot || (function () {
      const table = document.querySelector('#playersDataTable');
      const rows = document.querySelectorAll('#playersDataTable tbody tr');
      return !!table && (
        rows.length !== (t.players || []).length ||
        (t.players || []).some((player) => !player || !player.rowEl || !player.rowEl.isConnected)
      );
    })();

    if (needsTableRefresh) {
      typeof e.renderPlayersTableFromState === 'function' && e.renderPlayersTableFromState();
      typeof e.buildRowActions === 'function' && e.buildRowActions();
    }

    restoreShiftAndTowerState();

    if (!t._restoreRetriesBootstrapped) {
      t._restoreRetriesBootstrapped = true;
      try { session.restoreRetryTimers.forEach((timer) => clearTimeout(timer)); } catch {}
      session.restoreRetryTimers = [];
      [80, 220, 600, 1200, 2200].forEach((delay) => {
        const timer = setTimeout(() => {
          restoreShiftAndTowerState();
          if (delay >= 2200) {
            try { t._skipTowerSnapshotSave = false; } catch {}
            try { e.persistSessionStateSoon?.(30); } catch {}
          }
        }, delay);
        session.restoreRetryTimers.push(timer);
      });
    }

    if (restoredPlayersFromSnapshot) {
      wiz.setImportLoadedInfo?.(
        n('restored_players_from_storage', 'Відновлено {count} гравців із LocalStorage.', {
          count: t.players.length,
        }),
      );
      wiz.setImportStatus?.(
        r(
          'restored_previous_session',
          'Гравців відновлено з попередньої сесії. У будь-який момент можна завантажити нову таблицю і замінити їх.',
        ),
        'good',
      );
    }
    return true;
  }

  Object.assign(wiz, {
    restoreShiftAndTowerState,
    restorePreviousPlayersSession,
  });
})();
