/* Modal registry and modal lookup helpers */
(function(){const e=window.PNS;if(!e)return;const t=e.ModalsShift=e.ModalsShift||{},a=e.state||(e.state={}),r=(e.$,e.$$||((e,t=document)=>Array.from(t.querySelectorAll(e)))),n=(t,a="")=>"function"==typeof e.t?e.t(t,a):a;function o(){const t=e.modals||{};return{settings:t.settings||document.getElementById("settings-modal"),board:t.board||document.getElementById("board-modal"),towerPicker:null,towerPlayerEdit:document.getElementById("towerPlayerEditModal"),towerCalc:document.getElementById("towerCalcModal")}}function i(){const t=e.buttons||(e.buttons={});return t.showAllData=document.getElementById("showAllDataBtn"),t}function s(){!function(){if(document.querySelector(".modal.is-open"))return!0;const e=String(location.hash||"");if(e&&e.length>1){const t=document.getElementById(e.slice(1));if(t&&t.classList&&t.classList.contains("modal"))try{if("none"!==getComputedStyle(t).display)return!0}catch{}}return!1}()?document.documentElement.style.overflow="":(function(){const e=document.getElementById("burgerBtn"),t=document.getElementById("drawer");!e||!t||t.classList.contains("is-open")&&(t.classList.remove("is-open"),e.classList.remove("is-open"),e.setAttribute("aria-expanded","false"),t.setAttribute("aria-hidden","true"))}(),document.documentElement.style.overflow="hidden")}function l(){const e=!!a.showAllColumns,t=i();t.showAllData&&(t.showAllData.setAttribute("aria-pressed",String(e)),t.showAllData.classList.toggle("toggle-on",e),t.showAllData.textContent=e?n("hide_data","Сховати дані"):n("show_all_data","Показати всі дані"))}function c(){r('#columnVisibilityChecks input[type="checkbox"][data-col-key]').forEach(e=>{e.checked=(a.visibleOptionalColumns||[]).includes(e.dataset.colKey)})}function d(t){a.showAllColumns=!!t;const n=new Set(a.visibleOptionalColumns||[]);r(".optional-col").forEach(e=>{const t=e.dataset.colKey||"",r=!t||!!a.showAllColumns&&n.has(t);e.classList.toggle("is-hidden-col",!r)}),c(),l();try{"function"==typeof e.safeWriteBool?e.safeWriteBool(e.KEYS.KEY_SHOW_ALL,a.showAllColumns):localStorage.setItem(e.KEYS.KEY_SHOW_ALL,a.showAllColumns?"1":"0")}catch{}}function u(){const e=o();Object.values(e).forEach(e=>e&&e.classList.remove("is-open")),s(),a.activeModal=null}Object.assign(t,{__splitCore:"1",getModals:o,getShiftTabs:function(){return e.shiftTabs||r("[data-shift-tab]")},getButtons:i,syncBodyModalLock:s,ensureStep4Styles:function(){},openModal:function(e){u();const r=function(e){const t=String(e||"").trim().toLowerCase();return t?"settings"===t||"settings-modal"===t?"settings":"board"===t||"board-modal"===t?"board":"towerpicker"===t||"tower-picker"===t||"picker"===t?"towerPicker":"towerplayeredit"===t||"tower-player-edit"===t||"playeredit"===t?"towerPlayerEdit":"towercalc"===t||"tower-calc"===t||"calculator"===t?"towerCalc":e:""}(e),n=o()[r];if(n){n.classList.add("is-open");try{n.querySelector(".modal-card")&&(n.querySelector(".modal-card").scrollTop=0),n.querySelector(".board-standalone-preview")&&(n.querySelector(".board-standalone-preview").scrollTop=0),n.querySelector("#boardModalPreviewSheet")&&(n.querySelector("#boardModalPreviewSheet").scrollTop=0),n.querySelector("#towerCalcMainTabs")&&(n.querySelector("#towerCalcMainTabs").scrollLeft=0),n.querySelector(".tower-calc-preview-toolbar")&&(n.querySelector(".tower-calc-preview-toolbar").scrollLeft=0),n.querySelector("#tcv35-row")&&(n.querySelector("#tcv35-row").scrollLeft=0)}catch{}try{t.updateShiftTabButtons?.()}catch{}s(),a.activeModal=r,"board"===r&&(requestAnimationFrame(()=>{try{n.querySelector(".modal-card")&&(n.querySelector(".modal-card").scrollTop=0),n.querySelector(".board-standalone-preview")&&(n.querySelector(".board-standalone-preview").scrollTop=0),n.querySelector("#boardModalPreviewSheet")&&(n.querySelector("#boardModalPreviewSheet").scrollTop=0)}catch{}try{window.renderStandaloneFinalBoard?.(n)}catch{}try{window.PNS?.renderBoard?.()}catch{}try{window.PNS?.ensureBoardLanguagePickerHosts?.()}catch{}try{window.PNS?.syncBoardLanguageSelects?.()}catch{}}),setTimeout(()=>{try{n.querySelector(".modal-card")&&(n.querySelector(".modal-card").scrollTop=0),n.querySelector(".board-standalone-preview")&&(n.querySelector(".board-standalone-preview").scrollTop=0)}catch{}try{window.renderStandaloneFinalBoard?.(n)}catch{}try{window.PNS?.renderBoard?.()}catch{}try{window.PNS?.ensureBoardLanguagePickerHosts?.()}catch{}try{window.PNS?.syncBoardLanguageSelects?.()}catch{}},40))}},closeModal:u,applyColumnVisibility:d,toggleColumns:function(){d(!a.showAllColumns)},syncToggleButtons:l,syncVisibilityCheckboxes:c})}());

