'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { getStudyMaterialById } from '@/apiservices/studyMaterialFirestoreService';
import { HomeworkSubmissionService } from '@/apiservices/homeworkSubmissionService';
import { StudentEnrollmentFirestoreService } from '@/apiservices/studentEnrollmentFirestoreService';
import { StudyMaterialDocument } from '@/models/studyMaterialSchema';
import { HomeworkSubmissionDocument } from '@/models/homeworkSubmissionSchema';
import { EnrollmentWithParent } from '@/apiservices/studentEnrollmentFirestoreService';
import { 
  ChevronLeft, 
  ExternalLink, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  User,
  MessageSquare,
  RefreshCcw
} from 'lucide-react';
import { Button } from '@/components/ui';

export default function HomeworkMarkingPage({ params }: { params: Promise<{ materialId: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const materialId = resolvedParams.materialId;
  
  const [material, setMaterial] = useState<StudyMaterialDocument | null>(null);
  const [students, setStudents] = useState<EnrollmentWithParent[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkSubmissionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingStudent, setMarkingStudent] = useState<string | null>(null); // studentId
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    loadData();
  }, [materialId]);

  const loadData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Material
      const mat = await getStudyMaterialById(materialId);
      if (!mat) {
        alert('Material not found');
        router.back();
        return;
      }
      setMaterial(mat);

      // 2. Fetch Class Students
      const classStudents = await StudentEnrollmentFirestoreService.getEnrolledStudentsByClassId(mat.classId);
      setStudents(classStudents);

      // 3. Fetch Submissions
      const subs = await HomeworkSubmissionService.getSubmissionsForMaterial(materialId);
      setSubmissions(subs);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStudentStatus = (studentId: string) => {
    const sub = submissions.find(s => s.studentId === studentId);
    if (!sub) return { status: 'Missing', color: 'text-red-600 bg-red-100' };
    
    if (sub.status === 'resubmit_needed') return { status: 'Resubmit Needed', color: 'text-orange-600 bg-orange-100' };
    if (sub.status === 'approved' || sub.teacherMark?.includes('Good') || sub.teacherMark?.includes('Satisfied')) return { status: 'Graded', color: 'text-green-600 bg-green-100' };
    if (sub.status === 'late') return { status: 'Late', color: 'text-yellow-600 bg-yellow-100' };
    return { status: 'Submitted', color: 'text-blue-600 bg-blue-100' };
  };

  const handleMark = async (studentId: string, mark: 'Good' | 'Satisfied' | 'Not Sufficient') => {
    try {
      await HomeworkSubmissionService.markSubmission(materialId, studentId, {
        teacherMark: mark,
        teacherRemarks: remarks,
        markedBy: 'Teacher', // In real app, get from auth
      });
      
      // Refresh submissions
      const newSubs = await HomeworkSubmissionService.getSubmissionsForMaterial(materialId);
      setSubmissions(newSubs);
      setMarkingStudent(null);
      setRemarks('');
    } catch (error) {
      console.error('Error marking:', error);
      alert('Failed to save mark');
    }
  };

  if (loading || !material) return <TeacherLayout>Loading...</TeacherLayout>;

  return (
    <TeacherLayout>
      <div className="space-y-6">
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="outline" onClick={() => router.back()}>
            <ChevronLeft className="w-5 h-5 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-bold flex-1">{material.title}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats / Info */}
          <div className="lg:col-span-1 space-y-4">
             <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold mb-4">Assignment Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Due Date</span>
                    <span>{material.dueDate ? (material.dueDate instanceof Date ? material.dueDate : material.dueDate.toDate()).toLocaleDateString() : 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type</span>
                    <span className="capitalize">{material.homeworkType || 'Submission'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Allow Late</span>
                    <span>{material.allowLateSubmission ? `Yes` : 'No'}</span>
                  </div>
                </div>
             </div>
          </div>

          {/* Student List */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
               <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                 <h2 className="font-semibold">Student Submissions ({submissions.length}/{students.length})</h2>
               </div>
               
               <div className="divide-y divide-gray-200 dark:divide-gray-700">
                 {students.map(student => {
                   const submission = submissions.find(s => s.studentId === student.studentId);
                   const status = getStudentStatus(student.studentId);
                   const isMarking = markingStudent === student.studentId;

                   return (
                     <div key={student.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                       <div className="flex justify-between items-start mb-2">
                         <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-gray-500" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{student.studentName}</div>
                              <div className={`text-xs px-2 py-0.5 rounded-full w-fit mt-1 ${status.color}`}>
                                {status.status}
                              </div>
                            </div>
                         </div>
                         
                         {submission?.files && submission.files.length > 0 && (
                           <div className="flex space-x-2">
                             {submission.files.map((file, idx) => (
                               <a 
                                 key={idx} 
                                 href={file.url} 
                                 target="_blank" 
                                 rel="noreferrer"
                                 className="flex items-center space-x-1 text-blue-600 hover:underline text-sm"
                               >
                                 <ExternalLink className="w-3 h-3" />
                                 <span>{file.name || `File ${idx+1}`}</span>
                               </a>
                             ))}
                           </div>
                         )}
                         {!submission && <span className="text-sm text-gray-400 italic">No files</span>}
                       </div>

                       {/* Marking Interface */}
                       {(submission || isMarking) && (
                         <div className="mt-4 pl-14">
                           {submission?.message && (
                             <div className="mb-3 bg-gray-50 p-2 rounded text-sm text-gray-600 italic">
                               "{submission.message}"
                             </div>
                           )}

                           {isMarking ? (
                             <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                               <textarea
                                 className="w-full p-2 border rounded-md text-sm"
                                 placeholder="Add remarks (optional)"
                                 value={remarks}
                                 onChange={e => setRemarks(e.target.value)}
                               />
                               <div className="flex gap-2">
                                 <Button size="sm" onClick={() => handleMark(student.studentId, 'Good')} className="bg-green-600 hover:bg-green-700">
                                   Good
                                 </Button>
                                 <Button size="sm" onClick={() => handleMark(student.studentId, 'Satisfied')} className="bg-blue-600 hover:bg-blue-700">
                                   Satisfied
                                 </Button>
                                 <Button size="sm" onClick={() => handleMark(student.studentId, 'Not Sufficient')} className="bg-orange-600 hover:bg-orange-700">
                                   Not Sufficient
                                 </Button>
                                 <Button size="sm" variant="outline" onClick={() => setMarkingStudent(null)}>
                                   Cancel
                                 </Button>
                               </div>
                             </div>
                           ) : (
                             <div className="flex items-center justify-between mt-2">
                               <div className="text-sm">
                                 {submission?.teacherMark && (
                                   <span className="font-semibold text-gray-900 mr-2">
                                     Mark: {submission.teacherMark}
                                   </span>
                                 )}
                                 {submission?.teacherRemarks && (
                                   <span className="text-gray-500">
                                     "{submission.teacherRemarks}"
                                   </span>
                                 )}
                               </div>
                               <Button 
                                 size="sm" 
                                 variant="outline"
                                 className="text-xs"
                                 onClick={() => {
                                   setMarkingStudent(student.studentId);
                                   setRemarks(submission?.teacherRemarks || '');
                                 }}
                                 disabled={!submission && material.homeworkType === 'submission'}
                               >
                                 {submission?.teacherMark ? 'Edit Mark' : 'Mark'}
                               </Button>
                             </div>
                           )}
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>
            </div>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
