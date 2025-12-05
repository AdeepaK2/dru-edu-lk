import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  Timestamp,
  arrayUnion,
  increment,
  writeBatch
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { 
  ChatConversation, 
  ChatConversationDocument,
  ChatMessage, 
  ChatMessageDocument,
  ChatParticipant,
  convertChatTimestampToDate 
} from '@/models/chatSchema';

const CONVERSATIONS_COLLECTION = 'chatConversations';
const MESSAGES_COLLECTION = 'chatMessages';

// Re-export types for convenience
export type { ChatConversation as ConversationDocument, ChatMessage as ChatMessageDocument } from '@/models/chatSchema';

export class ChatFirestoreService {
  
  // ==================== CONVERSATIONS ====================
  
  /**
   * Get or create a conversation between two users (convenience method)
   */
  static async getOrCreateConversation(
    user1Id: string,
    user1Email: string,
    user1Name: string,
    user1Type: 'parent' | 'teacher' | 'admin' | 'student',
    user2Id: string,
    user2Email: string,
    user2Name: string,
    user2Type: 'parent' | 'teacher' | 'admin' | 'student'
  ): Promise<string> {
    const participant1: ChatParticipant = {
      id: user1Id,
      email: user1Email,
      name: user1Name,
      type: user1Type,
    };
    const participant2: ChatParticipant = {
      id: user2Id,
      email: user2Email,
      name: user2Name,
      type: user2Type,
    };
    
    const conversation = await this.getOrCreateConversationWithParticipants(participant1, participant2);
    return conversation.id;
  }
  
  /**
   * Get or create a conversation between two users (with ChatParticipant objects)
   */
  static async getOrCreateConversationWithParticipants(
    participant1: ChatParticipant,
    participant2: ChatParticipant
  ): Promise<ChatConversation> {
    // Sort participant IDs to create consistent conversation lookup
    const participantIds = [participant1.id, participant2.id].sort();
    
    // Check if conversation exists
    const conversationsRef = collection(firestore, CONVERSATIONS_COLLECTION);
    const q = query(
      conversationsRef,
      where('participants', '==', participantIds)
    );
    
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data() as Omit<ChatConversationDocument, 'id'>;
      return {
        id: doc.id,
        ...data,
        lastMessageAt: data.lastMessageAt ? convertChatTimestampToDate(data.lastMessageAt) : undefined,
        createdAt: convertChatTimestampToDate(data.createdAt),
        updatedAt: convertChatTimestampToDate(data.updatedAt),
      };
    }
    
    // Create new conversation
    const now = Timestamp.now();
    const newConversation: Omit<ChatConversationDocument, 'id'> = {
      participants: participantIds,
      participantDetails: [participant1, participant2],
      unreadCount: {
        [participant1.id]: 0,
        [participant2.id]: 0,
      },
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = await addDoc(conversationsRef, newConversation);
    
    return {
      id: docRef.id,
      participants: participantIds,
      participantDetails: [participant1, participant2],
      unreadCount: newConversation.unreadCount,
      createdAt: now.toDate(),
      updatedAt: now.toDate(),
    };
  }
  
