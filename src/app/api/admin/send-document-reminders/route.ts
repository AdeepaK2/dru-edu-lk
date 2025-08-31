import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/utils/firebase-admin';
import { MailService } from '@/apiservices/mailService';
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
      parent: { name: string; email: string } | null;
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
            email: studentData.parent.email || studentData.email || ''
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
    
    // Send reminder emails asynchronously with Promise.all for better performance
    const results = [];
    let successful = 0;
    let failed = 0;
    
    // Process emails in batches to avoid overwhelming the system
    const batchSize = 5; // Process 5 emails at a time
    const batches = [];
    
    for (let i = 0; i < studentsWithMissingDocs.length; i += batchSize) {
      batches.push(studentsWithMissingDocs.slice(i, i + batchSize));
    }
    
    console.log(`Processing ${studentsWithMissingDocs.length} students in ${batches.length} batches of ${batchSize}`);
    
    for (const batch of batches) {
      // Process batch concurrently
      const batchPromises = batch.map(async (student) => {
        try {
          // Send reminder emails to both student and parent
          const mailIds = await MailService.sendDocumentReminderEmails(
            student.name,
            student.email,
            student.parent?.name || 'Parent/Guardian',
            student.parent?.email || student.email,
            student.missingDocuments,
            isUrgent
          );
          
          console.log(`✅ Sent reminder emails to ${student.name} - Student: ${mailIds.studentMailId}, Parent: ${mailIds.parentMailId}`);
          
          return {
            studentId: student.id,
            studentName: student.name,
            studentEmail: student.email,
            parentEmail: student.parent?.email || student.email,
            studentMailId: mailIds.studentMailId,
            parentMailId: mailIds.parentMailId,
            success: true,
            missingDocsCount: student.missingDocuments.length,
            missingDocTypes: student.missingDocuments.map((doc: any) => doc.type)
          };
          
        } catch (error) {
          console.error(`❌ Failed to send reminder emails to ${student.name}:`, error);
          return {
            studentId: student.id,
            studentName: student.name,
            studentEmail: student.email,
            parentEmail: student.parent?.email || student.email,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            missingDocsCount: student.missingDocuments.length
          };
        }
      });
      
      // Wait for current batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Count successes and failures
      batchResults.forEach(result => {
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      });
      
      console.log(`Batch completed. Progress: ${successful + failed}/${studentsWithMissingDocs.length}`);
    }
    
    const summary = {
      total: studentsWithMissingDocs.length,
      successful,
      failed,
      type,
      isUrgent
    };
    
    console.log('✅ Document reminder email batch completed:', summary);
    
    return NextResponse.json({
      message: `Document reminder emails sent successfully. ${successful} successful, ${failed} failed.`,
      summary,
      results
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
      parentEmail: student.parent?.email || student.email,
      missingDocumentsCount: student.missingDocuments.length,
      missingDocumentTypes: student.missingDocuments.map((doc: any) => doc.name)
    }));
    
    const stats = {
      total: preview.length,
      totalEmailsToSend: preview.length * 2, // Both student and parent emails
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
