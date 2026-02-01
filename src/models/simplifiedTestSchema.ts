// Simplified Test Schema - Using Question Bank References
// This eliminates the complexity of duplicating question data in tests

import { Timestamp } from 'firebase/firestore';

// Test types
export type TestType = 'live' | 'flexible' | 'in-class';

// Question selection method
export type QuestionSelectionMethod = 'manual' | 'auto' | 'mixed';

// ... (existing code omitted for brevity in prompt, but replacing with full valid block if needed or just updating type definition)

// Test status
export type TestStatus = 'draft' | 'scheduled' | 'live' | 'completed' | 'cancelled';

// Test attempt status
export type AttemptStatus = 'not_started' | 'in_progress' | 'submitted' | 'auto_submitted' | 'expired';

// Test configuration interface
export interface TestConfig {
  // Question selection
  questionSelectionMethod: QuestionSelectionMethod;
  totalQuestions: number;
  shuffleQuestions: boolean;
  allowReviewBeforeSubmit: boolean;
  
  // Scoring
  passingScore?: number;
  showResultsImmediately: boolean;
  
  // Difficulty balance (for auto selection)
  difficultyBalance?: {
    easy: number;    // percentage
    medium: number;  // percentage
    hard: number;    // percentage
  };
}

// Question reference for test (no duplicated data)
export interface TestQuestionRef {
  questionId: string;
  order: number;
  points: number; // Can override the default points from question bank
}

// Base test interface - simplified
export interface BaseSimplifiedTest {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  
  // Test numbering (NEW)
  testNumber?: number; // Sequential number within class/subject
  displayNumber?: string; // Formatted display string (e.g., "Math Test #5")
  numberAssignmentId?: string; // Reference to TestNumberAssignment
  
  // Ownership and assignment
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  classIds: string[];
  classNames: string[];
  
  // Test configuration
  type: TestType;
  config: TestConfig;
  
  // Question references only (NO duplicated data)
  questionRefs: TestQuestionRef[];
  totalMarks: number;
  
  // Status and timing
  status: TestStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Live/Scheduled test
export interface SimplifiedLiveTest extends BaseSimplifiedTest {
  type: 'live';
  
  // Scheduling
  scheduledStartTime: Timestamp;
  duration: number; // in minutes
  bufferTime: number; // additional time in minutes (default 5)
  
  // Calculated times
  studentJoinTime: Timestamp; // Exactly at start time
  actualEndTime: Timestamp; // start + duration + buffer
  
  // Live test status
  isLive: boolean;
  studentsOnline: number;
  studentsCompleted: number;
}

// Flexible/Homework test
export interface SimplifiedFlexibleTest extends BaseSimplifiedTest {
  type: 'flexible';
  
  // Availability window
  availableFrom?: Timestamp;
  availableTo?: Timestamp;
  
  // Duration control
  duration?: number; // in minutes (optional, if time limited)
  
  // Attempts
  attemptsAllowed?: number;
}

// In-Class test
export interface SimplifiedInClassTest extends BaseSimplifiedTest {
  type: 'in-class';
  
  // Scheduling
  scheduledStartTime: Timestamp;
  duration: number; // in minutes
  
  // Submission method
  submissionMethod: 'online_upload' | 'offline_collection';
  examPdfUrl?: string;
}

// Union type for all simplified test types
export type SimplifiedTest = SimplifiedLiveTest | SimplifiedFlexibleTest | SimplifiedInClassTest;

// Simplified submission answer (with question reference)
export interface SimplifiedAnswer {
  questionId: string;
  selectedOption?: number; // for MCQ (0-based index)
  textContent?: string; // for essay
  timeSpent: number; // seconds
  changeCount: number;
  wasReviewed: boolean;
}

// Simplified submission schema
export interface SimplifiedSubmission {
  id: string;
  
  // Test info
  testId: string;
  testTitle: string;
  testType: 'live' | 'flexible' | 'in-class';
  
  // Student info
  studentId: string;
  studentName: string;
  studentEmail?: string;
  classId: string;
  className: string;
  
  // Attempt details
  attemptNumber: number;
  status: 'submitted' | 'auto_submitted' | 'expired' | 'terminated';
  
  // Timing
  startTime: Timestamp;
  endTime: Timestamp;
  submittedAt: Timestamp;
  totalTimeSpent: number; // seconds
  
  // Simplified answers (no duplicated question data)
  answers: SimplifiedAnswer[];
  
  // Statistics
  questionsAttempted: number;
  questionsSkipped: number;
  questionsReviewed: number;
  totalChanges: number;
  
  // Results (calculated by comparing with original questions)
  autoGradedScore?: number;
  manualGradingPending: boolean;
  totalScore?: number;
  maxScore: number;
  percentage?: number;
  passStatus?: 'passed' | 'failed' | 'pending_review';
  
  // Review and feedback
  teacherReview?: {
    reviewedBy: string;
    reviewedAt: Timestamp;
    feedback?: string;
    recommendedActions?: string[];
  };
  
  // Integrity monitoring
  integrityReport: {
    tabSwitches: number;
    disconnections: number;
    suspiciousActivities: string[];
    isIntegrityCompromised: boolean;
    notes?: string;
  };
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Result calculation interface (computed on-the-fly)
export interface ComputedMCQResult {
  questionId: string;
  selectedOption: number;
  isCorrect: boolean;
  marksAwarded: number;
  maxMarks: number;
}

export interface ComputedEssayResult {
  questionId: string;
  studentAnswer: string;
  wordCount: number;
  marksAwarded?: number;
  maxMarks: number;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: Timestamp;
}
