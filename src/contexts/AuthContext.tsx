import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User, db, doc, setDoc, getDoc, serverTimestamp, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, deleteUser } from '../firebase';
import { signInWithRedirect, getRedirectResult } from 'firebase/auth';

const BOOTSTRAP_ADMIN = 'gandoadlam25@gmail.com';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  updateAvatar: (photoURL: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setProfileVersion] = useState(0); // bump to re-render after a profile edit

  useEffect(() => {
    // Failsafe: never let the app hang on a loading spinner. If auth init stalls
    // (e.g. a stale pending-redirect in IndexedDB from a previous authDomain),
    // force render after 6s so the user at least gets the login screen.
    const failsafe = setTimeout(() => setLoading(false), 6000);

    // Handle redirect result on page load (Safari uses redirect instead of popup)
    getRedirectResult(auth)
      .then(res => { if (res) console.log('[Auth] redirect sign-in ok:', res.user.email); })
      .catch(err => {
        console.error('[Auth] redirect result error:', err.code, err.message);
        setError(`Sign-in failed: ${err.code || err.message}`);
      });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      clearTimeout(failsafe);
      setError(null);

      if (!currentUser) {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Log the user in IMMEDIATELY. Do NOT await Firestore here — a hanging
      // setDoc/getDoc used to block setUser entirely, so auth succeeded but the
      // app never left the login screen ("bounce"). Auth state must not depend
      // on Firestore reachability.
      const email = currentUser.email?.toLowerCase() ?? '';
      setIsAdmin(email === BOOTSTRAP_ADMIN.toLowerCase());
      setUser(currentUser);
      setLoading(false);

      // Background, non-blocking: sync profile + refine admin status.
      void (async () => {
        try {
          await setDoc(doc(db, 'users', currentUser.uid), {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            role: 'user',
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (err) {
          console.error('[Auth] profile sync failed (non-blocking):', err);
        }
        if (email && email !== BOOTSTRAP_ADMIN.toLowerCase()) {
          try {
            const adminDoc = await getDoc(doc(db, 'admins', email));
            if (adminDoc.exists()) setIsAdmin(true);
          } catch (e) {
            console.log('[Auth] admin check failed (non-blocking):', e);
          }
        }
      })();
    });

    return () => { clearTimeout(failsafe); unsubscribe(); };
  }, []);

  const signIn = async () => {
    // First-party authDomain (see firebase.ts): the whole flow runs on our own
    // origin. Safari/iOS → redirect (first-party cookies persist); others → popup
    // (same-origin, posts back cleanly). Fall back to redirect if popup is blocked.
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    try {
      if (isSafari) await signInWithRedirect(auth, googleProvider);
      else await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      console.error('Sign in error:', code || error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error('Email sign in error:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error('Email sign up error:', error);
      throw error;
    }
  };

  // Let the user set/correct their display name (Google/email sign-up often
  // seeds it from the email prefix). Persists to Firebase Auth + the Firestore
  // users doc, then forces a re-render so the new name shows everywhere.
  const updateDisplayName = async (name: string) => {
    const cur = auth.currentUser;
    if (!cur) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    await updateProfile(cur, { displayName: trimmed });
    await cur.reload();
    setUser(auth.currentUser);
    setProfileVersion(v => v + 1);
    try {
      await setDoc(doc(db, 'users', cur.uid), { displayName: trimmed, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error('[Auth] displayName Firestore sync failed (non-blocking):', err);
    }
  };

  const updateAvatar = async (photoURL: string) => {
    const cur = auth.currentUser;
    if (!cur) return;
    await updateProfile(cur, { photoURL });
    await cur.reload();
    setUser(auth.currentUser);
    setProfileVersion(v => v + 1);
    try {
      await setDoc(doc(db, 'users', cur.uid), { photoURL, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error('[Auth] photoURL Firestore sync failed (non-blocking):', err);
    }
  };

  // Real account deletion (GDPR-compliant): removes the Firebase auth account.
  // Their Firestore docs are purged best-effort by the caller before this runs.
  // May throw 'auth/requires-recent-login' — caller surfaces "log in again".
  const deleteAccount = async () => {
    const cur = auth.currentUser;
    if (!cur) return;
    await deleteUser(cur);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, error, signIn, signInWithEmail, signUpWithEmail, updateDisplayName, updateAvatar, deleteAccount, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
