// API route for processing expired attempts for a specific student
import { NextRequest, NextResponse } from 'next/server';
import { BackgroundSubmissionService } from '@/apiservices/backgroundSubmissionService';

export async function POST(request: NextRequest) {
  try {
    const { studentId } = await request.json();

    if (!studentId) {
      return NextResponse.json(
        { error: 'Student ID is required' },
        { status: 400 }
      );
    }

    // Process expired attempts for the specific student
    await BackgroundSubmissionService.processExpiredAttemptsForStudent(studentId);

    return NextResponse.json({
      success: true,
      message: `Processed expired attempts for student ${studentId}`
    });

  } catch (error) {
    console.error('Error processing expired attempts for student:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process expired attempts',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}