import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  try {
    console.log('🔍 Testing Google Sheets API configuration...');
    
    // Check environment variables
    const requiredEnvVars = [
      'GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL',
      'GOOGLE_SHEETS_PRIVATE_KEY',
      'GOOGLE_SHEETS_PROJECT_ID'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Missing environment variables: ${missingVars.join(', ')}`
      }, { status: 500 });
    }

    // Initialize Google Auth
    const auth = new google.auth.GoogleAuth({
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

    // Test creating a simple spreadsheet
    const sheets = google.sheets({ version: 'v4', auth });
    
    const testResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `API Test Sheet - ${new Date().toISOString()}`,
        },
        sheets: [{
          properties: {
            title: 'Test Sheet',
            gridProperties: {
              rowCount: 10,
              columnCount: 5
            }
          }
        }]
      },
    });

    const spreadsheetId = testResponse.data.spreadsheetId;
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // Add some test data
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId!,
      range: 'A1:B2',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['Test Status', 'SUCCESS ✅'],
          ['Created At', new Date().toISOString()]
        ]
      }
    });

    // Clean up - delete the test sheet
    const drive = google.drive({ version: 'v3', auth });
    await drive.files.delete({
      fileId: spreadsheetId!
    });

    console.log('✅ Google Sheets API test successful');

    return NextResponse.json({
      success: true,
      message: 'Google Sheets API is configured correctly',
      testSpreadsheetId: spreadsheetId,
      environment: {
        serviceAccountEmail: process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL,
        projectId: process.env.GOOGLE_SHEETS_PROJECT_ID,
        hasPrivateKey: !!process.env.GOOGLE_SHEETS_PRIVATE_KEY
      }
    });

  } catch (error) {
    console.error('❌ Google Sheets API test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}