'use client';

import React from 'react';
import { MessageCircle, Clock, Lock } from 'lucide-react';
import TeacherLayout from '@/components/teacher/TeacherLayout';

// TODO: Re-enable chat functionality after mobile app production launch
// Original chat implementation has been temporarily disabled

export default function TeacherChatPage() {
  return (
    <TeacherLayout>
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          {/* Lock Icon */}
          <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-indigo-400" />
          </div>
          
          {/* Main Message */}
          <h1 className="text-2xl font-bold text-gray-700 mb-2">
            Chat Coming Soon
          </h1>
          
          <p className="text-gray-500 mb-6 max-w-md">
            This feature is currently under development. We&apos;re working on bringing you a seamless messaging experience with parents.
          </p>
          
          {/* Coming Soon Badge */}
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">Expected Launch: Q1 2025</span>
          </div>
          
          {/* Feature Preview */}
          <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200 max-w-sm mx-auto">
            <MessageCircle className="w-8 h-8 text-indigo-500 mx-auto mb-3" />
            <h3 className="font-medium text-gray-700 mb-2">What to Expect</h3>
            <ul className="text-sm text-gray-500 text-left space-y-2">
              <li>• Real-time messaging with parents</li>
              <li>• Image and file sharing</li>
              <li>• Read receipts and notifications</li>
              <li>• Quick access from your dashboard</li>
            </ul>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
