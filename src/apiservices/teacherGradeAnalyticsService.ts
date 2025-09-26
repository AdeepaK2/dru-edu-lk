// Grade Analytics Service
// Provides comprehensive analytics for teacher grades page
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  Timestamp,
  limit
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { ClassDocument } from '@/models/classSchema';
import { Test } from '@/models/testSchema';
import { StudentSubmission } from '@/models/studentSubmissionSchema';

// Interface for class summary
export interface ClassSummary {
  id: string;
  classId: string;
  name: string;
  subject: string;
  subjectId: string;
  year: string;
  enrolledStudents: number;
  totalTests: number;
  completedTests: number;
  averageScore: number;
  lastActivityDate?: Date;
}

// Interface for test summary in a class
export interface TestSummary {
  id: string;
  title: string;
  testNumber?: number;
  displayNumber?: string;
  type: 'live' | 'flexible';
  status: string;
  totalMarks: number;
  createdAt: Date;
  
  // Analytics
  totalStudents: number;
  attemptedStudents: number;
  completedStudents: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passRate: number; // percentage
  
  // Time statistics
  averageTimeSpent: number; // in minutes
  
  // Submission statistics
  onTimeSubmissions: number;
  lateSubmissions: number;
  
  // Question analysis
  questionAnalysis: QuestionAnalysis[];
}

// Interface for question analysis
export interface QuestionAnalysis {
  questionId: string;
  questionText: string;
  questionType: 'mcq' | 'essay';
  maxMarks: number;
  averageScore: number;
  difficultyLevel: 'easy' | 'medium' | 'hard';
  correctAnswerRate?: number; // For MCQ
  topic?: string;
}

// Interface for student performance summary
export interface StudentPerformanceSummary {
  id: string;
  name: string;
  email: string;
  
  // Test statistics
  totalTestsAssigned: number;
  totalTestsAttempted: number;
  totalTestsCompleted: number;
  totalTestsPassed: number;
  totalTestsFailed: number;
  
  // Submission statistics
  onTimeSubmissions: number;
  lateSubmissions: number;
  lateSubmissionRate: number; // percentage
  
  // Performance metrics
  overallAverage: number;
  highestScore: number;
  lowestScore: number;
  improvementTrend: 'improving' | 'declining' | 'stable';
  
  // Time management
  averageTimeSpent: number; // in minutes
  timeEfficiencyScore: number; // 1-10 scale
  
  // Weak areas (topics/subjects where student struggles)
  weakTopics: WeakTopic[];
  weakLessons: WeakLesson[];
  
  // Attendance and engagement
  testAttendanceRate: number; // percentage
  lastActivityDate?: Date;
}

// Interface for weak topics
export interface WeakTopic {
  topic: string;
  averageScore: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number; // percentage
}

// Interface for weak lessons
export interface WeakLesson {
  lessonId: string;
  lessonName: string;
  subjectId: string;
  subjectName: string;
  averageScore: number;
  totalAttempts: number;
  weaknessLevel: 'high' | 'medium' | 'low';
}

// Interface for detailed student report
export interface DetailedStudentReport extends StudentPerformanceSummary {
  recentTests: RecentTestResult[];
  performanceTrend: PerformanceDataPoint[];
  recommendations: string[];
  strengths: string[];
  areasForImprovement: string[];
}

// Interface for recent test results
export interface RecentTestResult {
  testId: string;
  testTitle: string;
  testDate: Date;
  score: number;
  maxScore: number;
  percentage: number;
  timeSpent: number; // in minutes
  isLateSubmission: boolean;
  passStatus: 'passed' | 'failed' | 'pending_review';
}

// Interface for performance trend data points
export interface PerformanceDataPoint {
  date: Date;
  score: number;
  testTitle: string;
  subject: string;
}

export class GradeAnalyticsService {
  private static readonly COLLECTIONS = {
    CLASSES: 'classes',
    TESTS: 'tests',
    SUBMISSIONS: 'studentSubmissions',
    STUDENTS: 'students',
    ENROLLMENTS: 'studentEnrollments',
    LESSONS: 'lessons',
    SUBJECTS: 'subjects'
  };

