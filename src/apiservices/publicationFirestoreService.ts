import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { 
  Publication, 
  PublicationDisplayData,
  publicationSchema,
  createPublicationId
} from '@/models/publicationSchema';

// Collections
const PUBLICATIONS_COLLECTION = 'publications';

// Publication Service
export class PublicationFirestoreService {
  // Create a new publication
  static async createPublication(publicationData: Omit<Publication, 'publicationId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const publicationId = createPublicationId();
      const publication: Publication = {
        ...publicationData,
        publicationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate the data
      const validatedPublication = publicationSchema.parse(publication);
      
      const docRef = await addDoc(collection(firestore, PUBLICATIONS_COLLECTION), validatedPublication);
      console.log('Publication created with ID:', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating publication:', error);
      throw new Error(`Failed to create publication: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get all publications
  static async getAllPublications(): Promise<PublicationDisplayData[]> {
    try {
      const publicationsQuery = query(
        collection(firestore, PUBLICATIONS_COLLECTION),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(publicationsQuery);
      const publications: PublicationDisplayData[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        publications.push({
          id: doc.id,
          publicationId: data.publicationId || doc.id,
          title: data.title,
          subtitle: data.subtitle || '',
          author: data.author,
          description: data.description || '',
          price: data.price,
          currency: data.currency || 'AUD',
          formattedPrice: `$${data.price?.toFixed(2)}`,
          shipping: data.shipping || 0,
          formattedShipping: data.shipping ? `$${data.shipping.toFixed(2)}` : '',
          type: data.type,
          pages: data.pages,
          category: data.category,
          subject: data.subject || '',
          grade: data.grade || '',
          coverImage: data.coverImage || '/images/placeholder-thumbnail.svg',
          images: data.images || [],
          isActive: data.isActive,
          isFeatured: data.isFeatured || false,
          tags: data.tags || [],
          features: data.features || [],
          language: data.language || 'English',
          sales: data.sales || 0,
          views: data.views || 0,
          rating: data.rating || 0,
          ratingCount: data.ratingCount || 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
        });
      });
      
      return publications;
    } catch (error) {
      console.error('Error fetching publications:', error);
      throw new Error(`Failed to fetch publications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get active publications only
  static async getActivePublications(): Promise<PublicationDisplayData[]> {
    try {
      const publicationsQuery = query(
        collection(firestore, PUBLICATIONS_COLLECTION),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(publicationsQuery);
      const publications: PublicationDisplayData[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        publications.push({
          id: doc.id,
          publicationId: data.publicationId || doc.id,
          title: data.title,
          subtitle: data.subtitle || '',
          author: data.author,
          description: data.description || '',
          price: data.price,
          currency: data.currency || 'AUD',
          formattedPrice: `$${data.price?.toFixed(2)}`,
          shipping: data.shipping || 0,
          formattedShipping: data.shipping ? `$${data.shipping.toFixed(2)}` : '',
          type: data.type,
          pages: data.pages,
          category: data.category,
          subject: data.subject || '',
          grade: data.grade || '',
          coverImage: data.coverImage || '/images/placeholder-thumbnail.svg',
          images: data.images || [],
          isActive: data.isActive,
          isFeatured: data.isFeatured || false,
          tags: data.tags || [],
          features: data.features || [],
          language: data.language || 'English',
          sales: data.sales || 0,
          views: data.views || 0,
          rating: data.rating || 0,
          ratingCount: data.ratingCount || 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
        });
      });
      
      return publications;
    } catch (error) {
      console.error('Error fetching active publications:', error);
      throw new Error(`Failed to fetch active publications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get publication by ID
  static async getPublicationById(id: string): Promise<PublicationDisplayData | null> {
    try {
      const docRef = doc(firestore, PUBLICATIONS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data();
      return {
        id: docSnap.id,
        publicationId: data.publicationId || docSnap.id,
        title: data.title,
        subtitle: data.subtitle || '',
        author: data.author,
        description: data.description || '',
        price: data.price,
        currency: data.currency || 'AUD',
        formattedPrice: `$${data.price?.toFixed(2)}`,
        shipping: data.shipping || 0,
        formattedShipping: data.shipping ? `$${data.shipping.toFixed(2)}` : '',
        type: data.type,
        pages: data.pages,
        category: data.category,
        subject: data.subject || '',
        grade: data.grade || '',
        coverImage: data.coverImage || '/images/placeholder-thumbnail.svg',
        images: data.images || [],
        isActive: data.isActive,
        isFeatured: data.isFeatured || false,
        tags: data.tags || [],
        features: data.features || [],
        language: data.language || 'English',
        sales: data.sales || 0,
        views: data.views || 0,
        rating: data.rating || 0,
        ratingCount: data.ratingCount || 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching publication:', error);
      throw new Error(`Failed to fetch publication: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Update publication
  static async updatePublication(id: string, updateData: Partial<Publication>): Promise<void> {
    try {
      const docRef = doc(firestore, PUBLICATIONS_COLLECTION, id);
      const updatePayload = {
        ...updateData,
        updatedAt: new Date()
      };
      
      await updateDoc(docRef, updatePayload);
      console.log('Publication updated successfully:', id);
    } catch (error) {
      console.error('Error updating publication:', error);
      throw new Error(`Failed to update publication: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Delete publication
  static async deletePublication(id: string): Promise<void> {
    try {
      const docRef = doc(firestore, PUBLICATIONS_COLLECTION, id);
      await deleteDoc(docRef);
      console.log('Publication deleted successfully:', id);
    } catch (error) {
      console.error('Error deleting publication:', error);
      throw new Error(`Failed to delete publication: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Batch create multiple publications
  static async batchCreatePublications(publicationsData: Omit<Publication, 'publicationId' | 'createdAt' | 'updatedAt'>[]): Promise<string[]> {
    try {
      const batch = writeBatch(firestore);
      const ids: string[] = [];
      
      for (const publicationData of publicationsData) {
        const publicationId = createPublicationId();
        const publication: Publication = {
          ...publicationData,
          publicationId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        // Validate the data
        const validatedPublication = publicationSchema.parse(publication);
        
        const docRef = doc(collection(firestore, PUBLICATIONS_COLLECTION));
        batch.set(docRef, validatedPublication);
        ids.push(docRef.id);
      }
      
      await batch.commit();
      console.log('Batch publications created:', ids.length);
      
      return ids;
    } catch (error) {
      console.error('Error batch creating publications:', error);
      throw new Error(`Failed to batch create publications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get publications by category
  static async getPublicationsByCategory(category: string): Promise<PublicationDisplayData[]> {
    try {
      const publicationsQuery = query(
        collection(firestore, PUBLICATIONS_COLLECTION),
        where('category', '==', category),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(publicationsQuery);
      const publications: PublicationDisplayData[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        publications.push({
          id: doc.id,
          publicationId: data.publicationId || doc.id,
          title: data.title,
          subtitle: data.subtitle || '',
          author: data.author,
          description: data.description || '',
          price: data.price,
          currency: data.currency || 'AUD',
          formattedPrice: `$${data.price?.toFixed(2)}`,
          shipping: data.shipping || 0,
          formattedShipping: data.shipping ? `$${data.shipping.toFixed(2)}` : '',
          type: data.type,
          pages: data.pages,
          category: data.category,
          subject: data.subject || '',
          grade: data.grade || '',
          coverImage: data.coverImage || '/images/placeholder-thumbnail.svg',
          images: data.images || [],
          isActive: data.isActive,
          isFeatured: data.isFeatured || false,
          tags: data.tags || [],
          features: data.features || [],
          language: data.language || 'English',
          sales: data.sales || 0,
          views: data.views || 0,
          rating: data.rating || 0,
          ratingCount: data.ratingCount || 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
        });
      });
      
      return publications;
    } catch (error) {
      console.error('Error fetching publications by category:', error);
      throw new Error(`Failed to fetch publications by category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get featured publications
  static async getFeaturedPublications(): Promise<PublicationDisplayData[]> {
    try {
      const publicationsQuery = query(
        collection(firestore, PUBLICATIONS_COLLECTION),
        where('isFeatured', '==', true),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(publicationsQuery);
      const publications: PublicationDisplayData[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        publications.push({
          id: doc.id,
          publicationId: data.publicationId || doc.id,
          title: data.title,
          subtitle: data.subtitle || '',
          author: data.author,
          description: data.description || '',
          price: data.price,
          currency: data.currency || 'AUD',
          formattedPrice: `$${data.price?.toFixed(2)}`,
          shipping: data.shipping || 0,
          formattedShipping: data.shipping ? `$${data.shipping.toFixed(2)}` : '',
          type: data.type,
          pages: data.pages,
          category: data.category,
          subject: data.subject || '',
          grade: data.grade || '',
          coverImage: data.coverImage || '/images/placeholder-thumbnail.svg',
          images: data.images || [],
          isActive: data.isActive,
          isFeatured: data.isFeatured || false,
          tags: data.tags || [],
          features: data.features || [],
          language: data.language || 'English',
          sales: data.sales || 0,
          views: data.views || 0,
          rating: data.rating || 0,
          ratingCount: data.ratingCount || 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
        });
      });
      
      return publications;
    } catch (error) {
      console.error('Error fetching featured publications:', error);
      throw new Error(`Failed to fetch featured publications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
