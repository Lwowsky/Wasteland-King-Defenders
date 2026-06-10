# v124 — Admin cache statistics + real usage setup docs

## Зміни

- Додано детальний блок статистики в адмінці з `public-cache/stats-summary.json` і `public-cache/stats-players.json`.
- Блок не робить Firestore `getDocs()` і не витрачає Firestore reads.
- Додано показ: основи, ферми, рядки, регіони, альянси, ранги, ШК тири, ролі, країни, останні реєстрації.
- Оновлено генератор `scripts/update-public-stats-cache.mjs`, щоб майбутній summary мав `roles`, `rolesWithFarms`, `countries`, `countriesWithFarms`.
- Додано документацію для безпечного підключення реальних Firebase/Cloudflare метрик.
- Оновлено переклади для UA, EN, RU, PL, DE, JA, ZH, KO, VI, AR.

## Безпека

- Email не додавався у public-cache.
- `stats-players.json` містить тільки публічні поля.
- API tokens не додавались у frontend.
