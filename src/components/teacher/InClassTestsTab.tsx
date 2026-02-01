'use client';

import React, { useState, useEffect } from 'react';
import { Plus, FileText, Calendar, Clock, Lock, Eye, Trash2, Download } from 'lucide-react';
import { TestService } from '@/apiservices/testService';
import { Test, InClassTest } from '@/models/testSchema';
import { Timestamp } from 'firebase/firestore';
import CreateInClassTestModal from '@/components/modals/CreateInClassTestModal';
import { useToast } from '@/components/ui/ToastProvider';

interface InClassTestsTabProps {
  classId: string;
  className: string;
  classSubject: string; // "Subject" part of class data
}

export default function InClassTestsTab({ classId, className, classSubject }: InClassTestsTabProps) {
  const [tests, setTests] = useState<InClassTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    loadTests();
  }, [classId]);

  const loadTests = async () => {
    try {
      setLoading(true);
      // Fetch all tests for this class, then filter for 'in-class' type
      // Alternatively, add a specific query in TestService if performance is an issue
      // For now, assume fetching by class is fine
      const allTests = await TestService.getTestsByClass(classId);
      const inClassTests = allTests
        .filter((t: Test): t is InClassTest => t.type === 'in-class')
        .sort((a: InClassTest, b: InClassTest) => b.createdAt.toMillis() - a.createdAt.toMillis());
        
      setTests(inClassTests);
    } catch (error) {
      console.error('Error loading in-class tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestCreated = (newTest: Test) => {
    if (newTest.type === 'in-class') {
      setTests(prev => [newTest as InClassTest, ...prev]);
      showSuccess('In-class test scheduled successfully');
    }
    setShowCreateModal(false);
  };

  const handleDeleteTest = async (testId: string) => {
    if (!confirm('Are you sure you want to delete this test?')) return;
    try {
      await TestService.deleteTest(testId);
      setTests(prev => prev.filter(t => t.id !== testId));
      showSuccess('Test deleted successfully');
    } catch (error) {
      console.error('Error deleting test:', error);
      showError('Failed to delete test');
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">In-Class Tests</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Schedule offline tests or simple PDF submissions
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create In-Class Test
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-t-2 border-blue-600 border-solid rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading tests...</p>
        </div>
      ) : tests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No tests scheduled</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Create an in-class test to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tests.map(test => (
            <div 
              key={test.id}
              className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-3">
                  <span className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg">
                    <FileText className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                      {test.title}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500 space-x-4 mt-1">
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(test.scheduledStartTime)}
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {test.duration} mins
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 pl-14 pt-1">
                  <span className={`text-xs px-2 py-1 rounded-full border ${
                    test.submissionMethod === 'online_upload' 
                      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300'
                      : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300'
                  }`}>
                    {test.submissionMethod === 'online_upload' ? 'Student Upload' : 'Offline Collection'}
                  </span>
                  
                  {test.examPdfUrl && (
                    <a 
                      href={test.examPdfUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs flex items-center text-blue-600 hover:underline"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      View Paper
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3 mt-4 md:mt-0 pl-14 md:pl-0">
                <button
                  onClick={() => handleDeleteTest(test.id)}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete Test"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateInClassTestModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          classId={classId}
          className={className}
          subjectId={''} // Assuming not strictly needed or derived
          subjectName={classSubject}
          onTestCreated={handleTestCreated}
        />
      )}
    </div>
  );
}
