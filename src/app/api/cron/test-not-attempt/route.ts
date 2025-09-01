import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdmin } from '@/utils/firebase-server';
import { Timestamp } from 'firebase-admin/firestore';

// This API route checks for students who didn't attempt recently ended tests
// and sends notification emails to their parents
export async function GET(request: NextRequest) {
  try {
    // Verify this is a valid cron job request (Vercel sets specific headers)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.error('❌ Unauthorized cron request:', { authHeader, expected: `Bearer ${cronSecret}` });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('🔍 Starting missed test attempt check...');

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
    console.log('🔍 Fetching all tests to check end times...');
    
    // Get all tests and filter them in memory to avoid complex index requirements
    const allTestsQuery = firebaseAdmin.db.collection('tests');
    const allTestsSnapshot = await allTestsQuery.get();
    
    console.log(`📋 Retrieved ${allTestsSnapshot.size} total tests for filtering`);
    
    allTestsSnapshot.forEach((doc: any) => {
      const testData = doc.data();
      let testEndTime: any = null;
      
      // Determine the end time based on test type
      if (testData.type === 'live') {
        testEndTime = testData.actualEndTime;
      } else if (testData.type === 'flexible') {
        testEndTime = testData.availableTo;
      }
      
      // Check if the test ended in our time range
      if (testEndTime) {
        try {
          // Convert to milliseconds based on the timestamp format
          let endTimeMillis: number;
          
          if (typeof testEndTime.toMillis === 'function') {
            // It's a Firestore Timestamp
            endTimeMillis = testEndTime.toMillis();
          } else if ((testEndTime as any).seconds !== undefined) {
            // It's a Firestore Timestamp object with seconds property
            endTimeMillis = (testEndTime as any).seconds * 1000 + ((testEndTime as any).nanoseconds || 0) / 1000000;
          } else if (testEndTime instanceof Date) {
            // It's a Date object
            endTimeMillis = testEndTime.getTime();
          } else if (typeof testEndTime === 'string') {
            // It's a date string
            endTimeMillis = new Date(testEndTime).getTime();
          } else if (typeof testEndTime === 'number') {
            // It's already milliseconds
            endTimeMillis = testEndTime;
          } else {
            console.warn(`⚠️ Unknown timestamp format for test ${testData.title}:`, testEndTime);
            return; // Skip this test
          }
          
          // Check if the test ended in our time range
          if (endTimeMillis >= startTime.toMillis() && endTimeMillis <= endTime.toMillis()) {
            tests.push({ 
              id: doc.id, 
              ...testData,
              endTime: testEndTime // Store the actual end time for reference
            });
            
            const endDate = new Date(endTimeMillis);
            console.log(`✅ Found test: ${testData.title} (${testData.type}) ended at ${endDate.toISOString()}`);
          }
        } catch (error) {
          console.error(`❌ Error processing timestamp for test ${testData.title}:`, error, 'Timestamp:', testEndTime);
        }
      }
    });

    console.log(`🎯 Filtered to ${tests.length} tests that ended in time range`);
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

    // Get enrollments for these classes (batch the classIds if needed)
    const enrollmentBatches = [];
    for (let i = 0; i < classIds.length; i += 10) {
      const batch = classIds.slice(i, i + 10);
      enrollmentBatches.push(batch);
    }

    const studentIds = new Set<string>();

    for (const classBatch of enrollmentBatches) {
      const enrollmentsQuery = firebaseAdmin.db
        .collection('studentEnrollments')
        .where('classId', 'in', classBatch)
        .where('status', '==', 'Active');

      const enrollmentsSnapshot = await enrollmentsQuery.get();

      enrollmentsSnapshot.forEach((doc: any) => {
        const enrollment = doc.data();
        studentIds.add(enrollment.studentId);
      });
    }

    console.log(`👥 Found ${studentIds.size} unique enrolled students`);

    // Get student details by document ID
    if (studentIds.size > 0) {
      const studentIdArray = Array.from(studentIds);
      
      for (const studentId of studentIdArray) {
        try {
          const studentDoc = await firebaseAdmin.db
            .collection('students')
            .doc(studentId)
            .get();
          
          if (studentDoc.exists) {
            const studentData = studentDoc.data();
            students.push({
              id: studentDoc.id,
              ...studentData
            });
          }
        } catch (error) {
          console.warn(`⚠️ Could not fetch student ${studentId}:`, error);
        }
      }
    }

    console.log(`✅ Successfully retrieved ${students.length} student records`);
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
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Test Not Attempted</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0; font-size: 28px;">Test Not Attempted</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Important notification about ${student.name}</p>
            </div>
            
            <div style="background: white; padding: 30px; border: 1px solid #ddd; border-top: none;">
              <p style="margin-top: 0;">Dear ${student.parent?.name || 'Parent/Guardian'},</p>
              
              <p>We hope this message finds you well. We are writing to inform you that your child <strong>${student.name}</strong> did not attempt the following test:</p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #dc3545;">
                <h3 style="margin: 0 0 15px 0; color: #01143d; font-size: 18px;">Test Details</h3>
                <p style="margin: 8px 0; color: #666;"><strong>Test Title:</strong> ${test.title}</p>
                <p style="margin: 8px 0; color: #666;"><strong>Subject:</strong> ${test.subjectName || 'N/A'}</p>
                <p style="margin: 8px 0; color: #666;"><strong>Test Type:</strong> ${testType}</p>
                <p style="margin: 8px 0; color: #666;"><strong>Test Ended:</strong> ${endTime}</p>
                ${test.description ? `<p style="margin: 8px 0; color: #666;"><strong>Description:</strong> ${test.description}</p>` : ''}
              </div>
              
              <p>Please discuss with your child about the importance of participating in all scheduled assessments. If there were any technical difficulties or other issues that prevented participation, please contact us so we can assist.</p>
              
              <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #0088e0; font-size: 16px;">What to do next:</h3>
                <ul style="margin: 0; padding-left: 20px; color: #666;">
                  <li style="margin: 8px 0;">Speak with ${student.name} about the missed test</li>
                  <li style="margin: 8px 0;">Contact the teacher if there were technical issues</li>
                  <li style="margin: 8px 0;">Ensure ${student.name} is prepared for upcoming tests</li>
                  <li style="margin: 8px 0;">Check the student portal for any makeup test opportunities</li>
                </ul>
              </div>
              
              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
                <p style="margin: 0; color: #856404;"><strong>Contact Information:</strong></p>
                <p style="margin: 8px 0 0 0; color: #856404;">If you have any questions or concerns, please contact us at <a href="mailto:support@dru-edu.com" style="color: #0088e0;">support@dru-edu.com</a></p>
              </div>
              
              <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="margin: 0; color: #666;">Best regards,</p>
                <p style="margin: 5px 0; font-weight: bold; color: #01143d;">Academic Team</p>
                <p style="margin: 0; color: #666;">DRU Education</p>
              </div>
              
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 25px; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #6c757d;">
                  This is an automated notification. Please do not reply to this email.
                </p>
              </div>
            </div>
          </body>
          </html>
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
      const actualEndTime = test.actualEndTime;
      if (typeof actualEndTime?.toDate === 'function') {
        endTime = actualEndTime.toDate();
      } else if (actualEndTime instanceof Date) {
        endTime = actualEndTime;
      } else if (typeof actualEndTime === 'string') {
        endTime = new Date(actualEndTime);
      } else if ((actualEndTime as any)?.seconds !== undefined) {
        // Firestore Timestamp object
        endTime = new Date((actualEndTime as any).seconds * 1000);
      } else {
        endTime = new Date(actualEndTime);
      }
    } else {
      const availableTo = test.availableTo;
      if (typeof availableTo?.toDate === 'function') {
        endTime = availableTo.toDate();
      } else if (availableTo instanceof Date) {
        endTime = availableTo;
      } else if (typeof availableTo === 'string') {
        endTime = new Date(availableTo);
      } else if ((availableTo as any)?.seconds !== undefined) {
        // Firestore Timestamp object
        endTime = new Date((availableTo as any).seconds * 1000);
      } else {
        endTime = new Date(availableTo);
      }
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

// Also support POST requests for manual testing/alternative access
export async function POST(request: NextRequest) {
  // Delegate to GET function for consistency
  return GET(request);
}
