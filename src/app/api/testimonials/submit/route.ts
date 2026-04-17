import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
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

    // Check this email hasn't submitted before
    const existingSnap = await firebaseAdmin.db
      .collection('testimonials')
      .where('email', '==', data.email.toLowerCase().trim())
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return NextResponse.json(
        { error: 'A testimonial from this email address already exists' },
        { status: 409 }
      );
    }

    const emailVerificationToken = randomUUID();
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
      emailVerified: false,
      emailVerificationToken,
      submittedAt: now,
    };

    await docRef.set(testimonialData);
    testimonialSaved = true;

    // Mark token as used
    await tokenDoc.ref.update({
      used: true,
      usedAt: now,
    });

    // Send verification email via Firebase mail extension
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://drueducation.com.au';
    const verifyLink = `${baseUrl}/testimonials/verify/${emailVerificationToken}`;

    await firebaseAdmin.db.collection('mail').add({
      to: data.email,
      message: {
        subject: 'Please verify your testimonial – Dr. U Education',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #01143d; font-size: 24px; margin: 0;">Dr. U Education</h1>
              <p style="color: #6b7280; margin: 4px 0 0;">Thank you for your testimonial!</p>
            </div>

            <p style="color: #374151;">Hi <strong>${data.name}</strong>,</p>

            <p style="color: #374151;">
              Thank you for sharing your experience with Dr. U Education. We just need to verify
              your email address to confirm your testimonial is authentic before it goes live on our website.
            </p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${verifyLink}"
                 style="background-color: #0088e0; color: white; padding: 14px 32px; border-radius: 9999px;
                        text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                Verify My Testimonial
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              Once verified, your testimonial will be reviewed by our team and published on our
              <a href="${baseUrl}/testimonials" style="color: #0088e0;">testimonials page</a>.
            </p>

            <p style="color: #6b7280; font-size: 14px;">
              If you didn't submit a testimonial to Dr. U Education, you can safely ignore this email.
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              Dr. U Education · Melbourne, Australia
            </p>
          </div>
        `,
      },
    });

    return NextResponse.json(
      { id: docRef.id, message: 'Testimonial submitted. Please check your email to verify.' },
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
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to submit testimonial' }, { status: 500 });
  }
}
