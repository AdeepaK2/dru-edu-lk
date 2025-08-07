// Demo script for Test Numbering System
// Shows how automatic test numbering works for classes

import { TestNumberingService } from '@/apiservices/testNumberingService';
import { EnhancedTestService } from '@/apiservices/enhancedTestService';

export async function demonstrateTestNumbering() {
  console.log('🎯 Demonstrating Automatic Test Numbering System');
  console.log('===============================================');
  
  try {
    // Demo data
    const demoClass = {
      classId: 'class-demo-123',
      className: 'Grade 10A',
      teacherId: 'teacher-demo-456',
      teacherName: 'Ms. Smith'
    };
    
    const mathSubject = {
      subjectId: 'math-subject-789',
      subjectName: 'Mathematics'
    };
    
    const englishSubject = {
      subjectId: 'english-subject-101',
      subjectName: 'English'
    };
    
    console.log('📚 Demo setup:');
    console.log(`Class: ${demoClass.className} (${demoClass.classId})`);
    console.log(`Teacher: ${demoClass.teacherName}`);
    console.log(`Subjects: Math, English`);
    console.log('');
    
    // Step 1: Create first Math test
    console.log('🔢 Step 1: Creating first Math test...');
    const mathTest1 = await createDemoTest(
      'Algebra Basics Quiz',
      demoClass,
      mathSubject
    );
    console.log(`✅ Created: ${mathTest1.displayNumber} - "${mathTest1.title}"`);
    console.log('');
    
    // Step 2: Create second Math test
    console.log('🔢 Step 2: Creating second Math test...');
    const mathTest2 = await createDemoTest(
      'Geometry Fundamentals',
      demoClass,
      mathSubject
    );
    console.log(`✅ Created: ${mathTest2.displayNumber} - "${mathTest2.title}"`);
    console.log('');
    
    // Step 3: Create first English test
    console.log('📖 Step 3: Creating first English test...');
    const englishTest1 = await createDemoTest(
      'Grammar Assessment',
      demoClass,
      englishSubject
    );
    console.log(`✅ Created: ${englishTest1.displayNumber} - "${englishTest1.title}"`);
    console.log('');
    
    // Step 4: Create third Math test
    console.log('🔢 Step 4: Creating third Math test...');
    const mathTest3 = await createDemoTest(
      'Trigonometry Basics',
      demoClass,
      mathSubject
    );
    console.log(`✅ Created: ${mathTest3.displayNumber} - "${mathTest3.title}"`);
    console.log('');
    
    // Step 5: Show counter status
    console.log('📊 Step 5: Current counter status...');
    const mathCounter = await TestNumberingService.getCounterStatus(
      demoClass.classId,
      mathSubject.subjectId
    );
    const englishCounter = await TestNumberingService.getCounterStatus(
      demoClass.classId,
      englishSubject.subjectId
    );
    
    console.log(`Math Counter: Next test will be #${mathCounter?.currentTestNumber || 1}`);
    console.log(`English Counter: Next test will be #${englishCounter?.currentTestNumber || 1}`);
    console.log('');
    
    // Step 6: Show all test numbers for the class
    console.log('📋 Step 6: All test numbers for class...');
    const allTestNumbers = await TestNumberingService.getClassTestNumbers(demoClass.classId);
    
    console.log('Test sequence:');
    allTestNumbers.forEach((assignment, index) => {
      console.log(`  ${index + 1}. ${assignment.displayNumber} - ${assignment.testTitle || 'Untitled'}`);
      console.log(`     Subject: ${assignment.subjectName || 'No subject'}`);
      console.log(`     Created: ${assignment.assignedAt.toDate().toLocaleDateString()}`);
      console.log('');
    });
    
    // Step 7: Generate suggested title for next test
    console.log('💡 Step 7: Generate suggested title for next Math test...');
    const suggestion = await EnhancedTestService.generateTestTitleWithNumber(
      'Advanced Calculus',
      demoClass.classId,
      demoClass.className,
      mathSubject.subjectId,
      mathSubject.subjectName
    );
    
    console.log(`Suggested title: "${suggestion.suggestedTitle}"`);
    console.log(`Next number: ${suggestion.nextNumber}`);
    console.log(`Display number: ${suggestion.displayNumber}`);
    console.log('');
    
    // Step 8: Show teacher statistics
    console.log('📈 Step 8: Teacher statistics...');
    const teacherStats = await TestNumberingService.getTeacherTestingStats(demoClass.teacherId);
    
    console.log('Teacher Testing Statistics:');
    console.log(`  Total tests created: ${teacherStats.totalTestsCreated}`);
    console.log(`  Tests this month: ${teacherStats.testsThisMonth}`);
    console.log(`  Active classes: ${teacherStats.activeClasses}`);
    console.log(`  Average tests per class: ${teacherStats.averageTestsPerClass}`);
    console.log('');
    
    console.log('Recent test numbers:');
    teacherStats.recentTestNumbers.forEach((test, index) => {
      console.log(`  ${index + 1}. ${test.displayNumber} - ${test.testTitle}`);
      console.log(`     Class: ${test.className}`);
      if (test.subjectName) console.log(`     Subject: ${test.subjectName}`);
      console.log('');
    });
    
    console.log('🎉 Test Numbering Demonstration Complete!');
    console.log('');
    console.log('Key Benefits Demonstrated:');
    console.log('✅ Automatic sequential numbering per subject');
    console.log('✅ Separate counters for different subjects');
    console.log('✅ Descriptive display numbers (e.g., "Mathematics Test #3")');
    console.log('✅ Complete tracking and statistics');
    console.log('✅ Easy integration with test creation');
    console.log('✅ Title suggestions with automatic numbering');
    
    return {
      success: true,
      testsCreated: [mathTest1, mathTest2, englishTest1, mathTest3],
      teacherStats,
      mathCounter,
      englishCounter
    };
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    return { success: false, error };
  }
}

