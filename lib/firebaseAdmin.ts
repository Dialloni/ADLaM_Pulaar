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
  return getFirestore();
}

export function adminStorage() {
  initAdmin();
  return getStorage().bucket();
}
