/* ==== import-custom-defs.js ==== */
/* Import wizard: custom field definitions and persistence */
(function () {
  const e = window.PNS;
  if (!e) return;
  const { state: t } = e;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const r = wiz.translate || ((e, t = "") => t || e);
  const d = "pns_layout_import_custom_додаткова_defs_v2",
    u = [
      {
        key: "reserve_type_fighter",
        label: "Резервний тип військ: боєць",
        isCustom: !0,
        colKey: "reserve_type_fighter",
        visibleDefault: !0,
      },
      {
        key: "reserve_type_rider",
        label: "Резервний тип військ: наїздник",
        isCustom: !0,
        colKey: "reserve_type_rider",
        visibleDefault: !0,
      },
      {
        key: "reserve_type_shooter",
        label: "Резервний тип військ: стрілець",
        isCustom: !0,
        colKey: "reserve_type_shooter",
        visibleDefault: !0,
      },
    ],
    p = {
      reserve_type_fighter: "Резервний тип військ: боєць",
      reserve_type_rider: "Резервний тип військ: наїзник",
      reserve_type_shooter: "Резервний тип військ: стрілець",
    };
  function h(e) {
    return (
      String(e || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 32) || "field"
    );
  }
  function f(e) {
    const t = new Set();
    return (Array.isArray(e) ? e : []).map((e, a) => {
      let n = String(e?.label || "").trim() || `Кастомна колонка ${a + 1}`,
        o = String(e?.key || "").trim();
      return (
        o || (o = `custom_opt_${a + 1}_${h(n)}`),
        (o = o.replace(/[^a-zA-Z0-9_:-]/g, "_")),
        (n = (function (e, t) {
          const a = String(e || "").trim();
          return (
            {
              reserve_type_fighter: r(
                "reserve_type_fighter_import",
                "Резервний тип військ: боєць",
              ),
              reserve_type_rider: r(
                "reserve_type_rider_import",
                "Резервний тип військ: наїзник",
              ),
              reserve_type_shooter: r(
                "reserve_type_shooter_import",
                "Резервний тип військ: стрілець",
              ),
            }[a] ||
            p[a] ||
            String(t || "").trim() ||
            a
          );
        })(o, n)),
        t.has(o) && (o = `${o}_${a + 1}`),
        t.add(o),
        {
          key: o,
          label: n,
          required: !1,
          colKey: o,
          visibleDefault: !!e?.visibleDefault,
          isCustom: !0,
        }
      );
    });
  }
  function m() {
    return f(u);
  }
  function y() {
    try {
      const e = localStorage.getItem(d),
        t = e ? JSON.parse(e) : [],
        a = new Map(m().map((e) => [e.key, e]));
      return (
        (Array.isArray(t) ? t : []).forEach((e) => {
          !e ||
            !String(e.key || "").trim() ||
            a.set(String(e.key), { ...(a.get(String(e.key)) || {}), ...e });
        }),
        f(Array.from(a.values()))
      );
    } catch {
      return m();
    }
  }
  function _(e) {
    try {
      localStorage.setItem(d, JSON.stringify(f(e)));
    } catch {}
  }
  function g() {
    return (
      (t.importData = t.importData || {
        headers: [],
        rows: [],
        mapping: {},
        loaded: !1,
      }),
      (!Array.isArray(t.importData.customOptionalDefs) ||
        !t.importData.customOptionalDefs.length) &&
        (t.importData.customOptionalDefs = y()),
      (t.importData.customOptionalDefs = f(t.importData.customOptionalDefs)),
      t.importData.customOptionalDefs
    );
  }
  function b() {
    return (
      g().length ||
        ((t.importData.customOptionalDefs = m()),
        _(t.importData.customOptionalDefs)),
      g()
    );
  }

  Object.assign(wiz, {
    CUSTOM_DEF_STORAGE_KEY: d,
    BUILTIN_CUSTOM_OPTIONAL_DEFS: u,
    CUSTOM_LABEL_FALLBACKS: p,
    slugifyImportKey: h,
    normalizeCustomOptionalDefs: f,
    getBuiltinCustomDefs: m,
    loadCustomOptionalDefs: y,
    persistCustomOptionalDefs: _,
    getCustomOptionalDefs: g,
    ensureCustomOptionalDefs: b,
  });
  e.getCustomOptionalDefs = g;
})();
