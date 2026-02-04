'use client';

import React from 'react';
import { ChatConversation } from '@/models/chatSchema';
import { formatDistanceToNow } from 'date-fns';

interface ConversationListProps {
  conversations: ChatConversation[];
  selectedConversationId: string | null;
  currentUserId: string;
  onConversationSelect: (conversationId: string) => void;
  isLoading: boolean;
}

export default function ConversationList({
  conversations,
  selectedConversationId,
  currentUserId,
  onConversationSelect,
  isLoading,
}: ConversationListProps) {
  const getOtherParticipant = (conversation: ChatConversation) => {
    return conversation.participantDetails.find(p => p.id !== currentUserId);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      case 'teacher':
        return 'bg-blue-100 text-blue-700';
      case 'parent':
        return 'bg-green-100 text-green-700';
      case 'student':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading conversations...</p>
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm text-gray-500">No conversations yet</p>
          <p className="text-xs text-gray-400 mt-1">Start a new conversation to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conversation) => {
        const otherParticipant = getOtherParticipant(conversation);
        const unreadCount = conversation.unreadCount[currentUserId] || 0;
        const isSelected = conversation.id === selectedConversationId;

        if (!otherParticipant) return null;

        return (
          <div
            key={conversation.id}
            onClick={() => onConversationSelect(conversation.id)}
            className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
              isSelected
                ? 'bg-blue-50 border-l-4 border-l-blue-600'
                : 'hover:bg-gray-50 border-l-4 border-l-transparent'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                  {getInitials(otherParticipant.name)}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {otherParticipant.name}
                  </h3>
                  {conversation.lastMessageAt && (
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                      {formatDistanceToNow(conversation.lastMessageAt, { addSuffix: true })}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(
                      otherParticipant.type || otherParticipant.role || 'student'
                    )}`}
                  >
                    {(otherParticipant.type || otherParticipant.role || 'student').charAt(0).toUpperCase() +
                      (otherParticipant.type || otherParticipant.role || 'student').slice(1)}
                  </span>
                </div>

                {conversation.lastMessage && (
                  <p className="text-sm text-gray-600 truncate">
                    {conversation.lastMessage}
                  </p>
                )}
              </div>

              {/* Unread Badge */}
              {unreadCount > 0 && (
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-semibold">{unreadCount}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
