import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getAdminAuth() {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is required for server auth');
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return getAuth();
}

export async function verifyIdToken(token: string) {
  return getAdminAuth().verifyIdToken(token);
}
