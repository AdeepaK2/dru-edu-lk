import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (if not already initialized)
if (!getApps().length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const db = getFirestore();

// Get all orders (admin only)
export async function GET(request: NextRequest) {
  try {
    console.log('📋 Fetching all publication orders for admin...');

    // Get all orders from Firestore, ordered by creation date (newest first)
    const ordersRef = db.collection('publicationOrders');
    const snapshot = await ordersRef.orderBy('orderDate', 'desc').get();

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        orders: [],
        count: 0
      });
    }

    // Convert Firestore documents to order objects
    const orders = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        orderDate: data.orderDate?.toDate?.() || new Date(data.orderDate)
      };
    });

    console.log(`✅ Retrieved ${orders.length} orders for admin`);

    return NextResponse.json({
      success: true,
      orders,
      count: orders.length
    });

  } catch (error) {
    console.error('❌ Error fetching orders for admin:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch orders', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
