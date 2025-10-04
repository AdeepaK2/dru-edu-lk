// API endpoint to clear extension refresh flags
// POST /api/tests/clear-extension-flags

import { NextRequest, NextResponse } from 'next/server';
import { TestExtensionService } from '@/apiservices/testExtensionService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testId, studentId } = body;

    // Validate required fields
    if (!testId) {
      return NextResponse.json(
        { error: 'Missing required field: testId' },
        { status: 400 }
      );
    }

    // Clear extension refresh flags for this test
    await TestExtensionService.clearExtensionRefreshFlags(testId);

    return NextResponse.json({
      success: true,
      message: 'Extension refresh flags cleared successfully'
    });

  } catch (error: any) {
    console.error('Error clearing extension refresh flags:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clear extension refresh flags' },
      { status: 500 }
    );
  }
}