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
      <div className="min-h-screen flex items-center justify-center" style={{
        background: theme === 'ben10'
          ? 'linear-gradient(to bottom right, rgb(100, 204, 79), rgb(34, 34, 34))'
          : theme === 'tinkerbell'
          ? 'linear-gradient(to bottom right, rgb(253, 224, 71), rgb(34, 197, 94), rgb(253, 224, 71))'
          : theme === 'bounceworld'
          ? 'linear-gradient(to bottom right, rgb(255, 255, 255), rgb(29, 66, 138), rgb(200, 16, 46))'
          : theme === 'avengers'
          ? 'linear-gradient(to bottom right, rgb(44, 18, 103), rgb(79, 44, 141), rgb(15, 8, 38))'
          : theme === 'ponyville'
          ? 'linear-gradient(to bottom right, rgb(255, 245, 251), rgb(241, 174, 213), rgb(255, 46, 159))'
          : theme === 'cricketverse'
          ? 'linear-gradient(to bottom right, rgb(96, 165, 250), rgba(245, 137, 90, 0.6), rgb(79, 70, 229), rgb(96, 165, 250))'
          : theme === 'cricketverse-australian'
          ? 'linear-gradient(to bottom right, rgb(134, 250, 92) 0%, rgb(255, 255, 42) 40%, rgb(255, 255, 42) 60%, rgb(134, 250, 92) 100%)'
          : 'linear-gradient(to bottom right, rgb(249, 250, 251), rgb(243, 244, 246))'
      }}>
        <div className={`bg-white border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#2C1267]' : theme === 'ponyville' ? 'border-[#e13690]' : theme === 'cricketverse' ? 'border-blue-600' : theme === 'cricketverse-australian' ? 'border-[#b38f00]' : 'border-black'} rounded-3xl p-8 shadow-2xl`}>
          {/* Theme-Specific Loading Animation */}
          <div className="relative mb-6 flex flex-col items-center">
            {/* Tinkerbell Loading GIF */}
            {theme === 'tinkerbell' && (
              <div className="flex flex-col items-center">
                <img 
                  src="/tinkerbell-loading.gif" 
                  alt="Tinkerbell Loading" 
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-yellow-600 mt-4">Loading</span>
              </div>
            )}
            
            {/* Ben 10 Loading GIF */}
            {theme === 'ben10' && (
              <div className="flex flex-col items-center">
                <img 
                  src="/ben10-loading.gif" 
                  alt="Ben 10 Loading" 
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#64cc4f] mt-4">Loading</span>
              </div>
            )}

            {/* BounceWorld Loading Animation */}
            {theme === 'bounceworld' && (
              <div className="flex flex-col items-center">
                <img
                  src="/bounceworld.gif"
                  alt="BounceWorld Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#1D428A] mt-4">Loading</span>
              </div>
            )}

            {/* Avengers Loading Animation */}
            {theme === 'avengers' && (
              <div className="flex flex-col items-center">
                <img
                  src="/avenger.gif"
                  alt="Avengers Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#2C1267] mt-4">Assembling</span>
              </div>
            )}

            {/* CricketVerse Loading GIF */}
            {theme === 'cricketverse' && (
              <div className="flex flex-col items-center">
                <img
                  src="/batsman.gif"
                  alt="CricketVerse Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-black mt-4">Loading 🏏</span>
              </div>
            )}

            {/* CricketVerse Australian Loading GIF */}
            {theme === 'cricketverse-australian' && (
              <div className="flex flex-col items-center">
                <img
                  src="/cricketverse-australian.gif"
                  alt="Australian CricketVerse Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#fff800] mt-4">Loading</span>
              </div>
            )}

            {/* Ponyville Loading Animation */}
            {theme === 'ponyville' && (
              <div className="flex flex-col items-center">
                <img
                  src="/ponyville-loading.gif"
                  alt="Ponyville Loading"
                  className="w-32 h-32 object-contain"
                />
                <span className="text-2xl font-bold text-[#e13690] mt-4">Casting Magic</span>
              </div>
            )}
            
            {/* Default Theme Spinner with Loading Text */}
            {theme !== 'tinkerbell' && theme !== 'ben10' && theme !== 'bounceworld' && theme !== 'avengers' && theme !== 'cricketverse' && theme !== 'cricketverse-australian' && theme !== 'ponyville' && (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 border-4 border-gray-400 border-t-gray-600 rounded-full animate-spin"></div>
                <span className="text-2xl font-bold text-black mt-4">Loading</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-black mb-2">Loading Documents...</h2>
            <p className={`text-gray-600 font-medium ${theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-[#2C1267]' : theme === 'ponyville' ? 'text-[#e13690]' : theme === 'cricketverse-australian' ? 'text-[#b38f00]' : ''}`}>
              {theme === 'bounceworld' ? 'Get ready to slam dunk your document uploads! 🏀' : theme === 'avengers' ? 'Assemble your document uploads! 🦸‍♂️' : theme === 'ponyville' ? 'Get ready to cast magical document spells! ✨🦄' : theme === 'cricketverse-australian' ? 'Get ready to hit a six down under!' : 'Get ready to transform your learning!'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen p-8" style={{
        background: theme === 'ben10'
          ? 'linear-gradient(to bottom right, rgb(100, 204, 79), rgb(178, 224, 91), rgb(34, 34, 34))'
          : theme === 'tinkerbell'
          ? 'linear-gradient(to bottom right, rgb(253, 224, 71), rgb(34, 197, 94), rgb(253, 224, 71))'
          : theme === 'bounceworld'
          ? 'linear-gradient(to bottom right, rgb(255, 255, 255), rgb(29, 66, 138), rgb(200, 16, 46))'
          : theme === 'cricketverse'
          ? 'linear-gradient(to bottom right, rgb(96, 165, 250), rgb(79, 70, 229), rgb(30, 58, 138))'
          : theme === 'cricketverse-australian'
          ? 'linear-gradient(to bottom right, rgb(134, 250, 92) 0%, rgb(255, 255, 42) 40%, rgb(255, 255, 42) 60%, rgb(134, 250, 92) 100%)'
          : 'linear-gradient(to bottom right, rgb(37, 99, 235), rgb(67, 56, 202), rgb(51, 65, 85))'
      }}>
        <div className="flex items-center justify-center py-12">
          <div className={`${theme === 'bounceworld' ? 'bg-white border-4 border-[#1D428A]' : theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500' : theme === 'cricketverse' ? 'bg-gradient-to-r from-blue-400 to-indigo-600' : theme === 'cricketverse-australian' ? 'bg-white border-4 border-[#b38f00]' : 'bg-gradient-to-r from-gray-100 to-gray-200'} rounded-3xl shadow-2xl p-8 text-center`}>
            <div className="text-6xl mb-4">🚫</div>
            <h2 className={`text-2xl font-black mb-2 ${theme === 'bounceworld' ? 'text-black' : theme === 'cricketverse' ? 'text-white' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>Access Denied</h2>
            <p className={`font-bold ${theme === 'bounceworld' ? 'text-black' : theme === 'ben10' ? 'text-[#b2e05b]' : theme === 'tinkerbell' ? 'text-yellow-100' : theme === 'cricketverse' ? 'text-white' : theme === 'cricketverse-australian' ? 'text-[#b38f00]' : 'text-black'}`}>
              You need to be logged in to access this page! {theme === 'ben10' ? '⚡' : theme === 'tinkerbell' ? '✨' : theme === 'bounceworld' ? '' : '📚'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div key={`documents-${theme}`} className="min-h-screen p-8" style={{
      background: theme === 'ben10'
        ? 'linear-gradient(to bottom right, rgb(100, 204, 79), rgb(178, 224, 91), rgb(34, 34, 34))'
        : theme === 'tinkerbell'
        ? 'linear-gradient(to bottom right, rgb(253, 224, 71), rgb(34, 197, 94), rgb(253, 224, 71))'
        : theme === 'bounceworld'
        ? 'linear-gradient(to bottom right, rgb(255, 255, 255), rgb(29, 66, 138), rgb(200, 16, 46))'
        : theme === 'avengers'
        ? 'linear-gradient(to bottom right, rgb(44, 18, 103), rgb(79, 44, 141), rgb(15, 8, 38))'
        : theme === 'ponyville'
        ? 'linear-gradient(to bottom right, rgb(255, 245, 251), rgb(241, 174, 213), rgb(255, 46, 159))'
        : theme === 'cricketverse'
        ? 'linear-gradient(to bottom right, rgb(96, 165, 250), rgba(245, 137, 90, 0.6), rgb(79, 70, 229), rgb(96, 165, 250))'
        : theme === 'cricketverse-australian'
        ? 'linear-gradient(to bottom right, rgb(134, 250, 92) 0%, rgb(255, 255, 42) 40%, rgb(255, 255, 42) 60%, rgb(134, 250, 92) 100%)'
        : 'linear-gradient(to bottom right, rgb(249, 250, 251), rgb(243, 244, 246), rgb(255, 255, 255))'
    }}>
      <div className="max-w-7xl mx-auto">
        {/* Theme-aware Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center space-x-8 mb-4">
            <div className={`text-6xl ${theme === 'bounceworld' ? 'text-white' : theme === 'avengers' ? 'text-white' : theme === 'ponyville' ? 'text-white' : theme === 'cricketverse' ? 'text-white' : ''}`}>{theme === 'ben10' ? '🦸' : theme === 'tinkerbell' ? '🧚‍♀️' : theme === 'bounceworld' ? '' : theme === 'avengers' ? ' ' : theme === 'ponyville' ? ' ' : theme === 'cricketverse' ? '' : ''}</div>
          </div>
          <h1 className={`text-5xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'} mb-2 drop-shadow-lg`}>
            📄 Documents
          </h1>
          <p className={`text-xl font-bold ${theme === 'ben10' ? 'text-white' : theme === 'tinkerbell' ? 'text-white' : theme === 'bounceworld' ? 'text-[#1D428A]' : theme === 'avengers' ? 'text-white' : theme === 'ponyville' ? 'text-white' : theme === 'cricketverse' ? 'text-white' : theme === 'cricketverse-australian' ? 'text-[#b38f00]' : 'text-black'}`}>
            {theme === 'bounceworld' ? 'Slam dunk your document uploads here! 🏀' : theme === 'avengers' ? 'Assemble your document uploads here! 🦸‍♂️' : theme === 'ponyville' ? 'Cast magical document spells here! ✨🦄' : theme === 'cricketverse' ? 'Upload your documents here!' : theme === 'cricketverse-australian' ? 'Hit a six down under with your documents!' : 'Upload your documents here!'}
          </p>
        </div>

        {/* Theme-aware Document Upload Section */}
        <div className={`bg-white rounded-3xl shadow-2xl border-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'ponyville' ? 'border-[#e13690]' : theme === 'cricketverse-australian' ? 'border-black' : 'border-black'} overflow-hidden`}>
          <div className={`${theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500' : theme === 'bounceworld' ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E]' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] via-[#604AC7] to-[#0F0826]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690] to-[#ff2e9f]' : theme === 'cricketverse' ? 'bg-gradient-to-r from-blue-400 via-indigo-600 to-blue-800' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-white via-[#f6f672] to-[#ffff2a] border-black' : 'bg-gradient-to-r from-gray-100 to-gray-200'} text-white p-6 pb-8 border-b-4 ${theme === 'bounceworld' ? 'border-[#1D428A]' : theme === 'avengers' ? 'border-[#C88DA5]' : theme === 'ponyville' ? 'border-[#e13690]' : theme === 'cricketverse' ? 'border-blue-600' : theme === 'cricketverse-australian' ? 'border-[#b38f00]' : 'border-black'}`}>
            <div className="flex items-center space-x-4">
              
              <div>
                <h2 className={`text-3xl font-black ${theme === 'avengers' ? 'text-white' : 'text-black'}`}>Required Documents</h2>
                <p className={`font-bold text-lg ${theme === 'ben10' ? 'text-white' : theme === 'tinkerbell' ? 'text-yellow-100' : theme === 'bounceworld' ? 'text-black' : theme === 'avengers' ? 'text-[#C88DA5]' : theme === 'ponyville' ? 'text-white' : theme === 'cricketverse' ? 'text-white' : theme === 'cricketverse-australian' ? 'text-black' : 'text-black'}`}>
                  {theme === 'bounceworld' ? 'Complete your enrollment and slam dunk your documents! 🏀' : theme === 'avengers' ? 'Complete your enrollment and assemble your documents! 🦸‍♂️' : theme === 'ponyville' ? 'Complete your enrollment and cast magical document spells! ✨🦄' : theme === 'cricketverse' ? 'Complete your enrollment with these documents!' : theme === 'cricketverse-australian' ? 'Complete your enrollment and hit a six down under!' : 'Complete your enrollment with these documents!'}
                </p>
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
            <div className={`${theme === 'bounceworld' ? 'bg-white border-4 border-[#1D428A]' : theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] via-[#604AC7] to-[#0F0826] border-4 border-[#C88DA5]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690] to-[#ff2e9f] border-4 border-[#e13690]' : theme === 'cricketverse' ? 'bg-gradient-to-r from-blue-400 via-indigo-600 to-blue-800 border-4 border-blue-600' : theme === 'cricketverse-australian' ? 'bg-gradient-to-r from-[#b38f00] via-[#ffd700] to-[#8b6914] border-4 border-black' : 'bg-gradient-to-r from-gray-100 to-gray-200'} rounded-2xl p-6 shadow-lg`}>
              <div className="flex items-start">
                <span className="text-4xl mr-4">✅</span>
                <div>
                  <h4 className={`text-xl font-black mb-2 ${theme === 'bounceworld' ? 'text-black' : theme === 'avengers' ? 'text-white' : theme === 'ponyville' ? 'text-white' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}> Documents Verified!</h4>
                  <p className={`font-bold text-lg ${theme === 'bounceworld' ? 'text-black' : theme === 'ben10' ? 'text-[#b2e05b]' : theme === 'tinkerbell' ? 'text-yellow-100' : theme === 'avengers' ? 'text-[#C88DA5]' : theme === 'ponyville' ? 'text-white' : theme === 'cricketverse-australian' ? 'text-black' : 'text-black'}`}>
                    All your required documents have been verified and approved by our admin team!
                    You can download them using the download buttons above. 
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Theme-aware Important Information */}
          <div className={`${theme === 'bounceworld' ? 'bg-white border-4 border-[#1D428A]' : theme === 'ben10' ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]' : theme === 'tinkerbell' ? 'bg-gradient-to-r from-yellow-400 via-green-500 to-yellow-500' : theme === 'avengers' ? 'bg-gradient-to-r from-[#2C1267] via-[#604AC7] to-[#0F0826] border-4 border-[#C88DA5]' : theme === 'ponyville' ? 'bg-gradient-to-r from-[#f1aed5] via-[#e13690] to-[#ff2e9f] border-4 border-[#e13690]' : theme === 'cricketverse' ? 'bg-gradient-to-r from-blue-400 via-indigo-600 to-blue-800 border-4 border-blue-600' : theme === 'cricketverse-australian' ? 'bg-gradient-to-br from-white via-[#f6f672] to-[#ffff2a] border-4 border-black' : 'bg-gray-600'} rounded-2xl p-6 shadow-lg`}>
            <div className="flex items-start">
              <span className="text-4xl mr-4">🛡️</span>
              <div>
                <h4 className={`text-xl font-black mb-2 ${theme === 'bounceworld' ? 'text-black' : theme === 'avengers' ? 'text-white' : theme === 'ponyville' ? 'text-white' : theme === 'cricketverse' ? 'text-white' : theme === 'cricketverse-australian' ? 'text-black' : 'text-white'}`}>Important Information</h4>
                <p className={`font-bold text-lg ${theme === 'bounceworld' ? 'text-black' : theme === 'avengers' ? 'text-white' : theme === 'ponyville' ? 'text-white' : theme === 'cricketverse' ? 'text-white' : theme === 'cricketverse-australian' ? 'text-black' : 'text-black'}`}>
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
