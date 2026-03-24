/* Final plan tower-calc modal shell helpers */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;
  const modals = PNS.ModalsShift = PNS.ModalsShift || {};
  const { state } = PNS;

  const HELPER_FILL_PRESETS = {
    min: { count: 1, key: 'fill_mode_min', fallback: 'Мінімум' },
    mid: { count: 10, key: 'fill_mode_mid', fallback: 'Середнє' },
    max: { count: 29, key: 'fill_mode_max', fallback: 'Максимум' }
  };

  function tr(key, fallback = '') {
    try {
      return typeof PNS.t === 'function' ? PNS.t(key, fallback) : (fallback || key);
    } catch {
      return fallback || key;
    }
  }

  function normalizeHelperFillMode(value) {
    return String(value || '').toLowerCase() === 'max' ? 'max' : (String(value || '').toLowerCase() === 'min' ? 'min' : 'mid');
  }

  function inferHelperFillMode(calcState) {
    const explicit = String(calcState?.helperFillMode || '').toLowerCase();
    if (explicit === 'min' || explicit === 'mid' || explicit === 'max') return explicit;
    const count = Math.max(1, Math.min(29, Number(calcState?.minHelpersCount || 10) || 10));
    if (calcState?.minHelpersPerTower === false || count <= 1) return 'min';
    if (count >= 29) return 'max';
    return 'mid';
  }

  function applyHelperFillMode(calcState, mode) {
    const nextMode = normalizeHelperFillMode(mode || inferHelperFillMode(calcState));
    const preset = HELPER_FILL_PRESETS[nextMode] || HELPER_FILL_PRESETS.mid;
    if (!calcState || typeof calcState !== 'object') return calcState;
    calcState.helperFillMode = nextMode;
    calcState.minHelpersPerTower = true;
    calcState.minHelpersCount = preset.count;
    return calcState;
  }

  function syncHelperFillModeUi(modal, calcState) {
    if (!modal) return;
    const mode = normalizeHelperFillMode(calcState?.helperFillMode || inferHelperFillMode(calcState));
    const preset = HELPER_FILL_PRESETS[mode] || HELPER_FILL_PRESETS.mid;
    const wrap = modal.querySelector('#towerCalcHelperFillModeWrap');
    const hidden = modal.querySelector('#towerCalcHelperFillMode');
    const btn = modal.querySelector('#towerCalcHelperFillModeBtn');
    const select = modal.querySelector('#towerCalcHelperFillModeSelect');
    const menu = modal.querySelector('#towerCalcHelperFillModeMenu');
    const label = modal.querySelector('.tower-calc-fill-mode-label');
    if (wrap) wrap.dataset.mode = mode;
    if (hidden) hidden.value = mode;
    if (select) select.value = mode;
    if (label) label.textContent = tr('tower_fill_mode', 'Заповнення турелі');
    if (btn) btn.textContent = `${tr(preset.key, preset.fallback)} ▾`;
    if (select) {
      select.querySelector('option[value="min"]') && (select.querySelector('option[value="min"]').textContent = tr('fill_mode_min', 'Мінімум'));
      select.querySelector('option[value="mid"]') && (select.querySelector('option[value="mid"]').textContent = tr('fill_mode_mid', 'Середнє'));
      select.querySelector('option[value="max"]') && (select.querySelector('option[value="max"]').textContent = tr('fill_mode_max', 'Максимум'));
    }
    menu?.querySelectorAll('[data-helper-fill-mode]').forEach(item => {
      const itemMode = normalizeHelperFillMode(item.getAttribute('data-helper-fill-mode'));
      const itemPreset = HELPER_FILL_PRESETS[itemMode] || HELPER_FILL_PRESETS.mid;
      item.textContent = tr(itemPreset.key, itemPreset.fallback);
      item.classList.toggle('is-active', itemMode === mode);
      item.setAttribute('aria-pressed', itemMode === mode ? 'true' : 'false');
    });
  }

  function closeHelperFillModeMenu(scope = document) {
    try {
      const menu = scope.querySelector ? scope.querySelector('#towerCalcHelperFillModeMenu') : document.getElementById('towerCalcHelperFillModeMenu');
      const btn = scope.querySelector ? scope.querySelector('#towerCalcHelperFillModeBtn') : document.getElementById('towerCalcHelperFillModeBtn');
      menu?.classList.remove('open');
      btn?.setAttribute('aria-expanded', 'false');
    } catch {}
  }

  function saveCalcState(calcState) {
    try {
      localStorage.setItem('pns_tower_calc_state', JSON.stringify(calcState || getCalcState()));
    } catch {}
    return calcState;
  }

  function getCalcState() {
    try {
      return typeof window.getCalcState === 'function' ? window.getCalcState() : (state?.towerCalc || {});
    } catch {
      return state?.towerCalc || {};
    }
  }

  function getHydratedCalcState() {
    try {
      return typeof window.getCalcHydratedState === 'function' ? window.getCalcHydratedState() : getCalcState();
    } catch {
      return getCalcState();
    }
  }

  function normalizeShift(shift) {
    return String(shift || '').toLowerCase() === 'shift2' ? 'shift2' : 'shift1';
  }

  function hasAnyCaptains(calcState) {
    try {
      return [...(calcState?.shift1 || []), ...(calcState?.shift2 || [])].some(row => String(row?.captainId || ''));
    } catch {
      return false;
    }
  }

  function ensureTowerCalcModalElement() {
    const modal = document.getElementById('towerCalcModal');
    if (!modal) {
      console.warn('[PNS] towerCalcModal missing in DOM. Add it to partials/modals.partial.html (or create it before opening).');
      return null;
    }

    if (!modal.dataset.zfixBound) {
      modal.dataset.zfixBound = '1';
      const settingsModal = document.getElementById('settings-modal');
      const syncSettingsOverlayState = () => {
        if (!settingsModal) return;
        const isOpen = !!(
          settingsModal.classList.contains('is-open') ||
          (settingsModal.matches && settingsModal.matches(':target')) ||
          getComputedStyle(settingsModal).display !== 'none'
        );
        modal.classList.toggle('tower-calc-under-settings', isOpen);
        modal.classList.toggle('tower-calc-suspended', isOpen);
      };
      try {
        const observer = new MutationObserver(syncSettingsOverlayState);
        if (settingsModal) {
          observer.observe(settingsModal, { attributes: true, attributeFilter: ['class', 'style'] });
        }
      } catch {}
      setTimeout(syncSettingsOverlayState, 0);
    }

    return modal;
  }

  function bindHelperFillModeMenu() {
    if (document.documentElement.dataset.towerCalcHelperFillMenuBound === '1') return;
    document.documentElement.dataset.towerCalcHelperFillMenuBound = '1';

    document.addEventListener('click', event => {
      const btn = event.target.closest('#towerCalcHelperFillModeBtn');
      if (btn) {
        event.preventDefault();
        event.stopPropagation();
        const modal = btn.closest('#towerCalcModal') || document;
        const menu = modal.querySelector('#towerCalcHelperFillModeMenu');
        const willOpen = !menu?.classList.contains('open');
        closeHelperFillModeMenu(modal);
        if (menu && willOpen) {
          menu.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        }
        return;
      }

      const item = event.target.closest('#towerCalcHelperFillModeMenu [data-helper-fill-mode]');
      if (item) {
        event.preventDefault();
        event.stopPropagation();
        const modal = item.closest('#towerCalcModal') || document.getElementById('towerCalcModal');
        const calcState = applyHelperFillMode(getCalcState(), item.getAttribute('data-helper-fill-mode'));
        saveCalcState(calcState);
        syncHelperFillModeUi(modal, calcState);
        closeHelperFillModeMenu(modal || document);
        try { window.computeTowerCalcResults?.(); } catch {}
        try { window.calcRenderLiveFinalBoard?.(modal); } catch {}
        return;
      }

      if (!event.target.closest('#towerCalcHelperFillModeWrap')) {
        closeHelperFillModeMenu(document);
      }
    });


    document.addEventListener('change', event => {
      const select = event.target.closest('#towerCalcHelperFillModeSelect');
      if (!select) return;
      const modal = select.closest('#towerCalcModal') || document.getElementById('towerCalcModal');
      const calcState = applyHelperFillMode(getCalcState(), select.value);
      saveCalcState(calcState);
      syncHelperFillModeUi(modal, calcState);
      try { window.computeTowerCalcResults?.(); } catch {}
      try { window.calcRenderLiveFinalBoard?.(modal); } catch {}
    });

    document.addEventListener('pns:i18n-changed', () => {
      const modal = document.getElementById('towerCalcModal');
      if (modal) syncHelperFillModeUi(modal, applyHelperFillMode(getHydratedCalcState()));
    });
  }

  function renderTowerCalcModalImpl() {
    const modal = ensureTowerCalcModalElement();
    if (!modal) return null;

    const calcState = applyHelperFillMode(getHydratedCalcState());
    saveCalcState(calcState);

    const grid = modal.querySelector('#towerCalcGrid');
    if (grid) {
      grid.innerHTML = PNS.renderHtmlTemplate('tpl-tower-calc-inline-shell', {});
    }

    const both50 = modal.querySelector('#towerCalcBoth50');
    if (both50) both50.checked = !!calcState.both50;

    const ignoreBoth = modal.querySelector('#towerCalcIgnoreBoth');
    if (ignoreBoth) ignoreBoth.checked = !!calcState.ignoreBoth;

    syncHelperFillModeUi(modal, calcState);

    const uiMode = modal.querySelector('#towerCalcModeUi');
    if (uiMode) uiMode.value = calcState.uiMode || 'assisted';

    const applyMode = modal.querySelector('#towerCalcApplyModeUi');
    if (applyMode) applyMode.value = calcState.uiApplyMode || 'topup';

    modal.classList.toggle('is-compact', !!calcState.compactMode);

    try { window.calcApplyTierTargetInputsState?.(modal, calcState); } catch {}
    try { window.calcApplyMainTabUI?.(modal, calcState.mainTab || 'setup'); } catch {}
    try { window.calcApplyActiveTabUI?.(modal, calcState.activeTab || 'shift1'); } catch {}
    try { window.calcUpdateShiftStatsUI?.(modal); } catch {}
    try { window.computeTowerCalcResults?.(); } catch {}
    try { window.calcRenderOverflowReservePanelImpl?.(modal, state?.towerCalcLastResults); } catch {}
    try { window.calcRenderInlineTowerSettings?.(modal); } catch {}
    try { window.calcRenderLiveFinalBoard?.(modal); } catch {}

    return modal;
  }

  function openTowerCalculatorModalImpl() {
    try { modals.ensureStep4Styles?.(); } catch {}

    const calcState = applyHelperFillMode(getCalcState());
    try {
      calcState.mainTab = 'setup';
      calcState.activeTab = normalizeShift(state?.activeShift || 'shift1');
      saveCalcState(calcState);
    } catch {}

    try {
      const hydrated = getHydratedCalcState();
      if (!hasAnyCaptains(hydrated)) {
        window.calcSyncCaptainsFromTowersIntoCalculator?.({ keepHelpers: false, render: false });
      }
    } catch {}

    const modal = renderTowerCalcModalImpl();
    if (!modal) {
      alert(tr('calc_window_not_loaded', 'Вікно розподілу ще не завантажилось. Спробуй ще раз через секунду.'));
      return;
    }

    modal.classList.add('is-open');
    try { modals.syncBodyModalLock?.(); } catch {}
    return modal;
  }

  function openTowerCalculatorPreviewImpl(options = {}) {
    try { modals.ensureStep4Styles?.(); } catch {}

    const previewShift = normalizeShift(options?.shift || state?.activeShift || 'shift1');
    const calcState = applyHelperFillMode(getCalcState());
    try {
      calcState.mainTab = 'preview';
      calcState.activeTab = previewShift;
      calcState.previewShift = previewShift;
      saveCalcState(calcState);
    } catch {}

    try {
      const hydrated = getHydratedCalcState();
      if (!hasAnyCaptains(hydrated)) {
        window.calcSyncCaptainsFromTowersIntoCalculator?.({ keepHelpers: false, render: false });
      }
    } catch {}

    const modal = renderTowerCalcModalImpl();
    if (!modal) {
      alert(tr('calc_window_not_loaded', 'Вікно розподілу ще не завантажилось. Спробуй ще раз через секунду.'));
      return null;
    }

    try {
      const nextState = applyHelperFillMode(getCalcState());
      nextState.mainTab = window.calcApplyMainTabUI?.(modal, 'preview') || 'preview';
      nextState.activeTab = window.calcApplyActiveTabUI?.(modal, previewShift) || previewShift;
      nextState.previewShift = window.calcSetPreviewShift?.(previewShift) || previewShift;
      saveCalcState(nextState);
    } catch {}

    try { window.calcRenderLiveFinalBoard?.(modal); } catch {}
    modal.classList.add('is-open');
    try { modals.syncBodyModalLock?.(); } catch {}
    return modal;
  }

  function closeTowerCalculatorModalImpl() {
    const modal = document.getElementById('towerCalcModal');
    if (!modal) return;
    closeHelperFillModeMenu(modal);
    modal.classList.remove('is-open');
    modal.style.zIndex = '';
    try { modals.syncBodyModalLock?.(); } catch {}
  }

  PNS.calcNormalizeHelperFillMode = normalizeHelperFillMode;
  PNS.calcInferHelperFillMode = inferHelperFillMode;
  PNS.calcApplyHelperFillMode = applyHelperFillMode;
  window.calcNormalizeHelperFillMode = normalizeHelperFillMode;
  window.calcInferHelperFillMode = inferHelperFillMode;
  window.calcApplyHelperFillMode = applyHelperFillMode;
  window.renderTowerCalcModalImpl = renderTowerCalcModalImpl;
  window.openTowerCalculatorModalImpl = openTowerCalculatorModalImpl;
  window.openTowerCalculatorPreviewImpl = openTowerCalculatorPreviewImpl;
  window.closeTowerCalculatorModalImpl = closeTowerCalculatorModalImpl;

  bindHelperFillModeMenu();
})();
