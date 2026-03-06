import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';

import firebaseAdmin from './src/utils/firebase-server';

async function main() {
  const email = "testdelete2@example.com";
  
  try {
    console.log(`Checking if ${email} exists...`);
    try {
      const user = await firebaseAdmin.authentication.getUserByEmail(email);
      console.log('User exists before creation!', user.uid);
      await firebaseAdmin.authentication.deleteUser(user.uid);
      console.log('Deleted pre-existing user');
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
         console.log('User does not exist before creation. Good.');
      } else {
         console.error('Error fetching user:', e);
      }
    }

    console.log('Creating user...');
    const created = await firebaseAdmin.authentication.createUser(email, 'testpassword', 'Test User');
    console.log('User created:', created.uid);

    console.log('Fetching user by email...');
    const fetched = await firebaseAdmin.authentication.getUserByEmail(email);
    console.log('Fetch successful:', fetched.uid);

    console.log('Deleting user...');
    await firebaseAdmin.authentication.deleteUser(created.uid);
    console.log('User deleted.');

    console.log('Verifying deletion...');
    try {
      await firebaseAdmin.authentication.getUserByEmail(email);
      console.log('ERROR: User still exists!');
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
         console.log('Deletion verified. User not found.');
      } else {
         console.error('Unexpected error:', e);
      }
    }
  } catch (error) {
    console.error('Script failed:', error);
  }
}

main();
