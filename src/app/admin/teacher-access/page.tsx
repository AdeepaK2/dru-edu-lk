'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Users, BookOpen, Check, X, AlertCircle } from 'lucide-react';
import { teacherAccessBankService } from '@/apiservices/teacherAccessBankService';
import { questionBankService } from '@/apiservices/questionBankFirestoreService';
import { QuestionBank } from '@/models/questionBankSchema';
import { TeacherAccessBank } from '@/models/teacherAccessBankSchema';
import { AccessLevel, getAvailableAccessLevels } from '@/utils/accessLevels';

// Mock teacher data - replace with actual teacher service
const mockTeachers = [
  { id: 'teacher_1', name: 'John Smith', email: 'john.smith@school.com' },
  { id: 'teacher_2', name: 'Jane Doe', email: 'jane.doe@school.com' },
  { id: 'teacher_3', name: 'Mike Johnson', email: 'mike.johnson@school.com' }
];

export default function TeacherAccessManagement() {
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [teacherAccess, setTeacherAccess] = useState<TeacherAccessBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [selectedQuestionBank, setSelectedQuestionBank] = useState<string>('');
  const [accessType, setAccessType] = useState<AccessLevel>('read');
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load question banks
      const banks = await questionBankService.listQuestionBanks();
      setQuestionBanks(banks);
      
      // Load all teacher access records (for display)
      // You might want to implement a method to get all access records
      console.log('✅ Loaded question banks:', banks.length);
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!selectedTeacher || !selectedQuestionBank) {
      alert('Please select both teacher and question bank');
      return;
    }

    try {
      setGranting(true);
      
      const teacher = mockTeachers.find(t => t.id === selectedTeacher);
      const questionBank = questionBanks.find(b => b.id === selectedQuestionBank);
      
      if (!teacher || !questionBank) {
        alert('Invalid teacher or question bank selection');
        return;
      }

      await teacherAccessBankService.grantAccess(
        teacher.id,
        teacher.name,
        teacher.email,
        questionBank.id,
        questionBank.name,
        questionBank.subjectId,
        questionBank.subjectName,
        accessType,
        'admin_user', // Replace with actual admin ID
        'Admin User', // Replace with actual admin name
        undefined, // No expiry
        `Access granted via admin panel`
      );

      alert(`Successfully granted ${accessType} access to ${teacher.name} for ${questionBank.name}`);
      
      // Reset form
      setSelectedTeacher('');
      setSelectedQuestionBank('');
      setAccessType('read');
      
    } catch (error) {
      console.error('Error granting access:', error);
      alert('Failed to grant access. Please check the console for details.');
    } finally {
      setGranting(false);
    }
  };

  const handleBulkGrantForSubject = async (subjectId: string) => {
    if (!confirm(`Grant read access to ALL teachers for ALL question banks in this subject?`)) {
      return;
    }

    try {
      const subjectBanks = questionBanks.filter(bank => bank.subjectId === subjectId);
      const subjectName = subjectBanks[0]?.subjectName || subjectId;
      
      console.log(`🔍 Bulk granting access for ${subjectBanks.length} banks in subject: ${subjectName}`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const teacher of mockTeachers) {
        for (const bank of subjectBanks) {
          try {
            await teacherAccessBankService.grantAccess(
              teacher.id,
              teacher.name,
              teacher.email,
              bank.id,
              bank.name,
              bank.subjectId,
              bank.subjectName,
              'read',
              'admin_user',
              'Admin User',
              undefined,
              `Bulk access granted for subject: ${subjectName}`
            );
            successCount++;
            console.log(`✅ ${teacher.name} -> ${bank.name}`);
          } catch (error) {
            errorCount++;
            console.warn(`❌ ${teacher.name} -> ${bank.name}:`, error);
          }
        }
      }
      
      alert(`Bulk access completed!\nSuccessful: ${successCount}\nErrors: ${errorCount}`);
      
    } catch (error) {
      console.error('Error in bulk grant:', error);
      alert('Bulk grant failed. Please check the console.');
    }
  };

  const checkTeacherAccess = async (teacherId: string) => {
    try {
      const accessBanks = await teacherAccessBankService.getAccessibleQuestionBanks(teacherId);
      const teacher = mockTeachers.find(t => t.id === teacherId);
      
      console.log(`🔍 Access for ${teacher?.name}:`);
      accessBanks.forEach(access => {
        console.log(`  - ${access.questionBankName} (${access.subjectName}) - ${access.accessType}`);
      });
      
      alert(`${teacher?.name} has access to ${accessBanks.length} question banks. Check console for details.`);
    } catch (error) {
      console.error('Error checking access:', error);
      alert('Failed to check access.');
    }
  };

  // Group question banks by subject
  const questionBanksBySubject = questionBanks.reduce((acc, bank) => {
    if (!acc[bank.subjectId]) {
      acc[bank.subjectId] = [];
    }
    acc[bank.subjectId].push(bank);
    return acc;
  }, {} as Record<string, QuestionBank[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-300 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Teacher Access Management
          </h1>
          <p className="text-gray-600">
            Manage teacher access to question banks. Use this to set up initial access permissions.
          </p>
        </div>

        {/* Grant Individual Access */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Grant Individual Access
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Teacher
              </label>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose teacher...</option>
                {mockTeachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Question Bank
              </label>
              <select
                value={selectedQuestionBank}
                onChange={(e) => setSelectedQuestionBank(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose question bank...</option>
                {questionBanks.map(bank => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name} ({bank.subjectName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Access Type
              </label>
              <select
                value={accessType}
                onChange={(e) => setAccessType(e.target.value as 'read' | 'write' | 'admin')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="read">Read Only</option>
                <option value="write">Read & Write</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleGrantAccess}
                disabled={granting || !selectedTeacher || !selectedQuestionBank}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {granting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Granting...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Grant Access
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Check Teacher Access</h3>
              <div className="space-y-2">
                {mockTeachers.map(teacher => (
                  <button
                    key={teacher.id}
                    onClick={() => checkTeacherAccess(teacher.id)}
                    className="w-full text-left px-3 py-2 border border-gray-200 rounded-md hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span>{teacher.name}</span>
                    <Users className="h-4 w-4 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Bulk Grant by Subject</h3>
              <div className="space-y-2">
                {Object.entries(questionBanksBySubject).map(([subjectId, banks]) => (
                  <button
                    key={subjectId}
                    onClick={() => handleBulkGrantForSubject(subjectId)}
                    className="w-full text-left px-3 py-2 border border-gray-200 rounded-md hover:bg-gray-50 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium">{banks[0]?.subjectName || subjectId}</span>
                      <span className="text-sm text-gray-500 ml-2">({banks.length} banks)</span>
                    </div>
                    <BookOpen className="h-4 w-4 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Question Banks Overview */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Question Banks Overview
          </h2>
          
          <div className="space-y-4">
            {Object.entries(questionBanksBySubject).map(([subjectId, banks]) => (
              <div key={subjectId} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <BookOpen className="h-5 w-5 mr-2" />
                  {banks[0]?.subjectName || subjectId} ({banks.length} banks)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {banks.map(bank => (
                    <div key={bank.id} className="bg-gray-50 rounded-md p-3">
                      <h4 className="font-medium text-sm text-gray-900 mb-1">
                        {bank.name}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {bank.totalQuestions} questions
                      </p>
                      <p className="text-xs text-gray-400">
                        ID: {bank.id}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Setup Instructions</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Use "Bulk Grant by Subject" to give all teachers read access to question banks by subject</li>
                <li>Use "Grant Individual Access" for specific teacher-bank combinations</li>
                <li>Use "Check Teacher Access" to verify what access a teacher has</li>
                <li>After setup, teachers will see their accessible question banks in the test creation modal</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
