'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock,
  Plus,
  RefreshCw,
  AlertCircle,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui';
import SimpleCalendar from '@/components/ui/SimpleCalendar';
import { firestore } from '@/utils/firebase-client';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  getDocs,
  Timestamp,
  limit,
  doc,
  getDoc
} from 'firebase/firestore';
import { ClassScheduleDocument } from '@/models/classScheduleSchema';
import { ClassDocument } from '@/models/classSchema';

interface AttendanceTabProps {
  classId: string;
}

interface AttendanceRecord {
  id: string;
  date: Date;
  studentId: string;
  studentName: string;
  status: 'present' | 'absent' | 'late';
  markedAt?: Date;
  notes?: string;
}

interface AttendanceSession {
  id: string;
  date: Date;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  records: AttendanceRecord[];
}

interface ScheduledClass {
  id: string;
  classId: string;
  className: string;
  scheduledDate: Timestamp;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  scheduleType: 'regular' | 'extra';
  topic?: string;
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  attendance: {
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
  };
}

interface ScheduleForm {
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
}

export default function AttendanceTab({ classId }: AttendanceTabProps) {
  const [loading, setLoading] = useState(true);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [scheduledClasses, setScheduledClasses] = useState<ScheduledClass[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>({
    date: '',
    startTime: '',
    endTime: '',
    notes: ''
  });
  const [schedulingLoading, setSchedulingLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoScheduleStatus, setAutoScheduleStatus] = useState<'idle' | 'running' | 'checking'>('idle');

  // Load scheduled classes from Firebase
  const loadScheduledClasses = async () => {
    try {
      const currentDate = new Date();
      const oneMonthAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const threeMonthsLater = new Date(currentDate.getFullYear(), currentDate.getMonth() + 3, 0);
      
      // Query Firestore for scheduled classes
      const schedulesRef = collection(firestore, 'classSchedules');
      const q = query(
        schedulesRef,
        where('classId', '==', classId),
        where('scheduledDate', '>=', Timestamp.fromDate(oneMonthAgo)),
        where('scheduledDate', '<=', Timestamp.fromDate(threeMonthsLater)),
        orderBy('scheduledDate', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const schedules: ScheduledClass[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data() as ClassScheduleDocument;
        schedules.push({
          id: doc.id,
          classId: data.classId,
          className: data.className,
          scheduledDate: data.scheduledDate,
          startTime: data.startTime,
          endTime: data.endTime,
          status: data.status as any,
          scheduleType: data.scheduleType as any,
          topic: data.topic,
          teacherId: data.teacherId,
          teacherName: data.teacherName,
          subjectId: data.subjectId,
          subjectName: data.subjectName,
          attendance: {
            totalStudents: data.attendance?.totalStudents || 0,
            presentCount: data.attendance?.presentCount || 0,
            absentCount: data.attendance?.absentCount || 0,
            lateCount: data.attendance?.lateCount || 0,
          }
        });
      });
      
      setScheduledClasses(schedules);
    } catch (error) {
      console.error('Error loading scheduled classes:', error);
      setError('Failed to load scheduled classes');
    }
  };

  // Handle auto-scheduling via cron API
  const handleAutoSchedule = async () => {
    setAutoScheduleStatus('running');
    setError('');
    
    try {
      const response = await fetch('/api/cron/schedule-classes', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to run auto-scheduling');
      }
      
      const result = await response.json();
      
      // Reload scheduled classes to see new ones
      await loadScheduledClasses();
      
      setAutoScheduleStatus('idle');
      
      // Show success message
      if (result.scheduled > 0) {
        alert(`Successfully scheduled ${result.scheduled} classes automatically!`);
      } else {
        alert('Auto-scheduling completed. All regular classes are already scheduled.');
      }
    } catch (error) {
      console.error('Error running auto-schedule:', error);
      setError('Failed to run auto-scheduling');
      setAutoScheduleStatus('idle');
    }
  };

  // Handle manual class scheduling
  const handleManualSchedule = async () => {
    if (!scheduleForm.date || !scheduleForm.startTime || !scheduleForm.endTime) {
      setError('Please fill in all required fields');
      return;
    }

    // Check if class already scheduled for this date
    const selectedDateObj = new Date(scheduleForm.date);
    const existingSchedule = scheduledClasses.find(schedule => {
      const scheduleDate = schedule.scheduledDate.toDate();
      return scheduleDate.toDateString() === selectedDateObj.toDateString();
    });
    
    if (existingSchedule) {
      setError('A class is already scheduled for this date');
      return;
    }

    setSchedulingLoading(true);
    setError('');
    
    try {
      // Create new schedule document
      const newSchedule = {
        classId,
        className: 'Class Name', // You might want to fetch this from class data
        subjectId: 'default-subject', // You might want to fetch this
        subjectName: 'Subject Name', // You might want to fetch this
        teacherId: 'current-teacher-id', // You might want to get this from auth
        teacherName: 'Teacher Name', // You might want to fetch this
        scheduledDate: Timestamp.fromDate(selectedDateObj),
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        scheduleType: 'extra' as const,
        mode: 'physical' as const,
        status: 'scheduled' as const,
        topic: scheduleForm.notes,
        description: scheduleForm.notes,
        attendance: {
          totalStudents: 0,
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          attendanceRate: 0,
          students: [],
        },
        isRecurring: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: 'current-teacher-id', // You might want to get this from auth
      };
      
      const schedulesRef = collection(firestore, 'classSchedules');
      await addDoc(schedulesRef, newSchedule);
      
      // Reload scheduled classes
      await loadScheduledClasses();
      
      // Reset form and close modal
      setScheduleForm({
        date: '',
        startTime: '',
        endTime: '',
        notes: ''
      });
      setShowScheduleForm(false);
      setSelectedDate(undefined);
      
    } catch (error: any) {
      console.error('Error scheduling class:', error);
      setError(error.message || 'Failed to schedule class');
    } finally {
      setSchedulingLoading(false);
    }
  };

  // Handle calendar date selection
  const handleDateSelect = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    
    // Check if date already has a scheduled class
    const existingSchedule = scheduledClasses.find(schedule => {
      const scheduleDate = schedule.scheduledDate.toDate();
      return scheduleDate.toDateString() === date.toDateString();
    });
    
    if (existingSchedule) {
      setError('A class is already scheduled for this date');
      return;
    }
    
    setSelectedDate(date);
    setScheduleForm(prev => ({
      ...prev,
      date: dateStr
    }));
    setShowScheduleForm(true);
    setError('');
  };

  // Load attendance and scheduled classes data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      try {
        // Load scheduled classes
        await loadScheduledClasses();
        
        // Simulate loading attendance data
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock attendance data
        const mockSessions: AttendanceSession[] = [
          {
            id: '1',
            date: new Date('2025-08-19'),
            totalStudents: 25,
            presentCount: 23,
            absentCount: 1,
            lateCount: 1,
            records: []
          },
          {
            id: '2',
            date: new Date('2025-08-18'),
            totalStudents: 25,
            presentCount: 25,
            absentCount: 0,
            lateCount: 0,
            records: []
          }
        ];
        
        setAttendanceSessions(mockSessions);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (classId) {
      loadData();
    }
  }, [classId]);

  const calculateAttendanceRate = () => {
    if (attendanceSessions.length === 0) return 0;
    
    const totalSessions = attendanceSessions.length;
    const totalPresent = attendanceSessions.reduce((sum, session) => 
      sum + session.presentCount + session.lateCount, 0
    );
    const totalPossible = attendanceSessions.reduce((sum, session) => 
      sum + session.totalStudents, 0
    );
    
    return totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-t-2 border-blue-600 border-solid rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading attendance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Scheduling Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Class Scheduling
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage regular and extra class schedules
            </p>
          </div>
          <div className="flex space-x-3">
            <Button
              onClick={handleAutoSchedule}
              disabled={autoScheduleStatus !== 'idle'}
              variant="outline"
              className="flex items-center space-x-2"
            >
              {autoScheduleStatus === 'running' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span>
                {autoScheduleStatus === 'running' ? 'Running...' : 'Auto Schedule'}
              </span>
            </Button>
            <Button
              onClick={() => setShowScheduleForm(true)}
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Extra Class</span>
            </Button>
          </div>
        </div>

        {/* Calendar and Schedule Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <div>
            <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
              Calendar View
            </h4>
            <SimpleCalendar
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              scheduledDates={scheduledClasses.map(schedule => schedule.scheduledDate.toDate())}
              minDate={new Date()} // Only allow future dates
            />
          </div>

          {/* Schedule Form */}
          {showScheduleForm && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-medium text-gray-900 dark:text-white">
                  Schedule New Class
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowScheduleForm(false);
                    setSelectedDate(undefined);
                    setScheduleForm({ date: '', startTime: '', endTime: '', notes: '' });
                    setError('');
                  }}
                >
                  ×
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.date}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, date: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={scheduleForm.startTime}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={scheduleForm.endTime}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes/Topic (Optional)
                  </label>
                  <textarea
                    value={scheduleForm.notes}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder="Class topic or notes..."
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  />
                </div>

                <Button
                  onClick={handleManualSchedule}
                  disabled={schedulingLoading}
                  className="w-full"
                >
                  {schedulingLoading ? 'Scheduling...' : 'Schedule Class'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Upcoming Scheduled Classes */}
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
            Upcoming Classes ({scheduledClasses.filter(c => c.scheduledDate.toDate() >= new Date()).length})
          </h4>
          
          {scheduledClasses.length === 0 ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No scheduled classes found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scheduledClasses
                .filter(schedule => schedule.scheduledDate.toDate() >= new Date()) // Future classes only
                .sort((a, b) => a.scheduledDate.toDate().getTime() - b.scheduledDate.toDate().getTime())
                .slice(0, 5) // Show only next 5
                .map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {schedule.scheduledDate.toDate().toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {schedule.startTime} - {schedule.endTime}
                          {schedule.scheduleType === 'extra' && (
                            <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded">
                              Extra
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {schedule.status}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Attendance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Sessions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {attendanceSessions.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Attendance Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {calculateAttendanceRate()}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Late Arrivals</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {attendanceSessions.reduce((sum, session) => sum + session.lateCount, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Absences</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {attendanceSessions.reduce((sum, session) => sum + session.absentCount, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Sessions List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Attendance Sessions
          </h3>
        </div>
        <div className="p-6">
          {attendanceSessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Attendance Records
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Start by marking attendance for your first class session.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {attendanceSessions.slice(0, 5).map((session) => (
                <div key={session.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {session.date.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {session.totalStudents} students • {session.presentCount} present • {session.absentCount} absent
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">
                        {Math.round((session.presentCount / session.totalStudents) * 100)}% attendance
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
