window.WKD = window.WKD || {};

WKD.bootAppShell = async function bootAppShell(options = {}) {
  const readyKey = options.readyKey || 'wkdAppShellReady';
  if (document.documentElement.dataset[readyKey] === '1') return;
  document.documentElement.dataset[readyKey] = '1';

  const safeInit = (name, fn) => {
    try {
      if (typeof fn === 'function') fn();
    } catch (error) {
      console.warn(`[WKD] ${name} init skipped:`, error);
    }
  };

  try {
    if (typeof WKD.loadPartials === 'function') await WKD.loadPartials();
  } catch (error) {
    console.warn('[WKD] partials load skipped:', error);
  }

  document.dispatchEvent(new CustomEvent('wkd:partials-ready'));

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    try {
      navigator.serviceWorker.register('/sw.js?v=195').catch(error => console.warn('[WKD] service worker registration skipped:', error));
    } catch (error) {
      console.warn('[WKD] service worker registration failed:', error);
    }
  }


  try {
    if (typeof window.WKD_applyI18n === 'function') window.WKD_applyI18n();
  } catch (error) {
    console.warn('[WKD] i18n skipped:', error);
  }

  safeInit('header', WKD.initHeader);
  safeInit('notifications', WKD.initNotifications);
  safeInit('import modal', WKD.initImportModal);
  safeInit('import regions', WKD.initImportRegions);
  safeInit('import file', WKD.initImportFile);
  safeInit('import mapping', WKD.initImportMapping);
  safeInit('visible tiers', WKD.initVisibleTiers);
  safeInit('shift recognition', WKD.initShiftRecognition);
  safeInit('confirm modal', WKD.initConfirmModal);

  if (options.playersTable) {
    safeInit('players table', WKD.initPlayersTable);
    safeInit('duplicates', WKD.initDuplicateNickModal);
  }

  safeInit('player edit modal', WKD.initPlayerEditModal);
  safeInit('player manager modal', WKD.initPlayerManagerModal);
  safeInit('tower planner', WKD.initTowerPlanner);
  safeInit('contact modal', WKD.initContactModal);
  safeInit('import modal content refresh', WKD.refreshImportModalContent);

  if (options.openImportHash && window.location.hash === '#import' && typeof WKD.openImportModal === 'function') {
    WKD.openImportModal();
  }
};
