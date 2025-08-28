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
    
    // Fetch enrollment data using Firebase Admin directly
    const enrollmentsSnapshot = await adminFirestore.collection('studentEnrollments').get();
    const enrollments = enrollmentsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, // Preserve Firestore ID
        enrollmentId: doc.id, // Use Firestore ID as enrollmentId for consistent reference
        ...data,
        // Ensure payment data is properly formatted
        payment: data.payment || {
          status: 'PENDING',
          method: 'NONE'
        }
      };
    });
    
    // Return the data
    return NextResponse.json({
      enrollments,
      timestamp: new Date().toISOString(),
      count: enrollments.length
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching enrollment data for drupay:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch enrollment data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
