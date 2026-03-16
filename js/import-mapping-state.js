/* ==== import-mapping-state.js ==== */
/* Import wizard: mapping state and validation */
(function () {
  const e = window.PNS;
  if (!e) return;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const t = e.state;
  const a = e.$$;
  const r = wiz.translate;
  const n = wiz.formatMessage;
  const o = wiz.columnLabel;
  const i = wiz.REQUIRED_FIELDS || [];
  const c = wiz.CUSTOM_VISIBLE_FIELDS || [];
  const p = wiz.CUSTOM_LABEL_FALLBACKS || {};
  const f = wiz.normalizeCustomOptionalDefs;
  const g = wiz.getCustomOptionalDefs;
  const b = wiz.ensureCustomOptionalDefs;
  const w = wiz.detectCustomOptionalHeader;
  const S = wiz.getImportUiNodes;
  const C = wiz.syncFileInputUI;
  const T = wiz.setImportLoadedInfo;
  const k = wiz.setImportStatus;
  const I = wiz.getFieldDefByKey;
  const L = wiz.getFieldLabel;
  const B = wiz.getDefaultVisibleOptionalColumns;
  const E = wiz.getHeaderFingerprint;
  const N = wiz.detectHeaderMapping;
  const R = wiz.autoMapRequiredHeaders;
function q() {
    ((t.importData = t.importData || {
      headers: [],
      rows: [],
      mapping: {},
      loaded: !1,
    }),
      b());
    const a = t.importData.mapping || {};
    (i.forEach((e) => {
      e.key in a || (a[e.key] = "");
    }),
      g().forEach((e) => {
        e.key in a || (a[e.key] = "");
      }),
      (t.importData.mapping = a),
      (!Array.isArray(t.visibleOptionalColumns) ||
        !t.visibleOptionalColumns.length) &&
        "function" == typeof e.loadVisibleOptionalColumns &&
        e.loadVisibleOptionalColumns());
  }
function F() {
    a("select[data-map-field]").forEach((e) => {
      t.importData.mapping[e.dataset.mapField] = e.value || "";
    });
  }
function D() {
    const e = t.importData.headers || [];
    if (!e.length)
      return void k(
        r(
          "upload_file_or_public_link_first",
          "Спочатку завантаж CSV/XLSX файл або встав публічне CSV-посилання Google Sheets.",
        ),
      );
    const a = i
      .filter((e) => e.required && !t.importData.mapping?.[e.key])
      .map((e) => o(e.key, L(e.key)));
    a.length
      ? k(
          n("fill_required_columns", "Заповни обов’язкові колонки: {fields}", {
            fields: a.join(", "),
          }),
          "danger",
        )
      : k(
          n(
            "import_ready_rows_cols",
            "Готово до імпорту • {rows} рядків • {cols} колонок",
            { rows: t.importData.rows.length, cols: e.length },
          ),
          "good",
        );
  }

  Object.assign(wiz, {
    ensureImportState: q,
    collectMappingSelections: F,
    validateImportReady: D,
  });
})();
