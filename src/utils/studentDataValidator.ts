import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';

export interface StudentParentValidation {
  studentId: string;
  studentName: string;
  studentEmail: string;
  parentData: {
    hasParentInfo: boolean;
    parentName: string | null;
    parentEmail: string | null;
    parentPhone: string | null;
    isValidForWhatsApp: boolean;
  };
  issues: string[];
}

export class StudentDataValidator {
  /**
   * Validate parent information for a specific student
   */
  static async validateStudentParentData(studentId: string): Promise<StudentParentValidation> {
    const issues: string[] = [];
    
    try {
      const studentRef = doc(firestore, 'students', studentId);
      const studentDoc = await getDoc(studentRef);
      
      if (!studentDoc.exists()) {
        issues.push('Student document does not exist');
        return {
          studentId,
          studentName: 'Unknown',
          studentEmail: 'Unknown',
          parentData: {
            hasParentInfo: false,
            parentName: null,
            parentEmail: null,
            parentPhone: null,
            isValidForWhatsApp: false
          },
          issues
        };
      }
      
      const data = studentDoc.data();
      
      const validation: StudentParentValidation = {
        studentId,
        studentName: data.name || 'Unknown',
        studentEmail: data.email || 'Unknown',
        parentData: {
          hasParentInfo: false,
          parentName: null,
          parentEmail: null,
          parentPhone: null,
          isValidForWhatsApp: false
        },
        issues: []
      };
      
      // Check if parent info exists
      if (!data.parent) {
        issues.push('No parent information found');
      } else {
        validation.parentData.hasParentInfo = true;
        
        // Check parent name
        if (!data.parent.name || data.parent.name.trim() === '') {
          issues.push('Parent name is missing or empty');
        } else {
          validation.parentData.parentName = data.parent.name.trim();
        }
        
        // Check parent email
        if (!data.parent.email || data.parent.email.trim() === '') {
          issues.push('Parent email is missing or empty');
        } else {
          validation.parentData.parentEmail = data.parent.email.trim();
        }
        
        // Check parent phone
        if (!data.parent.phone || data.parent.phone.trim() === '') {
          issues.push('Parent phone is missing or empty');
        } else {
          validation.parentData.parentPhone = data.parent.phone.trim();
        }
        
        // Determine if valid for WhatsApp
        validation.parentData.isValidForWhatsApp = 
          validation.parentData.parentName !== null &&
          validation.parentData.parentPhone !== null &&
          validation.parentData.parentPhone !== '';
      }
      
      validation.issues = issues;
      return validation;
      
    } catch (error) {
      issues.push(`Error fetching student data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        studentId,
        studentName: 'Error',
        studentEmail: 'Error',
        parentData: {
          hasParentInfo: false,
          parentName: null,
          parentEmail: null,
          parentPhone: null,
          isValidForWhatsApp: false
        },
        issues
      };
    }
  }
  
  /**
   * Validate multiple students' parent data
   */
  static async validateMultipleStudentsParentData(studentIds: string[]): Promise<StudentParentValidation[]> {
    const validations = await Promise.all(
      studentIds.map(id => this.validateStudentParentData(id))
    );
    
    return validations;
  }
  
  /**
   * Generate a summary report of parent data issues
   */
  static generateParentDataSummary(validations: StudentParentValidation[]) {
    const summary = {
      totalStudents: validations.length,
      studentsWithParentInfo: 0,
      studentsValidForWhatsApp: 0,
      studentsWithIssues: 0,
      commonIssues: {} as Record<string, number>
    };
    
    validations.forEach(validation => {
      if (validation.parentData.hasParentInfo) {
        summary.studentsWithParentInfo++;
      }
      
      if (validation.parentData.isValidForWhatsApp) {
        summary.studentsValidForWhatsApp++;
      }
      
      if (validation.issues.length > 0) {
        summary.studentsWithIssues++;
        
        validation.issues.forEach(issue => {
          summary.commonIssues[issue] = (summary.commonIssues[issue] || 0) + 1;
        });
      }
    });
    
    return summary;
  }
}
