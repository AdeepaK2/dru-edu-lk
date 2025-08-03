import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdmin } from '@/utils/firebase-server';
import { Timestamp } from 'firebase-admin/firestore';

// This API route checks for students who didn't attempt recently ended tests
// and sends notification emails to their parents
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Starting missed test attempt check...');

    // Verify cron job authorization (optional security measure)
    // Temporarily disabled for testing
    /*
    const apiKey = request.headers.get('x-api-key');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && apiKey !== cronSecret) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API Key' },
        { status: 401 }
      );
    }
    */

    // Calculate time range - check tests that ended in the last 2 hours
    const now = Timestamp.now();
    const twoHoursAgo = Timestamp.fromMillis(now.toMillis() - (2 * 60 * 60 * 1000));

    console.log('🕒 Checking tests ended between:', twoHoursAgo.toDate(), 'and', now.toDate());

    // Get tests that ended in the last 2 hours
    const recentlyEndedTests = await getRecentlyEndedTests(twoHoursAgo, now);
    
    console.log(`📊 Found ${recentlyEndedTests.length} recently ended tests`);

    if (recentlyEndedTests.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No recently ended tests found',
        testsChecked: 0,
        emailsSent: 0
      });
    }

    let totalEmailsSent = 0;
    const processedTests = [];

    // Process each test
    for (const test of recentlyEndedTests) {
      try {
        console.log(`🧪 Processing test: ${test.title} (ID: ${test.id})`);
        
        const emailsSent = await processTestForMissedAttempts(test);
        totalEmailsSent += emailsSent;
        
        processedTests.push({
          testId: test.id,
          testTitle: test.title,
          emailsSent
        });

      } catch (error) {
        console.error(`❌ Error processing test ${test.id}:`, error);
        processedTests.push({
          testId: test.id,
          testTitle: test.title || 'Unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`✅ Completed check. Total emails sent: ${totalEmailsSent}`);

    return NextResponse.json({
      success: true,
      message: `Processed ${recentlyEndedTests.length} tests, sent ${totalEmailsSent} notification emails`,
      testsChecked: recentlyEndedTests.length,
      emailsSent: totalEmailsSent,
      processedTests
    });

  } catch (error) {
    console.error('❌ Error in missed test attempt check:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Get tests that ended in the specified time range
async function getRecentlyEndedTests(startTime: Timestamp, endTime: Timestamp): Promise<any[]> {
  const tests: any[] = [];
  
  try {
    // Query for live tests
    const liveTestsQuery = firebaseAdmin.db
      .collection('tests')
      .where('type', '==', 'live')
      .where('actualEndTime', '>=', startTime)
      .where('actualEndTime', '<=', endTime);
    
    const liveTestsSnapshot = await liveTestsQuery.get();
    
    liveTestsSnapshot.forEach((doc: any) => {
      tests.push({ id: doc.id, ...doc.data() });
    });

    // Query for flexible tests (check availableTo)
    const flexTestsQuery = firebaseAdmin.db
      .collection('tests')
      .where('type', '==', 'flexible')
      .where('availableTo', '>=', startTime)
      .where('availableTo', '<=', endTime);
    
    const flexTestsSnapshot = await flexTestsQuery.get();
    
    flexTestsSnapshot.forEach((doc: any) => {
      tests.push({ id: doc.id, ...doc.data() });
    });

    console.log(`📋 Found ${tests.length} tests that ended in time range`);
    return tests;

  } catch (error) {
    console.error('Error fetching recently ended tests:', error);
    return [];
  }
}

// Process a single test for missed attempts
async function processTestForMissedAttempts(test: any): Promise<number> {
  try {
    // Get all students enrolled in the test's classes
    const enrolledStudents = await getEnrolledStudents(test.classIds);
    console.log(`👥 Found ${enrolledStudents.length} enrolled students for test ${test.title}`);

    if (enrolledStudents.length === 0) {
      return 0;
    }

    // Get all attempts for this test
    const testAttempts = await getTestAttempts(test.id);
    console.log(`📝 Found ${testAttempts.length} attempts for test ${test.title}`);

    // Find students who didn't attempt the test
    const missedStudents = enrolledStudents.filter(student => 
      !testAttempts.some(attempt => attempt.studentId === student.id)
    );

    console.log(`❌ Found ${missedStudents.length} students who missed test ${test.title}`);

    if (missedStudents.length === 0) {
      return 0;
    }

    // Send emails to parents of students who missed the test
    let emailsSent = 0;
    
    for (const student of missedStudents) {
      try {
        await sendMissedTestEmail(student, test);
        emailsSent++;
        console.log(`📧 Sent email to parent of ${student.name}`);
      } catch (error) {
        console.error(`❌ Failed to send email for student ${student.name}:`, error);
      }
    }

    return emailsSent;

  } catch (error) {
    console.error(`Error processing test ${test.id} for missed attempts:`, error);
    return 0;
  }
}

// Get students enrolled in the specified classes
async function getEnrolledStudents(classIds: string[]): Promise<any[]> {
  try {
    if (!classIds || classIds.length === 0) {
      return [];
    }

    const students: any[] = [];

    // Get enrollments for these classes
    const enrollmentsQuery = firebaseAdmin.db
      .collection('studentEnrollments')
      .where('classId', 'in', classIds)
      .where('status', '==', 'approved');

    const enrollmentsSnapshot = await enrollmentsQuery.get();
    const studentIds = new Set<string>();

    enrollmentsSnapshot.forEach((doc: any) => {
      const enrollment = doc.data();
      studentIds.add(enrollment.studentId);
    });

    console.log(`👥 Found ${studentIds.size} unique enrolled students`);

    // Get student details
    if (studentIds.size > 0) {
      // Firestore 'in' queries are limited to 10 items, so batch if needed
      const studentIdArray = Array.from(studentIds);
      const batches = [];
      
      for (let i = 0; i < studentIdArray.length; i += 10) {
        const batch = studentIdArray.slice(i, i + 10);
        batches.push(batch);
      }

      for (const batch of batches) {
        const studentsQuery = firebaseAdmin.db
          .collection('students')
          .where('id', 'in', batch);
        
        const studentsSnapshot = await studentsQuery.get();
        
        studentsSnapshot.forEach((doc: any) => {
          const studentData = doc.data();
          students.push({
            id: doc.id,
            ...studentData
          });
        });
      }
    }

    return students;

  } catch (error) {
    console.error('Error getting enrolled students:', error);
    return [];
  }
}

// Get all attempts for a specific test
async function getTestAttempts(testId: string): Promise<any[]> {
  try {
    const attemptsQuery = firebaseAdmin.db
      .collection('studentSubmissions')
      .where('testId', '==', testId);

    const attemptsSnapshot = await attemptsQuery.get();
    const attempts: any[] = [];

    attemptsSnapshot.forEach((doc: any) => {
      attempts.push({ id: doc.id, ...doc.data() });
    });

    return attempts;

  } catch (error) {
    console.error(`Error getting test attempts for test ${testId}:`, error);
    return [];
  }
}

// Send email notification to parent about missed test
async function sendMissedTestEmail(student: any, test: any) {
  try {
    const parentEmail = student.parent?.email;
    
    if (!parentEmail) {
      console.warn(`No parent email found for student ${student.name}`);
      return;
    }

    // Format the test end time
    const endTime = formatTestEndTime(test);
    const testType = test.type === 'live' ? 'Live Test' : 'Flexible Test';

    const emailData = {
      to: parentEmail,
      message: {
        subject: `Test Not Attempted - ${student.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #dc3545; margin-top: 0;">Test Not Attempted</h2>
            </div>
            
            <p>Dear ${student.parent?.name || 'Parent/Guardian'},</p>
            
            <p>We hope this message finds you well. We are writing to inform you that your child <strong>${student.name}</strong> did not attempt the following test:</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057;">Test Details</h3>
              <p><strong>Test Title:</strong> ${test.title}</p>
              <p><strong>Subject:</strong> ${test.subjectName}</p>
              <p><strong>Test Type:</strong> ${testType}</p>
              <p><strong>Test Ended:</strong> ${endTime}</p>
              ${test.description ? `<p><strong>Description:</strong> ${test.description}</p>` : ''}
            </div>
            
            <p>Please discuss with your child about the importance of participating in all scheduled assessments. If there were any technical difficulties or other issues that prevented participation, please contact us so we can assist.</p>
            
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>What to do next:</strong></p>
              <ul style="margin: 10px 0;">
                <li>Speak with ${student.name} about the missed test</li>
                <li>Contact the teacher if there were technical issues</li>
                <li>Ensure ${student.name} is prepared for upcoming tests</li>
              </ul>
            </div>
            
            <p>If you have any questions or concerns, please don't hesitate to contact us.</p>
            
            <p>Best regards,<br>
            <strong>Academic Team</strong><br>
            DRU Education</p>
            
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            <p style="font-size: 12px; color: #6c757d;">
              This is an automated notification. Please do not reply to this email.
            </p>
          </div>
        `
      }
    };

    // Add to Firebase mail collection for sending
    await firebaseAdmin.db.collection('mail').add(emailData);
    
    console.log(`📧 Queued email for parent of ${student.name} (${parentEmail})`);

  } catch (error) {
    console.error(`Error sending missed test email for student ${student.name}:`, error);
    throw error;
  }
}

// Format test end time for display
function formatTestEndTime(test: any): string {
  try {
    let endTime: Date;

    if (test.type === 'live') {
      endTime = test.actualEndTime?.toDate?.() || new Date(test.actualEndTime);
    } else {
      endTime = test.availableTo?.toDate?.() || new Date(test.availableTo);
    }

    return endTime.toLocaleString('en-AU', {
      timeZone: 'Australia/Melbourne',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting test end time:', error);
    return 'Unknown time';
  }
}

// Also support GET requests for manual testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Missed Test Attempt Checker API',
    usage: 'POST to this endpoint to check for missed test attempts and send parent notifications',
    note: 'This endpoint is designed to be called by cron jobs'
  });
}
