// API endpoint to extend test deadline
// POST /api/tests/extend-deadline

import { NextRequest, NextResponse } from 'next/server';
import { TestExtensionService } from '@/apiservices/testExtensionService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testId, newDeadline, teacherId, teacherName, reason } = body;

    // Validate required fields
    if (!testId || !newDeadline || !teacherId || !teacherName) {
      return NextResponse.json(
        { error: 'Missing required fields: testId, newDeadline, teacherId, teacherName' },
        { status: 400 }
      );
    }

    // Parse the new deadline
    const deadlineDate = new Date(newDeadline);
    if (isNaN(deadlineDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid deadline date format' },
        { status: 400 }
      );
    }

    // Check if test can be extended
    const canExtend = await TestExtensionService.canExtendTest(testId);
    if (!canExtend.canExtend) {
      return NextResponse.json(
        { error: canExtend.reason },
        { status: 400 }
      );
    }

    // Extend the deadline
    const extension = await TestExtensionService.extendTestDeadline(
      testId,
      deadlineDate,
      teacherId,
      teacherName,
      reason
    );

    return NextResponse.json({
      success: true,
      extension,
      message: 'Test deadline extended successfully'
    });

  } catch (error: any) {
    console.error('Error extending test deadline:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extend test deadline' },
      { status: 500 }
    );
  }
}
