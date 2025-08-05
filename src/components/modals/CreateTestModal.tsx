'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Clock, Calendar, Users, BookOpen, AlertCircle, Settings, Target, FileText, Edit } from 'lucide-react';
import { TestType, TestConfig, QuestionSelectionMethod } from '@/models/testSchema';
import { QuestionBank, Question } from '@/models/questionBankSchema';
import { LessonDocument } from '@/models/lessonSchema';
import { TestService } from '@/apiservices/testService';
import { LessonFirestoreService } from '@/apiservices/lessonFirestoreService';
import { questionService } from '@/apiservices/questionBankFirestoreService';
import { TestNumberingService } from '@/apiservices/testNumberingService';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { Timestamp } from 'firebase/firestore';

interface CreateTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestCreated: (test: any) => void;
  subjectId: string;
  subjectName: string;
  selectedClassId?: string; // Single class when coming from class-detail view
  availableClasses: Array<{
    id: string;
    name: string;
    subject: string;
    year: string;
  }>;
  questionBanks: QuestionBank[];
}

// Multi-step form data
interface TestFormData {
  // Step 1: Basic Info & Type
  title: string;
  testNumber: string; // New field for test numbering
  description: string;
  instructions: string;
  type: TestType | '';
  questionType: 'mcq' | 'essay' | ''; // New field for question type selection

  // Step 2: Timing & Duration
  // For flexible tests
  availableFrom: string;
  availableTo: string;
  duration: number;
  attemptsAllowed: number;
  
  // For live tests
  scheduledStartTime: string;
  bufferTime: number;

  // Step 3: Question Selection
  questionSelectionMethod: QuestionSelectionMethod | '';
  totalQuestions: number;
  selectedQuestionBankId: string;
  
  // For manual selection
  selectedQuestions: any[];
  
  // For auto selection (by lesson)
  selectedLessonIds: string[];

  // Step 4: Final Configuration
  shuffleQuestions: boolean;
  showQuestionsOneByOne: boolean;
  allowReviewBeforeSubmit: boolean;
  passingScore: number;
  showResultsImmediately: boolean;
}

const INITIAL_FORM_DATA: TestFormData = {
  title: '',
  testNumber: '',
  description: '',
  instructions: '',
  type: '',
  questionType: '',
  
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
  showQuestionsOneByOne: false,
  allowReviewBeforeSubmit: true,
  passingScore: 50,
  showResultsImmediately: false,
};

