import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where, 
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { 
  PublicationOrder, 
  CreatePublicationOrder, 
  generateOrderId, 
  calculateOrderTotals 
} from '@/models/publicationOrderSchema';

const ORDERS_COLLECTION = 'publicationOrders';

export class PublicationOrderService {
  /**
   * Create a new publication order (for unauthenticated users)
   * @param orderData Order data from the form
   * @returns Promise resolving to the created order ID
   */
  static async createOrder(orderData: CreatePublicationOrder): Promise<string> {
    try {
      console.log('📝 Creating new publication order...');
      
      // Calculate totals
      const { subtotal, totalShipping, totalAmount } = calculateOrderTotals(orderData.items);
      
      // Generate order ID
      const orderId = generateOrderId();
      
      // Create full order object
      const order: Omit<PublicationOrder, 'id'> = {
        orderId,
        customerInfo: orderData.customerInfo,
        items: orderData.items,
        shippingAddress: orderData.shippingAddress,
        pickupMethod: orderData.pickupMethod,
        additionalNotes: orderData.additionalNotes,
        subtotal,
        totalShipping,
        totalAmount,
        status: 'pending',
        orderDate: new Date(),
        paymentStatus: 'pending',
        paymentMethod: 'cash_on_delivery' // Default for now
      };
      
      // Add to Firestore
      const docRef = await addDoc(collection(firestore, ORDERS_COLLECTION), {
        ...order,
        orderDate: Timestamp.fromDate(order.orderDate)
      });
      
      console.log('✅ Order created successfully:', docRef.id);
      return docRef.id;
      
    } catch (error) {
      console.error('❌ Error creating order:', error);
      throw new Error(`Failed to create order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all orders (admin only)
   * @returns Promise resolving to array of orders
   */
  static async getAllOrders(): Promise<(PublicationOrder & { id: string })[]> {
    try {
      console.log('📋 Fetching all publication orders...');
      
      const q = query(
        collection(firestore, ORDERS_COLLECTION),
        orderBy('orderDate', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const orders: (PublicationOrder & { id: string })[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        orders.push({
          id: doc.id,
          ...data,
          orderDate: data.orderDate?.toDate() || new Date(),
          estimatedDelivery: data.estimatedDelivery?.toDate(),
          processedAt: data.processedAt?.toDate()
        } as PublicationOrder & { id: string });
      });
      
      console.log(`✅ Retrieved ${orders.length} orders`);
      return orders;
      
    } catch (error) {
      console.error('❌ Error fetching orders:', error);
      throw new Error(`Failed to fetch orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get order by ID
   * @param orderId The order document ID
   * @returns Promise resolving to the order or null
   */
  static async getOrderById(orderId: string): Promise<(PublicationOrder & { id: string }) | null> {
    try {
      console.log('🔍 Fetching order by ID:', orderId);
      
      const docRef = doc(firestore, ORDERS_COLLECTION, orderId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const order = {
          id: docSnap.id,
          ...data,
          orderDate: data.orderDate?.toDate() || new Date(),
          estimatedDelivery: data.estimatedDelivery?.toDate(),
          processedAt: data.processedAt?.toDate()
        } as PublicationOrder & { id: string };
        
        console.log('✅ Order found');
        return order;
      } else {
        console.log('❌ Order not found');
        return null;
      }
      
    } catch (error) {
      console.error('❌ Error fetching order:', error);
      throw new Error(`Failed to fetch order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get order by order ID (customer-facing ID)
   * @param orderId The customer-facing order ID (e.g., ORD-123456)
   * @returns Promise resolving to the order or null
   */
  static async getOrderByOrderId(orderId: string): Promise<(PublicationOrder & { id: string }) | null> {
    try {
      console.log('🔍 Fetching order by order ID:', orderId);
      
      const q = query(
        collection(firestore, ORDERS_COLLECTION),
        where('orderId', '==', orderId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        const order = {
          id: doc.id,
          ...data,
          orderDate: data.orderDate?.toDate() || new Date(),
          estimatedDelivery: data.estimatedDelivery?.toDate(),
          processedAt: data.processedAt?.toDate()
        } as PublicationOrder & { id: string };
        
        console.log('✅ Order found');
        return order;
      } else {
        console.log('❌ Order not found');
        return null;
      }
      
    } catch (error) {
      console.error('❌ Error fetching order:', error);
      throw new Error(`Failed to fetch order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update order status (admin only)
   * @param orderId The order document ID
   * @param status New status
   * @param adminNotes Optional admin notes
   * @param processedBy Admin who processed the order
   * @returns Promise that resolves when update is complete
   */
  static async updateOrderStatus(
    orderId: string, 
    status: PublicationOrder['status'],
    adminNotes?: string,
    processedBy?: string
  ): Promise<void> {
    try {
      console.log('📝 Updating order status:', orderId, status);
      
      const docRef = doc(firestore, ORDERS_COLLECTION, orderId);
      const updateData: any = {
        status,
        processedAt: Timestamp.fromDate(new Date())
      };
      
      if (adminNotes) {
        updateData.adminNotes = adminNotes;
      }
      
      if (processedBy) {
        updateData.processedBy = processedBy;
      }
      
      await updateDoc(docRef, updateData);
      
      console.log('✅ Order status updated successfully');
      
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      throw new Error(`Failed to update order status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update order tracking information
   * @param orderId The order document ID
   * @param trackingNumber Tracking number
   * @param estimatedDelivery Estimated delivery date
   * @returns Promise that resolves when update is complete
   */
  static async updateOrderTracking(
    orderId: string,
    trackingNumber: string,
    estimatedDelivery?: Date
  ): Promise<void> {
    try {
      console.log('📦 Updating order tracking:', orderId);
      
      const docRef = doc(firestore, ORDERS_COLLECTION, orderId);
      const updateData: any = {
        trackingNumber,
        status: 'shipped'
      };
      
      if (estimatedDelivery) {
        updateData.estimatedDelivery = Timestamp.fromDate(estimatedDelivery);
      }
      
      await updateDoc(docRef, updateData);
      
      console.log('✅ Order tracking updated successfully');
      
    } catch (error) {
      console.error('❌ Error updating order tracking:', error);
      throw new Error(`Failed to update order tracking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete an order (admin only)
   * @param orderId The order document ID
   * @returns Promise that resolves when deletion is complete
   */
  static async deleteOrder(orderId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting order:', orderId);
      
      const docRef = doc(firestore, ORDERS_COLLECTION, orderId);
      await deleteDoc(docRef);
      
      console.log('✅ Order deleted successfully');
      
    } catch (error) {
      console.error('❌ Error deleting order:', error);
      throw new Error(`Failed to delete order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get orders by status (admin only)
   * @param status Order status to filter by
   * @returns Promise resolving to array of orders
   */
  static async getOrdersByStatus(status: PublicationOrder['status']): Promise<(PublicationOrder & { id: string })[]> {
    try {
      console.log('📋 Fetching orders by status:', status);
      
      const q = query(
        collection(firestore, ORDERS_COLLECTION),
        where('status', '==', status),
        orderBy('orderDate', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const orders: (PublicationOrder & { id: string })[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        orders.push({
          id: doc.id,
          ...data,
          orderDate: data.orderDate?.toDate() || new Date(),
          estimatedDelivery: data.estimatedDelivery?.toDate(),
          processedAt: data.processedAt?.toDate()
        } as PublicationOrder & { id: string });
      });
      
      console.log(`✅ Retrieved ${orders.length} orders with status: ${status}`);
      return orders;
      
    } catch (error) {
      console.error('❌ Error fetching orders by status:', error);
      throw new Error(`Failed to fetch orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get orders by customer email (for customer support)
   * @param email Customer email
   * @returns Promise resolving to array of orders
   */
  static async getOrdersByEmail(email: string): Promise<(PublicationOrder & { id: string })[]> {
    try {
      console.log('📋 Fetching orders by email:', email);
      
      const q = query(
        collection(firestore, ORDERS_COLLECTION),
        where('customerInfo.email', '==', email),
        orderBy('orderDate', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const orders: (PublicationOrder & { id: string })[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        orders.push({
          id: doc.id,
          ...data,
          orderDate: data.orderDate?.toDate() || new Date(),
          estimatedDelivery: data.estimatedDelivery?.toDate(),
          processedAt: data.processedAt?.toDate()
        } as PublicationOrder & { id: string });
      });
      
      console.log(`✅ Retrieved ${orders.length} orders for email: ${email}`);
      return orders;
      
    } catch (error) {
      console.error('❌ Error fetching orders by email:', error);
      throw new Error(`Failed to fetch orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
