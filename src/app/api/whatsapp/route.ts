import { NextRequest, NextResponse } from 'next/server';

// Green API configuration
const GREEN_API_URL = process.env.GREEN_API;
const MEDIA_API_URL = process.env.MEDIA_API;
const GREEN_ID = process.env.GREEN_ID;
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN;

// Validate environment variables
if (!GREEN_API_URL || !MEDIA_API_URL || !GREEN_ID || !GREEN_API_TOKEN) {
  console.error('Missing Green API environment variables');
}

interface WhatsAppMessageRequest {
  recipients: {
    phone: string;
    name: string;
    type: 'student' | 'parent';
    studentName?: string; // For parent messages
  }[];
  message: string;
  teacherName: string;
  className: string;
  file?: {
    name: string;
    data: string; // base64 encoded file data
    mimeType: string;
  };
}

interface GreenApiResponse {
  idMessage: string;
  statusMessage: string;
}

// Format WhatsApp message with header
function formatWhatsAppMessage(
  originalMessage: string, 
  teacherName: string, 
  className: string, 
  recipientType: 'student' | 'parent',
  studentName?: string
): string {
  // Check if we're using fallback data (DRU Education as sender or document management)
  const isFallback = teacherName === 'DRU Education' || className === 'Document Management';
  
  if (isFallback) {
    // Simple fallback message for DRU Education or document management
    const header = `🎓 Message from *DRU Education*:\n\n`;
    return header + originalMessage;
  }
  
  // Full detailed message for specific teachers
  const studentInfo = studentName ? ` regarding *${studentName}*` : '';
  const header = `🎓 You have received a message from *${teacherName}* from *DRU Education*${studentInfo} for class *${className}*\n\n`;
  
  return header + originalMessage;
}

// Format phone number for WhatsApp (Australian numbers)
function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-numeric characters
  let cleanNumber = phone.replace(/\D/g, '');
  
  // Handle Australian numbers
  if (cleanNumber.startsWith('61')) {
    // Already has country code
    return `${cleanNumber}@c.us`;
  } else if (cleanNumber.startsWith('0')) {
    // Remove leading 0 and add Australian country code
    return `61${cleanNumber.substring(1)}@c.us`;
  } else if (cleanNumber.length === 9) {
    // Assume it's a mobile without country code or leading 0
    return `61${cleanNumber}@c.us`;
  }
  
  // Default: assume it has country code already
  return `${cleanNumber}@c.us`;
}

// Send text message via Green API
async function sendWhatsAppMessage(chatId: string, message: string): Promise<GreenApiResponse> {
  const url = `${GREEN_API_URL}/waInstance${GREEN_ID}/sendMessage/${GREEN_API_TOKEN}`;
  
  const payload = {
    chatId,
    message
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Green API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// Upload file to Green API storage
async function uploadFileToGreenApi(fileName: string, fileData: string, mimeType: string): Promise<string> {
  const url = `${MEDIA_API_URL}/waInstance${GREEN_ID}/uploadFile/${GREEN_API_TOKEN}`;
  
  // Convert base64 to blob
  const binaryString = atob(fileData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  
  const formData = new FormData();
  formData.append('file', blob, fileName);

  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`File upload error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.urlFile; // URL of uploaded file
}

// Send file via Green API
async function sendWhatsAppFile(chatId: string, fileUrl: string, fileName: string, caption?: string): Promise<GreenApiResponse> {
  const url = `${GREEN_API_URL}/waInstance${GREEN_ID}/sendFileByUrl/${GREEN_API_TOKEN}`;
  
  const payload = {
    chatId,
    urlFile: fileUrl,
    fileName,
    caption: caption || ''
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`File send error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    if (!GREEN_API_URL || !MEDIA_API_URL || !GREEN_ID || !GREEN_API_TOKEN) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Green API configuration missing. Please check environment variables.' 
        },
        { status: 500 }
      );
    }

    const body: WhatsAppMessageRequest = await request.json();
    const { recipients, message, teacherName, className, file } = body;

    // Validate request
    if (!recipients || recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Recipients list is required' },
        { status: 400 }
      );
    }

    if (!message && !file) {
      return NextResponse.json(
        { success: false, error: 'Either message or file is required' },
        { status: 400 }
      );
    }

    if (!teacherName || !className) {
      return NextResponse.json(
        { success: false, error: 'Teacher name and class name are required' },
        { status: 400 }
      );
    }

    const results = [];
    let uploadedFileUrl = '';

    // Upload file if provided
    if (file) {
      try {
        console.log('Uploading file to Green API storage...');
        uploadedFileUrl = await uploadFileToGreenApi(file.name, file.data, file.mimeType);
        console.log('File uploaded successfully:', uploadedFileUrl);
      } catch (error) {
        console.error('File upload failed:', error);
        return NextResponse.json(
          { 
            success: false, 
            error: `File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          },
          { status: 500 }
        );
      }
    }

    // Send messages to each recipient
    for (const recipient of recipients) {
      try {
        const chatId = formatPhoneForWhatsApp(recipient.phone);
        console.log(`Sending WhatsApp message to ${recipient.name} (${recipient.type}) at ${chatId}`);

        // Format message with header
        const studentName = recipient.type === 'parent' ? recipient.studentName : recipient.name;
        const formattedMessage = formatWhatsAppMessage(
          message, 
          teacherName, 
          className, 
          recipient.type,
          recipient.type === 'parent' ? studentName : undefined
        );

        let result: GreenApiResponse;

        if (file && uploadedFileUrl) {
          // Send file with formatted message as caption
          result = await sendWhatsAppFile(chatId, uploadedFileUrl, file.name, formattedMessage);
        } else if (formattedMessage) {
          // Send formatted text message
          result = await sendWhatsAppMessage(chatId, formattedMessage);
        } else {
          throw new Error('No content to send');
        }

        results.push({
          recipient: {
            name: recipient.name,
            phone: recipient.phone,
            type: recipient.type,
            chatId
          },
          success: true,
          messageId: result.idMessage,
          status: result.statusMessage
        });

        console.log(`✅ Message sent successfully to ${recipient.name}: ${result.idMessage}`);

        // Add small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Failed to send message to ${recipient.name}:`, error);
        results.push({
          recipient: {
            name: recipient.name,
            phone: recipient.phone,
            type: recipient.type,
            chatId: formatPhoneForWhatsApp(recipient.phone)
          },
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Calculate success rate
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    return NextResponse.json({
      success: successCount > 0,
      summary: {
        total: totalCount,
        successful: successCount,
        failed: totalCount - successCount
      },
      results,
      fileUploaded: uploadedFileUrl ? true : false,
      fileUrl: uploadedFileUrl
    });

  } catch (error) {
    console.error('WhatsApp API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

// GET method for testing API health
export async function GET() {
  return NextResponse.json({
    message: 'WhatsApp API is running',
    configured: !!(GREEN_API_URL && MEDIA_API_URL && GREEN_ID && GREEN_API_TOKEN),
    timestamp: new Date().toISOString()
  });
}