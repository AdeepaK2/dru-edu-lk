import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';
import { testimonialUpdateSchema } from '@/models/testimonialSchema';

// GET all testimonials (admin)
export async function GET() {
  try {
    const snapshot = await firebaseAdmin.db
      .collection('testimonials')
      .orderBy('submittedAt', 'desc')
      .get();

    const testimonials = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        email: d.email,
        role: d.role,
        course: d.course,
        year: d.year,
        result: d.result,
        text: d.text,
        stars: d.stars,
        tokenId: d.tokenId,
        status: d.status,
        featured: d.featured,
        emailVerified: d.emailVerified,
        adminNotes: d.adminNotes,
        submittedAt: d.submittedAt?.toDate().toISOString(),
        verifiedAt: d.verifiedAt?.toDate().toISOString() ?? null,
        approvedAt: d.approvedAt?.toDate().toISOString() ?? null,
      };
    });

    return NextResponse.json(testimonials);
  } catch (error) {
    console.error('Error fetching testimonials (admin):', error);
    return NextResponse.json({ error: 'Failed to fetch testimonials' }, { status: 500 });
  }
}

// PATCH – approve / reject / feature a testimonial
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Testimonial ID is required' }, { status: 400 });
    }

    const validated = testimonialUpdateSchema.parse(updateData);
    const now = firebaseAdmin.admin.firestore.Timestamp.now();

    const payload: Record<string, unknown> = {
      ...validated,
      updatedAt: now,
    };

    if (validated.status === 'approved') {
      payload.approvedAt = now;
    }

    await firebaseAdmin.db.collection('testimonials').doc(id).update(payload);

    return NextResponse.json({ message: 'Testimonial updated', id });
  } catch (error: any) {
    console.error('Error updating testimonial:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to update testimonial' }, { status: 500 });
  }
}

// DELETE a testimonial
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await firebaseAdmin.db.collection('testimonials').doc(id).delete();

    return NextResponse.json({ message: 'Testimonial deleted', id });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    return NextResponse.json({ error: 'Failed to delete testimonial' }, { status: 500 });
  }
}
