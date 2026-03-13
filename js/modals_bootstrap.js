// Modals bindings + init (split from modals_api.js)
(function () {
  const PNS = window.PNS; if (!PNS) return;
  const MS = (PNS.ModalsShift = PNS.ModalsShift || {});
  const { state } = PNS; if (!state) return;
  const t = (key, fallback = '') => (typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback);
  const roleLabel = (value, plural = false) => (typeof PNS.roleLabel === 'function' ? PNS.roleLabel(value, plural) : String(value || ''));

  function pickerManualFindPlayerByInput(modal) {
    const root = modal || document.getElementById('towerPickerModal');
    if (!root) return null;
    const inp = root.querySelector('#pickerManualSearch') || root.querySelector('#pickerManualName');
    const q = String(inp?.value || '').trim();
    if (!q) return null;
    const norm = (s) => String(s || '').trim().toLowerCase();
    const nq = norm(q);
    const players = Array.isArray(state.players) ? state.players : [];
    const exact = players.find((p) => norm(p?.name) === nq);
    if (exact) return exact;
    return null;
  }

  function pickerManualSearchMatches(modal) {
    const root = modal || document.getElementById('towerPickerModal');
    if (!root) return [];
    const inp = root.querySelector('#pickerManualSearch') || root.querySelector('#pickerManualName');
    const q = String(inp?.value || '').trim();
    if (!q) return [];
    const norm = (s) => String(s || '').trim().toLowerCase();
    const nq = norm(q);
    return (Array.isArray(state.players) ? state.players : []).filter((p) => {
      const n = norm(p?.name);
      return n === nq || n.startsWith(nq) || n.includes(nq);
    }).slice(0, 8);
  }

  function pickerManualFillFromPlayer(player, modal) {
    const root = modal || document.getElementById('towerPickerModal');
    if (!root || !player) return false;
    const searchEl = root.querySelector('#pickerManualSearch');
    if (searchEl) {
      searchEl.value = String(player.name || '');
      searchEl.dataset.playerId = String(player.id || '');
    }
    const nameEl = root.querySelector('#pickerManualName');
    if (nameEl) {
      if (!String(nameEl.value || '').trim() || nameEl.dataset.autoFilled === '1') {
        nameEl.value = String(player.name || '');
      }
      nameEl.dataset.playerId = String(player.id || '');
      nameEl.dataset.autoFilled = '1';
    }
    const allyEl = root.querySelector('#pickerManualAlly'); if (allyEl) allyEl.value = String(player.alliance || '');
    const roleEl = root.querySelector('#pickerManualRole'); if (roleEl) roleEl.value = String(player.role || roleEl.value || 'Fighter');
    const tierEl = root.querySelector('#pickerManualTier'); if (tierEl) tierEl.value = String(player.tier || '');
    const marchEl = root.querySelector('#pickerManualMarch'); if (marchEl) marchEl.value = String(Number(player.march || 0) || '');
    const rallyEl = root.querySelector('#pickerManualRally'); if (rallyEl) rallyEl.value = String(Number(player.rally || 0) || '');
    const hint = root.querySelector('#pickerManualHint');
    if (hint) hint.textContent = `${t('found_player', 'Знайдено')}: ${player.name} · ${player.alliance || '—'} · ${roleLabel(player.role || '') || '—'} · ${player.tier || '—'}`;
    return true;
  }

  function pickerManualClearMatchHint(modal) {
    const root = modal || document.getElementById('towerPickerModal');
    if (!root) return;
    const searchEl = root.querySelector('#pickerManualSearch');
    if (searchEl) delete searchEl.dataset.playerId;
    const nameEl = root.querySelector('#pickerManualName');
    if (nameEl) delete nameEl.dataset.playerId;
    const hint = root.querySelector('#pickerManualHint');
    if (hint) hint.textContent = '';
  }

  function pickerManualTryAutofill(modal) {
    const root = modal || document.getElementById('towerPickerModal');
    const p = pickerManualFindPlayerByInput(root);
    if (p) return pickerManualFillFromPlayer(p, root);
    const matches = pickerManualSearchMatches(root);
    const hint = root?.querySelector?.('#pickerManualHint');
    if (hint) {
      if (!matches.length) hint.textContent = '';
      else if (matches.length === 1) hint.textContent = `${t('press_enter_or_choose', 'Натисни Enter або вибери зі списку')}: ${matches[0].name}`;
      else hint.textContent = `${t('multiple_matches_choose_exact', 'Знайдено кілька')} (${matches.length}) — ${t('choose_exact_nick', 'вибери точний нік зі списку')}.`;
    }
    return false;
  }

  function saveTowerTableNow(reason) {
    try { PNS.savePlayersSnapshot?.(state.players); } catch {}
    try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
    try { PNS.saveTowersSnapshot?.(); } catch {}
    try { PNS.setImportStatus?.(`${t('saved_turret_table', 'Збережено таблицю турелі')}${reason ? ` (${reason})` : ''}.`, 'good'); } catch {}
  }

  function towerPickerScopeRoot(el) {
    return el?.closest?.('.tower-picker-scope,.tower-picker-detail,#towerPickerModal') || document.getElementById('towerPickerModal');
  }

  function towerPickerScopeShift(el) {
    const root = towerPickerScopeRoot(el);
    const inline = root?.closest?.('#towerCalcModal') || el?.closest?.('#towerCalcModal');
    if (!inline) return String(state.activeShift || 'shift1');
    return String(root?.getAttribute?.('data-calc-inline-scope') || state.activeShift || 'shift1');
  }

  function setActiveTowerPickerScope(root) {
    try { state._towerPickerActiveScopeRoot = root || null; } catch {}
  }

function syncPickerFlagsFromScope(root) {
  if (!root?.querySelector) return;
  try {
    const onlyCaptains = root.querySelector('#pickerOnlyCaptains');
    if (onlyCaptains) {
      state.towerPickerOnlyCaptains = !!onlyCaptains.checked;
      localStorage.setItem('pns_picker_only_captains', onlyCaptains.checked ? '1' : '0');
    }
  } catch {}
  try {
    const matchShift = root.querySelector('#pickerMatchRegisteredShift');
    if (matchShift) {
      state.towerPickerMatchRegisteredShift = !!matchShift.checked;
      localStorage.setItem('pns_picker_match_registered_shift', matchShift.checked ? '1' : '0');
    }
  } catch {}
  try {
    const noMix = root.querySelector('#pickerNoMixTroops');
    if (noMix) {
      state.towerPickerNoMixTroops = !!noMix.checked;
      localStorage.setItem('pns_picker_no_mix_troops', noMix.checked ? '1' : '0');
    }
  } catch {}
  try {
    const useBoth = root.querySelector('#pickerNoCrossShiftDupes');
    if (useBoth) {
      state.towerPickerNoCrossShiftDupes = !!useBoth.checked;
      localStorage.setItem('pns_picker_no_cross_shift_dupes', useBoth.checked ? '1' : '0');
    }
  } catch {}
}

  function syncPickerRuleFromScope(baseId, root) {
    if (!baseId || !root?.querySelector || typeof PNS.setBaseTowerRule !== 'function') return;
    try {
      const maxHelpersEl = root.querySelector('#pickerMaxHelpers');
      const tierMinMarch = {};
      root.querySelectorAll('[data-picker-tier]').forEach((inp) => { tierMinMarch[inp.dataset.pickerTier] = Number(inp.value || 0) || 0; });
      const rule = {
        maxHelpers: Number(maxHelpersEl?.value || 29) || 29,
        tierMinMarch,
      };
      PNS.setBaseTowerRule(baseId, rule, { persist: true, rerender: false });
    } catch {}
  }

  function refreshTowerPickerScope(root) {
    const inCalc = !!root?.closest?.('#towerCalcModal');
    if (inCalc) {
      try { window.calcRenderInlineTowerSettings?.(document.getElementById('towerCalcModal')); } catch {}
      try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {}
      return;
    }
    try { MS.refreshTowerPickerModalList?.(); MS.updateTowerPickerDetail?.(); } catch {}
    try { MS.syncSettingsTowerPreview?.(); } catch {}
  }


  function bindSettingsAndTowerButtonsOnce() {
    if (state._modalsShiftExtraBound) return;
    state._modalsShiftExtraBound = true;

    function seedTowerEditModalFromManual(baseId, assignKind, rootIn) {
      const m = rootIn || document.getElementById('towerPickerModal');
      try { pickerManualTryAutofill(m); } catch {}
      const picked = pickerManualFindPlayerByInput(m);
      MS.openTowerPlayerEditModal?.(baseId, picked?.id || '');
      const edit = document.getElementById('towerPlayerEditModal');
      if (m && edit) {
        edit.querySelector('#tpeName').value = m.querySelector('#pickerManualName')?.value || '';
        edit.querySelector('#tpeAlly').value = m.querySelector('#pickerManualAlly')?.value || '';
        edit.querySelector('#tpeRole').value = m.querySelector('#pickerManualRole')?.value || 'Fighter';
        edit.querySelector('#tpeTier').value = m.querySelector('#pickerManualTier')?.value || 'T10';
        edit.querySelector('#tpeMarch').value = m.querySelector('#pickerManualMarch')?.value || '';
        if (edit.querySelector('#tpeRally')) edit.querySelector('#tpeRally').value = m.querySelector('#pickerManualRally')?.value || '';
        edit.dataset.forceAssignKind = assignKind || '';
        const sub = edit.querySelector('#tpeSubtitle');
        if (sub && !edit.dataset.playerId) {
          sub.textContent = assignKind === 'captain' ? t('new_captain_in_turret', 'Новий капітан у турель') : t('new_helper_in_turret', 'Новий помічник у турель');
        }
      }
      try { const em = document.getElementById('towerPlayerEditModal'); if (em) em.style.zIndex = '80000'; } catch {}
    }

    document.addEventListener('click', (e) => {
      const openSettingsBtn = e.target.closest('#openSettingsBtn,[data-open-settings],a[href="#settings-modal"]');
      if (openSettingsBtn) {
        try { const calc = document.getElementById('towerCalcModal'); if (calc?.classList.contains('is-open')) calc.style.zIndex = '95000'; } catch {}
        setTimeout(() => {
          try {
            const sm = document.getElementById('settings-modal');
            if (sm) { sm.style.zIndex = '160000'; sm.classList.add('is-open'); }
            MS.syncBodyModalLock?.();
          } catch {}
        }, 0);
      }
      const btnShow = e.target.closest('#showAllTowersBtn,[data-action="show-all-towers"]');
      if (btnShow) { e.preventDefault(); MS.showAllTowers?.(); return; }

      const btnFocus = e.target.closest('#focusCurrentTowerBtn,#hideOtherTowersBtn,[data-action="focus-current-tower"]');
      if (btnFocus) { e.preventDefault(); MS.focusCurrentTower?.(); return; }

      const btnToggle = e.target.closest('#toggleTowerFocusBtn,[data-action="toggle-towers-view"]');
      if (btnToggle) {
        e.preventDefault();
        if ((state.towerViewMode || 'all') === 'focus') MS.showAllTowers?.();
        else MS.focusCurrentTower?.();
        return;
      }

      const btnPick = e.target.closest('#openTowerPickerBtn,[data-action="open-tower-picker"]');
      if (btnPick) { e.preventDefault(); try { if (!state._pnsShiftForcedOnce) { state._pnsShiftForcedOnce = true; PNS.applyShiftFilter?.('shift1'); } } catch {} refreshTowerPickerLauncherUI(); MS.openTowerPickerModal?.(); return; }

      const btnOpenPickerBaseFallback = e.target.closest('.base-card .captain-col button, .base-card .captain-col-right button');
      if (btnOpenPickerBaseFallback && !btnOpenPickerBaseFallback.closest('#towerPickerModal')) {
        const txt = (btnOpenPickerBaseFallback.textContent || '').toLowerCase();
        const looksLikeEditTower = /edit tower|редагувати турель/.test(txt);
        if (looksLikeEditTower && !btnOpenPickerBaseFallback.matches('[data-open-picker-base]')) {
          e.preventDefault();
          const card = btnOpenPickerBaseFallback.closest('.base-card');
          const baseId = card?.dataset?.baseId || card?.dataset?.baseid || '';
          if (baseId) state.towerPickerSelectedBaseId = baseId;
          try { if (baseId) MS.focusTowerById?.(baseId); } catch {}
          refreshTowerPickerLauncherUI();
          MS.openTowerPickerModal?.();
          setTimeout(() => { try { MS.refreshTowerPickerModalList?.(); MS.updateTowerPickerDetail?.(); MS.syncSettingsTowerPreview?.(); } catch {} }, 30);
          return;
        }
      }

      const btnOpenPickerBase = e.target.closest('[data-open-picker-base]');
      if (btnOpenPickerBase) {
        refreshTowerPickerLauncherUI();
        e.preventDefault();
        let baseId = btnOpenPickerBase.dataset.openPickerBase || '';
        if (!baseId) {
          const card = btnOpenPickerBase.closest('.base-card');
          baseId = card?.dataset?.baseId || card?.dataset?.baseid || '';
        }
        if (baseId) state.towerPickerSelectedBaseId = baseId;
        try { if (baseId) MS.focusTowerById?.(baseId); } catch {}
        MS.openTowerPickerModal?.();
        setTimeout(() => { try { MS.refreshTowerPickerModalList?.(); MS.updateTowerPickerDetail?.(); } catch {} }, 20);
        return;
      }

      const previewTower = e.target.closest('.shift-towers-preview .tower-thumb-card, .shift-towers-preview [data-preview-slot]');
      if (previewTower) {
        e.preventDefault();
        MS.focusTowerFromPreviewElement?.(previewTower);
        return;
      }

      const focusPrev = e.target.closest('#focusTowerPrevBtn');
      if (focusPrev) {
        e.preventDefault();
        const sel = document.getElementById('focusTowerSelect');
        if (sel && sel.options.length) {
          sel.selectedIndex = (sel.selectedIndex <= 0 ? sel.options.length - 1 : sel.selectedIndex - 1);
          MS.handleFocusSelect?.(sel);
        }
        return;
      }
      const focusNext = e.target.closest('#focusTowerNextBtn');
      if (focusNext) {
        e.preventDefault();
        const sel = document.getElementById('focusTowerSelect');
        if (sel && sel.options.length) {
          sel.selectedIndex = (sel.selectedIndex >= sel.options.length - 1 ? 0 : sel.selectedIndex + 1);
          MS.handleFocusSelect?.(sel);
        }
        return;
      }

      const pickItem = e.target.closest('[data-pick-tower-id]');
      if (pickItem) {
        e.preventDefault();
        state.towerPickerSelectedBaseId = pickItem.dataset.pickTowerId;
        const sel = document.getElementById('focusTowerSelect');
        const id = pickItem.dataset.pickTowerId;
        let switched = false;
        if (sel && Array.from(sel.options || []).some(o => String(o.value) === String(id))) {
          sel.value = id;
          try { MS.handleFocusSelect?.(sel); switched = true; } catch {}
        }
        if (!switched) MS.focusTowerById?.(id);
        MS.refreshTowerPickerModalList?.();
        MS.updateTowerPickerDetail?.();
        MS.syncSettingsTowerPreview?.();
        return;
      }

      if (e.target.closest('[data-close-tower-picker]')) {
        e.preventDefault();
        document.getElementById('towerPickerModal')?.classList.remove('is-open');
        MS.syncBodyModalLock?.();
        return;
      }

      const pickerSetCaptain = e.target.closest('[data-picker-set-captain]');
      if (pickerSetCaptain) {
        e.preventDefault();
        const baseId = pickerSetCaptain.dataset.pickerSetCaptain;
        const root = towerPickerScopeRoot(pickerSetCaptain);
        setActiveTowerPickerScope(root);
        syncPickerFlagsFromScope(root);
        syncPickerRuleFromScope(baseId, root);
        const sel = root?.querySelector?.('#towerPickerCaptainSelect');
        if (!sel?.value) { alert(t('choose_captain_first', 'Оберіть капітана')); return; }
        try {
          const sk = towerPickerScopeShift(pickerSetCaptain);
          if (pickerSetCaptain.closest('#towerCalcModal') && MS.applyShiftFilter && String(state.activeShift || '') !== String(sk || '')) MS.applyShiftFilter(sk);
        } catch {}
        try { PNS.assignPlayerToBase?.(sel.value, baseId, 'captain'); } catch {}
        MS.saveCurrentShiftPlanSnapshot?.();
        saveTowerTableNow('captain');
        setTimeout(() => { try { MS.maybeAdvanceFocusedTower?.(); } catch {} refreshTowerPickerScope(root); }, 60);
        return;
      }

      const pickerAuto = e.target.closest('[data-picker-autofill]');
      if (pickerAuto) {
        e.preventDefault();
        const root = towerPickerScopeRoot(pickerAuto);
        const baseId = pickerAuto.dataset.pickerAutofill;
        setActiveTowerPickerScope(root);
        syncPickerFlagsFromScope(root);
        syncPickerRuleFromScope(baseId, root);
        try {
          const sk = towerPickerScopeShift(pickerAuto);
          if (pickerAuto.closest('#towerCalcModal') && MS.applyShiftFilter && String(state.activeShift || '') !== String(sk || '')) MS.applyShiftFilter(sk);
        } catch {}
        try { PNS.autoFillBase?.(baseId); } catch {}
        MS.saveCurrentShiftPlanSnapshot?.();
        saveTowerTableNow('autofill');
        setTimeout(() => { try { MS.maybeAdvanceFocusedTower?.(); } catch {} refreshTowerPickerScope(root); }, 60);
        return;
      }

      const pickerClrH = e.target.closest('[data-picker-clear-helpers]');
      if (pickerClrH) {
        e.preventDefault();
        const root = towerPickerScopeRoot(pickerClrH);
        setActiveTowerPickerScope(root);
        syncPickerFlagsFromScope(root);
        try { const sk = towerPickerScopeShift(pickerClrH); if (pickerClrH.closest('#towerCalcModal') && MS.applyShiftFilter && String(state.activeShift || '') !== String(sk || '')) MS.applyShiftFilter(sk); } catch {}
        try { PNS.clearBase?.(pickerClrH.dataset.pickerClearHelpers, true); } catch {}
        saveTowerTableNow(t('helpers_cleared', 'очищення помічників'));
        setTimeout(() => { refreshTowerPickerScope(root); }, 40);
        return;
      }

      const pickerClrB = e.target.closest('[data-picker-clear-base]');
      if (pickerClrB) {
        e.preventDefault();
        const root = towerPickerScopeRoot(pickerClrB);
        setActiveTowerPickerScope(root);
        syncPickerFlagsFromScope(root);
        try { const sk = towerPickerScopeShift(pickerClrB); if (pickerClrB.closest('#towerCalcModal') && MS.applyShiftFilter && String(state.activeShift || '') !== String(sk || '')) MS.applyShiftFilter(sk); } catch {}
        try { PNS.clearBase?.(pickerClrB.dataset.pickerClearBase, false); } catch {}
        saveTowerTableNow(t('turret_cleared', 'очищення турелі'));
        setTimeout(() => { refreshTowerPickerScope(root); }, 40);
        return;
      }

      const pickerSaveBoard = e.target.closest('[data-picker-save-board]');
      if (pickerSaveBoard) {
        e.preventDefault();
        const root = towerPickerScopeRoot(pickerSaveBoard);
        setActiveTowerPickerScope(root);
        saveTowerTableNow(t('saved_manually', 'вручну'));
        setTimeout(() => { refreshTowerPickerScope(root); }, 20);
        return;
      }

      const pickerFocusRight = e.target.closest('[data-picker-focus-right]');
      if (pickerFocusRight) {
        e.preventDefault();
        MS.focusTowerById?.(pickerFocusRight.dataset.pickerFocusRight);
        document.getElementById('towerPickerModal')?.classList.remove('is-open');
        MS.syncBodyModalLock?.();
        return;
      }


      const pickerResetRule = e.target.closest('[data-picker-reset-rule]');
      if (pickerResetRule) {
        e.preventDefault();
        const root = towerPickerScopeRoot(pickerResetRule);
        setActiveTowerPickerScope(root);
        root?.querySelectorAll?.('[data-picker-tier]').forEach(inp => { inp.value = '0'; });
        return;
      }

      const pickerSaveRule = e.target.closest('[data-picker-save-rule]');
      if (pickerSaveRule) {
        e.preventDefault();
        const baseId = pickerSaveRule.dataset.pickerSaveRule;
        const root = towerPickerScopeRoot(pickerSaveRule);
        const shiftKey = towerPickerScopeShift(pickerSaveRule);
        const maxHelpers = Number(root?.querySelector('#pickerMaxHelpers')?.value || 29) || 29;
        const tierMinMarch = {};
        root?.querySelectorAll?.('[data-picker-tier]').forEach(inp => { tierMinMarch[inp.dataset.pickerTier] = Number(inp.value || 0) || 0; });
        try { PNS.setBaseTowerRule?.(baseId, { maxHelpers, tierMinMarch }, { shift: shiftKey, persist: true, rerender: true }); } catch {}
        setTimeout(() => { refreshTowerPickerScope(root); }, 40);
        return;
      }

      const pickerRecalcRule = e.target.closest('[data-picker-recalc-rule]');
      if (pickerRecalcRule) {
        e.preventDefault();
        const baseId = pickerRecalcRule.dataset.pickerRecalcRule;
        const root = towerPickerScopeRoot(pickerRecalcRule);
        const shiftKey = towerPickerScopeShift(pickerRecalcRule);
        const maxHelpers = Number(root?.querySelector('#pickerMaxHelpers')?.value || 29) || 29;
        const tierMinMarch = {};
        root?.querySelectorAll?.('[data-picker-tier]').forEach(inp => { tierMinMarch[inp.dataset.pickerTier] = Number(inp.value || 0) || 0; });
        try { PNS.setBaseTowerRule?.(baseId, { maxHelpers, tierMinMarch }, { shift: shiftKey, persist: true, rerender: false }); } catch {}
        let recalc = null;
        try { recalc = window.calcRecalculateTowerComposition?.(baseId, shiftKey) || null; } catch {}
        try {
          const free = Number(recalc?.free || 0) || 0;
          PNS.setImportStatus?.(`${t('turret_recalculated_free', 'Склад турелі перераховано. Вільне місце')}: ${free.toLocaleString('en-US')}.`, 'good');
        } catch {}
        setTimeout(() => { refreshTowerPickerScope(root); }, 40);
        return;
      }

      const pickerAddManualCaptain = e.target.closest('[data-picker-add-manual-captain]');
      if (pickerAddManualCaptain) {
        e.preventDefault();
        seedTowerEditModalFromManual(pickerAddManualCaptain.dataset.pickerAddManualCaptain, 'captain', towerPickerScopeRoot(pickerAddManualCaptain));
        return;
      }

      const pickerAddManual = e.target.closest('[data-picker-add-manual]');
      if (pickerAddManual) {
        e.preventDefault();
        seedTowerEditModalFromManual(pickerAddManual.dataset.pickerAddManual, 'helper', towerPickerScopeRoot(pickerAddManual));
        return;
      }

      const pickerEditPlayer = e.target.closest('[data-picker-edit-player]');
      if (pickerEditPlayer) {
        e.preventDefault();
        try { const sk = towerPickerScopeShift(pickerEditPlayer); if (pickerEditPlayer.closest('#towerCalcModal') && MS.applyShiftFilter && String(state.activeShift || '') !== String(sk || '')) MS.applyShiftFilter(sk); } catch {}
        MS.openTowerPlayerEditModal?.(pickerEditPlayer.dataset.pickerEditBase, pickerEditPlayer.dataset.pickerEditPlayer);
        try { const em = document.getElementById('towerPlayerEditModal'); if (em) { em.style.zIndex = '80000'; em.dataset.forceAssignKind = ''; } } catch {}
        return;
      }

      const editAssigned = e.target.closest('[data-edit-assigned-player]');
      if (editAssigned) {
        e.preventDefault();
        const baseId = editAssigned.dataset.baseId || editAssigned.dataset.editBaseId || '';
        const playerId = editAssigned.dataset.editAssignedPlayer || '';
        if (baseId && playerId) MS.openTowerPlayerEditModal?.(baseId, playerId);
        try { const em = document.getElementById('towerPlayerEditModal'); if (em) { em.style.zIndex = '80000'; em.dataset.forceAssignKind = ''; } } catch {}
        return;
      }

      if (e.target.closest('[data-close-tower-player-edit]')) {
        e.preventDefault();
        MS.closeTowerPlayerEditModal?.();
        return;
      }

      const tpeSave = e.target.closest('#tpeSaveBtn');
      if (tpeSave) { e.preventDefault(); MS.saveTowerPlayerEditModal?.(); return; }

      const tpeRemove = e.target.closest('#tpeRemoveBtn');
      if (tpeRemove) {
        e.preventDefault();
        const em = document.getElementById('towerPlayerEditModal');
        const baseId = em?.dataset.baseId || '';
        const playerId = em?.dataset.playerId || '';
        if (baseId && playerId) { try { PNS.removePlayerFromSpecificBase?.(baseId, playerId); } catch {} }
        em?.classList.remove('is-open');
        if (!document.getElementById('towerPickerModal')?.classList.contains('is-open')) MS.syncBodyModalLock?.();
        setTimeout(() => { MS.refreshTowerPickerModalList?.(); MS.updateTowerPickerDetail?.(); MS.syncSettingsTowerPreview?.(); }, 40);
        return;
      }

      const btnAutoAll = e.target.closest('#autoFillAllBasesBtn');
      if (btnAutoAll) {
        e.preventDefault();
        try { PNS.autoFillAllVisibleBases?.(); } catch {}
        MS.saveCurrentShiftPlanSnapshot?.();
        setTimeout(() => { MS.maybeAdvanceFocusedTower?.(); MS.syncFocusedTowerSelect?.(); MS.syncSettingsTowerPreview?.(); }, 30);
        return;
      }

      const btnClearShift = e.target.closest('#clearCurrentShiftBtn');
      if (btnClearShift) {
        e.preventDefault();
        MS.clearCurrentShiftPlan?.();
        setTimeout(() => { MS.syncSettingsTowerPreview?.(); }, 50);
        return;
      }
    });


    document.addEventListener('keydown', (e) => {
      const tgt = e.target;
      if (!tgt) return;
      const preview = tgt.closest?.('.shift-towers-preview .tower-thumb-card');
      if (!preview) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      MS.focusTowerFromPreviewElement?.(preview);
    });


    document.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-shift-tab]');
      if (!tab) return;
      const rerun = () => {
        try { MS.syncSettingsTowerPreview?.(); } catch {}
        try {
          if (document.getElementById('towerPickerModal')?.classList.contains('is-open')) {
            MS.refreshTowerPickerModalList?.();
            MS.updateTowerPickerDetail?.();
          }
        } catch {}
      };
      setTimeout(rerun, 30);
      setTimeout(rerun, 120);
      setTimeout(rerun, 260);
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#openBoardFromSettingsColBtn,#openBoardBtnSettings,#openBoardBtnFromSettings,[data-action="open-board"]');
      if (!btn) return;
      e.preventDefault();
      try { e.stopPropagation(); e.stopImmediatePropagation?.(); } catch {}
      try { PNS.ensureBoardLanguagePickerHosts?.(); } catch {}
      try { PNS.openModal?.('board'); } catch {}
      try { PNS.renderBoard?.(); } catch {}
      try { PNS.syncBoardLanguageSelects?.(); } catch {}
      try { PNS.ensureBoardLanguagePickerHosts?.(); } catch {}
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#openTowerCalcBtnMobile,[data-action="open-tower-calc"]');
      if (!btn) return;
      e.preventDefault();
      openTowerCalculatorModal();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-close-tower-calc]')) return;
      e.preventDefault();
      closeTowerCalculatorModal();
    });

    document.addEventListener('change', (e) => {
      const row = e.target.closest?.('[data-calc-row]');
      const modal = document.getElementById('towerCalcModal');
      if (row && modal) {
        if (e.target.matches('[data-calc-captain]')) {
          const id = String(e.target.value || '');
          const p = (state.playerById?.get?.(id)) || (state.players || []).find(x => String(x.id) === id);
          if (p) {
            const troopSel = row.querySelector('[data-calc-troop]');
            const helpersInp = row.querySelector('[data-calc-helpers]');
            if (troopSel && !troopSel.dataset.touched) troopSel.value = roleNorm(p.role) || troopSel.value || 'fighter';
            if (helpersInp && !String(helpersInp.value || '').trim()) helpersInp.value = '15';
          }
        }
        computeTowerCalcResults();
        return;
      }
      if (modal && e.target.closest('#towerCalcNoCrossShift,#towerCalcBoth50,#towerCalcIgnoreBoth,#towerCalcMinHelpersOn,#towerCalcTierAuto,#towerCalcCompactMode,#towerCalcModeUi,#towerCalcApplyModeUi,#towerCalcMinHelpersCount')) { 
        const tcNow = getCalcState();
        if (e.target.closest('#towerCalcTierAuto')) {
          tcNow.tierSizeMode = (modal?.querySelector('#towerCalcTierAuto')?.checked) ? 'auto' : 'manual';
          calcApplyTierTargetInputsState(modal, tcNow);
        }
        if (e.target.closest('#towerCalcCompactMode')) {
          tcNow.compactMode = !!modal?.querySelector('#towerCalcCompactMode')?.checked;
          modal.classList.toggle('is-compact', !!tcNow.compactMode);
        }
        computeTowerCalcResults(); return; }
    });

    document.addEventListener('input', (e) => {
      const modal = document.getElementById('towerCalcModal');
      if (!modal) return;
      if (e.target.matches('[data-calc-helpers]')) { computeTowerCalcResults(); return; }
      if (e.target.matches('[data-calc-max-march-base]')) { computeTowerCalcResults(); return; }
      if (e.target.matches('[data-calc-troop]')) { e.target.dataset.touched = '1'; computeTowerCalcResults(); return; }
      if (e.target.matches('#towerCalcMinHelpersCount')) { computeTowerCalcResults(); return; }
      if (e.target.matches('[data-calc-tier-target]')) { 
        const modal = document.getElementById('towerCalcModal');
        if (modal) {
          const autoCb = modal.querySelector('#towerCalcTierAuto');
          if (autoCb?.checked) autoCb.checked = false;
        }
        computeTowerCalcResults(); return; 
      }
    });


    document.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('[data-calc-main-tab]');
      if (!tabBtn) return;
      const modal = document.getElementById('towerCalcModal');
      if (!modal || !modal.contains(tabBtn)) return;
      e.preventDefault();
      const tc = getCalcState();
      tc.mainTab = calcApplyMainTabUI(modal, tabBtn.getAttribute('data-calc-main-tab') || 'setup');
      try { localStorage.setItem('pns_tower_calc_state', JSON.stringify(tc)); } catch {}
    });

    document.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('[data-calc-tab]');
      if (!tabBtn) return;
      const modal = document.getElementById('towerCalcModal');
      if (!modal || !modal.contains(tabBtn)) return;
      e.preventDefault();
      const tc = getCalcState();
      tc.activeTab = calcApplyActiveTabUI(modal, tabBtn.getAttribute('data-calc-tab') || 'shift1');
      try { if (MS.applyShiftFilter && String(state.activeShift || '') !== String(tc.activeTab || '')) MS.applyShiftFilter(tc.activeTab); } catch {}
      try { localStorage.setItem('pns_tower_calc_state', JSON.stringify(tc)); } catch {}
      try { window.calcRenderInlineTowerSettings?.(modal); } catch {}
      try { window.calcRenderLiveFinalBoard?.(modal); } catch {}
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-calc-preview-shift],[data-calc-preview-export],[data-calc-preview-share],[data-calc-inline-base]');
      if (!btn) return;
      const modal = document.getElementById('towerCalcModal');
      if (!modal || !modal.contains(btn)) return;
      e.preventDefault();
      if (btn.matches('[data-calc-inline-base]')) {
        try { window.calcSetInlineSelectedBaseId?.(btn.getAttribute('data-calc-shift') || 'shift1', btn.getAttribute('data-calc-inline-base') || ''); } catch {}
        try { window.calcRenderInlineTowerSettings?.(modal); } catch {}
        return;
      }
      if (btn.matches('[data-calc-preview-shift]')) {
        try { window.calcSetPreviewShift?.(btn.getAttribute('data-calc-preview-shift') || 'shift2'); } catch {}
        try { window.calcRenderLiveFinalBoard?.(modal); } catch {}
        return;
      }
      if (btn.matches('[data-calc-preview-export]')) { try { window.calcExportPreviewBoardPng?.(); } catch {} return; }
      if (btn.matches('[data-calc-preview-share]')) { try { window.calcSharePreviewBoard?.(); } catch {} return; }
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#towerCalcRecalcBtn,#towerCalcFitBtn,#towerCalcApplyToTowersBtn,#towerCalcQuickApplyBtn,#towerCalcLoadCaptainsBtn,#towerCalcApplyAndAssignBtn,#towerCalcAutoFitBtn');
      if (!btn) return;
      e.preventDefault();
      if (btn.matches('#towerCalcLoadCaptainsBtn')) { calcSyncCaptainsFromTowersIntoCalculator({ keepHelpers: true }); return; }
      if (btn.matches('#towerCalcAutoFitBtn')) { try { calcAutoFitTowersStrict(); } catch {} return; }
      if (btn.matches('#towerCalcApplyToTowersBtn')) { applyTowerCalcToTowerSettings(); return; }
      if (btn.matches('#towerCalcQuickApplyBtn')) { applyTowerCalcAssignmentsToTowers(); return; }
      if (btn.matches('#towerCalcApplyAndAssignBtn')) { applyTowerCalcAssignmentsToTowers(); return; }
      computeTowerCalcResults();
    });

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-calc-edit-base],[data-calc-pick-overflow-base],[data-calc-manual-base],[data-calc-lock-tower],[data-calc-toggle-exclude],[data-calc-toggle-lock-helper],[data-calc-reserve]');
  if (!btn) return;
  e.preventDefault();
  if (btn.matches('[data-calc-lock-tower]')) {
    calcToggleTowerLocked(btn.getAttribute('data-calc-lock-tower') || '');
    computeTowerCalcResults();
    return;
  }
  if (btn.matches('[data-calc-toggle-exclude]')) {
    calcToggleHelperExcluded(btn.getAttribute('data-calc-toggle-exclude') || '');
    computeTowerCalcResults();
    return;
  }
  if (btn.matches('[data-calc-toggle-lock-helper]')) {
    calcToggleHelperLockedToBase(btn.getAttribute('data-calc-toggle-lock-helper') || '', btn.getAttribute('data-base-id') || '');
    computeTowerCalcResults();
    return;
  }
  if (btn.matches('[data-calc-reserve]')) {
    const pid = btn.getAttribute('data-calc-reserve') || '';
    const sk = btn.getAttribute('data-reserve-shift') || '';
    const tc = getCalcState();
    const cur = String((tc?.overflowReserve && tc.overflowReserve[String(pid)]) || '');
    calcSetOverflowReserve(pid, cur === sk ? '' : sk);
    computeTowerCalcResults();
    return;
  }
  const baseId = String(btn.getAttribute('data-calc-edit-base') || btn.getAttribute('data-calc-pick-overflow-base') || btn.getAttribute('data-calc-manual-base') || '');
  const shiftKey = String(btn.getAttribute('data-calc-shift') || '');
  if (!baseId) return;
  calcOpenTowerPickerForBase(baseId, shiftKey);
  if (btn.matches('[data-calc-manual-base]')) {
    setTimeout(() => {
      try {
        const m = document.getElementById('towerPickerModal');
        const inp = m?.querySelector?.('#pickerManualName, #pickerManualSearch');
        inp?.focus?.();
      } catch {}
    }, 80);
  }
});

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-calc-open-base]');
      if (!btn) return;
      e.preventDefault();
      const baseId = String(btn.getAttribute('data-calc-open-base') || '');
      const shiftKey = String(btn.getAttribute('data-calc-shift') || '');
      calcOpenTowerPickerForBase(baseId, shiftKey);
    });

    document.addEventListener('click', (e) => {
      const card = e.target.closest('.bases-grid .base-card');
      if (!card) return;
      const baseId = String(card.dataset.baseId || card.dataset.baseid || '');
      try {
        if (baseId && typeof window.calcSetInlineSelectedBaseId === 'function') {
          window.calcSetInlineSelectedBaseId(String(state.activeShift || 'shift1'), baseId);
        }
      } catch {}
      try {
        if (baseId && typeof MS.focusTowerById === 'function') MS.focusTowerById(baseId);
        else MS.markFocusedCard?.(card);
      } catch {}
      setTimeout(() => {
        try { MS.syncSettingsTowerPreview?.(); } catch {}
        try {
          const calc = document.getElementById('towerCalcModal');
          if (calc?.classList.contains('is-open')) {
            window.calcRenderInlineTowerSettings?.(calc);
            window.calcRenderLiveFinalBoard?.(calc);
            window.calcUpdateShiftStatsUI?.(calc);
          }
        } catch {}
      }, 20);
    });

    document.addEventListener('change', (e) => {
      const sel = e.target.closest('.row-actions select');
      if (!sel) return;
      const baseId = sel.value;
      if (!baseId) return;
      state.focusedBaseId = baseId;
      const esc = (window.CSS && CSS.escape) ? CSS.escape(baseId) : String(baseId).replace(/"/g, '\\"');
      const card = document.querySelector(`.bases-grid .base-card[data-base-id="${esc}"]`) ||
                   document.querySelector(`.bases-grid .base-card[data-baseid="${esc}"]`);
      if (card) { MS.markFocusedCard?.(card); setTimeout(() => MS.syncSettingsTowerPreview?.(), 20); }
      if ((state.towerViewMode || 'all') === 'focus') setTimeout(() => MS.applyTowerVisibilityMode?.(), 0);
      setTimeout(() => MS.syncSettingsTowerPreview?.(), 20);
    });

    document.addEventListener('change', (e) => {
      const sel = e.target.closest('#focusTowerSelect');
      if (!sel) return;
      e.preventDefault?.();
      MS.handleFocusSelect?.(sel);
      setTimeout(() => MS.syncSettingsTowerPreview?.(), 20);
    });
    document.addEventListener('change', (e) => {
      const cb = e.target.closest('#pickerOnlyCaptains,#pickerMatchRegisteredShift,#pickerNoMixTroops,#pickerNoCrossShiftDupes');
      if (!cb) return;
      const root = towerPickerScopeRoot(cb);
      syncPickerFlagsFromScope(root);
      refreshTowerPickerScope(root);
    });
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (!t || t.id !== 'pickerManualSearch') return;
      const root = towerPickerScopeRoot(t);
      const q = String(t.value || '').trim();
      if (!q) { pickerManualClearMatchHint(root); return; }
      clearTimeout(state._pickerManualSearchTimer);
      state._pickerManualSearchTimer = setTimeout(() => {
        try {
          const matches = pickerManualSearchMatches(root);
          const hint = root?.querySelector?.('#pickerManualHint');
          if (hint) hint.textContent = matches.length > 1 ? `${t('multiple_matches_choose_exact', 'Знайдено кілька')} (${matches.length}) — ${t('choose_exact_nick', 'вибери точний нік зі списку')}.` : (matches.length === 1 ? `${t('found_one_choose_enter', 'Знайдено 1 — вибери зі списку / Enter')}` : '');
        } catch {}
      }, 120);
    });
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (!t || t.id !== 'pickerManualName') return;
      t.dataset.autoFilled = '0';
    });

