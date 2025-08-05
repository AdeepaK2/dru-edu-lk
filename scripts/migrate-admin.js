const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "dru-edu",
  private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_ADMIN_CLIENT_EMAIL}`
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Function to create admin document in production database
async function createAdminInProduction() {
  try {
    // Get production database
    const productionDb = admin.firestore().databaseId = 'production';
    const db = admin.firestore();
    
    // Admin data
    const adminData = {
      email: "dru.coordinator@gmail.com",
      name: "Admin Adeepa",
      role: "admin",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Create admin document
    const adminRef = await db.collection('admins').add(adminData);
    console.log('✅ Admin document created in production database with ID:', adminRef.id);
    
    // Also create in users collection if you use that
    const userRef = await db.collection('users').doc('admin').set({
      ...adminData,
      uid: 'admin', // or the actual Firebase Auth UID
      type: 'admin'
    });
    console.log('✅ Admin user document created in production database');
    
  } catch (error) {
    console.error('❌ Error creating admin document:', error);
  } finally {
    process.exit(0);
  }
}

// Run the migration
createAdminInProduction();
