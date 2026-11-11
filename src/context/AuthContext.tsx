import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db, testFirestoreConnection } from '../firebase/config';
import { CampusAmbassador, AdminUser } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/errors';

export const BOOTSTRAP_ADMIN_EMAIL = 'ayushinfinity98@gmail.com';

interface AuthContextType {
  currentUser: User | null;
  role: 'superadmin' | 'admin' | 'ca' | null;
  caProfile: CampusAmbassador | null;
  adminProfile: AdminUser | null;
  isLoading: boolean;
  isFirestoreConnected: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithCredentials: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [role, setRole] = useState<'superadmin' | 'admin' | 'ca' | null>(null);
  const [caProfile, setCaProfile] = useState<CampusAmbassador | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(true);

  // Initialize and check Firestore connection
  useEffect(() => {
    testFirestoreConnection().then(connected => {
      setIsFirestoreConnected(connected);
    });
  }, []);

  const loadUserProfile = async (user: User) => {
    try {
      const emailLower = user.email?.toLowerCase();
      const isSuperAdminEmail = emailLower === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

      // 1. Check if user is in `admins` collection or has bootstrap email
      const adminDocRef = doc(db, 'admins', user.uid);
      const adminSnap = await getDoc(adminDocRef);

      if (adminSnap.exists() || isSuperAdminEmail) {
        const adminData = adminSnap.exists() ? adminSnap.data() as AdminUser : {
          uid: user.uid,
          email: user.email || BOOTSTRAP_ADMIN_EMAIL,
          name: user.displayName || 'Google Super Administrator',
          role: 'superadmin' as const,
        };

        // If not already in firestore, seed the admin document
        if (!adminSnap.exists()) {
          try {
            await setDoc(adminDocRef, {
              ...adminData,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } catch (e) {
            console.warn('Could not auto-seed admin doc:', e);
          }
        }

        setRole(adminData.role || 'superadmin');
        setAdminProfile(adminData);
        setCaProfile(null);
        return;
      }

      // 2. Check if user is in `campusAmbassadors` collection
      const caDocRef = doc(db, 'campusAmbassadors', user.uid);
      const caSnap = await getDoc(caDocRef);

      if (caSnap.exists()) {
        const caData = caSnap.data() as CampusAmbassador;
        if (caData.status !== 'active') {
          throw new Error(`Your Campus Ambassador account is currently ${caData.status}. Please contact the Super Admin.`);
        }
        setRole('ca');
        setCaProfile(caData);
        setAdminProfile(null);
        return;
      }

      // 3. Fallback: check by email in campusAmbassadors in case UID differed (e.g. email pre-created)
      if (user.email) {
        const caQuery = query(collection(db, 'campusAmbassadors'), where('email', '==', user.email.toLowerCase()));
        const caQuerySnap = await getDocs(caQuery);
        if (!caQuerySnap.empty) {
          const matchedDoc = caQuerySnap.docs[0];
          const caData = matchedDoc.data() as CampusAmbassador;
          if (caData.status !== 'active') {
            throw new Error(`Your Campus Ambassador account is currently ${caData.status}. Please contact the Super Admin.`);
          }
          // Link UID if it was placeholder
          if (matchedDoc.id !== user.uid) {
            await setDoc(doc(db, 'campusAmbassadors', user.uid), {
              ...caData,
              uid: user.uid,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
          setRole('ca');
          setCaProfile({ ...caData, uid: user.uid });
          setAdminProfile(null);
          return;
        }
      }

      // Not recognized as Admin or CA
      setRole(null);
      setCaProfile(null);
      setAdminProfile(null);
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setRole(null);
      setCaProfile(null);
      setAdminProfile(null);
      throw err;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          await loadUserProfile(user);
        } catch (e) {
          console.error('Failed loading profile for logged in user', e);
        }
      } else {
        setRole(null);
        setCaProfile(null);
        setAdminProfile(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      await loadUserProfile(result.user);
    } catch (error) {
      console.error('Google Sign-in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithCredentials = async (identifier: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const trimmedId = identifier.trim().toLowerCase();

      // Check if identifier is a CA ID or email
      let emailToUse = trimmedId;
      if (!trimmedId.includes('@')) {
        // Query CA by caId
        const caQ = query(collection(db, 'campusAmbassadors'), where('caId', '==', identifier.trim().toUpperCase()));
        const caSnap = await getDocs(caQ);
        if (caSnap.empty) {
          return { success: false, error: `No Campus Ambassador found with ID "${identifier}".` };
        }
        emailToUse = caSnap.docs[0].data().email.toLowerCase();
      }

      // 1. Try Firebase Authentication first
      try {
        const userCred = await signInWithEmailAndPassword(auth, emailToUse, pass);
        await loadUserProfile(userCred.user);
        return { success: true };
      } catch (authErr: any) {
        // If password was wrong or user not in Firebase Auth, check if credentials match initial provisioned account
        const caQ = query(collection(db, 'campusAmbassadors'), where('email', '==', emailToUse));
        const caSnap = await getDocs(caQ);
        if (!caSnap.empty) {
          const caData = caSnap.docs[0].data() as CampusAmbassador;
          if (caData.initialPassword && caData.initialPassword === pass) {
            // If Firebase Auth user hasn't been created yet, create it on first successful login
            try {
              const newCred = await createUserWithEmailAndPassword(auth, emailToUse, pass);
              await setDoc(doc(db, 'campusAmbassadors', newCred.user.uid), {
                ...caData,
                uid: newCred.user.uid,
                updatedAt: new Date().toISOString()
              }, { merge: true });
              await loadUserProfile(newCred.user);
              return { success: true };
            } catch (createErr) {
              // User might already exist in auth, let's try sign in again or report
              console.warn('Create Auth account fallback:', createErr);
            }
          }
        }

        // Check if admin bootstrap credentials
        if (emailToUse === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() && pass === 'Admin@2026') {
          try {
            const adminCred = await createUserWithEmailAndPassword(auth, emailToUse, pass);
            await loadUserProfile(adminCred.user);
            return { success: true };
          } catch (createAdminErr) {
            // Already created, wrong password
          }
        }

        return { success: false, error: authErr.message || 'Invalid email/CA ID or password.' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      setCurrentUser(null);
      setRole(null);
      setCaProfile(null);
      setAdminProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (auth.currentUser) {
      await loadUserProfile(auth.currentUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        caProfile,
        adminProfile,
        isLoading,
        isFirestoreConnected,
        loginWithGoogle,
        loginWithCredentials,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
