(function () {
  'use strict';

  const PNS = window.PNS = window.PNS || {};
  const KEY = '__pns_tower_calc_compat_boot__';
  if (window[KEY]) return;
  window[KEY] = true;

  const VERSION = 'phase-17-no-legacy-folder';
  const MODAL_ID = 'towerCalcModal';
  const byId = (id, root = document) => (root && root.getElementById ? root.getElementById(id) : document.getElementById(id));

  function getModal() {
    return PNS.towerCalcGetModal?.() || byId(MODAL_ID) || document.querySelector?.('.modal#towerCalcModal') || null;
  }

  function rawOtherShiftLookup(playerId, currentShift) {
    if (typeof PNS.getOtherShiftHitRaw === 'function') return PNS.getOtherShiftHitRaw(playerId, currentShift);
    return null;
  }

  function restoreCoreBindings() {
    if (typeof PNS.validateAssignCore === 'function') {
      PNS.validateAssign = PNS.validateAssignCore;
    }
    if (typeof PNS.assignPlayerToBaseCore === 'function') {
      const core = PNS.assignPlayerToBaseCore;
      core.__tcv22Wrapped = true;
      core.__pnsV52Patched = true;
      PNS.assignPlayerToBase = core;
    }
    PNS.isPlayerUsedInOtherShift = rawOtherShiftLookup;
    if (PNS.ModalsShift) {
      PNS.ModalsShift.isPlayerUsedInOtherShift = rawOtherShiftLookup;
    }
  }

  function installCoreLayers(root) {
    try { PNS.ensureTowerCalcStyleCore?.(); } catch {}
    try { PNS.installTowerCalcSummaryUi?.(root); } catch {}
    try { PNS.installTowerCalcLayoutUi?.(root); } catch {}
    try { PNS.patchTowerCalcPresentation?.(root); } catch {}
    try { PNS.installTowerCalcRuntimeUi?.(); } catch {}
    try { PNS.installTowerCalcCrossShiftComputeCore?.(); } catch {}
    try { PNS.installTowerCalcToolbarUi?.(root); } catch {}
    try { PNS.installTowerPickerUiCore?.(); } catch {}
  }

  function emitMetadata() {
    const detail = {
      version: VERSION,
      compatBoot: true,
      toolbarUiMovedToCore: typeof PNS.installTowerCalcToolbarUi === 'function',
      pickerUiMovedToCore: typeof PNS.installTowerPickerUiCore === 'function',
      summaryUiMovedToCore: typeof PNS.installTowerCalcSummaryUi === 'function',
      layoutUiMovedToCore: typeof PNS.installTowerCalcLayoutUi === 'function',
      styleUiMovedToCore: typeof PNS.ensureTowerCalcStyleCore === 'function',
      presentationUiMovedToCore: typeof PNS.patchTowerCalcPresentation === 'function',
      runtimeUiMovedToCore: typeof PNS.installTowerCalcRuntimeUi === 'function',
      crossShiftComputeMovedToCore: typeof PNS.installTowerCalcCrossShiftComputeCore === 'function',
      legacyBaseEditorDefaultOff: typeof PNS.isLegacyBaseEditorEnabled === 'function' ? !PNS.isLegacyBaseEditorEnabled() : true,
      legacyBaseEditorCssIsolated: true,
      coreAssignmentsRestored: typeof PNS.assignPlayerToBaseCore === 'function',
      legacyShimsCollapsedIntoCompatBoot: true,
      legacyFolderRemoved: true,
      compatibilityHooks: {
        patchTowerCalcUiV19: typeof window.patchTowerCalcUiV19 === 'function'
      }
    };

    try { window.dispatchEvent(new CustomEvent('pns:refactor:bundle-ready', { detail })); } catch {}
    try { window.dispatchEvent(new CustomEvent('pns:refactor:phase-ready', { detail })); } catch {}
  }

  function run(root) {
    installCoreLayers(root || getModal());
    restoreCoreBindings();
    emitMetadata();
    return true;
  }

  PNS.runTowerCalcCompatBoot = run;
  PNS.patchTowerCalcCompatBoot = function patchTowerCalcCompatBoot(root) {
    run(root || getModal());
    try { return PNS.patchTowerCalcRuntimeUi?.(root || getModal()) || false; } catch { return false; }
  };

  window.patchTowerCalcUiV19 = function patchTowerCalcUiV19() {
    return PNS.patchTowerCalcCompatBoot?.(getModal()) || false;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => run(), { once: true });
  } else {
    run();
  }

  window.addEventListener('load', () => run(), { once: true });
  document.addEventListener('htmx:afterSwap', () => run());
  document.addEventListener('htmx:afterSettle', () => run());
  document.addEventListener('pns:dom:refreshed', () => run());
  document.addEventListener('pns:assignment-changed', () => setTimeout(run, 50));
  document.addEventListener('pns:partials:loaded', () => run());

  let tries = 0;
  const iv = setInterval(() => {
    run();
    tries += 1;
    if (tries > 12) clearInterval(iv);
  }, 250);
})();
