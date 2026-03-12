(function () {
  const PNS = window.PNS; if (!PNS) return;
  const MS = (PNS.ModalsShift = PNS.ModalsShift || {});
  const { state } = PNS; if (!state) return;

  function getTowerCards() {
    return Array.from(document.querySelectorAll('.bases-grid .base-card')).filter(c => !c.matches('[data-settings-card]'));
  }
  function getVisibleTowerCards() {
    return getTowerCards().filter(c => !c.hidden);
  }
  function markFocusedCard(card) {
    if (!card) return;
    const id = card.dataset.baseId || card.dataset.baseid || '';
    state.focusedBaseId = id || state.focusedBaseId || '';
    getTowerCards().forEach(c => c.classList.toggle('is-focused-tower', c === card));
  }
  function getFocusedCard() {
    const byClass = document.querySelector('.bases-grid .base-card.is-focused-tower:not([hidden])');
    if (byClass) return byClass;
    if (state.focusedBaseId) {
      const esc = (window.CSS && CSS.escape) ? CSS.escape(state.focusedBaseId) : String(state.focusedBaseId).replace(/"/g, '\\"');
      const c = document.querySelector(`.bases-grid .base-card[data-base-id="${esc}"]`) ||
                document.querySelector(`.bases-grid .base-card[data-baseid="${esc}"]`);
      if (c && !c.hidden) return c;
    }
    return null;
  }
  function cardBaseState(card) {
    if (!card) return null;
    const id = card.dataset.baseId || card.dataset.baseid || '';
    if (!id || !state.baseById?.get) return null;
    return state.baseById.get(id) || null;
  }
  function isCardIncomplete(card) {
    const b = cardBaseState(card);
    if (b) return !b.captainId;
    return !!card.querySelector('.captain-name.captain-empty');
  }
  function findNextIncompleteTower() {
    const cards = getTowerCards();
    return cards.find(isCardIncomplete) || cards[0] || null;
  }

  function syncTowerViewToggleButton() {
    const b = (MS.getButtons?.().toggleTowerView) || document.querySelector('#toggleTowerFocusBtn');
    if (!b) return;
    const focusMode = (state.towerViewMode || 'all') === 'focus';
    b.textContent = focusMode ? 'Показати всі турелі' : 'Показати одну турель';
    b.dataset.mode = focusMode ? 'focus' : 'all';
    b.setAttribute('aria-pressed', String(focusMode));
  }

  function syncFocusedTowerSelect() {
    const sel = (MS.getButtons?.().focusTowerSelect) || document.querySelector('#focusTowerSelect');
    if (!sel) return;
    const bases = (state.bases || []).slice();
    const old = sel.value;
    const cards = getTowerCards();
    sel.innerHTML = '';
    cards.forEach((card, idx) => {
      let id = String(card.dataset.baseId || card.dataset.baseid || '');
      let base = id ? state.baseById?.get?.(id) : null;
      if (!base && bases[idx]) {
        base = bases[idx];
        id = String(base.id || id || `card-${idx}`);
        if (!card.dataset.baseId) card.dataset.baseId = id;
      }
      const title = (base?.title || card.querySelector('h3')?.textContent || `Турель ${idx + 1}`).split('/')[0].trim();
      const opt = document.createElement('option');
      opt.value = id || `card-${idx}`;
      opt.dataset.towerTitle = title;
      opt.textContent = title;
      sel.appendChild(opt);
    });
    const want = String(state.focusedBaseId || old || '');
    if (want && Array.from(sel.options).some(o => o.value === want)) sel.value = want;
    else if (sel.options.length) sel.value = sel.options[0].value;
  }

  function applyTowerVisibilityMode() {
    const mode = state.towerViewMode || 'all';
    const cards = getTowerCards();
    if (!cards.length) return;
    if (mode !== 'focus') {
      cards.forEach(c => { c.hidden = false; c.classList.remove('is-focused-tower'); });
      syncTowerViewToggleButton();
      syncFocusedTowerSelect();
      return;
    }
    let card = getFocusedCard();
    if (!card) card = findNextIncompleteTower();
    if (!card) return;
    markFocusedCard(card);
    cards.forEach(c => { c.hidden = c !== card; });
    syncTowerViewToggleButton();
    syncFocusedTowerSelect();
  }

  function showAllTowers() {
    state.towerViewMode = 'all';
    applyTowerVisibilityMode();
  }

  function focusCurrentTower() {
    state.towerViewMode = 'focus';
    const activeCard = document.activeElement?.closest?.('.base-card');
    if (activeCard && getTowerCards().includes(activeCard)) markFocusedCard(activeCard);
    const current = getFocusedCard() || findNextIncompleteTower();
    if (current) markFocusedCard(current);
    applyTowerVisibilityMode();
    try { current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch {}
  }

  function maybeAdvanceFocusedTower() {
    if (!state.autoAdvanceTowerOnAssign) return;
    if ((state.towerViewMode || 'all') !== 'focus') return;
    const current = getFocusedCard();
    if (!current) { applyTowerVisibilityMode(); return; }
    if (!isCardIncomplete(current)) {
      const allCards = getTowerCards();
      allCards.forEach(c => c.hidden = false);
      const next = allCards.find((c) => c !== current && isCardIncomplete(c)) || allCards.find(isCardIncomplete) || current;
      markFocusedCard(next);
      allCards.forEach(c => c.hidden = c !== next);
      syncTowerViewToggleButton();
      syncFocusedTowerSelect();
      try { next?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch {}
    }
  }

  function focusTowerById(baseId) {
    if (!baseId) return;
    const esc = (window.CSS && CSS.escape) ? CSS.escape(baseId) : String(baseId).replace(/"/g, '\\"');
    const card = document.querySelector(`.bases-grid .base-card[data-base-id="${esc}"]`) ||
                 document.querySelector(`.bases-grid .base-card[data-baseid="${esc}"]`);
    if (!card) return;
    markFocusedCard(card);
    state.towerViewMode = 'focus';
    applyTowerVisibilityMode();
    syncTowerViewToggleButton();
    syncFocusedTowerSelect();
  }

  function clearCurrentShiftPlan() {
    if (!['shift1', 'shift2'].includes(state.activeShift)) {
      alert('Оберіть зміну 1 або зміну 2.');
      return;
    }
    (state.players || []).forEach((p) => { p.assignment = null; });
    (state.bases || []).forEach((b) => {
      b.captainId = null;
      b.helperIds = [];
      try { PNS.applyBaseRoleUI?.(b, null); } catch {}
    });
    try { PNS.renderAll?.(); } catch {}
    try { MS.saveCurrentShiftPlanSnapshot?.(); } catch {}
    state.focusedBaseId = '';
    state.towerViewMode = 'focus';
    setTimeout(() => { applyTowerVisibilityMode(); syncTowerViewToggleButton(); syncFocusedTowerSelect(); }, 0);
  }

  function handleFocusSelect(sel) {
    if (!sel) return;
    const id = String(sel.value || '');
    const cards = getTowerCards();
    let card = null;
    if (id) {
      const esc = (window.CSS && CSS.escape) ? CSS.escape(id) : id;
      card = document.querySelector(`.bases-grid .base-card[data-base-id="${esc}"]`) || document.querySelector(`.bases-grid .base-card[data-baseid="${esc}"]`);
    }
    if (!card) card = cards[Math.max(0, sel.selectedIndex)] || null;
    if (!card) return;
    if (!card.dataset.baseId && state.bases?.[Math.max(0, sel.selectedIndex)]?.id) card.dataset.baseId = state.bases[Math.max(0, sel.selectedIndex)].id;
    state.focusedBaseId = String(card.dataset.baseId || card.dataset.baseid || id || state.focusedBaseId || '');
    state.towerViewMode = 'focus';
    cards.forEach(c => { c.hidden = false; c.classList.remove('is-focused-tower'); });
    markFocusedCard(card);
    cards.forEach(c => { c.hidden = c !== card; });
    syncTowerViewToggleButton();
    syncFocusedTowerSelect();
    try { card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch {}
  }

  Object.assign(MS, {
    getTowerCards,
    getVisibleTowerCards,
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
    clearCurrentShiftPlan,
    handleFocusSelect,
  });
})();
