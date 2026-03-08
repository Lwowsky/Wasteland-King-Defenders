(function () {
  'use strict';

  const MODAL_ID = 'towerCalcModal';
  const LS_KEY = 'pns_tower_calc_ui_patch_v21';
  let refreshTimer = 0;
  let applyModeTouched = false;

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
    return 90;
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
    return `<div class="tcv7-role-row">${
      item('is-fighter', stats.fighter, 'Fighter', 'fighter.png')
    }${
      item('is-rider', stats.rider, 'Rider', 'rider.png')
    }${
      item('is-shooter', stats.shooter, 'Shooter', 'shooter.png')
    }</div>`;
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

    box.innerHTML = `
      <div class="tcv7-grid">
        ${card('Shift 1', fm(s.shift1.total), 'усього гравців', shiftDetails(s.shift1), s.shift1, s.shift1.over > 0 ? `<div class="tcv7-warn">+${fm(s.shift1.over)} понад ліміт</div>` : '')}
        ${card('Shift 2', fm(s.shift2.total), 'усього гравців', shiftDetails(s.shift2), s.shift2, s.shift2.over > 0 ? `<div class="tcv7-warn">+${fm(s.shift2.over)} понад ліміт</div>` : '')}
        ${card('Both', fm(s.both.total), 'окремо від планування', `У башнях ${fm(s.both.inTowers)} · Резерв ${fm(s.both.reserve)}`, s.both, '')}
        ${card('Усього', fm(s.total), 'загальна кількість гравців', `У башнях ${fm(s.inTowersTotal)} · Резерв ${fm(s.reserveTotal)}${s.shortage > 0 ? ` · Нестача ${fm(s.shortage)}` : ''}`, null, '')}
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
    if (!['shift1', 'shift2'].includes(sk)) return;
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
    scheduleRefresh(40, true);
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
    scheduleRefresh(40, true);
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

  function ensureClearButtons(root) {
    const toolbar = q('.tower-calc-toolbar-main', root);
    if (!toolbar) return;
    const ensureBtn = (id, label) => {
      let btn = byId(id, root);
      if (!btn) {
        btn = document.createElement('button');
        btn.className = 'btn btn-sm';
        btn.type = 'button';
        btn.id = id;
        toolbar.appendChild(btn);
      }
      btn.textContent = label;
      return btn;
    };
    ensureBtn('towerCalcClearShift1Btn', 'Очистити Shift 1');
    ensureBtn('towerCalcClearShift2Btn', 'Очистити Shift 2');
    ensureBtn('towerCalcClearHelpersAllBtn', 'Очистити Shift 1 + 2');
  }

  function moveButtonsIntoOneRow(root) {
    const toolbarMain = q('.tower-calc-toolbar-main', root);
    if (!toolbarMain) return;
    toolbarMain.classList.add('tcv7-toolbar-main');
    ['towerCalcLoadCaptainsBtn', 'towerCalcApplyToTowersBtn', 'towerCalcQuickApplyBtn', 'towerCalcClearShift1Btn', 'towerCalcClearShift2Btn', 'towerCalcClearHelpersAllBtn'].forEach((id) => {
      const el = byId(id, root);
      if (el && el.parentElement !== toolbarMain) toolbarMain.appendChild(el);
    });
  }

  function moveApplyModeToToolbar(root) {
    const toolbar = q('.tower-calc-toolbar-main', root);
    const controls = q('.tower-calc-controls', root);
    if (!toolbar || !controls) return;

    const modeLabel = q('label:has(#towerCalcModeUi)', controls) || (byId('towerCalcModeUi', controls)?.closest('label'));
    if (modeLabel) modeLabel.style.display = 'none';

    const hint = qa('.muted', controls).find((el) => /UI skeleton|логіка режимів/i.test(txt(el)));
    if (hint) hint.style.display = 'none';

    const applySelect = byId('towerCalcApplyModeUi', controls) || byId('towerCalcApplyModeUi', root);
    const applyLabel = q('label:has(#towerCalcApplyModeUi)', controls) || applySelect?.closest('label') || null;
    if (!applySelect) return;

    let wrap = q('#tcv18ApplyModeWrap', root);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'tcv18ApplyModeWrap';
      wrap.className = 'tcv18-apply-wrap';
      toolbar.appendChild(wrap);
    }

    let ph = q('.tcv19-apply-placeholder', wrap);
    if (!ph) {
      ph = document.createElement('span');
      ph.className = 'tcv19-apply-placeholder';
      ph.textContent = 'Застосування';
      wrap.appendChild(ph);
    }

    if (applySelect.parentElement !== wrap) wrap.insertBefore(applySelect, ph);
    if (applyLabel) applyLabel.style.display = 'none';
    applySelect.classList.add('tcv18-apply-select');
    wrap.classList.toggle('is-placeholder', !applyModeTouched);

    if (!applySelect.dataset.tcv19Bound) {
      applySelect.dataset.tcv19Bound = '1';
      applySelect.addEventListener('change', () => {
        applyModeTouched = true;
        wrap.classList.remove('is-placeholder');
      });
    }
  }

  function wrapComputeForCaptainCrossShift() {
    const orig = window.computeTowerCalcResults;
    if (typeof orig !== 'function' || orig.__tcv19Wrapped) return;
    const wrapped = function (...args) {
      const restore = [];
      try {
        const tc = window.getCalcState?.() || {};
        const caps1 = new Set((Array.isArray(tc.shift1) ? tc.shift1 : []).map((r) => String(r?.captainId || '')).filter(Boolean));
        const caps2 = new Set((Array.isArray(tc.shift2) ? tc.shift2 : []).map((r) => String(r?.captainId || '')).filter(Boolean));
        const all = new Set([...caps1, ...caps2]);
        all.forEach((id) => {
          const p = getPlayerById(id);
          if (!p) return;
          const in1 = caps1.has(id);
          const in2 = caps2.has(id);
          if ((in1 && in2) || (!in1 && !in2)) return;
          const target = 'both';
          restore.push([p, p.shift, p.shiftLabel, p.rowEl?.dataset?.shift || '']);
          p.shift = target;
          p.shiftLabel = 'Both';
          if (p.rowEl) {
            p.rowEl.dataset.shift = target;
            const cell = p.rowEl.querySelector('td[data-field="shiftLabel"]');
            if (cell) cell.textContent = p.shiftLabel;
          }
        });
      } catch {}
      try {
        return orig.apply(this, args);
      } finally {
        for (const item of restore) {
          const [p, shift, shiftLabel, ds] = item;
          try {
            p.shift = shift;
            p.shiftLabel = shiftLabel;
            if (p.rowEl) {
              p.rowEl.dataset.shift = ds || normalizeShift(shift || shiftLabel || 'both');
              const cell = p.rowEl.querySelector('td[data-field="shiftLabel"]');
              if (cell) cell.textContent = shiftLabel || (normalizeShift(shift || 'both') === 'shift1' ? 'Shift 1' : normalizeShift(shift || 'both') === 'shift2' ? 'Shift 2' : 'Both');
            }
          } catch {}
        }
      }
    };
    wrapped.__tcv19Wrapped = true;
    wrapped.__tcv19Original = orig;
    window.computeTowerCalcResults = wrapped;
    try { if (window.PNS?.ModalsShift) window.PNS.ModalsShift.computeTowerCalcResults = wrapped; } catch {}
  }

  function enableCaptainCrossShiftAssignment() {
    const PNS = window.PNS;
    const state = PNS?.state || {};

    const origOther = PNS?.isPlayerUsedInOtherShift;
    if (typeof origOther === 'function' && !origOther.__tcv20Wrapped) {
      const wrappedOther = function (playerId, currentShift) {
        const hit = origOther.call(this, playerId, currentShift);
        if (hit && String(hit?.assignment?.kind || '').toLowerCase() === 'captain') return null;
        return hit;
      };
      wrappedOther.__tcv20Wrapped = true;
      wrappedOther.__tcv20Original = origOther;
      PNS.isPlayerUsedInOtherShift = wrappedOther;
    }

    const origAssign = PNS?.assignPlayerToBase;
    if (typeof origAssign === 'function' && !origAssign.__tcv20Wrapped) {
      const wrappedAssign = function (playerId, baseId, kind) {
        if (String(kind || '') !== 'helper') return origAssign.apply(this, arguments);
        const player = state?.playerById?.get?.(playerId);
        const base = state?.baseById?.get?.(baseId);
        if (!player || !base) return origAssign.apply(this, arguments);

        let restore = null;
        try {
          const activeShift = String(state.activeShift || '').toLowerCase();
          const otherUse = (typeof PNS.isPlayerUsedInOtherShift === 'function') ? PNS.isPlayerUsedInOtherShift(playerId, activeShift) : null;
          const allowAsCrossShiftCaptain = !!(otherUse && String(otherUse?.assignment?.kind || '').toLowerCase() === 'captain');
          const playerShift = normalizeShift(player.shift || player.shiftLabel || 'both');
          const baseShift = normalizeShift(base.shift || activeShift || 'both');

          if (allowAsCrossShiftCaptain && baseShift !== 'both' && playerShift !== 'both' && playerShift !== baseShift) {
            restore = [player.shift, player.shiftLabel, player.rowEl?.dataset?.shift || ''];
            player.shift = 'both';
            player.shiftLabel = 'Both';
            if (player.rowEl) {
              player.rowEl.dataset.shift = 'both';
              const cell = player.rowEl.querySelector('td[data-field="shiftLabel"]');
              if (cell) cell.textContent = 'Both';
            }
          }
          return origAssign.apply(this, arguments);
        } finally {
          if (restore) {
            const [shift, shiftLabel, ds] = restore;
            try {
              player.shift = shift;
              player.shiftLabel = shiftLabel;
              if (player.rowEl) {
                player.rowEl.dataset.shift = ds || normalizeShift(shift || shiftLabel || 'both');
                const cell = player.rowEl.querySelector('td[data-field="shiftLabel"]');
                if (cell) cell.textContent = shiftLabel || (normalizeShift(shift || 'both') === 'shift1' ? 'Shift 1' : normalizeShift(shift || 'both') === 'shift2' ? 'Shift 2' : 'Both');
              }
            } catch {}
          }
        }
      };
      wrappedAssign.__tcv20Wrapped = true;
      wrappedAssign.__tcv20Original = origAssign;
      PNS.assignPlayerToBase = wrappedAssign;
    }
  }

  function hideAndTranslate(root) {
    const hide = (sel) => { const el = q(sel, root); if (el) el.style.display = 'none'; };
    hide('#split5050Btn');
    hide('#towerCalcApplyAndAssignBtn');
    hide('#towerCalcRecalcBtn');
    hide('#towerCalcFitBtn');
    hide('#towerCalcAutoFitBtn');

    const bothLabel = q('#towerCalcBoth50', root)?.closest('label');
    if (bothLabel) bothLabel.style.display = 'none';
    const ignoreLabel = q('#towerCalcIgnoreBoth', root)?.closest('label');
    if (ignoreLabel) ignoreLabel.style.display = 'none';
    const forceLabel = q('#shiftSplitForceChk', root)?.closest('label');
    if (forceLabel) forceLabel.style.display = 'none';

    const loadBtn = q('#towerCalcLoadCaptainsBtn', root);
    if (loadBtn) loadBtn.textContent = 'Підтягнути капітанів з башень';
    const applyBtn = q('#towerCalcApplyToTowersBtn', root);
    if (applyBtn) applyBtn.textContent = 'Застосувати ліміти';
    const quickBtn = q('#towerCalcQuickApplyBtn', root);
    if (quickBtn) quickBtn.textContent = 'Автозаповнення башень';

    const adv = q('#towerCalcAdvanced summary', root);
    if (adv) adv.textContent = 'Параметри розподілу і ліміти';

    const modeSel = q('#towerCalcModeUi', root);
    if (modeSel) {
      const map = { assisted: 'Підказки', auto: 'Авто', manual: 'Ручний' };
      qa('option', modeSel).forEach((o) => { o.textContent = map[o.value] || o.textContent; });
    }
    const applyMode = q('#towerCalcApplyModeUi', root);
    if (applyMode) {
      const map = { topup: 'Лише дозаповнення', empty: 'Лише порожні', rebalance: 'Повний перерозподіл' };
      qa('option', applyMode).forEach((o) => { o.textContent = map[o.value] || o.textContent; });
    }

    qa('.muted.small', root).forEach((el) => {
      const t = txt(el);
      if (/UI skeleton/i.test(t)) el.style.display = 'none';
      if (/Auto slots =|helper-slots/i.test(t)) {
        el.textContent = 'Автослоти = швидкий розподіл helper-слотів по башнях за кількістю гравців без капітанів.';
      }
      if (/Порада:|Порахувати/i.test(t)) {
        el.textContent = 'Спочатку вистав ліміти shift-ів і башень, потім використай “Застосувати ліміти” або “Автозаповнення башень”.';
      }
      if (/Ліміти зміщень:/i.test(t)) {
        el.style.display = 'none';
      }
    });
  }

  function mergeStatsIntoAdvanced(root) {
    const advanced = q('#towerCalcAdvanced', root);
    const inner = advanced?.querySelector('.inner') || advanced;
    const balance = q('#towerCalcShiftBalance', root);
    if (!advanced || !inner || !balance) return;
    if (!inner.contains(balance)) inner.appendChild(balance);
  }

  function enforceIgnoreBoth(root) {
    const ig = q('#towerCalcIgnoreBoth', root);
    if (!ig) return;
    const changed = !ig.checked;
    ig.checked = true;
    ig.disabled = true;
    const label = ig.closest('label');
    if (label) label.style.display = 'none';
    if (changed) {
      try { ig.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
    }
  }

  function layoutAdvancedColumns(root) {
    const advanced = q('#towerCalcAdvanced', root);
    const inner = advanced?.querySelector('.inner') || advanced;
    const balance = q('#towerCalcShiftBalance', root);
    if (!advanced || !inner || !balance) return;

    const controls = q('.tower-calc-controls', advanced);
    const tierHintRows = qa('.muted.small', advanced).filter((el) => /Спочатку вистав|Порада:|Tier-size|Розмір tier/i.test(txt(el)));
    const tip = tierHintRows.find((el) => /Спочатку вистав|Порада:/i.test(txt(el))) || null;
    const tierRow = q('#towerCalcTierTargetRow', advanced)?.closest('.muted.small') || tierHintRows.find((el) => /Розмір tier/i.test(txt(el))) || null;

    let wrap = q('#tcv7AdvancedTopLayout', advanced);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'tcv7AdvancedTopLayout';
      wrap.className = 'tcv7-advanced-layout';
      inner.insertBefore(wrap, balance);
    }
    let left = q('#tcv7AdvancedLeft', wrap);
    if (!left) {
      left = document.createElement('section');
      left.id = 'tcv7AdvancedLeft';
      left.className = 'tcv7-advanced-left';
      wrap.appendChild(left);
    }
    let right = q('#tcv7AdvancedRight', wrap);
    if (!right) {
      right = document.createElement('section');
      right.id = 'tcv7AdvancedRight';
      right.className = 'tcv7-advanced-right';
      wrap.appendChild(right);
    }

    let leftPanel = q('#tcv9LeftPanel', left);
    if (!leftPanel) {
      leftPanel = document.createElement('div');
      leftPanel.id = 'tcv9LeftPanel';
      leftPanel.className = 'tcv9-left-panel';
      left.appendChild(leftPanel);
    }
    let compactControls = q('#tcv9CompactControls', leftPanel);
    if (!compactControls) {
      compactControls = document.createElement('div');
      compactControls.id = 'tcv9CompactControls';
      compactControls.className = 'tcv9-compact-controls';
      leftPanel.appendChild(compactControls);
    }
    let tierPanel = q('#tcv9TierPanel', leftPanel);
    if (!tierPanel) {
      tierPanel = document.createElement('div');
      tierPanel.id = 'tcv9TierPanel';
      tierPanel.className = 'tcv9-tier-panel';
      leftPanel.appendChild(tierPanel);
    }

    const summary = q('summary', advanced);
    if (summary) summary.textContent = 'Параметри розподілу і ліміти';

    if (controls && controls.parentElement !== compactControls) compactControls.appendChild(controls);
    if (tierRow && tierRow.parentElement !== tierPanel) tierPanel.appendChild(tierRow);
    if (tip && tip.parentElement !== tierPanel) tierPanel.appendChild(tip);
    if (balance && balance.parentElement !== right) right.appendChild(balance);

    left.classList.add('tcv9-left-col');
    right.classList.add('tcv9-right-col');

    qa('.muted.small', advanced).forEach((el) => {
      if (el !== tierRow && el !== tip && el.closest('#tcv9TierPanel')) return;
      if (/Tier-size|Розмір tier/i.test(txt(el)) && el !== tierRow) el.style.display = 'none';
    });
  }

  function ensureManualLimitToggle(root) {
    const balance = q('#towerCalcShiftBalance', root);
    if (!balance) return;
    let row = q('#tcv5LimitEditRow', balance);
    if (!row) {
      row = document.createElement('div');
      row.id = 'tcv5LimitEditRow';
      row.className = 'tcv5-limit-edit-row';
      row.innerHTML = '<label class="tcv5-limit-toggle"><input id="tcv5EnableShiftLimits" type="checkbox" /><span>Редагувати ліміти вручну</span></label>';
      const controls = q('.tower-calc-shift-controls', balance);
      if (controls) balance.insertBefore(row, controls);
      else balance.appendChild(row);
    }
    const check = q('#tcv5EnableShiftLimits', balance);
    if (check) check.checked = !!readUiState().manualLimitEdit;
    syncLimitEditability(root);
  }

  function syncLimitEditability(root) {
    const { shift1, shift2 } = findShiftLimitInputs(root);
    const enabled = !!readUiState().manualLimitEdit;
    [shift1, shift2].forEach((el) => {
      if (!el) return;
      el.disabled = !enabled;
      el.classList.toggle('tcv7-disabled-input', !enabled);
      const label = el.closest('label');
      if (label) label.classList.toggle('is-disabled', !enabled);
    });
  }

  
function restyleShiftControls(root) {
    const balance = q('#towerCalcShiftBalance', root);
    if (!balance) return;
    balance.classList.add('tcv7-shift-balance');
    const controls = q('.tower-calc-shift-controls', balance);
    const left = q('.tower-calc-shift-controls-left', balance);
    const right = q('.tower-calc-shift-controls-right', balance);
    if (!controls || !left || !right) return;

    controls.classList.add('tcv14-single-card');
    if (left.parentElement !== controls) controls.appendChild(left);
    if (right.parentElement !== controls) controls.appendChild(right);

    left.classList.add('tcv7-shift-left');
    right.classList.add('tcv7-shift-right');

    const limitEditRow = q('#tcv5LimitEditRow', balance);
    let topRow = q('#tcv14TopRow', left);
    if (!topRow) {
      topRow = document.createElement('div');
      topRow.id = 'tcv14TopRow';
      topRow.className = 'tcv14-top-row';
      left.prepend(topRow);
    }

    let limitRow = q('#tcv14LimitRow', left);
    if (!limitRow) {
      limitRow = document.createElement('div');
      limitRow.id = 'tcv14LimitRow';
      limitRow.className = 'tcv7-form-row tcv7-form-row-2';
      left.appendChild(limitRow);
    }

    let addRow = q('#tcv14AddRow', left);
    if (!addRow) {
      addRow = document.createElement('div');
      addRow.id = 'tcv14AddRow';
      addRow.className = 'tcv7-form-row tcv7-form-row-2';
      left.appendChild(addRow);
    }

    let btnRow = q('#tcv14BtnRow', left);
    if (!btnRow) {
      btnRow = document.createElement('div');
      btnRow.id = 'tcv14BtnRow';
      btnRow.className = 'tcv7-btn-row tcv14-btn-row';
      left.appendChild(btnRow);
    }

    const limits = findShiftLimitInputs(root);
    const limit1Label = limits.shift1?.closest('label') || null;
    const limit2Label = limits.shift2?.closest('label') || null;
    const add1Label = findWrappedLabel(balance, 'shiftAddS1');
    const add2Label = findWrappedLabel(balance, 'shiftAddS2');
    const applyBtn = byId('applyShiftAddBtn', balance);
    const restoreBtn = byId('towerCalcRestoreImportShiftsBtn', balance)
      || byId('restoreShiftImportBtn', balance)
      || qa('#towerCalcShiftBalance .btn', root).find((el) => /відновити\s+з\s+імпорту/i.test(txt(el)))
      || q('#towerCalcShiftBalance .btn[id*="Restore"]', root)
      || q('#towerCalcShiftBalance .btn[id*="restore"]', root);
    const forceLabel = q('.tower-calc-shift-force', balance);
    const autos = q('.tower-calc-autoslots', balance) || q('.tower-calc-autoslots', right);

    if (limitEditRow && limitEditRow.parentElement !== topRow) topRow.appendChild(limitEditRow);
    if (limitEditRow) limitEditRow.style.display = 'flex';

    [limit1Label, limit2Label].filter(Boolean).forEach((el) => { if (el.parentElement !== limitRow) limitRow.appendChild(el); });
    [add1Label, add2Label].filter(Boolean).forEach((el) => { if (el.parentElement !== addRow) addRow.appendChild(el); });

    qa('#towerCalcShiftBalance .btn', root).forEach((el) => {
      if (el !== restoreBtn && /відновити\s+з\s+імпорту/i.test(txt(el))) el.style.display = 'none';
    });
    [applyBtn, restoreBtn].filter(Boolean).forEach((el) => { if (el.parentElement !== btnRow) btnRow.appendChild(el); });
    if (applyBtn) applyBtn.style.display = '';
    if (restoreBtn) restoreBtn.style.display = '';

    if (autos && autos.parentElement !== topRow) topRow.appendChild(autos);
    if (autos) autos.classList.add('tcv14-autos-inline');

    if (forceLabel) forceLabel.style.display = 'none';
    right.style.display = 'none';
  }

  function clearHelpers(mode) {
    const PNS = window.PNS;
    const MS = PNS?.ModalsShift || {};
    const state = PNS?.state;
    if (!state) return;

    const persistPlans = () => {
      try {
        const KEY = 'pns_layout_shift_plans_store_v1';
        localStorage.setItem(KEY, JSON.stringify({
          shift1: state.shiftPlans?.shift1 || null,
          shift2: state.shiftPlans?.shift2 || null,
        }));
      } catch {}
    };

    const clearPlanForShift = (shiftKey) => {
      if (!['shift1', 'shift2'].includes(String(shiftKey || ''))) return;
      try { MS.saveCurrentShiftPlanSnapshot?.(); } catch {}
      state.shiftPlans = state.shiftPlans || {};
      const plan = (state.shiftPlans[shiftKey] && typeof state.shiftPlans[shiftKey] === 'object')
        ? state.shiftPlans[shiftKey]
        : (typeof MS.snapshotShiftPlan === 'function' ? MS.snapshotShiftPlan() : { players: {}, bases: {} });

      plan.players = (plan.players && typeof plan.players === 'object') ? plan.players : {};
      plan.bases = (plan.bases && typeof plan.bases === 'object') ? plan.bases : {};

      const active = String(state.activeShift || '') === shiftKey;

      if (active) {
        const liveBases = Array.isArray(state.bases) ? state.bases : [];
        for (const base of liveBases) {
          const baseId = String(base?.id || '');
          if (!baseId) continue;
          const helperIds = Array.isArray(base?.helperIds) ? base.helperIds.slice() : [];
          if (helperIds.length && typeof PNS.clearBaseAssignments === 'function') {
            try { PNS.clearBaseAssignments(baseId, true); } catch {}
          } else {
            base.helperIds = [];
          }
          const snap = (plan.bases[baseId] && typeof plan.bases[baseId] === 'object') ? plan.bases[baseId] : (plan.bases[baseId] = {});
          const removed = Array.isArray(snap.helperIds) ? snap.helperIds.slice() : helperIds;
          snap.helperIds = [];
          for (const pid of removed) {
            const id = String(pid || '');
            if (!id) continue;
            if (plan.players[id]?.baseId === baseId && plan.players[id]?.kind === 'helper') plan.players[id] = null;
          }
        }
        try { MS.saveCurrentShiftPlanSnapshot?.(); } catch {}
      } else {
        const basesObj = plan.bases || {};
        for (const [baseId, snap0] of Object.entries(basesObj)) {
          const snap = (snap0 && typeof snap0 === 'object') ? snap0 : (basesObj[baseId] = {});
          const removed = Array.isArray(snap.helperIds) ? snap.helperIds.slice() : [];
          snap.helperIds = [];
          for (const pid of removed) {
            const id = String(pid || '');
            if (!id) continue;
            if (plan.players[id]?.baseId === String(baseId) && plan.players[id]?.kind === 'helper') plan.players[id] = null;
          }
        }
        state.shiftPlans[shiftKey] = plan;
        persistPlans();
      }
    };

    if (mode === 'all') {
      clearPlanForShift('shift1');
      clearPlanForShift('shift2');
    } else {
      clearPlanForShift(mode);
    }

    try { PNS.renderAll?.(); } catch {}
    try { window.computeTowerCalcResults?.(); } catch {}
    try {
      const msg = mode === 'all'
        ? 'Очищено helper-ів у Shift 1 і Shift 2. Капітани залишилися.'
        : `Очищено helper-ів: ${mode === 'shift1' ? 'Shift 1' : 'Shift 2'}. Капітани залишилися.`;
      PNS.setImportStatus?.(msg, 'good');
    } catch {}
  }

  function toggleReserve(playerId, shiftKey) {
    const id = String(playerId || '');
    const sk = normalizeShift(shiftKey);
    if (!id || !['shift1', 'shift2'].includes(sk)) return;

    const p = getPlayerById(id);
    if (!p) return;

    const currentShift = normalizeShift(p?.shift || p?.shiftLabel || 'both');
    let reserveLs = {};
    try { reserveLs = JSON.parse(localStorage.getItem('pns_tower_calc_state') || '{}') || {}; } catch {}
    const currentReserve = String((reserveLs?.overflowReserve || {})[id] || '');

    if (currentShift !== sk) {
      setPlayerShiftLive(p, sk);
      persistPlayersAfterShiftMove(`Гравця ${p.name || ''} переведено в ${sk === 'shift1' ? 'Shift 1' : 'Shift 2'}.`);
    }

    try { window.calcSetOverflowReserve?.(id, sk); } catch {}
    patchState({ overflowTab: sk });
    scheduleRefresh(30, true);
    setTimeout(() => patchModal(), 90);
    setTimeout(() => patchModal(), 220);
  }

  function scheduleRefresh(delay, doCompute) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      try { if (doCompute !== false) window.computeTowerCalcResults?.(); } catch {}
      patchModal();
    }, delay == null ? 80 : delay);
  }

  function patchModal() {
    injectStyles();
    const root = getModal();
    if (!root) return;
    mergeStatsIntoAdvanced(root);
    enforceIgnoreBoth(root);
    ensureClearButtons(root);
    moveButtonsIntoOneRow(root);
    moveApplyModeToToolbar(root);
    hideAndTranslate(root);
    layoutAdvancedColumns(root);
    ensureManualLimitToggle(root);
    restyleShiftControls(root);
    renderTopSummary(root);
    renderOverflowTabs(root);
  }

  function bindEvents() {
    if (document.documentElement.dataset.towerCalcUiPatchV21Bound === '1') return;
    document.documentElement.dataset.towerCalcUiPatchV21Bound = '1';

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ov5-tab]');
      if (!btn) return;
      patchState({ overflowTab: btn.dataset.ov5Tab });
      patchModal();
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ov5-reset-shift]');
      if (!btn) return;
      e.preventDefault();
      resetOverflowReserveForShift(btn.dataset.ov5ResetShift);
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ov5-restore-import]');
      if (!btn) return;
      e.preventDefault();
      restoreOverflowFromImport();
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ui-reserve-shift]');
      if (!btn) return;
      e.preventDefault();
      toggleReserve(btn.dataset.playerId, btn.dataset.uiReserveShift);
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#towerCalcClearShift1Btn,#towerCalcClearShift2Btn,#towerCalcClearHelpersAllBtn');
      if (!btn) return;
      e.preventDefault();
      if (btn.id === 'towerCalcClearShift1Btn') clearHelpers('shift1');
      else if (btn.id === 'towerCalcClearShift2Btn') clearHelpers('shift2');
      else clearHelpers('all');
      scheduleRefresh(40, true);
    });

    document.addEventListener('change', (e) => {
      const en = e.target.closest('#tcv5EnableShiftLimits');
      if (en) {
        patchState({ manualLimitEdit: !!en.checked });
        syncLimitEditability(getModal() || document);
        patchModal();
        return;
      }

      const root = getModal();
      if (!root || !root.contains(e.target)) return;
      if (e.target.closest('select,input,textarea')) scheduleRefresh(100, true);
    });

    document.addEventListener('click', (e) => {
      const root = getModal();
      if (!root) return;
      const target = e.target.closest('#towerCalcLoadCaptainsBtn,#towerCalcApplyToTowersBtn,#towerCalcQuickApplyBtn,#towerCalcAutoSlotsS1Btn,#towerCalcAutoSlotsS2Btn,#towerCalcRestoreImportShiftsBtn,#applyShiftAddBtn,[data-calc-main-tab],[data-calc-tab],[data-calc-open-base],[data-calc-pick-overflow-base],[data-calc-toggle-exclude],[data-calc-reserve]');
      if (!target) return;
      scheduleRefresh(80, true);
      setTimeout(() => patchModal(), 160);
    });

    document.addEventListener('players-table-rendered', () => scheduleRefresh(80, false));
    document.addEventListener('pns:assignment-changed', () => scheduleRefresh(40, true));
    document.addEventListener('pns:dom:refreshed', () => scheduleRefresh(80, false));
    window.addEventListener('resize', () => scheduleRefresh(40, false), { passive: true });
  }

  function observeOpenOnly() {
    const root = getModal();
    if (!root || root.dataset.tcUiPatchV21Observed === '1') return;
    root.dataset.tcUiPatchV21Observed = '1';
    const mo = new MutationObserver(() => {
      const isOpen = root.classList.contains('is-open') || root.offsetParent !== null;
      if (isOpen) {
        patchModal();
        setTimeout(() => patchModal(), 50);
        setTimeout(() => patchModal(), 180);
        setTimeout(() => patchModal(), 420);
      }
    });
    mo.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  function injectStyles() {
    if (byId('towerCalcUiPatchV21Style')) return;

    const style = document.createElement('style');
    style.id = 'towerCalcUiPatchV21Style';
    style.textContent = `
      #towerCalcTopShiftSummaryV7{margin:0 0 14px 0;padding:16px 18px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:rgba(255,255,255,.02)}
      #towerCalcTopShiftSummaryV7 .tcv7-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      #towerCalcTopShiftSummaryV7 .tcv7-card{padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:rgba(5,10,30,.22);display:block}
      #towerCalcTopShiftSummaryV7 .tcv7-card-head{font-size:14px;opacity:.88;text-align:center}
      #towerCalcTopShiftSummaryV7 .tcv7-card-value{font-size:38px;font-weight:800;line-height:1.05;text-align:center}
      #towerCalcTopShiftSummaryV7 .tcv7-card-kicker{margin-top:6px;font-size:13px;opacity:.82;text-align:center}
      #towerCalcTopShiftSummaryV7 .tcv7-card-bottom{margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);font-size:12px;opacity:.72;text-align:center}
      #towerCalcTopShiftSummaryV7 .tcv7-role-row{display:flex;justify-content:center;align-items:flex-end;gap:28px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)}
      #towerCalcTopShiftSummaryV7 .tcv7-role-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;font-size:18px;font-weight:700;min-width:74px;text-align:center}
      #towerCalcTopShiftSummaryV7 .tcv7-role-icon{display:inline-flex;align-items:center;justify-content:center;width:96px;height:96px;border:none;background:none;box-shadow:none;padding:0;flex:0 0 96px}
      #towerCalcTopShiftSummaryV7 .tcv7-role-icon img{display:block;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(0,0,0,.55))}
      #towerCalcTopShiftSummaryV7 .tcv7-warn{margin-top:8px;font-size:12px;color:#fca5a5}

      #${MODAL_ID} .tower-calc-toolbar-main.tcv5-toolbar-main,
      #${MODAL_ID} .tower-calc-toolbar-main.tcv7-toolbar-main{display:flex !important;gap:8px;flex-wrap:nowrap;overflow:auto;padding-bottom:2px}
      #${MODAL_ID} .tower-calc-toolbar-main.tcv5-toolbar-main > .btn,
      #${MODAL_ID} .tower-calc-toolbar-main.tcv7-toolbar-main > .btn{white-space:nowrap;flex:0 0 auto}
      #towerCalcClearShift1Btn,#towerCalcClearShift2Btn,#towerCalcClearHelpersAllBtn{white-space:nowrap;flex:0 0 auto}
      #tcv18ApplyModeWrap{display:inline-flex;align-items:center;flex:0 0 auto;margin-left:4px}
      #tcv18ApplyModeWrap{position:relative;display:flex;align-items:center;min-width:190px}
      #tcv18ApplyModeWrap .tcv18-apply-select{min-width:190px;height:40px}
      #tcv18ApplyModeWrap .tcv19-apply-placeholder{display:none;position:absolute;left:14px;right:36px;top:4px;bottom:4px;pointer-events:none;align-items:center;justify-content:flex-start;background:rgba(6,15,45,.96);border-radius:12px;color:rgba(255,255,255,.9);font-size:14px;line-height:32px;padding:0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #tcv18ApplyModeWrap.is-placeholder .tcv19-apply-placeholder{display:flex}
      #tcv18ApplyModeWrap.is-placeholder .tcv18-apply-select{color:transparent !important;-webkit-text-fill-color:transparent;text-shadow:none}
      #tcv18ApplyModeWrap.is-placeholder .tcv18-apply-select option{color:#fff;-webkit-text-fill-color:#fff}

      #towerCalcAdvanced > summary,#towerCalcAdvanced summary{display:block;width:100%;box-sizing:border-box}

      #towerCalcAdvanced .inner > #tcv7AdvancedTopLayout{margin-top:14px;margin-bottom:14px;display:grid;grid-template-columns:minmax(320px,1fr) minmax(360px,1fr);gap:18px;align-items:start}
      #tcv7AdvancedTopLayout .tcv9-left-panel,
      #tcv7AdvancedTopLayout .tcv9-right-col > #towerCalcShiftBalance{padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:rgba(255,255,255,.02)}
      #tcv7AdvancedTopLayout .tcv9-left-panel{display:flex;flex-direction:column;gap:14px}
      #tcv7AdvancedTopLayout .tcv9-compact-controls{padding:12px 14px;border:1px solid rgba(255,255,255,.06);border-radius:16px;background:rgba(255,255,255,.015)}
      #tcv7AdvancedTopLayout .tcv9-tier-panel{padding:12px 14px;border:1px solid rgba(255,255,255,.06);border-radius:16px;background:rgba(255,255,255,.015)}
      #tcv7AdvancedTopLayout .tcv9-tier-panel .muted.small{margin-top:0;font-size:14px;line-height:1.45}
      #tcv7AdvancedTopLayout .tcv9-compact-controls .tower-calc-controls{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center}
      #tcv7AdvancedTopLayout .tcv9-compact-controls .tower-calc-controls label{display:inline-flex;align-items:center;gap:8px;font-size:13px;line-height:1.25;white-space:nowrap}
      #tcv7AdvancedTopLayout .tcv9-compact-controls .tower-calc-controls input[type="number"]{width:84px;min-width:84px}
      #tcv7AdvancedTopLayout .tcv9-compact-controls .tower-calc-controls{font-size:13px}
      #tcv7AdvancedTopLayout .tcv9-compact-controls .tower-calc-controls .btn, #tcv7AdvancedTopLayout .tcv9-compact-controls .tower-calc-controls button{font-size:12px}
      #tcv7AdvancedTopLayout .tcv9-compact-controls .btn{display:none !important}
      #towerCalcAdvanced .inner > #towerCalcShiftBalance{margin-top:0;padding-top:0;border-top:0}
      #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-shift-controls{display:block}
      #towerCalcShiftBalance.tcv7-shift-balance .tcv7-side-card{padding:0;border:0;border-radius:0;background:transparent}
      #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-shift-controls-left{display:flex;flex-direction:column;gap:14px;align-items:stretch}
      #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-shift-controls-right{display:none !important}
      #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-shift-controls-left label,
      #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-shift-controls-right label{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
      #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-shift-controls-left input[type="number"]{width:100%}
      #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-shift-controls-right .muted.small{margin-top:0}
      #towerCalcShiftBalance.tcv7-shift-balance .tcv7-form-row{display:grid;gap:12px}
      #towerCalcShiftBalance.tcv7-shift-balance .tcv7-form-row-2{grid-template-columns:repeat(2,minmax(0,1fr))}
      #towerCalcShiftBalance.tcv7-shift-balance #tcv14TopRow{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:nowrap;order:-1}
      #towerCalcShiftBalance.tcv7-shift-balance .tcv5-limit-edit-row,
      #towerCalcShiftBalance.tcv7-shift-balance #tcv5LimitEditRow{display:flex !important;align-items:center;gap:10px;flex-wrap:nowrap;margin:0}
      #towerCalcShiftBalance.tcv7-shift-balance label.tcv5-limit-toggle{display:flex !important;flex-direction:row !important;align-items:center !important;justify-content:flex-start !important;gap:10px;font-size:14px;white-space:nowrap;line-height:1.2;margin:0}
      #towerCalcShiftBalance.tcv7-shift-balance label.tcv5-limit-toggle input{width:18px;height:18px;accent-color:#3b82f6;flex:0 0 18px;margin:0}#towerCalcShiftBalance.tcv7-shift-balance label.tcv5-limit-toggle span{display:inline-block}
      #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-ignore-both{display:none !important}
      #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-shift-force{display:none !important}
      #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-autoslots,
      #towerCalcShiftBalance.tcv7-shift-balance .tcv14-autos-inline{display:flex !important;gap:8px;flex-wrap:wrap;margin-left:auto}
      #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-shift-balance-head{display:none !important}
      #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-shift-cards{display:none !important}
      #towerCalcShiftBalance.tcv7-shift-balance .tcv14-btn-row{display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:stretch;margin-top:2px}
      #towerCalcShiftBalance.tcv7-shift-balance .tcv14-btn-row > .btn{min-width:0;width:100%}
      #towerCalcShiftBalance.tcv7-shift-balance .tcv7-disabled-input{opacity:.6;cursor:not-allowed}

      .tcv5-overflow-head,.tcv7-overflow-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
      .tcv5-overflow-head h3,.tcv7-overflow-head h3{margin:0}
      .tcv5-tabs,.tcv7-tabs{display:flex;gap:8px;flex-wrap:nowrap;overflow:auto}
      .tcv5-tabs .btn.is-active,.tcv5-table .btn.is-active,.tcv7-tabs .btn.is-active,.tcv7-table .btn.is-active{outline:1px solid rgba(147,197,253,.95);box-shadow:0 0 0 1px rgba(147,197,253,.18) inset}
      .tcv5-panel-head,.tcv7-panel-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px}
      .tcv17-overflow-actions{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}
      #towerCalcTopShiftSummaryV7 .tcv7-card-bottom{line-height:1.45}
      .tcv5-scroll-wrap,.tcv7-scroll-wrap{max-height:58vh;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable both-edges}
      .tcv5-table thead th,.tcv7-table thead th{position:sticky;top:0;z-index:1;background:rgba(10,18,45,.98)}
      .tcv5-table .btn,.tcv7-table .btn{white-space:nowrap}
      .tcv5-table td:last-child,.tcv7-table td:last-child{min-width:180px}

      @media (max-width: 1200px){
        #towerCalcTopShiftSummaryV7 .tcv7-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        #tcv7AdvancedTopLayout{grid-template-columns:1fr}
      }
      @media (max-width: 900px){
        #towerCalcAdvanced .inner > #tcv7AdvancedTopLayout{grid-template-columns:1fr}
        #towerCalcShiftBalance.tcv7-shift-balance #tcv14TopRow{flex-direction:row;align-items:center}
        #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-autoslots,
        #towerCalcShiftBalance.tcv7-shift-balance .tcv14-autos-inline{margin-left:0}
      }
      @media (max-width: 700px){
        #towerCalcTopShiftSummaryV7 .tcv7-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        #towerCalcTopShiftSummaryV7 .tcv7-card{padding:12px}
        #towerCalcTopShiftSummaryV7 .tcv7-card-head{font-size:13px}
        #towerCalcTopShiftSummaryV7 .tcv7-card-value{font-size:30px}
        #towerCalcTopShiftSummaryV7 .tcv7-card-kicker{font-size:12px}
        #towerCalcTopShiftSummaryV7 .tcv7-role-row{gap:12px;margin-top:10px;padding-top:8px}
        #towerCalcTopShiftSummaryV7 .tcv7-role-item{min-width:0;gap:4px;font-size:14px}
        #towerCalcTopShiftSummaryV7 .tcv7-role-icon{width:48px;height:48px;flex:0 0 48px}
        #towerCalcAdvanced .inner > #tcv7AdvancedTopLayout{gap:12px}
        #tcv7AdvancedTopLayout .tcv9-left-panel,
        #tcv7AdvancedTopLayout .tcv9-right-col > #towerCalcShiftBalance{padding:12px}
        #tcv7AdvancedTopLayout .tcv9-compact-controls,
        #tcv7AdvancedTopLayout .tcv9-tier-panel{padding:10px 12px}
        #towerCalcShiftBalance.tcv7-shift-balance .tcv7-form-row-2,
        #towerCalcShiftBalance.tcv7-shift-balance .tcv14-btn-row{grid-template-columns:1fr}
        #towerCalcShiftBalance.tcv7-shift-balance #tcv14TopRow{flex-direction:column;align-items:flex-start;gap:10px}
        #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-autoslots,
        #towerCalcShiftBalance.tcv7-shift-balance .tcv14-autos-inline{width:100%;margin-left:0}
        #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-autoslots .btn,
        #towerCalcShiftBalance.tcv7-shift-balance .tcv14-autos-inline .btn{flex:1 1 0}
        #${MODAL_ID} .tower-calc-toolbar-main.tcv5-toolbar-main,
        #${MODAL_ID} .tower-calc-toolbar-main.tcv7-toolbar-main{flex-wrap:nowrap;overflow:auto}
      }

      @media (max-width: 820px){
        #${MODAL_ID} .modal-card{width:min(100vw,100%);max-width:100vw;min-height:100dvh;border-radius:0}
        #${MODAL_ID} .modal-head{position:sticky;top:0;z-index:6;background:rgba(10,18,45,.98);backdrop-filter:blur(8px);padding-bottom:10px}
        #${MODAL_ID} .modal-grid{gap:8px !important}
        #${MODAL_ID} .tower-calc-main-tabs{display:flex;gap:8px;overflow:auto;flex-wrap:nowrap}
        #${MODAL_ID} .tower-calc-main-tabs .btn{white-space:nowrap;flex:0 0 auto}
        #${MODAL_ID} .tower-calc-controls{gap:10px !important}
        #${MODAL_ID} .tower-calc-controls select,
        #${MODAL_ID} .tower-calc-controls input[type="number"],
        #${MODAL_ID} .tower-calc-controls .btn{min-height:44px}
      }
      @media (max-width: 700px){
        #towerCalcShiftBalance.tcv7-shift-balance #tcv14TopRow{flex-direction:column;align-items:flex-start;gap:10px;flex-wrap:wrap}
        #towerCalcShiftBalance.tcv7-shift-balance .tcv5-limit-edit-row{width:100%}
        #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-autoslots,
        #towerCalcShiftBalance.tcv7-shift-balance .tcv14-autos-inline{width:100%;margin-left:0;justify-content:flex-start}
        #towerCalcShiftBalance.tcv7-shift-balance .tower-calc-autoslots .btn,
        #towerCalcShiftBalance.tcv7-shift-balance .tcv14-autos-inline .btn{flex:1 1 calc(50% - 6px)}
        .tcv5-scroll-wrap,.tcv7-scroll-wrap{max-height:none}
      }
      @media (max-width: 520px){
        #towerCalcTopShiftSummaryV7 .tcv7-grid{grid-template-columns:1fr}
        #towerCalcTopShiftSummaryV7 .tcv7-role-icon{width:40px;height:40px;flex:0 0 40px}
        #towerCalcTopShiftSummaryV7 .tcv7-role-row{gap:10px}
        #towerCalcShiftBalance.tcv7-shift-balance .tcv5-limit-edit-row,
        #towerCalcShiftBalance.tcv7-shift-balance #tcv5LimitEditRow{width:100%}
        #towerCalcShiftBalance.tcv7-shift-balance label.tcv5-limit-toggle{font-size:13px}
      }

    `;
    document.head.appendChild(style);
  }

  function boot() {
    wrapComputeForCaptainCrossShift();
    bindEvents();
    patchModal();
    observeOpenOnly();
    setTimeout(() => patchModal(), 40);
    setTimeout(() => patchModal(), 180);
    setTimeout(() => patchModal(), 420);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.patchTowerCalcUiV19 = patchModal;
})();
(function(){
  const HOTFIX_KEY = '__tcv22_hotfix__';
  if (window[HOTFIX_KEY]) return;
  window[HOTFIX_KEY] = true;

  let applyPicked = false;

  function q(sel, root=document){ try { return root.querySelector(sel); } catch { return null; } }
  function qa(sel, root=document){ try { return Array.from(root.querySelectorAll(sel)); } catch { return []; } }
  function normShift(v){
    const s = String(v || '').toLowerCase();
    if (s === 'shift1' || s === '1' || s === 's1') return 'shift1';
    if (s === 'shift2' || s === '2' || s === 's2') return 'shift2';
    return 'both';
  }

  function persistAfter(meta={}) {
    const PNS = window.PNS;
    const state = PNS?.state;
    if (!PNS || !state) return;
    try { PNS.savePlayersSnapshot?.(state.players); } catch {}
    try { PNS.saveTowersSnapshot?.(); } catch {}
    try { PNS.ModalsShift?.saveCurrentShiftPlanSnapshot?.(); } catch {}
    try { PNS.persistSessionStateSoon?.(10); } catch {}
    try { document.dispatchEvent(new CustomEvent('pns:assignment-changed', { detail: meta })); } catch {}
  }

  function helperMarchForBase(base, player) {
    const PNS = window.PNS;
    if (!player) return 0;
    try {
      if (typeof PNS?.getTowerEffectiveMarch === 'function') return Number(PNS.getTowerEffectiveMarch(base, player)) || 0;
    } catch {}
    return Number(player.march || 0) || 0;
  }

  function sameTroopOnlyEnabled() {
    const PNS = window.PNS;
    try {
      if (typeof PNS?.isTowerNoMixTroopsEnabled === 'function') return !!PNS.isTowerNoMixTroopsEnabled();
    } catch {}
    return true;
  }

  function noCrossShiftDupesEnabled() {
    const PNS = window.PNS;
    try {
      if (typeof PNS?.isTowerNoCrossShiftDupesEnabled === 'function') return !!PNS.isTowerNoCrossShiftDupesEnabled();
    } catch {}
    return true;
  }

  function getOtherShiftHit(playerId, currentShift) {
    const PNS = window.PNS;
    const MS = PNS?.ModalsShift || {};
    const cur = String(currentShift || PNS?.state?.activeShift || '').toLowerCase();
    const other = cur === 'shift1' ? 'shift2' : 'shift1';
    if (!(other === 'shift1' || other === 'shift2')) return null;
    try {
      const fn = PNS?.isPlayerUsedInShift || MS.isPlayerUsedInShift;
      if (typeof fn === 'function') return fn(playerId, other);
    } catch {}
    try {
      const fn = MS.isPlayerUsedInOtherShift || PNS?.isPlayerUsedInOtherShift;
      if (typeof fn === 'function') return fn(playerId, cur);
    } catch {}
    return null;
  }

  function installCrossShiftCaptainUsage() {
    const PNS = window.PNS;
    const MS = PNS?.ModalsShift || {};
    if (!PNS) return;

    const wrappedOther = function(playerId, currentShift) {
      const cur = String(currentShift || PNS?.state?.activeShift || '').toLowerCase();
      const other = cur === 'shift1' ? 'shift2' : 'shift1';
      const hit = getOtherShiftHit(playerId, cur);
      if (hit && String(hit?.assignment?.kind || '').toLowerCase() === 'captain') return null;
      return hit;
    };
    PNS.isPlayerUsedInOtherShift = wrappedOther;
    try { MS.isPlayerUsedInOtherShift = wrappedOther; } catch {}

    const origAssign = PNS.assignPlayerToBase;
    if (typeof origAssign === 'function' && !origAssign.__tcv22Wrapped) {
      const patched = function(playerId, baseId, kind) {
        if (String(kind || '').toLowerCase() !== 'helper') return origAssign.apply(this, arguments);
        const state = PNS.state || {};
        const player = state.playerById?.get?.(playerId);
        const base = state.baseById?.get?.(baseId);
        if (!player || !base) return origAssign.apply(this, arguments);

        const activeShift = String(state.activeShift || '').toLowerCase();
        const otherHit = getOtherShiftHit(playerId, activeShift);
        const isCaptainOtherShift = !!(otherHit && String(otherHit?.assignment?.kind || '').toLowerCase() === 'captain');

        if (!isCaptainOtherShift) return origAssign.apply(this, arguments);

        const playerShift = normShift(player.shift || player.shiftLabel || 'both');
        const baseShift = normShift(base.shift || activeShift || 'both');
        const ignoreShiftAutoFill = !!document.querySelector('#ignoreShiftAutoFillToggle:checked');

        // Власна валідація для кейсу "капітан в іншому shift як helper тут"
        let err = '';
        if (!PNS.ROLE_KEYS?.includes?.(player.role)) err = `Unknown role for ${player.name}.`;
        else if (!ignoreShiftAutoFill && baseShift !== 'both' && playerShift !== 'both' && playerShift !== baseShift) {
          // дозволяємо цей mismatch лише якщо він капітан в іншому shift
          err = '';
        }
        if (!err && !base.captainId) err = `Set a captain first for "${base.title}".`;
        const effectiveRole = (typeof PNS.getBaseRole === 'function') ? PNS.getBaseRole(base) : null;
        if (!err && sameTroopOnlyEnabled() && effectiveRole && player.role !== effectiveRole) err = `Role mismatch: ${player.role} cannot go to ${effectiveRole} base.`;
        if (!err && noCrossShiftDupesEnabled()) {
          const hit = wrappedOther(player.id, activeShift);
          if (hit) err = `Player already assigned in ${hit.label || hit.shift || 'other shift'}.`;
        }
        if (!err) {
          const helperCountAfter = (base.helperIds || []).filter((id) => id !== player.id).length + 1;
          if (Number.isFinite(base.maxHelpers) && base.maxHelpers > 0 && helperCountAfter > base.maxHelpers) err = `Max helpers reached: ${helperCountAfter}/${base.maxHelpers}.`;
        }
        if (!err) {
          const captain = state.playerById?.get?.(base.captainId);
          const limit = captain ? (((captain.rally || 0) + (captain.march || 0)) || captain.march || 0) : 0;
          const helpersSum = (base.helperIds || []).reduce((sum, id) => {
            if (id === player.id) return sum;
            return sum + helperMarchForBase(base, state.playerById?.get?.(id));
          }, 0);
          const totalAfter = Number(captain?.march || 0) + helpersSum + helperMarchForBase(base, player);
          if (limit && totalAfter > limit) err = `Over limit: ${PNS.formatNum?.(totalAfter) || totalAfter} > ${PNS.formatNum?.(limit) || limit}.`;
        }
        if (err) {
          try { PNS.setRowStatus?.(player, err, 'danger'); } catch {}
          alert(err);
          return;
        }

        try { PNS.clearPlayerFromBase?.(player.id); } catch {}
        base.helperIds = Array.isArray(base.helperIds) ? base.helperIds : [];
        if (!base.helperIds.includes(player.id)) base.helperIds.push(player.id);
        player.assignment = { baseId: base.id, kind: 'helper' };
        try { if (typeof PNS.renderAll === 'function') PNS.renderAll(); } catch {}
        persistAfter({ type: 'assign', baseId: base.id, playerId: player.id, kind: 'helper', crossShiftCaptain: true });
      };
      patched.__tcv22Wrapped = true;
      patched.__tcv22Original = origAssign;
      PNS.assignPlayerToBase = patched;
    }
  }

  function interceptBaseEditorAndRowActions() {
    if (document.__tcv22ClickBound) return;
    document.__tcv22ClickBound = true;
    document.addEventListener('click', function(e) {
      const PNS = window.PNS;
      const state = PNS?.state || {};

      const editorBtn = e.target.closest?.('[data-base-editor-action="helper"]');
      if (editorBtn) {
        const baseId = editorBtn.dataset.baseId;
        const base = state.baseById?.get?.(baseId);
        const editor = base?.cardEl ? base.cardEl.querySelector('.base-editor') : null;
        const sel = editor ? editor.querySelector(`select[data-base-editor-select="${baseId}"]`) : null;
        const pid = sel?.value || '';
        const otherHit = pid ? getOtherShiftHit(pid, state.activeShift) : null;
        if (otherHit && String(otherHit?.assignment?.kind || '').toLowerCase() === 'captain') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          PNS.assignPlayerToBase?.(pid, baseId, 'helper');
          return;
        }
      }

      const helperBtn = e.target.closest?.('.row-actions button');
      if (helperBtn && /^helper$/i.test((helperBtn.textContent || '').trim())) {
        const actionCell = helperBtn.closest('td[data-field="actions"]');
        const player = (state.players || []).find((p) => p?.actionCellEl === actionCell);
        const select = actionCell?.querySelector('select');
        const baseId = select?.value || '';
        const otherHit = player?.id ? getOtherShiftHit(player.id, state.activeShift) : null;
        if (player && baseId && otherHit && String(otherHit?.assignment?.kind || '').toLowerCase() === 'captain') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          PNS.assignPlayerToBase?.(player.id, baseId, 'helper');
          return;
        }
      }
    }, true);
  }

  function fixApplySelect(root=document) {
    const select = root.querySelector('#towerCalcApplyModeUi');
    if (!select) return;

    const oldWrap = root.querySelector('#tcv18ApplyModeWrap');
    if (oldWrap) {
      oldWrap.classList.remove('is-placeholder');
      oldWrap.querySelectorAll('.tcv19-apply-placeholder').forEach((n) => n.remove());
      oldWrap.style.position = '';
    }

    const label = select.closest('label');
    if (label) {
      // Прибираємо зовнішній текст з label, залишаємо тільки сам select
      const txtNodes = Array.from(label.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE);
      txtNodes.forEach((n) => { if ((n.textContent || '').includes('Застосування')) n.textContent = ''; });
      label.classList.add('tcv22-apply-label');
    }

    // Справжній placeholder як option, без оверлея
    let ph = select.querySelector('option[data-tcv22-placeholder="1"]');
    if (!ph) {
      ph = document.createElement('option');
      ph.value = '';
      ph.textContent = 'Застосування';
      ph.disabled = true;
      ph.hidden = true;
      ph.setAttribute('data-tcv22-placeholder', '1');
      select.insertBefore(ph, select.firstChild || null);
    }

    const map = { topup: 'Лише дозаповнення', empty: 'Лише порожні', rebalance: 'Повний перерозподіл' };
    qa('option', select).forEach((o) => {
      if (o.value && map[o.value]) o.textContent = map[o.value];
    });

    if (!select.dataset.tcv22Bound) {
      select.addEventListener('change', () => {
        if (select.value) {
          applyPicked = true;
          select.classList.remove('tcv22-placeholder');
        }
      });
      select.dataset.tcv22Bound = '1';
    }

    if (!applyPicked) {
      select.value = '';
      select.classList.add('tcv22-placeholder');
    } else {
      select.classList.remove('tcv22-placeholder');
    }
  }

  function injectStyles() {
    if (document.getElementById('tcv22-hotfix-style')) return;
    const st = document.createElement('style');
    st.id = 'tcv22-hotfix-style';
    st.textContent = `
      .tcv22-apply-label{display:inline-flex;align-items:center;gap:0;min-width:200px}
      .tcv22-apply-label select{min-width:210px;height:44px}
      .tcv22-apply-label .tcv19-apply-placeholder{display:none!important}
      #tcv18ApplyModeWrap .tcv19-apply-placeholder{display:none!important}
      #tcv18ApplyModeWrap.is-placeholder .tcv18-apply-select,
      .tcv22-apply-label select.tcv22-placeholder{color:rgba(255,255,255,.92)!important;-webkit-text-fill-color:rgba(255,255,255,.92)!important}
      .tcv22-apply-label select.tcv22-placeholder option{color:#fff}
      @media (max-width: 900px){
        .tcv22-apply-label{min-width:160px;width:100%}
        .tcv22-apply-label select{min-width:0;width:100%}
      }
    `;
    document.head.appendChild(st);
  }

  function run(){
    injectStyles();
    installCrossShiftCaptainUsage();
    interceptBaseEditorAndRowActions();
    fixApplySelect(document);
  }

  run();
  document.addEventListener('htmx:afterSwap', run);
  document.addEventListener('players-table-rendered', run);
  document.addEventListener('pns:assignment-changed', run);
  let tries = 0;
  const iv = setInterval(() => {
    run();
    tries += 1;
    if (tries > 40) clearInterval(iv);
  }, 500);
})();
(function(){
  const KEY = '__tcv28_no_cross_getter_fix__';
  if (window[KEY]) return;
  window[KEY] = true;

  function readNoCross() {
    try {
      const cb = document.getElementById('towerCalcNoCrossShift') || document.querySelector('#towerCalcModal #towerCalcNoCrossShift');
      if (cb) return !!cb.checked;
    } catch {}
    try {
      const tc = window.PNS?.state?.towerCalc;
      if (tc && typeof tc.noCrossShift === 'boolean') return !!tc.noCrossShift;
    } catch {}
    try {
      const picker = document.getElementById('pickerNoCrossShiftDupes');
      if (picker) return !!picker.checked;
    } catch {}
    try {
      if (typeof window.PNS?.state?.towerPickerNoCrossShiftDupes === 'boolean') {
        return !!window.PNS.state.towerPickerNoCrossShiftDupes;
      }
    } catch {}
    return true;
  }

  function install() {
    const PNS = window.PNS;
    if (!PNS) return false;
    PNS.isTowerNoCrossShiftDupesEnabled = readNoCross;
    return true;
  }

  if (!install()) {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  }
})();
(function(){
  'use strict';

  function q(sel, root){ return (root||document).querySelector(sel); }
  function qa(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }
  function hide(el){ if (el) el.style.display = 'none'; }
  function clickEl(el){ if (!el) return; el.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view:window })); }

  function setApplyMode(root, value){
    var sel = q('#towerCalcApplyModeUi', root);
    if (!sel) return;
    sel.value = value;
    sel.dispatchEvent(new Event('change', { bubbles:true }));
  }

  function makeBtn(text, onClick){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-sm';
    b.textContent = text;
    b.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      onClick && onClick(e);
    });
    return b;
  }

  function ensureStyles(){
    if (document.getElementById('tcv35-styles')) return;
    var s = document.createElement('style');
    s.id = 'tcv35-styles';
    s.textContent = [
      '#tcv35-row{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px}',
      '#tcv35-clearWrap{position:relative}',
      '#tcv35-clearMenu{position:absolute;top:calc(100% + 8px);right:0;min-width:240px;background:#101a33;border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:8px;box-shadow:0 18px 40px rgba(0,0,0,.35);z-index:1200;display:none}',
      '#tcv35-clearMenu.open{display:block}',
      '#tcv35-clearMenu .tcv35-item{width:100%;display:block;text-align:left;background:transparent;border:0;color:inherit;padding:10px 12px;border-radius:10px;cursor:pointer}',
      '#tcv35-clearMenu .tcv35-item:hover{background:rgba(255,255,255,.06)}',
      '#tcv35-clearMenu .tcv35-sep{height:1px;background:rgba(255,255,255,.08);margin:6px 4px}',
      '@media (max-width: 768px){#tcv35-row{gap:10px} #tcv35-row .btn{width:100%} #tcv35-clearWrap{width:100%} #tcv35-clearWrap > .btn{width:100%} #tcv35-clearMenu{left:0;right:auto;width:100%;min-width:0}}'
    ].join('');
    document.head.appendChild(s);
  }

  function build(root){
    if (!root) return false;
    ensureStyles();

    var toolbarMain = q('.tower-calc-toolbar-main', root);
    var toolbarSub = q('.tower-calc-toolbar .tower-calc-controls.muted.small', root);
    var loadBtn = q('#towerCalcLoadCaptainsBtn', root);
    var fitBtn = q('#towerCalcFitBtn', root);
    var applyLimitsBtn = q('#towerCalcApplyToTowersBtn', root);
    var quickApplyBtn = q('#towerCalcQuickApplyBtn', root);
    var clear1Btn = q('#towerCalcClearShift1Btn', root);
    var clear2Btn = q('#towerCalcClearShift2Btn', root);
    var clearAllBtn = q('#towerCalcClearHelpersAllBtn', root);
    var restoreBtn = q('#towerCalcRestoreImportShiftsBtn', root);

    if (!toolbarMain || !loadBtn || !quickApplyBtn) return false;

    hide(toolbarMain);
    hide(toolbarSub);
    hide(fitBtn);
    hide(applyLimitsBtn);
    hide(clear1Btn);
    hide(clear2Btn);
    hide(clearAllBtn);

    var old = q('#tcv35-row', root);
    if (old) old.remove();

    var row = document.createElement('div');
    row.id = 'tcv35-row';

    var btnLoad = makeBtn('Підтягнути капітанів', function(){ clickEl(loadBtn); });
    var btnRebalance = makeBtn('Застосувати перерозподіл', function(){
      setApplyMode(root, 'rebalance');
      clickEl(quickApplyBtn);
    });
    var btnTopup = makeBtn('Дозаповнити башні', function(){
      setApplyMode(root, 'topup');
      clickEl(quickApplyBtn);
    });

    var clearWrap = document.createElement('div');
    clearWrap.id = 'tcv35-clearWrap';
    var clearBtn = makeBtn('Очистити ▾', function(e){
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    var menu = document.createElement('div');
    menu.id = 'tcv35-clearMenu';

    function menuItem(text, target){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tcv35-item';
      b.textContent = text;
      b.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        if (target) clickEl(target);
        menu.classList.remove('open');
      });
      return b;
    }

    menu.appendChild(menuItem('Очистити Shift 1', clear1Btn));
    menu.appendChild(menuItem('Очистити Shift 2', clear2Btn));
    menu.appendChild(menuItem('Очистити Shift 1 + 2', clearAllBtn));
    if (restoreBtn) {
      var sep = document.createElement('div');
      sep.className = 'tcv35-sep';
      menu.appendChild(sep);
      menu.appendChild(menuItem('Відновити з імпорту', restoreBtn));
    }

    clearWrap.appendChild(clearBtn);
    clearWrap.appendChild(menu);

    document.addEventListener('click', function(ev){
      if (!clearWrap.contains(ev.target)) menu.classList.remove('open');
    }, { once:true });

    row.appendChild(btnLoad);
    row.appendChild(btnRebalance);
    row.appendChild(btnTopup);
    row.appendChild(clearWrap);

    toolbarMain.parentNode.insertBefore(row, toolbarMain);

    return true;
  }

  function run(){
    var root = q('#towerCalcModal, .tower-calc-main-panel') || document;
    build(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  setTimeout(run, 300);
  setTimeout(run, 900);
})();
(function(){
  'use strict';
  function apply(){
    if (document.getElementById('tcv37-style')) return;
    var s = document.createElement('style');
    s.id = 'tcv37-style';
    s.textContent = [
      '#towerCalcModal [data-calc-main-panel="setup"] .tower-calc-toolbar > .tower-calc-toolbar-main{display:none !important;}',
      '#towerCalcModal [data-calc-main-panel="setup"] .tower-calc-toolbar > .tower-calc-controls.muted.small{display:none !important;}',
      '#towerCalcModal [data-calc-main-panel="setup"] #towerCalcLoadCaptainsBtn,',
      '#towerCalcModal [data-calc-main-panel="setup"] #towerCalcFitBtn,',
      '#towerCalcModal [data-calc-main-panel="setup"] #towerCalcApplyToTowersBtn,',
      '#towerCalcModal [data-calc-main-panel="setup"] #towerCalcQuickApplyBtn,',
      '#towerCalcModal [data-calc-main-panel="setup"] #towerCalcApplyModeUi,',
      '#towerCalcModal [data-calc-main-panel="setup"] #towerCalcModeUi{display:none !important;}',
      '#towerCalcModal #tcv35-row{margin: 16px 0 18px !important;}',
      '@media (max-width: 768px){#towerCalcModal #tcv35-row{gap:10px !important;} #towerCalcModal #tcv35-row .btn{width:100% !important;}}'
    ].join('');
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
