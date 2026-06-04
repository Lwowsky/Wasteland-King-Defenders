Wasteland King Defenders — clean modular start

Головне:
- index.html — головна сторінка.
- login.html — окрема сторінка Google входу.
- partials/header.html — шапка сайту.
- partials/footer.html — футер.
- partials/import-modal.html — модальне вікно імпорту.
- partials/confirm-modal.html — універсальне confirm-вікно.
- css/styles.css — головні змінні, html/body/container і фон.
- css/auth-page.css — сторінка входу.
- js/services/firebase-service.js — Firebase init.
- js/services/user-db.js — збереження користувача у Firestore.
- js/auth-google.js — стан входу в header.
- js/login-page.js — логіка окремої сторінки login.html.
- firebase/firestore.rules — правила безпеки Firestore.
- FIREBASE_SETUP_UK.md — покрокова інструкція підключення.

Google login:
Встав Firebase config у js/config/firebase.config.js.

Важливо:
Через partials сайт потрібно відкривати через локальний сервер або GitHub Pages, не подвійним кліком по index.html.


Google profile flow:
- login.html — Google-вхід.
- register.html — перша реєстрація гравця після Google-входу.
- profile.html — редагування профілю гравця.
- Дані зберігаються у Firestore: users/{uid} і regions/{region}/players/{uid}.
- Роль за замовчуванням: player / Гравець.
- Ролі admin, consul, officer треба ставити вручну в Firestore тільки адміну.
