/*
 * UI compatibility and legacy shell helpers
 * Source parts: site_core_bundle_c.js
 */

(function(){const e=()=>{try{window.PNS?.bindStrongTowerSettingsButtons?.()}catch{}};"loading"===document.readyState?document.addEventListener("DOMContentLoaded",e):e(),document.addEventListener("pns:i18n-changed",e)}())
;
document.addEventListener("pns:i18n-changed",()=>{const e=document.getElementById("towerCalcModal")||document;try{window.setBoardLanguageLocales?.(window.getBoardDefaultLocales?.()||("function"==typeof window.getBoardLanguageLocales?window.getBoardLanguageLocales():["en"]))}catch{}try{window.PNS?.renderPlayersTableFromState?.()}catch{}try{window.PNS?.renderAll?.()}catch{}try{window.PNS?.installTowerCalcLayoutUi?.(e)}catch{}try{window.PNS?.patchTowerCalcPresentation?.(e)}catch{}try{window.PNS?.patchTowerCalcRuntimeUi?.()}catch{}try{window.renderStandaloneFinalBoard?.(document.getElementById("board-modal"))}catch{}try{window.PNS?.renderBoard?.()}catch{}try{window.calcRenderLiveFinalBoard?.(document.getElementById("towerCalcModal"))}catch{}try{window.PNS?.syncBoardLanguageSelects?.()}catch{}})
;
document.addEventListener("pns:i18n-applied",()=>{try{window.PNS?.syncBoardLanguageSelects?.()}catch{}try{window.renderStandaloneFinalBoard?.(document.getElementById("board-modal"))}catch{}try{window.PNS?.renderBoard?.()}catch{}try{window.calcRenderLiveFinalBoard?.(document.getElementById("towerCalcModal"))}catch{}})
;
(function(){
  const PNS = window.PNS = window.PNS || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function safeRun(fn) {
    try { fn(); } catch (error) { console.warn('[dom.js]', error); }
  }

  function ensureLegacyBaseEditorHelpers() {
    if (typeof PNS.shouldRenderLegacyBaseEditor !== 'function') {
      PNS.shouldRenderLegacyBaseEditor = () => false;
    }
    if (typeof PNS.isLegacyBaseEditorEnabled !== 'function') {
      PNS.isLegacyBaseEditorEnabled = () => {
        try { return !!PNS.shouldRenderLegacyBaseEditor(); } catch { return false; }
      };
    }
  }

  function syncLegacyBaseEditorFallbackCss() {
    const enabled = typeof PNS.isLegacyBaseEditorEnabled === 'function' && !!PNS.isLegacyBaseEditorEnabled();
    const linkId = 'pns-base-editor-fallback-css';
    const existing = document.getElementById(linkId);
    if (!enabled) {
      existing?.remove?.();
      return;
    }
    if (existing) return;
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = 'css/base-editor-fallback.css';
    document.head.appendChild(link);
  }

  function renderStats() {
    const players = Array.isArray(PNS?.state?.players) ? PNS.state.players : [];
    let total = 0;
    let captains = 0;
    let fighters = 0;
    let riders = 0;
    let shooters = 0;
<<<<<<< HEAD
    let shift1 = 0;
    let shift2 = 0;
    let both = 0;
=======
    const shiftCountsMap = { shift1: 0, shift2: 0, shift3: 0, shift4: 0, both: 0 };
    let detectedMaxShift = 0;
    let hasShiftData = false;

    const normalizeShiftLocal = (value) => {
      const raw = String(value ?? '').trim();
      if (!raw) return 'both';
      try {
        const normalized = typeof PNS.normalizeShiftValue === 'function' ? String(PNS.normalizeShiftValue(raw) || '').toLowerCase() : '';
        if (/^shift[1-4]$/.test(normalized) || normalized === 'both') return normalized;
      } catch {}
      const lowerRaw = raw.toLowerCase();
      if (/^shift[1-4]$/.test(lowerRaw)) return lowerRaw;
      if (lowerRaw === 'both' || lowerRaw === 'all' || lowerRaw === 'any') return 'both';
      if (/^[1-4]$/.test(lowerRaw)) return `shift${lowerRaw}`;

      const text = raw
        .normalize('NFKC')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[–—−]/g, '-')
        .replace(/\b\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\b/g, ' ')
        .replace(/\b\d+\s*(час|часа|часов|hours?|hrs?)\b/g, ' ')
        .replace(/[_.,;:()[\]{}|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!text) return 'both';
      if (/(both|all the time|all shifts?|any shift|обе|оба|обидв|две смены|дві зміни|両方|全部|すべて)/.test(text)) return 'both';

      if (/(^|\s)(shift|shifts|смена|смены|зміна|зміни|змiна)\s*[-: ]*1(\s|$)/.test(text) || /(first|1st|первая|первый|перша|перший|перв|перш)/.test(text)) return 'shift1';
      if (/(^|\s)(shift|shifts|смена|смены|зміна|зміни|змiна)\s*[-: ]*2(\s|$)/.test(text) || /(second|2nd|вторая|второй|друга|другий|втор|друг)/.test(text)) return 'shift2';
      if (/(^|\s)(shift|shifts|смена|смены|зміна|зміни|змін|змiна|zmiana|zmiany|schicht|schichten|ca)\s*[-: ]*3(\s|$)/.test(text) || /(^|\s)(3|three|third|3rd)\s*(shift|shifts|смена|смены|зміна|зміни|змін|змiна|zmiana|zmiany|schicht|schichten|ca)(\s|$)/.test(text) || /(third|3rd|третья|третий|третя|третій|треть|трет)/.test(text)) return 'shift3';
      if (/(^|\s)(shift|shifts|смена|смены|зміна|зміни|змін|змiна|zmiana|zmiany|schicht|schichten|ca)\s*[-: ]*4(\s|$)/.test(text) || /(^|\s)(4|four|fourth|4th)\s*(shift|shifts|смена|смены|зміна|зміни|змін|змiна|zmiana|zmiany|schicht|schichten|ca)(\s|$)/.test(text) || /(fourth|4th|четвертая|четвертий|четверта|четвер)/.test(text)) return 'shift4';

      return 'both';
    };

    const labelShift = (key) => {
      if (key === 'both') {
        const label = typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel('both') : '';
        return label && label !== 'both'
          ? label
          : (typeof PNS.t === 'function' ? PNS.t('both', 'Всі') : 'Всі');
      }
      const n = Number(String(key).replace('shift', '')) || 1;
      const fromI18n = typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(key) : '';
      if (fromI18n && fromI18n !== key) return fromI18n;
      return typeof PNS.t === 'function'
        ? PNS.t(`shift${n}`, `Зміна ${n}`)
        : `Зміна ${n}`;
    };

    const autoPickRegion1ShiftCount = (maxShift) => {
      const nextCount = Math.max(1, Math.min(4, Number(maxShift) || 2));
      try {
        const settingsKey = 'pns_import_region_shift_settings_v1';
        const settings = JSON.parse(localStorage.getItem(settingsKey) || 'null') || {};
        settings.regions = settings.regions || {};
        settings.regions.region1 = settings.regions.region1 || { enabled: true, shifts: {} };
        settings.regions.region1.enabled = true;

        const current = ['1', '2', '3', '4'].find((n) => !!settings.regions.region1.shifts?.[n]) || '2';

        // Якщо користувач вручну вибрав кількість змін для Home/Дім,
        // не перезаписуємо її автоматикою після renderStats.
        if (localStorage.getItem('pns_import_region1_shift_manual_override_v1') === '1') {
          return Math.max(1, Math.min(4, Number(current) || nextCount));
        }

        if (String(current) !== String(nextCount)) {
          settings.regions.region1.shifts = { '1': false, '2': false, '3': false, '4': false };
          settings.regions.region1.shifts[String(nextCount)] = true;
          localStorage.setItem(settingsKey, JSON.stringify(settings));
          if (PNS.importRegionShiftSettings) PNS.importRegionShiftSettings = settings;
          try { window.dispatchEvent(new CustomEvent('pns:region-shifts-changed', { detail: { region: 'region1' } })); } catch {}
          try { document.dispatchEvent(new CustomEvent('pns:region-shifts-changed', { detail: { region: 'region1' } })); } catch {}
        }
      } catch {}
      return nextCount;
    };

    const getFirstRegionShiftCount = () => {
      try {
        const settings = JSON.parse(localStorage.getItem('pns_import_region_shift_settings_v1') || 'null');
        const shifts = settings?.regions?.region1?.shifts || {};
        const selected = ['1', '2', '3', '4'].find((n) => !!shifts[n]) || '2';
        return Math.max(1, Math.min(4, Number(selected) || 2));
      } catch {
        return 2;
      }
    };

    const addPlayer = (roleValue, captainValue, shiftValue) => {
      const role = typeof PNS.normalizeRole === 'function'
        ? PNS.normalizeRole(roleValue)
        : String(roleValue || '');

      const shift = normalizeShiftLocal(shiftValue);

      if (captainValue === true || /yes|так|да/i.test(String(captainValue || ''))) captains += 1;
      if (role === 'Shooter') shooters += 1;
      else if (role === 'Fighter') fighters += 1;
      else if (role === 'Rider') riders += 1;

      if (Object.prototype.hasOwnProperty.call(shiftCountsMap, shift)) shiftCountsMap[shift] += 1;
      else shiftCountsMap.both += 1;

      if (/^shift[1-4]$/.test(shift)) {
        hasShiftData = true;
        detectedMaxShift = Math.max(detectedMaxShift, Number(shift.replace('shift', '')) || 0);
      } else if (shift === 'both') {
        hasShiftData = true;
      }
    };
>>>>>>> 4f53fe0 (update)

    if (players.length) {
      total = players.length;
      players.forEach((player) => {
<<<<<<< HEAD
        const role = typeof PNS.normalizeRole === 'function'
          ? PNS.normalizeRole(player.role)
          : String(player.role || '');
        const shift = typeof PNS.normalizeShiftValue === 'function'
          ? PNS.normalizeShiftValue(player.shift || player.shiftLabel || 'both')
          : String(player.shift || player.shiftLabel || 'both');

        if (player.captainReady) captains += 1;
        if (role === 'Shooter') shooters += 1;
        else if (role === 'Fighter') fighters += 1;
        else if (role === 'Rider') riders += 1;

        if (shift === 'shift1') shift1 += 1;
        else if (shift === 'shift2') shift2 += 1;
        else both += 1;
=======
        const importShift = player.registeredShiftRaw || player.raw?.shift_availability || player.registeredShift || player.registeredShiftLabel || player.shift || player.shiftLabel || 'both';
        const displayShift = player.manualShiftOverride ? (player.shift || player.shiftLabel || importShift) : importShift;
        addPlayer(
          player.role,
          player.captainReady,
          displayShift,
        );
        const importedNormalized = normalizeShiftLocal(importShift);
        if (/^shift[1-4]$/.test(importedNormalized)) {
          hasShiftData = true;
          detectedMaxShift = Math.max(detectedMaxShift, Number(importedNormalized.replace('shift', '')) || 0);
        }
>>>>>>> 4f53fe0 (update)
      });
    } else {
      const rows = $$('#playersDataTable tbody tr');
      total = rows.length;
      rows.forEach((row) => {
        const cells = $$('td', row);
        const roleText = (row.querySelector('td[data-field="role"]') || cells[2])?.textContent || '';
        const captainText = (row.querySelector('td[data-field="captainReady"]') || cells[6])?.textContent || '';
        const shiftText = (row.querySelector('td[data-field="shiftLabel"]') || cells[7])?.textContent || row.dataset.shift || 'both';
<<<<<<< HEAD
        const role = typeof PNS.normalizeRole === 'function' ? PNS.normalizeRole(roleText) : roleText;
        const shift = typeof PNS.normalizeShiftValue === 'function' ? PNS.normalizeShiftValue(shiftText) : shiftText;

        if (/yes|так|да/i.test(captainText)) captains += 1;
        if (role === 'Shooter') shooters += 1;
        else if (role === 'Fighter') fighters += 1;
        else if (role === 'Rider') riders += 1;

        if (shift === 'shift1') shift1 += 1;
        else if (shift === 'shift2') shift2 += 1;
        else both += 1;
      });
    }

=======
        addPlayer(roleText, captainText, shiftText);
      });
    }

    if (hasShiftData) autoPickRegion1ShiftCount(detectedMaxShift);

