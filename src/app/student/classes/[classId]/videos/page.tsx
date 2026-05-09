'use client';

import React, { useState, useEffect, use } from 'react';
import { 
  Video, 
  Play, 
  ShoppingCart, 
  Eye, 
  BookOpen,
  Users,
  DollarSign,
  CheckCircle,
  Lock,
  Search,
  Filter,
  Star
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useStudentAuth } from '@/hooks/useStudentAuth';
// Theme feature removed: default neutral theme
import Link from 'next/link';

// Import services and types
import { VideoFirestoreService } from '@/apiservices/videoFirestoreService';
import { VideoPurchaseService } from '@/apiservices/videoPurchaseService';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { TeacherFirestoreService } from '@/apiservices/teacherFirestoreService';
import { VideoDocument, VideoDisplayData, videoDocumentToDisplay } from '@/models/videoSchema';
import { VideoPurchaseDocument } from '@/models/videoPurchaseSchema';

interface ClassVideoProps {
  params: Promise<{
    classId: string;
  }>;
}

interface ClassVideoData extends VideoDisplayData {
  isPaid: boolean;
  isPurchased: boolean;
  canAccess: boolean;
  purchaseInfo?: VideoPurchaseDocument;
}

type TabType = 'class' | 'purchased' | 'study';

interface FilterState {
  searchTerm: string;
  priceFilter: 'all' | 'free' | 'paid';
  sortBy: 'newest' | 'oldest' | 'price_low' | 'price_high' | 'popular';
}

