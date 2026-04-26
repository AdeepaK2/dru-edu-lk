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
  Plus,
  Users,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, TextArea } from '@/components/ui';
import {
  CareerApplicationDocument,
  CareerApplicationStatus,
  CareerPositionDocument,
  careerApplicationStatuses,
} from '@/models/careerSchema';
import { auth } from '@/utils/firebase-client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

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

interface PositionFormState {
  title: string;
  type: string;
  location: string;
  summary: string;
}

const statusBadgeVariants: Record<CareerApplicationStatus, 'default' | 'secondary' | 'destructive' | 'warning' | 'success'> = {
  New: 'default',
  Shortlisted: 'success',
  Contacted: 'warning',
  Rejected: 'destructive',
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
  const [positions, setPositions] = useState<CareerPositionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | CareerApplicationStatus>('All');
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionForm, setPositionForm] = useState<PositionFormState>({
    title: '',
    type: '',
    location: '',
    summary: '',
  });

  const loadPositions = async () => {
    setPositionsLoading(true);

    try {
      const headers = await getAdminHeaders();
      const response = await fetch('/api/careers/positions?includeInactive=true', {
        cache: 'no-store',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to load positions');
      }

      const data = await response.json();
      setPositions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load positions');
    } finally {
      setPositionsLoading(false);
    }
  };

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
    loadPositions();
  }, []);

  const createPosition = async () => {
    if (!positionForm.title.trim() || !positionForm.type.trim() || !positionForm.location.trim() || !positionForm.summary.trim()) {
      setError('Please complete all position fields before adding.');
      return;
    }

    setActionLoading('position-create');
    setError('');

    try {
      const response = await fetch('/api/careers/positions', {
        method: 'POST',
        headers: await getAdminHeaders(),
        body: JSON.stringify({
          title: positionForm.title.trim(),
          type: positionForm.type.trim(),
          location: positionForm.location.trim(),
          summary: positionForm.summary.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to add position');
      }

      const created = (await response.json()) as CareerPositionDocument;
      setPositions((current) => [created, ...current]);
      setPositionForm({
        title: '',
        type: '',
        location: '',
        summary: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add position');
    } finally {
      setActionLoading('');
    }
  };

  const togglePositionStatus = async (position: CareerPositionDocument) => {
    setActionLoading(`position-toggle-${position.id}`);
    setError('');

    try {
      const response = await fetch('/api/careers/positions', {
        method: 'PATCH',
        headers: await getAdminHeaders(),
        body: JSON.stringify({
          id: position.id,
          isActive: !position.isActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to update position');
      }

      const updated = (await response.json()) as CareerPositionDocument;
      setPositions((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update position');
    } finally {
      setActionLoading('');
    }
  };

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

  const ApplicationTable = ({ data }: { data: CareerApplicationDocument[] }) => (
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
            {data.map((application) => (
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
                  {application.coverLetterText && (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-100 dark:border-gray-600">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Cover Letter:</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-4 italic">"{application.coverLetterText}"</p>
                    </div>
                  )}
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
                          className="text-sm text-blue-600 hover:border-b hover:border-blue-600 inline-block transition-all"
                        >
                          View CV
                        </a>
                      )}
                      {application.coverLetterUrl && (
                        <a
                          href={application.coverLetterUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-blue-600 hover:border-b hover:border-blue-600 block transition-all"
                        >
                          View cover letter file
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
                  <Badge variant={statusBadgeVariants[application.status]}>
                    {application.status}
                  </Badge>
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
                      Shortlist
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
                    {application.status !== 'Shortlisted' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(application, 'Shortlisted')}
                        disabled={actionLoading === `${application.id}-Shortlisted`}
                        leftIcon={<UserCheck className="w-4 h-4" />}
                      >
                        Mark
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => setComposer(createComposer(application, 'reject'))}
                      disabled={actionLoading === `${application.id}-email`}
                      leftIcon={<X className="w-4 h-4" />}
                    >
                      Reject
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length === 0 && (
        <div className="text-center py-12">
          <BriefcaseBusiness className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No applications found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            No applications match the current criteria.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Careers Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl">
            Streamline your recruitment pipeline. Manage job postings, review applicants, and connect with potential talent.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              loadApplications(false);
              loadPositions();
            }}
            leftIcon={<BriefcaseBusiness className="w-4 h-4" />}
            className="bg-white"
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
          <XCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
          <button onClick={() => setError('')} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {careerApplicationStatuses.map((status) => (
          <Card key={status} className="border-none bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{status}</p>
                <div className={`p-2 rounded-lg ${
                  status === 'Shortlisted' ? 'bg-green-50 text-green-600' :
                  status === 'New' ? 'bg-blue-50 text-blue-600' :
                  status === 'Contacted' ? 'bg-purple-50 text-purple-600' :
                  'bg-red-50 text-red-600'
                }`}>
                  {status === 'Shortlisted' ? <Star className="w-4 h-4" /> :
                   status === 'New' ? <Plus className="w-4 h-4" /> :
                   status === 'Contacted' ? <Mail className="w-4 h-4" /> :
                   <XCircle className="w-4 h-4" />}
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats[status] || 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs Container */}
      <Tabs defaultValue="candidates" className="w-full">
        <TabsList className="bg-gray-100/80 p-1.5 mb-8 w-full md:w-auto flex overflow-x-auto no-scrollbar">
          <TabsTrigger value="positions" className="gap-2 px-6">
            <BriefcaseBusiness className="w-4 h-4" />
            Manage Positions
          </TabsTrigger>
          <TabsTrigger value="candidates" className="gap-2 px-6">
            <Users className="w-4 h-4" />
            All Candidates
          </TabsTrigger>
          <TabsTrigger value="selected" className="gap-2 px-6">
            <CheckCircle2 className="w-4 h-4" />
            Selected / Shortlisted
          </TabsTrigger>
        </TabsList>

        {/* Positions Tab */}
        <TabsContent value="positions" className="space-y-6 outline-none">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-white border-b border-gray-100 p-6">
              <CardTitle className="text-xl flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary-600" />
                Add New Position
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <Input
                  label="Position Title"
                  value={positionForm.title}
                  onChange={(e) => setPositionForm(c => ({ ...c, title: e.target.value }))}
                  placeholder="e.g. VCE Chemistry Tutor"
                  className="bg-gray-50/50"
                />
                <Input
                  label="Job Type"
                  value={positionForm.type}
                  onChange={(e) => setPositionForm(c => ({ ...c, type: e.target.value }))}
                  placeholder="e.g. Part-time / Remote"
                  className="bg-gray-50/50"
                />
                <Input
                  label="Location"
                  value={positionForm.location}
                  onChange={(e) => setPositionForm(c => ({ ...c, location: e.target.value }))}
                  placeholder="e.g. Melbourne / Online"
                  className="bg-gray-50/50"
                />
              </div>
              <TextArea
                label="Job Summary"
                value={positionForm.summary}
                onChange={(e) => setPositionForm(c => ({ ...c, summary: e.target.value }))}
                rows={3}
                placeholder="Briefly describe the role, responsibilities, and key requirements..."
                className="bg-gray-50/50"
              />
              <div className="flex justify-end">
                <Button
                  onClick={createPosition}
                  isLoading={actionLoading === 'position-create'}
                  className="px-8 shadow-sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Post Position
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <h3 className="text-lg font-semibold text-gray-900 px-1">Active & Past Postings</h3>
            {positionsLoading ? (
              <div className="flex justify-center p-12">
                <div className="w-8 h-8 border-t-2 border-primary-600 rounded-full animate-spin"></div>
              </div>
            ) : positions.length === 0 ? (
              <Card className="p-12 text-center text-gray-500 border-dashed border-2">
                No job postings found. Create your first one above.
              </Card>
            ) : (
              <div className="grid gap-4">
                {positions.map((pos) => (
                  <Card key={pos.id} className="border-none shadow-sm hover:ring-1 hover:ring-primary-500/20 transition-all">
                    <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900">{pos.title}</h4>
                          <Badge variant={pos.isActive ? 'success' : 'secondary'} className="rounded-md">
                            {pos.isActive ? 'Live' : 'Closed'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 flex items-center gap-3">
                          <span>{pos.type}</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                          <span>{pos.location}</span>
                        </p>
                        <p className="text-sm text-gray-600 line-clamp-1 max-w-2xl">{pos.summary}</p>
                      </div>
                      <Button
                        variant={pos.isActive ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => togglePositionStatus(pos)}
                        isLoading={actionLoading === `position-toggle-${pos.id}`}
                        className="w-full md:w-auto"
                      >
                        {pos.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Candidates Tab */}
        <TabsContent value="candidates" className="space-y-6 outline-none">
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
                <div className="relative flex-1 max-w-xl">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, email, role or location..."
                    className="pl-10 bg-gray-50 border-none shadow-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 mr-2 text-sm text-gray-500">
                    <Filter className="w-4 h-4" />
                    <span>Filter:</span>
                  </div>
                  {(['All', ...careerApplicationStatuses] as Array<'All' | CareerApplicationStatus>).map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                        statusFilter === status
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <ApplicationTable data={filteredApplications} />

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => loadApplications(true)}
                isLoading={loadingMore}
                disabled={loadingMore}
                className="bg-white min-w-[200px]"
              >
                Show More Results
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Selected Tab */}
        <TabsContent value="selected" className="space-y-6 outline-none">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xl font-semibold text-gray-900">Shortlisted Candidates</h3>
            <Badge variant="success" className="px-3 py-1">
              {stats['Shortlisted'] || 0} Total
            </Badge>
          </div>
          <ApplicationTable
            data={applications.filter(a => a.status === 'Shortlisted')}
          />
        </TabsContent>
      </Tabs>

      {/* Email Composer Modal */}
      {composer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl border-none shadow-2xl animate-in fade-in zoom-in duration-200">
            <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 p-6">
              <div>
                <CardTitle className="text-xl">Compose Email</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Recipient: <span className="font-medium text-gray-900">{composer.application.fullName}</span> • {composer.application.positionTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposer(null)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>

            <CardContent className="space-y-5 p-6">
              <Input
                label="Subject"
                value={composer.subject}
                onChange={(e) => setComposer({ ...composer, subject: e.target.value })}
                className="bg-gray-50/50 outline-none"
              />
              <TextArea
                label="Message Body"
                value={composer.message}
                onChange={(e) => setComposer({ ...composer, message: e.target.value })}
                rows={8}
                className="bg-gray-50/50 outline-none resize-none"
              />
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Action after sending</label>
                  <select
                    value={composer.status}
                    onChange={(e) => setComposer({ ...composer, status: e.target.value as CareerApplicationStatus })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236B7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
                  >
                    {careerApplicationStatuses.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setComposer(null)} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={sendEmail}
                    isLoading={actionLoading === `${composer.application.id}-email`}
                    leftIcon={<Send className="w-4 h-4" />}
                    className="flex-1 shadow-sm"
                    disabled={!composer.subject.trim() || !composer.message.trim()}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
