window.WKD = window.WKD || {};

function i18n(key, fallback = '', vars = {}) {
  let value = window.WKD_t ? window.WKD_t(key) : (fallback || key);
  if (!value || value === key) value = fallback || key;
  Object.entries(vars).forEach(([name, replacement]) => { value = value.replaceAll(`{${name}}`, String(replacement)); });
  return value;
}

function fieldLabel(key, field) {
  return WKD.fieldLabel ? WKD.fieldLabel(key, field?.label) : (field?.label || key);
}

WKD.initImportMapping = () => {
  const { $, state } = WKD;
  state.mappings = WKD.loadJson(WKD.storageKeys.importMappings, {});
  WKD.renderMappingRows();
  if (document.documentElement.dataset.wkdImportMappingInit === '1') return;
  document.documentElement.dataset.wkdImportMappingInit = '1';
  $('#saveMappingBtn')?.addEventListener('click', saveMappings);
  $('#saveOptionalMappingBtn')?.addEventListener('click', saveMappings);
  $('#resetColumnDataBtn')?.addEventListener('click', resetColumnData);
  $('#resetAllStorageBtn')?.addEventListener('click', resetAllStorage);
  $('#resetTableDataBtn')?.addEventListener('click', resetTableData);
};

WKD.autoMapHeaders = () => {
  const headers = WKD.state.pendingHeaders || [];
  Object.entries(WKD.fields).forEach(([key, config]) => {
    if (WKD.state.mappings[key] && headers.includes(WKD.state.mappings[key])) return;
    const found = headers.find(header => {
      const normalized = normalizeHeader(header);
      return config.aliases.some(alias => { const a = normalizeHeader(alias); return normalized === a || normalized.includes(a); });
    });
    if (found) WKD.state.mappings[key] = found;
  });
};

WKD.renderMappingRows = () => {
  WKD.rebuildFields();
  renderMappingGroup('#requiredMappingContainer', WKD.requiredKeys, false);
  renderMappingGroup('#optionalMappingContainer', WKD.getOptionalKeys(), true);
  WKD.renderVisibleOptions?.();
};

WKD.getMappedValue = (row, key) => {
  const field = WKD.fields[key];
  if (!field) return '';
  const mapped = WKD.state.mappings[key];
  if (mapped && Object.prototype.hasOwnProperty.call(row, mapped)) return row[mapped];
  const found = Object.keys(row || {}).find(header => {
    const normalized = normalizeHeader(header);
    return field.aliases.some(alias => { const a = normalizeHeader(alias); return normalized === a || normalized.includes(a); });
  });
  return found ? row[found] : '';
};

function renderMappingGroup(selector, keys, optional) {
  const root = WKD.$(selector);
  if (!root) return;
  root.innerHTML = keys.map(key => mappingRow(key, optional)).join('') + (optional ? `<div class="mapping-add-row"><button class="mapping-add-btn" data-add-custom-field type="button">+ ${i18n('import.addCustomColumn', 'Add custom column')}</button></div>` : '');

  WKD.$$('select[data-map-field]', root).forEach(select => select.addEventListener('change', () => {
    const field = select.dataset.mapField;
    WKD.state.mappings[field] = select.value;
    WKD.saveJson(WKD.storageKeys.importMappings, WKD.state.mappings);
    if (field === 'shift') WKD.syncImportShiftCountFromRows?.(WKD.state.pendingRows || [], { resetRegions: false });
    WKD.renderShiftRecognition?.();
  }));

  WKD.$$('[data-edit-field]', root).forEach(button => button.addEventListener('click', () => editField(button.dataset.editField)));
  WKD.$$('[data-remove-field]', root).forEach(button => button.addEventListener('click', () => removeOptionalField(button.dataset.removeField)));
  const add = root.querySelector('[data-add-custom-field]');
  if (add) add.addEventListener('click', addCustomField);
}

function mappingRow(key, optional) {
  const config = WKD.fields[key];
  const current = WKD.state.mappings[key] || '';
  const options = [`<option value="">${WKD.escapeHtml(i18n('import.unassigned', '— not mapped —'))}</option>`].concat(WKD.state.pendingHeaders.map(header => `<option value="${WKD.escapeHtml(header)}" ${header === current ? 'selected' : ''}>${WKD.escapeHtml(header)}</option>`)).join('');
  return `<div class="mapping-row" data-field-row="${key}">
    <div class="row-title-wrap">
      <div class="row-title"><strong>${WKD.escapeHtml(fieldLabel(key, config))}${optional ? '' : ' *'}</strong>${optional ? `<span class="mapping-meta">${WKD.escapeHtml(i18n('import.customMeta', 'custom'))}</span>` : ''}</div>
      <div class="row-title-actions">${optional ? `<button class="mapping-remove-btn" data-remove-field="${key}" type="button" aria-label="${WKD.escapeHtml(i18n('import.deleteColumn', 'Delete column'))}">×</button>` : ''}<button class="mapping-edit-btn" data-edit-field="${key}" type="button">${WKD.escapeHtml(i18n('common.edit', 'Edit'))}</button></div>
    </div>
    <select data-map-field="${key}">${options}</select>
  </div>`;
}

