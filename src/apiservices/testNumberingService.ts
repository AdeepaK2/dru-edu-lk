// Test Numbering Service - Manages automatic test number assignment
// Provides sequential numbering for tests within classes/subjects

import { firestore } from '@/utils/firebase-client';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  runTransaction,
  Timestamp 
} from 'firebase/firestore';
import { 
  ClassTestCounter, 
  TestNumberAssignment, 
  GlobalTestCounter,
  TestNumberingConfig 
} from '@/models/testCounterSchema';

export class TestNumberingService {
  
  /**
   * Get the next test number for a class/subject and increment the counter
   */
  static async getNextTestNumber(
    classId: string,
    className: string,
    subjectId?: string,
    subjectName?: string,
    teacherId?: string,
    teacherName?: string
  ): Promise<{
    testNumber: number;
    displayNumber: string;
    assignmentId: string;
  }> {
    try {
      console.log('🔢 Getting next test number for:', { classId, subjectId, className, subjectName });
      
      const result = await runTransaction(firestore, async (transaction) => {
        // Determine counter ID based on strategy
        const counterId = subjectId ? `${classId}_${subjectId}` : classId;
        const counterRef = doc(firestore, 'class_test_counters', counterId);
        
        // Get current counter
        const counterDoc = await transaction.get(counterRef);
        let counter: ClassTestCounter;
        
        if (counterDoc.exists()) {
          counter = { id: counterDoc.id, ...counterDoc.data() } as ClassTestCounter;
        } else {
          // Initialize new counter
          counter = {
            id: counterId,
            classId,
            className,
            subjectId,
            subjectName,
            teacherId: teacherId || 'unknown',
            teacherName: teacherName || 'Unknown Teacher',
            currentTestNumber: 1,
            totalTestsCreated: 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          };
        }
        
        // Get the next test number
        const nextTestNumber = counter.currentTestNumber;
        
        // Update counter
        const updatedCounter = {
          ...counter,
          currentTestNumber: nextTestNumber + 1,
          totalTestsCreated: counter.totalTestsCreated + 1,
          updatedAt: Timestamp.now()
        };
        
        // Save updated counter
        transaction.set(counterRef, updatedCounter);
        
        return {
          testNumber: nextTestNumber,
          counter: updatedCounter
        };
      });
      
      // Generate display number
      const displayNumber = this.generateDisplayNumber(
        result.testNumber,
        subjectName,
        className
      );
      
      // Create assignment record
      const assignmentRef = doc(collection(firestore, 'test_number_assignments'));
      const assignment: Omit<TestNumberAssignment, 'id' | 'testId' | 'testTitle'> = {
        classId,
        className,
        subjectId,
        subjectName,
        teacherId: teacherId || 'unknown',
        teacherName: teacherName || 'Unknown Teacher',
        testNumber: result.testNumber,
        displayNumber,
        isGlobalNumber: false,
        assignedAt: Timestamp.now()
      };
      
      await setDoc(assignmentRef, assignment);
      
      console.log('✅ Test number assigned:', {
        testNumber: result.testNumber,
        displayNumber,
        assignmentId: assignmentRef.id
      });
      
      return {
        testNumber: result.testNumber,
        displayNumber,
        assignmentId: assignmentRef.id
      };
      
    } catch (error) {
      console.error('❌ Error getting next test number:', error);
      throw error;
    }
  }
  
