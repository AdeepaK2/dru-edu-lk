import {
  collection,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { MailDocument, MeetingEmailData } from '@/models/mailSchema';

// Mail service for creating email documents in Firestore
export class MailService {
  private static readonly MAIL_COLLECTION = 'mail';

  // Create a mail document in Firestore using client SDK
  static async createMailDocument(mailData: Omit<MailDocument, 'createdAt' | 'processed'>): Promise<string> {
    try {
      // Use the correct format for Firebase Mail Extension
      const emailData = {
        to: mailData.to,
        message: {
          subject: mailData.subject,
          html: mailData.html
        }
      };

      // Create document using Firebase client SDK
      const docRef = await addDoc(collection(firestore, this.MAIL_COLLECTION), emailData);
      
      console.log('Mail document created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating mail document:', error);
      throw error;
    }
  }

  // Generate homework notification email for student
  static generateHomeworkNotificationEmail(
    studentName: string,
    studentEmail: string,
    homeworkTitle: string,
    homeworkDescription: string,
    teacherName: string,
    subjectName: string,
    className: string,
    dueDate: string,
    homeworkType: 'manual' | 'online',
    materialLink?: string,
    maxMarks?: number,
    instructions?: string
  ): Omit<MailDocument, 'createdAt' | 'processed'> {
    const formattedDueDate = new Date(dueDate).toLocaleString('en-US', { // Changed to toLocaleString for date and time
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const homeworkIcon = '📚';
    const typeLabel = homeworkType === 'online' ? 'Online Submission' : 'Manual Submission';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5; text-align: center;">${homeworkIcon} New Homework Assigned - Dr U Education</h2>
        
        <p>Dear ${studentName},</p>
        
        <p>A new homework assignment has been posted by <strong>${teacherName}</strong> for your <strong>${subjectName}</strong> class.</p>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">📋 Assignment Details</h3>
          <p><strong>Title:</strong> ${homeworkTitle}</p>
          <p><strong>Subject:</strong> ${subjectName}</p>
          <p><strong>Class:</strong> ${className}</p>
          <p><strong>Type:</strong> ${typeLabel}</p>
          <p><strong>Due Date:</strong> ${formattedDueDate}</p>
          ${maxMarks ? `<p><strong>Marks:</strong> ${maxMarks}</p>` : ''}
        </div>

        ${homeworkDescription ? `
        <div style="background-color: #F0FDF4; border-left: 4px solid #22C55E; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Description:</strong></p>
          <p style="margin: 10px 0 0 0; color: #16A34A;">${homeworkDescription}</p>
        </div>
        ` : ''}

        ${instructions ? `
        <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #DC2626;"><strong>📖 Instructions:</strong></p>
          <p style="margin: 10px 0 0 0; color: #7F1D1D;">${instructions}</p>
        </div>
        ` : ''}

        <div style="background-color: #EBF8FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #1E40AF;"><strong>💡 Action Required:</strong></p>
          <p style="margin: 10px 0 0 0; color: #1E3A8A;">
            Please ensure you complete this homework by the due date. 
            ${homeworkType === 'online' 
              ? 'You need to upload your submission through the student portal.' 
              : 'Please follow the instructions provided by your teacher for submission.'}
          </p>
        </div>
        
        ${materialLink ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${materialLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View Homework Material
          </a>
        </div>
        ` : ''}
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="https://www.drueducation.com.au/student" 
             style="display: inline-block; background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Login to Student Portal
          </a>
        </div>

        <p>If you have any questions, please reach out to your teacher.</p>
        
        <p>Happy Learning!<br>
        The Dr U Education Team</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="font-size: 12px; color: #6B7280; text-align: center;">
          This is an automated notification from Dr U Education.
        </p>
      </div>
    `;

    return {
      to: studentEmail,
      subject: `📚 Homework Assigned: ${homeworkTitle} - ${subjectName}`,
      html: html.trim()
    };
  }

  // Generate meeting confirmation email for teacher
  static generateTeacherMeetingEmail(
    teacherName: string,
    teacherEmail: string,
    studentName: string,
    parentName: string,
    parentEmail: string,
    date: string,
    startTime: string,
    endTime: string,
    meetingLink: string,
    subject: string = 'General'
  ): Omit<MailDocument, 'createdAt' | 'processed'> {
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5; text-align: center;">Meeting Confirmation - Dr U Education</h2>
        
        <p>Dear ${teacherName},</p>
        
        <p>A new meeting has been scheduled with one of your students. Here are the details:</p>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">Meeting Details:</h3>
          <p><strong>Student:</strong> ${studentName}</p>
          <p><strong>Parent/Guardian:</strong> ${parentName}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${formatTime(startTime)} - ${formatTime(endTime)}</p>
        </div>
        
        <div style="background-color: #EBF8FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Meeting Link:</strong></p>
          <a href="${meetingLink}" style="color: #3B82F6; text-decoration: none; font-weight: bold;">${meetingLink}</a>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${meetingLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Join Meeting
          </a>
        </div>
        
        <p><strong>Important Notes:</strong></p>
        <ul>
          <li>Please join the meeting a few minutes early to test your audio and video</li>
          <li>If you encounter any technical issues, please contact our support team</li>
          <li>This meeting is free of charge as part of our educational support services</li>
        </ul>
        
        <p>If you need to reschedule or cancel this meeting, please contact us as soon as possible.</p>
        
        <p>Thank you for your dedication to our students' education!</p>
        
        <p>Best regards,<br>
        The Dr U Education Team,<br>
Your  Trusted  Guide for VCE Success</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="font-size: 12px; color: #6B7280; text-align: center;">
          This is an automated message. For support, please contact our administration team.
        </p>
      </div>
    `;

    return {
      to: teacherEmail,
      subject: `Meeting Scheduled - ${studentName} on ${formattedDate}`,
      html: html.trim()
    };
  }

  // Generate meeting confirmation email for student/parent
  static generateStudentParentMeetingEmail(
    studentName: string,
    parentName: string,
    parentEmail: string,
    teacherName: string,
    date: string,
    startTime: string,
    endTime: string,
    meetingLink: string,
    subject: string = 'General'
  ): Omit<MailDocument, 'createdAt' | 'processed'> {
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5; text-align: center;">Meeting Confirmation - Dr U Education</h2>
        
        <p>Dear ${parentName},</p>
        
        <p>Thank you for booking a meeting session for ${studentName}. We're excited to provide personalized educational support!</p>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">Meeting Details:</h3>
          <p><strong>Student:</strong> ${studentName}</p>
          <p><strong>Teacher:</strong> ${teacherName}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${formatTime(startTime)} - ${formatTime(endTime)}</p>
        </div>
        
        <div style="background-color: #F0FDF4; border-left: 4px solid #22C55E; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Great News:</strong> This meeting is completely free of charge as part of our commitment to supporting your child's education!</p>
        </div>
        
        <div style="background-color: #EBF8FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Meeting Link:</strong></p>
          <a href="${meetingLink}" style="color: #3B82F6; text-decoration: none; font-weight: bold;">${meetingLink}</a>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${meetingLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Join Meeting
          </a>
        </div>
        
        <p><strong>Before the Meeting:</strong></p>
        <ul>
          <li>Ensure ${studentName} has a quiet space for the session</li>
          <li>Test your internet connection and device camera/microphone</li>
          <li>Join the meeting 5 minutes early to resolve any technical issues</li>
          <li>Have any specific questions or topics ready to discuss</li>
        </ul>
        
        <p><strong>What to Expect:</strong></p>
        <ul>
          <li>Personalized attention from our qualified teacher</li>
          <li>Interactive learning session tailored to ${studentName}'s needs</li>
          <li>Opportunity to ask questions and clarify doubts</li>
          <li>Educational guidance and study tips</li>
        </ul>
        
        <p>If you need to reschedule or have any questions, please don't hesitate to contact us.</p>
        
        <p>We look forward to supporting ${studentName}'s educational journey!</p>
        
        <p>Best regards,<br>
        The Dr U Education Team,<br>
Your  Trusted  Guide for VCE Success</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="font-size: 12px; color: #6B7280; text-align: center;">
          This is an automated message. For support, please contact our administration team.
        </p>
      </div>
    `;

    return {
      to: parentEmail,
      subject: `Meeting Confirmed - ${teacherName} and ${studentName} on ${formattedDate}`,
      html: html.trim()
    };
  }

  // Send meeting confirmation emails to both teacher and parent
  static async sendMeetingConfirmationEmails(
    teacherName: string,
    teacherEmail: string,
    studentName: string,
    parentName: string,
    parentEmail: string,
    date: string,
    startTime: string,
    endTime: string,
    meetingLink: string,
    subject: string = 'General'
  ): Promise<{ teacherMailId: string; parentMailId: string }> {
    try {
      // Create teacher email
      const teacherMail = this.generateTeacherMeetingEmail(
        teacherName,
        teacherEmail,
        studentName,
        parentName,
        parentEmail,
        date,
        startTime,
        endTime,
        meetingLink,
        subject
      );

      // Create parent email
      const parentMail = this.generateStudentParentMeetingEmail(
        studentName,
        parentName,
        parentEmail,
        teacherName,
        date,
        startTime,
        endTime,
        meetingLink,
        subject
      );

      // Create both mail documents
      const [teacherMailId, parentMailId] = await Promise.all([
        this.createMailDocument(teacherMail),
        this.createMailDocument(parentMail)
      ]);

      console.log('Meeting confirmation emails created:', {
        teacherMailId,
        parentMailId,
        teacherEmail,
        parentEmail,
        meetingDate: date,
        meetingTime: `${startTime} - ${endTime}`
      });

      return {
        teacherMailId,
        parentMailId
      };
    } catch (error) {
      console.error('Error sending meeting confirmation emails:', error);
      throw error;
    }
  }

  // Generate meeting reminder email (can be used for sending reminders before the meeting)
  static generateMeetingReminderEmail(
    recipientName: string,
    recipientEmail: string,
    isTeacher: boolean,
    studentName: string,
    teacherName: string,
    date: string,
    startTime: string,
    endTime: string,
    meetingLink: string,
    hoursBeforeMeeting: number = 1
  ): Omit<MailDocument, 'createdAt' | 'processed'> {
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    const greeting = isTeacher ? teacherName : recipientName;
    const otherParty = isTeacher ? studentName : teacherName;
    const role = isTeacher ? 'teacher' : 'parent/guardian';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #F59E0B; text-align: center;">⏰ Meeting Reminder - Dr U Education</h2>
        
        <p>Dear ${greeting},</p>
        
        <p>This is a friendly reminder that you have a meeting scheduled in <strong>${hoursBeforeMeeting} hour${hoursBeforeMeeting > 1 ? 's' : ''}</strong>.</p>
        
        <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; margin: 20px 0;">
          <h3 style="color: #92400E; margin-top: 0;">Meeting Details:</h3>
          <p><strong>${isTeacher ? 'Student' : 'Teacher'}:</strong> ${otherParty}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${formatTime(startTime)} - ${formatTime(endTime)}</p>
        </div>
        
        <div style="background-color: #EBF8FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Meeting Link:</strong></p>
          <a href="${meetingLink}" style="color: #3B82F6; text-decoration: none; font-weight: bold;">${meetingLink}</a>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${meetingLink}" style="background-color: #F59E0B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Join Meeting Now
          </a>
        </div>
        
        <p><strong>Quick Reminder:</strong></p>
        <ul>
          <li>Join a few minutes early to test your setup</li>
          <li>Ensure your camera and microphone are working</li>
          <li>Have a stable internet connection</li>
          <li>Be in a quiet environment</li>
        </ul>
        
        <p>We look forward to a productive session!</p>
        
        <p>Best regards,<br>
        The Dr U Education Team,<br>
Your  Trusted  Guide for VCE Success</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="font-size: 12px; color: #6B7280; text-align: center;">
          This is an automated reminder. For support, please contact our administration team.
        </p>
      </div>
    `;

    return {
      to: recipientEmail,
      subject: `⏰ Meeting Reminder - ${formatTime(startTime)} Today`,
      html: html.trim()
    };
  }

  // Generate test notification email for student
  static generateStudentTestNotificationEmail(
    studentName: string,
    studentEmail: string,
    testTitle: string,
    testDescription: string,
    teacherName: string,
    subjectName: string,
    className: string,
    testType: 'live' | 'flexible' | 'in-class',
    testDate: string,
    testTime?: string,
    duration?: number,
    availableFrom?: string,
    availableTo?: string,
    totalMarks?: number,
    instructions?: string
  ): Omit<MailDocument, 'createdAt' | 'processed'> {
    const formatDateTime = (dateStr: string, timeStr?: string) => {
      const date = new Date(dateStr);
      if (timeStr) {
        const [hours, minutes] = timeStr.split(':');
        date.setHours(parseInt(hours), parseInt(minutes));
      }
      return date.toLocaleString('en-AU', {
        timeZone: 'Australia/Melbourne',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: timeStr ? '2-digit' : undefined,
        minute: timeStr ? '2-digit' : undefined
      });
    };

    const testTypeLabel = testType === 'live' ? 'Live Test' : 'Flexible Test';
    const testIcon = testType === 'live' ? '📺' : '📝';
    
    let scheduleInfo = '';
    if (testType === 'live') {
      scheduleInfo = `
        <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; margin: 20px 0;">
          <h3 style="color: #92400E; margin-top: 0;">⏰ Live Test Schedule</h3>
          <p><strong>Date & Time:</strong> ${formatDateTime(testDate, testTime)}</p>
          <p><strong>Duration:</strong> ${duration || 60} minutes</p>
          <p style="color: #92400E; font-weight: 500; margin: 10px 0 0 0;">
            ⚠️ <strong>Important:</strong> This is a live test. Make sure to join on time as you won't be able to start after the scheduled time.
          </p>
        </div>
      `;
    } else if (testType === 'flexible') {
      scheduleInfo = `
        <div style="background-color: #EBF8FF; border-left: 4px solid #3B82F6; padding: 20px; margin: 20px 0;">
          <h3 style="color: #1E40AF; margin-top: 0;">📅 Test Availability</h3>
          <p><strong>Available From:</strong> ${availableFrom ? formatDateTime(availableFrom) : 'To be announced'}</p>
          <p><strong>Available Until:</strong> ${availableTo ? formatDateTime(availableTo) : 'To be announced'}</p>
          <p><strong>Duration:</strong> ${duration || 60} minutes (once started)</p>
          <p style="color: #1E40AF; font-weight: 500; margin: 10px 0 0 0;">
            ℹ️ <strong>Flexible Schedule:</strong> You can take this test anytime within the available period.
          </p>
        </div>
      `;
    } else {
      scheduleInfo = `
        <div style="background-color: #F3F4F6; border-left: 4px solid #6B7280; padding: 20px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">🏫 In-Class Test Schedule</h3>
          <p><strong>Date & Time:</strong> ${formatDateTime(testDate, testTime)}</p>
          <p><strong>Duration:</strong> ${duration || 60} minutes</p>
          <p style="color: #374151; font-weight: 500; margin: 10px 0 0 0;">
            ℹ️ <strong>In-Class:</strong> This test will be conducted in class. Please follow your teacher's instructions.
          </p>
        </div>
      `;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5; text-align: center;">${testIcon} New Test Assignment - Dr U Education</h2>
        
        <p>Hello,</p>
        
        <p>A new ${testTypeLabel.toLowerCase()} has been assigned by <strong>${teacherName}</strong> for the <strong>${subjectName}</strong> class.</p>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">📋 Test Details</h3>
          <p><strong>Test Title:</strong> ${testTitle}</p>
          <p><strong>Subject:</strong> ${subjectName}</p>
          <p><strong>Class:</strong> ${className}</p>
          <p><strong>Assigned by:</strong> ${teacherName}</p>
          <p><strong>Type:</strong> ${testTypeLabel}</p>
          ${totalMarks ? `<p><strong>Total Marks:</strong> ${totalMarks}</p>` : ''}
        </div>

        ${testDescription ? `
        <div style="background-color: #F0FDF4; border-left: 4px solid #22C55E; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Test Description:</strong></p>
          <p style="margin: 10px 0 0 0; color: #16A34A;">${testDescription}</p>
        </div>
        ` : ''}

        ${scheduleInfo}

        ${instructions ? `
        <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #DC2626;"><strong>📖 Special Instructions:</strong></p>
          <p style="margin: 10px 0 0 0; color: #7F1D1D;">${instructions}</p>
        </div>
        ` : ''}

        <div style="background-color: #F0F9FF; border-left: 4px solid #0EA5E9; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #0C4A6E;"><strong>💡 Preparation Tips:</strong></p>
          <ul style="margin: 10px 0 0 0; color: #0F172A; padding-left: 20px;">
            <li>Review class materials and notes</li>
            <li>Ensure you have a stable internet connection</li>
            <li>Find a quiet environment for the test</li>
            <li>Have scratch paper and a calculator ready if needed</li>
            ${testType === 'live' ? '<li>Join the test a few minutes early</li>' : testType === 'flexible' ? '<li>Plan your time wisely within the available period</li>' : '<li>Bring necessary materials to class</li>'}
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://www.drueducation.com.au/student" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            📚 Access Student Portal
          </a>
        </div>

        <p>Good luck with the test! If you have any questions, please contact your teacher or our support team.</p>

        <p>Best regards,<br>
        The Dr U Education Team,<br>
Your  Trusted  Guide for VCE Success</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="font-size: 12px; color: #6B7280; text-align: center;">
          This is an automated message. For support, please contact your teacher or administration team.
        </p>
      </div>
    `;

    return {
      to: studentEmail,
      subject: `📝 New ${testTypeLabel}: ${testTitle} - ${subjectName}`,
      html: html.trim()
    };
  }

  // Generate test notification email for parent
  static generateParentTestNotificationEmail(
    parentName: string,
    parentEmail: string,
    studentName: string,
    testTitle: string,
    testDescription: string,
    teacherName: string,
    subjectName: string,
    className: string,
    testType: 'live' | 'flexible' | 'in-class',
    testDate: string,
    testTime?: string,
    duration?: number,
    availableFrom?: string,
    availableTo?: string,
    totalMarks?: number,
    instructions?: string
  ): Omit<MailDocument, 'createdAt' | 'processed'> {
    const formatDateTime = (dateStr: string, timeStr?: string) => {
      const date = new Date(dateStr);
      if (timeStr) {
        const [hours, minutes] = timeStr.split(':');
        date.setHours(parseInt(hours), parseInt(minutes));
      }
      return date.toLocaleString('en-AU', {
        timeZone: 'Australia/Melbourne',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: timeStr ? '2-digit' : undefined,
        minute: timeStr ? '2-digit' : undefined
      });
    };

    let testTypeLabel = '';
    let testIcon = '';
    
    if (testType === 'live') {
      testTypeLabel = 'Live Test';
      testIcon = '📺';
    } else if (testType === 'flexible') {
      testTypeLabel = 'Flexible Test';
      testIcon = '📝';
    } else {
      testTypeLabel = 'In-Class Test';
      testIcon = '🏫';
    }
    
    let scheduleInfo = '';
    if (testType === 'live') {
      scheduleInfo = `
        <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; margin: 20px 0;">
          <h3 style="color: #92400E; margin-top: 0;">⏰ Live Test Schedule</h3>
          <p><strong>Date & Time:</strong> ${formatDateTime(testDate, testTime)}</p>
          <p><strong>Duration:</strong> ${duration || 60} minutes</p>
          <p style="color: #92400E; font-weight: 500; margin: 10px 0 0 0;">
            ⚠️ <strong>Important:</strong> Please remind your child to join on time as live tests cannot be started after the scheduled time.
          </p>
        </div>
      `;
    } else if (testType === 'flexible') {
      scheduleInfo = `
        <div style="background-color: #EBF8FF; border-left: 4px solid #3B82F6; padding: 20px; margin: 20px 0;">
          <h3 style="color: #1E40AF; margin-top: 0;">📅 Test Availability</h3>
          <p><strong>Available From:</strong> ${availableFrom ? formatDateTime(availableFrom) : 'To be announced'}</p>
          <p><strong>Available Until:</strong> ${availableTo ? formatDateTime(availableTo) : 'To be announced'}</p>
          <p><strong>Duration:</strong> ${duration || 60} minutes (once started)</p>
          <p style="color: #1E40AF; font-weight: 500; margin: 10px 0 0 0;">
            ℹ️ <strong>Flexible Schedule:</strong> The test can be taken anytime within the available period.
          </p>
        </div>
      `;
    } else {
      scheduleInfo = `
        <div style="background-color: #F3F4F6; border-left: 4px solid #6B7280; padding: 20px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">🏫 In-Class Test Schedule</h3>
          <p><strong>Date & Time:</strong> ${formatDateTime(testDate, testTime)}</p>
          <p><strong>Duration:</strong> ${duration || 60} minutes</p>
          <p style="color: #374151; font-weight: 500; margin: 10px 0 0 0;">
            ℹ️ <strong>In-Class:</strong> This test will be conducted in class. Please check with your child for more details.
          </p>
        </div>
      `;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5; text-align: center;">${testIcon} Test Assignment Notification - Dr U Education</h2>
        
        <p>Dear Parent/Guardian,</p>
        
        <p>A new ${testTypeLabel.toLowerCase()} has been assigned by <strong>${teacherName}</strong> for the <strong>${subjectName}</strong> class.</p>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">📋 Test Information</h3>
          <p><strong>Test Title:</strong> ${testTitle}</p>
          <p><strong>Subject:</strong> ${subjectName}</p>
          <p><strong>Class:</strong> ${className}</p>
          <p><strong>Assigned by:</strong> ${teacherName}</p>
          <p><strong>Type:</strong> ${testTypeLabel}</p>
          ${totalMarks ? `<p><strong>Total Marks:</strong> ${totalMarks}</p>` : ''}
        </div>

        ${testDescription ? `
        <div style="background-color: #F0FDF4; border-left: 4px solid #22C55E; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Test Description:</strong></p>
          <p style="margin: 10px 0 0 0; color: #16A34A;">${testDescription}</p>
        </div>
        ` : ''}

        ${scheduleInfo}

        ${instructions ? `
        <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #DC2626;"><strong>📖 Special Instructions:</strong></p>
          <p style="margin: 10px 0 0 0; color: #7F1D1D;">${instructions}</p>
        </div>
        ` : ''}

        <div style="background-color: #F0F9FF; border-left: 4px solid #0EA5E9; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #0C4A6E;"><strong>💡 How You Can Help:</strong></p>
          <ul style="margin: 10px 0 0 0; color: #0F172A; padding-left: 20px;">
            <li>Remind your child about the test schedule</li>
            <li>Ensure they have a quiet study environment</li>
            <li>Help them review their study materials</li>
            <li>Make sure they have a stable internet connection</li>
            <li>Encourage them to ask their teacher if they have questions</li>
          </ul>
        </div>

        <div style="background-color: #EBF4FF; border-left: 4px solid #2563EB; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #1E40AF;"><strong>📞 Support Available:</strong></p>
          <p style="margin: 10px 0 0 0; color: #1E3A8A;">
            If your child needs any help or has questions about the test, please encourage them to contact their teacher <strong>${teacherName}</strong> or our support team. We're here to help ensure their success!
          </p>
        </div>

        <p>We appreciate your continued support in your child's educational journey. Your involvement makes a significant difference in their academic success.</p>

        <p>Best regards,<br>
        The Dr U Education Team,<br>
Your  Trusted  Guide for VCE Success</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="font-size: 12px; color: #6B7280; text-align: center;">
          This is an automated notification to keep you informed about academic activities.
        </p>
      </div>
    `;

    return {
      to: parentEmail,
      subject: `📚 Test Assignment - ${subjectName} (${testTitle})`,
      html: html.trim()
    };
  }

  // Send test notification emails to both student and parent
  static async sendTestNotificationEmails(
    studentName: string,
    studentEmail: string,
    parentName: string,
    parentEmail: string,
    testTitle: string,
    testDescription: string,
    teacherName: string,
    subjectName: string,
    className: string,
    testType: 'live' | 'flexible' | 'in-class',
    testDate: string,
    testTime?: string,
    duration?: number,
    availableFrom?: string,
    availableTo?: string,
    totalMarks?: number,
    instructions?: string
  ): Promise<{ studentMailId: string; parentMailId: string }> {
    try {
      console.log('📧 Sending test notification emails for:', {
        testTitle,
        studentName,
        parentName,
        testType,
        studentEmail,
        parentEmail
      });

      // Create student email
      const studentMail = this.generateStudentTestNotificationEmail(
        studentName,
        studentEmail,
        testTitle,
        testDescription,
        teacherName,
        subjectName,
        className,
        testType,
        testDate,
        testTime,
        duration,
        availableFrom,
        availableTo,
        totalMarks,
        instructions
      );

      // Create parent email
      const parentMail = this.generateParentTestNotificationEmail(
        parentName,
        parentEmail,
        studentName,
        testTitle,
        testDescription,
        teacherName,
        subjectName,
        className,
        testType,
        testDate,
        testTime,
        duration,
        availableFrom,
        availableTo,
        totalMarks,
        instructions
      );

      // Create both mail documents
      const [studentMailId, parentMailId] = await Promise.all([
        this.createMailDocument(studentMail),
        this.createMailDocument(parentMail)
      ]);

      console.log('✅ Test notification emails created successfully:', {
        studentMailId,
        parentMailId,
        testTitle,
        testType
      });

      return {
        studentMailId,
        parentMailId
      };
    } catch (error) {
      console.error('❌ Error sending test notification emails:', error);
      throw error;
    }
  }

  // Generate absence notification email for parents
  static generateAbsenceNotificationEmail(
    parentName: string,
    parentEmail: string,
    studentName: string,
    className: string,
    subjectName: string,
    classDate: string,
    classTime: string,
    teacherName: string
  ): Omit<MailDocument, 'createdAt' | 'processed'> {
    const formattedDate = new Date(classDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #EF4444; text-align: center;">📅 Class Absence Notification - Dr U Education</h2>
        
        <p>Dear ${parentName},</p>
        
        <p>We hope this message finds you well. We wanted to inform you that <strong>${studentName}</strong> was marked absent from their scheduled class today.</p>
        
        <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 20px; margin: 20px 0;">
          <h3 style="color: #DC2626; margin-top: 0;">📚 Class Details</h3>
          <p><strong>Student:</strong> ${studentName}</p>
          <p><strong>Class:</strong> ${className}</p>
          <p><strong>Subject:</strong> ${subjectName}</p>
          <p><strong>Teacher:</strong> ${teacherName}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${classTime}</p>
        </div>
        
        <div style="background-color: #F3F4F6; border-left: 4px solid #6B7280; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #374151;"><strong>💡 What's Next?</strong></p>
          <ul style="margin: 10px 0 0 0; color: #4B5563; padding-left: 20px;">
            <li>If this absence was planned, no further action is needed</li>
            <li>If this was unexpected, please check with ${studentName}</li>
            <li>Contact ${teacherName} if you need to discuss make-up work</li>
            <li>Review any materials or homework that may have been assigned</li>
          </ul>
        </div>
        
        <div style="background-color: #EBF8FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #1E40AF;"><strong>📞 Need Help?</strong></p>
          <p style="margin: 10px 0 0 0; color: #1E3A8A;">
            If you have any questions about this absence or need to discuss ${studentName}'s attendance, please don't hesitate to contact ${teacherName} or our administration team. We're here to support ${studentName}'s educational journey.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://www.drueducation.com.au/contact" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            📞 Contact Us
          </a>
        </div>
        
        <p>We appreciate your attention to ${studentName}'s attendance and look forward to seeing them in the next class.</p>
        
        <p>Best regards,<br>
        Dr U Education Team</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="font-size: 12px; color: #6B7280; text-align: center;">
          This is an automated attendance notification. For urgent matters, please contact our administration team directly.
        </p>
      </div>
    `;

    return {
      to: parentEmail,
      subject: `📅 Absence Notification - ${studentName} (${formattedDate})`,
      html: html.trim()
    };
  }

  // Send absence notification email to parent
  static async sendAbsenceNotificationEmail(
    parentName: string,
    parentEmail: string,
    studentName: string,
    className: string,
    subjectName: string,
    classDate: string,
    classTime: string,
    teacherName: string
  ): Promise<string> {
    try {
      console.log('📧 Creating absence notification email for:', {
        parentName,
        studentName,
        className,
        classDate,
        classTime
      });

      // Generate the absence notification email
      const absenceEmail = this.generateAbsenceNotificationEmail(
        parentName,
        parentEmail,
        studentName,
        className,
        subjectName,
        classDate,
        classTime,
        teacherName
      );

      // Create the mail document
      const mailId = await this.createMailDocument(absenceEmail);

      console.log('✅ Absence notification email created successfully:', {
        mailId,
        parentEmail,
        studentName,
        classDate
      });

      return mailId;
    } catch (error) {
      console.error('❌ Error sending absence notification email:', error);
      throw error;
    }
  }

  // Generate new class schedule email for students and parents
  static generateNewClassScheduleEmail(
    recipientName: string,
    recipientEmail: string,
    studentName: string,
    className: string,
    subjectName: string,
    classDate: string,
    classTime: string,
    teacherName: string,
    scheduleType: 'extra' | 'makeup' | 'special',
    classMode: 'physical' | 'online',
    location?: string,
    zoomUrl?: string,
    notes?: string,
    isParent: boolean = true
  ): Omit<MailDocument, 'createdAt' | 'processed'> {
    const formattedDate = new Date(classDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const greeting = isParent ? `Dear ${recipientName},` : `Dear ${studentName},`;
    const studentReference = isParent ? studentName : 'you';
    const possessive = isParent ? `${studentName}'s` : 'your';

    // Get appropriate title and icon based on schedule type
    const typeInfo = {
      extra: { title: 'Extra Class Scheduled', icon: '📚', color: '#3B82F6', bgColor: '#EBF8FF' },
      makeup: { title: 'Makeup Class Scheduled', icon: '🔄', color: '#10B981', bgColor: '#F0FDF4' },
      special: { title: 'Special Class Scheduled', icon: '⭐', color: '#8B5CF6', bgColor: '#FAF5FF' }
    };

    const currentType = typeInfo[scheduleType];

    // Class location/access info
    const locationInfo = classMode === 'online' 
      ? `<div style="background-color: #EBF8FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0;"><strong>🔗 Online Class Access:</strong></p>
          ${zoomUrl ? `<a href="${zoomUrl}" style="color: #3B82F6; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 8px; padding: 8px 16px; background-color: #3B82F6; color: white; border-radius: 4px;">Join Class Now</a>` : '<p style="margin: 5px 0 0 0;">Meeting link will be provided shortly</p>'}
         </div>`
      : `<div style="background-color: #F0FDF4; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0;"><strong>📍 Class Location:</strong></p>
          <p style="margin: 5px 0 0 0; font-weight: 500;">${location || 'Center Location'}</p>
         </div>`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: ${currentType.bgColor}; border-left: 4px solid ${currentType.color}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: ${currentType.color}; margin: 0 0 10px 0;">${currentType.icon} ${currentType.title}</h2>
        </div>
        
        ${greeting}
        
        <p>We're pleased to inform you that an additional class has been scheduled for ${studentReference}:</p>
        
        <div style="background-color: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #E5E7EB;">
          <h3 style="color: #374151; margin-top: 0;">📅 New Class Details:</h3>
          <p><strong>Student:</strong> ${studentName}</p>
          <p><strong>Class:</strong> ${className}</p>
          <p><strong>Subject:</strong> ${subjectName}</p>
          <p><strong>Teacher:</strong> ${teacherName}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${classTime}</p>
          <p><strong>Type:</strong> ${scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)} Class</p>
          <p><strong>Mode:</strong> ${classMode === 'online' ? '💻 Online' : '🏫 Physical'} Class</p>
        </div>
        
        ${locationInfo}
        
        ${notes ? `<div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0;"><strong>📝 Additional Notes:</strong></p>
          <p style="margin: 5px 0 0 0; font-style: italic;">${notes}</p>
        </div>` : ''}
        
        <div style="background-color: #F0FDF4; border-left: 4px solid #22C55E; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0;"><strong>✅ What you need to know:</strong></p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px;">
            <li>Please arrive 10 minutes early${classMode === 'online' ? ' and test your connection' : ''}</li>
            <li>Bring all necessary materials and assignments</li>
            <li>${scheduleType === 'makeup' ? 'This class is to make up for a previously missed session' : scheduleType === 'extra' ? 'This is an additional learning opportunity' : 'This is a special scheduled session'}</li>
            <li>Regular class policies and procedures apply</li>
            ${classMode === 'online' ? '<li>Ensure you have a stable internet connection and working audio/video</li>' : ''}
          </ul>
        </div>
        
        <p>We're excited to have this additional learning opportunity with ${studentReference}. This ${scheduleType} class will help ensure continued academic progress.</p>
        
        <p>If you have any questions or need to discuss this scheduling, please don't hesitate to contact us.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <p style="font-size: 16px; color: #4F46E5; font-weight: bold;">
            Thank you for your continued trust in Dr U Education
          </p>
        </div>
        
        <p>Best regards,<br>
        Dr U Education Team</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="font-size: 12px; color: #6B7280; text-align: center;">
          This is an automated notification. For support or questions, please contact our administration team.<br>
          Dr U Education - Committed to Excellence in Learning
        </p>
      </div>
    `;

    const subjectLine = `${currentType.icon} New ${scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)} Class - ${className} on ${formattedDate}`;

    return {
      to: recipientEmail,
      subject: subjectLine,
      html: html.trim()
    };
  }

  // Generate class cancellation email for students and parents
  static generateClassCancellationEmail(
    recipientName: string,
    recipientEmail: string,
    studentName: string,
    className: string,
    subjectName: string,
    classDate: string,
    classTime: string,
    teacherName: string,
    cancellationReason: string,
    isParent: boolean = true
  ): Omit<MailDocument, 'createdAt' | 'processed'> {
    const formattedDate = new Date(classDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const greeting = isParent ? `Dear ${recipientName},` : `Dear ${studentName},`;
    const studentReference = isParent ? studentName : 'you';
    const possessive = isParent ? `${studentName}'s` : 'your';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #DC2626; margin: 0 0 10px 0;">Class Cancellation Notice</h2>
        </div>
        
        ${greeting}
        
        <p>We regret to inform you that ${possessive} scheduled class has been cancelled for the following date and time:</p>
        
        <div style="background-color: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #E5E7EB;">
          <h3 style="color: #374151; margin-top: 0;">Cancelled Class Details:</h3>
          <p><strong>Student:</strong> ${studentName}</p>
          <p><strong>Class:</strong> ${className}</p>
          <p><strong>Subject:</strong> ${subjectName}</p>
          <p><strong>Teacher:</strong> ${teacherName}</p>
          <p><strong>Scheduled Date:</strong> ${formattedDate}</p>
          <p><strong>Scheduled Time:</strong> ${classTime}</p>
        </div>
        
        <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Reason for Cancellation:</strong></p>
          <p style="margin: 5px 0 0 0; font-style: italic;">${cancellationReason}</p>
        </div>
        
        <div style="background-color: #F0FDF4; border-left: 4px solid #22C55E; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>What happens next:</strong></p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px;">
            <li>We will work to reschedule this class at the earliest convenient time</li>
            <li>You will receive a notification once a new date is confirmed</li>
            <li>No charges will be applied for this cancelled session</li>
            <li>Any materials or assignments for this class remain accessible</li>
          </ul>
        </div>
        
        <p>We sincerely apologize for any inconvenience this may cause. Our commitment to providing quality education remains unchanged, and we appreciate your understanding.</p>
        
        <p>If you have any questions or concerns about this cancellation, please don't hesitate to contact us.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <p style="font-size: 16px; color: #4F46E5; font-weight: bold;">
            Thank you for your patience and continued trust in Dr U Education
          </p>
        </div>
        
        <p>Best regards,<br>
        Dr U Education Team</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="font-size: 12px; color: #6B7280; text-align: center;">
          This is an automated notification. For support or questions, please contact our administration team.<br>
          Dr U Education - Committed to Excellence in Learning
        </p>
      </div>
    `;

    const subjectLine = `🚫 Class Cancelled - ${className} on ${formattedDate}`;

    return {
      to: recipientEmail,
      subject: subjectLine,
      html: html.trim()
    };
  }

  // Send class cancellation notifications to all students and parents
  static async sendClassCancellationNotifications(
    enrolledStudents: any[],
    className: string,
    subjectName: string,
    classDate: string,
    classTime: string,
    teacherName: string,
    cancellationReason: string
  ): Promise<{ success: number; failed: number; results: any[] }> {
    try {
      console.log('📧 Sending class cancellation notifications to', enrolledStudents.length, 'students/parents');
      
      const emailPromises = [];
      
      // Send email to each student and their parent
      for (const student of enrolledStudents) {
        // Email to student (if they have an email)
        if (student.studentEmail) {
          const studentEmail = this.generateClassCancellationEmail(
            student.studentName,
            student.studentEmail,
            student.studentName,
            className,
            subjectName,
            classDate,
            classTime,
            teacherName,
            cancellationReason,
            false // isParent = false
          );
          
          emailPromises.push(
            this.createMailDocument(studentEmail)
              .then(mailId => ({ 
                success: true, 
                recipient: student.studentEmail, 
                type: 'student',
                mailId 
              }))
              .catch(error => ({ 
                success: false, 
                recipient: student.studentEmail, 
                type: 'student',
                error: error.message 
              }))
          );
        }
        
        // Email to parent (if they have an email)
        if (student.parent?.email) {
          const parentEmail = this.generateClassCancellationEmail(
            student.parent.name || 'Parent',
            student.parent.email,
            student.studentName,
            className,
            subjectName,
            classDate,
            classTime,
            teacherName,
            cancellationReason,
            true // isParent = true
          );
          
          emailPromises.push(
            this.createMailDocument(parentEmail)
              .then(mailId => ({ 
                success: true, 
                recipient: student.parent.email, 
                type: 'parent',
                mailId 
              }))
              .catch(error => ({ 
                success: false, 
                recipient: student.parent.email, 
                type: 'parent',
                error: error.message 
              }))
          );
        }
      }

      // Execute all email sends
      const results = await Promise.all(emailPromises);
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log('✅ Class cancellation notifications completed:', {
        successful,
        failed,
        total: results.length
      });

      return {
        success: successful,
        failed: failed,
        results: results
      };
    } catch (error) {
      console.error('❌ Error sending class cancellation notifications:', error);
      throw error;
    }
  }

  // Send new class schedule notifications to all students and parents
  static async sendNewClassScheduleNotifications(
    enrolledStudents: any[],
    className: string,
    subjectName: string,
    classDate: string,
    classTime: string,
    teacherName: string,
    scheduleType: 'extra' | 'makeup' | 'special',
    classMode: 'physical' | 'online',
    location?: string,
    zoomUrl?: string,
    notes?: string
  ): Promise<{ success: number; failed: number; results: any[] }> {
    try {
      console.log('📧 Sending new class schedule notifications to', enrolledStudents.length, 'students/parents');
      
      const emailPromises = [];
      
      // Send email to each student and their parent
      for (const student of enrolledStudents) {
        // Email to student (if they have an email)
        if (student.studentEmail) {
          const studentEmail = this.generateNewClassScheduleEmail(
            student.studentName,
            student.studentEmail,
            student.studentName,
            className,
            subjectName,
            classDate,
            classTime,
            teacherName,
            scheduleType,
            classMode,
            location,
            zoomUrl,
            notes,
            false // isParent = false
          );
          
          emailPromises.push(
            this.createMailDocument(studentEmail)
              .then(mailId => ({ 
                success: true, 
                recipient: student.studentEmail, 
                type: 'student',
                mailId 
              }))
              .catch(error => ({ 
                success: false, 
                recipient: student.studentEmail, 
                type: 'student',
                error: error.message 
              }))
          );
        }
        
        // Email to parent (if they have an email)
        if (student.parent?.email) {
          const parentEmail = this.generateNewClassScheduleEmail(
            student.parent.name || 'Parent',
            student.parent.email,
            student.studentName,
            className,
            subjectName,
            classDate,
            classTime,
            teacherName,
            scheduleType,
            classMode,
            location,
            zoomUrl,
            notes,
            true // isParent = true
          );
          
          emailPromises.push(
            this.createMailDocument(parentEmail)
              .then(mailId => ({ 
                success: true, 
                recipient: student.parent.email, 
                type: 'parent',
                mailId 
              }))
              .catch(error => ({ 
                success: false, 
                recipient: student.parent.email, 
                type: 'parent',
                error: error.message 
              }))
          );
        }
      }

      // Execute all email sends
      const results = await Promise.all(emailPromises);
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log('✅ New class schedule notifications completed:', {
        successful,
        failed,
        total: results.length
      });

      return {
        success: successful,
        failed: failed,
        results: results
      };
    } catch (error) {
      console.error('❌ Error sending new class schedule notifications:', error);
      throw error;
    }
  }

  // Generate document submission reminder email for student
  static generateDocumentReminderEmail(
    studentName: string,
    studentEmail: string,
    missingDocuments: Array<{ type: string; name: string; url: string }>,
    isUrgent: boolean = true
  ): Omit<MailDocument, 'createdAt' | 'processed'> {
    const urgentBadge = isUrgent ? '🚨 URGENT: ' : '📄 Reminder: ';
    
    const documentsList = missingDocuments.map(doc => `
      <div style="margin-bottom: 15px; padding: 12px; background-color: #ffffff; border-radius: 8px; border-left: 4px solid ${doc.type === 'Class Policy Agreement' ? '#4299e1' : doc.type === 'Parent/Guardian Notice' ? '#48bb78' : '#ed8936'};">
        <a href="${doc.url}" 
           style="color: ${doc.type === 'Class Policy Agreement' ? '#2b6cb0' : doc.type === 'Parent/Guardian Notice' ? '#2f855a' : '#c05621'}; text-decoration: none; font-weight: 500; display: flex; align-items: center;">
          ${doc.type === 'Class Policy Agreement' ? '📜' : doc.type === 'Parent/Guardian Notice' ? '👨‍👩‍👧‍👦' : '📸'} <span style="margin-left: 8px;">${doc.name}</span>
        </a>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document Submission Reminder</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with gradient background -->
          <div style="background: ${isUrgent ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
              ${isUrgent ? '🚨' : '📄'} Document Submission ${isUrgent ? 'URGENT' : 'Reminder'}
            </h1>
            <p style="color: #fed7d7; margin: 10px 0 0 0; font-size: 16px; font-weight: 400;">
              ${isUrgent ? 'Immediate action required' : 'Please submit your documents'}
            </p>
          </div>
          
          <!-- Main content -->
          <div style="padding: 40px 30px;">
            <div style="margin-bottom: 30px;">
              <p style="color: #1a202c; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Dear <strong>${studentName}</strong>,
              </p>
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0;">
                ${isUrgent ? 
                  'This is an urgent reminder that you have not yet submitted the required documents for your physical classes at Dr U Education. <strong>Please submit these documents ASAP</strong> to avoid any disruption to your classes.' : 
                  'We noticed that you have not yet submitted all the required documents for your physical classes at Dr U Education. Please submit the missing documents at your earliest convenience.'
                }
              </p>
            </div>

            ${isUrgent ? `
            <!-- Urgent Notice -->
            <div style="background-color: #fef2f2; border: 2px solid #fca5a5; border-radius: 12px; padding: 20px; margin: 30px 0;">
              <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <span style="font-size: 24px; margin-right: 12px;">⚠️</span>
                <h3 style="color: #dc2626; margin: 0; font-size: 18px; font-weight: 600;">URGENT ACTION REQUIRED</h3>
              </div>
              <p style="color: #7f1d1d; margin: 0; font-size: 15px; line-height: 1.6;">
                <strong>Your class attendance may be affected if these documents are not submitted immediately.</strong> Please prioritize submitting these documents today to ensure uninterrupted access to your physical classes.
              </p>
            </div>
            ` : ''}
            
            <!-- Missing Documents Section -->
            <div style="background-color: #edf2f7; border-radius: 12px; padding: 25px; margin: 30px 0;">
              <h3 style="color: #2d3748; font-size: 18px; font-weight: 600; margin: 0 0 20px 0; display: flex; align-items: center;">
                📋 Missing Required Documents
              </h3>
              <p style="color: #4a5568; margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">
                Please download, sign, and upload the following documents to continue attending physical classes:
              </p>
              <div style="space-y: 10px;">
                ${documentsList}
              </div>
            </div>

            <!-- Step-by-step Instructions -->
            <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
              <h3 style="color: #0c4a6e; font-size: 16px; font-weight: 600; margin: 0 0 15px 0;">
                📝 How to Submit Your Documents:
              </h3>
              <ol style="color: #1e293b; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li style="margin-bottom: 8px;"><strong>Download</strong> each document using the links above</li>
                <li style="margin-bottom: 8px;"><strong>Print and Sign</strong> each document as required</li>
                <li style="margin-bottom: 8px;"><strong>Scan or Take Clear Photos</strong> of the signed documents</li>
                <li style="margin-bottom: 8px;"><strong>Login</strong> to your student portal</li>
                <li style="margin-bottom: 0px;"><strong>Upload</strong> the signed documents in Settings → Documents</li>
              </ol>
            </div>

            <!-- Quick Access Buttons -->
            <div style="text-align: center; margin: 35px 0;">
              <div style="display: inline-block; margin-bottom: 15px;">
                <a href="https://www.drueducation.com.au/student/login" 
                   style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4); margin-right: 15px;">
                  🚀 Access Student Portal
                </a>
                <a href="https://www.drueducation.com.au/student/settings" 
                   style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);">
                  📤 Upload Documents
                </a>
              </div>
            </div>

            ${isUrgent ? `
            <!-- Deadline Warning -->
            <div style="background-color: #fffbeb; border: 2px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 30px 0;">
              <div style="display: flex; align-items: center;">
                <span style="font-size: 20px; margin-right: 10px;">⏰</span>
                <p style="margin: 0; color: #92400e; font-weight: 600; font-size: 15px;">
                  <strong>Time-Sensitive:</strong> Please submit these documents within the next 24 hours to avoid any class access issues.
                </p>
              </div>
            </div>
            ` : ''}

            <!-- Support Section -->
            <div style="background-color: #f0fff4; border: 1px solid #9ae6b4; border-radius: 8px; padding: 20px; margin: 30px 0;">
              <div style="text-align: center;">
                <p style="color: #22543d; margin: 0 0 10px 0; font-size: 15px; font-weight: 600;">
                  📞 Need Help With Document Submission?
                </p>
                <p style="color: #2f855a; margin: 0; font-size: 14px;">
                  Contact our support team or reach out to your academic coordinator for assistance.
                </p>
              </div>
            </div>
            
            <!-- Closing -->
            <div style="margin-top: 40px;">
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                ${isUrgent ? 
                  'We appreciate your immediate attention to this matter and look forward to seeing you in your physical classes.' : 
                  'Thank you for your attention to this matter. We look forward to receiving your documents soon.'
                }
              </p>
              <p style="color: #2d3748; font-size: 16px; margin: 0;">
                <strong>Best regards,</strong><br>
                <span style="color: #4f46e5; font-weight: 600;">The Dr U Education Team</span> 🎓
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 25px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="color: #718096; font-size: 13px; margin: 0; line-height: 1.5;">
              This is an automated reminder from Dr U Education.<br>
              For support with document submission, please contact our help desk.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return {
      to: studentEmail,
      subject: `${urgentBadge}Missing Required Documents - Dr U Education`,
      html: html.trim()
    };
  }

  // Generate document submission reminder email for parent
  static generateParentDocumentReminderEmail(
    parentName: string,
    parentEmail: string,
    studentName: string,
    missingDocuments: Array<{ type: string; name: string; url: string }>,
    isUrgent: boolean = true
  ): Omit<MailDocument, 'createdAt' | 'processed'> {
    const urgentBadge = isUrgent ? '🚨 URGENT: ' : '📄 Reminder: ';
    
    const documentsList = missingDocuments.map(doc => `
      <div style="margin-bottom: 15px; padding: 12px; background-color: #ffffff; border-radius: 8px; border-left: 4px solid ${doc.type === 'Class Policy Agreement' ? '#4299e1' : doc.type === 'Parent/Guardian Notice' ? '#48bb78' : '#ed8936'};">
        <a href="${doc.url}" 
           style="color: ${doc.type === 'Class Policy Agreement' ? '#2b6cb0' : doc.type === 'Parent/Guardian Notice' ? '#2f855a' : '#c05621'}; text-decoration: none; font-weight: 500; display: flex; align-items: center;">
          ${doc.type === 'Class Policy Agreement' ? '📜' : doc.type === 'Parent/Guardian Notice' ? '👨‍👩‍👧‍👦' : '📸'} <span style="margin-left: 8px;">${doc.name}</span>
        </a>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document Submission Reminder - ${studentName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with gradient background -->
          <div style="background: ${isUrgent ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
              ${isUrgent ? '🚨' : '📄'} Document Submission ${isUrgent ? 'URGENT' : 'Reminder'}
            </h1>
            <p style="color: #fed7d7; margin: 10px 0 0 0; font-size: 16px; font-weight: 400;">
              For ${studentName}'s Physical Classes
            </p>
          </div>
          
          <!-- Main content -->
          <div style="padding: 40px 30px;">
            <div style="margin-bottom: 30px;">
              <p style="color: #1a202c; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Dear <strong>${parentName}</strong>,
              </p>
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0;">
                ${isUrgent ? 
                  `This is an urgent reminder regarding missing documents for <strong>${studentName}</strong>'s physical classes at Dr U Education. <strong>Please ensure these documents are submitted ASAP</strong> to avoid any disruption to your child's classes.` : 
                  `We noticed that some required documents for <strong>${studentName}</strong>'s physical classes at Dr U Education have not yet been submitted. Please help us by ensuring these documents are completed and uploaded at your earliest convenience.`
                }
              </p>
            </div>

            ${isUrgent ? `
            <!-- Urgent Notice -->
            <div style="background-color: #fef2f2; border: 2px solid #fca5a5; border-radius: 12px; padding: 20px; margin: 30px 0;">
              <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <span style="font-size: 24px; margin-right: 12px;">⚠️</span>
                <h3 style="color: #dc2626; margin: 0; font-size: 18px; font-weight: 600;">URGENT PARENT ACTION REQUIRED</h3>
              </div>
              <p style="color: #7f1d1d; margin: 0; font-size: 15px; line-height: 1.6;">
                <strong>${studentName}'s attendance at physical classes may be affected if these documents are not submitted immediately.</strong> Please prioritize completing and submitting these documents today to ensure your child's uninterrupted access to classes.
              </p>
            </div>
            ` : ''}
            
            <!-- Missing Documents Section -->
            <div style="background-color: #edf2f7; border-radius: 12px; padding: 25px; margin: 30px 0;">
              <h3 style="color: #2d3748; font-size: 18px; font-weight: 600; margin: 0 0 20px 0; display: flex; align-items: center;">
                📋 Missing Required Documents for ${studentName}
              </h3>
              <p style="color: #4a5568; margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">
                Please download, complete, and have your child upload the following documents:
              </p>
              <div style="space-y: 10px;">
                ${documentsList}
              </div>
            </div>

            <!-- Parent Instructions -->
            <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
              <h3 style="color: #0c4a6e; font-size: 16px; font-weight: 600; margin: 0 0 15px 0;">
                👨‍👩‍👧‍👦 Parent Action Items:
              </h3>
              <ol style="color: #1e293b; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li style="margin-bottom: 8px;"><strong>Download</strong> the documents using the links above</li>
                <li style="margin-bottom: 8px;"><strong>Complete and Sign</strong> each document as required</li>
                <li style="margin-bottom: 8px;"><strong>Help ${studentName}</strong> scan or take clear photos of the signed documents</li>
                <li style="margin-bottom: 8px;"><strong>Guide ${studentName}</strong> to log into their student portal</li>
                <li style="margin-bottom: 0px;"><strong>Assist with uploading</strong> the documents in Settings → Documents</li>
              </ol>
            </div>

            <!-- Quick Access for Parents -->
            <div style="text-align: center; margin: 35px 0;">
              <p style="color: #4a5568; margin: 0 0 15px 0; font-size: 14px;">Help ${studentName} access their portal:</p>
              <div style="display: inline-block;">
                <a href="https://www.drueducation.com.au/student/settings" 
                   style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);">
                  📤 Student Document Upload Page
                </a>
              </div>
            </div>

            ${isUrgent ? `
            <!-- Parent Deadline Warning -->
            <div style="background-color: #fffbeb; border: 2px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 30px 0;">
              <div style="display: flex; align-items: center;">
                <span style="font-size: 20px; margin-right: 10px;">⏰</span>
                <p style="margin: 0; color: #92400e; font-weight: 600; font-size: 15px;">
                  <strong>Time-Sensitive:</strong> Please help ${studentName} submit these documents within 24 hours to avoid any class access issues.
                </p>
              </div>
            </div>
            ` : ''}

            <!-- Parent Support Section -->
            <div style="background-color: #f0fff4; border: 1px solid #9ae6b4; border-radius: 8px; padding: 20px; margin: 30px 0;">
              <div style="text-align: center;">
                <p style="color: #22543d; margin: 0 0 10px 0; font-size: 15px; font-weight: 600;">
                  📞 Need Help With Document Completion?
                </p>
                <p style="color: #2f855a; margin: 0; font-size: 14px;">
                  As a parent, you can contact our support team for assistance with document requirements or technical help with uploading.
                </p>
              </div>
            </div>
            
            <!-- Closing -->
            <div style="margin-top: 40px;">
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                ${isUrgent ? 
                  `We appreciate your immediate attention to help ${studentName} complete these requirements and look forward to continuing their educational journey without interruption.` : 
                  `Thank you for supporting ${studentName}'s education. We appreciate your cooperation in completing these necessary documents.`
                }
              </p>
              <p style="color: #2d3748; font-size: 16px; margin: 0;">
                <strong>Best regards,</strong><br>
                <span style="color: #4f46e5; font-weight: 600;">The Dr U Education Team</span> 🎓
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 25px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="color: #718096; font-size: 13px; margin: 0; line-height: 1.5;">
              This is an automated reminder from Dr U Education.<br>
              For support with document requirements, please contact our help desk.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return {
      to: parentEmail,
      subject: `${urgentBadge}Missing Documents for ${studentName} - Dr U Education`,
      html: html.trim()
    };
  }

  // Send document reminder emails to both student and parent
  static async sendDocumentReminderEmails(
    studentName: string,
    studentEmail: string,
    parentName: string,
    parentEmail: string,
    missingDocuments: Array<{ type: string; name: string; url: string }>,
    isUrgent: boolean = true
  ): Promise<{ studentMailId: string; parentMailId: string }> {
    try {
      const studentEmail_mail = this.generateDocumentReminderEmail(
        studentName,
        studentEmail,
        missingDocuments,
        isUrgent
      );

      const parentEmail_mail = this.generateParentDocumentReminderEmail(
        parentName,
        parentEmail,
        studentName,
        missingDocuments,
        isUrgent
      );

      const [studentMailId, parentMailId] = await Promise.all([
        this.createMailDocument(studentEmail_mail),
        this.createMailDocument(parentEmail_mail)
      ]);

      console.log(`Document reminder emails sent - Student: ${studentMailId}, Parent: ${parentMailId}`);

      return { studentMailId, parentMailId };
    } catch (error) {
      console.error('Error sending document reminder emails:', error);
      throw error;
    }
  }

  // Generate test extension notification email for student
  static generateStudentTestExtensionEmail(
    studentName: string,
    studentEmail: string,
    testTitle: string,
    teacherName: string,
    subjectName: string,
    className: string,
    originalDeadline: string,
    newDeadline: string,
    extensionDays: number,
    reason?: string
  ): Omit<MailDocument, 'createdAt' | 'processed'> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5; text-align: center;">Test Deadline Extended - Dr U Education</h2>
        
        <p>Dear ${studentName},</p>
        
        <p>Good news! The deadline for your upcoming test has been extended to give you more time to prepare.</p>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">Test Details:</h3>
          <p><strong>Test:</strong> ${testTitle}</p>
          <p><strong>Subject:</strong> ${subjectName}</p>
          <p><strong>Class:</strong> ${className}</p>
          <p><strong>Teacher:</strong> ${teacherName}</p>
        </div>
        
        <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
          <h4 style="color: #92400E; margin-top: 0;">Deadline Changes:</h4>
          <p style="margin: 5px 0;"><strong>Original Deadline:</strong> ${originalDeadline}</p>
          <p style="margin: 5px 0;"><strong>New Deadline:</strong> ${newDeadline}</p>
          <p style="margin: 5px 0;"><strong>Extension:</strong> ${extensionDays} additional day(s)</p>
        </div>
        
        ${reason ? `
        <div style="background-color: #EBF8FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0;">
          <h4 style="color: #1E40AF; margin-top: 0;">Reason for Extension:</h4>
          <p style="margin: 0;">${reason}</p>
        </div>
        ` : ''}
        
        <div style="background-color: #F0FDF4; border-left: 4px solid #22C55E; padding: 15px; margin: 20px 0;">
          <h4 style="color: #15803D; margin-top: 0;">What This Means:</h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>You now have ${extensionDays} extra day(s) to complete the test</li>
            <li>The test will remain accessible until the new deadline</li>
            <li>Use this extra time to review and prepare thoroughly</li>
            <li>No action is required on your part - just be ready for the new deadline</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.drueducation.com'}/student/test" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View My Tests
          </a>
        </div>
        
        <p><strong>Study Tips:</strong></p>
        <ul>
          <li>Use the extra time to review difficult topics</li>
          <li>Practice similar questions if available</li>
          <li>Ensure you understand the test format and requirements</li>
          <li>Plan your test-taking strategy for the actual test day</li>
        </ul>
        
        <p>If you have any questions about the test or need additional support, please don't hesitate to contact your teacher.</p>
        
        <p>Best of luck with your preparation!</p>
        
        <p>Best regards,<br>
        The Dr U Education Team<br>
        Your Trusted Guide for VCE Success</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="font-size: 12px; color: #6B7280; text-align: center;">
          This is an automated message regarding your test schedule. For questions, please contact your teacher.
        </p>
      </div>
    `;

    return {
      to: studentEmail,
      subject: `Test Deadline Extended - ${testTitle}`,
      html: html.trim()
    };
  }

  // Generate test extension notification email for parent
  static generateParentTestExtensionEmail(
    parentName: string,
    parentEmail: string,
    studentName: string,
    testTitle: string,
    teacherName: string,
    subjectName: string,
    className: string,
    originalDeadline: string,
    newDeadline: string,
    extensionDays: number,
    reason?: string
  ): Omit<MailDocument, 'createdAt' | 'processed'> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5; text-align: center;">Test Deadline Extended - Dr U Education</h2>
        
        <p>Dear ${parentName},</p>
        
        <p>We would like to inform you that the deadline for ${studentName}'s upcoming test has been extended to provide additional preparation time.</p>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">Test Details:</h3>
          <p><strong>Student:</strong> ${studentName}</p>
          <p><strong>Test:</strong> ${testTitle}</p>
          <p><strong>Subject:</strong> ${subjectName}</p>
          <p><strong>Class:</strong> ${className}</p>
          <p><strong>Teacher:</strong> ${teacherName}</p>
        </div>
        
        <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
          <h4 style="color: #92400E; margin-top: 0;">Deadline Changes:</h4>
          <p style="margin: 5px 0;"><strong>Original Deadline:</strong> ${originalDeadline}</p>
          <p style="margin: 5px 0;"><strong>New Deadline:</strong> ${newDeadline}</p>
          <p style="margin: 5px 0;"><strong>Extension:</strong> ${extensionDays} additional day(s)</p>
        </div>
        
        ${reason ? `
        <div style="background-color: #EBF8FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0;">
          <h4 style="color: #1E40AF; margin-top: 0;">Reason for Extension:</h4>
          <p style="margin: 0;">${reason}</p>
        </div>
        ` : ''}
        
        <div style="background-color: #F0FDF4; border-left: 4px solid #22C55E; padding: 15px; margin: 20px 0;">
          <h4 style="color: #15803D; margin-top: 0;">What This Means:</h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>${studentName} now has ${extensionDays} extra day(s) to complete the test</li>
            <li>The test will remain accessible until the new deadline</li>
            <li>This provides additional time for thorough preparation</li>
            <li>No action is required - ${studentName} has been notified automatically</li>
          </ul>
        </div>
        
        <p><strong>How You Can Help:</strong></p>
        <ul>
          <li>Encourage ${studentName} to use the extra time effectively</li>
          <li>Help create a quiet study environment for preparation</li>
          <li>Remind ${studentName} of the new deadline to avoid last-minute rushing</li>
          <li>Contact the teacher if ${studentName} needs additional support</li>
        </ul>
        
        <p>We appreciate your continued support in ${studentName}'s educational journey. If you have any questions or concerns, please feel free to contact ${teacherName} directly.</p>
        
        <p>Thank you for choosing Dr U Education for ${studentName}'s learning needs.</p>
        
        <p>Best regards,<br>
        The Dr U Education Team<br>
        Your Trusted Guide for VCE Success</p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        <p style="font-size: 12px; color: #6B7280; text-align: center;">
          This is an automated notification regarding ${studentName}'s test schedule. For questions, please contact the teacher.
        </p>
      </div>
    `;

    return {
      to: parentEmail,
      subject: `Test Extended for ${studentName} - ${testTitle}`,
      html: html.trim()
    };
  }

  // Send test extension notification emails to both student and parent
  static async sendTestExtensionNotificationEmails(
    studentName: string,
    studentEmail: string,
    parentName: string,
    parentEmail: string,
    testTitle: string,
    teacherName: string,
    subjectName: string,
    className: string,
    originalDeadline: string,
    newDeadline: string,
    extensionDays: number,
    reason?: string
  ): Promise<{ studentMailId: string; parentMailId: string }> {
    try {
      // Generate emails for both student and parent
      const studentEmail_data = this.generateStudentTestExtensionEmail(
        studentName,
        studentEmail,
        testTitle,
        teacherName,
        subjectName,
        className,
        originalDeadline,
        newDeadline,
        extensionDays,
        reason
      );

      const parentEmail_data = this.generateParentTestExtensionEmail(
        parentName,
        parentEmail,
        studentName,
        testTitle,
        teacherName,
        subjectName,
        className,
        originalDeadline,
        newDeadline,
        extensionDays,
        reason
      );

      // Send both emails
      const [studentMailId, parentMailId] = await Promise.all([
        this.createMailDocument(studentEmail_data),
        this.createMailDocument(parentEmail_data)
      ]);

      console.log('✅ Test extension notification emails sent:', {
        studentMailId,
        parentMailId,
        studentEmail,
        parentEmail,
        testTitle
      });

      return { studentMailId, parentMailId };
    } catch (error) {
      console.error('❌ Error sending test extension notification emails:', error);
      throw error;
    }
  }
}
