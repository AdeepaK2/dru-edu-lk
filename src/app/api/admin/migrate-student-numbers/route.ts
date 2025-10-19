import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';
import * as admin from 'firebase-admin';

/**
 * API endpoint for student number migration
 * 
 * Actions:
 * - initialize: Initialize the student number counter
 * - list: Get all students (for checking who needs numbers)
 * - assign: Assign a student number to a specific student
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'list') {
      // Get all students using the native Firebase Admin SDK
      const db = admin.firestore();
      const studentsSnapshot = await db.collection('students').get();
      
      const students = studentsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        email: doc.data().email,
        studentNumber: doc.data().studentNumber
      }));
      
      return NextResponse.json({ students });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in GET /api/admin/migrate-student-numbers:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, studentId } = body;

    // Initialize counter
    if (action === 'initialize') {
      // Get the highest existing student number using native Firebase Admin SDK
      const db = admin.firestore();
      const studentsSnapshot = await db.collection('students').get();
      
      let maxNumber = 0;
      studentsSnapshot.docs.forEach((doc) => {
        const studentNumber = doc.data().studentNumber;
        if (studentNumber) {
          const numberPart = studentNumber.replace('ST', '');
          const num = parseInt(numberPart, 10);
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num;
          }
        }
      });

      // Set counter to max number (next will be max + 1)
      await firebaseAdmin.firestore.setDoc('counters', 'studentNumber', {
        count: maxNumber,
        lastUpdated: admin.firestore.Timestamp.now(),
        initialized: true
      });

      return NextResponse.json({
        message: 'Counter initialized',
        startingFrom: maxNumber + 1
      });
    }

    // Assign student number to specific student
    if (action === 'assign' && studentId) {
      // Get current counter
      const counterDoc = await firebaseAdmin.firestore.getDoc('counters', 'studentNumber');
      
      let nextNumber = 1;
      if (counterDoc && counterDoc.count !== undefined) {
        nextNumber = counterDoc.count + 1;
      }

      // Update counter
      await firebaseAdmin.firestore.setDoc('counters', 'studentNumber', {
        count: nextNumber,
        lastUpdated: admin.firestore.Timestamp.now()
      });

      // Format student number
      const studentNumber = `ST${nextNumber.toString().padStart(4, '0')}`;

      // Update student document
      const student = await firebaseAdmin.firestore.getDoc('students', studentId);
      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      await firebaseAdmin.firestore.updateDoc('students', studentId, {
        studentNumber: studentNumber,
        updatedAt: admin.firestore.Timestamp.now()
      });

      return NextResponse.json({
        message: 'Student number assigned',
        studentNumber: studentNumber,
        studentId: studentId
      });
    }

    return NextResponse.json({ error: 'Invalid action or missing parameters' }, { status: 400 });
  } catch (error) {
    console.error('Error in POST /api/admin/migrate-student-numbers:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
