'use client';

import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Users, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  User,
  Search,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui';
import { MessageFirestoreService } from '@/apiservices/messageFirestoreService';
import { Message as MessageType, MessageData } from '@/models/messageSchema';

interface MessageProps {
  classId: string;
  enrollments: any[];
  teacherId?: string;
  teacherName?: string;
}

export default function Message({ classId, enrollments, teacherId = 'teacher-123', teacherName = 'Teacher Name' }: MessageProps) {
  const [messageText, setMessageText] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [recipientType, setRecipientType] = useState<'students' | 'parents' | 'both'>('students');
  const [messageHistory, setMessageHistory] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Load message history on component mount
  useEffect(() => {
    const loadMessageHistory = async () => {
      setIsLoading(true);
      try {
        const history = await MessageFirestoreService.getMessagesByClass(classId);
        setMessageHistory(history);
      } catch (error) {
        console.error('Failed to load message history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessageHistory();
  }, [classId]);

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    
    setIsSending(true);

    try {
      const getRecipientsList = () => {
        const recipients = [];
        
        if (recipientType === 'students' || recipientType === 'both') {
          recipients.push(selectedStudents.length === 0 ? 'All Students' : `${selectedStudents.length} Selected Students`);
        }
        if (recipientType === 'parents' || recipientType === 'both') {
          recipients.push(selectedStudents.length === 0 ? 'All Parents' : `${selectedStudents.length} Selected Parents`);
        }
        
        return recipients;
      };

      const messageData: MessageData = {
        classId,
        teacherId,
        teacherName,
        message: messageText.trim(),
        recipientType,
        selectedStudentIds: selectedStudents.length === 0 ? [] : selectedStudents,
        recipientsList: getRecipientsList(),
        deliveredCount: 0,
        readCount: 0,
        sentAt: new Date(),
        status: 'sent',
        messageType: 'general'
      };

      // Save message to Firestore
      const messageId = await MessageFirestoreService.createMessage(messageData);
      
      // TODO: Send actual messages via your SMS/messaging service
      
      // Refresh message history
      const updatedHistory = await MessageFirestoreService.getMessagesByClass(classId);
      setMessageHistory(updatedHistory);

      // Clear form
      setMessageText('');
      setSelectedStudents([]);
      
      console.log('✅ Message saved successfully with ID:', messageId);
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      // You might want to show a toast notification here
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectAllStudents = () => {
    if (selectedStudents.length === enrollments.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(enrollments.map((student: any) => student.studentId || student.id));
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const filteredStudents = enrollments.filter((student: any) =>
    student.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Message Composition */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Send Message
          </h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Send quick messages to students and parents
            </p>
          </div>

          {/* Recipient Selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Send To
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="recipientType"
                    value="students"
                    checked={recipientType === 'students'}
                    onChange={(e) => setRecipientType(e.target.value as 'students' | 'parents' | 'both')}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm text-gray-900 dark:text-gray-300">Students Only</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="recipientType"
                    value="parents"
                    checked={recipientType === 'parents'}
                    onChange={(e) => setRecipientType(e.target.value as 'students' | 'parents' | 'both')}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm text-gray-900 dark:text-gray-300">Parents Only</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="recipientType"
                    value="both"
                    checked={recipientType === 'both'}
                    onChange={(e) => setRecipientType(e.target.value as 'students' | 'parents' | 'both')}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm text-gray-900 dark:text-gray-300">Both Students & Parents</span>
                </label>
              </div>
            </div>

            {/* Student Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select Students
                </label>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllStudents}
                    className="text-xs"
                  >
                    {selectedStudents.length === enrollments.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedStudents.length === 0 ? `All ${enrollments.length} students` : `${selectedStudents.length} selected`}
                  </span>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Student List */}
              <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                {filteredStudents.map((student: any) => (
                  <label key={student.studentId || student.id} className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.studentId || student.id)}
                      onChange={() => toggleStudentSelection(student.studentId || student.id)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <div className="ml-3 flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {student.studentName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {student.studentEmail}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Message Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Message
            </label>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message here..."
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
            />
            <div className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">
              {messageText.length}/500 characters
            </div>
          </div>

          {/* Send Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || isSending}
              className="flex items-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? 'Sending...' : 'Send Message'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Message History */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-md font-medium text-gray-900 dark:text-white">
            Message History
          </h4>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              Loading message history...
            </div>
          ) : messageHistory.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No messages sent yet</p>
            </div>
          ) : (
            messageHistory.map((message) => (
              <div key={message.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        {message.status.charAt(0).toUpperCase() + message.status.slice(1)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {message.sentAt.toLocaleString('en-AU', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      {message.message}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center space-x-1">
                        <Users className="w-3 h-3" />
                        <span>To: {message.recipientsList.join(', ')}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span>Delivered: {message.deliveredCount}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3 text-blue-500" />
                        <span>Read: {message.readCount}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
