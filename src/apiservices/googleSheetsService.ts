import { firestore } from '@/utils/firebase-client';
import { collection, doc, getDoc, setDoc, updateDoc, getDocs, query, where, Timestamp, deleteDoc } from 'firebase/firestore';

export interface SheetTemplate {
  id: string;
  name: string;
  description?: string;
  fileName: string;
  filePath: string; // Path in public folder
  teacherId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SheetAllocation {
  id: string;
  templateId: string;
  templateName: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  title: string;
  description?: string;
  dueDate?: Timestamp;
  allocatedAt: Timestamp;
  status: 'active' | 'completed' | 'cancelled';
}

export interface StudentSheet {
  id: string;
  allocationId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  googleSheetId: string;
  googleSheetUrl: string;
  status: 'assigned' | 'in_progress' | 'submitted' | 'graded';
  lastModified?: Timestamp;
  submittedAt?: Timestamp;
  grade?: number;
  feedback?: string;
  createdAt: Timestamp;
}

export class GoogleSheetsService {
  private static readonly COLLECTIONS = {
    SHEET_TEMPLATES: 'sheetTemplates',
    SHEET_ALLOCATIONS: 'sheetAllocations',
    STUDENT_SHEETS: 'studentSheets'
  };

  /**
   * Create a new sheet template record
   */
  static async createTemplate(template: Omit<SheetTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<SheetTemplate> {
    try {
      const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = Timestamp.now();

      const newTemplate: SheetTemplate = {
        id: templateId,
        ...template,
        createdAt: now,
        updatedAt: now
      };

      await setDoc(doc(firestore, this.COLLECTIONS.SHEET_TEMPLATES, templateId), newTemplate);
      
      console.log('✅ Sheet template created:', templateId);
      return newTemplate;
    } catch (error) {
      console.error('❌ Error creating sheet template:', error);
      throw error;
    }
  }

  /**
   * Debug function to get detailed information about student sheets for an allocation
   */
  static async debugStudentSheetsForAllocation(allocationId: string): Promise<{
    allocationExists: boolean;
    studentSheets: StudentSheet[];
    studentSheetsCount: number;
    studentSheetsDetails: Array<{
      studentName: string;
      studentEmail: string;
      hasGoogleSheet: boolean;
      googleSheetUrl?: string;
      status: string;
    }>;
  }> {
    try {
      console.log('🔍 Debug: Checking student sheets for allocation:', allocationId);
      
      // Check if allocation exists
      const allocationDoc = await getDoc(doc(firestore, this.COLLECTIONS.SHEET_ALLOCATIONS, allocationId));
      const allocationExists = allocationDoc.exists();
      
      console.log('📋 Allocation exists:', allocationExists);
      
      // Get student sheets
      const studentSheets = await this.getStudentSheetsByAllocation(allocationId);
      
      console.log('📄 Student sheets found:', studentSheets.length);
      console.log('📊 Student sheets data:', studentSheets);
      
      const studentSheetsDetails = studentSheets.map(sheet => ({
        studentName: sheet.studentName,
        studentEmail: sheet.studentEmail,
        hasGoogleSheet: !!sheet.googleSheetId,
        googleSheetUrl: sheet.googleSheetUrl,
        status: sheet.status
      }));
      
      return {
        allocationExists,
        studentSheets,
        studentSheetsCount: studentSheets.length,
        studentSheetsDetails
      };
    } catch (error) {
      console.error('❌ Error debugging student sheets:', error);
      throw error;
    }
  }

  /**
   * Get all templates for a teacher
   */
  static async getTeacherTemplates(teacherId: string): Promise<SheetTemplate[]> {
    try {
      const templatesQuery = query(
        collection(firestore, this.COLLECTIONS.SHEET_TEMPLATES),
        where('teacherId', '==', teacherId)
      );

      const snapshot = await getDocs(templatesQuery);
      const templates: SheetTemplate[] = [];

      snapshot.forEach(doc => {
        templates.push({ id: doc.id, ...doc.data() } as SheetTemplate);
      });

      return templates;
    } catch (error) {
      console.error('❌ Error getting teacher templates:', error);
      throw error;
    }
  }

  /**
   * Allocate sheets to class (this will call API route for Google Sheets creation)
   */
  static async allocateSheetToClass(
    templateId: string,
    classId: string,
    className: string,
    teacherId: string,
    teacherName: string,
    students: Array<{ id: string; name: string; email: string }>,
    title: string,
    description?: string,
    teacherEmail?: string
  ): Promise<SheetAllocation> {
    try {
      // Get template details
      const templateDoc = await getDoc(doc(firestore, this.COLLECTIONS.SHEET_TEMPLATES, templateId));
      if (!templateDoc.exists()) {
        throw new Error('Template not found');
      }

      const template = templateDoc.data() as SheetTemplate;
      
      // Create allocation record
      const allocationId = `allocation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const allocation: Omit<SheetAllocation, 'description' | 'dueDate'> & {
        description?: string;
        dueDate?: Timestamp;
      } = {
        id: allocationId,
        templateId,
        templateName: template.name,
        teacherId,
        teacherName,
        classId,
        className,
        title,
        allocatedAt: Timestamp.now(),
        status: 'active'
      };

      // Only add description if it has a value
      if (description && description.trim()) {
        allocation.description = description;
      }

      await setDoc(doc(firestore, this.COLLECTIONS.SHEET_ALLOCATIONS, allocationId), allocation);

      console.log(`📋 Created allocation record: ${allocationId}`);
      console.log(`🔄 Calling API to create ${students.length} Google Sheets...`);

      // Call API route to create Google Sheets for students
      const response = await fetch('/api/sheets/create-for-students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allocationId,
          templateFilePath: template.filePath,
          students,
          title,
          teacherEmail: teacherEmail || `${teacherName.toLowerCase().replace(/\s+/g, '.')}@teacher.edu`
        }),
      });

      console.log(`📡 API Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`Failed to create sheets for students: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ API Success:`, result);
      console.log(`✅ Allocated sheets to class: ${className}`);
      return allocation;
    } catch (error) {
      console.error('❌ Error allocating sheets to class:', error);
      throw error;
    }
  }