>>>>>>> 4f53fe0 (update)
    const totalEl = document.querySelector('[data-stat-card="total"] strong');
    const captainsEl = document.querySelector('[data-stat-card="captains"] strong');
    if (totalEl) totalEl.textContent = String(total);
    if (captainsEl) captainsEl.textContent = String(captains);

    const roleCounts = document.getElementById('roleCountsDisplay');
    if (roleCounts && typeof PNS.renderHtmlTemplate === 'function') {
      const roleLabel = (role, plural = false) => typeof PNS.roleLabel === 'function'
        ? PNS.roleLabel(role, { plural })
        : role;
      roleCounts.innerHTML = PNS.renderHtmlTemplate('tpl-stats-role-chips', {
        fighter_count: fighters,
        fighter_label: roleLabel('Fighter', true),
        rider_count: riders,
        rider_label: roleLabel('Rider', true),
        shooter_count: shooters,
        shooter_label: roleLabel('Shooter', true),
      });
    }

    const shiftCounts = document.getElementById('shiftCountsDisplay');
<<<<<<< HEAD
    if (shiftCounts && typeof PNS.renderHtmlTemplate === 'function') {
      const shiftLabel = (value) => typeof PNS.shiftLabel === 'function' ? PNS.shiftLabel(value) : value;
      shiftCounts.innerHTML = PNS.renderHtmlTemplate('tpl-stats-shift-chips', {
        shift1_count: shift1,
        shift1_label: shiftLabel('shift1'),
        shift2_count: shift2,
        shift2_label: shiftLabel('shift2'),
        both_count: both,
        both_label: shiftLabel('both'),
      });
=======
    if (shiftCounts) {
      const firstRegionShiftCount = getFirstRegionShiftCount();
      const activeShifts = Array.from({ length: firstRegionShiftCount }, (_, index) => `shift${index + 1}`);
      const chips = [...activeShifts, 'both'];
      const statsGrid = shiftCounts.closest('.stats-grid--players');
      shiftCounts.classList.toggle('is-many-shifts', chips.length > 3);
      shiftCounts.setAttribute('data-shift-count', String(chips.length));
      shiftCounts.style.setProperty('--players-shift-columns', String(chips.length));
      if (statsGrid) statsGrid.setAttribute('data-shift-card-count', String(chips.length));
      shiftCounts.innerHTML = chips.map((key) => {
        const count = key === 'both' ? shiftCountsMap.both : shiftCountsMap[key] || 0;
        return `<span class="stat-chip stat-chip--shift is-${key}"><b>${count}</b><small>${labelShift(key)}</small></span>`;
      }).join('');
      try { PNS.syncTopShiftFilterOptions?.(); } catch {}
>>>>>>> 4f53fe0 (update)
    }
  }

  function syncLegacyBaseEditors() {
    const enabled = typeof PNS.isLegacyBaseEditorEnabled === 'function' && !!PNS.isLegacyBaseEditorEnabled();
    $$('.base-editor').forEach((editor) => {
      if (!enabled) {
        editor.remove();
        return;
      }
      editor.style.display = 'none';
      editor.querySelector('.base-editor-details')?.remove?.();
    });
  }

  function markCaptainRows() {
    $$('.board-col ul li:first-child').forEach((row) => row.classList.add('is-captain-row'));
  }

  function closeSettingsFieldEditMode() {
    $('#settings-modal')?.classList.remove('show-field-label-edits');
  }

  let statsRaf = 0;
  function scheduleStatsRender() {
    if (statsRaf) cancelAnimationFrame(statsRaf);
    statsRaf = requestAnimationFrame(() => {
      statsRaf = 0;
      safeRun(renderStats);
    });
  }

  let basesObserver = null;
  let boardObserver = null;
  function installObservers() {
    try { basesObserver?.disconnect?.(); } catch {}
    try { boardObserver?.disconnect?.(); } catch {}
    basesObserver = null;
    boardObserver = null;

    const basesGrid = $('.bases-grid');
    if (basesGrid) {
      basesObserver = new MutationObserver(() => safeRun(syncLegacyBaseEditors));
      basesObserver.observe(basesGrid, { childList: true, subtree: true });
    }

    const boardGrid = $('.board-grid');
    if (boardGrid) {
      boardObserver = new MutationObserver(() => safeRun(markCaptainRows));
      boardObserver.observe(boardGrid, { childList: true, subtree: true });
    }
  }

  function initDomCompat() {
    safeRun(ensureLegacyBaseEditorHelpers);
    safeRun(syncLegacyBaseEditorFallbackCss);
    safeRun(renderStats);
    safeRun(syncLegacyBaseEditors);
    safeRun(markCaptainRows);
    safeRun(closeSettingsFieldEditMode);
    safeRun(installObservers);
  }

  document.addEventListener('players-table-data-changed', scheduleStatsRender);
  document.addEventListener('pns:assignment-changed', scheduleStatsRender);
  document.addEventListener('pns:i18n-changed', scheduleStatsRender);
