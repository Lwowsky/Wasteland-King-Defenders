/* ==== import-parsers.js ==== */
/* Import wizard: header normalization and raw row parsers */
(function () {
  const e = window.PNS;
  if (!e) return;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  function $(e) {
    return String(e || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }
  function M(e) {
    return $(e)
      .replace(/[\[\](){}:;,.!?/\\_-]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);
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
      ? window.XLSX.utils.sheet_to_json(a, { header: 1, defval: "", raw: !1 })
      : [];
  }

  Object.assign(wiz, {
    normalizeHeader: $,
    tokenizeHeader: M,
    getHeaderFingerprint: E,
    parseCsvRows: x,
    rowsToObjects: P,
    sheetToRows: A,
  });
})();
