(function () {
  const PNS = window.PNS; if (!PNS) return;
  const MS = (PNS.ModalsShift = PNS.ModalsShift || {});
  const { state } = PNS; if (!state) return;

  function getTierCapForBase(base, tier) {
    const key = String(tier || '').toUpperCase();
    const v = Number(base?.tierMinMarch?.[key] || 0) || 0;
    return v > 0 ? v : 0; // 0 => no cap
  }

  function getPlayerCurrentTowerMarch(base, player, isCaptain) {
    if (!player) return 0;
    const raw = Number(player.march || 0) || 0;
    if (isCaptain) return raw;
    try {
      const ov = PNS.getTowerMarchOverride?.(base?.id, player?.id, state.activeShift);
      if (Number.isFinite(ov) && ov > 0) return ov;
    } catch {}
    try {
      if (typeof PNS.getTowerEffectiveMarch === 'function') return Number(PNS.getTowerEffectiveMarch(base, player)) || 0;
      if (typeof PNS.getEffectiveTowerMarch === 'function') return Number(PNS.getEffectiveTowerMarch(base, player)) || 0;
    } catch {}
    const cap = getTierCapForBase(base, player.tier);
    return cap > 0 ? Math.min(raw, cap) : raw;
  }

  function ensureModal() {
    let modal = document.getElementById('towerPlayerEditModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'towerPlayerEditModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop" data-close-tower-player-edit></div>
      <div class="modal-card" role="dialog" aria-modal="true" style="width:min(560px, calc(100vw - 24px));">
        <div class="modal-head">
          <div>
            <h2>Редагування гравця</h2>
            <p class="muted" id="tpeSubtitle">Зміна даних / видалення з башні</p>
          </div>
          <button class="btn btn-icon" type="button" data-close-tower-player-edit>✕</button>
        </div>
        <div class="modal-grid" style="grid-template-columns:minmax(0,1fr);">
          <section class="panel subpanel stack" style="max-width:100%;">
            <input id="tpeName" placeholder="Нік" style="color:#eef3ff" />
            <input id="tpeAlly" placeholder="Альянс" style="color:#eef3ff" />
            <select id="tpeRole" style="color:#eef3ff">
              <option>Shooter</option><option>Fighter</option><option>Rider</option>
            </select>
            <input id="tpeTier" placeholder="T14" style="color:#eef3ff" />
            <input id="tpeMarch" type="number" min="0" placeholder="March" style="color:#eef3ff" />
            <input id="tpeRally" type="number" min="0" placeholder="Rally size (для капітана)" style="color:#eef3ff" />
            <div id="tpeCapHint" class="muted small"></div>
            <div class="row gap wrap">
              <button class="btn btn-primary" type="button" id="tpeSaveBtn">Зберегти</button>
              <button class="btn" type="button" id="tpeRemoveBtn">Видалити з башні</button>
            </div>
          </section>
        </div>
      </div>`;
    document.body.appendChild(modal);
    return modal;
  }

  function closeTowerPlayerEditModal() {
    const modal = document.getElementById('towerPlayerEditModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    if (!document.querySelector('#towerPickerModal.is-open')) {
      MS.syncBodyModalLock?.();
    }
  }

  function updateModalCapUI(modal) {
    if (!modal) return;
    const baseId = modal.dataset.baseId || '';
    const playerId = modal.dataset.playerId || '';
    const base = state.baseById?.get?.(baseId);
    const p = playerId ? state.playerById?.get?.(playerId) : null;
    const isCaptain = modal.dataset.kind === 'captain';
    const tierInp = modal.querySelector('#tpeTier');
    const marchInp = modal.querySelector('#tpeMarch');
    const hint = modal.querySelector('#tpeCapHint');
    const tier = (typeof PNS.normalizeTierText === 'function')
      ? PNS.normalizeTierText(tierInp?.value || p?.tier || 'T10')
      : String(tierInp?.value || p?.tier || 'T10').toUpperCase();
    const cap = (!isCaptain && base) ? getTierCapForBase(base, tier) : 0;

    if (marchInp) {
      // Manual edit may override tower cap for THIS tower + THIS shift only.
      marchInp.removeAttribute('max');
    }

    if (hint) {
      if (isCaptain) hint.textContent = 'Капітан: ліміт Tier cap не застосовується.';
      else if (cap > 0) hint.textContent = `Auto-fill cap для ${tier}: ${Number(cap).toLocaleString('en-US')} (ручне значення можна задати тільки для цієї башні / цього Shift).`;
      else hint.textContent = `Для ${tier} у цій башні ліміт не заданий (0 = без обмеження).`;
    }
  }

  function openTowerPlayerEditModal(baseId, playerId) {
    const base = state.baseById?.get?.(baseId);
    if (!base) return;

    const p = playerId ? state.playerById?.get?.(playerId) : null;
    const isCaptain = !!(playerId && base.captainId === playerId);
    const modal = ensureModal();

    modal.dataset.baseId = String(baseId || '');
    modal.dataset.playerId = String(playerId || '');
    modal.dataset.kind = isCaptain ? 'captain' : 'helper';

    const currentInTower = getPlayerCurrentTowerMarch(base, p, isCaptain);

    modal.querySelector('#tpeName').value = p?.name || '';
    modal.querySelector('#tpeAlly').value = p?.alliance || '';
    modal.querySelector('#tpeRole').value = p?.role || (PNS.getBaseRole?.(base) || 'Fighter');
    modal.querySelector('#tpeTier').value = p?.tier || 'T10';
    // Для helper показуємо "поточний внесок у башню" (після cap/autofill), а не весь зареєстрований загін
    modal.querySelector('#tpeMarch').value = p ? String(currentInTower || '') : '';
    const rallyInp = modal.querySelector('#tpeRally');
    if (rallyInp) {
      rallyInp.value = p ? String(Number(p.rally || 0) || '') : '';
      rallyInp.style.display = isCaptain ? '' : 'none';
      rallyInp.disabled = !isCaptain;
    }
    modal.querySelector('#tpeRemoveBtn').hidden = !playerId;

    const subtitle = modal.querySelector('#tpeSubtitle');
    if (subtitle) {
      const towerName = String(base.title || base.id || '').split('/')[0].trim();
      subtitle.textContent = isCaptain
        ? `Капітан · ${towerName}`
        : `Хелпер у башні · ${towerName}`;
    }

    updateModalCapUI(modal);

    modal.classList.add('is-open');
    MS.syncBodyModalLock?.();
  }

  function saveTowerPlayerEditModal() {
    const modal = document.getElementById('towerPlayerEditModal');
    if (!modal) return;

    const baseId = modal.dataset.baseId || '';
    const playerId = modal.dataset.playerId || '';
    const base = state.baseById?.get?.(baseId);
    if (!base) return;
    const isCaptain = modal.dataset.kind === 'captain' || (!!playerId && base.captainId === playerId);

    const name = String(modal.querySelector('#tpeName')?.value || '').trim();
    const ally = String(modal.querySelector('#tpeAlly')?.value || '').trim();
    const role = (typeof PNS.normalizeRole === 'function')
      ? PNS.normalizeRole(modal.querySelector('#tpeRole')?.value || 'Fighter')
      : String(modal.querySelector('#tpeRole')?.value || 'Fighter');
    const tier = (typeof PNS.normalizeTierText === 'function')
      ? PNS.normalizeTierText(modal.querySelector('#tpeTier')?.value || 'T10')
      : String(modal.querySelector('#tpeTier')?.value || 'T10').toUpperCase();
    const march = Number(modal.querySelector('#tpeMarch')?.value || 0) || 0;
    const rally = Number(modal.querySelector('#tpeRally')?.value || 0) || 0;

    if (!name || !march) { alert('Вкажи нік і march'); return; }

    let p = playerId ? state.playerById?.get?.(playerId) : null;
    if (p) {
      p.name = name;
      p.alliance = ally;
      p.role = role;
      p.tier = tier;
      // March for existing imported players: store scoped override per tower + shift (do not mutate raw roster value globally)
      if (isCaptain) {
        p.march = march; // captain edit remains direct (current app uses captain.march in many places)
        p.rally = rally;
      } else {
        try { PNS.setTowerMarchOverride?.(base.id, p.id, march, state.activeShift); } catch {}
      }
      if (typeof PNS.tierRank === 'function') p.tierRank = PNS.tierRank(tier);
      const forceKindExisting = String(modal.dataset.forceAssignKind || '').toLowerCase();
      if (forceKindExisting === 'captain' || forceKindExisting === 'helper') {
        const alreadySame = !!(p.assignment && String(p.assignment.baseId) === String(base.id) && String(p.assignment.kind) === forceKindExisting);
        if (!alreadySame) {
          try { PNS.assignPlayerToBase?.(p.id, base.id, forceKindExisting); } catch {}
        }
      }
    } else {
      const shift = state.activeShift === 'all' ? 'both' : (state.activeShift || 'both');
      p = {
        id: `m_${Date.now()}_${Math.floor(Math.random() * 1e5)}`,
        name,
        playerExternalId: '',
        alliance: ally,
        role,
        tier,
        tierRank: (typeof PNS.tierRank === 'function' ? PNS.tierRank(tier) : 0),
        march,
        rally: isCaptain ? rally : 0,
        captainReady: false,
        shift,
        shiftLabel: (PNS.formatShiftLabelForCell ? PNS.formatShiftLabelForCell(shift) : shift),
        lairLevel: '',
        secondaryRole: '',
        secondaryTier: '',
        troop200k: '',
        notes: 'Manual entry',
        raw: null,
        rowEl: null,
        actionCellEl: null,
        assignment: null
      };
      state.players.push(p);
      state.playerById?.set?.(p.id, p);
      const forceKind = String(modal.dataset.forceAssignKind || '').toLowerCase();
      const assignKind = (forceKind === 'captain' || isCaptain) ? 'captain' : 'helper';
      try { PNS.assignPlayerToBase?.(p.id, base.id, assignKind); } catch {}
      try { PNS.clearTowerMarchOverride?.(base.id, p.id, state.activeShift); } catch {}
    }

    try { PNS.persistSessionStateSoon?.(10); } catch {}
    try { PNS.savePlayersSnapshot?.(state.players); } catch {}
    try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
    try { PNS.saveTowersSnapshot?.(); } catch {}
    try { PNS.renderAll?.(); } catch {}
    modal.classList.remove('is-open');
    if (!document.querySelector('#towerPickerModal.is-open')) MS.syncBodyModalLock?.();

    try { MS.refreshTowerPickerModalList?.(); } catch {}
    try { MS.updateTowerPickerDetail?.(); } catch {}

    try {
      document.dispatchEvent(new CustomEvent('pns:assignment-changed', { detail: { baseId: base.id, playerId: p.id } }));
    } catch {}
  }

  // Keep cap hint/max updated when tier changes in the modal
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t) return;
    if (t.id === 'tpeTier') updateModalCapUI(document.getElementById('towerPlayerEditModal'));
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t) return;
    if (t.id === 'tpeTier') updateModalCapUI(document.getElementById('towerPlayerEditModal'));
  });

  Object.assign(MS, {
    getTierCapForBase,
    openTowerPlayerEditModal,
    closeTowerPlayerEditModal,
    saveTowerPlayerEditModal,
  });
})();
