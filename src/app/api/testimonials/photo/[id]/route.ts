import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Testimonial ID is required' }, { status: 400 });
    }

    const snapshot = await firebaseAdmin.db.collection('testimonials').doc(id).get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: 'Testimonial not found' }, { status: 404 });
    }

    const data = snapshot.data();

    if (!data?.photoStoragePath || data.status !== 'approved' || !data.displayPhoto) {
      return NextResponse.json({ error: 'Photo not available' }, { status: 404 });
    }

    const { content, contentType } = await firebaseAdmin.fileStorage.getFileWithMetadata(data.photoStoragePath);

    return new NextResponse(new Uint8Array(content), {
      status: 200,
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Error serving public testimonial photo:', error);
    return NextResponse.json({ error: 'Failed to load testimonial photo' }, { status: 500 });
  }
}
