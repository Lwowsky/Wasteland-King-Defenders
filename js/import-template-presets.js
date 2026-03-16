/* ==== import-template-presets.js ==== */
/* Import wizard: saved templates */
(function () {
  const e = window.PNS;
  if (!e) return;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const t = e.state;
  const r = wiz.translate;
  const k = wiz.setImportStatus;
  const i = wiz.REQUIRED_FIELDS || [];
  const f = wiz.normalizeCustomOptionalDefs;
  const g = wiz.getCustomOptionalDefs;
  const b = wiz.ensureCustomOptionalDefs;
  const E = wiz.getHeaderFingerprint;
  const O = wiz.renderImportUI;
  const $ = wiz.normalizeHeader || ((v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim());
  const _ = wiz.persistCustomOptionalDefs;
  const w = wiz.detectCustomOptionalHeader;
  const F = wiz.collectMappingSelections;
function H() {
    const t =
      "function" == typeof e.safeReadJSON
        ? e.safeReadJSON(e.KEYS.KEY_IMPORT_TEMPLATES, [])
        : [];
    return Array.isArray(t) ? t : [];
  }
function U(opts = {}) {
    if (!(t.importData.headers || []).length)
      return void k(
        r(
          "import_source_missing_save",
          "Немає що зберігати: спочатку завантаж файл або посилання.",
        ),
        "danger",
      );
    try { F?.(); } catch {}
    const a = {
        name: "Останній шаблон",
        fingerprint: E(t.importData.headers),
        headers: [...(t.importData.headers || [])],
        mapping: { ...(t.importData.mapping || {}) },
        visibleOptionalColumns: [...(t.visibleOptionalColumns || [])],
        customOptionalDefs: [
          ...g().map((e) => ({ key: e.key, label: e.label })),
        ],
        savedAt: new Date().toISOString(),
      },
      n = H().filter((e) => e.fingerprint !== a.fingerprint);
    (n.unshift(a),
      (function (t) {
        "function" == typeof e.safeWriteJSON &&
          e.safeWriteJSON(e.KEYS.KEY_IMPORT_TEMPLATES, t);
      })(n.slice(0, 20)),
      !opts?.silent && k(r("import_template_saved", "Шаблон імпорту збережено."), "good"));
    return a;
  }
function z(e) {
    const t = H();
    if (!t.length || !e.length) return null;
    const a = E(e),
      r = t.find((e) => e.fingerprint === a);
    if (r) return r;
    const n = new Set(e.map($));
    let o = null,
      i = 0;
    return (
      t.forEach((e) => {
        const t = (e.headers || []).map($),
          a = t.filter((e) => n.has(e)).length,
          r = t.length ? a / t.length : 0;
        r > i && ((i = r), (o = e));
      }),
      i >= 0.5 ? o : null
    );
  }
function j(a) {
    if (!a)
      return (
        k(
          r(
            "import_template_not_found",
            "Для поточних заголовків не знайдено відповідного збереженого шаблону.",
          ),
          "danger",
        ),
        !1
      );
    const n = t.importData.headers || [];
    const currentMapping = t.importData.mapping || {};
    (Array.isArray(a.customOptionalDefs) &&
      ((t.importData.customOptionalDefs = f(a.customOptionalDefs)),
      _(t.importData.customOptionalDefs)),
      b());
    const o = {};
    return (
      [...i, ...g()].forEach((field) => {
        const templated = a.mapping?.[field.key] || "";
        const current = currentMapping[field.key] || "";
        o[field.key] = n.includes(templated)
          ? templated
          : n.includes(current)
            ? current
            : "";
      }),
      (t.importData.mapping = o),
      Array.isArray(a.visibleOptionalColumns) &&
        ((t.visibleOptionalColumns = a.visibleOptionalColumns.filter(Boolean)),
        "function" == typeof e.saveVisibleOptionalColumns &&
          e.saveVisibleOptionalColumns(),
        "function" == typeof e.applyColumnVisibility &&
          e.applyColumnVisibility(t.showAllColumns)),
      k(
        a.fingerprint === E(n)
          ? r(
              "apply_saved_template_exact",
              "Застосовано збережений шаблон (точний збіг).",
            )
          : r(
              "apply_saved_template_partial",
              "Застосовано збережений шаблон (частковий збіг).",
            ),
        "good",
      ),
      !0
    );
  }

  Object.assign(wiz, {
    readImportTemplates: H,
    saveImportTemplate: U,
    findBestTemplate: z,
    applyImportTemplate: j,
  });
})();
