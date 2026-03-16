/* ==== import-i18n-utils.js ==== */
/* Import wizard: i18n helpers and field labels */
(function () {
  const e = window.PNS;
  if (!e) return;
  const r = (t, a = "") => ("function" == typeof e.t ? e.t(t, a) : a);
  function n(e, t, a = {}) {
    let n = r(e, t);
    return (
      Object.entries(a || {}).forEach(([e, t]) => {
        n = String(n).replaceAll(`{${e}}`, String(t ?? ""));
      }),
      n
    );
  }
  function o(e, t = "") {
    return (
      {
        player_name: r("player_name", "Нік гравця"),
        focus_troop: r("troop_type", "Тип військ"),
        troop_tier: r("troop_tier_import", "Тір військ"),
        march_size: r("march_size", "Розмір маршу"),
        rally_size: r("rally_size", "Розмір ралі"),
        alliance_alias: r("alliance", "Альянс"),
        captain_ready: r("captain_ready_import", "Готовність бути капітаном"),
        shift_availability: r(
          "shift_availability_import",
          "Доступність по змінах",
        ),
        lair_level: r("lair_level", "Рівень лігва"),
        secondary_role: r("secondary_role_import", "Тип резервних військ"),
        secondary_tier: r("secondary_tier_import", "Тір резервних військ"),
        troop_200k: r("troop_200k_import", "Тип резервних військ (200k+)"),
        notes: r("notes", "Нотатки"),
      }[e] ||
      t ||
      e
    );
  }

  const wiz = (e.ImportWizard = e.ImportWizard || {});
  Object.assign(wiz, {
    translate: r,
    formatMessage: n,
    columnLabel: o,
  });
})();
