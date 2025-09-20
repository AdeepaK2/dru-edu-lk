import { firestore } from '@/utils/firebase-client';
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import { TestService } from './testService';
import { ClassFirestoreService } from './classFirestoreService';
import { StudentFirestoreService } from './studentFirestoreService';
import { StudentSubmission } from '@/models/studentSubmissionSchema';
import { Test } from '@/models/testSchema';
import { StudentEnrollment } from '@/models/studentEnrollmentSchema';
import { Question } from '@/models/questionBankSchema';

// Analytics interfaces
export interface StudentPerformanceData {
  studentId: string;
  studentName: string;
  studentEmail: string;
  overallAverage: number;
  totalTests: number;
  passedTests: number;
  weakTopics: Array<{
    topic: string;
    averageScore: number;
    totalQuestions: number;
    correctAnswers: number;
  }>;
  strongTopics: Array<{
    topic: string;
    averageScore: number;
    totalQuestions: number;
    correctAnswers: number;
  }>;
  recentTestScores: Array<{
    testId: string;
    testTitle: string;
    score: number;
    completedAt: Timestamp;
  }>;
  improvementTrend: 'improving' | 'declining' | 'stable';
  lastActiveDate: Timestamp | null;
}

export interface ClassAnalytics {
  classId: string;
  className: string;
  totalStudents: number;
  averagePerformance: number;
  testsCompleted: number;
  passRate: number;
  topPerformers: Array<{
    studentId: string;
    studentName: string;
    averageScore: number;
  }>;
  strugglingStudents: Array<{
    studentId: string;
    studentName: string;
    averageScore: number;
    weakTopics: Array<{
      topic: string;
      averageScore: number;
      totalQuestions: number;
      correctAnswers: number;
    }>;
  }>;
  subjectPerformance: Array<{
    subject: string;
    averageScore: number;
    totalTests: number;
    passRate: number;
  }>;
  recentTests: Array<{
    testId: string;
    testTitle: string;
    averageScore: number;
    completionRate: number;
    createdAt: Date;
  }>;
}

export interface TopicAnalysis {
  topic: string;
  averageScore: number;
  totalQuestions: number;
  studentsStruggling: number;
  recommendedLessons: string[];
}

export interface PerformanceTrend {
  date: Date;
  averageScore: number;
  testsCompleted: number;
  studentsActive: number;
}

export class GradeAnalyticsService {
  private static readonly COLLECTIONS = {
    SUBMISSIONS: 'studentSubmissions',
    TESTS: 'tests',
    ENROLLMENTS: 'studentEnrollments',
    QUESTIONS: 'questions',
    LESSONS: 'lessons'
  };

  /**
   * Helper function to recalculate pass status based on teacher's configured passing score
   * This matches the logic used in the test result page
   */
  private static getActualPassStatus(submission: StudentSubmission, test?: Test): string {
    // If teacher has configured a passing score, use it
    if (test?.config?.passingScore && submission.percentage !== undefined) {
      return submission.percentage >= test.config.passingScore ? 'passed' : 'failed';
    }
    
    // For essay tests that haven't been manually graded, show pending
    const isEssayTest = test?.questions?.some(q => q.type === 'essay' || q.questionType === 'essay');
    if (isEssayTest && submission.manualGradingPending) {
      return 'pending_review';
    }
    
    // Fallback to stored passStatus
    return submission.passStatus || 'pending_review';
  }

