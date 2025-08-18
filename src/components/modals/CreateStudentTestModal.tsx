'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Users, 
  UserPlus,
  Settings,
  Clock,
  Calendar,
  BookOpen,
  AlertCircle,
  Check,
  FileText,
  Eye,
  RefreshCw
} from 'lucide-react';
import { TestType, TestConfig, QuestionSelectionMethod } from '@/models/testSchema';
import { QuestionBank } from '@/models/questionBankSchema';
import { 
  SelectableStudent, 
  StudentAssignmentSummary, 
  TestAssignmentConfig,
  StudentTestAssignment 
} from '@/models/testAssignmentSchema';
import { ClassDocument } from '@/models/classSchema';
import { TestService } from '@/apiservices/testService';
import { LessonFirestoreService } from '@/apiservices/lessonFirestoreService';
import { questionService } from '@/apiservices/questionBankFirestoreService';
import { TestNumberingService } from '@/apiservices/testNumberingService';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import StudentSelectionModal from './StudentSelectionModal';
import { Timestamp } from 'firebase/firestore';

interface CreateStudentTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCreated: (test: any) => void;
  subjectId: string;
  subjectName: string;
  teacherClasses: ClassDocument[];
  questionBanks: QuestionBank[];
}

// Form data structure (similar to CreateTestModal but with student assignment)
interface StudentTestFormData {
  // Step 1: Basic Info & Type
  title: string;
  description: string;
  instructions: string;
  type: TestType | '';
  questionType: 'mcq' | 'essay' | '';

  // Step 2: Student Selection
  selectedStudents: SelectableStudent[];
  assignmentSummary: StudentAssignmentSummary | null;
  assignmentNotes: string;

  // Step 3: Timing & Duration
  // For flexible tests
  availableFrom: string;
  availableTo: string;
  duration: number;
  attemptsAllowed: number;
  
  // For live tests
  scheduledStartTime: string;
  bufferTime: number;

  // Step 4: Question Selection
  questionSelectionMethod: QuestionSelectionMethod | '';
  totalQuestions: number;
  selectedQuestionBankId: string;
  selectedQuestions: any[];
  selectedLessonIds: string[];

  // Step 5: Preview (for auto-selection)
  // No additional form data needed

  // Step 6: Final Configuration
  shuffleQuestions: boolean;
  allowReviewBeforeSubmit: boolean;
  passingScore: number;
  showResultsImmediately: boolean;
}

const INITIAL_FORM_DATA: StudentTestFormData = {
  title: '',
  description: '',
  instructions: '',
  type: '',
  questionType: '',
  
  selectedStudents: [],
  assignmentSummary: null,
  assignmentNotes: '',
  
  availableFrom: '',
  availableTo: '',
  duration: 60,
  attemptsAllowed: 1,
  
  scheduledStartTime: '',
  bufferTime: 5,
  
  questionSelectionMethod: '',
  totalQuestions: 10,
  selectedQuestionBankId: '',
  selectedQuestions: [],
  selectedLessonIds: [],
  
  shuffleQuestions: true,
  allowReviewBeforeSubmit: true,
  passingScore: 50,
  showResultsImmediately: false,
};

