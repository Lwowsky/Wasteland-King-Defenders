/* ==== shift-normalizers.js ==== */
/* Shift parsing, role/tier normalization, registered-shift helpers */
(function(){
  const e = window.PNS;
  if (!e) return;
  const { state: t } = e;

  function normalizeRole(value){
    const text = String(value || '').trim();
    if (!text) return 'Unknown';
    if (/(shoot|стрел|стріл|стріле|стрільц|shooter|marksman|tirador|射手|弓兵|狙撃|狙击|사수|슈터)/i.test(text)) return 'Shooter';
    if (/(fight|infantry|боец|боєц|бойц|бійц|fighter|пехот|піхот|战士|步兵|歩兵|전투|전사|파이터)/i.test(text)) return 'Fighter';
    if (/(ride|rider|наезд|наїзд|наїзн|cavalry|кавал|骑|骑兵|騎兵|기병|라이더|ライダー)/i.test(text)) return 'Rider';
    return text;
  }

  function normalizeTierText(value){
    const text = String(value || '').trim();
    if (!text) return '';
    const explicit = text.toUpperCase().match(/T\s*([0-9]{1,2})/);
    if (explicit) return `T${explicit[1]}`;
    const digits = text.match(/\b([0-9]{1,2})\b/);
    if (digits) return `T${digits[1]}`;
    return text.toUpperCase();
  }

  function tierRank(value){
    const num = parseInt(String(value).replace(/[^\d]/g, ''), 10);
    return Number.isFinite(num) ? num : 0;
  }

  function normalizeYesNo(value){
    const text = String(value || '').trim().toLowerCase();
    if (!text) return false;
    if (['yes','y','1','true','да','так','готов','ready'].some(token => text === token || text.includes(token))) return true;
    if (['no','n','0','false','нет','ні','не'].some(token => text === token || text.includes(token))) return false;
    return /yes|да|так|ready/.test(text);
  }

  function normalizeShiftValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'both';

  // якщо в excel вже збережено порядок вибору:
  // 1 = перша зміна, 2 = друга зміна, 3 = обидві
  if (raw === '1') return 'shift1';
  if (raw === '2') return 'shift2';
  if (raw === '3') return 'both';

  const text = raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[–—−]/g, '-')
    .replace(/[_.,;:()[\]{}|]+/g, ' ')
    .replace(/\b\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\b/g, ' ')
    .replace(/\b(am|pm|utc|gmt|msk|мск|час|часа|часов|hours?|hrs?)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return 'both';

  if (text === '1') return 'shift1';
  if (text === '2') return 'shift2';
  if (text === '3') return 'both';

  const bothExact = new Set([
    'both', 'all', 'any', 'both shift', 'both shifts', 'all shift', 'all shifts', 'any shift', 'any shifts',
    'обе', 'оба', 'обе смены', 'оба смены', 'две смены',
    'обидві', 'обидва', 'обидві зміни', 'обидва зміни',
    '両方', '両シフト', '全シフト', 'すべて', '全部'
  ]);

  const shift1Exact = new Set([
    '1', 's1', 'shift 1', 'shift1', '1 shift', '1st', 'first', 'first shift',
    'первая', 'первый', 'первая смена', 'смена 1', '1 смена',
    'перша', 'перший', 'перша зміна', 'зміна 1', '1 зміна', 'змiна 1',
    '第一シフト', '第1シフト', 'シフト1', '1シフト', '第一勤務', '第1勤務', '1勤務', '一勤', '1勤', '一直', '1直'
  ]);

  const shift2Exact = new Set([
    '2', 's2', 'shift 2', 'shift2', '2 shift', '2nd', 'second', 'second shift',
    'вторая', 'второй', 'вторая смена', 'смена 2', '2 смена',
    'друга', 'другий', 'друга зміна', 'зміна 2', '2 зміна', 'змiна 2',
    '第二シフト', '第2シフト', 'シフト2', '2シフト', '第二勤務', '第2勤務', '2勤務', '二勤', '2勤', '二直', '2直'
  ]);

  if (bothExact.has(text)) return 'both';
  if (shift1Exact.has(text)) return 'shift1';
  if (shift2Exact.has(text)) return 'shift2';

  if (/(^|\s)(1\s*[/,+;&-]\s*2|2\s*[/,+;&-]\s*1)(\s|$)/.test(text)) return 'both';

  if (/(^|\s)(shift|shifts|смена|смены|зміна|зміни|змiна|シフト|勤務|直)\s*[-: ]*1(\s|$)/.test(text)) {
    return 'shift1';
  }

  if (/(^|\s)(shift|shifts|смена|смены|зміна|зміни|змiна|シフト|勤務|直)\s*[-: ]*2(\s|$)/.test(text)) {
    return 'shift2';
  }

  if (/(^|\s)1(st)?\s*(shift|shifts|смена|смены|зміна|зміни|змiна|シフト|勤務|直)?(\s|$)/.test(text)) {
    return 'shift1';
  }

  if (/(^|\s)2(nd)?\s*(shift|shifts|смена|смены|зміна|зміни|змiна|シフト|勤務|直)?(\s|$)/.test(text)) {
    return 'shift2';
  }

  if (/(first|1st|перв|перш|第一|第1|一勤|1勤|一直|1直)/.test(text)) {
    return 'shift1';
  }

  if (/(second|2nd|втор|друг|第二|第2|二勤|2勤|二直|2直)/.test(text)) {
    return 'shift2';
  }

  if (/(both|all shifts?|any shift|обе|оба|обидв|две|дві|両方|両シフト|全シフト|全部|すべて)/.test(text)) {
    return 'both';
  }

  return 'both';
}

  function normalizeShiftLabel(value){
    const normalized = normalizeShiftValue(value);
    if (typeof e.shiftLabel === 'function') return e.shiftLabel(normalized);
    return normalized === 'shift1' ? 'Зміна 1' : normalized === 'shift2' ? 'Зміна 2' : 'Обидві';
  }

  function formatShiftLabelForCell(value){
    if (typeof e.shiftLabel === 'function') return e.shiftLabel(value);
    return value === 'shift1' ? 'Зміна 1' : value === 'shift2' ? 'Зміна 2' : 'Обидві';
  }

  function getRegisteredShiftForPlayer(player){
    const fromImport = (function(playerObj){
      if (!playerObj || typeof playerObj !== 'object') return '';
      const registeredRaw = String(playerObj.registeredShiftRaw || '').trim();
      if (registeredRaw) return registeredRaw;

      const mappedField = t?.importData?.mapping?.shift_availability;
      if (mappedField && playerObj.raw && String(playerObj.raw[mappedField] || '').trim()) {
        return String(playerObj.raw[mappedField] || '').trim();
      }

      const raw = playerObj.raw;
      if (raw && typeof raw === 'object') {
        const key = Object.keys(raw).find(k => /(shift|availability|зміна|змiна|смена|черга|очеред)/i.test(String(k || '')) && String(raw[k] || '').trim());
        if (key) return String(raw[key] || '').trim();
      }

      const rows = Array.isArray(t?.importData?.rows) ? t.importData.rows : [];
      const mapping = t?.importData?.mapping || {};
      const nameField = mapping.player_name;
      const shiftField = mapping.shift_availability;
      const playerName = String(playerObj.name || '').trim().toLowerCase();
      if (rows.length && nameField && shiftField && playerName) {
        const row = rows.find(r => String(r?.[nameField] || '').trim().toLowerCase() === playerName);
        const fromRow = row ? String(row?.[shiftField] || '').trim() : '';
        if (fromRow) return fromRow;
      }
      return '';
    })(player);

    if (fromImport) {
      const normalized = normalizeShiftValue(fromImport);
      const text = String(fromImport || '').trim().toLowerCase();
      if (/(both|all|1\s*[,/;+&-]\s*2|2\s*[,/;+&-]\s*1|две|обе|обидв|оба|any shift|будь-як|shift\s*1|shift\s*2|зміна\s*1|зміна\s*2|змiна\s*1|змiна\s*2|смена\s*1|смена\s*2|1st\s*shift|2nd\s*shift|first|second|перш|перша|перв|друг|втор)/i.test(text) || normalized !== 'both') {
        return normalized;
      }
      return 'unknown';
    }

    const fallback = String(player?.registeredShift || player?.registeredShiftLabel || '').trim();
    if (fallback) {
      const normalized = normalizeShiftValue(fallback);
      const lower = fallback.toLowerCase();
      if (/(both|shift\s*1|shift\s*2|1st\s*shift|2nd\s*shift|first|second|перш|перша|перв|друг|втор)/i.test(lower) || normalized !== 'both') {
        return normalized;
      }
      return 'unknown';
    }

    return 'unknown';
  }

  e.ROLE_KEYS = ['Shooter', 'Fighter', 'Rider'];
  e.normalizeRole = normalizeRole;
  e.normalizeTierText = normalizeTierText;
  e.tierRank = tierRank;
  e.normalizeYesNo = normalizeYesNo;
  e.normalizeShiftValue = normalizeShiftValue;
  e.normalizeShiftLabel = normalizeShiftLabel;
  e.formatShiftLabelForCell = formatShiftLabelForCell;
  e.getRegisteredShiftForPlayer = getRegisteredShiftForPlayer;
})();