  /**
   * Get comprehensive analytics for a specific class
   */
  static async getClassAnalytics(classId: string): Promise<ClassAnalytics> {
    try {
      console.log('🔍 Getting analytics for class:', classId);

      // Get class information
      const classDoc = await ClassFirestoreService.getClassById(classId);
      if (!classDoc) {
        console.error('❌ Class not found:', classId);
        throw new Error(`Class with ID ${classId} not found`);
      }

      const className = classDoc.name;
      console.log('📚 Found class:', className);

      // Get all enrollments for the class
      const enrollmentsQuery = query(
        collection(firestore, this.COLLECTIONS.ENROLLMENTS),
        where('classId', '==', classId),
        where('status', '==', 'Active')
      );
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      const enrollments = enrollmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StudentEnrollment[];

      console.log('👥 Active enrollments found:', enrollments.length);

      if (enrollments.length === 0) {
        console.warn('⚠️ No active enrollments found for class:', classId);
        return this.getEmptyClassAnalytics(classId, className);
      }

      const studentIds = enrollments.map(e => e.studentId);

      // Get all tests for this class
      const tests = await this.getTestsForClass(classId);
      const testIds = tests.map(t => t.id);

      console.log('📊 Tests found for class:', {
        totalTests: tests.length,
        testIds: testIds
      });

      // Get all submissions for students in this class
      const submissions = await this.getSubmissionsForClass(classId, studentIds, testIds);

      console.log('📊 Submissions found:', {
        totalSubmissions: submissions.length,
        submissionsWithAnswers: submissions.filter(s => s.finalAnswers && s.finalAnswers.length > 0).length
      });

      // Calculate analytics
      const totalStudents = enrollments.length;
      const testsCompleted = submissions.length;
      
      // Calculate average performance
      const completedSubmissions = submissions.filter(s => 
        s.status === 'submitted' || s.status === 'auto_submitted'
      );
      const averagePerformance = completedSubmissions.length > 0
        ? completedSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / completedSubmissions.length
        : 0;

      // Calculate pass rate using proper logic that considers teacher's passing score
      let passedSubmissions = 0;
      for (const submission of completedSubmissions) {
        try {
          // Get test data to check teacher's passing score configuration
          const testDoc = await getDoc(doc(firestore, 'tests', submission.testId));
          const testData = testDoc.exists() ? { id: testDoc.id, ...testDoc.data() } as Test : undefined;
          
          const actualPassStatus = this.getActualPassStatus(submission, testData);
          if (actualPassStatus === 'passed') {
            passedSubmissions++;
          }
        } catch (error) {
          console.warn(`Could not get test data for ${submission.testId}, using stored passStatus:`, error);
          // Fallback to stored passStatus if we can't get test data
          if (submission.passStatus === 'passed') {
            passedSubmissions++;
          }
        }
      }
      
      const passRate = completedSubmissions.length > 0
        ? (passedSubmissions / completedSubmissions.length) * 100
        : 0;

      // Get student performances
      const studentPerformances = await this.calculateStudentPerformances(enrollments);
      
      const topPerformers = studentPerformances
        .sort((a, b) => b.overallAverage - a.overallAverage)
        .slice(0, 5)
        .map(sp => ({
          studentId: sp.studentId,
          studentName: sp.studentName,
          averageScore: sp.overallAverage
        }));

      const strugglingStudents = studentPerformances
        .filter(sp => sp.overallAverage < 60)
        .sort((a, b) => a.overallAverage - b.overallAverage)
        .slice(0, 5)
        .map(sp => ({
          studentId: sp.studentId,
          studentName: sp.studentName,
          averageScore: sp.overallAverage,
          weakTopics: sp.weakTopics
        }));

      // Calculate subject performance
      const subjectPerformance = await this.calculateSubjectPerformance(tests, submissions);

      // Get recent tests
      const recentTests = tests
        .sort((a, b) => new Date(b.createdAt.toDate()).getTime() - new Date(a.createdAt.toDate()).getTime())
        .slice(0, 5)
        .map(test => {
          const testSubmissions = submissions.filter(s => s.testId === test.id);
          const completedTestSubmissions = testSubmissions.filter(s => 
            s.status === 'submitted' || s.status === 'auto_submitted'
          );
          
          console.log(`📊 Test "${test.title}" analysis:`, {
            testId: test.id,
            totalSubmissions: testSubmissions.length,
            completedSubmissions: completedTestSubmissions.length,
            totalStudents,
            percentages: completedTestSubmissions.map(s => s.percentage)
          });
          
          const averageScore = completedTestSubmissions.length > 0
            ? completedTestSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / completedTestSubmissions.length
            : 0;
            
          const completionRate = totalStudents > 0
            ? (completedTestSubmissions.length / totalStudents) * 100
            : 0;
          
          return {
            testId: test.id,
            testTitle: test.title,
            averageScore,
            completionRate,
            createdAt: test.createdAt.toDate()
          };
        });

      return {
        classId,
        className,
        totalStudents,
        averagePerformance,
        testsCompleted,
        passRate,
        topPerformers,
        strugglingStudents,
        subjectPerformance,
        recentTests
      };

    } catch (error) {
      console.error('Error getting class analytics:', error);
      throw new Error('Failed to load class analytics');
    }
  }