;


(function(){
  const PNS = window.PNS;
  const modals = PNS?.ModalsShift;
  if (!PNS || !modals) return;

  function hasOpenOverlay(){
    if (document.querySelector('.modal.is-open')) return true;
    const hash = String(location.hash || '');
    if (hash && hash.length > 1) {
      const el = document.getElementById(hash.slice(1));
      if (el?.classList?.contains('modal')) {
        try { if (getComputedStyle(el).display !== 'none') return true; } catch {}
      }
    }
    return false;
  }

  function hasOpenDrawer(){
    return !!document.getElementById('drawer')?.classList.contains('is-open');
  }

  function applyPageLock(locked){
    const root = document.documentElement;
    const body = document.body;
    if (!body) return;
    if (locked) {
      if (!body.dataset.pnsScrollLockY) {
        const y = window.scrollY || window.pageYOffset || 0;
        body.dataset.pnsScrollLockY = String(y);
        body.style.position = 'fixed';
        body.style.top = `-${y}px`;
        body.style.left = '0';
        body.style.right = '0';
        body.style.width = '100%';
      }
      body.style.overflow = 'hidden';
      root.style.overflow = 'hidden';
      body.classList.add('pns-scroll-locked');
    } else {
      const y = Number(body.dataset.pnsScrollLockY || 0) || 0;
      delete body.dataset.pnsScrollLockY;
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      body.style.overflow = '';
      root.style.overflow = '';
      body.classList.remove('pns-scroll-locked');
      if (Math.abs((window.scrollY || 0) - y) > 1) {
        window.scrollTo(0, y);
      }
    }
  }

  function syncBodyModalLock(){
    const shouldLock = hasOpenOverlay() || hasOpenDrawer();
    if (hasOpenOverlay()) {
      const burgerBtn = document.getElementById('burgerBtn');
      const drawer = document.getElementById('drawer');
      if (drawer?.classList.contains('is-open')) {
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
      }
      if (burgerBtn) {
        burgerBtn.classList.remove('is-open');
        burgerBtn.setAttribute('aria-expanded', 'false');
      }
    }
    applyPageLock(shouldLock);
  }

  modals.syncBodyModalLock = syncBodyModalLock;
  PNS.syncBodyModalLock = syncBodyModalLock;

  const openModal = modals.openModal;
  if (typeof openModal === 'function' && !openModal.__pnsLockWrapped) {
    const wrapped = function(){
      const result = openModal.apply(this, arguments);
      syncBodyModalLock();
      return result;
    };
    wrapped.__pnsLockWrapped = true;
    modals.openModal = PNS.openModal = wrapped;
  }

  const closeModal = modals.closeModal;
  if (typeof closeModal === 'function' && !closeModal.__pnsLockWrapped) {
    const wrapped = function(){
      const result = closeModal.apply(this, arguments);
      syncBodyModalLock();
      return result;
    };
    wrapped.__pnsLockWrapped = true;
    modals.closeModal = PNS.closeModal = wrapped;
  }

  ['touchmove','wheel'].forEach((eventName) => {
    document.addEventListener(eventName, (ev) => {
      if (ev.target.closest('.modal-backdrop, .drawer-backdrop')) {
        ev.preventDefault();
      }
    }, { passive: false, capture: true });
  });

  document.addEventListener('click', (ev) => {
    const langItem = ev.target.closest('#drawer .lang-item');
    if (langItem) {
      const group = langItem.closest('.drawer-lang-group');
      if (group?.removeAttribute) group.removeAttribute('open');
    }
    const drawerToggle = ev.target.closest('#burgerBtn, #drawerBackdrop, #drawerClose, #openSettingsBtnMobile, #openBoardBtnMobile, #openTowerCalcBtnMobile');
    if (drawerToggle) {
      setTimeout(syncBodyModalLock, 0);
    }
    const closeModalTrigger = ev.target.closest('[data-close-modal]');
    if (closeModalTrigger) {
      setTimeout(syncBodyModalLock, 0);
    }
  }, true);

  window.addEventListener('hashchange', () => setTimeout(syncBodyModalLock, 0));

  ['touchmove','wheel'].forEach((eventName) => {
    document.addEventListener(eventName, (ev) => {
      const openModal = document.querySelector('.modal.is-open');
      if (!openModal) return;
      const allowed = ev.target.closest('.modal-card, .drawer-panel, .board-lang-dialog-card, [data-board-lang-dialog-shell]');
      if (!allowed) {
        ev.preventDefault();
      }
    }, { passive: false, capture: true });
  });

  document.addEventListener('DOMContentLoaded', syncBodyModalLock);
})();

;(function(){
  const root = document;
  function resetScroller(el) {
    if (!el) return;
    try { el.scrollLeft = 0; } catch {}
  }
  root.addEventListener('click', function(ev){
    const mainTab = ev.target.closest?.('[data-calc-main-tab]');
    if (mainTab) {
      const wrap = document.getElementById('towerCalcMainTabs');
      setTimeout(() => {
        try { mainTab.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } catch {}
        resetScroller(wrap);
      }, 0);
    }
    const shiftTab = ev.target.closest?.('#board-modal [data-shift-tab], #towerCalcModal [data-calc-preview-shift], #towerCalcModal [data-shift-tab]');
    if (shiftTab) {
      setTimeout(() => {
        resetScroller(shiftTab.closest('.tower-calc-preview-toolbar'));
      }, 0);
    }
  }, true);
})();
