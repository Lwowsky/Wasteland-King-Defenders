(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ===== utils =====
  function bindOnce(el, key, fn) {
    if (!el) return;
    const k = `bound_${key}`;
    if (el.dataset && el.dataset[k] === '1') return;
    if (el.dataset) el.dataset[k] = '1';
    fn();
  }

  function safeRun(fn) { try { fn(); } catch (e) { console.warn('[dom.js]', e); } }

  // ===== features =====
  function updateStats() {
    const rows = $$('#playersDataTable tbody tr');
    const total = rows.length;
    let capReady = 0, shooter = 0, fighter = 0, rider = 0;

    rows.forEach(tr => {
      const tds = $$('td', tr);

      const roleText =
        (tr.querySelector('td[data-field="role"]') || tds[2])?.textContent || '';

      const capText =
        (tr.querySelector('td[data-field="captainReady"]')
          || tr.querySelector('td[data-col-key="captain_ready"]')
          || tds[6])?.textContent || '';

      if (/yes|так|да/i.test(capText)) capReady++;

      if (/shoot|стрел|стріл/i.test(roleText)) shooter++;
      else if (/fight|боец|боєц|infantry/i.test(roleText)) fighter++;
      else if (/ride|наезд|наїзд|caval/i.test(roleText)) rider++;
    });

    const cards = $$('.stats-grid .stat-card');
    if (cards[0]) { const s = $('strong', cards[0]); if (s) s.textContent = String(total); }
    if (cards[1]) { const s = $('strong', cards[1]); if (s) s.textContent = String(capReady); }
    if (cards[2]) { const s = $('strong', cards[2]); if (s) s.textContent = `${shooter} / ${fighter} / ${rider}`; }
  }

  function makeBaseEditorsCollapsible() {
    $$('.base-editor').forEach(ed => {
      if (ed.dataset.v4Wrapped) return;
      ed.dataset.v4Wrapped = '1';

      const details = document.createElement('details');
      details.className = 'base-editor-details';
      details.open = false;
      details.innerHTML = '<summary>Редагувати башню / Edit tower</summary>';

      const wrapper = document.createElement('div');
      wrapper.className = 'base-editor-two-col';

      const left = document.createElement('div');
      left.className = 'base-editor-left';

      const right = document.createElement('div');
      right.className = 'base-editor-right';

      const card = ed.closest('.base-card');
      const ds = (card && card.dataset) ? card.dataset : {};

      const rows = $$('.editor-row, .editor-status, .editor-manual', ed);
      rows.forEach((node) => {
        left.appendChild(node);
      });

      right.innerHTML = `
        <div class="tower-settings-box">
          <h4>Налаштування башні</h4>
          <label class="tower-setting-line">
            <span>Max helpers (без капітана)</span>
            <input type="number" min="0" step="1" data-v4-maxhelpers value="${ds.baseMaxHelpers || 29}">
          </label>

          <div class="tower-setting-grid">
            <label class="tier-row"><span>T14</span><input type="number" min="0" data-v4-tier="T14" value="${ds.tierMinT14 || 0}"></label>
            <label class="tier-row"><span>T13</span><input type="number" min="0" data-v4-tier="T13" value="${ds.tierMinT13 || 0}"></label>
            <label class="tier-row"><span>T12</span><input type="number" min="0" data-v4-tier="T12" value="${ds.tierMinT12 || 0}"></label>
            <label class="tier-row"><span>T11</span><input type="number" min="0" data-v4-tier="T11" value="${ds.tierMinT11 || 0}"></label>
            <label class="tier-row"><span>T10</span><input type="number" min="0" data-v4-tier="T10" value="${ds.tierMinT10 || 0}"></label>
            <label class="tier-row"><span>T9</span><input type="number" min="0" data-v4-tier="T9" value="${ds.tierMinT9 || 0}"></label>
          </div>

          <div class="muted small">
            Тут задається мінімальний March size для конкретного Tier. Якщо 0 — без обмеження.
          </div>
        </div>`;

      wrapper.appendChild(left);
      wrapper.appendChild(right);
      details.appendChild(wrapper);
      ed.appendChild(details);
    });

    // move editor closer to captain box
    $$('.base-card').forEach(card => {
      const cap = $('.captain-box', card);
      const ed = $('.base-editor', card);
      if (cap && ed && cap.nextElementSibling !== ed) {
        cap.insertAdjacentElement('afterend', ed);
      }
    });
  }

  function patchButtonsAndText() {
    // ВАЖЛИВО: після partials елементи міняються, тому робимо "bindOnce"
    bindOnce($('#openImportQuickBtn'), 'openImportQuickBtn', () => {
      $('#openImportQuickBtn')?.addEventListener('click', () => $('#openSettingsBtn')?.click());
    });

    bindOnce($('#toggleFieldLabelEditBtn'), 'toggleFieldLabelEditBtn', () => {
      $('#toggleFieldLabelEditBtn')?.addEventListener('click', (e) => {
        const modal = $('#settings-modal');
        if (!modal) return;
        modal.classList.toggle('show-field-label-edits');
        e.currentTarget.textContent = modal.classList.contains('show-field-label-edits')
          ? 'Сховати редагування назв'
          : 'Показати редагування назв';
      });
    });

    bindOnce($('#shareBoardBtn'), 'shareBoardBtn', () => {
      $('#shareBoardBtn')?.addEventListener('click', async () => {
        const boardUrl = location.href.split('#')[0] + '#board-modal';
        try {
          if (navigator.share) await navigator.share({ title: 'P&S Final Board', text: 'Final Board View', url: boardUrl });
          else { await navigator.clipboard.writeText(boardUrl); alert('Посилання скопійовано'); }
        } catch { }
      });
    });

    // cleanup
    $('#openBoardExportHintBtn')?.remove();
    $$('[data-shift-tab="all"]').forEach(el => el.remove());

    // Update limit labels in right cards
    $$('.limit-grid > div').forEach(div => {
      const span = $('span', div);
      if (span && /Limit/i.test(span.textContent)) span.textContent = 'Limit (Rally+March)';
    });
  }

  function highlightBoardCaptainRows() {
    $$('.board-col ul li:first-child').forEach(li => li.classList.add('is-captain-row'));
  }

  function hideFieldLabelInputsByDefault() {
    const modal = $('#settings-modal');
    if (!modal) return;
    modal.classList.remove('show-field-label-edits');
  }

  // ===== observers: must be re-attached after swaps =====
  let obsTable = null;
  let obsBases = null;
  let obsBoard = null;

  function disconnectObservers() {
    try { obsTable?.disconnect(); } catch { }
    try { obsBases?.disconnect(); } catch { }
    try { obsBoard?.disconnect(); } catch { }
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

  // ===== main init (safe to run repeatedly) =====
  function init() {
    safeRun(updateStats);
    safeRun(patchButtonsAndText);
    safeRun(makeBaseEditorsCollapsible);
    safeRun(highlightBoardCaptainRows);
    safeRun(hideFieldLabelInputsByDefault);
    safeRun(initMutationObservers);
  }

  // Initial
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Re-init after partial swaps (HTMX)
  // Якщо HTMX нема — ці listeners просто не зашкодять.
  document.addEventListener('htmx:afterSwap', init);
  document.addEventListener('htmx:afterSettle', init);

  // Якщо ти підвантажуєш partials через fetch і сам вставляєш innerHTML —
  // просто диспатчни: document.dispatchEvent(new Event('pns:partials:loaded'));
  document.addEventListener('pns:partials:loaded', init);

})();