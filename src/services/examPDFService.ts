import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { EssayQuestion } from '@/models/questionBankSchema';

export interface ExamPDFOptions {
  title: string;
  testNumber: string;
  className: string;
  date: string;
  questions: EssayQuestion[];
  // Image display options
  imageSettings?: {
    maxImageHeight?: number; // Maximum image height in mm (default: 80)
    useFullPageForImages?: boolean; // Use full page for each question image
    largeImageMode?: boolean; // Enable larger images (up to 200mm height)
  };
}

export class ExamPDFService {
  /**
   * Generate exam PDF for essay questions
   */
  static async generateExamPDF(options: ExamPDFOptions): Promise<Blob> {
    const { title, testNumber, className, date, questions, imageSettings } = options;

    // Image settings with defaults - Much larger images
    const imgSettings = {
      maxImageHeight: imageSettings?.maxImageHeight || (imageSettings?.largeImageMode ? 280 : 150), // Increased from 200:80 to 280:150
      useFullPageForImages: imageSettings?.useFullPageForImages || false,
      largeImageMode: imageSettings?.largeImageMode || false
    };

    console.log('📄 Starting PDF generation with options:', {
      title,
      testNumber,
      className,
      date,
      questionCount: questions.length,
      imageSettings: imgSettings
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

    // Load logo
    let logoData: string | null = null;
    try {
      logoData = await this.loadImageAsBase64('/Logo.png');
      console.log('✅ Logo loaded successfully');
    } catch (error) {
      console.warn('⚠️ Failed to load logo:', error);
    }

    // Function to add header with logo and border to each page
    const addPageHeader = (isFirstPage: boolean = false) => {
      // Add paper-like background
      pdf.setFillColor(252, 252, 248); // Slightly off-white paper color
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      // Add subtle paper texture (light grid pattern)
      pdf.setDrawColor(245, 245, 240);
      pdf.setLineWidth(0.1);

      // Add very subtle horizontal lines to simulate paper texture
      for (let y = 10; y < pageHeight; y += 15) {
        pdf.line(5, y, pageWidth - 5, y);
      }

      // Add main content border with rounded corners effect
      pdf.setDrawColor(0, 0, 0); // Black border
      pdf.setLineWidth(0.8);
      pdf.setFillColor(255, 255, 255); // White fill for content area
      pdf.roundedRect(margin - 8, margin - 8, pageWidth - (margin * 2) + 16, pageHeight - (margin * 2) + 16, 3, 3, 'FD');

      // Add logo at the top - centered on first page, left on others
      if (logoData) {
        try {
          const logoSize = 20; // Square size for circular logo
          let logoX;

          if (isFirstPage) {
            // Center logo on first page
            logoX = (pageWidth - logoSize) / 2;
          } else {
            // Left align logo on other pages
            logoX = margin - 5;
          }

          const logoY = margin - 2;

          // Add the circular logo directly (no background needed since logo has transparent background)
          pdf.addImage(logoData, 'PNG', logoX, logoY, logoSize, logoSize);
          currentY = margin + logoSize + 8;
        } catch (error) {
          console.warn('⚠️ Failed to add logo to page:', error);
          currentY = margin + 5;
        }
      } else {
        currentY = margin + 5;
      }

      if (isFirstPage) {
        // Add title page content only on first page - more compact layout
        pdf.setFontSize(20); // Reduced from 24
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(51, 51, 51); // Dark gray text
        const titleText = 'Dru Education';
        const titleWidth = pdf.getTextWidth(titleText);
        pdf.text(titleText, (pageWidth - titleWidth) / 2, currentY);

        currentY += 12; // Reduced from 15

        // Add test number
        pdf.setFontSize(14); // Reduced from 16
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(102, 102, 102); // Medium gray text
        const testNumberText = `Test No: ${testNumber}`;
        const testNumberWidth = pdf.getTextWidth(testNumberText);
        pdf.text(testNumberText, (pageWidth - testNumberWidth) / 2, currentY);

        currentY += 8; // Reduced from 10

        // Add class and date
        pdf.setFontSize(11); // Reduced from 12
        pdf.setTextColor(102, 102, 102);
        const classDateText = `${className} - ${date}`;
        const classDateWidth = pdf.getTextWidth(classDateText);
        pdf.text(classDateText, (pageWidth - classDateWidth) / 2, currentY);

        currentY += 15; // Reduced from 25

        // Add student name section - more compact
        pdf.setFontSize(11); // Reduced from 12
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(51, 51, 51);
        const nameLabel = 'Student Name:';
        pdf.text(nameLabel, margin, currentY);

        // Add underline for student to write name
        const nameStartX = margin + pdf.getTextWidth(nameLabel) + 5;
        const underlineLength = 60; // Reduced from 80
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.line(nameStartX, currentY + 2, nameStartX + underlineLength, currentY + 2);

        currentY += 12; // Reduced from 20
      }
    };

    // Add first page with header
    addPageHeader(true);

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
      // For the first question, allow much more space usage before forcing a page break
      const spaceThreshold = i === 0 ? 200 : 100; // Much more lenient for first question
      if (currentY > pageHeight - spaceThreshold) { // Leave space for question content
        pdf.addPage();
        addPageHeader(false);
      }

      // Add question number
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(31, 31, 31); // Very dark gray for prominence

      pdf.text(`${i + 1}.`, margin, currentY);
      pdf.setTextColor(51, 51, 51); // Reset to normal text color
      currentY += 12;

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
                
                if (imgSettings.useFullPageForImages) {
                  // Full page mode: Use entire page for the image
                  pdf.addPage();
                  addPageHeader(false);
                  
                  // Calculate dimensions for full page (with minimal margins)
                  const fullPageWidth = contentWidth + 20; // Use more width
                  const fullPageHeight = pageHeight - margin * 2 - 40; // Reduced header space from 60 to 40
                  
                  let imgWidth = fullPageWidth;
                  let imgHeight = fullPageWidth / imgAspectRatio;
                  
                  if (imgHeight > fullPageHeight) {
                    imgHeight = fullPageHeight;
                    imgWidth = fullPageHeight * imgAspectRatio;
                  }
                  
                  // Center the image on the page
                  const centerX = (pageWidth - imgWidth) / 2;
                  const startY = margin + 30; // Reduced from 50 to 30
                  
                  pdf.addImage(imgData, 'JPEG', centerX, startY, imgWidth, imgHeight);
                  
                  // Add a note about the image
                  pdf.setFontSize(10);
                  pdf.setFont('helvetica', 'italic');
                  pdf.setTextColor(100, 100, 100);
                  const imageNote = `Question ${i + 1} - Image (Full Page Display)`;
                  const noteWidth = pdf.getTextWidth(imageNote);
                  pdf.text(imageNote, (pageWidth - noteWidth) / 2, startY + imgHeight + 15);
                  pdf.setTextColor(51, 51, 51);
                  pdf.setFont('helvetica', 'normal');
                  
                  console.log(`✅ Full-page image loaded successfully for question ${i + 1}`);
                } else {
                  // Standard mode with much larger sizing
                  const maxImgWidth = contentWidth - 10; // Reduced margin from 20 to 10
                  const maxImgHeight = imgSettings.maxImageHeight;

                  let imgWidth = maxImgWidth;
                  let imgHeight = maxImgWidth / imgAspectRatio;

                  if (imgHeight > maxImgHeight) {
                    imgHeight = maxImgHeight;
                    imgWidth = maxImgHeight * imgAspectRatio;
                  }

                  // Check if image fits on current page
                  // For the first question, be much more lenient with space requirements
                  const minSpaceRequired = i === 0 ? 80 : 20; // Much less strict for first question
                  if (currentY + imgHeight > pageHeight - margin - minSpaceRequired) {
                    // Only add a new page if it's not the first question or if the image is extremely large
                    if (i > 0 || imgHeight > pageHeight - margin - 120) {
                      pdf.addPage();
                      addPageHeader(false);
                    }
                    // For first question with large image, allow it to extend much further down the page
                  }

                  // Center the image horizontally
                  const centerX = (pageWidth - imgWidth) / 2;
                  pdf.addImage(imgData, 'JPEG', centerX, currentY, imgWidth, imgHeight);
                  currentY += imgHeight + 20; // Increased spacing from 15 to 20
                  
                  console.log(`✅ Image loaded successfully for question ${i + 1} (${imgWidth.toFixed(1)}x${imgHeight.toFixed(1)} mm)`);
                }
                
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
        pdf.setTextColor(51, 51, 51); // Dark gray for better readability

        const lines = pdf.splitTextToSize(question.content, contentWidth - 10);
        pdf.text(lines, margin + 10, currentY);
        currentY += (lines.length * 6) + 12; // Slightly more spacing for better readability
      }

      // Add blank page for student answers
      pdf.addPage();
      addPageHeader(false);

      // Add "Answer Space" header on the blank page with enhanced styling
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(31, 31, 31);

      const answerText = `Answer for Question ${i + 1}`;
      const answerWidth = pdf.getTextWidth(answerText);

      // Add subtle background for answer header
      pdf.setFillColor(245, 245, 245);
      pdf.roundedRect((pageWidth - answerWidth) / 2 - 5, currentY - 4, answerWidth + 10, 10, 2, 2, 'F');

      pdf.text(answerText, (pageWidth - answerWidth) / 2, currentY);
      pdf.setTextColor(51, 51, 51); // Reset text color
      currentY += 25;

      // Add some lines for writing (notebook-style ruled paper)
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const lineSpacing = 10; // Slightly larger spacing for better writing
      const maxLines = Math.floor((pageHeight - currentY - margin - 10) / lineSpacing);

      // Add margin line on the left
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.2);
      pdf.line(margin - 3, currentY, margin - 3, currentY + (maxLines * lineSpacing));

      // Add main writing lines
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.3);
      for (let line = 0; line < maxLines; line++) {
        const lineY = currentY + (line * lineSpacing);
        pdf.line(margin, lineY, pageWidth - margin, lineY);

        // Add subtle dots at the beginning of each line (like some notebooks)
        if (line % 2 === 0) {
          pdf.setFillColor(150, 150, 150);
          pdf.circle(margin - 1, lineY, 0.3, 'F');
        }
      }

