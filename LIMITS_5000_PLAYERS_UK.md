# v124 — Оцінка лімітів для 5000 гравців на день

Це приблизна оцінка. Точні цифри залежать від того, скільки разів гравці оновлюють сторінки, чи входять через Google, чи просто дивляться секретні посилання, і чи працює D1/cache.

## Головні безкоштовні ліміти

### Firebase Firestore Spark
- 50 000 document reads / day.
- 20 000 document writes / day.
- 20 000 document deletes / day.
- 1 GiB storage.
- 10 GiB outbound transfer / month.

### Firebase Auth Spark з Identity Platform
- 3000 Daily Active Users / day для Tier 1 providers.

### Cloudflare Workers Free
- 100 000 Worker requests / day.
- CPU time: 10 ms/request.

### Cloudflare D1 Free
- 5 000 000 rows read / day.
- 100 000 rows written / day.
- 5 GB storage total на account.
- 500 MB maximum database size на одну DB.
- 50 D1 queries per Worker invocation.

## Оцінка по сторінках

### login.html / register.html
- Firebase Auth: рахується тільки якщо користувач реально входить через Google.
- Гість без Google login не є Firebase Auth DAU.

### profile.html
- 1–5 Firestore reads на відкриття профілю.
- 2–8 writes при збереженні профілю/ферм, бо оновлюється users, publicPlayers, statsChanges і можливо регіональні записи.

### admin.html → Гравці
- v123/v124: приблизно 11–100 reads на сторінку, залежно від фільтрів і fallback.
- Не читає всі 5000 users одним разом.

### admin.html → Статистика зверху
- Детальні цифри беруться з `public-cache/stats-summary.json` і `stats-players.json`.
- Firestore reads: 0.
- Витрачається тільки статичний трафік сайту.

### admin.html → Безпека
- Не запускається одразу.
- Reads є тільки коли адмін відкрив вкладку Безпека.

### stats.html
- Має працювати через `public-cache/*.json` або D1/cache.
- Firestore reads: 0, якщо немає fallback на Firebase.

### region-table.html
- Для авторизованих керівників: може читати активний цикл і заявки.
- Краще тримати D1/cache як основний шлях.

### public-region-table.html / rt.html
- Має бути D1/share snapshot.
- Firebase Auth: 0.
- Firestore reads: 0, якщо не включений Firebase fallback.

### public-plan.html / p.html
- Має бути snapshot/cache.
- Firebase Auth: 0.
- Firestore reads: 0, якщо не включений Firebase fallback.

### region-form.html / f.html
- Гість не рахується як Firebase Auth login.
- Якщо форма пише в D1 — Firestore writes: 0.
- Якщо fallback пише у Firebase — 1–3 writes на заявку.

### notifications.html
- D1-first.
- Firebase reads/writes мають бути тільки fallback.

### action-log.html
- Бажано D1-first і пагінація.
- Не читати всі журнали одним разом.

## Якщо 5000 гравців за день

### Найбільший ризик — Firebase Auth
Якщо всі 5000 увійдуть через Google за один день, Spark може не вистачити, бо безкоштовний ліміт — 3000 DAU/day.

### Якщо 5000 гостей відкрили секретну силку
Це не Firebase Auth login. Вони рахуються як Cloudflare Worker requests і D1 rows read, якщо сторінка йде через Worker/D1/cache.

### Якщо 5000 гравців подали форму
Якщо форма пише в D1:
- 5000 Worker requests.
- приблизно 5000–15000 D1 rows written/read, залежно від перевірок дублікатів.
- Це нормально для D1 Free.

Якщо форма пише прямо у Firestore:
- 5000 заявок × 1–3 writes = 5000–15000 writes.
- Це ще може влізти у 20 000 writes/day, але запас невеликий.

### Якщо 5000 гравців дивляться stats.html
Через JSON cache:
- Firestore reads: 0.
- Cloudflare/GitHub статичний трафік: залежить від розміру JSON.

Через Firestore напряму:
- 5000 відвідувань × 5000 publicPlayers = 25 000 000 reads.
- Це не підходить для безкоштовного плану.

## Висновок

Для 5000 гравців у день безкоштовна схема можлива тільки якщо:
- публічні сторінки йдуть через JSON/D1/cache;
- адмінка читає users сторінками;
- секретні посилання не читають Firebase напряму;
- Google login використовують не всі 5000 людей щодня.
