'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/utils/firebase-client';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { ClassFirestoreService } from '@/apiservices/classFirestoreService';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Button from '@/components/ui/Button';
import { 
  BarChart3, 
  Users, 
  BookOpen, 
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { ClassSummary } from '@/apiservices/teacherGradeAnalyticsService';
import { useTeacherClassesSummary, useForceRefreshAnalytics } from '@/hooks/useGradeAnalytics';

// Simple loading skeleton component
const LoadingSkeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

// Simple alert component
const SimpleAlert = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
    {children}
  </div>
);

export default function TeacherGradesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'main' | 'co'>('main');
  const [coClasses, setCoClasses] = useState<ClassSummary[]>([]);
  const [coClassesLoading, setCoClassesLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  
  // Hook for force refreshing analytics
  const { forceRefresh } = useForceRefreshAnalytics();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Use SWR hook for data fetching
  const { classes, isLoading, error, mutate, isEmpty } = useTeacherClassesSummary(user?.uid || null);

  // Load co-classes when tab changes to co
  useEffect(() => {
    if (activeTab === 'co' && user?.uid && coClasses.length === 0) {
      loadCoClasses();
    }
  }, [activeTab, user?.uid, coClasses.length]);

  const loadCoClasses = async () => {
    if (!user?.uid) return;
    
    try {
      setCoClassesLoading(true);
      const teacherCoClasses = await ClassFirestoreService.getClassesByCoTeacher(user.uid);
      
      // Convert to ClassSummary format (simplified version for co-classes)
      const coClassesSummary: ClassSummary[] = teacherCoClasses.map(cls => ({
        id: cls.id,
        classId: cls.id,
        name: cls.name,
        subject: cls.subject,
        subjectId: cls.subjectId || '',
        year: cls.year,
        enrolledStudents: 0, // Will be loaded separately if needed
        totalTests: 0,
        completedTests: 0,
        averageScore: 0,
        lastActivityDate: undefined
      }));
      
      setCoClasses(coClassesSummary);
    } catch (error) {
      console.error('Error loading co-classes:', error);
    } finally {
      setCoClassesLoading(false);
    }
  };

  const handleClassClick = (classId: string) => {
    // Only allow navigation for main teacher classes
    if (activeTab === 'main') {
      router.push(`/teacher/grades/${classId}`);
    }
  };
  
  const handleRefreshAll = async () => {
    if (!user?.uid) return;
    
    try {
      setIsRefreshing(true);
      
      // Get ALL classes for the teacher, not just the currently displayed ones
      const allTeacherClasses = await ClassFirestoreService.getClassesByTeacher(user.uid);
      
      console.log(`🔄 Refreshing analytics for all ${allTeacherClasses.length} classes`);
      
      // Force refresh all classes
      const refreshPromises = allTeacherClasses.map(classItem => 
        forceRefresh(classItem.id, user.uid)
      );
      
      await Promise.all(refreshPromises);
      
      // Also refresh the main classes list
      await mutate();
      
      console.log(`✅ Refreshed analytics for all ${allTeacherClasses.length} classes`);
    } catch (error) {
      console.error('Error refreshing analytics:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatLastActivity = (date?: Date) => {
    if (!date) return 'No activity';
    
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getPerformanceIcon = (average: number) => {
    if (average >= 75) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (average >= 60) return <Minus className="h-4 w-4 text-yellow-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const getPerformanceBadgeVariant = (average: number): "default" | "secondary" | "destructive" => {
    if (average >= 75) return "default";
    if (average >= 60) return "secondary";
    return "destructive";
  };

  if (authLoading) {
    return (
      <TeacherLayout>
        <div className="container mx-auto p-6 space-y-6">
          <div className="space-y-2">
            <LoadingSkeleton className="h-8 w-64" />
            <LoadingSkeleton className="h-4 w-96" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <LoadingSkeleton className="h-6 w-48" />
                  <LoadingSkeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <LoadingSkeleton className="h-4 w-full" />
                    <LoadingSkeleton className="h-4 w-3/4" />
                    <LoadingSkeleton className="h-4 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </TeacherLayout>
    );
  }

  if (!user) {
    return (
      <TeacherLayout>
        <div className="container mx-auto p-6">
          <SimpleAlert>
            Please log in to view your grades.
          </SimpleAlert>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Grade Analytics</h1>
          <p className="text-muted-foreground">
            Monitor student performance and class analytics across all your classes
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleRefreshAll}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Recalculating...' : 'Full Refresh'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('main')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'main'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            My Classes ({classes.length})
          </button>
          <button
            onClick={() => setActiveTab('co')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'co'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Co-Classes ({coClasses.length})
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <SimpleAlert>
          {error.message || 'Failed to load classes'}
        </SimpleAlert>
      )}

      {/* Classes Grid */}
      {(activeTab === 'main' ? isLoading : coClassesLoading) ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <LoadingSkeleton className="h-6 w-48" />
                <LoadingSkeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <LoadingSkeleton className="h-4 w-full" />
                  <LoadingSkeleton className="h-4 w-3/4" />
                  <LoadingSkeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (activeTab === 'main' ? classes : coClasses).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {activeTab === 'co' ? 'No Co-Classes Found' : 'No Classes Found'}
            </h3>
            <p className="text-muted-foreground text-center">
              {activeTab === 'co' 
                ? 'You are not assigned as a co-teacher to any classes yet.'
                : 'You don\'t have any active classes assigned yet.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(activeTab === 'main' ? classes : coClasses).map((classItem) => (
            <Card 
              key={classItem.id} 
              className={`transition-shadow duration-300 ${
                activeTab === 'main' 
                  ? 'cursor-pointer hover:shadow-lg' 
                  : 'cursor-default opacity-75'
              }`}
              onClick={() => handleClassClick(classItem.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{classItem.name}</CardTitle>
                      {activeTab === 'co' && (
                        <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                          Co-Teacher
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        {classItem.classId}
                      </Badge>
                      <span>{classItem.subject} • {classItem.year}</span>
                    </div>
                  </div>
                  {activeTab === 'main' && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Students</span>
                    </div>
                    <p className="text-2xl font-bold">{classItem.enrolledStudents}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Tests</span>
                    </div>
                    <p className="text-2xl font-bold">{classItem.totalTests}</p>
                  </div>
                </div>

                {/* Performance Overview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Class Average</span>
                    <div className="flex items-center gap-2">
                      {getPerformanceIcon(classItem.averageScore)}
                      <Badge variant={getPerformanceBadgeVariant(classItem.averageScore)}>
                        {classItem.averageScore.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  
                  {/* <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Completed Tests</span>
                    <span className="text-sm font-medium">
                      {classItem.completedTests} / {classItem.totalTests}
                    </span>
                  </div> */}
                </div>

                {/* Last Activity
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Last Activity</span>
                  </div>
                  <span className="text-sm font-medium">
                    {formatLastActivity(classItem.lastActivityDate)}
                  </span>
                </div> */}

                {/* Quick Actions */}
                <div className="pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={`w-full ${
                      activeTab === 'co' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={activeTab === 'co'}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (activeTab === 'main') {
                        handleClassClick(classItem.id);
                      }
                    }}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    {activeTab === 'co' ? 'View Only' : 'View Analytics'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Statistics - Only show for main classes */}
      {activeTab === 'main' && classes.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total Classes</span>
              </div>
              <p className="text-2xl font-bold mt-2">{classes.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total Students</span>
              </div>
              <p className="text-2xl font-bold mt-2">
                {classes.reduce((sum, c) => sum + c.enrolledStudents, 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total Tests</span>
              </div>
              <p className="text-2xl font-bold mt-2">
                {classes.reduce((sum, c) => sum + c.totalTests, 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Overall Average</span>
              </div>
              <p className="text-2xl font-bold mt-2">
                {classes.length > 0 
                  ? (classes.reduce((sum, c) => sum + c.averageScore, 0) / classes.length).toFixed(1)
                  : '0'
                }%
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </TeacherLayout>
  );
}
