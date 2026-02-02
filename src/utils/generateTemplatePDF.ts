import jsPDF from 'jspdf';
import { TestTemplate, TestQuestion } from '@/models/testSchema';

/**
 * Generate a PDF document from a test template with questions and answers
 */
export async function generateTemplatePDF(template: TestTemplate): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15; // Reduced margin for more space
  const contentWidth = pageWidth - (2 * margin);
  let yPosition = margin;

  console.log('📄 PDF Page dimensions:', pageWidth, 'x', pageHeight, 'mm');
  console.log('📏 Content width:', contentWidth, 'mm');

  // Helper function to check if we need a new page
  const checkNewPage = (requiredSpace: number = 20) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper function to add wrapped text
  const addWrappedText = (text: string, x: number, fontSize: number = 11, maxWidth: number = contentWidth, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, maxWidth);
    
    for (const line of lines) {
      checkNewPage();
      doc.text(line, x, yPosition);
      yPosition += fontSize * 0.5;
    }
  };

  // Helper function to load and add image to PDF - USE 95% OF PAGE WIDTH!
  const addImageToPDF = async (imageUrl: string, widthPercent: number = 0.95): Promise<boolean> => {
    try {
      console.log('📷 Loading image via proxy:', imageUrl);
      
      // Use the image proxy API to bypass CORS issues
      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
      
      // Load image through proxy
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous'; // Safe to use with our proxy
        
        image.onload = () => {
          console.log('✅ Image loaded via proxy, dimensions:', image.width, 'x', image.height, 'pixels');
          resolve(image);
        };
        
        image.onerror = (err) => {
          console.error('❌ Failed to load image via proxy:', err);
          reject(new Error('Failed to load image'));
        };
        
        image.src = proxyUrl;
      });

      // Create canvas to convert image to base64
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      // Draw image to canvas
      ctx.drawImage(img, 0, 0);
      
      // Convert canvas to base64
      const base64 = canvas.toDataURL('image/jpeg', 0.95);

      // Calculate dimensions - use widthPercent of contentWidth and maintain aspect ratio
      const aspectRatio = img.width / img.height;
      const pdfWidth = contentWidth * widthPercent;
      const pdfHeight = pdfWidth / aspectRatio;

      console.log('📐 PDF image size:', pdfWidth.toFixed(2), 'x', pdfHeight.toFixed(2), 'mm (using', (widthPercent * 100).toFixed(0) + '% of', contentWidth.toFixed(2), 'mm)');

      // Check if we need a new page for the image
      const requiredSpace = pdfHeight + 15;
      if (yPosition + requiredSpace > pageHeight - margin) {
        console.log('📄 Adding new page for image');
        doc.addPage();
        yPosition = margin;
      }

      // Center the image horizontally
      const xPosition = margin + (contentWidth - pdfWidth) / 2;

      // Add the image to PDF using base64
      doc.addImage(base64, 'JPEG', xPosition, yPosition, pdfWidth, pdfHeight);
      yPosition += pdfHeight + 10;

      console.log('✅ Image added to PDF at', xPosition.toFixed(2), ',', (yPosition - pdfHeight - 10).toFixed(2), 'with size', pdfWidth.toFixed(2), 'x', pdfHeight.toFixed(2), 'mm');
      return true;
    } catch (error) {
      console.error('❌ Failed to load image:', imageUrl, error);
      return false;
    }
  };

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(template.title, margin, yPosition);
  yPosition += 12;

  // Metadata
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Subject: ${template.subjectName || 'N/A'}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Total Questions: ${template.questions.length} | Total Marks: ${template.totalMarks}`, margin, yPosition);
  yPosition += 7;
  
  if (template.description) {
    doc.setTextColor(100, 100, 100);
    addWrappedText(template.description, margin, 10);
    yPosition += 5;
  }
  
  yPosition += 5;
  doc.setTextColor(0, 0, 0);

  // Separator line
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 12;

  // Instructions section
  if (template.instructions) {
    checkNewPage(30);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Instructions:', margin, yPosition);
    yPosition += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    addWrappedText(template.instructions, margin, 10);
    yPosition += 10;
  }

  // Questions section - process sequentially to handle async image loading
  for (let index = 0; index < template.questions.length; index++) {
    const question = template.questions[index];
    
    checkNewPage(50);
    
    // Question number and marks
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Question ${index + 1}`, margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`[${question.points || question.marks} marks]`, pageWidth - margin - 30, yPosition);
    yPosition += 10;

    // Use questionData if available (it contains full question details with images)
    const hasQuestionData = !!question.questionData;
    
    // Question text - prefer questionData content over direct fields
    const questionText = hasQuestionData 
      ? (question.questionData!.content || question.questionText || question.content || '')
      : (question.questionText || question.content || '');
    
    const questionImageUrl = hasQuestionData
      ? (question.questionData!.imageUrl || question.imageUrl)
      : question.imageUrl;
    
    if (questionText && questionText.trim()) {
      doc.setFontSize(11);
      addWrappedText(questionText, margin + 5, 11);
      yPosition += 5;
    }

    // Question image - embed VERY LARGE image (95% of page width!)
    if (questionImageUrl) {
      const imageLoaded = await addImageToPDF(questionImageUrl, 0.95);
      if (!imageLoaded) {
        doc.setFontSize(9);
        doc.setTextColor(200, 0, 0);
        doc.text('[Failed to load question image]', margin + 5, yPosition);
        yPosition += 8;
        doc.setTextColor(0, 0, 0);
      }
    }

    // MCQ Options
    if (question.questionType === 'mcq' || question.type === 'mcq') {
      yPosition += 10;
      
      // Use questionData options if available (they have image URLs), otherwise use simple options array
      const optionsData = hasQuestionData && question.questionData!.options 
        ? question.questionData!.options 
        : (question.options || []).map((opt: any, idx: number) => ({
            id: `opt-${idx}`,
            text: typeof opt === 'string' ? opt : (opt.text || opt.content || ''),
            imageUrl: typeof opt === 'object' ? opt.imageUrl : undefined
          }));
      
      // Find correct answer - try multiple fields and formats
      let correctIndex: number | undefined = question.correctOption;
      
      // If correctOption is undefined, try other fields
      if (correctIndex === undefined || correctIndex === null) {
        // Try correctAnswer field (might be a letter like "A", "B", "C", "D")
        let correctAnswer = (question as any).correctAnswer;
        
        if (typeof correctAnswer === 'string') {
          // Convert letter to index: "A" -> 0, "B" -> 1, etc.
          const letter = correctAnswer.toUpperCase().trim();
          if (letter.length === 1 && letter >= 'A' && letter <= 'Z') {
            correctIndex = letter.charCodeAt(0) - 'A'.charCodeAt(0);
            console.log('✅ Converted letter', letter, 'to index', correctIndex);
          }
        } else if (typeof correctAnswer === 'number') {
          correctIndex = correctAnswer;
        }
        
        // Try questionData
        if ((correctIndex === undefined || correctIndex === null) && hasQuestionData) {
          const qDataCorrectAnswer = (question.questionData as any)?.correctAnswer;
          if (typeof qDataCorrectAnswer === 'string') {
            const letter = qDataCorrectAnswer.toUpperCase().trim();
            if (letter.length === 1 && letter >= 'A' && letter <= 'Z') {
              correctIndex = letter.charCodeAt(0) - 'A'.charCodeAt(0);
            }
          } else if (typeof qDataCorrectAnswer === 'number') {
            correctIndex = qDataCorrectAnswer;
          }
        }
        
        // Last resort: check options for isCorrect flag
        if (correctIndex === undefined || correctIndex === null) {
          const correctOptionIndex = (question.options as any[])?.findIndex((opt: any) => {
            return typeof opt === 'object' && opt.isCorrect === true;
          });
          if (correctOptionIndex >= 0) {
            correctIndex = correctOptionIndex;
            console.log('✅ Found correct answer from isCorrect flag at index', correctIndex);
          }
        }
      }
      
      console.log('🎯 FINAL Correct Index:', correctIndex, '| Total Options:', optionsData.length);

      // Show correct answer PROMINENTLY at the top with background
      if (correctIndex !== undefined && correctIndex >= 0 && correctIndex < optionsData.length) {
        console.log('✅ Drawing green correct answer box for option', String.fromCharCode(65 + correctIndex));
        checkNewPage(20);
        
        // Draw a light green background box
        doc.setFillColor(220, 255, 220);
        doc.rect(margin, yPosition - 5, contentWidth, 12, 'F');
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 150, 0); // Bright green
        doc.text(`✓ CORRECT ANSWER: ${String.fromCharCode(65 + correctIndex)}`, margin + 10, yPosition + 5);
        yPosition += 15;
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
      } else {
        console.warn('⚠️ No valid correct index found. correctIndex =', correctIndex, 'optionsLength =', optionsData.length);
      }

      for (let optIndex = 0; optIndex < optionsData.length; optIndex++) {
        const option = optionsData[optIndex];
        checkNewPage(30);
        const isCorrect = optIndex === correctIndex;
        
        if (isCorrect) {
          console.log('✅ Option', String.fromCharCode(65 + optIndex), 'is CORRECT - should be green');
        }
        
        const optionText = option.text || '';
        const optionImageUrl = option.imageUrl;
        
        // Option label - show in green if correct
        doc.setFontSize(13);
        doc.setFont('helvetica', isCorrect ? 'bold' : 'normal');
        
        if (isCorrect) {
          doc.setFillColor(255, 255, 200); // Light yellow background
          doc.rect(margin + 5, yPosition - 5, 15, 8, 'F');
          doc.setTextColor(0, 150, 0); // Bright green for correct
          console.log('🎨 Setting option', String.fromCharCode(65 + optIndex), 'to GREEN');
        } else {
          doc.setTextColor(0, 0, 0); // Black for others
        }
        
        const optionLabel = `${String.fromCharCode(65 + optIndex)})`;
        doc.text(optionLabel, margin + 10, yPosition);
        
        // Only show text if it exists
        if (optionText && optionText.trim()) {
          doc.text(optionText, margin + 25, yPosition);
          yPosition += 8;
        } else {
          yPosition += 8;
        }
        
        doc.setTextColor(0, 0, 0);
        
        // Embed option image LARGE (90% of page width)
        if (optionImageUrl) {
          const imageLoaded = await addImageToPDF(optionImageUrl, 0.90);
          if (!imageLoaded) {
            doc.setFontSize(9);
            doc.setTextColor(200, 0, 0);
            doc.text('[Failed to load option image]', margin + 15, yPosition);
            yPosition += 6;
            doc.setTextColor(0, 0, 0);
          }
        }
        
        yPosition += 5;
      }
      
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
    }

    // Essay question indicator
    if (question.questionType === 'essay' || question.type === 'essay') {
      yPosition += 5;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('[Essay Answer - Student will write their response]', margin + 5, yPosition);
      yPosition += 8;
      doc.setTextColor(0, 0, 0);
    }

    // Explanation - use questionData if available
    const explanationText = hasQuestionData
      ? (question.questionData!.explanation || question.explanation)
      : question.explanation;
    
    const explanationImageUrl = hasQuestionData
      ? (question.questionData!.explanationImageUrl || question.explanationImageUrl)
      : question.explanationImageUrl;
    
    if (explanationText || explanationImageUrl) {
      yPosition += 8;
      checkNewPage(25);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 200);
      doc.text('Explanation:', margin + 5, yPosition);
      yPosition += 8;
      
      if (explanationText && explanationText.trim()) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        addWrappedText(explanationText, margin + 5, 10);
        yPosition += 3;
      }
      
      if (explanationImageUrl) {
        const imageLoaded = await addImageToPDF(explanationImageUrl, 0.95);
        if (!imageLoaded) {
          doc.setFontSize(9);
          doc.setTextColor(200, 0, 0);
          doc.text('[Failed to load explanation image]', margin + 5, yPosition);
          yPosition += 6;
        }
      }
      
      if (!explanationText && !explanationImageUrl) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text('No explanation provided', margin + 5, yPosition);
        yPosition += 6;
      }
      
      doc.setTextColor(0, 0, 0);
    }

    // Difficulty and topic
    yPosition += 5;
    if (question.difficultyLevel || question.topic) {
      checkNewPage(10);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      let metaText = '';
      if (question.difficultyLevel) metaText += `Difficulty: ${question.difficultyLevel}`;
      if (question.topic) metaText += (metaText ? ' | ' : '') + `Topic: ${question.topic}`;
      doc.text(metaText, margin + 5, yPosition);
      yPosition += 6;
      doc.setTextColor(0, 0, 0);
    }

    // Separator between questions
    yPosition += 8;
    checkNewPage(15);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;
  }

  // Footer on last page
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      `Generated: ${new Date().toLocaleDateString('en-AU')}`,
      pageWidth - margin,
      pageHeight - 10,
      { align: 'right' }
    );
  }

  // Download the PDF
  const fileName = `${template.title.replace(/[^a-z0-9]/gi, '_')}_Questions.pdf`;
  doc.save(fileName);
}