export default function CreateTestModal({
  isOpen,
  onClose,
  onTestCreated,
  subjectId,
  subjectName,
  selectedClassId,
  availableClasses,
  questionBanks
}: CreateTestModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<TestFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get current teacher from auth context
  const { teacher } = useTeacherAuth();

  // Debug question banks
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 CreateTestModal Debug:');
      console.log('🔍 Subject ID:', subjectId);
      console.log('🔍 Subject Name:', subjectName);
      console.log('🔍 Selected Class ID:', selectedClassId);
      console.log('🔍 Available Classes:', availableClasses);
      console.log('🔍 Question Banks:', questionBanks);
      console.log('🔍 Question Banks length:', questionBanks?.length || 0);
    }
  }, [isOpen, subjectId, subjectName, selectedClassId, availableClasses, questionBanks]);

  // Additional state for data loading
  const [lessons, setLessons] = useState<LessonDocument[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [existingTestNumbers, setExistingTestNumbers] = useState<Set<string>>(new Set());
  const [loadingTestNumbers, setLoadingTestNumbers] = useState(false);
  const [suggestedTestNumber, setSuggestedTestNumber] = useState<number>(1);
  const [usedTestNumbers, setUsedTestNumbers] = useState<number[]>([]);
  
  // State for manual question selection
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const totalSteps = 4; // Updated to 4 steps

  // Load lessons when question bank is selected
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

  // Load existing test numbers when modal opens
  useEffect(() => {
    if (isOpen && selectedClassId) {
      loadExistingTestNumbers();
    }
  }, [isOpen, selectedClassId]);

  const loadLessons = async () => {
    if (!formData.selectedQuestionBankId) return;
    
    try {
      setLoadingLessons(true);
      const lessonsData = await LessonFirestoreService.getLessonsBySubject(subjectId);
      setLessons(lessonsData);
    } catch (error) {
      console.error('Error loading lessons:', error);
    } finally {
      setLoadingLessons(false);
    }
  };

  const loadQuestions = async () => {
    if (!formData.selectedQuestionBankId) return;
    
    try {
      setLoadingQuestions(true);
      
      // Get the selected question bank to access its questions
      const selectedBank = questionBanks.find(bank => bank.id === formData.selectedQuestionBankId);
      if (!selectedBank || !selectedBank.questionIds || selectedBank.questionIds.length === 0) {
        setAvailableQuestions([]);
        return;
      }
      
      // Fetch all questions in this bank
      const questionsData = await Promise.all(
        selectedBank.questionIds.map(id => questionService.getQuestion(id))
      );
      
      // Filter out null questions and filter by question type if specified
      let validQuestions = questionsData.filter(q => q !== null) as Question[];
      
      // Filter by question type if a specific type is selected
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

  const loadExistingTestNumbers = async () => {
    if (!selectedClassId) return;
    
    try {
      setLoadingTestNumbers(true);
      
      // Get test number suggestions from the service
      const suggestions = await TestNumberingService.getTestNumberSuggestions(
        selectedClassId,
        subjectId // Pass subject ID for subject-specific numbering
      );
      
      // Update state with suggestions
      setSuggestedTestNumber(suggestions.suggestedNumber);
      setUsedTestNumbers(suggestions.usedNumbers);
      setExistingTestNumbers(new Set(suggestions.usedNumbers.map(String)));
      
      // Always auto-assign the suggested number
      updateFormData({ testNumber: suggestions.suggestedNumber.toString() });
      
      console.log('📋 Test number auto-assigned:', suggestions);
      
    } catch (error) {
      console.error('Error loading test numbers:', error);
      setExistingTestNumbers(new Set());
      setSuggestedTestNumber(1);
      setUsedTestNumbers([]);
      // Auto-assign 1 as fallback
      updateFormData({ testNumber: '1' });
    } finally {
      setLoadingTestNumbers(false);
    }
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData(INITIAL_FORM_DATA);
      setCurrentStep(1);
      setErrors({});
    }
  }, [isOpen]);

  const updateFormData = (updates: Partial<TestFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    const updatedFields = Object.keys(updates);
    setErrors(prev => {
      const newErrors = { ...prev };
      updatedFields.forEach(field => delete newErrors[field]);
      return newErrors;
    });
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    console.log('🔍 Validating step:', step);
    console.log('🔍 Current form data:', formData);

    switch (step) {
      case 1: // Basic Info & Type
        if (!formData.title.trim()) newErrors.title = 'Test title is required';
        if (!formData.type) newErrors.type = 'Test type is required';
        if (!formData.questionType) newErrors.questionType = 'Question type is required';
        // Test numbers are auto-assigned, no validation needed
        console.log('🔍 Step 1 validation errors:', newErrors);
        break;
        
      case 2: // Timing & Duration
        if (formData.type === 'flexible') {
          if (!formData.availableFrom) newErrors.availableFrom = 'Start date is required';
          if (!formData.availableTo) newErrors.availableTo = 'End date is required';
          if (formData.duration <= 0) newErrors.duration = 'Duration must be greater than 0';
          
          // Validate date logic
          if (formData.availableFrom && formData.availableTo) {
            const from = new Date(formData.availableFrom);
            const to = new Date(formData.availableTo);
            if (from >= to) newErrors.availableTo = 'End date must be after start date';
          }
        } else if (formData.type === 'live') {
          if (!formData.scheduledStartTime) newErrors.scheduledStartTime = 'Start time is required';
          if (formData.duration <= 0) newErrors.duration = 'Duration must be greater than 0';
          
          // Validate not in the past
          if (formData.scheduledStartTime) {
            const startTime = new Date(formData.scheduledStartTime);
            if (startTime <= new Date()) newErrors.scheduledStartTime = 'Start time must be in the future';
          }
        }
        break;
        
      case 3: // Question Selection
        console.log('🔍 Step 3 validation - questionSelectionMethod:', formData.questionSelectionMethod);
        console.log('🔍 Step 3 validation - selectedQuestionBankId:', formData.selectedQuestionBankId);
        console.log('🔍 Step 3 validation - totalQuestions:', formData.totalQuestions);
        
        if (!formData.questionSelectionMethod) newErrors.questionSelectionMethod = 'Question selection method is required';
        if (!formData.selectedQuestionBankId) newErrors.selectedQuestionBankId = 'Please select a question bank';
        if (formData.totalQuestions <= 0) newErrors.totalQuestions = 'Number of questions must be greater than 0';
        
        // Validate question type availability in selected bank
        if (formData.selectedQuestionBankId && formData.questionType) {
          const selectedBank = questionBanks?.find(bank => bank.id === formData.selectedQuestionBankId);
          if (selectedBank) {
            if (formData.questionType === 'mcq' && selectedBank.mcqCount === 0) {
              newErrors.selectedQuestionBankId = 'Selected question bank has no MCQ questions';
            } else if (formData.questionType === 'essay' && selectedBank.essayCount === 0) {
              newErrors.selectedQuestionBankId = 'Selected question bank has no essay questions';
            }
          }
        }
        
        // Only validate lesson/question selection if method is chosen
        if (formData.questionSelectionMethod === 'auto' && formData.selectedLessonIds.length === 0) {
          newErrors.selectedLessonIds = 'Please select at least one lesson for auto selection';
        }
        
        if (formData.questionSelectionMethod === 'manual') {
          if (formData.selectedQuestions.length === 0) {
            newErrors.selectedQuestions = 'Please select at least one question manually';
          } else if (formData.selectedQuestions.length < formData.totalQuestions) {
            newErrors.selectedQuestions = `Please select ${formData.totalQuestions} questions (currently selected: ${formData.selectedQuestions.length})`;
          }
        }
        break;
        
      case 4: // Final Configuration
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
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleCreateTest = async () => {
    if (!validateStep(currentStep)) return;

    try {
      setIsSubmitting(true);

      // Build test data based on form
      const testConfig: TestConfig = {
        questionSelectionMethod: formData.questionSelectionMethod as QuestionSelectionMethod,
        questionType: formData.questionType as 'mcq' | 'essay',
        totalQuestions: formData.totalQuestions,
        shuffleQuestions: formData.shuffleQuestions,
        showQuestionsOneByOne: formData.showQuestionsOneByOne,
        allowReviewBeforeSubmit: formData.allowReviewBeforeSubmit,
        passingScore: formData.passingScore,
        showResultsImmediately: formData.showResultsImmediately,
      };

      // Calculate total marks based on selected questions or default to 1 per question
      const totalMarks = formData.selectedQuestions && formData.selectedQuestions.length > 0
        ? formData.selectedQuestions.reduce((sum, q) => sum + (q.points || 1), 0)
        : formData.totalQuestions * 1; // Default fallback

      // Build base test data
      const baseTestData = {
        title: formData.testNumber && selectedClassId ? 
          `${formData.title} (Test ${formData.testNumber})` : 
          formData.title,
        description: formData.description || '', // Ensure not undefined
        instructions: formData.instructions || '', // Ensure not undefined
        teacherId: teacher?.id || '', // Get from auth context
        teacherName: teacher?.name || '', // Get from auth context
        subjectId: subjectId || '', // Ensure not undefined
        subjectName: subjectName || '', // Ensure not undefined
        classIds: selectedClassId ? [selectedClassId] : availableClasses.map(c => c.id),
        classNames: selectedClassId ? 
          [availableClasses.find(c => c.id === selectedClassId)?.name || ''] : 
          availableClasses.map(c => c.name),
        config: testConfig,
        questions: formData.selectedQuestions || [], // Ensure not undefined
        totalMarks: totalMarks,
        status: 'draft' as const,
      };
      
      console.log('🔍 Base test data constructed:', baseTestData);
      console.log('🔍 Base test data keys:', Object.keys(baseTestData));
      console.log('🔍 Teacher information:', { 
        teacherId: teacher?.id, 
        teacherName: teacher?.name,
        teacherInBaseData: { 
          teacherId: baseTestData.teacherId, 
          teacherName: baseTestData.teacherName 
        }
      });
      
      // Check for undefined in base data
      const baseUndefinedFields = Object.entries(baseTestData).filter(([key, value]) => value === undefined);
      if (baseUndefinedFields.length > 0) {
        console.warn('⚠️ Undefined fields in base data:', baseUndefinedFields);
      }

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
        const studentJoinTime = new Date(startTime.getTime()); // Students can join exactly at start time
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

      // Debug test data before sending to Firebase
      console.log('🔍 Final test data before Firebase:', testData);
      
      // Check for undefined values and clean them up
      const cleanTestData = { ...testData };
      
      // Remove undefined values recursively
      const removeUndefined = (obj: any): any => {
        if (obj === null || obj === undefined) {
          return null;
        }
        if (Array.isArray(obj)) {
          return obj.map(removeUndefined).filter(item => item !== undefined);
        }
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
      
      const finalTestData = removeUndefined(cleanTestData);
      
      console.log('🧹 Cleaned test data:', finalTestData);
      console.log('🔍 Test data keys:', Object.keys(finalTestData));
      
      // Additional validation
      const undefinedFields = Object.entries(finalTestData).filter(([key, value]) => value === undefined);
      if (undefinedFields.length > 0) {
        console.error('❌ Found undefined fields:', undefinedFields);
        throw new Error(`Test data contains undefined fields: ${undefinedFields.map(([key]) => key).join(', ')}`);
      }

      // Handle question selection based on method first
      let autoSelectedQuestions: any[] = [];
      if (formData.questionSelectionMethod === 'auto' && formData.selectedLessonIds.length > 0) {
        console.log('🔍 Auto-selecting questions from lessons:', formData.selectedLessonIds);
        
        try {
          // Find the selected question bank to get its name
          const selectedBank = questionBanks.find(bank => bank.id === formData.selectedQuestionBankId);
          if (!selectedBank) {
            throw new Error('Selected question bank not found');
          }
          
          console.log('🔍 Selected question bank:', selectedBank.name, 'ID:', selectedBank.id);
          console.log('🔍 Question bank has', selectedBank.totalQuestions, 'total questions');
          console.log('🔍 Question bank mcqCount:', selectedBank.mcqCount, 'essayCount:', selectedBank.essayCount);
          console.log('🔍 Question bank questionIds:', selectedBank.questionIds?.length || 0, 'questions');
          console.log('🔍 Desired question count:', formData.totalQuestions);
          console.log('🔍 Selected lessons:', formData.selectedLessonIds);
          console.log('🔍 Question type filter:', formData.questionType);
          
          // Build QuestionBankSelection for auto-selection
          const questionBankSelection = {
            bankId: formData.selectedQuestionBankId,
            bankName: selectedBank.name,
            lessonIds: formData.selectedLessonIds,
            questionCount: formData.totalQuestions, // Fixed: was using totalQuestions
            difficultyDistribution: undefined // Can be enhanced later
          };
          
          console.log('🔍 Question bank selection params:', questionBankSelection);
          
          // Auto-select questions using TestService
          autoSelectedQuestions = await TestService.autoSelectQuestions(
            [questionBankSelection],
            testConfig
          );
          
          console.log('✅ Auto-selected questions count:', autoSelectedQuestions.length);
          console.log('✅ Auto-selected questions details:', autoSelectedQuestions.map(q => ({
            questionId: q.questionId,
            title: q.title,
            type: q.type,
            topic: q.topic
          })));
          
          if (autoSelectedQuestions.length === 0) {
            throw new Error(`No questions found for the selected lessons. Please check if questions exist for the selected lessons in ${selectedBank.name}.`);
          }
          
          // Update final test data with auto-selected questions
          finalTestData.questions = autoSelectedQuestions;
          finalTestData.totalMarks = autoSelectedQuestions.reduce((sum, q) => sum + q.points, 0);
          
        } catch (autoSelectError) {
          console.error('❌ Error auto-selecting questions:', autoSelectError);
          throw new Error(`Failed to auto-select questions from lessons: ${autoSelectError instanceof Error ? autoSelectError.message : 'Unknown error'}`);
        }
      }

      // Create the test
      const testId = await TestService.createTest(finalTestData as any); // Type assertion for now

      console.log('Test created successfully:', testId);
      onTestCreated({ ...testData, id: testId });
      
    } catch (error) {
      console.error('Error creating test:', error);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Create New Test - Step {currentStep} of {totalSteps}
            </h2>
            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <span>Step {currentStep} of {totalSteps}</span>
              <div className="flex space-x-1">
                {Array.from({ length: totalSteps }, (_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i + 1 <= currentStep 
                        ? 'bg-blue-600' 
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1">
          <div 
            className="bg-blue-600 h-1 transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          
          {/* Step 1: Basic Information & Test Type */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                  <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Test Basic Information
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Enter the basic details and type for your test
                </p>
              </div>

              <div className="space-y-6">
                {/* Test Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Test Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => updateFormData({ title: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                      errors.title ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter test title (e.g., Mid-term Math Quiz)"
                  />
                  {errors.title && (
                    <p className="mt-1 text-sm text-red-500">{errors.title}</p>
                  )}
                </div>

                {/* Test Number (only if coming from class-detail view) */}
                {selectedClassId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Test Number (Auto-assigned)
                    </label>
                    
                    {/* Auto-assigned Number Display */}
                    {!loadingTestNumbers && (
                      <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-1">
                              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                                Auto-assigned Number:
                              </span>
                              <span className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded text-sm font-medium">
                                {suggestedTestNumber}
                              </span>
                            </div>
                          </div>
                          
                          {usedTestNumbers.length > 0 && (
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-600 dark:text-gray-400">Previously used:</span>
                              <div className="flex flex-wrap gap-1">
                                {usedTestNumbers.slice(0, 5).map(num => (
                                  <span 
                                    key={num}
                                    className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                                  >
                                    {num}
                                  </span>
                                ))}
                                {usedTestNumbers.length > 5 && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    +{usedTestNumbers.length - 5} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Read-only Input Field */}
                    <div className="flex items-center space-x-3">
                      <input
                        type="text"
                        value={formData.testNumber || suggestedTestNumber.toString()}
                        readOnly
                        disabled
                        className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-300 cursor-not-allowed"
                        placeholder={loadingTestNumbers ? "Loading..." : suggestedTestNumber.toString()}
                      />
                      
                      {loadingTestNumbers ? (
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                          <span>Loading...</span>
                        </div>
                      ) : usedTestNumbers.length === 0 ? (
                        <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                          First test! 🎉
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {usedTestNumbers.length} test{usedTestNumbers.length !== 1 ? 's' : ''} created
                        </div>
                      )}
                    </div>
                    
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Test numbers are automatically assigned to ensure they are unique and sequential for this class.
                    </p>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateFormData({ description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Brief description of what this test covers..."
                  />
                </div>

                {/* Instructions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Instructions for Students (Optional)
                  </label>
                  <textarea
                    value={formData.instructions}
                    onChange={(e) => updateFormData({ instructions: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Instructions for students (e.g., Read each question carefully, no calculators allowed, etc.)"
                  />
                </div>

                {/* Test Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Test Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Flexible Test */}
                    <div
                      onClick={() => updateFormData({ type: 'flexible' })}
                      className={`cursor-pointer p-4 border rounded-lg transition-all ${
                        formData.type === 'flexible'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          formData.type === 'flexible'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {formData.type === 'flexible' && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Clock className="h-5 w-5 text-green-600" />
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              Flexible Test
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Students can take the test anytime within a specified period. 
                            Good for assignments and homework.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Live Test */}
                    <div
                      onClick={() => updateFormData({ type: 'live' })}
                      className={`cursor-pointer p-4 border rounded-lg transition-all ${
                        formData.type === 'live'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          formData.type === 'live'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {formData.type === 'live' && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Calendar className="h-5 w-5 text-red-600" />
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              Live Test
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            All students take the test at the same scheduled time. 
                            Good for exams and timed assessments.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {errors.type && (
                    <p className="mt-2 text-sm text-red-500">{errors.type}</p>
                  )}
                </div>

                {/* Question Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Question Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* MCQ Test */}
                    <div
                      onClick={() => updateFormData({ 
                        questionType: 'mcq',
                        selectedQuestions: [] // Reset selected questions when type changes
                      })}
                      className={`cursor-pointer p-4 border rounded-lg transition-all ${
                        formData.questionType === 'mcq'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          formData.questionType === 'mcq'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {formData.questionType === 'mcq' && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              MCQ Test
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Multiple choice questions with automatic grading.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Essay Test */}
                    <div
                      onClick={() => updateFormData({ 
                        questionType: 'essay',
                        selectedQuestions: [] // Reset selected questions when type changes
                      })}
                      className={`cursor-pointer p-4 border rounded-lg transition-all ${
                        formData.questionType === 'essay'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          formData.questionType === 'essay'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {formData.questionType === 'essay' && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Edit className="h-5 w-5 text-green-600" />
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              Essay Test
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Written responses requiring manual grading.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {errors.questionType && (
                    <p className="mt-2 text-sm text-red-500">{errors.questionType}</p>
                  )}
                </div>

                {/* Class Assignment Info */}
                {selectedClassId ? (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-medium mb-1">Class Assignment:</p>
                        <p>This test will be assigned to: <strong>{availableClasses.find(c => c.id === selectedClassId)?.name}</strong></p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <Users className="h-5 w-5 text-gray-600 dark:text-gray-400 mt-0.5" />
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        <p className="font-medium mb-1">Class Assignment:</p>
                        <p>This test will be available to all your assigned classes</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Timing Configuration */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                  {formData.type === 'flexible' ? (
                    <Clock className="h-8 w-8 text-green-600" />
                  ) : (
                    <Calendar className="h-8 w-8 text-red-600" />
                  )}
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {formData.type === 'flexible' ? 'Flexible Test Timing' : 'Live Test Scheduling'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {formData.type === 'flexible' 
                    ? 'Set the time period when students can take the test'
                    : 'Schedule when all students will take the test together'
                  }
                </p>
              </div>

              {/* Flexible Test Timing */}
              {formData.type === 'flexible' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Available From <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.availableFrom}
                        onChange={(e) => updateFormData({ availableFrom: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          errors.availableFrom ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.availableFrom && (
                        <p className="mt-1 text-sm text-red-500">{errors.availableFrom}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Available Until <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.availableTo}
                        onChange={(e) => updateFormData({ availableTo: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          errors.availableTo ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.availableTo && (
                        <p className="mt-1 text-sm text-red-500">{errors.availableTo}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Test Duration (minutes) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={formData.duration}
                        onChange={(e) => updateFormData({ duration: parseInt(e.target.value) || 0 })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          errors.duration ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="60"
                      />
                      {errors.duration && (
                        <p className="mt-1 text-sm text-red-500">{errors.duration}</p>
                      )}
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
                        <option value={1}>1 Attempt</option>
                        <option value={2}>2 Attempts</option>
                        <option value={3}>3 Attempts</option>
                        <option value={-1}>Unlimited</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Test Timing */}
              {formData.type === 'live' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Scheduled Start Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.scheduledStartTime}
                        onChange={(e) => updateFormData({ scheduledStartTime: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          errors.scheduledStartTime ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.scheduledStartTime && (
                        <p className="mt-1 text-sm text-red-500">{errors.scheduledStartTime}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Test Duration (minutes) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={formData.duration}
                        onChange={(e) => updateFormData({ duration: parseInt(e.target.value) || 0 })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          errors.duration ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="60"
                      />
                      {errors.duration && (
                        <p className="mt-1 text-sm text-red-500">{errors.duration}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Buffer Time (minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={formData.bufferTime}
                      onChange={(e) => updateFormData({ bufferTime: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="5"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Extra time added to handle technical issues (default: 5 minutes)
                    </p>
                  </div>

                  {/* Live Test Info */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-medium mb-1">Live Test Schedule:</p>
                        <ul className="space-y-1 text-xs">
                          <li>• Students can join at the exact start time</li>
                          <li>• Test runs for the specified duration</li>
                          <li>• Buffer time is added for technical issues</li>
                          <li>• All students take the test simultaneously</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Question Selection */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                  <Target className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Question Selection
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Choose how to select questions for your test
                </p>
                {/* Question Type Reminder */}
                {formData.questionType && (
                  <div className="mt-4 inline-flex items-center space-x-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full text-sm">
                    {formData.questionType === 'mcq' ? (
                      <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Edit className="h-4 w-4 text-green-600 dark:text-green-400" />
                    )}
                    <span className="text-blue-800 dark:text-blue-200 font-medium">
                      {formData.questionType === 'mcq' ? 'MCQ Test' : 'Essay Test'}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {/* Question Bank Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Question Bank <span className="text-red-500">*</span>
                  </label>
                  {/* Debug info */}
                  <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                    Debug: {questionBanks?.length || 0} banks available
                    {questionBanks?.length === 0 && (
                      <span className="text-orange-500 ml-2">
                        (No question banks found - check teacher access permissions)
                      </span>
                    )}
                  </div>
                  <select
                    value={formData.selectedQuestionBankId}
                    onChange={(e) => updateFormData({ 
                      selectedQuestionBankId: e.target.value,
                      selectedQuestions: [],
                      selectedLessonIds: []
                    })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                      errors.selectedQuestionBankId ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select a question bank...</option>
                    {questionBanks && questionBanks.length > 0 ? (
                      questionBanks.map(bank => {
                        // Calculate type-specific question counts for display
                        let displayText = `${bank.name} (${bank.totalQuestions} questions`;
                        if (formData.questionType === 'mcq') {
                          displayText = `${bank.name} (${bank.mcqCount} MCQ questions`;
                        } else if (formData.questionType === 'essay') {
                          displayText = `${bank.name} (${bank.essayCount} essay questions`;
                        }
                        displayText += ')';
                        
                        return (
                          <option key={bank.id} value={bank.id}>
                            {displayText}
                          </option>
                        );
                      })
                    ) : (
                      <option disabled>No question banks available</option>
                    )}
                  </select>
                  {errors.selectedQuestionBankId && (
                    <p className="mt-1 text-sm text-red-500">{errors.selectedQuestionBankId}</p>
                  )}
                  
                  {/* Warning when selected bank has no questions of selected type */}
                  {formData.selectedQuestionBankId && formData.questionType && (
                    (() => {
                      const selectedBank = questionBanks?.find(bank => bank.id === formData.selectedQuestionBankId);
                      const hasNoQuestions = selectedBank && (
                        (formData.questionType === 'mcq' && selectedBank.mcqCount === 0) ||
                        (formData.questionType === 'essay' && selectedBank.essayCount === 0)
                      );
                      
                      if (hasNoQuestions) {
                        return (
                          <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                            <div className="flex items-start space-x-2">
                              <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5" />
                              <div className="text-sm text-orange-800 dark:text-orange-200">
                                <p className="font-medium">No {formData.questionType.toUpperCase()} Questions Available</p>
                                <p className="mt-1">
                                  The selected question bank "{selectedBank?.name}" has no {formData.questionType} questions. 
                                  Please select a different question bank or choose a different question type.
                                </p>
                                <p className="mt-1 text-xs">
                                  Available: {selectedBank?.mcqCount || 0} MCQ, {selectedBank?.essayCount || 0} Essay questions
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()
                  )}
                  
                  {/* Help message when no banks available */}
                  {(!questionBanks || questionBanks.length === 0) && (
                    <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                        <div className="text-sm text-yellow-800 dark:text-yellow-200">
                          <p className="font-medium">No Question Banks Available</p>
                          <p className="mt-1">
                            Either no question banks exist for this subject, or you don't have access permissions. 
                            Contact your administrator to assign question banks to you.
                          </p>
                          <p className="mt-1 text-xs">
                            Subject: <strong>{subjectName}</strong> (ID: {subjectId})
                          </p>
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-yellow-600 dark:text-yellow-400">
                              Debug Info (Click to expand)
                            </summary>
                            <div className="mt-2 text-xs font-mono bg-yellow-100 dark:bg-yellow-900/40 p-2 rounded">
                              <p>Props received:</p>
                              <p>• questionBanks: {JSON.stringify(questionBanks, null, 2)}</p>
                              <p>• subjectId: {subjectId}</p>
                              <p>• selectedClassId: {selectedClassId || 'none'}</p>
                            </div>
                          </details>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Selection Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Question Selection Method <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Manual Selection */}
                    <div
                      onClick={() => updateFormData({ 
                        questionSelectionMethod: 'manual',
                        selectedLessonIds: []
                      })}
                      className={`cursor-pointer p-4 border rounded-lg transition-all ${
                        formData.questionSelectionMethod === 'manual'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          formData.questionSelectionMethod === 'manual'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {formData.questionSelectionMethod === 'manual' && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Users className="h-5 w-5 text-blue-600" />
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              Manual Selection
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            You select specific questions from the question bank one by one.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Auto Selection */}
                    <div
                      onClick={() => updateFormData({ 
                        questionSelectionMethod: 'auto',
                        selectedQuestions: []
                      })}
                      className={`cursor-pointer p-4 border rounded-lg transition-all ${
                        formData.questionSelectionMethod === 'auto'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          formData.questionSelectionMethod === 'auto'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {formData.questionSelectionMethod === 'auto' && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Target className="h-5 w-5 text-green-600" />
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              Auto Selection (by Lesson)
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            System randomly selects questions from chosen lessons.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {errors.questionSelectionMethod && (
                    <p className="mt-2 text-sm text-red-500">{errors.questionSelectionMethod}</p>
                  )}
                </div>

                {/* Total Questions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Number of Questions <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.totalQuestions}
                    onChange={(e) => {
                      const newTotal = parseInt(e.target.value) || 0;
                      
                      // If manual selection and we already have questions selected,
                      // adjust the selection to fit the new total
                      if (formData.questionSelectionMethod === 'manual' && formData.selectedQuestions.length > 0) {
                        const adjustedQuestions = formData.selectedQuestions.slice(0, newTotal);
                        updateFormData({ 
                          totalQuestions: newTotal,
                          selectedQuestions: adjustedQuestions
                        });
                      } else {
                        updateFormData({ totalQuestions: newTotal });
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                      errors.totalQuestions ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="10"
                  />
                  {errors.totalQuestions && (
                    <p className="mt-1 text-sm text-red-500">{errors.totalQuestions}</p>
                  )}
                  {formData.questionSelectionMethod === 'manual' && formData.selectedQuestions.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Currently selected: {formData.selectedQuestions.length} questions
                    </p>
                  )}
                </div>

                {/* Lesson Selection for Auto Method */}
                {formData.questionSelectionMethod === 'auto' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Select Lessons <span className="text-red-500">*</span>
                    </label>
                    {loadingLessons ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Loading lessons...</p>
                      </div>
                    ) : lessons.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-gray-600 dark:text-gray-300">No lessons found for this subject.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                        {lessons.map(lesson => (
                          <label key={lesson.id} className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.selectedLessonIds.includes(lesson.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  updateFormData({ 
                                    selectedLessonIds: [...formData.selectedLessonIds, lesson.id] 
                                  });
                                } else {
                                  updateFormData({ 
                                    selectedLessonIds: formData.selectedLessonIds.filter(id => id !== lesson.id) 
                                  });
                                }
                              }}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <BookOpen className="h-4 w-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {lesson.name}
                                </span>
                              </div>
                              {lesson.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                                  {lesson.description}
                                </p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                    {errors.selectedLessonIds && (
                      <p className="mt-2 text-sm text-red-500">{errors.selectedLessonIds}</p>
                    )}
                  </div>
                )}

                {/* Manual Selection Interface */}
                {formData.questionSelectionMethod === 'manual' && formData.selectedQuestionBankId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Select Questions <span className="text-red-500">*</span>
                    </label>
                    
                    {loadingQuestions ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Loading questions...</p>
                      </div>
                    ) : availableQuestions.length === 0 ? (
                      <div className="text-center py-8">
                        <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-gray-600 dark:text-gray-300">No questions found in this question bank.</p>
                      </div>
                    ) : (
                      <div>
                        {/* Selection Summary */}
                        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-300">
                              Selected: {formData.selectedQuestions.length} / {formData.totalQuestions} questions
                            </span>
                            <div className="flex space-x-2">
                              <button
                                type="button"
                                onClick={() => updateFormData({ selectedQuestions: [] })}
                                className="text-red-600 hover:text-red-700 text-xs"
                              >
                                Clear All
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const randomQuestions = [...availableQuestions]
                                    .sort(() => Math.random() - 0.5)
                                    .slice(0, formData.totalQuestions);
                                  updateFormData({ selectedQuestions: randomQuestions });
                                }}
                                className="text-blue-600 hover:text-blue-700 text-xs"
                              >
                                Random Select
                              </button>
                            </div>
                          </div>
                          {formData.selectedQuestions.length > formData.totalQuestions && (
                            <p className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                              ⚠️ You have selected more questions than needed. Only the first {formData.totalQuestions} will be used.
                            </p>
                          )}
                        </div>

                        {/* Questions List */}
                        <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                          {availableQuestions.map((question, index) => {
                            const isSelected = formData.selectedQuestions.some(q => q.id === question.id);
                            return (
                              <div
                                key={question.id}
                                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                                }`}
                                onClick={() => {
                                  if (isSelected) {
                                    // Deselect question
                                    updateFormData({
                                      selectedQuestions: formData.selectedQuestions.filter(q => q.id !== question.id)
                                    });
                                  } else {
                                    // Select question (if under limit)
                                    if (formData.selectedQuestions.length < formData.totalQuestions) {
                                      updateFormData({
                                        selectedQuestions: [...formData.selectedQuestions, question]
                                      });
                                    }
                                  }
                                }}
                              >
                                <div className="flex items-start space-x-3">
                                  {/* Selection Checkbox */}
                                  <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-500'
                                      : 'border-gray-300 dark:border-gray-600'
                                  }`}>
                                    {isSelected && (
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>

                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        Q{index + 1}: {question.title}
                                      </span>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        question.type === 'mcq'
                                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                                          : 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
                                      }`}>
                                        {question.type === 'mcq' ? 'MCQ' : 'Essay'}
                                      </span>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
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
                                    </div>

                                    {/* Question Preview */}
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      {question.content ? (
                                        <p className="line-clamp-2">{question.content}</p>
                                      ) : question.imageUrl ? (
                                        <p className="italic">Question with image</p>
                                      ) : (
                                        <p className="italic">No preview available</p>
                                      )}
                                    </div>

                                    {/* MCQ Options Preview */}
                                    {question.type === 'mcq' && 'options' in question && question.options && (
                                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        {question.options.slice(0, 2).map((option, optIdx) => (
                                          <span key={option.id} className="mr-3">
                                            {String.fromCharCode(65 + optIdx)}. {option.text?.substring(0, 30)}...
                                          </span>
                                        ))}
                                        {question.options.length > 2 && (
                                          <span>+{question.options.length - 2} more options</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Selection Status */}
                        {formData.selectedQuestions.length < formData.totalQuestions && (
                          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                              Please select {formData.totalQuestions - formData.selectedQuestions.length} more question(s) to proceed.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Question Selection Interface */}
                {formData.questionSelectionMethod === 'manual' && formData.selectedQuestionBankId && (
                  <div>
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
                                onClick={() => {
                                  const selectedIds = new Set(formData.selectedQuestions.map(q => q.id));
                                  const unselectedQuestions = availableQuestions.filter(q => !selectedIds.has(q.id));
                                  const questionsToAdd = unselectedQuestions.slice(0, formData.totalQuestions - formData.selectedQuestions.length);
                                  updateFormData({ 
                                    selectedQuestions: [...formData.selectedQuestions, ...questionsToAdd]
                                  });
                                }}
                                disabled={formData.selectedQuestions.length >= formData.totalQuestions}
                                className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
                              >
                                Auto Select Remaining
                              </button>
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
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Q{index + 1} ({question.title})
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
                                    </div>
                                    
                                    <div className="text-sm text-gray-700 dark:text-gray-300">
                                      {question.content ? (
                                        <p className="line-clamp-2">{question.content}</p>
                                      ) : question.imageUrl ? (
                                        <p className="italic text-gray-500">Question with image</p>
                                      ) : (
                                        <p className="italic text-gray-500">Question {index + 1}</p>
                                      )}
                                    </div>
                                    
                                    {question.type === 'mcq' && 'options' in question && question.options && (
                                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        {question.options.length} options
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Selection Summary */}
                    {formData.selectedQuestions.length > 0 && (
                      <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm font-medium text-green-800 dark:text-green-200">
                            {formData.selectedQuestions.length} question{formData.selectedQuestions.length !== 1 ? 's' : ''} selected
                          </span>
                        </div>
                        {formData.selectedQuestions.length < formData.totalQuestions && (
                          <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                            Select {formData.totalQuestions - formData.selectedQuestions.length} more question{formData.totalQuestions - formData.selectedQuestions.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Error display for manual selection */}
                    {errors.selectedQuestions && (
                      <p className="mt-2 text-sm text-red-500">{errors.selectedQuestions}</p>
                    )}
                  </div>
                )}

                {/* Manual Selection Info (when no bank selected yet) */}
                {formData.questionSelectionMethod === 'manual' && !formData.selectedQuestionBankId && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-medium mb-1">Manual Question Selection:</p>
                        <p>Please select a question bank first, then you can choose specific questions from it.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Final Configuration */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                  <Settings className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Test Configuration
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Final settings for your test
                </p>
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
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          Shuffle Questions
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Questions appear in random order for each student
                        </p>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.showQuestionsOneByOne}
                        onChange={(e) => updateFormData({ showQuestionsOneByOne: e.target.checked })}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          Show Questions One by One
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Students see one question at a time (cannot go back)
                        </p>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.allowReviewBeforeSubmit}
                        onChange={(e) => updateFormData({ allowReviewBeforeSubmit: e.target.checked })}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        disabled={formData.showQuestionsOneByOne}
                      />
                      <div>
                        <span className={`text-sm font-medium ${
                          formData.showQuestionsOneByOne 
                            ? 'text-gray-400 dark:text-gray-600' 
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          Allow Review Before Submit
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Students can review and change answers before final submission
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
                      <p className="mt-1 text-sm text-red-500">{errors.passingScore}</p>
                    )}
                  </div>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={formData.showResultsImmediately}
                      onChange={(e) => updateFormData({ showResultsImmediately: e.target.checked })}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Show Results Immediately
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Students see their score and correct answers right after submission
                      </p>
                    </div>
                  </label>
                </div>

                {/* Test Summary */}
                <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">Test Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Title:</span>
                      <span className="text-gray-900 dark:text-white">{formData.title || 'Untitled'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Type:</span>
                      <span className="text-gray-900 dark:text-white capitalize">{formData.type || 'Not selected'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Questions:</span>
                      <span className="text-gray-900 dark:text-white">{formData.totalQuestions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                      <span className="text-gray-900 dark:text-white">{formData.duration} minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Selection Method:</span>
                      <span className="text-gray-900 dark:text-white capitalize">{formData.questionSelectionMethod || 'Not selected'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Passing Score:</span>
                      <span className="text-gray-900 dark:text-white">{formData.passingScore}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
            >
              Cancel
            </button>
            
            {currentStep < totalSteps ? (
              <button
                onClick={handleNext}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <span>Next</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleCreateTest}
                disabled={isSubmitting}
                className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create Test</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
