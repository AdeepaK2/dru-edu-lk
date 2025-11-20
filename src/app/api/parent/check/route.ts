import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // Check for existing parent accounts
    const parentsSnapshot = await adminDb
      .collection('parents')
      .where('email', '==', email)
      .get();

    // Check for pending/accepted invites
    const invitesSnapshot = await adminDb
      .collection('parentInvites')
      .where('parentEmail', '==', email)
      .where('inviteStatus', 'in', ['pending', 'accepted'])
      .get();

    if (parentsSnapshot.empty && invitesSnapshot.empty) {
      return NextResponse.json({ exists: false });
    }

    // Gather linked students
    const linkedStudents: Array<{ studentId: string; studentName: string }> = [];
    const pendingInvites: any[] = [];

    // From existing parent accounts
    parentsSnapshot.forEach((doc) => {
      const parent = doc.data();
      if (parent.linkedStudents) {
        parent.linkedStudents.forEach((student: any) => {
          if (!linkedStudents.some(s => s.studentId === student.studentId)) {
            linkedStudents.push({
              studentId: student.studentId,
              studentName: student.studentName,
            });
          }
        });
      }
    });

    // From invites
    invitesSnapshot.forEach((doc) => {
      const invite = doc.data();
      
      if (invite.inviteStatus === 'pending') {
        pendingInvites.push({
          id: doc.id,
          ...invite,
        });
      }

      if (invite.students) {
        invite.students.forEach((student: any) => {
          if (!linkedStudents.some(s => s.studentId === student.id)) {
            linkedStudents.push({
              studentId: student.id,
              studentName: student.name,
            });
          }
        });
      }
    });

    // Get parent info from first found record
    const parentInfo = parentsSnapshot.docs[0]?.data() || invitesSnapshot.docs[0]?.data();

    return NextResponse.json({
      exists: true,
      parentInfo: {
        email: email,
        name: parentInfo?.parentName || '',
        phone: parentInfo?.parentPhone || '',
        linkedStudents,
        pendingInvites: pendingInvites.length > 0 ? pendingInvites : undefined,
      },
    });
  } catch (error) {
    console.error('Error checking parent:', error);
    return NextResponse.json(
      { error: 'Failed to check parent existence' },
      { status: 500 }
    );
  }
}
