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

function renderUser(user, profile = null) {
  const signed = Boolean(user);
  $('#loginUserCard')?.classList.toggle('is-hidden', !signed);
  $('#loginGoogleBtn')?.toggleAttribute('hidden', signed);
  $('#loginLogoutBtn')?.toggleAttribute('hidden', !signed);
  $('#goAppBtn')?.toggleAttribute('hidden', !signed);
  if ($('#goAppBtn') && signed) {
    const goKey = isProfileComplete(profile) ? 'login.goProfile' : 'login.finishRegistration';
    $('#goAppBtn').dataset.i18n = goKey;
    $('#goAppBtn').textContent = t(goKey, isProfileComplete(profile) ? 'Перейти до профілю' : 'Завершити реєстрацію');
  }

  if (!signed) {
    if ($('#loginName')) $('#loginName').dataset.i18n = 'profile.googleUser';
    if ($('#goAppBtn')) $('#goAppBtn').dataset.i18n = 'login.goSite';
    const statusKey = isFirebaseConfigured() ? 'login.signInOrGuest' : 'login.firebaseConfigMissing';
    setStatus(t(statusKey, isFirebaseConfigured()
      ? 'Увійди через Google або продовжуй як гість.'
      : 'Вхід тимчасово недоступний. Налаштування входу ще не завершене.'),
      isFirebaseConfigured() ? 'muted' : 'warn', statusKey);
    return;
  }

  const game = getGameProfile(profile || {});
  $('#loginAvatar')?.setAttribute('src', user.photoURL || 'img/logo.webp');
  if ($('#loginName')) {
    $('#loginName').removeAttribute('data-i18n');
    $('#loginName').textContent = game.nickname || user.displayName || user.email || t('profile.googleUser', 'Користувач Google');
  }
  if ($('#loginEmail')) $('#loginEmail').textContent = user.email || '';

  const connectedKey = isProfileComplete(profile) ? 'login.connectedComplete' : 'login.connectedNeedProfile';
  setStatus(t(connectedKey, isProfileComplete(profile)
    ? 'Акаунт підключено. Профіль гравця вже заповнений.'
    : 'Акаунт підключено. Потрібно завершити реєстрацію гравця.'),
    isProfileComplete(profile) ? 'success' : 'warn', connectedKey);
}

function redirectAfterLogin(profile) {
  window.location.href = isProfileComplete(profile) ? 'profile.html' : 'register.html';
}

async function signInGoogle() {
  if (!isFirebaseConfigured()) {
    setStatus(t('login.configFirst', 'Вхід тимчасово недоступний. Налаштування входу ще не завершене.'), 'warn', 'login.configFirst');
    return;
  }

  try {
    setStatus(t('login.openingGoogle', 'Відкриваю вхід через Google...'), 'muted', 'login.openingGoogle');
    const firebase = await getFirebase();
    const provider = new firebase.authMod.GoogleAuthProvider();
    const result = await firebase.authMod.signInWithPopup(firebase.auth, provider);
    const profile = await saveSignedInUser(result.user);
    renderUser(result.user, profile);
    redirectAfterLogin(profile);
  } catch (error) {
    console.error(error);
    setStatus(t('login.signInFailed', 'Не вдалося увійти. Спробуй ще раз або перевір налаштування входу.'), 'error', 'login.signInFailed');
  }
}

async function signOutGoogle() {
  const firebase = await getFirebase();
  if (firebase) await firebase.authMod.signOut(firebase.auth);
  renderUser(null);
}

async function initLoginPage() {
  $('#loginGoogleBtn')?.addEventListener('click', signInGoogle);
  $('#loginLogoutBtn')?.addEventListener('click', signOutGoogle);
  $('#guestBtn')?.addEventListener('click', () => { window.location.href = 'index.html'; });
  $('#goAppBtn')?.addEventListener('click', async () => {
    const firebase = await getFirebase();
    const user = firebase?.auth?.currentUser;
    if (!user) return;
    const profile = await saveSignedInUser(user);
    redirectAfterLogin(profile);
  });

  await watchAuth(async user => {
    if (!user) {
      renderUser(null);
      return;
    }
    const profile = await saveSignedInUser(user).catch(error => {
      console.error(error);
      setStatus(t('login.databaseDenied', 'Google sign-in works, but the profile could not be saved. Try again later.'), 'error', 'login.databaseDenied');
      return null;
    });
    renderUser(user, profile);
  });
}

document.addEventListener('DOMContentLoaded', initLoginPage);
