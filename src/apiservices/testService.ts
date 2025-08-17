// Test service for managing tests and attempts

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  writeBatch,
  onSnapshot,
  Timestamp,
  increment
} from 'firebase/firestore';
import { firestore, auth } from '@/utils/firebase-client';
import { 
  Test, 
  LiveTest, 
  FlexibleTest, 
  TestAttempt, 
  TestAnalytics,
  TestQuestion,
  StudentAnswer,
  MCQAnswer,
  EssayAnswer,
  QuestionBankSelection,
  TestConfig,
  AttemptStatus
} from '@/models/testSchema';
import { Question, MCQQuestion, EssayQuestion } from '@/models/questionBankSchema';

export class TestService {
  private static readonly COLLECTIONS = {
    TESTS: 'tests',
    ATTEMPTS: 'test_attempts',
    ANALYTICS: 'test_analytics',
    NOTIFICATIONS: 'test_notifications'
  };

  // Create a new test
  static async createTest(testData: Omit<Test, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      console.log('🔍 Creating test with data:', testData);
      console.log('🔍 Current user auth state:', auth.currentUser);
      
      // Convert questions to TestQuestion format if they're not already converted
      let processedQuestions = testData.questions || [];
      
      // Check if questions need conversion (if they have the Question format instead of TestQuestion format)
      if (processedQuestions.length > 0) {
        const firstQuestion = processedQuestions[0];
        console.log('🔍 First question structure:', firstQuestion);
        
        // If the question has 'title' and 'createdAt' (Question format) but not 'questionId' (TestQuestion format), it needs conversion
        if (firstQuestion && 'title' in firstQuestion && 'createdAt' in firstQuestion && !('questionId' in firstQuestion)) {
          console.log('🔍 Converting questions from Question format to TestQuestion format');
          processedQuestions = processedQuestions.map((question, index) => 
            this.convertToTestQuestion(question as unknown as Question, index + 1)
          );
        } else {
          console.log('🔍 Questions already in TestQuestion format, no conversion needed');
        }
      }
      
      const testDataWithConvertedQuestions = {
        ...testData,
        questions: processedQuestions
      };
      
      // Debug the final test data to find undefined values
      console.log('🔍 Final test data before Firebase:', {
        testDataKeys: Object.keys(testDataWithConvertedQuestions),
        questionsCount: testDataWithConvertedQuestions.questions?.length,
        firstQuestionKeys: testDataWithConvertedQuestions.questions?.[0] ? Object.keys(testDataWithConvertedQuestions.questions[0]) : null,
        firstQuestionValues: testDataWithConvertedQuestions.questions?.[0] ? Object.entries(testDataWithConvertedQuestions.questions[0]).filter(([key, value]) => value === undefined) : null
      });
      
      // Clean the test data to remove undefined values
      const cleanedTestData = this.removeUndefinedFields(testDataWithConvertedQuestions);
      
      console.log('🧹 Cleaned test data before Firebase:', cleanedTestData);
      
      const docRef = await addDoc(collection(firestore, this.COLLECTIONS.TESTS), {
        ...cleanedTestData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      console.log('✅ Test created successfully with ID:', docRef.id);
      
      // Send email notifications to students and parents
      try {
        await this.sendTestCreationNotifications(docRef.id, cleanedTestData);
      } catch (notificationError) {
        // Don't fail test creation if notifications fail
        console.warn('⚠️ Failed to send test notifications (test still created successfully):', notificationError);
      }
      
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating test:', error);
      
      // More detailed error logging
      if (error instanceof Error) {
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
      }
      
      throw error; // Re-throw to preserve the original error
    }
  }

  // Update test
  static async updateTest(testId: string, updates: Partial<Test>): Promise<void> {
    try {
      const testRef = doc(firestore, this.COLLECTIONS.TESTS, testId);
      await updateDoc(testRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating test:', error);
      throw new Error('Failed to update test');
    }
  }

  // Get test by ID
  static async getTest(testId: string): Promise<Test | null> {
    try {
      const testDoc = await getDoc(doc(firestore, this.COLLECTIONS.TESTS, testId));
      if (!testDoc.exists()) return null;
      
      return {
        id: testDoc.id,
        ...testDoc.data()
      } as Test;
    } catch (error) {
      console.error('Error fetching test:', error);
      throw new Error('Failed to fetch test');
    }
  }

  // Get test by ID
  static async getTestById(testId: string): Promise<Test> {
    try {
      const testRef = doc(firestore, 'tests', testId);
      const testDoc = await getDoc(testRef);
      
      if (!testDoc.exists()) {
        throw new Error('Test not found');
      }
      
      return {
        id: testDoc.id,
        ...testDoc.data()
      } as Test;
    } catch (error) {
      console.error('Error getting test by ID:', error);
      throw error;
    }
  }

  // Get tests for teacher
  static async getTeacherTests(teacherId: string): Promise<Test[]> {
    try {
      console.log('🔍 Fetching tests for teacher ID:', teacherId);
      
      const testsQuery = query(
        collection(firestore, this.COLLECTIONS.TESTS),
        where('teacherId', '==', teacherId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(testsQuery);
      const tests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Test[];
      
      // Filter out soft-deleted tests in JavaScript (to handle tests without isDeleted field)
      const activeTests = tests.filter(test => test.isDeleted !== true);
      
      console.log('✅ Found', activeTests.length, 'active tests for teacher (filtered from', tests.length, 'total)');
      return activeTests;
    } catch (error) {
      console.error('Error fetching teacher tests:', error);
      // Return empty array instead of throwing error if it's just a "no results" case
      if (error instanceof Error && error.message.includes('index')) {
        console.warn('Index might not exist yet, returning empty tests array');
        return [];
      }
      throw new Error('Failed to fetch teacher tests');
    }
  }

  // Auto-select questions from lessons
  static async autoSelectQuestions(
    selections: QuestionBankSelection[],
    config: TestConfig
  ): Promise<TestQuestion[]> {
    try {
      const selectedQuestions: TestQuestion[] = [];
      let currentOrder = 1;

      for (const selection of selections) {
        console.log(`🔍 Processing selection for bank: ${selection.bankName} (${selection.bankId})`);
        console.log(`🔍 Lesson IDs: ${selection.lessonIds?.join(', ') || 'none'}`);
        console.log(`🔍 Question count needed: ${selection.questionCount}`);
        
        // Get the question bank to find its questionIds
        console.log(`🔍 Attempting to fetch question bank with ID: ${selection.bankId} from collection: questionBanks`);
        const bankDoc = await getDoc(doc(firestore, 'questionBanks', selection.bankId));
        console.log(`🔍 Bank document exists: ${bankDoc.exists()}`);
        if (!bankDoc.exists()) {
          console.error(`❌ Question bank ${selection.bankId} not found in collection questionBanks`);
          
          // Let's try to list some documents to debug
          try {
            const bankCollection = await getDocs(query(collection(firestore, 'questionBanks'), limit(5)));
            console.log(`🔍 Sample question banks in collection:`, bankCollection.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
          } catch (listError) {
            console.error(`❌ Error listing question banks:`, listError);
          }
          
          continue;
        }
        
        const questionBank = bankDoc.data();
        const questionIds = questionBank.questionIds || [];
        
        console.log(`🔍 Question bank found with ${questionIds.length} questions`);
        
        if (questionIds.length === 0) {
          console.log(`No questions found in bank ${selection.bankName}`);
          continue;
        }

        // Get lesson names if lesson IDs are specified
        let lessonNames: string[] = [];
        if (selection.lessonIds && selection.lessonIds.length > 0) {
          console.log(`🔍 Getting lesson names for IDs: ${selection.lessonIds.join(', ')}`);
          const lessonPromises = selection.lessonIds.map(lessonId => 
            getDoc(doc(firestore, 'lessons', lessonId))
          );
          const lessonDocs = await Promise.all(lessonPromises);
          lessonNames = lessonDocs
            .filter(doc => doc.exists())
            .map(doc => doc.data()?.name)
            .filter(name => name);
          console.log(`🔍 Found lesson names: ${lessonNames.join(', ')}`);
        }

        // Query questions by their IDs (in batches if needed)
        const questions: Question[] = [];
        const batchSize = 10; // Firestore 'in' query limit
        
        console.log(`🔍 Querying ${questionIds.length} questions in batches of ${batchSize}`);
        
        for (let i = 0; i < questionIds.length; i += batchSize) {
          const batch = questionIds.slice(i, i + batchSize);
          const questionsQuery = query(
            collection(firestore, 'questions'),
            where('__name__', 'in', batch)
          );
          
          const snapshot = await getDocs(questionsQuery);
          const batchQuestions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Question[];
          
          console.log(`🔍 Batch ${Math.floor(i/batchSize) + 1}: Found ${batchQuestions.length} questions`);
          questions.push(...batchQuestions);
        }
        
        console.log(`🔍 Total questions retrieved: ${questions.length}`);
        console.log(`🔍 Questions topics: ${questions.map(q => q.topic || 'no-topic').join(', ')}`);

        // Filter by lesson topics if specified
        let filteredQuestions = questions;
        if (lessonNames.length > 0) {
          filteredQuestions = questions.filter(q => 
            q.topic && lessonNames.includes(q.topic)
          );
          console.log(`🔍 After lesson filtering: ${filteredQuestions.length} questions`);
          console.log(`🔍 Filtered questions topics: ${filteredQuestions.map(q => q.topic).join(', ')}`);
        }

        // Filter by question type if specified
        if (config.questionType) {
          const beforeTypeFilter = filteredQuestions.length;
          filteredQuestions = filteredQuestions.filter(q => q.type === config.questionType);
          console.log(`🔍 After type filtering (${config.questionType}): ${filteredQuestions.length} questions (was ${beforeTypeFilter})`);
        }

        console.log(`Found ${filteredQuestions.length} questions for selection from ${selection.bankName}`);

        // Group by difficulty if balance is specified
        if (config.difficultyBalance && selection.difficultyDistribution) {
          const { easy, medium, hard } = selection.difficultyDistribution;
          const easyQs = filteredQuestions.filter(q => q.difficultyLevel === 'easy');
          const mediumQs = filteredQuestions.filter(q => q.difficultyLevel === 'medium');
          const hardQs = filteredQuestions.filter(q => q.difficultyLevel === 'hard');

          // Select required number from each difficulty
          const selectedEasy = this.shuffleArray(easyQs).slice(0, easy);
          const selectedMedium = this.shuffleArray(mediumQs).slice(0, medium);
          const selectedHard = this.shuffleArray(hardQs).slice(0, hard);

          const allSelected = [...selectedEasy, ...selectedMedium, ...selectedHard];
          
          // Convert to TestQuestion format
          for (const question of allSelected) {
            selectedQuestions.push(this.convertToTestQuestion(question, currentOrder++));
          }
        } else {
          // Random selection without difficulty balance
          const shuffled = this.shuffleArray(filteredQuestions);
          const selected = shuffled.slice(0, selection.questionCount);
          
          for (const question of selected) {
            selectedQuestions.push(this.convertToTestQuestion(question, currentOrder++));
          }
        }
      }

      console.log(`🔍 Total selected questions across all banks: ${selectedQuestions.length}`);
      
      if (selectedQuestions.length === 0) {
        console.warn(`⚠️ No questions were selected from any bank`);
      }

      // Shuffle final questions if required
      if (config.shuffleQuestions) {
        return this.shuffleArray(selectedQuestions).map((q, index) => ({
          ...q,
          order: index + 1
        }));
      }

      return selectedQuestions;
    } catch (error) {
      console.error('❌ Error in autoSelectQuestions:', error);
      throw error;
      console.error('Error auto-selecting questions:', error);
      throw new Error('Failed to auto-select questions');
    }
  }

  // Convert Question to TestQuestion
  private static convertToTestQuestion(question: Question, order: number): TestQuestion {
    // Debug the incoming question structure first
    console.log('🔍 INCOMING QUESTION DEBUG:', {
      questionId: question.id,
      questionTitle: question.title,
      questionType: question.type,
      fullQuestionObject: question,
      optionsStructure: question.type === 'mcq' ? (question as any).options : null
    });

    const testQuestion: TestQuestion = {
      id: question.id, // Add the question ID for easy reference
      questionId: question.id,
      questionType: question.type,
      type: question.type, // for backward compatibility
      points: question.points || 1, // Default to 1 if undefined
      marks: question.points || 1, // for backward compatibility
      order,
      questionText: question.title || '',
      content: question.content || '',
      imageUrl: question.imageUrl || undefined,
      difficultyLevel: question.difficultyLevel || 'medium',
      topic: question.topic || '',
      questionData: {
        title: question.title || '',
        content: question.content || '',
        imageUrl: question.imageUrl || undefined
      }
    };

    if (question.type === 'mcq') {
      const mcq = question as MCQQuestion;
      
      // Store options as array of strings for backward compatibility
      testQuestion.options = mcq.options?.map(opt => opt.text) || [];
      
      // Find and store the correct option index
      const correctOptionIndex = mcq.options?.findIndex(opt => opt.isCorrect) || -1;
      
      // Debug logging to see what's happening
      console.log('🔍 Converting MCQ Question:', {
        questionId: question.id,
        questionTitle: question.title,
        options: mcq.options?.map((opt, idx) => ({
          index: idx,
          text: opt.text,
          isCorrect: opt.isCorrect
        })) || [],
        foundCorrectIndex: correctOptionIndex,
        fallbackToZero: correctOptionIndex < 0
      });
      
      testQuestion.correctOption = correctOptionIndex >= 0 ? correctOptionIndex : 0;
      
      // Store explanation - use undefined instead of null for optional fields
      testQuestion.explanation = mcq.explanation || undefined;
      testQuestion.explanationImageUrl = mcq.explanationImageUrl || undefined;
      
      // Also store in questionData for detailed access
      if (testQuestion.questionData) {
        testQuestion.questionData.options = mcq.options?.map((opt, index) => ({
          id: opt.id || `option_${index}`, // Generate ID if missing
          text: opt.text || `Option ${String.fromCharCode(65 + index)}`, // Fallback option text
          imageUrl: opt.imageUrl || undefined
        })) || [];
        testQuestion.questionData.explanation = mcq.explanation || undefined;
        testQuestion.questionData.explanationImageUrl = mcq.explanationImageUrl || undefined;
      }
    }

    // Remove any undefined values from the final object to prevent Firebase errors
    const cleanTestQuestion = this.removeUndefinedFields(testQuestion);

    console.log('🧹 Converted test question (cleaned):', cleanTestQuestion);
    
    return cleanTestQuestion;
  }

  // Helper method to remove undefined fields recursively while preserving Firestore objects
  private static removeUndefinedFields(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    // Preserve Firestore Timestamp objects
    if (obj && typeof obj === 'object' && obj.constructor && obj.constructor.name === 'Timestamp') {
      return obj;
    }
    
    // Preserve other Firestore objects (like DocumentReference, GeoPoint, etc.)
    if (obj && typeof obj === 'object' && obj._delegate) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedFields(item)).filter(item => item !== undefined);
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.removeUndefinedFields(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  // Utility function to shuffle array
  private static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Start test attempt
  static async startTestAttempt(testId: string, studentId: string, studentName: string, classId: string): Promise<string> {
    try {
      // Check if student already has an attempt
      const existingAttemptQuery = query(
        collection(firestore, this.COLLECTIONS.ATTEMPTS),
        where('testId', '==', testId),
        where('studentId', '==', studentId)
      );
      
      const existingSnapshot = await getDocs(existingAttemptQuery);
      if (!existingSnapshot.empty) {
        const existingAttempt = existingSnapshot.docs[0].data() as TestAttempt;
        if (existingAttempt.status === 'in_progress') {
          return existingSnapshot.docs[0].id;
        }
        if (existingAttempt.status === 'submitted' || existingAttempt.status === 'auto_submitted') {
          throw new Error('Test already completed');
        }
      }

      // Get test details
      const test = await this.getTest(testId);
      if (!test) throw new Error('Test not found');

      // Create new attempt
      const attemptData: Omit<TestAttempt, 'id'> = {
        testId,
        testTitle: test.title,
        studentId,
        studentName,
        classId,
        attemptNumber: 1,
        status: 'in_progress',
        startTime: Timestamp.now(),
        timeSpent: 0,
        remainingTime: test.type === 'live' 
          ? (test as LiveTest).duration * 60 
          : (test as FlexibleTest).duration * 60,
        answers: [],
        autoSubmitted: false
      };

      const docRef = await addDoc(collection(firestore, this.COLLECTIONS.ATTEMPTS), attemptData);
      
      // Update test statistics for live tests
      if (test.type === 'live') {
        await updateDoc(doc(firestore, this.COLLECTIONS.TESTS, testId), {
          studentsOnline: increment(1)
        });
      }

      return docRef.id;
    } catch (error) {
      console.error('Error starting test attempt:', error);
      throw new Error('Failed to start test attempt');
    }
  }

  // Save answer
  static async saveAnswer(attemptId: string, answer: StudentAnswer): Promise<void> {
    try {
      const attemptRef = doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId);
      const attemptDoc = await getDoc(attemptRef);
      
      if (!attemptDoc.exists()) {
        throw new Error('Test attempt not found');
      }

      const attempt = attemptDoc.data() as TestAttempt;
      const updatedAnswers = [...attempt.answers];
      
      // Find existing answer for this question and update, or add new
      const existingIndex = updatedAnswers.findIndex(a => a.questionId === answer.questionId);
      if (existingIndex >= 0) {
        updatedAnswers[existingIndex] = answer;
      } else {
        updatedAnswers.push(answer);
      }

      await updateDoc(attemptRef, {
        answers: updatedAnswers,
        timeSpent: attempt.timeSpent + answer.timeSpent
      });
    } catch (error) {
      console.error('Error saving answer:', error);
      throw new Error('Failed to save answer');
    }
  }

  // Submit test
  static async submitTest(attemptId: string, autoSubmitted: boolean = false): Promise<void> {
    try {
      const attemptRef = doc(firestore, this.COLLECTIONS.ATTEMPTS, attemptId);
      const attemptDoc = await getDoc(attemptRef);
      
      if (!attemptDoc.exists()) {
        throw new Error('Test attempt not found');
      }

      const attempt = attemptDoc.data() as TestAttempt;
      const test = await this.getTest(attempt.testId);
      if (!test) throw new Error('Test not found');

      // Calculate results
      const results = await this.calculateResults(attempt, test);

      await updateDoc(attemptRef, {
        status: autoSubmitted ? 'auto_submitted' : 'submitted',
        endTime: Timestamp.now(),
        submittedAt: Timestamp.now(),
        autoSubmitted,
        ...results
      });

      // Update test statistics
      if (test.type === 'live') {
        const liveTest = test as LiveTest;
        await updateDoc(doc(firestore, this.COLLECTIONS.TESTS, test.id), {
          studentsCompleted: increment(1),
          studentsOnline: increment(-1)
        });
      }

      // Update analytics
      await this.updateTestAnalytics(test.id);
    } catch (error) {
      console.error('Error submitting test:', error);
      throw new Error('Failed to submit test');
    }
  }

  // Calculate test results
  private static async calculateResults(attempt: TestAttempt, test: Test): Promise<Partial<TestAttempt>> {
    try {
      let mcqCorrect = 0;
      let mcqWrong = 0;
      let totalMcqMarks = 0;
      let essayMarks = 0; // Will be updated later by teacher review

      // Calculate MCQ scores using test questions (which contain correct answers)
      const testQuestionsMap = new Map<string, TestQuestion>();
      test.questions.forEach(q => {
        testQuestionsMap.set(q.questionId, q);
      });

      for (const answer of attempt.answers) {
        const testQuestion = testQuestionsMap.get(answer.questionId);
        if (!testQuestion) continue;

        if (testQuestion.questionType === 'mcq') {
          const mcqAnswer = answer as MCQAnswer;
          
          // Check if answer is correct using stored correct option index
          if (testQuestion.correctOption !== undefined && 
              testQuestion.options && 
              mcqAnswer.selectedOption !== undefined) {
            
            // Convert selectedOption (which should be an index) to match correctOption
            const selectedIndex = typeof mcqAnswer.selectedOption === 'number' 
              ? mcqAnswer.selectedOption 
              : parseInt(mcqAnswer.selectedOption.toString());
            
            if (selectedIndex === testQuestion.correctOption) {
              mcqCorrect++;
              totalMcqMarks += testQuestion.points;
            } else {
              mcqWrong++;
            }
          }
        }
      }

      const totalMarks = totalMcqMarks + essayMarks;
      const percentage = test.totalMarks > 0 ? (totalMarks / test.totalMarks) * 100 : 0;
      
      let passStatus: 'passed' | 'failed' | 'pending' = 'pending';
      if (test.config.passingScore) {
        // If there are essay questions, mark as pending until teacher reviews
        const hasEssayQuestions = test.questions.some(q => q.questionType === 'essay');
        if (!hasEssayQuestions) {
          passStatus = percentage >= test.config.passingScore ? 'passed' : 'failed';
        }
      }

      return {
        score: totalMarks,
        totalMarks: test.totalMarks,
        percentage,
        mcqCorrect,
        mcqWrong,
        essayMarks,
        passStatus
      };
    } catch (error) {
      console.error('Error calculating results:', error);
      throw new Error('Failed to calculate results');
    }
  }

  // Update test analytics
  private static async updateTestAnalytics(testId: string): Promise<void> {
    try {
      // Implementation for updating analytics
      // This would calculate various statistics and update the analytics document
      console.log('Updating analytics for test:', testId);
      // TODO: Implement detailed analytics calculation
    } catch (error) {
      console.error('Error updating analytics:', error);
    }
  }

  // Get test attempt by ID
  static async getTestAttempt(attemptId: string): Promise<TestAttempt> {
    try {
      const attemptRef = doc(firestore, 'testAttempts', attemptId);
      const attemptDoc = await getDoc(attemptRef);
      
      if (!attemptDoc.exists()) {
        throw new Error('Test attempt not found');
      }
      
      const data = attemptDoc.data();
      return {
        id: attemptDoc.id,
        ...data,
        startTime: data.startTime,
        endTime: data.endTime,
        submittedAt: data.submittedAt
      } as TestAttempt;
    } catch (error) {
      console.error('Error getting test attempt:', error);
      throw error;
    }
  }

  // Save individual answer during test
  static async saveTestAnswer(attemptId: string, questionId: string, answer: any): Promise<void> {
    try {
      const attemptRef = doc(firestore, 'testAttempts', attemptId);
      
      await updateDoc(attemptRef, {
        [`answers.${questionId}`]: answer,
        lastSaved: Timestamp.now()
      });
    } catch (error) {
      console.error('Error saving answer:', error);
      throw error;
    }
  }

  // Get student's attempt for a test
  static async getStudentTestAttempt(testId: string, studentId: string): Promise<TestAttempt | null> {
    try {
      const attemptQuery = query(
        collection(firestore, this.COLLECTIONS.ATTEMPTS),
        where('testId', '==', testId),
        where('studentId', '==', studentId),
        limit(1)
      );
      
      const snapshot = await getDocs(attemptQuery);
      if (snapshot.empty) return null;
      
      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      } as TestAttempt;
    } catch (error) {
      console.error('Error fetching student test attempt:', error);
      throw new Error('Failed to fetch student test attempt');
    }
  }

  // Real-time listener for test attempts (for teacher monitoring)
  static listenToTestAttempts(testId: string, callback: (attempts: TestAttempt[]) => void) {
    const attemptsQuery = query(
      collection(firestore, this.COLLECTIONS.ATTEMPTS),
      where('testId', '==', testId),
      orderBy('startTime', 'desc')
    );

    return onSnapshot(attemptsQuery, (snapshot) => {
      const attempts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TestAttempt[];
      
      callback(attempts);
    });
  }

  // Delete test
  static async deleteTest(testId: string): Promise<void> {
    try {
      const batch = writeBatch(firestore);
      
      // Delete test
      batch.delete(doc(firestore, this.COLLECTIONS.TESTS, testId));
      
      // Delete all attempts for this test
      const attemptsQuery = query(
        collection(firestore, this.COLLECTIONS.ATTEMPTS),
        where('testId', '==', testId)
      );
      const attemptsSnapshot = await getDocs(attemptsQuery);
      attemptsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Delete all student submissions for this test
      const submissionsQuery = query(
        collection(firestore, 'studentSubmissions'),
        where('testId', '==', testId)
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);
      submissionsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Delete analytics
      batch.delete(doc(firestore, this.COLLECTIONS.ANALYTICS, testId));
      
      await batch.commit();
      
      console.log(`✅ Successfully deleted test ${testId} and all related data:`, {
        attempts: attemptsSnapshot.size,
        submissions: submissionsSnapshot.size
      });
    } catch (error) {
      console.error('Error deleting test:', error);
      throw new Error('Failed to delete test');
    }
  }

  // Soft delete test (safer option - marks as deleted instead of permanent removal)
  static async softDeleteTest(testId: string, deletedBy: string): Promise<void> {
    try {
      const testRef = doc(firestore, this.COLLECTIONS.TESTS, testId);
      await updateDoc(testRef, {
        isDeleted: true,
        deletedAt: Timestamp.now(),
        deletedBy: deletedBy,
        isActive: false,
        updatedAt: Timestamp.now()
      });
      
      console.log(`✅ Successfully soft-deleted test ${testId} by ${deletedBy}`);
    } catch (error) {
      console.error('Error soft-deleting test:', error);
      throw new Error('Failed to soft-delete test');
    }
  }

  // Restore soft-deleted test
  static async restoreTest(testId: string, restoredBy: string): Promise<void> {
    try {
      const testRef = doc(firestore, this.COLLECTIONS.TESTS, testId);
      await updateDoc(testRef, {
        isDeleted: false,
        restoredAt: Timestamp.now(),
        restoredBy: restoredBy,
        isActive: true,
        updatedAt: Timestamp.now()
      });
      
      console.log(`✅ Successfully restored test ${testId} by ${restoredBy}`);
    } catch (error) {
      console.error('Error restoring test:', error);
      throw new Error('Failed to restore test');
    }
  }

  // Get available tests for a student
  static async getStudentTests(studentId: string, classIds: string[]): Promise<Test[]> {
    try {
      const now = Timestamp.now();
      const testsRef = collection(firestore, 'tests');
      
      // Query for tests assigned to student's classes and currently available
      const q = query(
        testsRef,
        where('classIds', 'array-contains-any', classIds),
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(q);
      const tests: Test[] = [];
      
      snapshot.forEach((doc) => {
        const testData = { id: doc.id, ...doc.data() } as Test;
        
        // Check if test is currently available based on type
        let isAvailable = false;
        
        if (testData.type === 'live') {
          const liveTest = testData as LiveTest;
          // Live test is available during the test window
          isAvailable = now.seconds >= liveTest.studentJoinTime.seconds && 
                       now.seconds <= liveTest.actualEndTime.seconds;
        } else {
          const flexTest = testData as FlexibleTest;
          // Flexible test is available during the entire period
          isAvailable = now.seconds >= flexTest.availableFrom.seconds && 
                       now.seconds <= flexTest.availableTo.seconds;
        }
        
        // Include test if it's available or starting soon (for live tests)
        if (isAvailable || testData.type === 'live') {
          tests.push(testData);
        } else if (testData.type === 'flexible') {
          const flexTest = testData as FlexibleTest;
          // Include flexible tests that are coming up within 24 hours
          const timeDiff = flexTest.availableFrom.seconds - now.seconds;
          if (timeDiff > 0 && timeDiff <= 86400) { // 24 hours
            tests.push(testData);
          }
        }
      });
      
      // Sort by availability and start time
      tests.sort((a, b) => {
        const aTime = a.type === 'live' 
          ? (a as LiveTest).scheduledStartTime.seconds 
          : (a as FlexibleTest).availableFrom.seconds;
        const bTime = b.type === 'live' 
          ? (b as LiveTest).scheduledStartTime.seconds 
          : (b as FlexibleTest).availableFrom.seconds;
        
        return aTime - bTime;
      });
      
      return tests;
    } catch (error) {
      console.error('Error getting student tests:', error);
      throw error;
    }
  }

  // Get count of upcoming unattempted tests for a student (optimized for performance)
  static async getUpcomingUnattemptedTestCount(studentId: string, classIds: string[]): Promise<number> {
    try {
      const now = Timestamp.now();
      const testsRef = collection(firestore, 'tests');
      
      // Query for tests assigned to student's classes and currently available
      const q = query(
        testsRef,
        where('classIds', 'array-contains-any', classIds),
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(q);
      let upcomingCount = 0;
      
      // Get student's attempts to check which tests are unattempted
      const attemptsRef = collection(firestore, 'studentSubmissions');
      const attemptsQuery = query(
        attemptsRef,
        where('studentId', '==', studentId)
      );
      const attemptsSnapshot = await getDocs(attemptsQuery);
      
      // Create a set of attempted test IDs for quick lookup
      const attemptedTestIds = new Set<string>();
      attemptsSnapshot.forEach((doc) => {
        const attempt = doc.data();
        attemptedTestIds.add(attempt.testId);
      });
      
      snapshot.forEach((doc) => {
        const testData = { id: doc.id, ...doc.data() } as Test;
        
        // Skip if test has already been attempted
        if (attemptedTestIds.has(testData.id)) {
          return;
        }
        
        // Check if test is upcoming/available based on type
        let isUpcoming = false;
        
        if (testData.type === 'live') {
          const liveTest = testData as LiveTest;
          // Live test is upcoming if it hasn't started yet or is currently active
          isUpcoming = now.seconds <= liveTest.actualEndTime.seconds;
        } else {
          const flexTest = testData as FlexibleTest;
          // Flexible test is upcoming if it's available now or will be available soon
          isUpcoming = now.seconds <= flexTest.availableTo.seconds;
        }
        
        if (isUpcoming) {
          upcomingCount++;
        }
      });
      
      return upcomingCount;
    } catch (error) {
      console.error('Error getting upcoming unattempted test count:', error);
      return 0;
    }
  }

  // Real-time test monitoring for teachers
  static subscribeToTestUpdates(testId: string, callback: (test: Test | null) => void): () => void {
    const testRef = doc(firestore, 'tests', testId);
    
    return onSnapshot(testRef, (doc) => {
      if (doc.exists()) {
        const test = { id: doc.id, ...doc.data() } as Test;
        callback(test);
      } else {
        callback(null);
      }
    });
  }

  // Send email notifications to students and parents when a test is created
  private static async sendTestCreationNotifications(testId: string, testData: any): Promise<void> {
    try {
      console.log('📧 Sending test creation notifications for test:', testId);
      
      // Import MailService and StudentFirestoreService
      const { MailService } = await import('./mailService');
      const { StudentFirestoreService } = await import('./studentFirestoreService');
      const { getEnrollmentsByClass } = await import('../services/studentEnrollmentService');
      
      // Get all students who need to be notified
      const studentsToNotify = new Set<{
        studentId: string;
        studentName: string;
        studentEmail: string;
        parentName: string;
        parentEmail: string;
        className: string;
      }>();
      
      // Handle class-based assignments
      if (testData.classIds && testData.classIds.length > 0) {
        for (const classId of testData.classIds) {
          try {
            const enrollments = await getEnrollmentsByClass(classId);
            const activeEnrollments = enrollments.filter(enrollment => enrollment.status === 'Active');
            
            for (const enrollment of activeEnrollments) {
              // Get student details to access parent information
              try {
                const studentDoc = await StudentFirestoreService.getStudentById(enrollment.studentId);
                if (studentDoc && studentDoc.parent) {
                  studentsToNotify.add({
                    studentId: enrollment.studentId,
                    studentName: enrollment.studentName,
                    studentEmail: enrollment.studentEmail,
                    parentName: studentDoc.parent.name,
                    parentEmail: studentDoc.parent.email,
                    className: enrollment.className
                  });
                } else {
                  console.warn(`⚠️ Missing parent info for student ${enrollment.studentId}`);
                }
              } catch (studentError) {
                console.warn(`⚠️ Could not load student details for ${enrollment.studentId}:`, studentError);
              }
            }
          } catch (classError) {
            console.warn(`⚠️ Could not load enrollments for class ${classId}:`, classError);
          }
        }
      }
      
      // Handle individual student assignments
      if (testData.individualAssignments && testData.individualAssignments.length > 0) {
        for (const assignment of testData.individualAssignments) {
          try {
            const studentDoc = await StudentFirestoreService.getStudentById(assignment.studentId);
            if (studentDoc && studentDoc.parent) {
              studentsToNotify.add({
                studentId: assignment.studentId,
                studentName: assignment.studentName,
                studentEmail: assignment.studentEmail,
                parentName: studentDoc.parent.name,
                parentEmail: studentDoc.parent.email,
                className: assignment.className
              });
            } else {
              console.warn(`⚠️ Missing parent info for individually assigned student ${assignment.studentId}`);
            }
          } catch (studentError) {
            console.warn(`⚠️ Could not load student details for ${assignment.studentId}:`, studentError);
          }
        }
      }
      
      console.log(`📊 Found ${studentsToNotify.size} students to notify`);
      
      if (studentsToNotify.size === 0) {
        console.log('ℹ️ No students to notify, skipping email notifications');
        return;
      }
      
      // Prepare test details for email
      const testType = testData.type as 'live' | 'flexible';
      let testDate = '';
      let testTime = '';
      let availableFrom = '';
      let availableTo = '';
      
      if (testType === 'live') {
        const liveTestData = testData as any; // LiveTest data
        if (liveTestData.scheduledStartTime) {
          const startTime = liveTestData.scheduledStartTime.toDate ? 
            liveTestData.scheduledStartTime.toDate() : 
            new Date(liveTestData.scheduledStartTime);
          testDate = startTime.toISOString().split('T')[0];
          testTime = startTime.toTimeString().split(' ')[0].substring(0, 5); // HH:MM format
        }
      } else {
        const flexTestData = testData as any; // FlexibleTest data
        if (flexTestData.availableFrom) {
          const fromDate = flexTestData.availableFrom.toDate ? 
            flexTestData.availableFrom.toDate() : 
            new Date(flexTestData.availableFrom);
          availableFrom = fromDate.toISOString();
        }
        if (flexTestData.availableTo) {
          const toDate = flexTestData.availableTo.toDate ? 
            flexTestData.availableTo.toDate() : 
            new Date(flexTestData.availableTo);
          availableTo = toDate.toISOString();
        }
      }
      
      // Send notifications to all students and parents
      const emailPromises = Array.from(studentsToNotify).map(async (student) => {
        try {
          await MailService.sendTestNotificationEmails(
            student.studentName,
            student.studentEmail,
            student.parentName,
            student.parentEmail,
            testData.title,
            testData.description || '',
            testData.teacherName,
            testData.subjectName,
            student.className,
            testType,
            testDate,
            testTime || undefined,
            testData.duration || (testType === 'live' ? testData.duration : testData.duration),
            availableFrom || undefined,
            availableTo || undefined,
            testData.totalMarks,
            testData.instructions || undefined
          );
          
          console.log(`✅ Sent notifications to ${student.studentName} and parent`);
        } catch (emailError) {
          console.error(`❌ Failed to send notifications for ${student.studentName}:`, emailError);
        }
      });
      
      // Wait for all emails to be sent (with timeout)
      const results = await Promise.allSettled(emailPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`📊 Email notification results:`, {
        successful,
        failed,
        total: studentsToNotify.size
      });
      
    } catch (error) {
      console.error('❌ Error in sendTestCreationNotifications:', error);
      throw error;
    }
  }
}
