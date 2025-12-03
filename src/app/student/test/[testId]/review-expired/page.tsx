'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle, XCircle, ArrowLeft, Send, Clock, FileText } from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { Button } from '@/components/ui';
import { Test, LiveTest, FlexibleTest } from '@/models/testSchema';

const StudentLayout = ({ children }: { children: React.ReactNode }) => children;

interface SavedAnswer {
  questionId: string;
  selectedOption?: number;
  textAnswer?: string;
  answeredAt?: any;
}

export default function ReviewExpiredAttemptPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const testId = params?.testId as string;
  const attemptId = searchParams.get('attemptId');
  
  const { student, loading: authLoading } = useStudentAuth();
  
  const [test, setTest] = useState<Test | null>(null);
  const [attemptData, setAttemptData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!testId || !attemptId || !student) return;

      try {
        setLoading(true);
        
        const { doc, getDoc } = await import('firebase/firestore');
        const { firestore } = await import('@/utils/firebase-client');
        
        // Load test data
        const testDoc = await getDoc(doc(firestore, 'tests', testId));
        if (!testDoc.exists()) {
          setError('Test not found');
          setLoading(false);
          return;
        }
        const testData = { id: testDoc.id, ...testDoc.data() } as Test;
        setTest(testData);
        
        // Load attempt data
        const attemptDoc = await getDoc(doc(firestore, 'testAttempts', attemptId));
        if (!attemptDoc.exists()) {
          setError('Attempt not found');
          setLoading(false);
          return;
        }
        let attempt = { id: attemptDoc.id, ...attemptDoc.data() } as any;
        
        // If no answers in Firestore, try to load from Realtime Database
        if (!attempt.answers || Object.keys(attempt.answers).length === 0) {
          try {
            const { ref, get } = await import('firebase/database');
            const { realtimeDb } = await import('@/utils/firebase-client');
            
            // Try to get answers from Realtime Database
            const answersRef = ref(realtimeDb, `testAttempts/${attemptId}/answers`);
            const answersSnapshot = await get(answersRef);
            
            if (answersSnapshot.exists()) {
              const rtdbAnswers = answersSnapshot.val();
              console.log('📥 Loaded answers from Realtime Database:', rtdbAnswers);
              attempt.answers = rtdbAnswers;
            }
          } catch (rtdbError) {
            console.warn('⚠️ Could not load answers from Realtime Database:', rtdbError);
          }
        }
        
        setAttemptData(attempt);
        
        // Check if test deadline has passed
        const now = Date.now() / 1000;
        let deadlinePassed = false;
        
        if (testData.type === 'live') {
          const liveTest = testData as LiveTest;
          const endTimeSeconds = liveTest.actualEndTime?.seconds || 0;
          deadlinePassed = now > endTimeSeconds;
        } else {
          const flexTest = testData as FlexibleTest;
          const toSeconds = flexTest.availableTo?.seconds || 0;
          deadlinePassed = now > toSeconds;
        }
        
        // Student can only submit if deadline hasn't passed
        setCanSubmit(!deadlinePassed);
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load attempt data');
        setLoading(false);
      }
    };

    loadData();
  }, [testId, attemptId, student]);

  const handleSubmit = async () => {
    if (!attemptData || !test || !student || submitting) return;

    try {
      setSubmitting(true);
      
      const { doc, updateDoc, setDoc, Timestamp } = await import('firebase/firestore');
      const { firestore } = await import('@/utils/firebase-client');
      
      // Calculate score from saved answers
      const answers = attemptData.answers || {};
      let correctAnswers = 0;
      let totalMarks = 0;
      const mcqResults: any[] = [];
      const finalAnswers: any[] = [];
      
      test.questions.forEach((question: any, index: number) => {
        const questionId = question.questionId || question.id || `q${index}`;
        const savedAnswer = answers[questionId];
        const questionMarks = question.marks || 1;
        
        // Build final answers array
        const answerValue = savedAnswer?.selectedOption ?? savedAnswer;
        finalAnswers.push({
          questionId,
          selectedOption: typeof answerValue === 'number' ? answerValue : undefined,
          textContent: typeof answerValue === 'string' ? answerValue : undefined,
          timeSpent: 0,
          changeCount: 0,
          wasReviewed: false
        });
        
        if (savedAnswer !== undefined) {
          if (question.type === 'mcq' || question.questionType === 'mcq') {
            const correctOption = question.correctOption ?? question.correctAnswer ?? 0;
            const selectedOption = savedAnswer?.selectedOption ?? savedAnswer;
            const isCorrect = selectedOption === correctOption;
            
            if (isCorrect) {
              correctAnswers++;
              totalMarks += questionMarks;
            }
            
            // Build MCQ results array
            mcqResults.push({
              questionId,
              questionText: question.question || question.questionText || '',
              selectedOption: selectedOption,
              correctOption: correctOption,
              selectedOptionText: question.options?.[selectedOption] || '',
              correctOptionText: question.options?.[correctOption] || '',
              isCorrect,
              marksAwarded: isCorrect ? questionMarks : 0,
              maxMarks: questionMarks
            });
          }
        }
      });
      
      const maxMarks = test.totalMarks || test.questions.length;
      const percentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;
      const passingScore = (test as any).config?.passingScore || 50;
      const passStatus = percentage >= passingScore ? 'passed' : 'failed';
      
      const submittedAt = Timestamp.now();
      
      // Update the attempt with submission data
      await updateDoc(doc(firestore, 'testAttempts', attemptId!), {
        status: 'submitted',
        submittedAt,
        autoGradedScore: totalMarks,
        score: totalMarks,
        percentage,
        maxScore: maxMarks,
        correctAnswers,
        totalQuestions: test.questions.length,
        submissionType: 'incomplete_submission',
        submissionNote: 'Submitted from incomplete attempt review - answers were saved but not submitted before time expired',
        gradedAt: submittedAt,
        isAutoGraded: true
      });
      
      console.log('✅ Attempt document updated');
      
      // Create submission document in submissions collection
      // This is required for the result page to find the submission
      const submissionData = {
        id: attemptId,
        testId: test.id,
        testTitle: test.title || 'Untitled Test',
        testType: test.type,
        studentId: student.id,
        studentName: student.name || 'Unknown Student',
        studentEmail: student.email || '',
        classId: attemptData.classId || '',
        className: attemptData.className || 'Unknown Class',
        attemptNumber: attemptData.attemptNumber || 1,
        status: 'submitted',
        startTime: attemptData.startedAt || attemptData.createdAt,
        endTime: attemptData.endTime,
        submittedAt,
        totalTimeSpent: attemptData.timeSpent || 0,
        questionsAttempted: Object.keys(answers).length,
        questionsSkipped: test.questions.length - Object.keys(answers).length,
        questionsReviewed: 0,
        totalChanges: 0,
        autoGradedScore: totalMarks,
        manualGradingPending: false,
        totalScore: totalMarks,
        maxScore: maxMarks,
        percentage,
        passStatus,
        finalAnswers,
        mcqResults,
        essayResults: [],
        submissionType: 'incomplete_submission',
        submissionNote: 'Submitted from incomplete attempt review - answers were saved but not submitted before time expired',
        createdAt: submittedAt,
        updatedAt: submittedAt
      };
      
      await setDoc(doc(firestore, 'submissions', attemptId!), submissionData);
      
      console.log('✅ Submission document created');
      console.log('✅ Incomplete attempt submitted successfully');
      
      // Redirect to results page with submission ID
      router.push(`/student/test/${testId}/result?submissionId=${attemptId}`);
      
    } catch (err) {
      console.error('Error submitting attempt:', err);
      setError('Failed to submit attempt. Please try again.');
      setSubmitting(false);
    }
  };

  const getQuestionAnswer = (questionIndex: number, question: any) => {
    if (!attemptData?.answers) return null;
    
    const questionId = question.questionId || question.id || `q${questionIndex}`;
    const answer = attemptData.answers[questionId];
    
    return answer;
  };

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleString('en-AU', {
      timeZone: 'Australia/Melbourne',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (authLoading || loading) {
    return (
      <StudentLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading attempt data...</p>
          </div>
        </div>
      </StudentLayout>
    );
  }

  if (error) {
    return (
      <StudentLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </div>
        </div>
      </StudentLayout>
    );
  }

  if (!test || !attemptData) {
    return (
      <StudentLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Not Found</h2>
            <p className="text-gray-600 mb-4">Could not find the attempt data.</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </div>
        </div>
      </StudentLayout>
    );
  }

  const answeredQuestions = attemptData.answers ? Object.keys(attemptData.answers).length : 0;
  const totalQuestions = test.questions.length;

  return (
    <StudentLayout>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Test
            </button>
            
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Review Incomplete Attempt
                </h1>
                <p className="text-gray-600">{test.title}</p>
              </div>
              <div className={`px-4 py-2 rounded-lg ${canSubmit ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  <span className="font-medium">
                    {canSubmit ? 'Incomplete Attempt' : 'Deadline Passed'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Attempt Summary */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Attempt Summary
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Started At</p>
                <p className="font-medium">{formatDateTime(attemptData.startedAt)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Questions Answered</p>
                <p className="font-medium">{answeredQuestions} / {totalQuestions}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Unanswered</p>
                <p className="font-medium text-orange-600">{totalQuestions - answeredQuestions}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-medium text-orange-600">Not Submitted</p>
              </div>
            </div>
          </div>

          {/* Questions Review */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Your Saved Answers (Read-Only)
            </h2>
            
            <div className="space-y-6">
              {test.questions.map((question: any, index: number) => {
                const answer = getQuestionAnswer(index, question);
                const hasAnswer = answer !== null && answer !== undefined;
                
                return (
                  <div 
                    key={index} 
                    className={`border rounded-lg p-4 ${hasAnswer ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mr-3 ${
                          hasAnswer ? 'bg-green-500 text-white' : 'bg-orange-400 text-white'
                        }`}>
                          {index + 1}
                        </span>
                        <span className={`text-sm font-medium ${hasAnswer ? 'text-green-700' : 'text-orange-700'}`}>
                          {hasAnswer ? '✓ Answered' : '○ Not Answered'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {question.marks || 1} mark{(question.marks || 1) > 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    <p className="text-gray-900 mb-3">
                      {question.questionText || question.content || question.title || `Question ${index + 1}`}
                    </p>
                    
                    {question.imageUrl && (
                      <img 
                        src={question.imageUrl} 
                        alt={`Question ${index + 1}`}
                        className="max-w-full h-auto rounded-lg mb-3 max-h-48 object-contain"
                      />
                    )}
                    
                    {/* MCQ Options */}
                    {(question.type === 'mcq' || question.questionType === 'mcq') && question.options && (
                      <div className="space-y-2">
                        {question.options.map((option: any, optIndex: number) => {
                          const optionText = typeof option === 'string' ? option : option?.text || String(option);
                          const isSelected = answer === optIndex || answer?.selectedOption === optIndex;
                          
                          return (
                            <div 
                              key={optIndex}
                              className={`p-3 rounded-lg border ${
                                isSelected 
                                  ? 'border-blue-500 bg-blue-50' 
                                  : 'border-gray-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mr-3 ${
                                  isSelected 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {String.fromCharCode(65 + optIndex)}
                                </span>
                                <span className={isSelected ? 'text-blue-900 font-medium' : 'text-gray-700'}>
                                  {optionText}
                                </span>
                                {isSelected && (
                                  <CheckCircle className="h-5 w-5 text-blue-500 ml-auto" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Essay/Text Answer */}
                    {(question.type === 'essay' || question.questionType === 'essay') && (
                      <div className="mt-2">
                        {hasAnswer && answer?.textAnswer ? (
                          <div className="p-3 bg-white border border-gray-200 rounded-lg">
                            <p className="text-gray-700 whitespace-pre-wrap">{answer.textAnswer}</p>
                          </div>
                        ) : (
                          <p className="text-orange-600 italic">No answer provided</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit Section */}
          <div className={`rounded-lg shadow-lg p-6 ${canSubmit ? 'bg-white' : 'bg-red-50'}`}>
            {canSubmit ? (
              <>
                <div className="flex items-center mb-4">
                  <AlertTriangle className="h-6 w-6 text-orange-500 mr-3" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Ready to Submit?</h3>
                    <p className="text-sm text-gray-600">
                      You answered {answeredQuestions} out of {totalQuestions} questions. 
                      Unanswered questions will be marked as incorrect.
                    </p>
                  </div>
                </div>
                
                <div className="flex space-x-4">
                  <Button
                    onClick={() => router.back()}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 bg-orange-500 hover:bg-orange-600"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit Incomplete Attempt
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start mb-4">
                  <XCircle className="h-6 w-6 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-800">Test Deadline Has Passed</h3>
                    <p className="text-sm text-red-700 mt-1">
                      You cannot submit this attempt because the test deadline has passed. 
                      Your answers have been saved, but you need teacher approval to submit.
                    </p>
                  </div>
                </div>
                
                <div className="bg-red-100 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-red-800 mb-2">📧 What to do next:</p>
                  <ol className="text-sm text-red-700 list-decimal list-inside space-y-1">
                    <li>Contact your teacher: <span className="font-bold">{test.teacherName || 'Your Teacher'}</span></li>
                    <li>Explain that you have an incomplete submission for "{test.title}"</li>
                    <li>Ask them to review and approve your submission from the teacher portal</li>
                  </ol>
                </div>
                
                <Button
                  onClick={() => router.push('/student/test')}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Return to Tests
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
