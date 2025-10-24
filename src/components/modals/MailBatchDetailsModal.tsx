'use client';

import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  Download,
  User,
  Users,
  AlertCircle
} from 'lucide-react';
import { MailBatchDocumentFirestore, EmailRecipient } from '@/models/mailBatchSchema';
import { MailBatchService } from '@/apiservices/mailBatchService';

interface MailBatchDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: MailBatchDocumentFirestore | null;
  onRetryFailed?: () => void;
}

export default function MailBatchDetailsModal({
  isOpen,
  onClose,
  batch,
  onRetryFailed
}: MailBatchDetailsModalProps) {
  const [retrying, setRetrying] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'failed' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen || !batch) return null;

  const handleRetry = async () => {
    if (!batch || !onRetryFailed) return;
    
    try {
      setRetrying(true);
      await MailBatchService.retryFailedEmails(batch.id);
      onRetryFailed();
      alert('Failed emails have been queued for retry');
    } catch (error) {
      console.error('Error retrying failed emails:', error);
      alert('Failed to retry emails. Please try again.');
    } finally {
      setRetrying(false);
    }
  };

  const handleExportCSV = () => {
    const csv = [
      ['Recipient Name', 'Email', 'Type', 'Status', 'Error', 'Sent At'].join(','),
      ...batch.recipients.map(r => [
        r.recipientName,
        r.recipientEmail,
        r.recipientType,
        r.status,
        r.error || '',
        r.sentAt ? new Date(r.sentAt.toMillis()).toLocaleString() : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-batch-${batch.id}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Filter recipients
  const filteredRecipients = batch.recipients.filter(r => {
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchesSearch = searchTerm === '' || 
      r.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.recipientEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.studentName && r.studentName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getStatusColor = (status: EmailRecipient['status']) => {
    switch (status) {
      case 'sent':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
      case 'failed':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
      case 'pending':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getStatusIcon = (status: EmailRecipient['status']) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      default:
        return <Mail className="w-4 h-4" />;
    }
  };

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

  const successRate = batch.totalRecipients > 0 
    ? ((batch.successCount / batch.totalRecipients) * 100).toFixed(1)
    : '0';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <Mail className="w-6 h-6" />
                <h2 className="text-2xl font-bold">Email Batch Details</h2>
              </div>
              <p className="text-blue-100 text-sm">{batch.batchName}</p>
              <p className="text-blue-200 text-xs mt-1">
                Created on {new Date(batch.createdAt.toMillis()).toLocaleString()} by {batch.createdByName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="text-xs text-blue-100 mb-1">Total</div>
              <div className="text-2xl font-bold">{batch.totalRecipients}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="text-xs text-green-100 mb-1">Sent</div>
              <div className="text-2xl font-bold text-green-300">{batch.successCount}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="text-xs text-red-100 mb-1">Failed</div>
              <div className="text-2xl font-bold text-red-300">{batch.failedCount}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="text-xs text-yellow-100 mb-1">Pending</div>
              <div className="text-2xl font-bold text-yellow-300">{batch.pendingCount}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="text-xs text-blue-100 mb-1">Success Rate</div>
              <div className="text-2xl font-bold">{successRate}%</div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="mt-4 flex items-center justify-between">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getBatchStatusColor(batch.status)}`}>
              {batch.status.replace('_', ' ').toUpperCase()}
            </span>
            {batch.failedCount > 0 && onRetryFailed && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg flex items-center space-x-2 text-sm font-medium transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                <span>{retrying ? 'Retrying...' : 'Retry Failed'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Controls */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
            {/* Search */}
            <input
              type="text"
              placeholder="Search recipients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            {/* Filters */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                All ({batch.totalRecipients})
              </button>
              <button
                onClick={() => setFilterStatus('sent')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'sent'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Sent ({batch.successCount})
              </button>
              <button
                onClick={() => setFilterStatus('failed')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'failed'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Failed ({batch.failedCount})
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === 'pending'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Pending ({batch.pendingCount})
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm font-medium flex items-center space-x-1 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Recipients List */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Recipient
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Attempts
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Sent At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredRecipients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No recipients found
                      </td>
                    </tr>
                  ) : (
                    filteredRecipients.map((recipient, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${recipient.recipientType === 'student' ? 'bg-blue-100 dark:bg-blue-900/20' : 'bg-purple-100 dark:bg-purple-900/20'}`}>
                              {recipient.recipientType === 'student' ? (
                                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              ) : (
                                <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {recipient.recipientName}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {recipient.recipientEmail}
                              </div>
                              {recipient.studentName && recipient.recipientType === 'parent' && (
                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                  Parent of {recipient.studentName}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            recipient.recipientType === 'student' 
                              ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                          }`}>
                            {recipient.recipientType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col space-y-1">
                            <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(recipient.status)}`}>
                              {getStatusIcon(recipient.status)}
                              <span>{recipient.status}</span>
                            </span>
                            {recipient.error && (
                              <div className="flex items-start space-x-1 text-xs text-red-600 dark:text-red-400 mt-1">
                                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <span className="break-all">{recipient.error}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {recipient.attemptCount || 0}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {recipient.sentAt 
                            ? new Date(recipient.sentAt.toMillis()).toLocaleString()
                            : '-'
                          }
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Metadata */}
          {batch.metadata && Object.keys(batch.metadata).length > 0 && (
            <div className="mt-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Additional Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(batch.metadata).map(([key, value]) => (
                  <div key={key}>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </div>
                    <div className="text-sm text-gray-900 dark:text-white font-medium">
                      {Array.isArray(value) ? value.join(', ') : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredRecipients.length} of {batch.totalRecipients} recipients
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
