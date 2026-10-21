/* ============================================================
   Firebase glue (Auth + Firestore) — loaded as an ES module.
   Exposes window.LinguaCloud and resolves window.LinguaCloudReady.
   Everything degrades gracefully: if Firebase can't load (offline,
   blocked), the site keeps working from localStorage as before.

   Data model:  users/{uid} = {
     profile:  { name, language, level, updatedAt },
     progress: { ...same shape as progress.js v2... },
     updatedAt
   }
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, signOut, updateProfile, sendPasswordResetEmail,
  getAdditionalUserInfo
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJ5zuuLigko2l9HRT9SO6FLvk-rujJMrk",
  authDomain: "linuaai-claude.firebaseapp.com",
  projectId: "linuaai-claude",
  storageBucket: "linuaai-claude.firebasestorage.app",
  messagingSenderId: "436650917644",
  appId: "1:436650917644:web:4b0c5bced3342f487ed329"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
const authReady = new Promise(resolve => {
  const unsub = onAuthStateChanged(auth, user => { currentUser = user; resolve(user); unsub(); });
});
onAuthStateChanged(auth, user => { currentUser = user; });

const userDoc = uid => doc(db, 'users', uid);

let saveTimer = null, pending = null;
async function flush(){
  if(!currentUser || !pending) return;
  const progress = pending; pending = null;
  try{ await setDoc(userDoc(currentUser.uid), { progress, updatedAt: Date.now() }, { merge: true }); }
  catch(e){ console.error('Cloud save failed', e); pending = pending || progress; }
}
window.addEventListener('pagehide', () => { flush(); });

const LinguaCloud = {
  whenAuthed: () => authReady,
  user: () => currentUser,

  async signUp(name, email, password){
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if(name) await updateProfile(cred.user, { displayName: name });
    await setDoc(userDoc(cred.user.uid), { profile: { name: name || '', updatedAt: Date.now() } }, { merge: true });
    return cred.user;
  },
  async signIn(email, password){
    return (await signInWithEmailAndPassword(auth, email, password)).user;
  },
  async google(){
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    const info = getAdditionalUserInfo(cred);
    return { user: cred.user, isNew: !!(info && info.isNewUser) };
  },
  resetPassword: email => sendPasswordResetEmail(auth, email),
  async signOut(){ await flush(); await signOut(auth); },

  // Cloud copy of the signed-in user's data, or null.
  async pull(){
    if(!currentUser) return null;
    const snap = await getDoc(userDoc(currentUser.uid));
    return snap.exists() ? snap.data() : null;
  },
  async saveProfile(partial){
    if(!currentUser) return;
    await setDoc(userDoc(currentUser.uid), { profile: { ...partial, updatedAt: Date.now() } }, { merge: true });
  },
  // Debounced: progress.js calls this on every save.
  queueSave(progress){
    if(!currentUser) return;
    pending = progress;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 1200);
  },
  flush
};

window.LinguaCloud = LinguaCloud;
if(window.__linguaCloudResolve) window.__linguaCloudResolve(LinguaCloud);
