'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShoppingCart, MapPin, Phone, Mail, User, Package, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePublicationCart } from '../../../hooks/usePublicationCart';
import { 
  CustomerInfo, 
  ShippingAddress, 
  validateOrderForm, 
  PICKUP_METHODS 
} from '../../../models/publicationOrderSchema';
import Navbar from '../../../components/Navbar';

const CheckoutPage = () => {
  const router = useRouter();
  const { cartItems, getCartTotals, clearCart, isLoading: cartLoading } = usePublicationCart();
  
  // Form state
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    phone: '',
    email: ''
  });
  
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    streetAddress: '',
    streetAddressLine2: '',
    city: '',
    postalCode: ''
  });
  
  const [pickupMethod, setPickupMethod] = useState<'delivery' | 'pickup' | ''>('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');

  // Redirect if cart is empty (but wait for cart to load first)
  useEffect(() => {
    if (!cartLoading && cartItems.length === 0) {
      console.log('Cart is empty, redirecting to books page...');
      router.push('/books');
    }
  }, [cartItems, cartLoading, router]);

  const totals = getCartTotals();
  
  // Debug cart state
  useEffect(() => {
    console.log('Checkout page - Cart loading:', cartLoading);
    console.log('Checkout page - Cart items:', cartItems);
    console.log('Checkout page - Cart length:', cartItems.length);
  }, [cartLoading, cartItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const formErrors = validateOrderForm(
      customerInfo,
      shippingAddress,
      pickupMethod,
      cartItems
    );
    
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }
    
    setIsSubmitting(true);
    setErrors({});
    
    try {
      // Prepare order data
      const orderData = {
        customerInfo,
        items: cartItems.map(item => ({
          publicationId: item.publicationId,
          title: item.title,
          author: item.author,
          price: item.price,
          shipping: item.shipping,
          quantity: item.quantity,
          coverImage: item.coverImage
        })),
        shippingAddress: pickupMethod === 'delivery' ? shippingAddress : {
          streetAddress: 'Pickup from store',
          city: 'Store Location',
          postalCode: '0000'
        },
        pickupMethod: pickupMethod as 'delivery' | 'pickup',
        additionalNotes
      };
      
      // Create order via API route (for unauthenticated users)
      const response = await fetch('/api/publications/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create order');
      }
      
      // Clear cart and show success
      clearCart();
      setOrderId(result.orderId);
      setShowSuccess(true);
      
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#01143d] via-[#0a2147] to-[#0088e0]">
        <Navbar />
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed Successfully!</h1>
              <p className="text-gray-600">Thank you for your order. We'll contact you soon to confirm the details.</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h2 className="font-semibold text-gray-900 mb-2">Order Details</h2>
              <p className="text-sm text-gray-600 mb-1">Order ID: <span className="font-mono">{orderId}</span></p>
              <p className="text-sm text-gray-600 mb-1">Total Amount: <span className="font-semibold">${totals.totalAmount.toFixed(2)}</span></p>
              <p className="text-sm text-gray-600">Delivery Method: <span className="capitalize">{pickupMethod}</span></p>
            </div>
            
            <div className="space-y-3">
              <Link 
                href="/books"
                className="block w-full bg-[#0088e0] hover:bg-[#0066b3] text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Continue Shopping
              </Link>
              <Link
                href="/"
                className="block w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading while cart is loading
  if (cartLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-96">
          <div className="text-lg">Loading checkout...</div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            href="/books"
            className="inline-flex items-center gap-2 text-[#0088e0] hover:text-[#0066b3] transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Books
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Form */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Information */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User size={20} />
                  Customer Information
                </h2>
                
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter your full name"
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter your phone number"
                    />
                    {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={customerInfo.email}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter your email address"
                    />
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                  </div>
                </div>
              </div>

              {/* Pickup Method */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package size={20} />
                  How would you like to pick up the Books? *
                </h2>
                
                <div className="space-y-3">
                  {PICKUP_METHODS.map((method) => (
                    <label key={method.value} className="flex items-center">
                      <input
                        type="radio"
                        name="pickupMethod"
                        value={method.value}
                        checked={pickupMethod === method.value}
                        onChange={(e) => setPickupMethod(e.target.value as 'delivery' | 'pickup')}
                        className="mr-3"
                      />
                      <span className="text-gray-700">{method.label}</span>
                    </label>
                  ))}
                </div>
                {errors.pickupMethod && <p className="text-red-500 text-sm mt-1">{errors.pickupMethod}</p>}
              </div>

              {/* Shipping Address (only for delivery) */}
              {pickupMethod === 'delivery' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin size={20} />
                    Shipping Address
                  </h2>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        value={shippingAddress.streetAddress}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, streetAddress: e.target.value }))}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.streetAddress ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Enter your street address"
                      />
                      {errors.streetAddress && <p className="text-red-500 text-sm mt-1">{errors.streetAddress}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address Line 2
                      </label>
                      <input
                        type="text"
                        value={shippingAddress.streetAddressLine2}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, streetAddressLine2: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Apartment, suite, etc. (optional)"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          City *
                        </label>
                        <input
                          type="text"
                          value={shippingAddress.city}
                          onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            errors.city ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Enter your city"
                        />
                        {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Postal Code *
                        </label>
                        <input
                          type="text"
                          value={shippingAddress.postalCode}
                          onChange={(e) => setShippingAddress(prev => ({ ...prev, postalCode: e.target.value }))}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            errors.postalCode ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Enter postal code"
                        />
                        {errors.postalCode && <p className="text-red-500 text-sm mt-1">{errors.postalCode}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes
                </label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="If you have any additional notes about this order, please write here..."
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#0088e0] hover:bg-[#0066b3] disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Placing Order...
                  </>
                ) : (
                  <>
                    <CreditCard size={20} />
                    Place Order
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-lg shadow-md p-6 h-fit">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ShoppingCart size={20} />
              Order Summary
            </h2>
            
            <div className="space-y-4 mb-6">
              {cartItems.map((item) => (
                <div key={item.publicationId} className="flex gap-4">
                  {item.coverImage && (
                    <img 
                      src={item.coverImage} 
                      alt={item.title}
                      className="w-16 h-20 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">{item.title}</h3>
                    <p className="text-gray-600 text-xs">{item.author}</p>
                    <div className="flex justify-between mt-2">
                      <span className="text-sm">Qty: {item.quantity}</span>
                      <div className="text-right">
                        <div className="text-sm font-medium">${(item.price * item.quantity).toFixed(2)}</div>
                        {item.shipping > 0 && (
                          <div className="text-xs text-gray-500">+${(item.shipping * item.quantity).toFixed(2)} shipping</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping:</span>
                <span>${totals.totalShipping.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>${totals.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
