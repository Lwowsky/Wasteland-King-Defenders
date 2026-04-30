/* Import shift recognition and merge rules */
(function(){
  const PNS = window.PNS; if(!PNS) return;
  const wiz = PNS.ImportWizard = PNS.ImportWizard || {};
  const state = PNS.state || {};
  const RULES_KEY = 'pns_import_shift_recognition_rules_v1';
  const MERGE_KEY = 'pns_import_shift_merge_v1';
  const tr = (key, fallback='') => (wiz.translate ? wiz.translate(key, fallback) : (PNS.t ? PNS.t(key, fallback) : (fallback || key)));
  const esc = (value) => PNS.escapeHtml ? PNS.escapeHtml(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function readJson(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch{ return fallback; } }
  function writeJson(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch{} }
  function normalizeRaw(value){ return String(value ?? '').normalize('NFKC').trim(); }
  function readRules(){ const value = readJson(RULES_KEY, {}); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function writeRules(rules){ writeJson(RULES_KEY, rules && typeof rules === 'object' ? rules : {}); }
  function defaultMerge(){ return { mode:'custom', custom:{ shift1:'shift1', shift2:'shift2', shift3:'shift3', shift4:'shift4', both:'both' } }; }
  function readMerge(){
    const value = readJson(MERGE_KEY, defaultMerge());
    const merge = { ...defaultMerge(), ...(value && typeof value === 'object' ? value : {}) };
    if(!['custom','pair12_34','all_to_1'].includes(String(merge.mode||''))) merge.mode = 'custom';
    merge.custom = { ...defaultMerge().custom, ...(merge.custom && typeof merge.custom === 'object' ? merge.custom : {}) };
    return merge;
  }
  function writeMerge(value){
    const merge = { ...defaultMerge(), ...(value || {}) };
    if(!['custom','pair12_34','all_to_1'].includes(String(merge.mode||''))) merge.mode = 'custom';
    merge.custom = { ...defaultMerge().custom, ...(merge.custom && typeof merge.custom === 'object' ? merge.custom : {}) };
    writeJson(MERGE_KEY, merge);
  }
  function labelOf(shift){
    const key = String(shift||'');
    if(key === 'shift1') return tr('shift1','Зміна 1');
    if(key === 'shift2') return tr('shift2','Зміна 2');
    if(key === 'shift3') return tr('shift3','Зміна 3');
    if(key === 'shift4') return tr('shift4','Зміна 4');
    if(key === 'both') return tr('shift_recognition_all','Всі');
    if(key === 'ignore') return tr('shift_recognition_ignore','Ігнорувати');
    return key || tr('unknown','Невідомо');
  }
  function optionHtml(value, selected){ return `<option value="${esc(value)}"${String(value)===String(selected)?' selected':''}>${esc(labelOf(value))}</option>`; }
  function shiftSelectHtml(value, attrs=''){ const choices=['shift1','shift2','shift3','shift4','both','ignore']; return `<select ${attrs}>${choices.map(v=>optionHtml(v,value)).join('')}</select>`; }
  function compact(text){ return String(text||'').normalize('NFKC').toLowerCase().replace(/[–—−]/g,'-').replace(/[〜～]/g,'~').replace(/\s+/g,'').replace(/[・•·,;|]+/g,'·'); }
  function detectByTime(value){
    const raw = String(value||'').normalize('NFKC').toLowerCase();
    const c = compact(raw);
    if(/alltime|all-time|all_time|allshifts?|anyshift|anytime|всевремя|увесьчас|усізміни|全シフト|すべて|全部|両方/.test(c) || /\ball\s*time\b|\bany\s*time\b|\ball\s*shifts?\b|\bany\s*shift\b/.test(raw)) return 'both';
    if(/utc10:?00?~12:?00?/.test(c)||/mos13:?00?~15:?00?/.test(c)||/(kor|jpn)19:?00?~21:?00?/.test(c)) return 'shift1';
    if(/utc12:?00?~14:?00?/.test(c)||/mos15:?00?~17:?00?/.test(c)||/(kor|jpn)21:?00?~23:?00?/.test(c)) return 'shift2';
    if(/utc14:?00?~16:?00?/.test(c)||/mos17:?00?~19:?00?/.test(c)||/(kor|jpn)23:?00?~1:?00?/.test(c)) return 'shift3';
    if(/utc16:?00?~18:?00?/.test(c)||/mos19:?00?~21:?00?/.test(c)||/(kor|jpn)1:?00?~3:?00?/.test(c)) return 'shift4';
    return '';
  }
  function autoDetect(value){
    const raw = normalizeRaw(value);
    if(!raw) return 'both';
    const time = detectByTime(raw); if(time) return time;
    try{ const normalized = PNS.normalizeShiftValue ? PNS.normalizeShiftValue(raw) : ''; if(/^shift[1-4]$/.test(normalized)||normalized==='both') return normalized; }catch{}
    return 'both';
  }
  function mergeShift(shift, merge = readMerge()){
    const s = String(shift||'');
    if(s === 'ignore') return s;
    const mode = String(merge.mode || 'custom');
    if(mode === 'custom') {
      const target = merge.custom?.[s];
      return /^shift[1-4]$/.test(target) || target === 'both' || target === 'ignore' ? target : s;
    }
    // Presets keep "All" universal. To send All into a specific shift, use Custom merge.
    if(s === 'both') return s;
    if(mode === 'pair12_34') return s === 'shift1' || s === 'shift2' ? 'shift1' : s === 'shift3' || s === 'shift4' ? 'shift2' : s;
    if(mode === 'all_to_1') return /^shift[1-4]$/.test(s) ? 'shift1' : s;
    return s;
  }
  function getShiftColumn(){ return state.importData?.mapping?.shift_availability || ''; }
  function getUniqueShiftValues(){
    const header = getShiftColumn();
    const rows = Array.isArray(state.importData?.rows) ? state.importData.rows : [];
    const map = new Map();
    if(!header || !rows.length) return [];
    rows.forEach(row => { const raw = normalizeRaw(row?.[header]); if(!raw) return; map.set(raw, (map.get(raw)||0)+1); });
    return Array.from(map.entries()).map(([value,count]) => ({ value, count }));
  }
  function readUiMerge(){
    const merge = readMerge();
    const modeEl = document.getElementById('shiftRecognitionMergeMode');
    if(modeEl) merge.mode = modeEl.value || 'custom';
    merge.custom = { ...defaultMerge().custom, ...(merge.custom || {}) };
    document.querySelectorAll('[data-shift-merge-source]').forEach(sel => {
      const source = sel.dataset.shiftMergeSource;
      if(!source) return;
      // When the custom-map selects are not rendered yet, select.value is empty.
      // Do not overwrite saved rules with an empty/default value in that case.
      if(sel.options && sel.options.length) merge.custom[source] = sel.value || source;
    });
    return merge;
  }
  function renderCustomMap(merge){
    const box = document.getElementById('shiftRecognitionCustomMap'); if(!box) return;
    box.hidden = String(merge.mode||'custom') !== 'custom';
    box.querySelectorAll('[data-shift-merge-source]').forEach(sel => { const src = sel.dataset.shiftMergeSource; sel.innerHTML = ['shift1','shift2','shift3','shift4','both','ignore'].map(v=>optionHtml(v, merge.custom?.[src] || src)).join(''); });
  }
  function render(){
    const panel = document.getElementById('importShiftRecognitionPanel'); if(!panel) return;
    const values = getUniqueShiftValues();
    const rowsBox = document.getElementById('shiftRecognitionRows');
    const empty = document.getElementById('shiftRecognitionEmpty');
    const wrap = document.getElementById('shiftRecognitionTableWrap');
    const summary = document.getElementById('shiftRecognitionSummary');
    const merge = readUiMerge();
    const modeEl = document.getElementById('shiftRecognitionMergeMode'); if(modeEl) modeEl.value = merge.mode || 'custom';
    renderCustomMap(merge);
    if(!values.length){ if(empty) empty.hidden=false; if(wrap) wrap.hidden=true; if(rowsBox) rowsBox.innerHTML=''; if(summary) summary.textContent=tr('shift_recognition_summary_empty','Правила ще не застосовані.'); return; }
    const rules = readRules();
    if(empty) empty.hidden=true; if(wrap) wrap.hidden=false;
    if(rowsBox) rowsBox.innerHTML = values.map(item => {
      const current = rules[item.value] || autoDetect(item.value);
      const merged = mergeShift(current, merge);
      return `<tr data-shift-recognition-row="${esc(item.value)}"><td class="shift-recognition-value">${esc(item.value)}</td><td>${shiftSelectHtml(current, `data-shift-recognition-value="${esc(item.value)}"`)}</td><td><span class="shift-recognition-pill ${esc(merged)}">${esc(labelOf(merged))}</span></td><td class="shift-recognition-count">${esc(item.count)}</td></tr>`;
    }).join('');
    if(summary) summary.textContent = tr('shift_recognition_summary','Знайдено значень: {count}').replace('{count}', String(values.length));
    try{ window.PNSI18N?.apply?.(panel); }catch{}
  }
  function saveFromUi(){
    const rules = readRules();
    document.querySelectorAll('[data-shift-recognition-value]').forEach(sel => { rules[String(sel.dataset.shiftRecognitionValue||'')] = sel.value || 'both'; });
    writeRules(rules); writeMerge(readUiMerge()); render();
    try{ wiz.saveImportTemplate?.({ silent:true }); }catch{}
  }
  function resetRules(){
    localStorage.removeItem(RULES_KEY);
    writeMerge(defaultMerge());
    render();
  }
  function autoRules(){
    const rules = {};
    getUniqueShiftValues().forEach(item => rules[item.value] = autoDetect(item.value));
    writeRules(rules);
    // Auto-recognize must also normalize the merge sector back to a safe identity map.
    writeMerge(defaultMerge());
    render();
  }
  function applyImportShiftRule(raw){
    const key = normalizeRaw(raw);
    const rules = readRules();
    const detected = rules[key] || autoDetect(key);
    return mergeShift(detected, readMerge());
  }
  function syncHomeShiftCountFromPlayers(players){
    try{
      const list = Array.isArray(players) ? players : [];
      const max = list.reduce((m,p)=>{ const s=String(p?.shift||p?.registeredShift||''); const n=Number((s.match(/shift([1-4])/)||[])[1]||0); return Math.max(m,n); }, 1);
      const count = Math.max(1, Math.min(4, max || 1));
      const raw = JSON.parse(localStorage.getItem('pns_import_region_shift_settings_v1') || '{}') || {};
      raw.regions = raw.regions || {}; raw.regions.region1 = raw.regions.region1 || { enabled:true, shifts:{} };
      raw.regions.region1.enabled = true; raw.regions.region1.shifts = { '1':count===1, '2':count===2, '3':count===3, '4':count===4 };
      localStorage.setItem('pns_import_region_shift_settings_v1', JSON.stringify(raw));
      try { window.PNS?.setImportRegionShiftSettings?.(raw); } catch {}
    }catch{}
  }
  function handleMergeControlChange(event){
    if(!(event.target?.id === 'shiftRecognitionMergeMode' || event.target?.matches?.('[data-shift-merge-source]'))) return false;
    writeMerge(readUiMerge());
    render();
    return true;
  }
  document.addEventListener('change', event => {
    if(event.target?.matches?.('[data-map-field="shift_availability"]')) setTimeout(render, 0);
    if(handleMergeControlChange(event)) return;
    if(event.target?.matches?.('[data-shift-recognition-value]')) saveFromUi();
  }, true);
  document.addEventListener('input', event => {
    handleMergeControlChange(event);
  }, true);
  document.addEventListener('click', event => {
    if(event.target?.closest?.('#shiftRecognitionSaveBtn')) { event.preventDefault(); saveFromUi(); }
    if(event.target?.closest?.('#shiftRecognitionResetBtn')) { event.preventDefault(); resetRules(); }
    if(event.target?.closest?.('#shiftRecognitionAutoBtn')) { event.preventDefault(); autoRules(); }
  }, true);
  Object.assign(PNS, { renderImportShiftRecognition: render, applyImportShiftRule, mergeImportShift: mergeShift, syncHomeShiftCountFromImportedPlayers: syncHomeShiftCountFromPlayers });
  Object.assign(wiz, { renderShiftRecognition: render });
  document.addEventListener('DOMContentLoaded', () => setTimeout(render, 60));
})();
