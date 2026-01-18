'use client';

import React from 'react';
import { MessageCircle, Clock } from 'lucide-react';

// TODO: Re-enable chat functionality after mobile app production launch
// The full chat implementation has been temporarily disabled.

export default function AdminChatPage() {
  return (
    <div className="h-[calc(100vh-80px)] flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
      <div className="text-center px-8">
        <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-6">
          <MessageCircle className="w-10 h-10 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Chat Coming Soon</h2>
        <p className="text-gray-500 max-w-md mx-auto mb-6">
          The admin chat feature is currently under development and will be available after the mobile app launches.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <Clock className="w-4 h-4" />
          <span>Expected: After Mobile App Launch</span>
        </div>
      </div>
    </div>
  );
}
