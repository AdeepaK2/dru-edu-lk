import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { getDatabase } from 'firebase/database';

const MELBOURNE_TIMEZONE = 'Australia/Melbourne';

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: "https://dru-edu-default-rtdb.asia-southeast1.firebasedatabase.app",
};

// Initialize Firebase only if there are no apps already initialized
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firebase services
const auth = getAuth(app);
const firestore = getFirestore(app, process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || '(default)');
const storage = getStorage(app);
const realtimeDb = getDatabase(app);

// Initialize Analytics only on the client side
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

const googleProvider = new GoogleAuthProvider();
export { app, auth, firestore, storage, analytics, realtimeDb, googleProvider };