/* ==== import-field-defs.js ==== */
/* Import wizard: required/optional field definitions */
(function () {
  const e = window.PNS;
  if (!e) return;
  const wiz = (e.ImportWizard = e.ImportWizard || {});
  const t = (key, fallback = '') => (typeof wiz.translate === 'function' ? wiz.translate(key, fallback) : fallback);
  const label = (fieldKey, fallbackKey, fallbackText) => {
    if (typeof wiz.columnLabel === 'function') return wiz.columnLabel(fieldKey, t(fallbackKey, fallbackText));
    return t(fallbackKey, fallbackText);
  };

  const i = [
      {
        key: "player_name",
        label: label('player_name', 'player_name', 'Нік гравця'),
        required: !0,
        aliases: [
          "player name",
          "name",
          "nickname",
          "nick",
          "имя игрока",
          "имя",
          "імя гравця",
          "імя",
          "player",
        ],
      },
      {
        key: "focus_troop",
        label: label('focus_troop', 'troop_type', 'Тип військ'),
        required: !0,
        aliases: [
          "focus troop",
          "main troop",
          "main role",
          "troop role",
          "what is your focus troop",
          "основной тип войск",
          "главная роль",
          "головна роль",
          "role",
        ],
      },
      {
        key: "troop_tier",
        label: label('troop_tier', 'troop_tier_import', 'Тір військ'),
        required: !0,
        aliases: [
          "troop tier",
          "tier",
          "main tier",
          "главный тир",
          "головний тір",
          "тир",
          "тір",
        ],
      },
      {
        key: "march_size",
        label: label('march_size', 'march_size', 'Розмір маршу'),
        required: !0,
        aliases: [
          "march size",
          "squad size",
          "troop size",
          "размер отряда",
          "розмір твого отряду",
          "march",
        ],
      },
      {
        key: "rally_size",
        label: label('rally_size', 'rally_size', 'Розмір ралі'),
        required: !0,
        colKey: "rally_size",
        aliases: [
          "rally size",
          "group attack",
          "group atk",
          "размер групповой атаки",
          "розмір групової атаки",
          "rally",
        ],
      },
      {
        key: "alliance_alias",
        label: label('alliance_alias', 'alliance', 'Альянс'),
        required: !0,
        colKey: "alliance",
        aliases: ["alliance alias", "alliance", "альянс", "ally", "tag"],
      },
      {
        key: "captain_ready",
        label: label('captain_ready', 'captain_ready_import', 'Готовність бути капітаном'),
        required: !0,
        aliases: [
          "captain",
          "ready to be captain",
          "готов быть капитаном",
          "готовий бути капітаном",
          "captain ready",
        ],
      },
      {
        key: "shift_availability",
        label: label('shift_availability', 'shift_availability_import', 'Доступність по змінах'),
        required: !0,
        aliases: ["shift", "смена", "зміна", "which shift can you join"],
      },
      {
        key: "lair_level",
        label: label('lair_level', 'lair_level', 'Рівень лігва'),
        required: !1,
        colKey: "lair_level",
        visibleDefault: !0,
        aliases: ["lair", "логово", "which lair level can you take"],
      },
      {
        key: "secondary_role",
        label: label('secondary_role', 'secondary_role_import', 'Тип резервних військ'),
        required: !1,
        colKey: "secondary_role",
        visibleDefault: !1,
        aliases: [
          "secondary troop role",
          "secondary role",
          "reserve troop type",
          "reserve troop",
          "дополнительная роль",
          "додаткова роль",
        ],
      },
      {
        key: "secondary_tier",
        label: label('secondary_tier', 'secondary_tier_import', 'Тір резервних військ'),
        required: !1,
        colKey: "secondary_tier",
        visibleDefault: !1,
        aliases: [
          "secondary troop tier",
          "secondary tier",
          "reserve troop tier",
          "дополнительный тир",
          "додатковий тір",
        ],
      },
      {
        key: "troop_200k",
        label: label('troop_200k', 'troop_200k_import', 'Тип резервних військ (200k+)'),
        required: !1,
        colKey: "troop_200k",
        visibleDefault: !1,
        aliases: [
          "200k",
          "at least 200k",
          "provide at least 200k",
          "reserve troop type 200k",
          "200к",
        ],
      },
      {
        key: "notes",
        label: label('notes', 'notes', 'Нотатки'),
        required: !1,
        colKey: "notes",
        visibleDefault: !1,
        aliases: [
          "note",
          "notes",
          "комментарий",
          "коментар",
          "примітка",
          "comment",
        ],
      },
    ],
    s = i.filter((e) => !e.required),
    l = new Set(["lair_level"]),
    c = s.filter((e) => l.has(e.key));

  Object.assign(wiz, {
    REQUIRED_FIELDS: i,
    OPTIONAL_FIELDS: s,
    CUSTOM_VISIBLE_FIELDS: c,
  });
})();
