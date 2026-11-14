import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const AI_STUDIO_FIRESTORE_DB_ID = 'ai-studio-99858c10-4c3d-4fe3-bbb2-82d618401bfb';
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const firestoreDatabaseId =
  (firebaseConfig as Record<string, string | undefined>).firestoreDatabaseId || AI_STUDIO_FIRESTORE_DB_ID;
export const ACTIVE_FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const ACTIVE_FIRESTORE_DB_ID = firestoreDatabaseId;
export const db = getFirestore(app, firestoreDatabaseId);
export const defaultDb = getFirestore(app);
export const auth = getAuth(app);

export function getSecondaryAuth() {
  const secondaryApp = getApps().find(a => a.name === 'caProvisioner') || initializeApp(firebaseConfig, 'caProvisioner');
  return getAuth(secondaryApp);
}

// Connection test on app load as required by the Firebase integration skill
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'system', 'connection_health'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline status:', error.message);
      return false;
    }
    // Any permission error or non-existence still means server responded
    return true;
  }
}
