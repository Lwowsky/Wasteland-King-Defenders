import { isFirebaseConfigured, getFirebase, watchAuth } from './services/firebase-service.js';
import { canUseAdminPanel, getUserProfile, isProfileComplete } from './services/user-db.js';
import { canOpenRegionTools } from './services/region-db.js?v=213';

const $ = selector => document.querySelector(selector);
const shellT = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : fallback;

let authReady = false;
let currentUser = null;
let currentProfile = null;

function setUserShell(user, profile = null) {
  currentUser = user;
  currentProfile = profile;
  const signedIn = Boolean(user);
  const gameNick = profile?.gameProfile?.nickname || profile?.gameNick;
  const accountLabel = shellT('header.account', 'Акаунт');
  const guestLabel = shellT('role.guest', 'Гість');
  const name = gameNick || user?.displayName || user?.email || accountLabel;
  const admin = signedIn && canUseAdminPanel(user, profile);
  const profileReady = signedIn && isProfileComplete(profile);
  const regionManager = profileReady && canOpenRegionTools(profile || {});
  const regionTablePageAllowed = profileReady;
  const drawer = $('#drawer');
  const userText = $('#authUserText');
  const drawerAccountLabel = $('#drawerAccountLabel');
  const login = $('#googleLoginBtn');
  const logout = $('#googleLogoutBtn');
  const profileBtn = $('#profileBtn');
  const drawerProfileBtn = $('#drawerProfileBtn');
  const drawerLogin = $('#drawerGoogleLoginBtn');
  const drawerLogout = $('#drawerGoogleLogoutBtn');
  const drawerStatsNav = $('#drawerStatsNavBtn');
  const adminBtn = $('#adminBtn');
  const drawerAdminBtn = $('#drawerAdminBtn');
  const actionLogBtn = $('#actionLogBtn');
  const drawerActionLogBtn = $('#drawerActionLogBtn');
  const regionFormBtn = $('#regionFormBtn');
  const regionTableBtn = $('#regionTableBtn');
  const regionSettingsBtn = $('#regionSettingsBtn');
  const drawerRegionFormBtn = $('#drawerRegionFormBtn');
  const drawerRegionTableBtn = $('#drawerRegionTableBtn');
  const drawerRegionSettingsBtn = $('#drawerRegionSettingsBtn');

  if (drawer) drawer.classList.toggle('is-guest', !signedIn);
  if (userText) userText.textContent = signedIn ? name : accountLabel;
  if (drawerAccountLabel) drawerAccountLabel.textContent = signedIn ? name : guestLabel;
  if (login) login.hidden = signedIn;
  if (drawerLogin) drawerLogin.hidden = signedIn;
  if (drawerLogout) drawerLogout.hidden = !signedIn;
  if (drawerStatsNav) drawerStatsNav.hidden = false;
  if (logout) logout.hidden = !signedIn;
  if (profileBtn) profileBtn.hidden = !signedIn;
  if (drawerProfileBtn) drawerProfileBtn.hidden = !signedIn;
  if (regionFormBtn) regionFormBtn.hidden = !profileReady;
  if (regionTableBtn) regionTableBtn.hidden = !regionTablePageAllowed;
  if (regionSettingsBtn) regionSettingsBtn.hidden = !regionManager;
  if (drawerRegionFormBtn) drawerRegionFormBtn.hidden = !profileReady;
  if (drawerRegionTableBtn) drawerRegionTableBtn.hidden = !regionTablePageAllowed;
  if (drawerRegionSettingsBtn) drawerRegionSettingsBtn.hidden = !regionManager;
  if (actionLogBtn) actionLogBtn.hidden = !regionManager && !admin;
  if (drawerActionLogBtn) drawerActionLogBtn.hidden = !regionManager && !admin;
  if (adminBtn) adminBtn.hidden = !admin;
  if (drawerAdminBtn) drawerAdminBtn.hidden = !admin;
}

function openLoginPage() {
  window.location.href = 'login.html';
}

function openProfilePage() {
  window.location.href = isProfileComplete(currentProfile) ? 'profile.html' : 'register.html';
}

function openStatsPage() {
  window.location.href = 'stats.html';
}

function openAdminPage() {
  window.location.href = 'admin.html';
}

function openActionLogPage() {
  window.location.href = 'action-log.html';
}

function openRegionFormPage() {
  window.location.href = isProfileComplete(currentProfile) ? 'region-form.html' : 'register.html';
}

function openRegionTablePage() {
  window.location.href = isProfileComplete(currentProfile) ? 'region-table.html' : 'register.html';
}

function openRegionSettingsPage() {
  window.location.href = isProfileComplete(currentProfile) ? 'region-settings.html' : 'register.html';
}

async function logoutGoogle() {
  const firebase = await getFirebase();
  if (firebase) await firebase.authMod.signOut(firebase.auth);
  setUserShell(null);
}

async function initAuthGoogle() {
  if (authReady || !$('#googleLoginBtn')) return;
  authReady = true;

  $('#googleLoginBtn')?.addEventListener('click', openLoginPage);
  $('#drawerGoogleLoginBtn')?.addEventListener('click', openLoginPage);
  $('#googleLogoutBtn')?.addEventListener('click', logoutGoogle);
  $('#drawerGoogleLogoutBtn')?.addEventListener('click', logoutGoogle);
  $('#statsBtn')?.addEventListener('click', openStatsPage);
  $('#drawerStatsNavBtn')?.addEventListener('click', openStatsPage);
  $('#profileBtn')?.addEventListener('click', openProfilePage);
  $('#drawerProfileBtn')?.addEventListener('click', openProfilePage);
  $('#regionFormBtn')?.addEventListener('click', openRegionFormPage);
  $('#drawerRegionFormBtn')?.addEventListener('click', openRegionFormPage);
  $('#regionTableBtn')?.addEventListener('click', openRegionTablePage);
  $('#drawerRegionTableBtn')?.addEventListener('click', openRegionTablePage);
  $('#regionSettingsBtn')?.addEventListener('click', openRegionSettingsPage);
  $('#drawerRegionSettingsBtn')?.addEventListener('click', openRegionSettingsPage);
  $('#actionLogBtn')?.addEventListener('click', openActionLogPage);
  $('#drawerActionLogBtn')?.addEventListener('click', openActionLogPage);
  $('#adminBtn')?.addEventListener('click', openAdminPage);
  $('#drawerAdminBtn')?.addEventListener('click', openAdminPage);

  if (!isFirebaseConfigured()) {
    setUserShell(null);
    return;
  }

  await watchAuth(async user => {
    if (!user) {
      setUserShell(null);
      return;
    }
    const profile = await getUserProfile(user.uid).catch(() => null);
    if (profile?.blocked) {
      try { await (await getFirebase())?.authMod?.signOut((await getFirebase())?.auth); } catch (_error) {}
      window.WKD?.showNotice?.(shellT('login.blockedAccount', 'Акаунт у чорному списку.'));
      setUserShell(null, null);
      return;
    }
    setUserShell(user, profile);
  });
}

document.addEventListener('wkd:partials-ready', initAuthGoogle);
document.addEventListener('DOMContentLoaded', () => setTimeout(initAuthGoogle, 0));


document.addEventListener('wkd:language-changed', () => {
  setUserShell(currentUser, currentProfile);
});
