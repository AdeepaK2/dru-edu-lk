// Create this API route: /api/admin/migrate
import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/utils/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    // Add some basic security
    const { secret } = await request.json();
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin already exists
    const existingAdmin = await adminFirestore
      .collection('admins')
      .where('email', '==', 'dru.coordinator@gmail.com')
      .get();

    if (!existingAdmin.empty) {
      return NextResponse.json({ 
        message: 'Admin already exists in production',
        id: existingAdmin.docs[0].id 
      });
    }

    // Create admin document
    const adminData = {
      email: "dru.coordinator@gmail.com",
      name: "Admin Adeepa",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const adminRef = await adminFirestore.collection('admins').add(adminData);
    
    console.log('✅ Admin created in production database with ID:', adminRef.id);

    return NextResponse.json({ 
      success: true, 
      message: 'Admin created successfully',
      id: adminRef.id 
    });

  } catch (error) {
    console.error('❌ Error creating admin:', error);
    return NextResponse.json({ 
      error: 'Failed to create admin',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
