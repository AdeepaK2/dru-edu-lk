import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, runTransaction } from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';
import { StudentSubmission } from '@/models/studentSubmissionSchema';

export interface TestStatistics {
  testId: string;
  totalSubmissions: number;
  submittedCount: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passRate: number;
  averageTime: number;
  lastUpdated: Date;
  
  // Score distribution for percentile calculation
  scoreDistribution: number[];
  
  // Additional analytics
  totalStudentsAttempted: number;
  completionRate: number;
}

export interface StudentRanking {
  testId: string;
  studentId: string;
  score: number;
  rank: number;
  percentile: number;
  totalParticipants: number;
}

export class TestStatisticsService {
  
  /**
   * Get or calculate test statistics
   */
  static async getTestStatistics(testId: string, forceRecalculate = false): Promise<TestStatistics | null> {
    try {
      // Check if we have cached statistics
      if (!forceRecalculate) {
        const cached = await this.getCachedStatistics(testId);
        if (cached && this.isStatisticsFresh(cached)) {
          console.log('📊 Using cached test statistics for:', testId);
          return cached;
        }
      }
      
      console.log('🔄 Recalculating test statistics for:', testId);
      
      // Calculate fresh statistics
      const stats = await this.calculateTestStatistics(testId);
      
      if (stats) {
        // Cache the results
        await this.cacheStatistics(stats);
      }
      
      return stats;
    } catch (error) {
      console.error('❌ Error getting test statistics:', error);
      return null;
    }
  }
  
  /**
   * Get student's ranking and percentile for a test
   */
  static async getStudentRanking(testId: string, studentId: string, studentScore: number): Promise<StudentRanking | null> {
    try {
      const stats = await this.getTestStatistics(testId);
      if (!stats || stats.scoreDistribution.length === 0) {
        return null;
      }
      
      // Calculate rank (how many students scored lower)
      const studentsWithLowerScores = stats.scoreDistribution.filter(score => score < studentScore).length;
      const studentsWithSameScore = stats.scoreDistribution.filter(score => score === studentScore).length;
      
      // Rank is position from top (1 is best)
      const rank = stats.submittedCount - studentsWithLowerScores - studentsWithSameScore + 1;
      
      // Calculate percentile (what percentage of students scored lower)
      const percentile = stats.submittedCount > 1 
        ? Math.round((studentsWithLowerScores / (stats.submittedCount - 1)) * 100)
        : 100;
      
      return {
        testId,
        studentId,
        score: studentScore,
        rank,
        percentile,
        totalParticipants: stats.submittedCount
      };
    } catch (error) {
      console.error('❌ Error getting student ranking:', error);
      return null;
    }
  }
  
  /**
   * Update statistics when a new submission is added
   */
  static async updateStatisticsForNewSubmission(testId: string): Promise<void> {
    try {
      console.log('🔄 Updating statistics for new submission:', testId);
      
      // Force recalculation
      await this.getTestStatistics(testId, true);
    } catch (error) {
      console.error('❌ Error updating statistics for new submission:', error);
    }
  }
  
  /**
   * Update statistics when a submission is graded/regraded
   */
  static async updateStatisticsForGradedSubmission(testId: string): Promise<void> {
    try {
      console.log('🔄 Updating statistics for graded submission:', testId);
      
      // Force recalculation
      await this.getTestStatistics(testId, true);
    } catch (error) {
      console.error('❌ Error updating statistics for graded submission:', error);
    }
  }
  
  /**
   * Get cached statistics from Firestore
   */
  private static async getCachedStatistics(testId: string): Promise<TestStatistics | null> {
    try {
      const statsDoc = await getDoc(doc(firestore, 'testStatistics', testId));
      
      if (!statsDoc.exists()) {
        return null;
      }
      
      const data = statsDoc.data();
      return {
        ...data,
        lastUpdated: data.lastUpdated.toDate()
      } as TestStatistics;
    } catch (error) {
      console.error('❌ Error getting cached statistics:', error);
      return null;
    }
  }
  
  /**
   * Cache statistics in Firestore
   */
  private static async cacheStatistics(stats: TestStatistics): Promise<void> {
    try {
      await setDoc(doc(firestore, 'testStatistics', stats.testId), {
        ...stats,
        lastUpdated: new Date()
      });
      
      console.log('✅ Cached test statistics for:', stats.testId);
    } catch (error) {
      console.error('❌ Error caching statistics:', error);
    }
  }
  
