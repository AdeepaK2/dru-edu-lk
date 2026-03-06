import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import firebaseAdmin from './src/utils/firebase-server';

async function main() {
  const email = "euvanesh15@gmail.com";
  
  try {
    console.log(`Checking if ${email} exists...`);
    try {
      const user = await firebaseAdmin.authentication.getUserByEmail(email);
      console.log('User exists in Auth!', user.uid);
      
      const firestoreDoc = await firebaseAdmin.firestore.getDoc('students', user.uid);
      
      if (firestoreDoc) {
        console.log('User ALSO exists in Firestore!', firestoreDoc);
      } else {
        console.log('User DOES NOT exist in Firestore. This is an orphaned user.');
      }
      
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
         console.log('User does not exist in Auth.');
      } else {
         console.error('Error fetching user:', e);
      }
    }

  } catch (error) {
    console.error('Script failed:', error);
  }
}

main();
