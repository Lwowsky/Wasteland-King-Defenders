(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state, $$ } = PNS;
  const t = (key, fallback = '') => (typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback);

  const FIELD_LABEL_KEYS = {
    player_name: 'player_name',
    focus_troop: 'troop_type',
    troop_tier: 'troop_tier_import',
    march_size: 'march_size',
    rally_size: 'rally_size',
    alliance_alias: 'alliance',
    captain_ready: 'captain_ready_import',
    shift_availability: 'shift_availability_import',
    lair_level: 'lair_level',
    secondary_role: 'secondary_role_import',
    secondary_tier: 'secondary_tier_import',
    troop_200k: 'troop_200k_import',
    notes: 'notes',
  };

  function getDefaultFieldLabel(key, fallback = '') {
    const defaults = {
      player_name: t('player_name', 'Нік гравця'),
      focus_troop: t('troop_type', 'Тип військ'),
      troop_tier: t('troop_tier_import', 'Тір військ'),
      march_size: t('march_size', 'Розмір маршу'),
      rally_size: t('rally_size', 'Розмір ралі'),
      alliance_alias: t('alliance', 'Альянс'),
      captain_ready: t('captain_ready_import', 'Готовність бути капітаном'),
      shift_availability: t('shift_availability_import', 'Доступність по змінах'),
      lair_level: t('lair_level', 'Рівень лігва'),
      secondary_role: t('secondary_role_import', 'Тип резервних військ'),
      secondary_tier: t('secondary_tier_import', 'Тір резервних військ'),
      troop_200k: t('troop_200k_import', 'Тип резервних військ (200k+)'),
      notes: t('notes', 'Нотатки'),
    };
    return defaults[key] || fallback || key;
  }

  function getDefaultCustomFieldLabel(key, fallback = '') {
    const defaults = {
      reserve_type_fighter: t('reserve_type_fighter_import', 'Резервний тип військ: боєць'),
      reserve_type_rider: t('reserve_type_rider_import', 'Резервний тип військ: наїзник'),
      reserve_type_shooter: t('reserve_type_shooter_import', 'Резервний тип військ: стрілець'),
    };
    return defaults[key] || fallback || key;
  }

  // ---- Field definitions (required + додаткова import mapping) ----
  const FIELD_DEFS = [
    { key: 'player_name', label: 'Ім’я гравця', required: true, aliases: ['player name','name','nickname','nick','имя игрока','имя','імя гравця','імя','player'] },
    { key: 'focus_troop', label: 'Тип військ', required: true, aliases: ['focus troop','main troop','main role','troop role','what is your focus troop','основной тип войск','главная роль','головна роль','role'] },
    { key: 'troop_tier', label: 'Тір військ', required: true, aliases: ['troop tier','tier','main tier','главный тир','головний тір','тир','тір'] },
    { key: 'march_size', label: 'Розмір маршу', required: true, aliases: ['march size','squad size','troop size','размер отряда','розмір твого отряду','march'] },
    { key: 'rally_size', label: 'Розмір групової атаки', required: true, colKey: 'rally_size', aliases: ['rally size','group attack','group atk','размер групповой атаки','розмір групової атаки','rally'] },
    { key: 'alliance_alias', label: 'Альянс', required: true, colKey: 'alliance', aliases: ['alliance alias','alliance','альянс','ally','tag'] },
    { key: 'captain_ready', label: 'Готовність бути капітаном', required: true, aliases: ['captain','ready to be captain','готов быть капитаном','готовий бути капітаном','captain ready'] },
    { key: 'shift_availability', label: 'Доступність по зміні', required: true, aliases: ['shift','смена','зміна','which shift can you join'] },

    { key: 'lair_level', label: 'Рівень лігва', required: false, colKey: 'lair_level', visibleDefault: true, aliases: ['lair','логово','which lair level can you take'] },
    { key: 'secondary_role', label: 'Тип резервних військ', required: false, colKey: 'secondary_role', visibleDefault: false, aliases: ['secondary troop role','secondary role','reserve troop type','reserve troop','дополнительная роль','додаткова роль'] },
    { key: 'secondary_tier', label: 'Тір резервних військ', required: false, colKey: 'secondary_tier', visibleDefault: false, aliases: ['secondary troop tier','secondary tier','reserve troop tier','дополнительный тир','додатковий тір'] },
    { key: 'troop_200k', label: 'Тип резервних військ (200k+)', required: false, colKey: 'troop_200k', visibleDefault: false, aliases: ['200k','at least 200k','provide at least 200k','reserve troop type 200k','200к'] },
    { key: 'notes', label: 'Нотатки', required: false, colKey: 'notes', visibleDefault: false, aliases: ['note','notes','комментарий','коментар','примітка','comment'] },
  ];
  const OPTIONAL_FIELDS = FIELD_DEFS.filter(f => !f.required);
  const OPTIONAL_BUILTIN_KEYS = new Set(['lair_level']);
  const OPTIONAL_FIELDS_UI = OPTIONAL_FIELDS.filter(f => OPTIONAL_BUILTIN_KEYS.has(f.key));
  const PERSIST_KEYS = {
    CUSTOM_OPTIONAL_DEFS: 'pns_layout_import_custom_додаткова_defs_v2'
  };
  const DEFAULT_CUSTOM_OPTIONAL_DEFS = [
    { key: 'reserve_type_fighter', label: 'Резервний тип військ: боєць', isCustom: true, colKey: 'reserve_type_fighter', visibleDefault: true },
    { key: 'reserve_type_rider', label: 'Резервний тип військ: наїздник', isCustom: true, colKey: 'reserve_type_rider', visibleDefault: true },
    { key: 'reserve_type_shooter', label: 'Резервний тип військ: стрілець', isCustom: true, colKey: 'reserve_type_shooter', visibleDefault: true },
  ];

  const CANONICAL_CUSTOM_OPTIONAL_LABELS = {
    reserve_type_fighter: 'Резервний тип військ: боєць',
    reserve_type_rider: 'Резервний тип військ: наїздник',
    reserve_type_shooter: 'Резервний тип військ: стрілець',
  };

  function canonicalizeCustomOptionalLabel(key, fallbackLabel) {
    const k = String(key || '').trim();
    return getDefaultCustomFieldLabel(k, CANONICAL_CUSTOM_OPTIONAL_LABELS[k] || String(fallbackLabel || '').trim());
  }

  function sanitizeCustomFieldKeyPart(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'field';
  }
  function normalizeCustomOptionalDefs(defs) {
    const seen = new Set();
    return (Array.isArray(defs) ? defs : []).map((d, idx) => {
      let label = String(d?.label || '').trim() || `Кастомна колонка ${idx + 1}`;
      let key = String(d?.key || '').trim();
      if (!key) key = `custom_opt_${idx + 1}_${sanitizeCustomFieldKeyPart(label)}`;
      key = key.replace(/[^a-zA-Z0-9_:-]/g, '_');
      label = canonicalizeCustomOptionalLabel(key, label);
      if (seen.has(key)) key = `${key}_${idx + 1}`;
      seen.add(key);
      return {
        key,
        label,
        required: false,
        colKey: key,
        visibleDefault: !!d?.visibleDefault,
        isCustom: true,
      };
    });
  }
  function defaultCustomOptionalDefs() {
    return normalizeCustomOptionalDefs(DEFAULT_CUSTOM_OPTIONAL_DEFS);
  }
  function readPersistedCustomOptionalDefs() {
    try {
      const raw = localStorage.getItem(PERSIST_KEYS.CUSTOM_OPTIONAL_DEFS);
      const parsed = raw ? JSON.parse(raw) : [];
      const byKey = new Map(defaultCustomOptionalDefs().map((d) => [d.key, d]));
      (Array.isArray(parsed) ? parsed : []).forEach((d) => {
        if (!d || !String(d.key || '').trim()) return;
        byKey.set(String(d.key), { ...(byKey.get(String(d.key)) || {}), ...d });
      });
      return normalizeCustomOptionalDefs(Array.from(byKey.values()));
    } catch {
      return defaultCustomOptionalDefs();
    }
  }
  function persistCustomOptionalDefs(defs) {
    try {
      localStorage.setItem(PERSIST_KEYS.CUSTOM_OPTIONAL_DEFS, JSON.stringify(normalizeCustomOptionalDefs(defs)));
    } catch {}
  }
  function getCustomOptionalDefs() {
    state.importData = state.importData || { headers: [], rows: [], mapping: {}, loaded: false };
    if (!Array.isArray(state.importData.customOptionalDefs) || !state.importData.customOptionalDefs.length) {
      state.importData.customOptionalDefs = readPersistedCustomOptionalDefs();
    }
    state.importData.customOptionalDefs = normalizeCustomOptionalDefs(state.importData.customOptionalDefs);
    return state.importData.customOptionalDefs;
  }
  function ensureCustomOptionalDefs() {
    const defs = getCustomOptionalDefs();
    if (!defs.length) {
      state.importData.customOptionalDefs = defaultCustomOptionalDefs();
      persistCustomOptionalDefs(state.importData.customOptionalDefs);
    }
    return getCustomOptionalDefs();
  }
  function addCustomOptionalDef(defaultLabel) {
    const defs = getCustomOptionalDefs().slice();
    const nextIndex = defs.length + 1;
    const label = String(defaultLabel || t('custom_column_numbered', `Кастомна колонка ${nextIndex}`).replace('{n}', String(nextIndex))).trim();
    defs.push({ key: `custom_opt_${Date.now()}_${nextIndex}_${sanitizeCustomFieldKeyPart(label)}`, label, visibleDefault: false });
    state.importData.customOptionalDefs = normalizeCustomOptionalDefs(defs);
    persistCustomOptionalDefs(state.importData.customOptionalDefs);
    const newDef = state.importData.customOptionalDefs[state.importData.customOptionalDefs.length - 1];
    if (state.importData?.mapping && !(newDef.key in state.importData.mapping)) state.importData.mapping[newDef.key] = '';
    renderImportUI();
    try { window.PNSI18N?.apply?.(document.getElementById('settings-modal') || document); } catch {}
    try { window.PNSI18N?.apply?.(document.getElementById('settings-modal') || document); } catch {}
    requestAnimationFrame(() => {
      try {
        const input = document.querySelector(`#optionalMappingContainer .mapping-row[data-map-key="${CSS.escape(newDef.key)}"] .field-label-input`);
        if (input) { input.focus(); input.select(); }
      } catch {}
    });
  }
  function removeCustomOptionalDef(key) {
    const k = String(key || '');
    if (!k) return;
    const defs = getCustomOptionalDefs().filter((d) => d.key !== k);
    state.importData.customOptionalDefs = normalizeCustomOptionalDefs(defs.length ? defs : defaultCustomOptionalDefs());
    persistCustomOptionalDefs(state.importData.customOptionalDefs);
    if (state.importData?.mapping && (k in state.importData.mapping)) delete state.importData.mapping[k];
    if (Array.isArray(state.visibleOptionalColumns)) {
      state.visibleOptionalColumns = state.visibleOptionalColumns.filter((c) => c !== k);
      if (typeof PNS.saveVisibleOptionalColumns === 'function') PNS.saveVisibleOptionalColumns();
    }
    renderImportUI();
  }
  function getAllOptionalMappingFieldsForUI() {
    return [...OPTIONAL_FIELDS_UI, ...ensureCustomOptionalDefs()];
  }
  function getVisibleOptionalFieldsForVisibilityPanel() {
    return [...OPTIONAL_FIELDS_UI, ...getCustomOptionalDefs()];
  }
  function autoDetectCustomOptionalMapping(headers, def) {
    return findHeaderMatch(headers, { key: def.key, label: def.label, aliases: [def.label] }) || '';
  }

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
      saveTemplateMockBtns: Array.from(document.querySelectorAll('[data-save-import-template]')),
      applyImportMockBtn: document.querySelector('#applyImportMockBtn'),
      resetAllStorageBtn: document.querySelector('#resetAllStorageBtn'),
      resetColumnDataBtn: document.querySelector('#resetColumnDataBtn'),
      resetTableDataBtn: document.querySelector('#resetTableDataBtn'),
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
    const def = getFieldDefByKey(key);
    return getDefaultFieldLabel(key, def?.label || key);
  }

  function migrateImportUiLabels() {
    try {
      const defs = normalizeCustomOptionalDefs(getCustomOptionalDefs());
      state.importData.customOptionalDefs = defs;
      persistCustomOptionalDefs(defs);
    } catch {}
    try {
      const overrides = state.fieldLabelOverrides && typeof state.fieldLabelOverrides === 'object'
        ? { ...state.fieldLabelOverrides }
        : {};
      const changed = [];
      if (overrides.reserve_type_fighter && overrides.reserve_type_fighter !== CANONICAL_CUSTOM_OPTIONAL_LABELS.reserve_type_fighter) {
        overrides.reserve_type_fighter = CANONICAL_CUSTOM_OPTIONAL_LABELS.reserve_type_fighter;
        changed.push('reserve_type_fighter');
      }
      if (overrides.reserve_type_rider && overrides.reserve_type_rider !== CANONICAL_CUSTOM_OPTIONAL_LABELS.reserve_type_rider) {
        overrides.reserve_type_rider = CANONICAL_CUSTOM_OPTIONAL_LABELS.reserve_type_rider;
        changed.push('reserve_type_rider');
      }
      if (overrides.reserve_type_shooter && overrides.reserve_type_shooter !== CANONICAL_CUSTOM_OPTIONAL_LABELS.reserve_type_shooter) {
        overrides.reserve_type_shooter = CANONICAL_CUSTOM_OPTIONAL_LABELS.reserve_type_shooter;
        changed.push('reserve_type_shooter');
      }
      if (changed.length) {
        state.fieldLabelOverrides = overrides;
        if (typeof PNS.saveFieldLabelOverrides === 'function') PNS.saveFieldLabelOverrides();
      }
    } catch {}
  }

  function getDefaultVisibleOptionalColumns() {
    const builtin = OPTIONAL_FIELDS_UI.filter(f => f.visibleDefault).map(f => f.colKey);
    const custom = ensureCustomOptionalDefs().filter(f => f.visibleDefault).map(f => f.colKey);
    return Array.from(new Set([...builtin, ...custom]));
  }

  // expose needed defs for storage module
  PNS.FIELD_DEFS = FIELD_DEFS;
  PNS.OPTIONAL_FIELDS = OPTIONAL_FIELDS;
  PNS.getFieldDefByKey = getFieldDefByKey;
  PNS.getFieldLabel = getFieldLabel;
  PNS.getDefaultVisibleOptionalColumns = getDefaultVisibleOptionalColumns;
  PNS.getCustomOptionalDefs = getCustomOptionalDefs;

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
    ensureCustomOptionalDefs();
    const m = state.importData.mapping || {};
    FIELD_DEFS.forEach((f) => { if (!(f.key in m)) m[f.key] = ''; });
    getCustomOptionalDefs().forEach((f) => { if (!(f.key in m)) m[f.key] = ''; });
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
    if (!headers.length) { setImportStatus('Спочатку завантаж CSV/XLSX файл або встав публічне CSV-посилання Google Sheets.'); return; }
    const missing = FIELD_DEFS.filter(f => f.required && !state.importData.mapping?.[f.key]).map(f => getFieldLabel(f.key));
    if (missing.length) setImportStatus(`Заповни обов’язкові колонки: ${missing.join(', ')}`, 'danger');
    else setImportStatus(`Готово до імпорту • ${state.importData.rows.length} рядків • ${headers.length} колонок`, 'good');
  }

  function renderImportUI() {
    const headers = state.importData.headers || [];
    ensureImportMappingDefaults();
    migrateImportUiLabels();
    const controls = getControls();

    if (controls.requiredMappingContainer) {
      controls.requiredMappingContainer.innerHTML = '';
      FIELD_DEFS.filter(f => f.required).forEach((f) => {
        const row = document.createElement('div');
        row.className = 'mapping-row required';
        const currentLabel = getFieldLabel(f.key);
        row.innerHTML = `<div class="row-title-wrap"><div class="row-title">${PNS.escapeHtml(currentLabel)} <strong>*</strong></div><button type="button" class="mapping-edit-btn"><span aria-hidden="true">✎</span><span>${t('edit', 'Редагувати')}</span></button></div>`;

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
        const empty = document.createElement('option'); empty.value = ''; empty.textContent = t('choose_column_placeholder', '— вибери колонку —');
        select.appendChild(empty);
        headers.forEach((h) => { const opt = document.createElement('option'); opt.value = h; opt.textContent = h; select.appendChild(opt); });
        select.value = state.importData.mapping[f.key] || '';
        select.addEventListener('change', () => { state.importData.mapping[f.key] = select.value; updateImportReadinessHint(); });
        row.appendChild(select);

        const editBtn = row.querySelector('.mapping-edit-btn');
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
      getAllOptionalMappingFieldsForUI().forEach((f) => {
        const row = document.createElement('div');
        row.className = 'mapping-row' + (f.isCustom ? ' is-custom-row' : '');
        row.dataset.mapKey = f.key;
        const currentLabel = f.isCustom ? String(f.label || '').trim() : getFieldLabel(f.key);
        const titleHtml = f.isCustom
          ? `${PNS.escapeHtml(currentLabel)} <span class="mapping-meta">${t('custom_column_label','кастомна')}</span>`
          : `${PNS.escapeHtml(currentLabel)} <span class="mapping-meta">${t('extra_column_label','додаткова')}</span>`;
        row.innerHTML = `<div class="row-title-wrap"><div class="row-title">${titleHtml}</div><div class="row-title-actions">${f.isCustom ? `<button type="button" class="mapping-remove-btn" title="${t('remove_extra_column', 'Видалити додаткову колонку')}" aria-label="${t('remove_extra_column', 'Видалити додаткову колонку')}">✕</button>` : ''}<button type="button" class="mapping-edit-btn"><span aria-hidden="true">✎</span><span>${t('edit', 'Редагувати')}</span></button></div></div>`;

        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.className = 'field-label-input';
        labelInput.value = currentLabel;
        labelInput.placeholder = f.isCustom ? t('custom_column_name_placeholder', 'Назва кастомної колонки') : '';
        labelInput.addEventListener('change', () => {
          if (f.isCustom) {
            const defs = getCustomOptionalDefs().map((d) => d.key === f.key ? { ...d, label: labelInput.value || d.label } : d);
            state.importData.customOptionalDefs = normalizeCustomOptionalDefs(defs);
            persistCustomOptionalDefs(state.importData.customOptionalDefs);
          } else if (typeof PNS.setFieldLabelOverride === 'function') {
            PNS.setFieldLabelOverride(f.key, labelInput.value);
          }
          renderImportUI();
        });
        row.appendChild(labelInput);

        const select = document.createElement('select');
        select.dataset.mapField = f.key;
        const empty = document.createElement('option'); empty.value = ''; empty.textContent = t('not_mapped_placeholder', '— не прив’язано —');
        select.appendChild(empty);
        headers.forEach((h) => { const opt = document.createElement('option'); opt.value = h; opt.textContent = h; select.appendChild(opt); });
        select.value = state.importData.mapping[f.key] || '';
        select.addEventListener('change', () => { state.importData.mapping[f.key] = select.value; });
        row.appendChild(select);

        const editBtn = row.querySelector('.mapping-edit-btn');
        if (editBtn) {
          editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            row.classList.toggle('edit-open');
            if (row.classList.contains('edit-open')) labelInput.focus();
          });
        }
        const removeBtn = row.querySelector('.mapping-remove-btn');
        if (removeBtn) {
          removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            removeCustomOptionalDef(f.key);
          });
        }

        controls.optionalMappingContainer.appendChild(row);
      });

      const addRow = document.createElement('div');
      addRow.className = 'mapping-row mapping-add-row';
      addRow.innerHTML = `<button type="button" class="btn btn-sm mapping-add-btn">${t('add_extra_column', '+ Додати додаткову колонку')}</button>`;
      addRow.querySelector('.mapping-add-btn')?.addEventListener('click', () => addCustomOptionalDef());
      controls.optionalMappingContainer.appendChild(addRow);
    }

    if (controls.columnVisibilityChecks) {
      controls.columnVisibilityChecks.innerHTML = '';
      const visibilityFields = getVisibleOptionalFieldsForVisibilityPanel();
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
          if (typeof PNS.saveVisibleOptionalColumns === 'function') PNS.saveVisibleOptionalColumns();
          if (typeof PNS.applyColumnVisibility === 'function') PNS.applyColumnVisibility(state.showAllColumns);
        });
        controls.columnVisibilityChecks.appendChild(label);
      try { window.PNSI18N?.apply?.(label); } catch {}
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
      name: 'Останній шаблон',
      fingerprint: fingerprintHeaders(state.importData.headers),
      headers: [...(state.importData.headers || [])],
      mapping: { ...(state.importData.mapping || {}) },
      visibleOptionalColumns: [...(state.visibleOptionalColumns || [])],
      customOptionalDefs: [...getCustomOptionalDefs().map((d) => ({ key: d.key, label: d.label }))],
      savedAt: new Date().toISOString(),
    };
  }

  function saveCurrentImportTemplate() {
    if (!(state.importData.headers || []).length) { setImportStatus('Немає що зберігати: спочатку завантаж файл або посилання.', 'danger'); return; }
    const tpl = getCurrentImportTemplate();
    const templates = getImportTemplates().filter(t => t.fingerprint !== tpl.fingerprint);
    templates.unshift(tpl);
    saveImportTemplates(templates.slice(0, 20));
    setImportStatus(t('import_template_saved', 'Шаблон імпорту збережено.'), 'good');
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
    if (!template) { setImportStatus(t('import_template_not_found', 'Для поточних заголовків не знайдено відповідного збереженого шаблону.'), 'danger'); return false; }
    const headers = state.importData.headers || [];

    if (Array.isArray(template.customOptionalDefs)) {
      state.importData.customOptionalDefs = normalizeCustomOptionalDefs(template.customOptionalDefs);
      persistCustomOptionalDefs(state.importData.customOptionalDefs);
    }
    ensureCustomOptionalDefs();

    const mapping = {};
    [...FIELD_DEFS, ...getCustomOptionalDefs()].forEach((f) => {
      const h = template.mapping?.[f.key] || '';
      mapping[f.key] = headers.includes(h) ? h : '';
    });
    state.importData.mapping = mapping;

    if (Array.isArray(template.visibleOptionalColumns)) {
      state.visibleOptionalColumns = template.visibleOptionalColumns.filter(Boolean);
      if (typeof PNS.saveVisibleOptionalColumns === 'function') PNS.saveVisibleOptionalColumns();
      if (typeof PNS.applyColumnVisibility === 'function') PNS.applyColumnVisibility(state.showAllColumns);
    }
    setImportStatus(`Застосовано збережений шаблон${template.fingerprint === fingerprintHeaders(headers) ? ' (точний збіг)' : ' (частковий збіг)'}.`, 'good');
    return true;
  }

  function autoApplySavedImportTemplate() {
    const tpl = findBestImportTemplate(state.importData.headers || []);
    if (tpl) applyImportTemplate(tpl);
  }

  function setRawImportDataset(headers, rows, джерелоName, джерелоType) {
    state.importData.headers = headers || [];
    state.importData.rows = rows || [];
    state.importData.джерелоName = джерелоName || '';
    state.importData.джерелоType = джерелоType || '';
    state.importData.loaded = true;

    ensureCustomOptionalDefs();
    const detected = autoDetectMapping(state.importData.headers);
    const prev = state.importData.mapping || {};
    const merged = {};
    FIELD_DEFS.forEach((f) => {
      merged[f.key] = prev[f.key] && state.importData.headers.includes(prev[f.key]) ? prev[f.key] : (detected[f.key] || '');
    });
    getCustomOptionalDefs().forEach((f) => {
      const auto = autoDetectCustomOptionalMapping(state.importData.headers, f);
      merged[f.key] = prev[f.key] && state.importData.headers.includes(prev[f.key]) ? prev[f.key] : (auto || '');
    });
    state.importData.mapping = merged;

    setImportLoadedInfo(`${джерелоName} • ${rows.length} рядків • ${headers.length} колонок`);
    renderImportUI();
    autoApplySavedImportTemplate();
    renderImportUI();
  }

  function handleDetectColumns() {
    if (!(state.importData.headers || []).length) { setImportStatus('Спочатку завантаж файл або посилання, потім визнач колонки.', 'danger'); return; }
    ensureCustomOptionalDefs();
    const detected = autoDetectMapping(state.importData.headers);
    getCustomOptionalDefs().forEach((f) => { detected[f.key] = autoDetectCustomOptionalMapping(state.importData.headers, f); });
    state.importData.mapping = detected;
    renderImportUI();
    setImportStatus(t('columns_auto_detected', 'Колонки визначено автоматично. Перевір зіставлення обов’язкових колонок.'), 'good');
  }

  function buildImportedPlayersFromRaw() {
    readMappingFromUI();
    const mapping = state.importData.mapping || {};
    const missing = FIELD_DEFS.filter(f => f.required && !mapping[f.key]).map(f => f.label);
    if (missing.length) { setImportStatus(`Бракує обов’язкових зіставлень: ${missing.join(', ')}`, 'danger'); return null; }

    const customDefs = getCustomOptionalDefs();
    const customFieldLabels = Object.fromEntries(customDefs.map((d) => [d.key, d.label]));
    const гравців = [];
    let idx = 1;

    for (const row of state.importData.rows || []) {
      const get = (key) => {
        const h = mapping[key];
        return h ? String(row[h] ?? '').trim() : '';
      };
      const name = get('player_name');
      if (!name) continue;

      const registeredShiftRaw = get('shift_availability');
      const shift = PNS.normalizeShiftValue(registeredShiftRaw);
      const role = PNS.normalizeRole(get('focus_troop'));

      const customFields = {};
      let notesFromCustom = '';
      customDefs.forEach((d) => {
        const val = get(d.key);
        if (!val) return;
        const labelNorm = String(d.label || '').trim().toLowerCase();
        if (labelNorm === 'notes') {
          if (!notesFromCustom) notesFromCustom = val;
          return;
        }
        customFields[d.key] = val;
      });

      гравців.push({
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
        registeredShiftRaw,
        registeredShift: shift,
        registeredShiftLabel: PNS.formatShiftLabelForCell(shift),
        shift,
        shiftLabel: PNS.formatShiftLabelForCell(shift),
        lairLevel: get('lair_level'),
        secondaryRole: PNS.normalizeRole(get('secondary_role')),
        secondaryTier: PNS.normalizeTierText(get('secondary_tier')),
        troop200k: get('troop_200k'),
        notes: get('notes') || notesFromCustom,
        customFields,
        customFieldLabels,
        raw: row,
        rowEl: null,
        actionCellEl: null,
        assignment: null,
      });
    }
    return гравців;
  }

  function resetAssignmentsForImportedData() {
    state.shiftPlans = {};
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
    if (!players.length) { setImportStatus('Після імпорту не знайдено жодного гравця. Перевір мапінг колонок і порожні рядки.', 'danger'); return; }

    state.players = players;
    state.playerById = new Map(players.map((p) => [p.id, p]));
    resetAssignmentsForImportedData();

    // New імпортовано roster must reset tower assignments (but keep tower settings/limits)
    try { PNS.clearTowersSnapshot?.(); } catch {}
    try { PNS.clearTowerMarchOverrides?.(); } catch {}
    try { if (state && typeof state === 'object') state.shiftPlans = {}; } catch {}

    if (typeof PNS.renderPlayersTableFromState === 'function') PNS.renderPlayersTableFromState();
    if (typeof PNS.buildRowActions === 'function') PNS.buildRowActions();
    if (typeof PNS.renderAll === 'function') PNS.renderAll();

    if (typeof PNS.applyShiftFilter === 'function') PNS.applyShiftFilter(state.activeShift);
    if (typeof PNS.savePlayersSnapshot === 'function') PNS.savePlayersSnapshot(state.players);
    try { saveCurrentImportTemplate(); } catch {}
    try { PNS.saveTowersSnapshot?.(); } catch {}
    try { PNS.persistSessionStateSoon?.(20); } catch {}
    // auto-save latest import template so you don't need to press Save after every refresh
    try { saveCurrentImportTemplate(); } catch {}
    setImportStatus(`Імпортовано ${players.length} гравців. Шаблон автоматично оновлено в LocalStorage.`, 'good');
    setImportLoadedInfo(`${state.importData.джерелоName || 'джерело'} • імпортовано ${players.length} гравців`);
  }


  async function handleImportFileChange(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      setImportStatus('Читаю файл...');
      const { headers, rows } = await parseFileToDataset(file);
      if (!headers.length) throw new Error('Не вдалося знайти заголовки колонок');
      setRawImportDataset(headers, rows, file.name, 'file');
      setImportStatus('Файл завантажено. Перевір мапінг і натисни «Застосувати імпорт».', 'good');
    } catch (e) {
      console.error(e);
      setImportStatus(`Не вдалося розібрати файл: ${e.message || e}`, 'danger');
    }
  }

  async function handleLoadUrlClick() {
    const b = getButtons();
    const raw = b.urlInputMock?.value?.trim();
    if (!raw) { setImportStatus('Спочатку встав CSV-посилання або посилання Google Sheets.', 'danger'); return; }

    try {
      setImportStatus('Завантажую URL...');
      const { headers, rows } = await loadDatasetFromUrl(raw);
      if (!headers.length) throw new Error('Не вдалося знайти заголовки колонок');
      setRawImportDataset(headers, rows, raw, 'url');
      setImportStatus('URL завантажено. Перевір мапінг і натисни «Застосувати імпорт».', 'good');
    } catch (e) {
      console.error(e);
      setImportStatus('Не вдалося завантажити URL. Переконайся, що таблиця публічна (Anyone with link / CSV export) і що CORS дозволений.', 'danger');
    }
  }

  function handleUseSavedTemplateClick() {
    if (!(state.importData.headers || []).length) { setImportStatus('Спочатку завантаж файл або посилання, щоб застосувати відповідний шаблон.', 'danger'); return; }
    const ok = applyImportTemplate(findBestImportTemplate(state.importData.headers));
    renderImportUI();
    if (!ok) updateImportReadinessHint();
  }

  function handleSaveVisibleColumnsClick() {
    const selected = $$('#columnVisibilityChecks input[type="checkbox"][data-col-key]:checked').map(cb => cb.dataset.colKey);
    state.visibleOptionalColumns = selected;
    if (typeof PNS.saveVisibleOptionalColumns === 'function') PNS.saveVisibleOptionalColumns();
    if (typeof PNS.applyColumnVisibility === 'function') PNS.applyColumnVisibility(state.showAllColumns);
    setImportStatus(t('visible_columns_saved', 'Видимі колонки збережено.'), 'good');
  }

  function loadDemoIntoImportWizard() {
    const гравців = state.players || [];
    const headers = ['Нік гравця','Альянс','Тір військ','Основний тип військ','Розмір маршу','Розмір ралі','Готовий бути капітаном','Яка зміна підходить','Рівень лігва','Тип резервних військ','Тір резервних військ','Тип резерву (200k+)','Примітки'];
    const rows = гравців.map((p) => ({
      'Нік гравця': p.name || '',
      'Альянс': p.alliance || '',
      'Тір військ': p.tier || '',
      'Основний тип військ': p.role || '',
      'Розмір маршу': String(p.march || ''),
      'Розмір ралі': String(p.rally || ''),
      'Готовий бути капітаном': p.captainReady ? 'Так' : 'Ні',
      'Яка зміна підходить': p.shift === 'shift1' ? 'Зміна 1' : p.shift === 'shift2' ? 'Зміна 2' : 'Обидві',
      'Рівень лігва': p.lairLevel || '',
      'Тип резервних військ': p.secondaryRole && p.secondaryRole !== 'Unknown' ? p.secondaryRole : '',
      'Тір резервних військ': p.secondaryTier || '',
      'Тип резерву (200k+)': p.troop200k || '',
      'Примітки': p.notes || '',
    }));
    setRawImportDataset(headers, rows, 'Вбудовані демо-дані', 'demo');
    setImportStatus(t('import_demo_loaded', 'Демо-набір завантажено в майстер імпорту.'), 'good');
  }

  // ===== bind import modal buttons EVERY time DOM changes =====
  let __restoreRetryTimers = [];
  function _clearRestoreRetryTimers() {
    try { __restoreRetryTimers.forEach((id) => clearTimeout(id)); } catch {}
    __restoreRetryTimers = [];
  }
  function _attemptRestoreTowersAndRefreshUI() {
    try {
      if (!Array.isArray(state.players) || !state.players.length) return false;
      if (!state.playerById || typeof state.playerById.get !== 'function') {
        state.playerById = new Map((state.players || []).map((p) => [p.id, p]));
      }
      let restoredTowers = false;
      try { if (typeof PNS.applyShiftFilter === 'function') PNS.applyShiftFilter(state.activeShift || 'shift1'); } catch {}
      if (typeof PNS.tryRestoreTowersSnapshot === 'function') {
        restoredTowers = !!PNS.tryRestoreTowersSnapshot();
      }
      if (!restoredTowers) {
        try { restoredTowers = !!PNS.restoreBasesFromPlayerAssignments?.(); } catch {}
      }
      try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
      if (typeof PNS.renderAll === 'function') PNS.renderAll();
      try { PNS.calcSyncCaptainsFromTowersIntoCalculator?.({ keepHelpers: true, render: false }); } catch {}
      try { window.calcRenderInlineTowerSettings?.(document.getElementById('towerCalcModal')); } catch {}
      try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {}
      try { window.calcUpdateShiftStatsUI?.(document.getElementById('towerCalcModal')); } catch {}
      return restoredTowers;
    } catch { return false; }
  }


  function _needsPlayersTableRender() {
    const table = document.querySelector('#playersDataTable');
    const bodyRows = document.querySelectorAll('#playersDataTable tbody tr');
    if (!table) return false;
    if (bodyRows.length !== (state.players || []).length) return true;
    return (state.players || []).some((p) => !p || !p.rowEl || !p.rowEl.isConnected);
  }