async function editField(key) {
  const field = WKD.fields[key];
  if (!field) return;
  const row = WKD.$(`[data-field-row="${CSS.escape(key)}"]`);
  if (!row || row.classList.contains('is-editing')) return;
  row.classList.add('is-editing');
  row.querySelector('.row-title').innerHTML = `<input class="mapping-name-input" value="${WKD.escapeHtml(fieldLabel(key, field))}" aria-label="${WKD.escapeHtml(i18n('import.columnName', 'Column name'))}">`;
  row.querySelector('.row-title-actions').innerHTML = `<button class="mapping-save-btn" type="button">✓ ${WKD.escapeHtml(i18n('common.save', 'Save'))}</button><button class="mapping-edit-btn" type="button">${WKD.escapeHtml(i18n('common.cancel', 'Cancel'))}</button>`;
  const input = row.querySelector('.mapping-name-input');
  input.focus();
  row.querySelector('.mapping-save-btn').addEventListener('click', () => saveFieldName(key, input.value));
  row.querySelector('.mapping-edit-btn').addEventListener('click', WKD.renderMappingRows);
}

function saveFieldName(key, label) {
  const value = WKD.clean(label);
  if (!value) return WKD.showNotice(i18n('import.columnNameRequired', 'Column name cannot be empty.'));
  if (WKD.baseFields[key]) WKD.baseFields[key].label = value;
  const custom = WKD.state.customFields.find(item => item.key === key);
  if (custom) custom.label = value;
  WKD.saveCustomFieldState();
  WKD.rebuildFields();
  WKD.renderMappingRows();
  WKD.showNotice(i18n('import.columnNameSaved', 'Column name saved.'));
}

async function removeOptionalField(key) {
  const field = WKD.fields[key];
  if (!field) return;
  const ok = await WKD.confirmDialog({
    title: i18n('import.deleteColumnTitle', 'Delete column?'),
    message: i18n('import.deleteColumnMessage', 'Column “{label}” will be removed from optional columns.', { label: fieldLabel(key, field) }),
    note: i18n('import.deleteColumnNote', 'You can change this later by adding it again or resetting settings.'),
    acceptText: i18n('common.delete', 'Delete')
  });
  if (!ok) return;
  WKD.state.customFields = WKD.state.customFields.filter(item => item.key !== key);
  if (!WKD.baseFields[key] && WKD.state.mappings[key]) delete WKD.state.mappings[key];
  if (WKD.baseFields[key] && !WKD.state.disabledOptionalFields.includes(key)) WKD.state.disabledOptionalFields.push(key);
  WKD.state.visibleOptionalFields = WKD.state.visibleOptionalFields.filter(item => item !== key);
  WKD.saveJson(WKD.storageKeys.importMappings, WKD.state.mappings);
  WKD.saveCustomFieldState();
  WKD.renderMappingRows();
  WKD.showNotice(i18n('import.customColumnDeleted', 'Optional column deleted.'));
}

function addCustomField() {
  const index = WKD.state.customFields.length + 1;
  const key = `custom_${Date.now().toString(36)}`;
  WKD.state.customFields.push({ key, label: i18n('import.customColumnDefault', 'Custom column {index}', { index }) });
  WKD.state.visibleOptionalFields.push(key);
  WKD.saveCustomFieldState();
  WKD.rebuildFields();
  WKD.renderMappingRows();
  setTimeout(() => editField(key), 0);
}

function normalizeHeader(value) { return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[’'`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
function saveMappings() {
  WKD.saveJson(WKD.storageKeys.importMappings, WKD.state.mappings);
  WKD.saveCustomFieldState();
  WKD.showNotice(i18n('import.mappingTemplateSaved', 'Column template saved.'));
}

async function resetColumnData() {
  const ok = await WKD.confirmDialog({ title: i18n('import.resetColumnDataTitle', 'Reset column data?'), message: i18n('import.resetColumnDataMessage', 'The saved column mapping template will be cleared.'), note: i18n('import.resetColumnDataNote', 'After this, the columns will need to be configured again.'), acceptText: i18n('import.reset', 'Reset') });
  if (!ok) return;
  WKD.state.mappings = {};
  localStorage.removeItem(WKD.storageKeys.importMappings);
  WKD.renderMappingRows();
  WKD.showNotice(i18n('import.columnDataReset', 'Column data reset.'));
}

async function resetAllStorage() {
  const ok = await WKD.confirmDialog({ title: i18n('import.resetAllLocalTitle', 'Completely clear local data?'), message: i18n('import.resetAllLocalMessage', 'All saved site data will be deleted.'), note: i18n('import.resetAllLocalNote', 'Tables, columns, import templates, settings and other locally saved state will be cleared.'), acceptText: i18n('import.resetAll', 'Reset all') });
  if (!ok) return;
  localStorage.clear();
  WKD.clearPendingImport();
  WKD.state.mappings = {};
  WKD.state.visibleTiers = [...WKD.defaultVisibleTiers];
  WKD.state.customFields = [];
  WKD.state.disabledOptionalFields = [];
  WKD.state.visibleOptionalFields = [];
  WKD.state.shiftRules = {};
  WKD.state.shiftMergeMode = 'custom';
  const regions = WKD.loadRegionSettings();
  WKD.state.regionEnabled = regions.enabled;
  WKD.state.regionShifts = regions.shifts;
  WKD.rebuildFields();
  WKD.setPlayers([], { persist: false });
  WKD.renderMappingRows();
  WKD.renderVisibleTiers?.();
  WKD.renderRegionPanels?.();
  WKD.renderShiftRecognition?.();
  WKD.showNotice(i18n('import.localDataCleared', 'Local data cleared.'));
}

async function resetTableData() {
  const ok = await WKD.confirmDialog({ title: i18n('import.resetTableDataTitle', 'Reset table data?'), message: i18n('import.resetTableDataMessage', 'The imported player list will be cleared.'), note: i18n('import.resetTableDataNote', 'Column and region settings will stay unchanged.'), acceptText: i18n('import.resetTable', 'Reset table') });
  if (!ok) return;
  WKD.setPlayers([]);
  WKD.showNotice(i18n('import.tableDataCleared', 'Table data cleared.'));
}
