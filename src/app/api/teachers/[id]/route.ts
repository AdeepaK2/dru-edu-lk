import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/utils/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    // Extract teacherId from the URL
    const url = new URL(request.url);
    const paths = url.pathname.split('/');
    const teacherId = paths[paths.length - 1];

    if (!teacherId) {
      return NextResponse.json(
        { error: 'Teacher ID is required' },
        { status: 400 }
      );
    }

    // Fetch teacher document from Firestore
    const teacherDoc = await adminFirestore.collection('teachers').doc(teacherId).get();

    if (!teacherDoc.exists) {
      return NextResponse.json(
        { error: 'Teacher not found' },
        { status: 404 }
      );
    }

    // Return teacher data
    const teacherData = {
      id: teacherDoc.id,
      ...teacherDoc.data()
    } as any;

    return NextResponse.json(teacherData);

  } catch (error) {
    console.error('Error fetching teacher:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teacher data' },
      { status: 500 }
    );
  }
}
