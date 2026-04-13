'use client';

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  MessageSquare,
  Info
} from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { Button } from '@/components/ui';
import { RetestRequestService } from '@/apiservices/retestRequestService';
import { RetestRequestSummary, RetestRequest } from '@/models/retestRequestSchema';
import ApproveRetestModal from '@/components/modals/ApproveRetestModal';

type FilterTab = 'all' | 'pending' | 'approved' | 'denied';

export default function TeacherRetestRequests() {
  const { teacher, loading: authLoading } = useTeacherAuth();

  const [summaries, setSummaries] = useState<RetestRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [denyingRequestId, setDenyingRequestId] = useState<string | null>(null);
  const [denyNote, setDenyNote] = useState('');
  const [processingDeny, setProcessingDeny] = useState(false);

  // Per-student approve modal
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
      console.error('Error loading retest requests:', err);
      setError('Failed to load retest requests.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedTests(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
      console.error('Error denying request:', err);
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
      console.error('Error denying all requests:', err);
    } finally {
      setProcessingDeny(false);
    }
  };

  const convertTimestamp = (timestamp: any): Date => {
    if (timestamp && typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (timestamp && typeof timestamp.seconds === 'number') return new Date(timestamp.seconds * 1000);
    if (timestamp instanceof Date) return timestamp;
    return new Date();
  };

  const formatDate = (timestamp: any): string => {
    return convertTimestamp(timestamp).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const filteredSummaries = summaries.filter(summary => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'pending') return summary.pendingRequests > 0;
    if (activeFilter === 'approved') return summary.approvedRequests > 0;
    if (activeFilter === 'denied') return summary.deniedRequests > 0;
    return true;
  });

  const totalPending = summaries.reduce((sum, s) => sum + s.pendingRequests, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />Approved
          </span>
        );
      case 'denied':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />Denied
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <TeacherLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <RefreshCw className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Retest Requests</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Review and approve retake requests per student.
                </p>
              </div>
            </div>
            {totalPending > 0 && (
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
                {totalPending} pending request{totalPending !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-2 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {([
            { key: 'all' as FilterTab, label: 'All', count: summaries.length },
            { key: 'pending' as FilterTab, label: 'Pending', count: summaries.filter(s => s.pendingRequests > 0).length },
            { key: 'approved' as FilterTab, label: 'Approved', count: summaries.filter(s => s.approvedRequests > 0).length },
            { key: 'denied' as FilterTab, label: 'Denied', count: summaries.filter(s => s.deniedRequests > 0).length },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeFilter === tab.key
                  ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-300">Loading requests...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadRequests} variant="outline">Try Again</Button>
          </div>
        ) : filteredSummaries.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center border border-gray-200 dark:border-gray-700">
            <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {activeFilter === 'all' ? 'No Retest Requests Yet' : `No ${activeFilter} requests`}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {activeFilter === 'all'
                ? 'When students request to retake completed tests, they will appear here.'
                : 'Try switching to a different filter tab.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSummaries.map((summary) => {
              const key = `${summary.testId}_${summary.classId}`;
              const isExpanded = expandedTests.has(key);
              const pendingReqs = summary.requests.filter(r => r.status === 'pending');

              return (
                <div
                  key={key}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Summary Header */}
                  <div
                    className="px-6 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                    onClick={() => toggleExpand(key)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {summary.testTitle}
                          </h3>
                          {summary.displayNumber && (
                            <span className="text-sm text-blue-600 font-medium">{summary.displayNumber}</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <span>{summary.className}</span>
                          <span>{summary.subjectName}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="flex items-center space-x-1">
                            <Users className="w-4 h-4 text-blue-600" />
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                              {summary.totalRequests}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">request{summary.totalRequests !== 1 ? 's' : ''}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {summary.pendingRequests > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">
                              {summary.pendingRequests} pending
                            </span>
                          )}
                          {summary.approvedRequests > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                              {summary.approvedRequests} approved
                            </span>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700">
                      {/* Deny All bar — only shown when there are pending requests */}
                      {pendingReqs.length > 0 && (
                        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {pendingReqs.length} pending request{pendingReqs.length !== 1 ? 's' : ''} — approve each student individually below
                          </span>
                          <Button
                            onClick={() => handleDenyAll(summary.testId, summary.classId)}
                            variant="outline"
                            disabled={processingDeny}
                            className="text-red-600 border-red-300 hover:bg-red-50 text-sm"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Deny All
                          </Button>
                        </div>
                      )}

                      {/* Individual Requests */}
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {summary.requests.map((request) => (
                          <div key={request.id} className="px-6 py-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {request.studentName}
                                  </span>
                                  {getStatusBadge(request.status)}
                                </div>
                                <div className="mt-1 flex items-start space-x-2">
                                  <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                                    "{request.reason}"
                                  </p>
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  Requested: {formatDate(request.createdAt)}
                                  {request.reviewedAt && (
                                    <span> | Reviewed: {formatDate(request.reviewedAt)}</span>
                                  )}
                                </div>
                                {request.reviewNote && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Teacher note: {request.reviewNote}
                                  </div>
                                )}
                              </div>

                              {/* Per-student actions */}
                              {request.status === 'pending' && (
                                <div className="ml-4 flex items-center space-x-2">
                                  {denyingRequestId === request.id ? (
                                    <>
                                      <input
                                        type="text"
                                        value={denyNote}
                                        onChange={(e) => setDenyNote(e.target.value)}
                                        placeholder="Reason (optional)"
                                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                                      />
                                      <Button
                                        onClick={() => handleDenyRequest(request.id)}
                                        disabled={processingDeny}
                                        className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1"
                                      >
                                        Deny
                                      </Button>
                                      <Button
                                        onClick={() => { setDenyingRequestId(null); setDenyNote(''); }}
                                        variant="outline"
                                        className="text-xs px-2 py-1"
                                      >
                                        Cancel
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        onClick={() => handleApproveRequest(request)}
                                        className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1"
                                      >
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Approve
                                      </Button>
                                      <Button
                                        onClick={() => setDenyingRequestId(request.id)}
                                        variant="outline"
                                        className="text-red-600 border-red-200 hover:bg-red-50 text-xs px-2 py-1"
                                      >
                                        <XCircle className="w-3 h-3 mr-1" />
                                        Deny
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Per-student Approve Modal */}
        {selectedRequest && (
          <ApproveRetestModal
            isOpen={showApproveModal}
            onClose={() => { setShowApproveModal(false); setSelectedRequest(null); }}
            request={selectedRequest}
            teacherId={teacher?.id || ''}
            teacherName={teacher?.name || ''}
            onApproved={() => { loadRequests(); }}
          />
        )}
      </div>
    </TeacherLayout>
  );
}
