// Simple script to check mail collection - using CommonJS
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

console.log('🔍 Firebase Mail Collection Diagnostic');
console.log('━'.repeat(60));
console.log('Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

// Use FIRESTORE_DATABASE_ID from env
const databaseId = process.env.FIRESTORE_DATABASE_ID || '(default)';
console.log('Database ID:', databaseId);
console.log('━'.repeat(60));

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  // Use the legacy FIREBASE_PRIVATE_KEY since it's properly formatted
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

  console.log('Client Email:', clientEmail?.substring(0, 30) + '...');

  if (!privateKey) {
    console.error('❌ FIREBASE_PRIVATE_KEY not found in environment');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail: clientEmail,
    }),
  });
}

// Get Firestore with specific database ID
const db = admin.firestore();
db.settings({ databaseId: databaseId });

async function checkMailCollection() {
  try {
    console.log('\n📬 Querying mail collection...\n');

    const snapshot = await db.collection('mail').limit(15).get();

    if (snapshot.empty) {
      console.log('❌ No documents found in mail collection!');
      console.log('   Possible causes:');
      console.log('   - No emails queued yet');
      console.log('   - Wrong database');
      console.log('   - Collection name mismatch');
      return;
    }

    console.log(`Found ${snapshot.size} email documents:\n`);

    let stats = { success: 0, error: 0, pending: 0, notProcessed: 0 };
    let welcomeEmails = [];
    let otherEmails = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const subject = data.message?.subject || '';
      const isWelcome = subject.includes('Welcome') || subject.includes('Account');

      if (isWelcome) {
        welcomeEmails.push({ id: doc.id, to: data.to, subject, delivery: data.delivery });
      } else {
        otherEmails.push({ id: doc.id, to: data.to, subject, delivery: data.delivery });
      }

      if (data.delivery) {
        const state = data.delivery.state;
        if (state === 'SUCCESS') stats.success++;
        else if (state === 'ERROR') stats.error++;
        else stats.pending++;
      } else {
        stats.notProcessed++;
      }
    });

    // Show welcome emails first
    console.log('━'.repeat(60));
    console.log(`🎓 STUDENT/TEACHER WELCOME EMAILS: ${welcomeEmails.length}`);
    console.log('━'.repeat(60));

    if (welcomeEmails.length === 0) {
      console.log('⚠️  NO WELCOME EMAILS FOUND!');
      console.log('   This means student creation is NOT queuing emails.');
    } else {
      welcomeEmails.slice(0, 10).forEach(e => {
        const state = e.delivery?.state || 'NOT_PROCESSED';
        const icon = state === 'SUCCESS' ? '✅' : state === 'ERROR' ? '❌' : '⏳';
        console.log(`${icon} ${e.to} - ${state}`);
        if (e.delivery?.error) console.log(`   Error: ${e.delivery.error}`);
      });
    }

    console.log('\n━'.repeat(60));
    console.log(`📨 OTHER EMAILS: ${otherEmails.length}`);
    console.log('━'.repeat(60));
    otherEmails.slice(0, 5).forEach(e => {
      const state = e.delivery?.state || 'NOT_PROCESSED';
      console.log(`${e.subject?.substring(0, 40)}... - ${state}`);
    });

    console.log('\n━'.repeat(60));
    console.log('📊 SUMMARY:');
    console.log(`   ✅ Success: ${stats.success}`);
    console.log(`   ❌ Errors: ${stats.error}`);
    console.log(`   ⏳ Pending: ${stats.pending}`);
    console.log(`   ⚠️  Not Processed: ${stats.notProcessed}`);

    if (stats.notProcessed > 0) {
      console.log('\n🔴 DIAGNOSIS: Some emails have no delivery info!');
      console.log('   This means Firebase Trigger Email extension is either:');
      console.log('   1. NOT INSTALLED - Install from Firebase Console > Extensions');
      console.log('   2. NOT CONFIGURED - Check that it listens to "mail" collection');
      console.log('   3. DISABLED - Re-enable the extension');
    }

    if (stats.error > 0) {
      console.log('\n🔴 DIAGNOSIS: Some emails failed!');
      console.log('   Check SMTP credentials and sender email verification');
    }

    if (stats.success > 0 && stats.error === 0 && stats.notProcessed === 0) {
      console.log('\n🟢 DIAGNOSIS: Emails are being sent successfully!');
      console.log('   If not receiving, check:');
      console.log('   - Spam/Junk folder');
      console.log('   - Email address is correct');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'permission-denied') {
      console.log('   Check Firebase Admin credentials');
    }
  }
}

checkMailCollection().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
