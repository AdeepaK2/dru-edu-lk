import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore as db } from '@/utils/firebase-admin';

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
