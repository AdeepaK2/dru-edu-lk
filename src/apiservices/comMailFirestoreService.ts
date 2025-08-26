import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { 
  ComMail, 
  ComMailDocument, 
  ComMailData, 
  ComMailUpdateData,
  ComMailRecipient,
  ComMailRecipientData,
  EmailTemplate,
  EmailTemplateData,
  comMailSchema,
  comMailUpdateSchema,
  comMailRecipientSchema,
  emailTemplateSchema,
  convertDateToComMailTimestamp,
  convertComMailTimestampToDate
} from '@/models/comMailSchema';

export class ComMailFirestoreService {
  private static readonly COLLECTION_NAME = 'comMails';
  private static readonly RECIPIENTS_COLLECTION_NAME = 'comMailRecipients';
  private static readonly TEMPLATES_COLLECTION_NAME = 'emailTemplates';

  // Create a new email
  static async createComMail(data: ComMailData): Promise<string> {
    try {
      // Validate data
      const validatedData = comMailSchema.parse(data);
      
      const comMailsCollection = collection(firestore, this.COLLECTION_NAME);
      const now = Timestamp.now();
      
      const comMailDocument: Omit<ComMailDocument, 'id'> = {
        classId: validatedData.classId,
        teacherId: validatedData.teacherId,
        teacherName: validatedData.teacherName,
        subject: validatedData.subject,
        body: validatedData.body,
        recipientType: validatedData.recipientType,
        selectedStudentIds: validatedData.selectedStudentIds,
        recipientsList: validatedData.recipientsList,
        priority: validatedData.priority,
        attachmentNames: validatedData.attachmentNames,
        attachmentUrls: validatedData.attachmentUrls,
        deliveredCount: validatedData.deliveredCount,
        readCount: validatedData.readCount,
        sentAt: convertDateToComMailTimestamp(validatedData.sentAt),
        status: validatedData.status,
        emailType: validatedData.emailType,
        isScheduled: validatedData.isScheduled,
        scheduledFor: validatedData.scheduledFor ? convertDateToComMailTimestamp(validatedData.scheduledFor) : undefined,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await addDoc(comMailsCollection, comMailDocument);
      console.log('✅ ComMail created successfully with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating comMail:', error);
      throw error;
    }
  }

  // Get email by ID
  static async getComMailById(comMailId: string): Promise<ComMail | null> {
    try {
      const comMailDoc = doc(firestore, this.COLLECTION_NAME, comMailId);
      const snapshot = await getDoc(comMailDoc);

      if (!snapshot.exists()) {
        return null;
      }

      const data = snapshot.data() as Omit<ComMailDocument, 'id'>;
      return {
        id: snapshot.id,
        ...data,
        sentAt: convertComMailTimestampToDate(data.sentAt),
        scheduledFor: data.scheduledFor ? convertComMailTimestampToDate(data.scheduledFor) : undefined,
      };
    } catch (error) {
      console.error('❌ Error getting comMail:', error);
      throw error;
    }
  }

  // Get emails by class ID
  static async getComMailsByClass(classId: string, limitCount: number = 50): Promise<ComMail[]> {
    try {
      const comMailsCollection = collection(firestore, this.COLLECTION_NAME);
      const q = query(
        comMailsCollection,
        where('classId', '==', classId),
        orderBy('sentAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      const comMails: ComMail[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<ComMailDocument, 'id'>;
        comMails.push({
          id: doc.id,
          ...data,
          sentAt: convertComMailTimestampToDate(data.sentAt),
          scheduledFor: data.scheduledFor ? convertComMailTimestampToDate(data.scheduledFor) : undefined,
        });
      });

      return comMails;
    } catch (error) {
      console.error('❌ Error getting comMails by class:', error);
      throw error;
    }
  }

  // Get emails by teacher ID
  static async getComMailsByTeacher(teacherId: string, limitCount: number = 100): Promise<ComMail[]> {
    try {
      const comMailsCollection = collection(firestore, this.COLLECTION_NAME);
      const q = query(
        comMailsCollection,
        where('teacherId', '==', teacherId),
        orderBy('sentAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      const comMails: ComMail[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<ComMailDocument, 'id'>;
        comMails.push({
          id: doc.id,
          ...data,
          sentAt: convertComMailTimestampToDate(data.sentAt),
          scheduledFor: data.scheduledFor ? convertComMailTimestampToDate(data.scheduledFor) : undefined,
        });
      });

      return comMails;
    } catch (error) {
      console.error('❌ Error getting comMails by teacher:', error);
      throw error;
    }
  }

  // Update email
  static async updateComMail(comMailId: string, updates: Partial<ComMailUpdateData>): Promise<void> {
    try {
      // Validate updates
      const validatedUpdates = comMailUpdateSchema.partial().parse(updates);
      
      const comMailDoc = doc(firestore, this.COLLECTION_NAME, comMailId);
      const updateData: any = {
        ...validatedUpdates,
        updatedAt: Timestamp.now()
      };

      // Convert date fields to timestamps if present
      if (validatedUpdates.sentAt) {
        updateData.sentAt = convertDateToComMailTimestamp(validatedUpdates.sentAt);
      }
      if (validatedUpdates.scheduledFor) {
        updateData.scheduledFor = convertDateToComMailTimestamp(validatedUpdates.scheduledFor);
      }

      await updateDoc(comMailDoc, updateData);
      console.log('✅ ComMail updated successfully');
    } catch (error) {
      console.error('❌ Error updating comMail:', error);
      throw error;
    }
  }

  // Delete email
  static async deleteComMail(comMailId: string): Promise<void> {
    try {
      const comMailDoc = doc(firestore, this.COLLECTION_NAME, comMailId);
      await deleteDoc(comMailDoc);
      
      // Also delete all email recipients
      await this.deleteComMailRecipients(comMailId);
      
      console.log('✅ ComMail deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting comMail:', error);
      throw error;
    }
  }

  // Create email recipients
  static async createComMailRecipients(
    emailId: string, 
    recipients: ComMailRecipientData[]
  ): Promise<void> {
    try {
      const batch = writeBatch(firestore);
      const recipientsCollection = collection(firestore, this.RECIPIENTS_COLLECTION_NAME);

      recipients.forEach((recipientData) => {
        const validatedData = comMailRecipientSchema.parse(recipientData);
        const docRef = doc(recipientsCollection);
        
        const recipientDocument: Omit<ComMailRecipient, 'id'> = {
          emailId,
          recipientId: validatedData.recipientId,
          recipientType: validatedData.recipientType,
          recipientName: validatedData.recipientName,
          recipientEmail: validatedData.recipientEmail,
          deliveryStatus: validatedData.deliveryStatus,
          deliveredAt: validatedData.deliveredAt ? convertDateToComMailTimestamp(validatedData.deliveredAt) : undefined,
          readAt: validatedData.readAt ? convertDateToComMailTimestamp(validatedData.readAt) : undefined,
          failureReason: validatedData.failureReason,
          bounceReason: validatedData.bounceReason,
          openedCount: validatedData.openedCount,
          lastOpenedAt: validatedData.lastOpenedAt ? convertDateToComMailTimestamp(validatedData.lastOpenedAt) : undefined,
        };

        batch.set(docRef, recipientDocument);
      });

      await batch.commit();
      console.log('✅ ComMail recipients created successfully');
    } catch (error) {
      console.error('❌ Error creating comMail recipients:', error);
      throw error;
    }
  }

  // Get email recipients
  static async getComMailRecipients(emailId: string): Promise<ComMailRecipient[]> {
    try {
      const recipientsCollection = collection(firestore, this.RECIPIENTS_COLLECTION_NAME);
      const q = query(
        recipientsCollection,
        where('emailId', '==', emailId)
      );

      const snapshot = await getDocs(q);
      const recipients: ComMailRecipient[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<ComMailRecipient, 'id'>;
        recipients.push({
          id: doc.id,
          ...data,
          deliveredAt: data.deliveredAt ? data.deliveredAt : undefined,
          readAt: data.readAt ? data.readAt : undefined,
          lastOpenedAt: data.lastOpenedAt ? data.lastOpenedAt : undefined,
        });
      });

      return recipients;
    } catch (error) {
      console.error('❌ Error getting comMail recipients:', error);
      throw error;
    }
  }

