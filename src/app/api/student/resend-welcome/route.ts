import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';
import { sendStudentWelcomeEmail } from '@/utils/emailService';
import { generateRandomPassword } from '@/utils/passwordUtils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId } = body;
    
    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID is required." },
        { status: 400 }
      );
    }
    
    // Verify the student document exists
    const studentDoc = await firebaseAdmin.firestore.getDoc<{ name: string; email: string }>('students', studentId);
    
    if (!studentDoc) {
      return NextResponse.json(
        { error: "Student not found in Firestore." },
        { status: 404 }
      );
    }
    
    const { email, name } = studentDoc;
    
    // Verify the auth user exists
    try {
      await firebaseAdmin.authentication.getUser(studentId);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        return NextResponse.json(
          { error: "Firebase Auth user not found for this student. The account may have been deleted or is corrupted." },
          { status: 404 }
        );
      }
      throw authError;
    }
    
    // Generate a new temporary password
    const newPassword = generateRandomPassword(10);
    
    // Update the Firebase auth user with the new password
    await firebaseAdmin.authentication.updateUser(studentId, {
      password: newPassword
    });
    
    // Attempt to send the welcome email
    const emailResult = await sendStudentWelcomeEmail(email, name, newPassword);
    
    if (!emailResult.success) {
      return NextResponse.json(
        { 
          error: "Failed to send the email via SMTP.", 
          details: emailResult.error
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { message: "Welcome email resent successfully. The student's password has been updated." },
      { status: 200 }
    );
    
  } catch (error: any) {
    console.error("Error resending welcome email:", error);
    return NextResponse.json(
      { error: "Failed to resend welcome email", details: error.message },
      { status: 500 }
    );
  }
}