  /**
   * Complete test number assignment by linking to actual test
   */
  static async completeTestNumberAssignment(
    assignmentId: string,
    testId: string,
    testTitle: string
  ): Promise<void> {
    try {
      console.log('🔗 Completing test number assignment:', { assignmentId, testId, testTitle });
      
      const assignmentRef = doc(firestore, 'test_number_assignments', assignmentId);
      
      await updateDoc(assignmentRef, {
        testId,
        testTitle
      });
      
      // Also update the counter with last test info
      const assignmentDoc = await getDoc(assignmentRef);
      if (assignmentDoc.exists()) {
        const assignment = assignmentDoc.data() as TestNumberAssignment;
        const counterId = assignment.subjectId 
          ? `${assignment.classId}_${assignment.subjectId}` 
          : assignment.classId;
        
        const counterRef = doc(firestore, 'class_test_counters', counterId);
        await updateDoc(counterRef, {
          lastTestId: testId,
          lastTestTitle: testTitle,
          lastTestCreatedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }
      
      console.log('✅ Test number assignment completed');
      
    } catch (error) {
      console.error('❌ Error completing test number assignment:', error);
      throw error;
    }
  }
  
  /**
   * Get test number information for a specific test
   */
  static async getTestNumberInfo(testId: string): Promise<TestNumberAssignment | null> {
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      const assignmentsQuery = query(
        collection(firestore, 'test_number_assignments'),
        where('testId', '==', testId)
      );
      
      const snapshot = await getDocs(assignmentsQuery);
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as TestNumberAssignment;
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ Error getting test number info:', error);
      return null;
    }
  }
  
  /**
   * Get current counter status for a class/subject
   */
  static async getCounterStatus(
    classId: string,
    subjectId?: string
  ): Promise<ClassTestCounter | null> {
    try {
      const counterId = subjectId ? `${classId}_${subjectId}` : classId;
      const counterRef = doc(firestore, 'class_test_counters', counterId);
      const counterDoc = await getDoc(counterRef);
      
      if (counterDoc.exists()) {
        return { id: counterDoc.id, ...counterDoc.data() } as ClassTestCounter;
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ Error getting counter status:', error);
      return null;
    }
  }
  
  /**
   * Get all test numbers for a class
   */
  static async getClassTestNumbers(classId: string): Promise<TestNumberAssignment[]> {
    try {
      const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
      
      const assignmentsQuery = query(
        collection(firestore, 'test_number_assignments'),
        where('classId', '==', classId),
        orderBy('testNumber', 'asc')
      );
      
      const snapshot = await getDocs(assignmentsQuery);
      
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as TestNumberAssignment));
      
    } catch (error) {
      console.error('❌ Error getting class test numbers:', error);
      return [];
    }
  }
  
  /**
   * Reset counter for a class/subject (admin function)
   */
  static async resetCounter(
    classId: string,
    subjectId?: string,
    resetTo: number = 1
  ): Promise<void> {
    try {
      console.log('🔄 Resetting counter for:', { classId, subjectId, resetTo });
      
      const counterId = subjectId ? `${classId}_${subjectId}` : classId;
      const counterRef = doc(firestore, 'class_test_counters', counterId);
      
      await updateDoc(counterRef, {
        currentTestNumber: resetTo,
        updatedAt: Timestamp.now(),
        lastResetAt: Timestamp.now()
      });
      
      console.log('✅ Counter reset successfully');
      
    } catch (error) {
      console.error('❌ Error resetting counter:', error);
      throw error;
    }
  }
  
  /**
   * Generate display number based on configuration
   */
  private static generateDisplayNumber(
    testNumber: number,
    subjectName?: string,
    className?: string,
    config?: Partial<TestNumberingConfig>
  ): string {
    // Default configuration
    const defaultConfig = {
      prefix: 'Test',
      includeSubject: !!subjectName,
      numberFormat: 'simple' as const,
      paddingLength: 3
    };
    
    const finalConfig = { ...defaultConfig, ...config };
    
    // Format the number
    let formattedNumber: string;
    switch (finalConfig.numberFormat) {
      case 'padded':
        formattedNumber = testNumber.toString().padStart(finalConfig.paddingLength || 3, '0');
        break;
      case 'roman':
        formattedNumber = this.toRoman(testNumber);
        break;
      case 'simple':
      default:
        formattedNumber = testNumber.toString();
        break;
    }
    
    // Build display string
    let displayParts: string[] = [];
    
    if (finalConfig.includeSubject && subjectName) {
      displayParts.push(subjectName);
    }
    
    if (finalConfig.prefix) {
      displayParts.push(finalConfig.prefix);
    }
    
    displayParts.push(`#${formattedNumber}`);
    
    if (finalConfig.suffix) {
      displayParts.push(finalConfig.suffix);
    }
    
    return displayParts.join(' ');
  }
  
  /**
   * Convert number to Roman numerals
   */
  private static toRoman(num: number): string {
    const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const numerals = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
    
    let result = '';
    for (let i = 0; i < values.length; i++) {
      while (num >= values[i]) {
        result += numerals[i];
        num -= values[i];
      }
    }
    return result;
  }
  