  // Update email recipient status
  static async updateRecipientStatus(
    recipientId: string,
    status: 'pending' | 'delivered' | 'read' | 'failed' | 'bounced',
    failureReason?: string,
    bounceReason?: string
  ): Promise<void> {
    try {
      const recipientDoc = doc(firestore, this.RECIPIENTS_COLLECTION_NAME, recipientId);
      const updateData: Partial<ComMailRecipient> = {
        deliveryStatus: status
      };

      const now = Timestamp.now();

      if (status === 'delivered') {
        updateData.deliveredAt = now;
      } else if (status === 'read') {
        updateData.readAt = now;
        updateData.openedCount = 1;
        updateData.lastOpenedAt = now;
        if (!updateData.deliveredAt) {
          updateData.deliveredAt = now;
        }
      } else if (status === 'bounced') {
        updateData.bounceReason = bounceReason;
      } else if (status === 'failed' && failureReason) {
        updateData.failureReason = failureReason;
      }

      await updateDoc(recipientDoc, updateData);
      console.log('✅ Recipient status updated successfully');
    } catch (error) {
      console.error('❌ Error updating recipient status:', error);
      throw error;
    }
  }

  // Delete email recipients
  static async deleteComMailRecipients(emailId: string): Promise<void> {
    try {
      const recipientsCollection = collection(firestore, this.RECIPIENTS_COLLECTION_NAME);
      const q = query(
        recipientsCollection,
        where('emailId', '==', emailId)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(firestore);

      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log('✅ ComMail recipients deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting comMail recipients:', error);
      throw error;
    }
  }

  // Create email template
  static async createEmailTemplate(
    templateData: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const validatedData = emailTemplateSchema.omit({ id: true, createdAt: true, updatedAt: true }).parse(templateData);
      
      const templatesCollection = collection(firestore, this.TEMPLATES_COLLECTION_NAME);
      const now = Timestamp.now();
      
      const docRef = await addDoc(templatesCollection, {
        ...validatedData,
        createdAt: now,
        updatedAt: now
      });

      console.log('✅ Email template created successfully');
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating email template:', error);
      throw error;
    }
  }

