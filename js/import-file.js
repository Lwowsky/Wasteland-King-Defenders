window.WKD = window.WKD || {};

function ift(key, fallback = '', vars = {}) {
  return window.WKD_tv ? window.WKD_tv(key, vars, fallback) : (fallback || key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}

function normalizeImportShiftText(value) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase();
}
function normalizeImportHeader(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
function isImportShiftHeader(header) {
  const text = normalizeImportHeader(header);
  return /(^|\s)(shift|shifts|availability)(\s|$)|змін|смен|доступн/.test(text);
}

WKD.detectShiftToken = WKD.detectShiftToken || (value => {
  const text = normalizeImportShiftText(value);
  if (!text) return '';
  if (/both|all|всі|все|обидві|обе/.test(text)) return 'both';
  if (/(^|[^0-9])4([^0-9]|$)|four|четвер/.test(text)) return 'shift4';
  if (/(^|[^0-9])3([^0-9]|$)|three|трет/.test(text)) return 'shift3';
  if (/(^|[^0-9])2([^0-9]|$)|two|друг|втор/.test(text)) return 'shift2';
  if (/(^|[^0-9])1([^0-9]|$)|one|перш|перв/.test(text)) return 'shift1';
  return '';
});
WKD.shiftNumberFromToken = WKD.shiftNumberFromToken || (token => {
  const match = String(token || '').match(/^shift([1-4])$/);
  return match ? Number(match[1]) : 0;
});

function scoreImportShiftColumn(rows = [], key = '') {
  const headerBonus = isImportShiftHeader(key) ? 100 : 0;
  let filled = 0;
  let matched = 0;
  let maxShift = 0;
  let longValues = 0;
  const unique = new Set();

  rows.slice(0, 250).forEach(row => {
    const raw = row?.[key];
    const text = normalizeImportShiftText(raw);
    if (!text) return;
    filled += 1;
    if (text.length > 28) longValues += 1;
    const token = WKD.detectShiftToken(text);
    if (!token) return;
    matched += 1;
    unique.add(token);
    maxShift = Math.max(maxShift, WKD.shiftNumberFromToken(token));
  });

  const ratio = filled ? matched / filled : 0;
  const valueScore = matched * 4 + ratio * 30 - longValues;
  const accepted = Boolean(headerBonus || (matched >= 2 && ratio >= 0.35 && unique.size <= 5));
  return { key, score: accepted ? headerBonus + valueScore : 0, matched, maxShift };
}

WKD.findImportShiftColumn = (rows = []) => {
  const headers = WKD.state?.pendingHeaders?.length ? WKD.state.pendingHeaders : Object.keys(rows[0] || {});
  if (!headers.length) return '';

  const mapped = WKD.state?.mappings?.shift;
  if (mapped && headers.includes(mapped)) {
    const mappedScore = scoreImportShiftColumn(rows, mapped);
    if (mappedScore.score > 0) return mapped;
  }

  const headerMatch = headers.find(isImportShiftHeader);
  if (headerMatch) return headerMatch;

  const best = headers
    .map(header => scoreImportShiftColumn(rows, header))
    .sort((a, b) => b.score - a.score)[0];
  return best?.score > 0 ? best.key : (mapped && headers.includes(mapped) ? mapped : '');
};

WKD.inferShiftCountFromPendingRows = (rows = []) => {
  if (!Array.isArray(rows) || !rows.length) return Number(WKD.defaultRegionSettings?.shifts?.home || 2);
  const key = WKD.findImportShiftColumn(rows);
  if (!key) return Number(WKD.defaultRegionSettings?.shifts?.home || 2);
  WKD.state.mappings.shift = key;

  let max = 0;
  rows.forEach(row => {
    max = Math.max(max, WKD.shiftNumberFromToken(WKD.detectShiftToken(row?.[key])));
  });
  return Math.max(1, Math.min(4, max || Number(WKD.defaultRegionSettings?.shifts?.home || 2)));
};

WKD.syncImportShiftCountFromRows = (rows = WKD.state.pendingRows || [], options = {}) => {
  const count = WKD.inferShiftCountFromPendingRows(rows);
  const resetRegions = options.resetRegions === true;

  if (resetRegions) {
    WKD.state.regionEnabled = { home: true, region2: false, region3: false };
    WKD.state.regionShifts = { home: String(count), region2: '2', region3: '2' };
  } else {
    WKD.state.regionShifts = { ...(WKD.state.regionShifts || {}), home: String(count) };
  }

  WKD.saveRegionSettings?.();
  WKD.updateShiftVisibility?.();
  WKD.renderRegionPanels?.();
  WKD.renderCaptureMenu?.();
  document.dispatchEvent(new CustomEvent('wkd:import-shift-count-synced', { detail: { shiftCount: count } }));
  return count;
};

WKD.resetImportSettingsForNewFile = rows => {
  WKD.state.shiftRules = {};
  WKD.state.shiftMergeMode = 'custom';
  localStorage.removeItem(WKD.storageKeys.shiftRules);
  localStorage.removeItem(WKD.storageKeys.shiftMergeMode);
  const count = WKD.syncImportShiftCountFromRows(rows, { resetRegions: true });
  document.dispatchEvent(new CustomEvent('wkd:import-settings-reset', { detail: { shiftCount: count } }));
  return count;
};
WKD.initImportFile = () => {
  const { $, showNotice } = WKD;
  if (document.documentElement.dataset.wkdImportFileInit === '1') return;
  const input = $('#importFileInput'), drop = $('#fileDrop');
  if (!input || !drop) return;
  document.documentElement.dataset.wkdImportFileInit = '1';
  input.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (file) await WKD.prepareFile(file);
  });
  ['dragenter', 'dragover'].forEach(name => drop.addEventListener(name, event => {
    event.preventDefault();
    drop.classList.add('is-drag');
  }));
  ['dragleave', 'drop'].forEach(name => drop.addEventListener(name, event => {
    event.preventDefault();
    drop.classList.remove('is-drag');
  }));
  drop.addEventListener('drop', async event => {
    const file = event.dataTransfer.files?.[0];
    if (file) await WKD.prepareFile(file);
  });
  $('#applyImportBtn')?.addEventListener('click', () => {
    if (!WKD.state.pendingRows) return;
    WKD.saveJson(WKD.storageKeys.importMappings, WKD.state.mappings);
    WKD.saveJson(WKD.storageKeys.shiftRules, WKD.state.shiftRules);
    WKD.setPlayers(WKD.state.pendingRows, { eventSource: 'import-excel' });
    localStorage.setItem('wkd.players.sourceMode', 'local');
    const count = WKD.state.players.length;
    const status = $('#importStatusInfo');
    if (status) {
      status.textContent = ift('import.fileImportedStatus', 'Import applied: {count} players. The window stays open to review settings.', { count });
      status.className = 'muted small is-good';
    }
    showNotice(ift('import.fileImportedNotice', 'Imported: {count} players.', { count }));
  });
  $('#clearPendingImportBtn')?.addEventListener('click', WKD.clearPendingImport);
  $('#detectColumnsBtn')?.addEventListener('click', () => {
    WKD.autoMapHeaders();
    WKD.resetImportSettingsForNewFile?.(WKD.state.pendingRows || []);
    WKD.renderMappingRows();
    WKD.renderShiftRecognition?.();
    WKD.switchSettingsTab('required');
    showNotice(ift('import.columnsDetectedNotice', 'Columns detected automatically. Check the required fields.'));
  });
};
WKD.prepareFile = async file => {
  const { $, state } = WKD;
  let rows = [];

  try {
    rows = await readFile(file);
  } catch (error) {
    console.error(error);
    if ($('#importStatusInfo')) $('#importStatusInfo').textContent = ift('import.fileReadFailed', 'Could not read the file. Check XLSX, XLS or CSV format.');
    if ($('#importStatusInfo')) $('#importStatusInfo').className = 'muted small is-danger';
    return;
  }

  state.pendingRows = rows;
  state.pendingHeaders = Object.keys(rows[0] || {});
  if ($('#importLoadedInfo')) $('#importLoadedInfo').textContent = ift('import.loadedInfo', '{file} • {rows} rows • {cols} columns', { file: file.name, rows: rows.length, cols: state.pendingHeaders.length });
  if ($('#importStatusInfo')) $('#importStatusInfo').textContent = rows.length ? ift('import.fileReadReady', 'File read. Check columns or click “Apply import”.') : ift('import.fileReadNoRows', 'File read, but no rows were found.');
  if ($('#importStatusInfo')) $('#importStatusInfo').className = `muted small ${rows.length ? 'is-good' : 'is-danger'}`;
  if ($('#applyImportBtn')) $('#applyImportBtn').disabled = !rows.length;

  const safeImportStep = (label, fn) => {
    try { return typeof fn === 'function' ? fn() : undefined; }
    catch (error) { console.warn(`[WKD] import ${label} skipped:`, error); return undefined; }
  };

  safeImportStep('auto mapping', WKD.autoMapHeaders);
  const autoShiftCount = safeImportStep('region settings reset', () => WKD.resetImportSettingsForNewFile?.(rows));
  if (rows.length && autoShiftCount && $('#importStatusInfo')) {
    $('#importStatusInfo').textContent = (window.WKD_tv ? WKD_tv('import.fileReadAutoShift', { count: autoShiftCount }) : (window.WKD_t?.('import.fileReadAutoShift') || `File read. Shift count set automatically: ${autoShiftCount}.`).replace('{count}', autoShiftCount));
  }
  safeImportStep('mapping render', WKD.renderMappingRows);
  safeImportStep('shift recognition render', WKD.renderShiftRecognition);
};
WKD.clearPendingImport = () => {
  const { $, state } = WKD;
  state.pendingRows = null;
  state.pendingHeaders = [];
  if ($('#importFileInput')) $('#importFileInput').value = '';
  if ($('#applyImportBtn')) $('#applyImportBtn').disabled = true;
  if ($('#importLoadedInfo')) $('#importLoadedInfo').textContent = ift('import.fileNotLoaded', 'No file uploaded yet.');
  if ($('#importStatusInfo')) $('#importStatusInfo').textContent = ift('import.reviewColumnsApply', 'Upload a file, review the columns, then click “Apply import”.');
  if ($('#importStatusInfo')) $('#importStatusInfo').className = 'muted small';
  WKD.renderMappingRows();
  WKD.renderShiftRecognition?.();
};
async function readFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) return parseCsvText(await file.text());
  if (!window.XLSX && typeof WKD.ensureXlsx === 'function') await WKD.ensureXlsx();
  if (!window.XLSX) throw new Error('SheetJS not loaded');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}
function parseCsvText(text) {
  if (window.XLSX) {
    const workbook = XLSX.read(text, { type: 'string' });
    return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
  }
  const lines = text.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines.shift() || '');
  return lines.map(line => Object.fromEntries(headers.map((header, index) => [header, splitCsvLine(line)[index] || ''])));
}
function splitCsvLine(line) {
  const cells = [];
  let value = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { cells.push(value.trim()); value = ''; }
    else value += ch;
  }
  cells.push(value.trim());
  return cells.map(cell => cell.replace(/^"|"$/g, ''));
}
