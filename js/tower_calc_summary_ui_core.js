
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
    player.shiftLabel = safe === 'shift1' ? 'Shift 1' : safe === 'shift2' ? 'Shift 2' : 'Both';
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

  function getAssignedHelperSets() {
    const out = { shift1: new Set(), shift2: new Set(), any: new Set() };
    const res = window.PNS?.state?.towerCalcLastResults || null;
    let usedPlanned = false;

    for (const sk of ['shift1', 'shift2']) {
      const plans = Array.isArray(res?.[sk]?.towerPlans) ? res[sk].towerPlans : [];
      if (plans.length) {
        usedPlanned = true;
        for (const tp of plans) {
          const captainId = String(tp?.captain?.id || '');
          if (captainId) {
            out[sk].add(captainId);
            out.any.add(captainId);
          }
          const picked = Array.isArray(tp?.pickedPlayers) ? tp.pickedPlayers : [];
          for (const p of picked) {
            const sid = String(p?.id || '');
            if (!sid) continue;
            out[sk].add(sid);
            out.any.add(sid);
          }
        }
      }
    }

    if (!usedPlanned) {
      for (const sk of ['shift1', 'shift2']) {
        const slots = (typeof window.calcGetTowerSlotsForShift === 'function') ? (window.calcGetTowerSlotsForShift(sk) || []) : [];
        for (const slot of slots) {
          const captainId = String(slot?.captainId || '');
          if (captainId) {
            out[sk].add(captainId);
            out.any.add(captainId);
          }
          const ids = Array.isArray(slot?.helperIds) ? slot.helperIds : [];
          for (const id of ids) {
            const sid = String(id || '');
            if (!sid) continue;
            out[sk].add(sid);
            out.any.add(sid);
          }
        }
      }
    }

    return out;
  }

  function getLiveAssignedHelperSets() {
    const out = { shift1: new Set(), shift2: new Set(), any: new Set() };
    for (const sk of ['shift1', 'shift2']) {
      const slots = (typeof window.calcGetTowerSlotsForShift === 'function') ? (window.calcGetTowerSlotsForShift(sk) || []) : [];
      for (const slot of slots) {
        const captainId = String(slot?.captainId || '');
        if (captainId) {
          out[sk].add(captainId);
          out.any.add(captainId);
        }
        const ids = Array.isArray(slot?.helperIds) ? slot.helperIds : [];
        for (const id of ids) {
          const sid = String(id || '');
          if (!sid) continue;
          out[sk].add(sid);
          out.any.add(sid);
        }
      }
    }
    return out;
  }

  function collectOverflowMap() {
    const res = window.PNS?.state?.towerCalcLastResults;
    const map = new Map();
    if (!res?.shift1 && !res?.shift2) return map;
    for (const sk of ['shift1', 'shift2']) {
      const plans = Array.isArray(res?.[sk]?.towerPlans) ? res[sk].towerPlans : [];
      plans.forEach((tp, idx) => {
        const tower = String(tp?.captain?.name || `Башня ${idx + 1}`);
        (Array.isArray(tp?.notFitPlayers) ? tp.notFitPlayers : []).forEach((p) => {
          const id = String(p?.id || '');
          if (!id) return;
          map.set(id, { kind: 'notfit', shift: sk, tower, note: 'Не вліз' });
        });
        (Array.isArray(tp?.partialPlayers) ? tp.partialPlayers : []).forEach((p) => {
          const id = String(p?.id || '');
          if (!id) return;
          const sent = Number(p?.sent || 0) || 0;
          const full = Number(p?.full || 0) || 0;
          map.set(id, { kind: 'partial', shift: sk, tower, note: `${fm(sent)} / ${fm(full)}` });
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
    return `<div class="tcv7-role-row">${item('is-fighter', stats.fighter, 'Fighter', 'fighter.png')}${item('is-rider', stats.rider, 'Rider', 'rider.png')}${item('is-shooter', stats.shooter, 'Shooter', 'shooter.png')}</div>`;
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
      ? `У башнях ${fm(bucket.inTowers)} · Вільно ${fm(bucket.free)} із ${fm(bucket.limit)} · Резерв ${fm(bucket.reserve)}`
      : `У башнях ${fm(bucket.inTowers)} · Вільно ${fm(bucket.reserve)} із ${fm(bucket.total)}`;

    const totalStats = {
      fighter: Number(s.shift1.fighter || 0) + Number(s.shift2.fighter || 0) + Number(s.both.fighter || 0),
      rider: Number(s.shift1.rider || 0) + Number(s.shift2.rider || 0) + Number(s.both.rider || 0),
      shooter: Number(s.shift1.shooter || 0) + Number(s.shift2.shooter || 0) + Number(s.both.shooter || 0),
    };

    box.innerHTML = `
      <div class="tcv7-grid">
        ${card('Shift 1', fm(s.shift1.total), 'усього гравців', shiftDetails(s.shift1), s.shift1, s.shift1.over > 0 ? `<div class="tcv7-warn">+${fm(s.shift1.over)} понад ліміт</div>` : '')}
        ${card('Shift 2', fm(s.shift2.total), 'усього гравців', shiftDetails(s.shift2), s.shift2, s.shift2.over > 0 ? `<div class="tcv7-warn">+${fm(s.shift2.over)} понад ліміт</div>` : '')}
        ${card('Both', fm(s.both.total), 'окремо від планування', `У башнях ${fm(s.both.inTowers)} · Резерв ${fm(s.both.reserve)}`, s.both, '')}
        ${card('Усього', fm(s.total), 'загальна кількість гравців', `У башнях ${fm(s.inTowersTotal)} · Резерв ${fm(s.reserveTotal)}${s.shortage > 0 ? ` · Нестача ${fm(s.shortage)}` : ''}`, totalStats, '')}
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

  function getOverflowRows(shiftKey) {
    const state = window.PNS?.state || {};
    const players = Array.isArray(state.players) ? state.players : [];
    const assigned = getLiveAssignedHelperSets().any;
    const overflowMap = collectOverflowMap();
    const tc = (window.PNS?.state?.towerCalc || window.PNS?.state?.towerCalcState || {});
    const reserveState = (tc && typeof tc === 'object' && tc.overflowReserve && typeof tc.overflowReserve === 'object') ? tc.overflowReserve : null;
    const reserveLs = (() => {
      try { return JSON.parse(localStorage.getItem('pns_tower_calc_state') || '{}')?.overflowReserve || {}; } catch { return {}; }
    })();

    return players
      .filter((p) => normalizeShift(p?.shift || p?.shiftLabel || 'both') === shiftKey && !assigned.has(String(p?.id || '')))
      .map((p) => {
        const id = String(p?.id || '');
        const of = overflowMap.get(id);
        const reserve = String((reserveState && reserveState[id]) || reserveLs[id] || '');
        return {
          id,
          name: String(p?.name || '—'),
          alliance: String(p?.alliance || '—'),
          role: String(p?.role || '—'),
          tier: String(p?.tier || '—'),
          march: Number(p?.march || 0) || 0,
          status: of?.kind === 'partial' ? 'Частково' : of?.kind === 'notfit' ? 'Не вліз' : 'Резерв',
          tower: of?.tower || '—',
          reserve,
        };
      })
      .sort((a, b) => (b.march - a.march) || a.name.localeCompare(b.name));
  }

  function readOverflowReserveStorage() {
    const tc = (window.PNS?.state?.towerCalc || window.PNS?.state?.towerCalcState || {});
    const fromState = (tc && typeof tc === 'object' && tc.overflowReserve && typeof tc.overflowReserve === 'object') ? tc.overflowReserve : {};
    let fromLs = {};
    try { fromLs = JSON.parse(localStorage.getItem('pns_tower_calc_state') || '{}')?.overflowReserve || {}; } catch {}
    return { fromState, fromLs };
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

  function resetOverflowReserveForShift(shiftKey) {
    const sk = normalizeShift(shiftKey);
    if (!['shift1', 'shift2'].includes(sk)) return { changed: 0, shiftKey: sk };
    const PNS = window.PNS;
    const state = PNS?.state || {};
    const players = Array.isArray(state.players) ? state.players : [];
    const { fromState, fromLs } = readOverflowReserveStorage();
    const merged = { ...(fromLs || {}), ...(fromState || {}) };
    const next = { ...merged };
    let changed = 0;

    for (const [id, reserveShift] of Object.entries(merged)) {
      if (String(reserveShift || '') !== sk) continue;
      delete next[id];
      const p = getPlayerById(id);
      if (!p) continue;
      const registered = (() => {
        try { return normalizeShift(PNS?.getRegisteredShiftForPlayer?.(p) || p?.registeredShift || p?.registeredShiftLabel || 'both'); } catch { return 'both'; }
      })();
      setPlayerShiftLive(p, registered);
      changed += 1;
    }

    writeOverflowReserveStorage(next);
    try { PNS.savePlayersSnapshot?.(players); } catch {}
    try { PNS.applyPlayerTableFilters?.(); } catch {}
    try { PNS.renderAll?.(); } catch {}
    try { window.computeTowerCalcResults?.(); } catch {}
    try { PNS.setImportStatus?.(`Скинуто резерв ${sk === 'shift1' ? 'Shift 1' : 'Shift 2'}: ${changed}.`, 'good'); } catch {}
    patchState({ overflowTab: sk });
    return { changed, shiftKey: sk };
  }

  function restoreOverflowFromImport() {
    const PNS = window.PNS;
    const state = PNS?.state || {};
    const players = Array.isArray(state.players) ? state.players : [];
    writeOverflowReserveStorage({});
    let counts = null;
    try { counts = PNS.restorePlayerShiftsFromImport?.(players) || null; } catch {}
    try { PNS.savePlayersSnapshot?.(players); } catch {}
    try { PNS.applyPlayerTableFilters?.(); } catch {}
    try { PNS.renderAll?.(); } catch {}
    try { window.computeTowerCalcResults?.(); } catch {}
    try {
      const text = counts ? `Відновлено з імпорту: S1 ${counts.shift1}, S2 ${counts.shift2}, Both ${counts.both}.` : 'Відновлено з імпорту.';
      PNS.setImportStatus?.(text, 'good');
    } catch {}
    return counts;
  }

  function renderOverflowTabs(root) {
    const panel = q('#towerCalcOverflowOut', root) || q('[data-calc-main-panel="overflow"]', root);
    if (!panel) return;
    const ui = readUiState();
    const active = ['shift1', 'shift2', 'both'].includes(ui.overflowTab) ? ui.overflowTab : 'shift1';
    const rows = { shift1: getOverflowRows('shift1'), shift2: getOverflowRows('shift2'), both: getOverflowRows('both') };
    const items = rows[active] || [];
    const title = active === 'shift1' ? 'Shift 1' : active === 'shift2' ? 'Shift 2' : 'Both';
    const subtitle = active === 'both'
      ? `Резерв ${fm(items.length)} · окремо від автоматичного планування`
      : `Резерв ${fm(items.length)} · тут можна вручну зарезервувати у 1 Shift або 2 Shift`;
    const savedScroll = Number(ui['overflowScroll_' + active] || 0) || 0;

    panel.innerHTML = `
      <div class="tcv5-overflow-wrap">
        <div class="tcv5-overflow-head">
          <div>
            <h3>Хто не вліз / резерв</h3>
            <div class="muted small">Показуються тільки гравці, яких зараз немає в башнях. Вкладки йдуть за поточним Shift гравця.</div>
          </div>
          <div class="tcv5-tabs" role="tablist">
            <button class="btn btn-sm ${active === 'shift1' ? 'is-active' : ''}" type="button" data-ov5-tab="shift1">Shift 1</button>
            <button class="btn btn-sm ${active === 'shift2' ? 'is-active' : ''}" type="button" data-ov5-tab="shift2">Shift 2</button>
            <button class="btn btn-sm ${active === 'both' ? 'is-active' : ''}" type="button" data-ov5-tab="both">Both</button>
          </div>
        </div>
        <section class="tcv5-panel is-active" data-ov5-panel="${active}">
          <div class="tcv5-panel-head">
            <strong>${title}</strong>
            <span class="muted small">${subtitle}</span>
            <div class="tcv17-overflow-actions">
              <button class="btn btn-xs" type="button" data-ov5-reset-shift="shift1">Скинути резерв S1</button>
              <button class="btn btn-xs" type="button" data-ov5-reset-shift="shift2">Скинути резерв S2</button>
              <button class="btn btn-xs" type="button" data-ov5-restore-import="1">Відновити з імпорту</button>
            </div>
          </div>
          ${items.length ? `
            <div class="helpers-table-wrap top-space tcv5-scroll-wrap" data-ov5-scroll-wrap="${active}">
              <table class="mini-table tower-calc-tier-table tcv5-table">
                <thead>
                  <tr>
                    <th>Нік</th><th>Альянс</th><th>Роль</th><th>Tier</th><th>March</th><th>Статус</th><th>Башня</th><th>Резерв</th><th>Дії</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map((r) => `
                    <tr>
                      <td>${esc(r.name)}</td>
                      <td>${esc(r.alliance)}</td>
                      <td>${esc(r.role)}</td>
                      <td>${esc(r.tier)}</td>
                      <td>${fm(r.march)}</td>
                      <td>${esc(r.status)}</td>
                      <td>${esc(r.tower)}</td>
                      <td>${r.reserve === 'shift1' ? '1 Shift' : r.reserve === 'shift2' ? '2 Shift' : '—'}</td>
                      <td>
                        <button class="btn btn-xs ${r.reserve === 'shift1' ? 'is-active' : ''}" type="button" data-ui-reserve-shift="shift1" data-player-id="${esc(r.id)}">1 Shift</button>
                        <button class="btn btn-xs ${r.reserve === 'shift2' ? 'is-active' : ''}" type="button" data-ui-reserve-shift="shift2" data-player-id="${esc(r.id)}">2 Shift</button>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>` : '<div class="tower-calc-placeholder muted small top-space">Порожньо</div>'}
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

  function toggleReserveCore(playerId, shiftKey) {
    const id = String(playerId || '');
    const sk = normalizeShift(shiftKey);
    if (!id || !['shift1', 'shift2'].includes(sk)) return false;

    const p = getPlayerById(id);
    if (!p) return false;

    const currentShift = normalizeShift(p?.shift || p?.shiftLabel || 'both');
    if (currentShift !== sk) {
      setPlayerShiftLive(p, sk);
      persistPlayersAfterShiftMove(`Гравця ${p.name || ''} переведено в ${sk === 'shift1' ? 'Shift 1' : 'Shift 2'}.`);
    }

    try { window.calcSetOverflowReserve?.(id, sk); } catch {}
    patchState({ overflowTab: sk });
    return true;
  }

  function install(root) {
    const calcRoot = root || getModal() || document;
    renderTopSummary(calcRoot);
    renderOverflowTabs(calcRoot);
    return true;
  }

  PNS.towerCalcReadUiState = readUiState;
  PNS.towerCalcWriteUiState = writeUiState;
  PNS.towerCalcPatchUiState = patchState;
  PNS.towerCalcNormalizeShift = normalizeShift;
  PNS.towerCalcGetPlayerById = getPlayerById;
  PNS.towerCalcGetModal = getModal;
  PNS.towerCalcFindShiftLimitInputs = findShiftLimitInputs;
  PNS.towerCalcFindWrappedLabel = findWrappedLabel;
  PNS.towerCalcGetLimitValue = getLimitValue;
  PNS.towerCalcGetAssignedHelperSets = getAssignedHelperSets;
  PNS.towerCalcGetLiveAssignedHelperSets = getLiveAssignedHelperSets;
  PNS.towerCalcCollectOverflowMap = collectOverflowMap;
  PNS.towerCalcCollectStats = collectStats;
  PNS.towerCalcRenderTopSummary = renderTopSummary;
  PNS.towerCalcRenderOverflowTabs = renderOverflowTabs;
  PNS.installTowerCalcSummaryUi = install;
  PNS.towerCalcGetOverflowRows = getOverflowRows;
  PNS.towerCalcReadOverflowReserveStorage = readOverflowReserveStorage;
  PNS.towerCalcWriteOverflowReserveStorage = writeOverflowReserveStorage;
  PNS.towerCalcResetOverflowReserveForShift = resetOverflowReserveForShift;
  PNS.towerCalcRestoreOverflowFromImport = restoreOverflowFromImport;
  PNS.towerCalcToggleReserveCore = toggleReserveCore;
})();
