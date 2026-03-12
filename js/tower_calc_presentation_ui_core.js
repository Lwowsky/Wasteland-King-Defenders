(function () {
  'use strict';

  const PNS = window.PNS = window.PNS || {};
  const KEY = '__pns_tower_calc_presentation_core__';
  if (window[KEY]) return;
  window[KEY] = true;

  let applyModeTouched = false;
  let applyPicked = false;

  const q = (s, r = document) => {
    try { return (r || document).querySelector(s); } catch { return null; }
  };
  const qa = (s, r = document) => {
    try { return Array.from((r || document).querySelectorAll(s)); } catch { return []; }
  };
  const byId = (id, r = document) => (r || document).getElementById ? (r || document).getElementById(id) : document.getElementById(id);
  const txt = (el) => String(el?.textContent || '').replace(/\s+/g, ' ').trim();
  const t = (key, fallback = '') => (typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback);

  function ensureClearButtons(root) {
    const toolbar = q('.tower-calc-toolbar-main', root);
    if (!toolbar) return false;
    const ensureBtn = (id, label) => {
      let btn = byId(id, root);
      if (!btn) {
        btn = document.createElement('button');
        btn.className = 'btn btn-sm';
        btn.type = 'button';
        btn.id = id;
        toolbar.appendChild(btn);
      }
      btn.textContent = label;
      return btn;
    };
    ensureBtn('towerCalcClearShift1Btn', t('clear_shift_1', 'Очистити зміну 1'));
    ensureBtn('towerCalcClearShift2Btn', t('clear_shift_2', 'Очистити зміну 2'));
    ensureBtn('towerCalcClearHelpersAllBtn', t('clear_shift_both', 'Очистити зміну 1 + 2'));
    return true;
  }

  function moveButtonsIntoOneRow(root) {
    const toolbarMain = q('.tower-calc-toolbar-main', root);
    if (!toolbarMain) return false;
    toolbarMain.classList.add('tcv7-toolbar-main');
    ['towerCalcLoadCaptainsBtn', 'towerCalcApplyToTowersBtn', 'towerCalcQuickApplyBtn', 'towerCalcClearShift1Btn', 'towerCalcClearShift2Btn', 'towerCalcClearHelpersAllBtn'].forEach((id) => {
      const el = byId(id, root);
      if (el && el.parentElement !== toolbarMain) toolbarMain.appendChild(el);
    });
    return true;
  }

  function moveApplyModeToToolbar(root) {
    const toolbar = q('.tower-calc-toolbar-main', root);
    const controls = q('.tower-calc-controls', root);
    if (!toolbar || !controls) return false;

    const modeLabel = q('label:has(#towerCalcModeUi)', controls) || (byId('towerCalcModeUi', controls)?.closest('label'));
    if (modeLabel) modeLabel.style.display = 'none';

    const hint = qa('.muted', controls).find((el) => /UI skeleton|логіка режимів/i.test(txt(el)));
    if (hint) hint.style.display = 'none';

    const applySelect = byId('towerCalcApplyModeUi', controls) || byId('towerCalcApplyModeUi', root);
    const applyLabel = q('label:has(#towerCalcApplyModeUi)', controls) || applySelect?.closest('label') || null;
    if (!applySelect) return false;

    let wrap = q('#tcv18ApplyModeWrap', root);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'tcv18ApplyModeWrap';
      wrap.className = 'tcv18-apply-wrap';
      toolbar.appendChild(wrap);
    }

    let ph = q('.tcv19-apply-placeholder', wrap);
    if (!ph) {
      ph = document.createElement('span');
      ph.className = 'tcv19-apply-placeholder';
      ph.textContent = t('apply_mode', 'Застосування');
      wrap.appendChild(ph);
    }

    if (applySelect.parentElement !== wrap) wrap.insertBefore(applySelect, ph);
    if (applyLabel) applyLabel.style.display = 'none';
    applySelect.classList.add('tcv18-apply-select');
    wrap.classList.toggle('is-placeholder', !applyModeTouched);

    if (!applySelect.dataset.tcv19Bound) {
      applySelect.dataset.tcv19Bound = '1';
      applySelect.addEventListener('change', () => {
        applyModeTouched = true;
        wrap.classList.remove('is-placeholder');
      });
    }
    return true;
  }

  function normalizeApplyModeUi(root = document) {
    const select = root.querySelector?.('#towerCalcApplyModeUi');
    if (!select) return false;

    const oldWrap = root.querySelector?.('#tcv18ApplyModeWrap');
    if (oldWrap) {
      oldWrap.classList.remove('is-placeholder');
      oldWrap.querySelectorAll?.('.tcv19-apply-placeholder').forEach((n) => n.remove());
      oldWrap.style.position = '';
    }

    const label = select.closest('label');
    if (label) {
      const txtNodes = Array.from(label.childNodes || []).filter((n) => n.nodeType === Node.TEXT_NODE);
      txtNodes.forEach((n) => { if ((n.textContent || '').includes(t('apply_mode', 'Застосування'))) n.textContent = ''; });
      label.classList.add('tcv22-apply-label');
    }

    let ph = select.querySelector('option[data-tcv22-placeholder="1"]');
    if (!ph) {
      ph = document.createElement('option');
      ph.value = '';
      ph.textContent = t('apply_mode', 'Застосування');
      ph.disabled = true;
      ph.hidden = true;
      ph.setAttribute('data-tcv22-placeholder', '1');
      select.insertBefore(ph, select.firstChild || null);
    }

    const map = { topup: t('topup_only', 'Лише дозаповнення'), empty: t('empty_only', 'Лише порожні'), rebalance: t('rebalance_all', 'Повний перерозподіл') };
    qa('option', select).forEach((o) => {
      if (o.value && map[o.value]) o.textContent = map[o.value];
    });

    if (!select.dataset.tcv22Bound) {
      select.addEventListener('change', () => {
        if (select.value) {
          applyPicked = true;
          select.classList.remove('tcv22-placeholder');
        }
      });
      select.dataset.tcv22Bound = '1';
    }

    if (!applyPicked) {
      select.value = '';
      select.classList.add('tcv22-placeholder');
    } else {
      select.classList.remove('tcv22-placeholder');
    }
    return true;
  }

  function ensurePresentationStyles() {
    if (document.getElementById('tcv22-hotfix-style')) return true;
    const st = document.createElement('style');
    st.id = 'tcv22-hotfix-style';
    st.textContent = `
      .tcv22-apply-label{display:inline-flex;align-items:center;gap:0;min-width:200px}
      .tcv22-apply-label select{min-width:210px;height:44px}
      .tcv22-apply-label .tcv19-apply-placeholder{display:none!important}
      #tcv18ApplyModeWrap .tcv19-apply-placeholder{display:none!important}
      #tcv18ApplyModeWrap.is-placeholder .tcv18-apply-select,
      .tcv22-apply-label select.tcv22-placeholder{color:rgba(255,255,255,.92)!important;-webkit-text-fill-color:rgba(255,255,255,.92)!important}
      .tcv22-apply-label select.tcv22-placeholder option{color:#fff}
      @media (max-width: 900px){
        .tcv22-apply-label{min-width:160px;width:100%}
        .tcv22-apply-label select{min-width:0;width:100%}
      }
    `;
    document.head.appendChild(st);
    return true;
  }

  function patchTowerCalcPresentation(root) {
    root = root || document.getElementById('towerCalcModal') || document;
    ensurePresentationStyles();
    ensureClearButtons(root);
    moveButtonsIntoOneRow(root);
    moveApplyModeToToolbar(root);
    normalizeApplyModeUi(root);
    try { PNS.installTowerCalcLayoutUi?.(root); } catch {}
    try { PNS.installTowerCalcSummaryUi?.(root); } catch {}
    return true;
  }

  PNS.ensureTowerCalcPresentationStyles = ensurePresentationStyles;
  PNS.towerCalcNormalizeApplyModeUi = normalizeApplyModeUi;
  PNS.patchTowerCalcPresentation = patchTowerCalcPresentation;
})();
