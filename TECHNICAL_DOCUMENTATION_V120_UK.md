# Wasteland King Defenders — технічна документація v120

Дата аудиту: 2026-06-10

## Що де зберігається

### Firebase / Firestore
Firebase відповідає за акаунти, ролі і приватні дані гравців.

Основні місця:
- `js/config/firebase.config.js` — публічна Firebase Web config для підключення сайту.
- `js/services/firebase-service.js` — ініціалізація Firebase і Auth.
- `js/services/user-db.js` — профіль гравця, ферми, ролі, публічна статистика, повідомлення з fallback.
- `firebase/firestore.rules` — правила доступу Firestore.

Основні колекції Firestore:
- `users/{uid}` — головний профіль, роль, регіон, альянс, ранг, ШК, ферми, налаштування видимості.
- `profileIndex/{lock}` — захист від дубліката ніка/регіону.
- `publicPlayers/{uid}` — публічна статистика без email.
- `regions/{region}/...` — регіональні налаштування, ролі, альянси, заявки, резервний план.

Важливо:
- Email не повинен показуватись у публічній статистиці.
- Правила Firestore мають бути залиті після змін у `firebase/firestore.rules`.
- Firebase `apiKey` у web-config не є секретним ключем, але домени входу треба обмежити у Firebase Console.

### Cloudflare Worker + D1
Cloudflare відповідає за швидкі публічні/регіональні API, короткі посилання, кеш таблиць, фінальний план і журнал дій.

Основні місця:
- `worker.js` — API `/api/*`, короткі маршрути `/f/*`, `/plan/*`, `/rt/*`, Telegram/службові endpoint-и.
- `wrangler.jsonc` — Worker config, assets, D1 binding.
- `cloudflare/d1-region-table-schema.sql` — схема D1.
- `js/services/region-table-cache.js` — читання/публікація кешу таблиці регіону.
- `js/services/region-db.js` — регіональна логіка з D1/Firebase fallback.
- `js/services/notifications-d1.js` — D1-повідомлення.
- `js/services/d1-archive-cleanup.js` — аудит і очистка старих D1-архівів.

Основні таблиці D1:
- `region_tables` — знімки таблиць регіону по циклах.
- `region_active` — активний цикл регіону.
- `region_access` — доступ UID до регіонів.
- `region_table_shares` — секретні посилання на таблицю.
- `public_stats_pages`, `public_stats_meta` — публічна статистика без читань Firestore.
- `action_logs` — журнал дій.
- `user_notifications`, `user_notification_summary`, `user_sent_messages`, `notification_campaigns` — повідомлення.

Важливо:
- D1 тримає кеш і публічні/масові читання, щоб не палити Firestore reads.
- Якщо D1 недоступний, частина коду має Firebase fallback. Це не дубль, а резервний шлях.
- Секрети не писати у код. Для секретів використовувати `wrangler secret put ...` і GitHub Secrets.

### GitHub
GitHub відповідає за код, GitHub Pages і автоматичне оновлення JSON-кешу статистики.

Основні місця:
- `.github/workflows/update-public-stats-cache.yml` — workflow для оновлення `public-cache`.
- `scripts/update-public-stats-cache.mjs` — збір статистики з Firebase/D1 у JSON.
- `scripts/import-public-stats-cache-to-d1.mjs` — імпорт JSON-кешу у D1.
- `public-cache/stats-players.json` і `public-cache/stats-summary.json` — публічний кеш статистики.

GitHub Secrets, які потрібні для workflow:
- `FIREBASE_SERVICE_ACCOUNT`
- `PUBLIC_STATS_EXPORT_SECRET`

### Сторінки
- `index.html` — головна, локальний/регіональний режим, гравці, турелі, фінальний план.
- `login.html`, `register.html`, `profile.html` — вхід і профіль.
- `region-settings.html` — налаштування форми регіону.
- `region-form.html` — заявка гравця на Пустош.
- `region-table.html` — таблиця регіону для керівників.
- `public-region-table.html`, `public-plan.html` — секретні публічні перегляди без входу.
- `stats.html` — публічна статистика.
- `notifications.html` — сповіщення, отримані, надіслані, написати.
- `admin.html` — адмінка, гравці, безпека, архіви.

## Ліміти безкоштовного використання, важливі для цього сайту

Цифри нижче треба перевіряти перед релізом, бо сервіси можуть змінювати правила.

### Firebase Spark / no-cost
- Firestore: 50 000 reads/день.
- Firestore: 20 000 writes/день.
- Firestore: 20 000 deletes/день.
- Firestore storage: 1 GiB.
- Firestore outbound transfer: 10 GiB/місяць.
- Firebase Auth з Identity Platform Spark: Tier 1 DAU 3 000/день.
- Firebase Auth: створення акаунтів 100 акаунтів/годину з одного IP.
- Firebase Hosting, якщо колись використовувати: 10 GB storage і 360 MB/day transfer.

### Cloudflare Free / Workers + D1
- Worker requests: 100 000/день.
- Worker CPU: 10 ms/request.
- Worker subrequests: 50/request.
- Worker memory: 128 MB.
- Worker static asset files per version: 20 000.
- Worker individual static asset file: 25 MiB.
- D1 rows read: 5 000 000/день.
- D1 rows written: 100 000/день.
- D1 storage: 5 GB total on Free pricing page; platform limit also has 500 MB per database on Free.
- Workers Logs: 200 000 log events/day, retention 3 days.

### GitHub Free / Pages / Actions
- GitHub Pages published site: до 1 GB.
- GitHub Pages bandwidth soft limit: 100 GB/month.
- GitHub Pages builds: soft limit 10/hour, якщо не через custom GitHub Actions.
- GitHub Actions для private repo: 2 000 minutes/month, 500 MB artifacts, 10 GB cache.
- GitHub Actions для public repo на standard hosted runners: безкоштовні хвилини.

## Практична оцінка для твого сайту

Поточна архітектура вже добра для 100 регіонів, якщо:
- публічна статистика читається з JSON/D1, а не напряму з Firestore;
- таблиця регіону використовує D1-кеш;
- старі цикли чистяться після 14–30 днів;
- не робити live-listener на всі регіони одразу;
- масові повідомлення робити через campaign/summary, а не створювати 1 документ на кожне відкриття сторінки.

Найшвидше закінчуються не GitHub і не D1, а Firestore reads, якщо багато сторінок читають напряму Firestore. Тому D1/JSON-кеш залишаємо як основний шлях для статистики й публічних таблиць.
