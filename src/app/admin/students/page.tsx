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
  BookOpen,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { Student, StudentDocument } from '@/models/studentSchema';
import { EnrollmentRequestDocument, convertEnrollmentRequestDocument } from '@/models/enrollmentRequestSchema';
import { createStudentEnrollment, getEnrollmentsByStudent } from '@/services/studentEnrollmentService';
import { StudentEnrollment } from '@/models/studentEnrollmentSchema';
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
  getDoc,
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
import * as XLSX from 'xlsx';
import { ClassDocument } from '@/models/classSchema';
import { StudentEnrollmentDocument } from '@/models/studentEnrollmentSchema';

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
  const [showDataExportTab, setShowDataExportTab] = useState(false);
  const [enrollmentRequests, setEnrollmentRequests] = useState<EnrollmentRequestDocument[]>([]);
  const [selectedStudentRequests, setSelectedStudentRequests] = useState<EnrollmentRequestDocument[]>([]);
  const [showEnrollmentDetailModal, setShowEnrollmentDetailModal] = useState(false);
  const [processingEnrollment, setProcessingEnrollment] = useState<string | null>(null);
  const [showApprovedRequests, setShowApprovedRequests] = useState(false);
  const [showRejectedRequests, setShowRejectedRequests] = useState(false);

  // Utility function to safely parse JSON responses
  const safeJsonParse = async (response: Response) => {
    try {
      return await response.json();
    } catch (jsonError) {
      console.warn('Response parsing warning (non-critical):', jsonError);
      return null;
    }
  };

  // Utility function to handle API error responses
  const handleApiError = async (response: Response, defaultMessage: string) => {
    let errorMessage = defaultMessage;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || defaultMessage;
    } catch (jsonError) {
      console.error('Failed to parse error response:', jsonError);
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    return errorMessage;
  };

  // Data export states
  const [availableClasses, setAvailableClasses] = useState<ClassDocument[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [classStudentData, setClassStudentData] = useState<Record<string, StudentEnrollmentDocument[]>>({});
  
  // Use real-time data for immediate updates
  const [students, setStudents] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [studentEnrollmentCounts, setStudentEnrollmentCounts] = useState<Record<string, number>>({});
  const [studentEnrollmentDetails, setStudentEnrollmentDetails] = useState<Record<string, Array<{className: string, subject: string}>>>({});

  // Function to load real enrollment counts and details for all students
  const loadEnrollmentCounts = async (studentIds: string[]) => {
    try {
      const counts: Record<string, number> = {};
      const details: Record<string, Array<{className: string, subject: string}>> = {};
      
      // Load enrollment counts and details for each student
      await Promise.all(
        studentIds.map(async (studentId) => {
          try {
            const enrollments = await getEnrollmentsByStudent(studentId);
            const activeEnrollments = enrollments.filter(e => e.status === 'Active');
            counts[studentId] = activeEnrollments.length;
            
            // Store detailed class information
            details[studentId] = activeEnrollments.map(enrollment => ({
              className: enrollment.className,
              subject: enrollment.subject
            }));
          } catch (error) {
            console.error(`Error loading enrollments for student ${studentId}:`, error);
            counts[studentId] = 0;
            details[studentId] = [];
          }
        })
      );
      
      setStudentEnrollmentCounts(counts);
      setStudentEnrollmentDetails(details);
    } catch (error) {
      console.error('Error loading enrollment counts:', error);
    }
  };

  // Function to load student enrollment data for selected classes
  const loadStudentDataForClasses = async (classIds: string[]) => {
    try {
      const classStudentMap: Record<string, StudentEnrollmentDocument[]> = {};
      
      await Promise.all(
        classIds.map(async (classId) => {
          try {
            const enrollmentQuery = query(
              collection(firestore, 'studentEnrollments'),
              where('classId', '==', classId),
              where('status', '==', 'Active')
            );
            const snapshot = await getDocs(enrollmentQuery);
            const enrollments = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as StudentEnrollmentDocument[];
            
            classStudentMap[classId] = enrollments;
          } catch (error) {
            console.error(`Error loading students for class ${classId}:`, error);
            classStudentMap[classId] = [];
          }
        })
      );
      
      setClassStudentData(classStudentMap);
    } catch (error) {
      console.error('Error loading student data for classes:', error);
    }
  };

  // Function to export student data to Excel
  const exportStudentData = async () => {
    if (selectedClasses.length === 0) {
      alert('Please select at least one class to export');
      return;
    }

    setExportLoading(true);
    try {
      // Load student data for selected classes
      const classStudentMap: Record<string, StudentEnrollmentDocument[]> = {};
      const studentDetailsMap: Record<string, StudentDocument> = {};
      
      await Promise.all(
        selectedClasses.map(async (classId) => {
          try {
            const enrollmentQuery = query(
              collection(firestore, 'studentEnrollments'),
              where('classId', '==', classId),
              where('status', '==', 'Active')
            );
            const snapshot = await getDocs(enrollmentQuery);
            const enrollments = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as StudentEnrollmentDocument[];
            
            classStudentMap[classId] = enrollments;
            
            // Load detailed student information including parent details
            const studentIds = enrollments.map(e => e.studentId);
            await Promise.all(
              studentIds.map(async (studentId) => {
                if (!studentDetailsMap[studentId]) {
                  try {
                    const studentDocRef = doc(firestore, 'students', studentId);
                    const studentSnapshot = await getDoc(studentDocRef);
                    
                    if (studentSnapshot.exists()) {
                      studentDetailsMap[studentId] = {
                        id: studentSnapshot.id,
                        ...studentSnapshot.data()
                      } as StudentDocument;
                    }
                  } catch (error) {
                    console.error(`Error loading student ${studentId}:`, error);
                  }
                }
              })
            );
            
            console.log(`Loaded ${enrollments.length} students for class ${classId}`);
          } catch (error) {
            console.error(`Error loading students for class ${classId}:`, error);
            classStudentMap[classId] = [];
          }
        })
      );
      
      console.log('Class student map:', classStudentMap);
      console.log('Student details map:', studentDetailsMap);
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      let totalStudents = 0;
      
      // Create data for each selected class
      for (const classId of selectedClasses) {
        const classData = availableClasses.find(c => c.id === classId);
        const enrollments = classStudentMap[classId] || [];
        totalStudents += enrollments.length;
        
        if (!classData) {
          console.warn(`Class data not found for classId: ${classId}`);
          continue;
        }
        
        console.log(`Processing class ${classData.name} with ${enrollments.length} students`);
        
        // Prepare data for this class
        const classSheetData = enrollments.length > 0 
          ? enrollments.map((enrollment, index) => {
              const studentDetails = studentDetailsMap[enrollment.studentId];
              return {
                'No.': index + 1,
                'Student Name': enrollment.studentName || 'N/A',
                'Student Email': enrollment.studentEmail || 'N/A',
                'Student Phone': studentDetails?.phone || 'N/A',
                'Parent Name': studentDetails?.parent?.name || 'N/A',
                'Parent Email': studentDetails?.parent?.email || 'N/A',
                'Parent Phone': studentDetails?.parent?.phone || 'N/A',
                'Class Name': enrollment.className || classData.name,
                'Subject': enrollment.subject || classData.subject,
                'Enrollment Date': enrollment.enrolledAt 
                  ? new Date(enrollment.enrolledAt.seconds * 1000).toLocaleDateString() 
                  : 'N/A',
                'Status': enrollment.status || 'Active'
              };
            })
          : [{ 
              'No.': 1,
              'Student Name': 'No students enrolled',
              'Student Email': '-',
              'Student Phone': '-',
              'Parent Name': '-',
              'Parent Email': '-',
              'Parent Phone': '-',
              'Class Name': classData.name,
              'Subject': classData.subject,
              'Enrollment Date': '-',
              'Status': '-'
            }];
        
        // Create worksheet
        const worksheet = XLSX.utils.json_to_sheet(classSheetData);
        
        // Add worksheet to workbook
        const sheetName = `${classData.name} - ${classData.subject}`.substring(0, 31); // Excel sheet name limit
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `student_data_export_${timestamp}.xlsx`;
      
      // Save file
      XLSX.writeFile(workbook, filename);
      
      alert(`Student data exported successfully to ${filename}. Total students: ${totalStudents}`);
      
    } catch (error) {
      console.error('Error exporting student data:', error);
      alert('Failed to export student data. Check console for details.');
    } finally {
      setExportLoading(false);
    }
  };

  // Set up real-time listener for students
  React.useEffect(() => {
    const studentsQuery = query(
      collection(firestore, 'students'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      studentsQuery,
      async (snapshot) => {
        try {
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
          
          // Load real enrollment counts
          if (studentsData.length > 0) {
            const studentIds = studentsData.map(s => s.id);
            loadEnrollmentCounts(studentIds);
          }
        } catch (processingError) {
          console.error('Error processing students snapshot:', processingError);
          setError(processingError as Error);
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error fetching students:', error);
        
        // Handle specific Firebase/network errors
        if (error.code === 'unavailable' || error.message.includes('ERR_CERT_COMMON_NAME_INVALID')) {
          console.warn('Firestore connection issue detected, trying to reconnect...');
          setError(new Error('Connection issue detected. Please check your internet connection and try refreshing the page.'));
        } else {
          setError(error);
        }
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
        try {
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
        } catch (processingError) {
          console.error('Error processing enrollment requests snapshot:', processingError);
        }
      },
      (error) => {
        console.error('Error fetching enrollment requests:', error);
        
        // Handle specific Firebase/network errors gracefully
        if (error.code === 'unavailable' || error.message.includes('ERR_CERT_COMMON_NAME_INVALID')) {
          console.warn('Enrollment requests connection issue detected');
        }
      }
    );

    return () => unsubscribe();
  }, [showEnrollmentDetailModal, selectedStudentRequests]);

  // Load available classes for data export
  useEffect(() => {
    const loadClasses = async () => {
      if (!showDataExportTab) return;
      
      setLoadingClasses(true);
      try {
        const classesQuery = query(
          collection(firestore, 'classes'),
          orderBy('name', 'asc')
        );
        const classesSnapshot = await getDocs(classesQuery);
        const classesData = classesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ClassDocument[];
        setAvailableClasses(classesData);
      } catch (error) {
        console.error('Error loading classes:', error);
        showError('Failed to load classes');
      } finally {
        setLoadingClasses(false);
      }
    };

    loadClasses();
  }, [showDataExportTab]);

  // Load student counts when data export tab is opened or classes are selected
  useEffect(() => {
    const loadStudentCounts = async () => {
      if (!showDataExportTab) {
        setClassStudentData({});
        return;
      }

      try {
        // Load student data for all available classes to show counts
        const allClassIds = availableClasses.map(cls => cls.id);
        if (allClassIds.length > 0) {
          await loadStudentDataForClasses(allClassIds);
        }
      } catch (error) {
        console.error('Error loading student counts:', error);
      }
    };

    loadStudentCounts();
  }, [showDataExportTab, availableClasses]);
  
  // Use alert for now - can be replaced with a proper toast system later
  const showSuccess = (message: string) => {
    console.log('Success:', message);
    alert(`✅ Success: ${message}`);
  };
  const showError = (message: string) => {
    console.error('Error:', message);
    alert(`❌ Error: ${message}`);
  };

  // Group enrollment requests by student email and status
  const { pendingRequests, approvedRequests, rejectedRequests } = useMemo(() => {
    const grouped: Record<string, EnrollmentRequestDocument[]> = {};
    
    enrollmentRequests.forEach(request => {
      const email = request.student.email;
      if (!grouped[email]) {
        grouped[email] = [];
      }
      grouped[email].push(request);
    });
    
    const allGrouped = Object.entries(grouped).map(([email, requests]) => ({
      studentEmail: email,
      studentName: requests[0].student.name,
      requests: requests,
      totalClasses: requests.length,
      pendingCount: requests.filter(r => r.status === 'Pending').length,
      approvedCount: requests.filter(r => r.status === 'Approved').length,
      rejectedCount: requests.filter(r => r.status === 'Rejected').length,
      latestRequestDate: Math.max(...requests.map(r => r.createdAt?.toMillis() || 0))
    })).sort((a, b) => b.latestRequestDate - a.latestRequestDate);

    const pending = allGrouped.filter(group => group.pendingCount > 0);
    const approved = allGrouped.filter(group => group.approvedCount > 0 && group.pendingCount === 0);
    const rejected = allGrouped.filter(group => group.rejectedCount > 0 && group.pendingCount === 0);

    return { pendingRequests: pending, approvedRequests: approved, rejectedRequests: rejected };
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
        let errorMessage = 'Failed to create student';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (jsonError) {
          console.error('Failed to parse error response:', jsonError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Try to parse success response, but don't fail if it's empty
      try {
        await response.json();
      } catch (jsonError) {
        console.warn('Response parsing warning (non-critical):', jsonError);
      }

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
      const response = await fetch(`/api/student?id=${editingStudent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(studentData),
      });
      
      if (!response.ok) {
        let errorMessage = 'Failed to update student';
        try {
          const errorData = await response.json();
          // Use the detailed message if available, otherwise fall back to error
          errorMessage = errorData.message || errorData.error || errorMessage;
          
          // Log the full error details for debugging
          if (errorData.details) {
            console.error('Validation errors:', errorData.details);
          }
        } catch (jsonError) {
          console.error('Failed to parse error response:', jsonError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Try to parse success response, but don't fail if it's empty
      try {
        await response.json();
      } catch (jsonError) {
        console.warn('Response parsing warning (non-critical):', jsonError);
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
        let errorMessage = 'Failed to delete student';
        try {
          const errorData = await response.json();
          // Handle specific error cases
          if (errorData.criticalError) {
            errorMessage = `Critical Error: ${errorData.message}`;
          } else if (errorData.message && errorData.message.includes('enrollments')) {
            errorMessage = `Failed to delete enrollments: ${errorData.details || errorData.error}`;
          } else {
            errorMessage = errorData.error || errorMessage;
          }
        } catch (jsonError) {
          console.error('Failed to parse error response:', jsonError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        showError(errorMessage);
        return;
      }

      // Try to parse success response
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.warn('Response parsing warning (non-critical):', jsonError);
        showSuccess('Student deleted successfully!');
        setShowDeleteConfirm(false);
        setStudentToDelete(null);
        return;
      }

      const enrollmentMessage = result.deletedEnrollments > 0 
        ? ` and ${result.deletedEnrollments} related enrollments`
        : '';
      const requestMessage = result.cancelledRequests > 0 
        ? ` and ${result.cancelledRequests} enrollment requests`
        : '';
      
      showSuccess(`Student deleted successfully${enrollmentMessage}${requestMessage}!`);
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
        student.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.studentNumber && student.studentNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      
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
          const aCount = studentEnrollmentCounts[a.id] ?? a.coursesEnrolled ?? 0;
          const bCount = studentEnrollmentCounts[b.id] ?? b.coursesEnrolled ?? 0;
          comparison = aCount - bCount;
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

  // Function to refresh enrollment counts for specific students
  const refreshEnrollmentCounts = async (studentIds: string[]) => {
    await loadEnrollmentCounts(studentIds);
  };

  // Handle batch approval of all pending requests for a student
  const handleBatchApproveStudent = async (studentRequests: EnrollmentRequestDocument[]) => {
    const pendingRequests = studentRequests.filter(r => r.status === 'Pending');
    if (pendingRequests.length === 0) {
      showError('No pending requests to approve for this student');
      return;
    }

    setProcessingEnrollment(pendingRequests[0].student.email);
    
    // Track results for detailed error reporting
    let studentId: string = '';
    let studentCreated = false;
    let enrollmentSuccesses = 0;
    let enrollmentFailures: string[] = [];
    let requestUpdateFailures: string[] = [];
    
    try {
      // Check if student already exists (same logic as single approval)
      const studentsQuery = query(
        collection(firestore, 'students'),
        where('email', '==', pendingRequests[0].student.email)
      );
      const existingStudentSnapshot = await getDocs(studentsQuery);
      
      if (!existingStudentSnapshot.empty) {
        // Student exists
        const existingStudent = existingStudentSnapshot.docs[0];
        studentId = existingStudent.id;
        const studentData = existingStudent.data() as StudentDocument;
        
        console.log('Batch approval - student already exists:', studentData.name, studentData.email);
      } else {
        // Create new student
        console.log('Creating new student via API for batch approval...');
        const firstRequest = pendingRequests[0];
        const newStudent: Omit<Student, 'id'> = {
          name: firstRequest.student.name,
          email: firstRequest.student.email,
          phone: firstRequest.student.phone,
          dateOfBirth: firstRequest.student.dateOfBirth,
          year: firstRequest.student.year,
          school: firstRequest.student.school,
          status: 'Active',
          enrollmentDate: new Date().toISOString().split('T')[0],
          coursesEnrolled: 0,
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
          
          // Provide more specific error messages based on status code
          if (response.status === 409) {
            throw new Error(`Student with email ${newStudent.email} already exists in authentication system. Please contact support.`);
          } else if (response.status === 400) {
            throw new Error(`Invalid student data: ${errorData.message || errorData.error || 'Validation failed'}`);
          } else if (response.status === 500) {
            throw new Error(`Server error while creating student account. Please try again later. Details: ${errorData.details || errorData.error || 'Unknown error'}`);
          } else {
            throw new Error(errorData.message || errorData.error || `Failed to create student (HTTP ${response.status})`);
          }
        }

        const createdStudent = await response.json();
        console.log('Created student:', createdStudent);
        studentId = createdStudent.id;
        studentCreated = true;
      }
      
      // Create enrollment records for each approved request - track successes and failures
      const enrollmentResults = await Promise.allSettled(
        pendingRequests.map(async (request) => {
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
          return request.className;
        })
      );
      
      // Count successes and failures
      enrollmentResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          enrollmentSuccesses++;
        } else {
          const className = pendingRequests[index].className;
          enrollmentFailures.push(className);
          console.error(`Failed to create enrollment for ${className}:`, result.reason);
        }
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
      
      // Update enrollment requests - track individual failures
      const requestUpdateResults = await Promise.allSettled(
        pendingRequests.map(request =>
          updateDoc(doc(firestore, 'enrollmentRequests', request.id), {
            status: 'Approved',
            processedAt: Timestamp.now(),
            studentId: studentId,
            updatedAt: Timestamp.now(),
          })
        )
      );
      
      // Track request update failures
      requestUpdateResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          requestUpdateFailures.push(pendingRequests[index].className);
          console.error(`Failed to update request for ${pendingRequests[index].className}:`, result.reason);
        }
      });
      
      // Refresh modal data if it's open for this student
      if (showEnrollmentDetailModal && selectedStudentRequests.length > 0 && 
          selectedStudentRequests[0].student.email === pendingRequests[0].student.email) {
        refreshModalData(pendingRequests[0].student.email);
      }
      
      // Refresh enrollment counts to update the main table
      await refreshEnrollmentCounts([studentId]);
      
      // Show appropriate success/warning message based on results
      const totalRequests = pendingRequests.length;
      
      if (enrollmentFailures.length === 0 && requestUpdateFailures.length === 0) {
        // Complete success
        if (studentCreated) {
          showSuccess(`New student account created for ${pendingRequests[0].student.name} with ${totalRequests} classes enrolled and welcome email sent`);
        } else {
          showSuccess(`All ${totalRequests} pending enrollments approved for ${pendingRequests[0].student.name}`);
        }
      } else if (enrollmentSuccesses > 0) {
        // Partial success
        let message = `Partially completed: ${enrollmentSuccesses} of ${totalRequests} enrollments succeeded.`;
        if (enrollmentFailures.length > 0) {
          message += ` Failed classes: ${enrollmentFailures.join(', ')}.`;
        }
        if (requestUpdateFailures.length > 0) {
          message += ` Some request updates failed.`;
        }
        showError(message);
      } else {
        // All enrollments failed
        showError(`Failed to create any enrollments. Please try again or contact support.`);
      }
      
    } catch (error: any) {
      console.error('Error batch approving enrollments:', error);
      
      // Build a detailed error message
      let errorMessage = 'Failed to batch approve enrollment requests';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Add context about what was completed before the error
      if (studentId && enrollmentSuccesses > 0) {
        errorMessage += ` (${enrollmentSuccesses} enrollments were created before the error)`;
      }
      
      showError(errorMessage);
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
          dateOfBirth: enrollmentRequest.student.dateOfBirth,
          year: enrollmentRequest.student.year,
          school: enrollmentRequest.student.school,
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
      
      // Refresh enrollment counts to update the main table
      await refreshEnrollmentCounts([studentId]);
      
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

  // Handle class selection for export
  const handleClassSelection = (classId: string) => {
    setSelectedClasses(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  // Handle select all classes
  const handleSelectAllClasses = () => {
    if (selectedClasses.length === availableClasses.length) {
      setSelectedClasses([]);
    } else {
      setSelectedClasses(availableClasses.map(cls => cls.id));
    }
  };

  // Export students data to Excel
  const handleExportData = async () => {
    if (selectedClasses.length === 0) {
      showError('Please select at least one class');
      return;
    }

    setExportLoading(true);
    
    try {
      // Get students for selected classes
      const studentsData: any[] = [];
      
      for (const classId of selectedClasses) {
        const classInfo = availableClasses.find(cls => cls.id === classId);
        
        // Get enrollments for this class
        const enrollmentsQuery = query(
          collection(firestore, 'studentEnrollments'),
          where('classId', '==', classId)
        );
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        
        for (const enrollmentDoc of enrollmentsSnapshot.docs) {
          const enrollment = enrollmentDoc.data();
          
          // Get student details
          try {
            const studentDoc = await getDocs(query(
              collection(firestore, 'students'),
              where('email', '==', enrollment.studentEmail)
            ));
            
            if (!studentDoc.empty) {
              const studentData = studentDoc.docs[0].data();
              
              studentsData.push({
                'Class Name': classInfo?.name || 'Unknown',
                'Subject': classInfo?.subject || 'Unknown',
                'Year Level': classInfo?.year || 'Unknown',
                'Student Name': studentData.name || enrollment.studentName,
                'Student Email': studentData.email || enrollment.studentEmail,
                'Student Phone': studentData.phone || 'N/A',
                'Status': studentData.status || 'Active',
                'Enrollment Date': formatDate(studentData.createdAt) || 'N/A',
                'Parent Name': studentData.parent?.name || 'N/A',
                'Parent Email': studentData.parent?.email || 'N/A',
                'Parent Phone': studentData.parent?.phone || 'N/A',
                'Payment Status': studentData.payment?.status || 'N/A',
                'Attendance': `${enrollment.attendance || 0}%`,
                'Grade': enrollment.grade || 'N/A',
                'Enrollment Status': enrollment.status || 'Active',
                'Notes': enrollment.notes || 'N/A'
              });
            }
          } catch (error) {
            console.error('Error getting student data:', error);
            // Add enrollment data even if student details fail
            studentsData.push({
              'Class Name': classInfo?.name || 'Unknown',
              'Subject': classInfo?.subject || 'Unknown',
              'Year Level': classInfo?.year || 'Unknown',
              'Student Name': enrollment.studentName,
              'Student Email': enrollment.studentEmail,
              'Student Phone': 'N/A',
              'Status': 'Unknown',
              'Enrollment Date': 'N/A',
              'Parent Name': 'N/A',
              'Parent Email': 'N/A',
              'Parent Phone': 'N/A',
              'Payment Status': 'N/A',
              'Attendance': `${enrollment.attendance || 0}%`,
              'Grade': enrollment.grade || 'N/A',
              'Enrollment Status': enrollment.status || 'Active',
              'Notes': enrollment.notes || 'N/A'
            });
          }
        }
      }

      if (studentsData.length === 0) {
        showError('No student data found for selected classes');
        return;
      }

      // Create Excel workbook
      const worksheet = XLSX.utils.json_to_sheet(studentsData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students Data');

      // Auto-size columns
      const colWidths = Object.keys(studentsData[0]).map(key => ({
        wch: Math.max(key.length, ...studentsData.map(row => String(row[key]).length))
      }));
      worksheet['!cols'] = colWidths;

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const classNames = selectedClasses.map(id => {
        const cls = availableClasses.find(c => c.id === id);
        return cls?.name || 'Unknown';
      }).join('-');
      const filename = `students-data-${classNames.substring(0, 20)}-${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);
      
      showSuccess(`Exported ${studentsData.length} student records to ${filename}`);
      
    } catch (error) {
      console.error('Error exporting data:', error);
      showError('Failed to export data');
    } finally {
      setExportLoading(false);
    }
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
            onClick={() => {
              setShowEnrollmentTab(false);
              setShowDataExportTab(false);
            }}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              !showEnrollmentTab && !showDataExportTab
                ? 'border-[#0088e0] text-[#0088e0] bg-blue-50 dark:bg-blue-900/20'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Users className="w-4 h-4 mr-2 inline" />
            Students ({students?.length || 0})
          </button>
          <button
            onClick={() => {
              setShowEnrollmentTab(true);
              setShowDataExportTab(false);
            }}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              showEnrollmentTab && !showDataExportTab
                ? 'border-[#0088e0] text-[#0088e0] bg-blue-50 dark:bg-blue-900/20'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Clock className="w-4 h-4 mr-2 inline" />
            Enrollment Requests ({enrollmentRequests.filter(r => r.status === 'Pending').length})
          </button>
          <button
            onClick={() => {
              setShowEnrollmentTab(false);
              setShowDataExportTab(true);
            }}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              showDataExportTab
                ? 'border-[#0088e0] text-[#0088e0] bg-blue-50 dark:bg-blue-900/20'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Download className="w-4 h-4 mr-2 inline" />
            Data Export
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      {!showEnrollmentTab && !showDataExportTab ? (
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
                  {students.length > 0 ? 
                    Math.round(
                      students.reduce((acc, s) => 
                        acc + (studentEnrollmentCounts[s.id] ?? s.coursesEnrolled ?? 0), 0
                      ) / students.length * 10
                    ) / 10 : 0
                  }
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
                  ID
                </th>
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
                  <td colSpan={5} className="px-4 py-8 text-center">
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
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {student.studentNumber || <span className="text-gray-400 italic">--</span>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {student.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{student.email}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{student.phone}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        Courses: {studentEnrollmentCounts[student.id] ?? student.coursesEnrolled ?? 0}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Since: {student.enrollmentDate}</div>
                      
                      {/* Enrolled Classes List with fixed width and scrollable content */}
                      {studentEnrollmentDetails[student.id] && studentEnrollmentDetails[student.id].length > 0 && (
                        <div className="mt-2">
                          <div className="w-48 max-h-20 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 p-2">
                            <div className="space-y-1">
                              {studentEnrollmentDetails[student.id].map((enrollment, index) => (
                                <div key={index} className="text-xs bg-white dark:bg-gray-600 rounded px-2 py-1 border border-gray-100 dark:border-gray-500">
                                  <div className="font-medium text-gray-900 dark:text-white truncate" title={enrollment.className}>
                                    {enrollment.className}
                                  </div>
                                  <div className="text-gray-500 dark:text-gray-400 truncate" title={enrollment.subject}>
                                    {enrollment.subject}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Show message if no enrollments */}
                      {(!studentEnrollmentDetails[student.id] || studentEnrollmentDetails[student.id].length === 0) && (
                        <div className="mt-2">
                          <div className="w-48 text-xs text-gray-500 dark:text-gray-400 italic">
                            No active enrollments
                          </div>
                        </div>
                      )}
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
      ) : showEnrollmentTab && !showDataExportTab ? (
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
            <div className="space-y-6">
              {/* Pending Requests - Always Visible */}
              {pendingRequests.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-yellow-600" />
                    Pending Requests ({pendingRequests.length})
                  </h3>
                  <div className="space-y-4">
                    {pendingRequests.map((studentGroup) => (
                      <Card key={studentGroup.studentEmail} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900">
                                {studentGroup.studentName}
                              </h4>
                              <p className="text-gray-600">{studentGroup.studentEmail}</p>
                              <p className="text-sm text-gray-500">
                                {studentGroup.totalClasses} class{studentGroup.totalClasses !== 1 ? 'es' : ''} requested
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="warning" className="bg-yellow-100 text-yellow-800">
                                {studentGroup.pendingCount} Pending
                              </Badge>
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
                              <strong>Classes:</strong> {studentGroup.requests.map((r: any) => r.className).join(', ')}
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
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Approved Requests - Collapsible */}
              {approvedRequests.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowApprovedRequests(!showApprovedRequests)}
                    className="flex items-center justify-between w-full text-left p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <h3 className="text-lg font-semibold text-green-800 flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Approved Requests ({approvedRequests.length})
                    </h3>
                    {showApprovedRequests ? (
                      <ChevronDown className="w-5 h-5 text-green-600" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-green-600" />
                    )}
                  </button>
                  
                  {showApprovedRequests && (
                    <div className="mt-4 space-y-4">
                      {approvedRequests.map((studentGroup) => (
                        <Card key={studentGroup.studentEmail} className="bg-green-50/50">
                          <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="text-lg font-semibold text-gray-900">
                                  {studentGroup.studentName}
                                </h4>
                                <p className="text-gray-600">{studentGroup.studentEmail}</p>
                                <p className="text-sm text-gray-500">
                                  {studentGroup.totalClasses} class{studentGroup.totalClasses !== 1 ? 'es' : ''} approved
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="success" className="bg-green-100 text-green-800">
                                  {studentGroup.approvedCount} Approved
                                </Badge>
                                <span className="text-sm text-gray-500">
                                  {formatDate(new Date(studentGroup.latestRequestDate))}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex justify-between items-center">
                              <div className="text-sm text-gray-600">
                                <strong>Classes:</strong> {studentGroup.requests.map((r: any) => r.className).join(', ')}
                              </div>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewStudentRequests(studentGroup.requests)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View Details
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Rejected Requests - Collapsible */}
              {rejectedRequests.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowRejectedRequests(!showRejectedRequests)}
                    className="flex items-center justify-between w-full text-left p-4 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <h3 className="text-lg font-semibold text-red-800 flex items-center">
                      <XCircle className="w-5 h-5 mr-2" />
                      Rejected Requests ({rejectedRequests.length})
                    </h3>
                    {showRejectedRequests ? (
                      <ChevronDown className="w-5 h-5 text-red-600" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-red-600" />
                    )}
                  </button>
                  
                  {showRejectedRequests && (
                    <div className="mt-4 space-y-4">
                      {rejectedRequests.map((studentGroup) => (
                        <Card key={studentGroup.studentEmail} className="bg-red-50/50">
                          <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="text-lg font-semibold text-gray-900">
                                  {studentGroup.studentName}
                                </h4>
                                <p className="text-gray-600">{studentGroup.studentEmail}</p>
                                <p className="text-sm text-gray-500">
                                  {studentGroup.totalClasses} class{studentGroup.totalClasses !== 1 ? 'es' : ''} rejected
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="destructive" className="bg-red-100 text-red-800">
                                  {studentGroup.rejectedCount} Rejected
                                </Badge>
                                <span className="text-sm text-gray-500">
                                  {formatDate(new Date(studentGroup.latestRequestDate))}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex justify-between items-center">
                              <div className="text-sm text-gray-600">
                                <strong>Classes:</strong> {studentGroup.requests.map((r: any) => r.className).join(', ')}
                              </div>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewStudentRequests(studentGroup.requests)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View Details
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* No pending requests message */}
              {pendingRequests.length === 0 && (approvedRequests.length > 0 || rejectedRequests.length > 0) && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">
                      No pending enrollment requests
                    </h3>
                    <p className="text-gray-500">
                      All enrollment requests have been processed. Check the collapsible sections above for approved and rejected requests.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      ) : showDataExportTab ? (
        /* Data Export Tab */
        <div className="space-y-6">
          {/* Export Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {availableClasses.length}
                </div>
                <div className="text-sm text-gray-600">Available Classes</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {selectedClasses.length}
                </div>
                <div className="text-sm text-gray-600">Selected Classes</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {selectedClasses.reduce((acc, classId) => acc + (classStudentData[classId]?.length || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">Total Students to Export</div>
              </CardContent>
            </Card>
          </div>

          {/* Class Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="w-5 h-5 mr-2" />
                Select Classes to Export
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingClasses ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading classes...</p>
                </div>
              ) : availableClasses.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No classes available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => setSelectedClasses(selectedClasses.length === availableClasses.length ? [] : availableClasses.map(c => c.id))}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {selectedClasses.length === availableClasses.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <Button
                      onClick={exportStudentData}
                      disabled={selectedClasses.length === 0 || exportLoading}
                      className="flex items-center"
                    >
                      {exportLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                      )}
                      Export to Excel
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableClasses.map((classItem) => (
                      <Card key={classItem.id} className={`cursor-pointer border-2 transition-all ${
                        selectedClasses.includes(classItem.id) 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-blue-300'
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center mb-2">
                                <input
                                  type="checkbox"
                                  checked={selectedClasses.includes(classItem.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedClasses([...selectedClasses, classItem.id]);
                                    } else {
                                      setSelectedClasses(selectedClasses.filter(id => id !== classItem.id));
                                    }
                                  }}
                                  className="mr-2"
                                />
                                <h3 className="font-semibold text-gray-900">{classItem.name}</h3>
                              </div>
                              <div className="space-y-1 text-sm text-gray-600">
                                <div className="flex items-center">
                                  <BookOpen className="w-4 h-4 mr-1" />
                                  {classItem.subject} - {classItem.year}
                                </div>
                                <div className="flex items-center">
                                  <Users className="w-4 h-4 mr-1" />
                                  {classStudentData[classItem.id]?.length ?? classItem.enrolledStudents ?? 0} students
                                  {selectedClasses.includes(classItem.id) && classStudentData[classItem.id] && (
                                    <span className="ml-1 text-xs text-blue-600">
                                      ({classStudentData[classItem.id].length} active)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    classItem.status === 'Active' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {classItem.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {selectedClasses.length > 0 && (
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Export Preview</h4>
                      <p className="text-sm text-blue-700">
                        {selectedClasses.length} class{selectedClasses.length !== 1 ? 'es' : ''} selected. 
                        The Excel file will contain separate sheets for each selected class with student enrollment details.
                      </p>
                      <div className="mt-2 text-xs text-blue-600">
                        <strong>Data included:</strong> Student Name, Email, Phone, Parent Name, Email, Phone, Class Name, Subject, Enrollment Date, Status
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

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
                      <p><strong>Session Fee:</strong> ${request.sessionFee}</p>
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
