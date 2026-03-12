(function () {
  'use strict';

  const PNS = window.PNS = window.PNS || {};
  const KEY = '__pns_tower_calc_layout_core__';
  if (window[KEY]) return;
  window[KEY] = true;

  const MODAL_ID = 'towerCalcModal';

  const q = (s, r = document) => r ? r.querySelector(s) : null;
  const qa = (s, r = document) => Array.from((r || document).querySelectorAll(s));
  const byId = (id, r = document) => (r || document).getElementById ? (r || document).getElementById(id) : document.getElementById(id);
  const txt = (el) => String(el?.textContent || '').replace(/\s+/g, ' ').trim();

  function readUiState() {
    try { return PNS.towerCalcReadUiState?.() || {}; } catch {}
    try { return JSON.parse(localStorage.getItem('pns_tower_calc_ui_patch_v21') || '{}') || {}; } catch { return {}; }
  }

  function getModal() {
    try { return PNS.towerCalcGetModal?.() || byId(MODAL_ID); } catch { return byId(MODAL_ID); }
  }

  function findShiftLimitInputs(root) {
    try {
      const found = PNS.towerCalcFindShiftLimitInputs?.(root);
      if (found) return found;
    } catch {}
    return { shift1: null, shift2: null };
  }

  function findWrappedLabel(root, inputId) {
    try { return PNS.towerCalcFindWrappedLabel?.(root, inputId) || null; } catch { return null; }
  }

  function mergeStatsIntoAdvanced(root) {
    const advanced = q('#towerCalcAdvanced', root);
    const inner = advanced?.querySelector('.inner') || advanced;
    const balance = q('#towerCalcShiftBalance', root);
    if (!advanced || !inner || !balance) return false;
    if (!inner.contains(balance)) inner.appendChild(balance);
    return true;
  }

function enforceIgnoreBoth(root) {
  const useBoth = !!(window.PNS?.state?.towerPickerNoCrossShiftDupes === true);

  const ig = q('#towerCalcIgnoreBoth', root);
  if (ig) {
    const nextIgnoreBoth = !useBoth;
    const changed = ig.checked !== nextIgnoreBoth;
    ig.checked = nextIgnoreBoth;
    ig.disabled = true;
    const label = ig.closest('label');
    if (label) label.style.display = 'none';
    if (changed) {
      try { ig.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
    }
  }

  const both50 = q('#towerCalcBoth50', root);
  const noCross = q('#towerCalcNoCrossShift', root);
  if (both50) {
    const nextBoth50 = !!(useBoth && (noCross ? !!noCross.checked : true));
    const changedBoth50 = both50.checked !== nextBoth50;
    both50.checked = nextBoth50;
    both50.disabled = true;
    const label = both50.closest('label');
    if (label) label.style.display = 'none';
    if (changedBoth50) {
      try { both50.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
    }
  }
  return !!(ig || both50);
}

  function hideAndTranslate(root) {
    const hide = (sel) => { const el = q(sel, root); if (el) el.style.display = 'none'; };
    hide('#split5050Btn');
    hide('#towerCalcApplyAndAssignBtn');
    hide('#towerCalcRecalcBtn');
    hide('#towerCalcFitBtn');
    hide('#towerCalcAutoFitBtn');

    const bothLabel = q('#towerCalcBoth50', root)?.closest('label');
    if (bothLabel) bothLabel.style.display = 'none';
    const ignoreLabel = q('#towerCalcIgnoreBoth', root)?.closest('label');
    if (ignoreLabel) ignoreLabel.style.display = 'none';
    const forceLabel = q('#shiftSplitForceChk', root)?.closest('label');
    if (forceLabel) forceLabel.style.display = 'none';

    const loadBtn = q('#towerCalcLoadCaptainsBtn', root);
    if (loadBtn) loadBtn.textContent = 'Взяти капітанів із турелей';
    const applyBtn = q('#towerCalcApplyToTowersBtn', root);
    if (applyBtn) applyBtn.textContent = 'Застосувати ліміти';
    const quickBtn = q('#towerCalcQuickApplyBtn', root);
    if (quickBtn) quickBtn.textContent = 'Автозаповнення башень';

    const adv = q('#towerCalcAdvanced summary', root);
    if (adv) adv.textContent = 'Параметри розподілу і ліміти';

    const modeSel = q('#towerCalcModeUi', root);
    if (modeSel) {
      const map = { assisted: 'Підказки', auto: 'Авто', manual: 'Ручний' };
      qa('option', modeSel).forEach((o) => { o.textContent = map[o.value] || o.textContent; });
    }
    const applyMode = q('#towerCalcApplyModeUi', root);
    if (applyMode) {
      const map = { topup: 'Лише дозаповнення', empty: 'Лише порожні', rebalance: 'Повний перерозподіл' };
      qa('option', applyMode).forEach((o) => { o.textContent = map[o.value] || o.textContent; });
    }

    qa('.muted.small', root).forEach((el) => {
      const t = txt(el);
      if (/UI skeleton/i.test(t)) el.style.display = 'none';
      if (/Auto slots =|місця для помічників/i.test(t)) {
        el.textContent = 'Автослоти = швидкий розподіл місць для помічників по турелях за кількістю вільних гравців без капітанів.';
      }
      if (/Порада:|Порахувати/i.test(t)) {
        el.textContent = 'Спочатку вистав ліміти shift-ів і башень, потім використай “Застосувати ліміти” або “Автозаповнення башень”.';
      }
      if (/Ліміти зміщень:/i.test(t)) {
        el.style.display = 'none';
      }
    });
    return true;
  }

  function layoutAdvancedColumns(root) {
    const advanced = q('#towerCalcAdvanced', root);
    const inner = advanced?.querySelector('.inner') || advanced;
    const balance = q('#towerCalcShiftBalance', root);
    if (!advanced || !inner || !balance) return false;

    const controls = q('.tower-calc-controls', advanced);
    const tierHintRows = qa('.muted.small', advanced).filter((el) => /Спочатку вистав|Порада:|Tier-size|Розмір tier/i.test(txt(el)));
    const tip = tierHintRows.find((el) => /Спочатку вистав|Порада:/i.test(txt(el))) || null;
    const tierRow = q('#towerCalcTierTargetRow', advanced)?.closest('.muted.small') || tierHintRows.find((el) => /Розмір tier/i.test(txt(el))) || null;

    let wrap = q('#tcv7AdvancedTopLayout', advanced);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'tcv7AdvancedTopLayout';
      wrap.className = 'tcv7-advanced-layout';
      inner.insertBefore(wrap, balance);
    }
    let left = q('#tcv7AdvancedLeft', wrap);
    if (!left) {
      left = document.createElement('section');
      left.id = 'tcv7AdvancedLeft';
      left.className = 'tcv7-advanced-left';
      wrap.appendChild(left);
    }
    let right = q('#tcv7AdvancedRight', wrap);
    if (!right) {
      right = document.createElement('section');
      right.id = 'tcv7AdvancedRight';
      right.className = 'tcv7-advanced-right';
      wrap.appendChild(right);
    }

    let leftPanel = q('#tcv9LeftPanel', left);
    if (!leftPanel) {
      leftPanel = document.createElement('div');
      leftPanel.id = 'tcv9LeftPanel';
      leftPanel.className = 'tcv9-left-panel';
      left.appendChild(leftPanel);
    }
    let compactControls = q('#tcv9CompactControls', leftPanel);
    if (!compactControls) {
      compactControls = document.createElement('div');
      compactControls.id = 'tcv9CompactControls';
      compactControls.className = 'tcv9-compact-controls';
      leftPanel.appendChild(compactControls);
    }
    let tierPanel = q('#tcv9TierPanel', leftPanel);
    if (!tierPanel) {
      tierPanel = document.createElement('div');
      tierPanel.id = 'tcv9TierPanel';
      tierPanel.className = 'tcv9-tier-panel';
      leftPanel.appendChild(tierPanel);
    }

    const summary = q('summary', advanced);
    if (summary) summary.textContent = 'Параметри розподілу і ліміти';

    if (controls && controls.parentElement !== compactControls) compactControls.appendChild(controls);
    if (tierRow && tierRow.parentElement !== tierPanel) tierPanel.appendChild(tierRow);
    if (tip && tip.parentElement !== tierPanel) tierPanel.appendChild(tip);
    if (balance && balance.parentElement !== right) right.appendChild(balance);

    left.classList.add('tcv9-left-col');
    right.classList.add('tcv9-right-col');

    qa('.muted.small', advanced).forEach((el) => {
      if (el !== tierRow && el !== tip && el.closest('#tcv9TierPanel')) return;
      if (/Tier-size|Розмір tier/i.test(txt(el)) && el !== tierRow) el.style.display = 'none';
    });
    return true;
  }

  function syncLimitEditability(root) {
    const { shift1, shift2 } = findShiftLimitInputs(root);
    const enabled = !!readUiState().manualLimitEdit;
    [shift1, shift2].forEach((el) => {
      if (!el) return;
      el.disabled = !enabled;
      el.classList.toggle('tcv7-disabled-input', !enabled);
      const label = el.closest('label');
      if (label) label.classList.toggle('is-disabled', !enabled);
    });
    return true;
  }

  function ensureManualLimitToggle(root) {
    const balance = q('#towerCalcShiftBalance', root);
    if (!balance) return false;
    let row = q('#tcv5LimitEditRow', balance);
    if (!row) {
      row = document.createElement('div');
      row.id = 'tcv5LimitEditRow';
      row.className = 'tcv5-limit-edit-row';
      row.innerHTML = '<label class="tcv5-limit-toggle"><input id="tcv5EnableShiftLimits" type="checkbox" /><span>Редагувати ліміти вручну</span></label>';
      const controls = q('.tower-calc-shift-controls', balance);
      if (controls) balance.insertBefore(row, controls);
      else balance.appendChild(row);
    }
    const check = q('#tcv5EnableShiftLimits', balance);
    if (check) check.checked = !!readUiState().manualLimitEdit;
    syncLimitEditability(root);
    return true;
  }

  function restyleShiftControls(root) {
    const balance = q('#towerCalcShiftBalance', root);
    if (!balance) return false;
    balance.classList.add('tcv7-shift-balance');
    const controls = q('.tower-calc-shift-controls', balance);
    const left = q('.tower-calc-shift-controls-left', balance);
    const right = q('.tower-calc-shift-controls-right', balance);
    if (!controls || !left || !right) return false;

    controls.classList.add('tcv14-single-card');
    if (left.parentElement !== controls) controls.appendChild(left);
    if (right.parentElement !== controls) controls.appendChild(right);

    left.classList.add('tcv7-shift-left');
    right.classList.add('tcv7-shift-right');

    const limitEditRow = q('#tcv5LimitEditRow', balance);
    let topRow = q('#tcv14TopRow', left);
    if (!topRow) {
      topRow = document.createElement('div');
      topRow.id = 'tcv14TopRow';
      topRow.className = 'tcv14-top-row';
      left.prepend(topRow);
    }

    let limitRow = q('#tcv14LimitRow', left);
    if (!limitRow) {
      limitRow = document.createElement('div');
      limitRow.id = 'tcv14LimitRow';
      limitRow.className = 'tcv7-form-row tcv7-form-row-2';
      left.appendChild(limitRow);
    }

    let addRow = q('#tcv14AddRow', left);
    if (!addRow) {
      addRow = document.createElement('div');
      addRow.id = 'tcv14AddRow';
      addRow.className = 'tcv7-form-row tcv7-form-row-2';
      left.appendChild(addRow);
    }

    let btnRow = q('#tcv14BtnRow', left);
    if (!btnRow) {
      btnRow = document.createElement('div');
      btnRow.id = 'tcv14BtnRow';
      btnRow.className = 'tcv7-btn-row tcv14-btn-row';
      left.appendChild(btnRow);
    }

    const limits = findShiftLimitInputs(root);
    const limit1Label = limits.shift1?.closest('label') || null;
    const limit2Label = limits.shift2?.closest('label') || null;
    const add1Label = findWrappedLabel(balance, 'shiftAddS1');
    const add2Label = findWrappedLabel(balance, 'shiftAddS2');
    const applyBtn = byId('applyShiftAddBtn', balance);
    const restoreBtn = byId('towerCalcRestoreImportShiftsBtn', balance)
      || byId('restoreShiftImportBtn', balance)
      || qa('#towerCalcShiftBalance .btn', root).find((el) => /відновити\s+з\s+імпорту/i.test(txt(el)))
      || q('#towerCalcShiftBalance .btn[id*="Restore"]', root)
      || q('#towerCalcShiftBalance .btn[id*="restore"]', root);
    const forceLabel = q('.tower-calc-shift-force', balance);
    const autos = q('.tower-calc-autoslots', balance) || q('.tower-calc-autoslots', right);

    if (limitEditRow && limitEditRow.parentElement != topRow) topRow.appendChild(limitEditRow);
    if (limitEditRow) limitEditRow.style.display = 'flex';

    [limit1Label, limit2Label].filter(Boolean).forEach((el) => { if (el.parentElement !== limitRow) limitRow.appendChild(el); });
    [add1Label, add2Label].filter(Boolean).forEach((el) => { if (el.parentElement !== addRow) addRow.appendChild(el); });

    qa('#towerCalcShiftBalance .btn', root).forEach((el) => {
      if (el !== restoreBtn && /відновити\s+з\s+імпорту/i.test(txt(el))) el.style.display = 'none';
    });
    [applyBtn, restoreBtn].filter(Boolean).forEach((el) => { if (el.parentElement !== btnRow) btnRow.appendChild(el); });
    if (applyBtn) applyBtn.style.display = '';
    if (restoreBtn) restoreBtn.style.display = '';

    if (autos && autos.parentElement !== topRow) topRow.appendChild(autos);
    if (autos) autos.classList.add('tcv14-autos-inline');

    if (forceLabel) forceLabel.style.display = 'none';
    right.style.display = 'none';
    return true;
  }

  function install(root) {
    const calcRoot = root || getModal() || document;
    mergeStatsIntoAdvanced(calcRoot);
    enforceIgnoreBoth(calcRoot);
    hideAndTranslate(calcRoot);
    layoutAdvancedColumns(calcRoot);
    ensureManualLimitToggle(calcRoot);
    restyleShiftControls(calcRoot);
    return true;
  }

  PNS.towerCalcMergeStatsIntoAdvanced = mergeStatsIntoAdvanced;
  PNS.towerCalcEnforceIgnoreBoth = enforceIgnoreBoth;
  PNS.towerCalcHideAndTranslate = hideAndTranslate;
  PNS.towerCalcLayoutAdvancedColumns = layoutAdvancedColumns;
  PNS.towerCalcEnsureManualLimitToggle = ensureManualLimitToggle;
  PNS.towerCalcSyncLimitEditability = syncLimitEditability;
  PNS.towerCalcRestyleShiftControls = restyleShiftControls;
  PNS.installTowerCalcLayoutUi = install;
})();
