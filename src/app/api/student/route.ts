
import { NextRequest, NextResponse } from 'next/server';
import { studentSchema, studentUpdateSchema, StudentDocument } from '@/models/studentSchema';
import firebaseAdmin from '@/utils/firebase-server';
import { Timestamp } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import { cacheUtils } from '@/utils/cache';
import { sendStudentWelcomeEmail } from '@/utils/emailService';

// Function to generate random password
function generateRandomPassword(length: number = 8): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one character from each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special character
  
  // Fill the rest with random characters
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Welcome email is now handled by centralized emailService using Nodemailer SMTP

// POST - Create a new student
export async function POST(req: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await req.json();
    const validatedData = studentSchema.safeParse(body);
    
    if (!validatedData.success) {
      const errorMessages = validatedData.error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      
      return NextResponse.json(
        { 
          error: "Validation failed", 
          message: errorMessages,
          details: validatedData.error.issues 
        },
        { status: 400 }
      );
    }
    
    const studentData = validatedData.data;
    
    // Generate random password for the student
    const generatedPassword = generateRandomPassword(10);
    
    // Generate avatar initials
    const initials = studentData.name
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    let userRecord: admin.auth.UserRecord;

    // Check if a student with this email already exists
    try {
      const existingUser = await firebaseAdmin.authentication.getUserByEmail(studentData.email);
      
      // If the user exists in Auth, check if they exist in Firestore
      const studentDoc = await firebaseAdmin.firestore.getDoc('students', existingUser.uid);
      if (studentDoc) {
        // User exists in BOTH Auth and Firestore, this is a legitimate conflict
        return NextResponse.json(
          { error: "Student with this email already exists" },
          { status: 409 }
        );
      }
      
      // Orphaned Auth user found (in Auth but not in Firestore). Recover the account.
      console.log('Found orphaned auth user, recovering UID:', existingUser.uid);
      userRecord = await firebaseAdmin.authentication.updateUser(existingUser.uid, {
        password: generatedPassword,
        displayName: studentData.name
      });
    } catch (error: any) {
      // If the error is about user not found, this is the normal flow
      if (error.code === 'auth/user-not-found') {
        // Create the user in Firebase Auth
        userRecord = await firebaseAdmin.authentication.createUser(
          studentData.email, 
          generatedPassword, 
          studentData.name
        );
      } else {
        throw error; // Rethrow other errors
      }
    }
    
    // Generate student number using server-side counter
    let studentNumber: string | undefined;
    try {
      // Get current counter value
      const counterDoc = await firebaseAdmin.firestore.getDoc('counters', 'studentNumber');
      
      let nextNumber = 1;
      if (counterDoc && counterDoc.count) {
        nextNumber = counterDoc.count + 1;
      }
      
      // Update counter
      await firebaseAdmin.firestore.setDoc('counters', 'studentNumber', {
        count: nextNumber,
        lastUpdated: admin.firestore.Timestamp.now()
      });
      
      // Format student number (e.g., ST0001)
      studentNumber = `ST${nextNumber.toString().padStart(4, '0')}`;
      console.log('✅ Generated student number:', studentNumber);
    } catch (error) {
      console.warn('⚠️ Failed to generate student number, continuing without it:', error);
      // Don't fail the entire operation if student number generation fails
    }
    
    // Prepare student document data
    const studentDocument: Omit<StudentDocument, 'id'> = {
      name: studentData.name,
      email: studentData.email,
      phone: studentData.phone,
      dateOfBirth: studentData.dateOfBirth || '', // Safe fallback for optional field
      year: studentData.year || '', // Safe fallback for optional field
      school: studentData.school || '', // Safe fallback for optional field
      enrollmentDate: studentData.enrollmentDate || new Date().toISOString().split('T')[0],
      status: studentData.status,
      coursesEnrolled: studentData.coursesEnrolled,
      avatar: initials,
      studentNumber: studentNumber, // Add the generated student number
      parent: studentData.parent,
      payment: studentData.payment || {
        status: 'Pending',
        method: '',
        lastPayment: 'N/A'
      },
      uid: userRecord.uid,
      createdAt: admin.firestore.Timestamp.now() as any,
      updatedAt: admin.firestore.Timestamp.now() as any
    };
    
    // Perform operations in parallel for better performance
    await Promise.all([
      // Set custom claims for student role
      firebaseAdmin.authentication.setCustomClaims(userRecord.uid, { 
        student: true,
        role: 'student'
      }),
      // Create student document in Firestore
      firebaseAdmin.firestore.setDoc('students', userRecord.uid, studentDocument),
      // Queue welcome email via Nodemailer SMTP
      sendStudentWelcomeEmail(studentData.email, studentData.name, generatedPassword)
    ]);
    
    // Clear cache
    cacheUtils.invalidate('students');
    
    return NextResponse.json(
      { 
        message: "Student created successfully and welcome email sent", 
        id: userRecord.uid,
        name: studentData.name, 
        email: studentData.email,
        avatar: initials
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating student:", error);
    return NextResponse.json(
      { error: "Failed to create student", details: error.message },
      { status: 500 }
    );
  }
}

// GET - Retrieve student(s)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    
    const cacheKey = id ? `student:${id}` : 'students:all';
    const cachedData = cacheUtils.get(cacheKey);

    if (cachedData) {
      return NextResponse.json(cachedData);
    }
    
    // If ID is provided, get a specific student
    if (id) {
      const studentDoc = await firebaseAdmin.firestore.getDoc<StudentDocument>('students', id);
      
      if (!studentDoc) {
        return NextResponse.json(
          { error: "Student not found" },
          { status: 404 }
        );
      }
      
      // Get auth user info
      let authUser: admin.auth.UserRecord | null = null;
      try {
        authUser = await firebaseAdmin.authentication.getUser(id);
      } catch (error) {
        console.warn(`Auth user not found for student ${id}`);
      }
      
      const student = {
        ...studentDoc,
        id,
        emailVerified: authUser?.emailVerified || false,
        disabled: authUser?.disabled || false
      };

      // Cache the result
      cacheUtils.set(cacheKey, student, 300);
      return NextResponse.json(student);
    }
    
    // Get all students
    const snapshot = await firebaseAdmin.db.collection('students').get();
    const studentDocs = snapshot.docs;
    
    // Get all UIDs for batch fetching
    const studentIds = studentDocs.map(doc => doc.id);
    
    // Use batched operation if available (up to 100 users)
    let authUsers: Record<string, admin.auth.UserRecord> = {};
    
    if (studentIds.length > 0) {
      // Firebase Admin SDK doesn't have batch getUsers, so we'll do individual calls
      // In production, you might want to implement a more efficient batch system
      const authPromises = studentIds.map(async (uid) => {
        try {
          const user = await firebaseAdmin.authentication.getUser(uid);
          return { uid, user };
        } catch (error) {
          console.warn(`Auth user not found for student ${uid}`);
          return { uid, user: null };
        }
      });
      
      const authResults = await Promise.all(authPromises);
      authResults.forEach(({ uid, user }) => {
        if (user) authUsers[uid] = user;
      });
    }
    
    const students = studentDocs.map(doc => {
      const data = doc.data() as StudentDocument;
      const authUser = authUsers[doc.id];
        return {
        ...data,
        id: doc.id,
        emailVerified: authUser?.emailVerified || false,
        disabled: authUser?.disabled || false
      };
    });

    // Cache the result
    const response = { students };
    cacheUtils.set(cacheKey, response, 300);    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error fetching student(s):", error);
    return NextResponse.json(
      { error: "Failed to fetch student(s)", details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update a student
export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      );
    }
    
    // Parse and validate the request body
    const body = await req.json();
    const validatedData = studentUpdateSchema.safeParse(body);
    
    if (!validatedData.success) {
      // Format validation errors into a user-friendly message
      const errorMessages = validatedData.error.issues.map(issue => {
        const path = issue.path.join('.');
        return `${path}: ${issue.message}`;
      }).join('; ');
      
      return NextResponse.json(
        { 
          error: "Validation failed", 
          message: errorMessages,
          details: validatedData.error.issues 
        },
        { status: 400 }
      );
    }
    
    const updateData = validatedData.data;
    
    // Check if the student exists
    let studentDoc: StudentDocument | null = null;
    try {
      studentDoc = await firebaseAdmin.firestore.getDoc<StudentDocument>('students', id);
      if (!studentDoc) {
        return NextResponse.json(
          { error: "Student not found" },
          { status: 404 }
        );
      }
    } catch (error: any) {
      return NextResponse.json(
        { error: "Student not found", details: error.message },
        { status: 404 }
      );
    }
    
    // Parallelize Auth and Firestore updates
    const updatePromises: Promise<any>[] = [];
    
    // Update in Auth if needed
    const authUpdateData: admin.auth.UpdateRequest = {};
    if (updateData.email) authUpdateData.email = updateData.email;
    if (updateData.name) authUpdateData.displayName = updateData.name;
    
    if (Object.keys(authUpdateData).length > 0) {
      updatePromises.push(firebaseAdmin.authentication.updateUser(id, authUpdateData));
    }
      // Update in Firestore
    const firestoreUpdateData: Partial<StudentDocument> = {
      updatedAt: admin.firestore.Timestamp.now() as any
    };
    
    // Only include fields that are provided in the update
    if (updateData.name) firestoreUpdateData.name = updateData.name;
    if (updateData.email) firestoreUpdateData.email = updateData.email;
    if (updateData.phone) firestoreUpdateData.phone = updateData.phone;
    if (updateData.status) firestoreUpdateData.status = updateData.status;
    if (updateData.coursesEnrolled !== undefined) firestoreUpdateData.coursesEnrolled = updateData.coursesEnrolled;
    if (updateData.enrollmentDate) firestoreUpdateData.enrollmentDate = updateData.enrollmentDate;
    if (updateData.parent) firestoreUpdateData.parent = { ...studentDoc.parent, ...updateData.parent };
    if (updateData.payment) firestoreUpdateData.payment = { ...studentDoc.payment, ...updateData.payment };
    
    // Update avatar if name changed
    if (updateData.name) {
      const initials = updateData.name
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
      firestoreUpdateData.avatar = initials;
    }
    
    updatePromises.push(firebaseAdmin.firestore.updateDoc('students', id, firestoreUpdateData));
    
    // Run both updates in parallel
    await Promise.all(updatePromises);
    
    // Clear cache
    cacheUtils.delete(`student:${id}`);
    cacheUtils.delete('students:all');
    
    return NextResponse.json({
      message: "Student updated successfully",
      id
    });
  } catch (error: any) {
    console.error("Error updating student:", error);
    return NextResponse.json(
      { error: "Failed to update student", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a student
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      );
    }
    
    // Check if the student exists
    let studentDoc: StudentDocument | null = null;
    try {
      studentDoc = await firebaseAdmin.firestore.getDoc<StudentDocument>('students', id);
      if (!studentDoc) {
        return NextResponse.json(
          { error: "Student not found" },
          { status: 404 }
        );
      }
    } catch (error: any) {
      return NextResponse.json(
        { error: "Student not found", details: error.message },
        { status: 404 }
      );
    }
    
    console.log(`Starting deletion process for student: ${id} (${studentDoc.name})`);
    
    // Step 1: Delete student enrollments first - THIS MUST SUCCEED
    let deletedEnrollmentsCount = 0;
    try {
      // Delete enrollments using server-side Firebase Admin
      const enrollmentsSnapshot = await firebaseAdmin.db
        .collection('studentEnrollments')
        .where('studentId', '==', id)
        .get();
      
      if (!enrollmentsSnapshot.empty) {
        // Delete all enrollment documents
        const batch = firebaseAdmin.db.batch();
        enrollmentsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        deletedEnrollmentsCount = enrollmentsSnapshot.docs.length;
        console.log(`Successfully deleted ${deletedEnrollmentsCount} enrollments for student ${id}`);
      } else {
        console.log(`No enrollments found for student ${id}`);
      }
    } catch (enrollmentError: any) {
      console.error('Failed to delete student enrollments:', enrollmentError);
      // FAIL THE ENTIRE OPERATION - DO NOT DELETE THE STUDENT
      return NextResponse.json(
        { 
          error: "Failed to delete student enrollments", 
          details: enrollmentError.message,
          message: "Student deletion aborted to prevent orphaned data"
        },
        { status: 500 }
      );
    }
    
    // Step 1.5: Cancel related enrollment requests to prevent orphaned data
    let cancelledRequestsCount = 0;
    try {
      // Find enrollment requests for this student
      const enrollmentRequestsSnapshot = await firebaseAdmin.db
        .collection('enrollmentRequests')
        .where('student.email', '==', studentDoc.email)
        .get();
      
      if (!enrollmentRequestsSnapshot.empty) {
        // Update all enrollment requests to cancelled status
        const batch = firebaseAdmin.db.batch();
        enrollmentRequestsSnapshot.docs.forEach(doc => {
          batch.update(doc.ref, {
            status: 'Cancelled',
            adminNotes: 'Student account was deleted',
            updatedAt: admin.firestore.Timestamp.now(),
          });
        });
        
        await batch.commit();
        cancelledRequestsCount = enrollmentRequestsSnapshot.docs.length;
        console.log(`Successfully cancelled ${cancelledRequestsCount} enrollment requests for student ${studentDoc.email}`);
      } else {
        console.log(`No enrollment requests found for student ${studentDoc.email}`);
      }
    } catch (requestError: any) {
      // Log the error but don't fail the deletion - this is cleanup
      console.error('Failed to cancel enrollment requests (continuing with deletion):', requestError);
    }
    
    // Step 2: Only proceed with student deletion if enrollments were successfully deleted
    try {
      await Promise.all([
        firebaseAdmin.authentication.deleteUser(id),
        firebaseAdmin.firestore.deleteDoc('students', id)
      ]);
    } catch (studentDeletionError: any) {
      console.error('Failed to delete student after enrollments were deleted:', studentDeletionError);
      // This is a critical state - enrollments are deleted but student deletion failed
      return NextResponse.json(
        { 
          error: "Failed to delete student account", 
          details: studentDeletionError.message,
          criticalError: true,
          message: "Enrollments were deleted but student account deletion failed. Manual cleanup may be required."
        },
        { status: 500 }
      );
    }
    
    // Step 3: Clear cache only after successful deletion
    cacheUtils.delete(`student:${id}`);
    cacheUtils.delete('students:all');
    
    console.log(`Successfully completed deletion of student ${id}, ${deletedEnrollmentsCount} related enrollments, and ${cancelledRequestsCount} enrollment requests`);
    
    return NextResponse.json({
      message: "Student and related data deleted successfully",
      id,
      deletedEnrollments: deletedEnrollmentsCount,
      cancelledRequests: cancelledRequestsCount
    });
  } catch (error: any) {
    console.error("Error deleting student:", error);
    return NextResponse.json(
      { error: "Failed to delete student", details: error.message },
      { status: 500 }
    );
  }
}
