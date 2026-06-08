# Резервна Google Form через Apps Script

Цей варіант поки не підключає email консула автоматично. Власником форм буде Google-акаунт, під яким створений Apps Script.

## 1. Створи службовий Google-акаунт

Рекомендовано створити окремий акаунт, наприклад `wasteland.forms@gmail.com`. Не використовуй акаунт випадкового консула як власника, щоб не втратити всі форми.

## 2. Створи Apps Script

1. Відкрий https://script.google.com/
2. Створи новий проєкт.
3. Встав код із файлу `scripts/google-form-web-app.gs` у `Code.gs`.
4. Угорі заміни:

```js
const SCRIPT_SECRET = 'CHANGE_ME_TO_LONG_RANDOM_SECRET';
```

на довгий випадковий секрет.

## 3. Deploy як Web App

1. Deploy → New deployment.
2. Type: Web app.
3. Execute as: Me.
4. Who has access: Anyone with the link.
5. Скопіюй `/exec` URL.

## 4. Налаштуй регіон на сайті

У `region-settings.html` для потрібного регіону:

1. Увімкни “Показувати кнопку Google Form для гравців”.
2. Встав Apps Script Web App URL.
3. Встав той самий секрет, що у `SCRIPT_SECRET`.
4. Натисни “Створити / оновити Google Form”.

Після цього форма і таблиця відповідей створяться в Google Drive власника Apps Script.

## 5. Як оновлюється форма

Якщо ти змінюєш налаштування форми регіону, наприклад мінімальний тір із T10 на T11, натисни “Створити / оновити Google Form”. Apps Script перебудує питання Google Form під поточні налаштування.

## 6. Як закривається форма

Кнопка “Закрити Google Form” закриває форму одразу. Також Apps Script створює таймер і сам закриває форми, якщо `closeAtMs` уже минув.

## 7. Безпека

- Apps Script URL і secret не показуються гравцям.
- У публічний документ регіону зберігається тільки responder link форми.
- Email консула поки не підключається.
- Гравці можуть тільки відкрити Google Form за посиланням.

## 8. Ліміти

Створення або оновлення форми майже не використовує Firebase. Firebase пише тільки налаштування регіону. Відповіді гравців у Google Form не створюють Firebase reads/writes.