function hydrateCustomOptionalDefsFromPlayers(players) {
  const arr = Array.isArray(players) ? players : [];
  const labels = {};
  arr.forEach((p) => {
    const map = p?.customFieldLabels && typeof p.customFieldLabels === 'object' ? p.customFieldLabels : {};
    Object.entries(map).forEach(([k, v]) => {
      if (!k) return;
      if (!(k in labels) && String(v || '').trim()) labels[k] = String(v).trim();
    });
    const values = p?.customFields && typeof p.customFields === 'object' ? p.customFields : {};
    Object.keys(values).forEach((k) => { if (!(k in labels)) labels[k] = k.replace(/^custom[_:-]*/i, '').replace(/_/g, ' ') || k; });
  });
  const defsFromPlayers = Object.entries(labels).map(([key, label]) => ({ key, label }));
  const persisted = readPersistedCustomOptionalDefs();
  const current = Array.isArray(state.importData?.customOptionalDefs) ? state.importData.customOptionalDefs : [];
  const mergedMap = new Map();
  [...defaultCustomOptionalDefs(), ...persisted, ...current, ...defsFromPlayers].forEach((d) => {
    if (!d || !String(d.key || '').trim()) return;
    const key = String(d.key).trim();
    const prev = mergedMap.get(key) || {};
    mergedMap.set(key, {
      ...prev,
      ...d,
      key,
      label: String(d.label || prev.label || key).trim() || key,
      required: false,
      colKey: String(d.colKey || prev.colKey || key),
      visibleDefault: typeof d.visibleDefault === 'boolean' ? d.visibleDefault : !!prev.visibleDefault,
      isCustom: true,
    });
  });
  state.importData = state.importData || { headers: [], rows: [], mapping: {}, loaded: false };
  state.importData.customOptionalDefs = normalizeCustomOptionalDefs(Array.from(mergedMap.values()));
  persistCustomOptionalDefs(state.importData.customOptionalDefs);
  ensureImportMappingDefaults();
}

  function tryRestorePlayersFromLocalStorage() {
    let restoredPlayers = false;

    // 1) Restore гравців if state is empty
    if ((!Array.isArray(state.players) || !state.players.length) && typeof PNS.loadPlayersSnapshot === 'function') {
      const restored = PNS.loadPlayersSnapshot();
      if (Array.isArray(restored) && restored.length) {
        state.players = restored;
        restoredPlayers = true;
      }
    }

    // 2) If гравців already exist (from earlier init/retry), still continue and restore towers/UI
    if (!Array.isArray(state.players) || !state.players.length) return false;

    hydrateCustomOptionalDefsFromPlayers(state.players || []);

    // Ensure fresh index for edit/autofill/modals after refresh/import
    state.playerById = new Map((state.players || []).map((p) => [p.id, p]));

    // Prevent early empty render from overwriting saved towers snapshot
    state._skipTowerSnapshotSave = true;

    if (restoredPlayers || _needsPlayersTableRender()) {
      if (typeof PNS.renderPlayersTableFromState === 'function') PNS.renderPlayersTableFromState();
      if (typeof PNS.buildRowActions === 'function') PNS.buildRowActions();
    }

    // Immediate restore + late retries only once on boot; later calls just refresh once
    _attemptRestoreTowersAndRefreshUI();
    if (!state._restoreRetriesBootstrapped) {
      state._restoreRetriesBootstrapped = true;
      _clearRestoreRetryTimers();
      [80, 220, 600, 1200, 2200].forEach((ms) => {
        const id = setTimeout(() => {
          _attemptRestoreTowersAndRefreshUI();
          if (ms >= 2200) {
            try { state._skipTowerSnapshotSave = false; } catch {}
            try { PNS.persistSessionStateSoon?.(30); } catch {}
          }
        }, ms);
        __restoreRetryTimers.push(id);
      });
    }

    if (restoredPlayers) {
      setImportLoadedInfo(`Відновлено ${state.players.length} гравців із LocalStorage.`);
      setImportStatus(t('restored_previous_session', 'Гравців відновлено з попередньої сесії. У будь-який момент можна завантажити нову таблицю і замінити їх.'), 'good');
    }
    return true;
  }


  function removeLsKey(key) {
    try { if (key) localStorage.removeItem(key); } catch {}
  }


  function ensureResetConfirmStyles() {
    if (document.getElementById('pnsResetConfirmStyles')) return;
    const style = document.createElement('style');
    style.id = 'pnsResetConfirmStyles';
    style.textContent = `
      .pns-confirm-overlay{position:fixed;inset:0;background:rgba(8,12,20,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:300100;}
      .pns-confirm-dialog{position:relative;z-index:1;width:min(100%,480px);background:linear-gradient(180deg,rgba(20,28,42,.98),rgba(12,18,28,.98));border:1px solid rgba(255,255,255,.12);border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.45);color:#eef4ff;overflow:hidden;}
      .pns-confirm-head{padding:18px 20px 12px;display:flex;gap:12px;align-items:flex-start;}
      .pns-confirm-icon{flex:0 0 44px;width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;background:rgba(255,107,107,.16);border:1px solid rgba(255,107,107,.28);box-shadow:inset 0 1px 0 rgba(255,255,255,.06);}
      .pns-confirm-title{margin:0;font-size:18px;line-height:1.25;font-weight:800;color:#fff;}
      .pns-confirm-sub{margin:6px 0 0;font-size:13px;line-height:1.5;color:rgba(232,240,255,.82);}
      .pns-confirm-body{padding:0 20px 18px;}
      .pns-confirm-note{margin:0;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font-size:13px;line-height:1.5;color:rgba(232,240,255,.78);}
      .pns-confirm-actions{display:flex;gap:10px;justify-content:flex-end;padding:14px 20px 20px;border-top:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02);}
      .pns-confirm-btn{appearance:none;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#f5f8ff;border-radius:12px;padding:10px 14px;font-size:14px;font-weight:700;cursor:pointer;transition:transform .12s ease, background .12s ease, border-color .12s ease;}
      .pns-confirm-btn:hover{transform:translateY(-1px);background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.2);}
      .pns-confirm-btn--danger{background:linear-gradient(180deg,#ff6b6b,#e04848);border-color:rgba(255,107,107,.42);color:#fff;box-shadow:0 10px 22px rgba(224,72,72,.24);}
      .pns-confirm-btn--danger:hover{background:linear-gradient(180deg,#ff7d7d,#ea5656);border-color:rgba(255,132,132,.56);}
      @media (max-width: 560px){
        .pns-confirm-overlay{padding:14px;}
        .pns-confirm-dialog{width:100%;border-radius:16px;}
        .pns-confirm-head{padding:16px 16px 10px;}
        .pns-confirm-body{padding:0 16px 16px;}
        .pns-confirm-actions{padding:12px 16px 16px;flex-direction:column-reverse;}
        .pns-confirm-btn{width:100%;}
      }
    `;
    document.head.appendChild(style);
  }

  function showDangerConfirm(opts) {
    const options = opts || {};
    ensureResetConfirmStyles();
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'pns-confirm-overlay';
      overlay.innerHTML = `
        <div class="pns-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="pnsConfirmTitle">
          <div class="pns-confirm-head">
            <div class="pns-confirm-icon">⚠️</div>
            <div>
              <h3 class="pns-confirm-title" id="pnsConfirmTitle">${String(options.title || 'Підтверди дію')}</h3>
              <p class="pns-confirm-sub">${String(options.message || '')}</p>
            </div>
          </div>
          ${options.note ? `<div class="pns-confirm-body"><p class="pns-confirm-note">${String(options.note)}</p></div>` : ''}
          <div class="pns-confirm-actions">
            <button type="button" class="pns-confirm-btn" data-confirm-cancel>${String(options.cancelText || 'Скасувати')}</button>
            <button type="button" class="pns-confirm-btn pns-confirm-btn--danger" data-confirm-ok>${String(options.confirmText || 'Очистити')}</button>
          </div>
        </div>
      `;
      const cleanup = (value) => {
        try { document.removeEventListener('keydown', onKeyDown, true); } catch {}
        try { overlay.remove(); } catch {}
        resolve(!!value);
      };
      const onKeyDown = (e) => {
        if (e.key === 'Escape') cleanup(false);
      };
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(false);
      });
      overlay.querySelector('[data-confirm-cancel]')?.addEventListener('click', () => cleanup(false));
      overlay.querySelector('[data-confirm-ok]')?.addEventListener('click', () => cleanup(true));
      document.addEventListener('keydown', onKeyDown, true);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.querySelector('[data-confirm-ok]')?.focus());
    });
  }

  async function resetColumnData() {
    const ok = await showDangerConfirm({
      title: 'Скинути дані колонок?',
      message: 'Буде скинуто мапінг колонок, додаткові колонки, видимість і збережені шаблони.',
      note: 'Дані гравців у таблиці при цьому не видаляються.',
      confirmText: 'Скинути колонки'
    });
    if (!ok) return;

    removeLsKey(PNS.KEYS?.KEY_IMPORT_TEMPLATES);
    removeLsKey(PNS.KEYS?.KEY_IMPORT_VISIBLE_COLUMNS);
    removeLsKey(PNS.KEYS?.KEY_FIELD_LABEL_OVERRIDES);
    removeLsKey(PERSIST_KEYS.CUSTOM_OPTIONAL_DEFS);

    state.fieldLabelOverrides = {};
    state.importData = state.importData || { headers: [], rows: [], mapping: {}, loaded: false };

    const factoryCustomDefs = defaultCustomOptionalDefs();
    const factoryCustomKeys = new Set(factoryCustomDefs.map((d) => String(d.key || '')));

    // Повертаємо тільки заводський набір додаткових колонок і прибираємо все,
    // що було створено через "+ Додати додаткову колонку".
    state.importData.customOptionalDefs = factoryCustomDefs;
    persistCustomOptionalDefs(state.importData.customOptionalDefs);

    // Якщо custom optional-колонки вже встигли записатися в snapshot гравців,
    // прибираємо їх і звідти, інакше після reload вони відновляться назад.
    if (Array.isArray(state.players) && state.players.length) {
      state.players = state.players.map((p) => {
        const customFields = p?.customFields && typeof p.customFields === 'object' ? { ...p.customFields } : {};
        const customFieldLabels = p?.customFieldLabels && typeof p.customFieldLabels === 'object' ? { ...p.customFieldLabels } : {};
        Object.keys(customFields).forEach((k) => { if (!factoryCustomKeys.has(k)) delete customFields[k]; });
        Object.keys(customFieldLabels).forEach((k) => { if (!factoryCustomKeys.has(k)) delete customFieldLabels[k]; });
        return { ...p, customFields, customFieldLabels };
      });
      state.playerById = new Map((state.players || []).map((p) => [p.id, p]));
      try { PNS.savePlayersSnapshot?.(state.players); } catch {}
      try { PNS.renderPlayersTableFromState?.(); } catch {}
      try { PNS.buildRowActions?.(); } catch {}
    } else {
      try { PNS.clearPlayersSnapshot?.(); } catch {}
    }

    // Перебудовуємо mapping тільки з базового набору полів.
    const mapping = {};
    const headers = state.importData.headers || [];
    const detected = headers.length ? autoDetectMapping(headers) : {};
    FIELD_DEFS.forEach((f) => { mapping[f.key] = detected[f.key] || ''; });
    state.importData.customOptionalDefs.forEach((f) => {
      mapping[f.key] = headers.length ? (autoDetectCustomOptionalMapping(headers, f) || '') : '';
    });
    state.importData.mapping = mapping;

    // Видимість теж повертаємо до дефолту тільки для заводських optional-полів.
    state.visibleOptionalColumns = getDefaultVisibleOptionalColumns();
    if (typeof PNS.saveVisibleOptionalColumns === 'function') PNS.saveVisibleOptionalColumns();

    renderImportUI();
    try { PNS.applyColumnVisibility?.(state.showAllColumns); } catch {}
    setImportStatus(t('column_data_reset', 'Дані колонок скинуто до заводських налаштувань.'), 'good');
  }

  async function resetTableData() {
    const ok = await showDangerConfirm({
      title: 'Скинути дані таблиць?',
      message: 'Буде очищено таблицю гравців, призначення, плани змін і збережені табличні дані.',
      note: 'Налаштування колонок та шаблони імпорту залишаться без змін.',
      confirmText: 'Скинути таблиці'
    });
    if (!ok) return;

    try { PNS.clearPlayersSnapshot?.(); } catch {}
    try { PNS.clearTowersSnapshot?.(); } catch {}
    try { PNS.clearTowerMarchOverrides?.(); } catch {}
    removeLsKey(PNS.KEYS?.KEY_ASSIGNMENTS_STORE);
    removeLsKey(PNS.KEYS?.KEY_ASSIGNMENT_PRESETS);
    removeLsKey(PNS.KEYS?.KEY_TOP_FILTERS);
    removeLsKey(PNS.KEYS?.KEY_SHIFT_FILTER);
    removeLsKey(PNS.KEYS?.KEY_SHOW_ALL);

    state.players = [];
    state.playerById = new Map();
    state.shiftPlans = {};
    (state.bases || []).forEach((b) => {
      if (!b) return;
      b.captainId = null;
      b.helperIds = [];
      b.role = null;
      try { PNS.applyBaseRoleUI?.(b, null); } catch {}
    });

    try { PNS.renderPlayersTableFromState?.(); } catch {}
    try { PNS.buildRowActions?.(); } catch {}
    try { PNS.renderAll?.(); } catch {}
    setImportLoadedInfo('Дані таблиць скинуто.');
    setImportStatus(t('table_data_reset', 'Дані таблиць скинуто. Можна завантажити нову таблицю.'), 'good');
  }

  async function resetAllLocalStorage() {
    const ok = await showDangerConfirm({
      title: 'Повністю скинути LocalStorage?',
      message: 'Усі збережені дані сайту буде видалено і застосунок повернеться до заводських налаштувань.',
      note: 'Цю дію не можна скасувати. Будуть очищені таблиці, колонки, шаблони імпорту, налаштування та інший локально збережений стан.',
      confirmText: 'Скинути все'
    });
    if (!ok) return;

    try { PNS.setPersistenceSuppressed?.(true); } catch {}
    try { window.__PNS_FACTORY_RESET_ACTIVE = true; } catch {}
    try { sessionStorage.clear(); } catch {}

    // Очищаємо in-memory state, щоб жоден beforeunload/autosave не записав старі дані назад.
    try {
      state.players = [];
      state.playerById = new Map();
      state.shiftPlans = {};
      state.importData = { headers: [], rows: [], mapping: {}, loaded: false, customOptionalDefs: defaultCustomOptionalDefs() };
      state.visibleOptionalColumns = getDefaultVisibleOptionalColumns();
      state.fieldLabelOverrides = {};
      (state.bases || []).forEach((b) => {
        if (!b) return;
        b.captainId = null;
        b.helperIds = [];
        b.role = null;
      });
    } catch {}

    try {
      localStorage.clear();
    } catch {
      const keys = new Set([
        ...(Object.values(PNS.KEYS || {}).filter(Boolean)),
        PERSIST_KEYS.CUSTOM_OPTIONAL_DEFS,
        'pns_layout_players_snapshot_v1',
        'pns_layout_tower_march_overrides_v1',
        'pns_layout_towers_snapshot_v1',
      ]);
      keys.forEach(removeLsKey);
    }

    // Повторно прибираємо на наступному тіку на випадок відкладених старих таймерів.
    setTimeout(() => {
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
      try { window.location.replace(window.location.pathname + window.location.search + window.location.hash); } catch {
        try { window.location.reload(); } catch {}
      }
    }, 20);
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
    (b.saveTemplateMockBtns || []).forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', saveCurrentImportTemplate);
    });
    if (b.applyImportMockBtn && !b.applyImportMockBtn.dataset.bound) {
      b.applyImportMockBtn.dataset.bound = '1';
      b.applyImportMockBtn.addEventListener('click', applyImportedPlayers);
    }
    if (b.resetAllStorageBtn && !b.resetAllStorageBtn.dataset.bound) {
      b.resetAllStorageBtn.dataset.bound = '1';
      b.resetAllStorageBtn.addEventListener('click', resetAllLocalStorage);
    }
    if (b.resetColumnDataBtn && !b.resetColumnDataBtn.dataset.bound) {
      b.resetColumnDataBtn.dataset.bound = '1';
      b.resetColumnDataBtn.addEventListener('click', resetColumnData);
    }
    if (b.resetTableDataBtn && !b.resetTableDataBtn.dataset.bound) {
      b.resetTableDataBtn.dataset.bound = '1';
      b.resetTableDataBtn.addEventListener('click', resetTableData);
    }
  }

  let _lateSessionRestoreTimer = 0;
  function scheduleLateSessionRestore() {
    try { if (_lateSessionRestoreTimer) clearTimeout(_lateSessionRestoreTimer); } catch {}
    _lateSessionRestoreTimer = setTimeout(() => {
      try { tryRestorePlayersFromLocalStorage(); } catch (e) { console.warn('[PNS] late session restore failed', e); }
    }, 120);
  }

  function initImportWizard() {
    if (typeof PNS.loadFieldLabelOverrides === 'function') PNS.loadFieldLabelOverrides();
    if (typeof PNS.loadVisibleOptionalColumns === 'function') PNS.loadVisibleOptionalColumns();
    state.importData = state.importData || { headers: [], rows: [], mapping: {}, loaded: false };
    state.importData.customOptionalDefs = readPersistedCustomOptionalDefs();
    ensureImportMappingDefaults();
    renderImportUI();
    const restored = tryRestorePlayersFromLocalStorage();
    if (!restored) setImportLoadedInfo('Файл ще не завантажено. Завантаж файл або встав публічне CSV-посилання.');
    scheduleLateSessionRestore();
    bindImportWizardButtons();
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
    [80, 300, 900].forEach((ms) => setTimeout(() => { try { tryRestorePlayersFromLocalStorage(); } catch {} }, ms));
    scheduleLateSessionRestore();
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
  document.addEventListener('pns:i18n-changed', reInitImportWizard);

})();