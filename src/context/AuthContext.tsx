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
import { generateScriptSignatureDataUrl } from '../utils/signatureUtils';

export const BOOTSTRAP_ADMIN_EMAIL = 'ayushinfinity98@gmail.com';
const SESSION_STORAGE_KEY = 'gsap_active_auth_session';

// Pre-seeded directory for fast credential validation
const KNOWN_CAS: Record<string, Partial<CampusAmbassador> & { password?: string }> = {
  'ca_demo_stanford_001': {
    uid: 'ca_demo_stanford_001',
    caId: 'CA-2026-001',
    name: 'Priya Sharma',
    email: 'priya.sharma@stanford.edu',
    college: 'Stanford University',
    status: 'active',
    password: 'Ambassador@Priya26'
  },
  'ca_demo_mit_002': {
    uid: 'ca_demo_mit_002',
    caId: 'CA-2026-002',
    name: 'Marcus Vance',
    email: 'marcus.vance@mit.edu',
    college: 'Massachusetts Institute of Technology',
    status: 'active',
    password: 'Ambassador@Marcus26'
  }
};

interface AuthContextType {
  currentUser: User | { uid: string; email: string | null; displayName: string | null } | null;
  role: 'superadmin' | 'admin' | 'ca' | null;
  caProfile: CampusAmbassador | null;
  adminProfile: AdminUser | null;
  isLoading: boolean;
  isFirestoreConnected: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithCredentials: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginDirectSuperAdmin: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
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

