/* ==== autofill.js ==== */
/* Autofill helpers and tower effective march calculations */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;
  const { state } = PNS;
  const AF = PNS.Autofill || {};
  const {
    t,
    num,
    pushUnique,
    towerLabel,
    isEligiblePlayer,
    isNoMixTroopsEnabled,
    isMatchRegisteredShiftEnabled,
    getBaseShift,
    getTowerEffectiveMarch,
    getTowerRallyCapacity,
    getAssignedHelpersMarch,
    collectAutofillStats,
  } = AF;

  function autoFillBase(baseId){
    const base = state.baseById?.get?.(baseId);
    if (!base) return { added: 0, reason: t("turret_not_found", "Турель не знайдена") };

    if (!Array.isArray(base.helperIds)) base.helperIds = [];
    base.helperIds = Array.from(new Set(base.helperIds));

    const defaultMaxHelpers = num(state.autoFillSettings?.maxHelpers) || 29;
    if (!num(base.maxHelpers)) base.maxHelpers = defaultMaxHelpers;

    if (!base.captainId) {
      const message = `${t("choose_captain_for_turret", "Спочатку обери капітана для")} ${towerLabel(base)}`;
      alert(message);
      return { added: 0, reason: message };
    }

    const captain = state.playerById?.get?.(base.captainId);
    if (!captain) return { added: 0, reason: t("captain_not_found", "Капітана не знайдено") };

    try {
      if (typeof PNS.setBaseTowerRule === "function" && typeof PNS.readBaseEditorSettingsInputs === "function") {
        PNS.setBaseTowerRule(base.id, PNS.readBaseEditorSettingsInputs(base), { persist: true, rerender: false });
      }
    } catch {}

    if (typeof PNS.applyBaseRoleUI === "function") PNS.applyBaseRoleUI(base, captain.role);

    const beforeCount = base.helperIds.length;
    const rallyCapacity = getTowerRallyCapacity(captain);
    let room = rallyCapacity ? Math.max(0, rallyCapacity - num(captain.march) - getAssignedHelpersMarch(base)) : Infinity;
    const respectCrossShiftDupes = true;
    const matchRegisteredShift = isMatchRegisteredShiftEnabled();
    const baseShift = getBaseShift(base);
    const hasValidateAssign = typeof PNS.validateAssign === "function";

    const normalizeDuplicateNick = typeof PNS.normalizeDuplicateNick === "function"
      ? PNS.normalizeDuplicateNick
      : (value => String(value || "").trim().toLowerCase());
    const getRegistrationStamp = (player) => {
      try {
        const info = typeof PNS.getPlayerRegistrationInfo === "function" ? PNS.getPlayerRegistrationInfo(player) : null;
        const raw = info?.raw;
        if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.getTime();
        if (typeof raw === "number" && Number.isFinite(raw)) {
          if (raw > 20000 && raw < 100000) {
            const excelEpoch = Date.UTC(1899, 11, 30);
            return excelEpoch + raw * 86400000;
          }
          return raw;
        }
        const parsed = Date.parse(String(raw || "").trim());
        if (!Number.isNaN(parsed)) return parsed;
      } catch {}
      return Number.POSITIVE_INFINITY;
    };

    const compareAutofillCandidates = (left, right) => (
      num(right?.tierRank) - num(left?.tierRank)
      || num(right?.march) - num(left?.march)
      || getRegistrationStamp(left) - getRegistrationStamp(right)
      || String(left?.name || '').localeCompare(String(right?.name || ''))
      || String(left?.id || '').localeCompare(String(right?.id || ''))
    );

    const resolveAssignedShift = (player, fallbackBase = null) => {
      const assignedBase = fallbackBase || state.baseById?.get?.(player?.assignment?.baseId);
      const resolved = String(
        (typeof PNS.getBaseShift === "function" ? PNS.getBaseShift(assignedBase) : "")
        || assignedBase?.shift
        || player?.assignment?.shift
        || player?.shift
        || player?.shiftLabel
        || state.activeShift
        || ""
      );
      return PNS.normalizeShift ? PNS.normalizeShift(resolved) : String(resolved || '').trim().toLowerCase();
    };

    const assignedNickKeysInShift = new Set(
      (state.players || [])
        .filter(player => player && player.assignment?.baseId)
        .filter(player => resolveAssignedShift(player) === baseShift)
        .map(player => normalizeDuplicateNick(player?.name || ''))
        .filter(Boolean)
    );

    const rawCandidates = (state.players || [])
      .filter(player => player && player.id !== captain.id)
      .filter(player => !player.assignment)
      .filter(player => !isNoMixTroopsEnabled() || player.role === captain.role)
      .filter(player => {
        const noCrossShiftDupes = state.towerPickerNoCrossShiftDupes === true;
        const playerShift = String(player.shift || player.shiftLabel || "").trim().toLowerCase();
        return !noCrossShiftDupes || playerShift !== "both";
      })
      .filter(player => (!respectCrossShiftDupes && matchRegisteredShift) ? true : PNS.matchesShift(player.shift, baseShift))
      .filter(player => (!respectCrossShiftDupes && matchRegisteredShift) ? true : base.shift === 'both' || player.shift === 'both' || player.shift === base.shift)
      .filter(player => isEligiblePlayer(0, player))
      .sort(compareAutofillCandidates);

    const groupedByNick = new Map();
    for (const player of rawCandidates) {
      const key = normalizeDuplicateNick(player?.name || `__player_${player?.id || ""}`) || `__player_${player?.id || ""}`;
      if (assignedNickKeysInShift.has(key)) continue;
      if (!groupedByNick.has(key)) groupedByNick.set(key, []);
      groupedByNick.get(key).push(player);
    }
    groupedByNick.forEach((bucket) => bucket.sort(compareAutofillCandidates));

    const pickBestCandidateForGroup = (bucket) => {
      if (!Array.isArray(bucket) || !bucket.length) return null;
      for (const player of bucket) {
        const effectiveMarch = getTowerEffectiveMarch(base, player);
        if (room !== Infinity && effectiveMarch > room) continue;
        if (hasValidateAssign && PNS.validateAssign(player, base, "helper")) continue;
        return { player, effectiveMarch };
      }
      return null;
    };

    while (!(base.maxHelpers > 0 && base.helperIds.length >= base.maxHelpers)) {
      const candidatePool = [];
      groupedByNick.forEach((bucket, nickKey) => {
        if (assignedNickKeysInShift.has(nickKey)) return;
        const choice = pickBestCandidateForGroup(bucket);
        if (choice) candidatePool.push({ nickKey, player: choice.player, effectiveMarch: choice.effectiveMarch });
      });
      if (!candidatePool.length) break;
      candidatePool.sort((a, b) => compareAutofillCandidates(a.player, b.player) || a.effectiveMarch - b.effectiveMarch);
      const selected = candidatePool[0];
      pushUnique(base.helperIds, selected.player.id);
      selected.player.assignment = { baseId: base.id, kind: "helper" };
      assignedNickKeysInShift.add(selected.nickKey);
      if (room !== Infinity) room -= selected.effectiveMarch;
      groupedByNick.delete(selected.nickKey);
    }


    if (typeof PNS.renderAll === "function") PNS.renderAll();

    const added = base.helperIds.length - beforeCount;
    if (added <= 0) {
      let reason = "";
      const stats = collectAutofillStats(base, captain);
      if (!stats.sameRole && isNoMixTroopsEnabled()) {
        reason = `${t("no_free_players_of_role", "Немає вільних гравців типу")} ${typeof PNS.roleLabel === "function" ? PNS.roleLabel(captain.role, false) : String(captain.role || "")}.`;
      } else if (!respectCrossShiftDupes || !isMatchRegisteredShiftEnabled() || stats.byActiveShift) {
        if (!respectCrossShiftDupes || !isMatchRegisteredShiftEnabled() || stats.byBaseShift) {
          if (stats.passTierMin) {
            if ((base.maxHelpers || 0) > 0 && base.helperIds.length >= base.maxHelpers) {
              reason = `${t("helpers_limit_full_simple", "Ліміт помічників заповнений")} (${base.maxHelpers}).`;
            } else if (room !== Infinity && stats.fitRoom === 0) {
              reason = `${t("no_one_fits_rally_room", "Ніхто не вміщується в залишок ралі")} (${PNS.formatNum?.(Math.max(0, stats.room)) ?? Math.max(0, stats.room)}).`;
            } else {
              reason = t("no_players_after_checks", "Після перевірок не знайшлося відповідних гравців.");
            }
          } else {
            reason = t("no_players_for_tier_limits", "Немає гравців, які підходять під ліміти маршу за тірами.");
          }
        } else {
          reason = `${t("no_role_for_turret_shift", "Немає гравців цього типу, які підходять під зміну цієї турелі")}.`;
        }
      } else {
        reason = `${t("no_role_for_shift", "Немає гравців цього типу для зміни")} ${typeof PNS.shiftLabel === "function" ? PNS.shiftLabel(getBaseShift(base)) : String(getBaseShift(base) || "")}.`;
      }

      const counts = ` [free:${stats.free}, role:${stats.sameRole}, shift:${stats.byActiveShift}, tower:${stats.byBaseShift}, tierMin:${stats.passTierMin}, fit:${stats.fitRoom}]`;
      if (typeof PNS.setImportStatus === "function") {
        PNS.setImportStatus(`${t("auto_fill", "Автозаповнення")}: ${towerLabel(base)} → ${t("autofill_added_zero", "додано 0")}. ${reason}${counts}`, "danger");
      }
      return { added: 0, reason };
    }

    if (typeof PNS.setImportStatus === "function") {
      PNS.setImportStatus(`${t("auto_fill", "Автозаповнення")}: ${towerLabel(base)} → +${added} ${t("helpers_short", "помічники")}.`, "good");
    }
    return { added };
  }

  PNS.getTowerEffectiveMarch = getTowerEffectiveMarch;
  PNS.getEffectiveTowerMarch = getTowerEffectiveMarch;
  PNS.autoFillBase = autoFillBase;
})();
