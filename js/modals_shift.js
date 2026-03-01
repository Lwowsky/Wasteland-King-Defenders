(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state, $$, $ } = PNS;

  // ===== live DOM getters (IMPORTANT for partial swaps) =====
  function getModals() {
    // підтримка старої мапи PNS.modals, але головне — актуальний DOM
    return {
      settings: document.querySelector('#settings-modal'),
      board: document.querySelector('#board-modal'),
    };
  }

  function getShiftTabs() {
    // кнопки можуть бути і в базах, і в board modal
    return Array.from(document.querySelectorAll('[data-shift-tab]'));
  }

  function getButtons() {
    return {
      showAllData: document.querySelector('#showAllDataBtn'),
      showAllColumns: document.querySelector('#showAllColumnsBtn'),
    };
  }

  // ===== Modals =====
  function openModal(name) {
    closeModal();
    const modal = getModals()[name];
    if (!modal) return;
    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
    state.activeModal = name;
  }

  function closeModal() {
    const modals = getModals();
    Object.values(modals).forEach((m) => m && m.classList.remove('is-open'));
    document.body.classList.remove('modal-open');
    state.activeModal = null;
  }

  // ===== Columns visibility =====
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

    if (typeof PNS.safeWriteBool === 'function') {
      PNS.safeWriteBool(PNS.KEYS.KEY_SHOW_ALL, state.showAllColumns);
    } else {
      try { localStorage.setItem(PNS.KEYS.KEY_SHOW_ALL, state.showAllColumns ? '1' : '0'); } catch {}
    }
  }

  function toggleColumns() { applyColumnVisibility(!state.showAllColumns); }

  // ===== Shift filter =====
  function matchesShift(itemShift, filter) {
    const normalized = String(itemShift || '').toLowerCase().trim();
    if (filter === 'all') return true;
    if (normalized === 'both') return true;
    return normalized === filter;
  }

  function updateShiftTabButtons() {
    const tabs = getShiftTabs();
    tabs.forEach((btn) => {
      const isActive = btn.dataset.shiftTab === state.activeShift;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  function updateBoardTitle() {
    const title = $('#boardTitle');
    if (!title) return;
    if (state.activeShift === 'shift1') title.textContent = '1st shift / Первая половина';
    else if (state.activeShift === 'shift2') title.textContent = '2nd shift / Вторая половина';
    else title.textContent = 'All shifts / Все смены';
  }

  function applyShiftFilter(shift) {
    const nextShift = ['shift1', 'shift2', 'all'].includes(shift) ? shift : 'all';
    state.activeShift = nextShift;

    // показ/ховання баз/борда
    $$('tbody tr[data-shift]').forEach((row) => { row.hidden = false; });
    $$('.base-card[data-shift]').forEach((card) => { card.hidden = !matchesShift(card.dataset.shift, state.activeShift); });
    $$('.board-col[data-shift]').forEach((col) => { col.hidden = !matchesShift(col.dataset.shift, state.activeShift); });

    updateShiftTabButtons();
    updateBoardTitle();

    // синхрон верхніх фільтрів
    if (state.topFilters) {
      if (state.topFilters.shift !== 'all') state.topFilters.shift = state.activeShift;
      if (typeof PNS.syncTopFilterUI === 'function') PNS.syncTopFilterUI();
      if (typeof PNS.applyPlayerTableFilters === 'function') PNS.applyPlayerTableFilters();
      if (typeof PNS.saveTopFilters === 'function') PNS.saveTopFilters();
    }

    try { localStorage.setItem(PNS.KEYS.KEY_SHIFT_FILTER, state.activeShift); } catch {}
  }

  function handleShiftTabClick(e) {
    const btn = e.target.closest('[data-shift-tab]');
    if (!btn) return;
    e.preventDefault();
    applyShiftFilter(btn.dataset.shiftTab);
  }

  // ===== re-sync after partial swaps =====
  function resyncUIAfterSwap() {
    // підтягнути showAllColumns з storage, якщо треба
    if (typeof state.showAllColumns !== 'boolean') state.showAllColumns = false;

    // застосувати видимість колонок по актуальному DOM
    applyColumnVisibility(state.showAllColumns);

    // shift tabs / board title
    updateShiftTabButtons();
    updateBoardTitle();

    // якщо був відкритий модал — спробувати відновити клас на новому DOM
    if (state.activeModal) {
      const modal = getModals()[state.activeModal];
      if (modal) modal.classList.add('is-open');
    }
  }

  // expose
  PNS.openModal = openModal;
  PNS.closeModal = closeModal;

  PNS.applyColumnVisibility = applyColumnVisibility;
  PNS.toggleColumns = toggleColumns;

  PNS.matchesShift = matchesShift;
  PNS.applyShiftFilter = applyShiftFilter;
  PNS.handleShiftTabClick = handleShiftTabClick;

  // initial sync
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', resyncUIAfterSwap);
  } else {
    resyncUIAfterSwap();
  }

  // HTMX swaps
  document.addEventListener('htmx:afterSwap', resyncUIAfterSwap);
  document.addEventListener('htmx:afterSettle', resyncUIAfterSwap);
  document.addEventListener('pns:partials:loaded', resyncUIAfterSwap);

})();