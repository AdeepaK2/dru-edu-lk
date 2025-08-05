import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
let adminApp: any;

try {
  // Check if Firebase Admin is already initialized
  if (getApps().length === 0) {
    // Initialize with service account key
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
    };

    adminApp = initializeApp({
      credential: cert(serviceAccount as any),
      databaseURL: "https://dru-edu-default-rtdb.asia-southeast1.firebasedatabase.app",
    });
  } else {
    adminApp = getApps()[0];
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error);
  throw error;
}

// Export Firebase Admin services
export const adminAuth = getAuth(adminApp);
export const adminFirestore = getFirestore(adminApp);
export { adminApp };
