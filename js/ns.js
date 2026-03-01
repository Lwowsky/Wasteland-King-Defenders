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
  const state = (PNS.state = PNS.state || {
    activeModal: null,
    showAllColumns: false,
    activeShift: 'shift2',
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
  });

  // ---- Cached nodes (keep same refs) ----
  const modals = (PNS.modals = PNS.modals || { settings: null, board: null });
  const buttons = (PNS.buttons = PNS.buttons || {});
  const controls = (PNS.controls = PNS.controls || {});
  const shiftTabs = (PNS.shiftTabs = PNS.shiftTabs || []); // keep same array ref

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

  // swap-safe binding helper:
  // bindOnce(el, 'boundOpenSettings', 'click', fn)
  function bindOnce(el, key, evt, fn, opts) {
    if (!el) return false;
    const k = `pns_${key}`;
    if (el.dataset[k]) return false;
    el.dataset[k] = '1';
    el.addEventListener(evt, fn, opts);
    return true;
  }

  PNS.toast = toast;
  PNS.clampInt = clampInt;
  PNS.formatNum = formatNum;
  PNS.parseNumber = parseNumber;
  PNS.escapeHtml = escapeHtml;
  PNS.bindOnce = bindOnce;

  // ---- Refresh DOM cache (works with htmx partial swaps) ----
  function refreshDomCache() {
    // modals
    modals.settings = $('#settings-modal');
    modals.board = $('#board-modal');

    // buttons
    buttons.openSettings = $('#openSettingsBtn');
    buttons.openBoard = $('#openBoardBtn');
    buttons.showAllData = $('#showAllDataBtn');
    buttons.showAllColumns = $('#showAllColumnsBtn');
    buttons.autoFillAllHeader = $('#autoFillAllHeaderBtn');
    buttons.autoFillAllBases = $('#autoFillAllBasesBtn');
    buttons.clearCurrentShift = $('#clearCurrentShiftBtn');

    buttons.copyShift1ToShift2 = $('#copyShift1ToShift2Btn');
    buttons.copyShift2ToShift1 = $('#copyShift2ToShift1Btn');

    buttons.applyQuotaSettings = $('#applyQuotaSettingsBtn');
    buttons.resetQuotaSettings = $('#resetQuotaSettingsBtn');

    buttons.savePreset = $('#savePresetBtn');
    buttons.overwritePreset = $('#overwritePresetBtn');
    buttons.loadPreset = $('#loadPresetBtn');
    buttons.deletePreset = $('#deletePresetBtn');

    buttons.exportPng = $('#exportPngBtn');
    buttons.exportPdf = $('#exportPdfBtn');

    // import wizard buttons/inputs
    buttons.saveTemplateMock = $('#saveTemplateMockBtn');
    buttons.applyImportMock = $('#applyImportMockBtn');
    buttons.fileInputMock = $('#fileInputMock');
    buttons.urlInputMock = $('#urlInputMock');
    buttons.loadUrlMock = $('#loadUrlMockBtn');
    buttons.useTemplateMock = $('#useTemplateMockBtn');
    buttons.detectColumnsMock = $('#detectColumnsMockBtn');
    buttons.saveVisibleColumnsMock = $('#saveVisibleColumnsMockBtn');
    buttons.loadDemoImportBtn = $('#loadDemoImportBtn');

    // controls
    controls.quotaT14 = $('#quotaT14Input');
    controls.quotaT13 = $('#quotaT13Input');
    controls.quotaT12 = $('#quotaT12Input');
    controls.quotaT11 = $('#quotaT11Input');
    controls.quotaT10 = $('#quotaT10Input');
    controls.quotaT9 = $('#quotaT9Input');
    controls.maxHelpers = $('#maxHelpersInput');
    controls.quotaScope = $('#quotaScopeSelect');
    controls.quotaStatus = $('#quotaSettingsStatus');

    controls.presetName = $('#presetNameInput');
    controls.presetSelect = $('#presetSelect');
    controls.presetStatus = $('#presetStatus');

    controls.requiredMappingContainer = $('#requiredMappingContainer');
    controls.optionalMappingContainer = $('#optionalMappingContainer');
    controls.columnVisibilityChecks = $('#columnVisibilityChecks');
    controls.importLoadedInfo = $('#importLoadedInfo');
    controls.importStatusInfo = $('#importStatusInfo');
    controls.playersDataTable = $('#playersDataTable');

    // shiftTabs (mutate same array ref)
    shiftTabs.length = 0;
    $$('[data-shift-tab]').forEach((el) => shiftTabs.push(el));
  }

  function emitDomRefreshed() {
    try { document.dispatchEvent(new CustomEvent('pns:dom:refreshed')); } catch {}
  }

  PNS.refreshDomCache = refreshDomCache;

  function initDomCache() {
    refreshDomCache();
    emitDomRefreshed();
  }

  // initial cache build
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDomCache);
  } else {
    initDomCache();
  }

  // htmx: after partial swap, refresh cache again
  document.addEventListener('htmx:afterSwap', () => {
    initDomCache();
  });
  document.addEventListener('htmx:afterSettle', () => {
    initDomCache();
  });

})();