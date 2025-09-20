'use client';


import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Users, 
  GraduationCap, 
  Building2, 
  Video, 
  FileQuestion, 
  Activity,
  Shield,
  RefreshCw
} from 'lucide-react';
import { NavigationLoader } from '@/utils/performance';
import { useNavigationLoading } from '@/hooks/useNavigationLoading';
import AdminModal from '@/components/modals/AdminModal';
import { AdminData } from '@/models/adminSchema';
import { CenterFirestoreService } from '@/apiservices/centerFirestoreService';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { SubjectFirestoreService } from '@/apiservices/subjectFirestoreService';
import { TeacherFirestoreService } from '@/apiservices/teacherFirestoreService';
import { StudentFirestoreService } from '@/apiservices/studentFirestoreService';
import { VideoFirestoreService } from '@/apiservices/videoFirestoreService';

export default function AdminDashboard() {
  const { setLoading: setNavLoading } = useNavigationLoading();
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [centersInitialized, setCentersInitialized] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    totalVideos: 0,
    totalSubjects: 0,
    activeClasses: 0,
    totalQuestions: 0,
    pendingTransactions: 0,
    systemStatus: 'Loading...'
  });

  // Fetch dashboard statistics with error handling and timeout
  const fetchDashboardStats = async () => {
    // Prevent multiple simultaneous calls
    if (statsLoading && hasInitialLoad) {
      return;
    }

    try {
      setStatsLoading(true);
      
      // Create abort controller with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      // Fetch data from all services in parallel with individual error handling
      const [
        studentsData,
        teachersData,
        classesData,
        videosData,
        subjectsData
      ] = await Promise.allSettled([
        StudentFirestoreService.getAllStudents(),
        TeacherFirestoreService.getAllTeachers(),
        ClassFirestoreService.getAllClasses(),
        VideoFirestoreService.getAllVideos(),
        SubjectFirestoreService.getAllSubjects()
      ]);

      clearTimeout(timeoutId);

      // Extract data safely from settled promises
      const students = studentsData.status === 'fulfilled' ? studentsData.value : [];
      const teachers = teachersData.status === 'fulfilled' ? teachersData.value : [];
      const classes = classesData.status === 'fulfilled' ? classesData.value : [];
      const videos = videosData.status === 'fulfilled' ? videosData.value : [];
      const subjects = subjectsData.status === 'fulfilled' ? subjectsData.value : [];

      // Calculate statistics
      const activeClasses = classes.filter(cls => cls.status === 'Active').length;
      const activeSubjects = subjects.filter(sub => sub.isActive).length;
      
      setStats({
        totalStudents: students.length,
        totalTeachers: teachers.length,
        totalClasses: classes.length,
        totalVideos: videos.length,
        totalSubjects: subjects.length,
        activeClasses: activeClasses,
        totalQuestions: 0, // Will need QuestionBankFirestoreService for this
        pendingTransactions: 0, // Will need TransactionFirestoreService for this
        systemStatus: 'Healthy'
      });

      setHasInitialLoad(true);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setStats(prev => ({
        ...prev,
        systemStatus: 'Error'
      }));
    } finally {
      setStatsLoading(false);
    }
  };

  // Clear loading state when dashboard loads and fetch stats
  useEffect(() => {
    setNavLoading(false);
    
    // Only fetch stats if we haven't loaded them yet
    if (!hasInitialLoad) {
      fetchDashboardStats();
    }
  }, [setNavLoading, hasInitialLoad]);

  // Handle admin creation
  const handleAdminCreate = async (adminData: AdminData) => {
    setAdminLoading(true);
    
    try {
      const response = await fetch('/api/admin-side/admin-manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adminData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create admin');
      }

      const result = await response.json();
      console.log('Admin created successfully:', result);
      alert(`Admin "${adminData.name}" created successfully!`);
      setShowAdminModal(false);
    } catch (error) {
      console.error('Error creating admin:', error);
      alert(`Failed to create admin: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setAdminLoading(false);
    }
  };

  // Initialize centers in database
  const initializeCenters = async () => {
    try {
      // Check if centers already exist
      const existingCenters = await CenterFirestoreService.getAllCenters();
      if (existingCenters.length > 0) {
        alert('Centers already exist in database');
        setCentersInitialized(true);
        return;
      }

      // Add the two centers to Firestore
      const centersData = [
        { center: 1, location: 'Glen Waverley' },
        { center: 2, location: 'Cranbourne' }
      ];

      // Note: You'll need to add a createCenter method to CenterFirestoreService
      // For now, let's add them directly to Firestore
      const { collection, addDoc } = await import('firebase/firestore');
      const { firestore } = await import('@/utils/firebase-client');
      
      for (const centerData of centersData) {
        await addDoc(collection(firestore, 'center'), centerData);
      }

      alert('Centers initialized successfully!');
      setCentersInitialized(true);
    } catch (error) {
      console.error('Error initializing centers:', error);
      alert('Failed to initialize centers: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Dashboard Overview
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Welcome back! Here's what's happening with your platform today.
            </p>
          </div>
          <button
            onClick={fetchDashboardStats}
            disabled={statsLoading}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
            Refresh Stats
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">        {/* Students Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Students</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {statsLoading ? 'Loading...' : stats.totalStudents.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Teachers Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <GraduationCap className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Teachers</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {statsLoading ? 'Loading...' : stats.totalTeachers}
              </p>
            </div>
          </div>
        </div>

        {/* Classes Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Classes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {statsLoading ? 'Loading...' : stats.activeClasses}
              </p>
            </div>
          </div>
        </div>

        {/* Videos Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg">
              <Video className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Videos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {statsLoading ? 'Loading...' : stats.totalVideos}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Second Row Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">        {/* Subjects */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <FileQuestion className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Subjects</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {statsLoading ? 'Loading...' : stats.totalSubjects}
              </p>
            </div>
          </div>
        </div>

        {/* Total Classes */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
              <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Classes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {statsLoading ? 'Loading...' : stats.totalClasses}
              </p>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className={`p-3 rounded-lg ${
              stats.systemStatus === 'Healthy' 
                ? 'bg-green-100 dark:bg-green-900' 
                : stats.systemStatus === 'Error' 
                ? 'bg-red-100 dark:bg-red-900' 
                : 'bg-gray-100 dark:bg-gray-900'
            }`}>
              <Activity className={`w-6 h-6 ${
                stats.systemStatus === 'Healthy' 
                  ? 'text-green-600 dark:text-green-400' 
                  : stats.systemStatus === 'Error' 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-gray-600 dark:text-gray-400'
              }`} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">System Status</p>
              <p className={`text-2xl font-bold ${
                stats.systemStatus === 'Healthy' 
                  ? 'text-green-600 dark:text-green-400' 
                  : stats.systemStatus === 'Error' 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {stats.systemStatus}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Quick Actions</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Access commonly used features and navigate to management pages</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link 
                href="/admin/students"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center group"
              >
                <Users className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Manage Students
              </Link>
              
              <Link 
                href="/admin/teachers"
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center group"
              >
                <GraduationCap className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Manage Teachers
              </Link>
              
              <Link 
                href="/admin/classes"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center group"
              >
                <Building2 className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Manage Classes
              </Link>
              
              <button 
                onClick={() => setShowAdminModal(true)}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center group"
              >
                <Shield className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Add New Admin
              </button>
              
              <Link 
                href="/admin/subjects"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center group"
              >
                <FileQuestion className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Manage Subjects
              </Link>
              
              <button
                onClick={initializeCenters}
                disabled={centersInitialized}
                className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center group ${
                  centersInitialized 
                    ? 'bg-gray-400 cursor-not-allowed text-gray-200' 
                    : 'bg-teal-600 hover:bg-teal-700 text-white'
                }`}
              >
                <Building2 className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                {centersInitialized ? 'Centers Initialized' : 'Initialize Centers'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Creation Modal */}
      {showAdminModal && (
        <AdminModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          onSubmit={handleAdminCreate}
          loading={adminLoading}
          title="Add New Admin"
          submitButtonText="Create Admin"
        />
      )}
    </div>
  );
}