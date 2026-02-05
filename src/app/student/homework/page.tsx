'use client';

import React, { useState, useEffect } from 'react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { getEnrollmentsByStudent } from '@/services/studentEnrollmentService';
import { getStudyMaterialsByClass } from '@/apiservices/studyMaterialService';
import { HomeworkSubmissionService } from '@/apiservices/homeworkSubmissionService';
import { StudyMaterialDocument } from '@/models/studyMaterialSchema';
import { HomeworkSubmissionDocument } from '@/models/homeworkSubmissionSchema';
import { 
  BookOpenCheck,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Filter,
  Search,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import HomeworkSubmissionModal from '@/components/student/HomeworkSubmissionModal';
import { useTheme } from '@/contexts/ThemeContext';

interface HomeworkItem {
  material: StudyMaterialDocument;
  submission?: HomeworkSubmissionDocument;
  className: string;
  classId: string;
  status: 'pending' | 'submitted' | 'late' | 'resubmit_needed' | 'missed';
  dueDate?: Date;
}

export default function StudentHomeworkPage() {
  const { student } = useStudentAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [homeworks, setHomeworks] = useState<HomeworkItem[]>([]);
  const [filteredHomeworks, setFilteredHomeworks] = useState<HomeworkItem[]>([]);
  
  // Filters
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [selectedHomework, setSelectedHomework] = useState<StudyMaterialDocument | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<HomeworkSubmissionDocument | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  useEffect(() => {
    loadHomeworks();
  }, [student]);

  useEffect(() => {
    filterHomeworks();
  }, [homeworks, filter, searchQuery]);

  // Reload when a submission occurs
  useEffect(() => {
    if (!showModal && submissionSuccess) {
      loadHomeworks();
      setSubmissionSuccess(false);
    }
  }, [showModal, submissionSuccess]);

  const loadHomeworks = async () => {
    if (!student) return;
    setLoading(true);

    try {
      // 1. Get Enrollments
      const enrollments = await getEnrollmentsByStudent(student.id);
      
      const allHomeworks: HomeworkItem[] = [];

      // 2. For each class, get materials and filter homework
      for (const enrollment of enrollments) {
        if (enrollment.status !== 'Active') continue;

        const materials = await getStudyMaterialsByClass(enrollment.classId);
        const homeworkMaterials = materials.filter(m => m.isHomework);

        // 3. Get submissions for these homeworks
        for (const material of homeworkMaterials) {
            let submission: HomeworkSubmissionDocument | undefined;
            try {
                submission = await HomeworkSubmissionService.getStudentSubmission(material.id, student.id);
            } catch (err) {
                // No submission found or error
            }

            // Determine status
            let status: HomeworkItem['status'] = 'pending';
            const now = new Date();
            const due = material.dueDate ? new Date(material.dueDate) : null;

            if (submission) {
                if (submission.status === 'resubmit_needed') status = 'resubmit_needed';
                else if (submission.status === 'late') status = 'late';
                else status = 'submitted';
            } else if (due && now > due && !material.allowLateSubmission) {
                status = 'missed';
            } else if (due && now > due) {
                status = 'late'; // Not submitted but past due (if allowed)
            }

            allHomeworks.push({
                material,
                submission,
                className: enrollment.className,
                classId: enrollment.classId,
                status,
                dueDate: due || undefined
            });
        }
      }

      // Sort by due date (nearest first), then by title
      allHomeworks.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.getTime() - b.dueDate.getTime();
      });

      setHomeworks(allHomeworks);

    } catch (error) {
      console.error("Error loading homeworks:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterHomeworks = () => {
    let result = homeworks;

    // Status Filter
    if (filter === 'pending') {
        result = result.filter(h => h.status === 'pending' || h.status === 'resubmit_needed' || h.status === 'late' || h.status === 'missed');
    } else if (filter === 'submitted') {
        result = result.filter(h => h.status === 'submitted');
    }

    // Search Filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        result = result.filter(h => 
            h.material.title.toLowerCase().includes(query) || 
            h.className.toLowerCase().includes(query)
        );
    }

    setFilteredHomeworks(result);
  };

  const handleHomeworkClick = (item: HomeworkItem) => {
    setSelectedHomework(item.material);
    setSelectedSubmission(item.submission || null);
    setSelectedClassId(item.classId);
    setShowModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
        case 'submitted': return 'bg-green-100 text-green-700 border-green-200';
        case 'resubmit_needed': return 'bg-orange-100 text-orange-700 border-orange-200';
        case 'late': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        case 'missed': return 'bg-red-100 text-red-700 border-red-200';
        default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getStatusLabel = (status: string) => {
      switch (status) {
          case 'submitted': return 'Submitted';
          case 'resubmit_needed': return 'Resubmit Req';
          case 'late': return 'Overdue';
          case 'missed': return 'Missed';
          default: return 'Pending';
      }
  };

  const getMarkColor = (mark?: string) => {
      if (!mark) return '';
      if (mark === 'Satisfied') return 'text-green-600 bg-green-50 border-green-200';
      if (mark === 'Incorrect or Incomplete') return 'text-red-600 bg-red-50 border-red-200';
      if (mark === 'Completed but need to resubmit') return 'text-orange-600 bg-orange-50 border-orange-200';
      if (mark === 'Good' || mark === 'Excellent') return 'text-green-600 bg-green-50 border-green-200';
      return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  if (loading) {
      return (
          <div className="flex items-center justify-center p-12">
               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
      );
  }

  return (
    <div className={`min-h-screen p-6 ${theme === 'ben10' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className={`text-3xl font-black ${theme === 'ben10' ? 'text-green-400' : 'text-gray-900'}`}>
                    Homework
                </h1>
                <p className={`${theme === 'ben10' ? 'text-gray-400' : 'text-gray-500'}`}>
                    Track and manage all your homework assignments
                </p>
            </div>

            <div className="flex gap-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Search homework..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
                    />
                </div>
                <div className="flex bg-white rounded-xl border border-gray-200 p-1">
                    <button 
                        onClick={() => setFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        All
                    </button>
                    <button 
                        onClick={() => setFilter('pending')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'pending' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Pending
                    </button>
                    <button 
                        onClick={() => setFilter('submitted')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'submitted' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Submitted
                    </button>
                </div>
            </div>
        </div>

        {/* Content */}
        {filteredHomeworks.length === 0 ? (
            <div className={`text-center py-20 rounded-3xl ${theme === 'ben10' ? 'bg-gray-800 border-gray-700' : 'bg-white border-dashed border-2 border-gray-200'}`}>
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${theme === 'ben10' ? 'bg-gray-700 text-green-500' : 'bg-blue-50 text-blue-500'}`}>
                    <BookOpenCheck className="w-10 h-10" />
                </div>
                <h3 className={`text-xl font-bold mb-2 ${theme === 'ben10' ? 'text-white' : 'text-gray-900'}`}>No homework found</h3>
                <p className={`${theme === 'ben10' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {searchQuery || filter !== 'all' ? "Try adjusting your filters" : "You're all caught up! Great job!"}
                </p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredHomeworks.map((item) => (
                    <div 
                        key={item.material.id}
                        onClick={() => handleHomeworkClick(item)}
                        className={`relative group rounded-2xl p-5 border-2 transition-all cursor-pointer hover:shadow-xl hover:scale-[1.02] ${
                            theme === 'ben10' 
                                ? 'bg-gray-800 border-gray-700 hover:border-green-500' 
                                : 'bg-white border-transparent shadow-sm hover:border-blue-500'
                        }`}
                    >
                        {/* Status Badge */}
                        <div className="flex justify-between items-start mb-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(item.status)}`}>
                                {getStatusLabel(item.status)}
                            </span>
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${theme === 'ben10' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                {item.className}
                            </span>
                        </div>

                        {/* Title */}
                        <h3 className={`text-lg font-bold mb-2 line-clamp-2 ${theme === 'ben10' ? 'text-white' : 'text-gray-900'}`}>
                            {item.material.title}
                        </h3>

                        {/* Details */}
                        <div className="space-y-2 mb-4">
                            {item.dueDate && (
                                <div className={`flex items-center text-sm ${theme === 'ben10' ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <Calendar className="w-4 h-4 mr-2" />
                                    <span>Due: {item.dueDate.toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>

                        {/* Footer: Mark or Action */}
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                             {item.submission?.teacherMark ? (
                                 <div className={`flex items-center px-3 py-1.5 rounded-lg border text-sm font-bold w-full justify-center ${getMarkColor(item.submission.teacherMark)}`}>
                                     {item.submission.teacherMark === 'Satisfied' && <CheckCircle className="w-4 h-4 mr-2" />}
                                     {item.submission.teacherMark === 'Incorrect or Incomplete' && <AlertCircle className="w-4 h-4 mr-2" />}
                                     {item.submission.teacherMark}
                                 </div>
                             ) : (
                                 <div className={`flex items-center text-sm font-semibold w-full justify-center ${
                                     item.status === 'missed' ? 'text-red-500' : 'text-blue-600'
                                 }`}>
                                     {item.status === 'submitted' ? 'View Submission' : item.status === 'missed' ? 'Missed Deadline' : 'Start Homework'}
                                     <ChevronRight className="w-4 h-4 ml-1" />
                                 </div>
                             )}
                        </div>
                    </div>
                ))}
            </div>
        )}

      </div>

      {showModal && selectedHomework && student && (
        <HomeworkSubmissionModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          material={selectedHomework}
          studentId={student.id}
          studentName={student.name}
          classId={selectedClassId}
          existingSubmission={selectedSubmission}
          theme={theme}
        />
      )}
    </div>
  );
}
