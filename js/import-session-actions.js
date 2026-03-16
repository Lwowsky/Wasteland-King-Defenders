/* ==== import-session-actions.js ==== */
/* Import wizard: action bindings and late restore */
(function () {
  const e = window.PNS;
  if (!e) return;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const t = e.state;
  const session = (wiz.__sessionBootstrapState = wiz.__sessionBootstrapState || {
    restoreRetryTimers: [],
    lateRestoreTimer: 0,
  });
  const C = wiz.syncFileInputUI;
  const Y = wiz.handleImportFileChange;
  const J = wiz.handleLoadUrlClick;
  const K = wiz.handleDetectColumns;
  const U = wiz.saveImportTemplate;
  const G = wiz.applyImportedPlayers;
  const Q = wiz.handleSaveVisibleColumnsClick;
  const P = wiz.applyImportedPlayersPreservePlan;

  function ensurePreservePlanButton(actions) {
    const applyBtn = actions.applyImportMockBtn;
    if (!applyBtn || typeof document === 'undefined') return null;
    let button = document.querySelector('#applyImportPreservePlanBtn');
    if (!button) {
      const host = applyBtn.parentElement || applyBtn.closest('.import-source-actions') || null;
      if (!host) return null;
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'applyImportPreservePlanBtn';
      button.className = 'btn';
      button.setAttribute('data-import-preserve-plan', '1');
      host.appendChild(button);
    }
    const label = wiz.translate?.(
      'apply_import_keep_plan',
      'Оновити склад + зберегти план',
    ) || 'Оновити склад + зберегти план';
    button.textContent = label;
    button.title = wiz.translate?.(
      'apply_import_keep_plan_hint',
      'Оновити таблицю з нового файлу, але не скидати фінальний план і турелі.',
    ) || 'Оновити таблицю з нового файлу, але не скидати фінальний план і турелі.';
    return button;
  }

  function bindImportWizardActions() {
    const actions = wiz.getImportActionNodes?.() || {};
    if (actions.fileInputMock && !actions.fileInputMock.dataset.bound) {
      actions.fileInputMock.dataset.bound = '1';
      actions.fileInputMock.addEventListener('change', Y);
    }
    if (actions.fileInputMock) {
      try { C(); } catch {}
    }
    if (actions.loadUrlMockBtn && !actions.loadUrlMockBtn.dataset.bound) {
      actions.loadUrlMockBtn.dataset.bound = '1';
      actions.loadUrlMockBtn.addEventListener('click', J);
    }
    if (actions.detectColumnsMockBtn && !actions.detectColumnsMockBtn.dataset.bound) {
      actions.detectColumnsMockBtn.dataset.bound = '1';
      actions.detectColumnsMockBtn.addEventListener('click', () => {
        actions.urlInputMock?.value?.trim() && !(t.importData.headers || []).length ? J() : K();
      });
    }
    if (actions.saveVisibleColumnsMockBtn && !actions.saveVisibleColumnsMockBtn.dataset.bound) {
      actions.saveVisibleColumnsMockBtn.dataset.bound = '1';
      actions.saveVisibleColumnsMockBtn.addEventListener('click', Q);
    }
    (actions.saveTemplateMockBtns || []).forEach((button) => {
      if (!button.dataset.bound) {
        button.dataset.bound = '1';
        button.addEventListener('click', U);
      }
    });
    if (actions.applyImportMockBtn && !actions.applyImportMockBtn.dataset.bound) {
      actions.applyImportMockBtn.dataset.bound = '1';
      actions.applyImportMockBtn.addEventListener('click', G);
    }
    const preserveBtn = ensurePreservePlanButton(actions);
    if (preserveBtn && !preserveBtn.dataset.bound) {
      preserveBtn.dataset.bound = '1';
      preserveBtn.addEventListener('click', P);
    }
  }

  function scheduleLateSessionRestore() {
    try { session.lateRestoreTimer && clearTimeout(session.lateRestoreTimer); } catch {}
    session.lateRestoreTimer = setTimeout(() => {
      try {
        wiz.restorePreviousPlayersSession?.();
      } catch (error) {
        console.warn('[PNS] late session restore failed', error);
      }
    }, 120);
  }

  Object.assign(wiz, {
    bindImportWizardActions,
    scheduleLateSessionRestore,
  });
})();
