(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state } = PNS;
  const $$ = PNS.$$ || ((s, r = document) => Array.from(r.querySelectorAll(s)));
  const $ = PNS.$ || ((s, r = document) => r.querySelector(s));

  function getModals() {
    return {
      settings: document.querySelector('#settings-modal'),
      board: document.querySelector('#board-modal'),
    };
  }
  function getShiftTabs() { return Array.from(document.querySelectorAll('[data-shift-tab]')); }
  function getButtons() {
    return {
      showAllData: document.querySelector('#showAllDataBtn'),
      showAllColumns: document.querySelector('#showAllColumnsBtn'),
      showAllTowers: document.querySelector('#showAllTowersBtn'),
      focusCurrentTower: document.querySelector('#focusCurrentTowerBtn') || document.querySelector('#hideOtherTowersBtn') || document.querySelector('#toggleTowerFocusBtn'),
      toggleTowerView: document.querySelector('#toggleTowerFocusBtn'),
      openTowerPicker: document.querySelector('#openTowerPickerBtn'),
      focusTowerSelect: document.querySelector('#focusTowerSelect'),
      openBoardSettings: document.querySelector('#openBoardFromSettingsColBtn') || document.querySelector('#openBoardBtnSettings') || document.querySelector('#openBoardBtnFromSettings'),
    };
  }

  function syncBodyModalLock() {
    const anyOpen = !!document.querySelector('.modal.is-open');
    document.body.classList.toggle('modal-open', anyOpen);
  }

  function ensureStep4Styles() {
    if (document.getElementById('pns-step4-inline-styles')) return;
    const st = document.createElement('style');
    st.id = 'pns-step4-inline-styles';
    st.textContent = `
      .bases-grid > .base-settings-card{align-self:stretch;height:100%;}
      .base-settings-card .settings-tools-box{flex:1;display:flex;flex-direction:column;justify-content:flex-start;}
      .tower-picker-modal .modal-card{width:min(1280px, calc(100vw - 28px));}
      .tower-picker-head{display:grid;grid-template-columns:minmax(0,1fr) auto 44px;align-items:center;gap:10px;}
      .tower-picker-head-center{display:flex;align-items:center;justify-content:center;gap:8px;justify-self:center;}
      .tower-picker-head-left{text-align:left;}
      .tower-picker-head .btn.shift-mini{min-width:84px;padding:7px 10px;}
      .tower-picker-detail .picker-topline{display:grid;grid-template-columns:minmax(180px,360px) auto;gap:10px;align-items:center;}
      .tower-picker-detail .picker-topline > select{min-width:180px;max-width:360px;width:100%;}
      .tower-picker-detail .picker-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
      .tower-picker-detail details.tower-collapsible{border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.02);} 
      .tower-picker-detail details.tower-collapsible>summary{cursor:pointer;list-style:none;padding:10px;font-weight:600;}
      .tower-picker-detail details.tower-collapsible>summary::-webkit-details-marker{display:none;}
      .tower-picker-detail details.tower-collapsible .inner{padding:0 10px 10px;}
      .tower-picker-detail .picker-limits-head{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px;}
      .tower-picker-detail .picker-limits-head label{display:grid;gap:6px;min-width:220px;}
      .tower-picker-detail .picker-manual-row{display:grid;grid-template-columns:minmax(140px,1.3fr) minmax(110px,.8fr) minmax(130px,.9fr);gap:8px;align-items:end;}
      .tower-picker-detail .picker-manual-row2{display:grid;grid-template-columns:100px 140px auto;gap:8px;align-items:end;}
      .tower-picker-detail .tower-picker-item.active{border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.08);} 
      #towerPlayerEditModal .modal-card{width:min(540px, calc(100vw - 24px));}
      #towerPlayerEditModal .modal-grid{grid-template-columns:minmax(0,1fr);}
      #towerPlayerEditModal .modal-grid > .panel{max-width:100%;}
      .tower-picker-modal input,.tower-picker-modal select,#towerPlayerEditModal input,#towerPlayerEditModal select{color:#e9efff !important;}
      #towerPlayerEditModal input::placeholder{color:#8e9ab8;}
      .settings-focus-inline,.settings-focus-select{min-width:150px;max-width:190px;flex:0 0 180px;display:block;}
      .settings-focus-inline select,.settings-focus-select{height:38px;min-width:0;padding:8px 10px;font-size:14px;}
      .quota-row .quota-max{margin-left:auto;}
      @media (max-width: 900px){
        .tower-picker-modal .modal-grid{grid-template-columns:1fr !important;}
        .tower-picker-head{grid-template-columns:1fr 44px;}
        .tower-picker-head-center{grid-column:1 / -1; justify-content:center;}
        .tower-picker-detail .picker-topline{grid-template-columns:1fr;}
        .tower-picker-detail .picker-manual-row,.tower-picker-detail .picker-manual-row2{grid-template-columns:1fr;}
      }
    `;
    document.head.appendChild(st);
  }

  function syncSettingsShiftBadge() {
    const badge = document.getElementById('settingsShiftBadge');
    if (!badge) return;
    const label = state.activeShift === 'shift1' ? 'Shift 1' : state.activeShift === 'shift2' ? 'Shift 2' : 'All';
    badge.textContent = label;
  }

  function openModal(name) {
    closeModal();
    const modal = getModals()[name];
    if (!modal) return;
    modal.classList.add('is-open');
    updateShiftTabButtons();
    syncBodyModalLock();
    state.activeModal = name;
  }
  function closeModal() {
    const modals = getModals();
    Object.values(modals).forEach((m) => m && m.classList.remove('is-open'));
    syncBodyModalLock();
    state.activeModal = null;
  }

  function syncToggleButtons() {
    const on = !!state.showAllColumns;
    const b = getButtons();
    if (b.showAllData) {
      b.showAllData.setAttribute('aria-pressed', String(on));
      b.showAllData.classList.toggle('toggle-on', on);
      b.showAllData.textContent = on ? 'Сховати зайві колонки' : 'Показати всі дані';
    }
    if (b.showAllColumns) {
      b.showAllColumns.setAttribute('aria-pressed', String(on));
      b.showAllColumns.classList.toggle('toggle-on', on);
      b.showAllColumns.textContent = on ? 'Hide extra columns' : 'Show all columns';
    }
  }
  function syncVisibilityCheckboxes() {
    $$('#columnVisibilityChecks input[type="checkbox"][data-col-key]').forEach((cb) => {
      cb.checked = (state.visibleOptionalColumns || []).includes(cb.dataset.colKey);
    });
  }
  function applyColumnVisibility(showAll) {
    state.showAllColumns = !!showAll;
    const visible = new Set(state.visibleOptionalColumns || []);
    $$('.optional-col').forEach((cell) => {
      const key = cell.dataset.colKey || '';
      const shouldShow = state.showAllColumns || !key || visible.has(key);
      cell.classList.toggle('is-hidden-col', !shouldShow);
    });
    syncVisibilityCheckboxes();
    syncToggleButtons();
    try {
      if (typeof PNS.safeWriteBool === 'function') PNS.safeWriteBool(PNS.KEYS.KEY_SHOW_ALL, state.showAllColumns);
      else localStorage.setItem(PNS.KEYS.KEY_SHOW_ALL, state.showAllColumns ? '1' : '0');
    } catch {}
  }
  function toggleColumns() { applyColumnVisibility(!state.showAllColumns); }

  function matchesShift(itemShift, filter) {
    const normalized = String(itemShift || '').toLowerCase().trim();
    if (filter === 'all') return true;
    if (normalized === 'both') return true;
    return normalized === filter;
  }

  // ===== separate shift plans =====
  function cloneAssignment(a) { return a ? { baseId: a.baseId, kind: a.kind } : null; }
  function snapshotShiftPlan() {
    const players = {};
    (state.players || []).forEach((p) => { players[p.id] = cloneAssignment(p.assignment); });
    const bases = {};
    (state.bases || []).forEach((b) => {
      bases[b.id] = {
        captainId: b.captainId || null,
        helperIds: Array.isArray(b.helperIds) ? b.helperIds.slice() : [],
        role: b.role || null
      };
    });
    return { players, bases };
  }
  function restoreShiftPlan(plan) {
    if (!plan) {
      (state.players || []).forEach((p) => { p.assignment = null; });
      (state.bases || []).forEach((b) => {
        b.captainId = null; b.helperIds = [];
        if (typeof PNS.applyBaseRoleUI === 'function') PNS.applyBaseRoleUI(b, null);
      });
      return;
    }
    (state.players || []).forEach((p) => { p.assignment = cloneAssignment(plan.players?.[p.id] || null); });
    (state.bases || []).forEach((b) => {
      const s = plan.bases?.[b.id] || {};
      b.captainId = s.captainId || null;
      b.helperIds = Array.isArray(s.helperIds) ? s.helperIds.slice() : [];
      if (typeof PNS.applyBaseRoleUI === 'function') {
        const captain = b.captainId ? state.playerById?.get?.(b.captainId) : null;
        PNS.applyBaseRoleUI(b, captain?.role || s.role || null);
      }
    });
  }
  function saveCurrentShiftPlanSnapshot() {
    if (!['shift1','shift2'].includes(state.activeShift)) return;
    state.shiftPlans = state.shiftPlans || {};
    state.shiftPlans[state.activeShift] = snapshotShiftPlan();
  }
  function loadShiftPlanSnapshot(shift) {
    if (!['shift1','shift2'].includes(shift)) return;
    state.shiftPlans = state.shiftPlans || {};
    restoreShiftPlan(state.shiftPlans[shift] || null);
  }

  // ===== tower visibility mode =====
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
      const c = document.querySelector(`.bases-grid .base-card[data-base-id="${CSS.escape(state.focusedBaseId)}"]`)
        || document.querySelector(`.bases-grid .base-card[data-baseid="${CSS.escape(state.focusedBaseId)}"]`);
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
    if (b) {
      const hasCaptain = !!b.captainId;
      return !hasCaptain;
    }
    const noCaptain = !!card.querySelector('.captain-name.captain-empty');
    return noCaptain;
  }
  function findNextIncompleteTower() {
    const cards = getTowerCards();
    return cards.find(isCardIncomplete) || cards[0] || null;
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
    if ((state.towerViewMode || 'focus') !== 'focus') return;
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


  function syncTowerViewToggleButton() {
    const b = getButtons().toggleTowerView || document.querySelector('#toggleTowerFocusBtn');
    if (!b) return;
    const focusMode = (state.towerViewMode || 'focus') === 'focus';
    b.textContent = focusMode ? 'Показати всі башні' : 'Приховати інші';
    b.dataset.mode = focusMode ? 'focus' : 'all';
    b.setAttribute('aria-pressed', String(focusMode));
  }

  function syncFocusedTowerSelect() {
    const sel = getButtons().focusTowerSelect || document.querySelector('#focusTowerSelect');
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
      const title = (base?.title || card.querySelector('h3')?.textContent || `Башня ${idx+1}`).split('/')[0].trim();
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

  function focusTowerById(baseId) {
    if (!baseId) return;
    const esc = (window.CSS && CSS.escape) ? CSS.escape(baseId) : baseId.replace(/"/g, '\\"');
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
    if (!['shift1','shift2'].includes(state.activeShift)) {
      alert('Оберіть Shift 1 або Shift 2.');
      return;
    }
    (state.players || []).forEach((p) => { p.assignment = null; });
    (state.bases || []).forEach((b) => {
      b.captainId = null;
      b.helperIds = [];
      try { PNS.applyBaseRoleUI?.(b, null); } catch {}
    });
    try { PNS.renderAll?.(); } catch {}
    saveCurrentShiftPlanSnapshot();
    state.focusedBaseId = '';
    state.towerViewMode = 'focus';
    setTimeout(() => { applyTowerVisibilityMode(); syncTowerViewToggleButton(); syncFocusedTowerSelect(); }, 0);
  }



  function getTowerPickerSelectedBaseId() {
    if (state.towerPickerSelectedBaseId) return state.towerPickerSelectedBaseId;
    const focused = getFocusedCard();
    if (focused) return String(focused.dataset.baseId || focused.dataset.baseid || '');
    const next = findNextIncompleteTower();
    if (next) return String(next.dataset.baseId || next.dataset.baseid || '');
    const first = getTowerCards()[0];
    return first ? String(first.dataset.baseId || first.dataset.baseid || '') : '';
  }

  function eligibleCaptainsForBase(base) {
    if (!base) return [];
    const curShift = state.activeShift || 'shift2';
    return (state.players || []).filter((p) => {
      if (!p) return false;
      if (!p.captainReady) return false;
      if (!matchesShift(p.shift || 'both', curShift)) return false;
      if (!p.assignment) return true;
      return p.assignment.baseId === base.id && p.assignment.kind === 'captain';
    }).sort((a,b)=> (b.march||0)-(a.march||0) || String(a.name).localeCompare(String(b.name)));
  }

  function getBaseRuleForPicker(base) {
    const src = (typeof PNS.getBaseTowerRule === 'function') ? PNS.getBaseTowerRule(base.id) : null;
    return {
      maxHelpers: Number(src?.maxHelpers ?? base?.maxHelpers ?? 29) || 29,
      tierMinMarch: {
        T14: Number(src?.tierMinMarch?.T14 ?? base?.tierMinMarch?.T14 ?? 0) || 0,
        T13: Number(src?.tierMinMarch?.T13 ?? base?.tierMinMarch?.T13 ?? 0) || 0,
        T12: Number(src?.tierMinMarch?.T12 ?? base?.tierMinMarch?.T12 ?? 0) || 0,
        T11: Number(src?.tierMinMarch?.T11 ?? base?.tierMinMarch?.T11 ?? 0) || 0,
        T10: Number(src?.tierMinMarch?.T10 ?? base?.tierMinMarch?.T10 ?? 0) || 0,
        T9: Number(src?.tierMinMarch?.T9 ?? base?.tierMinMarch?.T9 ?? 0) || 0,
      }
    };
  }

  function updateTowerPickerDetail() {
    const modal = document.getElementById('towerPickerModal');
    if (!modal) return;
    const detail = modal.querySelector('.tower-picker-detail');
    if (!detail) return;
    const baseId = getTowerPickerSelectedBaseId();
    state.towerPickerSelectedBaseId = baseId;
    const base = state.baseById?.get?.(baseId);
    if (!base) { detail.innerHTML = '<div class="muted">Оберіть башню зліва</div>'; return; }

    const title = String(base.title || baseId).split('/')[0].trim();
    const captain = base.captainId ? state.playerById?.get?.(base.captainId) : null;
    const caps = eligibleCaptainsForBase(base);
    const rule = getBaseRuleForPicker(base);
    const helperRows = (base.helperIds || []).map((id) => state.playerById?.get?.(id)).filter(Boolean);

    detail.innerHTML = `
      <div class="stack">
        <h3>${title}</h3>
        <div class="muted small">Shift: ${(state.activeShift || '').toUpperCase()}</div>
        <div class="picker-topline top-space">
          <select id="towerPickerCaptainSelect" class="input-like" aria-label="Вибір капітана" style="max-width:320px;">
            <option value="">${captain ? 'Змінити капітана…' : 'Вибрати капітана…'}</option>
            ${caps.map(p => `<option value="${p.id}" ${captain && captain.id===p.id ? 'selected' : ''}>${String(p.name||'')} · ${String(p.role||'')} · ${Number(p.march||0).toLocaleString('en-US')}</option>`).join('')}
          </select>
          <div class="picker-actions">
            <button class="btn btn-sm" type="button" data-picker-set-captain="${base.id}">Set captain</button>
            <button class="btn btn-sm" type="button" data-picker-autofill="${base.id}">Auto-fill</button>
            <button class="btn btn-sm" type="button" data-picker-clear-base="${base.id}">Clear base</button>
            <button class="btn btn-sm" type="button" data-picker-focus-right="${base.id}">Показати справа</button>
          </div>
        </div>

        <details class="tower-collapsible top-space" id="towerPickerLimitsBlock">
          <summary>Налаштування башні · ліміти по тірам (макс. March)</summary>
          <div class="inner stack">
            <div class="picker-limits-head">
              <label><span class="muted small">Max helpers</span><input id="pickerMaxHelpers" type="number" min="0" value="${rule.maxHelpers}" /></label>
              <button class="btn btn-sm" type="button" data-picker-save-rule="${base.id}">Зберегти ліміти</button>
            </div>
            <div class="row gap wrap">
              ${['T14','T13','T12','T11','T10','T9'].map(t => `<label><span class="muted small">${t}</span><input type="number" min="0" data-picker-tier="${t}" value="${rule.tierMinMarch[t]||0}" style="width:90px" /></label>`).join('')}
            </div>
          </div>
        </details>

        <details class="tower-collapsible" id="towerPickerManualBlock">
          <summary>Manual add helper</summary>
          <div class="inner stack">
            <div class="picker-manual-row">
              <input id="pickerManualName" placeholder="Нік" />
              <input id="pickerManualAlly" placeholder="Альянс" />
              <select id="pickerManualRole"><option>Shooter</option><option>Fighter</option><option>Rider</option></select>
            </div>
            <div class="picker-manual-row2">
              <input id="pickerManualTier" placeholder="T14" />
              <input id="pickerManualMarch" placeholder="March" type="number" min="0" />
              <button class="btn btn-sm" type="button" data-picker-add-manual="${base.id}">Add helper</button>
            </div>
          </div>
        </details>

        <div class="panel subpanel" style="padding:10px">
          <div class="row gap wrap" style="justify-content:space-between"><strong>Гравці в башні</strong><span class="muted small">${captain ? 'Captain + helpers' : 'No captain'}</span></div>
          <div class="helpers-table-wrap top-space">
            <table class="mini-table">
              <thead><tr><th>Player</th><th>Ally</th><th>Role</th><th>Tier</th><th>March</th><th>✎</th></tr></thead>
              <tbody>
                ${captain ? `<tr><td>${captain.name}</td><td>${captain.alliance||''}</td><td>${captain.role||''}</td><td>${captain.tier||''}</td><td>${Number(captain.march||0).toLocaleString('en-US')}</td><td><button class="btn btn-xs" type="button" data-picker-edit-player="${captain.id}" data-picker-edit-base="${base.id}">✎</button></td></tr>` : ''}
                ${helperRows.map(p => `<tr><td>${p.name}</td><td>${p.alliance||''}</td><td>${p.role||''}</td><td>${p.tier||''}</td><td>${Number(p.march||0).toLocaleString('en-US')}</td><td><button class="btn btn-xs" type="button" data-picker-edit-player="${p.id}" data-picker-edit-base="${base.id}">✎</button></td></tr>`).join('')}
                ${(!captain && !helperRows.length) ? '<tr><td colspan="6" class="muted">No players assigned</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
    const sel = modal.querySelector('.tower-picker-list [data-pick-tower-id].active');
    modal.querySelectorAll('.tower-picker-list [data-pick-tower-id]').forEach(b=>b.classList.toggle('active', b===sel));
  }

  function refreshTowerPickerModalList() {
    const modal = document.getElementById('towerPickerModal');
    if (!modal) return;
    const list = modal.querySelector('.tower-picker-list');
    if (!list) return;
    list.innerHTML = '';
    getTowerCards().forEach((card, idx) => {
      const id = String(card.dataset.baseId || card.dataset.baseid || '');
      const title = (card.querySelector('h3')?.textContent || `Башня ${idx+1}`).split('/')[0].trim();
      const base = cardBaseState(card);
      const done = base ? !!base.captainId : !isCardIncomplete(card);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm tower-picker-item' + (state.towerPickerSelectedBaseId === id ? ' active' : '') + (done ? ' tower-done' : '');
      btn.dataset.pickTowerId = id;
      btn.style.display = 'flex'; btn.style.flexDirection='column'; btn.style.alignItems='flex-start'; btn.style.width='100%';
      btn.innerHTML = `<strong>${title}</strong><span class="muted small">${done ? 'Капітан виставлений' : 'Без капітана'}</span>`;
      list.appendChild(btn);
    });
  }

  function openTowerPlayerEditModal(baseId, playerId) {
    const p = playerId ? state.playerById?.get?.(playerId) : null;
    let modal = document.getElementById('towerPlayerEditModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'towerPlayerEditModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-backdrop" data-close-tower-player-edit></div>
        <div class="modal-card" role="dialog" aria-modal="true" style="width:min(560px, calc(100vw - 24px));">
          <div class="modal-head"><div><h2>Редагування гравця</h2><p class="muted">Зміна даних / видалення з башні</p></div><button class="btn btn-icon" type="button" data-close-tower-player-edit>✕</button></div>
          <div class="modal-grid" style="grid-template-columns:minmax(0,1fr);">
            <section class="panel subpanel stack" style="max-width:100%;">
              <input id="tpeName" placeholder="Нік" style="color:#eef3ff" />
              <input id="tpeAlly" placeholder="Альянс" style="color:#eef3ff" />
              <select id="tpeRole" style="color:#eef3ff"><option>Shooter</option><option>Fighter</option><option>Rider</option></select>
              <input id="tpeTier" placeholder="T14" style="color:#eef3ff" />
              <input id="tpeMarch" type="number" min="0" placeholder="March" style="color:#eef3ff" />
              <div class="row gap wrap">
                <button class="btn btn-primary" type="button" id="tpeSaveBtn">Зберегти</button>
                <button class="btn" type="button" id="tpeRemoveBtn">Видалити з башні</button>
              </div>
            </section>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
    modal.dataset.baseId = baseId || '';
    modal.dataset.playerId = playerId || '';
    modal.querySelector('#tpeName').value = p?.name || '';
    modal.querySelector('#tpeAlly').value = p?.alliance || '';
    modal.querySelector('#tpeRole').value = p?.role || 'Fighter';
    modal.querySelector('#tpeTier').value = p?.tier || 'T10';
    modal.querySelector('#tpeMarch').value = p?.march || '';
    modal.classList.add('is-open');
    syncBodyModalLock();
  }

  function saveTowerPlayerEditModal() {
    const modal = document.getElementById('towerPlayerEditModal');
    if (!modal) return;
    const baseId = modal.dataset.baseId || '';
    const playerId = modal.dataset.playerId || '';
    const base = state.baseById?.get?.(baseId);
    if (!base) return;
    const name = String(modal.querySelector('#tpeName')?.value || '').trim();
    const ally = String(modal.querySelector('#tpeAlly')?.value || '').trim();
    const role = (typeof PNS.normalizeRole === 'function') ? PNS.normalizeRole(modal.querySelector('#tpeRole')?.value || 'Fighter') : String(modal.querySelector('#tpeRole')?.value || 'Fighter');
    const tier = (typeof PNS.normalizeTierText === 'function') ? PNS.normalizeTierText(modal.querySelector('#tpeTier')?.value || 'T10') : String(modal.querySelector('#tpeTier')?.value || 'T10').toUpperCase();
    const march = Number(modal.querySelector('#tpeMarch')?.value || 0) || 0;
    if (!name || !march) { alert('Вкажи нік і march'); return; }

    let p = playerId ? state.playerById?.get?.(playerId) : null;
    if (p) {
      p.name = name; p.alliance = ally; p.role = role; p.tier = tier; p.march = march;
      if (typeof PNS.tierRank === 'function') p.tierRank = PNS.tierRank(tier);
    } else {
      const shift = state.activeShift === 'all' ? 'both' : (state.activeShift || 'both');
      p = {
        id: `m_${Date.now()}_${Math.floor(Math.random()*1e5)}`,
        name, playerExternalId: '', alliance: ally, role, tier, tierRank: (typeof PNS.tierRank === 'function' ? PNS.tierRank(tier) : 0),
        march, rally: 0, captainReady: false, shift, shiftLabel: (PNS.formatShiftLabelForCell ? PNS.formatShiftLabelForCell(shift) : shift),
        lairLevel:'', secondaryRole:'', secondaryTier:'', troop200k:'', notes:'Manual entry', raw:null, rowEl:null, actionCellEl:null, assignment:null
      };
      state.players.push(p); state.playerById.set(p.id, p);
      try { PNS.assignPlayerToBase?.(p.id, base.id, 'helper'); } catch {}
    }
    try { PNS.renderAll?.(); } catch {}
    modal.classList.remove('is-open');
    syncBodyModalLock();
    refreshTowerPickerModalList();
    updateTowerPickerDetail();
  }

  function openTowerPickerModal() {
    ensureStep4Styles();
    let modal = document.getElementById('towerPickerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'towerPickerModal';
      modal.className = 'modal tower-picker-modal';
      modal.innerHTML = `
        <div class="modal-backdrop" data-close-tower-picker></div>
        <div class="modal-card" role="dialog" aria-modal="true">
          <div class="modal-head tower-picker-head">
            <div class="tower-picker-head-left"><h2 style="margin:0">5 башень</h2><p class="muted" style="margin-top:2px">Оберіть башню зліва, налаштуй справа</p></div>
            <div class="tower-picker-head-center">
              <button class="btn btn-sm shift-mini" type="button" data-picker-shift-tab="shift1" data-shift-tab="shift1">Shift 1</button>
              <button class="btn btn-sm shift-mini" type="button" data-picker-shift-tab="shift2" data-shift-tab="shift2">Shift 2</button>
            </div>
            <button class="btn btn-icon" type="button" data-close-tower-picker>✕</button>
          </div>
          <div class="modal-grid" style="grid-template-columns: 280px minmax(0,1fr); gap:12px;">
            <section class="panel subpanel"><div class="stack tower-picker-list"></div></section>
            <section class="panel subpanel tower-picker-detail"></section>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
    modal.classList.add('is-open');
    syncBodyModalLock();
    updateShiftTabButtons();
    state.towerPickerSelectedBaseId = getTowerPickerSelectedBaseId();
    refreshTowerPickerModalList();
    updateTowerPickerDetail();
  }

  function updateShiftTabButtons() {
    getShiftTabs().forEach((btn) => {
      const isActive = btn.dataset.shiftTab === state.activeShift;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
    syncSettingsShiftBadge();
    document.querySelectorAll('[data-picker-shift-tab]').forEach((btn) => {
      const target = btn.dataset.pickerShiftTab;
      const isActive = target === state.activeShift;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }
  function updateBoardTitle() {
    const title = $('#boardTitle');
    if (!title) return;
    if (state.activeShift === 'shift1') title.textContent = '1st shift / Первая половина';
    else if (state.activeShift === 'shift2') title.textContent = '2nd shift / Вторая половина';
    else title.textContent = 'All shifts / Все смены';
  }

  function applyShiftFilter(shift) {
    const nextShift = ['shift1', 'shift2', 'all'].includes(shift) ? shift : 'all';
    if (nextShift !== state.activeShift) saveCurrentShiftPlanSnapshot();
    state.activeShift = nextShift;

    if (nextShift === 'shift1' || nextShift === 'shift2') {
      loadShiftPlanSnapshot(nextShift);
      if (typeof PNS.renderAll === 'function') PNS.renderAll();
    }

    $$('tbody tr[data-shift]').forEach((row) => { row.hidden = false; });
    $$('.base-card[data-shift]').forEach((card) => { card.hidden = !matchesShift(card.dataset.shift, state.activeShift); });
    $$('.board-col[data-shift]').forEach((col) => { col.hidden = !matchesShift(col.dataset.shift, state.activeShift); });

    updateShiftTabButtons();
    updateBoardTitle();

    if (state.topFilters) {
      if (state.topFilters.shift !== 'all') state.topFilters.shift = state.activeShift;
      if (typeof PNS.syncTopFilterUI === 'function') PNS.syncTopFilterUI();
      if (typeof PNS.applyPlayerTableFilters === 'function') PNS.applyPlayerTableFilters();
      if (typeof PNS.saveTopFilters === 'function') PNS.saveTopFilters();
    }
    try { localStorage.setItem(PNS.KEYS.KEY_SHIFT_FILTER, state.activeShift); } catch {}

state.towerViewMode = state.towerViewMode || 'focus';
    // respect tower view mode after rerender/filtering
    setTimeout(() => { applyTowerVisibilityMode(); syncTowerViewToggleButton(); syncFocusedTowerSelect(); try { refreshTowerPickerModalList(); updateTowerPickerDetail(); } catch {} }, 0);
    saveCurrentShiftPlanSnapshot();
  }
  function handleShiftTabClick(e) {
    const btn = e.target.closest('[data-shift-tab]');
    if (!btn) return;
    e.preventDefault();
    applyShiftFilter(btn.dataset.shiftTab);
  }

  function bindSettingsAndTowerButtonsOnce() {
    if (state._modalsShiftExtraBound) return;
    state._modalsShiftExtraBound = true;

    document.addEventListener('click', (e) => {
      const btnShow = e.target.closest('#showAllTowersBtn,[data-action="show-all-towers"]');
      if (btnShow) { e.preventDefault(); showAllTowers(); return; }

      const btnFocus = e.target.closest('#focusCurrentTowerBtn,#hideOtherTowersBtn,[data-action="focus-current-tower"]');
      if (btnFocus) { e.preventDefault(); focusCurrentTower(); return; }

      const btnToggle = e.target.closest('#toggleTowerFocusBtn,[data-action="toggle-towers-view"]');
      if (btnToggle) {
        e.preventDefault();
        if ((state.towerViewMode || 'focus') === 'focus') showAllTowers();
        else focusCurrentTower();
        return;
      }

      const btnPick = e.target.closest('#openTowerPickerBtn,[data-action="open-tower-picker"]');
      if (btnPick) { e.preventDefault(); openTowerPickerModal(); return; }

      const pickItem = e.target.closest('[data-pick-tower-id]');
      if (pickItem) {
        e.preventDefault();
        state.towerPickerSelectedBaseId = pickItem.dataset.pickTowerId;
        focusTowerById(pickItem.dataset.pickTowerId);
        refreshTowerPickerModalList();
        updateTowerPickerDetail();
        return;
      }

      if (e.target.closest('[data-close-tower-picker]')) {
        e.preventDefault();
        document.getElementById('towerPickerModal')?.classList.remove('is-open');
        syncBodyModalLock();
        return;
      }


      const pickerSetCaptain = e.target.closest('[data-picker-set-captain]');
      if (pickerSetCaptain) {
        e.preventDefault();
        const baseId = pickerSetCaptain.dataset.pickerSetCaptain;
        const sel = document.getElementById('towerPickerCaptainSelect');
        if (!sel?.value) { alert('Оберіть капітана'); return; }
        try { PNS.assignPlayerToBase?.(sel.value, baseId, 'captain'); } catch {}
        saveCurrentShiftPlanSnapshot();
        setTimeout(() => { refreshTowerPickerModalList(); updateTowerPickerDetail(); maybeAdvanceFocusedTower(); }, 60);
        return;
      }

      const pickerAuto = e.target.closest('[data-picker-autofill]');
      if (pickerAuto) {
        e.preventDefault();
        try { PNS.autoFillBase?.(pickerAuto.dataset.pickerAutofill); } catch {}
        saveCurrentShiftPlanSnapshot();
        setTimeout(() => { refreshTowerPickerModalList(); updateTowerPickerDetail(); maybeAdvanceFocusedTower(); }, 60);
        return;
      }

      const pickerClrH = e.target.closest('[data-picker-clear-helpers]');
      if (pickerClrH) { e.preventDefault(); try { PNS.clearBase?.(pickerClrH.dataset.pickerClearHelpers, true); } catch {} setTimeout(()=>{refreshTowerPickerModalList(); updateTowerPickerDetail();},40); return; }

      const pickerClrB = e.target.closest('[data-picker-clear-base]');
      if (pickerClrB) { e.preventDefault(); try { PNS.clearBase?.(pickerClrB.dataset.pickerClearBase, false); } catch {} setTimeout(()=>{refreshTowerPickerModalList(); updateTowerPickerDetail();},40); return; }

      const pickerFocusRight = e.target.closest('[data-picker-focus-right]');
      if (pickerFocusRight) { e.preventDefault(); focusTowerById(pickerFocusRight.dataset.pickerFocusRight); document.getElementById('towerPickerModal')?.classList.remove('is-open'); syncBodyModalLock(); return; }

      const pickerSaveRule = e.target.closest('[data-picker-save-rule]');
      if (pickerSaveRule) {
        e.preventDefault();
        const baseId = pickerSaveRule.dataset.pickerSaveRule;
        const modal = document.getElementById('towerPickerModal');
        const maxHelpers = Number(modal?.querySelector('#pickerMaxHelpers')?.value || 29) || 29;
        const tierMinMarch = {};
        modal?.querySelectorAll('[data-picker-tier]').forEach(inp => { tierMinMarch[inp.dataset.pickerTier] = Number(inp.value || 0) || 0; });
        try { PNS.setBaseTowerRule?.(baseId, { maxHelpers, tierMinMarch }, { persist: true, rerender: true }); } catch {}
        setTimeout(() => { refreshTowerPickerModalList(); updateTowerPickerDetail(); }, 40);
        return;
      }

      const pickerAddManual = e.target.closest('[data-picker-add-manual]');
      if (pickerAddManual) {
        e.preventDefault();
        const baseId = pickerAddManual.dataset.pickerAddManual;
        openTowerPlayerEditModal(baseId, '');
        const m = document.getElementById('towerPickerModal');
        const edit = document.getElementById('towerPlayerEditModal');
        if (m && edit) {
          edit.querySelector('#tpeName').value = m.querySelector('#pickerManualName')?.value || '';
          edit.querySelector('#tpeAlly').value = m.querySelector('#pickerManualAlly')?.value || '';
          edit.querySelector('#tpeRole').value = m.querySelector('#pickerManualRole')?.value || 'Fighter';
          edit.querySelector('#tpeTier').value = m.querySelector('#pickerManualTier')?.value || 'T10';
          edit.querySelector('#tpeMarch').value = m.querySelector('#pickerManualMarch')?.value || '';
        }
        return;
      }

      const pickerEditPlayer = e.target.closest('[data-picker-edit-player]');
      if (pickerEditPlayer) {
        e.preventDefault();
        openTowerPlayerEditModal(pickerEditPlayer.dataset.pickerEditBase, pickerEditPlayer.dataset.pickerEditPlayer);
        return;
      }

      if (e.target.closest('[data-close-tower-player-edit]')) {
        e.preventDefault();
        document.getElementById('towerPlayerEditModal')?.classList.remove('is-open');
        syncBodyModalLock();
        return;
      }

      const tpeSave = e.target.closest('#tpeSaveBtn');
      if (tpeSave) { e.preventDefault(); saveTowerPlayerEditModal(); return; }
      const tpeRemove = e.target.closest('#tpeRemoveBtn');
      if (tpeRemove) {
        e.preventDefault();
        const em = document.getElementById('towerPlayerEditModal');
        const baseId = em?.dataset.baseId || '';
        const playerId = em?.dataset.playerId || '';
        if (baseId && playerId) { try { PNS.removePlayerFromSpecificBase?.(baseId, playerId); } catch {} }
        em?.classList.remove('is-open');
        if (!document.getElementById('towerPickerModal')?.classList.contains('is-open')) syncBodyModalLock();
        setTimeout(()=>{ refreshTowerPickerModalList(); updateTowerPickerDetail(); },40);
        return;
      }

      const btnAutoAll = e.target.closest('#autoFillAllBasesBtn');
      if (btnAutoAll) {
        e.preventDefault();
        try { PNS.autoFillAllVisibleBases?.(); } catch {}
        saveCurrentShiftPlanSnapshot();
        setTimeout(() => { maybeAdvanceFocusedTower(); syncFocusedTowerSelect(); }, 30);
        return;
      }

      const btnClearShift = e.target.closest('#clearCurrentShiftBtn');
      if (btnClearShift) {
        e.preventDefault();
        clearCurrentShiftPlan();
        return;
      }
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#openBoardFromSettingsColBtn,#openBoardBtnSettings,#openBoardBtnFromSettings,[data-action="open-board"]');
      if (!btn) return;
      e.preventDefault();
      openModal('board');
      try { PNS.renderBoard?.(); } catch {}
    });

    // Remember which tower user is interacting with
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.bases-grid .base-card');
      if (card) markFocusedCard(card);
    });

    // From row Actions select choose tower to focus (useful before assigning)
    document.addEventListener('change', (e) => {
      const sel = e.target.closest('.row-actions select');
      if (!sel) return;
      const baseId = sel.value;
      if (!baseId) return;
      state.focusedBaseId = baseId;
      const card = document.querySelector(`.bases-grid .base-card[data-base-id="${CSS.escape(baseId)}"]`) ||
                   document.querySelector(`.bases-grid .base-card[data-baseid="${CSS.escape(baseId)}"]`);
      if (card) markFocusedCard(card);
      if ((state.towerViewMode || 'all') === 'focus') setTimeout(applyTowerVisibilityMode, 0);
    });

    function _handleFocusSelect(sel){
      if (!sel) return;
      const id = String(sel.value || '');
      const before = state.focusedBaseId || '';
      focusTowerById(id);
      if ((state.focusedBaseId || '') === before) {
        const cards = getTowerCards();
        const card = cards[sel.selectedIndex];
        if (card) { markFocusedCard(card); state.towerViewMode = 'focus'; applyTowerVisibilityMode(); syncFocusedTowerSelect(); }
      }
    }
    document.addEventListener('change', (e) => {
      const sel = e.target.closest('#focusTowerSelect');
      if (!sel) return;
      e.preventDefault?.();
      _handleFocusSelect(sel);
    });
    document.addEventListener('input', (e) => {
      const sel = e.target.closest('#focusTowerSelect');
      if (!sel) return;
      _handleFocusSelect(sel);
    });

    // If user assigned/cleared someone while in focus mode, move to next incomplete tower automatically
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.row-actions .btn, [data-base-editor-action], [data-base-remove-player]');
      if (!btn) return;
      const txt = (btn.textContent || '').toLowerCase();
      const act = btn.dataset.baseEditorAction || '';
      if (!/captain|helper|clear|remove/.test(txt) && !['captain','helper','remove'].includes(act)) return;
      setTimeout(() => {
        try { maybeAdvanceFocusedTower(); } catch {}
      }, 30);
    });

    document.addEventListener('pns:assignment-changed', (ev) => {
      setTimeout(() => {
        try { if (ev?.detail?.baseId) state.focusedBaseId = ev.detail.baseId; } catch {}
        try { maybeAdvanceFocusedTower(); } catch {}
        try { syncFocusedTowerSelect(); } catch {}
        try { refreshTowerPickerModalList(); updateTowerPickerDetail(); } catch {}
      }, 40);
    });
  }

  function resyncUIAfterSwap() {
    ensureStep4Styles();
    // refresh cached refs for old modules
    if (PNS.modals) {
      const m = getModals();
      PNS.modals.settings = m.settings;
      PNS.modals.board = m.board;
    }
    if (PNS.shiftTabs && Array.isArray(PNS.shiftTabs)) {
      PNS.shiftTabs.length = 0;
      PNS.shiftTabs.push(...getShiftTabs());
    }

    if (typeof state.showAllColumns !== 'boolean') state.showAllColumns = false;
    applyColumnVisibility(!!state.showAllColumns);
    updateShiftTabButtons();
    updateBoardTitle();
    bindSettingsAndTowerButtonsOnce();
state.towerViewMode = state.towerViewMode || 'focus';
    setTimeout(() => { applyTowerVisibilityMode(); syncTowerViewToggleButton(); syncFocusedTowerSelect(); }, 0);

    if (state.activeModal) {
      const modal = getModals()[state.activeModal];
      if (modal) modal.classList.add('is-open');
    }
  }

  PNS.openModal = openModal;
  PNS.closeModal = closeModal;
  PNS.applyColumnVisibility = applyColumnVisibility;
  PNS.toggleColumns = toggleColumns;
  PNS.matchesShift = matchesShift;
  PNS.applyShiftFilter = applyShiftFilter;
  PNS.handleShiftTabClick = handleShiftTabClick;
  PNS.showAllTowers = showAllTowers;
  PNS.focusCurrentTower = focusCurrentTower;
  PNS.showAllTowers = showAllTowers;
  PNS.toggleTowerFocusMode = () => ((state.towerViewMode || 'focus') === 'focus' ? showAllTowers() : focusCurrentTower());

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resyncUIAfterSwap);
  else resyncUIAfterSwap();
  document.addEventListener('htmx:afterSwap', resyncUIAfterSwap);
  document.addEventListener('htmx:afterSettle', resyncUIAfterSwap);
  document.addEventListener('pns:partials:loaded', resyncUIAfterSwap);
  document.addEventListener('pns:dom:refreshed', () => setTimeout(applyTowerVisibilityMode, 0));
})();
