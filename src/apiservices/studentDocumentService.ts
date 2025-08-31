import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { firestore, storage } from '@/utils/firebase-client';
import { DocumentInfo, DocumentType, StudentDocument } from '@/models/studentSchema';

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
   * Get all students with document verification status and enrollment info
   */
  static async getStudentsWithDocumentStatus() {
    try {
      const { StudentFirestoreService } = await import('@/apiservices/studentFirestoreService');
      const students = await StudentFirestoreService.getAllStudents();
      
      const studentsWithDetails = await Promise.all(
        students.map(async (student) => {
          // Get document info and parent data from student document
          const studentRef = doc(firestore, COLLECTION_NAME, student.id);
          const studentDoc = await getDoc(studentRef);
          const studentData = studentDoc.data();
          
          // Get enrollment info
          let enrolledClasses: Array<{
            classId: string;
            className: string;
            subject: string;
            status: 'Active' | 'Inactive';
          }> = [];
          
          try {
            const { getEnrollmentsByStudent } = await import('@/services/studentEnrollmentService');
            const enrollments = await getEnrollmentsByStudent(student.id);
            enrolledClasses = enrollments.map((enrollment: any) => ({
              classId: enrollment.classId,
              className: enrollment.className,
              subject: enrollment.subject,
              status: enrollment.status as 'Active' | 'Inactive'
            }));
          } catch (enrollmentError) {
            console.warn('Error fetching enrollments for student:', student.id, enrollmentError);
          }
          
          // Extract parent information with proper validation
          let parentInfo: { name: string; email: string; phone: string } | null = null;
          
          if (studentData && studentData.parent) {
            const parentData = studentData.parent;
            
            // Validate that parent has required fields
            if (parentData.name && parentData.email) {
              parentInfo = {
                name: parentData.name || '',
                email: parentData.email || '',
                phone: parentData.phone || '' // This might be empty, which is handled later
              };
            }
          }

          console.log(`👥 Student ${student.name}: Parent info =`, parentInfo);
          
          return {
            ...student,
            documents: studentData?.documents || [],
            parent: parentInfo,
            enrolledClasses
          };
        })
      );
      
      return studentsWithDetails;
    } catch (error) {
      console.error('Error getting students with document status:', error);
      throw new Error(`Failed to get students with document status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get students who haven't submitted required documents
   */
  static async getStudentsWithMissingDocuments(): Promise<Array<{
    id: string;
    name: string;
    email: string;
    parent: { name: string; email: string } | null;
    missingDocuments: Array<{ type: DocumentType; name: string; url: string }>;
  }>> {
    try {
      const studentsWithDocs = await this.getStudentsWithDocumentStatus();
      
      // Define required documents with their display names and URLs
      const requiredDocuments = [
        {
          type: DocumentType.CLASS_POLICY,
          name: 'Class Policy Agreement',
          url: 'https://drive.google.com/file/d/1YHJxvAfTVMqRJ5YQeD5fFZdXkt81vSr1/view?usp=sharing'
        },
        {
          type: DocumentType.PARENT_NOTICE,
          name: 'Parent/Guardian Notice',
          url: 'https://drive.google.com/file/d/1j_LO0jWJ2-4WRYBZwMwp0eRnFMqOVM-F/view?usp=sharing'
        },
        {
          type: DocumentType.PHOTO_CONSENT,
          name: 'Photo Consent Form',
          url: 'https://drive.google.com/file/d/1qD9nYtOnbHs_AImrAaEU5NTPalXwea6F/view?usp=sharing'
        }
      ];

      const studentsWithMissingDocs = studentsWithDocs
        .filter(student => {
          // Only include active students
          return student.status === 'Active';
        })
        .map(student => {
          const submittedDocTypes = (student.documents || [])
            .filter((doc: DocumentInfo) => doc.status === 'Verified' || doc.status === 'Pending')
            .map((doc: DocumentInfo) => doc.type);

          const missingDocuments = requiredDocuments.filter(
            reqDoc => !submittedDocTypes.includes(reqDoc.type)
          );

          // Get the student document to access parent info
          const studentData = student as unknown as StudentDocument;

          return {
            id: student.id,
            name: student.name,
            email: student.email,
            parent: studentData.parent ? {
              name: studentData.parent.name,
              email: studentData.parent.email
            } : null,
            missingDocuments
          };
        })
        .filter(student => student.missingDocuments.length > 0);

      console.log(`Found ${studentsWithMissingDocs.length} students with missing documents`);
      return studentsWithMissingDocs;
    } catch (error) {
      console.error('Error getting students with missing documents:', error);
      throw new Error(`Failed to get students with missing documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get students who haven't submitted ANY documents (completely new students)
   */
  static async getStudentsWithNoDocuments(): Promise<Array<{
    id: string;
    name: string;
    email: string;
    parent: { name: string; email: string } | null;
    missingDocuments: Array<{ type: DocumentType; name: string; url: string }>;
  }>> {
    try {
      const studentsWithMissing = await this.getStudentsWithMissingDocuments();
      
      // Filter for students who have all 3 documents missing (i.e., no documents submitted at all)
      return studentsWithMissing.filter(student => student.missingDocuments.length === 3);
    } catch (error) {
      console.error('Error getting students with no documents:', error);
      throw new Error(`Failed to get students with no documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
