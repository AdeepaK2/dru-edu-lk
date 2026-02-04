'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChatConversation, ChatMessage } from '@/models/chatSchema';
import { ChatFirestoreService } from '@/apiservices/chatFirestoreService';
import { format } from 'date-fns';
import { Send, Check, CheckCheck } from 'lucide-react';

interface MessageViewProps {
  conversation: ChatConversation;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: 'admin' | 'teacher' | 'parent' | 'student';
}

export default function MessageView({
  conversation,
  currentUserId,
  currentUserName,
  currentUserRole,
}: MessageViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const otherParticipant = conversation.participantDetails.find(p => p.id !== currentUserId);

  // Subscribe to messages in real-time
  useEffect(() => {
    const unsubscribe = ChatFirestoreService.subscribeToMessages(
      conversation.id,
      (updatedMessages) => {
        setMessages(updatedMessages);
        // Mark messages as read
        ChatFirestoreService.markMessagesAsRead(conversation.id, currentUserId);
      }
    );

    return () => unsubscribe();
  }, [conversation.id, currentUserId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      await ChatFirestoreService.sendMessage(
        conversation.id,
        currentUserId,
        '', // email not needed for display
        currentUserName,
        currentUserRole,
        inputMessage.trim()
      );
      setInputMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
            {otherParticipant && getInitials(otherParticipant.name)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {otherParticipant?.name || 'Unknown'}
            </h3>
            <p className="text-xs text-gray-500 capitalize">
              {otherParticipant?.type || otherParticipant?.role || 'User'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-gray-500">No messages yet</p>
              <p className="text-xs text-gray-400 mt-1">Send a message to start the conversation</p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.senderId === currentUserId;
            const isRead = message.readBy && message.readBy.length > 1;

            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    isOwnMessage
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.message || message.text}
                  </p>
                  <div
                    className={`flex items-center gap-1 mt-1 text-xs ${
                      isOwnMessage ? 'text-blue-100 justify-end' : 'text-gray-500'
                    }`}
                  >
                    <span>
                      {format(message.createdAt || message.timestamp || new Date(), 'p')}
                    </span>
                    {isOwnMessage && (
                      <span className="ml-1">
                        {isRead ? (
                          <CheckCheck size={14} className="text-blue-200" />
                        ) : (
                          <Check size={14} className="text-blue-200" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            rows={1}
            disabled={isSending}
            className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isSending}
            className={`p-3 rounded-lg transition-colors ${
              inputMessage.trim() && !isSending
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
