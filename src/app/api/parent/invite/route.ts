import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { generateInviteToken } from '@/utils/invite-helpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parentEmail, parentName, parentPhone, studentIds, relationship } = body;

    if (!parentEmail || !parentName || !studentIds || studentIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: parentEmail, parentName, and studentIds' },
        { status: 400 }
      );
    }

    // Fetch student details
    const studentsData = await Promise.all(
      studentIds.map(async (id: string) => {
        const studentDoc = await adminDb.collection('students').doc(id).get();
        if (!studentDoc.exists) {
          throw new Error(`Student with ID ${id} not found`);
        }
        const student = studentDoc.data();
        return {
          id: studentDoc.id,
          name: student?.name || '',
          email: student?.email || '',
        };
      })
    );

    // Generate invite token and expiry
    const inviteToken = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create invite document
    const inviteData = {
      parentEmail,
      parentName,
      parentPhone: parentPhone || '',
      students: studentsData,
      relationship: relationship || 'guardian',
      inviteStatus: 'pending',
      inviteToken,
      inviteLink: `${process.env.NEXT_PUBLIC_MOBILE_APP_URL || 'https://parent-app.example.com'}/invite/${inviteToken}`,
      sentAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date(),
    };

    const inviteRef = await adminDb.collection('parentInvites').add(inviteData);

    // TODO: Send email notification to parent
    // await sendInviteEmail(parentEmail, inviteData);

    return NextResponse.json({
      success: true,
      inviteId: inviteRef.id,
      inviteToken,
      message: 'Invite sent successfully',
    });
  } catch (error: any) {
    console.error('Error sending invite:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send invite' },
      { status: 500 }
    );
  }
}
