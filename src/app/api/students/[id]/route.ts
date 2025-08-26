import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/utils/firebase-admin';


export async function GET(request: NextRequest) {
  try {
    // Extract studentId from the URL
    const url = new URL(request.url);
    const paths = url.pathname.split('/');
    const studentId = paths[paths.length - 1];

    if (!studentId) {
      return NextResponse.json(
        { error: 'Student ID is required' },
        { status: 400 }
      );
    }

    // Fetch student document from Firestore
    const studentDoc = await adminFirestore.collection('students').doc(studentId).get();

    if (!studentDoc.exists) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Return student data
    const studentData = {
      id: studentDoc.id,
      ...studentDoc.data()
    };

    return NextResponse.json(studentData);

  } catch (error) {
    console.error('Error fetching student:', error);
    return NextResponse.json(
      { error: 'Failed to fetch student data' },
      { status: 500 }
    );
  }
}

// Also support POST for batch fetching multiple students
export async function POST(request: NextRequest) {
  try {
    const { studentIds } = await request.json();

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { error: 'Student IDs array is required' },
        { status: 400 }
      );
    }

    const students = [];
    
    // Fetch all student documents
    for (const studentId of studentIds) {
      try {
        const studentDoc = await adminFirestore.collection('students').doc(studentId).get();
        if (studentDoc.exists) {
          students.push({
            id: studentDoc.id,
            ...studentDoc.data()
          });
        } else {
          console.warn(`Student not found: ${studentId}`);
        }
      } catch (error) {
        console.error(`Error fetching student ${studentId}:`, error);
      }
    }

    return NextResponse.json({ students });

  } catch (error) {
    console.error('Error batch fetching students:', error);
    return NextResponse.json(
      { error: 'Failed to fetch student data' },
      { status: 500 }
    );
  }
}
