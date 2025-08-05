import { NextRequest, NextResponse } from 'next/server';
import firebaseAdmin from '@/utils/firebase-server';
import { PublicationDisplayData } from '@/models/publicationSchema';

export async function GET(request: NextRequest) {
  try {
    console.log('API: Getting active publications for public access');
    
    // Use Firebase Admin query helper
    const publications = await firebaseAdmin.firestore.query<any>(
      'publications',
      'isActive',
      '==',
      true
    );
    
    // Transform to PublicationDisplayData format
    const transformedPublications: PublicationDisplayData[] = publications.map((pub) => ({
      id: pub.id,
      publicationId: pub.publicationId || pub.id,
      title: pub.title,
      subtitle: pub.subtitle || '',
      author: pub.author,
      description: pub.description || '',
      price: pub.price,
      currency: pub.currency || 'AUD',
      formattedPrice: `$${pub.price?.toFixed(2)}`,
      shipping: pub.shipping || 0,
      formattedShipping: pub.shipping ? `$${pub.shipping.toFixed(2)}` : '',
      type: pub.type,
      pages: pub.pages,
      category: pub.category,
      subject: pub.subject || '',
      grade: pub.grade || '',
      coverImage: pub.coverImage || '/images/placeholder-thumbnail.svg',
      images: pub.images || [],
      isActive: pub.isActive,
      isFeatured: pub.isFeatured || false,
      tags: pub.tags || [],
      features: pub.features || [],
      language: pub.language || 'English',
      sales: pub.sales || 0,
      views: pub.views || 0,
      rating: pub.rating || 0,
      ratingCount: pub.ratingCount || 0,
      createdAt: pub.createdAt || new Date().toISOString(),
      updatedAt: pub.updatedAt || new Date().toISOString()
    }));
    
    // Sort by createdAt desc (newest first)
    transformedPublications.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    console.log(`API: Successfully retrieved ${transformedPublications.length} active publications`);
    
    return NextResponse.json({ 
      success: true, 
      publications: transformedPublications,
      count: transformedPublications.length 
    });
  } catch (error) {
    console.error('API Error getting publications:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch publications',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
