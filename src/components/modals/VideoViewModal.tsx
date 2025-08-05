'use client';

import React from 'react';
import { X, Eye, Users, Calendar, Play, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui';
import { VideoDisplayData } from '@/models/videoSchema';

interface VideoViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoDisplayData | null;
}

export default function VideoViewModal({
  isOpen,
  onClose,
  video
}: VideoViewModalProps) {
  if (!isOpen || !video) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Play className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {video.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Video Preview
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Video Player */}
          <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
            {video.videoUrl.includes('youtube.com/embed/') ? (
              // YouTube embed
              <iframe
                src={video.videoUrl}
                title={video.title}
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              // Regular video file
              <video
                src={video.videoUrl}
                poster={video.thumbnailUrl || undefined}
                controls
                className="w-full h-full object-cover"
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          {/* Video Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Basic Info */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Description
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {video.description}
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Details
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>Subject: {video.subjectName}</span>
                  </div>
                  {video.lessonName && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <BookOpen className="w-4 h-4 mr-2" />
                      <span>Lesson: {video.lessonName}</span>
                    </div>
                  )}
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Users className="w-4 h-4 mr-2" />
                    <span>Classes: {video.assignedClassNames?.join(', ') || 'No classes assigned'}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Eye className="w-4 h-4 mr-2" />
                    <span>{video.views} Views</span>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {video.tags && video.tags.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {video.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Status & Visibility */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Status & Visibility
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      video.status === 'active' 
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : video.status === 'processing'
                        ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                        : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                    }`}>
                      {video.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Visibility:</span>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      video.visibility === 'public' 
                        ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                        : video.visibility === 'unlisted'
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        : 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
                    }`}>
                      {video.visibility}
                    </span>
                  </div>
                  {video.price !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Price:</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {video.price === 0 ? 'Free' : `$${video.price.toFixed(2)}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Video Information
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Video ID:</span>
                    <span className="text-sm font-mono text-gray-900 dark:text-white">
                      {video.videoId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Created:</span>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {video.createdAt ? new Date(video.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
