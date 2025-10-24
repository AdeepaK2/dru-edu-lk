import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  increment
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import {
  MailBatchDocument,
  MailBatchDocumentFirestore,
  CreateMailBatchInput,
  EmailRecipient,
  BatchStatistics
} from '@/models/mailBatchSchema';
import { MailService } from './mailService';

export class MailBatchService {
  private static readonly MAIL_BATCH_COLLECTION = 'mailBatches';
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly BATCH_SIZE = 10; // Send emails in batches of 10 to avoid overwhelming the system

  /**
   * Create a new mail batch document
   */
  static async createBatch(input: CreateMailBatchInput): Promise<string> {
    try {
      const batchDoc: MailBatchDocument = {
        batchName: input.batchName,
        subject: input.subject,
        batchType: input.batchType,
        createdAt: Timestamp.now(),
        createdBy: input.createdBy,
        createdByName: input.createdByName,
        totalRecipients: input.recipients.length,
        successCount: 0,
        failedCount: 0,
        pendingCount: input.recipients.length,
        status: 'processing',
        recipients: input.recipients.map(r => ({
          ...r,
          status: 'pending' as const,
          attemptCount: 0
        })),
        metadata: input.metadata,
        lastUpdatedAt: Timestamp.now()
      };

      const docRef = await addDoc(
        collection(firestore, this.MAIL_BATCH_COLLECTION),
        batchDoc
      );

      console.log('✅ Mail batch created:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating mail batch:', error);
      throw error;
    }
  }

  /**
   * Update recipient status in batch
   */
  static async updateRecipientStatus(
    batchId: string,
    recipientEmail: string,
    status: 'sent' | 'failed',
    mailId?: string,
    error?: string
  ): Promise<void> {
    try {
      const batchRef = doc(firestore, this.MAIL_BATCH_COLLECTION, batchId);
      const batchSnap = await getDoc(batchRef);

      if (!batchSnap.exists()) {
        throw new Error('Batch not found');
      }

      const batchData = batchSnap.data() as MailBatchDocument;
      const recipients = [...batchData.recipients];

      // Find and update the recipient
      const recipientIndex = recipients.findIndex(r => r.recipientEmail === recipientEmail);
      if (recipientIndex === -1) {
        console.warn(`Recipient ${recipientEmail} not found in batch ${batchId}`);
        return;
      }

      recipients[recipientIndex] = {
        ...recipients[recipientIndex],
        status,
        mailId,
        error,
        sentAt: status === 'sent' ? Timestamp.now() : recipients[recipientIndex].sentAt,
        attemptCount: (recipients[recipientIndex].attemptCount || 0) + 1
      };

      // Count statuses
      const successCount = recipients.filter(r => r.status === 'sent').length;
      const failedCount = recipients.filter(r => r.status === 'failed').length;
      const pendingCount = recipients.filter(r => r.status === 'pending').length;

      // Determine batch status
      let batchStatus: MailBatchDocument['status'] = 'processing';
      if (pendingCount === 0) {
        if (failedCount === 0) {
          batchStatus = 'completed';
        } else if (successCount === 0) {
          batchStatus = 'failed';
        } else {
          batchStatus = 'partially_failed';
        }
      }

      // Update batch document
      await updateDoc(batchRef, {
        recipients,
        successCount,
        failedCount,
        pendingCount,
        status: batchStatus,
        lastUpdatedAt: Timestamp.now(),
        ...(batchStatus !== 'processing' && { completedAt: Timestamp.now() })
      });

      console.log(`✅ Updated recipient ${recipientEmail} in batch ${batchId}: ${status}`);
    } catch (error) {
      console.error('❌ Error updating recipient status:', error);
      throw error;
    }
  }

