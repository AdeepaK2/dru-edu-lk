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
    
    // Fetch classes data using Firebase Admin directly
    const classesSnapshot = await adminFirestore.collection('classes').get();
    const classes = classesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, // Preserve Firestore ID
        classId: doc.id, // Use Firestore ID as classId for consistent reference
        ...data,
        // Ensure schedule data is properly formatted
        schedule: data.schedule || {
          days: [],
          startTime: '',
          endTime: ''
        }
      };
    });
    
    // Return the data
    return NextResponse.json({
      classes,
      timestamp: new Date().toISOString(),
      count: classes.length
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching classes data for drupay:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch classes data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
