'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
  Info,
  BarChart3,
  Eye,
  ArrowRight,
  BookOpen,
  Users
} from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { Button } from '@/components/ui';
import { RetestRequestService } from '@/apiservices/retestRequestService';
import { Test, FlexibleTest, LiveTest } from '@/models/testSchema';

type StatusKey = 'upcoming' | 'available' | 'completed';

interface RetakeRow {
  test: Test;
  status: StatusKey;
  classId: string;
  className: string;
}

const convertTimestamp = (ts: any): Date => {
  if (ts && typeof ts.toDate === 'function') return ts.toDate();
  if (ts && typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') return new Date(ts);
  return new Date(0);
};

const getRetakeStatus = (test: Test): StatusKey => {
  const now = new Date();
  if (test.type === 'flexible') {
    const flex = test as FlexibleTest;
    const from = convertTimestamp(flex.availableFrom);
    const to = convertTimestamp(flex.availableTo);
    if (now < from) return 'upcoming';
    if (now > to) return 'completed';
    return 'available';
  }
  if (test.type === 'live') {
    const live = test as LiveTest;
    const start = convertTimestamp(live.scheduledStartTime);
    const end = convertTimestamp(live.actualEndTime);
    if (now < start) return 'upcoming';
    if (now > end) return 'completed';
    return 'available';
  }
  return 'completed';
};

const formatDateTime = (ts: any): string => {
  const d = convertTimestamp(ts);
  return d.toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const StatusBadge: React.FC<{ status: StatusKey }> = ({ status }) => {
  if (status === 'upcoming') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-300">
        <Clock className="w-3 h-3 mr-1" />
        Upcoming
      </span>
    );
  }
  if (status === 'available') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-300">
        <RefreshCw className="w-3 h-3 mr-1" />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border border-gray-300">
      <CheckCircle className="w-3 h-3 mr-1" />
      Completed
    </span>
  );
};

export default function TeacherRetakes() {
  const { teacher, loading: authLoading } = useTeacherAuth();
  const router = useRouter();

  const [rows, setRows] = useState<RetakeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | StatusKey>('all');
  const [classFilter, setClassFilter] = useState<string>('all');

  useEffect(() => {
    if (!authLoading && teacher) {
      loadRetakes();
    }
  }, [teacher, authLoading]);

  const loadRetakes = async () => {
    try {
      setLoading(true);
      setError(null);
      const retakes = await RetestRequestService.getTeacherRetakes(teacher?.id || '');
      const built: RetakeRow[] = retakes.map((test) => {
        const classId = test.classIds?.[0] || '';
        const className = test.classNames?.[0] || '';
        return {
          test,
          status: getRetakeStatus(test),
          classId,
          className,
        };
      });
      setRows(built);
    } catch (err) {
      console.error('Error loading teacher retakes:', err);
      setError('Failed to load retakes.');
    } finally {
      setLoading(false);
    }
  };

  const classes = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((r) => {
      if (r.classId && !seen.has(r.classId)) seen.set(r.classId, r.className || r.classId);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (classFilter !== 'all' && r.classId !== classFilter) return false;
      return true;
    });
  }, [rows, statusFilter, classFilter]);

  const counts = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.total += 1;
        acc[r.status] += 1;
        return acc;
      },
      { total: 0, upcoming: 0, available: 0, completed: 0 } as Record<string, number>
    );
  }, [rows]);

  if (authLoading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-3 mb-2">
            <RefreshCw className="h-7 w-7 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Retakes</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Approved retake tests, separated from your main test list. The original test number stays untouched.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Retakes</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Upcoming</p>
            <p className="text-2xl font-bold text-blue-600">{counts.upcoming}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
            <p className="text-2xl font-bold text-green-600">{counts.available}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
            <p className="text-2xl font-bold text-gray-600">{counts.completed}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 flex flex-wrap gap-3 items-center">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
            {(['all', 'upcoming', 'available', 'completed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  statusFilter === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                {s === 'all' ? 'All' : s === 'available' ? 'Active' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {classes.length > 1 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Class:</span>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-3 py-1 rounded-md text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <option value="all">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">Loading retakes...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <Button onClick={loadRetakes} variant="outline">
              Try Again
            </Button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center border border-gray-200 dark:border-gray-700">
            <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {rows.length === 0 ? 'No Retakes Yet' : 'No retakes match these filters'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {rows.length === 0
                ? 'Approve a retest request and the new retake test will appear here.'
                : 'Try changing the filter to see more retakes.'}
            </p>
            {rows.length === 0 && (
              <Button
                onClick={() => router.push('/teacher/retest-requests')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Go to Retest Requests
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRows.map(({ test, status, classId, className }) => {
              const isFlex = test.type === 'flexible';
              const flex = test as FlexibleTest;
              const live = test as LiveTest;
              return (
                <div
                  key={test.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                            {test.title}
                          </h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                            Retake
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                          {test.subjectName && (
                            <span className="flex items-center">
                              <BookOpen className="h-4 w-4 mr-1" />
                              {test.subjectName}
                            </span>
                          )}
                          {className && (
                            <span className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              {className}
                            </span>
                          )}
                          {test.retestApprovedBy && (
                            <span className="text-xs text-gray-500">
                              Approved by {test.retestApprovedBy}
                            </span>
                          )}
                        </div>
                        {test.originalTestTitle && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500 truncate">
                            Retake of: <span className="italic">{test.originalTestTitle}</span>
                          </p>
                        )}
                      </div>
                      <StatusBadge status={status} />
                    </div>
                  </div>

                  <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <Calendar className="h-4 w-4 mr-2" />
                      {isFlex ? (
                        <span>
                          {formatDateTime(flex.availableFrom)} → {formatDateTime(flex.availableTo)}
                        </span>
                      ) : (
                        <span>{formatDateTime(live.scheduledStartTime)}</span>
                      )}
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>
                        {isFlex
                          ? (flex as any).isUntimed
                            ? 'No time limit'
                            : `${flex.duration} min`
                          : `${live.duration} min`}
                      </span>
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{test.questions?.length || 0}</span>
                      <span className="ml-1">questions</span>
                    </div>
                  </div>

                  <div className="px-6 pb-6 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/teacher/tests/${test.id}/results`)}
                      className="inline-flex items-center"
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      View Results
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/teacher/tests/${test.id}/mark`)}
                      className="inline-flex items-center"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Mark Submissions
                    </Button>
                    {test.originalTestId && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/teacher/tests/${test.originalTestId}/results`)}
                        className="inline-flex items-center"
                      >
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Original Test
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
