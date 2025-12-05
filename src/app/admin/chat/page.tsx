'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageCircle, 
  Search,
  Send,
  Users,
  ArrowLeft,
  GraduationCap,
  User
} from 'lucide-react';
import { Button } from '@/components/ui';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';

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
}

export default function AdminChatPage() {
  const [activeTab, setActiveTab] = useState<ContactType>('parents');
  const [parents, setParents] = useState<Parent[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedContact, setSelectedContact] = useState<Conversation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Get conversations based on active tab
  const conversations: Conversation[] = activeTab === 'parents'
    ? parents.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        avatar: p.avatar,
        type: 'parents' as ContactType,
        subtitle: `${p.studentsCount} student${p.studentsCount !== 1 ? 's' : ''}`,
      }))
    : teachers.map(t => ({
        id: t.id,
        name: t.name,
        email: t.email,
        avatar: t.avatar,
        type: 'teachers' as ContactType,
        subtitle: t.subjects.join(', ') || 'No subjects',
      }));

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                onClick={() => setSelectedContact(conv)}
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
                  <p className="font-medium text-gray-900 truncate">{conv.name}</p>
                  <p className="text-sm text-gray-500 truncate">{conv.email}</p>
                  <p className="text-xs text-gray-400 mt-1">{conv.subtitle}</p>
                </div>
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

            {/* Coming Soon Message */}
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center p-8">
                <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-10 h-10 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Chat Coming Soon</h3>
                <p className="text-gray-500 max-w-sm mx-auto">
                  Direct messaging with {selectedContact.type} will be available in an upcoming update.
                </p>
                <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 max-w-xs mx-auto">
                  <p className="text-sm text-gray-600">
                    <strong>Name:</strong> {selectedContact.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Email:</strong> {selectedContact.email || 'Not available'}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Type:</strong> {selectedContact.type === 'parents' ? 'Parent' : 'Teacher'}
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
              <p className="text-gray-500 mt-2">Choose a {activeTab === 'parents' ? 'parent' : 'teacher'} from the list to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
