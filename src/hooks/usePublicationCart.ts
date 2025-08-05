import { useState, useEffect } from 'react';
import { CartItem } from '@/models/publicationOrderSchema';
import { PublicationDisplayData } from '@/models/publicationSchema';

const CART_STORAGE_KEY = 'publication_cart';

/**
 * Custom hook for managing publication cart
 */
export const usePublicationCart = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        // Convert date strings back to Date objects
        const cartWithDates = parsedCart.map((item: any) => ({
          ...item,
          addedAt: new Date(item.addedAt)
        }));
        setCartItems(cartWithDates);
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save cart to localStorage whenever cart changes
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    }
  }, [cartItems, isLoading]);

  /**
   * Add a publication to the cart
   */
  const addToCart = (publication: PublicationDisplayData, quantity: number = 1) => {
    setCartItems(prev => {
      const existingItem = prev.find(item => item.publicationId === publication.publicationId);
      
      if (existingItem) {
        // Update quantity if item already exists
        return prev.map(item =>
          item.publicationId === publication.publicationId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        // Add new item
        const newItem: CartItem = {
          publicationId: publication.publicationId,
          title: publication.title,
          author: publication.author,
          price: publication.price,
          shipping: publication.shipping || 0,
          quantity,
          coverImage: publication.coverImage,
          addedAt: new Date()
        };
        return [...prev, newItem];
      }
    });
  };

  /**
   * Remove a publication from the cart
   */
  const removeFromCart = (publicationId: string) => {
    setCartItems(prev => prev.filter(item => item.publicationId !== publicationId));
  };

  /**
   * Update quantity of an item in cart
   */
  const updateQuantity = (publicationId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(publicationId);
      return;
    }

    setCartItems(prev =>
      prev.map(item =>
        item.publicationId === publicationId
          ? { ...item, quantity }
          : item
      )
    );
  };

  /**
   * Clear the entire cart
   */
  const clearCart = () => {
    setCartItems([]);
  };

  /**
   * Get cart item by publication ID
   */
  const getCartItem = (publicationId: string): CartItem | undefined => {
    return cartItems.find(item => item.publicationId === publicationId);
  };

  /**
   * Check if a publication is in the cart
   */
  const isInCart = (publicationId: string): boolean => {
    return cartItems.some(item => item.publicationId === publicationId);
  };

  /**
   * Calculate cart totals
   */
  const getCartTotals = () => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalShipping = cartItems.reduce((sum, item) => sum + (item.shipping * item.quantity), 0);
    const totalAmount = subtotal + totalShipping;
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      subtotal,
      totalShipping,
      totalAmount,
      totalItems
    };
  };

  return {
    cartItems,
    isLoading,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartItem,
    isInCart,
    getCartTotals
  };
};
