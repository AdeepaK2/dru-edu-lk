// Publication Order Schema for unauthenticated users
export interface PublicationOrderItem {
  publicationId: string;
  title: string;
  author: string;
  price: number;
  shipping: number;
  quantity: number;
  coverImage?: string;
}

export interface ShippingAddress {
  streetAddress: string;
  streetAddressLine2?: string;
  city: string;
  postalCode: string;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
}

export interface PublicationOrder {
  orderId: string;
  customerInfo: CustomerInfo;
  items: PublicationOrderItem[];
  shippingAddress: ShippingAddress;
  pickupMethod: 'delivery' | 'pickup';
  additionalNotes?: string;
  
  // Order calculations
  subtotal: number;
  totalShipping: number;
  totalAmount: number;
  
  // Order status and metadata
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  orderDate: Date;
  estimatedDelivery?: Date;
  
  // Contact and tracking
  trackingNumber?: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  paymentMethod?: 'cash_on_delivery' | 'bank_transfer' | 'online_payment';
  
  // Admin fields
  adminNotes?: string;
  processedBy?: string;
  processedAt?: Date;
}

// For creating new orders (without generated fields)
export interface CreatePublicationOrder {
  customerInfo: CustomerInfo;
  items: PublicationOrderItem[];
  shippingAddress: ShippingAddress;
  pickupMethod: 'delivery' | 'pickup';
  additionalNotes?: string;
}

// Cart item for local storage
export interface CartItem {
  publicationId: string;
  title: string;
  author: string;
  price: number;
  shipping: number;
  quantity: number;
  coverImage?: string;
  addedAt: Date;
}

// Form validation errors
export interface OrderFormErrors {
  name?: string;
  phone?: string;
  email?: string;
  pickupMethod?: string;
  streetAddress?: string;
  city?: string;
  postalCode?: string;
  items?: string;
}

// Order status display
export const ORDER_STATUS_LABELS = {
  pending: 'Order Received',
  confirmed: 'Order Confirmed',
  processing: 'Being Prepared',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
} as const;

export const PICKUP_METHODS = [
  { value: 'delivery', label: 'Home Delivery' },
  { value: 'pickup', label: 'Pickup from Store' }
] as const;

// Utility functions
export const calculateOrderTotals = (items: PublicationOrderItem[]) => {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalShipping = items.reduce((sum, item) => sum + (item.shipping * item.quantity), 0);
  const totalAmount = subtotal + totalShipping;
  
  return { subtotal, totalShipping, totalAmount };
};

export const generateOrderId = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

export const validateOrderForm = (
  customerInfo: CustomerInfo,
  shippingAddress: ShippingAddress,
  pickupMethod: string,
  items: CartItem[]
): OrderFormErrors => {
  const errors: OrderFormErrors = {};

  // Customer info validation
  if (!customerInfo.name?.trim()) {
    errors.name = 'Name is required';
  }
  
  if (!customerInfo.phone?.trim()) {
    errors.phone = 'Phone number is required';
  } else if (!/^\+?[\d\s\-\(\)]+$/.test(customerInfo.phone)) {
    errors.phone = 'Please enter a valid phone number';
  }
  
  if (!customerInfo.email?.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
    errors.email = 'Please enter a valid email address';
  }

  // Pickup method validation
  if (!pickupMethod) {
    errors.pickupMethod = 'Please select how you would like to receive your books';
  }

  // Shipping address validation (only for delivery)
  if (pickupMethod === 'delivery') {
    if (!shippingAddress.streetAddress?.trim()) {
      errors.streetAddress = 'Street address is required for delivery';
    }
    
    if (!shippingAddress.city?.trim()) {
      errors.city = 'City is required for delivery';
    }
    
    if (!shippingAddress.postalCode?.trim()) {
      errors.postalCode = 'Postal code is required for delivery';
    }
  }

  // Items validation
  if (!items || items.length === 0) {
    errors.items = 'Please add at least one book to your cart';
  }

  return errors;
};
