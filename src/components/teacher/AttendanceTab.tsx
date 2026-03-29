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
  Play,
  Users,
  UserCheck,
  UserX
} from 'lucide-react';
import { Button } from '@/components/ui';
import SimpleCalendar from '@/components/ui/SimpleCalendar';
import { ClassScheduleDocument } from '@/models/classScheduleSchema';
import { ClassDocument } from '@/models/classSchema';
import { ClassScheduleFirestoreService } from '@/apiservices/classScheduleFirestoreService';
import { StudentEnrollmentFirestoreService, EnrollmentWithParent } from '@/apiservices/studentEnrollmentFirestoreService';
import { MailService } from '@/apiservices/mailService';
import { Timestamp } from 'firebase/firestore';
import { StudentEnrollmentDocument } from '@/models/studentEnrollmentSchema';
import { ClassCompletionService } from '@/apiservices/classCompletionService';
import { MobileNotificationService } from '@/apiservices/mobileNotificationService';
import { ClassCompletionDocument } from '@/models/classCompletionSchema';
import FinishClassModal from './FinishClassModal';
import { useTeacherAuth } from '@/hooks/useTeacherAuth';

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
  cancellationReason?: string;
  cancelledAt?: Timestamp | Date;
  cancelledBy?: string;
  attendance?: {
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    attendanceRate?: number;
    students?: Array<{
      studentId: string;
      studentName: string;
      studentEmail: string;
      status: 'present' | 'absent' | 'late';
      markedAt?: Date;
      notes?: string;
      markedBy?: string;
    }>;
    lastUpdatedAt?: Date;
    lastUpdatedBy?: string;
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
  const [manualMode, setManualMode] = useState<'physical' | 'online'>('physical');
  const [manualLocation, setManualLocation] = useState('');
  const [manualZoomUrl, setManualZoomUrl] = useState('');
  const [manualZoomMeetingId, setManualZoomMeetingId] = useState('');
  const [manualZoomPassword, setManualZoomPassword] = useState('');
  const [scheduledDates, setScheduledDates] = useState<Date[]>([]);
  const [autoScheduleStatus, setAutoScheduleStatus] = useState<'idle' | 'running' | 'checking'>('idle');
  const [isScheduling, setIsScheduling] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showFinishClassModal, setShowFinishClassModal] = useState(false);
  const [modalSelectedDate, setModalSelectedDate] = useState<Date | null>(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showViewAttendanceModal, setShowViewAttendanceModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduledClass | null>(null);
  const [attendanceTimeValid, setAttendanceTimeValid] = useState(false);
  const [attendanceTimeMessage, setAttendanceTimeMessage] = useState('');
  const [isEditingAttendance, setIsEditingAttendance] = useState(false); // Track if we're editing existing attendance
  const [enrolledStudents, setEnrolledStudents] = useState<EnrollmentWithParent[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<{[key: string]: 'present' | 'absent' | 'late'}>({});
  const [selectedAbsentStudents, setSelectedAbsentStudents] = useState<Set<string>>(new Set());
  const [selectedAbsentForEmail, setSelectedAbsentForEmail] = useState<Set<string>>(new Set());
  const [sendingAbsenceEmails, setSendingAbsenceEmails] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [scheduleToCancel, setScheduleToCancel] = useState<ScheduledClass | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [teacherName, setTeacherName] = useState<string>('');
  
  // Class Completion State
  const { teacher } = useTeacherAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todaysClass, setTodaysClass] = useState<ScheduledClass | null>(null);
  const [classCompletion, setClassCompletion] = useState<ClassCompletionDocument | null>(null);
  const [markingFinished, setMarkingFinished] = useState(false);

  // Clock Timer
  useEffect(() => {
    // Return a date object that is adjusted to Melbourne Time for display purposes if needed, 
    // but better to just use current time and format it with timezone opt.
    // Actually, simply updating local state "currentTime" is fine, we handle TZ in render.
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Find Today's Class and Check Completion
  useEffect(() => {
    const checkToday = async () => {
      if (scheduledClasses.length > 0) {
        // Get "Today" in Melbourne Time
        const now = new Date();
        const melbourneDateStr = new Intl.DateTimeFormat('en-AU', {
            timeZone: 'Australia/Melbourne',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(now);
        
        // Find class scheduled for today (comparing Date strings)
        // We'll assume scheduledDate is stored as UTC or Local and we want to match the "Day"
        const todaySchedule = scheduledClasses.find(s => {
          const sDate = s.scheduledDate instanceof Timestamp ? s.scheduledDate.toDate() : s.scheduledDate;
           // Format schedule date to Melbourne string for comparison
          const scheduleDateStr = new Intl.DateTimeFormat('en-AU', {
            timeZone: 'Australia/Melbourne',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(sDate);
          
          return scheduleDateStr === melbourneDateStr;
        });

        setTodaysClass(todaySchedule || null);

        if (todaySchedule) {
           // Format date as YYYY-MM-DD for ID lookup from the Melbourne Date String
           // invalid: 25/01/2026 -> 2026-01-25
           const [dd, mm, yyyy] = melbourneDateStr.split('/');
           const dateStr = `${yyyy}-${mm}-${dd}`;
           
           try {
             const completion = await ClassCompletionService.getClassCompletion(classId, dateStr);
             setClassCompletion(completion);
           } catch (err) {
             console.error("Error fetching completion status", err);
           }
        }
      }
    };
    
    checkToday();
  }, [scheduledClasses, classId]);

  const handleMarkFinishedClick = () => {
    if (!todaysClass || !teacher?.id) return;
    setShowFinishClassModal(true);
  };

  const handleConfirmFinishClass = async () => {
    if (!todaysClass || !teacher?.id) return;
    
    setMarkingFinished(true);
    try {
        const now = new Date();
        const melbourneDateStr = new Intl.DateTimeFormat('en-AU', {
            timeZone: 'Australia/Melbourne',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(now);
        // invalid: 25/01/2026 -> 2026-01-25
        const [dd, mm, yyyy] = melbourneDateStr.split('/');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        await ClassCompletionService.markClassFinished(
           classId,
           teacher.id,
           dateStr,
           todaysClass.startTime,
           todaysClass.endTime
        );
        
        // Refresh status
        const completion = await ClassCompletionService.getClassCompletion(classId, dateStr);
        setClassCompletion(completion);
        
        // Notify parents
        await MobileNotificationService.notifyClassFinished(classId, teacherName || "Teacher");

        setShowFinishClassModal(false);

    } catch (error) {
        console.error("Failed to mark class as finished", error);
        alert("Failed to mark class as finished");
    } finally {
        setMarkingFinished(false);
    }
  };

  const getTimeRemaining = () => {
    if (!todaysClass) return "No class now";
    
    // Get current time in Melbourne for accurate comparison
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Australia/Melbourne',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    }).formatToParts(now);
    
    const hObj = parts.find(p => p.type === 'hour');
    const mObj = parts.find(p => p.type === 'minute');
    
    if (!hObj || !mObj) return "";
    
    // Handle "24" hour case if formatter returns it (though usually 0-23)
    let curH = parseInt(hObj.value);
    if (curH === 24) curH = 0;
    
    const curM = parseInt(mObj.value);
    const curTotalMins = curH * 60 + curM;
    
    // Parse Schedule (assuming HH:mm format)
    const [startH, startM] = todaysClass.startTime.split(':').map(Number);
    const startTotalMins = startH * 60 + startM;
    
    const [endH, endM] = todaysClass.endTime.split(':').map(Number);
    const endTotalMins = endH * 60 + endM;
    
    if (curTotalMins < startTotalMins) {
        return `Starts in ${startTotalMins - curTotalMins}m`;
    }
    
    if (curTotalMins > endTotalMins) {
        return "Class ended";
    }
    
    return `${endTotalMins - curTotalMins} minutes left`;
  };

  useEffect(() => {
    if (classData && classId) {
      loadScheduledClasses();
    }
  }, [classData, classId]);

  // Load teacher name when classData changes
  useEffect(() => {
    const loadTeacherName = async () => {
      if (classData?.teacherId) {
        try {
          const { TeacherFirestoreService } = await import('@/apiservices/teacherFirestoreService');
          const teacher = await TeacherFirestoreService.getTeacherById(classData.teacherId);
          if (teacher) {
            setTeacherName(teacher.name);
          }
        } catch (error) {
          console.error('Error loading teacher name:', error);
          setTeacherName('Teacher'); // Fallback
        }
      }
    };

    loadTeacherName();
  }, [classData?.teacherId]);

  useEffect(() => {
    // Update scheduled dates when scheduled classes change
    const dates = scheduledClasses.map(schedule => {
      const date = schedule.scheduledDate instanceof Timestamp 
        ? schedule.scheduledDate.toDate() 
        : schedule.scheduledDate;
      
      // Debug logging
      console.log('📅 Schedule date processing:', {
        original: schedule.scheduledDate,
        converted: date,
        dateString: date.toDateString(),
        isoString: date.toISOString(),
        localDateString: date.toLocaleDateString()
      });
      
      return date;
    });
    
    console.log('📅 Setting scheduled dates for calendar:', dates.map(d => d.toDateString()));
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
        attendance: schedule.attendance ? {
          totalStudents: schedule.attendance.totalStudents || 0,
          presentCount: schedule.attendance.presentCount || 0,
          absentCount: schedule.attendance.absentCount || 0,
          lateCount: schedule.attendance.lateCount || 0,
          attendanceRate: schedule.attendance.attendanceRate,
          students: schedule.attendance.students?.map(student => ({
            studentId: student.studentId,
            studentName: student.studentName,
            studentEmail: student.studentEmail,
            status: student.status,
            markedAt: student.markedAt instanceof Timestamp ? student.markedAt.toDate() : student.markedAt,
            notes: student.notes,
            markedBy: student.markedBy
          })) || [],
          lastUpdatedAt: schedule.attendance.lastUpdatedAt instanceof Timestamp ? schedule.attendance.lastUpdatedAt.toDate() : schedule.attendance.lastUpdatedAt,
          lastUpdatedBy: schedule.attendance.lastUpdatedBy
        } : undefined
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
      
      setIsScheduling(true);

      // Validate mode-specific requirements
      if (manualMode === 'physical' && !manualLocation.trim()) {
        setError('Location is required for physical classes');
        return;
      }
      
      if (manualMode === 'online' && !manualZoomUrl.trim()) {
        setError('Zoom URL is required for online classes');
        return;
      }

      // Create date in local timezone to avoid timezone issues
      const dateParts = manualDate.split('-');
      const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
      
      console.log('📅 Manual schedule date creation:', {
        manualDate,
        dateParts,
        createdDate: date,
        dateString: date.toDateString(),
        isoString: date.toISOString()
      });
      
      // Use the service to create extra schedule with all parameters
      const scheduleId = await ClassScheduleFirestoreService.createExtraSchedule(
        classData,
        date,
        manualStartTime,
        manualEndTime,
        manualNotes || 'Extra class',
        manualMode,
        manualLocation || undefined,
        manualZoomUrl || undefined,
        manualZoomMeetingId || undefined,
        manualZoomPassword || undefined
      );
      
      // Send email notifications to parents and students
      try {
        const enrollmentsList = await StudentEnrollmentFirestoreService.getEnrolledStudentsByClassId(classData.id);
        const classTime = `${manualStartTime} - ${manualEndTime}`;
        
        console.log('📧 Sending new class schedule notifications to', enrollmentsList.length, 'students and parents');
        
        await MailService.sendNewClassScheduleNotifications(
          enrollmentsList,
          classData.name,
          classData.subject,
          date.toISOString().split('T')[0], // Convert date to YYYY-MM-DD format
          classTime,
          teacherName || 'Teacher',
          'extra', // This is an extra/manual class
          manualMode,
          manualLocation || undefined,
          manualZoomUrl || undefined,
          manualNotes || undefined
        );
        
        console.log('✅ Email notifications sent successfully');
      } catch (emailError) {
        console.warn('⚠️ Failed to send email notifications:', emailError);
        // Don't fail the entire operation if email fails
      }
      
      // Reset form
      setManualDate('');
      setManualStartTime('09:00');
      setManualEndTime('10:00');
      setManualNotes('');
      setManualMode('physical');
      setManualLocation('');
      setManualZoomUrl('');
      setManualZoomMeetingId('');
      setManualZoomPassword('');
      setShowManualSchedule(false);
      setShowScheduleModal(false);
      setError('');
      
      alert('✅ Extra class scheduled successfully!');
      
      // Refresh the schedule list
      await loadScheduledClasses();
      
    } catch (error) {
      setError(`Failed to schedule class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsScheduling(false);
    }
  };

  // Handle date selection in calendar
  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date);
    
    // Prevent scheduling classes for past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    const selectedDateOnly = new Date(date);
    selectedDateOnly.setHours(0, 0, 0, 0); // Reset time to start of day
    
    if (selectedDateOnly < today) {
      alert('Cannot schedule classes for past dates. Please select today or a future date.');
      return;
    }
    
    // Check if this date has any scheduled classes
    const scheduledOnDate = scheduledClasses.filter(schedule => {
      const scheduleDate = schedule.scheduledDate instanceof Timestamp 
        ? schedule.scheduledDate.toDate() 
        : schedule.scheduledDate;
      
      // Compare dates without time components
      const scheduleDateOnly = new Date(scheduleDate);
      scheduleDateOnly.setHours(0, 0, 0, 0);
      
      return scheduleDateOnly.getTime() === selectedDateOnly.getTime();
    });
    
    if (scheduledOnDate.length > 0) {
      // There are scheduled classes
      if (scheduledOnDate.length > 1) {
        // Multiple classes on this date - show info to user
        const classListText = scheduledOnDate.map((schedule, idx) => 
          `${idx + 1}. ${schedule.startTime} - ${schedule.endTime}: ${schedule.topic || schedule.className}`
        ).join('\n');
        
        const confirmText = `There are ${scheduledOnDate.length} classes scheduled for this date:\n\n${classListText}\n\nClick OK to mark attendance for the first class, or view the list below to select a specific class.`;
        
        if (confirm(confirmText)) {
          await handleScheduleClick(scheduledOnDate[0]);
        }
      } else {
        // Single class - open directly
        await handleScheduleClick(scheduledOnDate[0]);
      }
    } else {
      // No classes scheduled - show modal to schedule extra class
      setModalSelectedDate(date);
      // Create proper local date string to avoid timezone issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const localDateString = `${year}-${month}-${day}`;
      setManualDate(localDateString);
      setShowScheduleModal(true);
    }
  };

  // Handle clicking on a scheduled class to mark attendance or view saved attendance
  const handleScheduleClick = async (schedule: ScheduledClass) => {
    setSelectedSchedule(schedule);
    
    // Check if attendance has already been marked with detailed logging
    console.log('🔍 Checking attendance data for schedule:', schedule.id);
    console.log('📊 Full schedule object:', schedule);
    console.log('📊 Schedule attendance object:', schedule.attendance);
    
    const hasAttendance = !!schedule.attendance;
    const hasTotalStudents = (schedule.attendance?.totalStudents || 0) > 0;
    const hasStudentsArray = schedule.attendance?.students && Array.isArray(schedule.attendance.students);
    const hasStudentsData = (schedule.attendance?.students?.length || 0) > 0;
    
    const hasAttendanceData = hasAttendance && hasTotalStudents && hasStudentsArray && hasStudentsData;
    
    console.log('✅ Attendance check result:', {
      hasAttendance,
      hasTotalStudents,
      hasStudentsArray,
      hasStudentsData,
      studentsArrayLength: schedule.attendance?.students?.length,
      totalStudents: schedule.attendance?.totalStudents,
      hasAttendanceData: hasAttendanceData
    });
    
    if (hasAttendanceData) {
      console.log('📋 Attendance already marked for this schedule, showing view modal');
      console.log('👥 Found attendance data:', {
        totalStudents: schedule.attendance?.totalStudents,
        studentsMarked: schedule.attendance?.students?.length,
        presentCount: schedule.attendance?.presentCount,
        absentCount: schedule.attendance?.absentCount
      });
      setAttendanceHistory(schedule.attendance?.students || []);
      setShowViewAttendanceModal(true);
      return;
    }

    console.log('📝 No attendance marked yet, showing marking interface');
    setIsEditingAttendance(false); // This is first-time marking
    
    // Open modal immediately for better UX
    setShowAttendanceModal(true);
    
    // Set loading state
    setLoadingStudents(true);
    setEnrolledStudents([]);
    setStudentAttendance({});
    
    // Calculate time validation in background
    const now = new Date();
    const scheduleDate = schedule.scheduledDate instanceof Timestamp 
      ? schedule.scheduledDate.toDate() 
      : schedule.scheduledDate;
    
    // Parse start and end times
    const [startHours, startMinutes] = schedule.startTime.split(':').map(Number);
    const [endHours, endMinutes] = schedule.endTime.split(':').map(Number);
    
    // Create start and end datetime objects
    const startDateTime = new Date(scheduleDate);
    startDateTime.setHours(startHours, startMinutes, 0, 0);
    
    const endDateTime = new Date(scheduleDate);
    endDateTime.setHours(endHours, endMinutes, 0, 0);
    
    // Calculate time windows - Allow attendance marking for the entire day
    const startOfDay = new Date(scheduleDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(scheduleDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('📅 Attendance time validation:', {
      now: now.toLocaleString(),
      classStart: startDateTime.toLocaleString(),
      classEnd: endDateTime.toLocaleString(),
      allowedFrom: startOfDay.toLocaleString(),
      allowedUntil: endOfDay.toLocaleString(),
      isWithinWindow: now >= startOfDay && now <= endOfDay
    });
    
    // Check if current time is within the same day as the scheduled class
    if (now >= startOfDay && now <= endOfDay) {
      setAttendanceTimeValid(true);
      
      if (now < startDateTime) {
        const minutesUntilStart = Math.ceil((startDateTime.getTime() - now.getTime()) / (1000 * 60));
        setAttendanceTimeMessage(`Class starts in ${minutesUntilStart} minutes. You can mark attendance now.`);
      } else if (now >= startDateTime && now <= endDateTime) {
        setAttendanceTimeMessage(`Class is currently ongoing. Perfect time to mark attendance!`);
      } else {
        const minutesSinceEnd = Math.ceil((now.getTime() - endDateTime.getTime()) / (1000 * 60));
        setAttendanceTimeMessage(`Class ended ${minutesSinceEnd} minutes ago. You can still mark attendance today.`);
      }
    } else {
      setAttendanceTimeValid(false);
      
      if (now < startOfDay) {
        const daysUntil = Math.ceil((startOfDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        setAttendanceTimeMessage(`This class is scheduled for a future date. Attendance can be marked on the day of the class (in ${daysUntil} day${daysUntil > 1 ? 's' : ''}).`);
      } else {
        setAttendanceTimeMessage(`Attendance marking closed. This class was on a previous day. Contact admin if you need to mark late attendance.`);
      }
    }

    // Load enrolled students asynchronously after modal is open
    try {
      console.log('🔍 Loading enrolled students for class:', schedule.classId);
      const students = await StudentEnrollmentFirestoreService.getEnrolledStudentsByClassId(schedule.classId);
      setEnrolledStudents(students);
      
      // Initialize attendance state - everyone starts as present
      const initialAttendance: {[key: string]: 'present' | 'absent' | 'late'} = {};
      students.forEach(student => {
        initialAttendance[student.studentId] = 'present';
      });
      setStudentAttendance(initialAttendance);
      setSelectedAbsentStudents(new Set());
      setSelectedAbsentForEmail(new Set());
      
      console.log('✅ Loaded students for attendance:', students.length);
    } catch (error) {
      console.error('❌ Failed to load enrolled students:', error);
      // Use empty array if loading fails
      setEnrolledStudents([]);
      setStudentAttendance({});
      setSelectedAbsentStudents(new Set());
      setSelectedAbsentForEmail(new Set());
    } finally {
      setLoadingStudents(false);
    }
  };  // Handle individual student attendance change
  const handleStudentAttendanceChange = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setStudentAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));

    if (status === 'absent') {
      setSelectedAbsentForEmail(prev => {
        const newSet = new Set(prev);
        newSet.add(studentId);
        return newSet;
      });
    }
    
    // Remove from absent selection if changing from absent
    if (status !== 'absent') {
      setSelectedAbsentStudents(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
      setSelectedAbsentForEmail(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  // Handle bulk absent selection
  const handleAbsentSelection = (studentId: string, isSelected: boolean) => {
    setSelectedAbsentStudents(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(studentId);
        // Also update attendance status
        setStudentAttendance(prevAttendance => ({
          ...prevAttendance,
          [studentId]: 'absent'
        }));
        setSelectedAbsentForEmail(prevEmail => {
          const emailSet = new Set(prevEmail);
          emailSet.add(studentId);
          return emailSet;
        });
      } else {
        newSet.delete(studentId);
        // Reset to present
        setStudentAttendance(prevAttendance => ({
          ...prevAttendance,
          [studentId]: 'present'
        }));
        setSelectedAbsentForEmail(prevEmail => {
          const emailSet = new Set(prevEmail);
          emailSet.delete(studentId);
          return emailSet;
        });
      }
      return newSet;
    });
  };

  // Mark all selected students as absent
  const handleMarkSelectedAbsent = () => {
    const updatedAttendance = { ...studentAttendance };
    selectedAbsentStudents.forEach(studentId => {
      updatedAttendance[studentId] = 'absent';
    });
    setStudentAttendance(updatedAttendance);
    setSelectedAbsentForEmail(prev => {
      const newSet = new Set(prev);
      selectedAbsentStudents.forEach(studentId => newSet.add(studentId));
      return newSet;
    });
    setSelectedAbsentStudents(new Set()); // Clear selection
  };

  const handleSendSelectedAbsenceEmails = async () => {
    if (!selectedSchedule) return;

    const selectedStudents = enrolledStudents.filter(student =>
      selectedAbsentForEmail.has(student.studentId) &&
      studentAttendance[student.studentId] === 'absent'
    );

    if (selectedStudents.length === 0) {
      alert('Please select absent students to email.');
      return;
    }

    setSendingAbsenceEmails(true);
    try {
      const scheduleDate = selectedSchedule.scheduledDate instanceof Timestamp
        ? selectedSchedule.scheduledDate.toDate()
        : selectedSchedule.scheduledDate;

      const classDate = scheduleDate.toISOString().split('T')[0];
      const classTime = `${formatTime(selectedSchedule.startTime)} - ${formatTime(selectedSchedule.endTime)}`;

      const emailPromises = selectedStudents
        .filter(student => student.parent?.email)
        .map(async (student) => {
          try {
            const mailId = await MailService.sendAbsenceNotificationEmail(
              student.parent!.name || 'Parent/Guardian',
              student.parent!.email,
              student.studentName,
              selectedSchedule.className,
              selectedSchedule.subjectName || 'Subject',
              classDate,
              classTime,
              teacherName || selectedSchedule.teacherName || 'Teacher'
            );
            return { success: true, student: student.studentName, mailId };
          } catch (emailError) {
            console.error('❌ Failed to send absence notification for', student.studentName, ':', emailError);
            return { success: false, student: student.studentName, error: emailError };
          }
        });

      const skippedEmails = selectedStudents.length - emailPromises.length;
      let successfulEmails = 0;
      let failedEmails = 0;

      if (emailPromises.length > 0) {
        const emailResults = await Promise.all(emailPromises);
        successfulEmails = emailResults.filter(result => result.success).length;
        failedEmails = emailResults.filter(result => !result.success).length;
      }

      alert(`📧 Absence emails completed.\n\nSelected absent students: ${selectedStudents.length}\nSent: ${successfulEmails}\nFailed: ${failedEmails}\nSkipped (no parent email): ${skippedEmails}`);
      setSelectedAbsentForEmail(new Set());
    } catch (error) {
      console.error('❌ Error sending selected absence emails:', error);
      alert('Failed to send absence emails. Please try again.');
    } finally {
      setSendingAbsenceEmails(false);
    }
  };

  // Save attendance data
  const handleSaveAttendance = async () => {
    if (!selectedSchedule) return;
    
    try {
      console.log('💾 Saving attendance:', studentAttendance);
      
      // Calculate attendance summary
      const totalStudents = enrolledStudents.length;
      const presentCount = Object.values(studentAttendance).filter(status => status === 'present').length;
      const absentCount = Object.values(studentAttendance).filter(status => status === 'absent').length;
      const lateCount = Object.values(studentAttendance).filter(status => status === 'late').length;
      const attendanceRate = totalStudents > 0 ? Math.round((presentCount + lateCount) / totalStudents * 100) : 0;
      
      console.log('📊 Attendance Summary:', {
        total: totalStudents,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        rate: attendanceRate
      });

      // Convert attendance data to the format expected by the service
      const studentAttendanceData = enrolledStudents.map(student => ({
        studentId: student.studentId,
        studentName: student.studentName,
        studentEmail: student.studentEmail,
        status: (studentAttendance[student.studentId] || 'absent') as 'present' | 'absent' | 'late',
        markedAt: new Date(),
        markedBy: 'teacher' // TODO: Use actual teacher ID from auth
        // Removed notes field to avoid undefined values in Firestore
      }));

      // Save attendance data to Firebase
      console.log('💾 Saving attendance data to Firebase...', {
        scheduleId: selectedSchedule.id,
        studentsCount: studentAttendanceData.length,
        sampleStudent: studentAttendanceData[0]
      });
      await ClassScheduleFirestoreService.markAttendance(selectedSchedule.id, studentAttendanceData);

      console.log('✅ Attendance data saved to Firebase successfully!');

      // Notify parents about their child's attendance (fire-and-forget)
      MobileNotificationService.notifyAttendanceMarked(
        selectedSchedule.classId,
        studentAttendanceData.map(s => ({
          studentId: s.studentId,
          studentName: s.studentName,
          status: s.status,
        })),
        selectedSchedule.className,
      );

      alert(`✅ Attendance saved successfully!\n\nSummary:\nPresent: ${presentCount}\nAbsent: ${absentCount}\nLate: ${lateCount}\nAttendance Rate: ${attendanceRate}%\n\nUse "Send Email to Selected Absent" to notify parents manually.`);
      
      // Close modal and refresh data
      setShowAttendanceModal(false);
      setSelectedSchedule(null);
      setStudentAttendance({});  // Clear attendance state
      setIsEditingAttendance(false); // Reset editing flag
      setLoadingStudents(false); // Reset loading state
      setEnrolledStudents([]); // Clear students list
      setSelectedAbsentStudents(new Set());
      setSelectedAbsentForEmail(new Set());
      
      // Add a small delay to ensure Firebase write is complete before reloading
      console.log('🔄 Reloading scheduled classes to reflect attendance changes...');
      setTimeout(async () => {
        await loadScheduledClasses(); // Reload to show updated attendance status
        console.log('✅ Schedule data reloaded after attendance save');
      }, 1500); // 1.5 second delay to ensure Firebase write is complete
      
    } catch (error) {
      console.error('❌ Failed to save attendance:', error);
      alert('Failed to save attendance. Please try again.');
    }
  };

  // Handle cancellation modal opening
  const handleCancelClass = (schedule: ScheduledClass) => {
    setScheduleToCancel(schedule);
    setCancellationReason('');
    setShowCancelModal(true);
  };

  // Handle class cancellation
  const handleConfirmCancellation = async () => {
    if (!scheduleToCancel || !cancellationReason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }

    setCancelLoading(true);
    try {
      console.log('🚫 Cancelling class:', scheduleToCancel.id);
      
      // Cancel the schedule in Firebase
      await ClassScheduleFirestoreService.cancelSchedule(
        scheduleToCancel.id,
        cancellationReason,
        'teacher' // TODO: Use actual teacher ID from auth
      );

      // Get enrolled students for notifications
      const enrolledStudents = await StudentEnrollmentFirestoreService.getEnrolledStudentsByClassId(scheduleToCancel.classId);
      
      // Send cancellation notifications if there are enrolled students
      if (enrolledStudents.length > 0) {
        const scheduleDate = scheduleToCancel.scheduledDate instanceof Timestamp 
          ? scheduleToCancel.scheduledDate.toDate() 
          : scheduleToCancel.scheduledDate;
        
        const classDate = scheduleDate.toISOString().split('T')[0];
        const classTime = `${formatTime(scheduleToCancel.startTime)} - ${formatTime(scheduleToCancel.endTime)}`;
        
        console.log('📧 Sending cancellation notifications to', enrolledStudents.length, 'students/parents');
        
        const emailResults = await MailService.sendClassCancellationNotifications(
          enrolledStudents,
          scheduleToCancel.className,
          scheduleToCancel.subjectName || 'Subject',
          classDate,
          classTime,
          teacherName || scheduleToCancel.teacherName || 'Teacher',
          cancellationReason
        );

        console.log('✅ Cancellation notifications sent:', emailResults);
        
        alert(`✅ Class cancelled successfully!\n\n📧 Sent ${emailResults.success} cancellation notifications to students and parents\n${emailResults.failed > 0 ? `⚠️ ${emailResults.failed} notifications failed to send` : ''}\n\n🚫 Class status updated to cancelled`);
      } else {
        alert('✅ Class cancelled successfully!\n\n🚫 Class status updated to cancelled');
      }

      // Close modal and refresh data
      setShowCancelModal(false);
      setScheduleToCancel(null);
      setCancellationReason('');
      
      // Refresh the schedule list
      setTimeout(async () => {
        await loadScheduledClasses();
        console.log('✅ Schedule data reloaded after cancellation');
      }, 1000);

    } catch (error) {
      console.error('❌ Failed to cancel class:', error);
      alert(`Failed to cancel class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCancelLoading(false);
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
      {/* Today's Class Completion Section */}
      {todaysClass && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div>
               <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 mb-1">
                 <Clock className="w-5 h-5" />
                 <span className="font-bold text-lg">
                    {currentTime.toLocaleTimeString('en-AU', { 
                        timeZone: 'Australia/Melbourne',
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit' 
                    })}
                 </span>
               </div>
               <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                 Today's Class: {todaysClass.className || todaysClass.subjectName || "Scheduled Class"}
               </h3>
               <p className="text-gray-600 dark:text-gray-300">
                 {todaysClass.startTime} - {todaysClass.endTime} • {getTimeRemaining()}
               </p>
             </div>
             
             <div>
               {classCompletion ? (
                 <div className="flex flex-col items-end text-green-600 dark:text-green-400">
                    <div className="flex items-center space-x-2 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg">
                      <CheckCircle className="w-6 h-6" />
                      <span className="font-bold">Finished at {classCompletion.finishedAt.toDate().toLocaleTimeString('en-AU', {
                          timeZone: 'Australia/Melbourne',
                          hour: '2-digit', 
                          minute:'2-digit'
                      })}</span>
                    </div>
                 </div>
               ) : (
                 <Button
                    onClick={handleMarkFinishedClick}
                    disabled={markingFinished}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center space-x-2"
                 >
                   {markingFinished ? (
                      <>Processing...</>
                   ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span>Mark Class as Finished</span>
                      </>
                   )}
                 </Button>
               )}
             </div>
          </div>
        </div>
      )}
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Auto Schedule Classes</h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={loadScheduledClasses}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Data
            </Button>
          </div>
        </div>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Class Mode
              </label>
              <select
                value={manualMode}
                onChange={(e) => setManualMode(e.target.value as 'physical' | 'online')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="physical">Physical Class</option>
                <option value="online">Online Class</option>
              </select>
            </div>

            {manualMode === 'physical' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location *
                </label>
                <input
                  type="text"
                  value={manualLocation}
                  onChange={(e) => setManualLocation(e.target.value)}
                  placeholder="e.g., Room 101, Main Building"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            )}

            {manualMode === 'online' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zoom Meeting URL *
                  </label>
                  <input
                    type="url"
                    value={manualZoomUrl}
                    onChange={(e) => setManualZoomUrl(e.target.value)}
                    placeholder="https://zoom.us/j/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meeting ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={manualZoomMeetingId}
                      onChange={(e) => setManualZoomMeetingId(e.target.value)}
                      placeholder="123-456-7890"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meeting Password (Optional)
                    </label>
                    <input
                      type="text"
                      value={manualZoomPassword}
                      onChange={(e) => setManualZoomPassword(e.target.value)}
                      placeholder="Meeting password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleManualSchedule} className="flex-1" disabled={isScheduling}>
                {isScheduling ? 'Scheduling...' : 'Schedule Class'}
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
          
          {/* Calendar Legend */}
          <div className="mb-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-gray-600">Scheduled classes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 rounded"></div>
              <span className="text-gray-600">Available dates</span>
            </div>
          </div>
          
          {/* Calendar Instructions */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>Tip:</strong> Click on any date with a green box to view scheduled classes, 
              or click on any available date to schedule an extra class.
            </p>
          </div>
          
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
                      {schedule.status === 'cancelled' && schedule.cancellationReason && (
                        <div className="mt-1 text-red-600 font-medium">
                          Cancelled: {schedule.cancellationReason}
                        </div>
                      )}
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
                  <th className="text-left py-2 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {scheduledClasses.map((schedule) => (
                  <tr key={schedule.id} className="border-b border-gray-100 hover:bg-blue-50 transition-all duration-200 hover:shadow-sm">
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
                      <div>
                        {schedule.topic || 'Regular Class'}
                        {schedule.status === 'cancelled' && schedule.cancellationReason && (
                          <div className="mt-1 text-xs text-red-600 italic">
                            Reason: {schedule.cancellationReason}
                          </div>
                        )}
                      </div>
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
                      {schedule.attendance && schedule.attendance.students && schedule.attendance.students.length > 0 ? (
                        <div className="text-sm">
                          <div className="text-gray-600 font-medium">
                            {schedule.attendance.presentCount || 0}/{schedule.attendance.totalStudents || 0}
                            <span className="text-xs text-gray-500 ml-1">
                              ({schedule.attendance.attendanceRate || 0}%)
                            </span>
                          </div>
                          <div className="text-xs text-green-600 mt-1">✓ Marked</div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 flex items-center">
                          <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                          Not taken
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {schedule.status !== 'cancelled' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleScheduleClick(schedule);
                              }}
                              className="text-xs"
                            >
                              {(schedule.attendance?.students?.length || 0) > 0 ? 'View' : 'Attendance'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelClass(schedule);
                              }}
                              className="text-xs text-red-600 hover:text-red-700 hover:border-red-300"
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        {schedule.status === 'cancelled' && (
                          <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                            Cancelled
                          </span>
                        )}
                      </div>
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
      
      {/* Schedule Extra Class Modal */}
      {showScheduleModal && modalSelectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              Schedule Extra Class
            </h3>
            
            <p className="text-gray-600 mb-6">
              No classes scheduled for <strong>{modalSelectedDate.toDateString()}</strong>. 
              Schedule an extra class for this date?
            </p>
            
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleManualSchedule();
              }}
            >
              {/* Two-column grid layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Date</label>
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full p-2 border rounded"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Start Time</label>
                    <input
                      type="time"
                      value={manualStartTime}
                      onChange={(e) => setManualStartTime(e.target.value)}
                      className="w-full p-2 border rounded"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">End Time</label>
                    <input
                      type="time"
                      value={manualEndTime}
                      onChange={(e) => setManualEndTime(e.target.value)}
                      className="w-full p-2 border rounded"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Class Mode</label>
                    <select
                      value={manualMode}
                      onChange={(e) => setManualMode(e.target.value as 'physical' | 'online')}
                      className="w-full p-2 border rounded"
                      required
                    >
                      <option value="physical">Physical Class</option>
                      <option value="online">Online Class</option>
                    </select>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {manualMode === 'physical' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Location *</label>
                      <input
                        type="text"
                        value={manualLocation}
                        onChange={(e) => setManualLocation(e.target.value)}
                        placeholder="e.g., Room 101, Main Building"
                        className="w-full p-2 border rounded"
                        required
                      />
                    </div>
                  )}
                  
                  {manualMode === 'online' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-2">Zoom Meeting URL *</label>
                        <input
                          type="url"
                          value={manualZoomUrl}
                          onChange={(e) => setManualZoomUrl(e.target.value)}
                          placeholder="https://zoom.us/j/..."
                          className="w-full p-2 border rounded"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">Meeting ID (Optional)</label>
                        <input
                          type="text"
                          value={manualZoomMeetingId}
                          onChange={(e) => setManualZoomMeetingId(e.target.value)}
                          placeholder="123-456-7890"
                          className="w-full p-2 border rounded"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">Meeting Password (Optional)</label>
                        <input
                          type="text"
                          value={manualZoomPassword}
                          onChange={(e) => setManualZoomPassword(e.target.value)}
                          placeholder="Meeting password"
                          className="w-full p-2 border rounded"
                        />
                      </div>
                    </>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                    <textarea
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      placeholder="Any additional notes for this class..."
                      className="w-full p-2 border rounded h-20"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <Button 
                   type="button"
                   variant="outline" 
                   onClick={() => setShowScheduleModal(false)}
                   disabled={isScheduling}
                >
                  Cancel
                </Button>
                <Button 
                   type="submit"
                   disabled={isScheduling}
                   className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isScheduling ? (
                    <>
                       <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                       Scheduling...
                    </>
                  ) : (
                    'Confirm Schedule'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Finish Class Modal */}
      <FinishClassModal
        isOpen={showFinishClassModal}
        onClose={() => setShowFinishClassModal(false)}
        onConfirm={handleConfirmFinishClass}
        isProcessing={markingFinished}
        className={todaysClass?.className || todaysClass?.subjectName || "Scheduled Class"}
      />

      
      {/* Attendance Marking Modal */}
      {showAttendanceModal && selectedSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                {isEditingAttendance ? 'Edit Attendance' : 'Mark Attendance'}
              </h3>
              <button
                onClick={() => {
                  setShowAttendanceModal(false);
                  setSelectedSchedule(null);
                  setIsEditingAttendance(false);
                  setLoadingStudents(false);
                  setEnrolledStudents([]);
                  setStudentAttendance({});
                  setSelectedAbsentStudents(new Set());
                  setSelectedAbsentForEmail(new Set());
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            {/* Class Details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Class Details</h4>
                  <p><strong>Subject:</strong> {selectedSchedule.subjectName}</p>
                  <p><strong>Date:</strong> {formatDate(selectedSchedule.scheduledDate)}</p>
                  <p><strong>Time:</strong> {formatTime(selectedSchedule.startTime)} - {formatTime(selectedSchedule.endTime)}</p>
                  <p><strong>Type:</strong> {selectedSchedule.scheduleType === 'extra' ? 'Extra Class' : 'Regular Class'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Current Status</h4>
                  <p><strong>Class Status:</strong> {selectedSchedule.status.charAt(0).toUpperCase() + selectedSchedule.status.slice(1)}</p>
                  <p><strong>Current Time:</strong> {new Date().toLocaleString()}</p>
                </div>
              </div>
            </div>
            
            {/* Time Validation Message */}
            <div className={`rounded-lg p-4 mb-6 flex items-start gap-3 ${
              (attendanceTimeValid || isEditingAttendance)
                ? 'bg-green-50 border border-green-200' 
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              {(attendanceTimeValid || isEditingAttendance) ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              )}
              <div>
                <h4 className={`font-medium ${
                  (attendanceTimeValid || isEditingAttendance) ? 'text-green-800' : 'text-yellow-800'
                }`}>
                  {isEditingAttendance 
                    ? 'Editing Attendance Record' 
                    : (attendanceTimeValid ? 'Attendance Available' : 'Attendance Not Available')
                  }
                </h4>
                <p className={`text-sm ${
                  (attendanceTimeValid || isEditingAttendance) ? 'text-green-700' : 'text-yellow-700'
                }`}>
                  {attendanceTimeMessage}
                </p>
              </div>
            </div>
            
            {(attendanceTimeValid || isEditingAttendance) ? (
              <>
                {/* Attendance Instructions */}
                <div className="mb-6">
                  <h4 className="font-medium text-gray-700 mb-3">Mark Student Attendance</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    All students start as <strong>Present</strong>. Use individual buttons or select multiple students for bulk marking as absent.
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    Parent emails are manual. Mark absentees first, then use the email checkbox for each absent student and click <strong>Send Email to Selected Absent</strong>.
                  </p>
                  
                  {/* Easy Mode - Bulk Selection */}
                  {enrolledStudents.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h5 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                        <UserX className="h-4 w-4" />
                        Easy Mode: Mark Multiple Absent
                      </h5>
                      <p className="text-sm text-blue-700 mb-3">
                        Select students who didn't attend and click "Mark Selected as Absent"
                      </p>
                      {selectedAbsentStudents.size > 0 && (
                        <button
                          onClick={handleMarkSelectedAbsent}
                          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors text-sm"
                        >
                          Mark {selectedAbsentStudents.size} Student(s) as Absent
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Student List */}
                {enrolledStudents.length > 0 ? (
                  <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Students ({enrolledStudents.length})
                    </div>
                    {enrolledStudents.map((student) => {
                      const currentStatus = studentAttendance[student.studentId] || 'present';
                      const isSelectedForAbsent = selectedAbsentStudents.has(student.studentId);
                      const isSelectedForEmail = selectedAbsentForEmail.has(student.studentId);
                      
                      return (
                        <div key={student.studentId} className={`border rounded-lg p-3 transition-colors ${
                          isSelectedForAbsent ? 'bg-red-50 border-red-200' : 'bg-white'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {/* Checkbox for bulk selection */}
                              <input
                                type="checkbox"
                                checked={isSelectedForAbsent}
                                onChange={(e) => handleAbsentSelection(student.studentId, e.target.checked)}
                                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                              />
                              <div>
                                <p className="font-medium">{student.studentName}</p>
                                <p className="text-sm text-gray-500">{student.studentEmail}</p>
                                {currentStatus === 'absent' && (
                                  <label className="mt-1 inline-flex items-center gap-2 text-xs text-gray-700">
                                    <input
                                      type="checkbox"
                                      checked={isSelectedForEmail}
                                      onChange={(e) => {
                                        setSelectedAbsentForEmail(prev => {
                                          const newSet = new Set(prev);
                                          if (e.target.checked) {
                                            newSet.add(student.studentId);
                                          } else {
                                            newSet.delete(student.studentId);
                                          }
                                          return newSet;
                                        });
                                      }}
                                      className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    Send email
                                  </label>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleStudentAttendanceChange(student.studentId, 'present')}
                                className={`flex items-center gap-1 px-3 py-1 rounded-md transition-colors text-sm ${
                                  currentStatus === 'present' 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                }`}
                              >
                                <UserCheck className="h-4 w-4" />
                                Present
                              </button>
                              <button 
                                onClick={() => handleStudentAttendanceChange(student.studentId, 'late')}
                                className={`flex items-center gap-1 px-3 py-1 rounded-md transition-colors text-sm ${
                                  currentStatus === 'late' 
                                    ? 'bg-yellow-500 text-white' 
                                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                }`}
                              >
                                <Clock className="h-4 w-4" />
                                Late
                              </button>
                              <button 
                                onClick={() => handleStudentAttendanceChange(student.studentId, 'absent')}
                                className={`flex items-center gap-1 px-3 py-1 rounded-md transition-colors text-sm ${
                                  currentStatus === 'absent' 
                                    ? 'bg-red-500 text-white' 
                                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                                }`}
                              >
                                <UserX className="h-4 w-4" />
                                Absent
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : loadingStudents ? (
                  <div className="text-center py-8">
                    <div className="flex flex-col items-center gap-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      <div className="text-gray-600">
                        <p className="font-medium">Loading enrolled students...</p>
                        <p className="text-sm text-gray-500">Please wait while we fetch the student list</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No enrolled students found for this class</p>
                    <p className="text-sm">Please check if students are enrolled in this class</p>
                  </div>
                )}
                
                {/* Attendance Summary */}
                {enrolledStudents.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h5 className="font-medium text-gray-700 mb-2">Attendance Summary</h5>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-green-600">
                          {Object.values(studentAttendance).filter(s => s === 'present').length}
                        </div>
                        <div className="text-gray-600">Present</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-yellow-600">
                          {Object.values(studentAttendance).filter(s => s === 'late').length}
                        </div>
                        <div className="text-gray-600">Late</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-red-600">
                          {Object.values(studentAttendance).filter(s => s === 'absent').length}
                        </div>
                        <div className="text-gray-600">Absent</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-600">
                          {enrolledStudents.length > 0 ? Math.round(
                            (Object.values(studentAttendance).filter(s => s === 'present' || s === 'late').length / enrolledStudents.length) * 100
                          ) : 0}%
                        </div>
                        <div className="text-gray-600">Rate</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={() => {
                      setShowAttendanceModal(false);
                      setSelectedSchedule(null);
                      setEnrolledStudents([]);
                      setStudentAttendance({});
                      setSelectedAbsentStudents(new Set());
                      setSelectedAbsentForEmail(new Set());
                    }}
                    className="px-4 py-2 text-gray-600 border rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendSelectedAbsenceEmails}
                    disabled={selectedAbsentForEmail.size === 0 || sendingAbsenceEmails}
                    className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingAbsenceEmails
                      ? 'Sending Emails...'
                      : `Send Email to Selected Absent (${selectedAbsentForEmail.size})`}
                  </button>
                  <button
                    onClick={handleSaveAttendance}
                    disabled={enrolledStudents.length === 0}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isEditingAttendance ? 'Update Attendance' : 'Save Attendance'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => {
                    setShowAttendanceModal(false);
                    setSelectedSchedule(null);
                    setLoadingStudents(false);
                    setEnrolledStudents([]);
                    setStudentAttendance({});
                    setSelectedAbsentStudents(new Set());
                    setSelectedAbsentForEmail(new Set());
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Saved Attendance Modal */}
      {showViewAttendanceModal && selectedSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900">
                  View Attendance - {selectedSchedule.className}
                </h3>
                <button
                  onClick={() => {
                    setShowViewAttendanceModal(false);
                    setSelectedSchedule(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <p><strong>Date:</strong> {selectedSchedule.scheduledDate instanceof Date 
                  ? selectedSchedule.scheduledDate.toDateString() 
                  : selectedSchedule.scheduledDate.toDate().toDateString()}</p>
                <p><strong>Time:</strong> {formatTime(selectedSchedule.startTime)} - {formatTime(selectedSchedule.endTime)}</p>
                {selectedSchedule.attendance && (
                  <p><strong>Attendance Rate:</strong> {selectedSchedule.attendance.attendanceRate}% 
                    ({selectedSchedule.attendance.presentCount + selectedSchedule.attendance.lateCount} out of {selectedSchedule.attendance.totalStudents} students)</p>
                )}
              </div>
            </div>

            <div className="p-6">
              {attendanceHistory && attendanceHistory.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Present Students */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-green-800 mb-3 flex items-center">
                      <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                      Present ({attendanceHistory.filter(s => s.status === 'present').length})
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {attendanceHistory.filter(s => s.status === 'present').map(student => (
                        <div key={student.studentId} className="bg-white rounded p-3 border border-green-100">
                          <p className="font-medium text-gray-900">{student.studentName}</p>
                          <p className="text-sm text-gray-600">{student.studentEmail}</p>
                          {student.markedAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              Marked: {new Date(student.markedAt).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Absent Students */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-red-800 mb-3 flex items-center">
                      <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                      Absent ({attendanceHistory.filter(s => s.status === 'absent').length})
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {attendanceHistory.filter(s => s.status === 'absent').map(student => (
                        <div key={student.studentId} className="bg-white rounded p-3 border border-red-100">
                          <p className="font-medium text-gray-900">{student.studentName}</p>
                          <p className="text-sm text-gray-600">{student.studentEmail}</p>
                          {student.markedAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              Marked: {new Date(student.markedAt).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Late Students */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-yellow-800 mb-3 flex items-center">
                      <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                      Late ({attendanceHistory.filter(s => s.status === 'late').length})
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {attendanceHistory.filter(s => s.status === 'late').map(student => (
                        <div key={student.studentId} className="bg-white rounded p-3 border border-yellow-100">
                          <p className="font-medium text-gray-900">{student.studentName}</p>
                          <p className="text-sm text-gray-600">{student.studentEmail}</p>
                          {student.markedAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              Marked: {new Date(student.markedAt).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No attendance data available for this class.</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between">
                <div className="flex space-x-3">
                  <button
                    onClick={async () => {
                      setShowViewAttendanceModal(false);
                      
                      // Load enrolled students and populate current attendance
                      try {
                        console.log('🔍 Loading enrolled students for editing attendance');
                        const students = await StudentEnrollmentFirestoreService.getEnrolledStudentsByClassId(selectedSchedule!.classId);
                        setEnrolledStudents(students);
                        
                        // Populate current attendance data for editing
                        if (selectedSchedule?.attendance?.students) {
                          const currentAttendance: { [key: string]: 'present' | 'absent' | 'late' } = {};
                          const absentForEmail = new Set<string>();
                          selectedSchedule.attendance.students.forEach(student => {
                            currentAttendance[student.studentId] = student.status;
                            if (student.status === 'absent') {
                              absentForEmail.add(student.studentId);
                            }
                          });
                          setStudentAttendance(currentAttendance);
                          setSelectedAbsentStudents(new Set());
                          setSelectedAbsentForEmail(absentForEmail);
                        }
                        
                        // Validate attendance time (for editing, we're more lenient)
                        setAttendanceTimeValid(true);
                        setAttendanceTimeMessage('Editing existing attendance record. You can modify student attendance status.');
                        setIsEditingAttendance(true); // Set editing mode
                        
                        // Switch to edit mode - show the attendance marking modal
                        setShowAttendanceModal(true);
                      } catch (error) {
                        console.error('Error loading students for editing:', error);
                        alert('Failed to load student data for editing. Please try again.');
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Edit Attendance
                  </button>
                  
                  {/* Cancel Class Button - only show if class is not already cancelled */}
                  {selectedSchedule?.status !== 'cancelled' && (
                    <button
                      onClick={() => {
                        setShowViewAttendanceModal(false);
                        handleCancelClass(selectedSchedule!);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel Class
                    </button>
                  )}
                </div>
                
                <button
                  onClick={() => {
                    setShowViewAttendanceModal(false);
                    setSelectedSchedule(null);
                    setIsEditingAttendance(false); // Reset editing flag
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Class Cancellation Modal */}
      {showCancelModal && scheduleToCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                Cancel Class
              </h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={cancelLoading}
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-red-800 font-medium mb-1">
                      Are you sure you want to cancel this class?
                    </p>
                    <p className="text-red-700">
                      This will notify all students and parents via email.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 mb-2 text-sm">Class Details:</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><span className="font-medium">Date:</span> {formatDate(scheduleToCancel.scheduledDate)}</p>
                  <p><span className="font-medium">Time:</span> {formatTime(scheduleToCancel.startTime)} - {formatTime(scheduleToCancel.endTime)}</p>
                  <p><span className="font-medium">Type:</span> {scheduleToCancel.scheduleType === 'extra' ? 'Extra Class' : 'Regular Class'}</p>
                  {scheduleToCancel.topic && scheduleToCancel.topic !== 'Regular Class' && (
                    <p><span className="font-medium">Topic:</span> {scheduleToCancel.topic}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Cancellation *
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Please provide a reason for cancelling this class (required for email notification to students and parents)"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                  disabled={cancelLoading}
                  required
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3 p-4 border-t border-gray-200 sticky bottom-0 bg-white">
              <Button 
                variant="outline"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancellationReason('');
                  setScheduleToCancel(null);
                }}
                disabled={cancelLoading}
                size="sm"
              >
                Keep Class
              </Button>
              <Button 
                onClick={handleConfirmCancellation}
                disabled={cancelLoading || !cancellationReason.trim()}
                className="bg-red-600 hover:bg-red-700 text-white"
                size="sm"
              >
                {cancelLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel Class
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceTab;