// Helper function to create demo test
async function createDemoTest(
  title: string,
  classInfo: { classId: string; className: string; teacherId: string; teacherName: string },
  subjectInfo: { subjectId: string; subjectName: string }
) {
  // Create a mock test using the enhanced service
  const testData = {
    title,
    description: `Demo test for ${subjectInfo.subjectName}`,
    instructions: 'This is a demo test created to show automatic numbering.',
    teacherId: classInfo.teacherId,
    teacherName: classInfo.teacherName,
    subjectId: subjectInfo.subjectId,
    subjectName: subjectInfo.subjectName,
    classIds: [classInfo.classId],
    classNames: [classInfo.className],
    type: 'flexible' as const,
    config: {
      questionSelectionMethod: 'manual' as const,
      totalQuestions: 5,
      shuffleQuestions: false,
      allowReviewBeforeSubmit: true,
      passingScore: 70,
      showResultsImmediately: true
    },
    questions: [], // Empty for demo
    totalMarks: 50,
    status: 'draft' as const,
    // Flexible test specific fields
    availableFrom: new Date(),
    availableTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    duration: 60,
    attemptsAllowed: 1
  };
  
  const result = await EnhancedTestService.createTestWithNumbering(testData);
  
  return {
    testId: result.testId,
    title,
    displayNumber: result.displayNumber,
    testNumber: result.testNumber
  };
}

// Usage examples for UI components
export function getTestNumberingUIExamples() {
  return {
    // Badge examples
    badgeExamples: [
      { testNumber: 1, displayNumber: 'Test #1' },
      { testNumber: 5, displayNumber: 'Math Test #5' },
      { testNumber: 12, displayNumber: 'English Quiz #12' }
    ],
    
    // Stats example
    statsExample: {
      totalTests: 47,
      testsThisMonth: 8,
      activeClasses: 5
    },
    
    // Recent tests example
    recentTestsExample: [
      {
        className: 'Grade 10A',
        subjectName: 'Mathematics',
        testNumber: 15,
        displayNumber: 'Mathematics Test #15',
        testTitle: 'Trigonometry Assessment',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        className: 'Grade 9B',
        subjectName: 'English',
        testNumber: 8,
        displayNumber: 'English Test #8',
        testTitle: 'Poetry Analysis',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        className: 'Grade 11C',
        subjectName: 'Physics',
        testNumber: 3,
        displayNumber: 'Physics Test #3',
        testTitle: 'Newton\'s Laws',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }
    ]
  };
}

// Run the demonstration
export async function runTestNumberingDemo() {
  console.log('🚀 Starting Test Numbering System Demo...');
  
  try {
    const result = await demonstrateTestNumbering();
    
    if (result.success) {
      console.log('');
      console.log('🎯 Demo completed successfully!');
      console.log('The test numbering system is now ready for use.');
    } else {
      console.log('❌ Demo failed. Please check the error above.');
    }
    
    return result;
    
  } catch (error) {
    console.error('💥 Demo crashed:', error);
    return { success: false, error };
  }
}
