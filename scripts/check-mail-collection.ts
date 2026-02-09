// Diagnostic script to check the Firebase mail collection status
// Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/check-mail-collection.ts

import * as admin from 'firebase-admin';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  const serviceAccount = {
    type: 'service_account',
    project_id: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

async function checkMailCollection() {
  console.log('🔍 Checking Firebase mail collection...\n');
  
  try {
    // Get recent mail documents (last 20)
    const mailSnapshot = await db.collection('mail')
      .orderBy('delivery.startTime', 'desc')
      .limit(20)
      .get();
    
    if (mailSnapshot.empty) {
      // Try without ordering (in case delivery field doesn't exist)
      const allMailSnapshot = await db.collection('mail').limit(20).get();
      
      if (allMailSnapshot.empty) {
        console.log('❌ No documents found in the mail collection!');
        console.log('   This means either:');
        console.log('   1. No emails have been queued yet');
        console.log('   2. The mail collection name is different');
        console.log('   3. You are connected to a different database');
        return;
      }
      
      console.log(`📬 Found ${allMailSnapshot.size} email documents (unordered):\n`);
      
      allMailSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('━'.repeat(60));
        console.log(`📧 Document ID: ${doc.id}`);
        console.log(`   To: ${data.to}`);
        console.log(`   Subject: ${data.message?.subject || 'N/A'}`);
        
        if (data.delivery) {
          console.log(`   📤 Delivery Status:`);
          console.log(`      - State: ${data.delivery.state || 'unknown'}`);
          console.log(`      - Attempts: ${data.delivery.attempts || 0}`);
          console.log(`      - Start Time: ${data.delivery.startTime?.toDate?.() || 'N/A'}`);
          console.log(`      - End Time: ${data.delivery.endTime?.toDate?.() || 'N/A'}`);
          
          if (data.delivery.error) {
            console.log(`   ❌ Error: ${data.delivery.error}`);
          }
          if (data.delivery.info) {
            console.log(`   ℹ️  Info: ${JSON.stringify(data.delivery.info)}`);
          }
        } else {
          console.log(`   ⏳ No delivery info - email may be pending or extension not configured`);
        }
        console.log('');
      });
      return;
    }
    
    console.log(`📬 Found ${mailSnapshot.size} email documents:\n`);
    
    let successCount = 0;
    let errorCount = 0;
    let pendingCount = 0;
    
    mailSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('━'.repeat(60));
      console.log(`📧 Document ID: ${doc.id}`);
      console.log(`   To: ${data.to}`);
      console.log(`   Subject: ${data.message?.subject || 'N/A'}`);
      
      if (data.delivery) {
        const state = data.delivery.state || 'unknown';
        console.log(`   📤 Delivery Status:`);
        console.log(`      - State: ${state}`);
        console.log(`      - Attempts: ${data.delivery.attempts || 0}`);
        
        if (state === 'SUCCESS') {
          successCount++;
          console.log(`   ✅ Email sent successfully!`);
        } else if (state === 'ERROR') {
          errorCount++;
          console.log(`   ❌ Error: ${data.delivery.error || 'Unknown error'}`);
        } else if (state === 'PENDING' || state === 'PROCESSING') {
          pendingCount++;
          console.log(`   ⏳ Email is ${state.toLowerCase()}...`);
        }
        
        if (data.delivery.leaseExpireTime) {
          console.log(`      - Lease Expires: ${data.delivery.leaseExpireTime.toDate()}`);
        }
      } else {
        pendingCount++;
        console.log(`   ⏳ No delivery info - waiting to be processed`);
      }
      console.log('');
    });
    
    console.log('━'.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⏳ Pending: ${pendingCount}`);
    
    if (pendingCount > 0 && successCount === 0 && errorCount === 0) {
      console.log('\n⚠️  All emails are pending! This likely means:');
      console.log('   1. Firebase Trigger Email extension is NOT installed');
      console.log('   2. Extension is not configured to listen to "mail" collection');
      console.log('   3. SMTP configuration is missing or incorrect');
      console.log('\n   Check: Firebase Console > Extensions > Trigger Email');
    }
    
    if (errorCount > 0) {
      console.log('\n⚠️  Some emails failed! Common causes:');
      console.log('   1. SMTP credentials expired or incorrect');
      console.log('   2. Sender email not verified');
      console.log('   3. Email quota exceeded');
    }
    
  } catch (error: any) {
    console.error('❌ Error querying mail collection:', error.message);
    
    if (error.code === 'failed-precondition') {
      console.log('\n💡 Index required. Try without ordering...');
      
      const simpleSnapshot = await db.collection('mail').limit(10).get();
      console.log(`Found ${simpleSnapshot.size} documents without ordering.`);
      
      simpleSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`- ${doc.id}: to=${data.to}, delivery.state=${data.delivery?.state || 'no delivery info'}`);
      });
    }
  }
}

// Run the check
checkMailCollection()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
