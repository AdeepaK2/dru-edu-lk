'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, Users, Clock, Award, Search, Filter } from 'lucide-react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { getEnrollmentsByStudent } from '@/services/studentEnrollmentService';
import { StudentEnrollment } from '@/models/studentEnrollmentSchema';
import { Button, Input } from '@/components/ui';

export default function StudentClassesPage() {
  const { student, loading: authLoading } = useStudentAuth();
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Load student's enrollments
  useEffect(() => {
    const loadEnrollments = async () => {
      if (!student?.id) return;

      try {
        setLoading(true);
        const studentEnrollments = await getEnrollmentsByStudent(student.id);
        setEnrollments(studentEnrollments);
      } catch (error) {
        console.error('Error loading enrollments:', error);
      } finally {
        setLoading(false);
      }
    };

    if (student?.id) {
      loadEnrollments();
    }
  }, [student?.id]);

  // Filter enrollments based on search and status
  const filteredEnrollments = enrollments.filter(enrollment => {
    const matchesSearch = 
      enrollment.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || enrollment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Please log in to view your classes.</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Classes</h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                View all your enrolled classes and track your progress
              </p>
            </div>
            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
              <BookOpen className="w-5 h-5" />
              <span className="font-medium">{filteredEnrollments.length} Classes</span>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search classes or subjects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Inactive">Inactive</option>
                <option value="Dropped">Dropped</option>
              </select>
            </div>
          </div>
        </div>

        {/* Classes Grid */}
        {filteredEnrollments.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12">
            <div className="text-center">
              <BookOpen className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchTerm || statusFilter !== 'all' ? 'No classes found' : 'No enrolled classes'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria' 
                  : 'Contact your administrator to get enrolled in classes'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredEnrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
              >
                {/* Class Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                        {enrollment.className}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {enrollment.subject}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    enrollment.status === 'Active' 
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                      : enrollment.status === 'Completed'
                      ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                      : enrollment.status === 'Inactive'
                      ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                      : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                  }`}>
                    {enrollment.status}
                  </span>
                </div>

                {/* Class Info */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">Enrolled</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {enrollment.enrolledAt.toLocaleDateString()}
                    </span>
                  </div>
                  
                  {enrollment.grade !== undefined && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Award className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">Grade</span>
                      </div>
                      <span className={`text-sm font-medium ${
                        enrollment.grade >= 80 
                          ? 'text-green-600 dark:text-green-400'
                          : enrollment.grade >= 60
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {enrollment.grade}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress Bar for Grade */}
                {enrollment.grade !== undefined && (
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          enrollment.grade >= 80 
                            ? 'bg-green-600'
                            : enrollment.grade >= 60
                            ? 'bg-yellow-600'
                            : 'bg-red-600'
                        }`}
                        style={{ width: `${enrollment.grade}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {enrollment.notes && (
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">Notes:</span> {enrollment.notes}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Navigate to tests page for this class
                      window.location.href = `/student/tests?classId=${enrollment.id}`;
                    }}
                  >
                    Tests
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Navigate to study materials page for this class
                      window.location.href = `/student/study?classId=${enrollment.id}`;
                    }}
                  >
                    Study
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Navigate to videos page for this class
                      window.location.href = `/student/videos?classId=${enrollment.id}`;
                    }}
                  >
                    Videos
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {filteredEnrollments.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Class Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {filteredEnrollments.filter(e => e.status === 'Active').length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {filteredEnrollments.filter(e => e.status === 'Completed').length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {Math.round(filteredEnrollments.reduce((acc, e) => acc + e.attendance, 0) / filteredEnrollments.length) || 0}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Avg Attendance</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {filteredEnrollments.filter(e => e.grade !== undefined).length > 0 
                    ? Math.round(filteredEnrollments
                        .filter(e => e.grade !== undefined)
                        .reduce((acc, e) => acc + (e.grade || 0), 0) / 
                      filteredEnrollments.filter(e => e.grade !== undefined).length) 
                    : 'N/A'
                  }{filteredEnrollments.filter(e => e.grade !== undefined).length > 0 ? '%' : ''}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Avg Grade</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
