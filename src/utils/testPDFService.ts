import { ExamPDFService } from '@/services/examPDFService';
import { EssayQuestion } from '@/models/questionBankSchema';
import { Timestamp } from 'firebase/firestore';

// Test function to verify PDF generation
export const testPDFGeneration = async () => {
  console.log('🧪 Testing PDF Generation...');

  // Sample essay questions for testing
  const sampleQuestions: EssayQuestion[] = [
    {
      id: 'q1',
      title: 'Literature Analysis',
      content: 'Analyze the main themes in Shakespeare\'s Hamlet and discuss how they relate to modern society. Provide specific examples from the text to support your arguments.',
      type: 'essay',
      points: 25,
      difficultyLevel: 'medium',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    },
    {
      id: 'q2',
      title: 'Historical Essay',
      content: 'Discuss the causes and consequences of World War I. How did this conflict shape the political landscape of Europe in the 20th century?',
      imageUrl: 'https://example.com/ww1-map.jpg', // Sample image URL
      type: 'essay',
      points: 30,
      difficultyLevel: 'hard',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    },
    {
      id: 'q3',
      title: 'Scientific Method',
      content: 'Explain the steps of the scientific method and provide an example of how you would use it to investigate a hypothesis of your choice.',
      type: 'essay',
      points: 20,
      difficultyLevel: 'easy',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    }
  ];

  try {
    // Test PDF generation
    const pdfBlob = await ExamPDFService.generateExamPDF({
      title: 'Dru Education',
      testNumber: 'T001',
      className: 'Grade 10 - English',
      date: new Date().toLocaleDateString(),
      questions: sampleQuestions
    });

    console.log('✅ PDF Generated Successfully!');
    console.log('📄 PDF Size:', (pdfBlob.size / 1024).toFixed(2), 'KB');

    // Create download link for testing
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'test-exam-paper.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('📥 PDF Downloaded Successfully!');

    return {
      success: true,
      size: pdfBlob.size,
      message: 'PDF generation test completed successfully'
    };

  } catch (error) {
    console.error('❌ PDF Generation Failed:', error);
    return {
      success: false,
      error: error,
      message: 'PDF generation test failed'
    };
  }
};

// Function to test image loading
export const testImageLoading = async (imageUrl: string) => {
  try {
    console.log('🖼️ Testing image loading:', imageUrl);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    console.log('✅ Image loaded successfully:', blob.type, blob.size, 'bytes');
    
    return { success: true, type: blob.type, size: blob.size };
  } catch (error) {
    console.error('❌ Image loading failed:', error);
    return { success: false, error };
  }
};

// Function to validate PDF service integration
export const validatePDFService = () => {
  console.log('🔍 Validating PDF Service Integration...');
  
  const checks = {
    serviceExists: !!ExamPDFService,
    generateMethod: typeof ExamPDFService.generateExamPDF === 'function',
    uploadMethod: typeof ExamPDFService.uploadExamPDF === 'function',
    generateAndUploadMethod: typeof ExamPDFService.generateAndUploadExamPDF === 'function'
  };

  const allValid = Object.values(checks).every(check => check === true);
  
  console.log('📋 Validation Results:');
  console.log('- Service exists:', checks.serviceExists ? '✅' : '❌');
  console.log('- generateExamPDF method:', checks.generateMethod ? '✅' : '❌');
  console.log('- uploadExamPDF method:', checks.uploadMethod ? '✅' : '❌');
  console.log('- generateAndUploadExamPDF method:', checks.generateAndUploadMethod ? '✅' : '❌');
  console.log('- Overall validation:', allValid ? '✅ PASSED' : '❌ FAILED');

  return { ...checks, allValid };
};