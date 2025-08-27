import { NextRequest, NextResponse } from 'next/server';
import { StudentFirestoreService } from '@/apiservices/studentFirestoreService';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';

export async function GET(req: NextRequest) {
  try {
    // Check API key for authorization
    const apiKey = req.headers.get('x-api-key');
    const configuredApiKey = process.env.DRUPAY_API_KEY;
    
    if (!apiKey || apiKey !== configuredApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized access. Invalid API key.' },
        { status: 401 }
      );
    }
    
    // Get students and classes data
    const students = await StudentFirestoreService.getAllStudents();
    const classes = await ClassFirestoreService.getAllClasses();
    
    // Return the data
    return NextResponse.json({
      students,
      classes,
      timestamp: new Date().toISOString(),
      count: {
        students: students.length,
        classes: classes.length
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching data for drupay:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
