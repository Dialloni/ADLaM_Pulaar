import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, onSnapshot, serverTimestamp, Timestamp, addDoc, updateDoc, orderBy, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

// Trim every value — pasted env vars (esp. on Vercel) can carry stray
// whitespace/newlines that corrupt the bucket name or auth domain (#storage-404).
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
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
  deleteDoc,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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
