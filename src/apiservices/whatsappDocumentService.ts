import { DocumentType } from '@/models/studentSchema';

export class WhatsAppDocumentService {
  private static readonly WHATSAPP_API_URL = '/api/whatsapp';

  // Generate WhatsApp message for document reminder
  static generateDocumentReminderMessage(
    studentName: string,
    parentName: string,
    missingDocuments: Array<{ type: string; name: string; url: string }>,
    isUrgent: boolean = true
  ): string {
    const urgentPrefix = isUrgent ? '🚨 *URGENT REMINDER* 🚨\n\n' : '📄 *DOCUMENT REMINDER*\n\n';
    
    const documentsList = missingDocuments.map((doc, index) => {
      const emoji = doc.type === 'Class Policy Agreement' ? '📜' : 
                   doc.type === 'Parent/Guardian Notice' ? '👨‍👩‍👧‍👦' : '📸';
      return `${index + 1}. ${emoji} *${doc.name}*\n   📄 ${doc.url}`;
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
1. Click on the document links above to download forms
2. Fill out each form completely and sign where required
3. Submit completed documents via LMS → Documents tab

If you have any questions or need assistance, please contact us immediately.

Thank you for your cooperation.

*Dr U Education Team*
📞 Contact us if you need help`;
  }

  // Send WhatsApp document reminder to parent only
  static async sendDocumentReminderToParent(
    studentName: string,
    parentName: string,
    parentPhone: string,
    missingDocuments: Array<{ type: string; name: string; url: string }>,
    isUrgent: boolean = false
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Generate the message
      const message = this.generateDocumentReminderMessage(
        studentName,
        parentName,
        missingDocuments,
        isUrgent
      );

      // Prepare WhatsApp API request
      const whatsappRequest = {
        recipients: [{
          phone: parentPhone,
          name: parentName,
          type: 'parent' as const,
          studentName: studentName
        }],
        message: message,
        teacherName: 'DRU Education',
        className: 'Document Management'
      };

      // Send via WhatsApp API
      const response = await fetch(this.WHATSAPP_API_URL, {
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
          return {
            success: true,
            messageId: messageResult.messageId
          };
        } else {
          return {
            success: false,
            error: messageResult.error || 'Unknown WhatsApp error'
          };
        }
      } else {
        return {
          success: false,
          error: result.error || 'Failed to send WhatsApp message'
        };
      }

    } catch (error) {
      console.error('Error sending WhatsApp document reminder:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Send document reminders to multiple parents
  static async sendDocumentReminders(
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

    // Process in batches to avoid overwhelming WhatsApp API
    const batchSize = 3; // Smaller batch for WhatsApp to avoid rate limiting
    const batches = [];
    
    for (let i = 0; i < studentsWithMissingDocs.length; i += batchSize) {
      batches.push(studentsWithMissingDocs.slice(i, i + batchSize));
    }

    console.log(`Processing ${studentsWithMissingDocs.length} WhatsApp reminders in ${batches.length} batches of ${batchSize}`);

    for (const batch of batches) {
      const batchPromises = batch.map(async (student) => {
        // Skip if no parent contact info
        if (!student.parent?.phone) {
          return {
            studentId: student.id,
            studentName: student.name,
            parentName: 'Unknown',
            parentPhone: 'Not provided',
            success: false,
            error: 'No parent phone number provided',
            missingDocsCount: student.missingDocuments.length
          };
        }

        try {
          const result = await this.sendDocumentReminderToParent(
            student.name,
            student.parent.name,
            student.parent.phone,
            student.missingDocuments,
            isUrgent
          );

          console.log(`${result.success ? '✅' : '❌'} WhatsApp reminder to ${student.parent.name} for ${student.name}: ${result.success ? result.messageId : result.error}`);

          return {
            studentId: student.id,
            studentName: student.name,
            parentName: student.parent.name,
            parentPhone: student.parent.phone,
            success: result.success,
            messageId: result.messageId,
            error: result.error,
            missingDocsCount: student.missingDocuments.length
          };

        } catch (error) {
          console.error(`❌ Failed to send WhatsApp reminder for ${student.name}:`, error);
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
      
      console.log(`Batch completed. Progress: ${successful + failed}/${studentsWithMissingDocs.length}`);
      
      // Add delay between batches to respect WhatsApp rate limits
      if (batch !== batches[batches.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    return {
      successful,
      failed,
      results
    };
  }
}