  /**
   * Get detailed performance data for a specific student
   */
  static async getStudentPerformanceData(studentId: string, classId?: string): Promise<StudentPerformanceData> {
    try {
      console.log('🔍 Getting performance data for student:', { studentId, classId });

      // Get student info
      const studentInfo = await StudentFirestoreService.getStudentById(studentId);
      if (!studentInfo) {
        console.warn('⚠️ Student not found:', studentId);
        throw new Error(`Student with ID ${studentId} not found`);
      }

      console.log('👤 Student info found:', {
        id: studentInfo.id,
        name: studentInfo.name,
        email: studentInfo.email
      });

      // Get submissions for this student using multiple approaches
      let submissions: StudentSubmission[] = [];
      
      // Approach 1: Get all submissions for this student
      const allSubmissionsQuery = query(
        collection(firestore, this.COLLECTIONS.SUBMISSIONS),
        where('studentId', '==', studentId)
      );
      const allSubmissionsSnapshot = await getDocs(allSubmissionsQuery);
      submissions = allSubmissionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StudentSubmission[];

      console.log('📊 All submissions for student:', {
        studentId,
        totalSubmissions: submissions.length,
        submissionDetails: submissions.map(s => ({
          id: s.id,
          testId: s.testId,
          testTitle: s.testTitle,
          classId: s.classId,
          status: s.status,
          percentage: s.percentage,
          hasAnswers: !!(s.finalAnswers && s.finalAnswers.length > 0)
        }))
      });

      // Filter by class if provided
      if (classId) {
        console.log('🔍 Filtering submissions by classId:', classId);
        
        // First try exact classId match
        let classFilteredSubmissions = submissions.filter(s => s.classId === classId);
        
        // If no matches and classId is empty in submissions, try by test relationship
        if (classFilteredSubmissions.length === 0) {
          console.log('⚠️ No submissions with matching classId, checking by test relationship...');
          
          // Get tests for this class
          const classTests = await this.getTestsForClass(classId);
          const classTestIds = classTests.map(t => t.id);
          
          console.log('📚 Tests for class:', {
            classId,
            testIds: classTestIds,
            testTitles: classTests.map(t => t.title)
          });
          
          // Filter submissions by test IDs that belong to this class
          classFilteredSubmissions = submissions.filter(s => classTestIds.includes(s.testId));
          
          console.log('📊 Submissions filtered by test relationship:', {
            found: classFilteredSubmissions.length,
            submissions: classFilteredSubmissions.map(s => ({
              id: s.id,
              testId: s.testId,
              testTitle: s.testTitle,
              percentage: s.percentage
            }))
          });
        }
        
        submissions = classFilteredSubmissions;
      }

      // Sort in memory by submission date (most recent first)
      submissions.sort((a, b) => {
        const dateA = a.submittedAt?.toMillis?.() || 0;
        const dateB = b.submittedAt?.toMillis?.() || 0;
        return dateB - dateA;
      });

      console.log('📊 Final submissions for student performance:', {
        studentId,
        classId,
        totalSubmissions: submissions.length,
        completedSubmissions: submissions.filter(s => s.status === 'submitted' || s.status === 'auto_submitted').length,
        withAnswers: submissions.filter(s => s.finalAnswers && s.finalAnswers.length > 0).length,
        percentages: submissions.map(s => s.percentage)
      });

      // Calculate performance metrics
      const completedSubmissions = submissions.filter(s => 
        s.status === 'submitted' || s.status === 'auto_submitted'
      );

      const overallAverage = completedSubmissions.length > 0
        ? completedSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / completedSubmissions.length
        : 0;

      const totalTests = submissions.length;
      
      // Calculate passed tests using proper logic that considers teacher's passing score
      let passedTests = 0;
      for (const submission of completedSubmissions) {
        try {
          // Get test data to check teacher's passing score configuration
          const testDoc = await getDoc(doc(firestore, 'tests', submission.testId));
          const testData = testDoc.exists() ? { id: testDoc.id, ...testDoc.data() } as Test : undefined;
          
          const actualPassStatus = this.getActualPassStatus(submission, testData);
          if (actualPassStatus === 'passed') {
            passedTests++;
          }
        } catch (error) {
          console.warn(`Could not get test data for ${submission.testId}, using stored passStatus:`, error);
          // Fallback to stored passStatus if we can't get test data
          if (submission.passStatus === 'passed') {
            passedTests++;
          }
        }
      }

      console.log('📊 Performance calculation:', {
        studentId,
        completedSubmissions: completedSubmissions.length,
        totalTests,
        passedTests,
        overallAverage,
        individualPercentages: completedSubmissions.map(s => s.percentage)
      });

      // Analyze topics
      const { weakTopics, strongTopics } = await this.analyzeStudentTopics(submissions);

      // Get recent test scores
      const recentTestScores = completedSubmissions
        .slice(0, 5)
        .map(s => ({
          testId: s.testId,
          testTitle: s.testTitle || 'Unknown Test',
          score: s.percentage || 0,
          completedAt: s.submittedAt
        }));

      // Calculate improvement trend
      const improvementTrend = this.calculateImprovementTrend(completedSubmissions);

      const result: StudentPerformanceData = {
        studentId,
        studentName: studentInfo.name,
        studentEmail: studentInfo.email,
        overallAverage,
        totalTests,
        passedTests,
        weakTopics: weakTopics,
        strongTopics: strongTopics,
        recentTestScores,
        improvementTrend,
        lastActiveDate: completedSubmissions.length > 0 
          ? completedSubmissions[0].submittedAt
          : null
      };

      console.log('✅ Final student performance result:', {
        studentId: result.studentId,
        studentName: result.studentName,
        overallAverage: result.overallAverage,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        recentScores: result.recentTestScores.length
      });

      return result;

    } catch (error) {
      console.error('Error getting student performance data:', error);
      throw new Error('Failed to load student performance data');
    }
  }

