(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state, $$ } = PNS;

  // ---- Field definitions (as in your core.js) ----
  const FIELD_DEFS = [
    { key: 'player_name', label: 'Player name', required: true, aliases: ['player name','name','nickname','nick','имя игрока','имя','імя гравця','імя','player'] },
    { key: 'focus_troop', label: 'Focus troop', required: true, aliases: ['focus troop','main troop','main role','troop role','what is your focus troop','основной тип войск','главная роль','головна роль','role'] },
    { key: 'troop_tier', label: 'Troop Tier', required: true, aliases: ['troop tier','tier','main tier','главный тир','головний тір','тир','тір'] },
    { key: 'march_size', label: 'March size', required: true, aliases: ['march size','squad size','troop size','размер отряда','розмір твого отряду','march'] },
    { key: 'captain_ready', label: 'Captain ready', required: true, aliases: ['captain','ready to be captain','готов быть капитаном','готовий бути капітаном','captain ready'] },
    { key: 'shift_availability', label: 'Shift availability', required: true, aliases: ['shift','смена','зміна','which shift can you join'] },

    { key: 'alliance_alias', label: 'Alliance alias', required: false, colKey: 'alliance', visibleDefault: true, aliases: ['alliance alias','alliance','альянс','ally','tag'] },
    { key: 'rally_size', label: 'Rally size', required: false, colKey: 'rally_size', visibleDefault: true, aliases: ['rally size','group attack','group atk','размер групповой атаки','розмір групової атаки','rally'] },
    { key: 'lair_level', label: 'Lair level', required: false, colKey: 'lair_level', visibleDefault: false, aliases: ['lair','логово','which lair level can you take'] },
    { key: 'secondary_role', label: 'Secondary troop role', required: false, colKey: 'secondary_role', visibleDefault: false, aliases: ['secondary troop role','secondary role','дополнительная роль','додаткова роль'] },
    { key: 'secondary_tier', label: 'Secondary troop tier', required: false, colKey: 'secondary_tier', visibleDefault: false, aliases: ['secondary troop tier','secondary tier','дополнительный тир','додатковий тір'] },
    { key: 'troop_200k', label: '200k troop types', required: false, colKey: 'troop_200k', visibleDefault: false, aliases: ['200k','at least 200k','provide at least 200k','200к'] },
    { key: 'notes', label: 'Notes', required: false, colKey: 'notes', visibleDefault: false, aliases: ['note','notes','комментарий','коментар','примітка','comment'] },
  ];
  const OPTIONAL_FIELDS = FIELD_DEFS.filter(f => !f.required);

  (function enhanceFieldAliasesV2() {
    const extra = {
      player_name: ['playername','ingame name','игрок','нік','닉네임','선수 이름','플레이어 이름'],
      focus_troop: ['주력 부대','주력 병종','тип військ','병력 유형','병종'],
      troop_tier: ['부대 등급','уровень войск','рівень військ','병종 등급'],
      march_size: ['행진 크기','размер марша','розмір марша','марш'],
      rally_size: ['집결 규모','집결 크기','рейли'],
      captain_ready: ['can be captain','캡틴 가능'],
      shift_availability: ['교대','which shift','available shift'],
      alliance_alias: ['alliance tag','ally tag','тег альянса'],
      lair_level: ['рівень логова','уровень логова','소굴'],
      secondary_role: ['second role','вторая роль','друга роль'],
      secondary_tier: ['second tier','второй тир','другий тір'],
      troop_200k: ['200000','200k+','200к','최소 200,000'],
      notes: ['comment','remarks','коментар','комментарий','비고'],
    };
    FIELD_DEFS.forEach((f) => {
      f.aliases = Array.from(new Set([...(f.aliases || []), ...((extra[f.key]) || [])]));
    });
  })();

  // ===== DOM getters (IMPORTANT for partial swaps) =====
  function getControls() {
    return {
      requiredMappingContainer: document.querySelector('#requiredMappingContainer'),
      optionalMappingContainer: document.querySelector('#optionalMappingContainer'),
      columnVisibilityChecks: document.querySelector('#columnVisibilityChecks'),
      importLoadedInfo: document.querySelector('#importLoadedInfo'),
      importStatusInfo: document.querySelector('#importStatusInfo'),
    };
  }
  function getButtons() {
    return {
      fileInputMock: document.querySelector('#fileInputMock'),
      urlInputMock: document.querySelector('#urlInputMock'),
      loadUrlMockBtn: document.querySelector('#loadUrlMockBtn'),
      detectColumnsMockBtn: document.querySelector('#detectColumnsMockBtn'),
      useTemplateMockBtn: document.querySelector('#useTemplateMockBtn'),
      saveVisibleColumnsMockBtn: document.querySelector('#saveVisibleColumnsMockBtn'),
      loadDemoImportBtn: document.querySelector('#loadDemoImportBtn'),
      saveTemplateMockBtn: document.querySelector('#saveTemplateMockBtn'),
      applyImportMockBtn: document.querySelector('#applyImportMockBtn'),
    };
  }

  function setImportLoadedInfo(text) {
    const c = getControls();
    if (c.importLoadedInfo) c.importLoadedInfo.textContent = text || '';
  }
  function setImportStatus(text, level) {
    // якщо в тебе вже є PNS.setImportStatus — використовуємо її
    if (typeof PNS.setImportStatus === 'function') { PNS.setImportStatus(text, level); return; }
    const c = getControls();
    if (!c.importStatusInfo) return;
    c.importStatusInfo.textContent = text || '';
    c.importStatusInfo.className = 'muted small' + (level ? ` ${level}` : '');
  }
  // export for other modules (safe)
  PNS.setImportLoadedInfo = PNS.setImportLoadedInfo || setImportLoadedInfo;
  PNS.setImportStatus = PNS.setImportStatus || setImportStatus;

  function normHeader(v) {
    return String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function tokenizeHeader(v) {
    return normHeader(v).replace(/[\[\](){}:;,.!?/\\_-]+/g, ' ').split(/\s+/).filter(Boolean);
  }

  function getFieldDefByKey(key) { return FIELD_DEFS.find((f) => f.key === key) || null; }
  function getFieldLabel(key) {
    const override = state.fieldLabelOverrides?.[key];
    if (override && String(override).trim()) return String(override).trim();
    return getFieldDefByKey(key)?.label || key;
  }

  function getDefaultVisibleOptionalColumns() {
    const base = OPTIONAL_FIELDS.filter(f => f.visibleDefault).map(f => f.colKey);
    if (!base.includes('captain_ready')) base.push('captain_ready');
    return base;
  }

  // expose needed defs for storage module
  PNS.FIELD_DEFS = FIELD_DEFS;
  PNS.OPTIONAL_FIELDS = OPTIONAL_FIELDS;
  PNS.getFieldDefByKey = getFieldDefByKey;
  PNS.getFieldLabel = getFieldLabel;
  PNS.getDefaultVisibleOptionalColumns = getDefaultVisibleOptionalColumns;

  function fingerprintHeaders(headers) { return (headers || []).map(h => normHeader(h)).join('|'); }

  function convertGoogleSheetsUrlToCsv(url) {
    try {
      const u = new URL(url);
      if (!/docs\.google\.com$/.test(u.hostname)) return url;
      const m = u.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!m) return url;
      const id = m[1];
      const gid = u.searchParams.get('gid') || '0';
      return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    } catch { return url; }
  }

  function parseCsvTextBasic(text) {
    const rows = [];
    let row = [], cell = '', i = 0, inQ = false;
    while (i < text.length) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i+1] === '"') { cell += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        cell += ch; i++; continue;
      }
      if (ch === '"') { inQ = true; i++; continue; }
      if (ch === ',') { row.push(cell); cell=''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(cell); rows.push(row); row=[]; cell=''; i++; continue; }
      cell += ch; i++;
    }
    row.push(cell); rows.push(row);
    return rows;
  }

  function rowsToHeadersAndObjects(rows2d) {
    const rows = (rows2d || []).filter(r => Array.isArray(r));
    if (!rows.length) return { headers: [], rows: [] };
    const headers = (rows[0] || []).map((h, idx) => String(h || '').trim() || `Column ${idx+1}`);
    const dataRows = [];
    for (let i = 1; i < rows.length; i++) {
      const arr = rows[i] || [];
      const obj = {};
      let nonEmpty = false;
      headers.forEach((h, idx) => {
        const v = arr[idx] == null ? '' : String(arr[idx]).trim();
        obj[h] = v;
        if (v) nonEmpty = true;
      });
      if (nonEmpty) dataRows.push(obj);
    }
    return { headers, rows: dataRows };
  }

  function parseSheetRowsFromWorkbook(wb) {
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = (window.XLSX ? XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) : []);
    return rows;
  }

  function parseFileToDataset(file) {
    return new Promise(async (resolve, reject) => {
      try {
        const name = file.name || 'file';
        const ext = name.split('.').pop()?.toLowerCase() || '';
        if ((ext === 'xlsx' || ext === 'xls') && window.XLSX) {
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: 'array' });
          resolve(rowsToHeadersAndObjects(parseSheetRowsFromWorkbook(wb)));
          return;
        }
        const text = await file.text();
        if (window.XLSX && ext !== 'csv' && ext !== 'txt') {
          try {
            const wb = XLSX.read(text, { type: 'string' });
            resolve(rowsToHeadersAndObjects(parseSheetRowsFromWorkbook(wb)));
            return;
          } catch {}
        }
        resolve(rowsToHeadersAndObjects(parseCsvTextBasic(text)));
      } catch (e) { reject(e); }
    });
  }

  async function loadDatasetFromUrl(rawUrl) {
    const url = convertGoogleSheetsUrlToCsv(rawUrl);
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return rowsToHeadersAndObjects(parseCsvTextBasic(text));
  }

  function findHeaderMatch(headers, fieldDef) {
    const customLabel = getFieldLabel(fieldDef.key);
    const normalizedHeaders = headers.map(h => ({ raw: h, n: normHeader(h), tokens: tokenizeHeader(h) }));
    const aliases = Array.from(new Set([customLabel, ...(fieldDef.aliases || [])])).map(normHeader).filter(Boolean);

    for (const a of aliases) {
      const found = normalizedHeaders.find(h => h.n === a);
      if (found) return found.raw;
    }
    for (const a of aliases) {
      const found = normalizedHeaders.find(h => h.n.includes(a) || a.includes(h.n));
      if (found) return found.raw;
    }

    let best = null;
    let bestScore = 0;
    const aliasTokenSets = aliases.map(a => tokenizeHeader(a)).filter(t => t.length);
    normalizedHeaders.forEach((h) => {
      aliasTokenSets.forEach((tokens) => {
        const overlap = tokens.filter(t => h.tokens.includes(t)).length;
        if (!overlap) return;
        const score = overlap / Math.max(tokens.length, 1) + overlap / Math.max(h.tokens.length, 1);
        if (score > bestScore) { bestScore = score; best = h; }
      });
    });
    return bestScore >= 0.6 ? best.raw : '';
  }

  function autoDetectMapping(headers) {
    const mapping = {};
    FIELD_DEFS.forEach((f) => { mapping[f.key] = findHeaderMatch(headers, f) || ''; });
    return mapping;
  }

  function ensureImportMappingDefaults() {
    state.importData = state.importData || { headers: [], rows: [], mapping: {}, loaded: false };
    const m = state.importData.mapping || {};
    FIELD_DEFS.forEach((f) => { if (!(f.key in m)) m[f.key] = ''; });
    state.importData.mapping = m;

    if (!Array.isArray(state.visibleOptionalColumns) || !state.visibleOptionalColumns.length) {
      if (typeof PNS.loadVisibleOptionalColumns === 'function') PNS.loadVisibleOptionalColumns();
    }
  }

  function readMappingFromUI() {
    $$('select[data-map-field]').forEach((sel) => {
      state.importData.mapping[sel.dataset.mapField] = sel.value || '';
    });
  }

  function updateImportReadinessHint() {
    const headers = state.importData.headers || [];
    if (!headers.length) { setImportStatus('Load CSV/XLSX file or public Google Sheets CSV link first.'); return; }
    const missing = FIELD_DEFS.filter(f => f.required && !state.importData.mapping?.[f.key]).map(f => getFieldLabel(f.key));
    if (missing.length) setImportStatus(`Map required columns: ${missing.join(', ')}`, 'danger');
    else setImportStatus(`Ready to import • ${state.importData.rows.length} rows • ${headers.length} columns`, 'good');
  }

  function renderImportUI() {
    const headers = state.importData.headers || [];
    ensureImportMappingDefaults();
    const controls = getControls();

    if (controls.requiredMappingContainer) {
      controls.requiredMappingContainer.innerHTML = '';
      FIELD_DEFS.filter(f => f.required).forEach((f) => {
        const row = document.createElement('div');
        row.className = 'mapping-row required';
        const currentLabel = getFieldLabel(f.key);
        row.innerHTML = `<div class="row-title-wrap"><div class="row-title">${PNS.escapeHtml(currentLabel)} <strong>*</strong></div><button type="button" class="edit-hint">editable</button></div>`;

        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.className = 'field-label-input';
        labelInput.value = currentLabel;
        labelInput.addEventListener('change', () => {
          if (typeof PNS.setFieldLabelOverride === 'function') PNS.setFieldLabelOverride(f.key, labelInput.value);
          renderImportUI();
        });
        row.appendChild(labelInput);

        const select = document.createElement('select');
        select.dataset.mapField = f.key;
        const empty = document.createElement('option'); empty.value = ''; empty.textContent = '— select column —';
        select.appendChild(empty);
        headers.forEach((h) => { const opt = document.createElement('option'); opt.value = h; opt.textContent = h; select.appendChild(opt); });
        select.value = state.importData.mapping[f.key] || '';
        select.addEventListener('change', () => { state.importData.mapping[f.key] = select.value; updateImportReadinessHint(); });
        row.appendChild(select);

        const editBtn = row.querySelector('.edit-hint');
        if (editBtn) {
          editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            row.classList.toggle('edit-open');
            if (row.classList.contains('edit-open')) labelInput.focus();
          });
        }

        controls.requiredMappingContainer.appendChild(row);
      });
    }

    if (controls.optionalMappingContainer) {
      controls.optionalMappingContainer.innerHTML = '';
      OPTIONAL_FIELDS.forEach((f) => {
        const row = document.createElement('div');
        row.className = 'mapping-row';
        const currentLabel = getFieldLabel(f.key);
        row.innerHTML = `<div class="row-title-wrap"><div class="row-title">${PNS.escapeHtml(currentLabel)} <span class="mapping-meta">(optional)</span></div><button type="button" class="edit-hint">editable</button></div>`;

        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.className = 'field-label-input';
        labelInput.value = currentLabel;
        labelInput.addEventListener('change', () => {
          if (typeof PNS.setFieldLabelOverride === 'function') PNS.setFieldLabelOverride(f.key, labelInput.value);
          renderImportUI();
        });
        row.appendChild(labelInput);

        const select = document.createElement('select');
        select.dataset.mapField = f.key;
        const empty = document.createElement('option'); empty.value = ''; empty.textContent = '— not mapped —';
        select.appendChild(empty);
        headers.forEach((h) => { const opt = document.createElement('option'); opt.value = h; opt.textContent = h; select.appendChild(opt); });
        select.value = state.importData.mapping[f.key] || '';
        select.addEventListener('change', () => { state.importData.mapping[f.key] = select.value; });
        row.appendChild(select);

        const editBtn = row.querySelector('.edit-hint');
        if (editBtn) {
          editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            row.classList.toggle('edit-open');
            if (row.classList.contains('edit-open')) labelInput.focus();
          });
        }

        controls.optionalMappingContainer.appendChild(row);
      });
    }

    if (controls.columnVisibilityChecks) {
      controls.columnVisibilityChecks.innerHTML = '';
      const visibilityFields = [
        ...OPTIONAL_FIELDS,
        { key: 'captain_ready_core_vis', label: 'Captain column', colKey: 'captain_ready' },
      ];
      visibilityFields.forEach((f) => {
        const key = f.colKey;
        if (!key) return;
        const label = document.createElement('label');
        label.className = 'checkbox-row';
        const visLabel = f.key && getFieldDefByKey(f.key) ? getFieldLabel(f.key) : f.label;
        label.innerHTML = `<input type="checkbox" data-col-key="${key}"> <span>${PNS.escapeHtml(visLabel)}</span>`;
        const cb = label.querySelector('input');
        cb.checked = (state.visibleOptionalColumns || []).includes(key);
        cb.addEventListener('change', () => {
          const set = new Set(state.visibleOptionalColumns || []);
          cb.checked ? set.add(key) : set.delete(key);
          state.visibleOptionalColumns = Array.from(set);
          if (typeof PNS.applyColumnVisibility === 'function') PNS.applyColumnVisibility(state.showAllColumns);
        });
        controls.columnVisibilityChecks.appendChild(label);
      });
    }

    updateImportReadinessHint();
  }

  function getImportTemplates() {
    const arr = typeof PNS.safeReadJSON === 'function' ? PNS.safeReadJSON(PNS.KEYS.KEY_IMPORT_TEMPLATES, []) : [];
    return Array.isArray(arr) ? arr : [];
  }
  function saveImportTemplates(templates) {
    if (typeof PNS.safeWriteJSON === 'function') PNS.safeWriteJSON(PNS.KEYS.KEY_IMPORT_TEMPLATES, templates);
  }

  function getCurrentImportTemplate() {
    readMappingFromUI();
    return {
      name: 'Last template',
      fingerprint: fingerprintHeaders(state.importData.headers),
      headers: [...(state.importData.headers || [])],
      mapping: { ...(state.importData.mapping || {}) },
      visibleOptionalColumns: [...(state.visibleOptionalColumns || [])],
      savedAt: new Date().toISOString(),
    };
  }

  function saveCurrentImportTemplate() {
    if (!(state.importData.headers || []).length) { setImportStatus('Nothing to save: load a file/link first.', 'danger'); return; }
    const tpl = getCurrentImportTemplate();
    const templates = getImportTemplates().filter(t => t.fingerprint !== tpl.fingerprint);
    templates.unshift(tpl);
    saveImportTemplates(templates.slice(0, 20));
    setImportStatus('Import template saved in LocalStorage for this browser.', 'good');
  }

  function findBestImportTemplate(headers) {
    const templates = getImportTemplates();
    if (!templates.length || !headers.length) return null;
    const fp = fingerprintHeaders(headers);
    const exact = templates.find(t => t.fingerprint === fp);
    if (exact) return exact;

    const headerSet = new Set(headers.map(normHeader));
    let best = null;
    let bestScore = 0;
    templates.forEach((t) => {
      const th = (t.headers || []).map(normHeader);
      const matchCount = th.filter(h => headerSet.has(h)).length;
      const score = th.length ? matchCount / th.length : 0;
      if (score > bestScore) { bestScore = score; best = t; }
    });
    return bestScore >= 0.5 ? best : null;
  }

  function applyImportTemplate(template) {
    if (!template) { setImportStatus('No matching saved template found for current headers.', 'danger'); return false; }
    const headers = state.importData.headers || [];
    const mapping = {};
    FIELD_DEFS.forEach((f) => {
      const h = template.mapping?.[f.key] || '';
      mapping[f.key] = headers.includes(h) ? h : '';
    });
    state.importData.mapping = mapping;

    if (Array.isArray(template.visibleOptionalColumns)) {
      state.visibleOptionalColumns = template.visibleOptionalColumns.filter(Boolean);
      if (typeof PNS.saveVisibleOptionalColumns === 'function') PNS.saveVisibleOptionalColumns();
      if (typeof PNS.applyColumnVisibility === 'function') PNS.applyColumnVisibility(state.showAllColumns);
    }
    setImportStatus(`Applied saved template${template.fingerprint === fingerprintHeaders(headers) ? ' (exact match)' : ' (partial match)'}.`, 'good');
    return true;
  }

  function autoApplySavedImportTemplate() {
    const tpl = findBestImportTemplate(state.importData.headers || []);
    if (tpl) applyImportTemplate(tpl);
  }

  function setRawImportDataset(headers, rows, sourceName, sourceType) {
    state.importData.headers = headers || [];
    state.importData.rows = rows || [];
    state.importData.sourceName = sourceName || '';
    state.importData.sourceType = sourceType || '';
    state.importData.loaded = true;

    const detected = autoDetectMapping(state.importData.headers);
    const prev = state.importData.mapping || {};
    const merged = {};
    FIELD_DEFS.forEach((f) => {
      merged[f.key] = prev[f.key] && state.importData.headers.includes(prev[f.key]) ? prev[f.key] : (detected[f.key] || '');
    });
    state.importData.mapping = merged;

    setImportLoadedInfo(`${sourceName} • ${rows.length} rows • ${headers.length} cols`);
    renderImportUI();
    autoApplySavedImportTemplate();
    renderImportUI();
  }

  function handleDetectColumns() {
    if (!(state.importData.headers || []).length) { setImportStatus('Load file/link first, then detect columns.', 'danger'); return; }
    state.importData.mapping = autoDetectMapping(state.importData.headers);
    renderImportUI();
    setImportStatus('Auto-detect complete. Please verify required columns.', 'good');
  }

  function buildImportedPlayersFromRaw() {
    readMappingFromUI();
    const mapping = state.importData.mapping || {};
    const missing = FIELD_DEFS.filter(f => f.required && !mapping[f.key]).map(f => f.label);
    if (missing.length) { setImportStatus(`Missing required mappings: ${missing.join(', ')}`, 'danger'); return null; }

    const players = [];
    let idx = 1;

    for (const row of state.importData.rows || []) {
      const get = (key) => {
        const h = mapping[key];
        return h ? String(row[h] ?? '').trim() : '';
      };
      const name = get('player_name');
      if (!name) continue;

      const shift = PNS.normalizeShiftValue(get('shift_availability'));
      const role = PNS.normalizeRole(get('focus_troop'));

      players.push({
        id: `p${idx++}`,
        name,
        playerExternalId: '',
        alliance: get('alliance_alias'),
        role,
        tier: PNS.normalizeTierText(get('troop_tier')),
        tierRank: PNS.tierRank(get('troop_tier')),
        march: PNS.parseNumber(get('march_size')),
        rally: PNS.parseNumber(get('rally_size')),
        captainReady: PNS.normalizeYesNo(get('captain_ready')),
        shift,
        shiftLabel: PNS.formatShiftLabelForCell(shift),
        lairLevel: get('lair_level'),
        secondaryRole: PNS.normalizeRole(get('secondary_role')),
        secondaryTier: PNS.normalizeTierText(get('secondary_tier')),
        troop200k: get('troop_200k'),
        notes: get('notes'),
        raw: row,
        rowEl: null,
        actionCellEl: null,
        assignment: null,
      });
    }
    return players;
  }

  function resetAssignmentsForImportedData() {
    (state.bases || []).forEach((b) => {
      b.captainId = null;
      b.helperIds = [];
      b.role = null;
      if (typeof PNS.applyBaseRoleUI === 'function') PNS.applyBaseRoleUI(b, null);
    });
  }

  function applyImportedPlayers() {
    const players = buildImportedPlayersFromRaw();
    if (!players) return;
    if (!players.length) { setImportStatus('No player rows found after import (check mapping / empty rows).', 'danger'); return; }

    state.players = players;
    resetAssignmentsForImportedData();

    // New import replaces player data, but keeps tower settings (tier caps/max helpers).
    // Clear persisted tower assignments so old player placements are not restored on refresh.
    if (typeof PNS.clearAssignmentsSnapshot === 'function') PNS.clearAssignmentsSnapshot();

    if (typeof PNS.renderPlayersTableFromState === 'function') PNS.renderPlayersTableFromState();
    if (typeof PNS.buildRowActions === 'function') PNS.buildRowActions();
    if (typeof PNS.renderAll === 'function') PNS.renderAll();

    if (typeof PNS.applyShiftFilter === 'function') PNS.applyShiftFilter(state.activeShift);
    if (typeof PNS.savePlayersSnapshot === 'function') PNS.savePlayersSnapshot(state.players);
    if (typeof PNS.saveAssignmentsSnapshot === 'function') PNS.saveAssignmentsSnapshot();
    if (typeof PNS.persistSessionState === 'function') PNS.persistSessionState();
    // auto-save latest import template so you don't need to press Save after every refresh
    try { saveCurrentImportTemplate(); } catch {}
    setImportStatus(`Imported ${players.length} players successfully. Template auto-saved in LocalStorage.`, 'good');
    setImportLoadedInfo(`${state.importData.sourceName || 'source'} • imported ${players.length} players`);
  }

  async function handleImportFileChange(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      setImportStatus('Reading file...');
      const { headers, rows } = await parseFileToDataset(file);
      if (!headers.length) throw new Error('No headers detected');
      setRawImportDataset(headers, rows, file.name, 'file');
      setImportStatus('File loaded. Verify mapping and click Apply import.', 'good');
    } catch (e) {
      console.error(e);
      setImportStatus(`Failed to parse file: ${e.message || e}`, 'danger');
    }
  }

  async function handleLoadUrlClick() {
    const b = getButtons();
    const raw = b.urlInputMock?.value?.trim();
    if (!raw) { setImportStatus('Paste CSV/Google Sheets link first.', 'danger'); return; }

    try {
      setImportStatus('Loading URL...');
      const { headers, rows } = await loadDatasetFromUrl(raw);
      if (!headers.length) throw new Error('No headers detected');
      setRawImportDataset(headers, rows, raw, 'url');
      setImportStatus('URL loaded. Verify mapping and click Apply import.', 'good');
    } catch (e) {
      console.error(e);
      setImportStatus('Could not load URL. Make sure the sheet is public (Anyone with link / CSV export) and CORS is allowed.', 'danger');
    }
  }

  function handleUseSavedTemplateClick() {
    if (!(state.importData.headers || []).length) { setImportStatus('Load file/link first to apply matching template.', 'danger'); return; }
    const ok = applyImportTemplate(findBestImportTemplate(state.importData.headers));
    renderImportUI();
    if (!ok) updateImportReadinessHint();
  }

  function handleSaveVisibleColumnsClick() {
    const selected = $$('#columnVisibilityChecks input[type="checkbox"][data-col-key]:checked').map(cb => cb.dataset.colKey);
    state.visibleOptionalColumns = selected;
    if (typeof PNS.saveVisibleOptionalColumns === 'function') PNS.saveVisibleOptionalColumns();
    if (typeof PNS.applyColumnVisibility === 'function') PNS.applyColumnVisibility(state.showAllColumns);
    setImportStatus('Visible columns saved in LocalStorage.', 'good');
  }

  function loadDemoIntoImportWizard() {
    const players = state.players || [];
    const headers = ['Player name','Alliance alias','Troop Tier','What is your focus troop?','March size','Rally size','Are you ready to be a captain?','Which shift can you join? (each shift is 4 hours)','Which lair level can you take?','Secondary troop role','Secondary troop tier','Which troop type can you provide at least 200k?','Notes'];
    const rows = players.map((p) => ({
      'Player name': p.name || '',
      'Alliance alias': p.alliance || '',
      'Troop Tier': p.tier || '',
      'What is your focus troop?': p.role || '',
      'March size': String(p.march || ''),
      'Rally size': String(p.rally || ''),
      'Are you ready to be a captain?': p.captainReady ? 'Yes' : 'No',
      'Which shift can you join? (each shift is 4 hours)': p.shift === 'shift1' ? 'Shift 1' : p.shift === 'shift2' ? 'Shift 2' : 'Both',
      'Which lair level can you take?': p.lairLevel || '',
      'Secondary troop role': p.secondaryRole && p.secondaryRole !== 'Unknown' ? p.secondaryRole : '',
      'Secondary troop tier': p.secondaryTier || '',
      'Which troop type can you provide at least 200k?': p.troop200k || '',
      'Notes': p.notes || '',
    }));
    setRawImportDataset(headers, rows, 'Built-in demo data', 'demo');
    setImportStatus('Demo dataset loaded into import wizard.', 'good');
  }

  // ===== bind import modal buttons EVERY time DOM changes =====
  function tryRestorePlayersFromLocalStorage() {
    if (Array.isArray(state.players) && state.players.length) return false;

    // Preferred unified restore (players + bases) if storage module exposes it.
    if (typeof PNS.tryRestoreSessionFromLocalStorage === 'function') {
      const ok = !!PNS.tryRestoreSessionFromLocalStorage();
      if (ok) return true;
    }

    if (typeof PNS.loadPlayersSnapshot !== 'function') return false;
    const restored = PNS.loadPlayersSnapshot();
    if (!Array.isArray(restored) || !restored.length) return false;
    state.players = restored;
    state.playerById = new Map(restored.map((p) => [p.id, p]));
    // Restore tower/base assignments after players snapshot (captains/helpers in bases).
    if (typeof PNS.restoreAssignmentsSnapshot === 'function') {
      try { PNS.restoreAssignmentsSnapshot({ rerender: false, applyShift: false }); } catch {}
      setTimeout(() => {
        try { PNS.restoreAssignmentsSnapshot({ rerender: false, applyShift: false }); } catch {}
      }, 0);
    }
    if (typeof PNS.renderPlayersTableFromState === 'function') PNS.renderPlayersTableFromState();
    if (typeof PNS.buildRowActions === 'function') PNS.buildRowActions();
    if (typeof PNS.renderAll === 'function') PNS.renderAll();
    if (typeof PNS.applyShiftFilter === 'function') PNS.applyShiftFilter(state.activeShift || 'shift1');
    setImportLoadedInfo(`Restored ${restored.length} players from LocalStorage.`);
    setImportStatus('Players restored from previous session. Load/apply a new table anytime to replace them.', 'good');
    return true;
  }

  function bindImportWizardButtons() {
    const b = getButtons();
    if (b.fileInputMock && !b.fileInputMock.dataset.bound) {
      b.fileInputMock.dataset.bound = '1';
      b.fileInputMock.addEventListener('change', handleImportFileChange);
    }
    if (b.loadUrlMockBtn && !b.loadUrlMockBtn.dataset.bound) {
      b.loadUrlMockBtn.dataset.bound = '1';
      b.loadUrlMockBtn.addEventListener('click', handleLoadUrlClick);
    }
    if (b.detectColumnsMockBtn && !b.detectColumnsMockBtn.dataset.bound) {
      b.detectColumnsMockBtn.dataset.bound = '1';
      b.detectColumnsMockBtn.addEventListener('click', () => {
        const bb = getButtons();
        if (bb.urlInputMock?.value?.trim() && !(state.importData.headers || []).length) handleLoadUrlClick();
        else handleDetectColumns();
      });
    }
    if (b.useTemplateMockBtn && !b.useTemplateMockBtn.dataset.bound) {
      b.useTemplateMockBtn.dataset.bound = '1';
      b.useTemplateMockBtn.addEventListener('click', handleUseSavedTemplateClick);
    }
    if (b.saveVisibleColumnsMockBtn && !b.saveVisibleColumnsMockBtn.dataset.bound) {
      b.saveVisibleColumnsMockBtn.dataset.bound = '1';
      b.saveVisibleColumnsMockBtn.addEventListener('click', handleSaveVisibleColumnsClick);
    }
    if (b.loadDemoImportBtn && !b.loadDemoImportBtn.dataset.bound) {
      b.loadDemoImportBtn.dataset.bound = '1';
      b.loadDemoImportBtn.addEventListener('click', loadDemoIntoImportWizard);
    }
    if (b.saveTemplateMockBtn && !b.saveTemplateMockBtn.dataset.bound) {
      b.saveTemplateMockBtn.dataset.bound = '1';
      b.saveTemplateMockBtn.addEventListener('click', saveCurrentImportTemplate);
    }
    if (b.applyImportMockBtn && !b.applyImportMockBtn.dataset.bound) {
      b.applyImportMockBtn.dataset.bound = '1';
      b.applyImportMockBtn.addEventListener('click', applyImportedPlayers);
    }
  }

  function initImportWizard() {
    if (typeof PNS.loadFieldLabelOverrides === 'function') PNS.loadFieldLabelOverrides();
    if (typeof PNS.loadVisibleOptionalColumns === 'function') PNS.loadVisibleOptionalColumns();
    ensureImportMappingDefaults();
    renderImportUI();
    const restored = tryRestorePlayersFromLocalStorage();
    if (!restored) setImportLoadedInfo('No file loaded yet. You can use built-in demo data.');
    bindImportWizardButtons();
    // Retry restore after all scripts/partials are definitely ready (script-order safe).
    setTimeout(() => { try { if (!(state.players||[]).length) tryRestorePlayersFromLocalStorage(); } catch {} }, 50);
    window.addEventListener('load', () => { try { if (!(state.players||[]).length) tryRestorePlayersFromLocalStorage(); } catch {} }, { once: true });
  }

  function reInitImportWizard() {
    // якщо модалки ще не в DOM — просто виходимо
    const modal = document.querySelector('#settings-modal');
    if (!modal) return;

    // ensure state
    state.importData = state.importData || { headers: [], rows: [], mapping: {}, loaded: false };

    // rebind buttons and rerender (safe)
    bindImportWizardButtons();
    renderImportUI();
  }

  // expose
  PNS.renderImportUI = renderImportUI;
  PNS.saveCurrentImportTemplate = saveCurrentImportTemplate;
  PNS.applyImportedPlayers = applyImportedPlayers;

  PNS.handleImportFileChange = handleImportFileChange;
  PNS.handleLoadUrlClick = handleLoadUrlClick;
  PNS.handleDetectColumns = handleDetectColumns;
  PNS.handleUseSavedTemplateClick = handleUseSavedTemplateClick;
  PNS.handleSaveVisibleColumnsClick = handleSaveVisibleColumnsClick;
  PNS.loadDemoIntoImportWizard = loadDemoIntoImportWizard;
  PNS.initImportWizard = initImportWizard;
  PNS.reInitImportWizard = reInitImportWizard;

  // init
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initImportWizard);
  else initImportWizard();

  // HTMX swaps
  document.addEventListener('htmx:afterSwap', reInitImportWizard);
  document.addEventListener('htmx:afterSettle', reInitImportWizard);

  // custom event (якщо ти сам робиш fetch partials)
  document.addEventListener('pns:partials:loaded', reInitImportWizard);

})();