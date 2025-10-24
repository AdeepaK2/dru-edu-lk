// Test system models and types

import { Timestamp } from 'firebase/firestore';
import { TestAssignmentConfig, TestAssignmentType, StudentTestAssignment } from './testAssignmentSchema';

// Test types
export type TestType = 'live' | 'flexible';

// Question selection method
export type QuestionSelectionMethod = 'manual' | 'auto' | 'mixed';

// Test status
export type TestStatus = 'draft' | 'scheduled' | 'live' | 'completed' | 'cancelled';

// Test attempt status
export type AttemptStatus = 'not_started' | 'in_progress' | 'submitted' | 'auto_submitted' | 'expired';

// Test configuration interface
export interface TestConfig {
  // Question selection
  questionSelectionMethod: QuestionSelectionMethod;
  questionType?: 'mcq' | 'essay'; // New field for question type preference
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

// Selected question for test
export interface TestQuestion {
  id: string; // question ID
  questionId: string; // for backward compatibility
  questionType: 'mcq' | 'essay';
  type: 'mcq' | 'essay'; // for backward compatibility
  points: number;
  marks: number; // for backward compatibility
  order: number;
  
  // Question content
  questionText: string;
  content?: string;
  imageUrl?: string;
  
  // MCQ specific
  options?: string[]; // array of option texts
  correctOption?: number; // index of correct option
  explanation?: string;
  explanationImageUrl?: string;
  
  // Metadata
  difficultyLevel?: 'easy' | 'medium' | 'hard';
  topic?: string;
  
  // Populated question data (for performance)
  questionData?: {
    title: string;
    content?: string;
    imageUrl?: string;
    options?: Array<{
      id: string;
      text: string;
      imageUrl?: string;
    }>;
    explanation?: string;
    explanationImageUrl?: string;
  };
}

// Base test interface
export interface BaseTest {
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
  
  // Assignment configuration (extended for student selection)
  assignmentType?: TestAssignmentType; // New field: 'class-based' | 'student-based' | 'mixed'
  classIds: string[]; // For class-based tests only
  classNames: string[]; // For class-based tests only
  
  // For student-based tests - metadata only (not used for queries)
  totalAssignedStudents?: number; // New field for quick access
  assignmentSummary?: {
    studentCount: number;
    classesInvolved: string[]; // For display only
  };
  
  // Test configuration
  type: TestType;
  config: TestConfig;
  
  // Questions
  questions: TestQuestion[];
  totalMarks: number;
  
  // Exam PDF (for essay questions)
  examPdfUrl?: string; // URL to the generated exam PDF in Firebase Storage
  
  // Status and timing
  status: TestStatus;
  isDeleted?: boolean; // For soft deletion
  deletedAt?: Timestamp; // When it was soft deleted
  deletedBy?: string; // Who deleted it
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Live/Scheduled test
export interface LiveTest extends BaseTest {
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

// Flexible duration test
export interface FlexibleTest extends BaseTest {
  type: 'flexible';
  
  // Availability period
  availableFrom: Timestamp;
  availableTo: Timestamp;
  
  // Extension tracking
  originalAvailableTo?: Timestamp; // Store original deadline for audit trail
  extensionHistory?: TestExtension[]; // Track all extensions made
  isExtended?: boolean; // Flag to quickly identify extended tests
  
  // Test duration
  duration: number; // in minutes (0 for untimed tests)
  attemptsAllowed: number; // usually 1
  
  // NEW: Untimed mode - students can pause and resume without per-session time limit
  isUntimed?: boolean; // If true, no per-session countdown timer, only deadline matters
}

// Test extension record
export interface TestExtension {
  id: string;
  extendedBy: string; // Teacher ID who made the extension
  extendedByName: string; // Teacher name for display
  previousDeadline: Timestamp; // What the deadline was before
  newDeadline: Timestamp; // What it was extended to
  reason?: string; // Optional reason for extension
  createdAt: Timestamp; // When the extension was made
  notificationsSent?: boolean; // Track if students were notified
}

// Union type for all test types
export type Test = LiveTest | FlexibleTest;

// Student answer for MCQ
export interface MCQAnswer {
  questionId: string;
  selectedOption: string; // option ID
  timeSpent: number; // in seconds
}

// Student answer for Essay
export interface EssayAnswer {
  questionId: string;
  content: string;
  wordCount: number;
  timeSpent: number; // in seconds
}

// Union type for answers
export type StudentAnswer = MCQAnswer | EssayAnswer;

// Test attempt by student
export interface TestAttempt {
  id: string;
  testId: string;
  testTitle: string;
  studentId: string;
  studentName: string;
  classId: string;
  
  // Attempt details
  attemptNumber: number;
  status: AttemptStatus;
  
  // Timing
  startTime?: Timestamp;
  endTime?: Timestamp;
  timeSpent: number; // in seconds
  remainingTime?: number; // in seconds
  
  // Answers
  answers: StudentAnswer[];
  
  // Results (calculated after submission)
  score?: number;
  totalMarks?: number;
  percentage?: number;
  mcqCorrect?: number;
  mcqWrong?: number;
  essayMarks?: number;
  passStatus?: 'passed' | 'failed' | 'pending';
  
  // Metadata
  submittedAt?: Timestamp;
  autoSubmitted: boolean;
  reviewedBy?: string; // teacher ID for essay grading
  reviewedAt?: Timestamp;
}

// Test analytics
export interface TestAnalytics {
  testId: string;
  
  // Participation
  totalStudents: number;
  studentsAttempted: number;
  studentsCompleted: number;
  studentsInProgress: number;
  
  // Performance
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passRate: number;
  
  // Question-wise analysis
  questionAnalytics: Array<{
    questionId: string;
    questionTitle: string;
    correctAnswers: number;
    wrongAnswers: number;
    averageTimeSpent: number;
    difficultyLevel: string;
    topic?: string;
  }>;
  
  // Timing
  averageTimeSpent: number;
  fastestCompletion: number;
  slowestCompletion: number;
  
  // Updated timestamp
  lastUpdated: Timestamp;
}

// Test notification
export interface TestNotification {
  id: string;
  testId: string;
  testTitle: string;
  type: 'reminder' | 'started' | 'ending_soon' | 'ended';
  message: string;
  recipientIds: string[]; // student IDs
  sentAt: Timestamp;
  scheduledFor?: Timestamp;
}

// Question bank selection for auto question selection
export interface QuestionBankSelection {
  bankId: string;
  bankName: string;
  lessonIds?: string[];
  lessonNames?: string[];
  questionCount: number;
  difficultyDistribution?: {
    easy: number;
    medium: number;
    hard: number;
  };
}

// Test template for reusing test configurations
export interface TestTemplate {
  id: string;
  title: string;
  description?: string;
  instructions?: string;

  // Ownership
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;

  // Template configuration (same as TestConfig but without dates)
  config: TestConfig;

  // Questions (same structure as Test.questions)
  questions: TestQuestion[];
  totalMarks: number;

  // Template metadata
  isPublic?: boolean; // Can be used by other teachers
  usageCount?: number; // How many times this template has been used

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
