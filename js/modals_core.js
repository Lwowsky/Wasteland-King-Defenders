// Core modal helpers (split from modals_api.js)
(function () {
  const PNS = window.PNS; if (!PNS) return;
  const MS = (PNS.ModalsShift = PNS.ModalsShift || {});
  const state = PNS.state || (PNS.state = {});

  const $ = PNS.$ || ((sel, root = document) => root.querySelector(sel));
  const $$ = PNS.$$ || ((sel, root = document) => Array.from(root.querySelectorAll(sel)));

  function closeDrawerIfOpen() {
    const burgerBtn = document.getElementById('burgerBtn');
    const drawer = document.getElementById('drawer');
    if (!burgerBtn || !drawer) return;
    if (!drawer.classList.contains('is-open')) return;

    drawer.classList.remove('is-open');
    burgerBtn.classList.remove('is-open');
    burgerBtn.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
  }

  function getModals() {
    const cached = PNS.modals || {};
    return {
      settings: cached.settings || document.getElementById('settings-modal'),
      board: cached.board || document.getElementById('board-modal'),
      towerPicker: document.getElementById('towerPickerModal'),
      towerPlayerEdit: document.getElementById('towerPlayerEditModal'),
      towerCalc: document.getElementById('towerCalcModal'),
    };
  }

function getButtons() {
  const buttons = PNS.buttons || (PNS.buttons = {});
  buttons.showAllData = document.getElementById('showAllDataBtn');
  buttons.showAllColumns = document.getElementById('showAllColumnsBtn');
  buttons.openSettings = document.getElementById('openSettingsBtn');
  buttons.openBoard = document.getElementById('openBoardBtn');
  return buttons;
}

  function getShiftTabs() {
    return PNS.shiftTabs || $$('[data-shift-tab]');
  }

  function anyModalOpen() {
    if (document.querySelector('.modal.is-open')) return true;

    // Support CSS-only :target modals too
    const hash = String(location.hash || '');
    if (hash && hash.length > 1) {
      const el = document.getElementById(hash.slice(1));
      if (el && el.classList && el.classList.contains('modal')) {
        try {
          const disp = getComputedStyle(el).display;
          if (disp !== 'none') return true;
        } catch {}
      }
    }
    return false;
  }

  function syncBodyModalLock() {
    const open = anyModalOpen();
    if (open) {
      closeDrawerIfOpen();
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
    }
  }

  // Step4 styles were moved to css/modals.css; keep API for backward compatibility.
  function ensureStep4Styles() {}

  function syncToggleButtons() {
    const on = !!state.showAllColumns;
    const b = getButtons();
    if (b.showAllData) {
      b.showAllData.setAttribute('aria-pressed', String(on));
      b.showAllData.classList.toggle('toggle-on', on);
      b.showAllData.textContent = on ? 'Сховати дані' : 'Показати всі дані';
    }
    if (b.showAllColumns) {
      b.showAllColumns.setAttribute('aria-pressed', String(on));
      b.showAllColumns.classList.toggle('toggle-on', on);
      b.showAllColumns.textContent = on ? 'Hide selected columns' : 'Show selected columns';
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
      const shouldShow = !key ? true : (!!state.showAllColumns && visible.has(key));
      cell.classList.toggle('is-hidden-col', !shouldShow);
    });
    syncVisibilityCheckboxes();
    syncToggleButtons();
    try {
      if (typeof PNS.safeWriteBool === 'function') PNS.safeWriteBool(PNS.KEYS.KEY_SHOW_ALL, state.showAllColumns);
      else localStorage.setItem(PNS.KEYS.KEY_SHOW_ALL, state.showAllColumns ? '1' : '0');
    } catch {}
  }

  function toggleColumns() {
    applyColumnVisibility(!state.showAllColumns);
  }

  function normalizeModalKey(name) {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return '';
    if (n === 'settings' || n === 'settings-modal') return 'settings';
    if (n === 'board' || n === 'board-modal') return 'board';
    if (n === 'towerpicker' || n === 'tower-picker' || n === 'picker') return 'towerPicker';
    if (n === 'towerplayeredit' || n === 'tower-player-edit' || n === 'playeredit') return 'towerPlayerEdit';
    if (n === 'towercalc' || n === 'tower-calc' || n === 'calculator') return 'towerCalc';
    return name; // allow custom keys
  }

  function openModal(name) {
    closeModal();
    const key = normalizeModalKey(name);
    const modal = getModals()[key];
    if (!modal) return;
    modal.classList.add('is-open');
    try { MS.updateShiftTabButtons?.(); } catch {}
    syncBodyModalLock();
    state.activeModal = key;
  }

  function closeModal() {
    const modals = getModals();
    Object.values(modals).forEach((m) => m && m.classList.remove('is-open'));
    syncBodyModalLock();
    state.activeModal = null;
  }

  Object.assign(MS, {
    __splitCore: '1',
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
  });
})();
