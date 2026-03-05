(function () {
  const PNS = window.PNS; if (!PNS) return;
  const MS = (PNS.ModalsShift = PNS.ModalsShift || {});
  const { state } = PNS; if (!state) return;
  const $$ = PNS.$$ || ((s, r = document) => Array.from(r.querySelectorAll(s)));

  function getModals() {
    return {
      settings: document.querySelector('#settings-modal'),
      board: document.querySelector('#board-modal'),
    };
  }
  function getShiftTabs() { return Array.from(document.querySelectorAll('[data-shift-tab]')); }
  function getButtons() {
    return {
      showAllData: document.querySelector('#showAllDataBtn'),
      showAllColumns: document.querySelector('#showAllColumnsBtn'),
      showAllTowers: document.querySelector('#showAllTowersBtn'),
      focusCurrentTower: document.querySelector('#focusCurrentTowerBtn') || document.querySelector('#hideOtherTowersBtn') || document.querySelector('#toggleTowerFocusBtn'),
      toggleTowerView: document.querySelector('#toggleTowerFocusBtn'),
      openTowerPicker: document.querySelector('#openTowerPickerBtn'),
      focusTowerSelect: document.querySelector('#focusTowerSelect'),
      openBoardSettings: document.querySelector('#openBoardFromSettingsColBtn') || document.querySelector('#openBoardBtnSettings') || document.querySelector('#openBoardBtnFromSettings'),
    };
  }

  function syncBodyModalLock() {
    const anyOpen = !!document.querySelector('.modal.is-open');
    document.body.classList.toggle('modal-open', anyOpen);
    if (!anyOpen) {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  }

  function ensureStep4Styles() {
    if (document.getElementById('pns-step4-inline-styles')) return;
    const st = document.createElement('style');
    st.id = 'pns-step4-inline-styles';
    st.textContent = `
      .bases-grid > .base-settings-card{align-self:stretch;height:100%;}
      .base-settings-card .settings-tools-box{flex:1;display:flex;flex-direction:column;justify-content:flex-start;}
      .tower-picker-modal{z-index:90000 !important; position:fixed !important; inset:0;} .tower-picker-modal .modal-card{width:min(1080px, calc(100vw - 18px));max-height:92vh;overflow:auto;border-radius:16px;} #board-modal{z-index:120000 !important; position:fixed !important; inset:0;} #board-modal .modal-card{position:relative;z-index:1;} #board-modal .modal-backdrop{z-index:0;} #towerPlayerEditModal{z-index:130000 !important; position:fixed !important; inset:0;} #towerPlayerEditModal .modal-card{z-index:1;position:relative;}
      .tower-picker-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;position:relative;}
      .tower-picker-head-center{display:flex;align-items:center;justify-content:center;gap:8px;justify-self:center;grid-column:2;}
      .tower-picker-head-left{text-align:left;}
      .tower-picker-head-left h2{margin:0;line-height:1.15;}
      .tower-picker-head-left p{margin:4px 0 0;}
      .tower-picker-head .btn.shift-mini{min-width:84px;padding:7px 10px;}
      .tower-picker-head>[data-close-tower-picker]{justify-self:end;grid-column:3;}
      .tower-picker-detail .picker-meta-row{display:flex !important;align-items:center;gap:12px;flex-wrap:wrap;margin-top:2px;} .tower-picker-detail .picker-meta-row .picker-meta-shift{margin-right:4px;} .tower-picker-detail .picker-only-captains{display:inline-flex !important;align-items:center;gap:8px;cursor:pointer;white-space:nowrap;} .tower-picker-detail .picker-only-captains input{width:auto;height:auto;flex:0 0 auto;} .tower-picker-detail .picker-topline{display:grid;grid-template-columns:minmax(220px,360px) auto;gap:10px;align-items:center;}
      .tower-picker-detail .picker-topline > select{min-width:180px;max-width:360px;width:100%;}
      .tower-picker-detail .picker-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
      .tower-picker-detail details.tower-collapsible{border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.02);} 
      .tower-picker-detail details.tower-collapsible>summary{cursor:pointer;list-style:none;padding:10px;font-weight:600;}
      .tower-picker-detail details.tower-collapsible>summary::-webkit-details-marker{display:none;}
      .tower-picker-detail details.tower-collapsible .inner{padding:0 10px 10px;}
      .tower-picker-detail .picker-limits-head{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px;}
      .tower-picker-detail .picker-limits-head label{display:grid;gap:6px;min-width:220px;}
      .tower-picker-detail .picker-manual-row{display:grid;grid-template-columns:minmax(140px,1.3fr) minmax(110px,.8fr) minmax(130px,.9fr);gap:8px;align-items:end;}
      .tower-picker-detail .picker-manual-row2{display:grid;grid-template-columns:92px 130px 150px max-content max-content !important;gap:8px;align-items:end;}
      .tower-picker-detail .picker-manual-row2 > .btn{justify-self:start;white-space:nowrap;}
      .tower-picker-list .tower-item-count{display:inline-flex;align-items:center;justify-content:center;padding:1px 6px;border-radius:999px;font-weight:700;border:1px solid rgba(255,255,255,.14);margin-left:2px;}
      .tower-picker-list .tower-item-count.is-ready{color:#9ff0b3;border-color:rgba(84,214,140,.35);background:rgba(24,74,42,.26);}
      .tower-picker-list .tower-item-count.is-not-ready{color:#ffc4cb;border-color:rgba(255,111,126,.35);background:rgba(84,26,36,.22);}
      #openTowerPickerBtn{min-width:190px;}
      #focusTowerPrevBtn,#focusTowerNextBtn,#focusTowerSelect,.settings-focus-inline{display:none !important;}
      .tower-picker-detail .tower-picker-item.active{border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.08);} .tower-picker-list .tower-picker-item{display:flex;flex-direction:column;align-items:stretch;width:100%;text-align:left;padding:9px 10px;border-radius:12px;} .tower-picker-list .tower-picker-item .tower-item-row{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;} .tower-picker-list .tower-picker-item .tower-item-status{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;font-size:12px;font-weight:700;border:1px solid rgba(255,255,255,.14);background:rgba(12,20,38,.75);color:#dbe6ff;} .tower-picker-list .tower-picker-item.is-ready .tower-item-status{color:#9ff0b3;border-color:rgba(84,214,140,.35);background:rgba(24,74,42,.38);} .tower-picker-list .tower-picker-item.is-not-ready .tower-item-status{color:#ffc4cb;border-color:rgba(255,111,126,.35);background:rgba(84,26,36,.38);} .tower-picker-list .tower-picker-item.is-ready{box-shadow:inset 0 0 0 1px rgba(84,214,140,.10);} .tower-picker-list .tower-picker-item.is-not-ready{box-shadow:inset 0 0 0 1px rgba(255,111,126,.06);} 
      #towerPlayerEditModal .modal-card{width:min(540px, calc(100vw - 24px));}
      #towerPlayerEditModal .modal-grid{grid-template-columns:minmax(0,1fr);}
      #towerPlayerEditModal .modal-grid > .panel{max-width:100%;}
      .tower-picker-modal input,.tower-picker-modal select,#towerPlayerEditModal input,#towerPlayerEditModal select{color:#e9efff !important;}
      #towerPlayerEditModal input::placeholder{color:#8e9ab8;}
      .settings-focus-inline{display:grid;grid-template-columns:30px minmax(0,1fr) 30px;align-items:center;gap:6px;min-width:150px;max-width:240px;flex:1 1 210px;}
      .settings-focus-inline .btn{padding:0;min-width:30px;width:30px;height:30px;border-radius:9px;}
      .settings-focus-select{display:block;height:38px;min-width:0;width:100%;padding:7px 10px;font-size:13px;line-height:1.2;}
      .quota-row .quota-max{margin-left:auto;}
      .shift-towers-preview .tower-thumb-card{position:relative;cursor:pointer;}
      .shift-towers-preview .tower-thumb-card.is-active{border-color:rgba(255,170,90,.55); box-shadow:0 0 0 1px rgba(255,170,90,.18) inset, 0 0 0 2px rgba(255,170,90,.08);}
      .shift-towers-preview .tower-thumb-card.is-ready{background:rgba(84,214,140,.06);}
      .shift-towers-preview .tower-thumb-card.is-not-ready{background:rgba(255,255,255,.02);}
      .shift-towers-preview .tower-thumb-card .tower-thumb-status{
        position:absolute; top:6px; right:6px; width:20px; height:20px; border-radius:999px;
        display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;
        border:1px solid rgba(255,255,255,.18); background:rgba(10,18,35,.75); color:#dbe6ff;
      }
      .shift-towers-preview .tower-thumb-card.is-ready .tower-thumb-status{
        color:#9ff0b3; border-color:rgba(84,214,140,.35); background:rgba(30,84,46,.35);
      }
      .shift-towers-preview .tower-thumb-card.is-not-ready .tower-thumb-status{
        color:#ffbec7; border-color:rgba(255,111,126,.35); background:rgba(110,34,44,.28);
      }
      @media (max-width: 900px){
        .tower-picker-modal .modal-card{width:calc(100vw - 10px);max-height:94vh;border-radius:14px;}
        .tower-picker-modal .modal-head{padding:8px 10px;}
        .tower-picker-modal .modal-grid{padding:8px !important;gap:8px !important;grid-template-columns:1fr !important;}
        .tower-picker-head{grid-template-columns:1fr 44px;grid-template-areas:'title close' 'center center';align-items:start;}
        .tower-picker-head-left{grid-area:title;}
        .tower-picker-head-center{grid-area:center;grid-column:auto; justify-content:center; margin-top:4px;}
        .tower-picker-head > [data-close-tower-picker]{grid-area:close;justify-self:end;}
        .tower-picker-detail .picker-topline{grid-template-columns:1fr;}
        .tower-picker-detail .picker-manual-row,.tower-picker-detail .picker-manual-row2{grid-template-columns:1fr;}
      }
    `;
    document.head.appendChild(st);
  }

  function openModal(name) {
    closeModal();
    const modal = getModals()[name];
    if (!modal) return;
    modal.classList.add('is-open');
    MS.updateShiftTabButtons?.();
    syncBodyModalLock();
    state.activeModal = name;
  }

  function closeModal() {
    const modals = getModals();
    Object.values(modals).forEach((m) => m && m.classList.remove('is-open'));
    syncBodyModalLock();
    state.activeModal = null;
  }

  function syncToggleButtons() {
    const on = !!state.showAllColumns;
    const b = getButtons();
    if (b.showAllData) {
      b.showAllData.setAttribute('aria-pressed', String(on));
      b.showAllData.classList.toggle('toggle-on', on);
      b.showAllData.textContent = on ? 'Сховати зайві колонки' : 'Показати всі дані';
    }
    if (b.showAllColumns) {
      b.showAllColumns.setAttribute('aria-pressed', String(on));
      b.showAllColumns.classList.toggle('toggle-on', on);
      b.showAllColumns.textContent = on ? 'Hide extra columns' : 'Show all columns';
    }
  }

  function syncVisibilityCheckboxes() {
    $$('#columnVisibilityChecks input[type="checkbox"][data-col-key]').forEach((cb) => {
      cb.checked = (state.visibleOptionalColumns || []).includes(cb.dataset.colKey);
    });
  }

  function applyColumnVisibility(showAll) {
    state.showAllColumns = !!showAll;
    const visible = new Set(state.visibleOptionalColumns || []);
    $$('.optional-col').forEach((cell) => {
      const key = cell.dataset.colKey || '';
      const shouldShow = state.showAllColumns || !key || visible.has(key);
      cell.classList.toggle('is-hidden-col', !shouldShow);
    });
    syncVisibilityCheckboxes();
    syncToggleButtons();
    try {
      if (typeof PNS.safeWriteBool === 'function') PNS.safeWriteBool(PNS.KEYS.KEY_SHOW_ALL, state.showAllColumns);
      else localStorage.setItem(PNS.KEYS.KEY_SHOW_ALL, state.showAllColumns ? '1' : '0');
    } catch {}
  }
  function toggleColumns() { applyColumnVisibility(!state.showAllColumns); }


  function towerPreviewSlotKeyFromTitle(title) {
    const t = String(title || '').toLowerCase();
    if (/(техно|hub|central)/i.test(t)) return 'hub';
    if (/(північ|север|north)/i.test(t)) return 'north';
    if (/(захід|запад|west)/i.test(t)) return 'west';
    if (/(схід|восток|east)/i.test(t)) return 'east';
    if (/(півден|юж|south)/i.test(t)) return 'south';
    return '';
  }

  function getBaseByPreviewSlot(slot) {
    const key = String(slot || '').toLowerCase();
    if (!key) return null;
    const bases = (state.bases || []);
    for (const b of bases) {
      const title = String(b?.title || '');
      if (towerPreviewSlotKeyFromTitle(title) === key) return b;
    }
    return null;
  }

  function syncSettingsTowerPreview() {
    const root = document.querySelector('.shift-towers-preview');
    if (!root) return;
    let focusedId = String(state.focusedBaseId || '');
    if (!focusedId) {
      try {
        const fc = MS.getFocusedCard?.();
        focusedId = String(fc?.dataset?.baseId || fc?.dataset?.baseid || '');
      } catch {}
    }
    root.querySelectorAll('[data-preview-slot]').forEach((el) => {
      const slot = el.getAttribute('data-preview-slot') || '';
      const base = getBaseByPreviewSlot(slot);
      const card = el.closest('.tower-thumb-card') || el;
      const status = card.querySelector('.tower-thumb-status');
      if (!base) {
        card.classList.remove('is-active', 'is-ready', 'is-not-ready');
        card.dataset.previewBaseId = '';
        if (status) status.textContent = '?';
        card.title = 'Башня не знайдена';
        return;
      }
      const baseId = String(base.id || '');
      card.dataset.previewBaseId = baseId;
      const ready = !!base.captainId;
      card.classList.toggle('is-ready', ready);
      card.classList.toggle('is-not-ready', !ready);
      card.classList.toggle('is-active', !!focusedId && focusedId === baseId);
      card.setAttribute('aria-pressed', (!!focusedId && focusedId === baseId) ? 'true' : 'false');
      card.title = `${String(base.title || baseId).split('/')[0].trim()} — ${ready ? 'готова' : 'без капітана'}`;
      if (status) {
        status.textContent = ready ? '✓' : '!';
        status.setAttribute('aria-label', ready ? 'Башня готова' : 'Башня не готова');
      }
    });
  }

  function focusTowerFromPreviewElement(previewEl) {
    const card = previewEl?.closest?.('.tower-thumb-card') || previewEl;
    if (!card) return;
    let baseId = String(card.dataset.previewBaseId || '');
    if (!baseId) {
      const slotEl = card.querySelector?.('[data-preview-slot]') || card;
      const slot = slotEl?.getAttribute?.('data-preview-slot') || '';
      const base = getBaseByPreviewSlot(slot);
      baseId = String(base?.id || '');
    }
    if (!baseId) return;

    state.focusedBaseId = baseId;

    // Prefer using the same path as arrows/select so right panel becomes editable immediately.
    const sel = document.getElementById('focusTowerSelect');
    let switched = false;
    if (sel) {
      const hasOption = Array.from(sel.options || []).some((o) => String(o.value) === String(baseId));
      if (hasOption) {
        sel.value = baseId;
        try { MS.handleFocusSelect?.(sel); switched = true; } catch {}
      }
    }
    if (!switched) {
      try { MS.focusTowerById?.(baseId); switched = true; } catch {}
    }

    try {
      const esc = (window.CSS && CSS.escape) ? CSS.escape(baseId) : String(baseId).replace(/"/g, '\"');
      const baseCard = document.querySelector(`.bases-grid .base-card[data-base-id="${esc}"]`) ||
                       document.querySelector(`.bases-grid .base-card[data-baseid="${esc}"]`);
      if (baseCard) {
        MS.markFocusedCard?.(baseCard);
        if ((state.towerViewMode || 'focus') === 'focus') {
          setTimeout(() => { try { MS.applyTowerVisibilityMode?.(); } catch {} }, 0);
        }
      }
    } catch {}

    setTimeout(() => {
      try { MS.syncFocusedTowerSelect?.(); } catch {}
      try { syncSettingsTowerPreview(); } catch {}
      try {
        if (document.getElementById('towerPickerModal')?.classList.contains('is-open')) {
          MS.refreshTowerPickerModalList?.();
          MS.updateTowerPickerDetail?.();
        }
      } catch {}
    }, 20);
  }

  function bindSettingsAndTowerButtonsOnce() {
    if (state._modalsShiftExtraBound) return;
    state._modalsShiftExtraBound = true;

    function seedTowerEditModalFromManual(baseId, assignKind) {
      MS.openTowerPlayerEditModal?.(baseId, '');
      const m = document.getElementById('towerPickerModal');
      const edit = document.getElementById('towerPlayerEditModal');
      if (m && edit) {
        edit.querySelector('#tpeName').value = m.querySelector('#pickerManualName')?.value || '';
        edit.querySelector('#tpeAlly').value = m.querySelector('#pickerManualAlly')?.value || '';
        edit.querySelector('#tpeRole').value = m.querySelector('#pickerManualRole')?.value || 'Fighter';
        edit.querySelector('#tpeTier').value = m.querySelector('#pickerManualTier')?.value || 'T10';
        edit.querySelector('#tpeMarch').value = m.querySelector('#pickerManualMarch')?.value || '';
        const rallyInput = edit.querySelector('#tpeRally');
        if (rallyInput) rallyInput.value = m.querySelector('#pickerManualRally')?.value || '';
        edit.dataset.forceAssignKind = assignKind || '';

        // New manual player: keep mode in sync immediately (important for Rally field visibility)
        const forcedCaptain = String(assignKind || '').toLowerCase() === 'captain';
        edit.dataset.kind = forcedCaptain ? 'captain' : 'helper';
        if (rallyInput) {
          rallyInput.style.display = forcedCaptain ? '' : 'none';
          rallyInput.disabled = !forcedCaptain;
        }

        const sub = edit.querySelector('#tpeSubtitle');
        if (sub && !edit.dataset.playerId) {
          sub.textContent = assignKind === 'captain' ? 'Новий капітан у башню' : 'Новий хелпер у башню';
        }
      }
      try { const em = document.getElementById('towerPlayerEditModal'); if (em) em.style.zIndex = '80000'; } catch {}
    }

    document.addEventListener('click', (e) => {
      const btnShow = e.target.closest('#showAllTowersBtn,[data-action="show-all-towers"]');
      if (btnShow) { e.preventDefault(); MS.showAllTowers?.(); return; }

      const btnFocus = e.target.closest('#focusCurrentTowerBtn,#hideOtherTowersBtn,[data-action="focus-current-tower"]');
      if (btnFocus) { e.preventDefault(); MS.focusCurrentTower?.(); return; }

      const btnToggle = e.target.closest('#toggleTowerFocusBtn,[data-action="toggle-towers-view"]');
      if (btnToggle) {
        e.preventDefault();
        if ((state.towerViewMode || 'focus') === 'focus') MS.showAllTowers?.();
        else MS.focusCurrentTower?.();
        return;
      }

      const btnPick = e.target.closest('#openTowerPickerBtn,[data-action="open-tower-picker"]');
      if (btnPick) { e.preventDefault(); try { if (!state._pnsShiftForcedOnce) { state._pnsShiftForcedOnce = true; PNS.applyShiftFilter?.('shift1'); } } catch {} refreshTowerPickerLauncherUI(); MS.openTowerPickerModal?.(); return; }

      const btnOpenPickerBaseFallback = e.target.closest('.base-card .captain-col button, .base-card .captain-col-right button');
      if (btnOpenPickerBaseFallback && !btnOpenPickerBaseFallback.closest('#towerPickerModal')) {
        const txt = (btnOpenPickerBaseFallback.textContent || '').toLowerCase();
        const looksLikeEditTower = /edit tower|редагувати башню/.test(txt);
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
        focusTowerFromPreviewElement(previewTower);
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
        syncBodyModalLock();
        return;
      }

      const pickerSetCaptain = e.target.closest('[data-picker-set-captain]');
      if (pickerSetCaptain) {
        e.preventDefault();
        const baseId = pickerSetCaptain.dataset.pickerSetCaptain;
        const sel = document.getElementById('towerPickerCaptainSelect');
        if (!sel?.value) { alert('Оберіть капітана'); return; }
        try { PNS.assignPlayerToBase?.(sel.value, baseId, 'captain'); } catch {}
        MS.saveCurrentShiftPlanSnapshot?.();
        setTimeout(() => { MS.refreshTowerPickerModalList?.(); MS.updateTowerPickerDetail?.(); MS.maybeAdvanceFocusedTower?.(); MS.syncSettingsTowerPreview?.(); }, 60);
        return;
      }

      const pickerAuto = e.target.closest('[data-picker-autofill]');
      if (pickerAuto) {
        e.preventDefault();
        try { PNS.autoFillBase?.(pickerAuto.dataset.pickerAutofill); } catch {}
        MS.saveCurrentShiftPlanSnapshot?.();
        setTimeout(() => { MS.refreshTowerPickerModalList?.(); MS.updateTowerPickerDetail?.(); MS.maybeAdvanceFocusedTower?.(); MS.syncSettingsTowerPreview?.(); }, 60);
        return;
      }

      const pickerClrH = e.target.closest('[data-picker-clear-helpers]');
      if (pickerClrH) {
        e.preventDefault();
        try { PNS.clearBase?.(pickerClrH.dataset.pickerClearHelpers, true); } catch {}
        setTimeout(() => { MS.refreshTowerPickerModalList?.(); MS.updateTowerPickerDetail?.(); MS.syncSettingsTowerPreview?.(); }, 40);
        return;
      }

      const pickerClrB = e.target.closest('[data-picker-clear-base]');
      if (pickerClrB) {
        e.preventDefault();
        try { PNS.clearBase?.(pickerClrB.dataset.pickerClearBase, false); } catch {}
        setTimeout(() => { MS.refreshTowerPickerModalList?.(); MS.updateTowerPickerDetail?.(); MS.syncSettingsTowerPreview?.(); }, 40);
        return;
      }

      const pickerFocusRight = e.target.closest('[data-picker-focus-right]');
      if (pickerFocusRight) {
        e.preventDefault();
        MS.focusTowerById?.(pickerFocusRight.dataset.pickerFocusRight);
        document.getElementById('towerPickerModal')?.classList.remove('is-open');
        syncBodyModalLock();
        return;
      }


      const pickerResetRule = e.target.closest('[data-picker-reset-rule]');
      if (pickerResetRule) {
        e.preventDefault();
        const modal = document.getElementById('towerPickerModal');
        modal?.querySelectorAll('[data-picker-tier]').forEach(inp => { inp.value = '0'; });
        return;
      }

      const pickerSaveRule = e.target.closest('[data-picker-save-rule]');
      if (pickerSaveRule) {
        e.preventDefault();
        const baseId = pickerSaveRule.dataset.pickerSaveRule;
        const modal = document.getElementById('towerPickerModal');
        const maxHelpers = Number(modal?.querySelector('#pickerMaxHelpers')?.value || 29) || 29;
        const tierMinMarch = {};
        modal?.querySelectorAll('[data-picker-tier]').forEach(inp => { tierMinMarch[inp.dataset.pickerTier] = Number(inp.value || 0) || 0; });
        try { PNS.setBaseTowerRule?.(baseId, { maxHelpers, tierMinMarch }, { persist: true, rerender: true }); } catch {}
        setTimeout(() => { MS.refreshTowerPickerModalList?.(); MS.updateTowerPickerDetail?.(); MS.syncSettingsTowerPreview?.(); }, 40);
        return;
      }

      const pickerAddManualCaptain = e.target.closest('[data-picker-add-manual-captain]');
      if (pickerAddManualCaptain) {
        e.preventDefault();
        seedTowerEditModalFromManual(pickerAddManualCaptain.dataset.pickerAddManualCaptain, 'captain');
        return;
      }

      const pickerAddManual = e.target.closest('[data-picker-add-manual]');
      if (pickerAddManual) {
        e.preventDefault();
        seedTowerEditModalFromManual(pickerAddManual.dataset.pickerAddManual, 'helper');
        return;
      }

      const pickerEditPlayer = e.target.closest('[data-picker-edit-player]');
      if (pickerEditPlayer) {
        e.preventDefault();
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
        if (!document.getElementById('towerPickerModal')?.classList.contains('is-open')) syncBodyModalLock();
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
      focusTowerFromPreviewElement(preview);
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
      try {
        const bm = document.getElementById('board-modal');
        if (bm) {
          bm.style.zIndex = '120000';
          bm.style.position = 'fixed';
          bm.style.inset = '0';
        }
      } catch {}
      openModal('board');
      try { PNS.renderBoard?.(); } catch {}
    });

    document.addEventListener('click', (e) => {
      const card = e.target.closest('.bases-grid .base-card');
      if (card) { MS.markFocusedCard?.(card); setTimeout(() => MS.syncSettingsTowerPreview?.(), 20); }
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
      const cb = e.target.closest('#pickerOnlyCaptains');
      if (!cb) return;
      state.towerPickerOnlyCaptains = !!cb.checked;
      MS.updateTowerPickerDetail?.();
    });
    document.addEventListener('change', (e) => {
      const cb = e.target.closest('#pickerMatchRegisteredShift');
      if (!cb) return;
      state.towerPickerMatchRegisteredShift = !!cb.checked;
      MS.updateTowerPickerDetail?.();
    });
    document.addEventListener('input', (e) => {
      const sel = e.target.closest('#focusTowerSelect');
      if (!sel) return;
      MS.handleFocusSelect?.(sel);
      setTimeout(() => MS.syncSettingsTowerPreview?.(), 20);
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.row-actions .btn, [data-base-editor-action], [data-base-remove-player]');
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
      }, 40);
    });
  }


  function refreshTowerPickerLauncherUI() {
    try {
      const openBtn = document.getElementById('openTowerPickerBtn');
      if (openBtn) openBtn.textContent = 'Налаштування турелей';
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
    ensureStep4Styles();
    refreshTowerPickerLauncherUI();

    if (PNS.modals) {
      const m = getModals();
      PNS.modals.settings = m.settings;
      PNS.modals.board = m.board;
    }
    if (PNS.shiftTabs && Array.isArray(PNS.shiftTabs)) {
      PNS.shiftTabs.length = 0;
      PNS.shiftTabs.push(...getShiftTabs());
    }

    if (typeof state.showAllColumns !== 'boolean') state.showAllColumns = false;
    applyColumnVisibility(!!state.showAllColumns);
    MS.updateShiftTabButtons?.();
    MS.updateBoardTitle?.();
    bindSettingsAndTowerButtonsOnce();

    if (typeof state.autoAdvanceTowerOnAssign !== 'boolean') state.autoAdvanceTowerOnAssign = false;
    state.towerViewMode = state.towerViewMode || 'focus';
    setTimeout(() => { MS.applyTowerVisibilityMode?.(); MS.syncTowerViewToggleButton?.(); MS.syncFocusedTowerSelect?.(); MS.syncSettingsTowerPreview?.(); }, 0);

    if (state.activeModal) {
      const modal = getModals()[state.activeModal];
      if (modal) modal.classList.add('is-open');
    }
  }

  function exposeLegacyPNSApi() {
    PNS.openModal = openModal;
    PNS.closeModal = closeModal;
    PNS.applyColumnVisibility = applyColumnVisibility;
    PNS.toggleColumns = toggleColumns;
    PNS.matchesShift = MS.matchesShift;
    PNS.applyShiftFilter = MS.applyShiftFilter;
    PNS.handleShiftTabClick = MS.handleShiftTabClick;
    PNS.showAllTowers = MS.showAllTowers;
    PNS.focusCurrentTower = MS.focusCurrentTower;
    PNS.showAllTowers = MS.showAllTowers;
    PNS.toggleTowerFocusMode = () => ((state.towerViewMode || 'focus') === 'focus' ? MS.showAllTowers?.() : MS.focusCurrentTower?.());
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
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resyncUIAfterSwap);
    else resyncUIAfterSwap();
    document.addEventListener('htmx:afterSwap', resyncUIAfterSwap);
    document.addEventListener('htmx:afterSettle', resyncUIAfterSwap);
    document.addEventListener('pns:partials:loaded', resyncUIAfterSwap);
    document.addEventListener('pns:dom:refreshed', () => setTimeout(() => MS.applyTowerVisibilityMode?.(), 0));
    MS.__initialized = true;
    return true;
  }

  Object.assign(MS, {
    __splitVersion: '1',
    getModals,
    getShiftTabs,
    getButtons,
    syncBodyModalLock,
    ensureStep4Styles,
    openModal,
    closeModal,
    applyColumnVisibility,
    toggleColumns,
    syncToggleButtons,
    syncVisibilityCheckboxes,
    towerPreviewSlotKeyFromTitle,
    getBaseByPreviewSlot,
    syncSettingsTowerPreview,
    focusTowerFromPreviewElement,
    bindSettingsAndTowerButtonsOnce,
    resyncUIAfterSwap,
    exposeLegacyPNSApi,
    initIfReady,
  });

  initIfReady();
})();
