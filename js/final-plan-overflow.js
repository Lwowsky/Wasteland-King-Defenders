/* Final plan tower calc overflow / reserve helpers */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;

  function escapeHtml(value) {
    return (PNS.escapeHtml || (v => String(v).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch] || ch))))(String(value ?? ''));
  }

  function tr(key, fallback = '') {
    try {
      return typeof PNS.t === 'function' ? PNS.t(key, fallback) : (fallback || key);
    } catch {
      return fallback || key;
    }
  }

  function roleNorm(value) {
    try {
      if (typeof window.roleNorm === 'function') return window.roleNorm(value);
    } catch {}
    const text = String(value || '').toLowerCase();
    return text.includes('fight') ? 'fighter'
      : text.includes('rid') ? 'rider'
      : (text.includes('shoot') || text.includes('arch')) ? 'shooter'
      : '';
  }

  function getCalcState() {
    try {
      if (typeof window.getCalcState === 'function') return window.getCalcState();
    } catch {}
    PNS.state = PNS.state || {};
    PNS.state.towerCalc = PNS.state.towerCalc && typeof PNS.state.towerCalc === 'object' ? PNS.state.towerCalc : {};
    return PNS.state.towerCalc;
  }

  function persistCalcState(state) {
    try {
      localStorage.setItem('pns_tower_calc_state', JSON.stringify(state));
    } catch {}
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('en-US');
  }

  function activeShiftKeys(){
    let count = 2;
    try {
      if (typeof PNS.getTowerCalcShiftCount === 'function') count = Number(PNS.getTowerCalcShiftCount()) || 2;
    } catch {}
    count = Math.max(1, Math.min(4, count));
    return Array.from({ length: count }, (_, index) => `shift${index + 1}`);
  }

  function shiftTitle(key){
    if (key === 'both') return typeof PNS.getBothDisplayLabel === 'function' ? PNS.getBothDisplayLabel() : tr('both', 'Всі');
    return typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(key) : tr(key, key.replace('shift', 'Зміна '));
  }

  function setOverflowReserve(playerId, shift) {
    const state = getCalcState();
    const normalizedPlayerId = String(playerId || '');
    const normalizedShift = /^shift[1-4]$/.test(String(shift || '').toLowerCase())
      ? String(shift).toLowerCase()
      : '';
    if (!normalizedPlayerId) return;
    state.overflowReserve = state.overflowReserve || {};
    if (normalizedShift) state.overflowReserve[normalizedPlayerId] = normalizedShift;
    else delete state.overflowReserve[normalizedPlayerId];
    persistCalcState(state);
  }

  function collectShiftStats() {
    const state = PNS.state || {};
    const stats = {
      shift1: { total: 0, shooter: 0, rider: 0, fighter: 0 },
      shift2: { total: 0, shooter: 0, rider: 0, fighter: 0 },
      shift3: { total: 0, shooter: 0, rider: 0, fighter: 0 },
      shift4: { total: 0, shooter: 0, rider: 0, fighter: 0 },
      both: { total: 0, shooter: 0, rider: 0, fighter: 0 },
      unknown: { total: 0, shooter: 0, rider: 0, fighter: 0 },
      total: 0
    };

    for (const player of Array.isArray(state.players) ? state.players : []) {
      if (!player) continue;
      const normalizedShift = String((typeof PNS.normalizeShiftValue === 'function'
        ? PNS.normalizeShiftValue(player?.shift || player?.shiftLabel || 'both')
        : player?.shift || player?.shiftLabel || 'both') || 'both').toLowerCase();
      const bucket = stats[normalizedShift] ? normalizedShift : 'unknown';
      stats[bucket].total += 1;
      const troop = roleNorm(player.role) || '';
      if (troop && Object.prototype.hasOwnProperty.call(stats[bucket], troop)) {
        stats[bucket][troop] += 1;
      }
      stats.total += 1;
    }

    return stats;
  }

  function renderOverflowReservePanel(modal, results) {
    const state = PNS.state || {};
    const mount = (modal || document.getElementById('towerCalcModal'))?.querySelector?.('#towerCalcOverflowOut');
    if (!mount) return;

    const calcState = getCalcState();
    const finalResults = results || state.towerCalcLastResults;
    const shiftCounts = typeof PNS.getShiftCounts === 'function'
      ? PNS.getShiftCounts(state.players)
      : { shift1: 0, shift2: 0, both: 0 };
    const shiftLimits = typeof PNS.getTowerCalcShiftLimits === 'function'
      ? PNS.getTowerCalcShiftLimits()
      : { shift1: 90, shift2: 90 };

    const usedIds = new Set();
    const assignedIds = new Set();
    const playerStatuses = new Map();

    for (const shiftKey of activeShiftKeys()) {
      const plans = Array.isArray(finalResults?.[shiftKey]?.towerPlans) ? finalResults[shiftKey].towerPlans : [];
      plans.forEach(plan => {
        const captainId = String(plan?.captain?.id || '');
        if (captainId) {
          usedIds.add(captainId);
          assignedIds.add(captainId);
        }
        (plan?.pickedPlayers || []).forEach(player => {
          const playerId = String(player?.id || '');
          if (playerId) usedIds.add(playerId);
        });
        (plan?.notFitPlayers || []).forEach(player => {
          const playerId = String(player?.id || '');
          if (playerId) playerStatuses.set(playerId, {
            status: tr('not_fit', 'Не вліз'),
            sourceShift: shiftKey
          });
        });
        (plan?.partialPlayers || []).forEach(player => {
          const playerId = String(player?.id || '');
          if (playerId) playerStatuses.set(playerId, {
            status: `${tr('partial_short', 'частково')} ${formatNumber(player?.sent || 0)} / ${formatNumber(player?.full || 0)}`,
            sourceShift: shiftKey
          });
        });
      });
    }

    const buckets = Object.fromEntries([...activeShiftKeys(), 'both'].map(key => [key, []]));
    for (const player of Array.isArray(state.players) ? state.players : []) {
      if (!player || !player.id) continue;
      const playerId = String(player.id || '');
      if (assignedIds.has(playerId) || player.assignment?.baseId) continue;

      // Use the same effective shift that the top Shift cards use. After Custom merge,
      // Shift 3/4 can intentionally be assigned into Shift 2, so Player Status must not
      // re-read the original imported value and put those players back into Shift 3/4.
      const rawShift = (player.shift || player.shiftLabel || player.registeredShift || player.registeredShiftLabel || player.registeredShiftRaw || player.raw?.shift_availability || 'both');
      const shiftKey = String((typeof PNS.normalizeShiftValue === 'function'
        ? PNS.normalizeShiftValue(rawShift)
        : rawShift) || 'both').toLowerCase();
      if (!buckets[shiftKey] || (usedIds.has(playerId) && !playerStatuses.has(playerId))) continue;

      const status = playerStatuses.get(playerId) || {};
      buckets[shiftKey].push({
        playerId,
        name: String(player.name || '—'),
        alliance: String(player.alliance || ''),
        role: String(player.role || ''),
        tier: String(player.tier || ''),
        march: Number(player.march || 0) || 0,
        status: status.status || (shiftKey === 'both' && calcState.ignoreBoth
          ? tr('both_not_counted', 'Група «Всі» зараз не враховується')
          : tr('not_used', 'Не використано'))
      });
    }

    Object.keys(buckets).forEach(key => {
      buckets[key].sort((left, right) => Number(right.march || 0) - Number(left.march || 0)
        || String(left.name || '').localeCompare(String(right.name || '')));
    });

    const renderBucket = (shiftKey, title, rows, meta) => {
      const rowsHtml = rows.map(player => {
        const actionHtml = [...activeShiftKeys(), 'both'].map(target => {
          const disabled = target !== shiftKey && target !== 'both' && (shiftCounts[target] || 0) >= (shiftLimits[target] || shiftLimits.shift2 || 90) ? ' disabled' : '';
          return `<button class="btn btn-xs" data-calc-set-player-shift="${escapeHtml(player.playerId)}" data-target-shift="${escapeHtml(target)}" type="button"${disabled}>→ ${escapeHtml(shiftTitle(target))}</button>`;
        }).join('');
        return `<tr><td>${escapeHtml(player.name)}</td><td>${escapeHtml(player.alliance || '—')}</td><td>${escapeHtml(player.role || '—')}</td><td>${escapeHtml(player.tier || '')}</td><td>${formatNumber(player.march)}</td><td>${escapeHtml(player.status || '')}</td><td>${actionHtml}</td></tr>`;
      }).join('');

      return window.PNS.renderHtmlTemplate('tpl-tower-calc-reserve-panel', {
        title,
        meta,
        nickname_text: tr('nickname', 'Нік'),
        alliance_text: tr('alliance', 'Альянс'),
        role_text: tr('role', 'Роль'),
        tier_text: tr('tier', 'Тір'),
        march_text: tr('march', 'Марш'),
        status_text: tr('status', 'Статус'),
        actions_text: tr('actions', 'Дії'),
        rows_html: rowsHtml,
        rows_wrap_hidden_attr: rows.length ? '' : 'style="display:none"',
        empty_html: rows.length ? '' : window.PNS.renderHtmlTemplate('tpl-tower-calc-reserve-empty', {
          empty_text: tr('empty_short', 'Порожньо')
        })
      });
    };

    const activeKeys = activeShiftKeys();
    const summaryParts = activeKeys.map(key => `${shiftTitle(key)}: ${formatNumber(buckets[key]?.length || 0)}`);
    summaryParts.push(`${shiftTitle('both')}: ${formatNumber(buckets.both?.length || 0)}`);
    const panelsHtml = activeKeys.map(key => renderBucket(
      key,
      shiftTitle(key),
      buckets[key] || [],
      `${tr('players_short', 'гравців')}: ${formatNumber(shiftCounts[key] || 0)} / ${formatNumber(shiftLimits[key] || shiftLimits.shift2 || 90)}${(shiftCounts[key] || 0) > (shiftLimits[key] || shiftLimits.shift2 || 90) ? ` · ${tr('over_limit', 'понад ліміт')}: ${formatNumber((shiftCounts[key] || 0) - (shiftLimits[key] || shiftLimits.shift2 || 90))}` : ''}`
    )).join('');
    mount.innerHTML = `<div class="muted small"><strong>${escapeHtml(tr('reserve_and_outside', 'Резерв і гравці поза турелями'))}</strong> · ${escapeHtml(summaryParts.join(' · '))}</div>${panelsHtml}${renderBucket('both', shiftTitle('both'), buckets.both || [], `${tr('players_short', 'гравців')}: ${formatNumber(shiftCounts.both || 0)}${calcState.ignoreBoth ? ` · ${tr('both_ignored_in_shifts', 'зараз не враховуються в змінах 1 і 2')}` : ''}`)}<div class="muted small top-space">${escapeHtml(tr('shift_move_hint', 'Кнопки нижче одразу переводять гравця в потрібну зміну та запускають перерахунок.'))}</div>`;
  }

  function updateShiftStatsUI(modal) {
    const root = modal || document.getElementById('towerCalcModal');
    if (!root) return;

    const stats = collectShiftStats();
    const shiftLimits = typeof PNS.getTowerCalcShiftLimits === 'function'
      ? PNS.getTowerCalcShiftLimits()
      : { shift1: 90, shift2: 90 };

    const setText = (id, value) => {
      const node = root.querySelector(`#${id}`) || document.getElementById(id);
      if (node) node.textContent = String(value);
    };

    setText('tcShift1Count', stats.shift1.total);
    setText('tcShift2Count', stats.shift2.total);
    setText('tcBothCount', stats.both.total);
    setText('tcShift1Roles', `${tr('shooter_plural', 'Стрільці')} / ${tr('fighter_plural', 'Бійці')} / ${tr('rider_plural', 'Наїзники')}: ${stats.shift1.shooter} / ${stats.shift1.fighter} / ${stats.shift1.rider}`);
    setText('tcShift2Roles', `${tr('shooter_plural', 'Стрільці')} / ${tr('fighter_plural', 'Бійці')} / ${tr('rider_plural', 'Наїзники')}: ${stats.shift2.shooter} / ${stats.shift2.fighter} / ${stats.shift2.rider}`);
    setText('tcBothRoles', `${tr('shooter_plural', 'Стрільці')} / ${tr('fighter_plural', 'Бійці')} / ${tr('rider_plural', 'Наїзники')}: ${stats.both.shooter} / ${stats.both.fighter} / ${stats.both.rider}`);
    setText('tcTotalCount', stats.total);

    const cards = (root.querySelector('#towerCalcShiftBalance') || document.getElementById('towerCalcShiftBalance'))
      ?.querySelector('.tower-calc-shift-cards');
    if (cards) cards.style.display = 'none';

    const lines = [
      `${tr('shift1', 'Зміна 1')}: ${stats.shift1.total}/${shiftLimits.shift1} (${tr('shooter_plural', 'Стрільці')}/${tr('fighter_plural', 'Бійці')}/${tr('rider_plural', 'Наїзники')} ${stats.shift1.shooter}/${stats.shift1.fighter}/${stats.shift1.rider})`,
      `${tr('shift2', 'Зміна 2')}: ${stats.shift2.total}/${shiftLimits.shift2} (${tr('shooter_plural', 'Стрільці')}/${tr('fighter_plural', 'Бійці')}/${tr('rider_plural', 'Наїзники')} ${stats.shift2.shooter}/${stats.shift2.fighter}/${stats.shift2.rider})`,
      `${tr('both', 'Всі')}: ${stats.both.total} (${tr('shooter_plural', 'Стрільці')}/${tr('fighter_plural', 'Бійці')}/${tr('rider_plural', 'Наїзники')} ${stats.both.shooter}/${stats.both.fighter}/${stats.both.rider})`
    ];

    if (stats.shift1.total > shiftLimits.shift1) {
      lines.push(`⚠ ${tr('shift1', 'Зміна 1')} ${tr('over_limit', 'понад ліміт')} ${tr('by_word', 'на')} ${stats.shift1.total - shiftLimits.shift1}`);
    }
    if (stats.shift2.total > shiftLimits.shift2) {
      lines.push(`⚠ ${tr('shift2', 'Зміна 2')} ${tr('over_limit', 'понад ліміт')} ${tr('by_word', 'на')} ${stats.shift2.total - shiftLimits.shift2}`);
    }
    lines.push(`${tr('overall', 'Усього')}: ${stats.total}`);
    setText('towerCalcShiftCountsLine', lines.join(' · '));

    try {
      PNS.ensureTowerCalcShiftUi?.();
    } catch {}
  }

  Object.assign(PNS, {
    setOverflowReserve,
    collectShiftStats,
    renderOverflowReservePanel,
    updateShiftStatsUI
  });

  Object.assign(window, {
    calcSetOverflowReserveImpl: setOverflowReserve,
    calcCollectShiftStatsImpl: collectShiftStats,
    calcRenderOverflowReservePanelImpl: renderOverflowReservePanel,
    calcUpdateShiftStatsUIImpl: updateShiftStatsUI,
    calcSetOverflowReserve: setOverflowReserve,
    calcUpdateShiftStatsUI: updateShiftStatsUI
  });
})();
