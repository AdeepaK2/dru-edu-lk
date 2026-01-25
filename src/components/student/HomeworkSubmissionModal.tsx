import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { HomeworkSubmissionService } from '@/apiservices/homeworkSubmissionService';
import { StudyMaterialDocument } from '@/models/studyMaterialSchema';
import { HomeworkSubmissionDocument } from '@/models/homeworkSubmissionSchema';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface HomeworkSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: StudyMaterialDocument;
  studentId: string;
  studentName: string;
  classId: string;
  existingSubmission?: HomeworkSubmissionDocument | null;
  theme?: string;
}

export default function HomeworkSubmissionModal({
  isOpen,
  onClose,
  material,
  studentId,
  studentName,
  classId,
  existingSubmission,
  theme
}: HomeworkSubmissionModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existingSubmission) {
      setMessage(existingSubmission.message || '');
    }
  }, [existingSubmission]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (material.homeworkType === 'submission' && !file && !existingSubmission) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      let fileData: { url: string; name: string; size: number; type: string }[] = [];
      
      if (file) {
        const storage = getStorage();
        const storageRef = ref(storage, `homework/${classId}/${material.id}/${studentId}/${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        
        fileData = [{
          url,
          name: file.name,
          size: file.size,
          type: file.type
        }];
      } else if (existingSubmission?.files) {
        fileData = existingSubmission.files as any;
      }

      await HomeworkSubmissionService.submitHomework(material.id, studentId, {
        classId,
        studentName,
        files: fileData,
        message
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setFile(null);
      }, 2000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit homework');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border-4 border-black">
        <div className={`p-4 border-b-2 border-gray-100 flex justify-between items-center bg-gray-50`}>
          <h3 className="font-bold text-lg text-gray-900">
            Submit Homework
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">{material.title}</h4>
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              {material.homeworkType === 'manual' 
                ? material.manualInstruction 
                : "Please upload your homework file below."}
            </div>
          </div>

          {material.homeworkType === 'submission' && (
             <div className="space-y-4">
               <div 
                 onClick={() => fileInputRef.current?.click()}
                 className={`border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all ${file ? 'bg-blue-50 border-blue-500' : ''}`}
               >
                 <input 
                   type="file" 
                   ref={fileInputRef} 
                   className="hidden" 
                   onChange={handleFileChange} 
                 />
                 <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                 {file ? (
                   <div>
                     <p className="font-semibold text-blue-600">{file.name}</p>
                     <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                   </div>
                 ) : (
                   <p className="text-gray-500 font-medium">Click to upload file</p>
                 )}
               </div>

               {existingSubmission?.files && existingSubmission.files.length > 0 && !file && (
                 <div 
                    onClick={() => window.open(existingSubmission.files[0].url, '_blank')}
                    className="flex items-center p-3 bg-green-50 rounded-lg border border-green-200 cursor-pointer hover:bg-green-100 transition-colors group"
                 >
                   <FileText className="w-4 h-4 text-green-600 mr-2" />
                   <div className="flex-1 text-sm text-green-800">
                     Current submission: <span className="font-semibold underline group-hover:text-green-900">{existingSubmission.files[0].name}</span>
                   </div>
                   <div className="text-xs text-green-600 font-bold bg-green-200 px-2 py-1 rounded">Download</div>
                 </div>
               )}
             </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message (Optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              rows={3}
              placeholder="Add a note for the teacher..."
            />
          </div>

          {error && (
            <div className="flex items-center text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}
          
          {success && (
            <div className="flex items-center text-green-600 text-sm bg-green-50 p-3 rounded-lg">
              <CheckCircle className="w-4 h-4 mr-2" />
              Submitted successfully!
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
             <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                disabled={uploading || success}
             >
               Cancel
             </button>
             <button
                onClick={handleSubmit}
                disabled={uploading || success}
                className={`px-6 py-2 bg-black text-white font-bold rounded-lg hover:opacity-80 transition-opacity flex items-center ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
               {uploading ? 'Submitting...' : existingSubmission ? 'Update Submission' : 'Submit'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
