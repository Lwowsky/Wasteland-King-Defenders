import { firebaseConfig } from '../config/firebase.config.js';

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const hasConfig = requiredKeys.every(key => {
  const value = firebaseConfig?.[key];
  return value && !String(value).includes('YOUR_') && String(value).trim() !== '';
});

let cache = null;

export function isFirebaseConfigured() {
  return hasConfig;
}

export async function getFirebase() {
  if (!hasConfig) return null;
  if (cache) return cache;

  const [appMod, authMod, firestoreMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
  ]);

  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  const db = firestoreMod.getFirestore(app);

  cache = { app, auth, db, authMod, firestoreMod };
  return cache;
}

export async function watchAuth(callback) {
  const firebase = await getFirebase();
  if (!firebase) {
    callback(null);
    return () => {};
  }
  return firebase.authMod.onAuthStateChanged(firebase.auth, callback);
}