  /**
   * Get topic analysis for a class
   */
  static async getTopicAnalysis(classId: string): Promise<TopicAnalysis[]> {
    try {
      console.log('🔍 Analyzing topics for class:', classId);

      // Get enrollments
      const enrollmentsQuery = query(
        collection(firestore, this.COLLECTIONS.ENROLLMENTS),
        where('classId', '==', classId),
        where('status', '==', 'Active')
      );
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      const studentIds = enrollmentsSnapshot.docs.map(doc => doc.data().studentId);

      // Get submissions
      const submissions = await this.getSubmissionsForClass(classId, studentIds);

      // Analyze topics from submissions
      const topicData: Record<string, { correct: number, total: number, studentIds: Set<string> }> = {};

      for (const submission of submissions) {
        if (!submission.finalAnswers) continue;

        for (const answer of submission.finalAnswers) {
          try {
            const questionDoc = await getDoc(doc(firestore, this.COLLECTIONS.QUESTIONS, answer.questionId));
            if (!questionDoc.exists()) continue;

            const question = questionDoc.data() as Question;
            const topic = question.topic || 'General';

            if (!topicData[topic]) {
              topicData[topic] = { correct: 0, total: 0, studentIds: new Set() };
            }

            topicData[topic].total++;
            topicData[topic].studentIds.add(submission.studentId);
            
            if (answer.isCorrect || (answer.marksAwarded && answer.marksAwarded > 0)) {
              topicData[topic].correct++;
            }
          } catch (error) {
            console.warn('Could not analyze topic for question:', answer.questionId, error);
          }
        }
      }

      // Convert to TopicAnalysis array
      const topics = Object.entries(topicData).map(([topic, data]) => ({
        topic,
        averageScore: data.total > 0 ? (data.correct / data.total) * 100 : 0,
        totalQuestions: data.total,
        studentsStruggling: Array.from(data.studentIds).length,
        recommendedLessons: [] // Will be populated by recommendation engine
      }));

      // Sort by performance (worst first)
      topics.sort((a, b) => a.averageScore - b.averageScore);

      return topics;
    } catch (error) {
      console.error('Error getting topic analysis:', error);
      throw new Error('Failed to load topic analysis');
    }
  }

