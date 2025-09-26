import useSWR from 'swr';
import { 
  GradeAnalyticsService, 
  ClassSummary, 
  TestSummary, 
  StudentPerformanceSummary,
  DetailedStudentReport 
} from '@/apiservices/teacherGradeAnalyticsService';

// Custom hook for teacher classes summary
export function useTeacherClassesSummary(teacherId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    teacherId ? ['teacher-classes-summary', teacherId] : null,
    ([_, teacherId]) => GradeAnalyticsService.getTeacherClassesSummary(teacherId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30000, // 30 seconds deduping
      errorRetryCount: 3,
      errorRetryInterval: 5000, // 5 seconds between retries
    }
  );

  return {
    classes: data || [],
    isLoading,
    error,
    mutate,
    isEmpty: !isLoading && !error && (!data || data.length === 0)
  };
}

// Custom hook for class test analytics
export function useClassTestAnalytics(classId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    classId ? ['class-test-analytics', classId] : null,
    ([_, classId]) => GradeAnalyticsService.getClassTestAnalytics(classId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 minute deduping for test data
      errorRetryCount: 3,
      errorRetryInterval: 5000,
    }
  );

  return {
    tests: data || [],
    isLoading,
    error,
    mutate,
    isEmpty: !isLoading && !error && (!data || data.length === 0)
  };
}

// Custom hook for class student analytics
export function useClassStudentAnalytics(classId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    classId ? ['class-student-analytics', classId] : null,
    ([_, classId]) => GradeAnalyticsService.getClassStudentAnalytics(classId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 minute deduping for student data
      errorRetryCount: 3,
      errorRetryInterval: 5000,
    }
  );

  return {
    students: data || [],
    isLoading,
    error,
    mutate,
    isEmpty: !isLoading && !error && (!data || data.length === 0)
  };
}

// Custom hook for detailed student report
export function useDetailedStudentReport(studentId: string | null, classId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    studentId && classId ? ['detailed-student-report', studentId, classId] : null,
    ([_, studentId, classId]) => GradeAnalyticsService.getDetailedStudentReport(studentId, classId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false, // Don't revalidate automatically for detailed reports
      dedupingInterval: 120000, // 2 minutes deduping for detailed reports
      errorRetryCount: 2,
      errorRetryInterval: 3000,
    }
  );

  return {
    report: data,
    isLoading,
    error,
    mutate,
  };
}

// Custom hook that combines both test and student analytics for a class
export function useClassAnalytics(classId: string | null) {
  const testAnalytics = useClassTestAnalytics(classId);
  const studentAnalytics = useClassStudentAnalytics(classId);

  return {
    tests: testAnalytics.tests,
    students: studentAnalytics.students,
    isLoading: testAnalytics.isLoading || studentAnalytics.isLoading,
    error: testAnalytics.error || studentAnalytics.error,
    isEmpty: testAnalytics.isEmpty && studentAnalytics.isEmpty,
    mutate: () => {
      testAnalytics.mutate();
      studentAnalytics.mutate();
    }
  };
}