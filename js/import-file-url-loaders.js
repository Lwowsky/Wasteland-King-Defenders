/* Import wizard: file and URL loaders */
(function () {
  const e = window.PNS;
  if (!e) return;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const t = e.state;
  const r = wiz.translate;
  const n = wiz.formatMessage;
  const C = wiz.syncFileInputUI;
  const V = wiz.setImportSource;
  const k = wiz.setImportStatus;
  const v = wiz.getImportActionNodes;
  const P = wiz.rowsToObjects;
  const A = wiz.sheetToRows;
  const x = wiz.parseCsvRows;

<<<<<<< HEAD
=======
  function normalizeShiftForImport(value) {
    try {
      if (typeof e.normalizeShiftValue === 'function') return String(e.normalizeShiftValue(value) || '').toLowerCase();
    } catch {}
    const text = String(value || '').toLowerCase();
    if (/(^|\D)4(\D|$)|4th|fourth|четвер|зміна\s*4|смена\s*4/.test(text)) return 'shift4';
    if (/(^|\D)3(\D|$)|3rd|third|трет|зміна\s*3|смена\s*3/.test(text)) return 'shift3';
    if (/(^|\D)2(\D|$)|2nd|second|втор|друг|зміна\s*2|смена\s*2/.test(text)) return 'shift2';
    if (/(^|\D)1(\D|$)|1st|first|перв|перш|зміна\s*1|смена\s*1/.test(text)) return 'shift1';
    return 'both';
  }

  function findShiftHeader(headers) {
    const normalized = (headers || []).map((header) => String(header || '').toLowerCase());
    let idx = normalized.findIndex((header) => /time of participation|время участия|час участі|участ|participation/.test(header));
    if (idx >= 0) return headers[idx];
    idx = normalized.findIndex((header) => /shift|зміна|смена/.test(header));
    return idx >= 0 ? headers[idx] : '';
  }

  function detectMaxShiftFromRows(headers, rows) {
    const shiftHeader = findShiftHeader(headers);
    let maxShift = 0;
    if (!shiftHeader) return 2;
    (rows || []).forEach((row) => {
      const normalized = normalizeShiftForImport(row?.[shiftHeader]);
      const n = Number(String(normalized).replace('shift', '')) || 0;
      if (n >= 1 && n <= 4) maxShift = Math.max(maxShift, n);
    });
    return Math.max(1, Math.min(4, maxShift || 2));
  }

  function syncRegionShiftDefaultsForNewImport(headers, rows) {
    const count = detectMaxShiftFromRows(headers, rows);
    const shifts = { '1': false, '2': false, '3': false, '4': false };
    shifts[String(count)] = true;
    const defaults = {
      activeRegion: 'region1',
      regions: {
        region1: { enabled: true, shifts },
        region2: { enabled: false, shifts: { '1': false, '2': true, '3': false, '4': false } },
        region3: { enabled: false, shifts: { '1': false, '2': true, '3': false, '4': false } },
      },
    };
    try { localStorage.removeItem('pns_import_region1_shift_manual_override_v1'); } catch {}
    try { localStorage.setItem('pns_tower_calc_active_region_v1', 'region1'); } catch {}
    try { localStorage.setItem('pns_import_region_shift_settings_v1', JSON.stringify(defaults)); } catch {}
    try { e.importRegionShiftSettings = defaults; } catch {}
    try { e.setImportRegionShiftSettings?.(defaults); } catch {}
    try {
      window.dispatchEvent(new CustomEvent('pns:region-shifts-changed', { detail: { region: 'region1', resetForNewImport: true } }));
    } catch {}
    try {
      document.dispatchEvent(new CustomEvent('pns:region-shifts-changed', { detail: { region: 'region1', resetForNewImport: true } }));
    } catch {}
    return count;
  }

>>>>>>> 4f53fe0 (update)
  async function Y(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      k(r('reading_file', 'Читаю файл...'));
      const { headers, rows } = await new Promise(async (resolve, reject) => {
        try {
          const ext = (file.name || 'file').split('.').pop()?.toLowerCase() || '';
          if ((ext === 'xlsx' || ext === 'xls') && window.XLSX) {
            const buffer = await file.arrayBuffer();
            resolve(P(A(XLSX.read(buffer, { type: 'array' }))));
            return;
          }
          const text = await file.text();
          if (window.XLSX && ext !== 'csv' && ext !== 'txt') {
            try {
              resolve(P(A(XLSX.read(text, { type: 'string' }))));
              return;
            } catch {}
          }
          resolve(P(x(text)));
        } catch (err) {
          reject(err);
        }
      });
      if (!headers.length) throw new Error(r('headers_not_found', 'Не вдалося знайти заголовки колонок'));
      try { wiz._skipPlayerRestoreUntilApplied = !0; } catch {}
<<<<<<< HEAD
      V(headers, rows, file.name, 'file');
=======
      try { syncRegionShiftDefaultsForNewImport(headers, rows); } catch {}
      V(headers, rows, file.name, 'file');
      try { syncRegionShiftDefaultsForNewImport(headers, rows); } catch {}
>>>>>>> 4f53fe0 (update)
      C?.();
      k(
        r(
          'file_loaded_check_mapping',
          'Файл завантажено. Перевір зіставлення колонок і натисни «Застосувати імпорт».',
        ),
        'good',
      );
    } catch (err) {
      console.error(err);
      k(
        n('failed_parse_file', 'Не вдалося розібрати файл: {error}', {
          error: err.message || err,
        }),
        'danger',
      );
    }
  }

  async function J() {
    const url = v().urlInputMock?.value?.trim();
    if (!url) {
      k(
        r(
          'paste_csv_or_sheet_link_first',
          'Спочатку встав CSV-посилання або посилання Google Sheets.',
        ),
        'danger',
      );
      return;
    }
    try {
      k(r('loading_url', 'Завантажую посилання...'));
      const { headers, rows } = await (async function (inputUrl) {
        const exportUrl = (function (raw) {
          try {
            const u = new URL(raw);
            if (!/docs\.google\.com$/.test(u.hostname)) return raw;
            const m = u.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            return m
              ? `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${u.searchParams.get('gid') || '0'}`
              : raw;
          } catch {
            return raw;
          }
        })(inputUrl);
        const resp = await fetch(exportUrl, { mode: 'cors' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return P(x(await resp.text()));
      })(url);
      if (!headers.length) throw new Error(r('headers_not_found', 'Не вдалося знайти заголовки колонок'));
      try { wiz._skipPlayerRestoreUntilApplied = !0; } catch {}
<<<<<<< HEAD
      V(headers, rows, url, 'url');
=======
      try { syncRegionShiftDefaultsForNewImport(headers, rows); } catch {}
      V(headers, rows, url, 'url');
      try { syncRegionShiftDefaultsForNewImport(headers, rows); } catch {}
>>>>>>> 4f53fe0 (update)
      k(
        r(
          'url_loaded_check_mapping',
          'Посилання завантажено. Перевір зіставлення колонок і натисни «Застосувати імпорт».',
        ),
        'good',
      );
    } catch (err) {
      console.error(err);
      k(
        r(
          'failed_load_url',
          'Не вдалося завантажити посилання. Переконайся, що таблиця публічна і доступний CSV export.',
        ),
        'danger',
      );
    }
  }

  Object.assign(wiz, {
    handleImportFileChange: Y,
    handleLoadUrlClick: J,
  });
  e.handleImportFileChange = Y;
  e.handleLoadUrlClick = J;
})();
