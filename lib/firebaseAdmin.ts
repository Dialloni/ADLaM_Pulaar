import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function initAdmin() {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is required');
    initializeApp({
      credential: cert(JSON.parse(raw)),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }
}

export async function verifyIdToken(token: string) {
  initAdmin();
  return getAuth().verifyIdToken(token);
}

export function adminDb() {
  initAdmin();
  // The app uses a NAMED Firestore database (see src/firebase.ts) — the
  // default getFirestore() silently targets '(default)', which is empty.
  // Railway stores env values with literal quotes, hence the strip.
  const dbId = (process.env.FIREBASE_FIRESTORE_DATABASE_ID
    || process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID
    || '').trim().replace(/^"+|"+$/g, '');
  return dbId && dbId !== '(default)' ? getFirestore(dbId) : getFirestore();
}

export function adminStorage() {
  initAdmin();
  return getStorage().bucket();
}

// Mirrors isAdmin() in firestore.rules + AuthContext.tsx: the bootstrap owner
// email, or any email with a doc in /admins. Used to exempt admins from quotas.
const BOOTSTRAP_ADMIN = 'gandoadlam25@gmail.com';

export async function isAdminEmail(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  const e = email.toLowerCase();
  if (e === BOOTSTRAP_ADMIN) return true;
  try {
    return (await adminDb().collection('admins').doc(e).get()).exists;
  } catch {
    return false;
  }
}
