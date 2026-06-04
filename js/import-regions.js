window.WKD = window.WKD || {};

WKD.initImportRegions = () => {
  WKD.renderRegionPanels();
  WKD.$$('.import-region-tab').forEach(button => {
    button.addEventListener('click', () => WKD.switchRegion(button.dataset.importRegionTab));
  });
  WKD.updateShiftVisibility();
  WKD.renderCaptureMenu?.();
};

WKD.renderRegionPanels = () => {
  const root = WKD.$('#importRegionPanels');
  if (!root) return;

  root.innerHTML = WKD.regions.map((region, index) => regionPanelTemplate(region, index)).join('');

  root.querySelectorAll('[data-region-enabled]').forEach(input => {
    input.addEventListener('change', () => {
      const id = input.dataset.regionEnabled;
      WKD.state.regionEnabled[id] = input.checked;
      WKD.saveRegionSettings();
      WKD.renderRegionPanels();
      WKD.switchRegion(id);
      WKD.updateShiftVisibility();
      WKD.renderCaptureMenu?.();
    });
  });

  root.querySelectorAll('[data-region-shift]').forEach(input => {
    input.addEventListener('change', () => {
      WKD.state.regionShifts[input.dataset.regionShift] = input.value;
      WKD.saveRegionSettings();
      WKD.updateShiftVisibility();
      WKD.renderCaptureMenu?.();
    });
  });

  WKD.updateRegionTabs();
  WKD.renderCaptureMenu?.();
};

WKD.switchRegion = region => {
  WKD.$$('.import-region-tab').forEach(button => {
    const active = button.dataset.importRegionTab === region;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  WKD.$$('[data-import-region-panel]').forEach(panel => {
    const active = panel.dataset.importRegionPanel === region;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
};


WKD.captureRegionOptions = () => {
  const enabled = WKD.state?.regionEnabled || {};
  const list = [];
  const t = window.WKD_t || (key => key);
  if (enabled.region2) list.push({ id: 'region2', label: enabled.region3 ? t('import.region2') : t('import.captureRegion') });
  if (enabled.region3) list.push({ id: 'region3', label: t('import.region3') });
  return list;
};

WKD.hasCaptureRegionsEnabled = () => WKD.captureRegionOptions().length > 0;

WKD.renderCaptureMenu = () => {
  const box = WKD.$('#importCaptureMenu');
  if (!box) return;
  const captures = WKD.captureRegionOptions();
  box.hidden = captures.length === 0;
  if (!captures.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<button class="import-capture-pill is-active" type="button" data-import-capture="home">${WKD.escapeHtml?.(window.WKD_t?.('import.home') || 'Home') || (window.WKD_t?.('import.home') || 'Home')}</button>${captures.map(item => `<button class="import-capture-pill" type="button" data-import-capture="${item.id}">${item.label}</button>`).join('')}`;
  box.querySelectorAll('[data-import-capture]').forEach(button => button.addEventListener('click', () => {
    box.querySelectorAll('[data-import-capture]').forEach(btn => btn.classList.toggle('is-active', btn === button));
  }));
};

WKD.updateRegionTabs = () => {
  WKD.$$('.import-region-tab').forEach(tab => {
    const id = tab.dataset.importRegionTab;
    tab.classList.toggle('is-disabled-region', WKD.state.regionEnabled[id] === false);
  });
};

WKD.getActiveShiftCount = () => WKD.regions.reduce((max, region) => {
  if (!WKD.state.regionEnabled[region.id]) return max;
  return Math.max(max, Number(WKD.state.regionShifts[region.id] || 2));
}, 1);

WKD.updateShiftVisibility = () => {
  const count = WKD.getActiveShiftCount();
  const shiftGrid = WKD.$('.stat-split--shifts');
  if (shiftGrid) {
    shiftGrid.classList.remove('is-shifts-1', 'is-shifts-2', 'is-shifts-3', 'is-shifts-4');
    shiftGrid.classList.add(`is-shifts-${count}`);
  }

  for (let shift = 1; shift <= 4; shift++) {
    const show = shift <= count;
    const card = WKD.$(`#shift${shift}Count`)?.closest('.stat-chip');
    if (card) card.classList.toggle('is-hidden-shift', !show);
    const option = WKD.$(`#shiftFilter option[value="shift${shift}"]`);
    if (option) option.hidden = !show;
  }

  const filter = WKD.$('#shiftFilter');
  if (filter?.value !== 'all' && filter?.value !== 'both') {
    const chosen = Number(filter.value.replace('shift', ''));
    if (chosen > count) filter.value = 'all';
  }

  if (typeof WKD.renderPlayers === 'function') WKD.renderPlayers();
  document.dispatchEvent(new CustomEvent('wkd:region-shifts-updated', { detail: { count } }));
};

function regionPanelTemplate(region, index) {
  const enabled = WKD.state.regionEnabled[region.id] !== false;
  const disabled = !enabled;
  const active = index === 0;

  return `<div class="import-region-panel ${active ? 'is-active' : ''} ${disabled ? 'is-disabled-region' : ''}" data-import-region-panel="${region.id}" ${active ? '' : 'hidden'}>
    <div class="import-region-panel-head">
      <div class="import-region-title">${window.WKD_t?.(region.i18n || `import.${region.id}`) || region.label}</div>
      ${region.locked ? `<span class="import-region-status">${window.WKD_t?.('ui.alwaysEnabled') || 'Always enabled'}</span>` : regionEnableSwitch(region, enabled)}
    </div>
    <div class="import-shift-toggles" aria-label="${window.WKD_t?.('regionSettings.registrationShifts') || 'Registration shifts'} ${window.WKD_t?.(region.i18n || `import.${region.id}`) || region.label}">
      ${[1, 2, 3, 4].map(shift => shiftSwitch(region, shift, disabled)).join('')}
    </div>
  </div>`;
}

function regionEnableSwitch(region, enabled) {
  return `<div class="region-enable-control ${enabled ? '' : 'is-off'}">
    <label class="region-enable-switch" aria-label="${window.WKD_t?.('ui.enabled') || 'Enable'} ${window.WKD_t?.(region.i18n || `import.${region.id}`) || region.label}">
      <input type="checkbox" data-region-enabled="${region.id}" ${enabled ? 'checked' : ''}>
      <span></span>
    </label>
    <span>${enabled ? (window.WKD_t?.('ui.enabled') || 'Enabled') : (window.WKD_t?.('ui.disabled') || 'Disabled')}</span>
  </div>`;
}

function shiftSwitch(region, shift, disabled) {
  const checked = WKD.state.regionShifts[region.id] === String(shift);
  return `<label class="import-switch ${disabled ? 'is-disabled' : ''}">
    <input type="radio" name="${region.id}Shift" value="${shift}" ${checked ? 'checked' : ''} data-region-shift="${region.id}" ${disabled ? 'disabled' : ''}>
    <span class="import-switch-ui"></span>
    <span>${window.WKD_t?.(`shift.shift${shift}`) || `Shift ${shift}`}</span>
  </label>`;
}
