import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/utils/firebase-admin';

// POST endpoint for batch fetching multiple students
export async function POST(request: NextRequest) {
  try {
    const { studentIds } = await request.json();

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { error: 'Student IDs array is required' },
        { status: 400 }
      );
    }

    console.log('Batch fetching students:', studentIds);

    const students = [];
    
    // Fetch all student documents
    for (const studentId of studentIds) {
      try {
        const studentDoc = await adminFirestore.collection('students').doc(studentId).get();
        if (studentDoc.exists) {
          const studentData = {
            id: studentDoc.id,
            ...studentDoc.data()
          } as any;
          students.push(studentData);
          console.log(`✅ Fetched student: ${studentData.name} (${studentId})`);
        } else {
          console.warn(`❌ Student not found: ${studentId}`);
        }
      } catch (error) {
        console.error(`❌ Error fetching student ${studentId}:`, error);
      }
    }

    console.log(`📊 Successfully fetched ${students.length}/${studentIds.length} students`);

    return NextResponse.json({ 
      students,
      totalRequested: studentIds.length,
      totalFound: students.length
    });

  } catch (error) {
    console.error('Error batch fetching students:', error);
    return NextResponse.json(
      { error: 'Failed to fetch student data' },
      { status: 500 }
    );
  }
}
