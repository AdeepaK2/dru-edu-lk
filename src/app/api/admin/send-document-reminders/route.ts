import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/utils/firebase-admin';
import { WhatsAppDocumentService } from '@/apiservices/whatsappDocumentService';
import { DocumentType } from '@/models/studentSchema';

// Helper function to get students with missing documents using Firebase Admin
async function getStudentsWithMissingDocuments() {
  try {
    console.log('Fetching students from Firestore using Admin SDK...');
    
    // Get all students from Firestore
    const studentsSnapshot = await adminFirestore.collection('students').get();
    console.log(`Found ${studentsSnapshot.docs.length} students in database`);
    
    const requiredDocuments = [
      {
        type: DocumentType.CLASS_POLICY,
        name: 'Class Policy Agreement',
        url: 'https://drive.google.com/file/d/1YHJxvAfTVMqRJ5YQeD5fFZdXkt81vSr1/view?usp=sharing'
      },
      {
        type: DocumentType.PARENT_NOTICE,
        name: 'Parent/Guardian Notice', 
        url: 'https://drive.google.com/file/d/1j_LO0jWJ2-4WRYBZwMwp0eRnFMqOVM-F/view?usp=sharing'
      },
      {
        type: DocumentType.PHOTO_CONSENT,
        name: 'Photo Consent Form',
        url: 'https://drive.google.com/file/d/1example-photo-consent/view?usp=sharing'
      }
    ];
    
    const studentsWithMissingDocs: Array<{
      id: string;
      name: string;
      email: string;
      parent: { name: string; phone: string } | null;
      missingDocuments: Array<{ type: string; name: string; url: string }>;
    }> = [];
    
    studentsSnapshot.docs.forEach(doc => {
      const studentData = doc.data();
      const studentId = doc.id;
      
      // Only process active students
      if (studentData.status !== 'Active') {
        return;
      }
      
      const submittedDocuments = studentData.documents || [];
      const submittedTypes = submittedDocuments
        .filter((doc: any) => doc.status === 'Verified' || doc.status === 'Pending')
        .map((doc: any) => doc.type);
      
      // Find missing documents
      const missingDocuments = requiredDocuments.filter(
        reqDoc => !submittedTypes.includes(reqDoc.type)
      );
      
      // Only include students with missing documents
      if (missingDocuments.length > 0) {
        studentsWithMissingDocs.push({
          id: studentId,
          name: studentData.name || 'Unknown Student',
          email: studentData.email || '',
          parent: studentData.parent ? {
            name: studentData.parent.name || 'Parent/Guardian',
            phone: studentData.parent.phone || studentData.parent.phoneNumber || ''
          } : null,
          missingDocuments: missingDocuments.map(doc => ({
            type: doc.type,
            name: doc.name,
            url: doc.url
          }))
        });
      }
    });
    
    console.log(`Found ${studentsWithMissingDocs.length} students with missing documents`);
    return studentsWithMissingDocs;
    
  } catch (error) {
    console.error('Error fetching students with missing documents:', error);
    throw error;
  }
}

// POST - Send document reminder emails to students who haven't submitted documents
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type = 'all', isUrgent = false } = body;
    
    console.log(`Starting document reminder email batch - Type: ${type}, Urgent: ${isUrgent}`);
    
    // Get students with missing documents using Firebase Admin
    const studentsWithMissingDocs = await getStudentsWithMissingDocuments();
    
    if (studentsWithMissingDocs.length === 0) {
      return NextResponse.json({
        message: 'No students found with missing documents',
        summary: {
          total: 0,
          successful: 0,
          failed: 0
        }
      });
    }
    
    console.log(`Found ${studentsWithMissingDocs.length} students with missing documents`);
    
    // Send WhatsApp reminders to parents
    const whatsappResult = await WhatsAppDocumentService.sendDocumentReminders(
      studentsWithMissingDocs,
      isUrgent
    );
    
    console.log('✅ WhatsApp document reminder batch completed:', {
      total: studentsWithMissingDocs.length,
      successful: whatsappResult.successful,
      failed: whatsappResult.failed
    });

    return NextResponse.json({
      message: `WhatsApp document reminders sent to parents! ${whatsappResult.successful} successful, ${whatsappResult.failed} failed.`,
      summary: {
        total: studentsWithMissingDocs.length,
        successful: whatsappResult.successful,
        failed: whatsappResult.failed,
        type,
        isUrgent
      },
      results: whatsappResult.results
    });
    
  } catch (error) {
    console.error('Error sending document reminder emails:', error);
    return NextResponse.json(
      { 
        error: "Failed to send document reminder emails", 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// GET - Get preview of students who would receive document reminders
export async function GET(req: NextRequest) {
  try {
    console.log('GET /api/admin/send-document-reminders - Starting...');
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all';
    console.log('Preview type:', type);
    
    // Get students with missing documents using Firebase Admin
    const studentsWithMissingDocs = await getStudentsWithMissingDocuments();
    
    console.log(`Found ${studentsWithMissingDocs.length} students`);
    
    // Transform for preview
    const preview = studentsWithMissingDocs.map((student: any) => ({
      id: student.id,
      name: student.name,
      email: student.email,
      parentName: student.parent?.name || 'Parent/Guardian',
      parentPhone: student.parent?.phone || 'Not provided',
      missingDocumentsCount: student.missingDocuments.length,
      missingDocumentTypes: student.missingDocuments.map((doc: any) => doc.name)
    }));
    
    const stats = {
      total: preview.length,
      totalMessagesToSend: preview.filter(s => s.parentPhone !== 'Not provided').length, // Only parents with phone numbers
      averageMissingDocs: preview.length > 0 
        ? Math.round((preview.reduce((sum: any, s: any) => sum + s.missingDocumentsCount, 0) / preview.length) * 10) / 10 
        : 0
    };

    console.log('Preview stats:', stats);
    console.log('Returning preview data successfully');
    
    return NextResponse.json({
      preview,
      stats,
      type
    });
    
  } catch (error) {
    console.error('Error getting document reminder preview:', error);
    return NextResponse.json(
      { 
        error: "Failed to get document reminder preview", 
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
