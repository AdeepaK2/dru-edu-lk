'use client';


import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Book, Search, Filter, ShoppingCart, Star, Plus, Minus } from 'lucide-react';
import { PublicationDisplayData, PUBLICATION_CATEGORIES } from '../../models/publicationSchema';
import { usePublicationCart } from '../../hooks/usePublicationCart';
import Navbar from '@/components/Navbar';
import Footer from "@/components/ui/Footer"

const BooksPage = () => {
  const [publications, setPublications] = useState<PublicationDisplayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCart, setShowCart] = useState(false);
  
  // Cart functionality
  const {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartItem,
    isInCart,
    getCartTotals
  } = usePublicationCart();

  useEffect(() => {
    const loadPublications = async () => {
      try {
        setLoading(true);
        // Use the API route to get active publications (no direct Firebase access)
        const response = await fetch('/api/publications/public', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          console.log('Publications loaded successfully:', data.count);
          setPublications(data.publications);
        } else {
          throw new Error(data.error || 'Failed to load publications');
        }
      } catch (error) {
        console.error('Error loading publications:', error);
        
        // Show more detailed error information
        if (error instanceof Error) {
          console.error('Error details:', error.message);
        }
        
        // Fallback to empty array if API fails
        setPublications([]);
      } finally {
        setLoading(false);
      }
    };

    loadPublications();
  }, []);

  const filteredPublications = publications.filter(pub => {
    const matchesSearch = !searchTerm || 
      pub.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pub.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pub.subject && pub.subject.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = !categoryFilter || pub.category === categoryFilter;
    const isActive = pub.isActive;
    return matchesSearch && matchesCategory && isActive;
  });

  const featuredPublications = filteredPublications.filter(pub => pub.isFeatured);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-lg">Loading publications...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#01143d] via-[#0a2147] to-[#0088e0] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-30">
        <div className="w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>

      {/* Navigation */}
      <Navbar />

      {/* Header */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="mb-8">
            <span className="inline-block bg-white/20 backdrop-blur-sm text-white px-6 py-2 rounded-full text-sm font-medium border border-white/30">
              📚 Educational Resources
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-8 leading-tight">
            Educational
            <span className="block bg-gradient-to-r from-[#0088e0] to-[#00b4d8] bg-clip-text text-transparent">
              Publications
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-4xl mx-auto leading-relaxed font-light">
            Quality learning materials and practice papers designed to help you excel in your studies
          </p>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search books, authors, subjects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-white/30 bg-white/10 backdrop-blur-sm text-white placeholder-white/70 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="pl-10 pr-8 py-3 border border-white/30 bg-white/10 backdrop-blur-sm text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="" className="text-gray-800">All Formats</option>
                {PUBLICATION_CATEGORIES.map((category: string) => (
                  <option key={category} value={category} className="text-gray-800">{category}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Publications Content */}
      <section className="py-16 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Featured Publications */}
          {featuredPublications.length > 0 && (
            <div className="mb-16">
              <div className="text-center mb-12">
                <div className="inline-block bg-gradient-to-r from-[#01143d] to-[#0088e0] bg-clip-text text-transparent text-sm font-semibold uppercase tracking-wider mb-4">
                  Featured Books
                </div>
                <h2 className="text-4xl font-bold text-[#01143d] mb-4 flex items-center justify-center gap-3">
                  <Star className="text-yellow-500" />
                  Featured Publications
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {featuredPublications.map((publication) => (
                  <PublicationCard 
                    key={publication.id} 
                    publication={publication} 
                    featured 
                    onAddToCart={addToCart}
                    cartItem={getCartItem(publication.publicationId)}
                    onUpdateQuantity={updateQuantity}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Publications */}
          <div>
            <div className="text-center mb-12">
              <div className="inline-block bg-gradient-to-r from-[#01143d] to-[#0088e0] bg-clip-text text-transparent text-sm font-semibold uppercase tracking-wider mb-4">
                Our Collection
              </div>
              <h2 className="text-4xl font-bold text-[#01143d] mb-4">
                All Publications ({filteredPublications.length})
              </h2>
              <p className="text-xl text-gray-600 leading-relaxed">Comprehensive learning resources for academic excellence</p>
            </div>
            
            {filteredPublications.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredPublications.map((publication) => (
                  <PublicationCard 
                    key={publication.id} 
                    publication={publication} 
                    onAddToCart={addToCart}
                    cartItem={getCartItem(publication.publicationId)}
                    onUpdateQuantity={updateQuantity}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Book size={48} className="mx-auto mb-4 text-gray-300" />
                <p>No publications found matching your criteria</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Floating Cart Button */}
      {getCartTotals().totalItems > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-6 right-6 bg-[#0088e0] hover:bg-[#0066b3] text-white p-4 rounded-full shadow-lg transition-all duration-300 z-40 flex items-center gap-2"
        >
          <ShoppingCart size={24} />
          <span className="bg-red-500 text-white text-sm rounded-full w-6 h-6 flex items-center justify-center">
            {getCartTotals().totalItems}
          </span>
        </button>
      )}

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transform transition-transform duration-300">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Shopping Cart</h2>
                <button
                  onClick={() => setShowCart(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {cartItems.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.publicationId} className="flex gap-4 p-4 border rounded-lg">
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
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.publicationId, item.quantity - 1)}
                              className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-sm">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.publicationId, item.quantity + 1)}
                              className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">${(item.price * item.quantity).toFixed(2)}</div>
                            {item.shipping > 0 && (
                              <div className="text-xs text-gray-500">+${(item.shipping * item.quantity).toFixed(2)} shipping</div>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.publicationId)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {cartItems.length > 0 && (
              <div className="border-t p-6">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${getCartTotals().subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping:</span>
                    <span>${getCartTotals().totalShipping.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>${getCartTotals().totalAmount.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Link
                    href="/books/checkout"
                    onClick={() => setShowCart(false)}
                    className="block w-full bg-[#0088e0] hover:bg-[#0066b3] text-white py-3 rounded-lg font-semibold transition-colors text-center"
                  >
                    Proceed to Checkout
                  </Link>
                  <button
                    onClick={clearCart}
                    className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Clear Cart
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface PublicationCardProps {
  publication: PublicationDisplayData;
  featured?: boolean;
  onAddToCart: (publication: PublicationDisplayData, quantity: number) => void;
  cartItem?: { quantity: number };
  onUpdateQuantity: (publicationId: string, quantity: number) => void;
}

const PublicationCard: React.FC<PublicationCardProps> = ({ 
  publication, 
  featured = false, 
  onAddToCart, 
  cartItem, 
  onUpdateQuantity 
}) => {
  const totalPrice = publication.price + (publication.shipping || 0);

  return (
    <div className={`group bg-white rounded-2xl border border-gray-100 hover:border-[#0088e0]/30 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 p-6 ${
      featured ? 'ring-2 ring-yellow-400 bg-gradient-to-br from-white to-yellow-50/50' : 'bg-gradient-to-br from-white to-gray-50/50'
    }`}>
      {featured && (
        <div className="flex items-center gap-1 text-yellow-600 mb-3">
          <Star size={16} fill="currentColor" />
          <span className="text-sm font-medium">Featured</span>
        </div>
      )}
      
      {/* Book Cover Image */}
      {publication.coverImage && (
        <div className="mb-4">
          <img 
            src={publication.coverImage} 
            alt={publication.title}
            className="w-full h-48 object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/images/placeholder-thumbnail.svg';
            }}
          />
        </div>
      )}
      
      <div className="mb-4">
        <h3 className="font-bold text-xl text-[#01143d] mb-2 leading-tight group-hover:text-[#0088e0] transition-colors">
          {publication.title}
        </h3>
        {publication.subtitle && (
          <p className="text-gray-600 text-sm mb-3">{publication.subtitle}</p>
        )}
      </div>

      <div className="space-y-2 text-sm text-gray-600 mb-4">
        <div className="flex justify-between">
          <span className="font-medium">Author:</span>
          <span>{publication.author}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Type:</span>
          <span>{publication.type}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Format:</span>
          <span>{publication.category}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Pages:</span>
          <span>{publication.pages}</span>
        </div>
        {publication.subject && (
          <div className="flex justify-between">
            <span className="font-medium">Subject:</span>
            <span>{publication.subject}</span>
          </div>
        )}
        {publication.grade && (
          <div className="flex justify-between">
            <span className="font-medium">Grade:</span>
            <span>{publication.grade}</span>
          </div>
        )}
      </div>

      {publication.features && publication.features.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Features:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            {publication.features.slice(0, 3).map((feature, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-2xl font-bold text-green-600">
              ${publication.price.toFixed(2)}
            </div>
            {(publication.shipping && publication.shipping > 0) && (
              <div className="text-sm text-gray-500">
                Shipping: ${publication.shipping.toFixed(2)}
              </div>
            )}
            <div className="text-sm font-medium text-gray-700">
              Total: ${totalPrice.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {!cartItem ? (
            <button
              onClick={() => onAddToCart(publication, 1)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#0088e0] to-[#00b4d8] hover:from-[#0066b3] hover:to-[#0088e0] text-white font-semibold py-3 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-[#0088e0]/25"
            >
              <ShoppingCart size={20} />
              Add to Cart
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUpdateQuantity(publication.publicationId, cartItem.quantity - 1)}
                className="flex-1 flex items-center justify-center gap-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg transition-colors"
              >
                <Minus size={16} />
              </button>
              <div className="flex-1 text-center py-2 bg-gray-100 rounded-lg">
                {cartItem.quantity} in cart
              </div>
              <button
                onClick={() => onUpdateQuantity(publication.publicationId, cartItem.quantity + 1)}
                className="flex-1 flex items-center justify-center gap-1 bg-[#0088e0] hover:bg-[#0066b3] text-white py-2 rounded-lg transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {publication.tags && publication.tags.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-2">
            {publication.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
      <Footer/>
    </div>
  );
};

export default BooksPage;
