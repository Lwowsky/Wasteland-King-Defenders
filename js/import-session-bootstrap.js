/* ==== import-session-bootstrap.js ==== */
/* Import wizard: bootstrap */
(function () {
  const e = window.PNS;
  if (!e) return;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const t = e.state;
  const r = wiz.translate;
  const y = wiz.loadCustomOptionalDefs;
  const q = wiz.ensureImportState;
  const O = wiz.renderImportUI;
  const C = wiz.syncFileInputUI;

  function initImportWizard() {
    typeof e.loadFieldLabelOverrides === 'function' && e.loadFieldLabelOverrides();
    typeof e.loadVisibleOptionalColumns === 'function' && e.loadVisibleOptionalColumns();
    t.importData = t.importData || { headers: [], rows: [], mapping: {}, loaded: false };
    t.importData.customOptionalDefs = y();
    q();
    O();
    wiz.restorePreviousPlayersSession?.() ||
      wiz.setImportLoadedInfo?.(
        r(
          'file_not_loaded_yet',
          'Файл ще не завантажено. Завантаж файл або встав публічне CSV-посилання.',
        ),
      );
    wiz.scheduleLateSessionRestore?.();
    wiz.bindImportWizardActions?.();
  }

  function reInitImportWizard() {
    if (!document.querySelector('#settings-modal')) return;
    t.importData = t.importData || { headers: [], rows: [], mapping: {}, loaded: false };
    wiz.bindImportWizardActions?.();
    O();
    [80, 300, 900].forEach((delay) =>
      setTimeout(() => {
        try {
          wiz.restorePreviousPlayersSession?.();
        } catch {}
      }, delay),
    );
    wiz.scheduleLateSessionRestore?.();
  }

  Object.assign(wiz, {
    initImportWizard,
    reInitImportWizard,
  });

  e.initImportWizard = initImportWizard;
  e.reInitImportWizard = reInitImportWizard;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initImportWizard);
  } else {
    initImportWizard();
  }

  document.addEventListener('pns:i18n-changed', () => {
    reInitImportWizard();
    try { C(); } catch {}
  });
})();
