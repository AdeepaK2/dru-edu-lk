
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
    const emailData = {
      to: to,
      message: {
        subject: "Welcome to Dr U Education - Your Account Details",
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Dr U Education</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            </style>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              
              <!-- Header with gradient background -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                  🎓 Welcome to Dr U Education!
                </h1>
                <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px; font-weight: 400;">
                  Your educational journey starts here
                </p>
              </div>
              
              <!-- Main content -->
              <div style="padding: 40px 30px;">
                <div style="margin-bottom: 30px;">
                  <p style="color: #1a202c; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                    Dear <strong>${studentName}</strong>,
                  </p>
                  <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0;">
                    Welcome to Dr U Education! We're thrilled to have you join our learning community and look forward to supporting your academic success.
                  </p>
                </div>
                
                <!-- Credentials Box -->
                <div style="background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border: 2px solid #e2e8f0; border-radius: 12px; padding: 25px; margin: 30px 0; position: relative;">
                  <div style="position: absolute; top: -10px; left: 20px; background-color: #ffffff; padding: 0 10px;">
                    <span style="color: #4299e1; font-weight: 600; font-size: 14px;">🔐 YOUR LOGIN CREDENTIALS</span>
                  </div>
                  <div style="margin-top: 10px;">
                    <div style="margin-bottom: 15px;">
                      <label style="color: #2d3748; font-weight: 500; font-size: 14px; display: block; margin-bottom: 5px;">Email Address:</label>
                      <p style="color: #1a202c; font-size: 16px; margin: 0; padding: 8px 12px; background-color: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0;">
                        ${to}
                      </p>
                    </div>
                    <div>
                      <label style="color: #2d3748; font-weight: 500; font-size: 14px; display: block; margin-bottom: 5px;">Temporary Password:</label>
                      <p style="color: #1a202c; font-size: 16px; margin: 0; padding: 8px 12px; background-color: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0; font-family: 'Courier New', monospace; font-weight: 600; letter-spacing: 1px;">
                        ${password}
                      </p>
                    </div>
                  </div>
                </div>
                
                <!-- Security Notice -->
                <div style="background-color: #fef5e7; border-left: 4px solid #f6ad55; padding: 16px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                  <div style="display: flex; align-items: flex-start;">
                    <span style="font-size: 18px; margin-right: 10px;">⚠️</span>
                    <div>
                      <p style="margin: 0; color: #744210; font-weight: 500; font-size: 14px;">
                        <strong>Security Notice:</strong> Please change your password immediately after your first login for enhanced security.
                      </p>
                    </div>
                  </div>
                </div>
                
                <!-- Features Section -->
                <div style="margin: 30px 0;">
                  <h3 style="color: #2d3748; font-size: 18px; font-weight: 600; margin: 0 0 20px 0;">
                    🚀 What you can do with your student portal:
                  </h3>
                  <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px;">
                    <ul style="margin: 0; padding-left: 20px; color: #4a5568; line-height: 1.8;">
                      <li style="margin-bottom: 8px;">📚 Access your courses and comprehensive learning materials</li>
                      <li style="margin-bottom: 8px;">📊 View your grades, progress reports, and performance analytics</li>
                      <li style="margin-bottom: 8px;">💬 Communicate directly with your teachers and classmates</li>
                      <li style="margin-bottom: 8px;">📝 Track assignments, deadlines, and upcoming assessments</li>
                      <li style="margin-bottom: 8px;">🎯 Set learning goals and monitor your achievements</li>
                    </ul>
                  </div>
                </div>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 35px 0;">
                  <a href="https://www.drueducation.com.au/student/login" 
                     style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); transition: all 0.2s;">
                    🚀 Access Your Student Portal
                  </a>
                </div>
                
                <!-- Important Documents Section -->
                <div style="background-color: #edf2f7; border-radius: 12px; padding: 25px; margin: 30px 0;">
                  <h3 style="color: #2d3748; font-size: 18px; font-weight: 600; margin: 0 0 20px 0; display: flex; align-items: center;">
                    📋 Required Documents for Physical Classes
                  </h3>
                  <p style="color: #4a5568; margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">
                    Please review and sign these important documents before attending your first physical class. <strong>After signing, upload the signed document(s) in your LMS Settings page.</strong>
                  </p>
                  <div style="space-y: 10px;">
                    <div style="margin-bottom: 15px; padding: 12px; background-color: #ffffff; border-radius: 8px; border-left: 4px solid #4299e1;">
                      <a href="https://drive.google.com/file/d/1YHJxvAfTVMqRJ5YQeD5fFZdXkt81vSr1/view?usp=sharing" 
                         style="color: #2b6cb0; text-decoration: none; font-weight: 500; display: flex; align-items: center;">
                        📜 <span style="margin-left: 8px;">Class Policy Agreement</span>
                      </a>
                    </div>
                    <div style="margin-bottom: 15px; padding: 12px; background-color: #ffffff; border-radius: 8px; border-left: 4px solid #48bb78;">
                      <a href="https://drive.google.com/file/d/1j_LO0jWJ2-4WRYBZwMwp0eRnFMqOVM-F/view?usp=sharing" 
                         style="color: #2f855a; text-decoration: none; font-weight: 500; display: flex; align-items: center;">
                        👨‍👩‍👧‍👦 <span style="margin-left: 8px;">Parent/Guardian Notice</span>
                      </a>
                    </div>
                    <div style="margin-bottom: 0; padding: 12px; background-color: #ffffff; border-radius: 8px; border-left: 4px solid #ed8936;">
                      <a href="https://drive.google.com/file/d/1qD9nYtOnbHs_AImrAaEU5NTPalXwea6F/view?usp=sharing" 
                         style="color: #c05621; text-decoration: none; font-weight: 500; display: flex; align-items: center;">
                        📸 <span style="margin-left: 8px;">Photo Consent Form</span>
                      </a>
                    </div>
                  </div>
                  <div style="background-color: #e6fffa; border-left: 4px solid #06b6d4; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; color: #0f766e; font-size: 14px;">
                      Action required: After signing, please upload the signed document(s) via your LMS <a href="https://www.drueducation.com.au/student/settings" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">Settings</a> page (Settings → Documents).
                    </p>
                  </div>
                  <div style="text-align: center; margin: 20px 0 0 0;">
                    <a href="https://www.drueducation.com.au/student/settings" 
                       style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      Upload Signed Documents
                    </a>
                  </div>
                </div>
                
                <!-- Support Section -->
                <div style="background-color: #f0fff4; border: 1px solid #9ae6b4; border-radius: 8px; padding: 20px; margin: 30px 0;">
                  <p style="color: #22543d; margin: 0; text-align: center; font-size: 15px;">
                    💡 <strong>Need Help?</strong> Our support team is here to assist you!<br>
                    <span style="color: #2f855a;">Email us or contact your assigned academic coordinator.</span>
                  </p>
                </div>
                
                <!-- Closing -->
                <div style="margin-top: 40px;">
                  <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    We're excited to be part of your educational journey and look forward to helping you achieve your academic goals.
                  </p>
                  <p style="color: #2d3748; font-size: 16px; margin: 0;">
                    <strong>Best regards,</strong><br>
                    <span style="color: #667eea; font-weight: 600;">The Dr U Education Team</span> 🎓
                  </p>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="background-color: #f8fafc; padding: 25px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
                <p style="color: #718096; font-size: 13px; margin: 0; line-height: 1.5;">
                  This is an automated message from Dr U Education.<br>
                  Please do not reply to this email. For support, contact our help desk.
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      }
    };

    // Add email document to the mail collection (Firebase extension will process it)
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
