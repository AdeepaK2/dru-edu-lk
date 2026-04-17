// Test attempt tracking schema
// Separate collection to track individual test attempts

import { Timestamp } from 'firebase/firestore';

// Test attempt status
export type TestAttemptStatus = 
  | 'not_started'     // Attempt created but not started
  | 'in_progress'     // Currently taking the test
  | 'paused'          // Temporarily paused (offline)
  | 'expired'         // Time has run out; pending client/background submission handling
  | 'submitted'       // Successfully submitted
  | 'auto_submitted'  // Auto-submitted due to time expiry
  | 'abandoned'       // Left incomplete (timeout)
  | 'terminated';     // Terminated by system/teacher

// Individual test attempt record
export interface TestAttempt {
  id: string; // attempt ID (same as session ID)
  
  // Basic info
  testId: string;
  testTitle: string;
  studentId: string;
  studentName: string;
  classId: string;
  className?: string;
  
  // Attempt tracking
  attemptNumber: number; // 1, 2, 3, etc.
  status: TestAttemptStatus;
  
  // Timing management
  startedAt: Timestamp; // When attempt was first started
  endTime: Timestamp; // Calculated end time (startedAt + duration)
  lastActiveAt: Timestamp; // Last activity timestamp
  submittedAt?: Timestamp; // When submitted (if completed)
  
  // Time tracking
  totalTimeAllowed: number; // Total time allowed in seconds
  timeSpent: number; // Actual time spent in seconds
  timeRemaining: number; // Remaining time in seconds
  
  // Session management
  sessionStartTime: number; // Realtime DB timestamp when session started
  lastHeartbeat: number; // Last heartbeat timestamp
  offlineTime: number; // Total time spent offline in seconds
  
  // Progress tracking
  questionsAttempted: number;
  questionsCompleted: number;
  currentQuestionIndex: number;
  
  // Connection tracking
  connectionEvents: ConnectionEvent[];
  suspiciousActivityCount: number;
  
  // Results (populated after submission)
  score?: number;
  maxScore?: number;
  percentage?: number;
  passStatus?: 'passed' | 'failed' | 'pending';
  
  // Late submission tracking
  lateSubmissionApprovalId?: string; // ID of the late submission approval if this is a late submission attempt
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Connection event tracking
export interface ConnectionEvent {
  timestamp: number; // milliseconds
  type: 'connect' | 'disconnect' | 'heartbeat' | 'page_refresh' | 'tab_switch';
  duration?: number; // for disconnect events
  metadata?: {
    userAgent?: string;
    reason?: string;
    location?: string;
  };
}

// Attempt summary for quick lookups
export interface AttemptSummary {
  testId: string;
  studentId: string;
  totalAttempts: number;
  attemptsAllowed: number;
  canCreateNewAttempt: boolean;
  bestScore?: number;
  lastAttemptStatus?: TestAttemptStatus;
  lastAttemptDate?: Timestamp;
  attempts: {
    attemptNumber: number;
    attemptId: string;
    status: TestAttemptStatus;
    score?: number;
    percentage?: number;
    submittedAt?: Timestamp;
  }[];
}

// Real-time attempt state (stored in Realtime DB)
export interface RealtimeAttemptState {
  attemptId: string;
  testId: string;
  studentId: string;
  
  // Current state
  status: TestAttemptStatus;
  isActive: boolean;
  lastHeartbeat: number;
  
  // Time management
  sessionStartTime: number; // When this session started
  totalTimeSpent: number; // Cumulative time spent
  timeRemaining: number; // Real-time remaining time
  
  // Current position
  currentQuestionIndex: number;
  questionsVisited: string[];
  
  // Connection state
  isOnline: boolean;
  disconnectedAt?: number;
  connectionId: string; // Unique per browser session
  
  // Browser info
  userAgent: string;
  tabId: string;
  windowId: string;
}

// Question order mapping for shuffled tests
export interface QuestionOrderMapping {
  originalOrder: number; // Original position in test (0-based)
  shuffledOrder: number; // Shuffled position for this student (0-based)
  questionId: string; // Question ID for reference
}

// Session tracking for untimed tests
export interface TestSession {
  sessionId: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  timeSpent: number; // seconds spent in this session
  isPaused: boolean; // true if session was paused/closed
}

// Test attempt with question shuffling support
export interface TestAttemptWithShuffling extends TestAttempt {
  // Question order mapping (only present if test has shuffleQuestions enabled)
  questionOrderMapping?: QuestionOrderMapping[];
  isShuffled: boolean; // Quick flag to check if questions were shuffled
  shuffledQuestionIds?: string[]; // Ordered list of question IDs in shuffled order
  
  // NEW: Untimed test tracking
  isUntimedTest?: boolean; // Flag to identify untimed test attempts
  totalTimeSpentAcrossSessions?: number; // Cumulative time across all sessions (seconds)
  sessionHistory?: TestSession[]; // Track each session for analytics
}

// Time calculation utilities
export interface TimeCalculation {
  totalTimeAllowed: number; // seconds
  timeSpent: number; // seconds
  timeRemaining: number; // seconds
  offlineTime: number; // seconds
  isExpired: boolean;
  canContinue: boolean;
  timeUntilExpiry: number; // seconds
}
