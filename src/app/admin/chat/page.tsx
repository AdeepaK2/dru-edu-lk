'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MessageCircle, 
  Search,
  Send,
  Users,
  ArrowLeft,
  GraduationCap,
  User,
  CheckCheck,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { ChatFirestoreService, ConversationDocument, ChatMessageDocument } from '@/apiservices/chatFirestoreService';

// Admin credentials - this should match the system admin
const ADMIN_ID = 'system-admin';
const ADMIN_EMAIL = 'dru.coordinator@gmail.com';
const ADMIN_NAME = 'Dr U Education';

interface Parent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar: string;
  studentsCount: number;
}

interface Teacher {
  id: string;
  name: string;
  email: string;
  avatar: string;
  subjects: string[];
  status: string;
}

type ContactType = 'parents' | 'teachers';

interface Conversation {
  id: string;
  name: string;
  email: string;
  avatar: string;
  type: ContactType;
  subtitle: string;
  conversationDoc?: ConversationDocument;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
}

export default function AdminChatPage() {
  const [activeTab, setActiveTab] = useState<ContactType>('parents');
  const [parents, setParents] = useState<Parent[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [conversationsData, setConversationsData] = useState<Map<string, { lastMessage?: string; lastMessageTime?: Date; unreadCount: number; conversationDoc?: ConversationDocument }>>(new Map());
  const [selectedContact, setSelectedContact] = useState<Conversation | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDocument | null>(null);
  const [messages, setMessages] = useState<ChatMessageDocument[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unsubscribeMessagesRef = useRef<(() => void) | null>(null);
  const unsubscribeConversationsRef = useRef<(() => void) | null>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch parents and teachers
  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch parents
      const parentsSnapshot = await getDocs(
        query(collection(firestore, 'parents'), orderBy('name', 'asc'))
      );
      const parentsData: Parent[] = parentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown',
          email: data.email || '',
          phone: data.phone,
          avatar: (data.name || 'P').charAt(0).toUpperCase(),
          studentsCount: data.students?.length || 0,
        };
      });
      setParents(parentsData);

      // Fetch teachers
      const teachersSnapshot = await getDocs(
        query(collection(firestore, 'teachers'), orderBy('name', 'asc'))
      );
      const teachersData: Teacher[] = teachersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown',
          email: data.email || '',
          avatar: data.avatar || (data.name || 'T').charAt(0).toUpperCase(),
          subjects: data.subjects || [],
          status: data.status || 'Active',
        };
      });
      setTeachers(teachersData);

    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to admin's conversations
  useEffect(() => {
    unsubscribeConversationsRef.current = ChatFirestoreService.subscribeToConversations(
      ADMIN_ID,
      ADMIN_EMAIL,
      (conversations) => {
        const dataMap = new Map<string, { lastMessage?: string; lastMessageTime?: Date; unreadCount: number; conversationDoc?: ConversationDocument }>();
        conversations.forEach(conv => {
          // Find the other participant (not admin) from participantDetails
          const otherParticipant = conv.participantDetails?.find(p => p.id !== ADMIN_ID);
          if (otherParticipant) {
            dataMap.set(otherParticipant.id, {
              lastMessage: conv.lastMessage,
              lastMessageTime: conv.lastMessageAt,
              unreadCount: conv.unreadCount?.[ADMIN_ID] || 0,
              conversationDoc: conv,
            });
          }
        });
        setConversationsData(dataMap);
      }
    );

    return () => {
      if (unsubscribeConversationsRef.current) {
        unsubscribeConversationsRef.current();
      }
    };
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Handle contact selection
  const handleSelectContact = useCallback(async (contact: Conversation) => {
    setSelectedContact(contact);
    setLoadingMessages(true);
    setMessages([]);

    // Unsubscribe from previous messages
    if (unsubscribeMessagesRef.current) {
      unsubscribeMessagesRef.current();
    }

    try {
      // Get or create conversation
      const recipientType = contact.type === 'parents' ? 'parent' : 'teacher';
      const conversationId = await ChatFirestoreService.getOrCreateConversation(
        ADMIN_ID,
        ADMIN_EMAIL,
        ADMIN_NAME,
        'admin',
        contact.id,
        contact.email,
        contact.name,
        recipientType
      );

      const conversation = await ChatFirestoreService.getConversation(conversationId);
      setSelectedConversation(conversation);

      // Subscribe to messages
      unsubscribeMessagesRef.current = ChatFirestoreService.subscribeToMessages(
        conversationId,
        (msgs) => {
          setMessages(msgs);
          setLoadingMessages(false);
          
          // Mark as read
          ChatFirestoreService.markAsRead(conversationId, ADMIN_ID);
        }
      );
    } catch (err) {
      console.error('Error loading conversation:', err);
      setLoadingMessages(false);
    }
  }, []);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation?.id || sending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      await ChatFirestoreService.sendMessage(
        selectedConversation.id,
        ADMIN_ID,
        ADMIN_EMAIL,
        ADMIN_NAME,
        'admin',
        messageText
      );
    } catch (err) {
      console.error('Error sending message:', err);
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get conversations based on active tab
  const conversations: Conversation[] = activeTab === 'parents'
    ? parents.map(p => {
        const convData = conversationsData.get(p.id);
        return {
          id: p.id,
          name: p.name,
          email: p.email,
          avatar: p.avatar,
          type: 'parents' as ContactType,
          subtitle: `${p.studentsCount} student${p.studentsCount !== 1 ? 's' : ''}`,
          conversationDoc: convData?.conversationDoc,
          lastMessage: convData?.lastMessage,
          lastMessageTime: convData?.lastMessageTime,
          unreadCount: convData?.unreadCount || 0,
        };
      })
    : teachers.map(t => {
        const convData = conversationsData.get(t.id);
        return {
          id: t.id,
          name: t.name,
          email: t.email,
          avatar: t.avatar,
          type: 'teachers' as ContactType,
          subtitle: t.subjects.join(', ') || 'No subjects',
          conversationDoc: convData?.conversationDoc,
          lastMessage: convData?.lastMessage,
          lastMessageTime: convData?.lastMessageTime,
          unreadCount: convData?.unreadCount || 0,
        };
      });

  // Filter and sort conversations
  const filteredConversations = conversations
    .filter(conv =>
      conv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by last message time, most recent first
      const timeA = a.lastMessageTime?.getTime() || 0;
      const timeB = b.lastMessageTime?.getTime() || 0;
      return timeB - timeA;
    });

  return (
    <div className="h-[calc(100vh-80px)] flex bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
      {/* Sidebar - Conversations List */}
      <div className={`w-full md:w-80 lg:w-96 bg-white border-r border-gray-200 flex flex-col ${selectedContact ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-indigo-600" />
            Admin Messages
          </h1>
          <p className="text-sm text-gray-500 mt-1">Chat with parents and teachers</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setActiveTab('parents'); setSelectedContact(null); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'parents'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <User className="w-4 h-4" />
              Parents ({parents.length})
            </div>
          </button>
          <button
            onClick={() => { setActiveTab('teachers'); setSelectedContact(null); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'teachers'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Teachers ({teachers.length})
            </div>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : error ? (
            <div className="p-4 text-center">
              <p className="text-red-500">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={fetchContacts}
              >
                Retry
              </Button>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No {activeTab} found</p>
              <p className="text-sm text-gray-400 mt-1">
                {searchTerm ? 'Try a different search' : `${activeTab === 'parents' ? 'Parents' : 'Teachers'} will appear here`}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectContact(conv)}
                className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left ${
                  selectedContact?.id === conv.id ? 'bg-indigo-50' : ''
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  conv.type === 'parents' ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  <span className={`font-semibold text-lg ${
                    conv.type === 'parents' ? 'text-blue-600' : 'text-green-600'
                  }`}>{conv.avatar}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900 truncate">{conv.name}</p>
                    {conv.lastMessageTime && (
                      <span className="text-xs text-gray-400">{formatDate(conv.lastMessageTime)}</span>
                    )}
                  </div>
                  {conv.lastMessage ? (
                    <p className="text-sm text-gray-500 truncate">{conv.lastMessage}</p>
                  ) : (
                    <p className="text-sm text-gray-500 truncate">{conv.email}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{conv.subtitle}</p>
                </div>
                {conv.unreadCount > 0 && (
                  <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${!selectedContact ? 'hidden md:flex' : 'flex'}`}>
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-200 flex items-center gap-3">
              <button
                onClick={() => setSelectedContact(null)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                selectedContact.type === 'parents' ? 'bg-blue-100' : 'bg-green-100'
              }`}>
                <span className={`font-semibold ${
                  selectedContact.type === 'parents' ? 'text-blue-600' : 'text-green-600'
                }`}>{selectedContact.avatar}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{selectedContact.name}</p>
                <p className="text-sm text-gray-500">{selectedContact.subtitle}</p>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No messages yet</p>
                    <p className="text-sm text-gray-400">Start the conversation!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, index) => {
                    const isMe = msg.senderType === 'admin';
                    const showDate = index === 0 || 
                      formatDate(messages[index - 1].timestamp) !== formatDate(msg.timestamp);
                    
                    return (
                      <React.Fragment key={msg.id}>
                        {showDate && (
                          <div className="flex items-center justify-center my-4">
                            <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full">
                              {formatDate(msg.timestamp)}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] ${isMe ? 'order-2' : ''}`}>
                            <div className={`px-4 py-2 rounded-2xl ${
                              isMe 
                                ? 'bg-indigo-600 text-white rounded-br-sm' 
                                : 'bg-white text-gray-900 rounded-bl-sm border border-gray-200'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                            </div>
                            <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : ''}`}>
                              <span className="text-xs text-gray-400">{formatTime(msg.timestamp)}</span>
                              {isMe && (
                                (msg.readBy?.length || 0) > 1
                                  ? <CheckCheck className="w-3 h-3 text-blue-500" />
                                  : <Check className="w-3 h-3 text-gray-400" />
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  disabled={sending}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* No Conversation Selected */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-medium text-gray-700">Select a conversation</h3>
              <p className="text-gray-500 mt-2">Choose a {activeTab === 'parents' ? 'parent' : 'teacher'} from the list to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