  /**
   * Check if cached statistics are still fresh (less than 1 hour old)
   */
  private static isStatisticsFresh(stats: TestStatistics): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return stats.lastUpdated > oneHourAgo;
  }
  
  /**
   * Calculate fresh statistics from all submissions
   */
  private static async calculateTestStatistics(testId: string): Promise<TestStatistics | null> {
    try {
      // Get all submissions for this test
      const submissionsQuery = query(
        collection(firestore, 'studentSubmissions'),
        where('testId', '==', testId)
      );
      
      const submissionsSnapshot = await getDocs(submissionsQuery);
      const allSubmissions: StudentSubmission[] = submissionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Ensure timestamp fields are properly converted
          startTime: data.startTime,
          endTime: data.endTime,
          submittedAt: data.submittedAt,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        } as StudentSubmission;
      });
      
      if (allSubmissions.length === 0) {
        return {
          testId,
          totalSubmissions: 0,
          submittedCount: 0,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          passRate: 0,
          averageTime: 0,
          lastUpdated: new Date(),
          scoreDistribution: [],
          totalStudentsAttempted: 0,
          completionRate: 0
        };
      }
      
      // Filter for completed submissions
      const completedSubmissions = allSubmissions.filter(sub => 
        sub.status === 'submitted' || sub.status === 'auto_submitted'
      );
      
      if (completedSubmissions.length === 0) {
        return {
          testId,
          totalSubmissions: allSubmissions.length,
          submittedCount: 0,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          passRate: 0,
          averageTime: 0,
          lastUpdated: new Date(),
          scoreDistribution: [],
          totalStudentsAttempted: allSubmissions.length,
          completionRate: 0
        };
      }
      
      // Extract scores and times
      const scores = completedSubmissions.map(sub => sub.percentage || 0);
      const times = completedSubmissions.map(sub => sub.totalTimeSpent || 0);
      
      // Calculate basic statistics
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const highestScore = Math.max(...scores);
      const lowestScore = Math.min(...scores);
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      
      // Calculate pass rate
      const passedSubmissions = completedSubmissions.filter(sub => {
        // This should match the logic in your test results calculation
        return sub.passStatus === 'passed' || (sub.percentage && sub.percentage >= 50); // default 50% pass
      });
      const passRate = (passedSubmissions.length / completedSubmissions.length) * 100;
      
      // Calculate completion rate
      const completionRate = (completedSubmissions.length / allSubmissions.length) * 100;
      
      // Get unique students who attempted
      const uniqueStudents = new Set(allSubmissions.map(sub => sub.studentId));
      
      return {
        testId,
        totalSubmissions: allSubmissions.length,
        submittedCount: completedSubmissions.length,
        averageScore,
        highestScore,
        lowestScore,
        passRate,
        averageTime,
        lastUpdated: new Date(),
        scoreDistribution: scores.sort((a, b) => b - a), // Descending order
        totalStudentsAttempted: uniqueStudents.size,
        completionRate
      };
      
    } catch (error) {
      console.error('❌ Error calculating test statistics:', error);
      return null;
    }
  }
  
  /**
   * Get statistics for multiple tests (for teacher dashboard)
   */
  static async getMultipleTestStatistics(testIds: string[]): Promise<Record<string, TestStatistics>> {
    try {
      const results: Record<string, TestStatistics> = {};
      
      // Get statistics for each test
      const promises = testIds.map(async (testId) => {
        const stats = await this.getTestStatistics(testId);
        if (stats) {
          results[testId] = stats;
        }
      });
      
      await Promise.all(promises);
      
      return results;
    } catch (error) {
      console.error('❌ Error getting multiple test statistics:', error);
      return {};
    }
  }
  
  /**
   * Clear cached statistics (for admin/debugging)
   */
  static async clearCachedStatistics(testId: string): Promise<void> {
    try {
      await setDoc(doc(firestore, 'testStatistics', testId), {
        testId,
        lastUpdated: new Date(0) // Force recalculation
      });
      
      console.log('🗑️ Cleared cached statistics for:', testId);
    } catch (error) {
      console.error('❌ Error clearing cached statistics:', error);
    }
  }
}