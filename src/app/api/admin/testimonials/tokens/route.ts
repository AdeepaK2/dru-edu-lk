import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import firebaseAdmin from '@/utils/firebase-server';
import { testimonialTokenCreateSchema } from '@/models/testimonialSchema';

// GET all tokens
export async function GET() {
  try {
    const snapshot = await firebaseAdmin.db
      .collection('testimonialTokens')
      .orderBy('createdAt', 'desc')
      .get();

    const tokens = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        token: d.token,
        label: d.label,
        used: d.used,
        usedAt: d.usedAt?.toDate().toISOString() ?? null,
        expiresAt: d.expiresAt?.toDate().toISOString() ?? null,
        createdAt: d.createdAt?.toDate().toISOString(),
        createdBy: d.createdBy,
      };
    });

    return NextResponse.json(tokens);
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 });
  }
}

// POST – create a new submission token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = testimonialTokenCreateSchema.parse(body);

    const token = randomUUID().replace(/-/g, '');
    const now = firebaseAdmin.admin.firestore.Timestamp.now();

    const tokenData: Record<string, unknown> = {
      token,
      label: validated.label,
      used: false,
      createdAt: now,
      createdBy: body.createdBy || 'admin',
    };

    if (validated.expiresAt) {
      tokenData.expiresAt = firebaseAdmin.admin.firestore.Timestamp.fromDate(
        new Date(validated.expiresAt)
      );
    }

    const docRef = await firebaseAdmin.db.collection('testimonialTokens').add(tokenData);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://drueducation.com.au';
    const submissionLink = `${baseUrl}/testimonials/submit/${token}`;

    return NextResponse.json({ id: docRef.id, token, submissionLink }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating token:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
  }
}

// DELETE – revoke a token
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await firebaseAdmin.db.collection('testimonialTokens').doc(id).delete();

    return NextResponse.json({ message: 'Token deleted', id });
  } catch (error) {
    console.error('Error deleting token:', error);
    return NextResponse.json({ error: 'Failed to delete token' }, { status: 500 });
  }
}
