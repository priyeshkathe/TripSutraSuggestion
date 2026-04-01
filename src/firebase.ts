import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Use environment variables (for Netlify/Production and local dev)
const env = (import.meta as any).env || {};
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || '',
  firestoreDatabaseId: env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)'
};

console.log("Firebase Config:", { ...firebaseConfig, apiKey: firebaseConfig.apiKey ? 'REDACTED' : 'MISSING' });
let app;
const isConfigValid = firebaseConfig.apiKey && firebaseConfig.apiKey !== '';
console.log("Is Firebase Config Valid?", isConfigValid);

if (isConfigValid) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    // Create a mock app if initialization fails
    app = { name: '[DEFAULT]', options: {}, automaticDataCollectionEnabled: false } as any;
  }
} else {
  console.warn("Firebase API Key is missing. Please check your environment variables.");
  // Create a mock app if config is missing
  app = { name: '[DEFAULT]', options: {}, automaticDataCollectionEnabled: false } as any;
}

export const auth = isConfigValid ? getAuth(app) : { currentUser: null, onAuthStateChanged: () => () => {} } as any;
export const db = isConfigValid ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : {} as any;
export const googleProvider = new GoogleAuthProvider();

export default app;
