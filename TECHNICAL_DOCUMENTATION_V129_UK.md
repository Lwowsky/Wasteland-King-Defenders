# Технічна документація v129

## Firebase Usage

Firebase вкладка тепер використовує локальний лічильник `js/services/usage-tracker.js`. Він не є офіційною статистикою Firebase, але не потребує billing/card і не викликає Google Cloud Monitoring API.

Кнопка `Оновити` лише перемальовує локальні дані. Кнопка `Скинути оцінку` очищає локальний денний/місячний bucket у browser localStorage.

## Admin players pagination

`listRegisteredUsersPage()` читає Firestore сторінками по 10 основних користувачів. Ферми беруться з документа основного гравця та не збільшують кількість основних гравців на сторінці.

Виправлено case-sensitive проблему фільтра альянсу: UI більше не перетворює `YYY` у `yyy`, Firestore більше не робить case-sensitive server-filter по alliance, а клієнтський фільтр порівнює альянси case-insensitive.

## Worker

`/api/admin/usage/firebase` видалено. Secrets `GOOGLE_SERVICE_ACCOUNT_JSON` і `GOOGLE_PROJECT_ID` більше не потрібні для сайту. Їх можна видалити з Worker secrets, якщо хочеш.

Cloudflare endpoint `/api/admin/usage/cloudflare` залишився.
