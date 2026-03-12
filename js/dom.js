(function () {
  const PNS = window.PNS = window.PNS || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function safeRun(fn) {
    try { fn(); } catch (e) { console.warn('[dom.js]', e); }
  }

  function exposeLegacyBaseEditorFlag() {
    if (typeof PNS.shouldRenderLegacyBaseEditor !== 'function') {
      PNS.shouldRenderLegacyBaseEditor = () => false;
    }
    if (typeof PNS.isLegacyBaseEditorEnabled !== 'function') {
      PNS.isLegacyBaseEditorEnabled = () => {
        try { return !!PNS.shouldRenderLegacyBaseEditor(); } catch {}
        return false;
      };
    }
  }

  function ensureLegacyBaseEditorStyles() {
    const enabled = typeof PNS.isLegacyBaseEditorEnabled === 'function' ? !!PNS.isLegacyBaseEditorEnabled() : false;
    const id = 'pns-base-editor-fallback-css';
    const href = 'css/base-editor-fallback.css';
    const existing = document.getElementById(id);

    if (!enabled) {
      existing?.remove?.();
      return;
    }

    if (existing) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

function roleCountsHtml(fighter, rider, shooter) {
  const roleLabel = (role, plural = false) => typeof PNS.roleLabel === 'function' ? PNS.roleLabel(role, { plural }) : role;
  return `
      <span class="stat-chip stat-chip--role is-fighter"><b>${fighter}</b><small>${roleLabel('Fighter', true)}</small></span>
      <span class="stat-chip stat-chip--role is-rider"><b>${rider}</b><small>${roleLabel('Rider', true)}</small></span>
      <span class="stat-chip stat-chip--role is-shooter"><b>${shooter}</b><small>${roleLabel('Shooter', true)}</small></span>`;
}

function shiftCountsHtml(shift1, shift2, both) {
  const shiftLabel = (shift) => typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(shift) : shift;
  return `
      <span class="stat-chip stat-chip--shift is-shift1"><b>${shift1}</b><small>${shiftLabel('shift1')}</small></span>
      <span class="stat-chip stat-chip--shift is-shift2"><b>${shift2}</b><small>${shiftLabel('shift2')}</small></span>
      <span class="stat-chip stat-chip--shift is-both"><b>${both}</b><small>${shiftLabel('both')}</small></span>`;
}

function scheduleUpdateStats() {
  if (window.__pnsStatsRaf) cancelAnimationFrame(window.__pnsStatsRaf);
  window.__pnsStatsRaf = requestAnimationFrame(() => {
    window.__pnsStatsRaf = 0;
    safeRun(updateStats);
  });
}

  function updateStats() {
    const players = Array.isArray(PNS?.state?.players) && PNS.state.players.length
      ? PNS.state.players
      : [];

    let total = 0, capReady = 0, shooter = 0, fighter = 0, rider = 0, shift1 = 0, shift2 = 0, both = 0;

    if (players.length) {
      total = players.length;
      players.forEach((player) => {
        const role = typeof PNS.normalizeRole === 'function' ? PNS.normalizeRole(player.role) : String(player.role || '');
        const shift = typeof PNS.normalizeShiftValue === 'function' ? PNS.normalizeShiftValue(player.shift || player.shiftLabel || 'both') : String(player.shift || 'both');
        if (player.captainReady) capReady++;
        if (role === 'Shooter') shooter++;
        else if (role === 'Fighter') fighter++;
        else if (role === 'Rider') rider++;
        if (shift === 'shift1') shift1++;
        else if (shift === 'shift2') shift2++;
        else both++;
      });
    } else {
      const rows = $$('#playersDataTable tbody tr');
      total = rows.length;
      rows.forEach((tr) => {
        const tds = $$('td', tr);
        const roleText = (tr.querySelector('td[data-field="role"]') || tds[2])?.textContent || '';
        const capText = (tr.querySelector('td[data-field="captainReady"]') || tds[6])?.textContent || '';
        const shiftText = (tr.querySelector('td[data-field="shiftLabel"]') || tds[7])?.textContent || tr.dataset.shift || 'both';
        const role = typeof PNS.normalizeRole === 'function' ? PNS.normalizeRole(roleText) : roleText;
        const shift = typeof PNS.normalizeShiftValue === 'function' ? PNS.normalizeShiftValue(shiftText) : shiftText;
        if (/yes|так|да/i.test(capText)) capReady++;
        if (role === 'Shooter') shooter++;
        else if (role === 'Fighter') fighter++;
        else if (role === 'Rider') rider++;
        if (shift === 'shift1') shift1++;
        else if (shift === 'shift2') shift2++;
        else both++;
      });
    }

    const totalStrong = document.querySelector('[data-stat-card="total"] strong');
    const captainsStrong = document.querySelector('[data-stat-card="captains"] strong');
    if (totalStrong) totalStrong.textContent = String(total);
    if (captainsStrong) captainsStrong.textContent = String(capReady);

    const roleEl = document.getElementById('roleCountsDisplay');
    if (roleEl) roleEl.innerHTML = roleCountsHtml(fighter, rider, shooter);
    const shiftDisplayEl = document.getElementById('shiftCountsDisplay');
    if (shiftDisplayEl) shiftDisplayEl.innerHTML = shiftCountsHtml(shift1, shift2, both);
    const shiftEl = document.getElementById('shiftCounts');
    if (shiftEl) shiftEl.textContent = `${shift1} / ${shift2} / ${both}`;
  }

  function makeBaseEditorsCollapsible() {
    const enabled = typeof PNS.isLegacyBaseEditorEnabled === 'function' ? !!PNS.isLegacyBaseEditorEnabled() : false;
    $$('.base-editor').forEach((ed) => {
      if (!enabled) {
        ed.remove();
        return;
      }
      ed.style.display = 'none';
      const det = ed.querySelector('.base-editor-details');
      if (det) det.remove();
    });
  }

  function patchButtonsAndText() {
    if (!document.documentElement.dataset.v4TowerResetBound) {
      document.documentElement.dataset.v4TowerResetBound = '1';
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-v4-reset-tier-limits]');
        if (!btn) return;
        e.preventDefault();
        const box = btn.closest('.tower-settings-box');
        if (!box) return;
        box.querySelectorAll('input[data-v4-tier]').forEach((inp) => {
          inp.value = '0';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
        });
        box.querySelectorAll('input[data-v4-tier]').forEach((inp) => {
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    }

    $('#openBoardExportHintBtn')?.remove();
  }

  function highlightBoardCaptainRows() {
    $$('.board-col ul li:first-child').forEach((li) => li.classList.add('is-captain-row'));
  }

  function hideFieldLabelInputsByDefault() {
    const modal = $('#settings-modal');
    if (!modal) return;
    modal.classList.remove('show-field-label-edits');
  }

  let obsTable = null;
  let obsBases = null;
  let obsBoard = null;

  function disconnectObservers() {
    try { obsTable?.disconnect(); } catch {}
    try { obsBases?.disconnect(); } catch {}
    try { obsBoard?.disconnect(); } catch {}
    obsTable = obsBases = obsBoard = null;
  }

  function initMutationObservers() {
    disconnectObservers();

    const tableBody = $('#playersDataTable tbody');
    if (tableBody) {
      obsTable = new MutationObserver(() => { scheduleUpdateStats(); });
      obsTable.observe(tableBody, { childList: true, subtree: true, characterData: true });
    }

    const basesGrid = $('.bases-grid');
    if (basesGrid) {
      obsBases = new MutationObserver(() => { safeRun(makeBaseEditorsCollapsible); });
      obsBases.observe(basesGrid, { childList: true, subtree: true });
    }

    const board = $('.board-grid');
    if (board) {
      obsBoard = new MutationObserver(() => { safeRun(highlightBoardCaptainRows); });
      obsBoard.observe(board, { childList: true, subtree: true });
    }
  }

  function init() {
    safeRun(exposeLegacyBaseEditorFlag);
    safeRun(ensureLegacyBaseEditorStyles);
    safeRun(updateStats);
    safeRun(patchButtonsAndText);
    safeRun(makeBaseEditorsCollapsible);
    safeRun(highlightBoardCaptainRows);
    safeRun(hideFieldLabelInputsByDefault);
    safeRun(initMutationObservers);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  document.addEventListener('htmx:afterSwap', init);
  document.addEventListener('htmx:afterSettle', init);
  document.addEventListener('pns:partials:loaded', init);
})();
