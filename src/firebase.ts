import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, deleteUser } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, onSnapshot, serverTimestamp, Timestamp, addDoc, updateDoc, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

// Trim every value — pasted env vars (esp. on Vercel) can carry stray
// whitespace/newlines that corrupt the bucket name or auth domain (#storage-404).

// Safari/iOS block third-party cookies, so signInWithRedirect fails when the
// authDomain (*.firebaseapp.com) is a different site than the app. On the
// production host we use the app's own domain as authDomain — vercel.json
// proxies /__/auth/* to the Firebase handler, making auth first-party so the
// redirect session persists on Safari/iOS. Localhost keeps the Firebase
// authDomain (popup works there, no proxy available).
// FIRST-PARTY AUTH. These hosts proxy /__/auth/* to the Firebase handler
// (Vercel via vercel.json, Railway via the proxy in server.ts), so we use the
// app's OWN domain as authDomain. The entire OAuth handshake then happens on
// our origin — no third-party cookies/storage (which Chrome/Safari block and
// which made the firebaseapp.com popup bounce). Requires, for each host:
//   (1) the /__/auth proxy, (2) the host in Firebase Authorized Domains,
//   (3) https://<host>/__/auth/handler in the Google OAuth client redirect URIs.
const FIRST_PARTY_AUTH_HOSTS = ['gando-ai.vercel.app', 'gando-ai.up.railway.app'];
const browserHost = typeof window !== 'undefined' ? window.location.hostname : '';
const resolvedAuthDomain = FIRST_PARTY_AUTH_HOSTS.includes(browserHost)
  ? browserHost
  : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim();

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain:        resolvedAuthDomain,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId:             import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
};

const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID?.trim() || '(default)';

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app, firestoreDatabaseId);
const auth = getAuth(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export {
  app,
  db,
  auth,
  storage,
  googleProvider,
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  addDoc,
  updateDoc,
  orderBy,
  limit,
  deleteDoc,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  deleteUser,
};
export type { User };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST   = 'list',
  GET    = 'get',
  WRITE  = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Firestore Error:', JSON.stringify({ error: message, operationType, path }));
  throw new Error(message);
}
