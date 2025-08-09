import { NextRequest, NextResponse } from 'next/server';
import { teacherSchema, teacherUpdateSchema, TeacherDocument } from '@/models/teacherSchema';
import firebaseAdmin from '@/utils/firebase-server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
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
async function createTeacherWelcomeEmail(to: string, teacherName: string, password: string): Promise<void> {
  try {
    const emailData = {
      to: to,
      message: {
        subject: "Welcome to Dr U Education - Teacher Account Created",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4F46E5; text-align: center;">Welcome to Dr U Education Faculty!</h2>
            
            <p>Dear ${teacherName},</p>
            
            <p>Welcome to Dr U Education! We're excited to have you join our teaching community and look forward to your contributions to our students' educational journey.</p>
            
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #374151; margin-top: 0;">Your Teacher Login Credentials:</h3>
              <p><strong>Email:</strong> ${to}</p>
              <p><strong>Password:</strong> <code style="background-color: #E5E7EB; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${password}</code></p>
            </div>
            
            <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
            </div>
            
            <p>As a teacher at Dr U Education, you can now access your teacher portal to:</p>
            <ul>
              <li>Manage your classes and students</li>
              <li>Upload course materials and assignments</li>
              <li>Track student progress and grades</li>
              <li>Communicate with students and parents</li>
              <li>Access teaching resources and tools</li>
              <li>View your schedule and class rosters</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://www.drueducation.com.au/teacher/login" 
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Access Teacher Portal
              </a>
            </div>
            
            <p>If you have any questions or need assistance with your account, please don't hesitate to contact our administration team.</p>
            
            <p>We're thrilled to have you on board and look forward to working with you!</p>
            
            <p>Best regards,<br>
            The Dr U Education Administration Team</p>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
            <p style="font-size: 12px; color: #6B7280; text-align: center;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `,
      }
    };

    // Add email document to the mail collection (Firebase extension will process it)
    await firebaseAdmin.firestore.addDoc('mail', emailData);
    console.log(`Teacher welcome email queued for sending to: ${to}`);
  } catch (error) {
    console.error('Error creating teacher welcome email document:', error);
    throw new Error('Failed to queue teacher welcome email');
  }
}

