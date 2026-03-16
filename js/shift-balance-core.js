/* ==== shift-balance-core.js ==== */
/* Shift balance core, restore, limits and move/apply helpers */
(function(){
  const e = window.PNS;
  if (!e) return;
  const { state: t } = e;

  function getShiftCounts(players){
    const list = Array.isArray(players) ? players : (Array.isArray(t.players) ? t.players : []);
    const counts = { shift1: 0, shift2: 0, both: 0, total: 0 };
    if (!list.length) return counts;
    for (const player of list) {
      const shift = e.normalizeShiftValue(player?.shift || player?.shiftLabel || 'both');
      if (shift === 'shift1') counts.shift1++;
      else if (shift === 'shift2') counts.shift2++;
      else counts.both++;
    }
    counts.total = counts.shift1 + counts.shift2 + counts.both;
    return counts;
  }

  function setPlayerShift(player, shiftValue){
    const normalized = e.normalizeShiftValue(shiftValue);
    player.shift = normalized;
    player.shiftLabel = e.formatShiftLabelForCell(normalized);
    if (player.rowEl) {
      player.rowEl.dataset.shift = normalized;
      const cell = player.rowEl.querySelector('td[data-field="shiftLabel"]');
      if (cell) cell.textContent = player.shiftLabel;
    }
  }

  function autoBalanceTwoShifts(players, options = {}){
    const list = Array.isArray(players) ? players : (Array.isArray(t.players) ? t.players : []);
    if (!list.length) return { shift1: 0, shift2: 0 };

    const mode = options.mode === 'force' ? 'force' : 'respect';
    const total = list.length;
    const maxShift1 = Number.isFinite(options.maxShift1) ? Math.max(0, Math.floor(options.maxShift1)) : Math.ceil(total / 2);
    const maxShift2 = Number.isFinite(options.maxShift2) ? Math.max(0, Math.floor(options.maxShift2)) : total - maxShift1;

    list.forEach(player => {
      player.shift = e.normalizeShiftValue(player.shift || player.shiftLabel || 'both');
    });

    if (mode === 'force') {
      list.forEach(player => {
        player.shift = 'both';
        player.shiftLabel = e.formatShiftLabelForCell('both');
        if (player.rowEl) player.rowEl.dataset.shift = 'both';
      });
    }

    let shift1 = list.filter(player => player.shift === 'shift1').length;
    let shift2 = list.filter(player => player.shift === 'shift2').length;
    const movable = mode === 'force' ? list.slice() : list.filter(player => !player.shift || player.shift === 'both');
    const roleOrder = { Fighter: 0, Rider: 1, Shooter: 2, Unknown: 3 };

    movable.sort((left, right) => {
      const leftRole = roleOrder[e.normalizeRole(left.role)] ?? 99;
      const rightRole = roleOrder[e.normalizeRole(right.role)] ?? 99;
      if (leftRole !== rightRole) return leftRole - rightRole;
      const leftMarch = Number(left.march || 0);
      const rightMarch = Number(right.march || 0);
      if (leftMarch !== rightMarch) return rightMarch - leftMarch;
      return String(left.name || '').localeCompare(String(right.name || ''));
    });

    for (const player of movable) {
      if (mode !== 'force' && (player.shift === 'shift1' || player.shift === 'shift2')) continue;
      const target = (shift1 >= maxShift1) ? 'shift2' : ((shift2 >= maxShift2 || shift1 <= shift2) ? 'shift1' : 'shift2');
      setPlayerShift(player, target);
      if (target === 'shift1') shift1++;
      else shift2++;
    }

    return { shift1, shift2 };
  }

  function getShiftLimits(){
    const towerCalc = (t.towerCalc && typeof t.towerCalc === 'object') ? t.towerCalc : (t.towerCalc = {});
    const current1 = towerCalc.shiftPlayerLimit1;
    const current2 = towerCalc.shiftPlayerLimit2;
    const input1 = document.getElementById('shiftLimitS1');
    const input2 = document.getElementById('shiftLimitS2');

    const normalize = (value, fallback = 100) => {
      const int = Math.floor(Number(value));
      return Number.isFinite(int) ? Math.max(0, Math.min(100, int)) : fallback;
    };

    const shift1 = normalize(input1?.value ?? current1, 100);
    const shift2 = normalize(input2?.value ?? current2, 100);
    towerCalc.shiftPlayerLimit1 = shift1;
    towerCalc.shiftPlayerLimit2 = shift2;
    return { shift1, shift2 };
  }

  function syncShiftLimitUi(){
    const limits = getShiftLimits();
    const input1 = document.getElementById('shiftLimitS1');
    const input2 = document.getElementById('shiftLimitS2');
    if (input1) input1.value = String(limits.shift1);
    if (input2) input2.value = String(limits.shift2);
    return limits;
  }

  function updateShiftBreakdownUI(){
    const counts = getShiftCounts(t.players);
    const limits = syncShiftLimitUi();

    const addShift1 = document.getElementById('shiftAddS1');
    const addShift2 = document.getElementById('shiftAddS2');
    if (addShift1 && !addShift1.placeholder) addShift1.placeholder = '+ до зміни 1';
    if (addShift2 && !addShift2.placeholder) addShift2.placeholder = '+ до зміни 2';

    const limitInput1 = document.getElementById('shiftLimitS1');
    const limitInput2 = document.getElementById('shiftLimitS2');
    if (limitInput1) {
      limitInput1.min = '0';
      limitInput1.max = '100';
      limitInput1.title = 'Максимум 100 гравців у зміні 1';
    }
    if (limitInput2) {
      limitInput2.min = '0';
      limitInput2.max = '100';
      limitInput2.title = 'Максимум 100 гравців у зміні 2';
    }

    const note = document.getElementById('towerCalcShiftLimitNote');
    if (note) {
      const warnings = [];
      if (counts.shift1 > limits.shift1) warnings.push('Зміна 1 переповнена на ' + (counts.shift1 - limits.shift1));
      if (counts.shift2 > limits.shift2) warnings.push('Зміна 2 переповнена на ' + (counts.shift2 - limits.shift2));
      note.textContent = warnings.length ? warnings.join(' · ') : `Ліміти змін: Зміна 1 — ${limits.shift1}, Зміна 2 — ${limits.shift2} (макс. 100).`;
    }
  }

  function refreshShiftUi(){
    try { syncShiftLimitUi(); } catch {}
    try { updateShiftBreakdownUI(); } catch {}
    const modal = document.getElementById('towerCalcModal');
    try { window.calcUpdateShiftStatsUI?.(modal); } catch {}
    try { window.computeTowerCalcResults?.(); } catch {}
  }

  function getRegisteredShiftCounts(players){
    const list = Array.isArray(players) ? players : (Array.isArray(t.players) ? t.players : []);
    const counts = { shift1: 0, shift2: 0, both: 0, unknown: 0, total: 0 };
    if (!list.length) return counts;
    for (const player of list) {
      const shift = e.getRegisteredShiftForPlayer(player);
      if (shift === 'shift1') counts.shift1++;
      else if (shift === 'shift2') counts.shift2++;
      else if (shift === 'both') counts.both++;
      else counts.unknown++;
    }
    counts.total = counts.shift1 + counts.shift2 + counts.both + counts.unknown;
    return counts;
  }

  function restorePlayerShiftsFromImport(players){
    const list = Array.isArray(players) ? players : (Array.isArray(t.players) ? t.players : []);
    if (!list.length) return { shift1: 0, shift2: 0, both: 0, unknown: 0, total: 0 };
    list.forEach(player => {
      const shift = e.getRegisteredShiftForPlayer(player);
      setPlayerShift(player, (shift === 'shift1' || shift === 'shift2' || shift === 'both') ? shift : 'both');
    });
    return getRegisteredShiftCounts(list);
  }

  function addPlayersToShifts(players, options = {}){
    const list = Array.isArray(players) ? players : (Array.isArray(t.players) ? t.players : []);
    if (!list.length) return { added1: 0, added2: 0, counts: getShiftCounts(list) };

    const force = !!options.force;
    let shift1Add = Math.max(0, Math.floor(Number(options.shift1Add || 0)));
    let shift2Add = Math.max(0, Math.floor(Number(options.shift2Add || 0)));
    const limits = { shift1: Math.max(0, Math.min(100, Math.floor(Number(options.maxShift1 ?? getShiftLimits().shift1)))), shift2: Math.max(0, Math.min(100, Math.floor(Number(options.maxShift2 ?? getShiftLimits().shift2)))) };

    list.forEach(player => { player.shift = e.normalizeShiftValue(player.shift || player.shiftLabel || 'both'); });
    if (force) list.forEach(player => setPlayerShift(player, 'both'));

    const counts = getShiftCounts(list);
    let current1 = counts.shift1;
    let current2 = counts.shift2;
    const bothPlayers = list.filter(player => e.normalizeShiftValue(player.shift || 'both') === 'both');
    const roleOrder = { Fighter: 0, Rider: 1, Shooter: 2, Unknown: 3 };
    bothPlayers.sort((left, right) => {
      const leftRole = roleOrder[e.normalizeRole(left.role)] ?? 99;
      const rightRole = roleOrder[e.normalizeRole(right.role)] ?? 99;
      if (leftRole !== rightRole) return leftRole - rightRole;
      const leftMarch = Number(left.march || 0);
      const rightMarch = Number(right.march || 0);
      if (leftMarch !== rightMarch) return rightMarch - leftMarch;
      return String(left.name || '').localeCompare(String(right.name || ''));
    });

    let added1 = 0;
    let added2 = 0;
    let index = 0;
    while (index < bothPlayers.length && (shift1Add > 0 || shift2Add > 0)) {
      const canShift1 = shift1Add > 0 && current1 < limits.shift1;
      const canShift2 = shift2Add > 0 && current2 < limits.shift2;
      if (!canShift1 && !canShift2) break;
      const target = canShift1 && (!canShift2 || shift1Add >= shift2Add) ? 'shift1' : 'shift2';
      setPlayerShift(bothPlayers[index++], target);
      if (target === 'shift1') {
        shift1Add--; added1++; current1++;
      } else {
        shift2Add--; added2++; current2++;
      }
    }

    return { added1, added2, counts: getShiftCounts(list), limits, remaining: { shift1: shift1Add, shift2: shift2Add } };
  }

  function movePlayerToShiftWithLimits(playerOrId, targetShift){
    const normalizedTarget = e.normalizeShiftValue(targetShift);
    const player = (typeof playerOrId === 'object' && playerOrId) ? playerOrId : t.playerById?.get?.(String(playerOrId || ''));
    if (!player) return { ok: false, reason: 'not-found' };

    const currentShift = e.normalizeShiftValue(player.shift || player.shiftLabel || 'both');
    if (currentShift === normalizedTarget) return { ok: true, reason: 'same' };

    const limits = getShiftLimits();
    const counts = getShiftCounts(t.players);
    if (normalizedTarget === 'shift1' && currentShift !== 'shift1' && counts.shift1 >= limits.shift1) {
      return { ok: false, reason: 'limit-shift1', counts, limits };
    }
    if (normalizedTarget === 'shift2' && currentShift !== 'shift2' && counts.shift2 >= limits.shift2) {
      return { ok: false, reason: 'limit-shift2', counts, limits };
    }

    setPlayerShift(player, normalizedTarget);
    return { ok: true, reason: 'moved', counts: getShiftCounts(t.players), limits };
  }

  e.autoBalanceTwoShifts = autoBalanceTwoShifts;
  e.getShiftCounts = getShiftCounts;
  e.restorePlayerShiftsFromImport = restorePlayerShiftsFromImport;
  e.updateShiftBreakdownUI = updateShiftBreakdownUI;
  e.addPlayersToShifts = addPlayersToShifts;
  e.setPlayerShift = setPlayerShift;
  e.movePlayerToShiftWithLimits = movePlayerToShiftWithLimits;
  e.getTowerCalcShiftLimits = getShiftLimits;
  e.syncTowerCalcShiftLimitUi = syncShiftLimitUi;
  e.getRegisteredShiftCounts = getRegisteredShiftCounts;
  e.refreshShiftUi = refreshShiftUi;
})();
