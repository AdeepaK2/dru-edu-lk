import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc,
  updateDoc,
  query, 
  where, 
  orderBy, 
  Timestamp,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';

// Interface for cached class analytics
export interface CachedClassAnalytics {
  classId: string;
  teacherId: string;
  
  // Class summary data
  classSummary: {
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
    lastActivityDate?: Date | null;
  };
  
  // Test analytics data
  testAnalytics: Array<{
    id: string;
    title: string;
    testNumber?: number;
    displayNumber?: string;
    type: 'live' | 'flexible' | 'in-class';
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
    passRate: number;
    
    // Submission statistics
    onTimeSubmissions: number;
    lateSubmissions: number;
    
    // Question analysis
    questionAnalysis: Array<{
      questionId: string;
      questionText: string;
      questionType: 'mcq' | 'essay';
      maxMarks: number;
      averageScore: number;
      difficultyLevel: 'easy' | 'medium' | 'hard';
      correctAnswerRate?: number;
      topic?: string;
    }>;
  }>;
  
  // Student performance data
  studentPerformance: Array<{
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
    lateSubmissionRate: number;
    
    // Performance metrics
    overallAverage: number;
    highestScore: number;
    lowestScore: number;
    improvementTrend: 'improving' | 'declining' | 'stable';
    
    // Time management
    averageTimeSpent: number;
    timeEfficiencyScore: number;
    
    // Weak areas (topics/subjects where student struggles)
    weakTopics: Array<{
      topic: string;
      averageScore: number;
      totalQuestions: number;
      correctAnswers: number;
      accuracy: number;
    }>;
    weakLessons: Array<{
      lessonId: string;
      lessonName: string;
      subjectId: string;
      subjectName: string;
      averageScore: number;
      totalAttempts: number;
      weaknessLevel: 'high' | 'medium' | 'low';
    }>;
    
    // Attendance and engagement
    testAttendanceRate: number;
    lastActivityDate?: Date | null;
  }>;
  
  // Metadata
  lastCalculated: Timestamp;
  calculatedBy: string; // teacherId who triggered the calculation
  version: number; // For handling concurrent updates
  isCalculating: boolean; // Flag to show if recalculation is in progress
}

export class ClassAnalyticsFirestoreService {
  private static readonly COLLECTION_NAME = 'classAnalytics';
  
