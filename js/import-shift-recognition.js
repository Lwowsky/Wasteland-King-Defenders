window.WKD = window.WKD || {};

WKD.initShiftRecognition = () => {
  const saveBtn = WKD.$('#saveShiftRulesBtn');
  const resetBtn = WKD.$('#resetShiftRulesBtn');
  const autoBtn = WKD.$('#autoDetectShiftRulesBtn');
  const mode = WKD.$('#shiftMergeMode');
  if (mode) {
    mode.value = WKD.state.shiftMergeMode || 'custom';
    mode.addEventListener('change', () => {
      WKD.state.shiftMergeMode = mode.value;
      WKD.saveJson(WKD.storageKeys.shiftMergeMode, WKD.state.shiftMergeMode);
      applyMergeModeToRules();
      WKD.renderShiftRecognition();
      setShiftFooter(window.WKD_t?.('import.unsavedRules') || 'There are unsaved rules. Press Save rules.');
    });
  }
  if (saveBtn) saveBtn.addEventListener('click', saveShiftRules);
  if (resetBtn) resetBtn.addEventListener('click', resetShiftRules);
  if (autoBtn) autoBtn.addEventListener('click', autoDetectShiftRules);
  WKD.renderShiftRecognition();
};

WKD.renderShiftRecognition = () => {
  const root = WKD.$('#shiftRecognitionBody');
  const mode = WKD.$('#shiftMergeMode');
  if (mode) mode.value = WKD.state.shiftMergeMode || 'custom';
  if (!root) return;
  const values = getShiftValues();
  if (!values.length) {
    root.innerHTML = `<div class="shift-recognition-empty">${window.WKD_t?.('import.shiftValuesEmpty') || 'Choose the shift column in required columns.'}</div>`;
    setShiftFooter('');
    return;
  }

  root.innerHTML = `<div class="shift-rule-table">
    <div class="shift-rule-head"><span>${window.WKD_t?.('import.excelValue') || 'Excel value'}</span><span>${window.WKD_t?.('import.recognizedAs') || 'Recognized as'}</span><span>${window.WKD_t?.('import.afterMerge') || 'After merging'}</span><span>${window.WKD_t?.('ui.rows') || 'Rows'}</span></div>
    ${values.map(item => shiftRuleRow(item)).join('')}
  </div>`;

  root.querySelectorAll('[data-shift-rule-value]').forEach(select => {
    select.addEventListener('change', () => {
      WKD.state.shiftMergeMode = 'custom';
      WKD.saveJson(WKD.storageKeys.shiftMergeMode, 'custom');
      const mode = WKD.$('#shiftMergeMode');
      if (mode) mode.value = 'custom';
      WKD.state.shiftRules[select.dataset.shiftRuleValue] = select.value;
      const pill = root.querySelector(`[data-shift-rule-pill="${CSS.escape(select.dataset.shiftRuleValue)}"]`);
      if (pill) pill.textContent = labelFor(select.value);
      setShiftFooter(window.WKD_t?.('import.unsavedRules') || 'Unsaved rules.');
    });
  });
};

WKD.applyShiftRule = value => {
  const raw = WKD.clean(value);
  return WKD.state.shiftRules[raw] || mergeShift(detectShift(raw));
};

function getShiftValues() {
  const rows = WKD.state.pendingRows || [];
  const key = WKD.state.mappings.shift;
  if (!rows.length || !key) return [];
  const map = new Map();
  rows.forEach(row => {
    const raw = WKD.clean(row[key]);
    if (!raw) return;
    const item = map.get(raw) || { value: raw, count: 0 };
    item.count += 1;
    map.set(raw, item);
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'uk'));
}

function shiftRuleRow(item) {
  const current = WKD.state.shiftRules[item.value] || mergeShift(detectShift(item.value));
  return `<div class="shift-rule-row">
    <span>${WKD.escapeHtml(item.value)}</span>
    <select data-shift-rule-value="${WKD.escapeHtml(item.value)}">${options(current)}</select>
    <span class="shift-rule-pill" data-shift-rule-pill="${WKD.escapeHtml(item.value)}">${labelFor(current)}</span>
    <strong>${item.count}</strong>
  </div>`;
}

function options(current) {
  return [
    ['shift1', window.WKD_t?.('shift.shift1') || 'Shift 1'], ['shift2', window.WKD_t?.('shift.shift2') || 'Shift 2'], ['shift3', window.WKD_t?.('shift.shift3') || 'Shift 3'], ['shift4', window.WKD_t?.('shift.shift4') || 'Shift 4'], ['both', window.WKD_t?.('shift.both') || 'Both']
  ].map(([value, label]) => `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`).join('');
}

function detectShift(value) {
  return WKD.detectShiftToken?.(value) || 'both';
}

function mergeShift(shift) {
  const mode = WKD.state.shiftMergeMode || 'custom';
  if (mode === 'allTo1') return 'shift1';
  if (mode === 'pair12_34') {
    if (shift === 'shift1' || shift === 'shift2') return 'shift1';
    if (shift === 'shift3' || shift === 'shift4') return 'shift2';
  }
  return shift;
}

function applyMergeModeToRules() {
  const values = getShiftValues();
  if (!values.length) return;
  values.forEach(item => { WKD.state.shiftRules[item.value] = mergeShift(detectShift(item.value)); });
}

function labelFor(value) {
  return ({ shift1: window.WKD_t?.('shift.shift1') || 'Shift 1', shift2: window.WKD_t?.('shift.shift2') || 'Shift 2', shift3: window.WKD_t?.('shift.shift3') || 'Shift 3', shift4: window.WKD_t?.('shift.shift4') || 'Shift 4', both: window.WKD_t?.('shift.both') || 'Both' })[value] || (window.WKD_t?.('shift.both') || 'Both');
}

function saveShiftRules() {
  WKD.saveJson(WKD.storageKeys.shiftRules, WKD.state.shiftRules);
  WKD.saveJson(WKD.storageKeys.shiftMergeMode, WKD.state.shiftMergeMode || 'custom');
  setShiftFooter(window.WKD_t?.('import.rulesSaved') || 'Rules saved.');
  WKD.showNotice(window.WKD_t?.('import.rulesSaved') || 'Rules saved.');
}

function resetShiftRules() {
  WKD.state.shiftRules = {};
  WKD.state.shiftMergeMode = 'custom';
  localStorage.removeItem(WKD.storageKeys.shiftRules);
  localStorage.removeItem(WKD.storageKeys.shiftMergeMode);
  WKD.renderShiftRecognition();
  WKD.showNotice(window.WKD_t?.('import.rulesReset') || 'Shift rules reset.');
}

function autoDetectShiftRules() {
  WKD.state.shiftMergeMode = 'custom';
  getShiftValues().forEach(item => { WKD.state.shiftRules[item.value] = detectShift(item.value); });
  WKD.renderShiftRecognition();
  setShiftFooter(window.WKD_t?.('import.autoDetectReady') || 'Auto detection is ready. Press Save rules.');
}

function setShiftFooter(text) {
  const footer = WKD.$('#shiftRecognitionStatus');
  if (footer) footer.textContent = text;
}
