import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/utils/firebase-admin';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, studentName, parentEmail, parentName } = body;

    if (!studentId || !parentEmail) {
      return NextResponse.json({ error: 'Missing studentId or parentEmail' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dru-edu.com';
    const updateLink = `${appUrl}/update-parent-email?studentId=${studentId}`;
    const adminWhatsApp = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP || '';

    const emailHost = process.env.MAIL_HOST;
    const emailUser = process.env.MAIL_USERNAME;
    const emailPass = process.env.MAIL_PASSWORD;
    const emailFrom = process.env.MAIL_FROM || emailUser || 'noreply@dru-edu.com';

    if (!emailHost || !emailUser || !emailPass) {
      return NextResponse.json({ error: 'Email service not configured on server' }, { status: 503 });
    }

    const transporter = nodemailer.createTransport({
      host: emailHost,
      port: parseInt(process.env.MAIL_PORT || '587', 10),
      secure: process.env.MAIL_SECURE === 'true',
      auth: { user: emailUser, pass: emailPass },
    });

    const whatsappSection = adminWhatsApp
      ? `<p>To get the security code needed to update your email, please contact the administrator via WhatsApp: <a href="https://wa.me/${adminWhatsApp.replace(/[^0-9]/g, '')}">Click here to WhatsApp Admin</a></p>`
      : '';

    await transporter.sendMail({
      from: emailFrom,
      to: parentEmail,
      subject: 'DRU EDU - Action Required: Update Your Parent Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #4F46E5;">DRU EDU</h1>
          <h2>Hello ${parentName || 'Parent'},</h2>
          <p>Our records show that your parent portal email address is the same as your child <strong>${studentName || ''}</strong>'s student email. For security purposes, we require parents to register with a separate email address.</p>
          <div style="text-align:center; margin: 30px 0;">
            <a href="${updateLink}" style="background:#4F46E5;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Update My Parent Email</a>
          </div>
          ${whatsappSection}
          <p style="color:#9CA3AF;font-size:12px;">If you did not expect this email, please ignore it.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: `Email sent to ${parentEmail}` });
  } catch (error: any) {
    console.error('Error sending parent update email:', error);
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
  }
}
