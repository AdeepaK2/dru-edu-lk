'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  Trash2,
  Users,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { ClassDocument } from '@/models/classSchema';
import * as StudyMaterialFirestoreService from '@/apiservices/studyMaterialFirestoreService';
import { COLLECTION_NAME as STUDY_MAT_COLLECTION_NAME } from '@/apiservices/studyMaterialFirestoreService';
import { StudyMaterialDocument } from '@/models/studyMaterialSchema';
import Link from 'next/link';
import StudyMaterialUploadModal from '@/components/modals/StudyMaterialUploadModal';
import CreateHomeworkModal from '@/components/modals/CreateHomeworkModal';
import MarkHomeworkModal from '@/components/modals/MarkHomeworkModal';
import { 
  HomeworkFirestoreService, 
  HomeworkDocument,
  HomeworkSubmissionDocument 
} from '@/apiservices/homeworkFirestoreService';

interface HomeworkTabProps {
  classData: ClassDocument | null;
  classId: string;
}

interface DisplayHomework {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  status: 'active' | 'closed';
  maxMarks?: number;
  type: 'homework' | 'study_material';
  originalDoc: HomeworkDocument | StudyMaterialDocument;
  collectionName: 'homework' | 'studyMaterials';
  submissionType: 'manual' | 'online';
  allowLateSubmission?: boolean;
  lateSubmissionDays?: number;
}

const getClosingDate = (item: DisplayHomework) => {
  if (item.status === 'closed') return new Date(0); // Already closed
  
  let closeDate = new Date(item.dueDate);
  if (item.allowLateSubmission && item.lateSubmissionDays) {
    closeDate.setDate(closeDate.getDate() + item.lateSubmissionDays);
  }
  return closeDate;
};

const isActuallyClosed = (item: DisplayHomework) => {
  if (item.status === 'closed') return true;
  const closeDate = getClosingDate(item);
  return new Date() > closeDate;
};

const isOverdue = (date: Date) => {
  return new Date() > date;
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
};