  /**
   * Get all classes taught by a teacher with summary analytics
   */
  static async getTeacherClassesSummary(teacherId: string): Promise<ClassSummary[]> {
    try {
      console.log(`🔍 [GRADE ANALYTICS] Getting classes summary for teacher: ${teacherId}`);
      
      // Get classes taught by teacher
      const classesQuery = query(
        collection(firestore, this.COLLECTIONS.CLASSES),
        where('teacherId', '==', teacherId),
        where('status', '==', 'Active'),
        orderBy('name', 'asc')
      );
      
      const classesSnapshot = await getDocs(classesQuery);
      console.log(`✅ [GRADE ANALYTICS] Found ${classesSnapshot.docs.length} active classes for teacher`);
      
      if (classesSnapshot.empty) {
        return [];
      }

      const classIds = classesSnapshot.docs.map(doc => doc.id);
      
      // Get all tests for all classes in one query (much more efficient)
      const allTestsQuery = query(
        collection(firestore, this.COLLECTIONS.TESTS),
        where('teacherId', '==', teacherId)
      );
      
      // Get all enrollments for all classes in one query
      const allEnrollmentsQuery = query(
        collection(firestore, this.COLLECTIONS.ENROLLMENTS),
        where('classId', 'in', classIds.slice(0, 10)), // Firestore limit
        where('status', '==', 'Active')
      );
      
      // Execute queries in parallel for better performance
      const [allTestsSnapshot, allEnrollmentsSnapshot] = await Promise.all([
        getDocs(allTestsQuery),
        getDocs(allEnrollmentsQuery)
      ]);
      
      // Process enrollments by class
      const enrollmentsByClass = new Map<string, number>();
      allEnrollmentsSnapshot.docs.forEach(doc => {
        const enrollment = doc.data();
        const classId = enrollment.classId;
        enrollmentsByClass.set(classId, (enrollmentsByClass.get(classId) || 0) + 1);
      });
      
      // Process tests by class
      const testsByClass = new Map<string, any[]>();
      allTestsSnapshot.docs.forEach(doc => {
        const testData = doc.data();
        
        // Skip deleted tests
        if (testData.isDeleted === true) return;
        
        // Only include class-based tests
        if (testData.assignmentType === 'student-based') return;
        
        // Check if test belongs to any of our classes
        if (testData.classIds && Array.isArray(testData.classIds)) {
          testData.classIds.forEach((classId: string) => {
            if (classIds.includes(classId)) {
              if (!testsByClass.has(classId)) {
                testsByClass.set(classId, []);
              }
              testsByClass.get(classId)!.push(testData);
            }
          });
        }
      });
      
      // Build class summaries efficiently
      const classSummaries: ClassSummary[] = [];
      
      for (const classDoc of classesSnapshot.docs) {
        const classData = classDoc.data() as ClassDocument;
        const classId = classDoc.id;
        
        // Get test statistics for this class
        const classTests = testsByClass.get(classId) || [];
        const completedTests = classTests.filter(test => test.status === 'completed').length;
        
        // Get enrollment count
        const enrolledStudents = enrollmentsByClass.get(classId) || 0;
        
        console.log(`✅ [GRADE ANALYTICS] Class "${classData.name}": ${enrolledStudents} students, ${classTests.length} tests`);
        
        classSummaries.push({
          id: classId,
          classId: classData.classId,
          name: classData.name,
          subject: classData.subject,
          subjectId: classData.subjectId,
          year: classData.year,
          enrolledStudents,
          totalTests: classTests.length,
          completedTests,
          averageScore: 0, // We'll calculate this later if needed, for now set to 0 for speed
          lastActivityDate: undefined // We'll calculate this later if needed
        });
      }
      
      // Handle remaining classes if we have more than 10 (Firestore 'in' limit)
      if (classIds.length > 10) {
        const remainingClassIds = classIds.slice(10);
        const remainingEnrollmentsQuery = query(
          collection(firestore, this.COLLECTIONS.ENROLLMENTS),
          where('classId', 'in', remainingClassIds),
          where('status', '==', 'Active')
        );
        
        const remainingEnrollmentsSnapshot = await getDocs(remainingEnrollmentsQuery);
        remainingEnrollmentsSnapshot.docs.forEach(doc => {
          const enrollment = doc.data();
          const classId = enrollment.classId;
          const classIndex = classSummaries.findIndex(c => c.id === classId);
          if (classIndex !== -1) {
            classSummaries[classIndex].enrolledStudents += 1;
          }
        });
      }
      
      console.log(`✅ [GRADE ANALYTICS] Returning ${classSummaries.length} class summaries:`, 
        classSummaries.map(c => ({ 
          className: c.name, 
          students: c.enrolledStudents, 
          totalTests: c.totalTests 
        })));
      
      return classSummaries;
    } catch (error) {
      console.error('Error getting teacher classes summary:', error);
      throw error;
    }
  }/**
   * Get detailed test analytics for a specific class (class-based tests only)
   */
  static async getClassTestAnalytics(classId: string): Promise<TestSummary[]> {
    try {
      console.log(`🔍 [GRADE ANALYTICS] Getting test analytics for class: ${classId}`);
      
      // Simplified approach: Get all tests for this class without orderBy to avoid index issues
      const testsQuery = query(
        collection(firestore, this.COLLECTIONS.TESTS),
        where('classIds', 'array-contains', classId)
      );
      
      const testsSnapshot = await getDocs(testsQuery);
      console.log(`✅ [GRADE ANALYTICS] Found ${testsSnapshot.docs.length} total tests for class ${classId}`);
      
      if (testsSnapshot.empty) {
        console.log(`⚠️ [GRADE ANALYTICS] No tests found for class ${classId}`);
        return [];
      }
      
      const testSummaries: TestSummary[] = [];
      
      // Filter to only include class-based tests (not student-based tests) and active tests
      const classBasedTests = testsSnapshot.docs.filter(doc => {
        const testData = doc.data();
        
        // First filter out soft-deleted tests (same approach as TestService)
        if (testData.isDeleted === true) {
          console.log(`⚠️ [GRADE ANALYTICS] Filtering out deleted test: ${testData.title}`);
          return false;
        }
        
        // Include tests that are either explicitly class-based or don't have assignmentType set (legacy class-based tests)
        const isClassBased = testData.assignmentType !== 'student-based' && 
                            testData.classIds && 
                            testData.classIds.length > 0;
        
        console.log(`🔍 [GRADE ANALYTICS] Test "${testData.title}" - assignmentType: ${testData.assignmentType}, classIds: ${JSON.stringify(testData.classIds)}, isClassBased: ${isClassBased}, isDeleted: ${testData.isDeleted}`);
        return isClassBased;
      });
      
      console.log(`✅ [GRADE ANALYTICS] Found ${testsSnapshot.docs.length} total tests, ${classBasedTests.length} class-based tests for class ${classId}`);
      
      for (const testDoc of classBasedTests) {
        const testData = testDoc.data() as Test;
        
        // Get submissions for this test
        const submissionsQuery = query(
          collection(firestore, this.COLLECTIONS.SUBMISSIONS),
          where('testId', '==', testDoc.id)
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);
        const submissions = submissionsSnapshot.docs.map(doc => doc.data() as StudentSubmission);
        
        // Calculate analytics
        const totalStudents = await this.getClassStudentCount(classId);
        const attemptedStudents = submissions.length;
        const completedSubmissions = submissions.filter(s => s.status === 'submitted');
        const completedStudents = completedSubmissions.length;
        
        // Calculate scores
        const scores = completedSubmissions
          .filter(s => s.totalScore !== undefined)
          .map(s => s.totalScore!);
        
        const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
        const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
        
        // Calculate pass rate (assuming 50% is passing)
        const passingScore = testData.config.passingScore || (testData.totalMarks * 0.5);
        const passedStudents = scores.filter(score => score >= passingScore).length;
        const passRate = scores.length > 0 ? (passedStudents / scores.length) * 100 : 0;
        
        // Calculate time statistics
        const timeSpentData = completedSubmissions.map(s => s.totalTimeSpent / 60); // Convert to minutes
        const averageTimeSpent = timeSpentData.length > 0 ? 
          timeSpentData.reduce((a, b) => a + b, 0) / timeSpentData.length : 0;
        
        // Calculate submission statistics
        const lateSubmissions = submissions.filter(s => s.lateSubmission?.isLateSubmission).length;
        const onTimeSubmissions = submissions.length - lateSubmissions;
        
        // Question analysis
        const questionAnalysis = await this.analyzeTestQuestions(testDoc.id, submissions);
        
        testSummaries.push({
          id: testDoc.id,
          title: testData.title,
          testNumber: testData.testNumber,
          displayNumber: testData.displayNumber,
          type: testData.type,
          status: testData.status,
          totalMarks: testData.totalMarks,
          createdAt: testData.createdAt.toDate(),
          totalStudents,
          attemptedStudents,
          completedStudents,
          averageScore,
          highestScore,
          lowestScore,
          passRate,
          averageTimeSpent,
          onTimeSubmissions,
          lateSubmissions,
          questionAnalysis
        });
      }
      
      // Sort by creation date (newest first) since we couldn't do it in the query
      testSummaries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      console.log(`✅ [GRADE ANALYTICS] Returning ${testSummaries.length} test summaries for class ${classId}`);
      return testSummaries;
    } catch (error) {
      console.error('Error getting class test analytics:', error);
      throw error;
    }
  }

