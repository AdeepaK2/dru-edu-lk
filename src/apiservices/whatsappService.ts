/**
 * WhatsApp Service for sending messages via Green API
 */

export interface WhatsAppRecipient {
  phone: string;
  name: string;
  type: 'student' | 'parent';
  studentName?: string; // For parent messages to identify which student
}

export interface WhatsAppFile {
  name: string;
  data: string; // base64 encoded
  mimeType: string;
}

export interface WhatsAppMessage {
  recipients: WhatsAppRecipient[];
  message: string;
  teacherName: string;
  className: string;
  file?: WhatsAppFile;
}

export interface WhatsAppResult {
  recipient: {
    name: string;
    phone: string;
    type: 'student' | 'parent';
    chatId: string;
  };
  success: boolean;
  messageId?: string;
  status?: string;
  error?: string;
}

export interface WhatsAppResponse {
  success: boolean;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
  results: WhatsAppResult[];
  fileUploaded?: boolean;
  fileUrl?: string;
  error?: string;
}

export class WhatsAppService {
  private static readonly API_BASE_URL = '/api/whatsapp';

  /**
   * Send WhatsApp message to multiple recipients
   */
  static async sendMessage(messageData: WhatsAppMessage): Promise<WhatsAppResponse> {
    try {
      const response = await fetch(this.API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('WhatsApp Service Error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to send WhatsApp message');
    }
  }

  /**
   * Send WhatsApp message to students and their parents
   */
  static async sendToStudentsAndParents(
    students: any[],
    message: string,
    recipientType: 'students' | 'parents' | 'both',
    teacherName: string,
    className: string,
    file?: WhatsAppFile
  ): Promise<WhatsAppResponse> {
    const recipients: WhatsAppRecipient[] = [];

    students.forEach((student) => {
      // Add student if needed
      if (recipientType === 'students' || recipientType === 'both') {
        if (student.phone) {
          recipients.push({
            phone: student.phone,
            name: student.name || student.studentName || 'Student',
            type: 'student'
          });
        }
      }

      // Add parent if needed
      if (recipientType === 'parents' || recipientType === 'both') {
        if (student.parent?.phone) {
          recipients.push({
            phone: student.parent.phone,
            name: student.parent.name || 'Parent',
            type: 'parent',
            studentName: student.name || student.studentName || 'Student'
          });
        }
      }
    });

    if (recipients.length === 0) {
      throw new Error('No valid phone numbers found for the selected recipients');
    }

    return this.sendMessage({
      recipients,
      message,
      teacherName,
      className,
      file
    });
  }

  /**
   * Convert file to base64 for upload
   */
  static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove data:mime/type;base64, prefix
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Validate Australian phone number format
   */
  static validateAustralianPhone(phone: string): boolean {
    // Remove all non-numeric characters
    const cleanNumber = phone.replace(/\D/g, '');
    
    // Check various Australian formats
    if (cleanNumber.startsWith('61') && cleanNumber.length >= 11) {
      return true; // +61 format
    } else if (cleanNumber.startsWith('0') && cleanNumber.length >= 10) {
      return true; // 04xx xxx xxx format
    } else if (cleanNumber.length >= 9 && cleanNumber.length <= 10) {
      return true; // 4xx xxx xxx format
    }
    
    return false;
  }

  /**
   * Format phone number for display
   */
  static formatPhoneForDisplay(phone: string): string {
    const cleanNumber = phone.replace(/\D/g, '');
    
    if (cleanNumber.startsWith('61')) {
      // Format +61 4XX XXX XXX
      const mobile = cleanNumber.substring(2);
      if (mobile.length >= 9) {
        return `+61 ${mobile.substring(0, 3)} ${mobile.substring(3, 6)} ${mobile.substring(6)}`;
      }
    } else if (cleanNumber.startsWith('0')) {
      // Format 04XX XXX XXX
      if (cleanNumber.length >= 10) {
        return `${cleanNumber.substring(0, 4)} ${cleanNumber.substring(4, 7)} ${cleanNumber.substring(7)}`;
      }
    }
    
    return phone; // Return original if can't format
  }

  /**
   * Check API health
   */
  static async checkHealth(): Promise<{ configured: boolean; timestamp: string }> {
    try {
      const response = await fetch(this.API_BASE_URL, {
        method: 'GET',
      });

      const data = await response.json();
      return {
        configured: data.configured || false,
        timestamp: data.timestamp || new Date().toISOString()
      };
    } catch (error) {
      console.error('WhatsApp API health check failed:', error);
      return {
        configured: false,
        timestamp: new Date().toISOString()
      };
    }
  }
}
