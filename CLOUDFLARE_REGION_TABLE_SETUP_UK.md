# Cloudflare D1 для закритої таблиці регіону

Цей варіант не використовує R2. JSON таблиці зберігається як snapshot у Cloudflare D1, а сайт читає його тільки через Worker.

## Що буде працювати

- Зареєстрований гравець подає заявку на сайті.
- Firebase зберігає заявку як раніше.
- Додатково сайт відправляє рядок у Worker.
- Worker записує/оновлює snapshot таблиці в D1.
- Таблиця регіону читає snapshot тільки при відкритті сторінки або кнопці `Оновити`.
- Відкрита вкладка не робить автоматичних оновлень і не їсть ліміти.
- Секретна ссилка читає snapshot через Worker, а не відкритий public JSON.

---

## 1. Перевір, що Wrangler авторизований

```bash
npx wrangler whoami
```

Якщо показує твій Cloudflare акаунт — добре.

---

## 2. Створи D1 базу

```bash
npx wrangler d1 create wasteland-region-tables
```

Після команди Cloudflare покаже блок приблизно такого виду:

```json
{
  "binding": "DB",
  "database_name": "wasteland-region-tables",
  "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

Скопіюй тільки `database_id`.

---

## 3. Встав database_id у wrangler.jsonc

Відкрий файл:

```txt
wrangler.jsonc
```

Знайди:

```json
"database_id": "PASTE_D1_DATABASE_ID_HERE"
```

Заміни на свій `database_id`.

Binding має залишитись саме такий:

```json
"binding": "REGION_TABLE_DB"
```

---

## 4. Додай свій Firebase UID

У Firebase відкрий:

```txt
Firebase Console → Authentication → Users
```

Скопіюй свій UID.

У `wrangler.jsonc` знайди:

```json
"REGION_TABLE_ADMIN_UIDS": ""
```

Встав свій UID:

```json
"REGION_TABLE_ADMIN_UIDS": "ТУТ_ТВІЙ_FIREBASE_UID"
```

Якщо треба кілька адмінів або консулів, які можуть публікувати snapshot/секретні лінки через D1:

```json
"REGION_TABLE_ADMIN_UIDS": "uid1,uid2,uid3"
```

---

## 5. Створи таблиці D1

```bash
npx wrangler d1 execute wasteland-region-tables --remote --file=cloudflare/d1-region-table-schema.sql
```

У Worker також є автоперевірка таблиць, але краще виконати цю команду один раз вручну.

---

## 6. Задеплой Worker

```bash
npx wrangler deploy
```

Після деплою Wrangler покаже адресу Worker, наприклад:

```txt
https://wasteland-king-defenders.ТВІЙ-АКАУНТ.workers.dev
```

---

## 7. Перевір Worker

Відкрий у браузері:

```txt
https://ТВІЙ-WORKER.workers.dev/api/region-table?region=987
```

Без входу нормально побачити помилку `auth-required`. Це означає, що Worker живий і не віддає таблицю чужим.

---

## 8. Підключи сайт до Worker

Відкрий файл:

```txt
js/config/region-table-cache.config.js
```

Було:

```js
enabled: false,
apiBaseUrl: '',
```

Якщо тестуєш через workers.dev, зроби:

```js
enabled: true,
apiBaseUrl: 'https://wasteland-king-defenders.ТВІЙ-АКАУНТ.workers.dev',
```

Якщо потім зробиш піддомен `api.lwowsky.uk`, тоді:

```js
enabled: true,
apiBaseUrl: 'https://api.lwowsky.uk',
```

---

## 9. Запуш сайт

```bash
git add .
git commit -m "Use Cloudflare D1 for region table snapshots"
git push
```

---

## 10. Як тестити

1. Зайди на сайт під Google.
2. Подай заявку на `region-form.html` для регіону 987.
3. Відкрий `region-table.html?r=987`.
4. Натисни `Оновити` або просто перезавантаж сторінку.
5. Новий гравець має бути в таблиці.
6. Якщо сторінка просто відкрита і нічого не натискати — вона не робить автооновлення і не їсть ліміти.

---

## Що їсть ліміти

### Подання заявки

Одна заявка приблизно:

- 1 Worker request;
- кілька D1 rows written;
- Firebase write як у старій логіці.

### Перегляд таблиці

Один перегляд таблиці приблизно:

- 1 Worker request;
- 1 D1 row read зі snapshot таблиці.

### Відкрита вкладка

Якщо людина просто залишила таблицю відкритою:

- 0 Worker requests;
- 0 D1 reads;
- 0 Firebase reads.

Оновлення буде тільки після перезавантаження сторінки або кнопки `Оновити`.