<<<<<<< HEAD
=======
  document.addEventListener('pns:region-shifts-changed', scheduleStatsRender);
  document.addEventListener('pns:import-region-settings-reset', scheduleStatsRender);
  window.addEventListener('pns:region-shifts-changed', scheduleStatsRender);
  window.addEventListener('pns:import-region-settings-reset', scheduleStatsRender);
>>>>>>> 4f53fe0 (update)

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDomCompat, { once: true });
  } else {
    initDomCompat();
  }
})();
(function(){const e=(e,t=document)=>t.querySelector(e),t=(e,t=document)=>Array.from(t.querySelectorAll(e)),a=(e,t="")=>"function"==typeof window.PNS?.t?window.PNS.t(e,t):t,r=new WeakMap;function n(e,t,a,n,o){if(!e)return;if(e&&1===e.nodeType){const r=`bound_${t}_${a}`;if("1"===e.dataset[r])return;return e.dataset[r]="1",void e.addEventListener(a,n,o)}let i=r.get(e);i||(i=new Set,r.set(e,i));const s=`${t}::${a}`;i.has(s)||(i.add(s),e.addEventListener(a,n,o))}function o(){const e=document.getElementById("burgerBtn"),t=document.getElementById("drawer");!e||!t||t.classList.contains("is-open")&&(t.classList.remove("is-open"),e.classList.remove("is-open"),e.setAttribute("aria-expanded","false"),t.setAttribute("aria-hidden","true"),document.documentElement.style.overflow="")}function i(){const r=e("#settings-modal"),n=e("#settings-modal .modal-card"),o=e("#settings-modal .modal-grid");if(!r||!n||!o)return;const i=t(".modal-grid > section.panel.subpanel",o);if(!i.length)return;n.querySelector(".settings-side-menu")?.remove();const s=document.createElement("aside");s.className="settings-side-menu";const l=document.createElement("div");l.className="settings-side-list",i.forEach((e,r)=>{e.dataset.settingsSection=String(r);const n=e.querySelector("h3"),o=document.createElement("button");o.type="button",o.className="settings-side-btn"+(0===r?" active":"");const c=n?.getAttribute?.("data-i18n")||"",d=c?a(c,n?.textContent||""):n?n.textContent:"";o.textContent=d?d.replace(/^\d+\.\s*/,""):`${a("section_word","Розділ")} ${r+1}`,o.dataset.targetSection=String(r),o.addEventListener("click",()=>{t(".settings-side-btn",s).forEach(e=>e.classList.toggle("active",e===o)),i.forEach(e=>e.hidden=e.dataset.settingsSection!==o.dataset.targetSection)}),l.appendChild(o),e.hidden=0!==r}),s.appendChild(l),n.querySelector(".modal-head")?.insertAdjacentElement("afterend",s),n.classList.add("has-settings-side-menu"),n.dataset.v4MenuBuilt="1",r.classList.remove("show-field-label-edits")}function s(){i(),function(){const e=document.getElementById("burgerBtn"),t=document.getElementById("drawer"),a=document.getElementById("drawerBackdrop"),r=document.getElementById("drawerClose");function o(){t.classList.remove("is-open"),e.classList.remove("is-open"),e.setAttribute("aria-expanded","false"),t.setAttribute("aria-hidden","true"),t.querySelector(".drawer-lang-group")?.removeAttribute?.("open"),document.documentElement.style.overflow=""}e&&t&&a&&r&&(n(e,"drawer","click",a=>{a.preventDefault(),t.classList.contains("is-open")?o():(t.classList.add("is-open"),e.classList.add("is-open"),e.setAttribute("aria-expanded","true"),t.setAttribute("aria-hidden","false"),t.querySelector(".drawer-lang-group")?.removeAttribute?.("open"),document.documentElement.style.overflow="hidden")}),n(a,"drawer","click",e=>{e.preventDefault(),o()}),n(r,"drawer","click",e=>{e.preventDefault(),o()}),n(document,"drawer","keydown",e=>{"Escape"===e.key&&o()}),[["openSettingsBtnMobile",()=>window.PNS?.openModal?.("settings")],["openBoardBtnMobile",()=>{window.PNS?.openModal?.("board"),window.PNS?.renderBoard?.(),window.PNS?.syncBoardLanguageSelects?.(),window.PNS?.ensureBoardLanguagePickerHosts?.(),setTimeout(()=>{window.PNS?.syncBoardLanguageSelects?.(),window.PNS?.ensureBoardLanguagePickerHosts?.()},40)}],["openTowerCalcBtnMobile",()=>window.PNS?.openTowerCalculatorModal?.()||window.PNS?.ModalsShift?.openTowerCalculatorModal?.()]].forEach(([e,t])=>{const a=document.getElementById(e);a&&n(a,`drawerAction_${e}`,"click",e=>{e.preventDefault(),e.stopPropagation(),o();try{t?.()}catch{}})}),t.classList.contains("is-open")&&"false"!==t.getAttribute("aria-hidden")&&o())}(),function(){const e=document.getElementById("openImportQuickBtn");e&&n(e,"quickOpen","click",e=>{e.preventDefault();try{window.PNS?.openModal?.("settings")}catch{}});const r=document.getElementById("shareBoardBtn");r&&n(r,"shareBoard","click",async e=>{if(e.defaultPrevented)return;e.preventDefault();if(r.closest("#board-modal")&&window.shareBoardAsImage){try{await window.shareBoardAsImage();return}catch{}}const t=location.href.split("#")[0]+"#board-modal";try{navigator.share?await navigator.share({title:`P&S ${a("final_plan","Фінальний план")}`,text:a("final_plan","Фінальний план"),url:t}):(await navigator.clipboard.writeText(t),alert(a("link_copied","Посилання скопійовано")))}catch{}})}()}"loading"===document.readyState?document.addEventListener("DOMContentLoaded",s):s(),n(document,"i18n","pns:i18n-changed",()=>{try{i()}catch{}try{window.PNS?.reInitImportWizard?.()}catch{}})}())


