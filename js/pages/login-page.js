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

function providerLabels(user = null) {
  const map = {
    'google.com': 'Google',
    'apple.com': 'Apple ID',
    'password': 'Email'
  };
  const ids = [...new Set((user?.providerData || []).map(item => item.providerId).filter(Boolean))];
  return ids.map(id => map[id] || id).join(' · ');
}

function redirectAfterLogin(profile) {
  window.location.href = isProfileComplete(profile) ? 'profile.html' : 'register.html';
}

function updateSignedUi(user, profile = null) {
  const signed = Boolean(user);
  $('#loginUserCard')?.classList.toggle('is-hidden', !signed);
  $('#accountLinkPanel')?.classList.toggle('is-hidden', !signed);
  $('#loginGoogleBtn')?.toggleAttribute('hidden', signed);
  $('#loginAppleBtn')?.toggleAttribute('hidden', signed);
  $('#loginLogoutBtn')?.toggleAttribute('hidden', !signed);
  $('#goAppBtn')?.toggleAttribute('hidden', !signed);

  const emailForm = $('#emailLoginForm');
  if (emailForm) emailForm.hidden = signed;

  if ($('#goAppBtn') && signed) {
    const goKey = isProfileComplete(profile) ? 'login.goProfile' : 'login.finishRegistration';
    $('#goAppBtn').dataset.i18n = goKey;
    $('#goAppBtn').textContent = t(goKey, isProfileComplete(profile) ? 'Перейти до профілю' : 'Завершити реєстрацію');
  }

  if (!signed) {
    const statusKey = isFirebaseConfigured() ? 'login.signInOrGuestMulti' : 'login.firebaseConfigMissing';
    setStatus(t(statusKey, isFirebaseConfigured()
      ? 'Увійди через Google, Apple ID, Email + пароль або продовжуй як гість.'
      : 'Вхід тимчасово недоступний. Налаштування входу ще не завершене.'),
      isFirebaseConfigured() ? 'muted' : 'warn', statusKey);
    return;
  }

  const game = getGameProfile(profile || {});
  $('#loginAvatar')?.setAttribute('src', user.photoURL || profile?.photoURL || 'img/logo.webp');
  if ($('#loginName')) {
    $('#loginName').removeAttribute('data-i18n');
    $('#loginName').textContent = game.nickname || user.displayName || profile?.displayName || user.email || t('profile.googleUser', 'Користувач');
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
  const code = error?.code || '';
  if (code.includes('auth/email-already-in-use')) return t('login.emailAlreadyUsed', 'Цей email вже використовується. Увійди ним і зв’яжи акаунт у цьому профілі.');
  if (code.includes('auth/wrong-password') || code.includes('auth/invalid-credential')) return t('login.badPassword', 'Неправильний email або пароль.');
  if (code.includes('auth/popup-closed-by-user')) return t('login.popupClosed', 'Вікно входу закрито.');
  if (code.includes('auth/provider-already-linked')) return t('login.providerAlreadyLinked', 'Цей спосіб входу вже підключений.');
  if (code.includes('auth/requires-recent-login')) return t('login.recentLoginRequired', 'Для цієї дії потрібно вийти і зайти ще раз.');
  if (code.includes('auth/blocked-account')) return t('login.blockedAccount', 'Цей акаунт у чорному списку.');
  if (code.includes('auth/operation-not-allowed')) return t('login.providerDisabled', 'Цей спосіб входу ще не включений у Firebase Console.');
  return t('login.signInFailed', 'Не вдалося увійти. Спробуй ще раз або перевір налаштування входу.');
}

async function firebaseOrWarn() {
  if (!isFirebaseConfigured()) {
    setStatus(t('login.configFirst', 'Вхід тимчасово недоступний. Налаштування входу ще не завершене.'), 'warn', 'login.configFirst');
    return null;
  }
  return await getFirebase();
}

async function afterAuthUser(user) {
  const profile = await saveSignedInUser(user);
  if (profile?.blocked) {
    const firebase = await getFirebase();
    await firebase?.authMod?.signOut(firebase.auth);
    updateSignedUi(null);
    throw new Error('auth/blocked-account');
  }
  updateSignedUi(user, profile);
  return profile;
}

async function signInWithProvider(kind = 'google') {
  const firebase = await firebaseOrWarn();
  if (!firebase) return;
  try {
    setStatus(t(kind === 'apple' ? 'login.openingApple' : 'login.openingGoogle', kind === 'apple' ? 'Відкриваю вхід через Apple ID...' : 'Відкриваю вхід через Google...'), 'muted');
    const provider = kind === 'apple'
      ? new firebase.authMod.OAuthProvider('apple.com')
      : new firebase.authMod.GoogleAuthProvider();
    if (kind === 'apple') {
      provider.addScope('email');
      provider.addScope('name');
    }
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
  const email = String($('#loginEmailInput')?.value || '').trim();
  const password = String($('#loginPasswordInput')?.value || '');
  if (!email || !password) return setStatus(t('login.emailPasswordRequired', 'Введи email і пароль.'), 'warn');
  try {
    setStatus(t('login.emailSigningIn', 'Входжу через Email...'), 'muted');
    const result = await firebase.authMod.signInWithEmailAndPassword(firebase.auth, email, password);
    const profile = await afterAuthUser(result.user);
    redirectAfterLogin(profile);
  } catch (error) {
    console.error(error);
    setStatus(friendlyAuthError(error), 'error');
  }
}

async function emailCreate() {
  const firebase = await firebaseOrWarn();
  if (!firebase) return;
  const email = String($('#loginEmailInput')?.value || '').trim();
  const password = String($('#loginPasswordInput')?.value || '');
  if (!email || !password) return setStatus(t('login.emailPasswordRequired', 'Введи email і пароль.'), 'warn');
  try {
    setStatus(t('login.emailCreating', 'Створюю акаунт...'), 'muted');
    const result = await firebase.authMod.createUserWithEmailAndPassword(firebase.auth, email, password);
    const profile = await afterAuthUser(result.user);
    redirectAfterLogin(profile);
  } catch (error) {
    console.error(error);
    setStatus(friendlyAuthError(error), 'error');
  }
}

async function resetPassword() {
  const firebase = await firebaseOrWarn();
  if (!firebase) return;
  const email = String($('#loginEmailInput')?.value || '').trim();
  if (!email) return setStatus(t('login.emailRequiredReset', 'Введи email, щоб отримати лист для скидання пароля.'), 'warn');
  try {
    await firebase.authMod.sendPasswordResetEmail(firebase.auth, email);
    setStatus(t('login.resetSent', 'Лист для скидання пароля відправлено.'), 'success');
  } catch (error) {
    console.error(error);
    setStatus(friendlyAuthError(error), 'error');
  }
}

async function linkProvider(kind = 'google') {
  const firebase = await firebaseOrWarn();
  const user = firebase?.auth?.currentUser;
  if (!firebase || !user) return setStatus(t('login.signInFirstLink', 'Спочатку увійди в акаунт, який хочеш зв’язати.'), 'warn');
  try {
    const provider = kind === 'apple'
      ? new firebase.authMod.OAuthProvider('apple.com')
      : new firebase.authMod.GoogleAuthProvider();
    if (kind === 'apple') {
      provider.addScope('email');
      provider.addScope('name');
    }
    await firebase.authMod.linkWithPopup(user, provider);
    const profile = await afterAuthUser(firebase.auth.currentUser || user);
    updateSignedUi(firebase.auth.currentUser || user, profile);
    setStatus(t('login.linked', 'Спосіб входу підключено до цього профілю.'), 'success');
  } catch (error) {
    console.error(error);
    setStatus(friendlyAuthError(error), 'error');
  }
}

async function linkEmail(event) {
  event?.preventDefault?.();
  const firebase = await firebaseOrWarn();
  const user = firebase?.auth?.currentUser;
  if (!firebase || !user) return setStatus(t('login.signInFirstLink', 'Спочатку увійди в акаунт, який хочеш зв’язати.'), 'warn');
  const email = String($('#linkEmailInput')?.value || '').trim();
  const password = String($('#linkPasswordInput')?.value || '');
  if (!email || !password) return setStatus(t('login.emailPasswordRequired', 'Введи email і пароль.'), 'warn');
  try {
    const credential = firebase.authMod.EmailAuthProvider.credential(email, password);
    await firebase.authMod.linkWithCredential(user, credential);
    const profile = await afterAuthUser(firebase.auth.currentUser || user);
    updateSignedUi(firebase.auth.currentUser || user, profile);
    setStatus(t('login.linked', 'Спосіб входу підключено до цього профілю.'), 'success');
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
  $('#loginGoogleBtn')?.addEventListener('click', () => signInWithProvider('google'));
  $('#loginAppleBtn')?.addEventListener('click', () => signInWithProvider('apple'));
  $('#emailLoginForm')?.addEventListener('submit', emailSignIn);
  $('#emailCreateBtn')?.addEventListener('click', emailCreate);
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
  $('#linkGoogleBtn')?.addEventListener('click', () => linkProvider('google'));
  $('#linkAppleBtn')?.addEventListener('click', () => linkProvider('apple'));
  $('#linkEmailForm')?.addEventListener('submit', linkEmail);

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