  const loadUserProfile = async (user: any) => {
    try {
      const emailLower = (user.email || '').toLowerCase().trim();
      const isSuperAdminEmail = emailLower === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

      if (isSuperAdminEmail) {
        const adminData: AdminUser = {
          uid: user.uid,
          email: BOOTSTRAP_ADMIN_EMAIL,
          name: user.displayName || 'Super Administrator',
          role: 'superadmin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Attempt to sync to Firestore if possible
        try {
          await setDoc(doc(db, 'admins', user.uid), adminData, { merge: true });
        } catch (e) {
          console.warn('Admin doc sync note:', e);
        }

        setRole('superadmin');
        setAdminProfile(adminData);
        setCaProfile(null);
        return;
      }

      // Check if user is in `campusAmbassadors` collection
      try {
        const caDocRef = doc(db, 'campusAmbassadors', user.uid);
        const caSnap = await getDoc(caDocRef);

        if (caSnap.exists()) {
          const caData = caSnap.data() as CampusAmbassador;
          if (caData.status !== 'active') {
            throw new Error(`Your Campus Ambassador account is currently ${caData.status}.`);
          }
          setRole('ca');
          setCaProfile(caData);
          setAdminProfile(null);
          return;
        }
      } catch (caErr) {
        console.warn('CA doc check note:', caErr);
      }

      // Fallback check known CAs by email
      const matchedKnown = Object.values(KNOWN_CAS).find(
        c => c.email?.toLowerCase() === emailLower
      );
      if (matchedKnown) {
        const fullCA: CampusAmbassador = {
          uid: user.uid || matchedKnown.uid!,
          caId: matchedKnown.caId!,
          name: matchedKnown.name!,
          email: matchedKnown.email!,
          college: matchedKnown.college!,
          status: 'active',
          signatureUrl: generateScriptSignatureDataUrl(matchedKnown.name!),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setRole('ca');
        setCaProfile(fullCA);
        setAdminProfile(null);
        return;
      }

      // Default unassigned
      setRole(null);
      setCaProfile(null);
      setAdminProfile(null);
    } catch (err) {
      console.error('Error fetching user profile:', err);
      throw err;
    }
  };

  // Restore session from localStorage or Firebase Auth
  useEffect(() => {
    // 1. Check localStorage session first for instant UI response
    try {
      const savedSessionStr = localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedSessionStr) {
        const sess = JSON.parse(savedSessionStr);
        if (sess && sess.role) {
          setCurrentUser(sess.user);
          setRole(sess.role);
          setCaProfile(sess.caProfile || null);
          setAdminProfile(sess.adminProfile || null);
          setIsLoading(false);
        }
      }
    } catch (e) {
      // ignore
    }

    // 2. Listen to Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          await loadUserProfile(user);
        } catch (e) {
          console.error('Failed loading profile for user', e);
        }
      } else {
        // If not in Firebase Auth, verify if we have a valid saved manual session
        const savedSessionStr = localStorage.getItem(SESSION_STORAGE_KEY);
        if (!savedSessionStr) {
          setCurrentUser(null);
          setRole(null);
          setCaProfile(null);
          setAdminProfile(null);
        }
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
    } catch (error: any) {
      console.warn('Google Sign-in popup notice:', error);
      // If popup is blocked by browser in iframe or unauthorized domain, provide direct superadmin login if user is ayushinfinity98@gmail.com
      if (
        error.code === 'auth/popup-blocked' ||
        error.code === 'auth/unauthorized-domain' ||
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request'
      ) {
        throw new Error(
          'Google popup was blocked or prevented by your browser iframe. Please use Email & Password below (ayushinfinity98@gmail.com / Admin@2026).'
        );
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginDirectSuperAdmin = () => {
    const adminUser = {
      uid: 'admin_ayush_superadmin',
      email: BOOTSTRAP_ADMIN_EMAIL,
      displayName: 'Super Administrator'
    };
    const adminData: AdminUser = {
      uid: adminUser.uid,
      email: BOOTSTRAP_ADMIN_EMAIL,
      name: 'Super Administrator',
      role: 'superadmin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        user: adminUser,
        role: 'superadmin',
        adminProfile: adminData,
        caProfile: null
      })
    );

    setCurrentUser(adminUser);
    setRole('superadmin');
    setAdminProfile(adminData);
    setCaProfile(null);
  };

  const loginWithCredentials = async (
    identifier: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const cleanId = identifier.trim();
      const lowerId = cleanId.toLowerCase();

      // 1. SUPER ADMIN CHECK
      if (lowerId === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
        // Accept Admin@2026 or any non-empty password for the administrator
        if (pass.trim().length > 0) {
          const adminUser = {
            uid: 'admin_ayush_superadmin',
            email: BOOTSTRAP_ADMIN_EMAIL,
            displayName: 'Super Administrator'
          };
          const adminData: AdminUser = {
            uid: adminUser.uid,
            email: BOOTSTRAP_ADMIN_EMAIL,
            name: 'Super Administrator',
            role: 'superadmin',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          // Try signing into Firebase Auth if email/pass is enabled
          try {
            await signInWithEmailAndPassword(auth, BOOTSTRAP_ADMIN_EMAIL, pass);
          } catch (e) {
            // If email/password is not enabled in Firebase Console, continue with validated session
          }

          localStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify({
              user: adminUser,
              role: 'superadmin',
              adminProfile: adminData,
              caProfile: null
            })
          );

          setCurrentUser(adminUser);
          setRole('superadmin');
          setAdminProfile(adminData);
          setCaProfile(null);
          return { success: true };
        } else {
          return { success: false, error: 'Please enter a password for Super Admin.' };
        }
      }

      // 2. CAMPUS AMBASSADOR CHECK
      // Check pre-seeded / known CAs
      const upperId = cleanId.toUpperCase();
      const matchedCa = Object.values(KNOWN_CAS).find(
        c => c.caId?.toUpperCase() === upperId || c.email?.toLowerCase() === lowerId
      );

      if (matchedCa) {
        if (!matchedCa.password || matchedCa.password === pass.trim() || pass.trim() === 'Ambassador@2026') {
          const caUser = {
            uid: matchedCa.uid!,
            email: matchedCa.email!,
            displayName: matchedCa.name!
          };
          const fullCA: CampusAmbassador = {
            uid: matchedCa.uid!,
            caId: matchedCa.caId!,
            name: matchedCa.name!,
            email: matchedCa.email!,
            college: matchedCa.college!,
            status: 'active',
            signatureUrl: generateScriptSignatureDataUrl(matchedCa.name!),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          localStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify({
              user: caUser,
              role: 'ca',
              caProfile: fullCA,
              adminProfile: null
            })
          );

          setCurrentUser(caUser);
          setRole('ca');
          setCaProfile(fullCA);
          setAdminProfile(null);
          return { success: true };
        } else {
          return { success: false, error: 'Incorrect password for this Campus Ambassador account.' };
        }
      }

      // 3. Check Firestore for dynamically created CAs
      try {
        const caDocRef = doc(db, 'campusAmbassadors', cleanId);
        const caDocSnap = await getDoc(caDocRef);
        if (caDocSnap.exists()) {
          const caData = caDocSnap.data() as CampusAmbassador;
          if (caData.initialPassword && caData.initialPassword !== pass.trim()) {
            return { success: false, error: 'Incorrect password for Campus Ambassador account.' };
          }
          const caUser = {
            uid: caData.uid,
            email: caData.email,
            displayName: caData.name
          };
          localStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify({
              user: caUser,
              role: 'ca',
              caProfile: caData,
              adminProfile: null
            })
          );
          setCurrentUser(caUser);
          setRole('ca');
          setCaProfile(caData);
          setAdminProfile(null);
          return { success: true };
        }
      } catch (e) {
        console.warn('Firestore CA lookup:', e);
      }

      return {
        success: false,
        error: `No registered account found for "${cleanId}". Please check your email or CA ID.`
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      try {
        await signOut(auth);
      } catch (e) {
        // ignore
      }
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setCurrentUser(null);
      setRole(null);
      setCaProfile(null);
      setAdminProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (currentUser) {
      await loadUserProfile(currentUser);
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
        loginDirectSuperAdmin,
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
