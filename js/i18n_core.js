(function () {
  const PNS = (window.PNS = window.PNS || {});
  const I18N = (window.PNSI18N = window.PNSI18N || {});
  const dict = {
    uk: {
      fighter: 'Боєць', rider: 'Наїзник', shooter: 'Стрілець', unknown: 'Невідомо',
      fighter_plural: 'Бійці', rider_plural: 'Наїзники', shooter_plural: 'Стрільці',
      shift1: 'Зміна 1', shift2: 'Зміна 2', both: 'Обидві', all: 'Усі',
      hub: 'Техно-Центр', north_turret: 'Північна турель', west_turret: 'Західна турель', east_turret: 'Східна турель', south_turret: 'Південна турель'
    }
  };
  function get(key, fallback='') { const lang = I18N.locale || 'uk'; return ((dict[lang] || {})[key] ?? (dict.uk || {})[key] ?? fallback ?? key); }
  function setLocale(lang) { I18N.locale = (dict[lang] ? lang : 'uk'); return I18N.locale; }
  function roleLabel(value, plural=false) {
    const raw = String(value || '').toLowerCase();
    let key = raw;
    if (/fight|боє|бійц/.test(raw)) key = 'fighter';
    else if (/ride|наїз/.test(raw)) key = 'rider';
    else if (/shoot|стріл/.test(raw)) key = 'shooter';
    return get(plural ? `${key}_plural` : key, String(value || ''));
  }
  function shiftLabel(value) {
    const raw = String(value || '').toLowerCase();
    if (raw.includes('1')) return get('shift1');
    if (raw.includes('2')) return get('shift2');
    if (/both|обидві/.test(raw)) return get('both');
    if (/all|усі|всі/.test(raw)) return get('all');
    return String(value || '');
  }
  function towerLabel(value) {
    const raw = String(value || '');
    if (/техно|hub|central/i.test(raw)) return get('hub');
    if (/північ|north|север/i.test(raw)) return get('north_turret');
    if (/захід|west|запад/i.test(raw)) return get('west_turret');
    if (/схід|east|вост/i.test(raw)) return get('east_turret');
    if (/півден|south|юж/i.test(raw)) return get('south_turret');
    return raw;
  }
  I18N.locale = 'uk'; I18N.dict = dict; I18N.t = get; I18N.setLocale = setLocale; I18N.roleLabel = roleLabel; I18N.shiftLabel = shiftLabel; I18N.towerLabel = towerLabel;
  PNS.t = get; PNS.setLocale = setLocale; PNS.roleLabel = roleLabel; PNS.shiftLabel = shiftLabel; PNS.towerLabelUk = towerLabel;
})();
