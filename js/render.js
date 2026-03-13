(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state, $, $$ } = PNS;
  const t = (key, fallback = '') => (typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback);

  // --- helpers (swap-safe) ---
  function elAlive(el) {
    return !!(el && el.nodeType === 1 && document.contains(el));
  }

  function getPlayersTable() {
    return document.querySelector('#playersDataTable');
  }

  function resolveBaseEls(base) {
    // If DOM was swapped, old refs become dead. Rebind by data-base-id.
    if (!base) return;

    if (!elAlive(base.cardEl)) {
      const card = document.querySelector(`.base-card[data-base-id="${base.id}"]`)
        || document.querySelector(`.base-card[data-baseid="${base.id}"]`);
      if (card) base.cardEl = card;
    }

    if (!elAlive(base.boardEl)) {
      const col = document.querySelector(`.board-col[data-base-id="${base.id}"]`)
        || document.querySelector(`.board-col[data-baseid="${base.id}"]`);
      if (col) base.boardEl = col;
    }
  }

function optionalColumnClass(key) {
  const normalizedKey = String(key || '').trim();
  const visible = new Set(state.visibleOptionalColumns || []);
  const shouldShow = !!state.showAllColumns && visible.has(normalizedKey);
  return `optional-col${shouldShow ? '' : ' is-hidden-col'}`;
}

  function roleTagClass(role) {
    const r = PNS.normalizeRole(role).toLowerCase();
    if (r.includes('shoot')) return 'shooter';
    if (r.includes('fight')) return 'fighter';
    if (r.includes('ride')) return 'rider';
    return 'unknown';
  }

  function buildRoleBadge(role) {
    const cls = roleTagClass(role);
    const label = PNS.escapeHtml(typeof PNS.roleLabel === 'function' ? PNS.roleLabel(role, true) : PNS.normalizeRole(role));
    return `<span class="tag tag--role ${cls}">${label}</span>`;
  }

  function shiftBadgeClass(shift) {
    const normalized = String(shift || '').toLowerCase();
    if (normalized === 'shift1') return 'shift1';
    if (normalized === 'shift2') return 'shift2';
    return 'both';
  }

  function buildShiftBadge(shift) {
    const normalized = PNS.normalizeShiftValue(shift || 'both');
    const label = PNS.escapeHtml(PNS.formatShiftLabelForCell(normalized));
    return `<span class="shift-badge shift-badge--${shiftBadgeClass(normalized)}">${label}</span>`;
  }

  function helperMarchForBase(base, player) {
    if (!player) return 0;
    try {
      if (typeof PNS.getTowerEffectiveMarch === 'function') return Number(PNS.getTowerEffectiveMarch(base, player)) || 0;
      if (typeof PNS.getEffectiveTowerMarch === 'function') return Number(PNS.getEffectiveTowerMarch(base, player)) || 0;
      if (typeof PNS.getEffectiveMarchForBase === 'function') return Number(PNS.getEffectiveMarchForBase(base, player)) || 0;
    } catch {}
    return Number(player.march || 0) || 0;
  }
  function ensureCaptainNameRow(card) {
    if (!card) return null;
    const leftMain = $('.captain-col:not(.captain-col-right) .captain-main', card)
      || $('.captain-grid .captain-col .captain-main', card);
    if (!leftMain) return null;

    let row = $('.captain-name-row', leftMain);
    const nameEl = $('.captain-name', leftMain);
    if (!nameEl) return leftMain;

    if (!row) {
      row = document.createElement('div');
      row.className = 'captain-name-row';
      // Inline styles to avoid CSS dependency regressions after HTMX swaps / cached CSS
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '8px';
      row.style.width = '100%';

      leftMain.insertBefore(row, nameEl);
      row.appendChild(nameEl);
    } else {
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '8px';
      row.style.width = '100%';
      if (nameEl.parentElement !== row) row.prepend(nameEl);
    }

    nameEl.style.flex = '1 1 auto';
    nameEl.style.minWidth = '0';
    return row;
  }

  function renderBoardMetricStrip(capEl, capacityTotal, freeSpace, total) {
    if (!capEl) return;
    capEl.style.display = 'grid';
    capEl.style.gridTemplateColumns = '1fr 1fr 1fr';
    capEl.style.gap = '6px';
    capEl.style.alignItems = 'center';
    capEl.style.marginTop = '6px';

    const pill = (value, bg, fg, extra='') =>
      `<span style="display:block;text-align:center;background:${bg};color:${fg};border-radius:4px;padding:2px 4px;font-weight:700;${extra}">${PNS.formatNum(value)}</span>`;

    // 1) Rally+Captain (capacity), 2) Free space, 3) Total
    capEl.innerHTML = [
      pill(capacityTotal, '#1f4f92', '#fff'),
      pill(freeSpace, '#2c7a5a', '#fff'),
      pill(total, '#f2a30f', '#1a1200', 'font-weight:800;')
    ].join('');
  }

  function buildBoardRowHTML(kind, player, marchValue) {
    const name = PNS.escapeHtml(player?.name || '');
    const ally = PNS.escapeHtml(player?.alliance || '');
    const tier = PNS.escapeHtml(player?.tier || '');
    const march = PNS.formatNum(marchValue || 0);

    if (kind === 'captain') {
      return `<span>${name}</span><em>${ally}</em><b>${tier}</b><strong style="color:#9a5a00;">${march}</strong>`;
    }
    return `<span>${name}</span><em>${ally}</em><b>${tier}</b><strong>${march}</strong>`;
  }



  // ===== Quota row =====
  function renderQuotaRow(base) {
    resolveBaseEls(base);
    if (!base?.cardEl) return;

    const row = $('.quota-row', base.cardEl);
    if (!row) return;

    row.innerHTML = '';
    const lead = document.createElement('span');
    lead.textContent = typeof PNS.t === 'function' ? PNS.t('auto_fill') + ':' : 'Автозаповнення:';
    row.appendChild(lead);

    const activeRules = [];
    ['T14','T13','T12','T11','T10','T9'].forEach((k) => {
      const minM = PNS.clampInt(base?.tierMinMarch?.[k], 0);
      if (minM > 0) activeRules.push(`${k}≤${PNS.formatNum(minM)}`);
    });

    const summary = document.createElement('span');
    summary.className = 'quota-summary';
    summary.textContent = activeRules.length
      ? `${typeof PNS.t === 'function' ? PNS.t('tier_march_limits') : 'Ліміти маршу за тірами'}: ${activeRules.join(' · ')}`
      : (typeof PNS.t === 'function' ? `${PNS.t('auto_fill')}: ${PNS.t('tier_march_limits').toLowerCase()} — ${PNS.t('auto_tier_limits')}` : 'Ліміти маршу за тірами: авто');
    row.appendChild(summary);

    const mh = document.createElement('span');
    mh.className = 'quota-max';
    mh.textContent = `${typeof PNS.t === 'function' ? PNS.t('max_helpers') : 'Макс. помічників'}: ${Number(base.maxHelpers || 0)}`;
    row.appendChild(mh);
  }
  PNS.renderQuotaRow = renderQuotaRow;

  // ===== Base editor candidates =====
  function getBaseEditorCandidates(base) {
    const baseRole = PNS.getBaseRole(base);
    return (state.players || [])
      .filter((p) => PNS.matchesShift(p.shift || 'both', state.activeShift || 'all'))
      .filter((p) => base.shift === 'both' || p.shift === 'both' || p.shift === base.shift)
      .filter((p) => !baseRole || p.assignment?.kind === 'captain' || p.role === baseRole)
      .sort((a,b) =>
        (b.tierRank||0)-(a.tierRank||0) ||
        (b.march||0)-(a.march||0) ||
        String(a.name).localeCompare(String(b.name))
      );
  }

  function syncManualInputsFromSelected(base) {
    resolveBaseEls(base);
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
    resolveBaseEls(base);
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
    if (_tm) {
      const _n = Math.max(1, Math.min(14, Number(_tm[1])));
      tier = `T${_n}`;
    }

    const march = PNS.parseNumber(marchEl?.value || '0');

    if (!name) { if (statusEl) statusEl.textContent = typeof PNS.t === 'function' ? PNS.t('manual_save_enter_name') : 'Ручне збереження: введи нік гравця'; return; }
    if (!march) { if (statusEl) statusEl.textContent = typeof PNS.t === 'function' ? PNS.t('manual_save_enter_march') : 'Ручне збереження: введи розмір маршу'; return; }

    let p = pid ? state.playerById.get(pid) : null;

    if (p) {
      p.name = name;
      p.alliance = alliance;
      p.tier = tier;
      p.tierRank = PNS.tierRank(tier);
      p.march = march;
      if (statusEl) statusEl.textContent = t('updated_player_march', 'Оновлено {name}: марш {march}').replace('{name}', String(p.name || '')).replace('{march}', PNS.formatNum(march));
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
        notes: t('add_player_manually', 'Додати гравця вручну'),
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
      if (statusEl) statusEl.textContent = t('added_manual_player', 'Додано гравця вручну: {name} ({tier})').replace('{name}', String(p.name || '')).replace('{tier}', String(tier || ''));
    }

    if (typeof PNS.renderAll === 'function') PNS.renderAll();
  }

  function renderBaseEditor(base) {
    resolveBaseEls(base);
    const card = base.cardEl;
    if (!card) return;

    let editor = $('.base-editor', card);
    if (!editor) {
      editor = document.createElement('div');
      editor.className = 'base-editor';
      editor.innerHTML = `
        <div class="editor-row">
          <select data-base-editor-select="${base.id}" aria-label="${typeof PNS.t === 'function' ? PNS.t('player_choice') : 'Вибір гравця для турелі'}"></select>
          <button class="btn btn-sm" type="button" data-base-editor-action="captain" data-base-id="${base.id}">${typeof PNS.t === 'function' ? PNS.t('place_captain') : 'Поставити капітана'}</button>
          <button class="btn btn-sm" type="button" data-base-editor-action="helper" data-base-id="${base.id}">${typeof PNS.t === 'function' ? PNS.t('add_player_manually') : 'Додати помічника'}</button>
          <button class="btn btn-sm" type="button" data-base-editor-action="remove" data-base-id="${base.id}">${typeof PNS.t === 'function' ? PNS.t('remove_selected') : 'Прибрати вибраного'}</button>
        </div>
        <div class="editor-row mini-chip-list" data-base-chip-list="${base.id}"></div>
        <div class="editor-manual" data-base-manual="${base.id}">
          <div class="editor-manual-title">${typeof PNS.t === 'function' ? PNS.t('manual_player_title') : 'Ручне редагування або додавання гравця'}</div>
          <div class="editor-manual-grid">
            <label><span>${typeof PNS.t === 'function' ? PNS.t('player_nickname') : 'Нік гравця'}</span><input type="text" data-manual-name="${base.id}" placeholder="${typeof PNS.t === 'function' ? PNS.t('player_nickname') : 'Нік гравця'}"></label>
            <label><span>${typeof PNS.t === 'function' ? PNS.t('alliance') : 'Альянс'}</span><input type="text" data-manual-alliance="${base.id}" placeholder="${typeof PNS.t === 'function' ? PNS.t('alliance') : 'Альянс'}"></label>
            <label><span>${typeof PNS.t === 'function' ? PNS.t('tier') : 'Тір'}</span>
              <select data-manual-tier="${base.id}">
                <option>T1</option><option>T2</option><option>T3</option><option>T4</option><option>T5</option><option>T6</option><option>T7</option><option>T8</option><option>T9</option><option>T10</option><option>T11</option><option>T12</option><option>T13</option><option>T14</option>
              </select>
            </label>
            <label><span>${typeof PNS.t === 'function' ? PNS.t('march_power') : 'Марш'}</span><input type="number" min="0" step="1" data-manual-march="${base.id}" placeholder="0"></label>
          </div>
          <div class="editor-row"><button class="btn btn-sm" type="button" data-base-editor-action="manualsave" data-base-id="${base.id}">${typeof PNS.t === 'function' ? PNS.t('save') : 'Зберегти'}</button></div>
          <div class="muted small" data-manual-status="${base.id}">${typeof PNS.t === 'function' ? PNS.t('manual_status_hint') : 'Обери гравця, щоб змінити марш або тір, або введи нового й збережи.'}</div>
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
        ? `${typeof PNS.t === 'function' ? PNS.t('turret_type') : 'Тип турелі'}: ${typeof PNS.roleLabel === 'function' ? PNS.roleLabel(role) : role}. ${typeof PNS.t === 'function' ? PNS.t('turret_type_restricted') : 'Можна додавати лише помічників цього типу.'}`
        : (typeof PNS.t === 'function' ? PNS.t('type_defined_by_captain') : 'Тип турелі визначиться автоматично після вибору капітана.');
    }

    if (sel) {
      const currentVal = sel.value;
      const candidates = getBaseEditorCandidates(base);

      sel.innerHTML = '';
      const opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = typeof PNS.t === 'function' ? PNS.t('player_select_placeholder') : '— вибери гравця —';
      sel.appendChild(opt0);

      candidates.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;

        let assignedTag = '';
        if (p.assignment) {
          const assignedBase = state.baseById.get(p.assignment.baseId);
          const baseShort = (assignedBase?.title || '').split('/')[0].trim();
          assignedTag = p.assignment.baseId === base.id
            ? (p.assignment.kind === 'captain' ? ` [${typeof PNS.t === 'function' ? PNS.t('captain_tag_short') : 'КАП'}]` : ` [${typeof PNS.t === 'function' ? PNS.t('in_turret_tag') : 'У ТУРЕЛІ'}]`)
            : ` [${p.assignment.kind === 'captain' ? (typeof PNS.t === 'function' ? PNS.t('captain_tag_short') : 'КАП') : (typeof PNS.t === 'function' ? PNS.t('helper_tag_short') : 'ПОМ')} @ ${baseShort}]`;
        }

        const roleLabel = typeof PNS.roleLabel === 'function' ? PNS.roleLabel(p.role) : p.role;
        opt.textContent = `${p.name} • ${p.alliance || '—'} • ${roleLabel} • ${p.tier} • ${PNS.formatNum(p.march)} • ${p.shiftLabel}${assignedTag}`;
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
        chip.innerHTML = `<span>${t('captain', 'Капітан')}: ${PNS.escapeHtml(captain.name)} (${PNS.escapeHtml(captain.tier)})</span><button type="button" data-base-remove-player="${base.id}" data-player-id="${captain.id}" aria-label="${t('remove_captain_aria', 'Прибрати капітана')}">×</button>`;
        chipList.appendChild(chip);
      }

      helpers.forEach((p) => {
        const chip = document.createElement('div');
        chip.className = 'mini-chip';
        chip.innerHTML = `<span>${PNS.escapeHtml(p.name)} (${PNS.escapeHtml(p.tier)})</span><button type="button" data-base-remove-player="${base.id}" data-player-id="${p.id}" aria-label="${t('remove_helper_aria', 'Прибрати помічника')}">×</button>`;
        chipList.appendChild(chip);
      });

      if (!captain && !helpers.length) {
        const empty = document.createElement('div');
        empty.className = 'muted small';
        empty.textContent = t('no_players_in_turret_yet', 'У цій турелі ще немає призначених гравців.');
        chipList.appendChild(empty);
      }
    }

    if (typeof PNS.syncBaseEditorSettingsInputs === 'function') PNS.syncBaseEditorSettingsInputs(base);
  }

  // ===== Update cards =====
  function updateBaseCard(base) {
    resolveBaseEls(base);
    const card = base.cardEl;
    if (!card) return;

    const captain = base.captainId ? state.playerById.get(base.captainId) : null;
    const helpers = base.helperIds.map((id) => state.playerById.get(id)).filter(Boolean);

    PNS.applyBaseRoleUI(base, captain?.role || null);

    const nameEl = $('.captain-name', card);
    const metaEl = $('.captain-meta', card);

    if (nameEl && metaEl) {
      if (captain) {
        nameEl.textContent = captain.name;
        metaEl.textContent = `${captain.alliance || '—'} · ${captain.tier || '—'} · ${captain.shiftLabel || '—'}`;
        nameEl.classList.remove('captain-empty');
      } else {
        nameEl.textContent = typeof PNS.t === 'function' ? `— ${PNS.t('captain_not_selected')} —` : '— Капітан не обраний —';
        metaEl.textContent = `${typeof PNS.t === 'function' ? PNS.t('type_defined_by_captain') : 'Тип визначається капітаном'} · ${typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(base.shift === 'both' ? 'both' : base.shift) : (base.shift === 'both' ? 'Обидві' : base.shift.replace('shift', 'Зміна '))}`;
        nameEl.classList.add('captain-empty');
      }
    }

    // Captain quick-edit button (same modal as helper edit)
    const captainMain = $('.captain-col:not(.captain-col-right) .captain-main', card) || $('.captain-grid .captain-col .captain-main', card);
    if (captainMain) {
      const captainNameRow = ensureCaptainNameRow(card) || captainMain;
      let capEditBtn = captainMain.querySelector('[data-captain-edit-btn]');
      if (!capEditBtn) {
        capEditBtn = document.createElement('button');
        capEditBtn.type = 'button';
        capEditBtn.className = 'btn btn-xs btn-icon captain-edit-btn';
        capEditBtn.dataset.captainEditBtn = '1';
        capEditBtn.title = typeof PNS.t === 'function' ? PNS.t('edit') : 'Редагувати';
        capEditBtn.setAttribute('aria-label', typeof PNS.t === 'function' ? PNS.t('edit') : 'Редагувати');
        capEditBtn.textContent = '✎';
      }

      // Force in one row with captain name
      if (capEditBtn.parentElement !== captainNameRow) captainNameRow.appendChild(capEditBtn);
      capEditBtn.style.flex = '0 0 auto';
      capEditBtn.style.alignSelf = 'center';
      capEditBtn.style.marginTop = '0';
      capEditBtn.style.marginLeft = '8px';
      capEditBtn.style.position = 'relative';

      if (captain?.id) {
        capEditBtn.hidden = false;
        capEditBtn.disabled = false;
        capEditBtn.dataset.editAssignedPlayer = String(captain.id);
        capEditBtn.dataset.baseId = String(base.id);
        delete capEditBtn.dataset.openPickerBase;
        capEditBtn.title = typeof PNS.t === 'function' ? `${PNS.t('edit')} ${PNS.t('captain').toLowerCase()}` : 'Редагувати капітана';
      } else {
        // If captain is not selected yet — keep ✎ visible and route to tower editor picker for this base.
        capEditBtn.hidden = false;
        capEditBtn.disabled = false;
        delete capEditBtn.dataset.editAssignedPlayer;
        capEditBtn.dataset.baseId = String(base.id);
        capEditBtn.dataset.openPickerBase = String(base.id);
        capEditBtn.title = typeof PNS.t === 'function' ? PNS.t('choose_captain') : 'Обрати капітана';
      }
      capEditBtn.style.zIndex = '50';
      capEditBtn.style.pointerEvents = 'auto';
      capEditBtn.style.cursor = 'pointer';
      capEditBtn.dataset.mode = captain?.id ? 'edit' : 'pick';
      capEditBtn.onclick = (ev) => {
        try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.(); } catch {}
        try { PNS.ModalsShift?.initIfReady?.(); } catch {}
        const currentBaseId = String(base.id || capEditBtn.dataset.baseId || capEditBtn.dataset.openPickerBase || '');
        if (!currentBaseId) return false;
        try { state.focusedBaseId = currentBaseId; } catch {}
        if (captain?.id) {
          try { PNS.ModalsShift?.openTowerPlayerEditModal?.(currentBaseId, String(captain.id)); } catch {}
        } else {
          try { PNS.state.towerPickerSelectedBaseId = currentBaseId; } catch {}
          try { PNS.ModalsShift?.focusTowerById?.(currentBaseId); } catch {}
          let opened = false;
          try { opened = !!PNS.openTowerPickerSafe?.(currentBaseId); } catch {}
          if (!opened) {
            try { PNS.ModalsShift?.openTowerPickerModal?.(); opened = true; } catch {}
          }
        }
        return false;
      };
    }


    // Optional "Plan / Plan" block (newer card layout)
    const planShiftEl = $('.captain-shift', card) || $('[data-plan-shift]', card);
    const planCountEl = $('.captain-count', card) || $('[data-plan-count]', card);
    if (planShiftEl) {
      const activeShiftLabel = typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(state.activeShift === 'all' ? 'both' : (state.activeShift || 'both')) : (state.activeShift === 'shift1' ? t('shift1', 'Зміна 1') : (state.activeShift === 'shift2' ? t('shift2', 'Зміна 2') : t('both', 'Обидві')));
      planShiftEl.textContent = captain ? `🕒 ${activeShiftLabel}` : '—';
    }
    if (planCountEl) {
      planCountEl.textContent = String((captain ? 1 : 0) + helpers.length);
    }

    const captainMarch = captain?.march || 0;
    // Помічникs contribute capped/override value for this base (same source as Final Board)
    const helperContribution = (p) => Number(helperMarchForBase(base, p)) || 0;
    const helpersSum = helpers.reduce((s, p) => s + helperContribution(p), 0);
    const rallySize = captain?.rally || 0; // helpers capacity only
    const total = captainMarch + helpersSum; // requested: actual helpers sum + captain march
    const capacityTotal = captainMarch + rallySize; // captain + helper capacity
    const freeSpace = Math.max(0, capacityTotal - total);
    const over = !!(capacityTotal && total > capacityTotal);

    const statDivs = $$('.limit-grid > div', card);
    const setStat = (labelRegex, value, warn = false) => {
      const box = statDivs.find((d) => {
        const label = (d.querySelector('span')?.textContent || d.textContent || '').trim();
        return labelRegex.test(label);
      });
      const strong = box ? $('strong', box) : null;
      if (!strong) return;
      strong.textContent = PNS.formatNum(value);
      strong.classList.toggle('warn-text', !!warn);
    };

    // Supports both old and new card layouts by label text
    setStat(/марш\s*капітана|captain\s*march/i, captainMarch);
    setStat(/ралі|rally/i, rallySize);
    setStat(/разом|total/i, total, over);
    setStat(/вільне\s*місце|free\s*space/i, freeSpace, over);
    // Backward compatibility if some cards still show Помічникs / Limit
    setStat(/помічник|helpers/i, helpersSum);
    setStat(/limit/i, capacityTotal, over);

    card.classList.toggle('is-over-limit', over);

    const tbody = $('.helpers-table-wrap tbody', card);
    if (tbody) {
      tbody.innerHTML = '';
      const fragment = document.createDocumentFragment();
      if (!helpers.length) {
        const tr = document.createElement('tr');
        const cols = (tbody.closest('table')?.querySelectorAll('thead th')?.length) || 4;
        tr.innerHTML = `<td colspan="${cols}" class="muted">${t('helpers_not_assigned', 'Помічників ще не призначено')}</td>`;
        fragment.appendChild(tr);
      } else {
        helpers
          .slice()
          .sort((a, b) => b.tierRank - a.tierRank || b.march - a.march)
          .forEach((p) => {
            const tr = document.createElement('tr');
            const eff = helperContribution(p);
            const hasEditCol = ((tbody.closest('table')?.querySelectorAll('thead th')?.length) || 4) >= 5;
            tr.innerHTML = hasEditCol
              ? `<td>${PNS.escapeHtml(p.name)}</td><td>${PNS.escapeHtml(p.alliance)}</td><td>${PNS.escapeHtml(p.tier)}</td><td>${PNS.formatNum(eff)}</td><td><button type="button" class="btn btn-xs btn-icon" data-edit-assigned-player="${PNS.escapeHtml(p.id)}" data-base-id="${PNS.escapeHtml(base.id)}" aria-label="${t('edit_player_title', 'Редагування гравця')}">✎</button></td>`
              : `<td>${PNS.escapeHtml(p.name)}</td><td>${PNS.escapeHtml(p.alliance)}</td><td>${PNS.escapeHtml(p.tier)}</td><td>${PNS.formatNum(eff)}</td>`;
            fragment.appendChild(tr);
          });
      }
      tbody.appendChild(fragment);
    }

    renderBaseEditor(base);
    renderQuotaRow(base);
  }

  function updateBoardCol(base) {
    resolveBaseEls(base);
    if (!base.boardEl) return;

    const col = base.boardEl;
    const captain = base.captainId ? state.playerById.get(base.captainId) : null;
    const helpers = base.helperIds.map((id) => state.playerById.get(id)).filter(Boolean);

    const captainMarch = Number(captain?.march || 0) || 0;
    const helpersTotal = helpers.reduce((s, p) => s + (Number(helperMarchForBase(base, p)) || 0), 0);
    const total = captainMarch + helpersTotal;
    const rallySize = Number(captain?.rally || 0) || 0;
    const capacityTotal = captainMarch + rallySize;
    const freeSpace = Math.max(0, capacityTotal - total);

    PNS.setRoleTheme(col, captain?.role || null, false);

    const sub = $('.board-sub', col);
    if (sub) {
      sub.classList.toggle('is-auto', !captain);
      sub.textContent = captain ? `${typeof PNS.roleLabel === 'function' ? PNS.roleLabel(captain.role) : captain.role}` : (typeof PNS.t === 'function' ? PNS.t('type_defined_by_captain') : 'Тип визначається капітаном');
    }

    const cap = $('.board-cap', col);
    renderBoardMetricStrip(cap, capacityTotal, freeSpace, total);

    const ul = $('ul', col);
    if (!ul) return;
    ul.innerHTML = '';

    if (captain) {
      const li = document.createElement('li');
      li.className = 'captain-row';
      li.style.background = '#efe4b8';
      li.style.border = '1px solid #d0a748';
      li.style.boxShadow = 'inset 3px 0 0 #f2b120';
      li.innerHTML = buildBoardRowHTML('captain', captain, captain.march);
      ul.appendChild(li);
    }

    helpers
      .slice()
      .sort((a, b) => b.tierRank - a.tierRank || b.march - a.march)
      .forEach((p) => {
        const li = document.createElement('li');
        li.className = 'helper-row';
        li.innerHTML = buildBoardRowHTML('helper', p, helperMarchForBase(base, p));
        ul.appendChild(li);
      });

    if (!captain && !helpers.length) {
      const li = document.createElement('li');
      li.className = 'empty-row';
      li.textContent = typeof PNS.t === 'function' ? PNS.t('no_players_assigned_yet') : 'Гравців ще не призначено';
      ul.appendChild(li);
    }
  }

  function updatePlayerRows() {
    // ensure rowEl are alive (players_parse.js now handles relink)
    state.players.forEach((p) => {
      p.rowEl?.classList?.toggle('is-assigned', !!p.assignment);
      p.rowEl?.classList?.toggle('is-captain', p.assignment?.kind === 'captain');

      if (typeof PNS.setRowStatus === 'function') {
        PNS.setRowStatus(p, '', '');
      }
    });
  }

  function renderBoardFromTowerCalcResults() {
    const calcState = typeof window.getCalcState === 'function' ? window.getCalcState() : null;
    const activeShift = String(state.activeShift || calcState?.previewShift || '').toLowerCase() === 'shift2' ? 'shift2' : 'shift1';

    const boardModal = document.getElementById('board-modal');
    const previewHost = boardModal?.querySelector('#boardModalPreviewSheet') || document.querySelector('#board-modal #boardModalPreviewSheet');
    const statusEl = boardModal?.querySelector('#boardPreviewStatus') || document.querySelector('#board-modal #boardPreviewStatus');
    if (!previewHost) return false;

    const boardHtml =
      (typeof PNS.calcBuildBoardHtmlForShift === 'function'
        ? PNS.calcBuildBoardHtmlForShift(activeShift)
        : null) ||
      (typeof window.calcBuildBoardHtmlForShift === 'function'
        ? window.calcBuildBoardHtmlForShift(activeShift)
        : null);

    const shiftLabel = typeof PNS.shiftLabel === 'function'
      ? PNS.shiftLabel
      : ((value) => String(value || ''));
    const t = typeof PNS.t === 'function' ? PNS.t : ((_, fallback = '') => fallback);
    if (statusEl) statusEl.textContent = `${t('final_plan_status', 'Фінальний план')} · ${shiftLabel(activeShift)}`;

    if (boardHtml) {
      const host = document.createElement('div');
      host.innerHTML = String(boardHtml || '').trim();
      const builtSheet = host.querySelector('.board-sheet');
      const builtTitle = builtSheet?.querySelector('.board-title');
      if (builtSheet) {
        const liveTitle = builtTitle || document.createElement('div');
        try {
          liveTitle.id = 'boardTitle';
          liveTitle.setAttribute('data-no-fallback-i18n', '1');
          builtSheet.setAttribute('data-no-fallback-i18n', '1');
        } catch {}
        previewHost.innerHTML = '';
        previewHost.appendChild(builtSheet);

        state.bases.forEach((base) => {
          base.boardEl = null;
          resolveBaseEls(base);
        });
        return true;
      }
    }

    const results = state.towerCalcLastResults || null;
    const payload =
      (typeof PNS.getTowerCalcBoardPayloadForShift === 'function'
        ? PNS.getTowerCalcBoardPayloadForShift(activeShift, results)
        : null) ||
      (typeof window.getTowerCalcBoardPayloadForShift === 'function'
        ? window.getTowerCalcBoardPayloadForShift(activeShift, results)
        : null);
    if (!payload?.colsHtml) return false;

    previewHost.innerHTML = `<div class="board-sheet"><div class="board-title" id="boardTitle">${String(payload.title || '')}</div><div class="board-grid">${String(payload.colsHtml || '')}</div></div>`;
    try { previewHost.querySelector('#boardTitle')?.setAttribute('data-no-fallback-i18n', '1'); } catch {}

    state.bases.forEach((base) => {
      base.boardEl = null;
      resolveBaseEls(base);
    });

    return true;
  }

  function renderBoard() {
    state.bases.forEach(resolveBaseEls);
    let renderedStandalone = false;
    try { renderedStandalone = !!window.renderStandaloneFinalBoard?.(document.getElementById('board-modal')); } catch {}
    if (!renderedStandalone && !renderBoardFromTowerCalcResults()) {
      try { document.querySelector('#boardTitle')?.removeAttribute('data-no-fallback-i18n'); } catch {}
      state.bases.forEach(updateBoardCol);
    }
    try { PNS.ModalsShift?.updateBoardTitle?.(); } catch {}
    try { PNS.syncBoardLanguageSelects?.(); } catch {}
  }

  function renderAll() {
    // Rebind base els in case of swaps
    state.bases.forEach(resolveBaseEls);

    state.bases.forEach(updateBaseCard);
    renderBoard();
    updatePlayerRows();
    try { PNS.buildRowActions?.(); } catch {}

    if (typeof PNS.applyPlayerTableFilters === 'function') PNS.applyPlayerTableFilters();
  }

  function renderPlayersTableFromState() {
    const table = getPlayersTable();
    if (!table) return;

    let theadRow = table.querySelector('thead tr');
    if (!theadRow) {
      table.innerHTML = '<thead><tr></tr></thead><tbody></tbody>';
      theadRow = table.querySelector('thead tr');
    }

    const customOptionalDefs = (typeof PNS.getCustomOptionalDefs === 'function' ? PNS.getCustomOptionalDefs() : []);
    const customOptionalHeadHtml = customOptionalDefs.map((d) =>
      `<th class="${optionalColumnClass(String(d.key || ''))}" data-col-key="${PNS.escapeHtml(String(d.key || ''))}" data-field="${PNS.escapeHtml(String(d.key || ''))}">${PNS.escapeHtml(String(d.label || d.key || 'Custom'))}</th>`
    ).join('');

    theadRow.innerHTML = `
      <th data-field="name">${typeof PNS.t === 'function' ? PNS.t('player_name') : 'Нік гравця'}</th>
      <th data-field="alliance">${typeof PNS.t === 'function' ? PNS.t('alliance') : 'Альянс'}</th>
      <th data-field="role">${typeof PNS.t === 'function' ? PNS.t('troop_type') : 'Тип військ'}</th>
      <th data-field="tier">${typeof PNS.t === 'function' ? PNS.t('tier') : 'Тір'} <button type="button" class="sort-btn" data-sort="tier" aria-label="${typeof PNS.t === 'function' ? PNS.t('tier') : 'Тір'}">↓</button></th>
      <th data-field="march">${typeof PNS.t === 'function' ? PNS.t('march_power') : 'Марш'}</th>
      <th data-field="rally">${typeof PNS.t === 'function' ? PNS.t('rally_size') : 'Розмір ралі'} <button type="button" class="sort-btn" data-sort="rally" aria-label="${typeof PNS.t === 'function' ? PNS.t('rally_size') : 'Розмір ралі'}">↓</button></th>
      <th data-field="captainReady">${typeof PNS.t === 'function' ? PNS.t('captain') : 'Капітан'}</th>
      <th data-field="shiftLabel">${typeof PNS.t === 'function' ? PNS.t('shift') : 'Зміна'}</th>
      <th class="${optionalColumnClass('lair_level')}" data-col-key="lair_level" data-field="lair">${typeof PNS.t === 'function' ? PNS.t('lair_level') : 'Рівень лігва'}</th>
      ${customOptionalHeadHtml}
      <th data-col-key="actions" data-field="actions">${typeof PNS.t === 'function' ? PNS.t('placement') : 'Розміщення'}</th>`;

    const tbody = table.querySelector('tbody') || table.appendChild(document.createElement('tbody'));
    const fragment = document.createDocumentFragment();
    tbody.innerHTML = '';

    state.playerById = new Map();

    state.players.forEach((p, idx) => {
      if (!p.id) p.id = `p${idx + 1}`;
      p.assignment = p.assignment || null;
      p.rowEl = null;
      p.actionCellEl = null;

      p.shift = PNS.normalizeShiftValue(p.shift || p.shiftLabel || 'both');
      p.shiftLabel = PNS.formatShiftLabelForCell(p.shift);
      p.role = PNS.normalizeRole(p.role);
      p.tier = PNS.normalizeTierText(p.tier);
      p.tierRank = PNS.tierRank(p.tier);
      p.march = PNS.parseNumber(p.march);
      p.rally = PNS.parseNumber(p.rally);
      p.captainReady = !!p.captainReady;

      const tr = document.createElement('tr');
      tr.dataset.playerId = p.id;
      tr.dataset.shift = p.shift || 'both';

      const customOptionalCellsHtml = customOptionalDefs.map((d) => {
        const key = String(d.key || '');
        const val = p?.customFields && typeof p.customFields === 'object' ? p.customFields[key] : '';
        return `<td class="${optionalColumnClass(key)}" data-col-key="${PNS.escapeHtml(key)}" data-field="${PNS.escapeHtml(key)}">${PNS.escapeHtml(String(val || ''))}</td>`;
      }).join('');

      tr.innerHTML = `
        <td data-field="name">${PNS.escapeHtml(p.name || '')}</td>
        <td data-field="alliance">${PNS.escapeHtml(p.alliance || '')}</td>
        <td data-field="role">${buildRoleBadge(p.role)}</td>
        <td data-field="tier">${PNS.escapeHtml(PNS.normalizeTierText(p.tier))}</td>
        <td data-field="march">${PNS.formatNum(PNS.parseNumber(p.march))}</td>
        <td data-field="rally">${PNS.formatNum(PNS.parseNumber(p.rally))}</td>
        <td data-field="captainReady">${p.captainReady ? `<span class="pill yes">${typeof PNS.t === 'function' ? PNS.t('yes') : 'Так'}</span>` : `<span class="pill no">${typeof PNS.t === 'function' ? PNS.t('no') : 'Ні'}</span>`}</td>
        <td data-field="shiftLabel">${buildShiftBadge(p.shift)}</td>
        <td class="${optionalColumnClass('lair_level')}" data-col-key="lair_level" data-field="lair">${PNS.escapeHtml(String(p.lairLevel || ''))}</td>
        ${customOptionalCellsHtml}
        <td class="muted" data-col-key="actions" data-field="actions"></td>`;

      fragment.appendChild(tr);

      p.rowEl = tr;
      p.actionCellEl = tr.querySelector('td[data-field="actions"]');

      state.playerById.set(p.id, p);
    });

    tbody.appendChild(fragment);

    if (typeof PNS.applyColumnVisibility === 'function') PNS.applyColumnVisibility(state.showAllColumns);

    // let others know the table is rebuilt
    try { document.dispatchEvent(new CustomEvent('players-table-data-changed')); } catch {}
    try { document.dispatchEvent(new CustomEvent('players-table-rendered')); } catch {}
  }

  // expose
  PNS.getBaseEditorCandidates = getBaseEditorCandidates;
  PNS.syncManualInputsFromSelected = syncManualInputsFromSelected;
  PNS.saveManualPlayerFromBaseEditor = saveManualPlayerFromBaseEditor;
  PNS.renderBaseEditor = renderBaseEditor;

  PNS.updateBaseCard = updateBaseCard;
  PNS.updateBoardCol = updateBoardCol;
  PNS.updatePlayerRows = updatePlayerRows;
  PNS.renderBoard = renderBoard;

  PNS.renderPlayersTableFromState = renderPlayersTableFromState;
  PNS.renderAll = renderAll;

  // after partial swap refresh: try to repaint using live DOM
  document.addEventListener('pns:dom:refreshed', () => {
    // if DOM changed, base elements may need rebind; just rerender safely
    try { renderAll(); } catch (e) { console.error(e); }
  });

})();

document.addEventListener('change', (e) => {
  const langBox = e.target.closest('[data-board-lang-option], [data-calc-board-lang-option]');
  if (langBox) {
    const scope = langBox.closest('[data-board-lang-dialog-card]') || document;
    const checked = Array.from(scope.querySelectorAll('[data-board-lang-option], [data-calc-board-lang-option]'))
      .filter((el) => el.checked)
      .map((el) => String(el.value || '').toLowerCase())
      .filter(Boolean);
    try { if (typeof window.setBoardLanguageLocales === 'function') window.setBoardLanguageLocales(checked); } catch {}
    try { window.PNS?.syncBoardLanguageSelects?.(); } catch {}
    try { window.PNS?.renderBoard?.(); } catch {}
    try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {}
    return;
  }
  const sel = e.target.closest('[data-board-lang-mode]');
  if (!sel) return;
  try { if (typeof window.setBoardLanguageMode === 'function') window.setBoardLanguageMode(String(sel.value || 'en_local')); } catch {}
  try { window.PNS?.syncBoardLanguageSelects?.(); } catch {}
  try { window.PNS?.renderBoard?.(); } catch {}
  try { window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal')); } catch {}
});
