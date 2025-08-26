// Question bank models and types

import { Timestamp } from 'firebase/firestore';

// Question option interface
export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  // For image-based options
  imageUrl?: string;
}

// Base question interface
export interface BaseQuestion {
  id: string;
  title: string;
  // Text content of question (optional if using image)
  content?: string;
  // URL to question image file
  imageUrl?: string;
  type: 'mcq' | 'essay';
  // Question metadata
  topic?: string;
  subtopic?: string;
  // Reference information (optional)
  reference?: string;
  // Difficulty level
  difficultyLevel: 'easy' | 'medium' | 'hard';
  points: number;
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Multiple choice question
export interface MCQQuestion extends BaseQuestion {
  type: 'mcq';
  // MCQ specific fields
  options: QuestionOption[];
  // Letter of correct answer (A, B, C, D, E)
  correctAnswer?: string;
  // Explanation of the answer
  explanation: string;
  // Optional explanation image
  explanationImageUrl?: string;
}

// Essay question
export interface EssayQuestion extends BaseQuestion {
  type: 'essay';
  // Suggested answer content (optional if using image)
  suggestedAnswerContent?: string;
  // Suggested answer as image
  suggestedAnswerImageUrl?: string;
  // Word requirements for essay questions
  wordLimit?: number;
  minWordCount?: number;
}

// Union type for all question types
export type Question = MCQQuestion | EssayQuestion;

// Question bank interface
export interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  // Subject/class this bank belongs to
  subjectId: string;
  subjectName: string;
  grade?: string;
  // Question IDs contained in this bank
  questionIds: string[];
  // Class assignments (optional)
  assignedClassIds?: string[];
  // Quick stats
  totalQuestions: number;
  mcqCount: number;
  essayCount: number;
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Assignment of question bank to class
export interface QuestionBankAssignment {
  id: string;
  // The question bank being assigned
  bankId: string;
  bankName: string;
  // The class the bank is assigned to
  classId: string;
  className: string;
  // Assignment metadata
  assignedBy: string;
  assignedAt: Timestamp;
  dueDate?: Timestamp;
  status: 'active' | 'draft' | 'archived';
  // Access settings
  isVisible: boolean;
}
