import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';
import { MailDocument } from '@/models/mailSchema';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a valid cron job request (Vercel sets specific headers)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Running enrollment notification cron job...');

    // Query for pending enrollment requests that haven't been notified
    const pendingRequestsQuery = await firebaseAdmin.db
      .collection('enrollmentRequests')
      .where('status', '==', 'Pending')
      .where('notificationSent', '==', false)
      .get();

    if (pendingRequestsQuery.empty) {
      console.log('✅ No new pending enrollment requests found');
      return NextResponse.json({ 
        message: 'No new pending enrollment requests found',
        count: 0 
      });
    }

    const pendingRequests = pendingRequestsQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📧 Found ${pendingRequests.length} new enrollment requests to notify about`);

    // Process each enrollment request
    const emailPromises = pendingRequests.map(async (request: any) => {
      try {
        // Create notification email document
        const emailData: MailDocument = {
          to: 'dru.coordinator@gmail.com',
          subject: `New Enrollment Request - ${request.student.name}`,
          html: generateNotificationEmailHTML(request),
          processed: false
        };

        // Add email to mail collection for processing
        await firebaseAdmin.db.collection('mail').add(emailData);

        // Mark enrollment request as notified
        await firebaseAdmin.db
          .collection('enrollmentRequests')
          .doc(request.id)
          .update({
            notificationSent: true,
            notificationSentAt: firebaseAdmin.admin.firestore.Timestamp.now()
          });

        console.log(`✅ Notification sent for enrollment request: ${request.id}`);
        return { success: true, requestId: request.id };

      } catch (error) {
        console.error(`❌ Error processing enrollment request ${request.id}:`, error);
        return { 
          success: false, 
          requestId: request.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Wait for all emails to be processed
    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`🎉 Enrollment notification cron job completed: ${successCount} sent, ${failureCount} failed`);

    return NextResponse.json({
      message: 'Enrollment notification cron job completed',
      totalRequests: pendingRequests.length,
      successCount,
      failureCount,
      results
    });

  } catch (error) {
    console.error('❌ Error in enrollment notification cron job:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

function generateNotificationEmailHTML(enrollmentRequest: any): string {
  const studentInfo = enrollmentRequest.student;
  const submittedAt = enrollmentRequest.createdAt?.toDate?.() || new Date();
  const timeAgo = getTimeAgo(submittedAt);

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Enrollment Request</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 24px; }
            .info-section { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 5px 0; }
            .info-label { font-weight: bold; color: #555; }
            .info-value { color: #333; }
            .action-button { display: inline-block; background: #667eea; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; text-align: center; }
            .action-button:hover { background: #5a67d8; }
            .urgent { color: #e53e3e; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎓 New Enrollment Request</h1>
                <p>Action Required - Student Waiting for Approval</p>
            </div>
            
            <p>Dear Admin,</p>
            
            <p>A new enrollment request has been submitted and requires your attention.</p>
            
            <div class="info-section">
                <h3>📋 Request Details</h3>
                <div class="info-row">
                    <span class="info-label">Student Name:</span>
                    <span class="info-value">${studentInfo.name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${studentInfo.email}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Phone:</span>
                    <span class="info-value">${studentInfo.phone || 'Not provided'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Year Level:</span>
                    <span class="info-value">${studentInfo.year}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">School:</span>
                    <span class="info-value">${studentInfo.school}</span>
                </div>
            </div>
            
            <div class="info-section">
                <h3>📚 Class Information</h3>
                <div class="info-row">
                    <span class="info-label">Class:</span>
                    <span class="info-value">${enrollmentRequest.className}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Subject:</span>
                    <span class="info-value">${enrollmentRequest.subject}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Center:</span>
                    <span class="info-value">${enrollmentRequest.centerName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Monthly Fee:</span>
                    <span class="info-value">$${enrollmentRequest.monthlyFee}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Preferred Start:</span>
                    <span class="info-value">${enrollmentRequest.preferredStartDate}</span>
                </div>
            </div>
            
            <div class="info-section">
                <h3>👨‍👩‍👧‍👦 Parent Information</h3>
                <div class="info-row">
                    <span class="info-label">Name:</span>
                    <span class="info-value">${enrollmentRequest.parent.name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${enrollmentRequest.parent.email}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Phone:</span>
                    <span class="info-value">${enrollmentRequest.parent.phone}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Relationship:</span>
                    <span class="info-value">${enrollmentRequest.parent.relationship}</span>
                </div>
            </div>
            
            <div class="info-section">
                <h3>⏰ Timing</h3>
                <div class="info-row">
                    <span class="info-label">Submitted:</span>
                    <span class="info-value">${submittedAt.toLocaleString('en-AU', { 
                      timeZone: 'Australia/Melbourne',
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Time Ago:</span>
                    <span class="info-value ${timeAgo.includes('hour') || timeAgo.includes('day') ? 'urgent' : ''}">${timeAgo}</span>
                </div>
            </div>
            
            ${enrollmentRequest.additionalNotes ? `
            <div class="info-section">
                <h3>📝 Additional Notes</h3>
                <p style="margin: 0; padding: 10px; background: #fff; border-radius: 5px; border: 1px solid #e0e0e0;">${enrollmentRequest.additionalNotes}</p>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://dru-edu.vercel.app'}/admin/students" class="action-button">
                    📊 Review in Admin Dashboard
                </a>
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ul>
                <li>Review the student's information and class request</li>
                <li>Check class capacity and availability</li>
                <li>Approve or reject the enrollment request</li>
                <li>Student will be automatically notified of your decision</li>
            </ul>
            
            <div class="footer">
                <p>This is an automated notification from DRU Education Management System</p>
                <p>Please do not reply to this email. Use the admin dashboard to take action.</p>
            </div>
        </div>
    </body>
    </html>
  `;
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  } else {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }
}
