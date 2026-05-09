import { NextRequest, NextResponse } from 'next/server';
import { sendRawWhatsAppMessage, formatPhoneForWhatsApp } from '@/utils/whatsappServerUtils';
import { getStudentsWithMissingDocuments } from '@/server/documentReminderService';

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

        // Send directly via Green API (no internal HTTP round-trip)
        const chatId = formatPhoneForWhatsApp(student.parent!.phone);
        const messageWithHeader = `🎓 Message from *DRU Education*:\n\n${message}`;
        const result = await sendRawWhatsAppMessage(chatId, messageWithHeader);

        console.log(`✅ WhatsApp sent to ${student.parent!.name} for ${student.name}: ${result.idMessage}`);
        return {
          studentId: student.id,
          studentName: student.name,
          parentName: student.parent!.name,
          parentPhone: student.parent!.phone,
          success: true,
          messageId: result.idMessage,
          missingDocsCount: student.missingDocuments.length
        };

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
