'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { X, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { InClassSubmission } from '@/models/inClassSubmissionSchema';
import { InClassSubmissionService } from '@/services/inClassSubmissionService';

// CanvasWriter uses Fabric.js — must be client-only
const CanvasWriter = dynamic(() => import('@/components/ui/CanvasWriter'), { ssr: false });

interface TeacherAnnotateDrawerProps {
  submission: InClassSubmission;
  studentName: string;
  onClose: () => void;
  /** Called after the marked PDF is successfully uploaded & saved */
  onSaved: (markedPdfUrl: string) => void;
}

export default function TeacherAnnotateDrawer({
  submission,
  studentName,
  onClose,
  onSaved,
}: TeacherAnnotateDrawerProps) {
  const [saving, setSaving] = useState(false);

  /**
   * Called by CanvasWriter's "Submit Answer" button — receives the flattened
   * PDF file. We upload it to Storage then attach the URL to the submission.
   */
  const handleSavePdf = async (file: File) => {
    setSaving(true);
    try {
      const url = await InClassSubmissionService.uploadMarkedPdf(
        file,
        submission.testId,
        submission.studentId,
      );

      if (submission.id) {
        await InClassSubmissionService.saveMarkedPdf(submission.id, url);
      }

      toast.success('Marked PDF saved — student can now view it');
      onSaved(url);
    } catch (err) {
      console.error('[TeacherAnnotateDrawer] save failed:', err);
      toast.error('Failed to save marked PDF. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white shrink-0">
        <div>
          <p className="text-[11px] text-gray-400 uppercase tracking-widest">Annotating answer for</p>
          <h2 className="text-base font-semibold leading-tight">{studentName}</h2>
        </div>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-amber-300 animate-pulse">
              <div className="w-3 h-3 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
              Saving…
            </span>
          )}
          <button
            onClick={onClose}
            title="Close without saving"
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Hint banner ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs shrink-0">
        <Info size={13} className="shrink-0" />
        <span>
          Annotate on the canvas, then press{' '}
          <strong>Submit Answer</strong> in the toolbar to save the marked PDF for the student.
        </span>
      </div>

      {/* ── Canvas ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        <CanvasWriter
          pdfUrl={submission.answerFileUrl}
          onSavePdf={handleSavePdf}
          className="h-full"
        />
      </div>
    </div>
  );
}
