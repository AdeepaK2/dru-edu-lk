'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, FileText, Calendar, Clock, Lock, Eye, Trash2, Download, Edit3, Search, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { TestService } from '@/apiservices/testService';
import { Test, InClassTest } from '@/models/testSchema';
import { Timestamp } from 'firebase/firestore';
import CreateInClassTestModal from '@/components/modals/CreateInClassTestModal';
import GradeInClassTestModal from '@/components/teacher/GradeInClassTestModal';
import { useToast } from '@/components/ui/ToastProvider';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';

interface InClassTestsTabProps {
  classId: string;
  className: string;
  classSubject: string; // "Subject" part of class data
}

type SortOption = 'date-desc' | 'date-asc' | 'title-asc' | 'title-desc';

const ITEMS_PER_PAGE = 5;

export default function InClassTestsTab({ classId, className, classSubject }: InClassTestsTabProps) {
  const [tests, setTests] = useState<InClassTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTestForGrading, setSelectedTestForGrading] = useState<InClassTest | null>(null);
  const { showSuccess, showError } = useToast();
  const { teacher } = useTeacherAuth();

  // Filter & Sort & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

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
        .filter((t: Test): t is InClassTest => t.type === 'in-class');
        
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

  // Filter and Sort Logic
  const processedTests = useMemo(() => {
    let filtered = [...tests];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(test => 
        test.title.toLowerCase().includes(query)
      );
    }

    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'date-desc':
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        case 'date-asc':
          return a.createdAt.toMillis() - b.createdAt.toMillis();
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

    return filtered;
  }, [tests, searchQuery, sortOption]);

  // Pagination Logic
  const totalPages = Math.ceil(processedTests.length / ITEMS_PER_PAGE);
  const paginatedTests = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedTests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [processedTests, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortOption]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">In-Class Tests</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Schedule offline tests or simple PDF submissions
          </p>
        </div>
        <button
          onClick={() => {
            console.log('Create In-Class Test button clicked!');
            setShowCreateModal(true);
          }}
          className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full md:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create In-Class Test
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex gap-2">
            <button
               onClick={() => setShowFilters(!showFilters)}
               className={`md:hidden p-2 rounded-lg border ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-600'}`}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
            
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className={`${showFilters ? 'block' : 'hidden'} md:block w-full md:w-48 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="title-asc">Title (A-Z)</option>
              <option value="title-desc">Title (Z-A)</option>
            </select>
          </div>
        </div>
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
      ) : processedTests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No matching tests found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            {paginatedTests.map(test => (
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
                    onClick={() => setSelectedTestForGrading(test)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                    title="Grade Test"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Grade
                  </button>
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, processedTests.length)} of {processedTests.length} tests
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(() => {
        console.log('showCreateModal state:', showCreateModal);
        return showCreateModal && (
          <CreateInClassTestModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            classId={classId}
            className={className}
            subjectId={''} // Assuming not strictly needed or derived
            subjectName={classSubject}
            onTestCreated={handleTestCreated}
          />
        );
      })()}

      {selectedTestForGrading && teacher && (
        <GradeInClassTestModal
          isOpen={true}
          onClose={() => setSelectedTestForGrading(null)}
          test={selectedTestForGrading as Test}
          teacherId={teacher.id}
        />
      )}
    </div>
  );
}