  /**
   * Get all sheets for a specific allocation
   */
  static async getAllocationSheets(allocationId: string): Promise<StudentSheet[]> {
    try {
      const sheetsQuery = query(
        collection(firestore, this.COLLECTIONS.STUDENT_SHEETS),
        where('allocationId', '==', allocationId)
      );

      const snapshot = await getDocs(sheetsQuery);
      const sheets: StudentSheet[] = [];

      snapshot.forEach(doc => {
        sheets.push({ id: doc.id, ...doc.data() } as StudentSheet);
      });

      return sheets;
    } catch (error) {
      console.error('❌ Error getting allocation sheets:', error);
      throw error;
    }
  }

  /**
   * Update student sheet status
   */
  static async updateSheetStatus(
    sheetId: string,
    status: StudentSheet['status'],
    additionalData?: Partial<StudentSheet>
  ): Promise<void> {
    try {
      const updateData = {
        status,
        lastModified: Timestamp.now(),
        ...additionalData
      };

      await updateDoc(doc(firestore, this.COLLECTIONS.STUDENT_SHEETS, sheetId), updateData);
      console.log(`✅ Updated sheet ${sheetId} status to ${status}`);
    } catch (error) {
      console.error('❌ Error updating sheet status:', error);
      throw error;
    }
  }

  /**
   * Get teacher's sheet allocations
   */
  static async getTeacherAllocations(teacherId: string): Promise<SheetAllocation[]> {
    try {
      const allocationsQuery = query(
        collection(firestore, this.COLLECTIONS.SHEET_ALLOCATIONS),
        where('teacherId', '==', teacherId)
      );

      const snapshot = await getDocs(allocationsQuery);
      const allocations: SheetAllocation[] = [];

      snapshot.forEach(doc => {
        allocations.push({ id: doc.id, ...doc.data() } as SheetAllocation);
      });

      return allocations;
    } catch (error) {
      console.error('❌ Error getting teacher allocations:', error);
      throw error;
    }
  }

  /**
   * Delete a template
   */
  static async deleteTemplate(templateId: string): Promise<void> {
    try {
      await updateDoc(doc(firestore, this.COLLECTIONS.SHEET_TEMPLATES, templateId), {
        updatedAt: Timestamp.now()
        // Add soft delete flag if needed
      });
      console.log(`✅ Template ${templateId} deleted`);
    } catch (error) {
      console.error('❌ Error deleting template:', error);
      throw error;
    }
  }

  /**
   * Create a student sheet record
   */
  static async createStudentSheet(studentSheet: StudentSheet): Promise<void> {
    try {
      await setDoc(doc(firestore, this.COLLECTIONS.STUDENT_SHEETS, studentSheet.id), studentSheet);
      console.log('✅ Student sheet record created:', studentSheet.id);
    } catch (error) {
      console.error('❌ Error creating student sheet record:', error);
      throw error;
    }
  }

