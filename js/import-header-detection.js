/* ==== import-header-detection.js ==== */
/* Import wizard: field lookup and header auto-detection */
(function () {
  const e = window.PNS;
  if (!e) return;
  const { state: t } = e;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const i = wiz.REQUIRED_FIELDS || [];
  const c = wiz.CUSTOM_VISIBLE_FIELDS || [];
  const b = wiz.ensureCustomOptionalDefs || (() => []);
  const o = wiz.columnLabel || ((key, fallback = "") => fallback || key);
  const $ = wiz.normalizeHeader || ((v) => String(v || "").toLowerCase().replace(/\s+/g, " ").trim());
  const M = wiz.tokenizeHeader || ((v) => $(v).replace(/[\[\](){}:;,.!?/\\_-]+/g, " ").split(/\s+/).filter(Boolean));
  function w(e, t) {
    return N(e, { key: t.key, label: t.label, aliases: [t.label] }) || "";
  }
  function I(e) {
    return i.find((t) => t.key === e) || null;
  }
  function L(e) {
    const a = t.fieldLabelOverrides?.[e];
    if (a && String(a).trim()) return String(a).trim();
    const r = I(e);
    return o(e, r?.label || e);
  }
  function B() {
    const e = c.filter((e) => e.visibleDefault).map((e) => e.colKey),
      t = b()
        .filter((e) => e.visibleDefault)
        .map((e) => e.colKey);
    return Array.from(new Set([...e, ...t]));
  }
  function E(e) {
    return (e || []).map((e) => $(e)).join("|");
  }
  function x(e) {
    const t = [];
    let a = [],
      r = "",
      n = 0,
      o = !1;
    for (; n < e.length; ) {
      const i = e[n];
      if (o) {
        if ('"' === i) {
          if ('"' === e[n + 1]) {
            ((r += '"'), (n += 2));
            continue;
          }
          ((o = !1), n++);
          continue;
        }
        ((r += i), n++);
      } else
        '"' !== i
          ? "," !== i
            ? "\r" !== i
              ? "\n" !== i
                ? ((r += i), n++)
                : (a.push(r), t.push(a), (a = []), (r = ""), n++)
              : n++
            : (a.push(r), (r = ""), n++)
          : ((o = !0), n++);
    }
    return (a.push(r), t.push(a), t);
  }
  function P(e) {
    const t = (e || []).filter((e) => Array.isArray(e));
    if (!t.length) return { headers: [], rows: [] };
    const a = (t[0] || []).map(
        (e, t) => String(e || "").trim() || `Column ${t + 1}`,
      ),
      r = [];
    for (let e = 1; e < t.length; e++) {
      const n = t[e] || [],
        o = {};
      let i = !1;
      (a.forEach((e, t) => {
        const a = null == n[t] ? "" : String(n[t]).trim();
        ((o[e] = a), a && (i = !0));
      }),
        i && r.push(o));
    }
    return { headers: a, rows: r };
  }
  function A(e) {
    const t = e.SheetNames[0],
      a = e.Sheets[t];
    return window.XLSX
      ? XLSX.utils.sheet_to_json(a, { header: 1, defval: "", raw: !1 })
      : [];
  }
  function N(e, t) {
    const a = L(t.key),
      r = e.map((e) => ({ raw: e, n: $(e), tokens: M(e) })),
      n = Array.from(new Set([a, ...(t.aliases || [])]))
        .map($)
        .filter(Boolean);
    for (const e of n) {
      const t = r.find((t) => t.n === e);
      if (t) return t.raw;
    }
    for (const e of n) {
      const t = r.find((t) => t.n.includes(e) || e.includes(t.n));
      if (t) return t.raw;
    }
    let o = null,
      i = 0;
    const s = n.map((e) => M(e)).filter((e) => e.length);
    return (
      r.forEach((e) => {
        s.forEach((t) => {
          const a = t.filter((t) => e.tokens.includes(t)).length;
          if (!a) return;
          const r =
            a / Math.max(t.length, 1) + a / Math.max(e.tokens.length, 1);
          r > i && ((i = r), (o = e));
        });
      }),
      i >= 0.6 ? o.raw : ""
    );
  }
  function R(e) {
    const t = {};
    return (
      i.forEach((a) => {
        t[a.key] = N(e, a) || "";
      }),
      t
    );
  }

  Object.assign(wiz, {
    detectCustomOptionalHeader: w,
    getFieldDefByKey: I,
    getFieldLabel: L,
    getDefaultVisibleOptionalColumns: B,
    getHeaderFingerprint: E,
    detectHeaderMapping: N,
    autoMapRequiredHeaders: R,
  });
  e.getFieldDefByKey = I;
  e.getDefaultVisibleOptionalColumns = B;
})();
