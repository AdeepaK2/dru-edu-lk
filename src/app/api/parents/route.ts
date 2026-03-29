import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/utils/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const snapshot = await adminFirestore.collection('parents').get();

    const parents = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || data.parentName || 'Parent',
        email: data.email || '',
        phone: data.phone || '',
        status: data.status || 'active',
      };
    });

    return NextResponse.json({ parents });
  } catch (error: any) {
    console.error('Error fetching parents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch parents', details: error.message },
      { status: 500 }
    );
  }
}
