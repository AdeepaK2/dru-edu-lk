import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// Enums for type safety
export type ScheduleType = 'regular' | 'extra';
export type ClassMode = 'physical' | 'online';
export type AttendanceStatus = 'present' | 'absent' | 'late';

// Individual student attendance record
export const studentAttendanceSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  studentName: z.string().min(1, 'Student name is required'),
  studentEmail: z.string().email('Valid email is required'),
  status: z.enum(['present', 'absent', 'late']).default('absent'),
  markedAt: z.date().optional(),
  notes: z.string().optional(),
  markedBy: z.string().optional(), // teacherId who marked attendance
});

// Attendance summary for the class session
export const classAttendanceSchema = z.object({
  totalStudents: z.number().min(0).default(0),
  presentCount: z.number().min(0).default(0),
  absentCount: z.number().min(0).default(0),
  lateCount: z.number().min(0).default(0),
  attendanceRate: z.number().min(0).max(100).default(0), // percentage
  students: z.array(studentAttendanceSchema).default([]),
  lastUpdatedAt: z.date().optional(),
  lastUpdatedBy: z.string().optional(), // teacherId
});

// Main class schedule schema
export const classScheduleSchema = z.object({
  classId: z.string().min(1, 'Class ID is required'),
  className: z.string().min(1, 'Class name is required'),
  subjectId: z.string().min(1, 'Subject ID is required'),
  subjectName: z.string().min(1, 'Subject name is required'),
  teacherId: z.string().min(1, 'Teacher ID is required'),
  teacherName: z.string().min(1, 'Teacher name is required'),
  
  // Schedule details
  scheduledDate: z.date(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Valid time format required (HH:MM)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Valid time format required (HH:MM)'),
  duration: z.number().min(15).max(480).default(60), // duration in minutes, max 8 hours
  
  // Schedule type and mode
  scheduleType: z.enum(['regular', 'extra']).default('regular'),
  mode: z.enum(['physical', 'online']).default('physical'),
  
  // Location details
  location: z.string().optional(), // for physical classes
  zoomUrl: z.string().url().optional(), // for online classes
  zoomMeetingId: z.string().optional(),
  zoomPassword: z.string().optional(),
  
  // Attendance tracking
  attendance: classAttendanceSchema.default({}),
  
  // Additional details
  topic: z.string().optional(),
  description: z.string().optional(),
  materials: z.array(z.string()).default([]), // references to study materials
  
  // Status and metadata
  status: z.enum(['scheduled', 'ongoing', 'completed', 'cancelled']).default('scheduled'),
  isRecurring: z.boolean().default(false),
  recurringPattern: z.string().optional(), // e.g., "weekly", "daily"
  
  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().min(1, 'Creator ID is required'),
  updatedBy: z.string().optional(),
});

// Update schema for partial updates
export const classScheduleUpdateSchema = classScheduleSchema.partial().extend({
  updatedAt: z.date(),
  updatedBy: z.string().min(1, 'Updater ID is required'),
});

// Type definitions
export type StudentAttendanceData = z.infer<typeof studentAttendanceSchema>;
export type ClassAttendanceData = z.infer<typeof classAttendanceSchema>;
export type ClassScheduleData = z.infer<typeof classScheduleSchema>;
export type ClassScheduleUpdateData = z.infer<typeof classScheduleUpdateSchema>;

// Document interfaces (with Firestore Timestamp)
export interface StudentAttendanceDocument extends Omit<StudentAttendanceData, 'markedAt'> {
  id?: string;
  markedAt?: Timestamp;
}

export interface ClassAttendanceDocument extends Omit<ClassAttendanceData, 'students' | 'lastUpdatedAt'> {
  students: StudentAttendanceDocument[];
  lastUpdatedAt?: Timestamp;
}

export interface ClassScheduleDocument extends Omit<ClassScheduleData, 'scheduledDate' | 'createdAt' | 'updatedAt' | 'attendance'> {
  id: string;
  scheduledDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  attendance: ClassAttendanceDocument;
}

// Display data interfaces (for UI components)
export interface StudentAttendanceDisplayData extends StudentAttendanceData {
  id: string;
  formattedMarkedTime?: string;
  relativeMarkedTime?: string; // e.g., "2 minutes ago"
}

export interface ClassAttendanceDisplayData extends ClassAttendanceData {
  students: StudentAttendanceDisplayData[];
  formattedLastUpdated?: string;
  attendanceRateFormatted?: string; // e.g., "85%"
}

export interface ClassScheduleDisplayData extends ClassScheduleData {
  id: string;
  formattedDate?: string; // e.g., "Monday, Aug 19, 2025"
  formattedTime?: string; // e.g., "2:00 PM - 3:30 PM"
  formattedDuration?: string; // e.g., "1h 30m"
  relativeTime?: string; // e.g., "in 2 hours", "2 days ago"
  attendance: ClassAttendanceDisplayData;
  canJoinZoom?: boolean; // calculated based on current time
  timeUntilStart?: string; // e.g., "Starting in 15 minutes"
  dayOfWeek?: string;
  isToday?: boolean;
  isPast?: boolean;
  isCurrent?: boolean;
}

// Helper functions for data conversion
export function classScheduleDocumentToDisplay(doc: ClassScheduleDocument): ClassScheduleDisplayData {
  const scheduledDate = doc.scheduledDate instanceof Timestamp 
    ? doc.scheduledDate.toDate() 
    : doc.scheduledDate;
  
  const createdAt = doc.createdAt instanceof Timestamp 
    ? doc.createdAt.toDate() 
    : doc.createdAt;
  
  const updatedAt = doc.updatedAt instanceof Timestamp 
    ? doc.updatedAt.toDate() 
    : doc.updatedAt;

  const attendance: ClassAttendanceDisplayData = {
    ...doc.attendance,
    students: doc.attendance.students.map(student => ({
      ...student,
      id: student.id || '',
      markedAt: student.markedAt instanceof Timestamp 
        ? student.markedAt.toDate() 
        : student.markedAt,
      formattedMarkedTime: student.markedAt 
        ? (student.markedAt instanceof Timestamp ? student.markedAt.toDate() : student.markedAt).toLocaleTimeString()
        : undefined,
      relativeMarkedTime: student.markedAt 
        ? getRelativeTime(student.markedAt instanceof Timestamp ? student.markedAt.toDate() : student.markedAt)
        : undefined,
    })),
    lastUpdatedAt: doc.attendance.lastUpdatedAt instanceof Timestamp 
      ? doc.attendance.lastUpdatedAt.toDate() 
      : doc.attendance.lastUpdatedAt,
    formattedLastUpdated: doc.attendance.lastUpdatedAt 
      ? (doc.attendance.lastUpdatedAt instanceof Timestamp 
          ? doc.attendance.lastUpdatedAt.toDate() 
          : doc.attendance.lastUpdatedAt).toLocaleString()
      : undefined,
    attendanceRateFormatted: `${doc.attendance.attendanceRate}%`,
  };

  const now = new Date();
  const startDateTime = new Date(scheduledDate);
  const [startHours, startMinutes] = doc.startTime.split(':').map(Number);
  startDateTime.setHours(startHours, startMinutes, 0, 0);
  
  const [endHours, endMinutes] = doc.endTime.split(':').map(Number);
  const endDateTime = new Date(scheduledDate);
  endDateTime.setHours(endHours, endMinutes, 0, 0);

  const isToday = isSameDay(scheduledDate, now);
  const isPast = endDateTime < now;
  const isCurrent = now >= startDateTime && now <= endDateTime;
  const canJoinZoom = doc.mode === 'online' && !isPast && (isCurrent || startDateTime.getTime() - now.getTime() <= 15 * 60 * 1000); // 15 minutes before

  return {
    ...doc,
    scheduledDate,
    createdAt,
    updatedAt,
    attendance,
    formattedDate: scheduledDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    formattedTime: `${formatTime(doc.startTime)} - ${formatTime(doc.endTime)}`,
    formattedDuration: formatDuration(doc.duration),
    relativeTime: getRelativeTime(scheduledDate),
    dayOfWeek: scheduledDate.toLocaleDateString('en-US', { weekday: 'long' }),
    isToday,
    isPast,
    isCurrent,
    canJoinZoom,
    timeUntilStart: !isPast ? getTimeUntilStart(startDateTime, now) : undefined,
  };
}

// Validation functions
export function validateClassScheduleData(data: unknown): ClassScheduleData {
  return classScheduleSchema.parse(data);
}

export function validateStudentAttendanceData(data: unknown): StudentAttendanceData {
  return studentAttendanceSchema.parse(data);
}

export function validateClassAttendanceData(data: unknown): ClassAttendanceData {
  return classAttendanceSchema.parse(data);
}

// Default data functions
export function getDefaultClassScheduleData(): Partial<ClassScheduleData> {
  const now = new Date();
  return {
    scheduledDate: now,
    startTime: '09:00',
    endTime: '10:00',
    duration: 60,
    scheduleType: 'regular',
    mode: 'physical',
    status: 'scheduled',
    isRecurring: false,
    createdAt: now,
    updatedAt: now,
    attendance: {
      totalStudents: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      attendanceRate: 0,
      students: [],
    }
  };
}

export function getDefaultStudentAttendanceData(): Partial<StudentAttendanceData> {
  return {
    status: 'absent',
  };
}

// Utility helper functions
function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}m`;
  } else if (mins === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${mins}m`;
  }
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 0) {
    const absDiff = Math.abs(diffInSeconds);
    if (absDiff < 60) return 'in a few seconds';
    if (absDiff < 3600) return `in ${Math.floor(absDiff / 60)} minutes`;
    if (absDiff < 86400) return `in ${Math.floor(absDiff / 3600)} hours`;
    return `in ${Math.floor(absDiff / 86400)} days`;
  }
  
  if (diffInSeconds < 60) return 'a few seconds ago';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