  /**
   * Get performance trends over time
   */
  static async getPerformanceTrends(classId: string, period: 'week' | 'month' | 'quarter'): Promise<PerformanceTrend[]> {
    try {
      // Get submissions for the class
      const enrollmentsQuery = query(
        collection(firestore, this.COLLECTIONS.ENROLLMENTS),
        where('classId', '==', classId),
        where('status', '==', 'Active')
      );
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      const studentIds = enrollmentsSnapshot.docs.map(doc => doc.data().studentId);

      const submissions = await this.getSubmissionsForClass(classId, studentIds);

      // Group submissions by time period
      const trends: Record<string, { scores: number[], testsCompleted: number, studentsActive: Set<string> }> = {};

      for (const submission of submissions) {
        if (submission.status !== 'submitted' && submission.status !== 'auto_submitted') continue;

        const date = submission.submittedAt.toDate();
        const periodKey = this.getPeriodKey(date, period);

        if (!trends[periodKey]) {
          trends[periodKey] = { scores: [], testsCompleted: 0, studentsActive: new Set() };
        }

        trends[periodKey].scores.push(submission.percentage || 0);
        trends[periodKey].testsCompleted++;
        trends[periodKey].studentsActive.add(submission.studentId);
      }

      // Convert to PerformanceTrend array
      const trendArray = Object.entries(trends).map(([dateKey, data]) => ({
        date: new Date(dateKey),
        averageScore: data.scores.length > 0 
          ? data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length 
          : 0,
        testsCompleted: data.testsCompleted,
        studentsActive: data.studentsActive.size
      }));

      // Sort by date
      trendArray.sort((a, b) => a.date.getTime() - b.date.getTime());

      return trendArray;
    } catch (error) {
      console.error('Error getting performance trends:', error);
      throw new Error('Failed to load performance trends');
    }
  }

  // Private helper methods

