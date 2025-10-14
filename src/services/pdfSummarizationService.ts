export interface PDFSummary {
  summary: string;
  keyPoints: string[];
  wordCount: number;
  estimatedReadingTime: number;
}

export class PDFSummarizationService {
  /**
   * Extract text content from PDF document
   */
  static async extractTextFromPDF(pdfDocument: any): Promise<string> {
    try {
      let fullText = '';

      // Get total number of pages
      const numPages = pdfDocument.numPages;

      // Extract text from each page
      for (let pageNum = 1; pageNum <= Math.min(numPages, 10); pageNum++) { // Limit to first 10 pages for performance
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        fullText += pageText + '\n\n';
      }

      return fullText.trim();
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  /**
   * Generate summary using Gemini AI via API route
   */
  static async generateSummary(text: string, title?: string): Promise<PDFSummary> {
    try {
      console.log('Calling /api/summarize-pdf with text length:', text.length);

      const response = await fetch('/api/summarize-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, title }),
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API error response:', errorData);
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const summary = await response.json();
      console.log('API response summary:', summary);
      return summary;

    } catch (error) {
      console.error('Error generating PDF summary:', error);
      throw new Error('Failed to generate summary. Please try again.');
    }
  }

  /**
   * Complete workflow: extract text and generate summary
   */
  static async summarizePDF(pdfDocument: any, title?: string): Promise<PDFSummary> {
    try {
      // Extract text from PDF
      const extractedText = await this.extractTextFromPDF(pdfDocument);

      if (!extractedText || extractedText.trim().length < 50) {
        throw new Error('The PDF does not contain enough readable text for summarization');
      }

      // Generate summary using AI
      const summary = await this.generateSummary(extractedText, title);

      return summary;
    } catch (error) {
      console.error('Error summarizing PDF:', error);
      throw error;
    }
  }
}