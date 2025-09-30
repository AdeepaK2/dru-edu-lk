// Server-Sent Events endpoint for real-time background submission monitoring
import { NextRequest } from 'next/server';
import { BackgroundSubmissionService } from '@/apiservices/backgroundSubmissionService';

export async function GET(request: NextRequest) {
  // Verify admin access (you can expand this with proper auth)
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Create ReadableStream for Server-Sent Events
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const data = `data: ${JSON.stringify({
        type: 'connected',
        message: 'Connected to background submission monitor',
        timestamp: new Date().toISOString()
      })}\n\n`;
      controller.enqueue(encoder.encode(data));

      // Set up periodic monitoring
      const intervalId = setInterval(async () => {
        try {
          // Get current status report
          const report = await BackgroundSubmissionService.getExpiredAttemptsReport();
          
          const statusUpdate = {
            type: 'status',
            data: {
              totalExpired: report.totalExpired,
              byTestType: report.byTestType,
              oldestExpired: report.oldestExpired,
              lastChecked: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
          };

          const data = `data: ${JSON.stringify(statusUpdate)}\n\n`;
          controller.enqueue(encoder.encode(data));

          // If there are expired attempts, trigger processing and report progress
          if (report.totalExpired > 0) {
            const processResults = await BackgroundSubmissionService.processExpiredAttempts();
            
            const processUpdate = {
              type: 'processing_complete',
              data: {
                processed: processResults.processed,
                successful: processResults.successful,
                failed: processResults.failed,
                errors: processResults.errors
              },
              timestamp: new Date().toISOString()
            };

            const processData = `data: ${JSON.stringify(processUpdate)}\n\n`;
            controller.enqueue(encoder.encode(processData));
          }

        } catch (error) {
          const errorUpdate = {
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          };

          const data = `data: ${JSON.stringify(errorUpdate)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      }, 30000); // Check every 30 seconds

      // Cleanup function
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization'
    }
  });
}