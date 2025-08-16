import React from 'react';
import { BarChart3, Users, Target, BookOpen } from 'lucide-react';

interface SkeletonProps {
  className?: string;
}

const Skeleton = ({ className }: SkeletonProps) => (
  <div className={`animate-pulse bg-gray-300 dark:bg-gray-600 rounded ${className}`} />
);

export const GradeAnalyticsLoading = () => (
  <div className="space-y-6">
    {/* Header Skeleton */}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-8 w-16" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>

    {/* Key Metrics Skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[Users, BarChart3, Target, BookOpen].map((Icon, index) => (
        <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4 flex-1">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Content Skeleton */}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="py-4">
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </nav>
      </div>
      <div className="p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  </div>
);

export const ClassCardSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1">
        <Skeleton className="h-6 w-40 mb-1" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="w-3 h-3 rounded-full" />
    </div>

    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <Skeleton className="h-3 w-12 mx-auto mb-1" />
            <Skeleton className="h-6 w-8 mx-auto" />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>

    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
      <Skeleton className="h-8 w-full" />
    </div>
  </div>
);

export const StudentListSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div>
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <Skeleton className="h-5 w-12 mb-1" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="w-4 h-4" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// Progressive loading component
interface ProgressiveLoadingProps {
  isLoading: boolean;
  hasData: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  emptyState?: React.ReactNode;
}

export const ProgressiveLoading: React.FC<ProgressiveLoadingProps> = ({
  isLoading,
  hasData,
  skeleton,
  children,
  emptyState
}) => {
  if (isLoading) {
    return <>{skeleton}</>;
  }

  if (!hasData && emptyState) {
    return <>{emptyState}</>;
  }

  return <>{children}</>;
};
