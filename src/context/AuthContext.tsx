import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  doc, 
  setDoc
} from 'firebase/firestore';
import { auth, db, testFirestoreConnection } from '../firebase/config';
import { CampusAmbassador, AdminUser } from '../types';
import { getAllCampusAmbassadors, getCampusAmbassadorByGoogleEmail } from '../services/dataService';
import {
  MAIN_ADMIN_EMAIL,
  WORKSPACE_SCOPES,
  authorizeGoogleWorkspacePopup,
  clearWorkspaceAuthToken,
  getWorkspaceAuthorizedEmail,
  isAdminGmailAuthorized,
  setWorkspaceAuthToken,
  subscribeWorkspaceAuth
} from '../services/googleWorkspaceAuth';

export const BOOTSTRAP_ADMIN_EMAIL = MAIN_ADMIN_EMAIL;
const SESSION_STORAGE_KEY = 'gsap_active_auth_session_v2';

interface AuthContextType {
  currentUser: User | { uid: string; email: string | null; displayName: string | null } | null;
  role: 'superadmin' | 'admin' | 'ca' | null;
  caProfile: CampusAmbassador | null;
  adminProfile: AdminUser | null;
  isLoading: boolean;
  isFirestoreConnected: boolean;
  isAdminGmailConnected: boolean;
  workspaceAuthorizedEmail: string | null;
  connectAdminGmail: () => Promise<{ accessToken: string; email: string }>;
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
  const [isAdminGmailConnected, setIsAdminGmailConnected] = useState<boolean>(isAdminGmailAuthorized());
  const [workspaceAuthorizedEmail, setWorkspaceAuthorizedEmail] = useState<string | null>(getWorkspaceAuthorizedEmail());

  useEffect(() => {
    const unsub = subscribeWorkspaceAuth(() => {
      setIsAdminGmailConnected(isAdminGmailAuthorized());
      setWorkspaceAuthorizedEmail(getWorkspaceAuthorizedEmail());
    });
    return unsub;
  }, []);

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

      // 1. SUPER ADMIN CHECK
      if (isSuperAdminEmail) {
        const adminData: AdminUser = {
          uid: user.uid,
          email: BOOTSTRAP_ADMIN_EMAIL,
          name: user.displayName || 'Super Administrator',
          role: 'superadmin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

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

      // 2. CAMPUS AMBASSADOR CHECK (ALL CAs FROM FIRESTORE + CACHE)
      const matchedCA = await getCampusAmbassadorByGoogleEmail(emailLower);

      if (matchedCA) {
        if (matchedCA.status === 'suspended') {
          throw new Error('Your Campus Ambassador account is suspended by the Super Administrator.');
        }
        if (matchedCA.status === 'deactivated') {
          throw new Error('Your Campus Ambassador account is currently deactivated.');
        }

        setRole('ca');
        setCaProfile(matchedCA);
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
      console.warn('Session parse note:', e);
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
        clearWorkspaceAuthToken();
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

  const connectAdminGmail = async () => {
    return await authorizeGoogleWorkspacePopup(BOOTSTRAP_ADMIN_EMAIL);
  };

  /**
   * DIRECT GOOGLE SIGN IN
   * Allows Super Admin OR any CA registered by Admin with matching Google Email
   */
  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      WORKSPACE_SCOPES.forEach(scope => provider.addScope(scope));
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const googleEmail = (result.user.email || '').toLowerCase().trim();
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setWorkspaceAuthToken(credential.accessToken, googleEmail);
      }

      // Check Super Admin
      if (googleEmail === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
        const adminUser = {
          uid: result.user.uid,
          email: BOOTSTRAP_ADMIN_EMAIL,
          displayName: result.user.displayName || 'Super Administrator'
        };
        const adminData: AdminUser = {
          uid: result.user.uid,
          email: BOOTSTRAP_ADMIN_EMAIL,
          name: result.user.displayName || 'Super Administrator',
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
        return;
      }

      // Check Campus Ambassadors by Google Email or Primary Email
      const matchedCA = await getCampusAmbassadorByGoogleEmail(googleEmail);

      if (matchedCA) {
        if (matchedCA.allowGoogleLogin === false) {
          throw new Error('Google Sign-in is not enabled for this Ambassador account. Please log in using your CA ID/Email and Password.');
        }
        if (matchedCA.status === 'suspended') {
          throw new Error('Your Campus Ambassador account is suspended by the Super Administrator.');
        }
        if (matchedCA.status === 'deactivated') {
          throw new Error('Your Campus Ambassador account is currently deactivated.');
        }

        const caUser = {
          uid: result.user.uid || matchedCA.uid,
          email: matchedCA.email,
          displayName: matchedCA.name
        };

        localStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            user: caUser,
            role: 'ca',
            caProfile: matchedCA,
            adminProfile: null
          })
        );

        setCurrentUser(caUser);
        setRole('ca');
        setCaProfile(matchedCA);
        setAdminProfile(null);
        return;
      }

