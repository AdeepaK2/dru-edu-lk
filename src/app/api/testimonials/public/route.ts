import { NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';
import { TestimonialDocument, PublicTestimonial } from '@/models/testimonialSchema';

export async function GET() {
  try {
    const snapshot = await firebaseAdmin.db
      .collection('testimonials')
      .where('status', '==', 'approved')
      .orderBy('submittedAt', 'desc')
      .get();

    const testimonials: PublicTestimonial[] = snapshot.docs.map((doc) => {
      const d = doc.data() as Omit<TestimonialDocument, 'id'>;
      return {
        id: doc.id,
        name: d.name,
        role: d.role,
        course: d.course,
        year: d.year,
        result: d.result,
        text: d.text,
        stars: d.stars,
        featured: d.featured,
        emailVerified: d.emailVerified,
        photoUrl: d.displayPhoto && d.photoStoragePath ? `/api/testimonials/photo/${doc.id}` : undefined,
        socialUrl: d.displaySocialLink ? d.socialUrl ?? undefined : undefined,
        submittedAt: d.submittedAt.toDate().toISOString(),
      };
    });

    // Put featured ones first
    testimonials.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

    return NextResponse.json(testimonials);
  } catch (error) {
    console.error('Error fetching public testimonials:', error);
    return NextResponse.json({ error: 'Failed to fetch testimonials' }, { status: 500 });
  }
}
