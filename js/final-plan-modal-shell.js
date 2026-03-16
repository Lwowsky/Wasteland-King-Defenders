/* Final plan tower-calc modal shell helpers */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;
  const modals = PNS.ModalsShift = PNS.ModalsShift || {};
  const { state } = PNS;

  function tr(key, fallback = '') {
    try {
      return typeof PNS.t === 'function' ? PNS.t(key, fallback) : (fallback || key);
    } catch {
      return fallback || key;
    }
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

  function saveCalcState(calcState) {
    try {
      localStorage.setItem('pns_tower_calc_state', JSON.stringify(calcState || getCalcState()));
    } catch {}
    return calcState;
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

  function renderTowerCalcModalImpl() {
    const modal = ensureTowerCalcModalElement();
    if (!modal) return null;

    const calcState = getHydratedCalcState();
    const grid = modal.querySelector('#towerCalcGrid');
    if (grid) {
      grid.innerHTML = PNS.renderHtmlTemplate('tpl-tower-calc-inline-shell', {});
    }

    const both50 = modal.querySelector('#towerCalcBoth50');
    if (both50) both50.checked = !!calcState.both50;

    const ignoreBoth = modal.querySelector('#towerCalcIgnoreBoth');
    if (ignoreBoth) ignoreBoth.checked = !!calcState.ignoreBoth;

    const minHelpersOn = modal.querySelector('#towerCalcMinHelpersOn');
    if (minHelpersOn) minHelpersOn.checked = !!calcState.minHelpersPerTower;

    const minHelpersCount = modal.querySelector('#towerCalcMinHelpersCount');
    if (minHelpersCount) {
      minHelpersCount.value = String(Math.max(1, Math.min(30, Number(calcState.minHelpersCount || 10) || 10)));
    }

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

    const calcState = getCalcState();
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
    const calcState = getCalcState();
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
      const nextState = getCalcState();
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
    modal.classList.remove('is-open');
    modal.style.zIndex = '';
    try { modals.syncBodyModalLock?.(); } catch {}
  }

  window.renderTowerCalcModalImpl = renderTowerCalcModalImpl;
  window.openTowerCalculatorModalImpl = openTowerCalculatorModalImpl;
  window.openTowerCalculatorPreviewImpl = openTowerCalculatorPreviewImpl;
  window.closeTowerCalculatorModalImpl = closeTowerCalculatorModalImpl;
})();
