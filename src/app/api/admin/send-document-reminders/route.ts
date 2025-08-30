import { NextRequest, NextResponse } from 'next/server';
import { StudentDocumentService } from '@/apiservices/studentDocumentService';
import { MailService } from '@/apiservices/mailService';

// POST - Send document reminder emails to students who haven't submitted documents
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type = 'all', isUrgent = false } = body;
    
    console.log(`Starting document reminder email batch - Type: ${type}, Urgent: ${isUrgent}`);
    
    // Get students with missing documents
    let studentsWithMissingDocs;
    if (type === 'no_documents') {
      // Only students who haven't submitted ANY documents
      studentsWithMissingDocs = await StudentDocumentService.getStudentsWithNoDocuments();
    } else {
      // All students with any missing documents (default)
      studentsWithMissingDocs = await StudentDocumentService.getStudentsWithMissingDocuments();
    }
    
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
    
    // Send reminder emails
    const results = [];
    let successful = 0;
    let failed = 0;
    
    for (const student of studentsWithMissingDocs) {
      try {
        // Only send if we have parent information
        if (!student.parent || !student.parent.email) {
          console.warn(`Skipping ${student.name} - no parent email found`);
          results.push({
            studentId: student.id,
            studentName: student.name,
            studentEmail: student.email,
            success: false,
            error: 'No parent email available',
            missingDocsCount: student.missingDocuments.length
          });
          failed++;
          continue;
        }
        
        const mailIds = await MailService.sendDocumentReminderEmails(
          student.name,
          student.email,
          student.parent.name,
          student.parent.email,
          student.missingDocuments,
          isUrgent
        );
        
        results.push({
          studentId: student.id,
          studentName: student.name,
          studentEmail: student.email,
          parentName: student.parent.name,
          parentEmail: student.parent.email,
          studentMailId: mailIds.studentMailId,
          parentMailId: mailIds.parentMailId,
          success: true,
          missingDocsCount: student.missingDocuments.length,
          missingDocTypes: student.missingDocuments.map(doc => doc.type)
        });
        
        successful++;
        console.log(`✅ Sent reminder to ${student.name} and ${student.parent.name}`);
        
      } catch (error) {
        console.error(`❌ Failed to send reminder to ${student.name}:`, error);
        results.push({
          studentId: student.id,
          studentName: student.name,
          studentEmail: student.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          missingDocsCount: student.missingDocuments.length
        });
        failed++;
      }
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
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all';
    
    // Get students with missing documents
    let studentsWithMissingDocs;
    if (type === 'no_documents') {
      studentsWithMissingDocs = await StudentDocumentService.getStudentsWithNoDocuments();
    } else {
      studentsWithMissingDocs = await StudentDocumentService.getStudentsWithMissingDocuments();
    }
    
    // Transform for preview
    const preview = studentsWithMissingDocs.map(student => ({
      id: student.id,
      name: student.name,
      email: student.email,
      parentName: student.parent?.name || 'No parent info',
      parentEmail: student.parent?.email || 'No parent email',
      hasParentEmail: !!(student.parent?.email),
      missingDocumentsCount: student.missingDocuments.length,
      missingDocumentTypes: student.missingDocuments.map(doc => doc.name)
    }));
    
    const stats = {
      total: preview.length,
      withParentEmail: preview.filter(s => s.hasParentEmail).length,
      withoutParentEmail: preview.filter(s => !s.hasParentEmail).length,
      averageMissingDocs: preview.length > 0 
        ? Math.round((preview.reduce((sum, s) => sum + s.missingDocumentsCount, 0) / preview.length) * 10) / 10 
        : 0
    };
    
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
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
