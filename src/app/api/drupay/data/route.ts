import { NextRequest, NextResponse } from 'next/server';
import { StudentFirestoreService } from '@/apiservices/studentFirestoreService';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { getAllEnrollments } from '@/services/studentEnrollmentService';

export async function GET(req: NextRequest) {
  try {
    // Check API key for authorization using CRON_SECRET
    const apiKey = req.headers.get('x-api-key');
    const configuredApiKey = process.env.CRON_SECRET;
    
    if (!apiKey || apiKey !== configuredApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized access. Invalid API key.' },
        { status: 401 }
      );
    }
    
    // Get data type from query params
    const type = req.nextUrl.searchParams.get('type') || 'all';
    
    // Fetch data based on type
    let students: any[] = [];
    let classes: any[] = [];
    let enrollments: any[] = [];
    
    if (type === 'students' || type === 'all') {
      students = await StudentFirestoreService.getAllStudents();
    }
    
    if (type === 'classes' || type === 'all') {
      classes = await ClassFirestoreService.getAllClasses();
    }
    
    if (type === 'enrollments' || type === 'all') {
      enrollments = await getAllEnrollments();
    }
    
    // Return the data
    return NextResponse.json({
      students: type === 'students' || type === 'all' ? students : [],
      classes: type === 'classes' || type === 'all' ? classes : [],
      enrollments: type === 'enrollments' || type === 'all' ? enrollments : [],
      timestamp: new Date().toISOString(),
      count: {
        students: students.length,
        classes: classes.length,
        enrollments: enrollments.length
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