  /**
   * Get student performance analytics for a specific class
   */
  static async getClassStudentAnalytics(classId: string): Promise<StudentPerformanceSummary[]> {
    try {
      // Get enrolled students in this class
      const enrollmentsQuery = query(
        collection(firestore, this.COLLECTIONS.ENROLLMENTS),
        where('classId', '==', classId),
        where('status', '==', 'Active')
      );
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      
      const studentSummaries: StudentPerformanceSummary[] = [];
      
      for (const enrollmentDoc of enrollmentsSnapshot.docs) {
        const enrollment = enrollmentDoc.data();
        const studentId = enrollment.studentId;
        
        // Get student details
        const studentDoc = await getDoc(doc(firestore, this.COLLECTIONS.STUDENTS, studentId));
        if (!studentDoc.exists()) continue;
        
        const studentData = studentDoc.data();
        
        // Get all class-based tests assigned to this class
        const testsQuery = query(
          collection(firestore, this.COLLECTIONS.TESTS),
          where('classIds', 'array-contains', classId),
          where('isDeleted', '!=', true)
        );
        const testsSnapshot = await getDocs(testsQuery);
        
        // Filter to only class-based tests
        const classBasedTests = testsSnapshot.docs.filter(doc => {
          const testData = doc.data();
          return testData.assignmentType !== 'student-based' && 
                 testData.classIds && 
                 testData.classIds.length > 0;
        });
        
        const classBasedTestIds = classBasedTests.map(doc => doc.id);
        
        // Get student submissions only for class-based tests
        let submissions: StudentSubmission[] = [];
        if (classBasedTestIds.length > 0) {
          // Split into chunks if more than 10 tests (Firestore 'in' limit)
          const chunks = [];
          for (let i = 0; i < classBasedTestIds.length; i += 10) {
            chunks.push(classBasedTestIds.slice(i, i + 10));
          }
          
          for (const chunk of chunks) {
            const submissionsQuery = query(
              collection(firestore, this.COLLECTIONS.SUBMISSIONS),
              where('studentId', '==', studentId),
              where('classId', '==', classId),
              where('testId', 'in', chunk)
            );
            const submissionsSnapshot = await getDocs(submissionsQuery);
            submissions.push(...submissionsSnapshot.docs.map(doc => doc.data() as StudentSubmission));
          }
        }
        
        // Calculate statistics
        const totalTestsAssigned = classBasedTests.length;
        const totalTestsAttempted = submissions.length;
        const completedSubmissions = submissions.filter(s => s.status === 'submitted');
        const totalTestsCompleted = completedSubmissions.length;
        
        // Calculate pass/fail
        const passedTests = completedSubmissions.filter(s => s.passStatus === 'passed').length;
        const failedTests = completedSubmissions.filter(s => s.passStatus === 'failed').length;
        
        // Calculate scores
        const scores = completedSubmissions
          .filter(s => s.totalScore !== undefined)
          .map(s => s.totalScore!);
        
        const overallAverage = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
        const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
        
        // Calculate late submissions
        const lateSubmissions = submissions.filter(s => s.lateSubmission?.isLateSubmission).length;
        const onTimeSubmissions = submissions.length - lateSubmissions;
        const lateSubmissionRate = submissions.length > 0 ? (lateSubmissions / submissions.length) * 100 : 0;
        
        // Calculate time statistics
        const timeSpentData = completedSubmissions.map(s => s.totalTimeSpent / 60); // Convert to minutes
        const averageTimeSpent = timeSpentData.length > 0 ? 
          timeSpentData.reduce((a, b) => a + b, 0) / timeSpentData.length : 0;
        
        // Calculate improvement trend
        const improvementTrend = this.calculateImprovementTrend(completedSubmissions);
        
        // Calculate time efficiency (based on average time vs test duration)
        const timeEfficiencyScore = this.calculateTimeEfficiencyScore(completedSubmissions);
        
        // Get weak topics and lessons
        const weakTopics = await this.identifyWeakTopics(studentId, submissions);
        const weakLessons = await this.identifyWeakLessons(studentId, classId, submissions);
        
        // Calculate attendance rate
        const testAttendanceRate = totalTestsAssigned > 0 ? (totalTestsAttempted / totalTestsAssigned) * 100 : 0;
        
        // Get last activity
        const lastActivity = submissions.length > 0 ? 
          Math.max(...submissions.map(s => s.submittedAt.toMillis())) : undefined;
        const lastActivityDate = lastActivity ? new Date(lastActivity) : undefined;
        
        studentSummaries.push({
          id: studentId,
          name: studentData.name,
          email: studentData.email,
          totalTestsAssigned,
          totalTestsAttempted,
          totalTestsCompleted,
          totalTestsPassed: passedTests,
          totalTestsFailed: failedTests,
          onTimeSubmissions,
          lateSubmissions,
          lateSubmissionRate,
          overallAverage,
          highestScore,
          lowestScore,
          improvementTrend,
          averageTimeSpent,
          timeEfficiencyScore,
          weakTopics,
          weakLessons,
          testAttendanceRate,
          lastActivityDate
        });
      }
      
      return studentSummaries.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error getting class student analytics:', error);
      throw error;
    }
  }

