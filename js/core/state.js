window.WKD = window.WKD || {};

WKD.storageKeys = {
  regionSettings: 'wkd.clean.import.regions.v5',
  importMappings: 'wkd_import_mappings',
  players: 'wkd.clean.players.v1',
  visibleTiers: 'wkd.clean.visible.tiers.v1',
  customFields: 'wkd.clean.custom.fields.v1',
  disabledOptionalFields: 'wkd.clean.disabled.optional.fields.v1',
  visibleOptionalFields: 'wkd.clean.visible.optional.fields.v1',
  shiftRules: 'wkd.clean.shift.rules.v1',
  shiftMergeMode: 'wkd.clean.shift.merge.mode.v1'
};

WKD.defaultRegionSettings = {
  enabled: { home: true, region2: false, region3: false },
  shifts: { home: '2', region2: '2', region3: '2' }
};

WKD.regions = [
  { id: 'home', label: 'Дім', locked: true },
  { id: 'region2', label: 'Регіон 2', locked: false },
  { id: 'region3', label: 'Регіон 3', locked: false }
];

WKD.allTiers = Array.from({ length: 14 }, (_, i) => `T${14 - i}`);
WKD.defaultVisibleTiers = ['T14', 'T13', 'T12', 'T11', 'T10', 'T9', 'T8'];

WKD.baseFields = {
  name: { label: 'Нік гравця', required: true, aliases: ['player name','name','nickname','nick','нік гравця','нік','гравець','игрок'] },
  role: { label: 'Тип військ', required: true, aliases: ['troop type','type','role','тип військ','тип войск','війська'] },
  tier: { label: 'Тір військ', required: true, aliases: ['tier','тір','тир','рівень'] },
  march: { label: 'Розмір маршу', required: true, aliases: ['march size','march','розмір маршу','марш'] },
  rally: { label: 'Розмір ралі', required: true, aliases: ['group attack size','rally size','rally','розмір ралі','ралі','атака групи'] },
  alliance: { label: 'Альянс', required: true, aliases: ['alliance','ally','альянс','allia'] },
  captain: { label: 'Готовність бути капітаном', required: true, aliases: ['captain','captain readiness','captain ready','ready captain','ready to be captain','can be captain','капітан','капитан','готовність бути капітаном','готовий бути капітаном','готова бути капітаном','готов бути капітаном','готовность быть капитаном','готов быть капитаном','готов капитан','готовий капітан','готовность капитана'] },
  shift: { label: 'Доступність по змінах', required: true, aliases: ['shift','shifts','availability','доступність по змінах','зміна','смена'] },
  lair: { label: 'Захоплення інакшого регіону', required: false, aliases: ['capture','capture region','region capture','захоплення іншого регіону','захоплення інакшого регіону','захват другого региона','захват региона','так/ні','yes/no'] },
  lairLevel: { label: 'Розмір лігва', required: false, aliases: ['lair','lair level','den','den level','hive','hive level','розмір лігва','рівень лігва','лігво','логово','уровень логова'] },
  reserveFighter: { label: 'Резервний тип військ: боєць', required: false, aliases: ['fighter reserve','боєць резерв','боец резерв'] },
  reserveRider: { label: 'Резервний тип військ: наїзник', required: false, aliases: ['rider reserve','наїзник резерв','наездник резерв'] },
  reserveShooter: { label: 'Резервний тип військ: стрілець', required: false, aliases: ['shooter reserve','стрілець резерв','стрелок резерв'] }
};


WKD.fieldI18nKeys = {
  name: 'field.name',
  role: 'field.role',
  tier: 'field.tier',
  march: 'field.march',
  rally: 'field.rally',
  alliance: 'field.alliance',
  captain: 'field.captain',
  shift: 'field.shift',
  lair: 'field.lair',
  lairLevel: 'field.lairLevel',
  reserveFighter: 'field.reserveFighter',
  reserveRider: 'field.reserveRider',
  reserveShooter: 'field.reserveShooter'
};

function localizedCustomFieldLabel(label = '') {
  const text = String(label || '').trim();
  const match = text.match(/(?:Кастомна колонка|Custom column|Columna niestandardowa|カスタム列|Benutzerdefinierte Spalte|Пользовательская колонка|自定义列|사용자 지정 열|Cột tùy chỉnh|عمود مخصص)\s*(\d+)/i);
  if (!match) return '';
  const index = match[1];
  if (window.WKD_tv) return window.WKD_tv('import.customColumnDefault', { index }, `Custom column ${index}`);
  const template = window.WKD_t ? window.WKD_t('import.customColumnDefault') : `Custom column {index}`;
  return String(template || `Custom column {index}`).replaceAll('{index}', index);
}

