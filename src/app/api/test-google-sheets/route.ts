// Test Google Sheets API Configuration
// You can test this by making a POST request to /api/test-google-sheets

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

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

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Google Sheets API configuration...');

    // Check if credentials are set
    const hasEmail = !!process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
    const hasKey = !!process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    const hasProject = !!process.env.GOOGLE_SHEETS_PROJECT_ID;

    console.log('📧 Service Account Email:', hasEmail ? 'Set' : 'Missing');
    console.log('🔑 Private Key:', hasKey ? 'Set' : 'Missing');
    console.log('📁 Project ID:', hasProject ? 'Set' : 'Missing');

    if (!hasEmail || !hasKey || !hasProject) {
      return NextResponse.json({
        success: false,
        error: 'Missing Google Sheets API credentials',
        details: {
          hasEmail,
          hasKey,
          hasProject
        }
      }, { status: 500 });
    }

    // Try to initialize auth
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Test 1: Check what folders/files the service account can see
    console.log('🔍 Test 1: Checking Drive access...');
    try {
      const driveList = await drive.files.list({
        pageSize: 10,
        fields: 'files(id, name, mimeType, owners)'
      });
      console.log('✅ Drive access successful. Files found:', driveList.data.files?.length || 0);
    } catch (error) {
      console.log('❌ Drive access failed:', error);
      return NextResponse.json({
        success: false,
        error: 'Drive API access failed',
        details: error
      }, { status: 500 });
    }

    // Test 2: Try to create a simple spreadsheet
    console.log('📊 Test 2: Creating test spreadsheet...');
    try {
      const createResponse = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: 'API Test - ' + new Date().toISOString(),
          },
        },
      });

      const spreadsheetId = createResponse.data.spreadsheetId;
      console.log('✅ Test spreadsheet created:', spreadsheetId);

      // Test 3: Try to share the spreadsheet with the teacher
      console.log('🔗 Test 3: Testing share functionality...');
      try {
        await drive.permissions.create({
          fileId: spreadsheetId!,
          requestBody: {
            role: 'writer',
            type: 'user',
            emailAddress: 'gavel.events@gmail.com', // Your actual email
          },
          sendNotificationEmail: false
        });
        console.log('✅ Share test successful');
      } catch (shareError) {
        console.log('❌ Share test failed:', shareError);
      }

      // Clean up - delete the test spreadsheet
      try {
        await drive.files.delete({ fileId: spreadsheetId! });
        console.log('🗑️ Test spreadsheet deleted');
      } catch (deleteError) {
        console.log('⚠️ Could not delete test file:', deleteError);
      }

      return NextResponse.json({
        success: true,
        message: 'Google Sheets API is working correctly',
        testSpreadsheetId: spreadsheetId
      });

    } catch (createError) {
      console.error('❌ Spreadsheet creation failed:', createError);
      
      // More detailed error logging
      if (createError && typeof createError === 'object') {
        const error = createError as any;
        console.error('Error details:', {
          status: error.status,
          code: error.code,
          message: error.message,
          response: error.response?.data
        });
      }
      
      return NextResponse.json({
        success: false,
        error: 'Failed to create spreadsheet - Google Sheets API may not be enabled or service account lacks permissions',
        details: createError,
        suggestion: 'Check that Google Sheets API is enabled in Google Cloud Console and service account has Editor role'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Google Sheets API test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 });
  }
}