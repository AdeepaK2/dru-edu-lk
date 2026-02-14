'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Save,
  Search,
  FileText,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Award,
  Download,
  RotateCcw
} from 'lucide-react';
import { 
  HomeworkFirestoreService, 
  HomeworkSubmissionData,
  HomeworkSubmissionDocument
} from '@/apiservices/homeworkFirestoreService';
import { StudentEnrollmentFirestoreService } from '@/apiservices/studentEnrollmentFirestoreService';
import PDFViewer from '@/components/PDFViewer';
import Button from '@/components/ui/Button';

interface MarkHomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  homework: { id: string; title: string; maxMarks?: number };
  classId: string;
  collectionName?: string;
  submissionType?: 'manual' | 'online';
}

interface ExtendedStudentSubmission {
  studentId: string;
  studentName: string;
  status: 'submitted' | 'not_submitted' | 'late' | 'excused' | 'resubmit_needed';
  submissionId?: string;
  submittedAt?: Date;
  files?: { url: string; name: string; type?: string }[];
  marks?: number;
  remarks?: string;
  teacherMark?: 'Excellent' | 'Good' | 'Satisfied' | 'Satisfactory' | 'Needs Improvement' | 'Not Sufficient' | 'Unsatisfactory' | 'Incorrect or Incomplete' | 'Completed but need to resubmit'; // Maps to Good, Satisfactory, Not Satisfactory
  isChanged: boolean;
}

type TabType = 'submitted' | 'late' | 'not_submitted' | 'issues';

