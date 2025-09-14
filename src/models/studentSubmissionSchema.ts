// Student submission models for test system
// Uses Firebase Realtime Database during test + Firestore for final storage

import { Timestamp } from 'firebase/firestore';

// Real-time answer tracking (stored in Realtime DB during test)
export interface RealtimeAnswer {
  questionId: string;
  selectedOption?: number | string; // for MCQ
  textContent?: string; // for essay
  pdfFiles?: PdfAttachment[]; // for essay with PDF attachments
  lastModified: number; // timestamp in milliseconds
  timeSpent: number; // seconds spent on this question
  isMarkedForReview: boolean;
  changeHistory: AnswerChange[];
}

// PDF attachment for essay answers
export interface PdfAttachment {
  fileName: string;
  fileUrl: string;
  fileSize: number; // in bytes
  uploadedAt: number; // timestamp in milliseconds
  uploadStatus: 'uploading' | 'completed' | 'error';
}

// Track every change made to an answer
export interface AnswerChange {
  timestamp: number; // milliseconds
  type: 'select' | 'deselect' | 'text_change' | 'mark_review' | 'unmark_review' | 'pdf_upload' | 'pdf_remove';
  previousValue?: any;
  newValue?: any;
  timeOnQuestion: number; // how long they've been on this question
  pdfInfo?: { fileName: string; fileSize: number }; // for PDF-related changes
}

// Real-time test session (stored in Realtime DB during test)
export interface RealtimeTestSession {
  // Session info
  attemptId: string;
  testId: string;
  studentId: string;
  studentName: string;
  classId: string;
  
  // Status tracking
  status: 'active' | 'paused' | 'submitted' | 'disconnected';
  currentQuestionIndex: number;
  isReviewMode: boolean;
  
  // Timing
  startTime: number; // timestamp in milliseconds
  lastActivity: number; // timestamp in milliseconds
  totalTimeSpent: number; // seconds
  timePerQuestion: Record<string, number>; // questionId -> seconds
  
  // Answers (real-time updates)
  answers: Record<string, RealtimeAnswer>; // questionId -> answer
  
  // Navigation tracking
  questionsVisited: string[]; // question IDs in order visited
  questionsCompleted: string[]; // questions with answers
  questionsMarkedForReview: string[];
  
  // Browser/connection info
  userAgent: string;
  ipAddress?: string;
  isFullscreen: boolean;
  tabSwitchCount: number;
  disconnectionCount: number;
  
  // Monitoring flags
  suspiciousActivity: {
    tabSwitches: number;
    copyPasteAttempts: number;
    rightClickAttempts: number;
    keyboardShortcuts: string[];
  };
}

// Final submission (stored in Firestore after test completion)
export interface StudentSubmission {
  id: string; // same as attemptId
  
  // Test info
  testId: string;
  testTitle: string;
  testType: 'live' | 'flexible';
  
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
  timePerQuestion: Record<string, number>; // questionId -> seconds
  
  // Final answers
  finalAnswers: FinalAnswer[];
  
  // Statistics
  questionsAttempted: number;
  questionsSkipped: number;
  questionsReviewed: number;
  totalChanges: number; // total answer changes made
  
  // Results (calculated after submission)
  autoGradedScore?: number; // MCQ score
  manualGradingPending: boolean; // true if has essay questions
  totalScore?: number; // final score after manual grading
  maxScore: number;
  percentage?: number;
  passStatus?: 'passed' | 'failed' | 'pending_review';
  
  // Grading details
  mcqResults?: MCQResult[];
  essayResults?: EssayResult[];
  
  // Review and feedback
  teacherReview?: {
    reviewedBy: string;
    reviewedAt: Timestamp;
    feedback?: string;
    recommendedActions?: string[];
  };
  
  // Late submission tracking
  lateSubmission?: {
    isLateSubmission: boolean;
    approvalId: string;
    approvedBy: string;
    approvedByName: string;
    originalDeadline: Timestamp;
    approvedAt: Timestamp;
    reason?: string;
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

// Final answer for a question
export interface FinalAnswer {
  questionId: string;
  questionType: 'mcq' | 'essay';
  questionText: string;
  questionMarks: number;
  
  // Answer content
  selectedOption?: number; // for MCQ (option index)
  selectedOptionText?: string; // for display
  textContent?: string; // for essay
  pdfFiles?: PdfAttachment[]; // for essay with PDF attachments
  
  // Metadata
  timeSpent: number; // seconds
  changeCount: number; // how many times changed
  wasReviewed: boolean;
  isCorrect?: boolean; // for MCQ (calculated)
  marksAwarded?: number; // actual marks (auto for MCQ, manual for essay)
}

// MCQ result details
export interface MCQResult {
  questionId: string;
  questionText: string;
  selectedOption: number;
  selectedOptionText: string;
  correctOption: number;
  correctOptionText: string;
  isCorrect: boolean;
  marksAwarded: number;
  maxMarks: number;
  explanation?: string;
  difficultyLevel: 'easy' | 'medium' | 'hard';
  topic?: string;
}

// Essay result details
export interface EssayResult {
  questionId: string;
  questionText: string;
  studentAnswer: string;
  wordCount: number;
  
  // Manual grading
  marksAwarded?: number;
  maxMarks: number;
  rubricScores?: Record<string, number>; // criteria -> score
  
  // Teacher feedback
  feedback?: string;
  strengths?: string[];
  improvements?: string[];
  
  // Grading metadata
  gradedBy?: string;
  gradedAt?: Timestamp;
  gradingTime?: number; // seconds spent grading
}

// Real-time monitoring data for teachers
export interface RealtimeMonitoring {
  testId: string;
  lastUpdated: number; // timestamp
  
  // Active students
  activeStudents: Record<string, {
    studentId: string;
    studentName: string;
    status: 'active' | 'disconnected' | 'submitted';
    currentQuestion: number;
    progress: number; // percentage
    timeRemaining: number; // seconds
    lastActivity: number; // timestamp
    suspiciousActivity: boolean;
  }>;
  
  // Test statistics
  stats: {
    totalStudents: number;
    studentsStarted: number;
    studentsActive: number;
    studentsCompleted: number;
    averageProgress: number;
    averageTimeSpent: number;
  };
  
  // Question-wise progress
  questionProgress: Record<string, {
    attempted: number;
    completed: number;
    averageTime: number;
    commonAnswers?: Record<string, number>; // for MCQ
  }>;
}

// Test session events for analytics
export interface TestSessionEvent {
  timestamp: number;
  attemptId: string;
  studentId: string;
  eventType: 'start' | 'answer_change' | 'question_navigate' | 'review_toggle' | 
            'tab_switch' | 'disconnect' | 'reconnect' | 'submit' | 'auto_submit';
  data?: any;
  questionId?: string;
}

// Batch submission for performance (when test ends)
export interface BatchSubmissionData {
  testId: string;
  submissions: StudentSubmission[];
  realtimeData: Record<string, RealtimeTestSession>; // backup of realtime data
  events: TestSessionEvent[];
  completedAt: Timestamp;
}
