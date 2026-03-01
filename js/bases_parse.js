(function () {
  const PNS = window.PNS; if (!PNS) return;
  const { state, $$, $ } = PNS;

  // Unicode-safe slug (працює з укр/рус/англ)
  function slug(text) {
    const s = String(text || '').trim().toLowerCase();

    // Спроба з Unicode property escapes (сучасні браузери)
    try {
      return (s.normalize('NFKD'))
        .replace(/[^\p{L}\p{N}]+/gu, '-')   // будь-які літери/цифри з будь-яких мов
        .replace(/(^-|-$)/g, '') || 'base';
    } catch {
      // Фолбек для дуже старих браузерів
      return s
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'base';
    }
  }

  function setRoleTheme(el, role, isCard = true) {
    if (!el) return;
    el.classList.remove('shooter-theme', 'fighter-theme', 'rider-theme');
    if (role === 'Shooter') el.classList.add('shooter-theme');
    else if (role === 'Fighter') el.classList.add('fighter-theme');
    else if (role === 'Rider') el.classList.add('rider-theme');
    if (!role && isCard) { /* neutral */ }
  }

  function applyBaseRoleUI(base, role) {
    base.role = role || null;

    setRoleTheme(base.cardEl, base.role, true);
    setRoleTheme(base.boardEl, base.role, false);

    const typeEl = $('.base-type', base.cardEl);
    const badgeEl = $('.base-role', base.cardEl);

    if (typeEl) {
      typeEl.textContent = base.role
        ? `${base.role} base (авто по капітану)`
        : 'Тип бази: автоматично по капітану';
    }

    if (badgeEl) {
      badgeEl.classList.remove('shooter', 'fighter', 'rider', 'is-auto', 'is-hidden');

      if (!base.role) {
        badgeEl.textContent = 'Auto';
        badgeEl.classList.add('is-auto');
      } else {
        badgeEl.textContent = base.role;
        badgeEl.classList.add(base.role.toLowerCase());
      }
    }

    if (base.boardEl) {
      const sub = $('.board-sub', base.boardEl);
      if (sub) {
        sub.classList.toggle('is-auto', !base.role);
        sub.textContent = base.role ? `${base.role} / ${base.role}` : 'Type auto by captain';
      }
    }
  }

  function parseQuotaMap(card) {
    const quotas = {};
    $$('.quota-row span', card).forEach((s) => {
      const m = s.textContent.match(/T\s*(\d+)\s*[:=]\s*(\d+)/i);
      if (!m) return;
      quotas[`T${m[1]}`.toUpperCase()] = Number(m[2]) || 0;
    });
    return quotas;
  }

  function getBaseRole(base) {
    if (!base) return null;
    if (base.captainId) return state.playerById.get(base.captainId)?.role || null;
    return base.role || null;
  }

  function syncBaseEditorSettingsInputs(base) {
    if (!base?.cardEl) return;
    const root = $('.base-editor', base.cardEl) || base.cardEl;

    const maxEl = $('[data-v4-maxhelpers]', root);
    if (maxEl) maxEl.value = String(PNS.clampInt(base.maxHelpers, 29));

    ['T14','T13','T12','T11','T10','T9'].forEach((t) => {
      const inp = root.querySelector(`[data-v4-tier="${t}"]`);
      if (inp) inp.value = String(PNS.clampInt(base?.tierMinMarch?.[t], 0));
    });

    base.cardEl.dataset.baseMaxHelpers = String(PNS.clampInt(base.maxHelpers, 29));
    ['T14','T13','T12','T11','T10','T9'].forEach((t)=> {
      base.cardEl.dataset['tierMin' + t] = String(PNS.clampInt(base?.tierMinMarch?.[t], 0));
    });
  }

  function readBaseEditorSettingsInputs(base) {
    if (!base?.cardEl) {
      return PNS.normalizeBaseTowerRule({
        maxHelpers: base?.maxHelpers || 29,
        tierMinMarch: base?.tierMinMarch || {}
      });
    }

    const root = $('.base-editor', base.cardEl) || base.cardEl;
    const out = {
      maxHelpers: PNS.clampInt($('[data-v4-maxhelpers]', root)?.value, base?.maxHelpers || 29),
      tierMinMarch: PNS.getEmptyTierMinMarch(),
    };

    ['T14','T13','T12','T11','T10','T9'].forEach((t) => {
      out.tierMinMarch[t] = PNS.clampInt(
        root.querySelector(`[data-v4-tier="${t}"]`)?.value,
        base?.tierMinMarch?.[t] || 0
      );
    });

    return PNS.normalizeBaseTowerRule(out);
  }

  // stub so calls won't crash before render module loads
  function renderQuotaRow(base) { /* real impl in render.js */ }
  PNS.renderQuotaRow = PNS.renderQuotaRow || renderQuotaRow;

  // нормалізація назви для мапінгу card(h3) -> board(h4)
  function keyFromTitle(t) {
    return slug(String(t || '').split('/')[0].trim());
  }

  function parseBasesFromCards() {
    state.bases = [];
    state.baseById = new Map();

    const cards = $$('.base-card');
    // колонки в модалці (board) — шукаємо більш “точково”
    const boardCols = $$('.board-modal .board-col, #board-modal .board-col, .board-col');

    // будуємо map по назві для boardCols
    const boardMap = new Map();
    boardCols.forEach((col) => {
      const h4 = $('h4', col)?.textContent?.trim() || '';
      const k = keyFromTitle(h4);
      if (!boardMap.has(k)) boardMap.set(k, col);
    });

    // щоб ID були завжди унікальні
    const usedIds = new Set();

    cards.forEach((card, idx) => {
      const titleText = $('h3', card)?.textContent.trim() || `Base ${idx + 1}`;

      // shift: якщо в HTML є data-shift, беремо його, інакше both
      const shift = card.dataset.shift || 'both';

      const baseKey = keyFromTitle(titleText);
      let id = `b-${idx + 1}-${baseKey}`;
      if (usedIds.has(id)) {
        // якщо через кирилицю/однакові назви знов однаково — додаємо суфікс
        let n = 2;
        while (usedIds.has(`${id}-${n}`)) n++;
        id = `${id}-${n}`;
      }
      usedIds.add(id);

      card.dataset.baseId = id;

      // boardEl: спочатку пробуємо по назві, потім по індексу
      const boardEl = boardMap.get(baseKey) || boardCols[idx] || null;
      if (boardEl) boardEl.dataset.baseId = id;

      // додаємо інструменти 1 раз
      if (!$('.base-tools', card)) {
        const quotaRow = $('.quota-row', card);
        const tools = document.createElement('div');
        tools.className = 'base-tools';
        tools.innerHTML = `
          <button class="btn btn-sm" type="button" data-base-autofill="${id}">Auto-fill</button>
          <button class="btn btn-sm" type="button" data-base-clear-helpers="${id}">Clear helpers</button>
          <button class="btn btn-sm" type="button" data-base-clear-all="${id}">Clear base</button>
        `;
        // якщо quotaRow нема — вставимо в кінець card, щоб точно було
        if (quotaRow) quotaRow.insertAdjacentElement('afterend', tools);
        else card.appendChild(tools);
      }

      const parsedQuotas = parseQuotaMap(card);

      const savedTowerRule =
        typeof PNS.getBaseTowerRule === 'function'
          ? PNS.getBaseTowerRule(id)
          : { maxHelpers: 29, tierMinMarch: PNS.getEmptyTierMinMarch() };

      const base = {
        id,
        title: titleText,
        role: null,
        shift,
        cardEl: card,
        boardEl,
        captainId: null,
        helperIds: [],
        defaultQuotas: { ...parsedQuotas },
        quotas: {},
        maxHelpers: savedTowerRule.maxHelpers || 29,
        tierMinMarch: { ...(savedTowerRule.tierMinMarch || PNS.getEmptyTierMinMarch()) }
      };

      state.bases.push(base);
      state.baseById.set(id, base);

      applyBaseRoleUI(base, null);
      if (typeof PNS.renderQuotaRow === 'function') PNS.renderQuotaRow(base);
      syncBaseEditorSettingsInputs(base);
    });
  }

  PNS.slug = slug;
  PNS.setRoleTheme = setRoleTheme;
  PNS.applyBaseRoleUI = applyBaseRoleUI;
  PNS.parseBasesFromCards = parseBasesFromCards;
  PNS.getBaseRole = getBaseRole;
  PNS.syncBaseEditorSettingsInputs = syncBaseEditorSettingsInputs;
  PNS.readBaseEditorSettingsInputs = readBaseEditorSettingsInputs;

})();