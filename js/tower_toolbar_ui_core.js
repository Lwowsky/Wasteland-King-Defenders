(function () {
  'use strict';

  const PNS = window.PNS = window.PNS || {};
  const KEY = '__pns_tower_toolbar_core__';
  if (window[KEY]) return;
  window[KEY] = true;

  const $ = (sel, root = document) => root.querySelector(sel);

  function readNoCross() {
    try {
      const cb = document.getElementById('towerCalcNoCrossShift') || document.querySelector('#towerCalcModal #towerCalcNoCrossShift');
      if (cb) return !!cb.checked;
    } catch {}
    try {
      const tc = window.PNS?.state?.towerCalc;
      if (tc && typeof tc.noCrossShift === 'boolean') return !!tc.noCrossShift;
    } catch {}
    try {
      const picker = document.getElementById('pickerNoCrossShiftDupes');
      if (picker) return !!picker.checked;
    } catch {}
    try {
      if (typeof window.PNS?.state?.towerPickerNoCrossShiftDupes === 'boolean') {
        return !!window.PNS.state.towerPickerNoCrossShiftDupes;
      }
    } catch {}
    return true;
  }

  function clickEl(el) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }

  function setApplyMode(root, value) {
    const sel = $('#towerCalcApplyModeUi', root);
    if (!sel) return;
    sel.value = value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function makeBtn(text, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-sm';
    b.textContent = text;
    b.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      try { onClick?.(e); } catch (err) { console.warn('[tower_toolbar_ui_core]', err); }
    });
    return b;
  }

  function ensureStyles() {
    if (document.getElementById('pns-tower-toolbar-core-style')) return;
    const s = document.createElement('style');
    s.id = 'pns-tower-toolbar-core-style';
    s.textContent = [
      '#tcv35-row{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:16px 0 18px;overflow:visible}',
      '#tcv35-clearWrap{position:relative;overflow:visible;z-index:20}',
      '#tcv35-clearMenu{position:absolute;right:0;top:calc(100% + 8px);min-width:240px;max-width:min(320px,calc(100vw - 16px));max-height:min(320px,calc(100dvh - 24px));overflow:auto;background:#101a33;border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:8px;box-shadow:0 18px 40px rgba(0,0,0,.35);z-index:260500;display:none}',
      '#tcv35-clearMenu.open{display:block}',
      '#tcv35-clearMenu.open-up{top:auto;bottom:calc(100% + 8px)}',
      '#tcv35-clearMenu .tcv35-item{width:100%;display:block;text-align:left;background:transparent;border:0;color:inherit;padding:10px 12px;border-radius:10px;cursor:pointer}',
      '#tcv35-clearMenu .tcv35-item:hover{background:rgba(255,255,255,.06)}',
      '#towerCalcModal [data-calc-main-panel="setup"] .tower-calc-toolbar > .tower-calc-toolbar-main{display:none !important;}',
      '#towerCalcModal [data-calc-main-panel="setup"] .tower-calc-toolbar > .tower-calc-controls.muted.small{display:none !important;}',
      '#towerCalcModal [data-calc-main-panel="setup"] #towerCalcLoadCaptainsBtn,',
      '#towerCalcModal [data-calc-main-panel="setup"] #towerCalcFitBtn,',
      '#towerCalcModal [data-calc-main-panel="setup"] #towerCalcApplyToTowersBtn,',
      '#towerCalcModal [data-calc-main-panel="setup"] #towerCalcQuickApplyBtn,',
      '#towerCalcModal [data-calc-main-panel="setup"] #towerCalcApplyModeUi,',
      '#towerCalcModal [data-calc-main-panel="setup"] #towerCalcModeUi{display:none !important;}',
      '@media (max-width: 768px){#tcv35-row{gap:10px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px;-webkit-overflow-scrolling:touch} #tcv35-row .btn{width:auto;flex:0 0 auto;white-space:nowrap} #tcv35-clearWrap{width:auto;flex:0 0 auto} #tcv35-clearWrap > .btn{width:auto;white-space:nowrap} #tcv35-clearMenu{min-width:220px;max-width:min(300px,calc(100vw - 12px));max-height:min(300px,calc(100dvh - 16px));right:0}}'
    ].join('');
    document.head.appendChild(s);
  }

  function positionMenu(anchorBtn, menu) {
    if (!anchorBtn || !menu) return;
    menu.classList.remove('open-up');
    const wrap = anchorBtn.parentElement;
    const wrapRect = wrap?.getBoundingClientRect?.() || anchorBtn.getBoundingClientRect();
    const vpH = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const desiredW = Math.min(Math.max(menu.offsetWidth || 260, 220), Math.min(320, (window.innerWidth || 0) - 16));
    menu.style.width = desiredW + 'px';
    const wasHidden = !menu.classList.contains('open');
    if (wasHidden) {
      menu.style.visibility = 'hidden';
      menu.style.display = 'block';
    }
    const measuredH = Math.min(menu.scrollHeight + 4, vpH - 16);
    menu.style.maxHeight = Math.max(140, measuredH) + 'px';
    const spaceBelow = vpH - wrapRect.bottom - 12;
    const needOpenUp = spaceBelow < Math.min(measuredH, 240) && wrapRect.top > spaceBelow;
    if (needOpenUp) menu.classList.add('open-up');
    if (wasHidden) {
      menu.style.display = '';
      menu.style.visibility = '';
    }
  }

  function closeMenuIfNeeded(ev) {
    const wrap = document.getElementById('tcv35-clearWrap');
    const menu = document.getElementById('tcv35-clearMenu');
    if (!wrap || !menu) return;
    if (wrap.contains(ev.target)) return;
    menu.classList.remove('open');
  }

  function bindGlobalMenuCloser() {
    if (document.documentElement.dataset.pnsTowerToolbarCloserBound === '1') return;
    document.documentElement.dataset.pnsTowerToolbarCloserBound = '1';
    document.addEventListener('click', closeMenuIfNeeded);
    window.addEventListener('resize', function () {
      const menu = document.getElementById('tcv35-clearMenu');
      const btn = document.querySelector('#tcv35-clearWrap > .btn');
      if (menu?.classList.contains('open') && btn) positionMenu(btn, menu);
    });
    window.addEventListener('scroll', function () {
      const menu = document.getElementById('tcv35-clearMenu');
      const btn = document.querySelector('#tcv35-clearWrap > .btn');
      if (menu?.classList.contains('open') && btn) positionMenu(btn, menu);
    }, true);
  }

  function build(root) {
    if (!root) return false;
    ensureStyles();
    bindGlobalMenuCloser();

    const toolbarMain = $('.tower-calc-toolbar-main', root);
    const toolbarSub = $('.tower-calc-toolbar .tower-calc-controls.muted.small', root);
    const loadBtn = $('#towerCalcLoadCaptainsBtn', root);
    const fitBtn = $('#towerCalcFitBtn', root);
    const applyLimitsBtn = $('#towerCalcApplyToTowersBtn', root);
    const quickApplyBtn = $('#towerCalcQuickApplyBtn', root);
    const clear1Btn = $('#towerCalcClearShift1Btn', root);
    const clear2Btn = $('#towerCalcClearShift2Btn', root);
    const clearAllBtn = $('#towerCalcClearHelpersAllBtn', root);
    const restoreBtn = $('#towerCalcRestoreImportShiftsBtn', root);

    if (!toolbarMain || !loadBtn || !quickApplyBtn || !toolbarMain.parentNode) return false;

    toolbarMain.style.display = 'none';
    if (toolbarSub) toolbarSub.style.display = 'none';
    if (fitBtn) fitBtn.style.display = 'none';
    if (applyLimitsBtn) applyLimitsBtn.style.display = 'none';
    if (clear1Btn) clear1Btn.style.display = 'none';
    if (clear2Btn) clear2Btn.style.display = 'none';
    if (clearAllBtn) clearAllBtn.style.display = 'none';

    let row = $('#tcv35-row', root);
    if (!row) {
      row = document.createElement('div');
      row.id = 'tcv35-row';
      toolbarMain.parentNode.insertBefore(row, toolbarMain);
    }
    row.innerHTML = '';

    const btnLoad = makeBtn('Підтягнути капітанів', function () { clickEl(loadBtn); });
    const btnRebalance = makeBtn('Застосувати перерозподіл', function () {
      setApplyMode(root, 'rebalance');
      clickEl(quickApplyBtn);
    });
    const btnTopup = makeBtn('Дозаповнити турелі', function () {
      setApplyMode(root, 'topup');
      clickEl(quickApplyBtn);
    });

    const clearWrap = document.createElement('div');
    clearWrap.id = 'tcv35-clearWrap';

    const menu = document.createElement('div');
    menu.id = 'tcv35-clearMenu';

    const clearBtn = makeBtn('Очистити ▾', function (e) {
      e.stopPropagation();
      const opening = !menu.classList.contains('open');
      menu.classList.toggle('open', opening);
      if (opening) positionMenu(clearBtn, menu);
    });

    function menuItem(text, target) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tcv35-item';
      b.textContent = text;
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (target) clickEl(target);
        menu.classList.remove('open');
      });
      return b;
    }

    menu.appendChild(menuItem('Очистити зміну 1', clear1Btn));
    menu.appendChild(menuItem('Очистити зміну 2', clear2Btn));
    menu.appendChild(menuItem('Очистити зміну 1 + 2', clearAllBtn));
    if (restoreBtn) {
      menu.appendChild(menuItem('Відновити з імпорту', restoreBtn));
    }

    clearWrap.appendChild(clearBtn);
    clearWrap.appendChild(menu);

    row.appendChild(btnLoad);
    row.appendChild(btnRebalance);
    row.appendChild(btnTopup);
    row.appendChild(clearWrap);

    return true;
  }

  function install(root) {
    PNS.isTowerNoCrossShiftDupesEnabled = readNoCross;
    const calcRoot = root || document.getElementById('towerCalcModal') || document.querySelector('.tower-calc-main-panel') || document;
    return build(calcRoot);
  }

  PNS.installTowerCalcToolbarUi = install;

  function run() {
    try { install(); } catch (e) { console.warn('[tower_toolbar_ui_core]', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  window.addEventListener('load', run, { once: true });
  document.addEventListener('htmx:afterSwap', run);
  document.addEventListener('pns:dom:refreshed', run);
  document.addEventListener('pns:refactor:core-policy-synced', run);
})();
