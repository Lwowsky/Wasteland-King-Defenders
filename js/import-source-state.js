/* ==== import-source-state.js ==== */
/* Import wizard: import source and auto-detect */
(function () {
  const e = window.PNS;
  if (!e) return;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const t = e.state;
  const r = wiz.translate;
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

function V(e, a, r, n) {
    ((t.importData.headers = e || []),
      (t.importData.rows = a || []),
      (t.importData.джерелоName = r || ""),
      (t.importData.джерелоType = n || ""),
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
      T(`${r} • ${a.length} рядків • ${e.length} колонок`),
      O(),
      matchedTemplate && j(matchedTemplate),
      O());
    try { M?.({ silent: !0 }); } catch {}
  }
function K() {
    if (!(t.importData.headers || []).length)
      return void k(
        r(
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
        r(
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
