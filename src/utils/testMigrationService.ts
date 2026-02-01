// Migration utility to help transition from old test format to simplified architecture
// This helps migrate existing tests that have duplicated question data

import { firestore } from '@/utils/firebase-client';
import { collection, doc, getDoc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { Test } from '@/models/testSchema';
import { SimplifiedTest, TestQuestionRef } from '@/models/simplifiedTestSchema';

export class TestMigrationService {
  
  /**
   * Migrate a single test from old format to simplified format
   */
  static async migrateTest(testId: string): Promise<string | null> {
    try {
      console.log(`🔄 Migrating test: ${testId}`);
      
      // Get the old test
      const oldTestDoc = await getDoc(doc(firestore, 'tests', testId));
      
      if (!oldTestDoc.exists()) {
        console.error(`❌ Test not found: ${testId}`);
        return null;
      }
      
      const oldTest = { id: oldTestDoc.id, ...oldTestDoc.data() } as Test;
      
      // Extract question references from the old test
      const questionRefs: TestQuestionRef[] = oldTest.questions.map((q, index) => ({
        questionId: q.questionId || q.id,
        order: q.order || index + 1,
        points: q.points || q.marks || 1
      }));
      
      // Create simplified test data
      const simplifiedTest: Partial<SimplifiedTest> = {
        title: oldTest.title,
        description: oldTest.description,
        instructions: oldTest.instructions,
        teacherId: oldTest.teacherId,
        teacherName: oldTest.teacherName,
        subjectId: oldTest.subjectId,
        subjectName: oldTest.subjectName,
        classIds: oldTest.classIds,
        classNames: oldTest.classNames,
        type: oldTest.type,
        config: oldTest.config,
        questionRefs, // Only references, no duplicated data!
        totalMarks: oldTest.totalMarks,
        status: oldTest.status,
        createdAt: oldTest.createdAt,
        updatedAt: oldTest.updatedAt
      };
      
      // Add type-specific fields
      if (oldTest.type === 'live') {
        const liveTest = oldTest as any;
        Object.assign(simplifiedTest, {
          scheduledStartTime: liveTest.scheduledStartTime,
          duration: liveTest.duration,
          bufferTime: liveTest.bufferTime,
          studentJoinTime: liveTest.studentJoinTime,
          actualEndTime: liveTest.actualEndTime,
          isLive: liveTest.isLive,
          studentsOnline: liveTest.studentsOnline,
          studentsCompleted: liveTest.studentsCompleted
        });
      } else if (oldTest.type === 'flexible') {
        const flexTest = oldTest as any;
        Object.assign(simplifiedTest, {
          availableFrom: flexTest.availableFrom,
          availableTo: flexTest.availableTo,
          duration: flexTest.duration,
          attemptsAllowed: flexTest.attemptsAllowed
        });
      } else if (oldTest.type === 'in-class') {
        const inClassTest = oldTest as any;
        Object.assign(simplifiedTest, {
          scheduledStartTime: inClassTest.scheduledStartTime,
          duration: inClassTest.duration,
          submissionMethod: inClassTest.submissionMethod,
          examPdfUrl: inClassTest.examPdfUrl
        });
      }
      
      // Save the simplified test
      const simplifiedTestRef = doc(collection(firestore, 'simplified_tests'));
      await setDoc(simplifiedTestRef, simplifiedTest);
      
      console.log(`✅ Migrated test ${testId} to simplified format: ${simplifiedTestRef.id}`);
      
      return simplifiedTestRef.id;
      
    } catch (error) {
      console.error(`❌ Error migrating test ${testId}:`, error);
      return null;
    }
  }
  
  /**
   * Migrate all tests for a specific teacher
   */
  static async migrateTeacherTests(teacherId: string): Promise<{
    migrated: string[];
    failed: string[];
  }> {
    try {
      console.log(`🔄 Migrating all tests for teacher: ${teacherId}`);
      
      // Get all tests for the teacher
      const testsQuery = query(
        collection(firestore, 'tests'),
        where('teacherId', '==', teacherId)
      );
      
      const snapshot = await getDocs(testsQuery);
      const migrated: string[] = [];
      const failed: string[] = [];
      
      for (const testDoc of snapshot.docs) {
        const newTestId = await this.migrateTest(testDoc.id);
        
        if (newTestId) {
          migrated.push(newTestId);
        } else {
          failed.push(testDoc.id);
        }
      }
      
      console.log(`📊 Migration completed for teacher ${teacherId}:`, {
        total: snapshot.docs.length,
        migrated: migrated.length,
        failed: failed.length
      });
      
      return { migrated, failed };
      
    } catch (error) {
      console.error(`❌ Error migrating tests for teacher ${teacherId}:`, error);
      return { migrated: [], failed: [] };
    }
  }
  
  /**
   * Get migration status for a test
   */
  static async getMigrationStatus(testId: string): Promise<{
    oldExists: boolean;
    simplifiedExists: boolean;
    questionCount: number;
    issues: string[];
  }> {
    try {
      const issues: string[] = [];
      
      // Check if old test exists
      const oldTestDoc = await getDoc(doc(firestore, 'tests', testId));
      const oldExists = oldTestDoc.exists();
      
      // Check if simplified version exists (search by original test ID in metadata)
      const simplifiedQuery = query(
        collection(firestore, 'simplified_tests'),
        where('originalTestId', '==', testId)
      );
      const simplifiedSnapshot = await getDocs(simplifiedQuery);
      const simplifiedExists = !simplifiedSnapshot.empty;
      
      let questionCount = 0;
      
      if (oldExists) {
        const oldTest = { id: oldTestDoc.id, ...oldTestDoc.data() } as Test;
        questionCount = oldTest.questions?.length || 0;
        
        // Check for potential issues
        if (questionCount === 0) {
          issues.push('Test has no questions');
        }
        
        // Check if questions have proper IDs
        const missingIds = oldTest.questions.filter(q => !q.questionId && !q.id);
        if (missingIds.length > 0) {
          issues.push(`${missingIds.length} questions missing proper IDs`);
        }
      }
      
      return {
        oldExists,
        simplifiedExists,
        questionCount,
        issues
      };
      
    } catch (error) {
      console.error(`❌ Error checking migration status for test ${testId}:`, error);
      return {
        oldExists: false,
        simplifiedExists: false,
        questionCount: 0,
        issues: ['Error checking status']
      };
    }
  }
  
  /**
   * Validate that all question references exist in question bank
   */
  static async validateQuestionReferences(questionIds: string[]): Promise<{
    existing: string[];
    missing: string[];
    issues: Array<{ questionId: string; issue: string }>;
  }> {
    try {
      console.log(`🔍 Validating ${questionIds.length} question references...`);
      
      const existing: string[] = [];
      const missing: string[] = [];
      const issues: Array<{ questionId: string; issue: string }> = [];
      
      // Check questions in batches
      const batchSize = 10;
      for (let i = 0; i < questionIds.length; i += batchSize) {
        const batch = questionIds.slice(i, i + batchSize);
        
        for (const questionId of batch) {
          try {
            const questionDoc = await getDoc(doc(firestore, 'questions', questionId));
            
            if (questionDoc.exists()) {
              existing.push(questionId);
              
              // Validate question structure
              const questionData = questionDoc.data();
              if (!questionData.type) {
                issues.push({ questionId, issue: 'Missing question type' });
              }
              if (!questionData.title) {
                issues.push({ questionId, issue: 'Missing question title' });
              }
              if (questionData.type === 'mcq' && (!questionData.options || questionData.options.length === 0)) {
                issues.push({ questionId, issue: 'MCQ question missing options' });
              }
            } else {
              missing.push(questionId);
            }
          } catch (error) {
            missing.push(questionId);
            issues.push({ questionId, issue: `Error accessing question: ${error}` });
          }
        }
      }
      
      console.log(`✅ Validation completed:`, {
        total: questionIds.length,
        existing: existing.length,
        missing: missing.length,
        issues: issues.length
      });
      
      return { existing, missing, issues };
      
    } catch (error) {
      console.error('❌ Error validating question references:', error);
      return {
        existing: [],
        missing: questionIds,
        issues: [{ questionId: 'all', issue: `Validation error: ${error}` }]
      };
    }
  }
}

// Migration reporting utility
export class MigrationReporter {
  
  /**
   * Generate a migration report for a teacher
   */
  static async generateTeacherReport(teacherId: string): Promise<{
    summary: {
      totalTests: number;
      canMigrate: number;
      hasIssues: number;
      alreadyMigrated: number;
    };
    details: Array<{
      testId: string;
      title: string;
      status: 'ready' | 'issues' | 'migrated';
      questionCount: number;
      issues: string[];
    }>;
  }> {
    try {
      console.log(`📊 Generating migration report for teacher: ${teacherId}`);
      
      // Get all tests for the teacher
      const testsQuery = query(
        collection(firestore, 'tests'),
        where('teacherId', '==', teacherId)
      );
      
      const snapshot = await getDocs(testsQuery);
      const details = [];
      
      let totalTests = 0;
      let canMigrate = 0;
      let hasIssues = 0;
      let alreadyMigrated = 0;
      
      for (const testDoc of snapshot.docs) {
        const test = { id: testDoc.id, ...testDoc.data() } as Test;
        const migrationStatus = await TestMigrationService.getMigrationStatus(test.id);
        
        totalTests++;
        
        let status: 'ready' | 'issues' | 'migrated';
        if (migrationStatus.simplifiedExists) {
          status = 'migrated';
          alreadyMigrated++;
        } else if (migrationStatus.issues.length > 0) {
          status = 'issues';
          hasIssues++;
        } else {
          status = 'ready';
          canMigrate++;
        }
        
        details.push({
          testId: test.id,
          title: test.title,
          status,
          questionCount: migrationStatus.questionCount,
          issues: migrationStatus.issues
        });
      }
      
      const summary = {
        totalTests,
        canMigrate,
        hasIssues,
        alreadyMigrated
      };
      
      console.log(`📈 Migration report generated:`, summary);
      
      return { summary, details };
      
    } catch (error) {
      console.error(`❌ Error generating migration report for teacher ${teacherId}:`, error);
      return {
        summary: { totalTests: 0, canMigrate: 0, hasIssues: 0, alreadyMigrated: 0 },
        details: []
      };
    }
  }
}
