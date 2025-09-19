import { adminFirestore } from '@/utils/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export interface SheetTemplate {
  id: string;
  name: string;
  description: string;
  fileName: string;
  filePath: string;
  googleFileId?: string; // Google Drive file ID for the template
  uploadedBy: string;
  uploadedAt: Timestamp;
  isActive: boolean;
}

export interface SheetAllocation {
  id: string;
  templateId: string;
  templateName: string;
  classId: string;
  className: string;
  title: string;
  description: string;
  teacherId: string;
  teacherEmail: string;
  createdAt: Timestamp;
  status: 'pending' | 'completed' | 'failed';
  studentCount: number;
  sheetsCreated: number;
}

export interface StudentSheet {
  id: string;
  allocationId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  googleSheetId: string;
  googleSheetUrl: string;
  status: 'assigned' | 'in-progress' | 'completed' | 'graded';
  createdAt: Timestamp;
  lastModified?: Timestamp;
  submittedAt?: Timestamp;
}

export class SheetManagerService {
  // Template operations
  static async getTemplates(): Promise<SheetTemplate[]> {
    try {
      console.log('SheetManagerService.getTemplates - Starting query');
      const snapshot = await adminFirestore
        .collection('sheetTemplates')
        .where('isActive', '==', true)
        .orderBy('uploadedAt', 'desc')
        .get();
      
      console.log('SheetManagerService.getTemplates - Query result:', snapshot.size, 'documents');
      const templates = snapshot.docs.map(doc => {
        const data = { id: doc.id, ...doc.data() } as SheetTemplate;
        console.log('SheetManagerService.getTemplates - Template:', data.id, data.name);
        return data;
      });
      
      return templates;
    } catch (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
  }

  static async getTemplateById(id: string): Promise<SheetTemplate | null> {
    try {
      const doc = await adminFirestore.collection('sheetTemplates').doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } as SheetTemplate : null;
    } catch (error) {
      console.error('Error fetching template:', error);
      return null;
    }
  }

  static async createTemplate(template: Omit<SheetTemplate, 'id' | 'uploadedAt' | 'isActive'>): Promise<string> {
    try {
      const templateData = {
        ...template,
        uploadedAt: Timestamp.now(),
        isActive: true
      };
      console.log('SheetManagerService.createTemplate - Creating template:', templateData);
      const docRef = await adminFirestore.collection('sheetTemplates').add(templateData);
      console.log('SheetManagerService.createTemplate - Template created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  // Allocation operations
  static async getAllocations(): Promise<SheetAllocation[]> {
    try {
      const snapshot = await adminFirestore
        .collection('sheetAllocations')
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SheetAllocation));
    } catch (error) {
      console.error('Error fetching allocations:', error);
      return [];
    }
  }

  static async getAllocationById(id: string): Promise<SheetAllocation | null> {
    try {
      const doc = await adminFirestore.collection('sheetAllocations').doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } as SheetAllocation : null;
    } catch (error) {
      console.error('Error fetching allocation:', error);
      return null;
    }
  }

  static async createAllocation(allocation: Omit<SheetAllocation, 'id' | 'createdAt' | 'status' | 'sheetsCreated'>): Promise<string> {
    try {
      const docRef = await adminFirestore.collection('sheetAllocations').add({
        ...allocation,
        createdAt: Timestamp.now(),
        status: 'pending',
        sheetsCreated: 0
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating allocation:', error);
      throw error;
    }
  }

  static async updateAllocation(id: string, updates: Partial<SheetAllocation>): Promise<void> {
    try {
      await adminFirestore.collection('sheetAllocations').doc(id).update(updates);
    } catch (error) {
      console.error('Error updating allocation:', error);
      throw error;
    }
  }

  // Student sheet operations
  static async getStudentSheets(allocationId: string): Promise<StudentSheet[]> {
    try {
      const snapshot = await adminFirestore
        .collection('studentSheets')
        .where('allocationId', '==', allocationId)
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentSheet));
    } catch (error) {
      console.error('Error fetching student sheets:', error);
      return [];
    }
  }

  static async createStudentSheet(studentSheet: Omit<StudentSheet, 'id'>): Promise<string> {
    try {
      const docRef = await adminFirestore.collection('studentSheets').add({
        ...studentSheet,
        createdAt: Timestamp.now(),
        status: 'assigned'
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating student sheet:', error);
      throw error;
    }
  }

  static async getStudentSheetsByStudentId(studentId: string): Promise<StudentSheet[]> {
    try {
      const snapshot = await adminFirestore
        .collection('studentSheets')
        .where('studentId', '==', studentId)
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentSheet));
    } catch (error) {
      console.error('Error fetching student sheets for student:', error);
      return [];
    }
  }

  // Cleanup operations
  static async deleteStudentSheet(studentSheetId: string): Promise<void> {
    try {
      await adminFirestore.collection('studentSheets').doc(studentSheetId).delete();
      console.log('Student sheet deleted successfully:', studentSheetId);
    } catch (error) {
      console.error('Error deleting student sheet:', error);
      throw error;
    }
  }

  static async deleteAllocation(id: string): Promise<void> {
    try {
      // Delete all student sheets for this allocation
      const studentSheets = await this.getStudentSheets(id);
      const batch = adminFirestore.batch();
      
      studentSheets.forEach(sheet => {
        batch.delete(adminFirestore.collection('studentSheets').doc(sheet.id));
      });
      
      // Delete the allocation
      batch.delete(adminFirestore.collection('sheetAllocations').doc(id));
      
      await batch.commit();
    } catch (error) {
      console.error('Error deleting allocation:', error);
      throw error;
    }
  }
}