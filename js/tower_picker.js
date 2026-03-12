(function () {
  const PNS = window.PNS;
  if (!PNS) return;
  const MS = (PNS.ModalsShift = PNS.ModalsShift || {});
  const { state } = PNS;
  if (!state) return;

  function getTowerPickerSelectedBaseId() {
    if (state.towerPickerSelectedBaseId) return state.towerPickerSelectedBaseId;
    const focused = MS.getFocusedCard?.();
    if (focused)
      return String(focused.dataset.baseId || focused.dataset.baseid || "");
    const next = MS.findNextIncompleteTower?.();
    if (next) return String(next.dataset.baseId || next.dataset.baseid || "");
    const first = (MS.getTowerCards?.() || [])[0];
    return first
      ? String(first.dataset.baseId || first.dataset.baseid || "")
      : "";
  }

  function isPickerOnlyCaptainsEnabled() {
    if (typeof state.towerPickerOnlyCaptains !== "boolean")
      state.towerPickerOnlyCaptains = _pickerBoolLS("pns_picker_only_captains", false);
    if (typeof state.towerPickerMatchRegisteredShift !== "boolean")
      state.towerPickerMatchRegisteredShift = _pickerBoolLS("pns_picker_match_registered_shift", true);
    if (typeof state.towerPickerNoMixTroops !== "boolean")
      state.towerPickerNoMixTroops = isPickerNoMixTroopsEnabled();
    if (typeof state.towerPickerNoCrossShiftDupes !== "boolean")
      state.towerPickerNoCrossShiftDupes = isPickerNoCrossShiftDupesEnabled();
    return !!state.towerPickerOnlyCaptains;
  }

  function isPickerMatchRegisteredShiftEnabled() {
    if (typeof state.towerPickerMatchRegisteredShift !== "boolean")
      state.towerPickerMatchRegisteredShift = _pickerBoolLS("pns_picker_match_registered_shift", true);
    return !!state.towerPickerMatchRegisteredShift;
  }

  function _pickerBoolLS(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      if (v === null) return fallback;
      return v === "1";
    } catch {
      return fallback;
    }
  }

  function isPickerNoMixTroopsEnabled() {
    if (typeof state.towerPickerNoMixTroops !== "boolean") {
      state.towerPickerNoMixTroops = _pickerBoolLS(
        "pns_picker_no_mix_troops",
        true,
      );
    }
    return !!state.towerPickerNoMixTroops;
  }

  function isPickerNoCrossShiftDupesEnabled() {
    if (typeof state.towerPickerNoCrossShiftDupes !== "boolean") {
      state.towerPickerNoCrossShiftDupes = _pickerBoolLS(
        "pns_picker_no_cross_shift_dupes",
        false,
      );
    }
    return state.towerPickerNoCrossShiftDupes === true;
  }

  function isDontTouchBothEnabled() {
    try {
      const raw = localStorage.getItem("pns_tower_calc_state");
      if (!raw) return true;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return true;
      if (Number(data.dontTouchBothVersion || 0) < 1) return true;
      if (typeof data.ignoreBoth === "boolean") return !!data.ignoreBoth;
      return true;
    } catch {
      return true;
    }
  }

  function eligibleCaptainsForBase(base) {
    if (!base) return [];
    const onlyCaptains = isPickerOnlyCaptainsEnabled();
    const matchRegisteredShift = isPickerMatchRegisteredShiftEnabled();
    const baseShift = String(base?.shift || "").toLowerCase();
    const curShift =
      baseShift === "shift1" || baseShift === "shift2"
        ? baseShift
        : state.activeShift || "shift1";
    return (state.players || [])
      .filter((p) => {
        if (!p) return false;
        const isCurrentCaptain = !!(
          p.assignment &&
          p.assignment.baseId === base.id &&
          p.assignment.kind === "captain"
        );
        if (isCurrentCaptain) return true;
        if (onlyCaptains && !p.captainReady) return false;
        if (matchRegisteredShift && curShift !== "all") {
          const ps = String(p.shift || "both").toLowerCase();
          if (isDontTouchBothEnabled() && ps === "both" && !isCurrentCaptain)
            return false;
          if (!(ps === "both" || ps === curShift)) return false;
        }
        if (!p.assignment) return true;
        return false;
      })
      .sort((a, b) => {
        const blockBoth = isDontTouchBothEnabled();
        const aShift = String(a?.shift || "both").toLowerCase();
        const bShift = String(b?.shift || "both").toLowerCase();
        const aShiftScore =
          aShift === curShift || (!blockBoth && aShift === "both") ? 1 : 0;
        const bShiftScore =
          bShift === curShift || (!blockBoth && bShift === "both") ? 1 : 0;
        return (
          bShiftScore - aShiftScore ||
          Number(b.captainReady) - Number(a.captainReady) ||
          (b.march || 0) - (a.march || 0) ||
          String(a.name).localeCompare(String(b.name))
        );
      });
  }

  function pickerEffectiveMarch(base, player) {
    try {
      const ov = PNS.getTowerMarchOverride?.(
        base?.id,
        player?.id,
        String(state.activeShift || "shift1"),
      );
      if (Number.isFinite(ov) && ov >= 0) return Math.max(0, Number(ov) || 0);
    } catch {}
    try {
      if (typeof PNS.getTowerEffectiveMarch === "function")
        return Number(PNS.getTowerEffectiveMarch(base, player)) || 0;
    } catch {}
    return Number(player?.march || 0) || 0;
  }

  function pickerMarchCell(base, player, { isCaptain = false } = {}) {
    const raw = Number(player?.march || 0) || 0;
    if (isCaptain) return Number(raw).toLocaleString("en-US");
    const eff = pickerEffectiveMarch(base, player);
    return Number(eff).toLocaleString("en-US");
  }

  function displayPickerBaseTitle(text) {
    return String(text || "")
      .replace(/\bCentral\s*Base\b/i, "Техно-Центр")
      .replace(/\bCentral\s*base\b/i, "Техно-Центр");
  }

  function towerStats(base) {
    const captain = base?.captainId
      ? state.playerById?.get?.(base.captainId)
      : null;
    const helpers = (base?.helperIds || [])
      .map((id) => state.playerById?.get?.(id))
      .filter(Boolean);
    const captainMarch = Number(captain?.march || 0) || 0;
    const rallySize = Number(captain?.rally || 0) || 0;
    const helpersSum = helpers.reduce(
      (s, p) => s + pickerEffectiveMarch(base, p),
      0,
    );
    const total = captainMarch + helpersSum;
    const capacity = captainMarch + rallySize;
    const free = Math.max(0, capacity - total);
    return { captainMarch, rallySize, total, capacity, free };
  }

  function getBaseRuleForPicker(base) {
    const src =
      typeof PNS.getBaseTowerRule === "function"
        ? PNS.getBaseTowerRule(base.id)
        : null;
    return {
      maxHelpers: Number(src?.maxHelpers ?? base?.maxHelpers ?? 29) || 29,
      tierMinMarch: {
        T14:
          Number(src?.tierMinMarch?.T14 ?? base?.tierMinMarch?.T14 ?? 0) || 0,
        T13:
          Number(src?.tierMinMarch?.T13 ?? base?.tierMinMarch?.T13 ?? 0) || 0,
        T12:
          Number(src?.tierMinMarch?.T12 ?? base?.tierMinMarch?.T12 ?? 0) || 0,
        T11:
          Number(src?.tierMinMarch?.T11 ?? base?.tierMinMarch?.T11 ?? 0) || 0,
        T10:
          Number(src?.tierMinMarch?.T10 ?? base?.tierMinMarch?.T10 ?? 0) || 0,
        T9: Number(src?.tierMinMarch?.T9 ?? base?.tierMinMarch?.T9 ?? 0) || 0,
      },
    };
  }

  function updateTowerPickerDetail() {
    const modal = document.getElementById("towerPickerModal");
    if (!modal) return;
    const detail = modal.querySelector(".tower-picker-detail");
    if (!detail) return;
    const baseId = getTowerPickerSelectedBaseId();
    state.towerPickerSelectedBaseId = baseId;
    const base = state.baseById?.get?.(baseId);
    if (!base) {
      detail.innerHTML = `<div class="muted">${t('choose_turret_left', 'Оберіть турель зліва')}</div>`;
      return;
    }

    const title = displayPickerBaseTitle(
      String(base.title || baseId)
        .split("/")[0]
        .trim(),
    );
    const captain = base.captainId
      ? state.playerById?.get?.(base.captainId)
      : null;
    const caps = eligibleCaptainsForBase(base);
    const rule = getBaseRuleForPicker(base);
    const helperRows = (base.helperIds || [])
      .map((id) => state.playerById?.get?.(id))
      .filter(Boolean);
    const stats = towerStats(base);

    detail.innerHTML = `
      <div class="stack">
        <h3>${title}</h3>
        <div class="picker-meta-row muted small">
          <span class="picker-meta-shift">${t('shift', 'Зміна')}: ${state.activeShift === "shift1" ? t('shift1', 'Зміна 1') : state.activeShift === "shift2" ? t('shift2', 'Зміна 2') : t('both', 'Обидві')}</span>
          <label class="picker-only-captains"><input type="checkbox" id="pickerOnlyCaptains" ${isPickerOnlyCaptainsEnabled() ? "checked" : ""}/> ${t('only_captains', 'Тільки капітани')}</label>
          <label class="picker-only-captains"><input type="checkbox" id="pickerMatchRegisteredShift" ${isPickerMatchRegisteredShiftEnabled() ? "checked" : ""}/> ${t('respect_player_shift', 'Враховувати зміну гравця')}</label>
          <label class="picker-only-captains"><input type="checkbox" id="pickerNoMixTroops" ${isPickerNoMixTroopsEnabled() ? "checked" : ""}/> ${t('same_troop_only', 'Лише той самий тип військ')}</label>
          <label class="picker-only-captains"><input type="checkbox" id="pickerNoCrossShiftDupes" ${isPickerNoCrossShiftDupesEnabled() ? "checked" : ""}/> ${t('use_both', 'Використовувати «Обидві»')}</label>
        </div>
        <div class="picker-topline top-space">
          <select id="towerPickerCaptainSelect" class="input-like" aria-label="${t('player_choice', 'Вибір гравця для турелі')}">
            <option value="">${captain ? t('change_captain', 'Змінити капітана…') : t('choose_captain', 'Вибрати капітана…')}</option>
            ${caps.map((p) => `<option value="${p.id}" ${captain && captain.id === p.id ? "selected" : ""}>${String(p.name || "")} · ${typeof PNS.roleLabel === "function" ? PNS.roleLabel(String(p.role || ""), false) : String(p.role || "")} · ${typeof PNS.shiftLabel === "function" ? PNS.shiftLabel(String(p.shiftLabel || p.shift || "")) : String(p.shiftLabel || p.shift || "")} · ${Number(p.march || 0).toLocaleString("en-US")}${p.captainReady ? ` · ${t('captain_tag_short', 'КАП')}` : ""}</option>`).join("")}
          </select>
          <div class="picker-actions">
            <button class="btn btn-sm" type="button" data-picker-set-captain="${base.id}">${t('place_captain', 'Поставити капітана')}</button>
            <button class="btn btn-sm" type="button" data-picker-autofill="${base.id}">${t('auto_fill', 'Автозаповнення')}</button>
            <button class="btn btn-sm" type="button" data-picker-clear-base="${base.id}">${t('clear_turret', 'Очистити турель')}</button>
            <button class="btn btn-sm" type="button" data-picker-save-board="${base.id}">${t('save_turret_table', 'Зберегти таблицю турелі')}</button>
          </div>
        </div>

        <div class="limit-grid limit-grid-compact top-space">
          <div><span>${t('captain_march', 'Марш капітана')}</span><strong>${Number(stats.captainMarch || 0).toLocaleString("en-US")}</strong></div>
          <div><span>${t('rally_size', 'Розмір ралі')}</span><strong>${Number(stats.rallySize || 0).toLocaleString("en-US")}</strong></div>
          <div><span>${t('total_sum', 'Разом')}</span><strong>${Number(stats.total || 0).toLocaleString("en-US")}</strong></div>
          <div><span>${t('free_space', 'Вільне місце')}</span><strong>${Number(stats.free || 0).toLocaleString("en-US")}</strong></div>
        </div>

        <details class="tower-collapsible top-space" id="towerPickerLimitsBlock">
          <summary>${t('limits_by_tier', 'Налаштування турелі · ліміти по тірах')}</summary>
          <div class="inner stack">
            <div class="picker-limits-head">
              <label><span class="muted small">${t('max_players', 'Макс. гравців')}</span><input id="pickerMaxHelpers" type="number" min="0" value="${rule.maxHelpers}" /></label>
              <button class="btn btn-sm" type="button" data-picker-save-rule="${base.id}">${t('save_limits', 'Зберегти ліміти')}</button>
              <button class="btn btn-sm" type="button" data-picker-recalc-rule="${base.id}">${t('recalc_composition', 'Перерахувати склад')}</button>
              <button class="btn btn-sm" type="button" data-picker-reset-rule="${base.id}">${t('reset_limits', 'Скинути ліміти')}</button>
            </div>
            <div class="row gap wrap">
              ${["T14", "T13", "T12", "T11", "T10", "T9"].map((t) => `<label><span class="muted small">${t}</span><input type="number" min="0" data-picker-tier="${t}" value="${rule.tierMinMarch[t] || 0}" style="width:90px" /></label>`).join("")}
            </div>
            <div class="muted small">${t('flexible_tier_note', '0 = гнучкий тір: бере повний марш, а якщо місця не вистачає — ділить залишок між гравцями цього тіру.')}</div>
          </div>
        </details>

        <details class="tower-collapsible" id="towerPickerManualBlock">
          <summary>${t('add_player_manually', 'Додати гравця вручну')}</summary>
          <div class="inner stack">
            <div class="picker-manual-row">
              <input id="pickerManualSearch" list="pickerManualPlayerSuggestions" placeholder="${t('search_player_from_list', 'Пошук гравця (зі списку)')}" autocomplete="off" spellcheck="false" />
              <input id="pickerManualName" placeholder="${t('nickname_custom', 'Нік (можна свій, не зі списку)')}" autocomplete="off" />
              <datalist id="pickerManualPlayerSuggestions">
                ${(state.players || [])
                  .slice()
                  .sort((a, b) =>
                    String(a.name || "").localeCompare(String(b.name || "")),
                  )
                  .map(
                    (p) =>
                      `<option value="${PNS.escapeHtml(String(p.name || ""))}" label="${PNS.escapeHtml(String(p.alliance || ""))} · ${PNS.escapeHtml(typeof PNS.roleLabel === "function" ? PNS.roleLabel(String(p.role || ""), false) : String(p.role || ""))} · ${PNS.escapeHtml(String(p.tier || ""))} · ${Number(p.march || 0).toLocaleString("en-US")}"></option>`,
                  )
                  .join("")}
              </datalist>
              <input id="pickerManualAlly" placeholder="${t('ally', 'Альянс')}" />
              <select id="pickerManualRole"><option value="Fighter">${t('fighter', 'Боєць')}</option><option value="Shooter">${t('shooter', 'Стрілець')}</option><option value="Rider">${t('rider', 'Наїзник')}</option></select>
            </div>
            <div id="pickerManualHint" class="picker-manual-hint muted small"></div>
            <div class="picker-manual-row2">
              <input id="pickerManualTier" placeholder="T14" />
              <input id="pickerManualMarch" placeholder="${t('march', 'Марш')}" type="number" min="0" />
              <input id="pickerManualRally" placeholder="${t('rally_size', 'Розмір ралі')}" type="number" min="0" />
              <button class="btn btn-sm" type="button" data-picker-add-manual-captain="${base.id}">${t('place_captain', 'Поставити капітана')}</button>
              <button class="btn btn-sm" type="button" data-picker-add-manual="${base.id}">${t('add_player_manually', 'Додати гравця вручну')}</button>
            </div>
          </div>
        </details>

        <div class="panel subpanel" style="padding:10px">
          <div class="row gap wrap" style="justify-content:space-between"><strong>${t('players_in_turret_title', 'Гравці в турелі')}</strong><span class="muted small">${captain ? t('captain_and_players', 'Капітан і гравці') : t('no_captain', 'Без капітана')}</span></div>
          <div class="helpers-table-wrap top-space">
            <table class="mini-table">
              <thead><tr><th>${t('player', 'Гравець')}</th><th>${t('ally', 'Альянс')}</th><th>${t('role', 'Роль')}</th><th>${t('tier', 'Тір')}</th><th>${t('march', 'Марш')}</th><th>✎</th></tr></thead>
              <tbody>
                ${captain ? `<tr><td>${captain.name}</td><td>${captain.alliance || ""}</td><td>${typeof PNS.roleLabel === "function" ? PNS.roleLabel(captain.role || "", false) : (captain.role || "")}</td><td>${captain.tier || ""}</td><td>${pickerMarchCell(base, captain, { isCaptain: true })}</td><td><button class="btn btn-xs" type="button" data-picker-edit-player="${captain.id}" data-picker-edit-base="${base.id}">✎</button></td></tr>` : ""}
                ${helperRows.map((p) => `<tr><td>${p.name}</td><td>${p.alliance || ""}</td><td>${typeof PNS.roleLabel === "function" ? PNS.roleLabel(p.role || "", false) : (p.role || "")}</td><td>${p.tier || ""}</td><td>${pickerMarchCell(base, p)}</td><td><button class="btn btn-xs" type="button" data-picker-edit-player="${p.id}" data-picker-edit-base="${base.id}">✎</button></td></tr>`).join("")}
                ${!captain && !helperRows.length ? `<tr><td colspan="6" class="muted">${t('no_assigned_players', 'Немає призначених гравців')}</td></tr>` : ""}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;

    const sel = modal.querySelector(
      ".tower-picker-list [data-pick-tower-id].active",
    );
    modal
      .querySelectorAll(".tower-picker-list [data-pick-tower-id]")
      .forEach((b) => b.classList.toggle("active", b === sel));
  }

  function refreshTowerPickerModalList() {
    const modal = document.getElementById("towerPickerModal");
    if (!modal) return;
    const list = modal.querySelector(".tower-picker-list");
    if (!list) return;
    list.innerHTML = "";
    (MS.getTowerCards?.() || []).forEach((card, idx) => {
      const id = String(card.dataset.baseId || card.dataset.baseid || "");
      const title = displayPickerBaseTitle(
        (card.querySelector("h3")?.textContent || `${t('turret', 'Турель')} ${idx + 1}`)
.split("/")[0].trim(),
      );
      const base = state.baseById?.get?.(id) || MS.cardBaseState?.(card);
      const done = !!(base && base.captainId);
      const playersCount = base
        ? Number(base.captainId ? 1 : 0) + Number((base.helperIds || []).length)
        : 0;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "btn btn-sm tower-picker-item" +
        (state.towerPickerSelectedBaseId === id ? " active" : "") +
        (done ? " is-ready tower-done" : " is-not-ready");
      btn.dataset.pickTowerId = id;
      const statusIcon = done ? "✓" : "!";
      const statusLabel = done ? t('ready', 'Готова') : t('no_captain_short', 'Без капітана');
      const countCls = done ? "is-ready" : "is-not-ready";
      btn.innerHTML = `<div class="tower-item-row"><strong>${title}</strong><span class="tower-item-status" aria-hidden="true">${statusIcon}</span></div><span class="muted small">${statusLabel} · <span class="tower-item-count ${countCls}">${t('players_short', 'гравців')}: ${playersCount}</span></span>`;
      list.appendChild(btn);
    });
  }

  function bindTowerPickerLiveRefreshOnce() {
    if (state._towerPickerLiveRefreshBound) return;
    state._towerPickerLiveRefreshBound = true;

    document.addEventListener("change", (e) => {
      const cb = e.target.closest(
        "#pickerOnlyCaptains,#pickerMatchRegisteredShift,#pickerNoMixTroops,#pickerNoCrossShiftDupes",
      );
      if (!cb) return;
      try {
        if (cb.id === "pickerOnlyCaptains") {
          state.towerPickerOnlyCaptains = !!cb.checked;
          localStorage.setItem("pns_picker_only_captains", cb.checked ? "1" : "0");
        }
        if (cb.id === "pickerMatchRegisteredShift") {
          state.towerPickerMatchRegisteredShift = !!cb.checked;
          localStorage.setItem("pns_picker_match_registered_shift", cb.checked ? "1" : "0");
        }
        if (cb.id === "pickerNoMixTroops") {
          state.towerPickerNoMixTroops = !!cb.checked;
          localStorage.setItem(
            "pns_picker_no_mix_troops",
            cb.checked ? "1" : "0",
          );
        }
        if (cb.id === "pickerNoCrossShiftDupes") {
          state.towerPickerNoCrossShiftDupes = !!cb.checked;
          localStorage.setItem(
            "pns_picker_no_cross_shift_dupes",
            cb.checked ? "1" : "0",
          );

          const calcModal = document.getElementById("towerCalcModal");
          const ig = calcModal?.querySelector?.("#towerCalcIgnoreBoth");
          if (ig) {
            ig.checked = !cb.checked;
            try {
              ig.dispatchEvent(new Event("change", { bubbles: true }));
            } catch {}
          }
        }
      } catch {}
      setTimeout(() => {
        try {
          updateTowerPickerDetail();
        } catch {}
        try {
          MS.syncSettingsTowerPreview?.();
        } catch {}
      }, 0);
    });

    document.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-picker-shift-tab][data-shift-tab]");
      if (!tab) return;
      setTimeout(() => {
        const modal = document.getElementById("towerPickerModal");
        if (!modal || !modal.classList.contains("is-open")) return;
        try {
          refreshTowerPickerModalList();
          updateTowerPickerDetail();
        } catch {}
      }, 90);
    });

    document.addEventListener("pns:assignment-changed", () => {
      setTimeout(() => {
        const modal = document.getElementById("towerPickerModal");
        if (!modal || !modal.classList.contains("is-open")) return;
        try {
          refreshTowerPickerModalList();
          updateTowerPickerDetail();
        } catch {}
      }, 50);
    });
  }

  function openTowerPickerModal() {
    MS.ensureStep4Styles?.();
    bindTowerPickerLiveRefreshOnce();
    if (typeof state.towerPickerOnlyCaptains !== "boolean")
      state.towerPickerOnlyCaptains = true;
    if (typeof state.towerPickerMatchRegisteredShift !== "boolean")
      state.towerPickerMatchRegisteredShift = true;
    if (typeof state.towerPickerNoMixTroops !== "boolean")
      state.towerPickerNoMixTroops = isPickerNoMixTroopsEnabled();
    if (typeof state.towerPickerNoCrossShiftDupes !== "boolean")
      state.towerPickerNoCrossShiftDupes = isPickerNoCrossShiftDupesEnabled();
    let modal = document.getElementById("towerPickerModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "towerPickerModal";
      modal.className = "modal tower-picker-modal";
      modal.innerHTML = `
        <div class="modal-backdrop" data-close-tower-picker></div>
        <div class="modal-card" role="dialog" aria-modal="true">
          <div class="modal-head tower-picker-head">
            <div class="tower-picker-head-left"><h2>${t('tower_settings', 'Налаштування турелей')}</h2><p class="muted">${t('tower_settings_hint', 'Оберіть турель зліва та налаштуйте її праворуч.')}</p></div>
            <div class="tower-picker-head-center">
              <button class="btn btn-sm shift-mini" type="button" data-picker-shift-tab="shift1" data-shift-tab="shift1">${shiftLabel("shift1")}</button>
              <button class="btn btn-sm shift-mini" type="button" data-picker-shift-tab="shift2" data-shift-tab="shift2">${shiftLabel("shift2")}</button>
              <button class="btn btn-sm shift-mini" type="button" data-action="open-board">${t('final_plan', 'Фінальний план')}</button>
            </div>
            <button class="btn btn-icon" type="button" data-close-tower-picker>✕</button>
          </div>
          <div class="modal-grid" style="grid-template-columns: 220px minmax(0,1fr); gap:10px;">
            <section class="panel subpanel"><div class="stack tower-picker-list"></div></section>
            <section class="panel subpanel tower-picker-detail"></section>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
    modal.classList.add("is-open");
    MS.syncBodyModalLock?.();
    MS.updateShiftTabButtons?.();
    state.towerPickerSelectedBaseId = getTowerPickerSelectedBaseId();
    refreshTowerPickerModalList();
    updateTowerPickerDetail();
  }

  Object.assign(MS, {
    getTowerPickerSelectedBaseId,
    eligibleCaptainsForBase,
    getBaseRuleForPicker,
    updateTowerPickerDetail,
    refreshTowerPickerModalList,
    openTowerPickerModal,
    isPickerNoMixTroopsEnabled,
    isPickerNoCrossShiftDupesEnabled,
  });

  PNS.isTowerNoMixTroopsEnabled = isPickerNoMixTroopsEnabled;
  PNS.isTowerNoCrossShiftDupesEnabled = isPickerNoCrossShiftDupesEnabled;
})();
