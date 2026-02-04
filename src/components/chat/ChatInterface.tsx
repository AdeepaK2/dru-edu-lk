'use client';

import React, { useState, useEffect } from 'react';
import { ChatConversation } from '@/models/chatSchema';
import { ChatFirestoreService } from '@/apiservices/chatFirestoreService';
import ConversationList from './ConversationList';
import MessageView from './MessageView';
import NewConversationModal from './NewConversationModal';
import { Plus } from 'lucide-react';

interface ChatInterfaceProps {
  currentUserId: string;
  currentUserName: string;
  currentUserEmail: string;
  currentUserRole: 'admin' | 'teacher' | 'parent' | 'student';
}

export default function ChatInterface({
  currentUserId,
  currentUserName,
  currentUserEmail,
  currentUserRole,
}: ChatInterfaceProps) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isNewConversationModalOpen, setIsNewConversationModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to conversations in real-time
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = ChatFirestoreService.subscribeToUserConversations(
      currentUserId,
      (updatedConversations) => {
        setConversations(updatedConversations);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversationId(conversationId);
  };

  const handleNewConversation = async (
    participantId: string,
    participantName: string,
    participantEmail: string,
    participantRole: 'parent' | 'teacher' | 'admin' | 'student'
  ) => {
    try {
      const conversationId = await ChatFirestoreService.getOrCreateConversation(
        currentUserId,
        currentUserEmail,
        currentUserName,
        currentUserRole,
        participantId,
        participantEmail,
        participantName,
        participantRole
      );
      
      setSelectedConversationId(conversationId);
      setIsNewConversationModalOpen(false);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  return (
    <div className="flex h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Left Sidebar - Conversation List */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Messages</h2>
            <button
              onClick={() => setIsNewConversationModalOpen(true)}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="New Conversation"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        <ConversationList
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          currentUserId={currentUserId}
          onConversationSelect={handleConversationSelect}
          isLoading={isLoading}
        />
      </div>

      {/* Right Panel - Message View */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <MessageView
            conversation={selectedConversation}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserRole={currentUserRole}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">No Conversation Selected</h3>
              <p className="text-sm text-gray-500">
                Select a conversation from the list or start a new one
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      {isNewConversationModalOpen && (
        <NewConversationModal
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onClose={() => setIsNewConversationModalOpen(false)}
          onConversationCreate={handleNewConversation}
        />
      )}
    </div>
  );
}