  /**
   * Get detailed report for a specific student
   */
  static async getDetailedStudentReport(studentId: string, classId: string): Promise<DetailedStudentReport> {
    try {
      // Get basic student performance summary
      const studentSummaries = await this.getClassStudentAnalytics(classId);
      const basicSummary = studentSummaries.find(s => s.id === studentId);
      
      if (!basicSummary) {
        throw new Error('Student not found in class');
      }
      
      // Get recent test results
      const recentTests = await this.getStudentRecentTests(studentId, classId, 10);
      
      // Get performance trend data
      const performanceTrend = await this.getStudentPerformanceTrend(studentId, classId);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(basicSummary, recentTests);
      
      // Identify strengths
      const strengths = this.identifyStrengths(basicSummary, recentTests);
      
      // Identify areas for improvement
      const areasForImprovement = this.identifyAreasForImprovement(basicSummary);
      
      return {
        ...basicSummary,
        recentTests,
        performanceTrend,
        recommendations,
        strengths,
        areasForImprovement
      };
    } catch (error) {
      console.error('Error getting detailed student report:', error);
      throw error;
    }
  }

  // Helper methods
  private static async calculateClassAverageScore(classId: string): Promise<number> {
    try {
      // Get only submissions for class-based tests
      const testsQuery = query(
        collection(firestore, this.COLLECTIONS.TESTS),
        where('classIds', 'array-contains', classId),
        where('isDeleted', '!=', true)
      );
      const testsSnapshot = await getDocs(testsQuery);
      
      // Filter to only class-based tests
      const classBasedTestIds = testsSnapshot.docs
        .filter(doc => {
          const testData = doc.data();
          return testData.assignmentType !== 'student-based' && 
                 testData.classIds && 
                 testData.classIds.length > 0;
        })
        .map(doc => doc.id);
      
      if (classBasedTestIds.length === 0) return 0;
      
      // Get submissions only for class-based tests
      const submissionsQuery = query(
        collection(firestore, this.COLLECTIONS.SUBMISSIONS),
        where('classId', '==', classId),
        where('testId', 'in', classBasedTestIds.slice(0, 10)) // Firestore 'in' limit is 10
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);
      
      const scores = submissionsSnapshot.docs
        .map(doc => doc.data().totalScore)
        .filter(score => score !== undefined);
      
      return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    } catch (error) {
      console.error('Error calculating class average score:', error);
      return 0;
    }
  }

