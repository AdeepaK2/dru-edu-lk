/**
 * Server-side Email Service using Nodemailer
 * 
 * Centralized service for sending emails via SMTP.
 * All welcome emails (student, teacher) should use this service.
 * 
 * Configuration is read from environment variables:
 * - SMTP_CONNECTION_URI: Full SMTP connection string (e.g., smtps://user:pass@smtp.gmail.com:465)
 * - SMTP_HOST: SMTP host (fallback if URI not provided)
 * - SMTP_PORT: SMTP port (fallback if URI not provided)
 * - SMTP_USER: SMTP username (fallback if URI not provided)
 * - SMTP_PASSWORD: SMTP password (fallback if URI not provided)
 * - SMTP_FROM_EMAIL: Sender email address
 * - SMTP_FROM_NAME: Sender display name
 */

import nodemailer from 'nodemailer';

// Email configuration
const EMAIL_CONFIG = {
  companyName: 'Dr U Education',
  studentPortalUrl: 'https://www.drueducation.com.au/student/login',
  teacherPortalUrl: 'https://www.drueducation.com.au/teacher/login',
  settingsUrl: 'https://www.drueducation.com.au/student/settings',
  // Document links
  classPolicyUrl: 'https://drive.google.com/file/d/1YHJxvAfTVMqRJ5YQeD5fFZdXkt81vSr1/view?usp=sharing',
  parentGuardianUrl: 'https://drive.google.com/file/d/1j_LO0jWJ2-4WRYBZwMwp0eRnFMqOVM-F/view?usp=sharing',
  photoConsentUrl: 'https://drive.google.com/file/d/1qD9nYtOnbHs_AImrAaEU5NTPalXwea6F/view?usp=sharing',
};

