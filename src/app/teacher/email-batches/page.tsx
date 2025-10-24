'use client';

import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Search, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  Download,
  AlertCircle
} from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';
import { MailBatchService } from '@/apiservices/mailBatchService';
import { MailBatchDocumentFirestore } from '@/models/mailBatchSchema';
import MailBatchDetailsModal from '@/components/modals/MailBatchDetailsModal';

export default function EmailBatchesPage() {
  const { teacher, loading: authLoading } = useTeacherAuth();
  const [batches, setBatches] = useState<MailBatchDocumentFirestore[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<MailBatchDocumentFirestore | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    if (teacher?.id) {
      loadBatches();
    }
  }, [teacher?.id]);

  const loadBatches = async () => {
    if (!teacher?.id) return;
    
    try {
      setLoading(true);
      const batchesData = await MailBatchService.getBatchesByCreator(teacher.id);
      setBatches(batchesData);
    } catch (error) {
      console.error('Error loading email batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (batch: MailBatchDocumentFirestore) => {
    setSelectedBatch(batch);
    setShowDetailsModal(true);
  };

  const handleCloseDetails = () => {
    setShowDetailsModal(false);
    setSelectedBatch(null);
  };

  const handleRetryFailed = async () => {
    // Reload batches after retry
    await loadBatches();
    handleCloseDetails();
  };

  // Filter batches
  const filteredBatches = batches.filter(batch => {
    const matchesSearch = searchTerm === '' || 
      batch.batchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || batch.batchType === filterType;
    
    return matchesSearch && matchesType;
  });

  const getBatchStatusColor = (status: MailBatchDocumentFirestore['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
      case 'failed':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
      case 'partially_failed':
        return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20';
      case 'processing':
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getBatchTypeLabel = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getStatusIcon = (status: MailBatchDocumentFirestore['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5" />;
      case 'failed':
        return <XCircle className="w-5 h-5" />;
      case 'partially_failed':
        return <AlertCircle className="w-5 h-5" />;
      case 'processing':
        return <Clock className="w-5 h-5" />;
      default:
        return <Mail className="w-5 h-5" />;
    }
  };

  // Calculate statistics
  const stats = {
    total: batches.length,
    completed: batches.filter(b => b.status === 'completed').length,
    failed: batches.filter(b => b.status === 'failed').length,
    partiallyFailed: batches.filter(b => b.status === 'partially_failed').length,
    processing: batches.filter(b => b.status === 'processing').length,
    totalEmailsSent: batches.reduce((sum, b) => sum + b.successCount, 0),
    totalEmailsFailed: batches.reduce((sum, b) => sum + b.failedCount, 0)
  };

  const successRate = stats.totalEmailsSent + stats.totalEmailsFailed > 0
    ? ((stats.totalEmailsSent / (stats.totalEmailsSent + stats.totalEmailsFailed)) * 100).toFixed(1)
    : '0';

  if (authLoading || loading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 border-t-4 border-blue-600 border-solid rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">Loading email batches...</p>
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Email Batches
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Track and manage bulk email notifications sent to students and parents
              </p>
            </div>
            <button
              onClick={loadBatches}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Total Batches</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.total}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Completed</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.completed}</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Failed</div>
              <div className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.failed}</div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
              <div className="text-xs text-orange-600 dark:text-orange-400 font-medium mb-1">Partial</div>
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{stats.partiallyFailed}</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium mb-1">Processing</div>
              <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{stats.processing}</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">Total Sent</div>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{stats.totalEmailsSent}</div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
              <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-1">Success Rate</div>
              <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{successRate}%</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name or subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="test_notification">Test Notifications</option>
              <option value="class_cancellation">Class Cancellations</option>
              <option value="class_schedule">Class Schedules</option>
              <option value="document_reminder">Document Reminders</option>
              <option value="test_extension">Test Extensions</option>
              <option value="absence_notification">Absence Notifications</option>
              <option value="meeting_confirmation">Meeting Confirmations</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Batches List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {filteredBatches.length === 0 ? (
            <div className="p-12 text-center">
              <Mail className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No email batches found
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchTerm || filterType !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Email batches will appear here when you send bulk notifications'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredBatches.map((batch) => {
                const successRate = batch.totalRecipients > 0
                  ? ((batch.successCount / batch.totalRecipients) * 100).toFixed(0)
                  : '0';

                return (
                  <div
                    key={batch.id}
                    className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={`p-2 rounded-lg ${getBatchStatusColor(batch.status)}`}>
                            {getStatusIcon(batch.status)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                              {batch.batchName}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                              {batch.subject}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBatchStatusColor(batch.status)}`}>
                            {batch.status.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {getBatchTypeLabel(batch.batchType)}
                          </span>
                          <span className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <Calendar className="w-3 h-3 mr-1" />
                            {new Date(batch.createdAt.toMillis()).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
                            <span>Delivery Progress</span>
                            <span className="font-medium">{successRate}% Success</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${successRate}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <span className="flex items-center">
                              <CheckCircle className="w-3 h-3 mr-1 text-green-600 dark:text-green-400" />
                              {batch.successCount} sent
                            </span>
                            <span className="flex items-center">
                              <XCircle className="w-3 h-3 mr-1 text-red-600 dark:text-red-400" />
                              {batch.failedCount} failed
                            </span>
                            {batch.pendingCount > 0 && (
                              <span className="flex items-center">
                                <Clock className="w-3 h-3 mr-1 text-yellow-600 dark:text-yellow-400" />
                                {batch.pendingCount} pending
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="ml-4 flex flex-col space-y-2">
                        <button
                          onClick={() => handleViewDetails(batch)}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      <MailBatchDetailsModal
        isOpen={showDetailsModal}
        onClose={handleCloseDetails}
        batch={selectedBatch}
        onRetryFailed={handleRetryFailed}
      />
    </TeacherLayout>
  );
}
