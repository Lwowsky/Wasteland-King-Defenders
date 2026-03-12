(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state } = PNS;
  const t = (key, fallback = '') => (typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback);
  const roleLabel = (value, plural = false) => (typeof PNS.roleLabel === 'function' ? PNS.roleLabel(value, plural) : String(value || ''));
  const shiftLabel = (value) => (typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(value) : String(value || ''));
  const baseName = (base) => String(base?.title || t('turret', 'Турель')).split('/')[0].trim() || t('turret', 'Турель');

  function num(x) { return Number.isFinite(+x) ? +x : 0; }
  function uniqPush(arr, id) { if (!arr.includes(id)) arr.push(id); }

  function enforceSameTroopRole() {
    try {
      if (typeof PNS.isTowerNoMixTroopsEnabled === 'function') return !!PNS.isTowerNoMixTroopsEnabled();
    } catch {}
    return true;
  }

  function matchRegisteredShiftEnabled() {
    try {
      if (typeof PNS.isTowerMatchRegisteredShiftEnabled === 'function') return !!PNS.isTowerMatchRegisteredShiftEnabled();
    } catch {}
    return true;
  }

  function useBothEnabled() {
    return state.towerPickerNoCrossShiftDupes === true;
  }

  function resolveTowerShift(base) {
    const baseShift = String(base?.shift || '').toLowerCase();
    if (baseShift === 'shift1' || baseShift === 'shift2') return baseShift;
    const activeShift = String(state.activeShift || '').toLowerCase();
    if (activeShift === 'shift1' || activeShift === 'shift2') return activeShift;
    return 'shift1';
  }

  function getBaseTierMinMarch(base, tierKey) {
    const k = String(tierKey || '').toUpperCase();
    return PNS.clampInt(base?.tierMinMarch?.[k], 0);
  }

  // NOTE: tierMinMarch values are treated as MAX allowed contribution for that tier in tower.
  // 0 = no cap (full march contributes)
  function getTowerEffectiveMarch(base, player) {
    if (!player) return 0;
    const raw = num(player.march);
    // Captain always uses raw march in tower calculations.
    try {
      if (base?.captainId && player?.id && String(base.captainId) === String(player.id)) return raw;
    } catch {}
    // Manual override is scoped per tower + current shift.
    try {
      const ov = PNS.getTowerMarchOverride?.(base?.id, player?.id, state.activeShift);
      if (Number.isFinite(ov) && ov > 0) return ov;
    } catch {}
    const cap = getBaseTierMinMarch(base, player.tier);
    return cap > 0 ? Math.min(raw, cap) : raw;
  }

  function passesBaseTierMinMarch(base, player) {
    // Backward-compatible function name. We no longer filter out by tier threshold here.
    return !!player;
  }

  function calcRallyLimit(captain) {
    // в тебе місцями rally + march, місцями rally || march
    // залишаю як було у тебе (плюс/плюс, або fallback)
    return (num(captain?.rally) + num(captain?.march)) || num(captain?.march) || 0;
  }

  function helpersSumMarch(base) {
    const ids = Array.isArray(base?.helperIds) ? base.helperIds : [];
    let s = 0;
    for (const id of ids) s += getTowerEffectiveMarch(base, state.playerById.get(id));
    return s;
  }

  function autoFillDiagnostics(base, captain) {
    const enforceShift = matchRegisteredShiftEnabled();
    const targetShift = resolveTowerShift(base);
    const free = (state.players || []).filter((p) => !p.assignment && p.id !== captain.id);
    const sameRoleRequired = enforceSameTroopRole();
    const sameRole = sameRoleRequired ? free.filter((p) => p.role === captain.role) : free.slice();

    const byActiveShift = enforceShift
      ? sameRole.filter((p) => PNS.matchesShift(p.shift, targetShift))
      : sameRole.slice();
    const byBaseShift = enforceShift
      ? byActiveShift.filter((p) => base.shift === 'both' || p.shift === 'both' || p.shift === base.shift)
      : byActiveShift.slice();
    const passTierMin = byBaseShift.filter((p) => passesBaseTierMinMarch(base, p));

    const limit = calcRallyLimit(captain);
    const usedHelpers = helpersSumMarch(base);
    const room = limit ? Math.max(0, limit - num(captain.march) - usedHelpers) : Infinity;

    const fitRoom = room === Infinity
      ? passTierMin.length
      : passTierMin.filter((p) => num(p.march) <= room).length;

    return {
      free: free.length,
      sameRole: sameRole.length,
      byActiveShift: byActiveShift.length,
      byBaseShift: byBaseShift.length,
      passTierMin: passTierMin.length,
      fitRoom,
      room
    };
  }

  function autoFillBase(baseId) {
    const base = state.baseById?.get?.(baseId);
    if (!base) return { added: 0, reason: t('turret_not_found', 'Турель не знайдена') };

    // нормалізуємо структуру
    if (!Array.isArray(base.helperIds)) base.helperIds = [];
    // прибираємо дублікати (важливо після повторних автозаповнень)
    base.helperIds = Array.from(new Set(base.helperIds));

    // maxHelpers дефолт
    const defaultMax = num(state.autoFillSettings?.maxHelpers) || 29;
    base.maxHelpers = num(base.maxHelpers) || defaultMax;

    if (!base.captainId) {
      const msg = `${t('choose_captain_for_turret', 'Спочатку обери капітана для')} ${baseName(base)}`;
      alert(msg);
      return { added: 0, reason: msg };
    }

    const captain = state.playerById?.get?.(base.captainId);
    if (!captain) return { added: 0, reason: t('captain_not_found', 'Капітана не знайдено') };

    // підтягуємо rule з UI (якщо існує)
    try {
      if (typeof PNS.setBaseTowerRule === 'function' && typeof PNS.readBaseEditorSettingsInputs === 'function') {
        PNS.setBaseTowerRule(base.id, PNS.readBaseEditorSettingsInputs(base), { persist: true, rerender: false });
      }
    } catch {}

    // UI role
    if (typeof PNS.applyBaseRoleUI === 'function') PNS.applyBaseRoleUI(base, captain.role);

    const beforeCount = base.helperIds.length;

    const limit = calcRallyLimit(captain);
    let room = limit
      ? Math.max(0, limit - num(captain.march) - helpersSumMarch(base))
      : Infinity;

    const ignoreShift = !!document.querySelector('#ignoreShiftAutoFillToggle:checked');
    const enforceShift = matchRegisteredShiftEnabled();
    const targetShift = resolveTowerShift(base);

const commonCandidates = () => (state.players || [])
  .filter((p) => p && p.id !== captain.id)
  .filter((p) => !p.assignment)
  .filter((p) => enforceSameTroopRole() ? (p.role === captain.role) : true)
  .filter((p) => {
    const useBoth = useBothEnabled();
    const ps = String(p.shift || p.shiftLabel || '').trim().toLowerCase();
    return useBoth ? true : ps !== 'both';
  })
  .filter((p) => (ignoreShift || !enforceShift) ? true : PNS.matchesShift(p.shift, targetShift))
  .filter((p) => (ignoreShift || !enforceShift) ? true : (base.shift === 'both' || p.shift === 'both' || p.shift === base.shift))
  .filter((p) => passesBaseTierMinMarch(base, p))
  .sort((a, b) =>
    (num(b.tierRank) - num(a.tierRank)) ||
    (num(b.march) - num(a.march)) ||
    String(a.name).localeCompare(String(b.name))
  );

    // важливо: validateAssign може бути ще не підвантажений
    const canValidate = typeof PNS.validateAssign === 'function';

    for (const p of commonCandidates()) {
      if (base.maxHelpers > 0 && base.helperIds.length >= base.maxHelpers) break;

      const pm = getTowerEffectiveMarch(base, p);
      if (room !== Infinity && pm > room) continue;

      if (canValidate) {
        const err = PNS.validateAssign(p, base, 'helper');
        if (err) continue;
      }

      uniqPush(base.helperIds, p.id);
      p.assignment = { baseId: base.id, kind: 'helper' };
      if (room !== Infinity) room -= pm;
    }

    if (typeof PNS.renderAll === 'function') PNS.renderAll();

    const added = base.helperIds.length - beforeCount;
    if (added <= 0) {
      let reason = '';
      const d = autoFillDiagnostics(base, captain);
      if (!d.sameRole && enforceSameTroopRole()) reason = `${t('no_free_players_of_role', 'Немає вільних гравців типу')} ${roleLabel(captain.role)}.`;
      else if (!ignoreShift && matchRegisteredShiftEnabled() && !d.byActiveShift) reason = `${t('no_role_for_shift', 'Немає гравців цього типу для зміни')} ${shiftLabel(resolveTowerShift(base))}.`;
      else if (!ignoreShift && matchRegisteredShiftEnabled() && !d.byBaseShift) reason = `${t('no_role_for_turret_shift', 'Немає гравців цього типу, які підходять під зміну цієї турелі')}.`;
      else if (!d.passTierMin) reason = t('no_players_for_tier_limits', 'Немає гравців, які підходять під ліміти маршу за тірами.');
      else if ((base.maxHelpers || 0) > 0 && base.helperIds.length >= base.maxHelpers) reason = `${t('helpers_limit_full_simple', 'Ліміт помічників заповнений')} (${base.maxHelpers}).`;
      else if (room !== Infinity && d.fitRoom === 0) reason = `${t('no_one_fits_rally_room', 'Ніхто не вміщується в залишок ралі')} (${PNS.formatNum?.(Math.max(0, d.room)) ?? Math.max(0, d.room)}).`;
      else reason = t('no_players_after_checks', 'Після перевірок не знайшлося відповідних гравців.');

      const debug = ` [free:${d.free}, role:${d.sameRole}, shift:${d.byActiveShift}, tower:${d.byBaseShift}, tierMin:${d.passTierMin}, fit:${d.fitRoom}]`;

      if (typeof PNS.setImportStatus === 'function') {
        PNS.setImportStatus(`${t('auto_fill', 'Автозаповнення')}: ${baseName(base)} → ${t('autofill_added_zero', 'додано 0')}. ${reason}${debug}`, 'danger');
      }
      return { added: 0, reason };
    }

    if (typeof PNS.setImportStatus === 'function') {
      PNS.setImportStatus(`${t('auto_fill', 'Автозаповнення')}: ${baseName(base)} → +${added} ${t('helpers_short', 'помічники')}.`, 'good');
    }
    return { added };
  }

  function autoFillAllVisibleBases() {
    let totalAdded = 0;
    let touched = 0;

    const visibleBases = (state.bases || []).filter((b) => PNS.matchesShift(b.shift, state.activeShift));

    visibleBases.forEach((b) => {
      if (b?.captainId) {
        touched++;
        const res = autoFillBase(b.id) || {};
        totalAdded += num(res.added);
      }
    });

    if (!touched) {
      const visible = visibleBases.length;
      if (typeof PNS.setImportStatus === 'function') {
        PNS.setImportStatus(
          `${t('auto_fill_all', 'Автозаповнити все')}: ${t('autofill_all_no_visible_captains', 'немає видимих турелей із капітаном')} (${t('shown_count', 'Показано').toLowerCase()}: ${visible}). ${t('choose_captain_first', 'Оберіть капітана')}.`,
          'danger'
        );
      }
      return;
    }

    if (typeof PNS.setImportStatus === 'function') {
      PNS.setImportStatus(
        `${t('auto_fill', 'Автозаповнення')}: +${totalAdded} ${t('helpers_short', 'помічники')} ${t('autofill_in_turrets', 'у турелях')}: ${touched}.`,
        totalAdded ? 'good' : 'danger'
      );
    }
  }

  PNS.getBaseTierMinMarch = getBaseTierMinMarch;
  PNS.getTowerEffectiveMarch = getTowerEffectiveMarch;
  PNS.getEffectiveTowerMarch = getTowerEffectiveMarch;
  PNS.passesBaseTierMinMarch = passesBaseTierMinMarch;

  PNS.autoFillDiagnostics = autoFillDiagnostics;
  PNS.autoFillBase = autoFillBase;
  PNS.autoFillAllVisibleBases = autoFillAllVisibleBases;

})();