'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  FileSpreadsheet,
  Upload,
  Users,
  Calendar,
  Edit,
  Trash2,
  Eye,
  Download,
  Share,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { GoogleSheetsService, SheetTemplate, SheetAllocation } from '@/apiservices/googleSheetsService';

export default function SheetManagementPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'templates' | 'allocations'>('templates');
  const [templates, setTemplates] = useState<SheetTemplate[]>([]);
  const [allocations, setAllocations] = useState<SheetAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Mock teacher ID - replace with actual teacher data
  const teacherId = 'teacher123';
  const teacherName = 'John Smith';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templatesData, allocationsData] = await Promise.all([
        GoogleSheetsService.getTeacherTemplates(teacherId),
        GoogleSheetsService.getTeacherAllocations(teacherId)
      ]);
      
      setTemplates(templatesData);
      setAllocations(allocationsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadLoading(true);
      
      // Validate file type
      const allowedTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        alert('Please upload an Excel (.xlsx, .xls) or CSV file');
        return;
      }

      // Create template name from filename
      const templateName = file.name.replace(/\.[^/.]+$/, '');
      
      // For now, we'll simulate uploading to public folder
      // In a real implementation, you'd upload to your file storage
      const filePath = `/templates/${Date.now()}_${file.name}`;
      
      const template = await GoogleSheetsService.createTemplate({
        name: templateName,
        fileName: file.name,
        filePath: filePath,
        teacherId: teacherId,
        description: `Uploaded template: ${templateName}`
      });

      setTemplates(prev => [template, ...prev]);
      alert('Template uploaded successfully!');
    } catch (error) {
      console.error('Error uploading template:', error);
      alert('Error uploading template. Please try again.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleAllocateSheet = (templateId: string) => {
    router.push(`/teacher/sheets/allocate?templateId=${templateId}`);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    let date: Date;
    if (timestamp && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-gray-300 dark:bg-gray-600 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Sheet Management
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Manage templates and allocate Google Sheets to students
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <label className="relative">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleTemplateUpload}
                  className="hidden"
                  disabled={uploadLoading}
                />
                <button
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    uploadLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={uploadLoading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadLoading ? 'Uploading...' : 'Upload Template'}
                </button>
              </label>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('templates')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'templates'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4 inline mr-2" />
                Templates ({templates.length})
              </button>
              <button
                onClick={() => setActiveTab('allocations')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'allocations'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Users className="h-4 w-4 inline mr-2" />
                Allocations ({allocations.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'templates' ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Template Library
              </h3>
              
              {templates.length === 0 ? (
                <div className="text-center py-12">
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Templates Yet
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Upload your first Excel or CSV template to get started
                  </p>
                  <label className="relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleTemplateUpload}
                      className="hidden"
                    />
                    <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Template
                    </button>
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {templates.map((template) => (
                    <div key={template.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                            {template.name}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {template.fileName}
                          </p>
                        </div>
                        <FileSpreadsheet className="h-8 w-8 text-green-500" />
                      </div>
                      
                      {template.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                          {template.description}
                        </p>
                      )}
                      
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        Created: {formatDate(template.createdAt)}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleAllocateSheet(template.id)}
                          className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                          <Share className="h-4 w-4 mr-1" />
                          Allocate
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Sheet Allocations
              </h3>
              
              {allocations.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Allocations Yet
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Start by uploading a template and allocating it to a class
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allocations.map((allocation) => (
                    <div key={allocation.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                              {allocation.title}
                            </h4>
                            {getStatusIcon(allocation.status)}
                            <span className={`text-sm font-medium capitalize ${
                              allocation.status === 'active' ? 'text-green-600' :
                              allocation.status === 'completed' ? 'text-blue-600' :
                              allocation.status === 'cancelled' ? 'text-red-600' :
                              'text-yellow-600'
                            }`}>
                              {allocation.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-300">
                            <div>
                              <span className="font-medium">Template:</span> {allocation.templateName}
                            </div>
                            <div>
                              <span className="font-medium">Class:</span> {allocation.className}
                            </div>
                            <div>
                              <span className="font-medium">Allocated:</span> {formatDate(allocation.allocatedAt)}
                            </div>
                            {allocation.dueDate && (
                              <div>
                                <span className="font-medium">Due:</span> {formatDate(allocation.dueDate)}
                              </div>
                            )}
                          </div>
                          
                          {allocation.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                              {allocation.description}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => router.push(`/teacher/sheets/view/${allocation.id}`)}
                            className="p-2 text-gray-400 hover:text-blue-600"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            className="p-2 text-gray-400 hover:text-green-600"
                            title="Download Reports"
                          >
                            <Download className="h-4 w-4" />
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
    </TeacherLayout>
  );
}