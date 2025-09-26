'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/utils/firebase-client';
import TeacherLayout from '@/components/teacher/TeacherLayout';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Button from '@/components/ui/Button';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  BarChart3, 
  Users, 
  BookOpen, 
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowLeft,
  Clock,
  Target,
  Award,
  AlertCircle,
  Download,
  Eye
} from 'lucide-react';
import { 
  GradeAnalyticsService, 
  TestSummary, 
  StudentPerformanceSummary,
  DetailedStudentReport 
} from '@/apiservices/teacherGradeAnalyticsService';

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

// Student Report Modal Component
const StudentReportModal = ({ 
  student, 
  isOpen, 
  onClose, 
  classId 
}: { 
  student: StudentPerformanceSummary | null;
  isOpen: boolean;
  onClose: () => void;
  classId: string;
}) => {
  const [detailedReport, setDetailedReport] = useState<DetailedStudentReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && student) {
      loadDetailedReport();
    }
  }, [isOpen, student]);

  const loadDetailedReport = async () => {
    if (!student) return;
    
    try {
      setLoading(true);
      const report = await GradeAnalyticsService.getDetailedStudentReport(student.id, classId);
      setDetailedReport(report);
    } catch (error) {
      console.error('Error loading detailed report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">{student.name}</h2>
              <p className="text-muted-foreground">{student.email}</p>
            </div>
            <Button variant="outline" onClick={onClose}>
              ×
            </Button>
          </div>

          {loading ? (
            <div className="space-y-4">
              <LoadingSkeleton className="h-32 w-full" />
              <LoadingSkeleton className="h-64 w-full" />
            </div>
          ) : detailedReport ? (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{detailedReport.totalTestsCompleted}</div>
                    <div className="text-sm text-muted-foreground">Tests Completed</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{detailedReport.overallAverage.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Average Score</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{detailedReport.totalTestsPassed}</div>
                    <div className="text-sm text-muted-foreground">Tests Passed</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{detailedReport.lateSubmissions}</div>
                    <div className="text-sm text-muted-foreground">Late Submissions</div>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    {detailedReport.improvementTrend === 'improving' && (
                      <>
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        <Badge variant="default">Improving</Badge>
                      </>
                    )}
                    {detailedReport.improvementTrend === 'declining' && (
                      <>
                        <TrendingDown className="h-5 w-5 text-red-500" />
                        <Badge variant="destructive">Declining</Badge>
                      </>
                    )}
                    {detailedReport.improvementTrend === 'stable' && (
                      <>
                        <Minus className="h-5 w-5 text-yellow-500" />
                        <Badge variant="secondary">Stable</Badge>
                      </>
                    )}
                  </div>
                  {/* Here you could add a chart showing performance over time */}
                  <div className="text-sm text-muted-foreground">
                    Performance trend based on recent test scores
                  </div>
                </CardContent>
              </Card>

              {/* Recent Tests */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Tests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {detailedReport.recentTests.map((test, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <div className="font-medium">{test.testTitle}</div>
                          <div className="text-sm text-muted-foreground">
                            {test.testDate.toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{test.score} / {test.maxScore}</div>
                          <div className={`text-sm ${test.percentage >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                            {test.percentage.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Weak Topics */}
              {detailedReport.weakTopics.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Areas Needing Improvement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {detailedReport.weakTopics.map((topic, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <span>{topic.topic}</span>
                          <Badge variant="destructive">
                            {topic.accuracy.toFixed(1)}% accuracy
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              {detailedReport.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {detailedReport.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                          <span className="text-sm">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Strengths */}
              {detailedReport.strengths.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Strengths</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {detailedReport.strengths.map((strength, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Award className="h-4 w-4 text-green-500 mt-0.5" />
                          <span className="text-sm">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div>Failed to load detailed report</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ClassGradePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [students, setStudents] = useState<StudentPerformanceSummary[]>([]);
  const [isLoadingTests, setIsLoadingTests] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentPerformanceSummary | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading || !user || !classId) return;

    loadClassData();
  }, [user, loading, classId]);

  const loadClassData = async () => {
    try {
      setError(null);
      
      // Load tests and students in parallel
      const [testsData, studentsData] = await Promise.all([
        GradeAnalyticsService.getClassTestAnalytics(classId).finally(() => setIsLoadingTests(false)),
        GradeAnalyticsService.getClassStudentAnalytics(classId).finally(() => setIsLoadingStudents(false))
      ]);

      setTests(testsData);
      setStudents(studentsData);
    } catch (error) {
      console.error('Error loading class data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load class data');
      setIsLoadingTests(false);
      setIsLoadingStudents(false);
    }
  };

  const handleStudentClick = (student: StudentPerformanceSummary) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
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

  if (loading) {
    return (
      <TeacherLayout>
        <div className="container mx-auto p-6 space-y-6">
          <LoadingSkeleton className="h-8 w-64" />
          <LoadingSkeleton className="h-96 w-full" />
        </div>
      </TeacherLayout>
    );
  }

  if (!user) {
    return (
      <TeacherLayout>
        <div className="container mx-auto p-6">
          <SimpleAlert>
            Please log in to view class grades.
          </SimpleAlert>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          onClick={() => router.back()}
          className="p-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Class Analytics</h1>
          <p className="text-muted-foreground">
            Detailed analytics for tests and student performance
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <SimpleAlert>
          {error}
        </SimpleAlert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="tests" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tests">Class Tests Analytics</TabsTrigger>
          <TabsTrigger value="students">Students Performance</TabsTrigger>
        </TabsList>

        {/* Tests Tab */}
        <TabsContent value="tests" className="space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900">Class Tests Only</h4>
                <p className="text-sm text-blue-700">
                  This section shows only tests assigned to the entire class. Individual student assignments are not included.
                </p>
              </div>
            </div>
          </div>

          {isLoadingTests ? (
            <div className="grid gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <LoadingSkeleton className="h-6 w-48" />
                    <LoadingSkeleton className="h-4 w-32" />
                  </CardHeader>
                  <CardContent>
                    <LoadingSkeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : tests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Class Tests Found</h3>
                <p className="text-muted-foreground text-center">
                  No class-wide tests have been assigned to this class yet.<br />
                  Only tests assigned to the entire class will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Test Summary Cards */}
              <div className="grid gap-6">
                {tests.map((test) => (
                  <Card key={test.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-xl">{test.title}</CardTitle>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>{test.displayNumber || `Test #${test.testNumber || 'N/A'}`}</span>
                            <Badge variant="secondary">{test.type}</Badge>
                            <Badge variant={test.status === 'completed' ? 'default' : 'secondary'}>
                              {test.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{test.totalMarks}</div>
                          <div className="text-sm text-muted-foreground">Total Marks</div>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {/* Test Statistics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{test.completedStudents}</div>
                          <div className="text-sm text-muted-foreground">Completed</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">{test.averageScore.toFixed(1)}</div>
                          <div className="text-sm text-muted-foreground">Average</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">{test.passRate.toFixed(1)}%</div>
                          <div className="text-sm text-muted-foreground">Pass Rate</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">{test.averageTimeSpent.toFixed(0)}m</div>
                          <div className="text-sm text-muted-foreground">Avg Time</div>
                        </div>
                      </div>

                      {/* Additional Details */}
                      <div className="border-t pt-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Highest Score: </span>
                            <span className="font-medium">{test.highestScore}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Lowest Score: </span>
                            <span className="font-medium">{test.lowestScore}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Late Submissions: </span>
                            <span className="font-medium">{test.lateSubmissions}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Created: </span>
                            <span className="font-medium">{formatDate(test.createdAt)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total Students: </span>
                            <span className="font-medium">{test.totalStudents}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Attempted: </span>
                            <span className="font-medium">{test.attemptedStudents}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-6">
          {isLoadingStudents ? (
            <div className="grid gap-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <LoadingSkeleton className="h-12 w-48" />
                      <LoadingSkeleton className="h-8 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : students.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Students Found</h3>
                <p className="text-muted-foreground text-center">
                  No students are enrolled in this class yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {students.map((student) => (
                <Card 
                  key={student.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
                  onClick={() => handleStudentClick(student)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {student.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{student.name}</h3>
                          <p className="text-sm text-muted-foreground">{student.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{student.totalTestsCompleted}</div>
                          <div className="text-xs text-muted-foreground">Completed</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1">
                            {getPerformanceIcon(student.overallAverage)}
                            <span className="text-2xl font-bold">{student.overallAverage.toFixed(1)}%</span>
                          </div>
                          <div className="text-xs text-muted-foreground">Average</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">{student.totalTestsPassed}</div>
                          <div className="text-xs text-muted-foreground">Passed</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">{student.lateSubmissions}</div>
                          <div className="text-xs text-muted-foreground">Late</div>
                        </div>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Quick Stats */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Attendance: </span>
                          <span className="font-medium">{student.testAttendanceRate.toFixed(0)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Trend: </span>
                          <Badge variant={
                            student.improvementTrend === 'improving' ? 'default' :
                            student.improvementTrend === 'declining' ? 'destructive' : 'secondary'
                          }>
                            {student.improvementTrend}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Weak Topics: </span>
                          <span className="font-medium">{student.weakTopics.length}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Student Report Modal */}
      <StudentReportModal
        student={selectedStudent}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStudent(null);
        }}
        classId={classId}
      />
      </div>
    </TeacherLayout>
  );
}
