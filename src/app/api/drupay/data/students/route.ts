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
    
    // Fetch students data using Firebase Admin directly
    const studentsSnapshot = await adminFirestore.collection('students').get();
    const students = studentsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, // Preserve Firestore ID
        sid: doc.id, // Use Firestore ID as sid for consistent reference
        ...data,
      };
    });
    
    // Return the data
    return NextResponse.json({
      students,
      timestamp: new Date().toISOString(),
      count: students.length
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching students data for drupay:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch students data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