// Create nodemailer transporter
function createTransporter() {
  const connectionUri = process.env.SMTP_CONNECTION_URI;
  
  if (connectionUri) {
    // Use connection URI if provided
    console.log('📧 Using SMTP connection URI');
    return nodemailer.createTransport(connectionUri);
  }
  
  // Fallback to individual config
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  
  if (!user || !pass) {
    throw new Error('SMTP credentials not configured. Set SMTP_CONNECTION_URI or SMTP_USER and SMTP_PASSWORD');
  }
  
  console.log(`📧 Using SMTP: ${host}:${port}`);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

// Lazy-loaded transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

// Get sender info
function getSenderInfo(): { email: string; name: string } {
  return {
    email: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'dru.coordinator@gmail.com',
    name: process.env.SMTP_FROM_NAME || 'Dr U Education',
  };
}

/**
 * Send an email using Nodemailer
 */
async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log(`📧 Sending email to: ${to}`);
  console.log(`📧 Subject: ${subject}`);
  
  try {
    const transport = getTransporter();
    const sender = getSenderInfo();
    
    const result = await transport.sendMail({
      from: `"${sender.name}" <${sender.email}>`,
      to: to,
      subject: subject,
      html: html,
    });
    
    console.log(`✅ Email sent successfully! Message ID: ${result.messageId}`);
    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    console.error('❌ Failed to send email:', error.message);
    console.error('❌ Error details:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate and send student welcome email with login credentials
 */
export async function sendStudentWelcomeEmail(
  email: string,
  studentName: string,
  password: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const subject = `Welcome to ${EMAIL_CONFIG.companyName} - Your Account Details`;
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to ${EMAIL_CONFIG.companyName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <!-- Header with gradient background -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
            🎓 Welcome to ${EMAIL_CONFIG.companyName}!
          </h1>
          <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px; font-weight: 400;">
            Your educational journey starts here
          </p>
        </div>
        
        <!-- Main content -->
        <div style="padding: 40px 30px;">
          <div style="margin-bottom: 30px;">
            <p style="color: #1a202c; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
              Dear <strong>${studentName}</strong>,
            </p>
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0;">
              Welcome to ${EMAIL_CONFIG.companyName}! We're thrilled to have you join our learning community and look forward to supporting your academic success.
            </p>
          </div>
          
          <!-- Credentials Box -->
          <div style="background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border: 2px solid #e2e8f0; border-radius: 12px; padding: 25px; margin: 30px 0; position: relative;">
            <div style="position: absolute; top: -10px; left: 20px; background-color: #ffffff; padding: 0 10px;">
              <span style="color: #4299e1; font-weight: 600; font-size: 14px;">🔐 YOUR LOGIN CREDENTIALS</span>
            </div>
            <div style="margin-top: 10px;">
              <div style="margin-bottom: 15px;">
                <label style="color: #2d3748; font-weight: 500; font-size: 14px; display: block; margin-bottom: 5px;">Email Address:</label>
                <p style="color: #1a202c; font-size: 16px; margin: 0; padding: 8px 12px; background-color: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0;">
                  ${email}
                </p>
              </div>
              <div>
                <label style="color: #2d3748; font-weight: 500; font-size: 14px; display: block; margin-bottom: 5px;">Temporary Password:</label>
                <p style="color: #1a202c; font-size: 16px; margin: 0; padding: 8px 12px; background-color: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0; font-family: 'Courier New', monospace; font-weight: 600; letter-spacing: 1px;">
                  ${password}
                </p>
              </div>
            </div>
          </div>
          
          <!-- Security Notice -->
          <div style="background-color: #fef5e7; border-left: 4px solid #f6ad55; padding: 16px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <div style="display: flex; align-items: flex-start;">
              <span style="font-size: 18px; margin-right: 10px;">⚠️</span>
              <div>
                <p style="margin: 0; color: #744210; font-weight: 500; font-size: 14px;">
                  <strong>Security Notice:</strong> Please change your password immediately after your first login for enhanced security.
                </p>
              </div>
            </div>
          </div>
          
          <!-- Features Section -->
          <div style="margin: 30px 0;">
            <h3 style="color: #2d3748; font-size: 18px; font-weight: 600; margin: 0 0 20px 0;">
              🚀 What you can do with your student portal:
            </h3>
            <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px;">
              <ul style="margin: 0; padding-left: 20px; color: #4a5568; line-height: 1.8;">
                <li style="margin-bottom: 8px;">📚 Access your courses and comprehensive learning materials</li>
                <li style="margin-bottom: 8px;">📊 View your grades, progress reports, and performance analytics</li>
                <li style="margin-bottom: 8px;">💬 Communicate directly with your teachers and classmates</li>
                <li style="margin-bottom: 8px;">📝 Track assignments, deadlines, and upcoming assessments</li>
                <li style="margin-bottom: 8px;">🎯 Set learning goals and monitor your achievements</li>
              </ul>
            </div>
          </div>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 35px 0;">
            <a href="${EMAIL_CONFIG.studentPortalUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); transition: all 0.2s;">
              🚀 Access Your Student Portal
            </a>
          </div>
          
          <!-- Important Documents Section -->
          <div style="background-color: #edf2f7; border-radius: 12px; padding: 25px; margin: 30px 0;">
            <h3 style="color: #2d3748; font-size: 18px; font-weight: 600; margin: 0 0 20px 0; display: flex; align-items: center;">
              📋 Required Documents for Physical Classes
            </h3>
            <p style="color: #4a5568; margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">
              Please review and sign these important documents before attending your first physical class.
              <strong>After signing, upload the signed document(s) in your LMS Settings page.</strong>
            </p>
            <div style="space-y: 10px;">
              <div style="margin-bottom: 15px; padding: 12px; background-color: #ffffff; border-radius: 8px; border-left: 4px solid #4299e1;">
                <a href="${EMAIL_CONFIG.classPolicyUrl}" style="color: #2b6cb0; text-decoration: none; font-weight: 500; display: flex; align-items: center;">
                  📜 <span style="margin-left: 8px;">Class Policy Agreement</span>
                </a>
              </div>
              <div style="margin-bottom: 15px; padding: 12px; background-color: #ffffff; border-radius: 8px; border-left: 4px solid #48bb78;">
                <a href="${EMAIL_CONFIG.parentGuardianUrl}" style="color: #2f855a; text-decoration: none; font-weight: 500; display: flex; align-items: center;">
                  👨‍👩‍👧‍👦 <span style="margin-left: 8px;">Parent/Guardian Notice</span>
                </a>
              </div>
              <div style="margin-bottom: 0; padding: 12px; background-color: #ffffff; border-radius: 8px; border-left: 4px solid #ed8936;">
                <a href="${EMAIL_CONFIG.photoConsentUrl}" style="color: #c05621; text-decoration: none; font-weight: 500; display: flex; align-items: center;">
                  📸 <span style="margin-left: 8px;">Photo Consent Form</span>
                </a>
              </div>
            </div>
            <div style="background-color: #e6fffa; border-left: 4px solid #06b6d4; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; color: #0f766e; font-size: 14px;">
                Action required: After signing, please upload the signed document(s) via your LMS <a href="${EMAIL_CONFIG.settingsUrl}" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">Settings</a> page (Settings → Documents).
              </p>
            </div>
            <div style="text-align: center; margin: 20px 0 0 0;">
              <a href="${EMAIL_CONFIG.settingsUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                Upload Signed Documents
              </a>
            </div>
          </div>
          
          <!-- Support Section -->
          <div style="background-color: #f0fff4; border: 1px solid #9ae6b4; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <p style="color: #22543d; margin: 0; text-align: center; font-size: 15px;">
              💡 <strong>Need Help?</strong> Our support team is here to assist you!<br>
              <span style="color: #2f855a;">Email us or contact your assigned academic coordinator.</span>
            </p>
          </div>
          
          <!-- Closing -->
          <div style="margin-top: 40px;">
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              We're excited to be part of your educational journey and look forward to helping you achieve your academic goals.
            </p>
            <p style="color: #2d3748; font-size: 16px; margin: 0;">
              <strong>Best regards,</strong><br>
              <span style="color: #667eea; font-weight: 600;">The ${EMAIL_CONFIG.companyName} Team</span> 🎓
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 25px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="color: #718096; font-size: 13px; margin: 0; line-height: 1.5;">
            This is an automated message from ${EMAIL_CONFIG.companyName}.<br>
            Please do not reply to this email. For support, contact our help desk.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(email, subject, html);
}

/**
 * Generate and send teacher welcome email with login credentials
 */
export async function sendTeacherWelcomeEmail(
  email: string,
  teacherName: string,
  password: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const subject = `Welcome to ${EMAIL_CONFIG.companyName} - Teacher Account Created`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #4F46E5; text-align: center;">Welcome to ${EMAIL_CONFIG.companyName} Faculty!</h2>
      
      <p>Dear ${teacherName},</p>
      
      <p>Welcome to ${EMAIL_CONFIG.companyName}! We're excited to have you join our teaching community and look forward to your contributions to our students' educational journey.</p>
      
      <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #374151; margin-top: 0;">Your Teacher Login Credentials:</h3>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> <code style="background-color: #E5E7EB; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${password}</code></p>
      </div>
      
      <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
      </div>
      
      <p>As a teacher at ${EMAIL_CONFIG.companyName}, you can now access your teacher portal to:</p>
      <ul>
        <li>Manage your classes and students</li>
        <li>Upload course materials and assignments</li>
        <li>Track student progress and grades</li>
        <li>Communicate with students and parents</li>
        <li>Access teaching resources and tools</li>
        <li>View your schedule and class rosters</li>
      </ul>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${EMAIL_CONFIG.teacherPortalUrl}" 
           style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Access Teacher Portal
        </a>
      </div>
      
      <p>If you have any questions or need assistance with your account, please don't hesitate to contact our administration team.</p>
      
      <p>We're thrilled to have you on board and look forward to working with you!</p>
      
      <p>Best regards,<br>
      The ${EMAIL_CONFIG.companyName} Administration Team</p>
      
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
      <p style="font-size: 12px; color: #6B7280; text-align: center;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  `;
  
  return sendEmail(email, subject, html);
}

/**
 * Send parent email update required notification
 */
export async function sendParentEmailUpdateRequiredEmail(
  parentEmail: string,
  studentId: string,
  studentName: string,
  parentName?: string,
  appUrl?: string,
  adminWhatsApp?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://www.drueducation.com';
  const updateLink = `${baseUrl}/update-parent-email?studentId=${studentId}`;
  const sanitizedWhatsApp = (adminWhatsApp || process.env.NEXT_PUBLIC_ADMIN_WHATSAPP || '').replace(/[^0-9]/g, '');

  const whatsappSection = sanitizedWhatsApp
    ? `<p>Please contact the administrator to make this change via WhatsApp: <a href="https://wa.me/${sanitizedWhatsApp}">Contact Administrator</a></p>`
    : '<p>Please contact the administrator to update the parent email address.</p>';

  const subject = 'DRU EDU - Urgent: Parent Email Update Required';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #111827;">
      <h1 style="color: #4F46E5; margin-bottom: 8px;">DRU EDU</h1>
      <h2 style="margin-top: 0;">Hello ${parentName || 'Parent'},</h2>
      <p>
        Our records show that your parent email address is the same as your student
        <strong>${studentName || ''}</strong>'s email. Parent email must be different from the student email.
      </p>
      <p>
        Please contact the administrator to change the parent email to a different email address.
        If this is not updated within <strong>one week</strong>, your student account will be deactivated.
      </p>
      ${whatsappSection}
      <div style="text-align:center; margin: 28px 0;">
        <a href="${updateLink}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
          Update Parent Email
        </a>
      </div>
      <p style="color:#6B7280;font-size:12px;">If you received this by mistake, please ignore this email.</p>
    </div>
  `;

  return sendEmail(parentEmail, subject, html);
}

/**
 * Generic function to send any email
 */
export async function sendGenericEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendEmail(to, subject, html);
}

/**
 * Test SMTP connection
 */
export async function testSmtpConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const transport = getTransporter();
    await transport.verify();
    console.log('✅ SMTP connection verified successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ SMTP connection failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export the config so it can be modified if needed
export { EMAIL_CONFIG };
