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

  function normalizeShiftValue(value){
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'both';
    const text = raw.replace(/[–—−]/g, '-').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(both|all|any|both shifts?|all shifts?)$/.test(text)) return 'both';
  if (/(both|all shifts?|обе|обидв|обидві|оба|две|дві|any shift|будь-як|будь яка|обидва)/.test(text)) return 'both';
  if (/(^|\s)(1\s*[/,+;&-]\s*2|2\s*[/,+;&-]\s*1)(\s|$)/.test(text)) return 'both';

  if (/^(1|s1|shift ?1|1st|first|перша|перший|первая|первый|перша зміна|первая смена|зміна 1|змiна 1|смена 1|1 зміна|1 смена)$/.test(text)) return 'shift1';
  if (/(^|\s)(shift|зміна|змiна|смена)\s*[-: ]*1(\s|$)/.test(text)) return 'shift1';
  if (/(^|\s)1(st)?\s*(shift|зміна|змiна|смена)?(\s|$)/.test(text)) return 'shift1';
  if (/(first|перш|перша|перший|перв|первая|первый)/.test(text)) return 'shift1';

  if (/^(2|s2|shift ?2|2nd|second|друга|другий|вторая|второй|друга зміна|вторая смена|зміна 2|змiна 2|смена 2|2 зміна|2 смена)$/.test(text)) return 'shift2';
  if (/(^|\s)(shift|зміна|змiна|смена)\s*[-: ]*2(\s|$)/.test(text)) return 'shift2';
  if (/(^|\s)2(nd)?\s*(shift|зміна|змiна|смена)?(\s|$)/.test(text)) return 'shift2';
  if (/(second|друг|втор|вторая|второй|втора)/.test(text)) return 'shift2';
    return (text === 'shift1' || text === 'shift2' || text === 'both') ? text : 'both';
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
