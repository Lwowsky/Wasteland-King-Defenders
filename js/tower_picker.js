(function () {
  const PNS = window.PNS; if (!PNS) return;
  const MS = (PNS.ModalsShift = PNS.ModalsShift || {});
  const { state } = PNS; if (!state) return;

  function getTowerPickerSelectedBaseId() {
    if (state.towerPickerSelectedBaseId) return state.towerPickerSelectedBaseId;
    const focused = MS.getFocusedCard?.();
    if (focused) return String(focused.dataset.baseId || focused.dataset.baseid || '');
    const next = MS.findNextIncompleteTower?.();
    if (next) return String(next.dataset.baseId || next.dataset.baseid || '');
    const first = (MS.getTowerCards?.() || [])[0];
    return first ? String(first.dataset.baseId || first.dataset.baseid || '') : '';
  }

  function isPickerOnlyCaptainsEnabled() {
    if (typeof state.towerPickerOnlyCaptains !== 'boolean') state.towerPickerOnlyCaptains = true;
    if (typeof state.towerPickerMatchRegisteredShift !== 'boolean') state.towerPickerMatchRegisteredShift = true;
    return !!state.towerPickerOnlyCaptains;
  }

  function isPickerMatchRegisteredShiftEnabled() {
    if (typeof state.towerPickerMatchRegisteredShift !== 'boolean') state.towerPickerMatchRegisteredShift = true;
    return !!state.towerPickerMatchRegisteredShift;
  }

  function eligibleCaptainsForBase(base) {
    if (!base) return [];
    const onlyCaptains = isPickerOnlyCaptainsEnabled();
    const matchRegisteredShift = isPickerMatchRegisteredShiftEnabled();
    const curShift = state.activeShift || 'shift1';
    return (state.players || []).filter((p) => {
      if (!p) return false;
      const isCurrentCaptain = !!(p.assignment && p.assignment.baseId === base.id && p.assignment.kind === 'captain');
      if (isCurrentCaptain) return true;
      if (onlyCaptains && !p.captainReady) return false;
      if (matchRegisteredShift && curShift !== 'all') {
        const ps = String(p.shift || 'both');
        if (!(ps === 'both' || ps === curShift)) return false;
      }
      // Allow captain selection from any shift when checkbox is off. We only sort by active shift first.
      if (!p.assignment) return true;
      return false;
    }).sort((a, b) => {
      const aShiftScore = (a.shift === curShift || a.shift === 'both') ? 1 : 0;
      const bShiftScore = (b.shift === curShift || b.shift === 'both') ? 1 : 0;
      return (bShiftScore - aShiftScore)
        || (Number(b.captainReady) - Number(a.captainReady))
        || ((b.march || 0) - (a.march || 0))
        || String(a.name).localeCompare(String(b.name));
    });
  }

  function pickerEffectiveMarch(base, player) {
    try {
      if (typeof PNS.getTowerEffectiveMarch === 'function') return Number(PNS.getTowerEffectiveMarch(base, player)) || 0;
    } catch {}
    return Number(player?.march || 0) || 0;
  }

  function pickerMarchCell(base, player, { isCaptain = false } = {}) {
    const raw = Number(player?.march || 0) || 0;
    if (isCaptain) return Number(raw).toLocaleString('en-US');
    const eff = pickerEffectiveMarch(base, player);
    return Number(eff).toLocaleString('en-US');
  }

  function displayPickerBaseTitle(text) {
    return String(text || '').replace(/\bCentral\s*Base\b/i, 'Hub').replace(/\bCentral\s*base\b/i, 'Hub');
  }

  function towerStats(base) {
    const captain = base?.captainId ? state.playerById?.get?.(base.captainId) : null;
    const helpers = (base?.helperIds || []).map((id) => state.playerById?.get?.(id)).filter(Boolean);
    const captainMarch = Number(captain?.march || 0) || 0;
    const rallySize = Number(captain?.rally || 0) || 0;
    const helpersSum = helpers.reduce((s, p) => s + pickerEffectiveMarch(base, p), 0);
    const total = captainMarch + helpersSum;
    const capacity = captainMarch + rallySize;
    const free = Math.max(0, capacity - total);
    return { captainMarch, rallySize, total, capacity, free };
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
      },
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

    const title = displayPickerBaseTitle(String(base.title || baseId).split('/')[0].trim());
    const captain = base.captainId ? state.playerById?.get?.(base.captainId) : null;
    const caps = eligibleCaptainsForBase(base);
    const rule = getBaseRuleForPicker(base);
    const helperRows = (base.helperIds || []).map((id) => state.playerById?.get?.(id)).filter(Boolean);
    const stats = towerStats(base);

    detail.innerHTML = `
      <div class="stack">
        <h3>${title}</h3>
        <div class="picker-meta-row muted small">
          <span class="picker-meta-shift">Shift: ${(state.activeShift || '').toUpperCase()}</span>
          <label class="picker-only-captains"><input type="checkbox" id="pickerOnlyCaptains" ${isPickerOnlyCaptainsEnabled() ? 'checked' : ''}/> Тільки капітани</label>
          <label class="picker-only-captains"><input type="checkbox" id="pickerMatchRegisteredShift" ${isPickerMatchRegisteredShiftEnabled() ? 'checked' : ''}/> Зазначений Shift</label>
        </div>
        <div class="picker-topline top-space">
          <select id="towerPickerCaptainSelect" class="input-like" aria-label="Вибір капітана">
            <option value="">${captain ? 'Змінити капітана…' : 'Вибрати капітана…'}</option>
            ${caps.map(p => `<option value="${p.id}" ${captain && captain.id === p.id ? 'selected' : ''}>${String(p.name || '')} · ${String(p.role || '')} · ${String(p.shiftLabel || p.shift || '')} · ${Number(p.march || 0).toLocaleString('en-US')}${p.captainReady ? ' · CAP' : ''}</option>`).join('')}
          </select>
          <div class="picker-actions">
            <button class="btn btn-sm" type="button" data-picker-set-captain="${base.id}">Set captain</button>
            <button class="btn btn-sm" type="button" data-picker-autofill="${base.id}">Auto-fill</button>
            <button class="btn btn-sm" type="button" data-picker-clear-base="${base.id}">Clear base</button>
          </div>
        </div>

        <div class="limit-grid limit-grid-compact top-space">
          <div><span>Captain march</span><strong>${Number(stats.captainMarch || 0).toLocaleString('en-US')}</strong></div>
          <div><span>Rally size</span><strong>${Number(stats.rallySize || 0).toLocaleString('en-US')}</strong></div>
          <div><span>Total Σ</span><strong>${Number(stats.total || 0).toLocaleString('en-US')}</strong></div>
          <div><span>Free space</span><strong>${Number(stats.free || 0).toLocaleString('en-US')}</strong></div>
        </div>

        <details class="tower-collapsible top-space" id="towerPickerLimitsBlock">
          <summary>Налаштування башні · ліміти по тірам (макс. March)</summary>
          <div class="inner stack">
            <div class="picker-limits-head">
              <label><span class="muted small">Max helpers</span><input id="pickerMaxHelpers" type="number" min="0" value="${rule.maxHelpers}" /></label>
              <button class="btn btn-sm" type="button" data-picker-save-rule="${base.id}">Зберегти ліміти</button>
              <button class="btn btn-sm" type="button" data-picker-reset-rule="${base.id}">Скинути ліміти (T14–T9 → 0)</button>
            </div>
            <div class="row gap wrap">
              ${['T14','T13','T12','T11','T10','T9'].map(t => `<label><span class="muted small">${t}</span><input type="number" min="0" data-picker-tier="${t}" value="${rule.tierMinMarch[t] || 0}" style="width:90px" /></label>`).join('')}
            </div>
          </div>
        </details>

        <details class="tower-collapsible" id="towerPickerManualBlock">
          <summary>Manual add helper</summary>
          <div class="inner stack">
            <div class="picker-manual-row">
              <input id="pickerManualName" placeholder="Нік" />
              <input id="pickerManualAlly" placeholder="Альянс" />
              <select id="pickerManualRole"><option>Fighter</option><option>Shooter</option><option>Rider</option></select>
            </div>
            <div class="picker-manual-row2">
              <input id="pickerManualTier" placeholder="T14" />
              <input id="pickerManualMarch" placeholder="March" type="number" min="0" />
              <input id="pickerManualRally" placeholder="Rally size" type="number" min="0" />
              <button class="btn btn-sm" type="button" data-picker-add-manual-captain="${base.id}">Set captain</button>
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
                ${captain ? `<tr><td>${captain.name}</td><td>${captain.alliance || ''}</td><td>${captain.role || ''}</td><td>${captain.tier || ''}</td><td>${pickerMarchCell(base, captain, { isCaptain: true })}</td><td><button class="btn btn-xs" type="button" data-picker-edit-player="${captain.id}" data-picker-edit-base="${base.id}">✎</button></td></tr>` : ''}
                ${helperRows.map(p => `<tr><td>${p.name}</td><td>${p.alliance || ''}</td><td>${p.role || ''}</td><td>${p.tier || ''}</td><td>${pickerMarchCell(base, p)}</td><td><button class="btn btn-xs" type="button" data-picker-edit-player="${p.id}" data-picker-edit-base="${base.id}">✎</button></td></tr>`).join('')}
                ${(!captain && !helperRows.length) ? '<tr><td colspan="6" class="muted">No players assigned</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;

    const sel = modal.querySelector('.tower-picker-list [data-pick-tower-id].active');
    modal.querySelectorAll('.tower-picker-list [data-pick-tower-id]').forEach(b => b.classList.toggle('active', b === sel));
  }

  function refreshTowerPickerModalList() {
    const modal = document.getElementById('towerPickerModal');
    if (!modal) return;
    const list = modal.querySelector('.tower-picker-list');
    if (!list) return;
    list.innerHTML = '';
    (MS.getTowerCards?.() || []).forEach((card, idx) => {
      const id = String(card.dataset.baseId || card.dataset.baseid || '');
      const title = displayPickerBaseTitle((card.querySelector('h3')?.textContent || `Башня ${idx + 1}`).split('/')[0].trim());
      const base = state.baseById?.get?.(id) || MS.cardBaseState?.(card);
      const done = !!(base && base.captainId);
      const playersCount = (base ? (Number(base.captainId ? 1 : 0) + Number((base.helperIds || []).length)) : 0);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm tower-picker-item'
        + (state.towerPickerSelectedBaseId === id ? ' active' : '')
        + (done ? ' is-ready tower-done' : ' is-not-ready');
      btn.dataset.pickTowerId = id;
      const statusIcon = done ? '✓' : '!';
      const statusLabel = done ? 'Готова' : 'Без капітана';
      const countCls = done ? 'is-ready' : 'is-not-ready';
      btn.innerHTML = `<div class="tower-item-row"><strong>${title}</strong><span class="tower-item-status" aria-hidden="true">${statusIcon}</span></div><span class="muted small">${statusLabel} · <span class="tower-item-count ${countCls}">players: ${playersCount}</span></span>`;
      list.appendChild(btn);
    });
  }


  function bindTowerPickerLiveRefreshOnce() {
    if (state._towerPickerLiveRefreshBound) return;
    state._towerPickerLiveRefreshBound = true;

    document.addEventListener('change', (e) => {
      const cb = e.target.closest('#pickerOnlyCaptains,#pickerMatchRegisteredShift');
      if (!cb) return;
      setTimeout(() => { try { updateTowerPickerDetail(); } catch {} }, 0);
    });

    document.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-picker-shift-tab][data-shift-tab]');
      if (!tab) return;
      setTimeout(() => {
        const modal = document.getElementById('towerPickerModal');
        if (!modal || !modal.classList.contains('is-open')) return;
        try { refreshTowerPickerModalList(); updateTowerPickerDetail(); } catch {}
      }, 90);
    });

    document.addEventListener('pns:assignment-changed', () => {
      setTimeout(() => {
        const modal = document.getElementById('towerPickerModal');
        if (!modal || !modal.classList.contains('is-open')) return;
        try { refreshTowerPickerModalList(); updateTowerPickerDetail(); } catch {}
      }, 50);
    });
  }

  function openTowerPickerModal() {
    MS.ensureStep4Styles?.();
    bindTowerPickerLiveRefreshOnce();
    if (typeof state.towerPickerOnlyCaptains !== 'boolean') state.towerPickerOnlyCaptains = true;
    if (typeof state.towerPickerMatchRegisteredShift !== 'boolean') state.towerPickerMatchRegisteredShift = true;
    let modal = document.getElementById('towerPickerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'towerPickerModal';
      modal.className = 'modal tower-picker-modal';
      modal.innerHTML = `
        <div class="modal-backdrop" data-close-tower-picker></div>
        <div class="modal-card" role="dialog" aria-modal="true">
          <div class="modal-head tower-picker-head">
            <div class="tower-picker-head-left"><h2>Налаштування турелей</h2><p class="muted">Оберіть башню зліва, налаштуй справа</p></div>
            <div class="tower-picker-head-center">
              <button class="btn btn-sm shift-mini" type="button" data-picker-shift-tab="shift1" data-shift-tab="shift1">Shift 1</button>
              <button class="btn btn-sm shift-mini" type="button" data-picker-shift-tab="shift2" data-shift-tab="shift2">Shift 2</button>
              <button class="btn btn-sm shift-mini" type="button" data-action="open-board">Final Board View</button>
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
    modal.classList.add('is-open');
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
  });
})();
