'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MessageCircle, 
  Search,
  Send,
  Users,
  ArrowLeft,
  CheckCheck,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { getEnrollmentsByClass } from '@/services/studentEnrollmentService';
import { StudentFirestoreService } from '@/apiservices/studentFirestoreService';
import { ChatFirestoreService, ConversationDocument, ChatMessageDocument } from '@/apiservices/chatFirestoreService';

interface Parent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  studentName: string;
  studentId: string;
  classId: string;
  className: string;
  avatar: string;
}

interface ConversationWithParent {
  parentId: string;
  parent: Parent;
  conversation?: ConversationDocument;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
}

export default function TeacherChatPage() {
  const { teacher, loading: authLoading, isAuthenticated } = useTeacherAuth();
  const [parents, setParents] = useState<Parent[]>([]);
  const [conversationsMap, setConversationsMap] = useState<Map<string, ConversationWithParent>>(new Map());
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
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

  // Fetch parents from teacher's classes
  const fetchParents = useCallback(async () => {
    if (!teacher?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get teacher's classes
      const classes = await ClassFirestoreService.getClassesByTeacher(teacher.id);
      
      const parentMap = new Map<string, Parent>();
      
      for (const cls of classes) {
        try {
          // Get enrollments for each class
          const enrollments = await getEnrollmentsByClass(cls.id);
          const activeEnrollments = enrollments.filter(e => e.status === 'Active');
          
          for (const enrollment of activeEnrollments) {
            // Fetch student to get parent info
            try {
              const student = await StudentFirestoreService.getStudentById(enrollment.studentId);
              if (student?.parent?.email && !parentMap.has(student.parent.email)) {
                parentMap.set(student.parent.email, {
                  id: student.parent.email, // Use parent email as ID
                  name: student.parent.name || 'Parent',
                  email: student.parent.email,
                  phone: student.parent.phone,
                  studentName: enrollment.studentName || student.name || 'Student',
                  studentId: enrollment.studentId,
                  classId: cls.id,
                  className: cls.name || 'Unknown Class',
                  avatar: (student.parent.name || 'P').charAt(0).toUpperCase(),
                });
              }
            } catch (studentErr) {
              console.warn(`Failed to get student ${enrollment.studentId}:`, studentErr);
            }
          }
        } catch (err) {
          console.warn(`Failed to get enrollments for class ${cls.id}:`, err);
        }
      }
      
      const parentsArray = Array.from(parentMap.values());
      setParents(parentsArray);
      
      // Initialize conversations map
      const convMap = new Map<string, ConversationWithParent>();
      parentsArray.forEach(parent => {
        convMap.set(parent.id, {
          parentId: parent.id,
          parent,
          unreadCount: 0,
        });
      });
      setConversationsMap(convMap);
      
    } catch (err) {
      console.error('Error fetching parents:', err);
      setError('Failed to load parents');
    } finally {
      setLoading(false);
    }
  }, [teacher?.id]);

  // Subscribe to conversations for unread counts
  useEffect(() => {
    if (!teacher?.id || !teacher?.email) return;

    unsubscribeConversationsRef.current = ChatFirestoreService.subscribeToConversations(
      teacher.id,
      teacher.email,
      (conversations) => {
        setConversationsMap(prev => {
          const newMap = new Map(prev);
          conversations.forEach(conv => {
            // Find the parent participant from participantDetails
            const parentParticipant = conv.participantDetails?.find(p => p.type === 'parent');
            if (parentParticipant) {
              const existing = newMap.get(parentParticipant.id);
              if (existing) {
                const lastMsg = conv.lastMessage as { text?: string; timestamp?: Date } | undefined;
                newMap.set(parentParticipant.id, {
                  ...existing,
                  conversation: conv,
                  lastMessage: lastMsg?.text,
                  lastMessageTime: lastMsg?.timestamp || conv.updatedAt,
                  unreadCount: conv.unreadCount?.[teacher.id] || 0,
                });
              }
            }
          });
          return newMap;
        });
      }
    );

    return () => {
      if (unsubscribeConversationsRef.current) {
        unsubscribeConversationsRef.current();
      }
    };
  }, [teacher?.id, teacher?.email]);

  useEffect(() => {
    if (isAuthenticated && teacher?.id) {
      fetchParents();
    }
  }, [isAuthenticated, teacher?.id, fetchParents]);

  // Handle parent selection and subscribe to messages
  const handleSelectParent = useCallback(async (parent: Parent) => {
    if (!teacher?.id || !teacher?.email) return;
    
    setSelectedParent(parent);
    setLoadingMessages(true);
    setMessages([]);

    // Unsubscribe from previous messages
    if (unsubscribeMessagesRef.current) {
      unsubscribeMessagesRef.current();
    }

    try {
      // Get or create conversation
      console.log('Teacher chat: Creating conversation with:', {
        teacherId: teacher.id,
        teacherEmail: teacher.email,
        parentId: parent.id,
        parentEmail: parent.email,
      });
      
      const conversationId = await ChatFirestoreService.getOrCreateConversation(
        teacher.id,
        teacher.email,
        teacher.name || 'Teacher',
        'teacher',
        parent.id,
        parent.email,
        parent.name,
        'parent'
      );
      
      console.log('Teacher chat: Got conversation ID:', conversationId);

      const conversation = await ChatFirestoreService.getConversation(conversationId);
      setSelectedConversation(conversation);

      // Subscribe to messages
      unsubscribeMessagesRef.current = ChatFirestoreService.subscribeToMessages(
        conversationId,
        (msgs) => {
          setMessages(msgs);
          setLoadingMessages(false);
          
          // Mark as read
          if (teacher?.id) {
            ChatFirestoreService.markAsRead(conversationId, teacher.id);
          }
        }
      );
    } catch (err) {
      console.error('Error loading conversation:', err);
      setLoadingMessages(false);
    }
  }, [teacher?.id, teacher?.email, teacher?.name]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation?.id || !teacher?.id || !teacher?.email || sending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      await ChatFirestoreService.sendMessage(
        selectedConversation.id,
        teacher.id,
        teacher.email,
        teacher.name || 'Teacher',
        'teacher',
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

  // Filter conversations by search
  const filteredConversations = Array.from(conversationsMap.values())
    .filter(conv => 
      conv.parent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.parent.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.parent.className.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by last message time, most recent first
      const timeA = a.lastMessageTime?.getTime() || 0;
      const timeB = b.lastMessageTime?.getTime() || 0;
      return timeB - timeA;
    });

  if (authLoading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </TeacherLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700">Please log in</h2>
            <p className="text-gray-500 mt-2">You need to be logged in to access chat</p>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="h-[calc(100vh-80px)] flex bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
        {/* Sidebar - Conversations List */}
        <div className={`w-full md:w-80 lg:w-96 bg-white border-r border-gray-200 flex flex-col ${selectedParent ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-indigo-600" />
              Messages
            </h1>
            <p className="text-sm text-gray-500 mt-1">Chat with parents</p>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search parents..."
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
                  onClick={fetchParents}
                >
                  Retry
                </Button>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No parents found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {searchTerm ? 'Try a different search' : 'Parents from your classes will appear here'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.parentId}
                  onClick={() => handleSelectParent(conv.parent)}
                  className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left ${
                    selectedParent?.id === conv.parentId ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-indigo-600 font-semibold text-lg">{conv.parent.avatar}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900 truncate">{conv.parent.name}</p>
                      {conv.lastMessageTime && (
                        <span className="text-xs text-gray-400">
                          {formatDate(conv.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage ? (
                      <p className="text-sm text-gray-500 truncate">{conv.lastMessage}</p>
                    ) : (
                      <p className="text-sm text-gray-500 truncate">
                        Parent of {conv.parent.studentName}
                      </p>
                    )}
                    <p className="text-xs text-indigo-500 mt-1">{conv.parent.className}</p>
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
        <div className={`flex-1 flex flex-col ${!selectedParent ? 'hidden md:flex' : 'flex'}`}>
          {selectedParent ? (
            <>
              {/* Chat Header */}
              <div className="p-4 bg-white border-b border-gray-200 flex items-center gap-3">
                <button
                  onClick={() => setSelectedParent(null)}
                  className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-indigo-600 font-semibold">{selectedParent.avatar}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{selectedParent.name}</p>
                  <p className="text-sm text-gray-500">Parent of {selectedParent.studentName} • {selectedParent.className}</p>
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
                      const isMe = msg.senderType === 'teacher';
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
                <p className="text-gray-500 mt-2">Choose a parent from the list to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}
