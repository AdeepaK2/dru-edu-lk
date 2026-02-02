import jsPDF from 'jspdf';
import { TestTemplate, TestQuestion } from '@/models/testSchema';

/**
 * Generate a PDF document from a test template with questions and answers
 */
export async function generateTemplatePDF(template: TestTemplate): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (2 * margin);
  let yPosition = margin;

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

  // Helper function to load and add image to PDF
  const addImageToPDF = async (imageUrl: string, maxWidth: number = contentWidth - 10, maxHeight: number = 80): Promise<boolean> => {
    try {
      console.log('📷 Loading image via proxy:', imageUrl);
      
      // Use the image proxy API to bypass CORS issues
      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
      
      // Load image through proxy
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous'; // Safe to use with our proxy
        
        image.onload = () => {
          console.log('✅ Image loaded via proxy, dimensions:', image.width, 'x', image.height);
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

      // Calculate scaled dimensions to fit within maxWidth and maxHeight
      let width = img.width;
      let height = img.height;
      const aspectRatio = width / height;

      if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
      }

      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }

      // Convert to PDF units (mm)
      const pdfWidth = width * 0.264583; // pixels to mm
      const pdfHeight = height * 0.264583;

      // Check if we need a new page for the image
      checkNewPage(pdfHeight + 10);

      // Add the image to PDF using base64
      doc.addImage(base64, 'JPEG', margin + 5, yPosition, pdfWidth, pdfHeight);
      yPosition += pdfHeight + 5;

      console.log('✅ Image added to PDF');
      return true;
    } catch (error) {
      console.error('❌ Failed to load image:', imageUrl, error);
      return false;
    }
  };

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(template.title, margin, yPosition);
  yPosition += 10;

  // Metadata
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Subject: ${template.subjectName || 'N/A'}`, margin, yPosition);
  yPosition += 6;
  doc.text(`Total Questions: ${template.questions.length}`, margin, yPosition);
  yPosition += 6;
  doc.text(`Total Marks: ${template.totalMarks}`, margin, yPosition);
  yPosition += 6;
  
  if (template.description) {
    doc.text(`Description: ${template.description}`, margin, yPosition);
    yPosition += 6;
  }
  
  yPosition += 5;
  doc.setTextColor(0, 0, 0);

  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Instructions section
  if (template.instructions) {
    checkNewPage(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Instructions:', margin, yPosition);
    yPosition += 8;
    
    addWrappedText(template.instructions, margin, 10);
    yPosition += 10;
  }

  // Questions section - process sequentially to handle async image loading
  for (let index = 0; index < template.questions.length; index++) {
    const question = template.questions[index];
    
    checkNewPage(40);
    
    // Question number and marks
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Question ${index + 1}`, margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(`[${question.points || question.marks} marks]`, pageWidth - margin - 30, yPosition);
    yPosition += 8;

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
      addWrappedText(questionText, margin + 5, 11);
      yPosition += 5;
    }

    // Question image - embed actual image
    if (questionImageUrl) {
      const imageLoaded = await addImageToPDF(questionImageUrl);
      if (!imageLoaded) {
        doc.setFontSize(9);
        doc.setTextColor(200, 0, 0);
        doc.text('[Failed to load question image]', margin + 5, yPosition);
        yPosition += 6;
        doc.setTextColor(0, 0, 0);
      }
    }

    // MCQ Options
    if (question.questionType === 'mcq' || question.type === 'mcq') {
      yPosition += 3;
      
      // Use questionData options if available (they have image URLs), otherwise use simple options array
      const optionsData = hasQuestionData && question.questionData!.options 
        ? question.questionData!.options 
        : (question.options || []).map((opt: any, idx: number) => ({
            id: `opt-${idx}`,
            text: typeof opt === 'string' ? opt : (opt.text || opt.content || ''),
            imageUrl: typeof opt === 'object' ? opt.imageUrl : undefined
          }));
      
      const correctIndex = question.correctOption;

      for (let optIndex = 0; optIndex < optionsData.length; optIndex++) {
        const option = optionsData[optIndex];
        checkNewPage(15);
        const isCorrect = optIndex === correctIndex;
        
        const optionText = option.text || '';
        const optionImageUrl = option.imageUrl;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', isCorrect ? 'bold' : 'normal');
        
        // Option label
        if (isCorrect) {
          doc.setTextColor(0, 128, 0); // Green for correct answer
          const optionLabel = `${String.fromCharCode(65 + optIndex)}) ${optionText || '[Image option]'} ✓ CORRECT`;
          addWrappedText(optionLabel, margin + 10, 10, contentWidth - 15, true);
        } else {
          doc.setTextColor(0, 0, 0);
          const optionLabel = `${String.fromCharCode(65 + optIndex)}) ${optionText || '[Image option]'}`;
          addWrappedText(optionLabel, margin + 10, 10, contentWidth - 15);
        }
        
        // Embed option image if available
        if (optionImageUrl) {
          const imageLoaded = await addImageToPDF(optionImageUrl, contentWidth - 20, 60);
          if (!imageLoaded) {
            doc.setFontSize(8);
            doc.setTextColor(200, 0, 0);
            doc.text('   [Failed to load option image]', margin + 10, yPosition);
            yPosition += 5;
          }
        }
        
        doc.setTextColor(0, 0, 0);
        yPosition += 2;
      }
      
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
    }

    // Essay question indicator
    if (question.questionType === 'essay' || question.type === 'essay') {
      yPosition += 3;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('[Essay Answer - Student will write their response]', margin + 5, yPosition);
      yPosition += 6;
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
      yPosition += 5;
      checkNewPage(20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 200);
      doc.text('Explanation:', margin + 5, yPosition);
      yPosition += 6;
      
      if (explanationText && explanationText.trim()) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        addWrappedText(explanationText, margin + 5, 9);
      }
      
      if (explanationImageUrl) {
        const imageLoaded = await addImageToPDF(explanationImageUrl);
        if (!imageLoaded) {
          doc.setFontSize(9);
          doc.setTextColor(200, 0, 0);
          doc.text('[Failed to load explanation image]', margin + 5, yPosition);
          yPosition += 5;
        }
      }
      
      if (!explanationText && !explanationImageUrl) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text('No explanation provided', margin + 5, yPosition);
        yPosition += 5;
      }
      
      doc.setTextColor(0, 0, 0);
    }

    // Difficulty and topic
    yPosition += 3;
    if (question.difficultyLevel || question.topic) {
      checkNewPage(10);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      let metaText = '';
      if (question.difficultyLevel) metaText += `Difficulty: ${question.difficultyLevel}`;
      if (question.topic) metaText += (metaText ? ' | ' : '') + `Topic: ${question.topic}`;
      doc.text(metaText, margin + 5, yPosition);
      yPosition += 5;
      doc.setTextColor(0, 0, 0);
    }

    // Separator between questions
    yPosition += 5;
    checkNewPage(10);
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;
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
