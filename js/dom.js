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

  function updateStats() {
    const rows = $$('#playersDataTable tbody tr');
    const total = rows.length;
    let capReady = 0, shooter = 0, fighter = 0, rider = 0;

    rows.forEach((tr) => {
      const tds = $$('td', tr);
      const roleText = (tr.querySelector('td[data-field="role"]') || tds[2])?.textContent || '';
      const capText = (
        tr.querySelector('td[data-field="captainReady"]') ||
        tr.querySelector('td[data-col-key="captain_ready"]') ||
        tds[6]
      )?.textContent || '';

      if (/yes|так|да/i.test(capText)) capReady++;
      if (/shoot|стрел|стріл/i.test(roleText)) shooter++;
      else if (/fight|боец|боєц|infantry/i.test(roleText)) fighter++;
      else if (/ride|наезд|наїзд|caval/i.test(roleText)) rider++;
    });

    const cards = $$('.stats-grid .stat-card');
    if (cards[0]) { const s = $('strong', cards[0]); if (s) s.textContent = String(total); }
    if (cards[1]) { const s = $('strong', cards[1]); if (s) s.textContent = String(capReady); }
    if (cards[2]) { const s = $('strong', cards[2]); if (s) s.textContent = `${shooter} / ${fighter} / ${rider}`; }

    let shift1 = 0, shift2 = 0, both = 0;
    if (typeof PNS?.getShiftCounts === 'function' && Array.isArray(PNS?.state?.players)) {
      const c = PNS.getShiftCounts(PNS.state.players);
      shift1 = Number(c.shift1 || 0);
      shift2 = Number(c.shift2 || 0);
      both = Number(c.both || 0);
    } else {
      rows.forEach((tr) => {
        const shiftText = (
          tr.querySelector('td[data-field="shiftLabel"]') ||
          tr.querySelector('td[data-col-key="shift"]')
        )?.textContent || tr.dataset.shift || 'both';
        const s = String(shiftText || '').toLowerCase();
        if (s.includes('shift 1') || s === 'shift1') shift1++;
        else if (s.includes('shift 2') || s === 'shift2') shift2++;
        else both++;
      });
    }

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
      obsTable = new MutationObserver(() => { safeRun(updateStats); });
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
