(function () {
  const PNS = (window.PNS = window.PNS || {});
  const I18N = (window.PNSI18N = window.PNSI18N || {});

  const STORAGE_KEY = 'pns_lang';
  const SUPPORTED = ['uk', 'en', 'ru'];

  const dict = {
    uk: {
      lang_name: 'Українська',
      app_subtitle: 'Puzzle & Survival — Планувальник турелей',
      menu: 'Меню',
      settings_import: 'Налаштування / Імпорт',
      final_plan: 'Фінальний план',
      tower_planning: 'Розподіл по турелях',
      players: 'Гравці',
      settings: 'Налаштування',
      tower_settings: 'Налаштування турелей',
      player_status: 'Статус гравців',
      search: 'Пошук',
      search_placeholder: 'Пошук по ніку / альянсу',
      role: 'Роль',
      tier: 'Тір',
      shift: 'Зміна',
      rows: 'Рядків',
      status: 'Статус',
      placement: 'Розміщення',
      reserve: 'Резерв',
      not_assigned: 'Не призначено',
      edit: 'Редагувати',
      save: 'Зберегти',
      remove_from_turret: 'Прибрати з турелі',
      fighter: 'Боєць', rider: 'Наїзник', shooter: 'Стрілець', unknown: 'Невідомо',
      fighter_plural: 'Бійці', rider_plural: 'Наїзники', shooter_plural: 'Стрільці',
      helper: 'Помічник', captain: 'Капітан',
      shift1: 'Зміна 1', shift2: 'Зміна 2', both: 'Обидві', all: 'Усі',
      first_half: 'Перша половина', second_half: 'Друга половина',
      hub: 'Техно-Центр', north_turret: 'Північна турель', west_turret: 'Західна турель', east_turret: 'Східна турель', south_turret: 'Південна турель', turret: 'Турель', turrets: 'Турелі',
      current_shift: 'Поточна зміна',
      players_in_turret: 'Гравців у турелі',
      captain_march: 'Марш капітана',
      rally_size: 'Розмір ралі',
      total_sum: 'Разом',
      free_space: 'Вільне місце',
      auto_fill: 'Автозаповнення',
      fill_all: 'Автозаповнити все',
      auto_fill_all: 'Автозаповнити все',
      clear_current_shift: 'Очистити поточну зміну',
      clear_helpers: 'Очистити помічників',
      clear_turret: 'Очистити турель',
      save_turret_table: 'Зберегти таблицю турелі',
      choose_captain: 'Вибрати капітана…',
      change_captain: 'Змінити капітана…',
      place_captain: 'Поставити капітана',
      add_player_manually: 'Додати гравця вручну',
      save_limits: 'Зберегти ліміти',
      recalc_composition: 'Перерахувати склад',
      reset_limits: 'Скинути ліміти',
      limits_by_tier: 'Налаштування турелі · ліміти по тірах',
      max_players: 'Макс. гравців',
      flexible_tier_note: '0 = гнучкий тір: бере повний марш, а якщо місця не вистачає — ділить залишок між гравцями цього тіру.',
      search_player_from_list: 'Пошук гравця (зі списку)',
      nickname_custom: 'Нік (можна свій, не зі списку)',
      nickname: 'Нік',
      alliance: 'Альянс',
      march: 'Марш',
      player: 'Гравець',
      ally: 'Альянс',
      players_in_turret_title: 'Гравці в турелі',
      captain_and_players: 'Капітан і гравці',
      no_captain: 'Без капітана',
      no_assigned_players: 'Немає призначених гравців',
      one_turret_only: 'Показати одну турель',
      all_turrets: 'Показати всі турелі',
      only_captains: 'Тільки капітани',
      respect_player_shift: 'Враховувати зміну гравця',
      same_troop_only: 'Лише той самий тип військ',
      use_both: 'Використовувати «Обидві»',
      type_defined_by_captain: 'Тип турелі визначається капітаном',
      final_plan_share: 'Поділитися',
      export_png: 'Завантажити PNG',
      open_menu: 'Відкрити меню',
      close_menu: 'Закрити меню',
      settings_title: 'Налаштування',
      shift_plan: 'План зміни',
      separate_shift_note: 'Кожна зміна має окремий план. Автозаповнення не дублює гравців між ними.',
      player_status_note: 'Одна таблиця з фактичним статусом гравця: у турелі, поза туреллю або в резерві.',
      tower_settings_hint: 'Оберіть турель зліва та налаштуйте її праворуч.',
      total_players: 'Всього гравців',
      captains_ready: 'Капітанів готові',
      reset_filters: 'Скинути фільтри',
      import_label: 'Імпорт CSV/XLSX/URL',
      show_all_data: 'Показати всі дані',
      players_panel_lead: 'Склад альянсу в одному місці: імпортуй список, фільтруй гравців і швидко розподіляй їх по турелях та змінах.',
      calc_title: 'Розподіл по турелях',
      calc_subtitle: 'План для 10 капітанів: розподіл гравців по турелях і тірах, щоб офіцерам було легко зібрати зміни.',
      load_captains: 'Підтягнути капітанів',
      rebalance: 'Застосувати перерозподіл',
      topup_turrets: 'Дозаповнити турелі',
      clear: 'Очистити',
      parameters_limits: 'Параметри розподілу і ліміти',
      in_turrets: 'У турелях',
      outside_turrets: 'Поза турелями',
      in_reserve: 'У резерві',
      in_turret_status: 'У турелі',
      outside_turret_status: 'Поза туреллю',
      to_reserve_status: 'Резерв',
      restore_from_import: 'Відновити з імпорту',
      clear_reserve_s1: 'Скинути резерв зміни 1',
      clear_reserve_s2: 'Скинути резерв зміни 2',
      overall: 'Усього',
      ready: 'Готова',
      no_captain_short: 'Без капітана',
      players_short: 'гравців',
      player_choice: 'Вибір гравця для турелі',
      remove_selected: 'Прибрати вибраного',
      manual_player_title: 'Ручне редагування або додавання гравця',
      player_nickname: 'Нік гравця',
      march_power: 'Сила маршу',
      manual_status_hint: 'Обери гравця, щоб змінити марш або тір, або введи нового й збережи.',
      captain_not_selected: 'Капітана ще не обрано',
      turret_type: 'Тип турелі',
      turret_type_restricted: 'Можна додавати лише помічників цього типу.',
      player_select_placeholder: '— вибери гравця —',
      captain_tag_short: 'КАП',
      in_turret_tag: 'У ТУРЕЛІ',
      helper_tag_short: 'ПОМ',
      tier_march_limits: 'Ліміти маршу за тірами',
      auto_tier_limits: 'автоматично',
      max_helpers: 'Макс. помічників',
      final_plan_status: 'Фінальний план',
      helper_slots: 'Місць для помічників',
      turret_capacity: 'Місткість турелі',
      used_shortage: 'Використано / нестача',
      rally_captain_helper_space: 'Ралі · Марш капітана · Місць для помічників',
      troop_type: 'Тип військ',
      lair_level: 'Рівень лігва',
      yes: 'Так',
      no: 'Ні',
      manual_save_enter_name: 'Ручне збереження: введи нік гравця',
      manual_save_enter_march: 'Ручне збереження: введи розмір маршу',
      no_players_assigned_yet: 'Гравців ще не призначено',
      no_final_plan_export: 'Немає фінального плану для експорту.',
      no_final_plan_share: 'Немає фінального плану для поширення.',
      html2canvas_missing: 'html2canvas не завантажився.',
      png_failed: 'Не вдалося згенерувати PNG.',
      calc_window_not_loaded: 'Вікно розподілу ще не завантажилось. Спробуй ще раз через секунду.',
      change_shift_failed: 'Не вдалося змінити зміну гравця.'
    },
    en: {
      lang_name: 'English',
      app_subtitle: 'Puzzle & Survival — Turret Planner',
      menu: 'Menu',
      settings_import: 'Setup / Import',
      final_plan: 'Final Plan',
      tower_planning: 'Turret Planning',
      players: 'Players',
      settings: 'Settings',
      tower_settings: 'Turret Settings',
      player_status: 'Player Status',
      search: 'Search',
      search_placeholder: 'Search by nickname / alliance',
      role: 'Role',
      tier: 'Tier',
      shift: 'Shift',
      rows: 'Rows',
      status: 'Status',
      placement: 'Placement',
      reserve: 'Reserve',
      not_assigned: 'Not assigned',
      edit: 'Edit',
      save: 'Save',
      remove_from_turret: 'Remove from turret',
      fighter: 'Fighter', rider: 'Rider', shooter: 'Shooter', unknown: 'Unknown',
      fighter_plural: 'Fighters', rider_plural: 'Riders', shooter_plural: 'Shooters',
      helper: 'Helper', captain: 'Captain',
      shift1: 'Shift 1', shift2: 'Shift 2', both: 'Both', all: 'All',
      first_half: 'First half', second_half: 'Second half',
      hub: 'Tech Hub', north_turret: 'North Turret', west_turret: 'West Turret', east_turret: 'East Turret', south_turret: 'South Turret', turret: 'Turret', turrets: 'Turrets',
      current_shift: 'Current shift',
      players_in_turret: 'Players in turret',
      captain_march: 'Captain march',
      rally_size: 'Rally size',
      total_sum: 'Total',
      free_space: 'Free space',
      auto_fill: 'Auto-fill',
      fill_all: 'Fill all automatically',
      auto_fill_all: 'Fill all automatically',
      clear_current_shift: 'Clear current shift',
      clear_helpers: 'Clear helpers',
      clear_turret: 'Clear turret',
      save_turret_table: 'Save turret table',
      choose_captain: 'Choose a captain…',
      change_captain: 'Change captain…',
      place_captain: 'Assign captain',
      add_player_manually: 'Add player manually',
      save_limits: 'Save limits',
      recalc_composition: 'Recalculate roster',
      reset_limits: 'Reset limits',
      limits_by_tier: 'Turret settings · tier limits',
      max_players: 'Max players',
      flexible_tier_note: '0 = flexible tier: uses full march, and if there is not enough space it shares the remaining space among players of this tier.',
      search_player_from_list: 'Find player (from roster)',
      nickname_custom: 'Nickname (you can enter a custom one)',
      nickname: 'Nickname',
      alliance: 'Alliance',
      march: 'March',
      player: 'Player',
      ally: 'Alliance',
      players_in_turret_title: 'Players in turret',
      captain_and_players: 'Captain and players',
      no_captain: 'No captain',
      no_assigned_players: 'No assigned players',
      one_turret_only: 'Show one turret',
      all_turrets: 'Show all turrets',
      only_captains: 'Captains only',
      respect_player_shift: 'Respect player shift',
      same_troop_only: 'Same troop type only',
      use_both: 'Use “Both”',
      type_defined_by_captain: 'Turret type is defined by the captain',
      final_plan_share: 'Share',
      export_png: 'Download PNG',
      open_menu: 'Open menu',
      close_menu: 'Close menu',
      settings_title: 'Settings',
      shift_plan: 'Shift plan',
      separate_shift_note: 'Each shift has its own plan. Auto-fill does not duplicate players between them.',
      player_status_note: 'One table with the actual player status: in a turret, outside a turret, or in reserve.',
      tower_settings_hint: 'Choose a turret on the left and configure it on the right.',
      total_players: 'Total players',
      captains_ready: 'Captains ready',
      reset_filters: 'Reset filters',
      import_label: 'Import CSV/XLSX/URL',
      show_all_data: 'Show all data',
      players_panel_lead: 'Keep your alliance roster in one place: import the list, filter players, and quickly assign them to turrets and shifts.',
      calc_title: 'Turret Planning',
      calc_subtitle: 'Plan for 10 captains: distribute players across turrets and tiers so officers can assemble each shift faster.',
      load_captains: 'Pull captains',
      rebalance: 'Apply rebalance',
      topup_turrets: 'Top up turrets',
      clear: 'Clear',
      parameters_limits: 'Distribution settings and limits',
      in_turrets: 'In turrets',
      outside_turrets: 'Outside turrets',
      in_reserve: 'In reserve',
      in_turret_status: 'In turret',
      outside_turret_status: 'Outside turret',
      to_reserve_status: 'Reserve',
      restore_from_import: 'Restore from import',
      clear_reserve_s1: 'Clear reserve S1',
      clear_reserve_s2: 'Clear reserve S2',
      overall: 'Overall',
      ready: 'Ready',
      no_captain_short: 'No captain',
      players_short: 'players',
      player_choice: 'Choose player for turret',
      remove_selected: 'Remove selected',
      manual_player_title: 'Manual edit or add player',
      player_nickname: 'Player nickname',
      march_power: 'March power',
      manual_status_hint: 'Select a player to change march or tier, or enter a new one and save.',
      captain_not_selected: 'Captain is not selected yet',
      turret_type: 'Turret type',
      turret_type_restricted: 'You can add helpers of this type only.',
      player_select_placeholder: '— choose a player —',
      captain_tag_short: 'CAP',
      in_turret_tag: 'IN TURRET',
      helper_tag_short: 'HELP',
      tier_march_limits: 'Tier march limits',
      auto_tier_limits: 'automatic',
      max_helpers: 'Max helpers',
      final_plan_status: 'Final plan',
      helper_slots: 'Helper slots',
      turret_capacity: 'Turret capacity',
      used_shortage: 'Used / shortage',
      troop_type: 'Troop type',
      lair_level: 'Lair level',
      yes: 'Yes',
      no: 'No',
      manual_save_enter_name: 'Manual save: enter player nickname',
      manual_save_enter_march: 'Manual save: enter march power',
      no_players_assigned_yet: 'No players assigned yet',
      no_final_plan_export: 'There is no final plan to export.',
      no_final_plan_share: 'There is no final plan to share.',
      html2canvas_missing: 'html2canvas is not loaded.',
      png_failed: 'Failed to generate PNG.',
      calc_window_not_loaded: 'The planning window is not loaded yet. Please try again.',
      change_shift_failed: 'Failed to change the player shift.',
      rally_captain_helper_space: 'Rally · Captain march · Helper slots'
    },
    ru: {
      lang_name: 'Русский',
      app_subtitle: 'Puzzle & Survival — Планировщик турелей',
      menu: 'Меню',
      settings_import: 'Настройки / Импорт',
      final_plan: 'Финальный план',
      tower_planning: 'Распределение по турелям',
      players: 'Игроки',
      settings: 'Настройки',
      tower_settings: 'Настройки турелей',
      player_status: 'Статус игроков',
      search: 'Поиск',
      search_placeholder: 'Поиск по нику / альянсу',
      role: 'Роль',
      tier: 'Тир',
      shift: 'Смена',
      rows: 'Строк',
      status: 'Статус',
      placement: 'Размещение',
      reserve: 'Резерв',
      not_assigned: 'Не назначен',
      edit: 'Редактировать',
      save: 'Сохранить',
      remove_from_turret: 'Убрать из турели',
      fighter: 'Боец', rider: 'Наездник', shooter: 'Стрелок', unknown: 'Неизвестно',
      fighter_plural: 'Бойцы', rider_plural: 'Наездники', shooter_plural: 'Стрелки',
      helper: 'Помощник', captain: 'Капитан',
      shift1: 'Смена 1', shift2: 'Смена 2', both: 'Обе', all: 'Все',
      first_half: 'Первая половина', second_half: 'Вторая половина',
      hub: 'Техно-Центр', north_turret: 'Северная турель', west_turret: 'Западная турель', east_turret: 'Восточная турель', south_turret: 'Южная турель', turret: 'Турель', turrets: 'Турели',
      current_shift: 'Текущая смена',
      players_in_turret: 'Игроков в турели',
      captain_march: 'Марш капитана',
      rally_size: 'Размер ралли',
      total_sum: 'Итого',
      free_space: 'Свободно',
      auto_fill: 'Автозаполнение',
      fill_all: 'Заполнить всё автоматически',
      auto_fill_all: 'Заполнить всё автоматически',
      clear_current_shift: 'Очистить текущую смену',
      clear_helpers: 'Очистить помощников',
      clear_turret: 'Очистить турель',
      save_turret_table: 'Сохранить таблицу турели',
      choose_captain: 'Выбрать капитана…',
      change_captain: 'Сменить капитана…',
      place_captain: 'Назначить капитана',
      add_player_manually: 'Добавить игрока вручную',
      save_limits: 'Сохранить лимиты',
      recalc_composition: 'Пересчитать состав',
      reset_limits: 'Сбросить лимиты',
      limits_by_tier: 'Настройки турели · лимиты по тирам',
      max_players: 'Макс. игроков',
      flexible_tier_note: '0 = гибкий тир: берёт полный марш, а если места не хватает — делит остаток между игроками этого тира.',
      search_player_from_list: 'Поиск игрока (из списка)',
      nickname_custom: 'Ник (можно свой, не из списка)',
      nickname: 'Ник',
      alliance: 'Альянс',
      march: 'Марш',
      player: 'Игрок',
      ally: 'Альянс',
      players_in_turret_title: 'Игроки в турели',
      captain_and_players: 'Капитан и игроки',
      no_captain: 'Без капитана',
      no_assigned_players: 'Нет назначенных игроков',
      one_turret_only: 'Показать одну турель',
      all_turrets: 'Показать все турели',
      only_captains: 'Только капитаны',
      respect_player_shift: 'Учитывать смену игрока',
      same_troop_only: 'Только тот же тип войск',
      use_both: 'Использовать «Обе»',
      type_defined_by_captain: 'Тип турели определяется капитаном',
      final_plan_share: 'Поделиться',
      export_png: 'Скачать PNG',
      open_menu: 'Открыть меню',
      close_menu: 'Закрыть меню',
      settings_title: 'Настройки',
      shift_plan: 'План смены',
      separate_shift_note: 'У каждой смены свой план. Автозаполнение не дублирует игроков между ними.',
      player_status_note: 'Одна таблица с фактическим статусом игрока: в турели, вне турели или в резерве.',
      tower_settings_hint: 'Выберите турель слева и настройте её справа.',
      total_players: 'Всего игроков',
      captains_ready: 'Капитанов готовы',
      reset_filters: 'Сбросить фильтры',
      import_label: 'Импорт CSV/XLSX/URL',
      show_all_data: 'Показать все данные',
      players_panel_lead: 'Весь состав альянса в одном месте: импортируй список, фильтруй игроков и быстро распределяй их по турелям и сменам.',
      calc_title: 'Распределение по турелям',
      calc_subtitle: 'План на 10 капитанов: распределение игроков по турелям и тирам, чтобы офицерам было проще собирать смены.',
      load_captains: 'Подтянуть капитанов',
      rebalance: 'Применить перераспределение',
      topup_turrets: 'Дозаполнить турели',
      clear: 'Очистить',
      parameters_limits: 'Параметры распределения и лимиты',
      in_turrets: 'В турелях',
      outside_turrets: 'Вне турелей',
      in_reserve: 'В резерве',
      in_turret_status: 'В турели',
      outside_turret_status: 'Вне турели',
      to_reserve_status: 'Резерв',
      restore_from_import: 'Восстановить из импорта',
      clear_reserve_s1: 'Сбросить резерв С1',
      clear_reserve_s2: 'Сбросить резерв С2',
      overall: 'Всего',
      ready: 'Готово',
      no_captain_short: 'Без капитана',
      players_short: 'игроков',
      player_choice: 'Выбор игрока для турели',
      remove_selected: 'Убрать выбранного',
      manual_player_title: 'Ручное редактирование или добавление игрока',
      player_nickname: 'Ник игрока',
      march_power: 'Сила марша',
      manual_status_hint: 'Выбери игрока, чтобы изменить марш или тир, или введи нового и сохрани.',
      captain_not_selected: 'Капитан ещё не выбран',
      turret_type: 'Тип турели',
      turret_type_restricted: 'Можно добавлять только помощников этого типа.',
      player_select_placeholder: '— выбери игрока —',
      captain_tag_short: 'КАП',
      in_turret_tag: 'В ТУРЕЛИ',
      helper_tag_short: 'ПОМ',
      tier_march_limits: 'Лимиты марша по тирам',
      auto_tier_limits: 'автоматически',
      max_helpers: 'Макс. помощников',
      final_plan_status: 'Финальный план',
      helper_slots: 'Мест для помощников',
      turret_capacity: 'Вместимость турели',
      used_shortage: 'Использовано / нехватка',
      troop_type: 'Тип войск',
      lair_level: 'Уровень логова',
      yes: 'Да',
      no: 'Нет',
      manual_save_enter_name: 'Ручное сохранение: введи ник игрока',
      manual_save_enter_march: 'Ручное сохранение: введи размер марша',
      no_players_assigned_yet: 'Игроки ещё не назначены',
      no_final_plan_export: 'Нет финального плана для экспорта.',
      no_final_plan_share: 'Нет финального плана для отправки.',
      html2canvas_missing: 'html2canvas не загрузился.',
      png_failed: 'Не удалось создать PNG.',
      calc_window_not_loaded: 'Окно распределения ещё не загрузилось. Попробуй ещё раз.',
      change_shift_failed: 'Не удалось изменить смену игрока.',
      rally_captain_helper_space: 'Ралли · Марш капитана · Мест для помощников'
    }
  };

  function safeLocale(lang) {
    return SUPPORTED.includes(lang) ? lang : 'uk';
  }

  function get(key, fallback = '') {
    const lang = safeLocale(I18N.locale || document.documentElement.dataset.locale || 'uk');
    return (dict[lang] && dict[lang][key]) ?? (dict.uk && dict.uk[key]) ?? fallback ?? key;
  }

  function normalize(text) {
    return String(text ?? '')
      .replace(/[“”«»„]/g, '"')
      .replace(/[’]/g, "'")
      .replace(/\s+/g, ' ')
      .replace(/\u00a0/g, ' ')
      .trim()
      .toLowerCase();
  }

  const aliasGroups = {
    app_subtitle: ['Puzzle & Survival — Планувальник турелей', 'Puzzle & Survival — Turret Planner', 'Puzzle & Survival — Планировщик турелей'],
    menu: ['Меню', 'Menu'],
    settings_import: ['Налаштування / Імпорт', 'Настройки / Импорт', 'Setup / Import'],
    final_plan: ['Фінальний план', 'Final Plan', 'Финальный план'],
    tower_planning: ['Розподіл по турелях', 'Turret Planning', 'Распределение по турелям', 'Tower Calculator'],
    players: ['Гравці', 'Players', 'Игроки'],
    settings_title: ['Налаштування / Settings', 'Налаштування', 'Settings', 'Настройки / Settings', 'Настройки'],
    shift_plan: ['План зміни', 'Shift plan', 'План смены'],
    one_turret_only: ['Показати одну турель', 'Show one turret', 'Показать одну турель'],
    all_turrets: ['Показати всі турелі', 'Show all turrets', 'Показать все турели'],
    tower_settings: ['Налаштування турелей', 'Turret Settings', 'Настройки турелей'],
    auto_fill_all: ['Автозаповнити все', 'Fill all automatically', 'Заполнить всё автоматически'],
    clear_current_shift: ['Очистити поточну зміну', 'Очистити поточний Shift', 'Clear current shift', 'Очистить текущую смену'],
    final_plan: ['Фінальний план', 'Final Plan', 'Финальный план'],
    separate_shift_note: ['Зміна 1 / Зміна 2 — окремі плани. Автозаповнення не дублює гравців між ними.', 'Shift 1 / Shift 2 — separate plans. Auto-fill does not duplicate players between them.', 'Смена 1 / Смена 2 — отдельные планы. Автозаполнение не дублирует игроков между ними.'],
    type_defined_by_captain: ['Тип визначається капітаном', 'Тип турелі визначається капітаном', 'Type is defined by the captain', 'Turret type is defined by the captain', 'Тип определяется капитаном', 'Тип турели определяется капитаном', 'Rider base (авто по капітану)', 'Fighter base (авто по капітану)', 'Shooter base (авто по капітану)'],
    current_shift: ['План / Plan', 'Поточна зміна', 'Current shift', 'Текущая смена'],
    players_in_turret: ['Гравців у турелі', 'Players in turret', 'Игроков в турели'],
    captain_march: ['Марш капітана', 'Captain march', 'Марш капитана'],
    rally_size: ['Розмір ралі', 'Rally size', 'Размер ралли'],
    total_sum: ['Разом', 'Total Σ', 'Total', 'Итого'],
    free_space: ['Вільне місце', 'Free space', 'Свободно'],
    auto_fill: ['Автозаповнення', 'Auto-fill', 'Автозаполнение'],
    clear_helpers: ['Очистити помічників', 'Clear helpers', 'Очистить помощников'],
    clear_turret: ['Очистити турель', 'Clear turret', 'Очистить турель'],
    player: ['Гравець', 'Player', 'Игрок'],
    ally: ['Альянс', 'Ally', 'Альянс'],
    role: ['Роль', 'Role', 'Роль / Tier'],
    tier: ['Тір', 'Tier', 'Тир'],
    march: ['Марш', 'March', 'Марш'],
    only_captains: ['Тільки капітани', 'Only captains', 'Только капитаны'],
    respect_player_shift: ['Враховувати зміну гравця', 'Match registered shift', 'Respect player shift', 'Учитывать смену игрока'],
    same_troop_only: ['Лише той самий тип військ', 'Same troop type only', 'Only same troop type', 'Только тот же тип войск'],
    use_both: ['Використовувати «Обидві»', 'Використовувати Both', 'Use Both', 'Use “Both”', 'Использовать «Обе»', 'Использовать Both'],
    load_captains: ['Підтягнути капітанів', 'Підтягнути капітанів з турелей', 'Pull captains', 'Подтянуть капитанов', 'Подтянуть капитанов из турелей'],
    rebalance: ['Застосувати перерозподіл', 'Apply rebalance', 'Применить перераспределение'],
    topup_turrets: ['Дозаповнити турелі', 'Top up turrets', 'Дозаполнить турели'],
    clear: ['Очистити', 'Clear', 'Очистить'],
    parameters_limits: ['Параметри розподілу і ліміти', 'Distribution settings and limits', 'Параметры распределения и лимиты'],
    player_status: ['Статус гравців', 'Player Status', 'Статус игроков'],
    player_status_note: ['Одна таблиця з фактичним статусом гравця: у турелі, поза туреллю або в резерві.', 'One table with the actual player status: in a turret, outside a turret, or in reserve.', 'Одна таблица с фактическим статусом игрока: в турели, вне турели или в резерве.'],
    in_turrets: ['У турелях', 'In turrets', 'В турелях'],
    outside_turrets: ['Поза турелями', 'Outside turrets', 'Вне турелей'],
    in_reserve: ['У резерві', 'In reserve', 'В резерве'],
    restore_from_import: ['Відновити з імпорту', 'Restore from import', 'Восстановить из импорта'],
    clear_reserve_s1: ['Скинути резерв зміни 1', 'Clear reserve S1', 'Сбросить резерв С1'],
    clear_reserve_s2: ['Скинути резерв зміни 2', 'Clear reserve S2', 'Сбросить резерв С2'],
    overall: ['Усього', 'Overall', 'Всего'],
    export_png: ['Експорт PNG', 'Завантажити PNG', 'Download PNG', 'Скачать PNG'],
    final_plan_share: ['Поділитися', 'Share', 'Поделиться'],
    show_all_data: ['Показати всі дані', 'Show all data', 'Показать все данные'],
    import_label: ['Імпорт CSV/XLSX/URL', 'Import CSV/XLSX/URL', 'Импорт CSV/XLSX/URL'],
    total_players: ['Всього гравців', 'Total players', 'Всего игроков'],
    captains_ready: ['Капітанів готові', 'Captains ready', 'Капитанов готовы'],
    search: ['Пошук', 'Search', 'Поиск'],
    rows: ['Рядків', 'Rows', 'Строк'],
    reset_filters: ['Скинути фільтри', 'Reset filters', 'Сбросить фильтры'],
    placement: ['Розміщення', 'Placement', 'Размещение'],
    reserve: ['Резерв', 'Reserve', 'Резерв'],
    not_assigned: ['Не призначено', 'Not assigned', 'Не назначено'],
    edit: ['Редагувати', 'Edit', 'Редактировать'],
    save: ['Зберегти', 'Save', 'Сохранить'],
    nickname: ['Нік', 'Nickname', 'Ник'],
    choose_captain: ['Вибрати капітана…', 'Choose a captain…', 'Выбрать капитана…'],
    change_captain: ['Змінити капітана…', 'Change captain…', 'Сменить капитана…'],
    place_captain: ['Поставити капітана', 'Assign captain', 'Назначить капитана'],
    save_turret_table: ['Зберегти таблицю турелі', 'Save turret table', 'Сохранить таблицу турели'],
    limits_by_tier: ['Налаштування турелі · ліміти по тірах (макс. марш)', 'Налаштування турелі · ліміти по тірах', 'Turret settings · tier limits', 'Настройки турели · лимиты по тирам'],
    max_players: ['Макс. гравців', 'Max players', 'Макс. игроков'],
    max_helpers: ['Макс. помічників', 'Max helpers', 'Макс. помощников'],
    ready: ['Готова', 'Ready', 'Готово'],
    no_captain_short: ['Без капітана', 'No captain', 'Без капитана'],
    players_short: ['гравців', 'players', 'игроков'],
    remove_selected: ['Прибрати вибраного', 'Remove selected', 'Убрать выбранного'],
    manual_player_title: ['Ручне редагування або додавання гравця', 'Manual edit or add player', 'Ручное редактирование или добавление игрока'],
    player_nickname: ['Нік гравця', 'Player nickname', 'Ник игрока'],
    march_power: ['Сила маршу', 'March power', 'Сила марша'],
    manual_status_hint: ['Обери гравця, щоб змінити марш або тір, або введи нового й збережи.', 'Select a player to change march or tier, or enter a new one and save.', 'Выбери игрока, чтобы изменить марш или тир, или введи нового и сохрани.'],
    captain_not_selected: ['Капітана ще не обрано', 'Captain is not selected yet', 'Капитан ещё не выбран'],
    turret_type: ['Тип турелі', 'Turret type', 'Тип турели'],
    turret_type_restricted: ['Можна додавати лише помічників цього типу.', 'You can add helpers of this type only.', 'Можно добавлять только помощников этого типа.'],
    player_select_placeholder: ['— вибери гравця —', '— choose a player —', '— выбери игрока —'],
    captain_tag_short: ['КАП', 'CAP', 'КАП'],
    in_turret_tag: ['У ТУРЕЛІ', 'IN TURRET', 'В ТУРЕЛИ'],
    helper_tag_short: ['ПОМ', 'HELP', 'ПОМ'],
    tier_march_limits: ['Ліміти маршу за тірами', 'Tier march limits', 'Лимиты марша по тирам'],
    auto_tier_limits: ['автоматично', 'automatic', 'автоматически'],
    save_limits: ['Зберегти ліміти', 'Save limits', 'Сохранить лимиты'],
    recalc_composition: ['Перерахувати склад', 'Recalculate roster', 'Пересчитать состав'],
    reset_limits: ['Скинути ліміти (T14–T9 → 0)', 'Скинути ліміти', 'Reset limits', 'Сбросить лимиты'],
    flexible_tier_note: ['0 = гнучкий тір: бере повний марш, але якщо місця не вистачає — ділить залишок між гравцями цього тіру.', '0 = flexible tier: uses full march, and if there is not enough space it shares the remaining space among players of this tier.', '0 = гибкий тир: берёт полный марш, а если места не хватает — делит остаток между игроками этого тира.'],
    add_player_manually: ['Додати вручну помічника', 'Додати гравця вручну', 'Add player manually', 'Добавить игрока вручную'],
    search_player_from_list: ['Пошук гравця (зі списку)', 'Find player (from roster)', 'Поиск игрока (из списка)'],
    nickname_custom: ['Нік (можна свій, не зі списку)', 'Nickname (you can enter a custom one)', 'Ник (можно свой, не из списка)'],
    players_in_turret_title: ['Гравці в турелі', 'Players in turret', 'Игроки в турели'],
    captain_and_players: ['Капітан + гравці', 'Капітан і гравці', 'Captain and players', 'Капитан и игроки'],
    no_captain: ['Без капітана', 'No captain', 'Без капитана'],
    no_assigned_players: ['Немає призначених гравців', 'No assigned players', 'Нет назначенных игроков'],
    open_menu: ['Відкрити меню', 'Open menu', 'Открыть меню'],
    close_menu: ['Закрити меню', 'Close menu', 'Закрыть меню'],
    players_panel_lead: ['Склад альянсу в одному місці: імпортуй список, фільтруй гравців і швидко розподіляй їх по турелях та змінах.', 'Keep your alliance roster in one place: import the list, filter players, and quickly assign them to turrets and shifts.', 'Весь состав альянса в одном месте: импортируй список, фильтруй игроков и быстро распределяй их по турелям и сменам.'],
    calc_subtitle: ['План на 10 капітанів (5 + 5), розрахунок вміщення гравців по турелях і тірах (капітани не входять у tier-пул)', 'План на 10 капітанів: розподіл гравців по турелях і тірах, щоб офіцерам було легко зібрати зміни.', 'Plan for 10 captains: distribute players across turrets and tiers so officers can assemble each shift faster.', 'План на 10 капитанов: распределение игроков по турелям и тирам, чтобы офицерам было проще собирать смены.']
  };

  const textAliasMap = new Map();
  Object.entries(aliasGroups).forEach(([key, arr]) => {
    arr.forEach((value) => textAliasMap.set(normalize(value), key));
  });

  function roleKey(value) {
    const raw = String(value || '').toLowerCase();
    if (/(shoot|стрел|стріл|стріле|стрільц|射手|狙)/i.test(raw)) return 'shooter';
    if (/(fight|боє|бое|бійц|бойц|пех|піх|步兵|战士)/i.test(raw)) return 'fighter';
    if (/(ride|наїз|наезд|骑|騎|기병|ライダー)/i.test(raw)) return 'rider';
    return 'unknown';
  }

  function getLocale() {
    return safeLocale(I18N.locale || document.documentElement.dataset.locale || 'uk');
  }

  function roleLabel(value, plural = false) {
    const key = roleKey(value);
    return get(plural ? `${key}_plural` : key, String(value || ''));
  }

  function shiftLabel(value) {
    const raw = String(value || '').toLowerCase();
    if (raw.includes('1')) return get('shift1');
    if (raw.includes('2')) return get('shift2');
    if (/(both|обидв|обе|оба)/.test(raw)) return get('both');
    if (/(all|усі|всі|все)/.test(raw)) return get('all');
    return String(value || '');
  }

  function towerLabel(value) {
    const raw = String(value || '');
    if (/техно|hub|central/i.test(raw)) return get('hub');
    if (/північ|north|север/i.test(raw)) return get('north_turret');
    if (/захід|west|запад/i.test(raw)) return get('west_turret');
    if (/схід|east|вост/i.test(raw)) return get('east_turret');
    if (/півден|south|юж/i.test(raw)) return get('south_turret');
    if (/turret|турел/i.test(raw)) return get('turret');
    return raw;
  }

  function translateExact(text) {
    const key = textAliasMap.get(normalize(text));
    return key ? get(key, text) : null;
  }

  function translateText(text) {
    const original = String(text ?? '');
    if (!original.trim()) return original;

    const exact = translateExact(original);
    if (exact) return exact;

    let out = original;

    out = out.replace(/^shift\s*1$/i, get('shift1'));
    out = out.replace(/^shift\s*2$/i, get('shift2'));
    out = out.replace(/^shift1$/i, get('shift1'));
    out = out.replace(/^shift2$/i, get('shift2'));
    out = out.replace(/^both$/i, get('both'));
    out = out.replace(/^all$/i, get('all'));
    out = out.replace(/^fighter$/i, get('fighter'));
    out = out.replace(/^rider$/i, get('rider'));
    out = out.replace(/^shooter$/i, get('shooter'));
    out = out.replace(/^fighters$/i, get('fighter_plural'));
    out = out.replace(/^riders$/i, get('rider_plural'));
    out = out.replace(/^shooters$/i, get('shooter_plural'));
    out = out.replace(/^helper$/i, get('helper'));
    out = out.replace(/^captain$/i, get('captain'));
    out = out.replace(/^player$/i, get('player'));
    out = out.replace(/^ally$/i, get('ally'));
    out = out.replace(/^role$/i, get('role'));
    out = out.replace(/^tier$/i, get('tier'));
    out = out.replace(/^march$/i, get('march'));
    out = out.replace(/^auto-fill$/i, get('auto_fill'));
    out = out.replace(/^total\s*Σ?$/i, get('total_sum'));
    out = out.replace(/^free space$/i, get('free_space'));
    out = out.replace(/^plan\s*\/\s*plan$/i, get('current_shift'));
    out = out.replace(/^rider\s*base\s*\(.*\)$/i, get('type_defined_by_captain'));
    out = out.replace(/^fighter\s*base\s*\(.*\)$/i, get('type_defined_by_captain'));
    out = out.replace(/^shooter\s*base\s*\(.*\)$/i, get('type_defined_by_captain'));
    out = out.replace(/^rider\s*\/\s*rider$/i, get('rider'));
    out = out.replace(/^fighter\s*\/\s*fighter$/i, get('fighter'));
    out = out.replace(/^shooter\s*\/\s*shooter$/i, get('shooter'));
    out = out.replace(/^(1st shift \/ первая половина|зміна 1 \/ перша половина|shift 1 \/ first half)$/i, `${get('shift1')} / ${get('first_half')}`);
    out = out.replace(/^(2nd shift \/ вторая половина|зміна 2 \/ друга половина|shift 2 \/ second half)$/i, `${get('shift2')} / ${get('second_half')}`);
    out = out.replace(/^(План \/ Plan|Current shift|Текущая смена)$/i, get('current_shift'));

    out = out.replace(/^Гравців у турелі:\s*(\d+)$/i, `${get('players_in_turret')}: $1`);
    out = out.replace(/^Players in turret:\s*(\d+)$/i, `${get('players_in_turret')}: $1`);
    out = out.replace(/^Игроков в турели:\s*(\d+)$/i, `${get('players_in_turret')}: $1`);

    out = out.replace(/^Макс\.\s*помічників:\s*(\d+)$/i, `${get('helper') === 'Помічник' ? 'Макс. помічників' : getLocale()==='en' ? 'Max helpers' : 'Макс. помощников'}: $1`);
    out = out.replace(/^Max helpers:\s*(\d+)$/i, `${getLocale()==='en' ? 'Max helpers' : getLocale()==='ru' ? 'Макс. помощников' : 'Макс. помічників'}: $1`);
    out = out.replace(/^Макс\.\s*помощников:\s*(\d+)$/i, `${getLocale()==='en' ? 'Max helpers' : getLocale()==='ru' ? 'Макс. помощников' : 'Макс. помічників'}: $1`);

    out = out.replace(/^Зміна:\s*(.+)$/i, (_, value) => `${get('shift')}: ${shiftLabel(value)}`);
    out = out.replace(/^Shift:\s*(.+)$/i, (_, value) => `${get('shift')}: ${shiftLabel(value)}`);
    out = out.replace(/^Смена:\s*(.+)$/i, (_, value) => `${get('shift')}: ${shiftLabel(value)}`);

    out = out.replace(/^Тип турелі:\s*(.+)$/i, (_, value) => `${get('turret')}: ${roleLabel(value, true).toLowerCase()}`);

    out = out.replace(/^У турелі$/i, get('in_turret_status'));
    out = out.replace(/^Outside turret$/i, get('outside_turret_status'));
    out = out.replace(/^Поза туреллю$/i, get('outside_turret_status'));
    out = out.replace(/^Вне турели$/i, get('outside_turret_status'));
    out = out.replace(/^В резерве$/i, get('to_reserve_status'));
    out = out.replace(/^У резерві$/i, get('to_reserve_status'));

    // mixed role labels
    out = out.replace(/\bFighter\b/g, get('fighter'));
    out = out.replace(/\bRider\b/g, get('rider'));
    out = out.replace(/\bShooter\b/g, get('shooter'));
    out = out.replace(/\bHelper\b/g, get('helper'));

    // tower names
    out = out.replace(/Техно-Центр|Tech Hub/gi, get('hub'));
    out = out.replace(/Північна турель|North Turret|Северная турель/gi, get('north_turret'));
    out = out.replace(/Західна турель|West Turret|Западная турель/gi, get('west_turret'));
    out = out.replace(/Східна турель|East Turret|Восточная турель/gi, get('east_turret'));
    out = out.replace(/Південна турель|South Turret|Южная турель/gi, get('south_turret'));

    out = out.replace(/^players:\s*(\d+)$/i, `${get('players_short')}: $1`);
    out = out.replace(/^(Готова|Ready|Готово)$/i, get('ready'));
    out = out.replace(/^(Без капітана|No captain|Без капитана)$/i, get('no_captain_short'));
    out = out.replace(/^(Капітан і гравці|Captain and players|Капитан и игроки)$/i, get('captain_and_players'));
    out = out.replace(/^(Немає призначених гравців|No assigned players|Нет назначенных игроков)$/i, get('no_assigned_players'));
    out = out.replace(/^(Ручне редагування або додавання гравця|Manual edit or add player|Ручное редактирование или добавление игрока)$/i, get('manual_player_title'));
    out = out.replace(/^(Нік гравця|Player nickname|Ник игрока)$/i, get('player_nickname'));
    out = out.replace(/^(Сила маршу|March power|Сила марша)$/i, get('march_power'));
    out = out.replace(/^(Прибрати вибраного|Remove selected|Убрать выбранного)$/i, get('remove_selected'));
    out = out.replace(/^(— вибери гравця —|— choose a player —|— выбери игрока —)$/i, get('player_select_placeholder'));
    out = out.replace(/^(Макс\. помічників|Max helpers|Макс\. помощников):\s*(\d+)$/i, `${get('max_helpers')}: $2`);
    out = out.replace(/^(Ліміти маршу за тірами|Tier march limits|Лимиты марша по тирам):\s*(.+)$/i, `${get('tier_march_limits')}: $2`);

    return out;
  }

  function translateAttr(el, attr) {
    if (!el || !el.getAttribute) return;
    const value = el.getAttribute(attr);
    if (!value) return;
    const next = translateText(value);
    if (next && next !== value) el.setAttribute(attr, next);
  }

  function translateLeafText(el) {
    if (!el || !el.childNodes || el.childNodes.length !== 1 || el.childNodes[0].nodeType !== Node.TEXT_NODE) return;
    const value = el.textContent;
    const next = translateText(value);
    if (next && next !== value) el.textContent = next;
  }

  function apply(root = document) {
    const scope = root && root.querySelectorAll ? root : document;
    const html = document.documentElement;
    html.lang = getLocale();
    html.dataset.locale = getLocale();

    const translatableNodes = [];
    if (scope && scope.nodeType === 1) translatableNodes.push(scope);
    if (scope && scope.querySelectorAll) {
      scope.querySelectorAll('[data-i18n],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label]').forEach((el) => translatableNodes.push(el));
    }
    translatableNodes.forEach((el) => {
      if (!el || !el.getAttribute) return;
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = get(key, el.textContent || '');
      const ph = el.getAttribute('data-i18n-placeholder');
      if (ph) el.setAttribute('placeholder', get(ph, el.getAttribute('placeholder') || ''));
      const ttl = el.getAttribute('data-i18n-title');
      if (ttl) el.setAttribute('title', get(ttl, el.getAttribute('title') || ''));
      const aria = el.getAttribute('data-i18n-aria-label');
      if (aria) el.setAttribute('aria-label', get(aria, el.getAttribute('aria-label') || ''));
    });

    // legacy fallback for old markup; runs on init / language switch / targeted HTMX swaps only.
    scope.querySelectorAll('*').forEach((el) => {
      if (el.closest && el.closest('script,style')) return;
      if (!el.hasAttribute('data-i18n-placeholder')) translateAttr(el, 'placeholder');
      if (!el.hasAttribute('data-i18n-title')) translateAttr(el, 'title');
      if (!el.hasAttribute('data-i18n-aria-label')) translateAttr(el, 'aria-label');
      if (!el.hasAttribute('data-i18n') && (el.tagName === 'OPTION' || el.tagName === 'BUTTON' || el.tagName === 'SPAN' || el.tagName === 'DIV' || el.tagName === 'P' || el.tagName === 'TH' || el.tagName === 'TD' || el.tagName === 'LABEL' || el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'H4' || el.tagName === 'SMALL' || el.tagName === 'STRONG' || el.tagName === 'SUMMARY')) {
        translateLeafText(el);
      }
    });

    const title = document.querySelector('title');
    if (title) title.textContent = get('app_subtitle');

    // language menu labels
    document.querySelectorAll('.lang-item').forEach((item) => {
      const lang = safeLocale(item.dataset.lang || 'uk');
      const nameEl = item.querySelector('.lang-name');
      if (nameEl) nameEl.textContent = dict[lang].lang_name;
      item.setAttribute('aria-selected', String(lang === getLocale()));
    });
    const label = document.getElementById('langLabel');
    if (label) label.textContent = dict[getLocale()].lang_name;

    // specific high-value elements
    const lead = document.querySelector('.players-panel-lead');
    if (lead) lead.textContent = get('players_panel_lead');
    const subtitle = document.querySelector('.brand-text .muted');
    if (subtitle) subtitle.textContent = get('app_subtitle');

    document.dispatchEvent(new CustomEvent('pns:i18n-applied', { detail: { locale: getLocale() } }));
  }

  let observerStarted = false;
  function observe() {
    observerStarted = true;
    return null;
  }

  function markReady() {
    const html = document.documentElement;
    html.classList.remove('i18n-pending');
    html.classList.add('i18n-ready');
  }

  function rerenderApp() {
    try { PNS.renderPlayersTableFromState?.(); } catch {}
    try { PNS.renderAll?.(); } catch {}
    try { PNS.updateShiftBreakdownUI?.(); } catch {}
    try { PNS.towerCalcRefreshStatusPlayersUi?.(); } catch {}
    try { PNS.refreshBaseCards?.(); } catch {}
  }

  function setLocale(lang, opts = {}) {
    const next = safeLocale(lang);
    I18N.locale = next;
    document.documentElement.lang = next;
    document.documentElement.dataset.locale = next;
    if (opts.persist !== false) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    }
    if (opts.rerender) rerenderApp();
    apply(document);
    markReady();
    document.dispatchEvent(new CustomEvent('pns:i18n-changed', { detail: { locale: next } }));
    return next;
  }

  function init() {
    try { I18N.locale = safeLocale(localStorage.getItem(STORAGE_KEY) || document.documentElement.dataset.locale || 'uk'); } catch { I18N.locale = safeLocale(document.documentElement.dataset.locale || 'uk'); }
    apply(document);
    markReady();
  }

  I18N.locale = safeLocale(document.documentElement.dataset.locale || 'uk');
  I18N.dict = dict;
  I18N.t = get;
  I18N.setLocale = setLocale;
  I18N.roleLabel = roleLabel;
  I18N.shiftLabel = shiftLabel;
  I18N.towerLabel = towerLabel;
  I18N.translateText = translateText;
  I18N.apply = apply;
  I18N.observe = observe;
  I18N.markReady = markReady;

  PNS.t = get;
  PNS.setLocale = setLocale;
  PNS.roleLabel = roleLabel;
  PNS.shiftLabel = shiftLabel;
  PNS.towerLabelUk = towerLabel;
  PNS.towerLabel = towerLabel;

  document.addEventListener('DOMContentLoaded', init);
})();