  /**
   * Clean undefined values from an object recursively
   * Firestore doesn't allow undefined values
   */
  private static cleanUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (obj instanceof Date) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanUndefinedValues(item)).filter(item => item !== undefined);
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.cleanUndefinedValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }
  
  /**
   * Get cached analytics for a class, return data if found (regardless of age)
   */
  static async getCachedAnalytics(classId: string, teacherId: string): Promise<CachedClassAnalytics | null> {
    try {
      const docRef = doc(firestore, this.COLLECTION_NAME, `${classId}_${teacherId}`);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data() as CachedClassAnalytics;
      
      // Log cache age for monitoring
      const now = new Date();
      const lastCalculated = this.safeTimestampToDate(data.lastCalculated);
      const hoursDiff = (now.getTime() - lastCalculated.getTime()) / (1000 * 60 * 60);
      
      console.log(`Found cached analytics for class ${classId}, age: ${hoursDiff.toFixed(1)} hours`);
      
      return data; // Always return cached data if it exists
    } catch (error) {
      console.error('Error getting cached analytics:', error);
      
      // Log specific error types for debugging
      if (error instanceof Error) {
        if (error.message.includes('requires an index')) {
          console.warn('Index required for analytics query - consider creating composite indexes');
        } else if (error.message.includes('permission')) {
          console.warn('Permission denied accessing analytics cache');
        }
      }
      
      return null;
    }
  }
  
  /**
   * Safely convert Firestore timestamp to Date
   */
  private static safeTimestampToDate(timestamp: any): Date {
    try {
      if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
      }
      if (timestamp instanceof Date) {
        return timestamp;
      }
      if (typeof timestamp === 'string') {
        return new Date(timestamp);
      }
      if (typeof timestamp === 'number') {
        return new Date(timestamp);
      }
      return new Date(); // Default to current time
    } catch (error) {
      console.warn('Error converting timestamp, using current time:', error);
      return new Date();
    }
  }

  /**
   * Check if cached data is stale (older than specified minutes)
   */
  static isCacheStale(data: CachedClassAnalytics, staleAfterMinutes: number = 30): boolean {
    try {
      const now = new Date();
      const lastCalculated = this.safeTimestampToDate(data.lastCalculated);
      const minutesDiff = (now.getTime() - lastCalculated.getTime()) / (1000 * 60);
      return minutesDiff > staleAfterMinutes;
    } catch (error) {
      console.error('Error checking cache staleness:', error);
      return true; // Consider stale if we can't determine age
    }
  }

  /**
   * Save analytics data to cache - Updates existing document or creates if not exists
   */
  static async saveAnalytics(
    classId: string, 
    teacherId: string, 
    analyticsData: Omit<CachedClassAnalytics, 'lastCalculated' | 'calculatedBy' | 'version' | 'isCalculating'>
  ): Promise<void> {
    try {
      const docRef = doc(firestore, this.COLLECTION_NAME, `${classId}_${teacherId}`);
      
      // Check if document exists first
      const docSnap = await getDoc(docRef);
      
      const updateData = {
        ...analyticsData,
        lastCalculated: serverTimestamp() as Timestamp,
        calculatedBy: teacherId,
        version: Date.now(),
        isCalculating: false
      };
      
      // Clean undefined values before saving to Firestore
      const cleanedData = this.cleanUndefinedValues(updateData);
      
      if (docSnap.exists()) {
        // Document exists - update it
        await updateDoc(docRef, cleanedData);
        console.log(`✅ Updated existing analytics cache for class ${classId}`);
      } else {
        // Document doesn't exist - create it
        await setDoc(docRef, cleanedData);
        console.log(`🆕 Created new analytics cache for class ${classId}`);
      }
    } catch (error) {
      console.error('Error saving analytics cache:', error);
      throw error;
    }
  }
  
  /**
   * Mark analytics as currently being calculated - Updates existing document or creates if not exists
   */
  static async markAsCalculating(classId: string, teacherId: string): Promise<void> {
    try {
      const docRef = doc(firestore, this.COLLECTION_NAME, `${classId}_${teacherId}`);
      
      // Check if document exists first
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // Document exists - just update the calculating flag
        await updateDoc(docRef, {
          isCalculating: true,
          lastCalculated: serverTimestamp()
        });
        console.log(`📊 Marked existing analytics as calculating for class ${classId}`);
      } else {
        // Document doesn't exist - create initial structure
        const initialData = {
          classId,
          teacherId,
          isCalculating: true,
          lastCalculated: serverTimestamp(),
          calculatedBy: teacherId,
          version: Date.now(),
          classSummary: null,
          testAnalytics: [],
          studentPerformance: []
        };
        
        // Clean undefined values before saving
        const cleanedData = this.cleanUndefinedValues(initialData);
        await setDoc(docRef, cleanedData);
        console.log(`🆕 Created initial analytics document for class ${classId}`);
      }
    } catch (error) {
      console.error('Error marking analytics as calculating:', error);
      throw error;
    }
  }
  
  /**
   * Get all cached analytics for a teacher (for the main page)
   * Returns all cached data regardless of age
   */
  static async getTeacherCachedAnalytics(teacherId: string): Promise<CachedClassAnalytics[]> {
    try {
      console.log(`Getting all cached analytics for teacher: ${teacherId}`);
      // Remove orderBy to avoid composite index requirement
      const q = query(
        collection(firestore, this.COLLECTION_NAME),
        where('teacherId', '==', teacherId)
      );
      
      const snapshot = await getDocs(q);
      const cachedAnalytics: CachedClassAnalytics[] = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data() as CachedClassAnalytics;
        const now = new Date();
        const lastCalculated = this.safeTimestampToDate(data.lastCalculated);
        const hoursDiff = (now.getTime() - lastCalculated.getTime()) / (1000 * 60 * 60);
        
        console.log(`Found cached data for class ${data.classId}, age: ${hoursDiff.toFixed(1)} hours`);
        cachedAnalytics.push(data);
      });
      
      // Sort by lastCalculated in descending order (most recent first) in application code
      cachedAnalytics.sort((a, b) => {
        const timeA = this.safeTimestampToDate(a.lastCalculated).getTime();
        const timeB = this.safeTimestampToDate(b.lastCalculated).getTime();
        return timeB - timeA; // Descending order
      });
      
      console.log(`Retrieved ${cachedAnalytics.length} cached analytics for teacher`);
      return cachedAnalytics;
    } catch (error) {
      console.error('Error getting teacher cached analytics:', error);
      
      // If it's an index error, provide helpful guidance
      if (error instanceof Error && error.message.includes('requires an index')) {
        console.warn('Firestore index required for teacher analytics query. Returning empty array for now.');
        console.warn('Please create the required index using the Firebase Console link provided in the error.');
      }
      
      return [];
    }
  }
  
  /**
   * Delete cached analytics for a class
   */
  static async deleteCachedAnalytics(classId: string, teacherId: string): Promise<void> {
    try {
      const docRef = doc(firestore, this.COLLECTION_NAME, `${classId}_${teacherId}`);
      await updateDoc(docRef, {
        isDeleted: true,
        deletedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error deleting cached analytics:', error);
    }
  }
  
  /**
   * Check if analytics are currently being calculated
   */
  static async isCalculating(classId: string, teacherId: string): Promise<boolean> {
    try {
      const docRef = doc(firestore, this.COLLECTION_NAME, `${classId}_${teacherId}`);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return false;
      }
      
      const data = docSnap.data();
      return data.isCalculating === true;
    } catch (error) {
      console.error('Error checking if calculating:', error);
      return false;
    }
  }
  
  /**
   * Force refresh analytics (mark cache as stale)
   */
  static async forceRefresh(classId: string, teacherId: string): Promise<void> {
    try {
      const docRef = doc(firestore, this.COLLECTION_NAME, `${classId}_${teacherId}`);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        await updateDoc(docRef, {
          lastCalculated: Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 60 * 1000)), // 2 hours ago
          isCalculating: false
        });
        console.log(`🔄 Forced refresh for class ${classId} analytics`);
      } else {
        console.log(`⚠️ No existing analytics to refresh for class ${classId}`);
      }
    } catch (error) {
      console.error('Error forcing refresh:', error);
    }
  }

  /**
   * Get the consistent document ID for a class-teacher combination
   */
  static getDocumentId(classId: string, teacherId: string): string {
    return `${classId}_${teacherId}`;
  }

  /**
   * Get document statistics for monitoring
   */
  static async getDocumentStats(teacherId: string): Promise<{
    totalDocuments: number;
    calculatingDocuments: number;
    staleDocuments: number;
    recentDocuments: number;
  }> {
    try {
      const cachedAnalytics = await this.getTeacherCachedAnalytics(teacherId);
      
      const stats = {
        totalDocuments: cachedAnalytics.length,
        calculatingDocuments: cachedAnalytics.filter(doc => doc.isCalculating).length,
        staleDocuments: cachedAnalytics.filter(doc => this.isCacheStale(doc, 30)).length,
        recentDocuments: cachedAnalytics.filter(doc => !this.isCacheStale(doc, 30)).length
      };
      
      console.log(`📊 Document stats for teacher ${teacherId}:`, stats);
      return stats;
    } catch (error) {
      console.error('Error getting document stats:', error);
      return {
        totalDocuments: 0,
        calculatingDocuments: 0,
        staleDocuments: 0,
        recentDocuments: 0
      };
    }
  }
}