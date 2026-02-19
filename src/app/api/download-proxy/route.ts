import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side download proxy — fetches a Firebase Storage file on behalf
 * of the client so that CORS never blocks the download.
 *
 * Usage: GET /api/download-proxy?url=<encoded url>&filename=<encoded filename>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileUrl = searchParams.get('url');
  const filename = searchParams.get('filename') || 'download.pdf';

  if (!fileUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Only allow Firebase Storage URLs to prevent open-proxy abuse
  const allowedHosts = ['firebasestorage.googleapis.com', 'storage.googleapis.com'];
  try {
    const parsed = new URL(fileUrl);
    if (!allowedHosts.some(h => parsed.hostname === h)) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch file' }, { status: response.status });
    }

    const blob = await response.blob();
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[download-proxy] Error:', err);
    return NextResponse.json({ error: 'Proxy fetch failed' }, { status: 500 });
  }
}