  private static async getLastClassActivity(classId: string): Promise<Date | undefined> {
    try {
      // Get only class-based tests for this class
      const testsQuery = query(
        collection(firestore, this.COLLECTIONS.TESTS),
        where('classIds', 'array-contains', classId),
        where('isDeleted', '!=', true)
      );
      const testsSnapshot = await getDocs(testsQuery);
      
      // Filter to only class-based tests
      const classBasedTestIds = testsSnapshot.docs
        .filter(doc => {
          const testData = doc.data();
          return testData.assignmentType !== 'student-based' && 
                 testData.classIds && 
                 testData.classIds.length > 0;
        })
        .map(doc => doc.id);
      
      if (classBasedTestIds.length === 0) return undefined;
      
      // Get latest submission from class-based tests only
      const submissionsQuery = query(
        collection(firestore, this.COLLECTIONS.SUBMISSIONS),
        where('classId', '==', classId),
        where('testId', 'in', classBasedTestIds.slice(0, 10)), // Firestore 'in' limit is 10
        orderBy('submittedAt', 'desc'),
        limit(1)
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);
      
      if (!submissionsSnapshot.empty) {
        return submissionsSnapshot.docs[0].data().submittedAt.toDate();
      }
      return undefined;
    } catch (error) {
      console.error('Error getting last class activity:', error);
      return undefined;
    }
  }

