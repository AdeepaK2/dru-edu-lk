'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserPlus, 
  Users, 
  Search, 
  Edit2, 
  Trash2, 
  XCircle, 
  UserCheck, 
  SortAsc,
  Eye,
  CheckCircle,
  Clock,
  Mail,
  Phone,
  Calendar,
  School,
  BookOpen
} from 'lucide-react';
import { Student, StudentDocument } from '@/models/studentSchema';
import { EnrollmentRequestDocument, convertEnrollmentRequestDocument } from '@/models/enrollmentRequestSchema';
import { createStudentEnrollment } from '@/services/studentEnrollmentService';
import { firestore } from '@/utils/firebase-client';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  where,
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/form/Input';
import Select from '@/components/ui/form/Select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StudentModal from '@/components/modals/StudentModal';
import AssignStudentToClassModal from '@/components/modals/AssignStudentToClassModal';
import { useCachedData } from '@/hooks/useAdminCache';

export default function StudentsManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentDocument | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentDocument | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningStudent, setAssigningStudent] = useState<StudentDocument | null>(null);
  
  // Enrollment request states
  const [showEnrollmentTab, setShowEnrollmentTab] = useState(false);
  const [enrollmentRequests, setEnrollmentRequests] = useState<EnrollmentRequestDocument[]>([]);
  const [selectedStudentRequests, setSelectedStudentRequests] = useState<EnrollmentRequestDocument[]>([]);
  const [showEnrollmentDetailModal, setShowEnrollmentDetailModal] = useState(false);
  const [processingEnrollment, setProcessingEnrollment] = useState<string | null>(null);
  
  // Use real-time data for immediate updates
  const [students, setStudents] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Set up real-time listener for students
  React.useEffect(() => {
    const studentsQuery = query(
      collection(firestore, 'students'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      studentsQuery,
      (snapshot) => {
        const studentsData: StudentDocument[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          studentsData.push({
            id: doc.id,
            ...data,
          } as StudentDocument);
        });
        setStudents(studentsData);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Error fetching students:', error);
        setError(error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);
  
  // Set up real-time listener for enrollment requests
  useEffect(() => {
    const enrollmentQuery = query(
      collection(firestore, 'enrollmentRequests'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      enrollmentQuery,
      (snapshot) => {
        const enrollmentData: EnrollmentRequestDocument[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          enrollmentData.push({
            id: doc.id,
            ...data,
          } as EnrollmentRequestDocument);
        });
        setEnrollmentRequests(enrollmentData);
        
        // Update selected student requests if modal is open
        if (showEnrollmentDetailModal && selectedStudentRequests.length > 0) {
          const currentStudentEmail = selectedStudentRequests[0].student.email;
          const updatedStudentRequests = enrollmentData.filter(
            request => request.student.email === currentStudentEmail
          );
          setSelectedStudentRequests(updatedStudentRequests);
        }
      },
      (error) => {
        console.error('Error fetching enrollment requests:', error);
      }
    );

    return () => unsubscribe();
  }, [showEnrollmentDetailModal, selectedStudentRequests]);
  
  // Use alert for now - can be replaced with a proper toast system later
  const showSuccess = (message: string) => {
    console.log('Success:', message);
    alert(`✅ Success: ${message}`);
  };
  const showError = (message: string) => {
    console.error('Error:', message);
    alert(`❌ Error: ${message}`);
  };

  // Group enrollment requests by student email
  const groupedEnrollmentRequests = useMemo(() => {
    const grouped: Record<string, EnrollmentRequestDocument[]> = {};
    
    enrollmentRequests.forEach(request => {
      const email = request.student.email;
      if (!grouped[email]) {
        grouped[email] = [];
      }
      grouped[email].push(request);
    });
    
    return Object.entries(grouped).map(([email, requests]) => ({
      studentEmail: email,
      studentName: requests[0].student.name,
      requests: requests,
      totalClasses: requests.length,
      pendingCount: requests.filter(r => r.status === 'Pending').length,
      approvedCount: requests.filter(r => r.status === 'Approved').length,
      rejectedCount: requests.filter(r => r.status === 'Rejected').length,
      latestRequestDate: Math.max(...requests.map(r => r.createdAt?.toMillis() || 0))
    })).sort((a, b) => b.latestRequestDate - a.latestRequestDate);
  }, [enrollmentRequests]);

  // Student create handler
  const handleStudentCreate = async (studentData: Omit<Student, 'id'>) => {
    setActionLoading('create');
    
    try {
      const response = await fetch('/api/student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...studentData,
          status: 'Active',
          coursesEnrolled: 0,
          payment: {
            status: 'Pending',
            method: '',
            lastPayment: 'N/A'
          }
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || errorData.error || 'Failed to create student';
        throw new Error(errorMessage);
      }

      const savedStudent = await response.json();
      showSuccess('Student created successfully!');
      setShowAddModal(false);
      // Real-time listener will automatically update the list
    } catch (error) {
      console.error('Error creating student:', error);
      showError(error instanceof Error ? error.message : 'Failed to create student');
    } finally {
      setActionLoading(null);
    }
  };

  // Student update handler
  const handleStudentUpdate = async (studentData: Omit<Student, 'id'>) => {
    if (!editingStudent) return;
    
    setActionLoading('update');
    
    try {
      const response = await fetch('/api/student', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingStudent.id,
          ...studentData,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update student');
      }

      showSuccess('Student updated successfully!');
      setShowEditModal(false);
      setEditingStudent(null);
      // Real-time listener will automatically update the list
    } catch (error) {
      console.error('Error updating student:', error);
      showError(error instanceof Error ? error.message : 'Failed to update student');
    } finally {
      setActionLoading(null);
    }
  };

  // Student delete handler
  const handleStudentDelete = async () => {
    if (!studentToDelete) return;
    
    setActionLoading('delete');
    
    try {
      const response = await fetch(`/api/student?id=${studentToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete student');
      }

      showSuccess('Student deleted successfully!');
      setShowDeleteConfirm(false);
      setStudentToDelete(null);
      // Real-time listener will automatically update the list
    } catch (error) {
      console.error('Error deleting student:', error);
      showError(error instanceof Error ? error.message : 'Failed to delete student');
    } finally {
      setActionLoading(null);
    }
  };
  // Filter and sort students based on search term
  const filteredStudents = useMemo(() => {
    if (!students) return [];
    
    let filtered = students.filter(student => {
      const matchesSearch = 
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.phone.includes(searchTerm) ||
        student.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });

    // Sort students
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'enrollmentDate':
          comparison = new Date(a.enrollmentDate).getTime() - new Date(b.enrollmentDate).getTime();
          break;
        case 'coursesEnrolled':
          comparison = a.coursesEnrolled - b.coursesEnrolled;
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [students, searchTerm, sortBy, sortOrder]);

  // Handle edit button click
  const handleEditClick = (student: StudentDocument) => {
    setEditingStudent(student);
    setShowEditModal(true);
  };

  // Handle delete button click
  const handleDeleteClick = (student: StudentDocument) => {
    setStudentToDelete(student);
    setShowDeleteConfirm(true);
  };

  const handleAssignClick = (student: StudentDocument) => {
    setAssigningStudent(student);
    setShowAssignModal(true);
  };

  // Handle viewing student enrollment requests
  const handleViewStudentRequests = (studentRequests: EnrollmentRequestDocument[]) => {
    setSelectedStudentRequests(studentRequests);
    setShowEnrollmentDetailModal(true);
  };

  // Function to refresh modal data after actions
  const refreshModalData = (studentEmail: string) => {
    const updatedRequests = enrollmentRequests.filter(
      request => request.student.email === studentEmail
    );
    setSelectedStudentRequests(updatedRequests);
  };

  // Handle batch approval of all pending requests for a student
  const handleBatchApproveStudent = async (studentRequests: EnrollmentRequestDocument[]) => {
    const pendingRequests = studentRequests.filter(r => r.status === 'Pending');
    if (pendingRequests.length === 0) {
      showError('No pending requests to approve for this student');
      return;
    }

    setProcessingEnrollment(pendingRequests[0].student.email);
    
    try {
      // Check if student already exists (same logic as single approval)
      const studentsQuery = query(
        collection(firestore, 'students'),
        where('email', '==', pendingRequests[0].student.email)
      );
      const existingStudentSnapshot = await getDocs(studentsQuery);
      
      let studentId: string;
      
      if (!existingStudentSnapshot.empty) {
        // Student exists
        const existingStudent = existingStudentSnapshot.docs[0];
        studentId = existingStudent.id;
        const studentData = existingStudent.data() as StudentDocument;
        
        console.log('Batch approval - student already exists:', studentData.name, studentData.email);
        showSuccess(`All ${pendingRequests.length} pending enrollments approved for existing student ${studentData.name}`);
      } else {
        // Create new student
        console.log('Creating new student via API for batch approval...');
        const firstRequest = pendingRequests[0];
        const newStudent: Omit<Student, 'id'> = {
          name: firstRequest.student.name,
          email: firstRequest.student.email,
          phone: firstRequest.student.phone,
          status: 'Active',
          enrollmentDate: new Date().toISOString().split('T')[0],
          coursesEnrolled: 0, // Will be calculated based on actual enrollments
          avatar: firstRequest.student.name.substring(0, 2).toUpperCase(),
          parent: {
            name: firstRequest.parent.name,
            email: firstRequest.parent.email,
            phone: firstRequest.parent.phone,
          },
          payment: {
            status: 'Pending',
            method: '',
            lastPayment: 'N/A'
          },
        };

        console.log('Calling API with student data:', newStudent);
        
        const response = await fetch('/api/student', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newStudent),
        });
        
        console.log('API response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('API error:', errorData);
          throw new Error(errorData.error || 'Failed to create student');
        }

        const createdStudent = await response.json();
        console.log('Created student:', createdStudent);
        studentId = createdStudent.id;
        
        showSuccess(`New student account created for ${newStudent.name} with ${pendingRequests.length} classes enrolled and welcome email sent`);
      }
      
      // Create enrollment records for each approved request
      const enrollmentPromises = pendingRequests.map(async (request) => {
        try {
          await createStudentEnrollment({
            studentId: studentId,
            classId: request.classId,
            studentName: request.student.name,
            studentEmail: request.student.email,
            className: request.className,
            subject: request.subject,
            enrolledAt: new Date(),
            status: 'Active',
            attendance: 0,
            notes: request.additionalNotes || undefined,
          });
        } catch (enrollmentError) {
          console.error(`Error creating enrollment for class ${request.className}:`, enrollmentError);
          // Continue with other enrollments even if one fails
        }
      });
      
      await Promise.all(enrollmentPromises);
      
      // Update the student's course count based on actual enrollments
      const enrollmentsQuery = query(
        collection(firestore, 'studentEnrollments'),
        where('studentId', '==', studentId),
        where('status', '==', 'Active')
      );
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      const activeEnrollmentsCount = enrollmentsSnapshot.size;
      
      // Update student's course count
      await updateDoc(doc(firestore, 'students', studentId), {
        coursesEnrolled: activeEnrollmentsCount,
        updatedAt: Timestamp.now(),
      });
      
      // Update all pending enrollment requests
      const updatePromises = pendingRequests.map(request =>
        updateDoc(doc(firestore, 'enrollmentRequests', request.id), {
          status: 'Approved',
          processedAt: Timestamp.now(),
          studentId: studentId,
          updatedAt: Timestamp.now(),
        })
      );
      
      await Promise.all(updatePromises);
      
      // Refresh modal data if it's open for this student
      if (showEnrollmentDetailModal && selectedStudentRequests.length > 0 && 
          selectedStudentRequests[0].student.email === pendingRequests[0].student.email) {
        refreshModalData(pendingRequests[0].student.email);
      }
      
    } catch (error) {
      console.error('Error batch approving enrollments:', error);
      showError('Failed to batch approve enrollment requests');
    } finally {
      setProcessingEnrollment(null);
    }
  };

  // Handle batch rejection of all pending requests for a student
  const handleBatchRejectStudent = async (studentRequests: EnrollmentRequestDocument[], reason?: string) => {
    const pendingRequests = studentRequests.filter(r => r.status === 'Pending');
    if (pendingRequests.length === 0) {
      showError('No pending requests to reject for this student');
      return;
    }

    setProcessingEnrollment(pendingRequests[0].student.email);
    
    try {
      const updatePromises = pendingRequests.map(request =>
        updateDoc(doc(firestore, 'enrollmentRequests', request.id), {
          status: 'Rejected',
          processedAt: Timestamp.now(),
          adminNotes: reason || 'Batch rejection',
          updatedAt: Timestamp.now(),
        })
      );
      
      await Promise.all(updatePromises);
      showSuccess(`All ${pendingRequests.length} pending enrollment requests rejected`);
      
      // Refresh modal data if it's open for this student
      if (showEnrollmentDetailModal && selectedStudentRequests.length > 0 && 
          selectedStudentRequests[0].student.email === pendingRequests[0].student.email) {
        refreshModalData(pendingRequests[0].student.email);
      }
    } catch (error) {
      console.error('Error batch rejecting enrollments:', error);
      showError('Failed to batch reject enrollment requests');
    } finally {
      setProcessingEnrollment(null);
    }
  };

  // Handle enrollment request approval
  const handleApproveEnrollment = async (enrollmentRequest: EnrollmentRequestDocument) => {
    setProcessingEnrollment(enrollmentRequest.id);
    
    try {
      // First, check if a student with this email already exists
      const studentsQuery = query(
        collection(firestore, 'students'),
        where('email', '==', enrollmentRequest.student.email)
      );
      const existingStudentSnapshot = await getDocs(studentsQuery);
      
      let studentId: string;
      let isNewStudent = false;
      
      if (!existingStudentSnapshot.empty) {
        // Student already exists
        const existingStudent = existingStudentSnapshot.docs[0];
        studentId = existingStudent.id;
        const studentData = existingStudent.data() as StudentDocument;
        
        console.log('Individual approval - student already exists:', studentData.name, studentData.email);
        showSuccess(`Enrollment approved! Added to existing student record for ${studentData.name}`);
      } else {
        // Student doesn't exist - create new student via API
        console.log('Creating new student via API for individual approval...');
        isNewStudent = true;
        const newStudent: Omit<Student, 'id'> = {
          name: enrollmentRequest.student.name,
          email: enrollmentRequest.student.email,
          phone: enrollmentRequest.student.phone,
          status: 'Active',
          enrollmentDate: new Date().toISOString().split('T')[0],
          coursesEnrolled: 0, // Will be calculated based on actual enrollments
          avatar: enrollmentRequest.student.name.substring(0, 2).toUpperCase(),
          parent: {
            name: enrollmentRequest.parent.name,
            email: enrollmentRequest.parent.email,
            phone: enrollmentRequest.parent.phone,
          },
          payment: {
            status: 'Pending',
            method: '',
            lastPayment: 'N/A'
          },
        };

        console.log('Individual approval - calling API with student data:', newStudent);

        // Use the API to create student (this handles auth creation and email sending)
        const response = await fetch('/api/student', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newStudent),
        });
        
        console.log('Individual approval - API response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Individual approval - API error:', errorData);
          throw new Error(errorData.error || 'Failed to create student');
        }

        const createdStudent = await response.json();
        console.log('Individual approval - created student:', createdStudent);
        studentId = createdStudent.id;
        
        showSuccess(`Enrollment approved! New student account created for ${newStudent.name} and welcome email sent`);
      }
      
      // Create the actual enrollment record
      try {
        await createStudentEnrollment({
          studentId: studentId,
          classId: enrollmentRequest.classId,
          studentName: enrollmentRequest.student.name,
          studentEmail: enrollmentRequest.student.email,
          className: enrollmentRequest.className,
          subject: enrollmentRequest.subject,
          enrolledAt: new Date(),
          status: 'Active',
          attendance: 0,
          notes: enrollmentRequest.additionalNotes || undefined,
        });
        
        // Update the student's course count based on actual enrollments
        const enrollmentsQuery = query(
          collection(firestore, 'studentEnrollments'),
          where('studentId', '==', studentId),
          where('status', '==', 'Active')
        );
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        const activeEnrollmentsCount = enrollmentsSnapshot.size;
        
        // Update student's course count
        await updateDoc(doc(firestore, 'students', studentId), {
          coursesEnrolled: activeEnrollmentsCount,
          updatedAt: Timestamp.now(),
        });
        
      } catch (enrollmentError) {
        console.error('Error creating enrollment:', enrollmentError);
        // If enrollment creation fails but student was created, we should still mark as approved
        // but show a warning
        showError('Student created but failed to create enrollment record. Please manually enroll the student.');
      }
      
      // Update enrollment request status
      await updateDoc(doc(firestore, 'enrollmentRequests', enrollmentRequest.id), {
        status: 'Approved',
        processedAt: Timestamp.now(),
        studentId: studentId,
        updatedAt: Timestamp.now(),
      });
      
      // Refresh the modal data to update the UI
      refreshModalData(enrollmentRequest.student.email);
      
    } catch (error) {
      console.error('Error approving enrollment:', error);
      showError('Failed to approve enrollment request');
    } finally {
      setProcessingEnrollment(null);
    }
  };

  // Handle enrollment request rejection
  const handleRejectEnrollment = async (enrollmentRequest: EnrollmentRequestDocument, reason?: string) => {
    setProcessingEnrollment(enrollmentRequest.id);
    
    try {
      await updateDoc(doc(firestore, 'enrollmentRequests', enrollmentRequest.id), {
        status: 'Rejected',
        processedAt: Timestamp.now(),
        adminNotes: reason || 'Request rejected',
        updatedAt: Timestamp.now(),
      });
      
      // Refresh the modal data to update the UI
      refreshModalData(enrollmentRequest.student.email);
      
      showSuccess('Enrollment request rejected');
    } catch (error) {
      console.error('Error rejecting enrollment:', error);
      showError('Failed to reject enrollment request');
    } finally {
      setProcessingEnrollment(null);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return <Badge variant="warning" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'Approved':
        return <Badge variant="success" className="bg-green-100 text-green-800">Approved</Badge>;
      case 'Rejected':
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-primary-600 border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-secondary-600 dark:text-secondary-300 font-medium">Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Students Management
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Manage student records, enrollments, and information
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {filteredStudents.length !== students?.length 
                  ? `${filteredStudents.length} of ${students?.length || 0}` 
                  : `Total: ${students?.length || 0}`
                }
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowEnrollmentTab(false)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              !showEnrollmentTab
                ? 'border-[#0088e0] text-[#0088e0] bg-blue-50 dark:bg-blue-900/20'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Users className="w-4 h-4 mr-2 inline" />
            Students ({students?.length || 0})
          </button>
          <button
            onClick={() => setShowEnrollmentTab(true)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              showEnrollmentTab
                ? 'border-[#0088e0] text-[#0088e0] bg-blue-50 dark:bg-blue-900/20'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Clock className="w-4 h-4 mr-2 inline" />
            Enrollment Requests ({enrollmentRequests.filter(r => r.status === 'Pending').length})
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      {!showEnrollmentTab ? (
        <>
          {/* Quick Stats */}
          {students && students.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Students</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{students.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <UserCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Students</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {students.filter(s => s.status === 'Active').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <XCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Payments</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {students.filter(s => s.payment?.status === 'Pending').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Courses</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {students.length > 0 ? Math.round(students.reduce((acc, s) => acc + s.coursesEnrolled, 0) / students.length * 10) / 10 : 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Sorting */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center space-x-2">
              <SortAsc className="w-4 h-4 text-gray-500" />
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-36"
                options={[
                  { value: 'name', label: 'Name' },
                  { value: 'email', label: 'Email' },
                  { value: 'enrollmentDate', label: 'Enrollment Date' },
                  { value: 'coursesEnrolled', label: 'Courses' }
                ]}
              />
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-2"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
          </div>
          
          {/* Add Button */}
          <Button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </Button>
        </div>
        
        {/* Search Summary */}
        {searchTerm && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
              Search: "{searchTerm}"
              <button
                onClick={() => setSearchTerm('')}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                <XCircle className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Students Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Enrollment
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center">
                    <div className="text-center">
                      <Users className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No students found</h3>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding a new student'}
                      </p>
                      {!searchTerm && (
                        <Button
                          onClick={() => setShowAddModal(true)}
                          className="mt-4 flex items-center space-x-2 mx-auto"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>Add Your First Student</span>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {student.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            ID: {student.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{student.email}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{student.phone}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">Courses: {student.coursesEnrolled}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Since: {student.enrollmentDate}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignClick(student)}
                          disabled={actionLoading !== null}
                          className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                          title="Assign to Class"
                        >
                          <UserCheck className="w-4 h-4 mr-1" />
                          Assign
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(student)}
                          disabled={actionLoading !== null}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(student)}
                          disabled={actionLoading !== null}
                          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : (
        /* Enrollment Requests Tab */
        <div className="space-y-6">
          {/* Enrollment Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {enrollmentRequests.filter(r => r.status === 'Pending').length}
                </div>
                <div className="text-sm text-gray-600">Pending Requests</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {enrollmentRequests.filter(r => r.status === 'Approved').length}
                </div>
                <div className="text-sm text-gray-600">Approved</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {enrollmentRequests.filter(r => r.status === 'Rejected').length}
                </div>
                <div className="text-sm text-gray-600">Rejected</div>
              </CardContent>
            </Card>
          </div>

          {/* Enrollment Requests List */}
          {enrollmentRequests.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  No enrollment requests yet
                </h3>
                <p className="text-gray-500">
                  Enrollment requests will appear here when students apply.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {groupedEnrollmentRequests.map((studentGroup) => (
                <Card key={studentGroup.studentEmail} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {studentGroup.studentName}
                        </h3>
                        <p className="text-gray-600">{studentGroup.studentEmail}</p>
                        <p className="text-sm text-gray-500">
                          {studentGroup.totalClasses} class{studentGroup.totalClasses !== 1 ? 'es' : ''} requested
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-2">
                          {studentGroup.pendingCount > 0 && (
                            <Badge variant="warning" className="bg-yellow-100 text-yellow-800">
                              {studentGroup.pendingCount} Pending
                            </Badge>
                          )}
                          {studentGroup.approvedCount > 0 && (
                            <Badge variant="success" className="bg-green-100 text-green-800">
                              {studentGroup.approvedCount} Approved
                            </Badge>
                          )}
                          {studentGroup.rejectedCount > 0 && (
                            <Badge variant="destructive" className="bg-red-100 text-red-800">
                              {studentGroup.rejectedCount} Rejected
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatDate(new Date(studentGroup.latestRequestDate))}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="w-4 h-4 mr-2" />
                        {studentGroup.requests[0].student.email}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="w-4 h-4 mr-2" />
                        {studentGroup.requests[0].student.phone}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <School className="w-4 h-4 mr-2" />
                        {studentGroup.requests[0].student.year} - {studentGroup.requests[0].student.school}
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">
                        <strong>Parent:</strong> {studentGroup.requests[0].parent.name} ({studentGroup.requests[0].parent.relationship})
                        <br />
                        <strong>Contact:</strong> {studentGroup.requests[0].parent.email} | {studentGroup.requests[0].parent.phone}
                      </p>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        <strong>Classes:</strong> {studentGroup.requests.map(r => r.className).join(', ')}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewStudentRequests(studentGroup.requests)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View All Classes
                        </Button>
                        
                        {studentGroup.pendingCount > 0 && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleBatchApproveStudent(studentGroup.requests)}
                              disabled={processingEnrollment === studentGroup.studentEmail}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              {processingEnrollment === studentGroup.studentEmail ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Approve All ({studentGroup.pendingCount})
                                </>
                              )}
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleBatchRejectStudent(studentGroup.requests)}
                              disabled={processingEnrollment === studentGroup.studentEmail}
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject All ({studentGroup.pendingCount})
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Student Enrollment Requests Detail Modal */}
      {showEnrollmentDetailModal && selectedStudentRequests.length > 0 && (
        <Modal
          title={`Enrollment Requests - ${selectedStudentRequests[0].student.name}`}
          isOpen={showEnrollmentDetailModal}
          onClose={() => setShowEnrollmentDetailModal(false)}
        >
          <div className="space-y-6">
            {/* Student Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Student Information</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <p><strong>Name:</strong> {selectedStudentRequests[0].student.name}</p>
                <p><strong>Email:</strong> {selectedStudentRequests[0].student.email}</p>
                <p><strong>Phone:</strong> {selectedStudentRequests[0].student.phone}</p>
                <p><strong>Year:</strong> {selectedStudentRequests[0].student.year}</p>
                <p><strong>School:</strong> {selectedStudentRequests[0].student.school}</p>
                <p><strong>Date of Birth:</strong> {selectedStudentRequests[0].student.dateOfBirth}</p>
              </div>
            </div>
            
            {/* Parent Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Parent/Guardian Information</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <p><strong>Name:</strong> {selectedStudentRequests[0].parent.name}</p>
                <p><strong>Email:</strong> {selectedStudentRequests[0].parent.email}</p>
                <p><strong>Phone:</strong> {selectedStudentRequests[0].parent.phone}</p>
                <p><strong>Relationship:</strong> {selectedStudentRequests[0].parent.relationship}</p>
              </div>
            </div>
            
            {/* Class Requests */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Class Enrollment Requests</h3>
              <div className="space-y-4">
                {selectedStudentRequests.map((request, index) => (
                  <div key={request.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {request.className} - {request.subject}
                        </h4>
                        <p className="text-sm text-gray-600">{request.centerName}</p>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <p><strong>Monthly Fee:</strong> ${request.monthlyFee}</p>
                      <p><strong>Preferred Start:</strong> {formatDate(request.preferredStartDate)}</p>
                      <p><strong>Submitted:</strong> {formatDate(request.createdAt)}</p>
                      {request.processedAt && (
                        <p><strong>Processed:</strong> {formatDate(request.processedAt)}</p>
                      )}
                    </div>
                    
                    {request.additionalNotes && (
                      <div className="mt-3">
                        <p className="text-sm"><strong>Notes:</strong></p>
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded mt-1">
                          {request.additionalNotes}
                        </p>
                      </div>
                    )}
                    
                    {request.adminNotes && (
                      <div className="mt-3">
                        <p className="text-sm"><strong>Admin Notes:</strong></p>
                        <p className="text-sm text-gray-600 bg-yellow-50 p-2 rounded mt-1">
                          {request.adminNotes}
                        </p>
                      </div>
                    )}
                    
                    {/* Individual class actions */}
                    {request.status === 'Pending' && (
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button
                          size="sm"
                          onClick={() => handleApproveEnrollment(request)}
                          disabled={processingEnrollment === request.id}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve This Class
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRejectEnrollment(request)}
                          disabled={processingEnrollment === request.id}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject This Class
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Batch Actions */}
            {selectedStudentRequests.some(r => r.status === 'Pending') && (
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-gray-600">
                  {selectedStudentRequests.filter(r => r.status === 'Pending').length} pending request(s)
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleBatchApproveStudent(selectedStudentRequests)}
                    disabled={processingEnrollment === selectedStudentRequests[0].student.email}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve All Pending
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => handleBatchRejectStudent(selectedStudentRequests)}
                    disabled={processingEnrollment === selectedStudentRequests[0].student.email}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject All Pending
                  </Button>
                </div>
              </div>
            )}
            
            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowEnrollmentDetailModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <StudentModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleStudentCreate}
          loading={actionLoading === 'create'}
          title="Add New Student"
        />
      )}

      {/* Edit Student Modal */}
      {showEditModal && editingStudent && (
        <StudentModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingStudent(null);
          }}
          onSubmit={handleStudentUpdate}
          loading={actionLoading === 'update'}
          title="Edit Student"
          initialData={editingStudent}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && studentToDelete && (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setStudentToDelete(null);
          }}
          onConfirm={handleStudentDelete}
          isLoading={actionLoading === 'delete'}
          title="Delete Student"
          description={`Are you sure you want to delete ${studentToDelete.name}? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      )}

      {/* Assign Student to Class Modal */}
      {showAssignModal && assigningStudent && (
        <AssignStudentToClassModal
          isOpen={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setAssigningStudent(null);
          }}
          student={assigningStudent}
          onSuccess={showSuccess}
          onError={showError}
        />
      )}
    </div>
  );
}
