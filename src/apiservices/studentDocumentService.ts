import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { firestore, storage } from '@/utils/firebase-client';
import { DocumentInfo, DocumentType } from '@/models/studentSchema';

const COLLECTION_NAME = 'students';
const STORAGE_PATH = 'policy-docs';

export class StudentDocumentService {
  /**
   * Upload a document for a student
   */
  static async uploadDocument(
    studentId: string, 
    file: File, 
    documentType: DocumentType
  ): Promise<DocumentInfo> {
    try {
      // Create a unique filename
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const filename = `${studentId}_${documentType.replace(/\s+/g, '')}_${timestamp}.${fileExtension}`;
      
      // Create storage reference
      const storageRef = ref(storage, `${STORAGE_PATH}/${studentId}/${filename}`);
      
      // Upload the file
      await uploadBytes(storageRef, file);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      // Create document info
      const documentInfo: DocumentInfo = {
        type: documentType,
        url: downloadURL,
        filename: filename,
        submittedAt: new Date().toISOString(),
        status: 'Pending'
      };
      
      // Update student record with the new document
      const studentRef = doc(firestore, COLLECTION_NAME, studentId);
      
      // Check if a document of this type already exists
      const studentDoc = await getDoc(studentRef);
      const studentData = studentDoc.data();
      
      if (studentData && studentData.documents) {
        // Find if there's an existing document of the same type
        const existingDocIndex = studentData.documents.findIndex(
          (doc: DocumentInfo) => doc.type === documentType
        );
        
        if (existingDocIndex >= 0) {
          // Replace the existing document
          const updatedDocuments = [...studentData.documents];
          updatedDocuments[existingDocIndex] = documentInfo;
          
          await updateDoc(studentRef, {
            documents: updatedDocuments
          });
        } else {
          // Add new document
          await updateDoc(studentRef, {
            documents: arrayUnion(documentInfo)
          });
        }
      } else {
        // No documents array exists yet
        await updateDoc(studentRef, {
          documents: [documentInfo]
        });
      }
      
      return documentInfo;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw new Error(`Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update the verification status of a student document
   */
  static async verifyDocument(
    studentId: string,
    documentType: DocumentType,
    verificationData: {
      status: 'Verified' | 'Rejected';
      verifiedBy: string;
      notes?: string;
    }
  ): Promise<boolean> {
    try {
      const studentRef = doc(firestore, COLLECTION_NAME, studentId);
      const studentDoc = await getDoc(studentRef);
      const studentData = studentDoc.data();
      
      if (!studentData || !studentData.documents) {
        throw new Error('Student has no documents');
      }
      
      // Find the document to update
      const documentIndex = studentData.documents.findIndex(
        (doc: DocumentInfo) => doc.type === documentType
      );
      
      if (documentIndex === -1) {
        throw new Error(`Document of type ${documentType} not found`);
      }
      
      // Update the document
      const updatedDocuments = [...studentData.documents];
      updatedDocuments[documentIndex] = {
        ...updatedDocuments[documentIndex],
        status: verificationData.status,
        verifiedAt: new Date().toISOString(),
        verifiedBy: verificationData.verifiedBy,
        notes: verificationData.notes || ''
      };
      
      // Update in Firestore
      await updateDoc(studentRef, {
        documents: updatedDocuments
      });
      
      return true;
    } catch (error) {
      console.error('Error verifying document:', error);
      throw new Error(`Failed to verify document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all students with document verification status
   */
  static async getStudentsWithDocumentStatus() {
    try {
      const { StudentFirestoreService } = await import('@/apiservices/studentFirestoreService');
      const students = await StudentFirestoreService.getAllStudents();
      
      const studentsWithDetails = await Promise.all(
        students.map(async (student) => {
          const studentRef = doc(firestore, COLLECTION_NAME, student.id);
          const studentDoc = await getDoc(studentRef);
          const studentData = studentDoc.data();
          
          return {
            ...student,
            documents: studentData?.documents || []
          };
        })
      );
      
      return studentsWithDetails;
    } catch (error) {
      console.error('Error getting students with document status:', error);
      throw new Error(`Failed to get students with document status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
