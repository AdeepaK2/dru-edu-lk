import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const snapshot = await firebaseAdmin.db
      .collection('testimonialTokens')
      .where('token', '==', token)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ valid: false, reason: 'Token not found' }, { status: 404 });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    if (data.used) {
      return NextResponse.json({ valid: false, reason: 'This link has already been used' }, { status: 410 });
    }

    if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
      return NextResponse.json({ valid: false, reason: 'This link has expired' }, { status: 410 });
    }

    return NextResponse.json({ valid: true, label: data.label });
  } catch (error) {
    console.error('Error validating token:', error);
    return NextResponse.json({ valid: false, reason: 'Internal error' }, { status: 500 });
  }
}
