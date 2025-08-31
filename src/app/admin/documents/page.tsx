'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { 
  FileCheck, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Eye, 
  Check, 
  X, 
  Filter,
  Search,
  ArrowUpDown
} from 'lucide-react';
import { DocumentInfo, DocumentType } from '@/models/studentSchema';
import { StudentDocumentService } from '@/apiservices/studentDocumentService';
import Button from '@/components/ui/Button';

interface StudentWithDocuments {
  id: string;
  name: string;
  email: string;
  documents?: DocumentInfo[];
  status: 'Active' | 'Suspended' | 'Inactive';
  enrolledClasses?: Array<{
    classId: string;
    className: string;
    subject: string;
    status: 'Active' | 'Inactive';
  }>;
}

interface FilterOptions {
  status: 'All' | 'Verified' | 'Pending' | 'Rejected' | 'Not Submitted';
  documentType: 'All' | DocumentType;
  classId: 'All' | string;
}

interface SortOptions {
  sortBy: 'name' | 'email' | 'class' | 'documentStatus';
  sortOrder: 'asc' | 'desc';
}

export default function DocumentVerificationPage() {
  const [admin, setAdmin] = useState<{ email: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [students, setStudents] = useState<StudentWithDocuments[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [verifyingDocument, setVerifyingDocument] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'All',
    documentType: 'All',
    classId: 'All'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOptions, setSortOptions] = useState<SortOptions>({
    sortBy: 'name',
    sortOrder: 'asc'
  });
  const [verificationNote, setVerificationNote] = useState('');
  
  // Email reminder state
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderResults, setReminderResults] = useState<any>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderPreview, setReminderPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Check admin auth
  useEffect(() => {
    setTimeout(() => {
      setAdmin({ email: 'admin@example.com' });
      setAuthLoading(false);
    }, 1000);
  }, []);

  // Load students with document status
  useEffect(() => {
    const loadStudents = async () => {
      if (!admin) return;
      
      try {
        setLoading(true);
        const studentsWithDocs = await StudentDocumentService.getStudentsWithDocumentStatus();
        setStudents(studentsWithDocs);
      } catch (error) {
        console.error('Error loading students with document status:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (admin) {
      loadStudents();
    }
  }, [admin]);

  // Toggle expanded view for a student
  const toggleExpandStudent = (studentId: string) => {
    setExpandedStudent(prev => prev === studentId ? null : studentId);
  };

  // Handle document verification
  const handleVerifyDocument = async (
    studentId: string, 
    documentType: DocumentType, 
    status: 'Verified' | 'Rejected'
  ) => {
    if (!admin) return;
    
    const verificationId = `${studentId}-${documentType}`;
    setVerifyingDocument(verificationId);
    
    try {
      await StudentDocumentService.verifyDocument(studentId, documentType, {
        status,
        verifiedBy: admin.email,
        notes: verificationNote
      });
      
      // Update local state
      setStudents(prev => 
        prev.map(student => {
          if (student.id === studentId) {
            return {
              ...student,
              documents: (student.documents || []).map(doc => {
                if (doc.type === documentType) {
                  return {
                    ...doc,
                    status,
                    verifiedAt: new Date().toISOString(),
                    verifiedBy: admin.email,
                    notes: verificationNote
                  };
                }
                return doc;
              })
            };
          }
          return student;
        })
      );
      
      setVerificationNote('');
      alert(`Document ${status.toLowerCase()} successfully.`);
    } catch (error) {
      console.error('Error verifying document:', error);
      alert(`Failed to verify document. Please try again.`);
    } finally {
      setVerifyingDocument(null);
    }
  };

  // Handle approving all documents for a student
  const handleApproveAllDocuments = async (studentId: string) => {
    if (!admin) return;
    
    const student = students.find(s => s.id === studentId);
    if (!student || !student.documents) return;
    
    // Check if all 3 document types are submitted
    const requiredDocs = [DocumentType.CLASS_POLICY, DocumentType.PARENT_NOTICE, DocumentType.PHOTO_CONSENT];
    const submittedDocs = student.documents.filter(doc => doc.status === 'Pending');
    const submittedTypes = submittedDocs.map(doc => doc.type);
    
    if (!requiredDocs.every(type => submittedTypes.includes(type))) {
      alert('Not all required documents are submitted yet.');
      return;
    }
    
    if (!confirm(`Approve all ${submittedDocs.length} documents for ${student.name}?`)) {
      return;
    }
    
    setVerifyingDocument(`${studentId}-all`);
    
    try {
      // Approve all pending documents
      const approvalPromises = submittedDocs.map(doc => 
        StudentDocumentService.verifyDocument(studentId, doc.type, {
          status: 'Verified',
          verifiedBy: admin.email,
          notes: 'Approved via bulk action'
        })
      );
      
      await Promise.all(approvalPromises);
      
      // Update local state
      setStudents(prev => 
        prev.map(s => {
          if (s.id === studentId) {
            return {
              ...s,
              documents: (s.documents || []).map(doc => {
                if (submittedTypes.includes(doc.type)) {
                  return {
                    ...doc,
                    status: 'Verified',
                    verifiedAt: new Date().toISOString(),
                    verifiedBy: admin.email,
                    notes: 'Approved via bulk action'
                  };
                }
                return doc;
              })
            };
          }
          return s;
        })
      );
      
      alert(`All ${submittedDocs.length} documents approved for ${student.name}!`);
    } catch (error) {
      console.error('Error approving all documents:', error);
      alert('Failed to approve all documents. Please try again.');
    } finally {
      setVerifyingDocument(null);
    }
  };

  // Check if student has all documents ready for bulk approval
  const canApproveAll = (student: StudentWithDocuments) => {
    if (!student.documents) return false;
    
    const requiredDocs = [DocumentType.CLASS_POLICY, DocumentType.PARENT_NOTICE, DocumentType.PHOTO_CONSENT];
    const pendingDocs = student.documents.filter(doc => doc.status === 'Pending');
    const pendingTypes = pendingDocs.map(doc => doc.type);
    
    return requiredDocs.every(type => pendingTypes.includes(type));
  };

  // Load reminder preview
  const loadReminderPreview = async (type: 'all' | 'no_documents' = 'all') => {
    setLoadingPreview(true);
    try {
      console.log('Loading preview for type:', type);
      const response = await fetch(`/api/admin/send-document-reminders?type=${type}`);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to load preview: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Preview data received:', data);
      setReminderPreview(data);
    } catch (error) {
      console.error('Error loading reminder preview:', error);
      alert(`Failed to load preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Send document reminder emails
  const sendDocumentReminders = async (type: 'all' | 'no_documents' = 'all', isUrgent: boolean = false) => {
    if (!reminderPreview) {
      await loadReminderPreview(type);
      return;
    }

    if (reminderPreview.stats.total === 0) {
      alert('No students with missing documents found to send reminders to.');
      return;
    }

    const confirmMessage = `Send document notifications to ${reminderPreview.stats.total} students and their parents? (${reminderPreview.stats.totalEmailsToSend} total emails)`;
    
    if (!confirm(confirmMessage)) return;

    setSendingReminders(true);
    try {
      const response = await fetch('/api/admin/send-document-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, isUrgent })
      });

      if (!response.ok) throw new Error('Failed to send reminders');
      
      const data = await response.json();
      setReminderResults(data);
      
      const message = `Document notifications sent! ${data.summary.successful} successful, ${data.summary.failed} failed.`;
      alert(message);
      
      // Refresh the preview to show updated numbers
      await loadReminderPreview(type);
      
    } catch (error) {
      console.error('Error sending reminders:', error);
      alert('Failed to send document notifications. Please try again.');
    } finally {
      setSendingReminders(false);
    }
  };

  // Handle opening reminder modal
  const handleOpenReminderModal = async (type: 'all' | 'no_documents' = 'all') => {
    setShowReminderModal(true);
    await loadReminderPreview(type);
  };

  // Get unique classes from students data
  const getUniqueClasses = React.useMemo(() => {
    const classesMap = new Map<string, { classId: string; className: string; subject: string; studentCount: number }>();
    
    students.forEach(student => {
      if (student.enrolledClasses) {
        student.enrolledClasses.forEach(cls => {
          if (cls.status === 'Active') {
            const key = cls.classId;
            if (classesMap.has(key)) {
              const existing = classesMap.get(key)!;
              classesMap.set(key, { ...existing, studentCount: existing.studentCount + 1 });
            } else {
              classesMap.set(key, {
                classId: cls.classId,
                className: cls.className,
                subject: cls.subject,
                studentCount: 1
              });
            }
          }
        });
      }
    });
    
    return Array.from(classesMap.values()).sort((a, b) => a.className.localeCompare(b.className));
  }, [students]);

  // Filter and sort students based on search query, filters, and sort options
  const filteredAndSortedStudents = React.useMemo(() => {
    let filtered = students;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(student => 
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query) ||
        (student.enrolledClasses || []).some(cls => 
          cls.className.toLowerCase().includes(query) ||
          cls.subject.toLowerCase().includes(query)
        )
      );
    }
    
    // Apply class filter
    if (filters.classId !== 'All') {
      filtered = filtered.filter(student => 
        student.enrolledClasses?.some(cls => cls.classId === filters.classId && cls.status === 'Active')
      );
    }
    
    // Apply status and document type filters
    filtered = filtered.filter(student => {
      if (!student.documents || student.documents.length === 0) {
        return filters.status === 'All' || filters.status === 'Not Submitted';
      }
      
      return student.documents.some(doc => {
        const matchesType = filters.documentType === 'All' || doc.type === filters.documentType;
        
        let matchesStatus = false;
        if (filters.status === 'All') {
          matchesStatus = true;
        } else if (filters.status === 'Not Submitted') {
          matchesStatus = !doc;
        } else {
          matchesStatus = doc.status === filters.status;
        }
        
        return matchesType && matchesStatus;
      });
    });
    
    // Apply sorting
    return filtered.sort((a, b) => {
      let compareValue = 0;
      
      switch (sortOptions.sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'email':
          compareValue = a.email.localeCompare(b.email);
          break;
        case 'class':
          const aClass = (a.enrolledClasses && a.enrolledClasses.length > 0) 
            ? a.enrolledClasses[0].className 
            : 'No Class';
          const bClass = (b.enrolledClasses && b.enrolledClasses.length > 0) 
            ? b.enrolledClasses[0].className 
            : 'No Class';
          compareValue = aClass.localeCompare(bClass);
          break;
        case 'documentStatus':
          const aDocCount = (a.documents || []).filter(doc => doc.status === 'Verified').length;
          const bDocCount = (b.documents || []).filter(doc => doc.status === 'Verified').length;
          compareValue = aDocCount - bDocCount;
          break;
        default:
          compareValue = 0;
      }
      
      return sortOptions.sortOrder === 'desc' ? -compareValue : compareValue;
    });
  }, [students, searchQuery, filters, sortOptions]);

  // Filter students based on selected filters (keeping old function for compatibility)
  const filteredStudents = filteredAndSortedStudents;

  // Get document status badge
  const getStatusBadge = (status?: string) => {
    if (!status) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Not Submitted
        </span>
      );
    }
    
    switch (status) {
      case 'Verified':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Verified
          </span>
        );
      case 'Rejected':
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending
          </span>
        );
    }
  };

  // Get document status counts
  const getDocumentCounts = () => {
    let verified = 0, pending = 0, rejected = 0, notSubmitted = 0;
    let total = students.length * 3;
    
    students.forEach(student => {
      const docs = student.documents || [];
      
      docs.forEach(doc => {
        if (doc.status === 'Verified') verified++;
        else if (doc.status === 'Rejected') rejected++;
        else pending++;
      });
      
      const docTypes = [DocumentType.CLASS_POLICY, DocumentType.PARENT_NOTICE, DocumentType.PHOTO_CONSENT];
      const existingTypes = docs.map(doc => doc.type);
      const missingTypes = docTypes.filter(type => !existingTypes.includes(type));
      
      notSubmitted += missingTypes.length;
    });
    
    return { verified, pending, rejected, notSubmitted, total };
  };

  // Get class-specific document counts
  const getClassDocumentCounts = (classId: string) => {
    if (classId === 'All') return getDocumentCounts();
    
    const classStudents = students.filter(student => 
      student.enrolledClasses?.some(cls => cls.classId === classId && cls.status === 'Active')
    );
    
    let verified = 0, pending = 0, rejected = 0, notSubmitted = 0;
    let total = classStudents.length * 3;
    
    classStudents.forEach(student => {
      const docs = student.documents || [];
      
      docs.forEach(doc => {
        if (doc.status === 'Verified') verified++;
        else if (doc.status === 'Rejected') rejected++;
        else pending++;
      });
      
      const docTypes = [DocumentType.CLASS_POLICY, DocumentType.PARENT_NOTICE, DocumentType.PHOTO_CONSENT];
      const existingTypes = docs.map(doc => doc.type);
      const missingTypes = docTypes.filter(type => !existingTypes.includes(type));
      
      notSubmitted += missingTypes.length;
    });
    
    return { verified, pending, rejected, notSubmitted, total };
  };

  const counts = getClassDocumentCounts(filters.classId);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-green-600 border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!admin) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Authentication Required</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>You must be logged in as an administrator to access this page.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <FileCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Document Verification
                {filters.classId !== 'All' && (
                  <span className="text-lg font-normal text-gray-600 dark:text-gray-400 ml-2">
                    - {getUniqueClasses.find(cls => cls.classId === filters.classId)?.className}
                  </span>
                )}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                {filters.classId === 'All' 
                  ? 'Review and verify student document submissions' 
                  : `Viewing documents for ${getUniqueClasses.find(cls => cls.classId === filters.classId)?.subject || 'selected class'}`
                }
              </p>
            </div>
          </div>
          
          {/* Email Notification Action */}
          <div className="flex items-center">
            <Button
              onClick={() => handleOpenReminderModal('all')}
              disabled={loading}
            >
              Notify Students
            </Button>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Verified</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{counts.verified}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{counts.pending}</p>
            </div>
            <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Rejected</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{counts.rejected}</p>
            </div>
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Not Submitted</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{counts.notSubmitted}</p>
            </div>
            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-900/30 rounded-full flex items-center justify-center">
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Sort Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Search & Sort</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search Students
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or class..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 pl-10 pr-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>
          
          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sort By
            </label>
            <select
              value={sortOptions.sortBy}
              onChange={(e) => setSortOptions(prev => ({ ...prev, sortBy: e.target.value as SortOptions['sortBy'] }))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="name">Student Name</option>
              <option value="email">Email</option>
              <option value="class">Primary Class</option>
              <option value="documentStatus">Documents Verified</option>
            </select>
          </div>
          
          {/* Sort Order */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sort Order
            </label>
            <button
              type="button"
              onClick={() => setSortOptions(prev => ({ 
                ...prev, 
                sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' 
              }))}
              className="w-full flex items-center justify-center space-x-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span>{sortOptions.sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
            </button>
          </div>
        </div>
        
        {/* Quick Class Filters */}
        {getUniqueClasses.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quick Class Access
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilters(prev => ({ ...prev, classId: 'All' }))}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filters.classId === 'All'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                All Classes ({students.length})
              </button>
              {getUniqueClasses.slice(0, 6).map(cls => (
                <button
                  key={cls.classId}
                  onClick={() => setFilters(prev => ({ ...prev, classId: cls.classId }))}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filters.classId === cls.classId
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                  title={`${cls.className} - ${cls.subject}`}
                >
                  {cls.className} ({cls.studentCount})
                </button>
              ))}
              {getUniqueClasses.length > 6 && (
                <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                  +{getUniqueClasses.length - 6} more in dropdown
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Results Count */}
        <div className="mt-4 space-y-2">
          {searchQuery.trim() && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Found {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} matching "{searchQuery}"
            </div>
          )}
          
          {filters.classId !== 'All' && (
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                  Viewing class: {getUniqueClasses.find(cls => cls.classId === filters.classId)?.className} - {getUniqueClasses.find(cls => cls.classId === filters.classId)?.subject}
                </span>
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-400">
                {filteredStudents.length} of {getUniqueClasses.find(cls => cls.classId === filters.classId)?.studentCount || 0} students
              </div>
            </div>
          )}
          
          {filters.classId === 'All' && (searchQuery.trim() || filters.status !== 'All' || filters.documentType !== 'All') && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredStudents.length} of {students.length} total students
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Filters</h3>
          </div>
          
          {(filters.classId !== 'All' || filters.status !== 'All' || filters.documentType !== 'All' || searchQuery.trim()) && (
            <button
              onClick={() => {
                setFilters({ classId: 'All', status: 'All', documentType: 'All' });
                setSearchQuery('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 underline"
            >
              Clear all filters
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by Class
            </label>
            <select
              value={filters.classId}
              onChange={(e) => setFilters(prev => ({ ...prev, classId: e.target.value }))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="All">All Classes ({students.length} students)</option>
              {getUniqueClasses.map(cls => (
                <option key={cls.classId} value={cls.classId}>
                  {cls.className} - {cls.subject} ({cls.studentCount} students)
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Document Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as FilterOptions['status'] }))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="All">All Statuses</option>
              <option value="Verified">Verified</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
              <option value="Not Submitted">Not Submitted</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Document Type
            </label>
            <select
              value={filters.documentType}
              onChange={(e) => setFilters(prev => ({ ...prev, documentType: e.target.value as FilterOptions['documentType'] }))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="All">All Documents</option>
              <option value={DocumentType.CLASS_POLICY}>{DocumentType.CLASS_POLICY}</option>
              <option value={DocumentType.PARENT_NOTICE}>{DocumentType.PARENT_NOTICE}</option>
              <option value={DocumentType.PHOTO_CONSENT}>{DocumentType.PHOTO_CONSENT}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Students List */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-t-4 border-green-600 border-solid rounded-full animate-spin mr-3"></div>
            <p>Loading student documents...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <FileCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">No documents found</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                No students match your current filter criteria.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Student
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Classes
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Class Policy
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Parent Notice
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Photo Consent
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredStudents.map(student => {
                    const documents = student.documents || [];
                    const policyDoc = documents.find(doc => doc.type === DocumentType.CLASS_POLICY);
                    const noticeDoc = documents.find(doc => doc.type === DocumentType.PARENT_NOTICE);
                    const consentDoc = documents.find(doc => doc.type === DocumentType.PHOTO_CONSENT);
                    
                    return (
                      <Fragment key={student.id}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {student.name}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {student.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              {(student.enrolledClasses || []).length === 0 ? (
                                <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                                  No classes
                                </span>
                              ) : (
                                student.enrolledClasses?.slice(0, 2).map((cls, index) => (
                                  <div key={cls.classId} className="text-sm">
                                    <span className="font-medium text-gray-900 dark:text-white">
                                      {cls.className}
                                    </span>
                                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                                      ({cls.subject})
                                    </span>
                                    {cls.status !== 'Active' && (
                                      <span className="ml-1 px-1 py-0.5 text-xs rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                        {cls.status}
                                      </span>
                                    )}
                                  </div>
                                ))
                              )}
                              {(student.enrolledClasses || []).length > 2 && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  +{(student.enrolledClasses || []).length - 2} more
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(policyDoc?.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(noticeDoc?.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(consentDoc?.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              {/* Approve All Button - only show when all documents are submitted */}
                              {canApproveAll(student) && (
                                <Button
                                  type="button"
                                  onClick={() => handleApproveAllDocuments(student.id)}
                                  disabled={verifyingDocument === `${student.id}-all`}
                                  className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded flex items-center"
                                  title="Approve all 3 documents at once"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  {verifyingDocument === `${student.id}-all` ? 'Approving...' : 'Approve All'}
                                </Button>
                              )}
                              
                              {/* View Details Button */}
                              <button
                                onClick={() => toggleExpandStudent(student.id)}
                                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 flex items-center"
                              >
                                {expandedStudent === student.id ? (
                                  <div className="flex items-center">
                                    <ChevronUp className="w-4 h-4 mr-1" />
                                    Hide Details
                                  </div>
                                ) : (
                                  <div className="flex items-center">
                                    <ChevronDown className="w-4 h-4 mr-1" />
                                    View Details
                                  </div>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                        
                        {/* Expanded Details */}
                        {expandedStudent === student.id && (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 bg-gray-50 dark:bg-gray-700">
                              {/* Student Class Information */}
                              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                                  Class Enrollments
                                </h4>
                                {(student.enrolledClasses || []).length === 0 ? (
                                  <p className="text-sm text-blue-700 dark:text-blue-400">
                                    Student is not enrolled in any classes.
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {student.enrolledClasses?.map((cls) => (
                                      <div key={cls.classId} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border">
                                        <div>
                                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {cls.className}
                                          </p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {cls.subject}
                                          </p>
                                        </div>
                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                          cls.status === 'Active'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                        }`}>
                                          {cls.status}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              {/* Document Details */}
                              <div className="space-y-4">
                                {[
                                  { type: DocumentType.CLASS_POLICY, doc: policyDoc },
                                  { type: DocumentType.PARENT_NOTICE, doc: noticeDoc },
                                  { type: DocumentType.PHOTO_CONSENT, doc: consentDoc }
                                ].map(({ type, doc }) => (
                                  <div key={type} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">{type}</h4>
                                    
                                    {!doc ? (
                                      <div className="text-sm text-gray-500 dark:text-gray-400">
                                        Not submitted yet.
                                      </div>
                                    ) : (
                                      <div className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Submitted:</p>
                                            <p className="text-sm text-gray-900 dark:text-white">
                                              {doc.submittedAt 
                                                ? new Date(doc.submittedAt).toLocaleString() 
                                                : 'Unknown date'}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Status:</p>
                                            {getStatusBadge(doc.status)}
                                          </div>
                                        </div>
                                        
                                        <div className="flex space-x-3">
                                          <a 
                                            href={doc.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors duration-200"
                                          >
                                            <Eye className="w-4 h-4 mr-2" />
                                            View
                                          </a>
                                          
                                          <a 
                                            href={doc.url} 
                                            download
                                            className="inline-flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors duration-200"
                                          >
                                            <Download className="w-4 h-4 mr-2" />
                                            Download
                                          </a>
                                        </div>
                                        
                                        {/* Verification Actions */}
                                        {doc.status === 'Pending' && (
                                          <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Verification:</p>
                                            
                                            <div className="space-y-3">
                                              <textarea
                                                className="w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                                                placeholder="Add verification notes (optional)"
                                                rows={2}
                                                value={verificationNote}
                                                onChange={(e) => setVerificationNote(e.target.value)}
                                              />
                                              
                                              <div className="flex space-x-2">
                                                <Button
                                                  type="button"
                                                  onClick={() => handleVerifyDocument(student.id, type, 'Verified')}
                                                  disabled={verifyingDocument === `${student.id}-${type}`}
                                                  className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded flex items-center"
                                                >
                                                  <CheckCircle className="w-3 h-3 mr-1" />
                                                  {verifyingDocument === `${student.id}-${type}` ? 'Processing...' : 'Approve'}
                                                </Button>
                                                
                                                <Button
                                                  type="button"
                                                  onClick={() => handleVerifyDocument(student.id, type, 'Rejected')}
                                                  disabled={verifyingDocument === `${student.id}-${type}`}
                                                  className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded flex items-center"
                                                >
                                                  <XCircle className="w-3 h-3 mr-1" />
                                                  {verifyingDocument === `${student.id}-${type}` ? 'Processing...' : 'Reject'}
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Email Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Notify Students About Missing Documents
                </h3>
                <Button
                  onClick={() => {
                    setShowReminderModal(false);
                    setReminderPreview(null);
                    setReminderResults(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </Button>
              </div>
            </div>
            
            <div className="p-6">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-t-4 border-blue-600 border-solid rounded-full animate-spin mr-3"></div>
                  <p className="text-gray-600 dark:text-gray-300">Loading preview...</p>
                </div>
              ) : reminderPreview ? (
                <div>
                  {/* Preview Statistics */}
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 mb-6">
                    <h4 className="text-md font-semibold text-blue-900 dark:text-blue-100 mb-3">
                      📊 Reminder Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-300">Total Students:</span>
                        <span className="font-semibold ml-2 text-gray-900 dark:text-white">
                          {reminderPreview.stats.total}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-300">Total Emails to Send:</span>
                        <span className="font-semibold ml-2 text-blue-600 dark:text-blue-400">
                          {reminderPreview.stats.totalEmailsToSend}
                        </span>
                        <span className="text-sm text-gray-500 ml-2">({reminderPreview.stats.total} students + {reminderPreview.stats.total} parents)</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-300">Avg. Missing Docs:</span>
                        <span className="font-semibold ml-2 text-gray-900 dark:text-white">
                          {reminderPreview.stats.averageMissingDocs}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Preview List */}
                  {reminderPreview.preview.length > 0 ? (
                    <div className="mb-6">
                      <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                        👥 Students Who Will Receive Notifications ({reminderPreview.stats.total} students)
                      </h4>
                      <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                        {reminderPreview.preview.map((student: any) => (
                            <div key={student.id} className="p-3 border-b border-gray-200 dark:border-gray-600 last:border-b-0">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">{student.name}</p>
                                  <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Parent: {student.parentName} ({student.parentEmail})
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                                    {student.missingDocumentsCount} missing
                                  </span>
                                </div>
                              </div>
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Missing: {student.missingDocumentTypes.join(', ')}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600 dark:text-gray-300">
                        🎉 All students have submitted their required documents!
                      </p>
                    </div>
                  )}

                  {/* Action Button */}
                  {reminderPreview.stats.total > 0 && (
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Emails will be sent to both students and parents ({reminderPreview.stats.totalEmailsToSend} total emails)
                      </div>
                      <Button
                        onClick={() => sendDocumentReminders(reminderPreview.type, false)}
                        disabled={sendingReminders}
                      >
                        {sendingReminders ? 'Sending...' : 'Notify'}
                      </Button>
                    </div>
                  )}

                  {/* Results Display */}
                  {reminderResults && (
                    <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                      <h4 className="text-md font-semibold text-green-900 dark:text-green-100 mb-2">
                        ✅ Notifications Sent Successfully!
                      </h4>
                      <p className="text-sm text-green-800 dark:text-green-200">
                        {reminderResults.message}
                      </p>
                      <div className="mt-2 text-xs text-green-700 dark:text-green-300">
                        Success: {reminderResults.summary.successful} | 
                        Failed: {reminderResults.summary.failed}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-300">No preview data available.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
