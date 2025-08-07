// Demo script to test the new simplified architecture
// This script creates a test using question bank references instead of duplicated data

import { firestore } from '@/utils/firebase-client';
import { collection, addDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { SimplifiedTest, TestQuestionRef } from '@/models/simplifiedTestSchema';
import { SimplifiedResultService } from '@/apiservices/simplifiedResultService';

export async function createSimplifiedTestDemo() {
  console.log('🚀 Creating demo test with simplified architecture...');
  
  try {
    // Example question IDs (these should exist in your question bank)
    const questionIds = [
      // Add some real question IDs from your question bank here
      'question-1',
      'question-2', 
      'question-3'
    ];
    
    // Create question references (no duplicated data!)
    const questionRefs: TestQuestionRef[] = questionIds.map((id, index) => ({
      questionId: id,
      order: index + 1,
      points: 5 // Each question worth 5 points
    }));
    
    // Create simplified test
    const testData: Partial<SimplifiedTest> = {
      title: 'Demo Test - Simplified Architecture',
      description: 'This test demonstrates the new simplified architecture using question bank references',
      instructions: 'Answer all questions to the best of your ability.',
      
      // Ownership
      teacherId: 'demo-teacher-id',
      teacherName: 'Demo Teacher',
      subjectId: 'demo-subject-id',
      subjectName: 'Demo Subject',
      classIds: ['demo-class-id'],
      classNames: ['Demo Class'],
      
      // Type and config
      type: 'flexible',
      config: {
        questionSelectionMethod: 'manual',
        totalQuestions: questionRefs.length,
        shuffleQuestions: false,
        allowReviewBeforeSubmit: true,
        passingScore: 70,
        showResultsImmediately: true
      },
      
      // Question references only (NO duplicated data!)
      questionRefs,
      totalMarks: questionRefs.reduce((sum, ref) => sum + ref.points, 0),
      
      // Flexible test specific fields
      availableFrom: Timestamp.now(),
      availableTo: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days from now
      duration: 60, // 60 minutes
      attemptsAllowed: 3,
      
      // Status
      status: 'live',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    // Save to Firestore
    const testRef = await addDoc(collection(firestore, 'simplified_tests'), testData);
    console.log('✅ Created simplified test:', testRef.id);
    
    // Demo: Test result computation
    await demoResultComputation(testRef.id, questionIds);
    
    return testRef.id;
    
  } catch (error) {
    console.error('❌ Error creating simplified test demo:', error);
    throw error;
  }
}

async function demoResultComputation(testId: string, questionIds: string[]) {
  console.log('🧮 Demonstrating result computation...');
  
  try {
    // Create a mock simplified submission
    const mockSubmission = {
      id: 'demo-submission-id',
      testId,
      testTitle: 'Demo Test - Simplified Architecture',
      testType: 'flexible' as const,
      studentId: 'demo-student-id',
      studentName: 'Demo Student',
      classId: 'demo-class-id',
      className: 'Demo Class',
      attemptNumber: 1,
      status: 'submitted' as const,
      startTime: Timestamp.now(),
      endTime: Timestamp.now(),
      submittedAt: Timestamp.now(),
      totalTimeSpent: 1800, // 30 minutes
      
      // Mock answers
      answers: [
        {
          questionId: questionIds[0],
          selectedOption: 1, // Option B
          timeSpent: 300,
          changeCount: 1,
          wasReviewed: false
        },
        {
          questionId: questionIds[1],
          selectedOption: 2, // Option C
          timeSpent: 450,
          changeCount: 2,
          wasReviewed: true
        },
        {
          questionId: questionIds[2],
          textContent: 'This is a sample essay answer demonstrating the simplified architecture.',
          timeSpent: 1050,
          changeCount: 5,
          wasReviewed: false
        }
      ],
      
      questionsAttempted: 3,
      questionsSkipped: 0,
      questionsReviewed: 1,
      totalChanges: 8,
      autoGradedScore: 0,
      manualGradingPending: false,
      maxScore: 15,
      percentage: 0,
      integrityReport: {
        tabSwitches: 2,
        disconnections: 0,
        suspiciousActivities: [],
        isIntegrityCompromised: false
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    // Compute results using the new simplified service
    console.log('🔄 Computing results...');
    const results = await SimplifiedResultService.computeTestResults(mockSubmission, questionIds);
    
    console.log('📊 Computed Results:', {
      mcqResultsCount: results.mcqResults.length,
      essayResultsCount: results.essayResults.length,
      autoGradedScore: results.autoGradedScore,
      manualGradingPending: results.manualGradingPending,
      sampleMCQResult: results.mcqResults[0] ? {
        questionId: results.mcqResults[0].questionId,
        selectedOption: results.mcqResults[0].selectedOption,
        correctOption: results.mcqResults[0].correctOption,
        isCorrect: results.mcqResults[0].isCorrect,
        marksAwarded: results.mcqResults[0].marksAwarded
      } : null
    });
    
    // Convert to legacy format for backward compatibility
    const legacySubmission = await SimplifiedResultService.convertToLegacySubmission(
      mockSubmission,
      questionIds
    );
    
    console.log('🔄 Legacy conversion completed:', {
      hasLegacyMCQResults: !!legacySubmission.mcqResults,
      hasLegacyFinalAnswers: !!legacySubmission.finalAnswers,
      mcqResultsCount: legacySubmission.mcqResults?.length || 0,
      finalAnswersCount: legacySubmission.finalAnswers?.length || 0
    });
    
  } catch (error) {
    console.error('❌ Error in result computation demo:', error);
  }
}

// Utility function to fetch some real question IDs from your question bank
export async function getAvailableQuestionIds(limit: number = 5): Promise<string[]> {
  try {
    const { collection, getDocs, query, limit: limitQuery } = await import('firebase/firestore');
    
    const questionsQuery = query(
      collection(firestore, 'questions'),
      limitQuery(limit)
    );
    
    const snapshot = await getDocs(questionsQuery);
    return snapshot.docs.map(doc => doc.id);
    
  } catch (error) {
    console.error('❌ Error fetching question IDs:', error);
    return [];
  }
}

// Example usage function
export async function runSimplifiedArchitectureDemo() {
  console.log('🎯 Starting Simplified Architecture Demo');
  console.log('=====================================');
  
  try {
    // Get some real question IDs from your question bank
    const availableQuestionIds = await getAvailableQuestionIds(3);
    
    if (availableQuestionIds.length === 0) {
      console.log('⚠️ No questions found in question bank. Please add some questions first.');
      return;
    }
    
    console.log('📋 Using questions:', availableQuestionIds);
    
    // Create the demo test
    const testId = await createSimplifiedTestDemo();
    
    console.log('🎉 Demo completed successfully!');
    console.log('Benefits of simplified architecture:');
    console.log('✅ No question data duplication');
    console.log('✅ Single source of truth in question bank');
    console.log('✅ Automatic data consistency');
    console.log('✅ Simplified test creation');
    console.log('✅ Accurate result computation');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}
