'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  Info,
  ArrowLeft,
  BookOpen,
  GraduationCap,
  BarChart3,
  Calendar,
  FileText
} from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { Button } from '@/components/ui';
import { RetestRequestService } from '@/apiservices/retestRequestService';
import { RetestRequestSummary, RetestRequest } from '@/models/retestRequestSchema';
import { Test, FlexibleTest, LiveTest } from '@/models/testSchema';
import ApproveRetestModal from '@/components/modals/ApproveRetestModal';

// ── Types ────────────────────────────────────────────────────────────────────

type DetailTab = 'pending' | 'approved' | 'denied';

interface ClassGroup {
  classId: string;
  className: string;
  subjectName: string;
  summaries: RetestRequestSummary[];
  totalRequests: number;
  pendingCount: number;
  approvedCount: number;
  deniedCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const convertTs = (ts: any): Date => {
  if (ts && typeof ts.toDate === 'function') return ts.toDate();
  if (ts && typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  return new Date();
};

const fmtDate = (ts: any) =>
  convertTs(ts).toLocaleDateString('en-AU', {
    timeZone: 'Australia/Melbourne',
    day: 'numeric', month: 'short', year: 'numeric',
  });

const fmtDateTime = (ts: any) =>
  convertTs(ts).toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const retakeWindow = (test: Test): string => {
  if (test.type === 'flexible') {
    const f = test as FlexibleTest;
    return `${fmtDate(f.availableFrom)} → ${fmtDate(f.availableTo)}`;
  }
  if (test.type === 'live') {
    return fmtDateTime((test as LiveTest).scheduledStartTime);
  }
  return '—';
};

// ── Component ────────────────────────────────────────────────────────────────

export default function TeacherRetestRequests() {
  const { teacher, loading: authLoading } = useTeacherAuth();
  const router = useRouter();

  // Data
  const [summaries, setSummaries] = useState<RetestRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation levels
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSummaryKey, setSelectedSummaryKey] = useState<string | null>(null); // testId_classId
  const [detailTab, setDetailTab] = useState<DetailTab>('pending');

  // Retake detail data (Level 3)
  const [retakeTests, setRetakeTests] = useState<Map<string, Test>>(new Map());
  const [submissions, setSubmissions] = useState<Map<string, any>>(new Map());
  const [detailLoading, setDetailLoading] = useState(false);

  // Deny state
  const [denyingRequestId, setDenyingRequestId] = useState<string | null>(null);
  const [denyNote, setDenyNote] = useState('');
  const [processingDeny, setProcessingDeny] = useState(false);

  // Approve modal
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RetestRequest | null>(null);

  useEffect(() => {
    if (!authLoading && teacher) loadRequests();
  }, [teacher, authLoading]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await RetestRequestService.getTeacherRetestRequests(teacher?.id || '');
      setSummaries(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load retest requests.');
    } finally {
      setLoading(false);
    }
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  const classGroups = useMemo<ClassGroup[]>(() => {
    const map = new Map<string, ClassGroup>();
    summaries.forEach((s) => {
      if (!map.has(s.classId)) {
        map.set(s.classId, {
          classId: s.classId, className: s.className, subjectName: s.subjectName,
          summaries: [], totalRequests: 0, pendingCount: 0, approvedCount: 0, deniedCount: 0,
        });
      }
      const g = map.get(s.classId)!;
      g.summaries.push(s);
      g.totalRequests  += s.totalRequests;
      g.pendingCount   += s.pendingRequests;
      g.approvedCount  += s.approvedRequests;
      g.deniedCount    += s.deniedRequests;
    });
    return Array.from(map.values()).sort((a, b) => b.pendingCount - a.pendingCount);
  }, [summaries]);

  const selectedGroup = classGroups.find((g) => g.classId === selectedClassId) ?? null;

  const selectedSummary = selectedGroup?.summaries.find(
    (s) => `${s.testId}_${s.classId}` === selectedSummaryKey
  ) ?? null;

  // Load retake detail data when entering Level 3
  useEffect(() => {
    if (!selectedSummary) return;
    const approved = selectedSummary.requests.filter((r) => r.status === 'approved');
    if (approved.length === 0) return;

    setDetailLoading(true);
    RetestRequestService.getRetakeDetailsForApproved(approved)
      .then(({ tests, submissions: subs }) => {
        setRetakeTests(tests);
        setSubmissions(subs);
      })
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }, [selectedSummaryKey]);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const goToClass = (classId: string) => {
    setSelectedClassId(classId);
    setSelectedSummaryKey(null);
    setDetailTab('pending');
    setRetakeTests(new Map());
    setSubmissions(new Map());
  };

  const goToTest = (summary: RetestRequestSummary) => {
    const key = `${summary.testId}_${summary.classId}`;
    setSelectedSummaryKey(key);
    // Default to pending if there are pending, otherwise approved
    setDetailTab(summary.pendingRequests > 0 ? 'pending' : 'approved');
    setRetakeTests(new Map());
    setSubmissions(new Map());
  };

  const goBack = () => {
    if (selectedSummaryKey) {
      setSelectedSummaryKey(null);
      setDetailTab('pending');
    } else {
      setSelectedClassId(null);
    }
    setDenyingRequestId(null);
    setDenyNote('');
  };

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleApproveRequest = (request: RetestRequest) => {
    setSelectedRequest(request);
    setShowApproveModal(true);
  };

  const handleDenyRequest = async (requestId: string) => {
    try {
      setProcessingDeny(true);
      await RetestRequestService.denyRetestRequest(requestId, teacher?.id || '', denyNote.trim() || undefined);
      setDenyingRequestId(null);
      setDenyNote('');
      await loadRequests();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingDeny(false);
    }
  };

  const handleDenyAll = async (testId: string, classId: string) => {
    try {
      setProcessingDeny(true);
      await RetestRequestService.denyAllRetestRequests(testId, classId, teacher?.id || '');
      await loadRequests();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingDeny(false);
    }
  };

  // ── Score helpers ────────────────────────────────────────────────────────────

  const getScore = (sub: any, test: Test | undefined) => {
    if (!sub) return null;
    const pct = sub.percentage != null ? Math.round(sub.percentage) : null;
    const raw = sub.totalScore ?? sub.autoGradedScore ?? 0;
    const total = test?.totalMarks ?? null;
    return { pct, raw, total };
  };

  const totalPending = summaries.reduce((n, s) => n + s.pendingRequests, 0);

  // ── Breadcrumb header ────────────────────────────────────────────────────────

  const Header = () => (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        {(selectedClassId || selectedSummaryKey) && (
          <button
            onClick={goBack}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <RefreshCw className="h-6 w-6 text-blue-600" />
        <div>
          <div className="flex items-center space-x-2 text-sm text-gray-400 dark:text-gray-500 mb-0.5">
            {selectedClassId && (
              <>
                <button
                  onClick={() => { setSelectedSummaryKey(null); setSelectedClassId(null); }}
                  className="hover:text-blue-600 transition-colors"
                >
                  Retest Requests
                </button>
                <span>/</span>
                <button
                  onClick={() => setSelectedSummaryKey(null)}
                  className={selectedSummaryKey ? 'hover:text-blue-600 transition-colors' : 'text-gray-700 dark:text-gray-200 font-medium'}
                >
                  {selectedGroup?.className}
                </button>
                {selectedSummaryKey && (
                  <>
                    <span>/</span>
                    <span className="text-gray-700 dark:text-gray-200 font-medium truncate max-w-xs">
                      {selectedSummary?.testTitle}
                    </span>
                  </>
                )}
              </>
            )}
            {!selectedClassId && <span className="text-gray-700 dark:text-gray-200 font-medium">Retest Requests</span>}
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
            {selectedSummary
              ? selectedSummary.testTitle
              : selectedGroup
              ? selectedGroup.className
              : 'Retest Requests'}
          </h1>
        </div>
      </div>
      {!selectedClassId && totalPending > 0 && (
        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700">
          {totalPending} pending
        </span>
      )}
    </div>
  );

  // ── Render guards ────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Header />

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-400">Loading requests...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <Button onClick={loadRequests} variant="outline">Try Again</Button>
          </div>

        // ══════════════════════════════════════════════════════════════════════
        // LEVEL 1 — Class cards
        // ══════════════════════════════════════════════════════════════════════
        ) : !selectedClassId ? (
          classGroups.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-16 text-center border border-gray-200 dark:border-gray-700">
              <Info className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No Requests Yet</h2>
              <p className="text-gray-400 text-sm">
                When students request a retake, they'll appear here grouped by class.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {classGroups.map((group) => (
                <button
                  key={group.classId}
                  onClick={() => goToClass(group.classId)}
                  className="text-left bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{group.className}</p>
                        <p className="text-xs text-gray-400 flex items-center mt-0.5">
                          <BookOpen className="w-3 h-3 mr-1" />{group.subjectName}
                        </p>
                      </div>
                    </div>
                    {group.pendingCount > 0 && (
                      <span className="flex-shrink-0 ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700">
                        {group.pendingCount} pending
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-1 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
                    {[
                      { label: 'Total',    value: group.totalRequests,  colour: 'text-gray-800 dark:text-gray-200' },
                      { label: 'Pending',  value: group.pendingCount,   colour: 'text-yellow-600' },
                      { label: 'Approved', value: group.approvedCount,  colour: 'text-green-600' },
                      { label: 'Denied',   value: group.deniedCount,    colour: 'text-red-500' },
                    ].map(({ label, value, colour }) => (
                      <div key={label}>
                        <p className={`text-lg font-bold ${colour}`}>{value}</p>
                        <p className="text-xs text-gray-400">{label}</p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-xs text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                    View {group.summaries.length} test{group.summaries.length !== 1 ? 's' : ''} →
                  </p>
                </button>
              ))}
            </div>
          )

        // ══════════════════════════════════════════════════════════════════════
        // LEVEL 2 — Test cards within selected class
        // ══════════════════════════════════════════════════════════════════════
        ) : !selectedSummaryKey ? (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {selectedGroup!.summaries.length} test{selectedGroup!.summaries.length !== 1 ? 's' : ''} with requests
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedGroup!.summaries
                .sort((a, b) => b.pendingRequests - a.pendingRequests)
                .map((summary) => (
                <button
                  key={`${summary.testId}_${summary.classId}`}
                  onClick={() => goToTest(summary)}
                  className="text-left bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all group"
                >
                  {/* Test title + display number */}
                  <div className="mb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight truncate">
                            {summary.testTitle}
                          </p>
                          {summary.displayNumber && (
                            <span className="text-xs text-indigo-600 dark:text-indigo-400">{summary.displayNumber}</span>
                          )}
                        </div>
                      </div>
                      {summary.pendingRequests > 0 && (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700">
                          {summary.pendingRequests} pending
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-1 pt-3 border-t border-gray-100 dark:border-gray-700 text-center">
                    {[
                      { label: 'Pending',  value: summary.pendingRequests,  colour: 'text-yellow-600' },
                      { label: 'Approved', value: summary.approvedRequests, colour: 'text-green-600' },
                      { label: 'Denied',   value: summary.deniedRequests,   colour: 'text-red-500'  },
                    ].map(({ label, value, colour }) => (
                      <div key={label}>
                        <p className={`text-xl font-bold ${colour}`}>{value}</p>
                        <p className="text-xs text-gray-400">{label}</p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-xs text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                    View requests →
                  </p>
                </button>
              ))}
            </div>
          </div>

        // ══════════════════════════════════════════════════════════════════════
        // LEVEL 3 — Test detail (pending / approved / denied tabs)
        // ══════════════════════════════════════════════════════════════════════
        ) : selectedSummary ? (
          <div>
            {/* Tabs */}
            <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
              {([
                { key: 'pending'  as DetailTab, label: 'Pending',  count: selectedSummary.pendingRequests },
                { key: 'approved' as DetailTab, label: 'Approved', count: selectedSummary.approvedRequests },
                { key: 'denied'   as DetailTab, label: 'Denied',   count: selectedSummary.deniedRequests },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setDetailTab(tab.key)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    detailTab === tab.key
                      ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                    detailTab === tab.key ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* ── PENDING TAB ───────────────────────────────────────────────── */}
            {detailTab === 'pending' && (() => {
              const pending = selectedSummary.requests.filter((r) => r.status === 'pending');
              return pending.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
                  <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No pending requests for this test.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Deny All bar */}
                  <div className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl px-5 py-3">
                    <span className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                      {pending.length} student{pending.length !== 1 ? 's' : ''} waiting for a decision
                    </span>
                    <Button
                      onClick={() => handleDenyAll(selectedSummary.testId, selectedSummary.classId)}
                      variant="outline"
                      disabled={processingDeny}
                      className="text-red-600 border-red-300 hover:bg-red-50 text-xs"
                    >
                      <XCircle className="w-3 h-3 mr-1" />Deny All
                    </Button>
                  </div>

                  {pending.map((request) => (
                    <div
                      key={request.id}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">{request.studentName}</p>
                          <div className="flex items-start space-x-1.5 mt-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">"{request.reason}"</p>
                          </div>
                          <p className="text-xs text-gray-400 mt-1.5">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            Requested {fmtDateTime(request.createdAt)}
                          </p>
                        </div>

                        <div className="flex-shrink-0 flex items-center space-x-2">
                          {denyingRequestId === request.id ? (
                            <>
                              <input
                                type="text"
                                value={denyNote}
                                onChange={(e) => setDenyNote(e.target.value)}
                                placeholder="Reason (optional)"
                                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white w-36"
                              />
                              <Button
                                onClick={() => handleDenyRequest(request.id)}
                                disabled={processingDeny}
                                className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1"
                              >Deny</Button>
                              <Button
                                onClick={() => { setDenyingRequestId(null); setDenyNote(''); }}
                                variant="outline"
                                className="text-xs px-2 py-1"
                              >Cancel</Button>
                            </>
                          ) : (
                            <>
                              <Button
                                onClick={() => handleApproveRequest(request)}
                                className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5"
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />Approve
                              </Button>
                              <Button
                                onClick={() => setDenyingRequestId(request.id)}
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50 text-xs px-3 py-1.5"
                              >
                                <XCircle className="w-3 h-3 mr-1" />Deny
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── APPROVED TAB ──────────────────────────────────────────────── */}
            {detailTab === 'approved' && (() => {
              const approved = selectedSummary.requests.filter((r) => r.status === 'approved');
              return approved.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
                  <Info className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400">No approved requests yet.</p>
                </div>
              ) : detailLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  {approved.map((request) => {
                    const retakeTest = request.retestTestId ? retakeTests.get(request.retestTestId) : undefined;
                    const sub = request.retestTestId ? submissions.get(request.retestTestId) : undefined;
                    const score = getScore(sub, retakeTest);
                    const attempted = !!sub;

                    return (
                      <div
                        key={request.id}
                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
                      >
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          {/* Left: student info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <p className="font-semibold text-gray-900 dark:text-white text-sm">{request.studentName}</p>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                <CheckCircle className="w-3 h-3 mr-1" />Approved
                              </span>
                              {attempted ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                  Attempted
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                  Not yet attempted
                                </span>
                              )}
                            </div>

                            {/* Retake window */}
                            {retakeTest && (
                              <p className="text-xs text-gray-400 mt-1.5 flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                Window: {retakeWindow(retakeTest)}
                              </p>
                            )}

                            {/* Reason + review note */}
                            <div className="flex items-start space-x-1.5 mt-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-gray-400 italic">"{request.reason}"</p>
                            </div>
                            {request.reviewNote && (
                              <p className="text-xs text-gray-400 mt-1">Note: {request.reviewNote}</p>
                            )}
                          </div>

                          {/* Right: score + action */}
                          <div className="flex-shrink-0 flex flex-col items-end space-y-2">
                            {attempted && score ? (
                              <div className="text-right">
                                <p className={`text-2xl font-black ${
                                  score.pct == null ? 'text-gray-600'
                                  : score.pct >= 70 ? 'text-green-600'
                                  : score.pct >= 50 ? 'text-yellow-600'
                                  : 'text-red-600'
                                }`}>
                                  {score.pct != null ? `${score.pct}%` : score.raw}
                                </p>
                                {score.total != null && (
                                  <p className="text-xs text-gray-400">{score.raw} / {score.total} marks</p>
                                )}
                                {sub?.submittedAt && (
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    Submitted {fmtDate(sub.submittedAt)}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}

                            {request.retestTestId && (
                              <Button
                                onClick={() => router.push(`/teacher/tests/${request.retestTestId}/results`)}
                                variant="outline"
                                className="text-xs px-3 py-1.5"
                              >
                                <BarChart3 className="w-3 h-3 mr-1" />
                                {attempted ? 'View Results' : 'View Retake'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── DENIED TAB ────────────────────────────────────────────────── */}
            {detailTab === 'denied' && (() => {
              const denied = selectedSummary.requests.filter((r) => r.status === 'denied');
              return denied.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
                  <Info className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400">No denied requests.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {denied.map((request) => (
                    <div
                      key={request.id}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">{request.studentName}</p>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                              <XCircle className="w-3 h-3 mr-1" />Denied
                            </span>
                          </div>
                          <div className="flex items-start space-x-1.5 mt-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-gray-500 dark:text-gray-400 italic">"{request.reason}"</p>
                          </div>
                          {request.reviewNote && (
                            <p className="text-xs text-gray-500 mt-1.5 bg-gray-50 dark:bg-gray-900/50 rounded px-2 py-1">
                              Teacher note: {request.reviewNote}
                            </p>
                          )}
                          {request.reviewedAt && (
                            <p className="text-xs text-gray-400 mt-1">
                              Denied {fmtDateTime(request.reviewedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        ) : null}

        {/* Approve modal */}
        {selectedRequest && (
          <ApproveRetestModal
            isOpen={showApproveModal}
            onClose={() => { setShowApproveModal(false); setSelectedRequest(null); }}
            request={selectedRequest}
            teacherId={teacher?.id || ''}
            teacherName={teacher?.name || ''}
            onApproved={() => loadRequests()}
          />
        )}
      </div>
    </TeacherLayout>
  );
}
