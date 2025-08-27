import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/utils/firebase-admin';

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
    
    // Fetch data based on type using Firebase Admin directly
    let students: any[] = [];
    let classes: any[] = [];
    let enrollments: any[] = [];
    
    if (type === 'students' || type === 'all') {
      const studentsSnapshot = await adminFirestore.collection('students').get();
      students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    if (type === 'classes' || type === 'all') {
      const classesSnapshot = await adminFirestore.collection('classes').get();
      classes = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    if (type === 'enrollments' || type === 'all') {
      const enrollmentsSnapshot = await adminFirestore.collection('studentEnrollments').get();
      enrollments = enrollmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