      // Start new page for next question (if not the last question)
      if (i < questions.length - 1) {
        pdf.addPage();
        addPageHeader(false);
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
          
          // Fill with white background first to handle transparency
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/png'); // Keep as PNG to preserve transparency
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

  /**
   * Delete exam PDF from Firebase Storage
   */
  static async deleteExamPDF(examPdfUrl: string): Promise<void> {
    try {
      console.log('🗑️ Deleting exam PDF from Firebase Storage:', examPdfUrl);
      const { ref, deleteObject } = await import('firebase/storage');
      const { storage } = await import('@/utils/firebase-client');

      // Extract the file path from the URL
      const url = new URL(examPdfUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
      
      if (!pathMatch) {
        throw new Error('Invalid exam PDF URL format');
      }

      const filePath = decodeURIComponent(pathMatch[1]);
      const storageRef = ref(storage, filePath);
      
      await deleteObject(storageRef);
      console.log('✅ Exam PDF deleted successfully from Firebase Storage');
    } catch (error) {
      console.error('❌ Error deleting exam PDF:', error);
      // Don't throw error as this shouldn't prevent test deletion
      console.warn('⚠️ Continuing with test deletion despite PDF deletion failure');
    }
  }

  /**
   * Generate exam PDF with large images (up to 280mm height)
   */
  static async generateExamPDFWithLargeImages(options: Omit<ExamPDFOptions, 'imageSettings'>): Promise<Blob> {
    return this.generateExamPDF({
      ...options,
      imageSettings: {
        largeImageMode: true,
        maxImageHeight: 280
      }
    });
  }

  /**
   * Generate exam PDF with full-page images (one page per image)
   */
  static async generateExamPDFWithFullPageImages(options: Omit<ExamPDFOptions, 'imageSettings'>): Promise<Blob> {
    return this.generateExamPDF({
      ...options,
      imageSettings: {
        useFullPageForImages: true,
        largeImageMode: true
      }
    });
  }

  /**
   * Generate exam PDF with extra large images (up to 350mm height)
   */
  static async generateExamPDFWithExtraLargeImages(options: Omit<ExamPDFOptions, 'imageSettings'>): Promise<Blob> {
    return this.generateExamPDF({
      ...options,
      imageSettings: {
        largeImageMode: true,
        maxImageHeight: 350
      }
    });
  }

  /**
   * Generate exam PDF with custom image settings
   */
  static async generateExamPDFWithCustomImageSettings(
    options: Omit<ExamPDFOptions, 'imageSettings'>,
    maxImageHeight: number,
    useFullPageForImages: boolean = false
  ): Promise<Blob> {
    return this.generateExamPDF({
      ...options,
      imageSettings: {
        maxImageHeight,
        useFullPageForImages,
        largeImageMode: maxImageHeight > 100
      }
    });
  }
}