# TECHNICAL DOCUMENTATION v122

## Основна ціль

v122 створена для економії Firebase Firestore reads і посилення приватності email у профілях гравців.

## Змінені файли

```text
js/pages/admin-page.js
js/pages/security-page.js
js/services/user-db.js
js/services/region-db.js
firebase/firestore.rules
admin.html
js/i18n-*.js
```

Також оновлено версії імпортів `user-db.js` і `region-db.js` до `?v=122` у сторінках, які їх використовують.

## Нова функція

```js
listRegisteredUsersPage(options)
```

Параметри:

```js
{
  pageSize: 10,
  cursor: FirestoreDocumentSnapshot | null,
  direction: 'next' | 'prev',
  filters: {
    nick: string,
    alliance: string,
    region: string,
    role: string
  }
}
```

Повертає:

```js
{
  users,
  firstDoc,
  lastDoc,
  hasNext,
  reads,
  pageSize,
  filters,
  queryMode
}
```

## Логіка пагінації

Без фільтрів використовується:

```js
orderBy('createdAt', 'desc')
limit(pageSize + 1)
startAfter(lastDoc)
```

Це дає 10 гравців на сторінку і один додатковий документ для перевірки, чи є наступна сторінка.

## Фільтри

Фільтри намагаються використовувати серверні Firestore `where`:

- `role == ...`
- `regionAccess array-contains region`
- `allianceAccess array-contains region:alliance`
- `alliance == ...`

Якщо Firebase вимагає composite index або query падає, код переходить у safe fallback із курсором і локальним фільтром на обмеженій кількості документів.

## Регіони

`listRegionCatalog()` отримала параметр:

```js
skipPublicPlayers: true
```

Коли він увімкнений, функція не читає всю колекцію `publicPlayers`.

## Security lazy load

`security-page.js` слухає подію:

```js
document.dispatchEvent(new CustomEvent('wkd:security-load'))
```

В адмінці ця подія відправляється тільки при відкритті вкладки **Безпека**.

## Firestore rules

`canReadUser(userId)` тепер:

```js
return isOwner(userId) || canUseAdminPanel();
```

Це означає, що email у `users/{uid}` не має читатись Consul/Officer.

## Перевірка синтаксису

Перевірено:

```bash
find js -name '*.js' -print0 | xargs -0 -n1 node --check
```

Помилок синтаксису JavaScript не знайдено.
