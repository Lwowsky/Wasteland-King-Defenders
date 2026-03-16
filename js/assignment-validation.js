/* Assignment validation */
(function(){
  const e = window.PNS;
  if (!e) return;

  const { state } = e;
  const t = (key, fallback="") => typeof e.assignmentText === "function" ? e.assignmentText(key, fallback) : fallback;
  const roleLabel = role => typeof e.assignmentRoleLabel === "function" ? e.assignmentRoleLabel(role) : String(role || "");
  const shiftLabel = shift => typeof e.assignmentShiftLabel === "function" ? e.assignmentShiftLabel(shift) : String(shift || "");

  function getEffectiveMarch(base, player) {
    if (!player) return 0;
    if (typeof e.getTowerEffectiveMarch === "function") {
      return Number(e.getTowerEffectiveMarch(base, player)) || 0;
    }
    return Number(player.march || 0) || 0;
  }

  function getTowerPolicy(player, base, kind) {
    try {
      if (typeof e.getTowerAssignmentPolicy === "function") {
        return e.getTowerAssignmentPolicy(player, base, kind) || {};
      }
    } catch {}
    return {};
  }

  function helperSameTroopOnlyDefault() {
    try {
      if (typeof e.getTowerAssignmentPolicy === "function") return !!e.getTowerAssignmentPolicy(null, null, "helper").sameTroopOnly;
    } catch {}
    try {
      if (typeof e.isTowerNoMixTroopsEnabled === "function") return !!e.isTowerNoMixTroopsEnabled();
    } catch {}
    return true;
  }

  function noCrossShiftDupesDefault() {
    try {
      if (typeof e.getTowerAssignmentPolicy === "function") return !!e.getTowerAssignmentPolicy(null, null, "helper").noCrossShiftDupes;
    } catch {}
    try {
      if (typeof e.isTowerNoCrossShiftDupesEnabled === "function") return !!e.isTowerNoCrossShiftDupesEnabled();
    } catch {}
    return true;
  }

  function validateAssignCore(player, base, kind) {
    if (!player || !base) return t("player_or_turret_not_found", "Гравця або турель не знайдено.");
    if (!e.ROLE_KEYS?.includes?.(player.role)) {
      return `${t("troop_type_unknown_for", "Не вдалося визначити тип військ для")} ${player.name}.`;
    }

    const policy = getTowerPolicy(player, base, kind);
    const allowCrossShiftReuse = !!policy.allowCrossShiftReuse;
    const ignoreShiftMismatch = !!policy.ignoreShiftMismatch;

    if (kind === "helper" && !ignoreShiftMismatch && !allowCrossShiftReuse && base.shift !== "both" && player.shift !== "both" && base.shift !== player.shift) {
      return `${t("shift_mismatch", "Невідповідність зміни")}: ${shiftLabel(player.shiftLabel || player.shift)} vs ${String(base.title || "").split("/")[0].trim()}.`;
    }

    if (kind === "helper" && !base.captainId) {
      return `${t("place_captain_first", "Спочатку постав капітана в турель")} «${base.title}».`;
    }

    const baseRole = typeof e.getBaseRole === "function" ? e.getBaseRole(base) : null;
    const sameTroopOnly = policy.sameTroopOnly ?? helperSameTroopOnlyDefault();
    if (kind === "helper" && sameTroopOnly && baseRole && player.role !== baseRole) {
      return `${t("troop_mismatch", "Невідповідність типу військ")}: ${roleLabel(player.role)} ${t("cannot_be_assigned_to", "не може бути призначений у турель типу")} ${roleLabel(baseRole)}.`;
    }

    const noCrossShiftDupes = policy.noCrossShiftDupes ?? noCrossShiftDupesDefault();
    if (kind === "helper" && noCrossShiftDupes) {
      const activeShift = String(state.activeShift || "").toLowerCase();
      if (activeShift === "shift1" || activeShift === "shift2") {
        const blocker = policy.otherShiftBlocker || policy.otherShiftHit ||
          (typeof e.getOtherShiftBlocker === "function" ? e.getOtherShiftBlocker(player.id, activeShift, kind) : null) ||
          (typeof e.isPlayerUsedInOtherShift === "function" ? e.isPlayerUsedInOtherShift(player.id, activeShift) : null);
        if (blocker) {
          return `${t("already_assigned_in", "Гравець уже призначений у")} ${blocker.label || shiftLabel(blocker.shift) || t("other_shift", "іншій зміні")}.`;
        }
      }
    }

    if (kind === "helper") {
      const helperCount = base.helperIds.filter(id => id !== player.id).length + 1;
      if (Number.isFinite(base.maxHelpers) && base.maxHelpers > 0 && helperCount > base.maxHelpers) {
        return `${t("helpers_limit_full", "Ліміт помічників заповнений")}: ${helperCount}/${base.maxHelpers}.`;
      }

      const captain = state.playerById.get(base.captainId);
      const rallyLimit = captain && ((captain.rally || 0) + (captain.march || 0) || captain.march) || 0;
      const currentHelpersMarch = base.helperIds.reduce((sum, helperId) => {
        if (helperId === player.id) return sum;
        return sum + getEffectiveMarch(base, state.playerById.get(helperId));
      }, 0);
      const projectedMarch = (captain?.march || 0) + currentHelpersMarch + getEffectiveMarch(base, player);
      if (rallyLimit && projectedMarch > rallyLimit) {
        return `${t("limit_exceeded", "Перевищено ліміт")}: ${e.formatNum(projectedMarch)} > ${e.formatNum(rallyLimit)}.`;
      }
    }

    return "";
  }

  e.validateAssignCore = validateAssignCore;
  e.validateAssign = validateAssignCore;
}());
