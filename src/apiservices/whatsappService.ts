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
    enrollments: any[], // This is enrollment data, not student data
    message: string,
    recipientType: 'students' | 'parents' | 'both',
    teacherName: string,
    className: string,
    file?: WhatsAppFile
  ): Promise<WhatsAppResponse> {
    const recipients: WhatsAppRecipient[] = [];

    console.log('🔍 Debug: Processing enrollments for WhatsApp:', enrollments.length);

    // First, get the student IDs from enrollments
    const studentIds = enrollments.map(enrollment => enrollment.studentId).filter(Boolean);
    console.log('🔍 Student IDs from enrollments:', studentIds);

    if (studentIds.length === 0) {
      throw new Error('No student IDs found in enrollment data');
    }

    // Fetch actual student data for each student ID using batch API
    let students: any[] = [];
    try {
      console.log('🔍 Fetching student data via batch API...');
      const response = await fetch('/api/students/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentIds }),
      });

      if (response.ok) {
        const data = await response.json();
        students = data.students || [];
        console.log(`✅ Batch fetched ${students.length}/${studentIds.length} students`);
      } else {
        console.error('❌ Batch fetch failed:', response.statusText);
        throw new Error('Failed to fetch student data');
      }
    } catch (error) {
      console.error('❌ Error batch fetching students:', error);
      throw new Error('Failed to fetch student data');
    }

    console.log(`📊 Fetched ${students.length} student records out of ${studentIds.length}`);

    // Now process the actual student data for phone numbers
    students.forEach((student, index) => {
      console.log(`🔍 Student ${index + 1}:`, {
        name: student.name,
        phone: student.phone,
        parentName: student.parent?.name,
        parentPhone: student.parent?.phone,
      });

      // Add student if needed
      if (recipientType === 'students' || recipientType === 'both') {
        if (student.phone && this.validateAustralianPhone(student.phone)) {
          recipients.push({
            phone: student.phone,
            name: student.name || 'Student',
            type: 'student'
          });
          console.log(`✅ Added student: ${student.name}`);
        } else {
          console.log(`❌ Student phone invalid or missing: ${student.phone}`);
        }
      }

      // Add parent if needed
      if (recipientType === 'parents' || recipientType === 'both') {
        if (student.parent?.phone && this.validateAustralianPhone(student.parent.phone)) {
          recipients.push({
            phone: student.parent.phone,
            name: student.parent.name || 'Parent',
            type: 'parent',
            studentName: student.name || 'Student'
          });
          console.log(`✅ Added parent: ${student.parent.name} for ${student.name}`);
        } else {
          console.log(`❌ Parent phone invalid or missing: ${student.parent?.phone}`);
        }
      }
    });

    console.log(`📊 Total valid recipients found: ${recipients.length}`);

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
    if (!phone || typeof phone !== 'string') {
      console.log(`❌ Phone validation failed: empty or invalid type - ${phone}`);
      return false;
    }

    // Remove all non-numeric characters
    const cleanNumber = phone.replace(/\D/g, '');
    console.log(`🔍 Validating phone: "${phone}" -> clean: "${cleanNumber}"`);
    
    // Check various Australian formats
    if (cleanNumber.startsWith('61') && cleanNumber.length >= 11) {
      console.log(`✅ Valid +61 format: ${cleanNumber}`);
      return true; // +61 format
    } else if (cleanNumber.startsWith('0') && cleanNumber.length >= 10) {
      console.log(`✅ Valid 04xx format: ${cleanNumber}`);
      return true; // 04xx xxx xxx format
    } else if (cleanNumber.length >= 9 && cleanNumber.length <= 10) {
      console.log(`✅ Valid mobile format: ${cleanNumber}`);
      return true; // 4xx xxx xxx format
    }
    
    console.log(`❌ Phone validation failed: ${cleanNumber} (length: ${cleanNumber.length})`);
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
