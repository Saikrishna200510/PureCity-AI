import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase/config';
import { DEFAULT_CITY } from '../utils/aqi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    let unsubscribeProfile = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!firebaseUser) {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      // Listen to user's Firestore profile document
      const userRef = doc(db, 'users', firebaseUser.uid);
      try {
        const existingSnap = await getDoc(userRef);
        if (!existingSnap.exists()) {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'Citizen User',
            photoURL: firebaseUser.photoURL || '',
            preferredCity: DEFAULT_CITY,
            preferredStandard: 'US',
            activityPreference: 'general',
            sensitivityGroup: 'standard',
            role: 'user',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error('Failed to ensure user profile document:', err);
      }

      unsubscribeProfile = onSnapshot(
        userRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setUserProfile({ id: snapshot.id, ...snapshot.data() });
          }
          setLoading(false);
        },
        (err) => {
          console.error('Profile listener error:', err);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  async function register({
    email,
    password,
    displayName,
    preferredCity = DEFAULT_CITY,
    activityPreference = 'general',
    sensitivityGroup = 'standard',
    preferredStandard = 'US',
  }) {
    if (!auth || !db) throw new Error('Firebase is not configured yet.');
    setAuthError(null);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    const userRef = doc(db, 'users', cred.user.uid);
    await setDoc(userRef, {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: displayName || email.split('@')[0],
      photoURL: cred.user.photoURL || '',
      preferredCity,
      preferredStandard,
      activityPreference,
      sensitivityGroup,
      role: 'user', // Strictly non-privileged default; admins cannot be self-assigned
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return cred.user;
  }

  async function login(email, password) {
    if (!auth) throw new Error('Firebase is not configured yet.');
    setAuthError(null);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }

  async function loginWithGoogle(preferredCity = DEFAULT_CITY) {
    if (!auth || !db) throw new Error('Firebase is not configured yet.');
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const userRef = doc(db, 'users', cred.user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: cred.user.uid,
        email: cred.user.email || '',
        displayName: cred.user.displayName || 'Citizen User',
        photoURL: cred.user.photoURL || '',
        preferredCity,
        preferredStandard: 'US',
        activityPreference: 'general',
        sensitivityGroup: 'standard',
        role: 'user',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return cred.user;
  }

  async function resetPassword(email) {
    if (!auth) throw new Error('Firebase is not configured yet.');
    setAuthError(null);
    await sendPasswordResetEmail(auth, email);
  }

  async function logout() {
    if (!auth) return;
    await signOut(auth);
  }

  async function updateUserProfile(updates) {
    if (!user || !db) throw new Error('You must be signed in to update your profile.');
    const allowedUpdates = {
      ...(updates.displayName !== undefined && { displayName: updates.displayName }),
      ...(updates.preferredCity !== undefined && { preferredCity: updates.preferredCity }),
      ...(updates.preferredStandard !== undefined && { preferredStandard: updates.preferredStandard }),
      ...(updates.activityPreference !== undefined && { activityPreference: updates.activityPreference }),
      ...(updates.sensitivityGroup !== undefined && { sensitivityGroup: updates.sensitivityGroup }),
      updatedAt: serverTimestamp(),
    };

    if (updates.displayName && auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: updates.displayName });
    }

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, allowedUpdates);
  }

  const isAdmin = userProfile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        authError,
        isAdmin,
        isFirebaseConfigured,
        register,
        login,
        loginWithGoogle,
        resetPassword,
        logout,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
