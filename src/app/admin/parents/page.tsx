'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Users, Send, CheckCircle, XCircle, RefreshCcw, History, Search } from 'lucide-react';
import { collection, query, getDocs, orderBy, limit, doc, getDoc, writeBatch } from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';

interface ProblematicStudent {
  id: string;
  name: string;
  email: string;
  parentName: string;
  parentEmail: string;
}

interface EmailChangeLog {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  oldParentEmail: string;
  newParentEmail: string;
  changedAt: string;
}

interface ParentEmailUpdateRequest {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  currentParentEmail: string;
  requestedParentEmail: string;
  requesterName?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedAt?: string;
}

type AdminTab = 'issues' | 'requests';

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function ParentManagementPage() {
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('issues');

  const [problematicStudents, setProblematicStudents] = useState<ProblematicStudent[]>([]);
  const [emailChangeLogs, setEmailChangeLogs] = useState<EmailChangeLog[]>([]);
  const [updateRequests, setUpdateRequests] = useState<ParentEmailUpdateRequest[]>([]);

  const [issuesLoading, setIssuesLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const [sendingEmails, setSendingEmails] = useState<string[]>([]);
  const [sentEmails, setSentEmails] = useState<string[]>([]);
  const [approvingRequests, setApprovingRequests] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setIssuesLoading(true);
    setRequestsLoading(true);

    try {
      const studentsSnap = await getDocs(collection(firestore, 'students'));
      const problems: ProblematicStudent[] = [];

      studentsSnap.forEach((studentDoc) => {
        const data = studentDoc.data();
        if (data.email && data.parent?.email && data.email.toLowerCase() === data.parent.email.toLowerCase()) {
          problems.push({
            id: studentDoc.id,
            name: data.name || '',
            email: data.email || '',
            parentName: data.parent?.name || '',
            parentEmail: data.parent?.email || '',
          });
        }
      });
      setProblematicStudents(problems);

      const logsSnap = await getDocs(
        query(collection(firestore, 'parentEmailChangeLogs'), orderBy('changedAt', 'desc'), limit(50)),
      );
      const logs: EmailChangeLog[] = logsSnap.docs.map(
        (logDoc) => ({ id: logDoc.id, ...logDoc.data() } as EmailChangeLog),
      );
      setEmailChangeLogs(logs);

      const requestsSnap = await getDocs(
        query(collection(firestore, 'parentEmailUpdateRequests'), orderBy('requestedAt', 'desc'), limit(100)),
      );
      const requests: ParentEmailUpdateRequest[] = requestsSnap.docs.map(
        (requestDoc) => ({ id: requestDoc.id, ...requestDoc.data() } as ParentEmailUpdateRequest),
      );
      setUpdateRequests(requests);
    } catch (err) {
      console.error('Error loading parent management data:', err);
      setMessage({ type: 'error', text: 'Failed to load parent management data.' });
    } finally {
      setIssuesLoading(false);
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sendUpdateEmail = async (studentId: string, studentName: string, parentEmail: string, parentName: string) => {
    setSendingEmails((prev) => [...prev, studentId]);
    try {
      const res = await fetch('/api/parent/send-email-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, studentName, parentEmail, parentName }),
      });

      if (res.ok) {
        setSentEmails((prev) => [...prev, studentId]);
      } else {
        let errorMessage = `Failed to send email to ${parentEmail}`;
        try {
          const data = await res.json();
          if (data?.error) errorMessage = `Failed to send email to ${parentEmail}: ${data.error}`;
        } catch {
          // Keep generic error message.
        }
        setMessage({ type: 'error', text: errorMessage });
      }
    } catch {
      setMessage({ type: 'error', text: `Failed to send email to ${parentEmail}` });
    } finally {
      setSendingEmails((prev) => prev.filter((id) => id !== studentId));
    }
  };

  const sendAllUpdateEmails = async () => {
    for (const student of problematicStudents) {
      if (!sentEmails.includes(student.id)) {
        await sendUpdateEmail(student.id, student.name, student.parentEmail, student.parentName);
      }
    }
  };

  const approveRequest = async (request: ParentEmailUpdateRequest) => {
    if (request.status !== 'pending') return;

    setApprovingRequests((prev) => [...prev, request.id]);
    setMessage(null);

    try {
      const normalizedRequestedParentEmail = request.requestedParentEmail.trim().toLowerCase();
      const normalizedStudentEmail = request.studentEmail.trim().toLowerCase();

      if (normalizedRequestedParentEmail === normalizedStudentEmail) {
        setMessage({
          type: 'error',
          text: `Cannot approve request for ${request.studentName}: requested parent email matches student email.`,
        });
        return;
      }

      const studentRef = doc(firestore, 'students', request.studentId);
      const studentSnap = await getDoc(studentRef);

      if (!studentSnap.exists()) {
        setMessage({
          type: 'error',
          text: `Student record not found for request: ${request.studentName}`,
        });
        return;
      }

      const studentData = studentSnap.data();
      const oldParentEmail = studentData.parent?.email || request.currentParentEmail || '';

      const batch = writeBatch(firestore);

      batch.update(studentRef, {
        'parent.email': normalizedRequestedParentEmail,
        'parent.updatedAt': new Date().toISOString(),
      });

      const logRef = doc(collection(firestore, 'parentEmailChangeLogs'));
      batch.set(logRef, {
        studentId: request.studentId,
        studentName: request.studentName || studentData.name || '',
        studentEmail: studentData.email || request.studentEmail || '',
        oldParentEmail,
        newParentEmail: normalizedRequestedParentEmail,
        changedAt: new Date().toISOString(),
        changeSource: 'admin_approved_request',
        requestId: request.id,
      });

      const requestRef = doc(firestore, 'parentEmailUpdateRequests', request.id);
      batch.update(requestRef, {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
      });

      await batch.commit();

      setMessage({
        type: 'success',
        text: `Approved and updated parent email for ${request.studentName}.`,
      });

      await loadData();
    } catch (err) {
      console.error('Error approving parent email update request:', err);
      setMessage({ type: 'error', text: `Failed to approve request for ${request.studentName}.` });
    } finally {
      setApprovingRequests((prev) => prev.filter((id) => id !== request.id));
    }
  };

  const pendingRequestCount = useMemo(
    () => updateRequests.filter((request) => request.status === 'pending').length,
    [updateRequests],
  );
  const normalizedSearchQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const filteredProblematicStudents = useMemo(() => {
    if (!normalizedSearchQuery) return problematicStudents;
    return problematicStudents.filter((student) =>
      [
        student.id,
        student.name,
        student.email,
        student.parentName,
        student.parentEmail,
      ].some((value) => (value || '').toLowerCase().includes(normalizedSearchQuery)),
    );
  }, [problematicStudents, normalizedSearchQuery]);

  const filteredUpdateRequests = useMemo(() => {
    if (!normalizedSearchQuery) return updateRequests;
    return updateRequests.filter((request) =>
      [
        request.studentId,
        request.studentName,
        request.studentEmail,
        request.currentParentEmail,
        request.requestedParentEmail,
        request.requesterName,
        request.status,
      ].some((value) => (value || '').toLowerCase().includes(normalizedSearchQuery)),
    );
  }, [updateRequests, normalizedSearchQuery]);

  const filteredEmailChangeLogs = useMemo(() => {
    if (!normalizedSearchQuery) return emailChangeLogs;
    return emailChangeLogs.filter((log) =>
      [
        log.studentId,
        log.studentName,
        log.studentEmail,
        log.oldParentEmail,
        log.newParentEmail,
      ].some((value) => (value || '').toLowerCase().includes(normalizedSearchQuery)),
    );
  }, [emailChangeLogs, normalizedSearchQuery]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900">
            <Users className="h-8 w-8 text-gray-700" />
            Parent Management
          </h1>
          <p className="mt-2 text-gray-600">
            Manage duplicate parent emails and review parent email update requests.
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 flex items-start gap-3 rounded-lg border p-4 ${
              message.type === 'success'
                ? 'border-gray-200 bg-gray-50 text-gray-800'
                : message.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-gray-200 bg-gray-50 text-gray-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="mt-0.5 h-5 w-5" />
            ) : message.type === 'error' ? (
              <XCircle className="mt-0.5 h-5 w-5" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5" />
            )}
            <p className="font-medium">{message.text}</p>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-600">Students with Duplicate Email</p>
            <p className="mt-1 text-4xl font-bold text-gray-900">{problematicStudents.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-600">Pending Update Requests</p>
            <p className="mt-1 text-4xl font-bold text-gray-900">{pendingRequestCount}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-600">Emails Sent This Session</p>
            <p className="mt-1 text-4xl font-bold text-gray-900">{sentEmails.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-600">Total Email Changes Logged</p>
            <p className="mt-1 text-4xl font-bold text-gray-900">{emailChangeLogs.length}</p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('issues')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'issues'
                ? 'bg-gray-900 text-white'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Email Issues
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'requests'
                ? 'bg-gray-900 text-white'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Update Requests ({pendingRequestCount})
          </button>
          <button
            onClick={loadData}
            disabled={issuesLoading || requestsLoading}
            className="ml-auto flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${issuesLoading || requestsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <label htmlFor="studentSearch" className="mb-2 block text-sm font-medium text-gray-700">
            Search Student
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="studentSearch"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, student email, parent email, or ID"
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>
        </div>

        {activeTab === 'issues' && (
          <div className="space-y-8">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                  <AlertCircle className="h-5 w-5 text-gray-500" />
                  Students Where Parent Email = Student Email
                </h2>
                {problematicStudents.length > 0 && (
                  <button
                    onClick={sendAllUpdateEmails}
                    disabled={sendingEmails.length > 0}
                    className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:bg-gray-400"
                  >
                    <Send className="h-4 w-4" />
                    Send Update Email to All ({problematicStudents.filter((s) => !sentEmails.includes(s.id)).length} remaining)
                  </button>
                )}
              </div>

              {issuesLoading ? (
                <div className="p-10 text-center text-gray-400">
                  <RefreshCcw className="mx-auto mb-2 h-8 w-8 animate-spin" />
                  Loading...
                </div>
              ) : problematicStudents.length === 0 ? (
                <div className="p-10 text-center">
                  <CheckCircle className="mx-auto mb-2 h-10 w-10 text-gray-400" />
                  <p className="text-gray-500">No issues found. All parent emails are distinct.</p>
                </div>
              ) : filteredProblematicStudents.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  No students match your search.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Student</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Shared Email</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Parent Name</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredProblematicStudents.map((student) => (
                        <tr key={student.id} className={sentEmails.includes(student.id) ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                          <td className="px-5 py-4 font-medium text-gray-900">{student.name}</td>
                          <td className="px-5 py-4 text-gray-600">{student.email}</td>
                          <td className="px-5 py-4 text-gray-600">
                            {student.parentName || <span className="italic text-gray-400">—</span>}
                          </td>
                          <td className="px-5 py-4">
                            {sentEmails.includes(student.id) ? (
                              <span className="flex items-center gap-1 text-xs font-medium text-gray-700">
                                <CheckCircle className="h-4 w-4" />
                                Email Sent
                              </span>
                            ) : (
                              <button
                                onClick={() => sendUpdateEmail(student.id, student.name, student.parentEmail, student.parentName)}
                                disabled={sendingEmails.includes(student.id)}
                                className="flex items-center gap-1 rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
                              >
                                <Send className="h-3 w-3" />
                                {sendingEmails.includes(student.id) ? 'Sending...' : 'Send Email'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 p-5">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                  <History className="h-5 w-5 text-blue-500" />
                  Parent Email Change History
                  <span className="ml-1 text-xs font-normal text-gray-400">(most recent 50)</span>
                </h2>
              </div>
              {emailChangeLogs.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <History className="mx-auto mb-2 h-8 w-8" />
                  No changes have been made yet.
                </div>
              ) : filteredEmailChangeLogs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No history entries match your search.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Student</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Old Email</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">New Email</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Changed At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredEmailChangeLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-5 py-4">
                            <p className="font-medium text-gray-900">{log.studentName}</p>
                            <p className="text-xs text-gray-400">{log.studentEmail}</p>
                          </td>
                          <td className="px-5 py-4 text-gray-500 line-through">{log.oldParentEmail}</td>
                          <td className="px-5 py-4 font-medium text-gray-900">{log.newParentEmail}</td>
                          <td className="px-5 py-4 text-gray-500">{formatDateTime(log.changedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-800">
                Parent Email Update Requests
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Requests are created by parents. Approve to apply the requested parent email to the student record.
              </p>
            </div>

            {requestsLoading ? (
              <div className="p-10 text-center text-gray-400">
                <RefreshCcw className="mx-auto mb-2 h-8 w-8 animate-spin" />
                Loading requests...
              </div>
            ) : updateRequests.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                No update requests found.
              </div>
            ) : filteredUpdateRequests.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                No update requests match your search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Student</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Current Parent Email</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Requested Parent Email</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Requester</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Requested At</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">Status / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUpdateRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-900">{request.studentName}</p>
                          <p className="text-xs text-gray-400">{request.studentEmail}</p>
                        </td>
                        <td className="px-5 py-4 text-gray-600">{request.currentParentEmail || '—'}</td>
                        <td className="px-5 py-4 font-medium text-gray-900">{request.requestedParentEmail}</td>
                        <td className="px-5 py-4 text-gray-600">{request.requesterName || '—'}</td>
                        <td className="px-5 py-4 text-gray-500">{formatDateTime(request.requestedAt)}</td>
                        <td className="px-5 py-4">
                          {request.status === 'pending' ? (
                            <button
                              onClick={() => approveRequest(request)}
                              disabled={approvingRequests.includes(request.id)}
                              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:bg-green-300"
                            >
                              {approvingRequests.includes(request.id) ? 'Approving...' : 'Accept'}
                            </button>
                          ) : (
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                request.status === 'approved'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {request.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
