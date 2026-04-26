'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  CheckCircle,
  Mail,
  Search,
  Send,
  Star,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, TextArea } from '@/components/ui';
import {
  CareerApplicationDocument,
  CareerApplicationStatus,
  careerApplicationStatuses,
} from '@/models/careerSchema';
import { auth } from '@/utils/firebase-client';

type EmailIntent = 'shortlist' | 'contact' | 'reject';

interface ComposerState {
  application: CareerApplicationDocument;
  intent: EmailIntent;
  status: CareerApplicationStatus;
  subject: string;
  message: string;
}

interface PaginatedCareerResponse {
  applications: CareerApplicationDocument[];
  hasMore: boolean;
  nextCursor: string | null;
}

const statusStyles: Record<CareerApplicationStatus, string> = {
  New: 'bg-blue-100 text-blue-800',
  Shortlisted: 'bg-green-100 text-green-800',
  Contacted: 'bg-purple-100 text-purple-800',
  Rejected: 'bg-red-100 text-red-800',
};
const PAGE_SIZE = 25;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function createComposer(application: CareerApplicationDocument, intent: EmailIntent): ComposerState {
  if (intent === 'shortlist') {
    return {
      application,
      intent,
      status: 'Shortlisted',
      subject: `Shortlisted for ${application.positionTitle} - Dr U Education`,
      message: `Thank you for applying for the ${application.positionTitle} role at Dr U Education.\n\nWe are pleased to let you know that your application has been shortlisted. Our team will contact you soon with the next steps.\n\nThank you again for your interest in joining Dr U Education.`,
    };
  }

  if (intent === 'reject') {
    return {
      application,
      intent,
      status: 'Rejected',
      subject: `Update on your ${application.positionTitle} application`,
      message: `Thank you for applying for the ${application.positionTitle} role at Dr U Education.\n\nAfter reviewing your application, we will not be moving forward at this stage. We appreciate the time you took to apply and wish you the very best.`,
    };
  }

  return {
    application,
    intent,
    status: 'Contacted',
    subject: `Regarding your ${application.positionTitle} application`,
    message: `Thank you for applying for the ${application.positionTitle} role at Dr U Education.\n\nWe would like to speak with you about your application. Please reply with your availability for a short conversation.\n\nKind regards,\nDr U Education Team`,
  };
}

