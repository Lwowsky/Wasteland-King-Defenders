(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state } = PNS;

  function onClick(selector, handler) {
    document.addEventListener('click', (e) => {
      const el = e.target.closest(selector);
      if (!el) return;
      handler(e, el);
    });
  }

  function clearModalHashIfNeeded() {
    if (location.hash === '#settings-modal' || location.hash === '#board-modal') {
      try { history.replaceState(null, '', location.pathname + location.search); }
      catch { location.hash = ''; }
    }
  }

  function exportBoardAsPNG() {
    const board = document.querySelector('.board-sheet');
    if (!board) return;
    if (typeof window.html2canvas !== 'function') return alert('html2canvas не завантажився.');
    window.html2canvas(board, { backgroundColor: '#ffffff', scale: 2 }).then((canvas) => {
      const a = document.createElement('a');
      const shift = state.activeShift || 'all';
      a.download = `pns-board-${shift}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    }).catch((e) => { console.error(e); alert('Не вдалося згенерувати PNG'); });
  }

  function exportBoardAsPDF() {
    const prevHash = location.hash;
    PNS.openModal?.('board');
    window.print();
    if (prevHash && prevHash !== '#board-modal') {
      try { history.replaceState(null, '', prevHash); } catch {}
    }
  }

  function getDefaultAutoFillSettings() {
    const c = PNS.controls || {};
    return {
      quotas: {
        T14: PNS.clampInt(c.quotaT14?.defaultValue ?? c.quotaT14?.value ?? 0),
        T13: PNS.clampInt(c.quotaT13?.defaultValue ?? c.quotaT13?.value ?? 0),
        T12: PNS.clampInt(c.quotaT12?.defaultValue ?? c.quotaT12?.value ?? 4),
        T11: PNS.clampInt(c.quotaT11?.defaultValue ?? c.quotaT11?.value ?? 3),
        T10: PNS.clampInt(c.quotaT10?.defaultValue ?? c.quotaT10?.value ?? 2),
        T9:  PNS.clampInt(c.quotaT9?.defaultValue ?? c.quotaT9?.value ?? 0),
      },
      maxHelpers: PNS.clampInt(c.maxHelpers?.defaultValue ?? c.maxHelpers?.value ?? 29),
    };
  }

  function initQuotaSettings() {
    const saved = typeof PNS.safeReadJSON === 'function' ? PNS.safeReadJSON(PNS.KEYS.KEY_AUTOFILL_SETTINGS, null) : null;
    const effective = saved || getDefaultAutoFillSettings();
    const c = PNS.controls || {};
    const q = effective?.quotas || {};
    if (c.quotaT14) c.quotaT14.value = PNS.clampInt(q.T14, 0);
    if (c.quotaT13) c.quotaT13.value = PNS.clampInt(q.T13, 0);
    if (c.quotaT12) c.quotaT12.value = PNS.clampInt(q.T12, 4);
    if (c.quotaT11) c.quotaT11.value = PNS.clampInt(q.T11, 3);
    if (c.quotaT10) c.quotaT10.value = PNS.clampInt(q.T10, 2);
    if (c.quotaT9) c.quotaT9.value  = PNS.clampInt(q.T9, 0);
    if (c.maxHelpers) c.maxHelpers.value = PNS.clampInt(effective?.maxHelpers, 29);
    state.autoFillSettings = effective;
    (state.bases || []).forEach((b) => { b.maxHelpers = effective.maxHelpers; PNS.renderQuotaRow?.(b); });
    if (!saved && typeof PNS.safeWriteJSON === 'function') PNS.safeWriteJSON(PNS.KEYS.KEY_AUTOFILL_SETTINGS, effective);
  }

  function dispatchDomRefreshed() {
    try { document.dispatchEvent(new Event('pns:dom:refreshed')); } catch {}
    try { window.dispatchEvent(new Event('pns:dom:refreshed')); } catch {}
  }

  function hasPlayersShell() {
    return !!document.querySelector('#playersDataTable');
  }
  function getPlayersRowsCount() {
    const tbody = document.querySelector('#playersDataTable tbody');
    return tbody ? tbody.querySelectorAll('tr').length : 0;
  }
  function getBaseCards() {
    return Array.from(document.querySelectorAll('.bases-grid .base-card'));
  }
  function getVisibleBaseCards() {
    return getBaseCards().filter((c) => !c.hidden && c.style.display !== 'none');
  }

  function ensurePlayersTableFromState() {
    if (!hasPlayersShell()) return;

    if (typeof PNS.ensurePlayersLinked === 'function') {
      PNS.ensurePlayersLinked();
    } else if (typeof PNS.parsePlayersFromTable === 'function' && (!Array.isArray(state.players) || !state.players.length)) {
      PNS.parsePlayersFromTable();
    }

    // If DOM shell is empty but state exists -> paint table from state
    if (Array.isArray(state.players) && state.players.length && getPlayersRowsCount() === 0) {
      if (typeof PNS.renderPlayersTableFromState === 'function') PNS.renderPlayersTableFromState();
      if (typeof PNS.ensurePlayersLinked === 'function') PNS.ensurePlayersLinked();
      if (typeof PNS.buildRowActions === 'function') PNS.buildRowActions();
    }
  }

  function ensureBasesPanelFromDom() {
    const cards = getBaseCards();
    if (!cards.length) return false;

    // Parse bases if missing/out-of-date after partial swap.
    const needParse = !Array.isArray(state.bases) || !state.bases.length || state.bases.length !== cards.length;
    if (needParse && typeof PNS.parseBasesFromCards === 'function') {
      try { PNS.parseBasesFromCards(); } catch (e) { console.error('[init_bind] parseBasesFromCards failed', e); }
    }

    // If all cards are hidden (focus/filter race), unhide first; shift/focus will re-apply safely.
    const visible = getVisibleBaseCards();
    if (cards.length && visible.length === 0) {
      cards.forEach((c) => { c.hidden = false; c.style.removeProperty('display'); });
      try { document.querySelector('.bases-grid')?.classList?.remove('focus-current-tower'); } catch {}
    }

    // Restore assignments after cards rebind.
    try { PNS.tryRestoreTowersSnapshot?.({ soft: true }); } catch (e) { console.warn('[init_bind] towers soft-restore failed', e); }

    // Render + re-apply shift/focus visibility.
    try { PNS.renderAll?.(); } catch (e) { console.error('[init_bind] renderAll failed', e); }

    const shift = ['shift1','shift2','all'].includes(state.activeShift) ? state.activeShift : 'shift1';
    try { PNS.applyShiftFilter?.(shift); } catch (e) { console.warn('[init_bind] applyShiftFilter failed', e); }
    try { PNS.applyPlayerTableFilters?.(); } catch {}

    // If focus mode accidentally hides all towers, fallback to show all.
    if (getBaseCards().length && getVisibleBaseCards().length === 0) {
      try { PNS.ModalsShift?.showAllTowers?.(); } catch {}
      try { PNS.ModalsShift?.applyTowerVisibilityMode?.(); } catch {}
    }
    try { PNS.ModalsShift?.syncTowerViewToggleButton?.(); } catch {}
    try { PNS.ModalsShift?.syncFocusedTowerSelect?.(); } catch {}

    return true;
  }

  function rebuildFromDom() {
    PNS.refreshDomCache?.();

    ensurePlayersTableFromState();
    ensureBasesPanelFromDom();

    try { initQuotaSettings(); } catch {}
    try { PNS.initImportWizard?.(); } catch {}
    try { PNS.syncTopFilterUI?.(); } catch {}

    if (typeof PNS.applyColumnVisibility === 'function') {
      const showAll = typeof PNS.safeReadBool === 'function' ? PNS.safeReadBool(PNS.KEYS.KEY_SHOW_ALL, false) : false;
      try { PNS.applyColumnVisibility(showAll); } catch {}
    }

    // Re-open modal from hash (if user refreshed on modal hash)
    if (location.hash === '#settings-modal') PNS.openModal?.('settings');
    if (location.hash === '#board-modal') PNS.openModal?.('board');

    dispatchDomRefreshed();
  }

  function scheduleRebuild() {
    if (state._htmxRebuildScheduled) return;
    state._htmxRebuildScheduled = true;
    setTimeout(() => {
      state._htmxRebuildScheduled = false;
      rebuildFromDom();
    }, 0);
  }

  function scheduleBootRecoveryPasses() {
    if (state._bootRecoveryScheduled) return;
    state._bootRecoveryScheduled = true;
    const delays = [0, 50, 150, 300, 600, 1000, 1600, 2400, 3600, 5200, 8000];
    delays.forEach((ms) => {
      setTimeout(() => {
        try {
          const needPlayers = hasPlayersShell() && Array.isArray(state.players) && state.players.length && getPlayersRowsCount() === 0;
          const baseCards = getBaseCards();
          const needBases = baseCards.length && ((!Array.isArray(state.bases) || state.bases.length !== baseCards.length) || getVisibleBaseCards().length === 0);
          if (needPlayers || needBases || (!state.bases?.length && document.querySelector('.bases-grid'))) {
            scheduleRebuild();
          }
        } catch {}
      }, ms);
    });
  }

  function startDomWatchdog() {
    if (state._pnsDomWatchdogStarted) return;
    state._pnsDomWatchdogStarted = true;
    if (typeof MutationObserver !== 'function') return;

    const observer = new MutationObserver((mutations) => {
      let should = false;
      for (const m of mutations) {
        if (m.type !== 'childList') continue;
        for (const n of m.addedNodes || []) {
          if (!n || n.nodeType !== 1) continue;
          const el = n;
          if (
            el.matches?.('#playersDataTable, .bases-grid, .base-card, .base-settings-card, .board-col') ||
            el.querySelector?.('#playersDataTable, .bases-grid, .base-card, .base-settings-card, .board-col')
          ) {
            should = true;
            break;
          }
        }
        if (should) break;
      }
      if (should) {
        scheduleRebuild();
        scheduleBootRecoveryPasses();
      }
    });

    try { observer.observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch {}
    state._pnsDomWatchdog = observer;
  }

  function bindDelegatedOnce() {
    if (state._initBindDelegatedBound) return;
    state._initBindDelegatedBound = true;

    onClick('#openSettingsBtn, #openSettingsBtnMobile, #openImportQuickBtn', (e) => {
      e.preventDefault(); PNS.openModal?.('settings');
    });
    onClick('#openBoardBtn, #openBoardBtnMobile, #settingsFinalBoardBtn, [data-open-board], [data-settings-open-board]', (e) => {
      e.preventDefault(); PNS.openModal?.('board'); PNS.renderBoard?.();
    });
    onClick('#showAllDataBtn, #showAllColumnsBtn', (e) => { e.preventDefault(); PNS.toggleColumns?.(); });
    onClick('#autoFillAllHeaderBtn, #autoFillAllHeaderBtnMobile, #autoFillAllBasesBtn, #settingsAutoFillAllBtn', (e) => { e.preventDefault(); PNS.autoFillAllVisibleBases?.(); });
    onClick('#clearCurrentShiftBtn, #settingsClearCurrentShiftBtn', (e) => { e.preventDefault(); PNS.clearCurrentShiftAssignments?.(); PNS.renderAll?.(); });
    onClick('#exportPngBtn', (e) => { e.preventDefault(); exportBoardAsPNG(); });
    onClick('#exportPdfBtn', (e) => { e.preventDefault(); exportBoardAsPDF(); });

    onClick('#loadUrlMockBtn', (e) => { e.preventDefault(); PNS.handleLoadUrlClick?.(); });
    onClick('#useTemplateMockBtn', (e) => { e.preventDefault(); PNS.handleUseSavedTemplateClick?.(); });
    onClick('#saveVisibleColumnsMockBtn', (e) => { e.preventDefault(); PNS.handleSaveVisibleColumnsClick?.(); });
    onClick('#loadDemoImportBtn', (e) => { e.preventDefault(); PNS.loadDemoIntoImportWizard?.(); });
    onClick('#saveTemplateMockBtn', (e) => { e.preventDefault(); PNS.saveCurrentImportTemplate?.(); });
    onClick('#applyImportMockBtn', (e) => { e.preventDefault(); PNS.applyImportedPlayers?.(); });
    onClick('#detectColumnsMockBtn', (e) => {
      e.preventDefault();
      const url = document.querySelector('#urlInputMock')?.value?.trim() || '';
      const hasHeaders = (state.importData?.headers || []).length > 0;
      if (url && !hasHeaders) PNS.handleLoadUrlClick?.(); else PNS.handleDetectColumns?.();
    });

    onClick('#settingsShowAllBasesBtn, [data-show-all-bases]', (e) => { e.preventDefault(); PNS.showAllBaseCards?.(); });
    onClick('#settingsHideOtherBasesBtn, [data-hide-other-bases]', (e) => { e.preventDefault(); PNS.showOnlyActiveBaseCard?.(); });

    onClick('[data-close-modal]', (e) => { e.preventDefault(); PNS.closeModal?.(); clearModalHashIfNeeded(); });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (state.activeModal || location.hash === '#settings-modal' || location.hash === '#board-modal')) {
        PNS.closeModal?.(); clearModalHashIfNeeded();
      }
    });

    window.addEventListener('hashchange', () => {
      if (location.hash === '#settings-modal') PNS.openModal?.('settings');
      else if (location.hash === '#board-modal') PNS.openModal?.('board');
      else if (!location.hash) PNS.closeModal?.();
    });

    document.addEventListener('change', (e) => {
      if (!e.target.closest('#fileInputMock')) return;
      PNS.handleImportFileChange?.(e);
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-shift-tab]')) PNS.handleShiftTabClick?.(e);
    });

    document.addEventListener('input', (e) => {
      const input = e.target.closest('[data-v4-maxhelpers],[data-v4-tier]'); if (!input) return;
      const card = input.closest('.base-card'); const baseId = card?.dataset?.baseId; if (!baseId) return;
      const base = state.baseById?.get(baseId); if (!base) return;
      const rule = PNS.readBaseEditorSettingsInputs?.(base);
      PNS.setBaseTowerRule?.(baseId, rule, { persist: true, rerender: false });
      PNS.renderQuotaRow?.(base);
    });
    document.addEventListener('change', (e) => {
      const input = e.target.closest('[data-v4-maxhelpers],[data-v4-tier]'); if (!input) return;
      const card = input.closest('.base-card'); const baseId = card?.dataset?.baseId; if (!baseId) return;
      const base = state.baseById?.get(baseId); if (!base) return;
      PNS.setBaseTowerRule?.(baseId, PNS.readBaseEditorSettingsInputs?.(base), { persist: true, rerender: true });
    });

    if (typeof PNS.bindTopFilterEvents === 'function' && !state._topFiltersBoundOnce) {
      PNS.bindTopFilterEvents();
      state._topFiltersBoundOnce = true;
    }
  }

  function init() {
    try { PNS.loadTopFilters?.(); } catch {}
    try { PNS.loadBaseTowerRulesStore?.(); } catch {}
    bindDelegatedOnce();
    startDomWatchdog();
    scheduleRebuild();
    scheduleBootRecoveryPasses();
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', scheduleRebuild);
  document.addEventListener('htmx:afterSwap', scheduleRebuild);
  document.addEventListener('htmx:afterSettle', scheduleRebuild);
  document.addEventListener('pns:partials:loaded', () => { scheduleRebuild(); scheduleBootRecoveryPasses(); });
  window.addEventListener('pns:partials:loaded', () => { scheduleRebuild(); scheduleBootRecoveryPasses(); });
})();
