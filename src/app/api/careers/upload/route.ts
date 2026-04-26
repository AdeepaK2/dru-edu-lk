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
const UPLOAD_RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 10 * 60 * 1000,
};

function getClientIdentifier(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return forwardedFor || realIp || 'unknown';
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function getFileExtension(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension || '';
}

function isAllowedCareerDocument(file: File): boolean {
  const byMime = file.type ? ALLOWED_MIME_TYPES.has(file.type) : false;
  const byExtension = ALLOWED_EXTENSIONS.has(getFileExtension(file.name));
  return byMime || byExtension;
}

export async function POST(request: NextRequest) {
  try {
    const clientIdentifier = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(
      `careers-upload:${clientIdentifier}`,
      UPLOAD_RATE_LIMIT.maxRequests,
      UPLOAD_RATE_LIMIT.windowMs
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many upload attempts. Please wait and try again.' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const rawDocumentType = formData.get('documentType');
    const documentType =
      rawDocumentType === 'resume' || rawDocumentType === 'cover-letter'
        ? rawDocumentType
        : null;

    if (!documentType) {
      return NextResponse.json(
        { error: 'Invalid document type. Expected resume or cover-letter.' },
        { status: 400 }
      );
    }

    const rawFile = formData.get('file');
    const file = rawFile instanceof File ? rawFile : null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: 'Please select a file to upload.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File is too large. Maximum allowed size is 5MB.' },
        { status: 400 }
      );
    }

    if (!isAllowedCareerDocument(file)) {
      return NextResponse.json(
        { error: 'Only PDF, DOC, or DOCX files are allowed.' },
        { status: 400 }
      );
    }

    const safeName = sanitizeFileName(file.name || `${documentType}.pdf`);
    const storagePath = `careers/${documentType}/${Date.now()}-${randomUUID()}-${safeName}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const uploaded = await firebaseAdmin.fileStorage.uploadPublicFile(storagePath, fileBuffer, {
      contentType: file.type || 'application/octet-stream',
      metadata: {
        documentType,
        originalName: file.name || '',
      },
    });

    return NextResponse.json({
      url: uploaded.url,
      fileName: safeName,
      filePath: uploaded.filePath,
    });
  } catch (error) {
    console.error('Error uploading career document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document. Please try again.' },
      { status: 500 }
    );
  }
}
