/* Assignment row actions */
(function(){
  const e = window.PNS;
  if (!e) return;

  const { state } = e;
  const t = (key, fallback="") => typeof e.assignmentText === "function" ? e.assignmentText(key, fallback) : fallback;

  function getPlacementForShift(player, shift) {
    const shiftKey = String(shift || "").toLowerCase();
    const shiftLabel = typeof e.assignmentShiftLabel === "function"
      ? e.assignmentShiftLabel(shiftKey)
      : (shiftKey === "shift1" ? t("shift1", "Зміна 1") : t("shift2", "Зміна 2"));

    const assignment = (() => {
      const current = String(state.activeShift || "").toLowerCase();
      if (current === shiftKey) return player?.assignment ? { ...player.assignment } : null;
      const plan = (state.shiftPlans?.[shiftKey] || null)?.players?.[player?.id] || null;
      return plan ? { ...plan } : null;
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
    return {
      shift: shiftKey,
      shiftLabel,
      assigned: true,
      title: String(base?.title || t("turret", "Турель")).split("/")[0].trim() || t("turret", "Турель"),
      detail: assignment.kind === "captain" ? t("captain", "Капітан") : t("helper", "Помічник")
    };
  }

  function renderPlacementCard(player) {
    const activeShift = String(state.activeShift || "").toLowerCase();
    const itemsHtml = ["shift1", "shift2"].map(shift => {
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
