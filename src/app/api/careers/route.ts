import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';
import {
  CareerApplicationDocument,
  careerApplicationSchema,
  careerApplicationUpdateSchema,
} from '@/models/careerSchema';
import { authenticateRequest, checkRateLimit } from '@/utils/auth-middleware';
import { verifyTurnstileToken } from '@/utils/turnstile-server';

const COLLECTION = 'careerApplications';
const MAIL_COLLECTION = 'mail';
const PUBLIC_POST_RATE_LIMIT = {
  maxRequests: 6,
  windowMs: 10 * 60 * 1000,
};
const ADMIN_PAGE_DEFAULT_LIMIT = 25;
const ADMIN_PAGE_MAX_LIMIT = 100;

function getClientIdentifier(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return forwardedFor || realIp || 'unknown';
}

function parsePaginationLimit(rawLimit: string | null) {
  if (!rawLimit) return ADMIN_PAGE_DEFAULT_LIMIT;
  const value = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(value) || value <= 0) return ADMIN_PAGE_DEFAULT_LIMIT;
  return Math.min(value, ADMIN_PAGE_MAX_LIMIT);
}

function timestampToIso(value: any): string {
  if (!value) return new Date().toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return new Date(value).toISOString();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function convertApplication(
  id: string,
  data: FirebaseFirestore.DocumentData
): CareerApplicationDocument {
  return {
    id,
    positionId: data.positionId,
    positionTitle: data.positionTitle,
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    location: data.location,
    experience: data.experience,
    availability: data.availability,
    resumeUrl: data.resumeUrl || '',
    coverLetterUrl: data.coverLetterUrl || '',
    status: data.status || 'New',
    adminNotes: data.adminNotes || '',
    emailHistory: (data.emailHistory || []).map((item: any) => ({
      subject: item.subject || '',
      message: item.message || '',
      sentAt: timestampToIso(item.sentAt),
    })),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export async function POST(request: NextRequest) {
  try {
    const clientIdentifier = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(
      `careers-post:${clientIdentifier}`,
      PUBLIC_POST_RATE_LIMIT.maxRequests,
      PUBLIC_POST_RATE_LIMIT.windowMs
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please wait and try again.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const captchaToken = typeof body?.captchaToken === 'string' ? body.captchaToken : '';
    const turnstileVerification = await verifyTurnstileToken(captchaToken, clientIdentifier);

    if (!turnstileVerification.success) {
      return NextResponse.json(
        { error: turnstileVerification.error || 'Security verification failed.' },
        { status: 400 }
      );
    }

    const validatedData = careerApplicationSchema.parse(body);
    const now = firebaseAdmin.admin.firestore.Timestamp.now();

    const applicationData = {
      ...validatedData,
      resumeUrl: validatedData.resumeUrl || '',
      coverLetterUrl: validatedData.coverLetterUrl || '',
      status: 'New' as const,
      adminNotes: '',
      emailHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await firebaseAdmin.db.collection(COLLECTION).add(applicationData);

    return NextResponse.json(
      convertApplication(docRef.id, applicationData),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating career application:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to submit application' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { error } = await authenticateRequest(request, ['admin']);
    if (error) return error;

    const isPaginatedRequest = request.nextUrl.searchParams.get('paginated') === 'true';

    if (!isPaginatedRequest) {
      const snapshot = await firebaseAdmin.db
        .collection(COLLECTION)
        .orderBy('createdAt', 'desc')
        .get();

      const applications = snapshot.docs.map((doc) =>
        convertApplication(doc.id, doc.data())
      );

      return NextResponse.json(applications);
    }

    const limit = parsePaginationLimit(request.nextUrl.searchParams.get('limit'));
    const cursor = request.nextUrl.searchParams.get('cursor');

    let query: FirebaseFirestore.Query = firebaseAdmin.db
      .collection(COLLECTION)
      .orderBy('createdAt', 'desc');

    if (cursor) {
      const cursorDoc = await firebaseAdmin.db.collection(COLLECTION).doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.limit(limit + 1).get();
    const hasMore = snapshot.docs.length > limit;
    const pageDocs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    const applications = pageDocs.map((doc) =>
      convertApplication(doc.id, doc.data())
    );

    const nextCursor = hasMore ? pageDocs[pageDocs.length - 1]?.id || null : null;

    return NextResponse.json({
      applications,
      hasMore,
      nextCursor,
    });
  } catch (error) {
    console.error('Error fetching career applications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch applications' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { error } = await authenticateRequest(request, ['admin']);
    if (error) return error;

    const body = await request.json();
    const validatedData = careerApplicationUpdateSchema.parse(body);
    const applicationRef = firebaseAdmin.db.collection(COLLECTION).doc(validatedData.id);
    const applicationSnapshot = await applicationRef.get();

    if (!applicationSnapshot.exists) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    const application = applicationSnapshot.data()!;
    const now = firebaseAdmin.admin.firestore.Timestamp.now();
    const updatePayload: Record<string, any> = {
      updatedAt: now,
    };

    if (validatedData.status) {
      updatePayload.status = validatedData.status;
    }

    if (validatedData.adminNotes !== undefined) {
      updatePayload.adminNotes = validatedData.adminNotes;
    }

    if (validatedData.email) {
      const safeMessage = escapeHtml(validatedData.email.message).replace(/\n/g, '<br>');

      await firebaseAdmin.db.collection(MAIL_COLLECTION).add({
        to: application.email,
        message: {
          subject: validatedData.email.subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #01143d; margin-bottom: 16px;">Dr U Education Careers</h2>
              <p style="color: #374151; line-height: 1.6;">Dear ${escapeHtml(application.fullName)},</p>
              <div style="color: #374151; line-height: 1.6;">${safeMessage}</div>
              <p style="color: #374151; line-height: 1.6; margin-top: 24px;">Best regards,<br>Dr U Education Team</p>
            </div>
          `.trim(),
        },
      });

      updatePayload.status = validatedData.status || 'Contacted';
      updatePayload.emailHistory = firebaseAdmin.admin.firestore.FieldValue.arrayUnion({
        subject: validatedData.email.subject,
        message: validatedData.email.message,
        sentAt: now,
      });
    }

    await applicationRef.update(updatePayload);
    const updatedSnapshot = await applicationRef.get();

    return NextResponse.json(
      convertApplication(updatedSnapshot.id, updatedSnapshot.data()!)
    );
  } catch (error: any) {
    console.error('Error updating career application:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update application' },
      { status: 500 }
    );
  }
}
