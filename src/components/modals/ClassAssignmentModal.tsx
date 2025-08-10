'use client';

import { useState, useEffect } from 'react';
import { X, Users, Search } from 'lucide-react';
import { QuestionBank } from '@/models/questionBankSchema';
import { ClassDocument } from '@/models/classSchema';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { Button } from '@/components/ui';

interface ClassAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionBank: QuestionBank;
  onAssignmentComplete: () => void;
}

export default function ClassAssignmentModal({
  isOpen,
  onClose,
  questionBank,
  onAssignmentComplete
}: ClassAssignmentModalProps) {
  const [classes, setClasses] = useState<ClassDocument[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    year: '',
    center: '',
    status: 'Active'
  });

  // Load classes when modal opens
  useEffect(() => {
    if (isOpen) {
      loadClasses();
    }
  }, [isOpen, filterOptions, searchTerm]);

  const loadClasses = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get all classes
      const allClasses = await ClassFirestoreService.getAllClasses();
      
      // Filter classes
      let filteredClasses = [...allClasses];
      
      // Filter by status
      if (filterOptions.status) {
        filteredClasses = filteredClasses.filter(c => c.status === filterOptions.status);
      }
      
      // Filter by year
      if (filterOptions.year) {
        filteredClasses = filteredClasses.filter(c => c.year === filterOptions.year);
      }
      
      // Filter by center
      if (filterOptions.center) {
        filteredClasses = filteredClasses.filter(c => c.centerId === filterOptions.center);
      }
      
      // Filter by search term
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        filteredClasses = filteredClasses.filter(c => 
          c.name.toLowerCase().includes(search) ||
          c.subject.toLowerCase().includes(search) ||
          c.classId.toLowerCase().includes(search)
        );
      }
      
      // Filter out classes that don't match the question bank's subject
      filteredClasses = filteredClasses.filter(c => 
        c.subjectId === questionBank.subjectId
      );
      
      setClasses(filteredClasses);
    } catch (err: any) {
      console.error("Error loading classes:", err);
      setError(`Error: ${err.message || 'Failed to load classes'}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle class selection
  const handleClassSelect = (classId: string, isSelected: boolean) => {
    setSelectedClasses(prev => 
      isSelected 
        ? [...prev, classId]
        : prev.filter(id => id !== classId)
    );
  };

  // Handle select all/none
  const handleSelectAll = () => {
    if (selectedClasses.length === classes.length) {
      setSelectedClasses([]);
    } else {
      setSelectedClasses(classes.map(c => c.id));
    }
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof typeof filterOptions, value: string) => {
    setFilterOptions(prev => ({
      ...prev,
      [key]: value === prev[key] ? '' : value
    }));
  };

  // Handle assignment
  const handleAssignToClasses = async () => {
    if (selectedClasses.length === 0) return;
    
    setAssignmentLoading(true);
    setError(null);
    
    try {
      // Here you would implement the actual assignment logic
      // This might involve creating assignments, tests, or homework records
      // For now, we'll just simulate the assignment
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // You could add assignment records to a separate collection like:
      // - assignments collection
      // - class_question_banks collection
      // - tests collection
      
      console.log(`Assigned question bank ${questionBank.id} to classes:`, selectedClasses);
      
      onAssignmentComplete();
      onClose();
      
    } catch (err: any) {
      console.error("Error assigning to classes:", err);
      setError(`Error: ${err.message || 'Failed to assign to classes'}`);
    } finally {
      setAssignmentLoading(false);
    }
  };

  if (!isOpen) return null;

  // Get unique years and centers for filters
  const availableYears = [...new Set(classes.map(c => c.year))].sort();
  const availableCenters = [...new Set(classes.map(c => c.centerId))].sort();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Assign to Classes</h2>
            <p className="text-sm text-gray-600 mt-1">
              Assign "{questionBank.name}" to classes
            </p>
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-md p-3 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Search and Filters */}
        <div className="p-6 border-b border-gray-200 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search classes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="flex space-x-2">
              {availableYears.map(year => (
                <button
                  key={year}
                  onClick={() => handleFilterChange('year', year)}
                  className={`px-3 py-1 rounded-md text-sm ${
                    filterOptions.year === year
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
            
            <div className="flex space-x-2">
              {availableCenters.map(center => (
                <button
                  key={center}
                  onClick={() => handleFilterChange('center', center)}
                  className={`px-3 py-1 rounded-md text-sm ${
                    filterOptions.center === center
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Center {center}
                </button>
              ))}
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => handleFilterChange('status', 'Active')}
                className={`px-3 py-1 rounded-md text-sm ${
                  filterOptions.status === 'Active'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => handleFilterChange('status', 'Inactive')}
                className={`px-3 py-1 rounded-md text-sm ${
                  filterOptions.status === 'Inactive'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Inactive
              </button>
            </div>
            
            {(filterOptions.year || filterOptions.center || searchTerm) && (
              <button
                onClick={() => {
                  setFilterOptions({ year: '', center: '', status: 'Active' });
                  setSearchTerm('');
                }}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {!loading && classes.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No classes found</h3>
              <p className="text-gray-500">
                No classes match your current filters for the subject "{questionBank.subjectName}".
              </p>
            </div>
          )}

          {!loading && classes.length > 0 && (
            <>
              <div className="mb-4 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">
                    {classes.length} classes available for "{questionBank.subjectName}"
                    {selectedClasses.length > 0 && (
                      <span className="ml-2 font-medium">
                        ({selectedClasses.length} selected)
                      </span>
                    )}
                  </p>
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectedClasses.length === classes.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  
                  {selectedClasses.length > 0 && (
                    <Button
                      variant="primary"
                      onClick={handleAssignToClasses}
                      disabled={assignmentLoading}
                      className="flex items-center space-x-2"
                    >
                      {assignmentLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Assigning...</span>
                        </>
                      ) : (
                        <span>Assign to Selected ({selectedClasses.length})</span>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {classes.map((classItem) => (
                  <div
                    key={classItem.id}
                    className={`border border-gray-200 rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedClasses.includes(classItem.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => handleClassSelect(
                      classItem.id,
                      !selectedClasses.includes(classItem.id)
                    )}
                  >
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(classItem.id)}
                        onChange={(e) => handleClassSelect(classItem.id, e.target.checked)}
                        className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="font-medium text-gray-900">{classItem.name}</h3>
                            <p className="text-sm text-gray-600">
                              {classItem.classId} • {classItem.subject} • {classItem.year}
                            </p>
                          </div>
                          
                          <div className="flex space-x-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              classItem.status === 'Active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {classItem.status}
                            </span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                              Center {classItem.centerId}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <span>{classItem.enrolledStudents} students enrolled</span>
                          <span>Fee: ${classItem.sessionFee}/session</span>
                        </div>
                        
                        {classItem.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                            {classItem.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
