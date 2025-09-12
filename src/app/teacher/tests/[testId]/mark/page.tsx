'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Download, 
  Eye, 
  FileText, 
  Clock, 
  User, 
  CheckCircle,
  AlertCircle,
  GraduationCap,
  Save,
  Star,
  MessageSquare,
  Calendar,
  BookOpen,
  Users
} from 'lucide-react';

// Import services and types
import { TestService } from '@/apiservices/testService';
import { SubmissionService } from '@/apiservices/submissionService';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { Test } from '@/models/testSchema';
import { PdfAttachment } from '@/models/studentSubmissionSchema';
import { Button, TextArea } from '@/components/ui';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';

interface SubmissionWithStudent {
  id: string;
  testId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  submittedAt: string;
  status: string;
  submissionPdf?: PdfAttachment;
  additionalNotes?: string;
  overallGrade?: {
    totalMarks: number;
    maxMarks: number;
    feedback: string;
    gradedAt?: Date;
  };
  answers?: any;
  finalAnswers?: any[];
}

interface OverallGrade {
  totalMarks: number;
  maxMarks: number;
  feedback: string;
}

export default function MarkSubmissions() {
  const params = useParams();
  const router = useRouter();
  const { teacher } = useTeacherAuth();
  const testId = params.testId as string;
  
  const [test, setTest] = useState<Test | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionWithStudent[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithStudent | null>(null);
  const [overallGrades, setOverallGrades] = useState<Record<string, OverallGrade>>({});
  const [loading, setLoading] = useState(true);
  const [savingGrades, setSavingGrades] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load test and submissions
  useEffect(() => {
    const loadData = async () => {
      if (!testId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Load test details
        const testData = await TestService.getTestById(testId);
        setTest(testData);
        
        // Load submissions for this test
        const submissionData = await SubmissionService.getSubmissionsByTest(testId);
        
        // Process submissions for single PDF format only
        const processedSubmissions: SubmissionWithStudent[] = submissionData.map((submission: any) => {
          // Handle submission date properly
          let submissionDate = 'Unknown date';
          if (submission.submittedAt) {
            try {
              if (typeof submission.submittedAt.toDate === 'function') {
                submissionDate = submission.submittedAt.toDate().toLocaleDateString();
              } else if (submission.submittedAt.seconds) {
                submissionDate = new Date(submission.submittedAt.seconds * 1000).toLocaleDateString();
              } else if (submission.submittedAt instanceof Date) {
                submissionDate = submission.submittedAt.toLocaleDateString();
              }
            } catch (error) {
              console.warn('Error formatting submission date:', error);
            }
          }
          
          // Get submission PDF from finalAnswers for essay questions
          let submissionPdf = null;
          let additionalNotes = '';
          
          if (submission.finalAnswers && Array.isArray(submission.finalAnswers)) {
            // Look for essay questions with PDF files
            for (const answer of submission.finalAnswers) {
              if (answer.questionType === 'essay' && answer.pdfFiles && answer.pdfFiles.length > 0) {
                submissionPdf = answer.pdfFiles[0]; // Use the first PDF file
                break;
              }
              // Also check for additional notes
              if (answer.textContent) {
                additionalNotes = answer.textContent;
              }
            }
            
            // Special case: Look for submission_pdf question (essay test single PDF submission)
            const submissionPdfAnswer = submission.finalAnswers.find((answer: any) => 
              answer.questionId === 'submission_pdf'
            );
            if (submissionPdfAnswer && submissionPdfAnswer.pdfFiles && submissionPdfAnswer.pdfFiles.length > 0) {
              submissionPdf = submissionPdfAnswer.pdfFiles[0];
            }
          }
          
          // Fallback: Check legacy format for backward compatibility
          if (!submissionPdf) {
            submissionPdf = submission.answers?.['submission_pdf']?.pdfFiles?.[0] || null;
          }
          if (!additionalNotes) {
            additionalNotes = submission.answers?.['additional_notes']?.textContent || '';
          }
          
          console.log('📝 Processing submission:', submission.id, {
            hasSubmissionPdf: !!submissionPdf,
            finalAnswersCount: submission.finalAnswers?.length || 0,
            legacyAnswers: !!submission.answers
          });
          
          return {
            id: submission.id,
            testId: submission.testId,
            studentId: submission.studentId,
            studentName: submission.studentName || 'Unknown Student',
            studentEmail: submission.studentEmail || 'unknown@email.com',
            submittedAt: submissionDate,
            status: submission.status,
            submissionPdf,
            additionalNotes,
            overallGrade: submission.overallGrade || null,
            answers: submission.answers,
            finalAnswers: submission.finalAnswers
          };
        });
        
        setSubmissions(processedSubmissions);
        
        // Initialize overall grades from existing data
        const initialOverallGrades: Record<string, OverallGrade> = {};
        const totalMarks = testData.questions
          .filter(q => q.type === 'essay' || q.questionType === 'essay')
          .reduce((sum, q) => sum + (q.points || q.marks || 0), 0);
        
        processedSubmissions.forEach(submission => {
          if (submission.overallGrade) {
            initialOverallGrades[submission.id] = submission.overallGrade;
          } else {
            // Initialize with default values
            initialOverallGrades[submission.id] = {
              totalMarks: 0,
              maxMarks: totalMarks,
              feedback: ''
            };
          }
        });
        
        setOverallGrades(initialOverallGrades);
        
      } catch (err: any) {
        console.error('Error loading data:', err);
        setError(err.message || 'Failed to load submissions');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [testId]);

  // Update overall grade for single PDF submissions
  const updateOverallGrade = (submissionId: string, totalMarks: number, feedback: string) => {
    const validMarks = typeof totalMarks === 'number' ? totalMarks : Number(totalMarks) || 0;
    
    setOverallGrades(prev => {
      const existing = prev[submissionId];
      return {
        ...prev,
        [submissionId]: {
          totalMarks: validMarks,
          maxMarks: existing?.maxMarks || 0,
          feedback
        }
      };
    });
  };

  // Save grades for a submission
  const saveGrades = async (submissionId: string) => {
    setSavingGrades(true);
    try {
      const submission = submissions.find(s => s.id === submissionId);
      if (!submission) throw new Error('Submission not found');

      const grade = overallGrades[submissionId];
      if (!grade) throw new Error('Grade not found');

      // Save grade directly to Firestore
      const submissionRef = doc(firestore, 'studentSubmissions', submissionId);
      const updateData = {
        overallGrade: {
          totalMarks: grade.totalMarks,
          maxMarks: grade.maxMarks,
          feedback: grade.feedback,
          gradedAt: Timestamp.fromDate(new Date())
        },
        totalScore: grade.totalMarks,
        percentage: grade.maxMarks > 0 ? Math.round((grade.totalMarks / grade.maxMarks) * 100) : 0,
        passStatus: grade.maxMarks > 0 && grade.totalMarks >= (grade.maxMarks * 0.6) ? 'passed' : 'failed',
        manualGradingPending: false,
        updatedAt: Timestamp.now()
      };
      
      await updateDoc(submissionRef, updateData);
      
      // Update test statistics
      try {
        const { TestStatisticsService } = await import('@/apiservices/testStatisticsService');
        await TestStatisticsService.updateStatisticsForGradedSubmission(testId);
        console.log('✅ Test statistics updated for graded submission');
      } catch (statsError) {
        console.warn('⚠️ Failed to update test statistics:', statsError);
        // Don't fail the grading process if statistics update fails
      }
      
      console.log('✅ Grade saved successfully to database');
      
      // Update local submission data
      setSubmissions(prev => prev.map(sub => 
        sub.id === submissionId 
          ? { 
              ...sub, 
              overallGrade: {
                ...grade,
                gradedAt: new Date()
              }
            }
          : sub
      ));
      
      alert('Grade saved successfully!');
    } catch (error) {
      console.error('Error saving grade:', error);
      alert('Failed to save grade. Please try again.');
    } finally {
      setSavingGrades(false);
    }
  };

  // Download PDF file
  const downloadPdf = (fileUrl: string, fileName: string) => {
    window.open(fileUrl, '_blank');
  };

  // Get total score for a submission
  const getTotalScore = (submissionId: string) => {
    return overallGrades[submissionId]?.totalMarks || 0;
  };

  // Get max possible score
  const getMaxScore = (submissionId: string) => {
    return overallGrades[submissionId]?.maxMarks || 0;
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 border-t-4 border-blue-600 border-solid rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">Loading submissions...</p>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  if (error) {
    return (
      <TeacherLayout>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.back()}
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Tests</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => router.back()}
                  className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5 mr-1" />
                  Back
                </button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Mark Submissions - {test?.title}
                </h1>
                {/* Test Type Badge */}
                {test && (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}>
                    {test.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                      ? test.questions?.every(q => q.type === 'essay' || q.questionType === 'essay')
                        ? '📝 Essay Test'
                        : '📝📊 Mixed Test'
                      : '📊 MCQ Test'
                    }
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {test?.questions?.some(q => q.type === 'essay' || q.questionType === 'essay')
                  ? 'Review and grade essay submissions'
                  : 'Review MCQ test submissions'
                }
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>{submissions.length} submissions</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submissions List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Student Submissions
            </h2>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {submissions.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  No submissions yet
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Students haven't submitted their essays yet.
                </p>
              </div>
            ) : (
              submissions.map((submission) => (
                <div key={submission.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <User className="h-8 w-8 text-gray-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                            {submission.studentName}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {submission.studentEmail}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Submitted: {submission.submittedAt}</span>
                        </div>
                        
                        {submission.submissionPdf && (
                          <div className="flex items-center space-x-1">
                            <FileText className="h-4 w-4" />
                            <span>PDF Submitted</span>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-1">
                          <GraduationCap className="h-4 w-4" />
                          <span>
                            Score: {getTotalScore(submission.id)}/{getMaxScore(submission.id)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {submission.submissionPdf && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadPdf(submission.submissionPdf!.fileUrl, submission.submissionPdf!.fileName)}
                          className="flex items-center space-x-2"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download PDF</span>
                        </Button>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSubmission(submission)}
                        className="flex items-center space-x-2"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Grade</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Grading Panel */}
        {selectedSubmission && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  Grading: {selectedSubmission.studentName}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSubmission(null)}
                >
                  Close
                </Button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Student Info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Student</label>
                    <p className="text-sm text-gray-900 dark:text-white">{selectedSubmission.studentName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Submitted</label>
                    <p className="text-sm text-gray-900 dark:text-white">{selectedSubmission.submittedAt}</p>
                  </div>
                </div>
              </div>

              {/* Submission PDF */}
              {selectedSubmission.submissionPdf ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Answer Sheet
                  </label>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-8 w-8 text-red-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {selectedSubmission.submissionPdf.fileName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            PDF Document
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadPdf(
                          selectedSubmission.submissionPdf!.fileUrl, 
                          selectedSubmission.submissionPdf!.fileName
                        )}
                        className="flex items-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    No answer sheet submitted
                  </p>
                </div>
              )}

              {/* Additional Notes */}
              {selectedSubmission.additionalNotes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Student Notes
                  </label>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-sm text-gray-900 dark:text-white">
                      {selectedSubmission.additionalNotes}
                    </p>
                  </div>
                </div>
              )}

              {/* Grading Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Overall Grade
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Total Marks
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        max={getMaxScore(selectedSubmission.id)}
                        value={overallGrades[selectedSubmission.id]?.totalMarks || 0}
                        onChange={(e) => updateOverallGrade(
                          selectedSubmission.id,
                          Number(e.target.value),
                          overallGrades[selectedSubmission.id]?.feedback || ''
                        )}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        / {getMaxScore(selectedSubmission.id)}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Percentage
                    </label>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {getMaxScore(selectedSubmission.id) > 0 
                          ? Math.round((getTotalScore(selectedSubmission.id) / getMaxScore(selectedSubmission.id)) * 100)
                          : 0
                        }%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Feedback
                  </label>
                  <TextArea
                    value={overallGrades[selectedSubmission.id]?.feedback || ''}
                    onChange={(e) => updateOverallGrade(
                      selectedSubmission.id,
                      overallGrades[selectedSubmission.id]?.totalMarks || 0,
                      e.target.value
                    )}
                    placeholder="Provide overall feedback for the student's performance..."
                    rows={4}
                    className="w-full"
                  />
                </div>
                
                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={() => saveGrades(selectedSubmission.id)}
                    disabled={savingGrades}
                    className="flex items-center space-x-2"
                  >
                    {savingGrades ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Grade</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