  /**
   * Process a mail batch with retry logic
   */
  static async processBatch(batchId: string): Promise<void> {
    try {
      const batchRef = doc(firestore, this.MAIL_BATCH_COLLECTION, batchId);
      const batchSnap = await getDoc(batchRef);

      if (!batchSnap.exists()) {
        throw new Error('Batch not found');
      }

      const batchData = batchSnap.data() as MailBatchDocument;
      console.log(`📧 Processing mail batch ${batchId}: ${batchData.batchName}`);
      console.log(`📊 Total recipients: ${batchData.totalRecipients}`);

      // Get pending or failed recipients (for retry)
      const recipientsToProcess = batchData.recipients.filter(
        r => r.status === 'pending' || (r.status === 'failed' && (r.attemptCount || 0) < this.MAX_RETRY_ATTEMPTS)
      );

      if (recipientsToProcess.length === 0) {
        console.log('ℹ️ No recipients to process');
        return;
      }

      console.log(`📤 Processing ${recipientsToProcess.length} recipients`);

      // Process in batches to avoid overwhelming the system
      for (let i = 0; i < recipientsToProcess.length; i += this.BATCH_SIZE) {
        const batch = recipientsToProcess.slice(i, i + this.BATCH_SIZE);
        console.log(`📦 Processing batch ${Math.floor(i / this.BATCH_SIZE) + 1} of ${Math.ceil(recipientsToProcess.length / this.BATCH_SIZE)}`);

        await Promise.allSettled(
          batch.map(async (recipient) => {
            try {
              console.log(`📨 Sending email to ${recipient.recipientEmail} (${recipient.recipientType})`);
              
              // This is a placeholder - the actual email sending will be done by the caller
              // who knows what type of email to send
              // The caller should use sendWithBatchTracking method below
              
              console.log(`✅ Email queued for ${recipient.recipientEmail}`);
            } catch (error) {
              console.error(`❌ Failed to process ${recipient.recipientEmail}:`, error);
            }
          })
        );

        // Add a small delay between batches to avoid rate limiting
        if (i + this.BATCH_SIZE < recipientsToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Batch processing completed for ${batchId}`);
    } catch (error) {
      console.error('❌ Error processing batch:', error);
      throw error;
    }
  }

  /**
   * Send an email and track it in the batch
   */
  static async sendWithBatchTracking(
    batchId: string,
    recipientEmail: string,
    emailGenerator: () => Promise<string> // Function that sends the email and returns mailId
  ): Promise<void> {
    try {
      const mailId = await emailGenerator();
      await this.updateRecipientStatus(batchId, recipientEmail, 'sent', mailId);
      console.log(`✅ Email sent and tracked: ${recipientEmail}`);
    } catch (error: any) {
      await this.updateRecipientStatus(
        batchId,
        recipientEmail,
        'failed',
        undefined,
        error?.message || 'Unknown error'
      );
      console.error(`❌ Email failed for ${recipientEmail}:`, error);
      throw error;
    }
  }

  /**
   * Retry failed emails in a batch
   */
  static async retryFailedEmails(batchId: string): Promise<void> {
    try {
      const batchRef = doc(firestore, this.MAIL_BATCH_COLLECTION, batchId);
      const batchSnap = await getDoc(batchRef);

      if (!batchSnap.exists()) {
        throw new Error('Batch not found');
      }

      const batchData = batchSnap.data() as MailBatchDocument;
      
      // Reset failed recipients that haven't exceeded max attempts
      const recipients = batchData.recipients.map(r => {
        if (r.status === 'failed' && (r.attemptCount || 0) < this.MAX_RETRY_ATTEMPTS) {
          return { ...r, status: 'pending' as const };
        }
        return r;
      });

      const pendingCount = recipients.filter(r => r.status === 'pending').length;

      await updateDoc(batchRef, {
        recipients,
        pendingCount,
        status: 'processing',
        lastUpdatedAt: Timestamp.now()
      });

      console.log(`🔄 Reset ${pendingCount} failed emails for retry in batch ${batchId}`);
    } catch (error) {
      console.error('❌ Error retrying failed emails:', error);
      throw error;
    }
  }

  /**
   * Get batch by ID
   */
  static async getBatchById(batchId: string): Promise<MailBatchDocumentFirestore | null> {
    try {
      const batchRef = doc(firestore, this.MAIL_BATCH_COLLECTION, batchId);
      const batchSnap = await getDoc(batchRef);

      if (!batchSnap.exists()) {
        return null;
      }

      return {
        id: batchSnap.id,
        ...batchSnap.data()
      } as MailBatchDocumentFirestore;
    } catch (error) {
      console.error('❌ Error getting batch:', error);
      throw error;
    }
  }

  /**
   * Get all batches for a teacher/admin
   */
  static async getBatchesByCreator(
    creatorId: string,
    limitCount: number = 50
  ): Promise<MailBatchDocumentFirestore[]> {
    try {
      const batchesQuery = query(
        collection(firestore, this.MAIL_BATCH_COLLECTION),
        where('createdBy', '==', creatorId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(batchesQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MailBatchDocumentFirestore));
    } catch (error) {
      console.error('❌ Error getting batches by creator:', error);
      throw error;
    }
  }

  /**
   * Get recent batches
   */
  static async getRecentBatches(limitCount: number = 20): Promise<MailBatchDocumentFirestore[]> {
    try {
      const batchesQuery = query(
        collection(firestore, this.MAIL_BATCH_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(batchesQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MailBatchDocumentFirestore));
    } catch (error) {
      console.error('❌ Error getting recent batches:', error);
      throw error;
    }
  }

  /**
   * Get batch statistics for a creator
   */
  static async getBatchStatistics(creatorId: string): Promise<BatchStatistics> {
    try {
      const batches = await this.getBatchesByCreator(creatorId, 100);

      const totalBatches = batches.length;
      const totalEmailsSent = batches.reduce((sum, b) => sum + b.successCount, 0);
      const totalEmailsFailed = batches.reduce((sum, b) => sum + b.failedCount, 0);
      const totalEmails = totalEmailsSent + totalEmailsFailed;
      const averageSuccessRate = totalEmails > 0 ? (totalEmailsSent / totalEmails) * 100 : 0;

      return {
        totalBatches,
        totalEmailsSent,
        totalEmailsFailed,
        averageSuccessRate,
        recentBatches: batches.slice(0, 10)
      };
    } catch (error) {
      console.error('❌ Error getting batch statistics:', error);
      throw error;
    }
  }

  /**
   * Delete old batches (for cleanup)
   */
  static async deleteOldBatches(daysOld: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

      const oldBatchesQuery = query(
        collection(firestore, this.MAIL_BATCH_COLLECTION),
        where('createdAt', '<', cutoffTimestamp)
      );

      const snapshot = await getDocs(oldBatchesQuery);
      const batch = writeBatch(firestore);

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`🗑️ Deleted ${snapshot.size} old batches`);
      return snapshot.size;
    } catch (error) {
      console.error('❌ Error deleting old batches:', error);
      throw error;
    }
  }
}
