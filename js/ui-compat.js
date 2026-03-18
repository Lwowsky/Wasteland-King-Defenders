/*
 * UI compatibility and legacy shell helpers
 * Source parts: site_core_bundle_c.js
 */

(function(){const e=()=>{try{window.PNS?.bindStrongTowerSettingsButtons?.()}catch{}};"loading"===document.readyState?document.addEventListener("DOMContentLoaded",e):e(),document.addEventListener("pns:i18n-changed",e)}())
;
document.addEventListener("pns:i18n-changed",()=>{try{window.setBoardLanguageLocales?.(window.getBoardDefaultLocales?.()||("function"==typeof window.getBoardLanguageLocales?window.getBoardLanguageLocales():["en"]))}catch{}try{window.renderStandaloneFinalBoard?.(document.getElementById("board-modal"))}catch{}try{window.PNS?.renderBoard?.()}catch{}try{window.calcRenderLiveFinalBoard?.(document.getElementById("towerCalcModal"))}catch{}try{window.PNS?.syncBoardLanguageSelects?.()}catch{}})
;
document.addEventListener("pns:i18n-applied",()=>{try{window.PNS?.syncBoardLanguageSelects?.()}catch{}try{window.renderStandaloneFinalBoard?.(document.getElementById("board-modal"))}catch{}try{window.PNS?.renderBoard?.()}catch{}try{window.calcRenderLiveFinalBoard?.(document.getElementById("towerCalcModal"))}catch{}})
;
(function(){const e=window.PNS=window.PNS||{},t=(e,t=document)=>t.querySelector(e),a=(e,t=document)=>Array.from(t.querySelectorAll(e));function r(e){try{e()}catch(e){console.warn("[dom.js]",e)}}function n(){"function"!=typeof e.shouldRenderLegacyBaseEditor&&(e.shouldRenderLegacyBaseEditor=()=>!1),"function"!=typeof e.isLegacyBaseEditorEnabled&&(e.isLegacyBaseEditorEnabled=()=>{try{return!!e.shouldRenderLegacyBaseEditor()}catch{}return!1})}function o(){const t="function"==typeof e.isLegacyBaseEditorEnabled&&!!e.isLegacyBaseEditorEnabled(),a="pns-base-editor-fallback-css",r=document.getElementById(a);if(!t)return void r?.remove?.();if(r)return;const n=document.createElement("link");n.id=a,n.rel="stylesheet",n.href="css/base-editor-fallback.css",document.head.appendChild(n)}function i(){const t=Array.isArray(e?.state?.players)&&e.state.players.length?e.state.players:[];let r=0,n=0,o=0,i=0,s=0,l=0,c=0,d=0;if(t.length)r=t.length,t.forEach(t=>{const a="function"==typeof e.normalizeRole?e.normalizeRole(t.role):String(t.role||""),r="function"==typeof e.normalizeShiftValue?e.normalizeShiftValue(t.shift||t.shiftLabel||"both"):String(t.shift||"both");t.captainReady&&n++,"Shooter"===a?o++:"Fighter"===a?i++:"Rider"===a&&s++,"shift1"===r?l++:"shift2"===r?c++:d++});else{const t=a("#playersDataTable tbody tr");r=t.length,t.forEach(t=>{const r=a("td",t),u=(t.querySelector('td[data-field="role"]')||r[2])?.textContent||"",p=(t.querySelector('td[data-field="captainReady"]')||r[6])?.textContent||"",h=(t.querySelector('td[data-field="shiftLabel"]')||r[7])?.textContent||t.dataset.shift||"both",f="function"==typeof e.normalizeRole?e.normalizeRole(u):u,m="function"==typeof e.normalizeShiftValue?e.normalizeShiftValue(h):h;/yes|так|да/i.test(p)&&n++,"Shooter"===f?o++:"Fighter"===f?i++:"Rider"===f&&s++,"shift1"===m?l++:"shift2"===m?c++:d++})}const u=document.querySelector('[data-stat-card="total"] strong'),p=document.querySelector('[data-stat-card="captains"] strong');u&&(u.textContent=String(r)),p&&(p.textContent=String(n));const h=document.getElementById("roleCountsDisplay");h&&(h.innerHTML=function(t,a,r){const n=(t,a=!1)=>"function"==typeof e.roleLabel?e.roleLabel(t,{plural:a}):t;return e.renderHtmlTemplate("tpl-stats-role-chips",{fighter_count:t,fighter_label:n("Fighter",!0),rider_count:a,rider_label:n("Rider",!0),shooter_count:r,shooter_label:n("Shooter",!0)})}(i,s,o));const f=document.getElementById("shiftCountsDisplay");f&&(f.innerHTML=function(t,a,r){const n=t=>"function"==typeof e.shiftLabel?e.shiftLabel(t):t;return e.renderHtmlTemplate("tpl-stats-shift-chips",{shift1_count:t,shift1_label:n("shift1"),shift2_count:a,shift2_label:n("shift2"),both_count:r,both_label:n("both")})}(l,c,d));}function s(){const t="function"==typeof e.isLegacyBaseEditorEnabled&&!!e.isLegacyBaseEditorEnabled();a(".base-editor").forEach(e=>{if(!t)return void e.remove();e.style.display="none";const a=e.querySelector(".base-editor-details");a&&a.remove()})}function l(){}function c(){a(".board-col ul li:first-child").forEach(e=>e.classList.add("is-captain-row"))}function d(){const e=t("#settings-modal");e&&e.classList.remove("show-field-label-edits")}let u=null,p=null,h=null;function f(){!function(){try{u?.disconnect()}catch{}try{p?.disconnect()}catch{}try{h?.disconnect()}catch{}u=p=h=null}();const e=t("#playersDataTable tbody");e&&(u=new MutationObserver(()=>{window.__pnsStatsRaf&&cancelAnimationFrame(window.__pnsStatsRaf),window.__pnsStatsRaf=requestAnimationFrame(()=>{window.__pnsStatsRaf=0,r(i)})}),u.observe(e,{childList:!0,subtree:!0,characterData:!0}));const a=t(".bases-grid");a&&(p=new MutationObserver(()=>{r(s)}),p.observe(a,{childList:!0,subtree:!0}));const n=t(".board-grid");n&&(h=new MutationObserver(()=>{r(c)}),h.observe(n,{childList:!0,subtree:!0}))}function m(){r(n),r(o),r(i),r(l),r(s),r(c),r(d),r(f)}"loading"===document.readyState?document.addEventListener("DOMContentLoaded",m):m()}())
;
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
