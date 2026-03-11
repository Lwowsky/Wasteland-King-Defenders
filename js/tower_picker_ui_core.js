(function () {
  const PNS = window.PNS = window.PNS || {};
  const state = PNS.state = PNS.state || {};
  const LS_INIT = 'pns_v53_picker_core_init_done';

  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function txt(el) { return String(el?.textContent || '').replace(/\s+/g, ' ').trim(); }

  function ensureStyle() {
    if (document.getElementById('pns-v53-picker-core-style')) return;
    const style = document.createElement('style');
    style.id = 'pns-v53-picker-core-style';
    style.textContent = `
      #towerPickerModal label:has(#pickerOnlyCaptains),
      #towerPickerModal label:has(#pickerNoCrossShiftDupes),
      #towerCalcModal label:has(#towerCalcNoCrossShift),
      #towerCalcModal .form-check:has(#towerCalcNoCrossShift),
      #towerCalcModal .row:has(#towerCalcNoCrossShift),
      #towerCalcModal #towerCalcAutoSlotsS1Btn,
      #towerCalcModal #towerCalcAutoSlotsS2Btn,
      #towerCalcModal #applyShiftAddBtn,
      #towerCalcModal #towerCalcRestoreImportShiftsBtn,
      #towerCalcModal #towerCalcShiftBalance #applyShiftAddBtn,
      #towerCalcModal #towerCalcShiftBalance #towerCalcRestoreImportShiftsBtn {
        width: 100% !important;
        min-width: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function lsBool(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      if (v === null) return fallback;
      return v === '1';
    } catch {
      return fallback;
    }
  }

  function initDefaultsOnce() {
    let done = false;
    try { done = localStorage.getItem(LS_INIT) === '1'; } catch {}
    if (!done) {
      try {
        if (localStorage.getItem('pns_picker_only_captains') === null) localStorage.setItem('pns_picker_only_captains', '0');
        if (localStorage.getItem('pns_picker_match_registered_shift') === null) localStorage.setItem('pns_picker_match_registered_shift', '1');
        if (localStorage.getItem('pns_picker_no_mix_troops') === null) localStorage.setItem('pns_picker_no_mix_troops', '1');
        if (localStorage.getItem('pns_picker_no_cross_shift_dupes') === null) localStorage.setItem('pns_picker_no_cross_shift_dupes', '0');
        localStorage.setItem(LS_INIT, '1');
      } catch {}
    }
  }

  function normalizeStateDefaults() {
    if (typeof state.towerPickerOnlyCaptains !== 'boolean') state.towerPickerOnlyCaptains = lsBool('pns_picker_only_captains', false);
    if (typeof state.towerPickerNoCrossShiftDupes !== 'boolean') state.towerPickerNoCrossShiftDupes = lsBool('pns_picker_no_cross_shift_dupes', false);
    if (typeof state.towerPickerMatchRegisteredShift !== 'boolean') state.towerPickerMatchRegisteredShift = lsBool('pns_picker_match_registered_shift', true);
    if (typeof state.towerPickerNoMixTroops !== 'boolean') state.towerPickerNoMixTroops = lsBool('pns_picker_no_mix_troops', true);
  }

  function sameTroopEnabled() {
    const live = document.getElementById('pickerNoMixTroops') || document.querySelector('#towerPickerModal #pickerNoMixTroops');
    if (live) return !!live.checked;
    return state.towerPickerNoMixTroops !== false;
  }

  function matchShiftEnabled() {
    const live = document.getElementById('pickerMatchRegisteredShift') || document.querySelector('#towerPickerModal #pickerMatchRegisteredShift');
    if (live) return !!live.checked;
    return state.towerPickerMatchRegisteredShift !== false;
  }

  function setLabelTextForInput(inputId, labelText, root) {
    const input = q('#' + inputId, root);
    if (!input) return;
    const label = input.closest('label');
    if (!label) return;
    const span = qa('span', label).find((el) => el !== input);
    if (span) {
      span.textContent = labelText;
      return;
    }
    const nodes = Array.from(label.childNodes).filter((n) => n.nodeType === 3);
    if (nodes.length) {
      nodes[nodes.length - 1].nodeValue = ' ' + labelText;
      return;
    }
    label.appendChild(document.createTextNode(' ' + labelText));
  }

  function hideLabelForInput(inputId, root) {
    const input = q('#' + inputId, root);
    if (!input) return;
    const label = input.closest('label');
    if (label) label.style.display = 'none';
  }

  function hideNoCrossFromCalc(root) {
    hideLabelForInput('towerCalcNoCrossShift', root);
    qa('label,.form-check,.row,div', root).forEach((el) => {
      const t = txt(el);
      if (/^Без дублювання helper-ів між shifts$/i.test(t) || /No cross-shift duplicates/i.test(t)) {
        el.style.display = 'none';
      }
    });
  }

  function applyCalcUi() {
    const modal = document.getElementById('towerCalcModal');
    if (!modal) return;
    hideNoCrossFromCalc(modal);
    const autos1 = q('#towerCalcAutoSlotsS1Btn', modal); if (autos1) autos1.style.display = 'none';
    const autos2 = q('#towerCalcAutoSlotsS2Btn', modal); if (autos2) autos2.style.display = 'none';
    const restore = q('#towerCalcRestoreImportShiftsBtn', modal); if (restore) restore.style.display = 'none';
    const apply = q('#applyShiftAddBtn', modal); if (apply) { apply.style.width = '100%'; apply.style.minWidth = '0'; }
  }

  function applyPickerUi() {
    const modal = document.getElementById('towerPickerModal');
    if (!modal) return;
    hideLabelForInput('pickerOnlyCaptains', modal);
    hideLabelForInput('pickerNoCrossShiftDupes', modal);
    setLabelTextForInput('pickerMatchRegisteredShift', 'Зазначений Shift', modal);
    setLabelTextForInput('pickerNoMixTroops', 'Лише той самий тип військ', modal);

    const onlyCb = q('#pickerOnlyCaptains', modal);
    const shiftCb = q('#pickerMatchRegisteredShift', modal);
    const mixCb = q('#pickerNoMixTroops', modal);
    const bothCb = q('#pickerNoCrossShiftDupes', modal);
    if (onlyCb) onlyCb.checked = !!state.towerPickerOnlyCaptains;
    if (shiftCb) shiftCb.checked = !!matchShiftEnabled();
    if (mixCb) mixCb.checked = !!sameTroopEnabled();
    if (bothCb) bothCb.checked = !!state.towerPickerNoCrossShiftDupes;
  }

  function patchPickerRenderer() {
    const MS = PNS.ModalsShift;
    if (!MS || !MS.updateTowerPickerDetail || MS.updateTowerPickerDetail.__pnsV53CoreWrapped) return;
    const original = MS.updateTowerPickerDetail;
    MS.updateTowerPickerDetail = function wrappedUpdateTowerPickerDetail() {
      const res = original.apply(this, arguments);
      applyPickerUi();
      return res;
    };
    MS.updateTowerPickerDetail.__pnsV53CoreWrapped = true;
  }

  function installExports() {
    PNS.isTowerNoMixTroopsEnabled = sameTroopEnabled;
    PNS.isTowerMatchRegisteredShiftEnabled = matchShiftEnabled;
    if (PNS.ModalsShift) {
      PNS.ModalsShift.isPickerNoMixTroopsEnabled = sameTroopEnabled;
    }
  }

  function run() {
    ensureStyle();
    initDefaultsOnce();
    normalizeStateDefaults();
    patchPickerRenderer();
    applyCalcUi();
    applyPickerUi();
    installExports();
  }

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t || !t.id) return;
    if (t.id === 'pickerOnlyCaptains') {
      state.towerPickerOnlyCaptains = !!t.checked;
      try { localStorage.setItem('pns_picker_only_captains', t.checked ? '1' : '0'); } catch {}
    }
    if (t.id === 'pickerMatchRegisteredShift') {
      state.towerPickerMatchRegisteredShift = !!t.checked;
      try { localStorage.setItem('pns_picker_match_registered_shift', t.checked ? '1' : '0'); } catch {}
    }
    if (t.id === 'pickerNoMixTroops') {
      state.towerPickerNoMixTroops = !!t.checked;
      try { localStorage.setItem('pns_picker_no_mix_troops', t.checked ? '1' : '0'); } catch {}
    }
    if (t.id === 'pickerNoCrossShiftDupes') {
      state.towerPickerNoCrossShiftDupes = !!t.checked;
      try { localStorage.setItem('pns_picker_no_cross_shift_dupes', t.checked ? '1' : '0'); } catch {}
    }
    setTimeout(run, 0);
  }, true);

  PNS.installTowerPickerUiCore = run;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  window.addEventListener('load', run, { once: true });
  document.addEventListener('htmx:afterSwap', run);
  document.addEventListener('htmx:afterSettle', run);
  document.addEventListener('pns:assignment-changed', () => setTimeout(run, 50));
  document.addEventListener('pns:partials:loaded', run);

  let tries = 0;
  const iv = setInterval(() => {
    run();
    tries += 1;
    if (tries > 40) clearInterval(iv);
  }, 250);
})();
