# Phase 177 — fix збереження required mapping між новими імпортами

Що виправлено:
- `shift_availability` більше не має скидатися в порожнє значення під час нового завантаження файла
- `Detect columns` більше не затирає вже валідне зіставлення порожнім auto-detect значенням
- saved template тепер не викидає поточний валідний mapping, якщо в шаблоні конкретне поле відсутнє

Змінені файли:
- `js/import-source-state.js`
- `js/import-template-presets.js`
