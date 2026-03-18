(function(){
  const modalSel = '#settings-modal';
  function getModal(){ return document.querySelector(modalSel); }
  function getCard(){ return getModal()?.querySelector('.modal-card'); }
  function getGrid(){ return getModal()?.querySelector('.modal-grid'); }
  function getSections(){
    const grid = getGrid();
    return grid ? Array.from(grid.querySelectorAll(':scope > section.panel.subpanel')) : [];
  }
  function ensureSideButtons(){
    const modal = getModal();
    const card = getCard();
    const grid = getGrid();
    const sections = getSections();
    if(!modal || !card || !grid || !sections.length) return;
    let side = card.querySelector('.settings-side-menu');
    let list = side?.querySelector('.settings-side-list');
    if(!side || !list || list.children.length !== sections.length){
      side?.remove?.();
      side = document.createElement('aside');
      side.className = 'settings-side-menu';
      list = document.createElement('div');
      list.className = 'settings-side-list';
      side.appendChild(list);
      card.querySelector('.modal-head')?.insertAdjacentElement('afterend', side);
    } else {
      list.innerHTML = '';
    }
    const t = (k, f='') => typeof window.PNS?.t === 'function' ? window.PNS.t(k, f) : f;
    sections.forEach((section, index) => {
      section.dataset.settingsSection = String(index);
      const titleEl = section.querySelector('h3');
      const label = ((titleEl?.getAttribute('data-i18n') && t(titleEl.getAttribute('data-i18n'), titleEl.textContent || '')) || titleEl?.textContent || `${t('section_word','Розділ')} ${index+1}`).replace(/^\d+\.\s*/, '');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'settings-side-btn';
      btn.dataset.targetSection = String(index);
      btn.textContent = label;
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        activate(index);
      });
      list.appendChild(btn);
    });
    card.classList.add('has-settings-side-menu');
  }
  function activate(index){
    const modal = getModal();
    const grid = getGrid();
    const sections = getSections();
    if(!modal || !grid || !sections.length) return;
    const safe = Math.max(0, Math.min(index, sections.length - 1));
    sections.forEach((section, i) => {
      const active = i === safe;
      section.hidden = !active;
      section.style.display = active ? 'block' : 'none';
      section.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    modal.querySelectorAll('.settings-side-btn').forEach((btn, i) => {
      const active = i === safe;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    grid.scrollTop = 0;
    getCard() && (getCard().scrollTop = 0);
  }
  function normalizeStatusRows(){
    const scope = document.querySelector('#towerCalcModal [data-calc-main-panel="overflow"]');
    if(!scope) return;
    scope.querySelectorAll('.tcv5-grid-row').forEach((row) => {
      row.querySelectorAll('.tcv5-cell').forEach((cell) => {
        if(cell.classList.contains('tcv5-col-status') || cell.classList.contains('tcv5-col-actions')) return;
        const txt = cell.textContent?.trim() || '';
        cell.title = txt;
      });
    });
  }
  function refreshAll(){
    ensureSideButtons();
    activate(0);
    normalizeStatusRows();
  }
  document.addEventListener('click', (ev) => {
    const opener = ev.target.closest('[href="#settings-modal"], [data-modal-open="settings"], #openSettingsBtn, #openSettingsBtnMobile');
    if(opener){ setTimeout(refreshAll, 30); }
  }, true);
  document.addEventListener('pns:i18n-changed', () => setTimeout(refreshAll, 0));
  document.addEventListener('DOMContentLoaded', refreshAll);
  window.addEventListener('hashchange', () => {
    if(location.hash === '#settings-modal') setTimeout(refreshAll, 30);
  });
  document.addEventListener('click', () => setTimeout(normalizeStatusRows, 10), true);
})();
