(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state, $, $$ } = PNS;

  function helperMarchForBase(base, player) {
    if (!player) return 0;
    if (typeof PNS.getTowerEffectiveMarch === 'function') return PNS.getTowerEffectiveMarch(base, player);
    return PNS.parseNumber ? PNS.parseNumber(player.march) : (Number(player.march || 0) || 0);
  }

  function roleTagClass(role) {
    const r = PNS.normalizeRole(role).toLowerCase();
    if (r.includes('shoot')) return 'shooter';
    if (r.includes('fight')) return 'fighter';
    if (r.includes('ride')) return 'rider';
    return 'unknown';
  }

  function renderQuotaRow(base) {
    if (!base?.cardEl) return;
    const row = $('.quota-row', base.cardEl);
    if (!row) return;
    row.innerHTML = '';
    const lead = document.createElement('span');
    lead.textContent = 'Auto-fill:';
    row.appendChild(lead);

    const activeRules = [];
    ['T14','T13','T12','T11','T10','T9'].forEach((k) => {
      const minM = PNS.clampInt(base?.tierMinMarch?.[k], 0);
      if (minM > 0) activeRules.push(`${k}≥${PNS.formatNum(minM)}`);
    });

    const summary = document.createElement('span');
    summary.className = 'quota-summary';
    summary.textContent = activeRules.length ? `Tier min march: ${activeRules.join(' · ')}` : 'Tier min march: auto (not set)';
    row.appendChild(summary);

    const mh = document.createElement('span');
    mh.className = 'quota-max';
    mh.textContent = `Max helpers: ${Number(base.maxHelpers || 0)}`;
    row.appendChild(mh);
  }
  PNS.renderQuotaRow = renderQuotaRow;

  function getBaseEditorCandidates(base) {
    const baseRole = PNS.getBaseRole(base);
    return (state.players || [])
      .filter((p) => PNS.matchesShift(p.shift || 'both', state.activeShift || 'all'))
      .filter((p) => base.shift === 'both' || p.shift === 'both' || p.shift === base.shift)
      .filter((p) => !baseRole || p.assignment?.kind === 'captain' || p.role === baseRole)
      .sort((a,b) => (b.tierRank||0)-(a.tierRank||0) || (b.march||0)-(a.march||0) || String(a.name).localeCompare(String(b.name)));
  }

  function syncManualInputsFromSelected(base) {
    const editor = base?.cardEl ? $('.base-editor', base.cardEl) : null;
    if (!editor) return;
    const sel = $(`select[data-base-editor-select="${base.id}"]`, editor);
    const pid = sel?.value || '';
    const p = pid ? state.playerById.get(pid) : null;
    const nameEl = $(`[data-manual-name="${base.id}"]`, editor);
    const allyEl = $(`[data-manual-alliance="${base.id}"]`, editor);
    const tierEl = $(`[data-manual-tier="${base.id}"]`, editor);
    const marchEl = $(`[data-manual-march="${base.id}"]`, editor);
    if (!nameEl || !allyEl || !tierEl || !marchEl) return;
    if (!p) return;
    nameEl.value = String(p.name || '');
    allyEl.value = String(p.alliance || '');
    tierEl.value = String(p.tier || 'T10');
    marchEl.value = String(PNS.parseNumber(p.march || 0) || '');
  }

  function saveManualPlayerFromBaseEditor(baseId) {
    const base = state.baseById.get(baseId);
    if (!base || !base.cardEl) return;
    const editor = $('.base-editor', base.cardEl);
    if (!editor) return;
    const sel = $(`select[data-base-editor-select="${base.id}"]`, editor);
    const pid = sel?.value || '';
    const nameEl = $(`[data-manual-name="${base.id}"]`, editor);
    const allyEl = $(`[data-manual-alliance="${base.id}"]`, editor);
    const tierEl = $(`[data-manual-tier="${base.id}"]`, editor);
    const marchEl = $(`[data-manual-march="${base.id}"]`, editor);
    const statusEl = $(`[data-manual-status="${base.id}"]`, editor) || $(`[data-base-editor-status="${base.id}"]`, editor);

    const name = String(nameEl?.value || '').trim();
    const alliance = String(allyEl?.value || '').trim();
    let tier = PNS.normalizeTierText(tierEl?.value || 'T10');
    const _tm = String(tier).match(/^T(\d{1,2})$/i);
    if (_tm) { const _n = Math.max(1, Math.min(14, Number(_tm[1]))); tier = `T${_n}`; }
    const march = PNS.parseNumber(marchEl?.value || '0');

    if (!name) { if (statusEl) statusEl.textContent = 'Manual save: enter Player name'; return; }
    if (!march) { if (statusEl) statusEl.textContent = 'Manual save: enter March size'; return; }

    let p = pid ? state.playerById.get(pid) : null;
    if (p) {
      p.name = name;
      p.alliance = alliance;
      p.tier = tier;
      p.tierRank = PNS.tierRank(tier);
      p.march = march;
      if (statusEl) statusEl.textContent = `Updated ${p.name}: ${PNS.formatNum(march)} march`;
    } else {
      const role = PNS.getBaseRole(base) || 'Fighter';
      const shift = state.activeShift === 'all' ? 'both' : (state.activeShift || 'both');
      p = {
        id: `m_${Date.now()}_${Math.floor(Math.random()*1e5)}`,
        name,
        playerExternalId: '',
        alliance,
        role,
        tier,
        tierRank: PNS.tierRank(tier),
        march,
        rally: 0,
        captainReady: false,
        shift,
        shiftLabel: PNS.formatShiftLabelForCell(shift),
        lairLevel: '',
        secondaryRole: '',
        secondaryTier: '',
        troop200k: '',
        notes: 'Manual entry',
        raw: null,
        rowEl: null,
        actionCellEl: null,
        assignment: null,
      };
      state.players.push(p);
      state.playerById.set(p.id, p);
      renderPlayersTableFromState();
      if (typeof PNS.buildRowActions === 'function') PNS.buildRowActions();
      if (base.captainId && (!PNS.getBaseRole(base) || p.role === PNS.getBaseRole(base))) {
        const err = PNS.validateAssign(p, base, 'helper');
        if (!err) {
          base.helperIds.push(p.id);
          p.assignment = { baseId: base.id, kind: 'helper' };
        }
      }
      if (sel) sel.value = p.id;
      if (statusEl) statusEl.textContent = `Added manual player ${p.name} (${tier})`;
    }
    if (typeof PNS.renderAll === 'function') PNS.renderAll();
  }

  function renderBaseEditor(base) {
    const card = base.cardEl;
    if (!card) return;
    let editor = $('.base-editor', card);
    if (!editor) {
      editor = document.createElement('div');
      editor.className = 'base-editor';
      editor.innerHTML = `
        <div class="editor-row">
          <select data-base-editor-select="${base.id}" aria-label="Base editor player select"></select>
          <button class="btn btn-sm" type="button" data-base-editor-action="captain" data-base-id="${base.id}">Set captain</button>
          <button class="btn btn-sm" type="button" data-base-editor-action="helper" data-base-id="${base.id}">Add helper</button>
          <button class="btn btn-sm" type="button" data-base-editor-action="remove" data-base-id="${base.id}">Remove selected</button>
        </div>
        <div class="editor-row mini-chip-list" data-base-chip-list="${base.id}"></div>
        <div class="editor-manual" data-base-manual="${base.id}">
          <div class="editor-manual-title">Manual player edit / add</div>
          <div class="editor-manual-grid">
            <label><span>Player name</span><input type="text" data-manual-name="${base.id}" placeholder="Player name"></label>
            <label><span>Alliance</span><input type="text" data-manual-alliance="${base.id}" placeholder="Alliance"></label>
            <label><span>Tier</span>
              <select data-manual-tier="${base.id}">
                <option>T1</option><option>T2</option><option>T3</option><option>T4</option><option>T5</option><option>T6</option><option>T7</option><option>T8</option><option>T9</option><option>T10</option><option>T11</option><option>T12</option><option>T13</option><option>T14</option>
              </select>
            </label>
            <label><span>Troops (March)</span><input type="number" min="0" step="1" data-manual-march="${base.id}" placeholder="0"></label>
          </div>
          <div class="editor-row"><button class="btn btn-sm" type="button" data-base-editor-action="manualsave" data-base-id="${base.id}">Save</button></div>
          <div class="muted small" data-manual-status="${base.id}">Select player to edit march/tier (T1–T14), or enter a new player and save.</div>
        </div>
        <div class="editor-status" data-base-editor-status="${base.id}"></div>
      `;
      ( $('.helpers-table-wrap', card) || card ).insertAdjacentElement('afterend', editor);
    }

    const sel = $(`select[data-base-editor-select="${base.id}"]`, editor);
    const statusEl = $(`[data-base-editor-status="${base.id}"]`, editor);
    const chipList = $(`[data-base-chip-list="${base.id}"]`, editor);

    if (statusEl) {
      const role = PNS.getBaseRole(base);
      statusEl.textContent = role
        ? `Tower type: ${role}. You can add only ${role} helpers.`
        : 'Tower type will be set automatically by captain.';
    }

    if (sel) {
      const currentVal = sel.value;
      const candidates = getBaseEditorCandidates(base);
      sel.innerHTML = '';
      const opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— select player —';
      sel.appendChild(opt0);

      candidates.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        let assignedTag = '';
        if (p.assignment) {
          const assignedBase = state.baseById.get(p.assignment.baseId);
          const baseShort = (assignedBase?.title || '').split('/')[0].trim();
          assignedTag = p.assignment.baseId === base.id
            ? (p.assignment.kind === 'captain' ? ' [CAP]' : ' [IN BASE]')
            : ` [${p.assignment.kind === 'captain' ? 'CAP' : 'HELP'} @ ${baseShort}]`;
        }
        opt.textContent = `${p.name} • ${p.alliance || '—'} • ${p.role} • ${p.tier} • ${PNS.formatNum(p.march)} • ${p.shiftLabel}${assignedTag}`;
        sel.appendChild(opt);
      });

      if (currentVal && candidates.some((p) => p.id === currentVal)) sel.value = currentVal;
      if (!sel.dataset.manualBound) {
        sel.dataset.manualBound = '1';
        sel.addEventListener('change', () => syncManualInputsFromSelected(base));
      }
      syncManualInputsFromSelected(base);
    }

    if (chipList) {
      chipList.innerHTML = '';
      const captain = base.captainId ? state.playerById.get(base.captainId) : null;
      const helpers = (base.helperIds || []).map((id) => state.playerById.get(id)).filter(Boolean);

      if (captain) {
        const chip = document.createElement('div');
        chip.className = 'mini-chip captain';
        chip.innerHTML = `<span>Captain: ${PNS.escapeHtml(captain.name)} (${PNS.escapeHtml(captain.tier)})</span><button type="button" data-base-remove-player="${base.id}" data-player-id="${captain.id}" aria-label="Remove captain">×</button>`;
        chipList.appendChild(chip);
      }
      helpers.forEach((p) => {
        const chip = document.createElement('div');
        chip.className = 'mini-chip';
        chip.innerHTML = `<span>${PNS.escapeHtml(p.name)} (${PNS.escapeHtml(p.tier)})</span><button type="button" data-base-remove-player="${base.id}" data-player-id="${p.id}" aria-label="Remove helper">×</button>`;
        chipList.appendChild(chip);
      });
      if (!captain && !helpers.length) {
        const empty = document.createElement('div');
        empty.className = 'muted small';
        empty.textContent = 'No assigned players in this tower.';
        chipList.appendChild(empty);
      }
    }

    if (typeof PNS.syncBaseEditorSettingsInputs === 'function') PNS.syncBaseEditorSettingsInputs(base);
  }

  function updateBaseCard(base) {
    const card = base.cardEl;
    const captain = base.captainId ? state.playerById.get(base.captainId) : null;
    const helpers = base.helperIds.map((id) => state.playerById.get(id)).filter(Boolean);
    PNS.applyBaseRoleUI(base, captain?.role || null);

    const nameEl = $('.captain-name', card);
    const metaEl = $('.captain-meta', card);

    if (captain) {
      nameEl.textContent = captain.name;
      metaEl.textContent = `${captain.alliance || '—'} · ${captain.tier || '—'} · ${captain.shiftLabel || '—'}`;
      nameEl.classList.remove('captain-empty');
    } else {
      nameEl.textContent = '— Капітан не обраний —';
      metaEl.textContent = `Type auto by captain · ${base.shift === 'both' ? 'Both' : base.shift.replace('shift', 'Shift ')}`;
      nameEl.classList.add('captain-empty');
    }

    const captainMarch = captain?.march || 0;
    const helpersSum = helpers.reduce((s, p) => s + helperMarchForBase(base, p), 0);
    const total = captainMarch + helpersSum;
    const limit = captain ? (((captain.rally || 0) + (captain.march || 0)) || captain.march || 0) : 0;
    const over = !!(limit && total > limit);

    const statDivs = $$('.limit-grid > div', card);
    if (statDivs[0]) $('strong', statDivs[0]).textContent = PNS.formatNum(captainMarch);
    if (statDivs[1]) $('strong', statDivs[1]).textContent = PNS.formatNum(helpersSum);
    if (statDivs[2]) $('strong', statDivs[2]).textContent = PNS.formatNum(total);
    if (statDivs[3]) $('strong', statDivs[3]).textContent = PNS.formatNum(limit);

    card.classList.toggle('is-over-limit', over);
    if (statDivs[2]) $('strong', statDivs[2]).classList.toggle('warn-text', over);
    if (statDivs[3]) $('strong', statDivs[3]).classList.toggle('warn-text', over);

    const tbody = $('.helpers-table-wrap tbody', card);
    if (tbody) {
      tbody.innerHTML = '';
      if (!helpers.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="4" class="muted">No helpers assigned</td>';
        tbody.appendChild(tr);
      } else {
        helpers.slice().sort((a, b) => b.tierRank - a.tierRank || b.march - a.march).forEach((p) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${PNS.escapeHtml(p.name)}</td><td>${PNS.escapeHtml(p.alliance)}</td><td>${PNS.escapeHtml(p.tier)}</td><td>${PNS.formatNum(helperMarchForBase(base, p))}</td>`;
          tbody.appendChild(tr);
        });
      }
    }
    renderBaseEditor(base);
  }

  function updateBoardCol(base) {
    if (!base.boardEl) return;
    const col = base.boardEl;
    const captain = base.captainId ? state.playerById.get(base.captainId) : null;
    const helpers = base.helperIds.map((id) => state.playerById.get(id)).filter(Boolean);
    const total = (captain?.march || 0) + helpers.reduce((s, p) => s + p.march, 0);
    const limit = captain ? (((captain.rally || 0) + (captain.march || 0)) || captain.march || 0) : 0;

    PNS.setRoleTheme(col, captain?.role || null, false);
    const sub = $('.board-sub', col);
    if (sub) {
      sub.classList.toggle('is-auto', !captain);
      sub.textContent = captain ? `${captain.role} / ${captain.role}` : 'Type auto by captain';
    }

    const cap = $('.board-cap', col);
    if (cap) cap.innerHTML = `${PNS.formatNum(total)} <span>${PNS.formatNum(limit)}</span>`;

    const ul = $('ul', col);
    if (!ul) return;
    ul.innerHTML = '';

    if (captain) {
      const li = document.createElement('li');
      li.className = 'captain-row';
      li.innerHTML = `<span>${PNS.escapeHtml(captain.name)}</span><em>${PNS.escapeHtml(captain.alliance)}</em><b>${PNS.escapeHtml(captain.tier)}</b><strong>${PNS.formatNum(captain.march)}</strong>`;
      ul.appendChild(li);
    }

    helpers.slice().sort((a, b) => b.tierRank - a.tierRank || b.march - a.march).forEach((p) => {
      const li = document.createElement('li');
      li.className = 'helper-row';
      li.innerHTML = `<span>${PNS.escapeHtml(p.name)}</span><em>${PNS.escapeHtml(p.alliance)}</em><b>${PNS.escapeHtml(p.tier)}</b><strong>${PNS.formatNum(helperMarchForBase(base, p))}</strong>`;
      ul.appendChild(li);
    });

    if (!captain && !helpers.length) {
      const li = document.createElement('li');
      li.className = 'empty-row';
      li.textContent = 'No players assigned';
      ul.appendChild(li);
    }
  }

  function updatePlayerRows() {
    state.players.forEach((p) => {
      p.rowEl?.classList?.toggle('is-assigned', !!p.assignment);
      p.rowEl?.classList?.toggle('is-captain', p.assignment?.kind === 'captain');

      if (!p.assignment) {
        if (typeof PNS.setRowStatus === 'function') PNS.setRowStatus(p, 'Not assigned', '');
        return;
      }
      const base = state.baseById.get(p.assignment.baseId);
      const baseName = (base?.title || '').split('/')[0].trim();
      if (typeof PNS.setRowStatus === 'function') PNS.setRowStatus(p, `${p.assignment.kind === 'captain' ? 'Captain' : 'Helper'} → ${baseName}`, 'good');
    });
  }

  function applyPlayerTableFiltersShim() {
    if (typeof PNS.applyPlayerTableFilters === 'function') PNS.applyPlayerTableFilters();
  }

  function renderAll() {
    state.bases.forEach(updateBaseCard);
    state.bases.forEach(updateBoardCol);
    updatePlayerRows();
    applyPlayerTableFiltersShim();
  }

  function renderPlayersTableFromState() {
    const table = PNS.controls.playersDataTable || document.querySelector('#playersDataTable');
    if (!table) return;
    let theadRow = table.querySelector('thead tr');
    if (!theadRow) {
      table.innerHTML = '<thead><tr></tr></thead><tbody></tbody>';
      theadRow = table.querySelector('thead tr');
    }
    theadRow.innerHTML = `
      <th data-field="name">Player name</th>
      <th class="optional-col" data-col-key="alliance" data-field="alliance">Alliance</th>
      <th data-field="role">Focus troop</th>
      <th data-field="tier">Tier <button type="button" class="sort-btn" data-sort="tier" aria-label="Sort by Tier">↓</button></th>
      <th data-field="march">March size</th>
      <th class="optional-col" data-col-key="rally_size" data-field="rally">Rally size <button type="button" class="sort-btn" data-sort="rally" aria-label="Sort by Rally size">↓</button></th>
      <th class="optional-col" data-col-key="lair_level" data-field="lair">Lair</th>
      <th class="optional-col" data-col-key="secondary_role" data-field="secondary_role">2nd role</th>
      <th class="optional-col" data-col-key="secondary_tier" data-field="secondary_tier">2nd tier</th>
      <th class="optional-col" data-col-key="troop_200k" data-field="troop_200k">200k types</th>
      <th class="optional-col" data-col-key="captain_ready" data-field="captainReady">Captain</th>
      <th data-field="shiftLabel">Shift</th>
      <th class="optional-col" data-col-key="notes" data-field="notes">Notes</th>
      <th data-col-key="actions" data-field="actions">Actions</th>`;
    const tbody = table.querySelector('tbody') || table.appendChild(document.createElement('tbody'));
    tbody.innerHTML = '';

    state.playerById = new Map();
    state.players.forEach((p, idx) => {
      if (!p.id) p.id = `p${idx+1}`;
      p.assignment = p.assignment || null;
      p.rowEl = null;
      p.actionCellEl = null;

      const tr = document.createElement('tr');
      tr.dataset.playerId = p.id;
      tr.innerHTML = `
        <td data-field="name">${PNS.escapeHtml(p.name || '')}</td>
        <td class="optional-col" data-col-key="alliance" data-field="alliance">${PNS.escapeHtml(p.alliance || '')}</td>
        <td data-field="role"><span class="tag ${roleTagClass(p.role)}">${PNS.escapeHtml(PNS.normalizeRole(p.role))}</span></td>
        <td data-field="tier">${PNS.escapeHtml(PNS.normalizeTierText(p.tier))}</td>
        <td data-field="march">${PNS.formatNum(PNS.parseNumber(p.march))}</td>
        <td class="optional-col" data-col-key="rally_size" data-field="rally">${PNS.formatNum(PNS.parseNumber(p.rally))}</td>
        <td class="optional-col" data-col-key="lair_level" data-field="lair">${PNS.escapeHtml(String(p.lairLevel || ''))}</td>
        <td class="optional-col" data-col-key="secondary_role" data-field="secondary_role">${PNS.escapeHtml((p.secondaryRole && p.secondaryRole !== 'Unknown') ? p.secondaryRole : '')}</td>
        <td class="optional-col" data-col-key="secondary_tier" data-field="secondary_tier">${PNS.escapeHtml(PNS.normalizeTierText(p.secondaryTier || ''))}</td>
        <td class="optional-col" data-col-key="troop_200k" data-field="troop_200k">${PNS.escapeHtml(String(p.troop200k || ''))}</td>
        <td class="optional-col" data-col-key="captain_ready" data-field="captainReady">${p.captainReady ? '<span class="pill yes">Yes</span>' : '<span class="pill no">No</span>'}</td>
        <td data-field="shiftLabel">${PNS.escapeHtml(PNS.formatShiftLabelForCell(p.shift || 'both'))}</td>
        <td class="optional-col" data-col-key="notes" data-field="notes">${PNS.escapeHtml(String(p.notes || ''))}</td>
        <td class="muted" data-col-key="actions" data-field="actions"></td>`;
      tbody.appendChild(tr);

      p.rowEl = tr;
      p.actionCellEl = tr.querySelector('td[data-field="actions"]');
      p.shift = PNS.normalizeShiftValue(p.shift || p.shiftLabel || 'both');
      p.shiftLabel = PNS.formatShiftLabelForCell(p.shift);
      tr.dataset.shift = p.shift || 'both';
      p.role = PNS.normalizeRole(p.role);
      p.tier = PNS.normalizeTierText(p.tier);
      p.tierRank = PNS.tierRank(p.tier);
      p.march = PNS.parseNumber(p.march);
      p.rally = PNS.parseNumber(p.rally);
      p.captainReady = !!p.captainReady;

      state.playerById.set(p.id, p);
    });

    if (typeof PNS.applyColumnVisibility === 'function') PNS.applyColumnVisibility(state.showAllColumns);
    try { document.dispatchEvent(new CustomEvent('players-table-rendered')); } catch {}
  }

  PNS.getBaseEditorCandidates = getBaseEditorCandidates;
  PNS.syncManualInputsFromSelected = syncManualInputsFromSelected;
  PNS.saveManualPlayerFromBaseEditor = saveManualPlayerFromBaseEditor;
  PNS.renderBaseEditor = renderBaseEditor;

  PNS.updateBaseCard = updateBaseCard;
  PNS.updateBoardCol = updateBoardCol;
  PNS.updatePlayerRows = updatePlayerRows;

  PNS.renderPlayersTableFromState = renderPlayersTableFromState;
  PNS.renderAll = renderAll;

})();