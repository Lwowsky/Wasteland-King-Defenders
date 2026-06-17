import { isFirebaseConfigured, getFirebase, watchAuth } from '../services/firebase-service.js';
import { getGameProfile, isProfileComplete, saveSignedInUser } from '../services/user-db.js';

const $ = selector => document.querySelector(selector);
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);

function setStatus(text, type = 'muted', i18nKey = '') {
  const box = $('#loginStatus');
  if (!box) return;
  box.textContent = text;
  box.dataset.type = type;
  if (i18nKey) box.dataset.i18n = i18nKey;
  else box.removeAttribute('data-i18n');
}

function redirectAfterLogin(profile) {
  window.location.href = isProfileComplete(profile) ? 'profile.html' : 'register.html';
}

function cleanEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function loginKey(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function isEmail(value = '') {
  return /@/.test(String(value || ''));
}

function validLoginName(value = '') {
  const key = loginKey(value);
  return key.length >= 3 && key.length <= 32 && !/[\\/#?\[\]]/.test(key) && !key.includes('@');
}

function activeMode() {
  return $('.auth-mode-btn.is-active')?.dataset.mode || 'login';
}

function setMode(mode = 'login') {
  const next = mode === 'register' ? 'register' : 'login';
  document.body.dataset.authMode = next;
  document.querySelectorAll('.auth-mode-btn').forEach(btn => {
    const active = btn.dataset.mode === next;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  $('#loginForm')?.toggleAttribute('hidden', next !== 'login');
  $('#registerForm')?.toggleAttribute('hidden', next !== 'register');
  const titleKey = next === 'register' ? 'login.registerTitle' : 'login.signInTitle';
  const hintKey = next === 'register' ? 'login.registerHint' : 'login.signInHint';
  const title = $('#authFormTitle');
  const hint = $('#authFormHint');
  if (title) {
    title.dataset.i18n = titleKey;
    title.textContent = t(titleKey, next === 'register' ? 'Створити акаунт' : 'Увійти в акаунт');
  }
  if (hint) {
    hint.dataset.i18n = hintKey;
    hint.textContent = t(hintKey, next === 'register'
      ? 'Вкажи email і пароль двічі. Логін можна додати за бажанням.'
      : 'Введи логін або email і пароль.');
  }
  setStatus(t(next === 'register' ? 'login.registerModeReady' : 'login.signInModeReady', next === 'register'
    ? 'Реєстрація готова.'
    : 'Вхід готовий.'), 'muted', next === 'register' ? 'login.registerModeReady' : 'login.signInModeReady');
}

function providerLabels(user = null) {
  const map = {
    'google.com': 'Google',
    'password': 'Email'
  };
  const ids = [...new Set((user?.providerData || []).map(item => item.providerId).filter(Boolean))];
  return ids.map(id => map[id] || id).join(' · ');
}

function updateSignedUi(user, profile = null) {
  const signed = Boolean(user);
  $('#loginUserCard')?.classList.toggle('is-hidden', !signed);
  $('#signedActions')?.toggleAttribute('hidden', !signed);
  $('#authFormShell')?.toggleAttribute('hidden', signed);

  if ($('#goAppBtn') && signed) {
    const goKey = isProfileComplete(profile) ? 'login.goProfile' : 'login.finishRegistration';
    $('#goAppBtn').dataset.i18n = goKey;
    $('#goAppBtn').textContent = t(goKey, isProfileComplete(profile) ? 'Перейти до профілю' : 'Завершити реєстрацію');
  }

  if (!signed) {
    const statusKey = isFirebaseConfigured() ? (activeMode() === 'register' ? 'login.registerModeReady' : 'login.signInModeReady') : 'login.firebaseConfigMissing';
    setStatus(t(statusKey, isFirebaseConfigured()
      ? (activeMode() === 'register' ? 'Реєстрація готова.' : 'Вхід готовий.')
      : 'Вхід тимчасово недоступний. Налаштування входу ще не завершене.'),
      isFirebaseConfigured() ? 'muted' : 'warn', statusKey);
    return;
  }

  const game = getGameProfile(profile || {});
  $('#loginAvatar')?.setAttribute('src', user.photoURL || profile?.photoURL || 'img/logo.webp');
  if ($('#loginName')) {
    $('#loginName').removeAttribute('data-i18n');
    $('#loginName').textContent = game.nickname || profile?.authLogin || user.displayName || profile?.displayName || user.email || t('profile.googleUser', 'Користувач');
  }
  if ($('#loginEmail')) $('#loginEmail').textContent = user.email || profile?.email || '';
  if ($('#loginProviders')) $('#loginProviders').textContent = providerLabels(user);

  const connectedKey = isProfileComplete(profile) ? 'login.connectedComplete' : 'login.connectedNeedProfile';
  setStatus(t(connectedKey, isProfileComplete(profile)
    ? 'Акаунт підключено. Профіль гравця вже заповнений.'
    : 'Акаунт підключено. Потрібно завершити реєстрацію гравця.'),
    isProfileComplete(profile) ? 'success' : 'warn', connectedKey);
}

function friendlyAuthError(error) {
  const code = error?.code || error?.message || '';
  if (code.includes('auth/email-already-in-use')) return t('login.emailAlreadyUsed', 'Цей email вже використовується. Увійди ним або скинь пароль.');
  if (code.includes('auth/wrong-password') || code.includes('auth/invalid-credential')) return t('login.badPassword', 'Неправильний логін/email або пароль.');
  if (code.includes('auth/popup-closed-by-user')) return t('login.popupClosed', 'Вікно входу закрито.');
  if (code.includes('auth/requires-recent-login')) return t('login.recentLoginRequired', 'Для цієї дії потрібно вийти і зайти ще раз.');
  if (code.includes('auth/blocked-account')) return t('login.blockedAccount', 'Цей акаунт у чорному списку.');
  if (code.includes('auth/operation-not-allowed')) return t('login.providerDisabled', 'Цей спосіб входу ще не включений у Firebase Console.');
  if (code.includes('auth/login-not-found') || code.includes('auth/user-not-found')) return t('login.loginNotFound', 'Логін або email не знайдено.');
  if (code.includes('auth/login-already-used')) return t('login.loginAlreadyUsed', 'Цей логін вже зайнятий.');
  if (code.includes('auth/password-mismatch')) return t('login.passwordMismatch', 'Паролі не збігаються.');
  if (code.includes('auth/weak-password')) return t('login.weakPassword', 'Пароль має містити мінімум 6 символів.');
  if (code.includes('auth/invalid-login')) return t('login.invalidLogin', 'Логін має бути 3–32 символи без / # ? [ ].');
  return t('login.signInFailed', 'Не вдалося увійти. Спробуй ще раз або перевір налаштування входу.');
}

async function firebaseOrWarn() {
  if (!isFirebaseConfigured()) {
    setStatus(t('login.configFirst', 'Вхід тимчасово недоступний. Налаштування входу ще не завершене.'), 'warn', 'login.configFirst');
    return null;
  }
  return await getFirebase();
}

async function setRememberPersistence(firebase, remember = true) {
  if (!firebase?.authMod?.setPersistence) return;
  const persistence = remember ? firebase.authMod.browserLocalPersistence : firebase.authMod.browserSessionPersistence;
  if (!persistence) return;
  await firebase.authMod.setPersistence(firebase.auth, persistence);
}

async function afterAuthUser(user, extraProfilePatch = null) {
  const profile = await saveSignedInUser(user, { forceRefresh: Boolean(extraProfilePatch) });
  if (extraProfilePatch && profile?.uid) {
    const firebase = await getFirebase();
    const ref = firebase.firestoreMod.doc(firebase.db, 'users', profile.uid);
    await firebase.firestoreMod.setDoc(ref, { ...extraProfilePatch, updatedAt: firebase.firestoreMod.serverTimestamp() }, { merge: true }).catch(() => null);
  }
  const freshProfile = extraProfilePatch ? await saveSignedInUser(user, { forceRefresh: true }) : profile;
  if (freshProfile?.blocked) {
    const firebase = await getFirebase();
    await firebase?.authMod?.signOut(firebase.auth);
    updateSignedUi(null);
    throw new Error('auth/blocked-account');
  }
  updateSignedUi(user, freshProfile);
  return freshProfile;
}

async function resolveIdentifier(firebase, identifier = '') {
  const value = String(identifier || '').trim();
  if (!value) throw new Error('auth/email-password-required');
  if (isEmail(value)) return cleanEmail(value);
  const key = loginKey(value);
  if (!validLoginName(key)) throw new Error('auth/invalid-login');
  const ref = firebase.firestoreMod.doc(firebase.db, 'loginAliases', key);
  const snap = await firebase.firestoreMod.getDoc(ref);
  if (!snap.exists()) throw new Error('auth/login-not-found');
  const email = cleanEmail(snap.data()?.email || '');
  if (!email) throw new Error('auth/login-not-found');
  return email;
}

async function signInWithGoogle() {
  const firebase = await firebaseOrWarn();
  if (!firebase) return;
  try {
    setStatus(t('login.openingGoogle', 'Відкриваю Google вхід...'), 'muted', 'login.openingGoogle');
    const provider = new firebase.authMod.GoogleAuthProvider();
    const result = await firebase.authMod.signInWithPopup(firebase.auth, provider);
    const profile = await afterAuthUser(result.user);
    redirectAfterLogin(profile);
  } catch (error) {
    console.error(error);
    setStatus(friendlyAuthError(error), 'error');
  }
}

async function emailSignIn(event) {
  event?.preventDefault?.();
  const firebase = await firebaseOrWarn();
  if (!firebase) return;
  const identifier = String($('#loginIdentifierInput')?.value || '').trim();
  const password = String($('#loginPasswordInput')?.value || '');
  const remember = Boolean($('#rememberMeInput')?.checked);
  if (!identifier || !password) return setStatus(t('login.identifierPasswordRequired', 'Введи логін або email і пароль.'), 'warn');
  try {
    await setRememberPersistence(firebase, remember);
    setStatus(t('login.emailSigningIn', 'Входжу...'), 'muted', 'login.emailSigningIn');
    const email = await resolveIdentifier(firebase, identifier);
    const result = await firebase.authMod.signInWithEmailAndPassword(firebase.auth, email, password);
    const profile = await afterAuthUser(result.user);
    redirectAfterLogin(profile);
  } catch (error) {
    console.error(error);
    setStatus(friendlyAuthError(error), 'error');
  }
}

async function createAccount(event) {
  event?.preventDefault?.();
  const firebase = await firebaseOrWarn();
  if (!firebase) return;
  const login = String($('#registerLoginInput')?.value || '').trim();
  const hasLogin = Boolean(login);
  const key = hasLogin ? loginKey(login) : '';
  const email = cleanEmail($('#registerEmailInput')?.value || '');
  const password = String($('#registerPasswordInput')?.value || '');
  const confirm = String($('#registerPasswordConfirmInput')?.value || '');
  if (hasLogin && !validLoginName(login)) return setStatus(t('login.invalidLogin', 'Логін має бути 3–32 символи без / # ? [ ].'), 'warn');
  if (!email || !password || !confirm) return setStatus(t('login.registerFieldsRequired', 'Введи email і два рази пароль. Логін можна не вказувати.'), 'warn');
  if (password !== confirm) return setStatus(t('login.passwordMismatch', 'Паролі не збігаються.'), 'warn');
  if (password.length < 6) return setStatus(t('login.weakPassword', 'Пароль має містити мінімум 6 символів.'), 'warn');
  try {
    const aliasRef = hasLogin ? firebase.firestoreMod.doc(firebase.db, 'loginAliases', key) : null;
    if (aliasRef) {
      const aliasSnap = await firebase.firestoreMod.getDoc(aliasRef);
      if (aliasSnap.exists()) throw new Error('auth/login-already-used');
    }
    await setRememberPersistence(firebase, true);
    setStatus(t('login.emailCreating', 'Створюю акаунт...'), 'muted', 'login.emailCreating');
    const result = await firebase.authMod.createUserWithEmailAndPassword(firebase.auth, email, password);
    if (hasLogin && firebase.authMod.updateProfile) await firebase.authMod.updateProfile(result.user, { displayName: login }).catch(() => null);
    const userEmail = cleanEmail(result.user?.email || email);
    if (aliasRef) {
      await firebase.firestoreMod.setDoc(aliasRef, {
        uid: result.user.uid,
        email: userEmail,
        login,
        loginKey: key,
        createdAt: firebase.firestoreMod.serverTimestamp(),
        updatedAt: firebase.firestoreMod.serverTimestamp()
      });
    }
    const patch = hasLogin ? { authLogin: login, authLoginKey: key, displayName: login } : null;
    const profile = await afterAuthUser(result.user, patch);
    redirectAfterLogin(profile);
  } catch (error) {
    console.error(error);
    setStatus(friendlyAuthError(error), 'error');
  }
}

async function resetPassword() {
  const firebase = await firebaseOrWarn();
  if (!firebase) return;
  const identifier = String($('#loginIdentifierInput')?.value || '').trim();
  if (!identifier) return setStatus(t('login.identifierRequiredReset', 'Введи логін або email, щоб отримати лист для скидання пароля.'), 'warn');
  try {
    const email = await resolveIdentifier(firebase, identifier);
    await firebase.authMod.sendPasswordResetEmail(firebase.auth, email);
    setStatus(t('login.resetSent', 'Лист для скидання пароля відправлено.'), 'success', 'login.resetSent');
  } catch (error) {
    console.error(error);
    setStatus(friendlyAuthError(error), 'error');
  }
}

async function signOut() {
  const firebase = await getFirebase();
  if (firebase) await firebase.authMod.signOut(firebase.auth);
  updateSignedUi(null);
}

async function initLoginPage() {
  document.querySelectorAll('.auth-mode-btn').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  $('#showRegisterBtn')?.addEventListener('click', () => setMode('register'));
  $('#showLoginBtn')?.addEventListener('click', () => setMode('login'));
  $('#loginGoogleBtn')?.addEventListener('click', signInWithGoogle);
  $('#loginForm')?.addEventListener('submit', emailSignIn);
  $('#registerForm')?.addEventListener('submit', createAccount);
  $('#emailResetBtn')?.addEventListener('click', resetPassword);
  $('#loginLogoutBtn')?.addEventListener('click', signOut);
  $('#guestBtn')?.addEventListener('click', () => { window.location.href = 'index.html'; });
  $('#goAppBtn')?.addEventListener('click', async () => {
    const firebase = await getFirebase();
    const user = firebase?.auth?.currentUser;
    if (!user) return;
    const profile = await saveSignedInUser(user);
    redirectAfterLogin(profile);
  });

  setMode('login');
  await watchAuth(async user => {
    if (!user) {
      updateSignedUi(null);
      return;
    }
    const profile = await saveSignedInUser(user).catch(error => {
      console.error(error);
      setStatus(t('login.databaseDenied', 'Вхід працює, але профіль не вдалося зберегти. Спробуй пізніше.'), 'error', 'login.databaseDenied');
      return null;
    });
    updateSignedUi(user, profile);
  });
}

document.addEventListener('DOMContentLoaded', initLoginPage);
