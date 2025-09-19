'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Calendar,
  FileSpreadsheet,
  Send,
  User,
  Mail,
  CheckCircle,
  AlertCircle,
  Loader,
  ExternalLink,
  UserPlus,
  Eye,
  Upload,
  Plus
} from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { StudentFirestoreService } from '@/apiservices/studentFirestoreService';
import { StudentEnrollmentFirestoreService, EnrollmentWithParent } from '@/apiservices/studentEnrollmentFirestoreService';
import { ClassDocument } from '@/models/classSchema';
import { StudentDocument } from '@/models/studentSchema';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, firestore } from '@/utils/firebase-client';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } from 'firebase/firestore';

interface SheetTemplate {
  id: string;
  name: string;
  description: string;
  fileName: string;
  filePath: string;
  googleFileId?: string;
  uploadedBy: string;
  uploadedAt: any;
  isActive: boolean;
}

interface SheetAllocation {
  id: string;
  templateId: string;
  templateName: string;
  classId: string;
  className: string;
  title: string;
  description: string;
  teacherId: string;
  teacherEmail: string;
  createdAt: any;
  status: 'pending' | 'completed' | 'failed';
  studentCount: number;
  sheetsCreated: number;
}

interface StudentSheet {
  id: string;
  allocationId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  googleSheetId: string;
  googleSheetUrl: string;
  status: 'assigned' | 'in-progress' | 'completed' | 'graded';
  createdAt: any;
}

interface Student {
  id: string;
  studentId: string;
  name: string;
  email: string;
  selected: boolean;
  hasSheet?: boolean;
  sheetUrl?: string;
  parent?: {
    name: string;
    email: string;
    phone: string;
  };
}

interface Class {
  id: string;
  name: string;
  subject: string;
  studentCount: number;
}

interface AllocationData {
  id: string;
  title: string;
  description?: string;
  dueDate?: Date;
  studentSheets: StudentSheet[];
}

