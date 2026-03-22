(function(){
  const PNS = window.PNS = window.PNS || {};
  const state = PNS.state = PNS.state || {};
  const t = (key, fallback='') => typeof PNS.t === 'function' ? PNS.t(key, fallback) : fallback;
  const DUPLICATE_SHIFT_KEYS = ['shift1', 'shift2'];
  const REGISTRATION_KEY_RE = /(отметк.*врем|timestamp|time\s*stamp|registration|registered(?:\s*at)?|created\s*at|дата.*реє|час.*реє|дата.*рег|время.*рег|відмітк.*час|отметка времени)/i;

  function normalizeShift(shift) {
    const raw = String(shift || '').toLowerCase().trim();
    if (raw === 'shift1' || /зміна\s*1|смена\s*1|shift\s*1|1st/i.test(raw)) return 'shift1';
    if (raw === 'shift2' || /зміна\s*2|смена\s*2|shift\s*2|2nd/i.test(raw)) return 'shift2';
    if (raw === 'both' || /обидві|обе|both/i.test(raw)) return 'both';
    return raw || 'both';
  }

  function normalizeNick(name) {
    let value = String(name || '').trim();
    if (!value) return '';
    try { value = value.normalize('NFKC'); } catch {}
    value = value.replace(/[\u200B-\u200D\uFEFF]/g, '');
    value = value.replace(/\s+/g, ' ').trim().toLowerCase();
    return value;
  }

  function effectiveShifts(player) {
    const shift = normalizeShift(player?.shift || player?.shiftLabel || player?.registeredShift || 'both');
    return shift === 'both' ? ['shift1', 'shift2'] : (shift ? [shift] : []);
  }

  function buildDuplicateIndex(players = state.players || []) {
    const shifts = { shift1: new Map(), shift2: new Map() };
    const duplicates = { shift1: new Map(), shift2: new Map() };
    (Array.isArray(players) ? players : []).forEach(player => {
      const key = normalizeNick(player?.name || '');
      if (!key) return;
      effectiveShifts(player).forEach(shift => {
        if (!shifts[shift]) return;
        const bucket = shifts[shift].get(key) || [];
        bucket.push(player);
        shifts[shift].set(key, bucket);
      });
    });
    Object.keys(shifts).forEach(shift => {
      shifts[shift].forEach((bucket, key) => {
        if ((bucket?.length || 0) > 1) duplicates[shift].set(key, bucket.slice());
      });
    });
    return { shifts, duplicates };
  }

  function getDuplicateNickBucket(nameOrKey, shift = '') {
    const key = normalizeNick(nameOrKey || '');
    const shiftKey = normalizeShift(shift || '');
    if (!key) return [];
    const index = buildDuplicateIndex();
    if (shiftKey === 'shift1' || shiftKey === 'shift2') {
      return (index.duplicates[shiftKey]?.get(key) || []).slice();
    }
    return Array.from(new Map(
      DUPLICATE_SHIFT_KEYS.flatMap(item => (index.duplicates[item]?.get(key) || []).map(player => [String(player?.id || ''), player]))
    ).values());
  }

  function getPlayerDuplicateShifts(player, duplicateIndex = null) {
    const key = normalizeNick(player?.name || '');
    if (!key) return [];
    const index = duplicateIndex || buildDuplicateIndex();
    return DUPLICATE_SHIFT_KEYS.filter(shift => (index.duplicates[shift]?.get(key)?.length || 0) > 1);
  }

  function resolveAssignmentShift(base, player) {
    const resolved = normalizeShift(
      (typeof PNS.getBaseShift === 'function' ? PNS.getBaseShift(base) : '')
      || base?.shift
      || player?.assignment?.shift
      || player?.shift
      || player?.shiftLabel
      || state.activeShift
      || ''
    );
    return resolved === 'both' ? normalizeShift(state.activeShift || '') : resolved;
  }

  function getAssignedDuplicateHit(player, targetShift, excludePlayerId) {
    const key = normalizeNick(player?.name || '');
    const shift = normalizeShift(targetShift || state.activeShift || '');
    if (!key || (shift !== 'shift1' && shift !== 'shift2')) return null;
    const players = Array.isArray(state.players) ? state.players : [];
    for (const other of players) {
      if (!other || String(other.id || '') === String(excludePlayerId || player?.id || '')) continue;
      if (!other.assignment?.baseId) continue;
      if (normalizeNick(other.name || '') !== key) continue;
      const base = state.baseById?.get?.(other.assignment.baseId);
      const assignedShift = resolveAssignmentShift(base, other);
      if (assignedShift !== shift) continue;
      return {
        player: other,
        baseId: other.assignment.baseId,
        baseTitle: String(base?.title || other.assignment.baseId || ''),
        kind: String(other.assignment.kind || 'helper')
      };
    }
    return null;
  }

  function escapeHtml(value) {
    return typeof PNS.escapeHtml === 'function'
      ? PNS.escapeHtml(String(value ?? ''))
      : String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch] || ch));
  }

  function duplicateShiftLabel(shift) {
    return shift === 'shift1'
      ? t('shift1', 'Зміна 1')
      : shift === 'shift2'
        ? t('shift2', 'Зміна 2')
        : String(shift || '');
  }

  function getRegistrationValue(player) {
    if (!player || typeof player !== 'object') return '';
    const direct = player.registeredAt || player.registered_at || player.createdAt || player.created_at || '';
    if (direct) return direct;
    const raw = player.raw;
    if (raw && typeof raw === 'object') {
      for (const [key, value] of Object.entries(raw)) {
        if (REGISTRATION_KEY_RE.test(String(key || '')) && value != null && String(value).trim()) {
          return value;
        }
      }
    }
    return '';
  }

  function formatRegistrationValue(value) {
    if (!value && value !== 0) return t('duplicate_unknown_time', 'Невідомо');
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(value);
    }
    if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 100000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
      }
    }
    const str = String(value || '').trim();
    if (!str) return t('duplicate_unknown_time', 'Невідомо');
    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime()) && /\d/.test(str)) {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
    }
    return str;
  }

  function getPlayerRegistrationInfo(player) {
    const raw = getRegistrationValue(player);
    return { raw, formatted: formatRegistrationValue(raw) };
  }

  function getPlayerPlacementLabel(player) {
    if (!player?.assignment?.baseId) return t('reserve', 'Резерв');
    const base = state.baseById?.get?.(player.assignment.baseId);
    const title = String(base?.title || player.assignment.baseId || '').split('/')[0].trim() || String(player.assignment.baseId || '');
    const roleLabel = String(player.assignment.kind || '') === 'captain' ? t('captain', 'Капітан') : t('helper', 'Помічник');
    return `${title} · ${roleLabel}`;
  }

  function ensureDuplicateBanner() {
    const panel = document.querySelector('.players-panel');
    const statsGrid = panel?.querySelector('.stats-grid--players');
    if (!panel || !statsGrid) return null;
    let banner = panel.querySelector('#playersDuplicateBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'playersDuplicateBanner';
      banner.className = 'players-duplicate-banner';
      statsGrid.insertAdjacentElement('afterend', banner);
    }
    return banner;
  }

  function syncShiftPlansAfterPlayerRemoval(playerId) {
    const id = String(playerId || '');
    if (!id) return;
    try { state.shiftPlans = state.shiftPlans || {}; } catch {}
    DUPLICATE_SHIFT_KEYS.forEach(shiftKey => {
      const snapshot = state.shiftPlans?.[shiftKey];
      if (!snapshot || typeof snapshot !== 'object') return;
      if (snapshot.players && typeof snapshot.players === 'object') delete snapshot.players[id];
      if (snapshot.bases && typeof snapshot.bases === 'object') {
        Object.values(snapshot.bases).forEach(base => {
          if (!base || typeof base !== 'object') return;
          if (String(base.captainId || '') === id) base.captainId = null;
          if (Array.isArray(base.helperIds)) base.helperIds = base.helperIds.filter(helperId => String(helperId || '') !== id);
        });
      }
    });
    try {
      localStorage.setItem('pns_layout_shift_plans_store_v1', JSON.stringify({
        shift1: state.shiftPlans?.shift1 || null,
        shift2: state.shiftPlans?.shift2 || null,
      }));
    } catch {}
  }

  function deletePlayersByIds(playerIds = []) {
    const ids = Array.from(new Set((Array.isArray(playerIds) ? playerIds : [playerIds]).map(id => String(id || '')).filter(Boolean)));
    if (!ids.length) return 0;
    ids.forEach(id => {
      const player = state.playerById?.get?.(id);
      if (!player) return;
      try { PNS.clearPlayerFromBase?.(id); } catch {}
      syncShiftPlansAfterPlayerRemoval(id);
      try { state.playerById?.delete?.(id); } catch {}
    });
    try { state.players = (Array.isArray(state.players) ? state.players : []).filter(player => !ids.includes(String(player?.id || ''))); } catch {}
    try { PNS.savePlayersSnapshot?.(state.players); } catch {}
    try { PNS.saveTowersSnapshot?.(); } catch {}
    try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
    try { PNS.persistSessionStateSoon?.(10); } catch {}
    try { PNS.renderPlayersTableFromState?.(); } catch {}
    try { PNS.renderAll?.(); } catch {}
    try { PNS.schedulePlayerTableRecalc?.(); } catch {}
    try { document.dispatchEvent(new CustomEvent('pns:assignment-changed', { detail: { type: 'delete-duplicate-players', playerIds: ids } })); } catch {}
    return ids.length;
  }

  function removeDuplicatePlayersKeepOne(keepId, nameOrKey, shift = '') {
    const keep = String(keepId || '');
    const players = getDuplicateNickBucket(nameOrKey, shift);
    const idsToDelete = players.map(player => String(player?.id || '')).filter(id => id && id !== keep);
    return deletePlayersByIds(idsToDelete);
  }

  function applyDuplicateUiCore() {
    const index = buildDuplicateIndex();
    const rows = Array.from(document.querySelectorAll('#playersDataTable tbody tr'));
    const duplicateNameSet = new Set();

    rows.forEach(row => {
      const playerId = String(row.dataset.playerId || '');
      const player = state.playerById?.get?.(playerId) || (state.players || []).find(item => String(item?.id || '') === playerId);
      const nameCell = row.querySelector('td[data-field="name"]') || row.children[0];
      if (!player || !nameCell) return;

      nameCell.querySelectorAll('.duplicate-nick-badge').forEach(node => node.remove());
      row.classList.remove('is-duplicate-nick');
      row.removeAttribute('data-duplicate-shifts');
      row.removeAttribute('title');
      nameCell.classList.remove('is-duplicate-clickable');
      delete nameCell.dataset.duplicateNick;
      delete nameCell.dataset.duplicateShift;

      const dupShifts = getPlayerDuplicateShifts(player, index);
      if (!dupShifts.length) return;

      const nickKey = normalizeNick(player.name || '');
      duplicateNameSet.add(nickKey);
      row.classList.add('is-duplicate-nick');
      row.dataset.duplicateShifts = dupShifts.join(',');
      nameCell.classList.add('is-duplicate-clickable');
      nameCell.dataset.duplicateNick = nickKey;
      nameCell.dataset.duplicateShift = dupShifts[0] || '';
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'duplicate-nick-badge';
      badge.textContent = t('duplicate_nick_badge', 'дубль');
      badge.setAttribute('aria-label', t('duplicate_nick_badge', 'дубль'));
      badge.dataset.duplicateNick = nickKey;
      badge.dataset.duplicateShift = dupShifts[0] || '';
      nameCell.appendChild(badge);
      const label = dupShifts.map(duplicateShiftLabel).join(' / ');
      row.title = `${t('duplicate_nick_title', 'Нік повторюється')}: ${label}`;
    });

    const banner = ensureDuplicateBanner();
    if (!banner) return;
    const dupEntries = [];
    DUPLICATE_SHIFT_KEYS.forEach(shift => {
      index.duplicates[shift].forEach((bucket, key) => {
        if (!bucket?.length) return;
        dupEntries.push({ shift, key, name: String(bucket[0]?.name || ''), count: bucket.length });
      });
    });

    if (!dupEntries.length) {
      banner.hidden = true;
      banner.innerHTML = '';
      return;
    }

    const seenSummaryKeys = new Set();
    const summary = dupEntries
      .filter(item => {
        const summaryKey = `${item.key}::${item.shift}`;
        if (seenSummaryKeys.has(summaryKey)) return false;
        seenSummaryKeys.add(summaryKey);
        return true;
      })
      .sort((a, b) => a.shift.localeCompare(b.shift) || a.name.localeCompare(b.name))
      .slice(0, 24)
      .map(item => `
        <button type="button" class="players-duplicate-chip" data-duplicate-open="1" data-duplicate-nick="${escapeHtml(item.key)}" data-duplicate-shift="${escapeHtml(item.shift)}">
          ${escapeHtml(item.name)} · ${escapeHtml(duplicateShiftLabel(item.shift))} · ${item.count}×
        </button>
      `)
      .join('');

    banner.hidden = false;
    banner.innerHTML = `
      <div class="players-duplicate-banner__title">${escapeHtml(t('duplicate_nicks_found', 'Знайдено повторювані ніки'))}: ${duplicateNameSet.size}</div>
      <div class="players-duplicate-banner__text">${escapeHtml(t('duplicate_nicks_hint', 'Такі гравці підсвічені в таблиці. У межах однієї зміни сайт більше не дає призначити однаковий нік двічі.'))}</div>
      <div class="players-duplicate-banner__list">${summary}</div>
    `;
  }

  PNS.normalizeDuplicateNick = normalizeNick;
  PNS.getDuplicateNicknameIndex = buildDuplicateIndex;
  PNS.getDuplicateNickBucket = getDuplicateNickBucket;
  PNS.getPlayerDuplicateShifts = getPlayerDuplicateShifts;
  PNS.getAssignedDuplicateHit = getAssignedDuplicateHit;
  PNS.getPlayerRegistrationInfo = getPlayerRegistrationInfo;
  PNS.getPlayerPlacementLabel = getPlayerPlacementLabel;
  PNS.deletePlayersByIds = deletePlayersByIds;
  PNS.removeDuplicatePlayersKeepOne = removeDuplicatePlayersKeepOne;
  let duplicateUiRaf = 0;
  let duplicateUiTimer = 0;

  function scheduleApplyDuplicateUi(delay = 0) {
    try { if (duplicateUiRaf) cancelAnimationFrame(duplicateUiRaf); } catch {}
    try { if (duplicateUiTimer) clearTimeout(duplicateUiTimer); } catch {}

    const run = () => {
      duplicateUiRaf = 0;
      duplicateUiTimer = 0;
      try { applyDuplicateUiCore(); } catch {}
    };

    if (delay > 16) {
      duplicateUiTimer = window.setTimeout(() => {
        duplicateUiTimer = 0;
        try { if (duplicateUiRaf) cancelAnimationFrame(duplicateUiRaf); } catch {}
        duplicateUiRaf = requestAnimationFrame(run);
      }, Math.max(0, Number(delay) || 0));
    } else {
      duplicateUiRaf = requestAnimationFrame(run);
    }
    return true;
  }

  function applyDuplicateUi() {
    return applyDuplicateUiCore();
  }

  PNS.applyDuplicateNicknameUi = applyDuplicateUi;
  PNS.scheduleDuplicateNicknameUi = scheduleApplyDuplicateUi;
  PNS.duplicateShiftLabel = duplicateShiftLabel;

  const originalValidateAssignCore = PNS.validateAssignCore || PNS.validateAssign;
  if (typeof originalValidateAssignCore === 'function' && !PNS.__duplicateNickValidationPatched) {
    PNS.__duplicateNickValidationPatched = true;
    const wrappedValidateAssignCore = function(player, base, kind) {
      const originalError = originalValidateAssignCore.call(this, player, base, kind);
      if (originalError) return originalError;
      const shift = resolveAssignmentShift(base, player);
      if (shift !== 'shift1' && shift !== 'shift2') return '';
      const hit = getAssignedDuplicateHit(player, shift, player?.id);
      if (hit) {
        const shortBaseTitle = String(hit.baseTitle || '').split('/')[0].trim() || hit.baseId;
        return `${t('duplicate_nick_in_shift_error', 'Цей нік уже використано в цій зміні')}: ${player?.name || ''} · ${duplicateShiftLabel(shift)} · ${shortBaseTitle}.`;
      }
      return '';
    };
    PNS.validateAssignCore = wrappedValidateAssignCore;
    PNS.validateAssign = wrappedValidateAssignCore;
  }

  const originalRenderPlayersTableFromState = PNS.renderPlayersTableFromState;
  if (typeof originalRenderPlayersTableFromState === 'function' && !PNS.__duplicateNickRenderPatched) {
    PNS.__duplicateNickRenderPatched = true;
    PNS.renderPlayersTableFromState = function() {
      const result = originalRenderPlayersTableFromState.apply(this, arguments);
      try { scheduleApplyDuplicateUi(20); } catch {}
      return result;
    };
  }

  const originalRenderAll = PNS.renderAll;
  if (typeof originalRenderAll === 'function' && !PNS.__duplicateNickRenderAllPatched) {
    PNS.__duplicateNickRenderAllPatched = true;
    PNS.renderAll = function() {
      const result = originalRenderAll.apply(this, arguments);
      try { scheduleApplyDuplicateUi(20); } catch {}
      return result;
    };
  }

  document.addEventListener('players-table-rendered', () => scheduleApplyDuplicateUi(20));
  document.addEventListener('pns:assignment-changed', () => scheduleApplyDuplicateUi(40));
  document.addEventListener('pns:i18n-changed', () => scheduleApplyDuplicateUi(20));
  document.addEventListener('DOMContentLoaded', () => scheduleApplyDuplicateUi(0));
})();
