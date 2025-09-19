import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminFirestore } from '@/utils/firebase-admin';

interface CreateSheetsRequest {
  allocationId: string;
  templateFileUrl: string; // Changed to templateFileUrl to be more accurate
  students: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  title: string;
  className: string;
  teacherEmail: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateSheetsRequest = await request.json();
    const { allocationId, templateFileUrl, students, title, className, teacherEmail } = body;

    console.log('🔄 Creating Google Sheets for students via Apps Script:', students.length);
    console.log('📋 Request data:', { allocationId, templateFileUrl, title, className, teacherEmail });

    // Check if Google Apps Script URL is configured
    const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    if (!appsScriptUrl) {
      console.error('❌ Missing Google Apps Script URL');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Google Apps Script URL not configured. Please set GOOGLE_APPS_SCRIPT_URL environment variable.'
        },
        { status: 500 }
      );
    }

    console.log('🔗 Apps Script URL configured:', appsScriptUrl);

    // Prepare data for Google Apps Script
    const appsScriptData = {
      action: 'createStudentSheets',
      templateFileUrl,
      students: students.map(student => ({
        id: student.id,
        name: student.name
      })),
      className,
      templateName: title
    };

    console.log('� Calling Google Apps Script...');
    
    // Call Google Apps Script
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(appsScriptData)
    });

    if (!response.ok) {
      throw new Error(`Apps Script request failed: ${response.status} ${response.statusText}`);
    }

    const appsScriptResult = await response.json();
    console.log('📥 Apps Script response:', appsScriptResult);

    if (!appsScriptResult.success) {
      throw new Error(`Apps Script failed: ${appsScriptResult.error || 'Unknown error'}`);
    }

    // Process the results and save to database
    const studentSheets = [];
    
    console.log('� Saving student sheets to database...');
    
    for (const result of appsScriptResult.results || []) {
      try {
        const studentSheetId = `student_sheet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Find the corresponding student email
        const student = students.find(s => s.id === result.studentId);
        
        const studentSheet = {
          id: studentSheetId,
          allocationId,
          studentId: result.studentId,
          studentName: result.studentName,
          studentEmail: student?.email || '',
          googleSheetId: result.sheetId,
          googleSheetUrl: result.sheetUrl,
          status: 'assigned' as const,
          createdAt: Timestamp.now()
        };

        // Save to Firestore
        await adminFirestore.collection('studentSheets').doc(studentSheetId).set(studentSheet);
        studentSheets.push(studentSheet);
        
        console.log(`✅ Saved sheet for ${result.studentName}: ${result.sheetId}`);

      } catch (error) {
        console.error(`❌ Error saving sheet for ${result.studentName}:`, error);
      }
    }

    // Log any errors from Apps Script
    if (appsScriptResult.errors && appsScriptResult.errors.length > 0) {
      console.warn('⚠️ Some sheets failed to create:', appsScriptResult.errors);
    }

    console.log(`✅ Successfully created and saved ${studentSheets.length}/${students.length} sheets`);

    return NextResponse.json({
      success: true,
      createdSheets: studentSheets.length,
      totalStudents: students.length,
      studentSheets,
      appsScriptSummary: appsScriptResult.summary,
      errors: appsScriptResult.errors || []
    });

  } catch (error) {
    console.error('❌ Error in create-for-students API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}