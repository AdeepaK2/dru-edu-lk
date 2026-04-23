import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';
import { testimonialSubmitSchema, validateTestimonialPhoto } from '@/models/testimonialSchema';

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
}

export async function POST(request: NextRequest) {
  let uploadedPhotoPath: string | null = null;
  let testimonialSaved = false;

  try {
    const formData = await request.formData();
    const rawPhoto = formData.get('photo');
    const photo = rawPhoto instanceof File && rawPhoto.size > 0 ? rawPhoto : null;

    const photoValidation = validateTestimonialPhoto(photo);
    if (!photoValidation.isValid) {
      return NextResponse.json({ error: photoValidation.error }, { status: 400 });
    }

    const data = testimonialSubmitSchema.parse({
      name: formData.get('name'),
      email: formData.get('email'),
      role: formData.get('role'),
      studentName: formData.get('studentName'),
      course: formData.get('course'),
      year: formData.get('year'),
      result: formData.get('result'),
      text: formData.get('text'),
      stars: formData.get('stars'),
      socialUrl: formData.get('socialUrl'),
      token: formData.get('token'),
    });

    // Validate token
    const tokenSnapshot = await firebaseAdmin.db
      .collection('testimonialTokens')
      .where('token', '==', data.token)
      .limit(1)
      .get();

    if (tokenSnapshot.empty) {
      return NextResponse.json({ error: 'Invalid submission link' }, { status: 400 });
    }

    const tokenDoc = tokenSnapshot.docs[0];
    const tokenData = tokenDoc.data();

    if (tokenData.used) {
      return NextResponse.json({ error: 'This link has already been used' }, { status: 410 });
    }

    if (tokenData.expiresAt && tokenData.expiresAt.toDate() < new Date()) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
    }

    const now = firebaseAdmin.admin.firestore.Timestamp.now();
    const docRef = firebaseAdmin.db.collection('testimonials').doc();

    let uploadedPhotoUrl: string | null = null;

    if (photo) {
      const extension = photo.name.split('.').pop() || 'jpg';
      uploadedPhotoPath = `testimonials/photos/${docRef.id}/${Date.now()}-${sanitizeFileName(photo.name || `photo.${extension}`)}`;
      const fileBuffer = Buffer.from(await photo.arrayBuffer());
      const uploaded = await firebaseAdmin.fileStorage.uploadPublicFile(uploadedPhotoPath, fileBuffer, {
        contentType: photo.type,
        metadata: {
          testimonialId: docRef.id,
        },
      });
      uploadedPhotoUrl = uploaded.url;
    }

    const testimonialData = {
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      role: data.role,
      studentName: data.studentName?.trim() || null,
      course: data.course.trim(),
      year: data.year,
      result: data.result?.trim() || null,
      text: data.text.trim(),
      stars: data.stars,
      tokenId: tokenDoc.id,
      photoUrl: uploadedPhotoUrl,
      photoStoragePath: uploadedPhotoPath,
      socialUrl: data.socialUrl?.trim() || null,
      displayPhoto: false,
      displaySocialLink: false,
      status: 'pending',
      featured: false,
      submittedAt: now,
    };

    await docRef.set(testimonialData);
    testimonialSaved = true;

    // Mark token as used
    await tokenDoc.ref.update({
      used: true,
      usedAt: now,
    });

    return NextResponse.json(
      { id: docRef.id, message: 'Testimonial submitted. Our team will review it before publishing.' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error submitting testimonial:', error);

    if (uploadedPhotoPath && !testimonialSaved) {
      try {
        await firebaseAdmin.fileStorage.deleteFile(uploadedPhotoPath);
      } catch (cleanupError) {
        console.error('Failed to clean up uploaded testimonial photo:', cleanupError);
      }
    }

    if (error.name === 'ZodError') {
      const issues = error.issues ?? error.errors ?? [];
      return NextResponse.json(
        {
          error: issues[0]?.message || 'Validation failed',
          details: issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to submit testimonial' }, { status: 500 });
  }
}
