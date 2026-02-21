'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui';
import { X, FileText, Check, AlertCircle, Upload, PenLine, ExternalLink } from 'lucide-react';
import { Test } from '@/models/testSchema';
import { InClassSubmission } from '@/models/inClassSubmissionSchema';
import { InClassSubmissionService } from '@/services/inClassSubmissionService';
import { getEnrollmentsByClass } from '@/services/studentEnrollmentService';
import { toast } from 'react-hot-toast';
import TeacherAnnotateDrawer from './TeacherAnnotateDrawer';

interface GradeInClassTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: Test;
  teacherId: string;
}

interface StudentGradeRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  submission?: InClassSubmission;
  marks: string;
  feedback: string;
}

export default function GradeInClassTestModal({
  isOpen,
  onClose,
  test,
  teacherId
}: GradeInClassTestModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<StudentGradeRow[]>([]);
  const [totalMarks] = useState<number>((test as any).totalMarks || 100);

  // Which student's answer is open in the annotate drawer
  const [annotatingStudent, setAnnotatingStudent] = useState<StudentGradeRow | null>(null);
  // Track which studentId is currently uploading a marked PDF
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  // Hidden file inputs per student
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => {
    if (isOpen && test.id) {
      loadStudentsAndSubmissions();
    }
  }, [isOpen, test.id]);

  const loadStudentsAndSubmissions = async () => {
    try {
      setLoading(true);

      const classId = (test as any).classIds?.[0];
      if (!classId) {
        toast.error('No class associated with this test');
        return;
      }

      const enrollments = await getEnrollmentsByClass(classId);
      const submissions = await InClassSubmissionService.getSubmissionsByTest(test.id!);
      const submissionMap = new Map(submissions.map(s => [s.studentId, s]));

      const studentRows: StudentGradeRow[] = enrollments.map(enrollment => {
        const submission = submissionMap.get(enrollment.studentId);
        return {
          studentId: enrollment.studentId,
          studentName: enrollment.studentName || 'Unknown',
          studentEmail: enrollment.studentEmail || '',
          submission,
          marks: submission?.marks?.toString() || '',
          feedback: submission?.feedback || '',
        };
      });

      setStudents(studentRows);
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Failed to load student data');
    } finally {
      setLoading(false);
    }
  };

  const handleMarksChange = (studentId: string, value: string) => {
    setStudents(prev =>
      prev.map(s => s.studentId === studentId ? { ...s, marks: value } : s)
    );
  };

  const handleFeedbackChange = (studentId: string, value: string) => {
    setStudents(prev =>
      prev.map(s => s.studentId === studentId ? { ...s, feedback: value } : s)
    );
  };

  const handleSaveGrade = async (student: StudentGradeRow) => {
    try {
      const marks = parseFloat(student.marks);
      if (isNaN(marks) || marks < 0 || marks > totalMarks) {
        toast.error(`Marks must be between 0 and ${totalMarks}`);
        return;
      }

      if (student.submission?.id) {
        await InClassSubmissionService.gradeSubmission(
          student.submission.id,
          marks,
          student.feedback,
          teacherId,
          totalMarks
        );
      } else {
        await InClassSubmissionService.saveSubmission({
          testId: test.id!,
          studentId: student.studentId,
          studentName: student.studentName,
          studentEmail: student.studentEmail,
          classId: (test as any).classIds[0],
          submissionType: (test as any).submissionMethod,
          status: 'graded',
          marks,
          totalMarks,
          feedback: student.feedback,
          gradedBy: teacherId,
        });
      }

      toast.success(`Saved grade for ${student.studentName}`);
      await loadStudentsAndSubmissions();
    } catch (error) {
      console.error('Error saving grade:', error);
      toast.error('Failed to save grade');
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      for (const student of students) {
        if (student.marks) {
          await handleSaveGrade(student);
        }
      }
      toast.success('All grades saved successfully');
    } catch (error) {
      console.error('Error saving all grades:', error);
      toast.error('Failed to save all grades');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAbsent = async (student: StudentGradeRow) => {
    try {
      if (student.submission?.id) {
        await InClassSubmissionService.saveSubmission({
          ...student.submission,
          status: 'absent',
        });
      } else {
        await InClassSubmissionService.saveSubmission({
          testId: test.id!,
          studentId: student.studentId,
          studentName: student.studentName,
          studentEmail: student.studentEmail,
          classId: (test as any).classIds[0],
          submissionType: (test as any).submissionMethod,
          status: 'absent',
        });
      }

      toast.success(`Marked ${student.studentName} as absent`);
      await loadStudentsAndSubmissions();
    } catch (error) {
      console.error('Error marking absent:', error);
      toast.error('Failed to mark student as absent');
    }
  };

  // ── Marked PDF upload ─────────────────────────────────────────────────────
  const handleUploadMarkedPdf = async (student: StudentGradeRow, file: File) => {
    setUploadingFor(student.studentId);
    try {
      const url = await InClassSubmissionService.uploadMarkedPdf(
        file,
        test.id!,
        student.studentId,
      );

      // Ensure a submission document exists to attach the URL to
      let submissionId = student.submission?.id;
      if (!submissionId) {
        submissionId = await InClassSubmissionService.saveSubmission({
          testId: test.id!,
          studentId: student.studentId,
          studentName: student.studentName,
          studentEmail: student.studentEmail,
          classId: (test as any).classIds[0],
          submissionType: (test as any).submissionMethod,
          status: 'submitted',
        });
      }

      await InClassSubmissionService.saveMarkedPdf(submissionId, url);
      toast.success(`Marked PDF uploaded for ${student.studentName}`);
      await loadStudentsAndSubmissions();
    } catch (err) {
      console.error('Error uploading marked PDF:', err);
      toast.error('Failed to upload marked PDF');
    } finally {
      setUploadingFor(null);
    }
  };

  // ── Annotation saved callback ─────────────────────────────────────────────
  const handleAnnotationSaved = async () => {
    setAnnotatingStudent(null);
    await loadStudentsAndSubmissions();
  };

  const gradingProgress = () => {
    const graded = students.filter(s => s.submission?.status === 'graded').length;
    return `${graded}/${students.length} students graded`;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="border-b p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{test.title} — Grading</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {gradingProgress()} · Total Marks: {totalMarks}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* ── Student list ─────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-20">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No students enrolled in this class</p>
              </div>
            ) : (
              <div className="space-y-4">
                {students.map((student) => (
                  <div
                    key={student.studentId}
                    className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">

                      {/* Student info — 3 cols */}
                      <div className="md:col-span-3">
                        <h4 className="font-semibold text-gray-900">{student.studentName}</h4>
                        <p className="text-sm text-gray-500">{student.studentEmail}</p>
                        {student.submission?.status && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-2 ${
                            student.submission.status === 'graded'
                              ? 'bg-green-100 text-green-800'
                              : student.submission.status === 'submitted'
                              ? 'bg-blue-100 text-blue-800'
                              : student.submission.status === 'absent'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {student.submission.status === 'graded' && <Check className="w-3 h-3 mr-1" />}
                            {student.submission.status.charAt(0).toUpperCase() + student.submission.status.slice(1)}
                          </span>
                        )}
                      </div>

                      {/* Submission & marking actions — 3 cols */}
                      <div className="md:col-span-3 flex flex-col gap-2">
                        {/* View student answer */}
                        {student.submission?.answerFileUrl ? (
                          <a
                            href={student.submission.answerFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-blue-600 hover:underline text-sm"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View Answer
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">No submission</span>
                        )}

                        {/* Annotate on canvas (only if student submitted) */}
                        {student.submission?.answerFileUrl && (
                          <button
                            onClick={() => setAnnotatingStudent(student)}
                            className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-colors"
                          >
                            <PenLine className="w-3.5 h-3.5" />
                            Annotate Answer
                          </button>
                        )}

                        {/* Upload marked PDF */}
                        <div>
                          <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            ref={el => {
                              if (el) fileInputRefs.current.set(student.studentId, el);
                            }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadMarkedPdf(student, file);
                              e.target.value = '';
                            }}
                          />
                          <button
                            onClick={() => fileInputRefs.current.get(student.studentId)?.click()}
                            disabled={uploadingFor === student.studentId}
                            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium disabled:opacity-50 transition-colors"
                          >
                            {uploadingFor === student.studentId ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                Uploading…
                              </>
                            ) : (
                              <>
                                <Upload className="w-3.5 h-3.5" />
                                Upload Marked PDF
                              </>
                            )}
                          </button>
                        </div>

                        {/* View already-saved marked PDF */}
                        {student.submission?.markedPdfUrl && (
                          <a
                            href={student.submission.markedPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-emerald-600 hover:underline text-sm"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Marked PDF
                          </a>
                        )}
                      </div>

                      {/* Marks — 2 cols */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Marks / {totalMarks}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={totalMarks}
                          value={student.marks}
                          onChange={(e) => handleMarksChange(student.studentId, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>

                      {/* Feedback — 3 cols */}
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Feedback (Optional)
                        </label>
                        <textarea
                          value={student.feedback}
                          onChange={(e) => handleFeedbackChange(student.studentId, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={2}
                          placeholder="Add feedback…"
                        />
                      </div>

                      {/* Save / absent — 1 col */}
                      <div className="md:col-span-1 flex flex-col items-end gap-2">
                        {student.submission?.status === 'absent' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkAbsent(student)}
                            className="w-full text-gray-500"
                          >
                            Absent
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleSaveGrade(student)}
                              disabled={!student.marks}
                              className="w-full"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkAbsent(student)}
                              className="w-full text-xs"
                            >
                              Mark Absent
                            </Button>
                          </>
                        )}
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="border-t p-6 flex justify-between items-center bg-gray-50">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleSaveAll} disabled={saving || students.every(s => !s.marks)}>
              {saving ? 'Saving...' : 'Save All Grades'}
            </Button>
          </div>

        </div>
      </div>

      {/* ── Teacher annotation full-screen drawer ──────────────────────── */}
      {annotatingStudent && annotatingStudent.submission && (
        <TeacherAnnotateDrawer
          submission={annotatingStudent.submission}
          studentName={annotatingStudent.studentName}
          totalMarks={totalMarks}
          teacherId={teacherId}
          onClose={() => setAnnotatingStudent(null)}
          onSaved={handleAnnotationSaved}
        />
      )}
    </>
  );
}
