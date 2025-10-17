import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import PQueue from 'p-queue';

export interface PDFSummary {
  summary: string;
  keyPoints: string[];
  wordCount: number;
  estimatedReadingTime: number;
}

// Retry function with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit error (429) or other retryable error
      const isRetryable = error?.status === 429 || error?.code === 'RESOURCE_EXHAUSTED' || error?.message?.includes('rate limit');

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: baseDelay * 2^attempt
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Initialize Gemini AI with server-side environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Queue to process AI requests sequentially
const aiQueue = new PQueue({ concurrency: 1 });

export async function POST(request: NextRequest) {
  try {
    const { text, title } = await request.json();

    console.log('API Key check:', !!process.env.GEMINI_KEY);
    console.log('API Key length:', process.env.GEMINI_KEY?.length);

    if (!process.env.GEMINI_KEY) {
      console.error('Gemini API key not configured on server');
      return NextResponse.json(
        { error: 'Gemini API key not configured on server' },
        { status: 500 }
      );
    }

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: 'Insufficient text content for summarization' },
        { status: 400 }
      );
    }

    // Truncate text if too long (Gemini has token limits)
    const maxLength = 10000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

    const prompt = `
Please analyze and summarize the following ${title ? `"${title}"` : 'document'}. Provide a comprehensive summary that captures the main ideas, key concepts, and important details.

Document Content:
${truncatedText}

Please provide:
1. A concise summary (2-3 paragraphs)
2. Key points (3-5 bullet points)
3. Word count of the original text
4. Estimated reading time in minutes

Return ONLY a valid JSON object with the following exact structure, no markdown formatting, no code blocks, no additional text:

{"summary": "your summary here", "keyPoints": ["point 1", "point 2", "point 3"], "wordCount": 1234, "estimatedReadingTime": 5}
`;

    const result = await aiQueue.add(async () => retryWithBackoff(async () => {
      const res = await model.generateContent(prompt);
      return res;
    }));
    const response = await result.response;
    let responseText = response.text();

    console.log('Gemini response:', responseText);

    // Clean up the response text - remove any potential markdown or extra text
    responseText = responseText.trim();

    // If the response starts with markdown code blocks, extract the JSON
    if (responseText.startsWith('```')) {
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        responseText = jsonMatch[1];
      }
    }

    // Parse the JSON response
    let summaryData;
    try {
      summaryData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      console.error('Response text:', responseText);

      // Try to extract JSON from the text more aggressively
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonString = responseText.substring(jsonStart, jsonEnd + 1);
        try {
          summaryData = JSON.parse(jsonString);
          console.log('Successfully parsed JSON from extracted string');
        } catch (secondParseError) {
          console.error('Failed to parse extracted JSON:', secondParseError);
          throw new Error('Invalid JSON response from Gemini API');
        }
      } else {
        throw new Error('No valid JSON found in Gemini response');
      }
    }

    const summary: PDFSummary = {
      summary: summaryData.summary || 'Summary not available',
      keyPoints: Array.isArray(summaryData.keyPoints) ? summaryData.keyPoints : [],
      wordCount: summaryData.wordCount || text.split(/\s+/).length,
      estimatedReadingTime: summaryData.estimatedReadingTime || Math.ceil(text.split(/\s+/).length / 200)
    };

    return NextResponse.json(summary);

  } catch (error) {
    console.error('Error generating PDF summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary. Please try again.' },
      { status: 500 }
    );
  }
}