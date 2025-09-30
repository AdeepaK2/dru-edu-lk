'use client';

import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  TrendingUp,
  Calendar,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui';
import BackgroundSubmissionMonitor from '@/components/BackgroundSubmissionMonitor';

interface BackgroundSubmissionReport {
  totalExpired: number;
  byTestType: {
    live: number;
    flexible: number;
  };
  oldestExpired?: string;
}

interface ProcessResults {
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
}

export default function BackgroundSubmissionPage() {
  const [report, setReport] = useState<BackgroundSubmissionReport | null>(null);
  const [lastProcessResults, setLastProcessResults] = useState<ProcessResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load report on component mount
  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/background/submissions');
      const data = await response.json();

      if (data.success) {
        setReport(data.report);
        setLastUpdated(new Date());
      } else {
        setError(data.error || 'Failed to load report');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const processExpiredSubmissions = async () => {
    try {
      setProcessing(true);
      setError(null);

      // Use POST for manual processing (admin interface)
      const response = await fetch('/api/background/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: Admin manual processing doesn't use the cron secret
        }
      });

      const data = await response.json();

      if (data.success) {
        setLastProcessResults(data.results);
        setReport(data.report);
        setLastUpdated(new Date());
      } else {
        setError(data.error || 'Failed to process submissions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process submissions');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Background Submission Monitor
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Monitor and process expired test attempts that need automatic submission
            </p>
          </div>
          <div className="flex space-x-3">
            <Button
              onClick={loadReport}
              disabled={loading}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Button
              onClick={processExpiredSubmissions}
              disabled={processing}
              size="sm"
              className="flex items-center space-x-2"
            >
              <TrendingUp className={`w-4 h-4 ${processing ? 'animate-pulse' : ''}`} />
              <span>{processing ? 'Processing...' : 'Process Expired'}</span>
            </Button>
          </div>
        </div>
        
        {lastUpdated && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Current Status */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Total Expired Attempts
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {report.totalExpired}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Live Tests
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {report.byTestType.live}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-8 w-8 text-green-500" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Flexible Tests
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {report.byTestType.flexible}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Oldest Expired */}
      {report?.oldestExpired && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Oldest Expired Attempt
              </h3>
              <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                The oldest expired attempt was started on: {new Date(report.oldestExpired).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Last Processing Results */}
      {lastProcessResults && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Last Processing Results
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {lastProcessResults.processed}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Processed</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {lastProcessResults.successful}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">Successful</div>
            </div>
            
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {lastProcessResults.failed}
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">Failed</div>
            </div>
          </div>

          {lastProcessResults.errors.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Errors:</h3>
              <div className="space-y-1">
                {lastProcessResults.errors.map((error, index) => (
                  <div key={index} className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
        <div className="flex">
          <CheckCircle className="h-5 w-5 text-blue-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Background Submission Info
            </h3>
            <div className="mt-1 text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p>• Expired attempts are automatically processed when students log in</p>
              <p>• Use "Process Expired" to manually trigger processing for all expired attempts</p>
              <p>• This system ensures no student loses their work due to time expiration</p>
              <p>• For production, set up a cron job to call the API endpoint regularly</p>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Monitor */}
      <div className="mt-8">
        <BackgroundSubmissionMonitor />
      </div>
    </div>
  );
}