function getTimeUntilStart(startTime: Date, now: Date): string {
  const diffInSeconds = Math.floor((startTime.getTime() - now.getTime()) / 1000);
  
  if (diffInSeconds <= 0) return 'Starting now';
  if (diffInSeconds < 60) return 'Starting in a few seconds';
  if (diffInSeconds < 3600) return `Starting in ${Math.floor(diffInSeconds / 60)} minutes`;
  if (diffInSeconds < 86400) return `Starting in ${Math.floor(diffInSeconds / 3600)} hours`;
  return `Starting in ${Math.floor(diffInSeconds / 86400)} days`;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.toDateString() === date2.toDateString();
}

// Attendance calculation helpers
export function calculateAttendanceRate(students: StudentAttendanceData[]): number {
  if (students.length === 0) return 0;
  const presentOrLate = students.filter(s => s.status === 'present' || s.status === 'late').length;
  return Math.round((presentOrLate / students.length) * 100);
}

export function calculateAttendanceCounts(students: StudentAttendanceData[]): {
  total: number;
  present: number;
  absent: number;
  late: number;
} {
  const total = students.length;
  const present = students.filter(s => s.status === 'present').length;
  const absent = students.filter(s => s.status === 'absent').length;
  const late = students.filter(s => s.status === 'late').length;
  
  return { total, present, absent, late };
}

// Validation helpers for online classes
export function validateOnlineClassData(data: ClassScheduleData): string[] {
  const errors: string[] = [];
  
  if (data.mode === 'online') {
    if (!data.zoomUrl) {
      errors.push('Zoom URL is required for online classes');
    }
  }
  
  if (data.mode === 'physical') {
    if (!data.location) {
      errors.push('Location is required for physical classes');
    }
  }
  
  return errors;
}

// Types are already exported above with their definitions
