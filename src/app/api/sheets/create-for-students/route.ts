import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { GoogleSheetsService } from '@/apiservices/googleSheetsService';
import { Timestamp } from 'firebase/firestore';

interface CreateSheetsRequest {
  allocationId: string;
  templateFilePath: string;
  students: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  title: string;
  teacherEmail: string;
}

// Initialize Google Sheets API
const getGoogleAuth = () => {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      project_id: process.env.GOOGLE_SHEETS_PROJECT_ID,
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ],
  });
};

export async function POST(request: NextRequest) {
  try {
    const body: CreateSheetsRequest = await request.json();
    const { allocationId, templateFilePath, students, title, teacherEmail } = body;

    console.log('🔄 Creating Google Sheets for students:', students.length);
    console.log('📋 Request data:', { allocationId, templateFilePath, title, teacherEmail });

    // Check if Google Sheets credentials are configured
    const hasCredentials = !!(
      process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SHEETS_PRIVATE_KEY &&
      process.env.GOOGLE_SHEETS_PROJECT_ID
    );

    console.log('🔑 Google Sheets credentials configured:', hasCredentials);
    
    if (!hasCredentials) {
      console.error('❌ Missing Google Sheets API credentials');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Google Sheets API credentials not configured. Please set GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, and GOOGLE_SHEETS_PROJECT_ID environment variables.'
        },
        { status: 500 }
      );
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Find the shared folder - this is REQUIRED now
    let folderId = null;
    try {
      console.log('🔍 Looking for shared folder "Dru Edu Sheets"...');
      const folderSearch = await drive.files.list({
        q: "name='Dru Edu Sheets' and mimeType='application/vnd.google-apps.folder'",
        fields: 'files(id, name, owners)'
      });
      
      if (folderSearch.data.files && folderSearch.data.files.length > 0) {
        folderId = folderSearch.data.files[0].id!;
        console.log(`✅ Found shared folder: ${folderId}`);
      } else {
        console.log('❌ Shared folder "Dru Edu Sheets" not found!');
        return NextResponse.json({
          success: false,
          error: 'Shared folder "Dru Edu Sheets" not found. Please create a folder named "Dru Edu Sheets" in Google Drive and share it with the service account.',
          serviceAccountEmail: 'sheet-admin@dru-edu.iam.gserviceaccount.com'
        }, { status: 500 });
      }
    } catch (error) {
      console.log('❌ Could not search for folder:', error);
      return NextResponse.json({
        success: false,
        error: 'Could not access shared folder. Make sure you have shared a folder with the service account.',
        details: error
      }, { status: 500 });
    }

    const studentSheets = [];

    // Create individual Google Sheets for each student
    for (const student of students) {
      try {
        console.log(`📝 Creating sheet for ${student.name}...`);
        console.log(`📧 Student email: ${student.email}`);
        console.log(`👨‍🏫 Teacher email: ${teacherEmail}`);

        // Create a new spreadsheet in the shared folder
        console.log(`🔄 Step 1: Creating Google Sheet in shared folder...`);
        const createResponse = await sheets.spreadsheets.create({
          requestBody: {
            properties: {
              title: `${title} - ${student.name}`,
            },
            sheets: [{
              properties: {
                title: 'Student Work',
                gridProperties: {
                  rowCount: 100,
                  columnCount: 26
                }
              }
            }]
          },
        });

        const spreadsheetId = createResponse.data.spreadsheetId!;
        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
        console.log(`✅ Step 1 Complete: Created sheet ${spreadsheetId}`);

        // Move to shared folder - this is REQUIRED
        console.log(`🔄 Step 1.5: Moving sheet to shared folder...`);
        await drive.files.update({
          fileId: spreadsheetId,
          addParents: folderId,
          removeParents: 'root',
          fields: 'id, parents'
        });
        console.log(`✅ Step 1.5 Complete: Moved to shared folder`);

        // Add some initial content/instructions
        console.log(`🔄 Step 2: Adding initial content...`);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'A1:B3',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Assignment', title],
              ['Student', student.name],
              ['Instructions', 'Please complete your work below:']
            ]
          }
        });
        console.log(`✅ Step 2 Complete: Added initial content`);

        // Share with student (edit permissions)
        console.log(`🔄 Step 3: Sharing with student...`);
        await drive.permissions.create({
          fileId: spreadsheetId,
          requestBody: {
            role: 'writer',
            type: 'user',
            emailAddress: student.email,
          },
          sendNotificationEmail: true,
          emailMessage: `Hi ${student.name}, you have been assigned a Google Sheet for: ${title}. Please complete your work in this sheet.`
        });
        console.log(`✅ Step 3 Complete: Shared with student`);

        // Share with teacher (edit permissions)
        console.log(`🔄 Step 4: Sharing with teacher...`);
        await drive.permissions.create({
          fileId: spreadsheetId,
          requestBody: {
            role: 'writer',
            type: 'user',
            emailAddress: teacherEmail,
          },
          sendNotificationEmail: false
        });
        console.log(`✅ Step 4 Complete: Shared with teacher`);

        // Create student sheet record in database
        console.log(`🔄 Step 5: Saving to database...`);
        const studentSheetId = `student_sheet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const studentSheet = {
          id: studentSheetId,
          allocationId,
          studentId: student.id,
          studentName: student.name,
          studentEmail: student.email,
          googleSheetId: spreadsheetId,
          googleSheetUrl: spreadsheetUrl,
          status: 'assigned' as const,
          createdAt: Timestamp.now()
        };

        await GoogleSheetsService.createStudentSheet(studentSheet);
        console.log(`✅ Step 5 Complete: Saved to database`);
        
        studentSheets.push(studentSheet);

        console.log(`✅ Created sheet for ${student.name}: ${spreadsheetId}`);

      } catch (error) {
        console.error(`❌ Error creating sheet for ${student.name}:`, error);
        console.error(`❌ Error details:`, {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          studentEmail: student.email,
          teacherEmail: teacherEmail
        });
        // Continue with other students even if one fails
      }
    }

    console.log(`✅ Successfully created ${studentSheets.length}/${students.length} sheets`);

    return NextResponse.json({
      success: true,
      createdSheets: studentSheets.length,
      totalStudents: students.length,
      studentSheets
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