# Публічна статистика через Cloudflare D1

Цей режим робить так:

- гравець змінює профіль → сайт дзеркалить публічні дані у Cloudflare D1;
- GitHub Actions 2 рази на день читає готовий snapshot з D1;
- GitHub Actions перезаписує `public-cache/stats-players.json` і `public-cache/stats-summary.json`;
- гості на `stats.html` читають тільки готовий JSON і не їдять Firebase / D1 / Worker.

## 1. Онови D1 таблиці

У папці проєкту виконай:

```bash
npx wrangler d1 execute wasteland-region-tables --remote --file=cloudflare/d1-region-table-schema.sql
```

Це додасть таблиці:

```txt
public_stats_pages
public_stats_meta
```

## 2. Створи секрет для Worker

У терміналі:

```bash
npx wrangler secret put STATS_EXPORT_SECRET
```

Встав довгий секрет, наприклад 32+ символи.

Приклад:

```txt
wkd_stats_дуже_довгий_секрет_2026
```

Збережи цей самий секрет, бо він потрібен ще в GitHub Secrets.

## 3. Задеплой Worker

```bash
npx wrangler deploy
```

## 4. Перевір, що endpoint захищений

Відкрий:

```txt
https://wasteland-king-defenders.vovapotaychuk.workers.dev/api/public-stats/export
```

Якщо секрет увімкнений, має показати:

```json
{"ok":false,"error":"stats_secret_required"}
```

Це правильно.

## 5. Імпортуй поточний `public-cache` у D1 один раз

Це потрібно тільки один раз, щоб D1 отримав ті статистичні дані, які вже є в `public-cache`.

Linux / Git Bash:

```bash
PUBLIC_STATS_IMPORT_URL="https://wasteland-king-defenders.vovapotaychuk.workers.dev/api/public-stats/import" \
PUBLIC_STATS_IMPORT_SECRET="ТУТ_ТВІЙ_СЕКРЕТ" \
npm run stats:import-d1
```

PowerShell:

```powershell
$env:PUBLIC_STATS_IMPORT_URL="https://wasteland-king-defenders.vovapotaychuk.workers.dev/api/public-stats/import"
$env:PUBLIC_STATS_IMPORT_SECRET="ТУТ_ТВІЙ_СЕКРЕТ"
npm run stats:import-d1
```

Після успіху побачиш приблизно:

```txt
Imported public stats to D1: players=..., buckets=...
```

## 6. Додай GitHub Variable

GitHub → Repository → Settings → Secrets and variables → Actions → Variables → New repository variable

Назва:

```txt
PUBLIC_STATS_EXPORT_URL
```

Значення:

```txt
https://wasteland-king-defenders.vovapotaychuk.workers.dev/api/public-stats/export
```

## 7. Додай GitHub Secret

GitHub → Repository → Settings → Secrets and variables → Actions → Secrets → New repository secret

Назва:

```txt
PUBLIC_STATS_EXPORT_SECRET
```

Значення: той самий секрет, який ти вставив у `wrangler secret put STATS_EXPORT_SECRET`.

## 8. Запусти GitHub Actions вручну

GitHub → Actions → Update public stats cache → Run workflow

Після запуску workflow має:

1. прочитати статистику з Cloudflare D1;
2. оновити `public-cache/stats-players.json`;
3. оновити `public-cache/stats-summary.json`;
4. зробити commit у `main`.

## 9. Після цього перевір сайт

Відкрий:

```txt
stats.html
```

Натисни “Оновити кеш”.

## Скільки це їсть

Гість відкрив `stats.html`:

```txt
Firebase: 0
D1: 0
Worker: 0
```

Гравець змінив профіль:

```txt
Worker: 1 request
D1: приблизно 1 row read + 2 rows written
Firebase: як раніше для збереження профілю
```

GitHub Actions оновив JSON 2 рази на день:

```txt
Worker: 2 requests/day
D1: до 64 rows read за запуск, тобто до 128 rows read/day
Firebase: 0
```

Чому до 64: статистика розбита на 64 D1 bucket-сторінки. Це значить, що навіть якщо буде 2000 або 20000 гравців, GitHub Actions читає не кожного гравця окремо, а готові сторінки snapshot.
