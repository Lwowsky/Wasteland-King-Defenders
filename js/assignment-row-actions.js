/* Assignment row actions */
(function(){
  const e = window.PNS;
  if (!e) return;

  const { state } = e;
  const t = (key, fallback="") => typeof e.assignmentText === "function" ? e.assignmentText(key, fallback) : fallback;

  function getActiveShiftKeys() {
    let count = 2;
    try {
      if (typeof e.getTowerCalcShiftCount === "function") count = Number(e.getTowerCalcShiftCount()) || 2;
    } catch {}
    count = Math.max(1, Math.min(4, count));
    return Array.from({ length: count }, (_, index) => `shift${index + 1}`);
  }

  function getPlacementForShift(player, shift) {
    const shiftKey = String(shift || "").toLowerCase();
    const shiftLabel = typeof e.assignmentShiftLabel === "function"
      ? e.assignmentShiftLabel(shiftKey)
      : (/^shift[1-4]$/.test(shiftKey) ? t(shiftKey, `Зміна ${shiftKey.replace("shift", "")}`) : t("both", "Всі"));

    const assignment = (() => {
      const planRoot = state.shiftPlans?.[shiftKey] || null;
      const planPlayers = planRoot && typeof planRoot === "object" && planRoot.players && typeof planRoot.players === "object" ? planRoot.players : null;
      if (planPlayers) {
        const plan = planPlayers[player?.id] || null;
        return plan && plan.baseId ? { ...plan } : null;
      }
      const current = String(state.activeShift || "").toLowerCase();
      if (current === shiftKey && player?.assignment?.baseId) return { ...player.assignment };
      return null;
    })();

    if (!assignment?.baseId) {
      return {
        shift: shiftKey,
        shiftLabel,
        assigned: false,
        title: t("reserve", "Резерв"),
        detail: t("not_assigned", "Не призначено")
      };
    }

    const base = state.baseById?.get?.(assignment.baseId) || null;
    const rawTitle = String(base?.title || t("turret", "Турель")).split("/")[0].trim() || t("turret", "Турель");
    return {
      shift: shiftKey,
      shiftLabel,
      assigned: true,
      title: typeof e.towerLabel === "function" ? e.towerLabel(rawTitle) : rawTitle,
      detail: assignment.kind === "captain" ? t("captain", "Капітан") : t("helper", "Помічник")
    };
  }

  function renderPlacementCard(player) {
    const activeShift = String(state.activeShift || "").toLowerCase();
    const itemsHtml = getActiveShiftKeys().map(shift => {
      const item = getPlacementForShift(player, shift);
      return e.renderHtmlTemplate("tpl-player-placement-item", {
        item_class: e.escapeHtml([
          "player-placement-item",
          item.assigned ? "is-assigned" : "is-reserve",
          activeShift === shift ? "is-active" : ""
        ].filter(Boolean).join(" ")),
        shift_label: e.escapeHtml(item.shiftLabel),
        title: e.escapeHtml(item.title),
        detail: e.escapeHtml(item.detail)
      });
    }).join("");

    return e.renderHtmlTemplate("tpl-player-placement-card", {
      items_html: itemsHtml,
      player_id: e.escapeHtml(String(player.id || "")),
      edit_text: e.escapeHtml(t("edit", "Редагувати"))
    });
  }

  function buildRowActions() {
    state.players.forEach(player => {
      const actionCell = player.actionCellEl;
      if (!actionCell) return;
      actionCell.classList.remove("muted");
      actionCell.innerHTML = renderPlacementCard(player);

      const editBtn = actionCell.querySelector("[data-edit-player-placement]");
      if (!editBtn) return;
      editBtn.addEventListener("click", () => {
        if (e.ModalsShift?.openRosterPlayerEditModal) {
          e.ModalsShift.openRosterPlayerEditModal(player.id);
          return;
        }
        const firstBaseId = state.bases?.[0]?.id || "";
        if (firstBaseId && e.ModalsShift?.openTowerPlayerEditModal) {
          e.ModalsShift.openTowerPlayerEditModal(firstBaseId, player.id);
        }
      });
    });
  }

  e.buildRowActions = buildRowActions;
}());
