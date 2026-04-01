import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidStudentId(studentId: string): boolean {
  const trimmed = studentId.trim();
  return trimmed.length >= 6 && trimmed.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

async function resolveStudentEmail(studentId: string, studentData: any): Promise<string> {
  const directEmail = normalizeEmail(
    studentData?.email || studentData?.studentEmail || studentData?.contact?.email || '',
  );

  if (directEmail) {
    return directEmail;
  }

  try {
    const authUser = await firebaseAdmin.authentication.getUser(studentId);
    return normalizeEmail(authUser?.email || '');
  } catch {
    return '';
  }
}

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get('studentId')?.trim() || '';

    if (!studentId || !isValidStudentId(studentId)) {
      return NextResponse.json({ error: 'Invalid studentId' }, { status: 400 });
    }

    const studentSnap = await firebaseAdmin.db.collection('students').doc(studentId).get();

    if (!studentSnap.exists) {
      return NextResponse.json({ error: 'Student record was not found' }, { status: 404 });
    }

    const data = studentSnap.data() || {};
    const studentEmail = await resolveStudentEmail(studentId, data);

    return NextResponse.json({
      student: {
        id: studentSnap.id,
        name: data.name || '',
        email: studentEmail,
        parentName: data.parent?.name || '',
        parentEmail: data.parent?.email || '',
      },
    });
  } catch (error) {
    console.error('Error loading student for parent email update request:', error);
    return NextResponse.json({ error: 'Failed to load student details' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const studentId = (body?.studentId || '').trim();
    const requestedParentEmail = normalizeEmail(body?.newParentEmail || '');
    const requesterName = typeof body?.requesterName === 'string' ? body.requesterName.trim() : '';

    if (!studentId || !isValidStudentId(studentId)) {
      return NextResponse.json({ error: 'Invalid studentId' }, { status: 400 });
    }

    if (!requestedParentEmail) {
      return NextResponse.json({ error: 'Please provide the new parent email address.' }, { status: 400 });
    }

    if (!isValidEmail(requestedParentEmail)) {
      return NextResponse.json({ error: 'Please provide a valid parent email address.' }, { status: 400 });
    }

    const studentSnap = await firebaseAdmin.db.collection('students').doc(studentId).get();

    if (!studentSnap.exists) {
      return NextResponse.json({ error: 'Student record was not found' }, { status: 404 });
    }

    const studentData = studentSnap.data() || {};
    const studentEmail = await resolveStudentEmail(studentId, studentData);
    const currentParentEmail = normalizeEmail(studentData.parent?.email || '');

    if (!studentEmail) {
      return NextResponse.json(
        { error: 'Student email is not available for this record. Please contact the administrator.' },
        { status: 422 },
      );
    }

    if (requestedParentEmail === studentEmail) {
      return NextResponse.json(
        { error: 'The new parent email cannot be the same as the student email.' },
        { status: 400 },
      );
    }

    if (requestedParentEmail === currentParentEmail) {
      return NextResponse.json(
        { error: 'This email is already set as the parent email. Please use a different one.' },
        { status: 400 },
      );
    }

    const existingRequestsSnap = await firebaseAdmin.db
      .collection('parentEmailUpdateRequests')
      .where('studentId', '==', studentId)
      .limit(20)
      .get();

    const hasPendingRequest = existingRequestsSnap.docs.some((requestDoc) => {
      const status = requestDoc.data()?.status || 'pending';
      return status === 'pending';
    });

    if (hasPendingRequest) {
      return NextResponse.json(
        { error: 'A pending request already exists for this student. Please wait for admin approval.' },
        { status: 409 },
      );
    }

    await firebaseAdmin.db.collection('parentEmailUpdateRequests').add({
      studentId,
      studentName: studentData.name || '',
      studentEmail,
      currentParentEmail,
      requestedParentEmail,
      requesterName: requesterName || null,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating parent email update request:', error);
    return NextResponse.json({ error: 'Failed to create parent email update request' }, { status: 500 });
  }
}
