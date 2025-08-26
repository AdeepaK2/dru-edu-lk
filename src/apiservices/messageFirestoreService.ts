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
  Message, 
  MessageDocument, 
  MessageData, 
  MessageUpdateData,
  MessageRecipient,
  MessageRecipientData,
  messageSchema,
  messageUpdateSchema,
  messageRecipientSchema,
  convertDateToMessageTimestamp,
  convertMessageTimestampToDate
} from '@/models/messageSchema';

export class MessageFirestoreService {
  private static readonly COLLECTION_NAME = 'messages';
  private static readonly RECIPIENTS_COLLECTION_NAME = 'messageRecipients';

  // Create a new message
  static async createMessage(data: MessageData): Promise<string> {
    try {
      // Validate data
      const validatedData = messageSchema.parse(data);
      
      const messagesCollection = collection(firestore, this.COLLECTION_NAME);
      const now = Timestamp.now();
      
      const messageDocument: Omit<MessageDocument, 'id'> = {
        classId: validatedData.classId,
        teacherId: validatedData.teacherId,
        teacherName: validatedData.teacherName,
        message: validatedData.message,
        recipientType: validatedData.recipientType,
        selectedStudentIds: validatedData.selectedStudentIds,
        recipientsList: validatedData.recipientsList,
        deliveredCount: validatedData.deliveredCount,
        readCount: validatedData.readCount,
        sentAt: convertDateToMessageTimestamp(validatedData.sentAt),
        status: validatedData.status,
        messageType: validatedData.messageType,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await addDoc(messagesCollection, messageDocument);
      console.log('✅ Message created successfully with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating message:', error);
      throw error;
    }
  }

  // Get message by ID
  static async getMessageById(messageId: string): Promise<Message | null> {
    try {
      const messageDoc = doc(firestore, this.COLLECTION_NAME, messageId);
      const snapshot = await getDoc(messageDoc);

      if (!snapshot.exists()) {
        return null;
      }

      const data = snapshot.data() as Omit<MessageDocument, 'id'>;
      return {
        id: snapshot.id,
        ...data,
        sentAt: convertMessageTimestampToDate(data.sentAt),
      };
    } catch (error) {
      console.error('❌ Error getting message:', error);
      throw error;
    }
  }

  // Get messages by class ID
  static async getMessagesByClass(classId: string, limitCount: number = 50): Promise<Message[]> {
    try {
      const messagesCollection = collection(firestore, this.COLLECTION_NAME);
      const q = query(
        messagesCollection,
        where('classId', '==', classId),
        orderBy('sentAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      const messages: Message[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<MessageDocument, 'id'>;
        messages.push({
          id: doc.id,
          ...data,
          sentAt: convertMessageTimestampToDate(data.sentAt),
        });
      });

      return messages;
    } catch (error) {
      console.error('❌ Error getting messages by class:', error);
      throw error;
    }
  }

  // Get messages by teacher ID
  static async getMessagesByTeacher(teacherId: string, limitCount: number = 100): Promise<Message[]> {
    try {
      const messagesCollection = collection(firestore, this.COLLECTION_NAME);
      const q = query(
        messagesCollection,
        where('teacherId', '==', teacherId),
        orderBy('sentAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      const messages: Message[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<MessageDocument, 'id'>;
        messages.push({
          id: doc.id,
          ...data,
          sentAt: convertMessageTimestampToDate(data.sentAt),
        });
      });

      return messages;
    } catch (error) {
      console.error('❌ Error getting messages by teacher:', error);
      throw error;
    }
  }

  // Update message
  static async updateMessage(messageId: string, updates: Partial<MessageUpdateData>): Promise<void> {
    try {
      // Validate updates
      const validatedUpdates = messageUpdateSchema.partial().parse(updates);
      
      const messageDoc = doc(firestore, this.COLLECTION_NAME, messageId);
      const updateData: any = {
        ...validatedUpdates,
        updatedAt: Timestamp.now()
      };

      // Convert date fields to timestamps if present
      if (validatedUpdates.sentAt) {
        updateData.sentAt = convertDateToMessageTimestamp(validatedUpdates.sentAt);
      }

      await updateDoc(messageDoc, updateData);
      console.log('✅ Message updated successfully');
    } catch (error) {
      console.error('❌ Error updating message:', error);
      throw error;
    }
  }

  // Delete message
  static async deleteMessage(messageId: string): Promise<void> {
    try {
      const messageDoc = doc(firestore, this.COLLECTION_NAME, messageId);
      await deleteDoc(messageDoc);
      
      // Also delete all message recipients
      await this.deleteMessageRecipients(messageId);
      
      console.log('✅ Message deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting message:', error);
      throw error;
    }
  }

  // Create message recipients
  static async createMessageRecipients(
    messageId: string, 
    recipients: MessageRecipientData[]
  ): Promise<void> {
    try {
      const batch = writeBatch(firestore);
      const recipientsCollection = collection(firestore, this.RECIPIENTS_COLLECTION_NAME);
      const now = Timestamp.now();

      recipients.forEach((recipientData) => {
        const validatedData = messageRecipientSchema.parse(recipientData);
        const docRef = doc(recipientsCollection);
        
        const recipientDocument: Omit<MessageRecipient, 'id'> = {
          messageId,
          recipientId: validatedData.recipientId,
          recipientType: validatedData.recipientType,
          recipientName: validatedData.recipientName,
          recipientEmail: validatedData.recipientEmail,
          deliveryStatus: validatedData.deliveryStatus,
          deliveredAt: validatedData.deliveredAt ? convertDateToMessageTimestamp(validatedData.deliveredAt) : undefined,
          readAt: validatedData.readAt ? convertDateToMessageTimestamp(validatedData.readAt) : undefined,
          failureReason: validatedData.failureReason,
        };

        batch.set(docRef, recipientDocument);
      });

      await batch.commit();
      console.log('✅ Message recipients created successfully');
    } catch (error) {
      console.error('❌ Error creating message recipients:', error);
      throw error;
    }
  }

  // Get message recipients
  static async getMessageRecipients(messageId: string): Promise<MessageRecipient[]> {
    try {
      const recipientsCollection = collection(firestore, this.RECIPIENTS_COLLECTION_NAME);
      const q = query(
        recipientsCollection,
        where('messageId', '==', messageId)
      );

      const snapshot = await getDocs(q);
      const recipients: MessageRecipient[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<MessageRecipient, 'id'>;
        recipients.push({
          id: doc.id,
          ...data,
          deliveredAt: data.deliveredAt ? data.deliveredAt : undefined,
          readAt: data.readAt ? data.readAt : undefined,
        });
      });

      return recipients;
    } catch (error) {
      console.error('❌ Error getting message recipients:', error);
      throw error;
    }
  }