const HomeworkTab: React.FC<HomeworkTabProps> = ({ classData, classId }) => {
  const [displayItems, setDisplayItems] = useState<DisplayHomework[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals
  const [showCreateLegacyModal, setShowCreateLegacyModal] = useState(false);
  const [showStudyMaterialModal, setShowStudyMaterialModal] = useState(false);
  const [showMarkModal, setShowMarkModal] = useState(false);
  
  const [selectedItem, setSelectedItem] = useState<DisplayHomework | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('active');
  const [submissionStats, setSubmissionStats] = useState<{[key: string]: {
    total: number;
    submitted: number;
    notSubmitted: number;
    late: number;
  }}>({});

  useEffect(() => {
    if (classId) {
      loadData();
    }
  }, [classId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // 1. Fetch Legacy Homeworks
      const homeworks = await HomeworkFirestoreService.getHomeworkByClassId(classId);
      
      // 2. Fetch Study Materials (all, then filter)
      const studyMaterials = await StudyMaterialFirestoreService.getStudyMaterialsByClass(classId);
      const homeworkMaterials = studyMaterials.filter(m => m.isHomework);

      // 3. Normalize & Merge
      const merged: DisplayHomework[] = [
        ...homeworks.map(h => ({
          id: h.id,
          title: h.title,
          description: h.description,
          dueDate: h.dueDate,
          status: h.status,
          maxMarks: h.maxMarks,
          type: 'homework' as const,
          originalDoc: h,
          collectionName: 'homework' as const,
          submissionType: 'online' as const,
          allowLateSubmission: false, // Legacy defaults
          lateSubmissionDays: 0
        })),
        ...homeworkMaterials.map(m => ({
          id: m.id,
          title: m.title || m.groupTitle || 'Untitled Homework',
          description: m.description,
          dueDate: m.dueDate ? (m.dueDate instanceof Date ? m.dueDate : m.dueDate.toDate()) : new Date(),
          status: ((m.dueDate && new Date() > (m.dueDate instanceof Date ? m.dueDate : m.dueDate.toDate())) ? 'closed' : 'active') as 'active' | 'closed', // This derived status might be overridden by dynamic check
          maxMarks: m.maxMarks,
          type: 'study_material' as const,
          originalDoc: m,
          collectionName: 'studyMaterials' as const,
          submissionType: (m.homeworkType === 'manual' ? 'manual' : 'online') as 'manual' | 'online',
          allowLateSubmission: m.allowLateSubmission,
          lateSubmissionDays: m.lateSubmissionDays
        }))
      ];

      // Sort by Due Date (ascending - earliest first)
      merged.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

      setDisplayItems(merged);
      
      // 4. Load Stats
      const stats: {[key: string]: any} = {};
      
      // Batch stats fetching
      await Promise.all(merged.map(async (item) => {
        try {
          const itemStats = await HomeworkFirestoreService.getSubmissionStats(item.id, item.collectionName);
          stats[item.id] = itemStats;
        } catch (e) {
          console.warn(`Failed to load stats for ${item.id}`, e);
          stats[item.id] = { total: 0, submitted: 0, notSubmitted: 0, late: 0 };
        }
      }));
      
      setSubmissionStats(stats);

    } catch (err) {
      console.error('Error loading homework data:', err);
      setError('Failed to load homework assignments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedItem(null);
    setShowStudyMaterialModal(true); // Prefer Study Material flow
  };

  const handleEdit = (item: DisplayHomework) => {
    setSelectedItem(item);
    if (item.type === 'homework') {
      setShowCreateLegacyModal(true);
    } else {
      setShowStudyMaterialModal(true);
    }
  };

  const handleMark = (item: DisplayHomework) => {
    setSelectedItem(item);
    setShowMarkModal(true);
  };

  const handleDelete = async (item: DisplayHomework) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    
    try {
      if (item.type === 'homework') {
        await HomeworkFirestoreService.deleteHomework(item.id);
      } else {
        await StudyMaterialFirestoreService.deleteStudyMaterial(item.id);
      }
      loadData();
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Failed to delete assignment');
    }
  };

  // ... (formatDate, isOverdue helpers unchanged) ...

  const filteredItems = displayItems.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'active') return !isActuallyClosed(item);
    if (filter === 'closed') return isActuallyClosed(item);
    return true;
  });

  // ... (getStatusBadge unchanged - logic updated to use item) ...

   // Update getStatusBadge to accept DisplayHomework
  const getStatusBadge = (item: DisplayHomework) => {
    if (isActuallyClosed(item)) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
          Closed
        </span>
      );
    }
    if (isOverdue(item.dueDate)) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-600">
          Late Submission
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-600">
        Active
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Loading assignments...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Homework Assignments</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage homework and assignments for {classData?.name}
          </p>
        </div>
      </div>

      {/* Filter Tabs - Logic updated for local filtering */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['active', 'closed', 'all'] as const).map((filterOption) => (
          <button
            key={filterOption}
            onClick={() => setFilter(filterOption)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === filterOption
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
             {/* Counts logic */}
             {filterOption === 'active' && <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded-full">{displayItems.filter(i => !isActuallyClosed(i)).length}</span>}
             {filterOption === 'closed' && <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded-full">{displayItems.filter(i => isActuallyClosed(i)).length}</span>}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Assignments found</h3>
          <p className="text-gray-500 mb-4">
             {filter === 'all' ? "No assignments found." : `No ${filter} assignments.`}
          </p>
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
        {filteredItems.map((item) => {
          const stats = submissionStats[item.id] || { total: 0, submitted: 0, notSubmitted: 0, late: 0 };
          return (
            <div 
                key={item.id} 
                onClick={() => handleMark(item)} // Row click opens mark modal
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{item.title}</h3>
                    {getStatusBadge(item)}
                    {item.type === 'study_material' && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-600">Material</span>
                    )}
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.submissionType === 'manual' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                        {item.submissionType === 'manual' ? 'Manual' : 'Online'}
                    </span>
                  </div>
                  
                  {item.description && <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p>}
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Due: {formatDate(item.dueDate)}</span>
                      {isOverdue(item.dueDate) && !isActuallyClosed(item) && (
                           <span className="text-xs text-amber-600 font-medium">(Late allowed until {formatDate(getClosingDate(item))})</span>
                      )}
                    </div>
                    {item.maxMarks && (
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>Max Marks: {item.maxMarks}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-3 text-sm">
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" /> <span>{stats.submitted} submitted</span>
                      </div>
                      <div className="flex items-center gap-1 text-red-600">
                        <XCircle className="w-4 h-4" /> <span>{stats.notSubmitted} missing</span>
                      </div>
                      {stats.late > 0 && <div className="flex items-center gap-1 text-amber-600"><Clock className="w-4 h-4" /><span>{stats.late} late</span></div>}
                  </div>
                </div>

                {/* Actions - stopPropagation to prevent double trigger */}
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={(e) => { e.stopPropagation(); handleMark(item); }} className="inline-flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-600 text-sm font-medium rounded-lg hover:bg-indigo-100 transition-colors">
                    <Users className="w-4 h-4 mr-1" /> Mark <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(item); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legacy Modal */}
      {showCreateLegacyModal && (
        <CreateHomeworkModal
          isOpen={showCreateLegacyModal}
          onClose={() => {
            setShowCreateLegacyModal(false);
            setSelectedItem(null);
          }}
          onSave={async () => {
            await loadData();
            setShowCreateLegacyModal(false);
            setSelectedItem(null);
          }}
          classId={classId}
          homework={selectedItem?.type === 'homework' ? (selectedItem.originalDoc as HomeworkDocument) : null}
        />
      )}

      {/* Study Material Modal (New Homework) */}
      {showStudyMaterialModal && (
        <StudyMaterialUploadModal
            isOpen={showStudyMaterialModal}
            onClose={() => {
                setShowStudyMaterialModal(false);
                setSelectedItem(null);
            }}
            onSuccess={async () => {
                await loadData();
                setShowStudyMaterialModal(false);
                setSelectedItem(null);
            }}
            classData={classData || undefined}
            initialMaterial={selectedItem?.type === 'study_material' ? (selectedItem.originalDoc as StudyMaterialDocument) : undefined}
        />
      )}

      {/* Mark Modal */}
      {showMarkModal && selectedItem && (
        <MarkHomeworkModal
          isOpen={showMarkModal}
          onClose={() => {
            setShowMarkModal(false);
            setSelectedItem(null);
          }}
          onSave={async () => {
             await loadData();
             setShowMarkModal(false);
             setSelectedItem(null);
          }}
          homework={{ 
              id: selectedItem.id, 
              title: selectedItem.title, 
              maxMarks: selectedItem.maxMarks 
          }}
          classId={classId}
          collectionName={selectedItem.collectionName}
          submissionType={selectedItem.submissionType}
        />
      )}
    </div>
  );
};

export default HomeworkTab;
