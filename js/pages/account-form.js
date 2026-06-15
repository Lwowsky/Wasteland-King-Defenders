import { getFirebase, watchAuth } from '../services/firebase-service.js';
import {
  assignableRolesForActor,
  deleteFarm,
  getActiveRoleRequest,
  getFarmById,
  getGameProfile,
  getUserFarms,
  getUserProfile,
  isOwnerUser,
  isProfileComplete,
  makeFarmPrimary,
  normalizeProfileVisibility,
  roleLabel,
  saveGameRegistration,
  saveSignedInUser
} from '../services/user-db.js';
import { countryChoices, localizedCountry, matchCountry } from '../services/country-utils.js';

const $ = selector => document.querySelector(selector);
const trim = value => String(value ?? '').trim();
const allianceTag3 = value => window.WKD?.allianceTag3 ? window.WKD.allianceTag3(value) : Array.from(trim(value).replace(/[\/\[\]#?]/g, '')).slice(0, 3).join('');
const t = (key, fallback = '') => window.WKD_t ? window.WKD_t(key) : (fallback || key);
const tv = (key, fallback = '', vars = {}) => {
  let text = t(key, fallback);
  Object.entries(vars).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
  return text;
};
const REQUESTABLE_ROLES = ['admin', 'moderator', 'consul', 'officer'];
const STANDARD_SELECTABLE_ROLES = ['player', 'officer', 'consul'];
const OWNER_SELECTABLE_ROLES = ['player', 'officer', 'consul', 'moderator', 'admin'];

let currentUser = null;
let currentProfile = null;
let currentFarmId = 'main';
let draftFarm = null;
let accountReady = false;
let lastStatusState = null;

function statusTextFromState(state = {}) {
  if (!state?.key) return '';
  const vars = state.vars || {};
  return Object.keys(vars).length
    ? tv(state.key, state.fallback || state.key, vars)
    : t(state.key, state.fallback || state.key);
}

function setStatusKey(key, fallback = '', type = 'muted', vars = {}) {
  const state = { key, fallback, vars, type };
  setStatus(statusTextFromState(state), type, state);
}

function setStatus(text, type = 'muted', state = null) {
  const box = $('#accountStatus');
  if (!box) return;
  // The initial HTML uses data-i18n="profile.loading" only as a placeholder.
  // Once the real account state is known, remove it so language refreshes do not
  // overwrite statuses like "Profile saved" back to "Loading profile...".
  box.removeAttribute('data-i18n');
  box.textContent = text;
  box.dataset.type = type;
  lastStatusState = state;
}


function updateCountryList(query = '') {
  const list = $('#countryList');
  if (!list) return;
  list.innerHTML = countryChoices(query).map(item => `<option value="${item.label}" label="${item.english || item.code}" data-code="${item.code}"></option>`).join('');
}

function syncCountryInput(force = false) {
  const input = $('#country');
  const codeInput = $('#countryCode');
  if (!input || !codeInput) return;
  const match = matchCountry(input.value);
  if (match) {
    codeInput.value = match.code;
    if (force) input.value = localizedCountry(match.name, match.code);
  } else if (!input.value.trim()) {
    codeInput.value = '';
  }
}

function refreshCountryLocale() {
  const input = $('#country');
  const codeInput = $('#countryCode');
  if (!input || !codeInput) return;
  if (codeInput.value) input.value = localizedCountry(input.value, codeInput.value);
  updateCountryList(input.value);
}

function makeFarmId() {
  return `farm-${Date.now()}`;
}

function farmLabel(farm = {}, index = 0) {
  const name = farm.nickname || (farm.farmId === 'main' ? t('account.mainPlayer', 'Main player') : tv('account.farmNumber', 'Farm {index}', { index: index + 1 }));
  const region = farm.region ? ` · R${farm.region}` : '';
  const role = farm.role && farm.role !== 'player' ? ` · ${roleLabel(farm.role)}` : '';
  return `${name}${region}${role}`;
}

function profileFarms(profile = {}) {
  const main = { ...getGameProfile(profile), farmId: 'main', id: 'main' };
  return [main, ...getUserFarms(profile)];
}

function selectedFarm(profile = currentProfile) {
  if (draftFarm && currentFarmId === draftFarm.farmId) return draftFarm;
  return getFarmById(profile || {}, currentFarmId) || { farmId: currentFarmId || 'main', rank: 'p1' };
}

function selectedFarmRole(profile = currentProfile) {
  if ((currentFarmId || 'main') === 'main') return profile?.role || 'player';
  return selectedFarm(profile)?.role || 'player';
}

function renderRankOptions(farm = selectedFarm()) {
  const rank = String(farm?.rank || 'p1').toLowerCase();
  const allowed = ['p1', 'p2', 'p3'];
  const options = allowed.includes(rank) ? allowed : [...allowed, rank];
  const select = $('#rank');
  if (!select) return;
  select.innerHTML = options.map(option => `<option value="${option}">${option.toUpperCase()}${['p4','p5'].includes(option) ? ' · ' + t('account.rankManaged', 'керівний ранг') : ''}</option>`).join('');
  select.value = options.includes(rank) ? rank : 'p1';
}

function selfRankChangeAllowed(oldRank = 'p1', nextRank = 'p1') {
  const rankNumber = value => {
    const match = String(value || '').match(/[1-5]/);
    return match ? Number(match[0]) : 1;
  };
  const before = rankNumber(oldRank || 'p1');
  const after = rankNumber(nextRank || 'p1');
  return after <= 3 || after === before;
}

function selectableRoleIds(currentRole = 'player') {
  const role = currentRole || 'player';
  const owner = isOwnerUser(currentUser, currentProfile);
  const allowedByActor = assignableRolesForActor(currentUser, currentProfile);
  const base = owner ? OWNER_SELECTABLE_ROLES : STANDARD_SELECTABLE_ROLES;
  const keepCurrent = ['admin', 'moderator'].includes(role) && !owner ? [role] : [];
  const actorSafe = owner ? allowedByActor : allowedByActor.filter(item => !['admin', 'moderator'].includes(item));
  return [...new Set(['player', role, ...base, ...actorSafe, ...keepCurrent])].filter(Boolean);
}

function roleOptionText(role = 'player') {
  const label = roleLabel(role);
  return role === 'player' ? label : tv('account.roleApprovalRequired', '{role} — approval required', { role: label });
}

function renderRoleOptions(selectedRole = 'player') {
  const select = $('#requestedRole');
  if (!select) return;
  const options = selectableRoleIds(selectedRole);
  select.innerHTML = options.map(role => `<option value="${role}">${roleOptionText(role)}</option>`).join('');
  select.value = options.includes(selectedRole) ? selectedRole : 'player';
}

function syncFarmActionButtons() {
  const isDraft = Boolean(draftFarm && currentFarmId === draftFarm.farmId);
  $('#deleteFarmBtn') && ($('#deleteFarmBtn').hidden = currentFarmId === 'main' || isDraft);
  $('#makePrimaryFarmBtn') && ($('#makePrimaryFarmBtn').hidden = currentFarmId === 'main' || isDraft);
}

function renderFarmSelect() {
  const select = $('#farmSelect');
  if (!select) return;
  const farms = profileFarms(currentProfile || {});
  const hasDraft = draftFarm && !farms.some(farm => farm.farmId === draftFarm.farmId);
  const items = hasDraft ? [...farms, draftFarm] : farms;
  select.innerHTML = items.map((farm, index) => `
    <option value="${farm.farmId || farm.id || 'main'}" ${(farm.farmId || farm.id) === currentFarmId ? 'selected' : ''}>${farmLabel(farm, index)}</option>
  `).join('');
  syncFarmActionButtons();
}

function setRoleHint(profile = {}) {
  const hint = $('#roleRequestHint');
  if (!hint) return;

  const role = profile.role || 'player';
  const request = getActiveRoleRequest(profile);
  if (request?.status === 'pending') {
    hint.textContent = tv('account.roleRequestSent', 'Role request “{role}” was sent. Wait for the admin decision.', { role: roleLabel(request.requestedRole) });
    hint.dataset.type = 'warn';
    return;
  }
  if (request?.status === 'approved') {
    hint.textContent = tv('account.roleApproved', 'Role approved: {role}.', { role: roleLabel(role) });
    hint.dataset.type = 'success';
    return;
  }
  if (request?.status === 'declined') {
    hint.textContent = t('account.roleDeclined', 'The previous request was declined. You can submit a new request or stay as a player.');
    hint.dataset.type = 'error';
    return;
  }
  hint.textContent = role === 'player'
    ? t('account.officerConsulAdminOnly', 'Only an admin can approve officer or consul.')
    : tv('account.currentRole', 'Current role: {role}.', { role: roleLabel(role) });
  hint.dataset.type = role === 'player' ? 'muted' : 'success';
}

function fillUserCard(user, profile = {}) {
  const game = getGameProfile(profile || {});
  $('#accountAvatar')?.setAttribute('src', user?.photoURL || 'img/logo.webp');
  if ($('#accountGoogleName')) {
    $('#accountGoogleName').removeAttribute('data-i18n');
    $('#accountGoogleName').textContent = game.nickname || user?.displayName || user?.email || t('profile.googleUser', 'Користувач Google');
  }
  if ($('#accountEmail')) $('#accountEmail').textContent = user?.email || '';
  if ($('#accountRole')) $('#accountRole').textContent = roleLabel(profile.role || 'player');
  if ($('#currentRoleText')) $('#currentRoleText').textContent = roleLabel(profile.role || 'player');
}

function fillFarmFields(farm = {}) {
  const set = (id, value) => { const el = $(id); if (el) el.value = value ?? ''; };
  set('#nickname', farm.nickname || '');
  set('#region', farm.region || '');
  set('#alliance', farm.alliance || '');
  renderRankOptions(farm);
  set('#rank', farm.rank || 'p1');
  set('#shk', farm.shk || '');
}

function fillVisibilityFields(profile = {}) {
  const visibility = normalizeProfileVisibility(profile.profileVisibility || {});
  const showWasteland = $('#showWastelandInfo');
  const showFarms = $('#showFarmsInfo');
  if (showWasteland) showWasteland.checked = visibility.showWastelandInfo;
  if (showFarms) showFarms.checked = visibility.showFarmsInfo;
}

function fillForm(profile = {}) {
  const role = selectedFarmRole(profile);
  const request = getActiveRoleRequest(profile);
  const requestFarmId = request?.farmId || 'main';
  const requestedRole = request?.status === 'pending' && requestFarmId === (currentFarmId || 'main')
    ? request.requestedRole
    : role;

  renderFarmSelect();
  fillFarmFields(selectedFarm(profile));
  renderRoleOptions(requestedRole || 'player');
  fillUserCard(currentUser, profile);
  if ($('#currentRoleText')) $('#currentRoleText').textContent = roleLabel(role || 'player');
  const country = $('#country');
  const countryCode = $('#countryCode');
  if (countryCode) countryCode.value = profile.countryCode || '';
  if (country) country.value = localizedCountry(profile.country || '', profile.countryCode || '');
  updateCountryList(country?.value || '');
  fillVisibilityFields(profile);
  setRoleHint(profile);
}

function readForm() {
  return {
    farmId: currentFarmId || 'main',
    country: localizedCountry(trim($('#country')?.value), trim($('#countryCode')?.value)),
    countryCode: trim($('#countryCode')?.value) || matchCountry($('#country')?.value)?.code || '',
    nickname: trim($('#nickname')?.value),
    region: trim($('#region')?.value),
    alliance: allianceTag3($('#alliance')?.value),
    rank: trim($('#rank')?.value || 'p1'),
    shk: trim($('#shk')?.value),
    requestedRole: trim($('#requestedRole')?.value || 'player'),
    profileVisibility: {
      showWastelandInfo: Boolean($('#showWastelandInfo')?.checked),
      showFarmsInfo: Boolean($('#showFarmsInfo')?.checked)
    }
  };
}

function validate(values) {
  const errors = [];
  if (!values.nickname) errors.push(t('account.errorNickname', 'Enter your in-game nickname.'));
  if (!values.region) errors.push(t('account.errorRegion', 'Enter your region.'));
  if (!/^\d{1,4}$/.test(values.region) || Number(values.region) < 1 || Number(values.region) > 1200) {
    errors.push(t('account.errorRegionRange', 'Region must be a number from 1 to 1200.'));
  }
  if (!values.alliance) errors.push(t('account.errorAlliance', 'Enter your alliance.'));
  if (!['p1', 'p2', 'p3', 'p4', 'p5'].includes(values.rank)) errors.push(t('account.errorRank', 'Choose rank P1–P5.'));
  if (!selfRankChangeAllowed(selectedFarm()?.rank || 'p1', values.rank)) errors.push(t('account.rankRestricted', 'P4/P5 може видати тільки керівництво альянсу або регіону. Вибери P1–P3.'));
  if (!values.shk) errors.push(t('account.errorShk', 'Enter HQ level.'));
  if (values.shk && (!/^\d{1,2}$/.test(values.shk) || Number(values.shk) < 1 || Number(values.shk) > 45)) {
    errors.push(t('account.errorShkRange', 'HQ must be a number from 1 to 45.'));
  }
  if (!selectableRoleIds(selectedFarmRole()).includes(values.requestedRole)) errors.push(t('account.errorRole', 'Choose a valid role.'));
  return errors;
}

function buildSavedMessage(profile = {}) {
  const request = getActiveRoleRequest(profile);
  const farmName = currentFarmId === 'main' ? t('account.mainPlayerGenitive', 'main player') : t('account.farmGenitive', 'farm');
  if (request?.status === 'pending') {
    return tv('account.savedPending', '{farm} data saved. Role request “{role}” is waiting for admin approval.', { farm: farmName, role: roleLabel(request.requestedRole) });
  }
  return currentFarmId === 'main' ? t('account.savedMain', 'Main player data saved.') : t('account.savedFarm', 'Farm data saved.');
}

function needsRegionRoleReset(values) {
  const role = currentProfile?.role || 'player';
  if (!['consul', 'officer'].includes(role)) return false;
  if ((values.farmId || 'main') !== 'main') return false;
  const oldRegion = String(getGameProfile(currentProfile || {}).region || '').trim();
  const newRegion = String(values.region || '').trim();
  return Boolean(oldRegion && newRegion && oldRegion !== newRegion);
}

async function confirmRegionRoleReset(values) {
  if (!needsRegionRoleReset(values)) return true;
  const role = roleLabel(currentProfile?.role || 'player');
  const oldRegion = getGameProfile(currentProfile || {}).region;
  const message = tv('account.changeRegionMessage', 'You currently have the role “{role}” in region {oldRegion}. If you change the region to {newRegion}, the role will be reset to “Player”.', { role, oldRegion, newRegion: values.region });
  if (window.WKD?.confirmDialog) {
    return window.WKD.confirmDialog({
      title: t('account.changeRegionTitle', 'Change region and lose the role?'),
      message,
      note: t('account.changeRegionNote', 'Admin and moderator do not lose their role. After changing region, a consul or officer must request the higher role again.'),
      icon: '⚠',
      acceptText: t('account.changeRegionAccept', 'Change region')
    });
  }
  return window.confirm(`${message}

${t('common.confirm', 'Confirm')}?`);
}

async function handleSave(event) {
  event.preventDefault();
  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  const values = readForm();
  const errors = validate(values);
  if (errors.length) {
    setStatus(errors.join(' '), 'error');
    return;
  }
  if (!await confirmRegionRoleReset(values)) {
    setStatus(t('account.regionChangeCancelled', 'Region change cancelled. The role stayed unchanged.'), 'muted');
    return;
  }

  try {
    setStatus(t('account.saving', 'Saving data...'), 'muted');
    currentProfile = await saveGameRegistration(currentUser, values);
    draftFarm = null;
    currentFarmId = values.farmId || 'main';
    fillForm(currentProfile);
    document.dispatchEvent(new CustomEvent('wkd:profile-updated', { detail: { profile: currentProfile } }));
    setStatus(buildSavedMessage(currentProfile), getActiveRoleRequest(currentProfile)?.status === 'pending' ? 'warn' : 'success');

    if (document.body.dataset.accountPage === 'register') {
      setTimeout(() => { window.location.href = 'profile.html'; }, 900);
    }
  } catch (error) {
    console.error('[WKD] account profile save failed:', error?.code || error?.message || error, error);
    if (error?.message === 'nickname-duplicate-region') {
      setStatus(t('account.nicknameDuplicateRegion', 'У цьому регіоні вже є гравець з таким нікнеймом.'), 'error');
      return;
    }
    if (error?.message === 'rank-restricted') {
      setStatus(t('account.rankRestricted', 'P4/P5 може видати тільки керівництво альянсу або регіону. Вибери P1–P3.'), 'error');
      return;
    }
    if (error?.message === 'rank-p5-limit') {
      setStatus(t('account.rankP5Limit', 'У цьому альянсі вже є P5. Можна мати тільки одного P5.'), 'error');
      return;
    }
    if (error?.message === 'rank-p4-limit') {
      setStatus(t('account.rankP4Limit', 'У цьому альянсі вже є 20 гравців P4. Ліміт P4 заповнений.'), 'error');
      return;
    }
    if (error?.message === 'profile-bootstrap-failed') {
      setStatus(t('account.profileBootstrapFailed', 'Не вдалося створити профіль акаунта. Перевір Firestore rules і спробуй ще раз.'), 'error');
      return;
    }
    const code = String(error?.code || '');
    if (code.includes('permission-denied')) {
      setStatus(t('account.savePermissionDenied', 'Не вдалося зберегти профіль: Firestore rules не дозволили запис. Онови правила Firestore і спробуй ще раз.'), 'error');
      return;
    }
    setStatus(t('account.saveFailed', 'Не вдалося зберегти профіль. Перевір вхід у акаунт і права доступу.'), 'error');
  }
}

function handleRoleChange() {
  const role = $('#requestedRole')?.value || 'player';
  const hint = $('#roleRequestHint');
  if (!hint) return;
  if (REQUESTABLE_ROLES.includes(role)) {
    hint.textContent = tv('account.roleRequestSent', 'Role request “{role}” was sent. Wait for the admin decision.', { role: roleLabel(role) });
    hint.dataset.type = 'warn';
  } else {
    setRoleHint(currentProfile || {});
  }
}

function refreshAccountLocale() {
  refreshCountryLocale();
  if (currentProfile) fillForm(currentProfile || {});
  if (lastStatusState) setStatusKey(lastStatusState.key, lastStatusState.fallback, lastStatusState.type, lastStatusState.vars);
}

function handleFarmChange(event) {
  currentFarmId = event.currentTarget.value || 'main';
  draftFarm = draftFarm && currentFarmId === draftFarm.farmId ? draftFarm : null;
  fillForm(currentProfile || {});
  syncFarmActionButtons();
  setStatus(currentFarmId === 'main' ? t('account.editingMainPlayer', 'Editing the main player.') : t('account.editingFarm', 'Editing an extra farm.'), 'muted');
}

function addFarm() {
  draftFarm = { farmId: makeFarmId(), id: '', nickname: '', region: getGameProfile(currentProfile || {}).region || '', alliance: '', rank: 'p1', shk: '', role: 'player' };
  currentFarmId = draftFarm.farmId;
  renderFarmSelect();
  fillFarmFields(draftFarm);
  setStatus(t('account.saveNewFarmHint', 'Fill in the new farm data and click “Save profile”.'), 'warn');
}

async function makeSelectedFarmPrimary() {
  if (!currentUser || currentFarmId === 'main' || (draftFarm && currentFarmId === draftFarm.farmId)) return;
  const farm = selectedFarm();
  const message = tv('account.makePrimaryMessage', 'Make “{name}” the main player? The current main player will move to farms.', { name: farmLabel(farm, 0) });
  const ok = window.WKD?.confirmDialog
    ? await window.WKD.confirmDialog({
      title: t('account.makePrimaryTitle', 'Make main player?'),
      message,
      note: t('account.makePrimaryNote', 'Region access uses the main player region.'),
      icon: '★',
      acceptText: t('account.makePrimary', 'Make primary')
    })
    : window.confirm(message);
  if (!ok) return;
  try {
    setStatus(t('account.makingPrimary', 'Changing the main player...'), 'muted');
    currentProfile = await makeFarmPrimary(currentUser, currentFarmId);
    currentFarmId = 'main';
    draftFarm = null;
    fillForm(currentProfile || {});
    document.dispatchEvent(new CustomEvent('wkd:profile-updated', { detail: { profile: currentProfile } }));
    setStatus(t('account.primaryChanged', 'Main player changed.'), 'success');
  } catch (error) {
    console.error(error);
    setStatus(t('account.primaryChangeFailed', 'Could not change the main player.'), 'error');
  }
}

async function removeFarm() {
  if (!currentUser || currentFarmId === 'main') return;
  const ok = window.WKD?.confirmDialog
    ? await window.WKD.confirmDialog({
      title: t('account.deleteFarmTitle', 'Delete farm?'),
      message: t('account.deleteFarmMessage', 'This extra player will be removed from your profile.'),
      note: t('account.deleteFarmNote', 'The main profile will not change.'),
      icon: '✕',
      acceptText: t('common.delete', 'Delete')
    })
    : window.confirm(t('account.deleteFarmTitle', 'Delete farm?'));
  if (!ok) return;
  try {
    setStatus(t('account.deletingFarm', 'Deleting farm...'), 'muted');
    currentProfile = await deleteFarm(currentUser, currentFarmId);
    currentFarmId = 'main';
    draftFarm = null;
    fillForm(currentProfile || {});
    setStatus(t('account.farmDeleted', 'Farm deleted.'), 'success');
  } catch (error) {
    console.error(error);
    setStatus(t('account.farmDeleteFailed', 'Could not delete the farm.'), 'error');
  }
}

async function signOut() {
  const firebase = await getFirebase();
  if (firebase) await firebase.authMod.signOut(firebase.auth);
  window.location.href = 'login.html';
}

async function initAccountPage() {
  if (accountReady || !$('#accountForm')) return;
  accountReady = true;
  $('#accountForm')?.addEventListener('submit', handleSave);
  $('#requestedRole')?.addEventListener('change', handleRoleChange);
  $('#farmSelect')?.addEventListener('change', handleFarmChange);
  $('#addFarmBtn')?.addEventListener('click', addFarm);
  $('#makePrimaryFarmBtn')?.addEventListener('click', makeSelectedFarmPrimary);
  $('#deleteFarmBtn')?.addEventListener('click', removeFarm);
  ['#nickname', '#region', '#alliance'].forEach(selector => {
    $(selector)?.addEventListener('blur', () => {
      if (!draftFarm || currentFarmId !== draftFarm.farmId) return;
      const values = readForm();
      draftFarm = { ...draftFarm, nickname: values.nickname, region: values.region, alliance: values.alliance, rank: values.rank, shk: values.shk };
      renderFarmSelect();
    });
  });
  $('#backToSiteBtn')?.addEventListener('click', () => { window.location.href = 'index.html'; });
  $('#signOutBtn')?.addEventListener('click', signOut);
  $('#country')?.addEventListener('input', event => { updateCountryList(event.currentTarget.value); syncCountryInput(false); });
  $('#country')?.addEventListener('blur', () => syncCountryInput(true));
  document.addEventListener('wkd:language-changed', refreshAccountLocale);

  await watchAuth(async user => {
    currentUser = user;

    if (!user) {
      setStatus(t('account.signInRequired', 'You need to sign in with Google.'), 'warn');
      setTimeout(() => { window.location.href = 'login.html'; }, 600);
      return;
    }

    try {
      currentProfile = await saveSignedInUser(user);
      currentProfile = currentProfile || await getUserProfile(user.uid).catch(() => null);
      currentFarmId = currentProfile?.activeFarmId || 'main';
      if (!getFarmById(currentProfile || {}, currentFarmId)) currentFarmId = 'main';
      fillForm(currentProfile || {});
      const page = document.body.dataset.accountPage;
      if (page === 'profile' && !isProfileComplete(currentProfile)) {
        setStatus(t('account.completeMainFirst', 'Complete the main player registration first.'), 'warn');
      } else {
        const request = getActiveRoleRequest(currentProfile);
        if (request?.status === 'pending') {
          setStatusKey('account.requestPending', 'Role request “{role}” is waiting for approval.', 'warn', { role: roleLabel(request.requestedRole) });
        } else if (page === 'register') {
          setStatusKey('account.fillMainFirst', 'Fill in the main player data for the first registration.', 'muted');
        } else {
          setStatusKey('account.profileHelp', 'Here you can update the main player and add farms.', 'muted');
        }
      }
    } catch (error) {
      console.error(error);
      setStatus(t('account.readFailed', 'Could not read the profile.'), 'error');
    }
  });
}

document.addEventListener('wkd:partials-ready', initAccountPage);
document.addEventListener('DOMContentLoaded', () => setTimeout(initAccountPage, 0));
