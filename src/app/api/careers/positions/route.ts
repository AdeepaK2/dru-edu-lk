import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';
import {
  CAREER_POSITIONS,
  CareerPositionDocument,
  careerPositionSchema,
  careerPositionUpdateSchema,
} from '@/models/careerSchema';
import { authenticateRequest } from '@/utils/auth-middleware';

const COLLECTION = 'careerPositions';

function timestampToIso(value: any): string {
  if (!value) return new Date().toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return new Date(value).toISOString();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function convertPosition(
  id: string,
  data: FirebaseFirestore.DocumentData
): CareerPositionDocument {
  return {
    id,
    title: data.title || '',
    type: data.type || '',
    location: data.location || '',
    summary: data.summary || '',
    isActive: data.isActive !== false,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

async function ensureDefaultPositionsIfMissing() {
  const snapshot = await firebaseAdmin.db.collection(COLLECTION).limit(1).get();
  if (!snapshot.empty) {
    return;
  }

  const batch = firebaseAdmin.db.batch();
  const now = firebaseAdmin.admin.firestore.Timestamp.now();

  for (const position of CAREER_POSITIONS) {
    const docRef = firebaseAdmin.db.collection(COLLECTION).doc(position.id);
    batch.set(docRef, {
      title: position.title,
      type: position.type,
      location: position.location,
      summary: position.summary,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();
}

export async function GET(request: NextRequest) {
  try {
    await ensureDefaultPositionsIfMissing();

    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';

    if (includeInactive) {
      const { error } = await authenticateRequest(request, ['admin']);
      if (error) return error;
    }

    const snapshot = await firebaseAdmin.db.collection(COLLECTION).orderBy('createdAt', 'desc').get();
    const allPositions = snapshot.docs.map((doc) => convertPosition(doc.id, doc.data()));
    const positions = includeInactive
      ? allPositions
      : allPositions.filter((position) => position.isActive);

    return NextResponse.json(positions);
  } catch (error) {
    console.error('Error fetching career positions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch career positions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await authenticateRequest(request, ['admin']);
    if (error) return error;

    const body = await request.json();
    const validatedData = careerPositionSchema.parse(body);
    const positionId = slugify(validatedData.title);

    if (!positionId) {
      return NextResponse.json(
        { error: 'Invalid position title. Please choose a different title.' },
        { status: 400 }
      );
    }

    const existing = await firebaseAdmin.db.collection(COLLECTION).doc(positionId).get();
    if (existing.exists) {
      return NextResponse.json(
        { error: 'A position with a similar title already exists.' },
        { status: 409 }
      );
    }

    const now = firebaseAdmin.admin.firestore.Timestamp.now();
    const payload = {
      title: validatedData.title,
      type: validatedData.type,
      location: validatedData.location,
      summary: validatedData.summary,
      isActive: validatedData.isActive !== false,
      createdAt: now,
      updatedAt: now,
    };

    await firebaseAdmin.db.collection(COLLECTION).doc(positionId).set(payload);

    return NextResponse.json(convertPosition(positionId, payload), { status: 201 });
  } catch (error: any) {
    console.error('Error creating career position:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create position' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { error } = await authenticateRequest(request, ['admin']);
    if (error) return error;

    const body = await request.json();
    const validatedData = careerPositionUpdateSchema.parse(body);
    const positionRef = firebaseAdmin.db.collection(COLLECTION).doc(validatedData.id);
    const existing = await positionRef.get();

    if (!existing.exists) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      );
    }

    const updatePayload: Record<string, any> = {
      updatedAt: firebaseAdmin.admin.firestore.Timestamp.now(),
    };

    if (validatedData.title !== undefined) updatePayload.title = validatedData.title;
    if (validatedData.type !== undefined) updatePayload.type = validatedData.type;
    if (validatedData.location !== undefined) updatePayload.location = validatedData.location;
    if (validatedData.summary !== undefined) updatePayload.summary = validatedData.summary;
    if (validatedData.isActive !== undefined) updatePayload.isActive = validatedData.isActive;

    await positionRef.update(updatePayload);
    const updatedSnapshot = await positionRef.get();

    return NextResponse.json(convertPosition(updatedSnapshot.id, updatedSnapshot.data()!));
  } catch (error: any) {
    console.error('Error updating career position:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update position' },
      { status: 500 }
    );
  }
}
