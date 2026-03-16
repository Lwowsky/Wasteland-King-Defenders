/* Final plan board language helpers */
(function(){
  const PNS = window.PNS;
  if (!PNS) return;

  function escapeHtml(value) {
    return (PNS.escapeHtml || (v => String(v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] || ch))))(String(value ?? ''));
  }

  function tr(key, fallback = '') {
    try {
      return typeof PNS.t === 'function' ? PNS.t(key, fallback) : (fallback || key);
    } catch {
      return fallback || key;
    }
  }

  function getCalcState() {
    try {
      if (typeof window.getCalcState === 'function') return window.getCalcState();
    } catch {}
    PNS.state = PNS.state || {};
    PNS.state.towerCalc = PNS.state.towerCalc && typeof PNS.state.towerCalc === 'object' ? PNS.state.towerCalc : {};
    return PNS.state.towerCalc;
  }

  function persistCalcState(state) {
    try {
      localStorage.setItem('pns_tower_calc_state', JSON.stringify(state));
    } catch {}
  }

  function getBoardSupportedLocales() {
    const locales = typeof PNS.getSupportedLocales === 'function'
      ? PNS.getSupportedLocales()
      : Object.keys(window.PNSI18N?.dict || {});
    const normalized = Array.from(new Set((Array.isArray(locales) ? locales : [])
      .map(locale => String(locale || '').trim().toLowerCase())
      .filter(Boolean)));
    return normalized.length ? normalized : ['uk', 'en', 'ru'];
  }

  function getBoardDefaultLocales() {
    const current = typeof window.PNS?.I18N?.locale === 'string'
      ? String(window.PNS.I18N.locale).toLowerCase()
      : String(document.documentElement.dataset.locale || 'uk').toLowerCase();
    const defaults = ['en'];
    if (current && !defaults.includes(current)) defaults.push(current);
    return defaults;
  }

  function normalizeBoardLanguageLocales(locales) {
    const supported = getBoardSupportedLocales();
    const required = ['en'].filter(locale => supported.includes(locale));
    const input = Array.isArray(locales) ? locales : [locales];
    const result = Array.from(new Set(required));
    input.forEach(locale => {
      const normalized = String(locale || '').trim().toLowerCase();
      if (!normalized || result.includes(normalized)) return;
      if (supported.includes(normalized)) result.push(normalized);
    });
    return result;
  }

  function getBoardLanguageLocales() {
    const state = getCalcState();
    const defaults = normalizeBoardLanguageLocales(getBoardDefaultLocales());
    const localLocale = defaults.find(locale => locale !== 'en') || 'en';
    let locales = normalizeBoardLanguageLocales(state.boardLanguageLocales || []);

    if (!locales.length) {
      locales = String(state.boardLanguageMode || '').toLowerCase() === 'en' ? ['en'] : defaults;
    }
    if (localLocale !== 'en') {
      locales = normalizeBoardLanguageLocales(['en', localLocale].concat(locales.filter(locale => locale !== 'en' && locale !== localLocale)));
    }

    state.boardLanguageLocales = locales.slice();
    state.boardLanguageMode = locales.length === 1 && locales[0] === 'en' ? 'en' : 'en_local';
    persistCalcState(state);
    return locales;
  }

  function setBoardLanguageLocales(locales) {
    const state = getCalcState();
    const normalized = normalizeBoardLanguageLocales(locales);
    state.boardLanguageLocales = normalized.length ? normalized : normalizeBoardLanguageLocales(getBoardDefaultLocales());
    state.boardLanguageMode = state.boardLanguageLocales.length === 1 && state.boardLanguageLocales[0] === 'en' ? 'en' : 'en_local';
    persistCalcState(state);
    return state.boardLanguageLocales.slice();
  }

  function getBoardLanguageMode() {
    const locales = getBoardLanguageLocales();
    return locales.length === 1 && locales[0] === 'en' ? 'en' : 'en_local';
  }

  function setBoardLanguageMode(mode) {
    return setBoardLanguageLocales(String(mode || '').toLowerCase() === 'en' ? ['en'] : getBoardDefaultLocales());
  }

  function getBoardLanguageText(key, fallback, locale) {
    const normalizedLocale = String(locale || '').trim().toLowerCase();
    const dict = window.PNSI18N?.dict || {};
    const localized = dict?.[normalizedLocale]?.[key];
    if (localized != null && String(localized).trim()) return String(localized);
    if (normalizedLocale !== 'uk') {
      const ukrainian = dict?.uk?.[key];
      if (ukrainian != null && String(ukrainian).trim()) return String(ukrainian);
    }
    return String(fallback || '');
  }

  function getBoardLanguageLabel(locale) {
    const normalized = String(locale || '').trim().toLowerCase();
    return String({ en: 'English', uk: 'Українська', ru: 'Русский' }[normalized]
      || window.PNSI18N?.dict?.[normalized]?.lang_name
      || window.PNS?.I18N?.dict?.[normalized]?.lang_name
      || normalized.toUpperCase());
  }

  function mapBoardLanguageText(mapper) {
    const seen = new Set();
    const values = [];
    getBoardLanguageLocales().forEach(locale => {
      let value = '';
      try {
        value = mapper(locale);
      } catch {
        value = '';
      }
      const text = String(value || '').trim();
      const key = text.toLowerCase();
      if (!text || seen.has(key)) return;
      seen.add(key);
      values.push(text);
    });
    return values.join(' ✦ ');
  }

  function getBoardLanguageTextMulti(key, fallback) {
    return mapBoardLanguageText(locale => getBoardLanguageText(key, fallback, locale));
  }

  function boardLanguageSummary(locales) {
    const normalized = normalizeBoardLanguageLocales(locales || getBoardLanguageLocales());
    if (!normalized.length) return getBoardLanguageLabel('en');
    const labels = normalized.map(getBoardLanguageLabel).filter(Boolean);
    if (!labels.length) return 'English';
    return labels.length <= 3 ? labels.join(' + ') : `${labels.slice(0, 2).join(' + ')} +${labels.length - 2}`;
  }

  function renderBoardLanguagePickerMarkup(kind) {
    const pickerAttr = kind === 'calc' ? 'data-calc-board-lang-picker' : 'data-board-lang-picker';
    const labelAttr = kind === 'calc' ? 'data-calc-board-lang-picker-label' : 'data-board-lang-picker-label';
    const safeKind = escapeHtml(kind || 'board');
    const locales = getBoardLanguageLocales();
    return window.PNS.renderHtmlTemplate('tpl-board-lang-trigger', {
      picker_attr: pickerAttr,
      label_attr: labelAttr,
      kind: safeKind,
      label: escapeHtml(tr('board_language', 'Мова плану')),
      value: escapeHtml(boardLanguageSummary(locales))
    });
  }

  function renderBoardLanguageDialogMarkup(kind) {
    const optionAttr = kind === 'calc' ? 'data-calc-board-lang-option' : 'data-board-lang-option';
    const selectedLocales = getBoardLanguageLocales();
    const requiredLocales = new Set(['en']);
    const optionsHtml = getBoardSupportedLocales().map(locale => {
      const normalized = String(locale || '').trim().toLowerCase();
      const required = requiredLocales.has(normalized);
      const checkedAttr = selectedLocales.includes(normalized) || required ? 'checked' : '';
      const disabledAttr = required ? 'disabled aria-disabled="true"' : '';
      const suffix = required ? ` • ${escapeHtml(tr('always_on', 'Завжди увімкнено'))}` : '';
      return window.PNS.renderHtmlTemplate('tpl-board-lang-option', {
        required_class: required ? ' is-required' : '',
        option_attr: optionAttr,
        value: escapeHtml(normalized),
        checked_attr: checkedAttr,
        disabled_attr: disabledAttr,
        label_text: `${escapeHtml(getBoardLanguageLabel(normalized))}${suffix}`
      });
    }).join('');
    const actionsHtml = window.PNS.renderHtmlTemplate('tpl-board-lang-dialog-actions', {
      done_text: escapeHtml(tr('done', 'Готово'))
    });
    return window.PNS.renderHtmlTemplate('tpl-board-lang-dialog', {
      kind: escapeHtml(String(kind || 'board')),
      aria_label: escapeHtml(tr('board_language', 'Мова плану')),
      title: escapeHtml(tr('board_language', 'Мова плану')),
      note: escapeHtml(tr('board_language_picker_note', 'Познач мови, які треба показувати у фінальному плані.')),
      close_aria: escapeHtml(tr('close_menu', 'Закрити')),
      options_html: optionsHtml,
      actions_html: actionsHtml
    });
  }

  Object.assign(PNS, {
    getBoardSupportedLocales,
    getBoardDefaultLocales,
    normalizeBoardLanguageLocales,
    getBoardLanguageLocales,
    setBoardLanguageLocales,
    getBoardLanguageMode,
    setBoardLanguageMode,
    getBoardLanguageText,
    getBoardLanguageLabel,
    mapBoardLanguageText,
    getBoardLanguageTextMulti,
    boardLanguageSummary,
    renderBoardLanguagePickerMarkup,
    renderBoardLanguageDialogMarkup
  });

  PNS.ModalsShift = PNS.ModalsShift || {};
  Object.assign(PNS.ModalsShift, {
    renderBoardLanguagePickerMarkup,
    renderBoardLanguageDialogMarkup,
    boardLanguageSummary
  });

  Object.assign(window, {
    getBoardSupportedLocales,
    getBoardDefaultLocales,
    normalizeBoardLanguageLocales,
    getBoardLanguageLocales,
    setBoardLanguageLocales,
    getBoardLanguageMode,
    setBoardLanguageMode,
    getBoardLanguageText,
    getBoardLanguageLabel,
    mapBoardLanguageText,
    getBoardLanguageTextMulti,
    boardLanguageSummary,
    renderBoardLanguagePickerMarkup,
    renderBoardLanguageDialogMarkup
  });
})();
