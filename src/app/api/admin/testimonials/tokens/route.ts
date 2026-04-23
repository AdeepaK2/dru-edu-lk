import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import firebaseAdmin from '@/utils/firebase-server';
import { testimonialTokenCreateSchema } from '@/models/testimonialSchema';
import { withAuth, AuthenticatedRequest } from '@/utils/auth-middleware';

function getSubmissionBaseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL || 'https://drueducation.com.au').replace(/\/$/, '');
}

// GET all tokens
async function getTokensHandler(_request: AuthenticatedRequest) {
  try {
    const baseUrl = getSubmissionBaseUrl();
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
        recipientEmail: d.recipientEmail ?? null,
        used: d.used,
        usedAt: d.usedAt?.toDate().toISOString() ?? null,
        expiresAt: d.expiresAt?.toDate().toISOString() ?? null,
        createdAt: d.createdAt?.toDate().toISOString(),
        createdBy: d.createdBy,
        submissionLink: `${baseUrl}/testimonials/submit/${d.token}`,
      };
    });

    return NextResponse.json(tokens);
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 });
  }
}

// POST – create a new submission token
async function createTokenHandler(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const validated = testimonialTokenCreateSchema.parse(body);

    const token = randomUUID().replace(/-/g, '');
    const now = firebaseAdmin.admin.firestore.Timestamp.now();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const tokenData: Record<string, unknown> = {
      token,
      label: validated.label,
      recipientEmail: validated.recipientEmail ?? null,
      used: false,
      createdAt: now,
      createdBy: request.user.email || 'admin',
      expiresAt: firebaseAdmin.admin.firestore.Timestamp.fromDate(expiresAt),
    };

    const docRef = await firebaseAdmin.db.collection('testimonialTokens').add(tokenData);

    const baseUrl = getSubmissionBaseUrl();
    const submissionLink = `${baseUrl}/testimonials/submit/${token}`;

    let emailQueued = false;
    let warning: string | null = null;

    if (validated.recipientEmail) {
      try {
        await firebaseAdmin.db.collection('mail').add({
          to: validated.recipientEmail,
          message: {
            subject: 'Your Dr. U Education testimonial invite',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #01143d; font-size: 24px; margin: 0;">Dr. U Education</h1>
                  <p style="color: #6b7280; margin: 4px 0 0;">We would love your testimonial</p>
                </div>

                <p style="color: #374151;">Hello,</p>

                <p style="color: #374151;">
                  We would love to hear about your experience with Dr. U Education. Please use the secure link below to submit your testimonial.
                </p>

                <div style="text-align: center; margin: 32px 0;">
                  <a href="${submissionLink}"
                    style="background-color: #0088e0; color: white; padding: 14px 32px; border-radius: 9999px;
                          text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                    Submit Your Testimonial
                  </a>
                </div>

                <p style="color: #6b7280; font-size: 14px;">
                  This one-time invite link will expire on ${expiresAt.toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}.
                </p>

                <p style="color: #6b7280; font-size: 14px;">
                  If the button does not work, copy and paste this link into your browser:
                  <br />
                  <a href="${submissionLink}" style="color: #0088e0; word-break: break-all;">${submissionLink}</a>
                </p>
              </div>
            `,
          },
        });
        emailQueued = true;
      } catch (emailError) {
        console.error('Failed to queue testimonial invite email:', emailError);
        warning = 'Invite link created, but the email could not be queued. You can still copy the link below.';
      }
    }

    return NextResponse.json(
      {
        id: docRef.id,
        token,
        label: validated.label,
        submissionLink,
        expiresAt: expiresAt.toISOString(),
        recipientEmail: validated.recipientEmail ?? null,
        createdAt: now.toDate().toISOString(),
        used: false,
        usedAt: null,
        emailQueued,
        warning,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating token:', error);

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

    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
  }
}

// DELETE – revoke a token
async function deleteTokenHandler(request: AuthenticatedRequest) {
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

export const GET = withAuth(getTokensHandler, ['admin']);
export const POST = withAuth(createTokenHandler, ['admin']);
export const DELETE = withAuth(deleteTokenHandler, ['admin']);