WKD.fieldLabel = (key, fallback = '') => {
  const field = WKD.fields?.[key] || WKD.baseFields?.[key];
  const defaultLabel = fallback || field?.label || key;
  if (field?.custom) {
    const localized = localizedCustomFieldLabel(defaultLabel);
    if (localized) return localized;
  }
  const i18nKey = WKD.fieldI18nKeys?.[key];
  const translated = i18nKey && window.WKD_t ? window.WKD_t(i18nKey) : '';
  return translated && translated !== i18nKey ? translated : defaultLabel;
};

WKD.loadJson = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch (_error) {
    return fallback;
  }
};
WKD.saveJson = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_error) {}
};

WKD.loadRegionSettings = () => {
  const saved = WKD.loadJson(WKD.storageKeys.regionSettings, {});
  return {
    enabled: normalizeRegionEnabled(saved.enabled),
    shifts: normalizeRegionShifts(saved.shifts)
  };
};

WKD.saveRegionSettings = () => {
  WKD.saveJson(WKD.storageKeys.regionSettings, {
    enabled: normalizeRegionEnabled(WKD.state.regionEnabled),
    shifts: normalizeRegionShifts(WKD.state.regionShifts)
  });
};

const savedRegionSettings = WKD.loadRegionSettings();

WKD.state = {
  players: normalizeSavedPlayers(WKD.loadJson(WKD.storageKeys.players, [])),
  pendingRows: null,
  pendingHeaders: [],
  page: 1,
  pageSize: 10,
  sort: { field: null, dir: 1 },
  showOptional: false,
  mappings: {},
  visibleTiers: normalizeVisibleTiers(WKD.loadJson(WKD.storageKeys.visibleTiers, WKD.defaultVisibleTiers)),
  customFields: normalizeCustomFields(WKD.loadJson(WKD.storageKeys.customFields, [])),
  disabledOptionalFields: normalizeStringList(WKD.loadJson(WKD.storageKeys.disabledOptionalFields, [])),
  visibleOptionalFields: normalizeStringList(WKD.loadJson(WKD.storageKeys.visibleOptionalFields, [])),
  shiftRules: WKD.loadJson(WKD.storageKeys.shiftRules, {}),
  shiftMergeMode: WKD.loadJson(WKD.storageKeys.shiftMergeMode, 'custom'),
  regionEnabled: savedRegionSettings.enabled,
  regionShifts: savedRegionSettings.shifts
};

WKD.rebuildFields = () => {
  const custom = WKD.state.customFields.reduce((fields, item) => {
    fields[item.key] = { label: item.label, required: false, custom: true, aliases: [item.label.toLowerCase()] };
    return fields;
  }, {});
  WKD.fields = { ...WKD.baseFields, ...custom };
  WKD.requiredKeys = Object.keys(WKD.fields).filter(key => WKD.fields[key].required);
  WKD.optionalKeys = Object.keys(WKD.fields).filter(key => !WKD.fields[key].required && !WKD.state.disabledOptionalFields.includes(key));
  if (!WKD.state.visibleOptionalFields.length) WKD.state.visibleOptionalFields = WKD.optionalKeys.slice();
  WKD.state.visibleOptionalFields = WKD.state.visibleOptionalFields.filter(key => WKD.optionalKeys.includes(key));
};

WKD.saveCustomFieldState = () => {
  WKD.saveJson(WKD.storageKeys.customFields, WKD.state.customFields);
  WKD.saveJson(WKD.storageKeys.disabledOptionalFields, WKD.state.disabledOptionalFields);
  WKD.saveJson(WKD.storageKeys.visibleOptionalFields, WKD.state.visibleOptionalFields);
};

WKD.getOptionalKeys = () => WKD.optionalKeys.slice();
WKD.rebuildFields();

function normalizeRegionEnabled(value = {}) {
  return WKD.regions.reduce((result, region) => {
    result[region.id] = region.locked ? true : value[region.id] === true;
    return result;
  }, {});
}

function normalizeRegionShifts(value = {}) {
  return WKD.regions.reduce((result, region) => {
    const shift = String(value[region.id] || WKD.defaultRegionSettings.shifts[region.id] || '2');
    result[region.id] = /^[1-4]$/.test(shift) ? shift : '2';
    return result;
  }, {});
}

function normalizeVisibleTiers(value) {
  const list = Array.isArray(value) ? value : WKD.defaultVisibleTiers;
  const unique = list.filter(tier => WKD.allTiers.includes(tier));
  return unique.length ? [...new Set(unique)].sort((a, b) => Number(b.slice(1)) - Number(a.slice(1))) : [...WKD.defaultVisibleTiers];
}

function normalizeCustomFields(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && item.key && item.label).map(item => ({
    key: String(item.key).replace(/[^a-zA-Z0-9_-]/g, ''),
    label: String(item.label).trim().slice(0, 80)
  })).filter(item => item.key && item.label);
}

function normalizeStringList(value) {
  return Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))] : [];
}

function normalizeSavedPlayers(value) {
  return Array.isArray(value) ? value.filter(player => player && player.name) : [];
}
