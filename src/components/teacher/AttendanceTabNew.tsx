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
import { ClassScheduleDocument } from '@/models/classScheduleSchema';
import { ClassDocument } from '@/models/classSchema';
import { ClassScheduleFirestoreService } from '@/apiservices/classScheduleFirestoreService';
import { Timestamp } from 'firebase/firestore';

interface AttendanceTabProps {
  classData: ClassDocument | null;
  classId: string;
}

type ScheduledClass = {
  id: string;
  classId: string;
  className: string;
  scheduledDate: Timestamp | Date;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  scheduleType: 'regular' | 'extra';
  topic?: string;
  teacherId?: string;
  teacherName?: string;
  subjectId?: string;
  subjectName?: string;
  attendance: {
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
  };
};

const AttendanceTab: React.FC<AttendanceTabProps> = ({ classData, classId }) => {
  const [scheduledClasses, setScheduledClasses] = useState<ScheduledClass[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showManualSchedule, setShowManualSchedule] = useState(false);
  const [manualDate, setManualDate] = useState('');
  const [manualStartTime, setManualStartTime] = useState('09:00');
  const [manualEndTime, setManualEndTime] = useState('10:00');
  const [manualNotes, setManualNotes] = useState('');
  const [scheduledDates, setScheduledDates] = useState<Date[]>([]);
  const [autoScheduleStatus, setAutoScheduleStatus] = useState<'idle' | 'running' | 'checking'>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (classData && classId) {
      loadScheduledClasses();
    }
  }, [classData, classId]);

  useEffect(() => {
    // Update scheduled dates when scheduled classes change
    const dates = scheduledClasses.map(schedule => {
      const date = schedule.scheduledDate instanceof Timestamp 
        ? schedule.scheduledDate.toDate() 
        : schedule.scheduledDate;
      return date;
    });
    
    setScheduledDates(dates);
  }, [scheduledClasses]);

  // Load class data (already provided as props)
  const loadClassData = async () => {
    try {
      // Use the existing classData from props - no need to fetch again
      console.log('✅ Using provided class data:', classData?.name);
    } catch (error) {
      console.error('Error loading class data:', error);
    }
  };

  // Load scheduled classes using the service
  const loadScheduledClasses = async () => {
    try {
      console.log('🔍 Loading scheduled classes for classId:', classId);
      
      // Use the service to load schedules
      const schedules = await ClassScheduleFirestoreService.getSchedulesByClassId(classId);
      console.log('✅ Loaded schedules:', schedules.length);
      
      // Convert to the format expected by the component
      const scheduledClassesData: ScheduledClass[] = schedules.map(schedule => ({
        id: schedule.id,
        classId: schedule.classId,
        className: schedule.className,
        scheduledDate: schedule.scheduledDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        status: schedule.status,
        scheduleType: schedule.scheduleType,
        topic: schedule.topic,
        teacherId: schedule.teacherId,
        teacherName: schedule.teacherName,
        subjectId: schedule.subjectId,
        subjectName: schedule.subjectName,
        attendance: {
          totalStudents: schedule.attendance?.totalStudents || 0,
          presentCount: schedule.attendance?.presentCount || 0,
          absentCount: schedule.attendance?.absentCount || 0,
          lateCount: schedule.attendance?.lateCount || 0,
        }
      }));
      
      setScheduledClasses(scheduledClassesData);
    } catch (error) {
      console.error('❌ Error loading scheduled classes:', error);
      setError('Failed to load scheduled classes');
    }
  };

  // Handle auto-scheduling via service
  const handleAutoSchedule = async () => {
    setAutoScheduleStatus('running');
    setError('');
    
    try {
      if (!classData) {
        throw new Error('Class data not loaded');
      }

      // Use the service to auto-schedule
      const scheduledCount = await ClassScheduleFirestoreService.autoScheduleForClass(classData, 7);
      
      setAutoScheduleStatus('idle');
      
      // Show appropriate message
      if (scheduledCount > 0) {
        alert(`✅ Successfully scheduled ${scheduledCount} classes for the next 7 days!`);
      } else {
        alert('All regular classes for the next 7 days are already scheduled.');
      }
      
      // Refresh the schedule list
      await loadScheduledClasses();
      
    } catch (error) {
      console.error('❌ Auto-scheduling failed:', error);
      setAutoScheduleStatus('idle');
      setError(`Failed to auto-schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle manual scheduling using service
  const handleManualSchedule = async () => {
    try {
      if (!classData || !manualDate || !manualStartTime || !manualEndTime) {
        setError('Please fill in all required fields');
        return;
      }

      const date = new Date(manualDate);
      
      // Use the service to create extra schedule
      const scheduleId = await ClassScheduleFirestoreService.createExtraSchedule(
        classData,
        date,
        manualStartTime,
        manualEndTime,
        manualNotes || 'Extra class'
      );
      
      // Reset form
      setManualDate('');
      setManualStartTime('09:00');
      setManualEndTime('10:00');
      setManualNotes('');
      setShowManualSchedule(false);
      setError('');
      
      alert('✅ Extra class scheduled successfully!');
      
      // Refresh the schedule list
      await loadScheduledClasses();
      
    } catch (error) {
      console.error('❌ Manual scheduling failed:', error);
      setError(`Failed to schedule class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle date selection in calendar
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    
    // Check if this date has any scheduled classes
    const scheduledOnDate = scheduledClasses.filter(schedule => {
      const scheduleDate = schedule.scheduledDate instanceof Timestamp 
        ? schedule.scheduledDate.toDate() 
        : schedule.scheduledDate;
      return scheduleDate.toDateString() === date.toDateString();
    });
    
    if (scheduledOnDate.length > 0) {
      const eventDetails = scheduledOnDate.map(schedule => 
        `${formatTime(schedule.startTime)} - ${schedule.scheduleType} class (${schedule.status})`
      ).join('\n');
      
      alert(`Scheduled classes on ${date.toDateString()}:\n${eventDetails}`);
    } else {
      // No classes scheduled - offer to schedule manually
      const confirmed = confirm(`No classes scheduled for ${date.toDateString()}. Would you like to schedule an extra class?`);
      if (confirmed) {
        setManualDate(date.toISOString().split('T')[0]);
        setShowManualSchedule(true);
      }
    }
  };

  const formatDate = (date: Date | Timestamp): string => {
    const actualDate = date instanceof Timestamp ? date.toDate() : date;
    return actualDate.toLocaleDateString();
  };

  const formatTime = (time: string): string => {
    // Convert 24-hour format to 12-hour format
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'ongoing':
        return 'text-blue-600';
      case 'cancelled':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  // Get upcoming classes (next 5)
  const upcomingClasses = scheduledClasses
    .filter(schedule => {
      const scheduleDate = schedule.scheduledDate instanceof Timestamp 
        ? schedule.scheduledDate.toDate() 
        : schedule.scheduledDate;
      return scheduleDate >= new Date() && schedule.status === 'scheduled';
    })
    .sort((a, b) => {
      const dateA = a.scheduledDate instanceof Timestamp ? a.scheduledDate.toDate() : a.scheduledDate;
      const dateB = b.scheduledDate instanceof Timestamp ? b.scheduledDate.toDate() : b.scheduledDate;
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Auto Schedule Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Auto Schedule Classes</h3>
        <p className="text-gray-600 mb-4">
          Automatically schedule regular classes for the next 7 days based on your class timetable.
        </p>
        
        <Button
          onClick={handleAutoSchedule}
          disabled={autoScheduleStatus === 'running' || !classData}
          className="flex items-center gap-2"
        >
          {autoScheduleStatus === 'running' ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {autoScheduleStatus === 'running' ? 'Scheduling...' : 'Auto Schedule'}
        </Button>
      </div>

      {/* Manual Schedule Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Manual Schedule</h3>
          <Button
            onClick={() => setShowManualSchedule(!showManualSchedule)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Extra Class
          </Button>
        </div>

        {showManualSchedule && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={manualStartTime}
                  onChange={(e) => setManualStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={manualEndTime}
                  onChange={(e) => setManualEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="e.g., Makeup class, Review session"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleManualSchedule} className="flex-1">
                Schedule Class
              </Button>
              <Button
                onClick={() => setShowManualSchedule(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Calendar and Schedule Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Calendar
          </h3>
          <SimpleCalendar
            onDateSelect={handleDateSelect}
            scheduledDates={scheduledDates}
          />
        </div>

        {/* Upcoming Classes */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Upcoming Classes</h3>
          
          {upcomingClasses.length > 0 ? (
            <div className="space-y-3">
              {upcomingClasses.map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{formatDate(schedule.scheduledDate)}</div>
                    <div className="text-sm text-gray-600">
                      {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {schedule.scheduleType === 'extra' ? 'Extra Class' : 'Regular Class'}
                      {schedule.topic && ` • ${schedule.topic}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(schedule.status)}
                    <span className={`text-sm font-medium ${getStatusColor(schedule.status)}`}>
                      {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No upcoming classes scheduled</p>
              <p className="text-sm">Use auto-schedule or add classes manually</p>
            </div>
          )}
        </div>
      </div>

      {/* All Scheduled Classes */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">All Scheduled Classes</h3>
          <Button
            onClick={loadScheduledClasses}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-500 mt-2">Loading scheduled classes...</p>
          </div>
        ) : scheduledClasses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-4 font-medium text-gray-700">Date</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-700">Time</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-700">Type</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-700">Topic</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-700">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {scheduledClasses.map((schedule) => (
                  <tr key={schedule.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">{formatDate(schedule.scheduledDate)}</td>
                    <td className="py-3 px-4">
                      {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        schedule.scheduleType === 'extra' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {schedule.scheduleType === 'extra' ? 'Extra' : 'Regular'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {schedule.topic || 'Regular Class'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(schedule.status)}
                        <span className={`text-sm font-medium ${getStatusColor(schedule.status)}`}>
                          {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {schedule.status === 'completed' ? (
                        <span className="text-sm text-gray-600">
                          {schedule.attendance.presentCount}/{schedule.attendance.totalStudents}
                          {schedule.attendance.totalStudents > 0 && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({Math.round((schedule.attendance.presentCount / schedule.attendance.totalStudents) * 100)}%)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Not taken</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No classes scheduled yet</p>
            <p className="text-sm">Start by using auto-schedule or adding classes manually</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceTab;
