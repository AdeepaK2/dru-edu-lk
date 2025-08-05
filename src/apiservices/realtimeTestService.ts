// Real-time test session service using Firebase Realtime Database
// Handles live answer tracking, monitoring, and session management with attempt tracking

import { 
  getDatabase, 
  ref, 
  set, 
  update, 
  get, 
  push,
  onValue, 
  off,
  serverTimestamp,
  onDisconnect,
  Database
} from 'firebase/database';
import { 
  RealtimeTestSession, 
  RealtimeAnswer, 
  AnswerChange,
  RealtimeMonitoring,
  TestSessionEvent
} from '@/models/studentSubmissionSchema';
import { AttemptManagementService } from './attemptManagementService';
import { TimeCalculation } from '@/models/attemptSchema';

export class RealtimeTestService {
  private static database: Database;
  
  // Helper function to remove undefined values recursively
  private static removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedValues(item));
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
  
  // Initialize Realtime Database
  static init() {
    if (!this.database) {
      this.database = getDatabase();
    }
    return this.database;
  }

  // Start a new test session for a student with attempt management
  static async startTestSession(
    attemptId: string,
    testId: string,
    studentId: string,
    studentName: string,
    classId: string,
    duration: number // in minutes
  ): Promise<void> {
    try {
      const db = this.init();
      const now = Date.now();
      
      // Start the attempt in attempt management service
      await AttemptManagementService.startAttempt(attemptId);
      
      const session: RealtimeTestSession = {
        attemptId,
        testId,
        studentId,
        studentName,
        classId,
        status: 'active',
        currentQuestionIndex: 0,
        isReviewMode: false,
        startTime: now,
        lastActivity: now,
        totalTimeSpent: 0,
        timePerQuestion: {},
        answers: {},
        questionsVisited: [],
        questionsCompleted: [],
        questionsMarkedForReview: [],
        userAgent: navigator.userAgent,
        isFullscreen: document.fullscreenElement !== null,
        tabSwitchCount: 0,
        disconnectionCount: 0,
        suspiciousActivity: {
          tabSwitches: 0,
          copyPasteAttempts: 0,
          rightClickAttempts: 0,
          keyboardShortcuts: []
        }
      };

      // Create session in realtime DB
      await set(ref(db, `testSessions/${attemptId}`), session);
      
      // Set up disconnect handler
      const sessionRef = ref(db, `testSessions/${attemptId}/status`);
      onDisconnect(sessionRef).set('disconnected');
      
      // Update monitoring stats
      await this.updateMonitoringStats(testId);
      
      // Log session start event
      await this.logSessionEvent(attemptId, studentId, 'start', { duration });

      console.log('✅ Test session started in Realtime DB:', attemptId);
    } catch (error) {
      console.error('Error starting test session:', error);
      throw error;
    }
  }

  // Save answer in real-time
  static async saveAnswer(
    attemptId: string,
    questionId: string,
    answer: any,
    questionType: 'mcq' | 'essay',
    timeSpent: number,
    pdfFiles?: any[] // Optional PDF files for essays
  ): Promise<void> {
    try {
      const db = this.init();
      const now = Date.now();
      
      // Ensure answer is not undefined - convert to appropriate default values
      let cleanAnswer = answer;
      if (answer === undefined || answer === null) {
        cleanAnswer = questionType === 'essay' ? '' : 0;
      }
      
      // Get current answer to track changes
      const currentAnswerRef = ref(db, `testSessions/${attemptId}/answers/${questionId}`);
      const currentSnapshot = await get(currentAnswerRef);
      const currentAnswer = currentSnapshot.val() as RealtimeAnswer | null;
      
      // Create change record
      const change: AnswerChange = {
        timestamp: now,
        type: questionType === 'mcq' ? 'select' : 'text_change',
        previousValue: currentAnswer?.selectedOption || currentAnswer?.textContent || null,
        newValue: cleanAnswer,
        timeOnQuestion: timeSpent
      };

      // Create updated answer - ensure no undefined values
      const updatedAnswer: RealtimeAnswer = {
        questionId: questionId || '',
        lastModified: now,
        timeSpent: timeSpent || 0,
        isMarkedForReview: currentAnswer?.isMarkedForReview || false,
        changeHistory: [...(currentAnswer?.changeHistory || []), change]
      };

      // Add type-specific properties only if they have values
      if (questionType === 'mcq') {
        updatedAnswer.selectedOption = cleanAnswer;
      } else if (questionType === 'essay') {
        updatedAnswer.textContent = cleanAnswer;
        // Add PDF files if provided
        if (pdfFiles && pdfFiles.length > 0) {
          updatedAnswer.pdfFiles = pdfFiles;
        }
      }

      // Clean the updatedAnswer object to remove any undefined values
      const cleanUpdatedAnswer = this.removeUndefinedValues(updatedAnswer);

      // Update in realtime DB with clean data
      const updates: Record<string, any> = {
        [`testSessions/${attemptId}/answers/${questionId}`]: cleanUpdatedAnswer,
        [`testSessions/${attemptId}/lastActivity`]: now,
        [`testSessions/${attemptId}/timePerQuestion/${questionId}`]: timeSpent || 0
      };

      await update(ref(db), updates);
      
      // Log answer change event
      await this.logSessionEvent(attemptId, '', 'answer_change', { 
        questionId: questionId || '', 
        questionType: questionType || 'mcq',
        answerValue: questionType === 'mcq' 
          ? (cleanAnswer || 0).toString() 
          : (cleanAnswer || '').toString().substring(0, 50) + (cleanAnswer && cleanAnswer.length > 50 ? '...' : '')
      });

      console.log('💾 Answer saved in real-time for question:', questionId);
    } catch (error) {
      console.error('Error saving answer:', error);
      throw error;
    }
  }

  // Navigate to question
  static async navigateToQuestion(
    attemptId: string,
    questionIndex: number,
    questionId: string
  ): Promise<void> {
    try {
      const db = this.init();
      const now = Date.now();
      
      const updates: Record<string, any> = {
        [`testSessions/${attemptId}/currentQuestionIndex`]: questionIndex,
        [`testSessions/${attemptId}/lastActivity`]: now
      };

      // Add to visited questions if not already there
      const visitedRef = ref(db, `testSessions/${attemptId}/questionsVisited`);
      const visitedSnapshot = await get(visitedRef);
      const visited = visitedSnapshot.val() || [];
      
      if (!visited.includes(questionId)) {
        updates[`testSessions/${attemptId}/questionsVisited`] = [...visited, questionId];
      }

      await update(ref(db), updates);
      
      // Log navigation event
      await this.logSessionEvent(attemptId, '', 'question_navigate', { 
        questionIndex, 
        questionId 
      });
    } catch (error) {
      console.error('Error navigating to question:', error);
      throw error;
    }
  }

  // Mark question for review
  static async toggleReviewMark(
    attemptId: string,
    questionId: string,
    isMarked: boolean
  ): Promise<void> {
    try {
      const db = this.init();
      const now = Date.now();
      
      const updates: Record<string, any> = {
        [`testSessions/${attemptId}/answers/${questionId}/isMarkedForReview`]: isMarked,
        [`testSessions/${attemptId}/lastActivity`]: now
      };

      // Update marked questions list
      const markedRef = ref(db, `testSessions/${attemptId}/questionsMarkedForReview`);
      const markedSnapshot = await get(markedRef);
      const marked = markedSnapshot.val() || [];
      
      if (isMarked && !marked.includes(questionId)) {
        updates[`testSessions/${attemptId}/questionsMarkedForReview`] = [...marked, questionId];
      } else if (!isMarked && marked.includes(questionId)) {
        updates[`testSessions/${attemptId}/questionsMarkedForReview`] = marked.filter((id: string) => id !== questionId);
      }

      await update(ref(db), updates);
      
      // Log review toggle event
      await this.logSessionEvent(attemptId, '', 'review_toggle', { 
        questionId, 
        isMarked 
      });
    } catch (error) {
      console.error('Error toggling review mark:', error);
      throw error;
    }
  }

  // Track suspicious activity
  static async trackSuspiciousActivity(
    attemptId: string,
    activityType: 'tab_switch' | 'copy_paste' | 'right_click' | 'keyboard_shortcut',
    details?: any
  ): Promise<void> {
    try {
      const db = this.init();
      const now = Date.now();
      
      const sessionRef = ref(db, `testSessions/${attemptId}`);
      const sessionSnapshot = await get(sessionRef);
      const session = sessionSnapshot.val() as RealtimeTestSession;
      
      if (!session) return;

      const updates: Record<string, any> = {
        [`testSessions/${attemptId}/lastActivity`]: now
      };

      switch (activityType) {
        case 'tab_switch':
          updates[`testSessions/${attemptId}/tabSwitchCount`] = (session.tabSwitchCount || 0) + 1;
          updates[`testSessions/${attemptId}/suspiciousActivity/tabSwitches`] = 
            (session.suspiciousActivity?.tabSwitches || 0) + 1;
          await this.logSessionEvent(attemptId, '', 'tab_switch');
          break;
          
        case 'copy_paste':
          updates[`testSessions/${attemptId}/suspiciousActivity/copyPasteAttempts`] = 
            (session.suspiciousActivity?.copyPasteAttempts || 0) + 1;
          break;
          
        case 'right_click':
          updates[`testSessions/${attemptId}/suspiciousActivity/rightClickAttempts`] = 
            (session.suspiciousActivity?.rightClickAttempts || 0) + 1;
          break;
          
        case 'keyboard_shortcut':
          const shortcuts = session.suspiciousActivity?.keyboardShortcuts || [];
          updates[`testSessions/${attemptId}/suspiciousActivity/keyboardShortcuts`] = 
            [...shortcuts, details?.shortcut || 'unknown'];
          break;
      }

      await update(ref(db), updates);
    } catch (error) {
      console.error('Error tracking suspicious activity:', error);
    }
  }

  // Get real-time session data
  static async getSession(attemptId: string): Promise<RealtimeTestSession | null> {
    try {
      const db = this.init();
      const sessionRef = ref(db, `testSessions/${attemptId}`);
      const snapshot = await get(sessionRef);
      const session = snapshot.val() as RealtimeTestSession | null;
      
      // If session exists but is missing critical fields, log it
      if (session && (!session.testId || !session.studentId)) {
        console.warn('⚠️ Retrieved session missing critical fields:', {
          hasTestId: !!session.testId,
          hasStudentId: !!session.studentId,
          hasAnswers: !!session.answers,
          allFields: Object.keys(session)
        });
      }
      
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  // Repair session integrity by restoring missing critical fields
  static async repairSessionIntegrity(
    attemptId: string,
    testId?: string,
    studentId?: string,
    studentName?: string,
    classId?: string
  ): Promise<void> {
    try {
      const db = this.init();
      const session = await this.getSession(attemptId);
      
      if (!session) {
        console.warn('⚠️ Cannot repair session - session not found');
        return;
      }

      const updates: Record<string, any> = {};
      let needsUpdate = false;

      // Restore missing critical fields
      if (!session.testId && testId) {
        updates[`testSessions/${attemptId}/testId`] = testId;
        needsUpdate = true;
        console.log('🔧 Repairing session: adding testId');
      }

      if (!session.studentId && studentId) {
        updates[`testSessions/${attemptId}/studentId`] = studentId;
        needsUpdate = true;
        console.log('🔧 Repairing session: adding studentId');
      }

      if (!session.studentName && studentName) {
        updates[`testSessions/${attemptId}/studentName`] = studentName;
        needsUpdate = true;
        console.log('🔧 Repairing session: adding studentName');
      }

      if (!session.classId && classId) {
        updates[`testSessions/${attemptId}/classId`] = classId;
        needsUpdate = true;
        console.log('🔧 Repairing session: adding classId');
      }

      if (needsUpdate) {
        await update(ref(db), updates);
        console.log('✅ Session integrity repaired for attempt:', attemptId);
      }
    } catch (error) {
      console.error('Error repairing session integrity:', error);
    }
  }

  // Listen to session changes (for teacher monitoring)
  static listenToSession(
    attemptId: string, 
    callback: (session: RealtimeTestSession | null) => void
  ): () => void {
    const db = this.init();
    const sessionRef = ref(db, `testSessions/${attemptId}`);
    
    onValue(sessionRef, (snapshot) => {
      const session = snapshot.val() as RealtimeTestSession | null;
      callback(session);
    });

    // Return unsubscribe function
    return () => off(sessionRef);
  }

  // Listen to test monitoring data
  static listenToTestMonitoring(
    testId: string,
    callback: (monitoring: RealtimeMonitoring) => void
  ): () => void {
    const db = this.init();
    const monitoringRef = ref(db, `testMonitoring/${testId}`);
    
    onValue(monitoringRef, (snapshot) => {
      const monitoring = snapshot.val() as RealtimeMonitoring;
      callback(monitoring);
    });

    return () => off(monitoringRef);
  }

  // Submit test (mark as completed)
  static async submitTest(attemptId: string): Promise<RealtimeTestSession | null> {
    try {
      const db = this.init();
      const now = Date.now();
      
      // Get final session data
      const session = await this.getSession(attemptId);
      if (!session) return null;

      // Mark as submitted
      await update(ref(db, `testSessions/${attemptId}`), {
        status: 'submitted',
        lastActivity: now
      });

      // Log submission event
      await this.logSessionEvent(attemptId, session.studentId, 'submit');
      
      // Update monitoring stats
      await this.updateMonitoringStats(session.testId);

      console.log('✅ Test submitted in Realtime DB:', attemptId);
      return session;
    } catch (error) {
      console.error('Error submitting test:', error);
      throw error;
    }
  }

  // Clean up session after processing
  static async cleanupSession(attemptId: string): Promise<void> {
    try {
      const db = this.init();
      
      // Move to archived sessions instead of deleting
      const session = await this.getSession(attemptId);
      if (session) {
        await set(ref(db, `archivedSessions/${attemptId}`), {
          ...session,
          archivedAt: Date.now()
        });
      }
      
      // Remove from active sessions
      await set(ref(db, `testSessions/${attemptId}`), null);
      
      console.log('🗑️ Session cleaned up:', attemptId);
    } catch (error) {
      console.error('Error cleaning up session:', error);
    }
  }

  // Update monitoring statistics
  private static async updateMonitoringStats(testId: string): Promise<void> {
    try {
      const db = this.init();
      const now = Date.now();
      
      // Get all sessions for this test
      const sessionsRef = ref(db, 'testSessions');
      const snapshot = await get(sessionsRef);
      const allSessions = snapshot.val() || {};
      
      // Ensure allSessions is a valid object before processing
      if (!allSessions || typeof allSessions !== 'object') {
        console.log('No sessions found or invalid sessions data');
        return;
      }
      
      // Filter sessions for this test - add safety checks
      const testSessions = Object.values(allSessions).filter(
        (session: any) => session && session.testId === testId && session.studentId
      ) as RealtimeTestSession[];

      // Calculate stats
      const stats = {
        totalStudents: testSessions.length,
        studentsStarted: testSessions.filter(s => s.status !== 'disconnected').length,
        studentsActive: testSessions.filter(s => s.status === 'active').length,
        studentsCompleted: testSessions.filter(s => s.status === 'submitted').length,
        averageProgress: 0,
        averageTimeSpent: 0
      };

      // Create active students mapping
      const activeStudents: Record<string, any> = {};
      testSessions.forEach(session => {
        // Safely handle potentially missing properties
        const answers = session.answers || {};
        const questionsVisited = session.questionsVisited || [];
        const suspiciousActivity = session.suspiciousActivity || { tabSwitches: 0 };
        
        activeStudents[session.studentId] = {
          studentId: session.studentId,
          studentName: session.studentName || 'Unknown Student',
          status: session.status || 'unknown',
          currentQuestion: session.currentQuestionIndex || 0,
          progress: questionsVisited.length > 0 ? (Object.keys(answers).length / questionsVisited.length) * 100 : 0,
          timeRemaining: Math.max(0, (session.startTime + 90 * 60 * 1000) - now), // assuming 90 min test
          lastActivity: session.lastActivity || session.startTime || now,
          suspiciousActivity: (suspiciousActivity.tabSwitches || 0) > 3
        };
      });

      const monitoring: RealtimeMonitoring = {
        testId,
        lastUpdated: now,
        activeStudents,
        stats,
        questionProgress: {} // Would calculate this based on answers
      };

      await set(ref(db, `testMonitoring/${testId}`), monitoring);
    } catch (error) {
      console.error('Error updating monitoring stats:', error);
    }
  }

  // Log session events for analytics
  private static async logSessionEvent(
    attemptId: string,
    studentId: string,
    eventType: string,
    data?: any
  ): Promise<void> {
    try {
      const db = this.init();
      
      // Clean the data object to remove undefined values
      const cleanData = this.removeUndefinedValues(data);
      
      const event: TestSessionEvent = {
        timestamp: Date.now(),
        attemptId: attemptId || '',
        studentId: studentId || '',
        eventType: eventType as any,
        data: cleanData,
        questionId: cleanData?.questionId || null
      };

      // Clean the entire event object
      const cleanEvent = this.removeUndefinedValues(event);

      await push(ref(db, `testEvents/${attemptId.substring(0, 8)}`), cleanEvent);
    } catch (error) {
      console.error('Error logging session event:', error);
    }
  }

  // Heartbeat to keep session alive and update time
  static async updateHeartbeat(attemptId: string): Promise<TimeCalculation | null> {
    try {
      const db = this.init();
      const now = Date.now();
      
      // Update session heartbeat
      await update(ref(db, `testSessions/${attemptId}`), {
        lastActivity: now
      });

      // Update attempt time through attempt management service
      try {
        const timeCalc = await AttemptManagementService.updateAttemptTime(attemptId);
        return timeCalc;
      } catch (error) {
        console.warn('Could not update attempt time:', error);
        return null;
      }
    } catch (error) {
      console.error('Error updating heartbeat:', error);
      return null;
    }
  }

  // Get current time remaining for an attempt
  static async getTimeRemaining(attemptId: string): Promise<TimeCalculation | null> {
    try {
      return await AttemptManagementService.updateAttemptTime(attemptId);
    } catch (error) {
      console.error('Error getting time remaining:', error);
      return null;
    }
  }

  // Handle page visibility change (tab switch detection)
  static async handleVisibilityChange(attemptId: string, isVisible: boolean): Promise<void> {
    try {
      if (!isVisible) {
        // Student switched away from tab
        await this.logSessionEvent(attemptId, '', 'tab_switch', { 
          action: 'tab_hidden',
          timestamp: Date.now()
        });
        
        // Potentially pause time tracking or mark as suspicious
        console.warn('🚨 Student switched away from test tab');
      } else {
        // Student returned to tab
        await this.logSessionEvent(attemptId, '', 'tab_switch', { 
          action: 'tab_visible',
          timestamp: Date.now()
        });
        
        console.log('👁️ Student returned to test tab');
      }
    } catch (error) {
      console.error('Error handling visibility change:', error);
    }
  }

  // Handle offline/online detection
  static async handleOffline(attemptId: string): Promise<void> {
    try {
      await AttemptManagementService.handleDisconnection(attemptId);
      
      await this.logSessionEvent(attemptId, '', 'connection_lost', { 
        timestamp: Date.now(),
        reason: 'Offline detected'
      });
      
      console.log('📴 Student went offline');
    } catch (error) {
      console.error('Error handling offline:', error);
    }
  }

  static async handleOnline(attemptId: string): Promise<TimeCalculation | null> {
    try {
      const timeCalc = await AttemptManagementService.handleReconnection(attemptId);
      
      await this.logSessionEvent(attemptId, '', 'connection_restored', { 
        timestamp: Date.now(),
        reason: 'Online detected',
        timeRemaining: timeCalc.timeRemaining
      });
      
      console.log('🔌 Student came back online, remaining time:', timeCalc.timeRemaining);
      return timeCalc;
    } catch (error) {
      console.error('Error handling online:', error);
      return null;
    }
  }

  // Submit test session
  static async submitTestSession(attemptId: string, isAutoSubmit: boolean = false): Promise<void> {
    try {
      const db = this.init();
      
      // Update session status
      await update(ref(db, `testSessions/${attemptId}`), {
        status: isAutoSubmit ? 'auto_submitted' : 'submitted',
        endTime: Date.now(),
        lastActivity: Date.now()
      });

      // Submit through attempt management service
      await AttemptManagementService.submitAttempt(attemptId, isAutoSubmit);
      
      await this.logSessionEvent(attemptId, '', isAutoSubmit ? 'auto_submit' : 'manual_submit', { 
        timestamp: Date.now()
      });
      
      console.log(isAutoSubmit ? '⏰ Test auto-submitted' : '📤 Test manually submitted');
    } catch (error) {
      console.error('Error submitting test session:', error);
      throw error;
    }
  }
}
