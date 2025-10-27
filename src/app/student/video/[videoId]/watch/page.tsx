'use client';

import React, { useState, useEffect, use } from 'react';
import { 
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  Book,
  Users,
  Clock,
  Eye,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';

// Import services and types
import { VideoFirestoreService } from '@/apiservices/videoFirestoreService';
import { VideoPurchaseService } from '@/apiservices/videoPurchaseService';
import { VideoDocument } from '@/models/videoSchema';
import { VideoPurchaseDocument } from '@/models/videoPurchaseSchema';

interface VideoWatchPageProps {
  params: Promise<{
    videoId: string;
  }>;
}

export default function VideoWatchPage({ params }: VideoWatchPageProps) {
  const { videoId } = use(params);
  const { student } = useStudentAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const [video, setVideo] = useState<VideoDocument | null>(null);
  const [purchase, setPurchase] = useState<VideoPurchaseDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [viewRecorded, setViewRecorded] = useState(false);

  useEffect(() => {
    const loadVideoAndAccess = async () => {
      if (!videoId || !student?.id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Load video data
        const videoData = await VideoFirestoreService.getVideoById(videoId);
        
        if (!videoData) {
          setError('Video not found');
          return;
        }
        
        setVideo(videoData);
        
        // Check access permissions
        let canAccess = false;
        let purchaseData: VideoPurchaseDocument | null = null;
        
        // Check if video is free
        if (!videoData.price || videoData.price <= 0) {
          canAccess = true;
        } else {
          // Check if student has purchased the video
          purchaseData = await VideoPurchaseService.hasStudentPurchased(
            student.id, 
            videoId
          );
          
          if (purchaseData) {
            canAccess = true;
            setPurchase(purchaseData);
          }
        }
        
        // Check if video is public
        if (videoData.visibility === 'public') {
          canAccess = true;
        }
        
        setHasAccess(canAccess);
        
        if (!canAccess) {
          setError('You do not have access to this video. Please purchase it to watch.');
          return;
        }
        
        // Record view access if purchased
        if (purchaseData && !viewRecorded) {
          await VideoPurchaseService.recordVideoAccess(purchaseData.id);
          setViewRecorded(true);
        }
        
        // Increment general view count
        await VideoFirestoreService.incrementViewCount(videoId);
        
      } catch (err: any) {
        console.error('Error loading video:', err);
        setError(err.message || 'Failed to load video');
      } finally {
        setLoading(false);
      }
    };
    
    loadVideoAndAccess();
  }, [videoId, student?.id, viewRecorded]);

  const handleGoBack = () => {
    router.back();
  };

  const handlePurchase = () => {
    router.push(`/student/video/${videoId}/purchase`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-blue-600 border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">Loading video...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center">
              <AlertCircle className="h-6 w-6 text-red-400 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Access Denied</h3>
                <p className="mt-1 text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
            <div className="mt-4 flex space-x-3">
              <Button onClick={handleGoBack} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
              {video?.price && video.price > 0 && (
                <Button onClick={handlePurchase} className={`${
                  theme === 'ben10' 
                    ? 'bg-[#64cc4f] hover:bg-[#b2e05b]' 
                    : theme === 'tinkerbell'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}>
                  Purchase for ${video.price}
                </Button>
              )}
            </div>
          </div>
        </div>
    );
  }

  if (!video || !hasAccess) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto py-6">
        {/* Header */}
        <div className="mb-6">
          <Button onClick={handleGoBack} variant="outline" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Videos
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              {/* Video Player Container */}
              <div className="relative aspect-video bg-black">
                {video.videoUrl ? (
                  video.videoUrl.includes('youtube.com/embed/') ? (
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
                      controls
                      className="w-full h-full"
                      poster={video.thumbnailUrl}
                      preload="metadata"
                    >
                      <source src={video.videoUrl} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-white">
                    <div className="text-center">
                      <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Video not available</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="p-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  {video.title}
                </h1>
                
                <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400 mb-4">
                  <div className="flex items-center">
                    <Eye className="w-4 h-4 mr-1" />
                    <span>{video.views} views</span>
                  </div>
                  {video.duration && (
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>{Math.round(video.duration / 60)} minutes</span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <Book className="w-4 h-4 mr-1" />
                    <span>{video.subjectName}</span>
                  </div>
                </div>

                {/* Purchase Status */}
                {purchase && (
                  <div className={`${
                    theme === 'ben10'
                      ? 'bg-[#64cc4f]/10 border-[#64cc4f]/30'
                      : theme === 'tinkerbell'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  } border rounded-lg p-4 mb-4`}>
                    <div className="flex items-center">
                      <CheckCircle className={`h-5 w-5 mr-2 ${
                        theme === 'ben10'
                          ? 'text-[#64cc4f]'
                          : theme === 'tinkerbell'
                          ? 'text-green-500'
                          : 'text-blue-500'
                      }`} />
                      <div>
                        <p className={`text-sm font-medium ${
                          theme === 'ben10'
                            ? 'text-[#64cc4f]'
                            : theme === 'tinkerbell'
                            ? 'text-green-800 dark:text-green-200'
                            : 'text-blue-800 dark:text-blue-200'
                        }`}>
                          You own this video
                        </p>
                        <p className={`text-xs ${
                          theme === 'ben10'
                            ? 'text-[#b2e05b]'
                            : theme === 'tinkerbell'
                            ? 'text-green-600 dark:text-green-300'
                            : 'text-blue-600 dark:text-blue-300'
                        }`}>
                          Purchased on {purchase.purchasedAt?.toDate().toLocaleDateString()}
                          {purchase.viewCount > 0 && ` • Watched ${purchase.viewCount} times`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="prose dark:prose-invert max-w-none">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Description
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                    {video.description}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Video Details Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                  Video Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Subject:</span>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {video.subjectName}
                    </p>
                  </div>
                  
                  {video.lessonName && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Lesson:</span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {video.lessonName}
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Status:</span>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ml-2 ${
                      video.status === 'active' 
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                    }`}>
                      {video.status}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Visibility:</span>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ml-2 ${
                      video.visibility === 'public' 
                        ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                        : video.visibility === 'unlisted'
                        ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                        : 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
                    }`}>
                      {video.visibility}
                    </span>
                  </div>
                  
                  {video.price && video.price > 0 && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Price:</span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        ${video.price}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              {video.tags && video.tags.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {video.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Access Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                  Access Information
                </h3>
                <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                  {video.price && video.price > 0 ? (
                    purchase ? (
                      <>
                        <p>✓ You have purchased this video</p>
                        <p>✓ Lifetime access included</p>
                        <p>✓ Watch anytime, anywhere</p>
                      </>
                    ) : (
                      <p>This is a premium video</p>
                    )
                  ) : (
                    <>
                      <p>✓ This is a free video</p>
                      <p>✓ No purchase required</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
