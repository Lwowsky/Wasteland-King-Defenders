// Tower Calculator (split from modals_api.js)
(function () {
  const PNS = window.PNS;
  if (!PNS) return;
  const MS = (PNS.ModalsShift = PNS.ModalsShift || {});
  const { state } = PNS;
  if (!state) return;
  const $$ = PNS.$$ || ((s, r = document) => Array.from(r.querySelectorAll(s)));

  function roleNorm(v) {
    const t = String(v || "").toLowerCase();
    if (t.includes("fight")) return "fighter";
    if (t.includes("rid")) return "rider";
    if (t.includes("shoot") || t.includes("arch")) return "shooter";
    return "";
  }

  function calcEsc(v) {
    const fn =
      PNS.escapeHtml ||
      ((x) =>
        String(x).replace(
          /[&<>"']/g,
          (m) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '\"': "&quot;",
              "'": "&#39;",
            })[m] || m,
        ));
    return fn(String(v ?? ""));
  }

  function calcFmt(n) {
    return Number(n || 0).toLocaleString("en-US");
  }

  function t(key, fallback = '') {
    try { return typeof PNS.t === 'function' ? PNS.t(key, fallback) : (fallback || key); } catch { return fallback || key; }
  }

  function roleLabel(value, plural = false) {
    try { return typeof PNS.roleLabel === 'function' ? PNS.roleLabel(value, plural) : String(value || ''); } catch { return String(value || ''); }
  }

  function shiftLabel(value) {
    try { return typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(value) : String(value || ''); } catch { return String(value || ''); }
  }

  function towerLabel(value) {
    try { return typeof PNS.towerLabel === 'function' ? PNS.towerLabel(value) : String(value || ''); } catch { return String(value || ''); }
  }

  function getCalcCaptainPool() {
    return (Array.isArray(state.players) ? state.players : [])
      .filter(
        (p) =>
          p &&
          (p.captainReady ||
            Number(p.rally || 0) > 0 ||
            Number(p.march || 0) > 0),
      )
      .slice()
      .sort(
        (a, b) =>
          Number(b.captainReady) - Number(a.captainReady) ||
          Number(b.rally || 0) +
            Number(b.march || 0) -
            (Number(a.rally || 0) + Number(a.march || 0)) ||
          String(a.name || "").localeCompare(String(b.name || "")),
      );
  }

  function ensureTowerCalcModal() {
    const modal = document.getElementById("towerCalcModal");
    if (!modal) {
      console.warn(
        "[PNS] towerCalcModal missing in DOM. Add it to partials/modals.partial.html (or create it before opening).",
      );
      return null;
    }

    // Bind "under settings" visibility/z-index sync once.
    if (!modal.dataset.zfixBound) {
      modal.dataset.zfixBound = "1";
      const settingsModal = document.getElementById("settings-modal");
      const syncZ = () => {
        if (!settingsModal) return;
        const settingsOpen = !!(
          settingsModal.classList.contains("is-open") ||
          (settingsModal.matches && settingsModal.matches(":target")) ||
          getComputedStyle(settingsModal).display !== "none"
        );
        modal.classList.toggle("tower-calc-under-settings", settingsOpen);
        modal.classList.toggle("tower-calc-suspended", settingsOpen);
      };

      try {
        const mo = new MutationObserver(syncZ);
        if (settingsModal)
          mo.observe(settingsModal, {
            attributes: true,
            attributeFilter: ["class", "style"],
          });
      } catch {}

      document.addEventListener("htmx:afterSwap", () => setTimeout(syncZ, 0));
      document.addEventListener("htmx:afterSettle", () => setTimeout(syncZ, 0));
      setTimeout(syncZ, 0);
    }

    return modal;
  }

  function getCalcState() {
    if (!state.towerCalc) state.towerCalc = {};
    const tc = state.towerCalc;
    tc.shift1 = Array.isArray(tc.shift1)
      ? tc.shift1
      : Array.from({ length: 5 }, () => ({
          captainId: "",
          troop: "fighter",
          helpers: 15,
        }));
    tc.shift2 = Array.isArray(tc.shift2)
      ? tc.shift2
      : Array.from({ length: 5 }, () => ({
          captainId: "",
          troop: "fighter",
          helpers: 15,
        }));
    tc.noCrossShift =
      typeof tc.noCrossShift === "boolean" ? tc.noCrossShift : true;
    tc.both50 = typeof tc.both50 === "boolean" ? tc.both50 : false;
    tc.ignoreBoth = typeof tc.ignoreBoth === "boolean" ? tc.ignoreBoth : true;
    tc.minHelpersPerTower =
      typeof tc.minHelpersPerTower === "boolean"
        ? tc.minHelpersPerTower
        : false;
    tc.minHelpersCount = Math.max(
      1,
      Math.min(30, Number(tc.minHelpersCount || 10) || 10),
    );
    tc.compactMode =
      typeof tc.compactMode === "boolean" ? tc.compactMode : true;
    tc.activeTab =
      String(tc.activeTab || "shift1").toLowerCase() === "shift2"
        ? "shift2"
        : "shift1";
    tc.mainTab = ["setup", "towers", "overflow", "preview"].includes(
      String(tc.mainTab || "").toLowerCase(),
    )
      ? String(tc.mainTab).toLowerCase()
      : "setup";
    tc.uiMode = ["assisted", "auto", "manual"].includes(
      String(tc.uiMode || "").toLowerCase(),
    )
      ? String(tc.uiMode).toLowerCase()
      : "assisted";
    tc.uiApplyMode = ["topup", "empty", "rebalance"].includes(
      String(tc.uiApplyMode || "").toLowerCase(),
    )
      ? String(tc.uiApplyMode).toLowerCase()
      : "topup";
    tc.tierSizeMode =
      String(tc.tierSizeMode || "auto").toLowerCase() === "manual"
        ? "manual"
        : "auto";
    tc.tierSizeManual = calcNormalizeTierSizeTargets(tc.tierSizeManual);
    tc.helperPrefs =
      tc.helperPrefs && typeof tc.helperPrefs === "object"
        ? tc.helperPrefs
        : {};
    tc.towerPrefs =
      tc.towerPrefs && typeof tc.towerPrefs === "object" ? tc.towerPrefs : {};
    tc.overflowReserve =
      tc.overflowReserve && typeof tc.overflowReserve === "object"
        ? tc.overflowReserve
        : {};
    tc.inlineTowerSelected =
      tc.inlineTowerSelected && typeof tc.inlineTowerSelected === "object"
        ? tc.inlineTowerSelected
        : {};
    tc.previewShift = ["shift1", "shift2"].includes(
      String(tc.previewShift || "").toLowerCase(),
    )
      ? String(tc.previewShift).toLowerCase()
      : ["shift1", "shift2"].includes(
            String(state.activeShift || "").toLowerCase(),
          )
        ? String(state.activeShift).toLowerCase()
        : "shift2";
    tc.ignoreBoth = !!tc.ignoreBoth;
    tc.dontTouchBothVersion = Math.max(
      1,
      Number(tc.dontTouchBothVersion || 1) || 1,
    );
    return tc;
  }

  function calcGetHelperPref(pid) {
    const tc = getCalcState();
    const id = String(pid || "");
    const raw =
      id && tc?.helperPrefs && typeof tc.helperPrefs === "object"
        ? tc.helperPrefs[id]
        : null;
    return raw && typeof raw === "object" ? raw : {};
  }

  function calcSetHelperPref(pid, patch) {
    const tc = getCalcState();
    const id = String(pid || "");
    if (!id) return tc;
    const prev =
      tc.helperPrefs &&
      typeof tc.helperPrefs === "object" &&
      tc.helperPrefs[id] &&
      typeof tc.helperPrefs[id] === "object"
        ? tc.helperPrefs[id]
        : {};
    tc.helperPrefs = tc.helperPrefs || {};
    const next = {
      ...prev,
      ...(patch && typeof patch === "object" ? patch : {}),
    };
    if (!next.excluded && !next.lockedBaseId) delete tc.helperPrefs[id];
    else tc.helperPrefs[id] = next;
    try {
      localStorage.setItem("pns_tower_calc_state", JSON.stringify(tc));
    } catch {}
    return tc;
  }

  function calcToggleHelperExcluded(pid) {
    const pref = calcGetHelperPref(pid);
    calcSetHelperPref(pid, { excluded: !pref.excluded });
  }

  function calcToggleHelperLockedToBase(pid, baseId) {
    const pref = calcGetHelperPref(pid);
    const bid = String(baseId || "");
    const nextLock =
      pref.lockedBaseId && String(pref.lockedBaseId) === bid ? "" : bid;
    calcSetHelperPref(pid, { lockedBaseId: nextLock || undefined });
  }

  function calcToggleTowerLocked(baseId) {
    const tc = getCalcState();
    const bid = String(baseId || "");
    if (!bid) return;
    tc.towerPrefs = tc.towerPrefs || {};
    const cur = !!tc.towerPrefs[bid]?.locked;
    tc.towerPrefs[bid] = { ...(tc.towerPrefs[bid] || {}), locked: !cur };
    if (!tc.towerPrefs[bid].locked) {
      const c = { ...(tc.towerPrefs[bid] || {}) };
      delete c.locked;
      if (Object.keys(c).length) tc.towerPrefs[bid] = c;
      else delete tc.towerPrefs[bid];
    }
    try {
      localStorage.setItem("pns_tower_calc_state", JSON.stringify(tc));
    } catch {}
  }

  function calcIsTowerLocked(baseId) {
    const tc = getCalcState();
    return !!(
      tc?.towerPrefs &&
      tc.towerPrefs[String(baseId || "")] &&
      tc.towerPrefs[String(baseId || "")].locked
    );
  }

  function calcSetOverflowReserve(pid, shiftKey) {
    const tc = getCalcState();
    const id = String(pid || "");
    const sk = ["shift1", "shift2"].includes(
      String(shiftKey || "").toLowerCase(),
    )
      ? String(shiftKey).toLowerCase()
      : "";
    if (!id) return;
    tc.overflowReserve = tc.overflowReserve || {};
    if (sk) tc.overflowReserve[id] = sk;
    else delete tc.overflowReserve[id];
    try {
      localStorage.setItem("pns_tower_calc_state", JSON.stringify(tc));
    } catch {}
  }

  function calcRenderPreviewPanel(modal, results) {
    const root = modal || document.getElementById("towerCalcModal");
    const out = root?.querySelector?.("#towerCalcGlobalOut");
    if (!out) return;
    const res = results || state.towerCalcLastResults;
    if (!res?.shift1 && !res?.shift2) return;
    const fm = (n) => Number(n || 0).toLocaleString("en-US");
    const rows = [];
    for (const sk of ["shift1", "shift2"]) {
      const slots = calcGetTowerSlotsForShift(sk);
      const plans = Array.isArray(res?.[sk]?.towerPlans)
        ? res[sk].towerPlans
        : [];
      for (let i = 0; i < plans.length; i++) {
        const tp = plans[i];
        const slot = calcResolveBaseSlotForTowerPlan(sk, tp, i, slots);
        if (!slot) continue;
        const beforeHelpers = Array.isArray(slot.helperIds)
          ? slot.helperIds.length
          : 0;
        const beforeCaptain = String(slot.captainId || "");
        const afterHelpers = Number(tp?.helpersPlaced || 0) || 0;
        const afterCaptain = String(tp?.captain?.id || "");
        const changes = [];
        if (beforeCaptain !== afterCaptain) changes.push("captain");
        if (beforeHelpers !== afterHelpers)
          changes.push(`${t('helpers_short', 'помічники')} ${beforeHelpers}→${afterHelpers}`);
        if (Number(tp?.shortageMarch || 0) > 0)
          changes.push(`${t('shortage', 'Нестача')} ${fm(tp.shortageMarch)}`);
        changes.push(t('limits_short', 'ліміти'));
        rows.push({
          shift: shiftLabel(sk),
          tower: String(slot.title || slot.baseId || `${t('turret', 'Турель')} ${i + 1}`),
          beforeCaptain: beforeCaptain
            ? state.playerById?.get?.(beforeCaptain)?.name || beforeCaptain
            : "—",
          afterCaptain: afterCaptain ? tp?.captain?.name || afterCaptain : "—",
          beforeHelpers,
          afterHelpers,
          afterUsed: Number(tp?.usedMarch || 0) || 0,
          changes: changes.join(" · "),
        });
      }
    }
    const table = rows.length
      ? `
    <div class="helpers-table-wrap top-space" style="max-height:48vh;overflow:auto">
      <table class="mini-table tower-calc-tier-table">
        <thead><tr><th>${t('shift', 'Зміна')}</th><th>${t('turret', 'Турель')}</th><th>${t('before_captain_helpers', 'Було (капітан/помічники)')}</th><th>${t('after_captain_helpers', 'Стане (капітан/помічники)')}</th><th>${t('used_march', 'Використано марш')}</th><th>${t('changes', 'Зміни')}</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `<tr>
            <td>${calcEsc(r.shift)}</td>
            <td>${calcEsc(r.tower)}</td>
            <td>${calcEsc(r.beforeCaptain)} / ${fm(r.beforeHelpers)}</td>
            <td>${calcEsc(r.afterCaptain)} / ${fm(r.afterHelpers)}</td>
            <td>${fm(r.afterUsed)}</td>
            <td>${calcEsc(r.changes)}</td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`
      : `<div class="tower-calc-placeholder muted small">${t('no_preview_data', 'Немає даних для preview.')}</div>`;
    let preview = out.querySelector?.("#towerCalcPreviewDiff");
    if (!preview) {
      preview = document.createElement("div");
      preview.id = "towerCalcPreviewDiff";
      preview.className = "top-space";
      out.appendChild(preview);
    }
    preview.innerHTML = `<div class="muted small"><strong>Preview changes (v7.0b)</strong></div>${table}`;
  }

  function calcShiftMatch(p, shiftKey) {
    const ps = String(p?.shift || "both").toLowerCase();
    return ps === "both" || ps === String(shiftKey || "").toLowerCase();
  }

  function calcTierRank(tier) {
    const m = String(tier || "")
      .toUpperCase()
      .match(/T\s*(\d+)/);
    return m ? Number(m[1]) : 0;
  }

  function calcContribForPlayer(p) {
    return Math.max(0, Number(p?.march || 0) || 0);
  }

  function calcStableHash(str) {
    const s = String(str || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function calcBoth50BucketForPlayer(p) {
    const key = String(p?.id || p?.name || "");
    return calcStableHash(key) % 2 === 0 ? "shift1" : "shift2";
  }

  function calcBuildAutoBothBalanceMap(tc) {
    const map = {};
    const captainIds = new Set();
    try {
      for (const r of [...(tc?.shift1 || []), ...(tc?.shift2 || [])]) {
        const id = String(r?.captainId || "");
        if (id) captainIds.add(id);
      }
    } catch {}
    const troops = ["fighter", "rider", "shooter"];
    const countByTroop = {
      shift1: { fighter: 0, rider: 0, shooter: 0 },
      shift2: { fighter: 0, rider: 0, shooter: 0 },
    };
    const totalCount = { shift1: 0, shift2: 0 };
    const totalMarch = { shift1: 0, shift2: 0 };
    const reserves =
      tc?.overflowReserve && typeof tc.overflowReserve === "object"
        ? tc.overflowReserve
        : {};
    const bothPool = [];

    for (const p of state.players || []) {
      if (!p || !p.id) continue;
      if (captainIds.has(String(p.id))) continue; // captains are handled separately; they can repeat
      const march = calcContribForPlayer(p);
      if (march <= 0) continue;
      const troop = roleNorm(p.role);
      if (!troops.includes(troop)) continue;
      const ps = String(p.shift || p.shiftLabel || "both").toLowerCase();
      if (ps === "shift1" || ps === "shift2") {
        countByTroop[ps][troop] += 1;
        totalCount[ps] += 1;
        totalMarch[ps] += march;
        continue;
      }
      if (ps === "both") bothPool.push(p);
    }

    bothPool.sort((a, b) => {
      const ta = roleNorm(a?.role),
        tb = roleNorm(b?.role);
      const cA = Math.abs(
        (countByTroop.shift1[ta] || 0) - (countByTroop.shift2[ta] || 0),
      );
      const cB = Math.abs(
        (countByTroop.shift1[tb] || 0) - (countByTroop.shift2[tb] || 0),
      );
      return (
        cB - cA ||
        calcTierRank(b.tier) - calcTierRank(a.tier) ||
        Number(b.march || 0) - Number(a.march || 0) ||
        String(a.name || "").localeCompare(String(b.name || ""))
      );
    });

    for (const p of bothPool) {
      const pid = String(p.id || "");
      const troop = roleNorm(p.role) || "fighter";
      if (!pid) continue;
      const forcedReserve = String(
        (reserves && reserves[String(p.id)]) || "",
      ).toLowerCase();
      if (forcedReserve === "shift1" || forcedReserve === "shift2") {
        map[pid] = forcedReserve;
        countByTroop[forcedReserve][troop] += 1;
        totalCount[forcedReserve] += 1;
        totalMarch[forcedReserve] += calcContribForPlayer(p);
        continue;
      }
      const c1 = Number(countByTroop.shift1[troop] || 0);
      const c2 = Number(countByTroop.shift2[troop] || 0);
      let target;
      if (c1 < c2) target = "shift1";
      else if (c2 < c1) target = "shift2";
      else if (totalCount.shift1 < totalCount.shift2) target = "shift1";
      else if (totalCount.shift2 < totalCount.shift1) target = "shift2";
      else
        target = totalMarch.shift1 <= totalMarch.shift2 ? "shift1" : "shift2";
      map[pid] = target;
      countByTroop[target][troop] += 1;
      totalCount[target] += 1;
      totalMarch[target] += calcContribForPlayer(p);
    }

    return {
      map,
      counts: { shift1: totalCount.shift1, shift2: totalCount.shift2 },
      march: { shift1: totalMarch.shift1, shift2: totalMarch.shift2 },
      troopCounts: countByTroop,
    };
  }

  function buildCalcPlayersByTroop({
    shiftKey,
    excludeIds = new Set(),
    both50 = false,
    noCrossShift = false,
    bothAllocMap = null,
  }) {
    const byTroop = { fighter: [], rider: [], shooter: [] };
    const tc = getCalcState();
    const hprefs =
      tc?.helperPrefs && typeof tc.helperPrefs === "object"
        ? tc.helperPrefs
        : {};
    const reserves =
      tc?.overflowReserve && typeof tc.overflowReserve === "object"
        ? tc.overflowReserve
        : {};
    const matchRegisteredShift =
      typeof PNS?.isTowerMatchRegisteredShiftEnabled === "function"
        ? !!PNS.isTowerMatchRegisteredShiftEnabled()
        : state.towerPickerMatchRegisteredShift !== false;
    for (const p of state.players || []) {
      if (!p || !p.id) continue;
      const pid = String(p.id);
      if (excludeIds.has(pid)) continue;
      if (hprefs[pid]?.excluded) continue;
      if (matchRegisteredShift && !calcShiftMatch(p, shiftKey)) continue;
      const rawShift = String(p.shift || p.shiftLabel || "").toLowerCase();
      const useBoth = state.towerPickerNoCrossShiftDupes === true;
      if (!useBoth && rawShift === "both") continue;
      const forcedReserve = String(
        (reserves && reserves[String(p.id || "")]) || "",
      ).toLowerCase();
      if (
        tc.ignoreBoth &&
        rawShift === "both" &&
        forcedReserve !== String(shiftKey || "").toLowerCase()
      )
        continue;
      if (both50 && noCrossShift && rawShift === "both") {
        const sk = String(shiftKey || "").toLowerCase();
        const mapped = String(
          (bothAllocMap &&
            (bothAllocMap[String(p.id || "")] || bothAllocMap[p.id])) ||
            "",
        );
        const bucket =
          mapped === "shift1" || mapped === "shift2"
            ? mapped
            : calcBoth50BucketForPlayer(p);
        if (bucket !== sk) continue;
      }
      const troop = roleNorm(p.role) || "fighter";
      if (!byTroop[troop]) byTroop[troop] = [];
      byTroop[troop].push(p);
    }
    Object.values(byTroop).forEach((arr) =>
      arr.sort(
        (a, b) =>
          calcTierRank(b.tier) - calcTierRank(a.tier) ||
          Number(b.march || 0) - Number(a.march || 0) ||
          String(a.name || "").localeCompare(String(b.name || "")),
      ),
    );
    return byTroop;
  }

  function calcEmptyTierMap() {
    const tiers = ["T14", "T13", "T12", "T11", "T10", "T9"];
    return Object.fromEntries(tiers.map((t) => [t, { count: 0, march: 0 }]));
  }

  function calcDefaultTierSizeTargets() {
    return {
      T14: 300000,
      T13: 250000,
      T12: 200000,
      T11: 150000,
      T10: 100000,
      T9: 80000,
    };
  }

  function calcNormalizeTierSizeTargets(src) {
    const base = calcDefaultTierSizeTargets();
    const out = {};
    for (const k of ["T14", "T13", "T12", "T11", "T10", "T9"]) {
      const v = Math.max(0, Number(src?.[k] ?? base[k]) || base[k] || 0);
      out[k] = Math.round(v);
    }
    return out;
  }

  function calcResolveTierSizeTargets(cfg) {
    if (cfg && String(cfg.tierSizeMode || "").toLowerCase() === "manual") {
      return calcNormalizeTierSizeTargets(cfg.tierSizeManual);
    }
    return calcDefaultTierSizeTargets();
  }

  function calcTierTargetsFromModal(modal) {
    const out = calcDefaultTierSizeTargets();
    const root = modal || document.getElementById("towerCalcModal");
    root?.querySelectorAll("[data-calc-tier-target]").forEach((inp) => {
      const tier = String(inp?.dataset?.calcTierTarget || "").toUpperCase();
      if (!tier) return;
      out[tier] = Math.max(
        0,
        Number(inp.value || out[tier] || 0) || out[tier] || 0,
      );
    });
    return calcNormalizeTierSizeTargets(out);
  }

  function calcApplyTierTargetInputsState(modal, tc) {
    const root = modal || document.getElementById("towerCalcModal");
    const mode =
      String(tc?.tierSizeMode || "auto").toLowerCase() === "manual"
        ? "manual"
        : "auto";
    const autoMode = mode !== "manual";
    const autoCb = root?.querySelector("#towerCalcTierAuto");
    if (autoCb) autoCb.checked = autoMode;
    const vals = autoMode
      ? calcDefaultTierSizeTargets()
      : calcNormalizeTierSizeTargets(tc?.tierSizeManual);
    root?.querySelectorAll("[data-calc-tier-target]").forEach((inp) => {
      const tier = String(inp?.dataset?.calcTierTarget || "").toUpperCase();
      if (!tier) return;
      inp.value = String(Math.max(0, Number(vals[tier] || 0) || 0));
      inp.disabled = !!autoMode;
    });
  }

  function calcTierPreferredHelperSize(tier, tierTargets) {
    const t = `T${calcTierRank(tier)}`;
    const map = calcNormalizeTierSizeTargets(tierTargets);
    return Math.max(0, Number(map[t] || 0) || 0);
  }

  function cloneTierMap(src) {
    const out = calcEmptyTierMap();
    for (const k of Object.keys(out)) {
      out[k].count = Number(src?.[k]?.count || 0) || 0;
      out[k].march = Number(src?.[k]?.march || 0) || 0;
    }
    return out;
  }

  function distributeCalcCapacityAcrossPicks(
    pickedPlayers,
    capacity,
    opts = {},
  ) {
    const usedByTier = calcEmptyTierMap();
    const recTierMinMarch = { T14: 0, T13: 0, T12: 0, T11: 0, T10: 0, T9: 0 };
    const recTierText = [];
    const players = Array.isArray(pickedPlayers) ? pickedPlayers : [];
    let capLeft = Math.max(0, Number(capacity || 0) || 0);
    if (!players.length || capLeft <= 0) {
      return {
        usedByTier,
        usedMarch: 0,
        capLeft,
        recTierMinMarch,
        recTierText,
        helpersUsed: 0,
        assignedById: {},
        partialPlayers: [],
        notFitPlayers: [],
      };
    }

    const maxes = players.map((p) =>
      Math.max(0, Number(calcContribForPlayer(p) || 0) || 0),
    );
    const assigned = new Array(players.length).fill(0);

    // Phase A: assign a tier-based preferred helper size (higher tiers can have bigger size).
    const desiredBase = players.map((p, i) => {
      const pref = Math.max(
        0,
        Number(calcTierPreferredHelperSize(p?.tier, opts?.tierTargets) || 0) ||
          0,
      );
      const mx = Math.max(0, Number(maxes[i] || 0) || 0);
      return Math.min(mx, pref > 0 ? pref : mx);
    });
    const desiredSum = desiredBase.reduce(
      (s, v) => s + (Number(v || 0) || 0),
      0,
    );

    if (desiredSum > 0 && capLeft > 0) {
      if (desiredSum <= capLeft) {
        for (let i = 0; i < desiredBase.length; i++) {
          const v = Math.max(0, Number(desiredBase[i] || 0) || 0);
          assigned[i] += v;
          capLeft -= v;
        }
      } else {
        const ratio = capLeft / desiredSum;
        const rema = [];
        let used = 0;
        for (let i = 0; i < desiredBase.length; i++) {
          const raw = (Number(desiredBase[i] || 0) || 0) * ratio;
          const flo = Math.min(maxes[i], Math.max(0, Math.floor(raw)));
          assigned[i] = flo;
          used += flo;
          rema.push({
            i,
            frac: raw - flo,
            tier: calcTierRank(players[i]?.tier),
            march: maxes[i],
          });
        }
        capLeft = Math.max(0, capLeft - used);
        rema.sort(
          (a, b) => b.frac - a.frac || b.tier - a.tier || b.march - a.march,
        );
        for (const r of rema) {
          if (capLeft <= 0) break;
          if (assigned[r.i] >= maxes[r.i]) continue;
          assigned[r.i] += 1;
          capLeft -= 1;
        }
      }
    }

    // Phase B: top-up toward full march when captain still has free rally space.
    if (capLeft > 0) {
      const topupOrder = players
        .map((p, i) => ({
          i,
          tier: calcTierRank(p?.tier),
          room: Math.max(
            0,
            (Number(maxes[i] || 0) || 0) - (Number(assigned[i] || 0) || 0),
          ),
          march: Number(maxes[i] || 0) || 0,
        }))
        .filter((x) => x.room > 0)
        .sort((a, b) => b.tier - a.tier || b.march - a.march || a.i - b.i);

      for (const item of topupOrder) {
        if (capLeft <= 0) break;
        const room = Math.max(0, Number(item.room || 0) || 0);
        if (room <= 0) continue;
        const add = Math.min(room, capLeft);
        assigned[item.i] += add;
        capLeft -= add;
      }
    }

    let usedMarch = 0;
    let helpersUsed = 0;
    const tiers = ["T14", "T13", "T12", "T11", "T10", "T9"];
    const assignedById = {};
    const partialPlayers = [];
    const notFitPlayers = [];

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const sent = Math.max(0, Number(assigned[i] || 0) || 0);
      const full = Math.max(0, Number(maxes[i] || 0) || 0);
      const pid = String(p?.id || "");
      if (pid) assignedById[pid] = sent;
      if (sent <= 0) {
        notFitPlayers.push({
          id: pid,
          name: String(p?.name || ""),
          tier: String(p?.tier || ""),
          role: String(p?.role || ""),
          troop: roleNorm(p?.role) || "",
          march: full,
        });
        continue;
      }
      helpersUsed += 1;
      usedMarch += sent;
      if (sent < full) {
        partialPlayers.push({
          id: pid,
          name: String(p?.name || ""),
          tier: String(p?.tier || ""),
          sent,
          full,
        });
      }
      const tierKey = `T${calcTierRank(p?.tier)}`;
      if (!usedByTier[tierKey]) continue;
      usedByTier[tierKey].count += 1;
      usedByTier[tierKey].march += sent;
    }

    for (const t of tiers) {
      const c = Number(usedByTier[t]?.count || 0) || 0;
      const m = Number(usedByTier[t]?.march || 0) || 0;
      const eq = c > 0 ? Math.max(0, Math.round(m / c)) : 0;
      recTierMinMarch[t] = eq;
    }
    let prevTierSize = null;
    for (const t of tiers) {
      let v = Math.max(0, Number(recTierMinMarch[t] || 0) || 0);
      if (prevTierSize != null && v > prevTierSize) v = prevTierSize;
      recTierMinMarch[t] = v;
      prevTierSize = v;
      const c = Number(usedByTier[t]?.count || 0) || 0;
      if (c > 0)
        recTierText.push(`${t}:${Number(v).toLocaleString("en-US")} ×${c}`);
    }

    return {
      usedByTier,
      usedMarch,
      capLeft,
      recTierMinMarch,
      recTierText,
      helpersUsed,
      assignedById,
      partialPlayers,
      notFitPlayers,
    };
  }

  function allocateTowerFromPool(
    poolRef,
    { helperSlots = 0, capacity = 0, tierTargets = null } = {},
  ) {
    const pickedIds = new Set();
    const pickedPlayers = [];
    const requestedSlots = Math.max(0, Number(helperSlots || 0));
    let slotsLeftToPick = requestedSlots;
    const cap = Math.max(0, Number(capacity || 0));

    if (!Array.isArray(poolRef?.players))
      poolRef = { players: Array.isArray(poolRef) ? poolRef : [] };
    const players = poolRef.players || [];
    const usedIds =
      poolRef._usedIds instanceof Set
        ? poolRef._usedIds
        : (poolRef._usedIds = new Set());

    for (let i = 0; i < players.length && slotsLeftToPick > 0; i++) {
      const p = players[i];
      if (!p) continue;
      const pid = String(p.id || "");
      if (!pid || usedIds.has(pid)) continue;
      if (calcContribForPlayer(p) <= 0) continue;
      usedIds.add(pid);
      pickedIds.add(pid);
      pickedPlayers.push(p);
      slotsLeftToPick -= 1;
    }

    const dist = distributeCalcCapacityAcrossPicks(pickedPlayers, cap, {
      tierTargets,
    });

    return {
      usedByTier: dist.usedByTier,
      pickedIds,
      pickedPlayers,
      assignedById: dist.assignedById || {},
      notFitPlayers: Array.isArray(dist.notFitPlayers)
        ? dist.notFitPlayers
        : [],
      partialPlayers: Array.isArray(dist.partialPlayers)
        ? dist.partialPlayers
        : [],
      helperSlotsRequested: requestedSlots,
      helpersUsed: Math.max(0, Number(dist.helpersUsed || 0)),
      usedMarch: Math.max(0, Number(dist.usedMarch || 0)),
      capacity: cap,
      capLeft: Math.max(0, Number(dist.capLeft || 0)),
      slotsLeft: Math.max(
        0,
        requestedSlots - Math.max(0, Number(dist.helpersUsed || 0)),
      ),
      recTierMinMarch: dist.recTierMinMarch,
      recTierText: dist.recTierText,
    };
  }

  function calcReadRowsFromDOM(shiftKey, modal) {
    const root = modal || document.getElementById("towerCalcModal");
    const rows = [];
    root
      ?.querySelectorAll(`[data-calc-row][data-calc-shift="${shiftKey}"]`)
      .forEach((row) => {
        rows.push({
          captainId: String(
            row.querySelector("[data-calc-captain]")?.value || "",
          ),
          troop: String(
            row.querySelector("[data-calc-troop]")?.value || "fighter",
          ).toLowerCase(),
          helpers: Math.max(
            0,
            Number(row.querySelector("[data-calc-helpers]")?.value || 15) || 15,
          ),
        });
      });
    return rows;
  }

  function calcWriteRowsToState(modal) {
    const tc = getCalcState();
    const domShift1 = calcReadRowsFromDOM("shift1", modal);
    const domShift2 = calcReadRowsFromDOM("shift2", modal);
    if (domShift1.length) tc.shift1 = domShift1;
    if (domShift2.length) tc.shift2 = domShift2;
    tc.noCrossShift = !!modal?.querySelector("#towerCalcNoCrossShift")?.checked;
    tc.both50 = !!modal?.querySelector("#towerCalcBoth50")?.checked;
    tc.ignoreBoth = !!modal?.querySelector("#towerCalcIgnoreBoth")?.checked;
    tc.dontTouchBothVersion = 1;
    tc.minHelpersPerTower = !!modal?.querySelector("#towerCalcMinHelpersOn")
      ?.checked;
    tc.minHelpersCount = Math.max(
      1,
      Math.min(
        30,
        Number(
          modal?.querySelector("#towerCalcMinHelpersCount")?.value ||
            tc.minHelpersCount ||
            10,
        ) || 10,
      ),
    );
    tc.activeTab =
      String(
        modal
          ?.querySelector("[data-calc-tab].is-active")
          ?.getAttribute("data-calc-tab") ||
          tc.activeTab ||
          "shift1",
      ).toLowerCase() === "shift2"
        ? "shift2"
        : "shift1";
    tc.mainTab = String(
      modal
        ?.querySelector("[data-calc-main-tab].is-active")
        ?.getAttribute("data-calc-main-tab") ||
        tc.mainTab ||
        "setup",
    ).toLowerCase();
    tc.uiMode = String(
      modal?.querySelector("#towerCalcModeUi")?.value ||
        tc.uiMode ||
        "assisted",
    ).toLowerCase();
    tc.uiApplyMode = String(
      modal?.querySelector("#towerCalcApplyModeUi")?.value ||
        tc.uiApplyMode ||
        "topup",
    ).toLowerCase();
    tc.tierSizeMode = modal?.querySelector("#towerCalcTierAuto")?.checked
      ? "auto"
      : "manual";
    tc.tierSizeManual = calcTierTargetsFromModal(modal);
    try {
      localStorage.setItem("pns_tower_calc_state", JSON.stringify(tc));
    } catch {}
    return tc;
  }

  function calcLoadStateFromLS() {
    const tc = getCalcState();
    if (tc._hydrated) return tc;
    tc._hydrated = true;
    try {
      const raw = localStorage.getItem("pns_tower_calc_state");
      if (!raw) return tc;
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        if (Array.isArray(data.shift1)) tc.shift1 = data.shift1.slice(0, 5);
        if (Array.isArray(data.shift2)) tc.shift2 = data.shift2.slice(0, 5);
        if (typeof data.noCrossShift === "boolean")
          tc.noCrossShift = data.noCrossShift;
        if (typeof data.both50 === "boolean") tc.both50 = data.both50;
        if (typeof data.ignoreBoth === "boolean")
          tc.ignoreBoth = data.ignoreBoth;
        if (Number(data.dontTouchBothVersion || 0) < 1) {
          tc.ignoreBoth = true;
          tc.dontTouchBothVersion = 1;
        } else if (Number(data.dontTouchBothVersion || 0) >= 1) {
          tc.dontTouchBothVersion = Number(data.dontTouchBothVersion || 1) || 1;
        }
        if (String(data.activeTab || "").toLowerCase() === "shift2")
          tc.activeTab = "shift2";
        if (
          ["setup", "towers", "overflow", "preview"].includes(
            String(data.mainTab || "").toLowerCase(),
          )
        )
          tc.mainTab = String(data.mainTab).toLowerCase();
        if (
          ["assisted", "auto", "manual"].includes(
            String(data.uiMode || "").toLowerCase(),
          )
        )
          tc.uiMode = String(data.uiMode).toLowerCase();
        if (
          ["topup", "empty", "rebalance"].includes(
            String(data.uiApplyMode || "").toLowerCase(),
          )
        )
          tc.uiApplyMode = String(data.uiApplyMode).toLowerCase();
        if (String(data.tierSizeMode || "").toLowerCase() === "manual")
          tc.tierSizeMode = "manual";
        if (data.tierSizeManual && typeof data.tierSizeManual === "object")
          tc.tierSizeManual = calcNormalizeTierSizeTargets(data.tierSizeManual);
        if (data.helperPrefs && typeof data.helperPrefs === "object")
          tc.helperPrefs = data.helperPrefs;
        if (data.towerPrefs && typeof data.towerPrefs === "object")
          tc.towerPrefs = data.towerPrefs;
        if (data.overflowReserve && typeof data.overflowReserve === "object")
          tc.overflowReserve = data.overflowReserve;
      }
    } catch {}
    while (tc.shift1.length < 5)
      tc.shift1.push({ captainId: "", troop: "fighter", helpers: 15 });
    while (tc.shift2.length < 5)
      tc.shift2.push({ captainId: "", troop: "fighter", helpers: 15 });
    tc.shift1 = tc.shift1.map((r) => ({
      captainId: String(r?.captainId || ""),
      troop: String(r?.troop || "fighter"),
      helpers: Math.max(0, Number(r?.helpers ?? r?.rally ?? 15) || 15),
    }));
    tc.shift2 = tc.shift2.map((r) => ({
      captainId: String(r?.captainId || ""),
      troop: String(r?.troop || "fighter"),
      helpers: Math.max(0, Number(r?.helpers ?? r?.rally ?? 15) || 15),
    }));
    tc.tierSizeMode =
      String(tc.tierSizeMode || "auto").toLowerCase() === "manual"
        ? "manual"
        : "auto";
    tc.tierSizeManual = calcNormalizeTierSizeTargets(tc.tierSizeManual);
    tc.helperPrefs =
      tc.helperPrefs && typeof tc.helperPrefs === "object"
        ? tc.helperPrefs
        : {};
    tc.towerPrefs =
      tc.towerPrefs && typeof tc.towerPrefs === "object" ? tc.towerPrefs : {};
    tc.overflowReserve =
      tc.overflowReserve && typeof tc.overflowReserve === "object"
        ? tc.overflowReserve
        : {};
    tc.inlineTowerSelected =
      tc.inlineTowerSelected && typeof tc.inlineTowerSelected === "object"
        ? tc.inlineTowerSelected
        : {};
    tc.previewShift = ["shift1", "shift2"].includes(
      String(tc.previewShift || "").toLowerCase(),
    )
      ? String(tc.previewShift).toLowerCase()
      : ["shift1", "shift2"].includes(
            String(state.activeShift || "").toLowerCase(),
          )
        ? String(state.activeShift).toLowerCase()
        : "shift2";
    tc.ignoreBoth = !!tc.ignoreBoth;
    return tc;
  }

  function calcApplyActiveTabUI(modal, tab) {
    const root = modal || document.getElementById("towerCalcModal");
    const active =
      String(tab || "").toLowerCase() === "shift2" ? "shift2" : "shift1";
    root?.querySelectorAll?.("[data-calc-tab]").forEach((b) => {
      const on = String(b.getAttribute("data-calc-tab") || "") === active;
      b.classList.toggle("is-active", on);
      try {
        b.style.opacity = on ? "1" : "0.78";
        b.style.borderColor = on ? "rgba(148,163,184,.5)" : "";
        b.style.boxShadow = on ? "inset 0 0 0 1px rgba(148,163,184,.35)" : "";
      } catch {}
    });
    root?.querySelectorAll?.("[data-calc-panel]").forEach((p) => {
      const isOn = String(p.getAttribute("data-calc-panel") || "") === active;
      p.style.display = isOn ? "" : "none";
    });
    try {
      root
        .querySelector("#towerCalcGrid")
        ?.setAttribute("data-active-shift", active);
    } catch {}
    try {
      root
        .querySelector("#towerCalcGlobalOut")
        ?.setAttribute("data-active-shift", active);
    } catch {}
    return active;
  }

  function calcApplyMainTabUI(modal, tab) {
    const root = modal || document.getElementById("towerCalcModal");
    const active = ["setup", "towers", "overflow", "preview"].includes(
      String(tab || "").toLowerCase(),
    )
      ? String(tab).toLowerCase()
      : "setup";
    root?.querySelectorAll?.("[data-calc-main-tab]").forEach((b) => {
      const on = String(b.getAttribute("data-calc-main-tab") || "") === active;
      b.classList.toggle("is-active", on);
      try {
        b.style.opacity = on ? "1" : "0.82";
      } catch {}
    });
    root?.querySelectorAll?.("[data-calc-main-panel]").forEach((p) => {
      const on =
        String(p.getAttribute("data-calc-main-panel") || "") === active;
      p.classList.toggle("is-active", on);
      p.style.display = on ? "" : "none";
    });
    return active;
  }

  function calcRenderOverflowPanel(modal, results) {
    const root = modal || document.getElementById("towerCalcModal");
    const out = root?.querySelector?.("#towerCalcOverflowOut");
    if (!out) return;
    const res = results || state.towerCalcLastResults;
    const fm = (n) => Number(n || 0).toLocaleString("en-US");
    const tc = getCalcState();
    const counts =
      typeof PNS?.getShiftCounts === "function"
        ? PNS.getShiftCounts(state.players)
        : { shift1: 0, shift2: 0, both: 0 };
    const limits =
      typeof PNS?.getTowerCalcShiftLimits === "function"
        ? PNS.getTowerCalcShiftLimits()
        : { shift1: 90, shift2: 90 };
    const usedIds = new Set();
    const calcCaptainIds = new Set();
    const detailsById = new Map();

    for (const sk of ["shift1", "shift2"]) {
      const plans = Array.isArray(res?.[sk]?.towerPlans)
        ? res[sk].towerPlans
        : [];
      plans.forEach((tp) => {
        const capId = String(tp?.captain?.id || "");
        if (capId) {
          usedIds.add(capId);
          calcCaptainIds.add(capId);
        }
        (tp?.pickedPlayers || []).forEach((p) => {
          const pid = String(p?.id || "");
          if (pid) usedIds.add(pid);
        });
        (tp?.notFitPlayers || []).forEach((p) => {
          const pid = String(p?.id || "");
          if (!pid) return;
          detailsById.set(pid, { status: t('not_fit', 'Не вліз'), sourceShift: sk });
        });
        (tp?.partialPlayers || []).forEach((p) => {
          const pid = String(p?.id || "");
          if (!pid) return;
          detailsById.set(pid, {
            status: `${t('partial_short', 'частково')} ${fm(p?.sent || 0)} / ${fm(p?.full || 0)}`,
            sourceShift: sk,
          });
        });
      });
    }

    const groups = { shift1: [], shift2: [], both: [] };
    for (const p of Array.isArray(state.players) ? state.players : []) {
      if (!p || !p.id) continue;
      const pid = String(p.id || "");
      if (calcCaptainIds.has(pid)) continue;
      if (p.assignment?.baseId) continue;
      const shift = String(
        (typeof PNS?.normalizeShiftValue === "function"
          ? PNS.normalizeShiftValue(p.shift || p.shiftLabel || "both")
          : p.shift || p.shiftLabel || "both") || "both",
      ).toLowerCase();
      if (!groups[shift]) continue;
      if (usedIds.has(pid) && !detailsById.has(pid)) continue;
      const extra = detailsById.get(pid) || {};
      groups[shift].push({
        playerId: pid,
        name: String(p.name || "—"),
        alliance: String(p.alliance || ""),
        role: String(p.role || ""),
        tier: String(p.tier || ""),
        march: Number(p.march || 0) || 0,
        status:
          extra.status ||
          (shift === "both" && tc.ignoreBoth
            ? t('both_not_counted', 'Група «Обидві» зараз не враховується')
            : t('not_used', 'Не використано')),
      });
    }

    Object.keys(groups).forEach((k) =>
      groups[k].sort(
        (a, b) =>
          Number(b.march || 0) - Number(a.march || 0) ||
          String(a.name || "").localeCompare(String(b.name || "")),
      ),
    );

    const section = (key, title, rows, meta) => `
    <section class="tower-calc-panel top-space">
      <div class="tower-calc-head"><h3 style="margin:0">${title}</h3><span class="muted small">${meta}</span></div>
      ${
        rows.length
          ? `
        <div class="helpers-table-wrap top-space" style="max-height:26vh;overflow:auto">
          <table class="mini-table tower-calc-tier-table">
            <thead><tr><th>${t('nickname', 'Нік')}</th><th>${t('alliance', 'Альянс')}</th><th>${t('role', 'Роль')}</th><th>${t('tier', 'Тір')}</th><th>${t('march', 'Марш')}</th><th>${t('status', 'Статус')}</th><th>${t('actions', 'Дії')}</th></tr></thead>
            <tbody>
              ${rows
                .map((r) => {
                  const disableS1 =
                    key !== "shift1" && counts.shift1 >= limits.shift1
                      ? " disabled"
                      : "";
                  const disableS2 =
                    key !== "shift2" && counts.shift2 >= limits.shift2
                      ? " disabled"
                      : "";
                  return `<tr>
                  <td>${calcEsc(r.name)}</td>
                  <td>${calcEsc(r.alliance || "—")}</td>
                  <td>${calcEsc(r.role || "—")}</td>
                  <td>${calcEsc(r.tier || "")}</td>
                  <td>${fm(r.march)}</td>
                  <td>${calcEsc(r.status || "")}</td>
                  <td>
                    <button type="button" class="btn btn-xs" data-calc-set-player-shift="${calcEsc(r.playerId)}" data-target-shift="shift1"${disableS1}>→ ${t('shift1', 'Зміна 1')}</button>
                    <button type="button" class="btn btn-xs" data-calc-set-player-shift="${calcEsc(r.playerId)}" data-target-shift="shift2"${disableS2}>→ ${t('shift2', 'Зміна 2')}</button>
                    <button type="button" class="btn btn-xs" data-calc-set-player-shift="${calcEsc(r.playerId)}" data-target-shift="both">→ ${t('both', 'Обидві')}</button>
                  </td>
                </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>`
          : `<div class="tower-calc-placeholder muted small">${t('empty_short', 'Порожньо')}</div>`
      }
    </section>`;

    out.innerHTML = `
    <div class="muted small"><strong>${t('reserve_and_outside', 'Резерв і гравці поза турелями')}</strong> · ${t('shift1', 'Зміна 1')}: ${fm(groups.shift1.length)} · ${t('shift2', 'Зміна 2')}: ${fm(groups.shift2.length)} · ${t('both', 'Обидві')}: ${fm(groups.both.length)}</div>
    ${section("shift1", t('shift1', 'Зміна 1'), groups.shift1, `${t('players_short', 'гравців')}: ${fm(counts.shift1)} / ${fm(limits.shift1)}${counts.shift1 > limits.shift1 ? ` · ${t('over_limit', 'понад ліміт')}: ${fm(counts.shift1 - limits.shift1)}` : ""}`)}
    ${section("shift2", t('shift2', 'Зміна 2'), groups.shift2, `${t('players_short', 'гравців')}: ${fm(counts.shift2)} / ${fm(limits.shift2)}${counts.shift2 > limits.shift2 ? ` · ${t('over_limit', 'понад ліміт')}: ${fm(counts.shift2 - limits.shift2)}` : ""}`)}
    ${section("both", t('both', 'Обидві'), groups.both, `${t('players_short', 'гравців')}: ${fm(counts.both)}${tc.ignoreBoth ? ` · ${t('both_ignored_in_shifts', 'зараз не враховуються в змінах 1 і 2')}` : ""}`)}
    <div class="muted small top-space">${t('shift_move_hint', 'Кнопки нижче одразу переводять гравця в потрібну зміну та запускають перерахунок.')}</div>`;
  }

  function calcNormalizeRegisteredShift(value) {
    try {
      if (typeof PNS?.normalizeShiftValue === "function") {
        return PNS.normalizeShiftValue(value);
      }
    } catch {}
    const s = String(value || "")
      .trim()
      .toLowerCase();
    if (!s) return "unknown";
    if (
      /(both|all|1\s*[,/;+&-]\s*2|2\s*[,/;+&-]\s*1|обе|обидв|оба|две|any shift|будь-як)/i.test(
        s,
      )
    )
      return "both";
    if (
      /(?:^|)(?:shift|зміна|змiна|смена)\s*[-: ]*1(?:|$)|(?:^|)1(?:st)?\s*(?:shift|зміна|змiна|смена)?(?:|$)|перш|перша|перв|first/i.test(
        s,
      )
    )
      return "shift1";
    if (
      /(?:^|)(?:shift|зміна|змiна|смена)\s*[-: ]*2(?:|$)|(?:^|)2(?:nd)?\s*(?:shift|зміна|змiна|смена)?(?:|$)|друг|втор|second/i.test(
        s,
      )
    )
      return "shift2";
    return s === "shift1" || s === "shift2" || s === "both" ? s : "unknown";
  }

  function calcGetRegisteredShiftForPlayer(player) {
    try {
      if (typeof PNS?.getRegisteredShiftForPlayer === "function") {
        return PNS.getRegisteredShiftForPlayer(player);
      }
    } catch {}
    const rawCandidates = [
      player?.registeredShiftRaw,
      state?.importData?.mapping?.shift_availability && player?.raw
        ? player.raw[state.importData.mapping.shift_availability]
        : "",
      player?.registeredShift,
      player?.registeredShiftLabel,
    ]
      .map((v) => String(v || "").trim())
      .filter(Boolean);
    for (const raw of rawCandidates) {
      const norm = calcNormalizeRegisteredShift(raw);
      if (norm === "shift1" || norm === "shift2" || norm === "both")
        return norm;
    }
    return "unknown";
  }

  function calcComputeShiftRoleStats() {
    const out = {
      shift1: { total: 0, shooter: 0, rider: 0, fighter: 0 },
      shift2: { total: 0, shooter: 0, rider: 0, fighter: 0 },
      both: { total: 0, shooter: 0, rider: 0, fighter: 0 },
      unknown: { total: 0, shooter: 0, rider: 0, fighter: 0 },
      total: 0,
    };
    for (const p of Array.isArray(state.players) ? state.players : []) {
      if (!p) continue;
      const cur = String(
        (typeof PNS?.normalizeShiftValue === "function"
          ? PNS.normalizeShiftValue(p?.shift || p?.shiftLabel || "both")
          : p?.shift || p?.shiftLabel || "both") || "both",
      ).toLowerCase();
      const key = out[cur] ? cur : "unknown";
      out[key].total += 1;
      const r = roleNorm(p.role) || "";
      if (r && out[key][r] !== undefined) out[key][r] += 1;
      out.total += 1;
    }
    return out;
  }

  function calcUpdateShiftStatsUI(modalIn) {
    const modal = modalIn || document.getElementById("towerCalcModal");
    if (!modal) return;
    const s = calcComputeShiftRoleStats();
    const limits =
      typeof PNS?.getTowerCalcShiftLimits === "function"
        ? PNS.getTowerCalcShiftLimits()
        : { shift1: 90, shift2: 90 };
    const setText = (id, text) => {
      const el = modal.querySelector("#" + id) || document.getElementById(id);
      if (el) el.textContent = String(text);
    };
    setText("tcShift1Count", s.shift1.total);
    setText("tcShift2Count", s.shift2.total);
    setText("tcBothCount", s.both.total);
    setText(
      "tcShift1Roles",
      `${t('shooter_plural', 'Стрільці')} / ${t('fighter_plural', 'Бійці')} / ${t('rider_plural', 'Наїзники')}: ${s.shift1.shooter} / ${s.shift1.fighter} / ${s.shift1.rider}`,
    );
    setText(
      "tcShift2Roles",
      `${t('shooter_plural', 'Стрільці')} / ${t('fighter_plural', 'Бійці')} / ${t('rider_plural', 'Наїзники')}: ${s.shift2.shooter} / ${s.shift2.fighter} / ${s.shift2.rider}`,
    );
    setText(
      "tcBothRoles",
      `${t('shooter_plural', 'Стрільці')} / ${t('fighter_plural', 'Бійці')} / ${t('rider_plural', 'Наїзники')}: ${s.both.shooter} / ${s.both.fighter} / ${s.both.rider}`,
    );
    setText("tcTotalCount", s.total);

    const root =
      modal.querySelector("#towerCalcShiftBalance") ||
      document.getElementById("towerCalcShiftBalance");
    const cards = root?.querySelector(".tower-calc-shift-cards");
    if (cards) cards.style.display = "none";

    const pieces = [
      `${t('shift1', 'Зміна 1')}: ${s.shift1.total}/${limits.shift1} (${t('shooter_plural', 'Стрільці')}/${t('fighter_plural', 'Бійці')}/${t('rider_plural', 'Наїзники')} ${s.shift1.shooter}/${s.shift1.fighter}/${s.shift1.rider})`,
      `${t('shift2', 'Зміна 2')}: ${s.shift2.total}/${limits.shift2} (${t('shooter_plural', 'Стрільці')}/${t('fighter_plural', 'Бійці')}/${t('rider_plural', 'Наїзники')} ${s.shift2.shooter}/${s.shift2.fighter}/${s.shift2.rider})`,
      `${t('both', 'Обидві')}: ${s.both.total} (${t('shooter_plural', 'Стрільці')}/${t('fighter_plural', 'Бійці')}/${t('rider_plural', 'Наїзники')} ${s.both.shooter}/${s.both.fighter}/${s.both.rider})`,
    ];
    if (s.shift1.total > limits.shift1)
      pieces.push(`⚠ ${t('shift1', 'Зміна 1')} ${t('over_limit', 'понад ліміт')} ${t('by_word', 'на')} ${s.shift1.total - limits.shift1}`);
    if (s.shift2.total > limits.shift2)
      pieces.push(`⚠ ${t('shift2', 'Зміна 2')} ${t('over_limit', 'понад ліміт')} ${t('by_word', 'на')} ${s.shift2.total - limits.shift2}`);
    pieces.push(`${t('overall', 'Усього')}: ${s.total}`);
    setText("towerCalcShiftCountsLine", pieces.join(" · "));

    try {
      PNS.ensureTowerCalcShiftUi?.();
    } catch {}
  }

  function calcGetStrictShiftPoolCount(shiftKey, tc) {
    const sk =
      String(shiftKey || "").toLowerCase() === "shift2" ? "shift2" : "shift1";
    const captIds = new Set(
      ((tc && tc[sk]) || [])
        .map((r) => String(r?.captainId || ""))
        .filter(Boolean),
    );
    let n = 0;
    for (const p of Array.isArray(state.players) ? state.players : []) {
      if (!p || !p.id) continue;
      const ps = String(p.shift || p.shiftLabel || "both").toLowerCase();
      if (ps !== sk) continue;
      if (captIds.has(String(p.id))) continue;
      n += 1;
    }
    return n;
  }

  function calcAutoSlotsForShift(shiftKey) {
    const modal = document.getElementById("towerCalcModal");
    if (!modal) return false;
    const sk =
      String(shiftKey || "").toLowerCase() === "shift2" ? "shift2" : "shift1";
    const tc = calcWriteRowsToState(modal);
    const ig = modal.querySelector("#towerCalcIgnoreBoth");
    try {
      localStorage.setItem("pns_tower_calc_state", JSON.stringify(tc));
    } catch {}
    try {
      calcUpdateShiftStatsUI(modal);
    } catch {}
    const slots = calcGetTowerSlotsForShift(sk);
    const eligible = [];
    for (let i = 0; i < 5; i++) {
      const row = (tc[sk] || [])[i] || {};
      const capId = String(row?.captainId || "");
      const baseId = String(slots?.[i]?.baseId || "");
      if (!capId) {
        row.helpers = 0;
        continue;
      }
      if (baseId && calcIsTowerLocked(baseId)) {
        row.helpers = 0;
        continue;
      }
      eligible.push(i);
    }
    const poolCount = calcGetStrictShiftPoolCount(sk, tc);
    if (!eligible.length) {
      try {
        localStorage.setItem("pns_tower_calc_state", JSON.stringify(tc));
      } catch {}
      renderTowerCalcModal();
      return true;
    }
    const per = Math.floor(poolCount / eligible.length);
    let rem = poolCount - per * eligible.length;
    for (const idx of eligible) {
      const plus = rem > 0 ? 1 : 0;
      (tc[sk][idx] || {}).helpers = per + plus;
      if (rem > 0) rem -= 1;
    }
    try {
      localStorage.setItem("pns_tower_calc_state", JSON.stringify(tc));
    } catch {}
    renderTowerCalcModal();
    return true;
  }

  function calcAutoFitTowersStrict() {
    const modal = document.getElementById("towerCalcModal");
    if (!modal) return false;
    const ig = modal.querySelector("#towerCalcIgnoreBoth");
    const tcKeep = getCalcState();
    if (ig) ig.checked = !!tcKeep.ignoreBoth;
    try {
      localStorage.setItem("pns_tower_calc_state", JSON.stringify(tcKeep));
    } catch {}
    calcAutoSlotsForShift("shift1");
    calcAutoSlotsForShift("shift2");
    computeTowerCalcResults();
    return true;
  }

  function renderTowerCalcModal() {
    const modal = ensureTowerCalcModal();
    if (!modal) return null;
    const tc = calcLoadStateFromLS();
    const pool = getCalcCaptainPool();
    const opt = (selectedId) =>
      [`<option value="">${calcEsc(t('captain_option_placeholder', '— капітан —'))}</option>`]
        .concat(
          pool.map((p) => {
            const role = roleNorm(p.role) || "";
            const shift = String(p.shiftLabel || p.shift || "both");
            return `<option value="${calcEsc(p.id)}" ${String(selectedId || "") === String(p.id) ? "selected" : ""}>${calcEsc(p.name)} · ${calcEsc(typeof window.PNS?.roleLabel === "function" ? window.PNS.roleLabel(role || p.role || "", false) : (role || p.role || ""))} · ${calcEsc(typeof window.PNS?.shiftLabel === "function" ? window.PNS.shiftLabel(shift) : shift)} · ралі ${Number(p.rally || 0).toLocaleString("en-US")}</option>`;
          }),
        )
        .join("");

    const rowHtml = (shiftKey, rows) =>
      rows
        .slice(0, 5)
        .map((r, idx) => {
          const p = pool.find((x) => String(x.id) === String(r.captainId));
          const troop = String(
            r.troop || roleNorm(p?.role) || "fighter",
          ).toLowerCase();
          const helpersVal = Math.max(
            0,
            Number(r?.helpers ?? r?.rally ?? 15) || 15,
          );
          return `
        <div class="tower-calc-row" data-calc-row data-calc-shift="${shiftKey}" data-row-index="${idx}">
          <select data-calc-captain>${opt(r.captainId)}</select>
          <select data-calc-troop>
            <option value="fighter" ${troop === "fighter" ? "selected" : ""}>${calcEsc(t('fighter_plural', 'Бійці'))}</option>
            <option value="rider" ${troop === "rider" ? "selected" : ""}>${calcEsc(t('rider_plural', 'Наїзники'))}</option>
            <option value="shooter" ${troop === "shooter" ? "selected" : ""}>${calcEsc(t('shooter_plural', 'Стрільці'))}</option>
          </select>
          <input data-calc-helpers type="number" min="0" placeholder="${calcEsc(t('players_placeholder', 'Гравці'))}" value="${calcEsc(String(helpersVal))}" />
        </div>`;
        })
        .join("");

    const grid = modal.querySelector("#towerCalcGrid");
    if (grid) {
      grid.innerHTML = `
        <div class="tower-calc-inline-shell">
          <aside class="tower-picker-list" id="towerCalcInlineList"></aside>
          <section class="tower-picker-detail" id="towerCalcInlineDetail"></section>
        </div>
        <div class="tower-calc-inline-results" style="display:none">
          <div class="tower-calc-results" id="towerCalcOutShift1"></div>
          <div class="tower-calc-results" id="towerCalcOutShift2"></div>
        </div>`;
    }
    const noCross = modal.querySelector("#towerCalcNoCrossShift");
    if (noCross) noCross.checked = !!tc.noCrossShift;
    const both50 = modal.querySelector("#towerCalcBoth50");
    if (both50) both50.checked = !!tc.both50;
    const igBoth = modal.querySelector("#towerCalcIgnoreBoth");
    if (igBoth) igBoth.checked = !!tc.ignoreBoth;
    const minHOn = modal.querySelector("#towerCalcMinHelpersOn");
    if (minHOn) minHOn.checked = !!tc.minHelpersPerTower;
    const minHCount = modal.querySelector("#towerCalcMinHelpersCount");
    if (minHCount)
      minHCount.value = String(
        Math.max(1, Math.min(30, Number(tc.minHelpersCount || 10) || 10)),
      );
    const cm = modal.querySelector("#towerCalcCompactMode");
    if (cm) cm.checked = !!tc.compactMode;
    const modeSel = modal.querySelector("#towerCalcModeUi");
    if (modeSel) modeSel.value = tc.uiMode || "assisted";
    const applyModeSel = modal.querySelector("#towerCalcApplyModeUi");
    if (applyModeSel) applyModeSel.value = tc.uiApplyMode || "topup";
    modal.classList.toggle("is-compact", !!tc.compactMode);
    calcApplyTierTargetInputsState(modal, tc);
    calcApplyMainTabUI(modal, tc.mainTab || "setup");
    calcApplyActiveTabUI(modal, tc.activeTab || "shift1");
    calcUpdateShiftStatsUI(modal);

    computeTowerCalcResults();
    calcRenderOverflowPanel(modal, state.towerCalcLastResults);
    try {
      calcRenderInlineTowerSettings(modal);
    } catch {}
    try {
      calcRenderLiveFinalBoard(modal);
    } catch {}
    return modal;
  }

  function calcSetInlineSelectedBaseId(shiftKey, baseId) {
    const tc = getCalcState();
    const sk =
      String(shiftKey || "").toLowerCase() === "shift2" ? "shift2" : "shift1";
    tc.inlineTowerSelected = tc.inlineTowerSelected || {};
    tc.inlineTowerSelected[sk] = String(baseId || "");
    try {
      localStorage.setItem("pns_tower_calc_state", JSON.stringify(tc));
    } catch {}
    return tc.inlineTowerSelected[sk];
  }

  function calcGetInlineSelectedBaseId(shiftKey) {
    const tc = getCalcState();
    const sk =
      String(shiftKey || "").toLowerCase() === "shift2" ? "shift2" : "shift1";
    const current = String(tc?.inlineTowerSelected?.[sk] || "");
    if (current) return current;
    const bases = getCalcTowerBaseOrder();
    return String(bases?.[0]?.id || "");
  }

  function calcHelperEffectiveMarchForShift(baseLike, player, shiftKey) {
    if (!player) return 0;
    const raw = Math.max(0, Number(player.march || 0) || 0);
    try {
      if (
        baseLike?.captainId &&
        String(baseLike.captainId) === String(player.id)
      )
        return raw;
    } catch {}
    try {
      const ov = PNS.getTowerMarchOverride?.(
        baseLike?.id,
        player?.id,
        shiftKey,
      );
      if (Number.isFinite(ov) && ov >= 0) return Math.max(0, Number(ov) || 0);
    } catch {}
    const cap = Math.max(
      0,
      Number(
        baseLike?.tierMinMarch?.[String(player.tier || "").toUpperCase()] || 0,
      ) || 0,
    );
    return cap > 0 ? Math.min(raw, cap) : raw;
  }

  function calcDistributeGroupMarch(group, limitById, remaining) {
    const safeRemaining = Math.max(0, Math.floor(Number(remaining || 0) || 0));
    const assignedById = {};
    let rest = safeRemaining;
    const active = [];
    for (const p of group || []) {
      const pid = String(p?.id || "");
      const maxAllowed = Math.max(
        0,
        Math.floor(Number(limitById?.[pid] || 0) || 0),
      );
      assignedById[pid] = 0;
      if (pid && maxAllowed > 0) active.push({ pid, left: maxAllowed });
    }
    while (active.length && rest > 0) {
      const share = Math.max(1, Math.floor(rest / active.length));
      let consumed = 0;
      const next = [];
      for (const item of active) {
        const take = Math.min(item.left, share, rest - consumed);
        if (take > 0) {
          assignedById[item.pid] = Math.max(
            0,
            Number(assignedById[item.pid] || 0) + take,
          );
          item.left -= take;
          consumed += take;
        }
        if (item.left > 0) next.push(item);
        if (consumed >= rest) break;
      }
      if (consumed <= 0) break;
      rest = Math.max(0, rest - consumed);
      active.length = 0;
      for (const item of next) active.push(item);
    }
    return {
      assignedById,
      used: Math.max(0, safeRemaining - rest),
      free: rest,
    };
  }

  function calcRecalculateTowerComposition(baseId, shiftKey) {
    const base = state.baseById?.get?.(String(baseId || ""));
    const sk = String(shiftKey || "shift1").toLowerCase() === "shift2" ? "shift2" : "shift1";
    if (!base) return { ok: false, reason: t('tower_not_found', 'Турель не знайдено.') };

    const stats = calcTowerStatsForShiftBase(base, sk);
    const helpers = Array.isArray(stats.helpers) ? stats.helpers.slice() : [];
    const helperRoom = Math.max(0, Math.floor(Number(stats.rallySize || 0) || 0));
    const tierOrder = ["T14", "T13", "T12", "T11", "T10", "T9"];
    const assignedById = {};
    let remaining = helperRoom;

    for (const tierKey of tierOrder) {
      const tierPlayers = helpers.filter(
        (p) => String(p?.tier || "").toUpperCase() === tierKey,
      );
      if (!tierPlayers.length) continue;

      const tierCap = Math.max(
        0,
        Number(stats?.rule?.tierMinMarch?.[tierKey] || 0) || 0,
      );
      const limitById = {};
      for (const p of tierPlayers) {
        const pid = String(p?.id || "");
        const raw = Math.max(0, Math.floor(Number(p?.march || 0) || 0));
        limitById[pid] = tierCap > 0 ? Math.min(raw, tierCap) : raw;
      }

      const totalWanted = Object.values(limitById).reduce(
        (sum, v) => sum + (Math.max(0, Number(v || 0)) || 0),
        0,
      );
      let result;
      if (totalWanted <= remaining) {
        result = { assignedById: limitById, used: totalWanted, free: Math.max(0, remaining - totalWanted) };
      } else {
        result = calcDistributeGroupMarch(tierPlayers, limitById, remaining);
      }

      for (const p of tierPlayers) {
        const pid = String(p?.id || "");
        assignedById[pid] = Math.max(0, Math.floor(Number(result.assignedById?.[pid] || 0) || 0));
      }
      remaining = Math.max(0, result.free);
    }

    for (const p of helpers) {
      const pid = String(p?.id || "");
      const raw = Math.max(0, Math.floor(Number(p?.march || 0) || 0));
      const planned = Math.max(0, Math.floor(Number(assignedById?.[pid] || 0) || 0));
      try {
        if (planned >= raw) PNS.clearTowerMarchOverride?.(baseId, pid, sk);
        else PNS.setTowerMarchOverride?.(baseId, pid, planned, sk);
      } catch {}
    }

    try { calcRenderInlineTowerSettings(document.getElementById("towerCalcModal")); } catch {}
    try { calcRenderLiveFinalBoard(document.getElementById("towerCalcModal")); } catch {}

    return {
      ok: true,
      helperRoom,
      used: Math.max(0, helperRoom - remaining),
      free: remaining,
      helpers: helpers.length,
      assignedById,
    };
  }

  function calcTowerStatsForShiftBase(base, shiftKey) {
    const slots = calcGetTowerSlotsForShift(shiftKey);
    const slot = slots.find(
      (s) => String(s?.baseId || "") === String(base?.id || ""),
    ) || {
      baseId: String(base?.id || ""),
      title: String(base?.title || base?.id || ""),
      captainId: "",
      helperIds: [],
      role: base?.role || null,
    };
    const rule =
      typeof PNS.getBaseTowerRule === "function"
        ? PNS.getBaseTowerRule(String(base?.id || ""), { shift: shiftKey }) ||
          {}
        : {};
    const baseLike = {
      id: String(base?.id || ""),
      title: String(base?.title || base?.id || ""),
      captainId: String(slot?.captainId || ""),
      helperIds: Array.isArray(slot?.helperIds) ? slot.helperIds.slice() : [],
      role: slot?.role || base?.role || null,
      maxHelpers: Number(rule?.maxHelpers ?? base?.maxHelpers ?? 29) || 29,
      tierMinMarch: {
        T14:
          Number(rule?.tierMinMarch?.T14 ?? base?.tierMinMarch?.T14 ?? 0) || 0,
        T13:
          Number(rule?.tierMinMarch?.T13 ?? base?.tierMinMarch?.T13 ?? 0) || 0,
        T12:
          Number(rule?.tierMinMarch?.T12 ?? base?.tierMinMarch?.T12 ?? 0) || 0,
        T11:
          Number(rule?.tierMinMarch?.T11 ?? base?.tierMinMarch?.T11 ?? 0) || 0,
        T10:
          Number(rule?.tierMinMarch?.T10 ?? base?.tierMinMarch?.T10 ?? 0) || 0,
        T9: Number(rule?.tierMinMarch?.T9 ?? base?.tierMinMarch?.T9 ?? 0) || 0,
      },
    };
    const captain = baseLike.captainId
      ? state.playerById?.get?.(baseLike.captainId)
      : null;
    const helpers = (
      Array.isArray(baseLike.helperIds) ? baseLike.helperIds : []
    )
      .map((id) => state.playerById?.get?.(id))
      .filter(Boolean);
    const captainMarch = Math.max(0, Number(captain?.march || 0) || 0);
    const rallySize = Math.max(0, Number(captain?.rally || 0) || 0);
    const helpersTotal = helpers.reduce(
      (s, pl) => s + calcHelperEffectiveMarchForShift(baseLike, pl, shiftKey),
      0,
    );
    const total = captainMarch + helpersTotal;
    const capacityTotal = captainMarch + rallySize;
    const free = Math.max(0, capacityTotal - total);
    return {
      captain,
      helpers,
      rule: {
        maxHelpers: baseLike.maxHelpers,
        tierMinMarch: { ...(baseLike.tierMinMarch || {}) },
      },
      captainMarch,
      rallySize,
      helpersTotal,
      total,
      capacityTotal,
      free,
      baseLike,
    };
  }

  function calcRenderInlineTowerSettings(modalIn) {
    const modal = modalIn || document.getElementById("towerCalcModal");
    if (!modal) return;
    const tc = getCalcState();
    const shiftKey =
      String(tc.activeTab || "shift1").toLowerCase() === "shift2"
        ? "shift2"
        : "shift1";
    const list = modal.querySelector("#towerCalcInlineList");
    const detail = modal.querySelector("#towerCalcInlineDetail");
    if (!list || !detail) return;
    const bases = getCalcTowerBaseOrder()
      .map((b) => state.baseById?.get?.(String(b?.id || "")) || b)
      .filter(Boolean);
    if (!bases.length) {
      list.innerHTML = "";
      detail.innerHTML = `<div class="muted">${t('turrets', 'Турелі')}: 0</div>`;
      return;
    }
    let selectedId = calcGetInlineSelectedBaseId(shiftKey);
    if (!bases.some((b) => String(b.id) === selectedId))
      selectedId = String(bases[0].id || "");
    calcSetInlineSelectedBaseId(shiftKey, selectedId);
    list.innerHTML = bases
      .map((base, idx) => {
        const stats = calcTowerStatsForShiftBase(base, shiftKey);
        const done = !!stats.captain;
        const playersCount =
          Number(done ? 1 : 0) + Number(stats.helpers.length || 0);
        const title = calcEsc(
          String(base.title || base.id || `${t('turret', 'Турель')} ${idx + 1}`)
            .split("/")[0]
            .trim(),
        );
        return `<button type="button" class="btn btn-sm tower-picker-item ${String(base.id) === selectedId ? "active" : ""} ${done ? "is-ready tower-done" : "is-not-ready"}" data-calc-inline-base="${calcEsc(base.id)}" data-calc-shift="${calcEsc(shiftKey)}"><div class="tower-item-row"><strong>${title}</strong><span class="tower-item-status" aria-hidden="true">${done ? "✓" : "!"}</span></div><span class="muted small">${done ? t('ready', 'Готова') : t('no_captain_short', 'Без капітана')} · <span class="tower-item-count ${done ? "is-ready" : "is-not-ready"}">${t('players_short', 'гравців')}: ${playersCount}</span></span></button>`;
      })
      .join("");
    const base = bases.find((b) => String(b.id) === selectedId) || bases[0];
    const stats = calcTowerStatsForShiftBase(base, shiftKey);
    const captain = stats.captain;
    const rule = stats.rule || {
      maxHelpers: Number(base.maxHelpers || 0) || 0,
      tierMinMarch: { ...(base.tierMinMarch || {}) },
    };
    const title = calcEsc(
      String(base.title || base.id || "")
        .split("/")[0]
        .trim(),
    );
    let caps = [];
    try {
      caps = MS.eligibleCaptainsForBase?.(base) || [];
    } catch {}
    const helperRows = stats.helpers
      .map((p) => {
        const eff = calcHelperEffectiveMarchForShift(
          stats.baseLike,
          p,
          shiftKey,
        );
        return `<tr><td>${calcEsc(p.name || "")}</td><td>${calcEsc(p.alliance || "")}</td><td>${calcEsc(typeof window.PNS?.roleLabel === "function" ? window.PNS.roleLabel(p.role || "", false) : (p.role || ""))}</td><td>${calcEsc(p.tier || "")}</td><td>${calcFmt(eff)}</td><td><button class="btn btn-xs" type="button" data-picker-edit-player="${calcEsc(p.id)}" data-picker-edit-base="${calcEsc(base.id)}">✎</button></td></tr>`;
      })
      .join("");
    detail.innerHTML = `
    <div class="stack tower-picker-scope" data-calc-inline-scope="${calcEsc(shiftKey)}">
      <h3>${title}</h3>
      <div class="picker-meta-row muted small"><span class="picker-meta-shift">${t('shift', 'Зміна')}: ${shiftLabel(shiftKey)}</span><label class="picker-only-captains"><input type="checkbox" id="pickerOnlyCaptains" ${state.towerPickerOnlyCaptains !== false ? "checked" : ""}/> ${t('only_captains', 'Тільки капітани')}</label><label class="picker-only-captains"><input type="checkbox" id="pickerMatchRegisteredShift" ${state.towerPickerMatchRegisteredShift !== false ? "checked" : ""}/> ${t('respect_player_shift', 'Враховувати зміну гравця')}</label><label class="picker-only-captains"><input type="checkbox" id="pickerNoMixTroops" ${state.towerPickerNoMixTroops !== false ? "checked" : ""}/> ${t('same_troop_only', 'Лише той самий тип військ')}</label><label class="picker-only-captains"><input type="checkbox" id="pickerNoCrossShiftDupes" ${state.towerPickerNoCrossShiftDupes === true ? 'checked' : ''}/> ${t('use_both', 'Використовувати «Обидві»')}</label></div>
      <div class="picker-topline top-space"><select id="towerPickerCaptainSelect" class="input-like" aria-label="${t('choose_captain', 'Вибрати капітана…')}"><option value="">${captain ? t('change_captain', 'Змінити капітана…') : t('choose_captain', 'Вибрати капітана…')}</option>${caps.map((p) => `<option value="${calcEsc(p.id)}" ${captain && String(captain.id) === String(p.id) ? "selected" : ""}>${calcEsc(String(p.name || ""))} · ${calcEsc(roleLabel(String(p.role || ""), false))} · ${calcEsc(shiftLabel(String(p.shiftLabel || p.shift || "")))} · ${Number(p.march || 0).toLocaleString("en-US")}${p.captainReady ? ` · ${t('captain_tag_short', 'КАП')}` : ""}</option>`).join("")}</select><div class="picker-actions"><button class="btn btn-sm" type="button" data-picker-set-captain="${calcEsc(base.id)}">${t('place_captain', 'Поставити капітана')}</button><button class="btn btn-sm" type="button" data-picker-autofill="${calcEsc(base.id)}">${t('auto_fill', 'Автозаповнення')}</button><button class="btn btn-sm" type="button" data-picker-clear-base="${calcEsc(base.id)}">${t('clear_turret', 'Очистити турель')}</button><button class="btn btn-sm" type="button" data-picker-save-board="${calcEsc(base.id)}">${t('save_turret_table', 'Зберегти таблицю турелі')}</button></div></div>
      <div class="limit-grid limit-grid-compact top-space"><div><span>${t('captain_march', 'Марш капітана')}</span><strong>${calcFmt(stats.captainMarch)}</strong></div><div><span>${t('rally_size', 'Розмір ралі')}</span><strong>${calcFmt(stats.rallySize)}</strong></div><div><span>${t('total_sum', 'Разом')}</span><strong>${calcFmt(stats.total)}</strong></div><div><span>${t('free_space', 'Вільне місце')}</span><strong>${calcFmt(stats.free)}</strong></div></div>
      <details class="tower-collapsible top-space" id="towerPickerLimitsBlock"><summary>${t('limits_by_tier', 'Налаштування турелі · ліміти по тірах')} (${t('march', 'Марш').toLowerCase()})</summary><div class="inner stack"><div class="picker-limits-head"><label><span class="muted small">${t('max_players', 'Макс. гравців')}</span><input id="pickerMaxHelpers" type="number" min="0" value="${Number(rule.maxHelpers || 0) || 0}" /></label><button class="btn btn-sm" type="button" data-picker-save-rule="${calcEsc(base.id)}">${t('save_limits', 'Зберегти ліміти')}</button><button class="btn btn-sm" type="button" data-picker-recalc-rule="${calcEsc(base.id)}">${t('recalc_composition', 'Перерахувати склад')}</button><button class="btn btn-sm" type="button" data-picker-reset-rule="${calcEsc(base.id)}">${t('reset_limits', 'Скинути ліміти')}</button></div><div class="row gap wrap">${["T14", "T13", "T12", "T11", "T10", "T9"].map((tierKey) => `<label><span class="muted small">${tierKey}</span><input type="number" min="0" data-picker-tier="${tierKey}" value="${Number(rule?.tierMinMarch?.[tierKey] || 0) || 0}" style="width:90px" /></label>`).join("")}</div><div class="muted small">${t('flexible_tier_note', '0 = гнучкий тір: бере повний марш, але якщо місця не вистачає — ділить залишок між гравцями цього тіру.')}</div></div></details>
      <details class="tower-collapsible" id="towerPickerManualBlock"><summary>${t('add_player_manually', 'Додати гравця вручну')}</summary><div class="inner stack"><div class="picker-manual-row"><input id="pickerManualSearch" list="pickerManualPlayerSuggestions" placeholder="${t('search_player_from_list', 'Пошук гравця (зі списку)')}" autocomplete="off" spellcheck="false" /><input id="pickerManualName" placeholder="${t('nickname_custom', 'Нік (можна свій, не зі списку)')}" autocomplete="off" /><datalist id="pickerManualPlayerSuggestions">${(
        state.players || []
      )
        .slice()
        .sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || "")),
        )
        .map(
          (p) =>
            `<option value="${calcEsc(String(p.name || ""))}" label="${calcEsc(String(p.alliance || ""))} · ${calcEsc(roleLabel(String(p.role || ""), false))} · ${calcEsc(String(p.tier || ""))} · ${Number(p.march || 0).toLocaleString("en-US")}"></option>`,
        )
        .join(
          "",
        )}</datalist><input id="pickerManualAlly" placeholder="${t('alliance', 'Альянс')}" /><select id="pickerManualRole"><option value="Fighter">${t('fighter', 'Боєць')}</option><option value="Shooter">${t('shooter', 'Стрілець')}</option><option value="Rider">${t('rider', 'Наїзник')}</option></select></div><div id="pickerManualHint" class="picker-manual-hint muted small"></div><div class="picker-manual-row2"><input id="pickerManualTier" placeholder="T14" /><input id="pickerManualMarch" placeholder="${t('march', 'Марш')}" type="number" min="0" /><input id="pickerManualRally" placeholder="${t('rally_size', 'Розмір ралі')}" type="number" min="0" /><button class="btn btn-sm" type="button" data-picker-add-manual-captain="${calcEsc(base.id)}">${t('place_captain', 'Поставити капітана')}</button><button class="btn btn-sm" type="button" data-picker-add-manual="${calcEsc(base.id)}">${t('add_player_manually', 'Додати гравця вручну')}</button></div></div></details>
      <div class="panel subpanel" style="padding:10px"><div class="row gap wrap" style="justify-content:space-between"><strong>${t('players_in_turret_title', 'Гравці в турелі')}</strong><span class="muted small">${captain ? t('captain_and_players', 'Капітан і гравці') : t('no_captain', 'Без капітана')}</span></div><div class="helpers-table-wrap top-space"><table class="mini-table"><thead><tr><th>${t('player', 'Гравець')}</th><th>${t('ally', 'Альянс')}</th><th>${t('role', 'Роль')}</th><th>${t('tier', 'Тір')}</th><th>${t('march', 'Марш')}</th><th>✎</th></tr></thead><tbody>${captain ? `<tr><td>${calcEsc(captain.name || "")}</td><td>${calcEsc(captain.alliance || "")}</td><td>${calcEsc(roleLabel(captain.role || "", false))}</td><td>${calcEsc(captain.tier || "")}</td><td>${calcFmt(stats.captainMarch)}</td><td><button class="btn btn-xs" type="button" data-picker-edit-player="${calcEsc(captain.id)}" data-picker-edit-base="${calcEsc(base.id)}">✎</button></td></tr>` : ""}${helperRows}${!captain && !stats.helpers.length ? `<tr><td colspan="6" class="muted">${t('no_assigned_players', 'Немає призначених гравців')}</td></tr>` : ""}</tbody></table></div></div>
    </div>`;
  }

  function calcBuildBoardHtmlForShift(shiftKey) {
    const title = shiftLabel(shiftKey);
    const bases = getCalcTowerBaseOrder()
      .map((b) => state.baseById?.get?.(String(b?.id || "")) || b)
      .filter(Boolean);
    const cols = bases
      .map((base, idx) => {
        const stats = calcTowerStatsForShiftBase(base, shiftKey);
        const captain = stats.captain;
        const helpers = stats.helpers
          .slice()
          .sort(
            (a, b) =>
              Number(b.tierRank || 0) - Number(a.tierRank || 0) ||
              Number(b.march || 0) - Number(a.march || 0) ||
              String(a.name || "").localeCompare(String(b.name || "")),
          );
        const roleKey = String(roleNorm(captain?.role) || "").toLowerCase();
        const roleText = captain
          ? calcEsc(roleLabel(String(captain.role || ""), true))
          : t('type_defined_by_captain', 'Тип визначається капітаном');
        const themeCls = captain ? " " + roleKey + "-theme" : " is-auto";
        const titleShort = calcEsc(
          typeof window.PNS?.towerLabel === "function"
            ? window.PNS.towerLabel(String(base.title || base.id || `${t('turret', 'Турель')} ${idx + 1}`))
            : towerLabel(String(base.title || base.id || `${t('turret', 'Турель')} ${idx + 1}`)),
        );
        const rows = [];
        if (captain)
          rows.push(
            `<li class="captain-row"><span>${calcEsc(String(captain.name || ""))}</span><em>${calcEsc(String(captain.alliance || ""))}</em><b>${calcEsc(String(captain.tier || ""))}</b><strong style="color:#9a5a00;">${calcFmt(stats.captainMarch)}</strong></li>`,
          );
        helpers.forEach((pl) => {
          const eff = calcHelperEffectiveMarchForShift(
            stats.baseLike,
            pl,
            shiftKey,
          );
          rows.push(
            `<li class="helper-row"><span>${calcEsc(String(pl.name || ""))}</span><em>${calcEsc(String(pl.alliance || ""))}</em><b>${calcEsc(String(pl.tier || ""))}</b><strong>${calcFmt(eff)}</strong></li>`,
          );
        });
        if (!rows.length)
          rows.push(`<li class="empty-row">${t('no_assigned_players', 'Немає призначених гравців')}</li>`);
        return `<section class="board-col${themeCls}" data-shift="${calcEsc(shiftKey)}" data-base-id="${calcEsc(String(base.id || ""))}"><header><h4>${titleShort}</h4><div class="board-sub${captain ? "" : " is-auto"}">${captain ? roleText : t('type_defined_by_captain', 'Тип визначається капітаном')}</div><div class="board-cap"><span class="cap-total">${calcFmt(stats.capacityTotal)}</span><span class="cap-free">${calcFmt(stats.free)}</span><span class="cap-used">${calcFmt(stats.total)}</span></div></header><ul>${rows.join("")}</ul></section>`;
      })
      .join("");
    return `<div class="board-sheet"><div class="board-title">${title} / ${shiftKey === 'shift1' ? t('first_half', 'Перша половина') : t('second_half', 'Друга половина')}</div><div class="board-grid">${cols}</div></div>`;
  }

  function calcSetPreviewShift(shiftKey) {
    const tc = getCalcState();
    tc.previewShift =
      String(shiftKey || "").toLowerCase() === "shift1" ? "shift1" : "shift2";
    try {
      localStorage.setItem("pns_tower_calc_state", JSON.stringify(tc));
    } catch {}
    return tc.previewShift;
  }

  function calcRenderLiveFinalBoard(modalIn) {
    const modal = modalIn || document.getElementById("towerCalcModal");
    const out = modal?.querySelector?.("#towerCalcGlobalOut");
    if (!out) return;
    const tc = getCalcState();
    const shiftKey =
      String(tc.previewShift || "shift2").toLowerCase() === "shift1"
        ? "shift1"
        : "shift2";
    out.innerHTML = `
    <div class="tower-calc-board-preview">
      <div class="row gap wrap board-head-actions tower-calc-preview-toolbar">
        <div class="row gap">
          <button class="btn btn-sm board-shift-tab ${shiftKey === "shift1" ? "active" : ""}" type="button" data-calc-preview-shift="shift1">${shiftLabel("shift1")}</button>
          <button class="btn btn-sm board-shift-tab ${shiftKey === "shift2" ? "active" : ""}" type="button" data-calc-preview-shift="shift2">${shiftLabel("shift2")}</button>
        </div>
        <button class="btn btn-sm" type="button" data-calc-preview-export="1">${t('export_png', 'Завантажити PNG')}</button>
        <button class="btn btn-sm" type="button" data-calc-preview-share="1">${t('final_plan_share', 'Поділитися')}</button>
      </div>
      <div id="towerCalcPreviewStatus" class="muted small">${t('final_plan_status', 'Фінальний план')} · ${shiftLabel(shiftKey)}</div>
      <div id="towerCalcBoardPreviewSheet">${calcBuildBoardHtmlForShift(shiftKey)}</div>
    </div>`;
  }

  async function calcExportPreviewBoardPng() {
    const target =
      document.querySelector("#towerCalcBoardPreviewSheet .board-sheet") ||
      document.querySelector("#towerCalcBoardPreviewSheet");
    const status = document.getElementById("towerCalcPreviewStatus");
    if (!target) {
      alert(t('no_final_plan_export', 'Немає фінального плану для експорту.'));
      return false;
    }
    if (typeof window.html2canvas !== "function") {
      alert(t('html2canvas_missing', 'html2canvas не завантажився.'));
      return false;
    }
    const tc = getCalcState();
    const shiftKey =
      String(tc.previewShift || "shift2").toLowerCase() === "shift1"
        ? "shift1"
        : "shift2";
    const label = shiftLabel(shiftKey);
    try {
      if (status) status.textContent = `${t('preparing_png', 'Готуємо PNG')} · ${label}…`;
      const canvas = await window.html2canvas(target, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const a = document.createElement("a");
      a.download = `pns-final-board-${shiftKey}.png`;
      a.href = canvas.toDataURL("image/png");
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (status) status.textContent = `${t('png_saved', 'PNG збережено')} · ${label}.`;
      return true;
    } catch (err) {
      console.error(err);
      if (status) status.textContent = t('png_failed', 'Не вдалося згенерувати PNG.');
      alert(t('png_failed', 'Не вдалося згенерувати PNG.'));
      return false;
    }
  }

  async function calcSharePreviewBoard() {
    const target =
      document.querySelector("#towerCalcBoardPreviewSheet .board-sheet") ||
      document.querySelector("#towerCalcBoardPreviewSheet");
    const tc = getCalcState();
    const shiftKey =
      String(tc.previewShift || "shift2").toLowerCase() === "shift1"
        ? "shift1"
        : "shift2";
    const label = shiftLabel(shiftKey);
    const status = document.getElementById("towerCalcPreviewStatus");
    if (!target) {
      alert(t('no_final_plan_share', 'Немає фінального плану для поширення.'));
      return false;
    }
    try {
      if (status) status.textContent = `${t('preparing_share', 'Готуємо поширення')} · ${label}…`;
      if (typeof window.html2canvas === "function") {
        const canvas = await window.html2canvas(target, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
        });
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (blob) {
          if (navigator.share && window.File) {
            const file = new File([blob], `pns-final-board-${shiftKey}.png`, {
              type: "image/png",
            });
            const canShareFiles =
              typeof navigator.canShare === "function"
                ? navigator.canShare({ files: [file] })
                : true;
            if (canShareFiles) {
              await navigator.share({
                title: `P&S ${t('final_plan', 'Фінальний план')}`,
                text: `${t('final_plan', 'Фінальний план')} ${label}`,
                files: [file],
              });
              if (status) status.textContent = `${t('board_shared', 'План поширено')} · ${label}.`;
              return true;
            }
          }
          if (
            navigator.clipboard &&
            navigator.clipboard.write &&
            window.ClipboardItem
          ) {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            if (status)
              status.textContent = `${t('board_copied_image', 'PNG план скопійовано в буфер')} · ${label}.`;
            return true;
          }
        }
      }
      const boardUrl = location.href.split("#")[0] + "#board-modal";
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(boardUrl);
        if (status) status.textContent = `${t('link_copied', 'Посилання скопійовано')} · ${label}.`;
        return true;
      }
      alert(boardUrl);
      if (status) status.textContent = `${t('link_shown', 'Посилання показано')} · ${label}.`;
      return true;
    } catch (err) {
      console.error(err);
      if (status) status.textContent = t('share_board_failed', 'Не вдалося поширити фінальний план.');
      return false;
    }
  }

  function calcPickHelpersRoundRobin(players, caps) {
    const out = Array.isArray(caps) ? caps.map(() => []) : [];
    if (
      !Array.isArray(players) ||
      !players.length ||
      !Array.isArray(caps) ||
      !caps.length
    )
      return out;
    const targets = caps.map((c) =>
      Math.max(0, Number(c?.helpersWanted || 0) || 0),
    );
    const ranks = caps.map((c) =>
      Math.max(0, Number(c?.helperCapacity || 0) || 0),
    );
    const pickedCounts = new Array(caps.length).fill(0);
    let anyNeed = true;
    let i = 0;
    while (i < players.length && anyNeed) {
      anyNeed = false;
      const order = caps
        .map((c, idx) => ({
          idx,
          needSlots: Math.max(0, targets[idx] - pickedCounts[idx]),
          ratio: targets[idx] > 0 ? pickedCounts[idx] / targets[idx] : 1,
          cap: ranks[idx],
        }))
        .filter((x) => x.needSlots > 0)
        .sort((a, b) => a.ratio - b.ratio || b.cap - a.cap || a.idx - b.idx);
      for (const o of order) {
        if (i >= players.length) break;
        out[o.idx].push(players[i]);
        pickedCounts[o.idx] += 1;
        i += 1;
      }
      anyNeed = order.length > 0;
    }
    return out;
  }

  function calcAllocateTroopTowersFair(
    selectedCaps,
    poolPlayers,
    globalCfg,
    lockedByTowerIdx,
  ) {
    const byIdx = new Map();
    if (!Array.isArray(selectedCaps) || !selectedCaps.length) return byIdx;
    const lockedMap =
      lockedByTowerIdx instanceof Map ? lockedByTowerIdx : new Map();

    const allPool = (
      Array.isArray(poolPlayers) ? poolPlayers.slice() : []
    ).sort(
      (a, b) =>
        calcTierRank(b.tier) - calcTierRank(a.tier) ||
        Number(b.march || 0) - Number(a.march || 0) ||
        String(a.name || "").localeCompare(String(b.name || "")),
    );

    const lockedIds = new Set();
    for (const arr of lockedMap.values()) {
      for (const p of Array.isArray(arr) ? arr : []) {
        const pid = String(p?.id || "");
        if (pid) lockedIds.add(pid);
      }
    }
    const sortedPool = allPool.filter(
      (p) => !lockedIds.has(String(p?.id || "")),
    );

    const capsForPick = selectedCaps.map((cap) => {
      const localLocked = Array.isArray(lockedMap.get(Number(cap.idx)))
        ? lockedMap.get(Number(cap.idx))
        : [];
      const lockedCount = localLocked.length;
      return {
        ...cap,
        _lockedPlayers: localLocked,
        _lockedIds: new Set(
          localLocked.map((p) => String(p?.id || "")).filter(Boolean),
        ),
        _helpersWantedOrig: Math.max(0, Number(cap.helpersWanted || 0) || 0),
        helpersWanted: Math.max(
          0,
          Math.max(0, Number(cap.helpersWanted || 0) || 0) - lockedCount,
        ),
      };
    });

    const buildAllocForCap = (cap, pickedPlayersInput) => {
      const pickedPlayers = Array.isArray(pickedPlayersInput)
        ? pickedPlayersInput.slice()
        : [];
      const pickedIds = new Set(
        pickedPlayers.map((p) => String(p?.id || "")).filter(Boolean),
      );
      const dist = distributeCalcCapacityAcrossPicks(
        pickedPlayers,
        cap.helperCapacity,
        { tierTargets: globalCfg.tierTargets },
      );
      const alloc = {
        usedByTier: dist.usedByTier,
        pickedIds,
        pickedPlayers,
        assignedById: dist.assignedById || {},
        notFitPlayers: Array.isArray(dist.notFitPlayers)
          ? dist.notFitPlayers
          : [],
        partialPlayers: Array.isArray(dist.partialPlayers)
          ? dist.partialPlayers
          : [],
        helperSlotsRequested: Math.max(
          0,
          Number(cap._helpersWantedOrig || cap.helpersWanted || 0) || 0,
        ),
        helpersUsed: Math.max(0, Number(dist.helpersUsed || 0)),
        usedMarch: Math.max(0, Number(dist.usedMarch || 0)),
        capacity: Math.max(0, Number(cap.helperCapacity || 0)),
        capLeft: Math.max(0, Number(dist.capLeft || 0)),
        slotsLeft: Math.max(
          0,
          Math.max(
            0,
            Number(cap._helpersWantedOrig || cap.helpersWanted || 0) || 0,
          ) - Math.max(0, Number(dist.helpersUsed || 0)),
        ),
        recTierMinMarch: dist.recTierMinMarch,
        recTierText: dist.recTierText,
        lockedPicked: Math.max(
          0,
          Number((cap._lockedPlayers || []).length || 0),
        ),
        _lockedIdSet:
          cap._lockedIds instanceof Set ? new Set(cap._lockedIds) : new Set(),
      };
      return alloc;
    };

    const picksPerTower = calcPickHelpersRoundRobin(sortedPool, capsForPick);

    // Initial fair picks + capacity allocation
    for (let localIdx = 0; localIdx < capsForPick.length; localIdx++) {
      const cap = capsForPick[localIdx];
      const lockedPlayers = Array.isArray(cap._lockedPlayers)
        ? cap._lockedPlayers.slice()
        : [];
      const pickedPlayersExtra = Array.isArray(picksPerTower[localIdx])
        ? picksPerTower[localIdx]
        : [];
      const pickedPlayers = [...lockedPlayers, ...pickedPlayersExtra];
      byIdx.set(Number(cap.idx), buildAllocForCap(cap, pickedPlayers));
    }

    const ratioGap = (allocA, allocB) => {
      const tA = Math.max(1, Number(allocA?.helperSlotsRequested || 0) || 1);
      const tB = Math.max(1, Number(allocB?.helperSlotsRequested || 0) || 1);
      return Math.abs(
        Math.max(0, Number(allocA?.helpersUsed || 0)) / tA -
          Math.max(0, Number(allocB?.helpersUsed || 0)) / tB,
      );
    };

    const pairScore = (allocA, allocB) => ({
      zeroPenalty:
        (Math.max(0, Number(allocA?.helpersUsed || 0)) === 0 ? 1 : 0) +
        (Math.max(0, Number(allocB?.helpersUsed || 0)) === 0 ? 1 : 0),
      slotsLeft:
        Math.max(0, Number(allocA?.slotsLeft || 0)) +
        Math.max(0, Number(allocB?.slotsLeft || 0)),
      gap: ratioGap(allocA, allocB),
      usedMarch:
        Math.max(0, Number(allocA?.usedMarch || 0)) +
        Math.max(0, Number(allocB?.usedMarch || 0)),
      capLeft:
        Math.max(0, Number(allocA?.capLeft || 0)) +
        Math.max(0, Number(allocB?.capLeft || 0)),
    });

    const isBetterPairScore = (next, prev) => {
      if (!prev) return true;
      if (next.zeroPenalty !== prev.zeroPenalty)
        return next.zeroPenalty < prev.zeroPenalty;
      if (next.slotsLeft !== prev.slotsLeft)
        return next.slotsLeft < prev.slotsLeft;
      if (Math.abs(next.gap - prev.gap) > 0.02) return next.gap < prev.gap;
      if (next.usedMarch !== prev.usedMarch)
        return next.usedMarch > prev.usedMarch;
      if (next.capLeft !== prev.capLeft) return next.capLeft < prev.capLeft;
      return false;
    };

    // v7.1b local optimization: move/swap helpers between same-troop towers for better fairness.
    if (capsForPick.length > 1) {
      const capByIdx = new Map(capsForPick.map((c) => [Number(c.idx), c]));
      const capOrder = capsForPick.map((c) => Number(c.idx));

      const getMovableCandidates = (cap, alloc) => {
        const lockedIdSet =
          alloc && alloc._lockedIdSet instanceof Set
            ? alloc._lockedIdSet
            : new Set();
        const arr = Array.isArray(alloc?.pickedPlayers)
          ? alloc.pickedPlayers.slice()
          : [];
        return arr
          .filter((p) => {
            const pid = String(p?.id || "");
            if (!pid) return false;
            if (lockedIdSet.has(pid)) return false;
            return true;
          })
          .sort((a, b) => {
            const aSent = Math.max(
              0,
              Number(alloc?.assignedById?.[String(a?.id || "")] || 0) || 0,
            );
            const bSent = Math.max(
              0,
              Number(alloc?.assignedById?.[String(b?.id || "")] || 0) || 0,
            );
            // Move weakest/least useful first to preserve top-tier contribution on donor.
            return (
              aSent - bSent ||
              calcTierRank(a?.tier) - calcTierRank(b?.tier) ||
              Number(a?.march || 0) - Number(b?.march || 0) ||
              String(a?.name || "").localeCompare(String(b?.name || ""))
            );
          });
      };

      const tryMoveOne = (donorIdx, recvIdx) => {
        const donorCap = capByIdx.get(Number(donorIdx));
        const recvCap = capByIdx.get(Number(recvIdx));
        const donorAlloc = byIdx.get(Number(donorIdx));
        const recvAlloc = byIdx.get(Number(recvIdx));
        if (!donorCap || !recvCap || !donorAlloc || !recvAlloc) return false;
        if (
          Math.max(0, Number(recvAlloc.slotsLeft || 0)) <= 0 &&
          Math.max(0, Number(recvAlloc.capLeft || 0)) <= 0
        )
          return false;
        const donorCandidates = getMovableCandidates(
          donorCap,
          donorAlloc,
        ).slice(0, 8);
        const prevScore = pairScore(donorAlloc, recvAlloc);

        for (const cand of donorCandidates) {
          const pid = String(cand?.id || "");
          if (!pid) continue;
          if (
            recvAlloc.pickedIds instanceof Set &&
            recvAlloc.pickedIds.has(pid)
          )
            continue;

          const donorPlayersNext = (donorAlloc.pickedPlayers || []).filter(
            (p) => String(p?.id || "") !== pid,
          );
          const recvPlayersNext = [...(recvAlloc.pickedPlayers || []), cand];

          const donorAllocNext = buildAllocForCap(donorCap, donorPlayersNext);
          const recvAllocNext = buildAllocForCap(recvCap, recvPlayersNext);
          const nextScore = pairScore(donorAllocNext, recvAllocNext);

          if (isBetterPairScore(nextScore, prevScore)) {
            byIdx.set(Number(donorIdx), donorAllocNext);
            byIdx.set(Number(recvIdx), recvAllocNext);
            return true;
          }
        }
        return false;
      };

      const trySwapOne = (aIdx, bIdx) => {
        const aCap = capByIdx.get(Number(aIdx));
        const bCap = capByIdx.get(Number(bIdx));
        const aAlloc = byIdx.get(Number(aIdx));
        const bAlloc = byIdx.get(Number(bIdx));
        if (!aCap || !bCap || !aAlloc || !bAlloc) return false;

        const aCandidates = getMovableCandidates(aCap, aAlloc).slice(0, 6);
        const bCandidates = getMovableCandidates(bCap, bAlloc).slice(0, 6);
        if (!aCandidates.length || !bCandidates.length) return false;

        const prevScore = pairScore(aAlloc, bAlloc);
        let best = null;

        for (const pa of aCandidates) {
          const paId = String(pa?.id || "");
          if (!paId) continue;
          for (const pb of bCandidates) {
            const pbId = String(pb?.id || "");
            if (!pbId || paId === pbId) continue;
            const aNextPlayers = (aAlloc.pickedPlayers || []).map((p) =>
              String(p?.id || "") === paId ? pb : p,
            );
            const bNextPlayers = (bAlloc.pickedPlayers || []).map((p) =>
              String(p?.id || "") === pbId ? pa : p,
            );

            const aNext = buildAllocForCap(aCap, aNextPlayers);
            const bNext = buildAllocForCap(bCap, bNextPlayers);
            const nextScore = pairScore(aNext, bNext);

            if (!isBetterPairScore(nextScore, prevScore)) continue;
            if (!best || isBetterPairScore(nextScore, best.score)) {
              best = { aNext, bNext, score: nextScore };
            }
          }
        }

        if (best) {
          byIdx.set(Number(aIdx), best.aNext);
          byIdx.set(Number(bIdx), best.bNext);
          return true;
        }
        return false;
      };

      for (let pass = 0; pass < 4; pass++) {
        let changed = false;
        const ordered = capOrder
          .map((idx) => ({ idx, alloc: byIdx.get(idx) }))
          .filter((x) => x.alloc)
          .sort((a, b) => {
            const aRatio =
              Number(a.alloc.helperSlotsRequested || 0) > 0
                ? Number(a.alloc.helpersUsed || 0) /
                  Number(a.alloc.helperSlotsRequested || 1)
                : 1;
            const bRatio =
              Number(b.alloc.helperSlotsRequested || 0) > 0
                ? Number(b.alloc.helpersUsed || 0) /
                  Number(b.alloc.helperSlotsRequested || 1)
                : 1;
            return (
              aRatio - bRatio ||
              Number(b.alloc.slotsLeft || 0) - Number(a.alloc.slotsLeft || 0) ||
              Number(a.idx) - Number(b.idx)
            );
          });

        // First try direct moves into underfilled towers.
        for (const recv of ordered) {
          const recvAlloc = byIdx.get(recv.idx);
          if (!recvAlloc) continue;
          const recvNeeds = Math.max(0, Number(recvAlloc.slotsLeft || 0));
          const recvCanUse = Math.max(0, Number(recvAlloc.capLeft || 0));
          if (recvNeeds <= 0 && recvCanUse <= 0) continue;

          const donors = capOrder
            .map((idx) => ({ idx, alloc: byIdx.get(idx) }))
            .filter((d) => d.idx !== recv.idx && d.alloc)
            .sort((a, b) => {
              const aRatio =
                Number(a.alloc.helperSlotsRequested || 0) > 0
                  ? Number(a.alloc.helpersUsed || 0) /
                    Number(a.alloc.helperSlotsRequested || 1)
                  : 0;
              const bRatio =
                Number(b.alloc.helperSlotsRequested || 0) > 0
                  ? Number(b.alloc.helpersUsed || 0) /
                    Number(b.alloc.helperSlotsRequested || 1)
                  : 0;
              return (
                bRatio - aRatio ||
                Number(b.alloc.helpersUsed || 0) -
                  Number(a.alloc.helpersUsed || 0) ||
                Number(a.idx) - Number(b.idx)
              );
            });

          for (const donor of donors) {
            if (tryMoveOne(donor.idx, recv.idx)) {
              changed = true;
              break;
            }
          }
          if (changed) break;
        }

        // Then try pair swaps to improve fairness / fit without changing counts too much.
        if (!changed) {
          for (let i = 0; i < capOrder.length && !changed; i++) {
            for (let j = i + 1; j < capOrder.length && !changed; j++) {
              if (trySwapOne(capOrder[i], capOrder[j])) changed = true;
            }
          }
        }

        if (!changed) break;
      }
    }

    return byIdx;
  }

  function computeShiftCalculator(
    shiftKey,
    rows,
    globalCfg,
    blockedIn = new Set(),
  ) {
    const tiers = ["T14", "T13", "T12", "T11", "T10", "T9"];
    const selectedCaptains = [];
    const captainIds = new Set();
    const demandByTroop = { fighter: 0, rider: 0, shooter: 0 };
    let captainMarch = 0;
    let captainRally = 0;
    const applyMode = ["topup", "empty", "rebalance"].includes(
      String(globalCfg?.applyMode || "").toLowerCase(),
    )
      ? String(globalCfg.applyMode).toLowerCase()
      : "topup";
    const shiftSlots = calcGetTowerSlotsForShift(shiftKey);

    const inputRows = Array.isArray(rows) ? rows : [];
    for (let rowIdx = 0; rowIdx < inputRows.length; rowIdx++) {
      const row = inputRows[rowIdx];
      if (!row || !row.captainId) continue;
      const p =
        state.playerById?.get?.(row.captainId) ||
        (state.players || []).find(
          (x) => String(x.id) === String(row.captainId),
        );
      if (!p) continue;
      const troop =
        row.troop &&
        ["fighter", "rider", "shooter"].includes(
          String(row.troop).toLowerCase(),
        )
          ? String(row.troop).toLowerCase()
          : roleNorm(p.role) || "fighter";
      let helpersWantedRaw = Math.max(0, Number(row.helpers || 0) || 0);
      if (helpersWantedRaw > 0 && !!globalCfg?.minHelpersPerTower) {
        const minC = Math.max(
          1,
          Math.min(30, Number(globalCfg?.minHelpersCount || 10) || 10),
        );
        helpersWantedRaw = Math.max(helpersWantedRaw, minC);
      }
      const rallySize = Math.max(0, Number(p.rally || 0) || 0);
      const capMarchOne = Math.max(0, Number(p.march || 0) || 0);
      const towerCapacity = Math.max(0, rallySize + capMarchOne);
      const helperCapacity = Math.max(0, towerCapacity - capMarchOne);
      const slot = shiftSlots[rowIdx] || null;
      const baseId = String(slot?.baseId || "");
      const baseTitle = String(slot?.title || "");
      const existingHelperCount = Math.max(
        0,
        Number(
          slot?.helperCount ||
            (Array.isArray(slot?.helperIds) ? slot.helperIds.length : 0),
        ) || 0,
      );
      const existingHasCaptain = !!String(slot?.captainId || "");
      const towerLocked = !!(baseId && calcIsTowerLocked(baseId));
      let helpersWanted = helpersWantedRaw;
      let applySkipReason = "";
      if (towerLocked) {
        helpersWanted = 0;
        applySkipReason = t('skipped_turret_locked', 'турель заблокована (пропущено)').replace(/ \(.*$/, "");
      } else if (applyMode === "empty") {
        if (existingHasCaptain || existingHelperCount > 0) {
          helpersWanted = 0;
          applySkipReason = t('skipped_not_empty', 'не порожня (пропущено)').replace(/ \(.*$/, "");
        }
      } else if (applyMode === "topup") {
        helpersWanted = Math.max(0, helpersWantedRaw - existingHelperCount);
        if (helpersWanted <= 0) applySkipReason = t('already_filled', 'вже заповнено');
      }

      selectedCaptains.push({
        player: p,
        troop,
        helpersWanted,
        helpersWantedRaw,
        rallySize,
        towerCapacity,
        helperCapacity,
        captainMarch: capMarchOne,
        rowRef: row,
        rowIndex: rowIdx,
        baseId,
        baseTitle,
        existingHelperCount,
        existingHasCaptain,
        towerLocked,
        applySkipReason,
      });
      captainIds.add(String(p.id));
      demandByTroop[troop] += helperCapacity;
      captainMarch += capMarchOne;
      captainRally += rallySize;
    }

    const exclude = new Set([...(blockedIn || new Set()), ...captainIds]); // exclude captains only inside this shift's helper pool
    const byTroopPlayers = buildCalcPlayersByTroop({
      shiftKey,
      excludeIds: exclude,
      both50: !!globalCfg.both50,
      noCrossShift: !!globalCfg.noCrossShift,
      bothAllocMap: globalCfg.bothAllocMap || null,
    });
    const poolRefs = {
      fighter: { players: (byTroopPlayers.fighter || []).slice() },
      rider: { players: (byTroopPlayers.rider || []).slice() },
      shooter: { players: (byTroopPlayers.shooter || []).slice() },
    };

    const tc = getCalcState();
    const hprefs =
      tc?.helperPrefs && typeof tc.helperPrefs === "object"
        ? tc.helperPrefs
        : {};
    const fairAllocByTroop = {
      fighter: new Map(),
      rider: new Map(),
      shooter: new Map(),
    };
    for (const troop of ["fighter", "rider", "shooter"]) {
      const caps = selectedCaptains
        .map((c, idx) => ({ ...c, idx }))
        .filter((c) => String(c.troop || "fighter") === troop);

      const baseToIdx = new Map();
      for (const c of caps) {
        if (!c.baseId) continue;
        if (Math.max(0, Number(c.helpersWanted || 0) || 0) <= 0) continue;
        baseToIdx.set(String(c.baseId), Number(c.idx));
      }

      const lockedByTowerIdx = new Map();
      for (const p of poolRefs[troop]?.players || []) {
        const pid = String(p?.id || "");
        if (!pid) continue;
        const pref = hprefs[pid];
        const lockedBaseId = String(pref?.lockedBaseId || "");
        if (!lockedBaseId) continue;
        const targetIdx = baseToIdx.get(lockedBaseId);
        if (targetIdx == null) continue;
        if (!lockedByTowerIdx.has(targetIdx))
          lockedByTowerIdx.set(targetIdx, []);
        lockedByTowerIdx.get(targetIdx).push(p);
      }
      fairAllocByTroop[troop] = calcAllocateTroopTowersFair(
        caps,
        poolRefs[troop]?.players || [],
        globalCfg,
        lockedByTowerIdx,
      );
    }

    const towerPlans = [];
    const usedAcross = new Set();
    const mergedAvail = calcEmptyTierMap();
    const mergedUsed = calcEmptyTierMap();

    // Avail by tier from full helper pool (before picks)
    for (const troop of ["fighter", "rider", "shooter"]) {
      for (const p of byTroopPlayers[troop] || []) {
        const t = `T${calcTierRank(p.tier)}`;
        if (!mergedAvail[t]) continue;
        mergedAvail[t].count += 1;
        mergedAvail[t].march += calcContribForPlayer(p);
      }
    }

    let totalDemand = 0;
    let totalSupplied = 0;
    let totalHelpersWanted = 0;
    let totalHelpersWantedRaw = 0;
    let totalHelpersPlaced = 0;

    for (let idx = 0; idx < selectedCaptains.length; idx++) {
      const cap = selectedCaptains[idx];
      const troop = cap.troop || "fighter";
      const alloc =
        (fairAllocByTroop[troop] && fairAllocByTroop[troop].get(idx)) ||
        allocateTowerFromPool(poolRefs[troop] || { players: [] }, {
          helperSlots: cap.helpersWanted,
          capacity: cap.helperCapacity,
          tierTargets: globalCfg.tierTargets,
        });
      totalDemand += cap.helperCapacity;
      totalSupplied += alloc.usedMarch;
      totalHelpersWanted += cap.helpersWanted;
      totalHelpersWantedRaw += cap.helpersWantedRaw;
      totalHelpersPlaced += alloc.helpersUsed;
      alloc.pickedIds.forEach((id) => usedAcross.add(String(id)));
      for (const t of tiers) {
        mergedUsed[t].count += alloc.usedByTier[t].count;
        mergedUsed[t].march += alloc.usedByTier[t].march;
      }
      const tierMix = tiers
        .map((t) =>
          alloc.usedByTier[t].count
            ? `${t}×${alloc.usedByTier[t].count} (${Number(alloc.usedByTier[t].march || 0).toLocaleString("en-US")})`
            : "",
        )
        .filter(Boolean);
      const recTierMinMarch = alloc.recTierMinMarch || {
        T14: 0,
        T13: 0,
        T12: 0,
        T11: 0,
        T10: 0,
        T9: 0,
      };
      const recTierText = Array.isArray(alloc.recTierText)
        ? alloc.recTierText.slice()
        : [];
      towerPlans.push({
        idx,
        troop,
        baseId: cap.baseId || "",
        baseTitle: cap.baseTitle || "",
        existingHelperCount: cap.existingHelperCount || 0,
        existingHasCaptain: !!cap.existingHasCaptain,
        towerLocked: !!cap.towerLocked,
        applySkipReason: cap.applySkipReason || "",
        captain: cap.player,
        rallySize: cap.rallySize,
        captainMarch: cap.captainMarch,
        towerCapacity: cap.towerCapacity,
        helperCapacity: cap.helperCapacity,
        helpersWantedRaw: cap.helpersWantedRaw,
        helpersWanted: cap.helpersWanted,
        helpersPlaced: alloc.helpersUsed,
        usedMarch: alloc.usedMarch,
        shortageMarch: Math.max(0, cap.helperCapacity - alloc.usedMarch),
        shortageHelpers: Math.max(0, cap.helpersWanted - alloc.helpersUsed),
        tierMix,
        byTier: cloneTierMap(alloc.usedByTier),
        suggestedRule: {
          maxHelpers: Math.max(
            0,
            Number(cap.helpersWantedRaw || alloc.helpersUsed || 0) || 0,
          ),
          tierMinMarch: recTierMinMarch,
        },
        suggestedTierText: recTierText,
        notFitPlayers: Array.isArray(alloc.notFitPlayers)
          ? alloc.notFitPlayers
          : [],
        partialPlayers: Array.isArray(alloc.partialPlayers)
          ? alloc.partialPlayers
          : [],
        pickedPlayers: Array.isArray(alloc.pickedPlayers)
          ? alloc.pickedPlayers.slice()
          : [],
        assignedById: alloc.assignedById || {},
        lockedPicked: Math.max(0, Number(alloc.lockedPicked || 0) || 0),
      });
    }

    const nextBlocked = new Set();
    if (globalCfg.noCrossShift) usedAcross.forEach((id) => nextBlocked.add(id)); // helpers only; captains can repeat in both shifts

    return {
      shiftKey,
      rows,
      selectedCaptains,
      captainIds,
      demandByTroop,
      mergedAvail,
      mergedUsed,
      totalDemand,
      totalSupplied,
      remaining: Math.max(0, totalDemand - totalSupplied),
      captainMarch,
      captainRally,
      nextBlocked,
      usedAcross,
      totalHelpersWanted,
      totalHelpersWantedRaw,
      totalHelpersPlaced,
      towerPlans,
      applyMode,
    };
  }

  function renderCalcShiftOut(result, mount) {
    if (!mount || !result) return;
    const fm = (n) => Number(n || 0).toLocaleString("en-US");
    const tiers = ["T14", "T13", "T12", "T11", "T10", "T9"];
    const troopBadges =
      Object.entries(result.demandByTroop)
        .filter(([, v]) => Number(v) > 0)
        .map(([k, v]) => `${k}: ${fm(v)}`)
        .join(" · ") || "—";
    const baseSlots = calcGetTowerSlotsForShift(result.shiftKey);

    const cardsHtml = (result.towerPlans || []).length
      ? (result.towerPlans || [])
          .map((tp, i) => {
            const baseSlot = calcResolveBaseSlotForTowerPlan(
              result.shiftKey,
              tp,
              i,
              baseSlots,
            );
            const baseId = String(baseSlot?.baseId || "");
            const baseTitle = String(baseSlot?.title || "");
            const isLockedTower = calcIsTowerLocked(baseId);
            const helperRows = (tp.pickedPlayers || [])
              .slice(0, 10)
              .map((hp) => {
                const pid = String(hp?.id || "");
                const pref = calcGetHelperPref(pid);
                const sent = Number(tp.assignedById?.[pid] || 0) || 0;
                const full = Number(hp?.march || 0) || 0;
                return `<tr>
          <td>${calcEsc(hp?.name || "—")}</td><td>${calcEsc(String(hp?.tier || ""))}</td><td>${calcEsc(typeof window.PNS?.roleLabel === "function" ? window.PNS.roleLabel(roleNorm(hp?.role) || "", false) : (roleNorm(hp?.role) || ""))}</td>
          <td>${fm(sent)}</td><td>${fm(full)}</td>
          <td>
            ${pid ? `<button type="button" class="btn btn-xs" data-calc-toggle-exclude="${calcEsc(pid)}">${pref?.excluded ? t('return_action', 'Повернути') : t('remove_action', 'Прибрати')}</button>` : ""}
            ${pid && baseId ? `<button type="button" class="btn btn-xs" data-calc-toggle-lock-helper="${calcEsc(pid)}" data-base-id="${calcEsc(baseId)}">${String(pref?.lockedBaseId || "") === baseId ? t('unpin_action', 'Відкріпити') : t('pin_action', 'Закріпити')}</button>` : ""}
          </td>
        </tr>`;
              })
              .join("");
            return `
      <div class="tower-calc-panel top-space" data-calc-tower-card data-shift="${calcEsc(result.shiftKey)}" data-base-id="${calcEsc(baseId)}">
        <div class="tower-calc-head">
          <div><h4 style="margin:0">#${i + 1} ${calcEsc(tp.captain?.name || "—")}</h4><div class="muted small">${calcEsc(typeof window.PNS?.roleLabel === "function" ? window.PNS.roleLabel(tp.troop || "", true) : (tp.troop || ""))} · ${calcEsc(baseTitle || t('turret', 'Турель'))}</div></div>
          <div class="tower-calc-controls">
            ${baseId ? `<button type="button" class="btn btn-xs" data-calc-open-base="${calcEsc(baseId)}" data-calc-shift="${calcEsc(result.shiftKey || "")}">${t('turret', 'Турель')}</button>` : ""}
            ${baseId ? `<button type="button" class="btn btn-xs" data-calc-edit-base="${calcEsc(baseId)}" data-calc-shift="${calcEsc(result.shiftKey || "")}">${t('edit_players', 'Редагувати гравців')}</button>` : ""}
            ${baseId ? `<button type="button" class="btn btn-xs" data-calc-pick-overflow-base="${calcEsc(baseId)}" data-calc-shift="${calcEsc(result.shiftKey || "")}">${t('take_from_reserve', 'Взяти з резерву')}</button>` : ""}
            ${baseId ? `<button type="button" class="btn btn-xs" data-calc-manual-base="${calcEsc(baseId)}" data-calc-shift="${calcEsc(result.shiftKey || "")}">${t('add_player_manually', 'Додати гравця вручну')}</button>` : ""}
            ${baseId ? `<button type="button" class="btn btn-xs ${isLockedTower ? "btn-primary" : ""}" data-calc-lock-tower="${calcEsc(baseId)}">${isLockedTower ? t('unlock_turret', 'Розблокувати турель') : t('lock_turret', 'Заблокувати турель')}</button>` : ""}
          </div>
        </div>
        <div class="tower-calc-summary">
          <div><span class="muted small">${t('players', 'Гравці')}</span><strong>${fm(tp.helpersPlaced)} / ${fm(tp.helpersWanted)}${Number(tp.helpersWantedRaw || 0) !== Number(tp.helpersWanted || 0) ? ` (${t('without_limits', 'без обмежень')}: ${fm(tp.helpersWantedRaw)})` : ""}</strong></div>
          <div><span class="muted small">${t('turret_capacity', 'Місткість турелі')}</span><strong>${fm(tp.towerCapacity || (Number(tp.rallySize || 0) || 0) + (Number(tp.captainMarch || 0) || 0))}</strong></div>
          <div><span class="muted small">${t('used_shortage', 'Використано / нестача')}</span><strong>${fm(tp.usedMarch)} / ${fm(tp.shortageMarch)}</strong></div>
          <div><span class="muted small">${t('recommended_min_tier', 'Рекомендований мінімум за тіром')}</span><strong>${tp.suggestedTierText?.length ? calcEsc(tp.suggestedTierText.join(" · ")) : "—"}</strong></div>
        </div>
        <div class="muted small top-space">${t('rally_size', 'Розмір ралі')} ${fm(tp.rallySize)} · ${t('captain_march', 'Марш капітана')} ${fm(tp.captainMarch)} · ${t('helper_slots', 'Місць для помічників')} ${fm(tp.helperCapacity)}</div>
        <div class="muted small">${tp.tierMix.length ? calcEsc(tp.tierMix.join(" · ")) : "—"}</div>
        <div class="muted small">${tp.towerLocked ? `🔒 ${t('turret_locked_not_applied', 'Турель заблокована — зміни не застосовано')}` : tp.applySkipReason ? calcEsc(`ℹ ${tp.applySkipReason}`) : (tp.lockedPicked || 0) > 0 ? calcEsc(`🔒 ${t('locked_helpers', 'Закріплених помічників')}: ${tp.lockedPicked}`) : ""}</div>
        <div class="muted small">${
          tp.notFitPlayers?.length || tp.partialPlayers?.length
            ? calcEsc(
                [
                  ...(tp.notFitPlayers || [])
                    .slice(0, 4)
                    .map((p) => `${p.name || "—"} (${p.tier || ""})`),
                  ...(tp.partialPlayers || [])
                    .slice(0, 2)
                    .map(
                      (p) =>
                        `${p.name || "—"} ${t('partial_short', 'частково')} ${Number(p.sent || 0).toLocaleString("en-US")}/${Number(p.full || 0).toLocaleString("en-US")}`,
                    ),
                ].join(" · "),
              ) +
              ((tp.notFitPlayers?.length || 0) +
                (tp.partialPlayers?.length || 0) >
              6
                ? " …"
                : "")
            : `✅ ${t('all_players_placed', 'Усі гравці розмістилися')}`
        }</div>
        ${(tp.pickedPlayers || []).length ? `<details class="top-space"><summary class="small">${t('picked_players', 'Відібрані гравці')} (${fm(tp.pickedPlayers.length)})</summary><div class="helpers-table-wrap top-space" style="max-height:180px;overflow:auto"><table class="mini-table tower-calc-tier-table"><thead><tr><th>${t('nickname', 'Нік')}</th><th>${t('tier', 'Тір')}</th><th>${t('troop_type', 'Тип військ')}</th><th>${t('sent', 'Відправлено')}</th><th>${t('full', 'Повний')}</th><th>${t('actions', 'Дії')}</th></tr></thead><tbody>${helperRows}</tbody></table></div></details>` : ""}
      </div>`;
          })
          .join("")
      : `<div class="tower-calc-placeholder muted small">${t('captains_not_selected', 'Капітанів не вибрано')}</div>`;

    mount.innerHTML = `
      <div class="tower-calc-summary">
        <div><span class="muted small">${t('selected_captains', 'Обрано капітанів')}</span><strong>${result.selectedCaptains.length}</strong></div>
        <div><span class="muted small">${t('players_needed_placed', 'Гравці (потрібно / поставлено)')}</span><strong>${fm(result.totalHelpersWanted)} / ${fm(result.totalHelpersPlaced)}${Number(result.totalHelpersWantedRaw || 0) !== Number(result.totalHelpersWanted || 0) ? ` (${t('without_limits', 'без обмежень')}: ${fm(result.totalHelpersWantedRaw)})` : ""}</strong></div>
        <div><span class="muted small">${t('player_march_total', 'Марш гравців')}</span><strong>${fm(result.totalSupplied)}</strong></div>
        <div><span class="muted small">${t('shortage', 'Нестача')}</span><strong>${fm(result.remaining)}</strong></div>
      </div>
      <div class="muted small">${t('capacity_by_troop', 'Місткість за типом військ (від капітанів)')}: ${troopBadges}</div>
      <div class="top-space">${cardsHtml}</div>
      <details class="top-space"><summary class="small">${t('tier_summary', 'Підсумок по тірах')}</summary>
        <table class="tower-calc-tier-table top-space">
          <thead><tr><th>${t('tier', 'Тір')}</th><th>${t('available_players', 'Доступно гравців')}</th><th>${t('available_march', 'Доступний марш')}</th><th>${t('used_players', 'Використано гравців')}</th><th>${t('used_march', 'Використано марш')}</th></tr></thead>
          <tbody>
            ${tiers.map((t) => `<tr><td>${t}</td><td>${fm(result.mergedAvail[t].count)}</td><td>${fm(result.mergedAvail[t].march)}</td><td>${fm(result.mergedUsed[t].count)}</td><td>${fm(result.mergedUsed[t].march)}</td></tr>`).join("")}
          </tbody>
        </table>
      </details>`;
  }

  function getCalcTowerBaseOrder() {
    const ids = [];
    try {
      const cards = MS.getTowerCards?.() || [];
      cards.forEach((card) => {
        const id = String(card?.dataset?.baseId || card?.dataset?.baseid || "");
        if (!id || ids.includes(id)) return;
        ids.push(id);
      });
    } catch {}
    if (!ids.length) {
      for (const b of state.bases || []) {
        const id = String(b?.id || "");
        if (!id || ids.includes(id)) continue;
        ids.push(id);
      }
    }
    return ids
      .slice(0, 5)
      .map((id) => state.baseById?.get?.(id) || { id, title: id });
  }

  function calcSnapshotCurrentShiftPlanSafe() {
    try {
      MS.saveCurrentShiftPlanSnapshot?.();
    } catch {}
    try {
      state.shiftPlans = state.shiftPlans || {};
    } catch {}
    return state.shiftPlans || {};
  }

  function calcGetShiftPlanObject(shiftKey) {
    calcSnapshotCurrentShiftPlanSafe();
    const plan = state.shiftPlans?.[shiftKey];
    return plan && typeof plan === "object" ? plan : null;
  }

  function calcGetTowerSlotsForShift(shiftKey) {
    const order = getCalcTowerBaseOrder();
    const plan = calcGetShiftPlanObject(shiftKey);
    const planBases = plan?.bases || {};
    return order.map((base, idx) => {
      const live = state.baseById?.get?.(base?.id || "");
      const snap = planBases?.[base?.id] || {};
      const useLive =
        String(state.activeShift || "") === String(shiftKey || "");
      const captainId = String(
        (snap.captainId ?? (useLive ? live?.captainId : null)) || "",
      );
      const helperIds = Array.isArray(snap.helperIds)
        ? snap.helperIds
        : useLive
          ? Array.isArray(live?.helperIds)
            ? live.helperIds
            : []
          : [];
      const role =
        snap.role || (useLive ? live?.role : null) || base?.role || null;
      return {
        index: idx,
        baseId: String(base?.id || ""),
        title: String(base?.title || base?.id || `${t('turret', 'Турель')} ${idx + 1}`),
        captainId,
        helperIds: helperIds.slice ? helperIds.slice() : [],
        helperCount: Array.isArray(helperIds) ? helperIds.length : 0,
        role,
      };
    });
  }

  function calcResolveBaseSlotForTowerPlan(
    shiftKey,
    towerPlan,
    fallbackIndex,
    slotsIn,
  ) {
    const slots = Array.isArray(slotsIn)
      ? slotsIn
      : calcGetTowerSlotsForShift(shiftKey);
    const capId = String(towerPlan?.captain?.id || "");
    if (capId) {
      const match = slots.find((s) => String(s?.captainId || "") === capId);
      if (match) return match;
    }
    const byIdx = slots[Number(fallbackIndex) || 0];
    return byIdx || null;
  }

  function calcSyncCaptainsFromTowersIntoCalculator(opts = {}) {
    const tc = calcLoadStateFromLS();
    for (const shiftKey of ["shift1", "shift2"]) {
      const currentRows = Array.isArray(tc[shiftKey]) ? tc[shiftKey] : [];
      const slots = calcGetTowerSlotsForShift(shiftKey);
      const nextRows = [];
      for (let i = 0; i < 5; i++) {
        const slot = slots[i] || {};
        const prev = currentRows[i] || {};
        const capId = String(slot.captainId || "");
        const capPlayer = capId
          ? state.playerById?.get?.(capId) ||
            (state.players || []).find((x) => String(x.id) === capId)
          : null;
        const troop =
          roleNorm(capPlayer?.role || slot.role || prev.troop || "") ||
          String(prev.troop || "fighter");
        const helpersAuto = Math.max(0, Number(slot.helperCount || 0) || 0);
        const helpersPrev = Math.max(0, Number(prev.helpers ?? 15) || 15);
        nextRows.push({
          captainId: capId,
          troop,
          helpers:
            opts.keepHelpers === false
              ? helpersAuto > 0
                ? helpersAuto
                : 15
              : helpersAuto > 0
                ? helpersAuto
                : helpersPrev || 15,
        });
      }
      tc[shiftKey] = nextRows;
    }
    try {
      localStorage.setItem("pns_tower_calc_state", JSON.stringify(tc));
    } catch {}
    if (opts.render !== false) renderTowerCalcModal();
    return true;
  }

  function calcOpenTowerPickerForBase(baseId, shiftKey) {
    const id = String(baseId || "");
    if (!id) return false;
    try {
      if (shiftKey && String(state.activeShift || "") !== String(shiftKey))
        MS.applyShiftFilter?.(shiftKey);
    } catch {}
    try {
      state.towerPickerSelectedBaseId = id;
    } catch {}
    try {
      MS.focusTowerById?.(id);
    } catch {}
    try {
      MS.openTowerPickerModal?.();
    } catch {}
    setTimeout(() => {
      try {
        MS.refreshTowerPickerModalList?.();
        MS.updateTowerPickerDetail?.();
      } catch {}
    }, 20);
    return true;
  }

  function calcEnsureReadyResultsForApply() {
    let results = state.towerCalcLastResults || null;
    const hasPlans = !!(
      results &&
      (results.shift1?.towerPlans?.length || 0) +
        (results.shift2?.towerPlans?.length || 0)
    );
    if (!hasPlans) {
      try {
        calcSyncCaptainsFromTowersIntoCalculator({ keepHelpers: true });
      } catch {}
      try {
        results = computeTowerCalcResults();
      } catch {
        results = null;
      }
    } else {
      try {
        results = computeTowerCalcResults() || results;
      } catch {}
    }
    const towerPlansCount =
      Number(results?.shift1?.towerPlans?.length || 0) +
      Number(results?.shift2?.towerPlans?.length || 0);
    if (!towerPlansCount) {
      try {
        PNS.setImportStatus?.(
          t('calc_no_captains_in_turrets', 'Калькулятор не знайшов капітанів у турелях. Спочатку постав капітанів у турелях або натисни «Підтягнути капітанів із турелей».'),
          "bad",
        );
      } catch {}
      return null;
    }
    return results;
  }

  function applyTowerCalcToTowerSettings() {
    const modal = document.getElementById("towerCalcModal");
    if (!modal) return false;
    const results = computeTowerCalcResults();
    if (!results) return false;
    const bases = getCalcTowerBaseOrder();
    if (!bases.length) {
      try {
        PNS.setImportStatus?.(
          t('calc_no_turrets_for_limits', 'Не знайдено турелей для застосування лімітів.'),
          "bad",
        );
      } catch {}
      return false;
    }

    let applied = 0;
    for (const shiftKey of ["shift1", "shift2"]) {
      const shiftRes = results[shiftKey];
      if (!shiftRes) continue;
      const slots = calcGetTowerSlotsForShift(shiftKey);
      const usedBaseIds = new Set();
      for (let i = 0; i < (shiftRes.towerPlans?.length || 0); i++) {
        const plan = shiftRes.towerPlans?.[i];
        const slot = calcResolveBaseSlotForTowerPlan(shiftKey, plan, i, slots);
        const baseId = String(slot?.baseId || "");
        if (!baseId || usedBaseIds.has(baseId) || !plan?.captain) continue;
        if (calcIsTowerLocked(baseId)) continue;
        usedBaseIds.add(baseId);
        const sug = plan.suggestedRule || {
          maxHelpers:
            Number(plan.helpersWanted || plan.helpersPlaced || 0) || 0,
          tierMinMarch: {},
        };
        const targetHelpers = Math.max(
          0,
          Number(
            plan.helpersWantedRaw ??
              plan.helpersWanted ??
              plan.helpersPlaced ??
              sug.maxHelpers ??
              0,
          ) || 0,
        );
        try {
          PNS.setBaseTowerRule?.(
            baseId,
            {
              maxHelpers: targetHelpers,
              tierMinMarch: {
                T14: Number(sug.tierMinMarch?.T14 || 0) || 0,
                T13: Number(sug.tierMinMarch?.T13 || 0) || 0,
                T12: Number(sug.tierMinMarch?.T12 || 0) || 0,
                T11: Number(sug.tierMinMarch?.T11 || 0) || 0,
                T10: Number(sug.tierMinMarch?.T10 || 0) || 0,
                T9: Number(sug.tierMinMarch?.T9 || 0) || 0,
              },
            },
            { shift: shiftKey, persist: true, rerender: false },
          );
          applied += 1;
        } catch {}
      }
    }

    const _applyRulesOrigShift = String(state.activeShift || "shift1");
    try {
      for (const _sk of ["shift1", "shift2"]) {
        try {
          if (String(state.activeShift || "") !== _sk)
            MS.applyShiftFilter?.(_sk);
        } catch {}
        try {
          PNS.applyBaseTowerRulesForActiveShift?.();
        } catch {}
      }
    } catch {}
    try {
      if (String(state.activeShift || "") !== _applyRulesOrigShift)
        MS.applyShiftFilter?.(_applyRulesOrigShift);
    } catch {}
    try {
      if (typeof PNS.renderAll === "function") PNS.renderAll();
    } catch {}
    try {
      MS.refreshTowerPickerModalList?.();
      MS.updateTowerPickerDetail?.();
    } catch {}

    try {
      const tc = getCalcState();
      tc.mainTab = calcApplyMainTabUI(modal, "preview");
      localStorage.setItem("pns_tower_calc_state", JSON.stringify(tc));
    } catch {}
    try {
      const tc = getCalcState();
      tc.mainTab = calcApplyMainTabUI(modal, "preview");
      localStorage.setItem("pns_tower_calc_state", JSON.stringify(tc));
    } catch {}
    const out =
      modal.querySelector("#towerCalcPreviewStatus") ||
      modal.querySelector("#towerCalcGlobalOut");
    if (out)
      out.textContent = t('calc_settings_applied_preview', '✅ Налаштування калькулятора застосовано до {count} налаштувань турелей.').replace(/\{count\}/g, String(applied));
    try {
      PNS.setImportStatus?.(
        t('calc_settings_applied_status', 'Налаштування калькулятора застосовано до турелей ({count}).').replace(/\{count\}/g, String(applied)),
        "good",
      );
    } catch {}
    try {
      calcRenderLiveFinalBoard(modal);
    } catch {}
    return true;
  }

  function applyTowerCalcAssignmentsToTowers() {
    const modal = document.getElementById("towerCalcModal");
    if (!modal) return false;
    const results = calcEnsureReadyResultsForApply();
    if (!results) return false;

    try {
      applyTowerCalcToTowerSettings();
    } catch {}

    const originalShift = String(state.activeShift || "shift1");
    const tcApply = getCalcState();
    const applyMode = ["topup", "empty", "rebalance"].includes(
      String(tcApply?.uiApplyMode || "").toLowerCase(),
    )
      ? String(tcApply.uiApplyMode).toLowerCase()
      : "topup";
    let assignedHelpers = 0;
    let assignedCaptains = 0;
    const warnings = [];

    try {
      MS.saveCurrentShiftPlanSnapshot?.();
    } catch {}

    const _origAlert = window.alert;
    let suppressedAlerts = 0;
    try {
      window.alert = function () {
        suppressedAlerts += 1;
      };
    } catch {}

    try {
      for (const shiftKey of ["shift1", "shift2"]) {
        const shiftRes = results?.[shiftKey];
        if (!shiftRes) continue;
        try {
          if (String(state.activeShift || "") !== shiftKey)
            MS.applyShiftFilter?.(shiftKey);
        } catch {}
        const slots = calcGetTowerSlotsForShift(shiftKey);
        const seenBase = new Set();

        for (let i = 0; i < (shiftRes.towerPlans?.length || 0); i++) {
          const tp = shiftRes.towerPlans?.[i];
          if (!tp?.captain?.id) continue;
          const slot = calcResolveBaseSlotForTowerPlan(shiftKey, tp, i, slots);
          const baseId = String(slot?.baseId || "");
          if (!baseId || seenBase.has(baseId)) continue;
          seenBase.add(baseId);

          if (calcIsTowerLocked(baseId)) {
            warnings.push(
              `${shiftLabel(shiftKey)} ${slot?.title || baseId}: ${t('skipped_turret_locked', 'турель заблокована (пропущено)')}`,
            );
            continue;
          }

          let baseLive = state.baseById?.get?.(baseId);
          const preHelperIds = Array.isArray(baseLive?.helperIds)
            ? baseLive.helperIds.slice()
            : [];
          const preHasCaptain = !!String(baseLive?.captainId || "");
          if (
            applyMode === "empty" &&
            (preHasCaptain || preHelperIds.length > 0)
          ) {
            warnings.push(
              `${shiftLabel(shiftKey)} ${slot?.title || baseId}: ${t('skipped_not_empty', 'не порожня (пропущено)')}`,
            );
            continue;
          }

          const doClear = applyMode === "rebalance";
          if (doClear) {
            try {
              PNS.clearBase?.(baseId, true);
            } catch {}
          }

          baseLive = state.baseById?.get?.(baseId);
          const currentCaptainId = String(baseLive?.captainId || "");
          if (!currentCaptainId || doClear) {
            if (String(currentCaptainId) !== String(tp.captain.id || "")) {
              try {
                PNS.assignPlayerToBase?.(tp.captain.id, baseId, "captain");
                const cpAssigned = state.playerById?.get?.(
                  String(tp.captain.id || ""),
                )?.assignment;
                if (
                  cpAssigned &&
                  String(cpAssigned.baseId || "") === baseId &&
                  String(cpAssigned.kind || "") === "captain"
                )
                  assignedCaptains += 1;
                else
                  warnings.push(
                    `${shiftLabel(shiftKey)} ${slot?.title || baseId}: ${t('captain_not_assigned', 'капітан {name} (не призначено)').replace(/\{name\}/g, String(tp.captain?.name || tp.captain?.id || ""))}`,
                  );
              } catch (err) {
                warnings.push(
                  `${shiftLabel(shiftKey)} ${slot?.title || baseId}: ${t('captain', 'Капітан').toLowerCase()} ${tp.captain?.name || tp.captain?.id} (${err?.message || t('assignment_error', 'помилка призначення')})`,
                );
              }
            }
          } else if (String(currentCaptainId) !== String(tp.captain.id || "")) {
            warnings.push(
              `${shiftLabel(shiftKey)} ${slot?.title || baseId}: ${t('captain_kept_mode', 'капітан залишився (режим {mode})').replace(/\{mode\}/g, String(applyMode || ""))}`,
            );
          }

          baseLive = state.baseById?.get?.(baseId);
          const existingHelperSet = new Set(
            (Array.isArray(baseLive?.helperIds) ? baseLive.helperIds : [])
              .map((x) => String(x || ""))
              .filter(Boolean),
          );
          let remainingToAdd = Infinity;
          if (applyMode === "topup")
            remainingToAdd = Math.max(
              0,
              Math.max(
                0,
                Number(tp.helpersWantedRaw ?? tp.helpersWanted ?? 0) || 0,
              ) - existingHelperSet.size,
            );
          else if (applyMode === "empty")
            remainingToAdd = Math.max(
              0,
              Number(tp.helpersWantedRaw ?? tp.helpersWanted ?? 0) || 0,
            );

          for (const hp of tp.pickedPlayers || []) {
            const pid = String(hp?.id || "");
            if (!pid || pid === String(tp.captain?.id || "")) continue;
            if (existingHelperSet.has(pid)) continue;
            if (remainingToAdd <= 0) break;
            try {
              const planned = Math.max(
                0,
                Number(tp.assignedById?.[pid] || 0) || 0,
              );
              const full = Math.max(0, Number(hp?.march || 0) || 0);
              if (planned > 0 && planned < full)
                PNS.setTowerMarchOverride?.(baseId, pid, planned, shiftKey);
              else if (planned >= full)
                PNS.clearTowerMarchOverride?.(baseId, pid, shiftKey);
            } catch {}
            try {
              PNS.assignPlayerToBase?.(pid, baseId, "helper");
              const asg = state.playerById?.get?.(pid)?.assignment;
              if (
                asg &&
                String(asg.baseId || "") === baseId &&
                String(asg.kind || "") === "helper"
              ) {
                assignedHelpers += 1;
                existingHelperSet.add(pid);
                if (remainingToAdd !== Infinity)
                  remainingToAdd = Math.max(0, remainingToAdd - 1);
              } else
                warnings.push(
                  `${shiftLabel(shiftKey)} ${slot?.title || baseId}: ${t('helper_not_assigned_or_limit', 'помічник {name} (не призначено / перевищено ліміт)').replace(/\{name\}/g, String(hp?.name || pid || ""))}`,
                );
            } catch (err) {
              warnings.push(
                `${shiftLabel(shiftKey)} ${slot?.title || baseId}: ${t('helper', 'Помічник').toLowerCase()} ${hp?.name || pid} (${err?.message || t('assignment_error', 'помилка призначення')})`,
              );
            }
          }
        }

        try {
          MS.saveCurrentShiftPlanSnapshot?.();
        } catch {}
      }
    } finally {
      try {
        window.alert = _origAlert;
      } catch {}
    }

    try {
      if (String(state.activeShift || "") !== originalShift)
        MS.applyShiftFilter?.(originalShift);
    } catch {}
    try {
      if (typeof PNS.renderAll === "function") PNS.renderAll();
    } catch {}
    try {
      MS.refreshTowerPickerModalList?.();
      MS.updateTowerPickerDetail?.();
      MS.syncSettingsTowerPreview?.();
    } catch {}
    try {
      PNS.saveTowersSnapshot?.();
    } catch {}
    try {
      PNS.savePlayersSnapshot?.(state.players);
    } catch {}

    const out =
      modal.querySelector("#towerCalcPreviewStatus") ||
      modal.querySelector("#towerCalcGlobalOut");
    if (out) {
      out.textContent =
        `✅ ${t('moved_to_turrets', 'Перенесено у турелі')}: ${t('captains_word', 'капітанів')} ${assignedCaptains}, ${t('players_word', 'гравців')} ${assignedHelpers}.` +
        (suppressedAlerts
          ? ` (${t('popups_suppressed', 'приглушено popup-вікон')}: ${suppressedAlerts})`
          : '');
      const notFitLines = [];
      try {
        for (const sk of ["shift1", "shift2"]) {
          for (const tp of results?.[sk]?.towerPlans || []) {
            const baseName = String(tp?.captain?.name || "—");
            const nf = Array.isArray(tp?.notFitPlayers) ? tp.notFitPlayers : [];
            if (!nf.length) continue;
            notFitLines.push(
              `${sk} / ${baseName}: ` +
                nf
                  .slice(0, 5)
                  .map((p) => `${p.name || "—"} (${p.tier || ""})`)
                  .join(", ") +
                (nf.length > 5 ? ` … +${nf.length - 5}` : ""),
            );
          }
        }
      } catch {}
      if (notFitLines.length && out)
        out.textContent += ` · ${t('not_fit_plural', 'Не влізли')}: ${notFitLines.length}`;
      if (warnings.length && out)
        out.textContent += ` · ${t('warnings', 'Попередження')}: ${warnings.length}`;
    }
    try {
      calcRenderLiveFinalBoard(modal);
    } catch {}
    return true;
  }

  function computeTowerCalcResults() {
    const modal = document.getElementById("towerCalcModal");
    if (!modal) return null;
    try {
      calcSyncCaptainsFromTowersIntoCalculator({
        keepHelpers: true,
        render: false,
      });
    } catch {}
    const tc = calcWriteRowsToState(modal);
    const cfg = {
      noCrossShift: !!tc.noCrossShift,
      both50: !!tc.both50,
      minHelpersPerTower: !!tc.minHelpersPerTower,
      minHelpersCount: Math.max(
        1,
        Math.min(30, Number(tc.minHelpersCount || 10) || 10),
      ),
      tierSizeMode: tc.tierSizeMode || "auto",
      tierSizeManual: calcNormalizeTierSizeTargets(tc.tierSizeManual),
      tierTargets: calcResolveTierSizeTargets(tc),
      applyMode: tc.uiApplyMode || "topup",
    };
    if (cfg.noCrossShift && cfg.both50) {
      try {
        const ab = calcBuildAutoBothBalanceMap(tc);
        cfg.bothAllocMap = ab?.map || {};
        cfg.autoBothCounts = ab?.counts || null;
        cfg.autoBothMarch = ab?.march || null;
        cfg.autoBothTroopCounts = ab?.troopCounts || null;
      } catch {}
    }
    const shift1 = computeShiftCalculator("shift1", tc.shift1, cfg, new Set());
    const shift2 = computeShiftCalculator(
      "shift2",
      tc.shift2,
      cfg,
      new Set(cfg.noCrossShift ? Array.from(shift1.nextBlocked) : []),
    );
    state.towerCalcLastResults = { shift1, shift2, cfg, at: Date.now() };
    renderCalcShiftOut(shift1, modal.querySelector("#towerCalcOutShift1"));
    renderCalcShiftOut(shift2, modal.querySelector("#towerCalcOutShift2"));
    const mini = modal.querySelector("#towerCalcMiniSummary");
    if (mini) {
      mini.textContent = `${t('shift1', 'Зміна 1')}: ${Number(shift1.totalHelpersWanted || 0)}→${Number(shift1.totalHelpersPlaced || 0)} · ${t('shift2', 'Зміна 2')}: ${Number(shift2.totalHelpersWanted || 0)}→${Number(shift2.totalHelpersPlaced || 0)} · ${t('both', 'Обидві')}: ${Number(calcComputeShiftRoleStats().both.total || 0)} · ${t('shortage', 'Нестача')}: ${Number(Math.max(0, shift1.totalDemand + shift2.totalDemand - (shift1.totalSupplied + shift2.totalSupplied)) || 0).toLocaleString("en-US")}`;
    }
    try {
      calcRenderOverflowPanel(modal, state.towerCalcLastResults);
    } catch {}
    try {
      calcRenderLiveFinalBoard(modal);
    } catch {}
    return state.towerCalcLastResults;
  }

  function openTowerCalculatorModal() {
    MS.ensureStep4Styles?.();
    try {
      const tc = getCalcState();
      tc.mainTab = "setup";
      tc.activeTab =
        String(state.activeShift || "").toLowerCase() === "shift2"
          ? "shift2"
          : "shift1";
      localStorage.setItem("pns_tower_calc_state", JSON.stringify(tc));
    } catch {}
    const modal = renderTowerCalcModal();
    if (!modal) {
      alert(t('calc_window_not_loaded', 'Вікно розподілу ще не завантажилось. Спробуй ще раз через секунду.'));
      return;
    }
    try {
      const tc = calcLoadStateFromLS();
      const hasAnyCaptain = [...(tc.shift1 || []), ...(tc.shift2 || [])].some(
        (r) => String(r?.captainId || ""),
      );
      const towersHaveCaptains = ["shift1", "shift2"].some((sk) =>
        calcGetTowerSlotsForShift(sk).some((sl) => String(sl?.captainId || "")),
      );
      if (!hasAnyCaptain && towersHaveCaptains)
        calcSyncCaptainsFromTowersIntoCalculator({ keepHelpers: false });
    } catch {}
    modal.classList.add("is-open");
    MS.syncBodyModalLock?.();
  }

  function closeTowerCalculatorModal() {
    const cm = document.getElementById("towerCalcModal");
    if (cm) {
      cm.classList.remove("is-open");
      cm.style.zIndex = "";
    }
    MS.syncBodyModalLock?.();
  }
  if (!state._towerCalcPlayerShiftBound) {
    state._towerCalcPlayerShiftBound = true;
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-calc-set-player-shift]");
      if (!btn) return;
      e.preventDefault();
      const pid = String(btn.getAttribute("data-calc-set-player-shift") || "");
      const target = String(btn.getAttribute("data-target-shift") || "both");
      const res =
        typeof PNS?.movePlayerToShiftWithLimits === "function"
          ? PNS.movePlayerToShiftWithLimits(pid, target)
          : { ok: false };
      if (!res?.ok) {
        const msg =
          res?.reason === "limit-shift1"
            ? t('shift_limit_already_set', 'Для {shift} вже встановлено ліміт {limit}.').replace(/\{shift\}/g, shiftLabel('shift1')).replace(/\{limit\}/g, String(res?.limits?.shift1 || 0))
            : res?.reason === "limit-shift2"
              ? t('shift_limit_already_set', 'Для {shift} вже встановлено ліміт {limit}.').replace(/\{shift\}/g, shiftLabel('shift2')).replace(/\{limit\}/g, String(res?.limits?.shift2 || 0))
              : t('change_shift_failed', 'Не вдалося змінити зміну гравця.');
        try {
          PNS.setImportStatus?.(msg, "warn");
        } catch {}
        return;
      }
      try {
        PNS.savePlayersSnapshot?.(state.players);
      } catch {}
      try {
        PNS.applyPlayerTableFilters?.();
      } catch {}
      try {
        PNS.updateShiftBreakdownUI?.();
      } catch {}
      try {
        calcUpdateShiftStatsUI(document.getElementById("towerCalcModal"));
      } catch {}
      try {
        computeTowerCalcResults();
      } catch {}
    });
  }

  Object.assign(MS, {
    openTowerCalculatorModal,
    closeTowerCalculatorModal,
    renderTowerCalcModal,
    computeTowerCalcResults,
    applyTowerCalcToTowerSettings,
    applyTowerCalcAssignmentsToTowers,
    calcSyncCaptainsFromTowersIntoCalculator,
    getCalcState,
    calcApplyMainTabUI,
    calcApplyActiveTabUI,
    calcApplyTierTargetInputsState,
    calcToggleTowerLocked,
    calcToggleHelperExcluded,
    calcToggleHelperLockedToBase,
    calcSetOverflowReserve,
    calcOpenTowerPickerForBase,
    calcAutoSlotsForShift,
    calcAutoFitTowersStrict,
    calcUpdateShiftStatsUI,
    calcComputeShiftRoleStats,
    calcRenderInlineTowerSettings,
    calcRenderLiveFinalBoard,
    calcRecalculateTowerComposition,
    roleNorm,
  });
  window.openTowerCalculatorModal = openTowerCalculatorModal;
  window.closeTowerCalculatorModal = closeTowerCalculatorModal;
  window.renderTowerCalcModal = renderTowerCalcModal;
  window.computeTowerCalcResults = computeTowerCalcResults;
  window.getCalcState = getCalcState;
  window.calcApplyMainTabUI = calcApplyMainTabUI;
  window.calcApplyActiveTabUI = calcApplyActiveTabUI;
  window.calcApplyTierTargetInputsState = calcApplyTierTargetInputsState;
  window.calcToggleTowerLocked = calcToggleTowerLocked;
  window.calcToggleHelperExcluded = calcToggleHelperExcluded;
  window.calcToggleHelperLockedToBase = calcToggleHelperLockedToBase;
  window.calcSetOverflowReserve = calcSetOverflowReserve;
  window.calcOpenTowerPickerForBase = calcOpenTowerPickerForBase;
  window.calcAutoSlotsForShift = calcAutoSlotsForShift;
  window.calcAutoFitTowersStrict = calcAutoFitTowersStrict;
  window.calcUpdateShiftStatsUI = calcUpdateShiftStatsUI;
  window.calcRenderInlineTowerSettings = calcRenderInlineTowerSettings;
  window.calcRenderLiveFinalBoard = calcRenderLiveFinalBoard;
  window.calcRecalculateTowerComposition = calcRecalculateTowerComposition;
  window.applyTowerCalcToTowerSettings = applyTowerCalcToTowerSettings;
  window.applyTowerCalcAssignmentsToTowers = applyTowerCalcAssignmentsToTowers;
  window.calcSetInlineSelectedBaseId = calcSetInlineSelectedBaseId;
  window.calcSetPreviewShift = calcSetPreviewShift;
  window.calcExportPreviewBoardPng = calcExportPreviewBoardPng;
  window.calcSharePreviewBoard = calcSharePreviewBoard;
  window.calcSyncCaptainsFromTowersIntoCalculator =
    calcSyncCaptainsFromTowersIntoCalculator;
  window.roleNorm = roleNorm;
})();
