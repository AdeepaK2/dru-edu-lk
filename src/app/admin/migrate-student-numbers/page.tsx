'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';

/**
 * Migration Tool to Assign Student Numbers to Existing Students
 * 
 * This is a one-time migration tool that should be run by administrators
 * to assign student numbers to students who were created before the
 * student number feature was implemented.
 * 
 * Usage:
 * 1. Navigate to this page as an admin
 * 2. Click "Start Migration"
 * 3. Wait for completion
 * 4. Review the log
 * 
 * Note: This component can be safely deleted after migration is complete.
 */
export default function StudentNumberMigrationPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const runMigration = async () => {
    try {
      setIsRunning(true);
      setStatus('running');
      setLogs([]);
      addLog('🚀 Starting migration...');

      // Step 1: Initialize counter
      addLog('📊 Initializing counter...');
      const initResponse = await fetch('/api/admin/migrate-student-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' })
      });

      if (!initResponse.ok) {
        throw new Error('Failed to initialize counter');
      }

      addLog('✅ Counter initialized successfully');

      // Step 2: Get all students without student numbers
      addLog('🔍 Fetching students without student numbers...');
      const studentsResponse = await fetch('/api/admin/migrate-student-numbers?action=list');
      
      if (!studentsResponse.ok) {
        throw new Error('Failed to fetch students');
      }

      const { students } = await studentsResponse.json();
      const studentsNeedingNumbers = students.filter((s: any) => !s.studentNumber);
      
      setTotal(studentsNeedingNumbers.length);
      addLog(`📋 Found ${studentsNeedingNumbers.length} students needing student numbers`);

      if (studentsNeedingNumbers.length === 0) {
        addLog('✅ All students already have student numbers!');
        setStatus('complete');
        setIsRunning(false);
        return;
      }

      // Step 3: Assign numbers one by one
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < studentsNeedingNumbers.length; i++) {
        const student = studentsNeedingNumbers[i];
        try {
          const assignResponse = await fetch('/api/admin/migrate-student-numbers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'assign',
              studentId: student.id
            })
          });

          if (assignResponse.ok) {
            const { studentNumber } = await assignResponse.json();
            addLog(`✅ Assigned ${studentNumber} to ${student.name}`);
            successCount++;
          } else {
            addLog(`❌ Failed to assign number to ${student.name}`);
            failCount++;
          }
        } catch (error) {
          addLog(`❌ Error assigning number to ${student.name}: ${error}`);
          failCount++;
        }

        setProgress(i + 1);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Summary
      addLog('');
      addLog('═══════════════════════════════════');
      addLog('📊 Migration Complete!');
      addLog(`✅ Successfully assigned: ${successCount}`);
      if (failCount > 0) {
        addLog(`❌ Failed: ${failCount}`);
      }
      addLog('═══════════════════════════════════');

      setStatus(failCount === 0 ? 'complete' : 'error');
    } catch (error) {
      addLog(`❌ Fatal error: ${error}`);
      setStatus('error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Student Number Migration Tool
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Assign student numbers (ST0001, ST0002, etc.) to existing students who don't have one yet.
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Migration Status
            </h2>
            {status === 'idle' && (
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium">
                Ready
              </span>
            )}
            {status === 'running' && (
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium flex items-center">
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Running
              </span>
            )}
            {status === 'complete' && (
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-sm font-medium flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                Complete
              </span>
            )}
            {status === 'error' && (
              <span className="px-3 py-1 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-full text-sm font-medium flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Error
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {total > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Progress</span>
                <span>{progress} / {total}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          <Button
            onClick={runMigration}
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Migration Running...
              </>
            ) : status === 'complete' ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Run Migration Again
              </>
            ) : (
              'Start Migration'
            )}
          </Button>
        </div>

        {/* Log Console */}
        {logs.length > 0 && (
          <div className="bg-gray-900 rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Migration Log
            </h2>
            <div className="bg-black rounded p-4 font-mono text-sm text-green-400 h-96 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Information Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-6">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
            ℹ️ Important Information
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
            <li>• This migration only affects students without a student number</li>
            <li>• Students who already have numbers will be skipped</li>
            <li>• Student numbers are assigned sequentially (ST0001, ST0002, etc.)</li>
            <li>• The migration can be run multiple times safely</li>
            <li>• Existing Firebase IDs remain unchanged and continue to work</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
