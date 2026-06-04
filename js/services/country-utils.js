const COUNTRY_CODES = `AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW`.split(' ');

const LANG_LOCALES = { uk: 'uk-UA', en: 'en-US', ru: 'ru-RU', pl: 'pl-PL', de: 'de-DE', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR', vi: 'vi-VN', ar: 'ar' };
const ALIASES = {
  UA: ['ukraine', 'україна', 'украина', 'ウクライナ', 'ukraina'],
  JP: ['japan', 'japonia', 'japonya', '日本', '日本国', 'nihon', 'nippon', 'японія', 'япония'],
  US: ['usa', 'u.s.a.', 'america', 'united states', 'сполучені штати', 'сша', 'アメリカ'],
  GB: ['uk', 'great britain', 'britain', 'united kingdom', 'велика британія', 'великобритания'],
  DE: ['germany', 'deutschland', 'німеччина', 'германия', 'ドイツ'],
  PL: ['poland', 'polska', 'польща', 'польша', 'ポーランド'],
  FR: ['france', 'франція', 'франция', 'フランス'],
  IT: ['italy', 'italia', 'італія', 'италия', 'イタリア'],
  ES: ['spain', 'españa', 'іспанія', 'испания', 'スペイン'],
  CA: ['canada', 'канада', 'カナダ'],
  AU: ['australia', 'австралія', 'австралия', 'オーストラリア'],
  BR: ['brazil', 'brasil', 'бразилія', 'бразилия', 'ブラジル'],
  CN: ['china', '中国', 'китай'],
  KR: ['korea', 'south korea', 'republic of korea', 'корея', 'південна корея', 'южная корея', '韓国'],
  TW: ['taiwan', 'тайвань', '台湾'],
  VN: ['vietnam', 'viet nam', 'в’єтнам', 'вьетнам', 'ベトナム'],
  TR: ['turkey', 'türkiye', 'туреччина', 'турция', 'トルコ'],
  IN: ['india', 'індія', 'индия', 'インド']
};

function langToLocale(lang = '') {
  const key = String(lang || '').toLowerCase().split('-')[0];
  return LANG_LOCALES[key] || lang || 'en-US';
}

function activeLocales() {
  const lang = globalThis.window?.WKD_CURRENT_LANG || globalThis.document?.documentElement?.lang || 'en';
  const browser = globalThis.navigator?.language || '';
  return [...new Set([langToLocale(lang), browser, 'en-US'].filter(Boolean))];
}

function normalize(value = '') {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();
}

function displayNames(locale) {
  if (!globalThis.Intl?.DisplayNames) return { of: code => code };
  try { return new Intl.DisplayNames([locale || 'en-US'], { type: 'region' }); }
  catch (_error) { return new Intl.DisplayNames(['en-US'], { type: 'region' }); }
}

export function countryName(code = '', locale = '') {
  const safeCode = String(code || '').trim().toUpperCase();
  if (!COUNTRY_CODES.includes(safeCode)) return '';
  try { return displayNames(locale || activeLocales()[0]).of(safeCode) || safeCode; }
  catch (_error) { return safeCode; }
}

export function countrySearchText(code = '') {
  const safeCode = String(code || '').trim().toUpperCase();
  const names = activeLocales().map(locale => countryName(safeCode, locale)).filter(Boolean);
  const alias = ALIASES[safeCode] || [];
  return [safeCode, ...names, ...alias].join(' ');
}

export function countryChoices(query = '', limit = 28) {
  const q = normalize(query);
  const locale = activeLocales()[0];
  const scored = COUNTRY_CODES.map(code => {
    const label = countryName(code, locale);
    const english = countryName(code, 'en-US');
    const haystack = normalize(countrySearchText(code));
    let score = 0;
    if (!q) score = ['UA','JP','US','GB','DE','PL'].includes(code) ? 5 : 1;
    else if (normalize(code) === q) score = 100;
    else if (normalize(label) === q || normalize(english) === q || (ALIASES[code] || []).some(item => normalize(item) === q)) score = 95;
    else if (normalize(label).startsWith(q) || normalize(english).startsWith(q)) score = 80;
    else if (haystack.includes(q)) score = 50;
    return score ? { code, label, english, score } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, locale));
  return scored.slice(0, limit);
}

export function matchCountry(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = normalize(raw);
  const codeDirect = raw.toUpperCase();
  if (COUNTRY_CODES.includes(codeDirect)) return { code: codeDirect, name: countryName(codeDirect) };
  let firstLoose = null;
  for (const code of COUNTRY_CODES) {
    const names = [...activeLocales().map(locale => countryName(code, locale)), countryName(code, 'en-US'), ...(ALIASES[code] || [])]
      .filter(Boolean)
      .map(name => normalize(name));
    if (names.some(name => name === normalized)) return { code, name: countryName(code) };
    if (!firstLoose && names.some(name => name.startsWith(normalized))) firstLoose = { code, name: countryName(code) };
  }
  return firstLoose;
}

export function localizedCountry(value = '', code = '') {
  const safeCode = String(code || '').trim().toUpperCase();
  if (COUNTRY_CODES.includes(safeCode)) return countryName(safeCode);
  const matched = matchCountry(value);
  return matched ? countryName(matched.code) : String(value || '').trim();
}

export function countryCodeFromValue(value = '') {
  return matchCountry(value)?.code || '';
}
