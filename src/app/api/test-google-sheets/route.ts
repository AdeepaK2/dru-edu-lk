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

    // Try to create a test spreadsheet
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: 'API Test - ' + new Date().toISOString(),
        },
      },
    });

    const spreadsheetId = createResponse.data.spreadsheetId;
    console.log('✅ Test spreadsheet created:', spreadsheetId);

    // Clean up - delete the test spreadsheet
    const drive = google.drive({ version: 'v3', auth });
    await drive.files.delete({ fileId: spreadsheetId! });
    console.log('🗑️ Test spreadsheet deleted');

    return NextResponse.json({
      success: true,
      message: 'Google Sheets API is working correctly',
      testSpreadsheetId: spreadsheetId
    });

  } catch (error) {
    console.error('❌ Google Sheets API test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 });
  }
}