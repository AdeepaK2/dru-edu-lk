import { NextRequest, NextResponse } from 'next/server';
import { studentSchema, studentUpdateSchema, StudentDocument } from '@/models/studentSchema';
import firebaseAdmin from '@/utils/firebase-server';
import { Timestamp } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import { cacheUtils } from '@/utils/cache';

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

// Function to create email document for Firebase extension
async function createEmailDocument(to: string, studentName: string, password: string): Promise<void> {
  try {
    // Generate download URLs for the policy documents
    const bucket = admin.storage().bucket('dru-edu.firebasestorage.app');
    const policyFile = bucket.file('class-policy/Class Policy Document.pdf');
    const noticeFile = bucket.file('class-policy/Notice to Parents .pdf');
    
    // Generate signed URLs that expire in 7 days
    const [policyUrl] = await policyFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    const [noticeUrl] = await noticeFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const emailData = {
      to: to,
      message: {
        subject: "Welcome to Dr U Education - Your Account Details",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4F46E5; text-align: center;">Welcome to Dr U Education!</h2>
            
            <p>Dear ${studentName},</p>
            
            <p>Welcome to Dr U Education! We're excited to have you join our learning community.</p>
            
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #374151; margin-top: 0;">Your Login Credentials:</h3>
              <p><strong>Email:</strong> ${to}</p>
              <p><strong>Password:</strong> <code style="background-color: #E5E7EB; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${password}</code></p>
            </div>
            
            <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
            </div>
            
            <div style="background-color: #EFF6FF; border: 1px solid #DBEAFE; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1E40AF; margin-top: 0;">Important Documents:</h3>
              <p>Please review the following important documents:</p>
              <ul style="margin: 10px 0;">
                <li><a href="${policyUrl}" style="color: #4F46E5; text-decoration: none; font-weight: 500;">📄 Class Policy Document</a></li>
                <li><a href="${noticeUrl}" style="color: #4F46E5; text-decoration: none; font-weight: 500;">📄 Notice to Parents</a></li>
              </ul>
              <p style="font-size: 12px; color: #6B7280; margin-top: 10px;">Note: These links will expire in 7 days.</p>
            </div>
            
            <p>You can now log in to your student portal to:</p>
            <ul>
              <li>Access your courses and learning materials</li>
              <li>View your grades and progress</li>
              <li>Communicate with your teachers</li>
              <li>Track your assignments and deadlines</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://www.drueducation.com.au/student/login" 
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Log In to Your Account
              </a>
            </div>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
            
            <p>Best regards,<br>
            The Dr U Education Team</p>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
            <p style="font-size: 12px; color: #6B7280; text-align: center;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `,
      }
    };    // Add email document to the mail collection (Firebase extension will process it)
    await firebaseAdmin.firestore.addDoc('mail', emailData);
    console.log(`Email queued for sending to: ${to}`);
  } catch (error) {
    console.error('Error creating email document:', error);
    throw new Error('Failed to queue welcome email');
  }
}

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
    
    // Check if a student with this email already exists
    try {
      await firebaseAdmin.authentication.getUserByEmail(studentData.email);
      return NextResponse.json(
        { error: "Student with this email already exists" },
        { status: 409 }
      );
    } catch (error: any) {
      // If the error is not about user not found, rethrow
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }
    
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
    
    // Create the user in Firebase Auth
    const userRecord = await firebaseAdmin.authentication.createUser(
      studentData.email, 
      generatedPassword, 
      studentData.name
    );
    
    // Prepare student document data
    const studentDocument: Omit<StudentDocument, 'id'> = {
      name: studentData.name,
      email: studentData.email,
      phone: studentData.phone,
      enrollmentDate: studentData.enrollmentDate || new Date().toISOString().split('T')[0],
      status: studentData.status,
      coursesEnrolled: studentData.coursesEnrolled,
      avatar: initials,
      parent: studentData.parent,
      payment: studentData.payment || {
        status: 'Pending',
        method: '',
        lastPayment: 'N/A'
      },
      uid: userRecord.uid,
      createdAt: admin.firestore.Timestamp.now() as any,
      updatedAt: admin.firestore.Timestamp.now() as any    };
    
    // Perform operations in parallel for better performance
    await Promise.all([
      // Set custom claims for student role
      firebaseAdmin.authentication.setCustomClaims(userRecord.uid, { 
        student: true,
        role: 'student'
      }),
      // Create student document in Firestore
      firebaseAdmin.firestore.setDoc('students', userRecord.uid, studentDocument),
      // Queue welcome email
      createEmailDocument(studentData.email, studentData.name, generatedPassword)
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
    cacheUtils.set(cacheKey, students, 300);    
    return NextResponse.json(students);
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
      return NextResponse.json(
        { error: "Invalid input data", details: validatedData.error.issues },
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
    
    console.log(`Successfully completed deletion of student ${id} and ${deletedEnrollmentsCount} related enrollments`);
    
    return NextResponse.json({
      message: "Student and related enrollments deleted successfully",
      id,
      deletedEnrollments: deletedEnrollmentsCount
    });
  } catch (error: any) {
    console.error("Error deleting student:", error);
    return NextResponse.json(
      { error: "Failed to delete student", details: error.message },
      { status: 500 }
    );
  }
}