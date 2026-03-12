(function () {
  const PNS = (window.PNS = window.PNS || {});

  // ---- Storage keys ----
  const KEY_SHOW_ALL = 'pns_layout_show_all_columns';
  const KEY_SHIFT_FILTER = 'pns_layout_shift_filter';
  const KEY_AUTOFILL_SETTINGS = 'pns_layout_autofill_settings';
  const KEY_QUOTA_PRESETS = 'pns_layout_quota_presets';
  const KEY_IMPORT_TEMPLATES = 'pns_layout_import_templates';
  const KEY_IMPORT_VISIBLE_COLUMNS = 'pns_layout_import_visible_columns';
  const KEY_ASSIGNMENTS_STORE = 'pns_layout_assignments_store_v3';
  const KEY_ASSIGNMENT_PRESETS = 'pns_layout_assignment_presets_v1';
  const KEY_TOP_FILTERS = 'pns_layout_top_filters_v1';
  const KEY_FIELD_LABEL_OVERRIDES = 'pns_layout_field_label_overrides_v1';
  const KEY_BASE_TOWER_RULES = 'pns_layout_base_tower_rules_v41';

  PNS.KEYS = {
    KEY_SHOW_ALL,
    KEY_SHIFT_FILTER,
    KEY_AUTOFILL_SETTINGS,
    KEY_QUOTA_PRESETS,
    KEY_IMPORT_TEMPLATES,
    KEY_IMPORT_VISIBLE_COLUMNS,
    KEY_ASSIGNMENTS_STORE,
    KEY_ASSIGNMENT_PRESETS,
    KEY_TOP_FILTERS,
    KEY_FIELD_LABEL_OVERRIDES,
    KEY_BASE_TOWER_RULES,
  };

  // ---- DOM helpers ----
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  PNS.$ = $;
  PNS.$$ = $$;

  // ---- State ----
  const state = {
    activeModal: null,
    showAllColumns: false,
    activeShift: 'shift1',
    players: [],
    playerById: new Map(),
    bases: [],
    baseById: new Map(),
    autoFillSettings: null,
    quotaPresets: [],
    visibleOptionalColumns: [],
    importData: { headers: [], rows: [], sourceName: '', sourceType: '', mapping: {}, loaded: false },
    _baseToolsDelegationBound: false,
    isRestoringAssignments: false,
    topFilters: { search: '', role: 'all', shift: 'all', status: 'all' },
    _jsonTemplateUIBound: false,
    fieldLabelOverrides: {},
    baseTowerRules: {},
  };
  PNS.state = state;

  // ---- Cached nodes ----
  const modals = { settings: $('#settings-modal'), board: $('#board-modal') };
  const buttons = {
    openSettings: $('#openSettingsBtn'),
    openBoard: $('#openBoardBtn'),
    showAllData: $('#showAllDataBtn'),
    showAllColumns: $('#showAllColumnsBtn'),
    autoFillAllHeader: $('#autoFillAllHeaderBtn'),
    autoFillAllBases: $('#autoFillAllBasesBtn'),
    clearCurrentShift: $('#clearCurrentShiftBtn'),
    copyShift1ToShift2: $('#copyShift1ToShift2Btn'),
    copyShift2ToShift1: $('#copyShift2ToShift1Btn'),
    applyQuotaSettings: $('#applyQuotaSettingsBtn'),
    resetQuotaSettings: $('#resetQuotaSettingsBtn'),
    savePreset: $('#savePresetBtn'),
    overwritePreset: $('#overwritePresetBtn'),
    loadPreset: $('#loadPresetBtn'),
    deletePreset: $('#deletePresetBtn'),
    exportPng: $('#exportPngBtn'),
    exportPdf: $('#exportPdfBtn'),
    saveTemplateMock: $('#saveTemplateMockBtn'),
    applyImportMock: $('#applyImportMockBtn'),
    fileInputMock: $('#fileInputMock'),
    urlInputMock: $('#urlInputMock'),
    loadUrlMock: $('#loadUrlMockBtn'),
    useTemplateMock: $('#useTemplateMockBtn'),
    detectColumnsMock: $('#detectColumnsMockBtn'),
    saveVisibleColumnsMock: $('#saveVisibleColumnsMockBtn'),
    loadDemoImportBtn: $('#loadDemoImportBtn'),
  };
  const shiftTabs = $$('[data-shift-tab]');
  const controls = {
    quotaT14: $('#quotaT14Input'),
    quotaT13: $('#quotaT13Input'),
    quotaT12: $('#quotaT12Input'),
    quotaT11: $('#quotaT11Input'),
    quotaT10: $('#quotaT10Input'),
    quotaT9: $('#quotaT9Input'),
    maxHelpers: $('#maxHelpersInput'),
    quotaScope: $('#quotaScopeSelect'),
    quotaStatus: $('#quotaSettingsStatus'),
    presetName: $('#presetNameInput'),
    presetSelect: $('#presetSelect'),
    presetStatus: $('#presetStatus'),
    requiredMappingContainer: $('#requiredMappingContainer'),
    optionalMappingContainer: $('#optionalMappingContainer'),
    columnVisibilityChecks: $('#columnVisibilityChecks'),
    importLoadedInfo: $('#importLoadedInfo'),
    importStatusInfo: $('#importStatusInfo'),
    playersDataTable: $('#playersDataTable'),
  };

  PNS.modals = modals;
  PNS.buttons = buttons;
  PNS.shiftTabs = shiftTabs;
  PNS.controls = controls;

function refreshDomCache() {
  PNS.modals = {
    settings: $('#settings-modal'),
    board: $('#board-modal'),
  };
  PNS.buttons = {
    ...PNS.buttons,
    openSettings: $('#openSettingsBtn'),
    openBoard: $('#openBoardBtn'),
    showAllData: $('#showAllDataBtn'),
    showAllColumns: $('#showAllColumnsBtn'),
    autoFillAllHeader: $('#autoFillAllHeaderBtn'),
    autoFillAllBases: $('#autoFillAllBasesBtn'),
    clearCurrentShift: $('#clearCurrentShiftBtn'),
    copyShift1ToShift2: $('#copyShift1ToShift2Btn'),
    copyShift2ToShift1: $('#copyShift2ToShift1Btn'),
    applyQuotaSettings: $('#applyQuotaSettingsBtn'),
    resetQuotaSettings: $('#resetQuotaSettingsBtn'),
    savePreset: $('#savePresetBtn'),
    overwritePreset: $('#overwritePresetBtn'),
    loadPreset: $('#loadPresetBtn'),
    deletePreset: $('#deletePresetBtn'),
    exportPng: $('#exportPngBtn'),
    exportPdf: $('#exportPdfBtn'),
    saveTemplateMock: $('#saveTemplateMockBtn'),
    applyImportMock: $('#applyImportMockBtn'),
    fileInputMock: $('#fileInputMock'),
    urlInputMock: $('#urlInputMock'),
    loadUrlMock: $('#loadUrlMockBtn'),
    useTemplateMock: $('#useTemplateMockBtn'),
    detectColumnsMock: $('#detectColumnsMockBtn'),
    saveVisibleColumnsMock: $('#saveVisibleColumnsMockBtn'),
    loadDemoImportBtn: $('#loadDemoImportBtn'),
  };
  PNS.shiftTabs = $$('[data-shift-tab]');
  PNS.controls = {
    ...PNS.controls,
    quotaT14: $('#quotaT14Input'),
    quotaT13: $('#quotaT13Input'),
    quotaT12: $('#quotaT12Input'),
    quotaT11: $('#quotaT11Input'),
    quotaT10: $('#quotaT10Input'),
    quotaT9: $('#quotaT9Input'),
    maxHelpers: $('#maxHelpersInput'),
    quotaScope: $('#quotaScopeSelect'),
    quotaStatus: $('#quotaSettingsStatus'),
    presetName: $('#presetNameInput'),
    presetSelect: $('#presetSelect'),
    presetStatus: $('#presetStatus'),
    requiredMappingContainer: $('#requiredMappingContainer'),
    optionalMappingContainer: $('#optionalMappingContainer'),
    columnVisibilityChecks: $('#columnVisibilityChecks'),
    importLoadedInfo: $('#importLoadedInfo'),
    importStatusInfo: $('#importStatusInfo'),
    playersDataTable: $('#playersDataTable'),
  };
}

PNS.refreshDomCache = refreshDomCache;
refreshDomCache();

  // ---- Utils ----
  function toast(msg) { try { console.log('[PNS]', msg); } catch {} }
  function clampInt(v, fallback = 0) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.round(n));
  }
  function formatNum(n) { return Number(n || 0).toLocaleString('en-US'); }
  function parseNumber(text) {
    if (text == null) return 0;
    const cleaned = String(text).replace(/[^\d]/g, '');
    return cleaned ? Number(cleaned) : 0;
  }
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  PNS.toast = toast;
  PNS.clampInt = clampInt;
  PNS.formatNum = formatNum;
  PNS.parseNumber = parseNumber;
  PNS.escapeHtml = escapeHtml;

  // ---- Styled alert ----
  function ensureAlertStyles() {
    if (document.getElementById('pnsAlertStyles')) return true;
    const style = document.createElement('style');
    style.id = 'pnsAlertStyles';
    style.textContent = `
      .pns-alert-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(6,10,18,.76);backdrop-filter:blur(6px);z-index:300120;animation:pnsAlertFadeIn .16s ease-out;}
      .pns-alert-dialog{width:min(100%,640px);background:linear-gradient(180deg,rgba(20,28,42,.98),rgba(10,16,28,.98));border:1px solid rgba(173,196,255,.18);border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.52), inset 0 1px 0 rgba(255,255,255,.06);color:#eef4ff;overflow:hidden;}
      .pns-alert-head{display:flex;align-items:flex-start;gap:14px;padding:24px 24px 14px;}
      .pns-alert-badge{flex:0 0 56px;width:56px;height:56px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:28px;background:linear-gradient(180deg,rgba(85,120,255,.22),rgba(85,120,255,.12));border:1px solid rgba(148,173,255,.24);box-shadow:inset 0 1px 0 rgba(255,255,255,.08);}
      .pns-alert-title{margin:0;color:#fff;font-size:18px;line-height:1.2;font-weight:800;}
      .pns-alert-text{margin:6px 0 0;color:rgba(235,242,255,.84);font-size:14px;line-height:1.55;white-space:pre-wrap;word-break:break-word;}
      .pns-alert-actions{display:flex;justify-content:flex-end;padding:16px 24px 24px;border-top:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01));}
      .pns-alert-btn{appearance:none;border:1px solid rgba(168,192,255,.28);background:linear-gradient(180deg,rgba(96,128,255,.28),rgba(66,92,206,.28));color:#f8fbff;border-radius:16px;padding:12px 28px;font-size:15px;font-weight:800;letter-spacing:.01em;cursor:pointer;box-shadow:0 12px 26px rgba(38,62,144,.28), inset 0 1px 0 rgba(255,255,255,.10);transition:transform .12s ease, border-color .12s ease, background .12s ease, box-shadow .12s ease;}
      .pns-alert-btn:hover{transform:translateY(-1px);border-color:rgba(196,214,255,.42);background:linear-gradient(180deg,rgba(112,146,255,.34),rgba(76,105,224,.34));box-shadow:0 16px 32px rgba(38,62,144,.34), inset 0 1px 0 rgba(255,255,255,.12);}
      .pns-alert-btn:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(148,173,255,.25), 0 16px 32px rgba(38,62,144,.34), inset 0 1px 0 rgba(255,255,255,.12);}
      @keyframes pnsAlertFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      @media (max-width: 640px){
        .pns-alert-overlay{padding:14px;}
        .pns-alert-dialog{border-radius:20px;}
        .pns-alert-head{padding:18px 18px 12px;}
        .pns-alert-badge{width:48px;height:48px;border-radius:16px;font-size:24px;}
        .pns-alert-title{font-size:17px;}
        .pns-alert-text{font-size:13px;}
        .pns-alert-actions{padding:14px 18px 18px;}
        .pns-alert-btn{width:100%;padding:12px 18px;}
      }
    `;
    document.head.appendChild(style);
    return true;
  }

  function showStyledAlert(message, opts = {}) {
    if (typeof document === 'undefined' || !document.body) {
      try { console.warn('[PNS alert]', message); } catch {}
      return;
    }
    ensureAlertStyles();
    const previous = document.querySelector('.pns-alert-overlay');
    if (previous) previous.remove();

    const overlay = document.createElement('div');
    overlay.className = 'pns-alert-overlay';
    overlay.innerHTML = `
      <div class="pns-alert-dialog" role="alertdialog" aria-modal="true" aria-labelledby="pnsAlertTitle" aria-describedby="pnsAlertText">
        <div class="pns-alert-head">
          <div class="pns-alert-badge" aria-hidden="true">${opts.icon || 'ℹ️'}</div>
          <div>
            <h3 class="pns-alert-title" id="pnsAlertTitle">${escapeHtml(opts.title || 'Повідомлення')}</h3>
            <p class="pns-alert-text" id="pnsAlertText">${escapeHtml(String(message ?? ''))}</p>
          </div>
        </div>
        <div class="pns-alert-actions">
          <button type="button" class="pns-alert-btn" data-pns-alert-ok>${escapeHtml(opts.okText || 'OK')}</button>
        </div>
      </div>`;

    const close = () => {
      try { document.removeEventListener('keydown', onKeyDown, true); } catch {}
      try { overlay.remove(); } catch {}
      try { if (opts.restoreFocus && typeof opts.restoreFocus.focus === 'function') opts.restoreFocus.focus(); } catch {}
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        close();
      }
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-pns-alert-ok]')?.addEventListener('click', close);
    document.addEventListener('keydown', onKeyDown, true);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.querySelector('[data-pns-alert-ok]')?.focus());
  }

  PNS.ensureAlertStyles = ensureAlertStyles;
  PNS.showAlert = showStyledAlert;
  try {
    const nativeAlert = window.alert?.bind(window);
    PNS.nativeAlert = nativeAlert;
    window.alert = function(message) {
      showStyledAlert(message, { restoreFocus: document.activeElement || null });
    };
  } catch {}


  // ---- Shift helpers ----
  // Used across the app (filters/render) before optional modal modules finish loading.
  function matchesShift(itemShift, filter) {
    const normalized = String(itemShift || '').toLowerCase().trim();
    if (filter === 'all') return true;
    if (normalized === 'both') return true;
    return normalized === filter;
  }
  PNS.matchesShift = matchesShift;

})();