;(() => {
  const root = window.PNS = window.PNS || {};
  const t = (k, f='') => typeof root.t === 'function' ? root.t(k, f) : f;

  function getSettingsModal() {
    return document.getElementById('settings-modal');
  }

  function getSettingsCard() {
    return getSettingsModal()?.querySelector('.modal-card');
  }

  function getSettingsGrid() {
    return getSettingsModal()?.querySelector('.modal-grid');
  }

  function getSections() {
    const grid = getSettingsGrid();
    return grid ? Array.from(grid.querySelectorAll(':scope > section.panel.subpanel')) : [];
  }

  function activateSettingsSection(index) {
    const modal = getSettingsModal();
    const grid = getSettingsGrid();
    const sections = getSections();
    if (!modal || !grid || !sections.length) return;
    const safeIndex = Math.max(0, Math.min(index, sections.length - 1));
    sections.forEach((section, i) => {
      section.hidden = i !== safeIndex;
      section.setAttribute('aria-hidden', i !== safeIndex ? 'true' : 'false');
    });
    modal.querySelectorAll('.settings-side-btn').forEach((btn, i) => {
      const active = i === safeIndex;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    grid.scrollTop = 0;
  }

  function buildSettingsSideMenu() {
    const modal = getSettingsModal();
    const card = getSettingsCard();
    const grid = getSettingsGrid();
    if (!modal || !card || !grid) return;
    const sections = Array.from(grid.querySelectorAll(':scope > section.panel.subpanel'));
    if (!sections.length) return;

    card.querySelector('.settings-side-menu')?.remove();

    const side = document.createElement('aside');
    side.className = 'settings-side-menu';
    const list = document.createElement('div');
    list.className = 'settings-side-list';
    side.appendChild(list);

    sections.forEach((section, index) => {
      section.dataset.settingsSection = String(index);
      const titleEl = section.querySelector('h3');
      const label = (titleEl?.getAttribute('data-i18n') ? t(titleEl.getAttribute('data-i18n'), titleEl.textContent || '') : (titleEl?.textContent || `${t('section_word','Розділ')} ${index + 1}`)).replace(/^\d+\.\s*/, '');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'settings-side-btn';
      btn.dataset.targetSection = String(index);
      btn.textContent = label;
      list.appendChild(btn);
    });

    card.querySelector('.modal-head')?.insertAdjacentElement('afterend', side);
    card.classList.add('has-settings-side-menu');
    activateSettingsSection(0);
  }

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('#settings-modal .settings-side-btn');
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    activateSettingsSection(Number(btn.dataset.targetSection || 0));
  }, true);

  const oldOpenModal = root.ModalsShift?.openModal;
  if (root.ModalsShift && typeof oldOpenModal === 'function' && !root.ModalsShift.__settingsMenuFixWrapped) {
    root.ModalsShift.__settingsMenuFixWrapped = true;
    root.ModalsShift.openModal = function(name) {
      const res = oldOpenModal.call(this, name);
      if (String(name || '').toLowerCase().includes('settings')) {
        setTimeout(() => {
          buildSettingsSideMenu();
          activateSettingsSection(0);
          const grid = getSettingsGrid();
          if (grid) grid.scrollTop = 0;
          const card = getSettingsCard();
          if (card) card.scrollTop = 0;
        }, 0);
      }
      return res;
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildSettingsSideMenu, { once: true });
  } else {
    buildSettingsSideMenu();
  }
  document.addEventListener('pns:i18n-changed', buildSettingsSideMenu);
})();
