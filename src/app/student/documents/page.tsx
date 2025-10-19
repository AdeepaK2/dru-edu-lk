'use client';

import { useState, useEffect } from 'react';
import { Shield, Check, FileCheck } from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { DocumentInfo, DocumentType } from '@/models/studentSchema';
import { StudentDocumentService } from '@/apiservices/studentDocumentService';
import DocumentUploadGrid from '@/components/student/DocumentUploadGrid';

interface LoadingState {
  document: boolean;
}

interface DocumentStates {
  classPolicy: { status: string; document?: DocumentInfo };
  parentNotice: { status: string; document?: DocumentInfo };
  photoConsent: { status: string; document?: DocumentInfo };
}

export default function StudentDocumentsPage() {
  const { student, loading: authLoading, refreshStudent } = useStudentAuth();
  const { theme } = useTheme();

  // Loading states
  const [loading, setLoading] = useState<LoadingState>({
    document: false
  });

  // Document states (from Firestore)
  const [documentStates, setDocumentStates] = useState<DocumentStates>({
    classPolicy: { status: 'Not Submitted' },
    parentNotice: { status: 'Not Submitted' },
    photoConsent: { status: 'Not Submitted' },
  });

  // Initialize document states when student data is available
  useEffect(() => {
    if (student) {
      // Load document states
      loadDocumentStates();
    }
  }, [student]);

  // Load document states from student data
  const loadDocumentStates = () => {
    if (!student || !student.documents) {
      setDocumentStates({
        classPolicy: { status: 'Not Submitted' },
        parentNotice: { status: 'Not Submitted' },
        photoConsent: { status: 'Not Submitted' },
      });
      return;
    }

    const classPolicyDoc = student.documents.find(doc => doc.type === DocumentType.CLASS_POLICY);
    const parentNoticeDoc = student.documents.find(doc => doc.type === DocumentType.PARENT_NOTICE);
    const photoConsentDoc = student.documents.find(doc => doc.type === DocumentType.PHOTO_CONSENT);

    setDocumentStates({
      classPolicy: {
        status: classPolicyDoc?.status || 'Not Submitted',
        document: classPolicyDoc
      },
      parentNotice: {
        status: parentNoticeDoc?.status || 'Not Submitted',
        document: parentNoticeDoc
      },
      photoConsent: {
        status: photoConsentDoc?.status || 'Not Submitted',
        document: photoConsentDoc
      }
    });
  };

  // Handle individual document re-upload (for rejected documents)
  const handleIndividualDocumentUpload = async (documentType: DocumentType, file: File) => {
    if (!student) return;
    
    setLoading(prev => ({ ...prev, document: true }));
    
    try {
      const uploadedDocument = await StudentDocumentService.uploadDocument(student.id, file, documentType);
      
      // Update local document state
      const stateKey = documentType === DocumentType.CLASS_POLICY ? 'classPolicy' :
                      documentType === DocumentType.PARENT_NOTICE ? 'parentNotice' : 'photoConsent';
      
      setDocumentStates(prev => ({
        ...prev,
        [stateKey]: { status: 'Pending', document: uploadedDocument }
      }));
      
      // Update student object
      if (student.documents) {
        const existingIndex = student.documents.findIndex(doc => doc.type === documentType);
        if (existingIndex >= 0) {
          student.documents[existingIndex] = uploadedDocument;
        } else {
          student.documents.push(uploadedDocument);
        }
      } else {
        student.documents = [uploadedDocument];
      }

      // Refresh student data from database to ensure sync
      await refreshStudent();
      
      // Reload document states to reflect the updated data
      setTimeout(() => loadDocumentStates(), 500); // Small delay to ensure data is updated
      
      alert(`${documentType} re-uploaded successfully! Status: Pending verification.`);
    } catch (error) {
      console.error(`Error re-uploading ${documentType}:`, error);
      alert(`Failed to re-upload ${documentType}. Please try again.`);
    } finally {
      setLoading(prev => ({ ...prev, document: false }));
    }
  };

  // Download document
  const handleDownloadDocument = (documentInfo: DocumentInfo) => {
    if (documentInfo.url) {
      window.open(documentInfo.url, '_blank');
    }
  };

  // Check if all documents are verified
  const allDocumentsVerified = () => {
    return documentStates.classPolicy.status === 'Verified' &&
           documentStates.parentNotice.status === 'Verified' &&
           documentStates.photoConsent.status === 'Verified';
  };

  if (authLoading) {
    return (
      <div className={`min-h-screen ${theme === 'ben10' ? 'bg-gradient-to-br from-green-600 via-green-700 to-black' : 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400'} p-8`}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className={`w-16 h-16 border-t-4 border-black rounded-full animate-spin ${theme === 'ben10' ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-yellow-400 to-yellow-600'}`}></div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className={`min-h-screen ${theme === 'ben10' ? 'bg-gradient-to-br from-green-600 via-green-700 to-black' : 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400'} p-8`}>
        <div className="flex items-center justify-center py-12">
          <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-green-600 to-black' : 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500'} rounded-3xl shadow-2xl border-4 border-black p-8 text-center`}>
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-black text-white mb-2">Access Denied</h2>
            <p className={`font-bold ${theme === 'ben10' ? 'text-green-100' : 'text-yellow-100'}`}>
              You need to be logged in to access this page! {theme === 'ben10' ? '⚡' : '✨'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div key={`documents-${theme}`} className={`min-h-screen ${theme === 'ben10' ? 'bg-gradient-to-br from-green-600 via-green-700 to-black' : 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400'} p-8`}>
      <div className="max-w-7xl mx-auto">
        {/* Theme-aware Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center space-x-8 mb-4">
            
          </div>
          <h1 className="text-5xl font-black text-white mb-2 drop-shadow-lg">
            📄 Documents
          </h1>
          <p className="text-xl text-green-100 font-bold">
            Upload your documents here! 
          </p>
        </div>

        {/* Theme-aware Document Upload Section */}
        <div className="bg-white rounded-3xl shadow-2xl border-4 border-black overflow-hidden">
          <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-green-600 to-black' : 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500'} text-white p-6 pb-8 border-b-4 border-black`}>
            <div className="flex items-center space-x-4">
              
              <div>
                <h2 className="text-3xl font-black">Required Documents</h2>
                <p className={`font-bold text-lg ${theme === 'ben10' ? 'text-green-100' : 'text-yellow-100'}`}>Complete your enrollment with these documents!</p>
              </div>
            </div>
          </div>

          <div className="p-8">
          {/* Document Upload Grid */}
          <DocumentUploadGrid
            documents={student?.documents || []}
            onUpload={async (files) => {
              const validFiles = Object.entries(files).filter(([_, file]) => file !== null && file !== undefined) as [DocumentType, File][];
              if (validFiles.length === 0) {
                alert('Please select at least one document to upload.');
                return;
              }

              setLoading(prev => ({ ...prev, document: true }));
              try {
                const uploadedDocuments = await Promise.all(
                  validFiles.map(([type, file]) => 
                    StudentDocumentService.uploadDocument(student!.id, file, type)
                  )
                );

                // Update student documents
                if (student!.documents) {
                  uploadedDocuments.forEach(uploadedDoc => {
                    const existingIndex = student!.documents!.findIndex(doc => doc.type === uploadedDoc.type);
                    if (existingIndex >= 0) {
                      student!.documents![existingIndex] = uploadedDoc;
                    } else {
                      student!.documents!.push(uploadedDoc);
                    }
                  });
                } else {
                  student!.documents = uploadedDocuments;
                }

                await refreshStudent();
                setTimeout(() => loadDocumentStates(), 500);
                
                alert(`${validFiles.length} document(s) uploaded successfully! Status: Pending verification.`);
              } catch (error) {
                console.error('Error uploading documents:', error);
                alert('Failed to upload documents. Please try again.');
                throw error;
              } finally {
                setLoading(prev => ({ ...prev, document: false }));
              }
            }}
            onReupload={async (documentType, file) => {
              await handleIndividualDocumentUpload(documentType, file);
            }}
            onDownload={(document) => {
              handleDownloadDocument(document);
            }}
            loading={loading.document}
            disabled={loading.document}
          />
          </div>

          {/* Theme-aware Success Message */}
          {allDocumentsVerified() && (
            <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-green-600 to-black' : 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500'} rounded-2xl border-4 border-black p-6 shadow-lg`}>
              <div className="flex items-start">
                <span className="text-4xl mr-4">✅</span>
                <div>
                  <h4 className="text-xl font-black text-white mb-2"> Documents Verified!</h4>
                  <p className={`font-bold text-lg ${theme === 'ben10' ? 'text-green-100' : 'text-yellow-100'}`}>
                    All your required documents have been verified and approved by our admin team!
                    You can download them using the download buttons above. 
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Theme-aware Important Information */}
          <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-green-600 to-black' : 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500'} rounded-2xl border-4 border-black p-6 shadow-lg`}>
            <div className="flex items-start">
              <span className="text-4xl mr-4">🛡️</span>
              <div>
                <h4 className="text-xl font-black text-white mb-2">Important Information</h4>
                <p className={`font-bold text-lg ${theme === 'ben10' ? 'text-green-100' : 'text-yellow-100'}`}>
                  These documents are required for your enrollment. Please upload clear, legible copies in PDF, DOC, or image format.
                  Our admin team will verify your documents within 1-2 business days! 
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
