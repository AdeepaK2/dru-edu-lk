'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, User } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'parent' | 'teacher' | 'admin' | 'student';
}

interface NewConversationModalProps {
  currentUserId: string;
  currentUserRole: 'admin' | 'teacher' | 'parent' | 'student';
  onClose: () => void;
  onConversationCreate: (
    participantId: string,
    participantName: string,
    participantEmail: string,
    participantRole: 'parent' | 'teacher' | 'admin' | 'student'
  ) => void;
}

export default function NewConversationModal({
  currentUserId,
  currentUserRole,
  onClose,
  onConversationCreate,
}: NewConversationModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch users based on role
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        let endpoint = '';
        
        if (currentUserRole === 'admin') {
          // Admins can chat with everyone - fetch all users
          const [parentsRes, teachersRes, studentsRes] = await Promise.all([
            fetch('/api/parents'),
            fetch('/api/teachers'),
            fetch('/api/students'),
          ]);

          const [parentsData, teachersData, studentsData] = await Promise.all([
            parentsRes.json(),
            teachersRes.json(),
            studentsRes.json(),
          ]);

          const allUsers: User[] = [
            ...(parentsData.parents || []).map((p: any) => ({
              id: p.id,
              name: p.name,
              email: p.email,
              role: 'parent' as const,
            })),
            ...(teachersData.teachers || []).map((t: any) => ({
              id: t.id,
              name: t.name,
              email: t.email,
              role: 'teacher' as const,
            })),
            ...(studentsData.students || []).map((s: any) => ({
              id: s.id,
              name: s.name,
              email: s.email,
              role: 'student' as const,
            })),
          ];

          setUsers(allUsers);
          setFilteredUsers(allUsers);
        } else if (currentUserRole === 'teacher') {
          // Teachers can chat with parents and students
          const [parentsRes, studentsRes] = await Promise.all([
            fetch('/api/parents'),
            fetch('/api/students'),
          ]);

          const [parentsData, studentsData] = await Promise.all([
            parentsRes.json(),
            studentsRes.json(),
          ]);

          const teacherUsers: User[] = [
            ...(parentsData.parents || []).map((p: any) => ({
              id: p.id,
              name: p.name,
              email: p.email,
              role: 'parent' as const,
            })),
            ...(studentsData.students || []).map((s: any) => ({
              id: s.id,
              name: s.name,
              email: s.email,
              role: 'student' as const,
            })),
          ];

          setUsers(teacherUsers);
          setFilteredUsers(teacherUsers);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [currentUserRole]);

  // Filter users based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (user) =>
            user.name.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  const handleUserSelect = (user: User) => {
    onConversationCreate(user.id, user.name, user.email, user.role);
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">New Conversation</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Loading users...</p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-gray-500">No users found</p>
            </div>
          ) : (
            <div>
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleUserSelect(user)}
                  className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {getInitials(user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{user.name}</h3>
                      <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${getRoleBadgeColor(
                        user.role
                      )}`}
                    >
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