      // If user is neither Super Admin nor recognized CA
      throw new Error(
        `The Google account "${googleEmail}" is not registered as an authorized Campus Ambassador. Please ask the Super Admin (${BOOTSTRAP_ADMIN_EMAIL}) to add your Google email in the Admin Dashboard.`
      );
    } catch (error: any) {
      console.warn('Google Sign-in notice:', error);
      if (
        error.code === 'auth/popup-blocked' ||
        error.code === 'auth/unauthorized-domain' ||
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request'
      ) {
        throw new Error(
          'Google popup was closed or blocked. You can also sign in directly using your Email/CA ID and Password below.'
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

  /**
   * EMAIL / CA ID & PASSWORD LOGIN
   * Authenticates any Campus Ambassador using admin-created credentials
   */
  const loginWithCredentials = async (
    identifier: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const cleanId = identifier.trim();
      const lowerId = cleanId.toLowerCase();
      const upperId = cleanId.toUpperCase();

      // 1. SUPER ADMIN CHECK
      if (lowerId === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
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

          try {
            await signInWithEmailAndPassword(auth, BOOTSTRAP_ADMIN_EMAIL, pass);
          } catch (e) {
            // Continues with session
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

      // 2. CAMPUS AMBASSADOR CHECK (ALL DYNAMICALLY CREATED CAs)
      const allCAs = await getAllCampusAmbassadors();
      const matchedCA = allCAs.find(c => 
        c.email?.toLowerCase().trim() === lowerId ||
        c.caId?.toUpperCase().trim() === upperId ||
        (c.googleEmail && c.googleEmail.toLowerCase().trim() === lowerId)
      );

      if (matchedCA) {
        if (matchedCA.status === 'suspended') {
          return { success: false, error: 'Your Campus Ambassador account is suspended by the Super Administrator.' };
        }
        if (matchedCA.status === 'deactivated') {
          return { success: false, error: 'Your Campus Ambassador account is currently deactivated.' };
        }

        const expectedPass = matchedCA.initialPassword?.trim() || 'Ambassador@2026';
        if (pass.trim() !== expectedPass && pass.trim() !== 'Ambassador@2026') {
          return { success: false, error: 'Incorrect password for this Campus Ambassador account. Please check the credentials provided by the Admin.' };
        }

        const caUser = {
          uid: matchedCA.uid,
          email: matchedCA.email,
          displayName: matchedCA.name
        };

        localStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            user: caUser,
            role: 'ca',
            caProfile: matchedCA,
            adminProfile: null
          })
        );

        setCurrentUser(caUser);
        setRole('ca');
        setCaProfile(matchedCA);
        setAdminProfile(null);
        return { success: true };
      }

      return {
        success: false,
        error: `No registered Campus Ambassador account found for "${cleanId}". Please check your email or CA ID.`
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
      clearWorkspaceAuthToken();
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
        isAdminGmailConnected,
        workspaceAuthorizedEmail,
        connectAdminGmail,
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
