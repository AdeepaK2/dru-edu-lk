/**
 * Server-side Video Purchase Service using Firebase Admin SDK
 * Used for webhook handlers and other server-side operations
 */

import { firebaseAdmin } from '@/utils/firebase-server';
import { Timestamp } from 'firebase-admin/firestore';

const COLLECTION_NAME = 'videoPurchases';

export interface VideoPurchaseUpdateData {
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'refunded';
  purchasedAt?: Timestamp;
  transactionId?: string;
  refundId?: string;
  metadata?: any;
}

export class VideoPurchaseServerService {
  /**
   * Update purchase status (for payment processing) - Server-side version
   */
  static async updatePurchaseStatus(
    purchaseId: string, 
    status: 'pending' | 'completed' | 'failed' | 'refunded',
    additionalData?: Partial<VideoPurchaseUpdateData>
  ): Promise<void> {
    try {
      const updateData: any = {
        paymentStatus: status,
        updatedAt: Timestamp.now(),
        ...additionalData
      };
      
      if (status === 'completed') {
        updateData.purchasedAt = Timestamp.now();
      }
      
      await firebaseAdmin.firestore.updateDoc(COLLECTION_NAME, purchaseId, updateData);
      console.log(`✅ Purchase status updated successfully: ${purchaseId} -> ${status}`);
    } catch (error) {
      console.error('Error updating purchase status:', error);
      throw new Error(`Failed to update purchase status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get purchase by ID - Server-side version
   */
  static async getPurchaseById(purchaseId: string): Promise<any | null> {
    try {
      const purchase = await firebaseAdmin.firestore.getDoc(COLLECTION_NAME, purchaseId);
      return purchase ? { id: purchaseId, ...purchase } : null;
    } catch (error) {
      console.error('Error fetching video purchase:', error);
      throw new Error(`Failed to fetch video purchase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create purchase record - Server-side version
   */
  static async createPurchase(purchaseData: any): Promise<string> {
    try {
      const purchaseId = await firebaseAdmin.firestore.addDoc(COLLECTION_NAME, {
        ...purchaseData,
        createdAt: Timestamp.now(),
        paymentStatus: 'pending'
      });
      
      console.log(`✅ Purchase created successfully: ${purchaseId}`);
      return purchaseId;
    } catch (error) {
      console.error('Error creating video purchase:', error);
      throw new Error(`Failed to create video purchase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete purchase - Server-side version  
   */
  static async deletePurchase(purchaseId: string): Promise<void> {
    try {
      await firebaseAdmin.firestore.deleteDoc(COLLECTION_NAME, purchaseId);
      console.log(`✅ Purchase deleted successfully: ${purchaseId}`);
    } catch (error) {
      console.error('Error deleting video purchase:', error);
      throw new Error(`Failed to delete video purchase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get purchases by student - Server-side version
   */
  static async getPurchasesByStudent(studentId: string): Promise<any[]> {
    try {
      const purchases = await firebaseAdmin.firestore.query(COLLECTION_NAME, 'studentId', '==', studentId);
      return purchases;
    } catch (error) {
      console.error('Error fetching student purchases:', error);
      throw new Error(`Failed to fetch student purchases: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get purchases by video - Server-side version
   */
  static async getPurchasesByVideo(videoId: string): Promise<any[]> {
    try {
      const purchases = await firebaseAdmin.firestore.query(COLLECTION_NAME, 'videoId', '==', videoId);
      return purchases;
    } catch (error) {
      console.error('Error fetching video purchases:', error);
      throw new Error(`Failed to fetch video purchases: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