const MarkHomeworkModal: React.FC<MarkHomeworkModalProps> = ({
  isOpen,
  onClose,
  onSave,
  homework,
  classId,
  collectionName = 'homework',
  submissionType = 'online'
}) => {
  const [students, setStudents] = useState<ExtendedStudentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('submitted');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen && homework) {
      loadData();
    }
  }, [isOpen, homework]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError('');

      // 1. Load Enrolled Students
      const enrollments = await StudentEnrollmentFirestoreService.getEnrolledStudentsByClassId(classId);
      
      // 2. Load Submissions
      const submissions = await HomeworkFirestoreService.getSubmissions(homework.id, collectionName);
      const submissionMap = new Map(submissions.map(s => [s.studentId, s]));

      // 3. Merge
      const list: ExtendedStudentSubmission[] = enrollments.map((enr: any) => {
        const sub = submissionMap.get(enr.studentId) as any;
        
        // Normalize status
        let status: ExtendedStudentSubmission['status'] = 'not_submitted';
        if (sub?.status) {
           if (['submitted', 'late', 'excused', 'resubmit_needed'].includes(sub.status)) {
               status = sub.status as any;
           } else if (sub.status === 'approved' || sub.status === 'rejected') {
               status = 'submitted'; 
           }
        }

        // files handling: support both 'files' array and legacy 'fileUrl'
        let files = sub?.files || [];
        if (!files.length && sub?.fileUrl) {
            files = [{ url: sub.fileUrl, name: 'Submission.pdf' }]; // Fallback name
        }

        return {
          studentId: enr.studentId,
          studentName: enr.studentName,
          status,
          submissionId: sub?.id,
          submittedAt: sub?.submittedAt ? (sub.submittedAt.toDate ? sub.submittedAt.toDate() : sub.submittedAt) : undefined,
          files: files,
          marks: sub?.numericMark || sub?.marks,
          remarks: sub?.teacherRemarks || sub?.remarks,
          teacherMark: sub?.teacherMark,
          isChanged: false
        };
      });

      // Sort by name
      list.sort((a, b) => a.studentName.localeCompare(b.studentName));
      setStudents(list);
      
      // Auto-select first student in default tab if available
      const firstInTab = list.find(s => getTabForStatus(s.status) === 'submitted');
      if (firstInTab) setSelectedStudentId(firstInTab.studentId);

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const getTabForStatus = (status: ExtendedStudentSubmission['status']): TabType => {
    if (status === 'resubmit_needed') return 'issues';
    if (status === 'late') return 'late';
    if (status === 'not_submitted') return 'not_submitted';
    return 'submitted'; // submitted, excused (maybe?), approved
  };

  const filteredStudents = students.filter(s => {
    const matchesTab = getTabForStatus(s.status) === activeTab;
    const matchesSearch = s.studentName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const selectedStudent = students.find(s => s.studentId === selectedStudentId);

  const handleMarking = (type: 'Satisfied' | 'Incorrect or Incomplete' | 'Completed but need to resubmit') => {
    if (!selectedStudent) return;

    setStudents(prev => prev.map(s => {
      if (s.studentId === selectedStudent.studentId) {
        let newStatus = s.status;
        let teacherMark: ExtendedStudentSubmission['teacherMark'] = type;

        // Logic: 
        // Satisfied -> Submitted (Approved)
        // Incorrect or Incomplete -> Resubmit Needed (Issues tab)
        // Completed but need to resubmit -> Resubmit Needed (Issues tab)

        if (type === 'Satisfied') {
             // Promote to submitted if currently in issues/not_submitted
             if (s.status === 'resubmit_needed' || s.status === 'not_submitted') {
                 newStatus = 'submitted';
             }
             // existing submitted/late statuses are preserved as they indicate timeliness
        } else {
             // Demote to issues
             newStatus = 'resubmit_needed';
        }

        return {
          ...s,
          status: newStatus,
          teacherMark,
          isChanged: true
        };
      }
      return s;
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const changed = students.filter(s => s.isChanged);
      if (changed.length === 0) {
          onClose();
          return;
      }

      await Promise.all(changed.map(async (s) => {
        // We need to update using markSubmission or bulk.
        // Since statuses might change differently, bulk might be tricky if statuses vary.
        // But bulkMarkSubmissions typically updates detailed fields. 
        // Let's use individual updates or a smarter bulk. 
        // HomeworkFirestoreService.markSubmission handles update.
        
        await HomeworkFirestoreService.markSubmission(
            homework.id,
            s.studentId,
            {
                studentName: s.studentName,
                status: (s.status === 'resubmit_needed' ? 'resubmit_needed' : (s.status === 'late' ? 'late' : 'submitted')) as any, 
                teacherMark: s.teacherMark,
                teacherRemarks: s.remarks,
                numericMark: s.marks,
                markedBy: 'teacher' // TODO: Get actual teacher ID
            },
            collectionName
        );
      }));

      onSave(); // Refresh parent
      onClose();

    } catch (err) {
      console.error('Error saving:', err);
      setError('Failed to save changes');
    } finally {
        setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex overflow-hidden">
        
        {/* LEFT SIDEBAR: Student List */}
        <div className="w-1/4 min-w-[300px] border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-900/50">
          
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate" title={homework.title}>
              {homework.title}
            </h2>
            <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">Marking Submissions</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${submissionType === 'manual' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {submissionType === 'manual' ? 'Manual' : 'Online'}
                </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto scrollbar-hide">
             {[
                 { id: 'submitted', label: 'Submitted', icon: CheckCircle, color: 'text-green-600' },
                 { id: 'late', label: 'Late', icon: Clock, color: 'text-amber-600' },
                 { id: 'issues', label: 'Issues', icon: AlertCircle, color: 'text-red-600' },
                 { id: 'not_submitted', label: 'Missing', icon: XCircle, color: 'text-gray-400' },
             ].map(tab => (
                 <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`flex-1 flex flex-col items-center justify-center py-3 px-1 border-b-2 transition-colors ${
                        activeTab === tab.id 
                        ? `border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20` 
                        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                 >
                    <tab.icon className={`w-4 h-4 mb-1 ${activeTab === tab.id ? tab.color : 'text-gray-400'}`} />
                    <span className={`text-[10px] font-medium uppercase tracking-wide ${activeTab === tab.id ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                        {tab.label}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                        {students.filter(s => getTabForStatus(s.status) === tab.id).length}
                    </span>
                 </button>
             ))}
          </div>

          {/* Search */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border-none rounded-md focus:ring-1 focus:ring-indigo-500"
                />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
             {isLoading ? (
                 <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div></div>
             ) : filteredStudents.length === 0 ? (
                 <div className="text-center py-10 text-gray-500 text-sm">No students</div>
             ) : (
                filteredStudents.map(student => (
                    <div 
                        key={student.studentId}
                        onClick={() => setSelectedStudentId(student.studentId)}
                        className={`p-3 rounded-lg cursor-pointer transition-all border ${
                            selectedStudentId === student.studentId
                            ? 'bg-white dark:bg-gray-800 border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                            : 'bg-white dark:bg-gray-800 border-transparent hover:border-gray-200 dark:hover:border-gray-600'
                        }`}
                    >
                        <div className="flex justify-between items-start">
                            <span className="font-medium text-sm text-gray-900 dark:text-gray-200">{student.studentName}</span>
                            {student.isChanged && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5"></span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            {student.teacherMark && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                    student.teacherMark === 'Excellent' ? 'bg-emerald-100 text-emerald-700' :
                                    student.teacherMark === 'Good' ? 'bg-blue-100 text-blue-700' :
                                    (student.teacherMark === 'Satisfactory' || student.teacherMark === 'Satisfied') ? 'bg-amber-100 text-amber-700' :
                                    student.teacherMark === 'Needs Improvement' ? 'bg-orange-100 text-orange-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                    {/* Display Logic */}
                                    {((student.teacherMark === 'Unsatisfactory' || student.teacherMark === 'Not Sufficient') ? 'Issues' : student.teacherMark) || 'Marked'}
                                </span>
                            )}
                            {!student.files?.length && activeTab !== 'not_submitted' && activeTab !== 'issues' && submissionType === 'online' && (
                                <span className="text-[10px] text-gray-400 italic">No files</span>
                            )}
                        </div>
                    </div>
                ))
             )}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
               <Button onClick={handleSave} className="w-full justify-center" disabled={isSaving}>
                   {isSaving ? 'Saving...' : 'Save & Close'}
               </Button>
          </div>
        </div>

        {/* RIGHT CONTENT: Grading Area */}
        <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-900 h-full relative">
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
            >
                <X className="w-5 h-5" />
            </button>

            {selectedStudent ? (
                <>
                    {/* Toolbar / Student Info */}
                    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center shadow-sm z-20 flex-shrink-0">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {selectedStudent.studentName}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {submissionType === 'online' 
                                    ? `${selectedStudent.files?.length} file(s) • Submitted ${selectedStudent.submittedAt?.toLocaleDateString() || '-'}`
                                    : `Manual Submission • ${selectedStudent.submittedAt ? `Submitted ${selectedStudent.submittedAt.toLocaleDateString()}` : 'Not submitted yet'}`
                                }
                            </p>
                        </div>
                        
                        {/* Marking Actions */}
                        <div className="flex flex-col gap-2 items-end">
                            {/* Marking Buttons */}
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                <Button 
                                    onClick={() => handleMarking('Satisfied')}
                                    variant={selectedStudent.teacherMark === 'Satisfied' ? 'primary' : 'outline'}
                                    className={`gap-1.5 h-auto py-1.5 px-3 text-xs ${selectedStudent.teacherMark === 'Satisfied' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}
                                    title="Mark as Satisfied"
                                >
                                    <CheckCircle className="w-3.5 h-3.5" /> Satisfied
                                </Button>
                                
                                <Button 
                                    onClick={() => handleMarking('Incorrect or Incomplete')}
                                    variant={selectedStudent.teacherMark === 'Incorrect or Incomplete' ? 'primary' : 'outline'}
                                    className={`gap-1.5 h-auto py-1.5 px-3 text-xs ${selectedStudent.teacherMark === 'Incorrect or Incomplete' ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-red-600 border-red-200 hover:bg-red-50'}`}
                                    title="Mark as Incorrect or Incomplete"
                                >
                                    <XCircle className="w-3.5 h-3.5" /> Incorrect or Incomplete
                                </Button>
                                
                                <Button 
                                    onClick={() => handleMarking('Completed but need to resubmit')}
                                    variant={selectedStudent.teacherMark === 'Completed but need to resubmit' ? 'primary' : 'outline'}
                                    className={`gap-1.5 h-auto py-1.5 px-3 text-xs ${selectedStudent.teacherMark === 'Completed but need to resubmit' ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'text-orange-600 border-orange-200 hover:bg-orange-50'}`}
                                    title="Mark as Completed but need to resubmit"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" /> Completed but need to resubmit
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 bg-gray-200 dark:bg-gray-950 flex flex-col items-center justify-center p-4 overflow-hidden relative isolate z-0">
                         {submissionType === 'manual' ? (
                             <div className="text-center text-gray-500">
                                 <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                 <p className="text-lg font-medium">Manual Submission</p>
                                 <p className="text-sm max-w-sm mx-auto">This is a manual homework assignment. No files are expected from the student. You can mark the submission based on physical or offline work.</p>
                             </div>
                         ) : selectedStudent.files && selectedStudent.files.length > 0 ? (
                             <div className="w-full h-full bg-white shadow-lg rounded-lg overflow-hidden relative flex flex-col">
                                 <PDFViewer 
                                     url={selectedStudent.files[0].url} 
                                     title={selectedStudent.files[0].name}
                                     onClose={() => {}} 
                                     inline={true}
                                 />
                                 
                                 {selectedStudent.files.length > 1 && (
                                     <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm">
                                         File 1 of {selectedStudent.files.length} (Viewing {selectedStudent.files[0].name})
                                     </div>
                                 )}
                             </div>
                         ) : (
                             <div className="text-center text-gray-500">
                                 <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                 <p className="text-lg font-medium">No files submitted</p>
                                 <p className="text-sm">Student has not uploaded any documents.</p>
                             </div>
                         )}
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                        <Search className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="text-lg font-medium text-gray-500">Select a student</p>
                    <p className="text-sm">Choose a student from the sidebar to view detailed info.</p>
                </div>
            )}

      </div>
      </div>
    </div>
  );
};

export default MarkHomeworkModal;
