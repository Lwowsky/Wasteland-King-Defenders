(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state } = PNS;
  const t = (key, fallback = '') => (typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

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
    const board = document.querySelector('#board-modal .board-sheet') || document.querySelector('.board-modal .board-sheet') || document.querySelector('.board-sheet');
    if (!board) return;
    if (typeof window.html2canvas !== 'function') return alert(window.__PNS_OFFLINE_NO_HTML2CANVAS__ ? t('png_export_offline', 'PNG export недоступний в offline-пакеті без локальної бібліотеки html2canvas.') : t('html2canvas_missing', 'html2canvas не завантажився.'));
    window.html2canvas(board, { backgroundColor: '#ffffff', scale: 2 }).then((canvas) => {
      const a = document.createElement('a');
      const shift = state.activeShift || 'all';
      a.download = `pns-board-${shift}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    }).catch((e) => { console.error(e); alert(t('png_failed', 'Не вдалося згенерувати PNG')); });
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
    const c = PNS.controls || {}; const q = effective?.quotas || {};
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

  function rebuildFromDom() {
    PNS.refreshDomCache?.();
    const hasPlayersTable = !!document.querySelector('#playersDataTable');
    const hasBaseCards = !!document.querySelector('.bases-grid .base-card:not([data-settings-card])');

    if (hasPlayersTable) {
      if (typeof PNS.ensurePlayersLinked === 'function') PNS.ensurePlayersLinked();
      else if (typeof PNS.parsePlayersFromTable === 'function') PNS.parsePlayersFromTable();
    }
    if (hasBaseCards && typeof PNS.parseBasesFromCards === 'function') PNS.parseBasesFromCards();

    if (typeof PNS.buildRowActions === 'function') PNS.buildRowActions();
    if (typeof PNS.renderAll === 'function') PNS.renderAll();

    try { initQuotaSettings(); } catch {}
    PNS.initImportWizard?.();
    PNS.syncTopFilterUI?.();

    if (typeof PNS.applyColumnVisibility === 'function') {
      const showAll = typeof PNS.safeReadBool === 'function' ? PNS.safeReadBool(PNS.KEYS.KEY_SHOW_ALL, false) : false;
      PNS.applyColumnVisibility(showAll);
    }
    let _restoredSession = false;
    try { _restoredSession = !!PNS.restoreSessionStateNow?.({ soft: true }); } catch {}

    // Restore saved shift (do not force Shift 1 on every rebuild — it causes flicker/race after HTMX swaps)
    let shiftSaved = state.activeShift || 'shift1';
    try {
      const ls = localStorage.getItem(PNS.KEYS.KEY_SHIFT_FILTER);
      if (ls === 'shift1' || ls === 'shift2' || ls === 'all') shiftSaved = ls;
    } catch {}
    state.activeShift = shiftSaved;
    try { state._preserveRestoredAssignmentsOnNextShiftApply = !!_restoredSession; } catch {}
    PNS.applyShiftFilter?.(shiftSaved);
    PNS.applyPlayerTableFilters?.();

    // Notify split modules once DOM/state are in sync
    try { document.dispatchEvent(new CustomEvent('pns:dom:refreshed')); } catch {}

    if (location.hash === '#settings-modal') PNS.openModal?.('settings');
    if (location.hash === '#board-modal') PNS.openModal?.('board');
  }

  function scheduleRebuild() {
    if (state._htmxRebuildScheduled) return;
    state._htmxRebuildScheduled = true;
    setTimeout(() => {
      state._htmxRebuildScheduled = false;
      const hasPlayers = !!document.querySelector('#playersDataTable');
      const hasBases = !!document.querySelector('.bases-grid .base-card:not([data-settings-card])');
      if (!hasPlayers || !hasBases) {
        // HTMX partials load independently; wait until both sides are in DOM.
        if (!state._htmxRebuildRetryScheduled) {
          state._htmxRebuildRetryScheduled = true;
          setTimeout(() => { state._htmxRebuildRetryScheduled = false; scheduleRebuild(); }, 60);
        }
        return;
      }
      rebuildFromDom();
    }, 40);
  }

  function openTowerPickerSafe(baseId = '') {
    let pickedBaseId = String(baseId || state.focusedBaseId || '');
    try { PNS.ModalsShift?.initIfReady?.(); } catch {}
    try {
      if (!pickedBaseId) {
        const current = document.querySelector('.bases-grid .base-card.is-focused')?.dataset?.baseId
          || PNS.ModalsShift?.getFocusedCard?.()?.dataset?.baseId
          || PNS.ModalsShift?.findNextIncompleteTower?.()?.dataset?.baseId
          || PNS.ModalsShift?.getTowerCards?.()?.[0]?.dataset?.baseId
          || '';
        pickedBaseId = String(current || '');
      }
    } catch {}
    try {
      if (pickedBaseId) {
        state.focusedBaseId = pickedBaseId;
        PNS.state.towerPickerSelectedBaseId = pickedBaseId;
        PNS.ModalsShift?.focusTowerById?.(pickedBaseId);
      }
    } catch {}
    try { PNS.ModalsShift?.openTowerPickerModal?.(); } catch {}
    const modal = document.getElementById('towerPickerModal');
    if (modal) {
      try {
        modal.classList.add('is-open');
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        modal.style.zIndex = '350000';
        const card = modal.querySelector('.modal-card');
        if (card) {
          card.style.position = 'relative';
          card.style.zIndex = '1';
        }
      } catch {}
    }
    setTimeout(() => {
      try { PNS.ModalsShift?.refreshTowerPickerModalList?.(); } catch {}
      try { PNS.ModalsShift?.updateTowerPickerDetail?.(); } catch {}
      try { PNS.ModalsShift?.syncSettingsTowerPreview?.(); } catch {}
    }, 20);
    return !!modal;
  }
  PNS.openTowerPickerSafe = openTowerPickerSafe;

  let boardLangDialogAnchor = null;
  let boardLangDialogKind = 'board';

  function getBoardLangHost(anchorEl = null) {
    const anchor = anchorEl || boardLangDialogAnchor || null;
    return anchor?.closest?.('.board-lang-picker-wrap') || null;
  }

  function ensureBoardLanguageDialogRoot() {
    let root = document.getElementById('boardLangDialogRoot');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'boardLangDialogRoot';
    root.className = 'board-lang-dialog-root';
    root.innerHTML = '<div class="board-lang-dialog-backdrop" data-close-board-lang-picker="1"></div><div class="board-lang-dialog-shell" data-board-lang-dialog-shell="1"></div>';
    document.body.appendChild(root);
    return root;
  }

  function wireBoardLanguageButtons(scope = document) {
    (scope.querySelectorAll ? scope.querySelectorAll('[data-open-board-lang-picker]') : []).forEach((btn) => {
      try {
        btn.setAttribute('aria-haspopup', 'dialog');
        if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'false');
      } catch {}
      if (btn.dataset.boardLangBound === '1') return;
      btn.dataset.boardLangBound = '1';
      btn.onclick = function(ev) {
        try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.(); } catch {}
        const alreadyOpen = !!document.querySelector('#boardLangDialogRoot.is-open') && boardLangDialogAnchor === btn;
        if (alreadyOpen) closeBoardLanguageDialog();
        else openBoardLanguageDialog(String(btn.dataset.boardLangKind || btn.dataset.openBoardLangPicker || 'board'), btn);
        return false;
      };
    });
  }

  function closeBoardLanguageDialog() {
    const root = document.getElementById('boardLangDialogRoot');
    const shell = root?.querySelector('[data-board-lang-dialog-shell]') || null;
    if (shell) shell.innerHTML = '';
    if (root) {
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
      try { root.style.display = ''; root.style.visibility = ''; } catch {}
    }
    document.querySelectorAll('.board-lang-picker-wrap.is-open').forEach((host) => host.classList.remove('is-open'));
    document.querySelectorAll('[data-open-board-lang-picker]').forEach((btn) => {
      try { btn.setAttribute('aria-expanded', 'false'); } catch {}
    });
    boardLangDialogAnchor = null;
  }

  PNS.closeBoardLanguageDialog = closeBoardLanguageDialog;

  function openBoardLanguageDialog(kind = 'board', anchorEl = null) {
    const safeKind = String(kind || 'board');
    const anchor = anchorEl || document.querySelector(`[data-open-board-lang-picker="${safeKind}"]`) || null;
    const host = anchor?.closest?.('.board-lang-picker-wrap') || null;
    const root = ensureBoardLanguageDialogRoot();
    const shell = root?.querySelector('[data-board-lang-dialog-shell]') || null;
    if (!anchor || !root || !shell) return;
    closeBoardLanguageDialog();
    boardLangDialogKind = safeKind;
    boardLangDialogAnchor = anchor;
    const markup = typeof PNS.renderBoardLanguageDialogMarkup === 'function'
      ? PNS.renderBoardLanguageDialogMarkup(boardLangDialogKind)
      : '';
    if (!markup) return;
    shell.innerHTML = markup;
    try {
      root.style.display = 'block';
      root.style.visibility = 'visible';
      shell.style.display = 'flex';
      shell.style.alignItems = 'center';
      shell.style.justifyContent = 'center';
      shell.style.pointerEvents = 'auto';
      const card = shell.querySelector('[data-board-lang-dialog-card]');
      if (card) {
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.position = 'relative';
        card.style.zIndex = '2147483647';
        card.style.outline = '1px solid rgba(255,255,255,.16)';
      }
    } catch {}
    if (host) host.classList.add('is-open');
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    try { anchor.setAttribute('aria-expanded', 'true'); } catch {}
    requestAnimationFrame(() => {
      try { shell.querySelector('input[type="checkbox"]')?.focus?.(); } catch {}
    });
  }
  PNS.openBoardLanguageDialog = openBoardLanguageDialog;
  PNS.toggleBoardLanguageDialogFromButton = function toggleBoardLanguageDialogFromButton(btn) {
    try {
      const alreadyOpen = !!document.querySelector('#boardLangDialogRoot.is-open') && boardLangDialogAnchor === btn;
      if (alreadyOpen) closeBoardLanguageDialog();
      else openBoardLanguageDialog(String(btn?.dataset?.boardLangKind || btn?.dataset?.openBoardLangPicker || 'board'), btn || null);
    } catch {}
    return false;
  };

  function syncBoardLanguageSelects() {
    const locales = (typeof PNS.getBoardLanguageLocales === 'function'
      ? PNS.getBoardLanguageLocales()
      : (typeof window.getBoardLanguageLocales === 'function' ? window.getBoardLanguageLocales() : ['en']));
    const localeNames = { en: 'English', uk: 'Українська', ru: 'Русский' };
    const summary = typeof PNS.boardLanguageSummary === 'function'
      ? PNS.boardLanguageSummary(locales)
      : (Array.isArray(locales) ? locales.map((code) => localeNames[String(code || '').toLowerCase()] || String(code || '').toUpperCase()).join(' + ') : 'English');
    document.querySelectorAll('[data-board-lang-picker-host]').forEach((host) => {
      try {
        if (typeof PNS.renderBoardLanguagePickerMarkup === 'function') {
          host.innerHTML = PNS.renderBoardLanguagePickerMarkup('board');
          host.style.display = 'flex';
          host.style.alignItems = 'center';
        }
      } catch {}
    });
    document.querySelectorAll('[data-board-lang-picker-label], [data-calc-board-lang-picker-label]').forEach((el) => {
      try { el.textContent = summary; } catch {}
    });
    document.querySelectorAll('[data-board-lang-option], [data-calc-board-lang-option]').forEach((box) => {
      try { box.checked = locales.includes(String(box.value || '').toLowerCase()); } catch {}
    });
    document.querySelectorAll('[data-board-lang-mode], [data-calc-board-lang-mode]').forEach((sel) => {
      try {
        sel.value = locales.length === 1 && locales[0] === 'en' ? 'en' : 'en_local';
      } catch {}
    });
    const root = document.getElementById('boardLangDialogRoot');
    const shell = root?.querySelector('[data-board-lang-dialog-shell]') || null;
    if (root?.classList.contains('is-open') && shell && typeof PNS.renderBoardLanguageDialogMarkup === 'function') {
      shell.innerHTML = PNS.renderBoardLanguageDialogMarkup(boardLangDialogKind);
    }
    wireBoardLanguageButtons(document);
  }
  PNS.syncBoardLanguageSelects = syncBoardLanguageSelects;
  PNS.syncBoardLanguagePickerUI = syncBoardLanguageSelects;

  function ensureBoardLanguagePickerHosts() {
    const renderPicker = typeof PNS.renderBoardLanguagePickerMarkup === 'function' ? PNS.renderBoardLanguagePickerMarkup : null;
    if (!renderPicker) return;
    document.querySelectorAll('[data-board-lang-picker-host]').forEach((host) => {
      try {
        const existing = host.querySelector('[data-open-board-lang-picker]');
        if (!existing) host.innerHTML = renderPicker('board');
        host.style.display = 'flex';
        host.style.alignItems = 'center';
      } catch {}
    });
    wireBoardLanguageButtons(document);
  }
  PNS.ensureBoardLanguagePickerHosts = ensureBoardLanguagePickerHosts;
  setTimeout(() => { try { ensureBoardLanguagePickerHosts(); } catch {} }, 0);

  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close-board-lang-picker]');
    if (closeBtn) {
      try { e.preventDefault(); e.stopPropagation(); } catch {}
      closeBoardLanguageDialog();
      return;
    }
    const openBtn = e.target.closest('[data-open-board-lang-picker]');
    if (openBtn) {
      try { e.preventDefault(); e.stopPropagation(); } catch {}
      const alreadyOpen = !!document.querySelector('#boardLangDialogRoot.is-open') && boardLangDialogAnchor === openBtn;
      if (alreadyOpen) closeBoardLanguageDialog();
      else openBoardLanguageDialog(String(openBtn.dataset.openBoardLangPicker || 'board'), openBtn);
      return;
    }
    if (document.querySelector('#boardLangDialogRoot.is-open') && !e.target.closest('[data-board-lang-dialog-card]')) {
      closeBoardLanguageDialog();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!boardLangDialogAnchor) return;
    try { e.preventDefault(); } catch {}
    closeBoardLanguageDialog();
  });
  function bindStrongTowerSettingsButtons() {
    document.querySelectorAll('#openTowerPickerBtn, [data-action="open-tower-picker"]').forEach((openBtn) => {
      if (openBtn.dataset.strongBound) return;
      openBtn.dataset.strongBound = '1';
      try { openBtn.style.position = 'relative'; openBtn.style.zIndex = '120'; openBtn.style.pointerEvents = 'auto'; openBtn.style.cursor = 'pointer'; } catch {}
      const openHandler = (e) => {
        try { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); } catch {}
        const baseId = String(openBtn.dataset.openPickerBase || state.focusedBaseId || '');
        let opened = false;
        try { opened = !!openTowerPickerSafe(baseId); } catch {}
        if (!opened) {
          try { if (baseId) { state.focusedBaseId = baseId; PNS.state.towerPickerSelectedBaseId = baseId; PNS.ModalsShift?.focusTowerById?.(baseId); } } catch {}
          try { PNS.ModalsShift?.openTowerPickerModal?.(); opened = true; } catch {}
        }
        return false;
      };
      openBtn.onclick = openHandler;
    });
    const toggleBtn = document.getElementById('toggleTowerFocusBtn');
    if (toggleBtn && !toggleBtn.dataset.strongBound) {
      toggleBtn.dataset.strongBound = '1';
      try { toggleBtn.style.position = 'relative'; toggleBtn.style.zIndex = '120'; toggleBtn.style.pointerEvents = 'auto'; toggleBtn.style.cursor = 'pointer'; } catch {}
      toggleBtn.onclick = (e) => {
        try { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); } catch {}
        try { PNS.toggleTowerFocusMode?.(); } catch {}
        return false;
      };
    }

    document.querySelectorAll('[data-captain-edit-btn]').forEach((btn) => {
      if (btn.dataset.strongBound) return;
      btn.dataset.strongBound = '1';
      btn.onclick = (e) => {
        const baseId = String(btn.dataset.baseId || btn.dataset.openPickerBase || btn.closest('.base-card')?.dataset?.baseId || btn.closest('.base-card')?.dataset?.baseid || '');
        if (!baseId) return;
        try { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); } catch {}
        try { state.focusedBaseId = baseId; } catch {}
        const playerId = String(btn.dataset.editAssignedPlayer || '');
        if (playerId) {
          try { PNS.ModalsShift?.openTowerPlayerEditModal?.(baseId, playerId); } catch {}
        } else {
          let opened = false;
          try { opened = !!openTowerPickerSafe(baseId); } catch {}
          if (!opened) {
            try { PNS.ModalsShift?.openTowerPickerModal?.(); } catch {}
          }
        }
      };
    });
  }


  function bindTowerActionsCaptureOnce() {
    if (state._towerActionsCaptureBound) return;
    state._towerActionsCaptureBound = true;

    document.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-captain-edit-btn]');
      if (editBtn) {
        const baseId = String(editBtn.dataset.baseId || editBtn.dataset.openPickerBase || editBtn.closest('.base-card')?.dataset?.baseId || editBtn.closest('.base-card')?.dataset?.baseid || '');
        if (!baseId) return;
        try { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); } catch {}
        try { PNS.ModalsShift?.initIfReady?.(); } catch {}
        try { state.focusedBaseId = baseId; PNS.state.towerPickerSelectedBaseId = baseId; } catch {}
        const playerId = String(editBtn.dataset.editAssignedPlayer || '');
        if (playerId) {
          try { PNS.ModalsShift?.openTowerPlayerEditModal?.(baseId, playerId); } catch {}
        } else {
          try { PNS.ModalsShift?.focusTowerById?.(baseId); } catch {}
          openTowerPickerSafe(baseId);
        }
        return;
      }

      const openBtn = e.target.closest('#openTowerPickerBtn, [data-action="open-tower-picker"], [data-open-picker-base]');
      if (openBtn) {
        const baseId = String(openBtn.dataset.openPickerBase || openBtn.closest('.base-card')?.dataset?.baseId || openBtn.closest('.base-card')?.dataset?.baseid || state.focusedBaseId || '');
        try { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); } catch {}
        try { PNS.ModalsShift?.initIfReady?.(); } catch {}
        try { if (baseId) { state.focusedBaseId = baseId; PNS.state.towerPickerSelectedBaseId = baseId; PNS.ModalsShift?.focusTowerById?.(baseId); } } catch {}
        openTowerPickerSafe(baseId);
        return;
      }
    }, true);
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
    onClick('#autoFillAllHeaderBtn, #autoFillAllBasesBtn, #settingsAutoFillAllBtn', (e) => { e.preventDefault(); PNS.autoFillAllVisibleBases?.(); });
    onClick('#clearCurrentShiftBtn, #settingsClearCurrentShiftBtn', (e) => { e.preventDefault(); PNS.clearCurrentShiftAssignments?.(); PNS.renderAll?.(); });
    onClick('#exportPngBtn', (e) => { e.preventDefault(); exportBoardAsPNG(); });
    onClick('#exportPdfBtn', (e) => { e.preventDefault(); exportBoardAsPDF(); });

    // import wizard buttons (delegated for HTMX)
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

    // strong fallbacks for tower settings interactions (work even if split modules init later)
    onClick('[data-captain-edit-btn]', (e, el) => {
      e.preventDefault();
      e.stopPropagation();
      const baseId = String(el.dataset.baseId || el.dataset.openPickerBase || el.closest('.base-card')?.dataset?.baseId || el.closest('.base-card')?.dataset?.baseid || '');
      if (!baseId) return;
      try { state.focusedBaseId = baseId; } catch {}
      try { PNS.ModalsShift?.focusTowerById?.(baseId); } catch {}
      const playerId = String(el.dataset.editAssignedPlayer || '');
      if (playerId) {
        try { PNS.ModalsShift?.openTowerPlayerEditModal?.(baseId, playerId); } catch {}
      } else {
        try { PNS.state.towerPickerSelectedBaseId = baseId; } catch {}
        openTowerPickerSafe(baseId);
      }
      setTimeout(() => {
        try { PNS.ModalsShift?.syncSettingsTowerPreview?.(); } catch {}
        try { window.calcRenderInlineTowerSettings?.(document.getElementById('towerCalcModal')); } catch {}
      }, 20);
    });

    onClick('.shift-towers-preview .tower-thumb-card, .shift-towers-preview [data-preview-slot]', (e, el) => {
      e.preventDefault();
      const card = el.closest('.tower-thumb-card') || el;
      try { PNS.ModalsShift?.focusTowerFromPreviewElement?.(card); } catch {}
      setTimeout(() => {
        try { PNS.ModalsShift?.syncSettingsTowerPreview?.(); } catch {}
        try { window.calcRenderInlineTowerSettings?.(document.getElementById('towerCalcModal')); } catch {}
      }, 20);
    });

    // settings card buttons (optional)
    onClick('#settingsShowAllBasesBtn, [data-show-all-bases]', (e) => { e.preventDefault(); PNS.showAllBaseCards?.(); });
    onClick('#settingsHideOtherBasesBtn, [data-hide-other-bases]', (e) => { e.preventDefault(); PNS.showOnlyActiveBaseCard?.(); });
    onClick('#openTowerPickerBtn, [data-action="open-tower-picker"], [data-open-picker-base]', (e, el) => {
      e.preventDefault();
      try { PNS.ModalsShift?.initIfReady?.(); } catch {}
      const baseId = el.dataset.openPickerBase || el.closest('.base-card')?.dataset?.baseId || '';
      if (baseId) PNS.state.towerPickerSelectedBaseId = baseId;
      try { if (baseId) PNS.ModalsShift?.focusTowerById?.(baseId); } catch {}
      openTowerPickerSafe(baseId);
    });
    onClick('#toggleTowerFocusBtn, [data-action="toggle-towers-view"]', (e) => {
      e.preventDefault();
      try { PNS.ModalsShift?.initIfReady?.(); } catch {}
      PNS.toggleTowerFocusMode?.();
    });
    onClick('[data-edit-assigned-player]', (e, el) => {
      e.preventDefault();
      try { PNS.ModalsShift?.initIfReady?.(); } catch {}
      const baseId = el.dataset.baseId || '';
      const playerId = el.dataset.editAssignedPlayer || '';
      if (baseId && playerId) PNS.ModalsShift?.openTowerPlayerEditModal?.(baseId, playerId);
    });

    onClick('[data-close-modal]', (e) => { e.preventDefault(); PNS.closeModal?.(); clearModalHashIfNeeded(); });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (state.activeModal || location.hash === '#settings-modal' || location.hash === '#board-modal')) {
        PNS.closeModal?.(); clearModalHashIfNeeded();
      }
    });

    bindStrongTowerSettingsButtons();
    bindTowerActionsCaptureOnce();

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

    // live tier/min settings
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

  PNS.bindStrongTowerSettingsButtons = bindStrongTowerSettingsButtons;

  function init() {
    PNS.loadTopFilters?.();
    PNS.loadBaseTowerRulesStore?.();
    bindDelegatedOnce();
    scheduleRebuild();
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('htmx:afterSwap', scheduleRebuild);
  document.addEventListener('htmx:afterSettle', scheduleRebuild);
})();

(function(){
  const reb = () => { try { window.PNS?.bindStrongTowerSettingsButtons?.(); } catch {} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reb); else reb();
  document.addEventListener('htmx:afterSwap', reb);
  document.addEventListener('pns:i18n-changed', reb);
})();


document.addEventListener('pns:i18n-changed', () => {
  try { window.setBoardLanguageLocales?.((window.getBoardDefaultLocales?.() || (typeof window.getBoardLanguageLocales === 'function' ? window.getBoardLanguageLocales() : ['en']))); } catch {}
  try { window.renderStandaloneFinalBoard?.(document.getElementById('board-modal')); } catch {}
  try { window.PNS?.renderBoard?.(); } catch {}
  try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {}
  try { window.PNS?.syncBoardLanguageSelects?.(); } catch {}
});

document.addEventListener('pns:i18n-applied', () => { try { window.PNS?.syncBoardLanguageSelects?.(); } catch {} try { window.renderStandaloneFinalBoard?.(document.getElementById('board-modal')); } catch {} try { window.PNS?.renderBoard?.(); } catch {} try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {} });
