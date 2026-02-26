'use client';

import React, { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { X, Info, CheckCircle, Send } from 'lucide-react';
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
  onSaved: () => void;
}

export default function TeacherAnnotateDrawer({
  submission,
  studentName,
  totalMarks,
  teacherId,
  onClose,
  onSaved,
}: TeacherAnnotateDrawerProps) {
  // Ref to CanvasWriter's PDF-export function (registered via onRegisterSubmit)
  const submitCanvasRef = useRef<(() => void) | null>(null);

  // Holds the generated PDF file until teacher confirms marks
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showMarkPopup, setShowMarkPopup] = useState(false);
  const [marks, setMarks] = useState(
    submission.marks !== undefined ? String(submission.marks) : '',
  );
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ── Step 1: Teacher clicks "Submit Answer" → trigger PDF generation ──────────
  const handleClickSubmit = () => {
    if (!submitCanvasRef.current) {
      toast.error('Canvas not ready yet — please wait a moment and try again.');
      return;
    }
    setGenerating(true);
    submitCanvasRef.current(); // triggers handleSubmit in CanvasWriter → calls onSavePdf
  };

  // ── Step 1b: CanvasWriter hands us the generated PDF ─────────────────────────
  const handleSavePdf = (file: File) => {
    setGenerating(false);
    setPendingFile(file);
    setShowMarkPopup(true);
  };

  // ── Step 2: Teacher fills in marks and clicks "Save Grade" ───────────────────
  const handleSaveGrade = async () => {
    const numMarks = parseFloat(marks);
    if (isNaN(numMarks) || numMarks < 0 || numMarks > totalMarks) {
      toast.error(`Marks must be between 0 and ${totalMarks}`);
      return;
    }
    if (!pendingFile) {
      toast.error('No annotated PDF found — please re-annotate and try again.');
      return;
    }

    setSaving(true);
    try {
      const url = await InClassSubmissionService.uploadMarkedPdf(
        pendingFile,
        submission.testId,
        submission.studentId,
      );

      if (submission.id) {
        await Promise.all([
          InClassSubmissionService.gradeSubmission(
            submission.id,
            numMarks,
            feedback,
            teacherId,
            totalMarks,
          ),
          InClassSubmissionService.saveMarkedPdf(submission.id, url),
        ]);
      } else {
        await InClassSubmissionService.saveSubmission({
          ...submission,
          marks: numMarks,
          totalMarks,
          feedback,
          gradedBy: teacherId,
          status: 'graded',
          markedPdfUrl: url,
        });
      }

      toast.success(`Grade saved for ${studentName}`);
      onSaved();
    } catch (err) {
      console.error('[TeacherAnnotateDrawer] save failed:', err);
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white shrink-0">
        <div>
          <p className="text-[11px] text-gray-400 uppercase tracking-widest">Annotating answer for</p>
          <h2 className="text-base font-semibold leading-tight">{studentName}</h2>
        </div>

        {/* Submit Answer button — right side of header */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleClickSubmit}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            title="Generate annotated PDF and enter marks"
          >
            {generating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Send size={14} />
                Submit Answer
              </>
            )}
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Hint banner ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs shrink-0">
        <Info size={13} className="shrink-0" />
        <span>
          Annotate the answer with your notes, then press{' '}
          <strong className="text-amber-900">Submit Answer</strong> above to enter marks and save.
        </span>
      </div>

      {/* ── Canvas ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <CanvasWriter
          pdfUrl={submission.answerFileUrl}
          onSavePdf={handleSavePdf}
          onRegisterSubmit={(fn) => { submitCanvasRef.current = fn; }}
          className="h-full"
        />

        {/* ── Marks popup — appears over the canvas after "Submit Answer" ── */}
        {showMarkPopup && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">

              {/* Confirmation badge */}
              <div className="flex items-center gap-3 mb-5 p-3 bg-green-50 rounded-xl border border-green-200">
                <CheckCircle className="text-green-600 shrink-0" size={18} />
                <p className="text-sm font-medium text-green-800">
                  Annotation ready — enter marks to save
                </p>
              </div>

              <h3 className="text-base font-bold text-gray-900 mb-4">
                Marks for <span className="text-indigo-600">{studentName}</span>
              </h3>

              {/* Marks */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Marks <span className="text-gray-400 font-normal">/ {totalMarks}</span>
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
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Feedback <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Feedback visible to the student…"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowMarkPopup(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveGrade}
                  disabled={saving || !marks}
                  className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium transition-colors"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Save Grade
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

    </div>
  );
}
