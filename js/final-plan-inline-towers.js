/* Final plan inline tower detail / picker helpers */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;
  const ModalsShift = PNS.ModalsShift = PNS.ModalsShift || {};
  const state = PNS.state = PNS.state || {};

  function escapeHtml(value) {
    return (PNS.escapeHtml || (v => String(v).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch] || ch))))(String(value ?? ''));
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('en-US');
  }

  function tr(key, fallback = '') {
    try {
      return typeof PNS.t === 'function' ? PNS.t(key, fallback) : (fallback || key);
    } catch {
      return fallback || key;
    }
  }

  function roleLabel(role, short = false) {
    try {
      return typeof PNS.roleLabel === 'function' ? PNS.roleLabel(role, short) : String(role || '');
    } catch {
      return String(role || '');
    }
  }

  function shiftLabel(shift) {
    try {
      return typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(shift) : String(shift || '');
    } catch {
      return String(shift || '');
    }
  }

  function getCalcState() {
    try {
      if (typeof window.getCalcState === 'function') return window.getCalcState();
    } catch {}
    state.towerCalc = state.towerCalc && typeof state.towerCalc === 'object' ? state.towerCalc : {};
    return state.towerCalc;
  }

  function persistCalcState(calcState) {
    try {
      localStorage.setItem('pns_tower_calc_state', JSON.stringify(calcState));
    } catch {}
  }

  function normalizeShift(shift) {
    return String(shift || '').toLowerCase() === 'shift2' ? 'shift2' : 'shift1';
  }

  function getBaseSlots() {
    try {
      if (typeof window.__pnsGetBaseSlots === 'function') return window.__pnsGetBaseSlots();
    } catch {}
    const ids = [];
    try {
      (ModalsShift.getTowerCards?.() || []).forEach(card => {
        const baseId = String(card?.dataset?.baseId || card?.dataset?.baseid || '');
        if (baseId && !ids.includes(baseId)) ids.push(baseId);
      });
    } catch {}
    if (!ids.length) {
      for (const base of state.bases || []) {
        const baseId = String(base?.id || '');
        if (baseId && !ids.includes(baseId)) ids.push(baseId);
      }
    }
    return ids.slice(0, 5).map(baseId => state.baseById?.get?.(baseId) || { id: baseId, title: baseId });
  }

  function setInlineSelectedBaseId(shift, baseId) {
    const calcState = getCalcState();
    const shiftKey = normalizeShift(shift);
    calcState.inlineTowerSelected = calcState.inlineTowerSelected || {};
    calcState.inlineTowerSelected[shiftKey] = String(baseId || '');
    persistCalcState(calcState);
    return calcState.inlineTowerSelected[shiftKey];
  }

  function getInlineAssignedMarch(baseLike, player, shift) {
    try {
      if (typeof window.__pnsGetBoardAssignedMarch === 'function') {
        return window.__pnsGetBoardAssignedMarch(baseLike, player, shift);
      }
    } catch {}
    return player ? Math.max(0, Number(player.march || 0) || 0) : 0;
  }

  function distributeInlineTierMarch(players, limitsById, capacity) {
    const target = Math.max(0, Math.floor(Number(capacity || 0) || 0));
    const assignedById = {};
    let free = target;
    const queue = [];

    for (const player of players || []) {
      const playerId = String(player?.id || '');
      const value = Math.max(0, Math.floor(Number(limitsById?.[playerId] || 0) || 0));
      assignedById[playerId] = 0;
      if (playerId && value > 0) queue.push({ pid: playerId, left: value });
    }

    while (queue.length && free > 0) {
      const slice = Math.max(1, Math.floor(free / queue.length));
      let usedThisRound = 0;
      const nextQueue = [];
      for (const item of queue) {
        const grant = Math.min(item.left, slice, free - usedThisRound);
        if (grant > 0) {
          assignedById[item.pid] = Math.max(0, Number(assignedById[item.pid] || 0) + grant);
          item.left -= grant;
          usedThisRound += grant;
        }
        if (item.left > 0) nextQueue.push(item);
        if (usedThisRound >= free) break;
      }
      if (usedThisRound <= 0) break;
      free = Math.max(0, free - usedThisRound);
      queue.length = 0;
      nextQueue.forEach(item => queue.push(item));
    }

    return {
      assignedById,
      used: Math.max(0, target - free),
      free
    };
  }

  function resolveInlineTowerState(base, shift) {
    try {
      if (typeof window.__pnsResolveBoardTowerState === 'function') {
        return window.__pnsResolveBoardTowerState(base, shift);
      }
    } catch {}
    return {
      captain: null,
      helpers: [],
      rule: {
        maxHelpers: Number(base?.maxHelpers || 29) || 29,
        tierMinMarch: {
          T14: Number(base?.tierMinMarch?.T14 || 0) || 0,
          T13: Number(base?.tierMinMarch?.T13 || 0) || 0,
          T12: Number(base?.tierMinMarch?.T12 || 0) || 0,
          T11: Number(base?.tierMinMarch?.T11 || 0) || 0,
          T10: Number(base?.tierMinMarch?.T10 || 0) || 0,
          T9: Number(base?.tierMinMarch?.T9 || 0) || 0
        }
      },
      captainMarch: 0,
      rallySize: 0,
      helpersTotal: 0,
      total: 0,
      capacityTotal: 0,
      free: 0,
      baseLike: {
        id: String(base?.id || ''),
        title: String(base?.title || base?.id || ''),
        captainId: '',
        helperIds: [],
        role: base?.role || null,
        maxHelpers: Number(base?.maxHelpers || 29) || 29,
        tierMinMarch: {
          T14: Number(base?.tierMinMarch?.T14 || 0) || 0,
          T13: Number(base?.tierMinMarch?.T13 || 0) || 0,
          T12: Number(base?.tierMinMarch?.T12 || 0) || 0,
          T11: Number(base?.tierMinMarch?.T11 || 0) || 0,
          T10: Number(base?.tierMinMarch?.T10 || 0) || 0,
          T9: Number(base?.tierMinMarch?.T9 || 0) || 0
        }
      }
    };
  }

  function recalculateTowerComposition(baseId, shift) {
    const base = state.baseById?.get?.(String(baseId || ''));
    const shiftKey = normalizeShift(shift || 'shift1');
    if (!base) return { ok: false, reason: tr('tower_not_found', 'Турель не знайдено.') };

    const towerState = resolveInlineTowerState(base, shiftKey);
    const helpers = Array.isArray(towerState.helpers) ? towerState.helpers.slice() : [];
    const helperRoom = Math.max(0, Math.floor(Number(towerState.rallySize || 0) || 0));
    const tierOrderLowToHigh = ['T9', 'T10', 'T11', 'T12', 'T13', 'T14'];
    const assignedById = {};
    const helpersByTier = {};
    const explicitTierIndices = [];

    for (const tier of tierOrderLowToHigh) helpersByTier[tier] = [];

    // Base desired assignment:
    // - explicit tier limit (>0) caps only that tier against the player's full march;
    // - empty limit (0) keeps the CURRENT assigned march untouched.
    // This is important because recalculation must not reset higher tiers back to full march
    // when the user only changes a lower tier limit.
    for (const helper of helpers) {
      const playerId = String(helper?.id || '');
      if (!playerId) continue;
      const tier = String(helper?.tier || '').toUpperCase();
      const normalizedTier = tierOrderLowToHigh.includes(tier) ? tier : 'T9';
      const fullMarch = Math.max(0, Math.floor(Number(helper?.march || 0) || 0));
      const currentAssigned = Math.max(0, Math.floor(Number(getInlineAssignedMarch(towerState.baseLike, helper, shiftKey) || 0) || 0));
      const tierLimit = Math.max(0, Number(towerState?.rule?.tierMinMarch?.[normalizedTier] || 0) || 0);
      if (tierLimit > 0) explicitTierIndices.push(tierOrderLowToHigh.indexOf(normalizedTier));
      assignedById[playerId] = tierLimit > 0 ? Math.min(fullMarch, tierLimit) : currentAssigned;
      helpersByTier[normalizedTier].push(helper);
    }

    let totalAssigned = Object.values(assignedById).reduce((sum, value) => sum + (Math.max(0, Number(value || 0)) || 0), 0);
    let free = Math.max(0, helperRoom - totalAssigned);

    const trimTier = (tier, overflow) => {
      if (overflow <= 0) return 0;
      const tierPlayers = helpersByTier[tier] || [];
      if (!tierPlayers.length) return overflow;
      const tierCurrentById = {};
      let tierCurrentTotal = 0;
      for (const player of tierPlayers) {
        const playerId = String(player?.id || '');
        const current = Math.max(0, Math.floor(Number(assignedById?.[playerId] || 0) || 0));
        tierCurrentById[playerId] = current;
        tierCurrentTotal += current;
      }
      if (tierCurrentTotal <= 0) return overflow;

      if (overflow >= tierCurrentTotal) {
        // Keep players in tower, but allow their march to become 0 if required.
        for (const player of tierPlayers) {
          const playerId = String(player?.id || '');
          if (playerId) assignedById[playerId] = 0;
        }
        return Math.max(0, overflow - tierCurrentTotal);
      }

      const keepTotal = Math.max(0, tierCurrentTotal - overflow);
      const distribution = distributeInlineTierMarch(tierPlayers, tierCurrentById, keepTotal);
      for (const player of tierPlayers) {
        const playerId = String(player?.id || '');
        if (playerId) assignedById[playerId] = Math.max(0, Math.floor(Number(distribution.assignedById?.[playerId] || 0) || 0));
      }
      return 0;
    };

    if (totalAssigned > helperRoom) {
      let overflow = Math.max(0, totalAssigned - helperRoom);
      const lowestExplicitIndex = explicitTierIndices.length ? Math.min(...explicitTierIndices) : -1;
      const lowestPresentIndex = tierOrderLowToHigh.findIndex(tier => (helpersByTier[tier] || []).length > 0);

      // First pass:
      // - if there are explicit limits, trim only tiers LOWER than the lowest explicit tier;
      // - if all limits are 0, trim only the single lowest present tier.
      let firstPass = [];
      if (lowestExplicitIndex >= 0) {
        firstPass = tierOrderLowToHigh.slice(0, lowestExplicitIndex);
      } else if (lowestPresentIndex >= 0) {
        firstPass = [tierOrderLowToHigh[lowestPresentIndex]];
      }
      for (const tier of firstPass) {
        overflow = trimTier(tier, overflow);
        if (overflow <= 0) break;
      }

      // Second pass only if the first pass was not enough.
      if (overflow > 0) {
        const alreadyTried = new Set(firstPass);
        for (const tier of tierOrderLowToHigh) {
          if (alreadyTried.has(tier)) continue;
          overflow = trimTier(tier, overflow);
          if (overflow <= 0) break;
        }
      }

      totalAssigned = Object.values(assignedById).reduce((sum, value) => sum + (Math.max(0, Number(value || 0)) || 0), 0);
      free = Math.max(0, helperRoom - totalAssigned);
    }

    const keptHelperIds = [];
    for (const helper of helpers) {
      const playerId = String(helper?.id || '');
      const fullMarch = Math.max(0, Math.floor(Number(helper?.march || 0) || 0));
      const assigned = Math.max(0, Math.floor(Number(assignedById?.[playerId] || 0) || 0));
      try {
        if (playerId) keptHelperIds.push(playerId);
        if (assigned >= fullMarch) PNS.clearTowerMarchOverride?.(baseId, playerId, shiftKey);
        else PNS.setTowerMarchOverride?.(baseId, playerId, assigned, shiftKey);
      } catch {}
    }
    base.helperIds = Array.from(new Set(keptHelperIds));
    try { PNS.savePlayersSnapshot?.(state.players); } catch {}
    try { PNS.saveTowersSnapshot?.(); } catch {}
    try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
    try { PNS.persistSessionStateSoon?.(10); } catch {}

    try {
      window.calcRenderInlineTowerSettings?.(document.getElementById('towerCalcModal'));
    } catch {}
    try {
      window.calcRenderLiveFinalBoard?.(document.getElementById('towerCalcModal'));
    } catch {}

    return {
      ok: true,
      helperRoom,
      used: Math.max(0, totalAssigned),
      free,
      helpers: helpers.length,
      assignedById
    };
  }

  function renderInlineTowerSettings(modal) {
    const root = modal || document.getElementById('towerCalcModal');
    if (!root) return;

    const calcState = getCalcState();
    const shiftKey = normalizeShift(calcState.activeTab || 'shift1');
    const listNode = root.querySelector('#towerCalcInlineList');
    const detailNode = root.querySelector('#towerCalcInlineDetail');
    if (!listNode || !detailNode) return;

    const bases = getBaseSlots().map(base => state.baseById?.get?.(String(base?.id || '')) || base).filter(Boolean);
    if (!bases.length) {
      listNode.innerHTML = '';
      detailNode.innerHTML = PNS.renderHtmlTemplate('tpl-tower-calc-inline-empty', {
        turrets_text: tr('turrets', 'Турелі')
      });
      return;
    }

    let selectedBaseId = String(calcState?.inlineTowerSelected?.[shiftKey] || '');
    if (!selectedBaseId) selectedBaseId = String(getBaseSlots()?.[0]?.id || '');
    if (!bases.some(base => String(base.id) === selectedBaseId)) selectedBaseId = String(bases[0].id || '');
    setInlineSelectedBaseId(shiftKey, selectedBaseId);

    listNode.innerHTML = bases.map((base, index) => {
      const towerState = resolveInlineTowerState(base, shiftKey);
      const hasCaptain = !!towerState.captain;
      const playersCount = (hasCaptain ? 1 : 0) + Number(towerState.helpers.length || 0);
      const title = escapeHtml(String(base.title || base.id || `${tr('turret', 'Турель')} ${index + 1}`).split('/')[0].trim());
      return PNS.renderHtmlTemplate('tpl-tower-picker-item', {
        active_class: String(base.id) === selectedBaseId ? 'active' : '',
        ready_class: hasCaptain ? 'is-ready tower-done' : 'is-not-ready',
        base_id: escapeHtml(base.id),
        shift_key: escapeHtml(shiftKey),
        title,
        status_icon: hasCaptain ? '✓' : '!',
        ready_text: hasCaptain ? tr('ready', 'Готова') : tr('no_captain_short', 'Без капітана'),
        count_class: hasCaptain ? 'is-ready' : 'is-not-ready',
        players_short_text: tr('players_short', 'гравців'),
        players_count: playersCount
      });
    }).join('');

    const selectedBase = bases.find(base => String(base.id) === selectedBaseId) || bases[0];
    const towerState = resolveInlineTowerState(selectedBase, shiftKey);
    const captain = towerState.captain;
    const rule = towerState.rule || {
      maxHelpers: Number(selectedBase.maxHelpers || 0) || 0,
      tierMinMarch: { ...(selectedBase.tierMinMarch || {}) }
    };
    const title = escapeHtml(String(selectedBase.title || selectedBase.id || '').split('/')[0].trim());

    let captainCandidates = [];
    try {
      captainCandidates = ModalsShift.eligibleCaptainsForBase?.(selectedBase, shiftKey) || [];
    } catch {}

    const helperRowsHtml = towerState.helpers.map(player => {
      const march = getInlineAssignedMarch(towerState.baseLike, player, shiftKey);
      return PNS.renderHtmlTemplate('tpl-tower-picker-helper-row', {
        name: escapeHtml(player.name || ''),
        alliance: escapeHtml(player.alliance || ''),
        role: escapeHtml(roleLabel(player.role || '', false)),
        tier: escapeHtml(player.tier || ''),
        march: formatNumber(march),
        player_id: escapeHtml(player.id),
        base_id: escapeHtml(selectedBase.id)
      });
    }).join('');

    const renderDetail = (templateId, data) => PNS.renderHtmlTemplate(templateId, data || {});

    const captainOptionsHtml = captainCandidates.map(player => renderDetail('tpl-tower-picker-captain-option', {
      player_id: escapeHtml(player.id),
      selected_attr: captain && String(captain.id) === String(player.id) ? 'selected' : '',
      label: `${escapeHtml(String(player.name || ''))} · ${escapeHtml(roleLabel(String(player.role || ''), false))} · ${escapeHtml(shiftLabel(String(player.shiftLabel || player.shift || '')))} · ${formatNumber(player.march || 0)}${player.captainReady ? ` · ${tr('captain_tag_short', 'КАП')}` : ''}`
    })).join('');

    const tierInputsHtml = ['T14', 'T13', 'T12', 'T11', 'T10', 'T9'].map(tier => renderDetail('tpl-tower-picker-tier-input', {
      tier,
      value: Number(rule?.tierMinMarch?.[tier] || 0) || 0
    })).join('');

    const suggestionsHtml = (state.players || []).slice().sort((left, right) =>
      String(left.name || '').localeCompare(String(right.name || ''))
    ).map(player => renderDetail('tpl-tower-picker-suggestion-option', {
      value: escapeHtml(String(player.name || '')),
      label: `${escapeHtml(String(player.alliance || ''))} · ${escapeHtml(roleLabel(String(player.role || ''), false))} · ${escapeHtml(String(player.tier || ''))} · ${formatNumber(player.march || 0)}`
    })).join('');

    const captainRowHtml = captain ? renderDetail('tpl-tower-picker-captain-row', {
      name: escapeHtml(captain.name || ''),
      alliance: escapeHtml(captain.alliance || ''),
      role: escapeHtml(roleLabel(captain.role || '', false)),
      tier: escapeHtml(captain.tier || ''),
      march: formatNumber(towerState.captainMarch),
      player_id: escapeHtml(captain.id),
      base_id: escapeHtml(selectedBase.id)
    }) : '';

    const emptyRowHtml = captain || towerState.helpers.length
      ? ''
      : renderDetail('tpl-tower-picker-empty-row', {
          colspan: '6',
          message: escapeHtml(tr('no_assigned_players', 'Немає призначених гравців'))
        });

    detailNode.innerHTML = renderDetail('tpl-tower-picker-detail', {
      scope: escapeHtml(shiftKey),
      title,
      shift_text: escapeHtml(tr('shift', 'Зміна')),
      scope_label: escapeHtml(shiftLabel(shiftKey)),
      only_captains_checked: state.towerPickerOnlyCaptains !== false ? 'checked' : '',
      only_captains_text: escapeHtml(tr('only_captains', 'Тільки капітани')),
      match_shift_checked: state.towerPickerMatchRegisteredShift !== false ? 'checked' : '',
      match_shift_text: escapeHtml(tr('respect_player_shift', 'Враховувати зміну гравця')),
      no_mix_checked: state.towerPickerNoMixTroops !== false ? 'checked' : '',
      no_mix_text: escapeHtml(tr('same_troop_only', 'Лише той самий тип військ')),
      use_both_checked: state.towerPickerNoCrossShiftDupes === true ? 'checked' : '',
      use_both_text: escapeHtml(tr('use_both', 'Використовувати «Обидві»')),
      captain_aria_label: escapeHtml(tr('choose_captain', 'Вибрати капітана…')),
      captain_placeholder_text: escapeHtml(captain ? tr('change_captain', 'Змінити капітана…') : tr('choose_captain', 'Вибрати капітана…')),
      captain_options_html: captainOptionsHtml,
      base_id: escapeHtml(selectedBase.id),
      place_captain_text: escapeHtml(tr('place_captain', 'Поставити капітана')),
      auto_fill_text: escapeHtml(tr('auto_fill', 'Автозаповнення')),
      clear_turret_text: escapeHtml(tr('clear_turret', 'Очистити турель')),
      captain_march_text: escapeHtml(tr('captain_march', 'Марш капітана')),
      captain_march_value: escapeHtml(formatNumber(towerState.captainMarch)),
      rally_size_text: escapeHtml(tr('rally_size', 'Розмір ралі')),
      rally_size_value: escapeHtml(formatNumber(towerState.rallySize)),
      total_sum_text: escapeHtml(tr('total_sum', 'Разом')),
      total_sum_value: escapeHtml(formatNumber(towerState.total)),
      free_space_text: escapeHtml(tr('free_space', 'Вільне місце')),
      free_space_value: escapeHtml(formatNumber(towerState.free)),
      limits_by_tier_text: escapeHtml(tr('limits_by_tier', 'Налаштування турелі · ліміти по тірах')),
      march_lower_text: escapeHtml(tr('march', 'Марш').toLowerCase()),
      max_players_text: escapeHtml(tr('max_players', 'Макс. гравців')),
      max_helpers_value: escapeHtml(Number(rule.maxHelpers || 0) || 0),
      save_limits_text: escapeHtml(tr('save_limits', 'Зберегти ліміти')),
      recalc_composition_text: escapeHtml(tr('recalc_composition', 'Перерахувати склад')),
      reset_limits_text: escapeHtml(tr('reset_limits', 'Скинути ліміти')),
      tier_inputs_html: tierInputsHtml,
      flexible_tier_note_text: escapeHtml(tr('flexible_tier_note', '0 = гнучкий тір: бере повний марш, але якщо місця не вистачає — ділить залишок між гравцями цього тіру.')),
      add_player_manually_text: escapeHtml(tr('add_player_manually', 'Додати гравця вручну')),
      search_player_text: escapeHtml(tr('search_player_from_list', 'Пошук гравця (зі списку)')),
      nickname_custom_text: escapeHtml(tr('nickname_custom', 'Нік (можна свій, не зі списку)')),
      suggestions_html: suggestionsHtml,
      alliance_text: escapeHtml(tr('alliance', 'Альянс')),
      fighter_text: escapeHtml(tr('fighter', 'Боєць')),
      shooter_text: escapeHtml(tr('shooter', 'Стрілець')),
      rider_text: escapeHtml(tr('rider', 'Наїзник')),
      march_text: escapeHtml(tr('march', 'Марш')),
      players_in_turret_title_text: escapeHtml(tr('players_in_turret_title', 'Гравці в турелі')),
      players_panel_state_text: escapeHtml(captain ? tr('captain_and_players', 'Капітан і гравці') : tr('no_captain', 'Без капітана')),
      player_text: escapeHtml(tr('player', 'Гравець')),
      ally_text: escapeHtml(tr('ally', 'Альянс')),
      role_text: escapeHtml(tr('role', 'Роль')),
      tier_text: escapeHtml(tr('tier', 'Тір'))
    });

    const rowsTarget = detailNode.querySelector('[data-picker-rows-target="1"]');
    if (rowsTarget) rowsTarget.innerHTML = captainRowHtml + helperRowsHtml + emptyRowHtml;
  }

  Object.assign(PNS, {
    setInlineSelectedBaseId,
    getInlineAssignedMarch,
    distributeInlineTierMarch,
    resolveInlineTowerState,
    recalculateTowerComposition,
    renderInlineTowerSettings
  });

  Object.assign(window, {
    calcSetInlineSelectedBaseIdImpl: setInlineSelectedBaseId,
    calcGetInlineAssignedMarchImpl: getInlineAssignedMarch,
    calcDistributeInlineTierMarchImpl: distributeInlineTierMarch,
    calcResolveInlineTowerStateImpl: resolveInlineTowerState,
    calcRecalculateTowerCompositionImpl: recalculateTowerComposition,
    calcRenderInlineTowerSettingsImpl: renderInlineTowerSettings,
    calcRecalculateTowerComposition: recalculateTowerComposition,
    calcRenderInlineTowerSettings: renderInlineTowerSettings,
    calcSetInlineSelectedBaseId: setInlineSelectedBaseId
  });
})();
