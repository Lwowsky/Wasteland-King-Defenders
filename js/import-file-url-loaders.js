/* Import wizard: file and URL loaders */
(function () {
  const e = window.PNS;
  if (!e) return;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const t = e.state;
  const tr = (...args) =>
    typeof wiz.translate === 'function'
      ? wiz.translate(...args)
      : typeof e.t === 'function'
        ? e.t(...args)
        : (args[1] ?? args[0] ?? '');
  const fmt = (key, fallback, params = {}) => {
    let msg =
      typeof wiz.formatMessage === 'function'
        ? wiz.formatMessage(key, fallback, params)
        : tr(key, fallback);
    Object.entries(params || {}).forEach(([k, v]) => {
      msg = String(msg).replaceAll(`{${k}}`, String(v ?? ''));
    });
    return msg;
  };
  const syncFileInputUI = () => {
    try {
      return typeof wiz.syncFileInputUI === 'function' ? wiz.syncFileInputUI() : undefined;
    } catch {}
  };
  const setImportSource = (...args) => wiz.setImportSource?.(...args);
  const setImportStatus = (...args) => wiz.setImportStatus?.(...args);
  const getImportActionNodes = () => (typeof wiz.getImportActionNodes === 'function' ? wiz.getImportActionNodes() : {});
  const rowsToObjects = (...args) => wiz.rowsToObjects?.(...args);
  const sheetToRows = (...args) => wiz.sheetToRows?.(...args);
  const parseCsvRows = (...args) => wiz.parseCsvRows?.(...args);

  function getXlsxScriptNode() {
    return (
      document.querySelector('script[data-xlsx-lib]') ||
      document.querySelector('script[src*="xlsx.full.min.js"]')
    );
  }

  function waitForXlsxReady(timeoutMs = 10000) {
    if (window.XLSX && typeof window.XLSX.read === 'function') {
      return Promise.resolve(window.XLSX);
    }
    return new Promise((resolve, reject) => {
      const script = getXlsxScriptNode();
      let done = false;
      const finish = (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        script?.removeEventListener?.('load', onLoad);
        script?.removeEventListener?.('error', onError);
        err ? reject(err) : resolve(window.XLSX);
      };
      const onLoad = () => {
        if (window.XLSX && typeof window.XLSX.read === 'function') finish();
        else finish(new Error('XLSX library failed to initialize'));
      };
      const onError = () => finish(new Error('Failed to load XLSX library'));
      const timer = setTimeout(() => {
        if (window.XLSX && typeof window.XLSX.read === 'function') finish();
        else finish(new Error('XLSX library is still loading'));
      }, timeoutMs);
      if (script) {
        script.addEventListener('load', onLoad, { once: true });
        script.addEventListener('error', onError, { once: true });
      }
      if (!script) {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        s.defer = true;
        s.dataset.xlsxLib = '1';
        s.addEventListener('load', onLoad, { once: true });
        s.addEventListener('error', onError, { once: true });
        document.head.appendChild(s);
      }
    });
  }

  function readFileAsArrayBuffer(file) {
    if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Failed to read file as ArrayBuffer'));
      reader.readAsArrayBuffer(file);
    });
  }

  function readFileAsText(file) {
    if (typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Failed to read file as text'));
      reader.readAsText(file);
    });
  }

  async function parseSpreadsheetFile(file) {
    const ext = (file.name || 'file').split('.').pop()?.toLowerCase() || '';
    if (ext === 'csv' || ext === 'txt') {
      const text = await readFileAsText(file);
      return rowsToObjects(parseCsvRows(text));
    }

    const XLSX = await waitForXlsxReady();
    const buffer = await readFileAsArrayBuffer(file);
    try {
      return rowsToObjects(sheetToRows(XLSX.read(buffer, { type: 'array', cellDates: false })));
    } catch (firstErr) {
      try {
        const binary = Array.from(new Uint8Array(buffer), (b) => String.fromCharCode(b)).join('');
        return rowsToObjects(sheetToRows(XLSX.read(binary, { type: 'binary', cellDates: false })));
      } catch (secondErr) {
        throw secondErr || firstErr;
      }
    }
  }

  async function Y(ev) {
    const file = ev?.target?.files?.[0];
    if (!file) return;
    try {
      setImportStatus(tr('reading_file', 'Читаю файл...'));
      const { headers, rows } = await parseSpreadsheetFile(file);
      if (!headers?.length) throw new Error('Не вдалося знайти заголовки колонок');
      try {
        wiz._skipPlayerRestoreUntilApplied = true;
      } catch {}
      setImportSource(headers, rows, file.name, 'file');
      syncFileInputUI();
      setImportStatus(
        tr(
          'file_loaded_check_mapping',
          'Файл завантажено. Перевір зіставлення колонок і натисни «Застосувати імпорт».',
        ),
        'good',
      );
    } catch (err) {
      console.error(err);
      setImportStatus(
        fmt('failed_parse_file', 'Не вдалося розібрати файл: {error}', {
          error: err?.message || String(err || ''),
        }),
        'danger',
      );
    }
  }

  async function J() {
    const url = getImportActionNodes().urlInputMock?.value?.trim();
    if (!url) {
      setImportStatus(
        tr(
          'paste_csv_or_sheet_link_first',
          'Спочатку встав CSV-посилання або посилання Google Sheets.',
        ),
        'danger',
      );
      return;
    }
    try {
      setImportStatus(tr('loading_url', 'Завантажую посилання...'));
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
        return rowsToObjects(parseCsvRows(await resp.text()));
      })(url);
      if (!headers?.length) throw new Error('Не вдалося знайти заголовки колонок');
      try {
        wiz._skipPlayerRestoreUntilApplied = true;
      } catch {}
      setImportSource(headers, rows, url, 'url');
      setImportStatus(
        tr(
          'url_loaded_check_mapping',
          'Посилання завантажено. Перевір зіставлення колонок і натисни «Застосувати імпорт».',
        ),
        'good',
      );
    } catch (err) {
      console.error(err);
      setImportStatus(
        tr(
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
    waitForXlsxReady,
  });
  e.handleImportFileChange = Y;
  e.handleLoadUrlClick = J;
})();
