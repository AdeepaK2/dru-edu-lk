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
import { 
  HomeworkFirestoreService, 
  HomeworkDocument,
  HomeworkSubmissionDocument 
} from '@/apiservices/homeworkFirestoreService';
import CreateHomeworkModal from '@/components/modals/CreateHomeworkModal';
import MarkHomeworkModal from '@/components/modals/MarkHomeworkModal';

interface HomeworkTabProps {
  classData: ClassDocument | null;
  classId: string;
}

const HomeworkTab: React.FC<HomeworkTabProps> = ({ classData, classId }) => {
  const [homeworks, setHomeworks] = useState<HomeworkDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState<HomeworkDocument | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('active');
  const [submissionStats, setSubmissionStats] = useState<{[key: string]: {
    total: number;
    submitted: number;
    notSubmitted: number;
    late: number;
  }}>({});

  useEffect(() => {
    if (classId) {
      loadHomeworks();
    }
  }, [classId]);

  const loadHomeworks = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await HomeworkFirestoreService.getHomeworkByClassId(classId);
      setHomeworks(data);
      
      // Load submission stats for each homework
      const stats: {[key: string]: any} = {};
      for (const hw of data) {
        try {
          const hwStats = await HomeworkFirestoreService.getSubmissionStats(hw.id);
          stats[hw.id] = hwStats;
        } catch (e) {
          stats[hw.id] = { total: 0, submitted: 0, notSubmitted: 0, late: 0 };
        }
      }
      setSubmissionStats(stats);
    } catch (err) {
      console.error('Error loading homework:', err);
      setError('Failed to load homework assignments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateHomework = () => {
    setSelectedHomework(null);
    setShowCreateModal(true);
  };

  const handleEditHomework = (homework: HomeworkDocument) => {
    setSelectedHomework(homework);
    setShowCreateModal(true);
  };

  const handleMarkHomework = (homework: HomeworkDocument) => {
    setSelectedHomework(homework);
    setShowMarkModal(true);
  };

  const handleDeleteHomework = async (homeworkId: string) => {
    if (!confirm('Are you sure you want to delete this homework?')) return;
    
    try {
      await HomeworkFirestoreService.deleteHomework(homeworkId);
      await loadHomeworks();
    } catch (err) {
      console.error('Error deleting homework:', err);
      alert('Failed to delete homework');
    }
  };

  const handleCloseHomework = async (homeworkId: string) => {
    try {
      await HomeworkFirestoreService.closeHomework(homeworkId);
      await loadHomeworks();
    } catch (err) {
      console.error('Error closing homework:', err);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isOverdue = (dueDate: Date): boolean => {
    return new Date() > dueDate;
  };

  const filteredHomeworks = homeworks.filter(hw => {
    if (filter === 'all') return true;
    return hw.status === filter;
  });

  const getStatusBadge = (homework: HomeworkDocument) => {
    if (homework.status === 'closed') {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
          Closed
        </span>
      );
    }
    if (isOverdue(homework.dueDate)) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-600">
          Overdue
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
        <span className="ml-3 text-gray-600">Loading homework...</span>
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
            Create and manage homework for {classData?.name || 'this class'}
          </p>
        </div>
        <button
          onClick={handleCreateHomework}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Homework
        </button>
      </div>

      {/* Filter Tabs */}
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
            {filterOption === 'active' && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                {homeworks.filter(hw => hw.status === 'active').length}
              </span>
            )}
            {filterOption === 'closed' && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                {homeworks.filter(hw => hw.status === 'closed').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {filteredHomeworks.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Homework Assignments</h3>
          <p className="text-gray-500 mb-4">
            {filter === 'all' 
              ? "Create your first homework assignment to get started."
              : `No ${filter} homework assignments found.`}
          </p>
          {filter === 'all' && (
            <button
              onClick={handleCreateHomework}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Homework
            </button>
          )}
        </div>
      )}

      {/* Homework List */}
      <div className="space-y-4">
        {filteredHomeworks.map((homework) => {
          const stats = submissionStats[homework.id] || { total: 0, submitted: 0, notSubmitted: 0, late: 0 };
          
          return (
            <div
              key={homework.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{homework.title}</h3>
                    {getStatusBadge(homework)}
                  </div>
                  
                  {homework.description && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">{homework.description}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Due: {formatDate(homework.dueDate)}</span>
                    </div>
                    {homework.maxMarks && (
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>Max Marks: {homework.maxMarks}</span>
                      </div>
                    )}
                  </div>

                  {/* Submission Stats */}
                  {stats.total > 0 && (
                    <div className="flex items-center gap-4 mt-3 text-sm">
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>{stats.submitted} submitted</span>
                      </div>
                      <div className="flex items-center gap-1 text-red-600">
                        <XCircle className="w-4 h-4" />
                        <span>{stats.notSubmitted} missing</span>
                      </div>
                      {stats.late > 0 && (
                        <div className="flex items-center gap-1 text-amber-600">
                          <Clock className="w-4 h-4" />
                          <span>{stats.late} late</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleMarkHomework(homework)}
                    className="inline-flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-600 text-sm font-medium rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    <Users className="w-4 h-4 mr-1" />
                    Mark
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                  <button
                    onClick={() => handleEditHomework(homework)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteHomework(homework.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <CreateHomeworkModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedHomework(null);
          }}
          onSave={async () => {
            await loadHomeworks();
            setShowCreateModal(false);
            setSelectedHomework(null);
          }}
          classId={classId}
          homework={selectedHomework}
        />
      )}

      {/* Mark Submissions Modal */}
      {showMarkModal && selectedHomework && (
        <MarkHomeworkModal
          isOpen={showMarkModal}
          onClose={() => {
            setShowMarkModal(false);
            setSelectedHomework(null);
          }}
          onSave={async () => {
            await loadHomeworks();
            setShowMarkModal(false);
            setSelectedHomework(null);
          }}
          homework={selectedHomework}
          classId={classId}
        />
      )}
    </div>
  );
};

export default HomeworkTab;
