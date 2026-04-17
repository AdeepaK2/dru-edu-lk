import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';
import { testimonialUpdateSchema } from '@/models/testimonialSchema';
import { withAuth, AuthenticatedRequest } from '@/utils/auth-middleware';

// GET all testimonials (admin)
async function getTestimonialsHandler(_request: AuthenticatedRequest) {
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
        studentName: d.studentName ?? null,
        course: d.course,
        year: d.year,
        result: d.result,
        text: d.text,
        stars: d.stars,
        tokenId: d.tokenId,
        photoUrl: d.photoUrl ?? null,
        photoStoragePath: d.photoStoragePath ?? null,
        socialUrl: d.socialUrl ?? null,
        displayPhoto: Boolean(d.displayPhoto),
        displaySocialLink: Boolean(d.displaySocialLink),
        status: d.status,
        featured: d.featured,
        adminNotes: d.adminNotes,
        submittedAt: d.submittedAt?.toDate().toISOString(),
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
async function patchTestimonialHandler(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Testimonial ID is required' }, { status: 400 });
    }

    const validated = testimonialUpdateSchema.parse(updateData);
    if (Object.keys(validated).length === 0) {
      return NextResponse.json({ error: 'At least one field must be updated' }, { status: 400 });
    }

    const docRef = firebaseAdmin.db.collection('testimonials').doc(id);
    const existingDoc = await docRef.get();

    if (!existingDoc.exists) {
      return NextResponse.json({ error: 'Testimonial not found' }, { status: 404 });
    }

    const now = firebaseAdmin.admin.firestore.Timestamp.now();

    const payload: Record<string, unknown> = {
      ...validated,
      updatedAt: now,
    };

    if (validated.status === 'approved') {
      payload.approvedAt = now;
    } else if (validated.status) {
      payload.approvedAt = firebaseAdmin.admin.firestore.FieldValue.delete();
    }

    await docRef.update(payload);

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
async function deleteTestimonialHandler(request: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const docRef = firebaseAdmin.db.collection('testimonials').doc(id);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: 'Testimonial not found' }, { status: 404 });
    }

    const data = snapshot.data();

    if (data?.photoStoragePath) {
      await firebaseAdmin.fileStorage.deleteFile(data.photoStoragePath);
    }

    await docRef.delete();

    return NextResponse.json({ message: 'Testimonial deleted', id });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    return NextResponse.json({ error: 'Failed to delete testimonial' }, { status: 500 });
  }
}

export const GET = withAuth(getTestimonialsHandler, ['admin']);
export const PATCH = withAuth(patchTestimonialHandler, ['admin']);
export const DELETE = withAuth(deleteTestimonialHandler, ['admin']);
