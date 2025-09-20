import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// Pre-computed analytics schema for fast retrieval
export const PrecomputedAnalyticsSchema = z.object({
  id: z.string(), // Format: classId or studentId_classId
  type: z.enum(['class', 'student']), // Type of analytics
  
  // Class-level analytics (when type === 'class')
  classId: z.string(),
  className: z.string().optional(),
  teacherId: z.string(),
  
  // Student-level analytics (when type === 'student')
  studentId: z.string().optional(),
  studentName: z.string().optional(),
  studentEmail: z.string().optional(),
  
  // Quick stats for immediate display
  quickStats: z.object({
    totalStudents: z.number().default(0),
    averagePerformance: z.number().default(0),
    passRate: z.number().default(0),
    testsCompleted: z.number().default(0),
    passedTests: z.number().default(0),
    totalTests: z.number().default(0),
  }),
  
  // Detailed analytics data
  detailedStats: z.object({
    // Performance breakdown
    performanceDistribution: z.array(z.object({
      range: z.string(), // "0-20", "21-40", etc.
      count: z.number(),
      percentage: z.number(),
    })).default([]),
    
    // Subject performance
    subjectPerformance: z.array(z.object({
      subject: z.string(),
      averageScore: z.number(),
      totalTests: z.number(),
      passRate: z.number(),
    })).default([]),
    
    // Topic analysis
    topicAnalysis: z.array(z.object({
      topic: z.string(),
      averageScore: z.number(),
      totalQuestions: z.number(),
      correctAnswers: z.number(),
      studentsStruggling: z.number(),
    })).default([]),
    
    // Recent test performance
    recentTests: z.array(z.object({
      testId: z.string(),
      testTitle: z.string(),
      averageScore: z.number(),
      completionRate: z.number(),
      passRate: z.number(),
      createdAt: z.date(),
    })).default([]),
    
    // Student performance (for class analytics)
    studentPerformances: z.array(z.object({
      studentId: z.string(),
      studentName: z.string(),
      studentEmail: z.string(),
      overallAverage: z.number(),
      totalTests: z.number(),
      passedTests: z.number(),
      improvementTrend: z.enum(['improving', 'declining', 'stable']),
      lastActiveDate: z.date().nullable(),
      weakTopics: z.array(z.object({
        topic: z.string(),
        averageScore: z.number(),
        totalQuestions: z.number(),
        correctAnswers: z.number(),
      })),
      strongTopics: z.array(z.object({
        topic: z.string(),
        averageScore: z.number(),
        totalQuestions: z.number(),
        correctAnswers: z.number(),
      })),
    })).default([]),
    
    // Performance trends
    performanceTrends: z.array(z.object({
      date: z.date(),
      averageScore: z.number(),
      testsCompleted: z.number(),
      studentsActive: z.number(),
    })).default([]),
  }),
  
  // Metadata
  computedAt: z.date(),
  lastUpdated: z.date(),
  version: z.number().default(1),
  isStale: z.boolean().default(false), // Indicates if data needs recomputation
  
  // Data sources hash for change detection
  dataHash: z.string(), // Hash of source data to detect changes
  
  // Computation metrics
  computationMetrics: z.object({
    duration: z.number(), // Computation time in ms
    dataPoints: z.number(), // Number of submissions/enrollments processed
    lastError: z.string().nullable().default(null),
  }).optional(),
});

export type PrecomputedAnalytics = z.infer<typeof PrecomputedAnalyticsSchema>;

// Quick stats only schema for ultra-fast loading
export const QuickStatsSchema = z.object({
  id: z.string(),
  classId: z.string(),
  totalStudents: z.number(),
  averagePerformance: z.number(),
  passRate: z.number(),
  testsCompleted: z.number(),
  lastUpdated: z.date(),
  isStale: z.boolean(),
});

export type QuickStats = z.infer<typeof QuickStatsSchema>;

// Analytics computation job schema
export const AnalyticsJobSchema = z.object({
  id: z.string(),
  type: z.enum(['class', 'student', 'global']),
  classId: z.string().optional(),
  studentId: z.string().optional(),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  error: z.string().nullable(),
  retryCount: z.number().default(0),
  maxRetries: z.number().default(3),
});

export type AnalyticsJob = z.infer<typeof AnalyticsJobSchema>;