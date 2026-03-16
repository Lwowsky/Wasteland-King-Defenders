/* Import wizard: templates, visible columns, demo data */
(function () {
  const e = window.PNS;
  if (!e) return;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const t = e.state;
  const a = e.$$;
  const r = wiz.translate;
  const i = wiz.REQUIRED_FIELDS || [];
  const O = wiz.renderImportUI;
  const z = wiz.findBestTemplate;
  const j = wiz.applyImportTemplate;
  const D = wiz.validateImportReady;
  const B = wiz.getDefaultVisibleOptionalColumns;
  const V = wiz.setImportSource;
  const v = wiz.getImportActionNodes;
  const k = wiz.setImportStatus;

  function X() {
    if (!(t.importData.headers || []).length) {
      k(
        r(
          'load_file_or_link_for_template',
          'Спочатку завантаж файл або посилання, щоб застосувати відповідний шаблон.',
        ),
        'danger',
      );
      return;
    }
    const applied = j(z(t.importData.headers));
    O();
    if (!applied) D?.();
  }

  function Q() {
    const checked = a('#columnVisibilityChecks input[type="checkbox"][data-col-key]:checked').map(
      (e) => e.dataset.colKey,
    );
    t.visibleOptionalColumns = checked;
    if ('function' == typeof e.saveVisibleOptionalColumns) e.saveVisibleOptionalColumns();
    if ('function' == typeof e.applyColumnVisibility) e.applyColumnVisibility(t.showAllColumns);
    k(r('visible_columns_saved', 'Видимі колонки збережено.'), 'good');
  }

  function Z() {
    V(
      [
        'Нік гравця',
        'Альянс',
        'Тір військ',
        'Основний тип військ',
        'Розмір маршу',
        'Розмір ралі',
        'Готовий бути капітаном',
        'Яка зміна підходить',
        'Рівень лігва',
        'Тип резервних військ',
        'Тір резервних військ',
        'Тип резерву (200k+)',
        'Примітки',
      ],
      (t.players || []).map((e) => ({
        'Нік гравця': e.name || '',
        Альянс: e.alliance || '',
        'Тір військ': e.tier || '',
        'Основний тип військ': e.role || '',
        'Розмір маршу': String(e.march || ''),
        'Розмір ралі': String(e.rally || ''),
        'Готовий бути капітаном': e.captainReady ? 'Так' : 'Ні',
        'Яка зміна підходить':
          e.shift === 'shift1' ? 'Зміна 1' : e.shift === 'shift2' ? 'Зміна 2' : 'Обидві',
        'Рівень лігва': e.lairLevel || '',
        'Тип резервних військ':
          e.secondaryRole && e.secondaryRole !== 'Unknown' ? e.secondaryRole : '',
        'Тір резервних військ': e.secondaryTier || '',
        'Тип резерву (200k+)': e.troop200k || '',
        Примітки: e.notes || '',
      })),
      'Вбудовані демо-дані',
      'demo',
    );
    k(r('import_demo_loaded', 'Демо-набір завантажено в майстер імпорту.'), 'good');
  }

  (function () {
    const extraAliases = {
      player_name: ['playername', 'ingame name', 'игрок', 'нік', '닉네임', '선수 이름', '플레이어 이름'],
      focus_troop: ['주력 부대', '주력 병종', 'тип військ', '병력 유형', '병종'],
      troop_tier: ['부대 등급', 'уровень войск', 'рівень військ', '병종 등급'],
      march_size: ['행진 크기', 'размер марша', 'розмір марша', 'марш'],
      rally_size: ['집결 규모', '집결 크기', 'рейли'],
      captain_ready: ['can be captain', '캡틴 가능'],
      shift_availability: ['교대', 'which shift', 'available shift'],
      alliance_alias: ['alliance tag', 'ally tag', 'тег альянса'],
      lair_level: ['рівень логова', 'уровень логова', '소굴'],
      secondary_role: ['second role', 'вторая роль', 'друга роль'],
      secondary_tier: ['second tier', 'второй тир', 'другий тір'],
      troop_200k: ['200000', '200k+', '200к', '최소 200,000'],
      notes: ['comment', 'remarks', 'коментар', 'комментарий', '비고'],
    };
    i.forEach((def) => {
      def.aliases = Array.from(new Set([...(def.aliases || []), ...(extraAliases[def.key] || [])]));
    });
  })();

  Object.assign(wiz, {
    applySavedTemplateForCurrentHeaders: X,
    handleSaveVisibleColumnsClick: Q,
    loadDemoImportData: Z,
  });
  e.handleSaveVisibleColumnsClick = Q;
})();
