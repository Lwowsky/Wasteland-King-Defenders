(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state } = PNS;

  // ---------- helpers ----------
  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function onClick(sel, handler) {
    // delegated click (safe for HTMX)
    document.addEventListener('click', (e) => {
      const el = e.target.closest(sel);
      if (!el) return;
      handler(e, el);
    });
  }

  function slug(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'base';
  }

  // --- Quota settings minimal ---
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

  function loadAutoFillSettings() {
    return typeof PNS.safeReadJSON === 'function'
      ? PNS.safeReadJSON(PNS.KEYS.KEY_AUTOFILL_SETTINGS, null)
      : null;
  }

  function saveAutoFillSettings(settings) {
    if (typeof PNS.safeWriteJSON === 'function') PNS.safeWriteJSON(PNS.KEYS.KEY_AUTOFILL_SETTINGS, settings);
  }

  function writeAutoFillSettingsToUI(settings) {
    const c = PNS.controls || {};
    const q = settings?.quotas || {};
    if (c.quotaT14) c.quotaT14.value = PNS.clampInt(q.T14, 0);
    if (c.quotaT13) c.quotaT13.value = PNS.clampInt(q.T13, 0);
    if (c.quotaT12) c.quotaT12.value = PNS.clampInt(q.T12, 4);
    if (c.quotaT11) c.quotaT11.value = PNS.clampInt(q.T11, 3);
    if (c.quotaT10) c.quotaT10.value = PNS.clampInt(q.T10, 2);
    if (c.quotaT9)  c.quotaT9.value  = PNS.clampInt(q.T9, 0);
    if (c.maxHelpers) c.maxHelpers.value = PNS.clampInt(settings?.maxHelpers, 29);
  }

  function initQuotaSettings() {
    const saved = loadAutoFillSettings();
    const defaults = getDefaultAutoFillSettings();
    const effective = saved || defaults;

    writeAutoFillSettingsToUI(effective);

    state.autoFillSettings = effective;
    (state.bases || []).forEach((b) => {
      b.maxHelpers = effective.maxHelpers;
      if (typeof PNS.renderQuotaRow === 'function') PNS.renderQuotaRow(b);
    });

    const qs = PNS.controls?.quotaStatus;
    if (qs) qs.textContent = saved
      ? 'Loaded quota settings from LocalStorage'
      : 'Using default quota settings';

    if (!saved) saveAutoFillSettings(effective);
  }

  async function exportBoardAsPNG() {
    const board = document.querySelector('.board-sheet');
    if (!board) return;
    if (typeof window.html2canvas !== 'function') {
      alert('html2canvas не завантажився.');
      return;
    }
    try {
      const canvas = await window.html2canvas(board, { backgroundColor: '#ffffff', scale: 2 });
      const a = document.createElement('a');
      const shift = state.activeShift || 'all';
      a.download = `pns-board-${shift}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch (e) {
      alert('Не вдалося згенерувати PNG');
      console.error(e);
    }
  }

  function exportBoardAsPDF() {
    const prevHash = location.hash;
    if (location.hash !== '#board-modal') PNS.openModal?.('board');
    window.print();
    if (prevHash && prevHash !== '#board-modal') {
      try { history.replaceState(null, '', prevHash); } catch {}
    }
  }

  // ---------- First init: parse DOM to state ----------
  function initFromDomOnce() {
    if (state._didInitialDomParse) return;

    // build initial state from existing HTML
    if (typeof PNS.parsePlayersFromTable === 'function') PNS.parsePlayersFromTable();
    if (typeof PNS.parseBasesFromCards === 'function') PNS.parseBasesFromCards();

    // actions UI
    if (typeof PNS.buildRowActions === 'function') PNS.buildRowActions();

    // initial render (safe)
    if (typeof PNS.renderAll === 'function') PNS.renderAll();

    state._didInitialDomParse = true;
  }

  // ---------- After HTMX swap: re-attach DOM elements WITHOUT resetting state ----------
  function reattachBasesToDom() {
    if (!state.baseById || !(state.bases || []).length) return;

    const cards = $$('.base-card');
    const boardCols = $$('.board-col');

    // compute ids in the same way as bases_parse.js did, but WITHOUT creating new base objects
    cards.forEach((card, idx) => {
      const titleText = (card.querySelector('h3')?.textContent || '').trim() || `Base ${idx + 1}`;
      const id = `b-${idx + 1}-${slug(titleText.split('/')[0])}`;
      card.dataset.baseId = id;

      const boardEl = boardCols[idx] || null;
      if (boardEl) boardEl.dataset.baseId = id;

      const base = state.baseById.get(id);
      if (!base) return;

      base.cardEl = card;
      base.boardEl = boardEl;

      // ensure tools exist (parseBasesFromCards used to inject them)
      if (!card.querySelector('.base-tools')) {
        const quotaRow = card.querySelector('.quota-row');
        const tools = document.createElement('div');
        tools.className = 'base-tools';
        tools.innerHTML = `
          <button class="btn btn-sm" type="button" data-base-autofill="${id}">Auto-fill</button>
          <button class="btn btn-sm" type="button" data-base-clear-helpers="${id}">Clear helpers</button>
          <button class="btn btn-sm" type="button" data-base-clear-all="${id}">Clear base</button>
        `;
        quotaRow?.insertAdjacentElement('afterend', tools);
      }
    });
  }

  function reattachPlayersToDom() {
    if (!(state.players || []).length) return;

    const table = PNS.controls?.playersDataTable || document.querySelector('#playersDataTable');
    if (!table) return;

    // safest: rebuild table from state (keeps assignments)
    if (typeof PNS.renderPlayersTableFromState === 'function') {
      PNS.renderPlayersTableFromState();
    }

    // rebuild actions UI
    if (typeof PNS.buildRowActions === 'function') PNS.buildRowActions();
  }

  function rehydrateAfterDomRefresh() {
    // ns.js already refreshed cache and fired pns:dom:refreshed
    // Here we must NOT nuke state.

    // if we have state already -> reattach only
    if ((state.players || []).length) reattachPlayersToDom();
    else if (typeof PNS.parsePlayersFromTable === 'function') PNS.parsePlayersFromTable();

    if ((state.bases || []).length) reattachBasesToDom();
    else if (typeof PNS.parseBasesFromCards === 'function') PNS.parseBasesFromCards();

    // re-bind filters (they use dataset guards)
    if (typeof PNS.bindTopFilterEvents === 'function') PNS.bindTopFilterEvents();
    if (typeof PNS.syncTopFilterUI === 'function') PNS.syncTopFilterUI();

    // re-render UI
    if (typeof PNS.renderAll === 'function') PNS.renderAll();

    // keep column visibility consistent
    if (typeof PNS.applyColumnVisibility === 'function') {
      PNS.applyColumnVisibility(state.showAllColumns);
    }

    // keep shift filter consistent
    if (typeof PNS.applyShiftFilter === 'function') {
      PNS.applyShiftFilter(state.activeShift || 'shift2');
    }
  }

  // ---------- ONE-TIME delegated bindings (works with partial swaps) ----------
  function bindDelegatedEventsOnce() {
    if (state._delegatedBindingsBound) return;

    // header buttons (desktop)
    onClick('#openSettingsBtn', (e) => { e.preventDefault(); PNS.openModal?.('settings'); });
    onClick('#openBoardBtn',    (e) => { e.preventDefault(); PNS.openModal?.('board'); });
    onClick('#autoFillAllHeaderBtn', (e) => { e.preventDefault(); PNS.autoFillAllVisibleBases?.(); });

    // drawer buttons (mobile)
    onClick('#openSettingsBtnMobile', (e) => { e.preventDefault(); PNS.openModal?.('settings'); });
    onClick('#openBoardBtnMobile',    (e) => { e.preventDefault(); PNS.openModal?.('board'); });
    onClick('#autoFillAllHeaderBtnMobile', (e) => { e.preventDefault(); PNS.autoFillAllVisibleBases?.(); });

    // players header panel actions
    onClick('#showAllDataBtn', (e) => { e.preventDefault(); PNS.toggleColumns?.(); });
    onClick('#showAllColumnsBtn', (e) => { e.preventDefault(); PNS.toggleColumns?.(); });

    // bases panel
    onClick('#autoFillAllBasesBtn', (e) => { e.preventDefault(); PNS.autoFillAllVisibleBases?.(); });

    // board modal
    onClick('#exportPngBtn', (e) => { e.preventDefault(); exportBoardAsPNG(); });
    onClick('#exportPdfBtn', (e) => { e.preventDefault(); exportBoardAsPDF(); });

    // import wizard
    onClick('#loadUrlMockBtn', (e) => { e.preventDefault(); PNS.handleLoadUrlClick?.(); });
    onClick('#useTemplateMockBtn', (e) => { e.preventDefault(); PNS.handleUseSavedTemplateClick?.(); });
    onClick('#saveVisibleColumnsMockBtn', (e) => { e.preventDefault(); PNS.handleSaveVisibleColumnsClick?.(); });
    onClick('#loadDemoImportBtn', (e) => { e.preventDefault(); PNS.loadDemoIntoImportWizard?.(); });
    onClick('#saveTemplateMockBtn', (e) => { e.preventDefault(); PNS.saveCurrentImportTemplate?.(); });
    onClick('#applyImportMockBtn', (e) => { e.preventDefault(); PNS.applyImportedPlayers?.(); });

    onClick('#detectColumnsMockBtn', (e) => {
      e.preventDefault();
      const url = $('#urlInputMock')?.value?.trim();
      const hasHeaders = !!(state.importData?.headers || []).length;
      if (url && !hasHeaders) PNS.handleLoadUrlClick?.();
      else PNS.handleDetectColumns?.();
    });

    // file input change
    document.addEventListener('change', (e) => {
      const fileInput = e.target.closest('#fileInputMock');
      if (!fileInput) return;
      PNS.handleImportFileChange?.(e);
    });

    // shift tabs (delegation)
    document.addEventListener('click', (e) => {
      if (typeof PNS.handleShiftTabClick === 'function') PNS.handleShiftTabClick(e);
    });

    // close modal buttons/backdrop
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-close-modal]');
      if (!el) return;
      e.preventDefault();
      PNS.closeModal?.();
      if (location.hash === '#settings-modal' || location.hash === '#board-modal') {
        try { history.replaceState(null, '', location.pathname + location.search); } catch {}
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.activeModal) PNS.closeModal?.();
    });

    window.addEventListener('hashchange', () => {
      if (location.hash === '#settings-modal') PNS.openModal?.('settings');
      else if (location.hash === '#board-modal') PNS.openModal?.('board');
      else if (!location.hash) PNS.closeModal?.();
    });

    // live tier/min settings in base editor (delegated)
    document.addEventListener('input', (e) => {
      const input = e.target.closest('[data-v4-maxhelpers],[data-v4-tier]');
      if (!input) return;
      const card = input.closest('.base-card');
      const baseId = card?.dataset?.baseId;
      if (!baseId) return;
      const base = state.baseById?.get?.(baseId);
      if (!base) return;

      const rule = PNS.readBaseEditorSettingsInputs?.(base);
      if (typeof PNS.setBaseTowerRule === 'function') {
        PNS.setBaseTowerRule(baseId, rule, { persist: true, rerender: false });
      }
      PNS.renderQuotaRow?.(base);
    });

    document.addEventListener('change', (e) => {
      const input = e.target.closest('[data-v4-maxhelpers],[data-v4-tier]');
      if (!input) return;
      const card = input.closest('.base-card');
      const baseId = card?.dataset?.baseId;
      if (!baseId) return;
      const base = state.baseById?.get?.(baseId);
      if (!base) return;

      if (typeof PNS.setBaseTowerRule === 'function') {
        PNS.setBaseTowerRule(baseId, PNS.readBaseEditorSettingsInputs?.(base), { persist: true, rerender: true });
      }
    });

    state._delegatedBindingsBound = true;
  }

  function init() {
    // load saved config
    if (typeof PNS.loadTopFilters === 'function') PNS.loadTopFilters();
    if (typeof PNS.loadBaseTowerRulesStore === 'function') PNS.loadBaseTowerRulesStore();

    bindDelegatedEventsOnce();

    // first init from HTML
    initFromDomOnce();

    // import wizard init
    if (typeof PNS.initImportWizard === 'function') PNS.initImportWizard();

    // quota defaults
    initQuotaSettings();

    // apply saved column visibility
    if (typeof PNS.applyColumnVisibility === 'function') {
      const saved = (typeof PNS.safeReadBool === 'function')
        ? PNS.safeReadBool(PNS.KEYS.KEY_SHOW_ALL, false)
        : false;
      PNS.applyColumnVisibility(saved);
    }

    // apply saved shift
    if (typeof PNS.applyShiftFilter === 'function') {
      const savedShift = (() => {
        try { return localStorage.getItem(PNS.KEYS.KEY_SHIFT_FILTER) || state.activeShift || 'shift2'; }
        catch { return state.activeShift || 'shift2'; }
      })();
      PNS.applyShiftFilter(savedShift);
    }

    // filters bind + apply
    if (typeof PNS.bindTopFilterEvents === 'function') PNS.bindTopFilterEvents();
    if (typeof PNS.applyPlayerTableFilters === 'function') PNS.applyPlayerTableFilters();

    // open modal by hash
    if (location.hash === '#settings-modal') PNS.openModal?.('settings');
    if (location.hash === '#board-modal') PNS.openModal?.('board');

    // ✅ KEY: after swap, ns.js emits this
    document.addEventListener('pns:dom:refreshed', () => {
      rehydrateAfterDomRefresh();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();