document.addEventListener('change', (e) => {
  const t = e.target;
  if (!t || t.id !== 'pickerManualSearch') return;
  try { pickerManualTryAutofill(towerPickerScopeRoot(t)); } catch {}
});


    document.addEventListener('keydown', (e) => {
      const t = e.target;
      if (!t || t.id !== 'pickerManualSearch') return;
      if (e.key !== 'Enter') return;
      e.preventDefault();
      try { pickerManualTryAutofill(towerPickerScopeRoot(t)); } catch {}
    });
    document.addEventListener('input', (e) => {
      const sel = e.target.closest('#focusTowerSelect');
      if (!sel) return;
      MS.handleFocusSelect?.(sel);
      setTimeout(() => MS.syncSettingsTowerPreview?.(), 20);
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.row-actions .btn, [data-base-remove-player]');
      if (!btn) return;
      const txt = (btn.textContent || '').toLowerCase();
      const act = btn.dataset.baseEditorAction || '';
      if (!/captain|helper|clear|remove/.test(txt) && !['captain', 'helper', 'remove'].includes(act)) return;
      setTimeout(() => { try { MS.maybeAdvanceFocusedTower?.(); } catch {} }, 30);
    });

    document.addEventListener('pns:assignment-changed', (ev) => {
      setTimeout(() => {
        try { if (ev?.detail?.baseId) state.focusedBaseId = ev.detail.baseId; } catch {}
        try { MS.maybeAdvanceFocusedTower?.(); } catch {}
        try { MS.syncFocusedTowerSelect?.(); } catch {}
        try { MS.refreshTowerPickerModalList?.(); MS.updateTowerPickerDetail?.(); } catch {}
        try { MS.syncSettingsTowerPreview?.(); } catch {}
        try { refreshTowerPickerLauncherUI(); } catch {}
        try {
          const calc = document.getElementById('towerCalcModal');
          if (calc?.classList.contains('is-open')) {
            window.calcRenderInlineTowerSettings?.(calc);
            window.calcRenderLiveFinalBoard?.(calc);
            window.calcUpdateShiftStatsUI?.(calc);
          }
        } catch {}
      }, 40);
    });
  }


  function refreshTowerPickerLauncherUI() {
    try {
      const openBtn = document.getElementById('openTowerPickerBtn');
      if (openBtn) openBtn.textContent = t('tower_settings', 'Налаштування турелей');
      const wrap = document.querySelector('.settings-focus-inline');
      if (wrap) wrap.style.display = 'none';
      const prev = document.getElementById('focusTowerPrevBtn');
      const next = document.getElementById('focusTowerNextBtn');
      const sel = document.getElementById('focusTowerSelect');
      if (prev) prev.style.display = 'none';
      if (next) next.style.display = 'none';
      if (sel) sel.style.display = 'none';
    } catch {}
  }

  function resyncUIAfterSwap() {
    MS.ensureStep4Styles?.();
    refreshTowerPickerLauncherUI();

    if (PNS.modals) {
      const m = MS.getModals();
      PNS.modals.settings = m.settings;
      PNS.modals.board = m.board;
    }
    if (PNS.shiftTabs && Array.isArray(PNS.shiftTabs)) {
      PNS.shiftTabs.length = 0;
      PNS.shiftTabs.push(...MS.getShiftTabs());
    }

    if (typeof state.showAllColumns !== 'boolean') state.showAllColumns = false;
    MS.applyColumnVisibility?.(!!state.showAllColumns);
    MS.updateShiftTabButtons?.();
    MS.updateBoardTitle?.();
    bindSettingsAndTowerButtonsOnce();

    if (typeof state.autoAdvanceTowerOnAssign !== 'boolean') state.autoAdvanceTowerOnAssign = false;
    // Do not force focus mode on refresh/HTMX swaps (it hides the right panel and causes apparent flicker).
    state.towerViewMode = state.towerViewMode || 'all';
    setTimeout(() => {
      try {
        if ((state.towerViewMode || 'all') === 'focus') MS.applyTowerVisibilityMode?.();
        else MS.showAllTowers?.();
      } catch {}
      try { MS.syncTowerViewToggleButton?.(); } catch {}
      try { MS.syncFocusedTowerSelect?.(); } catch {}
      try { MS.syncSettingsTowerPreview?.(); } catch {}
    }, 0);

    if (state.activeModal) {
      const modal = MS.getModals()[state.activeModal];
      if (modal) modal.classList.add('is-open');
    }
  }

  function scheduleResyncUIAfterSwap() {
    if (state._modalsResyncScheduled) return;
    state._modalsResyncScheduled = true;
    setTimeout(() => {
      state._modalsResyncScheduled = false;
      resyncUIAfterSwap();
    }, 30);
  }

  function exposeLegacyPNSApi() {
    PNS.openModal = MS.openModal;
    PNS.closeModal = MS.closeModal;
    PNS.applyColumnVisibility = MS.applyColumnVisibility;
    PNS.toggleColumns = MS.toggleColumns;
    PNS.matchesShift = MS.matchesShift;
    PNS.applyShiftFilter = MS.applyShiftFilter;
    PNS.handleShiftTabClick = MS.handleShiftTabClick;
    PNS.showAllTowers = MS.showAllTowers;
    PNS.focusCurrentTower = MS.focusCurrentTower;
    PNS.showAllTowers = MS.showAllTowers;
    PNS.toggleTowerFocusMode = () => ((state.towerViewMode || 'all') === 'focus' ? MS.showAllTowers?.() : MS.focusCurrentTower?.());
    PNS.openTowerCalculatorModal = MS.openTowerCalculatorModal;
    PNS.applyTowerCalcToTowerSettings = MS.applyTowerCalcToTowerSettings;
    PNS.applyTowerCalcAssignmentsToTowers = MS.applyTowerCalcAssignmentsToTowers;
    PNS.calcSyncCaptainsFromTowersIntoCalculator = MS.calcSyncCaptainsFromTowersIntoCalculator;
  }

  function initIfReady() {
    if (MS.__initialized) return true;
    const required = [
      'updateShiftTabButtons', 'updateBoardTitle', 'matchesShift', 'applyShiftFilter', 'handleShiftTabClick',
      'showAllTowers', 'focusCurrentTower', 'applyTowerVisibilityMode', 'syncTowerViewToggleButton',
      'syncFocusedTowerSelect', 'maybeAdvanceFocusedTower', 'markFocusedCard', 'handleFocusSelect',
      'clearCurrentShiftPlan', 'focusTowerById', 'refreshTowerPickerModalList', 'updateTowerPickerDetail',
      'openTowerPickerModal', 'openTowerPlayerEditModal', 'closeTowerPlayerEditModal', 'saveTowerPlayerEditModal',
    ];
    if (required.some((k) => typeof MS[k] !== 'function')) return false;

    exposeLegacyPNSApi();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleResyncUIAfterSwap);
    else scheduleResyncUIAfterSwap();
    setTimeout(() => {
      try { PNS.restoreSessionStateNow?.({ soft: false }); } catch {}
      try { window.PNSI18N?.apply?.(document); } catch {}
    }, 80);
    document.addEventListener('htmx:afterSwap', scheduleResyncUIAfterSwap);
    document.addEventListener('htmx:afterSettle', scheduleResyncUIAfterSwap);
    document.addEventListener('pns:partials:loaded', scheduleResyncUIAfterSwap);
    document.addEventListener('pns:dom:refreshed', () => setTimeout(() => MS.applyTowerVisibilityMode?.(), 0));
    MS.__initialized = true;
    return true;
  }



  Object.assign(MS, {
    bindSettingsAndTowerButtonsOnce,
    resyncUIAfterSwap,
    scheduleResyncUIAfterSwap,
    exposeLegacyPNSApi,
    initIfReady,
  });

  initIfReady();
})();
