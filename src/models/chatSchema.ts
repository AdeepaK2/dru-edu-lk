import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// Chat conversation schema
export const chatConversationSchema = z.object({
  id: z.string().optional(),
  participants: z.array(z.string()).min(2), // Array of user IDs
  participantDetails: z.array(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().optional(),
    role: z.enum(['parent', 'teacher', 'admin', 'student']),
    avatar: z.string().optional(),
  })),
  lastMessage: z.string().optional(),
  lastMessageAt: z.date().optional(),
  lastMessageBy: z.string().optional(),
  unreadCount: z.record(z.string(), z.number()).default({}), // { odHfk3K: 2, teacher123: 0 }
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// Chat message schema
export const chatMessageSchema = z.object({
  id: z.string().optional(),
  conversationId: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  senderRole: z.enum(['parent', 'teacher', 'admin', 'student']),
  message: z.string().min(1).max(2000),
  messageType: z.enum(['text', 'image', 'file']).default('text'),
  attachmentUrl: z.string().optional(),
  attachmentName: z.string().optional(),
  readBy: z.array(z.string()).default([]), // Array of user IDs who have read
  createdAt: z.date().default(() => new Date()),
});

// Interfaces
export interface ChatParticipant {
  id: string;
  name: string;
  email?: string;
  type: 'parent' | 'teacher' | 'admin' | 'student';
  role?: 'parent' | 'teacher' | 'admin' | 'student'; // Alias for type
  avatar?: string;
}

export interface ChatConversation {
  id: string;
  participants: string[];
  participantDetails: ChatParticipant[];
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageBy?: string;
  unreadCount: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatConversationDocument {
  id: string;
  participants: string[];
  participantDetails: ChatParticipant[];
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  lastMessageBy?: string;
  unreadCount: Record<string, number>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: 'parent' | 'teacher' | 'admin' | 'student';
  message: string;
  messageType: 'text' | 'image' | 'file';
  attachmentUrl?: string;
  attachmentName?: string;
  readBy: string[];
  createdAt: Date;
}

export interface ChatMessageDocument {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: 'parent' | 'teacher' | 'admin' | 'student';
  message: string;
  messageType: 'text' | 'image' | 'file';
  attachmentUrl?: string;
  attachmentName?: string;
  readBy: string[];
  createdAt: Timestamp;
}

// Type inference
export type ChatConversationData = z.infer<typeof chatConversationSchema>;
export type ChatMessageData = z.infer<typeof chatMessageSchema>;

// Helper functions
export const convertChatTimestampToDate = (timestamp: Timestamp): Date => {
  return timestamp.toDate();
};

export const convertDateToChatTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date);
};
