import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';
import * as admin from 'firebase-admin';

// Use the properly configured Firestore instance
const db = firebaseAdmin.db;

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
      // Get all students using the properly configured Firestore instance
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
      // Get the highest existing student number
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
      await db.collection('counters').doc('studentNumber').set({
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
      try {
        // Use transaction to ensure atomicity
        const counterRef = db.collection('counters').doc('studentNumber');
        const studentRef = db.collection('students').doc(studentId);

        const result = await db.runTransaction(async (transaction) => {
          // Get current counter
          const counterDoc = await transaction.get(counterRef);
          
          let nextNumber = 1;
          if (counterDoc.exists) {
            const data = counterDoc.data();
            nextNumber = (data?.count || 0) + 1;
          }

          // Format student number
          const studentNumber = `ST${nextNumber.toString().padStart(4, '0')}`;

          // Check if student exists
          const studentDoc = await transaction.get(studentRef);
          if (!studentDoc.exists) {
            throw new Error('Student not found');
          }

          // Update counter
          transaction.set(counterRef, {
            count: nextNumber,
            lastUpdated: admin.firestore.Timestamp.now()
          }, { merge: true });

          // Update student
          transaction.update(studentRef, {
            studentNumber: studentNumber,
            updatedAt: admin.firestore.Timestamp.now()
          });

          return studentNumber;
        });

        return NextResponse.json({
          message: 'Student number assigned',
          studentNumber: result,
          studentId: studentId
        });
      } catch (error) {
        console.error('Error assigning student number:', error);
        return NextResponse.json({
          error: 'Failed to assign student number',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
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
