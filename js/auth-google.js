import { isFirebaseConfigured, getFirebase, watchAuth } from './services/firebase-service.js';
import { canUseAdminPanel, getUserProfile, isProfileComplete, normalizeUserRole } from './services/user-db.js';

const $ = selector => document.querySelector(selector);

let authReady = false;
let currentUser = null;
let currentProfile = null;

function setUserShell(user, profile = null) {
  currentUser = user;
  currentProfile = profile;
  const signedIn = Boolean(user);
  const gameNick = profile?.gameProfile?.nickname || profile?.gameNick;
  const name = gameNick || user?.displayName || user?.email || 'Акаунт';
  const admin = signedIn && canUseAdminPanel(user, profile);
  const role = normalizeUserRole(profile?.role || 'player');
  const profileReady = signedIn && isProfileComplete(profile);
  const regionManager = profileReady && ['admin', 'moderator', 'consul', 'officer'].includes(role);
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
  const securityBtn = $('#securityBtn');
  const drawerSecurityBtn = $('#drawerSecurityBtn');
  const regionFormBtn = $('#regionFormBtn');
  const regionTableBtn = $('#regionTableBtn');
  const regionSettingsBtn = $('#regionSettingsBtn');
  const drawerRegionFormBtn = $('#drawerRegionFormBtn');
  const drawerRegionTableBtn = $('#drawerRegionTableBtn');
  const drawerRegionSettingsBtn = $('#drawerRegionSettingsBtn');

  if (drawer) drawer.classList.toggle('is-guest', !signedIn);
  if (userText) userText.textContent = signedIn ? name : 'Акаунт';
  if (drawerAccountLabel) drawerAccountLabel.textContent = signedIn ? name : 'Гість';
  if (login) login.hidden = signedIn;
  if (drawerLogin) drawerLogin.hidden = signedIn;
  if (drawerLogout) drawerLogout.hidden = !signedIn;
  if (drawerStatsNav) drawerStatsNav.hidden = !signedIn;
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
  if (securityBtn) securityBtn.hidden = !admin;
  if (drawerSecurityBtn) drawerSecurityBtn.hidden = !admin;
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

function openSecurityPage() {
  window.location.href = 'security.html';
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
  $('#securityBtn')?.addEventListener('click', openSecurityPage);
  $('#drawerSecurityBtn')?.addEventListener('click', openSecurityPage);
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
    setUserShell(user, profile);
  });
}

document.addEventListener('wkd:partials-ready', initAuthGoogle);
document.addEventListener('DOMContentLoaded', () => setTimeout(initAuthGoogle, 0));