  /**
   * Get student sheets for an allocation
   */
  static async getStudentSheetsByAllocation(allocationId: string): Promise<StudentSheet[]> {
    try {
      const sheetsQuery = query(
        collection(firestore, this.COLLECTIONS.STUDENT_SHEETS),
        where('allocationId', '==', allocationId)
      );

      const snapshot = await getDocs(sheetsQuery);
      const studentSheets: StudentSheet[] = [];

      snapshot.forEach(doc => {
        studentSheets.push({ id: doc.id, ...doc.data() } as StudentSheet);
      });

      return studentSheets;
    } catch (error) {
      console.error('❌ Error getting student sheets:', error);
      throw error;
    }
  }

  /**
   * Get student sheets for a specific student
   */
  static async getStudentSheets(studentId: string): Promise<StudentSheet[]> {
    try {
      const sheetsQuery = query(
        collection(firestore, this.COLLECTIONS.STUDENT_SHEETS),
        where('studentId', '==', studentId)
      );

      const snapshot = await getDocs(sheetsQuery);
      const studentSheets: StudentSheet[] = [];

      snapshot.forEach(doc => {
        studentSheets.push({ id: doc.id, ...doc.data() } as StudentSheet);
      });

      return studentSheets;
    } catch (error) {
      console.error('❌ Error getting student sheets:', error);
      throw error;
    }
  }

  /**
   * Delete an allocation and all associated student sheets
   */
  static async deleteAllocation(allocationId: string): Promise<void> {
    try {
      // First, get all student sheets for this allocation
      const studentSheets = await this.getStudentSheetsByAllocation(allocationId);
      
      // Delete all student sheet documents
      const deletePromises = studentSheets.map(sheet => 
        deleteDoc(doc(firestore, this.COLLECTIONS.STUDENT_SHEETS, sheet.id))
      );
      
      await Promise.all(deletePromises);
      
      // Delete the allocation document
      await deleteDoc(doc(firestore, this.COLLECTIONS.SHEET_ALLOCATIONS, allocationId));
      
      console.log(`✅ Deleted allocation ${allocationId} and ${studentSheets.length} student sheets`);
    } catch (error) {
      console.error('❌ Error deleting allocation:', error);
      throw error;
    }
  }

  /**
   * Check allocation health and get diagnostics
   */
  static async getAllocationDiagnostics(allocationId: string): Promise<{
    allocation: SheetAllocation | null;
    studentSheets: StudentSheet[];
    studentsWithSheets: number;
    totalStudentsExpected: number;
    isHealthy: boolean;
    issues: string[];
  }> {
    try {
      // Get allocation
      const allocationDoc = await getDoc(doc(firestore, this.COLLECTIONS.SHEET_ALLOCATIONS, allocationId));
      const allocation = allocationDoc.exists() ? { id: allocationDoc.id, ...allocationDoc.data() } as SheetAllocation : null;
      
      // Get student sheets
      const studentSheets = await this.getStudentSheetsByAllocation(allocationId);
      
      const issues: string[] = [];
      
      if (!allocation) {
        issues.push('Allocation record not found');
      }
      
      if (studentSheets.length === 0) {
        issues.push('No student sheets found for this allocation');
      }
      
      return {
        allocation,
        studentSheets,
        studentsWithSheets: studentSheets.length,
        totalStudentsExpected: 0, // We don't store this info, would need to get from class
        isHealthy: issues.length === 0 && studentSheets.length > 0,
        issues
      };
    } catch (error) {
      console.error('❌ Error getting allocation diagnostics:', error);
      throw error;
    }
  }

  /**
   * Get all allocations for a teacher
   */
  static async getAllocations(teacherId: string): Promise<Array<SheetAllocation & { studentSheets: StudentSheet[] }>> {
    try {
      const allocationsQuery = query(
        collection(firestore, this.COLLECTIONS.SHEET_ALLOCATIONS),
        where('teacherId', '==', teacherId)
      );

      const snapshot = await getDocs(allocationsQuery);
      const allocations: Array<SheetAllocation & { studentSheets: StudentSheet[] }> = [];

      for (const docSnapshot of snapshot.docs) {
        const allocation = { id: docSnapshot.id, ...docSnapshot.data() } as SheetAllocation;
        
        // Get student sheets for this allocation
        const studentSheets = await this.getStudentSheetsByAllocation(allocation.id);
        
        allocations.push({
          ...allocation,
          studentSheets
        });
      }

      return allocations;
    } catch (error) {
      console.error('❌ Error getting allocations:', error);
      throw error;
    }
  }
}