  /**
   * Get conversations for a user
   */
  static async getUserConversations(userId: string): Promise<ChatConversation[]> {
    const conversationsRef = collection(firestore, CONVERSATIONS_COLLECTION);
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data() as Omit<ChatConversationDocument, 'id'>;
      return {
        id: doc.id,
        ...data,
        lastMessageAt: data.lastMessageAt ? convertChatTimestampToDate(data.lastMessageAt) : undefined,
        createdAt: convertChatTimestampToDate(data.createdAt),
        updatedAt: convertChatTimestampToDate(data.updatedAt),
      };
    });
  }
  
  /**
   * Get a single conversation by ID
   */
  static async getConversation(conversationId: string): Promise<ChatConversation | null> {
    const conversationRef = doc(firestore, CONVERSATIONS_COLLECTION, conversationId);
    const conversationSnap = await getDoc(conversationRef);
    
    if (!conversationSnap.exists()) {
      return null;
    }
    
    const data = conversationSnap.data() as Omit<ChatConversationDocument, 'id'>;
    return {
      id: conversationSnap.id,
      ...data,
      lastMessageAt: data.lastMessageAt ? convertChatTimestampToDate(data.lastMessageAt) : undefined,
      createdAt: convertChatTimestampToDate(data.createdAt),
      updatedAt: convertChatTimestampToDate(data.updatedAt),
    };
  }
  
  /**
   * Subscribe to user's conversations (real-time) - convenience method with email
   */
  static subscribeToConversations(
    userId: string,
    userEmail: string,
    callback: (conversations: ChatConversation[]) => void
  ): () => void {
    return this.subscribeToUserConversations(userId, callback);
  }
  
  /**
   * Subscribe to user's conversations (real-time)
   */
  static subscribeToUserConversations(
    userId: string, 
    callback: (conversations: ChatConversation[]) => void
  ): () => void {
    const conversationsRef = collection(firestore, CONVERSATIONS_COLLECTION);
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const conversations = snapshot.docs.map(doc => {
        const data = doc.data() as Omit<ChatConversationDocument, 'id'>;
        return {
          id: doc.id,
          ...data,
          lastMessageAt: data.lastMessageAt ? convertChatTimestampToDate(data.lastMessageAt) : undefined,
          createdAt: convertChatTimestampToDate(data.createdAt),
          updatedAt: convertChatTimestampToDate(data.updatedAt),
        };
      });
      callback(conversations);
    }, (error) => {
      console.error('Error in conversations subscription:', error);
    });
  }
  
  // ==================== MESSAGES ====================
  
  /**
   * Send a message (convenience method)
   */
  static async sendMessage(
    conversationId: string,
    senderId: string,
    senderEmail: string,
    senderName: string,
    senderType: 'parent' | 'teacher' | 'admin' | 'student',
    text: string
  ): Promise<ChatMessage> {
    return this.sendMessageFull(conversationId, senderId, senderName, senderType, text);
  }
  
  /**
   * Send a message (full version with all options)
   */
  static async sendMessageFull(
    conversationId: string,
    senderId: string,
    senderName: string,
    senderRole: 'parent' | 'teacher' | 'admin' | 'student',
    message: string,
    messageType: 'text' | 'image' | 'file' = 'text',
    attachmentUrl?: string,
    attachmentName?: string
  ): Promise<ChatMessage> {
    const messagesRef = collection(firestore, MESSAGES_COLLECTION);
    const now = Timestamp.now();
    
    const newMessage: Omit<ChatMessageDocument, 'id'> = {
      conversationId,
      senderId,
      senderName,
      senderRole,
      message,
      messageType,
      attachmentUrl,
      attachmentName,
      readBy: [senderId], // Sender has read their own message
      createdAt: now,
    };
    
    const docRef = await addDoc(messagesRef, newMessage);
    
    // Update conversation with last message info
    const conversationRef = doc(firestore, CONVERSATIONS_COLLECTION, conversationId);
    const conversationSnap = await getDoc(conversationRef);
    
    if (conversationSnap.exists()) {
      const convData = conversationSnap.data();
      const participants = convData.participants || [];
      
      // Increment unread count for other participants
      const unreadUpdates: Record<string, number> = {};
      for (const participantId of participants) {
        if (participantId !== senderId) {
          unreadUpdates[`unreadCount.${participantId}`] = increment(1) as any;
        }
      }
      
      await updateDoc(conversationRef, {
        lastMessage: message.length > 100 ? message.substring(0, 100) + '...' : message,
        lastMessageAt: now,
        lastMessageBy: senderId,
        updatedAt: now,
        ...unreadUpdates,
      });
    }
    
    return {
      id: docRef.id,
      ...newMessage,
      createdAt: now.toDate(),
    };
  }
  
  /**
   * Get messages for a conversation
   */
  static async getMessages(
    conversationId: string, 
    limitCount: number = 50
  ): Promise<ChatMessage[]> {
    const messagesRef = collection(firestore, MESSAGES_COLLECTION);
    const q = query(
      messagesRef,
      where('conversationId', '==', conversationId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data() as Omit<ChatMessageDocument, 'id'>;
      return {
        id: doc.id,
        ...data,
        createdAt: convertChatTimestampToDate(data.createdAt),
      };
    }).reverse(); // Reverse to get chronological order
  }
  
  /**
   * Subscribe to messages in a conversation (real-time)
   */
  static subscribeToMessages(
    conversationId: string,
    callback: (messages: ChatMessage[]) => void,
    limitCount: number = 100
  ): () => void {
    const messagesRef = collection(firestore, MESSAGES_COLLECTION);
    const q = query(
      messagesRef,
      where('conversationId', '==', conversationId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => {
        const data = doc.data() as Omit<ChatMessageDocument, 'id'>;
        return {
          id: doc.id,
          ...data,
          createdAt: convertChatTimestampToDate(data.createdAt),
        };
      }).reverse(); // Reverse to get chronological order
      callback(messages);
    }, (error) => {
      console.error('Error in messages subscription:', error);
    });
  }
  
  /**
   * Mark messages as read (convenience alias)
   */
  static async markAsRead(conversationId: string, userId: string): Promise<void> {
    return this.markMessagesAsRead(conversationId, userId);
  }
  
  /**
   * Mark messages as read
   */
  static async markMessagesAsRead(
    conversationId: string, 
    userId: string
  ): Promise<void> {
    // Get unread messages
    const messagesRef = collection(firestore, MESSAGES_COLLECTION);
    const q = query(
      messagesRef,
      where('conversationId', '==', conversationId),
      where('senderId', '!=', userId)
    );
    
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(firestore);
    
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.readBy?.includes(userId)) {
        batch.update(docSnap.ref, {
          readBy: arrayUnion(userId),
        });
      }
    });
    
    // Reset unread count for this user
    const conversationRef = doc(firestore, CONVERSATIONS_COLLECTION, conversationId);
    batch.update(conversationRef, {
      [`unreadCount.${userId}`]: 0,
    });
    
    await batch.commit();
  }
  
  /**
   * Get total unread count for a user
   */
  static async getTotalUnreadCount(userId: string): Promise<number> {
    const conversations = await this.getUserConversations(userId);
    return conversations.reduce((total, conv) => {
      return total + (conv.unreadCount[userId] || 0);
    }, 0);
  }
  
  /**
   * Subscribe to total unread count (real-time)
   */
  static subscribeToUnreadCount(
    userId: string,
    callback: (count: number) => void
  ): () => void {
    return this.subscribeToUserConversations(userId, (conversations) => {
      const total = conversations.reduce((sum, conv) => {
        return sum + (conv.unreadCount[userId] || 0);
      }, 0);
      callback(total);
    });
  }
}
