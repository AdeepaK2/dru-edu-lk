'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageCircle, 
  Search,
  Send,
  Users,
  ArrowLeft,
  Clock,
  CheckCheck,
  User
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { getEnrollmentsByClass } from '@/services/studentEnrollmentService';

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

interface Conversation {
  parentId: string;
  parent: Parent;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
}

export default function TeacherChatPage() {
  const { teacher, loading: authLoading, isAuthenticated } = useTeacherAuth();
  const [parents, setParents] = useState<Parent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            // Each enrollment has parent info
            if (enrollment.parentId && !parentMap.has(enrollment.parentId)) {
              parentMap.set(enrollment.parentId, {
                id: enrollment.parentId,
                name: enrollment.parentName || 'Parent',
                email: enrollment.parentEmail || '',
                phone: enrollment.parentPhone,
                studentName: enrollment.studentName || 'Student',
                studentId: enrollment.studentId,
                classId: cls.id,
                className: cls.name || 'Unknown Class',
                avatar: (enrollment.parentName || 'P').charAt(0).toUpperCase(),
              });
            }
          }
        } catch (err) {
          console.warn(`Failed to get enrollments for class ${cls.id}:`, err);
        }
      }
      
      setParents(Array.from(parentMap.values()));
      
      // Convert to conversations (no actual chat history for now)
      const convs: Conversation[] = Array.from(parentMap.values()).map(parent => ({
        parentId: parent.id,
        parent,
        unreadCount: 0,
      }));
      setConversations(convs);
      
    } catch (err) {
      console.error('Error fetching parents:', err);
      setError('Failed to load parents');
    } finally {
      setLoading(false);
    }
  }, [teacher?.id]);

  useEffect(() => {
    if (isAuthenticated && teacher?.id) {
      fetchParents();
    }
  }, [isAuthenticated, teacher?.id, fetchParents]);

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv => 
    conv.parent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.parent.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.parent.className.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                  onClick={() => setSelectedParent(conv.parent)}
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
                          {new Date(conv.lastMessageTime).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      Parent of {conv.parent.studentName}
                    </p>
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
                  <p className="text-sm text-gray-500">Parent of {selectedParent.studentName}</p>
                </div>
              </div>

              {/* Coming Soon Message */}
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center p-8">
                  <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-10 h-10 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Chat Coming Soon</h3>
                  <p className="text-gray-500 max-w-sm mx-auto">
                    Direct messaging with parents will be available in an upcoming update. 
                    For now, you can send class announcements from the Classes page.
                  </p>
                  <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 max-w-xs mx-auto">
                    <p className="text-sm text-gray-600">
                      <strong>Parent:</strong> {selectedParent.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Email:</strong> {selectedParent.email || 'Not available'}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Student:</strong> {selectedParent.studentName}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Class:</strong> {selectedParent.className}
                    </p>
                  </div>
                </div>
              </div>

              {/* Message Input (Disabled) */}
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type a message... (Coming Soon)"
                    disabled
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 cursor-not-allowed"
                  />
                  <Button disabled className="opacity-50 cursor-not-allowed">
                    <Send className="w-4 h-4" />
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
