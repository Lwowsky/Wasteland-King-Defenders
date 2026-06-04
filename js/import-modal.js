window.WKD = window.WKD || {};

(() => {
  const getModal = () => WKD.$?.('#settings-modal') || document.getElementById('settings-modal');

  const keepBodyLockedIfNeeded = () => {
    const anyModalOpen = !!document.querySelector('.modal.is-open, .confirm-modal.is-open, .tower-final-lang-modal.is-open, .stats-modal:not([hidden])');
    document.body.classList.toggle('wkd-modal-open', anyModalOpen);
    if (!document.querySelector('.drawer.is-open')) document.body.classList.remove('drawer-open');
  };

  const forceCloseDrawerLayer = () => {
    const drawer = document.getElementById('drawer');
    const burger = document.getElementById('burgerBtn');
    drawer?.classList.remove('is-open');
    drawer?.setAttribute('aria-hidden', 'true');
    burger?.classList.remove('is-open');
    burger?.setAttribute('aria-expanded', 'false');
    document.getElementById('drawerLangMenu')?.classList.remove('is-open');
    document.getElementById('drawerAccountMenu')?.classList.remove('is-open');
    document.getElementById('langMenu')?.classList.remove('is-open');
    document.getElementById('accountMenu')?.classList.remove('is-open');
  };


  WKD.refreshImportModalContent = ({ resetTab = true } = {}) => {
    try { WKD.renderRegionPanels?.(); } catch (error) { console.warn('[WKD] import regions render skipped:', error); }
    try { WKD.renderMappingRows?.(); } catch (error) { console.warn('[WKD] import mapping render skipped:', error); }
    try { WKD.renderVisibleOptions?.(); } catch (error) { console.warn('[WKD] visible options render skipped:', error); }
    try { WKD.renderVisibleTiers?.(); } catch (error) { console.warn('[WKD] visible tiers render skipped:', error); }
    try { WKD.renderShiftRecognition?.(); } catch (error) { console.warn('[WKD] shift recognition render skipped:', error); }
    if (resetTab) { try { WKD.switchSettingsTab?.('source'); } catch (error) { console.warn('[WKD] import tab reset skipped:', error); } }
  };

  WKD.openImportModal = () => {
    const modal = getModal();
    if (!modal) {
      window.location.href = 'index.html#import';
      return;
    }
    forceCloseDrawerLayer();
    WKD.refreshImportModalContent?.();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('wkd-modal-open');
    document.body.classList.remove('drawer-open');
    window.setTimeout(() => modal.querySelector('.modal-head .btn-icon')?.focus?.(), 0);
  };

  WKD.closeImportModal = () => {
    const modal = getModal();
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    keepBodyLockedIfNeeded();
  };

  WKD.initImportModal = () => {
    const { $, $$ } = WKD;
    $('#openImportQuickBtn')?.addEventListener('click', WKD.openImportModal);

    if (!document.documentElement.dataset.wkdImportModalEvents) {
      document.documentElement.dataset.wkdImportModalEvents = '1';

      document.addEventListener('click', event => {
        const closeButton = event.target.closest?.('#settings-modal [data-close-modal]');
        if (closeButton) {
          event.preventDefault();
          event.stopPropagation();
          WKD.closeImportModal();
          return;
        }

        const tabButton = event.target.closest?.('#settings-modal [data-settings-tab]');
        if (tabButton) {
          event.preventDefault();
          WKD.switchSettingsTab(tabButton.dataset.settingsTab || 'source');
        }
      }, true);

      document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        const modal = getModal();
        if (!modal?.classList.contains('is-open')) return;
        event.preventDefault();
        event.stopPropagation();
        WKD.closeImportModal();
      }, true);
    }

    $$('[data-settings-tab]').forEach(button => button.addEventListener('click', () => WKD.switchSettingsTab(button.dataset.settingsTab)));
  };

  WKD.switchSettingsTab = tab => {
    const { $$ } = WKD;
    const activeTab = tab || 'source';
    $$('#settings-modal [data-settings-tab]').forEach(button => button.classList.toggle('active', button.dataset.settingsTab === activeTab));
    $$('#settings-modal [data-settings-panel]').forEach(panel => { panel.hidden = panel.dataset.settingsPanel !== activeTab; });
  };

  document.addEventListener('wkd:language-changed', () => {
    if (getModal()?.classList.contains('is-open')) WKD.refreshImportModalContent?.({ resetTab: false });
  });
})();
