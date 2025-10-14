// Test Template service for managing reusable test configurations

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  Timestamp,
  increment
} from 'firebase/firestore';
import { firestore, auth } from '@/utils/firebase-client';
import { TestTemplate, TestQuestion, TestConfig } from '@/models/testSchema';

export class TestTemplateService {
  private static readonly COLLECTIONS = {
    TEMPLATES: 'test_templates'
  };

  // Create a new test template from an existing test
  static async createTemplateFromTest(testData: {
    title: string;
    description?: string;
    instructions?: string;
    teacherId: string;
    teacherName: string;
    subjectId: string;
    subjectName: string;
    config: TestConfig;
    questions: TestQuestion[];
    totalMarks: number;
    isPublic?: boolean;
  }): Promise<string> {
    try {
      console.log('🔍 Creating test template from test data:', testData);

      const templateData = {
        ...testData,
        usageCount: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(firestore, this.COLLECTIONS.TEMPLATES), templateData);

      console.log('✅ Test template created successfully with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating test template:', error);
      throw error;
    }
  }

  // Get all templates for a teacher
  static async getTemplatesByTeacher(teacherId: string): Promise<TestTemplate[]> {
    try {
      // Try with orderBy first (requires composite index)
      try {
        const q = query(
          collection(firestore, this.COLLECTIONS.TEMPLATES),
          where('teacherId', '==', teacherId),
          orderBy('updatedAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as TestTemplate));
      } catch (indexError: any) {
        // If index error, fall back to fetching without orderBy
        console.warn('Composite index missing, fetching templates without ordering');
        const q = query(
          collection(firestore, this.COLLECTIONS.TEMPLATES),
          where('teacherId', '==', teacherId)
        );
        const querySnapshot = await getDocs(q);
        const templates = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as TestTemplate));
        
        // Sort client-side by updatedAt desc
        return templates.sort((a, b) => {
          const aTime = a.updatedAt?.toMillis?.() || 0;
          const bTime = b.updatedAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
      }
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      
      // Check if it's an index error
      if (error?.code === 'failed-precondition' && error?.message?.includes('index')) {
        console.warn('Firestore index missing for test_templates. Please deploy indexes.');
        // Return empty array instead of throwing to prevent app crash
        return [];
      }
      
      throw new Error('Failed to fetch templates');
    }
  }

  // Get public templates (from other teachers)
  static async getPublicTemplates(subjectId?: string): Promise<TestTemplate[]> {
    try {
      // Try with composite query first
      try {
        let q = query(
          collection(firestore, this.COLLECTIONS.TEMPLATES),
          where('isPublic', '==', true),
          orderBy('updatedAt', 'desc')
        );

        if (subjectId) {
          q = query(
            collection(firestore, this.COLLECTIONS.TEMPLATES),
            where('isPublic', '==', true),
            where('subjectId', '==', subjectId),
            orderBy('updatedAt', 'desc')
          );
        }

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as TestTemplate));
      } catch (indexError: any) {
        // If index error, fall back to fetching all public templates and filtering client-side
        console.warn('Composite index missing, fetching public templates without ordering/filtering');
        
        const q = query(
          collection(firestore, this.COLLECTIONS.TEMPLATES),
          where('isPublic', '==', true)
        );
        
        const querySnapshot = await getDocs(q);
        let templates = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as TestTemplate));
        
        // Filter by subject client-side if needed
        if (subjectId) {
          templates = templates.filter(template => template.subjectId === subjectId);
        }
        
        // Sort client-side by updatedAt desc
        return templates.sort((a, b) => {
          const aTime = a.updatedAt?.toMillis?.() || 0;
          const bTime = b.updatedAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
      }
    } catch (error: any) {
      console.error('Error fetching public templates:', error);
      
      // Check if it's an index error
      if (error?.code === 'failed-precondition' && error?.message?.includes('index')) {
        console.warn('Firestore index missing for test_templates. Please deploy indexes.');
        // Return empty array instead of throwing to prevent app crash
        return [];
      }
      
      throw new Error('Failed to fetch public templates');
    }
  }

  // Get template by ID
  static async getTemplate(templateId: string): Promise<TestTemplate | null> {
    try {
      const docSnap = await getDoc(doc(firestore, this.COLLECTIONS.TEMPLATES, templateId));
      if (!docSnap.exists()) return null;

      return {
        id: docSnap.id,
        ...docSnap.data()
      } as TestTemplate;
    } catch (error) {
      console.error('Error fetching template:', error);
      throw new Error('Failed to fetch template');
    }
  }

  // Update template
  static async updateTemplate(templateId: string, updates: Partial<TestTemplate>): Promise<void> {
    try {
      const templateRef = doc(firestore, this.COLLECTIONS.TEMPLATES, templateId);
      await updateDoc(templateRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating template:', error);
      throw new Error('Failed to update template');
    }
  }

  // Delete template
  static async deleteTemplate(templateId: string): Promise<void> {
    try {
      await deleteDoc(doc(firestore, this.COLLECTIONS.TEMPLATES, templateId));
    } catch (error) {
      console.error('Error deleting template:', error);
      throw new Error('Failed to delete template');
    }
  }

  // Increment usage count when template is used
  static async incrementUsageCount(templateId: string): Promise<void> {
    try {
      const templateRef = doc(firestore, this.COLLECTIONS.TEMPLATES, templateId);
      await updateDoc(templateRef, {
        usageCount: increment(1),
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error incrementing usage count:', error);
      // Don't throw error for usage count updates
    }
  }

  // Convert template to test creation data
  static templateToTestData(template: TestTemplate): {
    title: string;
    description?: string;
    instructions?: string;
    config: TestConfig;
    questions: TestQuestion[];
    totalMarks: number;
  } {
    return {
      title: template.title,
      description: template.description,
      instructions: template.instructions,
      config: template.config,
      questions: template.questions,
      totalMarks: template.totalMarks
    };
  }
}