  // Update message recipient status
  static async updateRecipientStatus(
    recipientId: string,
    status: 'pending' | 'delivered' | 'read' | 'failed',
    failureReason?: string
  ): Promise<void> {
    try {
      const recipientDoc = doc(firestore, this.RECIPIENTS_COLLECTION_NAME, recipientId);
      const updateData: Partial<MessageRecipient> = {
        deliveryStatus: status
      };

      if (status === 'delivered') {
        updateData.deliveredAt = Timestamp.now();
      } else if (status === 'read') {
        updateData.readAt = Timestamp.now();
        if (!updateData.deliveredAt) {
          updateData.deliveredAt = Timestamp.now();
        }
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

  // Delete message recipients
  static async deleteMessageRecipients(messageId: string): Promise<void> {
    try {
      const recipientsCollection = collection(firestore, this.RECIPIENTS_COLLECTION_NAME);
      const q = query(
        recipientsCollection,
        where('messageId', '==', messageId)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(firestore);

      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log('✅ Message recipients deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting message recipients:', error);
      throw error;
    }
  }

  // Update message delivery counts
  static async updateDeliveryCounts(messageId: string): Promise<void> {
    try {
      const recipients = await this.getMessageRecipients(messageId);
      const deliveredCount = recipients.filter(r => 
        r.deliveryStatus === 'delivered' || r.deliveryStatus === 'read'
      ).length;
      const readCount = recipients.filter(r => r.deliveryStatus === 'read').length;

      await this.updateMessage(messageId, {
        id: messageId,
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