  private static async getClassStudentCount(classId: string): Promise<number> {
    try {
      const enrollmentsQuery = query(
        collection(firestore, this.COLLECTIONS.ENROLLMENTS),
        where('classId', '==', classId),
        where('status', '==', 'Active')
      );
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      return enrollmentsSnapshot.docs.length;
    } catch (error) {
      console.error('Error getting class student count:', error);
      return 0;
    }
  }

  private static async analyzeTestQuestions(testId: string, submissions: StudentSubmission[]): Promise<QuestionAnalysis[]> {
    try {
      // Get test details to get questions
      const testDoc = await getDoc(doc(firestore, this.COLLECTIONS.TESTS, testId));
      if (!testDoc.exists()) return [];
      
      const testData = testDoc.data() as Test;
      const questionAnalysis: QuestionAnalysis[] = [];
      
      for (const question of testData.questions) {
        // Calculate average score for this question
        const questionScores = submissions
          .map(submission => {
            if (question.questionType === 'mcq') {
              const mcqResult = submission.mcqResults?.find(r => r.questionId === question.id);
              return mcqResult ? mcqResult.marksAwarded : 0;
            } else {
              const essayResult = submission.essayResults?.find(r => r.questionId === question.id);
              return essayResult ? (essayResult.marksAwarded || 0) : 0;
            }
          })
          .filter(score => score !== undefined);
        
        const averageScore = questionScores.length > 0 ? 
          questionScores.reduce((a, b) => a + b, 0) / questionScores.length : 0;
        
        // Calculate correct answer rate for MCQ
        let correctAnswerRate: number | undefined;
        if (question.questionType === 'mcq') {
          const correctAnswers = submissions.filter(submission => {
            const mcqResult = submission.mcqResults?.find(r => r.questionId === question.id);
            return mcqResult?.isCorrect;
          }).length;
          correctAnswerRate = submissions.length > 0 ? (correctAnswers / submissions.length) * 100 : 0;
        }
        
        questionAnalysis.push({
          questionId: question.id,
          questionText: question.questionText,
          questionType: question.questionType,
          maxMarks: question.points,
          averageScore,
          difficultyLevel: question.difficultyLevel || 'medium',
          correctAnswerRate,
          topic: question.topic
        });
      }
      
      return questionAnalysis;
    } catch (error) {
      console.error('Error analyzing test questions:', error);
      return [];
    }
  }

