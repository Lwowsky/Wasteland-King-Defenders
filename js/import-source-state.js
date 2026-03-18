/* ==== import-source-state.js ==== */
/* Import wizard: import source and auto-detect */
(function () {
  const e = window.PNS;
  if (!e) return;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const t = e.state;
  const tr = (...args) =>
    typeof wiz.translate === "function"
      ? wiz.translate(...args)
      : typeof e.t === "function"
        ? e.t(...args)
        : (args[1] ?? args[0] ?? "");
  const i = wiz.REQUIRED_FIELDS || [];
  const b = wiz.ensureCustomOptionalDefs;
  const g = wiz.getCustomOptionalDefs;
  const R = wiz.autoMapRequiredHeaders;
  const w = wiz.detectCustomOptionalHeader;
  const T = wiz.setImportLoadedInfo;
  const O = wiz.renderImportUI;
  const z = wiz.findBestTemplate;
  const j = wiz.applyImportTemplate;
  const k = wiz.setImportStatus;
  const M = wiz.saveImportTemplate;

  function X(headers, key, fallback = "") {
    return fallback && headers.includes(fallback) ? fallback : "";
  }

function V(headersInput, rowsInput, sourceName, sourceType) {
    ((t.importData.headers = headersInput || []),
      (t.importData.rows = rowsInput || []),
      (t.importData.джерелоName = sourceName || ""),
      (t.importData.джерелоType = sourceType || ""),
      (t.importData.loaded = !0),
      (t.importData.sourcePending = !0),
      (wiz._skipPlayerRestoreUntilApplied = !0),
      b());
    const headers = t.importData.headers || [],
      autoRequired = R(headers),
      current = t.importData.mapping || {},
      matchedTemplate = z(headers),
      templateMapping = matchedTemplate?.mapping || {},
      nextMapping = {};
    (i.forEach((field) => {
      nextMapping[field.key] =
        X(headers, field.key, current[field.key]) ||
        X(headers, field.key, templateMapping[field.key]) ||
        autoRequired[field.key] ||
        "";
    }),
      g().forEach((field) => {
        const detected = w(headers, field);
        nextMapping[field.key] =
          X(headers, field.key, current[field.key]) ||
          X(headers, field.key, templateMapping[field.key]) ||
          detected ||
          "";
      }),
      (t.importData.mapping = nextMapping),
      T(tr('import_source_rows_cols', '{source} • {rows} рядків • {cols} колонок').replace(/\{source\}/g, String(sourceName || '')).replace(/\{rows\}/g, String(rowsInput.length)).replace(/\{cols\}/g, String(headersInput.length))),
      O(),
      matchedTemplate && j(matchedTemplate),
      O());
    try { M?.({ silent: !0 }); } catch {}
  }
function K() {
    if (!(t.importData.headers || []).length)
      return void k(
        tr(
          "load_file_or_link_then_detect",
          "Спочатку завантаж файл або посилання, потім визнач колонки.",
        ),
        "danger",
      );
    b();
    const headers = t.importData.headers || [],
      autoRequired = R(headers),
      current = t.importData.mapping || {},
      matchedTemplate = z(headers),
      templateMapping = matchedTemplate?.mapping || {},
      nextMapping = {};
    (i.forEach((field) => {
      nextMapping[field.key] =
        X(headers, field.key, current[field.key]) ||
        X(headers, field.key, templateMapping[field.key]) ||
        autoRequired[field.key] ||
        "";
    }),
      g().forEach((field) => {
        const detected = w(headers, field);
        nextMapping[field.key] =
          X(headers, field.key, current[field.key]) ||
          X(headers, field.key, templateMapping[field.key]) ||
          detected ||
          "";
      }),
      (t.importData.mapping = nextMapping),
      O(),
      (function(){ try { M?.({ silent: !0 }); } catch {} })(),
      k(
        tr(
          "columns_auto_detected",
          "Колонки визначено автоматично. Перевір зіставлення обов’язкових колонок.",
        ),
        "good",
      ));
  }

  Object.assign(wiz, {
    setImportSource: V,
    handleDetectColumns: K,
  });
  e.handleDetectColumns = K;
})();
