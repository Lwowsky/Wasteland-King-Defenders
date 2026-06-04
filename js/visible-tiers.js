window.WKD = window.WKD || {};
const vt = (key, fallback = '') => {
  const value = window.WKD_t ? window.WKD_t(key) : (fallback || key);
  return value && value !== key ? value : (fallback || key);
};
const vtFieldLabel = (key, field) => WKD.fieldLabel ? WKD.fieldLabel(key, field?.label) : (field?.label || key);
WKD.initVisibleTiers = () => {
  const { $, showNotice } = WKD;
  if (document.documentElement.dataset.wkdVisibleTiersInit === '1') {
    WKD.renderVisibleOptions();
    WKD.renderVisibleTiers();
    return;
  }
  if (!$('#visibleTierList') || !$('#addTierSelect') || !$('#addTierBtn')) return;
  document.documentElement.dataset.wkdVisibleTiersInit = '1';
  $('#addTierBtn')?.addEventListener('click', () => {
    const value = $('#addTierSelect').value;
    if (!value || WKD.state.visibleTiers.includes(value)) return;
    WKD.state.visibleTiers.push(value);
    WKD.sortVisibleTiers();
    WKD.renderVisibleTiers();
  });
  $('#saveVisibleColumnsBtn')?.addEventListener('click', () => {
    saveVisibleSettings();
    showNotice(vt('import.visibleColumnsSaved', 'Visible columns saved.'));
  });
  WKD.renderVisibleOptions();
  WKD.renderVisibleTiers();
};
WKD.sortVisibleTiers = () => {
  WKD.state.visibleTiers.sort((a, b) => Number(b.replace('T', '')) - Number(a.replace('T', '')));
};
WKD.renderVisibleOptions = () => {
  const root = WKD.$('.visibility-panel');
  if (!root) return;
  const keys = WKD.getOptionalKeys ? WKD.getOptionalKeys() : WKD.optionalKeys;
  root.innerHTML = keys.map(key => {
    const field = WKD.fields[key];
    const checked = WKD.state.visibleOptionalFields.includes(key);
    return `<label class="checkbox-row"><input type="checkbox" data-visible-field="${key}" ${checked ? 'checked' : ''}><span>${WKD.escapeHtml(vtFieldLabel(key, field))}</span></label>`;
  }).join('');
  root.querySelectorAll('[data-visible-field]').forEach(input => input.addEventListener('change', () => {
    const key = input.dataset.visibleField;
    WKD.state.visibleOptionalFields = input.checked
      ? [...new Set([...WKD.state.visibleOptionalFields, key])]
      : WKD.state.visibleOptionalFields.filter(item => item !== key);
  }));
};
WKD.renderVisibleTiers = () => {
  const { $, state, allTiers } = WKD;
  const list = $('#visibleTierList');
  if (!list) return;
  list.innerHTML = state.visibleTiers.map(tier => tierTemplate(tier)).join('');
  list.querySelectorAll('[data-visible-tier]').forEach(input => {
    input.addEventListener('change', () => input.closest('[data-tier-pill]').classList.toggle('is-muted', !input.checked));
  });
  list.querySelectorAll('[data-remove-tier]').forEach(button => {
    button.addEventListener('click', () => {
      state.visibleTiers = state.visibleTiers.filter(tier => tier !== button.dataset.removeTier);
      WKD.renderVisibleTiers();
    });
  });
  const remaining = allTiers.filter(tier => !state.visibleTiers.includes(tier));
  if ($('#addTierSelect')) $('#addTierSelect').innerHTML = remaining.map(tier => `<option value="${tier}">${tier}</option>`).join('');
  if ($('#addTierSelect')) $('#addTierSelect').disabled = remaining.length === 0;
  if ($('#addTierBtn')) $('#addTierBtn').disabled = remaining.length === 0;
};
function tierTemplate(tier) {
  const canRemove = Number(tier.replace('T', '')) <= 7;
  return `<div class="checkbox-row tier-row ${canRemove ? 'tier-row--removable' : ''}" data-tier-pill="${tier}">
    <label><input type="checkbox" checked data-visible-tier="${tier}"><span>${tier}</span></label>
    ${canRemove ? `<button class="mapping-remove-btn tier-remove-btn" type="button" data-remove-tier="${tier}" aria-label="${WKD.escapeHtml(vt('common.delete', 'Delete'))} ${tier}">×</button>` : ''}
  </div>`;
}
function saveVisibleSettings() {
  WKD.saveJson(WKD.storageKeys.visibleTiers, WKD.state.visibleTiers);
  WKD.saveJson(WKD.storageKeys.visibleOptionalFields, WKD.state.visibleOptionalFields);
  WKD.saveCustomFieldState?.();
}
