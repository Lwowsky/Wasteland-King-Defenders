/*
 * Language dictionaries and translation application layer
 * Source parts: site_i18n.js
 */

((function () {
  const e = (window.PNS = window.PNS || {}),
    t = (window.PNSI18N = window.PNSI18N || {}),
    a = "pns_lang",
    r = ["uk", "en", "ru"];
  function n() {
    return r.slice();
  }
  const o = {
    uk: {
      lang_name: "Українська",
      app_subtitle: "Puzzle & Survival — Планувальник турелей",
      menu: "Меню",
      settings_import: "Налаштування / Імпорт",
      final_plan: "Фінальний план",
      tower_planning: "Розподіл по турелях",
      players: "Гравці",
      settings: "Налаштування",
      tower_settings: "Налаштування турелей",
      player_status: "Статус гравців",
      search: "Пошук",
      search_placeholder: "Пошук по ніку / альянсу",
      role: "Роль",
      tier: "Тір",
      shift: "Зміна",
      rows: "Рядків",
      status: "Статус",
      placement: "Розміщення",
      reserve: "Резерв",
      not_assigned: "Не призначено",
      edit: "Редагувати",
      save: "Зберегти",
      remove_from_turret: "Прибрати з турелі",
      fighter: "Боєць",
      rider: "Наїзник",
      shooter: "Стрілець",
      unknown: "Невідомо",
      fighter_plural: "Бійці",
      rider_plural: "Наїзники",
      shooter_plural: "Стрільці",
      helper: "Помічник",
      captain: "Капітан",
      shift1: "Зміна 1",
      shift2: "Зміна 2",
      both: "Обидві",
      all: "Усі",
      first_half: "Перша половина",
      second_half: "Друга половина",
      hub: "Техно-Центр",
      north_turret: "Північна турель",
      west_turret: "Західна турель",
      east_turret: "Східна турель",
      south_turret: "Південна турель",
      turret: "Турель",
      turrets: "Турелі",
      current_shift: "Поточна зміна",
      players_in_turret: "Гравців у турелі",
      captain_march: "Марш капітана",
      rally_size: "Розмір ралі",
      total_sum: "Разом",
      free_space: "Вільне місце",
      auto_fill: "Автозаповнення",
      auto_clear_helpers: "Очистити помічників",
      clear_turret: "Очистити турель",
      choose_captain: "Вибрати капітана…",
      change_captain: "Змінити капітана…",
      place_captain: "Поставити капітана",
      add_player_manually: "Додати гравця вручну",
      save_limits: "Зберегти ліміти",
      recalc_composition: "Перерахувати склад",
      reset_limits: "Скинути ліміти",
      limits_by_tier: "Налаштування турелі · ліміти по тірах",
      max_players: "Макс. гравців",
      flexible_tier_note:
        "0 = гнучкий тір: бере повний марш, а якщо місця не вистачає — ділить залишок між гравцями цього тіру.",
      search_player_from_list: "Пошук гравця (зі списку)",
      nickname_custom: "Нік (можна свій, не зі списку)",
      nickname: "Нік",
      alliance: "Альянс",
      march: "Марш",
      player: "Гравець",
      ally: "Альянс",
      players_in_turret_title: "Гравці в турелі",
      captain_and_players: "Капітан і гравці",
      no_captain: "Без капітана",
      no_assigned_players: "Немає призначених гравців",
      one_turret_only: "Показати одну турель",
      all_turrets: "Показати всі турелі",
      only_captains: "Тільки капітани",
      respect_player_shift: "Враховувати зміну гравця",
      same_troop_only: "Лише той самий тип військ",
      use_both: "Використовувати «Обидві»",
      type_defined_by_captain: "Тип турелі визначається капітаном",
      final_plan_share: "Поділитися",
      export_png: "Завантажити PNG",
      open_menu: "Відкрити меню",
      close_menu: "Закрити меню",
      settings_title: "Налаштування",
      shift_plan: "План зміни",
      separate_shift_note:
        "Кожна зміна має окремий план. Автозаповнення не дублює гравців між ними.",
      player_status_note:
        "Одна таблиця з фактичним статусом гравця: у турелі, поза туреллю або в резерві.",
      tower_settings_hint: "Оберіть турель зліва та налаштуйте її праворуч.",
      total_players: "Всього гравців",
      captains_ready: "Капітанів готові",
      reset_filters: "Скинути фільтри",
      import_label: "Імпорт CSV/XLSX/URL",
      show_all_data: "Показати всі дані",
      players_panel_lead:
        "Склад альянсу в одному місці: імпортуй список, фільтруй гравців і швидко розподіляй їх по турелях та змінах.",
      calc_title: "Розподіл по турелях",
      calc_subtitle:
        "План для 10 капітанів: розподіл гравців по турелях і тірах, щоб офіцерам було легко зібрати зміни.",
      rebalance: "Застосувати перерозподіл",
      topup_turrets: "Дозаповнити турелі",
      clear: "Очистити",
      cancel: "Скасувати",
      done: "Готово",
      confirm_action: "Підтвердь дію",
      parameters_limits: "Параметри розподілу і ліміти",
      in_turrets: "У турелях",
      outside_turrets: "Поза турелями",
      in_reserve: "У резерві",
      in_turret_status: "У турелі",
      outside_turret_status: "Поза туреллю",
      to_reserve_status: "Резерв",
      restore_from_import: "Відновити з імпорту",
      clear_reserve_s1: "Скинути резерв зміни 1",
      clear_reserve_s2: "Скинути резерв зміни 2",
      overall: "Усього",
      ready: "Готова",
      no_captain_short: "Без капітана",
      players_short: "гравців",
      player_choice: "Вибір гравця для турелі",
      remove_selected: "Прибрати вибраного",
      manual_player_title: "Ручне редагування або додавання гравця",
      player_nickname: "Нік гравця",
      march_power: "Марш",
      manual_status_hint:
        "Обери гравця, щоб змінити марш або тір, або введи нового й збережи.",
      troop_tier_import: "Тір військ",
      captain_ready_import: "Готовність бути капітаном",
      shift_availability_import: "Доступність по змінах",
      secondary_role_import: "Тип резервних військ",
      secondary_tier_import: "Тір резервних військ",
      troop_200k_import: "Тип резервних військ (200k+)",
      reserve_type_fighter_import: "Резервний тип військ: боєць",
      reserve_type_rider_import: "Резервний тип військ: наїзник",
      reserve_type_shooter_import: "Резервний тип військ: стрілець",
      custom_column_label: "кастомна",
      extra_column_label: "додаткова",
      custom_column_name_placeholder: "Назва кастомної колонки",
      custom_column_numbered: "Кастомна колонка {n}",
      captain_not_selected: "Капітана ще не обрано",
      turret_type: "Тип турелі",
      turret_type_restricted: "Можна додавати лише помічників цього типу.",
      player_select_placeholder: "— вибери гравця —",
      captain_tag_short: "КАП",
      in_turret_tag: "У ТУРЕЛІ",
      helper_tag_short: "ПОМ",
      tier_march_limits: "Ліміти маршу за тірами",
      auto_tier_limits: "автоматично",
      max_helpers: "Макс. помічників",
      final_plan_status: "Фінальний план",
      helper_slots: "Місць для помічників",
      turret_capacity: "Місткість турелі",
      used_shortage: "Використано / нестача",
      rally_captain_helper_space: "Ралі · Марш капітана · Місць для помічників",
      troop_type: "Тип військ",
      lair_level: "Рівень лігва",
      yes: "Так",
      no: "Ні",
      manual_save_enter_name: "Ручне збереження: введи нік гравця",
      manual_save_enter_march: "Ручне збереження: введи розмір маршу",
      no_players_assigned_yet: "Гравців ще не призначено",
      no_final_plan_export: "Немає фінального плану для експорту.",
      no_final_plan_share: "Немає фінального плану для поширення.",
      html2canvas_missing: "html2canvas не завантажився.",
      png_failed: "Не вдалося згенерувати PNG.",
      calc_window_not_loaded:
        "Вікно розподілу ще не завантажилось. Спробуй ще раз через секунду.",
      change_shift_failed: "Не вдалося змінити зміну гравця.",
      lang_menu: "Мова",
      status_free: "Вільні",
      status_assigned: "У турелі",
      status_captains: "Капітани",
      player_name: "Нік гравця",
      sort_by_tier: "Сортувати за тіром",
      sort_by_rally: "Сортувати за розміром ралі",
      march_size: "Розмір маршу",
      bases_title: "5 турелей і техно-центр",
      bases_subtitle:
        "Швидке керування турелями: обирай капітанів, додавай помічників і керуй змінами без зайвої плутанини.",
      settings_moved_notice:
        "Усі головні налаштування зібрані в першій колонці.",
      hide_others: "Приховати інші",
      right_turret: "Турель праворуч",
      previous_turret: "Попередня турель",
      next_turret: "Наступна турель",
      tower_scheme: "Схема турелей",
      captain_empty: "— Капітана не обрано —",
      plan_label: "План",
      auto_label: "Авто",
      helpers_not_assigned: "Помічників ще не призначено",
      settings_import_subtitle:
        "Завантаж список гравців, звір колонки й підготуй сайт до розподілу по турелях.",
      import_source_title: "1. Звідки взяти список гравців",
      import_source_note:
        "Завантаж файл або встав публічне посилання на таблицю.",
      import_source_file: "Файл",
      import_upload_title: "Завантажити CSV / Excel",
      import_upload_desc:
        "Підтримуються CSV, XLSX, XLS і TXT. Це найзручніший спосіб швидко додати таблицю.",
      import_source_link: "Посилання",
      import_url_title: "Google Sheets / CSV посилання",
      import_url_desc:
        "Працює з публічним CSV export або відкритим CSV-посиланням із Google Sheets.",
      detect_columns: "Знайти колонки",
      load_url: "Завантажити посилання",
      current_source: "Поточне джерело",
      file_not_loaded: "Файл або посилання ще не завантажено.",
      import_status_title: "Статус імпорту",
      import_status_hint:
        "Завантаж джерело, перевір колонки й натисни «Застосувати імпорт».",
      apply_import: "Застосувати імпорт",
      required_columns_title: "2. Обов’язкові колонки",
      required_columns_note:
        "Ім’я гравця, тип військ, тір, розмір маршу, розмір групової атаки, альянс, готовність бути капітаном і доступність по змінах.",
      save_template: "Зберегти шаблон",
      save_visible_columns: "Зберегти видимі колонки",
      optional_columns_title: "3. Додаткові колонки",
      optional_columns_note:
        "Рівень лігва, резервний тип військ і будь-які твої власні додаткові поля.",
      visible_columns_title: "4. Які дані показувати в таблиці",
      visible_columns_note:
        "Обери, які додаткові колонки бачити в таблиці гравців після натискання «Показати всі дані».",
      reset_data_title: "5. Скидання даних",
      reset_data_note:
        "Обережно: ці дії очищають збережені налаштування або дані таблиць.",
      reset_storage: "Повністю очистити LocalStorage",
      reset_column_data: "Скинути дані колонок",
      reset_table_data: "Скинути дані таблиць",
      import_footer_note:
        "Підтримуються CSV/XLSX і публічні CSV-посилання з Google Sheets.",
      board_subtitle:
        "Перегляд для офіцерів: зручно показати фінальний план, зробити скрін або поділитися ним.",
      board_language: "Мова плану",
      board_language_picker_note:
        "Познач мови, які треба показувати у фінальному плані.",
      always_on: "Завжди увімкнено",
      english_only: "Лише англійська",
      english_plus_local: "Англійська ✦ локальна",
      calc_modal_subtitle:
        "Тут ти готуєш склад для двох змін: розподіляєш гравців по турелях, перевіряєш резерв і збираєш фінальний план.",
      calculate: "Порахувати",
      prepare_limits_for_turrets: "Підготувати ліміти для турелей",
      auto_fill_turrets: "Автоматично заповнити турелі",
      mode: "Режим",
      apply_mode: "Застосування",
      assisted_mode: "З підказками",
      auto_mode: "Авто",
      manual_mode: "Вручну",
      topup_only: "Лише дозаповнення",
      empty_only: "Лише порожні",
      rebalance_all: "Перерозподілити все",
      advanced: "Додатково",
      auto_balance_both: "Автобаланс гравців «Обидві»",
      min_players_per_turret: "Мінімум гравців на турель",
      quantity: "Кількість",
      auto_tier_limit: "Авто-ліміт тіру",
      apply_and_assign_players: "Застосувати й розставити гравців по турелях",
      tier_march_limit_single: "Ліміт маршу за тіром (на 1 гравця):",
      sort_by_tier_label: "Сортувати за тіром",
      sort_by_rally_label: "Сортувати за розміром ралі",
      page_word: "Сторінка",
      shown_word: "показано",
      show_field_name_edit: "Показати редагування назв",
      hide_field_name_edit: "Сховати редагування назв",
      link_copied: "Посилання скопійовано",
      indicated_shift: "Зазначена зміна",
      choose_turret_left: "Оберіть турель зліва",
      edit_player_title: "Редагування гравця",
      player_edit_subtitle: "Зміна даних / видалення з турелі",
      where_place_player: "Куди поставити гравця",
      choose_shift_turret_role_or_reserve:
        "Обери зміну, турель і роль для гравця або залиш його в резерві.",
      role_in_turret: "Роль у турелі",
      captain_as_role: "капітаном",
      helper_as_role: "помічником",
      roster_edit_hint:
        "Редагування зі списку: марш і ралі оновлюються в картці гравця.",
      captain_tier_limit_note: "Капітан: обмеження за тіром не застосовується.",
      choose_turret_for_limit:
        "Оберіть турель, щоб побачити підказку по ліміту маршу.",
      autofill_limit_for_tier: "Ліміт автозаповнення для",
      manual_value_tower_shift_note:
        "(ручне значення можна задати лише для цієї турелі / цієї зміни).",
      quick_move_player:
        "Можна швидко перенести гравця в іншу турель або в іншу зміну.",
      choose_turret_role_shift_or_reserve:
        "Обери турель, роль і зміну для гравця або залиш його в резерві.",
      roster_edit_apply_selected_shift:
        "Редагування зі списку гравців: зміни застосовуються до вибраної зміни.",
      enter_nick_and_march: "Вкажи нік і марш",
      choose_shift_1_or_2: "Оберіть зміну 1 або зміну 2.",
      choose_captain_first: "Оберіть капітана",
      select_player_to_remove:
        "Вибери гравця, якого треба прибрати з цієї турелі",
      selected_player_not_assigned:
        "Вибраний гравець не призначений до цієї турелі.",
      choose_player_first: "Спочатку вибери гравця",
      apply_section_title: "Застосування",
      auto_slots_help:
        "Автослоти = швидкий розподіл місць для помічників по турелях за кількістю вільних гравців без капітанів.",
      calc_tip_text:
        "Спочатку вистав ліміти змін і турелей, потім використай «Застосувати ліміти» або «Автозаповнення турелей».",
      manual_limit_edit: "Редагувати ліміти вручну",
      remove_captain_aria: "Прибрати капітана",
      remove_helper_aria: "Прибрати помічника",
      no_players_in_turret_yet: "У цій турелі ще немає призначених гравців.",
      choose_column_placeholder: "— вибери колонку —",
      not_mapped_placeholder: "— не прив’язано —",
      remove_extra_column: "Видалити додаткову колонку",
      add_extra_column: "+ Додати додаткову колонку",
      helper_in_turret: "Помічник у турелі",
      manual_addition_note: "Ручне додавання",
      no_limit: "без обмежень",
      section_word: "Розділ",
      import_template_saved: "Шаблон імпорту збережено.",
      import_template_not_found:
        "Для поточних заголовків не знайдено відповідного збереженого шаблону.",
      columns_auto_detected:
        "Колонки визначено автоматично. Перевір зіставлення обов’язкових колонок.",
      visible_columns_saved: "Видимі колонки збережено.",
      column_data_reset: "Дані колонок скинуто до заводських налаштувань.",
      table_data_reset: "Дані таблиць скинуто. Можна завантажити нову таблицю.",
      import_demo_loaded: "Демо-набір завантажено в майстер імпорту.",
      restored_previous_session:
        "Гравців відновлено з попередньої сесії. У будь-який момент можна завантажити нову таблицю і замінити їх.",
      clear_helpers_both_done:
        "Очищено помічників у змінах 1 і 2. Капітани залишилися.",
      clear_helpers_done_prefix: "Очищено помічників:",
      captains_stayed: "Капітани залишилися.",
      actions: "Дії",
      add_to_shift1: "Додати в зміну 1",
      add_to_shift2: "Додати в зміну 2",
      added_manual_player: "Додано гравця вручну: {name} ({tier})",
      after_captain_helpers: "Стане (капітан/помічники)",
      all_players_placed: "Усі гравці розмістилися",
      all_shifts: "Усі зміни",
      already_assigned_in: "Гравець уже призначений у",
      apply: "Застосувати",
      autofill_added_zero: "додано 0",
      autofill_all_no_visible_captains: "немає видимих турелей із капітаном",
      autofill_in_turrets: "у турелях",
      available_march: "Доступний марш",
      available_players: "Доступно гравців",
      before_captain_helpers: "Було (капітан/помічники)",
      board_copied_image: "PNG план скопійовано в буфер",
      board_shared: "План поширено",
      both_ignored_in_shifts: "зараз не враховуються в змінах 1 і 2",
      both_not_counted: "Група «Обидві» зараз не враховується",
      by_word: "на",
      capacity_by_troop: "Місткість за типом військ (від капітанів)",
      captain_not_found: "Капітана не знайдено",
      captains_not_selected: "Капітанів не вибрано",
      captains_word: "капітанів",
      changes: "Зміни",
      choose_captain_for_turret: "Спочатку обери капітана для",
      choose_exact_nick: "вибери точний нік зі списку",
      clear_shift_1: "Очистити зміну 1",
      clear_shift_2: "Очистити зміну 2",
      clear_shift_both: "Очистити зміну 1 + 2",
      edit_players: "Редагувати гравців",
      empty_filter_now: "За цим фільтром зараз порожньо.",
      empty_short: "Порожньо",
      found_one_choose_enter: "Знайдено 1 — вибери зі списку / Enter",
      found_player: "Знайдено",
      from_total: "із",
      full: "Повний",
      helpers_cleared: "очищення помічників",
      helpers_limit_full: "Ліміт помічників заповнений",
      helpers_limit_full_simple: "Ліміт помічників заповнений",
      helpers_short: "помічники",
      hide_data: "Сховати дані",
      hide_selected_columns: "Сховати вибрані колонки",
      limit_exceeded: "Перевищено ліміт",
      limits_short: "ліміти",
      link_shown: "Посилання показано",
      lock_turret: "Заблокувати турель",
      locked_helpers: "Закріплених помічників",
      moved_to_turrets: "Перенесено у турелі",
      multiple_matches_choose_exact: "Знайдено кілька",
      new_captain_in_turret: "Новий капітан у турель",
      new_helper_in_turret: "Новий помічник у турель",
      no_free_players_of_role: "Немає вільних гравців типу",
      no_one_fits_rally_room: "Ніхто не вміщується в залишок ралі",
      no_players_after_checks:
        "Після перевірок не знайшлося відповідних гравців.",
      no_players_for_tier_limits:
        "Немає гравців, які підходять під ліміти маршу за тірами.",
      no_preview_data: "Немає даних для preview.",
      no_role_for_shift: "Немає гравців цього типу для зміни",
      no_role_for_turret_shift:
        "Немає гравців цього типу, які підходять під зміну цієї турелі",
      not_fit: "Не вліз",
      not_fit_plural: "Не влізли",
      not_in_any_turret: "Не стоять у жодній турелі",
      not_used: "Не використано",
      now_in_turrets: "Зараз реально стоять у турелях",
      other_shift: "іншій зміні",
      over_limit: "понад ліміт",
      overall_player_count: "загальна кількість гравців",
      overflow_placeholder: "— переліміт —",
      partial_short: "частково",
      picked_players: "Відібрані гравці",
      pin_action: "Закріпити",
      place_captain_first: "Спочатку постав капітана в турель",
      player_march_total: "Марш гравців",
      player_or_turret_not_found: "Гравця або турель не знайдено.",
      player_status_subtitle_both:
        "Тут видно всіх гравців із групи «Обидві»: хто вже стоїть у турелях, хто поза турелями, і хто вручну відправлений у резерв.",
      players_needed_placed: "Гравці (потрібно / поставлено)",
      players_word: "гравців",
      png_export_offline:
        "PNG export недоступний в offline-пакеті без локальної бібліотеки html2canvas.",
      png_saved: "PNG збережено",
      popups_suppressed: "приглушено popup-вікон",
      preparing_png: "Готуємо PNG",
      preparing_share: "Готуємо поширення",
      press_enter_or_choose: "Натисни Enter або вибери зі списку",
      preview_single_shift_note: "Показано лише одну вибрану зміну.",
      recommended_min_tier: "Рекомендований мінімум за тіром",
      remove_action: "Прибрати",
      reserve_and_outside: "Резерв і гравці поза турелями",
      reserve_manual_hint: "Гравці, яких вручну відправили в резерв зміни 1/2",
      reset_both_before_apply:
        "Спочатку скинь резерв для обох змін перед застосуванням.",
      reset_limits_tiers: "Скинути ліміти (T14–T9 → 0)",
      return_action: "Повернути",
      role_tier: "Роль / Тір",
      saved_turret_table: "Збережено таблицю турелі",
      selected_captains: "Обрано капітанів",
      sent: "Відправлено",
      separate_from_main_plan: "окремо від основного плану",
      shift1_limit: "Ліміт зміни 1",
      shift2_limit: "Ліміт зміни 2",
      shift_mismatch: "Невідповідність зміни",
      shift_move_hint:
        "Кнопки нижче одразу переводять гравця в потрібну зміну та запускають перерахунок.",
      shift_stats: "Статистика змін",
      shortage: "Нестача",
      show_selected_columns: "Показати вибрані колонки",
      shown_count: "Показано",
      status_filter: "Фільтр статусу",
      take_from_reserve: "Взяти з резерву",
      tier_summary: "Підсумок по тірах",
      total_players_short: "усього гравців",
      troop_mismatch: "Невідповідність типу військ",
      troop_type_unknown_for: "Не вдалося визначити тип військ для",
      turret_cleared: "очищення турелі",
      turret_locked_not_applied: "Турель заблокована — зміни не застосовано",
      turret_not_found: "Турель не знайдена",
      turret_not_ready_aria: "Турель не готова",
      turret_ready_aria: "Турель готова",
      turret_recalculated_free: "Склад турелі перераховано. Вільне місце",
      unlock_turret: "Розблокувати турель",
      unpin_action: "Відкріпити",
      updated_player_march: "Оновлено {name}: марш {march}",
      used_march: "Використано марш",
      used_players: "Використано гравців",
      warnings: "Попередження",
      without_limits: "без обмежень",
    },
    en: {
      lang_name: "English",
      app_subtitle: "Puzzle & Survival — Turret Planner",
      menu: "Menu",
      settings_import: "Setup / Import",
      final_plan: "Final Plan",
      tower_planning: "Turret Planning",
      players: "Players",
      settings: "Settings",
      tower_settings: "Turret Settings",
      player_status: "Player Status",
      search: "Search",
      search_placeholder: "Search by nickname / alliance",
      role: "Role",
      tier: "Tier",
      shift: "Shift",
      rows: "Rows",
      status: "Status",
      placement: "Placement",
      reserve: "Reserve",
      not_assigned: "Not assigned",
      edit: "Edit",
      save: "Save",
      remove_from_turret: "Remove from turret",
      fighter: "Fighter",
      rider: "Rider",
      shooter: "Shooter",
      unknown: "Unknown",
      fighter_plural: "Fighters",
      rider_plural: "Riders",
      shooter_plural: "Shooters",
      helper: "Helper",
      captain: "Captain",
      shift1: "Shift 1",
      shift2: "Shift 2",
      both: "Both",
      all: "All",
      first_half: "First half",
      second_half: "Second half",
      hub: "Tech Hub",
      north_turret: "North Turret",
      west_turret: "West Turret",
      east_turret: "East Turret",
      south_turret: "South Turret",
      turret: "Turret",
      turrets: "Turrets",
      current_shift: "Current shift",
      players_in_turret: "Players in turret",
      captain_march: "Captain march",
      rally_size: "Rally size",
      total_sum: "Total",
      free_space: "Free space",
      auto_fill: "Auto-fill",
      auto_clear_helpers: "Clear helpers",
      clear_turret: "Clear turret",
      choose_captain: "Choose a captain…",
      change_captain: "Change captain…",
      place_captain: "Assign captain",
      add_player_manually: "Add player manually",
      save_limits: "Save limits",
      recalc_composition: "Recalculate roster",
      reset_limits: "Reset limits",
      limits_by_tier: "Turret settings · tier limits",
      max_players: "Max players",
      flexible_tier_note:
        "0 = flexible tier: uses full march, and if there is not enough space it shares the remaining space among players of this tier.",
      search_player_from_list: "Find player (from roster)",
      nickname_custom: "Nickname (you can enter a custom one)",
      nickname: "Nickname",
      alliance: "Alliance",
      march: "March",
      player: "Player",
      ally: "Alliance",
      players_in_turret_title: "Players in turret",
      captain_and_players: "Captain and players",
      no_captain: "No captain",
      no_assigned_players: "No assigned players",
      one_turret_only: "Show one turret",
      all_turrets: "Show all turrets",
      only_captains: "Captains only",
      respect_player_shift: "Respect player shift",
      same_troop_only: "Same troop type only",
      use_both: "Use “Both”",
      type_defined_by_captain: "Turret type is defined by the captain",
      final_plan_share: "Share",
      export_png: "Download PNG",
      open_menu: "Open menu",
      close_menu: "Close menu",
      settings_title: "Settings",
      shift_plan: "Shift plan",
      separate_shift_note:
        "Each shift has its own plan. Auto-fill does not duplicate players between them.",
      player_status_note:
        "One table with the actual player status: in a turret, outside a turret, or in reserve.",
      tower_settings_hint:
        "Choose a turret on the left and configure it on the right.",
      total_players: "Total players",
      captains_ready: "Captains ready",
      reset_filters: "Reset filters",
      import_label: "Import CSV/XLSX/URL",
      show_all_data: "Show all data",
      players_panel_lead:
        "Keep your alliance roster in one place: import the list, filter players, and quickly assign them to turrets and shifts.",
      calc_title: "Turret Planning",
      calc_subtitle:
        "Plan for 10 captains: distribute players across turrets and tiers so officers can assemble each shift faster.",
      rebalance: "Apply rebalance",
      topup_turrets: "Top up turrets",
      clear: "Clear",
      cancel: "Cancel",
      done: "Done",
      confirm_action: "Confirm action",
      parameters_limits: "Distribution settings and limits",
      in_turrets: "In turrets",
      outside_turrets: "Outside turrets",
      in_reserve: "In reserve",
      in_turret_status: "In turret",
      outside_turret_status: "Outside turret",
      to_reserve_status: "Reserve",
      restore_from_import: "Restore from import",
      clear_reserve_s1: "Clear reserve S1",
      clear_reserve_s2: "Clear reserve S2",
      overall: "Overall",
      ready: "Ready",
      no_captain_short: "No captain",
      players_short: "players",
      player_choice: "Choose player for turret",
      remove_selected: "Remove selected",
      manual_player_title: "Manual edit or add player",
      player_nickname: "Player nickname",
      march_power: "March",
      manual_status_hint:
        "Select a player to change march or tier, or enter a new one and save.",
      troop_tier_import: "Troop tier",
      captain_ready_import: "Captain availability",
      shift_availability_import: "Shift availability",
      secondary_role_import: "Reserve troop type",
      secondary_tier_import: "Reserve troop tier",
      troop_200k_import: "Reserve troop type (200k+)",
      reserve_type_fighter_import: "Reserve troop type: fighter",
      reserve_type_rider_import: "Reserve troop type: rider",
      reserve_type_shooter_import: "Reserve troop type: shooter",
      custom_column_label: "custom",
      extra_column_label: "extra",
      custom_column_name_placeholder: "Custom column name",
      custom_column_numbered: "Custom column {n}",
      captain_not_selected: "Captain is not selected yet",
      turret_type: "Turret type",
      turret_type_restricted: "You can add helpers of this type only.",
      player_select_placeholder: "— choose a player —",
      captain_tag_short: "CAP",
      in_turret_tag: "IN TURRET",
      helper_tag_short: "HELP",
      tier_march_limits: "Tier march limits",
      auto_tier_limits: "automatic",
      max_helpers: "Max helpers",
      final_plan_status: "Final plan",
      helper_slots: "Helper slots",
      turret_capacity: "Turret capacity",
      used_shortage: "Used / shortage",
      troop_type: "Troop type",
      lair_level: "Lair level",
      yes: "Yes",
      no: "No",
      manual_save_enter_name: "Manual save: enter player nickname",
      manual_save_enter_march: "Manual save: enter march power",
      no_players_assigned_yet: "No players assigned yet",
      no_final_plan_export: "There is no final plan to export.",
      no_final_plan_share: "There is no final plan to share.",
      html2canvas_missing: "html2canvas is not loaded.",
      png_failed: "Failed to generate PNG.",
      calc_window_not_loaded:
        "The planning window is not loaded yet. Please try again.",
      change_shift_failed: "Failed to change the player shift.",
      rally_captain_helper_space: "Rally · Captain march · Helper slots",
      lang_menu: "Language",
      status_free: "Free",
      status_assigned: "In turret",
      status_captains: "Captains",
      player_name: "Player nickname",
      sort_by_tier: "Sort by tier",
      sort_by_rally: "Sort by rally size",
      march_size: "March size",
      bases_title: "5 turrets and tech hub",
      bases_subtitle:
        "Manage turrets faster: pick captains, add helpers, and control both shifts without extra clutter.",
      settings_moved_notice:
        "All main settings are grouped in the first column.",
      hide_others: "Hide others",
      right_turret: "Turret on the right",
      previous_turret: "Previous turret",
      next_turret: "Next turret",
      tower_scheme: "Turret layout",
      captain_empty: "— No captain selected —",
      plan_label: "Plan",
      auto_label: "Auto",
      helpers_not_assigned: "No helpers assigned yet",
      settings_import_subtitle:
        "Upload the player roster, verify the columns, and prepare the site for turret planning.",
      import_source_title: "1. Choose the roster source",
      import_source_note: "Upload a file or paste a public spreadsheet link.",
      import_source_file: "File",
      import_upload_title: "Upload CSV / Excel",
      import_upload_desc:
        "CSV, XLSX, XLS, and TXT are supported. This is the fastest way to add your roster.",
      import_source_link: "Link",
      import_url_title: "Google Sheets / CSV link",
      import_url_desc:
        "Works with a public CSV export or an open CSV link from Google Sheets.",
      detect_columns: "Detect columns",
      load_url: "Load link",
      current_source: "Current source",
      file_not_loaded: "No file or link has been loaded yet.",
      import_status_title: "Import status",
      import_status_hint:
        "Load the source, verify the columns, and press “Apply import”.",
      apply_import: "Apply import",
      required_columns_title: "2. Required columns",
      required_columns_note:
        "Player name, troop type, tier, march size, rally size, alliance, captain availability, and shift availability.",
      save_template: "Save template",
      save_visible_columns: "Save visible columns",
      optional_columns_title: "3. Optional columns",
      optional_columns_note:
        "Lair level, backup troop type, and any custom fields you want to keep.",
      visible_columns_title: "4. Which data to show in the table",
      visible_columns_note:
        "Choose which extra columns should appear in the players table after clicking “Show all data”.",
      reset_data_title: "5. Reset data",
      reset_data_note:
        "Careful: these actions clear saved settings or table data.",
      reset_storage: "Clear LocalStorage completely",
      reset_column_data: "Reset column data",
      reset_table_data: "Reset table data",
      import_footer_note:
        "CSV/XLSX files and public Google Sheets CSV links are supported.",
      board_subtitle:
        "Officer view: show the final plan, take a screenshot, or share it quickly.",
      calc_modal_subtitle:
        "Build both shifts here: assign players to turrets, check reserve slots, and prepare the final plan.",
      board_language: "Board language",
      board_language_picker_note:
        "Choose which languages to show in the final plan.",
      always_on: "Always enabled",
      english_only: "English only",
      english_plus_local: "English ✦ local",
      calculate: "Calculate",
      prepare_limits_for_turrets: "Prepare limits for turrets",
      auto_fill_turrets: "Auto-fill turrets",
      mode: "Mode",
      apply_mode: "Apply mode",
      assisted_mode: "Assisted",
      auto_mode: "Auto",
      manual_mode: "Manual",
      topup_only: "Top up only",
      empty_only: "Empty only",
      rebalance_all: "Rebalance all",
      advanced: "Advanced",
      auto_balance_both: "Auto-balance “Both” players",
      min_players_per_turret: "Minimum players per turret",
      quantity: "Count",
      auto_tier_limit: "Auto tier limit",
      apply_and_assign_players: "Apply and assign players to turrets",
      tier_march_limit_single: "Tier march limit (per 1 player):",
      sort_by_tier_label: "Sort by tier",
      sort_by_rally_label: "Sort by rally size",
      page_word: "Page",
      shown_word: "shown",
      show_field_name_edit: "Show label editing",
      hide_field_name_edit: "Hide label editing",
      link_copied: "Link copied",
      indicated_shift: "Registered shift",
      choose_turret_left: "Choose a turret on the left",
      edit_player_title: "Edit player",
      player_edit_subtitle: "Edit data / remove from turret",
      where_place_player: "Where to place the player",
      choose_shift_turret_role_or_reserve:
        "Choose the shift, turret, and role for the player, or leave them in reserve.",
      role_in_turret: "Role in turret",
      captain_as_role: "captain",
      helper_as_role: "as helper",
      roster_edit_hint:
        "Roster edit: march and rally are updated in the player card.",
      captain_tier_limit_note: "Captain: tier limit does not apply.",
      choose_turret_for_limit: "Choose a turret to see the march limit hint.",
      autofill_limit_for_tier: "Auto-fill limit for",
      manual_value_tower_shift_note:
        "(manual value can be set only for this turret / this shift).",
      quick_move_player:
        "You can quickly move the player to another turret or another shift.",
      choose_turret_role_shift_or_reserve:
        "Choose a turret, role, and shift for the player, or leave them in reserve.",
      roster_edit_apply_selected_shift:
        "Roster edit: changes are applied to the selected shift.",
      enter_nick_and_march: "Enter nickname and march",
      choose_shift_1_or_2: "Choose shift 1 or shift 2.",
      choose_captain_first: "Choose a captain",
      select_player_to_remove: "Choose a player to remove from this turret",
      selected_player_not_assigned:
        "The selected player is not assigned to this turret.",
      choose_player_first: "Choose a player first",
      apply_section_title: "Apply",
      auto_slots_help:
        "Auto slots = a quick distribution of helper slots across turrets based on the number of free players without captains.",
      calc_tip_text:
        "First set shift and turret limits, then use “Apply limits” or “Auto-fill turrets”.",
      manual_limit_edit: "Edit limits manually",
      remove_captain_aria: "Remove captain",
      remove_helper_aria: "Remove helper",
      no_players_in_turret_yet: "No players are assigned to this turret yet.",
      choose_column_placeholder: "— choose a column —",
      not_mapped_placeholder: "— not mapped —",
      remove_extra_column: "Remove extra column",
      add_extra_column: "+ Add extra column",
      helper_in_turret: "Helper in turret",
      manual_addition_note: "Manual addition",
      no_limit: "no limit",
      section_word: "Section",
      import_template_saved: "Import template saved.",
      import_template_not_found:
        "No saved template was found for the current headers.",
      columns_auto_detected:
        "Columns were detected automatically. Check the required column mapping.",
      visible_columns_saved: "Visible columns saved.",
      column_data_reset: "Column data was reset to defaults.",
      table_data_reset: "Table data was reset. You can load a new table now.",
      import_demo_loaded: "Demo data was loaded into the import wizard.",
      restored_previous_session:
        "Players were restored from the previous session. You can load a new table and replace them at any time.",
      clear_helpers_both_done:
        "Helpers were cleared in shifts 1 and 2. Captains remained.",
      clear_helpers_done_prefix: "Helpers cleared:",
      captains_stayed: "Captains remained.",
      actions: "Actions",
      add_to_shift1: "Add to shift 1",
      add_to_shift2: "Add to shift 2",
      added_manual_player: "Player added manually: {name} ({tier})",
      after_captain_helpers: "Will be (captain/helpers)",
      all_players_placed: "All players have been placed",
      all_shifts: "All shifts",
      already_assigned_in: "Player is already assigned in",
      apply: "Apply",
      autofill_added_zero: "added 0",
      autofill_all_no_visible_captains: "no visible turrets with a captain",
      autofill_in_turrets: "in turrets",
      available_march: "Available march",
      available_players: "Available players",
      before_captain_helpers: "Was (captain/helpers)",
      board_copied_image: "PNG plan copied to clipboard",
      board_shared: "Plan shared",
      both_ignored_in_shifts: "currently not counted in shifts 1 and 2",
      both_not_counted: "The “Both” group is currently not counted",
      by_word: "for",
      capacity_by_troop: "Capacity by troop type (from captains)",
      captain_not_found: "Captain not found",
      captains_not_selected: "No captains selected",
      captains_word: "captains",
      changes: "Shifts",
      choose_captain_for_turret: "Choose a captain first for",
      choose_exact_nick: "choose the exact nickname from the list",
      clear_shift_1: "Clear shift 1",
      clear_shift_2: "Clear shift 2",
      clear_shift_both: "Clear shift 1 + 2",
      edit_players: "Edit players",
      empty_filter_now: "This filter is empty right now.",
      empty_short: "Empty",
      found_one_choose_enter: "Found 1 — choose from the list / Enter",
      found_player: "Found",
      from_total: "of",
      full: "Full",
      helpers_cleared: "helpers cleared",
      helpers_limit_full: "Helper limit reached",
      helpers_limit_full_simple: "Helper limit reached",
      helpers_short: "helpers",
      hide_data: "Hide data",
      hide_selected_columns: "Hide selected columns",
      limit_exceeded: "Limit exceeded",
      limits_short: "limits",
      link_shown: "Link shown",
      lock_turret: "Lock turret",
      locked_helpers: "Locked helpers",
      moved_to_turrets: "Moved to turrets",
      multiple_matches_choose_exact: "Several found",
      new_captain_in_turret: "New captain to turret",
      new_helper_in_turret: "New helper to turret",
      no_free_players_of_role: "No free players of type",
      no_one_fits_rally_room: "No one fits into the remaining rally space",
      no_players_after_checks: "No matching players remained after checks.",
      no_players_for_tier_limits: "No players fit the march limits by tier.",
      no_preview_data: "No preview data.",
      no_role_for_shift: "No players of this type for shift",
      no_role_for_turret_shift: "No players of this type fit this turret shift",
      not_fit: "Did not fit",
      not_fit_plural: "Did not fit",
      not_in_any_turret: "Not in any turret",
      not_used: "Not used",
      now_in_turrets: "Currently in turrets",
      other_shift: "another shift",
      over_limit: "over limit",
      overall_player_count: "total players",
      overflow_placeholder: "— over limit —",
      partial_short: "partial",
      picked_players: "Selected players",
      pin_action: "Pin",
      place_captain_first: "Place the captain in the turret first",
      player_march_total: "Players march",
      player_or_turret_not_found: "Player or turret not found.",
      player_status_subtitle_both:
        "Here you can see all players from the “Both” group: who is already in turrets, who is outside, and who was manually sent to reserve.",
      players_needed_placed: "Players (needed / placed)",
      players_word: "players",
      png_export_offline:
        "PNG export is unavailable in the offline package without a local html2canvas library.",
      png_saved: "PNG saved",
      popups_suppressed: "popups suppressed",
      preparing_png: "Preparing PNG",
      preparing_share: "Preparing share",
      press_enter_or_choose: "Press Enter or choose from the list",
      preview_single_shift_note: "Only one selected shift is shown.",
      recommended_min_tier: "Recommended minimum tier",
      remove_action: "Remove",
      reserve_and_outside: "Reserve and players outside turrets",
      reserve_manual_hint: "Players manually sent to shift 1/2 reserve",
      reset_both_before_apply: "Reset reserve for both shifts before applying.",
      reset_limits_tiers: "Reset limits (T14–T9 → 0)",
      return_action: "Return",
      role_tier: "Role / Tier",
      saved_turret_table: "Turret table saved",
      selected_captains: "Captains selected",
      sent: "Sent",
      separate_from_main_plan: "separately from the main plan",
      shift1_limit: "Shift 1 limit",
      shift2_limit: "Shift 2 limit",
      shift_mismatch: "Shift mismatch",
      shift_move_hint:
        "The buttons below immediately move the player to the needed shift and recalculate.",
      shift_stats: "Shift stats",
      shortage: "Shortage",
      show_selected_columns: "Show selected columns",
      shown_count: "Shown",
      status_filter: "Status filter",
      take_from_reserve: "Take from reserve",
      tier_summary: "Tier summary",
      total_players_short: "total players",
      troop_mismatch: "Troop type mismatch",
      troop_type_unknown_for: "Could not determine troop type for",
      turret_cleared: "turret cleared",
      turret_locked_not_applied: "Turret is locked — changes were not applied",
      turret_not_found: "Turret not found",
      turret_not_ready_aria: "Turret not ready",
      turret_ready_aria: "Turret ready",
      turret_recalculated_free: "Turret composition recalculated. Free space",
      unlock_turret: "Unlock turret",
      unpin_action: "Unpin",
      updated_player_march: "Updated {name}: march {march}",
      used_march: "Used march",
      used_players: "Used players",
      warnings: "Warnings",
      without_limits: "without limits",
    },
    ru: {
      lang_name: "Русский",
      app_subtitle: "Puzzle & Survival — Планировщик турелей",
      menu: "Меню",
      settings_import: "Настройки / Импорт",
      final_plan: "Финальный план",
      tower_planning: "Распределение по турелям",
      players: "Игроки",
      settings: "Настройки",
      tower_settings: "Настройки турелей",
      player_status: "Статус игроков",
      search: "Поиск",
      search_placeholder: "Поиск по нику / альянсу",
      role: "Роль",
      tier: "Тир",
      shift: "Смена",
      rows: "Строк",
      status: "Статус",
      placement: "Размещение",
      reserve: "Резерв",
      not_assigned: "Не назначен",
      edit: "Редактировать",
      save: "Сохранить",
      remove_from_turret: "Убрать из турели",
      fighter: "Боец",
      rider: "Наездник",
      shooter: "Стрелок",
      unknown: "Неизвестно",
      fighter_plural: "Бойцы",
      rider_plural: "Наездники",
      shooter_plural: "Стрелки",
      helper: "Помощник",
      captain: "Капитан",
      shift1: "Смена 1",
      shift2: "Смена 2",
      both: "Обе",
      all: "Все",
      first_half: "Первая половина",
      second_half: "Вторая половина",
      hub: "Техно-Центр",
      north_turret: "Северная турель",
      west_turret: "Западная турель",
      east_turret: "Восточная турель",
      south_turret: "Южная турель",
      turret: "Турель",
      turrets: "Турели",
      current_shift: "Текущая смена",
      players_in_turret: "Игроков в турели",
      captain_march: "Марш капитана",
      rally_size: "Размер ралли",
      total_sum: "Итого",
      free_space: "Свободно",
      auto_fill: "Автозаполнение",
      auto_clear_helpers: "Очистить помощников",
      clear_turret: "Очистить турель",
      choose_captain: "Выбрать капитана…",
      change_captain: "Сменить капитана…",
      place_captain: "Назначить капитана",
      add_player_manually: "Добавить игрока вручную",
      save_limits: "Сохранить лимиты",
      recalc_composition: "Пересчитать состав",
      reset_limits: "Сбросить лимиты",
      limits_by_tier: "Настройки турели · лимиты по тирам",
      max_players: "Макс. игроков",
      flexible_tier_note:
        "0 = гибкий тир: берёт полный марш, а если места не хватает — делит остаток между игроками этого тира.",
      search_player_from_list: "Поиск игрока (из списка)",
      nickname_custom: "Ник (можно свой, не из списка)",
      nickname: "Ник",
      alliance: "Альянс",
      march: "Марш",
      player: "Игрок",
      ally: "Альянс",
      players_in_turret_title: "Игроки в турели",
      captain_and_players: "Капитан и игроки",
      no_captain: "Без капитана",
      no_assigned_players: "Нет назначенных игроков",
      one_turret_only: "Показать одну турель",
      all_turrets: "Показать все турели",
      only_captains: "Только капитаны",
      respect_player_shift: "Учитывать смену игрока",
      same_troop_only: "Только тот же тип войск",
      use_both: "Использовать «Обе»",
      type_defined_by_captain: "Тип турели определяется капитаном",
      final_plan_share: "Поделиться",
      export_png: "Скачать PNG",
      open_menu: "Открыть меню",
      close_menu: "Закрыть меню",
      settings_title: "Настройки",
      shift_plan: "План смены",
      separate_shift_note:
        "У каждой смены свой план. Автозаполнение не дублирует игроков между ними.",
      player_status_note:
        "Одна таблица с фактическим статусом игрока: в турели, вне турели или в резерве.",
      tower_settings_hint: "Выберите турель слева и настройте её справа.",
      total_players: "Всего игроков",
      captains_ready: "Капитанов готовы",
      reset_filters: "Сбросить фильтры",
      import_label: "Импорт CSV/XLSX/URL",
      show_all_data: "Показать все данные",
      players_panel_lead:
        "Весь состав альянса в одном месте: импортируй список, фильтруй игроков и быстро распределяй их по турелям и сменам.",
      calc_title: "Распределение по турелям",
      calc_subtitle:
        "План на 10 капитанов: распределение игроков по турелям и тирам, чтобы офицерам было проще собирать смены.",
      rebalance: "Применить перераспределение",
      topup_turrets: "Дозаполнить турели",
      clear: "Очистить",
      cancel: "Отмена",
      done: "Готово",
      confirm_action: "Подтвердите действие",
      parameters_limits: "Параметры распределения и лимиты",
      in_turrets: "В турелях",
      outside_turrets: "Вне турелей",
      in_reserve: "В резерве",
      in_turret_status: "В турели",
      outside_turret_status: "Вне турели",
      to_reserve_status: "Резерв",
      restore_from_import: "Восстановить из импорта",
      clear_reserve_s1: "Сбросить резерв С1",
      clear_reserve_s2: "Сбросить резерв С2",
      overall: "Всего",
      ready: "Готово",
      no_captain_short: "Без капитана",
      players_short: "игроков",
      player_choice: "Выбор игрока для турели",
      remove_selected: "Убрать выбранного",
      manual_player_title: "Ручное редактирование или добавление игрока",
      player_nickname: "Ник игрока",
      march_power: "Марш",
      manual_status_hint:
        "Выбери игрока, чтобы изменить марш или тир, или введи нового и сохрани.",
      troop_tier_import: "Тир войск",
      captain_ready_import: "Готовность быть капитаном",
      shift_availability_import: "Доступность по сменам",
      secondary_role_import: "Тип резервных войск",
      secondary_tier_import: "Тир резервных войск",
      troop_200k_import: "Тип резервных войск (200k+)",
      reserve_type_fighter_import: "Резервный тип войск: боец",
      reserve_type_rider_import: "Резервный тип войск: наездник",
      reserve_type_shooter_import: "Резервный тип войск: стрелок",
      custom_column_label: "кастомная",
      extra_column_label: "дополнительная",
      custom_column_name_placeholder: "Название кастомной колонки",
      custom_column_numbered: "Кастомная колонка {n}",
      captain_not_selected: "Капитан ещё не выбран",
      turret_type: "Тип турели",
      turret_type_restricted: "Можно добавлять только помощников этого типа.",
      player_select_placeholder: "— выбери игрока —",
      captain_tag_short: "КАП",
      in_turret_tag: "В ТУРЕЛИ",
      helper_tag_short: "ПОМ",
      tier_march_limits: "Лимиты марша по тирам",
      auto_tier_limits: "автоматически",
      max_helpers: "Макс. помощников",
      final_plan_status: "Финальный план",
      helper_slots: "Мест для помощников",
      turret_capacity: "Вместимость турели",
      used_shortage: "Использовано / нехватка",
      troop_type: "Тип войск",
      lair_level: "Уровень логова",
      yes: "Да",
      no: "Нет",
      manual_save_enter_name: "Ручное сохранение: введи ник игрока",
      manual_save_enter_march: "Ручное сохранение: введи размер марша",
      no_players_assigned_yet: "Игроки ещё не назначены",
      no_final_plan_export: "Нет финального плана для экспорта.",
      no_final_plan_share: "Нет финального плана для отправки.",
      html2canvas_missing: "html2canvas не загрузился.",
      png_failed: "Не удалось создать PNG.",
      calc_window_not_loaded:
        "Окно распределения ещё не загрузилось. Попробуй ещё раз.",
      change_shift_failed: "Не удалось изменить смену игрока.",
      rally_captain_helper_space: "Ралли · Марш капитана · Мест для помощников",
      lang_menu: "Язык",
      status_free: "Свободные",
      status_assigned: "В турели",
      status_captains: "Капитаны",
      player_name: "Ник игрока",
      sort_by_tier: "Сортировать по тиру",
      sort_by_rally: "Сортировать по размеру ралли",
      march_size: "Размер марша",
      bases_title: "5 турелей и техно-центр",
      bases_subtitle:
        "Управляй турелями быстрее: выбирай капитанов, добавляй помощников и веди обе смены без лишней путаницы.",
      settings_moved_notice: "Все главные настройки собраны в первой колонке.",
      hide_others: "Скрыть остальные",
      right_turret: "Турель справа",
      previous_turret: "Предыдущая турель",
      next_turret: "Следующая турель",
      tower_scheme: "Схема турелей",
      captain_empty: "— Капитан не выбран —",
      plan_label: "План",
      auto_label: "Авто",
      helpers_not_assigned: "Помощники ещё не назначены",
      settings_import_subtitle:
        "Загрузи список игроков, проверь колонки и подготовь сайт к распределению по турелям.",
      import_source_title: "1. Откуда взять список игроков",
      import_source_note:
        "Загрузи файл или вставь публичную ссылку на таблицу.",
      import_source_file: "Файл",
      import_upload_title: "Загрузить CSV / Excel",
      import_upload_desc:
        "Поддерживаются CSV, XLSX, XLS и TXT. Это самый быстрый способ добавить таблицу.",
      import_source_link: "Ссылка",
      import_url_title: "Google Sheets / CSV ссылка",
      import_url_desc:
        "Работает с публичным CSV export или открытой CSV-ссылкой из Google Sheets.",
      detect_columns: "Определить колонки",
      load_url: "Загрузить ссылку",
      current_source: "Текущий источник",
      file_not_loaded: "Файл или ссылка ещё не загружены.",
      import_status_title: "Статус импорта",
      import_status_hint:
        "Загрузи источник, проверь колонки и нажми «Применить импорт».",
      apply_import: "Применить импорт",
      required_columns_title: "2. Обязательные колонки",
      required_columns_note:
        "Имя игрока, тип войск, тир, размер марша, размер групповой атаки, альянс, готовность быть капитаном и доступность по сменам.",
      save_template: "Сохранить шаблон",
      save_visible_columns: "Сохранить видимые колонки",
      optional_columns_title: "3. Дополнительные колонки",
      optional_columns_note:
        "Уровень логова, резервный тип войск и любые твои собственные дополнительные поля.",
      visible_columns_title: "4. Какие данные показывать в таблице",
      visible_columns_note:
        "Выбери, какие дополнительные колонки показывать в таблице игроков после нажатия «Показать все данные».",
      reset_data_title: "5. Сброс данных",
      reset_data_note:
        "Осторожно: эти действия очищают сохранённые настройки или данные таблиц.",
      reset_storage: "Полностью очистить LocalStorage",
      reset_column_data: "Сбросить данные колонок",
      reset_table_data: "Сбросить данные таблиц",
      import_footer_note:
        "Поддерживаются CSV/XLSX и публичные CSV-ссылки из Google Sheets.",
      board_subtitle:
        "Вид для офицеров: удобно показать финальный план, сделать скрин или быстро поделиться им.",
      board_language: "Язык плана",
      board_language_picker_note:
        "Отметь языки, которые надо показывать в финальном плане.",
      always_on: "Всегда включено",
      english_only: "Только английский",
      english_plus_local: "Английский ✦ локальный",
      calc_modal_subtitle:
        "Здесь ты собираешь обе смены: распределяешь игроков по турелям, проверяешь резерв и готовишь финальный план.",
      calculate: "Посчитать",
      prepare_limits_for_turrets: "Подготовить лимиты для турелей",
      auto_fill_turrets: "Автоматически заполнить турели",
      mode: "Режим",
      apply_mode: "Применение",
      assisted_mode: "С подсказками",
      auto_mode: "Авто",
      manual_mode: "Вручную",
      topup_only: "Только дозаполнение",
      empty_only: "Только пустые",
      rebalance_all: "Перераспределить всё",
      advanced: "Дополнительно",
      auto_balance_both: "Автобаланс игроков «Обе»",
      min_players_per_turret: "Минимум игроков на турель",
      quantity: "Количество",
      auto_tier_limit: "Авто-лимит тира",
      apply_and_assign_players: "Применить и расставить игроков по турелям",
      tier_march_limit_single: "Лимит марша по тиру (на 1 игрока):",
      sort_by_tier_label: "Сортировать по тиру",
      sort_by_rally_label: "Сортировать по размеру ралли",
      page_word: "Страница",
      shown_word: "показано",
      show_field_name_edit: "Показать редактирование названий",
      hide_field_name_edit: "Скрыть редактирование названий",
      link_copied: "Ссылка скопирована",
      indicated_shift: "Указанная смена",
      choose_turret_left: "Выбери турель слева",
      edit_player_title: "Редактирование игрока",
      player_edit_subtitle: "Изменение данных / удаление из турели",
      where_place_player: "Куда поставить игрока",
      choose_shift_turret_role_or_reserve:
        "Выбери смену, турель и роль для игрока или оставь его в резерве.",
      role_in_turret: "Роль в турели",
      captain_as_role: "капитаном",
      helper_as_role: "помощником",
      roster_edit_hint:
        "Редактирование из списка: марш и ралли обновляются в карточке игрока.",
      captain_tier_limit_note: "Капитан: ограничение по тиру не применяется.",
      choose_turret_for_limit:
        "Выбери турель, чтобы увидеть подсказку по лимиту марша.",
      autofill_limit_for_tier: "Лимит автозаполнения для",
      manual_value_tower_shift_note:
        "(ручное значение можно задать только для этой турели / этой смены).",
      quick_move_player:
        "Можно быстро перенести игрока в другую турель или в другую смену.",
      choose_turret_role_shift_or_reserve:
        "Выбери турель, роль и смену для игрока или оставь его в резерве.",
      roster_edit_apply_selected_shift:
        "Редактирование из списка игроков: изменения применяются к выбранной смене.",
      enter_nick_and_march: "Укажи ник и марш",
      choose_shift_1_or_2: "Выбери смену 1 или смену 2.",
      choose_captain_first: "Выбери капитана",
      select_player_to_remove:
        "Выбери игрока, которого нужно убрать из этой турели",
      selected_player_not_assigned: "Выбранный игрок не назначен в эту турель.",
      choose_player_first: "Сначала выбери игрока",
      apply_section_title: "Применение",
      auto_slots_help:
        "Автослоты = быстрое распределение мест для помощников по турелям по количеству свободных игроков без капитанов.",
      calc_tip_text:
        "Сначала выставь лимиты смен и турелей, затем используй «Применить лимиты» или «Автозаполнение турелей».",
      manual_limit_edit: "Редактировать лимиты вручную",
      remove_captain_aria: "Убрать капитана",
      remove_helper_aria: "Убрать помощника",
      no_players_in_turret_yet: "В этой турели пока нет назначенных игроков.",
      choose_column_placeholder: "— выбери колонку —",
      not_mapped_placeholder: "— не привязано —",
      remove_extra_column: "Удалить дополнительную колонку",
      add_extra_column: "+ Добавить дополнительную колонку",
      helper_in_turret: "Помощник в турели",
      manual_addition_note: "Ручное добавление",
      no_limit: "без ограничений",
      section_word: "Раздел",
      import_template_saved: "Шаблон импорта сохранён.",
      import_template_not_found:
        "Для текущих заголовков не найден подходящий сохранённый шаблон.",
      columns_auto_detected:
        "Колонки определены автоматически. Проверь сопоставление обязательных колонок.",
      visible_columns_saved: "Видимые колонки сохранены.",
      column_data_reset: "Данные колонок сброшены к значениям по умолчанию.",
      table_data_reset:
        "Данные таблиц сброшены. Можно загрузить новую таблицу.",
      import_demo_loaded: "Демо-набор загружен в мастер импорта.",
      restored_previous_session:
        "Игроки восстановлены из предыдущей сессии. В любой момент можно загрузить новую таблицу и заменить их.",
      clear_helpers_both_done:
        "Помощники очищены в сменах 1 и 2. Капитаны остались.",
      clear_helpers_done_prefix: "Помощники очищены:",
      captains_stayed: "Капитаны остались.",
      actions: "Действия",
      add_to_shift1: "Добавить в смену 1",
      add_to_shift2: "Добавить в смену 2",
      added_manual_player: "Игрок добавлен вручную: {name} ({tier})",
      after_captain_helpers: "Станет (капитан/помощники)",
      all_players_placed: "Все игроки размещены",
      all_shifts: "Все смены",
      already_assigned_in: "Игрок уже назначен в",
      apply: "Применить",
      autofill_added_zero: "добавлено 0",
      autofill_all_no_visible_captains: "нет видимых турелей с капитаном",
      autofill_in_turrets: "в турелях",
      available_march: "Доступный марш",
      available_players: "Доступно игроков",
      before_captain_helpers: "Было (капитан/помощники)",
      board_copied_image: "PNG план скопирован в буфер",
      board_shared: "План отправлен",
      both_ignored_in_shifts: "сейчас не учитываются в сменах 1 и 2",
      both_not_counted: "Группа «Обе» сейчас не учитывается",
      by_word: "на",
      capacity_by_troop: "Вместимость по типу войск (от капитанов)",
      captain_not_found: "Капитан не найден",
      captains_not_selected: "Капитаны не выбраны",
      captains_word: "капитанов",
      changes: "Смены",
      choose_captain_for_turret: "Сначала выбери капитана для",
      choose_exact_nick: "выбери точный ник из списка",
      clear_shift_1: "Очистить смену 1",
      clear_shift_2: "Очистить смену 2",
      clear_shift_both: "Очистить смену 1 + 2",
      edit_players: "Редактировать игроков",
      empty_filter_now: "По этому фильтру сейчас пусто.",
      empty_short: "Пусто",
      found_one_choose_enter: "Найден 1 — выбери из списка / Enter",
      found_player: "Найдено",
      from_total: "из",
      full: "Полный",
      helpers_cleared: "очистка помощников",
      helpers_limit_full: "Лимит помощников заполнен",
      helpers_limit_full_simple: "Лимит помощников заполнен",
      helpers_short: "помощники",
      hide_data: "Скрыть данные",
      hide_selected_columns: "Скрыть выбранные колонки",
      limit_exceeded: "Превышен лимит",
      limits_short: "лимиты",
      link_shown: "Ссылка показана",
      lock_turret: "Заблокировать турель",
      locked_helpers: "Закреплённых помощников",
      moved_to_turrets: "Перенесено в турели",
      multiple_matches_choose_exact: "Найдено несколько",
      new_captain_in_turret: "Новый капитан в турель",
      new_helper_in_turret: "Новый помощник в турель",
      no_free_players_of_role: "Нет свободных игроков типа",
      no_one_fits_rally_room: "Никто не помещается в остаток ралли",
      no_players_after_checks: "После проверок подходящих игроков не осталось.",
      no_players_for_tier_limits:
        "Нет игроков, которые подходят под лимиты марша по тиру.",
      no_preview_data: "Нет данных для preview.",
      no_role_for_shift: "Нет игроков этого типа для смены",
      no_role_for_turret_shift:
        "Нет игроков этого типа, которые подходят под смену этой турели",
      not_fit: "Не влез",
      not_fit_plural: "Не влезли",
      not_in_any_turret: "Не стоят ни в одной турели",
      not_used: "Не использовано",
      now_in_turrets: "Сейчас реально стоят в турелях",
      other_shift: "другой смене",
      over_limit: "сверх лимита",
      overall_player_count: "общее количество игроков",
      overflow_placeholder: "— перелимит —",
      partial_short: "частично",
      picked_players: "Отобранные игроки",
      pin_action: "Закрепить",
      place_captain_first: "Сначала поставь капитана в турель",
      player_march_total: "Марш игроков",
      player_or_turret_not_found: "Игрок или турель не найдены.",
      player_status_subtitle_both:
        "Здесь видно всех игроков из группы «Обе»: кто уже стоит в турелях, кто вне турелей, и кто вручную отправлен в резерв.",
      players_needed_placed: "Игроки (нужно / поставлено)",
      players_word: "игроков",
      png_export_offline:
        "PNG export недоступен в offline-пакете без локальной библиотеки html2canvas.",
      png_saved: "PNG сохранён",
      popups_suppressed: "popup-окна приглушены",
      preparing_png: "Готовим PNG",
      preparing_share: "Готовим отправку",
      press_enter_or_choose: "Нажми Enter или выбери из списка",
      preview_single_shift_note: "Показана только одна выбранная смена.",
      recommended_min_tier: "Рекомендуемый минимум по тиру",
      remove_action: "Убрать",
      reserve_and_outside: "Резерв и игроки вне турелей",
      reserve_manual_hint:
        "Игроки, которых вручную отправили в резерв смены 1/2",
      reset_both_before_apply:
        "Сначала сбрось резерв для обеих смен перед применением.",
      reset_limits_tiers: "Сбросить лимиты (T14–T9 → 0)",
      return_action: "Вернуть",
      role_tier: "Роль / Тир",
      saved_turret_table: "Таблица турели сохранена",
      selected_captains: "Выбрано капитанов",
      sent: "Отправлено",
      separate_from_main_plan: "отдельно от основного плана",
      shift1_limit: "Лимит смены 1",
      shift2_limit: "Лимит смены 2",
      shift_mismatch: "Несовпадение смены",
      shift_move_hint:
        "Кнопки ниже сразу переводят игрока в нужную смену и запускают пересчёт.",
      shift_stats: "Статистика смен",
      shortage: "Нехватка",
      show_selected_columns: "Показать выбранные колонки",
      shown_count: "Показано",
      status_filter: "Фильтр статуса",
      take_from_reserve: "Взять из резерва",
      tier_summary: "Сводка по тирам",
      total_players_short: "всего игроков",
      troop_mismatch: "Несовпадение типа войск",
      troop_type_unknown_for: "Не удалось определить тип войск для",
      turret_cleared: "очистка турели",
      turret_locked_not_applied:
        "Турель заблокирована — изменения не применены",
      turret_not_found: "Турель не найдена",
      turret_not_ready_aria: "Турель не готова",
      turret_ready_aria: "Турель готова",
      turret_recalculated_free: "Состав турели пересчитан. Свободное место",
      unlock_turret: "Разблокировать турель",
      unpin_action: "Открепить",
      updated_player_march: "Обновлено {name}: марш {march}",
      used_march: "Использовано марша",
      used_players: "Использовано игроков",
      warnings: "Предупреждения",
      without_limits: "без ограничений",
    },
  };
  function i(e) {
    return r.includes(e) ? e : "uk";
  }
  function s(e, a = "") {
    const r = i(t.locale || document.documentElement.dataset.locale || "uk");
    return (o[r] && o[r][e]) ?? (o.uk && o.uk[e]) ?? a ?? e;
  }
  function l(e) {
    return String(e ?? "")
      .replace(/[“”«»„]/g, '"')
      .replace(/[’]/g, "'")
      .replace(/\s+/g, " ")
      .replace(/\u00a0/g, " ")
      .trim()
      .toLowerCase();
  }
  (Object.assign(o.uk, {
    apply: "Застосувати",
    board_title_shift2: "Зміна 2 / Друга половина",
    board_title_shift1: "Зміна 1 / Перша половина",
    all_shifts: "Усі зміни",
    shift_stats: "Статистика змін",
    shift1_limit: "Ліміт зміни 1",
    shift2_limit: "Ліміт зміни 2",
    add_to_shift1: "Додати в зміну 1",
    add_to_shift2: "Додати в зміну 2",
    reset_both_before_apply:
      "Скинути поточний розподіл в «Обидві» перед застосуванням",
    plan_without_both: "Планувати зміни 1/2 без групи «Обидві»",
    preview_single_shift_note:
      "Показується тільки одна зміна, щоб план був зручнішим для перегляду.",
    overflow_placeholder:
      "Натисни «Порахувати», щоб побачити, хто вже стоїть у турелях, хто в резерві та кого ще треба розподілити.",
    preparing_png: "Готуємо PNG",
    png_saved: "PNG збережено",
    preparing_share: "Готуємо поширення",
    board_shared: "План поширено",
    board_copied_image: "PNG план скопійовано в буфер",
    link_shown: "Посилання показано",
  }),
    Object.assign(o.en, {
      apply: "Apply",
      board_title_shift2: "Shift 2 / Second half",
      board_title_shift1: "Shift 1 / First half",
      all_shifts: "All shifts",
      shift_stats: "Shift statistics",
      shift1_limit: "Shift 1 limit",
      shift2_limit: "Shift 2 limit",
      add_to_shift1: "Add to shift 1",
      add_to_shift2: "Add to shift 2",
      reset_both_before_apply:
        "Reset the current “Both” distribution before applying",
      plan_without_both: "Plan shifts 1/2 without the “Both” group",
      preview_single_shift_note:
        "Only one shift is shown so the plan stays easier to review.",
      overflow_placeholder:
        "Press “Calculate” to see who is already in turrets, who is in reserve, and who still needs to be assigned.",
      preparing_png: "Preparing PNG",
      png_saved: "PNG saved",
      preparing_share: "Preparing share",
      board_shared: "Plan shared",
      board_copied_image: "PNG plan copied to clipboard",
      link_shown: "Link shown",
    }),
    Object.assign(o.ru, {
      apply: "Применить",
      board_title_shift2: "Смена 2 / Вторая половина",
      board_title_shift1: "Смена 1 / Первая половина",
      all_shifts: "Все смены",
      shift_stats: "Статистика смен",
      shift1_limit: "Лимит смены 1",
      shift2_limit: "Лимит смены 2",
      add_to_shift1: "Добавить в смену 1",
      add_to_shift2: "Добавить в смену 2",
      reset_both_before_apply:
        "Сбросить текущее распределение в «Обе» перед применением",
      plan_without_both: "Планировать смены 1/2 без группы «Обе»",
      preview_single_shift_note:
        "Показывается только одна смена, чтобы план было удобнее просматривать.",
      overflow_placeholder:
        "Нажми «Рассчитать», чтобы увидеть, кто уже стоит в турелях, кто в резерве и кого ещё нужно распределить.",
      preparing_png: "Подготавливаем PNG",
      png_saved: "PNG сохранён",
      preparing_share: "Подготавливаем общий доступ",
      board_shared: "План опубликован",
      board_copied_image: "PNG план скопирован в буфер",
      link_shown: "Ссылка показана",
    }),
    Object.assign(o.uk, {
      clear_shift_1: "Очистити зміну 1",
      clear_shift_2: "Очистити зміну 2",
      clear_shift_both: "Очистити зміну 1 + 2",
      total_players_short: "усього гравців",
      separate_from_main_plan: "окремо від основного плану",
      overall_player_count: "загальна кількість гравців",
      over_limit: "понад ліміт",
      by_word: "на",
      from_total: "із",
      shown_count: "Показано",
      status_filter: "Фільтр статусу",
      empty_filter_now: "За цим фільтром зараз порожньо.",
      now_in_turrets: "Зараз реально стоять у турелях",
      not_in_any_turret: "Не стоять у жодній турелі",
      reserve_manual_hint: "Гравці, яких вручну відправили в резерв зміни 1/2",
      role_tier: "Роль / Тір",
      actions: "Дії",
      reset_limits_tiers: "Скинути ліміти (T14–T9 → 0)",
      return_action: "Повернути",
      remove_action: "Прибрати",
      unpin_action: "Відкріпити",
      pin_action: "Закріпити",
      edit_players: "Редагувати гравців",
      take_from_reserve: "Взяти з резерву",
      unlock_turret: "Розблокувати турель",
      lock_turret: "Заблокувати турель",
      without_limits: "без обмежень",
      recommended_min_tier: "Рекомендований мінімум за тіром",
      turret_locked_not_applied: "Турель заблокована — зміни не застосовано",
      locked_helpers: "Закріплених помічників",
      partial_short: "частково",
      all_players_placed: "Усі гравці розмістилися",
      picked_players: "Відібрані гравці",
      sent: "Відправлено",
      full: "Повний",
      captains_not_selected: "Капітанів не вибрано",
      selected_captains: "Обрано капітанів",
      players_needed_placed: "Гравці (потрібно / поставлено)",
      player_march_total: "Марш гравців",
      capacity_by_troop: "Місткість за типом військ (від капітанів)",
      tier_summary: "Підсумок по тірах",
      available_players: "Доступно гравців",
      available_march: "Доступний марш",
      used_players: "Використано гравців",
      used_march: "Використано марш",
      player_status_subtitle_both:
        "Тут видно всіх гравців із групи «Обидві»: хто вже стоїть у турелях, хто поза турелями, і хто вручну відправлений у резерв.",
      both_not_counted: "Група «Обидві» зараз не враховується",
      not_used: "Не використано",
      empty_short: "Порожньо",
      reserve_and_outside: "Резерв і гравці поза турелями",
      both_ignored_in_shifts: "зараз не враховуються в змінах 1 і 2",
      shift_move_hint:
        "Кнопки нижче одразу переводять гравця в потрібну зміну та запускають перерахунок.",
      helpers_short: "помічники",
      limits_short: "ліміти",
      before_captain_helpers: "Було (капітан/помічники)",
      after_captain_helpers: "Стане (капітан/помічники)",
      changes: "Зміни",
      no_preview_data: "Немає даних для перегляду.",
      shortage: "Нестача",
      not_fit: "Не вліз",
      not_fit_plural: "Не влізли",
      warnings: "Попередження",
      moved_to_turrets: "Перенесено у турелі",
      captains_word: "капітанів",
      players_word: "гравців",
      popups_suppressed: "приглушено popup-вікон",
      updated_player_march: "Оновлено {name}: марш {march}",
      added_manual_player: "Додано гравця вручну: {name} ({tier})",
      hide_data: "Сховати дані",
      show_selected_columns: "Показати вибрані колонки",
      hide_selected_columns: "Сховати вибрані колонки",
      clear_base: "Очистити турель",
      captain_option_placeholder: "— капітан —",
      players_placeholder: "Гравці",
      tower_not_found: "Турель не знайдено.",
      share_board_failed: "Не вдалося поширити фінальний план.",
      skipped_turret_locked: "турель заблокована (пропущено)",
      skipped_not_empty: "не порожня (пропущено)",
      already_filled: "вже заповнено",
      calc_no_captains_in_turrets:
        "Калькулятор не знайшов капітанів у турелях. Спочатку постав капітанів у турелях або натисни «Підтягнути капітанів із турелей».",
      calc_no_turrets_for_limits:
        "Не знайдено турелей для застосування лімітів.",
      calc_settings_applied_preview:
        "✅ Налаштування калькулятора застосовано до {count} налаштувань турелей.",
      calc_settings_applied_status:
        "Налаштування калькулятора застосовано до турелей ({count}).",
      captain_not_assigned: "капітан {name} (не призначено)",
      assignment_error: "помилка призначення",
      captain_kept_mode: "капітан залишився (режим {mode})",
      helper_not_assigned_or_limit:
        "помічник {name} (не призначено / перевищено ліміт)",
      shift_limit_already_set: "Для {shift} вже встановлено ліміт {limit}.",
      shift_limit_updated:
        "Оновлено ліміти змін: {shift1} — {limit1}, {shift2} — {limit2}.",
      cleared_shift_by_settings: "Очищено {shift} як у налаштуваннях турелей.",
      restored_from_import_after_clear_counts:
        "Відновлено з імпорту після очищення змін 1 + 2: {shift1} — {count1}, {shift2} — {count2}, {both} — {countBoth}.",
      restored_from_import_after_clear:
        "Відновлено з імпорту після очищення змін 1 + 2.",
      player_moved_to_shift: "Гравця {name} переведено в {shift}.",
      troop_type_not_defined_for_player:
        "Не вдалося визначити тип військ для {name}.",
      place_captain_first_turret:
        "Спочатку постав капітана в турель «{tower}».",
      troop_type_mismatch_for_turret:
        "Тип військ не підходить: {playerRole} не можна поставити в турель типу {turretRole}.",
      player_already_assigned_elsewhere: "Гравець уже призначений у {place}.",
      helper_limit_reached: "Ліміт помічників заповнений: {current}/{max}.",
      limit_exceeded: "Перевищено ліміт: {current} > {limit}.",
      player_in_other_shift: "іншій зміні",
      summary_not_fit: "Не вліз",
      summary_partial: "Частково",
    }),
    Object.assign(o.en, {
      clear_shift_1: "Clear shift 1",
      clear_shift_2: "Clear shift 2",
      clear_shift_both: "Clear shift 1 + 2",
      total_players_short: "total players",
      separate_from_main_plan: "separate from the main plan",
      overall_player_count: "total number of players",
      over_limit: "over limit",
      by_word: "by",
      from_total: "of",
      shown_count: "Showing",
      status_filter: "Status filter",
      empty_filter_now: "Nothing matches this filter right now.",
      now_in_turrets: "Currently assigned to turrets",
      not_in_any_turret: "Not assigned to any turret",
      reserve_manual_hint: "Players manually sent to shift 1/2 reserve",
      role_tier: "Role / Tier",
      actions: "Actions",
      reset_limits_tiers: "Reset limits (T14–T9 → 0)",
      return_action: "Return",
      remove_action: "Remove",
      unpin_action: "Unpin",
      pin_action: "Pin",
      edit_players: "Edit players",
      take_from_reserve: "Take from reserve",
      unlock_turret: "Unlock turret",
      lock_turret: "Lock turret",
      without_limits: "without limits",
      recommended_min_tier: "Recommended minimum by tier",
      turret_locked_not_applied: "Turret is locked — changes were not applied",
      locked_helpers: "Pinned helpers",
      partial_short: "partial",
      all_players_placed: "All players were placed",
      picked_players: "Selected players",
      sent: "Sent",
      full: "Full",
      captains_not_selected: "No captains selected",
      selected_captains: "Selected captains",
      players_needed_placed: "Players (needed / placed)",
      player_march_total: "Player march",
      capacity_by_troop: "Capacity by troop type (from captains)",
      tier_summary: "Tier summary",
      available_players: "Available players",
      available_march: "Available march",
      used_players: "Used players",
      used_march: "Used march",
      player_status_subtitle_both:
        "This view shows all players from the “Both” group: who is already in turrets, who is outside, and who was manually sent to reserve.",
      both_not_counted: "The “Both” group is currently ignored",
      not_used: "Not used",
      empty_short: "Empty",
      reserve_and_outside: "Reserve and players outside turrets",
      both_ignored_in_shifts: "currently ignored in shifts 1 and 2",
      shift_move_hint:
        "The buttons below immediately move a player to the selected shift and recalculate the plan.",
      helpers_short: "helpers",
      limits_short: "limits",
      before_captain_helpers: "Before (captain/helpers)",
      after_captain_helpers: "After (captain/helpers)",
      changes: "Changes",
      no_preview_data: "No preview data yet.",
      shortage: "Shortage",
      not_fit: "Did not fit",
      not_fit_plural: "Did not fit",
      warnings: "Warnings",
      moved_to_turrets: "Moved into turrets",
      captains_word: "captains",
      players_word: "players",
      popups_suppressed: "pop-up alerts suppressed",
      updated_player_march: "Updated {name}: {march} march",
      added_manual_player: "Added manual player: {name} ({tier})",
      hide_data: "Hide data",
      show_selected_columns: "Show selected columns",
      hide_selected_columns: "Hide selected columns",
    }),
    Object.assign(o.ru, {
      clear_shift_1: "Очистить смену 1",
      clear_shift_2: "Очистить смену 2",
      clear_shift_both: "Очистить смену 1 + 2",
      total_players_short: "всего игроков",
      separate_from_main_plan: "отдельно от основного плана",
      overall_player_count: "общее количество игроков",
      over_limit: "сверх лимита",
      by_word: "на",
      from_total: "из",
      shown_count: "Показано",
      status_filter: "Фильтр статуса",
      empty_filter_now: "По этому фильтру сейчас пусто.",
      now_in_turrets: "Сейчас реально стоят в турелях",
      not_in_any_turret: "Не стоят ни в одной турели",
      reserve_manual_hint:
        "Игроки, которых вручную отправили в резерв смены 1/2",
      role_tier: "Роль / Тир",
      actions: "Действия",
      reset_limits_tiers: "Сбросить лимиты (T14–T9 → 0)",
      return_action: "Вернуть",
      remove_action: "Убрать",
      unpin_action: "Открепить",
      pin_action: "Закрепить",
      edit_players: "Редактировать игроков",
      take_from_reserve: "Взять из резерва",
      unlock_turret: "Разблокировать турель",
      lock_turret: "Заблокировать турель",
      without_limits: "без ограничений",
      recommended_min_tier: "Рекомендуемый минимум по тиру",
      turret_locked_not_applied:
        "Турель заблокирована — изменения не применены",
      locked_helpers: "Закреплённых помощников",
      partial_short: "частично",
      all_players_placed: "Все игроки размещены",
      picked_players: "Отобранные игроки",
      sent: "Отправлено",
      full: "Полный",
      captains_not_selected: "Капитаны не выбраны",
      selected_captains: "Выбрано капитанов",
      players_needed_placed: "Игроки (нужно / поставлено)",
      player_march_total: "Марш игроков",
      capacity_by_troop: "Вместимость по типу войск (от капитанов)",
      tier_summary: "Итог по тирам",
      available_players: "Доступно игроков",
      available_march: "Доступный марш",
      used_players: "Использовано игроков",
      used_march: "Использованный марш",
      player_status_subtitle_both:
        "Здесь видны все игроки из группы «Обе»: кто уже стоит в турелях, кто вне турелей и кто вручную отправлен в резерв.",
      both_not_counted: "Группа «Обе» сейчас не учитывается",
      not_used: "Не использован",
      empty_short: "Пусто",
      reserve_and_outside: "Резерв и игроки вне турелей",
      both_ignored_in_shifts: "сейчас не учитываются в сменах 1 и 2",
      shift_move_hint:
        "Кнопки ниже сразу переводят игрока в нужную смену и запускают перерасчёт.",
      helpers_short: "помощники",
      limits_short: "лимиты",
      before_captain_helpers: "Было (капитан/помощники)",
      after_captain_helpers: "Станет (капитан/помощники)",
      changes: "Изменения",
      no_preview_data: "Нет данных для предпросмотра.",
      shortage: "Нехватка",
      not_fit: "Не поместился",
      not_fit_plural: "Не поместились",
      warnings: "Предупреждения",
      moved_to_turrets: "Перенесено в турели",
      captains_word: "капитанов",
      players_word: "игроков",
      popups_suppressed: "приглушено popup-окон",
      updated_player_march: "Обновлено {name}: марш {march}",
      added_manual_player: "Игрок добавлен вручную: {name} ({tier})",
      hide_data: "Скрыть данные",
      show_selected_columns: "Показать выбранные колонки",
      hide_selected_columns: "Скрыть выбранные колонки",
    }));
  const c = new Map();
  function d() {
    return i(t.locale || document.documentElement.dataset.locale || "uk");
  }
  function u(e, t = !1) {
    const a = (function (e) {
      const t = String(e || "").toLowerCase();
      return /(shoot|стрел|стріл|стріле|стрільц|射手|狙)/i.test(t)
        ? "shooter"
        : /(fight|боє|бое|бійц|бойц|пех|піх|步兵|战士)/i.test(t)
          ? "fighter"
          : /(ride|наїз|наезд|骑|騎|기병|ライダー)/i.test(t)
            ? "rider"
            : "unknown";
    })(e);
    return s(t ? `${a}_plural` : a, String(e || ""));
  }
  function p(e) {
    const t = String(e || "").toLowerCase();
    return t.includes("1")
      ? s("shift1")
      : t.includes("2")
        ? s("shift2")
        : /(both|обидв|обе|оба)/.test(t)
          ? s("both")
          : /(all|усі|всі|все)/.test(t)
            ? s("all")
            : String(e || "");
  }
  function h(e) {
    const t = String(e || "");
    return /техно|hub|central/i.test(t)
      ? s("hub")
      : /північ|north|север/i.test(t)
        ? s("north_turret")
        : /захід|west|запад/i.test(t)
          ? s("west_turret")
          : /схід|east|вост/i.test(t)
            ? s("east_turret")
            : /півден|south|юж/i.test(t)
              ? s("south_turret")
              : /turret|турел/i.test(t)
                ? s("turret")
                : t;
  }
  function f(e) {
    const t = String(e ?? "");
    if (!t.trim()) return t;
    const a = (function (e) {
      const t = c.get(l(e));
      return t ? s(t, e) : null;
    })(t);
    if (a) return a;
    let r = t;
    return (
      (r = r.replace(/^shift\s*1$/i, s("shift1"))),
      (r = r.replace(/^shift\s*2$/i, s("shift2"))),
      (r = r.replace(/^shift1$/i, s("shift1"))),
      (r = r.replace(/^shift2$/i, s("shift2"))),
      (r = r.replace(/^both$/i, s("both"))),
      (r = r.replace(/^all$/i, s("all"))),
      (r = r.replace(/^fighter$/i, s("fighter"))),
      (r = r.replace(/^rider$/i, s("rider"))),
      (r = r.replace(/^shooter$/i, s("shooter"))),
      (r = r.replace(/^fighters$/i, s("fighter_plural"))),
      (r = r.replace(/^riders$/i, s("rider_plural"))),
      (r = r.replace(/^shooters$/i, s("shooter_plural"))),
      (r = r.replace(/^helper$/i, s("helper"))),
      (r = r.replace(/^captain$/i, s("captain"))),
      (r = r.replace(/^player$/i, s("player"))),
      (r = r.replace(/^ally$/i, s("ally"))),
      (r = r.replace(/^role$/i, s("role"))),
      (r = r.replace(/^tier$/i, s("tier"))),
      (r = r.replace(/^march$/i, s("march"))),
      (r = r.replace(/^auto-fill$/i, s("auto_fill"))),
      (r = r.replace(/^total\s*Σ?$/i, s("total_sum"))),
      (r = r.replace(/^free space$/i, s("free_space"))),
      (r = r.replace(/^plan\s*\/\s*plan$/i, s("current_shift"))),
      (r = r.replace(/^rider\s*base\s*\(.*\)$/i, s("type_defined_by_captain"))),
      (r = r.replace(
        /^fighter\s*base\s*\(.*\)$/i,
        s("type_defined_by_captain"),
      )),
      (r = r.replace(
        /^shooter\s*base\s*\(.*\)$/i,
        s("type_defined_by_captain"),
      )),
      (r = r.replace(/^rider\s*\/\s*rider$/i, s("rider"))),
      (r = r.replace(/^fighter\s*\/\s*fighter$/i, s("fighter"))),
      (r = r.replace(/^shooter\s*\/\s*shooter$/i, s("shooter"))),
      (r = r.replace(
        /^(1st shift \/ первая половина|зміна 1 \/ перша половина|shift 1 \/ first half)$/i,
        `${s("shift1")} / ${s("first_half")}`,
      )),
      (r = r.replace(
        /^(2nd shift \/ вторая половина|зміна 2 \/ друга половина|shift 2 \/ second half)$/i,
        `${s("shift2")} / ${s("second_half")}`,
      )),
      (r = r.replace(
        /^(План \/ Plan|Current shift|Текущая смена)$/i,
        s("current_shift"),
      )),
      (r = r.replace(
        /^Гравців у турелі:\s*(\d+)$/i,
        `${s("players_in_turret")}: $1`,
      )),
      (r = r.replace(
        /^Players in turret:\s*(\d+)$/i,
        `${s("players_in_turret")}: $1`,
      )),
      (r = r.replace(
        /^Игроков в турели:\s*(\d+)$/i,
        `${s("players_in_turret")}: $1`,
      )),
      (r = r.replace(
        /^Макс\.\s*помічників:\s*(\d+)$/i,
        ("Помічник" === s("helper")
          ? "Макс. помічників"
          : "en" === d()
            ? "Max helpers"
            : "Макс. помощников") + ": $1",
      )),
      (r = r.replace(
        /^Max helpers:\s*(\d+)$/i,
        ("en" === d()
          ? "Max helpers"
          : "ru" === d()
            ? "Макс. помощников"
            : "Макс. помічників") + ": $1",
      )),
      (r = r.replace(
        /^Макс\.\s*помощников:\s*(\d+)$/i,
        ("en" === d()
          ? "Max helpers"
          : "ru" === d()
            ? "Макс. помощников"
            : "Макс. помічників") + ": $1",
      )),
      (r = r.replace(/^Зміна:\s*(.+)$/i, (e, t) => `${s("shift")}: ${p(t)}`)),
      (r = r.replace(/^Shift:\s*(.+)$/i, (e, t) => `${s("shift")}: ${p(t)}`)),
      (r = r.replace(/^Смена:\s*(.+)$/i, (e, t) => `${s("shift")}: ${p(t)}`)),
      (r = r.replace(
        /^Тип турелі:\s*(.+)$/i,
        (e, t) => `${s("turret")}: ${u(t, !0).toLowerCase()}`,
      )),
      (r = r.replace(/^У турелі$/i, s("in_turret_status"))),
      (r = r.replace(/^Outside turret$/i, s("outside_turret_status"))),
      (r = r.replace(/^Поза туреллю$/i, s("outside_turret_status"))),
      (r = r.replace(/^Вне турели$/i, s("outside_turret_status"))),
      (r = r.replace(/^В резерве$/i, s("to_reserve_status"))),
      (r = r.replace(/^У резерві$/i, s("to_reserve_status"))),
      (r = r.replace(/\bFighter\b/g, s("fighter"))),
      (r = r.replace(/\bRider\b/g, s("rider"))),
      (r = r.replace(/\bShooter\b/g, s("shooter"))),
      (r = r.replace(/\bHelper\b/g, s("helper"))),
      (r = r.replace(/Техно-Центр|Tech Hub/gi, s("hub"))),
      (r = r.replace(
        /Повністю скинути LocalStorage\?|Reset LocalStorage completely\?|Полностью сбросить LocalStorage\?/gi,
        s("reset_localstorage_title"),
      )),
      (r = r.replace(
        /Усі збережені дані сайту буде видалено і застосунок повернеться до заводських налаштувань\.|All saved site data will be deleted and the app will return to its default state\.|Все сохранённые данные сайта будут удалены, а приложение вернётся к состоянию по умолчанию\./gi,
        s("reset_localstorage_message"),
      )),
      (r = r.replace(
        /Цю дію не можна скасувати\. Будуть очищені таблиці, колонки, шаблони імпорту, налаштування та інший локально збережений стан\.|This action cannot be undone\. Tables, columns, import templates, settings, and any other locally saved state will be cleared\.|Это действие нельзя отменить\. Будут очищены таблицы, колонки, шаблоны импорта, настройки и другое локально сохранённое состояние\./gi,
        s("reset_localstorage_note"),
      )),
      (r = r.replace(
        /Скинути все|Reset everything|Сбросить всё/gi,
        s("reset_all"),
      )),
      (r = r.replace(/Скасувати|Cancel|Отмена/gi, s("cancel"))),
      (r = r.replace(
        /Північна турель|North Turret|Северная турель/gi,
        s("north_turret"),
      )),
      (r = r.replace(
        /Західна турель|West Turret|Западная турель/gi,
        s("west_turret"),
      )),
      (r = r.replace(
        /Східна турель|East Turret|Восточная турель/gi,
        s("east_turret"),
      )),
      (r = r.replace(
        /Південна турель|South Turret|Южная турель/gi,
        s("south_turret"),
      )),
      (r = r.replace(/^players:\s*(\d+)$/i, `${s("players_short")}: $1`)),
      (r = r.replace(/^(Готова|Ready|Готово)$/i, s("ready"))),
      (r = r.replace(
        /^(Без капітана|No captain|Без капитана)$/i,
        s("no_captain_short"),
      )),
      (r = r.replace(
        /^(Капітан і гравці|Captain and players|Капитан и игроки)$/i,
        s("captain_and_players"),
      )),
      (r = r.replace(
        /^(Немає призначених гравців|No assigned players|Нет назначенных игроков)$/i,
        s("no_assigned_players"),
      )),
      (r = r.replace(
        /^(Ручне редагування або додавання гравця|Manual edit or add player|Ручное редактирование или добавление игрока)$/i,
        s("manual_player_title"),
      )),
      (r = r.replace(
        /^(Нік гравця|Player nickname|Ник игрока)$/i,
        s("player_nickname"),
      )),
      (r = r.replace(
        /^(Сила маршу|March power|Сила марша)$/i,
        s("march_power"),
      )),
      (r = r.replace(
        /^(Прибрати вибраного|Remove selected|Убрать выбранного)$/i,
        s("remove_selected"),
      )),
      (r = r.replace(
        /^(— вибери гравця —|— choose a player —|— выбери игрока —)$/i,
        s("player_select_placeholder"),
      )),
      (r = r.replace(
        /^(Макс\. помічників|Max helpers|Макс\. помощников):\s*(\d+)$/i,
        `${s("max_helpers")}: $2`,
      )),
      (r = r.replace(
        /^(Ліміти маршу за тірами|Tier march limits|Лимиты марша по тирам):\s*(.+)$/i,
        `${s("tier_march_limits")}: $2`,
      )),
      r
    );
  }
  function m(e, t) {
    if (!e || !e.getAttribute) return;
    const a = e.getAttribute(t);
    if (!a) return;
    const r = f(a);
    r && r !== a && e.setAttribute(t, r);
  }
  function y(e = document) {
    const t = e && e.querySelectorAll ? e : document,
      a = document.documentElement;
    ((a.lang = d()), (a.dataset.locale = d()));
    const r = [];
    (t && 1 === t.nodeType && r.push(t),
      t &&
        t.querySelectorAll &&
        t
          .querySelectorAll(
            "[data-i18n],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label],[data-i18n-alt]",
          )
          .forEach((e) => r.push(e)),
      r.forEach((e) => {
        if (!e || !e.getAttribute) return;
        const t = e.getAttribute("data-i18n");
        t &&
          (function (e, t) {
            if (!e) return;
            const a = String(t ?? "");
            if (
              !Array.from(e.childNodes || []).filter(
                (e) => e.nodeType === Node.ELEMENT_NODE,
              ).length
            )
              return void (e.textContent = a);
            const r = Array.from(e.childNodes || []).find(
              (e) =>
                e.nodeType === Node.TEXT_NODE &&
                String(e.textContent || "").trim(),
            );
            r
              ? (r.textContent = a + " ")
              : e.insertBefore(
                  document.createTextNode(a + " "),
                  e.firstChild || null,
                );
          })(e, s(t, e.textContent || ""));
        const a = e.getAttribute("data-i18n-placeholder");
        a &&
          e.setAttribute(
            "placeholder",
            s(a, e.getAttribute("placeholder") || ""),
          );
        const r = e.getAttribute("data-i18n-title");
        r && e.setAttribute("title", s(r, e.getAttribute("title") || ""));
        const n = e.getAttribute("data-i18n-aria-label");
        n &&
          e.setAttribute(
            "aria-label",
            s(n, e.getAttribute("aria-label") || ""),
          );
        const o = e.getAttribute("data-i18n-alt");
        o && e.setAttribute("alt", s(o, e.getAttribute("alt") || ""));
      }),
      t.querySelectorAll("*").forEach((e) => {
        (e.closest && e.closest("script,style")) ||
          (e.closest && e.closest("[data-no-fallback-i18n]")) ||
          (e.hasAttribute("data-i18n-placeholder") || m(e, "placeholder"),
          e.hasAttribute("data-i18n-title") || m(e, "title"),
          e.hasAttribute("data-i18n-aria-label") || m(e, "aria-label"),
          !e.hasAttribute("data-i18n") &&
            ("OPTION" === e.tagName ||
              "BUTTON" === e.tagName ||
              "SPAN" === e.tagName ||
              "DIV" === e.tagName ||
              "P" === e.tagName ||
              "TH" === e.tagName ||
              "TD" === e.tagName ||
              "LABEL" === e.tagName ||
              "H1" === e.tagName ||
              "H2" === e.tagName ||
              "H3" === e.tagName ||
              "H4" === e.tagName ||
              "SMALL" === e.tagName ||
              "STRONG" === e.tagName ||
              "SUMMARY" === e.tagName) &&
            (function (e) {
              if (
                !e ||
                !e.childNodes ||
                1 !== e.childNodes.length ||
                e.childNodes[0].nodeType !== Node.TEXT_NODE
              )
                return;
              const t = e.textContent,
                a = f(t);
              a && a !== t && (e.textContent = a);
            })(e));
      }));
    const n = document.querySelector("title");
    (n && (n.textContent = s("app_subtitle")),
      document.querySelectorAll(".lang-item").forEach((e) => {
        const t = i(e.dataset.lang || "uk"),
          a = e.querySelector(".lang-name");
        (a && (a.textContent = o[t].lang_name),
          e.setAttribute("aria-selected", String(t === d())));
      }));
    const l = document.getElementById("langLabel");
    l && (l.textContent = o[d()].lang_name);
    const c = document.querySelector(".players-panel-lead");
    c && (c.textContent = s("players_panel_lead"));
    const u = document.querySelector(".brand-text .muted");
    (u && (u.textContent = s("app_subtitle")),
      document.dispatchEvent(
        new CustomEvent("pns:i18n-applied", { detail: { locale: d() } }),
      ));
  }
  (Object.entries({
    app_subtitle: [
      "Puzzle & Survival — Планувальник турелей",
      "Puzzle & Survival — Turret Planner",
      "Puzzle & Survival — Планировщик турелей",
    ],
    menu: ["Меню", "Menu"],
    settings_import: [
      "Налаштування / Імпорт",
      "Настройки / Импорт",
      "Setup / Import",
    ],
    final_plan: ["Фінальний план", "Final Plan", "Финальный план"],
    tower_planning: [
      "Розподіл по турелях",
      "Turret Planning",
      "Распределение по турелям",
      "Tower Calculator",
    ],
    players: ["Гравці", "Players", "Игроки"],
    settings_title: [
      "Налаштування / Settings",
      "Налаштування",
      "Settings",
      "Настройки / Settings",
      "Настройки",
    ],
    shift_plan: ["План зміни", "Shift plan", "План смены"],
    one_turret_only: [
      "Показати одну турель",
      "Show one turret",
      "Показать одну турель",
    ],
    all_turrets: [
      "Показати всі турелі",
      "Show all turrets",
      "Показать все турели",
    ],
    tower_settings: [
      "Налаштування турелей",
      "Turret Settings",
      "Настройки турелей",
    ],
    auto_separate_shift_note: [
      "Зміна 1 / Зміна 2 — окремі плани. Автозаповнення не дублює гравців між ними.",
      "Shift 1 / Shift 2 — separate plans. Auto-fill does not duplicate players between them.",
      "Смена 1 / Смена 2 — отдельные планы. Автозаполнение не дублирует игроков между ними.",
    ],
    type_defined_by_captain: [
      "Тип визначається капітаном",
      "Тип турелі визначається капітаном",
      "Type is defined by the captain",
      "Turret type is defined by the captain",
      "Тип определяется капитаном",
      "Тип турели определяется капитаном",
      "Rider base (авто по капітану)",
      "Fighter base (авто по капітану)",
      "Shooter base (авто по капітану)",
    ],
    current_shift: [
      "План / Plan",
      "Поточна зміна",
      "Current shift",
      "Текущая смена",
    ],
    players_in_turret: [
      "Гравців у турелі",
      "Players in turret",
      "Игроков в турели",
    ],
    captain_march: ["Марш капітана", "Captain march", "Марш капитана"],
    rally_size: ["Розмір ралі", "Rally size", "Размер ралли"],
    total_sum: ["Разом", "Total Σ", "Total", "Итого"],
    free_space: ["Вільне місце", "Free space", "Свободно"],
    auto_fill: ["Автозаповнення", "Auto-fill", "Автозаполнение"],
    clear_helpers: [
      "Очистити помічників",
      "Clear helpers",
      "Очистить помощников",
    ],
    clear_turret: ["Очистити турель", "Clear turret", "Очистить турель"],
    player: ["Гравець", "Player", "Игрок"],
    ally: ["Альянс", "Ally", "Альянс"],
    role: ["Роль", "Role", "Роль / Tier"],
    tier: ["Тір", "Tier", "Тир"],
    march: ["Марш", "March", "Марш"],
    only_captains: ["Тільки капітани", "Only captains", "Только капитаны"],
    respect_player_shift: [
      "Враховувати зміну гравця",
      "Match registered shift",
      "Respect player shift",
      "Учитывать смену игрока",
    ],
    same_troop_only: [
      "Лише той самий тип військ",
      "Same troop type only",
      "Only same troop type",
      "Только тот же тип войск",
    ],
    use_both: [
      "Використовувати «Обидві»",
      "Використовувати Both",
      "Use Both",
      "Use “Both”",
      "Использовать «Обе»",
      "Использовать Both",
    ],
    rebalance: [
      "Застосувати перерозподіл",
      "Apply rebalance",
      "Применить перераспределение",
    ],
    topup_turrets: [
      "Дозаповнити турелі",
      "Top up turrets",
      "Дозаполнить турели",
    ],
    clear: ["Очистити", "Clear", "Очистить"],
    parameters_limits: [
      "Параметри розподілу і ліміти",
      "Distribution settings and limits",
      "Параметры распределения и лимиты",
    ],
    player_status: ["Статус гравців", "Player Status", "Статус игроков"],
    player_status_note: [
      "Одна таблиця з фактичним статусом гравця: у турелі, поза туреллю або в резерві.",
      "One table with the actual player status: in a turret, outside a turret, or in reserve.",
      "Одна таблица с фактическим статусом игрока: в турели, вне турели или в резерве.",
    ],
    in_turrets: ["У турелях", "In turrets", "В турелях"],
    outside_turrets: ["Поза турелями", "Outside turrets", "Вне турелей"],
    in_reserve: ["У резерві", "In reserve", "В резерве"],
    restore_from_import: [
      "Відновити з імпорту",
      "Restore from import",
      "Восстановить из импорта",
    ],
    clear_reserve_s1: [
      "Скинути резерв зміни 1",
      "Clear reserve S1",
      "Сбросить резерв С1",
    ],
    clear_reserve_s2: [
      "Скинути резерв зміни 2",
      "Clear reserve S2",
      "Сбросить резерв С2",
    ],
    overall: ["Усього", "Overall", "Всего"],
    export_png: [
      "Експорт PNG",
      "Завантажити PNG",
      "Download PNG",
      "Скачать PNG",
    ],
    final_plan_share: ["Поділитися", "Share", "Поделиться"],
    show_all_data: [
      "Показати всі дані",
      "Show all data",
      "Показать все данные",
    ],
    import_label: [
      "Імпорт CSV/XLSX/URL",
      "Import CSV/XLSX/URL",
      "Импорт CSV/XLSX/URL",
    ],
    total_players: ["Всього гравців", "Total players", "Всего игроков"],
    captains_ready: ["Капітанів готові", "Captains ready", "Капитанов готовы"],
    search: ["Пошук", "Search", "Поиск"],
    rows: ["Рядків", "Rows", "Строк"],
    reset_filters: ["Скинути фільтри", "Reset filters", "Сбросить фильтры"],
    placement: ["Розміщення", "Placement", "Размещение"],
    reserve: ["Резерв", "Reserve", "Резерв"],
    not_assigned: ["Не призначено", "Not assigned", "Не назначено"],
    edit: ["Редагувати", "Edit", "Редактировать"],
    save: ["Зберегти", "Save", "Сохранить"],
    nickname: ["Нік", "Nickname", "Ник"],
    choose_captain: [
      "Вибрати капітана…",
      "Choose a captain…",
      "Выбрать капитана…",
    ],
    change_captain: [
      "Змінити капітана…",
      "Change captain…",
      "Сменить капитана…",
    ],
    place_captain: [
      "Поставити капітана",
      "Assign captain",
      "Назначить капитана",
    ],
    limits_by_tier: [
      "Налаштування турелі · ліміти по тірах (макс. марш)",
      "Налаштування турелі · ліміти по тірах",
      "Turret settings · tier limits",
      "Настройки турели · лимиты по тирам",
    ],
    max_players: ["Макс. гравців", "Max players", "Макс. игроков"],
    max_helpers: ["Макс. помічників", "Max helpers", "Макс. помощников"],
    ready: ["Готова", "Ready", "Готово"],
    done: ["Готово", "Done", "Готово"],
    no_captain_short: ["Без капітана", "No captain", "Без капитана"],
    players_short: ["гравців", "players", "игроков"],
    remove_selected: [
      "Прибрати вибраного",
      "Remove selected",
      "Убрать выбранного",
    ],
    manual_player_title: [
      "Ручне редагування або додавання гравця",
      "Manual edit or add player",
      "Ручное редактирование или добавление игрока",
    ],
    player_nickname: ["Нік гравця", "Player nickname", "Ник игрока"],
    march_power: ["Марш", "March", "Марш"],
    manual_status_hint: [
      "Обери гравця, щоб змінити марш або тір, або введи нового й збережи.",
      "Select a player to change march or tier, or enter a new one and save.",
      "Выбери игрока, чтобы изменить марш или тир, или введи нового и сохрани.",
    ],
    captain_not_selected: [
      "Капітана ще не обрано",
      "Captain is not selected yet",
      "Капитан ещё не выбран",
    ],
    turret_type: ["Тип турелі", "Turret type", "Тип турели"],
    turret_type_restricted: [
      "Можна додавати лише помічників цього типу.",
      "You can add helpers of this type only.",
      "Можно добавлять только помощников этого типа.",
    ],
    player_select_placeholder: [
      "— вибери гравця —",
      "— choose a player —",
      "— выбери игрока —",
    ],
    captain_tag_short: ["КАП", "CAP", "КАП"],
    in_turret_tag: ["У ТУРЕЛІ", "IN TURRET", "В ТУРЕЛИ"],
    helper_tag_short: ["ПОМ", "HELP", "ПОМ"],
    tier_march_limits: [
      "Ліміти маршу за тірами",
      "Tier march limits",
      "Лимиты марша по тирам",
    ],
    auto_tier_limits: ["автоматично", "automatic", "автоматически"],
    save_limits: ["Зберегти ліміти", "Save limits", "Сохранить лимиты"],
    recalc_composition: [
      "Перерахувати склад",
      "Recalculate roster",
      "Пересчитать состав",
    ],
    reset_limits: [
      "Скинути ліміти (T14–T9 → 0)",
      "Скинути ліміти",
      "Reset limits",
      "Сбросить лимиты",
    ],
    flexible_tier_note: [
      "0 = гнучкий тір: бере повний марш, але якщо місця не вистачає — ділить залишок між гравцями цього тіру.",
      "0 = flexible tier: uses full march, and if there is not enough space it shares the remaining space among players of this tier.",
      "0 = гибкий тир: берёт полный марш, а если места не хватает — делит остаток между игроками этого тира.",
    ],
    add_player_manually: [
      "Додати вручну помічника",
      "Додати гравця вручну",
      "Add player manually",
      "Добавить игрока вручную",
    ],
    search_player_from_list: [
      "Пошук гравця (зі списку)",
      "Find player (from roster)",
      "Поиск игрока (из списка)",
    ],
    nickname_custom: [
      "Нік (можна свій, не зі списку)",
      "Nickname (you can enter a custom one)",
      "Ник (можно свой, не из списка)",
    ],
    players_in_turret_title: [
      "Гравці в турелі",
      "Players in turret",
      "Игроки в турели",
    ],
    captain_and_players: [
      "Капітан + гравці",
      "Капітан і гравці",
      "Captain and players",
      "Капитан и игроки",
    ],
    no_captain: ["Без капітана", "No captain", "Без капитана"],
    no_assigned_players: [
      "Немає призначених гравців",
      "No assigned players",
      "Нет назначенных игроков",
    ],
    open_menu: ["Відкрити меню", "Open menu", "Открыть меню"],
    close_menu: ["Закрити меню", "Close menu", "Закрыть меню"],
    players_panel_lead: [
      "Склад альянсу в одному місці: імпортуй список, фільтруй гравців і швидко розподіляй їх по турелях та змінах.",
      "Keep your alliance roster in one place: import the list, filter players, and quickly assign them to turrets and shifts.",
      "Весь состав альянса в одном месте: импортируй список, фильтруй игроков и быстро распределяй их по турелям и сменам.",
    ],
    calc_subtitle: [
      "План на 10 капітанів (5 + 5), розрахунок вміщення гравців по турелях і тірах (капітани не входять у tier-пул)",
      "План на 10 капітанів: розподіл гравців по турелях і тірах, щоб офіцерам було легко зібрати зміни.",
      "Plan for 10 captains: distribute players across turrets and tiers so officers can assemble each shift faster.",
      "План на 10 капитанов: распределение игроков по турелям и тирам, чтобы офицерам было проще собирать смены.",
    ],
  }).forEach(([e, t]) => {
    t.forEach((t) => c.set(l(t), e));
  }),
    Object.assign(o.uk, {
      turret_not_found: "Турель не знайдена",
      player_or_turret_not_found: "Гравця або турель не знайдено.",
      troop_type_unknown_for: "Не вдалося визначити тип військ для",
      shift_mismatch: "Невідповідність зміни",
      place_captain_first: "Спочатку постав капітана в турель",
      troop_mismatch: "Невідповідність типу військ",
      cannot_be_assigned_to: "не може бути призначений у турель типу",
      already_assigned_in: "Гравець уже призначений у",
      other_shift: "іншій зміні",
      helpers_limit_full: "Ліміт помічників заповнений",
      limit_exceeded: "Перевищено ліміт",
      captain_not_found: "Капітана не знайдено",
      choose_captain_for_turret: "Спочатку обери капітана для",
      no_free_players_of_role: "Немає вільних гравців типу",
      no_role_for_shift: "Немає гравців цього типу для зміни",
      no_role_for_turret_shift:
        "Немає гравців цього типу, які підходять під зміну цієї турелі",
      no_players_for_tier_limits:
        "Немає гравців, які підходять під ліміти маршу за тірами.",
      helpers_limit_full_simple: "Ліміт помічників заповнений",
      no_one_fits_rally_room: "Ніхто не вміщується в залишок ралі",
      no_players_after_checks:
        "Після перевірок не знайшлося відповідних гравців.",
      autofill_added_zero: "додано 0",
      autofill_all_no_visible_captains: "немає видимих турелей із капітаном",
      autofill_in_turrets: "у турелях",
      found_player: "Знайдено",
      press_enter_or_choose: "Натисни Enter або вибери зі списку",
      multiple_matches_choose_exact: "Знайдено кілька",
      choose_exact_nick: "вибери точний нік зі списку",
      found_one_choose_enter: "Знайдено 1 — вибери зі списку / Enter",
      saved_turret_table: "Збережено таблицю турелі",
      new_captain_in_turret: "Новий капітан у турель",
      new_helper_in_turret: "Новий помічник у турель",
      helpers_cleared: "очищення помічників",
      turret_cleared: "очищення турелі",
      turret_recalculated_free: "Склад турелі перераховано. Вільне місце",
      turret_ready_aria: "Турель готова",
      turret_not_ready_aria: "Турель не готова",
      png_export_offline:
        "Експорт PNG недоступний в offline-пакеті без локальної бібліотеки html2canvas.",
      helper_in_turret: "Помічник у турелі",
      manual_addition_note: "Ручне додавання",
      no_limit: "без обмежень",
      section_word: "Розділ",
    }),
    Object.assign(o.en, {
      turret_not_found: "Turret not found",
      player_or_turret_not_found: "Player or turret not found.",
      troop_type_unknown_for: "Failed to detect troop type for",
      shift_mismatch: "Shift mismatch",
      place_captain_first: "Assign a captain to the turret first",
      troop_mismatch: "Troop type mismatch",
      cannot_be_assigned_to: "cannot be assigned to a turret of type",
      already_assigned_in: "Player is already assigned in",
      other_shift: "the other shift",
      helpers_limit_full: "Helper limit reached",
      limit_exceeded: "Limit exceeded",
      captain_not_found: "Captain not found",
      choose_captain_for_turret: "Choose a captain first for",
      no_free_players_of_role: "No free players of troop type",
      no_role_for_shift: "No players of this type for shift",
      no_role_for_turret_shift:
        "No players of this type fit the shift of this turret",
      no_players_for_tier_limits: "No players match the march tier limits.",
      helpers_limit_full_simple: "Helper limit reached",
      no_one_fits_rally_room: "No one fits into the remaining rally room",
      no_players_after_checks: "No suitable players remained after all checks.",
      autofill_added_zero: "added 0",
      autofill_all_no_visible_captains: "no visible turrets with a captain",
      autofill_in_turrets: "in turrets",
      found_player: "Found",
      press_enter_or_choose: "Press Enter or choose from the list",
      multiple_matches_choose_exact: "Found multiple matches",
      choose_exact_nick: "choose the exact nickname from the list",
      found_one_choose_enter: "Found 1 — choose from the list / Enter",
      saved_turret_table: "Turret table saved",
      new_captain_in_turret: "New captain in turret",
      new_helper_in_turret: "New helper in turret",
      helpers_cleared: "helpers cleared",
      turret_cleared: "turret cleared",
      turret_recalculated_free: "Turret composition recalculated. Free space",
      turret_ready_aria: "Turret is ready",
      turret_not_ready_aria: "Turret is not ready",
      png_export_offline:
        "PNG export is unavailable in the offline package without a local html2canvas library.",
      helper_in_turret: "Helper in turret",
      manual_addition_note: "Manual addition",
      no_limit: "no limit",
      section_word: "Section",
    }),
    Object.assign(o.ru, {
      turret_not_found: "Турель не найдена",
      player_or_turret_not_found: "Игрок или турель не найдены.",
      troop_type_unknown_for: "Не удалось определить тип войск для",
      shift_mismatch: "Несовпадение смены",
      place_captain_first: "Сначала поставь капитана в турель",
      troop_mismatch: "Несовпадение типа войск",
      cannot_be_assigned_to: "не может быть назначен в турель типа",
      already_assigned_in: "Игрок уже назначен в",
      other_shift: "другой смене",
      helpers_limit_full: "Лимит помощников заполнен",
      limit_exceeded: "Превышен лимит",
      captain_not_found: "Капитан не найден",
      choose_captain_for_turret: "Сначала выбери капитана для",
      no_free_players_of_role: "Нет свободных игроков типа",
      no_role_for_shift: "Нет игроков этого типа для смены",
      no_role_for_turret_shift:
        "Нет игроков этого типа, которые подходят под смену этой турели",
      no_players_for_tier_limits:
        "Нет игроков, которые подходят под лимиты марша по тирам.",
      helpers_limit_full_simple: "Лимит помощников заполнен",
      no_one_fits_rally_room: "Никто не помещается в остаток ралли",
      no_players_after_checks: "После проверок не нашлось подходящих игроков.",
      autofill_added_zero: "добавлено 0",
      autofill_all_no_visible_captains: "нет видимых турелей с капитаном",
      autofill_in_turrets: "в турелях",
      found_player: "Найдено",
      press_enter_or_choose: "Нажми Enter или выбери из списка",
      multiple_matches_choose_exact: "Найдено несколько",
      choose_exact_nick: "выбери точный ник из списка",
      found_one_choose_enter: "Найден 1 — выбери из списка / Enter",
      saved_turret_table: "Таблица турели сохранена",
      new_captain_in_turret: "Новый капитан в турель",
      new_helper_in_turret: "Новый помощник в турель",
      helpers_cleared: "очистка помощников",
      turret_cleared: "очистка турели",
      turret_recalculated_free: "Состав турели пересчитан. Свободное место",
      turret_ready_aria: "Турель готова",
      turret_not_ready_aria: "Турель не готова",
      png_export_offline:
        "Экспорт PNG недоступен в offline-пакете без локальной библиотеки html2canvas.",
      helper_in_turret: "Помощник в турели",
      manual_addition_note: "Ручное добавление",
      no_limit: "без ограничений",
      section_word: "Раздел",
    }));
  let _ = !1;
  function g() {
    const e = document.documentElement;
    (e.classList.remove("i18n-pending"), e.classList.add("i18n-ready"));
  }
  function b(r, n = {}) {
    const o = i(r);
    if (
      ((t.locale = o),
      (document.documentElement.lang = o),
      (document.documentElement.dataset.locale = o),
      !1 !== n.persist)
    )
      try {
        localStorage.setItem(a, o);
      } catch {}
    return (
      n.rerender &&
        (function () {
          try {
            e.renderPlayersTableFromState?.();
          } catch {}
          try {
            e.renderAll?.();
          } catch {}
          try {
            e.updateShiftBreakdownUI?.();
          } catch {}
          try {
            e.towerCalcRefreshStatusPlayersUi?.();
          } catch {}
          try {
            e.refreshBaseCards?.();
          } catch {}
        })(),
      y(document),
      g(),
      document.dispatchEvent(
        new CustomEvent("pns:i18n-changed", { detail: { locale: o } }),
      ),
      o
    );
  }
  (Object.assign(o.uk, {
    choose_file: "Вибрати файл",
    reset_localstorage_title: "Повністю скинути LocalStorage?",
    reset_localstorage_message:
      "Усі збережені дані сайту буде видалено і застосунок повернеться до заводських налаштувань.",
    reset_localstorage_note:
      "Цю дію не можна скасувати. Будуть очищені таблиці, колонки, шаблони імпорту, налаштування та інший локально збережений стан.",
    reset_all: "Скинути все",
    no_file_selected: "Файл не вибрано",
    import_status: "Статус імпорту",
    restored_players_from_storage:
      "Відновлено {count} гравців із LocalStorage.",
    reading_file: "Читаю файл...",
    file_loaded_check_mapping:
      "Файл завантажено. Перевір зіставлення колонок і натисни «Застосувати імпорт».",
    failed_parse_file: "Не вдалося розібрати файл: {error}",
    paste_csv_or_sheet_link_first:
      "Спочатку встав CSV-посилання або посилання Google Sheets.",
    loading_url: "Завантажую посилання...",
    url_loaded_check_mapping:
      "Посилання завантажено. Перевір зіставлення колонок і натисни «Застосувати імпорт».",
    failed_load_url:
      "Не вдалося завантажити посилання. Переконайся, що таблиця публічна і доступний CSV export.",
    load_file_or_link_first: "Спочатку завантаж файл або посилання.",
    import_ready_rows_cols:
      "Готово до імпорту • {rows} рядків • {cols} колонок",
    fill_required_columns: "Заповни обов’язкові колонки: {fields}",
    missing_required_mappings: "Бракує обов’язкових зіставлень: {fields}",
    no_players_after_import:
      "Після імпорту не знайдено жодного гравця. Перевір зіставлення колонок і порожні рядки.",
    imported_players_template_updated:
      "Імпортовано {count} гравців. Шаблон автоматично оновлено у сховищі браузера.",
    import_source_missing_save:
      "Немає що зберігати: спочатку завантаж файл або посилання.",
    load_file_or_link_then_detect:
      "Спочатку завантаж файл або посилання, потім визнач колонки.",
    load_file_or_link_for_template:
      "Спочатку завантаж файл або посилання, щоб застосувати відповідний шаблон.",
    apply_saved_template_exact: "Застосовано збережений шаблон (точний збіг).",
    apply_saved_template_partial:
      "Застосовано збережений шаблон (частковий збіг).",
    upload_file_or_public_link_first:
      "Спочатку завантаж CSV/XLSX файл або встав публічне CSV-посилання Google Sheets.",
    current_source_none: "Файл або посилання ще не завантажено.",
    file_not_loaded_yet:
      "Файл ще не завантажено. Завантаж файл або встав публічне CSV-посилання.",
  }),
    Object.assign(o.en, {
      choose_file: "Choose file",
      reset_localstorage_title: "Reset LocalStorage completely?",
      reset_localstorage_message:
        "All saved site data will be deleted and the app will return to its default state.",
      reset_localstorage_note:
        "This action cannot be undone. Tables, columns, import templates, settings, and any other locally saved state will be cleared.",
      reset_all: "Reset everything",
      no_file_selected: "No file selected",
      import_status: "Import status",
      restored_players_from_storage:
        "Restored {count} players from local storage.",
      reading_file: "Reading file...",
      file_loaded_check_mapping:
        "File loaded. Check the column mapping and click “Apply import”.",
      failed_parse_file: "Could not parse the file: {error}",
      paste_csv_or_sheet_link_first:
        "Paste a CSV link or a Google Sheets link first.",
      loading_url: "Loading link...",
      url_loaded_check_mapping:
        "Link loaded. Check the column mapping and click “Apply import”.",
      failed_load_url:
        "Could not load the link. Make sure the sheet is public and CSV export is available.",
      load_file_or_link_first: "Load a file or link first.",
      import_ready_rows_cols: "Ready to import • {rows} rows • {cols} columns",
      fill_required_columns: "Fill in the required columns: {fields}",
      missing_required_mappings: "Missing required mappings: {fields}",
      no_players_after_import:
        "No players were found after import. Check the column mapping and empty rows.",
      imported_players_template_updated:
        "Imported {count} players. The template was updated automatically in browser storage.",
      import_source_missing_save:
        "Nothing to save yet: load a file or link first.",
      load_file_or_link_then_detect:
        "Load a file or link first, then detect the columns.",
      load_file_or_link_for_template:
        "Load a file or link first to apply a matching template.",
      apply_saved_template_exact: "Saved template applied (exact match).",
      apply_saved_template_partial: "Saved template applied (partial match).",
      upload_file_or_public_link_first:
        "Upload a CSV/XLSX file or paste a public Google Sheets CSV link first.",
      current_source_none: "No file or link has been loaded yet.",
      file_not_loaded_yet:
        "No file has been loaded yet. Upload a file or paste a public CSV link.",
    }),
    Object.assign(o.ru, {
      choose_file: "Выбрать файл",
      reset_localstorage_title: "Полностью сбросить LocalStorage?",
      reset_localstorage_message:
        "Все сохранённые данные сайта будут удалены, а приложение вернётся к состоянию по умолчанию.",
      reset_localstorage_note:
        "Это действие нельзя отменить. Будут очищены таблицы, колонки, шаблоны импорта, настройки и другое локально сохранённое состояние.",
      reset_all: "Сбросить всё",
      no_file_selected: "Файл не выбран",
      import_status: "Статус импорта",
      restored_players_from_storage:
        "Восстановлено {count} игроков из LocalStorage.",
      reading_file: "Читаю файл...",
      file_loaded_check_mapping:
        "Файл загружен. Проверь сопоставление колонок и нажми «Применить импорт».",
      failed_parse_file: "Не удалось разобрать файл: {error}",
      paste_csv_or_sheet_link_first:
        "Сначала вставь CSV-ссылку или ссылку Google Sheets.",
      loading_url: "Загружаю ссылку...",
      url_loaded_check_mapping:
        "Ссылка загружена. Проверь сопоставление колонок и нажми «Применить импорт».",
      failed_load_url:
        "Не удалось загрузить ссылку. Убедись, что таблица публичная и доступен CSV export.",
      load_file_or_link_first: "Сначала загрузи файл или ссылку.",
      import_ready_rows_cols:
        "Готово к импорту • {rows} строк • {cols} колонок",
      fill_required_columns: "Заполни обязательные колонки: {fields}",
      missing_required_mappings:
        "Не хватает обязательных сопоставлений: {fields}",
      no_players_after_import:
        "После импорта не найдено ни одного игрока. Проверь сопоставление колонок и пустые строки.",
      imported_players_template_updated:
        "Импортировано {count} игроков. Шаблон автоматически обновлён в хранилище браузера.",
      import_source_missing_save:
        "Пока нечего сохранять: сначала загрузи файл или ссылку.",
      load_file_or_link_then_detect:
        "Сначала загрузи файл или ссылку, затем определи колонки.",
      load_file_or_link_for_template:
        "Сначала загрузи файл или ссылку, чтобы применить подходящий шаблон.",
      apply_saved_template_exact:
        "Сохранённый шаблон применён (точное совпадение).",
      apply_saved_template_partial:
        "Сохранённый шаблон применён (частичное совпадение).",
      upload_file_or_public_link_first:
        "Сначала загрузи CSV/XLSX файл или вставь публичную CSV-ссылку Google Sheets.",
      current_source_none: "Файл или ссылка ещё не загружены.",
      file_not_loaded_yet:
        "Файл ещё не загружен. Загрузи файл или вставь публичную CSV-ссылку.",
    }));
  try {
    t.locale = i(
      localStorage.getItem(a) ||
        document.documentElement.dataset.locale ||
        "uk",
    );
  } catch {
    t.locale = i(document.documentElement.dataset.locale || "uk");
  }
  ((t.dict = o),
    (t.t = s),
    (t.setLocale = b),
    (t.roleLabel = u),
    (t.shiftLabel = p),
    (t.towerLabel = h),
    (t.translateText = f),
    (t.apply = y),
    (t.observe = function () {
      return ((_ = !0), null);
    }),
    (t.markReady = g),
    (t.getSupportedLocales = n),
    (e.t = s),
    (window.t = s),
    (e.setLocale = b),
    (e.roleLabel = u),
    (e.shiftLabel = p),
    (e.towerLabel = h),
    (e.getSupportedLocales = n),
    document.addEventListener("DOMContentLoaded", function () {
      try {
        t.locale = i(
          localStorage.getItem(a) ||
            document.documentElement.dataset.locale ||
            "uk",
        );
      } catch {
        t.locale = i(document.documentElement.dataset.locale || "uk");
      }
      (y(document), g());
    }));
})(),
  (function () {
    const e = (window.PNS = window.PNS || {});
    e.KEYS = {
      KEY_SHOW_ALL: "pns_layout_show_all_columns",
      KEY_SHIFT_FILTER: "pns_layout_shift_filter",
      KEY_AUTOFILL_SETTINGS: "pns_layout_autofill_settings",
      KEY_IMPORT_TEMPLATES: "pns_layout_import_templates",
      KEY_IMPORT_VISIBLE_COLUMNS: "pns_layout_import_visible_columns",
      KEY_ASSIGNMENTS_STORE: "pns_layout_assignments_store_v3",
      KEY_ASSIGNMENT_PRESETS: "pns_layout_assignment_presets_v1",
      KEY_TOP_FILTERS: "pns_layout_top_filters_v1",
      KEY_FIELD_LABEL_OVERRIDES: "pns_layout_field_label_overrides_v1",
      KEY_BASE_TOWER_RULES: "pns_layout_base_tower_rules_v41",
    };
    const t = (e, t = document) => t.querySelector(e),
      a = (e, t = document) => Array.from(t.querySelectorAll(e));
    ((e.$ = t), (e.$$ = a));
    const r = {
      activeModal: null,
      showAllColumns: !1,
      activeShift: "shift1",
      players: [],
      playerById: new Map(),
      bases: [],
      baseById: new Map(),
      autoFillSettings: null,
      visibleOptionalColumns: [],
      importData: { headers: [], rows: [], mapping: {}, loaded: !1 },
      _baseToolsDelegationBound: !1,
      topFilters: { search: "", role: "all", shift: "all", status: "all" },
      fieldLabelOverrides: {},
      baseTowerRules: {},
    };
    e.state = r;
    const n = { settings: t("#settings-modal"), board: t("#board-modal") },
      o = {
        showAllData: t("#showAllDataBtn"),
        exportPng: t("#exportPngBtn"),
        applyImportMock: t("#applyImportMockBtn"),
        fileInputMock: t("#fileInputMock"),
        urlInputMock: t("#urlInputMock"),
        loadUrlMock: t("#loadUrlMockBtn"),
        detectColumnsMock: t("#detectColumnsMockBtn"),
        saveVisibleColumnsMock: t("#saveVisibleColumnsMockBtn"),
      },
      i = a("[data-shift-tab]"),
      s = {
        requiredMappingContainer: t("#requiredMappingContainer"),
        optionalMappingContainer: t("#optionalMappingContainer"),
        columnVisibilityChecks: t("#columnVisibilityChecks"),
        importLoadedInfo: t("#importLoadedInfo"),
        importStatusInfo: t("#importStatusInfo"),
        playersDataTable: t("#playersDataTable"),
      };
    function l() {
      ((e.modals = {
        settings: t("#settings-modal"),
        board: t("#board-modal"),
      }),
        (e.buttons = {
          ...e.buttons,
          showAllData: t("#showAllDataBtn"),
          exportPng: t("#exportPngBtn"),
          applyImportMock: t("#applyImportMockBtn"),
          fileInputMock: t("#fileInputMock"),
          urlInputMock: t("#urlInputMock"),
          loadUrlMock: t("#loadUrlMockBtn"),
          detectColumnsMock: t("#detectColumnsMockBtn"),
          saveVisibleColumnsMock: t("#saveVisibleColumnsMockBtn"),
        }),
        (e.shiftTabs = a("[data-shift-tab]")),
        (e.controls = {
          ...e.controls,
          requiredMappingContainer: t("#requiredMappingContainer"),
          optionalMappingContainer: t("#optionalMappingContainer"),
          columnVisibilityChecks: t("#columnVisibilityChecks"),
          importLoadedInfo: t("#importLoadedInfo"),
          importStatusInfo: t("#importStatusInfo"),
          playersDataTable: t("#playersDataTable"),
        }));
    }
    function c(e) {
      return String(e ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
    function d() {
      return !0;
    }
    function u(e, t = {}) {
      if (typeof document > "u" || !document.body) {
        try {
          console.warn("[PNS alert]", e);
        } catch {}
        return;
      }
      d();
      const a = document.querySelector(".pns-alert-overlay");
      a && a.remove();
      const r = document.createElement("div");
      ((r.className = "pns-alert-overlay"),
        (r.innerHTML = window.PNS.renderHtmlTemplate("tpl-pns-alert", {
          icon: t.icon || "ℹ️",
          title: c(t.title || "Повідомлення"),
          text: c(String(e ?? "")),
          ok_text: c(t.okText || "OK"),
        })));
      const n = () => {
          try {
            document.removeEventListener("keydown", o, !0);
          } catch {}
          try {
            r.remove();
          } catch {}
          try {
            t.restoreFocus &&
              "function" == typeof t.restoreFocus.focus &&
              t.restoreFocus.focus();
          } catch {}
        },
        o = (e) => {
          ("Escape" === e.key || "Enter" === e.key) &&
            (e.preventDefault(), n());
        };
      (r.addEventListener("click", (e) => {
        e.target === r && n();
      }),
        r.querySelector("[data-pns-alert-ok]")?.addEventListener("click", n),
        document.addEventListener("keydown", o, !0),
        document.body.appendChild(r),
        requestAnimationFrame(() =>
          r.querySelector("[data-pns-alert-ok]")?.focus(),
        ));
    }
    ((e.modals = n),
      (e.buttons = o),
      (e.shiftTabs = i),
      (e.controls = s),
      (e.refreshDomCache = l),
      l(),
      (e.clampInt = function (e, t = 0) {
        const a = Number(e);
        return Number.isFinite(a) ? Math.max(0, Math.round(a)) : t;
      }),
      (e.formatNum = function (e) {
        return Number(e || 0).toLocaleString("en-US");
      }),
      (e.parseNumber = function (e) {
        if (null == e) return 0;
        const t = String(e).replace(/[^\d]/g, "");
        return t ? Number(t) : 0;
      }),
      (e.escapeHtml = c),
      (e.showAlert = u));
    try {
      const t = window.alert?.bind(window);
      window.alert = function (e) {
        u(e, { restoreFocus: document.activeElement || null });
      };
    } catch {}
    e.matchesShift = function (e, t) {
      const a = String(e || "")
        .toLowerCase()
        .trim();
      return "all" === t || "both" === a || a === t;
    };
  })());

(() => {
  if (window.__pnsLangBound) return;
  window.__pnsLangBound = !0;
  const e = "uk",
    t = new Set(["uk", "en", "ru"]);
  function a(a) {
    const r = String(a || "")
      .trim()
      .toLowerCase();
    return t.has(r) ? r : e;
  }
  function r() {
    document.querySelectorAll(".lang.is-open").forEach((e) => {
      e.classList.remove("is-open");
      const t = e.querySelector(".lang-btn");
      t && t.setAttribute("aria-expanded", "false");
    });
  }
  function n() {
    try {
      return a(
        window.PNSI18N?.locale ||
          localStorage.getItem("pns_lang") ||
          document.documentElement.dataset.locale ||
          e,
      );
    } catch {
      return a(document.documentElement.dataset.locale || e);
    }
  }
  function o(e) {
    const t = document.querySelector(".lang");
    if (!t) return;
    const r = a(e),
      n = t.querySelector(`.lang-item[data-lang="${r}"]`);
    if (!n) return;
    const o = n.querySelector(".lang-name")?.textContent?.trim(),
      i = t.querySelector(".lang-label");
    (i && o && (i.textContent = o),
      t
        .querySelectorAll(".lang-item")
        .forEach((e) => e.setAttribute("aria-selected", String(e === n))));
  }
  function i(e, t = {}) {
    const r = a(e);
    if ("function" == typeof window.PNS?.setLocale)
      window.PNS.setLocale(r, {
        persist: !1 !== t.persist,
        rerender: !1 !== t.rerender,
      });
    else {
      try {
        localStorage.setItem("pns_lang", r);
      } catch {}
      ((document.documentElement.lang = r),
        (document.documentElement.dataset.locale = r));
    }
    o(r);
  }
  function s() {
    i(n(), { rerender: !1 });
  }
  (document.addEventListener("click", (e) => {
    const t = e.target.closest(".lang-btn");
    if (!t) return;
    const a = t.closest(".lang");
    if (!a) return;
    (e.preventDefault(), e.stopPropagation());
    const n = !a.classList.contains("is-open");
    (r(),
      a.classList.toggle("is-open", n),
      t.setAttribute("aria-expanded", n ? "true" : "false"));
  }),
    document.addEventListener("click", (t) => {
      const a = t.target.closest(".lang-item");
      a &&
        (t.preventDefault(),
        t.stopPropagation(),
        i(a.dataset.lang || e, { rerender: !0 }),
        r());
    }),
    document.addEventListener("click", (e) => {
      e.target.closest(".lang") || r();
    }),
    document.addEventListener("keydown", (e) => {
      "Escape" === e.key && r();
    }),
    document.addEventListener("pns:i18n-applied", () => o(n())),
    document.addEventListener("pns:i18n-changed", (e) =>
      o(e?.detail?.locale || n()),
    ),
    document.addEventListener("DOMContentLoaded", s),
    "loading" !== document.readyState && s());
})();
(function () {
  function e(e = document) {
    try {
      window.PNSI18N?.apply?.(e);
    } catch {}
  }
  (document.addEventListener("DOMContentLoaded", () => e(document)),
    document.addEventListener("pns:i18n-changed", () => e(document)),
    "loading" !== document.readyState && e(document));
})();
