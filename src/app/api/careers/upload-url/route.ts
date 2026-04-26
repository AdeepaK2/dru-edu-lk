import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';
import { checkRateLimit } from '@/utils/auth-middleware';

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx']);
const SIGNED_UPLOAD_TTL_MS = 10 * 60 * 1000;
const UPLOAD_URL_RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 10 * 60 * 1000,
};

type CareerDocumentType = 'resume' | 'cover-letter';

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function getClientIdentifier(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return forwardedFor || realIp || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const clientIdentifier = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(
      `careers-upload-url:${clientIdentifier}`,
      UPLOAD_URL_RATE_LIMIT.maxRequests,
      UPLOAD_URL_RATE_LIMIT.windowMs
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many upload attempts. Please wait and try again.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const documentType =
      body?.documentType === 'resume' || body?.documentType === 'cover-letter'
        ? (body.documentType as CareerDocumentType)
        : null;
    const fileName = typeof body?.fileName === 'string' ? body.fileName : '';
    const contentType = typeof body?.contentType === 'string' ? body.contentType : '';
    const size = typeof body?.size === 'number' ? body.size : NaN;

    if (!documentType) {
      return NextResponse.json(
        { error: 'Invalid document type. Expected resume or cover-letter.' },
        { status: 400 }
      );
    }

    if (!fileName.trim()) {
      return NextResponse.json(
        { error: 'File name is required.' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File is too large. Maximum allowed size is 5MB.' },
        { status: 400 }
      );
    }

    const extension = getFileExtension(fileName);
    const validByExtension = ALLOWED_EXTENSIONS.has(extension);
    const validByMime = ALLOWED_MIME_TYPES.has(contentType);

    if (!validByExtension && !validByMime) {
      return NextResponse.json(
        { error: 'Only PDF, DOC, or DOCX files are allowed.' },
        { status: 400 }
      );
    }

    const safeFileName = sanitizeFileName(fileName);
    const storagePath = `careers/${documentType}/${Date.now()}-${randomUUID()}-${safeFileName}`;
    const downloadToken = randomUUID();
    const bucketFile = firebaseAdmin.fileStorage.bucket.file(storagePath);

    const [uploadUrl] = await bucketFile.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + SIGNED_UPLOAD_TTL_MS,
      contentType: contentType || 'application/octet-stream',
      extensionHeaders: {
        'x-goog-meta-firebaseStorageDownloadTokens': downloadToken,
        'x-goog-meta-documentType': documentType,
        'x-goog-meta-originalName': safeFileName,
      },
    });

    return NextResponse.json({
      uploadUrl,
      publicUrl: firebaseAdmin.fileStorage.getFileUrl(storagePath, downloadToken),
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'x-goog-meta-firebaseStorageDownloadTokens': downloadToken,
        'x-goog-meta-documentType': documentType,
        'x-goog-meta-originalName': safeFileName,
      },
    });
  } catch (error) {
    console.error('Error creating career upload URL:', error);
    return NextResponse.json(
      { error: 'Failed to initialize upload. Please try again.' },
      { status: 500 }
    );
  }
}
