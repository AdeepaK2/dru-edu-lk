'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { X, Info, CheckCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { InClassSubmission } from '@/models/inClassSubmissionSchema';
import { InClassSubmissionService } from '@/services/inClassSubmissionService';

const CanvasWriter = dynamic(() => import('@/components/ui/CanvasWriter'), { ssr: false });

interface TeacherAnnotateDrawerProps {
  submission: InClassSubmission;
  studentName: string;
  totalMarks: number;
  teacherId: string;
  onClose: () => void;
  /** Called after grade is fully saved — parent reloads the student list */
  onSaved: () => void;
}

type Phase = 'annotate' | 'grade';

export default function TeacherAnnotateDrawer({
  submission,
  studentName,
  totalMarks,
  teacherId,
  onClose,
  onSaved,
}: TeacherAnnotateDrawerProps) {
  const [phase, setPhase] = useState<Phase>('annotate');
  const [savingPdf, setSavingPdf] = useState(false);
  const [submittingGrade, setSubmittingGrade] = useState(false);

  // Populated after the PDF is uploaded
  const [savedPdfUrl, setSavedPdfUrl] = useState<string | null>(
    submission.markedPdfUrl ?? null,
  );

  // Pre-fill with existing grade if the teacher is re-grading
  const [marks, setMarks] = useState(
    submission.marks !== undefined ? String(submission.marks) : '',
  );
  const [feedback, setFeedback] = useState(submission.feedback ?? '');

  // ── Phase 1: CanvasWriter calls this when teacher hits "Submit Answer" ──────
  const handleSavePdf = async (file: File) => {
    setSavingPdf(true);
    try {
      const url = await InClassSubmissionService.uploadMarkedPdf(
        file,
        submission.testId,
        submission.studentId,
      );
      if (submission.id) {
        await InClassSubmissionService.saveMarkedPdf(submission.id, url);
      }
      setSavedPdfUrl(url);
      toast.success('Annotation saved — enter marks to finalize');
      setPhase('grade');
    } catch (err) {
      console.error('[TeacherAnnotateDrawer] PDF save failed:', err);
      toast.error('Failed to save annotated PDF. Please try again.');
    } finally {
      setSavingPdf(false);
    }
  };

  // ── Phase 2: Submit the grade ─────────────────────────────────────────────
  const handleSubmitGrade = async () => {
    const numMarks = parseFloat(marks);
    if (isNaN(numMarks) || numMarks < 0 || numMarks > totalMarks) {
      toast.error(`Marks must be between 0 and ${totalMarks}`);
      return;
    }

    setSubmittingGrade(true);
    try {
      if (submission.id) {
        await InClassSubmissionService.gradeSubmission(
          submission.id,
          numMarks,
          feedback,
          teacherId,
          totalMarks,
        );
      } else {
        // Submission doc doesn't exist yet — create it with everything at once
        await InClassSubmissionService.saveSubmission({
          ...submission,
          marks: numMarks,
          totalMarks,
          feedback,
          gradedBy: teacherId,
          status: 'graded',
          markedPdfUrl: savedPdfUrl ?? undefined,
        });
      }
      toast.success(`Grade submitted for ${studentName}`);
      onSaved();
    } catch (err) {
      console.error('[TeacherAnnotateDrawer] grade submit failed:', err);
      toast.error('Failed to submit grade. Please try again.');
    } finally {
      setSubmittingGrade(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white shrink-0">
        <div className="flex items-center gap-3">
          {phase === 'grade' && (
            <button
              onClick={() => setPhase('annotate')}
              title="Back to annotation"
              className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-widest">
              {phase === 'annotate' ? 'Annotating answer for' : 'Submit marks for'}
            </p>
            <h2 className="text-base font-semibold leading-tight">{studentName}</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {savingPdf && (
            <span className="flex items-center gap-1.5 text-xs text-amber-300 animate-pulse">
              <div className="w-3 h-3 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
              Saving…
            </span>
          )}
          <button
            onClick={onClose}
            title="Close"
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Phase 1: Annotate ──────────────────────────────────────────── */}
      {phase === 'annotate' && (
        <>
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs shrink-0">
            <Info size={13} className="shrink-0" />
            <span>
              Annotate the student&apos;s answer, then press{' '}
              <strong>Submit Answer</strong> in the toolbar to save and proceed to marks entry.
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <CanvasWriter
              pdfUrl={submission.answerFileUrl}
              onSavePdf={handleSavePdf}
              className="h-full"
            />
          </div>
        </>
      )}

      {/* ── Phase 2: Enter & submit grade ─────────────────────────────── */}
      {phase === 'grade' && (
        <div className="flex-1 flex items-center justify-center bg-gray-50 p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md p-8">

            {/* Annotation confirmed */}
            <div className="flex items-center gap-3 mb-6 p-3 bg-green-50 rounded-xl border border-green-200">
              <CheckCircle className="text-green-600 shrink-0" size={20} />
              <div>
                <p className="text-sm font-medium text-green-800">Annotated PDF saved</p>
                {savedPdfUrl && (
                  <a
                    href={savedPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-600 hover:underline"
                  >
                    Preview marked PDF →
                  </a>
                )}
              </div>
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-1">Finalize Grade</h3>
            <p className="text-sm text-gray-500 mb-6">
              Enter marks for{' '}
              <span className="font-medium text-gray-700">{studentName}</span> and submit.
            </p>

            {/* Marks */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Marks{' '}
                <span className="text-gray-400 font-normal">/ {totalMarks}</span>
              </label>
              <input
                type="number"
                min="0"
                max={totalMarks}
                value={marks}
                onChange={e => setMarks(e.target.value)}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={`0 – ${totalMarks}`}
                autoFocus
              />
            </div>

            {/* Feedback */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Feedback{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Write feedback visible to the student…"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setPhase('annotate')}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmitGrade}
                disabled={submittingGrade || !marks}
                className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium transition-colors"
              >
                {submittingGrade ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Submit Marks
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
