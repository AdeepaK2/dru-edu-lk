import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdmin } from '@/utils/firebase-server';

const db = firebaseAdmin.db;

// Update order status (admin only)
export async function PUT(request: NextRequest) {
  try {
    console.log('🔄 Updating order status...');
    
    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json(
        { success: false, error: 'Order ID and status are required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Update the order document
    const orderRef = db.collection('publicationOrders').doc(orderId);
    const updateData = {
      status,
      updatedAt: new Date()
    };

    await orderRef.update(updateData);

    console.log(`✅ Order ${orderId} status updated to: ${status}`);

    return NextResponse.json({
      success: true,
      message: 'Order status updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating order status:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update order status', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
