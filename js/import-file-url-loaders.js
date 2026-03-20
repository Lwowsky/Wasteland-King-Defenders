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
      if (!headers.length) throw new Error('Не вдалося знайти заголовки колонок');
      try { wiz._skipPlayerRestoreUntilApplied = !0; } catch {}
      V(headers, rows, file.name, 'file');
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
      if (!headers.length) throw new Error('Не вдалося знайти заголовки колонок');
      try { wiz._skipPlayerRestoreUntilApplied = !0; } catch {}
      V(headers, rows, url, 'url');
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
