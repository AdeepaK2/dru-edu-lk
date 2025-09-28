import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { EssayQuestion } from '@/models/questionBankSchema';

export interface ExamPDFOptions {
  title: string;
  testNumber: string;
  className: string;
  date: string;
  questions: EssayQuestion[];
}

export class ExamPDFService {
  /**
   * Generate exam PDF for essay questions
   */
  static async generateExamPDF(options: ExamPDFOptions): Promise<Blob> {
    const { title, testNumber, className, date, questions } = options;

    console.log('📄 Starting PDF generation with options:', {
      title,
      testNumber,
      className,
      date,
      questionCount: questions.length
    });

    // Create a new jsPDF instance
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let currentY = margin;

    // Add title page
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    const titleText = 'Dru Education';
    const titleWidth = pdf.getTextWidth(titleText);
    pdf.text(titleText, (pageWidth - titleWidth) / 2, currentY);

    currentY += 15;

    // Add test number
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'normal');
    const testNumberText = `Test No: ${testNumber}`;
    const testNumberWidth = pdf.getTextWidth(testNumberText);
    pdf.text(testNumberText, (pageWidth - testNumberWidth) / 2, currentY);

    currentY += 10;

    // Add class and date
    pdf.setFontSize(12);
    const classDateText = `${className} - ${date}`;
    const classDateWidth = pdf.getTextWidth(classDateText);
    pdf.text(classDateText, (pageWidth - classDateWidth) / 2, currentY);

    currentY += 20;

    // Process each question
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      console.log(`📝 Processing question ${i + 1}/${questions.length}:`, {
        id: question.id,
        hasImage: !!question.imageUrl,
        hasContent: !!question.content,
        title: question.title
      });

      // Check if we need a new page for the question
      if (currentY > pageHeight - 100) { // Leave space for question content
        pdf.addPage();
        currentY = margin;
      }