  // Get email templates by teacher
  static async getEmailTemplatesByTeacher(teacherId: string): Promise<EmailTemplate[]> {
    try {
      const templatesCollection = collection(firestore, this.TEMPLATES_COLLECTION_NAME);
      const q = query(
        templatesCollection,
        where('teacherId', '==', teacherId),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const templates: EmailTemplate[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<EmailTemplate, 'id'>;
        templates.push({
          id: doc.id,
          ...data,
          createdAt: convertComMailTimestampToDate(data.createdAt as any),
          updatedAt: convertComMailTimestampToDate(data.updatedAt as any),
        });
      });

      return templates;
    } catch (error) {
      console.error('❌ Error getting email templates:', error);
      throw error;
    }
  }

  // Update delivery counts
  static async updateDeliveryCounts(emailId: string): Promise<void> {
    try {
      const recipients = await this.getComMailRecipients(emailId);
      const deliveredCount = recipients.filter(r => 
        ['delivered', 'read'].includes(r.deliveryStatus)
      ).length;
      const readCount = recipients.filter(r => 
        r.deliveryStatus === 'read'
      ).length;

      await this.updateComMail(emailId, {
        id: emailId,
        deliveredCount,
        readCount
      });

      console.log('✅ Delivery counts updated successfully');
    } catch (error) {
      console.error('❌ Error updating delivery counts:', error);
      throw error;
    }
  }
}