export default function CreateStudentTestModal({
  isOpen,
  onClose,
  onTestCreated,
  subjectId,
  subjectName,
  teacherClasses,
  questionBanks
}: CreateStudentTestModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<StudentTestFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStudentSelection, setShowStudentSelection] = useState(false);
  
  // Get current teacher from auth context
  const { teacher } = useTeacherAuth();

  // Additional state for question loading
  const [lessons, setLessons] = useState<any[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Preview state for auto-selected questions
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const totalSteps = 6; // Updated to 6 steps (added preview step)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData(INITIAL_FORM_DATA);
      setCurrentStep(1);
      setErrors({});
      // Preload lessons when modal opens
      loadLessons();
    }
  }, [isOpen]);

  // Auto-set showResultsImmediately based on question type
  useEffect(() => {
    if (formData.questionType) {
      const shouldShowResults = formData.questionType === 'mcq';
      if (formData.showResultsImmediately !== shouldShowResults) {
        updateFormData({ showResultsImmediately: shouldShowResults });
      }
    }
  }, [formData.questionType, formData.showResultsImmediately]);


  // Load lessons when question bank or selection method changes (for auto selection)
  useEffect(() => {
    if (formData.selectedQuestionBankId && formData.questionSelectionMethod === 'auto') {
      loadLessons();
    }
  }, [formData.selectedQuestionBankId, formData.questionSelectionMethod]);

  // Load questions when question bank is selected for manual selection
  useEffect(() => {
    if (formData.selectedQuestionBankId && formData.questionSelectionMethod === 'manual') {
      loadQuestions();
    }
  }, [formData.selectedQuestionBankId, formData.questionSelectionMethod, formData.questionType]);

  const updateFormData = (updates: Partial<StudentTestFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    const updatedFields = Object.keys(updates);
    setErrors(prev => {
      const newErrors = { ...prev };
      updatedFields.forEach(field => delete newErrors[field]);
      return newErrors;
    });
  };

  const loadLessons = async () => {
    try {
      setLoadingLessons(true);
      
      // If a specific question bank is selected, use its subject for lessons
      let targetSubjectId = subjectId; // Default to current subject
      
      if (formData.selectedQuestionBankId) {
        const selectedBank = questionBanks.find(bank => bank.id === formData.selectedQuestionBankId);
        if (selectedBank) {
          targetSubjectId = selectedBank.subjectId;
          
          console.log('📚 Loading lessons for student test from question bank:', {
            bankName: selectedBank.name,
            bankSubject: selectedBank.subjectName,
            targetSubjectId,
            currentSubjectId: subjectId,
            isDifferentSubject: targetSubjectId !== subjectId
          });
        }
      }
      
      const lessonsData = await LessonFirestoreService.getLessonsBySubject(targetSubjectId);
      
      console.log(`✅ Loaded ${lessonsData.length} lessons for student test`);
      setLessons(lessonsData);
      
    } catch (error) {
      console.error('Error loading lessons:', error);
      setLessons([]); // Ensure lessons is set to empty array on error
    } finally {
      setLoadingLessons(false);
    }
  };

  const loadQuestions = async () => {
    if (!formData.selectedQuestionBankId) return;
    
    try {
      setLoadingQuestions(true);
      
      const selectedBank = questionBanks.find(bank => bank.id === formData.selectedQuestionBankId);
      if (!selectedBank || !selectedBank.questionIds || selectedBank.questionIds.length === 0) {
        setAvailableQuestions([]);
        return;
      }
      
      const questionsData = await Promise.all(
        selectedBank.questionIds.map(id => questionService.getQuestion(id))
      );
      
      let validQuestions = questionsData.filter(q => q !== null) as any[];
      
      if (formData.questionType) {
        validQuestions = validQuestions.filter(q => q.type === formData.questionType);
      }
      
      setAvailableQuestions(validQuestions);
    } catch (error) {
      console.error('Error loading questions:', error);
      setAvailableQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1: // Basic Info & Type
        if (!formData.title.trim()) newErrors.title = 'Test title is required';
        if (!formData.type) newErrors.type = 'Test type is required';
        if (!formData.questionType) newErrors.questionType = 'Question type is required';
        break;
        
      case 2: // Student Selection
        if (formData.selectedStudents.length === 0) {
          newErrors.selectedStudents = 'Please select at least one student';
        }
        break;
        
      case 3: // Timing & Duration
        if (formData.type === 'flexible') {
          if (!formData.availableFrom) newErrors.availableFrom = 'Start date is required';
          if (!formData.availableTo) newErrors.availableTo = 'End date is required';
          if (formData.duration <= 0) newErrors.duration = 'Duration must be greater than 0';
          
          if (formData.availableFrom && formData.availableTo) {
            const startDate = new Date(formData.availableFrom);
            const endDate = new Date(formData.availableTo);
            if (endDate <= startDate) {
              newErrors.availableTo = 'End date must be after start date';
            }
          }
        } else if (formData.type === 'live') {
          if (!formData.scheduledStartTime) newErrors.scheduledStartTime = 'Start time is required';
          if (formData.duration <= 0) newErrors.duration = 'Duration must be greater than 0';
          
          if (formData.scheduledStartTime) {
            const startTime = new Date(formData.scheduledStartTime);
            if (startTime <= new Date()) {
              newErrors.scheduledStartTime = 'Start time must be in the future';
            }
          }
        }
        break;
        
      case 4: // Question Selection
        if (!formData.questionSelectionMethod) newErrors.questionSelectionMethod = 'Question selection method is required';
        if (!formData.totalQuestions || formData.totalQuestions <= 0) newErrors.totalQuestions = 'Number of questions must be greater than 0';
        
        // Both methods require question bank selection
        if (!formData.selectedQuestionBankId) {
          newErrors.selectedQuestionBankId = 'Please select a question bank';
        }
        
        if (formData.questionSelectionMethod === 'auto') {
          if (formData.selectedLessonIds.length === 0) {
            newErrors.selectedLessonIds = 'Please select at least one lesson for auto selection';
          }
        }
        break;
        
      case 5: // Preview (only for auto-selection)
        // No validation needed for preview step
        break;
        
      case 6: // Final Configuration
        // Validate passing score
        if (formData.passingScore < 0 || formData.passingScore > 100) {
          newErrors.passingScore = 'Passing score must be between 0 and 100';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      // If moving from step 4 to step 5 and using auto-selection, generate preview
      if (currentStep === 4 && formData.questionSelectionMethod === 'auto') {
        generatePreviewQuestions();
        setCurrentStep(5);
      } else if (currentStep === 4 && formData.questionSelectionMethod === 'manual') {
        // Skip preview step for manual selection
        setCurrentStep(6);
      } else {
        setCurrentStep(prev => Math.min(prev + 1, totalSteps));
      }
    }
  };

  const handlePrevious = () => {
    // Handle going back from step 6 to step 4 if we skipped preview
    if (currentStep === 6 && formData.questionSelectionMethod === 'manual') {
      setCurrentStep(4);
    } else {
      setCurrentStep(prev => Math.max(prev - 1, 1));
    }
  };

  // Generate preview questions for auto-selection
  const generatePreviewQuestions = async () => {
    if (!formData.selectedQuestionBankId || formData.selectedLessonIds.length === 0 || !formData.totalQuestions) {
      return;
    }

    setLoadingPreview(true);
    setPreviewError(null);
    
    try {
      const selectedBank = questionBanks.find(bank => bank.id === formData.selectedQuestionBankId);
      if (!selectedBank) {
        throw new Error('Selected question bank not found');
      }

      // Create minimal test config for auto-selection
      const testConfig: TestConfig = {
        questionSelectionMethod: formData.questionSelectionMethod as QuestionSelectionMethod,
        questionType: formData.questionType as 'mcq' | 'essay',
        totalQuestions: formData.totalQuestions,
        shuffleQuestions: formData.shuffleQuestions,
        allowReviewBeforeSubmit: formData.allowReviewBeforeSubmit,
        passingScore: formData.passingScore,
        showResultsImmediately: formData.showResultsImmediately,
      };

      const questionBankSelection = {
        bankId: formData.selectedQuestionBankId,
        bankName: selectedBank.name,
        lessonIds: formData.selectedLessonIds,
        questionCount: formData.totalQuestions,
        difficultyDistribution: undefined // Use default distribution
      };

      console.log('🎯 Generating preview questions for student test with config:', {
        testConfig,
        questionBankSelection
      });

      const autoSelectedQuestions = await TestService.autoSelectQuestions(
        [questionBankSelection],
        testConfig
      );

      if (autoSelectedQuestions.length === 0) {
        throw new Error(`No questions found for the selected lessons. Please check if questions exist for the selected lessons in ${selectedBank.subjectName}.`);
      }

      console.log('✅ Preview questions generated for student test:', autoSelectedQuestions.length);
      setPreviewQuestions(autoSelectedQuestions);

    } catch (error) {
      console.error('Error generating preview questions:', error);
      setPreviewError(error instanceof Error ? error.message : 'Failed to generate preview');
      setPreviewQuestions([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleStudentSelection = () => {
    setShowStudentSelection(true);
  };

  const handleStudentsSelected = (assignments: StudentTestAssignment[], summary: StudentAssignmentSummary) => {
    // Convert assignments back to SelectableStudent format for our form
    const selectedStudents: SelectableStudent[] = assignments.map(assignment => ({
      id: assignment.studentId,
      name: assignment.studentName,
      email: assignment.studentEmail,
      enrollmentId: '', // We don't have this from assignments
      classId: assignment.classId,
      className: assignment.className,
      classSubject: '', // We don't have this from assignments
      enrollmentStatus: 'active' as const,
      enrolledAt: assignment.assignedAt,
      isSelected: true,
      isEligible: true
    }));

    updateFormData({
      selectedStudents: selectedStudents,
      assignmentSummary: summary
    });
    setShowStudentSelection(false);
  };

  const handleCreateTest = async () => {
    if (!validateStep(currentStep)) return;

    try {
      setIsSubmitting(true);

      // Build test configuration
      const testConfig: TestConfig = {
        questionSelectionMethod: formData.questionSelectionMethod as QuestionSelectionMethod,
        questionType: formData.questionType as 'mcq' | 'essay',
        totalQuestions: formData.totalQuestions,
        shuffleQuestions: formData.shuffleQuestions,
        allowReviewBeforeSubmit: formData.allowReviewBeforeSubmit,
        passingScore: formData.passingScore,
        showResultsImmediately: formData.showResultsImmediately,
      };

      // Calculate total marks
      const totalMarks = formData.selectedQuestions && formData.selectedQuestions.length > 0
        ? formData.selectedQuestions.reduce((sum, q) => sum + (q.points || 1), 0)
        : formData.totalQuestions * 1;

      // Create student assignments
      const studentAssignments: StudentTestAssignment[] = formData.selectedStudents.map(student => ({
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        classId: student.classId,
        className: student.className,
        assignedAt: Timestamp.now(),
        assignedBy: teacher?.id || '',
        status: 'assigned',
        notificationSent: false
      }));

      // Build assignment configuration
      const assignmentConfig: TestAssignmentConfig = {
        classIds: [], // Empty for student-selected tests
        classNames: [],
        assignmentType: 'student-based',
        individualAssignments: studentAssignments,
        totalAssignedStudents: formData.selectedStudents.length,
        assignmentDate: Timestamp.now(),
        assignmentNotes: formData.assignmentNotes || undefined
      };

      // Build base test data
      const baseTestData = {
        title: formData.title,
        description: formData.description || '',
        instructions: formData.instructions || '',
        teacherId: teacher?.id || '',
        teacherName: teacher?.name || '',
        subjectId: subjectId || '',
        subjectName: subjectName || '',
        
        // For student-selected tests, we include all involved class IDs for reference
        classIds: Array.from(new Set(formData.selectedStudents.map(s => s.classId))),
        classNames: Array.from(new Set(formData.selectedStudents.map(s => s.className))),
        
        config: testConfig,
        questions: formData.selectedQuestions || [],
        totalMarks: totalMarks,
        status: 'draft' as const,
        
        // Add assignment configuration
        assignmentConfig
      };

      // Create type-specific test data
      let testData;
      if (formData.type === 'flexible') {
        testData = {
          ...baseTestData,
          type: 'flexible' as const,
          availableFrom: Timestamp.fromDate(new Date(formData.availableFrom)),
          availableTo: Timestamp.fromDate(new Date(formData.availableTo)),
          duration: formData.duration,
          attemptsAllowed: formData.attemptsAllowed,
        };
      } else {
        // Live test
        const startTime = new Date(formData.scheduledStartTime);
        const studentJoinTime = new Date(startTime.getTime());
        const endTime = new Date(startTime.getTime() + (formData.duration + formData.bufferTime) * 60 * 1000);

        testData = {
          ...baseTestData,
          type: 'live' as const,
          scheduledStartTime: Timestamp.fromDate(startTime),
          duration: formData.duration,
          bufferTime: formData.bufferTime,
          studentJoinTime: Timestamp.fromDate(studentJoinTime),
          actualEndTime: Timestamp.fromDate(endTime),
          isLive: false,
          studentsOnline: 0,
          studentsCompleted: 0,
        };
      }

      // Handle question selection if auto
      if (formData.questionSelectionMethod === 'auto' && formData.selectedLessonIds.length > 0) {
        try {
          const selectedBank = questionBanks.find(bank => bank.id === formData.selectedQuestionBankId);
          if (!selectedBank) {
            throw new Error('Selected question bank not found');
          }
          
          const questionBankSelection = {
            bankId: formData.selectedQuestionBankId,
            bankName: selectedBank.name,
            lessonIds: formData.selectedLessonIds,
            questionCount: formData.totalQuestions,
            difficultyDistribution: undefined
          };
          
          const autoSelectedQuestions = await TestService.autoSelectQuestions(
            [questionBankSelection],
            testConfig
          );
          
          if (autoSelectedQuestions.length === 0) {
            throw new Error('No questions found matching your criteria');
          }
          
          // Update test data with auto-selected questions
          testData.questions = autoSelectedQuestions;
          testData.totalMarks = autoSelectedQuestions.reduce((sum, q) => sum + (q.points || 1), 0);
        } catch (autoSelectError) {
          console.error('Error auto-selecting questions:', autoSelectError);
          alert('Failed to auto-select questions. Please try manual selection or adjust criteria.');
          return;
        }
      }

      // Clean undefined values
      const removeUndefined = (obj: any): any => {
        if (obj === null || obj === undefined) return null;
        if (Array.isArray(obj)) return obj.map(removeUndefined).filter(item => item !== undefined);
        if (typeof obj === 'object') {
          const cleaned: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
              cleaned[key] = removeUndefined(value);
            }
          }
          return cleaned;
        }
        return obj;
      };

      const finalTestData = removeUndefined(testData);

      // Create the test
      const testId = await TestService.createTest(finalTestData as any);

      console.log('Student-selected test created successfully:', testId);
      onTestCreated({ ...testData, id: testId });
      onClose();
      
    } catch (error) {
      console.error('Error creating student-selected test:', error);
      alert('Failed to create test. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setFormData(INITIAL_FORM_DATA);
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Create Test for Selected Students
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Step {currentStep} of {totalSteps}
                {formData.selectedStudents.length > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {formData.selectedStudents.length} student{formData.selectedStudents.length !== 1 ? 's' : ''} selected
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 h-1">
            <div 
              className="bg-blue-600 h-1 transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>

          {/* Step Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            
            {/* Step 1: Basic Information & Test Type */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-6">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Basic Information</h3>
                    <p className="text-sm text-gray-500">Set up the test details and type</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Test Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => updateFormData({ title: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        errors.title ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter test title..."
                    />
                    {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => updateFormData({ description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Optional description..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Test Type *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => updateFormData({ type: e.target.value as TestType })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        errors.type ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select test type</option>
                      <option value="live">Live Test (Scheduled)</option>
                      <option value="flexible">Flexible Test (Time Window)</option>
                    </select>
                    {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Question Type *
                    </label>
                    <select
                      value={formData.questionType}
                      onChange={(e) => updateFormData({ questionType: e.target.value as 'mcq' | 'essay' })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        errors.questionType ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select question type</option>
                      <option value="mcq">Multiple Choice Questions</option>
                      <option value="essay">Essay Questions</option>
                    </select>
                    {errors.questionType && <p className="text-red-500 text-sm mt-1">{errors.questionType}</p>}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Instructions for Students
                    </label>
                    <textarea
                      value={formData.instructions}
                      onChange={(e) => updateFormData({ instructions: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Enter instructions for students..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Student Selection */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-6">
                  <Users className="w-8 h-8 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Select Students</h3>
                    <p className="text-sm text-gray-500">Choose specific students from your classes</p>
                  </div>
                </div>

                {formData.selectedStudents.length === 0 ? (
                  <div className="text-center py-12">
                    <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Students Selected</h3>
                    <p className="text-gray-500 mb-6">Select students from your classes to assign this test</p>
                    <button
                      onClick={handleStudentSelection}
                      className="flex items-center space-x-2 mx-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <UserPlus className="w-5 h-5" />
                      <span>Select Students</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Selected Students Summary */}
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Check className="w-5 h-5 text-green-600" />
                          <span className="font-medium text-green-900 dark:text-green-200">
                            {formData.selectedStudents.length} student{formData.selectedStudents.length !== 1 ? 's' : ''} selected
                          </span>
                        </div>
                        <button
                          onClick={handleStudentSelection}
                          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                        >
                          Change Selection
                        </button>
                      </div>

                      {/* Class Distribution */}
                      {formData.assignmentSummary && (
                        <div className="mt-3">
                          <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                            Distribution across {Object.keys(formData.assignmentSummary.byClass).length} class{Object.keys(formData.assignmentSummary.byClass).length !== 1 ? 'es' : ''}:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(formData.assignmentSummary.byClass).map(([className, classData]) => (
                              <span
                                key={className}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200"
                              >
                                {classData.className}: {classData.studentCount}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Assignment Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Assignment Notes (Optional)
                      </label>
                      <textarea
                        value={formData.assignmentNotes}
                        onChange={(e) => updateFormData({ assignmentNotes: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="Add any notes about this assignment..."
                      />
                    </div>
                  </div>
                )}

                {errors.selectedStudents && (
                  <p className="text-red-500 text-sm mt-2">{errors.selectedStudents}</p>
                )}
              </div>
            )}

            {/* Step 3: Timing & Duration Configuration */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-6">
                  <Clock className="w-8 h-8 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Timing & Duration</h3>
                    <p className="text-sm text-gray-500">Configure when and how long students can take the test</p>
                  </div>
                </div>

                {formData.type === 'flexible' ? (
                  // Flexible Test Configuration
                  <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <h4 className="font-medium text-blue-900 dark:text-blue-200">Flexible Test Window</h4>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Students can start the test anytime within the specified time window.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Available From *
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.availableFrom}
                          onChange={(e) => updateFormData({ availableFrom: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                            errors.availableFrom ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.availableFrom && <p className="text-red-500 text-sm mt-1">{errors.availableFrom}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Available Until *
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.availableTo}
                          onChange={(e) => updateFormData({ availableTo: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                            errors.availableTo ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.availableTo && <p className="text-red-500 text-sm mt-1">{errors.availableTo}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Duration (minutes) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="600"
                          value={formData.duration}
                          onChange={(e) => updateFormData({ duration: parseInt(e.target.value) || 0 })}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                            errors.duration ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="60"
                        />
                        {errors.duration && <p className="text-red-500 text-sm mt-1">{errors.duration}</p>}
                        <p className="text-xs text-gray-500 mt-1">How long each student has to complete the test</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Attempts Allowed *
                        </label>
                        <select
                          value={formData.attemptsAllowed}
                          onChange={(e) => updateFormData({ attemptsAllowed: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option value={1}>1 attempt</option>
                          <option value={2}>2 attempts</option>
                          <option value={3}>3 attempts</option>
                          <option value={5}>5 attempts</option>
                          <option value={999}>Unlimited</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">How many times each student can take the test</p>
                      </div>
                    </div>
                  </div>
                ) : formData.type === 'live' ? (
                  // Live Test Configuration
                  <div className="space-y-6">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Clock className="w-5 h-5 text-green-600" />
                        <h4 className="font-medium text-green-900 dark:text-green-200">Live/Scheduled Test</h4>
                      </div>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        All students will start the test at the same scheduled time.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Scheduled Start Time *
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.scheduledStartTime}
                          onChange={(e) => updateFormData({ scheduledStartTime: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                            errors.scheduledStartTime ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.scheduledStartTime && <p className="text-red-500 text-sm mt-1">{errors.scheduledStartTime}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Duration (minutes) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="600"
                          value={formData.duration}
                          onChange={(e) => updateFormData({ duration: parseInt(e.target.value) || 0 })}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                            errors.duration ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="60"
                        />
                        {errors.duration && <p className="text-red-500 text-sm mt-1">{errors.duration}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Buffer Time (minutes)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="60"
                          value={formData.bufferTime}
                          onChange={(e) => updateFormData({ bufferTime: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          placeholder="5"
                        />
                        <p className="text-xs text-gray-500 mt-1">Extra time for late joiners (0-60 minutes)</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Attempts Allowed
                        </label>
                        <select
                          value={formData.attemptsAllowed}
                          onChange={(e) => updateFormData({ attemptsAllowed: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option value={1}>1 attempt (recommended)</option>
                          <option value={2}>2 attempts</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Live tests typically allow only 1 attempt</p>
                      </div>
                    </div>

                    {/* Live Test Info */}
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-amber-900 dark:text-amber-200 mb-1">Live Test Guidelines</h4>
                          <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                            <li>• All selected students will receive notifications before the test starts</li>
                            <li>• Students must join within the buffer time after the scheduled start</li>
                            <li>• The test automatically ends for all students after the duration expires</li>
                            <li>• Late submissions will not be accepted</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // No test type selected
                  <div className="text-center py-12">
                    <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select Test Type First</h3>
                    <p className="text-gray-500">Go back to Step 1 and select a test type to configure timing settings</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Question Selection */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-6">
                  <BookOpen className="w-8 h-8 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Question Selection</h3>
                    <p className="text-sm text-gray-500">Choose how questions will be selected for this test</p>
                  </div>
                </div>

                {/* Question Selection Method */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 dark:text-white">Selection Method</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      {
                        method: 'manual' as QuestionSelectionMethod,
                        title: 'Manual Selection',
                        description: 'Hand-pick specific questions',
                        recommended: false
                      },
                      {
                        method: 'auto' as QuestionSelectionMethod,
                        title: 'Auto Selection',
                        description: 'Automatically select from lessons',
                        recommended: true
                      }
                    ].map((option) => (
                      <div
                        key={option.method}
                        className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          formData.questionSelectionMethod === option.method
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                        onClick={() => updateFormData({ questionSelectionMethod: option.method })}
                      >
                        {option.recommended && (
                          <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                            Recommended
                          </span>
                        )}
                        <div className="text-center">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-1">{option.title}</h5>
                          <p className="text-sm text-gray-500">{option.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {errors.questionSelectionMethod && (
                    <p className="text-red-500 text-sm">{errors.questionSelectionMethod}</p>
                  )}
                </div>

                {/* Total Questions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Total Questions *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.totalQuestions || ''}
                      onChange={(e) => updateFormData({ totalQuestions: parseInt(e.target.value) || 0 })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        errors.totalQuestions ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="20"
                    />
                    {errors.totalQuestions && <p className="text-red-500 text-sm mt-1">{errors.totalQuestions}</p>}
                  </div>
                </div>

                {/* Method-specific Configuration */}
                {formData.questionSelectionMethod === 'auto' && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Automatic Selection</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Questions will be randomly selected from the chosen question bank and lessons with a balanced mix of difficulty levels.
                      </p>
                    </div>

                    {/* Question Bank Selection for Auto */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Question Bank *
                      </label>
                      <select
                        value={formData.selectedQuestionBankId}
                        onChange={(e) => updateFormData({ selectedQuestionBankId: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          errors.selectedQuestionBankId ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select a question bank</option>
                        {questionBanks.map((bank) => (
                          <option key={bank.id} value={bank.id}>
                            {bank.name} ({bank.totalQuestions || bank.questionIds?.length || 0} questions)
                          </option>
                        ))}
                      </select>
                      {errors.selectedQuestionBankId && (
                        <p className="text-red-500 text-sm mt-1">{errors.selectedQuestionBankId}</p>
                      )}
                    </div>

                    {/* Lesson Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select Lessons *
                      </label>
                      
                      {/* Subject Cross-Reference Info */}
                      {formData.selectedQuestionBankId && (() => {
                        const selectedBank = questionBanks.find(bank => bank.id === formData.selectedQuestionBankId);
                        const isDifferentSubject = selectedBank && selectedBank.subjectId !== subjectId;
                        
                        if (isDifferentSubject) {
                          return (
                            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                              <div className="flex items-start space-x-3">
                                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                    Cross-Subject Question Bank Selected
                                  </h4>
                                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                                    You've selected <strong>{selectedBank.name}</strong> from <strong>{selectedBank.subjectName}</strong>. 
                                    The lessons below are from this question bank's subject, not your current class subject ({subjectName}).
                                  </p>
                                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
                                    💡 This is useful for placement tests, skill assessments, or cross-grade evaluations.
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {loadingLessons ? (
                        <div className="text-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                        </div>
                      ) : lessons.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-500">No lessons available for this subject</p>
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                          {lessons.map((lesson) => (
                            <div
                              key={lesson.id}
                              className="flex items-center p-3 border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                            >
                              <input
                                type="checkbox"
                                id={`lesson-${lesson.id}`}
                                checked={formData.selectedLessonIds.includes(lesson.id)}
                                onChange={(e) => {
                                  const lessonIds = e.target.checked
                                    ? [...formData.selectedLessonIds, lesson.id]
                                    : formData.selectedLessonIds.filter(id => id !== lesson.id);
                                  updateFormData({ selectedLessonIds: lessonIds });
                                }}
                                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label 
                                htmlFor={`lesson-${lesson.id}`}
                                className="flex-1 cursor-pointer"
                              >
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {lesson.name || lesson.title}
                                </div>
                                {lesson.description && (
                                  <div className="text-sm text-gray-500">
                                    {lesson.description}
                                  </div>
                                )}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                      {errors.selectedLessonIds && (
                        <p className="text-red-500 text-sm mt-1">{errors.selectedLessonIds}</p>
                      )}
                    </div>
                  </div>
                )}

                {formData.questionSelectionMethod === 'manual' && (
                  <div className="space-y-6">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <h4 className="font-medium text-yellow-900 dark:text-yellow-200 mb-2">Manual Selection</h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        You will be able to hand-pick specific questions from your question banks.
                      </p>
                    </div>

                    {/* Question Bank Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Question Bank *
                      </label>
                      <select
                        value={formData.selectedQuestionBankId}
                        onChange={(e) => updateFormData({ selectedQuestionBankId: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          errors.selectedQuestionBankId ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select a question bank</option>
                        {questionBanks.map((bank) => (
                          <option key={bank.id} value={bank.id}>
                            {bank.name} ({bank.totalQuestions || bank.questionIds?.length || 0} questions)
                          </option>
                        ))}
                      </select>
                      {errors.selectedQuestionBankId && (
                        <p className="text-red-500 text-sm mt-1">{errors.selectedQuestionBankId}</p>
                      )}
                    </div>

                    {formData.selectedQuestionBankId && (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Manual question selection will be available in Step 5 after completing the timing configuration.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {!formData.questionSelectionMethod && (
                  <div className="text-center py-12">
                    <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Choose Selection Method</h3>
                    <p className="text-gray-500">Select how you want to choose questions for this test</p>
                  </div>
                )}

                {/* Manual Question Selection Interface */}
                {formData.questionSelectionMethod === 'manual' && formData.selectedQuestionBankId && (
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Select Questions Manually <span className="text-red-500">*</span>
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        ({formData.selectedQuestions.length} of {formData.totalQuestions} selected)
                      </span>
                    </label>
                    
                    {loadingQuestions ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Loading questions...</p>
                      </div>
                    ) : availableQuestions.length === 0 ? (
                      <div className="text-center py-8">
                        <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-gray-600 dark:text-gray-300">No questions found in this question bank.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-96 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 sticky top-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Available Questions ({availableQuestions.length})
                            </span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => updateFormData({ selectedQuestions: [] })}
                                className="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                              >
                                Clear All
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-3 space-y-3">
                          {availableQuestions.map((question, index) => {
                            const isSelected = formData.selectedQuestions.some(q => q.id === question.id);
                            const canSelect = !isSelected && formData.selectedQuestions.length < formData.totalQuestions;
                            
                            return (
                              <div
                                key={question.id}
                                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                                  isSelected 
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                    : canSelect
                                      ? 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                                      : 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                                }`}
                                onClick={() => {
                                  if (isSelected) {
                                    // Deselect question
                                    updateFormData({
                                      selectedQuestions: formData.selectedQuestions.filter(q => q.id !== question.id)
                                    });
                                  } else if (canSelect) {
                                    // Select question
                                    updateFormData({
                                      selectedQuestions: [...formData.selectedQuestions, question]
                                    });
                                  }
                                }}
                              >
                                <div className="flex items-start space-x-3">
                                  <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                                    isSelected 
                                      ? 'border-blue-500 bg-blue-500' 
                                      : 'border-gray-300 dark:border-gray-600'
                                  }`}>
                                    {isSelected && (
                                      <Check className="w-3 h-3 text-white" />
                                    )}
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Q{index + 1} ({question.title || `Question ${index + 1}`})
                                      </span>
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        question.type === 'mcq' 
                                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300' 
                                          : 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
                                      }`}>
                                        {question.type === 'mcq' ? 'MCQ' : 'Essay'}
                                      </span>
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        question.difficultyLevel === 'easy' 
                                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                                          : question.difficultyLevel === 'medium'
                                          ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                                          : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                                      }`}>
                                        {question.difficultyLevel}
                                      </span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {question.points} pts
                                      </span>
                                      {question.imageUrl && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
                                          Image
                                        </span>
                                      )}
                                    </div>
                                    
                                    {/* Question Content */}
                                    <div className="text-sm text-gray-700 dark:text-gray-300">
                                      {question.content && (
                                        <p className="mb-2 line-clamp-3">{question.content}</p>
                                      )}
                                      {question.imageUrl && (
                                        <div className="mb-2">
                                          <img 
                                            src={question.imageUrl} 
                                            alt="Question"
                                            className="max-h-32 rounded border"
                                          />
                                        </div>
                                      )}
                                      
                                      {/* Show options for MCQ */}
                                      {question.type === 'mcq' && question.options && (
                                        <div className="mt-2 space-y-1">
                                          {question.options.slice(0, 2).map((option: any, optIndex: number) => (
                                            <div key={optIndex} className="text-xs text-gray-600 dark:text-gray-400">
                                              {String.fromCharCode(65 + optIndex)}) {option.text}
                                              {optIndex === 1 && question.options.length > 2 && (
                                                <span className="ml-1 text-gray-400">... +{question.options.length - 2} more</span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {errors.selectedQuestions && (
                      <p className="text-red-500 text-sm mt-1">{errors.selectedQuestions}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Auto-Selection Preview */}
            {currentStep === 5 && formData.questionSelectionMethod === 'auto' && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="mx-auto w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-4">
                    <Eye className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Question Preview
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Review the auto-selected questions for your student test
                  </p>
                </div>

                {loadingPreview ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300">Generating question preview...</p>
                  </div>
                ) : previewError ? (
                  <div className="text-center py-12">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-red-900 dark:text-red-300 mb-2">
                        Preview Generation Failed
                      </h3>
                      <p className="text-red-700 dark:text-red-400 mb-4">
                        {previewError}
                      </p>
                      <button
                        onClick={generatePreviewQuestions}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                ) : previewQuestions.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-300">No questions available for preview.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Preview Summary */}
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <Check className="w-5 h-5 text-green-600" />
                        <h4 className="font-medium text-green-900 dark:text-green-300">
                          Auto-Selection Complete
                        </h4>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Total Questions:</span>
                          <div className="font-semibold text-green-800 dark:text-green-300">
                            {previewQuestions.length}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Total Marks:</span>
                          <div className="font-semibold text-green-800 dark:text-green-300">
                            {previewQuestions.reduce((sum, q) => sum + (q.points || 1), 0)}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Question Type:</span>
                          <div className="font-semibold text-green-800 dark:text-green-300">
                            {formData.questionType === 'mcq' ? 'Multiple Choice' : 'Essay'}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">With Images:</span>
                          <div className="font-semibold text-green-800 dark:text-green-300">
                            {previewQuestions.filter(q => q.imageUrl || q.explanationImageUrl || q.suggestedAnswerImageUrl).length}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Questions List */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          Selected Questions ({previewQuestions.length})
                        </h4>
                        <button
                          onClick={generatePreviewQuestions}
                          className="flex items-center space-x-2 px-3 py-1 text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>Regenerate</span>
                        </button>
                      </div>
                      
                      <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                        {previewQuestions.map((question, index) => (
                          <div
                            key={question.id || index}
                            className="p-4 border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                                  {index + 1}
                                </span>
                                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                                  {question.difficultyLevel || 'medium'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {question.points || 1} point{(question.points || 1) !== 1 ? 's' : ''}
                                </span>
                                {/* Image indicator */}
                                {(question.imageUrl || question.explanationImageUrl || question.suggestedAnswerImageUrl) && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                    📷
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="text-sm text-gray-900 dark:text-white">
                              <div className="font-medium mb-1">
                                {question.questionText || question.title || 'Question content'}
                              </div>
                              {question.content && (
                                <div className="text-gray-600 dark:text-gray-400 text-xs mb-2">
                                  {question.content.length > 100 
                                    ? question.content.substring(0, 100) + '...' 
                                    : question.content
                                  }
                                </div>
                              )}
                              
                              {/* Question Image */}
                              {question.imageUrl && (
                                <div className="mt-2 mb-2">
                                  <div className="relative inline-block">
                                    <img
                                      src={question.imageUrl}
                                      alt="Question"
                                      className="max-w-xs max-h-32 object-contain border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800"
                                      onError={(e) => {
                                        // Replace with placeholder text if image fails
                                        const target = e.target as HTMLImageElement;
                                        const parent = target.parentElement;
                                        if (parent) {
                                          parent.innerHTML = '<div class="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-500 dark:text-gray-400">📷 Question Image (failed to load)</div>';
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Show options for MCQ */}
                            {formData.questionType === 'mcq' && question.options && (
                              <div className="mt-2">
                                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                  Options: {question.options.length} choices
                                </div>
                                {question.options.slice(0, 2).map((option: any, optIndex: number) => (
                                  <div key={optIndex} className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                    • {option.text || option.content || `Option ${optIndex + 1}`}
                                    {option.imageUrl && <span className="ml-1">[📷 Image]</span>}
                                  </div>
                                ))}
                                {question.options.length > 2 && (
                                  <div className="text-xs text-gray-400 ml-2">
                                    ... and {question.options.length - 2} more
                                  </div>
                                )}
                                
                                {/* Show explanation image if available for MCQ */}
                                {question.explanationImageUrl && (
                                  <div className="mt-2">
                                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                      Explanation Image:
                                    </div>
                                    <img
                                      src={question.explanationImageUrl}
                                      alt="Explanation"
                                      className="max-w-xs max-h-24 object-contain border border-gray-200 dark:border-gray-600 rounded shadow-sm bg-white dark:bg-gray-800"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        const parent = target.parentElement;
                                        if (parent) {
                                          parent.innerHTML = '<div class="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-500 dark:text-gray-400">📷 Explanation Image (failed to load)</div>';
                                        }
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Show suggested answer image for Essay questions */}
                            {formData.questionType === 'essay' && question.suggestedAnswerImageUrl && (
                              <div className="mt-2">
                                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                  Suggested Answer Image:
                                </div>
                                <img
                                  src={question.suggestedAnswerImageUrl}
                                  alt="Suggested Answer"
                                  className="max-w-xs max-h-24 object-contain border border-gray-200 dark:border-gray-600 rounded shadow-sm bg-white dark:bg-gray-800"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    const parent = target.parentElement;
                                    if (parent) {
                                      parent.innerHTML = '<div class="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-500 dark:text-gray-400">📷 Suggested Answer Image (failed to load)</div>';
                                    }
                                  }}
                                />
                              </div>
                            )}
                            
                            {question.topic && (
                              <div className="mt-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                  {question.topic}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-amber-800 dark:text-amber-300">
                            Preview Note
                          </h4>
                          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                            This is a preview of the questions that will be included in your student test. 
                            Click "Regenerate" to get a different random selection, or proceed to finalize your test.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 6: Final Configuration and Settings */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="flex items-center space-x-3 mb-6">
                  <Settings className="w-8 h-8 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Final Configuration</h3>
                    <p className="text-sm text-gray-500">Configure test behavior and scoring settings</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Test Behavior */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900 dark:text-white">Test Behavior</h4>
                    
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={formData.shuffleQuestions}
                          onChange={(e) => updateFormData({ shuffleQuestions: e.target.checked })}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            Shuffle Questions
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Present questions in random order for each student
                          </p>
                        </div>
                      </label>

                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={formData.allowReviewBeforeSubmit}
                          onChange={(e) => updateFormData({ allowReviewBeforeSubmit: e.target.checked })}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            Allow Review Before Submit
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Students can review their answers before final submission
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Scoring */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900 dark:text-white">Scoring</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Passing Score (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.passingScore}
                        onChange={(e) => updateFormData({ passingScore: parseInt(e.target.value) || 0 })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          errors.passingScore ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="50"
                      />
                      {errors.passingScore && (
                        <p className="text-red-500 text-sm mt-1">{errors.passingScore}</p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Minimum score required to pass the test
                      </p>
                    </div>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.showResultsImmediately}
                        onChange={(e) => updateFormData({ showResultsImmediately: e.target.checked })}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        disabled={formData.questionType === 'essay'}
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          Show Results Immediately
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formData.questionType === 'essay' 
                            ? 'Essay tests require manual grading (disabled)'
                            : 'Display scores and correct answers right after submission'
                          }
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Test Summary */}
                  <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Test Summary</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Title:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{formData.title || 'Untitled Test'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Type:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formData.type === 'flexible' ? 'Flexible Test' : 'Live Test'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Question Type:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formData.questionType === 'mcq' ? 'Multiple Choice' : 'Essay'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Total Questions:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{formData.totalQuestions}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{formData.duration} minutes</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Students:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{formData.selectedStudents.length} selected</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Passing Score:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{formData.passingScore}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Selection Method:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formData.questionSelectionMethod === 'auto' ? 'Automatic' : 'Manual'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timing Summary */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Timing Details</h5>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {formData.type === 'flexible' ? (
                          <>
                            <p>Available: {formData.availableFrom ? new Date(formData.availableFrom).toLocaleString() : 'Not set'}</p>
                            <p>Until: {formData.availableTo ? new Date(formData.availableTo).toLocaleString() : 'Not set'}</p>
                            <p>Attempts allowed: {formData.attemptsAllowed}</p>
                          </>
                        ) : (
                          <>
                            <p>Scheduled: {formData.scheduledStartTime ? new Date(formData.scheduledStartTime).toLocaleString() : 'Not set'}</p>
                            <p>Buffer time: {formData.bufferTime} minutes</p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Student Assignment Summary */}
                    {formData.assignmentSummary && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Student Assignment</h5>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <p className="mb-2">Assigned to {formData.selectedStudents.length} students across {Object.keys(formData.assignmentSummary.byClass).length} class{Object.keys(formData.assignmentSummary.byClass).length !== 1 ? 'es' : ''}:</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(formData.assignmentSummary.byClass).map(([className, classData]) => (
                              <span
                                key={className}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200"
                              >
                                {classData.className}: {classData.studentCount}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Step {currentStep} of {totalSteps}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={currentStep === 1 ? handleClose : handlePrevious}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{currentStep === 1 ? 'Cancel' : 'Previous'}</span>
              </button>
              
              {currentStep < totalSteps ? (
                <button
                  onClick={handleNext}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleCreateTest}
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Create Test</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Student Selection Modal */}
      <StudentSelectionModal
        isOpen={showStudentSelection}
        onClose={() => setShowStudentSelection(false)}
        onConfirm={handleStudentsSelected}
        teacherId={teacher?.id || ''}
        teacherName={teacher?.name || ''}
        availableClasses={teacherClasses.map(cls => ({
          id: cls.id,
          name: cls.name,
          subject: cls.subject,
          year: cls.year,
          subjectId: cls.subjectId
        }))}
        title="Select Students for Test"
        description="Choose students who will have access to this test"
      />
    </>
  );
}