  /**
   * Get statistics for teacher dashboard
   */
  static async getTeacherTestingStats(teacherId: string): Promise<{
    totalTestsCreated: number;
    testsThisMonth: number;
    activeClasses: number;
    averageTestsPerClass: number;
    recentTestNumbers: Array<{
      className: string;
      subjectName?: string;
      testNumber: number;
      displayNumber: string;
      testTitle?: string;
      createdAt: Timestamp;
    }>;
  }> {
    try {
      const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
      
      // Get all test assignments for this teacher
      const assignmentsQuery = query(
        collection(firestore, 'test_number_assignments'),
        where('teacherId', '==', teacherId),
        orderBy('assignedAt', 'desc'),
        limit(10)
      );
      
      const snapshot = await getDocs(assignmentsQuery);
      const assignments = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as TestNumberAssignment));
      
      // Calculate statistics
      const totalTestsCreated = assignments.length;
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);
      
      const testsThisMonth = assignments.filter(a => 
        a.assignedAt.toDate() >= currentMonth
      ).length;
      
      const uniqueClasses = new Set(assignments.map(a => a.classId));
      const activeClasses = uniqueClasses.size;
      
      const averageTestsPerClass = activeClasses > 0 ? totalTestsCreated / activeClasses : 0;
      
      const recentTestNumbers = assignments.slice(0, 5).map(a => ({
        className: a.className,
        subjectName: a.subjectName,
        testNumber: a.testNumber,
        displayNumber: a.displayNumber,
        testTitle: a.testTitle,
        createdAt: a.assignedAt
      }));
      
      return {
        totalTestsCreated,
        testsThisMonth,
        activeClasses,
        averageTestsPerClass: Math.round(averageTestsPerClass * 10) / 10,
        recentTestNumbers
      };
      
    } catch (error) {
      console.error('❌ Error getting teacher testing stats:', error);
      return {
        totalTestsCreated: 0,
        testsThisMonth: 0,
        activeClasses: 0,
        averageTestsPerClass: 0,
        recentTestNumbers: []
      };
    }
  }

  /**
   * Get suggested test numbers and used numbers for UI display (without assigning)
   */
  static async getTestNumberSuggestions(
    classId: string,
    subjectId?: string
  ): Promise<{
    suggestedNumber: number;
    usedNumbers: number[];
    nextAvailable: number;
  }> {
    try {
      console.log('🔍 Getting test number suggestions for:', { classId, subjectId });
      
      // Get existing tests for this class to extract test numbers from titles
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      let testsQuery;
      if (subjectId) {
        // Filter by both class and subject
        testsQuery = query(
          collection(firestore, 'tests'),
          where('classIds', 'array-contains', classId),
          where('subjectId', '==', subjectId)
        );
      } else {
        // Filter by class only
        testsQuery = query(
          collection(firestore, 'tests'),
          where('classIds', 'array-contains', classId)
        );
      }
      
      const testsSnapshot = await getDocs(testsQuery);
      const tests = testsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        // Retests carry the original's "(Test N)" text in their title — never let them
        // contribute to the next-available calculation.
        .filter((t: any) => t.isRetest !== true);

      console.log('🔍 Found tests for class:', tests.length);

      // Extract test numbers from test titles
      // Look for patterns like "Test 1", "Test 2", "(Test 3)", etc.
      const testNumberPattern = /\(?\s*Test\s+(\d+)\s*\)?/i;
      const usedNumbers: number[] = [];

      tests.forEach((test: any) => {
        if (test.title) {
          const match = test.title.match(testNumberPattern);
          if (match && match[1]) {
            const testNumber = parseInt(match[1], 10);
            if (!isNaN(testNumber)) {
              usedNumbers.push(testNumber);
            }
          }
        }
      });
      
      // Remove duplicates and sort
      const uniqueUsedNumbers = [...new Set(usedNumbers)].sort((a, b) => a - b);
      
      // Find the next available number (in case there are gaps)
      let nextAvailable = 1;
      const usedSet = new Set(uniqueUsedNumbers);
      while (usedSet.has(nextAvailable)) {
        nextAvailable++;
      }
      
      console.log('✅ Test number suggestions:', {
        suggestedNumber: nextAvailable,
        usedNumbers: uniqueUsedNumbers,
        nextAvailable,
        extractedFromTitles: tests.map((t: any) => ({ title: t.title, match: t.title?.match(testNumberPattern) }))
      });
      
      return {
        suggestedNumber: nextAvailable, // Always use the next available number
        usedNumbers: uniqueUsedNumbers,
        nextAvailable
      };
      
    } catch (error) {
      console.error('❌ Error getting test number suggestions:', error);
      return {
        suggestedNumber: 1,
        usedNumbers: [],
        nextAvailable: 1
      };
    }
  }
}
