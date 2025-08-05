'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { 
  Plus,
  Trash2,
  Edit,
  Book,
  Save,
  X,
  Upload,
  Search,
  Filter,
  Star,
  Eye,
  EyeOff,
  Copy,
  Check,
  Image as ImageIcon,
  Loader,
  BookOpen,
  ShoppingCart,
  Package,
  Clock,
  Truck,
  MapPin,
  User,
  Mail,
  Phone,
  CheckCircle,
  AlertCircle,
  XCircle,
  ExternalLink
} from 'lucide-react';
import { PublicationFirestoreService } from '@/apiservices/publicationFirestoreService';
import { usePublicationImageUpload } from '@/hooks/usePublicationImageUpload';
import { 
  Publication, 
  PublicationDisplayData,
  publicationSchema,
  PUBLICATION_CATEGORIES,
  PUBLICATION_TYPES,
  createPublicationId
} from '@/models/publicationSchema';
import { PublicationOrder, ORDER_STATUS_LABELS } from '@/models/publicationOrderSchema';

type OrderWithId = PublicationOrder & { id: string };

// Helper functions for contact actions
const openEmail = (email: string, orderData: OrderWithId) => {
  const subject = encodeURIComponent(`Order ${orderData.orderId} - Status Update`);
  const body = encodeURIComponent(`Dear ${orderData.customerInfo.name},

Thank you for your order (${orderData.orderId}). 

Order Details:
- Items: ${orderData.items.map(item => `${item.title} (Qty: ${item.quantity})`).join(', ')}
- Total Amount: $${orderData.totalAmount.toFixed(2)}
- Current Status: ${ORDER_STATUS_LABELS[orderData.status]}

Best regards,
Dru-Edu Team`);
  
  window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
};

const openPhone = (phone: string) => {
  window.open(`tel:${phone}`, '_blank');
};

