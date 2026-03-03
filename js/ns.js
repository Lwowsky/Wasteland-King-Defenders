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

})();