/**
 * Wasteland King Defenders — Google Form reserve registration bridge.
 *
 * How to use:
 * 1. Create a new Google Apps Script project from the Google account that should own the Forms/Sheets.
 * 2. Paste this file into Code.gs.
 * 3. Change SCRIPT_SECRET below to a long random value.
 * 4. Deploy → New deployment → Web app.
 * 5. Execute as: Me. Who has access: Anyone with the link.
 * 6. Copy the /exec URL into region settings on the site.
 *
 * No consul emails are added here yet. Editors can be added later manually or with addEditor().
 */
const SCRIPT_SECRET = 'CHANGE_ME_TO_LONG_RANDOM_SECRET';
const REGISTRY_SHEET_NAME = 'WKD Google Forms Registry';
const RESPONSE_SHEET_NAME = 'Responses';

function doGet(e) {
  try {
    const callback = String((e && e.parameter && e.parameter.callback) || '').replace(/[^a-zA-Z0-9_.$]/g, '');
    const raw = (e && e.parameter && e.parameter.payload) || '';
    const payload = JSON.parse(raw || '{}');
    if (!payload || payload.secret !== SCRIPT_SECRET) {
      return javascript_(callback, { ok: false, error: 'invalid-secret' });
    }
    const action = String(payload.action || 'status').trim().toLowerCase();
    const result = action === 'close'
      ? closeRegionForm_(payload)
      : action === 'status'
        ? getRegionFormStatus_(payload)
        : syncRegionForm_(payload, action === 'open');
    return javascript_(callback, result);
  } catch (error) {
    return javascript_((e && e.parameter && e.parameter.callback) || '', { ok: false, error: String(error && error.message || error) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!payload || payload.secret !== SCRIPT_SECRET) {
      return json_({ ok: false, error: 'invalid-secret' });
    }
    const action = String(payload.action || 'sync').trim().toLowerCase();
    if (action === 'close') return json_(closeRegionForm_(payload));
    if (action === 'open') return json_(syncRegionForm_(payload, true));
    if (action === 'status') return json_(getRegionFormStatus_(payload));
    return json_(syncRegionForm_(payload, false));
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message || error) });
  }
}

function syncRegionForm_(payload, forceOpen) {
  const region = cleanRegion_(payload.region);
  if (!region) throw new Error('missing-region');
  const cycleId = String(payload.cycleId || 'default').slice(0, 80);
  const key = `${region}_${cycleId}`;
  const settings = payload.settings || {};
  const registry = getRegistry_();
  let row = findRegistryRow_(registry.sheet, key);
  let form;
  let sheet;

  if (row && row.formId) {
    form = FormApp.openById(row.formId);
    sheet = row.sheetId ? SpreadsheetApp.openById(row.sheetId) : null;
  } else {
    form = FormApp.create(`Wasteland Registration R${region} · ${cycleId}`);
    sheet = SpreadsheetApp.create(`Wasteland Responses R${region} · ${cycleId}`);
    row = row || { key };
  }

  form.setTitle(`${settings.title || 'Wasteland Registration'} · R${region}`);
  form.setDescription(`${settings.description || ''}\n\nRegion: R${region}\nCycle: ${cycleId}`.trim());
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);
  rebuildItems_(form, region, cycleId, settings, payload.alliances || []);

  if (sheet) form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
  ensureResponseHeaders_(sheet);

  const closeAtMs = Number(payload.closeAtMs || settings.closeAtMs || 0) || 0;
  const shouldBeOpen = forceOpen || Boolean(settings.enabled);
  form.setAcceptingResponses(shouldBeOpen && (!closeAtMs || Date.now() < closeAtMs));
  form.setCustomClosedFormMessage(`Registration for R${region} is closed.`);

  const data = {
    key,
    region,
    cycleId,
    formId: form.getId(),
    sheetId: sheet ? sheet.getId() : '',
    formUrl: form.getPublishedUrl(),
    editUrl: form.getEditUrl(),
    sheetUrl: sheet ? sheet.getUrl() : '',
    status: form.isAcceptingResponses() ? 'open' : 'closed',
    closeAtMs,
    updatedAt: new Date().toISOString()
  };
  upsertRegistryRow_(registry.sheet, data);
  ensureAutoCloseTrigger_();
  return { ok: true, ...data };
}

function closeRegionForm_(payload) {
  const region = cleanRegion_(payload.region);
  const cycleId = String(payload.cycleId || 'default').slice(0, 80);
  const key = `${region}_${cycleId}`;
  const registry = getRegistry_();
  const row = findRegistryRow_(registry.sheet, key);
  if (!row || !row.formId) return { ok: false, error: 'form-not-found' };
  const form = FormApp.openById(row.formId);
  form.setAcceptingResponses(false);
  row.status = 'closed';
  row.updatedAt = new Date().toISOString();
  upsertRegistryRow_(registry.sheet, row);
  return { ok: true, ...row };
}

function getRegionFormStatus_(payload) {
  const region = cleanRegion_(payload.region);
  const cycleId = String(payload.cycleId || 'default').slice(0, 80);
  const key = `${region}_${cycleId}`;
  const registry = getRegistry_();
  const row = findRegistryRow_(registry.sheet, key);
  if (!row || !row.formId) return { ok: false, error: 'form-not-found' };
  const form = FormApp.openById(row.formId);
  row.status = form.isAcceptingResponses() ? 'open' : 'closed';
  return { ok: true, ...row };
}

