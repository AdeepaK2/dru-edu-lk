import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pdfUrl = searchParams.get('url');
    const filename = searchParams.get('filename') || 'download.pdf';

    if (!pdfUrl) {
      return NextResponse.json({ error: 'PDF URL is required' }, { status: 400 });
    }

    console.log('🔽 API: Fetching PDF from:', pdfUrl);

    // Fetch the PDF file
    const response = await fetch(pdfUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error('❌ API: Failed to fetch PDF:', response.status, response.statusText);
      return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: response.status });
    }

    const pdfBuffer = await response.arrayBuffer();
    const headers = new Headers();
    
    // Force download with proper headers
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Content-Length', pdfBuffer.byteLength.toString());
    headers.set('Cache-Control', 'no-cache');

    console.log('✅ API: PDF fetched successfully, size:', pdfBuffer.byteLength);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('❌ API: Error downloading PDF:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}