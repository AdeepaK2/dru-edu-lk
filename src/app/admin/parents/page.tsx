'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Users, Send, CheckCircle, XCircle, User, UserPlus, Search, RefreshCcw, History } from 'lucide-react';
import { collection, query, where, getDocs, getDoc, orderBy, limit, doc } from 'firebase/firestore';
import { firestore } from '@/utils/firebase-client';

interface Student {
  id: string;
  name: string;
  email: string;
  parent?: {
    name: string;
    email: string;
    phone: string;
  };
}

interface ParentInvite {
  id: string;
  parentEmail: string;
  parentName: string;
  parentPhone?: string;
  students: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  inviteStatus: 'pending' | 'accepted' | 'expired' | 'cancelled';
  inviteLink: string;
  expiresAt: string;
  sentAt: string;
  acceptedAt?: string;
}

interface ExistingParentInfo {
  email: string;
  name: string;
  phone?: string;
  linkedStudents: Array<{
    studentId: string;
    studentName: string;
  }>;
  pendingInvites?: ParentInvite[];
}

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
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [parentEmail, setParentEmail] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [relationship, setRelationship] = useState<'mother' | 'father' | 'guardian' | 'other'>('guardian');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [existingParentInfo, setExistingParentInfo] = useState<ExistingParentInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'emailIssues'>('create');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [parentGroups, setParentGroups] = useState<Map<string, Student[]>>(new Map());

  // Email Issues state
  const [problematicStudents, setProblematicStudents] = useState<ProblematicStudent[]>([]);
  const [emailChangeLogs, setEmailChangeLogs] = useState<EmailChangeLog[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [sendingEmails, setSendingEmails] = useState<string[]>([]);
  const [sentEmails, setSentEmails] = useState<string[]>([]);

  useEffect(() => {
    loadStudents();
  }, []);

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
    if (activeTab === 'emailIssues') loadEmailIssues();
  }, [activeTab, loadEmailIssues]);

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

  const loadStudents = async () => {
    try {
      const response = await fetch('/api/student');
      if (response.ok) {
        const data = await response.json();
        const allStudents = data.students || [];
        setStudents(allStudents);
        
        // Group students by parent email
        const groups = new Map<string, Student[]>();
        allStudents.forEach((student: Student) => {
          if (student.parent?.email) {
            const email = student.parent.email.toLowerCase();
            if (!groups.has(email)) {
              groups.set(email, []);
            }
            groups.get(email)!.push(student);
          }
        });
        setParentGroups(groups);
      }
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const checkExistingParent = async (email: string) => {
    if (!email || !email.includes('@')) {
      setExistingParentInfo(null);
      return;
    }

    try {
      const response = await fetch(`/api/parent/check?email=${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          setExistingParentInfo(data.parentInfo);
          
          // Pre-fill name and phone if exists
          if (data.parentInfo.name && !parentName) {
            setParentName(data.parentInfo.name);
          }
          if (data.parentInfo.phone && !parentPhone) {
            setParentPhone(data.parentInfo.phone);
          }
        } else {
          setExistingParentInfo(null);
        }
      }
    } catch (error) {
      console.error('Error checking parent:', error);
    }
  };

  const handleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => {
      if (prev.includes(studentId)) {
        return prev.filter(id => id !== studentId);
      } else {
        // Auto-fill parent info from first selected student
        if (prev.length === 0) {
          const student = students.find(s => s.id === studentId);
          if (student?.parent?.email) {
            setParentEmail(student.parent.email);
            if (student.parent.name) setParentName(student.parent.name);
            if (student.parent.phone) setParentPhone(student.parent.phone);
            checkExistingParent(student.parent.email);
          }
        }
        return [...prev, studentId];
      }
    });
  };

  const selectAllSiblings = (siblings: Student[]) => {
    const siblingIds = siblings.map(s => s.id);
    setSelectedStudents(prev => Array.from(new Set([...prev, ...siblingIds])));
    
    // Auto-fill parent info
    if (siblings.length > 0 && siblings[0].parent) {
      setParentEmail(siblings[0].parent.email);
      if (siblings[0].parent.name) setParentName(siblings[0].parent.name);
      if (siblings[0].parent.phone) setParentPhone(siblings[0].parent.phone);
      checkExistingParent(siblings[0].parent.email);
    }
  };

  const handleSendInvite = async () => {
    if (!parentEmail || !parentName || selectedStudents.length === 0) {
      setMessage({ type: 'error', text: 'Please fill in all required fields and select at least one student' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/parent/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentEmail,
          parentName,
          parentPhone,
          studentIds: selectedStudents,
          relationship,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Invite sent successfully to ${parentEmail}! ${existingParentInfo ? 'Additional students linked to existing parent.' : ''}` 
        });
        
        // Reset form
        setSelectedStudents([]);
        setParentEmail('');
        setParentName('');
        setParentPhone('');
        setRelationship('guardian');
        setExistingParentInfo(null);
        
        // Reload data
        loadStudents();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send invite' });
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      setMessage({ type: 'error', text: 'Failed to send invite. Please try again.' });
    } finally {
      setLoading(false);
    }
  };


  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.parent?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group filtered students by parent email for display
  const filteredParentGroups = new Map<string, Student[]>();
  filteredStudents.forEach(student => {
    if (student.parent?.email) {
      const email = student.parent.email.toLowerCase();
      if (!filteredParentGroups.has(email)) {
        filteredParentGroups.set(email, []);
      }
      filteredParentGroups.get(email)!.push(student);
    } else {
      // Students without parent email go into individual group
      filteredParentGroups.set(`no-parent-${student.id}`, [student]);
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Parent Management
          </h1>
          <p className="mt-2 text-gray-600">
            Send invites to parents and manage parent accounts for mobile app access
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-4 flex-wrap">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'create'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              Send Invite
            </button>
            <button
              onClick={() => setActiveTab('emailIssues')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'emailIssues'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <AlertCircle className="w-4 h-4 inline mr-2" />
              Email Issues
              {problematicStudents.length > 0 && (
                <span className="ml-2 bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {problematicStudents.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
            message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 mt-0.5" /> :
             message.type === 'error' ? <XCircle className="w-5 h-5 mt-0.5" /> :
             <AlertCircle className="w-5 h-5 mt-0.5" />}
            <div>
              <p className="font-medium">{message.text}</p>
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Parent Information Form */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Parent Information
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parent Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={parentEmail}
                    onChange={(e) => {
                      setParentEmail(e.target.value);
                      checkExistingParent(e.target.value);
                    }}
                    onBlur={() => checkExistingParent(parentEmail)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="parent@example.com"
                  />
                  {existingParentInfo && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Parent already exists!
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        This parent has {existingParentInfo.linkedStudents.length} student(s) already:
                      </p>
                      <ul className="text-xs text-blue-700 mt-1 ml-4 list-disc">
                        {existingParentInfo.linkedStudents.map((student, idx) => (
                          <li key={idx}>{student.studentName}</li>
                        ))}
                      </ul>
                      {existingParentInfo.pendingInvites && existingParentInfo.pendingInvites.length > 0 && (
                        <p className="text-xs text-yellow-700 mt-2">
                          ⚠️ {existingParentInfo.pendingInvites.length} pending invite(s) for this email
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parent Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parent Phone
                  </label>
                  <input
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+61412345678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Relationship
                  </label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value as any)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="mother">Mother</option>
                    <option value="father">Father</option>
                    <option value="guardian">Guardian</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Student Selection */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Select Students ({selectedStudents.length})
              </h2>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Search students..."
                  />
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {Array.from(filteredParentGroups.entries()).map(([groupKey, groupStudents]) => {
                  const isNoParent = groupKey.startsWith('no-parent-');
                  const parentEmail = isNoParent ? null : groupKey;
                  const hasMultipleChildren = groupStudents.length > 1;
                  
                  return (
                    <div key={groupKey} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Parent Group Header */}
                      {parentEmail && (
                        <div className="bg-blue-50 px-3 py-2 border-b border-blue-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">{parentEmail}</span>
                            {hasMultipleChildren && (
                              <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                                {groupStudents.length} children
                              </span>
                            )}
                          </div>
                          {hasMultipleChildren && (
                            <button
                              onClick={() => selectAllSiblings(groupStudents)}
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md transition-colors"
                            >
                              Select All
                            </button>
                          )}
                        </div>
                      )}
                      
                      {/* Students in this group */}
                      <div className="divide-y divide-gray-100">
                        {groupStudents.map((student) => {
                          const isAlreadyLinked = existingParentInfo?.linkedStudents.some(s => s.studentId === student.id);
                          
                          return (
                            <label
                              key={student.id}
                              className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                                selectedStudents.includes(student.id)
                                  ? 'bg-blue-50'
                                  : isAlreadyLinked
                                  ? 'bg-gray-50 cursor-not-allowed'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedStudents.includes(student.id)}
                                onChange={() => !isAlreadyLinked && handleStudentSelection(student.id)}
                                disabled={isAlreadyLinked}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                              />
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{student.name}</p>
                                <p className="text-sm text-gray-500">{student.email}</p>
                                {isNoParent && (
                                  <p className="text-xs text-amber-600 mt-1">⚠️ No parent email on record</p>
                                )}
                                {isAlreadyLinked && (
                                  <p className="text-xs text-blue-600 mt-1">Already linked to this parent</p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {filteredParentGroups.size === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No students found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Send Invite Button */}
            <div className="lg:col-span-2">
              <button
                onClick={handleSendInvite}
                disabled={loading || !parentEmail || !parentName || selectedStudents.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                {loading ? 'Sending Invite...' : `Send Invite to ${selectedStudents.length} Student${selectedStudents.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'emailIssues' && (
          /* Email Issues Tab */
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
                <p className="text-sm text-orange-600 font-medium">Students with Duplicate Email</p>
                <p className="text-4xl font-bold text-orange-700 mt-1">{problematicStudents.length}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <p className="text-sm text-green-600 font-medium">Emails Sent This Session</p>
                <p className="text-4xl font-bold text-green-700 mt-1">{sentEmails.length}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <p className="text-sm text-blue-600 font-medium">Total Email Changes Logged</p>
                <p className="text-4xl font-bold text-blue-700 mt-1">{emailChangeLogs.length}</p>
              </div>
            </div>

            {/* Problematic Students Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-5 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
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
                      className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg text-sm font-medium"
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
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
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
                        <tr key={s.id} className={sentEmails.includes(s.id) ? 'bg-green-50' : 'hover:bg-gray-50'}>
                          <td className="px-5 py-4 font-medium text-gray-900">{s.name}</td>
                          <td className="px-5 py-4 text-gray-600">{s.email}</td>
                          <td className="px-5 py-4 text-gray-600">{s.parentName || <span className="text-gray-400 italic">—</span>}</td>
                          <td className="px-5 py-4">
                            {sentEmails.includes(s.id) ? (
                              <span className="flex items-center gap-1 text-green-600 font-medium text-xs">
                                <CheckCircle className="w-4 h-4" /> Email Sent
                              </span>
                            ) : (
                              <button
                                onClick={() => sendUpdateEmail(s.id, s.name, s.parentEmail, s.parentName)}
                                disabled={sendingEmails.includes(s.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md text-xs font-medium"
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
                          <td className="px-5 py-4 text-red-500 line-through">{log.oldParentEmail}</td>
                          <td className="px-5 py-4 text-green-600 font-medium">{log.newParentEmail}</td>
                          <td className="px-5 py-4 text-gray-500">{log.changedAt ? new Date(log.changedAt).toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