export default function AdminBooksPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'publications' | 'orders'>('publications');

  // Publications state
  const [publications, setPublications] = useState<PublicationDisplayData[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPublication, setEditingPublication] = useState<PublicationDisplayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<OrderWithId[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithId | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<Partial<Publication>>({
    title: '',
    subtitle: '',
    author: '',
    description: '',
    price: 0,
    shipping: 0,
    type: 'Book',
    pages: 0,
    category: PUBLICATION_CATEGORIES[0],
    subject: '',
    grade: '',
    coverImage: '',
    images: [],
    isActive: true,
    isFeatured: false,
    tags: [],
    features: [],
    language: 'English'
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Image upload functionality
  const { 
    uploadImage, 
    isUploading, 
    progress, 
    error: uploadError,
    resetState: resetUploadState,
    validateFile,
    createPreviewUrl,
    revokePreviewUrl 
  } = usePublicationImageUpload();
  
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string>('');
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);

  const loadPublications = async () => {
    try {
      setIsLoading(true);
      const publicationsData = await PublicationFirestoreService.getAllPublications();
      setPublications(publicationsData);
    } catch (error) {
      console.error('Error loading publications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPublications();
    if (activeTab === 'orders') {
      loadOrders();
    }
  }, [activeTab]);

  // Load orders function
  const loadOrders = async () => {
    try {
      setOrdersLoading(true);
      const response = await fetch('/api/admin/orders', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setOrders(data.orders);
        }
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  };

  // Update order status
  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const response = await fetch('/api/admin/orders/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId, status }),
      });
      
      if (response.ok) {
        await loadOrders();
        // Update the selected order if it's currently being viewed
        if (selectedOrder && selectedOrder.id === orderId) {
          const updatedOrder = orders.find(order => order.id === orderId);
          if (updatedOrder) {
            setSelectedOrder({ ...updatedOrder, status: status as any });
          }
        }
      } else {
        console.error('Failed to update order status');
        alert('Failed to update order status. Please try again.');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Error updating order status. Please try again.');
    }
  };

  // Handle viewing order details
  const handleViewOrderDetails = (order: OrderWithId) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.title?.trim()) errors.title = 'Title is required';
    if (!formData.author?.trim()) errors.author = 'Author is required';
    if (!formData.description?.trim()) errors.description = 'Description is required';
    if (!formData.price || formData.price <= 0) errors.price = 'Price must be greater than 0';
    if (!formData.pages || formData.pages <= 0) errors.pages = 'Pages must be greater than 0';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      title: '',
      subtitle: '',
      author: '',
      description: '',
      price: 0,
      shipping: 0,
      type: 'Book',
      pages: 0,
      category: PUBLICATION_CATEGORIES[0],
      subject: '',
      grade: '',
      coverImage: '',
      images: [],
      isActive: true,
      isFeatured: false,
      tags: [],
      features: [],
      language: 'English'
    });
    setFormErrors({});
    setShowAddForm(false);
    setEditingPublication(null);
    
    // Reset image upload state
    setCoverImageFile(null);
    if (coverImagePreview) {
      revokePreviewUrl(coverImagePreview);
      setCoverImagePreview('');
    }
    setGalleryFiles([]);
    galleryPreviews.forEach(url => revokePreviewUrl(url));
    setGalleryPreviews([]);
    resetUploadState();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      let updatedFormData = { ...formData };
      
      // Generate publication ID for new publications
      const publicationId = editingPublication ? editingPublication.publicationId : createPublicationId();
      
      // Upload cover image if a new one is selected
      if (coverImageFile) {
        console.log('Uploading cover image...');
        const result = await uploadImage(coverImageFile, { 
          type: 'cover', 
          publicationId 
        });
        
        if (result.error) {
          alert(`Cover image upload failed: ${result.error}`);
          return;
        }
        
        updatedFormData.coverImage = result.imageUrl;
      }
      
      // Upload gallery images if any are selected
      if (galleryFiles.length > 0) {
        console.log('Uploading gallery images...');
        const galleryUrls: string[] = [...(updatedFormData.images || [])];
        
        for (const file of galleryFiles) {
          const result = await uploadImage(file, { 
            type: 'gallery', 
            publicationId 
          });
          
          if (result.error) {
            console.error(`Gallery image upload failed: ${result.error}`);
            // Continue with other images even if one fails
          } else {
            galleryUrls.push(result.imageUrl);
          }
        }
        
        updatedFormData.images = galleryUrls;
      }

      if (editingPublication) {
        // Update existing publication
        await PublicationFirestoreService.updatePublication(editingPublication.id, updatedFormData);
        console.log('Publication updated successfully');
      } else {
        // Create new publication
        await PublicationFirestoreService.createPublication(updatedFormData as Omit<Publication, 'publicationId' | 'createdAt' | 'updatedAt'>);
        console.log('Publication created successfully');
      }
      
      resetForm();
      await loadPublications();
    } catch (error) {
      console.error('Error saving publication:', error);
      alert(`Error saving publication: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleEdit = (publication: PublicationDisplayData) => {
    setFormData({
      title: publication.title,
      subtitle: publication.subtitle,
      author: publication.author,
      description: publication.description,
      price: publication.price,
      shipping: publication.shipping,
      type: publication.type,
      pages: publication.pages,
      category: publication.category,
      subject: publication.subject,
      grade: publication.grade,
      coverImage: publication.coverImage,
      images: publication.images,
      isActive: publication.isActive,
      isFeatured: publication.isFeatured,
      tags: publication.tags,
      features: publication.features,
      language: publication.language
    });
    setEditingPublication(publication);
    
    // Reset image upload state when editing
    setCoverImageFile(null);
    if (coverImagePreview) {
      revokePreviewUrl(coverImagePreview);
      setCoverImagePreview('');
    }
    setGalleryFiles([]);
    galleryPreviews.forEach(url => revokePreviewUrl(url));
    setGalleryPreviews([]);
    resetUploadState();
    
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this publication?')) return;
    
    try {
      await PublicationFirestoreService.deletePublication(id);
      console.log('Publication deleted successfully');
      await loadPublications();
    } catch (error) {
      console.error('Error deleting publication:', error);
    }
  };

  const handleToggleActive = async (publication: PublicationDisplayData) => {
    try {
      await PublicationFirestoreService.updatePublication(publication.id, {
        isActive: !publication.isActive
      });
      console.log('Publication status updated successfully');
      await loadPublications();
    } catch (error) {
      console.error('Error updating publication status:', error);
    }
  };

  const handleToggleFeatured = async (publication: PublicationDisplayData) => {
    try {
      await PublicationFirestoreService.updatePublication(publication.id, {
        isFeatured: !publication.isFeatured
      });
      console.log('Publication featured status updated successfully');
      await loadPublications();
    } catch (error) {
      console.error('Error updating publication featured status:', error);
    }
  };

  const handleArrayInput = (field: 'tags' | 'features', value: string) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item.length > 0);
    setFormData((prev: Partial<Publication>) => ({ ...prev, [field]: array }));
  };

  // Image upload handlers
  const handleCoverImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    // Clear previous preview
    if (coverImagePreview) {
      revokePreviewUrl(coverImagePreview);
    }

    setCoverImageFile(file);
    const previewUrl = createPreviewUrl(file);
    setCoverImagePreview(previewUrl);
  };

  const handleGalleryImagesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate all files
    const invalidFiles = files.filter(file => !validateFile(file).isValid);
    if (invalidFiles.length > 0) {
      alert(`Some files are invalid: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // Clear previous previews
    galleryPreviews.forEach(url => revokePreviewUrl(url));

    setGalleryFiles(files);
    const previews = files.map(file => createPreviewUrl(file));
    setGalleryPreviews(previews);
  };

  const removeCoverImage = () => {
    if (coverImagePreview) {
      revokePreviewUrl(coverImagePreview);
    }
    setCoverImageFile(null);
    setCoverImagePreview('');
    setFormData((prev: Partial<Publication>) => ({ ...prev, coverImage: '' }));
  };

  const removeGalleryImage = (index: number) => {
    const newFiles = galleryFiles.filter((_, i) => i !== index);
    const newPreviews = galleryPreviews.filter((_, i) => i !== index);
    
    // Revoke the URL for the removed image
    revokePreviewUrl(galleryPreviews[index]);
    
    setGalleryFiles(newFiles);
    setGalleryPreviews(newPreviews);
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !orderSearchTerm || 
      order.customerInfo.name.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
      order.customerInfo.email.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
      order.orderId.toLowerCase().includes(orderSearchTerm.toLowerCase());
    const matchesStatus = !statusFilter || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredPublications = publications.filter(pub => {
    const matchesSearch = !searchTerm || 
      pub.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pub.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pub.subject && pub.subject.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = !categoryFilter || pub.category === categoryFilter;
    const matchesActive = showInactive || pub.isActive;
    return matchesSearch && matchesCategory && matchesActive;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-lg">Loading publications...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Book className="text-blue-600" />
            Books Management
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Manage your educational publications and orders
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('publications')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'publications'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300'
            }`}
          >
            Publications
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'orders'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300'
            }`}
          >
            Orders
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'publications' && (
        <div>
          {/* Publications Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Publications</h2>
            <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
              <Plus size={20} />
              Add Publication
            </Button>
          </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search publications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Formats</option>
              {PUBLICATION_CATEGORIES.map((category: string) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showInactive"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="showInactive" className="text-gray-700 dark:text-gray-300">
              Show Inactive
            </label>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Publications</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{publications.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400">Active Publications</div>
          <div className="text-2xl font-bold text-green-600">{publications.filter(p => p.isActive).length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400">Featured Publications</div>
          <div className="text-2xl font-bold text-yellow-600">{publications.filter(p => p.isFeatured).length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-sm text-gray-600 dark:text-gray-400">Filtered Results</div>
          <div className="text-2xl font-bold text-blue-600">{filteredPublications.length}</div>
        </div>
      </div>

      {/* Publications List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Publications ({filteredPublications.length})
          </h2>
        </div>
        
        {filteredPublications.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Publication
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPublications.map((publication) => (
                  <tr key={publication.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {publication.coverImage && (
                          <img 
                            src={publication.coverImage} 
                            alt={publication.title}
                            className="w-12 h-16 object-cover rounded mr-4"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/images/placeholder-thumbnail.svg';
                            }}
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {publication.title}
                            </h3>
                            {publication.isFeatured && (
                              <Star className="text-yellow-500" size={16} fill="currentColor" />
                            )}
                          </div>
                          {publication.subtitle && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">{publication.subtitle}</p>
                          )}
                          <p className="text-sm text-gray-500 dark:text-gray-400">by {publication.author}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        <div>{publication.type} • {publication.pages} pages</div>
                        <div className="text-gray-500 dark:text-gray-400">{publication.category}</div>
                        {publication.subject && (
                          <div className="text-gray-500 dark:text-gray-400">{publication.subject}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        <div className="font-medium">${publication.price.toFixed(2)}</div>
                        {publication.shipping > 0 && (
                          <div className="text-gray-500 dark:text-gray-400">
                            +${publication.shipping.toFixed(2)} shipping
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          publication.isActive 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {publication.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {publication.isFeatured && (
                          <span className="inline-flex px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            Featured
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(publication)}
                          className={`p-2 rounded-lg ${
                            publication.isActive 
                              ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' 
                              : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          }`}
                          title={publication.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {publication.isActive ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                          onClick={() => handleToggleFeatured(publication)}
                          className={`p-2 rounded-lg ${
                            publication.isFeatured 
                              ? 'text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20' 
                              : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                          title={publication.isFeatured ? 'Unfeature' : 'Feature'}
                        >
                          <Star size={16} fill={publication.isFeatured ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          onClick={() => handleEdit(publication)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(publication.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <Book size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p>No publications found matching your criteria</p>
          </div>
        )}
      </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Publication Orders</h2>
          </div>

          {/* Order Search and Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search orders by customer name, email, or order ID..."
                  value={orderSearchTerm}
                  onChange={(e) => setOrderSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Order Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Orders</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{orders.length}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">Pending Orders</div>
              <div className="text-2xl font-bold text-yellow-600">{orders.filter(o => o.status === 'pending').length}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">Delivered Orders</div>
              <div className="text-2xl font-bold text-green-600">{orders.filter(o => o.status === 'delivered').length}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</div>
              <div className="text-2xl font-bold text-blue-600">
                ${orders.reduce((sum, order) => sum + order.totalAmount, 0).toFixed(2)}
              </div>
            </div>
          </div>

          {ordersLoading ? (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {order.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{order.customerInfo.email}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-300">{order.customerInfo.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {order.items.length} item(s)
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-300">
                          {order.items.map(item => item.title).join(', ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        ${order.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          order.status === 'delivered' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                            : order.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                            : order.status === 'cancelled'
                            ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100'
                        }`}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {new Date(order.orderDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewOrderDetails(order)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
                          >
                            <Eye size={14} className="mr-1" />
                            View
                          </button>
                          <button
                            onClick={() => openEmail(order.customerInfo.email, order)}
                            className="inline-flex items-center px-2 py-1 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800"
                            title="Send Email"
                          >
                            <Mail size={14} />
                          </button>
                          <button
                            onClick={() => openPhone(order.customerInfo.phone)}
                            className="inline-flex items-center px-2 py-1 border border-transparent text-sm font-medium rounded-md text-orange-700 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-200 dark:hover:bg-orange-800"
                            title="Call Customer"
                          >
                            <Phone size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <Package size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              {orderSearchTerm || statusFilter ? (
                <div>
                  <p className="text-lg font-medium mb-2">No orders match your search criteria</p>
                  <p>Try adjusting your search terms or filters</p>
                </div>
              ) : (
                <p>No orders found</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {editingPublication ? 'Edit Publication' : 'Add New Publication'}
                </h2>
                <button
                  onClick={resetForm}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => setFormData((prev: Partial<Publication>) => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter publication title"
                  />
                  {formErrors.title && <p className="text-red-500 text-sm mt-1">{formErrors.title}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Author *
                  </label>
                  <input
                    type="text"
                    value={formData.author || ''}
                    onChange={(e) => setFormData((prev: Partial<Publication>) => ({ ...prev, author: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter author name"
                  />
                  {formErrors.author && <p className="text-red-500 text-sm mt-1">{formErrors.author}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={formData.subtitle || ''}
                  onChange={(e) => setFormData((prev: Partial<Publication>) => ({ ...prev, subtitle: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter subtitle (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData((prev: Partial<Publication>) => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter publication description"
                />
                {formErrors.description && <p className="text-red-500 text-sm mt-1">{formErrors.description}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Price (AUD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price || ''}
                    onChange={(e) => setFormData((prev: Partial<Publication>) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                  {formErrors.price && <p className="text-red-500 text-sm mt-1">{formErrors.price}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Shipping (AUD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.shipping || ''}
                    onChange={(e) => setFormData((prev: Partial<Publication>) => ({ ...prev, shipping: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pages *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.pages || ''}
                    onChange={(e) => setFormData((prev: Partial<Publication>) => ({ ...prev, pages: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                  {formErrors.pages && <p className="text-red-500 text-sm mt-1">{formErrors.pages}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type
                  </label>
                  <select
                    value={formData.type || 'Book'}
                    onChange={(e) => setFormData((prev: Partial<Publication>) => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {PUBLICATION_TYPES.map((type: string) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Format Category
                  </label>
                  <select
                    value={formData.category || PUBLICATION_CATEGORIES[0]}
                    onChange={(e) => setFormData((prev: Partial<Publication>) => ({ ...prev, category: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {PUBLICATION_CATEGORIES.map((category: string) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select the format/delivery method for this publication
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={formData.subject || ''}
                    onChange={(e) => setFormData((prev: Partial<Publication>) => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Mathematics, English"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Grade
                  </label>
                  <input
                    type="text"
                    value={formData.grade || ''}
                    onChange={(e) => setFormData((prev: Partial<Publication>) => ({ ...prev, grade: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Year 12, Grade 10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cover Image
                </label>
                <div className="space-y-4">
                  {/* Current cover image or preview */}
                  {(coverImagePreview || formData.coverImage) && (
                    <div className="relative">
                      <img
                        src={coverImagePreview || formData.coverImage}
                        alt="Cover preview"
                        className="w-32 h-40 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                      />
                      <button
                        type="button"
                        onClick={removeCoverImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  
                  {/* Upload button */}
                  <div>
                    <input
                      type="file"
                      id="coverImage"
                      accept="image/*"
                      onChange={handleCoverImageSelect}
                      className="hidden"
                    />
                    <label
                      htmlFor="coverImage"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                    >
                      <Upload size={16} />
                      {coverImageFile || formData.coverImage ? 'Change Cover Image' : 'Upload Cover Image'}
                    </label>
                  </div>
                  
                  {/* Manual URL input */}
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Or enter image URL manually:
                    </label>
                    <input
                      type="url"
                      value={formData.coverImage || ''}
                      onChange={(e) => setFormData((prev: Partial<Publication>) => ({ ...prev, coverImage: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://example.com/cover-image.jpg"
                    />
                  </div>
                  
                  {/* Upload progress */}
                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-blue-600">
                        <Loader className="animate-spin" size={16} />
                        Uploading... {progress}%
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {uploadError && (
                    <p className="text-red-500 text-sm">{uploadError}</p>
                  )}
                </div>
              </div>

              {/* Gallery Images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gallery Images (Optional)
                </label>
                <div className="space-y-4">
                  {/* Current gallery images */}
                  {galleryPreviews.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {galleryPreviews.map((preview, index) => (
                        <div key={index} className="relative">
                          <img
                            src={preview}
                            alt={`Gallery preview ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                          />
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(index)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Upload button */}
                  <div>
                    <input
                      type="file"
                      id="galleryImages"
                      accept="image/*"
                      multiple
                      onChange={handleGalleryImagesSelect}
                      className="hidden"
                    />
                    <label
                      htmlFor="galleryImages"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      <ImageIcon size={16} />
                      Add Gallery Images
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Select multiple images to create a gallery
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.tags?.join(', ') || ''}
                  onChange={(e) => handleArrayInput('tags', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., VCE, Mathematics, Practice Papers"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Features (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.features?.join(', ') || ''}
                  onChange={(e) => handleArrayInput('features', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Detailed Solutions, Practice Tests, Study Notes"
                />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive || false}
                    onChange={(e) => setFormData((prev: Partial<Publication>) => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isActive" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Active
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isFeatured"
                    checked={formData.isFeatured || false}
                    onChange={(e) => setFormData((prev: Partial<Publication>) => ({ ...prev, isFeatured: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isFeatured" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Featured
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  onClick={resetForm}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <X size={16} />
                  Cancel
                </Button>
                <Button type="submit" className="flex items-center gap-2">
                  <Save size={16} />
                  {editingPublication ? 'Update Publication' : 'Create Publication'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Order Details - {selectedOrder.orderId}
                </h2>
                <button
                  onClick={() => setShowOrderDetails(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Order Status and Actions */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Order Status</h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEmail(selectedOrder.customerInfo.email, selectedOrder)}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                    >
                      <Mail size={16} className="mr-2" />
                      Send Email
                    </button>
                    <button
                      onClick={() => openPhone(selectedOrder.customerInfo.phone)}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700"
                    >
                      <Phone size={16} className="mr-2" />
                      Call Customer
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Current Status
                    </label>
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                      selectedOrder.status === 'delivered' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                        : selectedOrder.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                        : selectedOrder.status === 'cancelled'
                        ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100'
                    }`}>
                      {ORDER_STATUS_LABELS[selectedOrder.status]}
                    </span>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Update Status
                    </label>
                    <select
                      value={selectedOrder.status}
                      onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                      className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Payment Status
                    </label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedOrder.paymentStatus === 'paid' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                        : selectedOrder.paymentStatus === 'failed'
                        ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                    }`}>
                      {selectedOrder.paymentStatus}
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Order Date
                    </label>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {new Date(selectedOrder.orderDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <User size={20} className="mr-2" />
                    Customer Information
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Name:</span>
                      <span className="ml-2 text-sm text-gray-900 dark:text-white">{selectedOrder.customerInfo?.name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Email:</span>
                      <span className="ml-2 text-sm text-gray-900 dark:text-white">{selectedOrder.customerInfo?.email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Phone:</span>
                      <span className="ml-2 text-sm text-gray-900 dark:text-white">{selectedOrder.customerInfo?.phone || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <MapPin size={20} className="mr-2" />
                    {selectedOrder.pickupMethod === 'delivery' ? 'Delivery Address' : 'Pickup Method'}
                  </h3>
                  {selectedOrder.pickupMethod === 'delivery' ? (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {selectedOrder.shippingAddress.streetAddress}
                      </div>
                      {selectedOrder.shippingAddress.streetAddressLine2 && (
                        <div className="text-sm text-gray-900 dark:text-white">
                          {selectedOrder.shippingAddress.streetAddressLine2}
                        </div>
                      )}
                      <div className="text-sm text-gray-900 dark:text-white">
                        {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.postalCode}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-900 dark:text-white">
                      Customer will pick up from store
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Package size={20} className="mr-2" />
                  Order Items
                </h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3">
                      <div className="flex items-center">
                        {item.coverImage && (
                          <img 
                            src={item.coverImage} 
                            alt={item.title}
                            className="w-12 h-16 object-cover rounded mr-3"
                          />
                        )}
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">{item.title}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">by {item.author}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Quantity: {item.quantity}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          ${(item.price * item.quantity).toFixed(2)}
                        </div>
                        {item.shipping > 0 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            +${(item.shipping * item.quantity).toFixed(2)} shipping
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Order Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                    <span className="text-gray-900 dark:text-white">${selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Shipping:</span>
                    <span className="text-gray-900 dark:text-white">${selectedOrder.totalShipping.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-300 dark:border-gray-600 pt-2">
                    <div className="flex justify-between font-medium">
                      <span className="text-gray-900 dark:text-white">Total:</span>
                      <span className="text-gray-900 dark:text-white">${selectedOrder.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              {selectedOrder.additionalNotes && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Customer Notes</h3>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedOrder.additionalNotes}</p>
                </div>
              )}

              {/* Admin Notes */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Admin Notes</h3>
                <textarea
                  value={selectedOrder.adminNotes || ''}
                  onChange={(e) => setSelectedOrder({ ...selectedOrder, adminNotes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Add internal notes about this order..."
                />
              </div>

              {/* Tracking Information */}
              {selectedOrder.status === 'shipped' && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <Truck size={20} className="mr-2" />
                    Tracking Information
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Tracking Number
                      </label>
                      <input
                        type="text"
                        value={selectedOrder.trackingNumber || ''}
                        onChange={(e) => setSelectedOrder({ ...selectedOrder, trackingNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter tracking number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Estimated Delivery
                      </label>
                      <input
                        type="date"
                        value={selectedOrder.estimatedDelivery ? new Date(selectedOrder.estimatedDelivery).toISOString().split('T')[0] : ''}
                        onChange={(e) => setSelectedOrder({ ...selectedOrder, estimatedDelivery: e.target.value ? new Date(e.target.value) : undefined })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-end">
                <Button
                  onClick={() => setShowOrderDetails(false)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <X size={16} />
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