// Loading component for Suspense fallback
function AllocateSheetPageLoading() {
  return (
    <TeacherLayout>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader className="h-8 w-8 animate-spin text-blue-600 mr-3" />
            <span className="text-gray-600">Loading allocation page...</span>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

// Main component that uses useSearchParams
function AllocateSheetPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('templateId');
  const classId = searchParams.get('classId');
  const { teacher, loading: authLoading } = useTeacherAuth();

  const [template, setTemplate] = useState<SheetTemplate | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<SheetTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templateId || '');
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(classId || '');
  const [students, setStudents] = useState<Student[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [existingAllocation, setExistingAllocation] = useState<AllocationData | null>(null);
  const [viewMode, setViewMode] = useState<'allocate' | 'manage'>('allocate');
  
  // Template upload states
  const [showTemplateUpload, setShowTemplateUpload] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  useEffect(() => {
    if (teacher) {
      loadInitialData();
    }
  }, [teacher]);

  useEffect(() => {
    if (selectedTemplateId && availableTemplates.length > 0) {
      const currentTemplate = availableTemplates.find(t => t.id === selectedTemplateId);
      if (currentTemplate) {
        setTemplate(currentTemplate);
        setTitle(`${currentTemplate.name} Assignment`);
      }
    }
  }, [selectedTemplateId, availableTemplates]);

  useEffect(() => {
    if (selectedClassId && teacher && selectedTemplateId) {
      loadInitialData();
    }
  }, [templateId, teacher]);

  useEffect(() => {
    if (selectedClassId && teacher) {
      loadClassStudents();
    } else {
      setStudents([]);
      setExistingAllocation(null);
    }
  }, [selectedClassId, teacher]);

  const loadInitialData = async () => {
    if (!teacher) return;
    
    try {
      setLoading(true);
      
      // Load all available templates for this teacher
      console.log('Loading templates...');
      const templatesQuery = query(
        collection(firestore, 'sheetTemplates'),
        where('isActive', '==', true),
        orderBy('uploadedAt', 'desc')
      );
      const templatesSnapshot = await getDocs(templatesQuery);
      const templates = templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SheetTemplate));
      console.log('Templates processed:', templates.length, 'templates');
      setAvailableTemplates(templates);
      
      // If templateId was provided, set it as selected
      if (templateId) {
        const currentTemplate = templates.find((t: SheetTemplate) => t.id === templateId);
        if (!currentTemplate) {
          alert('Template not found');
          router.back();
          return;
        }
        setTemplate(currentTemplate);
        setSelectedTemplateId(templateId);
        setTitle(`${currentTemplate.name} Assignment`);
      }
      
      // Load only classes that this teacher teaches
      const teacherClasses = await ClassFirestoreService.getClassesByTeacher(teacher.id);
      const classesWithCounts = await Promise.all(
        teacherClasses.map(async (cls) => {
          const studentCount = await StudentEnrollmentFirestoreService.getEnrolledStudentsCount(cls.id);
          return {
            id: cls.id,
            name: cls.name,
            subject: cls.subject,
            studentCount
          };
        })
      );
      setClasses(classesWithCounts);
      
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !teacher?.id) return;

    // Validate file type
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      alert('Please select an Excel (.xlsx, .xls) or CSV file');
      return;
    }

    try {
      setUploadLoading(true);
      setUploadProgress('Preparing upload...');

      // Create unique filename
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `templates/${fileName}`);

      setUploadProgress('Uploading file...');
      
      // Upload to Firebase Storage
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      setUploadProgress('Saving template...');

      // Save template metadata to Firestore directly
      const docRef = await addDoc(collection(firestore, 'sheetTemplates'), {
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
        description: `Uploaded template: ${file.name}`,
        fileName: file.name,
        filePath: downloadURL,
        uploadedBy: teacher.id,
        uploadedAt: serverTimestamp(),
        isActive: true
      });

      const newTemplateId = docRef.id;

      setUploadProgress('Template uploaded successfully!');
      
      // Reload templates
      console.log('Reloading templates after upload...');
      const templatesQuery = query(
        collection(firestore, 'sheetTemplates'),
        where('isActive', '==', true),
        orderBy('uploadedAt', 'desc')
      );
      const templatesSnapshot = await getDocs(templatesQuery);
      const updatedTemplates = templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SheetTemplate));
      console.log('Updated templates count:', updatedTemplates.length);
      setAvailableTemplates(updatedTemplates);
      
      // Auto-select the newly uploaded template
      if (newTemplateId) {
        setSelectedTemplateId(newTemplateId);
        const createdTemplate = updatedTemplates.find(t => t.id === newTemplateId);
        if (createdTemplate) {
          setTemplate(createdTemplate);
          setTitle(`${createdTemplate.name} Assignment`);
        }
      }
      
      // Reset form
      event.target.value = '';
      setShowTemplateUpload(false);
      
      setTimeout(() => {
        setUploadProgress('');
      }, 2000);

    } catch (error) {
      console.error('Error uploading template:', error);
      alert('Error uploading template. Please try again.');
      setUploadProgress('');
    } finally {
      setUploadLoading(false);
    }
  };

  const loadClassStudents = async () => {
    if (!teacher) return;
    
    try {
      setStudentsLoading(true);
      
      // Check if there's already an allocation for this class (regardless of template)
      const allocationsQuery = query(
        collection(firestore, 'sheetAllocations'),
        where('classId', '==', selectedClassId)
      );
      const allocationsSnapshot = await getDocs(allocationsQuery);
      const existingAllocations = allocationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SheetAllocation));
      const classAllocation = existingAllocations.find(
        (alloc: SheetAllocation) => alloc.classId === selectedClassId
      );
      
      console.log('🔍 Checking for existing allocations for class:', selectedClassId);
      console.log('📋 Found allocations:', existingAllocations.length);
      console.log('🎯 Class allocation found:', classAllocation);
      
      // Get student sheets for this allocation (if exists)
      let studentSheets: StudentSheet[] = [];
      if (classAllocation) {
        try {
          const studentSheetsQuery = query(
            collection(firestore, 'studentSheets'),
            where('allocationId', '==', classAllocation.id)
          );
          const studentSheetsSnapshot = await getDocs(studentSheetsQuery);
          studentSheets = studentSheetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentSheet));
          console.log('📄 Student sheets found:', studentSheets.length);
        } catch (error) {
          console.warn('Could not load student sheets for allocation:', error);
        }

        // Convert to AllocationData format
        const allocationData: AllocationData = {
          id: classAllocation.id,
          title: classAllocation.title,
          description: classAllocation.description,
          studentSheets: studentSheets
        };
        
        setExistingAllocation(allocationData);
        setViewMode('manage');
        setTitle(classAllocation.title);
        setDescription(classAllocation.description || '');
      } else {
        setExistingAllocation(null);
        setViewMode('allocate');
      }
      
      // Get enrolled students for the class
      const enrolledStudents = await StudentEnrollmentFirestoreService.getEnrolledStudentsByClassId(selectedClassId);
      
      if (!enrolledStudents || enrolledStudents.length === 0) {
        setStudents([]);
        return;
      }

      // Get full student details for each enrolled student
      const studentPromises = enrolledStudents.map(async (enrollment) => {
        try {
          const studentData = await StudentFirestoreService.getStudentById(enrollment.studentId);
          if (studentData) {
            // Check if this student has a sheet in the existing allocation
            let hasSheet = false;
            let sheetUrl = '';
            
            if (classAllocation) {
              const studentSheet = studentSheets.find(
                (sheet: any) => sheet.studentId === enrollment.studentId
              );
              if (studentSheet) {
                hasSheet = true;
                sheetUrl = studentSheet.googleSheetUrl;
              }
            }
            
            return {
              id: enrollment.id, // enrollment ID
              studentId: enrollment.studentId,
              name: studentData.name,
              email: studentData.email || `${studentData.name.toLowerCase().replace(/\s+/g, '.')}@student.edu`,
              selected: !hasSheet, // Don't select students who already have sheets
              hasSheet,
              sheetUrl,
              parent: enrollment.parent
            };
          }
          return null;
        } catch (error) {
          console.warn(`Could not load student ${enrollment.studentId}:`, error);
          return null;
        }
      });
      
      const studentData = await Promise.all(studentPromises);
      const validStudents = studentData
        .filter(student => student !== null)
        .map(student => student!);
      
      setStudents(validStudents);
    } catch (error) {
      console.error('Error loading students:', error);
      alert('Error loading students. Please try again.');
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleStudentToggle = (studentId: string) => {
    setStudents(prev => 
      prev.map(student => 
        student.id === studentId 
          ? { ...student, selected: !student.selected }
          : student
      )
    );
  };

  const handleSelectAll = () => {
    const allSelected = students.every(s => s.selected);
    setStudents(prev => 
      prev.map(student => ({ ...student, selected: !allSelected }))
    );
  };

  const handleAllocate = async () => {
    if (!teacher) return;
    
    try {
      if (!selectedClassId) {
        alert('Please select a class');
        return;
      }

      if (!title.trim()) {
        alert('Please enter a title');
        return;
      }

      const selectedStudents = students.filter(s => s.selected);
      if (selectedStudents.length === 0) {
        alert('Please select at least one student');
        return;
      }

      setAllocating(true);

      const selectedClass = classes.find(c => c.id === selectedClassId);
      
      // Create the allocation first
      const allocationResponse = await fetch('/api/sheets/allocations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: selectedTemplateId!,
          templateName: template?.name || 'Unknown Template',
          classId: selectedClassId,
          className: selectedClass?.name || 'Unknown Class',
          title,
          description: description || '',
          teacherId: teacher.id,
          teacherEmail: teacher.email,
          studentCount: selectedStudents.length
        })
      });

      const allocationData = await allocationResponse.json();
      const allocationId = allocationData.success ? allocationData.allocationId : null;

      // Then call the API to create the actual Google Sheets
      const response = await fetch('/api/sheets/create-for-students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allocationId,
          templateFileUrl: template?.filePath, // Use Firebase Storage URL
          students: selectedStudents.map(s => ({ id: s.studentId, name: s.name, email: s.email })),
          title,
          className: selectedClass?.name || 'Unknown Class',
          teacherEmail: teacher.email
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create Google Sheets for students');
      }

      const result = await response.json();
      
      // Update allocation status
      await fetch('/api/sheets/allocations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allocationId,
          updates: {
            status: 'completed',
            sheetsCreated: result.createdSheets
          }
        })
      });

      alert(`Successfully allocated sheets to ${selectedStudents.length} students!`);
      router.push('/teacher/sheets');
    } catch (error) {
      console.error('Error allocating sheets:', error);
      alert('Error allocating sheets. Please try again.');
    } finally {
      setAllocating(false);
    }
  };

  const handleAllocateToNewStudents = async () => {
    if (!teacher || !existingAllocation) return;
    
    try {
      const newStudents = students.filter(s => s.selected && !s.hasSheet);
      if (newStudents.length === 0) {
        alert('No new students selected');
        return;
      }

      setAllocating(true);

      // Call API to create sheets for new students
      const response = await fetch('/api/sheets/create-for-students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allocationId: existingAllocation.id,
          templateFileUrl: template?.filePath,
          students: newStudents.map(s => ({ id: s.studentId, name: s.name, email: s.email })),
          title: existingAllocation.title,
          className: classes.find(c => c.id === selectedClassId)?.name || 'Unknown Class',
          teacherEmail: teacher.email
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create sheets for new students');
      }

      alert(`Successfully allocated sheets to ${newStudents.length} new students!`);
      // Reload the page to show updated state
      window.location.reload();
    } catch (error) {
      console.error('Error allocating sheets to new students:', error);
      alert('Error allocating sheets to new students. Please try again.');
    } finally {
      setAllocating(false);
    }
  };

  const handleDiagnoseAllocation = async () => {
    if (!existingAllocation) return;
    
    try {
      // Get student sheets for diagnostics
      const studentSheetsQuery = query(
        collection(firestore, 'studentSheets'),
        where('allocationId', '==', existingAllocation.id)
      );
      const studentSheetsSnapshot = await getDocs(studentSheetsQuery);
      const studentSheets = studentSheetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentSheet));
      
      let message = `Allocation Diagnostics:\n\n`;
      message += `- Allocation ID: ${existingAllocation.id}\n`;
      message += `- Title: ${existingAllocation.title}\n`;
      message += `- Total students in class: ${students.length}\n`;
      message += `- Student sheets created: ${studentSheets.length}\n`;
      message += `- Is healthy: ${studentSheets.length > 0 ? 'Yes' : 'No'}\n`;
      
      // Check for issues
      const issues = [];
      if (studentSheets.length === 0) {
        issues.push('No student sheets found in database');
      }
      const studentsWithoutSheets = students.filter(s => !s.hasSheet);
      if (studentsWithoutSheets.length > 0) {
        issues.push(`${studentsWithoutSheets.length} students missing sheets`);
      }
      
      if (issues.length > 0) {
        message += `\nIssues found:\n${issues.map(issue => `- ${issue}`).join('\n')}`;
      }
      
      message += `\n\nDetailed Debug Info:\n`;
      
      if (studentSheets.length > 0) {
        message += `\nStudent Sheet Details:\n`;
        studentSheets.forEach((sheet: any, index: number) => {
          message += `${index + 1}. ${sheet.studentName} (${sheet.studentEmail})\n`;
          message += `   - Status: ${sheet.status}\n`;
          message += `   - Sheet ID: ${sheet.googleSheetId}\n`;
          message += `   - Created: ${sheet.createdAt.toDate().toLocaleString()}\n`;
          message += `\n`;
        });
      } else {
        message += `\n❌ No student sheet records found in the database!\n`;
        message += `This means the Google Sheets creation process failed completely.`;
      }
      
      console.log('🔍 Full diagnostic data:', { allocation: existingAllocation, studentSheets });
      alert(message);
    } catch (error) {
      console.error('Error diagnosing allocation:', error);
      alert('Error diagnosing allocation. Please try again.');
    }
  };

  const handleDeleteBrokenAllocation = async () => {
    if (!existingAllocation) return;
    
    const confirmed = confirm(
      `Are you sure you want to delete this allocation?\n\n` +
      `This will remove the allocation "${existingAllocation.title}" and any associated student sheets.\n\n` +
      `You can then create a new allocation for this class.`
    );
    
    if (!confirmed) return;
    
    try {
      setAllocating(true);
      await fetch(`/api/sheets/allocations?id=${existingAllocation.id}`, {
        method: 'DELETE'
      });
      alert('Allocation deleted successfully. You can now create a new allocation.');
      router.push('/teacher/sheets');
    } catch (error) {
      console.error('Error deleting allocation:', error);
      alert('Error deleting allocation. Please try again.');
    } finally {
      setAllocating(false);
    }
  };

  const handleRetryAllocation = async () => {
    if (!teacher || !existingAllocation) return;
    
    const confirmed = confirm(
      `This will attempt to create sheets for all students in the class who don't have sheets yet.\n\n` +
      `Continue?`
    );
    
    if (!confirmed) return;
    
    try {
      setAllocating(true);
      
      // Get all students who don't have sheets
      const studentsWithoutSheets = students.filter(s => !s.hasSheet);
      
      if (studentsWithoutSheets.length === 0) {
        alert('All students already have sheets for this allocation.');
        return;
      }
      
      // Call API to create sheets for students without sheets
      const response = await fetch('/api/sheets/create-for-students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allocationId: existingAllocation.id,
          templateFileUrl: template?.filePath,
          students: studentsWithoutSheets.map(s => ({ id: s.studentId, name: s.name, email: s.email })),
          title: existingAllocation.title,
          teacherEmail: teacher.email
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create sheets for students');
      }

      const result = await response.json();
      alert(`Successfully created ${result.createdSheets} sheets for students!`);
      
      // Reload the page to show updated state
      window.location.reload();
    } catch (error) {
      console.error('Error retrying allocation:', error);
      alert('Error creating sheets for students. Please try again.');
    } finally {
      setAllocating(false);
    }
  };

  const openStudentSheet = (sheetUrl: string) => {
    window.open(sheetUrl, '_blank');
  };

  if (authLoading || loading) {
    return (
      <TeacherLayout>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              <div className="grid grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-32 bg-gray-300 dark:bg-gray-600 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  if (!template) {
    return (
      <TeacherLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <button
                onClick={() => router.back()}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Select Template
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Choose a template or upload a new one to allocate to your class
                </p>
              </div>
            </div>
          </div>

          {/* Template Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Available Templates
              </h2>
              <button
                onClick={() => setShowTemplateUpload(!showTemplateUpload)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Upload New Template
              </button>
            </div>

            {/* Upload Section */}
            {showTemplateUpload && (
              <div className="mb-6 p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                  Upload Excel Template
                </h3>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <div className="space-y-2">
                    <p className="text-gray-600 dark:text-gray-400">
                      Upload Excel (.xlsx, .xls) or CSV files
                    </p>
                    <label className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadLoading ? 'Uploading...' : 'Choose File'}
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                        disabled={uploadLoading}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {uploadProgress && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-md">
                      <p className="text-blue-600 dark:text-blue-300 text-sm">{uploadProgress}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Template List */}
            {availableTemplates.length === 0 ? (
              <div className="text-center py-8">
                <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Templates Available
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Upload your first template to get started
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableTemplates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    onClick={() => {
                      setSelectedTemplateId(tmpl.id);
                      setTemplate(tmpl);
                      setTitle(`${tmpl.name} Assignment`);
                    }}
                    className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      <FileSpreadsheet className="h-6 w-6 text-blue-600 mt-1" />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {tmpl.name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {tmpl.description}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          File: {tmpl.fileName}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </TeacherLayout>
    );
  }

  const selectedCount = students.filter(s => s.selected).length;

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <button
              onClick={() => router.back()}
              className="mr-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {viewMode === 'allocate' ? 'Allocate Sheet to Class' : 'Manage Class Sheets'}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Template: {template.name}
                {existingAllocation && (
                  <span className="ml-2 text-green-600 dark:text-green-400">
                    • Already allocated to {students.filter(s => s.hasSheet).length} students
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Configuration
            </h3>
            
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assignment Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter assignment title"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter assignment description"
                />
              </div>

              {/* Class Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Class *
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Choose a class...</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} - {cls.subject} ({cls.studentCount} students)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Student Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {viewMode === 'allocate' ? 'Select Students' : 'Class Sheet Status'}
              </h3>
              {students.length > 0 && !existingAllocation && (
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  {students.every(s => s.selected) ? 'Deselect All' : 'Select All'}
                </button>
              )}
              {students.length > 0 && existingAllocation && students.some(s => !s.hasSheet) && (
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-green-600 hover:text-green-500"
                >
                  {students.filter(s => !s.hasSheet).every(s => s.selected) ? 'Deselect New Students' : 'Select New Students'}
                </button>
              )}
            </div>

            {!selectedClassId ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <p className="text-gray-500 dark:text-gray-400">
                  Select a class to view students
                </p>
              </div>
            ) : studentsLoading ? (
              <div className="text-center py-8">
                <Loader className="mx-auto h-8 w-8 text-blue-500 animate-spin mb-2" />
                <p className="text-gray-500 dark:text-gray-400">
                  Loading students...
                </p>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <p className="text-gray-500 dark:text-gray-400">
                  No students found in this class
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className={`p-3 border rounded-lg ${
                      student.hasSheet 
                        ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-700' 
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {!student.hasSheet && (
                          <input
                            type="checkbox"
                            checked={student.selected}
                            onChange={() => handleStudentToggle(student.id)}
                            className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900 dark:text-white">
                              {student.name}
                            </span>
                            {student.hasSheet && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <Mail className="h-3 w-3 text-gray-400" />
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {student.email}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {student.hasSheet && student.sheetUrl && (
                        <button
                          onClick={() => openStudentSheet(student.sheetUrl!)}
                          className="ml-3 inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-600 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900/70"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Sheet
                        </button>
                      )}
                    </div>
                    
                    {student.hasSheet && (
                      <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                        ✓ Sheet already allocated
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {selectedCount > 0 && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  <CheckCircle className="h-4 w-4 inline mr-1" />
                  {selectedCount} student{selectedCount !== 1 ? 's' : ''} selected
                  {viewMode === 'manage' && ' for new allocation'}
                </p>
              </div>
            )}

            {/* Summary for existing allocation */}
            {existingAllocation && (
              <div className="mt-4 space-y-4">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-sm text-green-600 dark:text-green-400">
                    <FileSpreadsheet className="h-4 w-4 inline mr-1" />
                    Existing allocation: "{existingAllocation.title}"
                    <br />
                    <span className="text-xs">
                      {students.filter(s => s.hasSheet).length} students already have sheets
                    </span>
                  </div>
                </div>

                {/* Diagnostic and cleanup tools */}
                {students.filter(s => s.hasSheet).length === 0 && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      No student sheets found for this allocation. This might indicate an issue during the allocation process.
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={handleDiagnoseAllocation}
                        disabled={allocating}
                        className="px-3 py-1 text-xs bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded border border-yellow-300 dark:border-yellow-600 hover:bg-yellow-200 dark:hover:bg-yellow-700 disabled:opacity-50"
                      >
                        <Eye className="h-3 w-3 inline mr-1" />
                        Diagnose
                      </button>
                      <button
                        onClick={handleRetryAllocation}
                        disabled={allocating}
                        className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded border border-blue-300 dark:border-blue-600 hover:bg-blue-200 dark:hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Plus className="h-3 w-3 inline mr-1" />
                        Retry Creation
                      </button>
                      <button
                        onClick={handleDeleteBrokenAllocation}
                        disabled={allocating}
                        className="px-3 py-1 text-xs bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 rounded border border-red-300 dark:border-red-600 hover:bg-red-200 dark:hover:bg-red-700 disabled:opacity-50"
                      >
                        🗑️ Delete & Start Over
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {viewMode === 'allocate' && selectedCount > 0 && (
                <>
                  Ready to allocate sheets to {selectedCount} student{selectedCount !== 1 ? 's' : ''}
                </>
              )}
              {viewMode === 'manage' && selectedCount > 0 && (
                <>
                  Ready to allocate sheets to {selectedCount} new student{selectedCount !== 1 ? 's' : ''}
                </>
              )}
              {viewMode === 'manage' && selectedCount === 0 && (
                <>
                  All enrolled students have been allocated sheets
                </>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Back
              </button>
              
              {viewMode === 'allocate' && (
                <button
                  onClick={handleAllocate}
                  disabled={!selectedClassId || !title.trim() || selectedCount === 0 || allocating}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {allocating ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Allocating...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Allocate Sheets
                    </>
                  )}
                </button>
              )}

              {viewMode === 'manage' && selectedCount > 0 && (
                <button
                  onClick={handleAllocateToNewStudents}
                  disabled={allocating}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {allocating ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Sheets for New Students
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

// Main export component with Suspense boundary
export default function AllocateSheetPage() {
  return (
    <Suspense fallback={<AllocateSheetPageLoading />}>
      <AllocateSheetPageContent />
    </Suspense>
  );
}