function rebuildItems_(form, region, cycleId, settings, alliances) {
  form.getItems().forEach(item => form.deleteItem(item));
  form.addSectionHeaderItem().setTitle(`R${region}`).setHelpText(`Cycle: ${cycleId}`);
  form.addTextItem().setTitle('Nick').setRequired(true);
  const allianceTags = alliances.map(item => String(item.tag || item.id || '').trim()).filter(Boolean);
  if (allianceTags.length) form.addListItem().setTitle('Alliance').setChoiceValues(allianceTags).setRequired(true);
  else form.addTextItem().setTitle('Alliance').setRequired(true);
  form.addListItem().setTitle('Main / Farm').setChoiceValues(['Main', 'Farm']).setRequired(true);
  form.addListItem().setTitle('Rank').setChoiceValues(['p1', 'p2', 'p3', 'p4', 'p5']).setRequired(true);
  form.addTextItem().setTitle('SHK').setRequired(true);
  const troops = ['Fighter', 'Rider', 'Shooter'].concat((settings.customTroopTypes || []).map(item => item.label || item.id).filter(Boolean));
  form.addListItem().setTitle('Troop type').setChoiceValues(troops).setRequired(true);
  form.addListItem().setTitle('Tier').setChoiceValues(allowedTiers_(settings.minTier || 'T10')).setRequired(true);
  form.addTextItem().setTitle('Lair level');
  form.addTextItem().setTitle('March size');
  form.addTextItem().setTitle('Rally size');
  const shifts = normalizeShifts_(settings.shifts || [], settings.customShifts || []);
  form.addMultipleChoiceItem().setTitle('Shift').setChoiceValues(shifts.length ? shifts : ['Shift 1', 'Shift 2']).setRequired(true);
  form.addCheckboxItem().setTitle('Readiness').setChoiceValues(['Ready to attack', 'Ready to be captain']);
  if (settings.allowExtraTroop) {
    form.addCheckboxItem().setTitle('Extra troops').setChoiceValues(troops);
    form.addListItem().setTitle('Extra tier').setChoiceValues(allowedTiers_(settings.minTier || 'T10'));
  }
  (settings.customFields || []).forEach(field => {
    const title = String(field.label || field.id || '').trim();
    if (!title) return;
    if (field.type === 'checkbox') form.addCheckboxItem().setTitle(title).setChoiceValues(['Yes']);
    else form.addTextItem().setTitle(title);
  });
  form.addParagraphTextItem().setTitle('Comment');
}

function allowedTiers_(minTier) {
  const min = Number(String(minTier || 'T10').replace(/[^0-9]/g, '')) || 10;
  const out = [];
  for (let i = Math.max(1, min); i <= 14; i++) out.unshift(`T${i}`);
  return out.length ? out : ['T10', 'T11', 'T12', 'T13', 'T14'];
}

function normalizeShifts_(ids, custom) {
  const labels = { shift1: 'Shift 1', shift2: 'Shift 2', shift3: 'Shift 3', shift4: 'Shift 4', both: 'Both' };
  return (ids || []).map(id => labels[id] || (custom || []).find(item => item.id === id)?.label || id).filter(Boolean);
}

function ensureResponseHeaders_(sheet) {
  if (!sheet) return;
  const tab = sheet.getSheets()[0];
  if (tab.getLastRow() > 0) return;
  tab.setName(RESPONSE_SHEET_NAME);
}

function getRegistry_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('REGISTRY_SHEET_ID');
  let ss;
  if (id) ss = SpreadsheetApp.openById(id);
  else {
    ss = SpreadsheetApp.create(REGISTRY_SHEET_NAME);
    props.setProperty('REGISTRY_SHEET_ID', ss.getId());
  }
  let sheet = ss.getSheetByName('Forms');
  if (!sheet) {
    sheet = ss.insertSheet('Forms');
    sheet.appendRow(['key', 'region', 'cycleId', 'formId', 'sheetId', 'formUrl', 'editUrl', 'sheetUrl', 'status', 'closeAtMs', 'updatedAt']);
  }
  return { ss, sheet };
}

function findRegistryRow_(sheet, key) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const keyIndex = headers.indexOf('key');
  for (let i = 1; i < values.length; i++) {
    if (values[i][keyIndex] === key) {
      return Object.fromEntries(headers.map((name, index) => [name, values[i][index]]));
    }
  }
  return null;
}

function upsertRegistryRow_(sheet, data) {
  const headers = ['key', 'region', 'cycleId', 'formId', 'sheetId', 'formUrl', 'editUrl', 'sheetUrl', 'status', 'closeAtMs', 'updatedAt'];
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  const values = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) if (values[i][0] === data.key) rowIndex = i + 1;
  const row = headers.map(name => data[name] || '');
  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
}

function ensureAutoCloseTrigger_() {
  const exists = ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === 'autoCloseExpiredForms');
  if (!exists) ScriptApp.newTrigger('autoCloseExpiredForms').timeBased().everyMinutes(5).create();
}

function autoCloseExpiredForms() {
  const registry = getRegistry_();
  const sheet = registry.sheet;
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const now = Date.now();
  for (let i = 1; i < values.length; i++) {
    const row = Object.fromEntries(headers.map((name, index) => [name, values[i][index]]));
    const closeAtMs = Number(row.closeAtMs) || 0;
    if (!row.formId || !closeAtMs || closeAtMs > now || row.status === 'closed') continue;
    const form = FormApp.openById(row.formId);
    form.setAcceptingResponses(false);
    row.status = 'closed';
    row.updatedAt = new Date().toISOString();
    upsertRegistryRow_(sheet, row);
  }
}

function cleanRegion_(value) {
  return String(value || '').replace(/[^0-9]/g, '').slice(0, 8);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function javascript_(callback, obj) {
  const body = callback ? `${callback}(${JSON.stringify(obj)});` : JSON.stringify(obj);
  return ContentService
    .createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
