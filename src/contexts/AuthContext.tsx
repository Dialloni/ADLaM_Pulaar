import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User, db, doc, setDoc, getDoc, serverTimestamp, createUserWithEmailAndPassword, signInWithEmailAndPassword } from '../firebase';
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      clearTimeout(failsafe);
      setError(null);
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            role: 'user',
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (err: any) {
          console.error('Error syncing user profile:', err);
          setError(`Profile Sync Error: ${err.message}`);
        }

        // Check admin status: Firestore admins collection OR bootstrap email
        const email = currentUser.email?.toLowerCase() ?? '';
        let admin = email === BOOTSTRAP_ADMIN.toLowerCase();
        console.log('[Auth] email:', currentUser.email, '| isAdmin:', admin, '| provider:', currentUser.providerData[0]?.providerId);
        if (!admin) {
          try {
            const adminDoc = await getDoc(doc(db, 'admins', email));
            admin = adminDoc.exists();
            console.log('[Auth] Firestore admin check:', admin);
          } catch (e) {
            console.log('[Auth] Firestore admin check failed:', e);
          }
        }
        setIsAdmin(admin);
        setUser(currentUser);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => { clearTimeout(failsafe); unsubscribe(); };
  }, []);

  const signIn = async () => {
    // Popup is the reliable path now that the app domain is an Authorized domain
    // in Firebase: Google's handler posts the credential back to our (authorized)
    // origin. Fall back to full-page redirect only if the popup is blocked.
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      // popup-closed-by-user / cancelled-popup-request: user aborted — surface quietly.
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

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, error, signIn, signInWithEmail, signUpWithEmail, logout }}>
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