      // Add question number
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${i + 1}.`, margin, currentY);
      currentY += 10;

      // Add question image if available
      if (question.imageUrl) {
        try {
          console.log(`🖼️ Loading image for question ${i + 1}:`, question.imageUrl);
          const imgData = await this.loadImageAsBase64(question.imageUrl);
          
          // Create image element to get dimensions
          const img = new Image();
          img.src = imgData;

          await new Promise<void>((resolve) => {
            img.onload = () => {
              try {
                const imgAspectRatio = img.width / img.height;
                const maxImgWidth = contentWidth - 20; // Leave some margin
                const maxImgHeight = 80; // Limit image height

                let imgWidth = maxImgWidth;
                let imgHeight = maxImgWidth / imgAspectRatio;

                if (imgHeight > maxImgHeight) {
                  imgHeight = maxImgHeight;
                  imgWidth = maxImgHeight * imgAspectRatio;
                }

                // Check if image fits on current page
                if (currentY + imgHeight > pageHeight - margin - 20) {
                  pdf.addPage();
                  currentY = margin;
                }

                // Add the image to PDF
                pdf.addImage(imgData, 'JPEG', margin + 10, currentY, imgWidth, imgHeight);
                currentY += imgHeight + 15;
                console.log(`✅ Image loaded successfully for question ${i + 1}`);
                resolve();
              } catch (error) {
                console.error(`❌ Error adding image to PDF for question ${i + 1}:`, error);
                resolve();
              }
            };
            
            img.onerror = () => {
              console.warn(`⚠️ Failed to load image for question ${i + 1}, skipping`);
              resolve();
            };
          });
        } catch (error) {
          console.error(`❌ Error loading question image for question ${i + 1}:`, error);
          // Add a placeholder text instead of the image
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(150, 150, 150);
          pdf.text('[Image could not be loaded]', margin + 10, currentY);
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'normal');
          currentY += 15;
        }
      }

      // Add question text content if available
      if (question.content) {
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');

        const lines = pdf.splitTextToSize(question.content, contentWidth - 10);
        pdf.text(lines, margin + 10, currentY);
        currentY += (lines.length * 5) + 10;
      }

      // Add blank page for student answers
      pdf.addPage();
      currentY = margin;

      // Add "Answer Space" header on the blank page
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      const answerText = `Answer for Question ${i + 1}`;
      pdf.text(answerText, margin, currentY);
      currentY += 20;

      // Add some lines for writing
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const lineSpacing = 8;
      const maxLines = Math.floor((pageHeight - currentY - margin) / lineSpacing);

      for (let line = 0; line < maxLines; line++) {
        const lineY = currentY + (line * lineSpacing);
        pdf.line(margin, lineY, pageWidth - margin, lineY);
      }

      // Start new page for next question (if not the last question)
      if (i < questions.length - 1) {
        pdf.addPage();
        currentY = margin;
      }
    }

    console.log('✅ PDF generation completed successfully');
    
    // Return the PDF as a blob
    return pdf.output('blob');
  }

  /**
   * Load image from URL and convert to base64
   */
  private static async loadImageAsBase64(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log('🔄 Loading image from URL:', url);
      
      // Check if this is a Firebase Storage URL that needs proxying
      const isFirebaseStorage = url.includes('firebasestorage.googleapis.com');
      const imageUrl = isFirebaseStorage 
        ? `/api/image-proxy?url=${encodeURIComponent(url)}`
        : url;
      
      console.log('🔄 Using URL:', imageUrl, isFirebaseStorage ? '(proxied)' : '(direct)');
      
      // Method 1: Try direct image loading
      const img = new Image();
      if (!isFirebaseStorage) {
        img.crossOrigin = 'anonymous';
      }
      
      img.onload = () => {
        try {
          console.log('✅ Image loaded successfully, converting to base64...');
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Could not get canvas context');
          }
          
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/jpeg', 0.8);
          console.log('✅ Image converted to base64 successfully');
          resolve(dataURL);
        } catch (canvasError) {
          console.error('❌ Canvas conversion error:', canvasError);
          reject(canvasError);
        }
      };
      
      img.onerror = (error) => {
        console.error('❌ Image loading failed:', error);
        reject(new Error(`Failed to load image: ${url}`));
      };
      
      img.src = imageUrl;
    });
  }

  /**
   * Upload PDF to Firebase Storage
   */
  static async uploadExamPDF(pdfBlob: Blob, fileName: string): Promise<string> {
    try {
      console.log('📤 Uploading exam PDF to Firebase Storage...', fileName);
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('@/utils/firebase-client');

      const storageRef = ref(storage, `exams/${fileName}.pdf`);
      
      console.log('📤 Uploading PDF blob, size:', (pdfBlob.size / 1024).toFixed(2), 'KB');
      const uploadResult = await uploadBytes(storageRef, pdfBlob);
      
      console.log('📤 Upload completed, getting download URL...');
      const downloadURL = await getDownloadURL(uploadResult.ref);
      
      console.log('✅ PDF uploaded successfully:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('❌ Error uploading exam PDF:', error);
      throw error;
    }
  }

  /**
   * Generate and download exam PDF locally (temporary solution)
   */
  static async generateAndDownloadExamPDF(options: ExamPDFOptions): Promise<string> {
    try {
      const pdfBlob = await this.generateExamPDF(options);
      const fileName = `exam_${options.testNumber}_${Date.now()}.pdf`;
      
      // Create blob URL for temporary access
      const blobUrl = URL.createObjectURL(pdfBlob);
      
      // Auto-download the file
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Keep the blob URL for preview purposes
      console.log('✅ PDF generated and downloaded:', fileName);
      return blobUrl;
    } catch (error) {
      console.error('❌ Error generating and downloading exam PDF:', error);
      throw error;
    }
  }

  /**
   * Generate and upload exam PDF in one call
   */
  static async generateAndUploadExamPDF(options: ExamPDFOptions): Promise<string> {
    try {
      // First try to upload to Firebase
      const pdfBlob = await this.generateExamPDF(options);
      const fileName = `exam_${options.testNumber}_${Date.now()}`;
      return await this.uploadExamPDF(pdfBlob, fileName);
    } catch (uploadError) {
      console.warn('⚠️ Firebase upload failed, falling back to local download:', uploadError);
      // Fallback to local download
      return await this.generateAndDownloadExamPDF(options);
    }
  }
}