  private static async getTestsForClass(classId: string): Promise<Test[]> {
    try {
      console.log('🔍 Searching for tests in class:', classId);
      
      // Get all tests for the class (including draft status since students can take draft tests)
      const testsQuery = query(
        collection(firestore, this.COLLECTIONS.TESTS),
        where('classIds', 'array-contains', classId)
      );
      const snapshot = await getDocs(testsQuery);
      
      const tests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Test[];
      
      console.log('📚 Tests found for class:', {
        classId,
        totalTests: tests.length,
        testDetails: tests.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          type: t.type,
          classIds: t.classIds
        }))
      });
      
      return tests;
    } catch (error) {
      console.error('Error getting tests for class:', error);
      return [];
    }
  }

  private static async getSubmissionsForClass(classId: string, studentIds: string[], testIds?: string[]): Promise<StudentSubmission[]> {
    try {
      console.log('🔍 Getting submissions for class:', { classId, studentIds: studentIds.length, testIds: testIds?.length });
      
      let submissions: StudentSubmission[] = [];
      
      // Try multiple approaches to get submissions
      
      // Approach 1: Query by classId directly
      if (classId) {
        const submissionsQuery = query(
          collection(firestore, this.COLLECTIONS.SUBMISSIONS),
          where('classId', '==', classId)
        );
        const snapshot = await getDocs(submissionsQuery);
        submissions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StudentSubmission[];
        
        console.log('📊 Submissions found by classId:', submissions.length);
      }
      
      // Approach 2: If no submissions by classId, try by studentIds
      if (submissions.length === 0 && studentIds.length > 0) {
        console.log('🔍 No submissions found by classId, trying by studentIds...');
        
        // Query by each student ID individually (since Firestore has limitations on 'in' queries)
        const submissionPromises = studentIds.map(async (studentId) => {
          const studentQuery = query(
            collection(firestore, this.COLLECTIONS.SUBMISSIONS),
            where('studentId', '==', studentId)
          );
          const snapshot = await getDocs(studentQuery);
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as StudentSubmission[];
        });
        
        const submissionArrays = await Promise.all(submissionPromises);
        submissions = submissionArrays.flat();
        
        console.log('📊 Submissions found by studentIds:', submissions.length);
      }
      
      // Approach 3: If we have testIds, filter by them
      if (testIds && testIds.length > 0) {
        console.log('🔍 Filtering submissions by testIds:', testIds);
        submissions = submissions.filter(s => testIds.includes(s.testId));
        console.log('📊 Submissions after testId filter:', submissions.length);
      }
      
      // Filter by studentIds if we got submissions from other methods
      if (studentIds.length > 0) {
        submissions = submissions.filter(s => studentIds.includes(s.studentId));
        console.log('📊 Submissions after studentId filter:', submissions.length);
      }

      console.log('📊 Final submissions retrieved:', {
        classId,
        total: submissions.length,
        withAnswers: submissions.filter(s => s.finalAnswers && s.finalAnswers.length > 0).length,
        sampleSubmissions: submissions.slice(0, 2).map(s => ({
          id: s.id,
          testId: s.testId,
          testTitle: s.testTitle,
          studentId: s.studentId,
          studentName: s.studentName,
          classId: s.classId,
          status: s.status,
          percentage: s.percentage,
          hasAnswers: !!(s.finalAnswers && s.finalAnswers.length > 0)
        }))
      });

      return submissions;
    } catch (error) {
      console.error('Error getting submissions for class:', error);
      return [];
    }
  }

  private static async calculateStudentPerformances(enrollments: StudentEnrollment[]): Promise<StudentPerformanceData[]> {
    const performances: StudentPerformanceData[] = [];

    for (const enrollment of enrollments) {
      try {
        const performance = await this.getStudentPerformanceData(enrollment.studentId, enrollment.classId);
        performances.push(performance);
      } catch (error) {
        console.warn(`Could not get performance for student ${enrollment.studentId}:`, error);
        // Create empty performance data for this student
        performances.push({
          studentId: enrollment.studentId,
          studentName: enrollment.studentName,
          studentEmail: enrollment.studentEmail,
          overallAverage: 0,
          totalTests: 0,
          passedTests: 0,
          weakTopics: [],
          strongTopics: [],
          recentTestScores: [],
          improvementTrend: 'stable',
          lastActiveDate: null
        });
      }
    }

    return performances;
  }

  private static async calculateSubjectPerformance(tests: Test[], submissions: StudentSubmission[]) {
    const subjectGroups: Record<string, { tests: Test[], submissions: StudentSubmission[] }> = {};

    // Group by subject
    for (const test of tests) {
      const subject = test.subjectName || 'General';
      if (!subjectGroups[subject]) {
        subjectGroups[subject] = { tests: [], submissions: [] };
      }
      subjectGroups[subject].tests.push(test);
    }

    for (const submission of submissions) {
      const test = tests.find(t => t.id === submission.testId);
      if (test) {
        const subject = test.subjectName || 'General';
        if (subjectGroups[subject]) {
          subjectGroups[subject].submissions.push(submission);
        }
      }
    }

    // Calculate performance for each subject
    return Object.entries(subjectGroups).map(([subject, data]) => {
      const completedSubmissions = data.submissions.filter(s => 
        s.status === 'submitted' || s.status === 'auto_submitted'
      );

      const averageScore = completedSubmissions.length > 0
        ? completedSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / completedSubmissions.length
        : 0;

      // Calculate passed submissions using proper logic that considers teacher's passing score
      let passedSubmissionsCount = 0;
      for (const submission of completedSubmissions) {
        const test = data.tests.find(t => t.id === submission.testId);
        const actualPassStatus = this.getActualPassStatus(submission, test);
        if (actualPassStatus === 'passed') {
          passedSubmissionsCount++;
        }
      }
      
      const passRate = completedSubmissions.length > 0
        ? (passedSubmissionsCount / completedSubmissions.length) * 100
        : 0;

      return {
        subject,
        averageScore,
        totalTests: data.tests.length,
        passRate
      };
    });
  }

  private static async analyzeStudentTopics(submissions: StudentSubmission[]) {
    const topicData: Record<string, { correct: number, total: number }> = {};

    for (const submission of submissions) {
      if (!submission.finalAnswers) continue;

      for (const answer of submission.finalAnswers) {
        try {
          const questionDoc = await getDoc(doc(firestore, this.COLLECTIONS.QUESTIONS, answer.questionId));
          if (!questionDoc.exists()) continue;

          const question = questionDoc.data() as Question;
          const topic = question.topic || 'General';

          if (!topicData[topic]) {
            topicData[topic] = { correct: 0, total: 0 };
          }

          topicData[topic].total++;
          if (answer.isCorrect || (answer.marksAwarded && answer.marksAwarded > 0)) {
            topicData[topic].correct++;
          }
        } catch (error) {
          console.warn('Could not analyze topic for question:', answer.questionId, error);
        }
      }
    }

    const topics = Object.entries(topicData).map(([topic, data]) => ({
      topic,
      averageScore: data.total > 0 ? (data.correct / data.total) * 100 : 0,
      totalQuestions: data.total,
      correctAnswers: data.correct
    }));

    topics.sort((a, b) => a.averageScore - b.averageScore);

    const weakTopics = topics.filter(t => t.averageScore < 60).slice(0, 5);
    const strongTopics = topics.filter(t => t.averageScore >= 80).slice(0, 3);

    return { weakTopics, strongTopics };
  }

  private static calculateImprovementTrend(submissions: StudentSubmission[]): 'improving' | 'declining' | 'stable' {
    if (submissions.length < 2) return 'stable';

    const recentScores = submissions.slice(0, 3).map(s => s.percentage || 0);
    const olderScores = submissions.slice(-3).map(s => s.percentage || 0);

    const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    const olderAvg = olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length;

    const difference = recentAvg - olderAvg;

    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  }

  private static getPeriodKey(date: Date, period: 'week' | 'month' | 'quarter'): string {
    const year = date.getFullYear();
    const month = date.getMonth();

    switch (period) {
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'month':
        return `${year}-${String(month + 1).padStart(2, '0')}`;
      case 'quarter':
        const quarter = Math.floor(month / 3) + 1;
        return `${year}-Q${quarter}`;
      default:
        return `${year}-${String(month + 1).padStart(2, '0')}`;
    }
  }

  private static getEmptyClassAnalytics(classId: string, className: string): ClassAnalytics {
    return {
      classId,
      className,
      totalStudents: 0,
      averagePerformance: 0,
      testsCompleted: 0,
      passRate: 0,
      topPerformers: [],
      strugglingStudents: [],
      subjectPerformance: [],
      recentTests: []
    };
  }
}
