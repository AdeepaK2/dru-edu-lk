import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/utils/firebase-admin';
import { DocumentType } from '@/models/studentSchema';

// Helper function to generate WhatsApp message for document reminder
function generateDocumentReminderMessage(
  studentName: string,
  parentName: string,
  missingDocuments: Array<{ type: string; name: string; url: string }>,
  isUrgent: boolean = false
): string {
  const urgentPrefix = isUrgent ? '🚨 *URGENT REMINDER* 🚨\n\n' : '📄 *DOCUMENT REMINDER*\n\n';
  
  const documentsList = missingDocuments.map((doc, index) => {
    const emoji = doc.type === 'Class Policy Agreement' ? '📜' : 
                 doc.type === 'Parent/Guardian Notice' ? '👨‍👩‍👧‍👦' : '📸';
    return `${index + 1}. ${emoji} *${doc.name}*\n   Link: ${doc.url}`;
  }).join('\n\n');

  const urgentNote = isUrgent ? 
    '\n⚠️ *IMMEDIATE ACTION REQUIRED*\nYour child\'s class attendance may be affected if these documents are not submitted today. Please prioritize submitting these documents to ensure uninterrupted access to physical classes.' :
    '\n📋 Please submit these documents at your earliest convenience to ensure smooth class operations.';

  return `${urgentPrefix}Dear *${parentName}*,

This is a reminder that your child *${studentName}* has not yet submitted the required documents for physical classes at *Dr U Education*.

*Missing Documents:*
${documentsList}

${urgentNote}

*How to Submit:*
1. Click on the document links above
2. Download and fill out each form
3. Submit the completed documents to your teacher or admin

If you have any questions or need assistance, please contact us immediately.

Thank you for your cooperation.

*Dr U Education Team*
📞 Contact us if you need help`;
}

// Helper function to send WhatsApp messages using the existing WhatsApp API
async function sendDocumentRemindersViaWhatsApp(
  studentsWithMissingDocs: Array<{
    id: string;
    name: string;
    parent: { name: string; phone: string } | null;
    missingDocuments: Array<{ type: string; name: string; url: string }>;
  }>,
  isUrgent: boolean = false
): Promise<{
  successful: number;
  failed: number;
  results: Array<{
    studentId: string;
    studentName: string;
    parentName: string;
    parentPhone: string;
    success: boolean;
    messageId?: string;
    error?: string;
    missingDocsCount: number;
  }>;
}> {
  const results = [];
  let successful = 0;
  let failed = 0;

  // Process students with valid parent phone numbers
  const studentsWithParentPhone = studentsWithMissingDocs.filter(student => 
    student.parent?.phone && student.parent.phone.trim() !== ''
  );

  console.log(`Processing ${studentsWithParentPhone.length} students with parent phone numbers out of ${studentsWithMissingDocs.length} total`);

  // Process in batches to respect WhatsApp rate limits
  const batchSize = 3;
  const batches = [];
  
  for (let i = 0; i < studentsWithParentPhone.length; i += batchSize) {
    batches.push(studentsWithParentPhone.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const batchPromises = batch.map(async (student) => {
      try {
        // Generate the WhatsApp message
        const message = generateDocumentReminderMessage(
          student.name,
          student.parent!.name,
          student.missingDocuments,
          isUrgent
        );

        // Prepare WhatsApp API request
        const whatsappRequest = {
          recipients: [{
            phone: student.parent!.phone,
            name: student.parent!.name,
            type: 'parent' as const,
            studentName: student.name
          }],
          message: message,
          teacherName: 'DRU Education',
          className: 'Document Management'
        };

        // Send via existing WhatsApp API (internal server call)
        const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000';
        const whatsappUrl = baseUrl.startsWith('http') ? `${baseUrl}/api/whatsapp` : `https://${baseUrl}/api/whatsapp`;
        
        const response = await fetch(whatsappUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(whatsappRequest)
        });

        if (!response.ok) {
          throw new Error(`WhatsApp API error: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success && result.results && result.results.length > 0) {
          const messageResult = result.results[0];
          if (messageResult.success) {
            console.log(`✅ WhatsApp sent to ${student.parent!.name} for ${student.name}: ${messageResult.messageId}`);
            return {
              studentId: student.id,
              studentName: student.name,
              parentName: student.parent!.name,
              parentPhone: student.parent!.phone,
              success: true,
              messageId: messageResult.messageId,
              missingDocsCount: student.missingDocuments.length
            };
          } else {
            throw new Error(messageResult.error || 'Unknown WhatsApp error');
          }
        } else {
          throw new Error(result.error || 'Failed to send WhatsApp message');
        }

      } catch (error) {
        console.error(`❌ Failed WhatsApp to ${student.parent?.name} for ${student.name}:`, error);
        return {
          studentId: student.id,
          studentName: student.name,
          parentName: student.parent?.name || 'Unknown',
          parentPhone: student.parent?.phone || 'Not provided',
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
    
    console.log(`Batch completed. Progress: ${successful + failed}/${studentsWithParentPhone.length}`);
    
    // Add delay between batches for WhatsApp rate limiting
    if (batch !== batches[batches.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Add entries for students without parent phone numbers
  const studentsWithoutPhone = studentsWithMissingDocs.filter(student => 
    !student.parent?.phone || student.parent.phone.trim() === ''
  );

  studentsWithoutPhone.forEach(student => {
    results.push({
      studentId: student.id,
      studentName: student.name,
      parentName: student.parent?.name || 'Unknown',
      parentPhone: 'Not provided',
      success: false,
      error: 'No parent phone number provided',
      missingDocsCount: student.missingDocuments.length
    });
    failed++;
  });

  return {
    successful,
    failed,
    results
  };
}

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
    
    // Send WhatsApp reminders to parents using existing WhatsApp API
    const whatsappResult = await sendDocumentRemindersViaWhatsApp(
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
