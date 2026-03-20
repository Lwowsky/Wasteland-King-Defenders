(function () {
  'use strict';

  const FLAG = '__pns_tower_calc_advanced_professional__';
  if (window[FLAG]) return;
  window[FLAG] = true;

  const PNS = window.PNS = window.PNS || {};

  function tr(key, fallback) {
    try {
      if (typeof PNS.t === 'function') return PNS.t(key, fallback);
    } catch {}
    return fallback;
  }

  function getRoot(scope) {
    return scope || document.getElementById('towerCalcModal') || document;
  }


  function enhanceShiftBalance(root) {
    const panel = root.querySelector('#towerCalcShiftBalance');
    if (!panel) return false;

    const rightCol = root.querySelector('#tcv7AdvancedRight, #towerCalcAdvanced .tcv9-right-col');
    const shiftLeft = panel.querySelector('.tcv7-shift-left');
    const addRow = panel.querySelector('#tcv14AddRow');
    const buttonRow = panel.querySelector('#tcv14BtnRow');
    const topRow = panel.querySelector('#tcv14TopRow');
    const limitRow = panel.querySelector('#tcv14LimitRow');
    const limitToggle = panel.querySelector('.tcv5-limit-edit-row');
    if (!addRow || !buttonRow) return false;

    if (rightCol) {
      rightCol.style.display = 'flex';
      rightCol.style.justifyContent = 'center';
      rightCol.style.alignItems = 'flex-start';
      rightCol.style.width = '100%';
    }

    panel.style.width = 'min(100%, 760px)';
    panel.style.maxWidth = '760px';
    panel.style.margin = '0 auto';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.alignItems = 'center';
    panel.style.justifyContent = 'flex-start';

    const centeredBlocks = [shiftLeft, limitToggle, topRow, limitRow, addRow, buttonRow].filter(Boolean);
    centeredBlocks.forEach(function (node) {
      node.style.width = 'min(100%, 620px)';
      node.style.maxWidth = '620px';
      node.style.marginLeft = 'auto';
      node.style.marginRight = 'auto';
    });

    if (shiftLeft) {
      shiftLeft.style.display = 'grid';
      shiftLeft.style.gridTemplateColumns = 'minmax(0, 1fr)';
      shiftLeft.style.justifyItems = 'stretch';
      shiftLeft.style.alignContent = 'start';
    }

    let note = panel.querySelector('#tcvProAddHelp');
    if (!note) {
      note = document.createElement('div');
      note.id = 'tcvProAddHelp';
      note.className = 'tcv-pro-add-help';
      note.innerHTML = [
        '<span class="tcv-pro-add-help-title"></span>',
        '<span class="tcv-pro-add-help-text"></span>'
      ].join('');
    }

    const title = note.querySelector('.tcv-pro-add-help-title');
    const text = note.querySelector('.tcv-pro-add-help-text');
    if (title) {
      title.textContent = tr('manual_shift_add_title', 'Для чого потрібні додаткові місця');
    }
    if (text) {
      text.textContent = tr(
        'manual_shift_add_help',
        'Ці поля використовуються, якщо для зміни «Обидві» потрібно вручну додати місця до зміни 1 або 2.'
      );
    }

    if (note.parentElement !== panel.querySelector('#tcv14AddRow')?.parentElement) {
      buttonRow.parentElement.insertBefore(note, buttonRow);
    } else if (note.nextElementSibling !== buttonRow) {
      buttonRow.parentElement.insertBefore(note, buttonRow);
    }

    note.style.width = 'min(100%, 620px)';
    note.style.maxWidth = '620px';
    note.style.marginLeft = 'auto';
    note.style.marginRight = 'auto';

    return true;
  }

  function install(scope) {
    const root = getRoot(scope);
    const advanced = root.querySelector('#towerCalcAdvanced');
    if (!advanced) return false;

    advanced.open = true;

    const inner = advanced.querySelector('.inner') || advanced;
    const layout = inner.querySelector('#tcv7AdvancedTopLayout');
    if (!layout) return false;

    enhanceShiftBalance(root);

    let head = inner.querySelector('.tcv-pro-head');
    if (!head) {
      head = document.createElement('div');
      head.className = 'tcv-pro-head';
      head.innerHTML = [
        '<h3 class="tcv-pro-head-title"></h3>',
        '<div class="tcv-pro-head-actions"></div>'
      ].join('');
      inner.insertBefore(head, layout);
    }

    const titleEl = head.querySelector('.tcv-pro-head-title');
    if (titleEl) {
      titleEl.textContent = tr('parameters_limits', 'Параметри розподілу і ліміти');
    }

    const toolbarRow = root.querySelector('#tcv35-row');
    const actionsEl = head.querySelector('.tcv-pro-head-actions');
    if (toolbarRow && actionsEl && toolbarRow.parentElement !== actionsEl) {
      actionsEl.appendChild(toolbarRow);
    }

    const summary = advanced.querySelector(':scope > summary');
    if (summary) {
      summary.textContent = tr('parameters_limits', 'Параметри розподілу і ліміти');
      summary.setAttribute('aria-hidden', 'true');
      summary.addEventListener('click', function (event) {
        event.preventDefault();
        advanced.open = true;
      });
    }

    const buttons = head.querySelectorAll('#tcv35-row .btn');
    buttons.forEach(function (btn) {
      btn.classList.add('btn-sm');
    });

    return true;
  }

  function scheduleInstall(scope) {
    install(scope);
    requestAnimationFrame(function () {
      install(scope);
    });
    setTimeout(function () {
      install(scope);
    }, 60);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      scheduleInstall(document);
    }, { once: true });
  } else {
    scheduleInstall(document);
  }

  window.addEventListener('load', function () {
    scheduleInstall(document);
  }, { once: true });

  document.addEventListener('pns:dom:refreshed', function (event) {
    scheduleInstall(event && event.target ? event.target : document);
  });

  document.addEventListener('click', function (event) {
    const trigger = event.target && event.target.closest && event.target.closest('[data-modal="towerCalc"], #openTowerCalcBtn, #openTowerCalcBtnMobile, [data-calc-main-tab="setup"]');
    if (trigger) {
      setTimeout(function () {
        scheduleInstall(document);
      }, 20);
    }
  }, true);
})();
