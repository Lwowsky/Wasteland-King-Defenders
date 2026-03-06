(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // =========================
  // Helpers
  // =========================

  // For non-element targets (document/window), we can't use dataset -> use WeakMap
  const __boundStore = new WeakMap();

  function safeOn(target, key, evt, handler, opts) {
    if (!target) return;

    // Element nodes: use dataset
    if (target && target.nodeType === 1) {
      const k = `bound_${key}_${evt}`;
      if (target.dataset[k] === '1') return;
      target.dataset[k] = '1';
      target.addEventListener(evt, handler, opts);
      return;
    }

    // document / window / other EventTarget: use WeakMap
    let map = __boundStore.get(target);
    if (!map) {
      map = new Set();
      __boundStore.set(target, map);
    }
    const token = `${key}::${evt}`;
    if (map.has(token)) return;
    map.add(token);
    target.addEventListener(evt, handler, opts);
  }

  function closeDrawerIfOpen() {
    const burgerBtn = document.getElementById('burgerBtn');
    const drawer = document.getElementById('drawer');
    if (!burgerBtn || !drawer) return;
    if (!drawer.classList.contains('is-open')) return;

    drawer.classList.remove('is-open');
    burgerBtn.classList.remove('is-open');
    burgerBtn.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }

  // =========================
  // Settings modal side menu
  // =========================
  function createSettingsMenu() {
    const modal = $('#settings-modal');
    const card = $('#settings-modal .modal-card');
    const grid = $('#settings-modal .modal-grid');
    if (!modal || !card || !grid) return;

    if (card.dataset.v4MenuBuilt === '1') return;

    const sections = $$('.modal-grid > section.panel.subpanel', grid);
    if (!sections.length) return;

    card.dataset.v4MenuBuilt = '1';
    card.querySelector('.settings-side-menu')?.remove();

    const nav = document.createElement('aside');
    nav.className = 'settings-side-menu';

    const list = document.createElement('div');
    list.className = 'settings-side-list';

    sections.forEach((sec, idx) => {
      sec.dataset.settingsSection = String(idx);

      const h = sec.querySelector('h3');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'settings-side-btn' + (idx === 0 ? ' active' : '');
      btn.textContent = h ? h.textContent.replace(/^\d+\.\s*/, '') : `Section ${idx + 1}`;
      btn.dataset.targetSection = String(idx);

      btn.addEventListener('click', () => {
        $$('.settings-side-btn', nav).forEach((b) => b.classList.toggle('active', b === btn));
        sections.forEach((s) => (s.hidden = s.dataset.settingsSection !== btn.dataset.targetSection));
      });

      list.appendChild(btn);
      sec.hidden = idx !== 0;
    });

    nav.appendChild(list);
    card.querySelector('.modal-head')?.insertAdjacentElement('afterend', nav);
    card.classList.add('has-settings-side-menu');

    modal.classList.remove('show-field-label-edits');
  }

  // =========================
  // Drawer / Burger menu
  // =========================
  function bindDrawer() {
    const burgerBtn = document.getElementById('burgerBtn');
    const drawer = document.getElementById('drawer');
    const drawerBackdrop = document.getElementById('drawerBackdrop');
    const drawerClose = document.getElementById('drawerClose');

    if (!burgerBtn || !drawer || !drawerBackdrop || !drawerClose) return;

    function openDrawer() {
      drawer.classList.add('is-open');
      burgerBtn.classList.add('is-open');
      burgerBtn.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
      document.documentElement.style.overflow = 'hidden';
    }

    function closeDrawer() {
      drawer.classList.remove('is-open');
      burgerBtn.classList.remove('is-open');
      burgerBtn.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
    }

    safeOn(burgerBtn, 'drawer', 'click', (e) => {
      e.preventDefault();
      drawer.classList.contains('is-open') ? closeDrawer() : openDrawer();
    });

    safeOn(drawerBackdrop, 'drawer', 'click', (e) => { e.preventDefault(); closeDrawer(); });
    safeOn(drawerClose, 'drawer', 'click', (e) => { e.preventDefault(); closeDrawer(); });

    // global Escape
    safeOn(document, 'drawer', 'keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });

    // mobile buttons -> call PNS directly (NO d.click to avoid double triggers)
    const actions = [
      ['openSettingsBtnMobile', () => window.PNS?.openModal?.('settings')],
      ['openBoardBtnMobile', () => window.PNS?.openModal?.('board')],
      ['autoFillAllHeaderBtnMobile', () => (window.PNS?.openTowerCalculatorModal?.() || window.PNS?.ModalsShift?.openTowerCalculatorModal?.())],
    ];

    actions.forEach(([mobileId, fn]) => {
      const m = document.getElementById(mobileId);
      if (!m) return;
      safeOn(m, `drawerAction_${mobileId}`, 'click', (e) => {
        e.preventDefault();
        // prevent bubbling to delegated handlers (init_bind)
        e.stopPropagation();
        closeDrawer();
        try { fn?.(); } catch {}
      });
    });

    // if swapped while open
    if (drawer.classList.contains('is-open') && drawer.getAttribute('aria-hidden') !== 'false') {
      closeDrawer();
    }
  }

  // =========================
  // Quick buttons
  // =========================
  function bindQuickButtons() {
    const quick = document.getElementById('openImportQuickBtn');
    const openSettings = document.getElementById('openSettingsBtn');

    if (quick && openSettings) {
      safeOn(quick, 'quickOpen', 'click', (e) => {
        e.preventDefault();
        openSettings.click();
      });
    }

    const toggle = document.getElementById('toggleFieldLabelEditBtn');
    if (toggle) {
      safeOn(toggle, 'fieldLabelEdit', 'click', (e) => {
        e.preventDefault();
        const modal = document.getElementById('settings-modal');
        if (!modal) return;
        modal.classList.toggle('show-field-label-edits');
        e.currentTarget.textContent = modal.classList.contains('show-field-label-edits')
          ? 'Сховати редагування назв'
          : 'Показати редагування назв';
      });
    }
  }

  // =========================
  // Main bind entry (safe to run many times)
  // =========================
  function bindAll() {
    createSettingsMenu();
    bindDrawer();
    bindQuickButtons();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindAll);
  else bindAll();

  // htmx hooks (safe even if htmx isn't present)
  safeOn(document, 'htmx', 'htmx:afterSwap', () => {
    closeDrawerIfOpen();
    bindAll();
  });

  safeOn(document, 'htmx', 'htmx:afterSettle', () => {
    bindAll();
  });

  // custom event if you dispatch it
  safeOn(document, 'custom', 'pns:partials:loaded', () => {
    closeDrawerIfOpen();
    bindAll();
  });
})();