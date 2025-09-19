'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileSpreadsheet,
  Upload,
  Users,
  BookOpen,
  Search,
  Download,
  ChevronRight,
  Clock
} from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { StudentEnrollmentFirestoreService } from '@/apiservices/studentEnrollmentFirestoreService';
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

interface ClassWithStats {
  id: string;
  name: string;
  subject: string;
  year: string;
  studentCount: number;
  sheetAllocations: number;
  activeSheets: number;
}

export default function SheetManagementPage() {
  const router = useRouter();
  const { teacher, loading: authLoading } = useTeacherAuth();
  
  const [activeTab, setActiveTab] = useState<'classes' | 'templates'>('classes');
  const [classes, setClasses] = useState<ClassWithStats[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [templates, setTemplates] = useState<SheetTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  useEffect(() => {
    if (!authLoading && teacher?.id) {
      if (activeTab === 'classes') {
        loadClasses();
      } else {
        loadTemplates();
      }
    }
  }, [authLoading, teacher, activeTab]);

  const loadClasses = async () => {
    if (!teacher?.id) return;
    
    try {
      setClassesLoading(true);
      const teacherClasses = await ClassFirestoreService.getClassesByTeacher(teacher.id);
      
      const classesWithStats = await Promise.all(
        teacherClasses.map(async (cls) => {
          const studentCount = await StudentEnrollmentFirestoreService.getEnrolledStudentsCount(cls.id);
          
          let sheetAllocations = 0;
          let activeSheets = 0;
          
          try {
            // Direct Firestore query for sheet allocations
            const allocationsQuery = query(
              collection(firestore, 'sheetAllocations'),
              where('classId', '==', cls.id)
            );
            const allocationsSnapshot = await getDocs(allocationsQuery);
            const classAllocations = allocationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            sheetAllocations = classAllocations.length;
            
            // Get student sheets count for each allocation
            for (const alloc of classAllocations) {
              try {
                const studentSheetsQuery = query(
                  collection(firestore, 'studentSheets'),
                  where('allocationId', '==', alloc.id)
                );
                const studentSheetsSnapshot = await getDocs(studentSheetsQuery);
                activeSheets += studentSheetsSnapshot.size;
              } catch (error) {
                console.warn('Could not load student sheets for allocation:', alloc.id);
              }
            }
          } catch (error) {
            console.warn('Could not load allocations for class:', cls.id);
          }
          
          return {
            id: cls.id,
            name: cls.name,
            subject: cls.subject,
            year: cls.year,
            studentCount,
            sheetAllocations,
            activeSheets
          };
        })
      );
      
      setClasses(classesWithStats);
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setClassesLoading(false);
    }
  };

  const loadTemplates = async () => {
    if (!teacher?.id) return;
    
    try {
      setTemplatesLoading(true);
      console.log('Client: Starting to load templates directly from Firestore...');
      
      // Direct Firestore query instead of API call
      const templatesQuery = query(
        collection(firestore, 'sheetTemplates'),
        where('isActive', '==', true),
        orderBy('uploadedAt', 'desc')
      );
      
      const snapshot = await getDocs(templatesQuery);
      console.log('Client: Firestore query returned:', snapshot.size, 'documents');
      
      const templates = snapshot.docs.map(doc => {
        const data = { id: doc.id, ...doc.data() } as SheetTemplate;
        console.log('Client: Template found:', data);
        return data;
      });
      
      console.log('Client: Final templates array:', templates);
      setTemplates(templates);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !teacher?.id) return;

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

      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `templates/${fileName}`);

      setUploadProgress('Uploading file...');
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      setUploadProgress('Saving template...');

      // Direct Firestore save instead of API call
      await addDoc(collection(firestore, 'sheetTemplates'), {
        name: file.name.replace(/\.[^/.]+$/, ''),
        description: `Uploaded template: ${file.name}`,
        fileName: file.name,
        filePath: downloadURL,
        uploadedBy: teacher.id,
        uploadedAt: serverTimestamp(),
        isActive: true
      });

      setUploadProgress('Template uploaded successfully!');
      
      await loadTemplates();
      event.target.value = '';
      
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

  const downloadTemplate = (template: SheetTemplate) => {
    window.open(template.filePath, '_blank');
  };

  const openClassManagement = (classData: ClassWithStats) => {
    router.push(`/teacher/sheets/class/${classData.id}`);
  };

  const filteredClasses = classes.filter(cls => 
    cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.year.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading) {
    return (
      <TeacherLayout>
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-t-2 border-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading...</p>
              </div>
            </div>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Sheet Management</h1>
                <p className="text-gray-500 mt-1">
                  Manage your classes and Google Sheets templates
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-6 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('classes')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'classes'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Users className="h-4 w-4 inline mr-2" />
                  My Classes
                </button>
                <button
                  onClick={() => setActiveTab('templates')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'templates'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4 inline mr-2" />
                  Templates
                </button>
              </nav>
            </div>
          </div>

          {/* Classes Tab */}
          {activeTab === 'classes' && (
            <div className="space-y-6">
              {/* Search and Filter */}
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center space-x-4">
                  <div className="flex-1 relative">
                    <Search className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search classes..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Classes Grid */}
              {classesLoading ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-t-2 border-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading your classes...</p>
                </div>
              ) : filteredClasses.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Classes Found</h3>
                  <p className="text-gray-500">
                    {searchTerm ? 'No classes match your search.' : 'You haven\'t been assigned to any classes yet.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredClasses.map((classData) => (
                    <div
                      key={classData.id}
                      className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => openClassManagement(classData)}
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <BookOpen className="h-5 w-5 text-blue-600" />
                              <h3 className="text-lg font-semibold text-gray-900 truncate">
                                {classData.name}
                              </h3>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">{classData.subject}</p>
                            <p className="text-xs text-gray-400">{classData.year}</p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Students:</span>
                            <span className="font-medium">{classData.studentCount}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Sheet Allocations:</span>
                            <span className="font-medium">{classData.sheetAllocations}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Active Sheets:</span>
                            <span className="font-medium text-green-600">{classData.activeSheets}</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="flex items-center text-xs text-gray-500">
                            <Clock className="h-3 w-3 mr-1" />
                            Click to manage sheets for this class
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              {/* Upload Section */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Upload New Template</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <div className="space-y-2">
                    <p className="text-gray-600">Upload Excel or CSV template files</p>
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
                    <div className="mt-4 p-3 bg-blue-50 rounded-md">
                      <p className="text-blue-600 text-sm">{uploadProgress}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Templates List */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">My Templates</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    Templates you can allocate to your classes
                  </p>
                </div>

                {templatesLoading ? (
                  <div className="text-center py-12">
                    <div className="w-8 h-8 border-t-2 border-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading templates...</p>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-12">
                    <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Templates</h3>
                    <p className="text-gray-500">Upload your first template to get started</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {templates.map((template) => (
                      <div key={template.id} className="p-6 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start space-x-3">
                            <FileSpreadsheet className="h-6 w-6 text-blue-600 mt-1" />
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">
                                {template.name}
                              </h4>
                              <p className="text-sm text-gray-500 mt-1">
                                {template.description}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                File: {template.fileName}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => downloadTemplate(template)}
                              className="p-2 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50"
                              title="Download template"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => router.push(`/teacher/sheets/allocate?templateId=${template.id}`)}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                              Allocate to Class
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}
