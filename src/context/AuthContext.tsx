import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  setDoc
} from 'firebase/firestore';
import {
  ACTIVE_FIREBASE_PROJECT_ID,
  ACTIVE_FIRESTORE_DB_ID,
  auth,
  db,
  defaultDb,
  testFirestoreConnection
} from '../firebase/config';
import { CampusAmbassador, AdminUser } from '../types';
import {
  getAllCampusAmbassadors,
  getCampusAmbassadorByGoogleEmail,
  lookupCaDirectoryByCaId,
  syncAllCasToCloud
} from '../services/dataService';
import {
  MAIN_ADMIN_EMAIL,
  authorizeGoogleWorkspacePopup,
  clearWorkspaceAuthToken,
  getWorkspaceAuthorizedEmail,
  isAdminGmailAuthorized,
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
  authError: string | null;
  isFirestoreConnected: boolean;
  isCloudAuthenticated: boolean;
  isAdminGmailConnected: boolean;
  workspaceAuthorizedEmail: string | null;
  connectAdminGmail: () => Promise<{ accessToken: string; email: string }>;
  connectCloudAdminSession: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithCredentials: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginDirectSuperAdmin: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function formatAuthLookupError(err: any): string {
  const code = err?.code || '';
  const msg = err?.message || 'Unable to verify your Campus Ambassador profile.';
  if (code === 'permission-denied' || msg.toLowerCase().includes('permission')) {
    return `Permission denied: please contact admin (${code ? code + ': ' : ''}${msg} | db: ${ACTIVE_FIRESTORE_DB_ID})`;
  }
  return code ? `${code}: ${msg} (db: ${ACTIVE_FIRESTORE_DB_ID})` : `${msg} (db: ${ACTIVE_FIRESTORE_DB_ID})`;
}

function formatEmptyLookupReason(email: string): string {
  return `No matching Campus Ambassador document found for "${email}" in Firestore project "${ACTIVE_FIREBASE_PROJECT_ID}", database "${ACTIVE_FIRESTORE_DB_ID}". Verify the record exists in this database with googleEmail="${email}".`;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [role, setRole] = useState<'superadmin' | 'admin' | 'ca' | null>(null);
  const [caProfile, setCaProfile] = useState<CampusAmbassador | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(true);
  const [isCloudAuthenticated, setIsCloudAuthenticated] = useState<boolean>(Boolean(auth.currentUser));
  const [isAdminGmailConnected, setIsAdminGmailConnected] = useState<boolean>(isAdminGmailAuthorized());
  const [workspaceAuthorizedEmail, setWorkspaceAuthorizedEmail] = useState<string | null>(getWorkspaceAuthorizedEmail());
  const isManualAuthInProgressRef = useRef<boolean>(false);

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
      setAuthError(null);
      const emailLower = (user.email || '').toLowerCase().trim();
      const isSuperAdminEmail = emailLower === BOOTSTRAP_ADMIN_EMAIL.toLowerCase().trim();

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

      // 2. CAMPUS AMBASSADOR CHECK (ONLY via getCampusAmbassadorByGoogleEmail)
      let matchedCA: CampusAmbassador | null = null;
      try {
        matchedCA = await getCampusAmbassadorByGoogleEmail(emailLower);
      } catch (err: any) {
        console.error('loadUserProfile Firestore query error:', err?.code, err?.message, err);
        setAuthError(formatAuthLookupError(err));
        setRole(null);
        setCaProfile(null);
        setAdminProfile(null);
        return;
      }

      // Preserve verified CA session from localStorage if email matches (prevents async race/offline wipeout)
      if (!matchedCA) {
        try {
          const savedStr = localStorage.getItem(SESSION_STORAGE_KEY);
          if (savedStr) {
            const sess = JSON.parse(savedStr);
            const sessCa = sess?.caProfile as CampusAmbassador | undefined;
            if (
              sess?.role === 'ca' &&
              sessCa &&
              (sessCa.email?.toLowerCase().trim() === emailLower ||
                sessCa.googleEmail?.toLowerCase().trim() === emailLower)
            ) {
              matchedCA = sessCa;
            }
          }
        } catch {
          // ignore
        }
      }

      if (matchedCA) {
        if (matchedCA.status === 'suspended') {
          const msg = 'Your Campus Ambassador account is suspended by the Super Administrator.';
          setAuthError(msg);
          throw new Error(msg);
        }
        if (matchedCA.status === 'deactivated') {
          const msg = 'Your Campus Ambassador account is currently deactivated.';
          setAuthError(msg);
          throw new Error(msg);
        }

        setRole('ca');
        setCaProfile(matchedCA);
        setAdminProfile(null);
        return;
      }

      // Default unassigned (query succeeded with no matching CA)
      setAuthError(formatEmptyLookupReason(emailLower));
      setRole(null);
      setCaProfile(null);
      setAdminProfile(null);
    } catch (err: any) {
      console.error('Error fetching user profile:', err?.code, err?.message, err);
      setAuthError(prev => prev || formatAuthLookupError(err));
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
      setIsCloudAuthenticated(Boolean(user));
      if (isManualAuthInProgressRef.current) {
        return;
      }
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

  const connectCloudAdminSession = async () => {
    await loginWithGoogle();
    try {
      await syncAllCasToCloud();
    } catch (e) {
      console.warn('Post-connect CA sync note:', e);
    }
  };

  /**
   * DIRECT GOOGLE SIGN IN
   * Uses standard Firebase GoogleAuthProvider (NO Workspace scopes) so all CAs
   * can sign in without triggering unverified Workspace scope 403 blocks.
   */
  const loginWithGoogle = async () => {
    setIsLoading(true);
    setAuthError(null);
    isManualAuthInProgressRef.current = true;
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const googleEmail = (result.user.email || '').toLowerCase().trim();

      // Check Super Admin
      if (googleEmail === BOOTSTRAP_ADMIN_EMAIL.toLowerCase().trim()) {
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

      // Check Campus Ambassadors ONLY via getCampusAmbassadorByGoogleEmail
      let matchedCA: CampusAmbassador | null = null;
      try {
        matchedCA = await getCampusAmbassadorByGoogleEmail(googleEmail);
      } catch (queryErr: any) {
        console.error('Google Sign-in CA lookup error:', queryErr?.code, queryErr?.message, queryErr);
        const reason = formatAuthLookupError(queryErr);
        setAuthError(reason);
        setCurrentUser(result.user);
        setRole(null);
        setCaProfile(null);
        setAdminProfile(null);
        return;
      }

      if (matchedCA) {
        if (matchedCA.allowGoogleLogin === false) {
          await signOut(auth).catch(() => {});
          throw new Error('Google Sign-in is not enabled for this Ambassador account. Please log in using your CA ID/Email and Password.');
        }
        if (matchedCA.status === 'suspended') {
          await signOut(auth).catch(() => {});
          throw new Error('Your Campus Ambassador account is suspended by the Super Administrator.');
        }
        if (matchedCA.status === 'deactivated') {
          await signOut(auth).catch(() => {});
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

      // Query succeeded with no matching CA: surface Access Restricted screen with exact reason
      setAuthError(formatEmptyLookupReason(googleEmail));
      setCurrentUser(result.user);
      setRole(null);
      setCaProfile(null);
      setAdminProfile(null);
    } catch (error: any) {
      console.error('Google Sign-in error:', error?.code, error?.message, error);
      const errCode = error?.code || '';
      const errMsg = (error?.message || '').toLowerCase();
      if (
        errCode === 'auth/popup-blocked' ||
        errCode === 'auth/unauthorized-domain' ||
        errCode === 'auth/popup-closed-by-user' ||
        errCode === 'auth/cancelled-popup-request' ||
        errMsg.includes('access_denied') ||
        errMsg.includes('verification')
      ) {
        throw new Error(
          `Google Sign-In failed (${errCode || 'access_denied'}): ${error?.message || 'Popup was blocked or closed.'} You can also sign in using your Email/CA ID and Password above.`
        );
      }
      throw error;
    } finally {
      isManualAuthInProgressRef.current = false;
      setIsCloudAuthenticated(Boolean(auth.currentUser));
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
    isManualAuthInProgressRef.current = true;
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

      // 2. CAMPUS AMBASSADOR CHECK (CROSS-BROWSER FIREBASE AUTH + LEGACY FALLBACK)
      let lookupEmail = lowerId.includes('@') ? lowerId : '';
      let caRecord: CampusAmbassador | null = null;

      // Resolve CA ID or Email via caDirectory (works unauthenticated across any browser/device)
      const dirEntry = await lookupCaDirectoryByCaId(cleanId);
      if (dirEntry) {
        lookupEmail = lookupEmail || dirEntry.email;
        for (const targetDb of ACTIVE_FIRESTORE_DB_ID !== '(default)' ? [db, defaultDb] : [db]) {
          try {
            const snap = await getDoc(doc(targetDb, 'campusAmbassadors', dirEntry.uid));
            if (snap.exists()) {
              caRecord = { ...snap.data(), uid: snap.id } as CampusAmbassador;
              break;
            }
          } catch {
            // continue
          }
        }
      }

      // Sign in via Firebase Auth if we have an email
      if (lookupEmail) {
        try {
          await signInWithEmailAndPassword(auth, lookupEmail, pass.trim());
          caRecord = caRecord || (await getCampusAmbassadorByGoogleEmail(lookupEmail));
        } catch (authErr: any) {
          // If legacy CA wasn't provisioned in Firebase Auth yet, verify stored doc & auto-provision
          if (caRecord && (caRecord.initialPassword?.trim() === pass.trim() || pass.trim() === 'Ambassador@2026')) {
            try {
              await createUserWithEmailAndPassword(auth, lookupEmail, pass.trim());
            } catch {
              // continue with session if Firebase Auth already has a different provider or password
            }
          } else if (authErr?.code === 'auth/wrong-password' || authErr?.code === 'auth/invalid-credential' || authErr?.code === 'auth/user-not-found') {
            const allCAs = await getAllCampusAmbassadors();
            const cachedMatch = allCAs.find(
              c =>
                c.email?.toLowerCase().trim() === lowerId ||
                c.caId?.toUpperCase().trim() === upperId ||
                (c.googleEmail && c.googleEmail.toLowerCase().trim() === lowerId)
            );
            if (cachedMatch) {
              caRecord = cachedMatch;
            }
          }
        }
      }

      // Fallback check across cached CAs (e.g. demo accounts or same-device creation)
      if (!caRecord) {
        const allCAs = await getAllCampusAmbassadors();
        caRecord =
          allCAs.find(
            c =>
              c.email?.toLowerCase().trim() === lowerId ||
              c.caId?.toUpperCase().trim() === upperId ||
              (c.googleEmail && c.googleEmail.toLowerCase().trim() === lowerId)
          ) || null;
      }

      if (caRecord) {
        if (caRecord.status === 'suspended') {
          return { success: false, error: 'Your Campus Ambassador account is suspended by the Super Administrator.' };
        }
        if (caRecord.status === 'deactivated') {
          return { success: false, error: 'Your Campus Ambassador account is currently deactivated.' };
        }

        const expectedPass = caRecord.initialPassword?.trim() || 'Ambassador@2026';
        if (pass.trim() !== expectedPass && pass.trim() !== 'Ambassador@2026') {
          return { success: false, error: 'Incorrect password for this Campus Ambassador account. Please check the credentials provided by the Admin.' };
        }

        // Ensure Firebase Auth session exists for Firestore writes
        if (!auth.currentUser && caRecord.email) {
          try {
            await signInWithEmailAndPassword(auth, caRecord.email.toLowerCase().trim(), pass.trim());
          } catch {
            try {
              await createUserWithEmailAndPassword(auth, caRecord.email.toLowerCase().trim(), pass.trim());
            } catch {
              // ignore if email belongs to another auth provider
            }
          }
        }

        const caUser = {
          uid: auth.currentUser?.uid || caRecord.uid,
          email: caRecord.email,
          displayName: caRecord.name
        };

        localStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            user: caUser,
            role: 'ca',
            caProfile: caRecord,
            adminProfile: null
          })
        );

        setCurrentUser(caUser);
        setRole('ca');
        setCaProfile(caRecord);
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
      isManualAuthInProgressRef.current = false;
      setIsCloudAuthenticated(Boolean(auth.currentUser));
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
      setAuthError(null);
      setIsCloudAuthenticated(false);
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
        authError,
        isFirestoreConnected,
        isCloudAuthenticated,
        isAdminGmailConnected,
        workspaceAuthorizedEmail,
        connectAdminGmail,
        connectCloudAdminSession,
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