export default function ClassVideos({ params }: ClassVideoProps) {
  // Unwrap params using React.use()
  const { classId } = use(params);
  
  const { student } = useStudentAuth();
  const theme = 'default';
  const [classInfo, setClassInfo] = useState<any>(null);
  const [videos, setVideos] = useState<ClassVideoData[]>([]);
  const [studentPurchases, setStudentPurchases] = useState<VideoPurchaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('class');
  
  // Filter states
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    priceFilter: 'all',
    sortBy: 'newest'
  });

  // Load class and video data
  useEffect(() => {
    const loadClassData = async () => {
      if (!student?.id || !classId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Load class information
        const classData = await ClassFirestoreService.getClassById(classId);
        if (!classData) {
          throw new Error('Class not found');
        }
        setClassInfo(classData);
        
        // Load student's purchases
        const purchases = await VideoPurchaseService.getStudentCompletedPurchases(student.id);
        setStudentPurchases(purchases);
        
        // Load videos for this class in two parts:
        // 1. Videos specifically assigned to this class (regardless of subject)
        // 2. Videos of the same subject (public or assigned)
        const [assignedVideos, subjectVideos] = await Promise.all([
          VideoFirestoreService.getVideosByClass(classId),
          VideoFirestoreService.getVideosBySubject(classData.subjectId)
        ]);
        
        // Combine and deduplicate videos
        const allVideosMap = new Map();
        
        // Add all assigned videos first (priority)
        assignedVideos.forEach(video => {
          allVideosMap.set(video.id, video);
        });
        
        // Add subject videos if not already present
        subjectVideos.forEach(video => {
          if (!allVideosMap.has(video.id)) {
            allVideosMap.set(video.id, video);
          }
        });
        
        const allVideos = Array.from(allVideosMap.values());
        
        console.log('🔍 Class videos loaded:', allVideos.length);
        console.log('🔍 Assigned to class:', assignedVideos.length);
        console.log('🔍 Subject videos:', subjectVideos.length);
        
        // Filter videos that are relevant to this student and class:
        const purchasedVideoIds = purchases.map((p: VideoPurchaseDocument) => p.videoId);
        
        const relevantVideos = allVideos.filter(video => {
          // Always show purchased videos (student owns them)
          if (purchasedVideoIds.includes(video.id)) {
            return true;
          }
          
          // Show videos assigned to this specific class (highest priority)
          if (video.assignedClassIds?.includes(classId)) {
            return true;
          }
          
          // Show public videos of the same subject (additional content)
          if (video.visibility === 'public' && video.subjectId === classData.subjectId) {
            return true;
          }
          
          return false;
        });
        
        // Convert to class video format with purchase info
        const classVideos: ClassVideoData[] = await Promise.all(
          relevantVideos.map(async (video) => {
            // Get teacher information for this video
            let teacherName = 'Teacher';
            if (video.teacherId) {
              try {
                const teacher = await TeacherFirestoreService.getTeacherById(video.teacherId);
                teacherName = teacher ? teacher.name : 'Teacher';
              } catch (teacherErr) {
                console.error(`Error loading teacher ${video.teacherId}:`, teacherErr);
              }
            }
            
            const displayData = videoDocumentToDisplay(video, {}, {}, teacherName);
            const isPaid = (video.price || 0) > 0;
            const purchaseInfo = purchases.find((p: VideoPurchaseDocument) => p.videoId === video.id);
            const isPurchased = !!purchaseInfo;
            const canAccess = !isPaid || isPurchased;
            
            return {
              ...displayData,
              price: video.price || 0,
              isPaid,
              isPurchased,
              canAccess,
              purchaseInfo
            };
          })
        );
        
        setVideos(classVideos);
        
      } catch (err: any) {
        console.error('Error loading class data:', err);
        setError(err.message || 'Failed to load class data');
      } finally {
        setLoading(false);
      }
    };
    
    loadClassData();
  }, [student?.id, classId]);

  // Get videos for current tab with filters
  const getTabVideos = () => {
    let filteredVideos = videos;
    
    // Filter by tab
    switch (activeTab) {
      case 'class':
        // Show videos accessible to student (free + purchased for this class)
        filteredVideos = filteredVideos.filter(video => video.canAccess);
        break;
      case 'purchased':
        filteredVideos = filteredVideos.filter(video => video.isPurchased);
        break;
      case 'study':
        filteredVideos = filteredVideos.filter(video => video.isPaid && !video.isPurchased);
        break;
    }
    
    // Apply additional filters
    if (filters.searchTerm) {
      filteredVideos = filteredVideos.filter(video =>
        video.title.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        video.description.toLowerCase().includes(filters.searchTerm.toLowerCase())
      );
    }
    
    if (filters.priceFilter === 'free') {
      filteredVideos = filteredVideos.filter(video => !video.isPaid);
    } else if (filters.priceFilter === 'paid') {
      filteredVideos = filteredVideos.filter(video => video.isPaid);
    }
    
    // Sort videos
    filteredVideos.sort((a, b) => {
      switch (filters.sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'price_low':
          return (a.price || 0) - (b.price || 0);
        case 'price_high':
          return (b.price || 0) - (a.price || 0);
        case 'popular':
          return (b.views || 0) - (a.views || 0);
        default:
          return 0;
      }
    });
    
    return filteredVideos;
  };

  // Handle video access
  const handleVideoAccess = (video: ClassVideoData) => {
    if (video.canAccess) {
      // Navigate to video player
      window.location.href = `/student/video/${video.id}/watch`;
    } else {
      // Navigate to purchase page
      window.location.href = `/student/video/${video.id}/purchase`;
    }
  };

  // Get tab counts
  const getTabCounts = () => {
    return {
      class: videos.filter(v => v.canAccess).length,
      purchased: videos.filter(v => v.isPurchased).length,
      study: videos.filter(v => v.isPaid && !v.isPurchased).length
    };
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${
        theme === 'tinkerbell'
          ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400'
          : theme === 'ben10'
          ? ''
          : theme === 'bounceworld'
          ? 'bg-gradient-to-br from-white via-[#1D428A]/10 to-[#C8102E]/10'
          : theme === 'avengers'
          ? 'bg-gradient-to-br from-[#2C1267]/10 via-[#604AC7]/10 to-[#0F0826]/10'
          : theme === 'cricketverse-australian'
          ? ''
          : theme === 'ponyville'
          ? 'bg-gradient-to-br from-[#fff5fb] via-[#f1aed5] to-[#ff2e9f]'
          : theme === 'default'
          ? 'bg-gradient-to-br from-gray-50 to-white'
          : theme === 'cricketverse'
          ? 'bg-gradient-to-br from-blue-400 to-indigo-600'
          : 'bg-gradient-to-br from-blue-400 via-indigo-500 to-indigo-600'
      }`}
      style={theme === 'ben10' ? {
        background: 'linear-gradient(to bottom right, rgb(100, 204, 79), rgb(178, 224, 91), rgb(34, 34, 34))'
      } : theme === 'cricketverse' ? {
        background: 'linear-gradient(to bottom right, rgb(96, 165, 250), rgba(245, 137, 90, 0.6), rgb(79, 70, 229), rgb(96, 165, 250))'
      } : theme === 'cricketverse-australian' ? {
        background: '#ffff2a'
      } : undefined}
      >
        <div className={`bg-white border-4 rounded-3xl p-8 shadow-2xl ${
          theme === 'ponyville' ? 'border-[#e13690]' : theme === 'cricketverse-australian' ? 'border-[#b38f00]' : 'border-black'
        }`}>
          {/* Theme-specific loading animations */}
          {theme === 'tinkerbell' && (
            <div className="flex flex-col items-center">
              <img
                src="/tinkerbell-loading.gif"
                alt="Tinkerbell Loading"
                className="w-32 h-32 object-contain"
              />
              <span className="text-2xl font-bold text-yellow-600 mt-4">Loading magical videos...</span>
            </div>
          )}

          {theme === 'ben10' && (
            <div className="flex flex-col items-center">
              <img
                src="/ben10-loading.gif"
                alt="Ben 10 Loading"
                className="w-32 h-32 object-contain"
              />
              <span className="text-2xl font-bold text-[#64cc4f] mt-4">Loading hero videos...</span>
            </div>
          )}

          {theme === 'bounceworld' && (
            <div className="flex flex-col items-center">
              <img
                src="/bounceworld.gif"
                alt="BounceWorld Loading"
                className="w-32 h-32 object-contain"
              />
              <span className="text-2xl font-bold text-[#1D428A] mt-4">Loading bounce videos...</span>
            </div>
          )}

          {theme === 'avengers' && (
            <div className="flex flex-col items-center">
              <img
                src="/avenger.gif"
                alt="Avengers Loading"
                className="w-32 h-32 object-contain"
              />
              <span className="text-2xl font-bold text-[#2C1267] mt-4">Assembling videos...</span>
            </div>
          )}

          {theme === 'ponyville' && (
            <div className="flex flex-col items-center">
              <img
                src="/ponyville-loading.gif"
                alt="Ponyville Loading"
                className="w-32 h-32 object-contain"
              />
              <span className="text-2xl font-bold text-[#e13690] mt-4">Loading magical videos...</span>
            </div>
          )}

          {/* Default loading spinner */}
          {theme !== 'tinkerbell' && theme !== 'ben10' && theme !== 'bounceworld' && theme !== 'avengers' && theme !== 'ponyville' && (
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 border-4 border-blue-400 border-t-blue-600 rounded-full animate-spin"></div>
              <span className="text-2xl font-bold text-blue-600 mt-4">Loading class videos...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabCounts = getTabCounts();
  const tabVideos = getTabVideos();

  return (
    <div
      className={`min-h-screen p-6 ${
        theme === 'tinkerbell'
          ? 'bg-gradient-to-br from-yellow-300 via-green-400 to-yellow-400'
          : theme === 'ben10'
          ? ''
          : theme === 'bounceworld'
          ? 'bg-gradient-to-br from-white via-[#1D428A]/10 to-[#C8102E]/10'
          : theme === 'avengers'
          ? 'bg-gradient-to-br from-[#2C1267]/10 via-[#604AC7]/10 to-[#0F0826]/10'
          : theme === 'cricketverse-australian'
          ? ''
          : theme === 'ponyville'
          ? 'bg-gradient-to-br from-[#fff5fb] via-[#f1aed5] to-[#ff2e9f]'
          : theme === 'default'
          ? 'bg-gradient-to-br from-gray-50 to-white'
          : theme === 'cricketverse'
          ? 'bg-gradient-to-br from-blue-400 to-indigo-600'
          : 'bg-gradient-to-br from-blue-400 via-indigo-500 to-indigo-600'
      }`}
      style={theme === 'ben10' ? {
        background: 'linear-gradient(to bottom right, rgb(100, 204, 79), rgb(178, 224, 91), rgb(34, 34, 34))'
      } : theme === 'cricketverse' ? {
        background: 'linear-gradient(to bottom right, rgb(96, 165, 250), rgba(245, 137, 90, 0.6), rgb(79, 70, 229), rgb(96, 165, 250))'
      } : theme === 'cricketverse-australian' ? {
        background: '#ffff2a'
      } : undefined}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Class Header */}
        <div className={`text-white rounded-3xl shadow-2xl border-4 border-black p-6 ${
          theme === 'ben10'
            ? 'bg-gradient-to-r from-[#64cc4f] to-[#222222]'
            : theme === 'tinkerbell'
            ? 'bg-gradient-to-r from-green-300 via-green-500 to-yellow-400'
            : theme === 'bounceworld'
            ? 'bg-gradient-to-r from-[#1D428A] via-white to-[#C8102E] border-[#1D428A]'
            : theme === 'avengers'
            ? 'bg-gradient-to-r from-[#2C1267] via-[#604AC7] to-[#0F0826] border-[#2C1267]'
            : theme === 'cricketverse-australian'
            ? 'bg-white border-[#b38f00] text-black'
            : theme === 'ponyville'
            ? 'bg-gradient-to-r from-[#f1aed5] to-[#e13690] border-[#ff2e9f]'
            : theme === 'default'
            ? 'bg-gradient-to-r from-white to-gray-100 border-gray-300 text-black'
            : 'bg-gradient-to-r from-blue-400 to-indigo-600'
        }`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-black mb-2">
              {classInfo?.name} - Video Library
            </h1>
            <p className={`font-bold ${
              theme === 'ben10'
                ? 'text-white'
                : theme === 'tinkerbell'
                ? 'text-white'
                : theme === 'bounceworld'
                ? 'text-[#1D428A]'
                : theme === 'avengers'
                ? 'text-white'
                : theme === 'cricketverse-australian'
                ? 'text-black'
                : theme === 'ponyville'
                ? 'text-white'
                : theme === 'default'
                ? 'text-black'
                : 'text-blue-100'
            }`}>
              {classInfo?.subject} • Grade {classInfo?.grade} • {classInfo?.teacherName}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`bg-white border-4 rounded-2xl p-4 shadow-lg text-center ${theme === 'cricketverse-australian' ? 'border-[#b38f00]' : 'border-black'}`}>
              <div className="text-3xl font-black text-black">{videos.length}</div>
              <div className="text-sm font-bold text-gray-700">Total Videos</div>
            </div>
            <div className={`bg-white border-4 rounded-2xl p-4 shadow-lg text-center ${theme === 'cricketverse-australian' ? 'border-[#b38f00]' : 'border-black'}`}>
              <div className="text-3xl font-black text-black">{tabCounts.purchased}</div>
              <div className="text-sm font-bold text-gray-700">Purchased</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={`rounded-2xl shadow-xl border-4 ${theme === 'cricketverse-australian' ? 'border-[#b38f00]' : 'border-black'} ${
        theme === 'ben10'
          ? 'bg-gradient-to-br from-[#64cc4f]/20 to-[#b2e05b]/20'
          : theme === 'tinkerbell'
          ? 'bg-gradient-to-br from-yellow-100 to-green-50'
          : theme === 'bounceworld'
          ? 'bg-gradient-to-br from-white via-[#1D428A]/20 to-[#C8102E]/20'
          : theme === 'avengers'
          ? 'bg-gradient-to-br from-[#604AC7]/30 via-[#2C1267]/30 to-[#0F0826]/30'
          : theme === 'cricketverse-australian'
          ? 'bg-gradient-to-br from-[#b38f00]/10 to-[#ffd700]/10'
          : theme === 'ponyville'
          ? 'bg-gradient-to-br from-[#fff5fb] via-[#f1aed5]/30 to-[#ff2e9f]/30'
          : theme === 'default'
          ? 'bg-gradient-to-br from-white to-gray-50'
          : 'bg-gradient-to-br from-blue-50 to-indigo-100 dark:bg-gray-800'
      }`}>
        <div>
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('class')}
              className={`py-4 px-1 border-b-4 font-bold text-sm whitespace-nowrap ${
                activeTab === 'class'
                  ? theme === 'ben10'
                    ? 'border-[#64cc4f] text-[#222222]'
                    : theme === 'tinkerbell'
                    ? 'border-yellow-500 text-black'
                    : theme === 'bounceworld'
                    ? 'border-[#1D428A] text-[#1D428A]'
                    : theme === 'avengers'
                    ? 'border-[#604AC7] text-[#2C1267]'
                    : theme === 'cricketverse-australian'
                    ? 'border-[#b38f00] text-[#b38f00]'
                    : theme === 'ponyville'
                    ? 'border-[#e13690] text-[#e13690]'
                    : theme === 'default'
                    ? 'border-gray-800 text-black'
                    : 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4" />
                <span>Class Videos</span>
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                  {tabCounts.class}
                </span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('purchased')}
              className={`py-4 px-1 border-b-4 font-bold text-sm whitespace-nowrap ${
                activeTab === 'purchased'
                  ? theme === 'ben10'
                    ? 'border-[#64cc4f] text-[#222222]'
                    : theme === 'tinkerbell'
                    ? 'border-yellow-500 text-black'
                    : theme === 'bounceworld'
                    ? 'border-[#1D428A] text-[#1D428A]'
                    : theme === 'avengers'
                    ? 'border-[#604AC7] text-[#2C1267]'
                    : theme === 'cricketverse-australian'
                    ? 'border-[#b38f00] text-[#b38f00]'
                    : theme === 'ponyville'
                    ? 'border-[#e13690] text-[#e13690]'
                    : theme === 'default'
                    ? 'border-gray-800 text-black'
                    : 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>Purchased Videos</span>
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                  {tabCounts.purchased}
                </span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('study')}
              className={`py-4 px-1 border-b-4 font-bold text-sm whitespace-nowrap ${
                activeTab === 'study'
                  ? theme === 'ben10'
                    ? 'border-[#64cc4f] text-[#222222]'
                    : theme === 'tinkerbell'
                    ? 'border-yellow-500 text-black'
                    : theme === 'bounceworld'
                    ? 'border-[#1D428A] text-[#1D428A]'
                    : theme === 'avengers'
                    ? 'border-[#604AC7] text-[#2C1267]'
                    : theme === 'cricketverse-australian'
                    ? 'border-[#b38f00] text-[#b38f00]'
                    : theme === 'ponyville'
                    ? 'border-[#e13690] text-[#e13690]'
                    : theme === 'default'
                    ? 'border-gray-800 text-black'
                    : 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-4 h-4" />
                <span>Study More</span>
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                  {tabCounts.study}
                </span>
              </div>
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search videos..."
                  value={filters.searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setFilters(prev => ({ ...prev, searchTerm: e.target.value }))
                  }
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Price Filter */}
            {activeTab !== 'purchased' && (
              <div className="lg:w-32">
                <select
                  value={filters.priceFilter}
                  onChange={(e) => setFilters(prev => ({ ...prev, priceFilter: e.target.value as any }))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            )}
            
            {/* Sort */}
            <div className="lg:w-40">
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="popular">Most Popular</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Videos Grid */}
      <div>
        {tabVideos.length === 0 ? (
          <div className={`rounded-2xl shadow-xl border-4 ${theme === 'cricketverse-australian' ? 'border-[#b38f00]' : 'border-black'} p-12 text-center ${
            theme === 'ben10'
              ? 'bg-gradient-to-br from-[#64cc4f]/10 to-[#b2e05b]/10'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-br from-yellow-100 to-green-50'
              : theme === 'bounceworld'
              ? 'bg-gradient-to-br from-white via-[#1D428A]/20 to-[#C8102E]/20'
              : theme === 'avengers'
              ? 'bg-gradient-to-br from-[#604AC7]/30 via-[#2C1267]/30 to-[#0F0826]/30'
              : theme === 'cricketverse-australian'
              ? 'bg-gradient-to-br from-[#b38f00]/10 to-[#ffd700]/10'
              : theme === 'ponyville'
              ? 'bg-gradient-to-br from-[#fff5fb] via-[#f1aed5]/30 to-[#ff2e9f]/30'
              : theme === 'default'
              ? 'bg-gradient-to-br from-gray-100 to-white'
              : 'bg-gradient-to-br from-blue-400 via-indigo-500 to-indigo-600'
          }`}>
            {activeTab === 'class' && (
              <>
                <Video className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No class videos available
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  No videos are available for this class yet.
                </p>
              </>
            )}
            {activeTab === 'purchased' && (
              <>
                <CheckCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No purchased videos
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  You haven't purchased any videos yet.
                </p>
                <Button onClick={() => setActiveTab('study')}>
                  Explore Study More
                </Button>
              </>
            )}
            {activeTab === 'study' && (
              <>
                <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No additional videos available
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  All available study videos have been purchased or there are no additional videos available.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className={`rounded-2xl shadow-xl border-4 ${theme === 'cricketverse-australian' ? 'border-[#b38f00]' : 'border-black'} p-6 ${
            theme === 'ben10'
              ? 'bg-gradient-to-br from-[#64cc4f]/10 to-[#b2e05b]/10'
              : theme === 'tinkerbell'
              ? 'bg-gradient-to-br from-yellow-100 to-green-50'
              : theme === 'bounceworld'
              ? 'bg-gradient-to-br from-white via-[#1D428A]/20 to-[#C8102E]/20'
              : theme === 'avengers'
              ? 'bg-gradient-to-br from-[#604AC7]/30 via-[#2C1267]/30 to-[#0F0826]/30'
              : theme === 'cricketverse-australian'
              ? 'bg-gradient-to-br from-[#b38f00]/10 to-[#ffd700]/10'
              : theme === 'ponyville'
              ? 'bg-gradient-to-br from-[#fff5fb] via-[#f1aed5]/30 to-[#ff2e9f]/30'
              : theme === 'default'
              ? 'bg-gradient-to-br from-gray-100 to-white'
              : 'bg-gradient-to-br from-blue-400 via-indigo-500 to-indigo-600'
          }`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {tabVideos.map((video) => (
                <ClassVideoCard
                  key={video.id}
                  video={video}
                  onAccess={handleVideoAccess}
                  theme={theme}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

// Class Video Card Component
interface ClassVideoCardProps {
  video: ClassVideoData;
  onAccess: (video: ClassVideoData) => void;
  theme: 'default' | 'ben10' | 'tinkerbell' | 'cricketverse' | 'cricketverse-australian' | 'bounceworld' | 'avengers' | 'ponyville';
}

const ClassVideoCard: React.FC<ClassVideoCardProps> = ({ video, onAccess, theme }) => {
  return (
    <div className={`rounded-2xl shadow-lg border-4 ${theme === 'cricketverse-australian' ? 'border-[#b38f00]' : 'border-black'} overflow-hidden hover:shadow-2xl transition-shadow ${
      theme === 'ben10'
        ? 'bg-gradient-to-br from-[#64cc4f]/20 to-[#b2e05b]/20'
        : theme === 'tinkerbell'
        ? 'bg-gradient-to-br from-yellow-50 to-green-100'
        : theme === 'bounceworld'
        ? 'bg-gradient-to-r from-[#1D428A]  to-[#C8102E]'
        : theme === 'avengers'
        ? 'bg-gradient-to-br from-[#604AC7]/30 via-[#2C1267]/30 to-[#0F0826]/30'
        : theme === 'cricketverse-australian'
        ? 'bg-white'
        : theme === 'ponyville'
        ? 'bg-gradient-to-br from-[#fff5fb] via-[#f1aed5]/30 to-[#ff2e9f]/30'
        : theme === 'default'
        ? 'bg-gradient-to-br from-white to-gray-50'
        : 'bg-gradient-to-br from-blue-400 via-indigo-500 to-indigo-600'
    }`}>
      {/* Video Thumbnail */}
      <div className="relative aspect-video bg-gray-100 dark:bg-gray-700">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex items-center justify-center ${video.thumbnailUrl ? 'hidden' : ''}`}>
          <Video className="w-16 h-16 text-gray-400" />
        </div>
        
        {/* Overlay with access indicator */}
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          {video.canAccess ? (
            <Play className="w-12 h-12 text-white" />
          ) : (
            <Lock className="w-12 h-12 text-white" />
          )}
        </div>
        
        {/* Price badge */}
        {video.isPaid && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-600">
              <DollarSign className="w-3 h-3 mr-1" />
              ${video.price}
            </span>
          </div>
        )}
        
        {/* Purchase status */}
        {video.isPurchased && (
          <div className="absolute top-2 right-2">
            <CheckCircle className="w-6 h-6 text-green-500" />
          </div>
        )}
        
        {/* Free badge */}
        {!video.isPaid && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
              FREE
            </span>
          </div>
        )}
      </div>

      {/* Video Info */}
      <div className="p-4">
        <div className="mb-3">
          <h3 className={`text-lg font-semibold mb-1 line-clamp-2 ${
            theme === 'ponyville' ? 'text-black' : theme === 'cricketverse-australian' ? 'text-black' : theme === 'default' ? 'text-black' : 'text-gray-900'
          }`}>
            {video.title}
          </h3>
          <p className={`text-sm line-clamp-2 ${
            theme === 'ponyville' ? 'text-black' : theme === 'cricketverse-australian' ? 'text-black' : theme === 'default' ? 'text-black' : 'text-gray-600 dark:text-gray-100'
          }`}>
            {video.description}
          </p>
        </div>

        {/* Video Meta */}
        <div className="space-y-1 mb-4">
          <div className={`flex items-center text-xs ${
            theme === 'ponyville' ? 'text-black' : theme === 'cricketverse-australian' ? 'text-black' : theme === 'default' ? 'text-black' : 'text-gray-500 dark:text-gray-100'
          }`}>
            <Users className="w-3 h-3 mr-1" />
            <span>{video.teacherName}</span>
          </div>
          <div className={`flex items-center text-xs ${
            theme === 'ponyville' ? 'text-black' : theme === 'cricketverse-australian' ? 'text-black' : theme === 'default' ? 'text-black' : 'text-gray-500 dark:text-gray-100'
          }`}>
            <BookOpen className="w-3 h-3 mr-1" />
            <span>{video.lessonName || 'Lesson Content'}</span>
          </div>
        </div>

        {/* Subject Badge */}
        <div className="mb-4">
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/20 ${
            theme === 'ponyville' ? 'text-black' : theme === 'cricketverse-australian' ? 'text-black' : theme === 'default' ? 'text-black' : 'text-black dark:text-black'
          }`}>
            {video.subjectName}
          </span>
        </div>

        {/* Action Button */}
        <Button
          onClick={() => onAccess(video)}
          variant="custom"
          className={`w-full flex items-center justify-center space-x-2 font-bold ${
            video.canAccess
              ? theme === 'ben10'
                ? 'bg-[#64cc4f] hover:bg-[#b2e05b] text-[#222222]'
                : theme === 'tinkerbell'
                ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900'
                : theme === 'bounceworld'
                ? 'bg-gradient-to-r from-[#1D428A] to-[#C8102E] hover:from-[#C8102E] hover:to-[#1D428A] text-white'
                : theme === 'avengers'
                ? 'bg-[#604AC7] hover:bg-[#2C1267] text-white'
                : theme === 'cricketverse-australian'
                ? 'bg-[#b38f00] hover:bg-[#daa520] text-white'
                : theme === 'ponyville'
                ? 'bg-black hover:bg-gray-800 text-white'
                : theme === 'default'
                ? 'bg-gray-800 hover:bg-gray-900 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              : theme === 'ben10'
                ? 'bg-[#b2e05b] hover:bg-[#64cc4f] text-[#222222]'
                : theme === 'tinkerbell'
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : theme === 'bounceworld'
                ? 'bg-gradient-to-r from-[#C8102E] to-[#1D428A] hover:from-[#1D428A] hover:to-[#C8102E] text-white'
                : theme === 'avengers'
                ? 'bg-[#2C1267] hover:bg-[#604AC7] text-white'
                : theme === 'cricketverse-australian'
                ? 'bg-[#ffd700] hover:bg-[#b38f00] text-black'
                : theme === 'ponyville'
                ? 'bg-black hover:bg-gray-800 text-white'
                : theme === 'default'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
          size="sm"
        >
          {video.canAccess ? (
            <>
              <Play className="w-4 h-4" />
              <span>Watch Now</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4" />
              <span>Buy ${video.price}</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
