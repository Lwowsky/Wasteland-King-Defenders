# PHASE 171 — STATIC SMOKE PASS (UA)

Що зроблено:
- перевірено `index.html` на дублікати локальних `<script src>`
- перевірено, що всі локальні скрипти з `index.html` реально існують у пакеті
- прогнано локальний static smoke pass через Node VM з stub DOM
- додано `tools/static_smoke_check.js`, щоб це можна було повторити локально

Результат:
- дубльованих локальних `<script src>` у `index.html` не знайдено
- відсутніх локальних `js/...` не знайдено
- усі 74 локальні скрипти з `index.html` проходять top-level завантаження в static smoke harness

Важливе уточнення:
- це не заміна реального браузерного smoke/regression прогону
- DOM-heavy обробники, які залежать від живої верстки, CDN та реальних подій користувача, треба все одно перевіряти в браузері

Як запускати локально:
```bash
node tools/static_smoke_check.js .
```

Що робити далі:
1. відкрити сайт у браузері
2. пройти import / assignments / tower settings / final plan / export
3. якщо знайдеться баг — робити вже точковий fix-pass, а не новий масовий cleanup
