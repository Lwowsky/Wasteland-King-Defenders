/* Final plan tower-calc compute / summary helpers */
(function () {
  const e = window.PNS;
  if (!e) return;
  const t = (e.ModalsShift = e.ModalsShift || {}),
    { state: a } = e;
  let xPersistLastJson = null;
  function xPersistCalc(e) {
    try {
      const t = JSON.stringify(e);
      return t === xPersistLastJson
        ? !1
        : (localStorage.setItem("pns_tower_calc_state", t),
          (xPersistLastJson = t),
          !0);
    } catch {
      return !1;
    }
  }
  function xEnsureShiftPlans() {
    try {
      t.saveCurrentShiftPlanSnapshot?.();
    } catch {}
    try {
      a.shiftPlans = a.shiftPlans || {};
    } catch {}
    return a.shiftPlans || {};
  }
  function r(e) {
    const t = String(e || "").toLowerCase();
    return t.includes("fight")
      ? "fighter"
      : t.includes("rid")
        ? "rider"
        : t.includes("shoot") || t.includes("arch")
          ? "shooter"
          : "";
  }
  function n(t) {
    return (
      e.escapeHtml ||
      ((e) =>
        String(e).replace(
          /[&<>"']/g,
          (e) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[e] || e,
        ))
    )(String(t ?? ""));
  }
  function i(t, a = "") {
    try {
      return "function" == typeof e.t ? e.t(t, a) : a || t;
    } catch {
      return a || t;
    }
  }
  function _(e, t) {
    const a = String(e?.shift || "both").toLowerCase();
    return "both" === a || a === String(t || "").toLowerCase();
  }
  function g(e) {
    const t = String(e || "")
      .toUpperCase()
      .match(/T\s*(\d+)/);
    return t ? Number(t[1]) : 0;
  }
  function b(e) {
    return Math.max(0, Number(e?.march || 0) || 0);
  }
  function w(e) {
    return (function (e) {
      const t = String(e || "");
      let a = 0;
      for (let e = 0; e < t.length; e++)
        a = ((a << 5) - a + t.charCodeAt(e)) | 0;
      return Math.abs(a);
    })(String(e?.id || e?.name || "")) %
      2 ==
      0
      ? "shift1"
      : "shift2";
  }
  function S() {
    return Object.fromEntries(
      ["T14", "T13", "T12", "T11", "T10", "T9"].map((e) => [
        e,
        { count: 0, march: 0 },
      ]),
    );
  }
  function v(e) {
    const t = { T14: 3e5, T13: 25e4, T12: 2e5, T11: 15e4, T10: 1e5, T9: 8e4 },
      a = {};
    for (const r of ["T14", "T13", "T12", "T11", "T10", "T9"]) {
      const n = Math.max(0, Number(e?.[r] ?? t[r]) || t[r] || 0);
      a[r] = Math.round(n);
    }
    return a;
  }
  function C(e) {
    return e && "manual" === String(e.tierSizeMode || "").toLowerCase()
      ? v(e.tierSizeManual)
      : { T14: 3e5, T13: 25e4, T12: 2e5, T11: 15e4, T10: 1e5, T9: 8e4 };
  }
  function Hf(t) {
    return "function" == typeof window.calcNormalizeHelperFillMode
      ? window.calcNormalizeHelperFillMode(t)
      : "max" === String(t || "").toLowerCase()
        ? "max"
        : "min" === String(t || "").toLowerCase()
          ? "min"
          : "mid";
  }
  function Kf(e) {
    return "max" === Hf(e) ? 29 : "min" === Hf(e) ? 1 : 10;
  }
  function jf(e) {
    if ("function" == typeof window.calcInferHelperFillMode)
      return window.calcInferHelperFillMode(e);
    const t = String(e?.helperFillMode || "").toLowerCase();
    if ("min" === t || "mid" === t || "max" === t) return t;
    const a = Math.max(1, Math.min(29, Number(e?.minHelpersCount || 10) || 10));
    return !1 === e?.minHelpersPerTower || a <= 1
      ? "min"
      : a >= 29
        ? "max"
        : "mid";
  }
  function Zf(e) {
    if ("function" == typeof window.calcApplyHelperFillMode)
      return window.calcApplyHelperFillMode(e);
    if (!e || "object" != typeof e) return e;
    const t = Hf(jf(e));
    return (
      (e.helperFillMode = t),
      (e.minHelpersPerTower = !0),
      (e.minHelpersCount = Kf(t)),
      e
    );
  }
  function k(e) {
    const t = S();
    for (const a of Object.keys(t))
      ((t[a].count = Number(e?.[a]?.count || 0) || 0),
        (t[a].march = Number(e?.[a]?.march || 0) || 0));
    return t;
  }
  function $(e, t, a = {}) {
    const n = S(),
      o = { T14: 0, T13: 0, T12: 0, T11: 0, T10: 0, T9: 0 },
      i = [],
      s = Array.isArray(e) ? e : [];
    let l = Math.max(0, Number(t || 0) || 0);
    if (!s.length || l <= 0)
      return {
        usedByTier: n,
        usedMarch: 0,
        capLeft: l,
        recTierMinMarch: o,
        recTierText: i,
        helpersUsed: 0,
        assignedById: {},
        partialPlayers: [],
        notFitPlayers: [],
      };
    const c = s.map((e) => Math.max(0, Number(b(e) || 0) || 0)),
      d = new Array(s.length).fill(0),
      u = s.map((e, t) => {
        const r = Math.max(
            0,
            Number(
              (function (e, t) {
                const a = `T${g(e)}`,
                  r = v(t);
                return Math.max(0, Number(r[a] || 0) || 0);
              })(e?.tier, a?.tierTargets) || 0,
            ) || 0,
          ),
          n = Math.max(0, Number(c[t] || 0) || 0);
        return Math.min(n, r > 0 ? r : n);
      }),
      p = u.reduce((e, t) => e + (Number(t || 0) || 0), 0);
    if (p > 0 && l > 0)
      if (p <= l)
        for (let e = 0; e < u.length; e++) {
          const t = Math.max(0, Number(u[e] || 0) || 0);
          ((d[e] += t), (l -= t));
        }
      else {
        const e = l / p,
          t = [];
        let a = 0;
        for (let r = 0; r < u.length; r++) {
          const n = (Number(u[r] || 0) || 0) * e,
            o = Math.min(c[r], Math.max(0, Math.floor(n)));
          ((d[r] = o),
            (a += o),
            t.push({ i: r, frac: n - o, tier: g(s[r]?.tier), march: c[r] }));
        }
        ((l = Math.max(0, l - a)),
          t.sort(
            (e, t) => t.frac - e.frac || t.tier - e.tier || t.march - e.march,
          ));
        for (const e of t) {
          if (l <= 0) break;
          d[e.i] >= c[e.i] || ((d[e.i] += 1), (l -= 1));
        }
      }
    if (l > 0) {
      const e = s
        .map((e, t) => ({
          i: t,
          tier: g(e?.tier),
          room: Math.max(
            0,
            (Number(c[t] || 0) || 0) - (Number(d[t] || 0) || 0),
          ),
          march: Number(c[t] || 0) || 0,
        }))
        .filter((e) => e.room > 0)
        .sort((e, t) => t.tier - e.tier || t.march - e.march || e.i - t.i);
      for (const t of e) {
        if (l <= 0) break;
        const e = Math.max(0, Number(t.room || 0) || 0);
        if (e <= 0) continue;
        const a = Math.min(e, l);
        ((d[t.i] += a), (l -= a));
      }
    }
    let h = 0,
      f = 0;
    const m = ["T14", "T13", "T12", "T11", "T10", "T9"],
      y = {},
      _ = [],
      w = [];
    for (let e = 0; e < s.length; e++) {
      const t = s[e],
        a = Math.max(0, Number(d[e] || 0) || 0),
        o = Math.max(0, Number(c[e] || 0) || 0),
        i = String(t?.id || "");
      if ((i && (y[i] = a), a <= 0)) {
        w.push({
          id: i,
          name: String(t?.name || ""),
          tier: String(t?.tier || ""),
          role: String(t?.role || ""),
          troop: r(t?.role) || "",
          march: o,
        });
        continue;
      }
      ((f += 1),
        (h += a),
        a < o &&
          _.push({
            id: i,
            name: String(t?.name || ""),
            tier: String(t?.tier || ""),
            sent: a,
            full: o,
          }));
      const l = `T${g(t?.tier)}`;
      n[l] && ((n[l].count += 1), (n[l].march += a));
    }
    for (const e of m) {
      const t = Number(n[e]?.count || 0) || 0,
        a = Number(n[e]?.march || 0) || 0,
        r = t > 0 ? Math.max(0, Math.round(a / t)) : 0;
      o[e] = r;
    }
    let C = null;
    for (const e of m) {
      let t = Math.max(0, Number(o[e] || 0) || 0);
      (null != C && t > C && (t = C), (o[e] = t), (C = t));
      const a = Number(n[e]?.count || 0) || 0;
      a > 0 && i.push(`${e}:${Number(t).toLocaleString("en-US")} ×${a}`);
    }
    return {
      usedByTier: n,
      usedMarch: h,
      capLeft: l,
      recTierMinMarch: o,
      recTierText: i,
      helpersUsed: f,
      assignedById: y,
      partialPlayers: _,
      notFitPlayers: w,
    };
  }
  function M(
    e,
    { helperSlots: t = 0, capacity: a = 0, tierTargets: r = null } = {},
  ) {
    const n = new Set(),
      o = [],
      i = Math.max(0, Number(t || 0));
    let s = i;
    const l = Math.max(0, Number(a || 0));
    Array.isArray(e?.players) || (e = { players: Array.isArray(e) ? e : [] });
    const c = e.players || [],
      d = e._usedIds instanceof Set ? e._usedIds : (e._usedIds = new Set());
    for (let e = 0; e < c.length && s > 0; e++) {
      const t = c[e];
      if (!t) continue;
      const a = String(t.id || "");
      !a || d.has(a) || b(t) <= 0 || (d.add(a), n.add(a), o.push(t), (s -= 1));
    }
    const u = $(o, l, { tierTargets: r });
    return {
      usedByTier: u.usedByTier,
      pickedIds: n,
      pickedPlayers: o,
      assignedById: u.assignedById || {},
      notFitPlayers: Array.isArray(u.notFitPlayers) ? u.notFitPlayers : [],
      partialPlayers: Array.isArray(u.partialPlayers) ? u.partialPlayers : [],
      helperSlotsRequested: i,
      helpersUsed: Math.max(0, Number(u.helpersUsed || 0)),
      usedMarch: Math.max(0, Number(u.usedMarch || 0)),
      capacity: l,
      capLeft: Math.max(0, Number(u.capLeft || 0)),
      slotsLeft: Math.max(0, i - Math.max(0, Number(u.helpersUsed || 0))),
      recTierMinMarch: u.recTierMinMarch,
      recTierText: u.recTierText,
    };
  }
  function I(e, t) {
    const a = t || document.getElementById("towerCalcModal"),
      r = [];
    return (
      a
        ?.querySelectorAll(`[data-calc-row][data-calc-shift="${e}"]`)
        .forEach((e) => {
          r.push({
            captainId: String(
              e.querySelector("[data-calc-captain]")?.value || "",
            ),
            troop: String(
              e.querySelector("[data-calc-troop]")?.value || "fighter",
            ).toLowerCase(),
            helpers: Math.max(
              0,
              Math.min(
                29,
                Number(e.querySelector("[data-calc-helpers]")?.value || 15) ||
                  15,
              ),
            ),
          });
        }),
      r
    );
  }
  function L(e) {
    const t = c(),
      a = I("shift1", e),
      r = I("shift2", e);
    (a.length && (t.shift1 = a),
      r.length && (t.shift2 = r),
      (t.noCrossShift = !1),
      (t.both50 = !!e?.querySelector("#towerCalcBoth50")?.checked),
      (t.ignoreBoth = !!e?.querySelector("#towerCalcIgnoreBoth")?.checked),
      (t.dontTouchBothVersion = 1),
      (t.helperFillMode = Hf(
        e?.querySelector("#towerCalcHelperFillModeSelect")?.value ||
          e?.querySelector("#towerCalcHelperFillMode")?.value ||
          t.helperFillMode ||
          jf(t),
      )),
      (t.minHelpersPerTower = !0),
      (t.minHelpersCount = Kf(t.helperFillMode)),
      (t.activeTab =
        "shift2" ===
        String(
          e
            ?.querySelector("[data-calc-tab].is-active")
            ?.getAttribute("data-calc-tab") ||
            t.activeTab ||
            "shift1",
        ).toLowerCase()
          ? "shift2"
          : "shift1"),
      (t.mainTab = String(
        e
          ?.querySelector("[data-calc-main-tab].is-active")
          ?.getAttribute("data-calc-main-tab") ||
          t.mainTab ||
          "setup",
      ).toLowerCase()),
      (t.uiMode = String(
        e?.querySelector("#towerCalcModeUi")?.value || t.uiMode || "assisted",
      ).toLowerCase()),
      (t.uiApplyMode = String(
        e?.querySelector("#towerCalcApplyModeUi")?.value ||
          t.uiApplyMode ||
          "topup",
      ).toLowerCase()),
      (t.tierSizeMode = e?.querySelector("#towerCalcTierAuto")?.checked
        ? "auto"
        : "manual"),
      (t.tierSizeManual = (function (e) {
        const t = {
          T14: 3e5,
          T13: 25e4,
          T12: 2e5,
          T11: 15e4,
          T10: 1e5,
          T9: 8e4,
        };
        return (
          (e || document.getElementById("towerCalcModal"))
            ?.querySelectorAll("[data-calc-tier-target]")
            .forEach((e) => {
              const a = String(e?.dataset?.calcTierTarget || "").toUpperCase();
              a &&
                (t[a] = Math.max(0, Number(e.value || t[a] || 0) || t[a] || 0));
            }),
          v(t)
        );
      })(e)));
    try {
      xPersistCalc(t);
    } catch {}
    return t;
  }
  function c() {
    a.towerCalc || (a.towerCalc = {});
    let e = a.towerCalc;
    return (
      (e.shift1 = Array.isArray(e.shift1)
        ? e.shift1
        : Array.from({ length: 5 }, () => ({
            captainId: "",
            troop: "fighter",
            helpers: 15,
          }))),
      (e.shift2 = Array.isArray(e.shift2)
        ? e.shift2
        : Array.from({ length: 5 }, () => ({
            captainId: "",
            troop: "fighter",
            helpers: 15,
          }))),
      (e.noCrossShift = "boolean" != typeof e.noCrossShift || e.noCrossShift),
      (e.both50 = "boolean" == typeof e.both50 && e.both50),
      (e.ignoreBoth = "boolean" != typeof e.ignoreBoth || e.ignoreBoth),
      (e = Zf(e)),
      (e.compactMode = "boolean" != typeof e.compactMode || e.compactMode),
      (e.activeTab =
        "shift2" === String(e.activeTab || "shift1").toLowerCase()
          ? "shift2"
          : "shift1"),
      (e.mainTab = ["setup", "towers", "overflow", "preview"].includes(
        String(e.mainTab || "").toLowerCase(),
      )
        ? String(e.mainTab).toLowerCase()
        : "setup"),
      (e.uiMode = ["assisted", "auto", "manual"].includes(
        String(e.uiMode || "").toLowerCase(),
      )
        ? String(e.uiMode).toLowerCase()
        : "assisted"),
      (e.uiApplyMode = ["topup", "empty", "rebalance"].includes(
        String(e.uiApplyMode || "").toLowerCase(),
      )
        ? String(e.uiApplyMode).toLowerCase()
        : "topup"),
      (e.tierSizeMode =
        "manual" === String(e.tierSizeMode || "auto").toLowerCase()
          ? "manual"
          : "auto"),
      (e.tierSizeManual = v(e.tierSizeManual)),
      (e.helperPrefs =
        e.helperPrefs && "object" == typeof e.helperPrefs ? e.helperPrefs : {}),
      (e.towerPrefs =
        e.towerPrefs && "object" == typeof e.towerPrefs ? e.towerPrefs : {}),
      (e.overflowReserve =
        e.overflowReserve && "object" == typeof e.overflowReserve
          ? e.overflowReserve
          : {}),
      (e.inlineTowerSelected =
        e.inlineTowerSelected && "object" == typeof e.inlineTowerSelected
          ? e.inlineTowerSelected
          : {}),
      (e.previewShift = ["shift1", "shift2"].includes(
        String(e.previewShift || "").toLowerCase(),
      )
        ? String(e.previewShift).toLowerCase()
        : ["shift1", "shift2"].includes(
              String(a.activeShift || "").toLowerCase(),
            )
          ? String(a.activeShift).toLowerCase()
          : "shift2"),
      (e.ignoreBoth = !!e.ignoreBoth),
      (e.dontTouchBothVersion = Math.max(
        1,
        Number(e.dontTouchBothVersion || 1) || 1,
      )),
      e
    );
  }
  function d(e) {
    const t = c(),
      a = String(e || ""),
      r =
        a && t?.helperPrefs && "object" == typeof t.helperPrefs
          ? t.helperPrefs[a]
          : null;
    return r && "object" == typeof r ? r : {};
  }
  function m(e) {
    const t = c();
    return !!(
      t?.towerPrefs &&
      t.towerPrefs[String(e || "")] &&
      t.towerPrefs[String(e || "")].locked
    );
  }
  function pe() {
    const e = [];
    try {
      (t.getTowerCards?.() || []).forEach((t) => {
        const a = String(t?.dataset?.baseId || t?.dataset?.baseid || "");
        !a || e.includes(a) || e.push(a);
      });
    } catch {}
    if (!e.length)
      for (const t of a.bases || []) {
        const a = String(t?.id || "");
        !a || e.includes(a) || e.push(a);
      }
    return e
      .slice(0, 5)
      .map((e) => a.baseById?.get?.(e) || { id: e, title: e });
  }
  function he(e) {
    const r = pe(),
      n =
        (a.shiftPlans?.[e] && "object" == typeof a.shiftPlans[e]
          ? a.shiftPlans[e]
          : null
        )?.bases || {};
    return r.map((t, r) => {
      const o = a.baseById?.get?.(t?.id || ""),
        s = n?.[t?.id] || {},
        l = String(a.activeShift || "") === String(e || ""),
        c = String((s.captainId ?? (l ? o?.captainId : null)) || ""),
        d = Array.isArray(s.helperIds)
          ? s.helperIds
          : l && Array.isArray(o?.helperIds)
            ? o.helperIds
            : [],
        u = s.role || (l ? o?.role : null) || t?.role || null;
      return {
        index: r,
        baseId: String(t?.id || ""),
        title: String(t?.title || t?.id || `${i("turret", "Турель")} ${r + 1}`),
        captainId: c,
        helperIds: d.slice ? d.slice() : [],
        helperCount: Array.isArray(d) ? d.length : 0,
        role: u,
      };
    });
  }
  function ce(e, t, a, r) {
    const n = new Map();
    if (!Array.isArray(e) || !e.length) return n;
    const o = r instanceof Map ? r : new Map(),
      i = (Array.isArray(t) ? t.slice() : []).sort(
        (e, t) =>
          g(t.tier) - g(e.tier) ||
          Number(t.march || 0) - Number(e.march || 0) ||
          String(e.name || "").localeCompare(String(t.name || "")),
      ),
      s = new Set();
    for (const e of o.values())
      for (const t of Array.isArray(e) ? e : []) {
        const e = String(t?.id || "");
        e && s.add(e);
      }
    const l = i.filter((e) => !s.has(String(e?.id || ""))),
      c = e.map((e) => {
        const t = Array.isArray(o.get(Number(e.idx)))
            ? o.get(Number(e.idx))
            : [],
          a = t.length;
        return {
          ...e,
          _lockedPlayers: t,
          _lockedIds: new Set(
            t.map((e) => String(e?.id || "")).filter(Boolean),
          ),
          _helpersWantedOrig: Math.max(0, Number(e.helpersWanted || 0) || 0),
          helpersWanted: Math.max(
            0,
            Math.max(0, Number(e.helpersWanted || 0) || 0) - a,
          ),
        };
      }),
      d = (e, t) => {
        const r = Array.isArray(t) ? t.slice() : [],
          n = new Set(r.map((e) => String(e?.id || "")).filter(Boolean)),
          o = $(r, e.helperCapacity, { tierTargets: a.tierTargets });
        return {
          usedByTier: o.usedByTier,
          pickedIds: n,
          pickedPlayers: r,
          assignedById: o.assignedById || {},
          notFitPlayers: Array.isArray(o.notFitPlayers) ? o.notFitPlayers : [],
          partialPlayers: Array.isArray(o.partialPlayers)
            ? o.partialPlayers
            : [],
          helperSlotsRequested: Math.max(
            0,
            Number(e._helpersWantedOrig || e.helpersWanted || 0) || 0,
          ),
          helpersUsed: Math.max(0, Number(o.helpersUsed || 0)),
          usedMarch: Math.max(0, Number(o.usedMarch || 0)),
          capacity: Math.max(0, Number(e.helperCapacity || 0)),
          capLeft: Math.max(0, Number(o.capLeft || 0)),
          slotsLeft: Math.max(
            0,
            Math.max(
              0,
              Number(e._helpersWantedOrig || e.helpersWanted || 0) || 0,
            ) - Math.max(0, Number(o.helpersUsed || 0)),
          ),
          recTierMinMarch: o.recTierMinMarch,
          recTierText: o.recTierText,
          lockedPicked: Math.max(
            0,
            Number((e._lockedPlayers || []).length || 0),
          ),
          _lockedIdSet:
            e._lockedIds instanceof Set ? new Set(e._lockedIds) : new Set(),
        };
      },
      u = (function (e, t) {
        const a = Array.isArray(t) ? t.map(() => []) : [];
        if (!(Array.isArray(e) && e.length && Array.isArray(t) && t.length))
          return a;
        const r = t.map((e) => Math.max(0, Number(e?.helpersWanted || 0) || 0)),
          n = t.map((e) => Math.max(0, Number(e?.helperCapacity || 0) || 0)),
          o = new Array(t.length).fill(0);
        let i = !0,
          s = 0;
        for (; s < e.length && i; ) {
          i = !1;
          const l = t
            .map((e, t) => ({
              idx: t,
              needSlots: Math.max(0, r[t] - o[t]),
              ratio: r[t] > 0 ? o[t] / r[t] : 1,
              cap: n[t],
            }))
            .filter((e) => e.needSlots > 0)
            .sort(
              (e, t) => e.ratio - t.ratio || t.cap - e.cap || e.idx - t.idx,
            );
          for (const t of l) {
            if (s >= e.length) break;
            (a[t.idx].push(e[s]), (o[t.idx] += 1), (s += 1));
          }
          i = l.length > 0;
        }
        return a;
      })(l, c);
    for (let e = 0; e < c.length; e++) {
      const t = c[e],
        a = [
          ...(Array.isArray(t._lockedPlayers) ? t._lockedPlayers.slice() : []),
          ...(Array.isArray(u[e]) ? u[e] : []),
        ];
      n.set(Number(t.idx), d(t, a));
    }
    const p = (e, t) => {
        const a = Math.max(1, Number(e?.helperSlotsRequested || 0) || 1),
          r = Math.max(1, Number(t?.helperSlotsRequested || 0) || 1);
        return Math.abs(
          Math.max(0, Number(e?.helpersUsed || 0)) / a -
            Math.max(0, Number(t?.helpersUsed || 0)) / r,
        );
      },
      h = (e, t) => ({
        zeroPenalty:
          (0 === Math.max(0, Number(e?.helpersUsed || 0)) ? 1 : 0) +
          (0 === Math.max(0, Number(t?.helpersUsed || 0)) ? 1 : 0),
        slotsLeft:
          Math.max(0, Number(e?.slotsLeft || 0)) +
          Math.max(0, Number(t?.slotsLeft || 0)),
        gap: p(e, t),
        usedMarch:
          Math.max(0, Number(e?.usedMarch || 0)) +
          Math.max(0, Number(t?.usedMarch || 0)),
        capLeft:
          Math.max(0, Number(e?.capLeft || 0)) +
          Math.max(0, Number(t?.capLeft || 0)),
      }),
      f = (e, t) =>
        !t ||
        (e.zeroPenalty !== t.zeroPenalty
          ? e.zeroPenalty < t.zeroPenalty
          : e.slotsLeft !== t.slotsLeft
            ? e.slotsLeft < t.slotsLeft
            : Math.abs(e.gap - t.gap) > 0.02
              ? e.gap < t.gap
              : e.usedMarch !== t.usedMarch
                ? e.usedMarch > t.usedMarch
                : e.capLeft !== t.capLeft && e.capLeft < t.capLeft);
    if (c.length > 1) {
      const e = new Map(c.map((e) => [Number(e.idx), e])),
        t = c.map((e) => Number(e.idx)),
        a = (e, t) => {
          const a =
            t && t._lockedIdSet instanceof Set ? t._lockedIdSet : new Set();
          return (
            Array.isArray(t?.pickedPlayers) ? t.pickedPlayers.slice() : []
          )
            .filter((e) => {
              const t = String(e?.id || "");
              return !(!t || a.has(t));
            })
            .sort(
              (e, a) =>
                Math.max(
                  0,
                  Number(t?.assignedById?.[String(e?.id || "")] || 0) || 0,
                ) -
                  Math.max(
                    0,
                    Number(t?.assignedById?.[String(a?.id || "")] || 0) || 0,
                  ) ||
                g(e?.tier) - g(a?.tier) ||
                Number(e?.march || 0) - Number(a?.march || 0) ||
                String(e?.name || "").localeCompare(String(a?.name || "")),
            );
        },
        r = (t, r) => {
          const o = e.get(Number(t)),
            i = e.get(Number(r)),
            s = n.get(Number(t)),
            l = n.get(Number(r));
          if (
            !o ||
            !i ||
            !s ||
            !l ||
            (Math.max(0, Number(l.slotsLeft || 0)) <= 0 &&
              Math.max(0, Number(l.capLeft || 0)) <= 0)
          )
            return !1;
          const c = a(o, s).slice(0, 8),
            u = h(s, l);
          for (const e of c) {
            const a = String(e?.id || "");
            if (!a || (l.pickedIds instanceof Set && l.pickedIds.has(a)))
              continue;
            const c = (s.pickedPlayers || []).filter(
                (e) => String(e?.id || "") !== a,
              ),
              p = [...(l.pickedPlayers || []), e],
              m = d(o, c),
              y = d(i, p),
              _ = h(m, y);
            if (f(_, u)) return (n.set(Number(t), m), n.set(Number(r), y), !0);
          }
          return !1;
        },
        o = (t, r) => {
          const o = e.get(Number(t)),
            i = e.get(Number(r)),
            s = n.get(Number(t)),
            l = n.get(Number(r));
          if (!(o && i && s && l)) return !1;
          const c = a(o, s).slice(0, 6),
            u = a(i, l).slice(0, 6);
          if (!c.length || !u.length) return !1;
          const p = h(s, l);
          let m = null;
          for (const e of c) {
            const t = String(e?.id || "");
            if (t)
              for (const a of u) {
                const r = String(a?.id || "");
                if (!r || t === r) continue;
                const n = (s.pickedPlayers || []).map((e) =>
                    String(e?.id || "") === t ? a : e,
                  ),
                  c = (l.pickedPlayers || []).map((t) =>
                    String(t?.id || "") === r ? e : t,
                  ),
                  u = d(o, n),
                  y = d(i, c),
                  _ = h(u, y);
                f(_, p) &&
                  (!m || f(_, m.score)) &&
                  (m = { aNext: u, bNext: y, score: _ });
              }
          }
          return (
            !!m && (n.set(Number(t), m.aNext), n.set(Number(r), m.bNext), !0)
          );
        };
      for (let e = 0; e < 4; e++) {
        let e = !1;
        const a = t
          .map((e) => ({ idx: e, alloc: n.get(e) }))
          .filter((e) => e.alloc)
          .sort(
            (e, t) =>
              (Number(e.alloc.helperSlotsRequested || 0) > 0
                ? Number(e.alloc.helpersUsed || 0) /
                  Number(e.alloc.helperSlotsRequested || 1)
                : 1) -
                (Number(t.alloc.helperSlotsRequested || 0) > 0
                  ? Number(t.alloc.helpersUsed || 0) /
                    Number(t.alloc.helperSlotsRequested || 1)
                  : 1) ||
              Number(t.alloc.slotsLeft || 0) - Number(e.alloc.slotsLeft || 0) ||
              Number(e.idx) - Number(t.idx),
          );
        for (const o of a) {
          const a = n.get(o.idx);
          if (!a) continue;
          const i = Math.max(0, Number(a.slotsLeft || 0)),
            s = Math.max(0, Number(a.capLeft || 0));
          if (i <= 0 && s <= 0) continue;
          const l = t
            .map((e) => ({ idx: e, alloc: n.get(e) }))
            .filter((e) => e.idx !== o.idx && e.alloc)
            .sort((e, t) => {
              const a =
                Number(e.alloc.helperSlotsRequested || 0) > 0
                  ? Number(e.alloc.helpersUsed || 0) /
                    Number(e.alloc.helperSlotsRequested || 1)
                  : 0;
              return (
                (Number(t.alloc.helperSlotsRequested || 0) > 0
                  ? Number(t.alloc.helpersUsed || 0) /
                    Number(t.alloc.helperSlotsRequested || 1)
                  : 0) - a ||
                Number(t.alloc.helpersUsed || 0) -
                  Number(e.alloc.helpersUsed || 0) ||
                Number(e.idx) - Number(t.idx)
              );
            });
          for (const t of l)
            if (r(t.idx, o.idx)) {
              e = !0;
              break;
            }
          if (e) break;
        }
        if (!e)
          for (let a = 0; a < t.length && !e; a++)
            for (let r = a + 1; r < t.length && !e; r++)
              o(t[a], t[r]) && (e = !0);
        if (!e) break;
      }
    }
    return n;
  }
  function fe(e, t, a, r) {
    const n = Array.isArray(r) ? r : he(e),
      o = String(t?.captain?.id || "");
    if (o) {
      const e = n.find((e) => String(e?.captainId || "") === o);
      if (e) return e;
    }
    return n[Number(a) || 0] || null;
  }
  function A() {
    return "function" == typeof window.calcCollectShiftStatsImpl
      ? window.calcCollectShiftStatsImpl()
      : {
          shift1: { total: 0, shooter: 0, rider: 0, fighter: 0 },
          shift2: { total: 0, shooter: 0, rider: 0, fighter: 0 },
          both: { total: 0, shooter: 0, rider: 0, fighter: 0 },
          unknown: { total: 0, shooter: 0, rider: 0, fighter: 0 },
          total: 0,
        };
  }
  function P(e, t) {
    return "function" == typeof window.calcRenderOverflowReservePanelImpl
      ? window.calcRenderOverflowReservePanelImpl(e, t)
      : void 0;
  }
  function me(e) {
    return "function" == typeof window.calcSyncCaptainsFromTowersIntoCalculator
      ? window.calcSyncCaptainsFromTowersIntoCalculator(e)
      : void 0;
  }
  function le(e) {
    return "function" == typeof window.calcRenderLiveFinalBoard
      ? window.calcRenderLiveFinalBoard(e)
      : void 0;
  }
  function de(t, n, o, s = new Set()) {
    const l = ["T14", "T13", "T12", "T11", "T10", "T9"],
      d = [],
      u = new Set(),
      p = { fighter: 0, rider: 0, shooter: 0 };
    let h = 0,
      f = 0;
    const y = ["topup", "empty", "rebalance"].includes(
        String(o?.applyMode || "").toLowerCase(),
      )
        ? String(o.applyMode).toLowerCase()
        : "topup",
      v = he(t),
      C = Array.isArray(n) ? n : [];
    for (let e = 0; e < C.length; e++) {
      const t = C[e];
      if (!t || !t.captainId) continue;
      const n =
        a.playerById?.get?.(t.captainId) ||
        (a.players || []).find((e) => String(e.id) === String(t.captainId));
      if (!n) continue;
      const s =
        t.troop &&
        ["fighter", "rider", "shooter"].includes(String(t.troop).toLowerCase())
          ? String(t.troop).toLowerCase()
          : r(n.role) || "fighter";
      let l = Math.max(0, Number(t.helpers || 0) || 0);
      if (l > 0 && o?.minHelpersPerTower) {
        const e = Math.max(
          1,
          Math.min(29, Number(o?.minHelpersCount || 10) || 10),
        );
        l = Math.max(l, e);
      }
      const c = Math.max(0, Number(n.rally || 0) || 0),
        _ = Math.max(0, Number(n.march || 0) || 0),
        g = Math.max(0, c + _),
        b = Math.max(0, g - _),
        w = v[e] || null,
        S = String(w?.baseId || ""),
        T = String(w?.title || ""),
        k = Math.max(
          0,
          Number(
            w?.helperCount ||
              (Array.isArray(w?.helperIds) ? w.helperIds.length : 0),
          ) || 0,
        ),
        $ = !!String(w?.captainId || ""),
        M = !(!S || !m(S));
      let I = l,
        L = "";
      (M
        ? ((I = 0),
          (L = i(
            "skipped_turret_locked",
            "турель заблокована (пропущено)",
          ).replace(/ \(.*$/, "")))
        : "empty" === y
          ? ($ || k > 0) &&
            ((I = 0),
            (L = i("skipped_not_empty", "не порожня (пропущено)").replace(
              / \(.*$/,
              "",
            )))
          : "topup" === y &&
            ((I = Math.max(0, l - k)),
            I <= 0 && (L = i("already_filled", "вже заповнено"))),
        d.push({
          player: n,
          troop: s,
          helpersWanted: I,
          helpersWantedRaw: l,
          rallySize: c,
          towerCapacity: g,
          helperCapacity: b,
          captainMarch: _,
          rowRef: t,
          rowIndex: e,
          baseId: S,
          baseTitle: T,
          existingHelperCount: k,
          existingHasCaptain: $,
          towerLocked: M,
          applySkipReason: L,
        }),
        u.add(String(n.id)),
        (p[s] += b),
        (h += _),
        (f += c));
    }
    const T = (function ({
        shiftKey: t,
        excludeIds: n = new Set(),
        both50: o = !1,
        noCrossShift: i = !1,
        bothAllocMap: s = null,
      }) {
        const l = { fighter: [], rider: [], shooter: [] },
          d = c(),
          u =
            d?.helperPrefs && "object" == typeof d.helperPrefs
              ? d.helperPrefs
              : {},
          p =
            d?.overflowReserve && "object" == typeof d.overflowReserve
              ? d.overflowReserve
              : {},
          h =
            "function" == typeof e?.isTowerMatchRegisteredShiftEnabled
              ? !!e.isTowerMatchRegisteredShiftEnabled()
              : !1 !== a.towerPickerMatchRegisteredShift;
        for (const e of a.players || []) {
          if (!e || !e.id) continue;
          const c = String(e.id);
          if (n.has(c) || u[c]?.excluded || (h && !_(e, t))) continue;
          const f = String(e.shift || e.shiftLabel || "").toLowerCase();
          if (!0 !== a.towerPickerNoCrossShiftDupes && "both" === f) continue;
          const m = String((p && p[String(e.id || "")]) || "").toLowerCase();
          if (
            d.ignoreBoth &&
            "both" === f &&
            m !== String(t || "").toLowerCase()
          )
            continue;
          if (o && i && "both" === f) {
            const a = String(t || "").toLowerCase(),
              r = String((s && (s[String(e.id || "")] || s[e.id])) || "");
            if (("shift1" === r || "shift2" === r ? r : w(e)) !== a) continue;
          }
          const y = r(e.role) || "fighter";
          (l[y] || (l[y] = []), l[y].push(e));
        }
        return (
          Object.values(l).forEach((e) =>
            e.sort(
              (e, t) =>
                g(t.tier) - g(e.tier) ||
                Number(t.march || 0) - Number(e.march || 0) ||
                String(e.name || "").localeCompare(String(t.name || "")),
            ),
          ),
          l
        );
      })({
        shiftKey: t,
        excludeIds: new Set([...(s || new Set()), ...u]),
        both50: !!o.both50,
        noCrossShift: !!o.noCrossShift,
        bothAllocMap: o.bothAllocMap || null,
      }),
      $ = {
        fighter: { players: (T.fighter || []).slice() },
        rider: { players: (T.rider || []).slice() },
        shooter: { players: (T.shooter || []).slice() },
      },
      I = c(),
      L =
        I?.helperPrefs && "object" == typeof I.helperPrefs ? I.helperPrefs : {},
      B = { fighter: new Map(), rider: new Map(), shooter: new Map() };
    for (const e of ["fighter", "rider", "shooter"]) {
      const t = d
          .map((e, t) => ({ ...e, idx: t }))
          .filter((t) => String(t.troop || "fighter") === e),
        a = new Map();
      for (const e of t)
        e.baseId &&
          (Math.max(0, Number(e.helpersWanted || 0) || 0) <= 0 ||
            a.set(String(e.baseId), Number(e.idx)));
      const r = new Map();
      for (const t of $[e]?.players || []) {
        const e = String(t?.id || "");
        if (!e) continue;
        const n = L[e],
          o = String(n?.lockedBaseId || "");
        if (!o) continue;
        const i = a.get(o);
        null != i && (r.has(i) || r.set(i, []), r.get(i).push(t));
      }
      B[e] = ce(t, $[e]?.players || [], o, r);
    }
    const E = [],
      x = new Set(),
      P = S(),
      A = S();
    for (const e of ["fighter", "rider", "shooter"])
      for (const t of T[e] || []) {
        const e = `T${g(t.tier)}`;
        P[e] && ((P[e].count += 1), (P[e].march += b(t)));
      }
    let N = 0,
      R = 0,
      q = 0,
      F = 0,
      D = 0;
    for (let e = 0; e < d.length; e++) {
      const t = d[e],
        a = t.troop || "fighter",
        r =
          (B[a] && B[a].get(e)) ||
          M($[a] || { players: [] }, {
            helperSlots: t.helpersWanted,
            capacity: t.helperCapacity,
            tierTargets: o.tierTargets,
          });
      ((N += t.helperCapacity),
        (R += r.usedMarch),
        (q += t.helpersWanted),
        (F += t.helpersWantedRaw),
        (D += r.helpersUsed),
        r.pickedIds.forEach((e) => x.add(String(e))));
      for (const e of l)
        ((A[e].count += r.usedByTier[e].count),
          (A[e].march += r.usedByTier[e].march));
      const n = l
          .map((e) =>
            r.usedByTier[e].count
              ? `${e}×${r.usedByTier[e].count} (${Number(r.usedByTier[e].march || 0).toLocaleString("en-US")})`
              : "",
          )
          .filter(Boolean),
        i = r.recTierMinMarch || {
          T14: 0,
          T13: 0,
          T12: 0,
          T11: 0,
          T10: 0,
          T9: 0,
        },
        s = Array.isArray(r.recTierText) ? r.recTierText.slice() : [];
      E.push({
        idx: e,
        troop: a,
        baseId: t.baseId || "",
        baseTitle: t.baseTitle || "",
        existingHelperCount: t.existingHelperCount || 0,
        existingHasCaptain: !!t.existingHasCaptain,
        towerLocked: !!t.towerLocked,
        applySkipReason: t.applySkipReason || "",
        captain: t.player,
        rallySize: t.rallySize,
        captainMarch: t.captainMarch,
        towerCapacity: t.towerCapacity,
        helperCapacity: t.helperCapacity,
        helpersWantedRaw: t.helpersWantedRaw,
        helpersWanted: t.helpersWanted,
        helpersPlaced: r.helpersUsed,
        usedMarch: r.usedMarch,
        shortageMarch: Math.max(0, t.helperCapacity - r.usedMarch),
        shortageHelpers: Math.max(0, t.helpersWanted - r.helpersUsed),
        tierMix: n,
        byTier: k(r.usedByTier),
        suggestedRule: {
          maxHelpers: Math.max(
            0,
            Number(t.helpersWantedRaw || r.helpersUsed || 0) || 0,
          ),
          tierMinMarch: i,
        },
        suggestedTierText: s,
        notFitPlayers: Array.isArray(r.notFitPlayers) ? r.notFitPlayers : [],
        partialPlayers: Array.isArray(r.partialPlayers) ? r.partialPlayers : [],
        pickedPlayers: Array.isArray(r.pickedPlayers)
          ? r.pickedPlayers.slice()
          : [],
        assignedById: r.assignedById || {},
        lockedPicked: Math.max(0, Number(r.lockedPicked || 0) || 0),
      });
    }
    const O = new Set();
    return (
      o.noCrossShift && x.forEach((e) => O.add(e)),
      {
        shiftKey: t,
        rows: n,
        selectedCaptains: d,
        captainIds: u,
        demandByTroop: p,
        mergedAvail: P,
        mergedUsed: A,
        totalDemand: N,
        totalSupplied: R,
        remaining: Math.max(0, N - R),
        captainMarch: h,
        captainRally: f,
        nextBlocked: O,
        usedAcross: x,
        totalHelpersWanted: q,
        totalHelpersWantedRaw: F,
        totalHelpersPlaced: D,
        towerPlans: E,
        applyMode: y,
      }
    );
  }
  function ue(e, t) {
    if (!t || !e) return;
    const a = (e) => Number(e || 0).toLocaleString("en-US"),
      o =
        Object.entries(e.demandByTroop)
          .filter(([, e]) => Number(e) > 0)
          .map(([e, t]) => `${e}: ${a(t)}`)
          .join(" · ") || "—",
      s = he(e.shiftKey),
      l = (e.towerPlans || []).length
        ? (e.towerPlans || [])
            .map((t, o) => {
              const l = fe(e.shiftKey, t, o, s),
                c = String(l?.baseId || ""),
                u = String(l?.title || ""),
                p = m(c),
                h = (t.pickedPlayers || [])
                  .slice(0, 10)
                  .map((e) => {
                    const o = String(e?.id || ""),
                      s = d(o),
                      l = Number(t.assignedById?.[o] || 0) || 0,
                      u = Number(e?.march || 0) || 0,
                      p = window.PNS.renderHtmlTemplate(
                        "tpl-tower-calc-picked-player-row",
                        {
                          name: n(e?.name || "—"),
                          tier: n(String(e?.tier || "")),
                          role: n(
                            "function" == typeof window.PNS?.roleLabel
                              ? window.PNS.roleLabel(r(e?.role) || "", !1)
                              : r(e?.role) || "",
                          ),
                          sent: a(l),
                          full: a(u),
                          exclude_button_html: o
                            ? window.PNS.renderHtmlTemplate(
                                "tpl-tower-calc-btn",
                                {
                                  btn_class: "",
                                  attrs: `data-calc-toggle-exclude="${n(o)}"`,
                                  label: s?.excluded
                                    ? i("return_action", "Повернути")
                                    : i("remove_action", "Прибрати"),
                                },
                              )
                            : "",
                          lock_button_html:
                            o && c
                              ? window.PNS.renderHtmlTemplate(
                                  "tpl-tower-calc-btn",
                                  {
                                    btn_class: "",
                                    attrs: `data-calc-toggle-lock-helper="${n(o)}" data-base-id="${n(c)}"`,
                                    label:
                                      String(s?.lockedBaseId || "") === c
                                        ? i("unpin_action", "Відкріпити")
                                        : i("pin_action", "Закріпити"),
                                  },
                                )
                              : "",
                        },
                      );
                    return p;
                  })
                  .join(""),
                g = (t.pickedPlayers || []).length
                  ? window.PNS.renderHtmlTemplate(
                      "tpl-tower-calc-picked-players-section",
                      {
                        picked_players_text: i(
                          "picked_players",
                          "Відібрані гравці",
                        ),
                        picked_players_count: a(t.pickedPlayers.length),
                        nickname_text: i("nickname", "Нік"),
                        tier_text: i("tier", "Тір"),
                        troop_type_text: i("troop_type", "Тип військ"),
                        sent_text: i("sent", "Відправлено"),
                        full_text: i("full", "Повний"),
                        actions_text: i("actions", "Дії"),
                        rows_html: h,
                      },
                    )
                  : "";
              return window.PNS.renderHtmlTemplate("tpl-tower-calc-panel", {
                shift_key: n(e.shiftKey),
                base_id: n(c),
                tower_index: n(o + 1),
                captain_name: n(t.captain?.name || "—"),
                troop_label: n(
                  "function" == typeof window.PNS?.roleLabel
                    ? window.PNS.roleLabel(t.troop || "", !0)
                    : t.troop || "",
                ),
                title: n(u || i("turret", "Турель")),
                open_button_html: c
                  ? window.PNS.renderHtmlTemplate("tpl-tower-calc-btn", {
                      btn_class: "",
                      attrs: `data-calc-open-base="${n(c)}" data-calc-shift="${n(e.shiftKey || "")}"`,
                      label: i("turret", "Турель"),
                    })
                  : "",
                edit_button_html: c
                  ? window.PNS.renderHtmlTemplate("tpl-tower-calc-btn", {
                      btn_class: "",
                      attrs: `data-calc-edit-base="${n(c)}" data-calc-shift="${n(e.shiftKey || "")}"`,
                      label: i("edit_players", "Редагувати гравців"),
                    })
                  : "",
                overflow_button_html: c
                  ? window.PNS.renderHtmlTemplate("tpl-tower-calc-btn", {
                      btn_class: "",
                      attrs: `data-calc-pick-overflow-base="${n(c)}" data-calc-shift="${n(e.shiftKey || "")}"`,
                      label: i("take_from_reserve", "Взяти з резерву"),
                    })
                  : "",
                manual_button_html: c
                  ? window.PNS.renderHtmlTemplate("tpl-tower-calc-btn", {
                      btn_class: "",
                      attrs: `data-calc-manual-base="${n(c)}" data-calc-shift="${n(e.shiftKey || "")}"`,
                      label: i("add_player_manually", "Додати гравця вручну"),
                    })
                  : "",
                lock_button_html: c
                  ? window.PNS.renderHtmlTemplate("tpl-tower-calc-btn", {
                      btn_class: p ? "btn-primary" : "",
                      attrs: `data-calc-lock-tower="${n(c)}"`,
                      label: p
                        ? i("unlock_turret", "Розблокувати турель")
                        : i("lock_turret", "Заблокувати турель"),
                    })
                  : "",
                players_text: i("players", "Гравці"),
                players_value: `${a(t.helpersPlaced)} / ${a(t.helpersWanted)}${Number(t.helpersWantedRaw || 0) !== Number(t.helpersWanted || 0) ? ` (${i("without_limits", "без обмежень")}: ${a(t.helpersWantedRaw)})` : ""}`,
                turret_capacity_text: i("turret_capacity", "Місткість турелі"),
                turret_capacity_value: a(
                  t.towerCapacity ||
                    (Number(t.rallySize || 0) || 0) +
                      (Number(t.captainMarch || 0) || 0),
                ),
                used_shortage_text: i("used_shortage", "Використано / нестача"),
                used_shortage_value: `${a(t.usedMarch)} / ${a(t.shortageMarch)}`,
                recommended_min_tier_text: i(
                  "recommended_min_tier",
                  "Рекомендований мінімум за тіром",
                ),
                recommended_min_tier_value: t.suggestedTierText?.length
                  ? n(t.suggestedTierText.join(" · "))
                  : "—",
                meta_line: n(
                  `${i("rally_size", "Розмір ралі")} ${a(t.rallySize)} · ${i("captain_march", "Марш капітана")} ${a(t.captainMarch)} · ${i("helper_slots", "Місць для помічників")} ${a(t.helperCapacity)}`,
                ),
                tier_mix_line: t.tierMix.length
                  ? n(t.tierMix.join(" · "))
                  : "—",
                status_line: t.towerLocked
                  ? `🔒 ${i("turret_locked_not_applied", "Турель заблокована — зміни не застосовано")}`
                  : t.applySkipReason
                    ? n(`ℹ ${t.applySkipReason}`)
                    : (t.lockedPicked || 0) > 0
                      ? n(
                          `🔒 ${i("locked_helpers", "Закріплених помічників")}: ${t.lockedPicked}`,
                        )
                      : "",
                fit_line:
                  t.notFitPlayers?.length || t.partialPlayers?.length
                    ? n(
                        [
                          ...(t.notFitPlayers || [])
                            .slice(0, 4)
                            .map((e) => `${e.name || "—"} (${e.tier || ""})`),
                          ...(t.partialPlayers || [])
                            .slice(0, 2)
                            .map(
                              (e) =>
                                `${e.name || "—"} ${i("partial_short", "частково")} ${Number(e.sent || 0).toLocaleString("en-US")}/${Number(e.full || 0).toLocaleString("en-US")}`,
                            ),
                        ].join(" · "),
                      ) +
                      ((t.notFitPlayers?.length || 0) +
                        (t.partialPlayers?.length || 0) >
                      6
                        ? " …"
                        : "")
                    : `✅ ${i("all_players_placed", "Усі гравці розмістилися")}`,
                picked_players_html: g,
              });
            })
            .join("")
        : window.PNS.renderHtmlTemplate("tpl-tower-calc-no-captains", {
            message: i("captains_not_selected", "Капітанів не вибрано"),
          });
    t.innerHTML = window.renderHtmlTemplate("tpl-tower-calc-summary", {
      selected_captains_label: i("selected_captains", "Обрано капітанів"),
      selected_count: a(e.selectedCaptains.length),
      players_needed_label: i(
        "players_needed_placed",
        "Гравці (потрібно / поставлено)",
      ),
      players_needed_value: `${a(e.totalHelpersWanted)} / ${a(e.totalHelpersPlaced)}${Number(e.totalHelpersWantedRaw || 0) !== Number(e.totalHelpersWanted || 0) ? ` (${i("without_limits", "без обмежень")}: ${a(e.totalHelpersWantedRaw)})` : ""}`,
      player_march_total_label: i("player_march_total", "Марш гравців"),
      player_march_total_value: a(e.totalSupplied),
      shortage_label: i("shortage", "Нестача"),
      shortage_value: a(e.remaining),
      capacity_by_troop_label: i(
        "capacity_by_troop",
        "Місткість за типом військ (від капітанів)",
      ),
      capacity_by_troop_html: o,
      cards_html: l,
      tier_summary_label: i("tier_summary", "Підсумок по тірах"),
      tier_label: i("tier", "Тір"),
      available_players_label: i("available_players", "Доступно гравців"),
      available_march_label: i("available_march", "Доступний марш"),
      used_players_label: i("used_players", "Використано гравців"),
      used_march_label: i("used_march", "Використано марш"),
      tier_rows_html: ["T14", "T13", "T12", "T11", "T10", "T9"]
        .map((t) =>
          window.PNS.renderHtmlTemplate("tpl-tower-calc-tier-summary-row", {
            tier: t,
            avail_count: a(e.mergedAvail[t].count),
            avail_march: a(e.mergedAvail[t].march),
            used_count: a(e.mergedUsed[t].count),
            used_march: a(e.mergedUsed[t].march),
          }),
        )
        .join(""),
    });
  }
  function be() {
    const e = document.getElementById("towerCalcModal");
    if (!e) return null;
    try {
      xEnsureShiftPlans();
    } catch {}
    try {
      me({ keepHelpers: !0, render: !1 });
    } catch {}
    const t = L(e),
      n = {
        noCrossShift: !!t.noCrossShift,
        both50: !!t.both50,
        minHelpersPerTower: !!t.minHelpersPerTower,
        minHelpersCount: Math.max(
          1,
          Math.min(29, Number(t.minHelpersCount || 10) || 10),
        ),
        tierSizeMode: t.tierSizeMode || "auto",
        tierSizeManual: v(t.tierSizeManual),
        tierTargets: C(t),
        applyMode: t.uiApplyMode || "topup",
      };
    if (n.noCrossShift && n.both50)
      try {
        const e = (function (e) {
          const t = {},
            n = new Set();
          try {
            for (const t of [...(e?.shift1 || []), ...(e?.shift2 || [])]) {
              const e = String(t?.captainId || "");
              e && n.add(e);
            }
          } catch {}
          const o = ["fighter", "rider", "shooter"],
            i = {
              shift1: { fighter: 0, rider: 0, shooter: 0 },
              shift2: { fighter: 0, rider: 0, shooter: 0 },
            },
            s = { shift1: 0, shift2: 0 },
            l = { shift1: 0, shift2: 0 },
            c =
              e?.overflowReserve && "object" == typeof e.overflowReserve
                ? e.overflowReserve
                : {},
            d = [];
          for (const e of a.players || []) {
            if (!e || !e.id || n.has(String(e.id))) continue;
            const t = b(e);
            if (t <= 0) continue;
            const a = r(e.role);
            if (!o.includes(a)) continue;
            const c = String(e.shift || e.shiftLabel || "both").toLowerCase();
            "shift1" !== c && "shift2" !== c
              ? "both" === c && d.push(e)
              : ((i[c][a] += 1), (s[c] += 1), (l[c] += t));
          }
          d.sort((e, t) => {
            const a = r(e?.role),
              n = r(t?.role),
              o = Math.abs((i.shift1[a] || 0) - (i.shift2[a] || 0));
            return (
              Math.abs((i.shift1[n] || 0) - (i.shift2[n] || 0)) - o ||
              g(t.tier) - g(e.tier) ||
              Number(t.march || 0) - Number(e.march || 0) ||
              String(e.name || "").localeCompare(String(t.name || ""))
            );
          });
          for (const e of d) {
            const a = String(e.id || ""),
              n = r(e.role) || "fighter";
            if (!a) continue;
            const o = String((c && c[String(e.id)]) || "").toLowerCase();
            if ("shift1" === o || "shift2" === o) {
              ((t[a] = o), (i[o][n] += 1), (s[o] += 1), (l[o] += b(e)));
              continue;
            }
            const d = Number(i.shift1[n] || 0),
              u = Number(i.shift2[n] || 0);
            let p;
            ((p =
              d < u
                ? "shift1"
                : u < d
                  ? "shift2"
                  : s.shift1 < s.shift2
                    ? "shift1"
                    : s.shift2 < s.shift1
                      ? "shift2"
                      : l.shift1 <= l.shift2
                        ? "shift1"
                        : "shift2"),
              (t[a] = p),
              (i[p][n] += 1),
              (s[p] += 1),
              (l[p] += b(e)));
          }
          return {
            map: t,
            counts: { shift1: s.shift1, shift2: s.shift2 },
            march: { shift1: l.shift1, shift2: l.shift2 },
            troopCounts: i,
          };
        })(t);
        ((n.bothAllocMap = e?.map || {}),
          (n.autoBothCounts = e?.counts || null),
          (n.autoBothMarch = e?.march || null),
          (n.autoBothTroopCounts = e?.troopCounts || null));
      } catch {}
    const o = de("shift1", t.shift1, n, new Set()),
      s = de(
        "shift2",
        t.shift2,
        n,
        new Set(n.noCrossShift ? Array.from(o.nextBlocked) : []),
      );
    ((a.towerCalcLastResults = {
      shift1: o,
      shift2: s,
      cfg: n,
      at: Date.now(),
    }),
      ue(o, e.querySelector("#towerCalcOutShift1")),
      ue(s, e.querySelector("#towerCalcOutShift2")));
    const l = e.querySelector("#towerCalcMiniSummary");
    l &&
      (l.textContent = `${i("shift1", "Зміна 1")}: ${Number(o.totalHelpersWanted || 0)}→${Number(o.totalHelpersPlaced || 0)} · ${i("shift2", "Зміна 2")}: ${Number(s.totalHelpersWanted || 0)}→${Number(s.totalHelpersPlaced || 0)} · ${i("both", "Обидві")}: ${Number(A().both.total || 0)} · ${i("shortage", "Нестача")}: ${Number(Math.max(0, o.totalDemand + s.totalDemand - (o.totalSupplied + s.totalSupplied)) || 0).toLocaleString("en-US")}`);
    try {
      P(e, a.towerCalcLastResults);
    } catch {}
    try {
      le(e);
    } catch {}
    return a.towerCalcLastResults;
  }
  ((window.computeTowerCalcShiftResultsImpl = de),
    (window.renderTowerCalcShiftResultsImpl = ue),
    (window.computeTowerCalcResultsImpl = be));
})();
