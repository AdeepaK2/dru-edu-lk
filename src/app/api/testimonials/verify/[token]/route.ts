import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const snapshot = await firebaseAdmin.db
      .collection('testimonials')
      .where('emailVerificationToken', '==', token)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ success: false, reason: 'Invalid verification link' }, { status: 404 });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    if (data.emailVerified) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    await doc.ref.update({
      emailVerified: true,
      verifiedAt: firebaseAdmin.admin.firestore.Timestamp.now(),
    });

    return NextResponse.json({ success: true, alreadyVerified: false });
  } catch (error) {
    console.error('Error verifying testimonial email:', error);
    return NextResponse.json({ success: false, reason: 'Internal error' }, { status: 500 });
  }
}