async function getAdminHeaders() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Admin session is not ready. Please refresh and try again.');
  }

  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export default function AdminCareersPage() {
  const [applications, setApplications] = useState<CareerApplicationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | CareerApplicationStatus>('All');
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadApplications = async (append = false) => {
    if (append) {
      if (!hasMore || !nextCursor) return;
      setLoadingMore(true);
    } else {
      setLoading(true);
      setNextCursor(null);
      setHasMore(false);
    }

    setError('');

    try {
      const headers = await getAdminHeaders();
      const params = new URLSearchParams({
        paginated: 'true',
        limit: String(PAGE_SIZE),
      });

      if (append && nextCursor) {
        params.set('cursor', nextCursor);
      }

      const response = await fetch(`/api/careers?${params.toString()}`, {
        cache: 'no-store',
        headers,
      });
      if (!response.ok) {
        throw new Error('Failed to load applications');
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setApplications(data);
        setHasMore(false);
        setNextCursor(null);
        return;
      }

      const paginatedData = data as PaginatedCareerResponse;
      if (append) {
        setApplications((current) => [...current, ...paginatedData.applications]);
      } else {
        setApplications(paginatedData.applications);
      }

      setHasMore(Boolean(paginatedData.hasMore && paginatedData.nextCursor));
      setNextCursor(paginatedData.nextCursor || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const filteredApplications = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return applications.filter((application) => {
      const matchesStatus = statusFilter === 'All' || application.status === statusFilter;
      const matchesSearch = !search || [
        application.fullName,
        application.email,
        application.phone,
        application.positionTitle,
        application.location,
      ].some((value) => value.toLowerCase().includes(search));

      return matchesStatus && matchesSearch;
    });
  }, [applications, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    return careerApplicationStatuses.reduce(
      (acc, status) => {
        acc[status] = applications.filter((application) => application.status === status).length;
        return acc;
      },
      {} as Record<CareerApplicationStatus, number>
    );
  }, [applications]);

  const patchApplication = async (
    application: CareerApplicationDocument,
    payload: {
      status?: CareerApplicationStatus;
      adminNotes?: string;
      email?: { subject: string; message: string };
    }
  ) => {
    const response = await fetch('/api/careers', {
      method: 'PATCH',
      headers: await getAdminHeaders(),
      body: JSON.stringify({
        id: application.id,
        ...payload,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || 'Failed to update application');
    }

    const updatedApplication = await response.json();
    setApplications((current) =>
      current.map((item) => (item.id === updatedApplication.id ? updatedApplication : item))
    );
  };

  const updateStatus = async (application: CareerApplicationDocument, status: CareerApplicationStatus) => {
    setActionLoading(`${application.id}-${status}`);
    setError('');

    try {
      await patchApplication(application, { status });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update application');
    } finally {
      setActionLoading('');
    }
  };

  const sendEmail = async () => {
    if (!composer) return;

    setActionLoading(`${composer.application.id}-email`);
    setError('');

    try {
      await patchApplication(composer.application, {
        status: composer.status,
        email: {
          subject: composer.subject,
          message: composer.message,
        },
      });
      setComposer(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-primary-600 border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-secondary-600 dark:text-secondary-300 font-medium">Loading career applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Careers Management
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Review applicants, shortlist candidates, and send email updates.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => loadApplications(false)}
            leftIcon={<BriefcaseBusiness className="w-4 h-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400" />
            <p className="ml-3 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {careerApplicationStatuses.map((status) => (
          <Card key={status}>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">{status}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats[status] || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search applicant, email, phone, or role"
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(['All', ...careerApplicationStatuses] as Array<'All' | CareerApplicationStatus>).map((status) => (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant={statusFilter === status ? 'primary' : 'outline'}
                  onClick={() => setStatusFilter(status)}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Applicant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredApplications.map((application) => (
                <tr key={application.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 align-top">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{application.fullName}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{application.email}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{application.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{application.positionTitle}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{application.location}</div>
                    <div className="text-xs text-gray-400 mt-1">Applied {formatDate(application.createdAt)}</div>
                  </td>
                  <td className="px-6 py-4 min-w-[300px]">
                    <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-3">{application.experience}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Availability: {application.availability}
                    </p>
                    {(application.resumeUrl || application.coverLetterUrl) && (
                      <div className="mt-2 space-y-1">
                        {application.resumeUrl && (
                          <a
                            href={application.resumeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-blue-600 hover:underline inline-block"
                          >
                            View CV
                          </a>
                        )}
                        {application.coverLetterUrl && (
                          <a
                            href={application.coverLetterUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-blue-600 hover:underline block"
                          >
                            View cover letter
                          </a>
                        )}
                      </div>
                    )}
                    {application.emailHistory && application.emailHistory.length > 0 && (
                      <p className="text-xs text-gray-400 mt-2">
                        Emails sent: {application.emailHistory.length}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusStyles[application.status]}`}>
                      {application.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setComposer(createComposer(application, 'shortlist'))}
                        disabled={actionLoading === `${application.id}-email`}
                        leftIcon={<Star className="w-4 h-4" />}
                      >
                        Shortlist Email
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setComposer(createComposer(application, 'contact'))}
                        disabled={actionLoading === `${application.id}-email`}
                        leftIcon={<Mail className="w-4 h-4" />}
                      >
                        Email
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(application, 'Shortlisted')}
                        disabled={actionLoading === `${application.id}-Shortlisted`}
                        leftIcon={<UserCheck className="w-4 h-4" />}
                      >
                        Mark
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setComposer(createComposer(application, 'reject'))}
                        disabled={actionLoading === `${application.id}-email`}
                        leftIcon={<X className="w-4 h-4" />}
                      >
                        Reject Email
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredApplications.length === 0 && (
          <div className="text-center py-12">
            <BriefcaseBusiness className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No applications found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              New career applications will appear here once candidates apply.
            </p>
          </div>
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => loadApplications(true)}
            isLoading={loadingMore}
            disabled={loadingMore}
          >
            Load More Applications
          </Button>
        </div>
      )}

      {composer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Send Email</h2>
                <p className="text-sm text-gray-500">
                  To {composer.application.fullName} for {composer.application.positionTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposer(null)}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close email composer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <Input
                label="Subject"
                value={composer.subject}
                onChange={(event) => setComposer({ ...composer, subject: event.target.value })}
              />
              <TextArea
                label="Message"
                value={composer.message}
                onChange={(event) => setComposer({ ...composer, message: event.target.value })}
                rows={10}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status after sending</label>
                <select
                  value={composer.status}
                  onChange={(event) =>
                    setComposer({
                      ...composer,
                      status: event.target.value as CareerApplicationStatus,
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {careerApplicationStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <Button variant="outline" onClick={() => setComposer(null)}>
                Cancel
              </Button>
              <Button
                onClick={sendEmail}
                isLoading={actionLoading === `${composer.application.id}-email`}
                leftIcon={actionLoading ? undefined : <Send className="w-4 h-4" />}
                disabled={!composer.subject.trim() || !composer.message.trim()}
              >
                Send Email
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
