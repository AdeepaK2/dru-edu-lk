// Student submission service - handles final submissions to Firestore
// Processes real-time data and creates final submission records with attempt tracking

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  writeBatch,
  Timestamp 
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { 
  StudentSubmission, 
  FinalAnswer, 
  MCQResult, 
  EssayResult,
  RealtimeTestSession 
} from '@/models/studentSubmissionSchema';
import { Test, TestQuestion } from '@/models/testSchema';
import { TestAttempt } from '@/models/attemptSchema';
import { TestService } from './testService';
import { RealtimeTestService } from './realtimeTestService';
import { AttemptManagementService } from './attemptManagementService';

export class SubmissionService {
  private static COLLECTIONS = {
    SUBMISSIONS: 'studentSubmissions',
    TESTS: 'tests',
    MCQ_RESULTS: 'mcqResults',
    ESSAY_RESULTS: 'essayResults'
  };

  // Helper function to remove undefined values recursively
  private static removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    // Preserve Firestore Timestamp objects
    if (obj && typeof obj.toDate === 'function') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedValues(item)).filter(item => item !== undefined);
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.removeUndefinedValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  // Process final submission from realtime data
  static async processSubmission(
    attemptId: string,
    isAutoSubmitted: boolean = false
  ): Promise<StudentSubmission> {
    try {
      console.log('🔄 Processing submission for attempt:', attemptId);
      
      // Get realtime session data
      const realtimeSession = await RealtimeTestService.getSession(attemptId);
      if (!realtimeSession) {
        throw new Error('Realtime session not found');
      }

      // Debug: Log the entire realtime session structure
      console.log('🔍 Full realtime session structure:', JSON.stringify(realtimeSession, null, 2));
      console.log('🔍 Available fields in realtime session:', Object.keys(realtimeSession));
      console.log('🔍 Session studentId:', realtimeSession.studentId);
      console.log('🔍 Session testId:', realtimeSession.testId);
      console.log('🔍 Session answers count:', Object.keys(realtimeSession.answers || {}).length);

      // Try to repair session integrity if critical fields are missing
      const hasMissingCriticalData = !realtimeSession.testId || !realtimeSession.studentId;
      if (hasMissingCriticalData) {
        console.warn('⚠️ Attempting to repair session integrity before fallback logic...');
        
        // Try to get missing data from localStorage first
        const fallbackTestId = typeof window !== 'undefined' ? 
          (window.location.pathname.match(/\/test\/([^\/]+)/) || [])[1] : null;
        const fallbackStudentId = typeof window !== 'undefined' ? 
          localStorage.getItem('studentId') : null;
        const fallbackStudentName = typeof window !== 'undefined' ? 
          localStorage.getItem('studentName') : null;
        
        await RealtimeTestService.repairSessionIntegrity(
          attemptId,
          realtimeSession.testId || fallbackTestId || undefined,
          realtimeSession.studentId || fallbackStudentId || undefined,
          realtimeSession.studentName || fallbackStudentName || undefined,
          realtimeSession.classId
        );
        
        // Re-fetch the session after repair attempt
        const repairedSession = await RealtimeTestService.getSession(attemptId);
        if (repairedSession) {
          Object.assign(realtimeSession, repairedSession);
          console.log('🔧 Session after repair attempt:', {
            hasTestId: !!realtimeSession.testId,
            hasStudentId: !!realtimeSession.studentId
          });
        }
      }

      // Check if this is a partially corrupted session that only has answer data
      const hasOnlyAnswerData = !realtimeSession.testId && !realtimeSession.studentId && realtimeSession.answers;
      const missingCriticalData = !realtimeSession.testId || !realtimeSession.studentId;
      
      if (hasOnlyAnswerData || missingCriticalData) {
        console.warn('⚠️ Detected session missing critical metadata. Attempting to reconstruct...');
        
        // Try to get missing data from the attempt document first
        try {
          const { getDoc: getDocFromFirestore, doc: docFromFirestore } = await import('firebase/firestore');
          const attemptDoc = await getDocFromFirestore(docFromFirestore(firestore, 'attempts', attemptId));
          
          if (attemptDoc.exists()) {
            const attemptData = attemptDoc.data() as TestAttempt;
            console.log('🔍 Attempt document data:', JSON.stringify(attemptData, null, 2));
            
            if (!realtimeSession.testId && attemptData.testId) {
              realtimeSession.testId = attemptData.testId;
              console.log('🔧 Using testId from attempt document:', attemptData.testId);
            }
            if (!realtimeSession.studentId && attemptData.studentId) {
              realtimeSession.studentId = attemptData.studentId;
              console.log('🔧 Using studentId from attempt document:', attemptData.studentId);
            }
            if (!realtimeSession.studentName && attemptData.studentName) {
              realtimeSession.studentName = attemptData.studentName;
              console.log('🔧 Using studentName from attempt document:', attemptData.studentName);
            }
            if (!realtimeSession.classId && attemptData.classId) {
              realtimeSession.classId = attemptData.classId;
              console.log('🔧 Using classId from attempt document:', attemptData.classId);
            }
            
            // Set reasonable defaults for missing timing data
            if (!realtimeSession.startTime && (attemptData as any).startTime) {
              const startTimeMs = (attemptData as any).startTime.toMillis ? (attemptData as any).startTime.toMillis() : (attemptData as any).startTime;
              realtimeSession.startTime = startTimeMs;
              console.log('🔧 Using startTime from attempt document:', startTimeMs);
            }
            
            // If still no startTime, use current time minus some reasonable duration
            if (!realtimeSession.startTime) {
              realtimeSession.startTime = Date.now() - (30 * 60 * 1000); // Assume 30 minutes ago
              console.log('🔧 Using fallback startTime (30min ago):', realtimeSession.startTime);
            }
          } else {
            console.warn('⚠️ Attempt document not found for attemptId:', attemptId);
          }
        } catch (attemptError) {
          console.error('❌ Error accessing attempt document:', attemptError);
        }
        
        // If studentId is still missing, try to get it from browser storage or URL
        if (!realtimeSession.studentId) {
          try {
            // Check if studentId is available in localStorage/sessionStorage
            if (typeof window !== 'undefined') {
              const storedStudentId = localStorage.getItem('studentId') || sessionStorage.getItem('studentId');
              const storedStudentName = localStorage.getItem('studentName') || sessionStorage.getItem('studentName');
              
              if (storedStudentId) {
                realtimeSession.studentId = storedStudentId;
                console.log('🔧 Using studentId from browser storage:', storedStudentId);
              }
              
              if (storedStudentName && !realtimeSession.studentName) {
                realtimeSession.studentName = storedStudentName;
                console.log('🔧 Using studentName from browser storage:', storedStudentName);
              }
            }
          } catch (storageError) {
            console.error('❌ Error accessing browser storage for studentId:', storageError);
          }
        }

        // If studentId is still missing, try to get it from Firebase Auth
        if (!realtimeSession.studentId) {
          try {
            const { auth } = await import('@/utils/firebase-client');
            const currentUser = auth.currentUser;
            
            if (currentUser) {
              // Try to get the student document using the user's UID
              const { query, collection, where, getDocs } = await import('firebase/firestore');
              const { firestore } = await import('@/utils/firebase-client');
              
              const studentsQuery = query(
                collection(firestore, 'students'),
                where('uid', '==', currentUser.uid)
              );
              
              const studentsSnapshot = await getDocs(studentsQuery);
              
              if (!studentsSnapshot.empty) {
                const studentDoc = studentsSnapshot.docs[0];
                realtimeSession.studentId = studentDoc.id;
                realtimeSession.studentName = studentDoc.data().name || currentUser.displayName || 'Anonymous Student';
                console.log('🔧 Using studentId from Firebase Auth:', studentDoc.id);
              }
            }
          } catch (authError) {
            console.error('❌ Error accessing Firebase Auth for studentId:', authError);
          }
        }
        
        // If testId is still missing, try to extract from URL
        if (!realtimeSession.testId) {
          try {
            if (typeof window !== 'undefined' && window.location) {
              const urlMatch = window.location.pathname.match(/\/test\/([^\/]+)\/take/);
              if (urlMatch && urlMatch[1]) {
                realtimeSession.testId = urlMatch[1];
                console.log('🔧 Extracted testId from URL:', urlMatch[1]);
              }
            }
          } catch (urlError) {
            console.error('❌ Error extracting testId from URL:', urlError);
          }
        }
      }

      // Final validation with additional fallbacks
      if (!realtimeSession.testId) {
        console.error('❌ Test ID still missing after all fallback attempts.');
        console.error('Available fields:', Object.keys(realtimeSession));
        console.error('Session data:', realtimeSession);
        throw new Error('Test ID not found in realtime session. Please try refreshing the page and starting the test again.');
      }
      
      if (!realtimeSession.studentId) {
        console.error('❌ Student ID still missing after all fallback attempts.');
        console.error('Available fields:', Object.keys(realtimeSession));
        console.error('Session data:', realtimeSession);
        console.error('LocalStorage studentId:', typeof window !== 'undefined' ? localStorage.getItem('studentId') : 'N/A (server)');
        throw new Error('Student ID not found in realtime session. Please try refreshing the page and logging in again.');
      }

      // Ensure we have essential timing data
      if (!realtimeSession.startTime) {
        realtimeSession.startTime = Date.now() - (30 * 60 * 1000); // Default: 30 minutes ago
        console.warn('⚠️ Using fallback startTime:', realtimeSession.startTime);
      }
      
      if (!realtimeSession.lastActivity) {
        realtimeSession.lastActivity = Date.now();
        console.warn('⚠️ Using current time as lastActivity:', realtimeSession.lastActivity);
      }

      console.log('📊 Realtime session data:', {
        testId: realtimeSession.testId,
        studentId: realtimeSession.studentId,
        studentName: realtimeSession.studentName
      });

      // Get test data
      const testDoc = await getDoc(doc(firestore, this.COLLECTIONS.TESTS, realtimeSession.testId));
      if (!testDoc.exists()) {
        throw new Error('Test not found');
      }
      const test = { id: testDoc.id, ...testDoc.data() } as Test;

      // Validate test data
      if (!test.questions || !Array.isArray(test.questions)) {
        console.warn('Test questions not found or invalid, using empty array');
        test.questions = [];
      }

      console.log('📊 Test data loaded:', {
        testId: test.id,
        title: test.title,
        questionsCount: test.questions?.length || 0
      });

      // Get attempt information to determine correct attempt number and class info
      let attemptInfo;
      try {
        attemptInfo = await AttemptManagementService.getAttemptSummary(realtimeSession.testId, realtimeSession.studentId);
      } catch (attemptError) {
        console.error('Error getting attempt summary:', attemptError);
        // Create a fallback attempt info
        attemptInfo = {
          testId: realtimeSession.testId,
          studentId: realtimeSession.studentId,
          totalAttempts: 0,
          attemptsAllowed: 1,
          canCreateNewAttempt: false,
          attempts: []
        };
      }
      
      // Get the actual attempt to get className
      let attemptData = null;
      try {
        const { getDoc: getDocFromFirestore, doc: docFromFirestore } = await import('firebase/firestore');
        const attemptDoc = await getDocFromFirestore(docFromFirestore(firestore, 'attempts', attemptId));
        attemptData = attemptDoc.exists() ? attemptDoc.data() as TestAttempt : null;
      } catch (attemptDocError) {
        console.error('Error getting attempt document:', attemptDocError);
      }
      
      console.log('📊 Attempt info for submission:', attemptInfo);
      console.log('📊 Attempt data for submission:', attemptData);

      // Process answers and calculate scores
      const { finalAnswers, mcqResults, autoGradedScore, manualGradingPending } = 
        await this.processAnswers(realtimeSession, test);

      // Create submission object
      const submission: StudentSubmission = {
        id: attemptId,
        
        // Test info
        testId: test.id,
        testTitle: test.title || '',
        testType: test.type || 'mixed',
        
        // Student info
        studentId: realtimeSession.studentId || '',
        studentName: realtimeSession.studentName || '',
        studentEmail: '', // Would get from student profile
        classId: realtimeSession.classId || '',
        className: attemptData?.className || 'Unknown Class',
        
        // Attempt details
        attemptNumber: attemptInfo.totalAttempts + 1,
        status: isAutoSubmitted ? 'auto_submitted' : 'submitted',
        
        // Timing
        startTime: Timestamp.fromMillis(realtimeSession.startTime),
        endTime: Timestamp.fromMillis(realtimeSession.lastActivity),
        submittedAt: Timestamp.now(),
        totalTimeSpent: Math.floor((realtimeSession.lastActivity - realtimeSession.startTime) / 1000),
        timePerQuestion: realtimeSession.timePerQuestion || {},
        
        // Final answers
        finalAnswers,
        
        // Statistics
        questionsAttempted: Object.keys(realtimeSession.answers || {}).length,
        questionsSkipped: (test.questions?.length || 0) - Object.keys(realtimeSession.answers || {}).length,
        questionsReviewed: (realtimeSession.questionsMarkedForReview || []).length,
        totalChanges: this.calculateTotalChanges(realtimeSession),
        
        // Results
        autoGradedScore: autoGradedScore || 0,
        manualGradingPending,
        maxScore: test.totalMarks || 0,
        percentage: autoGradedScore ? Math.round((autoGradedScore / (test.totalMarks || 1)) * 100) : 0,
        passStatus: manualGradingPending ? 'pending_review' : 
                   (autoGradedScore && autoGradedScore >= ((test.totalMarks || 0) * 0.6)) ? 'passed' : 'failed',
        
        // Grading details
        mcqResults,
        essayResults: [], // Will be populated during manual grading
        
        // Integrity monitoring
        integrityReport: {
          tabSwitches: realtimeSession.tabSwitchCount || 0,
          disconnections: realtimeSession.disconnectionCount || 0,
          suspiciousActivities: this.extractSuspiciousActivities(realtimeSession),
          isIntegrityCompromised: this.assessIntegrityCompromise(realtimeSession),
          notes: this.generateIntegrityNotes(realtimeSession)
        },
        
        // Metadata
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      // Save to Firestore
      const cleanSubmission = this.removeUndefinedValues(submission);
      await setDoc(doc(firestore, this.COLLECTIONS.SUBMISSIONS, attemptId), cleanSubmission);
      
      // Clean up realtime session
      await RealtimeTestService.cleanupSession(attemptId);
      
      console.log('✅ Submission processed successfully:', attemptId);
      return submission;
    } catch (error) {
      console.error('Error processing submission:', error);
      throw error;
    }
  }

  // Process answers and calculate scores
  private static async processAnswers(
    session: RealtimeTestSession,
    test: Test
  ): Promise<{
    finalAnswers: FinalAnswer[];
    mcqResults: MCQResult[];
    autoGradedScore: number;
    manualGradingPending: boolean;
  }> {
    const finalAnswers: FinalAnswer[] = [];
    const mcqResults: MCQResult[] = [];
    let autoGradedScore = 0;
    let manualGradingPending = false;

    // Safety check for test questions
    if (!test.questions || !Array.isArray(test.questions)) {
      console.error('Test questions not found or invalid:', test);
      return { finalAnswers, mcqResults, autoGradedScore, manualGradingPending };
    }

    // Safety check for session answers
    if (!session.answers) {
      console.error('Session answers not found:', session);
      return { finalAnswers, mcqResults, autoGradedScore, manualGradingPending };
    }

    for (const question of test.questions) {
      console.log('🔍 Processing question:', {
        id: question.id,
        type: question.type,
        hasQuestionData: !!question.questionData,
        hasOptions: !!(question.questionData?.options || question.options)
      });
      
      const answer = session.answers[question.id];
      const questionData = question; // Assuming question data is embedded

      if (answer) {
        // Create final answer
        const finalAnswer: FinalAnswer = {
          questionId: question.id || '',
          questionType: question.type || 'mcq',
          questionText: questionData.questionText || '',
          questionMarks: question.marks || 0,
          selectedOption: answer.selectedOption as number,
          selectedOptionText: question.type === 'mcq' && answer.selectedOption !== undefined 
            ? question.options?.[answer.selectedOption as number] || '' : '',
          textContent: answer.textContent || '',
          pdfFiles: answer.pdfFiles || [], // Include PDF files for essay questions
          timeSpent: answer.timeSpent || 0,
          changeCount: answer.changeHistory?.length || 0,
          wasReviewed: answer.isMarkedForReview || false
        };

        // Process MCQ auto-grading
        if (question.type === 'mcq' && answer.selectedOption !== undefined) {
          // Helper function to get option display text
          const getOptionText = (option: any, index: number): string => {
            if (typeof option === 'string') {
              return option;
            } else if (option && option.text && option.text.trim()) {
              return option.text;
            }
            return String.fromCharCode(65 + index); // A, B, C, D
          };
          
          // Find correct option index - use correctOption property
          const correctOptionIndex = question.correctOption || 0;
          
          // Convert selectedOption from ID to index if it's a string
          let selectedOptionIndex: number;
          if (typeof answer.selectedOption === 'string') {
            // Find the index of the selected option by its ID
            const options = question.questionData?.options || question.options || [];
            selectedOptionIndex = options.findIndex(opt => {
              if (typeof opt === 'string') {
                return opt === answer.selectedOption;
              } else if (opt && typeof opt === 'object' && 'id' in opt) {
                return opt.id === answer.selectedOption;
              }
              return false;
            });
            if (selectedOptionIndex === -1) {
              console.warn(`Selected option ID ${answer.selectedOption} not found in question options`);
              selectedOptionIndex = 0; // Default to first option
            }
          } else {
            // If it's already a number, use it directly
            selectedOptionIndex = answer.selectedOption as number;
          }
          
          const isCorrect = selectedOptionIndex === correctOptionIndex;
          const marksAwarded = isCorrect ? (question.marks || 0) : 0;
          
          finalAnswer.isCorrect = isCorrect;
          finalAnswer.marksAwarded = marksAwarded;
          autoGradedScore += marksAwarded;

          // Create MCQ result with proper option text handling
          const options = question.questionData?.options || question.options || [];
          const mcqResult: MCQResult = {
            questionId: question.id || '',
            questionText: questionData.questionText || '',
            selectedOption: selectedOptionIndex,
            selectedOptionText: options[selectedOptionIndex] 
              ? getOptionText(options[selectedOptionIndex], selectedOptionIndex)
              : 'No answer selected',
            correctOption: correctOptionIndex,
            correctOptionText: options[correctOptionIndex] 
              ? getOptionText(options[correctOptionIndex], correctOptionIndex)
              : 'No correct option defined',
            isCorrect,
            marksAwarded,
            maxMarks: question.marks || 0,
            explanation: question.explanation || '',
            difficultyLevel: question.difficultyLevel || 'medium',
            topic: question.topic || ''
          };

          mcqResults.push(mcqResult);
        } else if (question.type === 'essay') {
          // Essay questions need manual grading
          manualGradingPending = true;
        }

        finalAnswers.push(finalAnswer);
      } else {
        // Unanswered question
        const finalAnswer: FinalAnswer = {
          questionId: question.id || '',
          questionType: question.type || 'mcq',
          questionText: questionData.questionText || '',
          questionMarks: question.marks || 0,
          timeSpent: 0,
          changeCount: 0,
          wasReviewed: false,
          isCorrect: false,
          marksAwarded: 0,
          selectedOption: 0,
          selectedOptionText: '',
          textContent: ''
        };
        finalAnswers.push(finalAnswer);
      }
    }

    return { finalAnswers, mcqResults, autoGradedScore, manualGradingPending };
  }

  // Calculate total answer changes
  private static calculateTotalChanges(session: RealtimeTestSession): number {
    if (!session.answers) return 0;
    
    return Object.values(session.answers).reduce(
      (total, answer) => total + (answer.changeHistory?.length || 0), 
      0
    );
  }

  // Extract suspicious activities
  private static extractSuspiciousActivities(session: RealtimeTestSession): string[] {
    const activities: string[] = [];
    
    if ((session.tabSwitchCount || 0) > 3) {
      activities.push(`Excessive tab switching: ${session.tabSwitchCount} times`);
    }
    
    if ((session.suspiciousActivity?.copyPasteAttempts || 0) > 0) {
      activities.push(`Copy/paste attempts: ${session.suspiciousActivity.copyPasteAttempts}`);
    }
    
    if ((session.suspiciousActivity?.rightClickAttempts || 0) > 5) {
      activities.push(`Excessive right-clicking: ${session.suspiciousActivity.rightClickAttempts} times`);
    }
    
    if ((session.suspiciousActivity?.keyboardShortcuts || []).length > 0) {
      activities.push(`Keyboard shortcuts used: ${session.suspiciousActivity.keyboardShortcuts.join(', ')}`);
    }
    
    return activities;
  }

  // Assess integrity compromise
  private static assessIntegrityCompromise(session: RealtimeTestSession): boolean {
    const tabSwitches = session.tabSwitchCount || 0;
    const copyPaste = session.suspiciousActivity?.copyPasteAttempts || 0;
    const disconnections = session.disconnectionCount || 0;
    
    // Define thresholds
    return tabSwitches > 5 || copyPaste > 2 || disconnections > 3;
  }

  // Generate integrity notes
  private static generateIntegrityNotes(session: RealtimeTestSession): string {
    const notes: string[] = [];
    
    if ((session.tabSwitchCount || 0) > 3) {
      notes.push('Student frequently switched browser tabs during test');
    }
    
    if ((session.disconnectionCount || 0) > 1) {
      notes.push('Multiple disconnections detected');
    }
    
    if (!session.isFullscreen) {
      notes.push('Test was not taken in fullscreen mode');
    }
    
    return notes.join('. ');
  }

  // Get submission by ID
  static async getSubmission(submissionId: string): Promise<StudentSubmission | null> {
    try {
      const submissionDoc = await getDoc(
        doc(firestore, this.COLLECTIONS.SUBMISSIONS, submissionId)
      );
      
      if (!submissionDoc.exists()) {
        return null;
      }
      
      const data = submissionDoc.data();
      const submission = {
        id: submissionDoc.id,
        ...data
      } as StudentSubmission;
      
      return submission;
    } catch (error) {
      console.error('Error getting submission:', error);
      throw error;
    }
  }

  // Get submissions for a test
  static async getTestSubmissions(testId: string): Promise<StudentSubmission[]> {
    try {
      const submissionsQuery = query(
        collection(firestore, this.COLLECTIONS.SUBMISSIONS),
        where('testId', '==', testId)
      );
      
      const snapshot = await getDocs(submissionsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StudentSubmission[];
    } catch (error) {
      console.error('Error getting test submissions:', error);
      throw error;
    }
  }

  // Get student submissions
  static async getStudentSubmissions(studentId: string): Promise<StudentSubmission[]> {
    try {
      const submissionsQuery = query(
        collection(firestore, this.COLLECTIONS.SUBMISSIONS),
        where('studentId', '==', studentId)
      );
      
      const snapshot = await getDocs(submissionsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StudentSubmission[];
    } catch (error) {
      console.error('Error getting student submissions:', error);
      throw error;
    }
  }

  // Grade essay question
  static async gradeEssayQuestion(
    submissionId: string,
    questionId: string,
    marksAwarded: number,
    feedback: string,
    teacherId: string
  ): Promise<void> {
    try {
      const batch = writeBatch(firestore);
      
      // Update submission with essay result
      const submissionRef = doc(firestore, this.COLLECTIONS.SUBMISSIONS, submissionId);
      const submission = await this.getSubmission(submissionId);
      
      if (!submission) {
        throw new Error('Submission not found');
      }

      // Create essay result
      const essayResult: EssayResult = {
        questionId,
        questionText: submission.finalAnswers.find(a => a.questionId === questionId)?.questionText || '',
        studentAnswer: submission.finalAnswers.find(a => a.questionId === questionId)?.textContent || '',
        wordCount: submission.finalAnswers.find(a => a.questionId === questionId)?.textContent?.split(' ').length || 0,
        marksAwarded,
        maxMarks: submission.finalAnswers.find(a => a.questionId === questionId)?.questionMarks || 0,
        feedback,
        gradedBy: teacherId,
        gradedAt: Timestamp.now()
      };

      // Update finalAnswers with essay marks
      const updatedFinalAnswers = submission.finalAnswers.map(finalAnswer => {
        if (finalAnswer.questionType === 'essay' && finalAnswer.questionId === questionId) {
          return {
            ...finalAnswer,
            marksAwarded
          };
        }
        return finalAnswer;
      });

      // Update submission
      const updatedEssayResults = [...(submission.essayResults || []), essayResult];
      const totalScore = (submission.autoGradedScore || 0) + 
        updatedEssayResults.reduce((sum, result) => sum + (result.marksAwarded || 0), 0);
      
      batch.update(submissionRef, {
        essayResults: updatedEssayResults,
        finalAnswers: updatedFinalAnswers,
        totalScore,
        percentage: Math.round((totalScore / submission.maxScore) * 100),
        passStatus: totalScore >= (submission.maxScore * 0.6) ? 'passed' : 'failed',
        manualGradingPending: false, // Assuming this was the last essay question
        updatedAt: Timestamp.now()
      });

      await batch.commit();
      console.log('✅ Essay question graded successfully');
    } catch (error) {
      console.error('Error grading essay question:', error);
      throw error;
    }
  }

  // Batch process submissions (for when test ends)
  static async batchProcessSubmissions(testId: string): Promise<void> {
    try {
      console.log('🔄 Batch processing submissions for test:', testId);
      
      // This would be called when a test ends to process all remaining submissions
      // Implementation would get all active sessions for the test and process them
      
      console.log('✅ Batch processing completed for test:', testId);
    } catch (error) {
      console.error('Error batch processing submissions:', error);
      throw error;
    }
  }

  // Get submissions by test ID for marking
  static async getSubmissionsByTest(testId: string): Promise<StudentSubmission[]> {
    try {
      console.log('🔍 Loading submissions for test:', testId);
      
      const submissionsRef = collection(firestore, this.COLLECTIONS.SUBMISSIONS);
      const q = query(submissionsRef, where('testId', '==', testId));
      const snapshot = await getDocs(q);
      
      const submissions: StudentSubmission[] = [];
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data() as StudentSubmission;
        
        // Try to get student details if missing
        let studentName = data.studentName || 'Unknown Student';
        let studentEmail = data.studentEmail || 'unknown@email.com';
        
        // If student info is missing, try to fetch from students collection
        if (!data.studentName || !data.studentEmail || data.studentName === '' || data.studentEmail === '') {
          try {
            const { doc: docRef, getDoc: getDocFirestore } = await import('firebase/firestore');
            const studentDoc = await getDocFirestore(docRef(firestore, 'students', data.studentId));
            
            if (studentDoc.exists()) {
              const studentData = studentDoc.data();
              studentName = studentData.name || studentData.firstName || data.studentName || 'Unknown Student';
              studentEmail = studentData.email || data.studentEmail || 'unknown@email.com';
            }
          } catch (studentError) {
            console.warn('Could not fetch student details for:', data.studentId, studentError);
          }
        }
        
        submissions.push({
          ...data,
          id: docSnapshot.id,
          studentName,
          studentEmail
        });
      }
      
      console.log('✅ Found submissions:', submissions.length);
      return submissions;
    } catch (error) {
      console.error('Error getting submissions by test:', error);
      throw error;
    }
  }

  // Update essay grades for a submission
  static async updateEssayGrades(submissionId: string, grades: Array<{questionId: string, score: number, maxScore: number, feedback: string}>): Promise<void> {
    try {
      const submissionRef = doc(firestore, this.COLLECTIONS.SUBMISSIONS, submissionId);
      const submissionDoc = await getDoc(submissionRef);
      
      if (!submissionDoc.exists()) {
        throw new Error('Submission not found');
      }
      
      const submission = submissionDoc.data() as StudentSubmission;
      
      // Update essay results
      const essayResults: EssayResult[] = grades.map(grade => {
        // Ensure score and maxScore are valid numbers
        const score = typeof grade.score === 'number' ? grade.score : Number(grade.score) || 0;
        const maxScore = typeof grade.maxScore === 'number' ? grade.maxScore : Number(grade.maxScore) || 0;
        
        return {
          questionId: grade.questionId,
          questionText: submission.finalAnswers.find(a => a.questionId === grade.questionId)?.questionText || '',
          studentAnswer: submission.finalAnswers.find(a => a.questionId === grade.questionId)?.textContent || '',
          wordCount: submission.finalAnswers.find(a => a.questionId === grade.questionId)?.textContent?.split(' ').length || 0,
          marksAwarded: score,
          maxMarks: maxScore,
          feedback: grade.feedback,
          gradedBy: 'teacher', // TODO: Get actual teacher ID from context
          gradedAt: Timestamp.now()
        };
      });
      
      // Update finalAnswers with essay marks
      const updatedFinalAnswers = submission.finalAnswers.map(finalAnswer => {
        if (finalAnswer.questionType === 'essay') {
          const grade = grades.find(g => g.questionId === finalAnswer.questionId);
          if (grade) {
            const score = typeof grade.score === 'number' ? grade.score : Number(grade.score) || 0;
            return {
              ...finalAnswer,
              marksAwarded: score
            };
          }
        }
        return finalAnswer;
      });
      
      // Calculate total score
      const essayScore = grades.reduce((sum, grade) => {
        const score = typeof grade.score === 'number' ? grade.score : Number(grade.score) || 0;
        return sum + score;
      }, 0);
      const totalScore = (submission.autoGradedScore || 0) + essayScore;
      const percentage = Math.round((totalScore / submission.maxScore) * 100);
      
      // Check if all essay questions have been graded
      const allEssayQuestions = submission.finalAnswers.filter(fa => fa.questionType === 'essay');
      const gradedEssayQuestions = essayResults.filter(er => er.marksAwarded !== undefined && er.marksAwarded !== null);
      const allEssayQuestionsGraded = allEssayQuestions.length === gradedEssayQuestions.length && allEssayQuestions.length > 0;
      
      // Update submission
      const updateData = {
        essayResults,
        finalAnswers: updatedFinalAnswers,
        totalScore,
        percentage,
        passStatus: percentage >= 60 ? 'passed' : 'failed',
        manualGradingPending: !allEssayQuestionsGraded,
        updatedAt: Timestamp.now()
      };
      
      await updateDoc(submissionRef, updateData);
      
      console.log('✅ Essay grades updated successfully');
    } catch (error) {
      console.error('Error updating essay grades:', error);
      throw error;
    }
  }
}
