(function () {
  const PNS = window.PNS = window.PNS || {};

  const ROLE_SINGULAR = { Fighter: 'Боєць', Rider: 'Наїзник', Shooter: 'Стрілець', Unknown: 'Невідомо' };
  const ROLE_PLURAL = { Fighter: 'Бійці', Rider: 'Наїзники', Shooter: 'Стрільці', Unknown: 'Невідомо' };
  const SHIFT_LABELS = { shift1: 'Зміна 1', shift2: 'Зміна 2', both: 'Обидві', all: 'Усі' };

  const EXACT_TEXT = new Map([
    ['Open menu', 'Відкрити меню'],
    ['Close menu', 'Закрити меню'],
    ['Final Board View', 'Фінальний план'],
    ['Final board view', 'Фінальний план'],
    ['Settings', 'Налаштування'],
    ['Shift plan', 'План змін'],
    ['Auto-fill all', 'Автозаповнити все'],
    ['Type auto by captain', 'Тип визначається капітаном'],
    ['Type auto by captain · Both', 'Тип визначається капітаном · Обидві'],
    ['Captain / Helper', 'Капітан / Помічник'],
    ['Captain march', 'Марш капітана'],
    ['Rally size', 'Розмір ралі'],
    ['Free space', 'Вільне місце'],
    ['Player', 'Гравець'],
    ['Ally', 'Альянс'],
    ['Role', 'Роль'],
    ['Tier', 'Тір'],
    ['March', 'Марш'],
    ['Player name', 'Нік гравця'],
    ['Alliance', 'Альянс'],
    ['Focus troop', 'Тип військ'],
    ['Lair level', 'Рівень лігва'],
    ['Rows', 'Рядків'],
    ['Export PNG', 'Завантажити PNG'],
    ['No helpers assigned', 'Помічників ще не призначено'],
    ['No players assigned', 'Гравців ще не призначено'],
    ['No assigned players in this tower.', 'У цій турелі ще немає призначених гравців.'],
    ['Show all data', 'Показати всі дані'],
    ['Menu', 'Меню'],
    ['Tower Calculator', 'Розподіл по турелях'],
    ['Status players', 'Статус гравців'],
    ['Final plan', 'Фінальний план'],
    ['Plan / Plan', 'План'],
    ['Players in tower:', 'Гравців у турелі:'],
    ['Captain + players', 'Капітан і гравці'],
    ['Without captain', 'Без капітана'],
    ['Auto-fill', 'Автозаповнення'],
    ['Clear helpers', 'Очистити помічників'],
    ['Clear base', 'Очистити турель'],
    ['Техно-Центр / Hub', 'Техно-Центр'],
    ['Північна турель / North Tower', 'Північна турель'],
    ['Західна турель / West Tower', 'Західна турель'],
    ['Східна турель / East Tower', 'Східна турель'],
    ['Південна турель / South Tower', 'Південна турель'],
    ['Fighter / Fighter', 'Боєць / Боєць'],
    ['Rider / Rider', 'Наїзник / Наїзник'],
    ['Shooter / Shooter', 'Стрілець / Стрілець'],
    ['Both', 'Обидві'],
    ['Shift 1', 'Зміна 1'],
    ['Shift 2', 'Зміна 2'],
    ['Yes', 'Так'],
    ['No', 'Ні'],
    ['Edit captain', 'Редагувати капітана'],
    ['Edit player', 'Редагувати гравця'],
    ['Page 1 / 1', 'Сторінка 1 / 1'],
    ['Живий розподіл: Captain / Helper, auto-fill, без змішування типів', 'Швидке керування турелями: капітан, помічники й автозаповнення без змішування типів військ'],
    ['Shift 1 / Shift 2 — окремі плани. Auto-fill не дублює гравців між ними.', 'Зміна 1 / Зміна 2 — окремі плани. Автозаповнення не дублює гравців між ними.'],
    ['Автобаланс гравців Both', 'Автобаланс гравців «Обидві»'],
    ['2nd shift / Вторая половина', 'Зміна 2'],
    ['Використовувати Both', 'Використовувати «Обидві»'],
    ['Очистити Shift 1', 'Очистити зміну 1'],
    ['Очистити Shift 2', 'Очистити зміну 2'],
    ['Очистити Shift 1 + 2', 'Очистити зміну 1 + 2'],
    ['Роль / Tier', 'Роль / Тір'],
    ['Налаштування башні · ліміти по тірам (макс. March)', 'Налаштування турелі · ліміти по тірах (макс. марш)'],
    ['0 = гнучкий tier: бере повний March, але якщо місця не вистачає — ділить залишок між гравцями цього tier.', '0 = гнучкий тір: бере повний марш, але якщо місця не вистачає — ділить залишок між гравцями цього тіру.'],
    ['Тут видно всіх гравців із групи Both: хто вже стоїть у башнях, хто поза башнями, і хто вручну відправлений у резерв.', 'Тут видно всіх гравців із групи «Обидві»: хто вже стоїть у турелях, хто поза турелями, і хто вручну відправлений у резерв.'],
    ['Вручну відправлені в резерв Shift 1/2', 'Гравці, яких вручну відправили в резерв зміни 1/2'],
  ]);

  function normalizeRole(value) {
    try { if (typeof PNS.normalizeRole === 'function') return String(PNS.normalizeRole(value) || 'Unknown'); } catch {}
    const raw = String(value || '').trim();
    if (!raw) return 'Unknown';
    if (/стріл|shoot/i.test(raw)) return 'Shooter';
    if (/бійц|боєц|fight|infantry/i.test(raw)) return 'Fighter';
    if (/наїз|наезд|ride|rider|caval/i.test(raw)) return 'Rider';
    return raw;
  }

  function normalizeShift(value) {
    try { if (typeof PNS.normalizeShiftValue === 'function') return String(PNS.normalizeShiftValue(value) || 'both'); } catch {}
    const raw = String(value || '').toLowerCase();
    if (raw.includes('1')) return 'shift1';
    if (raw.includes('2')) return 'shift2';
    if (raw.includes('усі') || raw.includes('all')) return 'all';
    return 'both';
  }

  function roleLabel(value, opts = {}) {
    const key = normalizeRole(value);
    return (opts.plural ? ROLE_PLURAL : ROLE_SINGULAR)[key] || String(value || '');
  }

  function shiftLabel(value) {
    const key = normalizeShift(value);
    return SHIFT_LABELS[key] || String(value || '');
  }

  PNS.roleLabel = roleLabel;
  PNS.shiftLabel = shiftLabel;
  PNS.yesNoLabel = (v) => (v ? 'Так' : 'Ні');
  PNS.i18n = { locale: 'uk', roleLabel, shiftLabel };

  function leafText(el) {
    if (!el) return '';
    if (el.children.length && !el.matches('button,a,option,th,summary')) return '';
    return String(el.textContent || '').trim();
  }

  function localizeRoleSelect(select, plural = false) {
    if (!select) return;
    Array.from(select.options || []).forEach((opt) => {
      const key = normalizeRole(opt.value || opt.textContent);
      if (ROLE_SINGULAR[key]) {
        opt.value = key;
        opt.textContent = plural ? ROLE_PLURAL[key] : ROLE_SINGULAR[key];
      }
      const shiftKey = normalizeShift(opt.value || opt.textContent);
      if (shiftKey in SHIFT_LABELS && !ROLE_SINGULAR[key]) {
        opt.value = shiftKey;
        opt.textContent = SHIFT_LABELS[shiftKey];
      }
      if (/^all$|^усі$|^всі$/i.test(String(opt.value || opt.textContent).trim())) {
        opt.value = 'all';
        opt.textContent = 'Усі';
      }
    });
  }

  function setAttr(selector, attr, value, root = document) {
    root.querySelectorAll(selector).forEach((el) => el.setAttribute(attr, value));
  }

  function localizePageInfo(root = document) {
    const info = root.querySelector('#pageInfoText');
    if (!info) return;
    const txt = String(info.textContent || '').trim();
    const m = txt.match(/(?:Page|Сторінка)\s+(\d+)\s*\/\s*(\d+)(?:\s*•\s*(?:shown|показано)\s*(\d+)|\s*•\s*(\d+)\s*shown)?/i);
    if (m) {
      const shown = m[3] || m[4] || '';
      info.textContent = shown ? `Сторінка ${m[1]} / ${m[2]} • показано ${shown}` : `Сторінка ${m[1]} / ${m[2]}`;
    }
  }

  function localizeCommon(root = document) {
    document.documentElement.lang = 'uk';
    setAttr('[aria-label="Open menu"]', 'aria-label', 'Відкрити меню', root);
    setAttr('[aria-label="Close menu"]', 'aria-label', 'Закрити меню', root);
    setAttr('[aria-label="Final board view"]', 'aria-label', 'Фінальний план', root);

    root.querySelectorAll('#topRoleFilter').forEach((el) => localizeRoleSelect(el, true));
    root.querySelectorAll('#tpeRole,#pickerManualRole').forEach((el) => localizeRoleSelect(el, false));
    root.querySelectorAll('#topShiftFilter,#tpePlacementShift').forEach((el) => localizeRoleSelect(el, false));

    root.querySelectorAll('.tag--role').forEach((el) => { el.textContent = roleLabel(el.textContent); });
    root.querySelectorAll('.pill.yes').forEach((el) => { el.textContent = 'Так'; });
    root.querySelectorAll('.pill.no').forEach((el) => { el.textContent = 'Ні'; });

    root.querySelectorAll('.shift-badge,.player-placement-shift,.shift-tab,.board-shift-tab,[data-shift-tab]').forEach((el) => {
      const txt = String(el.textContent || '').trim();
      if (/^(?:shift\s*1|shift1)$/i.test(txt)) el.textContent = SHIFT_LABELS.shift1;
      else if (/^(?:shift\s*2|shift2)$/i.test(txt)) el.textContent = SHIFT_LABELS.shift2;
      else if (/^both$/i.test(txt)) el.textContent = SHIFT_LABELS.both;
    });
    root.querySelectorAll('*').forEach((el) => {
      const txt = leafText(el);
      if (!txt) return;
      if (/^Shift:\s*SHIFT\s*1$/i.test(txt) || /^Shift:\s*Зміна\s*1$/i.test(txt)) el.textContent = 'Зміна: ЗМІНА 1';
      else if (/^Shift:\s*SHIFT\s*2$/i.test(txt) || /^Shift:\s*Зміна\s*2$/i.test(txt)) el.textContent = 'Зміна: ЗМІНА 2';
      else if (/^→\s*Shift\s*1$/i.test(txt)) el.textContent = '→ Зміна 1';
      else if (/^→\s*Shift\s*2$/i.test(txt)) el.textContent = '→ Зміна 2';
      else if (/^→\s*Both$/i.test(txt)) el.textContent = '→ Обидві';
      else if (/^Shift 1:\s*/i.test(txt)) el.textContent = txt.replace(/^Shift 1:/i, 'Зміна 1:');
      else if (/^Shift 2:\s*/i.test(txt)) el.textContent = txt.replace(/^Shift 2:/i, 'Зміна 2:');
      else if (/^Both:\s*/i.test(txt)) el.textContent = txt.replace(/^Both:/i, 'Обидві:');
      else if (/^Both не чіпається$/i.test(txt)) el.textContent = 'Група «Обидві» не змінюється';
      else if (/^Оберіть башню зліва$/i.test(txt)) el.textContent = 'Оберіть турель зліва';
      else if (/^Очистити башню$/i.test(txt)) el.textContent = 'Очистити турель';
      else if (/^Зберегти таблицю башні$/i.test(txt)) el.textContent = 'Зберегти таблицю турелі';
      else if (/^Гравці в башні$/i.test(txt)) el.textContent = 'Гравці в турелі';
      else if (/^Додати вручну helper$/i.test(txt)) el.textContent = 'Додати помічника вручну';
      else if (/^Показати всі башні$/i.test(txt)) el.textContent = 'Показати всі турелі';
      else if (/^Роль \/ Tier$/i.test(txt)) el.textContent = 'Роль / Тір';
      else if (/^Башня не знайдена$/i.test(txt)) el.textContent = 'Турель не знайдена';
      else if (/^Башня готова$/i.test(txt)) el.textContent = 'Турель готова';
      else if (/^Башня не готова$/i.test(txt)) el.textContent = 'Турель не готова';
    });

    root.querySelectorAll('.player-placement-item strong').forEach((el) => {
      if (/^reserve$/i.test(String(el.textContent || '').trim())) el.textContent = 'Резерв';
    });
    root.querySelectorAll('.player-placement-item small').forEach((el) => {
      const txt = String(el.textContent || '').trim();
      if (/^captain$/i.test(txt)) el.textContent = 'Капітан';
      else if (/^helper$/i.test(txt)) el.textContent = 'Помічник';
      else if (/players in tower/i.test(txt)) el.textContent = txt.replace(/players in tower/i, 'Гравців у турелі');
      else if (/not assigned/i.test(txt)) el.textContent = 'Не призначено';
    });

    root.querySelectorAll('button,th,span,small,strong,h1,h2,h3,h4,p,div.muted,div.captain-title,div.captain-meta,summary,a,label').forEach((el) => {
      if (el.closest('td[data-field="name"],td[data-field="alliance"],td[data-field="march"],td[data-field="rally"],td[data-field="tier"]')) return;
      const txt = leafText(el);
      if (txt && EXACT_TEXT.has(txt)) el.textContent = EXACT_TEXT.get(txt);
    });

    root.querySelectorAll('.sort-btn[data-sort="tier"]').forEach((btn) => {
      btn.title = 'Сортувати за тіром';
      btn.setAttribute('aria-label', 'Сортувати за тіром');
    });
    root.querySelectorAll('.sort-btn[data-sort="rally"]').forEach((btn) => {
      btn.title = 'Сортувати за розміром ралі';
      btn.setAttribute('aria-label', 'Сортувати за розміром ралі');
    });

    localizePageInfo(root);
  }

  function refreshStats() {
    const players = Array.isArray(PNS?.state?.players) && PNS.state.players.length ? PNS.state.players : null;
    if (!players) return;
    let fighter = 0, rider = 0, shooter = 0, shift1 = 0, shift2 = 0, both = 0, captainReady = 0;
    players.forEach((p) => {
      const role = normalizeRole(p.role);
      const shift = normalizeShift(p.shift || p.shiftLabel || 'both');
      if (role === 'Fighter') fighter++;
      else if (role === 'Rider') rider++;
      else if (role === 'Shooter') shooter++;
      if (shift === 'shift1') shift1++;
      else if (shift === 'shift2') shift2++;
      else both++;
      if (p.captainReady) captainReady++;
    });
    const totalEl = document.querySelector('[data-stat-card="total"] strong');
    const capEl = document.querySelector('[data-stat-card="captains"] strong');
    if (totalEl) totalEl.textContent = String(players.length);
    if (capEl) capEl.textContent = String(captainReady);
    const roleEl = document.getElementById('roleCountsDisplay');
    if (roleEl) roleEl.innerHTML = `
      <span class="stat-chip stat-chip--role is-fighter"><b>${fighter}</b><small>${ROLE_PLURAL.Fighter}</small></span>
      <span class="stat-chip stat-chip--role is-rider"><b>${rider}</b><small>${ROLE_PLURAL.Rider}</small></span>
      <span class="stat-chip stat-chip--role is-shooter"><b>${shooter}</b><small>${ROLE_PLURAL.Shooter}</small></span>`;
    const shiftEl = document.getElementById('shiftCountsDisplay');
    if (shiftEl) shiftEl.innerHTML = `
      <span class="stat-chip stat-chip--shift is-shift1"><b>${shift1}</b><small>${SHIFT_LABELS.shift1}</small></span>
      <span class="stat-chip stat-chip--shift is-shift2"><b>${shift2}</b><small>${SHIFT_LABELS.shift2}</small></span>
      <span class="stat-chip stat-chip--shift is-both"><b>${both}</b><small>${SHIFT_LABELS.both}</small></span>`;
  }

  let raf = 0;
  function schedule() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = 0;
      localizeCommon(document);
      refreshStats();
    });
  }

  const observer = new MutationObserver(() => schedule());
  function init() {
    schedule();
    try { observer.disconnect(); } catch {}
    if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('htmx:afterSwap', schedule);
  document.addEventListener('htmx:afterSettle', schedule);
  document.addEventListener('players-table-rendered', schedule);
  document.addEventListener('players-table-data-changed', schedule);
  document.addEventListener('players-table-filters-changed', schedule);
  document.addEventListener('click', () => setTimeout(schedule, 0));
  if (document.readyState !== 'loading') init();
})();
