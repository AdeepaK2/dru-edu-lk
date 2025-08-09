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
        The Dr U Education Team</p>
        
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
        The Dr U Education Team</p>
        
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
        The Dr U Education Team</p>
        
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
}
