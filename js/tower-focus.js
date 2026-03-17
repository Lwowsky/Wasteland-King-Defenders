(function () {
  const PNS = window.PNS;
  if (!PNS) return;

  const ModalsShift = (PNS.ModalsShift = PNS.ModalsShift || {});
  const { state } = PNS;
  if (!state) return;

  const tt = (key, fallback = "") =>
    typeof PNS.t === "function" ? PNS.t(key, fallback) : fallback;

  function getTowerCards() {
    return Array.from(document.querySelectorAll(".bases-grid .base-card")).filter(
      (el) => !el.matches("[data-settings-card]")
    );
  }

  function getToggleButton() {
    return (
      ModalsShift.getButtons?.().toggleTowerView ||
      document.querySelector("#toggleTowerFocusBtn")
    );
  }

  function markFocusedCard(card) {
    if (!card) return;
    const baseId = card.dataset.baseId || card.dataset.baseid || "";
    if (baseId) state.focusedBaseId = baseId;
    getTowerCards().forEach((el) => el.classList.toggle("is-focused-tower", el === card));
  }

  function getFocusedCard() {
    const visibleFocused = document.querySelector(
      ".bases-grid .base-card.is-focused-tower:not([hidden])"
    );
    if (visibleFocused) return visibleFocused;

    if (state.focusedBaseId) {
      const escaped = window.CSS && CSS.escape
        ? CSS.escape(state.focusedBaseId)
        : String(state.focusedBaseId).replace(/"/g, '\\"');
      const card =
        document.querySelector(`.bases-grid .base-card[data-base-id="${escaped}"]`) ||
        document.querySelector(`.bases-grid .base-card[data-baseid="${escaped}"]`);
      if (card) return card;
    }

    return null;
  }

  function cardBaseState(card) {
    if (!card) return null;
    const baseId = card.dataset.baseId || card.dataset.baseid || "";
    return baseId && state.baseById?.get ? state.baseById.get(baseId) || null : null;
  }

  function isCardIncomplete(card) {
    const base = cardBaseState(card);
    if (base) return !base.captainId;
    return !!card?.querySelector?.(".captain-name.captain-empty");
  }

  function findNextIncompleteTower() {
    const cards = getTowerCards();
    return cards.find(isCardIncomplete) || cards[0] || null;
  }

  function syncTowerViewToggleButton() {
    const button = getToggleButton();
    if (!button) return;
    const isFocus = String(state.towerViewMode || "focus") === "focus";
    button.hidden = false;
    button.removeAttribute("aria-hidden");
    button.style.removeProperty("display");
    button.textContent = isFocus
      ? tt("all_turrets", "Показати всі турелі")
      : tt("one_turret_only", "Показати одну турель");
    button.dataset.mode = isFocus ? "focus" : "all";
    button.setAttribute("aria-pressed", String(isFocus));
  }

  function syncFocusedTowerSelect() {
    // intentionally lightweight; no dedicated select in current layout
  }

  function bindToggleButtonOnce() {
    const button = getToggleButton();
    if (!button || button.dataset.toggleBound === "1") return;
    button.dataset.toggleBound = "1";
    button.addEventListener("click", (event) => {
      try {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      } catch {}
      if (String(state.towerViewMode || "focus") === "focus") {
        showAllTowers();
      } else {
        focusCurrentTower();
      }
      try {
        ModalsShift.syncSettingsTowerPreview?.();
      } catch {}
    });
  }

  function applyTowerVisibilityMode() {
    const cards = getTowerCards();
    if (!cards.length) return;

    const mode = String(state.towerViewMode || "focus");
    if (mode !== "focus") {
      cards.forEach((card) => {
        card.hidden = false;
      });
      const focused = getFocusedCard() || findNextIncompleteTower() || cards[0] || null;
      if (focused) markFocusedCard(focused);
      syncTowerViewToggleButton();
      syncFocusedTowerSelect();
      return;
    }

    let focused = getFocusedCard();
    if (!focused) focused = findNextIncompleteTower();
    if (!focused) focused = cards[0] || null;
    if (!focused) return;

    markFocusedCard(focused);
    cards.forEach((card) => {
      card.hidden = card !== focused;
    });
    syncTowerViewToggleButton();
    syncFocusedTowerSelect();
  }

  function showAllTowers() {
    state.towerViewMode = "all";
    applyTowerVisibilityMode();
  }

  function focusCurrentTower() {
    state.towerViewMode = "focus";
    const active = document.activeElement?.closest?.(".base-card");
    if (active && getTowerCards().includes(active)) markFocusedCard(active);
    const focused = getFocusedCard() || findNextIncompleteTower() || getTowerCards()[0] || null;
    if (focused) {
      markFocusedCard(focused);
      applyTowerVisibilityMode();
      try {
        focused.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } catch {}
    }
  }

  function maybeAdvanceFocusedTower() {
    if (!state.autoAdvanceTowerOnAssign || String(state.towerViewMode || "focus") !== "focus") {
      return;
    }

    const focused = getFocusedCard();
    if (!focused) {
      applyTowerVisibilityMode();
      return;
    }

    if (isCardIncomplete(focused)) return;

    const cards = getTowerCards();
    const next = cards.find((card) => card !== focused && isCardIncomplete(card)) || cards[0] || focused;
    if (!next) return;

    markFocusedCard(next);
    cards.forEach((card) => {
      card.hidden = card !== next;
    });
    try {
      next.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch {}
    syncTowerViewToggleButton();
    syncFocusedTowerSelect();
  }

  function focusTowerById(baseId) {
    if (!baseId) return;
    const escaped = window.CSS && CSS.escape
      ? CSS.escape(baseId)
      : String(baseId).replace(/"/g, '\\"');
    const card =
      document.querySelector(`.bases-grid .base-card[data-base-id="${escaped}"]`) ||
      document.querySelector(`.bases-grid .base-card[data-baseid="${escaped}"]`);
    if (!card) return;

    state.towerViewMode = "focus";
    markFocusedCard(card);
    applyTowerVisibilityMode();
  }

  function handleFocusSelect(select) {
    if (!select) return;
    const value = String(select.value || "");
    const cards = getTowerCards();
    let card = null;

    if (value) {
      const escaped = window.CSS && CSS.escape ? CSS.escape(value) : value;
      card =
        document.querySelector(`.bases-grid .base-card[data-base-id="${escaped}"]`) ||
        document.querySelector(`.bases-grid .base-card[data-baseid="${escaped}"]`);
    }

    if (!card) {
      card = cards[Math.max(0, select.selectedIndex)] || cards[0] || null;
    }
    if (!card) return;

    if (!card.dataset.baseId && state.bases?.[Math.max(0, select.selectedIndex)]?.id) {
      card.dataset.baseId = state.bases[Math.max(0, select.selectedIndex)].id;
    }
    state.focusedBaseId = String(
      card.dataset.baseId || card.dataset.baseid || value || state.focusedBaseId || ""
    );
    state.towerViewMode = "focus";
    markFocusedCard(card);
    cards.forEach((item) => {
      item.hidden = item !== card;
    });
    syncTowerViewToggleButton();
    syncFocusedTowerSelect();
    try {
      card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch {}
  }

  function bindPreviewCardsOnce() {
    document.querySelectorAll(".shift-towers-preview .tower-thumb-card").forEach((card) => {
      if (card.dataset.previewBound === "1") return;
      card.dataset.previewBound = "1";
      card.style.cursor = "pointer";
      card.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          ModalsShift.focusTowerFromPreviewElement?.(card);
        } catch {}
      });
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        try {
          ModalsShift.focusTowerFromPreviewElement?.(card);
        } catch {}
      });
    });
  }

  Object.assign(ModalsShift, {
    getTowerCards,
    getVisibleTowerCards() {
      return getTowerCards().filter((card) => !card.hidden);
    },
    markFocusedCard,
    getFocusedCard,
    cardBaseState,
    isCardIncomplete,
    findNextIncompleteTower,
    applyTowerVisibilityMode,
    showAllTowers,
    focusCurrentTower,
    maybeAdvanceFocusedTower,
    syncTowerViewToggleButton,
    syncFocusedTowerSelect,
    focusTowerById,
    handleFocusSelect,
    bindPreviewCardsOnce,
  });

  try {
    state.towerViewMode = state.towerViewMode || "focus";
  } catch {}
  setTimeout(() => {
    try {
      bindPreviewCardsOnce();
    } catch {}
    try {
      bindToggleButtonOnce();
    } catch {}
    try {
      syncTowerViewToggleButton();
    } catch {}
  }, 0);

  document.addEventListener("DOMContentLoaded", () => {
    try {
      bindToggleButtonOnce();
    } catch {}
  });
})();
