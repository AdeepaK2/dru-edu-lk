'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Users, Send, CheckCircle, XCircle, RefreshCcw, History } from 'lucide-react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
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

export default function ParentManagementPage() {
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Email Issues state
  const [problematicStudents, setProblematicStudents] = useState<ProblematicStudent[]>([]);
  const [emailChangeLogs, setEmailChangeLogs] = useState<EmailChangeLog[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [sendingEmails, setSendingEmails] = useState<string[]>([]);
  const [sentEmails, setSentEmails] = useState<string[]>([]);

  const loadEmailIssues = useCallback(async () => {
    setIssuesLoading(true);
    try {
      // Find students where parent.email === student email
      const studentsSnap = await getDocs(collection(firestore, 'students'));
      const problems: ProblematicStudent[] = [];
      studentsSnap.forEach(d => {
        const data = d.data();
        if (data.email && data.parent?.email && data.email.toLowerCase() === data.parent.email.toLowerCase()) {
          problems.push({ id: d.id, name: data.name, email: data.email, parentName: data.parent.name || '', parentEmail: data.parent.email });
        }
      });
      setProblematicStudents(problems);

      // Load email change history
      const logsSnap = await getDocs(query(collection(firestore, 'parentEmailChangeLogs'), orderBy('changedAt', 'desc'), limit(50)));
      const logs: EmailChangeLog[] = logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as EmailChangeLog));
      setEmailChangeLogs(logs);
    } catch (err) {
      console.error('Error loading email issues:', err);
    } finally {
      setIssuesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmailIssues();
  }, [loadEmailIssues]);

  const sendUpdateEmail = async (studentId: string, studentName: string, parentEmail: string, parentName: string) => {
    setSendingEmails(prev => [...prev, studentId]);
    try {
      const res = await fetch('/api/parent/send-email-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, studentName, parentEmail, parentName }),
      });
      if (res.ok) setSentEmails(prev => [...prev, studentId]);
      else setMessage({ type: 'error', text: `Failed to send email to ${parentEmail}` });
    } catch {
      setMessage({ type: 'error', text: `Failed to send email to ${parentEmail}` });
    } finally {
      setSendingEmails(prev => prev.filter(id => id !== studentId));
    }
  };

  const sendAllUpdateEmails = async () => {
    for (const s of problematicStudents) {
      if (!sentEmails.includes(s.id)) {
        await sendUpdateEmail(s.id, s.name, s.parentEmail, s.parentName);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-gray-700" />
            Parent Management
          </h1>
          <p className="mt-2 text-gray-600">
            Find and fix cases where parent email matches student email
          </p>
        </div>

        {/* Messages */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success' ? 'bg-gray-50 text-gray-800 border border-gray-200' :
            message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
            'bg-gray-50 text-gray-800 border border-gray-200'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 mt-0.5" /> :
             message.type === 'error' ? <XCircle className="w-5 h-5 mt-0.5" /> :
             <AlertCircle className="w-5 h-5 mt-0.5" />}
            <div>
              <p className="font-medium">{message.text}</p>
            </div>
          </div>
        )}
        <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-sm text-gray-600 font-medium">Students with Duplicate Email</p>
                <p className="text-4xl font-bold text-gray-900 mt-1">{problematicStudents.length}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-sm text-gray-600 font-medium">Emails Sent This Session</p>
                <p className="text-4xl font-bold text-gray-900 mt-1">{sentEmails.length}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-sm text-gray-600 font-medium">Total Email Changes Logged</p>
                <p className="text-4xl font-bold text-gray-900 mt-1">{emailChangeLogs.length}</p>
              </div>
            </div>

            {/* Problematic Students Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-5 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-gray-500" />
                  Students Where Parent Email = Student Email
                </h2>
                <div className="flex gap-3">
                  <button
                    onClick={loadEmailIssues}
                    disabled={issuesLoading}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                  >
                    <RefreshCcw className={`w-4 h-4 ${issuesLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  {problematicStudents.length > 0 && (
                    <button
                      onClick={sendAllUpdateEmails}
                      disabled={sendingEmails.length > 0}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium"
                    >
                      <Send className="w-4 h-4" />
                      Send Update Email to All ({problematicStudents.filter(s => !sentEmails.includes(s.id)).length} remaining)
                    </button>
                  )}
                </div>
              </div>

              {issuesLoading ? (
                <div className="p-10 text-center text-gray-400">
                  <RefreshCcw className="w-8 h-8 animate-spin mx-auto mb-2" />
                  Loading...
                </div>
              ) : problematicStudents.length === 0 ? (
                <div className="p-10 text-center">
                  <CheckCircle className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No issues found! All parent emails are distinct.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Shared Email</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Parent Name</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {problematicStudents.map(s => (
                        <tr key={s.id} className={sentEmails.includes(s.id) ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                          <td className="px-5 py-4 font-medium text-gray-900">{s.name}</td>
                          <td className="px-5 py-4 text-gray-600">{s.email}</td>
                          <td className="px-5 py-4 text-gray-600">{s.parentName || <span className="text-gray-400 italic">—</span>}</td>
                          <td className="px-5 py-4">
                            {sentEmails.includes(s.id) ? (
                              <span className="flex items-center gap-1 text-gray-700 font-medium text-xs">
                                <CheckCircle className="w-4 h-4" /> Email Sent
                              </span>
                            ) : (
                              <button
                                onClick={() => sendUpdateEmail(s.id, s.name, s.parentEmail, s.parentName)}
                                disabled={sendingEmails.includes(s.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-md text-xs font-medium"
                              >
                                <Send className="w-3 h-3" />
                                {sendingEmails.includes(s.id) ? 'Sending...' : 'Send Email'}
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

            {/* Change History */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-5 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-500" />
                  Parent Email Change History
                  <span className="text-xs text-gray-400 font-normal ml-1">(most recent 50)</span>
                </h2>
              </div>
              {emailChangeLogs.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <History className="w-8 h-8 mx-auto mb-2" />
                  No changes have been made yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Old Email</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">New Email</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Changed At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {emailChangeLogs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-5 py-4">
                            <p className="font-medium text-gray-900">{log.studentName}</p>
                            <p className="text-xs text-gray-400">{log.studentEmail}</p>
                          </td>
                          <td className="px-5 py-4 text-gray-500 line-through">{log.oldParentEmail}</td>
                          <td className="px-5 py-4 text-gray-900 font-medium">{log.newParentEmail}</td>
                          <td className="px-5 py-4 text-gray-500">{log.changedAt ? new Date(log.changedAt).toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