  private static calculateImprovementTrend(submissions: StudentSubmission[]): 'improving' | 'declining' | 'stable' {
    if (submissions.length < 2) return 'stable';
    
    // Sort by submitted date
    const sortedSubmissions = submissions
      .filter(s => s.totalScore !== undefined)
      .sort((a, b) => a.submittedAt.toMillis() - b.submittedAt.toMillis());
    
    if (sortedSubmissions.length < 2) return 'stable';
    
    const firstHalf = sortedSubmissions.slice(0, Math.ceil(sortedSubmissions.length / 2));
    const secondHalf = sortedSubmissions.slice(Math.ceil(sortedSubmissions.length / 2));
    
    const firstHalfAvg = firstHalf.reduce((sum, s) => sum + s.totalScore!, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, s) => sum + s.totalScore!, 0) / secondHalf.length;
    
    const improvementThreshold = 5; // 5% improvement threshold
    
    if (secondHalfAvg > firstHalfAvg + improvementThreshold) return 'improving';
    if (secondHalfAvg < firstHalfAvg - improvementThreshold) return 'declining';
    return 'stable';
  }

  private static calculateTimeEfficiencyScore(submissions: StudentSubmission[]): number {
    // This is a simplified calculation - in reality, you'd compare against test duration
    // Score from 1-10 based on how efficiently student uses time
    if (submissions.length === 0) return 5;
    
    const avgTimeSpent = submissions.reduce((sum, s) => sum + s.totalTimeSpent, 0) / submissions.length;
    const avgTimeInMinutes = avgTimeSpent / 60;
    
    // Assuming 60 minutes average test duration
    // Score based on time efficiency (completing test in reasonable time)
    if (avgTimeInMinutes < 30) return 10; // Very efficient
    if (avgTimeInMinutes < 45) return 8;  // Efficient
    if (avgTimeInMinutes < 60) return 6;  // Average
    if (avgTimeInMinutes < 90) return 4;  // Slow
    return 2; // Very slow
  }

  private static async identifyWeakTopics(studentId: string, submissions: StudentSubmission[]): Promise<WeakTopic[]> {
    const topicStats: { [topic: string]: { total: number; correct: number; scores: number[] } } = {};
    
    for (const submission of submissions) {
      // Analyze MCQ results by topic
      if (submission.mcqResults) {
        for (const mcqResult of submission.mcqResults) {
          if (mcqResult.topic) {
            if (!topicStats[mcqResult.topic]) {
              topicStats[mcqResult.topic] = { total: 0, correct: 0, scores: [] };
            }
            topicStats[mcqResult.topic].total++;
            topicStats[mcqResult.topic].scores.push(mcqResult.marksAwarded);
            if (mcqResult.isCorrect) {
              topicStats[mcqResult.topic].correct++;
            }
          }
        }
      }
    }
    
    // Convert to WeakTopic array and filter weak areas (< 60% accuracy)
    const weakTopics: WeakTopic[] = [];
    for (const [topic, stats] of Object.entries(topicStats)) {
      const accuracy = (stats.correct / stats.total) * 100;
      const averageScore = stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length;
      
      if (accuracy < 60) { // Consider < 60% as weak
        weakTopics.push({
          topic,
          averageScore,
          totalQuestions: stats.total,
          correctAnswers: stats.correct,
          accuracy
        });
      }
    }
    
    return weakTopics.sort((a, b) => a.accuracy - b.accuracy); // Sort by weakest first
  }

  private static async identifyWeakLessons(studentId: string, classId: string, submissions: StudentSubmission[]): Promise<WeakLesson[]> {
    // This would require mapping questions to lessons, which is complex
    // For now, return empty array - this would need to be implemented based on your lesson-question mapping
    return [];
  }

  private static async getStudentRecentTests(studentId: string, classId: string, limitCount: number): Promise<RecentTestResult[]> {
    try {
      const submissionsQuery = query(
        collection(firestore, this.COLLECTIONS.SUBMISSIONS),
        where('studentId', '==', studentId),
        where('classId', '==', classId),
        orderBy('submittedAt', 'desc'),
        limit(limitCount)
      );
      
      const submissionsSnapshot = await getDocs(submissionsQuery);
      
      return submissionsSnapshot.docs.map(doc => {
        const submission = doc.data() as StudentSubmission;
        return {
          testId: submission.testId,
          testTitle: submission.testTitle,
          testDate: submission.submittedAt.toDate(),
          score: submission.totalScore || 0,
          maxScore: submission.maxScore,
          percentage: submission.percentage || 0,
          timeSpent: submission.totalTimeSpent / 60, // Convert to minutes
          isLateSubmission: submission.lateSubmission?.isLateSubmission || false,
          passStatus: submission.passStatus || 'pending_review'
        };
      });
    } catch (error) {
      console.error('Error getting student recent tests:', error);
      return [];
    }
  }

  private static async getStudentPerformanceTrend(studentId: string, classId: string): Promise<PerformanceDataPoint[]> {
    try {
      const submissionsQuery = query(
        collection(firestore, this.COLLECTIONS.SUBMISSIONS),
        where('studentId', '==', studentId),
        where('classId', '==', classId),
        orderBy('submittedAt', 'asc')
      );
      
      const submissionsSnapshot = await getDocs(submissionsQuery);
      
      return submissionsSnapshot.docs.map(doc => {
        const submission = doc.data() as StudentSubmission;
        return {
          date: submission.submittedAt.toDate(),
          score: submission.totalScore || 0,
          testTitle: submission.testTitle,
          subject: 'Unknown' // Would need to get from test data
        };
      });
    } catch (error) {
      console.error('Error getting student performance trend:', error);
      return [];
    }
  }

  private static generateRecommendations(
    summary: StudentPerformanceSummary, 
    recentTests: RecentTestResult[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Late submission recommendations
    if (summary.lateSubmissionRate > 20) {
      recommendations.push('Focus on time management and submitting tests on time');
    }
    
    // Performance recommendations
    if (summary.overallAverage < 60) {
      recommendations.push('Requires additional study support and practice');
    }
    
    // Improvement trend recommendations
    if (summary.improvementTrend === 'declining') {
      recommendations.push('Performance is declining - needs immediate attention');
    } else if (summary.improvementTrend === 'improving') {
      recommendations.push('Good improvement trend - continue current study approach');
    }
    
    // Weak topics recommendations
    if (summary.weakTopics.length > 0) {
      recommendations.push(`Focus on weak topics: ${summary.weakTopics.map(t => t.topic).join(', ')}`);
    }
    
    // Time efficiency recommendations
    if (summary.timeEfficiencyScore < 5) {
      recommendations.push('Work on completing tests more efficiently');
    }
    
    // Attendance recommendations
    if (summary.testAttendanceRate < 80) {
      recommendations.push('Improve test attendance - missing too many assessments');
    }
    
    return recommendations;
  }

  private static identifyStrengths(
    summary: StudentPerformanceSummary, 
    recentTests: RecentTestResult[]
  ): string[] {
    const strengths: string[] = [];
    
    if (summary.overallAverage > 80) {
      strengths.push('Consistently high academic performance');
    }
    
    if (summary.lateSubmissionRate < 10) {
      strengths.push('Excellent time management and punctuality');
    }
    
    if (summary.improvementTrend === 'improving') {
      strengths.push('Shows continuous improvement over time');
    }
    
    if (summary.timeEfficiencyScore > 7) {
      strengths.push('Efficient test-taking skills');
    }
    
    if (summary.testAttendanceRate > 90) {
      strengths.push('Excellent test attendance');
    }
    
    return strengths;
  }

  private static identifyAreasForImprovement(summary: StudentPerformanceSummary): string[] {
    const areas: string[] = [];
    
    if (summary.weakTopics.length > 0) {
      areas.push(...summary.weakTopics.map(topic => `${topic.topic} (${topic.accuracy.toFixed(1)}% accuracy)`));
    }
    
    if (summary.lateSubmissionRate > 15) {
      areas.push('Time management and submission deadlines');
    }
    
    if (summary.timeEfficiencyScore < 6) {
      areas.push('Test completion efficiency');
    }
    
    return areas;
  }
}