import { isFirebaseConfigured, getFirebase, watchAuth } from './services/firebase-service.js';
import { canUseAdminPanel, canUseStaffPanel, getUserProfile, isProfileComplete } from './services/user-db.js?v=077';

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
  const staff = signedIn && canUseStaffPanel(user, profile);
  const profileReady = signedIn && isProfileComplete(profile);
  const drawer = $('#drawer');
  const userText = $('#authUserText');
  const drawerAccountLabel = $('#drawerAccountLabel');
  const login = $('#googleLoginBtn');
  const logout = $('#googleLogoutBtn');
  const profileBtn = $('#profileBtn');
  const regionFormBtn = $('#regionFormBtn');
  const drawerProfileBtn = $('#drawerProfileBtn');
  const drawerRegionFormBtn = $('#drawerRegionFormBtn');
  const drawerLogin = $('#drawerGoogleLoginBtn');
  const drawerLogout = $('#drawerGoogleLogoutBtn');
  const drawerStatsNav = $('#drawerStatsNavBtn');
  const adminBtn = $('#adminBtn');
  const drawerAdminBtn = $('#drawerAdminBtn');
  const staffBtn = $('#staffBtn');
  const drawerStaffBtn = $('#drawerStaffBtn');

  if (drawer) drawer.classList.toggle('is-guest', !signedIn);
  if (userText) userText.textContent = signedIn ? name : accountLabel;
  if (drawerAccountLabel) drawerAccountLabel.textContent = signedIn ? name : guestLabel;
  if (login) login.hidden = signedIn;
  if (drawerLogin) drawerLogin.hidden = signedIn;
  if (drawerLogout) drawerLogout.hidden = !signedIn;
  if (drawerStatsNav) drawerStatsNav.hidden = false;
  if (logout) logout.hidden = !signedIn;
  if (profileBtn) profileBtn.hidden = !signedIn;
  if (regionFormBtn) regionFormBtn.hidden = !signedIn;
  if (drawerProfileBtn) drawerProfileBtn.hidden = !signedIn;
  if (drawerRegionFormBtn) drawerRegionFormBtn.hidden = !signedIn;
  if (staffBtn) staffBtn.hidden = !staff;
  if (drawerStaffBtn) drawerStaffBtn.hidden = !staff;
  if (adminBtn) adminBtn.hidden = !admin;
  if (drawerAdminBtn) drawerAdminBtn.hidden = !admin;
}

function openLoginPage() {
  window.location.href = 'login.html';
}

function openProfilePage() {
  window.location.href = isProfileComplete(currentProfile) ? 'profile.html' : 'register.html';
}

function openRegionFormPage() {
  window.location.href = isProfileComplete(currentProfile) ? 'region-form.html' : 'register.html';
}


function openStatsPage() {
  window.location.href = 'stats.html';
}

function openAdminPage() {
  window.location.href = 'admin.html';
}

function openStaffPage() {
  window.location.href = 'staff.html';
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
  $('#regionFormBtn')?.addEventListener('click', openRegionFormPage);
  $('#drawerProfileBtn')?.addEventListener('click', openProfilePage);
  $('#drawerRegionFormBtn')?.addEventListener('click', openRegionFormPage);
  $('#staffBtn')?.addEventListener('click', openStaffPage);
  $('#drawerStaffBtn')?.addEventListener('click', openStaffPage);
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
