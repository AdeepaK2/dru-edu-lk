// Add this to your admin panel or run as a one-time script
// Make sure you're running with production environment variables

import { adminFirestore } from '@/utils/firebase-admin';

export async function createProductionAdmin() {
  try {
    const adminData = {
      email: "dru.coordinator@gmail.com",
      name: "Admin Adeepa",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create admin document
    const adminRef = await adminFirestore.collection('admins').add(adminData);
    console.log('✅ Admin created in production with ID:', adminRef.id);

    return { success: true, id: adminRef.id };
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// If running as a script
if (require.main === module) {
  createProductionAdmin().then(() => process.exit(0));
}
