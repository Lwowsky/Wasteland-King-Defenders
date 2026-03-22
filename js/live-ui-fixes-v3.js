(function () {
  'use strict';

  const FLAG = '__pns_live_ui_fixes_v6__';
  if (window[FLAG]) return;
  window[FLAG] = true;

  const PNS = window.PNS = window.PNS || {};

  function tr(key, fallback) {
    try {
      if (typeof PNS.t === 'function') return PNS.t(key, fallback);
    } catch {}
    return fallback;
  }

  function towerLabel(value) {
    try {
      if (typeof PNS.towerLabel === 'function') return PNS.towerLabel(value);
    } catch {}
    return String(value || '');
  }

  function getTowerCalcRoot() {
    return document.getElementById('towerCalcModal') || document;
  }

  function setText(el, value) {
    if (!el) return;
    el.textContent = String(value ?? '');
  }

  function syncBaseDomTitle(base, label) {
    if (!base || !label) return;
    const card = base.cardEl && document.contains(base.cardEl) ? base.cardEl : null;
    const board = base.boardEl && document.contains(base.boardEl) ? base.boardEl : null;
    try {
      const cardTitle = card?.querySelector('h3');
      if (cardTitle) cardTitle.textContent = label;
    } catch {}
    try {
      const boardTitle = board?.querySelector('h4');
      if (boardTitle) boardTitle.textContent = label;
    } catch {}
  }

  function localizeBaseTitles() {
    const state = PNS.state || {};
    const bases = Array.isArray(state.bases) ? state.bases : [];
    bases.forEach(function (base) {
      if (!base) return;
      const source = String(base.slot || base.id || base.title || '').trim();
      if (!source) return;
      const label = String(towerLabel(source) || base.title || source).split('/')[0].trim() || String(base.title || source);
      base.title = label;
      syncBaseDomTitle(base, label);
    });

    document.querySelectorAll('.base-card[data-base-id], .base-card[data-baseid], .board-col[data-base-id], .board-col[data-baseid]').forEach(function (node) {
      const baseId = String(node.getAttribute('data-base-id') || node.getAttribute('data-baseid') || '');
      if (!baseId) return;
      const base = state.baseById?.get?.(baseId);
      if (!base) return;
      const label = String(base.title || '').trim();
      if (!label) return;
      const titleEl = node.matches('.board-col') ? node.querySelector('h4') : node.querySelector('h3');
      if (titleEl) titleEl.textContent = label;
    });
  }

  function ensureAdvancedTowerCalcUi(root) {
    const modal = root || getTowerCalcRoot();
    const advanced = modal.querySelector?.('#towerCalcAdvanced');
    if (!advanced) return;

    const inner = advanced.querySelector('.inner') || advanced;
    const layout = inner.querySelector('#tcv7AdvancedTopLayout');
    if (!layout) return;

    let head = inner.querySelector('.tcv-pro-head');
    if (!head) {
      head = document.createElement('div');
      head.className = 'tcv-pro-head';
      head.innerHTML = '<h3 class="tcv-pro-head-title"></h3><div class="tcv-pro-head-actions"></div>';
      inner.insertBefore(head, layout);
    }

    setText(head.querySelector('.tcv-pro-head-title'), tr('parameters_limits', 'Параметри розподілу і ліміти'));

    const actions = head.querySelector('.tcv-pro-head-actions');
    const toolbarRow = modal.querySelector('#tcv35-row');
    if (actions && toolbarRow && toolbarRow.parentElement !== actions) {
      actions.appendChild(toolbarRow);
    }

    const summary = advanced.querySelector(':scope > summary');
    if (summary) {
      summary.textContent = tr('parameters_limits', 'Параметри розподілу і ліміти');
      summary.setAttribute('aria-hidden', 'true');
    }

    const shiftBalance = modal.querySelector('#towerCalcShiftBalance');
    const buttonRow = shiftBalance?.querySelector('#tcv14BtnRow');
    if (shiftBalance && buttonRow && buttonRow.parentElement) {
      let note = shiftBalance.querySelector('#tcvProAddHelp');
      if (!note) {
        note = document.createElement('div');
        note.id = 'tcvProAddHelp';
        note.className = 'tcv-pro-add-help';
        note.innerHTML = '<span class="tcv-pro-add-help-title"></span><span class="tcv-pro-add-help-text"></span>';
        buttonRow.parentElement.insertBefore(note, buttonRow);
      }
      setText(note.querySelector('.tcv-pro-add-help-title'), tr('manual_shift_add_title', 'Для чого потрібні додаткові місця'));
      setText(note.querySelector('.tcv-pro-add-help-text'), tr('manual_shift_add_help', 'Ці поля використовуються, якщо для зміни «Обидві» потрібно вручну додати місця до зміни 1 або 2.'));
    }
  }

  function updateManualLimitTexts(root) {
    const modal = root || getTowerCalcRoot();
    const limitRow = modal.querySelector('#tcv5LimitEditRow');
    if (limitRow) {
      const labelSpan = limitRow.querySelector('span');
      setText(labelSpan, tr('manual_limit_edit', 'Редагувати ліміти вручну'));
    }

    const noteTitle = modal.querySelector('#tcvProAddHelp .tcv-pro-add-help-title');
    const noteText = modal.querySelector('#tcvProAddHelp .tcv-pro-add-help-text');
    setText(noteTitle, tr('manual_shift_add_title', 'Для чого потрібні додаткові місця'));
    setText(noteText, tr('manual_shift_add_help', 'Ці поля використовуються, якщо для зміни «Обидві» потрібно вручну додати місця до зміни 1 або 2.'));
  }

  function updateToolbarTexts(root) {
    const modal = root || getTowerCalcRoot();
    const row = modal.querySelector('#tcv35-row');
    if (!row) return;

    const directButtons = Array.from(row.querySelectorAll(':scope > .btn'));
    if (directButtons[0]) directButtons[0].textContent = tr('rebalance', 'Застосувати перерозподіл');
    if (directButtons[1]) directButtons[1].textContent = tr('topup_turrets', 'Дозаповнити турелі');

    const clearBtn = row.querySelector('#tcv35-clearWrap > .btn');
    if (clearBtn) clearBtn.textContent = tr('clear', 'Очистити') + ' ▾';

    const items = row.querySelectorAll('#tcv35-clearMenu .tcv35-item');
    if (items[0]) items[0].textContent = tr('clear_shift_1', 'Очистити зміну 1');
    if (items[1]) items[1].textContent = tr('clear_shift_2', 'Очистити зміну 2');
    if (items[2]) items[2].textContent = tr('clear_shift_both', 'Очистити зміну 1 + 2');
    if (items[3]) items[3].textContent = tr('restore_from_import', 'Відновити з імпорту');
  }

  function syncLocalizedUi() {
    const modal = getTowerCalcRoot();
    localizeBaseTitles();
    ensureAdvancedTowerCalcUi(modal);
    updateManualLimitTexts(modal);
    updateToolbarTexts(modal);
    try { PNS.bindStrongTowerSettingsButtons?.(); } catch {}
  }

  function delayedSync(delay) {
    window.setTimeout(syncLocalizedUi, Math.max(0, Number(delay) || 0));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      syncLocalizedUi();
      delayedSync(60);
    }, { once: true });
  } else {
    syncLocalizedUi();
    delayedSync(60);
  }

  window.addEventListener('load', function () {
    syncLocalizedUi();
    delayedSync(80);
  }, { once: true });

  document.addEventListener('pns:i18n-changed', function () {
    syncLocalizedUi();
    delayedSync(50);
    delayedSync(140);
  });

  document.addEventListener('pns:i18n-applied', function () {
    syncLocalizedUi();
    delayedSync(50);
  });

  document.addEventListener('pns:dom:refreshed', function () {
    delayedSync(30);
  });

  document.addEventListener('pns:assignment-changed', function () {
    delayedSync(30);
  });
})();
