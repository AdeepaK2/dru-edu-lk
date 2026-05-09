import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminFirestore as db } from '@/utils/firebase-admin';
import {
  CreatePublicationOrder,
  PublicationOrder,
  generateOrderId,
  calculateOrderTotals,
  validateOrderForm
} from '@/models/publicationOrderSchema';
import type { ServerMailDocument } from '@/types/api';

export async function POST(request: NextRequest) {
  try {
    console.log('📝 Processing publication order submission...');
    
    const body = await request.json();
    console.log('Order data received:', body);

    // Validate required fields
    if (!body.customerInfo || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: customerInfo and items are required' },
        { status: 400 }
      );
    }

    // Validate customer information and other fields using the existing validation function
    const validationErrors = validateOrderForm(
      body.customerInfo,
      body.shippingAddress || { streetAddress: '', city: '', postalCode: '', streetAddressLine2: '' },
      body.pickupMethod,
      body.items
    );
    
    const hasErrors = Object.keys(validationErrors).length > 0;
    if (hasErrors) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validationErrors },
        { status: 400 }
      );
    }

    // Validate pickup method
    if (!body.pickupMethod || !['delivery', 'pickup'].includes(body.pickupMethod)) {
      return NextResponse.json(
        { success: false, error: 'Invalid pickup method. Must be either "delivery" or "pickup"' },
        { status: 400 }
      );
    }

    // Generate unique order ID
    const orderId = generateOrderId();
    
    // Calculate order totals
    const { subtotal, totalShipping, totalAmount } = calculateOrderTotals(body.items);
    
    // Create order document
    const orderData: PublicationOrder = {
      orderId,
      customerInfo: {
        name: body.customerInfo.name.trim(),
        phone: body.customerInfo.phone.trim(),
        email: body.customerInfo.email.toLowerCase().trim()
      },
      items: body.items.map((item: any) => ({
        publicationId: item.publicationId,
        title: item.title,
        author: item.author,
        price: parseFloat(item.price),
        shipping: parseFloat(item.shipping || 0),
        quantity: parseInt(item.quantity),
        coverImage: item.coverImage || ''
      })),
      pickupMethod: body.pickupMethod,
      shippingAddress: body.pickupMethod === 'delivery' && body.shippingAddress ? {
        streetAddress: body.shippingAddress.streetAddress?.trim() || '',
        streetAddressLine2: body.shippingAddress.streetAddressLine2?.trim() || '',
        city: body.shippingAddress.city?.trim() || '',
        postalCode: body.shippingAddress.postalCode?.trim() || ''
      } : {
        streetAddress: '',
        streetAddressLine2: '',
        city: '',
        postalCode: ''
      },
      additionalNotes: body.additionalNotes?.trim() || '',
      subtotal,
      totalShipping,
      totalAmount,
      status: 'pending',
      paymentStatus: 'pending',
      orderDate: new Date()
    };

    console.log('Creating order with data:', orderData);

    // Save to Firestore using Admin SDK
    const docRef = await db.collection('publicationOrders').add({
      ...orderData,
      orderDate: new Date()
    });

    console.log('✅ Order created successfully with ID:', docRef.id);

    // Send confirmation email by creating mail document
    try {
      await createOrderConfirmationEmail(orderData);
      console.log('📧 Order confirmation email queued successfully');
    } catch (emailError) {
      console.warn('⚠️ Failed to queue confirmation email:', emailError);
      // Don't fail the order creation if email fails
    }

    return NextResponse.json({
      success: true,
      orderId: orderData.orderId,
      documentId: docRef.id,
      message: 'Order created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating publication order:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create order', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Get order by ID (for order tracking)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('orderId');
    const email = url.searchParams.get('email');

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Looking up order:', orderId);

    // Query by orderId field
    const ordersRef = db.collection('publicationOrders');
    const query = ordersRef.where('orderId', '==', orderId);
    const snapshot = await query.get();

    if (snapshot.empty) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const orderDoc = snapshot.docs[0];
    const orderData = orderDoc.data();

    // If email is provided, verify it matches
    if (email && orderData.customer?.email !== email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Order not found or email does not match' },
        { status: 404 }
      );
    }

    // Convert Firestore timestamps to dates
    const order = {
      id: orderDoc.id,
      ...orderData,
      orderDate: orderData.orderDate?.toDate?.() || orderData.orderDate
    };

    console.log('✅ Order found:', (order as any).orderId);

    return NextResponse.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('❌ Error retrieving order:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve order', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Create mail document for order confirmation
async function createOrderConfirmationEmail(order: PublicationOrder): Promise<void> {
  try {
    // Generate HTML email content
    const emailHtml = generateOrderConfirmationEmailHtml(order);
    
    // Create mail document
    const mailDoc: ServerMailDocument = {
      to: order.customerInfo.email,
      message: {
        subject: `Order Confirmation - ${order.orderId}`,
        html: emailHtml,
      },
      createdAt: Timestamp.now(),
      processed: false
    };

    // Save to mail collection
    await db.collection('mail').add(mailDoc);
    
    console.log('📧 Mail document created for order:', order.orderId);
  } catch (error) {
    console.error('❌ Error creating mail document:', error);
    throw error;
  }
}

// Generate HTML email template for order confirmation
function generateOrderConfirmationEmailHtml(order: PublicationOrder): string {
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <div style="display: flex; align-items: center;">
          ${item.coverImage ? `<img src="${item.coverImage}" alt="${item.title}" style="width: 50px; height: 60px; object-fit: cover; margin-right: 15px; border-radius: 4px;">` : ''}
          <div>
            <h4 style="margin: 0; color: #333; font-size: 14px;">${item.title}</h4>
            <p style="margin: 5px 0; color: #666; font-size: 12px;">by ${item.author}</p>
            <p style="margin: 5px 0; color: #666; font-size: 12px;">Quantity: ${item.quantity}</p>
          </div>
        </div>
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
        <div style="font-weight: bold; color: #333;">$${(item.price * item.quantity).toFixed(2)}</div>
        ${item.shipping > 0 ? `<div style="font-size: 12px; color: #666;">+$${(item.shipping * item.quantity).toFixed(2)} shipping</div>` : ''}
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #01143d, #0088e0); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">Order Confirmed!</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Thank you for your order, ${order.customerInfo.name}</p>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #ddd; border-top: none;">
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
          <h2 style="margin: 0 0 10px 0; color: #01143d; font-size: 18px;">Order Details</h2>
          <p style="margin: 5px 0; color: #666;"><strong>Order ID:</strong> ${order.orderId}</p>
          <p style="margin: 5px 0; color: #666;"><strong>Order Date:</strong> ${order.orderDate.toLocaleDateString()}</p>
          <p style="margin: 5px 0; color: #666;"><strong>Pickup Method:</strong> ${order.pickupMethod === 'delivery' ? 'Home Delivery' : 'Store Pickup'}</p>
          <p style="margin: 5px 0; color: #666;"><strong>Total Amount:</strong> $${order.totalAmount.toFixed(2)}</p>
        </div>

        ${order.pickupMethod === 'delivery' ? `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
          <h3 style="margin: 0 0 10px 0; color: #01143d; font-size: 16px;">Delivery Address</h3>
          <p style="margin: 5px 0; color: #666;">${order.shippingAddress.streetAddress}</p>
          ${order.shippingAddress.streetAddressLine2 ? `<p style="margin: 5px 0; color: #666;">${order.shippingAddress.streetAddressLine2}</p>` : ''}
          <p style="margin: 5px 0; color: #666;">${order.shippingAddress.city}, ${order.shippingAddress.postalCode}</p>
        </div>
        ` : ''}

        <div style="margin-bottom: 25px;">
          <h3 style="margin: 0 0 15px 0; color: #01143d; font-size: 16px;">Order Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${itemsHtml}
          </table>
        </div>

        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
          <h3 style="margin: 0 0 10px 0; color: #01143d; font-size: 16px;">Order Summary</h3>
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span>Subtotal:</span>
            <span>$${order.subtotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <span>Shipping:</span>
            <span>$${order.totalShipping.toFixed(2)}</span>
          </div>
          <hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; color: #01143d;">
            <span>Total:</span>
            <span>$${order.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        ${order.additionalNotes ? `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
          <h3 style="margin: 0 0 10px 0; color: #01143d; font-size: 16px;">Additional Notes</h3>
          <p style="margin: 0; color: #666;">${order.additionalNotes}</p>
        </div>
        ` : ''}

        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; color: #0088e0; font-size: 16px;">What's Next?</h3>
          <p style="margin: 5px 0; color: #666;">We'll review your order and contact you within 24 hours to confirm the details and arrange ${order.pickupMethod === 'delivery' ? 'delivery' : 'pickup'}.</p>
          <p style="margin: 5px 0; color: #666;">If you have any questions, please contact us at <a href="mailto:support@dru-edu.com" style="color: #0088e0;">support@dru-edu.com</a></p>
        </div>

        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="margin: 0; color: #666; font-size: 14px;">Thank you for choosing DRU Education!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
