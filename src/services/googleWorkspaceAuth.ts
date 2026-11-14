import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase/config';

export const MAIN_ADMIN_EMAIL = 'ayushinfinity98@gmail.com';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/presentations.readonly'
] as const;

// Strictly in-memory token storage (never stored in localStorage, sessionStorage, or Firestore)
let inMemoryAccessToken: string | null = null;
let inMemoryAuthorizedEmail: string | null = null;
let inMemoryExpiresAt = 0;

type TokenListener = () => void;
const listeners = new Set<TokenListener>();

function notifyListeners() {
  listeners.forEach(fn => {
    try {
      fn();
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeWorkspaceAuth(listener: TokenListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setWorkspaceAuthToken(token: string | null, email?: string | null) {
  if (!token) {
    clearWorkspaceAuthToken();
    return;
  }
  inMemoryAccessToken = token;
  inMemoryAuthorizedEmail = email ? email.toLowerCase().trim() : null;
  // Google OAuth access tokens typically last 60 minutes; refresh proactively after 55 minutes
  inMemoryExpiresAt = Date.now() + 55 * 60 * 1000;
  notifyListeners();
}

export function clearWorkspaceAuthToken() {
  inMemoryAccessToken = null;
  inMemoryAuthorizedEmail = null;
  inMemoryExpiresAt = 0;
  notifyListeners();
}

export function getWorkspaceAuthToken(): string | null {
  if (!inMemoryAccessToken) return null;
  if (inMemoryExpiresAt > 0 && Date.now() > inMemoryExpiresAt) {
    clearWorkspaceAuthToken();
    return null;
  }
  return inMemoryAccessToken;
}

export function getWorkspaceAuthorizedEmail(): string | null {
  return getWorkspaceAuthToken() ? inMemoryAuthorizedEmail : null;
}

export function isAdminGmailAuthorized(): boolean {
  const token = getWorkspaceAuthToken();
  const email = getWorkspaceAuthorizedEmail();
  return Boolean(token && email === MAIN_ADMIN_EMAIL.toLowerCase());
}

/**
 * Prompts Google Sign-In popup requesting Gmail send & Google Slides read permissions,
 * keeping the resulting OAuth access token strictly in memory.
 */
export async function authorizeGoogleWorkspacePopup(
  loginHint?: string
): Promise<{ accessToken: string; email: string }> {
  const provider = new GoogleAuthProvider();
  WORKSPACE_SCOPES.forEach(scope => provider.addScope(scope));
  provider.setCustomParameters({
    prompt: 'consent select_account',
    ...(loginHint ? { login_hint: loginHint } : {})
  });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;
  const email = (result.user?.email || '').toLowerCase().trim();

  if (!accessToken) {
    throw new Error('Google authorization completed, but no Workspace access token was returned. Please try again and allow Gmail and Google Slides access.');
  }

  setWorkspaceAuthToken(accessToken, email);
  return { accessToken, email };
}
