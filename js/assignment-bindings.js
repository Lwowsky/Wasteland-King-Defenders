/* Assignment UI bindings */
(function(){
  const e = window.PNS;
  if (!e) return;

  const { state } = e;
  const t = (key, fallback="") => typeof e.assignmentText === "function" ? e.assignmentText(key, fallback) : fallback;

  function bindBaseToolsDelegation() {
    if (state._baseToolsDelegationBound) return;

    document.addEventListener("click", event => {
      const autofillBtn = event.target.closest("[data-base-autofill]");
      if (autofillBtn) {
        event.preventDefault();
        if (typeof e.autoFillBase === "function") e.autoFillBase(autofillBtn.dataset.baseAutofill);
        return;
      }

      const clearHelpersBtn = event.target.closest("[data-base-clear-helpers]");
      if (clearHelpersBtn) {
        event.preventDefault();
        e.clearBase?.(clearHelpersBtn.dataset.baseClearHelpers, true);
        return;
      }

      const clearAllBtn = event.target.closest("[data-base-clear-all]");
      if (clearAllBtn) {
        event.preventDefault();
        e.clearBase?.(clearAllBtn.dataset.baseClearAll, false);
        return;
      }

      const removePlayerBtn = event.target.closest("[data-base-remove-player]");
      if (removePlayerBtn) {
        event.preventDefault();
        e.removePlayerFromSpecificBase?.(removePlayerBtn.dataset.baseRemovePlayer, removePlayerBtn.dataset.playerId);
        return;
      }

      const editorActionBtn = event.target.closest("[data-base-editor-action]");
      const legacyEditorEnabled = typeof e.isLegacyBaseEditorEnabled === "function"
        ? !!e.isLegacyBaseEditorEnabled()
        : (typeof e.shouldRenderLegacyBaseEditor === "function" && !!e.shouldRenderLegacyBaseEditor());
      if (!editorActionBtn || !legacyEditorEnabled) return;

      event.preventDefault();
      const baseId = editorActionBtn.dataset.baseId;
      const base = state.baseById.get(baseId);
      const editor = base?.cardEl ? base.cardEl.querySelector(".base-editor") : null;
      const selectedPlayerId = (editor ? editor.querySelector(`select[data-base-editor-select="${baseId}"]`) : null)?.value || "";
      if (!base) return;

      if (editorActionBtn.dataset.baseEditorAction === "manualsave") {
        if (typeof e.saveManualPlayerFromBaseEditor === "function") e.saveManualPlayerFromBaseEditor(baseId);
        return;
      }

      if (editorActionBtn.dataset.baseEditorAction === "remove") {
        if (!selectedPlayerId) {
          alert(t("select_player_to_remove", "Вибери гравця, якого треба прибрати з цієї турелі"));
          return;
        }
        if (!e.removePlayerFromSpecificBase?.(baseId, selectedPlayerId)) {
          alert(t("selected_player_not_assigned", "Вибраний гравець не призначений до цієї турелі."));
        }
        return;
      }

      if (!selectedPlayerId) {
        alert(t("choose_player_first", "Спочатку вибери гравця"));
        return;
      }
      e.assignPlayerToBase?.(selectedPlayerId, baseId, editorActionBtn.dataset.baseEditorAction);
    });

    state._baseToolsDelegationBound = true;
  }

  function assignmentsInit() {
    if (!state || !Array.isArray(state.players) || !Array.isArray(state.bases)) return;
    e.buildRowActions?.();
    bindBaseToolsDelegation();
  }

  e.bindAssignmentBaseTools = bindBaseToolsDelegation;
  e.assignmentsInit = assignmentsInit;
}());