// POST - Create a new teacher
export async function POST(req: NextRequest) {
  try {
    // Parse and validate the request body
    const body = await req.json();
    console.log('Received teacher data:', body);
    
    // Preprocess data to handle empty strings for optional fields
    const processedBody = {
      ...body,
      bio: body.bio === '' ? undefined : body.bio,
      address: body.address === '' ? undefined : body.address,
      hireDate: body.hireDate === '' ? undefined : body.hireDate,
      profileImageUrl: body.profileImageUrl === '' ? undefined : body.profileImageUrl,
    };
    
    console.log('Processed teacher data:', processedBody);
    
    const validatedData = teacherSchema.safeParse(processedBody);
    
    if (!validatedData.success) {
      console.error('Validation failed:', validatedData.error.issues);
      return NextResponse.json(
        { 
          error: "Invalid teacher data", 
          details: validatedData.error.issues,
          validationErrors: validatedData.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }
    
    const teacherData = validatedData.data;
    
    // Check if a teacher with this email already exists
    try {
      await firebaseAdmin.authentication.getUserByEmail(teacherData.email);
      return NextResponse.json(
        { error: "A teacher with this email already exists" },
        { status: 409 }
      );
    } catch (error: any) {
      // User doesn't exist, which is what we want
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }
    
    // Generate random password for the teacher
    const generatedPassword = generateRandomPassword(10);
    
    // Generate avatar initials
    const initials = teacherData.name
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    
    // Create the user in Firebase Auth
    const userRecord = await firebaseAdmin.authentication.createUser(
      teacherData.email, 
      generatedPassword, 
      teacherData.name
    );
    
    // Prepare teacher document data (filter out undefined values)
    const teacherDocument: Omit<TeacherDocument, 'id'> = {
      name: teacherData.name,
      email: teacherData.email,
      phone: teacherData.phone || '',
      countryCode: teacherData.countryCode || '+61',
      subjects: teacherData.subjects || [],
      qualifications: teacherData.qualifications || '',
      bio: teacherData.bio || '',
      status: teacherData.status,
      hireDate: teacherData.hireDate || new Date().toISOString().split('T')[0],
      address: teacherData.address || '',
      avatar: initials,
      profileImageUrl: teacherData.profileImageUrl || '',
      // Removed classesAssigned - use dynamic queries instead
      studentsCount: 0,
      uid: userRecord.uid,
      createdAt: FieldValue.serverTimestamp() as any,
      updatedAt: FieldValue.serverTimestamp() as any
    };
    
    // Perform operations in parallel for better performance
    await Promise.all([
      firebaseAdmin.authentication.setCustomClaims(userRecord.uid, { 
        teacher: true,
        role: 'teacher'
      }),
      firebaseAdmin.firestore.setDoc('teachers', userRecord.uid, teacherDocument),
      createTeacherWelcomeEmail(teacherData.email, teacherData.name, generatedPassword)
    ]);
    
    // Clear cache
    cacheUtils.invalidate('teachers');
    
    return NextResponse.json(
      { 
        message: "Teacher created successfully and welcome email sent", 
        id: userRecord.uid,
        name: teacherData.name, 
        email: teacherData.email,
        avatar: initials,
        subjects: teacherData.subjects
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating teacher:", error);
    return NextResponse.json(
      { error: "Failed to create teacher", details: error.message },
      { status: 500 }
    );
  }
}

// GET - Retrieve teacher(s)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    
    if (id) {
      // Get specific teacher
      const teacher = await firebaseAdmin.firestore.getDoc('teachers', id);
      if (!teacher) {
        return NextResponse.json(
          { error: "Teacher not found" },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ id, ...teacher });
    } else {
      // Get all teachers with caching
      const cachedTeachers = cacheUtils.get('teachers');
      if (cachedTeachers) {
        return NextResponse.json(cachedTeachers);
      }
      
      const snapshot = await firebaseAdmin.db.collection('teachers').get();
      const teachersWithIds = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Cache the results
      cacheUtils.set('teachers', teachersWithIds, 60); // Cache for 60 seconds
      
      return NextResponse.json(teachersWithIds);
    }
  } catch (error: any) {
    console.error("Error fetching teacher(s):", error);
    return NextResponse.json(
      { error: "Failed to fetch teacher(s)", details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update a teacher
export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: "Teacher ID is required" },
        { status: 400 }
      );
    }
    
    const body = await req.json();
    const validatedData = teacherUpdateSchema.safeParse(body);
    
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid update data", details: validatedData.error.issues },
        { status: 400 }
      );
    }
    
    // Check if teacher exists
    const existingTeacher = await firebaseAdmin.firestore.getDoc('teachers', id);
    if (!existingTeacher) {
      return NextResponse.json(
        { error: "Teacher not found" },
        { status: 404 }
      );
    }
    
    const updateData = {
      ...validatedData.data,
      updatedAt: FieldValue.serverTimestamp() as any
    };
    
    // Perform updates in parallel
    const updatePromises = [
      firebaseAdmin.firestore.updateDoc('teachers', id, updateData)
    ];
    
    // Update Firebase Auth user if email or name changed
    if (validatedData.data.email || validatedData.data.name) {
      const authUpdate: any = {};
      if (validatedData.data.email) authUpdate.email = validatedData.data.email;
      if (validatedData.data.name) authUpdate.displayName = validatedData.data.name;
      
      updatePromises.push(
        firebaseAdmin.authentication.updateUser(existingTeacher.uid, authUpdate).then(() => {})
      );
    }
    
    await Promise.all(updatePromises);
    
    // Get the updated teacher data
    const updatedTeacher = await firebaseAdmin.firestore.getDoc('teachers', id);
    
    // Clear cache
    cacheUtils.invalidate('teachers');
    
    return NextResponse.json(
      { 
        message: "Teacher updated successfully", 
        id,
        ...updatedTeacher
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating teacher:", error);
    return NextResponse.json(
      { error: "Failed to update teacher", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a teacher
export async function DELETE(req: NextRequest) {
  try {
    // Try to get ID from query parameter first, then from request body
    const url = new URL(req.url);
    let id = url.searchParams.get('id');
    
    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch (error) {
        // If no body or invalid JSON, id remains null
      }
    }
    
    if (!id) {
      return NextResponse.json(
        { error: "Teacher ID is required" },
        { status: 400 }
      );
    }
    
    // Check if teacher exists
    const existingTeacher = await firebaseAdmin.firestore.getDoc('teachers', id);
    if (!existingTeacher) {
      return NextResponse.json(
        { error: "Teacher not found" },
        { status: 404 }
      );
    }
    
    // Perform deletions - delete Firestore document first, then auth user
    try {
      // Delete the Firestore document
      await firebaseAdmin.firestore.deleteDoc('teachers', id);
      
      // Delete the authentication user if it exists
      if (existingTeacher.uid) {
        try {
          await firebaseAdmin.authentication.deleteUser(existingTeacher.uid);
        } catch (authError: any) {
          // Log but don't fail if auth user doesn't exist
          if (authError.code !== 'auth/user-not-found') {
            console.error('Error deleting auth user:', authError);
            // Continue anyway since Firestore document is already deleted
          }
        }
      }
    } catch (firestoreError) {
      console.error('Error deleting teacher document:', firestoreError);
      throw firestoreError;
    }
    
    // Clear cache
    cacheUtils.invalidate('teachers');
    
    return NextResponse.json(
      { message: "Teacher deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting teacher:", error);
    return NextResponse.json(
      { error: "Failed to delete teacher", details: error.message },
      { status: 500 }
    );
  }
}
