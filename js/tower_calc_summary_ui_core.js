(function () {
  'use strict';

  const PNS = window.PNS = window.PNS || {};
  const KEY = '__pns_tower_calc_summary_core__';
  if (window[KEY]) return;
  window[KEY] = true;

  const MODAL_ID = 'towerCalcModal';
  const LS_KEY = 'pns_tower_calc_ui_patch_v21';

  const q = (s, r = document) => r ? r.querySelector(s) : null;
  const qa = (s, r = document) => Array.from((r || document).querySelectorAll(s));
  const byId = (id, r = document) => (r || document).getElementById ? (r || document).getElementById(id) : document.getElementById(id);
  const txt = (el) => String(el?.textContent || '').replace(/\s+/g, ' ').trim();
  const fm = (n) => Number(n || 0).toLocaleString('en-US');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));

  function readUiState() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch { return {}; }
  }
  function writeUiState(obj) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(obj || {})); } catch {}
  }
  function patchState(next) {
    writeUiState(Object.assign({}, readUiState(), next || {}));
  }

  function normalizeShift(value) {
    const s = String(value || '').trim().toLowerCase();
    if (s === 'shift1' || s === 'shift2' || s === 'both') return s;
    if (/1/.test(s)) return 'shift1';
    if (/2/.test(s)) return 'shift2';
    return 'both';
  }

  function normalizeReserveValue(value) {
    const s = String(value || '').trim();
    if (!s) return '';
    const normalized = normalizeShift(s);
    return normalized === 'shift1' || normalized === 'shift2' ? normalized : '';
  }

  function roleNorm(value) {
    try {
      if (typeof window.PNS?.normalizeRole === 'function') return String(window.PNS.normalizeRole(value) || 'unknown').toLowerCase();
    } catch {}
    const s = String(value || '').toLowerCase();
    if (/shoot|arch/.test(s)) return 'shooter';
    if (/fight/.test(s)) return 'fighter';
    if (/ride/.test(s)) return 'rider';
    return 'unknown';
  }

  function getPlayerById(playerId) {
    const id = String(playerId || '');
    const state = window.PNS?.state || {};
    return state?.playerById?.get?.(id) || (Array.isArray(state.players) ? state.players.find((p) => String(p?.id || '') === id) : null) || null;
  }

  function setPlayerShiftLive(player, shiftKey) {
    if (!player) return false;
    const safe = normalizeShift(shiftKey);
    player.shift = safe;
    player.shiftLabel = safe === 'shift1' ? 'Зміна 1' : safe === 'shift2' ? 'Зміна 2' : 'Обидві';
    if (player.rowEl) {
      player.rowEl.dataset.shift = safe;
      const shiftCell = player.rowEl.querySelector('td[data-field="shiftLabel"]');
      if (shiftCell) shiftCell.textContent = player.shiftLabel;
    }
    return true;
  }

  function persistPlayersAfterShiftMove(message) {
    const PNS = window.PNS;
    const state = PNS?.state || {};
    try { PNS.savePlayersSnapshot?.(state.players); } catch {}
    try { PNS.applyPlayerTableFilters?.(); } catch {}
    try { PNS.updateShiftBreakdownUI?.(); } catch {}
    try { PNS.renderAll?.(); } catch {}
    try { if (message) PNS.setImportStatus?.(message, 'good'); } catch {}
  }

  function getModal() { return byId(MODAL_ID); }

  function findShiftLimitInputs(root) {
    const inputs = qa('input[type="number"]', root);
    const matchByText = (el, re) => {
      const label = el.closest('label');
      const wrap = label || el.parentElement || el;
      const t = txt(wrap);
      return re.test(t);
    };
    const s1 = inputs.find((el) => /shiftlimit.*s1|limit.*s1|shift.*1/i.test(el.id || '') || matchByText(el, /ліміт.*shift\s*1|shift\s*1.*ліміт/i));
    const s2 = inputs.find((el) => /shiftlimit.*s2|limit.*s2|shift.*2/i.test(el.id || '') || matchByText(el, /ліміт.*shift\s*2|shift\s*2.*ліміт/i));
    return { shift1: s1 || null, shift2: s2 || null };
  }

  function findWrappedLabel(root, inputId) {
    const input = byId(inputId, root);
    if (!input) return null;
    return input.closest('label') || input.parentElement || null;
  }

  function getLimitValue(root, shiftKey) {
    const found = findShiftLimitInputs(root)[shiftKey];
    const n = Number(found?.value || 0);
    if (Number.isFinite(n) && n > 0) return Math.min(100, Math.max(0, Math.floor(n)));
    return 100;
  }

  function cleanTowerTitle(value, fallback) {
    const raw = String(value || fallback || '').trim();
    if (!raw) return '—';
    const first = raw.split('/')[0].trim();
    return first || raw || '—';
  }

  function getBaseTitleMap() {
    const state = window.PNS?.state || {};
    const map = new Map();
    const add = (baseId, title, fallbackIndex) => {
      const id = String(baseId || '');
      if (!id) return;
      map.set(id, cleanTowerTitle(title, `Турель ${Number(fallbackIndex || 0) + 1}`));
    };
    try {
      const order = (typeof window.getCalcTowerBaseOrder === 'function') ? (window.getCalcTowerBaseOrder() || []) : [];
      order.forEach((base, idx) => add(base?.id, base?.title || state.baseById?.get?.(String(base?.id || ''))?.title, idx));
    } catch {}
    (Array.isArray(state.bases) ? state.bases : []).forEach((base, idx) => add(base?.id, base?.title, idx));
    return map;
  }

  function addAssignment(out, sk, playerId, tower, kind) {
    const id = String(playerId || '');
    if (!id || !tower || !['shift1', 'shift2'].includes(sk) || out.has(id)) return;
    out.set(id, { shift: sk, tower, kind: kind === 'captain' ? 'captain' : 'helper' });
  }

  function buildRobustAssignmentMap() {
    const out = new Map();
    const state = window.PNS?.state || {};
    const titleByBaseId = getBaseTitleMap();

    const addFromSlots = (sk, slots) => {
      (Array.isArray(slots) ? slots : []).forEach((slot, idx) => {
        const baseId = String(slot?.baseId || '');
        const tower = titleByBaseId.get(baseId)
          || cleanTowerTitle(slot?.title, `Турель ${idx + 1}`);
        addAssignment(out, sk, slot?.captainId, tower, 'captain');
        (Array.isArray(slot?.helperIds) ? slot.helperIds : []).forEach((id) => addAssignment(out, sk, id, tower, 'helper'));
      });
    };

    const addFromBases = (sk, bases) => {
      (Array.isArray(bases) ? bases : []).forEach((base, idx) => {
        const tower = titleByBaseId.get(String(base?.id || '')) || cleanTowerTitle(base?.title, `Турель ${idx + 1}`);
        addAssignment(out, sk, base?.captainId, tower, 'captain');
        (Array.isArray(base?.helperIds) ? base.helperIds : []).forEach((id) => addAssignment(out, sk, id, tower, 'helper'));
      });
    };

    const addFromPlan = (sk, plan) => {
      const planBases = plan?.bases && typeof plan.bases === 'object' ? plan.bases : null;
      if (planBases) {
        Object.entries(planBases).forEach(([baseId, base], idx) => {
          const tower = titleByBaseId.get(String(baseId || '')) || cleanTowerTitle(base?.title, `Турель ${idx + 1}`);
          addAssignment(out, sk, base?.captainId, tower, 'captain');
          (Array.isArray(base?.helperIds) ? base.helperIds : []).forEach((id) => addAssignment(out, sk, id, tower, 'helper'));
        });
      }
    };

    // Source of truth for assignments:
    // 1) calcGetTowerSlotsForShift(sk) — the same layer the calculator uses for towers
    // 2) live state.bases / persisted shiftPlans only as fallback if slots are unavailable
    for (const sk of ['shift1', 'shift2']) {
      let usedSlots = false;
      try {
        const slots = (typeof window.calcGetTowerSlotsForShift === 'function')
          ? (window.calcGetTowerSlotsForShift(sk) || [])
          : [];
        if (Array.isArray(slots) && slots.length) {
          addFromSlots(sk, slots);
          usedSlots = true;
        }
      } catch {}

      if (usedSlots) continue;

      if (String(state.activeShift || '') === sk) addFromBases(sk, state.bases);
      else addFromPlan(sk, state.shiftPlans?.[sk] || null);
    }

    return out;
  }


  function getAssignedHelperSets() {
    const out = { shift1: new Set(), shift2: new Set(), any: new Set() };
    const map = buildRobustAssignmentMap();
    map.forEach((info, id) => {
      if (!id || !info?.shift) return;
      out[info.shift].add(id);
      out.any.add(id);
    });
    return out;
  }

  function getLiveAssignedHelperSets() {
    return getAssignedHelperSets();
  }

  function getLiveAssignmentMap() {
    return buildRobustAssignmentMap();
  }

  function collectOverflowMap() {
    const res = window.PNS?.state?.towerCalcLastResults;
    const map = new Map();
    if (!res?.shift1 && !res?.shift2) return map;
    for (const sk of ['shift1', 'shift2']) {
      const plans = Array.isArray(res?.[sk]?.towerPlans) ? res[sk].towerPlans : [];
      plans.forEach((tp, idx) => {
        const tower = cleanTowerTitle(tp?.captain?.name, `Турель ${idx + 1}`);
        (Array.isArray(tp?.notFitPlayers) ? tp.notFitPlayers : []).forEach((p) => {
          const id = String(p?.id || '');
          if (!id) return;
          map.set(id, { kind: 'notfit', shift: sk, tower, note: 'Не вліз' });
        });
        (Array.isArray(tp?.partialPlayers) ? tp.partialPlayers : []).forEach((p) => {
          const id = String(p?.id || '');
          if (!id) return;
          map.set(id, { kind: 'partial', shift: sk, tower, note: 'Частково' });
        });
      });
    }
    return map;
  }

  function computeShortage() {
    const res = window.PNS?.state?.towerCalcLastResults;
    if (!res?.shift1 || !res?.shift2) return 0;
    return Math.max(0,
      (Number(res.shift1.totalDemand || 0) + Number(res.shift2.totalDemand || 0)) -
      (Number(res.shift1.totalSupplied || 0) + Number(res.shift2.totalSupplied || 0))
    );
  }

  function collectStats(root) {
    const PNS = window.PNS;
    const state = PNS?.state || {};
    const players = Array.isArray(state.players) ? state.players : [];
    const helperSets = getAssignedHelperSets();
    const limits = { shift1: getLimitValue(root, 'shift1'), shift2: getLimitValue(root, 'shift2') };

    const out = {
      shift1: { total: 0, shooter: 0, fighter: 0, rider: 0, inTowers: 0, reserve: 0, free: 0, over: 0, limit: limits.shift1 },
      shift2: { total: 0, shooter: 0, fighter: 0, rider: 0, inTowers: 0, reserve: 0, free: 0, over: 0, limit: limits.shift2 },
      both: { total: 0, shooter: 0, fighter: 0, rider: 0, inTowers: 0, reserve: 0 },
      total: players.length,
    };

    for (const p of players) {
      const id = String(p?.id || '');
      const sk = normalizeShift(p?.shift || p?.shiftLabel || 'both');
      const bucket = out[sk] || out.both;
      bucket.total += 1;
      const role = roleNorm(p?.role);
      if (role === 'shooter') bucket.shooter += 1;
      else if (role === 'fighter') bucket.fighter += 1;
      else if (role === 'rider') bucket.rider += 1;
      const assigned = id && helperSets.any.has(id);
      if (assigned) bucket.inTowers += 1;
      else bucket.reserve += 1;
    }

    out.shift1.free = Math.max(0, out.shift1.limit - out.shift1.total);
    out.shift2.free = Math.max(0, out.shift2.limit - out.shift2.total);
    out.shift1.over = Math.max(0, out.shift1.total - out.shift1.limit);
    out.shift2.over = Math.max(0, out.shift2.total - out.shift2.limit);
    out.reserveTotal = out.shift1.reserve + out.shift2.reserve + out.both.reserve;
    out.inTowersTotal = out.shift1.inTowers + out.shift2.inTowers + out.both.inTowers;
    out.shortage = computeShortage();
    return out;
  }

  function roleBlock(stats) {
    const item = (cls, n, label, file) => `
      <div class="tcv7-role-item ${cls}" title="${label}: ${fm(n)}">
        <span class="tcv7-role-icon" aria-hidden="true"><img src="img/${file}" alt="" loading="lazy" decoding="async"></span>
        <strong>${fm(n)}</strong>
      </div>`;
    return `<div class="tcv7-role-row">${item('is-fighter', stats.fighter, 'Бійці', 'fighter.webp')}${item('is-rider', stats.rider, 'Наїзники', 'rider.webp')}${item('is-shooter', stats.shooter, 'Стрільці', 'shooter.webp')}</div>`;
  }

  function card(title, primary, kicker, details, stats, extra) {
    return `
      <article class="tcv7-card">
        <div class="tcv7-card-head">${title}</div>
        <div class="tcv7-card-main">
          <div class="tcv7-card-value">${primary}</div>
          <div class="tcv7-card-kicker">${kicker}</div>
          ${details ? `<div class="tcv7-card-bottom">${details}</div>` : ''}
          ${extra || ''}
          ${stats ? roleBlock(stats) : ''}
        </div>
      </article>`;
  }

  function renderTopSummary(root) {
    const setup = q('[data-calc-main-panel="setup"]', root);
    if (!setup) return;
    const s = collectStats(root);
    const manualEdit = !!readUiState().manualLimitEdit;

    let box = q('#towerCalcTopShiftSummaryV7', root);
    if (!box) {
      box = document.createElement('section');
      box.id = 'towerCalcTopShiftSummaryV7';
      box.className = 'tower-calc-top-summary-v6 panel subpanel';
      setup.insertBefore(box, setup.firstElementChild || null);
    }

    const shiftDetails = (bucket) => manualEdit
      ? `У турелях ${fm(bucket.inTowers)} · Вільно ${fm(bucket.free)} із ${fm(bucket.limit)} · Резерв ${fm(bucket.reserve)}`
      : `У турелях ${fm(bucket.inTowers)} · Резерв ${fm(bucket.reserve)} із ${fm(bucket.total)}`;

    const totalStats = {
      fighter: Number(s.shift1.fighter || 0) + Number(s.shift2.fighter || 0) + Number(s.both.fighter || 0),
      rider: Number(s.shift1.rider || 0) + Number(s.shift2.rider || 0) + Number(s.both.rider || 0),
      shooter: Number(s.shift1.shooter || 0) + Number(s.shift2.shooter || 0) + Number(s.both.shooter || 0),
    };

    box.innerHTML = `
      <div class="tcv7-grid">
        ${card('Зміна 1', fm(s.shift1.total), 'усього гравців', shiftDetails(s.shift1), s.shift1, s.shift1.over > 0 ? `<div class="tcv7-warn">+${fm(s.shift1.over)} понад ліміт</div>` : '')}
        ${card('Зміна 2', fm(s.shift2.total), 'усього гравців', shiftDetails(s.shift2), s.shift2, s.shift2.over > 0 ? `<div class="tcv7-warn">+${fm(s.shift2.over)} понад ліміт</div>` : '')}
        ${card('Обидві', fm(s.both.total), 'окремо від основного плану', `У турелях ${fm(s.both.inTowers)} · Резерв ${fm(s.both.reserve)}`, s.both, '')}
        ${card('Усього', fm(s.total), 'загальна кількість гравців', `У турелях ${fm(s.inTowersTotal)} · Резерв ${fm(s.reserveTotal)}${s.shortage > 0 ? ` · Нестача ${fm(s.shortage)}` : ''}`, totalStats, '')}
      </div>`;

    const balance = q('#towerCalcShiftBalance', root);
    const head = q('.tower-calc-shift-balance-head', balance);
    if (head) head.style.display = 'none';
    const cards = q('.tower-calc-shift-cards', balance);
    if (cards) cards.style.display = 'none';
    const countsLine = q('#towerCalcShiftCountsLine', balance);
    if (countsLine) countsLine.style.display = 'none';
    const mini = q('#towerCalcMiniSummary', root);
    if (mini) mini.style.display = 'none';
  }

  function readOverflowReserveStorage() {
    const tc = (window.PNS?.state?.towerCalc || window.PNS?.state?.towerCalcState || {});
    const fromState = (tc && typeof tc === 'object' && tc.overflowReserve && typeof tc.overflowReserve === 'object') ? tc.overflowReserve : {};
    let fromLs = {};
    try { fromLs = JSON.parse(localStorage.getItem('pns_tower_calc_state') || '{}')?.overflowReserve || {}; } catch {}
    return { fromState, fromLs };
  }

  function getMergedOverflowReserveMap() {
    const { fromState, fromLs } = readOverflowReserveStorage();
    const raw = { ...(fromLs || {}), ...(fromState || {}) };
    const clean = {};
    Object.entries(raw).forEach(([id, val]) => {
      const safe = normalizeReserveValue(val);
      if (safe) clean[String(id)] = safe;
    });
    return clean;
  }

  function writeOverflowReserveStorage(nextMap) {
    const clean = {};
    Object.entries(nextMap || {}).forEach(([id, val]) => {
      const safe = String(val || '');
      if (safe === 'shift1' || safe === 'shift2') clean[String(id)] = safe;
    });
    const state = window.PNS?.state || {};
    if (state.towerCalc && typeof state.towerCalc === 'object') state.towerCalc.overflowReserve = { ...clean };
    if (state.towerCalcState && typeof state.towerCalcState === 'object') state.towerCalcState.overflowReserve = { ...clean };
    try {
      const raw = JSON.parse(localStorage.getItem('pns_tower_calc_state') || '{}') || {};
      raw.overflowReserve = { ...clean };
      localStorage.setItem('pns_tower_calc_state', JSON.stringify(raw));
    } catch {}
  }

  function getOverflowRows(shiftKey) {
    const state = window.PNS?.state || {};
    const players = Array.isArray(state.players) ? state.players : [];
    const assignmentMap = getLiveAssignmentMap();
    const reserveMap = getMergedOverflowReserveMap();
    const active = normalizeShift(shiftKey);

    return players
      .filter((p) => normalizeShift(p?.shift || p?.shiftLabel || 'both') === active)
      .map((p) => {
        const id = String(p?.id || '');
        const assigned = assignmentMap.get(id) || null;
        const reserveShift = normalizeReserveValue(reserveMap[id]);
        const status = assigned ? 'in' : reserveShift ? 'reserve' : 'out';
        const towerLabel = assigned
          ? (active === 'both' ? `${assigned.shift === 'shift1' ? 'Зміна 1' : 'Зміна 2'} · ${assigned.tower}` : assigned.tower)
          : '—';
        return {
          id,
          name: String(p?.name || '—'),
          alliance: String(p?.alliance || '—'),
          role: String(p?.role || '—'),
          tier: String(p?.tier || '—'),
          march: Number(p?.march || 0) || 0,
          tower: towerLabel,
          towerRaw: assigned?.tower || '—',
          assignedShift: assigned?.shift || '',
          reserve: reserveShift,
          status,
          statusLabel: assigned ? 'У турелі' : reserveShift ? 'Резерв' : 'Поза туреллю',
        };
      })
      .sort((a, b) => {
        const order = { in: 0, out: 1, reserve: 2 };
        return (order[a.status] - order[b.status]) || (b.march - a.march) || a.name.localeCompare(b.name, 'uk');
      });
  }

  function getOverflowFilter(active) {
    const ui = readUiState();
    const key = `overflowFilter_${active}`;
    const raw = String(ui[key] || ui.overflowFilter || 'all');
    return ['all', 'in', 'out', 'reserve'].includes(raw) ? raw : 'all';
  }

  function setOverflowFilter(active, filter) {
    const safe = ['all', 'in', 'out', 'reserve'].includes(String(filter || '')) ? String(filter) : 'all';
    patchState({ overflowFilter: safe, [`overflowFilter_${active}`]: safe });
  }

  function applyOverflowFilter(rows, filter) {
    const safe = ['all', 'in', 'out', 'reserve'].includes(String(filter || '')) ? String(filter) : 'all';
    if (safe === 'all') return rows.slice();
    return rows.filter((row) => row.status === safe);
  }

  function summarizeOverflowRows(rows) {
    return rows.reduce((acc, row) => {
      acc.total += 1;
      if (row.status === 'in') acc.in += 1;
      else if (row.status === 'reserve') acc.reserve += 1;
      else acc.out += 1;
      return acc;
    }, { total: 0, in: 0, out: 0, reserve: 0 });
  }

  function renderMiniStat(title, value, hint, extraClass) {
    return `
      <article class="tcv5-mini-card ${extraClass || ''}">
        <div class="tcv5-mini-card-title">${title}</div>
        <div class="tcv5-mini-card-value">${fm(value)}</div>
        <div class="tcv5-mini-card-hint">${hint}</div>
      </article>`;
  }

  function renderStatusPill(status, label) {
    const cls = status === 'in' ? 'is-in' : status === 'reserve' ? 'is-reserve' : 'is-out';
    return `<span class="tcv5-status-pill ${cls}">${label}</span>`;
  }

  function updateMainTabLabels(root) {
    qa('[data-calc-main-tab="overflow"]', root || document).forEach((btn) => {
      const current = txt(btn);
      if (current !== 'Статус гравців') btn.textContent = 'Статус гравців';
    });
  }

  function renderOverflowTabs(root) {
    const panel = q('#towerCalcOverflowOut', root) || q('[data-calc-main-panel="overflow"]', root);
    if (!panel) return;

    updateMainTabLabels(root);

    const ui = readUiState();
    const active = ['shift1', 'shift2', 'both'].includes(ui.overflowTab) ? ui.overflowTab : 'shift1';
    const allRows = getOverflowRows(active);
    const meta = summarizeOverflowRows(allRows);
    const activeFilter = getOverflowFilter(active);
    const items = applyOverflowFilter(allRows, activeFilter);
    const title = active === 'shift1' ? 'Зміна 1' : active === 'shift2' ? 'Зміна 2' : 'Обидві';
    const subtitle = active === 'both'
      ? 'Тут видно всіх гравців із групи «Обидві»: хто вже стоїть у турелях, хто поза турелями, і хто вручну відправлений у резерв.'
      : 'Одна таблиця з поточним статусом гравця: у турелі, поза туреллю або в резерві.';
    const savedScroll = Number(ui['overflowScroll_' + active] || 0) || 0;

    panel.innerHTML = `
      <div class="tcv5-overflow-wrap tcv5-status-view">
        <div class="tcv5-overflow-head">
          <div>
            <h3>Статус гравців</h3>
            <div class="muted small">${subtitle}</div>
          </div>
          <div class="tcv5-tabs" role="tablist">
            <button class="btn btn-sm ${active === 'shift1' ? 'is-active' : ''}" type="button" data-ov5-tab="shift1">Зміна 1</button>
            <button class="btn btn-sm ${active === 'shift2' ? 'is-active' : ''}" type="button" data-ov5-tab="shift2">Зміна 2</button>
            <button class="btn btn-sm ${active === 'both' ? 'is-active' : ''}" type="button" data-ov5-tab="both">Обидві</button>
          </div>
        </div>

        <div class="tcv5-overflow-summary">
          ${renderMiniStat('У турелях', meta.in, 'Зараз реально стоять у турелях', 'is-in')}
          ${renderMiniStat('Поза турелями', meta.out, 'Не стоять у жодній турелі', 'is-out')}
          ${renderMiniStat('У резерві', meta.reserve, 'Гравці, яких вручну відправили в резерв зміни 1/2', 'is-reserve')}
        </div>

        <section class="tcv5-panel is-active" data-ov5-panel="${active}">
          <div class="tcv5-panel-head">
            <div>
              <strong>${title}</strong>
              <div class="muted small">Показано ${fm(items.length)} із ${fm(allRows.length)}</div>
            </div>
            <div class="tcv5-filters" role="tablist" aria-label="Фільтр статусу">
              <button class="btn btn-xs ${activeFilter === 'all' ? 'is-active' : ''}" type="button" data-ov5-filter="all">Усі ${fm(meta.total)}</button>
              <button class="btn btn-xs ${activeFilter === 'in' ? 'is-active' : ''}" type="button" data-ov5-filter="in">У турелях ${fm(meta.in)}</button>
              <button class="btn btn-xs ${activeFilter === 'out' ? 'is-active' : ''}" type="button" data-ov5-filter="out">Поза турелями ${fm(meta.out)}</button>
              <button class="btn btn-xs ${activeFilter === 'reserve' ? 'is-active' : ''}" type="button" data-ov5-filter="reserve">У резерві ${fm(meta.reserve)}</button>
            </div>
            <div class="tcv17-overflow-actions">
              <button class="btn btn-xs" type="button" data-ov5-reset-shift="shift1">Очистити резерв Зміни 1</button>
              <button class="btn btn-xs" type="button" data-ov5-reset-shift="shift2">Очистити резерв Зміни 2</button>
              <button class="btn btn-xs" type="button" data-ov5-restore-import="1">Відновити з імпорту</button>
            </div>
          </div>

          ${items.length ? `
            <div class="helpers-table-wrap top-space tcv5-scroll-wrap" data-ov5-scroll-wrap="${active}">
              <table class="mini-table tower-calc-tier-table tcv5-table">
                <thead>
                  <tr>
                    <th>Гравець</th>
                    <th>Альянс</th>
                    <th>Роль / Тір</th>
                    <th>Марш</th>
                    <th>Статус</th>
                    <th>Турель</th>
                    <th>Резерв</th>
                    <th>Дії</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map((r) => `
                    <tr data-player-status="${esc(r.status)}">
                      <td>
                        <div class="tcv5-player-name">${esc(r.name)}</div>
                      </td>
                      <td>${esc(r.alliance)}</td>
                      <td>${esc(typeof window.PNS?.roleLabel === "function" ? window.PNS.roleLabel(r.role) : r.role)} <span class="muted">${esc(r.tier)}</span></td>
                      <td>${fm(r.march)}</td>
                      <td>${renderStatusPill(r.status, r.statusLabel)}</td>
                      <td>${esc(r.tower)}</td>
                      <td>${r.reserve === 'shift1' ? 'Зміна 1' : r.reserve === 'shift2' ? 'Зміна 2' : '—'}</td>
                      <td>
                        ${r.status === 'in' ? '<span class="muted">—</span>' : `
                          <button class="btn btn-xs ${r.reserve === 'shift1' ? 'is-active' : ''}" type="button" data-ui-reserve-shift="shift1" data-player-id="${esc(r.id)}">Зміна 1</button>
                          <button class="btn btn-xs ${r.reserve === 'shift2' ? 'is-active' : ''}" type="button" data-ui-reserve-shift="shift2" data-player-id="${esc(r.id)}">Зміна 2</button>`}
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>` : '<div class="tower-calc-placeholder muted small top-space">За цим фільтром зараз порожньо.</div>'}
        </section>
      </div>`;

    const scrollWrap = q('[data-ov5-scroll-wrap]', panel);
    if (scrollWrap) {
      scrollWrap.scrollTop = savedScroll;
      scrollWrap.addEventListener('scroll', () => {
        patchState({ ['overflowScroll_' + active]: scrollWrap.scrollTop });
      }, { passive: true });
      scrollWrap.addEventListener('wheel', (e) => {
        const canScrollDown = scrollWrap.scrollTop + scrollWrap.clientHeight < scrollWrap.scrollHeight;
        const canScrollUp = scrollWrap.scrollTop > 0;
        if ((e.deltaY > 0 && canScrollDown) || (e.deltaY < 0 && canScrollUp)) e.stopPropagation();
      }, { passive: true });
    }
  }


  function restorePlayerShiftsFromImportFallback(players) {
    const PNS = window.PNS;
    const list = Array.isArray(players) ? players : [];
    const counts = { shift1: 0, shift2: 0, both: 0 };
    for (const p of list) {
      if (!p) continue;
      const registered = (() => {
        try { return normalizeShift(PNS?.getRegisteredShiftForPlayer?.(p) || p?.registeredShift || p?.registeredShiftLabel || 'both'); } catch { return 'both'; }
      })();
      const safe = ['shift1', 'shift2', 'both'].includes(registered) ? registered : 'both';
      setPlayerShiftLive(p, safe);
      counts[safe] = Number(counts[safe] || 0) + 1;
    }
    return counts;
  }

  function reapplyStatusPlayersUi(root) {
    const calcRoot = root || getModal() || document;
    try { window.calcApplyMainTabUI?.(calcRoot, 'overflow'); } catch {}
    try { install(calcRoot); } catch {}
    try { window.PNS?.patchTowerCalcRuntimeUi?.(); } catch {}
    return true;
  }

  function triggerSettingsClear(mode) {
    const root = getModal() || document;
    const id = mode === 'shift1'
      ? 'towerCalcClearShift1Btn'
      : mode === 'shift2'
        ? 'towerCalcClearShift2Btn'
        : 'towerCalcClearHelpersAllBtn';
    const btn = byId(id, root) || byId(id, document);
    if (!btn) return false;
    try {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    } catch {}
    try { btn.click(); return true; } catch {}
    return false;
  }

  function hideOverflowPanelDuringRefresh(root) {
    const calcRoot = root || getModal() || document;
    const panel = q('[data-calc-main-panel="overflow"]', calcRoot);
    if (!panel) return () => {};
    const prevVisibility = panel.style.visibility;
    const prevOpacity = panel.style.opacity;
    panel.style.visibility = 'hidden';
    panel.style.opacity = '0';
    let released = false;
    return () => {
      if (released) return;
      released = true;
      panel.style.visibility = prevVisibility;
      panel.style.opacity = prevOpacity;
    };
  }

  function refreshStatusPlayersUi(root) {
    const calcRoot = root || getModal() || document;
    const release = hideOverflowPanelDuringRefresh(calcRoot);
    const rerender = () => {
      try { reapplyStatusPlayersUi(calcRoot); } catch {}
      try { release(); } catch {}
    };
    try { rerender(); } catch {}
    try { requestAnimationFrame(rerender); } catch {}
    return true;
  }

  function resetOverflowReserveForShift(shiftKey) {
    const sk = normalizeShift(shiftKey);
    if (!['shift1', 'shift2'].includes(sk)) return { changed: 0, shiftKey: sk };
    const PNS = window.PNS;
    const state = PNS?.state || {};
    const players = Array.isArray(state.players) ? state.players : [];

    let rawTc = {};
    try { rawTc = JSON.parse(localStorage.getItem('pns_tower_calc_state') || '{}') || {}; } catch { rawTc = {}; }

    const merged = {
      ...(rawTc?.overflowReserve && typeof rawTc.overflowReserve === 'object' ? rawTc.overflowReserve : {}),
      ...(state?.towerCalc?.overflowReserve && typeof state.towerCalc.overflowReserve === 'object' ? state.towerCalc.overflowReserve : {}),
      ...(state?.towerCalcState?.overflowReserve && typeof state.towerCalcState.overflowReserve === 'object' ? state.towerCalcState.overflowReserve : {}),
      ...getMergedOverflowReserveMap(),
    };

    const next = { ...merged };
    const idsToClear = Object.keys(merged).filter((id) => normalizeReserveValue(merged[id]) === sk);
    let changed = 0;

    idsToClear.forEach((id) => {
      delete next[id];
      try { window.calcSetOverflowReserve?.(id, ''); } catch {}
      const p = getPlayerById(id);
      if (p) {
        const registered = (() => {
          try { return normalizeShift(PNS?.getRegisteredShiftForPlayer?.(p) || p?.registeredShift || p?.registeredShiftLabel || 'both'); } catch { return 'both'; }
        })();
        setPlayerShiftLive(p, registered);
      }
      changed += 1;
    });

    writeOverflowReserveStorage(next);
    const delegated = triggerSettingsClear(sk);
    try { PNS.savePlayersSnapshot?.(players); } catch {}
    try { PNS.applyPlayerTableFilters?.(); } catch {}
    try { if (!delegated) PNS.renderAll?.(); } catch {}
    try { if (!delegated) window.computeTowerCalcResults?.(); } catch {}
    patchState({ overflowTab: sk });
    refreshStatusPlayersUi();
    try { requestAnimationFrame(() => refreshStatusPlayersUi()); } catch {}
    try { setTimeout(() => refreshStatusPlayersUi(), 60); } catch {}
    try { PNS.setImportStatus?.(`Очищено ${sk === 'shift1' ? 'зміну 1' : 'зміну 2'} як у налаштуваннях турелей.`, 'good'); } catch {}
    return { changed, shiftKey: sk, delegated };
  }

  function restoreOverflowFromImport() {
    const PNS = window.PNS;
    const state = PNS?.state || {};
    const players = Array.isArray(state.players) ? state.players : [];

    const rawMerged = getMergedOverflowReserveMap();
    Object.keys(rawMerged).forEach((id) => { try { window.calcSetOverflowReserve?.(id, ''); } catch {} });
    writeOverflowReserveStorage({});

    const delegated = triggerSettingsClear('all');
    let counts = null;
    try { counts = PNS.restorePlayerShiftsFromImport?.(players) || null; } catch {}
    if (!counts) counts = restorePlayerShiftsFromImportFallback(players);

    try { PNS.savePlayersSnapshot?.(players); } catch {}
    try { PNS.applyPlayerTableFilters?.(); } catch {}
    try { if (!delegated) PNS.renderAll?.(); } catch {}
    try { if (!delegated) window.computeTowerCalcResults?.(); } catch {}
    refreshStatusPlayersUi();
    try { requestAnimationFrame(() => refreshStatusPlayersUi()); } catch {}
    try { setTimeout(() => refreshStatusPlayersUi(), 60); } catch {}
    try {
      const text = counts ? `Відновлено з імпорту після очищення змін 1 + 2: Зміна 1 — ${counts.shift1}, Зміна 2 — ${counts.shift2}, Обидві — ${counts.both}.` : 'Відновлено з імпорту після очищення змін 1 + 2.';
      PNS.setImportStatus?.(text, 'good');
    } catch {}
    return counts;
  }

  function toggleReserveCore(playerId, shiftKey) {
    const id = String(playerId || '');
    const sk = normalizeShift(shiftKey);
    if (!id || !['shift1', 'shift2'].includes(sk)) return false;

    const p = getPlayerById(id);
    if (!p) return false;

    const currentShift = normalizeShift(p?.shift || p?.shiftLabel || 'both');
    if (currentShift !== sk) {
      setPlayerShiftLive(p, sk);
    }

    const merged = getMergedOverflowReserveMap();
    const next = { ...merged };
    if (normalizeReserveValue(next[id]) === sk) delete next[id];
    else next[id] = sk;
    writeOverflowReserveStorage(next);

    try { window.calcSetOverflowReserve?.(id, next[id] || ''); } catch {}
    try { persistPlayersAfterShiftMove(`Гравця ${p.name || ''} переведено в ${sk === 'shift1' ? 'Зміну 1' : 'Зміну 2'}.`); } catch {}
    patchState({ overflowTab: sk });
    refreshStatusPlayersUi();
    return true;
  }

  function bindUiEvents(root) {
    const calcRoot = root || getModal() || document;
    if (!calcRoot || calcRoot.dataset.tcSummaryUiCoreBound === '1') return false;
    calcRoot.dataset.tcSummaryUiCoreBound = '1';

    calcRoot.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('[data-ov5-tab]');
      if (tabBtn && calcRoot.contains(tabBtn)) {
        e.preventDefault();
        e.stopPropagation();
        patchState({ overflowTab: tabBtn.dataset.ov5Tab || 'shift1' });
        refreshStatusPlayersUi(calcRoot);
        return;
      }

      const filterBtn = e.target.closest('[data-ov5-filter]');
      if (filterBtn && calcRoot.contains(filterBtn)) {
        e.preventDefault();
        e.stopPropagation();
        const active = normalizeShift(readUiState().overflowTab || 'shift1');
        setOverflowFilter(active, filterBtn.dataset.ov5Filter || 'all');
        refreshStatusPlayersUi(calcRoot);
        return;
      }

      const resetBtn = e.target.closest('[data-ov5-reset-shift]');
      if (resetBtn && calcRoot.contains(resetBtn)) {
        e.preventDefault();
        e.stopPropagation();
        resetOverflowReserveForShift(resetBtn.dataset.ov5ResetShift);
        return;
      }

      const restoreBtn = e.target.closest('[data-ov5-restore-import]');
      if (restoreBtn && calcRoot.contains(restoreBtn)) {
        e.preventDefault();
        e.stopPropagation();
        restoreOverflowFromImport();
        return;
      }

      const reserveBtn = e.target.closest('[data-ui-reserve-shift]');
      if (reserveBtn && calcRoot.contains(reserveBtn)) {
        e.preventDefault();
        e.stopPropagation();
        toggleReserveCore(reserveBtn.dataset.playerId, reserveBtn.dataset.uiReserveShift);
        return;
      }
    }, true);

    return true;
  }

  function install(root) {
    const calcRoot = root || getModal() || document;
    bindUiEvents(calcRoot);
    updateMainTabLabels(calcRoot);
    renderTopSummary(calcRoot);
    renderOverflowTabs(calcRoot);
    return true;
  }

  PNS.towerCalcReadUiState = readUiState;
  PNS.towerCalcWriteUiState = writeUiState;
  PNS.towerCalcPatchUiState = patchState;
  PNS.towerCalcNormalizeShift = normalizeShift;
  PNS.towerCalcNormalizeReserveValue = normalizeReserveValue;
  PNS.towerCalcGetPlayerById = getPlayerById;
  PNS.towerCalcGetModal = getModal;
  PNS.towerCalcFindShiftLimitInputs = findShiftLimitInputs;
  PNS.towerCalcFindWrappedLabel = findWrappedLabel;
  PNS.towerCalcGetLimitValue = getLimitValue;
  PNS.towerCalcGetAssignedHelperSets = getAssignedHelperSets;
  PNS.towerCalcGetLiveAssignedHelperSets = getLiveAssignedHelperSets;
  PNS.towerCalcGetLiveAssignmentMap = getLiveAssignmentMap;
  PNS.towerCalcCollectOverflowMap = collectOverflowMap;
  PNS.towerCalcCollectStats = collectStats;
  PNS.towerCalcRenderTopSummary = renderTopSummary;
  PNS.towerCalcRenderOverflowTabs = renderOverflowTabs;
  PNS.installTowerCalcSummaryUi = install;
  PNS.towerCalcGetOverflowRows = getOverflowRows;
  PNS.towerCalcGetOverflowFilter = getOverflowFilter;
  PNS.towerCalcSetOverflowFilter = setOverflowFilter;
  PNS.towerCalcReadOverflowReserveStorage = readOverflowReserveStorage;
  PNS.towerCalcWriteOverflowReserveStorage = writeOverflowReserveStorage;
  PNS.towerCalcResetOverflowReserveForShift = resetOverflowReserveForShift;
  PNS.towerCalcRestoreOverflowFromImport = restoreOverflowFromImport;
  PNS.towerCalcToggleReserveCore = toggleReserveCore;
  PNS.towerCalcRefreshStatusPlayersUi = refreshStatusPlayersUi;
})();
