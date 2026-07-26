import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "mock-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ndcc-admin-mock.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ndcc-admin-mock",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ndcc-admin-mock.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:00000000000000"
};

// Check if actual env keys are present
const isFirebaseConfigured = !!import.meta.env.VITE_FIREBASE_API_KEY;
if (!isFirebaseConfigured) {
  console.warn(
    "Firebase is running with placeholder configuration. Please set your environment variables in .env file."
  );
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
